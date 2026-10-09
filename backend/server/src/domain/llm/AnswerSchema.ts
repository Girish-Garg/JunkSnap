// The slice of a zod schema the router needs, so services validate answers without importing zod.
export interface AnswerSchema<T> {
  safeParse(data: unknown): { readonly success: true; readonly data: T } | { readonly success: false };
}
