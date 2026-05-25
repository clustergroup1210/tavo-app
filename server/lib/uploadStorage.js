const fs = require('fs');
const path = require('path');
const storage = require('./storage');

const LOCAL_UPLOADS_DIR = path.join(__dirname, '../../uploads');

async function saveUpload(relativeKey, buffer, contentType) {
  const key = `uploads/${relativeKey.replace(/^\/+/, '')}`;
  if (storage.isConfigured()) {
    await storage.uploadBuffer(key, buffer, contentType);
    return { key, storedRemotely: true };
  }
  const absPath = path.join(LOCAL_UPLOADS_DIR, relativeKey.replace(/^\/+/, ''));
  await fs.promises.mkdir(path.dirname(absPath), { recursive: true });
  await fs.promises.writeFile(absPath, buffer);
  return { key, storedRemotely: false };
}

async function deleteUpload(relativeKey) {
  const cleaned = relativeKey.replace(/^\/+/, '');
  const key = cleaned.startsWith('uploads/') ? cleaned : `uploads/${cleaned}`;
  if (storage.isConfigured()) {
    try { await storage.deleteObject(key); } catch (_) {}
  }
  const absPath = path.join(LOCAL_UPLOADS_DIR, key.replace(/^uploads\//, ''));
  fs.promises.unlink(absPath).catch(() => {});
}

async function streamUpload(res, relativeKey, { cacheControl, range } = {}) {
  const cleaned = relativeKey.replace(/^\/+/, '');
  const key = cleaned.startsWith('uploads/') ? cleaned : `uploads/${cleaned}`;

  if (storage.isConfigured()) {
    const obj = await storage.getDownloadStreamSafe(key, { range });
    if (!obj || !obj.Body) {
      const absPath = path.join(LOCAL_UPLOADS_DIR, key.replace(/^uploads\//, ''));
      if (fs.existsSync(absPath)) {
        if (cacheControl) res.set('Cache-Control', cacheControl);
        return res.sendFile(absPath);
      }
      return res.status(404).end();
    }
    if (obj.ContentType) res.set('Content-Type', obj.ContentType);
    if (obj.ContentLength != null) res.set('Content-Length', obj.ContentLength);
    if (obj.ContentRange) res.set('Content-Range', obj.ContentRange);
    res.set('Accept-Ranges', 'bytes');
    if (cacheControl) res.set('Cache-Control', cacheControl);
    if (range && obj.ContentRange) res.status(206);
    return obj.Body.pipe(res);
  }

  const absPath = path.join(LOCAL_UPLOADS_DIR, key.replace(/^uploads\//, ''));
  if (!fs.existsSync(absPath)) return res.status(404).end();
  if (cacheControl) res.set('Cache-Control', cacheControl);
  return res.sendFile(absPath);
}

module.exports = { saveUpload, deleteUpload, streamUpload, LOCAL_UPLOADS_DIR };
