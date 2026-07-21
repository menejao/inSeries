# Design System do inSeries — Fase 5 (INSERIES-PRODUCT-EXPERIENCE-REVOLUTION-01)

Data: 2026-07-21. Este documento cataloga o Design System **como ele existe hoje** — a
auditoria da Fase 1 (`docs/product-audit.md`) já confirmou que a base é mais sólida do que o
ticket presumia: zero cor arbitrária fora dos tokens, tokens já semânticos, tema claro/escuro
já com contraste AA calculado. O trabalho desta fase não é reconstruir do zero — é nomear,
documentar e mapear o que existe contra o vocabulário que o ticket pede, e marcar honestamente
onde falta algo de verdade.

Fontes: `app/globals.css` (tokens + utilitários globais), `tailwind.config.ts` (`theme.extend`),
`components/ui/*` (31 arquivos).

## Cores — tokens semânticos

Todo token é um triplet RGB (`R G B`, sem `rgb()`) em `app/globals.css`, redefinido por tema
(`:root` = escuro, padrão; `:root[data-theme="light"]` = claro), consumido via
`rgb(var(--c-x) / <alpha-value>)` em `tailwind.config.ts` — por isso `bg-primary/60` já
funciona com opacidade em ambos os temas sem duplicar cor nenhuma.

| Token CSS | Classe Tailwind | Papel | Equivalente ao vocabulário do ticket |
| --- | --- | --- | --- |
| `--c-canvas` | `bg-canvas` | Fundo da página | `surface-default` (camada 0) |
| `--c-surface` | `bg-surface` | Fundo de cards/superfícies | `surface-raised` |
| `--c-surface-strong` | `bg-surface-strong` | Superfície elevada/hover | `surface-interactive` |
| `--c-border` / `--c-border-strong` | `border-border` / `border-border-strong` | Bordas padrão/enfatizada | `border-default` / `border-strong` |
| `--c-ink` | `text-ink` | Texto principal | `text-primary` |
| `--c-muted` | `text-muted` | Texto secundário | `text-secondary` |
| `--c-subtle` | `text-subtle` | Texto terciário/legenda | `text-muted` |
| `--c-primary` (+hover/foreground/text) | `bg-primary`, `text-primary-text` | Ação primária, marca | `action-primary` |
| `--c-secondary` (+hover/foreground/text) | `bg-secondary`, `text-secondary-text` | Ação secundária, links | `action-secondary` |
| `--c-success` (+foreground/text) | `bg-success`, `text-success-text` | Estado positivo | `status-success` |
| `--c-warning` (+foreground/text) | `bg-warning`, `text-warning-text` | Estado de atenção | `status-warning` |
| `--c-danger` (+foreground/text) | `bg-danger`, `text-danger-text` | Estado de erro/destrutivo | `status-danger` |
| `--c-ring` | `ring-ring` / `:focus-visible` | Anel de foco | foco |
| `--c-overlay` | usado em `Dialog`/`Sheet` | Fundo de overlay/backdrop | overlay |
| `--c-shadow` + `--shadow-strength` | `shadow-xs/card/raised/glow` | Elevação | elevação |

Não existe um token `status-info` dedicado — `Alert` cobre `info` reaproveitando a paleta
`secondary`. Se uma fase futura precisar de um `status-info` visualmente distinto de
`action-secondary`, é uma decisão de cor nova (precisa aprovação), não uma lacuna de
nomenclatura.

**Contraste**: o comentário em `app/globals.css:74-76` documenta uma decisão real de AA —
`--c-secondary-text` no tema claro é deliberadamente mais escuro que `--c-secondary` (sky-700
em vez de sky-600) para bater 4.5:1 como texto de link sobre fundo quase branco. Esse é o
padrão a seguir: toda cor usada como *texto* tem sua própria variante `-text`, nunca reaproveita
a cor de fundo diretamente.

## Tipografia

**Resolvido** (usuário delegou a escolha): 2 famílias, ambas self-hosted via `next/font/google`
em `app/layout.tsx` (zero requisição externa, sem layout shift):

- **`font-display` → Fraunces** (serif editorial, variável) — títulos e momentos de marca
  (`.section-title`, título do Hero da Landing). Dá o caráter "cinematográfico/editorial" que
  o ticket pede sem depender de imagem — combina com o laranja quente de `--c-primary`.
