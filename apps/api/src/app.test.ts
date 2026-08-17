import assert from "node:assert/strict";
import test from "node:test";
import request from "supertest";
import { createApp } from "./app.js";

test("GET /health returns service health", async () => {
  const response = await request(createApp()).get("/health").expect(200);

  assert.equal(response.body.status, "ok");
  assert.equal(response.body.phase, 1);
});
