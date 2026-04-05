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

  await ensureOauthClient({
    now,
    clientId: config.defaultClient.clientId,
    clientSecret: config.defaultClient.clientSecret,
    name: 'K2S Web (dev)',
    redirectUri: config.defaultClient.redirectUri,
    postLogoutRedirectUri: config.defaultClient.postLogoutRedirectUri,
  });

  await ensureOauthClient({
    now,
    clientId: config.defaultLogbookClient.clientId,
    clientSecret: config.defaultLogbookClient.clientSecret,
    name: 'Logbook Web (dev)',
    redirectUri: config.defaultLogbookClient.redirectUri,
    postLogoutRedirectUri: config.defaultLogbookClient.postLogoutRedirectUri,
  });

  await ensureOauthClient({
    now,
    clientId: config.defaultK3Client.clientId,
    clientSecret: config.defaultK3Client.clientSecret,
    name: 'K3 Web (dev)',
    redirectUri: config.defaultK3Client.redirectUri,
    postLogoutRedirectUri: config.defaultK3Client.postLogoutRedirectUri,
  });
}

async function ensureOauthClient({
  now,
  clientId,
  clientSecret,
  name,
  redirectUri,
  postLogoutRedirectUri,
}) {
  const existingClient = await queryOne('SELECT id FROM oauth_clients WHERE id = ? LIMIT 1', [clientId]);
  const redirectUrisJson = JSON.stringify([redirectUri]);
  const postLogoutRedirectUrisJson = JSON.stringify([postLogoutRedirectUri]);
  const grantTypesJson = JSON.stringify(['authorization_code', 'refresh_token']);

  if (!existingClient) {
    await execQuery(`
      INSERT INTO oauth_clients (
        id, client_secret, name, redirect_uris_json, post_logout_redirect_uris_json, grant_types_json, scope, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `, [
      clientId,
      clientSecret,
      name,
      redirectUrisJson,
      postLogoutRedirectUrisJson,
      grantTypesJson,
      'openid profile email',
      now,
      now,
    ]);
    return;
  }

  await execQuery(`
    UPDATE oauth_clients
    SET
      client_secret = ?,
      name = ?,
      redirect_uris_json = ?,
      post_logout_redirect_uris_json = ?,
      grant_types_json = ?,
      scope = ?,
      updated_at = ?
    WHERE id = ?
  `, [
    clientSecret,
    name,
    redirectUrisJson,
    postLogoutRedirectUrisJson,
    grantTypesJson,
    'openid profile email',
    now,
    clientId,
  ]);
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
