/*
  O menu lateral organizado em grupos.

  Antes o menu era uma lista corrida em três grupos fixos ("Principal",
  "Painéis", "Administração"); depois, um grupo por assunto (Saúde indígena,
  Recrutamento e seleção). Agora os grupos de cima são as ÁREAS do sistema que
  o usuário tem (`profile.areas`, de `obter_contexto_monitora`): Saúde
  Indígena, SEDE e Projetos. Cada área repete as mesmas páginas — Editais,
  Cronograma, Lista de aprovados —, e a página abre recortada pela área
  escolhida (a "área atual", em `src/componentes/dados-do-monitoramento.js`).
  Abaixo delas ficam Painéis (os externos que não são de área nenhuma) e
  Administração. Com a barra recolhida, cada grupo vira um ícone só.

  Por que "área" e não "módulo": em `permissoes-recursos.js` e
  `permissoes-por-modulo.js`, módulo já é o nome de cada página com permissão
  própria (dashboard, nucleo, calendario…). Chamar o agrupamento do menu pelo
  mesmo nome misturaria as duas coisas.

  Área nova = uma entrada em `AREAS_DO_SISTEMA` (o código é o de `TB_AREA`).
  Página nova = uma entrada em `PAGINAS_DO_MENU`. Quem decide o que o perfil
  pode ver continua sendo o `buildNav` de `legacy-app.js`; este arquivo só
  organiza o que já foi permitido.
*/

/* Na ordem do banco. O código é o de `TB_AREA` e o de `CO_AREA` nos editais. */
export const AREAS_DO_SISTEMA = Object.freeze([
  Object.freeze({
    id: "saude-indigena",
    rotulo: "Saúde Indígena",
    icone: "heart-pulse",
  }),
  Object.freeze({ id: "sede", rotulo: "SEDE", icone: "building-2" }),
  Object.freeze({ id: "projetos", rotulo: "Projetos", icone: "folder-kanban" }),
]);

export const ICONE_DOS_PAINEIS = "square-arrow-out-up-right";
export const AREA_DOS_PAINEIS = "paineis";
export const AREA_DAS_CONFIGURACOES = "administracao";
export const ICONE_DAS_CONFIGURACOES = "settings";

export const AREAS_DO_MENU = Object.freeze([
  ...AREAS_DO_SISTEMA,
  Object.freeze({
    id: AREA_DOS_PAINEIS,
    rotulo: "Painéis",
    icone: ICONE_DOS_PAINEIS,
  }),
  Object.freeze({
    id: AREA_DAS_CONFIGURACOES,
    rotulo: "Administração",
    icone: ICONE_DAS_CONFIGURACOES,
  }),
]);

/*
  As páginas de cada área. Sem `areas`, a página existe em todas; a Visão geral
  (o mapa) é só da Saúde Indígena. O ícone da página só aparece no menu
  inferior do celular.
*/
export const PAGINAS_DO_MENU = Object.freeze([
  Object.freeze({
    view: "dashboard",
    areas: Object.freeze(["saude-indigena"]),
    rotulo: "Visão geral",
    icone: "map",
  }),
  Object.freeze({ view: "nucleo", rotulo: "Editais", icone: "file-text" }),
  Object.freeze({
    view: "calendario",
    rotulo: "Cronograma",
    icone: "calendar-days",
  }),
  Object.freeze({
    view: "approved",
    rotulo: "Lista de aprovados",
    icone: "user-round-check",
  }),
]);

/*
  Painéis externos não têm área no banco (`TB_PAINEL_EXTERNO`). O de análises
  curriculares é o da Saúde Indígena e entra nela, com nome curto; os outros
  vão para Painéis. Para mandar um painel para uma área, registre o `codigo`
  dele aqui.
*/
export const PAINEIS_DE_AREA = Object.freeze({
  analises: Object.freeze({ area: "saude-indigena", rotulo: "Análises" }),
});

/* A área de quem ainda recebe o contexto antigo, sem `profile.areas`. */
const AREAS_PADRAO = Object.freeze(["saude-indigena"]);

const texto = (valor) => String(valor ?? "").trim();

