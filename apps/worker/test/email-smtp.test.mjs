import assert from "node:assert/strict";
import test from "node:test";
import { smtpConfig } from "../dist/smtp.js";
import { EmailWorker } from "../dist/email.js";

test("SMTP is safely disabled or rejects incomplete credentials", () => {
  assert.equal(smtpConfig({}), null);
  assert.throws(
    () => smtpConfig({ SMTP_HOST: "smtp.example.com" }),
    /SMTP_CONFIGURATION_INCOMPLETE/,
  );
});

test("email worker retries without marking a failed delivery complete", async () => {
  const updates = [];
  const db = {
    $transaction: async (run) =>
      run({
        $queryRawUnsafe: async () => [
          {
            id: "n1",
            user_id: "u1",
            email: "u@example.com",
            title: "Thông báo",
            body: "Nội dung",
            delivery_attempts: 1,
          },
        ],
        notification: { update: async (input) => updates.push(input) },
      }),
    notification: { update: async (input) => updates.push(input) },
  };
  const worker = new EmailWorker(db, async () => {
    throw new Error("private credential must not be included");
  });
  assert.equal(await worker.once(), 1);
  assert.equal(updates.at(-1).data.deliveredAt, undefined);
  assert.equal(updates.at(-1).data.deliveryError, "SMTP_DELIVERY_FAILED");
});
