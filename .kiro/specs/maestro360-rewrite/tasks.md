# Implementation Plan: Maestro 360 Rewrite

## Overview

Reescrita completa do CRM Maestro 360 de vanilla HTML/JS para React 19 + Vite + React Router v7 (SPA) com TypeScript, Drizzle ORM no Express backend expandido, autenticação JWT custom, TanStack Query v5, Zustand, Tailwind CSS + shadcn/ui (tema Gênesis), Socket.io direto e Vitest + fast-check. A implementação segue uma abordagem incremental: infraestrutura → componentes compartilhados → autenticação → módulos de negócio → integrações → testes. A landing page permanece como HTML estático separado servido pelo NGINX.

## Tasks

- [ ] 1. Project scaffolding and infrastructure
  - [ ] 1.1 Initialize React 19 + Vite project with TypeScript
    - Create `client/` directory with `npm create vite@latest` (React + TypeScript template)
    - Configure `vite.config.ts`, `tsconfig.json`, `tailwind.config.ts`
    - Install dependencies: @tanstack/react-query, react-router-dom, zustand, zod, react-hook-form, @hookform/resolvers, socket.io-client
    - Install dev dependencies: vitest, @testing-library/react, fast-check, playwright
    - Configure path aliases (`@/`) in tsconfig and vite.config
    - Install server dependencies in `server/`: drizzle-orm, pg, drizzle-kit
    - _Requirements: 1.1, 1.5, 1.6_

  - [ ] 1.2 Set up Drizzle ORM schema in the Express server
    - Run `drizzle-kit introspect` against the existing schema.sql
    - Create `server/db.js` with Drizzle client singleton (pg pool, 5s timeout)
    - Create `server/database/schema.ts` with all tables mapped from schema.sql
    - Define relations in `server/database/relations.ts` (leads → tags, notas, historico, etc.)
    - Create `drizzle.config.ts` in server/ pointing to PostgreSQL connection
    - _Requirements: 1.5, 1.6_

  - [ ] 1.3 Configure Tailwind CSS and shadcn/ui with Gênesis theme
    - Initialize shadcn/ui with `npx shadcn-ui@latest init`
    - Configure `globals.css` with CSS variables matching existing Gênesis identity: `--primary: #0d1f3c`, `--primary-light: #1c3a72`, `--accent: #c8920a`, `--bg: #f7f9fc`, `--border: #e8edf5`, `--muted: #7081a0`
    - Configure Tailwind theme extending shadcn defaults with Gênesis colors, gradients (linear-gradient(145deg, #0d1f3c, #122744, #0a1628)), and dark mode palette
    - Add Orbitron font (Google Fonts) for logo/branding elements, system-ui for body text
    - Install base shadcn components: button, input, dialog, dropdown-menu, toast, card, badge, table, tabs, separator, sheet, command, popover
    - Customize shadcn component variants to match existing visual style (dark headers, gold accents, rounded cards with subtle shadows)
    - _Requirements: 1.7, 29.1_

  - [ ] 1.4 Set up Vitest and testing infrastructure
    - Create `vitest.config.ts` in client/ with path aliases and jsdom environment
    - Create `vitest.setup.ts` with testing-library matchers
    - Install fast-check for property-based testing
    - Create `playwright.config.ts` for E2E tests
    - Add test scripts to client/package.json and server/package.json
    - _Requirements: 1.1_

  - [ ] 1.5 Create TanStack Query provider, Zustand stores, and React Router
    - Create `client/src/App.tsx` with QueryClientProvider (staleTime: 30s, retry: 3) and RouterProvider
    - Create `client/src/router.tsx` with React Router v7 route definitions (protected + public routes)
    - Create `client/src/stores/auth-store.ts` for JWT token and user state (sessionStorage)
    - Create `client/src/stores/sidebar-store.ts` for sidebar state (expanded/collapsed)
    - Create `client/src/stores/ui-store.ts` for modals, toasts, preferences
    - Create `client/src/lib/api.ts` fetch wrapper with JWT Authorization header and error handling
    - _Requirements: 1.2, 1.3, 28.1, 28.3_

- [ ] 2. Checkpoint - Ensure project builds and tests run
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 3. Core shared components and layout
  - [ ] 3.1 Implement authenticated layout shell with sidebar
    - Create `client/src/components/layout/app-shell.tsx` with sidebar + header + main content area
    - Create `client/src/components/layout/sidebar.tsx` with collapsible navigation (7 sections) using Gênesis dark theme (#0d1f3c background, gold accent highlights for active items)
    - Create `client/src/components/layout/header.tsx` with user menu, notifications bell, global search — matching existing header style (dark gradient, gold chips)
    - Create `client/src/components/layout/mobile-nav.tsx` with drawer overlay for < 768px
    - Create `client/src/components/layout/breadcrumb.tsx`
    - Implement React Router Outlet for page content rendering
    - Sidebar: expanded ~200px with icons+labels, collapsed ~56px icons only, pin button
    - Preserve existing visual identity: dark sidebar with gold accent on active items, gradient header, card-based content areas with subtle shadows
    - _Requirements: 1.7, 29.1, 29.3_

  - [ ] 3.2 Implement shared data-table component
    - Create `src/components/shared/data-table.tsx` with pagination (20 items/page), sorting, filtering
    - Create `src/components/shared/empty-state.tsx` for no-data scenarios
    - Create `src/components/shared/kpi-card.tsx` with value, target, progress %, sparkline
    - Create `src/components/shared/search-global.tsx` with debounce 300ms, grouped results dropdown
    - _Requirements: 5.1, 5.8, 26.1, 26.2, 26.5_

  - [ ] 3.3 Implement utility functions
    - Create `src/lib/utils/format.ts` (R$ currency, dates, phone mask, percentage)
    - Create `src/lib/utils/sequential-code.ts` with PostgreSQL sequence-based code generation
    - Create `src/lib/utils/pagination.ts` with offset/limit helpers
    - _Requirements: 27.1, 27.2, 27.3, 27.4_

  - [ ]* 3.4 Write property tests for utility functions
    - **Property 5: Sequential code uniqueness and format**
    - **Property 9: Pagination invariant**
    - **Validates: Requirements 27.1, 27.2, 27.3, 27.4, 5.1**

- [ ] 4. Authentication and RBAC
  - [ ] 4.1 Implement JWT auth in Express backend
    - Expand `server/routes/auth.js` with full login flow (already partially exists)
    - Implement bcrypt password verification + JWT generation (8h expiration)
    - Implement rate limiting (5 attempts / 15 min per email) using in-memory store
    - Implement Google OAuth callback route for token exchange
    - Create `server/middleware/auth.js` with requireAuth middleware (JWT verification)
    - _Requirements: 2.1, 2.2, 2.3, 1.3_

  - [ ] 4.2 Implement geo-blocking service
    - Expand `server/middleware/geoBlock.js` with RMBH bounding box validation
    - Implement GPS coordinate validation (lat/lon within bounds)
    - Implement IP geolocation fallback (5s timeout, city matching)
    - Handle edge cases: GPS denied, IP service unavailable → block
    - _Requirements: 2.4, 2.5, 2.6, 2.7, 2.8_

  - [ ]* 4.3 Write property tests for geo-block and auth
    - **Property 1: Geo-validation correctness**
    - **Property 2: Authentication error message uniformity**
    - **Validates: Requirements 2.4, 2.6, 2.2**

  - [ ] 4.4 Implement audit logging
    - Create audit log insertion in login flow (auth_audit_logs table)
    - Log all fields: username, IP, GPS coords, user_agent, OS, browser, geo info, status
    - Implement fire-and-forget pattern (non-blocking)
    - _Requirements: 2.9_

  - [ ]* 4.5 Write property test for audit log completeness
    - **Property 3: Audit log completeness**
    - **Validates: Requirements 2.9**

  - [ ] 4.6 Implement RBAC middleware
    - Create `server/middleware/rbac.js` with role permissions matrix (admin, gerente, vendedor)
    - Apply RBAC middleware to all protected Express routes
    - Implement ownerOnly filtering for vendedor role (responsavel_id check)
    - Client-side: hide restricted menu items based on role in sidebar component
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [ ]* 4.7 Write property test for RBAC permission enforcement
    - **Property 4: RBAC permission enforcement**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5**

  - [ ] 4.8 Implement session management and inactivity timeout
    - Create `client/src/hooks/use-session-monitor.ts` tracking user activity events
    - Implement 28-min warning modal with 2-min countdown
    - Implement 30-min inactivity logout (clear sessionStorage, redirect to login)
    - JWT expiration check every 60s (decode token client-side, compare exp)
    - Store token in sessionStorage only (no persistence across browser restarts)
    - _Requirements: 2.10, 2.11, 2.12, 2.13, 2.14_

  - [ ] 4.9 Implement login page
    - Create `client/src/pages/login.tsx` with email/password form
    - Replicate existing Gênesis login visual: dark gradient background with dot pattern, centered card with logo (Orbitron font), gold accent on focus states
    - Implement GPS permission request on submit
    - Call POST /api/auth/login with credentials + GPS coords
    - Store JWT in sessionStorage via auth-store on success
    - Show geo-block error messages
    - Show rate-limit countdown when blocked
    - Google OAuth login button
    - _Requirements: 2.1, 2.4, 2.5_

- [ ] 5. Checkpoint - Auth flow works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 6. Lead management
  - [ ] 6.1 Implement Kanban board (Funil de Vendas)
    - Create `client/src/pages/funil.tsx` with funnel selector
    - Create `client/src/components/funil/kanban-board.tsx` with columns ordered by `ordem`
    - Create `client/src/components/funil/kanban-card.tsx` (nome, CLI-XXXX, valor R$, badge)
    - Implement drag-and-drop with optimistic update and rollback on failure
    - Implement stage regression confirmation dialog
    - Log stage transitions in lead_historico
    - Create `server/routes/leads.js` with GET /api/leads (list + filters) and PATCH /api/leads/:id/stage
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

  - [ ]* 6.2 Write property tests for Kanban logic
    - **Property 6: Kanban stage ordering**
    - **Property 7: Stage regression detection**
    - **Validates: Requirements 4.1, 4.5**

  - [ ] 6.3 Implement lead creation and validation
    - Create lead creation form (nome, telefone, email, valor, objetivo, origem, estágio)
    - Implement Zod validation schema in `client/src/lib/validators/lead.ts`
    - Generate CLI-XXXX code via PostgreSQL sequence (server-side)
    - Check phone uniqueness with duplicate warning
    - Create `server/routes/leads.js` POST /api/leads endpoint
    - _Requirements: 4.7, 4.8, 27.1_

  - [ ]* 6.4 Write property test for lead creation validation
    - **Property 8: Lead creation validation**
    - **Validates: Requirements 4.7, 5.6**

  - [ ] 6.5 Implement Kanban KPI metrics and board editing
    - Display KPI cards above Kanban: total leads, contratos, pipeline value, conversion rate
    - Implement "Editar Board" mode: rename, reorder, add, remove stages
    - Handle stage removal with lead reallocation to first stage
    - _Requirements: 4.9, 4.10, 4.11_

  - [ ] 6.6 Implement leads list page
    - Create `src/app/(auth)/leads/page.tsx` with paginated data-table (20/page)
    - Columns: código, nome, estágio badge, reunião badge, tags (3+N), valor, telefone, ações
    - Implement filters: estágio, status reunião, origem, busca livre (debounce 300ms, min 2 chars)
    - Support table and card grid view modes
    - _Requirements: 5.1, 5.2, 5.3, 5.8_

  - [ ] 6.7 Implement lead profile page
    - Create `src/app/(auth)/leads/[id]/page.tsx` with tabbed layout
    - Tabs: Contato (editable), Financeiro, Histórico (timeline + simulações), Patrimônio, CRM (notas, tags, reuniões)
    - Display linked simulations (COT-XXXX) with status badges, ordered by date desc
    - Empty state when no simulations exist
    - _Requirements: 5.4, 5.5_

  - [ ] 6.8 Implement tags and notes for leads
    - Create tag addition with validation: label 1-30 chars, max 10 tags, hex color
    - Create notes with validation: text 1-2000 chars, persist with autor_id
    - Create `src/app/api/leads/[id]/tags/route.ts` and `src/app/api/leads/[id]/notas/route.ts`
    - _Requirements: 5.6, 5.7, 5.9_

  - [ ]* 6.9 Write property test for tag validation
    - **Property 10: Tag validation constraints**
    - **Validates: Requirements 5.6, 5.9**

  - [ ] 6.10 Implement TanStack Query hooks for leads
    - Create `src/hooks/use-leads.ts` with query keys factory pattern
    - Implement useLeads (list with filters), useLead (detail), useCreateLead, useUpdateLead
    - Implement optimistic updates with rollback on mutation failure
    - _Requirements: 1.2, 28.1, 28.2, 28.3_

  - [ ]* 6.11 Write property test for optimistic update rollback
    - **Property 14: Optimistic update rollback on failure**
    - **Validates: Requirements 28.2**

- [ ] 7. Checkpoint - Lead management works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Simulator wizard
  - [ ] 8.1 Implement 6-step wizard structure
    - Create `src/app/(auth)/simulador/page.tsx` with step navigation
    - Create `src/components/simulador/wizard-shell.tsx` with progress indicator
    - Implement step validation: block advance until current step is valid, allow back navigation
    - _Requirements: 6.1_

  - [ ] 8.2 Implement wizard steps 1-3 (Cliente, Objetivo, Capacidade)
    - Step 1: nome, telefone (mask), CPF (optional with algorithm validation), email
    - CPF lookup: search existing leads, auto-fill fields on match
    - Step 2: 4 objective options (Imóvel, Veículo, Ganho Financeiro, Outro)
    - Step 3: crédito desejado (R$ 50k-2M), aporte mensal (> 0), lance disponível (optional)
    - Create Zod schemas for each step in `src/lib/validators/simulacao.ts`
    - _Requirements: 6.2, 6.3, 6.4, 6.5, 6.13_

  - [ ]* 8.3 Write property test for CPF validation
    - **Property 11: CPF validation algorithm**
    - **Validates: Requirements 6.3**

  - [ ] 8.4 Implement wizard steps 4-6 (Portfólio, Parâmetros, Resumo)
    - Step 4: group/cota selection table with +/- controls (0-10 per line), min 1 cota required
    - Dynamic summary: total cotas, crédito total, parcela total
    - Step 5: parcela % (50/70/100), mês contemplação slider, lance embutido slider (0-30%)
    - Step 6: summary with COT-XXXX generation, save to simulacoes table
    - Auto-create lead if not exists, auto-advance stage if applicable
    - _Requirements: 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 6.12_

  - [ ] 8.5 Implement simulações API routes
    - Create `src/app/api/simulacoes/route.ts` (GET list + POST create)
    - Implement COT-XXXX sequential code generation
    - Link simulation to lead, handle lead creation/stage advancement
    - _Requirements: 6.9, 6.10, 6.11, 27.2_

- [ ] 9. Comparative tool and simulation history
  - [ ] 9.1 Implement comparative calculator
    - Create `src/lib/utils/calculations.ts` with consórcio, aluguel, financiamento cost calculations
    - Implement cumulative cost arrays over configurable horizon (1-30 years imóvel, 1-20 veículo)
    - Calculate economia absoluta, percentual, and textual recommendation
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.7_

  - [ ]* 9.2 Write property tests for comparative calculations
    - **Property 12: Comparative calculation monotonicity**
    - **Property 13: Recommendation matches minimum cost**
    - **Validates: Requirements 7.3, 7.4**

  - [ ] 9.3 Implement comparative page UI
    - Create `src/app/(auth)/comparativo/page.tsx` with mode selector (Imóvel/Veículo)
    - Input forms for consórcio, aluguel, financiamento parameters with validation
    - Display results: side-by-side cards, evolution chart, economia metrics
    - Pre-fill from linked simulation when available
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_

  - [ ] 9.4 Implement simulation history page
    - Create `src/app/(auth)/historico/page.tsx` with data-table
    - Columns: data, cliente, grupo(s), crédito total, status, ações
    - KPI cards: total simulações, clientes únicos, crédito total
    - Filters: nome (debounce 300ms), grupo (dropdown), status
    - Empty state and "Ver Perfil" navigation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6_

- [ ] 10. Agenda and meetings
  - [ ] 10.1 Implement agenda page with calendar views
    - Create `src/app/(auth)/agenda/page.tsx` with 4 views: Lista, Semana, Mês, Dia
    - Create meeting creation form: título, tipo, data/hora, lead, local, observações
    - Implement status lifecycle: agendada → realizada | cancelada
    - Display meeting goal progress bars (today, monthly scheduled, monthly realized)
    - _Requirements: 9.1, 9.2, 9.3, 9.6, 9.7_

  - [ ] 10.2 Implement Google Calendar integration
    - Create `src/app/api/google/route.ts` for Calendar sync
    - Create Google Calendar event on meeting creation (with Meet link)
    - Handle sync failure gracefully: save locally, show error message
    - _Requirements: 9.4, 9.5_

  - [ ] 10.3 Implement meeting notifications
    - Create browser notification system for 60/15/5 min reminders
    - Request notification permission on first agenda page load
    - Fallback to in-app notifications when permission denied
    - Create `src/app/api/reunioes/route.ts` (CRUD)
    - _Requirements: 9.8, 9.9_

- [ ] 11. WhatsApp chat integration
  - [ ] 11.1 Implement Socket.io connection and chat store
    - Create `client/src/hooks/use-socket.ts` with Socket.io client connecting directly to Express server
    - Create `client/src/stores/chat-store.ts` for active chat, unread counts
    - Implement auto-reconnection every 15s with visual indicator
    - No proxy needed — browser connects directly to Express Socket.io
    - _Requirements: 11.1, 11.9_

  - [ ] 11.2 Implement chat page UI
    - Create `src/app/(auth)/chat/page.tsx` with chat list + message area + lead panel
    - Chat list: ordered by last message, contact name, preview, time, unread badge
    - Message area: text bubbles, delivery status indicators (✓, ✓✓, ✓✓ blue)
    - Lead side panel: funil, estágio, notas, reuniões
    - _Requirements: 11.7, 11.8, 11.10_

  - [ ] 11.3 Implement message sending and receiving
    - Handle incoming messages via 'wpp:message' event, update UI in real-time
    - Implement text message sending via Evolution API
    - Support media upload (up to 16MB) and PTT audio
    - Persist all messages in wpp_mensagens table
    - Auto-create lead for unknown numbers (funil 'wpp', stage 'wpp_novo')
    - _Requirements: 11.3, 11.4, 11.5, 11.6_

  - [ ] 11.4 Implement WhatsApp instance management and QR code
    - Display QR code when instance disconnected (60s countdown for refresh)
    - Handle connection status events
    - Update wpp_instancias table with connection status
    - _Requirements: 11.2_

- [ ] 12. Checkpoint - Core modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Email integration
  - [ ] 13.1 Implement Gmail integration
    - Create `src/app/(auth)/email/page.tsx` with inbox list (40 threads)
    - Display: remetente, assunto, snippet, data, unread indicator
    - Thread view: all messages chronological, mark as read on open
    - Compose: destinatário (required), assunto (optional), corpo (required)
    - Reply: auto-fill destinatário, "Re:" prefix, link to thread
    - Handle expired/revoked OAuth with reconnection message
    - Search by text and filter by linked Lead
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7_

- [ ] 14. Cotas, Assembleias, and Lances
  - [ ] 14.1 Implement cotas board
    - Create `src/app/(auth)/cotas/page.tsx` with visual grid per group
    - Color-coded by status: disponível (green), reservada (yellow), vendida (blue), contemplada (purple)
    - Click cota → modal with details, action buttons (reservar, vender)
    - Summary per group: total, disponíveis, reservadas, vendidas, contempladas
    - Create `src/app/api/cotas/route.ts` (GET + PATCH)
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ] 14.2 Implement cotas disponíveis (API Credicob)
    - Create `src/app/(auth)/cotas-disponiveis/page.tsx` with card layout
    - Fetch from API Credicob, display: crédito, parcela, categoria, disponibilidade
    - Filters: categoria (Imóvel/Veículo), disponibilidade, busca livre
    - Reserve action via PATCH to Credicob API
    - Cache 5 min via TanStack Query staleTime, invalidate on mutation
    - Handle API unavailability with retry button
    - Create `src/app/api/credicob/route.ts` as proxy
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ] 14.3 Implement assembleias and lances
    - Create `src/app/(auth)/assembleias/page.tsx` with CRUD for assembleia records
    - Fields: grupo, data, horário, local, status, num_sorteados, lance_vencedor
    - Mark as 'realizada' → register contemplados via assembleia_contemplados
    - Create `src/app/(auth)/contemplados/page.tsx` with filters by grupo and período
    - Implement lances: Lead, Assembleia, grupo, percentual, valor_credito, resultado
    - Display lance history per group with winning percentages and trends
    - Create API routes for assembleias and lances
    - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [ ] 15. Proposals and Contracts
  - [ ] 15.1 Implement proposals module
    - Create `src/app/(auth)/propostas/page.tsx` with list, filters by status, search by client
    - Create proposal form: título, descrição, valor, grupo, crédito, embutido %, lances, prazo, taxa
    - Status lifecycle: rascunho → enviada → aceita/rejeitada → assinada → convertida
    - Generate PROP-XXXX sequential code
    - Enable contract conversion when status = 'assinada'
    - Create `src/app/api/propostas/route.ts` (CRUD)
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ] 15.2 Implement contracts module
    - Create `src/app/(auth)/contratos/page.tsx` with list, filters by status and Lead
    - Create contract form: título, número (CTR-XXXX auto), valor, descrição, datas, status
    - Auto-generate parcelas records based on valor and prazo
    - Status lifecycle: ativo, pendente, cancelado, encerrado
    - Create `src/app/api/contratos/route.ts` (CRUD)
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 27.3_

  - [ ] 15.3 Implement parcelas and inadimplência
    - Create `src/app/(auth)/parcelas/page.tsx` with parcelas per contract
    - Columns: vencimento, valor, mês, status, data pagamento
    - Auto-update status to 'atrasado' when past due
    - Inadimplência view: leads with atrasado parcelas, ordered by days overdue
    - Calculate total em atraso per Lead and portfolio
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ] 16. Checkpoint - Business modules complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Dashboard and KPIs
  - [ ] 17.1 Implement dashboard page
    - Create `src/app/(auth)/dashboard/page.tsx` as RSC with initial data fetch
    - 5 KPI cards: Prospecção, Total Leads, Reuniões Agendadas, Reuniões Realizadas, Vendas
    - Each card: valor atual, variação % vs período anterior
    - 4 line charts (12 months): Leads/Mês, Prospecção/Mês, Reuniões/Mês, Vendas/Mês with meta line
    - Sales funnel visualization: horizontal bars per stage (name, %, count, value R$)
    - "Reuniões de Hoje" panel: realizadas vs meta, progress bar
    - Conversion rate metric with flow diagram
    - Activity feed (recent events chronological)
    - Demo data mode with visible banner and toggle
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7_

  - [ ] 17.2 Implement metas (goals) page
    - Create `src/app/(auth)/metas/page.tsx` with 6 KPI metrics per user per month
    - Auto-calculate progress from real DB data on page load
    - KPI cards: value, target, progress %, sparkline (6 months), "faltam X"
    - Monthly snapshot on first access of new month
    - Historical table: last 6 months with all metrics
    - Admin/gerente: edit meta values (integers 1-9999)
    - Vendedor: read-only own KPIs
    - Create `src/app/api/metas/route.ts` (GET + PUT)
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7_

