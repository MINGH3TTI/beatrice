const db = require('../../config/firebase');
const { variantMapper } = require('./mapper');
const { calculateStatus } = require('../enclosure/mapper');

const variantMutations = {
  createVariant: async (_, { input }) => {
    try {
      const newVariant = {
        ...input,
        timestamp: input.timestamp || new Date().toISOString()
      };

      const docRef = await db.collection('variants').add(newVariant);
      const savedDoc = await docRef.get();
      const savedVariant = variantMapper(savedDoc);

      const enclosureRef = db.collection('enclosures').doc(input.enclosureId);
      const enclosureDoc = await enclosureRef.get();

      if (enclosureDoc.exists) {
        const enclosure = enclosureDoc.data();
        const status = calculateStatus(savedVariant, enclosure.limits);
        await enclosureRef.update({
          lastReadings: savedVariant,
          status
        });
      }

      return savedVariant;
    } catch (error) {
      console.error('Erro ao registrar dados do sensor:', error);
      throw new Error("Falha ao registrar dados do sensor.");
    }
  }
};

module.exports = variantMutations;
