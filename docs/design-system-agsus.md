# design.md — Design System AgSUS

Guia oficial de UI/UX dos softwares corporativos da **Agência Brasileira de Apoio à Gestão do SUS (AgSUS)**.

Este documento é a fonte de verdade para criar, modificar, refatorar ou projetar interfaces. Pessoas e IAs devem lê-lo antes de qualquer trabalho de interface.

---

## 0. Como usar este documento

- Leia as seções 0 a 2 inteiras antes de qualquer tarefa. As demais seções são de consulta, conforme o que estiver sendo construído.
- Os valores definidos aqui (cores, tamanhos, espaçamentos, raios, durações) são exatos. Não aproxime nem crie variações "parecidas".
- Componentes usam **tokens semânticos** (`--color-text-secondary`). Nunca use valores literais (`#556070`) nem tokens primitivos diretamente (`--color-neutral-600`) dentro de componentes.
- Os exemplos em ASCII mostram estrutura e hierarquia. Não copie textos, quantidade de elementos ou disposição literal.

### Precedência

1. **Projeto novo:** usar os tokens e padrões deste documento.
2. **Projeto existente com tokens próprios:** usar os tokens do projeto para manter consistência interna. Se divergirem deste documento, não criar um terceiro valor. Registrar a divergência para migração gradual.
3. **Decisão não coberta aqui:** seguir a seção 19.3.

As cores institucionais seguem o manual de marca da AgSUS. Se o manual for atualizado, ele prevalece e este documento deve ser ajustado.

---

## 1. Contexto

**Público:** funcionários e colaboradores da AgSUS que utilizam os sistemas corporativos da organização. É um uso frequente, durante a jornada de trabalho, majoritariamente em desktop e notebook.

**Tipos de aplicação:** sistemas administrativos, de gestão, de avaliação e de acompanhamento; dashboards; ferramentas de análise; formulários; processos internos; aplicações de dados.

Cada software tem nome, domínio e estrutura próprios. Este documento não assume uma estrutura única. Ele define a linguagem visual e os padrões que tornam produtos diferentes reconhecíveis como parte do mesmo ecossistema.

**Idioma das interfaces:** português do Brasil.

**Ambiente:** considerar monitores corporativos de qualidade variável. Diferenças de tom extremamente sutis podem desaparecer; por isso os tokens de superfície e borda já foram calibrados para continuar visíveis.

---

## 2. Princípios

A linguagem visual é **moderna, refinada, profissional, limpa, fluida e funcional**. O resultado deve parecer um produto corporativo contemporâneo, com acabamento comparável aos melhores softwares de gestão e análise atuais. Não deve parecer um sistema administrativo antigo nem um template genérico de dashboard.

### 2.1 Hierarquia e espaço, não caixas

A tela é um fluxo visual contínuo. Tipografia e espaço criam os grupos; molduras são exceção.

> **A interface deve parecer organizada pela hierarquia e pelo espaço, não por uma coleção de caixas.**

### 2.2 Ordem de recursos para separar ou agrupar conteúdo

Use o primeiro recurso da lista que resolver o problema:

1. Espaço negativo
2. Hierarquia tipográfica
3. Agrupamento por proximidade e alinhamento
4. Diferença sutil de superfície
5. Divisor discreto
6. Borda — somente quando nada acima resolve

### 2.3 Restrição cromática

Azul institucional, neutros e cores semânticas pontuais. O azul tem peso visual justamente porque é usado com controle.

### 2.4 Uma coisa principal por tela

Toda tela tem uma informação principal e, no máximo, uma ação principal, identificáveis em poucos segundos.

### 2.5 Redução

Antes de adicionar card, borda, divisor, badge, ícone, label, botão ou seção, pergunte:

> **"Posso remover alguma coisa?"**

Se o elemento não acrescenta função ou hierarquia, ele não entra.

### 2.6 Densidade equilibrada e levemente espaçosa

A interface deve ser produtiva para uso diário sem parecer compactada. Evite os dois extremos: parede de texto e elementos flutuando no vazio.

### 2.7 Precisão nos detalhes

O que faz a interface parecer moderna é o acabamento, não a decoração. Isso significa alinhamento consistente, estados completos (hover, foco, disabled, loading, erro, vazio) e microinterações discretas.

### 2.8 Rápida e acessível por padrão

A conformidade com WCAG 2.2 AA está embutida nos tokens e componentes; não é uma etapa final. A aplicação deve parecer rápida: sem animações longas e sem bloqueios desnecessários.

### Exemplo

Evitar — cada bloco em sua própria caixa:

```text
┌──────────────────────────┐
│ Seção 1                  │
└──────────────────────────┘
┌──────────────────────────┐
│ Seção 2                  │
└──────────────────────────┘
┌──────────────────────────┐
│ Seção 3                  │
└──────────────────────────┘
```

Preferir — composição contínua:

```text
Título da página
Descrição curta do contexto

Conteúdo principal
[ conteúdo ]   [ conteúdo ]   [ conteúdo ]

                  (espaço)

Próxima seção
Conteúdo
```

---

## 3. Cores

Os valores de contraste abaixo foram calculados contra branco (`#FFFFFF`), conforme a fórmula da WCAG. Referências de conformidade:

| Uso | Mínimo exigido |
|---|---|
| Texto normal | 4,5:1 |
| Texto grande (≥ 24px, ou ≥ 18,66px em peso 600) | 3:1 |
| Componentes de interface e elementos gráficos essenciais | 3:1 |

### 3.1 Primitivos — azul institucional

| Token | Hex | Contraste | Uso típico |
|---|---|---|---|
| `blue-50` | `#F2F6FC` | 1,08 | Fundo de item selecionado, botão secundário |
| `blue-100` | `#E3ECF8` | 1,19 | Hover do botão secundário |
| `blue-200` | `#C5D7F0` | 1,46 | Escala sequencial de gráficos |
| `blue-300` | `#97B8E3` | 2,04 | Indicador de item ativo na sidebar |
| `blue-400` | `#5E8FD1` | 3,32 | Série de gráfico |
| `blue-500` | `#2F6DC0` | 5,16 | Escala sequencial de gráficos |
| `blue-600` | `#1F5AA8` | 6,80 | **Cor primária:** botão primário, foco, progresso, aba ativa |
| `blue-700` | `#1A4A8B` | 8,76 | Hover do primário, links, texto sobre `blue-50` |
| `blue-800` | `#153B6F` | 11,13 | Primário pressionado, item ativo na sidebar |
| `blue-900` | `#102D55` | 13,74 | Títulos institucionais, série de gráfico |
| `blue-950` | `#0B1F3D` | 16,44 | Fundo da sidebar |

### 3.2 Primitivos — neutros (cinzas azulados)

| Token | Hex | Contraste | Uso típico |
|---|---|---|---|
| `neutral-0` | `#FFFFFF` | 1,00 | Fundo da área de conteúdo, superfícies elevadas |
| `neutral-50` | `#F5F7FA` | 1,07 | Superfície sutil (agrupamento, cards) |
| `neutral-100` | `#EDF0F4` | 1,14 | Hover, skeleton, trilha de progresso |
| `neutral-200` | `#E0E5EC` | 1,27 | Divisores discretos |
| `neutral-300` | `#CBD2DC` | 1,52 | Divisores de estrutura |
| `neutral-400` | `#858F9F` | 3,27 | Contorno de campos, texto desabilitado |
| `neutral-500` | `#677183` | 4,92 | Placeholder, texto terciário |
| `neutral-600` | `#556070` | 6,38 | Texto secundário |
| `neutral-700` | `#3E4857` | 9,25 | Ícones de ação, texto de botão ghost |
| `neutral-800` | `#29313E` | 13,10 | Uso raro: ênfase intermediária em texto |
| `neutral-900` | `#171C26` | 17,07 | Texto principal |

Não usar preto puro (`#000000`) nem cinzas fora desta escala.

### 3.3 Primitivos — semânticos

| Token | Hex | Contraste | Uso |
|---|---|---|---|
| `success-50` | `#EAF6EF` | — | Fundo de badge e alerta de sucesso |
| `success-600` | `#1E7A45` | 5,35 | Ícones, indicadores e barras de sucesso |
| `success-700` | `#17613A` | 7,48 (6,74 sobre `success-50`) | Texto de sucesso |
| `warning-50` | `#FDF4E3` | — | Fundo de badge e alerta de atenção |
| `warning-600` | `#9A5B00` | 5,43 | Ícones e indicadores de atenção |
| `warning-700` | `#7D4A00` | 7,36 (6,74 sobre `warning-50`) | Texto de atenção |
| `danger-50` | `#FDEEEC` | — | Fundo de badge e alerta de erro |
| `danger-600` | `#C23B30` | 5,30 | Ícones, bordas de erro, botão destrutivo |
| `danger-700` | `#A02E25` | 7,21 (6,39 sobre `danger-50`) | Texto de erro, hover destrutivo |

Informação usa o próprio azul institucional (`blue-50` / `blue-700`). Não existe uma cor "info" separada.

### 3.4 Tokens semânticos

Estes são os únicos tokens de cor que componentes devem usar.

**Fundo**

| Token | Valor | Uso |
|---|---|---|
| `--color-bg-canvas` | `neutral-0` | Fundo padrão da área de conteúdo |
| `--color-bg-subtle` | `neutral-50` | Agrupamento por superfície, cards, painéis |
| `--color-bg-muted` | `neutral-100` | Hover de linhas e itens, skeleton, trilhas |
| `--color-bg-selected` | `blue-50` | Linha ou item selecionado |
| `--color-bg-raised` | `neutral-0` + sombra | Menus, popovers, modais, toasts |
| `--color-bg-inverse` | `neutral-900` | Tooltips |
| `--color-bg-overlay` | `rgb(11 31 61 / 0.40)` | Camada atrás de modais e drawers |

**Texto**

| Token | Valor | Uso |
|---|---|---|
| `--color-text-primary` | `neutral-900` | Texto principal, títulos |
| `--color-text-secondary` | `neutral-600` | Descrições, textos auxiliares, metadados, cabeçalhos de tabela |
| `--color-text-tertiary` | `neutral-500` | Placeholder, valores vazios — somente sobre `canvas` ou `subtle` |
| `--color-text-disabled` | `neutral-400` | Texto desabilitado |
| `--color-text-inverse` | `neutral-0` | Texto sobre fundos escuros ou primários |
| `--color-text-brand` | `blue-900` | Títulos institucionais (login, página inicial). Uso raro |
| `--color-text-link` | `blue-700` | Links. Hover: `blue-800` com sublinhado |

**Borda**

| Token | Valor | Uso |
|---|---|---|
| `--color-border-subtle` | `neutral-200` | Divisores de linhas de tabela e listas; contorno de card quando necessário |
| `--color-border-default` | `neutral-300` | Divisor sob cabeçalho de tabela, divisor do header global, divisor de seção |
| `--color-border-input` | `neutral-400` | Contorno de campos de formulário (atende 3:1) |
| `--color-border-focus` | `blue-600` | Campo em foco |
| `--color-border-danger` | `danger-600` | Campo com erro |

