# Requirements Document

## Introduction

Reescrita completa do sistema CRM Maestro 360 (Gênesis) — uma plataforma especializada em gestão de vendas de consórcios — de vanilla HTML/CSS/JS com persistência em localStorage para uma stack moderna usando Next.js, TanStack Query, Auth.js e PostgreSQL. A reescrita migra todos os 24+ módulos, preserva as regras de negócio existentes, habilita colaboração multi-usuário e mantém as integrações em tempo real (WhatsApp via Evolution API, Google Calendar/Drive/Gmail, API Credicob).

## Glossary

- **CRM**: A aplicação Maestro 360 — sistema de Gestão de Relacionamento com Clientes para vendas de consórcio
- **Lead**: Um cliente potencial rastreado pelo pipeline de vendas com código único (CLI-XXXX)
- **Funil**: Um pipeline de vendas configurável (quadro Kanban) com estágios ordenados
- **Estágio**: Uma etapa dentro de um Funil representando uma fase no processo de vendas
- **Simulação**: Um cálculo de portfólio (código COT-XXXX) combinando grupos de consórcio, créditos e parcelas
- **Grupo_Consórcio**: Um grupo de consórcio (ex: 4003, 4004) com número fixo de cotas
- **Cota**: Uma participação individual dentro de um Grupo_Consórcio com status (disponível, reservada, vendida, contemplada)
- **Assembleia**: Uma reunião mensal do consórcio onde contemplações e lances são resolvidos
- **Lance**: Um percentual oferecido por um participante para acelerar a contemplação em uma Assembleia
- **Contemplação**: O evento onde um cotista recebe seu crédito (via lance ou sorteio)
- **Proposta**: Uma proposta comercial (PROP-XXX) gerada a partir de uma Simulação e vinculada a um Lead
- **Contrato**: Um acordo assinado (CTR-XXXX) vinculado a um Lead e opcionalmente a uma Proposta
- **Parcela**: Um pagamento mensal associado a um Contrato
- **Evolution_API**: Serviço de integração WhatsApp de terceiros usando o protocolo Baileys
- **API_Credicob**: API externa que fornece cotas de consórcio disponíveis para transferência
- **Sistema_Auth**: O subsistema de autenticação e autorização usando Auth.js (NextAuth)
- **TanStack_Query**: A biblioteca de gerenciamento de estado do servidor (React Query) usada para busca e cache de dados
- **Sessão**: Um contexto de usuário autenticado com token JWT, expiração de 8 horas e timeout de inatividade de 30 minutos
- **Papel**: Um nível de permissão de usuário — admin (acesso total), gerente (gestão) ou vendedor (consultor de vendas)
- **Geo_Block**: Mecanismo de segurança de login que valida a localização do usuário via GPS e geolocalização por IP

## Requirements

### Requisito 1: Arquitetura do Projeto e Configuração da Stack

**User Story:** Como desenvolvedor, quero o projeto estruturado com Next.js, TanStack Query, Auth.js e PostgreSQL, para que todos os módulos compartilhem uma base moderna e consistente.

#### Acceptance Criteria

1. O CRM DEVE usar Next.js (App Router) como framework da aplicação, utilizando React Server Components para busca inicial de dados e renderização de páginas, e client components para interações do usuário que requerem estado local ou event handlers do browser
2. O CRM DEVE usar TanStack_Query para todo gerenciamento de estado do servidor no client-side incluindo busca, cache e mutação de dados, com staleTime configurado em no máximo 60 segundos e retry de no máximo 3 tentativas em caso de falha de requisição
3. O CRM DEVE usar Auth.js (NextAuth) para autenticação com provider de credenciais (email/senha com bcrypt) e provider Google OAuth, mantendo sessões com duração máxima de 24 horas antes de exigir re-autenticação
4. IF a conexão com o banco de dados PostgreSQL falhar durante uma requisição, THEN O CRM DEVE retornar uma indicação de erro de indisponibilidade ao usuário em no máximo 5 segundos sem expor detalhes internos da conexão
5. O CRM DEVE conectar-se a um banco de dados PostgreSQL usando o schema existente definido em server/database/schema.sql
6. O CRM DEVE usar um ORM ou query builder type-safe (Prisma ou Drizzle) para interagir com o banco de dados PostgreSQL
7. O CRM DEVE implementar um layout responsivo com navegação lateral retrátil contendo as seções de menu existentes (Início, Prospecção, Ferramentas, Comercial, Grupos & Cotas, Financeiro, Administração), onde a sidebar colapsa para exibir apenas ícones em viewports com largura inferior a 768px e pode ser recolhida/expandida manualmente pelo usuário em qualquer viewport

### Requisito 2: Autenticação e Gerenciamento de Sessão

**User Story:** Como administrador do sistema, quero autenticação segura com geo-blocking e controle de sessão, para que apenas usuários autorizados em locais permitidos possam acessar o sistema.

#### Acceptance Criteria

