import express from "express";
import path from "path";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Proxy API routes for Ozon
  app.post("/api/ozon/v3/posting/fbs/list", async (req, res) => {
    try {
      const response = await fetch("https://api-seller.ozon.ru/v3/posting/fbs/list", {
        method: "POST",
        headers: {
          "Client-Id": req.headers["client-id"] as string,
          "Api-Key": req.headers["api-key"] as string,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).send(errorText);
        return;
      }

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ozon/v2/posting/fbs/package-label", async (req, res) => {
    try {
      const response = await fetch("https://api-seller.ozon.ru/v2/posting/fbs/package-label", {
        method: "POST",
        headers: {
          "Client-Id": req.headers["client-id"] as string,
          "Api-Key": req.headers["api-key"] as string,
          "Content-Type": "application/json",
          "Accept": "application/pdf, application/json"
        },
        body: JSON.stringify(req.body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        res.status(response.status).send(errorText);
        return;
      }

      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      res.set("Content-Type", "application/pdf");
      res.send(Buffer.from(buffer));
    } catch (error: any) {
      console.error("Proxy Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    
    // SPA fallback
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
