---
tipo: modulo
area: modulo
atualizado: 2026-11-10
---

# Módulo: Barra lateral

O menu do app: marca, áreas (Saúde Indígena, SEDE, Projetos), Painéis e Administração, trilho e
rodapé, em React e TypeScript. Pasta `src/componentes/barra-lateral/`, filha da casca
(`src/app/casca/casca.tsx`). O legado alimenta por `buildNav`/`setActiveNav`.

## Arquivos

```
barra-lateral.tsx     <BarraLateral>: marca e montagem síncrona
estado.ts             estado externo (sem React): o app empurra a árvore e o item ativo
                      (atualizarMenuLateral, marcarItemAtivoNoMenu), a barra lê com
                      useSyncExternalStore
menu-de-areas.tsx     áreas (acordeão; recolhida, painel flutuante) e itens
alca-de-recolher.tsx  o botão único de recolher: na marca (> 900px) ou no cabeçalho (portal)
rodape.tsx            seletor Claro/Escuro (seletor-de-tema.ts), Sair e versão
usar-ambiente.ts      hooks do que o legado controla: classe de body e largura (tema: src/app/tema.ts)
integracao.ts         resolve as ações da janela na hora do clique, com as confirmações de saída
marca.ts              a logo (#sideLogo), lida de Configurações › Marca
tipos.ts              contratos da árvore, do catálogo, das opções de navegação e dos eventos
```

## Regras

- Regras puras em `src/lib/menu-lateral.ts`: catálogo dos grupos e abas, árvore por páginas
  permitidas, áreas do usuário, blocos da área (Acompanhamento e Processo seletivo,
  `BLOCOS_DA_AREA`/`blocoDaAba`), manutenção, beta, item ativo (considera a área atual), troca de
  área, áreas abertas por padrão, transbordo e posicionamento do flutuante. Área ou página nova
  entra lá. Eventos entre o legado e a barra: `src/lib/eventos-da-barra-lateral.ts`.
- `abasDoCatalogo` recebe `unknown`, ignora linhas sem identificação, rótulo ou view textuais e
  áreas sem identificação textual; sem abas válidas devolve `null` e o app usa o catálogo do código.
  Ordens aceitam números finitos ou texto numérico. Não substitui as permissões: a navegação decide
  quais páginas entram.
- Ids e atributos usados pelo menu no celular, branding, versão, mapas e tours são preservados
  (`#nav [data-view]`, `data-area`, `data-rotulo`, `data-icone`, `aria-current`, `#sideLogo`,
  `#sidebarLogoutBtn.side-logout`, `#globalSidebarToggle`). O texto de `#sidebarVersion` é escrito
  pelo legado; a logo e a versão são atualizadas pelos seus donos.
- CSS em `src/styles/barra-lateral.css` e `platform-shell.css`; o breakpoint da gaveta é 900 px.
- Hooks limpam eventos, observador de tamanho e temporizadores ao desmontar. Áreas fechadas são lidas
  como `unknown` (só lista de ids textuais); erro de armazenamento deixa o menu aberto por padrão.

## Desenho

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

## Testes

`tests/componentes/barra-lateral.test.ts` (modelo de teste React do projeto), testes da navegação,
do catálogo e do menu no celular (sem banco); `tests/tipos/barra-lateral.tsx` no compilador estrito
(não verifica consumidores JavaScript nem o perfil em tempo de execução).

## Relacionadas

- [[legado-fala-com-react]] — estado externo e eventos, nunca o DOM do componente
- [[permissoes-e-perfis]] — páginas liberadas (`paginasPermitidas`)
- [[areas-do-sistema]] — as áreas do menu
- [[modulo-modulos-e-abas]] — manutenção e beta das abas
- [[mobile]] — gaveta abaixo de 900 px
- [[modulo-configuracoes]] — logo e cor da barra
