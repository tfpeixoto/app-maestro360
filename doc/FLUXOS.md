# FLUXOS — Gênesis

Documentação dos fluxos de dados e interações entre os módulos do sistema.

---

## 1. Arquitetura Geral

```
Browser (SPA)
  ├── crm.html ← ponto de entrada
  ├── public/js/*.js ← módulos carregados dinamicamente
  └── localStorage ← persistência de CRM

NGINX (VPS)
  ├── / → arquivos estáticos (crm.html, js, css)
  └── /wpp/* → proxy para servidor Node.js (porta 3001)

Servidor Node.js (server/)
  ├── Socket.io → eventos em tempo real para o browser
  ├── REST API → chats, mensagens, envio
  └── Evolution API v2 → WhatsApp via Baileys

Evolution API (Docker)
  └── WhatsApp ← via protocolo Baileys
```

---

## 2. Fluxo de Inicialização

```
Usuário abre crm.html
  → navigate('comunicacao') ativa módulo WhatsApp
  → _wppConnect() conecta Socket.io em /wpp/socket.io
  → Servidor emite wpp:status (ready | disconnected | qr)

Se "ready":
  → wpp:ready { name, phone } → renderiza app com conta conectada
  → _wppLoadChats() → GET /wpp/chats → renderiza lista
  → _wppLoadContacts() → GET /wpp/contacts → atualiza nomes reais

Se "qr":
  → wpp:qr (base64) → exibe QR Code + countdown de 60s
  → Polling /wpp/status a cada 3s (fallback caso webhook não chegue)
  → Após escaner → webhook connection.update state=open → wpp:ready
```

---

## 3. Fluxo de Chat WhatsApp

```
_wppSelectChat(chatId)
  ↓
1. Extrai rawPhone do JID (remove @s.whatsapp.net, @lid, etc.)
2. Busca lead:
     a. Por link salvo (crm_wpp_links)
     b. Por telefone (sufixo de 8 ou 10 dígitos)
     c. Por nome
3. Auto-salva link se encontrado por (b) ou (c)
4. Auto-cria lead se não encontrado (exceto grupos e @lid)
     → leadCreate({ nome, telefone, stage: 'wpp_novo', funnel: 'wpp' })
     → Salva link em crm_wpp_links
5. Renderiza cabeçalho com nome real (contacts map > chat.name > lead.nome > telefone)
6. GET /wpp/messages/:chatId → renderiza mensagens
7. Inicia polling de novas mensagens a cada 5s
8. Exibe painel lateral do lead (funil, estágio, notas, reuniões)
```

---

## 4. Fluxo de Mensagem Recebida (Tempo Real)

```
WhatsApp → Evolution API
  → POST /wpp/webhook (event: messages.upsert)
  → evolution.js _normalizeMsg()
  → io.emit('wpp:message', msgNormalizada)
  → Browser: _wppOnIncomingMessage(msg)
      ↓
      • Atualiza cache WPP.messages[chatId]
      • Atualiza contacts map com pushName da mensagem
      • Se chat está aberto → adiciona mensagem na tela
      • Se chat novo → cria lead automaticamente (se não existe)
      • Atualiza lista de chats (nome, lastMessage, unread)
```

---

## 5. Fluxo de Envio de Mensagem

```
Usuário digita texto + Enter (ou clica enviar)
  → _wppSendText(chatId)
  → Adiciona mensagem local (otimistic UI) com ack=0
  → POST /wpp/send/text { chatId, text }
  → Servidor: evo.sendText() → Evolution API POST /message/sendText/{instance}
  → Evolution API devolve { key: { id } }
  → Webhook messages.update → wpp:message_ack → atualiza ✓ na UI

Envio de arquivo (clip):
  → _wppSendMedia(event, chatId)
  → Lê arquivo via FileReader (base64)
  → Adiciona preview local
  → POST /wpp/send/media (multipart: chatId, file, caption)
  → Servidor: evo.sendMedia() → Evolution API POST /message/sendMedia/{instance}
```

---

## 6. Fluxo de Documentos

```
Documento recebido via webhook (webhookBase64: true):
  → media.data presente na mensagem normalizada
  → Renderiza com botão "Abrir" (PDF) ou "Baixar" (outros formatos)

Documento recebido via API (getMessages):
  → media.data pode estar ausente (mensagem antiga)
  → Renderiza com botão "Baixar" que chama _wppFetchAndOpenDoc()
      → POST /wpp/media { msgId, chatId, fromMe }
      → Servidor: evo.getMediaBase64() → Evolution API
      → Retorna base64
      → PDF: abre _wppOpenPdfModal() (iframe inline)
      → Outros: trigger download via <a>
```

---

## 7. Fluxo de Funil Multi-Funnel

```
Lead criado com funnel="wpp" e stage="wpp_novo"

Sidebar do chat exibe:
  → Dropdown de funnels (funnelsGet())
  → Botões de estágio do funil selecionado
  → _wppTrocarFunil(leadId, newFunnelId) → muda funil, vai para primeiro estágio
  → _wppMoverStage(leadId, stageId) → leadMoveStage() + registra histórico

Funil de Vendas kanban (funil-render.js):
  → Lê storeGet() e agrupa por stage
  → Drag-and-drop via HTML5
  → leadMoveStage() sincroniza localStorage
```

---

## 8. Fluxo de Reconexão WhatsApp

```
webhook connection.update state=close
  → io.emit('wpp:status', 'disconnected')
  → _scheduleReconnect() agenda reconexão em 15s
  → Após 15s: getStatus()
      → Se já conectado: ignora
      → Se desconectado: connectQR() → novo QR
  → Se reconnect falha: reagenda recursivamente
```

---

## 9. Fluxo de Nomes de Contatos

```
_wppLoadContacts() (chamado após _wppLoadChats):
  → GET /wpp/contacts → Evolution API /contact/fetchContacts/{instance}
  → Indexa WPP.contacts { jid → nome }
  → Atualiza chat.name para chats sem nome real
  → Re-renderiza lista

Prioridade de nome exibido:
  1. WPP.contacts[chatId]  (nome real do WhatsApp)
  2. chat.name             (se não for número/JID)
  3. lead.nome             (se vinculado ao CRM)
  4. _wppFmtPhone(phone)   (telefone formatado)
  5. JID sem sufixo        (fallback final)
```

---

## 10. Fluxo de Simulação

```
Usuário acessa módulo Simulador
  → simulador.js calcula parcelas, lances, redução de prazo
  → Resultado salvo no histórico (hist-sim.js → localStorage)
  → Botão "Gerar Proposta" → propostaCreate() vinculada ao lead
  → proposta-pdf.js renderiza PDF para impressão/download
```

---

## 11. Fluxo de Agenda

```
_wppRenderInfoPanel(lead) exibe reuniões do lead
  → "Agendar Reunião" abre modal
  → reuniaoCreate(dados) → localStorage
  → Opção "Enviar confirmação por WhatsApp"
      → _wppEnviarLinkReuniao(chatId, reuniao)
      → POST /wpp/send/text com texto formatado da reunião
```
