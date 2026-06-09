const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const notificationMutationPath = path.resolve(__dirname, '../src/resolvers/notification/mutation.js');
const notificationQueryPath = path.resolve(__dirname, '../src/resolvers/notification/query.js');
const alertMutationPath = path.resolve(__dirname, '../src/resolvers/alert/mutation.js');
const variantMutationPath = path.resolve(__dirname, '../src/resolvers/variant/mutation.js');
const notificationsServicePath = path.resolve(__dirname, '../src/services/notifications.js');
const alertRulesServicePath = path.resolve(__dirname, '../src/services/alert-rules.js');
const firebasePath = path.resolve(__dirname, '../src/config/firebase.js');

function loadModuleWithDb(modulePath, db) {
  for (const pathToClear of [
    modulePath,
    notificationMutationPath,
    notificationQueryPath,
    alertMutationPath,
    variantMutationPath,
    notificationsServicePath,
    alertRulesServicePath
  ]) {
    delete require.cache[pathToClear];
  }

  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: db
  };

  return require(modulePath);
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
    orderBy() {
      return createQuery(filters, max);
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
        async update(updateData) {
          const current = docs.get(id);
          if (!current) {
            throw new Error('not-found');
          }
          docs.set(id, { ...current, ...updateData });
        },
        async set(data) {
          docs.set(id, data);
        }
      };
    },
    async add(data) {
      const id = `generated-${docs.size + 1}`;
      docs.set(id, data);
      return {
        id,
        async get() {
          return createDoc(id, docs.get(id));
        }
      };
    },
    where(field, operator, value) {
      return createQuery().where(field, operator, value);
    },
    orderBy(field, direction) {
      return createQuery().orderBy(field, direction);
    },
    get: createQuery().get
  };
}

function createDb({
  collaborators = new Map(),
  pushDevices = new Map(),
  alerts = new Map(),
  alertCooldowns = new Map(),
  variants = new Map(),
  enclosures = new Map(),
  sentMessages = []
} = {}) {
  const collections = {
    collaborators,
    pushDevices,
    alerts,
    alertCooldowns,
    variants,
    enclosures
  };

  const db = {
    collection(name) {
      if (!collections[name]) {
        throw new Error(`Unexpected collection ${name}`);
      }
      return createCollection(collections[name]);
    },
    messaging() {
      return {
        async sendEachForMulticast(message) {
          sentMessages.push(message);
          return {
            responses: message.tokens.map(() => ({ success: true }))
          };
        }
      };
    }
  };

  return db;
}

function context(user = { id: 'collab-1', role: 'operator' }) {
  return { currentUser: user };
}

test('notificationPreferences returns defaults when collaborator has no saved preferences', async () => {
  const collaborators = new Map([
    ['collab-1', { email: 'user@example.com', role: 'operator' }]
  ]);
  const queries = loadModuleWithDb(notificationQueryPath, createDb({ collaborators }));

  const result = await queries.notificationPreferences(null, {}, context());

  assert.equal(result.pushEnabled, true);
  assert.equal(result.criticalVibrationEnabled, true);
});

test('updateNotificationPreferences saves preferences on current collaborator', async () => {
  const collaborators = new Map([
    ['collab-1', { email: 'user@example.com', role: 'operator' }]
  ]);
  const mutations = loadModuleWithDb(notificationMutationPath, createDb({ collaborators }));

  const result = await mutations.updateNotificationPreferences(
    null,
    { input: { pushEnabled: false } },
    context()
  );

  assert.equal(result.pushEnabled, false);
  assert.equal(result.criticalVibrationEnabled, true);
  assert.equal(collaborators.get('collab-1').notificationPreferences.pushEnabled, false);
});

test('registerPushDevice upserts token and binds it to current user', async () => {
  const pushDevices = new Map([
    ['device-1', { userId: 'old-user', token: 'abc', platform: 'android', enabled: false }]
  ]);
  const mutations = loadModuleWithDb(notificationMutationPath, createDb({ pushDevices }));

  const result = await mutations.registerPushDevice(
    null,
    { token: 'abc', platform: 'android' },
    context()
  );

  assert.equal(result.id, 'device-1');
  assert.equal(pushDevices.get('device-1').userId, 'collab-1');
  assert.equal(pushDevices.get('device-1').enabled, true);
});

test('unregisterPushDevice rejects token owned by another user', async () => {
  const pushDevices = new Map([
    ['device-1', { userId: 'other-user', token: 'abc', platform: 'android', enabled: true }]
  ]);
  const mutations = loadModuleWithDb(notificationMutationPath, createDb({ pushDevices }));

  await assert.rejects(
    () => mutations.unregisterPushDevice(null, { token: 'abc' }, context()),
    /Acesso negado/
  );
  assert.equal(pushDevices.get('device-1').enabled, true);
});