- [ ] 18. Settings, Audit, and Notifications
  - [ ] 18.1 Implement settings page
    - Create `src/app/(auth)/configuracoes/page.tsx` with sections
    - Dados da Empresa: nome, CNPJ, telefone, email, site, endereço
    - Integrations: WhatsApp server URL, Google Client ID, Credicob credentials
    - User preferences: tema, idioma, fuso horário (stored in configuracoes_usuario)
    - Validate required fields, show success confirmation on save
    - Create `src/app/api/configuracoes/route.ts` (GET + PUT)
    - _Requirements: 23.1, 23.2, 23.3, 23.4_

  - [ ] 18.2 Implement audit logs page
    - Create `src/app/(auth)/logs/page.tsx` with paginated data-table
    - Columns: timestamp, username, IP, localização, dispositivo, status, detalhe
    - Filters: período, status, username
    - Restrict access: vendedor → 403
    - Create `src/app/api/audit/route.ts` (GET with filters)
    - _Requirements: 24.1, 24.2, 24.3_

  - [ ] 18.3 Implement notifications system
    - Create `src/app/(auth)/notificacoes/page.tsx` for full notification list
    - Implement notification bell in header with unread count badge
    - Dropdown with recent notifications ordered by date
    - Click notification → navigate to referenced entity, mark as read
    - Generate notifications for: reuniões (60/15/5 min), new WhatsApp messages, parcelas atrasadas, assembleia results
    - Create `src/app/api/notificacoes/route.ts` (GET + PATCH mark-read)
    - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5_

