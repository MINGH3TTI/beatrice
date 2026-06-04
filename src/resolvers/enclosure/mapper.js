const enclosureMapper = (doc) => {
  if (!doc) return null;
  const id = doc.id;
  const data = typeof doc.data === 'function' ? doc.data() : doc;
  const actuators = data.actuators || { fan: false, nebulizer: false, heater: false, lamp: false };
  const lastReadings = data.lastReadings || null;
  const limits = normalizeLimits(data.limits);

  return {
    id,
    name: data.name || '',
    speciesId: data.speciesId || '',
    photoUrl: data.photoUrl || '',
    lastReadings,
    limits,
    actuators,
    status: lastReadings && limits ? calculateStatus(lastReadings, limits) : (data.status || 'ok'),
    operatorIds: data.operatorIds || []
  };
};

const calculateStatus = (lastReadings, limits) => {
  if (!lastReadings || !limits) return 'ok';

  const { temp, humidity, noise, luminosity } = lastReadings;
  const { tempMin, tempMax, humidityMin, humidityMax, noiseMax, luminosityMax } = limits;

  let criticalCount = 0;
  if (isNumber(temp) && isNumber(tempMin) && temp < tempMin - 5) criticalCount++;
  if (isNumber(temp) && isNumber(tempMax) && temp > tempMax + 5) criticalCount++;
  if (isNumber(humidity) && isNumber(humidityMin) && humidity < humidityMin - 10) criticalCount++;
  if (isNumber(humidity) && isNumber(humidityMax) && humidity > humidityMax + 10) criticalCount++;
  if (isNumber(noise) && isNumber(noiseMax) && noise > noiseMax + 10) criticalCount++;
  if (isNumber(luminosity) && isNumber(luminosityMax) && luminosity > luminosityMax + 150) criticalCount++;
  if (criticalCount > 0) return 'critical';

  let warningCount = 0;
  if (isNumber(temp) && isNumber(tempMin) && temp < tempMin) warningCount++;
  if (isNumber(temp) && isNumber(tempMax) && temp > tempMax) warningCount++;
  if (isNumber(humidity) && isNumber(humidityMin) && humidity < humidityMin) warningCount++;
  if (isNumber(humidity) && isNumber(humidityMax) && humidity > humidityMax) warningCount++;
  if (isNumber(noise) && isNumber(noiseMax) && noise > noiseMax) warningCount++;
  if (isNumber(luminosity) && isNumber(luminosityMax) && luminosity > luminosityMax) warningCount++;
  if (warningCount > 0) return 'warning';

  return 'ok';
};

function normalizeLimits(limits) {
  if (!limits) return null;
  return {
    tempMin: limits.tempMin,
    tempMax: limits.tempMax,
    humidityMin: limits.humidityMin,
    humidityMax: limits.humidityMax,
    noiseMax: limits.noiseMax ?? limits.noiseLimit,
    luminosityMax: limits.luminosityMax ?? limits.luminosityLimit
  };
}

function isNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

module.exports = { enclosureMapper, calculateStatus, normalizeLimits };
