/** Express 5 types params as string | string[]. This extracts a single string. */
export function param(value: string | string[] | undefined): string {
  if (Array.isArray(value)) return value[0];
  return value ?? '';
}
