const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeExportDateRange,
  buildExportHistoryQuery
} = require('../src/resolvers/variant/export-history');

class QueryMock {
  constructor(operations = []) {
    this.operations = operations;
  }

  where(field, operator, value) {
    return new QueryMock([...this.operations, ['where', field, operator, value]]);
  }

  orderBy(field, direction) {
    return new QueryMock([...this.operations, ['orderBy', field, direction]]);
  }
}

test('normalizeExportDateRange converts dates to UTC ISO strings', () => {
  assert.deepEqual(
    normalizeExportDateRange('2026-06-01T10:00:00-03:00', '2026-06-02T10:00:00-03:00'),
    {
      startDate: '2026-06-01T13:00:00.000Z',
      endDate: '2026-06-02T13:00:00.000Z'
    }
  );
});

test('normalizeExportDateRange rejects invalid dates', () => {
  assert.throws(() => normalizeExportDateRange('not-a-date'), /startDate/);
  assert.throws(() => normalizeExportDateRange(null, 'not-a-date'), /endDate/);
});

test('normalizeExportDateRange rejects inverted ranges', () => {
  assert.throws(
    () => normalizeExportDateRange('2026-06-03T00:00:00.000Z', '2026-06-02T00:00:00.000Z'),
    /startDate/
  );
});

test('buildExportHistoryQuery adds enclosure and date filters in ascending timestamp order', () => {
  const query = buildExportHistoryQuery(new QueryMock(), {
    enclosureId: 'enc-1',
    startDate: '2026-06-01T00:00:00.000Z',
    endDate: '2026-06-02T00:00:00.000Z'
  });

  assert.deepEqual(query.operations, [
    ['where', 'enclosureId', '==', 'enc-1'],
    ['where', 'timestamp', '>=', '2026-06-01T00:00:00.000Z'],
    ['where', 'timestamp', '<=', '2026-06-02T00:00:00.000Z'],
    ['orderBy', 'timestamp', 'asc']
  ]);
});

test('buildExportHistoryQuery supports global export without date filters', () => {
  const query = buildExportHistoryQuery(new QueryMock(), {});

  assert.deepEqual(query.operations, [
    ['orderBy', 'timestamp', 'asc']
  ]);
});
