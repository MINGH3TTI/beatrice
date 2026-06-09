const db = require('../../config/firebase');
const { enclosureMapper } = require('./mapper');
const { requireAdmin } = require('../../utils/auth');
const seedEnclosuresData = require('../../../seeds-enclosures.json');
const seedActuatorsData = require('../../../seeds-actuators.json');

const DEFAULT_ACTUATORS = { fan: false, nebulizer: false, heater: false, lamp: false };
const VALID_ACTUATORS = Object.keys(DEFAULT_ACTUATORS);

const enclosureMutations = {
  updateActuatorStateFromEsp32: async (_, { enclosureId, actuatorType, state }) => {
    try {
      if (!VALID_ACTUATORS.includes(actuatorType)) {
        return { success: false, message: 'Tipo de atuador invalido.' };
      }

      const enclosureDoc = await db.collection('enclosures').doc(enclosureId).get();
      if (!enclosureDoc.exists) {
        return { success: false, message: 'Recinto nao encontrado.' };
      }

      const actuatorsRef = db.collection('actuators').doc(enclosureId);
      const actuatorsDoc = await actuatorsRef.get();
      const currentActuators = actuatorsDoc.exists
        ? { ...DEFAULT_ACTUATORS, ...actuatorsDoc.data() }
        : { ...DEFAULT_ACTUATORS };

      currentActuators[actuatorType] = state;
      await actuatorsRef.set(currentActuators);

      return {
        success: true,
        message: `Atuador ${actuatorType} ${state ? 'ativado' : 'desativado'} pelo ESP32 com sucesso.`
      };
    } catch (error) {
      console.error('Erro ao atualizar atuador pelo ESP32:', error);
      return { success: false, message: 'Erro ao atualizar atuador pelo ESP32.' };
    }
  },

  createEnclosure: async (_, { input }, context) => {
    requireAdmin(context);

    try {
      const newEnclosureRef = db.collection('enclosures').doc();
      const newEnclosure = {
        id: newEnclosureRef.id,
        ...normalizeEnclosureInput(input),
        lastReadings: null,
      };
      await newEnclosureRef.set(newEnclosure);

      await db.collection('actuators').doc(newEnclosureRef.id).set({ ...DEFAULT_ACTUATORS });

      return enclosureMapper(newEnclosure);
    } catch (error) {
      console.error('Erro ao criar recinto:', error);
      throw new Error('Erro ao criar recinto.');
    }
  },

  updateEnclosure: async (_, { id, input }, context) => {
    requireAdmin(context);

    try {
      const enclosureRef = db.collection('enclosures').doc(id);
      const enclosureDoc = await enclosureRef.get();

      if (!enclosureDoc.exists) {
        throw new Error('Recinto não encontrado.');
      }

      await enclosureRef.update(normalizeEnclosureInput(input));
      const updatedDoc = await enclosureRef.get();
      return enclosureMapper(updatedDoc);
    } catch (error) {
      console.error('Erro ao atualizar recinto:', error);
      throw new Error('Erro ao atualizar recinto.');
    }
  },

  deleteEnclosure: async (_, { id }, context) => {
    requireAdmin(context);

    try {
      await db.collection('enclosures').doc(id).delete();
      await db.collection('actuators').doc(id).delete();
      return { success: true };
    } catch (error) {
      console.error('Erro ao excluir recinto:', error);
      return { success: false };
    }
  },

  seedEnclosures: async (_, args, context) => {
    requireAdmin(context);

    try {
      const createdEnclosures = [];

      for (const enclosure of seedEnclosuresData) {
        const id = enclosure.id || db.collection('enclosures').doc().id;
        const enclosureToSave = { ...enclosure, id };

        await db.collection('enclosures').doc(id).set(enclosureToSave);

        const actuators = seedActuatorsData[id] || DEFAULT_ACTUATORS;
        await db.collection('actuators').doc(id).set({ ...actuators });

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

function normalizeEnclosureInput(input) {
  const {
    tempMin,
    tempMax,
    humidityMin,
    humidityMax,
    noiseMax,
    ...rest
  } = input;

  const hasFlatLimits = [
    tempMin,
    tempMax,
    humidityMin,
    humidityMax,
    noiseMax
  ].some(value => value !== undefined);

  const limits = rest.limits || hasFlatLimits ? normalizeLimitsInput(rest.limits || {
    tempMin,
    tempMax,
    humidityMin,
    humidityMax,
    noiseMax
  }) : undefined;

  return limits === undefined ? rest : { ...rest, limits };
}

function normalizeLimitsInput(limits) {
  if (!limits) return null;
  return {
    tempMin: limits.tempMin,
    tempMax: limits.tempMax,
    humidityMin: limits.humidityMin,
    humidityMax: limits.humidityMax,
    noiseMax: limits.noiseMax
  };
}

module.exports = enclosureMutations;
