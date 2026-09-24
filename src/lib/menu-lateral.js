/*
  O menu lateral organizado em áreas.

  Antes o menu era uma lista corrida em três grupos fixos ("Principal",
  "Painéis", "Administração"). Agora cada área do sistema — Saúde indígena,
  Recrutamento e seleção, Administração — é um item que abre as próprias
  páginas; com a barra recolhida, cada área vira um ícone só. O sistema vai
  ganhar mais áreas, e o trilho recolhido cresce um ícone por área, não um por
  página.

  Por que "área" e não "módulo": em `permissoes-recursos.js` e
  `permissoes-por-modulo.js`, módulo já é o nome de cada página com permissão
  própria (dashboard, nucleo, calendario…). Chamar o agrupamento do menu pelo
  mesmo nome misturaria as duas coisas.

  Área nova = uma entrada em `AREAS_DO_MENU`. Página nova = uma entrada em
  `PAGINAS_DO_MENU`. Quem decide o que o perfil pode ver continua sendo o
  `buildNav` de `legacy-app.js`; este arquivo só organiza o que já foi
  permitido.
*/

export const AREAS_DO_MENU = Object.freeze([
  /*
    `paginaUnica`: a área é uma página só e vira link direto, sem abrir
    submenu. É propriedade do catálogo, e não consequência do filtro de
    permissão: uma área que o perfil reduziu a um item continua sendo
    submenu, com o nome da página à vista.
  */
  Object.freeze({
    id: "saude-indigena",
    rotulo: "Saúde indígena",
    icone: "heart-pulse",
    paginaUnica: true,
  }),
  Object.freeze({
    id: "recrutamento",
    rotulo: "Recrutamento e seleção",
    icone: "briefcase-business",
  }),
  Object.freeze({
    id: "administracao",
    rotulo: "Administração",
    icone: "settings",
  }),
]);

/* O ícone da página só aparece no menu inferior do celular. */
export const PAGINAS_DO_MENU = Object.freeze([
  Object.freeze({
    view: "dashboard",
    area: "saude-indigena",
    rotulo: "Visão geral",
    icone: "map",
  }),
  Object.freeze({
    view: "nucleo",
    area: "recrutamento",
    rotulo: "Editais",
    icone: "file-text",
  }),
  Object.freeze({
    view: "calendario",
    area: "recrutamento",
    rotulo: "Cronograma",
    icone: "calendar-days",
  }),
  Object.freeze({
    view: "approved",
    area: "recrutamento",
    rotulo: "Lista de aprovados",
    icone: "user-round-check",
  }),
]);

/*
  Painéis externos não têm categoria no banco (`TB_PAINEL_EXTERNO`). Hoje são
  de processo seletivo — o único conhecido é Análises Curriculares —, então
  entram em Recrutamento e seleção. Para mandar um painel para outra área,
  registre o `codigo` dele aqui.
*/
export const AREA_DOS_PAINEIS = "recrutamento";
export const AREA_POR_PAINEL = Object.freeze({});
export const ICONE_DOS_PAINEIS = "square-arrow-out-up-right";

/* As seções de Configurações (`SECOES`, em `config-secoes.js`) são as páginas de Administração. */
export const AREA_DAS_CONFIGURACOES = "administracao";
export const ICONE_DAS_CONFIGURACOES = "settings";

const texto = (valor) => String(valor ?? "").trim();

export function areaDoPainel(codigo) {
  const area = AREA_POR_PAINEL[texto(codigo)];
  return AREAS_DO_MENU.some((a) => a.id === area) ? area : AREA_DOS_PAINEIS;
}

/*
  `permitidas` diz, por view, o que o perfil pode abrir. `paineis` chega já
  filtrado e na ordem de exibição. Devolve as áreas na ordem do catálogo, cada
  uma com os seus itens, e descarta as que ficaram vazias.
*/
export function montarArvoreDoMenu({
  permitidas = {},
  paineis = [],
  secoesDeConfiguracao = [],
} = {}) {
  const itensPorArea = new Map(AREAS_DO_MENU.map((area) => [area.id, []]));

  for (const pagina of PAGINAS_DO_MENU) {
    if (!permitidas[pagina.view]) continue;
    itensPorArea.get(pagina.area)?.push({
      view: pagina.view,
      rotulo: pagina.rotulo,
      icone: pagina.icone,
    });
  }

  for (const painel of paineis) {
    const codigo = texto(painel?.codigo);
    if (!codigo) continue;
    itensPorArea.get(areaDoPainel(codigo)).push({
      view: `panel:${codigo}`,
      rotulo: texto(painel.titulo) || codigo,
      icone: ICONE_DOS_PAINEIS,
    });
  }

  if (permitidas.config) {
    for (const secao of secoesDeConfiguracao) {
      itensPorArea.get(AREA_DAS_CONFIGURACOES)?.push({
        view: "config",
        secao: secao.id,
        rotulo: secao.rotulo,
        icone: ICONE_DAS_CONFIGURACOES,
      });
    }
  }

  return AREAS_DO_MENU.map((area) => ({
    ...area,
    itens: itensPorArea.get(area.id),
  })).filter((area) => area.itens.length > 0);
}

export function eLinkDireto(area) {
  return Boolean(area?.paginaUnica) && area?.itens?.length === 1;
}

