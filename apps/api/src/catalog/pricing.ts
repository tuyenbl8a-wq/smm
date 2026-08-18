const SCALE = 100_000_000n;
const PERCENT = 100_000_000n;
function units(value: unknown, allowZero = true): bigint {
  const raw = String(value ?? "").trim();
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(raw);
  if (!match) throw new Error("INVALID_DECIMAL");
  const result =
    BigInt(match[1]!) * SCALE + BigInt((match[2] ?? "").padEnd(8, "0"));
  if (!allowZero && result === 0n) throw new Error("INVALID_DECIMAL");
  return result;
}
function text(value: bigint): string {
  return `${value / SCALE}.${String(value % SCALE).padStart(8, "0")}`;
}
export function decimalInput(value: unknown, allowZero = false): string {
  return text(units(value, allowZero));
}
export function calculateSaleRate(input: {
  baseRate: unknown;
  providerCost: unknown;
  fixedRate?: unknown;
  markupPercent?: unknown;
  fixedProfit?: unknown;
  minProfit?: unknown;
}): string {
  const cost = units(input.providerCost);
  let rate =
    input.fixedRate !== undefined && input.fixedRate !== null
      ? units(input.fixedRate, false)
      : units(input.baseRate, false);
  if (input.fixedRate === undefined || input.fixedRate === null) {
    if (input.markupPercent !== undefined && input.markupPercent !== null)
      rate += (rate * units(input.markupPercent)) / PERCENT / 100n;
    if (input.fixedProfit !== undefined && input.fixedProfit !== null)
      rate += units(input.fixedProfit);
  }
  const minimum = cost + units(input.minProfit ?? "0");
  if (rate < minimum) rate = minimum;
  return text(rate);
}
