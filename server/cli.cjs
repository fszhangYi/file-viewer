#!/usr/bin/env node
/**
 * Headless server without Electron (no GUI / no Electron binary required).
 * Usage: node server/cli.cjs --dir /path [--host 0.0.0.0] [-p|--port 8787]
 */
const fs = require('node:fs');
const path = require('node:path');
const { createFileViewerServer } = require('./createServer.cjs');

function parseArgs(argv) {
  const out = { dir: process.cwd(), host: '0.0.0.0', port: 8787 };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--dir' && argv[i + 1]) out.dir = argv[++i];
    else if (a.startsWith('--dir=')) out.dir = a.slice(6);
    else if (a === '--host' && argv[i + 1]) out.host = argv[++i];
    else if (a.startsWith('--host=')) out.host = a.slice(7);
    else if ((a === '--port' || a === '-p') && argv[i + 1]) out.port = Number(argv[++i]);
    else if (a.startsWith('--port=')) out.port = Number(a.slice(7));
    else if (a.startsWith('-p') && a.length > 2 && a[2] !== '-') out.port = Number(a.slice(2));
    else if (a === '--ui') {
      console.error('server/cli.cjs is headless-only; use ./start.sh --ui for Electron UI');
      process.exit(2);
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const distDir = path.join(__dirname, '..', 'dist');
  if (!fs.existsSync(path.join(distDir, 'index.html'))) {
    console.error('missing dist/index.html — run: pnpm run build');
    process.exit(1);
  }
  const rootDir = path.resolve(args.dir);
  if (!fs.existsSync(rootDir) || !fs.statSync(rootDir).isDirectory()) {
    console.error(`--dir is not a directory: ${rootDir}`);
    process.exit(1);
  }
  const server = createFileViewerServer({
    rootDir,
    host: args.host,
    port: args.port,
    distDir,
    canPickDir: false,
  });
  const info = await server.start();
  console.log(`[file-viewer] server ${info.url}  root=${info.rootDir}`);
  console.log('[file-viewer] mode=headless (node)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
