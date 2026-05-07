import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateCreateUserPayload,
  validateLoginPayload,
  validateResetPasswordPayload,
  validateUpdateUserPayload,
} from '../src/validation.js';

test('validateLoginPayload rejects empty identity', () => {
  const result = validateLoginPayload({ email: '', password: 'secret123' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
});

test('validateLoginPayload accepts basic login payload', () => {
  const result = validateLoginPayload({ email: 'admin', password: 'secret123', return_to: '/app' });
  assert.equal(result.ok, true);
  assert.equal(result.data.email, 'admin');
  assert.equal(result.data.password, 'secret123');
  assert.equal(result.data.return_to, '/app');
});

test('validateCreateUserPayload normalizes permissions object', () => {
  const result = validateCreateUserPayload({
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    password: 'secret123',
    permissions: {
      can_manage_users: 1,
      unknown_flag: true,
    },
    certification_note_location_access: ['surabaya', 'UNKNOWN', 'malang'],
    external_dnp_instansi_access: ['ngloram', 'UNKNOWN', 'ngloram'],
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.data.permissions, {
    can_manage_users: true,
  });
  assert.deepEqual(result.data.certification_note_location_access, ['surabaya', 'malang']);
  assert.deepEqual(result.data.external_dnp_instansi_access, ['ngloram']);
});

test('validateCreateUserPayload rejects empty email', () => {
  const result = validateCreateUserPayload({
    name: 'Admin User',
    username: 'admin',
    email: '',
    password: 'secret123',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
});

test('validateCreateUserPayload normalizes local Indonesian phone format', () => {
  const result = validateCreateUserPayload({
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    phone: '08123456789',
    password: 'secret123',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.phone, '628123456789');
});

test('validateCreateUserPayload accepts international phone format', () => {
  const result = validateCreateUserPayload({
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    phone: '+14155552671',
    password: 'secret123',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.phone, '14155552671');
});

test('validateCreateUserPayload rejects invalid phone format', () => {
  const result = validateCreateUserPayload({
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    phone: '66',
    password: 'secret123',
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
});

test('validateCreateUserPayload allows empty optional phone', () => {
  const result = validateCreateUserPayload({
    name: 'Admin User',
    username: 'admin',
    email: 'admin@example.com',
    phone: '',
    password: 'secret123',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.phone, '');
});

test('validateUpdateUserPayload keeps undefined permissions untouched', () => {
  const result = validateUpdateUserPayload({
    username: 'viewer',
  });

  assert.equal(result.ok, true);
  assert.equal(result.data.permissions, undefined);
  assert.equal(result.data.certification_note_location_access, undefined);
  assert.equal(result.data.external_dnp_instansi_access, undefined);
});

test('validateResetPasswordPayload rejects empty password', () => {
  const result = validateResetPasswordPayload({ password: '' });
  assert.equal(result.ok, false);
  assert.equal(result.status, 422);
});
