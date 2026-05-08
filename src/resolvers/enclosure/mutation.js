const db = require('../../config/firebase');
const { enclosureMapper } = require('./mapper');

const seedEnclosuresData = [
  {
    id: 'rec_01',
    name: 'Onça Pintada',
    speciesId: 'Panthera onca',
    photoUrl: 'https://images.unsplash.com/photo-1546182990-dffeafbe841d?auto=format&fit=crop&q=80&w=400',
    limits: {
      tempMin: 22,
      tempMax: 30,
      humidityMin: 60,
      humidityMax: 85
    },
    lastReadings: {
      temp: 32,
      humidity: 80,
      luminosity: 400,
      noise: 50,
      timestamp: new Date().toISOString()
    },
    status: 'warning'
  },
  {
    id: 'rec_02',
    name: 'Arara Azul',
    speciesId: 'Anodorhynchus',
    photoUrl: 'https://images.unsplash.com/photo-1552728089-57bdde30beb3?auto=format&fit=crop&q=80&w=400',
    limits: {
      tempMin: 20,
      tempMax: 28,
      humidityMin: 50,
      humidityMax: 70
    },
    lastReadings: {
      temp: 26,
      humidity: 65,
      luminosity: 800,
      noise: 40,
      timestamp: new Date().toISOString()
    },
    status: 'ok'
  }
];

const seedActuatorsData = {
  rec_01: { fan: false, nebulizer: true, heater: false, lamp: true },
  rec_02: { fan: true, nebulizer: false, heater: false, lamp: true }
};

const enclosureMutations = {
  toggleActuator: async (_, { enclosureId, actuatorType, state }) => {
    try {
      const validActuators = ['fan', 'nebulizer', 'heater', 'lamp'];
      if (!validActuators.includes(actuatorType)) {
        return { success: false, message: 'Tipo de atuador inválido.' };
      }

      const actuatorsRef = db.collection('actuators').doc(enclosureId);
      const actuatorsDoc = await actuatorsRef.get();

      let currentActuators = { fan: false, nebulizer: false, heater: false, lamp: false };
      if (actuatorsDoc.exists) {
        currentActuators = actuatorsDoc.data();
      }

      currentActuators[actuatorType] = state;
      await actuatorsRef.set(currentActuators);

      return { success: true, message: `Atuador ${actuatorType} ${state ? 'ativado' : 'desativado'} com sucesso.` };
    } catch (error) {
      console.error('Erro ao togglear atuador:', error);
      return { success: false, message: 'Erro ao atualizar atuador.' };
    }
  },

  seedEnclosures: async () => {
    try {
      const createdEnclosures = [];

      for (const enclosure of seedEnclosuresData) {
        await db.collection('enclosures').doc(enclosure.id).set(enclosure);

        await db.collection('actuators').doc(enclosure.id).set(seedActuatorsData[enclosure.id]);

        createdEnclosures.push(enclosure);
      }

      console.log('✅ Seed de recintos criado com sucesso!');
      return createdEnclosures;
    } catch (error) {
      console.error('Erro ao criar seed de recintos:', error);
      throw new Error('Erro ao criar seed de recintos.');
    }
  }
};

module.exports = enclosureMutations;