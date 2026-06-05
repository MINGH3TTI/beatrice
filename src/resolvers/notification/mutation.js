const db = require('../../config/firebase');
const { requireAuth } = require('../../utils/auth');
const { notificationPreferencesMapper, pushDeviceMapper } = require('./mapper');

const notificationMutations = {
  updateNotificationPreferences: async (_, { input }, context) => {
    const user = requireAuth(context);

    try {
      const collabRef = db.collection('collaborators').doc(user.id);
      const collabDoc = await collabRef.get();
      const current = notificationPreferencesMapper(collabDoc.exists ? collabDoc.data() : {});
      const next = {
        ...current,
        ...Object.fromEntries(
          Object.entries(input || {}).filter(([, value]) => typeof value === 'boolean')
        )
      };

      await collabRef.update({
        notificationPreferences: next,
        updatedAt: new Date().toISOString()
      });

      return next;
    } catch (error) {
      console.error('Erro ao atualizar preferencias de notificacao:', error);
      throw new Error('Erro ao salvar preferencias de notificacao.');
    }
  },

  registerPushDevice: async (_, { token, platform }, context) => {
    const user = requireAuth(context);

    if (!token || !String(token).trim()) {
      throw new Error('Token de dispositivo invalido.');
    }

    try {
      const now = new Date().toISOString();
      const normalizedToken = String(token).trim();
      const snapshot = await db.collection('pushDevices')
        .where('token', '==', normalizedToken)
        .limit(1)
        .get();

      const payload = {
        userId: user.id,
        token: normalizedToken,
        platform: platform || 'unknown',
        enabled: true,
        updatedAt: now,
        lastSeenAt: now
      };

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        await db.collection('pushDevices').doc(doc.id).update(payload);
        const updatedDoc = await db.collection('pushDevices').doc(doc.id).get();
        return pushDeviceMapper(updatedDoc);
      }

      const docRef = await db.collection('pushDevices').add({
        ...payload,
        createdAt: now
      });
      const savedDoc = await docRef.get();
      return pushDeviceMapper(savedDoc);
    } catch (error) {
      console.error('Erro ao registrar dispositivo push:', error);
      throw new Error('Erro ao registrar dispositivo push.');
    }
  },

  unregisterPushDevice: async (_, { token }, context) => {
    const user = requireAuth(context);

    try {
      const snapshot = await db.collection('pushDevices')
        .where('token', '==', token)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return true;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      if (data.userId !== user.id) {
        throw new Error('Acesso negado ao dispositivo push.');
      }

      await db.collection('pushDevices').doc(doc.id).update({
        enabled: false,
        updatedAt: new Date().toISOString()
      });

      return true;
    } catch (error) {
      console.error('Erro ao desregistrar dispositivo push:', error);
      throw new Error(error.message || 'Erro ao desregistrar dispositivo push.');
    }
  }
};

module.exports = notificationMutations;
