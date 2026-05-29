const db = require('../../config/firebase');
const { alertMapper } = require('./mapper');
const { requireAuth, isAdminRole } = require('../../utils/auth');

async function getAllowedEnclosureIds(user) {
  if (isAdminRole(user.role)) return null;

  const collabDoc = await db.collection('collaborators').doc(user.id).get();
  return collabDoc.exists ? (collabDoc.data().assignedEnclosures || []) : [];
}

const alertQueries = {
  alerts: async (_, { enclosureId }, context) => {
    try {
      const user = requireAuth(context);
      const allowedIds = await getAllowedEnclosureIds(user);

      if (allowedIds && enclosureId && !allowedIds.includes(enclosureId)) {
        throw new Error('Acesso negado ao recinto.');
      }

      let query = db.collection('alerts').orderBy('timestamp', 'desc');

      if (enclosureId) {
        query = query.where('enclosureId', '==', enclosureId);
      }

      const snapshot = await query.get();
      return snapshot.docs
        .map(doc => alertMapper(doc))
        .filter(alert => !allowedIds || allowedIds.includes(alert.enclosureId));
    } catch (error) {
      console.error('Erro ao buscar alertas:', error);
      throw new Error('Erro ao carregar alertas.');
    }
  },

  activeAlerts: async (_, args, context) => {
    try {
      const user = requireAuth(context);
      const allowedIds = await getAllowedEnclosureIds(user);

      const snapshot = await db.collection('alerts')
        .where('resolved', '==', false)
        .orderBy('timestamp', 'desc')
        .get();

      return snapshot.docs
        .map(doc => alertMapper(doc))
        .filter(alert => !allowedIds || allowedIds.includes(alert.enclosureId));
    } catch (error) {
      console.error('Erro ao buscar alertas ativos:', error);
      throw new Error('Erro ao carregar alertas ativos.');
    }
  }
};

module.exports = alertQueries;
