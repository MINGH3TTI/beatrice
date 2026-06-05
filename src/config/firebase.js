const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  } catch (err) {
    throw new Error("A variável FIREBASE_SERVICE_ACCOUNT contém um JSON inválido.");
  }
} else {
  const keyPath = process.env.FIREBASE_KEY_PATH;

  if (!keyPath) {
    throw new Error("Configuração do Firebase ausente: Defina FIREBASE_SERVICE_ACCOUNT (JSON) ou FIREBASE_KEY_PATH.");
  }

  const resolvedPath = path.resolve(keyPath);

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Arquivo de chave do Firebase não encontrado: ${resolvedPath}`);
  }

  serviceAccount = require(resolvedPath);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
db.admin = admin;
db.messaging = () => admin.messaging();
module.exports = db;
