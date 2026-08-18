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
const decimal = (value: unknown) => {
  const text = String(value);
  if (!/^\d{1,12}(?:\.\d{1,8})?$/.test(text))
    throw new ProviderError(
      "PROVIDER_RESPONSE_INVALID",
      "Invalid provider decimal",
    );
  return text;
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
      const body = new URLSearchParams({ key: this.apiKey, action, ...data });
      const response = await fetch(this.url, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
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
    return rows.map((x: any) => ({
      externalId: String(x.service),
      name: String(x.name),
      category: String(x.category),
      type: String(x.type ?? "Default"),
      rate: decimal(x.rate),
      min: Number(x.min),
      max: Number(x.max),
      refill: Boolean(x.refill),
      cancel: Boolean(x.cancel),
      raw: x,
    }));
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
    return { providerOrderId: String(x.order) };
  }
  getOrderStatus = (id: string) => this.call("status", { order: id });
  getMultipleOrderStatus = (ids: string[]) =>
    this.call("status", { orders: ids.join(",") });
  requestRefill = (id: string) => this.call("refill", { order: id });
  getRefillStatus = (id: string) => this.call("refill_status", { refill: id });
  cancelOrder = (id: string) => this.call("cancel", { order: id });
  async getBalance() {
    const x = await this.call("balance");
    return { balance: decimal(x.balance), currency: String(x.currency) };
  }
}
