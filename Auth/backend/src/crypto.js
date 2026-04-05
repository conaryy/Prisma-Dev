import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import {
  exportJWK,
  generateKeyPair,
  importJWK,
  SignJWT,
  jwtVerify,
} from 'jose';
import { config } from './config.js';

let signingKey;
let verifyingKey;
let publicJwk;

function hashSha256(input) {
  return createHash('sha256').update(input).digest('hex');
}

export function randomToken(length = 48) {
  return randomBytes(length).toString('base64url');
}

export function hashToken(token) {
  return hashSha256(token);
}

function loadPrivateJwkFromEnv() {
  if (!config.jwkJson) {
    return null;
  }

  try {
    return JSON.parse(config.jwkJson);
  } catch (error) {
    throw new Error(`AUTH_JWK_JSON tidak valid: ${(error && error.message) || 'parse failed'}`);
  }
}

function loadPrivateJwkFromPath() {
  if (!config.jwkPath || !fs.existsSync(config.jwkPath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(config.jwkPath, 'utf8'));
}

async function generatePrivateJwk() {
  const { privateKey } = await generateKeyPair('RS256');
  const privateJwk = await exportJWK(privateKey);
  privateJwk.kid = 'auth-main-key';
  privateJwk.alg = 'RS256';
  privateJwk.use = 'sig';
  return privateJwk;
}

function persistPrivateJwk(privateJwk) {
  if (!config.jwkPath) {
    return;
  }

  try {
    fs.mkdirSync(path.dirname(config.jwkPath), { recursive: true });
    fs.writeFileSync(config.jwkPath, JSON.stringify(privateJwk, null, 2), 'utf8');
  } catch (error) {
    console.warn(`[auth-backend] failed to persist generated JWK to ${config.jwkPath}`);
    console.warn(error);
  }
}

export async function initKeys() {
  let privateJwk = loadPrivateJwkFromEnv() ?? loadPrivateJwkFromPath();

  if (!privateJwk) {
    if (!config.allowEphemeralJwk) {
      throw new Error(
        'JWK private key tidak tersedia. Set AUTH_JWK_JSON atau AUTH_JWK_PATH untuk production.'
      );
    }

    privateJwk = await generatePrivateJwk();
    persistPrivateJwk(privateJwk);
  }

  signingKey = await importJWK(privateJwk, 'RS256');
  publicJwk = { ...privateJwk };
  delete publicJwk.d;
  delete publicJwk.p;
  delete publicJwk.q;
  delete publicJwk.dp;
  delete publicJwk.dq;
  delete publicJwk.qi;
  publicJwk.key_ops = ['verify'];
  verifyingKey = await importJWK(publicJwk, 'RS256');
}

export function getJwksPayload() {
  return { keys: [publicJwk] };
}

export async function signAccessToken(payload, ttlSeconds) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(signingKey);
}

export async function signIdToken(payload, ttlSeconds) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'RS256', kid: publicJwk.kid, typ: 'JWT' })
    .setIssuedAt()
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime(`${ttlSeconds}s`)
    .sign(signingKey);
}

export async function verifyAccessToken(token) {
  const { payload } = await jwtVerify(token, verifyingKey, {
    issuer: config.issuer,
    audience: config.audience,
  });
  return payload;
}
