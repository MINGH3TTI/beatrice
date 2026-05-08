const collaboratorQueries = require('./query');
const collaboratorMutations = require('./mutation');

module.exports = {
  Query: collaboratorQueries,
  Mutation: collaboratorMutations
};