test('createAlert sends FCM to admins and collaborators assigned to enclosure', async () => {
  const sentMessages = [];
  const collaborators = new Map([
    ['admin-1', { role: 'ADMIN', notificationPreferences: { pushEnabled: true } }],
    ['collab-1', { role: 'operator', assignedEnclosures: ['rec-1'] }],
    ['collab-2', { role: 'operator', assignedEnclosures: ['rec-2'] }]
  ]);
  const pushDevices = new Map([
    ['device-1', { userId: 'admin-1', token: 'admin-token', enabled: true }],
    ['device-2', { userId: 'collab-1', token: 'collab-token', enabled: true }],
    ['device-3', { userId: 'collab-2', token: 'other-token', enabled: true }]
  ]);
  const mutations = loadModuleWithDb(alertMutationPath, createDb({
    collaborators,
    pushDevices,
    alerts: new Map(),
    sentMessages
  }));

  await mutations.createAlert(null, {
    input: {
      enclosureId: 'rec-1',
      enclosureName: 'Recinto 1',
      variable: 'Temperatura',
      severity: 'critical'
    }
  }, context());

  assert.equal(sentMessages.length, 1);
  assert.deepEqual(sentMessages[0].tokens.sort(), ['admin-token', 'collab-token']);
});

test('resolveAlert mutes new alerts for the enclosure for five minutes', async () => {
  const alerts = new Map([
    ['alert-1', {
      enclosureId: 'rec-1',
      enclosureName: 'Recinto 1',
      variable: 'Temperatura',
      severity: 'critical',
      timestamp: '2026-06-09T10:00:00.000Z',
      resolved: false
    }]
  ]);
  const alertCooldowns = new Map();
  const mutations = loadModuleWithDb(alertMutationPath, createDb({
    alerts,
    alertCooldowns
  }));

  const result = await mutations.resolveAlert(null, { alertId: 'alert-1' }, context({ id: 'admin-1', role: 'ADMIN' }));

  assert.equal(result.resolved, true);
  assert.equal(alerts.get('alert-1').resolvedBy, 'admin-1');
  assert.ok(alerts.get('alert-1').resolvedAt);
  assert.equal(alertCooldowns.get('rec-1').enclosureId, 'rec-1');
  assert.equal(alertCooldowns.get('rec-1').updatedBy, 'admin-1');
  assert.ok(new Date(alertCooldowns.get('rec-1').mutedUntil).getTime() > Date.now());
});

test('createVariant creates one alert for out-of-limit reading without duplicating active equivalent', async () => {
  const sentMessages = [];
  const enclosures = new Map([
    ['rec-1', {
      name: 'Recinto 1',
      limits: {
        tempMin: 10,
        tempMax: 30,
        humidityMin: 40,
        humidityMax: 80,
        noiseMax: 70
      }
    }]
  ]);
  const alerts = new Map();
  const mutations = loadModuleWithDb(variantMutationPath, createDb({
    enclosures,
    alerts,
    variants: new Map(),
    collaborators: new Map(),
    pushDevices: new Map(),
    sentMessages
  }));

  const args = {
    input: {
      enclosureId: 'rec-1',
      temp: 40,
      humidity: 60,
      noise: 50,
      luminosity: 500
    }
  };

  await mutations.createVariant(null, args);
  await mutations.createVariant(null, args);

  assert.equal(alerts.size, 1);
  const alert = [...alerts.values()][0];
  assert.equal(alert.variable, 'Temperatura');
  assert.equal(alert.severity, 'critical');
});

test('createVariant does not create or notify alerts while enclosure is muted', async () => {
  const sentMessages = [];
  const enclosures = new Map([
    ['rec-1', {
      name: 'Recinto 1',
      limits: {
        tempMin: 10,
        tempMax: 30,
        humidityMin: 40,
        humidityMax: 80,
        noiseMax: 70
      }
    }]
  ]);
  const alerts = new Map();
  const mutations = loadModuleWithDb(variantMutationPath, createDb({
    enclosures,
    alerts,
    alertCooldowns: new Map([
      ['rec-1', {
        enclosureId: 'rec-1',
        mutedUntil: '2999-01-01T00:00:00.000Z'
      }]
    ]),
    variants: new Map(),
    collaborators: new Map(),
    pushDevices: new Map(),
    sentMessages
  }));

  await mutations.createVariant(null, {
    input: {
      enclosureId: 'rec-1',
      temp: 40,
      humidity: 60,
      noise: 50,
      luminosity: 500
    }
  });

  assert.equal(alerts.size, 0);
  assert.equal(sentMessages.length, 0);
});