/*
  O item da página aberta: o da mesma view e da mesma seção; sem seção que
  bata (Configurações ainda sem seção escolhida), o primeiro daquela view.
  Devolve a área junto, ou `null` quando a página não está no menu.
*/
export function itemAtivoDaArvore(arvore = [], view, secao) {
  const candidatos = [];
  for (const area of arvore) {
    for (const item of area.itens) {
      if (item.view === view) candidatos.push({ area: area.id, item });
    }
  }
  return (
    candidatos.find(({ item }) => !item.secao || item.secao === secao) ||
    candidatos[0] ||
    null
  );
}

/*
  Recolhida, a navegação só rola quando os ícones não cabem (no trilho de 60px
  uma rolagem permanente espremeria os ícones). Folga de 1px para subpixel.
*/
const FOLGA_DE_SUBPIXEL = 1;

export function navegacaoTransborda(alturaDoConteudo, alturaDisponivel) {
  return (
    Number(alturaDoConteudo) - Number(alturaDisponivel) > FOLGA_DE_SUBPIXEL
  );
}

/*
  As áreas nascem abertas. O que se guarda é a lista das que a pessoa fechou:
  assim, uma área nova no catálogo já aparece aberta, sem depender de ninguém
  ter aberto antes.
*/
export function areaAberta(fechadas, area) {
  return !fechadas.has(area);
}

/* Todo nome de ícone que o catálogo pode pedir — o registro de ícones precisa ter todos. */
export function iconesDoCatalogo() {
  return [
    ...new Set([
      ...AREAS_DO_MENU.map((area) => area.icone),
      ...PAGINAS_DO_MENU.map((pagina) => pagina.icone),
      ICONE_DOS_PAINEIS,
      ICONE_DAS_CONFIGURACOES,
    ]),
  ];
}

/*
  Onde o painel flutuante da barra recolhida começa. A pílula com o nome da
  área fica na altura do ícone; se o painel inteiro não couber abaixo, ele
  sobe até caber, sem passar da margem do topo.
*/
export const ALTURA_DA_PILULA = 28;

export function posicaoDoPainelFlutuante({
  topoDoGatilho,
  alturaDoGatilho,
  alturaDoPainel,
  alturaDaJanela,
  alturaDaPilula = ALTURA_DA_PILULA,
  margem = 8,
}) {
  const centrado = topoDoGatilho + (alturaDoGatilho - alturaDaPilula) / 2;
  const limite = alturaDaJanela - margem - alturaDoPainel;
  return Math.round(Math.max(margem, Math.min(centrado, limite)));
}

/*
  Estado do painel flutuante da barra recolhida.

  O painel não pode depender só de `:hover` e `:focus-within`: o `Esc` não
  conseguiria fechá-lo (o foco volta ao ícone, que continua dentro da área),
  um clique deixaria o painel preso aberto (o navegador foca o botão
  clicado), e hover e foco abririam dois painéis ao mesmo tempo. Por isso o
  estado mora aqui, com um painel aberto por vez.

  - `aberta`: a área cujo painel está visível, ou `null`.
  - `origem`: o que abriu — `ponteiro` (fecha quando o ponteiro sai), `foco`
    (fecha quando o foco sai) ou `clique` (fica até clicar de novo, clicar
    fora ou o foco sair).
  - `suprimida`: a área que o usuário acabou de dispensar (`Esc`, ou um item
    escolhido). Ela não reabre enquanto o foco ou o ponteiro não saírem dela
    — senão devolver o foco ao ícone reabriria o painel na mesma hora.
*/
export const FLUTUANTE_FECHADO = Object.freeze({
  aberta: null,
  origem: null,
  suprimida: null,
});

export function proximoFlutuante(estado, evento) {
  const atual = estado || FLUTUANTE_FECHADO;
  const area = evento?.area ?? null;

  switch (evento?.tipo) {
    case "apontar":
      if (atual.suprimida === area || atual.aberta === area) return atual;
      return { aberta: area, origem: "ponteiro", suprimida: null };

    case "focar":
      if (atual.suprimida === area) return atual;
      if (atual.aberta === area) {
        return atual.origem === "ponteiro"
          ? { ...atual, origem: "foco" }
          : atual;
      }
      return { aberta: area, origem: "foco", suprimida: null };

    case "alternar":
      if (atual.aberta === area && atual.origem === "clique") {
        return { aberta: null, origem: null, suprimida: area };
      }
      return { aberta: area, origem: "clique", suprimida: null };

    case "desapontar": {
      const suprimida = atual.suprimida === area ? null : atual.suprimida;
      if (atual.aberta === area && atual.origem === "ponteiro") {
        return { aberta: null, origem: null, suprimida };
      }
      return suprimida === atual.suprimida ? atual : { ...atual, suprimida };
    }

    case "desfocar": {
      const suprimida = atual.suprimida === area ? null : atual.suprimida;
      if (atual.aberta === area && atual.origem !== "ponteiro") {
        return { aberta: null, origem: null, suprimida };
      }
      return suprimida === atual.suprimida ? atual : { ...atual, suprimida };
    }

    case "dispensar":
      return { aberta: null, origem: null, suprimida: area ?? atual.aberta };

    case "fechar":
      return FLUTUANTE_FECHADO;

    default:
      return atual;
  }
}