1. WHEN um usuário submete credenciais válidas (email cadastrado, conta ativa e senha correspondente ao hash bcrypt armazenado), THE Sistema_Auth SHALL gerar um token JWT com expiração de 8 horas e estabelecer uma Sessão
2. WHEN um usuário submete credenciais inválidas (email não encontrado, conta inativa ou senha incorreta), THE Sistema_Auth SHALL rejeitar a tentativa de login com mensagem genérica que não revele qual campo está incorreto, e registrar a falha em auth_audit_logs com status 'falha_senha'
3. IF um usuário acumular 5 tentativas de login com falha consecutivas para o mesmo email dentro de 15 minutos, THEN THE Sistema_Auth SHALL bloquear novas tentativas para aquele email por 15 minutos e registrar com status 'bloqueado_tentativas'
4. WHEN um usuário concede permissão GPS durante o login, THE Sistema_Auth SHALL validar as coordenadas contra a área geográfica permitida configurada nas configurações do sistema
5. IF um usuário negar permissão GPS, THEN THE Sistema_Auth SHALL realizar fallback de validação geográfica via geolocalização por IP
6. IF as coordenadas GPS do usuário estiverem fora da área geográfica permitida, THEN THE Sistema_Auth SHALL bloquear o login e registrar a tentativa com status 'bloqueado_geo'
7. IF o usuário negar permissão GPS e a geolocalização por IP indicar localização fora da área permitida, THEN THE Sistema_Auth SHALL bloquear o login e registrar a tentativa com status 'bloqueado_geo'
8. IF o serviço de geolocalização por IP estiver indisponível (timeout de 5 segundos ou erro de rede) e o GPS não estiver disponível, THEN THE Sistema_Auth SHALL bloquear o login e registrar com status 'bloqueado_geo_indisponivel'
9. THE Sistema_Auth SHALL registrar toda tentativa de login em auth_audit_logs incluindo: username digitado, endereço IP, porta, coordenadas GPS (lat/lon), user agent, SO, navegador, país, estado, cidade, ISP, coordenadas por IP e timestamp UTC
10. WHILE uma Sessão está ativa, THE Sistema_Auth SHALL monitorar atividade do usuário (mousemove, keydown, scroll, click, touchstart) e resetar o timer de inatividade a cada evento detectado
11. WHEN 28 minutos de inatividade se passarem, THE Sistema_Auth SHALL exibir um modal de aviso com contagem regressiva de 2 minutos e botão "Continuar"
12. IF o timeout de 30 minutos de inatividade expirar sem interação do usuário, THEN THE Sistema_Auth SHALL encerrar a Sessão, descartar o token do armazenamento do navegador e redirecionar para a página de login
13. THE Sistema_Auth SHALL verificar a expiração do JWT a cada 60 segundos e encerrar a Sessão imediatamente quando o token expirar
14. WHEN uma aba do navegador é fechada e reaberta, THE Sistema_Auth SHALL exigir re-autenticação (o token SHALL ser armazenado exclusivamente em sessionStorage, não persistindo entre reinícios do navegador)

### Requisito 3: Controle de Acesso Baseado em Papéis

**User Story:** Como administrador, quero permissões baseadas em papéis, para que cada membro da equipe veja apenas as funcionalidades apropriadas ao seu papel.

#### Acceptance Criteria

1. THE Sistema_Auth SHALL suportar três papéis mutuamente exclusivos armazenados no campo `papel` da tabela usuarios: admin, gerente e vendedor
2. WHILE um usuário com Papel 'admin' está autenticado, THE CRM SHALL conceder acesso de leitura, criação, edição e exclusão a todos os módulos incluindo gestão de equipe, configurações do sistema e logs de auditoria
3. WHILE um usuário com Papel 'gerente' está autenticado, THE CRM SHALL conceder acesso a leads, simulações, propostas, contratos, reuniões, funil, metas, dashboard, cotas e campanhas de todos os membros da equipe, além de visualização somente-leitura das configurações do sistema, mas restringir criação, edição e exclusão de configurações do sistema e logs de auditoria
4. WHILE um usuário com Papel 'vendedor' está autenticado, THE CRM SHALL restringir acesso apenas aos leads, simulações, propostas, contratos e reuniões onde o campo responsavel_id corresponde ao id do usuário autenticado
5. WHEN um vendedor tenta acessar dados de Lead, Simulação, Proposta, Contrato ou Reunião cujo responsavel_id não corresponde ao seu próprio id, THE CRM SHALL negar a requisição e retornar status 403
6. THE CRM SHALL aplicar verificação de permissões no servidor (API) independentemente da interface do usuário, de modo que requisições diretas à API sem passar pela UI também sejam bloqueadas conforme as regras do papel
7. WHILE um usuário com Papel 'vendedor' está autenticado, THE CRM SHALL ocultar da navegação os itens de menu: gestão de equipe, configurações do sistema e logs de auditoria

### Requisito 4: Funil de Vendas (Quadro Kanban)

**User Story:** Como consultor de vendas, quero um quadro Kanban multi-funil com drag-and-drop, para que eu possa gerenciar visualmente os leads pelo pipeline de vendas.

#### Acceptance Criteria

1. WHEN um usuário seleciona um Funil, THE CRM SHALL exibir um quadro Kanban com colunas ordenadas pelo campo `ordem` dos estágios do Funil selecionado, e caso o Funil não possua estágios cadastrados, exibir uma mensagem indicando ausência de etapas
2. THE CRM SHALL suportar múltiplos funis: Vendas (7 estágios), WhatsApp (3 estágios), Simulador (3 estágios) e funis customizados criados pelo usuário, limitados a no máximo 20 funis e no máximo 15 estágios por funil
3. WHEN um usuário arrasta um card de Lead de uma coluna de Estágio para outra, THE CRM SHALL atualizar o stage_id do Lead no banco de dados e registrar a transição em lead_historico com texto indicando estágio de origem e destino
4. IF a atualização de stage_id falha durante o drag-and-drop, THEN THE CRM SHALL reverter visualmente o card para a coluna de origem e exibir uma mensagem de erro indicando falha na movimentação
5. WHEN um usuário move um Lead para um Estágio com campo `ordem` inferior ao estágio atual (regressão), THE CRM SHALL exibir um diálogo de confirmação antes de executar a movimentação, e cancelar a operação caso o usuário recuse
6. THE CRM SHALL exibir cada card de Lead com: nome, código (CLI-XXXX), valor do crédito formatado em R$ e badge do estágio atual
7. WHEN um usuário clica em "+ Novo Lead" na página do Funil, THE CRM SHALL abrir um formulário de criação com campos: nome (obrigatório, entre 3 e 200 caracteres), telefone (obrigatório, com máscara de telefone brasileiro), email (opcional, formato válido), valor do crédito (opcional), objetivo, origem e estágio inicial
8. WHEN um novo Lead é salvo, THE CRM SHALL gerar um código sequencial único no formato CLI-XXXX (nunca reutilizado) e verificar unicidade do telefone, exibindo aviso de duplicidade com nome do Lead existente e permitindo ao usuário cancelar ou prosseguir
9. THE CRM SHALL exibir métricas KPI acima do Kanban: total de leads no funil selecionado, contratos fechados, valor total do pipeline em R$ e taxa de conversão em %
10. WHEN um usuário ativa o modo "Editar Board", THE CRM SHALL permitir renomear, reordenar, adicionar e remover estágios dentro do Funil selecionado, mantendo no mínimo 1 estágio por funil
11. IF um usuário remove um estágio que contém leads, THEN THE CRM SHALL mover automaticamente os leads afetados para o primeiro estágio restante do funil e exibir confirmação prévia informando a quantidade de leads que serão realocados

