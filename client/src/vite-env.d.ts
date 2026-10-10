/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
  readonly VITE_GOOGLE_MAPS_API_KEY: string;
  readonly VITE_CLOUDINARY_CLOUD_NAME: string;
  readonly VITE_RAZORPAY_KEY_ID: string;
  readonly VITE_ALLOWED_EMAIL_DOMAINS: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
