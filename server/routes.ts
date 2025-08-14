import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertMediaItemSchema, insertTagSchema, type MediaSearchParams, type InsertMediaItem } from "@shared/schema";
import { z } from "zod";

// MultiScraper integration
import fetch from "node-fetch";

const API_PROXIES = [
  { name: "iteraplay", url: "http://localhost:3000/iteraplay-proxy", method: "POST", type: "json", field: "link" },
  { name: "raspywave", url: "http://localhost:3000/raspywave-proxy", method: "POST", type: "json", field: "link" },
  { name: "rapidapi", url: "http://localhost:3000/rapidapi", method: "POST", type: "json", field: "link" },
  { name: "tera-cc", url: "http://localhost:3000/tera-downloader-cc", method: "POST", type: "json", field: "url" },
  { name: "ronnie-client", url: "http://localhost:3000/ronnieverse-client", method: "GET", type: "query", field: "url" }
];

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Media Items Routes
  app.get("/api/media", async (req, res) => {
    try {
      const { search, tags, type, sizeRange, page = "1", limit = "20" } = req.query;
      
      const params: MediaSearchParams = {
        search: search as string,
        tags: tags ? (Array.isArray(tags) ? tags as string[] : [tags as string]) : undefined,
        type: type as "video" | "folder",
        sizeRange: sizeRange as "small" | "medium" | "large",
        page: parseInt(page as string),
        limit: parseInt(limit as string),
      };

      const result = await storage.getMediaItems(params);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch media items" });
    }
  });

  app.get("/api/media/:id", async (req, res) => {
    try {
      const mediaItem = await storage.getMediaItem(req.params.id);
      if (!mediaItem) {
        return res.status(404).json({ error: "Media item not found" });
      }
      res.json(mediaItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch media item" });
    }
  });

  app.post("/api/media", async (req, res) => {
    try {
      const validatedData = insertMediaItemSchema.parse(req.body);
      const mediaItem = await storage.createMediaItem(validatedData);
      res.status(201).json(mediaItem);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create media item" });
    }
  });

  app.put("/api/media/:id", async (req, res) => {
    try {
      const updates = req.body;
      const mediaItem = await storage.updateMediaItem(req.params.id, updates);
      if (!mediaItem) {
        return res.status(404).json({ error: "Media item not found" });
      }
      res.json(mediaItem);
    } catch (error) {
      res.status(500).json({ error: "Failed to update media item" });
    }
  });

  app.delete("/api/media/:id", async (req, res) => {
    try {
      const success = await storage.deleteMediaItem(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Media item not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete media item" });
    }
  });

  // Refresh metadata using multiScraper
  app.post("/api/media/:id/refresh", async (req, res) => {
    try {
      const mediaItem = await storage.getMediaItem(req.params.id);
      if (!mediaItem) {
        return res.status(404).json({ error: "Media item not found" });
      }

      // Call multiScraper to refresh metadata
      const result = await tryProxiesForDownload(mediaItem.url);
      
      if (result) {
        const updates = {
          downloadUrl: result.download_url,
          downloadExpiresAt: new Date(result.expires_at),
          downloadFetchedAt: new Date(),
          size: result.size || mediaItem.size,
          error: null
        };
        
        const updatedItem = await storage.updateMediaItem(req.params.id, updates);
        res.json({ success: true, mediaItem: updatedItem });
      } else {
        await storage.updateMediaItem(req.params.id, { 
          error: "No download link found from proxies",
          downloadFetchedAt: new Date()
        });
        res.status(404).json({ error: "No download link found from proxies" });
      }
    } catch (error) {
      console.error("Refresh metadata error:", error);
      res.status(500).json({ error: "Failed to refresh metadata" });
    }
  });

  // Get download URL for media item
  app.get("/api/media/:id/download", async (req, res) => {
    try {
      const { apiId } = req.query;
      const mediaItem = await storage.getMediaItem(req.params.id);
      
      if (!mediaItem) {
        return res.status(404).json({ error: "Media item not found" });
      }

      // Check if we have a valid cached download URL
      if (mediaItem.downloadUrl && mediaItem.downloadExpiresAt) {
        const now = new Date();
        const expiresAt = new Date(mediaItem.downloadExpiresAt);
        if (now < expiresAt) {
          return res.json({
            source: "cache",
            downloadUrl: mediaItem.downloadUrl,
            expiresAt: mediaItem.downloadExpiresAt
          });
        }
      }

      // Try to get fresh download URL
      const result = await tryProxiesForDownload(mediaItem.url);
      
      if (result) {
        // Update the media item with fresh download info
        await storage.updateMediaItem(req.params.id, {
          downloadUrl: result.download_url,
          downloadExpiresAt: new Date(result.expires_at),
          downloadFetchedAt: new Date(),
          size: result.size || mediaItem.size
        });

        res.json({
          source: "fresh",
          downloadUrl: result.download_url,
          expiresAt: result.expires_at,
          proxy: result.proxy
        });
      } else {
        res.status(404).json({ error: "No download link available" });
      }
    } catch (error) {
      console.error("Get download URL error:", error);
      res.status(500).json({ error: "Failed to get download URL" });
    }
  });

  // Tags Routes
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await storage.getTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const validatedData = insertTagSchema.parse(req.body);
      const tag = await storage.createTag(validatedData);
      res.status(201).json(tag);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
      const success = await storage.deleteTag(req.params.id);
      if (!success) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // Media Item Tags Routes
  app.post("/api/media/:mediaId/tags/:tagId", async (req, res) => {
    try {
      const { mediaId, tagId } = req.params;
      const result = await storage.addTagToMediaItem(mediaId, tagId);
      res.status(201).json(result);
    } catch (error) {
      res.status(500).json({ error: "Failed to add tag to media item" });
    }
  });

  app.delete("/api/media/:mediaId/tags/:tagId", async (req, res) => {
    try {
      const { mediaId, tagId } = req.params;
      const success = await storage.removeTagFromMediaItem(mediaId, tagId);
      if (!success) {
        return res.status(404).json({ error: "Tag association not found" });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to remove tag from media item" });
    }
  });

  // API Options Routes
  app.get("/api/api-options", async (req, res) => {
    try {
      const options = await storage.getApiOptions();
      res.json(options);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch API options" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

// MultiScraper utility functions
function parseExpiryFromResponse(apiResponse: any, downloadUrl?: string) {
  if (apiResponse && typeof apiResponse === "object") {
    if (apiResponse.expires_at) return new Date(apiResponse.expires_at).toISOString();
    if (apiResponse.expires_in) {
      return new Date(Date.now() + Number(apiResponse.expires_in) * 1000).toISOString();
    }
    if (apiResponse.expires) {
      const v = String(apiResponse.expires);
      const m = v.match(/(\d+)\s*h/i);
      if (m) return new Date(Date.now() + Number(m[1]) * 3600 * 1000).toISOString();
    }
  }

  if (downloadUrl) {
    try {
      const u = new URL(downloadUrl);
      const keys = ["expires", "expires_at", "dstime", "exp"];
      for (const k of keys) {
        if (u.searchParams.has(k)) {
          const v = u.searchParams.get(k);
          if (/^\d+$/.test(v!) && (v!.length >= 9)) {
            const epoch = parseInt(v!, 10);
            const dt = new Date((epoch < 1e12 ? epoch * 1000 : epoch));
            return dt.toISOString();
          }
          const m = v!.match(/(\d+)\s*h/i);
          if (m) return new Date(Date.now() + Number(m[1]) * 3600 * 1000).toISOString();
        }
      }
    } catch (e) { /* ignore */ }
  }

  return new Date(Date.now() + 8 * 3600 * 1000).toISOString();
}

async function tryProxiesForDownload(originalUrl: string) {
  for (const proxy of API_PROXIES) {
    try {
      let res;
      if (proxy.method === "GET") {
        const q = `${proxy.url}?${proxy.type === "query" ? `${proxy.field}=${encodeURIComponent(originalUrl)}` : ''}`;
        res = await fetch(q, { method: 'GET' });
      } else {
        const body = proxy.type === "json" ? JSON.stringify({ [proxy.field]: originalUrl }) : `${proxy.field}=${encodeURIComponent(originalUrl)}`;
        const headers = proxy.type === "json" ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' };
        res = await fetch(proxy.url, { method: 'POST', headers, body });
      }

      if (!res.ok) {
        console.warn(`[proxy ${proxy.name}] returned ${res.status}`);
        continue;
      }

      let j: any;
      try { 
        j = await res.json(); 
      } catch (e) {
        const text = await res.text();
        j = { rawText: text };
      }

      const linkCandidates = [
        j?.download_link, j?.downloadUrl, j?.download_url, j?.file, j?.file_url, j?.link, j?.url
      ].filter(Boolean);

      if (!linkCandidates.length && j) {
        for (const k of Object.keys(j)) {
          if (typeof j[k] === 'string' && (j[k].includes('terabox') || j[k].includes('dm-d.terabox') || j[k].match(/\.mp4(\?|$)/i))) {
            linkCandidates.push(j[k]);
          } else if (typeof j[k] === 'object' && j[k]) {
            for (const k2 of Object.keys(j[k])) {
              if (typeof j[k][k2] === 'string' && j[k][k2].includes('terabox')) linkCandidates.push(j[k][k2]);
            }
          }
        }
      }

      if (linkCandidates.length) {
        const download_url = linkCandidates[0];
        const expires_at = parseExpiryFromResponse(j, download_url);
        const size = j?.size || j?.filesize || j?.file_size || null;
        return { download_url, expires_at, size, raw: j, proxy: proxy.name };
      }

      if (j?.rawText) {
        const rx = /(https?:\/\/[^\s'"]{30,200})/g;
        const match = rx.exec(j.rawText);
        if (match) {
          const download_url = match[1];
          const expires_at = parseExpiryFromResponse(j, download_url);
          return { download_url, expires_at, size: null, raw: j, proxy: proxy.name };
        }
      }

    } catch (err) {
      console.warn(`[proxy ${proxy.name}] failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }
  return null;
}
