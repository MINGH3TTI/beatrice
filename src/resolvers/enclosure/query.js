const db = require('../../config/firebase');
const { enclosureMapper, normalizeLimits } = require('./mapper');
const { requireAuth, isAdminRole } = require('../../utils/auth');

const enclosureQueries = {
  enclosures: async (_, { operatorId }, context) => {
    try {
      const user = requireAuth(context);
      let snapshot;

      if (isAdminRole(user.role) && operatorId) {
        snapshot = await db.collection('enclosures')
          .where('operatorIds', 'array-contains', operatorId)
          .get();
      } else if (isAdminRole(user.role)) {
        snapshot = await db.collection('enclosures').get();
      } else {
        const collabDoc = await db.collection('collaborators').doc(user.id).get();
        const assignedEnclosures = collabDoc.exists ? (collabDoc.data().assignedEnclosures || []) : [];

        if (assignedEnclosures.length > 0) {
          const enclosures = [];
          for (const enclosureId of assignedEnclosures) {
            const enclosureDoc = await db.collection('enclosures').doc(enclosureId).get();
            if (enclosureDoc.exists) {
              enclosures.push(enclosureMapper(enclosureDoc));
            }
          }
          return enclosures;
        }

        snapshot = await db.collection('enclosures')
          .where('operatorIds', 'array-contains', user.id)
          .get();
      }

      return snapshot.docs.map(doc => enclosureMapper(doc));
    } catch (error) {
      console.error('Erro detalhado ao buscar recintos:', error);
      throw new Error(`Erro ao carregar recintos: ${error.message}`);
    }
  },

  enclosure: async (_, { id }, context) => {
    try {
      const user = requireAuth(context);
      const doc = await db.collection('enclosures').doc(id).get();
      if (!doc.exists) {
        throw new Error('Recinto não encontrado.');
      }

      const enclosure = enclosureMapper(doc);
      const collabDoc = await db.collection('collaborators').doc(user.id).get();
      const assignedEnclosures = collabDoc.exists ? (collabDoc.data().assignedEnclosures || []) : [];

      if (!isAdminRole(user.role) && !enclosure.operatorIds.includes(user.id) && !assignedEnclosures.includes(id)) {
        throw new Error('Acesso negado.');
      }

      return enclosure;
    } catch (error) {
      console.error('Erro detalhado ao buscar recinto:', error);
      throw new Error(`Erro ao carregar recinto: ${error.message}`);
    }
  },

  enclosureLimits: async (_, { id }) => {
    try {
      const doc = await db.collection('enclosures').doc(id).get();
      if (!doc.exists) {
        throw new Error('Recinto nÃ£o encontrado.');
      }

      return normalizeLimits(doc.data().limits);
    } catch (error) {
      console.error('Erro detalhado ao buscar limites do recinto:', error);
      throw new Error(`Erro ao carregar limites do recinto: ${error.message}`);
    }
  }
};

module.exports = enclosureQueries;
