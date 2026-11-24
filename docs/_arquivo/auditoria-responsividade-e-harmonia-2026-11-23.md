---
tipo: referencia
area: front
atualizado: 2026-11-23
---

# Auditoria de responsividade e harmonia visual — 23/11/2026

Etapa 1 do pedido "o sistema precisa ser responsivo de verdade" e "mais harmônico, usando regras
de design": diagnóstico, sem mudar telas. Norma: [Design System AgSUS](../design-system-agsus.md)
(seções 4, 5, 11, 16 e 17) e as regras locais de [design e tokens](../biblioteca/design-e-tokens.md)
e [acessibilidade e mobile](../biblioteca/acessibilidade-e-mobile.md).

## O diagnóstico em poucas linhas

- **Nenhuma tela rola de lado** em 375, 768 ou 1280px (0 de 466 medições). O #872 segurou
  (`.ui-tela` com `minmax(0, 1fr)`). A trava de 375px já passaria hoje (25 de 25 telas).
- **O que falta de "responsivo de verdade" é reorganizar, não caber.** No celular o cabeçalho
  some (só menu e perfil), as ações da tela empilham em botões de largura cheia, as tabelas
  legadas viram cartões com outro espaçamento, e o padding da página é o mesmo de 1280px.
- **Alvo de toque é o maior problema funcional:** 187 controles distintos com menos de
  44 × 44px, em 17 das 25 telas. A causa principal é uma só: a regra de toque de `ui.css` vale
  só dentro de `.ui-tela`, `.ui-gaveta`, `.modal` e `.mapa-si`, e as telas legadas (Editais,
  Cronograma, Configurações) ficam de fora.
- **Harmonia: o espaçamento é o desvio que mais se repete** (296 achados distintos nas telas e
  44 na moldura, em todas as 25). Quase tudo vem de poucas regras antigas com valores fora da
  escala de 4px: `.content` (14/10/34px), as tabelas no celular (10 e 11px com `!important`),
  o padding de 14px dos campos e os detalhes do cabeçalho e da barra lateral.
- **Tipografia e cor estão em ordem:** 1 fonte e 1 peso fora da escala (o título do modal do
  edital, sem estilo) e nenhuma cor fora de token além das prévias de cor configurada.
- **Componentes feitos à mão:** 26 na tela (12 telas) e 10 na moldura. Os que pesam: a barra de
  salvar de Configurações (6 seções), as células e a legenda do Cronograma, os efeitos de
  Comemorações, os blocos da página do edital e os campos `select` sem `Campo`.
- **Achado à parte, prioritário:** a Classificação aberta direto pelo endereço fica no
  esqueleto para sempre (seção seguinte).

## Achado prioritário: Classificação aberta direto pela rota fica no esqueleto

Não é visual: é um defeito de carga, achado porque a auditoria abre cada tela direto pelo
endereço.

**Passos para reproduzir**

1. Entrar no Yeendé com acesso à Classificação.
2. Abrir direto o endereço `/<área>/classificacao` (colar na barra, abrir de um favorito ou
   apertar F5 já na tela).
3. A lista de editais fica nos cartões de esqueleto e nunca carrega.
4. Contraprova: abrir antes a Visão geral (ou Editais) e ir para a Classificação pelo menu: a
   lista carrega.

**Causa:** `src/modulos/classificacao/entrada-da-classificacao.tsx` (linha 52) só fica `pronto`
quando `monitoramento.carregado`, mas `classificacao` não está em `TELAS_COM_LINHAS`
(`src/lib/navegacao/telas-com-linhas.ts`). Aberta direto, ninguém pede as linhas do
monitoramento e a espera não termina. Captura: `classificacao-cheia-1280-claro.png`
(reproduzido com sessão simulada).

**Correção:** no #960, `classificacao` e `conduzir-entrevistas` entraram em `TELAS_COM_LINHAS`.

## Como foi medido

`npm run auditoria:visual` (`scripts/rodar-auditoria-visual.mjs`) compila o app apontando para o
Supabase simulado e roda `tests/auditoria-visual.spec.js`, que abre cada tela com sessão
simulada e dados fictícios (`tests/fixtures/acabamento/` e `tests/fixtures/auditoria-visual/`)
e mede com `tests/apoio/medir-tela.js`; `scripts/resumir-auditoria-visual.mjs` monta o resumo.

