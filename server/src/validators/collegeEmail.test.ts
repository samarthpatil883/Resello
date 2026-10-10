import { CollegeEmailError, normalizeCollegeEmail } from './collegeEmail';

describe('normalizeCollegeEmail', () => {
  it.each([
    ['samarth.patil24@pccoepune.org', 'samarth.patil24@pccoepune.org'],
    ['SAMARTH.Patil24@PCCOEPUNE.ORG', 'samarth.patil24@pccoepune.org'],
  ])('accepts and normalizes %s', (input, expected) => {
    expect(normalizeCollegeEmail(input, 'pccoepune.org')).toBe(expected);
  });

  it.each([
    ['samarth.patil24@gmail.com', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    ['samarth.patil24@mail.pccoepune.org', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    ['samarth.patil24@pccoepune.org.evil.com', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    ['samarth.patil24@evilpccoepune.org', 'EMAIL_DOMAIN_NOT_ALLOWED'],
    ['samarth.patil24+shop@pccoepune.org', 'EMAIL_ALIAS_NOT_ALLOWED'],
    ['not-an-email', 'EMAIL_INVALID'],
  ])('rejects %s with %s', (input, code) => {
    try {
      normalizeCollegeEmail(input, 'pccoepune.org');
      throw new Error('Expected email to be rejected');
    } catch (error) {
      expect(error).toBeInstanceOf(CollegeEmailError);
      expect((error as CollegeEmailError).code).toBe(code);
    }
  });
});
