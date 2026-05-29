const test = require('node:test');
const assert = require('node:assert/strict');
const { enclosureMapper, calculateStatus } = require('../src/resolvers/enclosure/mapper');
const { variantMapper } = require('../src/resolvers/variant/mapper');

test('variantMapper preserves zero values and maps legacy field names', () => {
  const mapped = variantMapper({
    id: 'variant-1',
    data: () => ({
      enclosureId: 'enc-1',
      temp: 0,
      temperature: 25,
      humidity: 0,
      noise: 0,
      noises: 45,
      luminosity: 0,
      timestamp: '2026-05-26T21:49:38.900Z'
    })
  });

  assert.deepEqual(mapped, {
    id: 'variant-1',
    enclosureId: 'enc-1',
    temp: 0,
    humidity: 0,
    noise: 0,
    luminosity: 0,
    timestamp: '2026-05-26T21:49:38.900Z'
  });
});

test('enclosureMapper returns actuator defaults and calculated status', () => {
  const mapped = enclosureMapper({
    id: 'enc-1',
    data: () => ({
      name: 'Galinheiro',
      speciesId: 'Gallus gallus domesticus',
      lastReadings: { temp: 40, humidity: 60 },
      limits: { tempMin: 18, tempMax: 30, humidityMin: 40, humidityMax: 80 }
    })
  });

  assert.deepEqual(mapped.actuators, { fan: false, nebulizer: false, heater: false, lamp: false });
  assert.equal(mapped.status, 'critical');
});

test('calculateStatus classifies ok, warning, and critical ranges', () => {
  const limits = { tempMin: 18, tempMax: 30, humidityMin: 40, humidityMax: 80 };

  assert.equal(calculateStatus({ temp: 25, humidity: 60 }, limits), 'ok');
  assert.equal(calculateStatus({ temp: 31, humidity: 60 }, limits), 'warning');
  assert.equal(calculateStatus({ temp: 36, humidity: 60 }, limits), 'critical');
});