- **Telas (25):** as 17 telas das áreas (Visão geral, Editais, página do edital, Cronograma,
  Aprovados, Painel de recursos, Recursos, Painel de entrevistas, Entrevistas, Classificação,
  Análises, Avaliação documental, Triagem, Seleção, Painéis, os dois mapas) e as 8 seções de
  Configurações.
- **Estados:** cheia, vazia e erro 500 em todas; modal (Novo edital), gaveta (processo da Visão
  geral) e menu do celular por cima da tela cheia.
- **Larguras e temas:** 375 e 768px com toque emulado (`pointer: coarse`), 1280px com mouse;
  claro e escuro. **466 medições.**
- **O que se mede:** conteúdo além da borda direita (com ou sem rolagem; o `body` tem
  `overflow-x: hidden`, então o que passasse ficaria cortado), elemento que passa do pai,
  conteúdo cortado e reticências sem `title`, alvo de toque < 44px (375 e 768), fonte fora de
  12/13/14/16/18/20/22/28/36px, peso fora de 400/500/600, margin/padding/gap fora da escala de
  `--space-*` (0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px), cor calculada que não é
  valor de token (a derivada por `color-mix` e a cor configurada da barra ficam fora da conta),
  e botão, selo, cartão, tabela e campo sem classe de `src/ui/` nem do DS 11.
- **Contagem:** "achado distinto" é assinatura do elemento + propriedade + valor; a mesma regra
  em 50 linhas é um achado. O achado é separado em **tela** (`.main .content`), **camada**
  (modal, gaveta, diálogo) e **moldura** (barra lateral, cabeçalho, avisos), que se repete em
  todas as telas e se corrige uma vez.
- **Regra de origem:** a última regra que casa e define a propriedade (a importante, se houver);
  a especificidade não entra. É pista para achar a fonte, conferida à mão nas causas abaixo.

### Limites

- **Mapas:** os dois aparecem no estado de erro ("o SIGEPSI não respondeu"): os dados vêm da
  API do servidor, fora da simulação. Medido só o cabeçalho e o aviso.
- **Entrevistas e Triagem** aparecem no seletor de edital (o estado de entrada delas); a ficha
  de um edital aberto não foi medida. **Classificação** ficou no esqueleto (achado acima).
- Zoom de 200% e a largura de 320px (WCAG 1.4.10) não foram medidos; o lote 3 propõe incluir.
- "Feito à mão" é heurística (forma, borda, raio e classe): tem falso positivo, por isso cada
  item do plano cita o elemento para conferir.

## Resumo por tipo de problema

| Tipo                                  | Na tela (distintos) | Telas afetadas | Na moldura |
| ------------------------------------- | ------------------: | -------------: | ---------: |
| Conteúdo além da borda (rolagem)      |                   0 |              0 |          0 |
| Elemento passa do pai                 |                  10 |              2 |          0 |
| Conteúdo cortado (overflow hidden)    |                   2 |              2 |          0 |
| Reticências sem o texto inteiro       |                   1 |              1 |          1 |
| Alvo de toque < 44 × 44px (375 e 768) |                 187 |             17 |          7 |
| Fonte fora da escala                  |                   1 |              1 |          0 |
| Peso fora de 400/500/600              |                   1 |              1 |          0 |
| Espaçamento fora da escala            |                 296 |             25 |         44 |
| Cor que não é token                   |                   6 |              2 |          1 |
| Componente feito à mão                |                  26 |             12 |         10 |

As 6 cores fora de token são todas das prévias de Configurações → Tela de acesso e Aparência
(`.previa-acesso__cartao`, `.config-contraste__previa`), que mostram a cor que a pessoa
configura: exceção legítima, a marcar. Fora da conta ficaram 8 cores derivadas de token e 25 da
barra lateral (cor de Configurações → Aparência, exceção aceita).

## Ranking das telas

Pontos = achados distintos ponderados (rolagem 5, passa do pai, cortado e toque 2, espaço 0,5,
o resto 1); só tela e camadas.

