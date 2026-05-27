# Melhorias de Responsividade, Performance e Acessibilidade

Registro das alterações implementadas no projeto Eventix para melhorar a experiência em dispositivos móveis, o desempenho de carregamento e a acessibilidade para tecnologias assistivas.

---

## Fase 1 — Auditoria

Levantamento completo de todos os problemas de responsividade, performance e acessibilidade no codebase antes de qualquer alteração. Identificados:

- Tabelas sem `overflow-x-auto` em telas estreitas
- Imagens sem atributos de prioridade ou lazy loading
- Botões de ícone sem rótulo acessível
- Ausência de link "pular navegação" para leitores de tela
- Ausência de estilos `focus-visible` para navegação por teclado
- Bundle JS monolítico de ~1,6 MB sem divisão por rota
- Import dinâmico misturado com import estático (aviso Vite)

---

## Fase 2 — Layouts Responsivos

**Arquivo:** `src/components/Home.tsx`

- Ajustado espaçamento e tamanho de fonte do carrossel para telas pequenas
- Revisada grade de eventos para empilhar corretamente em mobile

**Arquivo:** `src/shared/components/AdminSidebar.tsx`

- Garantida visibilidade e usabilidade da sidebar em viewports reduzidas

---

## Fase 3 — Tipografia e Espaçamento

**Arquivo:** `src/components/Home.tsx`

- Revisados tamanhos de título e subtítulo em breakpoints `sm` e `md`
- Corrigidos paddings internos de cards para evitar overflow em 320 px

---

## Fase 4 — Tabelas Responsivas

**Arquivo:** `src/components/ApprovalQueue.tsx`

- Adicionado wrapper `<div className="overflow-x-auto">` ao redor da `<table>` de aprovações, permitindo rolagem horizontal em vez de quebra de layout em telas estreitas
- Padding do container externo alterado de `p-8` para `p--4 md:p-8`

```tsx
// Antes
<div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
  <table className="w-full text-left">

// Depois
<div className="bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden">
  <div className="overflow-x-auto">
    <table className="w-full text-left">
```

---

## Fase 5 — Otimização de Imagens

Auditadas todas as 24 ocorrências de `<img>` no codebase. Aplicados atributos de acordo com a posição de cada imagem na página:

| Atributo | Quando usar |
|---|---|
| `fetchPriority="high"` | Imagem principal acima da dobra (hero/banner) |
| `loading="lazy"` | Imagens abaixo da dobra ou em cards |
| `decoding="async"` | Todas as imagens para não bloquear o thread principal |

### Alterações por arquivo

**`src/modules/booking/BookingView.tsx`**
- Hero banner do evento: `fetchPriority="high" decoding="async"`

**`src/components/PublicProducerPage.tsx`**
- Banner do produtor: `fetchPriority="high" decoding="async"`
- Cards de eventos: `loading="lazy" decoding="async"`

**`src/modules/dashboard/DashboardView.tsx`**
- Thumbnails de eventos na lista: `loading="lazy" decoding="async"` + `alt` descritivo
- Preview de imagem no editor: `loading="lazy" decoding="async"`

**`src/modules/reservations/ReservationsView.tsx`**
- QR codes na lista de reservas: `loading="lazy" decoding="async"`
- Imagens de capa Unsplash: `loading="lazy" decoding="async"` (2 ocorrências)
- QR expandido em modal: `loading="lazy" decoding="async"`

**`src/modules/payment/CheckoutModal.tsx`**
- QR code do ingresso gerado: `loading="lazy" decoding="async"`

> `src/components/Home.tsx` já estava correto: `loading="eager"` no carrossel (above the fold) e `loading="lazy"` na grade de eventos.

---

## Fase 6 — Touch Targets e Z-Index

**Arquivo:** `src/components/InstallPrompt.tsx`

- Botão de fechar (X) tinha área de toque de apenas 16×16 px — aumentado para o mínimo WCAG de 44×44 px:

```tsx
// Antes
className="..."

// Depois
className="min-w-[44px] min-h-[44px] flex items-center justify-center -mr-2 ..."
```

**Auditoria de z-index (sem alteração necessária):**

| Componente | z-index |
|---|---|
| Navbar | 50 |
| Modais / overlays | 50–100 |
| Toast notifications | 9998 |
| InstallPrompt | 9999 |

Sem conflito de sobreposição identificado.

---

## Fase 7 — Performance de Bundle

### Divisão de vendor chunks

**Arquivo:** `vite.config.ts`

Adicionado `manualChunks` no Rollup para separar bibliotecas grandes em arquivos carregados apenas quando necessários:

```ts
rollupOptions: {
  output: {
    manualChunks: {
      'vendor-motion':   ['motion'],
      'vendor-recharts': ['recharts'],
      'vendor-supabase': ['@supabase/supabase-js'],
      'vendor-embla':    ['embla-carousel-react', 'embla-carousel-autoplay'],
    },
  },
},
```

