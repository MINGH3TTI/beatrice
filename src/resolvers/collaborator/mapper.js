function normalizeRole(role) {
  if (role === 'admin' || role === 'gestor' || role === 'ADMIN') return 'ADMIN';
  return role || 'operator';
}

const collaboratorMapper = (doc) => {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id,
    email: data.email || '',
    name: data.name || '',
    role: normalizeRole(data.role),
    badgeId: data.badgeId || '',
    assignedEnclosures: data.assignedEnclosures || [],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
};

const passwordResetRequestMapper = (doc) => {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id,
    collaboratorId: data.collaboratorId || '',
    collaboratorName: data.collaboratorName || '',
    email: data.email || '',
    status: data.status || 'PENDING',
    createdAt: data.createdAt || new Date().toISOString(),
    completedAt: data.completedAt || null,
    completedBy: data.completedBy || null
  };
};

module.exports = { collaboratorMapper, normalizeRole, passwordResetRequestMapper };
