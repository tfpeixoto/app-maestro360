/**
 * Migration incremental — tabelas do Funil Kanban de Simulações.
 * Usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS: seguro rodar múltiplas vezes.
 * Uso: node server/database/migrate-funil.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Client } = require('pg');

const SQL = `
-- Colunas na tabela simulacoes
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS etapa_funil_id  VARCHAR(80)  REFERENCES funil_estagios(id) ON DELETE SET NULL;
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS titulo          VARCHAR(200);
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS arquivado       BOOLEAN      NOT NULL DEFAULT FALSE;
ALTER TABLE simulacoes ADD COLUMN IF NOT EXISTS lead_nome_cache VARCHAR(200);

-- Colunas de código único
ALTER TABLE leads       ADD COLUMN IF NOT EXISTS cpf    VARCHAR(20);
ALTER TABLE leads       ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) UNIQUE;
ALTER TABLE simulacoes  ADD COLUMN IF NOT EXISTS codigo VARCHAR(20) UNIQUE;

-- Preenche códigos existentes
UPDATE leads       SET codigo = 'CLI-' || LPAD(id::text, 4, '0') WHERE codigo IS NULL;
UPDATE simulacoes  SET codigo = 'SIM-' || LPAD(id::text, 4, '0') WHERE codigo IS NULL;

-- Trigger AFTER INSERT para auto-gerar código de simulação
CREATE OR REPLACE FUNCTION fn_auto_codigo_sim() RETURNS TRIGGER AS $$
BEGIN
  UPDATE simulacoes SET codigo = 'SIM-' || LPAD(NEW.id::text, 4, '0') WHERE id = NEW.id AND codigo IS NULL;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_auto_codigo_sim ON simulacoes;
CREATE TRIGGER tg_auto_codigo_sim
  AFTER INSERT ON simulacoes
  FOR EACH ROW EXECUTE FUNCTION fn_auto_codigo_sim();

-- Trigger AFTER INSERT para auto-gerar código de lead
CREATE OR REPLACE FUNCTION fn_auto_codigo_lead() RETURNS TRIGGER AS $$
BEGIN
  UPDATE leads SET codigo = 'CLI-' || LPAD(NEW.id::text, 4, '0') WHERE id = NEW.id AND codigo IS NULL;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tg_auto_codigo_lead ON leads;
CREATE TRIGGER tg_auto_codigo_lead
  AFTER INSERT ON leads
  FOR EACH ROW EXECUTE FUNCTION fn_auto_codigo_lead();

-- Garante seed de funis (caso schema.sql não tenha sido rodado na VPS)
INSERT INTO funis (id, label, cor, padrao) VALUES
  ('vendas',    'Vendas',    '#1a3a5c', TRUE),
  ('wpp',       'WhatsApp',  '#25d366', FALSE),
  ('simulador', 'Simulador', '#6366f1', FALSE)
ON CONFLICT (id) DO NOTHING;

INSERT INTO funil_estagios (id, funil_id, label, cor, ordem) VALUES
  ('inicio',         'vendas',    'Início',        '#94a3b8', 0),
  ('lead',           'vendas',    'Lead',          '#3b82f6', 1),
  ('quali',          'vendas',    'Qualificação',  '#f59e0b', 2),
  ('sim',            'vendas',    'Simulação',     '#8b5cf6', 3),
  ('proposta',       'vendas',    'Proposta',      '#10b981', 4),
  ('contrato',       'vendas',    'Contrato',      '#1a3a5c', 5),
  ('posvenda',       'vendas',    'Pós-venda',     '#64748b', 6),
  ('wpp_novo',       'wpp',       'Novo',          '#94a3b8', 0),
  ('wpp_trabalhado', 'wpp',       'Trabalhado',    '#3b82f6', 1),
  ('wpp_cliente',    'wpp',       'Cliente',       '#25d366', 2),
  ('sim_simulado',   'simulador', 'Simulado',      '#8b5cf6', 0),
  ('sim_qualif',     'simulador', 'Qualificado',   '#f59e0b', 1),
  ('sim_proposta',   'simulador', 'Proposta',      '#10b981', 2)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS sim_checklist_items (
  id           BIGSERIAL    PRIMARY KEY,
  simulacao_id BIGINT       NOT NULL REFERENCES simulacoes(id) ON DELETE CASCADE,
  texto        TEXT         NOT NULL,
  feito        BOOLEAN      NOT NULL DEFAULT FALSE,
  ordem        SMALLINT     NOT NULL DEFAULT 0,
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sci_simulacao ON sim_checklist_items(simulacao_id);

CREATE TABLE IF NOT EXISTS sim_anotacoes (
  id           BIGSERIAL    PRIMARY KEY,
  simulacao_id BIGINT       NOT NULL REFERENCES simulacoes(id) ON DELETE CASCADE,
  usuario_id   INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
  texto        TEXT         NOT NULL,
  criado_em    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sa_simulacao ON sim_anotacoes(simulacao_id);
`;

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('[migrate-funil] DATABASE_URL não definida no .env');
    process.exit(1);
  }
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(SQL);
    console.log('[migrate-funil] Colunas e tabelas do funil kanban prontas.');
  } catch (e) {
    console.error('[migrate-funil] Erro:', e.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
