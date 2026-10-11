import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ConditionType } from '@resello/shared';
import { api, getApiErrorMessage } from '../../lib/api';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 5;
const MAX_TOTAL_IMAGE_SIZE = 15 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function CreateListingForm() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [condition, setCondition] = useState<ConditionType | ''>('');
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const urls = images.map((image) => URL.createObjectURL(image));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [images]);

  function addImages(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files);
    if (images.length + selected.length > MAX_IMAGES) {
      setError(`Choose up to ${MAX_IMAGES} images per listing.`);
      return;
    }
    if (selected.some((image) => !ACCEPTED_IMAGE_TYPES.includes(image.type))) {
      setError('Choose JPEG, PNG, or WebP images only.');
      return;
    }
    if (selected.some((image) => image.size > MAX_IMAGE_SIZE)) {
      setError('Each image must be 5 MB or smaller.');
      return;
    }
    const totalSize = [...images, ...selected].reduce((total, image) => total + image.size, 0);
    if (totalSize > MAX_TOTAL_IMAGE_SIZE) {
      setError('The total size of all listing photos must be 15 MB or less.');
      return;
    }

    setImages((current) => [...current, ...selected]);
    setError(null);
    setSuccess(null);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (images.length === 0) {
      setError('Choose at least one product image before publishing.');
      return;
    }

    setBusy(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('description', description.trim());
      formData.append('price', price);
      formData.append('condition', condition);
      images.forEach((image) => formData.append('images', image));
      await api.post('/items', formData);

      setTitle('');
      setDescription('');
      setPrice('');
      setCondition('');
      setImages([]);
      if (imageInputRef.current) imageInputRef.current.value = '';
      setSuccess('Your item and photos are live in the Buy marketplace.');
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

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mx-auto grid w-full max-w-2xl gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8"
    >
      <label className="grid gap-2 text-sm font-semibold text-slate-700" htmlFor="listing-title">
        Title
        <input
          id="listing-title"
          className="min-h-12 rounded-xl border border-slate-300 px-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          required
          minLength={2}
          maxLength={120}
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Engineering Mathematics textbook"
        />
      </label>

      <label
        className="grid gap-2 text-sm font-semibold text-slate-700"
        htmlFor="listing-description"
      >
        Description
        <textarea
          id="listing-description"
          className="min-h-32 resize-y rounded-xl border border-slate-300 p-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          required
          maxLength={2000}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Share the condition and anything a buyer should know."
        />
      </label>

      <label
        className="grid gap-2 text-sm font-semibold text-slate-700"
        htmlFor="listing-condition"
      >
        Condition
        <select
          id="listing-condition"
          className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          required
          value={condition}
          onChange={(event) => setCondition(event.target.value as ConditionType)}
        >
          <option value="">Choose condition</option>
          <option value={ConditionType.NEW}>New</option>
          <option value={ConditionType.LIKE_NEW}>Like new</option>
          <option value={ConditionType.GOOD}>Good</option>
          <option value={ConditionType.FAIR}>Fair</option>
          <option value={ConditionType.POOR}>Poor</option>
        </select>
      </label>

      <label className="grid gap-2 text-sm font-semibold text-slate-700" htmlFor="listing-price">
        Price (₹)
        <input
          id="listing-price"
          className="min-h-12 rounded-xl border border-slate-300 px-4 font-normal outline-none transition focus:border-indigo-700 focus:ring-4 focus:ring-indigo-100"
          type="number"
          min="0.01"
          max="10000000"
          step="0.01"
          required
          value={price}
          onChange={(event) => setPrice(event.target.value)}
          placeholder="0.00"
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-slate-700" htmlFor="listing-images">
        Product photos
        <input
          ref={imageInputRef}
          id="listing-images"
          className="block w-full cursor-pointer rounded-xl border border-slate-300 bg-slate-50 text-sm file:mr-4 file:min-h-12 file:border-0 file:bg-indigo-50 file:px-4 file:font-semibold file:text-indigo-800 hover:file:bg-indigo-100"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) => {
            addImages(event.target.files);
            event.target.value = '';
          }}
        />
        <span className="font-normal text-slate-500">
          Choose up to {MAX_IMAGES} JPEG, PNG, or WebP photos; each up to 5 MB (15 MB total). The
          first photo is the cover.
        </span>
      </label>

      {images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label="Selected product photos">
          {images.map((image, index) => (
            <li key={`${image.name}-${image.lastModified}-${index}`} className="relative">
              <img
                className="aspect-square w-full rounded-xl border border-slate-200 bg-slate-50 object-contain p-2"
                src={previews[index]}
                alt={`Photo ${index + 1}: ${image.name}`}
              />
              <button
                type="button"
                className="absolute right-2 top-2 rounded-lg bg-white/95 px-2 py-1 text-xs font-semibold text-red-700 shadow"
                aria-label={`Remove photo ${index + 1}`}
                onClick={() => {
                  setImages((current) => current.filter((_, imageIndex) => imageIndex !== index));
                  setError(null);
                }}
              >
                Remove
              </button>
              {index === 0 && (
                <span className="absolute bottom-2 left-2 rounded bg-white/95 px-2 py-1 text-xs font-semibold text-slate-700">
                  Cover
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-800">
          {success}
        </p>
      )}

      <button
        className="min-h-12 rounded-xl bg-indigo-700 px-5 font-semibold text-white transition hover:bg-indigo-800 focus-visible:outline focus-visible:outline-4 focus-visible:outline-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={busy}
      >
        {busy ? 'Uploading and publishing…' : 'Publish item'}
      </button>
    </form>
  );
}
