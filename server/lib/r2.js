// 後方互換シム: 旧 R2 ベースの API を新しい storage.js（AWS S3 / R2 両対応）へ転送。
// 新規コードは server/lib/storage.js を直接利用してください。
const storage = require('./storage');

module.exports = {
  isR2Configured: storage.isConfigured,
  getUploadPresignedUrl: storage.getUploadPresignedUrl,
  getDownloadPresignedUrl: storage.getDownloadPresignedUrl,
  deleteR2Object: storage.deleteObject,
};