A borda de campos é mais forte que as demais de propósito. Quando é ela que identifica a área interativa, a WCAG (critério 1.4.11) exige contraste de 3:1. Bordas e divisores decorativos não têm essa exigência e devem permanecer discretos.

**Ação**

| Token | Valor |
|---|---|
| `--color-action-primary` | `blue-600` (hover `blue-700`, pressionado `blue-800`) |
| `--color-action-secondary` | `blue-50` (hover `blue-100`), texto `blue-700` |
| `--color-action-ghost-hover` | `neutral-100`, texto `neutral-700` |
| `--color-action-danger` | `danger-600` (hover `danger-700`) |
| `--color-focus-ring` | `blue-600` |

**Status** — usados em badges, alertas e indicadores

| Status | Fundo | Texto | Sólido (ícone, ponto, barra) |
|---|---|---|---|
| `success` | `success-50` | `success-700` | `success-600` |
| `warning` | `warning-50` | `warning-700` | `warning-600` |
| `danger` | `danger-50` | `danger-700` | `danger-600` |
| `info` | `blue-50` | `blue-700` | `blue-600` |
| `neutral` | `neutral-100` | `neutral-700` | `neutral-500` |

**Sidebar**

| Token | Valor | Contraste sobre `blue-950` |
|---|---|---|
| `--color-sidebar-bg` | `blue-950` | — |
| `--color-sidebar-text` | `#C3D0E4` | 10,54 |
| `--color-sidebar-text-muted` | `#8FA2BF` | 6,33 (títulos de grupo) |
| `--color-sidebar-item-hover` | `rgb(255 255 255 / 0.06)` | — |
| `--color-sidebar-item-active` | `blue-800` | — |
| `--color-sidebar-item-active-text` | `neutral-0` | 11,13 sobre `blue-800` |
| `--color-sidebar-indicator` | `blue-300` | 8,05 |
| `--color-sidebar-divider` | `rgb(255 255 255 / 0.08)` | — |
| `--color-sidebar-focus` | `neutral-0` | 16,44 |

**Gráficos** — ver seção 13

| Token | Valor | Contraste |
|---|---|---|
| `--color-chart-1` | `blue-600` | 6,80 |
| `--color-chart-2` | `blue-400` | 3,32 |
| `--color-chart-3` | `blue-900` | 13,74 |
| `--color-chart-4` | `#1B7F84` (azul-petróleo) | 4,76 |
| `--color-chart-5` | `neutral-400` | 3,27 |
| `--color-chart-context` | `neutral-400` | 3,27 |
| `--color-chart-grid` | `neutral-200` | — |
| `--color-chart-axis` | `neutral-300` | — |
| `--color-chart-positive` | `success-600` | 5,35 |
| `--color-chart-negative` | `danger-600` | 5,30 |

### 3.5 Regras de uso da cor

- **Azul institucional:** botão primário, links, foco, item ativo, aba ativa, seleção, barras de progresso, sidebar e séries de gráfico.
- **Onde não usar azul:** fundos de seção, ícones decorativos, todos os títulos indiscriminadamente, bordas de cards.
- **Cores semânticas:** somente quando existe significado. Aparecem como detalhe (badge, ícone, texto, indicador, borda de erro) e nunca como fundo dominante de seção ou tela. A única exceção é o fundo `-50` em alertas inline e badges.
- **Nunca apenas cor:** todo estado comunicado por cor também tem texto, ícone ou forma.
- **Texto sobre fundos coloridos:** usar somente os pares definidos nas tabelas acima.
- **Proibido:** gradientes, glassmorphism, texto com opacidade reduzida (use tokens de texto) e cores fora das escalas.

### 3.6 Modo escuro

Fora do escopo desta versão. Não implementar modo escuro de forma isolada em um produto. O uso exclusivo de tokens semânticos garante que um tema escuro futuro seja apenas uma troca de valores.

---

## 4. Tipografia

### 4.1 Família

| Papel | Família | Pilha completa |
|---|---|---|
| Interface | **Geist** | `"Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif` |
| Código e identificadores técnicos | **Geist Mono** | `"Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` |

Geist Mono serve apenas para código, chaves técnicas e identificadores que precisam ser copiados caractere a caractere. Não use para labels, números de indicadores ou dados comuns.

**Pesos permitidos:** 400 (regular), 500 (medium) e 600 (semibold). Não usar 300 ou inferiores, nem 700 ou superiores.

### 4.2 Escala

| Token | Tamanho / altura de linha | Peso | Tracking | Uso |
|---|---|---|---|---|
| `display` | 36 / 44px | 600 | -0,02em | Telas institucionais (login, página inicial). Raro |
| `h1` | 28 / 36px | 600 | -0,015em | Título da página. Um por página |
| `h2` | 22 / 30px | 600 | -0,01em | Seções da página |
| `h3` | 18 / 26px | 600 | -0,005em | Subseções, título de modal e drawer |
| `h4` | 16 / 24px | 600 | 0 | Grupos de formulário, título de card, título de gráfico |
| `body` | 14 / 22px | 400 | 0 | Texto padrão, células de tabela, campos |
| `body-sm` | 13 / 20px | 400 | 0 | Descrições, textos de ajuda, metadados |
| `caption` | 12 / 16px | 400 ou 500 | 0,01em | Cabeçalho de tabela (500), eixos de gráfico, datas auxiliares |
| `label` | 13 / 20px | 500 | 0 | Rótulos de campos e de indicadores |
| `button` | 14 / 20px | 500 | 0 | Texto de botões |
| `metric` | 28 / 36px | 600 | -0,02em | Valor principal de indicadores |
| `metric-sm` | 20 / 28px | 600 | -0,01em | Indicadores secundários ou compactos |
| `code` | 13 / 20px (Geist Mono) | 400 | 0 | Código e identificadores |

### 4.3 Regras

- **A tipografia faz a hierarquia.** Diferenças de tamanho, peso e cor de texto vêm antes de caixas, cores ou bordas.
- **Tamanho mínimo:** 12px, apenas para `caption`. Conteúdo principal nunca abaixo de 14px. Não reduza texto para caber mais informação; reorganize.
- **Números:** usar algarismos tabulares (`font-variant-numeric: tabular-nums`) em tabelas, indicadores, valores monetários, datas e qualquer coluna numérica.
- **Linha de leitura:** parágrafos com no máximo 72 caracteres por linha (cerca de 720px em `body`).
- **Caixa:** usar sentence case em títulos, labels, botões, abas e cabeçalhos de tabela ("Nova avaliação", e não "Nova Avaliação"). Não usar CAIXA ALTA em labels, títulos de grupo ou botões.
- **Cor dos títulos:** títulos usam `text-primary`. O azul (`text-brand`) fica reservado a contextos institucionais.
- **Semântica:** a ordem dos níveis HTML (`h1` → `h2` → `h3`) deve ser respeitada. Não pule níveis para obter um tamanho visual.

### 4.4 Padrão de hierarquia

```text
Título                          ← h1 / h2, text-primary
Descrição ou contexto           ← body-sm, text-secondary, 4px abaixo

Conteúdo principal              ← body, text-primary, 24px abaixo

Informação secundária           ← body-sm ou caption, text-secondary
```

---

## 5. Espaçamento e layout

### 5.1 Escala de espaçamento

Base de 4px. Os nomes coincidem com a escala padrão do Tailwind.

| Token | Valor | Token | Valor |
|---|---|---|---|
| `space-0.5` | 2px | `space-6` | 24px |
| `space-1` | 4px | `space-8` | 32px |
| `space-1.5` | 6px | `space-10` | 40px |
| `space-2` | 8px | `space-12` | 48px |
| `space-3` | 12px | `space-16` | 64px |
| `space-4` | 16px | `space-20` | 80px |
| `space-5` | 20px | | |

Não usar valores fora da escala.

### 5.2 Espaçamento semântico

| Relação | Valor |
|---|---|
| Ícone ↔ texto (componentes `md`) | 8px |
| Ícone ↔ texto (componentes `sm`) | 6px |
| Label ↔ campo | 6px |
| Campo ↔ texto de ajuda ou erro | 6px |
| Título ↔ descrição | 4px |
| Entre campos (vertical) | 20px |
| Entre campos lado a lado | 16px |
| Entre filtros | 12px |
| Cabeçalho de seção ↔ conteúdo | 16px |
| Entre grupos relacionados | 32px |
| Entre seções da página | 48px |
| Page header ↔ conteúdo | 32px |
| Padding interno de card | 20px (compacto 16px, amplo 24px) |
| Gap de grade de cards | 16px (24px a partir de `xl`) |

Quanto mais relacionados dois elementos, mais próximos. O espaço entre grupos deve ser visivelmente maior que o espaço dentro dos grupos.

### 5.3 Estrutura e larguras

| Elemento | Valor |
|---|---|
| Sidebar expandida | 256px |
| Sidebar recolhida | 64px |
| Header global | 56px de altura |
| Padding horizontal da página | 32px (desktop), 24px (tablet), 16px (mobile) |
| Padding superior da página | 32px (desktop), 24px (tablet e mobile) |
| Largura máxima do conteúdo de dados | 1440px |
| Largura máxima de formulários | 640px |
| Largura máxima de texto corrido | 720px |
| Grade | 12 colunas; gutter de 24px (desktop) e 16px (mobile) |

Conteúdo alinhado à esquerda. Não centralizar páginas de dados em telas largas com margens enormes: o conteúdo ocupa a área disponível até 1440px, alinhado à esquerda da área de conteúdo.

### 5.4 Breakpoints

| Token | Largura mínima | Contexto |
|---|---|---|
| `sm` | 640px | Celular grande |
| `md` | 768px | Tablet |
| `lg` | 1024px | Notebook pequeno, tablet horizontal |
| `xl` | 1280px | Notebook e desktop |
| `2xl` | 1536px | Desktop amplo |

Os valores coincidem com os padrões do Tailwind. O comportamento em cada faixa está na seção 16.

---

## 6. Forma: raio, bordas e sombras

### 6.1 Border radius

O raio varia conforme a hierarquia do elemento; não é um único valor aplicado a tudo.

| Token | Valor | Uso |
|---|---|---|
| `radius-sm` | 4px | Badges, checkbox, chips, tooltips, skeleton |
| `radius-md` | 6px | Botões, campos, selects, itens de menu, item da sidebar |
| `radius-lg` | 8px | Cards, menus, popovers, alertas, toasts |
| `radius-xl` | 12px | Modais, drawers |
| `radius-full` | 9999px | Somente avatar, ponto de status, switch e barra de progresso |

Evitar o estilo "tudo é pílula". Botões, badges e campos não são arredondados por completo.

### 6.2 Bordas e divisores

