const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const enclosureQueryPath = path.resolve(__dirname, '../src/resolvers/enclosure/query.js');
const firebasePath = path.resolve(__dirname, '../src/config/firebase.js');

function loadQueriesWithDb(db) {
  delete require.cache[enclosureQueryPath];

  require.cache[firebasePath] = {
    id: firebasePath,
    filename: firebasePath,
    loaded: true,
    exports: db
  };

  return require(enclosureQueryPath);
}

function createDb(enclosures) {
  return {
    collection(name) {
      assert.equal(name, 'enclosures');

      return {
        doc(id) {
          return {
            async get() {
              const data = enclosures.get(id);
              return {
                exists: Boolean(data),
                data: () => data
              };
            }
          };
        }
      };
    }
  };
}

test('enclosureLimits returns normalized limits without auth context', async () => {
  const queries = loadQueriesWithDb(createDb(new Map([
    ['enc-1', {
      limits: {
        tempMin: 18,
        tempMax: 30,
        humidityMin: 40,
        humidityMax: 80,
        noiseLimit: 70
      }
    }]
  ])));

  const limits = await queries.enclosureLimits(null, { id: 'enc-1' });

  assert.deepEqual(limits, {
    tempMin: 18,
    tempMax: 30,
    humidityMin: 40,
    humidityMax: 80,
    noiseMax: 70
  });
});

test('enclosureLimits fails clearly when enclosure does not exist', async () => {
  const queries = loadQueriesWithDb(createDb(new Map()));

  await assert.rejects(
    () => queries.enclosureLimits(null, { id: 'missing' }),
    /Erro ao carregar limites do recinto: Recinto/
  );
});
