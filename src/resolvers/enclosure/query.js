const db = require('../../config/firebase');
const { enclosureMapper } = require('./mapper');

const enclosureQueries = {
  enclosures: async () => {
    try {
      const snapshot = await db.collection('enclosures').get();
      const enclosures = [];

      for (const doc of snapshot.docs) {
        const enclosure = enclosureMapper(doc);

        const actuatorsDoc = await db.collection('actuators').doc(doc.id).get();
        if (actuatorsDoc.exists) {
          enclosure.actuators = actuatorsDoc.data();
        }

        const variantsSnapshot = await db.collection('variants')
          .where('enclosureId', '==', doc.id)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (!variantsSnapshot.empty) {
          const variant = variantsSnapshot.docs[0].data();
          enclosure.lastReadings = {
            temp: variant.temperature,
            humidity: variant.humidity,
            luminosity: variant.luminosity,
            noise: variant.noises,
            timestamp: variant.timestamp
          };
        }

        if (enclosure.limits && enclosure.lastReadings) {
          enclosure.status = require('./mapper').calculateStatus(
            enclosure.lastReadings,
            enclosure.limits
          );
        }

        enclosures.push(enclosure);
      }

      return enclosures;
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

      const enclosure = enclosureMapper(doc);

      const actuatorsDoc = await db.collection('actuators').doc(id).get();
      if (actuatorsDoc.exists) {
        enclosure.actuators = actuatorsDoc.data();
      }

      const variantsSnapshot = await db.collection('variants')
        .where('enclosureId', '==', id)
        .orderBy('timestamp', 'desc')
        .limit(1)
        .get();

      if (!variantsSnapshot.empty) {
        const variant = variantsSnapshot.docs[0].data();
        enclosure.lastReadings = {
          temp: variant.temperature,
          humidity: variant.humidity,
          luminosity: variant.luminosity,
          noise: variant.noises,
          timestamp: variant.timestamp
        };
      }

      if (enclosure.limits && enclosure.lastReadings) {
        enclosure.status = require('./mapper').calculateStatus(
          enclosure.lastReadings,
          enclosure.limits
        );
      }

      return enclosure;
    } catch (error) {
      console.error('Erro ao buscar recinto:', error);
      throw new Error(error.message);
    }
  }
};

module.exports = enclosureQueries;