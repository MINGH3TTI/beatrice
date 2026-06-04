const db = require('../../config/firebase');
const { variantMapper } = require('./mapper');
const { ExportHistoryValidationError, buildExportHistoryQuery } = require('./export-history');
const { requireAuth, isAdminRole } = require('../../utils/auth');

const DEFAULT_HISTORY_LIMIT = 100;
const DEFAULT_GLOBAL_HISTORY_LIMIT = 200;
const MAX_HISTORY_LIMIT = 500;

function normalizeLimit(limit, fallback = DEFAULT_HISTORY_LIMIT) {
  const parsed = Number(limit);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.min(Math.floor(parsed), MAX_HISTORY_LIMIT);
}

function calculateStats(data, field) {
  const values = data.map(v => v[field]).filter(v => v !== undefined && v !== null);
  if (values.length === 0) return { min: 0, max: 0, avg: 0 };
  return {
    min: Math.min(...values),
    max: Math.max(...values),
    avg: values.reduce((a, b) => a + b, 0) / values.length
  };
}

function buildDashboardStats(history) {
  return {
    temp: calculateStats(history, 'temp'),
    humidity: calculateStats(history, 'humidity'),
    noise: calculateStats(history, 'noise'),
    luminosity: calculateStats(history, 'luminosity')
  };
}

async function canAccessEnclosure(user, enclosureId) {
  if (isAdminRole(user.role)) return true;

  const collabDoc = await db.collection('collaborators').doc(user.id).get();
  const assignedEnclosures = collabDoc.exists ? (collabDoc.data().assignedEnclosures || []) : [];
  return assignedEnclosures.includes(enclosureId);
}

async function getAllowedEnclosureIds(user) {
  if (isAdminRole(user.role)) return null;

  const collabDoc = await db.collection('collaborators').doc(user.id).get();
  return collabDoc.exists ? (collabDoc.data().assignedEnclosures || []) : [];
}

