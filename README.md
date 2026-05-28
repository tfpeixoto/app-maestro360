# Gênesis — CRM de Consórcios

> Sistema web de CRM especializado em gestão de vendas de consórcios.

---

## Visão Geral

O **Gênesis** é uma SPA (Single Page Application) para gestão do ciclo completo de vendas de consórcios: do primeiro contato até a contemplação. Contempla simulação de portfólio, funil de vendas Kanban, agenda, propostas, contratos, assembleias, lances e controle financeiro.

---

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Vanilla JS + HTML + CSS (SPA sem framework) |
| Backend | Node.js + Express |
| WhatsApp | Evolution API via Docker |
| Banco de dados | PostgreSQL |
| Proxy reverso | NGINX |
| CI/CD | GitHub Actions → SSH → VPS |
| Processo | PM2 |

---

## Estrutura de Pastas

```
genesis/
├── crm.html                    # SPA principal (após login)
├── login.html                  # Tela de autenticação
├── index.html                  # Landing page
├── public/
│   ├── css/                    # Estilos por módulo
│   ├── img/                    # Imagens e logos
│   └── js/                     # Módulos JavaScript (um arquivo por módulo)
├── server/
│   ├── index.js                # Servidor Node.js (auth, API, WPP relay)
│   ├── db.js                   # Conexão PostgreSQL
│   ├── evolution.js            # Integração Evolution API (WhatsApp)
│   ├── middleware/
│   │   ├── auth.js             # Middleware JWT
│   │   └── geoBlock.js         # Bloqueio por geolocalização
│   ├── routes/
│   │   ├── auth.js             # Rotas de autenticação
│   │   └── funil.js            # Rotas do funil de vendas
│   ├── database/
│   │   ├── schema.sql          # Schema completo do banco
│   │   ├── migrate.js          # Script de migração principal
│   │   ├── migrate-auth.js     # Migração de autenticação
│   │   └── migrate-funil.js    # Migração do funil
│   ├── .env.example            # Variáveis de ambiente do servidor
│   ├── .env.evolution.example  # Variáveis da Evolution API
│   ├── docker-compose.yaml     # Evolution API + PostgreSQL + Redis
│   └── package.json
├── .deploy/
│   ├── nginx.conf              # Config NGINX de produção
│   ├── deploy.sh               # Script de deploy manual
│   └── setup-vps.sh            # Setup inicial da VPS
├── .github/
│   └── workflows/
│       ├── deploy.yml          # CI/CD automático (push → VPS)
│       └── update-whatsapp-lib.yml  # Atualização semanal da lib WPP
├── scripts/
│   └── update-version.sh       # Gera public/js/version.js no deploy
├── SISTEMA.md                  # Documentação técnica completa (39 seções)
├── CRUD.md                     # Referência rápida das operações de dados
└── FLUXOS.md                   # Fluxos de negócio detalhados
```

---

## Módulos do Sistema (25)

| # | Módulo | Arquivo JS |
|---|--------|-----------|
| 1 | Home | `home.js` (embutido em crm.html) |
| 2 | Dashboard | `dashboard.js` |
| 3 | Decisões / Analytics | `decisoes.js` |
| 4 | Simulador de Portfólio | `simulador.js` + `funil-modal.js` |
| 5 | Comparativo | `comparativo.js` |
| 6 | Histórico de Simulações | `hist-sim.js` |
| 7 | Agenda | `agenda.js` |
| 8 | Funil de Vendas (Kanban) | `funil-render.js` + `funil-data.js` + `funil-modal.js` |
| 9 | Clientes | `clientes.js` |
| 10 | Chat & E-mail | `email.js` |
| 11 | Marketing & Leads | `comunicacao.js` |
| 12 | Propostas | `propostas.js` |
| 13 | Contratos | `contratos.js` |
| 14 | Quadro de Cotas | `cotas.js` |
| 15 | Vendidos | `vendidos.js` |
| 16 | Lances | `lances.js` |
| 17 | Contemplados (API Externa) | `contemplados.js` + `cotas-api.js` |
| 18 | Assembleias | `assembleias.js` |
| 19 | Parcelas | `parcelas.js` |
| 20 | Inadimplência | `inadimplencia.js` |
| 21 | Equipe | `equipe.js` |
| 22 | Metas & Objetivos | `metas.js` |
| 23 | Google Drive | `documentos.js` |
| 24 | Logs de Acesso | `logs-acesso.js` |
| 25 | Configurações | `config.js` |

