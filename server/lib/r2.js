const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

function getR2Client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return null;
  }

  return new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey }
  });
}

function getBucketName() {
  return process.env.R2_BUCKET_NAME;
}

function isR2Configured() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

async function getUploadPresignedUrl(key, contentType, expiresIn = 600) {
  const client = getR2Client();
  if (!client) throw new Error('R2 is not configured');

  const command = new PutObjectCommand({
    Bucket: getBucketName(),
    Key: key,
    ContentType: contentType
  });

  return getSignedUrl(client, command, { expiresIn });
}

async function getDownloadPresignedUrl(key, expiresIn = 3600) {
  const client = getR2Client();
  if (!client) throw new Error('R2 is not configured');

  const command = new GetObjectCommand({
    Bucket: getBucketName(),
    Key: key
  });

  return getSignedUrl(client, command, { expiresIn });
}

async function deleteR2Object(key) {
  const client = getR2Client();
  if (!client) throw new Error('R2 is not configured');

  const command = new DeleteObjectCommand({
    Bucket: getBucketName(),
    Key: key
  });

  await client.send(command);
}

module.exports = {
  isR2Configured,
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  deleteR2Object
};
