#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { nanoid } from 'nanoid';
import { Pool } from 'pg';
import { config as authConfig } from '../src/config.js';

const rootDir = path.resolve(process.cwd());
const repoDir = path.resolve(rootDir, '..', '..');

const k2sEnvPath = process.env.K2S_ENV_FILE || path.join(repoDir, 'K2S-Web-Project', 'backend', '.env');
const rawArgs = process.argv.slice(2);
const args = new Set(rawArgs);
const isApplyMode = args.has('--apply');
const syncPassword = args.has('--sync-password');
const noBackup = args.has('--no-backup');

function getArgValue(name) {
  const idx = rawArgs.findIndex((arg) => arg === name || arg.startsWith(`${name}=`));
  if (idx < 0) return null;
  const arg = rawArgs[idx];
  if (arg.includes('=')) {
    const [, value] = arg.split(/=(.*)/s);
    return value ?? null;
  }
  return rawArgs[idx + 1] ?? null;
}

const onlyUserRaw = (getArgValue('--only-user') || '').trim();
const onlyUser = onlyUserRaw.toLowerCase();

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const raw = fs.readFileSync(filePath, 'utf8');
  const out = {};
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

const k2sEnv = parseEnvFile(k2sEnvPath);

const cfg = {
  host: process.env.K2S_DB_HOST || k2sEnv.DB_HOST,
  port: process.env.K2S_DB_PORT || k2sEnv.DB_PORT || '3306',
  database: process.env.K2S_DB_NAME || k2sEnv.DB_DATABASE,
  user: process.env.K2S_DB_USER || k2sEnv.DB_USERNAME,
  password: process.env.K2S_DB_PASSWORD || k2sEnv.DB_PASSWORD || '',
};

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase();
  return role === 'admin' ? 'Admin' : 'Viewer';
}

function normalizeStatus(value) {
  const status = String(value || '').trim().toLowerCase();
  return status === 'disabled' ? 'Disabled' : 'Active';
}

if (!cfg.host || !cfg.database || !cfg.user) {
  console.error(`[ERROR] Konfigurasi DB K2S belum lengkap. Cek ${k2sEnvPath} atau set env K2S_DB_*`);
  process.exit(1);
}

console.log(`[INFO] ${isApplyMode ? 'APPLY' : 'Dry-run'} migrasi user K2S -> Auth`);
if (!syncPassword) {
  console.log('[INFO] Password sync: OFF (gunakan --sync-password untuk ikut update password_hash)');
}
if (onlyUserRaw) {
  console.log(`[INFO] Filter only-user: ${onlyUserRaw}`);
}
console.log(`[INFO] Source MySQL : ${cfg.user}@${cfg.host}:${cfg.port}/${cfg.database}`);
console.log(
  `[INFO] Target PostgreSQL: ${
    authConfig.pg.connectionString
      ? authConfig.pg.connectionString
      : `${authConfig.pg.user}@${authConfig.pg.host}:${authConfig.pg.port}/${authConfig.pg.database}`
  }`
);

const mysqlQuery = `
SELECT JSON_OBJECT(
  'id', id,
  'username', COALESCE(username, ''),
  'email', COALESCE(email, ''),
  'password_hash', COALESCE(password, ''),
  'role', COALESCE(role, 'Viewer'),
  'status', COALESCE(status, 'Active'),
  'permissions_json', COALESCE(CAST(permissions AS CHAR), '{}')
)
FROM users
ORDER BY created_at ASC;
`;

const mysqlResult = spawnSync(
  'mysql',
  [
    '--protocol=tcp',
    `--host=${cfg.host}`,
    `--port=${cfg.port}`,
    `--user=${cfg.user}`,
    `--database=${cfg.database}`,
    '--batch',
    '--raw',
    '--skip-column-names',
    '-e',
    mysqlQuery,
  ],
  {
    encoding: 'utf8',
    env: {
      ...process.env,
      MYSQL_PWD: cfg.password,
    },
  }
);

if (mysqlResult.status !== 0) {
  const err = (mysqlResult.stderr || mysqlResult.stdout || 'Unknown mysql error').trim();
  console.error(err);
  console.error('[ERROR] Gagal membaca data user dari MySQL K2S.');
  process.exit(1);
}

const sourceUsers = [];
for (const line of mysqlResult.stdout.split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed) continue;
  try {
    const user = JSON.parse(trimmed);
    sourceUsers.push(user);
  } catch (error) {
    console.error('[WARN] Gagal parse row JSON:', trimmed.slice(0, 160));
  }
}

const filteredSourceUsers = onlyUser
  ? sourceUsers.filter((user) => {
      const id = String(user.id || '').toLowerCase();
      const username = String(user.username || '').toLowerCase();
      const email = String(user.email || '').toLowerCase();
      return id === onlyUser || username === onlyUser || email === onlyUser;
    })
  : sourceUsers;

if (isApplyMode && !noBackup) {
  console.log('[INFO] --no-backup diabaikan: target Auth sekarang PostgreSQL penuh.');
}

let inserts = 0;
let updates = 0;
let skips = 0;
let invalid = 0;
let appliedInserts = 0;
let appliedUpdates = 0;

const preview = [];
const previewLimit = 12;

