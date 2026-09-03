const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');

const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, 'public');
const UPLOAD_DIR = path.join(ROOT, 'uploads');
const PORT = Number(process.env.PORT) || 8787;
const HOST = process.env.HOST || '0.0.0.0';
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const MAX_REQUEST_BYTES = Math.ceil(MAX_UPLOAD_BYTES * 4 / 3) + 1024 * 1024;
const IMAGE_PATTERN = /^([a-f0-9]{16})\.png$/;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
}

function sendText(res, status, body, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': contentType,
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;

    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > MAX_REQUEST_BYTES) {
        reject(new Error('request-too-large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function getBaseUrl(req) {
  const configured = process.env.PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, '');
  const host = req.headers.host || `localhost:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || 'http';
  return `${protocol}://${host}`;
}

function listImages(req) {
  const entries = fs.readdirSync(UPLOAD_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && IMAGE_PATTERN.test(entry.name))
    .map((entry) => {
      const filePath = path.join(UPLOAD_DIR, entry.name);
      const stats = fs.statSync(filePath);
      return {
        id: entry.name.slice(0, -4),
        name: entry.name,
        url: `${getBaseUrl(req)}/i/${entry.name}`,
        size: stats.size,
        createdAt: stats.birthtimeMs || stats.mtimeMs,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function isPng(buffer) {
  return buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
}

async function handleUpload(req, res) {
  let input;
  try {
    input = JSON.parse((await readRequestBody(req)).toString('utf8'));
  } catch (error) {
    const status = error.message === 'request-too-large' ? 413 : 400;
    sendJson(res, status, { error: status === 413 ? '图片不能超过 20 MB' : '上传数据无效' });
    return;
  }

  if (typeof input.data !== 'string' || !input.data.startsWith('data:image/png;base64,')) {
    sendJson(res, 400, { error: '请上传 PNG 图片' });
    return;
  }

  const base64 = input.data.slice('data:image/png;base64,'.length);
  let buffer;
  try {
    buffer = Buffer.from(base64, 'base64');
  } catch {
    sendJson(res, 400, { error: '图片编码无效' });
    return;
  }

  if (!isPng(buffer)) {
    sendJson(res, 400, { error: '图片不是有效的 PNG 文件' });
    return;
  }

  if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
    sendJson(res, 413, { error: '图片不能超过 20 MB' });
    return;
  }

  const id = crypto.randomBytes(8).toString('hex');
  const fileName = `${id}.png`;
  fs.writeFileSync(path.join(UPLOAD_DIR, fileName), buffer, { flag: 'wx' });
  sendJson(res, 201, {
    id,
    name: fileName,
    size: buffer.length,
    url: `${getBaseUrl(req)}/i/${fileName}`,
  });
}

function serveImage(res, fileName) {
  if (!IMAGE_PATTERN.test(fileName)) {
    sendText(res, 404, 'Not found');
    return;
  }
  const filePath = path.join(UPLOAD_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }
  res.writeHead(200, {
    'Content-Type': 'image/png',
    'Cache-Control': 'public, max-age=31536000, immutable',
  });
  fs.createReadStream(filePath).pipe(res);
}

function serveStatic(res, pathname) {
  const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
  const filePath = path.resolve(PUBLIC_DIR, relative);
  if (!filePath.startsWith(PUBLIC_DIR + path.sep)) {
    sendText(res, 403, 'Forbidden');
    return;
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendText(res, 404, 'Not found');
    return;
  }
  const contentTypes = {
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.svg': 'image/svg+xml',
  };
  res.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const { pathname } = requestUrl;

  if (pathname === '/api/images' && req.method === 'GET') {
    sendJson(res, 200, { images: listImages(req) });
    return;
  }

  if (pathname === '/api/upload' && req.method === 'POST') {
    await handleUpload(req, res);
    return;
  }

  if (pathname === '/api/config' && req.method === 'GET') {
    sendJson(res, 200, { allowDelete: Boolean(ADMIN_TOKEN) });
    return;
  }

  if (pathname === '/README.md' && req.method === 'GET') {
    sendText(res, 200, fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8'));
    return;
  }

  const deleteMatch = pathname.match(/^\/api\/images\/([a-f0-9]{16})$/);
  if (deleteMatch && req.method === 'DELETE') {
    if (!ADMIN_TOKEN || req.headers['x-admin-token'] !== ADMIN_TOKEN) {
      sendJson(res, 403, { error: '删除功能未启用或管理令牌无效' });
      return;
    }
    const filePath = path.join(UPLOAD_DIR, `${deleteMatch[1]}.png`);
    if (!fs.existsSync(filePath)) {
      sendJson(res, 404, { error: '图片不存在' });
      return;
    }
    fs.unlinkSync(filePath);
    sendJson(res, 200, { ok: true });
    return;
  }

  const imageMatch = pathname.match(/^\/i\/([^/]+)$/);
  if (imageMatch && req.method === 'GET') {
    serveImage(res, imageMatch[1]);
    return;
  }

  if (req.method === 'GET') {
    serveStatic(res, pathname);
    return;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
});

server.listen(PORT, HOST, () => {
  console.log(`Image host running at http://localhost:${PORT}`);
  console.log(`Uploads directory: ${UPLOAD_DIR}`);
});
