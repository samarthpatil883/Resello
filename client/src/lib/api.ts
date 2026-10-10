import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export function getApiErrorMessage(error: unknown) {
  if (axios.isAxiosError<{ error?: { message?: string } }>(error)) {
    return (
      error.response?.data.error?.message ??
      'Resello could not be reached. Check your connection and try again.'
    );
  }
  return 'Something went wrong. Please try again.';
}

export function getApiErrorCode(error: unknown) {
  if (axios.isAxiosError<{ error?: { code?: string } }>(error))
    return error.response?.data.error?.code;
  return undefined;
}
