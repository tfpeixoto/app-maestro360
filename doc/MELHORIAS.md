# Pontos de Melhoria e Correções — Gênesis

Análise técnica completa do repositório. Os itens estão classificados por severidade.

---

## Bugs e Erros Críticos

### 1. Path divergente no NGINX

**Arquivo:** `.deploy/nginx.conf` vs `.deploy/deploy.sh`

O `nginx.conf` aponta `root /var/www/painelconsorcio`, mas o `deploy.sh` copia os arquivos para `/var/www/maestro360`.

```nginx
# nginx.conf (errado)
root /var/www/painelconsorcio;

# deploy.sh (correto)
rsync ... /var/www/maestro360/
```

**Correção:** Unificar o caminho em ambos os arquivos.

---

### 2. Versão gerada com formato inconsistente

**Arquivo:** `.github/workflows/deploy.yml` vs `scripts/update-version.sh`

O workflow do GitHub Actions gera `v: 'MAJOR.COUNT'` usando fórmula de MAJOR diferente do script local:

```bash
# deploy.yml
MINOR=$(( COUNT % 100 ))
MAJOR=$(( COUNT / 100 + 1 ))
printf "... '%s.%s' ..." "$MAJOR" "$COUNT"   # ex: '1.151'

# update-version.sh
VERSION="1.${COUNT}"                          # ex: '1.151' (sempre MAJOR=1)
```

O campo `MINOR` calculado no workflow nunca é usado. O formato atual resulta em `'1.151'` pelos dois caminhos, mas por razões diferentes. Simplificar para um formato único e documentado.

---

### 3. `storeNextId()` não é seguro com deleções

**Arquivo:** `public/js/funil-data.js:9`

```js
function storeNextId() {
  const l = storeGet();
  return l.length ? Math.max(...l.map(x => x.id)) + 1 : 1;
}
```

`Math.max(...array)` lança `RangeError: Maximum call stack size exceeded` se houver mais de ~10.000 leads. Para o volume esperado é inofensivo, mas a abordagem correta é:

```js
function storeNextId() {
  const l = storeGet();
  if (!l.length) return 1;
  return l.reduce((max, x) => x.id > max ? x.id : max, 0) + 1;
}
```

---

### 4. XSS via innerHTML em `funil-modal.js`

**Arquivo:** `public/js/funil-modal.js:84` e ao longo do arquivo

O conteúdo de `lead.nome`, `lead.obs`, `h.texto` é inserido diretamente via template literals em `innerHTML` sem sanitização. Um lead com nome `<img src=x onerror=alert(1)>` executaria JavaScript.

**Correção:** Sanitizar antes de renderizar:

```js
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Uso:
`<div class="perfil-nome">${escapeHtml(lead.nome)}</div>`
```

Ou usar `textContent` sempre que possível.

---

### 5. Credenciais hardcoded em `login.html`

A autenticação é feita com email e senha fixos no código-fonte JavaScript do frontend — visíveis para qualquer pessoa que abra o DevTools.

**Impacto:** Qualquer usuário pode logar sem conhecer as credenciais (basta inspecionar o código).

**Correção para curto prazo:** Mover para um backend mínimo com hash bcrypt ou usar autenticação por serviço externo (Auth0, Firebase Auth, Supabase).

---

## Problemas de Qualidade

### 6. Módulos JavaScript completamente vazios

Os arquivos abaixo existem mas não têm nenhum conteúdo:

```
public/js/api.js
public/js/crm-store.js
public/js/crm-nav.js
public/js/clientes-lista.js
public/js/clientes-perfil.js
public/js/clientes-form.js
public/js/dashboard-kpi.js
public/js/dashboard-charts.js
public/js/proposta-render.js
public/js/proposta-pdf.js
```

Arquivos CSS também vazios:
```
public/css/clientes.css
public/css/dashboard.css
public/css/proposta.css
```

**Ação recomendada:** Remover do repositório e do `.gitignore` os arquivos que não têm previsão de implementação imediata. Manter apenas quando a implementação começar.

---

### 7. `server/` é estrutura fantasma

O diretório `/server` tem arquivos de rotas Express, middleware de auth e `db.js` — todos vazios. O sistema não tem Node.js nem `package.json`.

**Ação recomendada:** Remover do repositório até que o backend seja de fato iniciado, ou criar um branch separado `feat/backend`.

---

### 8. Nota rápida usa `prompt()` nativo do navegador

**Arquivo:** `public/js/funil-modal.js:141`

```js
function addNotaRapida(id) {
  const texto = prompt('Digite a nota:');
  ...
}
```

`prompt()` bloqueia a thread, tem aparência inconsistente entre navegadores e sistemas operacionais, e pode ser bloqueado em popups ou iframes.

**Correção:** Substituir por um mini-modal inline similar ao modal de lead já existente.

---

### 9. Ausência de validação de telefone e e-mail

**Arquivo:** `public/js/funil-modal.js:39-50`

O formulário aceita qualquer string nos campos `telefone` e `email` sem validação de formato. O `type="email"` no input ajuda, mas pode ser bypassado via JS.

---

### 10. `leadUpdate` em `funil-modal.js:59` tem bug de ID

```js
if (perfilAberto) openPerfil(editandoId || storeGet().slice(-1)[0]?.id);
```

