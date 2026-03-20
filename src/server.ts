import { createApp } from "./app.js";
import { config } from "./config.js";
import { startServer } from "./startServer.js";

const app = createApp();

void startServer({
  app,
  port: config.PORT
}).catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
