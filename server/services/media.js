import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

// Signed, expiring media URLs (the same pattern CDNs such as CloudFront/Bunny use).
export function signMediaPath(relPath, ttlSec = 6 * 3600) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  const sig = crypto.createHmac('sha256', config.mediaSigningSecret).update(`${relPath}:${exp}`).digest('base64url');
  return `/media/${relPath.split('/').map(encodeURIComponent).join('/')}?exp=${exp}&sig=${sig}`;
}

export function verifyMediaSignature(relPath, exp, sig) {
  if (!exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const expected = crypto.createHmac('sha256', config.mediaSigningSecret).update(`${relPath}:${exp}`).digest('base64url');
  const a = Buffer.from(expected); const b = Buffer.from(String(sig));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const TYPES = { '.mp4': 'video/mp4', '.webm': 'video/webm', '.m4a': 'audio/mp4', '.mp3': 'audio/mpeg', '.jpg': 'image/jpeg', '.png': 'image/png', '.vtt': 'text/vtt' };

export function resolveMedia(relPath) {
  const base = relPath.startsWith('uploads/') ? config.dataDir : config.mediaDir;
  const full = path.resolve(base, relPath);
  if (!full.startsWith(path.resolve(base) + path.sep)) return null;
  return full;
}

/** Streams a file with HTTP Range support so the player can seek without full downloads. */
export function streamFile(req, res, file, { cache = 'private, max-age=3600' } = {}) {
  let stat;
  try { stat = fs.statSync(file); } catch { res.writeHead(404); return res.end('Not found'); }
  if (!stat.isFile()) { res.writeHead(404); return res.end('Not found'); }
  const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';
  const range = req.headers.range;
  const headers = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': cache, 'Last-Modified': stat.mtime.toUTCString() };
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = m && m[1] ? parseInt(m[1], 10) : NaN;
    let end = m && m[2] ? parseInt(m[2], 10) : stat.size - 1;
    if (m && !m[1] && m[2]) { start = stat.size - parseInt(m[2], 10); end = stat.size - 1; }
    if (!m || isNaN(start) || start > end || end >= stat.size) {
      res.writeHead(416, { 'Content-Range': `bytes */${stat.size}` });
      return res.end();
    }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${stat.size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(file, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': stat.size });
  if (req.method === 'HEAD') return res.end();
  fs.createReadStream(file).pipe(res);
}
