import { spawn } from "node:child_process";
const services = [
  ["web", "apps/web/dist/main.js"],
  ["api", "apps/api/dist/main.js"],
  ["worker", "apps/worker/dist/main.js"],
];
const children = services.map(([name, entry], index) =>
  spawn(process.execPath, ["--env-file=.env", entry], {
    stdio: "inherit",
    env: { ...process.env, PORT: String([3000, 4000, 4100][index]) },
  }),
);
function shutdown() {
  for (const child of children) child.kill("SIGTERM");
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
for (const child of children)
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
      shutdown();
    }
  });
