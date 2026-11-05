import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { config } from './config.js';
import { seedIfEmpty } from './seed.js';
import { purgeExpiredSessions } from './auth.js';
import { Router, context, guard, sendJson, HttpError } from './http.js';
import { registerPublicRoutes } from './routes/public.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerCommerceRoutes } from './routes/commerce.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerPlanRoutes } from './routes/plan.js';
import { verifyMediaSignature, resolveMedia, streamFile } from './services/media.js';
import { all } from './db.js';
import { loadPublishedCourses } from './catalog.js';

seedIfEmpty();
purgeExpiredSessions();
setInterval(purgeExpiredSessions, 3600_000).unref();

const router = new Router();
registerPublicRoutes(router);
registerAccountRoutes(router);
registerCommerceRoutes(router);
registerAdminRoutes(router);
registerPlanRoutes(router);

const SECURITY_HEADERS = {
  'Content-Security-Policy': [
    "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
    "media-src 'self' blob:", "font-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
    "object-src 'none'",
  ].join('; '),
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), interest-cohort=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'X-Frame-Options': 'DENY',
  ...(config.cookieSecure ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.json': 'application/json',
  '.webmanifest': 'application/manifest+json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.woff2': 'font/woff2',
};

const indexHtml = () => fs.readFileSync(path.join(config.publicDir, 'index.html'));

function serveStatic(req, res, pathname) {
  const rel = decodeURIComponent(pathname).replace(/^\/+/, '');
  const file = path.resolve(config.publicDir, rel);
  if (!file.startsWith(config.publicDir + path.sep)) return false;
  let stat;
  try { stat = fs.statSync(file); } catch { return false; }
  if (!stat.isFile()) return false;
  const ext = path.extname(file);
  const etag = `W/"${stat.size.toString(16)}-${stat.mtimeMs.toString(16)}"`;
  if (req.headers['if-none-match'] === etag) { res.writeHead(304); res.end(); return true; }
  const headers = { 'Content-Type': MIME[ext] || 'application/octet-stream', ETag: etag, 'Cache-Control': 'public, max-age=300, must-revalidate' };
  const compressible = ['.js', '.css', '.svg', '.json', '.html'].includes(ext);
  if (compressible && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...headers, 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' });
    fs.createReadStream(file).pipe(zlib.createGzip()).pipe(res);
  } else {
    res.writeHead(200, { ...headers, 'Content-Length': stat.size });
    fs.createReadStream(file).pipe(res);
  }
  return true;
}

function sitemap() {
  const base = config.publicUrl.replace(/\/$/, '');
  const pages = ['/', '/courses', '/specialties', '/technology', '/pricing', '/partners', '/about', '/faq', '/contact',
    '/legal/impressum', '/legal/datenschutz', '/legal/agb', '/legal/ki-transparenz', '/legal/cme-akkreditierung'];
  const courses = loadPublishedCourses().map((c) => ({ slug: c.slug, updated_at: c.updated_at }));
  const specialties = [...new Set(loadPublishedCourses().flatMap((c) => [c.specialty_slug, c.specialty2_slug]).filter(Boolean))].map((slug) => ({ slug }));
  const urls = [...pages.map((p) => ({ loc: base + p })), ...specialties.map((s) => ({ loc: `${base}/specialties/${s.slug}` })),
    ...courses.map((c) => ({ loc: `${base}/courses/${c.slug}`, lastmod: c.updated_at.slice(0, 10) }))];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
    .map((u) => `  <url><loc>${u.loc}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ''}</url>`).join('\n')}\n</urlset>\n`;
}

const server = http.createServer(async (req, res) => {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.setHeader(k, v);
  let url;
  try { url = new URL(req.url, 'http://localhost'); } catch { res.writeHead(400); return res.end(); }
  const { pathname } = url;

  try {
    if (pathname.startsWith('/api/')) {
      const m = router.match(req.method, pathname);
      if (!m) throw new HttpError(404, 'Unknown API endpoint.');
      if (m.methodNotAllowed) throw new HttpError(405, 'Method not allowed.');
      // CSRF defence: state-changing requests must come from our own frontend (custom header + same origin).
      if (req.method !== 'GET' && !m.route.opts.skipCsrf) {
        if (req.headers['x-requested-with'] !== 'medtranslate') throw new HttpError(403, 'Missing request header.');
        const origin = req.headers.origin;
        if (origin && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Cross-origin request rejected.');
      }
      const ctx = context(req, res, url, m.params);
      guard(ctx, m.route.opts);
      const result = await m.route.handler(ctx);
      if (!res.headersSent && result !== undefined) sendJson(res, 200, result);
      return;
    }

    if (pathname.startsWith('/media/')) {
      const rel = decodeURIComponent(pathname.slice('/media/'.length));
      const isPoster = rel.startsWith('posters/');
      if (!isPoster && !verifyMediaSignature(rel, url.searchParams.get('exp'), url.searchParams.get('sig'))) {
        res.writeHead(403, { 'Content-Type': 'text/plain' }); return res.end('Media link expired or invalid.');
      }
      const file = resolveMedia(rel);
      if (!file) { res.writeHead(404); return res.end(); }
      return streamFile(req, res, file, { cache: isPoster ? 'public, max-age=86400' : 'private, max-age=3600' });
    }

    if (pathname === '/sitemap.xml') { res.writeHead(200, { 'Content-Type': 'application/xml' }); return res.end(sitemap()); }
    if (pathname === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      return res.end(`User-agent: *\nDisallow: /admin\nDisallow: /account\nDisallow: /api/\nDisallow: /media/\nSitemap: ${config.publicUrl.replace(/\/$/, '')}/sitemap.xml\n`);
    }
    if (req.method === 'GET' && pathname !== '/' && serveStatic(req, res, pathname)) return;
    if (req.method === 'GET' && !path.extname(pathname)) {
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' });
      return res.end(indexHtml());
    }
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found');
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    if (status === 500) console.error(err);
    if (!res.headersSent) sendJson(res, status, { error: status === 500 ? 'An unexpected error occurred. Please try again.' : err.message, details: err.details });
    else res.end();
  }
});

server.listen(config.port, config.host, () => {
  console.log(`MedTranslate running on ${config.publicUrl}  (env: ${config.env})`);
});

export default server;
