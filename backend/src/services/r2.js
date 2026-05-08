const {
  S3Client,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  CopyObjectCommand,
  GetObjectCommand,
} = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const os = require('os');
const path = require('path');
const fs = require('fs');
const mime = require('mime-types');

const R2_PUBLIC_BASE = (process.env.R2_PUBLIC_URL || 'https://media.managram.uk').replace(/\/$/, '');

function isR2Mode() {
  return !!(
    process.env.R2_ACCOUNT_ID &&
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME
  );
}

function getClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

function getPublicUrl(key) {
  return `${R2_PUBLIC_BASE}/${key}`;
}

async function uploadBuffer(key, buffer, contentType) {
  const client = getClient();
  const upload = new Upload({
    client,
    params: {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || mime.lookup(key) || 'application/octet-stream',
    },
  });
  await upload.done();
}

async function uploadStream(key, stream, contentType) {
  const client = getClient();
  const upload = new Upload({
    client,
    params: {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: stream,
      ContentType: contentType || mime.lookup(key) || 'application/octet-stream',
    },
  });
  await upload.done();
}

async function deleteObjects(keys) {
  if (!keys.length) return;
  const client = getClient();
  await client.send(
    new DeleteObjectsCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Delete: { Objects: keys.map((k) => ({ Key: k })), Quiet: true },
    })
  );
}

async function listObjects(prefix) {
  const client = getClient();
  const results = [];
  let continuationToken;

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix || '',
        Delimiter: '/',
        ContinuationToken: continuationToken,
      })
    );

    for (const p of resp.CommonPrefixes || []) {
      results.push({ type: 'folder', prefix: p.Prefix });
    }
    for (const o of resp.Contents || []) {
      if (o.Key === prefix || o.Key.endsWith('/.keep')) continue;
      results.push({ type: 'file', key: o.Key, size: o.Size, lastModified: o.LastModified });
    }

    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : null;
  } while (continuationToken);

  return results;
}

async function listAllObjects(prefix) {
  const client = getClient();
  const results = [];
  let continuationToken;

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix || '',
        ContinuationToken: continuationToken,
      })
    );

    for (const o of resp.Contents || []) {
      if (o.Key.endsWith('/.keep')) continue;
      results.push({ type: 'file', key: o.Key, size: o.Size, lastModified: o.LastModified });
    }

    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : null;
  } while (continuationToken);

  return results;
}

async function renameObject(oldKey, newKey) {
  const client = getClient();
  await client.send(
    new CopyObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      CopySource: `${process.env.R2_BUCKET_NAME}/${encodeURIComponent(oldKey)}`,
      Key: newKey,
    })
  );
  await deleteObjects([oldKey]);
}

async function downloadToTemp(key) {
  const client = getClient();
  const resp = await client.send(
    new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    })
  );

  const ext = path.extname(key) || '';
  const tmpPath = path.join(os.tmpdir(), `managram_${Date.now()}${ext}`);

  const chunks = [];
  for await (const chunk of resp.Body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  fs.writeFileSync(tmpPath, Buffer.concat(chunks));

  return tmpPath;
}

module.exports = {
  isR2Mode,
  getPublicUrl,
  uploadBuffer,
  uploadStream,
  deleteObjects,
  listObjects,
  listAllObjects,
  renameObject,
  downloadToTemp,
};
