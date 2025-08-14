import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { DrizzleStorage, type IStorage } from "./storage";
import type { Server } from "http";

let server: Server | null = null;
let storage: IStorage | null = null;

export async function startServer(dbName?: string): Promise<{ app: Express.Application; server: Server; port: number, storage: IStorage }> {
  storage = new DrizzleStorage(dbName);
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;

        if (req.body && Object.keys(req.body).length > 0) {
          logLine += `\n  body: ${JSON.stringify(req.body)}`;
        }

        if (capturedJsonResponse) {
          logLine += `\n  response: ${JSON.stringify(capturedJsonResponse)}`;
        }

        log(logLine);
      }
    });

    next();
  });

  const httpServer = await registerRoutes(app, storage);
  server = httpServer;

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || '5000', 10);

  return new Promise((resolve) => {
    server!.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
      resolve({ app, server: server!, port, storage: storage! });
    });
  });
}

export async function stopServer(): Promise<void> {
  if (storage) {
    await storage.close();
  }
  return new Promise((resolve, reject) => {
      if (server) {
          server.close((err) => {
              if (err) {
                  return reject(err);
              }
              log('Server stopped');
              resolve();
          });
      } else {
          resolve();
      }
  });
}

// If running this file directly (e.g. `npm run dev:server`), start the server
if (import.meta.url.startsWith('file://') && process.argv[1] === new URL(import.meta.url).pathname) {
  startServer();
}
