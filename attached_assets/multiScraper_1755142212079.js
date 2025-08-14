// server.js
import express from "express";
import Database from "better-sqlite3";
import fetch from "node-fetch"; // npm i node-fetch@2
import { URL } from "url";

const app = express();
app.use(express.json());

const DB_FILE = "cipherbox.db";
const db = new Database(DB_FILE);

// Ensure schema: create columns if missing (idempotent)
(function ensureSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS videos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      url TEXT UNIQUE NOT NULL,
      title TEXT,
      description TEXT,
      thumbnail TEXT,
      duration INTEGER,
      download_url TEXT,
      download_expires_at TEXT,
      download_fetched_at TEXT,
      size INTEGER,
      scraped_at DATETIME,
      error TEXT
    );
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      video_id INTEGER NOT NULL,
      tag TEXT NOT NULL,
      FOREIGN KEY(video_id) REFERENCES videos(id)
    );
  `);
})();

// Configure your API proxies here (order = fallback order).
// Replace these with the actual proxy endpoints you run locally.
const API_PROXIES = [
  { name: "iteraplay", url: "http://localhost:3000/iteraplay-proxy", method: "POST", type: "json", field: "link" },
  { name: "raspywave", url: "http://localhost:3000/raspywave-proxy", method: "POST", type: "json", field: "link" },
  { name: "rapidapi", url: "http://localhost:3000/rapidapi", method: "POST", type: "json", field: "link" },
  { name: "tera-cc", url: "http://localhost:3000/tera-downloader-cc", method: "POST", type: "json", field: "url" },
  { name: "ronnie- client", url: "http://localhost:3000/ronnieverse-client", method: "GET", type: "query", field: "url" }
  // add more proxies you have
];

// utility: parse expiry from a URL or API response heuristically
function parseExpiryFromResponse(apiResponse, downloadUrl) {
  // Prefer explicit expires field in API response (common)
  if (apiResponse && typeof apiResponse === "object") {
    if (apiResponse.expires_at) return new Date(apiResponse.expires_at).toISOString();
    if (apiResponse.expires_in) {
      // seconds
      return new Date(Date.now() + Number(apiResponse.expires_in) * 1000).toISOString();
    }
    // some APIs return object like { download_link, expires: "8h" } or string
    if (apiResponse.expires) {
      const v = String(apiResponse.expires);
      const m = v.match(/(\d+)\s*h/i);
      if (m) return new Date(Date.now() + Number(m[1]) * 3600 * 1000).toISOString();
    }
  }

  // If expiry encoded in URL (e.g. expires=8h or dstime=timestamp), try to parse
  if (downloadUrl) {
    try {
      const u = new URL(downloadUrl);
      // common param names: expires, dstime, expires_in, exp
      const keys = ["expires", "expires_at", "dstime", "dstime", "exp"];
      for (const k of keys) {
        if (u.searchParams.has(k)) {
          const v = u.searchParams.get(k);
          // dstime sometimes is epoch seconds
          if (/^\d+$/.test(v) && (v.length >= 9)) {
            const epoch = parseInt(v, 10);
            // if it's in seconds assume seconds
            const dt = new Date((epoch < 1e12 ? epoch * 1000 : epoch));
            return dt.toISOString();
          }
          // if value like "8h"
          const m = v.match(/(\d+)\s*h/i);
          if (m) return new Date(Date.now() + Number(m[1]) * 3600 * 1000).toISOString();
        }
      }
    } catch (e) { /* ignore */ }
  }

  // fallback: assume link lasts 8 hours
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString();
}

// check cached download link validity
function isLinkValid(row) {
  if (!row || !row.download_url) return false;
  if (!row.download_expires_at) return true; // if no expiry stored assume valid (but be cautious)
  const exp = new Date(row.download_expires_at);
  return (Date.now() < exp.getTime());
}

// Try proxies in order to get a download link; return object { download_url, expires_at, size, raw }
async function tryProxiesForDownload(originalUrl) {
  for (const proxy of API_PROXIES) {
    try {
      let res;
      if (proxy.method === "GET") {
        // proxy expects url in query
        const q = `${proxy.url}?${proxy.type === "query" ? `${proxy.field}=${encodeURIComponent(originalUrl)}` : ''}`;
        res = await fetch(q, { method: 'GET' });
      } else {
        // POST JSON { field: originalUrl } by default
        const body = proxy.type === "json" ? JSON.stringify({ [proxy.field]: originalUrl }) : `${proxy.field}=${encodeURIComponent(originalUrl)}`;
        const headers = proxy.type === "json" ? { 'Content-Type': 'application/json' } : { 'Content-Type': 'application/x-www-form-urlencoded' };
        res = await fetch(proxy.url, { method: 'POST', headers, body });
      }

      if (!res.ok) {
        console.warn(`[proxy ${proxy.name}] returned ${res.status}`);
        continue;
      }

      // try to parse json
      let j;
      try { j = await res.json(); } catch (e) {
        const text = await res.text();
        // sometimes proxy returns direct JSON-like string, try to find link inside
        j = { rawText: text };
      }

      // heuristics: many proxies respond with e.g. { download_link: "...", file_name: "...", size: "...", expires_in: 28800 }
      // check common fields
      const linkCandidates = [
        j.download_link, j.downloadUrl, j.download_url, j.file, j.file_url, j.link, j.url
      ].filter(Boolean);

      // also if j has nested result object
      if (!linkCandidates.length) {
        for (const k of Object.keys(j || {})) {
          if (typeof j[k] === 'string' && j[k].includes('terabox') || j[k].includes('dm-d.terabox') || j[k].match(/\.mp4(\?|$)/i)) {
            linkCandidates.push(j[k]);
          } else if (typeof j[k] === 'object') {
            // search nested
            for (const k2 of Object.keys(j[k])) {
              if (typeof j[k][k2] === 'string' && j[k][k2].includes('terabox')) linkCandidates.push(j[k][k2]);
            }
          }
        }
      }

      // if we found a link candidate, pick first and parse expiry
      if (linkCandidates.length) {
        const download_url = linkCandidates[0];
        const expires_at = parseExpiryFromResponse(j, download_url);
        // try size if present
        const size = j.size || j.filesize || j.file_size || null;
        return { download_url, expires_at, size, raw: j, proxy: proxy.name };
      }

      // fallback: maybe text contains URL
      if (j && j.rawText) {
        const rx = /(https?:\/\/[^\s'"]{30,200})/g;
        const match = rx.exec(j.rawText);
        if (match) {
          const download_url = match[1];
          const expires_at = parseExpiryFromResponse(j, download_url);
          return { download_url, expires_at, size: null, raw: j, proxy: proxy.name };
        }
      }

    } catch (err) {
      console.warn(`[proxy ${proxy.name}] failed: ${err.message}`);
      // continue to next proxy
    }
  }
  // if none succeed
  return null;
}

// endpoint: get (or fetch) download url for a terabox share url
app.get("/get-download", async (req, res) => {
  const originalUrl = req.query.url;
  if (!originalUrl) return res.status(400).json({ error: "Missing url query param" });

  try {
    // look up video row
    const row = db.prepare("SELECT * FROM videos WHERE url = ?").get(originalUrl);

    if (row && isLinkValid(row)) {
      return res.json({
        source: "cache",
        download_url: row.download_url,
        download_expires_at: row.download_expires_at,
        size: row.size || null
      });
    }

    // otherwise, try proxies
    const result = await tryProxiesForDownload(originalUrl);
    if (!result) {
      // record attempted fetch time and error for future
      db.prepare(`INSERT INTO videos (url, scraped_at, error) VALUES (?, CURRENT_TIMESTAMP, ?)
        ON CONFLICT(url) DO UPDATE SET scraped_at=CURRENT_TIMESTAMP, error=excluded.error`)
        .run(originalUrl, 'no-download-found');
      return res.status(404).json({ error: "No download link found from proxies" });
    }

    // store into DB
    const insert = db.prepare(`
      INSERT INTO videos (url, download_url, download_expires_at, download_fetched_at, size)
      VALUES (@url, @download_url, @download_expires_at, @download_fetched_at, @size)
      ON CONFLICT(url) DO UPDATE SET
        download_url=excluded.download_url,
        download_expires_at=excluded.download_expires_at,
        download_fetched_at=excluded.download_fetched_at,
        size=excluded.size
    `);

    const record = {
      url: originalUrl,
      download_url: result.download_url,
      download_expires_at: result.expires_at,
      download_fetched_at: new Date().toISOString(),
      size: result.size ? (typeof result.size === 'number' ? result.size : null) : null
    };

    insert.run(record);

    return res.json({
      source: "proxy",
      proxy: result.proxy,
      download_url: record.download_url,
      download_expires_at: record.download_expires_at,
      size: record.size
    });

  } catch (err) {
    console.error("GET /get-download error:", err);
    return res.status(500).json({ error: err.message });
  }
});

// extra utility to force-refresh the download link (bypass cache)
app.get("/refresh-download", async (req, res) => {
  const originalUrl = req.query.url;
  if (!originalUrl) return res.status(400).json({ error: "Missing url query param" });

  try {
    const result = await tryProxiesForDownload(originalUrl);
    if (!result) return res.status(404).json({ error: "No download link found" });

    const insert = db.prepare(`
      INSERT INTO videos (url, download_url, download_expires_at, download_fetched_at, size)
      VALUES (@url, @download_url, @download_expires_at, @download_fetched_at, @size)
      ON CONFLICT(url) DO UPDATE SET
        download_url=excluded.download_url,
        download_expires_at=excluded.download_expires_at,
        download_fetched_at=excluded.download_fetched_at,
        size=excluded.size
    `);

    const record = {
      url: originalUrl,
      download_url: result.download_url,
      download_expires_at: result.expires_at,
      download_fetched_at: new Date().toISOString(),
      size: result.size || null
    };
    insert.run(record);

    return res.json({ ok: true, proxy: result.proxy, download_url: record.download_url, download_expires_at: record.download_expires_at });
  } catch (err) {
    console.error("GET /refresh-download error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Download-cacher server running on http://localhost:${PORT}`));
