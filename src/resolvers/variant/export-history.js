class ExportHistoryValidationError extends Error {}

function parseIsoDate(value, fieldName) {
  if (!value) return null;

  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new ExportHistoryValidationError(`${fieldName} deve ser uma data ISO valida.`);
  }

  return date.toISOString();
}

function normalizeExportDateRange(startDate, endDate) {
  const normalizedStartDate = parseIsoDate(startDate, 'startDate');
  const normalizedEndDate = parseIsoDate(endDate, 'endDate');

  if (normalizedStartDate && normalizedEndDate && normalizedStartDate > normalizedEndDate) {
    throw new ExportHistoryValidationError('startDate nao pode ser maior que endDate.');
  }

  return {
    startDate: normalizedStartDate,
    endDate: normalizedEndDate
  };
}

function buildExportHistoryQuery(collection, { enclosureId, startDate, endDate }) {
  const range = normalizeExportDateRange(startDate, endDate);
  let query = collection;

  if (enclosureId) {
    query = query.where('enclosureId', '==', enclosureId);
  }

  if (range.startDate) {
    query = query.where('timestamp', '>=', range.startDate);
  }

  if (range.endDate) {
    query = query.where('timestamp', '<=', range.endDate);
  }

  return query.orderBy('timestamp', 'asc');
}

module.exports = {
  ExportHistoryValidationError,
  parseIsoDate,
  normalizeExportDateRange,
  buildExportHistoryQuery
};
