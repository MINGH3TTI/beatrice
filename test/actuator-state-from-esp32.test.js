const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const enclosureMutationPath = path.resolve(__dirname, '../src/resolvers/enclosure/mutation.js');
const enclosureResolverPath = path.resolve(__dirname, '../src/resolvers/enclosure/index.js');
const firebasePath = path.resolve(__dirname, '../src/config/firebase.js');

function loadMutationsWithDb(db) {
  delete require.cache[enclosureMutationPath];

  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: db
  };

  return require(enclosureMutationPath);
}

function loadResolversWithDb(db) {
  delete require.cache[enclosureMutationPath];
  delete require.cache[enclosureResolverPath];

  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: db
  };

  return require(enclosureResolverPath);
}

function createDoc(id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => data
  };
}

function createCollection(docs) {
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

      const resultDocs = entries.map(([id, data]) => createDoc(id, data));
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
          return createDoc(id, docs.get(id));
        },
        async set(data) {
          docs.set(id, data);
        }
      };
    },
    where(field, operator, value) {
      return createQuery().where(field, operator, value);
    }
  };
}

function createDb({ enclosures = new Map(), actuators = new Map() } = {}) {
  const collections = {
    enclosures,
    actuators
  };

  return {
    collection(name) {
      if (!collections[name]) {
        throw new Error(`Unexpected collection ${name}`);
      }
      return createCollection(collections[name]);
    }
  };
}

test('updateActuatorStateFromEsp32 sets actuator state to true and preserves other actuators', async () => {
  const enclosures = new Map([
    ['enc-1', { name: 'Recinto 1' }]
  ]);
  const actuators = new Map([
    ['enc-1', { fan: false, nebulizer: true, heater: false, exhaustor: true }]
  ]);
  const mutations = loadMutationsWithDb(createDb({ enclosures, actuators }));

  const result = await mutations.updateActuatorStateFromEsp32(null, {
    enclosureId: 'enc-1',
    actuatorType: 'fan',
    state: true
  });

  assert.deepEqual(result, {
    success: true,
    message: 'Atuador fan ativado pelo ESP32 com sucesso.'
  });
  assert.deepEqual(actuators.get('enc-1'), {
    enclosureId: 'enc-1',
    fan: true,
    nebulizer: true,
    heater: false,
    exhaustor: true
  });
});

test('updateActuatorStateFromEsp32 sets actuator state to false', async () => {
  const enclosures = new Map([
    ['enc-1', { name: 'Recinto 1' }]
  ]);
  const actuators = new Map([
    ['enc-1', { fan: true, nebulizer: false, heater: false, exhaustor: false }]
  ]);
  const mutations = loadMutationsWithDb(createDb({ enclosures, actuators }));

  const result = await mutations.updateActuatorStateFromEsp32(null, {
    enclosureId: 'enc-1',
    actuatorType: 'fan',
    state: false
  });

  assert.deepEqual(result, {
    success: true,
    message: 'Atuador fan desativado pelo ESP32 com sucesso.'
  });
  assert.deepEqual(actuators.get('enc-1'), {
    enclosureId: 'enc-1',
    fan: false,
    nebulizer: false,
    heater: false,
    exhaustor: false
  });
});

test('updateActuatorStateFromEsp32 creates default actuator document when missing', async () => {
  const enclosures = new Map([
    ['enc-1', { name: 'Recinto 1' }]
  ]);
  const actuators = new Map();
  const mutations = loadMutationsWithDb(createDb({ enclosures, actuators }));

  const result = await mutations.updateActuatorStateFromEsp32(null, {
    enclosureId: 'enc-1',
    actuatorType: 'heater',
    state: true
  });

  assert.equal(result.success, true);
  assert.deepEqual(actuators.get('enc-1'), {
    enclosureId: 'enc-1',
    fan: false,
    nebulizer: false,
    heater: true,
    exhaustor: false
  });
});

test('updateActuatorStateFromEsp32 rejects invalid actuator type', async () => {
  const mutations = loadMutationsWithDb(createDb());

  const result = await mutations.updateActuatorStateFromEsp32(null, {
    enclosureId: 'enc-1',
    actuatorType: 'pump',
    state: true
  });

  assert.deepEqual(result, {
    success: false,
    message: 'Tipo de atuador invalido.'
  });
});

test('updateActuatorStateFromEsp32 rejects missing enclosure', async () => {
  const mutations = loadMutationsWithDb(createDb());

  const result = await mutations.updateActuatorStateFromEsp32(null, {
    enclosureId: 'missing',
    actuatorType: 'fan',
    state: true
  });

  assert.deepEqual(result, {
    success: false,
    message: 'Recinto nao encontrado.'
  });
});

test('Enclosure.actuators resolver prefers actuator document over mapped defaults', async () => {
  const actuators = new Map([
    ['enc-1', { fan: true, nebulizer: false, heater: true, exhaustor: false }]
  ]);
  const resolvers = loadResolversWithDb(createDb({ actuators }));

  const result = await resolvers.Enclosure.actuators({
    id: 'enc-1',
    actuators: { fan: false, nebulizer: false, heater: false, exhaustor: false }
  });

  assert.deepEqual(result, {
    enclosureId: 'enc-1',
    fan: true,
    nebulizer: false,
    heater: true,
    exhaustor: false
  });
});

test('Enclosure.actuators resolver can find actuator document by enclosureId field', async () => {
  const actuators = new Map([
    ['actuator-doc-1', { enclosureId: 'enc-1', fan: false, nebulizer: true, heater: false, exhaustor: true }]
  ]);
  const resolvers = loadResolversWithDb(createDb({ actuators }));

  const result = await resolvers.Enclosure.actuators({ id: 'enc-1' });

  assert.deepEqual(result, {
    enclosureId: 'enc-1',
    fan: false,
    nebulizer: true,
    heater: false,
    exhaustor: true
  });
});