| #   | Tela                             | Pontos | Toque | Espaço | À mão | Outros                       |
| --- | -------------------------------- | -----: | ----: | -----: | ----: | ---------------------------- |
| 1   | Editais (com o modal)            |    134 |    30 |     94 |     7 | 9 passa do pai, fonte e peso |
| 2   | Configurações › Início           |     79 |    30 |     36 |     1 |                              |
| 3   | Configurações › Acessos          |   56,5 |    20 |     25 |     4 |                              |
| 4   | Configurações › Comemorações     |   55,5 |    21 |     11 |     7 | 1 reticências                |
| 5   | Visão geral (com a gaveta)       |   54,5 |    14 |     43 |     1 | 1 passa do pai, 1 cortado    |
| 6   | Configurações › Marca            |     47 |    17 |     20 |     1 | 1 cortado                    |
| 7   | Painéis                          |   36,5 |     8 |     41 |     0 |                              |
| 8   | Cronograma                       |     35 |    11 |     16 |     5 |                              |
| 9   | Configurações › Tela de acesso   |     34 |    10 |     16 |     1 | 5 cores (prévia)             |
| 10  | Configurações › Aparência        |     27 |     7 |     12 |     1 | 6 cores (prévia)             |
| 11  | Aprovados                        |   26,5 |     3 |     41 |     0 |                              |
| 12  | Página do edital                 |     26 |    11 |      6 |     1 |                              |
| 13  | Configurações › Módulos          |   21,5 |     8 |     11 |     0 |                              |
| 14  | Seleção                          |     15 |     0 |     30 |     0 |                              |
| 15  | Painel de recursos               |     12 |     0 |     24 |     0 |                              |
| 16  | Recursos                         |     12 |     0 |     24 |     0 |                              |
| 17  | Análises                         |     11 |     0 |     22 |     0 |                              |
| 18  | Painel de entrevistas            |     11 |     0 |     22 |     0 |                              |
| 19  | Triagem                          |   10,5 |     1 |     17 |     0 |                              |
| 20  | Configurações › Painéis externos |     10 |     0 |     18 |     1 |                              |
| 21  | Avaliação documental             |    9,5 |     1 |     15 |     0 |                              |
| 22  | Entrevistas                      |    6,5 |     1 |      7 |     1 |                              |
| 23  | Classificação                    |    4,5 |     1 |      5 |     0 | (no esqueleto)               |
| 24  | Mapa de Projetos                 |      2 |     0 |      4 |     0 | (no erro)                    |
| 25  | Mapa da Saúde Indígena           |      2 |     0 |      4 |     0 | (no erro)                    |

Leitura: as telas novas em React com `src/ui/` (Seleção, Recursos, Análises, Entrevistas)
quase só herdam o espaçamento da moldura e das tabelas; quem mais desvia é o legado (Editais,
Cronograma) e Configurações.

## Componentes mais afetados

| Elemento                                   | Telas | Problema                                                            |
| ------------------------------------------ | ----: | ------------------------------------------------------------------- |
| `div.content` (grade da página)            |    25 | padding 14/10/34px, igual em 375, 768 e 1280px                      |
| `td`, `th` das tabelas                     |    10 | padding 10/11px no celular e no tablet, gap 10px no modo cartão     |
| `span.status-discreto`                     |    10 | espaçamento fora da escala                                          |
| `input.ui-tabela-busca`, `select`, `input` |     8 | padding lateral de 14px                                             |
| `div.config-layout`                        |     8 | padding-bottom de 92 e 128px                                        |
| `div.config-barra`                         |     6 | barra de salvar feita à mão (cartão sem `src/ui/`)                  |
| `button.ui-segmentado-opcao`               |     4 | 32px de altura no toque (fora de `.ui-tela`)                        |
| `button.btn.icon`                          |     3 | 40px de largura no toque                                            |
| `button.btn.contorno`                      |     5 | 40px de largura no toque                                            |
| `button.visao-geral-numero-botao`          |     1 | alvo de 8 a 24px de largura (números da tabela)                     |
| `a.link` nas tabelas                       |     2 | 24px de altura no toque                                             |
| `input.approved-selecao`                   |     1 | caixa de marcar de 13px                                             |
| `h3#editModalTitle`                        |     1 | título do modal sem estilo (18,72px, peso 700, padrão do navegador) |

Moldura (todas as telas): `.menu-item__selo` (padding 1px 5px), `.skip-link` (10px 16px, alvo de
32 × 20px), `.top-user-button` (gap 9px, padding 5px e 10px, alvo de 53 × 42px), `.top`
(padding 14px), `.title-row` e `.toast-box` (gap 10px), `.actions` (gap 7px),
`.pessoas-online-app` e `.top-user-popover-actions` (13px e 10px), botões de 248 × 40px no menu
do usuário, e os botões da barra lateral sem classe de componente (`.global-side-toggle`,
`.menu-item`, `.menu-area__cabecalho`, `.side-tema__opcao`).

