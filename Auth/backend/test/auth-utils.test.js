import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserExternalDnpInstansiAccess,
  getUserPermissions,
  sanitizeRedirectTarget,
  toUserResponse,
} from '../src/auth-utils.js';
import { config } from '../src/config.js';

test('sanitizeRedirectTarget allows relative paths for local flow', () => {
  const fallback = new URL('/', config.baseUrl).toString();
  const result = sanitizeRedirectTarget('/portal-admin', fallback);
  assert.equal(result, new URL('/portal-admin', config.baseUrl).toString());
});

test('sanitizeRedirectTarget blocks unknown external origins', () => {
  const fallback = new URL('/', config.baseUrl).toString();
  const result = sanitizeRedirectTarget('https://evil.example.com/phish', fallback);
  assert.equal(result, fallback);
});

test('getUserPermissions enforces viewer restrictions', () => {
  const permissions = getUserPermissions({
    role: 'Viewer',
    permissions_json: {
      can_manage_users: true,
      can_access_admin_portal: true,
      can_access_logbook: true,
    },
  });

  assert.equal(permissions.can_manage_users, false);
  assert.equal(permissions.can_access_admin_portal, false);
  assert.equal(permissions.can_access_logbook, true);
});

test('getUserExternalDnpInstansiAccess only keeps viewer scoped instansi', () => {
  const access = getUserExternalDnpInstansiAccess({
    role: 'Viewer',
    permissions_json: {
      can_access_external_dnp: true,
    },
    external_dnp_instansi_json: ['ngloram', 'unknown', 'surabaya'],
  });

  assert.deepEqual(access, ['ngloram', 'surabaya']);
});

test('toUserResponse returns merged permissions and external dnp flag', () => {
  const response = toUserResponse({
    id: 'user-1',
    username: 'admin',
    email: 'admin@example.com',
    role: 'Admin',
    status: 'Active',
    permissions_json: {
      can_access_external_dnp: true,
    },
    certification_note_location_access_json: ['surabaya', 'unknown'],
    external_dnp_instansi_json: ['ngloram'],
    created_at: 1,
    updated_at: 2,
  });

  assert.equal(response.username, 'admin');
  assert.equal(response.can_access_external_dnp, true);
  assert.equal(response.permissions.can_manage_users, true);
  assert.deepEqual(response.certification_note_location_access, ['surabaya']);
  assert.deepEqual(response.external_dnp_instansi_access, []);
});