- [ ] 19. Team management and campaigns
  - [ ] 19.1 Implement team management
    - Create `src/app/(auth)/equipe/page.tsx` with CRUD for team members
    - Fields: nome, email, telefone, cargo, comissão %, status ativo
    - Link to usuarios table for authentication
    - Deactivate: preserve historical data, prevent login
    - Create `src/app/api/equipe/route.ts` (CRUD)
    - _Requirements: 20.1, 20.2, 20.3_

  - [ ] 19.2 Implement campaigns module
    - Create `src/app/(auth)/campanhas/page.tsx` with campaign list
    - Create campaign: nome, canal, data início, data fim, status
    - Track leads originated from each campaign via origem field
    - Display metrics: leads gerados, taxa conversão, custo por lead
    - Create `src/app/api/campanhas/route.ts` (CRUD)
    - _Requirements: 25.1, 25.2, 25.3_

- [ ] 20. Global search and responsive design
  - [ ] 20.1 Implement global search
    - Wire `src/components/shared/search-global.tsx` to API
    - Create `src/app/api/busca/route.ts` searching leads (nome, telefone, email, CLI-XXXX), propostas (PROP-XXXX), contratos (CTR-XXXX)
    - Debounce 300ms, min 2 chars, grouped results dropdown
    - Max 10 items per entity type, "Ver todos" link when more exist
    - Close on Escape key
    - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5_

  - [ ]* 20.2 Write property test for global search result cap
    - **Property 15: Global search result cap**
    - **Validates: Requirements 26.5**

  - [ ] 20.3 Implement responsive design polish
    - Ensure sidebar converts to drawer overlay below 768px with hamburger toggle
    - Ensure all forms, tables, Kanban are touch-friendly (min 44px targets)
    - Test and fix layout issues across breakpoints
    - _Requirements: 29.1, 29.2, 29.3_

