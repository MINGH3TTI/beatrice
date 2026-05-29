const jwt = require('jsonwebtoken');

const ADMIN_ROLES = ['admin', 'gestor'];

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('Configuração ausente: defina JWT_SECRET.');
  }
  return secret;
}

function getTokenFromContext(context) {
  const authHeader = context?.req?.headers?.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim();
}

function getOptionalUser(context) {
  const token = getTokenFromContext(context);
  if (!token) return null;
  return jwt.verify(token, getJwtSecret());
}

function requireAuth(context) {
  const user = context?.currentUser || getOptionalUser(context);
  if (!user) {
    throw new Error('Usuário não autenticado.');
  }
  return user;
}

function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

function requireAdmin(context) {
  const user = requireAuth(context);
  if (!isAdminRole(user.role)) {
    throw new Error('Acesso restrito a administradores.');
  }
  return user;
}

module.exports = {
  getJwtSecret,
  getOptionalUser,
  requireAuth,
  requireAdmin,
  isAdminRole
};
