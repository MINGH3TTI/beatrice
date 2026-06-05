const db = require('../config/firebase');
const { isAdminRole } = require('../utils/auth');
const { DEFAULT_NOTIFICATION_PREFERENCES } = require('../resolvers/notification/mapper');

async function notifyAlertCreated(alert) {
  try {
    if (!alert || !alert.id) {
      return;
    }

    const recipientIds = await findAlertRecipientIds(alert.enclosureId);
    if (recipientIds.length === 0) {
      return;
    }

    const tokens = await findEnabledTokens(recipientIds);
    if (tokens.length === 0 || typeof db.messaging !== 'function') {
      return;
    }

    const message = {
      tokens,
      notification: {
        title: alert.severity === 'critical' ? 'Alerta critico' : 'Aviso',
        body: `${alert.enclosureName || alert.enclosureId} - ${alert.variable || 'Variavel fora do limite'}`
      },
      data: {
        alertId: String(alert.id),
        enclosureId: String(alert.enclosureId || ''),
        severity: String(alert.severity || 'warning'),
        route: '/tabs/alerts'
      }
    };

    const response = await db.messaging().sendEachForMulticast(message);
    await disableFailedTokens(tokens, response.responses || []);
  } catch (error) {
    console.error('Erro ao enviar notificacao push do alerta:', error);
  }
}

async function findAlertRecipientIds(enclosureId) {
  const snapshot = await db.collection('collaborators').get();

  return snapshot.docs
    .filter(doc => {
      const data = doc.data();
      const preferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...(data.notificationPreferences || {})
      };

      if (preferences.pushEnabled === false) {
        return false;
      }

      return isAdminRole(data.role) || (data.assignedEnclosures || []).includes(enclosureId);
    })
    .map(doc => doc.id);
}

async function findEnabledTokens(userIds) {
  const allowedIds = new Set(userIds);
  const snapshot = await db.collection('pushDevices')
    .where('enabled', '==', true)
    .get();

  return snapshot.docs
    .map(doc => doc.data())
    .filter(device => allowedIds.has(device.userId) && device.token)
    .map(device => device.token);
}

async function disableFailedTokens(tokens, responses) {
  const invalidTokens = tokens.filter((token, index) => {
    const errorCode = responses[index]?.error?.code;
    return errorCode === 'messaging/registration-token-not-registered' ||
      errorCode === 'messaging/invalid-registration-token';
  });

  for (const token of invalidTokens) {
    const snapshot = await db.collection('pushDevices')
      .where('token', '==', token)
      .get();

    for (const doc of snapshot.docs) {
      await db.collection('pushDevices').doc(doc.id).update({
        enabled: false,
        updatedAt: new Date().toISOString()
      });
    }
  }
}

module.exports = {
  notifyAlertCreated,
  findAlertRecipientIds,
  findEnabledTokens
};
