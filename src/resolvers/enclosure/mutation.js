const db = require('../../config/firebase');
const { enclosureMapper } = require('./mapper');
const seedEnclosuresData = require('../../../seeds-enclosures.json');
const seedActuatorsData = require('../../../seeds-actuators.json');

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

  createEnclosure: async (_, { input }) => {
    try {
      const newEnclosureRef = db.collection('enclosures').doc();
      const newEnclosure = {
        id: newEnclosureRef.id,
        ...input,
        lastReadings: null,
      };
      await newEnclosureRef.set(newEnclosure);
      
      await db.collection('actuators').doc(newEnclosureRef.id).set({
        fan: false, nebulizer: false, heater: false, lamp: false
      });
      
      return enclosureMapper(newEnclosure);
    } catch (error) {
      console.error('Erro ao criar recinto:', error);
      throw new Error('Erro ao criar recinto.');
    }
  },

  updateEnclosure: async (_, { id, input }) => {
    try {
      const enclosureRef = db.collection('enclosures').doc(id);
      const enclosureDoc = await enclosureRef.get();
      
      if (!enclosureDoc.exists) {
        throw new Error('Recinto não encontrado.');
      }
      
      await enclosureRef.update(input);
      const updatedDoc = await enclosureRef.get();
      return enclosureMapper(updatedDoc);
    } catch (error) {
      console.error('Erro ao atualizar recinto:', error);
      throw new Error('Erro ao atualizar recinto.');
    }
  },

  deleteEnclosure: async (_, { id }) => {
    try {
      await db.collection('enclosures').doc(id).delete();
      await db.collection('actuators').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Erro ao excluir recinto:', error);
      throw new Error('Erro ao excluir recinto.');
    }
  },

  seedEnclosures: async () => {
    try {
      const createdEnclosures = [];

      for (const enclosure of seedEnclosuresData) {
        const id = enclosure.id || db.collection('enclosures').doc().id;
        const enclosureToSave = { ...enclosure, id };
        
        await db.collection('enclosures').doc(id).set(enclosureToSave);

        const actuators = seedActuatorsData[id] || { fan: false, nebulizer: false, heater: false, lamp: false };
        await db.collection('actuators').doc(id).set(actuators);

        createdEnclosures.push(enclosureMapper(enclosureToSave));
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