const enclosureQueries = require('./query');
const enclosureMutations = require('./mutation');
const db = require('../../config/firebase');
const { calculateStatus } = require('./mapper');
const { variantMapper } = require('../variant/mapper');

const DEFAULT_ACTUATORS = { fan: false, nebulizer: false, heater: false, lamp: false };

const enclosureResolvers = {
  Query: enclosureQueries,
  Mutation: enclosureMutations,
  Enclosure: {
    actuators: async (enclosure) => {
      try {
        const actuatorsDoc = await db.collection('actuators').doc(enclosure.id).get();
        if (actuatorsDoc.exists) {
          return normalizeActuators(enclosure.id, actuatorsDoc.data());
        }

        const actuatorsSnapshot = await db.collection('actuators')
          .where('enclosureId', '==', enclosure.id)
          .limit(1)
          .get();

        if (!actuatorsSnapshot.empty) {
          return normalizeActuators(enclosure.id, actuatorsSnapshot.docs[0].data());
        }
      } catch (error) {
        console.error(`Erro ao buscar atuadores para o recinto ${enclosure.id}:`, error);
      }

      return normalizeActuators(enclosure.id, enclosure.actuators);
    },
    lastReadings: async (enclosure) => {
      if (enclosure.lastReadings) return enclosure.lastReadings;

      try {
        const variantsSnapshot = await db.collection('variants')
          .where('enclosureId', '==', enclosure.id)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (variantsSnapshot.empty) return null;

        return variantMapper(variantsSnapshot.docs[0]);
      } catch (error) {
        console.error(`Erro ao buscar leituras para o recinto ${enclosure.id}:`, error);
        return null;
      }
    },
    status: async (enclosure) => {
      let readings = enclosure.lastReadings;
      
      if (!readings) {
        const variantsSnapshot = await db.collection('variants')
          .where('enclosureId', '==', enclosure.id)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (!variantsSnapshot.empty) {
          readings = variantMapper(variantsSnapshot.docs[0]);
        }
      }

      if (readings && enclosure.limits) {
        return calculateStatus(readings, enclosure.limits);
      }
      
      return enclosure.status || 'ok';
    }
  }
};

function normalizeActuators(enclosureId, actuators) {
  return {
    enclosureId,
    ...DEFAULT_ACTUATORS,
    ...(actuators || {})
  };
}

module.exports = enclosureResolvers;
