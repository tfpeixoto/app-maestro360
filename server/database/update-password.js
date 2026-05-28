/**
 * Atualiza senha de um usuário específico.
 * Uso: node server/database/update-password.js <email> <nova_senha>
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');
const bcrypt     = require('bcryptjs');

async function run() {
  const [,, email, senha] = process.argv;
  if (!email || !senha) {
    console.error('Uso: node update-password.js <email> <nova_senha>');
    process.exit(1);
  }

  const url = process.env.DATABASE_URL;
  if (!url) { console.error('DATABASE_URL não definida'); process.exit(1); }

  const hash   = await bcrypt.hash(senha, 10);
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    const r = await client.query(
      `UPDATE usuarios SET senha_hash = $1 WHERE LOWER(email) = LOWER($2) RETURNING id, nome, email`,
      [hash, email]
    );
    if (r.rowCount === 0) { console.error(`Usuário não encontrado: ${email}`); process.exit(1); }
    console.log(`Senha atualizada para: ${r.rows[0].nome} <${r.rows[0].email}>`);
  } finally {
    await client.end();
  }
}

run().catch(e => { console.error(e.message); process.exit(1); });
