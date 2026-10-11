import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConditionType } from '@resello/shared';
import { api, getApiErrorMessage } from '../../lib/api';
import { useAuth } from '../auth/AuthContext';
import type { Item } from '../buy/marketplaceStore';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const priceFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
});

export function EditListingForm({ itemId }: { itemId: string }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [item, setItem] = useState<Item | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<ConditionType | ''>('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const urls = images.map((image) => URL.createObjectURL(image));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<{ item: Item }>(`/items/${itemId}`)
      .then(({ data }) => {
        if (!active) return;
        setItem(data.item);
        setTitle(data.item.title);
        setDescription(data.item.description);
        setPrice(String(data.item.price));
        setCondition(data.item.condition ?? '');
      })
      .catch((requestError: unknown) => {
        if (active) setError(getApiErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [itemId]);

  function addImages(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if ((item?.image_urls?.length ?? 1) + images.length + selected.length > MAX_IMAGES) {
      setError(`This listing can have no more than ${MAX_IMAGES} photos in total.`);
      return;
    }
    if (selected.some((image) => !ACCEPTED_IMAGE_TYPES.includes(image.type))) {
      setError('Choose JPEG, PNG, or WebP images only.');
      return;
    }
    if (selected.some((image) => image.size > MAX_IMAGE_SIZE)) {
      setError('Each additional photo must be 5 MB or smaller.');
      return;
    }
    setImages((current) => [...current, ...selected]);
    setError(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!item) return;
    setError(null);
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', price);
      formData.append('condition', condition);
      images.forEach((image) => formData.append('images', image));
      await api.patch(`/items/${item.id}`, formData);
      navigate('/sell/listings', { replace: true });
    } catch (submitError) {
      setError(
        submitError instanceof Error && !('isAxiosError' in submitError)
          ? submitError.message
          : getApiErrorMessage(submitError),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div
        className="mx-auto h-96 w-full max-w-2xl animate-pulse rounded-2xl bg-slate-200"
        aria-busy="true"
      />
    );
  }

  if (error && !item) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-2xl border border-red-200 bg-red-50 p-6">
        <p role="alert" className="text-sm text-red-800">
          {error}
        </p>
        <Link className="button button-secondary w-fit" to="/sell/listings">
          Back to my listings
        </Link>
      </div>
    );
  }

  if (!item) return null;

  if (item.seller_id !== user?._id) {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-2xl border border-red-200 bg-red-50 p-6">
        <p role="alert" className="text-sm text-red-800">
          This listing does not belong to your seller account.
        </p>
        <Link className="button button-secondary w-fit" to="/sell/listings">
          Back to my listings
        </Link>
      </div>
    );
  }

  if (item.status !== 'ACTIVE') {
    return (
      <div className="mx-auto grid w-full max-w-2xl gap-4 rounded-2xl border border-amber-200 bg-amber-50 p-6">
        <p role="alert" className="text-sm text-amber-900">
          This listing cannot be edited while it is {item.status.toLowerCase()}.
        </p>
        <Link className="button button-secondary w-fit" to="/sell/listings">
          Back to my listings
        </Link>
      </div>
    );
  }

  const currentImageUrls = item.image_urls?.length ? item.image_urls : [item.image_url];

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mx-auto grid w-full max-w-2xl gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
    >
      <div className="grid gap-1">
        <p className="text-xs font-bold uppercase tracking-wide text-indigo-700">
          Listing price: {priceFormatter.format(item.price)}
        </p>
        <p className="text-sm text-slate-600">
          Changes apply to this one item. It stays hidden from other buyers while reserved.
        </p>
      </div>

      <label
        className="grid gap-2 text-sm font-semibold text-slate-700"
        htmlFor="edit-listing-title"
      >
        Title
        <input
          id="edit-listing-title"
          className="min-h-12 rounded-xl border border-slate-300 px-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          required
          minLength={2}
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>

      <label
        className="grid gap-2 text-sm font-semibold text-slate-700"
        htmlFor="edit-listing-condition"
      >
        Condition
        <select
          id="edit-listing-condition"
          className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          required
          value={condition}
          onChange={(event) => setCondition(event.target.value as ConditionType | '')}
        >
          <option value="">Choose condition</option>
          <option value={ConditionType.NEW}>New</option>
          <option value={ConditionType.LIKE_NEW}>Like new</option>
          <option value={ConditionType.GOOD}>Good</option>
          <option value={ConditionType.FAIR}>Fair</option>
          <option value={ConditionType.POOR}>Poor</option>
        </select>
      </label>

      <label
        className="grid gap-2 text-sm font-semibold text-slate-700"
        htmlFor="edit-listing-description"
      >
        Description
        <textarea
          id="edit-listing-description"
          className="min-h-32 resize-y rounded-xl border border-slate-300 p-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          required
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
        />
        <span className="font-normal text-slate-500">{description.length}/2000 characters</span>
      </label>

      <label
        className="grid gap-2 text-sm font-semibold text-slate-700"
        htmlFor="edit-listing-price"
      >
        Price (₹)
        <input
          id="edit-listing-price"
          className="min-h-12 rounded-xl border border-slate-300 px-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          type="number"
          min="0.01"
          max="10000000"
          step="0.01"
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
      </label>

      <fieldset className="grid gap-3">
        <legend className="text-sm font-semibold text-slate-700">
          Photos ({currentImageUrls.length + images.length}/{MAX_IMAGES})
        </legend>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Current listing photos">
          {currentImageUrls.map((imageUrl, index) => (
            <li key={imageUrl} className="relative">
              <img
                className="aspect-square w-full rounded-xl border border-slate-200 bg-slate-50 object-contain p-2"
                src={api.getUri({ url: imageUrl })}
                alt={`Current photo ${index + 1} of ${item.title}`}
              />
              {index === 0 && (
                <span className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-xs font-semibold text-slate-700">
                  Cover
                </span>
              )}
            </li>
          ))}
          {images.map((image, index) => (
            <li key={`${image.name}-${image.lastModified}-${index}`} className="relative">
              <img
                className="aspect-square w-full rounded-xl border border-indigo-200 bg-slate-50 object-contain p-2"
                src={previews[index]}
                alt={`New photo ${index + 1}: ${image.name}`}
              />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-semibold text-red-700 shadow"
                aria-label={`Remove new photo ${index + 1}`}
                onClick={() =>
                  setImages((current) => current.filter((_, imageIndex) => imageIndex !== index))
                }
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <label
          className="grid gap-2 text-sm font-semibold text-slate-700"
          htmlFor="edit-listing-images"
        >
          Add more photos
          <input
            id="edit-listing-images"
            className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 text-sm file:mr-4 file:min-h-12 file:border-0 file:bg-indigo-50 file:px-4 file:font-semibold file:text-indigo-800 hover:file:bg-indigo-100"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={currentImageUrls.length + images.length >= MAX_IMAGES}
            onChange={(event) => {
              addImages(event.target.files);
              event.target.value = '';
            }}
          />
          <span className="font-normal text-slate-500">
            Existing photos stay in place. Add up to {MAX_IMAGES} photos total; each added photo can
            be up to 5 MB.
          </span>
        </label>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link to="/sell/listings" className="button button-secondary button-wide">
          Cancel
        </Link>
        <button className="button button-primary button-wide" type="submit" disabled={busy}>
          {busy ? 'Saving changes…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
