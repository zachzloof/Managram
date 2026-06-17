#!/usr/bin/env node
// One-time setup: generates the RSA keypair used to sign/verify license
// tokens. The PRIVATE key is a secret — it stays only in the hosted
// server's environment (set it as the JWT_PRIVATE_KEY env var on Railway,
// never commit it). The PUBLIC key is safe to ship inside the Electron app
// (it can verify a token's signature but can't forge new ones), and gets
// written to electron/license-public-key.pem automatically.
//
// Usage: node backend/scripts/generate-license-keys.js

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const electronPublicKeyPath = path.join(__dirname, '../../electron/license-public-key.pem');
fs.writeFileSync(electronPublicKeyPath, publicKey);

console.log('Public key written to electron/license-public-key.pem (safe to commit).\n');
console.log('Set this as the JWT_PRIVATE_KEY env var on your hosted server (Railway).');
console.log('Keep it secret — never commit it:\n');
console.log(privateKey);
