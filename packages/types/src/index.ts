export interface HealthCheck {
  readonly status: "ok" | "error";
  readonly service: string;
  readonly timestamp: string;
  readonly checks?: Readonly<Record<string, "up" | "down">>;
}
