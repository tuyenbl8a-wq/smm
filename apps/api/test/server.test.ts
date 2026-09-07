import assert from "node:assert/strict";
import test from "node:test";
import { createApiServer } from "../src/server.js";
import type { AppConfig } from "@smm/config";
const config = {
  environment: "test",
  host: "127.0.0.1",
  port: 4000,
  appUrl: new URL("http://localhost:3000"),
  apiUrl: new URL("http://localhost:4000"),
  databaseUrl: new URL("postgresql://127.0.0.1:1/smm"),
  redisUrl: new URL("redis://127.0.0.1:1"),
  sessionSecret: "x",
  jwtSecret: "x",
  encryptionKey: "x",
  healthTimeoutMs: 100,
} satisfies AppConfig;
test("constructs an API server without opening a listener", () => {
  const server = createApiServer(config);
  assert.equal(typeof server.listen, "function");
  server.close();
});
test("HTTP runtime passes one resolved tenant context and rejects unknown hosts", async () => {
  const sites:any={"panel.test":{id:"site-a",siteNumber:100001n,parentSiteId:null,status:"ACTIVE",depth:1}};
  const resolver:any={resolve:async(req:any)=>{const site=sites[String(req.headers["x-tenant-test"])];if(!site)throw new Error("unknown");return site}};
  let received:any;
  const auth:any={handle:async(_req:any,res:any,_path:string,tenant:any)=>{received=tenant;res.statusCode=200;res.end("ok");return true}};
  const server=createApiServer(config,auth,undefined,undefined,undefined,undefined,undefined,undefined,resolver);
  await new Promise<void>(resolve=>server.listen(0,"127.0.0.1",resolve));
  const address=(server as any).address();
  try {
    const good=await fetch(`http://127.0.0.1:${address.port}/api/v1/me?siteId=evil`,{headers:{"x-tenant-test":"panel.test"}});assert.equal(good.status,200);assert.equal(received.id,"site-a");
    const bad=await fetch(`http://127.0.0.1:${address.port}/api/v1/me`,{headers:{"x-tenant-test":"unknown.test"}});assert.equal(bad.status,421);assert.equal((await bad.json()).error.code,"TENANT_NOT_FOUND");
  } finally {await new Promise<void>(resolve=>server.close(()=>resolve()))}
});