---

## Setup Local

### Pré-requisitos

- Node.js 20+
- Docker + Docker Compose
- PostgreSQL 15+ (ou via Docker)

### 1. Clonar e instalar dependências

```bash
git clone https://github.com/sua-org/seu-repositorio.git genesis
cd genesis/server
npm install
```

### 2. Configurar variáveis de ambiente

```bash
cp server/.env.example server/.env
# Editar server/.env com suas credenciais
```

Campos obrigatórios no `.env`:

```env
PORT=3003
DATABASE_URL=postgresql://usuario:senha@localhost:5432/genesis
JWT_SECRET=uma-string-longa-e-aleatoria
```

### 3. Subir a Evolution API (WhatsApp)

```bash
cp server/.env.evolution.example server/.env.evolution
# Editar server/.env.evolution conforme necessário
cd server
docker-compose up -d
```

### 4. Criar o banco de dados

```bash
node server/database/migrate.js
```

### 5. Iniciar o servidor

```bash
# Desenvolvimento
node server/index.js

# Produção (PM2)
pm2 start server/index.js --name genesis-api
pm2 start server/evolution.js --name genesis-wpp
pm2 save
```

### 6. Abrir no navegador

```
http://localhost:3003
```

---

## Deploy em Produção (VPS)

### Pré-requisitos na VPS

- Ubuntu 22.04+
- Node.js 20, PM2, NGINX, Docker, Git, Certbot

### Setup inicial

```bash
# Editar o script com seu domínio e e-mail
nano .deploy/setup-vps.sh
bash .deploy/setup-vps.sh
```

### CI/CD automático (GitHub Actions)

Push para `main` aciona automaticamente:
1. SSH na VPS
2. `git pull origin main`
3. `npm install --production`
4. Reinicio do PM2
5. Reload do NGINX

**Secret necessário no repositório:**

| Secret | Valor |
|--------|-------|
| `VPS_SSH_KEY` | Chave SSH privada para acesso à VPS |

### Configurar o secret

```
GitHub → Settings → Secrets and variables → Actions → New repository secret
```

---

## NGINX — Rotas Principais

| Rota | Destino |
|------|---------|
| `/` | Arquivos estáticos (SPA) |
| `/api/` | Servidor Node.js (porta 3000) |
| `/wpp/` | Evolution API / WhatsApp (porta 3003) |

---

## Autenticação

- **JWT** com expiração de 8 horas
- Token armazenado em `localStorage.crm_auth`
- **Detecção de fechamento de browser** via `sessionStorage.crm_session_alive`
- **Timeout de inatividade** de 30 minutos com aviso de 2 minutos
- **Bloqueio por geolocalização** opcional (configurável em `server/middleware/geoBlock.js`)

---

## Documentação

| Arquivo | Conteúdo |
|---------|----------|
| `SISTEMA.md` | Documentação técnica completa: todos os módulos, campos, fluxos, schema do banco, rotas da API, deploy |
| `CRUD.md` | Referência rápida das operações de dados |
| `FLUXOS.md` | Fluxos de negócio: prospecção → contemplação, assembleias, inadimplência |

---

## Versão

A versão é gerada automaticamente no deploy e gravada em `public/js/version.js`:

```
v{MAJOR}.{COUNT} · DD/MM/AAAA · #{HASH}
```

Exibida no rodapé de todas as telas.
