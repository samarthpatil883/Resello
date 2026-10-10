export type CollegeEmailErrorCode =
  'EMAIL_INVALID' | 'EMAIL_DOMAIN_NOT_ALLOWED' | 'EMAIL_ALIAS_NOT_ALLOWED';

export class CollegeEmailError extends Error {
  constructor(
    public readonly code: CollegeEmailErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'CollegeEmailError';
  }
}

export function normalizeCollegeEmail(email: string, allowedDomains: string): string {
  const normalized = email.trim().toLowerCase();
  const separator = normalized.lastIndexOf('@');

  if (
    separator <= 0 ||
    separator === normalized.length - 1 ||
    normalized.indexOf('@') !== separator ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new CollegeEmailError('EMAIL_INVALID', 'Enter a valid email address.');
  }

  const localPart = normalized.slice(0, separator);
  const domain = normalized.slice(separator + 1);
  const allowed = allowedDomains
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  if (localPart.includes('+')) {
    throw new CollegeEmailError(
      'EMAIL_ALIAS_NOT_ALLOWED',
      'Please use your plain college address without a + tag.',
    );
  }

  if (!allowed.includes(domain)) {
    throw new CollegeEmailError(
      'EMAIL_DOMAIN_NOT_ALLOWED',
      'Only college emails work here. Use yourname@pccoepune.org.',
    );
  }

  return normalized;
}
