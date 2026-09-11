/**
 * Applies a default only when the field is missing (`undefined`). An
 * explicit `null` is a real value and must be left alone, so a caller-sent
 * `null` still fails whatever type/enum check the field normally gets
 * instead of silently becoming the default.
 */
export function defaultIfUndefined<T>(value: unknown, fallback: T): unknown {
  return value === undefined ? fallback : value;
}