const authPool = new Pool(
  authConfig.pg.connectionString
    ? {
        connectionString: authConfig.pg.connectionString,
        ssl: authConfig.pg.ssl ? { rejectUnauthorized: false } : false,
      }
    : {
        host: authConfig.pg.host,
        port: authConfig.pg.port,
        database: authConfig.pg.database,
        user: authConfig.pg.user,
        password: authConfig.pg.password,
        ssl: authConfig.pg.ssl ? { rejectUnauthorized: false } : false,
      }
);

async function processUsers(client) {
  for (const src of filteredSourceUsers) {
    const id = String(src.id || '').trim();
    const username = String(src.username || '').trim();
    const email = String(src.email || '').trim();
    const passwordHash = String(src.password_hash || '').trim();
    const role = normalizeRole(src.role || 'Viewer');
    const status = normalizeStatus(src.status || 'Active');
    const permissionsJson = String(src.permissions_json || '{}').trim() || '{}';

    if (!id || !username || !email || !passwordHash) {
      invalid += 1;
      if (preview.length < previewLimit) {
        preview.push(`[ERROR] ${id || '(no-id)'} missing required fields (username/email/password)`);
      }
      continue;
    }

    let parsedPermissions = {};
    try {
      parsedPermissions = JSON.parse(permissionsJson);
    } catch {
      invalid += 1;
      if (preview.length < previewLimit) {
        preview.push(`[ERROR] ${username} invalid permissions_json`);
      }
      continue;
    }

    const byIdResult = await client.query(
      `
        SELECT id, username, email, password_hash, role, status, permissions_json
        FROM users
        WHERE id = $1
        LIMIT 1
      `,
      [id]
    );
    let tgt = byIdResult.rows[0] ?? null;

    if (!tgt) {
      const byIdentityResult = await client.query(
        `
          SELECT id, username, email, password_hash, role, status, permissions_json
          FROM users
          WHERE username = $1 OR email = $2
          LIMIT 1
        `,
        [username, email]
      );
      tgt = byIdentityResult.rows[0] ?? null;
    }

    if (!tgt) {
      inserts += 1;
      if (isApplyMode) {
        const now = Date.now();
        await client.query(
          `
            INSERT INTO users (id, username, email, password_hash, role, permissions_json, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)
          `,
          [id || nanoid(), username, email, passwordHash, role, JSON.stringify(parsedPermissions), status, now, now]
        );
        appliedInserts += 1;
      }
      if (preview.length < previewLimit) {
        preview.push(`[INSERT] ${username} <${email}> role=${role} status=${status}`);
      }
      continue;
    }

    const currentPermissions = JSON.stringify(tgt.permissions_json ?? {});
    const nextPermissions = JSON.stringify(parsedPermissions);

    const diffs = [];
    if (String(tgt.username || '') !== username) diffs.push('username');
    if (String(tgt.email || '') !== email) diffs.push('email');
    if (syncPassword && String(tgt.password_hash || '') !== passwordHash) diffs.push('password_hash');
    if (String(tgt.role || '') !== role) diffs.push('role');
    if (String(tgt.status || '') !== status) diffs.push('status');
    if (currentPermissions !== nextPermissions) diffs.push('permissions');

    if (diffs.length > 0) {
      updates += 1;
      if (isApplyMode) {
        await client.query(
          `
            UPDATE users
            SET username = $1,
                email = $2,
                password_hash = $3,
                role = $4,
                permissions_json = $5::jsonb,
                status = $6,
                updated_at = $7
            WHERE id = $8
          `,
          [
            username,
            email,
            syncPassword ? passwordHash : String(tgt.password_hash || ''),
            role,
            JSON.stringify(parsedPermissions),
            status,
            Date.now(),
            String(tgt.id),
          ]
        );
        appliedUpdates += 1;
      }
      if (preview.length < previewLimit) {
        preview.push(`[UPDATE] ${username} <${email}> changed: ${diffs.join(', ')}`);
      }
    } else {
      skips += 1;
    }
  }
}

const client = await authPool.connect();
try {
  if (isApplyMode) {
    await client.query('BEGIN');
  }
  await processUsers(client);
  if (isApplyMode) {
    await client.query('COMMIT');
  }
} catch (error) {
  if (isApplyMode) {
    await client.query('ROLLBACK');
  }
  throw error;
} finally {
  client.release();
  await authPool.end();
}

console.log('');
console.log('=== DRY RUN SUMMARY ===');
console.log(`Source users      : ${sourceUsers.length}`);
if (onlyUserRaw) {
  console.log(`Filtered users    : ${filteredSourceUsers.length}`);
}
console.log(`Would INSERT      : ${inserts}`);
console.log(`Would UPDATE      : ${updates}`);
console.log(`No change (SKIP)  : ${skips}`);
console.log(`Invalid source    : ${invalid}`);
if (isApplyMode) {
  console.log(`Applied INSERT    : ${appliedInserts}`);
  console.log(`Applied UPDATE    : ${appliedUpdates}`);
}

console.log('');
console.log(`=== PREVIEW (up to ${previewLimit}) ===`);
if (preview.length === 0) {
  console.log('Tidak ada perubahan yang terdeteksi.');
} else {
  for (const line of preview) {
    console.log(line);
  }
}
