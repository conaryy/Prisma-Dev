#!/usr/bin/env node
import process from 'node:process';
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { config } from '../src/config.js';

const args = process.argv.slice(2);

function getArgValue(name) {
  const idx = args.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (idx < 0) return null;
  const arg = args[idx];
  if (arg.includes('=')) {
    const [, value] = arg.split(/=(.*)/s);
    return value ?? null;
  }
  return args[idx + 1] ?? null;
}

function usage() {
  console.log('Usage: node scripts/set-auth-user-password.mjs --user <username|email> [--password <newPassword>] [--generate]');
  console.log('Example: node scripts/set-auth-user-password.mjs --user admin --password Admin123!');
  console.log('Example: node scripts/set-auth-user-password.mjs --user user1 --generate');
}

function generatePassword(length = 16) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

const userKey = (getArgValue('--user') || '').trim();
const providedPassword = getArgValue('--password');
const shouldGenerate = args.includes('--generate');

if (!userKey) {
  usage();
  process.exit(1);
}

if (!providedPassword && !shouldGenerate) {
  console.error('[ERROR] Harus pilih salah satu: --password atau --generate');
  usage();
  process.exit(1);
}

const password = providedPassword ?? generatePassword();
const hash = bcrypt.hashSync(password, 10);
const pool = new Pool(
  config.pg.connectionString
    ? {
        connectionString: config.pg.connectionString,
        ssl: config.pg.ssl ? { rejectUnauthorized: false } : false,
      }
    : {
        host: config.pg.host,
        port: config.pg.port,
        database: config.pg.database,
        user: config.pg.user,
        password: config.pg.password,
        ssl: config.pg.ssl ? { rejectUnauthorized: false } : false,
      }
);

let result;
try {
  result = await pool.query(
    `
      UPDATE users
      SET password_hash = $1, updated_at = $2
      WHERE username = $3 OR email = $4
    `,
    [hash, Date.now(), userKey, userKey]
  );
} finally {
  await pool.end();
}

if ((result.rowCount ?? 0) < 1) {
  console.error(`[ERROR] User tidak ditemukan: ${userKey}`);
  process.exit(1);
}

console.log(`[OK] Password updated for: ${userKey}`);
if (shouldGenerate) {
  console.log(`[NEW_PASSWORD] ${password}`);
}
