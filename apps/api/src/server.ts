import { createApp } from "./app.js";
import { appConfig } from "./config.js";

const app = createApp();

app.listen(appConfig.API_PORT, () => {
  console.log(`SMM API listening on http://localhost:${appConfig.API_PORT}`);
});
