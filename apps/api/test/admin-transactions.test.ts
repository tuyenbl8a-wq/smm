import assert from "node:assert/strict";
import test from "node:test";
import { AdminOperationsService } from "../src/admin/operations.js";

const SITE_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const SITE_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

const fixture = () => {
  const users = [
    {
      id: "a-alice",
      siteId: SITE_A,
      userNumber: 100001n,
      username: "alice",
      email: "alice@example.com",
    },
    {
      id: "a-bob",
      siteId: SITE_A,
      userNumber: 100002n,
      username: "bob",
      email: "bob@example.com",
    },
    {
      id: "b-alice",
      siteId: SITE_B,
      userNumber: 200001n,
      username: "alice",
      email: "alice@other.example",
    },
  ];
  const rows = [
    {
      id: "a-3",
      siteId: SITE_A,
      userId: "a-alice",
      type: "ORDER",
      amount: "-3",
      createdAt: new Date("2026-01-03"),
      referenceId: "order-3",
    },
    {
      id: "b-1",
      siteId: SITE_B,
      userId: "b-alice",
      type: "ORDER",
      amount: "-9",
      createdAt: new Date("2026-01-02T12:00:00Z"),
      referenceId: "other-order",
    },
    {
      id: "a-2",
      siteId: SITE_A,
      userId: "a-bob",
      type: "DEPOSIT",
      amount: "2",
      createdAt: new Date("2026-01-02"),
      referenceId: "deposit-2",
    },
    {
      id: "a-1",
      siteId: SITE_A,
      userId: "a-alice",
      type: "DEPOSIT",
      amount: "1",
      createdAt: new Date("2026-01-01"),
      referenceId: "deposit-1",
    },
  ];
  const calls: any = { users: [], transactions: [], counts: [] };
  const matchingRows = (where: any) =>
    rows.filter(
      (row) =>
        row.siteId === where.siteId &&
        (!where.userId || where.userId.in.includes(row.userId)) &&
        (!where.type || row.type === where.type),
    );
  const db: any = {
    user: {
      findMany: async (query: any) => {
        calls.users.push(query);
        assert.equal(
          query.where.siteId === SITE_A || query.where.siteId === SITE_B,
          true,
        );
        const matches = users
          .filter((user) => user.siteId === query.where.siteId)
          .filter((user) =>
            query.where.id
              ? query.where.id.in.includes(user.id)
              : query.where.OR.some((part: any) => {
                  const field = part.username ? "username" : "email";
                  return user[field]
                    .toLowerCase()
                    .includes(part[field].contains.toLowerCase());
                }),
          );
        return matches.map((user) =>
          Object.fromEntries(
            Object.keys(query.select)
              .filter((key) => query.select[key])
              .map((key) => [key, user[key as keyof typeof user]]),
          ),
        );
      },
    },
    walletTransaction: {
      findMany: async (query: any) => {
        calls.transactions.push(query);
        assert.equal(query.where.wallet, undefined);
        assert.equal(query.select.wallet, undefined);
        assert.equal(query.select.userId, true);
        return matchingRows(query.where)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(query.skip, query.skip + query.take)
          .map((row) =>
            Object.fromEntries(
              Object.keys(query.select)
                .filter((key) => query.select[key])
                .map((key) => [key, row[key as keyof typeof row]]),
            ),
          );
      },
      count: async ({ where }: any) => {
        calls.counts.push(where);
        assert.equal(where.wallet, undefined);
        return matchingRows(where).length;
      },
    },
  };
  return { service: new AdminOperationsService(db), calls };
};

test("admin transactions list uses scalar userId, tenant scope and stable pagination", async () => {
  const { service, calls } = fixture();
  const first = await service.transactions({ page: 1, limit: 2 }, SITE_A);
  assert.deepEqual(
    first.items.map((item: any) => item.id),
    ["a-3", "a-2"],
  );
  assert.deepEqual(
    {
      page: first.page,
      limit: first.limit,
      total: first.total,
      pages: first.pages,
    },
    { page: 1, limit: 2, total: 3, pages: 2 },
  );
  assert.deepEqual(first.items[0].wallet.user, {
    userNumber: "100001",
    username: "alice",
  });
  assert.deepEqual(first.items[1].wallet.user, {
    userNumber: "100002",
    username: "bob",
  });
  assert.equal(calls.transactions[0].skip, 0);
  assert.equal(calls.transactions[0].take, 2);
  assert.deepEqual(calls.users[0].where, {
    siteId: SITE_A,
    id: { in: ["a-alice", "a-bob"] },
  });
  const second = await service.transactions({ page: 2, limit: 2 }, SITE_A);
  assert.deepEqual(
    second.items.map((item: any) => item.id),
    ["a-1"],
  );
  assert.equal(calls.transactions[1].skip, 2);
  assert.equal(
    calls.counts.every((where: any) => where.siteId === SITE_A),
    true,
  );
});

test("admin transactions username filter resolves only current-tenant user IDs", async () => {
  const { service, calls } = fixture();
  const result = await service.transactions({ customer: "ALI" }, SITE_A);
  assert.deepEqual(
    result.items.map((item: any) => item.id),
    ["a-3", "a-1"],
  );
  assert.deepEqual(calls.users[0].where, {
    siteId: SITE_A,
    OR: [
      { username: { contains: "ALI", mode: "insensitive" } },
      { email: { contains: "ALI", mode: "insensitive" } },
    ],
  });
  assert.deepEqual(calls.transactions[0].where.userId, { in: ["a-alice"] });
  assert.equal(result.total, 2);
});

test("admin transactions email filter and unmatched user keep tenant-scoped counts", async () => {
  const { service, calls } = fixture();
  const matched = await service.transactions(
    { user: "BOB@EXAMPLE.COM" },
    SITE_A,
  );
  assert.deepEqual(
    matched.items.map((item: any) => item.id),
    ["a-2"],
  );
  assert.equal(matched.items[0].wallet.user.username, "bob");
  const missing = await service.transactions(
    { user: "nobody@example.com" },
    SITE_A,
  );
  assert.deepEqual(missing.items, []);
  assert.equal(missing.total, 0);
  assert.deepEqual(calls.transactions[1].where.userId, { in: [] });
});

test("admin transactions never resolve tenant A customers for tenant B rows", async () => {
  const { service, calls } = fixture();
  const result = await service.transactions({}, SITE_B);
  assert.deepEqual(
    result.items.map((item: any) => item.id),
    ["b-1"],
  );
  assert.deepEqual(result.items[0].wallet.user, {
    userNumber: "200001",
    username: "alice",
  });
  assert.equal(calls.transactions[0].where.siteId, SITE_B);
  assert.deepEqual(calls.users[0].where, {
    siteId: SITE_B,
    id: { in: ["b-alice"] },
  });
});
