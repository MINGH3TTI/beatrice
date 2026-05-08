const db = require('../../config/firebase');
const { enclosureMapper } = require('./mapper');

const enclosureQueries = {
  enclosures: async (_, { operatorId }) => {
    try {
      let snapshot;

      if (operatorId) {
        snapshot = await db.collection('enclosures')
          .where('operatorIds', 'array-contains', operatorId)
          .get();
      } else {
        snapshot = await db.collection('enclosures').get();
      }

      return snapshot.docs.map(doc => enclosureMapper(doc));
    } catch (error) {
      console.error('Erro ao buscar recintos:', error);
      throw new Error('Erro ao carregar recintos.');
    }
  },

  enclosure: async (_, { id }) => {
    try {
      const doc = await db.collection('enclosures').doc(id).get();
      if (!doc.exists) {
        throw new Error('Recinto não encontrado.');
      }

      return enclosureMapper(doc);
    } catch (error) {
      console.error('Erro ao buscar recinto:', error);
      throw new Error(error.message || 'Erro ao carregar recinto.');
    }
  }
};

module.exports = enclosureQueries;