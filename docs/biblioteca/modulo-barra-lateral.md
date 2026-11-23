---
tipo: modulo
area: modulo
atualizado: 2026-11-17
---

# Módulo: Barra lateral e busca global (Ctrl+K)

A moldura de navegação do app: o menu lateral (marca, áreas Saúde Indígena, SEDE e Projetos,
Painéis e Administração, trilho e rodapé) e a busca global nos editais. Os dois em React e
TypeScript, em `src/componentes/`, fora das telas.

## Barra lateral

Pasta `src/componentes/barra-lateral/`, filha da casca (`src/app/casca/casca.tsx`). O legado
alimenta por `buildNav`/`setActiveNav`.

- `barra-lateral.tsx` (`<BarraLateral>`: marca e montagem síncrona) e `estado.ts` (estado externo,
  sem React: o app empurra a árvore e o item ativo com `atualizarMenuLateral` e
  `marcarItemAtivoNoMenu`; a barra lê com `useSyncExternalStore`).
- `menu-de-areas.tsx` (acordeão; recolhida, painel flutuante), `alca-de-recolher.tsx` (o botão único
  de recolher: na marca acima de 900 px ou no cabeçalho, por portal), `rodape.tsx` (seletor
  Claro/Escuro de `seletor-de-tema.ts`, Sair e versão), `marca.ts` (a logo `#sideLogo`, de
  Configurações › Marca).
- `integracao.ts` resolve as ações da janela na hora do clique, com as confirmações de saída;
  `usar-ambiente.ts` traz o que o legado controla (classe do `body` e largura; o tema é
  `src/app/tema.ts`); contratos em `tipos.ts`.

### Regras

- Regras puras em `src/lib/navegacao/menu-lateral.ts`: catálogo dos grupos e abas, árvore por páginas
  permitidas, áreas do usuário, blocos da área (Acompanhamento e Processo seletivo,
  `BLOCOS_DA_AREA`/`blocoDaAba`), manutenção, beta, item ativo (considera a área atual), troca de
  área, áreas abertas por padrão, transbordo e posicionamento do flutuante. **Área ou página nova
  entra lá.** Eventos entre o legado e a barra: `src/lib/navegacao/eventos-da-barra-lateral.ts`.
- `abasDoCatalogo` recebe `unknown`, ignora linhas sem identificação, rótulo ou view textuais e
  áreas sem identificação textual; sem abas válidas devolve `null` e o app usa o catálogo do código.
  Ordens aceitam números finitos ou texto numérico. Não substitui as permissões: a navegação decide
  quais páginas entram (`paginasPermitidas`, [[modulo-acessos]]).
- Ids e atributos usados pelo menu no celular, branding, versão, mapas e tours são preservados
  (`#nav [data-view]`, `data-area`, `data-rotulo`, `data-icone`, `aria-current`, `#sideLogo`,
  `#sidebarLogoutBtn.side-logout`, `#globalSidebarToggle`). O texto de `#sidebarVersion` é escrito
  pelo legado; a logo e a versão são atualizadas pelos seus donos.
- CSS em `src/styles/barra-lateral.css` e `platform-shell.css`; o breakpoint da gaveta é 900 px.
- Hooks limpam eventos, observador de tamanho e temporizadores ao desmontar. Áreas fechadas são lidas
  como `unknown` (só lista de ids textuais); erro de armazenamento deixa o menu aberto por padrão.

### Desenho

- **Página aberta:** nome em peso 600 na cor de realce e um marcador fino (2px) sobre a linha-guia,
  sem fundo; no trilho, o mesmo marcador à esquerda do ícone (referência do cabeçalho aprovada em
  23/11/2026).
- **Expandida:** acordeão com todas as áreas abertas por padrão; só a seta gira, a altura não anima.
  Guarda-se só a lista das áreas fechadas, então área nova nasce aberta; abrir uma página reabre a
  área dela. O item escolhido define a área atual; só o item da área atual fica ativo.
- **Recolhida:** trilho de ícones; o painel da área vira um flutuante ao lado, com a pílula do nome.
  Abre por clique, Enter/Espaço ou ponteiro (só com hover) e fecha por `Esc`, clique fora, foco
  saindo ou item escolhido, um por vez. O estado mora no JS (`menu-de-areas.tsx`), não em `:hover`.
- **Rodapé:** seletor Claro/Escuro (o único controle de tema do app), Sair e versão; recolhida, o
  tema vira um botão que alterna e o Sair vira ícone.
