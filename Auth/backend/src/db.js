import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import { nanoid } from 'nanoid';
import { config } from './config.js';
import { DEFAULT_ADMIN_PERMISSIONS } from './permissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const pgSchemaPath = path.join(path.resolve(__dirname, '..'), 'sql', 'postgres-auth-schema.sql');
const poolConfig = config.pg.connectionString
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
    };
const pool = new Pool(poolConfig);

function toPgSql(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => {
    index += 1;
    return `$${index}`;
  });
}

export async function queryOne(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  return res.rows[0] ?? null;
}

export async function queryAll(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  return res.rows;
}

export async function execQuery(sql, params = []) {
  const res = await pool.query(toPgSql(sql), params);
  return { changes: res.rowCount ?? 0 };
}

export async function initDb() {
  if (!fs.existsSync(pgSchemaPath)) {
    throw new Error(`PostgreSQL schema file tidak ditemukan: ${pgSchemaPath}`);
  }
  const schemaSql = fs.readFileSync(pgSchemaPath, 'utf8');
  await pool.query(schemaSql);
}

export async function seedDefaults() {
  const now = Date.now();
  const existingAdmin = await queryOne('SELECT id FROM users WHERE username = ? LIMIT 1', [config.devAdmin.username]);
  if (!existingAdmin) {
    const admin = {
      id: nanoid(),
      username: config.devAdmin.username,
      email: config.devAdmin.email,
      password_hash: bcrypt.hashSync(config.devAdmin.password, 10),
      role: 'Admin',
      permissions_json: JSON.stringify(DEFAULT_ADMIN_PERMISSIONS),
      status: 'Active',
      created_at: now,
      updated_at: now,
    };
    await execQuery(`
      INSERT INTO users (id, username, email, password_hash, role, permissions_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      admin.id,
      admin.username,
      admin.email,
      admin.password_hash,
      admin.role,
      admin.permissions_json,
      admin.status,
      admin.created_at,
      admin.updated_at,
    ]);
  }

  const existingClient = await queryOne('SELECT id FROM oauth_clients WHERE id = ? LIMIT 1', [config.defaultClient.clientId]);
  if (!existingClient) {
    await execQuery(`
      INSERT INTO oauth_clients (
        id, client_secret, name, redirect_uris_json, post_logout_redirect_uris_json, grant_types_json, scope, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      config.defaultClient.clientId,
      config.defaultClient.clientSecret,
      'K2S Web (dev)',
      JSON.stringify([config.defaultClient.redirectUri]),
      JSON.stringify([config.defaultClient.postLogoutRedirectUri]),
      JSON.stringify(['authorization_code', 'refresh_token']),
      'openid profile email',
      now,
      now,
    ]);
  }

  const existingLogbookClient = await queryOne('SELECT id FROM oauth_clients WHERE id = ? LIMIT 1', [config.defaultLogbookClient.clientId]);
  if (!existingLogbookClient) {
    await execQuery(`
      INSERT INTO oauth_clients (
        id, client_secret, name, redirect_uris_json, post_logout_redirect_uris_json, grant_types_json, scope, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      config.defaultLogbookClient.clientId,
      config.defaultLogbookClient.clientSecret,
      'Logbook Web (dev)',
      JSON.stringify([config.defaultLogbookClient.redirectUri]),
      JSON.stringify([config.defaultLogbookClient.postLogoutRedirectUri]),
      JSON.stringify(['authorization_code', 'refresh_token']),
      'openid profile email',
      now,
      now,
    ]);
  }
}

export function parseJson(value, fallback) {
  if (value === null || value === undefined) {
    return fallback;
  }
  if (typeof value === 'object') {
    return value;
  }
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}
