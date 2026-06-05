const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const path = require('node:path');

const mutationPath = path.resolve(__dirname, '../src/resolvers/collaborator/mutation.js');
const queryPath = path.resolve(__dirname, '../src/resolvers/collaborator/query.js');
const firebasePath = path.resolve(__dirname, '../src/config/firebase.js');

function loadModuleWithDb(modulePath, db) {
  delete require.cache[modulePath];
  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: db
  };

  return require(modulePath);
}

function createCollection(docs) {
  const makeDoc = (id, data) => ({
    id,
    exists: Boolean(data),
    data: () => data
  });

  const createQuery = (filters = [], max = null) => ({
    where(field, operator, value) {
      assert.equal(operator, '==');
      return createQuery([...filters, { field, value }], max);
    },
    limit(limitValue) {
      return createQuery(filters, limitValue);
    },
    async get() {
      let entries = [...docs.entries()]
        .filter(([, data]) => filters.every(filter => data[filter.field] === filter.value));

      if (max !== null) {
        entries = entries.slice(0, max);
      }

      const resultDocs = entries.map(([id, data]) => makeDoc(id, data));
      return {
        empty: resultDocs.length === 0,
        docs: resultDocs
      };
    }
  });

  return {
    doc(id) {
      return {
        async get() {
          return makeDoc(id, docs.get(id));
        },
        async update(updateData) {
          const current = docs.get(id);
          if (!current) {
            throw new Error('not-found');
          }
          docs.set(id, { ...current, ...updateData });
        }
      };
    },
    async add(data) {
      const id = `generated-${docs.size + 1}`;
      docs.set(id, data);
      return {
        id,
        async get() {
          return makeDoc(id, docs.get(id));
        }
      };
    },
    where(field, operator, value) {
      return createQuery().where(field, operator, value);
    },
    get: createQuery().get
  };
}

function createDb({ collaborators = new Map(), passwordResetRequests = new Map() } = {}) {
  return {
    collection(name) {
      if (name === 'collaborators') {
        return createCollection(collaborators);
      }
      if (name === 'passwordResetRequests') {
        return createCollection(passwordResetRequests);
      }
      throw new Error(`Unexpected collection ${name}`);
    }
  };
}

test('forgotPassword returns a message when email does not exist', async () => {
  const mutations = loadModuleWithDb(mutationPath, createDb());

  const result = await mutations.forgotPassword(null, { email: 'missing@example.com' });

  assert.equal(result.success, false);
  assert.match(result.message, /nao encontrado|não encontrado/);
});

test('forgotPassword creates a pending request for an existing collaborator', async () => {
  const collaborators = new Map([
    ['collab-1', { email: 'user@example.com', name: 'User', role: 'operator' }]
  ]);
  const passwordResetRequests = new Map();
  const mutations = loadModuleWithDb(mutationPath, createDb({ collaborators, passwordResetRequests }));

  const result = await mutations.forgotPassword(null, { email: 'user@example.com' });

  assert.equal(result.success, true);
  assert.equal(passwordResetRequests.size, 1);
  const request = [...passwordResetRequests.values()][0];
  assert.equal(request.collaboratorId, 'collab-1');
  assert.equal(request.email, 'user@example.com');
  assert.equal(request.collaboratorName, 'User');
  assert.equal(request.status, 'PENDING');
});

test('forgotPassword blocks duplicate pending requests', async () => {
  const collaborators = new Map([
    ['collab-1', { email: 'user@example.com', name: 'User', role: 'operator' }]
  ]);
  const passwordResetRequests = new Map([
    ['request-1', { collaboratorId: 'collab-1', email: 'user@example.com', status: 'PENDING', createdAt: '2026-01-01T00:00:00.000Z' }]
  ]);
  const mutations = loadModuleWithDb(mutationPath, createDb({ collaborators, passwordResetRequests }));

  const result = await mutations.forgotPassword(null, { email: 'user@example.com' });

  assert.equal(result.success, false);
  assert.match(result.message, /pendente/);
  assert.equal(passwordResetRequests.size, 1);
});

test('passwordResetRequests requires admin and lists pending requests', async () => {
  const passwordResetRequests = new Map([
    ['request-1', { collaboratorId: 'collab-1', email: 'user@example.com', collaboratorName: 'User', status: 'PENDING', createdAt: '2026-01-01T00:00:00.000Z' }],
    ['request-2', { collaboratorId: 'collab-2', email: 'done@example.com', collaboratorName: 'Done', status: 'COMPLETED', createdAt: '2026-01-02T00:00:00.000Z' }]
  ]);
  const queries = loadModuleWithDb(queryPath, createDb({ passwordResetRequests }));

  await assert.rejects(
    () => queries.passwordResetRequests(null, { status: 'PENDING' }, { currentUser: { role: 'operator' } }),
    /administradores/
  );

  const result = await queries.passwordResetRequests(null, { status: 'PENDING' }, { currentUser: { role: 'admin' } });
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 'request-1');
  assert.equal(result[0].status, 'PENDING');
});

test('completePasswordResetRequest requires admin, validates password, hashes password and completes request', async () => {
  const collaborators = new Map([
    ['collab-1', { email: 'user@example.com', name: 'User', role: 'operator', password: 'old-hash' }]
  ]);
  const passwordResetRequests = new Map([
    ['request-1', { collaboratorId: 'collab-1', email: 'user@example.com', collaboratorName: 'User', status: 'PENDING', createdAt: '2026-01-01T00:00:00.000Z' }]
  ]);
  const mutations = loadModuleWithDb(mutationPath, createDb({ collaborators, passwordResetRequests }));

  await assert.rejects(
    () => mutations.completePasswordResetRequest(null, { id: 'request-1', newPassword: 'secret123' }, { currentUser: { role: 'operator' } }),
    /administradores/
  );

  await assert.rejects(
    () => mutations.completePasswordResetRequest(null, { id: 'request-1', newPassword: '123' }, { currentUser: { role: 'admin' } }),
    /pelo menos 6/
  );

  const result = await mutations.completePasswordResetRequest(
    null,
    { id: 'request-1', newPassword: 'secret123' },
    { currentUser: { id: 'admin-1', role: 'admin' } }
  );

  const collaborator = collaborators.get('collab-1');
  const request = passwordResetRequests.get('request-1');
  assert.notEqual(collaborator.password, 'secret123');
  assert.equal(await bcrypt.compare('secret123', collaborator.password), true);
  assert.equal(request.status, 'COMPLETED');
  assert.equal(request.completedBy, 'admin-1');
  assert.equal(result.status, 'COMPLETED');
});
