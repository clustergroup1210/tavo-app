#!/usr/bin/env node
/*
 * Walk the local uploads/ directory and upload every file to the configured
 * object storage (AWS S3 / R2) under the same relative key (prefixed with
 * `uploads/`). Idempotent: skips keys that already exist (HEAD check).
 *
 * Usage: node scripts/migrate-uploads-to-s3.js [--dry-run] [--force]
 */
const fs = require('fs');
const path = require('path');
const mime = require('mime-types');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const storage = require('../server/lib/storage');

const DRY_RUN = process.argv.includes('--dry-run');
const FORCE = process.argv.includes('--force');
const ROOT = path.join(__dirname, '..', 'uploads');

function walk(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.isFile()) out.push(full);
  }
  return out;
}

async function main() {
  if (!storage.isConfigured()) {
    console.error('❌ Object storage is not configured. Set AWS_REGION, AWS_S3_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY.');
    process.exit(1);
  }
  const provider = storage.getProvider();
  const bucket = storage.getBucket();
  console.log(`📦 Provider: ${provider}  Bucket: ${bucket}`);
  console.log(`📁 Source: ${ROOT}`);
  if (DRY_RUN) console.log('(dry-run mode — no uploads)');

  const files = walk(ROOT);
  console.log(`Found ${files.length} files to migrate`);

  const client = new S3Client(
    provider === 'aws'
      ? {
          region: process.env.AWS_REGION,
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
          },
        }
      : {
          region: 'auto',
          endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          },
        }
  );

  let uploaded = 0, skipped = 0, failed = 0;
  for (const full of files) {
    const rel = path.relative(ROOT, full).split(path.sep).join('/');
    const key = `uploads/${rel}`;
    try {
      if (!FORCE) {
        try {
          await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
          console.log(`⏭  skip (exists): ${key}`);
          skipped++;
          continue;
        } catch (e) {
          if (e?.$metadata?.httpStatusCode !== 404 && e?.name !== 'NotFound') throw e;
        }
      }
      if (DRY_RUN) {
        console.log(`🟡 would upload: ${key} (${fs.statSync(full).size}B)`);
        uploaded++;
        continue;
      }
      const body = fs.readFileSync(full);
      const contentType = mime.lookup(full) || 'application/octet-stream';
      await client.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }));
      console.log(`✅ uploaded: ${key} (${body.length}B)`);
      uploaded++;
    } catch (e) {
      console.error(`❌ failed: ${key} — ${e.message}`);
      failed++;
    }
  }

  console.log(`\nDone. uploaded=${uploaded} skipped=${skipped} failed=${failed}`);
  process.exit(failed === 0 ? 0 : 2);
}

main().catch((e) => { console.error(e); process.exit(1); });
