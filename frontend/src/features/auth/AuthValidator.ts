import { Credentials, MIN_PASSWORD_LENGTH } from '../../domain/Credentials';

export type Field = 'email' | 'password' | 'terms' | 'code';

/** Field name to i18n key of its error. Empty means valid. */
export type FieldErrors = Partial<Record<Field, string>>;

export class AuthValidator {
  static email(email: string): FieldErrors {
    return Credentials.isEmail(email) ? {} : { email: 'auth.errors.email' };
  }

  static signIn(email: string, password: string): FieldErrors {
    return { ...AuthValidator.email(email), ...(password ? {} : { password: 'auth.errors.passwordMissing' }) };
  }

  static signUp(email: string, password: string, terms: boolean): FieldErrors {
    return {
      ...AuthValidator.email(email),
      ...AuthValidator.#newPassword(password),
      ...(terms ? {} : { terms: 'auth.errors.terms' }),
    };
  }

  static code(code: string): FieldErrors {
    return Credentials.isCode(code) ? {} : { code: 'auth.errors.code' };
  }

  static reset(code: string, password: string): FieldErrors {
    return { ...AuthValidator.code(code), ...AuthValidator.#newPassword(password) };
  }

  static isValid(errors: FieldErrors): boolean {
    return Object.keys(errors).length === 0;
  }

  static #newPassword(password: string): FieldErrors {
    return password.length >= MIN_PASSWORD_LENGTH ? {} : { password: 'auth.errors.passwordShort' };
  }
}
