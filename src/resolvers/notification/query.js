const db = require('../../config/firebase');
const { requireAuth } = require('../../utils/auth');
const { notificationPreferencesMapper } = require('./mapper');

const notificationQueries = {
  notificationPreferences: async (_, args, context) => {
    const user = requireAuth(context);

    try {
      const doc = await db.collection('collaborators').doc(user.id).get();
      return notificationPreferencesMapper(doc.exists ? doc.data() : {});
    } catch (error) {
      console.error('Erro ao buscar preferencias de notificacao:', error);
      throw new Error('Erro ao carregar preferencias de notificacao.');
    }
  }
};

module.exports = notificationQueries;
