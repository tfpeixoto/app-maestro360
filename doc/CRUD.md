# CRUD — Gênesis

Documentação das operações de dados do sistema.

A persistência é híbrida: dados de CRM ficam no `localStorage` do navegador; o banco PostgreSQL está preparado para migração futura via `server/database/schema.sql`.

---

## Sumário

- [localStorage — Store Central](#localstorage--store-central)
- [Leads](#leads)
- [Funnels e Estágios](#funnels-e-estágios)
- [Reuniões](#reuniões)
- [Metas](#metas)
- [Cotas](#cotas)
- [Propostas](#propostas)
- [Contratos](#contratos)
- [Vínculos WhatsApp → Lead](#vínculos-whatsapp--lead)
- [Banco de Dados PostgreSQL](#banco-de-dados-postgresql)
- [API do Servidor WhatsApp](#api-do-servidor-whatsapp)

---

## localStorage — Store Central

Toda a lógica de CRUD de leads e funnels está em `public/js/funil-data.js`.

### Chaves utilizadas

| Chave | Tipo | Conteúdo |
|---|---|---|
| `crm_leads` | Array JSON | Lista de leads/clientes |
| `crm_funnels` | Array JSON | Funnels com estágios |
| `crm_reunioes` | Array JSON | Reuniões agendadas |
| `crm_metas` | Array JSON | Metas mensais |
| `crm_cotas` | Array JSON | Cotas locais |
| `crm_propostas` | Array JSON | Propostas geradas |
| `crm_contratos` | Array JSON | Contratos |
| `crm_wpp_links` | Object JSON | `{ chatId: leadId }` — vínculos WhatsApp |

---

## Leads

### Estrutura

```js
{
  id:          Number,      // gerado automaticamente (Date.now())
  nome:        String,
  telefone:    String,      // "(31) 9xxxx-xxxx"
  email:       String,
  origem:      String,      // "WhatsApp" | "Indicação" | "Site" | ...
  stage:       String,      // id do estágio no funil
  funnel:      String,      // id do funil (ex: "vendas", "wpp")
  dataCriacao: String,      // ISO date
  notas:       Array,       // [{ texto, data }]
  historico:   Array,       // [{ acao, de, para, data }]
  // ... campos adicionais de perfil
}
```

### Funções CRUD

```js
storeGet()                        // → Lead[]  (lê localStorage)
leadCreate(dados)                 // cria lead, salva, retorna o lead
leadUpdate(id, campos)            // atualiza campos específicos
leadDelete(id)                    // remove lead
leadMoveStage(id, stageId)        // move para estágio, registra histórico
```

---

## Funnels e Estágios

### Estrutura de Funil

```js
{
  id:     String,   // "vendas" | "wpp" | uuid gerado
  nome:   String,
  stages: [{ id: String, label: String }]
}
```

### Funções

```js
funnelsGet()          // → Funnel[]
funnelCreate(dados)   // cria funil
funnelUpdate(id, dados)
funnelDelete(id)
getAllStages()         // → Stage[] de todos os funnels
```

### Funnels padrão

| ID | Nome | Estágios |
|---|---|---|
| `vendas` | Funil de Vendas | Início → Lead → Qualificação → Simulação → Proposta → Contrato → Pós-venda |
| `wpp` | Funil WhatsApp | wpp_novo → Atendimento → Qualificado → Negociação → Ganho → Perdido |

---

## Reuniões

```js
// Estrutura
{ id, leadId, titulo, data, hora, tipo, local, observacoes, dataCriacao }

// Funções (agenda.js)
reunioesGet()
reuniaoCreate(dados)
reuniaoUpdate(id, dados)
reuniaoDelete(id)
```

---

## Metas

```js
// Estrutura
{ id, mes, ano, metaVendas, metaReceita, realizado, ... }

// Funções (metas.js)
metasGet()
metaCreate(dados)
metaUpdate(id, dados)
```

---

## Cotas

```js
// Estrutura local (crm_cotas)
{ id, tipo, valor, credito, parcela, administradora, status, leadId }

// Funções (cotas.js)
cotasGet()
cotaCreate(dados)
cotaUpdate(id, dados)
cotaDelete(id)
```

---

## Propostas

```js
// Estrutura
{ id, leadId, cotaId, valorCredito, parcela, entrada, dataCriacao, status }

// Funções (propostas.js)
propostasGet()
propostaCreate(dados)
propostaUpdate(id, dados)
```

---

## Contratos

```js
// Estrutura
{ id, leadId, cotaId, propostaId, dataAssinatura, status, ... }

// Funções (contratos.js)
contratosGet()
contratoCreate(dados)
contratoUpdate(id, dados)
```

---

## Vínculos WhatsApp → Lead

A chave `crm_wpp_links` no localStorage mapeia JIDs do WhatsApp a IDs de leads:

```js
// Exemplo
{ "553199999999@s.whatsapp.net": 1716000000000 }
```

Ao abrir um chat, o sistema:
1. Busca vínculo salvo por JID exato
2. Busca lead por sufixo de telefone (8 ou 10 dígitos)
3. Busca lead por nome
4. Se não encontrar, cria automaticamente com estágio `wpp_novo` no funil `wpp`

---

## Banco de Dados PostgreSQL

O arquivo `server/database/schema.sql` define 28 tabelas para uso futuro do backend. Para migrar:

```bash
cd server
node database/migrate.js
```

### Tabelas principais

| Tabela | Descrição |
|---|---|
| `usuarios` | Usuários do sistema |
| `leads` | Leads/clientes |
| `funis` | Funnels de venda |
| `funil_estagios` | Estágios de cada funil |
| `historico_estagios` | Histórico de movimentações |
| `simulacoes` | Simulações de consórcio |
| `propostas` | Propostas geradas |
| `contratos` | Contratos fechados |
| `cotas` | Cotas de consórcio |
| `reunioes` | Reuniões agendadas |
| `notas` | Notas por lead |
| `metas` | Metas de vendas |
| `mensagens_wpp` | Cache de mensagens WhatsApp |

---

## API do Servidor WhatsApp

O servidor `server/index.js` expõe endpoints REST e eventos Socket.io para comunicação com Evolution API v2.

### REST

```
GET  /chats                     → lista de chats
GET  /contacts                  → lista de contatos com nomes reais
GET  /messages/:chatId?limit=40 → mensagens de um chat
POST /send/text                 { chatId, text }
POST /send/media                multipart: chatId, caption, file
POST /media                     { msgId, chatId, fromMe } → base64 do documento
POST /read/:chatId              marca como lido
POST /webhook                   receptor de eventos da Evolution API
```

### Socket.io eventos

| Evento | Direção | Payload |
|---|---|---|
| `wpp:status` | server → client | `'ready' \| 'qr' \| 'disconnected' \| 'connecting'` |
| `wpp:qr` | server → client | string base64 do QR |
| `wpp:ready` | server → client | `{ name, phone }` |
| `wpp:message` | server → client | objeto de mensagem normalizado |
| `wpp:message_ack` | server → client | `{ id, ack }` |
