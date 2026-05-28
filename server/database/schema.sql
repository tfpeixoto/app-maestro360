-- ============================================================
--  Gênesis — Schema PostgreSQL
--  Cobre: Leads, Funil, Reuniões, Propostas, Contratos,
--         Parcelas, Lances, Assembleias, Cotas, Equipe,
--         Metas, WhatsApp, Google OAuth, Configurações,
--         Autenticação JWT + Audit Log de Acesso
-- ============================================================

-- Extensão para UUID (IDs alternativos quando necessário)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
--  USUÁRIOS / AUTENTICAÇÃO
-- ============================================================

CREATE TABLE usuarios (
  id          SERIAL PRIMARY KEY,
  nome        VARCHAR(120)        NOT NULL,
  email       VARCHAR(200)        NOT NULL UNIQUE,
  senha_hash  TEXT,                            -- bcrypt; NULL se login via Google OAuth
  papel       VARCHAR(30)         NOT NULL DEFAULT 'vendedor',
                                               -- 'admin' | 'gerente' | 'vendedor'
  ativo       BOOLEAN             NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

-- Tokens Google OAuth por usuário
CREATE TABLE google_tokens (
  id              SERIAL PRIMARY KEY,
  usuario_id      INTEGER         NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  access_token    TEXT            NOT NULL,
  refresh_token   TEXT,
  token_type      VARCHAR(30)     DEFAULT 'Bearer',
  expires_at      TIMESTAMPTZ,
  scope           TEXT,
  criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id)
);

-- ============================================================
--  FUNIS DE VENDAS
-- ============================================================

