/** Exact database decimal transported across process boundaries without precision loss. */
export type DecimalString = string & {
  readonly __decimalString: unique symbol;
};
export type EntityId = string & { readonly __entityId: unique symbol };
export const DATABASE_MONEY_PRECISION = 20;
export const DATABASE_MONEY_SCALE = 8;
export function asDecimalString(value: string): DecimalString {
  if (!/^-?\d+(?:\.\d{1,8})?$/.test(value))
    throw new Error("Invalid decimal string");
  return value as DecimalString;
}
