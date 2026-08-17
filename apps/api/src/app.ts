import cors from "cors";
import express from "express";
import helmet from "helmet";
import { serviceName } from "@smm/shared";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_request, response) => {
    response.json({ status: "ok", service: serviceName, phase: 1 });
  });

  app.get("/api/v1/status", (_request, response) => {
    response.json({
      data: {
        name: serviceName,
        phase: "Phase 1 project skeleton",
        modules: ["api", "web", "worker", "shared"],
      },
    });
  });

  return app;
}