### Requisito 5: Gestão de Leads e Clientes

**User Story:** Como consultor de vendas, quero um banco de dados completo de clientes com perfis, histórico e etiquetas, para que eu possa gerenciar relacionamentos de forma eficaz.

#### Acceptance Criteria

1. THE CRM SHALL exibir uma lista paginada (20 itens por página), pesquisável e filtrável de todos os Leads com colunas: código (CLI-XXXX), nome, estágio (badge colorido), status de reunião (badge), etiquetas (até 3 visíveis com indicador "+N"), valor do crédito (R$), telefone e ações (abrir perfil, editar, excluir)
2. THE CRM SHALL suportar filtragem de Leads por estágio, status de reunião (agendada, realizada, cancelada, precisa-agendar), origem e busca livre por nome, telefone, email e código com debounce de 300ms e mínimo de 2 caracteres
3. THE CRM SHALL suportar dois modos de visualização para a lista de Leads: tabela (lista) e grade de cards, preservando o modo selecionado durante a sessão do usuário
4. WHEN um usuário abre o perfil de um Lead, THE CRM SHALL exibir uma visualização em tela cheia com abas: Contato (dados editáveis), Financeiro (histórico financeiro), Histórico (timeline de estágios + simulações), Patrimônio (bens declarados) e CRM (notas, etiquetas, reuniões)
5. THE CRM SHALL exibir todas as simulações (COT-XXXX) vinculadas a um Lead na aba Histórico com badges de status, ordenadas por data de criação decrescente; WHEN nenhuma simulação existir, THE CRM SHALL exibir um estado vazio com mensagem indicativa
6. WHEN um usuário adiciona uma etiqueta a um Lead, THE CRM SHALL validar que o label possui entre 1 e 30 caracteres e que o Lead não excede 10 etiquetas, e persistir a etiqueta com label e cor (formato hexadecimal de 7 caracteres) na tabela lead_tags
7. WHEN um usuário adiciona uma nota a um Lead, THE CRM SHALL validar que o texto possui entre 1 e 2000 caracteres e persistir na tabela lead_notas com autor_id do usuário autenticado e timestamp (criado_em)
8. IF a busca ou filtragem não retornar resultados, THEN THE CRM SHALL exibir um estado vazio com mensagem indicando que nenhum lead foi encontrado e sugestão para ajustar os filtros
9. IF a adição de etiqueta falhar por exceder o limite de 10 etiquetas por Lead, THEN THE CRM SHALL exibir uma mensagem de erro indicando o limite máximo atingido sem persistir a etiqueta

### Requisito 6: Simulador de Portfólio (Wizard de 6 Etapas)

**User Story:** Como consultor de vendas, quero um wizard guiado de simulação, para que eu possa montar portfólios personalizados de consórcio para os clientes.

#### Acceptance Criteria

1. THE CRM SHALL apresentar um wizard de 6 etapas sequenciais: Cliente → Objetivo → Capacidade → Portfólio → Parâmetros → Resumo, permitindo navegação para etapas anteriores já completadas e impedindo avanço para a próxima etapa enquanto a etapa atual não estiver válida
2. WHEN um usuário insere um CPF com 11 dígitos válidos na etapa 1, THE CRM SHALL buscar Leads existentes por CPF e preencher automaticamente os campos nome, telefone e email se encontrar correspondência
3. THE CRM SHALL validar os campos da etapa 1: nome (obrigatório, mín 3 caracteres, máx 120 caracteres), telefone (obrigatório, máscara (00) 00000-0000, exatamente 11 dígitos), CPF (opcional, verificação de dígitos verificadores conforme algoritmo da Receita Federal), email (opcional, validação de formato)
4. THE CRM SHALL apresentar 4 opções de objetivo na etapa 2: Imóvel, Veículo, Ganho Financeiro, Outro — e filtrar os grupos disponíveis de acordo na etapa 4
5. THE CRM SHALL validar os campos da etapa 3 (Capacidade): crédito desejado (obrigatório, valor em R$ entre 50.000 e 2.000.000), aporte mensal (obrigatório, valor em R$ maior que zero) e lance disponível (opcional, valor em R$)
6. THE CRM SHALL exibir uma tabela de seleção de grupos/cotas na etapa 4 com colunas: Grupo, Prazo, Crédito, Parcela (100%) e controles de quantidade (+/−), com quantidade mínima de 0 e máxima de 10 por linha de crédito
7. THE CRM SHALL exigir pelo menos 1 cota selecionada na etapa 4 e exibir um resumo dinâmico atualizado a cada alteração de quantidade: total de cotas, crédito total (R$) e parcela mensal total (R$)
8. THE CRM SHALL fornecer controles de parâmetros na etapa 5: percentual da parcela (50%/70%/100%), mês de contemplação esperado (slider de 1 até o prazo máximo do grupo em incrementos de 1 mês) e percentual de lance embutido (slider 0%–30% em incrementos de 1%)
9. WHEN o usuário completa o wizard, THE CRM SHALL gerar um código único COT-XXXX (sequencial, nunca reutilizado), salvar a simulação na tabela simulacoes e vinculá-la ao Lead
10. IF o Lead não existir (por CPF), THEN THE CRM SHALL criar um novo Lead com código CLI-XXXX no funil 'simulador' no estágio 'sim_simulado'
11. IF o Lead existir e estiver em um estágio anterior a 'sim' (Simulação), THEN THE CRM SHALL avançar o Lead para o estágio 'sim' automaticamente
12. IF nenhum grupo estiver disponível para o objetivo selecionado na etapa 4, THEN THE CRM SHALL exibir uma mensagem indicando a indisponibilidade e impedir o avanço para a etapa 5
13. IF a busca de Lead por CPF falhar por erro de rede ou servidor, THEN THE CRM SHALL exibir uma mensagem de erro e permitir que o usuário prossiga com preenchimento manual dos campos

