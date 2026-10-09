export type PasswordStrength = 'weak' | 'fair' | 'strong';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
const CODE = /^\d{6}$/;

/** Client-side checks only; the auth provider has the final say. */
export class Credentials {
  static isEmail(value: string): boolean {
    return EMAIL.test(value.trim());
  }

  static isCode(value: string): boolean {
    return CODE.test(value);
  }

  static strength(password: string): PasswordStrength {
    if (password.length < MIN_PASSWORD_LENGTH) return 'weak';
    const kinds = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length;
    return kinds >= 3 ? 'strong' : 'fair';
  }
}