CREATE TABLE funis (
  id          VARCHAR(60)  PRIMARY KEY,        -- 'vendas' | 'wpp' | 'fn_<ts>'
  label       VARCHAR(80)  NOT NULL,
  cor         VARCHAR(7)   NOT NULL DEFAULT '#1a3a5c',
  padrao      BOOLEAN      NOT NULL DEFAULT FALSE,   -- funil padrão do sistema
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE funil_estagios (
  id          VARCHAR(80)  PRIMARY KEY,        -- 'inicio' | 'fn_123_1' etc.
  funil_id    VARCHAR(60)  NOT NULL REFERENCES funis(id) ON DELETE CASCADE,
  label       VARCHAR(80)  NOT NULL,
  cor         VARCHAR(7)   NOT NULL DEFAULT '#6b7280',
  ordem       SMALLINT     NOT NULL DEFAULT 0,
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_funil_estagios_funil ON funil_estagios(funil_id);

-- ============================================================
--  LEADS / CLIENTES
-- ============================================================

CREATE TABLE leads (
  id              SERIAL PRIMARY KEY,
  nome            VARCHAR(200)    NOT NULL,
  telefone        VARCHAR(40),
  email           VARCHAR(200),
  origem          VARCHAR(40),
  -- 'WhatsApp'|'Instagram'|'Indicação'|'Site'|'Ligação'|'Outro'
  objetivo        VARCHAR(80),
  -- 'Comprar Imóvel'|'Comprar Carro'|'Ganho Financeiro'|'Capital de Giro'|'Outro'
  valor_desejado  NUMERIC(14,2),
  aporte_mensal   NUMERIC(14,2),
  obs             TEXT,
  stage_id        VARCHAR(80)     REFERENCES funil_estagios(id) ON DELETE SET NULL,
  funil_id        VARCHAR(60)     REFERENCES funis(id) ON DELETE SET NULL,
  responsavel_id  INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_leads_stage   ON leads(stage_id);
CREATE INDEX idx_leads_funil   ON leads(funil_id);
CREATE INDEX idx_leads_resp    ON leads(responsavel_id);
CREATE INDEX idx_leads_tel     ON leads(telefone);
CREATE INDEX idx_leads_email   ON leads(email);

-- Tags associadas ao lead
CREATE TABLE lead_tags (
  id        SERIAL PRIMARY KEY,
  lead_id   INTEGER      NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  label     VARCHAR(80)  NOT NULL,
  cor       VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
  criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_tags_lead ON lead_tags(lead_id);

-- Histórico de atividades do lead (log imutável)
CREATE TABLE lead_historico (
  id        BIGSERIAL    PRIMARY KEY,
  lead_id   INTEGER      NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  texto     TEXT         NOT NULL,
  autor_id  INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_hist_lead ON lead_historico(lead_id);
CREATE INDEX idx_lead_hist_data ON lead_historico(criado_em DESC);

-- Notas livres do lead (editáveis)
CREATE TABLE lead_notas (
  id        BIGSERIAL    PRIMARY KEY,
  lead_id   INTEGER      NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  texto     TEXT         NOT NULL,
  autor_id  INTEGER      REFERENCES usuarios(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_notas_lead ON lead_notas(lead_id);

-- Trechos de conversa salvos no perfil do lead
CREATE TABLE lead_conversas_salvas (
  id          BIGSERIAL   PRIMARY KEY,
  lead_id     INTEGER     NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  fonte       VARCHAR(10) NOT NULL DEFAULT 'WPP',   -- 'WPP' | 'Email'
  chat_name   VARCHAR(200),
  nota        TEXT,
  mensagens   JSONB       NOT NULL DEFAULT '[]',    -- array de objetos de mensagem
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lead_conv_lead ON lead_conversas_salvas(lead_id);

-- ============================================================
--  REUNIÕES
-- ============================================================

CREATE TABLE reunioes (
  id               SERIAL PRIMARY KEY,
  titulo           VARCHAR(200)    NOT NULL,
  tipo             VARCHAR(20)     NOT NULL DEFAULT 'online',   -- 'online'|'presencial'
  local            TEXT,
  meet_link        TEXT,
  google_event_id  VARCHAR(200),
  data             DATE            NOT NULL,
  hora             TIME,
  duracao_min      SMALLINT        NOT NULL DEFAULT 60,
  lead_id          INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  responsavel_id   INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
  status           VARCHAR(20)     NOT NULL DEFAULT 'agendada',
  -- 'agendada'|'realizada'|'cancelada'
  notas            TEXT,
  criado_em        TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reunioes_lead    ON reunioes(lead_id);
CREATE INDEX idx_reunioes_data    ON reunioes(data);
CREATE INDEX idx_reunioes_status  ON reunioes(status);
CREATE INDEX idx_reunioes_resp    ON reunioes(responsavel_id);

-- ============================================================
--  PROPOSTAS
-- ============================================================

CREATE TABLE propostas (
  id              BIGSERIAL       PRIMARY KEY,
  lead_id         INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  prop_num        VARCHAR(30),                  -- ex: 'PROP-001'
  titulo          VARCHAR(200),
  descricao       TEXT,
  valor           NUMERIC(14,2),
  status          VARCHAR(20)     NOT NULL DEFAULT 'rascunho',
  -- 'rascunho'|'enviada'|'aceita'|'rejeitada'|'assinada'|'convertida'
  grupo           VARCHAR(60),                  -- grupo do consórcio
  credito_total   NUMERIC(14,2),
  credito         NUMERIC(14,2),
  emb_perc        NUMERIC(6,3),                 -- percentual de embutido
  lances          SMALLINT,
  dia_util        VARCHAR(10),
  taxa            NUMERIC(6,4),
  prazo           SMALLINT,                     -- meses
  criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_propostas_lead   ON propostas(lead_id);
CREATE INDEX idx_propostas_status ON propostas(status);

-- ============================================================
--  CONTRATOS
-- ============================================================

CREATE TABLE contratos (
  id            BIGSERIAL       PRIMARY KEY,
  lead_id       INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  proposta_id   BIGINT          REFERENCES propostas(id) ON DELETE SET NULL,
  titulo        VARCHAR(200),
  numero        VARCHAR(60),
  valor         NUMERIC(14,2),
  descricao     TEXT,
  data_inicio   DATE,
  data_fim      DATE,
  status        VARCHAR(20)     NOT NULL DEFAULT 'ativo',
  -- 'ativo'|'pendente'|'cancelado'|'encerrado'
  criado_em     TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_contratos_lead   ON contratos(lead_id);
CREATE INDEX idx_contratos_status ON contratos(status);

-- ============================================================
--  PARCELAS
-- ============================================================

CREATE TABLE parcelas (
  id           BIGSERIAL       PRIMARY KEY,
  lead_id      INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  contrato_id  BIGINT          REFERENCES contratos(id) ON DELETE CASCADE,
  valor        NUMERIC(14,2)   NOT NULL,
  vencimento   DATE            NOT NULL,
  mes          CHAR(7),                    -- 'YYYY-MM'
  status       VARCHAR(20)     NOT NULL DEFAULT 'pendente',
  -- 'pendente'|'pago'|'atrasado'
  pago_em      TIMESTAMPTZ,
  criado_em    TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parcelas_contrato   ON parcelas(contrato_id);
CREATE INDEX idx_parcelas_lead       ON parcelas(lead_id);
CREATE INDEX idx_parcelas_vencimento ON parcelas(vencimento);
CREATE INDEX idx_parcelas_status     ON parcelas(status);

-- ============================================================
--  CONSÓRCIO — Grupos, Cotas, Assembleias, Lances
-- ============================================================

CREATE TABLE grupos_consorcio (
  id          VARCHAR(60)     PRIMARY KEY,    -- ex: '4003'
  label       VARCHAR(120)    NOT NULL,
  total_cotas SMALLINT        NOT NULL DEFAULT 180,
  ativo       BOOLEAN         NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE TABLE cotas (
  id          BIGSERIAL       PRIMARY KEY,
  grupo_id    VARCHAR(60)     NOT NULL REFERENCES grupos_consorcio(id) ON DELETE CASCADE,
  numero      VARCHAR(10)     NOT NULL,          -- '001', '002', ...
  status      VARCHAR(20)     NOT NULL DEFAULT 'disponivel',
  -- 'disponivel'|'reservada'|'vendida'|'contemplada'
  lead_id     INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  vendedor_id INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
  obs         TEXT,
  atualizado_em TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (grupo_id, numero)
);

CREATE INDEX idx_cotas_grupo  ON cotas(grupo_id);
CREATE INDEX idx_cotas_lead   ON cotas(lead_id);
CREATE INDEX idx_cotas_status ON cotas(status);

CREATE TABLE assembleias (
  id              BIGSERIAL       PRIMARY KEY,
  grupo_id        VARCHAR(60)     NOT NULL REFERENCES grupos_consorcio(id) ON DELETE CASCADE,
  data            DATE            NOT NULL,
  horario         TIME,
  local           VARCHAR(200),
  status          VARCHAR(20)     NOT NULL DEFAULT 'agendada',
  -- 'agendada'|'realizada'|'cancelada'
  num_sorteados   SMALLINT,
  lance_vencedor  VARCHAR(20),                  -- ex: '20.1%'
  criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_assembleias_grupo ON assembleias(grupo_id);
CREATE INDEX idx_assembleias_data  ON assembleias(data);

-- Contemplados na assembleia
CREATE TABLE assembleia_contemplados (
  assembleia_id BIGINT  NOT NULL REFERENCES assembleias(id) ON DELETE CASCADE,
  lead_id       INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  PRIMARY KEY (assembleia_id, lead_id)
);

CREATE TABLE lances (
  id            BIGSERIAL       PRIMARY KEY,
  lead_id       INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  assembleia_id BIGINT          REFERENCES assembleias(id) ON DELETE SET NULL,
  grupo_id      VARCHAR(60)     REFERENCES grupos_consorcio(id) ON DELETE SET NULL,
  percentual    NUMERIC(6,3)    NOT NULL,
  valor_credito NUMERIC(14,2),
  resultado     VARCHAR(30)     NOT NULL DEFAULT 'pendente',
  -- 'vencedor'|'pendente'|'não contemplado'
  criado_em     TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lances_lead       ON lances(lead_id);
CREATE INDEX idx_lances_assembleia ON lances(assembleia_id);

-- ============================================================
--  EQUIPE
-- ============================================================

CREATE TABLE equipe (
  id          SERIAL PRIMARY KEY,
  usuario_id  INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
  nome        VARCHAR(120)    NOT NULL,
  email       VARCHAR(200),
  telefone    VARCHAR(40),
  cargo       VARCHAR(80),
  comissao    NUMERIC(5,2)    NOT NULL DEFAULT 0.00,   -- percentual
  ativo       BOOLEAN         NOT NULL DEFAULT TRUE,
  criado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ============================================================
--  METAS
-- ============================================================

CREATE TABLE metas (
  id              SERIAL PRIMARY KEY,
  mes             CHAR(7)         NOT NULL,       -- 'YYYY-MM'
  usuario_id      INTEGER         REFERENCES usuarios(id) ON DELETE CASCADE,
  prospeccao      INTEGER         NOT NULL DEFAULT 0,
  leads_meta      INTEGER         NOT NULL DEFAULT 0,
  reun_agendadas  INTEGER         NOT NULL DEFAULT 0,
  reun_mes        INTEGER         NOT NULL DEFAULT 0,
  reun_dia        INTEGER         NOT NULL DEFAULT 0,
  vendas          INTEGER         NOT NULL DEFAULT 0,
  criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (mes, usuario_id)
);

CREATE TABLE metas_realizadas (
  id          BIGSERIAL   PRIMARY KEY,
  meta_id     INTEGER     NOT NULL REFERENCES metas(id) ON DELETE CASCADE,
  tipo        VARCHAR(30) NOT NULL,   -- 'prospeccao'|'lead'|'reuniao'|'venda'
  valor       INTEGER     NOT NULL DEFAULT 1,
  referencia  TEXT,                   -- ex: lead_id, reuniao_id
  registrado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metas_mes  ON metas(mes);
CREATE INDEX idx_metas_real ON metas_realizadas(meta_id);

-- ============================================================
--  WHATSAPP
-- ============================================================

-- Vínculo chat WhatsApp ↔ Lead
CREATE TABLE wpp_links (
  id          BIGSERIAL       PRIMARY KEY,
  chat_id     VARCHAR(80)     NOT NULL UNIQUE,  -- ex: '5531...@s.whatsapp.net'
  lead_id     INTEGER         NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wpp_links_lead ON wpp_links(lead_id);

-- Instâncias Evolution API gerenciadas
CREATE TABLE wpp_instancias (
  id              SERIAL PRIMARY KEY,
  instance_name   VARCHAR(80)     NOT NULL UNIQUE,
  usuario_id      INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
  status          VARCHAR(20)     NOT NULL DEFAULT 'disconnected',
  -- 'open'|'connecting'|'disconnected'
  profile_name    VARCHAR(120),
  phone           VARCHAR(30),
  atualizado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

-- Mensagens recebidas/enviadas (persistência server-side)
CREATE TABLE wpp_mensagens (
  id              BIGSERIAL       PRIMARY KEY,
  message_id      VARCHAR(120)    NOT NULL UNIQUE,  -- ID da Evolution API
  chat_id         VARCHAR(80)     NOT NULL,
  instancia_id    INTEGER         REFERENCES wpp_instancias(id) ON DELETE SET NULL,
  lead_id         INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  from_me         BOOLEAN         NOT NULL DEFAULT FALSE,
  tipo            VARCHAR(20)     NOT NULL DEFAULT 'chat',
  -- 'chat'|'image'|'video'|'audio'|'ptt'|'document'|'sticker'|
  -- 'location'|'vcard'|'revoked'
  corpo           TEXT,
  quoted_msg_id   VARCHAR(120),
  media_url       TEXT,
  media_mimetype  VARCHAR(80),
  media_filename  VARCHAR(200),
  ack             SMALLINT        NOT NULL DEFAULT 0,
  -- 0=pendente 1=servidor 2=entregue 3=lido 4=reproduzido
  timestamp_wpp   TIMESTAMPTZ     NOT NULL,
  criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_wpp_msg_chat   ON wpp_mensagens(chat_id);
CREATE INDEX idx_wpp_msg_lead   ON wpp_mensagens(lead_id);
CREATE INDEX idx_wpp_msg_ts     ON wpp_mensagens(timestamp_wpp DESC);
CREATE INDEX idx_wpp_msg_extid  ON wpp_mensagens(message_id);

-- ============================================================
--  CONFIGURAÇÕES DO SISTEMA
-- ============================================================

CREATE TABLE configuracoes (
  chave         VARCHAR(80)  PRIMARY KEY,
  valor         JSONB        NOT NULL,
  descricao     TEXT,
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Por usuário (preferências individuais)
CREATE TABLE configuracoes_usuario (
  usuario_id    INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  chave         VARCHAR(80)  NOT NULL,
  valor         JSONB        NOT NULL,
  atualizado_em TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, chave)
);

-- ============================================================
--  SIMULAÇÕES (histórico)
-- ============================================================

CREATE TABLE simulacoes (
  id              BIGSERIAL       PRIMARY KEY,
  lead_id         INTEGER         REFERENCES leads(id) ON DELETE SET NULL,
  usuario_id      INTEGER         REFERENCES usuarios(id) ON DELETE SET NULL,
  grupo_id        VARCHAR(60)     REFERENCES grupos_consorcio(id) ON DELETE SET NULL,
  credito         NUMERIC(14,2),
  emb_perc        NUMERIC(6,3),
  lances_qty      SMALLINT,
  prazo           SMALLINT,
  taxa            NUMERIC(6,4),
  resultado       JSONB,          -- snapshot completo do resultado
  criado_em       TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_simulacoes_lead ON simulacoes(lead_id);

-- ============================================================
--  NOTIFICAÇÕES
-- ============================================================

CREATE TABLE notificacoes (
  id          BIGSERIAL       PRIMARY KEY,
  usuario_id  INTEGER         REFERENCES usuarios(id) ON DELETE CASCADE,
  tipo        VARCHAR(30)     NOT NULL,   -- 'reuniao'|'lead'|'parcela'|'lance'|'sistema'
  titulo      VARCHAR(200)    NOT NULL,
  corpo       TEXT,
  referencia  JSONB,                      -- { entity: 'reuniao', id: 42 }
  lida        BOOLEAN         NOT NULL DEFAULT FALSE,
  criado_em   TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notif_usuario ON notificacoes(usuario_id, lida);
CREATE INDEX idx_notif_criado  ON notificacoes(criado_em DESC);

-- ============================================================
--  TRIGGERS — atualizado_em automático
-- ============================================================

CREATE OR REPLACE FUNCTION trg_set_atualizado_em()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_usuarios_upd
  BEFORE UPDATE ON usuarios
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER trg_leads_upd
  BEFORE UPDATE ON leads
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER trg_reunioes_upd
  BEFORE UPDATE ON reunioes
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER trg_propostas_upd
  BEFORE UPDATE ON propostas
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER trg_contratos_upd
  BEFORE UPDATE ON contratos
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER trg_equipe_upd
  BEFORE UPDATE ON equipe
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER trg_google_tokens_upd
  BEFORE UPDATE ON google_tokens
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

CREATE TRIGGER trg_wpp_instancias_upd
  BEFORE UPDATE ON wpp_instancias
  FOR EACH ROW EXECUTE FUNCTION trg_set_atualizado_em();

-- ============================================================
--  SEED — Dados iniciais obrigatórios
-- ============================================================

-- Funis padrão
INSERT INTO funis (id, label, cor, padrao) VALUES
  ('vendas',    'Vendas',     '#1a3a5c', TRUE),
  ('wpp',       'WhatsApp',   '#25d366', FALSE),
  ('simulador', 'Simulador',  '#6366f1', FALSE)
ON CONFLICT (id) DO NOTHING;

-- Estágios do funil Vendas
INSERT INTO funil_estagios (id, funil_id, label, cor, ordem) VALUES
  ('inicio',   'vendas', 'Início',        '#94a3b8', 0),
  ('lead',     'vendas', 'Lead',          '#3b82f6', 1),
  ('quali',    'vendas', 'Qualificação',  '#f59e0b', 2),
  ('sim',      'vendas', 'Simulação',     '#8b5cf6', 3),
  ('proposta', 'vendas', 'Proposta',      '#10b981', 4),
  ('contrato', 'vendas', 'Contrato',      '#1a3a5c', 5),
  ('posvenda', 'vendas', 'Pós-venda',     '#64748b', 6)
ON CONFLICT (id) DO NOTHING;

-- Estágios do funil WhatsApp
INSERT INTO funil_estagios (id, funil_id, label, cor, ordem) VALUES
  ('wpp_novo',       'wpp', 'Novo',       '#94a3b8', 0),
  ('wpp_trabalhado', 'wpp', 'Trabalhado', '#3b82f6', 1),
  ('wpp_cliente',    'wpp', 'Cliente',    '#25d366', 2)
ON CONFLICT (id) DO NOTHING;

-- Estágios do funil Simulador
INSERT INTO funil_estagios (id, funil_id, label, cor, ordem) VALUES
  ('sim_simulado',  'simulador', 'Simulado',    '#8b5cf6', 0),
  ('sim_qualif',    'simulador', 'Qualificado', '#f59e0b', 1),
  ('sim_proposta',  'simulador', 'Proposta',    '#10b981', 2)
ON CONFLICT (id) DO NOTHING;

-- Configurações padrão
INSERT INTO configuracoes (chave, valor, descricao) VALUES
  ('tema',             '"light"',             'Tema da interface'),
  ('idioma',           '"pt-BR"',             'Idioma do sistema'),
  ('moeda',            '"BRL"',               'Moeda padrão'),
  ('fuso_horario',     '"America/Sao_Paulo"', 'Fuso horário padrão'),
  ('notif_reunioes',   'true',                'Notificar reuniões próximas'),
  ('notif_parcelas',   'true',                'Notificar parcelas vencendo'),
  ('wpp_auto_lead',    'true',                'Criar lead automático por WhatsApp')
ON CONFLICT (chave) DO NOTHING;

-- ============================================================
--  AUTENTICAÇÃO — Refresh tokens persistidos
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
  id          BIGSERIAL    PRIMARY KEY,
  usuario_id  INTEGER      NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  token_hash  TEXT         NOT NULL UNIQUE,  -- SHA-256 do token, nunca raw
  criado_em   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expira_em   TIMESTAMPTZ  NOT NULL,
  revogado    BOOLEAN      NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_art_usuario ON auth_refresh_tokens(usuario_id);
CREATE INDEX IF NOT EXISTS idx_art_expira  ON auth_refresh_tokens(expira_em);

-- ============================================================
--  AUDIT LOG — Tentativas de login (permitidas e bloqueadas)
-- ============================================================

CREATE TABLE IF NOT EXISTS auth_audit_logs (
  id                  BIGSERIAL     PRIMARY KEY,
  timestamp_utc       TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  -- Quem tentou
  username_digitado   VARCHAR(200),
  usuario_id          INTEGER       REFERENCES usuarios(id) ON DELETE SET NULL,

  -- Rede
  ip                  INET          NOT NULL,
  porta               INTEGER,

  -- Geolocalização por IP (ip-api.com)
  pais                VARCHAR(80),
  estado              VARCHAR(80),
  cidade              VARCHAR(100),
  isp                 VARCHAR(200),
  lat_ip              NUMERIC(10,6),
  lon_ip              NUMERIC(10,6),

  -- Geolocalização por GPS (Navigator.geolocation, enviado pelo front-end)
  lat_gps             NUMERIC(10,6),
  lon_gps             NUMERIC(10,6),

  -- Dispositivo
  user_agent          TEXT,
  os                  VARCHAR(100),
  navegador           VARCHAR(100),

  -- Resultado
  status              VARCHAR(40)   NOT NULL,
  -- 'sucesso' | 'falha_senha' | 'bloqueado_geo' | 'bloqueado_sem_permissao' | 'erro'
  detalhe             TEXT          -- mensagem extra quando relevante
);

CREATE INDEX IF NOT EXISTS idx_aal_timestamp  ON auth_audit_logs(timestamp_utc DESC);
CREATE INDEX IF NOT EXISTS idx_aal_ip         ON auth_audit_logs(ip);
CREATE INDEX IF NOT EXISTS idx_aal_status     ON auth_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_aal_usuario    ON auth_audit_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_aal_username   ON auth_audit_logs(username_digitado);