### Requisito 7: Ferramenta Comparativa

**User Story:** Como consultor de vendas, quero comparar custos de consórcio vs financiamento visualmente, para que eu possa demonstrar a vantagem financeira aos clientes.

#### Acceptance Criteria

1. THE CRM SHALL fornecer dois modos de comparação: Imóvel (consórcio vs financiamento vs aluguel) e Veículo (consórcio vs financiamento vs Uber/aluguel), selecionáveis pelo usuário antes de iniciar a comparação
2. THE CRM SHALL aceitar parâmetros de entrada para o cenário de consórcio (valor do bem: R$ 50.000 a R$ 2.000.000, entrada: 0%–50% do valor, parcela mensal, prazo em meses, IPTU mensal, condomínio mensal, manutenção mensal, valorização anual: 0%–20%) e para o cenário de aluguel (aluguel mensal: R$ 500 a R$ 50.000, reajuste anual: 0%–30%, taxa de rendimento do capital: 0%–30% a.a.)
3. THE CRM SHALL calcular e exibir o custo total acumulado ao longo de um horizonte configurável (1–30 anos para imóvel, 1–20 anos para veículo) para cada cenário, apresentando os resultados em cards comparativos lado a lado e um gráfico de evolução patrimonial ao longo do tempo
4. THE CRM SHALL exibir a diferença monetária absoluta (economia em R$) e percentual entre o cenário de menor custo e os demais, e uma recomendação textual indicando qual cenário apresenta menor custo total no horizonte selecionado
5. WHEN uma Simulação (COT-XXXX) existe vinculada à sessão autenticada do usuário, THE CRM SHALL pré-preencher a ferramenta comparativa com os valores de crédito, parcela e prazo daquela Simulação
6. IF o usuário submete a comparação com campos obrigatórios vazios ou com valores fora dos limites permitidos, THEN THE CRM SHALL impedir o cálculo e indicar quais campos precisam de correção
7. THE CRM SHALL permitir ao usuário ajustar parâmetros de mercado (taxa de financiamento, percentual de entrada para financiamento, taxa de rendimento) e recalcular os resultados automaticamente ao alterar qualquer parâmetro

### Requisito 8: Histórico de Simulações

**User Story:** Como consultor de vendas, quero visualizar todas as simulações de todos os leads, para que eu possa acompanhar propostas de portfólio ao longo do tempo.

#### Acceptance Criteria

1. THE CRM SHALL exibir uma tabela de todas as simulações ordenada por data de criação decrescente com colunas: data, nome do cliente, grupo(s), crédito total (R$), status e ações
2. THE CRM SHALL exibir cards de KPI acima da tabela: contagem total de simulações, contagem de clientes únicos e crédito total simulado (R$)
3. THE CRM SHALL suportar filtragem por nome do cliente (busca textual com debounce de 300ms), grupo (seleção em dropdown) e status (Pré-proposta, Proposta, Convertida)
4. WHEN um usuário clica em "Ver Perfil" em uma linha de simulação, THE CRM SHALL navegar para a página de perfil do Lead correspondente
5. IF nenhuma simulação existir no sistema, THEN THE CRM SHALL exibir um estado vazio com mensagem indicando ausência de simulações e um botão de ação para criar nova simulação
6. IF os filtros aplicados não retornarem resultados, THEN THE CRM SHALL exibir uma mensagem indicando que nenhuma simulação corresponde aos filtros selecionados e um botão para limpar os filtros

### Requisito 9: Agenda e Reuniões

**User Story:** Como consultor de vendas, quero gerenciar reuniões com visualizações de calendário e sincronização com Google Calendar, para que eu possa organizar minha agenda e acompanhar metas de reuniões.

#### Acceptance Criteria

