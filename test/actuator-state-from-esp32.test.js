const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const enclosureMutationPath = path.resolve(__dirname, '../src/resolvers/enclosure/mutation.js');
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

function createDoc(id, data) {
  return {
    id,
    exists: Boolean(data),
    data: () => data
  };
}

function createCollection(docs) {
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
    ['enc-1', { fan: false, nebulizer: true, heater: false, lamp: true }]
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
    fan: true,
    nebulizer: true,
    heater: false,
    lamp: true
  });
});

test('updateActuatorStateFromEsp32 sets actuator state to false', async () => {
  const enclosures = new Map([
    ['enc-1', { name: 'Recinto 1' }]
  ]);
  const actuators = new Map([
    ['enc-1', { fan: true, nebulizer: false, heater: false, lamp: false }]
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
    fan: false,
    nebulizer: false,
    heater: false,
    lamp: false
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
    fan: false,
    nebulizer: false,
    heater: true,
    lamp: false
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
