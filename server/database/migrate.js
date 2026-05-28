#!/usr/bin/env node
/**
 * Executa o schema.sql contra o banco configurado em DATABASE_URL.
 * Uso: node server/database/migrate.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const fs         = require('fs');
const path       = require('path');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate] DATABASE_URL não definida no .env');
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log('[migrate] Conectado ao banco.');

  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

  try {
    await client.query(sql);
    console.log('[migrate] Schema aplicado com sucesso.');
  } catch (e) {
    console.error('[migrate] Erro ao aplicar schema:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