1. THE CRM SHALL fornecer quatro visualizações de calendário: Lista (cronológica), Semana, Mês e Dia
2. WHEN um usuário cria uma reunião, THE CRM SHALL exigir: título (máximo 100 caracteres), tipo (Apresentação, Follow-up, Proposta, Outro), data e hora de início; e opcionalmente aceitar: Lead vinculado, hora de término, local (máximo 200 caracteres) e observações (máximo 500 caracteres)
3. THE CRM SHALL rastrear o status de cada reunião pelo ciclo de vida: agendada → realizada ou agendada → cancelada
4. IF o Google Calendar está conectado, WHEN uma reunião é criada, THE CRM SHALL criar um evento correspondente no Google Calendar e gerar um link Google Meet automaticamente
5. IF a sincronização com o Google Calendar falhar durante a criação do evento, THEN THE CRM SHALL salvar a reunião localmente, exibir uma mensagem de erro indicando a falha na sincronização e manter a reunião com status agendada
6. THE CRM SHALL exibir barras de progresso de metas de reunião no topo da página de agenda: reuniões de hoje vs meta diária, agendadas no mês vs meta mensal, realizadas no mês vs meta mensal
7. WHEN um usuário marca uma reunião como "Realizada", THE CRM SHALL atualizar o status da reunião para "realizada" e incrementar o contador de reuniões realizadas para acompanhamento de metas
8. WHEN faltam 60 minutos, 15 minutos ou 5 minutos para uma reunião agendada, THE CRM SHALL disparar uma notificação do navegador com o título e horário da reunião
9. IF o usuário não concedeu permissão para notificações do navegador, THEN THE CRM SHALL solicitar a permissão na primeira carga da página de agenda e exibir os lembretes apenas dentro da interface da aplicação

### Requisito 10: Metas e KPIs

**User Story:** Como gerente de vendas, quero metas de KPI configuráveis com acompanhamento automático de progresso, para que eu possa monitorar o desempenho da equipe em relação aos objetivos.

#### Acceptance Criteria

1. THE CRM SHALL rastrear seis métricas de KPI por mês por usuário: prospecção (novos leads criados no mês), leads em estágios avançados, reuniões agendadas, reuniões realizadas, reuniões hoje e vendas (contratos fechados no mês)
2. THE CRM SHALL calcular o progresso dos KPIs automaticamente a partir dos dados reais no banco de dados sem entrada manual, recalculando os valores a cada carregamento da página de metas
3. THE CRM SHALL exibir cards de KPI com valor atual, meta, percentual de progresso (arredondado para inteiro, exibindo valores acima de 100% quando o realizado exceder a meta), gráfico sparkline (últimos 6 meses) e contagem "faltam X" (exibida apenas quando o realizado é inferior à meta)
4. WHEN o primeiro acesso do mês ocorre e o mês anterior ainda não possui snapshot, THE CRM SHALL fazer snapshot dos valores realizados do mês anterior na tabela metas_realizadas para rastreamento histórico
5. THE CRM SHALL exibir uma tabela histórica dos últimos 6 meses com todos os valores de KPI e percentuais de atingimento por métrica
6. WHILE um usuário com Papel 'admin' ou 'gerente' está autenticado, THE CRM SHALL permitir editar os valores de meta para cada uma das seis métricas de KPI, aceitando apenas valores inteiros entre 1 e 9999
7. IF um usuário com Papel 'vendedor' acessa a página de metas, THEN THE CRM SHALL exibir apenas os KPIs do próprio usuário em modo somente leitura, sem acesso à edição de metas

### Requisito 11: Integração de Chat WhatsApp

**User Story:** Como consultor de vendas, quero mensagens WhatsApp em tempo real dentro do CRM, para que eu possa me comunicar com leads sem trocar de aplicativo.

#### Acceptance Criteria

1. THE CRM SHALL conectar-se ao WhatsApp via Evolution_API usando Socket.io para entrega de mensagens em tempo real, mantendo a conexão WebSocket ativa enquanto a aba do navegador estiver aberta
2. WHEN a instância WhatsApp está desconectada, THE CRM SHALL exibir um QR code para o usuário escanear e estabelecer conexão, com countdown de 60 segundos antes de gerar novo QR
3. WHEN uma nova mensagem chega via webhook (event messages.upsert), THE CRM SHALL emitir um evento Socket.io 'wpp:message' e atualizar a interface de chat em tempo real sem recarregar a página
4. WHEN uma mensagem é recebida de um número de telefone que não possui vínculo em wpp_links nem correspondência por telefone na tabela leads, THE CRM SHALL criar automaticamente um novo Lead com estágio 'wpp_novo' no funil 'wpp' e vincular o chat ao Lead via tabela wpp_links
5. THE CRM SHALL persistir todas as mensagens WhatsApp na tabela wpp_mensagens com: message_id, chat_id, instancia_id, lead_id, flag from_me, tipo da mensagem (chat, image, video, audio, ptt, document, sticker, location, vcard, revoked), corpo, quoted_msg_id, media_url, media_mimetype, media_filename, status ack (0=pendente, 1=servidor, 2=entregue, 3=lido, 4=reproduzido) e timestamp_wpp
6. THE CRM SHALL suportar envio de mensagens de texto, arquivos de mídia (até 16MB) e áudio PTT (mensagem de voz) através da Evolution_API
7. THE CRM SHALL exibir indicadores de status de entrega da mensagem (✓ enviada, ✓✓ entregue, ✓✓ azul lida) atualizados via eventos wpp:message_ack
8. WHEN um usuário abre um chat, THE CRM SHALL exibir um painel lateral com o perfil do Lead vinculado: funil, estágio, notas e histórico de reuniões
9. IF a conexão Socket.io for perdida, THEN THE CRM SHALL tentar reconexão automática a cada 15 segundos e exibir indicador visual de "reconectando" na interface de chat
10. THE CRM SHALL exibir a lista de chats ordenada por última mensagem (mais recente primeiro) com: nome do contato, preview da última mensagem, horário e badge de mensagens não lidas

### Requisito 12: Integração de Email (Gmail)

**User Story:** Como consultor de vendas, quero ler e enviar emails de dentro do CRM, para que eu possa gerenciar toda a comunicação com clientes em um só lugar.

