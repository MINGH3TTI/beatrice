const db = require('../config/firebase');
const { alertMapper } = require('../resolvers/alert/mapper');
const { notifyAlertCreated } = require('./notifications');

function detectAlertVariable(reading, limits) {
  if (!reading || !limits) {
    return null;
  }

  const variables = [];

  addOutOfRangeVariable(variables, 'Temperatura', reading.temp, limits.tempMin, limits.tempMax);
  addOutOfRangeVariable(variables, 'Umidade', reading.humidity, limits.humidityMin, limits.humidityMax);
  addMaxVariable(variables, 'Ruido', reading.noise, limits.noiseMax);
  addMaxVariable(variables, 'Luminosidade', reading.luminosity, limits.luminosityMax);

  if (variables.length === 0) {
    return null;
  }

  return variables.length === 1 ? variables[0] : 'Multiplas variaveis';
}

async function createAlertIfMissing({ enclosureId, enclosureName, variable, severity }) {
  if (!enclosureId || !variable || !severity || severity === 'ok') {
    return null;
  }

  const snapshot = await db.collection('alerts')
    .where('enclosureId', '==', enclosureId)
    .get();

  const existingDoc = snapshot.docs.find(doc => {
    const data = doc.data();
    return data.resolved === false && data.variable === variable && data.severity === severity;
  });

  if (existingDoc) {
    return alertMapper(existingDoc);
  }

  const alert = {
    enclosureId,
    enclosureName: enclosureName || '',
    variable,
    severity,
    timestamp: new Date().toISOString(),
    resolved: false
  };

  const docRef = await db.collection('alerts').add(alert);
  const savedDoc = await docRef.get();
  const savedAlert = alertMapper(savedDoc);
  await notifyAlertCreated(savedAlert);

  return savedAlert;
}

function addOutOfRangeVariable(variables, label, value, min, max) {
  if (!isNumber(value)) {
    return;
  }

  if ((isNumber(min) && value < min) || (isNumber(max) && value > max)) {
    variables.push(label);
  }
}

function addMaxVariable(variables, label, value, max) {
  if (isNumber(value) && isNumber(max) && value > max) {
    variables.push(label);
  }
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

module.exports = {
  detectAlertVariable,
  createAlertIfMissing
};