Quando criando um novo lead (não editando), `editandoId` é `null`, então usa `storeGet().slice(-1)[0]?.id` — que é o último item do array, não necessariamente o recém-criado. Funciona na maioria dos casos, mas pode falhar se houver leads deletados.

**Correção:** `leadCreate()` já retorna o objeto criado — usar esse retorno:

```js
const saved = editandoId ? leadUpdate(editandoId, data) : leadCreate(data);
closeModal();
renderFunilPage();
if (perfilAberto) openPerfil(saved.id);
```

---

### 11. `dragleave` dispara em elementos filhos no Kanban

**Arquivo:** `public/js/funil-render.js`

Um problema clássico de drag-and-drop: `dragleave` é disparado ao entrar em um elemento filho da coluna, removendo o visual de destino prematuramente.

**Correção:**

```js
col.addEventListener('dragleave', (e) => {
  if (!col.contains(e.relatedTarget)) {
    col.classList.remove('drag-over');
  }
});
```

---

## Melhorias de UX

### 12. Sem confirmação antes de deletar lead

A deleção de um lead é irreversível (sem soft delete, sem backend). Adicionar uma confirmação:

```js
function confirmarDelete(id) {
  const lead = storeGet().find(l => l.id === id);
  if (confirm(`Remover o lead "${lead?.nome}" permanentemente?`)) {
    leadDelete(id);
    renderFunilPage();
  }
}
```

Melhor ainda: substituir `confirm()` por um modal de confirmação.

---

### 13. Sem feedback visual de salvamento

Quando o usuário salva um lead, o modal fecha sem nenhuma notificação de sucesso. Adicionar um toast/snackbar temporário.

---

### 14. Dados não persistem entre dispositivos/navegadores

Toda a informação está no `localStorage` do navegador atual. Se o usuário trocar de dispositivo ou limpar o cache, perde tudo.

**Solução de curto prazo:** Adicionar botão "Exportar dados (JSON)" e "Importar dados (JSON)".

**Solução definitiva:** Implementar o backend no `/server/`.

---

### 15. Sem paginação no funil com muitos leads

Com 50+ leads por coluna, o Kanban fica lento e ilegível. Implementar paginação ou virtualização de lista.

---

### 16. Histórico do perfil limitado a 10 itens sem paginação

**Arquivo:** `public/js/funil-modal.js:75`

```js
const hist = (lead.historico||[]).slice(0,10)...
```

Itens mais antigos são silenciosamente ignorados. Adicionar botão "Ver mais".

---

## Melhorias de Arquitetura

### 17. Estado global via variável solta (`S` no simulador)

**Arquivo:** `public/js/simulador.js`

O estado do wizard é um objeto global `S`. Funciona, mas torna difícil testar unidades e rastrear mudanças. Considerar encapsular em um módulo com getter/setter.

---

### 18. Todo o CRM em um único arquivo HTML de 204 KB

**Arquivo:** `crm.html`

Todos os módulos (funil, simulador, cotas, etc.) são renderizados via `display: none` dentro de um único HTML gigante. Isso aumenta o tempo de parse inicial e dificulta a manutenção.

**Alternativa:** Carregar módulos dinamicamente via `fetch()` + `innerHTML` ou migrar para um micro-framework (Alpine.js, Lit, Preact) sem adicionar complexidade de build.

---

### 19. Sem separação de responsabilidades no CSS

`crm.css` mistura estilos de layout global, componentes e módulos. Recomendado separar em:
- `base.css` — reset, variáveis CSS, tipografia
- `layout.css` — sidebar, main-content, grid
- `components.css` — botões, modais, badges, cards

---

### 20. Sem proteção de rotas

Todas as páginas (home.html, crm.html, etc.) verificam `crm_auth` localmente. Mas um usuário pode simplesmente apagar o JavaScript de verificação no DevTools e acessar qualquer página.

**Solução:** Sem backend isso não tem correção completa. A abordagem adequada requer autenticação server-side com sessões/tokens HTTP-only.

---

## Roadmap Sugerido

### Fase 1 — Correções imediatas (baixo esforço)

- [ ] Corrigir path do NGINX (`.deploy/nginx.conf`)
- [ ] Corrigir bug de ID no `openPerfil` pós-criação
- [ ] Corrigir `dragleave` no kanban
- [ ] Sanitizar HTML no painel perfil (XSS)
- [ ] Remover arquivos vazios do repositório

### Fase 2 — Funcionalidades pendentes

- [ ] Implementar módulo de Clientes (`clientes-*.js`)
- [ ] Implementar geração de Propostas em PDF (`proposta-pdf.js`)
- [ ] Adicionar charts reais no Dashboard (`dashboard-charts.js`)
- [ ] Substituir `prompt()` por modal de nota
- [ ] Exportar/importar dados como JSON
- [ ] Confirmação antes de deletar lead

### Fase 3 — Infraestrutura

- [ ] Implementar backend Node.js/Express (já estruturado em `/server/`)
- [ ] Banco de dados (PostgreSQL ou MongoDB)
- [ ] Autenticação real (JWT + bcrypt)
- [ ] API REST para leads, clientes, propostas e simulações
- [ ] Multi-usuário com controle de permissões

### Fase 4 — Qualidade

- [ ] Adicionar testes unitários (Vitest) para o simulador
- [ ] Lint (ESLint) + formatação (Prettier)
- [ ] Substituir `localStorage` por IndexedDB para maior capacidade
- [ ] Adicionar PWA manifest + service worker (offline-first)
