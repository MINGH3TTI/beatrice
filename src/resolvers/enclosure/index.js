const enclosureQueries = require('./query');
const enclosureMutations = require('./mutation');
const db = require('../../config/firebase');
const { calculateStatus } = require('./mapper');

const enclosureResolvers = {
  Query: enclosureQueries,
  Mutation: enclosureMutations,
  Enclosure: {
    actuators: async (enclosure) => {
      try {
        const actuatorsDoc = await db.collection('actuators').doc(enclosure.id).get();
        return actuatorsDoc.exists ? actuatorsDoc.data() : { fan: false, nebulizer: false, heater: false, lamp: false };
      } catch (error) {
        console.error(`Erro ao buscar atuadores para o recinto ${enclosure.id}:`, error);
        return null;
      }
    },
    lastReadings: async (enclosure) => {
      try {
        const variantsSnapshot = await db.collection('variants')
          .where('enclosureId', '==', enclosure.id)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (variantsSnapshot.empty) return null;

        const variant = variantsSnapshot.docs[0].data();
        return {
          temp: variant.temperature,
          humidity: variant.humidity,
          luminosity: variant.luminosity,
          noise: variant.noises,
          timestamp: variant.timestamp
        };
      } catch (error) {
        console.error(`Erro ao buscar leituras para o recinto ${enclosure.id}:`, error);
        return null;
      }
    },
    status: async (enclosure, _, { lastReadings: cachedReadings }) => {
      // Se lastReadings já foi resolvido no mesmo objeto, podemos usar. 
      // Mas o Apollo resolve campos independentemente a menos que usemos um cache ou DataLoader.
      // Para simplificar agora, vamos apenas garantir que ele use os dados do próprio enclosure se existirem
      // ou se lastReadings for solicitado, ele será resolvido pelo resolver de lastReadings.
      
      // No entanto, o status depende de lastReadings e limits.
      // Vamos buscar as leituras se elas não estiverem presentes.
      let readings = enclosure.lastReadings;
      
      if (!readings) {
        const variantsSnapshot = await db.collection('variants')
          .where('enclosureId', '==', enclosure.id)
          .orderBy('timestamp', 'desc')
          .limit(1)
          .get();

        if (!variantsSnapshot.empty) {
          const variant = variantsSnapshot.docs[0].data();
          readings = {
            temp: variant.temperature,
            humidity: variant.humidity,
          };
        }
      }

      if (readings && enclosure.limits) {
        return calculateStatus(readings, enclosure.limits);
      }
      
      return enclosure.status || 'ok';
    }
  }
};

module.exports = enclosureResolvers;