/* As áreas do usuário, só as conhecidas e na ordem do catálogo. */
export function areasDoUsuario(areas) {
  const recebidas = new Set((Array.isArray(areas) ? areas : []).map(texto));
  const conhecidas = AREAS_DO_SISTEMA.map((area) => area.id).filter((id) =>
    recebidas.has(id),
  );
  return conhecidas.length ? conhecidas : [...AREAS_PADRAO];
}

export function nomeDaArea(id) {
  return AREAS_DO_SISTEMA.find((area) => area.id === id)?.rotulo ?? "";
}

export function areaDoPainel(codigo) {
  return PAINEIS_DE_AREA[texto(codigo)]?.area ?? AREA_DOS_PAINEIS;
}

/*
  `permitidas` diz, por view, o que o perfil pode abrir. `paineis` chega já
  filtrado e na ordem de exibição. `areas` são as do usuário. Devolve os grupos
  na ordem do catálogo, cada um com os seus itens, e descarta os vazios. Todo
  item de área leva `area`: é ela que a navegação torna a área atual.
*/
export function montarArvoreDoMenu({
  permitidas = {},
  paineis = [],
  secoesDeConfiguracao = [],
  areas,
} = {}) {
  const doUsuario = new Set(areasDoUsuario(areas));
  const doSistema = new Set(AREAS_DO_SISTEMA.map((area) => area.id));
  const itensPorArea = new Map(
    AREAS_DO_MENU.filter(
      (area) => !doSistema.has(area.id) || doUsuario.has(area.id),
    ).map((area) => [area.id, []]),
  );

  for (const area of AREAS_DO_SISTEMA) {
    const itens = itensPorArea.get(area.id);
    if (!itens) continue;
    for (const pagina of PAGINAS_DO_MENU) {
      if (!permitidas[pagina.view]) continue;
      if (pagina.areas && !pagina.areas.includes(area.id)) continue;
      itens.push({
        view: pagina.view,
        rotulo: pagina.rotulo,
        icone: pagina.icone,
        area: area.id,
      });
    }
  }

  for (const painel of paineis) {
    const codigo = texto(painel?.codigo);
    if (!codigo) continue;
    const deArea = PAINEIS_DE_AREA[codigo];
    // Painel de uma área que o usuário não tem continua acessível, em Painéis.
    if (deArea && itensPorArea.has(deArea.area)) {
      itensPorArea.get(deArea.area).push({
        view: `panel:${codigo}`,
        rotulo: deArea.rotulo,
        icone: ICONE_DOS_PAINEIS,
        area: deArea.area,
      });
      continue;
    }
    itensPorArea.get(AREA_DOS_PAINEIS).push({
      view: `panel:${codigo}`,
      rotulo: texto(painel.titulo) || codigo,
      icone: ICONE_DOS_PAINEIS,
    });
  }

  if (permitidas.config) {
    for (const secao of secoesDeConfiguracao) {
      itensPorArea.get(AREA_DAS_CONFIGURACOES).push({
        view: "config",
        secao: secao.id,
        rotulo: secao.rotulo,
        icone: ICONE_DAS_CONFIGURACOES,
      });
    }
  }

  return AREAS_DO_MENU.filter((area) => itensPorArea.has(area.id))
    .map((area) => ({ ...area, itens: itensPorArea.get(area.id) }))
    .filter((area) => area.itens.length > 0);
}

/*
  O item da página aberta: o da mesma view, da área atual e da mesma seção.
  A mesma view aparece em várias áreas (Editais da SEDE e da Saúde Indígena),
  e só a da área atual acende. Sem área que bata (página que só existe numa
  área, painel, Configurações), vale a seção; sem seção que bata
  (Configurações ainda sem seção escolhida), o primeiro daquela view. Devolve
  o grupo junto, ou `null` quando a página não está no menu.
*/
export function itemAtivoDaArvore(arvore = [], view, secao, area) {
  const candidatos = [];
  for (const grupo of arvore) {
    for (const item of grupo.itens) {
      if (item.view === view) candidatos.push({ area: grupo.id, item });
    }
  }
  const secaoBate = ({ item }) => !item.secao || item.secao === secao;
  return (
    candidatos.find((c) => c.item.area === area && secaoBate(c)) ||
    candidatos.find(secaoBate) ||
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