- [ ] 21. Google Drive integration
  - [ ] 21.1 Implement Google Drive document management
    - Create document section in lead profile
    - Authenticate with Google Drive via OAuth 2.0 (drive.file scope)
    - List files from dedicated Lead folder in Drive
    - Support file upload from CRM interface to Lead's Drive folder
    - _Requirements: 21.1, 21.2, 21.3_

- [ ] 22. Migration utility
  - [ ] 22.1 Implement localStorage migration tool
    - Create migration script reading all localStorage keys (crm_leads, crm_funnels, crm_reunioes, crm_metas, crm_cotas, crm_propostas, crm_contratos, crm_wpp_links)
    - Map localStorage IDs to new PostgreSQL IDs preserving relationships
    - Insert data into corresponding PostgreSQL tables
    - Generate migration report: records migrated per entity, failures, validation warnings
    - _Requirements: 30.1, 30.2, 30.3_

- [ ] 23. Checkpoint - All modules integrated
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 24. End-to-end testing
  - [ ]* 24.1 Write E2E tests with Playwright
    - Flow 1: Login completo (credenciais + geo-block + sessão)
    - Flow 2: Criar lead → mover no Kanban → criar simulação → gerar proposta → converter em contrato
    - Flow 3: Chat WhatsApp: enviar mensagem de texto + receber mensagem
    - Flow 4: Wizard simulador: completar 6 etapas → gerar COT-XXXX
    - Flow 5: Dashboard: verificar KPIs carregam com dados reais
    - _Requirements: 2.1, 4.3, 6.9, 11.6, 19.1_

