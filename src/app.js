const express = require('express');
const { ApolloServer } = require('apollo-server-express');
const typeDefs = require('./schemas');
const resolvers = require('./resolvers');
const { getJwtSecret, getOptionalUser } = require('./utils/auth');

async function startServer() {
  getJwtSecret();

  const app = express();
  const isProduction = process.env.NODE_ENV === 'production';

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: !isProduction,
    context: ({ req }) => {
      let currentUser = null;

      try {
        currentUser = getOptionalUser({ req });
      } catch {
        currentUser = null;
      }

      return { req, currentUser };
    }
  });

  await server.start();
  server.applyMiddleware({ app });

  return app;
}

module.exports = startServer;
