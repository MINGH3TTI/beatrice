const enclosureMapper = (doc) => {
  const data = doc.data ? doc.data() : doc;
  return {
    id: doc.id,
    name: data.name || '',
    speciesId: data.speciesId || '',
    photoUrl: data.photoUrl || '',
    lastReadings: data.lastReadings || null,
    limits: data.limits || null,
    actuators: data.actuators || { fan: false, nebulizer: false, heater: false, lamp: false },
    status: data.status || 'ok'
  };
};

const calculateStatus = (lastReadings, limits) => {
  if (!lastReadings || !limits) return 'ok';

  const { temp, humidity } = lastReadings;
  const { tempMin, tempMax, humidityMin, humidityMax } = limits;

  let criticalCount = 0;
  if (temp < tempMin - 5 || temp > tempMax + 5) criticalCount++;
  if (humidity < humidityMin - 10 || humidity > humidityMax + 10) criticalCount++;
  if (criticalCount > 0) return 'critical';

  let warningCount = 0;
  if (temp < tempMin || temp > tempMax) warningCount++;
  if (humidity < humidityMin || humidity > humidityMax) warningCount++;
  if (warningCount > 0) return 'warning';

  return 'ok';
};

module.exports = { enclosureMapper, calculateStatus };