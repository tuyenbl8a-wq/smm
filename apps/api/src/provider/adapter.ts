export interface ProviderServiceRecord {
  externalId: string;
  name: string;
  category: string;
  type: string;
  rate: string;
  min: number;
  max: number;
  refill: boolean;
  cancel: boolean;
  raw?: Record<string, unknown>;
}

export interface ProviderOrderInput {
  service: string;
  link: string;
  quantity: number;
  idempotencyKey: string;
}

export interface ProviderAdapter {
  getServices(): Promise<ProviderServiceRecord[]>;
  createOrder(input: ProviderOrderInput): Promise<{ providerOrderId: string }>;
  getOrderStatus(id: string): Promise<Record<string, unknown>>;
  getMultipleOrderStatus(
    ids: string[],
  ): Promise<Record<string, Record<string, unknown>>>;
  requestRefill(id: string): Promise<Record<string, unknown>>;
  getRefillStatus(id: string): Promise<Record<string, unknown>>;
  cancelOrder(id: string): Promise<Record<string, unknown>>;
  getBalance(): Promise<{ balance: string; currency: string }>;
}

export class ProviderError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly unknownOutcome = false,
  ) {
    super(message);
  }
}

export const normalizeProviderDecimal = (
  value: unknown,
  rounding: "half-up" | "ceil" = "half-up",
) => {
  if (
    value === null ||
    value === undefined ||
    (typeof value === "number" && !Number.isFinite(value))
  )
    throw new ProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Invalid provider decimal",
    );

  const input = String(value).trim();

  if (!input || input.startsWith("-"))
    throw new ProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Invalid provider decimal",
    );

  const match = /^(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(input);

  if (!match)
    throw new ProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Invalid provider decimal",
    );

  const coefficient = `${match[1]}${match[2] ?? ""}`;
  const decimalAt = match[1]!.length + Number(match[3] ?? 0);

  if (!Number.isSafeInteger(decimalAt) || Math.abs(decimalAt) > 100)
    throw new ProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Provider decimal overflow",
    );

  const expanded =
    decimalAt <= 0
      ? `0.${"0".repeat(-decimalAt)}${coefficient}`
      : decimalAt >= coefficient.length
        ? `${coefficient}${"0".repeat(decimalAt - coefficient.length)}`
        : `${coefficient.slice(0, decimalAt)}.${coefficient.slice(decimalAt)}`;

  const [wholeRaw, fractionRaw = ""] = expanded.split(".");
  let whole = (wholeRaw ?? "0").replace(/^0+(?=\d)/, "");
  let fraction = fractionRaw;

  if (whole.length > 12)
    throw new ProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Provider decimal precision exceeds limits",
    );

  if (fraction.length > 8) {
    const kept = fraction.slice(0, 8).padEnd(8, "0");
    const discarded = fraction.slice(8);

    const shouldRoundUp =
      rounding === "ceil"
        ? /[1-9]/.test(discarded)
        : (discarded[0] ?? "0") >= "5";

    let scaled =
      BigInt(whole || "0") * 100000000n + BigInt(kept || "0");

    if (shouldRoundUp) scaled += 1n;

    whole = (scaled / 100000000n).toString();
    fraction = (scaled % 100000000n).toString().padStart(8, "0");
  }

  fraction = fraction.replace(/0+$/, "");

  if (whole.length > 12)
    throw new ProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Provider decimal precision exceeds limits",
    );

  return fraction ? `${whole}.${fraction}` : whole;
};

export class StandardSmmAdapter implements ProviderAdapter {
  constructor(
    private readonly url: string,
    private readonly apiKey: string,
    private readonly timeoutMs = 15000,
  ) {}

  private async call(
    action: string,
    data: Record<string, string> = {},
    unknownOutcome = false,
  ): Promise<any> {
    const controller = new AbortController(),
      timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const body = new URLSearchParams({
        key: this.apiKey,
        action,
        ...data,
      });

      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      });

      const json = await response.json();

      if (!response.ok || json?.error)
        throw new ProviderError(
          "PROVIDER_REJECTED",
          String(json?.error ?? `HTTP ${response.status}`),
        );

      return json;
    } catch (error) {
      if (error instanceof ProviderError) throw error;

      if ((error as any)?.name === "AbortError")
        throw new ProviderError(
          "PROVIDER_TIMEOUT",
          "Provider request timed out",
          unknownOutcome,
        );

      throw new ProviderError(
        "PROVIDER_UNAVAILABLE",
        "Provider unavailable",
        unknownOutcome,
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async getServices() {
    const rows = await this.call("services");

    if (!Array.isArray(rows))
      throw new ProviderError(
        "PROVIDER_RESPONSE_INVALID",
        "Services response must be an array",
      );

    return rows.map((x: any) => {
      const externalId = String(x.service ?? "").trim(),
        name = String(x.name ?? "").trim(),
        category = String(x.category ?? "").trim(),
        min = Number(x.min),
        max = Number(x.max);

      if (
        !/^[A-Za-z0-9_.:-]{1,100}$/.test(externalId) ||
        !name ||
        name.length > 255 ||
        !category ||
        category.length > 255 ||
        !Number.isSafeInteger(min) ||
        !Number.isSafeInteger(max) ||
        min < 1 ||
        max < min
      )
        throw new ProviderError(
          "PROVIDER_RESPONSE_INVALID",
          "Provider service contract is invalid",
        );

      return {
        externalId,
        name,
        category,
        type:
          String(x.type ?? "Default")
            .trim()
            .slice(0, 80) || "Default",
        rate: normalizeProviderDecimal(x.rate, "ceil"),
        min,
        max,
        refill: x.refill === true || x.refill === 1 || x.refill === "1",
        cancel: x.cancel === true || x.cancel === 1 || x.cancel === "1",
        raw: x,
      };
    });
  }

  async createOrder(input: ProviderOrderInput) {
    const x = await this.call(
      "add",
      {
        service: input.service,
        link: input.link,
        quantity: String(input.quantity),
      },
      true,
    );

    if (!x?.order)
      throw new ProviderError(
        "PROVIDER_RESPONSE_INVALID",
        "Missing provider order id",
        true,
      );

    return {
      providerOrderId: String(x.order),
    };
  }

  getOrderStatus = (id: string) =>
    this.call("status", {
      order: id,
    });

  getMultipleOrderStatus = (ids: string[]) =>
    this.call("status", {
      orders: ids.join(","),
    });

  requestRefill = (id: string) =>
    this.call("refill", {
      order: id,
    });

  getRefillStatus = (id: string) =>
    this.call("refill_status", {
      refill: id,
    });

  cancelOrder = (id: string) =>
    this.call("cancel", {
      order: id,
    });

  async getBalance() {
    const x = await this.call("balance");

    return {
      balance: normalizeProviderDecimal(x.balance),
      currency: String(x.currency),
    };
  }
}