- **`font-sans` → Inter** (grotesca neutra) — todo o resto: corpo, labels, botões, tabelas,
  stats. UI densa precisa de uma fonte neutra e muito legível em tamanho pequeno; usar a
  mesma serif do display aí destruiria a legibilidade das telas mais carregadas de dado
  (`/me/stats`, `/admin/*`). `Inter` já estava *citada* na stack de sistema
  (`tailwind.config.ts`) mas nunca carregada de verdade — essa decisão ativa uma intenção que
  já existia.

Ambas configuradas em `tailwind.config.ts` (`fontFamily.sans`/`fontFamily.display`) como
variável CSS (`var(--font-sans)`/`var(--font-display)`), com fallback de sistema caso a fonte
não carregue. **Não validado visualmente** — Docker indisponível nesta sessão, só a build
(gera os `.woff2`) foi confirmada.

Utilitários semânticos já existentes para os 3 níveis de texto mais repetidos
(`app/globals.css:182-192`), agora com `.section-title` usando `font-display`:

| Utilitário | Uso | Tamanho |
| --- | --- | --- |
| `.section-title` | Título de página/seção principal | `font-display`, `text-2xl sm:text-3xl`, `font-semibold`, `tracking-tight` |
| `.section-copy` | Parágrafo de apoio abaixo do título | `text-sm sm:text-base`, `text-muted` |
| `.eyebrow` | Rótulo pequeno acima do título ("Ola, Fulano") | `text-xs uppercase tracking-[0.18em]`, `text-subtle` |

Os demais níveis (título de card, corpo, label, metadado, caption, badge) não têm utilitário
dedicado — são compostos ad-hoc com classes Tailwind (`text-sm font-semibold text-ink`, etc.)
espalhadas pelos componentes, de forma consistente na prática mas sem uma fonte única de
verdade. Candidato natural para as próximas 2-3 classes utilitárias (`.card-title`,
`.metadata`, `.caption`) quando a Fase 7 for atacada de verdade.

## Espaçamento, raio, sombra

- **Espaçamento**: escala padrão do Tailwind (sem override) — já é uma escala consistente
  (4px base), nenhum valor arbitrário encontrado na auditoria.
- **Border radius**: padrão do Tailwind + 2 extensões (`tailwind.config.ts:77-80`): `4xl`
  (1.75rem) e `5xl` (2.25rem), usados nos cards maiores/pills grandes.
- **Sombra/elevação** (`tailwind.config.ts:71-76`): 4 níveis semânticos —
  `shadow-xs` (elevação mínima), `shadow-card` (card padrão), `shadow-raised` (hover/dialog),
  `shadow-glow` (destaque de foco/ação primária). Todas derivam de `--c-shadow` +
  `--shadow-strength` (0.55 escuro / 0.1 claro) — a mesma classe produz uma sombra
  proporcionalmente mais forte no tema escuro sem precisar de uma segunda definição.
- **Z-index**: não existe uma escala formal — só 2 valores literais encontrados
  (`.skip-link` em `z-[100]`, Toast em `z-[60]`). Baixo risco de colisão hoje (poucos overlays
  simultâneos), mas sem uma escala documentada isso pode virar um problema real quando
  Drawer/Popover forem implementados (ver lacunas abaixo).

## Motion

6 keyframes/animações nomeadas (`tailwind.config.ts:81-99`): `fade-in`, `fade-in-up`,
`scale-in`, `slide-up`, `shimmer` (skeleton), `kenburns` (zoom lento do backdrop da Landing).
Durações vão de 0.15s (fade-in) a 20s (kenburns, ambiente). `prefers-reduced-motion` é
respeitado globalmente (`app/globals.css:155-164`) — zera duração de toda animação/transição
CSS de uma vez, sem precisar de tratamento por componente.

## Breakpoints