## Causas comuns (corrigir na fonte, uma vez)

| Fonte                                                                                                                                                                                               | O que faz                                                                                                                            | Efeito                                                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `src/ui/ui.css`, `@media (pointer: coarse)` (perto da linha 2400)                                                                                                                                   | o mínimo de 44px vale só dentro de `.ui-tela`, `.ui-gaveta`, `.modal`, `.mapa-si`; `.btn.icon` tem `min-width: 40px` (`app.css:474`) | toque < 44px em Editais, Cronograma, Configurações e nos botões só com ícone |
| `src/styles/app.css:973` `.content { padding: 14px 10px 34px }`                                                                                                                                     | padding fixo, fora da escala, sem variar por largura                                                                                 | as 25 telas; a norma pede 16/24/32px                                         |
| `src/styles/mobile-app.css:191` `th, td { padding: 11px 10px !important; font-size: 0.82rem !important }` e `table { min-width: 720px }`                                                            | tabelas do celular com valores fora da escala e `!important`                                                                         | 10 telas com tabela                                                          |
| `src/styles/mobile-table-cards.css:45` `table.mobile-card-table td { gap: 10px; padding: 10px 12px !important }`                                                                                    | o modo cartão (≤ 900px) com 10px                                                                                                     | 8 telas                                                                      |
| `src/styles/app.css:364` `input:where(…), select, textarea`                                                                                                                                         | padding lateral de 14px                                                                                                              | 18 telas                                                                     |
| `src/modulos/configuracoes/configuracoes.css:17` e `:162`                                                                                                                                           | `.config-layout` reserva 92/128px para a barra; `.config-barra` é uma barra própria                                                  | as 8 seções de Configurações                                                 |
| `src/styles/app.css` (`.top`, `.title-row`, `.actions`, `.toast-box`, `.skip-link`), `platform-shell.css` (`.top-user-button`, `.pessoas-online-app`), `barra-lateral.css:184` (`.menu-item__selo`) | valores antigos (5, 7, 9, 10, 13, 14px) no cabeçalho e na barra                                                                      | a moldura de todas as telas                                                  |
| `src/modulos/aprovados/aprovados.css:289` e `src/ui/ui.css:776` `overflow-wrap: anywhere`                                                                                                           | a palavra quebra em qualquer letra quando a coluna aperta                                                                            | Aprovados a 1280px: "Enfermeir/o", "Edital 001/202/6"                        |
| marcação do modal de edital (legado)                                                                                                                                                                | `h3#editModalTitle` sem classe de título                                                                                             | fonte e peso fora da escala                                                  |

## O que as capturas mostram e a métrica não pega

- **Cabeçalho no celular** (`editais-cheia-375-claro.png`): só menu e perfil; sem marca, sem
  sino, sem busca. Na referência aprovada, o celular tem menu + marca + sino + foto.
- **Ações da tela no celular** (`editais-cheia-375-claro.png`, `cronograma-cheia-375-escuro.png`):
  Atualizar, Cronograma encerrado e Novo edital empilham em três botões de largura cheia. A
  norma (16) pede a principal visível e as demais em "Mais ações".
- **Indicadores**: em Editais, 8 indicadores a 1280px viram 7 + 1 órfão
  (`editais-cheia-1280-claro.png`); no celular ficam em 2 colunas (a norma diz 1; decidir se a
  exceção de 2 colunas fica).
- **Tabelas largas**: a coluna Ações de Editais termina cortada na borda do card a 1280px (rola
  dentro do contêiner, mas não há sinal de que rola); Aprovados aperta as colunas até quebrar
  palavras no meio (`aprovados-cheia-1280-claro.png`).
- **Configurações** não tem o título da página como as outras telas (o cabeçalho é o da seção,
  com ícone) e a barra do topo fica mais alta; na grade de campos, um rótulo longo
  ("Contratações além das vagas imediatas") desalinha a linha (`configuracoes-inicio-cheia-768-claro.png`).
- **Aya por cima do conteúdo**: o botão da Aya cobre o canto do campo de busca e de botões no
  celular (`editais-cheia-375-claro.png`, `configuracoes-inicio-cheia-768-claro.png`).
- **Análises no erro**: o aviso aparece, mas indicadores, gráficos e pendências ficam no
  esqueleto (`analises-erro-1280-claro.png`).

## Plano de correção em lotes

