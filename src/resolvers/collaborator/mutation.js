const db = require('../../config/firebase');
const { collaboratorMapper, passwordResetRequestMapper } = require('./mapper');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { getJwtSecret, requireAdmin } = require('../../utils/auth');

const seedCollaboratorsData = [
  {
    id: 'collaborator_01',
    firebaseUid: 'operator_1',
    email: 'operador@zec.zoo',
    password: 'password123', // Em prod usaríamos hash
    badgeId: 'BADGE_001',
    name: 'Operador Principal',
    role: 'admin',
    assignedEnclosures: ['rec_01', 'rec_02']
  },
  {
    id: 'collaborator_02',
    firebaseUid: 'operator_2',
    email: 'operador2@zec.zoo',
    password: 'password123',
    badgeId: 'BADGE_002',
    name: 'Operador Secundário',
    role: 'operator',
    assignedEnclosures: ['rec_01']
  }
];

const collaboratorMutations = {
  login: async (_, { email, password }) => {
    try {
      const snapshot = await db.collection('collaborators')
        .where('email', '==', email)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('Credenciais inválidas.');
      }

      const collabDoc = snapshot.docs[0];
      const collabData = collabDoc.data();

      // Verificação segura usando bcrypt
      const isPasswordValid = await bcrypt.compare(password, collabData.password);
      if (!isPasswordValid) {
        throw new Error('Credenciais inválidas.');
      }

      const collaborator = collaboratorMapper(collabDoc);
      const token = jwt.sign(
        { id: collaborator.id, email: collaborator.email, role: collaborator.role },
        getJwtSecret(),
        { expiresIn: '7d' }
      );

      return { token, collaborator };
    } catch (error) {
      console.error('Erro no login:', error);
      throw new Error(error.message);
    }
  },

  loginByBadge: async (_, { badgeId }) => {
    try {
      const snapshot = await db.collection('collaborators')
        .where('badgeId', '==', badgeId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        throw new Error('Badge não reconhecido.');
      }

      const collabDoc = snapshot.docs[0];
      const collaborator = collaboratorMapper(collabDoc);
      const token = jwt.sign(
        { id: collaborator.id, email: collaborator.email, role: collaborator.role },
        getJwtSecret(),
        { expiresIn: '7d' }
      );

      return { token, collaborator };
    } catch (error) {
      console.error('Erro no login por badge:', error);
      throw new Error(error.message);
    }
  },

  forgotPassword: async (_, { email }) => {
    try {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      const snapshot = await db.collection('collaborators')
        .where('email', '==', normalizedEmail)
        .limit(1)
        .get();

      if (!snapshot.empty) {
        const collabDoc = snapshot.docs[0];
        const collabData = collabDoc.data();
        const pendingSnapshot = await db.collection('passwordResetRequests')
          .where('collaboratorId', '==', collabDoc.id)
          .where('status', '==', 'PENDING')
          .limit(1)
          .get();

        if (!pendingSnapshot.empty) {
          return {
            success: false,
            message: 'Ja existe uma solicitacao pendente para este colaborador.'
          };
        }

        await db.collection('passwordResetRequests').add({
          collaboratorId: collabDoc.id,
          email: collabData.email || normalizedEmail,
          collaboratorName: collabData.name || '',
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          completedAt: null,
          completedBy: null
        });

        return {
          success: true,
          message: 'Solicitacao enviada ao gestor para troca de senha.'
        };
      }

      return {
        success: false,
        message: 'E-mail não encontrado em nossa base.'
      };
    } catch (error) {
      console.error('Erro no forgotPassword:', error);
      return {
        success: false,
        message: 'Erro interno ao tentar recuperar a senha.'
      };
    }
  },

  createCollaborator: async (_, { input }, context) => {
    requireAdmin(context);

    try {
      const hashedPassword = input.password ? await bcrypt.hash(input.password, 10) : null;

      const docRef = db.collection('collaborators').doc();
      const newCollaborator = {
        ...input,
        badgeId: input.badgeId || `BADGE_${docRef.id}`,
        password: hashedPassword,
        assignedEnclosures: input.assignedEnclosures || [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await docRef.set(newCollaborator);
      const savedDoc = await docRef.get();

      return collaboratorMapper(savedDoc);
    } catch (error) {
      console.error('Erro ao criar colaborador:', error);
      throw new Error('Erro ao criar colaborador.');
    }
  },

  updateCollaborator: async (_, { id, input }, context) => {
    requireAdmin(context);

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

  updatePassword: async (_, { id, password }, context) => {
    requireAdmin(context);

    try {
      if (!password || password.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      const collabRef = db.collection('collaborators').doc(id);
      const collabDoc = await collabRef.get();

      if (!collabDoc.exists) {
        throw new Error('Colaborador não encontrado.');
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      await collabRef.update({
        password: hashedPassword,
        updatedAt: new Date().toISOString()
      });

      const updatedDoc = await collabRef.get();
      return collaboratorMapper(updatedDoc);
    } catch (error) {
      console.error('Erro ao atualizar senha do colaborador:', error);
      throw new Error(error.message);
    }
  },

  completePasswordResetRequest: async (_, { id, newPassword }, context) => {
    const admin = requireAdmin(context);

    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error('A senha deve ter pelo menos 6 caracteres.');
      }

      const requestRef = db.collection('passwordResetRequests').doc(id);
      const requestDoc = await requestRef.get();

      if (!requestDoc.exists) {
        throw new Error('Solicitacao nao encontrada.');
      }

      const requestData = requestDoc.data();
      if (requestData.status === 'COMPLETED') {
        throw new Error('Solicitacao ja concluida.');
      }

      const collabRef = db.collection('collaborators').doc(requestData.collaboratorId);
      const collabDoc = await collabRef.get();

      if (!collabDoc.exists) {
        throw new Error('Colaborador nao encontrado.');
      }

      const now = new Date().toISOString();
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      await collabRef.update({
        password: hashedPassword,
        updatedAt: now
      });

      await requestRef.update({
        status: 'COMPLETED',
        completedAt: now,
        completedBy: admin.id || admin.email || 'admin'
      });

      const updatedRequestDoc = await requestRef.get();
      return passwordResetRequestMapper(updatedRequestDoc);
    } catch (error) {
      console.error('Erro ao concluir solicitacao de senha:', error);
      throw new Error(error.message);
    }
  },

  deleteCollaborator: async (_, { id }, context) => {
    requireAdmin(context);

    try {
      await db.collection('collaborators').doc(id).delete();
      return { success: true };
    } catch (error) {
      console.error('Erro ao deletar colaborador:', error);
      return { success: false };
    }
  },

  assignEnclosureToCollaborator: async (_, { collaboratorId, enclosureId }, context) => {
    requireAdmin(context);

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

  removeEnclosureFromCollaborator: async (_, { collaboratorId, enclosureId }, context) => {
    requireAdmin(context);

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

  seedCollaborators: async (_, args, context) => {
    requireAdmin(context);

    try {
      const createdCollaborators = [];

      for (const collaborator of seedCollaboratorsData) {
        const hashedPassword = await bcrypt.hash(collaborator.password, 10);
        const collaboratorToSave = {
          ...collaborator,
          password: hashedPassword,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await db.collection('collaborators').doc(collaborator.id).set(collaboratorToSave);
        createdCollaborators.push(collaboratorToSave);
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
