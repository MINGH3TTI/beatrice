const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const {
  getJwtSecret,
  getOptionalUser,
  requireAuth,
  requireAdmin,
  isAdminRole
} = require('../src/utils/auth');

test('getJwtSecret fails when JWT_SECRET is missing', () => {
  const previous = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;

  assert.throws(() => getJwtSecret(), /JWT_SECRET/);

  if (previous) process.env.JWT_SECRET = previous;
});

test('getOptionalUser decodes a bearer token', () => {
  process.env.JWT_SECRET = 'test-secret';
  const token = jwt.sign({ id: 'user-1', role: 'operator' }, process.env.JWT_SECRET);
  const user = getOptionalUser({ req: { headers: { authorization: `Bearer ${token}` } } });

  assert.equal(user.id, 'user-1');
  assert.equal(user.role, 'operator');
});

test('requireAuth and requireAdmin enforce access', () => {
  assert.throws(() => requireAuth({}), /não autenticado/);
  assert.throws(() => requireAdmin({ currentUser: { id: 'user-1', role: 'operator' } }), /administradores/);
  assert.equal(requireAdmin({ currentUser: { id: 'user-2', role: 'admin' } }).id, 'user-2');
  assert.equal(isAdminRole('gestor'), true);
  assert.equal(isAdminRole('operator'), false);
});