#### Acceptance Criteria

1. THE CRM SHALL autenticar com Gmail via Google OAuth 2.0 com escopos: gmail.modify e gmail.send, usando o mesmo fluxo de conexão Google compartilhado com Calendar e Drive
2. WHEN o Google está conectado, THE CRM SHALL listar até 40 threads de email da caixa de entrada do usuário exibindo para cada thread: remetente, assunto, snippet, data e indicador de não lida
3. WHEN um usuário abre uma thread, THE CRM SHALL exibir todas as mensagens da thread em ordem cronológica com remetente, destinatário, data e corpo (texto ou HTML) e marcar mensagens não lidas como lidas
4. WHEN um usuário compõe um novo email, THE CRM SHALL exigir destinatário (email válido) e corpo da mensagem como campos obrigatórios, aceitar assunto como opcional, e enviar através da API do Gmail
5. WHEN um usuário responde a uma thread, THE CRM SHALL preencher automaticamente o destinatário e assunto (com prefixo "Re:") e vincular a resposta à thread original
6. IF o token OAuth expirar ou for revogado durante o uso, THEN THE CRM SHALL exibir uma mensagem orientando o usuário a reconectar a conta Google
7. THE CRM SHALL suportar busca de emails por texto livre e filtragem por Lead vinculado

### Requisito 13: Quadro de Cotas

**User Story:** Como consultor de vendas, quero uma grade visual dos grupos de consórcio e cotas, para que eu possa ver rapidamente a disponibilidade e gerenciar reservas.

#### Acceptance Criteria

1. THE CRM SHALL exibir uma grade visual para cada Grupo_Consórcio mostrando todas as cotas coloridas por status: disponível (verde), reservada (amarelo), vendida (azul), contemplada (roxo)
2. WHEN um usuário clica em uma Cota, THE CRM SHALL abrir um modal de detalhes mostrando: grupo, número, status, Lead vinculado (se houver) e botões de ação
3. WHEN um usuário reserva ou vende uma Cota, THE CRM SHALL atualizar o status da cota na tabela cotas e vinculá-la ao Lead correspondente
4. THE CRM SHALL carregar dados de Grupo_Consórcio e status das cotas do banco de dados (não hardcoded)
5. THE CRM SHALL exibir um resumo por grupo: total de cotas, disponíveis, reservadas, vendidas e contempladas

### Requisito 14: Cotas Disponíveis (API Credicob)

**User Story:** Como consultor de vendas, quero navegar pelas cotas de transferência disponíveis na API Credicob, para que eu possa oferecer cotas contempladas aos clientes.

#### Acceptance Criteria

1. THE CRM SHALL buscar cotas disponíveis da API_Credicob e exibi-las como cards com: valor do crédito, parcela mensal, categoria e status de disponibilidade
2. THE CRM SHALL suportar filtragem por categoria (Imóvel/Veículo), disponibilidade e busca livre
3. WHEN um usuário clica em "Reservar" em um card de cota, THE CRM SHALL enviar uma requisição PATCH para a API_Credicob para marcar a cota como reservada
4. THE CRM SHALL cachear respostas da API_Credicob por 5 minutos via TanStack_Query staleTime e invalidar o cache após qualquer mutação
5. IF a API_Credicob estiver indisponível ou retornar erro, THEN THE CRM SHALL exibir uma mensagem de indisponibilidade e permitir retry manual

### Requisito 15: Propostas

**User Story:** Como consultor de vendas, quero criar e acompanhar propostas comerciais vinculadas a leads e simulações, para que eu possa gerenciar a progressão do pipeline de vendas.

#### Acceptance Criteria

1. THE CRM SHALL suportar criação de propostas vinculadas a um Lead com campos: título, descrição, valor, grupo, crédito, percentual de embutido, lances, prazo e taxa
2. THE CRM SHALL rastrear o status da proposta pelo ciclo de vida: rascunho → enviada → aceita → rejeitada → assinada → convertida
3. WHEN o status de uma proposta muda para 'assinada', THE CRM SHALL habilitar conversão para um Contrato
4. THE CRM SHALL exibir uma lista de todas as propostas com filtros por status e busca por nome do cliente
5. THE CRM SHALL gerar um número sequencial único para cada proposta no formato PROP-XXXX (nunca reutilizado)

### Requisito 16: Contratos

**User Story:** Como consultor de vendas, quero gerenciar contratos assinados, para que eu possa acompanhar acordos ativos e seu ciclo de vida.

#### Acceptance Criteria

1. THE CRM SHALL suportar criação de contratos vinculados a um Lead e opcionalmente a uma Proposta com campos: título, número (CTR-XXXX gerado automaticamente, nunca reutilizado), valor, descrição, data de início, data de fim e status
2. THE CRM SHALL rastrear status do contrato: ativo, pendente, cancelado, encerrado
3. WHEN um contrato é criado, THE CRM SHALL gerar registros de parcelas na tabela parcelas baseado no valor e prazo do contrato
4. THE CRM SHALL exibir uma lista de todos os contratos com filtros por status e Lead vinculado

### Requisito 17: Parcelas e Inadimplência

**User Story:** Como gerente financeiro, quero rastrear pagamentos de parcelas e identificar contas inadimplentes, para que eu possa gerenciar o fluxo de caixa e acompanhar pagamentos em atraso.

#### Acceptance Criteria

1. THE CRM SHALL exibir parcelas por contrato com colunas: data de vencimento, valor, mês de referência, status (pendente, pago, atrasado) e data de pagamento
2. WHEN a data de vencimento de uma parcela passa sem pagamento, THE CRM SHALL atualizar automaticamente seu status para 'atrasado'
3. THE CRM SHALL fornecer uma visualização de inadimplência listando todos os Leads com pelo menos uma parcela em status 'atrasado', ordenados por dias em atraso
4. THE CRM SHALL calcular e exibir o valor total em atraso por Lead e no portfólio geral

