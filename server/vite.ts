import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    configFile: path.resolve(import.meta.dirname, "..", "vite.config.ts"),
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  // CRITICAL: Only use Vite middleware for non-API routes
  // We MUST check the path BEFORE applying Vite middleware
  // This middleware wrapper ensures /api/* routes are NEVER touched by Vite
  app.use((req, res, next) => {
    // CRITICAL CHECK: Skip Vite middleware completely for ALL API routes
    // Check both the path and the isApiRoute flag
    if (req.path.startsWith("/api") || (req as any).isApiRoute) {
      console.log(`[Vite] Skipping Vite middleware for API route: ${req.path}`);
      return next(); // Let Express handle it - DO NOT call vite.middlewares
    }
    // Only use Vite middleware for non-API routes
    console.log(`[Vite] Using Vite middleware for: ${req.path}`);
    vite.middlewares(req, res, next);
  });

  // Catch-all route for non-API routes ONLY (SPA fallback)
  // This should NEVER match /api/* routes
  app.get("*", async (req, res, next) => {
    // CRITICAL: Double check - skip if this is an API route
    if (req.path.startsWith("/api")) {
      console.error(`[Vite] ERROR: API route ${req.path} reached Vite catch-all! This should NEVER happen!`);
      return next(); // This should never happen, but safety check
    }

    console.log(`[Vite] Serving SPA for: ${req.path}`);
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist (skip API routes)
  app.use("*", (req, res) => {
    // Skip API routes - they should be handled by Express routes
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ message: "API route not found" });
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