- **Medidas e cores:** larguras em `--sidebar-width`/`--sidebar-width-collapsed`; cores nos tokens
  `--menu-*` de `platform-shell.css`, trocados pelo tema escuro e pela cor configurada (exceção
  aceita, [[design-e-tokens]]). Hover e ativo são o próprio texto em baixa opacidade (`color-mix` com
  `currentColor`); o flutuante (`--menu-flutuante-*`) fica fora da cor configurada. A coluna não anima
  a largura.
- Manutenção e beta das abas vêm de Configurações › Módulos e abas ([[modulo-configuracoes]]).

## Busca global (Ctrl+K)

Busca nos editais do monitoramento, filha da raiz React. Pasta `src/componentes/busca-global/`
(`busca-global.tsx`: painel, atalhos, seleção por teclado e mouse, realce e montagem; contratos em
`tipos.ts`); regras puras em `src/lib/navegacao/busca-global.ts`.

- Ctrl+K ou Cmd+K abre a busca com sessão conectada; o campo "Buscar editais" no meio do
  cabeçalho também (evento `EVENTO_ABRIR_A_BUSCA`; some no celular, onde fica o atalho). Pesquisa
  os nove campos do monitoramento, em todas as áreas, sem diferenciar maiúsculas e acentos; mantém
  a ordem da fonte e para em 12.
- O campo começa vazio; setas e Enter escolhem, Esc e o botão Esc fecham (o fundo não, como em todo modal); o modal mantém e devolve o foco.
- A escolha publica `agsus:busca-global-escolhida` com `detail.id`. A navegação em `src/app/` cuida
  das permissões, da área e dos filtros da tela. **A busca não concede acesso** a dado que a carga
  ou a RLS não entregaram.

### Dados compartilhados do monitoramento

`src/componentes/dados-do-monitoramento.ts`, `tipos-do-monitoramento.ts` e `usar-area-atual.ts`
declaram o snapshot compartilhado (linhas de `TB_MONITORAMENTO_INDIGENA` e catálogo `TD_UNIDADE`),
sua assinatura e o recorte por área (`linhasDaArea`, `soDosEditais`). Listas só leitura. Carga sob
demanda: só as páginas de `src/lib/navegacao/telas-com-linhas.ts` (via `src/app/pagina-aberta.ts`) ou
`usarLinhasDoMonitoramento` fazem a carga lê-las.

- A publicação valida com `src/lib/visao-geral/linhas-do-monitoramento.ts`: aceita registros, ids numéricos
  finitos ou texto não vazio, campos textuais conhecidos como texto ou ausentes. Nulos viram
  ausentes; registros malformados são descartados; colunas extras ficam `unknown`. Não substitui os
  contratos das consultas de cada módulo.
- Linhas sem id alimentam indicadores, mas não viram resultado selecionável nem id de recorte.
- A área usa `CO_AREA` e mantém a regra de Saúde Indígena para cache antigo sem a coluna. Sair limpa
  linhas e estado de carga, mantendo a área da aba; a área é corrigida quando chegam as permissões
  do próximo perfil.
- O Sair confirmado volta o endereço para `/` (`sessao.ts`): quem entrar depois no mesmo navegador
  não começa na última página de quem saiu. A sessão expirada e o link aberto sem login guardam o
  endereço, que abre depois de entrar.

## Testes

- Barra: `tests/casca-com-modulo-simulado-na-tela.test.ts` (bloco `componentes/barra-lateral`) (modelo de teste React do projeto), testes da
  navegação, do catálogo e do menu no celular (sem banco); `tests/tipos/barra-lateral.tsx` no
  compilador estrito (não verifica consumidores JavaScript nem o perfil em tempo de execução).
- Busca: `tests/casca-sessao-e-interface.test.js` (bloco `busca-global`), `tests/casca-sessao-e-interface-na-tela.test.ts` (bloco `componentes/busca-global`),
  `tests/casca-sessao-e-interface-na-tela.test.ts` (bloco `componentes/area-atual`), `tests/casca-sessao-e-interface-na-tela.test.ts` (bloco `componentes/dados-do-monitoramento`);
  contratos em `tests/tipos/busca-global.tsx`.

## Relacionadas

- [[nova-tela-e-legado]] — estado externo e eventos, nunca o DOM do componente
- [[modulo-acessos]] — páginas liberadas (`paginasPermitidas`)
- [[arquitetura-do-front]] — as áreas do menu, o recorte por área e a carga das linhas
- [[modulo-configuracoes]] — logo, cor, manutenção e beta das abas
- [[modulo-paineis-externos]] — o grupo Painéis
- [[acessibilidade-e-mobile]] — gaveta abaixo de 900 px; foco e teclado no modal
- [[design-e-tokens]] — os tokens `--menu-*`