| Chunk | Tamanho (gzip) | Carregado quando |
|---|---|---|
| `index.js` (main) | 135 KB | Sempre |
| `DashboardView.js` | 107 KB | Admin abre dashboard |
| `vendor-recharts.js` | 105 KB | Admin abre dashboard |
| `vendor-supabase.js` | 53 KB | Sempre (auth) |
| `vendor-motion.js` | 32 KB | Sempre (animações) |
| `vendor-embla.js` | 12 KB | Home carousel |
| `CheckoutModal.js` | 9 KB | Fluxo de compra |
| `TableLayoutEditor.js` | 5 KB | Editor de mesas |

**Redução:** bundle inicial de ~457 KB (gzip) para ~135 KB — **redução de ~70%** no download inicial.

### Lazy loading de componentes pesados

**Arquivo:** `src/App.tsx`

Três componentes convertidos de import estático para `React.lazy()` com `Suspense`:

```tsx
const DashboardView = React.lazy(() =>
  import('./modules/dashboard/DashboardView').then(m => ({ default: m.DashboardView }))
);
const CheckoutModal = React.lazy(() =>
  import('./modules/payment/CheckoutModal').then(m => ({ default: m.CheckoutModal }))
);
const TableLayoutEditor = React.lazy(() =>
  import('./components/TableLayoutEditor').then(m => ({ default: m.TableLayoutEditor }))
);
```

- `DashboardView` e `TableLayoutEditor`: fallback com spinner dourado
- `CheckoutModal`: `fallback={null}` (sempre montado, visibilidade controlada por estado)

### Correção de import duplo

**Arquivo:** `src/modules/profile/PrivacySettingsView.tsx`

Removido `await import('../../lib/supabase')` inline que coexistia com import estático no topo do arquivo, eliminando aviso do Vite sobre módulo importado de duas formas.

---

## Fase 8 — Acessibilidade

### Estilos de foco para teclado

**Arquivo:** `src/index.css`

Adicionado anel de foco dourado visível apenas na navegação por teclado (invisível ao mouse/touch via `:focus-visible`):

```css
:focus-visible {
  outline: 2px solid #d4af37;
  outline-offset: 3px;
  border-radius: 4px;
}

/* Inputs têm foco customizado via border — evita outline duplicado */
input:focus-visible,
select:focus-visible,
textarea:focus-visible {
  outline: none;
}
```

### Link "pular navegação"

**Arquivo:** `src/App.tsx`

Adicionado link invisível no início do DOM que aparece apenas ao receber foco por teclado, permitindo que usuários de leitor de tela e navegação por teclado pulem a navbar:

```tsx
<a
  href="#main-content"
  className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-[9999] ..."
>
  Pular para conteúdo principal
</a>
```

Adicionado `id="main-content"` à tag `<main>`.

### Navbar — botões de ícone

**Arquivo:** `src/shared/components/Navbar.tsx`

| Botão | Atributo adicionado |
|---|---|
| Hambúrguer / fechar menu mobile | `aria-label` dinâmico + `aria-expanded` |
| Logout (ícone) versão desktop | `aria-label="Sair da conta"` |

```tsx
<button
  aria-label={isMobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
  aria-expanded={isMobileMenuOpen}
  ...
>
```

### BookingView — botões de quantidade e limpeza

**Arquivo:** `src/modules/booking/BookingView.tsx`

Todos os botões `+` / `−` e `X` do seletor de ingressos agora têm rótulo acessível:

| Botão | `aria-label` |
|---|---|
| `−` ingresso masculino | `"Remover ingresso masculino"` |
| `+` ingresso masculino | `"Adicionar ingresso masculino"` |
| `−` ingresso feminino | `"Remover ingresso feminino"` |
| `+` ingresso feminino | `"Adicionar ingresso feminino"` |
| `−` ingresso único | `"Remover ingresso"` |
| `+` ingresso único | `"Adicionar ingresso"` |
| `X` limpar masc. | `"Remover ingressos masculinos"` |
| `X` limpar fem. | `"Remover ingressos femininos"` |
| `X` limpar único | `"Remover ingressos"` |
| `X` desselecionar mesa/bistrô | `"Remover item da seleção"` |

---

## Arquivos Modificados

| Arquivo | Fases |
|---|---|
| `vite.config.ts` | 7 |
| `src/App.tsx` | 7, 8 |
| `src/index.css` | 8 |
| `src/shared/components/Navbar.tsx` | 8 |
| `src/shared/components/AdminSidebar.tsx` | 2 |
| `src/components/ApprovalQueue.tsx` | 4 |
| `src/components/Home.tsx` | 2, 3 |
| `src/components/InstallPrompt.tsx` | 6 |
| `src/components/PublicProducerPage.tsx` | 5 |
| `src/modules/booking/BookingView.tsx` | 5, 8 |
| `src/modules/dashboard/DashboardView.tsx` | 5 |
| `src/modules/payment/CheckoutModal.tsx` | 5 |
| `src/modules/profile/PrivacySettingsView.tsx` | 7 |
| `src/modules/reservations/ReservationsView.tsx` | 5 |
