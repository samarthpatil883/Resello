import { ListingCategory } from './enums';

export const LISTING_CATEGORIES = [
  { value: ListingCategory.BOOKS, label: 'Books & study materials' },
  { value: ListingCategory.ELECTRONICS, label: 'Electronics & accessories' },
  { value: ListingCategory.LAB_DRAFTING, label: 'Lab & drafting supplies' },
  { value: ListingCategory.STATIONERY, label: 'Stationery' },
  { value: ListingCategory.FURNITURE, label: 'Furniture' },
  { value: ListingCategory.ART_HOBBY, label: 'Art & hobby supplies' },
  { value: ListingCategory.OTHER_FINDS, label: 'Other finds' },
] as const;
