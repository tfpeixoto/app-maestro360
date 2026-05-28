/**
 * Pool de conexão PostgreSQL compartilhado para todos os módulos do servidor.
 * Configure DATABASE_URL no .env:
 *   postgresql://user:password@host:5432/genesis
 */
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max:              10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('[DB] Erro inesperado no pool:', err.message);
});

/**
 * Executa uma query parametrizada.
 * @param {string} text  - SQL com placeholders $1, $2...
 * @param {any[]}  [params] - valores
 * @returns {Promise<import('pg').QueryResult>}
 */
function query(text, params) {
  return pool.query(text, params);
}

/**
 * Retorna um client do pool para transações manuais.
 * Lembre de chamar client.release() no finally.
 */
function getClient() {
  return pool.connect();
}

module.exports = { query, getClient, pool };