### Requisito 18: Assembleias, Lances e Cotas Contempladas

**User Story:** Como gestor de consórcio, quero registrar resultados de assembleias, lances e contemplações, para que eu possa acompanhar o progresso dos grupos e resultados dos clientes.

#### Acceptance Criteria

1. THE CRM SHALL suportar criação de registros de Assembleia com: grupo, data, horário, local, status (agendada, realizada, cancelada), número de contemplados e percentual do lance vencedor
2. WHEN uma Assembleia é marcada como 'realizada', THE CRM SHALL permitir registrar Leads contemplados via tabela assembleia_contemplados
3. THE CRM SHALL suportar registro de Lances com: Lead, Assembleia, grupo, percentual, valor do crédito e resultado (vencedor, pendente, não contemplado)
4. THE CRM SHALL exibir uma lista de cotas contempladas com filtros por grupo e período
5. THE CRM SHALL exibir histórico de lances por grupo com percentuais vencedores e tendências

### Requisito 19: Dashboard

**User Story:** Como gerente de vendas, quero um dashboard abrangente com KPIs, gráficos e feeds de atividade, para que eu possa monitorar o desempenho do negócio de forma rápida.

#### Acceptance Criteria

1. THE CRM SHALL exibir 5 cards de KPI: Prospecção, Total de Leads, Reuniões Agendadas, Reuniões Realizadas e Vendas — cada um com valor atual e variação percentual vs período anterior
2. THE CRM SHALL exibir 4 gráficos de linha históricos (últimos 12 meses): Leads/Mês, Prospecção/Mês, Reuniões/Mês, Vendas/Mês — cada um com linha tracejada de meta
3. THE CRM SHALL exibir um funil de vendas visual com barras horizontais por estágio mostrando: nome do estágio, percentual, contagem e valor total (R$)
4. THE CRM SHALL exibir um painel "Reuniões de Hoje" com: realizadas vs meta diária, barra de progresso e contagem restante
5. THE CRM SHALL exibir uma métrica de taxa de conversão: percentual de leads que se tornaram contratos, com diagrama de fluxo visual
6. THE CRM SHALL exibir um feed de atividades recentes em ordem cronológica
7. WHEN não existem dados reais, THE CRM SHALL exibir dados de demonstração com um banner visível "Dados de demonstração" e um toggle para alternar entre visualização demo e real

### Requisito 20: Gestão de Equipe

**User Story:** Como administrador, quero gerenciar a equipe de vendas com papéis e acompanhamento de comissões, para que eu possa organizar a força de trabalho e calcular compensações.

#### Acceptance Criteria

1. THE CRM SHALL suportar operações CRUD para membros da equipe com campos: nome, email, telefone, cargo, percentual de comissão e status ativo
2. THE CRM SHALL vincular membros da equipe à tabela usuarios para autenticação
3. WHEN um membro da equipe é desativado, THE CRM SHALL preservar seus dados históricos mas impedir novo login

### Requisito 21: Integração Google Drive

**User Story:** Como consultor de vendas, quero gerenciar documentos de clientes via Google Drive, para que eu possa organizar contratos, propostas e arquivos de suporte por cliente.

#### Acceptance Criteria

1. THE CRM SHALL autenticar com Google Drive via OAuth 2.0 com escopo drive.file
2. WHEN um usuário acessa a seção de documentos de um Lead, THE CRM SHALL listar arquivos de uma pasta dedicada no Google Drive para aquele Lead
3. THE CRM SHALL suportar upload de documentos para a pasta do Lead no Google Drive de dentro da interface do CRM

### Requisito 22: Notificações

**User Story:** Como consultor de vendas, quero notificações in-app para eventos importantes, para que eu possa responder prontamente a reuniões, mensagens e prazos.

#### Acceptance Criteria

1. THE CRM SHALL armazenar notificações na tabela notificacoes com: tipo (reuniao, lead, parcela, lance, sistema), título, corpo, entidade de referência (JSONB) e status de leitura
2. THE CRM SHALL exibir um ícone de sino no header com badge de contagem de não lidas
3. WHEN o sino é clicado, THE CRM SHALL exibir um dropdown com notificações recentes ordenadas por data de criação
4. WHEN uma notificação é clicada, THE CRM SHALL navegar para a entidade referenciada e marcar a notificação como lida
5. THE CRM SHALL gerar notificações para: reuniões em 60/15/5 minutos, novas mensagens WhatsApp de Leads vinculados, parcelas em atraso e resultados de assembleias

### Requisito 23: Configurações do Sistema

**User Story:** Como administrador, quero um painel centralizado de configurações, para que eu possa configurar parâmetros globais do sistema e credenciais de integração.

#### Acceptance Criteria

1. THE CRM SHALL fornecer uma página de configurações com seções: Dados da Empresa (nome, CNPJ, telefone, email, site, endereço), URL do Servidor WhatsApp, Google Client ID e credenciais da API Credicob
2. THE CRM SHALL persistir configurações na tabela configuracoes como pares chave-valor com valores JSONB
3. THE CRM SHALL suportar preferências por usuário (tema, idioma, fuso horário) armazenadas em configuracoes_usuario
4. WHEN configurações são salvas, THE CRM SHALL validar campos obrigatórios e exibir confirmação de sucesso

### Requisito 24: Logs de Auditoria

**User Story:** Como administrador, quero visualizar logs de auditoria de login, para que eu possa monitorar padrões de acesso e investigar incidentes de segurança.

