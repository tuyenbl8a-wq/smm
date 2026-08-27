const SCALE = 100_000_000n;
const PERCENT_SCALE = 100_000_000n;
export function moneyUnits(value: unknown, allowZero = true): bigint {
  const raw = String(value ?? "").trim();
  const match = /^(\d{1,12})(?:\.(\d{1,8}))?$/.exec(raw);
  if (!match) throw new Error("INVALID_DECIMAL");
  const result =
    BigInt(match[1]!) * SCALE + BigInt((match[2] ?? "").padEnd(8, "0"));
  if (!allowZero && result === 0n) throw new Error("INVALID_DECIMAL");
  return result;
}
export function moneyText(value: bigint): string {
  const sign = value < 0n ? "-" : "",
    absolute = value < 0n ? -value : value;
  return `${sign}${absolute / SCALE}.${String(absolute % SCALE).padStart(8, "0")}`;
}
export function decimalInput(value: unknown, allowZero = false): string {
  return moneyText(moneyUnits(value, allowZero));
}
export type PricingPolicy = {
  mode?:
    | "FIXED"
    | "COST_PLUS_PERCENT"
    | "COST_PLUS_FIXED"
    | "COST_PLUS_PERCENT_AND_FIXED";
  fixedRate?: unknown;
  markupPercent?: unknown;
  fixedProfit?: unknown;
  minProfit?: unknown;
};
export function calculateSaleRate(
  input: { baseRate: unknown; providerCost: unknown } & PricingPolicy,
): string {
  const cost = moneyUnits(input.providerCost);
  const mode =
    input.mode ??
    (input.fixedRate != null ? "FIXED" : "COST_PLUS_PERCENT_AND_FIXED");
  let rate: bigint;
  if (mode === "FIXED")
    rate = moneyUnits(input.fixedRate ?? input.baseRate, false);
  else {
    rate = cost;
    if (mode === "COST_PLUS_PERCENT" || mode === "COST_PLUS_PERCENT_AND_FIXED")
      rate +=
        (cost * moneyUnits(input.markupPercent ?? "0")) / PERCENT_SCALE / 100n;
    if (mode === "COST_PLUS_FIXED" || mode === "COST_PLUS_PERCENT_AND_FIXED")
      rate += moneyUnits(input.fixedProfit ?? "0");
  }
  const floor = cost + moneyUnits(input.minProfit ?? "0");
  return moneyText(rate < floor ? floor : rate);
}
export function priceChangePercent(
  oldValue: unknown,
  newValue: unknown,
): string {
  const oldUnits = moneyUnits(oldValue, false),
    delta = moneyUnits(newValue) - oldUnits;
  return moneyText((delta * 100n * SCALE) / oldUnits);
}
export function choosePolicy(
  service: any,
  group: any,
  override?: any,
): PricingPolicy {
  if (override?.fixedRate != null)
    return {
      mode: "FIXED",
      fixedRate: override.fixedRate,
      minProfit:
        override.minProfit ??
        group?.defaultMinProfit ??
        service.defaultMinProfit,
    };
  if (override)
    return {
      mode: service.pricingMode,
      markupPercent:
        override.markupPercent ??
        group?.defaultMarkupPercent ??
        service.defaultMarkupPercent,
      fixedProfit:
        override.fixedProfit ??
        group?.defaultFixedProfit ??
        service.defaultFixedProfit,
      minProfit:
        override.minProfit ??
        group?.defaultMinProfit ??
        service.defaultMinProfit,
    };
  return {
    mode: service.pricingMode,
    fixedRate: service.pricingMode === "FIXED" ? service.rate : undefined,
    markupPercent: group?.defaultMarkupPercent ?? service.defaultMarkupPercent,
    fixedProfit: group?.defaultFixedProfit ?? service.defaultFixedProfit,
    minProfit: group?.defaultMinProfit ?? service.defaultMinProfit,
  };
}
export function resolveCustomerRate(input: {
  service: any;
  group?: any;
  override?: any;
  providerCost: unknown;
}): string {
  return calculateSaleRate({
    baseRate: input.service.rate,
    providerCost: input.providerCost,
    ...choosePolicy(input.service, input.group, input.override),
  });
}
