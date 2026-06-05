const DEFAULT_NOTIFICATION_PREFERENCES = {
  pushEnabled: true,
  criticalVibrationEnabled: true
};

function notificationPreferencesMapper(data = {}) {
  return {
    ...DEFAULT_NOTIFICATION_PREFERENCES,
    ...(data.notificationPreferences || data)
  };
}

function pushDeviceMapper(doc) {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id,
    token: data.token || '',
    platform: data.platform || '',
    enabled: data.enabled !== false,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
    lastSeenAt: data.lastSeenAt || null
  };
}

module.exports = {
  DEFAULT_NOTIFICATION_PREFERENCES,
  notificationPreferencesMapper,
  pushDeviceMapper
};
