const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

let cachedClient = null;
let cachedProvider = null;

function detectProvider() {
  const awsBucket = process.env.AWS_S3_BUCKET || process.env.S3_BUCKET;
  if (awsBucket && process.env.AWS_REGION) return 'aws';
  if (process.env.R2_BUCKET_NAME && process.env.R2_ACCOUNT_ID) return 'r2';
  return null;
}

function getClient() {
  if (cachedClient) return cachedClient;
  const provider = detectProvider();
  if (!provider) return null;

  if (provider === 'aws') {
    const config = { region: process.env.AWS_REGION };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      };
    }
    if (process.env.S3_ENDPOINT) config.endpoint = process.env.S3_ENDPOINT;
    cachedClient = new S3Client(config);
    cachedProvider = 'aws';
    return cachedClient;
  }

  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  cachedProvider = 'r2';
  return cachedClient;
}

function getBucket() {
  return process.env.AWS_S3_BUCKET || process.env.S3_BUCKET || process.env.R2_BUCKET_NAME || null;
}

async function getDownloadStreamSafe(key) {
  try {
    return await getDownloadStream(key);
  } catch (e) {
    if (e?.$metadata?.httpStatusCode === 404 || e?.Code === 'NoSuchKey' || e?.name === 'NoSuchKey') {
      return null;
    }
    throw e;
  }
}

function isConfigured() {
  return !!getClient() && !!getBucket();
}

function getProvider() {
  if (!cachedProvider) getClient();
  return cachedProvider;
}

function getPublicBaseUrl() {
  if (process.env.S3_PUBLIC_BASE_URL) return process.env.S3_PUBLIC_BASE_URL.replace(/\/$/, '');
  return null;
}

function publicUrlFor(key) {
  const base = getPublicBaseUrl();
  if (!base) return null;
  return `${base}/${key}`;
}

async function uploadBuffer(key, buffer, contentType, { cacheControl } = {}) {
  const client = getClient();
  if (!client) throw new Error('Object storage is not configured');
  await client.send(new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: cacheControl,
  }));
  return { key, url: publicUrlFor(key) };
}

async function getDownloadStream(key) {
  const client = getClient();
  if (!client) throw new Error('Object storage is not configured');
  const res = await client.send(new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));
  return res;
}

async function getUploadPresignedUrl(key, contentType, expiresIn = 600) {
  const client = getClient();
  if (!client) throw new Error('Object storage is not configured');
  return getSignedUrl(client, new PutObjectCommand({
    Bucket: getBucket(),
    Key: key,
    ContentType: contentType,
  }), { expiresIn });
}

async function getDownloadPresignedUrl(key, expiresIn = 3600) {
  const client = getClient();
  if (!client) throw new Error('Object storage is not configured');
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }), { expiresIn });
}

async function deleteObject(key) {
  const client = getClient();
  if (!client) throw new Error('Object storage is not configured');
  await client.send(new DeleteObjectCommand({
    Bucket: getBucket(),
    Key: key,
  }));
}

module.exports = {
  isConfigured,
  getProvider,
  getBucket,
  publicUrlFor,
  uploadBuffer,
  getDownloadStream,
  getDownloadStreamSafe,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  deleteObject,
};
