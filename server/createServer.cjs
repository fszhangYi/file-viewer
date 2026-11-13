const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.wasm': 'application/wasm',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
};

function sendJson(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(data);
}

function sendError(res, status, message) {
  sendJson(res, status, { error: message });
}

function normalizeRel(rel) {
  const raw = (rel || '').replace(/\\/g, '/');
  const parts = raw.split('/').filter((p) => p && p !== '.');
  if (parts.some((p) => p === '..')) {
    throw new Error('path escapes root');
  }
  return parts.join('/');
}

function resolveUnderRoot(rootDir, rel) {
  const safeRel = normalizeRel(rel);
  const abs = path.resolve(rootDir, safeRel);
  const root = path.resolve(rootDir);
  if (abs !== root && !abs.startsWith(root + path.sep)) {
    throw new Error('path escapes root');
  }
  return { abs, rel: safeRel };
}

function guessMime(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  return MIME[ext] || 'application/octet-stream';
}

/**
 * @param {{
 *   rootDir: string,
 *   host?: string,
 *   port?: number,
 *   distDir: string,
 *   canPickDir?: boolean,
 * }} opts
 */
function createFileViewerServer(opts) {
  let rootDir = path.resolve(opts.rootDir);
  let canPickDir = Boolean(opts.canPickDir);
  const distDir = path.resolve(opts.distDir);
  const host = opts.host || '0.0.0.0';
  const port = Number(opts.port || 8787);

  const listeners = new Set();

  function getState() {
    return {
      rootDir,
      canPickDir,
      host,
      port,
    };
  }

  function setRootDir(next) {
    const abs = path.resolve(next);
    if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) {
      throw new Error(`not a directory: ${abs}`);
    }
    rootDir = abs;
    for (const fn of listeners) {
      try {
        fn(getState());
      } catch {
        /* ignore */
      }
    }
    return getState();
  }

  function onRootChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  async function listDir(relCwd) {
    const { abs, rel } = resolveUnderRoot(rootDir, relCwd || '');
    const stat = await fsp.stat(abs);
    if (!stat.isDirectory()) throw new Error('not a directory');
    const names = await fsp.readdir(abs);
    const entries = [];
    for (const name of names) {
      if (name === '.' || name === '..') continue;
      try {
        const childAbs = path.join(abs, name);
        const st = await fsp.stat(childAbs);
        entries.push({
          name,
          type: st.isDirectory() ? 'dir' : 'file',
          size: st.isFile() ? st.size : 0,
          mtimeMs: st.mtimeMs,
          relPath: rel ? `${rel}/${name}` : name,
        });
      } catch {
        /* skip unreadable */
      }
    }
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
      return a.name.localeCompare(b.name, 'zh-CN');
    });
    return {
      rootDir,
      cwd: rel,
      parent: rel.includes('/')
        ? rel.split('/').slice(0, -1).join('/')
        : rel
          ? ''
          : null,
      entries,
    };
  }

  async function handleApi(req, res, url) {
    if (req.method === 'GET' && url.pathname === '/api/health') {
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'GET' && url.pathname === '/api/state') {
      return sendJson(res, 200, getState());
    }
    if (req.method === 'GET' && url.pathname === '/api/list') {
      try {
        const cwd = url.searchParams.get('cwd') || '';
        const listing = await listDir(cwd);
        return sendJson(res, 200, listing);
      } catch (err) {
        return sendError(res, 400, err instanceof Error ? err.message : String(err));
      }
    }
    if (req.method === 'GET' && url.pathname === '/api/file') {
      try {
        const rel = url.searchParams.get('path') || '';
        const { abs } = resolveUnderRoot(rootDir, rel);
        const st = await fsp.stat(abs);
        if (!st.isFile()) return sendError(res, 400, 'not a file');
        const buf = await fsp.readFile(abs);
        res.writeHead(200, {
          'Content-Type': guessMime(abs),
          'Content-Length': buf.length,
          'Cache-Control': 'no-store',
          'X-File-Name': encodeURIComponent(path.basename(abs)),
          'X-File-Mtime': String(Math.floor(st.mtimeMs)),
          'X-File-Size': String(st.size),
        });
        res.end(buf);
        return;
      } catch (err) {
        return sendError(res, 400, err instanceof Error ? err.message : String(err));
      }
    }
    if (req.method === 'POST' && url.pathname === '/api/root') {
      if (!canPickDir) return sendError(res, 403, 'changing root is disabled');
      let body = '';
      for await (const chunk of req) body += chunk;
      try {
        const parsed = JSON.parse(body || '{}');
        const next = parsed.path;
        if (!next || typeof next !== 'string') {
          return sendError(res, 400, 'path required');
        }
        return sendJson(res, 200, setRootDir(next));
      } catch (err) {
        return sendError(res, 400, err instanceof Error ? err.message : String(err));
      }
    }
    return sendError(res, 404, 'not found');
  }

  async function handleStatic(req, res, url) {
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/') rel = '/index.html';
    const filePath = path.normalize(path.join(distDir, rel));
    if (!filePath.startsWith(distDir)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    try {
      const st = await fsp.stat(filePath);
      if (!st.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const buf = await fsp.readFile(filePath);
      res.writeHead(200, {
        'Content-Type': guessMime(filePath),
        'Content-Length': buf.length,
      });
      res.end(buf);
    } catch {
      // SPA fallback
      try {
        const indexPath = path.join(distDir, 'index.html');
        const buf = await fsp.readFile(indexPath);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(buf);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    }
  }

  const server = http.createServer(async (req, res) => {
    try {
      const hostHdr = req.headers.host || `127.0.0.1:${port}`;
      const url = new URL(req.url || '/', `http://${hostHdr}`);
      if (url.pathname.startsWith('/api/')) {
        await handleApi(req, res, url);
        return;
      }
      await handleStatic(req, res, url);
    } catch (err) {
      console.error('[server]', err);
      if (!res.headersSent) sendError(res, 500, 'internal error');
    }
  });

  function start() {
    return new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(port, host, () => {
        server.off('error', reject);
        const addr = server.address();
        resolve({
          host,
          port: typeof addr === 'object' && addr ? addr.port : port,
          rootDir,
          url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : port}/`,
        });
      });
    });
  }

  function stop() {
    return new Promise((resolve) => server.close(() => resolve()));
  }

  return {
    start,
    stop,
    getState,
    setRootDir,
    setCanPickDir(v) {
      canPickDir = Boolean(v);
    },
    onRootChange,
    listDir,
    server,
  };
}

module.exports = {
  createFileViewerServer,
  resolveUnderRoot,
  pathToFileURL,
};