Cada lote corrige na fonte (a regra da tabela de causas), migra para token o bloco que tocar e
termina com `npm run auditoria:visual` mostrando o critério. A ordem é a de impacto; os lotes
2 a 5 não dependem um do outro.

### Lote 1 — Cabeçalho e menu (moldura)

Referência aprovada pelo usuário: **marca e área à esquerda, busca global no meio, à direita
sino, Aya e foto com menu; item ativo do menu em negrito com marcador fino; ícones de ação do
mesmo tamanho; no celular, menu + marca + sino + foto.**

- Fonte: `app.css` (`.top`, `.title-row`, `.actions`, `.skip-link`, `.toast-box`),
  `platform-shell.css` (`.top-user-button`, `.pessoas-online-app`, `.top-user-popover-actions`),
  `barra-lateral.css` (`.menu-item__selo`, `.menu-item`, item ativo), a casca
  (`src/app/casca/`) e a alça do menu (`src/componentes/barra-lateral/alca-de-recolher.tsx`).
- Botões da moldura viram `.btn` / `ui-botao-icone` (nada de botão sem classe de componente).

**Pronto quando:** zero achados de moldura (toque, espaço, feito à mão) nas 3 larguras e nos 2
temas; no celular o cabeçalho mostra menu, marca, sino e foto (captura e um teste de presença
no spec); os ícones de ação do cabeçalho têm todos a mesma caixa (medida igual); item ativo com
peso 600 e marcador.

### Lote 2 — Grade da página e cabeçalho da tela

**Feito em 23/11/2026.** Na auditoria seguinte: `.content` com 16/24/32px de padding lateral
a 375, 768 e 1280px (era 10px nas três); 0 espaço fora da escala em `.content`,
`.config-layout`, `.ui-cabecalho-acoes` e `.status-discreto` (eram 600, 48, 10 e 36 achados
nas 150 medições da tela cheia, claro e escuro); nenhuma tela com mais de uma ação larga no topo a 375px (eram 7: Editais,
Aprovados, Análises, Painel de recursos, Recursos, Seleção e Painel de entrevistas). As travas
do padding e do topo rodam no CI (`tests/auditoria-visual.spec.js`), e a auditoria mede o menu
"Mais ações" aberto (camada `mais-acoes` de Aprovados).

- `.main` não soma respiro lateral no celular (saíram os 12/8px com `!important`); o cabeçalho
  do app (`topo.css`) usa as mesmas larguras (767 e 1023px) que a página.
- `MaisAcoes` (`src/ui/`) e `principal` no `TopoDoPainel`: no celular ficam a principal e
  "⋯ Mais ações". As margens automáticas de `.ui-cabecalho-acoes` e `.status-discreto` viraram
  `flex: 1 1 auto`.
- Configurações: título no `CabecalhoDaTela`; a barra de salvar é `sticky` no pé da página
  (por portal no `.config-rodape`), sem a reserva de 92/128px.

- `.content` com 16px (< 768), 24px (768–1023) e 32px (≥ 1024) de padding lateral, por token;
  `.config-layout` sem os 92/128px (a barra de salvar reserva o espaço pelo próprio componente).
- Configurações com o mesmo `CabecalhoDaTela` das outras telas.
- Ações do cabeçalho da tela: abaixo de 768px, a principal visível e as demais em "Mais ações"
  (`MaisOpcoes` de `src/ui/`).

**Pronto quando:** o padding de `.content` mede 16/24/32px nas três larguras; zero espaço fora
da escala em `.content`, `.config-layout`, `.ui-cabecalho-acoes` e `.status-discreto`; nenhuma
tela com mais de um botão de ação de largura cheia no topo a 375px.

### Lote 3 — Tabelas

**Feito em 23/11/2026.** Na auditoria seguinte: 0 espaço fora da escala em `td`/`th` (eram 62
achados distintos), 0 alvo < 44px dentro de tabela a 375 e 768px (eram 16), 0 rolagem. As travas
de 375 e 320px, do toque na tabela e da palavra inteira (Editais e Aprovados a 1280px) rodam no
CI (`tests/auditoria-visual.spec.js`). A palavra quebra só quando não cabe sozinha
(`break-word`): a largura mínima de cada coluna é a da maior palavra dela, sem lista de colunas.

- `mobile-app.css` e `mobile-table-cards.css`: padding e gap das células por token (8/12px),
  sem `!important`, sem `font-size: 0.82rem`; o modo cartão com o mesmo ritmo das telas novas.
