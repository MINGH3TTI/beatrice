const db = require('../../config/firebase');
const { variantMapper } = require('./mapper');
const { calculateStatus, normalizeLimits } = require('../enclosure/mapper');
const { createAlertIfMissing, detectAlertVariable } = require('../../services/alert-rules');

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
        const limits = normalizeLimits(enclosure.limits);
        const status = calculateStatus(savedVariant, limits);
        await enclosureRef.update({
          lastReadings: savedVariant,
          status
        });

        if (status === 'warning' || status === 'critical') {
          const variable = detectAlertVariable(savedVariant, limits);
          await createAlertIfMissing({
            enclosureId: input.enclosureId,
            enclosureName: enclosure.name || savedVariant.enclosureName || '',
            variable,
            severity: status
          });
        }
      }

      return savedVariant;
    } catch (error) {
      console.error('Erro ao registrar dados do sensor:', error);
      throw new Error("Falha ao registrar dados do sensor.");
    }
  }
};

module.exports = variantMutations;
