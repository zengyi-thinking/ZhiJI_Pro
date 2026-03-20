import type { Express } from "express";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

type StartServerOptions = {
  app: Express;
  port: number;
  maxPortAttempts?: number;
};

export async function startServer({
  app,
  port,
  maxPortAttempts = 10
}: StartServerOptions): Promise<Server> {
  return listenWithRetry(app, port, maxPortAttempts);
}

function listenWithRetry(app: Express, port: number, remainingAttempts: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port);

    server.once("listening", () => {
      const address = server.address() as AddressInfo | null;
      const actualPort = address?.port ?? port;
      console.log(`Zhiji backend listening on port ${actualPort}`);
      resolve(server);
    });

    server.once("error", (error: NodeJS.ErrnoException) => {
      if (error.code === "EADDRINUSE" && shouldRetryPort(remainingAttempts)) {
        console.warn(`Port ${port} is already in use, retrying on ${port + 1}...`);
        server.close(() => {
          void listenWithRetry(app, port + 1, remainingAttempts - 1).then(resolve).catch(reject);
        });
        return;
      }

      const message =
        error.code === "EADDRINUSE"
          ? `Port ${port} is already in use. Set PORT in .env or stop the process using that port.`
          : error.message;
      reject(new Error(message));
    });
  });
}

function shouldRetryPort(remainingAttempts: number) {
  const isProduction = process.env.NODE_ENV === "production";
  return !isProduction && remainingAttempts > 1;
}
