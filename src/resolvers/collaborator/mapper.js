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
    assignedEnclosures: data.assignedEnclosures || [],
    createdAt: data.createdAt || new Date().toISOString(),
    updatedAt: data.updatedAt || new Date().toISOString()
  };
};

module.exports = { collaboratorMapper, normalizeRole };
