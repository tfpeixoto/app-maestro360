# GÊNESIS — Documentação Técnica Completa do Sistema

> **Versão documentada:** v3.213  
> **Tipo:** CRM Web SaaS — Gestão de Consórcios e Pipeline de Vendas  
> **Usuários:** Consultor de Vendas e Administrador

---

## SUMÁRIO

1. [Visão Geral e Stack](#1-visão-geral-e-stack)
2. [Arquitetura de Arquivos](#2-arquitetura-de-arquivos)
3. [Estrutura de Navegação Global](#3-estrutura-de-navegação-global)
4. [Autenticação e Sessão](#4-autenticação-e-sessão)
5. [Camada de Dados (localStorage)](#5-camada-de-dados-localstorage)
6. [Geração de Códigos Automáticos](#6-geração-de-códigos-automáticos)
7. [Módulo 1 — Home](#7-módulo-1--home)
8. [Módulo 2 — Dashboard](#8-módulo-2--dashboard)
9. [Módulo 3 — Decisões (Analytics)](#9-módulo-3--decisões-analytics)
10. [Módulo 4 — Simulador de Portfólio](#10-módulo-4--simulador-de-portfólio)
11. [Módulo 5 — Comparativo](#11-módulo-5--comparativo)
12. [Módulo 6 — Histórico de Simulações](#12-módulo-6--histórico-de-simulações)
13. [Módulo 7 — Agenda](#13-módulo-7--agenda)
14. [Módulo 8 — Funil de Vendas](#14-módulo-8--funil-de-vendas)
15. [Módulo 9 — Clientes](#15-módulo-9--clientes)
16. [Módulo 10 — Chat & E-mail](#16-módulo-10--chat--e-mail)
17. [Módulo 11 — Marketing & Leads](#17-módulo-11--marketing--leads)
18. [Módulo 12 — Propostas](#18-módulo-12--propostas)
19. [Módulo 13 — Contratos](#19-módulo-13--contratos)
20. [Módulo 14 — Quadro de Cotas](#20-módulo-14--quadro-de-cotas)
21. [Módulo 15 — Vendidos](#21-módulo-15--vendidos)
22. [Módulo 16 — Lances](#22-módulo-16--lances)
23. [Módulo 17 — Contemplados](#23-módulo-17--contemplados)
24. [Módulo 18 — Assembleias](#24-módulo-18--assembleias)
25. [Módulo 19 — Parcelas (Financeiro)](#25-módulo-19--parcelas-financeiro)
26. [Módulo 20 — Inadimplência](#26-módulo-20--inadimplência)
27. [Módulo 21 — Equipe](#27-módulo-21--equipe)
28. [Módulo 22 — Metas & Objetivos](#28-módulo-22--metas--objetivos)
29. [Módulo 23 — Google Drive](#29-módulo-23--google-drive)
30. [Módulo 24 — Logs de Acesso / Auditoria](#30-módulo-24--logs-de-acesso--auditoria)
31. [Módulo 25 — Configurações](#31-módulo-25--configurações)
32. [Componentes Globais](#32-componentes-globais)
33. [Fluxos Transversais](#33-fluxos-transversais)
34. [Regras de Negócio Globais](#34-regras-de-negócio-globais)
35. [Integrações Externas](#35-integrações-externas)
36. [Banco de Dados — Schema Completo](#36-banco-de-dados--schema-completo)
37. [API REST — Rotas do Servidor](#37-api-rest--rotas-do-servidor)
38. [Deploy e Infraestrutura](#38-deploy-e-infraestrutura)
39. [Considerações para o Desenvolvimento](#39-considerações-para-o-desenvolvimento)

---

## 1. Visão Geral e Stack

### O que é o Gênesis

O **Gênesis** é um CRM Web SaaS desenvolvido exclusivamente para gestão de carteiras de consórcio e pipeline de vendas. Permite que consultores acompanhem leads do primeiro contato até a contemplação, simulem portfólios de cotas, gerenciem assembleias e controlem inadimplência.

### Stack Atual (produção)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Vanilla JS + HTML + CSS (SPA sem framework) |
| Estilos | CSS custom properties (`--primary`, `--accent`, `--border`, `--muted`, `--bg`) + Bootstrap Icons |
| Dados client-side | `localStorage` via camada `storeGet()` / `storeSet()` / `leadCreate()` / `leadUpdate()` |
| Autenticação | JWT — token em `localStorage.crm_auth` (campos `token` + `expiresAt`) |
| Controle de sessão | `sessionStorage.crm_session_alive` (limpo automaticamente ao fechar o browser) |
| Timeout de inatividade | 30 min com aviso 2 min antes (event listeners: mousemove, mousedown, keydown, scroll, touchstart, click) |
| Backend | Node.js (Express) — `/server/index.js` |
| WhatsApp Web | `whatsapp-web.js` via PM2 (`maestro-wpp`, porta 3003) |
| Banco de dados | PostgreSQL |
| Proxy reverso | NGINX |
| CI/CD | GitHub Actions → SSH nativo → VPS |
| Hospedagem | VPS Linux — `/var/www/maestro360` |

### Stack Recomendada (próxima versão)

| Camada | Tecnologia |
|--------|-----------|
| Frontend | React ou Vue.js (SPA) |
| Estado | Context API / Pinia |
| Estilos | TailwindCSS ou CSS Modules |
| Gráficos | Chart.js ou Recharts |
| Drag & Drop | react-beautiful-dnd |
| Backend | Node.js + Express ou Fastify |
| ORM | Prisma (PostgreSQL) |
| Jobs | node-cron |
| Auth | JWT + httpOnly cookies |

---

## 2. Arquitetura de Arquivos

```
Maestro360/
├── crm.html                      # SPA principal — ponto de entrada após login
├── login.html                    # Tela de autenticação
├── public/
│   ├── css/
│   │   └── style.css             # Estilos globais + variáveis CSS
│   └── js/
│       ├── funil-data.js         # Camada de dados: storeGet/Set, leadCreate/Update, _genLeadCodigo, _genSimCodigo
│       ├── funil-modal.js        # Modal de simulação, openClientDrawer (stub), moverStage
│       ├── funil-render.js       # Renderização do Kanban e cards do funil
│       ├── clientes.js           # Módulo Clientes: lista, perfil completo (_clOpenPerfil), tabs
│       ├── hist-sim.js           # Módulo Histórico de Simulações
│       ├── email.js              # Módulo Chat & E-mail
│       ├── agenda.js             # Módulo Agenda
│       ├── dashboard.js          # Módulo Dashboard
│       ├── home.js               # Módulo Home
│       ├── comparativo.js        # Módulo Comparativo
│       ├── parcelas.js           # Módulo Parcelas / Inadimplência
│       ├── contratos.js          # Módulo Contratos
│       ├── propostas.js          # Módulo Propostas
│       ├── equipe.js             # Módulo Equipe
│       ├── metas.js              # Módulo Metas
│       ├── marketing.js          # Módulo Marketing & Leads / Campanhas
│       ├── quadro-cotas.js       # Módulo Quadro de Cotas
│       ├── lances.js             # Módulo Lances
│       ├── assembleias.js        # Módulo Assembleias
│       ├── contemplados.js       # Módulo Contemplados (API Externa)
│       ├── drive.js              # Módulo Google Drive
│       ├── logs.js               # Módulo Logs de Acesso
│       ├── config.js             # Módulo Configurações
│       ├── decisoes.js           # Módulo Decisões / Analytics
│       └── version.js            # Gerado automaticamente no deploy (APP_VERSION)
├── server/
│   ├── index.js                  # Servidor Node.js principal (auth, API, WPP relay)
│   ├── package.json              # Dependências do servidor
│   └── whatsapp.js               # Integração whatsapp-web.js (WA_VERSION_FALLBACK)
├── .github/
│   └── workflows/
│       ├── deploy.yml            # CI/CD: push → SSH → git pull → npm install → pm2 restart → nginx reload
│       └── update-whatsapp-lib.yml  # Auto-update semanal da lib whatsapp-web.js
├── .deploy/
│   └── nginx.conf                # Configuração NGINX copiada no deploy
└── README.md                     # Instruções de setup e deploy
```

---

## 3. Estrutura de Navegação Global

### Header Fixo (todas as telas)

| Elemento | Comportamento |
|----------|--------------|
| Logo + "GÊNESIS" + nome do cliente | Clica → navega para Home |
| Barra de busca global | Debounce 300ms; busca nome, telefone, e-mail, código CLI-XXXX; dropdown de resultados; Esc fecha |
| Chip Leads (👥) | Contagem total no funil → clica navega para Funil |
| Chip Propostas (📄) | Propostas abertas → clica navega para Propostas |
| Chip Contratos (✏) | Contratos do mês → clica navega para Contratos |
| Chip WhatsApp (💬) | Mensagens não lidas → clica navega para Chat |
| Botão "+ Novo Lead" | Abre modal global de criação de lead |
| Ícone Notificações | Sino com contador; dropdown com notificações recentes |
| Botão "Conectar Google" | Desconectado: inicia OAuth; Conectado: exibe avatar + dropdown |
| Nome do usuário | Exibição apenas |
| Botão "Sair" | `logout()` → limpa `crm_auth` e `crm_session_alive` → redireciona para `login.html` |

### Menu Lateral Esquerdo

- Largura expandida: ~200px (ícone + label)
- Largura recolhida: ~56px (apenas ícone)
- Toggle hambúrguer no topo
- Botão "Fixar": persiste estado em `localStorage`
- Mobile < 768px: comporta como drawer com overlay

```
MENU PRINCIPAL
├── Home
├── Dashboard
└── Decisões (Acompanhamento)

PROSPECÇÃO
├── Simulador
├── Funil de Vendas
├── Clientes
├── Chat & E-mail
└── Marketing & Leads

FERRAMENTAS
├── Comparativo
├── Hist. Simulações
└── Agenda

COMERCIAL
├── Propostas
└── Contratos

GRUPOS & COTAS
├── Quadro de Cotas
├── Vendidos
├── Lances
├── Contemplados
└── Assembleias

FINANCEIRO
├── Parcelas
└── Inadimplência

ADMINISTRAÇÃO
├── Equipe
├── Metas
├── Google Drive
├── Logs de Acesso
├── Auditoria
└── Configurações
```

### Botões Flutuantes (canto inferior direito)

- **WhatsApp** (verde, acima): badge com msgs não lidas; clica → abre Chat como drawer/modal
- **Calculadora** (abaixo): abre modal de calculadora financeira; suporte a múltiplas instâncias

### Rodapé

```
v{MAJOR}.{COUNT} · {DATE} · #{HASH}
```
Gerado pelo script de deploy e gravado em `public/js/version.js`.

---

## 4. Autenticação e Sessão

### Fluxo de Login

```
[Usuário envia e-mail + senha]
    ↓
[Servidor verifica credenciais no PostgreSQL]
    ↓
[Servidor solicita geolocalização do navegador]
    ├── GPS negado → log "Sem Permissão GPS" → bloqueia
    └── GPS concedido → verifica área permitida
        ├── Fora da área → log "Bloqueado (Geo)" → bloqueia
        └── Dentro da área → gera JWT (8h) → log "Sucesso"
            ↓
[Frontend armazena: localStorage.crm_auth = { token, expiresAt }]
[Frontend armazena: sessionStorage.crm_session_alive = '1']
[Redireciona para crm.html]
```

### Verificação em crm.html (antes do render)

```javascript
(function () {
  const auth = JSON.parse(localStorage.getItem('crm_auth') || 'null');
  if (!auth || !auth.token || !auth.expiresAt || auth.expiresAt < Date.now()) {
    localStorage.removeItem('crm_auth');
    window.location.href = 'login.html';
    return;
  }
  // Detecta fechamento de browser (sessionStorage não persiste)
  if (!sessionStorage.getItem('crm_session_alive')) {
    localStorage.removeItem('crm_auth');
    window.location.href = 'login.html';
    return;
  }
  sessionStorage.setItem('crm_session_alive', '1');
})();
```

### Timeout de Inatividade

- **Limite:** 30 minutos sem interação
- **Aviso:** modal/banner 2 minutos antes com botão "Continuar"
- **Eventos monitorados:** `mousemove`, `mousedown`, `keydown`, `scroll`, `touchstart`, `click`
- **Ao expirar:** chama `logout()` — limpa `crm_auth` e `crm_session_alive` → redireciona para login

### Verificação Periódica de Expiração do JWT

```javascript
setInterval(function () {
  const _s = JSON.parse(localStorage.getItem('crm_auth') || 'null');
  if (!_s || !_s.expiresAt || _s.expiresAt < Date.now()) logout();
}, 60000);
```

### Logout

```javascript
function logout() {
  localStorage.removeItem('crm_auth');
  sessionStorage.removeItem('crm_session_alive');
  window.location.href = 'login.html';
}
```

### Requisições Autenticadas

```
Authorization: Bearer <token>
```

---

## 5. Camada de Dados (localStorage)

Toda a persistência de leads e simulações ocorre em `localStorage` via as funções em `funil-data.js`.

### Funções principais

| Função | Descrição |
|--------|-----------|
| `storeGet()` | Retorna array de todos os leads (`JSON.parse(localStorage.crm_leads)`) |
| `storeSet(leads)` | Sobrescreve o array de leads no localStorage |
| `leadCreate(data)` | Cria lead com código CLI-XXXX automático; retorna o lead criado |
| `leadUpdate(id, patch)` | Atualiza campos do lead por ID |
| `leadMoveStage(id, stage)` | Move lead para nova etapa do funil |
| `leadDelete(id)` | Remove lead do array |

### Estrutura de um Lead

```json
{
  "id": "lead_1748998123456",
  "codigo": "CLI-0001",
  "nome": "João Silva",
  "telefone": "(11) 99999-9999",
  "email": "joao@email.com",
  "cpf": "000.000.000-00",
  "valor": 600000,
  "objetivo": "imovel",
  "origem": "whatsapp",
  "stage": "simulacao",
  "reuniaoStatus": "agendada",
  "etiquetas": ["vip", "quente"],
  "createdAt": "2025-01-15T10:00:00.000Z",
  "simulacoes": [
    {
      "id": "sim_1748998200000",
      "codigo": "COT-0001",
      "titulo": "Portfólio Imóvel 600k",
      "creditoTotal": 600000,
      "parcela": 3200,
      "grupos": [{ "grupo": "4003", "qtd": 2, "prazo": 180, "credito": 300000 }],
      "lancePct": 30,
      "lancEmbutido": 0.3,
      "mesContemplacao": 36,
      "pctParcela": 100,
      "status": "pre-proposta",
      "createdAt": "2025-01-15T10:05:00.000Z"
    }
  ],
  "notas": "Cliente interessado em imóvel residencial.",
  "historico": [
    { "stage": "lead", "ts": "2025-01-15T09:00:00.000Z" },
    { "stage": "simulacao", "ts": "2025-01-15T10:05:00.000Z" }
  ]
}
```

---

## 6. Geração de Códigos Automáticos

Definidos em `funil-data.js`:

### Código de Lead

```javascript
function _genLeadCodigo() {
  const leads = storeGet();
  const nums = leads
    .map(l => l.codigo)
    .filter(c => c && /^CLI-\d+$/.test(c))
    .map(c => parseInt(c.slice(4), 10));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'CLI-' + String(max + 1).padStart(4, '0');
}
```

### Código de Cotação (Simulação)

```javascript
function _genSimCodigo() {
  const leads = storeGet();
  const allSims = leads.flatMap(l => l.simulacoes || []);
  const nums = allSims
    .map(s => s.codigo)
    .filter(c => c && /^COT-\d+$/.test(c))
    .map(c => parseInt(c.slice(4), 10));
  const max = nums.length ? Math.max(...nums) : 0;
  return 'COT-' + String(max + 1).padStart(4, '0');
}
```

### Tabela de Entidades e Formatos

| Entidade | Prefixo | Exemplo | Sequência |
|----------|---------|---------|-----------|
| Lead / Cliente | `CLI-` | `CLI-0001` | Global, nunca reutilizado |
| Cotação (Simulação) | `COT-` | `COT-0001` | Global, nunca reutilizado |
| Contrato | `CTR-` | `CTR-0001` | Global, nunca reutilizado |

---

## 7. Módulo 1 — Home

**Arquivo:** `public/js/home.js`

### Objetivo

Tela de boas-vindas e hub central. Primeiro ecrã após o login.

### Layout e Componentes

**Saudação e cabeçalho**
- "Bom dia / Boa tarde / Boa noite, [Nome]!" — calculada pelo horário do servidor
- Data atual por extenso
- Botões de ação rápida: "Nova Simulação" e "Ver Funil"

**1. KPI Cards (4 — horizontais, clicáveis)**

| Card | Dado | Cor | Navega para |
|------|------|-----|-------------|
| Leads no Funil | Total de leads ativos | Amarelo | Funil de Vendas |
| Propostas Abertas | Status ≠ Aceita/Recusada | Laranja | Propostas |
| Contratos Fechados | Ativos no mês corrente | Verde | Contratos |
| Msgs Não Lidas | Total WhatsApp não lidas | Verde | Chat |

Atualização em tempo real (polling/websocket).

**2. Última Simulação Salva**
- Card com: Crédito Total (R$), Parcela/mês, Grupo, Contemplação Esperada
- Botão "Abrir →" → abre diretamente no Simulador
- Oculto se não houver simulações

**3. Ferramentas de Apresentação (3 cards grandes)**

| Tag | Título | Descrição | Botão |
|-----|--------|-----------|-------|
| PRINCIPAL | Simulador de Portfólio | Monte cotas, calcule parcelas e lances | "Iniciar →" |
| COMPARATIVO | Consórcio vs Financiamento | Mostre a economia em 10 anos | "Ver →" |
| SIMULAÇÕES | Histórico de Simulações | Todas as simulações realizadas | "Ver →" |

**4. Acesso Rápido (grid de atalhos)**
Simulador · Funil de Leads · Clientes · WhatsApp/Chat · Comparativo · Propostas · Agenda · Campanhas · Quadro de Cotas · Inadimplência · Metas · Hist. Simulações

**5. Widget "Agora" (painel direito)**
- Relógio digital (atualiza a cada 1s)
- Data e dia da semana
- Ícone clima + temperatura via Geolocation API + API de clima
- Fallback: "--°C / Permissão de localização negada"

**6. Agenda de Hoje (painel direito)**
- Título + link "Ver tudo →" (navega para Agenda)
- Compromissos do dia em ordem cronológica: `[HORA] | [Cliente] | [Tipo]`
- Máximo 5 itens; sem registros: 3 itens de exemplo com tag "Dados de exemplo"

**7. Mercado & Indicadores (painel direito)**

*Indicadores Macro (atualização a cada 6h):*

| Indicador | Valor | Variação |
|-----------|-------|----------|
| Selic | X% | ▲/▼/= a.a. |
| IPCA | X% | ▲/▼/= 12m |
| CDI | X% | ▲/▼/= a.a. |
| CET Financiamento | X% | a.a. |

*Grupos Consórcio Ativos (via Configurações):*
- Lance mín. por grupo
- Taxa de administração
- Contemplações/mês

*Vantagem Consórcio (cálculo automático 10 anos):*
- Crédito referência / Custo consórcio / Custo financiamento / Economia

*Próximas Assembleias:* próximas 4 do Módulo Assembleias

*Ações Rápidas:* Decisões · Assembleias · Contemplados · Controle de Lances

---

## 8. Módulo 2 — Dashboard

**Arquivo:** `public/js/dashboard.js`

### Modo Demo

Ativado automaticamente quando não há leads reais.
- Banner amarelo: "Dados de demonstração — adicione leads no Funil para ver seus dados reais."
- Tag "Modo Demo" na data
- Botão "Ver Demo" / "Ver Dados Reais" para alternância manual
- Dados fictícios pré-configurados (nunca persistidos no banco)

### Componentes

**1. KPI Cards (5)**

Cada card: valor atual + variação % vs período anterior (badge +X% verde / -X% vermelho)

| KPI | Dado |
|-----|------|
| Prospecção | Contagem do mês |
| Leads Totais | Ativos |
| Reuniões Agendadas | Mês corrente |
| Reuniões Realizadas | Mês corrente |
| Vendas | Contratos fechados no mês |

**2. Gráficos de Linha Histórica (4 — últimos 12 meses)**
Leads/Mês · Prospecção/Mês · Reuniões/Mês · Vendas/Mês — cada um com linha tracejada de meta.

**3. Painel "Reuniões de Hoje"**
- Contador: Realizadas / Meta diária — "X% da meta"
- Barra de progresso: verde ≥ meta · laranja 50-99% · vermelho < 50%
- "Faltam X reuniões" ou "Meta atingida!"

**4. Gráfico de Barras — Reuniões Semana**
5 barras (Seg–Sex) + linha horizontal da meta diária.

**5. Funil de Vendas Visual**
Barras horizontais por etapa: nome · % relativo · contagem · valor R$.

**6. Pipeline de Valor**
Barras horizontais com valor financeiro total (R$) por etapa.

**7. Metas vs. Realizado**
Grid 2×3: ícone + nome do KPI + valor / meta + % + "faltam X".

**8. Taxa de Conversão**
Número grande: X% leads → contratos. Fluxo: [X Leads] → [X Propostas] → [X Fechados].

**9. Widget "Última Simulação"**
Crédito · Parcela · Grupo · Contemplação. Botão "Abrir Simulador →".

**10. Feed "Atividades Recentes"**
Lista cronológica: descrição da ação + hora/data relativa.

**11. Lista "Leads Recentes"**
Últimos 6: avatar + nome + telefone · tipo + etapa (badge) + valor R$.

---

## 9. Módulo 3 — Decisões (Analytics)

**Arquivo:** `public/js/decisoes.js`

### Componentes

**1. KPI Cards (6)**
Leads Total · Pipeline Total (R$) · Reuniões/Mês · Convertidos · Taxa de Conversão (%) · Ticket Médio (R$)

**2. Funil de Conversão Analítico**
Por etapa: nome + contagem + valor (R$)
`Início → Lead → Qualificação → Simulação → Proposta → Contrato → Pós-venda`

**3. Origem dos Leads**
Barras horizontais: canal + contagem + %.
Canais: WhatsApp · Indicação · Instagram · Site · Ligação

**4. Atividade Mensal (últimos 6 meses)**
Barras agrupadas por mês: Barra 1 = leads novos · Barra 2 = reuniões realizadas.

**5. Top Oportunidades**
Ranking top 5 por score de fechamento.

| Posição | Nome | Etapa · Valor | Score |
|---------|------|---------------|-------|

### Cálculo do Score

| Critério | Pontos |
|----------|--------|
| Etapa Lead | 10 pts |
| Etapa Qualificação | 20 pts |
| Etapa Simulação | 35 pts |
| Etapa Proposta | 50 pts |
| Etapa Contrato | 70 pts |
| Bônus por valor de crédito | até +20 pts |
| Bônus por interação recente (≤ 7 dias) | +5 pts |
| **Máximo** | **100 pts** |

---

## 10. Módulo 4 — Simulador de Portfólio

**Arquivo:** `public/js/funil-modal.js` (modal de simulação)

### Estrutura Wizard (6 etapas)

Barra de progresso: `Cliente → Objetivo → Capacidade → Portfólio → Parâmetros → Resumo`

---

### Etapa 1 — Dados do Cliente

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| Nome completo | Texto | Sim | Mín. 3 chars |
| Telefone/WhatsApp | Texto | Sim | Máscara (00) 00000-0000 |
| CPF | Texto | Não | Dígitos verificadores |
| E-mail | E-mail | Não | Formato válido |

**Vinculação automática por CPF:**
- Ao perder foco (blur): consulta base de clientes
- Encontrado → toast "Cliente encontrado: [Nome]" + preenche campos automaticamente
- Não encontrado → prossegue (novo cadastro ao salvar)

---

### Etapa 2 — Destino do Crédito

4 cards radio visual:

| Ícone | Título | Descrição |
|-------|--------|-----------|
| 🏠 | Comprar Imóvel | Casa, apartamento ou terreno |
| 🚗 | Comprar Veículo | Carro, moto ou outro veículo |
| 📈 | Ganho Financeiro | Alavancagem ou investimento |
| 🔧 | Outro Objetivo | Capital de giro, reforma, equipamentos |

Seleção obrigatória. Filtra grupos/cotas exibidos na Etapa 4.

---

### Etapa 3 — Capacidade Financeira

| Campo | Tipo | Obrigatório | Placeholder |
|-------|------|-------------|-------------|
| Crédito desejado (R$) | Numérico | Sim | "Ex: 600.000" |
| Aporte mensal (R$) | Numérico | Sim | "Ex: 3.500" |
| Lance próprio (R$) | Numérico | Não | "Ex: 150.000" |

Formatação automática como moeda pt-BR ao digitar.

---

### Etapa 4 — Monte seu Portfólio

**Tabela de grupos/cotas:**
Colunas: Grupo · Prazo · Crédito · Parcela (100%) · Controles (−/+) · Quantidade

- Filtrada pelo objetivo selecionado
- Resumo dinâmico: "X cotas · R$ X crédito · R$ X/mês"
- Mínimo 1 cota selecionada para avançar

---

### Etapa 5 — Parâmetros

**% da Parcela:**
3 botões exclusivos: 50% (Reduzida) · 70% (Equilibrada) · 100% (Parcela cheia, padrão)

**Mês de Contemplação Esperado:**
- Slider: 1 até prazo máximo do grupo
- Padrão: 36

**% Lance Embutido:**
- Slider: 0%–30% (bloqueado acima de 30%)
- Padrão: 30%

---

### Etapa 6 — Resumo

Seções:
- Dados do cliente
- Objetivo selecionado
- Tabela de cotas: grupo · crédito · prazo · parcela
- Totais: Crédito Total · Parcela/mês · Lance estimado · Lance embutido · Mês de Contemplação
- Gráfico/tabela de evolução financeira

Botões:
- "← Ajustar Parâmetros"
- "📊 Ver Comparativo Patrimonial" → Módulo Comparativo pré-preenchido

### Fluxo de Salvamento da Cotação

```
1. Verificar se lead existe (por CPF ou nome+telefone)
2a. Existe → vincula cotação ao lead; avança funil para "Simulação" se etapa atual for anterior
2b. Não existe → cria novo lead (CLI-XXXX); vincula cotação
3. Gera código COT-XXXX automático
4. Salva cotação em lead.simulacoes[] com status "Pré-proposta"
5. Salva cotação no Histórico de Simulações
6. Toast: "Simulação salva com sucesso!"
```

---

## 11. Módulo 5 — Comparativo

**Arquivo:** `public/js/comparativo.js`

### Abas

**Aba 1 — Comparativo** (padrão)
Toggle: 🏠 Imóvel vs Aluguel · 🚗 Carro vs Uber/Aluguel

**Aba 2 — Histórico do Grupo de Cotas**
Histórico de lances e contemplações dos grupos ativos.

### Sub-seção: Imóvel vs Aluguel

**Comprar via Consórcio:**

| Campo | Padrão |
|-------|--------|
| Valor do imóvel (R$) | 400.000 |
| Lance / Entrada (R$) | 120.000 |
| Parcela mensal (R$) | 2.500 |
| Número de parcelas | 180 |
| IPTU anual (R$) | 3.600 |
| Condomínio mensal (R$) | 800 |
| Manutenção/mês (R$) | 200 |
| Valorização anual (%) | 4 |

**Alugar:**

| Campo | Padrão |
|-------|--------|
| Aluguel mensal (R$) | 2.200 |
| Reajuste anual (%) | 6 |
| Rendimento capital não imobilizado (%a.m.) | 0,7 |

Slider horizonte: 1–30 anos (padrão: 10).

**Resultado:**
- Custo total de compra vs aluguel ao longo do horizonte
- Economia/diferença em R$
- Recomendação textual

### Sub-seção: Carro vs Uber/Aluguel

**Comprar o Veículo:**

| Campo | Padrão |
|-------|--------|
| Valor do veículo (R$) | 80.000 |
| Entrada (R$) | 20.000 |
| Parcela mensal (R$) | 1.400 |
| Seguro anual (R$) | 4.500 |
| IPVA anual (R$) | 1.600 |
| Manutenção mensal (R$) | 800 |
| Depreciação anual (%) | 12 |

**Uber / Aluguel:**

| Campo | Padrão |
|-------|--------|
| Gasto mensal com apps (R$) | 1.800 |
| Aluguel adicional/mês (R$) | 0 |
| Reajuste anual (%) | 5 |
| Rendimento capital (%a.m.) | 0,7 |

Slider horizonte: 1–20 anos (padrão: 5).

---

## 12. Módulo 6 — Histórico de Simulações

**Arquivo:** `public/js/hist-sim.js`

### Componentes

**KPI Cards (3):**
Total de Simulações · Clientes Únicos · Crédito Total Simulado (R$)

**Filtros:**
- Busca por cliente ou grupo (texto livre)
- Dropdown "Todos os Grupos"
- Dropdown "Todos os Status" (Todos · Pré-proposta)
- Botão "Limpar"

**Botão "+ Nova Simulação"** → navega para Simulador (Etapa 1)

**Tabela:**
Data · Cliente · Grupo(s) · Crédito Total (R$) · Status · Ações (abrir simulação)

**Estado vazio:**
"Nenhuma simulação registrada ainda." + Botão "Nova Simulação"

---

## 13. Módulo 7 — Agenda

**Arquivo:** `public/js/agenda.js`

### KPIs no Topo

- Hoje: X / meta diária
- Agendadas/mês: X / meta mensal
- Realizadas/mês: X / meta mensal
- Link "Ver Metas →"

### Visualizações (abas)

| Aba | Descrição |
|-----|-----------|
| Lista | Cronológica de compromissos futuros |
| Semana | Calendário semanal Dom–Sab |
| Mês | Calendário com pontos/contadores por dia |
| Dia | Linha do tempo com horários |

### Botões

- "Conectar Google" → OAuth Google (popup)
- "+ Nova Reunião" → modal de criação

### Modal Nova/Editar Reunião

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Título/Tipo | Seletor (Apresentação, Follow-up, Proposta, Outro) | Sim |
| Cliente vinculado | Autocomplete | Não |
| Data | Date picker | Sim |
| Hora início | Time picker | Sim |
| Hora fim | Time picker | Não |
| Local/Link | Texto | Não |
| Observações | Textarea | Não |

### Comportamentos

- Criar reunião → incrementa "Agendadas/mês"
- Marcar "Realizada" → incrementa "Realizadas/mês" + "Reuniões Hoje" no Dashboard
- Google Agenda conectado → sincronização bidirecional
- Notificações do navegador: 60 min · 15 min · 5 min antes

---

## 14. Módulo 8 — Funil de Vendas

**Arquivo:** `public/js/funil-render.js` + `funil-data.js` + `funil-modal.js`

### Layout

- Header: título + subtítulo + botão "Simulações" + botão "+ Novo Lead"
- Seletor de funil (dropdown/tabs — suporte a múltiplos funis)
- KPI bar: Simulações · Fechados · Potencial (R$) · Conversão (%)
- Colunas Kanban com scroll horizontal

### Colunas Kanban (7 fixas)

| # | Etapa | Cor |
|---|-------|-----|
| 1 | Início | Cinza |
| 2 | Lead | Azul |
| 3 | Qualificação | Laranja |
| 4 | Simulação | Roxo |
| 5 | Proposta | Verde claro |
| 6 | Contrato | Verde escuro |
| 7 | Pós-venda | Cinza escuro |

Cada coluna exibe: cabeçalho colorido + nome + contador + valor total (R$) + cards + botão "+ Adicionar".

### Card de Lead

- Nome + código CLI-XXXX (link para perfil)
- Info secundária (crédito R$)
- Valor em destaque
- Checklist: "✔ X/Y"
- Botão "Perfil" → `navigate('clientes'...)` + `setTimeout(() => _clOpenPerfil(id), 300)`
- Drag & drop entre colunas

### Comportamento ao Mover Card (drag & drop)

```
1. Animação durante arraste
2. Soltar → salva nova etapa (leadMoveStage)
3. Atualiza contadores das colunas (origem e destino)
4. Atualiza KPIs do funil
5. Registra mudança em lead.historico[]
6. Atualiza etapa na tela de Clientes
7. Se etapa = 'contrato' → chama onLeadMoveToContrato(id) se definido
```

### Regressão de Etapa

Ao mover para etapa anterior → exibe modal de confirmação: "Tem certeza? O lead irá regredir para [etapa]."

### Modal "Novo Lead"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome completo | Texto | Sim (mín. 3 chars) |
| Telefone/WhatsApp | Texto (máscara) | Sim |
| E-mail | E-mail | Não |
| Valor do crédito (R$) | Numérico | Não |
| Objetivo | Seletor | Não |
| Origem | Seletor (WhatsApp, Indicação, Instagram, Site, Ligação) | Não |
| Etapa inicial | Seletor | Sim (padrão: Início) |

**Ao salvar:**
1. Valida campos obrigatórios
2. Verifica duplicidade por telefone → alerta com opção de abrir cadastro existente
3. Gera código CLI-XXXX
4. Cria registro em Clientes
5. Posiciona no Kanban
6. Incrementa contador header
7. Toast "Lead [Nome] criado com sucesso!"

---

## 15. Módulo 9 — Clientes

**Arquivo:** `public/js/clientes.js`

### Layout

- Header: título + subtítulo + toggle visualização (grade/lista) + "+ Novo Cliente"
- Filtros: busca texto · tabs de etapa · tabs de status de reunião

### Filtros de Etapa

Todos · Início · Lead · Qualificação · Simulação · Proposta · Contrato · Pós-venda

### Filtros de Status de Reunião

Todos · Aguardando · Realizada · Cancelada · Agendar

### Visualização em Lista (tabela)

| Coluna | Conteúdo |
|--------|----------|
| Código | CLI-XXXX |
| Nome | Avatar + nome + e-mail |
| Etapa | Badge colorido |
| Status Reunião | Badge ou "Agendar Reunião" |
| Etiquetas | Tags coloridas |
| Valor | R$ formatado |
| Contato | Telefone |
| Ações | Menu (Editar · Ver perfil · Excluir) |

### Visualização em Grade

Cards: avatar + nome + etapa + valor + botão de ação rápida.

### Perfil Completo do Lead — `_clOpenPerfil(id)`

Abre em **tela cheia** (não drawer, não modal lateral).

**Função:** `_clOpenPerfil(id)` em `clientes.js` — renderiza `_clRenderPerfilPage(lead)`.

**5 Abas:**

| ID | Label | Conteúdo |
|----|-------|----------|
| `ltab-contato` | Contato | Dados cadastrais editáveis |
| `ltab-financeiro` | Financeiro | Histórico financeiro |
| `ltab-consorcio` | Histórico | Histórico de etapas + cotações vinculadas |
| `ltab-patrimonio` | Patrimônio | Patrimônio declarado |
| `ltab-crm` | CRM | Notas, etiquetas, reuniões |

**Aba Cotações (dentro de `ltab-consorcio`):**
- Tab: `{ id: 'cotacoes', label: 'Cotações' }`
- DOM: `clPane_cotacoes`
- Função: `_clPaneCotacoes`
- Listagem de todas as cotações (COT-XXXX) vinculadas ao lead
- Estado vazio: "Nenhuma cotação vinculada — Faça uma simulação no Simulador e salve para gerar uma cotação."
- Status label fallback: `s || 'Cotação'`
- Badge: exibido se `(lead.simulacoes || []).length > 0`

**KPIs na aba Contato (seção "Intenção & Cotações"):**
- "Cotações Ativas"
- `X cotaç${n === 1 ? 'ão' : 'ões'}`

**Todos os acessos a perfil via:** `_clOpenPerfil(id)` — **não há mais drawer/sidebar lateral**.

Para navegar até o perfil de outro módulo:
```javascript
navigate('clientes', document.querySelector('[data-page=clientes]'));
setTimeout(() => typeof _clOpenPerfil === 'function' && _clOpenPerfil(id), 300);
```

---

## 16. Módulo 10 — Chat & E-mail

**Arquivo:** `public/js/email.js`

### Abas

- **WhatsApp** (padrão)
- **E-mail**

### Aba WhatsApp — Estado Desconectado

- Título "Conectar WhatsApp"
- Instrução de uso
- Botão "Gerar QR Code" → requisição ao servidor Node.js (PM2) → exibe QR em canvas/imagem
- QR expira em 60s → contador + "Gerar novo QR"
- Após scan → atualiza automaticamente para estado conectado

### Aba WhatsApp — Estado Conectado

- Layout: lista de conversas (esquerda) + área de mensagens (direita)
- Lista: avatar + nome/número + última mensagem + horário + contador não lidas
- Área: histórico com bolhas + campo de texto + enviar + anexo
- Leads vinculados: badge com etapa do funil
- Busca por nome ou número

### Aba E-mail

- Integração Gmail via Google OAuth
- Layout: lista de e-mails + painel de leitura
- Compor novo e-mail
- Vincular e-mail a um lead

### Contador no Header

- Mensagens não lidas: polling a cada 30s ou websocket
- Zera ao abrir a conversa

---

## 17. Módulo 11 — Marketing & Leads

**Arquivo:** `public/js/marketing.js`

### Sub-módulos

- **Campanhas** — Disparo em massa via WhatsApp API
- **Enriquecer Lead** — Bureau de crédito

---

### Campanhas

**Botões:**
- "+ Nova Campanha" → wizard 4 etapas
- "Histórico" → listagem de campanhas anteriores
- "Preços Meta 2026" → tabela de preços vigentes

**Wizard de Criação (4 etapas):**

*Etapa 1 — Tipo:*

| Tipo | Descrição |
|------|-----------|
| Marketing | Promoções, lançamentos, ofertas |
| Utilidade | Lembretes, confirmações, notificações |
| Autenticação | OTPs, verificações, senhas temporárias |
| Serviço | Resposta a clientes (janela 24h) |

*Etapa 2 — Destinatários:*
- Lista de leads com checkbox individual
- Busca + "Selecionar todos" + "Limpar seleção"
- Contador dinâmico: "X leads selecionados"
- Filtros: por etapa · por origem · por tag
- Mínimo 1 selecionado

*Etapa 3 — Mensagem:*
- Textarea com contador de chars
- Variáveis: `{{nome}}`, `{{telefone}}`
- Preview em tempo real
- Anexo de mídia (condicional ao tipo)

*Etapa 4 — Revisão & Envio:*
- Resumo + custo total (qtd × custo/msg)
- Saldo disponível
- Saldo insuficiente → bloqueia botão
- Confirmação: "Você tem certeza? Esta ação debitará R$ X."
- Ao confirmar: débito automático → envio via API Meta → registro no histórico

**Histórico:** Data · Tipo · Destinatários · Mensagem (preview) · Status · Taxa de entrega

---

### Enriquecer Lead

**Passo 1 — Selecionar Leads:**
Busca + checkbox individual + "Selecionar todos" / "Limpar"

**Passo 2 — Pacote de Dados:**

| Pacote | Dados | Tag |
|--------|-------|-----|
| Básico | Nome, CPF, telefone, e-mail | "Ideal para validar contatos" |
| Completo | + endereço, telefones adicionais, score de crédito | "Mais vendido" |
| Premium | + renda estimada, histórico de crédito, empresas vinculadas | "Para alto valor" |

**Passo 3 — Resumo e Execução:**
- Total do pedido: R$ (pacote × qtd leads)
- Créditos disponíveis
- Botão "Enriquecer Leads Selecionados" (desabilitado se sem lead/pacote/saldo)
- "+ Recarregar" → modal de recarga

**Fluxo de enriquecimento:**
```
1. Loader "Consultando bureau..."
2. Requisição à API do bureau (timeout: 30s por lead)
3. Sucesso → atualiza campos do lead + débita créditos
4. Falha → exibe erro, não débita crédito do lead que falhou
5. Relatório: X enriquecidos | X falhas
```

---

## 18. Módulo 12 — Propostas

**Arquivo:** `public/js/propostas.js`

### KPI Cards (5)

Pré-Propostas · Total · Enviadas · Aceitas · Taxa de Aprovação (%)

### Filtros

Busca + Tabs: Todas · Pré-Proposta · Rascunho · Enviada · Aceita · Recusada

### Modal "+ Nova Proposta"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Lead vinculado | Autocomplete | Sim |
| Título | Texto | Sim |
| Simulação de referência | Dropdown (cotações do lead) | Não |
| Validade | Date picker | Não |
| Observações | Textarea | Não |

Se lead tem cotação → pré-preenche dados financeiros automaticamente.

### Ciclo de Vida

`Pré-Proposta → Rascunho → Enviada → Aceita / Recusada`

### Ações

Visualizar · Editar (Rascunho/Pré-Proposta) · Enviar (WhatsApp ou E-mail) · Aceitar · Recusar · Excluir

### Regras

- Taxa de Aprovação = (Aceitas ÷ Enviadas) × 100
- Proposta aceita → sistema sugere criar Contrato
- Proposta aceita pode gerar Contrato automaticamente (status "Pendente")

---

## 19. Módulo 13 — Contratos

**Arquivo:** `public/js/contratos.js`

### KPI Cards (4)

Total · Ativos · Pendentes · Valor Ativo (R$)

### Filtros

Busca + Tabs: Todos · Ativo · Pendente · Cancelado · Encerrado

### Modal "+ Novo Contrato"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Cliente | Autocomplete | Sim |
| Número do contrato | Texto (gerado ou manual) | Sim |
| Proposta de origem | Dropdown | Não |
| Grupo / Cota | Dropdown | Sim |
| Data de início | Date picker | Sim |
| Valor do crédito (R$) | Numérico | Sim |
| Observações | Textarea | Não |

### Ciclo de Vida

`Pendente → Ativo → Encerrado / Cancelado`

### Regras

- Encerrados/Cancelados não compõem "Valor Ativo"
- Contrato ativo vinculado a cota com status "Vendida" no Quadro de Cotas
- Ativar contrato → move lead para etapa "Contrato" no Funil

---

## 20. Módulo 14 — Quadro de Cotas

**Arquivo:** `public/js/quadro-cotas.js`

### Layout

- Header + botão "Disponíveis"
- Tabs de grupo: uma aba por grupo cadastrado
- Filtros: Todas · Disponível · Reservada · Vendida · Contemplada
- KPI Cards: Disponível · Reservada · Vendida · Contemplada
- Legenda de cores
- Grade visual de cotas

### Grade Visual

Grid responsivo (ex: 11 colunas). Cada cota = quadrado numerado com cor por status:

| Status | Cor |
|--------|-----|
| Disponível | Verde |
| Reservada | Laranja |
| Vendida | Azul escuro |
| Contemplada | Marrom/dourado |

### Ao Clicar em Cota

Modal com: número · status (badge) · cliente (nome, CLI-XXXX, link perfil) · vendedor · data · valor · histórico de status.

Ações por status:

| Status atual | Ações disponíveis |
|-------------|------------------|
| Disponível | "Reservar" · "Marcar como Vendida" |
| Reservada | "Confirmar Venda" · "Liberar (Disponível)" |
| Vendida | "Marcar como Contemplada" |
| Contemplada | — (sem ações) |

### Botão "Disponíveis"

Filtra/destaca cotas com condições especiais configuradas pelo administrador.

---

## 21. Módulo 15 — Vendidos

### KPI Cards

Total Vendidas · Adimplentes · Inadimplentes · Contempladas

### Filtros

Dropdown por grupo + busca por cliente ou vendedor

### Tabela

| Coluna | Conteúdo |
|--------|----------|
| Cota | Número + Grupo |
| Cliente | Nome + CLI-XXXX |
| Vendedor | Nome do consultor |
| Data da venda | Formatada |
| Valor do crédito | R$ |
| Status | Adimplente · Inadimplente · Contemplada |
| Ações | Ver detalhes · Ver parcelas |

### Atualização Automática de Status

- Job diário: verifica parcelas em atraso
- Parcela em atraso → status "Inadimplente" (badge vermelho)
- Parcelas regularizadas → retorna "Adimplente"
- Resultado de assembleia "Contemplada" → irreversível

---

## 22. Módulo 16 — Lances

**Arquivo:** `public/js/lances.js`

### KPI Cards

Total de Lances · Contemplados · Pendentes · Taxa de Vitória (%) · Lance Médio (%)

### Seções

**Cotas Ativas para Lance:**
- Busca por cliente ou número de cota
- Lista de cotas vendidas sem contemplação + data da próxima assembleia
- Botão "Registrar Lance" inline

**Histórico de Lances:**
- Filtros: Todos · Pendente · Contemplado · Não contemplado
- Cards: cliente + grupo + data assembleia + badge status + % ofertado + crédito R$
- Botão excluir (apenas status "Pendente")

### Modal "Registrar Lance"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Cota | Dropdown (cotas vendidas ativas) | Sim |
| Assembleia | Dropdown (assembleias do grupo) | Sim |
| % lance ofertado | Decimal | Sim (> 0 e ≤ 100) |
| Tipo de lance | Seletor (Livre / Embutido / Misto) | Sim |
| Observações | Textarea | Não |

Status inicial: "Pendente"

### Atualização de Status ao Registrar Resultado de Assembleia

```
% ofertado >= lance vencedor → "Contemplado"
% ofertado < lance vencedor  → "Não Contemplado"
Sorteio aleatório            → "Contemplado" (independente do lance)
```

### Cálculos

- **Taxa de Vitória:** `(Contemplados / Total com resultado) * 100`
- **Lance Médio:** `Soma dos % ofertados / Total de lances`

---

## 23. Módulo 17 — Contemplados

**Arquivo:** `public/js/contemplados.js`

### Objetivo

Consulta de cartas de crédito contempladas via API externa da administradora parceira.

### Comportamento de Carregamento

```
1. Abrir módulo → loader → GET API da administradora
2. Timeout 10s → estado de erro:
   - Ícone aviso + "Erro ao carregar API" + retorno da API
   - Botão "Tentar novamente"
3. Sucesso → renderiza listagem
4. Botão "Atualizar" → refaz requisição
```

### Filtros

Busca (código/crédito/grupo) + dropdown "Todas categorias" (Imóvel/Veículo) + checkbox "Apenas disponíveis" (padrão: marcado, filtro client-side)

### Card de Carta Contemplada

- Código + grupo + categoria
- Valor do crédito (R$)
- % lance estimado
- Status: Disponível / Indisponível
- Botão "Simular Aquisição" → Simulador pré-preenchido (crédito, grupo, objetivo)

### Regras

- 100% proveniente da API externa — sem armazenamento local
- Falha na API não afeta outros módulos

---

## 24. Módulo 18 — Assembleias

**Arquivo:** `public/js/assembleias.js`

### Layout

- Header + botão "+ Nova Assembleia"
- Banner "Próxima Assembleia" (azul escuro): grupo · data/hora · local — calculado automaticamente
- KPI Cards: Total · Agendadas · Realizadas · Grupos (distintos)
- Busca por grupo + filtros: Todas · Agendada · Realizada · Cancelada
- Lista de assembleias

### Cards por Status

**Agendada:** nome + data/hora/local + badge + "Registrar Resultado" + excluir

**Realizada:** nome + data/hora/local + badge + "Sorteados: X" + "Lance Vencedor: X%" (somente leitura)

### Modal "+ Nova Assembleia"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Grupo | Dropdown (grupos das Configurações) | Sim |
| Data | Date picker | Sim (não permite passado) |
| Hora | Time picker | Sim |
| Local | Texto | Sim |
| Observações | Textarea | Não |

### Modal "Registrar Resultado"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Número de sorteados | Inteiro >= 0 | Sim |
| % lance vencedor | Decimal | Sim |
| Observações | Textarea | Não |

**Ao confirmar:**
```
1. Assembleia → status "Realizada"
2. Busca lances vinculados ao grupo/data
3. Atualiza status de cada lance (Contemplado / Não Contemplado)
4. Atualiza cotas contempladas no Quadro de Cotas
5. Atualiza módulo Vendidos
6. Toast: "Resultado registrado. X lead(s) contemplado(s)."
```

---

## 25. Módulo 19 — Parcelas (Financeiro)

**Arquivo:** `public/js/parcelas.js`

### Painel de Projeção Mensal

- Tag "PROJEÇÃO — [MÊS/ANO]"
- Total esperado (R$)
- Barra de progresso: Já recebido | A receber
- Lista "CLIENTES ESTE MÊS": nome + valor a pagar

### KPI Cards (4)

Total Carteira (R$) · Recebido (R$) · Pendente (R$) · Em Atraso (R$)

### Filtros

Busca por cliente + seletor de mês/ano + tabs: Todos · Pendente · Pago · Atrasado

### Tabela

| Coluna | Conteúdo |
|--------|----------|
| Cliente | Nome |
| Vencimento | DD/MM/AAAA |
| Valor | R$ |
| Status | Pendente (laranja) · Pago (verde) · Atrasado (vermelho) |
| Ações | "Pago" (inline) + excluir |

### Botão "Pago"

Disponível para Pendente e Atrasado → confirmação → status "Pago" → recalcula KPIs → remove da Inadimplência.

### Modal "+ Nova Parcela"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Cliente | Autocomplete | Sim |
| Valor (R$) | Numérico | Sim |
| Data de vencimento | Date picker | Sim |
| Referência (mês/ano) | Texto | Não |
| Observações | Textarea | Não |

Status inicial: "Pendente"

### Job Agendado (diário, meia-noite)

Parcela com status "Pendente" + vencimento < hoje → status "Atrasado" → alimenta Inadimplência.

---

## 26. Módulo 20 — Inadimplência

### KPI Cards (5)

Total em Atraso (R$) · Clientes (qtd) · Parcelas (qtd) · Dias Médio Atraso · Nível de Risco

### Nível de Risco

| Critério | Baixo | Médio | Alto |
|----------|-------|-------|------|
| Total atraso | < R$ 10k | R$ 10k–50k | > R$ 50k |
| Dias médio | < 30d | 30d–90d | > 90d |
| Clientes inadimplentes | 1–2 | 3–5 | > 5 |

Nível final = pior dos três.

### Card de Cliente Inadimplente

- Avatar + nome + e-mail + telefone
- Total atraso (R$) + "X parcela(s) · Xd atraso" (vermelho)
- Detalhamento de cada parcela: vencimento · valor · status · "Pago"
- Ações:
  - "Cobrar via WhatsApp" → Chat com mensagem pré-formatada no campo
  - "Cobrar via E-mail" → e-mail pré-preenchido
  - "Acordo" → modal de acordo

### Modal "Acordo"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Valor acordado (R$) | Numérico | Sim |
| Data de pagamento acordada | Date picker | Sim |
| Observações | Textarea | Não |

Ao registrar: cria nova parcela com data/valor negociado. Parcelas originais permanecem para histórico.

---

## 27. Módulo 21 — Equipe

**Arquivo:** `public/js/equipe.js`

### KPI Cards do Time (4)

Equipe (total) · Leads Total · Fechamentos · Destaque (nome do top consultor)

### Card Individual do Consultor

- Avatar + nome + cargo
- Badge "Top" (top 2 em taxa de conversão)
- Editar (lápis) + Remover (lixeira)
- Métricas: Leads · Fechamentos · Reuniões/mês · Comissão est. (R$)
- Barra: Taxa de Conversão (%)
- Footer: e-mail + telefone + "Comissão: X%"

### Modal "+ Adicionar Membro"

| Campo | Tipo | Obrigatório |
|-------|------|-------------|
| Nome completo | Texto | Sim |
| Cargo | Texto | Sim |
| E-mail | E-mail | Sim |
| Telefone | Texto | Não |
| % Comissão | Decimal | Sim |

### Cálculos

- **Comissão est.:** Soma créditos dos contratos fechados no mês × (% / 100)
- **Destaque:** Maior taxa de conversão no mês; empate → maior número de fechamentos
- **Badge "Top":** Top 2 consultores em taxa de conversão

---

## 28. Módulo 22 — Metas & Objetivos

**Arquivo:** `public/js/metas.js`

### 6 Indicadores

1. Prospecção / Mês
2. Leads / Mês
3. Reuniões Agendadas / Mês
4. Reuniões Realizadas / Mês
5. Reuniões Hoje (meta diária)
6. Vendas / Mês

### KPI Card por Indicador

- Ícone + nome
- Valor realizado (grande)
- "meta: X"
- % atingimento (badge): verde >= 100% · laranja 50–99% · vermelho < 50%
- Mini-gráfico de linha (histórico do mês)

### Painel "Realizado vs. Meta — [Mês/Ano]"

Por indicador: nome · realizado/meta · % · barra de progresso · "Abaixo · faltam X" ou "Meta atingida!"

### Tabela Histórica (últimos 6 meses)

| Métrica | Mês-5 | ... | Mês atual |
|---------|-------|-----|-----------|

Valores ausentes: "—"

### Alimentação Automática dos Contadores

| Ação | Incrementa |
|------|-----------|
| Novo lead cadastrado | Leads/Mês |
| Prospecção registrada | Prospecção/Mês |
| Reunião criada | Reuniões Agendadas/Mês |
| Reunião marcada "Realizada" | Realizadas/Mês + Hoje |
| Contrato ativado | Vendas/Mês |

### Botões

- "Editar Metas" → modal com 6 campos numéricos → aplica imediatamente ao mês corrente
- "Registrar Mês" → confirmação → snapshot do mês na tabela histórica (ação manual do gestor)

---

## 29. Módulo 23 — Google Drive

**Arquivo:** `public/js/drive.js`

### Estado Desconectado

- Ícone Google + "Conectar Google Drive"
- Benefícios: pasta `clientes/` automática · subpasta por cliente · OAuth 2.0
- Botão "Conectar Google"

### Estado Conectado

- Pasta raiz: `clientes/`
- Subpasta por cliente: criada automaticamente ao abrir o perfil
- Nome: `CLI-0001 João Silva`
- Funcionalidades: navegar · upload · visualizar (nova aba) · copiar link · excluir

### Criação Automática de Subpasta

- Trigger: ao chamar `_clOpenPerfil(id)`
- Verifica existência → cria se não existe
- Operação silenciosa (sem interrupção)

---

## 30. Módulo 24 — Logs de Acesso / Auditoria

**Arquivo:** `public/js/logs.js`

### Filtros

- Dropdown status: Todos · Sucesso · Falha de Senha · Bloqueado (Geo) · Sem Permissão GPS
- Texto livre: IP e e-mail

### Tabela

| Coluna | Conteúdo |
|--------|----------|
| Data/Hora | DD/MM/AAAA HH:MM:SS |
| E-mail | Usuário |
| IP | Endereço IP |
| Status | Badge colorido |
| Localização | Cidade/Estado |

### Regras

- Somente leitura — nenhum registro editável
- Acesso restrito ao Administrador
- Cada tentativa de login registrada antes de qualquer resposta ao cliente

### Lógica de Bloqueio por Geolocalização

```
1. Tentativa de login
2. Servidor solicita GPS do navegador
   a. Negado → "Sem Permissão GPS" → bloqueia
   b. Concedido → verifica área permitida
      i.  Fora → "Bloqueado (Geo)" → bloqueia
      ii. Dentro → autenticação normal
```

---

## 31. Módulo 25 — Configurações

**Arquivo:** `public/js/config.js` — Acesso restrito ao Administrador

### Aba 1 — Empresa

| Campo | Tipo | Placeholder |
|-------|------|-------------|
| Nome da Empresa | Texto | "Nome da Empresa" |
| CNPJ | Texto (máscara) | "00.000.000/0001-00" |
| Telefone | Texto (máscara) | "(11) 99999-9999" |
| E-mail | E-mail | "contato@empresa.com" |
| Site | URL | "https://empresa.com.br" |
| Endereço | Texto | "Rua, número — Cidade/UF" |

### Aba 2 — Integrações

**Google Services:**
- Status: "Conectado" / "Desconectado"
- Campo: Google OAuth Client ID
- Instrução: `console.cloud.google.com → APIs → Credenciais`
- Botões: "Salvar Client ID" + "Conectar agora"

**WhatsApp Web (PM2):**
- Campo: URL do Servidor WPP (padrão: `/wpp`)
- Bloco de código: `pm2 start index.js --name maestro-wpp && pm2 save`
- Botão "Salvar URL"

**Notificações de Reunião:**
- Toggle ativar/desativar
- Alertas: 60 min · 15 min · 5 min antes

### Aba 3 — CRM

- Estágios do Funil: lista com nome + contador + cor (definidos em `funil-data.js`, não editáveis pela UI)
- Origens de Leads: tags (não editáveis pela UI)

### Aba 4 — Dados

**Resumo:** Leads (qtd) · Reuniões (qtd) · Armazenado (KB)

**Exportar:** Botão "Exportar Backup JSON"
- Arquivo: `genesis-backup-YYYY-MM-DD.json`
- Inclui: leads, reuniões, metas, funis, cotas, configurações
- Data/hora do último backup exibida

**Importar:** Botão "Importar Backup"
- Seletor de .json
- Preview de dados encontrados
- Aviso: "Irá sobrescrever dados atuais. Esta ação é irreversível."
- Campo: digitar "CONFIRMAR" para habilitar

**Zona de Perigo (fundo vermelho):**
- "Limpar Leads": remove leads, mantém configurações/grupos/cotas/metas
- "Apagar Todos os Dados": remove tudo exceto configurações básicas e grupos
- Ambos exigem digitar "CONFIRMAR"

### Aba 5 — Segurança

- Autenticação: credenciais gerenciadas pelo servidor
- Sessão: expiração em 8 horas (configurável apenas no servidor)

---

## 32. Componentes Globais

### Modal "Novo Lead" (Global)

Acionado por "+ Novo Lead" no header e "+ Adicionar" nas colunas do Funil.

**Campos:**

| Campo | Tipo | Obrigatório | Validação |
|-------|------|-------------|-----------|
| Nome completo | Texto | Sim | Mín. 3 chars |
| Telefone/WhatsApp | Texto (máscara) | Sim | (00) 00000-0000 |
| E-mail | E-mail | Não | Formato válido |
| Valor do crédito (R$) | Numérico | Não | > 0 |
| Objetivo | Seletor | Não | Imóvel/Veículo/Financeiro/Outro |
| Origem | Seletor | Não | WhatsApp/Indicação/Instagram/Site/Ligação |
| Etapa inicial | Seletor | Sim | Padrão: Início |

**Ao salvar:**
1. Valida obrigatórios
2. Verifica duplicidade por telefone → alerta + opção de abrir existente
3. Gera CLI-XXXX
4. Cria registro
5. Posiciona no Kanban
6. Incrementa contador header
7. Toast "Lead [Nome] criado com sucesso!"

### Sistema de Notificações (Toast)

| Tipo | Cor | Auto-dismiss |
|------|-----|-------------|
| Sucesso | Verde | 4s |
| Erro | Vermelho | 4s |
| Aviso | Laranja | 4s |
| Info | Azul | 4s |

- Slide in da direita
- Click para dismiss manual
- Empilhamento: até 3 simultâneos (mais antigo some primeiro)

### Calculadora Financeira (Flutuante)

- Operações básicas + funções financeiras (%, raiz)
- "+ Nova Calculadora" → múltiplas instâncias

---

## 33. Fluxos Transversais

### Fluxo Principal: Prospecção → Contemplação

```
[Prospecção / Origem]
    |
    v
[Cadastro do Lead] --> gera CLI-XXXX --> Funil (Início/Lead)
    |
    v
[Qualificação] --> consultor avalia perfil e potencial
    |
    v
[Simulação] --> Simulador de Portfólio --> cotação COT-XXXX salva e vinculada ao lead
    |
    v
[Proposta] --> gerada a partir da cotação --> enviada ao cliente
    |
    v
[Contrato] --> proposta aceita --> contrato CTR-XXXX --> cota reservada/vendida
    |
    v
[Pós-venda] --> acompanhamento (Parcelas) + Lances em Assembleias
    |
    v
[Contemplação] --> resultado de assembleia --> cota contemplada
```

### Fluxo: Registro de Assembleia e Impactos

```
[Nova Assembleia] --> status "Agendada"
    |
    v
[Registrar Resultado] (sorteados + lance vencedor %)
    |
    v
Automação executa:
  - Assembleia --> "Realizada"
  - Lances vinculados:
      % ofertado >= vencedor --> "Contemplado"
      % ofertado < vencedor  --> "Não Contemplado"
      Sorteio               --> "Contemplado" (independente)
  - Cotas --> "Contemplada" no Quadro de Cotas
  - Vendidos --> badge "Contemplada"
  - Toast: "X lead(s) contemplado(s)."
```

### Fluxo: Inadimplência → Cobrança → Acordo

```
[Job noturno: varredura de parcelas]
    |
    v
[Pendente + vencimento < hoje] --> "Atrasado" --> alimenta Inadimplência
    |
    v
[Consultor abre Inadimplência]
    |
    v
[Ações disponíveis]
  - "Cobrar via WhatsApp" --> Chat + mensagem pré-formatada
  - "Cobrar via E-mail"   --> e-mail pré-preenchido
  - "Acordo"              --> nova parcela com data/valor negociado
    |
    v
[Pagamento] --> "Pago" --> remove da Inadimplência --> atualiza KPIs
```

### Fluxo: Integração Google

```
[Conectar Google] --> popup OAuth
    |
    v
[Usuário autoriza escopos] (Calendar, Drive, Gmail, Meet)
    |
    v
[Token OAuth salvo no servidor] --> header --> avatar
    |
    v
Funcionalidades desbloqueadas:
  - Agenda <-> Google Calendar (bidirecional)
  - Documentos --> Google Drive (pasta clientes/)
  - Chat & E-mail --> aba Gmail integrada
  - Reuniões --> link Google Meet
    |
    v
[Renovação automática do token]
    |
    v
[Desconectar] --> revoga token --> estado desconectado
```

---

## 34. Regras de Negócio Globais

### Perfis de Acesso

| Funcionalidade | Consultor | Administrador |
|----------------|:---------:|:-------------:|
| Home, Dashboard, Decisões | Sim | Sim |
| Simulador, Comparativo, Hist. Simulações | Sim | Sim |
| Agenda, Funil, Clientes, Chat | Sim | Sim |
| Marketing & Leads, Propostas | Sim | Sim |
| Contratos, Quadro de Cotas, Vendidos | Sim | Sim |
| Lances, Contemplados, Assembleias | Sim | Sim |
| Parcelas, Inadimplência | Sim | Sim |
| Equipe (apenas próprios dados) | Sim | Sim |
| Equipe (todos + adicionar/remover) | Não | Sim |
| Metas (ver) | Sim | Sim |
| Metas (editar + registrar mês) | Não | Sim |
| Google Drive | Sim | Sim |
| Logs de Acesso / Auditoria | Não | Sim |
| Configurações | Não | Sim |

### Validações Globais de Formulário

| Campo | Regra |
|-------|-------|
| Obrigatórios | Borda vermelha + mensagem ao tentar avançar |
| Telefone | (00) 00000-0000 ou (00) 0000-0000 |
| CPF | Validação de dígitos verificadores |
| E-mail | Regex formato válido |
| Valores monetários | Apenas positivos, formato pt-BR (R$ 1.000,00) |
| Percentuais | 0 a 100, máx. 2 casas decimais |

### Responsividade

- **Desktop (>= 1280px):** design primário
- **Tablet (768–1279px):** menu lateral recolhido por padrão
- **Mobile (< 768px):** menu como drawer + tabelas com scroll horizontal + cards em coluna única

### Performance — Intervalos de Polling

| Dado | Intervalo |
|------|-----------|
| KPIs do header | 60s |
| Contador mensagens WhatsApp | 30s |
| Indicadores macroeconômicos (Home) | 6h |
| Gráficos do Dashboard | Sob demanda (ao abrir) |
| Funil de Vendas (cotas) | Lazy (ao rolar) |

---

## 35. Integrações Externas

### 1. Google OAuth 2.0

- **Escopos:**
  - `https://www.googleapis.com/auth/calendar`
  - `https://www.googleapis.com/auth/drive`
  - `https://www.googleapis.com/auth/gmail.modify`
  - `https://www.googleapis.com/auth/meetings.space.created`
- **Fluxo:** Authorization Code Flow com PKCE
- **Armazenamento:** refresh token no servidor (nunca no frontend)

### 2. WhatsApp Business API (Meta)

- Disparo de campanhas em massa (Módulo Marketing & Leads)
- Categorias: Marketing · Utilidade · Autenticação · Serviço
- Webhooks para status de entrega (entregue, lido, falhou)
- Créditos pré-pagos com débito por envio

### 3. WhatsApp Web (Node.js / PM2 / `whatsapp-web.js`)

- Chat direto no Módulo Chat & E-mail
- Processo separado via PM2 (`maestro-wpp`, porta 3003)
- Comunicação via WebSocket ou REST local
- URL configurável: Configurações → Integrações (padrão: `/wpp` via NGINX)
- `WA_VERSION_FALLBACK` atualizado semanalmente pelo workflow `update-whatsapp-lib.yml`

### 4. API da Administradora (Contemplados)

- Endpoint REST externo — GET consulta de cartas disponíveis
- Timeout: 10s
- Sem armazenamento local
- Tratamento de erro com botão "Tentar novamente"

### 5. Bureau de Crédito (Enriquecimento de Leads)

- Timeout: 30s por lead
- Cobrança apenas por consultas bem-sucedidas
- Dados por pacote: Básico · Completo · Premium

### 6. API de Clima / Geolocalização

- Browser Geolocation API → coordenadas do usuário
- API de clima (ex: OpenWeatherMap) → temperatura
- Apenas no widget do Home
- Fallback: "--°C / Permissão de localização negada"

---

## 36. Banco de Dados — Schema Completo

```sql
-- Usuários
CREATE TABLE users (
  id             SERIAL PRIMARY KEY,
  name           VARCHAR(120) NOT NULL,
  email          VARCHAR(120) UNIQUE NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  role           VARCHAR(20) NOT NULL DEFAULT 'consultant',
  commission_pct DECIMAL(5,2) DEFAULT 0,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Leads / Clientes
CREATE TABLE leads (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(10) UNIQUE NOT NULL,
  name          VARCHAR(120) NOT NULL,
  phone         VARCHAR(20),
  email         VARCHAR(120),
  cpf           VARCHAR(14),
  stage         VARCHAR(30) DEFAULT 'inicio',
  origin        VARCHAR(30),
  objective     VARCHAR(30),
  credit_value  DECIMAL(12,2),
  meeting_status VARCHAR(20),
  tags          TEXT[],
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de Etapas do Lead
CREATE TABLE lead_stage_history (
  id          SERIAL PRIMARY KEY,
  lead_id     INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  stage       VARCHAR(30) NOT NULL,
  changed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Cotações / Simulações
CREATE TABLE simulations (
  id             SERIAL PRIMARY KEY,
  code           VARCHAR(10) UNIQUE NOT NULL,
  lead_id        INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  title          VARCHAR(200),
  credit_total   DECIMAL(12,2),
  installment    DECIMAL(10,2),
  lance_pct      DECIMAL(5,2),
  lance_embutido DECIMAL(5,2),
  month_contempl INTEGER,
  pct_parcela    INTEGER DEFAULT 100,
  status         VARCHAR(30) DEFAULT 'pre-proposta',
  groups_json    JSONB,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Propostas
CREATE TABLE proposals (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(10) UNIQUE NOT NULL,
  lead_id       INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  simulation_id INTEGER REFERENCES simulations(id) ON DELETE SET NULL,
  title         VARCHAR(200) NOT NULL,
  status        VARCHAR(30) DEFAULT 'rascunho',
  validity_date DATE,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Contratos
CREATE TABLE contracts (
  id           SERIAL PRIMARY KEY,
  code         VARCHAR(10) UNIQUE NOT NULL,
  lead_id      INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  proposal_id  INTEGER REFERENCES proposals(id) ON DELETE SET NULL,
  quota_id     INTEGER REFERENCES quotas(id) ON DELETE SET NULL,
  number       VARCHAR(50) NOT NULL,
  status       VARCHAR(20) DEFAULT 'pendente',
  credit_value DECIMAL(12,2),
  started_at   DATE,
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Grupos de Consórcio
CREATE TABLE groups (
  id                        SERIAL PRIMARY KEY,
  name                      VARCHAR(50) NOT NULL,
  category                  VARCHAR(20) NOT NULL,
  min_lance_pct             DECIMAL(5,2),
  admin_fee_pct             DECIMAL(5,2),
  total_quotas              INTEGER NOT NULL,
  contemplations_per_month  INTEGER DEFAULT 1,
  active                    BOOLEAN DEFAULT TRUE,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

-- Cotas
CREATE TABLE quotas (
  id           SERIAL PRIMARY KEY,
  group_id     INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  number       VARCHAR(10) NOT NULL,
  status       VARCHAR(20) DEFAULT 'disponivel',
  lead_id      INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  seller_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
  credit_value DECIMAL(12,2),
  sold_at      TIMESTAMPTZ,
  is_hot_sale  BOOLEAN DEFAULT FALSE,
  UNIQUE(group_id, number)
);

-- Histórico de Status da Cota
CREATE TABLE quota_status_history (
  id         SERIAL PRIMARY KEY,
  quota_id   INTEGER REFERENCES quotas(id) ON DELETE CASCADE,
  status     VARCHAR(20) NOT NULL,
  changed_by INTEGER REFERENCES users(id),
  changed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assembleias
CREATE TABLE assemblies (
  id                SERIAL PRIMARY KEY,
  group_id          INTEGER REFERENCES groups(id) ON DELETE CASCADE,
  assembly_date     TIMESTAMPTZ NOT NULL,
  location          VARCHAR(200),
  status            VARCHAR(20) DEFAULT 'agendada',
  winners_count     INTEGER DEFAULT 0,
  winning_lance_pct DECIMAL(5,2),
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Lances
CREATE TABLE bids (
  id          SERIAL PRIMARY KEY,
  quota_id    INTEGER REFERENCES quotas(id) ON DELETE CASCADE,
  assembly_id INTEGER REFERENCES assemblies(id) ON DELETE CASCADE,
  pct_offered DECIMAL(5,2) NOT NULL,
  bid_type    VARCHAR(20) NOT NULL,
  status      VARCHAR(20) DEFAULT 'pendente',
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Parcelas
CREATE TABLE installments (
  id         SERIAL PRIMARY KEY,
  lead_id    INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  quota_id   INTEGER REFERENCES quotas(id) ON DELETE SET NULL,
  amount     DECIMAL(10,2) NOT NULL,
  due_date   DATE NOT NULL,
  reference  VARCHAR(20),
  status     VARCHAR(20) DEFAULT 'pendente',
  paid_at    TIMESTAMPTZ,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reuniões / Agenda
CREATE TABLE meetings (
  id              SERIAL PRIMARY KEY,
  lead_id         INTEGER REFERENCES leads(id) ON DELETE SET NULL,
  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
  type            VARCHAR(30) NOT NULL,
  meeting_date    TIMESTAMPTZ NOT NULL,
  end_date        TIMESTAMPTZ,
  location        VARCHAR(200),
  status          VARCHAR(20) DEFAULT 'agendada',
  google_event_id VARCHAR(200),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Campanhas
CREATE TABLE campaigns (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER REFERENCES users(id),
  type             VARCHAR(30) NOT NULL,
  recipients_count INTEGER NOT NULL,
  message          TEXT NOT NULL,
  status           VARCHAR(20) DEFAULT 'processando',
  sent_at          TIMESTAMPTZ,
  delivery_rate    DECIMAL(5,2),
  cost_total       DECIMAL(10,4),
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Logs de Acesso
CREATE TABLE access_logs (
  id         SERIAL PRIMARY KEY,
  email      VARCHAR(120) NOT NULL,
  ip         VARCHAR(50),
  status     VARCHAR(30) NOT NULL,
  location   VARCHAR(200),
  latitude   DECIMAL(10,6),
  longitude  DECIMAL(10,6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Metas
CREATE TABLE goals (
  id                   SERIAL PRIMARY KEY,
  user_id              INTEGER REFERENCES users(id),
  month                INTEGER NOT NULL,
  year                 INTEGER NOT NULL,
  prospection          INTEGER DEFAULT 0,
  leads                INTEGER DEFAULT 0,
  meetings_scheduled   INTEGER DEFAULT 0,
  meetings_done        INTEGER DEFAULT 0,
  meetings_today       INTEGER DEFAULT 0,
  sales                INTEGER DEFAULT 0,
  UNIQUE(user_id, month, year)
);

-- Histórico de Metas (snapshot mensal)
CREATE TABLE goals_history (
  id                       SERIAL PRIMARY KEY,
  user_id                  INTEGER REFERENCES users(id),
  month                    INTEGER NOT NULL,
  year                     INTEGER NOT NULL,
  prospection_done         INTEGER,
  leads_done               INTEGER,
  meetings_scheduled_done  INTEGER,
  meetings_done_done       INTEGER,
  sales_done               INTEGER,
  recorded_at              TIMESTAMPTZ DEFAULT NOW()
);

-- Configurações (chave-valor)
CREATE TABLE settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auditoria de Ações
CREATE TABLE audit_trail (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER REFERENCES users(id),
  action      VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50),
  entity_id   INTEGER,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 37. API REST — Rotas do Servidor

### Autenticação

```
POST   /api/auth/login           # Login (e-mail + senha + geolocalização)
POST   /api/auth/logout          # Logout
GET    /api/auth/me              # Dados do usuário logado
```

### Leads / Clientes

```
GET    /api/leads                # Listar (filtros: stage, origin, search)
POST   /api/leads                # Criar lead
GET    /api/leads/:id            # Obter por ID
PATCH  /api/leads/:id            # Atualizar
DELETE /api/leads/:id            # Excluir
PATCH  /api/leads/:id/stage      # Mover etapa
```

### Cotações / Simulações

```
GET    /api/simulations          # Listar
POST   /api/simulations          # Criar (vincula ao lead)
GET    /api/simulations/:id      # Obter
PATCH  /api/simulations/:id      # Atualizar
DELETE /api/simulations/:id      # Excluir
```

### Propostas

```
GET    /api/proposals            # Listar
POST   /api/proposals            # Criar
GET    /api/proposals/:id        # Obter
PATCH  /api/proposals/:id        # Atualizar
PATCH  /api/proposals/:id/status # Mudar status
DELETE /api/proposals/:id        # Excluir
```

### Contratos

```
GET    /api/contracts            # Listar
POST   /api/contracts            # Criar
GET    /api/contracts/:id        # Obter
PATCH  /api/contracts/:id        # Atualizar
PATCH  /api/contracts/:id/status # Mudar status
```

### Grupos e Cotas

```
GET    /api/groups               # Listar grupos
POST   /api/groups               # Criar grupo
PATCH  /api/groups/:id           # Atualizar grupo
GET    /api/groups/:id/quotas    # Listar cotas do grupo
PATCH  /api/quotas/:id/status    # Mudar status da cota
```

### Assembleias e Lances

```
GET    /api/assemblies           # Listar assembleias
POST   /api/assemblies           # Criar assembleia
PATCH  /api/assemblies/:id/result # Registrar resultado
GET    /api/bids                 # Listar lances
POST   /api/bids                 # Registrar lance
DELETE /api/bids/:id             # Excluir lance (apenas Pendente)
```

### Financeiro

```
GET    /api/installments         # Listar parcelas
POST   /api/installments         # Criar parcela
PATCH  /api/installments/:id/pay # Marcar como pago
DELETE /api/installments/:id     # Excluir parcela
GET    /api/overdue              # Inadimplentes
```

### Reuniões / Agenda

```
GET    /api/meetings             # Listar
POST   /api/meetings             # Criar
PATCH  /api/meetings/:id         # Atualizar
PATCH  /api/meetings/:id/done    # Marcar como realizada
DELETE /api/meetings/:id         # Excluir
```

### Equipe e Metas

```
GET    /api/users                # Listar equipe
POST   /api/users                # Adicionar membro
PATCH  /api/users/:id            # Atualizar membro
DELETE /api/users/:id            # Remover membro
GET    /api/goals                # Metas do mês corrente
PATCH  /api/goals                # Atualizar metas
POST   /api/goals/snapshot       # Registrar histórico
GET    /api/goals/history        # Histórico 6 meses
```

### Campanhas e Marketing

```
POST   /api/campaigns            # Criar e disparar campanha
GET    /api/campaigns            # Histórico
GET    /api/credits/balance      # Saldo de créditos
POST   /api/leads/enrich         # Enriquecer leads (bureau)
```

### WhatsApp

```
GET    /wpp/status               # Status da conexão
GET    /wpp/qr                   # Gerar QR Code
GET    /wpp/messages/:phone      # Histórico de mensagens
POST   /wpp/send                 # Enviar mensagem
```

### Administração

```
GET    /api/logs                 # Logs de acesso
GET    /api/settings             # Configurações
PATCH  /api/settings             # Salvar configurações
GET    /api/backup               # Exportar backup JSON
POST   /api/restore              # Importar backup JSON
DELETE /api/data/leads           # Limpar leads
DELETE /api/data/all             # Apagar todos os dados
```

---

## 38. Deploy e Infraestrutura

### NGINX — Configuração de Proxy

```nginx
server {
  listen 443 ssl;
  server_name seudominio.com.br;

  root /var/www/maestro360/public;
  index index.html crm.html;

  location /api/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Authorization $http_authorization;
  }

  location /wpp/ {
    proxy_pass http://localhost:3003/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
  }

  location / {
    try_files $uri $uri/ /crm.html;
  }
}
```

### PM2 — Processos

| Nome | Arquivo | Porta | Descrição |
|------|---------|-------|-----------|
| `maestro-api` | `server/index.js` | 3000 | Backend Node.js |
| `maestro-wpp` | `server/whatsapp.js` | 3003 | WhatsApp Web |

### GitHub Actions — CI/CD

**`deploy.yml`** — Trigger: push para `main`

```yaml
- name: Deploy to VPS via SSH
  env:
    SSH_KEY: ${{ secrets.VPS_SSH_KEY }}
  run: |
    mkdir -p ~/.ssh
    echo "$SSH_KEY" > ~/.ssh/deploy_key
    chmod 600 ~/.ssh/deploy_key
    ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no root@SEU_IP_VPS '
      cd /var/www/maestro360
      git pull origin main
      HASH=$(git rev-parse --short HEAD)
      COUNT=$(git rev-list --count HEAD)
      DATE=$(date +"%d/%m/%Y")
      MAJOR=$(( COUNT / 100 + 1 ))
      printf "const APP_VERSION = { v: '"'"'%s.%s'"'"', hash: '"'"'%s'"'"', date: '"'"'%s'"'"', commits: %s };\n" \
        "$MAJOR" "$COUNT" "$HASH" "$DATE" "$COUNT" > public/js/version.js
      cd server && npm install --production --silent && cd ..
      if pm2 list | grep -q "maestro-wpp"; then
        pm2 restart maestro-wpp --update-env
      else
        PORT=3003 pm2 start server/whatsapp.js --name maestro-wpp && pm2 save
      fi
      cp .deploy/nginx.conf /etc/nginx/sites-available/seudominio.com.br 2>/dev/null || true
      nginx -t && systemctl reload nginx || echo "NGINX reload skipped"
    '
```

**`update-whatsapp-lib.yml`** — Trigger: toda segunda às 06:00 UTC + `workflow_dispatch`

Verifica nova versão de `whatsapp-web.js` no npm, atualiza `server/package.json` e cria PR automático com as alterações.

### Secrets Necessários

| Secret | Descrição |
|--------|-----------|
| `VPS_SSH_KEY` | Chave SSH privada para acesso ao VPS |

---

## 39. Considerações para o Desenvolvimento

1. **Dados de exemplo:** Incluir conjunto de dados fictícios pré-configurados para Modo Demo do Dashboard. Nunca persistir no banco real.

2. **Versionamento:** Exibir `v{MAJOR}.{COUNT} · DD/MM/AAAA · #{HASH}` no rodapé de todas as telas. Gerado automaticamente no deploy via `version.js`.

3. **Módulos em Fase 6 (Propostas e Contratos):** Criar schema completo do banco e rotas de API desde o início, mesmo que UI parcial. Facilita ativação futura sem migrações complexas.

4. **Grupos ilimitados:** Nenhum número de grupos hardcoded. Suporte a quantidade ilimitada de grupos de consórcio.

5. **Múltiplos funis:** Suporte a múltiplos funis de vendas (imóveis, veículos). Etapas configuráveis via `funil-data.js` ou, futuramente, pela interface.

6. **Auditoria de ações:** Tabela `audit_trail` para rastrear: criação/edição/exclusão de leads, mudança de etapa, resultado de assembleia, alterações de configuração.

7. **Tratamento de erros em integrações:** Google, WhatsApp, bureau, API da administradora — todas com fallback visual + retry sem travar o restante da aplicação.

8. **Segurança:**
   - Todas as rotas de API exigem JWT válido (`Authorization: Bearer`)
   - Rotas administrativas verificam `role === 'admin'`
   - Nunca expor credenciais de integrações no frontend
   - Tokens OAuth armazenados no servidor (httpOnly cookies ou banco)
   - CPF e dados sensíveis nunca em logs

9. **Backup automático:** Backup diário do PostgreSQL no servidor (independente da exportação manual da interface).

10. **Internacionalização:** Todo o sistema em pt-BR:
    - Datas: `DD/MM/AAAA`
    - Moeda: `R$ 1.000,00` (ponto milhar, vírgula decimal)
    - Percentuais: `X,XX%`

11. **HTTPS obrigatório:** Necessário para OAuth Google e Geolocation API (bloqueio por geolocalização). Usar Let's Encrypt.

12. **Migração do localStorage para PostgreSQL:** O sistema atual usa `localStorage` para dados de leads. Na nova versão, todos os dados devem estar no servidor. Garantir que dados existentes possam ser exportados (via backup JSON) e reimportados no novo sistema sem perda de informação.

13. **Extensibilidade das notificações:** Estrutura de notificações deve suportar novos tipos futuros (ex: "Assembleia amanhã", "Contemplação registrada") sem refatoração da camada de entrega.

---

*Documento gerado a partir do código-fonte e análise do sistema em produção — v3.213*
