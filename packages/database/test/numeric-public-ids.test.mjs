import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
const schema = await readFile(
  new URL("../prisma/schema.prisma", import.meta.url),
  "utf8",
);
const migration = await readFile(
  new URL(
    "../prisma/migrations/20260906130000_numeric_public_ids/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
test("public numeric IDs are unique sequence-backed fields while UUIDs remain primary", () => {
  assert.match(
    schema,
    /model User \{\s+id String @id[^\n]+@db\.Uuid\s+userNumber BigInt @unique @default\(autoincrement\(\)\)/,
  );
  assert.match(
    schema,
    /model Service \{\s+id String @id[^\n]+@db\.Uuid\s+serviceNumber BigInt @unique @default\(autoincrement\(\)\)/,
  );
  assert.match(schema, /userId String @map\("user_id"\) @db\.Uuid/);
  assert.match(schema, /serviceId String @map\("service_id"\) @db\.Uuid/);
});
test("numeric ID migration safely backfills and advances both sequences", () => {
  for (const token of [
    "START WITH 100001",
    "START WITH 1001",
    "ROW_NUMBER() OVER",
    'WHERE "user_number" IS NULL',
    'WHERE "service_number" IS NULL',
    "SELECT setval",
    "SET NOT NULL",
    "CREATE UNIQUE INDEX IF NOT EXISTS",
  ])
    assert.match(migration, new RegExp(token.replace(/[()]/g, "\\$&")));
  assert.doesNotMatch(migration, /TRUNCATE|DROP TABLE|DELETE FROM/i);
});