const variantQueries = {
  latestVariants: async (_, { enclosureId, limit = 50 }, context) => {
    try {
      const user = requireAuth(context);
      if (!await canAccessEnclosure(user, enclosureId)) {
        throw new Error('Acesso negado ao recinto.');
      }

      const snapshot = await db.collection('variants')
        .where('enclosureId', '==', enclosureId)
        .orderBy('timestamp', 'desc')
        .limit(normalizeLimit(limit, 50))
        .get();

      return snapshot.docs.map(doc => variantMapper(doc));
    } catch (error) {
      console.error("Erro ao buscar variantes:", error);
      throw new Error("Erro ao carregar dados do recinto.");
    }
  },

  enclosureDashboard: async (_, { enclosureId, historyLimit = DEFAULT_HISTORY_LIMIT }, context) => {
    try {
      const user = requireAuth(context);
      if (!await canAccessEnclosure(user, enclosureId)) {
        throw new Error('Acesso negado ao recinto.');
      }

      const limit = normalizeLimit(historyLimit);
      const snapshot = await db.collection('variants')
        .where('enclosureId', '==', enclosureId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      const history = snapshot.docs.map(doc => variantMapper(doc));
      
      if (history.length === 0) {
        return { enclosureId, latestReading: null, history: [], stats: null };
      }

      return {
        enclosureId,
        latestReading: history[0],
        history: history.reverse(), // Ordenar cronologicamente para o gráfico
        stats: buildDashboardStats(history)
      };
    } catch (error) {
      console.error("Erro ao gerar dashboard:", error);
      throw new Error("Erro ao carregar dados do dashboard.");
    }
  },

  enclosureHistory: async (_, { enclosureId, limit = DEFAULT_HISTORY_LIMIT, cursor }, context) => {
    try {
      const user = requireAuth(context);
      if (!await canAccessEnclosure(user, enclosureId)) {
        throw new Error('Acesso negado ao recinto.');
      }

      const pageSize = normalizeLimit(limit);
      let query = db.collection('variants')
        .where('enclosureId', '==', enclosureId)
        .orderBy('timestamp', 'desc');

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const snapshot = await query.limit(pageSize + 1).get();
      const docs = snapshot.docs.slice(0, pageSize);
      const items = docs.map(doc => variantMapper(doc));
      const lastItem = items[items.length - 1];

      return {
        items,
        nextCursor: snapshot.docs.length > pageSize && lastItem ? lastItem.timestamp : null,
        hasMore: snapshot.docs.length > pageSize
      };
    } catch (error) {
      console.error("Erro ao buscar histórico paginado:", error);
      throw new Error("Erro ao carregar histórico do recinto.");
    }
  },

  globalHistory: async (_, { limit = DEFAULT_HISTORY_LIMIT, cursor }, context) => {
    try {
      const user = requireAuth(context);
      const allowedIds = await getAllowedEnclosureIds(user);
      const pageSize = normalizeLimit(limit);

      let query = db.collection('variants')
        .orderBy('timestamp', 'desc');

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const snapshot = await query.limit(pageSize + 1).get();
      const docs = snapshot.docs.slice(0, pageSize);
      const items = docs
        .map(doc => variantMapper(doc))
        .filter(variant => !allowedIds || allowedIds.includes(variant.enclosureId));
      const lastDoc = docs[docs.length - 1];
      const lastVariant = lastDoc ? variantMapper(lastDoc) : null;

      return {
        items,
        nextCursor: snapshot.docs.length > pageSize && lastVariant ? lastVariant.timestamp : null,
        hasMore: snapshot.docs.length > pageSize
      };
    } catch (error) {
      console.error("Erro ao buscar histórico global paginado:", error);
      throw new Error("Erro ao carregar histórico global.");
    }
  },

  globalDashboard: async (_, { historyLimit = DEFAULT_GLOBAL_HISTORY_LIMIT }, context) => {
    try {
      const user = requireAuth(context);
      const enclosuresSnapshot = await db.collection('enclosures').get();
      let enclosures = enclosuresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (!isAdminRole(user.role)) {
        const collabDoc = await db.collection('collaborators').doc(user.id).get();
        const assignedEnclosures = collabDoc.exists ? (collabDoc.data().assignedEnclosures || []) : [];
        enclosures = enclosures.filter(enclosure => assignedEnclosures.includes(enclosure.id));
      }

      const variantsSnapshot = await db.collection('variants')
        .orderBy('timestamp', 'desc')
        .limit(normalizeLimit(historyLimit, DEFAULT_GLOBAL_HISTORY_LIMIT))
        .get();
      
      const allowedIds = new Set(enclosures.map(enclosure => enclosure.id));
      const history = variantsSnapshot.docs
        .map(doc => variantMapper(doc))
        .filter(variant => isAdminRole(user.role) || allowedIds.has(variant.enclosureId));

      const statusCounts = {
        ok: enclosures.filter(e => e.status === 'ok' || !e.status).length,
        warning: enclosures.filter(e => e.status === 'warning').length,
        critical: enclosures.filter(e => e.status === 'critical').length
      };

      return {
        totalEnclosures: enclosures.length,
        statusCounts,
        averages: buildDashboardStats(history),
        history: history.reverse()
      };
    } catch (error) {
      console.error("Erro ao gerar global dashboard:", error);
      throw new Error("Erro ao carregar dashboard global.");
    }
  },

  exportHistory: async (_, { enclosureId, startDate, endDate, limit }, context) => {
    try {
      const user = requireAuth(context);
      const allowedIds = await getAllowedEnclosureIds(user);

      if (enclosureId && !await canAccessEnclosure(user, enclosureId)) {
        throw new Error('Acesso negado ao recinto.');
      }

      let query = buildExportHistoryQuery(db.collection('variants'), { enclosureId, startDate, endDate });
      if (limit !== undefined && limit !== null) {
        query = query.limit(normalizeLimit(limit, MAX_HISTORY_LIMIT));
      }

      const snapshot = await query.get();
      const enclosureNames = await getEnclosureNames();

      return snapshot.docs
        .map(doc => variantMapper(doc))
        .filter(variant => !allowedIds || allowedIds.includes(variant.enclosureId))
        .map(variant => ({
          ...variant,
          enclosureName: enclosureNames.get(variant.enclosureId) || variant.enclosureId
        }));
    } catch (error) {
      console.error('Erro ao exportar historico:', error);
      if (error instanceof ExportHistoryValidationError) {
        throw error;
      }
      throw new Error('Erro ao exportar historico.');
    }
  }
};

async function getEnclosureNames() {
  const snapshot = await db.collection('enclosures').get();
  return new Map(snapshot.docs.map(doc => {
    const data = doc.data();
    return [doc.id, data.name || doc.id];
  }));
}

module.exports = variantQueries;
