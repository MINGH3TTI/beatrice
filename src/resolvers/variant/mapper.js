const variantMapper = (doc) => {
  const data = typeof doc.data === 'function' ? doc.data() : doc;
  return {
    id: doc.id || null,
    enclosureId: data.enclosureId,
    temp: data.temp ?? data.temperature,
    humidity: data.humidity,
    noise: data.noise ?? data.noises,
    luminosity: data.luminosity,
    timestamp: data.timestamp
  };
};

module.exports = { variantMapper };