- [ ] 25. Final checkpoint - Full system verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- The design specifies TypeScript throughout — all code uses TypeScript with strict mode
- Drizzle schema is generated from the existing PostgreSQL schema.sql
- The WhatsApp server (Express + Socket.io) remains as a separate service; Next.js proxies requests
- shadcn/ui components are used as the base UI library (accessible, customizable)
- TanStack Query staleTime is 30s for most queries, 5min for Credicob API cache

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "1.3", "1.4"] },
    { "id": 2, "tasks": ["1.5", "3.3"] },
    { "id": 3, "tasks": ["3.1", "3.2", "3.4"] },
    { "id": 4, "tasks": ["4.1", "4.2"] },
    { "id": 5, "tasks": ["4.3", "4.4", "4.6"] },
    { "id": 6, "tasks": ["4.5", "4.7", "4.8", "4.9"] },
    { "id": 7, "tasks": ["6.1", "6.3", "6.10"] },
    { "id": 8, "tasks": ["6.2", "6.4", "6.5", "6.6"] },
    { "id": 9, "tasks": ["6.7", "6.8", "6.9", "6.11"] },
    { "id": 10, "tasks": ["8.1", "8.2"] },
    { "id": 11, "tasks": ["8.3", "8.4", "8.5"] },
    { "id": 12, "tasks": ["9.1", "9.4", "10.1"] },
    { "id": 13, "tasks": ["9.2", "9.3", "10.2", "10.3"] },
    { "id": 14, "tasks": ["11.1", "13.1"] },
    { "id": 15, "tasks": ["11.2", "11.3", "11.4"] },
    { "id": 16, "tasks": ["14.1", "14.2", "14.3"] },
    { "id": 17, "tasks": ["15.1", "15.2"] },
    { "id": 18, "tasks": ["15.3", "17.1", "17.2"] },
    { "id": 19, "tasks": ["18.1", "18.2", "18.3"] },
    { "id": 20, "tasks": ["19.1", "19.2", "20.1", "20.3"] },
    { "id": 21, "tasks": ["20.2", "21.1", "22.1"] },
    { "id": 22, "tasks": ["24.1"] }
  ]
}
```