Padrão do Tailwind, sem override (`sm` 640 / `md` 768 / `lg` 1024 / `xl` 1280 / `2xl` 1536).
Na prática, o app usa consistentemente só 2 pontos de decisão de layout: `sm:` (640, onde
cards viram linha) e `lg:` (1024, onde a Sidebar aparece e grids ganham mais colunas) — `md:`
e `xl:`/`2xl:` raramente aparecem. Os 14-16 breakpoints pedidos pelo ticket para validação
visual (320 até ultrawide) mapeiam todos para esses 2 pontos reais de mudança de CSS — já
documentado com essa técnica nas sprints do Dashboard (README, seções
INSERIES-DASHBOARD-HOME-EXPERIENCE-02/03).

## Catálogo de componentes (`components/ui/`, 31 arquivos)

| Componente | API resumida |
| --- | --- |
| `Button` / `IconButton` | `variant`: primary\|secondary\|outline\|ghost\|danger · `size`: xs\|sm\|md\|lg · `IconButton` exige `label` |
| `Badge` | `variant`: default\|primary\|secondary\|success\|warning\|danger\|outline |
| `Card` | `padding`: none\|sm\|md\|lg · `interactive?` · `as?` |
| `Dialog` / `ConfirmDialog` | `{open,onClose,title?,description?,children?,footer?}` · focus trap, Escape/backdrop |
| `Sheet` | `{open,onClose,title?,children?}` · bottom sheet no mobile, modal centralizado no desktop |
| `Dropdown` / `DropdownItem` / `DropdownSeparator` | `{trigger,children,align?}` · item aceita `href` ou `onClick` |
| `Tooltip` | `{content,children,side?}` · CSS-only, `group-hover`+`group-focus-within` |
| `EmptyState` | `{title,copy,icon?,action?}` · 1 tamanho só |
| `Skeleton` (+6 variantes) | `SkeletonText/Avatar/Card/Grid/PosterGrid/CarouselRow/Table` |
| `Toast` | `toast({title,description?,variant})` · variant success\|error\|info · auto-dismiss 4.5s fixo |
| `Progress` | `{value,label?}` · `role="progressbar"` |
| `Avatar` | `{label,name?,src?,size:sm\|md\|lg\|xl}` |
| `Input` / `Select` / `Checkbox` / `Radio` / `Switch` / `Textarea` | Formulário básico, `Checkbox`/`Radio`/`Switch` aceitam `label`+`description` |
| `Table` (+primitivos) | `TableContainer/Table/Head/Body/Row/Th/Td` |
| `Tabs` | `{items:{href,label}[],active,label?}` · navegação por rota, não ARIA tablist |
| `Pagination` | `{page,totalPages,params,basePath}` |
| `Alert` | `variant`: info\|success\|warning\|danger |
| `Spinner` | Uso pontual em ações/áreas pequenas |
| `SearchBar` | Busca do catálogo — não é Command Palette (Fase 4 do ticket é funcionalidade nova) |
| `BarList` / `ColumnChart` / `DonutChart` / `Heatmap` | Primitivos de gráfico sem dependência externa, construídos para `/me/stats` |
| `FixedGrid` | `{mobile?,tablet?,desktop?,wide?,className,children}` · classes fechadas, nunca `auto-fit`/`auto-fill` |
| `icons.tsx` | Conjunto amplo de ícones SVG |

### Lacunas confirmadas (não existem, o ticket pede)

- **Drawer** — não existe como componente nomeado (`Sheet` cobre parcialmente o papel: bottom
  sheet mobile / modal desktop, mas não um painel lateral deslizante).
- **Popover** — não existe.
- **Breadcrumb** — não existe, nenhum uso em nenhuma página (páginas profundas como
  `/series/[id]/season/[season]` não têm trilha de navegação).
- **Command Palette / busca global** — não existe (Fase 4 do ticket).
- **Escala tipográfica formal para todos os níveis** — fonte própria resolvida (Fraunces/Inter,
  ver secção Tipografia acima), mas ainda faltam utilitários dedicados para título de card,
  metadado e caption (hoje compostos ad-hoc por componente).
- **Escala de z-index documentada** — só 2 valores literais isolados, sem sistema.

## O que isso desbloqueia

Com este catálogo, qualquer página redesenhada nas próximas fases (8 em diante) tem uma
referência única do que já existe e pode ser reutilizado sem inventar CSS novo — e uma lista
curta e honesta (Drawer, Popover, Breadcrumb, Command Palette, tipografia) do que precisa ser
construído de verdade antes de qualquer fase que dependa disso.
