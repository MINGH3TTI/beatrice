const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const path = require('node:path');

const mutationPath = path.resolve(__dirname, '../src/resolvers/collaborator/mutation.js');
const firebasePath = path.resolve(__dirname, '../src/config/firebase.js');

function loadMutationsWithDb(db) {
  delete require.cache[mutationPath];
  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: db
  };

  return require(mutationPath);
}

function createCollaboratorsCollection(docs) {
  return {
    doc(id) {
      return {
        async get() {
          const data = docs.get(id);
          return {
            id,
            exists: Boolean(data),
            data: () => data
          };
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
    where() {
      throw new Error('where not implemented for this test');
    }
  };
}

test('updatePassword requires admin access', async () => {
  const mutations = loadMutationsWithDb({
    collection: () => createCollaboratorsCollection(new Map())
  });

  await assert.rejects(
    () => mutations.updatePassword(null, { id: 'collab-1', password: 'secret123' }, { currentUser: { role: 'operator' } }),
    /administradores/
  );
});

test('updatePassword rejects short passwords', async () => {
  const mutations = loadMutationsWithDb({
    collection: () => createCollaboratorsCollection(new Map())
  });

  await assert.rejects(
    () => mutations.updatePassword(null, { id: 'collab-1', password: '123' }, { currentUser: { role: 'admin' } }),
    /pelo menos 6/
  );
});

test('updatePassword rejects missing collaborator', async () => {
  const mutations = loadMutationsWithDb({
    collection: () => createCollaboratorsCollection(new Map())
  });

  await assert.rejects(
    () => mutations.updatePassword(null, { id: 'missing', password: 'secret123' }, { currentUser: { role: 'admin' } }),
    /não encontrado/
  );
});

test('updatePassword hashes password and returns updated collaborator', async () => {
  const docs = new Map([
    ['collab-1', {
      email: 'user@example.com',
      name: 'User',
      role: 'operator',
      password: 'old-hash',
      assignedEnclosures: []
    }]
  ]);
  const mutations = loadMutationsWithDb({
    collection: () => createCollaboratorsCollection(docs)
  });

  const result = await mutations.updatePassword(
    null,
    { id: 'collab-1', password: 'secret123' },
    { currentUser: { role: 'admin' } }
  );

  const updated = docs.get('collab-1');
  assert.notEqual(updated.password, 'secret123');
  assert.equal(await bcrypt.compare('secret123', updated.password), true);
  assert.equal(result.id, 'collab-1');
  assert.equal(result.email, 'user@example.com');
});