#### Acceptance Criteria

1. THE CRM SHALL exibir uma tabela paginada de auth_audit_logs com colunas: timestamp, username, IP, localização (cidade/estado/país), dispositivo (SO/navegador), status e detalhe
2. THE CRM SHALL suportar filtragem de logs de auditoria por período, status e username
3. WHILE um usuário com Papel 'vendedor' está autenticado, THE CRM SHALL negar acesso à página de logs de auditoria

### Requisito 25: Marketing e Campanhas

**User Story:** Como gerente de vendas, quero gerenciar campanhas de marketing e rastrear fontes de leads, para que eu possa medir a eficácia dos canais de aquisição.

#### Acceptance Criteria

1. THE CRM SHALL suportar criação de campanhas de marketing com: nome, canal, data de início, data de fim e status
2. THE CRM SHALL rastrear quais Leads originaram de cada campanha via campo de origem do Lead
3. THE CRM SHALL exibir métricas de desempenho da campanha: leads gerados, taxa de conversão e custo por lead (quando orçamento é fornecido)

### Requisito 26: Busca Global

**User Story:** Como consultor de vendas, quero uma barra de busca global, para que eu possa encontrar rapidamente leads, propostas e contratos de qualquer lugar na aplicação.

#### Acceptance Criteria

1. THE CRM SHALL fornecer uma barra de busca no header que pesquisa em: nomes de Leads, telefones, emails e códigos (CLI-XXXX); números de Propostas (PROP-XXXX); e números de Contratos (CTR-XXXX)
2. WHEN o usuário digita na barra de busca, THE CRM SHALL aplicar debounce de 300ms e exibir um dropdown com resultados correspondentes agrupados por tipo de entidade
3. WHEN um resultado de busca é clicado, THE CRM SHALL navegar para a página de detalhe da entidade correspondente
4. WHEN o usuário pressiona Escape, THE CRM SHALL fechar o dropdown de busca
5. THE CRM SHALL limitar os resultados a no máximo 10 itens por tipo de entidade e exibir link "Ver todos" quando houver mais resultados

### Requisito 27: Códigos Sequenciais Auto-Gerados

**User Story:** Como administrador do sistema, quero códigos sequenciais únicos para leads, simulações e contratos, para que as entidades sejam facilmente identificáveis e os códigos nunca sejam reutilizados.

#### Acceptance Criteria

1. WHEN um Lead é criado, THE CRM SHALL atribuir um código único no formato CLI-XXXX onde XXXX é um número sequencial com zero à esquerda que nunca é reutilizado mesmo após exclusão
2. WHEN uma Simulação é criada, THE CRM SHALL atribuir um código único no formato COT-XXXX onde XXXX é um número sequencial com zero à esquerda que nunca é reutilizado mesmo após exclusão
3. WHEN um Contrato é criado, THE CRM SHALL atribuir um código único no formato CTR-XXXX onde XXXX é um número sequencial com zero à esquerda que nunca é reutilizado mesmo após exclusão
4. THE CRM SHALL gerar códigos usando uma sequence do banco de dados PostgreSQL para garantir unicidade em ambiente multi-usuário concorrente

### Requisito 28: Atualizações em Tempo Real e UI Otimista

**User Story:** Como consultor de vendas, quero que a interface atualize em tempo real e responda instantaneamente às minhas ações, para que eu tenha uma experiência fluida e moderna.

#### Acceptance Criteria

1. WHEN um usuário realiza uma mutação (criar, atualizar, excluir), THE CRM SHALL aplicar atualizações otimistas na UI imediatamente e reconciliar com a resposta do servidor
2. IF uma mutação falha no servidor, THEN THE CRM SHALL reverter a atualização otimista e exibir uma notificação toast de erro
3. THE CRM SHALL usar a invalidação de cache do TanStack_Query para manter queries relacionadas atualizadas após mutações
4. WHEN uma mensagem WhatsApp chega via Socket.io, THE CRM SHALL atualizar a interface de chat e contagem de notificações sem necessidade de recarregar a página

### Requisito 29: Design Responsivo e Suporte Mobile

**User Story:** Como consultor de vendas, quero usar o CRM em dispositivos móveis, para que eu possa gerenciar leads e responder mensagens quando estiver fora da mesa.

#### Acceptance Criteria

1. THE CRM SHALL adaptar seu layout para viewports abaixo de 768px de largura convertendo a sidebar em um drawer overlay com toggle hamburger
2. THE CRM SHALL garantir que todos os formulários, tabelas e quadros Kanban sejam utilizáveis em dispositivos touch com alvos de toque apropriados (mínimo 44px)
3. THE CRM SHALL suportar a sidebar em dois estados: expandida (~200px com ícones e labels) e recolhida (~56px apenas ícones), com botão de fixar para persistir a preferência

### Requisito 30: Migração de Dados do localStorage

**User Story:** Como usuário existente, quero que meus dados atuais do localStorage sejam migrados para o banco PostgreSQL, para que eu não perca nenhuma informação existente durante a transição.

#### Acceptance Criteria

1. THE CRM SHALL fornecer um utilitário de migração única que lê todas as chaves do localStorage (crm_leads, crm_funnels, crm_reunioes, crm_metas, crm_cotas, crm_propostas, crm_contratos, crm_wpp_links) e insere os dados nas tabelas PostgreSQL correspondentes
2. THE CRM SHALL mapear IDs de Leads do localStorage para novos IDs do banco de dados preservando todos os relacionamentos (simulações, notas, etiquetas, reuniões, propostas, contratos)
3. WHEN o utilitário de migração é concluído, THE CRM SHALL gerar um relatório mostrando: registros migrados por entidade, registros que falharam e avisos de validação
