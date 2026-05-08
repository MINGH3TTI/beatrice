const db = require('../../config/firebase');
const { collaboratorMapper } = require('./mapper');

const seedCollaboratorsData = [
  {
    id: 'collaborator_01',
    firebaseUid: 'operator_1',
    email: 'operador@zec.zoo',
    name: 'Operador Principal',
    role: 'admin',
    assignedEnclosures: ['rec_01', 'rec_02']
  },
  {
    id: 'collaborator_02',
    firebaseUid: 'operator_2',
    email: 'operador2@zec.zoo',
    name: 'Operador Secundário',
    role: 'operator',
    assignedEnclosures: ['rec_01']
  }
];

const collaboratorMutations = {
  createCollaborator: async (_, { input }) => {
    try {
      const newCollaborator = {
        ...input,
        assignedEnclosures: input.assignedEnclosures || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const docRef = await db.collection('collaborators').add(newCollaborator);
      const savedDoc = await docRef.get();

      return collaboratorMapper(savedDoc);
    } catch (error) {
      console.error('Erro ao criar colaborador:', error);
      throw new Error('Erro ao criar colaborador.');
    }
  },

  updateCollaborator: async (_, { id, input }) => {
    try {
      const collabRef = db.collection('collaborators').doc(id);
      const collabDoc = await collabRef.get();

      if (!collabDoc.exists) {
        throw new Error('Colaborador não encontrado.');
      }

      const updateData = {
        ...input,
        updatedAt: new Date().toISOString()
      };

      await collabRef.update(updateData);
      const updatedDoc = await collabRef.get();

      return collaboratorMapper(updatedDoc);
    } catch (error) {
      console.error('Erro ao atualizar colaborador:', error);
      throw new Error(error.message);
    }
  },

  deleteCollaborator: async (_, { id }) => {
    try {
      await db.collection('collaborators').doc(id).delete();
      return true;
    } catch (error) {
      console.error('Erro ao deletar colaborador:', error);
      throw new Error('Erro ao deletar colaborador.');
    }
  },

  assignEnclosureToCollaborator: async (_, { collaboratorId, enclosureId }) => {
    try {
      const collabRef = db.collection('collaborators').doc(collaboratorId);
      const collabDoc = await collabRef.get();

      if (!collabDoc.exists) {
        throw new Error('Colaborador não encontrado.');
      }

      const collabData = collabDoc.data();
      const assignedEnclosures = collabData.assignedEnclosures || [];

      if (!assignedEnclosures.includes(enclosureId)) {
        assignedEnclosures.push(enclosureId);
        await collabRef.update({
          assignedEnclosures,
          updatedAt: new Date().toISOString()
        });
      }

      const updatedDoc = await collabRef.get();
      return collaboratorMapper(updatedDoc);
    } catch (error) {
      console.error('Erro ao atribuir recinto:', error);
      throw new Error(error.message);
    }
  },

  removeEnclosureFromCollaborator: async (_, { collaboratorId, enclosureId }) => {
    try {
      const collabRef = db.collection('collaborators').doc(collaboratorId);
      const collabDoc = await collabRef.get();

      if (!collabDoc.exists) {
        throw new Error('Colaborador não encontrado.');
      }

      const collabData = collabDoc.data();
      const assignedEnclosures = (collabData.assignedEnclosures || []).filter(id => id !== enclosureId);

      await collabRef.update({
        assignedEnclosures,
        updatedAt: new Date().toISOString()
      });

      const updatedDoc = await collabRef.get();
      return collaboratorMapper(updatedDoc);
    } catch (error) {
      console.error('Erro ao remover recinto:', error);
      throw new Error(error.message);
    }
  },

  seedCollaborators: async () => {
    try {
      const createdCollaborators = [];

      for (const collaborator of seedCollaboratorsData) {
        await db.collection('collaborators').doc(collaborator.id).set(collaborator);
        createdCollaborators.push(collaborator);
      }

      console.log('✅ Seed de colaboradores criado com sucesso!');
      return createdCollaborators;
    } catch (error) {
      console.error('Erro ao criar seed de colaboradores:', error);
      throw new Error('Erro ao criar seed de colaboradores.');
    }
  }
};

module.exports = collaboratorMutations;