- A borda é o último recurso (seção 2.2).
- Não aplicar bordas automaticamente em seções, grupos, containers, cards, tabelas ou áreas de dashboard.
- **Espessura:** sempre 1px. A única exceção são indicadores de estado (aba ativa e item ativo da sidebar), que usam 2 a 3px.
- **Divisores:** linhas horizontais `border-subtle` ou `border-default`. Não empilhe divisor e espaçamento grande no mesmo ponto; escolha um dos dois.
- **Campos de formulário:** são a exceção, pois precisam de contorno visível (`border-input`) para comunicar a área interativa.

### 6.3 Sombras e elevação

A profundidade vem, nesta ordem, de: espaçamento, contraste de superfície, tipografia, divisores e, por último, sombra.

| Token | Valor | Uso |
|---|---|---|
| `shadow-none` | — | Padrão. Cards não têm sombra |
| `shadow-sm` | `0 1px 2px rgb(23 28 38 / 0.06)` | Segmento ativo de controle segmentado; header sticky quando há rolagem |
| `shadow-md` | `0 1px 3px rgb(23 28 38 / 0.06), 0 4px 16px rgb(23 28 38 / 0.08)` | Menus, popovers, selects abertos, toasts |
| `shadow-lg` | `0 2px 6px rgb(23 28 38 / 0.06), 0 16px 40px rgb(23 28 38 / 0.14)` | Modais, drawers |

Sombra indica elemento flutuando sobre a página (camada temporária). Não use sombra para decorar elementos estáticos.

---

## 7. Movimento e camadas

### 7.1 Movimento

