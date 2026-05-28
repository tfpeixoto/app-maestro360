# Maestro 360 — CRM de Consórcios

> Sistema web de CRM especializado em vendas de consórcios, desenvolvido para a **Chave Mestre Soluções**.

---

## Sumário

- [Visão Geral](#visão-geral)
- [Stack Técnica](#stack-técnica)
- [Estrutura de Arquivos](#estrutura-de-arquivos)
- [Páginas e Fluxos](#páginas-e-fluxos)
- [Módulos JavaScript](#módulos-javascript)
- [Modelo de Dados (localStorage)](#modelo-de-dados-localstorage)
- [APIs Externas](#apis-externas)
- [Servidor WhatsApp](#servidor-whatsapp)
- [Instalação e Uso Local](#instalação-e-uso-local)
- [Deploy](#deploy)
- [O que ainda precisa ser construído](#o-que-ainda-precisa-ser-construído)
- [Bugs conhecidos](#bugs-conhecidos)

---

## Visão Geral

O **Maestro 360** é uma SPA (Single Page Application) **100% client-side** para gestão do ciclo completo de vendas de consórcios. Toda a persistência é via `localStorage` do navegador — não há banco de dados backend (ainda).

### Funcionalidades ativas

| Módulo | Descrição |
|--------|-----------|
| Funil de Vendas | Kanban multi-funil com etapas customizáveis |
| Clientes | Cadastro, perfil, histórico, etiquetas, conversas salvas |
| Simulador | Wizard 6 etapas: cliente → crédito → portfólio → parâmetros → resumo |
| Comparativo | Consórcio × Financiamento com iframes |
| Histórico de Simulações | Todas as simulações salvas por lead |
| Agenda | Reuniões com Google Calendar, metas diárias/mensais |
| Metas & KPIs | Dashboard de metas com sparklines, progresso automático |
| Chat WhatsApp | Integração WhatsApp Web via Socket.io |
| E-mail (Gmail) | Leitura e envio de e-mails via Google OAuth |
| Cotas (quadro local) | Quadro visual dos grupos 4003/4004 com localStorage |
| Cotas Disponíveis (API) | Transferências via API Credicob |
| Contemplados | Listagem de cotas contempladas |
| Parcelas | Controle de parcelas por cota |
| Assembleias | Registro de assembleias mensais |
| Lances | Histórico de lances por grupo |
| Propostas | Geração e acompanhamento *(parcial)* |
| Dashboard | KPIs, gráficos, funil visual |

---

## Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | HTML5, CSS3, JavaScript ES6+ (vanilla — sem framework) |
| Persistência | `localStorage` (browser) |
| Estilos | CSS customizado + Bootstrap Icons |
| Servidor estático | NGINX |
| Servidor WhatsApp | Node.js + Express + **Evolution API** + Socket.io |
| Deploy | GitHub Actions → SSH → VPS |
| Build | Scripts Bash (geração de versão) |

> Não há `package.json`, bundler ou framework JS no frontend. Intencionalmente simples e portável.

---

## Estrutura de Arquivos

```
Maestro360/
├── crm.html                  # ← APLICAÇÃO PRINCIPAL (SPA inteira)
├── comparativo.html          # Comparativo consórcio × financiamento (carregado em iframe)
├── historico.html            # Histórico de cotas de um grupo (carregado em iframe)
├── simulador.html            # Simulador standalone (não usado diretamente no CRM)
├── index.html                # Landing page de marketing
├── login.html                # Tela de login (sem backend ainda)
├── logo-preview.html         # Preview de ativos visuais
│
├── public/
│   ├── css/
│   │   └── style.css         # Estilos globais da SPA
│   ├── js/
│   │   ├── funil-data.js     # ★ Data layer principal (leads, funnels, localStorage)
│   │   ├── funil-render.js   # Kanban do funil de vendas
│   │   ├── funil-modal.js    # Modal criar/editar lead
│   │   ├── clientes.js       # ★ Módulo de clientes/perfis (114 KB)
│   │   ├── simulador.js      # ★ Wizard do simulador (6 etapas)
│   │   ├── hist-sim.js       # Histórico de simulações
│   │   ├── agenda.js         # Agenda + Google Calendar + metas de reuniões
│   │   ├── metas.js          # Metas & KPIs automáticos
│   │   ├── comunicacao.js    # WhatsApp Web + Gmail (94 KB)
│   │   ├── email.js          # Gmail API client
│   │   ├── google-auth.js    # Google OAuth 2.0
│   │   ├── api.js            # ★ API Credicob (cotas disponíveis para transferência)
│   │   ├── cotas.js          # Quadro de cotas locais (grupos 4003/4004)
│   │   ├── cotas-api.js      # Página de cotas via API externa
│   │   ├── vendidos.js       # Resumo de cotas vendidas
│   │   ├── contemplados.js   # Cotas contempladas
│   │   ├── parcelas.js       # Parcelas por cota
│   │   ├── lances.js         # Lances por assembleia
│   │   ├── assembleias.js    # Assembleias mensais
│   │   ├── propostas.js      # Propostas comerciais
│   │   ├── contratos.js      # Contratos fechados
│   │   ├── inadimplencia.js  # Inadimplência (esqueleto)
│   │   ├── equipe.js         # Equipe de vendas (esqueleto)
│   │   ├── decisoes.js       # Acompanhamento "Comprar × Alugar × Consórcio"
│   │   ├── config.js         # Painel de configurações do sistema
│   │   ├── documentos.js     # Google Drive (esqueleto)
│   │   ├── version.js        # Número de versão (gerado pelo build)
│   │   │
│   │   # ── Arquivos vazios (placeholders para futuro refactor) ──
│   │   ├── clientes-form.js      # (vazio — lógica em clientes.js)
│   │   ├── clientes-lista.js     # (vazio)
│   │   ├── clientes-perfil.js    # (vazio)
│   │   ├── crm-nav.js            # (vazio — nav está em crm.html)
│   │   ├── crm-store.js          # (vazio)
│   │   ├── dashboard-kpi.js      # (vazio — lógica inline em crm.html)
│   │   ├── dashboard-charts.js   # (vazio — lógica inline em crm.html)
│   │   ├── proposta-pdf.js       # (vazio — PDF não implementado)
│   │   ├── proposta-render.js    # (vazio)
│   │   └── app-footer.js         # Footer mínimo
│   │
│   └── img/                  # Logos e imagens
│
├── server/                   # Servidor Node.js para WhatsApp Web
│   ├── index.js              # ★ Express + Socket.io + rotas REST
│   ├── evolution.js          # Cliente Evolution API (webhook + REST proxy)
│   ├── whatsapp.js           # ← legado whatsapp-web.js (não mais usado)
│   ├── package.json          # Dependências do servidor
│   ├── .env.example          # Template de variáveis de ambiente
│   ├── db.js                 # ⚠️ VAZIO — sem backend de banco de dados
│   ├── middleware/
│   │   └── auth.js           # ⚠️ VAZIO — autenticação não implementada
│   └── routes/               # ⚠️ TODOS VAZIOS — sem API REST de dados
│       ├── leads.js
│       ├── clientes.js
│       ├── propostas.js
│       ├── simulacoes.js
│       └── auth.js
│
├── .deploy/
│   ├── nginx.conf            # Configuração NGINX de produção
│   └── deploy.sh             # Script de deploy manual
│
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions: push main → deploy VPS
│
├── scripts/
│   └── update-version.sh     # Gera version.js com número da versão atual
│
├── README.md                 # Este arquivo
├── CRUD.md                   # Documentação completa do data layer
└── MELHORIAS.md              # Bugs e melhorias catalogadas
```

---

## Páginas e Fluxos

Toda a navegação acontece dentro de `crm.html`. Cada "página" é uma `<div class="page" id="page-X">` que exibe/oculta via classe `.active`. A função `navigate(page, el)` gerencia a transição e chama o `init*()` correspondente.

---

### 🏠 Home (`page-home`)

**O que faz:** Boas-vindas com cards de atalho rápido para os principais módulos.

**Fluxo:**
1. Exibida ao abrir o CRM
2. Cards de atalho: Funil, Clientes, Simulador, Histórico de Simulações
3. Não carrega dados — apenas redireciona via `navigate()`

---

### 📊 Dashboard (`page-dashboard`)

**O que faz:** KPIs do mês atual, funil visual de leads, gráficos de desempenho e reuniões do dia.

**Fluxo:**
1. `navigate('dashboard')` → `initDashboard()` (inline em `crm.html`)
2. Lê `crm_leads` para contagem por etapa e métricas do mês
3. Lê `crm_reunioes` para reuniões do dia e semana atual (**automático**)
4. Lê `crm_metas` para comparar realizado × meta
5. Lê `crm_metas_history` para gráficos dos últimos 12 meses
6. Detecta modo demo (sem leads) e exibe dados fictícios com banner de aviso

**KPIs exibidos:** Prospecção, Leads, Reuniões Agendadas, Reuniões Realizadas, Vendas, Reuniões de Hoje.

---

### 🔭 Acompanhamento (`page-decisoes`)

**O que faz:** Ferramenta de comparação financeira "Comprar × Alugar × Consórcio".

**Fluxo:**
1. Usuário preenche parâmetros (valor imóvel, aluguel mensal, prazo, etc.)
2. Sistema calcula e compara os três cenários lado a lado
3. Exibe gráficos e recomendação personalizada

**Arquivo:** `public/js/decisoes.js`

---

### 🧮 Simulador (`page-simulador`)

**O que faz:** Wizard de 6 etapas para montar um portfólio de consórcio personalizado.

**Fluxo detalhado:**

| Etapa | Nome | O que coleta / faz |
|-------|------|-------------------|
| 0 | Cliente | Nome, telefone (máscara `(DD) DDDDD-DDDD`), CPF (máscara `000.000.000-00`), busca lead existente pelo CPF |
| 1 | Objetivo | Tipo (imóvel/carro/financeiro/outro), crédito desejado, aporte mensal disponível |
| 2 | Capacidade | Confirmação do aporte, tolerância a risco |
| 3 | Portfólio | Grid de grupos/cotas — **pré-seleção automática** pelo crédito/aporte (`_simAutoPortfolio()`) |
| 4 | Parâmetros | Mês esperado de contemplação, % de embalo |
| 5 | Resumo | Hero dark com 4 métricas principais, composição do portfólio, timeline visual |

**Comportamento ao finalizar:**
- Salva em `crm_sim_result`
- Se lead existe por CPF → adiciona simulação ao histórico do lead
- Se não existe → cria novo lead no funil `simulador`, etapa `sim_novo`

**Arquivo:** `public/js/simulador.js`

---

### 📋 Funil de Vendas (`page-funil`)

**O que faz:** Board Kanban de leads organizados por etapas, com suporte a múltiplos funis.

**Fluxo:**
1. Selector de funil no topo (Vendas / WhatsApp / Simulador ou criados pelo usuário)
2. Cada coluna = uma etapa do funil selecionado
3. Arrastar card entre colunas move o lead e registra no histórico
4. "Editar Board" ativa modo de edição (renomear, reordenar, excluir etapas)
5. Clicar no card abre perfil completo do lead

**Funnels padrão:**

| Funil | Etapas |
|-------|--------|
| `vendas` | Início → Lead → Qualificação → Simulação → Proposta → Contrato → Pós-venda |
| `wpp` | Novo → Trabalhado → Cliente |
| `simulador` | Simulado → Qualificado → Proposta |

**Leads do WhatsApp** entram automaticamente no funil `wpp` / etapa `wpp_novo`.
**Leads do Simulador** entram automaticamente no funil `simulador` / etapa `sim_novo`.

**Arquivos:** `public/js/funil-render.js`, `public/js/funil-modal.js`, `public/js/funil-data.js`

---

### 👥 Clientes (`page-clientes`)

**O que faz:** Lista completa de leads/clientes com busca, filtros e perfil detalhado.

**Fluxo da lista:**
1. Exibe todos os leads com busca por nome/telefone/email
2. Filtros por etapa e origem
3. Clicar → abre perfil completo do lead

**Perfil do lead:**
- Header com gradiente escuro: avatar, nome, funil e etapa atuais
- Seções: Contato, Negócio (objetivo/crédito/aporte), Pipeline (linha do tempo visual), Etiquetas, Notas
- Painel lateral: WhatsApp, Agendar Reunião, Mover Etapa, Trocar Funil
- Histórico de simulações vinculadas ao lead
- Conversas WhatsApp salvas

**Arquivo:** `public/js/clientes.js`

---

### 💬 Comunicação (`page-comunicacao`)

**O que faz:** Chat WhatsApp Web e e-mail Gmail integrados em uma única tela.

**Fluxo WhatsApp:**
1. Primeira vez: exibe QR code para escanear com o celular
2. Após conectar: lista chats à esquerda, conversa à direita (tempo real via Socket.io)
3. Contatos novos detectados → lead criado automaticamente em `wpp` / `wpp_novo`
4. "Salvar conversa" → registra em `lead.conversasSalvas`

**Fluxo Gmail:**
1. "Conectar Google" → OAuth 2.0
2. Lista threads, lê mensagens, responde e envia novos e-mails

**Arquivos:** `public/js/comunicacao.js`, `public/js/email.js`, `public/js/google-auth.js`

---

### 🔍 Enriquecer Lead (`page-enriquecer`)

**O que faz:** Consulta dados externos para enriquecer cadastros (CPF, CNPJ, etc.).

**Status:** Interface presente. Integrações externas a definir conforme necessidade.

---

### 📈 Comparativo (`page-comparativo`)

**O que faz:** Dois iframes sobrepostos com abas — Comparativo e Histórico do Grupo.

**Fluxo:**
1. Aba "Comparativo" → carrega `comparativo.html` (cálculo consórcio × financiamento com simulação atual)
2. Aba "Histórico do Grupo de Cotas" → carrega `historico.html` (histórico de lances/contemplações)
3. Se não há simulação recente → botão direciona ao Simulador (não à home)

**Arquivos:** `comparativo.html`, `historico.html` (iframes); lógica de abas inline em `crm.html`

---

### 📜 Histórico de Simulações (`page-hist-sim`)

**O que faz:** Tabela com todas as simulações de todos os leads, com busca e filtros.

**Fluxo:**
1. Lê `crm_leads`, coleta todos os arrays `lead.simulacoes`
2. Ordena por data (mais recente primeiro)
3. Exibe stats, busca livre e tabela
4. "Ver Perfil" → `openPerfil(lead.id)` abre o lead correspondente

**Arquivo:** `public/js/hist-sim.js`

---

### 📅 Agenda (`page-agenda`)

**O que faz:** Gestão de reuniões com 4 visualizações + integração Google Calendar + barra de metas.

**Fluxo:**
1. Criar reunião (online/presencial), data/hora/duração/lead vinculado
2. Se Google conectado → cria evento no Calendar + gera link Meet automaticamente
3. Barra de metas no topo mostra progresso em tempo real (hoje / agendadas/mês / realizadas/mês)
4. "Marcar como Realizada" → atualiza status + chama `mtSnapshotMes()` automaticamente

**Visualizações:** Lista, Semana, Mês, Dia.

**Arquivo:** `public/js/agenda.js`

---

### 🎯 Metas & Objetivos (`page-metas`)

**O que faz:** KPIs configuráveis com progresso calculado automaticamente dos dados reais.

**Métricas e suas fontes:**

| Métrica | De onde vem |
|---------|------------|
| Prospecção/mês | Leads criados no mês (`crm_leads`) |
| Leads/mês | Leads em etapas avançadas |
| Reuniões agendadas/mês | `crm_reunioes` (qualquer status) |
| Reuniões realizadas/mês | `crm_reunioes` com `status: 'realizada'` |
| Reuniões hoje | `crm_reunioes` com `data === hoje` |
| Vendas/mês | Leads em `contrato` ou `posvenda` no mês |

**Funcionalidades:** KPI cards com sparkline 6 meses, barras de progresso, tabela histórica, "Registrar Mês" para snapshot manual.

**Arquivo:** `public/js/metas.js`

---

### 📁 Propostas (`page-propostas`)

**O que faz:** Criar e acompanhar propostas comerciais vinculadas a leads.

**Status:** CRUD básico (criar, listar, alterar status). Sem geração de PDF.

**Arquivo:** `public/js/propostas.js` | `public/js/proposta-pdf.js` *(vazio)*

---

### 📝 Contratos (`page-contratos`)

**O que faz:** Registrar contratos assinados vinculados a leads.

**Status:** CRUD básico presente. Sem geração de documento.

**Arquivo:** `public/js/contratos.js`

---

### 🟦 Cotas — Quadro (`page-cotas`)

**O que faz:** Grid visual dos grupos de cotas com status por cota.

**Fluxo esperado (produção):**
1. Carregar grupos e cotas da API do consórcio
2. Grid colorido por status: disponível / reservada / vendida / contemplada
3. Clicar na cota → modal com detalhes, registrar venda/reserva via API

**Estado atual (placeholder):**
- Os grupos `4003` e `4004` são **exemplos fictícios hardcoded** — os grupos reais devem vir da API
- O total de 180 cotas por grupo também é fictício
- Status das cotas salvo em `crm_cotas` (localStorage) — **não reflete dados reais**
- Registro de venda **não está implementado** via API

> ⚠️ **TODO:** Substituir `GRUPOS` em `cotas.js` por chamada à API do consórcio. A mesma API deve registrar vendas e reservas de cotas.

**Arquivo:** `public/js/cotas.js`

---

### 🔗 Cotas Disponíveis — API (`page-cotas-api`)

**O que faz:** Lista cotas disponíveis para transferência lidas da API Credicob.

**Fluxo:**
1. `initCotasApi()` → chama `fetchCotas()` na API `https://api.themedeploy.com/api/credicob`
2. Exibe cards com crédito, parcela, categoria e disponibilidade
3. Filtros: categoria (Imóvel/Veículo), disponíveis apenas, busca livre
4. "Reservar" → `marcarCotaVendida(cod)` → `PATCH` na API

> ⚠️ Credenciais `API_USER` e `API_PASS` em `api.js` estão vazias. Preencher antes de usar.

**Arquivos:** `public/js/api.js`, `public/js/cotas-api.js`

---

### ✅ Contemplados (`page-contemplados`)

**O que faz:** Lista e gerencia cotas contempladas no período.

**Arquivo:** `public/js/contemplados.js`

---

### 💵 Parcelas (`page-parcelas`)

**O que faz:** Controle de parcelas pagas/pendentes por cota.

**Arquivo:** `public/js/parcelas.js`

---

### 🏆 Lances (`page-lances`)

**O que faz:** Registro e histórico de lances por assembleia e grupo.

**Arquivo:** `public/js/lances.js`

---

### 🏛️ Assembleias (`page-assembleias`)

**O que faz:** Registro das assembleias mensais (data, grupo, lance vencedor, resultado).

**Arquivo:** `public/js/assembleias.js`

---

### ⚠️ Inadimplência (`page-inadimplencia`)

**O que faz:** Lista clientes com parcelas em atraso.

**Status:** Esqueleto presente. Lógica de cálculo de atraso ainda a implementar.

**Arquivo:** `public/js/inadimplencia.js`

---

### 👨‍💼 Equipe (`page-equipe`)

**O que faz:** Gestão da equipe de vendas com metas individuais e comissões.

**Status:** Marcado "Em construção". Estrutura base presente, sem lógica de comissões.

**Arquivo:** `public/js/equipe.js`

---

### 📂 Documentos (`page-documentos`)

**O que faz:** Gestão de documentos por cliente via Google Drive.

**Status:** Google Auth funcional. UI de listagem e upload de documentos não implementada.

**Arquivo:** `public/js/documentos.js`

---

### ⚙️ Configurações (`page-config`)

**O que faz:** Painel de configuração do sistema.

**Campos:**
- Dados da empresa (nome, CNPJ, telefone, e-mail, site, endereço)
- URL do servidor WhatsApp (padrão: `/wpp`)
- Google Client ID para OAuth
- Credenciais da API Credicob (API_USER / API_PASS)

**Arquivo:** `public/js/config.js`

---

## Módulos JavaScript

### Ordem de carregamento no `crm.html`

A ordem importa — `funil-data.js` deve vir primeiro pois exporta funções base usadas por todos os demais.

```html
<script src="public/js/funil-data.js"></script>   <!-- ← sempre primeiro -->
<script src="public/js/funil-render.js"></script>
<script src="public/js/funil-modal.js"></script>
<script src="public/js/google-auth.js"></script>
<script src="public/js/agenda.js"></script>
<script src="public/js/metas.js"></script>
<script src="public/js/comunicacao.js"></script>
<script src="public/js/email.js"></script>
<script src="public/js/clientes.js"></script>
<script src="public/js/config.js"></script>
<script src="public/js/decisoes.js"></script>
<script src="public/js/api.js"></script>
<script src="public/js/cotas.js"></script>
<script src="public/js/cotas-api.js"></script>
<script src="public/js/vendidos.js"></script>
<script src="public/js/contemplados.js"></script>
<script src="public/js/parcelas.js"></script>
<script src="public/js/lances.js"></script>
<script src="public/js/assembleias.js"></script>
<script src="public/js/propostas.js"></script>
<script src="public/js/contratos.js"></script>
<script src="public/js/inadimplencia.js"></script>
<script src="public/js/equipe.js"></script>
<script src="public/js/documentos.js"></script>
<script src="public/js/simulador.js"></script>
<script src="public/js/hist-sim.js"></script>
<script src="public/js/version.js"></script>
```

> **Regra importante:** Todos os scripts compartilham o escopo global (`window`). Nunca declare `const` ou `let` no topo de um arquivo com o mesmo nome de outro arquivo — causará `SyntaxError` de redeclaração. Use nomes únicos ou prefixos por módulo (ex: `SIM_GRUPOS` em vez de `GRUPOS`).

---

## Modelo de Dados (localStorage)

Ver **[CRUD.md](./CRUD.md)** para documentação completa com exemplos de cada operação.

### Resumo das chaves

| Chave | Tipo | Descrição |
|-------|------|-----------|
| `crm_leads` | `Lead[]` | Todos os leads/clientes |
| `crm_funnels` | `Funnel[]` | Definições de funis e etapas |
| `crm_cotas` | `{[cod]: CotaStatus}` | Status local das cotas dos grupos |
| `crm_propostas` | `Proposta[]` | Propostas comerciais |
| `crm_contratos` | `Contrato[]` | Contratos fechados |
| `crm_parcelas` | `Parcela[]` | Parcelas por cota |
| `crm_assembleias` | `Assembleia[]` | Assembleias mensais |
| `crm_lances` | `Lance[]` | Lances por assembleia |
| `crm_equipe` | `Membro[]` | Equipe de vendas |
| `crm_metas` | `MetasObj` | Metas numéricas configuradas |
| `crm_metas_history` | `{[YYYY-MM]: MetasObj}` | Histórico mensal de metas |
| `crm_reunioes` | `Reuniao[]` | Reuniões agendadas |
| `crm_config` | `ConfigObj` | Configurações do sistema |
| `crm_google_token` | `GoogleToken` | Token OAuth Google |
| `crm_wpp_links` | `{[leadId]: WppLink}` | Mapeamento lead ↔ contato WhatsApp |
| `crm_sim_result` | `SimResult` | Última simulação gerada |

### Estrutura do Lead

```js
{
  id: number,
  nome: string,
  telefone: string,         // "(11) 99999-0001"
  email: string,
  origem: string,           // 'WhatsApp' | 'Instagram' | 'Indicação' | 'Site' | 'Ligação' | 'Outro'
  objetivo: string,         // 'Comprar Imóvel' | 'Comprar Carro' | 'Ganho Financeiro' | 'Capital de Giro' | 'Outro'
  valorDesejado: number,    // crédito desejado em R$
  aporteMensal: number,     // parcela que consegue pagar
  stage: string,            // id da etapa atual (ex: 'lead', 'sim_novo', 'wpp_novo')
  funnel: string,           // id do funil (ex: 'vendas', 'wpp', 'simulador')
  obs: string,
  criadoEm: string,         // ISO 8601
  atualizadoEm: string,     // ISO 8601
  historico: [{ texto: string, data: string }],
  notas: [{ id: number, texto: string, criadoEm: string }],
  tags: [{ label: string, cor: string }],
  conversasSalvas: [{ id, fonte, chatName, mensagens, nota, criadoEm }],
  simulacoes: [SimResult],  // simulações vinculadas a este lead
}
```

---

## APIs Externas

### 1. Credicob — Cotas disponíveis para transferência

**Base URL:** `https://api.themedeploy.com/api/credicob`

**Arquivo:** `public/js/api.js`

> ⚠️ Credenciais vazias — preencher antes de usar em produção.

```js
// api.js — linhas 7-8:
const API_USER = '';   // ← usuário da API
const API_PASS = '';   // ← senha da API
```

**Endpoints:**

| Método | Path | Descrição |
|--------|------|-----------|
| `GET` | `/` | Lista todas as cotas |
| `GET` | `/{cod}` | Detalhes de uma cota |
| `PATCH` | `/{cod}` | Marca como reservada/vendida |

Cache de 5 minutos em memória. Invalida após qualquer alteração.

---

### 2. API de Gestão do Consórcio — ❌ NÃO INTEGRADA

> **Este é o ponto mais crítico de desenvolvimento pendente.**

Toda a gestão operacional de cotas (grupos, status, vendas, assembleias, lances) usa **localStorage com dados fictícios**. Os grupos `4003` e `4004` visíveis no sistema são **exemplos hardcoded** — os grupos reais, suas cotas e quantidades devem vir desta API.

**O que a API de gestão precisa cobrir:**

| Dado | Módulo afetado | Arquivo a modificar |
|------|---------------|---------------------|
| **Lista de grupos** (id, nome, total de cotas) | `page-cotas`, `page-simulador` | `cotas.js`, `simulador.js` |
| **Status de cada cota** por grupo | `page-cotas` | `cotas.js` |
| **Registrar venda/reserva** de cota | `page-cotas` | `cotas.js` |
| Histórico de assembleias | `page-assembleias` | `assembleias.js` |
| Lances por grupo e assembleia | `page-lances` | `lances.js` |
| Cotas contempladas | `page-contemplados` | `contemplados.js` |
| Parcelas pagas/pendentes | `page-parcelas` | `parcelas.js` |

**Hoje, apenas a listagem de cotas de transferência (contempladas disponíveis para revenda) usa API real** via `api.js` + `cotas-api.js`.

---

### 3. Google APIs (OAuth 2.0)

**Arquivo:** `public/js/google-auth.js`

**Pré-requisito:** Configurar Google Client ID em **Configurações → Google Client ID**.

| Serviço | Scope | Uso |
|---------|-------|-----|
| Calendar | `calendar.events` | Criar reuniões + links Google Meet |
| Drive | `drive.file` | Pastas por cliente + upload de documentos |
| Gmail | `gmail.modify` + `gmail.send` | Leitura e envio de e-mails |

---

## Servidor WhatsApp

O servidor Node.js (`server/`) é um **relay** entre o frontend e a [Evolution API](https://github.com/evolution-foundation/evolution-api). Roda na porta `3001`.

### Arquitetura

```
Browser (comunicacao.js)
  │  Socket.io  (/wpp/socket.io)
  │  REST API   (/wpp/*)
  ▼
server/index.js  ← porta 3001
  │  REST API calls (axios)
  ▼
Evolution API    ← porta 8080
  │  webhook POST
  └─────────────► server/index.js /webhook
```

O NGINX faz proxy de `/wpp/*` → `http://localhost:3001/*` (strip de prefixo).

### Configuração

Copie `server/.env.example` para `server/.env` e preencha:

```bash
EVO_URL=http://localhost:8080       # URL da Evolution API
EVO_API_KEY=SUA_CHAVE_AQUI          # AUTHENTICATION_API_KEY do .env da Evolution
EVO_INSTANCE=maestro360             # Nome da instância na Evolution
EVO_WEBHOOK_URL=http://127.0.0.1:3001/webhook  # URL que a Evolution vai chamar
PORT=3001
```

### Rotas REST

| Método | Path | Descrição |
|--------|------|-----------|
| `POST` | `/webhook` | Recebe eventos da Evolution API |
| `GET` | `/health` | Status do servidor |
| `GET` | `/status` | Status da conexão WhatsApp |
| `GET` | `/chats` | Lista de chats |
| `GET` | `/messages/:chatId` | Mensagens de um chat (`?limit=40`) |
| `POST` | `/send/text` | Enviar mensagem de texto |
| `POST` | `/send/media` | Enviar mídia (max 16MB) |
| `POST` | `/read/:chatId` | Marcar como lido |
| `POST` | `/disconnect` | Desconectar WhatsApp |
| `POST` | `/reinit` | Gerar novo QR code |

### Socket.io Events

| Evento | Direção | Descrição |
|--------|---------|-----------|
| `wpp:status` | Server → Client | `disconnected` / `qr` / `connecting` / `ready` |
| `wpp:ready` | Server → Client | `{ name, phone }` ao conectar |
| `wpp:qr` | Server → Client | QR code como data URL |
| `wpp:message` | Server → Client | Nova mensagem (recebida ou enviada) |
| `wpp:message_ack` | Server → Client | `{ id, ack }` — status de entrega |
| `wpp:error` | Server → Client | Erro de conexão |

### Iniciar o servidor

```bash
cd server
cp .env.example .env     # editar com os valores corretos
npm install
node index.js            # produção
npm run dev              # desenvolvimento (nodemon)
```

### Subir a Evolution API (Docker)

```bash
cd server
# Copiar e editar o docker-compose e .env da Evolution API
docker compose up -d
```

A Evolution ficará em `http://localhost:8080` com painel manager em `http://localhost:3000`.

---

## Instalação e Uso Local

### Frontend (estático)

```bash
npx serve .
# ou
python3 -m http.server 8080
```

### Servidor WhatsApp

```bash
# 1. Subir a Evolution API
docker compose -f server/docker-compose.yaml up -d

# 2. Subir o relay Node.js
cd server
cp .env.example .env   # preencher EVO_URL, EVO_API_KEY, EVO_INSTANCE, etc.
npm install
node index.js
```

### Google OAuth — Setup

1. Criar projeto no Google Cloud Console
2. Ativar APIs: Calendar, Drive, Gmail
3. Criar credencial OAuth 2.0 → Web Application
4. Adicionar domínio nos "Authorized JavaScript origins"
5. Copiar Client ID → **Configurações** → Google Client ID no CRM

---

## Deploy

Deploy automático via **GitHub Actions** a cada push na branch `main`.

### Fluxo

```
push → main
  ↓
.github/workflows/deploy.yml
  ↓
scripts/update-version.sh   ← atualiza public/js/version.js
  ↓
rsync via SSH → /var/www/maestro360/
  ↓
pm2 restart maestro360-wpp  ← reinicia servidor WhatsApp
```

### Secrets necessários no GitHub

| Secret | Descrição |
|--------|-----------|
| `SSH_HOST` | IP ou domínio do VPS |
| `SSH_USER` | Usuário SSH |
| `SSH_KEY` | Chave privada SSH |
| `SSH_PORT` | Porta SSH (padrão: 22) |

As variáveis de ambiente do servidor WhatsApp (`EVO_URL`, `EVO_API_KEY`, etc.) devem estar no `server/.env` no VPS — **não versionar esse arquivo**.

---

## O que ainda precisa ser construído

### 🔴 Crítico — bloqueiam uso real em produção

| # | Item | Arquivos | Descrição |
|---|------|----------|-----------|
| 1 | **Integrar API de gestão do consórcio** | `cotas.js`, `simulador.js`, `assembleias.js`, `lances.js`, `contemplados.js`, `parcelas.js` | Os grupos de cotas (`4003`, `4004`) são **exemplos fictícios hardcoded**. Em produção, grupos, cotas, status e registro de vendas devem vir/ir para a API do consórcio |
| 2 | **Credenciais API Credicob** | `api.js` | `API_USER` e `API_PASS` estão vazios — cotas disponíveis não carregam |
| 3 | **Persistência backend** | `server/db.js`, `server/routes/*` | Todos os dados somem ao limpar o browser. Backend com banco de dados não existe |
| 4 | **Autenticação** | `server/middleware/auth.js`, `login.html` | Qualquer pessoa com o link acessa todos os dados |

### 🟡 Importante — funcionalidades incompletas

| Item | Arquivos | Descrição |
|------|----------|-----------|
| PDF de Propostas | `proposta-pdf.js` (vazio) | Geração de proposta em PDF não implementada |
| Módulo de Equipe | `equipe.js` | Estrutura presente, sem lógica de comissões ou metas individuais |
| Google Drive UI | `documentos.js` | Auth funciona, interface de gestão de documentos não existe |
| Inadimplência | `inadimplencia.js` | Esqueleto presente. Sem cálculo de atraso |

### 🟢 Melhorias desejáveis

| Item | Descrição |
|------|-----------|
| Migração para backend | Substituir localStorage por API REST com banco de dados — essencial para multi-usuário |
| Relatórios exportáveis | PDF/Excel de propostas, histórico de simulações, desempenho de metas |
| Notificações | Alertas de reunião próxima, aniversário de lead, prazo de proposta |
| Multi-usuário | Hoje é single-user por browser. Equipe compartilhada exige backend |
| Backup/Restore | Export e import do localStorage como JSON |

---

## Bugs conhecidos

Ver **[MELHORIAS.md](./MELHORIAS.md)** para lista completa.

### Principais

1. **Path NGINX divergente:** `nginx.conf` aponta `/var/www/painelconsorcio` mas o deploy vai para `/var/www/maestro360`. Corrigir nos dois arquivos.

2. **Versão inconsistente:** `deploy.yml` e `update-version.sh` calculam o número de versão de formas diferentes. Unificar fórmula.

3. **Dados de demo permanentes nos gráficos:** O dashboard mostra dados fictícios quando não há leads, mas os gráficos históricos ficam zerados para usuários reais que não têm meses anteriores no `crm_metas_history`.

---

*Documentação atualizada em 2026-05-17.*
