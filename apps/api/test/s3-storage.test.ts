import assert from "node:assert/strict";
import test from "node:test";
import { S3Storage } from "../src/storage/s3.js";

const config = {
  endpoint: "https://objects.example.com",
  region: "ap-southeast-1",
  bucket: "smm-attachments",
  accessKeyId: "access",
  secretAccessKey: "secret",
};

test("S3 storage fails closed on incomplete or insecure production configuration", () => {
  assert.throws(
    () => new S3Storage({ ...config, bucket: "" }),
    /S3_CONFIGURATION_INCOMPLETE/,
  );
  assert.throws(
    () => new S3Storage({ ...config, endpoint: "http://objects.example.com" }),
    /S3_ENDPOINT_INSECURE/,
  );
});

test("S3 storage signs private PUT and GET requests without exposing credentials", async () => {
  const calls: Array<{ url: string; init: any }> = [];
  const storage = new S3Storage(config, async (url, init) => {
    calls.push({ url, init });
    return {
      ok: true,
      status: 200,
      headers: { get: () => "4" },
      arrayBuffer: async () => new Uint8Array([1, 2, 3, 4]).buffer,
    };
  });
  const uploaded = await storage.put(
    "proof.pdf",
    "application/pdf",
    Buffer.from("%PDF-1"),
  );
  assert.match(uploaded.key, /^[a-f0-9]{48}$/);
  assert.equal((await storage.read(uploaded.key)).length, 4);
  assert.equal(calls.length, 2);
  assert.match(calls[0]!.url, /\/smm-attachments\/[a-f0-9]{48}$/);
  assert.match(
    calls[0]!.init.headers.authorization,
    /^AWS4-HMAC-SHA256 Credential=access\//,
  );
  assert.doesNotMatch(JSON.stringify(calls), /secret/);
});

test("S3 storage rejects invalid keys before making a request", async () => {
  const storage = new S3Storage(config, async () => {
    throw new Error("request must not execute");
  });
  await assert.rejects(() => storage.read("../secret"), /STORAGE_KEY_INVALID/);
});
