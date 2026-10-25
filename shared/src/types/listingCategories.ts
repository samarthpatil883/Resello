import { ListingCategory } from './enums';

export const LISTING_CATEGORIES = [
  { value: ListingCategory.BOOKS, label: 'Books & study materials' },
  { value: ListingCategory.CALCULATORS, label: 'Calculators' },
  { value: ListingCategory.ELECTRONICS, label: 'Electronics & accessories' },
  { value: ListingCategory.LAB_EQUIPMENT, label: 'Lab equipment' },
  { value: ListingCategory.LAB_DRAFTING, label: 'Lab & drafting supplies' },
  { value: ListingCategory.ENGINEERING_TOOLS, label: 'Engineering tools & kits' },
  { value: ListingCategory.STATIONERY, label: 'Stationery' },
  { value: ListingCategory.BAGS_BACKPACKS, label: 'Bags & backpacks' },
  { value: ListingCategory.HOSTEL_ESSENTIALS, label: 'Hostel essentials' },
  { value: ListingCategory.FURNITURE, label: 'Furniture' },
  { value: ListingCategory.SPORTS_FITNESS, label: 'Sports & fitness' },
  { value: ListingCategory.CYCLES_TRANSPORT, label: 'Cycles & transport' },
  { value: ListingCategory.CLOTHING_ACCESSORIES, label: 'Clothing & accessories' },
  { value: ListingCategory.ART_HOBBY, label: 'Art & hobby supplies' },
  { value: ListingCategory.OTHER_FINDS, label: 'Other finds' },
] as const;
