import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getUserPermissions,
  sanitizeRedirectTarget,
  toUserResponse,
} from '../src/auth-utils.js';

test('sanitizeRedirectTarget allows relative paths for local flow', () => {
  const result = sanitizeRedirectTarget('/portal-admin', 'http://localhost:4000/');
  assert.equal(result, 'http://localhost:4000/portal-admin');
});

test('sanitizeRedirectTarget blocks unknown external origins', () => {
  const fallback = 'http://localhost:4000/';
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
    created_at: 1,
    updated_at: 2,
  });

  assert.equal(response.username, 'admin');
  assert.equal(response.can_access_external_dnp, true);
  assert.equal(response.permissions.can_manage_users, true);
});