- Coluna Ações de Editais em `AcoesDaLinha`/menu de reticências quando não cabe; primeira coluna
  fixa e sinal de rolagem nas tabelas largas (norma 16).
- `overflow-wrap: anywhere` só para palavra sem espaço (o caso de 200 caracteres), não para
  quebrar "Enfermeiro" na letra: largura mínima nas colunas curtas.
- Links e números clicáveis das tabelas (`a.link`, `.visao-geral-numero-botao`) com alvo de
  44px no toque.
- Ligar a trava "sem rolagem horizontal a 375px" no CI (tirar a condição `AUDITORIA_ROLAGEM` do
  spec) e acrescentar 320px.

**Pronto quando:** zero espaço fora da escala em `td`/`th`; zero alvo < 44px dentro de tabela a
375 e 768px; nenhuma palavra de até 20 letras quebrada no meio a 1280px (Aprovados, Editais); a
trava de 375 e 320px ligada e verde no CI.

### Lote 4 — Filtros, controles e alvos de toque

**Feito em 23/11/2026.** Na auditoria seguinte: 0 alvo < 44px a 375 e 768px (eram 163 na tela),
0 campo feito à mão (eram 8), 0 espaço fora da escala em `input`, `select` e `.ui-tabela-busca`.
A trava de 375 e 320px do lote 3 passou a cobrir todo alvo de toque, não só o da tabela. A regra
de toque de `ui.css` vale em qualquer tela e inclui abas, botão só com ícone e o rótulo em volta
da caixa de marcar; regras locais que prendiam os campos em 36–40px (Entrevistas) saíram.

- A regra `@media (pointer: coarse)` de `ui.css` passa a valer para os controles em qualquer
  tela (sem o escopo de `.ui-tela`), com `.btn.icon` e `.btn.contorno` em 44 × 44px; abas,
  segmentados, chips e o `label.modulos-beta` de Configurações incluídos.
- Campos com padding da escala (12/16px, não 14px) em `app.css:364`.
- `select` e `input` soltos (Comemorações, Cronograma, Entrevistas, Acessos) dentro de `Campo`;
  a caixa de marcar dos Aprovados com o rótulo como alvo.

**Pronto quando:** zero alvo de toque < 44 × 44px a 375 e 768px em todas as telas (hoje 187 na
tela e 7 na moldura); zero "campo feito à mão"; zero espaço fora da escala em `input`, `select`
e `.ui-tabela-busca`.

### Lote 5 — Cartões, indicadores, gavetas e modais

- Configurações: `.config-barra` vira a barra de salvar de `src/ui/` (`ui-barra-de-salvar`).
- Cronograma: `cal-celula` e `cal-legenda-item` como componentes da norma (célula e chip);
  Comemorações (`comemoracoes-efeito`, `comemoracoes-palco`), página do edital
  (`pagina-do-edital-bloco`) e Visão geral (`visao-geral-fase-chip`) sobre `Secao`, `ui-card` e
  `ui-chip`.
- Modal do edital: `h3#editModalTitle` com o título do modal da norma; os cartões
  `metric-readonly` e as caixas do editor de cronograma dentro do modal como `ui-kv`/`Secao`
  (e o editor sem passar da largura do modal: os 9 "passa do pai" de Editais vêm dele).
- Indicadores sem órfão: a grade de `Kpi` distribui 8 itens em 4 + 4 (ou 2 × 4) em vez de 7 + 1.
- Análises no erro: o aviso substitui os esqueletos.
- Marcar como exceção as prévias de cor configurada.

**Pronto quando:** zero componente feito à mão na tela (hoje 26) e na camada; zero fonte e peso
fora da escala; zero cor fora de token sem marcação; nenhuma linha de indicadores com um item
sozinho a 1280px.

## Capturas

Artefato local, fora do Git: `npm run auditoria:visual` grava 466 PNG (~46 MB) em
`test-results/auditoria-visual/<tela>-<estado>-<largura>-<tema>.png`, as medições em
`medicoes/*.json` e o resumo em `resumo.md`. As citadas aqui: `editais-cheia-1280-claro.png`,
`editais-cheia-375-claro.png`, `editais-modal-375-claro.png`, `aprovados-cheia-1280-claro.png`,
`cronograma-cheia-375-escuro.png`, `configuracoes-inicio-cheia-768-claro.png`,
`visao-geral-menu-375-claro.png`, `analises-erro-1280-claro.png` e
`classificacao-cheia-1280-claro.png`.
