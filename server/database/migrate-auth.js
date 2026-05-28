/**
 * Migration incremental — tabelas de autenticação e audit log.
 * Usa IF NOT EXISTS em tudo: seguro rodar múltiplas vezes.
 * Uso: node server/database/migrate-auth.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const SQL = `
-- Refresh tokens (para invalidação futura de sessões)
CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id          BIGSERIAL    PRIMARY KEY,
  usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expira_em   TIMESTAMPTZ  NOT NULL,
  revogado    BOOLEAN      NOT NULL DEFAULT FALSE
);
CREATE INDEX IF NOT EXISTS idx_art_usuario ON auth_refresh_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_art_expira  ON auth_refresh_tokens(expira_em);

-- Log de auditoria de tentativas de login
CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id                  BIGSERIAL     PRIMARY KEY,
  timestamp_utc       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  username_digitado   VARCHAR(200),
  usuario_id          INTEGER       REFERENCES usuarios(id) ON DELETE SET NULL,
  ip                  INET          NOT NULL,
  porta               INTEGER,
  pais                VARCHAR(80),
  estado              VARCHAR(80),
  cidade              VARCHAR(100),
  isp                 VARCHAR(200),
  lat_ip              NUMERIC(10,6),
  lon_ip              NUMERIC(10,6),
  lat_gps             NUMERIC(10,6),
  lon_gps             NUMERIC(10,6),
  user_agent          TEXT,
  os                  VARCHAR(100),
  navegador           VARCHAR(100),
  status              VARCHAR(40)   NOT NULL,
  detalhe             TEXT
);
CREATE INDEX IF NOT EXISTS idx_aal_timestamp ON auth_audit_logs(timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_aal_ip        ON auth_audit_logs(ip);
CREATE INDEX IF NOT EXISTS idx_aal_status    ON auth_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_aal_usuario   ON auth_audit_logs(usuario_id);
`;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate-auth] DATABASE_URL não definida no .env');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log('[migrate-auth] Tabelas auth_audit_logs e auth_refresh_tokens prontas.');
  } catch (e) {
    console.error('[migrate-auth] Erro:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
