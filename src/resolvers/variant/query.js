const db = require('../../config/firebase');
const { variantMapper } = require('./mapper');

const variantQueries = {
  latestVariants: async (_, { enclosureId, limit = 50 }) => {
    try {
      const snapshot = await db.collection('variants')
        .where('enclosureId', '==', enclosureId)
        .orderBy('timestamp', 'desc')
        .limit(limit)
        .get();

      return snapshot.docs.map(doc => variantMapper(doc));
    } catch (error) {
      console.error("Erro ao buscar variantes:", error);
      throw new Error("Erro ao carregar dados do recinto.");
    }
  },

  enclosureDashboard: async (_, { enclosureId }) => {
    try {
      // Buscar as últimas 100 leituras para o dashboard
      const snapshot = await db.collection('variants')
        .where('enclosureId', '==', enclosureId)
        .orderBy('timestamp', 'desc')
        .limit(100)
        .get();

      const history = snapshot.docs.map(doc => variantMapper(doc));
      
      if (history.length === 0) {
        return { enclosureId, history: [], stats: null };
      }

      const calculateStats = (data, field) => {
        const values = data.map(v => v[field]).filter(v => v !== undefined && v !== null);
        if (values.length === 0) return { min: 0, max: 0, avg: 0 };
        return {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        };
      };

      const stats = {
        temp: calculateStats(history, 'temp'),
        humidity: calculateStats(history, 'humidity'),
        noise: calculateStats(history, 'noise'),
        luminosity: calculateStats(history, 'luminosity')
      };

      return {
        enclosureId,
        history: history.reverse(), // Ordenar cronologicamente para o gráfico
        stats
      };
    } catch (error) {
      console.error("Erro ao gerar dashboard:", error);
      throw new Error("Erro ao carregar dados do dashboard.");
    }
  },

  globalDashboard: async () => {
    try {
      const enclosuresSnapshot = await db.collection('enclosures').get();
      const enclosures = enclosuresSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      const variantsSnapshot = await db.collection('variants')
        .orderBy('timestamp', 'desc')
        .limit(200)
        .get();
      
      const history = variantsSnapshot.docs.map(doc => variantMapper(doc));

      const statusCounts = {
        ok: enclosures.filter(e => e.status === 'ok' || !e.status).length,
        warning: enclosures.filter(e => e.status === 'warning').length,
        critical: enclosures.filter(e => e.status === 'critical').length
      };

      const calculateStats = (data, field) => {
        const values = data.map(v => v[field]).filter(v => v !== undefined && v !== null);
        if (values.length === 0) return { min: 0, max: 0, avg: 0 };
        return {
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length
        };
      };

      const averages = {
        temp: calculateStats(history, 'temp'),
        humidity: calculateStats(history, 'humidity'),
        noise: calculateStats(history, 'noise'),
        luminosity: calculateStats(history, 'luminosity')
      };

      return {
        totalEnclosures: enclosures.length,
        statusCounts,
        averages,
        history: history.reverse()
      };
    } catch (error) {
      console.error("Erro ao gerar global dashboard:", error);
      throw new Error("Erro ao carregar dashboard global.");
    }
  }
};

module.exports = variantQueries;