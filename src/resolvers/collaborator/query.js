const db = require('../../config/firebase');
const { collaboratorMapper } = require('./mapper');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'beatrice_secret_key_123';

const collaboratorQueries = {
  collaborators: async () => {
    try {
      const snapshot = await db.collection('collaborators').get();
      return snapshot.docs.map(doc => collaboratorMapper(doc));
    } catch (error) {
      console.error('Erro ao buscar colaboradores:', error);
      throw new Error('Erro ao carregar colaboradores.');
    }
  },

  collaborator: async (_, { id }) => {
    try {
      const doc = await db.collection('collaborators').doc(id).get();
      if (!doc.exists) {
        throw new Error('Colaborador não encontrado.');
      }
      return collaboratorMapper(doc);
    } catch (error) {
      console.error('Erro ao buscar colaborador:', error);
      throw new Error(error.message);
    }
  },

  myProfile: async (_, args, context) => {
    try {
      const authHeader = context.req?.headers?.authorization;
      if (!authHeader) {
        throw new Error('Usuário não autenticado.');
      }

      const token = authHeader.replace('Bearer ', '');
      const decodedToken = jwt.verify(token, JWT_SECRET);
      const collaboratorId = decodedToken.id;

      const doc = await db.collection('collaborators').doc(collaboratorId).get();

      if (!doc.exists) {
        throw new Error('Colaborador não encontrado.');
      }

      return collaboratorMapper(doc);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      throw new Error('Usuário não autenticado ou token inválido.');
    }
  },

  enclosuresByCollaborator: async (_, { collaboratorId }) => {
    try {
      const collabDoc = await db.collection('collaborators').doc(collaboratorId).get();
      if (!collabDoc.exists) {
        throw new Error('Colaborador não encontrado.');
      }

      const collabData = collabDoc.data();
      const enclosureIds = collabData.assignedEnclosures || [];

      const enclosures = [];
      for (const encId of enclosureIds) {
        const encDoc = await db.collection('enclosures').doc(encId).get();
        if (encDoc.exists) {
          const encData = encDoc.data();

          const actuatorsDoc = await db.collection('actuators').doc(encId).get();
          let actuators = { fan: false, nebulizer: false, heater: false, lamp: false };
          if (actuatorsDoc.exists) {
            actuators = actuatorsDoc.data();
          }

          enclosures.push({
            id: encDoc.id,
            ...encData,
            actuators
          });
        }
      }

      return enclosures;
    } catch (error) {
      console.error('Erro ao buscar recintos do colaborador:', error);
      throw new Error('Erro ao carregar recintos.');
    }
  }
};

module.exports = collaboratorQueries;