| Token | Valor | Uso |
|---|---|---|
| `duration-fast` | 120ms | Hover, mudança de cor, opacidade |
| `duration-base` | 180ms | Dropdowns, tooltips, expandir e recolher |
| `duration-slow` | 240ms | Drawers, modais, recolhimento da sidebar |
| `ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Entradas e mudanças de estado |
| `ease-exit` | `cubic-bezier(0.4, 0, 1, 1)` | Saídas |

- Animar apenas para mostrar o que mudou: abertura, fechamento, transição de estado e feedback.
- Não usar animações de entrada em seções, efeitos em cascata nem movimento decorativo.
- Animar somente `opacity` e `transform`. Não animar largura, altura ou posição de layout, exceto no recolhimento da sidebar.
- Respeitar `prefers-reduced-motion`: nesse caso, remover deslocamentos e manter apenas mudanças instantâneas ou de opacidade.

### 7.2 Camadas (z-index)

| Token | Valor |
|---|---|
| `z-base` | 0 |
| `z-sticky` | 100 (cabeçalho de tabela, barras fixas) |
| `z-header` | 200 |
| `z-sidebar` | 300 (inclui drawer de navegação) |
| `z-dropdown` | 400 (menus, popovers, selects) |
| `z-overlay` | 500 |
| `z-modal` | 510 (modais e drawers) |
| `z-toast` | 600 |
| `z-tooltip` | 700 |

Não usar valores de z-index fora desta tabela.

---

## 8. Tokens em código

Estes tokens são a referência de implementação. Se o projeto usar Tailwind, exponha-os no tema do Tailwind (substituindo a paleta padrão) e use as classes geradas a partir deles.

- Não usar classes da paleta padrão, como `bg-blue-500` ou `text-gray-600`.
- Não usar valores arbitrários, como `p-[13px]` ou `text-[#333]`.

```css
:root {
  /* ---------- Primitivos: azul institucional ---------- */
  --color-blue-50:  #F2F6FC;
  --color-blue-100: #E3ECF8;
  --color-blue-200: #C5D7F0;
  --color-blue-300: #97B8E3;
  --color-blue-400: #5E8FD1;
  --color-blue-500: #2F6DC0;
  --color-blue-600: #1F5AA8;
  --color-blue-700: #1A4A8B;
  --color-blue-800: #153B6F;
  --color-blue-900: #102D55;
  --color-blue-950: #0B1F3D;

  /* ---------- Primitivos: neutros ---------- */
  --color-neutral-0:   #FFFFFF;
  --color-neutral-50:  #F5F7FA;
  --color-neutral-100: #EDF0F4;
  --color-neutral-200: #E0E5EC;
  --color-neutral-300: #CBD2DC;
  --color-neutral-400: #858F9F;
  --color-neutral-500: #677183;
  --color-neutral-600: #556070;
  --color-neutral-700: #3E4857;
  --color-neutral-800: #29313E;
  --color-neutral-900: #171C26;

  /* ---------- Primitivos: semânticos ---------- */
  --color-success-50:  #EAF6EF;
  --color-success-600: #1E7A45;
  --color-success-700: #17613A;
  --color-warning-50:  #FDF4E3;
  --color-warning-600: #9A5B00;
  --color-warning-700: #7D4A00;
  --color-danger-50:   #FDEEEC;
  --color-danger-600:  #C23B30;
  --color-danger-700:  #A02E25;

  /* ---------- Fundo ---------- */
  --color-bg-canvas:   var(--color-neutral-0);
  --color-bg-subtle:   var(--color-neutral-50);
  --color-bg-muted:    var(--color-neutral-100);
  --color-bg-selected: var(--color-blue-50);
  --color-bg-raised:   var(--color-neutral-0);
  --color-bg-inverse:  var(--color-neutral-900);
  --color-bg-overlay:  rgb(11 31 61 / 0.40);

  /* ---------- Texto ---------- */
  --color-text-primary:    var(--color-neutral-900);
  --color-text-secondary:  var(--color-neutral-600);
  --color-text-tertiary:   var(--color-neutral-500);
  --color-text-disabled:   var(--color-neutral-400);
  --color-text-inverse:    var(--color-neutral-0);
  --color-text-brand:      var(--color-blue-900);
  --color-text-link:       var(--color-blue-700);
  --color-text-link-hover: var(--color-blue-800);

  /* ---------- Borda ---------- */
  --color-border-subtle:  var(--color-neutral-200);
  --color-border-default: var(--color-neutral-300);
  --color-border-input:   var(--color-neutral-400);
  --color-border-focus:   var(--color-blue-600);
  --color-border-danger:  var(--color-danger-600);

  /* ---------- Ação ---------- */
  --color-action-primary:         var(--color-blue-600);
  --color-action-primary-hover:   var(--color-blue-700);
  --color-action-primary-pressed: var(--color-blue-800);
  --color-action-secondary:       var(--color-blue-50);
  --color-action-secondary-hover: var(--color-blue-100);
  --color-action-secondary-text:  var(--color-blue-700);
  --color-action-ghost-hover:     var(--color-neutral-100);
  --color-action-ghost-text:      var(--color-neutral-700);
  --color-action-danger:          var(--color-danger-600);
  --color-action-danger-hover:    var(--color-danger-700);
  --color-focus-ring:             var(--color-blue-600);

  /* ---------- Status ---------- */
  --color-status-success-bg:    var(--color-success-50);
  --color-status-success-text:  var(--color-success-700);
  --color-status-success-solid: var(--color-success-600);
  --color-status-warning-bg:    var(--color-warning-50);
  --color-status-warning-text:  var(--color-warning-700);
  --color-status-warning-solid: var(--color-warning-600);
  --color-status-danger-bg:     var(--color-danger-50);
  --color-status-danger-text:   var(--color-danger-700);
  --color-status-danger-solid:  var(--color-danger-600);
  --color-status-info-bg:       var(--color-blue-50);
  --color-status-info-text:     var(--color-blue-700);
  --color-status-info-solid:    var(--color-blue-600);
  --color-status-neutral-bg:    var(--color-neutral-100);
  --color-status-neutral-text:  var(--color-neutral-700);
  --color-status-neutral-solid: var(--color-neutral-500);

  /* ---------- Sidebar ---------- */
  --color-sidebar-bg:               var(--color-blue-950);
  --color-sidebar-text:             #C3D0E4;
  --color-sidebar-text-muted:       #8FA2BF;
  --color-sidebar-item-hover:       rgb(255 255 255 / 0.06);
  --color-sidebar-item-active:      var(--color-blue-800);
  --color-sidebar-item-active-text: var(--color-neutral-0);
  --color-sidebar-indicator:        var(--color-blue-300);
  --color-sidebar-divider:          rgb(255 255 255 / 0.08);
  --color-sidebar-focus:            var(--color-neutral-0);

  /* ---------- Gráficos ---------- */
  --color-chart-1:        var(--color-blue-600);
  --color-chart-2:        var(--color-blue-400);
  --color-chart-3:        var(--color-blue-900);
  --color-chart-4:        #1B7F84;
  --color-chart-5:        var(--color-neutral-400);
  --color-chart-context:  var(--color-neutral-400);
  --color-chart-grid:     var(--color-neutral-200);
  --color-chart-axis:     var(--color-neutral-300);
  --color-chart-positive: var(--color-success-600);
  --color-chart-negative: var(--color-danger-600);

  /* ---------- Tipografia ---------- */
  --font-sans: "Geist", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --font-mono: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;

  --font-weight-regular:  400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;

  --text-display: 2.25rem;   --leading-display: 2.75rem;  --tracking-display: -0.02em;
  --text-h1:      1.75rem;   --leading-h1:      2.25rem;  --tracking-h1:      -0.015em;
  --text-h2:      1.375rem;  --leading-h2:      1.875rem; --tracking-h2:      -0.01em;
  --text-h3:      1.125rem;  --leading-h3:      1.625rem; --tracking-h3:      -0.005em;
  --text-h4:      1rem;      --leading-h4:      1.5rem;
  --text-body:    0.875rem;  --leading-body:    1.375rem;
  --text-body-sm: 0.8125rem; --leading-body-sm: 1.25rem;
  --text-caption: 0.75rem;   --leading-caption: 1rem;     --tracking-caption: 0.01em;
  --text-label:   0.8125rem; --leading-label:   1.25rem;
  --text-button:  0.875rem;  --leading-button:  1.25rem;
  --text-metric:  1.75rem;   --leading-metric:  2.25rem;  --tracking-metric:  -0.02em;
  --text-metric-sm: 1.25rem; --leading-metric-sm: 1.75rem;

  /* ---------- Espaçamento ---------- */
  --space-0-5: 0.125rem;  /* 2px  */
  --space-1:   0.25rem;   /* 4px  */
  --space-1-5: 0.375rem;  /* 6px  */
  --space-2:   0.5rem;    /* 8px  */
  --space-3:   0.75rem;   /* 12px */
  --space-4:   1rem;      /* 16px */
  --space-5:   1.25rem;   /* 20px */
  --space-6:   1.5rem;    /* 24px */
  --space-8:   2rem;      /* 32px */
  --space-10:  2.5rem;    /* 40px */
  --space-12:  3rem;      /* 48px */
  --space-16:  4rem;      /* 64px */
  --space-20:  5rem;      /* 80px */

  /* ---------- Layout ---------- */
  --sidebar-width:           16rem;  /* 256px  */
  --sidebar-width-collapsed: 4rem;   /* 64px   */
  --header-height:           3.5rem; /* 56px   */
  --content-max-width:       90rem;  /* 1440px */
  --form-max-width:          40rem;  /* 640px  */
  --prose-max-width:         45rem;  /* 720px  */

  /* ---------- Raio ---------- */
  --radius-sm:   0.25rem;  /* 4px  */
  --radius-md:   0.375rem; /* 6px  */
  --radius-lg:   0.5rem;   /* 8px  */
  --radius-xl:   0.75rem;  /* 12px */
  --radius-full: 9999px;

  /* ---------- Sombras ---------- */
  --shadow-sm: 0 1px 2px rgb(23 28 38 / 0.06);
  --shadow-md: 0 1px 3px rgb(23 28 38 / 0.06), 0 4px 16px rgb(23 28 38 / 0.08);
  --shadow-lg: 0 2px 6px rgb(23 28 38 / 0.06), 0 16px 40px rgb(23 28 38 / 0.14);

  /* ---------- Movimento ---------- */
  --duration-fast: 120ms;
  --duration-base: 180ms;
  --duration-slow: 240ms;
  --ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --ease-exit:     cubic-bezier(0.4, 0, 1, 1);

  /* ---------- Camadas ---------- */
  --z-sticky:   100;
  --z-header:   200;
  --z-sidebar:  300;
  --z-dropdown: 400;
  --z-overlay:  500;
  --z-modal:    510;
  --z-toast:    600;
  --z-tooltip:  700;
}

/* Breakpoints (media queries não aceitam var()):
   sm 640px, md 768px, lg 1024px, xl 1280px, 2xl 1536px */

html {
  font-family: var(--font-sans);
  font-size: 100%;
  color: var(--color-text-primary);
  background: var(--color-bg-canvas);
  -webkit-font-smoothing: antialiased;
  scroll-padding-top: calc(var(--header-height) + var(--space-4));
}

:focus-visible {
  outline: 2px solid var(--color-focus-ring);
  outline-offset: 2px;
}

table, .numeric {
  font-variant-numeric: tabular-nums;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

---

## 9. Composição de tela

### 9.1 Separação visual

Quando dois elementos precisam ser separados, considere nesta ordem:

1. **Espaçamento.** Mais espaço entre grupos do que dentro deles (seção 5.2).
2. **Hierarquia.** Título, descrição e conteúdo agrupam naturalmente.
3. **Superfície.** Uma área em `bg-subtle` sobre `bg-canvas` separa sem moldura.
4. **Divisor.** Uma linha `border-subtle` quando o espaço sozinho não basta, como entre linhas de tabela ou entre seções longas.
5. **Borda.** Somente quando nenhum dos recursos anteriores funciona.

### 9.2 Espaço negativo

- O espaço vazio é recurso de design, não desperdício. Não preencha áreas vazias com elementos, gráficos extras ou cards decorativos.
- Uma tela com pouco conteúdo pode ter bastante espaço livre.
- O espaço deve ter intenção: separar grupos, destacar a informação principal e dar ritmo de leitura.

### 9.3 Seções

- Não dividir a tela artificialmente em várias áreas emolduradas.
- Uma seção existe quando há um assunto distinto, com título próprio (`h2`).
- Pequenos grupos de informação não são seções: use um título `h4` ou apenas espaçamento.
- Entre seções, use 48px de espaço. Acrescente um divisor `border-subtle` somente em páginas longas, em que o espaço sozinho não marca a transição.

### 9.4 Cards

Cards são permitidos quando têm função clara:

- representar uma entidade (um projeto, uma unidade, uma avaliação) em uma grade de itens equivalentes;
- agrupar uma unidade de informação independente e reutilizável;
- destacar uma ação ou um atalho;
- isolar conteúdo que realmente precisa de separação.

Não usar card:

- porque "todo dashboard tem cards";
- para envolver uma seção inteira, uma tabela, um gráfico isolado ou um grupo de filtros;
- dentro de outro card.

Se o conteúdo fica claro sem o card, não use card. A especificação visual está na seção 11.6.

### 9.5 Densidade

| Contexto | Densidade |
|---|---|
| Padrão (formulários, detalhes, dashboards) | Tokens desta seção, linhas de tabela de 44px |
| Tabelas analíticas com muitas linhas | Linhas de 36px (modo compacto), mesma tipografia |
| Telas institucionais (login, página inicial) | Mais espaço, uso de `display` |

Nunca compacte reduzindo o tamanho da fonte. Compacte reduzindo altura de linha e padding, sempre dentro da escala.

### 9.6 Padrões de página

Os padrões abaixo mostram estrutura e hierarquia. Adapte ao conteúdo real de cada produto.

**Painel (dashboard)**

```text
Visão geral                                       [Período ▾]  [Exportar]
Acompanhamento do ciclo atual

Concluídas          Em andamento        Prazo médio         Pendências
1.248               312                 18 dias             27
+8,2% vs. ciclo     20% do total        −2 dias vs. ciclo   Requer atenção
anterior

                               (48px)

Evolução mensal                         Distribuição por região
Quantidade concluída por mês            Total por região, ordenado
[ gráfico de linha ]                    [ barras horizontais ]

                               (48px)

Atualizações recentes                                         Ver todas
Nome                   Unidade            Status           Atualizado em
────────────────────────────────────────────────────────────────────────
...
```

Os indicadores não ficam em cards: formam uma faixa contínua, separada por espaço. Os gráficos ficam diretamente na página, sem moldura.

**Listagem**

```text
Unidades                                                [+ Nova unidade]
Gerencie as unidades vinculadas ao programa.

[Pesquisar unidades       ]  Status ▾  Região ▾  Limpar filtros   342 resultados

Nome ↓                   Região       Responsável        Status
────────────────────────────────────────────────────────────────────────
Unidade Centro           Norte        Maria Souza        ● Ativa         ⋯
Unidade Litoral          Sul          João Lima          ● Inativa       ⋯

1–20 de 342                                  20 por página ▾   ‹  1 2 3 … ›
```

**Formulário**

```text
← Unidades
Nova unidade
Preencha os dados para cadastrar a unidade.

Identificação
Nome da unidade
[                                        ]
Código CNES
[                ]

Localização
UF               Município
[        ▾]      [                      ▾]

[Criar unidade]  [Cancelar]
```

Os grupos são marcados por títulos `h4` e 32px de espaço, sem caixas ao redor.

**Detalhe**

```text
← Unidades
Unidade Centro                                        [Editar]  [⋯]
● Ativa     Atualizada em 24/09/2026 às 14:30

Dados gerais
Responsável         Maria Souza
Região              Norte
Código CNES         1234567

────────────────────────────────────────────────────────────────────────

Histórico
...
```

Dados somente leitura são exibidos como texto em uma lista de propriedades (seção 11.5), e não como campos desabilitados.

---

## 10. Estrutura da aplicação

### 10.1 Sidebar

Quando a aplicação tem navegação lateral:

- **Fundo e largura:** `sidebar-bg` (azul escuro institucional), 256px expandida e 64px recolhida.
- **Topo:** nome ou marca do sistema, em 56px de altura, alinhado com o header.
- **Grupos:** título do grupo em `caption` 500, cor `sidebar-text-muted`, sentence case, 24px acima e 4px abaixo. Não usar caixa alta.
- **Itens:**

  | Propriedade | Valor |
  |---|---|
  | Altura | 36px |
  | Padding horizontal | 12px |
  | Raio | `radius-md` |
  | Margem lateral | 8px |
  | Ícone | 20px |
  | Texto | `body` 400, cor `sidebar-text` |
  | Gap entre ícone e texto | 12px |

- **Hover:** fundo `sidebar-item-hover`.
- **Ativo:** três sinais combinados, para não depender só de cor:
  - fundo `sidebar-item-active`;
  - texto `sidebar-item-active-text` em peso 500;
  - barra de 3px em `sidebar-indicator` na borda esquerda do item.
- **Foco:** contorno de 2px em `sidebar-focus`.
- **Recolhida:** apenas ícones, com tooltip à direita. O botão de recolher/expandir usa `PanelLeftClose` e `PanelLeftOpen`.
- **Níveis:** no máximo 2. O segundo nível é indentado 32px, sem ícone, e expande sob o item pai (`ChevronDown`).
- **Base:** ajuda, configurações e perfil podem ficar fixos na base, separados por `sidebar-divider`.
- **Sem excesso:** nada de badges coloridos em todos os itens, ilustrações, gradientes ou múltiplas cores de ícone. Contadores só quando exigem ação do usuário.

### 10.2 Header global

- **Aparência:** 56px, fundo `bg-canvas`, divisor inferior `border-default`, sem sombra (`shadow-sm` apenas quando o conteúdo rola por baixo).
- **Esquerda:** botão de menu (mobile e tablet) e contexto atual, como o nome da área ou do sistema quando não há sidebar.
- **Direita, nesta ordem:** status global (quando existir), ações globais, notificações (`Bell`, com contador quando houver itens não lidos) e menu do perfil (avatar 32px).
- **Não é navegação:** não colocar links de navegação principal no header nem repetir a sidebar ali.

### 10.3 Page header

Estrutura:

```text
[Breadcrumb — opcional]
Título da página                                   [Secundária] [Principal]
Descrição curta do contexto (1–2 linhas)
```

- **Título:** `h1`. É o único `h1` da página.
- **Descrição:** `body-sm` em `text-secondary`, 4px abaixo do título, no máximo 2 linhas. Omita quando o título for autoexplicativo.
- **Ações:** alinhadas à direita, na altura do título. No máximo 1 ação principal e 2 secundárias; as demais vão para o menu "Mais ações" (`Ellipsis`).
- **Status da entidade** (em páginas de detalhe): badge e metadados em uma linha abaixo do título.
- **Distância até o conteúdo:** 32px.

### 10.4 Breadcrumb

- Usar somente a partir do segundo nível de profundidade.
- Texto `body-sm` em `text-secondary`. A página atual fica em `text-primary` e não é link.
- Separador: `ChevronRight` de 14px em `neutral-400`.
- Em páginas de detalhe ou formulário com um só nível acima, basta um link de retorno ("← Unidades", com `ArrowLeft`).

### 10.5 Abas

- **Uso:** alternar entre visões do mesmo contexto, como dados, histórico e documentos.
- **Estilo:** sublinhado, sem caixas. O container tem divisor inferior `border-subtle`.

  | Propriedade | Valor |
  |---|---|
  | Altura da aba | 40px |
  | Gap entre abas | 24px |
  | Texto | `body` 500, `text-secondary` |
  | Aba ativa | `text-primary` + barra inferior de 2px em `action-primary` |
  | Hover | `text-primary` |

- **Quantidade:** no máximo 6 abas. Em telas estreitas, as abas rolam horizontalmente.
- **Controle segmentado:** para alternar a representação do mesmo dado (por exemplo, "Tabela | Gráfico"), com no máximo 4 opções. Trilho em `bg-muted` com `radius-md` e padding de 2px; segmento ativo em `bg-canvas` com `shadow-sm`.

### 10.6 Navegação

- **Previsibilidade:** a mesma ação fica no mesmo lugar em todas as telas do produto.
- **Estado ativo:** o item de navegação da página atual está sempre identificado, também quando a página é filha do item.
- **Preservação de estado:** filtros, ordenação, página e aba ativa sobrevivem ao "voltar" (preferencialmente refletidos na URL).
- **Tarefas críticas:** a navegação não deve depender de hover.

---

## 11. Componentes

Todo componente interativo deve ter definidos os estados: padrão, hover, pressionado, foco visível, desabilitado e, quando aplicável, carregando, erro e selecionado.

### 11.1 Botões

**Variantes**

| Variante | Fundo | Texto | Hover | Uso |
|---|---|---|---|---|
| Primary | `action-primary` | `text-inverse` | `action-primary-hover` | Ação principal. No máximo 1 por área da tela |
| Secondary | `action-secondary` | `action-secondary-text` | `action-secondary-hover` | Ação importante, mas não principal |
| Ghost | transparente | `action-ghost-text` | fundo `action-ghost-hover` | Menor prioridade: cancelar, ações em linhas de tabela, ações de card |
| Link | transparente | `text-link` | sublinhado, `text-link-hover` | Navegação no meio de texto |
| Destructive | `action-danger` | `text-inverse` | `action-danger-hover` | Confirmação final de exclusão ou ação irreversível |
| Destructive ghost | transparente | `danger-600` | fundo `danger-50` | Iniciar uma exclusão em menus e rodapés |

Botões não têm borda. A diferença entre variantes vem do fundo e da cor do texto. O secundário é tonal (azul muito claro), e não contornado.

**Tamanhos**

| Tamanho | Altura | Padding horizontal | Texto | Ícone | Gap |
|---|---|---|---|---|---|
| `sm` | 32px | 12px | 13px, peso 500 | 16px | 6px |
| `md` (padrão) | 36px | 16px | `button` | 16px | 8px |
| `lg` | 40px | 20px | `button` | 16px | 8px |

- **Raio:** `radius-md`.
- **Botão só com ícone:** quadrado, com a mesma altura do tamanho escolhido. Exige `aria-label` e tooltip.

**Estados**

- **Pressionado:** `action-primary-pressed` no primário. Nas demais variantes, um tom acima do hover.
- **Foco:** anel global de foco (seção 8).
- **Desabilitado:** fundo `bg-muted`, texto `text-disabled`, sem hover, `cursor: not-allowed`. Prefira não desabilitar o botão de envio de formulários: permita o clique e mostre os erros. Quando desabilitar, explique o motivo próximo ao botão.
- **Carregando:** `LoaderCircle` girando no lugar do ícone (ou antes do texto), com o texto no gerúndio ("Salvando…"). A largura do botão não muda, `aria-busy="true"` é aplicado e novos cliques são bloqueados.

**Posicionamento**

| Contexto | Alinhamento | Ordem |
|---|---|---|
| Page header | Direita | Secundárias → principal (principal por último) |
| Fim de formulário em página | Esquerda | Principal → cancelar |
| Rodapé de modal ou drawer | Direita | Cancelar → principal (principal por último) |
| Linha de tabela | Direita | Ações em `Ellipsis` ou botões ghost de ícone |

- **Mais ações:** com três ou mais ações secundárias, agrupe-as no menu "Mais ações" (`Ellipsis`).
- **Ação destrutiva:** fica separada das demais, no fim do menu e após um divisor.
- **Texto do botão:** verbo no infinitivo que diz exatamente o que acontece ("Salvar alterações", "Criar avaliação", "Exportar planilha"). Evite "OK", "Enviar" genérico, "Sim" e "Não".

### 11.2 Campos e formulários

**Campo de texto**

| Propriedade | Valor |
|---|---|
| Altura | 36px (`sm` 32px, `lg` 40px) |
| Padding horizontal | 12px |
| Raio | `radius-md` |
| Fundo | `bg-canvas` |
| Borda | 1px `border-input` |
| Texto | `body`, `text-primary` |
| Placeholder | `text-tertiary`. É exemplo de formato, nunca substitui o label |
| Ícone interno | 16px em `neutral-500`, 12px da borda (ex.: `Search`, `Calendar`) |

**Estados**

| Estado | Tratamento |
|---|---|
| Hover | Borda `neutral-500` |
| Foco | Borda `border-focus` + halo `0 0 0 3px rgb(31 90 168 / 0.20)`. A borda azul atende 3:1 sozinha |
| Erro | Borda `border-danger`; mensagem abaixo com `CircleAlert` 14px e texto `body-sm` em `danger-700`; `aria-invalid="true"` e `aria-describedby` apontando para a mensagem |
| Desabilitado | Fundo `bg-subtle`, borda `border-subtle`, texto `text-disabled` |
| Somente leitura | Não usar campo. Exibir o valor como texto em uma lista de propriedades |

Não usar sombras internas nem externas em campos. O visual dos campos é idêntico em todas as telas do produto.

**Label e textos de apoio**

- **Label:** sempre visível, acima do campo, em `label` e `text-primary`, 6px acima. Não usar label flutuante nem placeholder como label.
- **Texto de ajuda:** `body-sm` em `text-secondary`, 6px abaixo do campo. Quando há erro, a mensagem de erro substitui o texto de ajuda.
- **Campos opcionais:** marcados com "(opcional)" após o label, em `text-secondary` e peso 400. Campos obrigatórios não recebem marca visual, mas têm `aria-required="true"` ou `required`.
- **Largura:** proporcional ao conteúdo esperado. CEP e datas são curtos; nome e endereço são longos. Não esticar todos os campos a 100% em telas largas.

**Outros controles**

| Controle | Especificação |
|---|---|
| Select | Mesmo visual do campo de texto, com `ChevronDown` 16px à direita. Acima de 10 opções, permitir busca (combobox) |
| Checkbox | 16px, `radius-sm`, borda `border-input`. Marcado: fundo `action-primary` e `Check` branco |
| Radio | 16px circular. Selecionado: anel `action-primary` com ponto interno |
| Switch | 36 × 20px, `radius-full`. Somente para configurações que aplicam imediatamente. Em formulários com botão de envio, usar checkbox |
| Textarea | Mínimo de 3 linhas, redimensionável apenas na vertical |
| Data | Campo com `Calendar`, formato dd/mm/aaaa, aceitando digitação direta além do seletor |
| Máscaras | CPF `000.000.000-00`, CNPJ `00.000.000/0000-00`, CEP `00000-000`, telefone `(00) 00000-0000`. Aplicadas durante a digitação; colar com ou sem pontuação deve funcionar |

A área clicável de checkbox e radio inclui o texto do label.

**Composição do formulário**

- **Colunas:** preferir uma coluna, com largura máxima `form-max-width` (640px). Duas colunas apenas para campos curtos e relacionados, como UF e município ou data de início e fim.
- **Grupos:** título `h4` com descrição opcional, 32px entre grupos e 20px entre campos. Usar `<fieldset>` e `<legend>` por semântica, sem borda visual.
- **Formulários longos** (mais de ~12 campos ou etapas distintas):
  - dividir em seções com títulos, ou em etapas com indicador de progresso;
  - a barra de ações pode ficar fixa no rodapé da área de conteúdo, com fundo `bg-canvas` e divisor superior `border-subtle`.
- **Validação:**
  - ao sair do campo, depois que ele foi preenchido, e ao enviar;
  - não validar enquanto a pessoa ainda digita pela primeira vez;
  - ao enviar com erros, mostrar um alerta no topo que lista os erros com links para cada campo e mover o foco para esse alerta.
- **Alterações não salvas:** pedir confirmação antes de sair da página.
- **Sucesso:** toast de confirmação e retorno à listagem ou atualização da tela. Não usar modal de sucesso.
- **Entrada redundante:** não pedir de novo, no mesmo fluxo, informação que o usuário já forneceu (WCAG 3.3.7). Preencher automaticamente ou permitir selecionar.

### 11.3 Filtros e busca

Filtros fazem parte da página, e não de um card independente. Ficam em uma linha contínua, diretamente acima do conteúdo que filtram, sem container, fundo ou borda:

```text
[Pesquisar...            ]  Status ▾  Região ▾  Período ▾  Limpar filtros    342 resultados
```

- **Ordem:** busca primeiro (largura de 280 a 320px), depois os selects (largura automática, mínimo de 160px).
- **Espaçamento:** 12px entre filtros e 16px até o conteúdo filtrado.
- **"Limpar filtros":** botão ghost, exibido somente quando há filtro ativo.
- **Contagem de resultados:** em `body-sm` e `text-secondary`, alinhada à direita da linha de filtros.
- **Aplicação:** selects aplicam imediatamente. A busca aplica com atraso de 300ms após a digitação. Um botão "Aplicar" só é usado no painel de filtros avançados.
- **Mais de 4 filtros:** mostrar os 3 ou 4 principais e um botão "Mais filtros" (`ListFilter`) que abre um drawer. Filtros ativos que não estão visíveis aparecem como chips removíveis (`radius-sm`, `bg-muted`, `X` 14px).
- **Mobile:** busca visível e botão "Filtros (n)" que abre um drawer com os filtros empilhados.

### 11.4 Tabelas

Tabelas são leves: sem grade, sem bordas por célula, sem container com borda e sem zebra.

| Elemento | Especificação |
|---|---|
| Container | Nenhum. A tabela fica direto na página. O texto da primeira coluna alinha com o título da página (compensar o padding da célula com margem negativa) |
| Cabeçalho | Altura de 40px, sem fundo; texto `caption` 500 em `text-secondary`, sentence case; divisor inferior `border-default` |
| Linha | Altura de 44px (compacta: 36px); padding horizontal de 12px; texto `body`; divisor inferior `border-subtle` (exceto na última linha) |
| Linha com duas linhas de texto | 56px. Linha secundária em `body-sm` e `text-secondary` |
| Hover | Fundo `bg-muted` |
| Selecionada | Fundo `bg-selected` |
| Coluna principal | Nome da entidade em peso 500, como link para o detalhe |
| Valor vazio | "—" em `text-tertiary`. Nunca "null", "N/A" ou célula em branco |
| Linha de totais | Peso 600, divisor superior `border-default` |

**Alinhamento**

- Texto e datas à esquerda.
- Números, valores monetários e percentuais à direita, com algarismos tabulares.
- Coluna de ações à direita.
- O cabeçalho segue o alinhamento da coluna.

**Comportamento**

- **Truncamento:** textos longos são truncados com reticências, e o texto completo aparece em tooltip ou `title`. Números nunca são truncados. Colunas de descrição podem quebrar em até 2 linhas.
- **Ordenação:** o cabeçalho é um botão. A coluna ordenada mostra `ArrowUp` ou `ArrowDown` (14px); colunas ordenáveis mostram `ArrowUpDown` em `neutral-400` no hover e no foco. Usar `aria-sort`.
- **Ações por linha:**
  - botão de ícone `Ellipsis` sempre visível (nunca apenas no hover), com `aria-label="Ações para <nome do item>"`;
  - até 2 ações frequentes podem aparecer como botões ghost de ícone.
- **Linha clicável:** o link fica no nome da entidade. O hover da linha inteira indica a área, mas a linha não é o único alvo clicável.
- **Seleção em massa:**
  - coluna de checkbox com 40px;
  - com um ou mais itens selecionados, a linha de filtros é substituída por uma barra com "3 selecionados", as ações em lote (secondary e ghost) e "Limpar seleção".
- **Rolagem:**
  - cabeçalho fixo (sticky) quando a tabela é mais alta que a tela;
  - em telas estreitas, rolagem horizontal dentro do próprio container, com a primeira coluna fixa.
- **Paginação:**
  - abaixo da tabela, a 16px;
  - à esquerda, "1–20 de 342";
  - à direita, o seletor "20 por página" (opções 20, 50 e 100), botões anterior e próxima (`ChevronLeft` e `ChevronRight`) e até 7 números de página com reticências.

### 11.5 Listas e lista de propriedades

**Lista**

Usada para itens heterogêneos ou com pouco dado tabular, como notificações, atividades e documentos.

| Propriedade | Valor |
|---|---|
| Padding vertical do item | 12px |
| Divisor | `border-subtle` entre itens, sem divisor após o último |
| Elemento inicial | Ícone de 20px ou avatar de 32px, opcional |
| Título | `body` 500 |
| Descrição | `body-sm`, `text-secondary` |
| Metadado | `caption`, `text-secondary`, alinhado à direita |
| Ações | Botões ghost de ícone à direita |

- **Grupos:** título `h4` ou `label` em `text-secondary`, 8px acima dos itens e 24px entre grupos.
- **Sem card por item:** não transformar cada item em um card.

**Lista de propriedades (chave–valor)**

Usada em páginas de detalhe e em qualquer dado somente leitura.

```text
Responsável         Maria Souza
Região              Norte
Código CNES         1234567
```

- **Chave:** `body-sm` em `text-secondary`, em coluna de 160 a 200px.
- **Valor:** `body` em `text-primary`.
- **Espaçamento:** 12px entre pares, sem bordas.
- **Mobile:** a chave fica acima do valor.
- **Semântica:** marcação `<dl>`, `<dt>` e `<dd>`.

### 11.6 Cards

Usar somente nos casos da seção 9.4.

| Propriedade | Valor |
|---|---|
| Fundo | `bg-subtle` sobre `bg-canvas`. Se a área ao redor já for `bg-subtle`, usar `bg-canvas` com borda `border-subtle` |
| Borda | Nenhuma (exceto no caso acima) |
| Sombra | Nenhuma |
| Raio | `radius-lg` |
| Padding | 20px (compacto 16px, amplo 24px) |
| Título | `h4` |
| Descrição | `body-sm`, `text-secondary`, 4px abaixo do título |
| Ações | Botões ghost ou link, no rodapé do card |

- **Card clicável:**
  - hover com fundo `bg-muted` e cursor pointer;
  - foco visível em volta do card inteiro;
  - o card inteiro é um único link, sem elementos interativos aninhados.
- **Grade:** `repeat(auto-fill, minmax(280px, 1fr))`, com gap de 16px (24px a partir de `xl`).

### 11.7 Indicadores

A informação principal chama atenção pela tipografia, não pela cor nem por uma caixa.

```text
Avaliações concluídas        ← label, text-secondary
1.248                        ← metric, text-primary, tabular
+8,2% vs. ciclo anterior     ← body-sm, contexto
```

- **Agrupamento:** indicadores formam uma faixa contínua, em grade de 4 colunas (`xl`), 2 colunas (`md`) e 1 coluna (mobile), com 32px entre colunas.
  - Opcionalmente, divisor vertical `border-subtle` entre indicadores, com 24px de padding à esquerda.
  - Sem card, sem borda e sem fundo colorido.
- **Unidade:** junto ao número, em `body-sm` e `text-secondary` ("18 dias", com "dias" menor).
- **Variação:**
  - ícone `TrendingUp` ou `TrendingDown` (14px) mais o texto;
  - a cor segue o significado, não a direção: um aumento de pendências é ruim (`danger`) e um aumento de conclusões é bom (`success`);
  - sem julgamento de valor, a variação fica em `text-secondary`.
- **Quantidade:** de 3 a 6 indicadores por faixa. Mais do que isso dilui a atenção.
- **Indicador clicável:** o bloco inteiro é um link, com hover em `bg-muted`, `radius-lg` e padding de 12px.

### 11.8 Badges e status

| Propriedade | Valor |
|---|---|
| Altura | 20px |
| Padding horizontal | 8px (6px com ponto) |
| Raio | `radius-sm` |
| Texto | `caption` 500 |
| Cores | Fundo e texto do status correspondente (seção 3.4) |
| Ponto opcional | 6px, `radius-full`, cor sólida do status |

- **Conteúdo:** texto curto (1 ou 2 palavras), sempre presente. A cor nunca aparece sozinha.
- **Interação:** o badge não é clicável. Para filtrar, use um chip.
- **Quantidade:** no máximo um badge de status por item.

**Mapeamento de status**, que deve ser o mesmo em todos os produtos:

| Status | Exemplos |
|---|---|
| `success` | Concluído, Aprovado, Ativo, Disponível, Publicado |
| `info` | Em andamento, Em análise, Agendado |
| `warning` | Pendente, Prazo próximo, Incompleto, Aguardando |
| `danger` | Atrasado, Reprovado, Erro, Falha, Bloqueado |
| `neutral` | Rascunho, Inativo, Cancelado, Arquivado |

### 11.9 Barras de progresso

| Propriedade | Valor |
|---|---|
| Altura | 6px (8px quando é o elemento principal da área) |
| Raio | `radius-full` |
| Trilha | `bg-muted` |
| Preenchimento | `action-primary`; `success-600` quando concluído ou quando o significado for positivo |
| Rótulo | Texto à esquerda e percentual à direita, acima da barra, em `body-sm` com algarismos tabulares |

- **Estilo:** sem gradientes, listras, brilho ou animação contínua.
- **Acessibilidade:** usar `role="progressbar"` com `aria-valuenow`, `aria-valuemin`, `aria-valuemax` e `aria-label`.
- **Etapas:** processos em etapas usam um indicador de etapas (texto "Etapa 2 de 4" mais os títulos das etapas), não uma barra.

### 11.10 Menus, popovers e tooltips

**Menu e dropdown**

| Propriedade | Valor |
|---|---|
| Superfície | `bg-raised`, `shadow-md`, `radius-lg` |
| Padding | 4px |
| Largura mínima | 180px |
| Item | 32px de altura, padding horizontal de 8px, `radius-md`, texto `body`, ícone de 16px opcional |
| Hover e foco do item | Fundo `bg-muted` |
| Itens destrutivos | No fim, após um divisor `border-subtle`, com texto `danger-600` |
| Teclado | Setas navegam, Enter seleciona, Esc fecha e devolve o foco ao botão de origem |

**Popover:** mesma superfície do menu, com padding de 16px. Usado para conteúdo interativo curto.

**Tooltip**

| Propriedade | Valor |
|---|---|
| Fundo | `bg-inverse` |
| Texto | `text-inverse`, `caption` |
| Raio | `radius-sm` |
| Padding | 6px × 8px |
| Largura máxima | 240px |
| Atraso | 400ms |

- **Gatilho:** aparece no hover e no foco.
- **Conteúdo:** apenas informação complementar. Nunca coloque informação essencial só em tooltip, porque não há hover em telas de toque.

### 11.11 Modais e drawers

**Quando usar**

| Situação | Solução |
|---|---|
| Confirmação ou ação curta (até 3–4 campos) que exige foco temporário | Modal |
| Ver ou editar detalhes sem perder o contexto da lista | Drawer lateral |
| Tarefa longa, com várias seções, que precisa de URL própria ou pode ser retomada | Página |

Não abrir modal a partir de modal.

**Modal**

- **Larguras:** `sm` 400px, `md` 560px (padrão), `lg` 720px.
- **Superfície:** `radius-xl`, `shadow-lg`, padding de 24px.
- **Cabeçalho:** título `h3`, descrição opcional em `body-sm` e `text-secondary`, e botão de fechar (`X`, ghost) no canto superior direito, com `aria-label="Fechar"`.
- **Rodapé:** ações alinhadas à direita, com gap de 8px.
- **Divisores:** sem divisores entre cabeçalho, corpo e rodapé. Eles aparecem apenas quando o corpo rola, para indicar a rolagem.
- **Fundo:** `bg-overlay`. Clicar fora fecha somente se não houver dados preenchidos.
- **Comportamento:**
  - Esc fecha;
  - o foco fica preso no modal e volta ao elemento de origem ao fechar;
  - usar `role="dialog"`, `aria-modal="true"` e `aria-labelledby`.

**Confirmação destrutiva**

- **Título:** uma pergunta específica ("Excluir unidade?").
- **Corpo:** a consequência ("A unidade e seus 12 registros serão removidos. Esta ação não pode ser desfeita.").
- **Botões:** "Cancelar" (ghost) e o botão destrutivo com o verbo e o objeto ("Excluir unidade").

**Drawer**

- **Posição e tamanho:** entra pela direita, com 480px de largura (640px na versão larga) e 100% da altura. No mobile, ocupa a tela inteira.
- **Aparência:** padding de 24px, `shadow-lg`, cabeçalho igual ao do modal e ações fixas no rodapé.

### 11.12 Toasts e alertas

**Toast** — confirmação ou erro de uma ação que o usuário acabou de fazer

| Propriedade | Valor |
|---|---|
| Superfície | `bg-raised`, `shadow-md`, `radius-lg` |
| Largura | 360px |
| Padding | 12px × 16px |
| Conteúdo | Ícone de 16px na cor sólida do status, título em `body` 500, descrição opcional em `body-sm` e `text-secondary`, ação opcional (link) e botão de fechar |
| Posição | Canto inferior direito (desktop); base da tela em largura total (mobile) |
| Empilhamento | No máximo 3 |

- **Duração:** sucesso e informação somem em 5 segundos, com pausa no hover e no foco. Erros permanecem até serem fechados.
- **Acessibilidade:** sucesso usa `aria-live="polite"`; erro usa `role="alert"`.
- **Consistência:** o texto usa o mesmo verbo da ação ("Salvar alterações" → "Alterações salvas").

**Alerta inline** — condição persistente de uma página ou seção

| Propriedade | Valor |
|---|---|
| Fundo | `-bg` do status |
| Borda | Nenhuma |
| Raio | `radius-lg` |
| Padding | 12px × 16px |
| Conteúdo | Ícone de 16px na cor sólida do status, texto em `body` com a cor de texto do status, ação opcional |

- **Uso:** avisos como "O prazo de envio termina em 2 dias" e resumos de erros de formulário.
- **Não usar para:** confirmar ações, que é papel do toast.

---

## 12. Estados: vazio, carregamento e erro

Toda tela e todo componente com dados precisa ter os três estados projetados antes da implementação.

### 12.1 Vazio

Estrutura, centralizada na área do conteúdo, com 48px de padding vertical:

```text
        [ícone Lucide 24px, neutral-400]
        Nenhuma unidade cadastrada              ← h4
        Cadastre a primeira unidade para        ← body, text-secondary,
        começar o acompanhamento.                  largura máxima de 400px
        [+ Nova unidade]                        ← uma única ação
```

Os tipos de vazio usam mensagens diferentes:

| Tipo | Mensagem | Ação |
|---|---|---|
| Primeiro uso | O que é esta área e o que fazer | Ação de criação (primária se for a tarefa principal da página) |
| Sem resultados para filtros | "Nenhum resultado para os filtros aplicados." | "Limpar filtros" |
| Sem dados no período | "Não há dados para o período selecionado." | Alterar período |
| Sem permissão | O que falta e a quem pedir acesso | Link de ajuda, se existir |

- **Sem ilustrações:** não usar grandes ilustrações nem imagens decorativas.
- **Tabelas vazias:** mantêm o cabeçalho e mostram o estado vazio no corpo da tabela.

### 12.2 Carregamento

- **Contextual:** carregar apenas o que está carregando. Não bloquear a aplicação inteira por causa de um componente.
- **Skeleton:**
  - blocos em `bg-muted` com `radius-sm`, nas mesmas dimensões do conteúdo final, para evitar deslocamento de layout;
  - pulso de opacidade (1 → 0,6) em 1,5s;
  - estático com `prefers-reduced-motion`.
- **Atraso:** o indicador só aparece após 300ms, para não piscar em respostas rápidas.

| Contexto | Tratamento |
|---|---|
| Tabela | Mantém o cabeçalho e mostra de 5 a 8 linhas skeleton |
| Seção ou gráfico | Skeleton na área da seção; o restante da página continua utilizável |
| Botão | Estado de carregamento do botão (seção 11.1) |
| Atualização com dados já exibidos | Manter os dados atuais visíveis, com indicador discreto (spinner de 16px junto ao título da seção). Não apagar a tela |
| Carregamento inicial da aplicação | Única situação em que um carregamento de tela inteira é aceitável: fundo `bg-canvas` e spinner central discreto |

### 12.3 Erro

| Nível | Tratamento |
|---|---|
| Campo | Mensagem abaixo do campo (seção 11.2) |
| Formulário | Alerta inline `danger` no topo, com a lista de erros e links para os campos |
| Seção ou componente | O conteúdo é substituído pela mensagem ("Não foi possível carregar os indicadores.") e pelo botão "Tentar novamente". O restante da página continua funcionando |
| Ação | Toast de erro persistente |
| Página (404, 403, 500) | Página simples, com título, explicação em linguagem comum e uma ação ("Voltar para o início") |

Mensagens seguem a seção 15.3. Códigos técnicos, quando úteis para suporte, aparecem em `caption` abaixo da mensagem ("Código: 7F3A-21").

---

## 13. Visualização de dados

### 13.1 Princípio

Todo gráfico responde a uma pergunta. Antes de criar um, defina:

> **"Que informação este gráfico precisa comunicar?"**

Se a resposta for um único número, use um indicador, e não um gráfico.

### 13.2 Escolha da visualização

| Pergunta | Visualização |
|---|---|
| Como evoluiu ao longo do tempo? | Linha (até 5 séries). Colunas para até 12 períodos |
| Qual categoria é maior ou menor? | Barras horizontais ordenadas por valor |
| Como o total se divide? | Barra empilhada 100% ou barras simples. Rosca somente com 2 ou 3 partes |
| Quão perto está da meta? | Barra de progresso ou barra com marcador de meta |
| Como os valores se distribuem? | Histograma ou boxplot |
| Existe relação entre duas medidas? | Dispersão |
| Como varia por território? | Barras ordenadas. Mapa coroplético somente quando a geografia for essencial para a leitura |
| Qual é o valor? | Indicador (seção 11.7) |

Proibido: gráficos 3D, pizza com mais de 3 fatias, gráficos de radar para comparação e eixos duplos, exceto quando indispensáveis e rotulados.

### 13.3 Estilo

- **Fundo e moldura:** o gráfico fica direto na página, sem borda, sem card e sem fundo próprio.
- **Título e subtítulo:**
  - título em `h4`, descrevendo o que o gráfico mostra ("Avaliações concluídas por mês");
  - subtítulo em `body-sm` e `text-secondary`, com período e unidade ("Jan a set/2026, em quantidade").
- **Grade:** apenas linhas horizontais em `chart-grid`, sem linhas verticais. O eixo X usa `chart-axis`. Não desenhar o eixo Y como linha.
- **Textos do gráfico:** rótulos de eixo e legenda em `caption` e `text-secondary`, com números no padrão pt-BR (seção 15.4). Valores grandes são abreviados nos eixos ("1,2 mil").
- **Escala:** barras e colunas sempre começam no zero.
- **Legenda:**
  - no topo, à esquerda, em linha;
  - com até 3 séries, preferir rótulos diretos no fim das linhas ou nas barras;
  - série única dispensa legenda.
- **Tooltip:** `bg-raised`, `shadow-md` e `radius-lg`, com o valor completo e sem abreviação.
- **Dimensões:** altura padrão de 240 a 320px; sparklines de 32 a 40px.
- **Rodapé:** fonte e data de atualização em `caption` e `text-secondary` ("Atualizado em 24/09/2026 às 08:00").
- **Proibido:** gradientes, sombras, animações de entrada longas, bordas nas barras e marcadores decorativos.

### 13.4 Cores em gráficos

| Situação | Cores |
|---|---|
| Série única | `chart-1` |
| Destaque de um item entre vários | Item em `chart-1`; demais em `chart-context` |
| Categorias (até 5) | `chart-1` → `chart-2` → `chart-3` → `chart-4` → `chart-5`, nesta ordem |
| Mais de 5 categorias | Agrupar em "Outros" ou usar pequenos múltiplos. Não criar novas cores |
| Escala sequencial (intensidade) | `blue-100` → `blue-300` → `blue-500` → `blue-700` → `blue-900` |
| Escala divergente | `danger-600` ↔ `neutral-200` ↔ `blue-600` |
| Bom e ruim | `chart-positive` e `chart-negative`, somente quando há julgamento de valor |

A ordem das cores categóricas alterna luminosidade para que séries vizinhas sejam distinguíveis também por pessoas com daltonismo.

### 13.5 Acessibilidade de gráficos

- **Resumo textual:** todo gráfico tem um resumo em texto (`aria-label` ou texto visível) com a conclusão principal.
- **Dados em tabela:** oferecer a opção "Ver dados em tabela" em gráficos com dados relevantes para decisão.
- **Além da cor:** usar rótulos diretos, marcadores ou padrões de linha (contínua ou tracejada) para diferenciar séries.

### 13.6 Bibliotecas

- **Frontend:** usar a biblioteca de gráficos já adotada no projeto. Não introduzir uma nova biblioteca para um gráfico simples.
- **Python:** a biblioteca é livre, conforme a necessidade. Gráficos gerados em Python (relatórios, exportações) seguem as mesmas regras:
  - paleta desta seção e fundo branco;
  - sem bordas superior e direita;
  - grade horizontal em `neutral-200`;
  - fonte Geist quando disponível no ambiente, ou sans-serif padrão;
  - exportação em SVG ou PNG com resolução 2x.

---

## 14. Ícones

**Biblioteca oficial:** Lucide. Não misturar outras bibliotecas de ícones.

### 14.1 Especificação

| Tamanho | Uso |
|---|---|
| 14px | Ordenação de tabela, breadcrumb, mensagens de erro de campo, variação de indicador |
| 16px | Padrão: botões, campos, itens de menu, toasts, alertas, ícones junto a `body` |
| 20px | Navegação da sidebar, itens de lista |
| 24px | Estados vazios |

- **Traço:** `strokeWidth` de 1,75 em todos os tamanhos.
- **Cor:** `currentColor`, herdando a cor do texto. Ícones de ação em `neutral-700`; ícones auxiliares em `neutral-500`.
- **Acessibilidade:**
  - ícones decorativos têm `aria-hidden="true"`;
  - botões só com ícone têm `aria-label` e tooltip.
- **Quando usar:** somente quando ajudam a reconhecer uma ação ou um tipo de conteúdo. Não colocar ícone em todos os títulos, labels ou itens.

### 14.2 Mapeamento padrão

Usar sempre o mesmo ícone para o mesmo significado, em todos os produtos:

| Significado | Ícone Lucide |
|---|---|
| Criar | `Plus` |
| Editar | `Pencil` |
| Excluir | `Trash2` |
| Pesquisar | `Search` |
| Filtros | `ListFilter` |
| Exportar / baixar | `Download` |
| Importar / enviar arquivo | `Upload` |
| Mais ações | `Ellipsis` |
| Fechar | `X` |
| Voltar | `ArrowLeft` |
| Avançar em hierarquia | `ChevronRight` |
| Expandir / recolher | `ChevronDown` / `ChevronUp` |
| Configurações | `Settings` |
| Ajuda | `CircleHelp` |
| Notificações | `Bell` |
| Perfil | `CircleUser` |
| Sair | `LogOut` |
| Sucesso | `CircleCheck` |
| Erro | `CircleAlert` |
| Atenção | `TriangleAlert` |
| Informação | `Info` |
| Link externo | `ExternalLink` |
| Data | `Calendar` |
| Carregando | `LoaderCircle` |
| Ordenação | `ArrowUpDown` / `ArrowUp` / `ArrowDown` |
| Tendência | `TrendingUp` / `TrendingDown` |
| Menu (mobile) | `Menu` |
| Recolher / expandir sidebar | `PanelLeftClose` / `PanelLeftOpen` |

Em versões antigas do Lucide, alguns nomes usam os aliases anteriores: `MoreHorizontal`, `HelpCircle`, `CheckCircle2`, `AlertCircle`, `AlertTriangle` e `Loader2`.

---

## 15. Conteúdo e linguagem

### 15.1 Tom

- **Clareza:** direto, claro e profissional. Frases curtas, em voz ativa.
- **Vocabulário:** nomeie as coisas como o usuário as entende, e não como o sistema as implementa. O usuário "gerencia permissões", e não "configura perfis de ACL".
- **Instruções:** no imperativo ("Selecione uma unidade").
- **Consistência:** o mesmo conceito tem o mesmo nome em todo o produto.

### 15.2 Formas

- **Caixa:** sentence case em tudo (seção 4.3).
- **Botões:** verbo no infinitivo, mais o objeto quando houver ambiguidade (seção 11.1).
- **Pontuação:** labels e títulos não terminam com ponto. Descrições e mensagens com frase completa terminam com ponto.
- **Metadados:** cada item em seu próprio elemento, separado por espaço, e não concatenado com símbolos decorativos.
- **Setas e símbolos:** não acrescentar "→" ou outros símbolos ao texto de links e botões.
- **Marcadores numéricos:** não usar numeração decorativa (01, 02, 03) quando o conteúdo não for uma sequência real.

### 15.3 Mensagens

Estrutura: **o que aconteceu + o que fazer**.

| Evitar | Preferir |
|---|---|
| "Erro 500." | "Não foi possível salvar as alterações. Tente novamente em alguns minutos." |
| "Ops! Algo deu errado." | "Não foi possível carregar a lista de unidades." |
| "Campo inválido." | "Informe um CPF com 11 dígitos." |
| "Sucesso!" | "Unidade criada." |
| "Tem certeza?" | "Excluir a unidade Centro?" |
| "Nenhum registro encontrado." | "Nenhuma unidade corresponde aos filtros aplicados." |

- **Sem termos técnicos:** nada de stack traces, nomes de tabelas ou códigos HTTP para o usuário final.
- **Sem culpar o usuário:** evite tom que coloca a responsabilidade do erro em quem usa o sistema.

### 15.4 Formatos (pt-BR)

Formatar com `Intl.NumberFormat` e `Intl.DateTimeFormat` no locale `pt-BR`.

| Tipo | Formato |
|---|---|
| Data | 24/09/2026 |
| Data e hora | 24/09/2026 às 14:30 (texto); 24/09/2026 14:30 (tabelas) |
| Hora | 14:30 (24 horas) |
| Período | 01/09/2026 a 30/09/2026 |
| Mês em gráficos | set/2026 |
| Data relativa | "há 5 minutos", "ontem" — até 7 dias, com a data absoluta em tooltip |
| Número inteiro | 1.234.567 |
| Decimal | 1.234,56 |
| Percentual | 12,5% |
| Moeda | R$ 1.234,56 |
| Número abreviado | 1,2 mil; 3,4 mi; 1,1 bi |
| CPF / CNPJ / CEP / telefone | Conforme as máscaras da seção 11.2 |
| Valor ausente | — |

---

## 16. Responsividade

A interface deve funcionar em desktop, notebook, tablet e, quando aplicável, mobile. Não basta diminuir os componentes: reorganize a interface.

| Elemento | ≥ 1280px (`xl`) | 1024–1279px (`lg`) | 768–1023px (`md`) | < 768px |
|---|---|---|---|---|
| Sidebar | Expandida | Recolhida (ícones) ou expandida, por preferência do usuário | Drawer sobreposto | Drawer sobreposto |
| Padding da página | 32px | 32px | 24px | 16px |
| Indicadores | 4 colunas | 4 colunas | 2 colunas | 1 coluna |
| Grades de gráficos e cards | 2–3 colunas | 2 colunas | 1–2 colunas | 1 coluna |
| Ações do page header | Visíveis | Visíveis | Principal visível; demais em "Mais ações" | Principal visível; demais em "Mais ações" |
| Filtros | Em linha | Em linha | Busca e "Filtros (n)" | Busca e "Filtros (n)" |
| Tabelas | Completas | Completas | Rolagem horizontal, primeira coluna fixa | Rolagem horizontal ou lista de itens nas tabelas principais |
| Formulários em 2 colunas | 2 colunas | 2 colunas | 2 colunas | 1 coluna |
| Modais | Centralizados | Centralizados | Centralizados | Tela cheia ou folha inferior |
| Drawers | 480px | 480px | 480px | Tela cheia |

- **Alvos de toque:** em dispositivos de toque (`pointer: coarse`), controles interativos têm no mínimo 44 × 44px.
- **Zoom e largura mínima:** o conteúdo deve se reorganizar sem rolagem horizontal da página em 320px de largura e com zoom de 200% (WCAG 1.4.10). A exceção são tabelas e gráficos, que rolam dentro do próprio container.
- **Zoom do navegador:** nunca desabilitar.

---

## 17. Acessibilidade

**Meta:** WCAG 2.2 nível AA em todas as interfaces.

| Tema | Requisito |
|---|---|
| Contraste de texto | 4,5:1 (texto normal); 3:1 (texto grande). Os tokens de texto já atendem sobre `bg-canvas` e `bg-subtle` |
| Contraste não textual | 3:1 para contornos de campos, ícones essenciais, indicadores de estado e elementos de gráfico |
| Foco | Sempre visível: contorno de 2px `focus-ring` com offset de 2px, ou branco sobre a sidebar. Nunca remover o `outline` sem substituto equivalente |
| Foco não encoberto | Header e barras fixas não podem cobrir o elemento em foco (`scroll-padding-top`, seção 8) |
| Teclado | Toda funcionalidade acessível por teclado, em ordem lógica. Esc fecha camadas temporárias. O foco fica preso em modais e retorna ao elemento de origem |
| Link de salto | "Pular para o conteúdo" como primeiro elemento focável da página |
| Área de clique | Mínimo de 24 × 24px (WCAG 2.5.8). Padrão de 36px no desktop e 44px em toque |
| Labels | Todo campo tem label visível associado. Botões só com ícone têm `aria-label` |
| Semântica | Elementos nativos (`button`, `a`, `table`, `nav`, `main`, `dl`, `fieldset`). Não usar `div` clicável. Títulos em ordem hierárquica |
| Cor | Nenhuma informação transmitida apenas por cor |
| Feedback assíncrono | `aria-live` em toasts e atualizações. `role="alert"` para erros. `aria-busy` durante carregamentos |
| Erros | Identificados em texto, associados ao campo e com instrução de correção |
| Entrada redundante | Não pedir a mesma informação duas vezes no mesmo fluxo (WCAG 3.3.7) |
| Movimento | Respeitar `prefers-reduced-motion` |
| Idioma | `lang="pt-BR"` no documento |

---

## 18. Stack e implementação

Referência tecnológica do ecossistema:

```text
Frontend:              React, TypeScript
Backend:               TypeScript
Banco de dados:        PostgreSQL
ETL / processamento:   Python
Tipografia:            Geist (Geist Mono para código)
Ícones:                Lucide
```

- **Gráficos em Python:** não há biblioteca obrigatória.
- **Gráficos no frontend:** usar a biblioteca já adotada no projeto.
- **Componentes:** usar a biblioteca de componentes já adotada no projeto. Se não houver uma:
  - construir componentes próprios seguindo este documento;
  - preferir primitivos acessíveis sem estilo próprio (headless);
  - evitar bibliotecas com identidade visual forte, que conflitam com estes tokens.
- **Novas tecnologias:** só entram nesta seção quando realmente fizerem parte da arquitetura.
- **Tokens:** são a fonte de verdade. Não criar valores hardcoded quando existir um token equivalente.

---

## 19. Reutilização, processo e decisões não documentadas

### 19.1 Reutilização

Antes de criar qualquer componente:

1. Procurar um componente existente.
2. Verificar se ele pode ser reutilizado como está.
3. Verificar se pode ser generalizado com uma nova variante ou propriedade.
4. Somente então criar um componente novo.

Não criar versões visualmente diferentes do mesmo componente sem justificativa documentada.

### 19.2 Processo obrigatório para uma IA

Antes de implementar uma interface:

1. Ler este `design.md` (seções 0 a 2 inteiras e as seções dos componentes envolvidos).
2. Analisar as telas existentes do produto.
3. Procurar componentes existentes.
4. Identificar padrões reutilizáveis.
5. Identificar a informação principal da tela.
6. Identificar a ação principal.
7. Reduzir elementos desnecessários (seção 2.5).
8. Aplicar a linguagem visual e os tokens definidos aqui.
9. Verificar a responsividade (seção 16).
10. Verificar a acessibilidade (seção 17).
11. Verificar o estado de carregamento (seção 12.2).
12. Verificar o estado vazio (seção 12.1).
13. Verificar o estado de erro (seção 12.3).
14. Conferir a tela com os padrões de página (seção 9.6) e com o checklist final (seção 21).
15. Implementar.

### 19.3 Decisões não documentadas

Quando uma decisão visual não estiver coberta aqui:

1. Procurar uma solução semelhante já existente no produto.
2. Manter consistência com o restante do produto.
3. Seguir a filosofia: **menos caixas, menos elementos, mais hierarquia e espaço.**
4. Escolher a solução mais simples.
5. Não introduzir um novo padrão sem necessidade. Se um padrão novo for inevitável, registrá-lo neste documento.

---

## 20. Escopo deste documento

Este documento define UI, UX, linguagem visual, componentes, interação, acessibilidade, responsividade e visualização de dados.

Ele **não** define:

- arquitetura de backend;
- endpoints;
- SQL e estrutura do PostgreSQL;
- regras de negócio;
- autenticação;
- ETL;
- CI/CD;
- Git;
- testes.

Esses assuntos ficam em `AGENTS.md` ou na documentação técnica própria de cada projeto.

---

## 21. Checklist final

Toda interface deve responder "sim" a todas as perguntas:

- [ ] A interface está clara?
- [ ] A informação principal é identificável imediatamente?
- [ ] Existe uma única ação principal clara?
- [ ] Não há elementos que poderiam ser removidos?
- [ ] Nenhuma borda ou card poderia ser substituído por espaço?
- [ ] A tela parece parte do mesmo ecossistema visual?
- [ ] A interface continua simples quando tem muitos dados?
- [ ] Os estados de carregamento, vazio e erro estão projetados?
- [ ] Apenas tokens foram usados, sem valores hardcoded?
- [ ] Funciona por teclado, com foco visível e contraste adequado?

Se houver excesso de elementos visuais, simplifique.

### Fazer

- Usar espaço negativo e hierarquia tipográfica para organizar.
- Usar o azul institucional com moderação.
- Usar superfícies sutis em vez de caixas com borda.
- Criar layouts fluidos e contínuos.
- Reutilizar componentes e manter consistência.
- Usar Geist e Lucide.
- Priorizar produtividade e clareza.

### Evitar

- Excesso de cards, bordas, divisores e sombras.
- Card para cada pequeno grupo de informação.
- Bordas em todos os elementos.
- Gradientes decorativos e glassmorphism.
- Interfaces excessivamente arredondadas ("tudo é pílula").
- Excesso de cores e cores semânticas como fundo dominante.
- Ícones decorativos em excesso.
- Caixa alta em labels e títulos.
- Dashboards genéricos e interfaces visualmente fragmentadas.
- Elementos usados apenas para preencher espaço.

> **A interface deve parecer organizada pela hierarquia e pelo espaço, não por uma coleção de caixas.**
