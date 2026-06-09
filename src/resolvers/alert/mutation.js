const db = require('../../config/firebase');
const { alertMapper } = require('./mapper');
const { requireAuth, requireAdmin, isAdminRole } = require('../../utils/auth');
const { notifyAlertCreated } = require('../../services/notifications');
const { muteEnclosureAlerts } = require('../../services/alert-rules');

const seedAlertsData = [
  {
    enclosureId: 'rec_01',
    enclosureName: 'Onça Pintada',
    variable: 'Temperatura Alta',
    severity: 'critical',
    timestamp: new Date().toISOString(),
    resolved: false
  }
];

const alertMutations = {
  resolveAlert: async (_, { alertId }, context) => {
    try {
      const user = requireAuth(context);
      const alertRef = db.collection('alerts').doc(alertId);
      const alertDoc = await alertRef.get();

      if (!alertDoc.exists) {
        throw new Error('Alerta não encontrado.');
      }

      if (!isAdminRole(user.role)) {
        const collabDoc = await db.collection('collaborators').doc(user.id).get();
        const assignedEnclosures = collabDoc.exists ? (collabDoc.data().assignedEnclosures || []) : [];
        if (!assignedEnclosures.includes(alertDoc.data().enclosureId)) {
          throw new Error('Acesso negado ao alerta.');
        }
      }

      const resolvedAt = new Date().toISOString();
      const alertData = alertDoc.data();

      await alertRef.update({
        resolved: true,
        resolvedAt,
        resolvedBy: user.id
      });
      await muteEnclosureAlerts(alertData.enclosureId, user.id);

      const updatedDoc = await alertRef.get();
      return alertMapper(updatedDoc);
    } catch (error) {
      console.error('Erro ao resolver alerta:', error);
      throw new Error(error.message);
    }
  },

  createAlert: async (_, { input }, context) => {
    requireAuth(context);

    try {
      const newAlert = {
        ...input,
        timestamp: new Date().toISOString(),
        resolved: false
      };

      const docRef = await db.collection('alerts').add(newAlert);
      const savedDoc = await docRef.get();
      const savedAlert = alertMapper(savedDoc);
      await notifyAlertCreated(savedAlert);

      return savedAlert;
    } catch (error) {
      console.error('Erro ao criar alerta:', error);
      throw new Error('Erro ao criar alerta.');
    }
  },

  seedAlerts: async (_, args, context) => {
    requireAdmin(context);

    try {
      const createdAlerts = [];

      for (const alert of seedAlertsData) {
        const docRef = await db.collection('alerts').add(alert);
        const savedDoc = await docRef.get();
        createdAlerts.push(alertMapper(savedDoc));
      }

      console.log('✅ Seed de alertas criado com sucesso!');
      return createdAlerts;
    } catch (error) {
      console.error('Erro ao criar seed de alertas:', error);
      throw new Error('Erro ao criar seed de alertas.');
    }
  }
};

module.exports = alertMutations;
