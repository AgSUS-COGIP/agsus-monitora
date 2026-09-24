/*
  Configurações organizada em seções, como no SIGAV.

  A página era um formulário corrido: um card com 47 campos, três subtítulos
  soltos e mais dois cards no fim. Achar um ajuste exigia rolar tudo.

  DECISÃO DE ARQUITETURA — classificar, não reescrever.

  Os 45 campos têm `id` fixo, e meio sistema depende deles: `saveAdminSettings`,
  o `FIELD_MAP` da governança, `applyConfigToUi`, o aviso de contraste, a
  validação. Reescrever o HTML em sete cards significaria mexer em 45 âncoras de
  uma vez, com o salvamento no meio do caminho.

  Em vez disso, este módulo **move os nós existentes**. `appendChild` reparenta
  sem destruir: os mesmos elementos, com os mesmos `id`, os mesmos listeners e
  os mesmos valores, passam a viver dentro da seção certa. Nada que consulta o
  DOM por `id` percebe a diferença — e é por isso que a reorganização não toca
  em nenhum caminho de gravação.

  As sete seções são as do SIGAV. Os campos, porém, são outros: o Monitora tem
  KPIs, filtros e painéis externos que o SIGAV não tem. O mapa abaixo é a
  tradução, e é o único lugar onde ela existe.
*/

export const SECOES = Object.freeze([
  {
    id: "marca",
    rotulo: "Marca",
    icone: "fa-font",
    descricao: "Nomes, versão e identidade que aparecem em todo o sistema.",
  },
  {
    id: "inicio",
    rotulo: "Página inicial",
    icone: "fa-bullhorn",
    descricao: "Comunicado, títulos e rótulos do painel de monitoramento.",
  },
  {
    id: "acesso",
    rotulo: "Tela de acesso",
    icone: "fa-right-to-bracket",
    descricao: "Textos do login e regras de autenticação institucional.",
  },
  {
    id: "aparencia",
    rotulo: "Aparência",
    icone: "fa-image",
    descricao: "Arte de fundo, cores e logotipos. Cada cor mostra o contraste.",
  },
  {
    id: "recursos",
    rotulo: "Recursos",
    icone: "fa-tower-broadcast",
    descricao: "Funcionalidades que podem ser ligadas ou desligadas.",
  },
  {
    id: "operacao",
    rotulo: "Operação",
    icone: "fa-sliders",
    descricao: "Referência da base, auditoria e importação de dados.",
  },
  {
    id: "acessos",
    rotulo: "Acessos",
    icone: "fa-user-group",
    descricao: "Solicitações, perfis e quem está autorizado a entrar.",
  },
]);

/*
  Onde cada campo vai parar. Um campo sem entrada aqui cai em "Operação", que é
  o balde honesto: melhor aparecer numa seção discutível do que sumir da tela.
*/
export const SECAO_POR_CAMPO = Object.freeze({
  // Marca
  cfgTitle: "marca",
  cfgSlogan: "marca",
  cfgCogipNome: "marca",
  cfgCogipFuncao: "marca",
  cfgCogipDept: "marca",
  cfgCogipLogo: "marca",
  cfgFooter: "marca",

  // Página inicial
  cfgPageTitle: "inicio",
  cfgPageSubtitle: "inicio",
  cfgBroadcastType: "inicio",
  cfgBroadcastMsg: "inicio",
  cfgFilterTitle: "inicio",
  cfgFilterSubtitle: "inicio",
  cfgFilterToggleShow: "inicio",
  cfgFilterToggleHide: "inicio",
  cfgKpiProcessos: "inicio",
  cfgKpiVagas: "inicio",
  cfgKpiContratados: "inicio",
  cfgKpiOciosas: "inicio",
  cfgKpiCriticos: "inicio",
  cfgKpiInscritos: "inicio",

  // Tela de acesso
  cfgSubtitle: "acesso",
  cfgLoginEyebrow: "acesso",
  cfgLoginEmailLabel: "acesso",
  cfgLoginEmailPlaceholder: "acesso",
  cfgLoginPasswordLabel: "acesso",
  cfgLoginPasswordPlaceholder: "acesso",
  cfgLoginButtonText: "acesso",
  cfgPasswordResetMessage: "acesso",
  cfgGoogleEnabled: "acesso",
  cfgGoogleButtonText: "acesso",
  cfgGoogleDomainHint: "acesso",
  cfgGoogleAllowedDomains: "acesso",
  cfgAccessGreeting: "acesso",
  cfgAccessInstruction: "acesso",

  // Aparência
  cfgAccessBackgroundPreview: "aparencia",
  cfgAccessLogoUrl: "aparencia",
  cfgAccessPanelColor: "aparencia",
  cfgAccessTextoModo: "aparencia",
  cfgLoginLogo: "aparencia",
  cfgLoginBg: "aparencia",
  cfgSidebarLogoUrl: "aparencia",
  cfgSidebarBackgroundColor: "aparencia",

  // Recursos
  cfgRealtimeEnabled: "recursos",

  // Operação
  cfgMonitId: "operacao",
  cfgCogipVersao: "operacao",
  cfgAppVersionCurrent: "operacao",
  cfgAccessHeartbeatMinutos: "operacao",
  cfgCnesJson: "operacao",
});

/* Blocos inteiros que não são campos de formulário, e a seção que os recebe. */
export const SECAO_POR_BLOCO = Object.freeze({
  panelAdmin: "recursos",
  cnesImportResumo: "operacao",
  accessRequestsAdminCard: "acessos",
  accessMonitorCard: "acessos",
});

export const SECAO_PADRAO = "operacao";

export function secaoDoCampo(id) {
  return SECAO_POR_CAMPO[id] || SECAO_PADRAO;
}

const escapar = (valor) =>
  String(valor ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function criarCartaoDaSecao(documento, secao) {
  const artigo = documento.createElement("article");
  artigo.className = "config-secao";
  artigo.dataset.secao = secao.id;
  artigo.innerHTML =
    `<header class="config-secao__cabecalho">` +
    `<span class="config-secao__icone"><i class="fa-solid ${escapar(secao.icone)}" aria-hidden="true"></i></span>` +
    `<div><h3>${escapar(secao.rotulo)}</h3><p>${escapar(secao.descricao)}</p></div>` +
    `</header>` +
    `<div class="config-secao__corpo form-grid"></div>`;
  return artigo;
}

/*
  Move o que já existe para dentro das seções. A ordem original é preservada
  dentro de cada seção: os campos aparecem na sequência em que estavam.
*/
function distribuir(documento, corpos) {
  let movidos = 0;

  for (const [id, secao] of Object.entries(SECAO_POR_BLOCO)) {
    const bloco = documento.getElementById(id);
    const destino = corpos.get(secao);
    if (!bloco || !destino) continue;
    const caixa = bloco.closest(".card") || bloco;
    destino.appendChild(caixa);
    movidos += 1;
  }

  for (const campo of documento.querySelectorAll(
    '#page-config [id^="cfg"], #page-config [id^="prev"]',
  )) {
    const linha = campo.closest(".form-row");
    if (!linha || linha.dataset.secaoAplicada === "1") continue;
    const destino = corpos.get(secaoDoCampo(campo.id));
    if (!destino) continue;
    linha.dataset.secaoAplicada = "1";
    destino.appendChild(linha);
    movidos += 1;
  }

  return movidos;
}

function selecionarSubgrupo(documento, secao) {
  const pagina = documento.getElementById("page-config");
  if (!pagina) return;
  pagina.dataset.subgrupo = secao;
  for (const artigo of pagina.querySelectorAll(".config-secao")) {
    artigo.hidden = artigo.dataset.secao !== secao;
  }
}

/*
  As seções são as páginas da área Administração do menu lateral
  (`src/lib/menu-lateral.js`). O menu navega até Configurações e chama esta
  função com a seção escolhida; quem marca o item ativo é o próprio menu.
*/
export function secaoAtualDeConfiguracao(documento = globalThis.document) {
  return (
    documento?.getElementById?.("page-config")?.dataset.subgrupo || SECOES[0].id
  );
}

export function abrirSecaoDeConfiguracao(documento, secao) {
  if (!SECOES.some((s) => s.id === secao)) return false;
  selecionarSubgrupo(documento, secao);
  if (secao === "acessos") {
    void documento.defaultView?.loadAccessManagement?.();
  }
  return true;
}

export function organizarConfiguracoesEmSecoes(
  documento = globalThis.document,
) {
  const pagina = documento?.getElementById?.("page-config");
  if (!pagina || pagina.dataset.secoesAplicadas === "1") return false;

  const grade = pagina.querySelector(".admin-grid");
  if (!grade) return false;
  pagina.dataset.secoesAplicadas = "1";

  const layout = documento.createElement("div");
  layout.className = "config-layout";

  const painel = documento.createElement("div");
  painel.className = "config-painel";
  layout.appendChild(painel);

  const corpos = new Map();
  for (const secao of SECOES) {
    const artigo = criarCartaoDaSecao(documento, secao);
    painel.appendChild(artigo);
    corpos.set(secao.id, artigo.querySelector(".config-secao__corpo"));
  }

  grade.insertAdjacentElement("beforebegin", layout);
  const movidos = distribuir(documento, corpos);

  /*
    O que sobrou na grade antiga são títulos soltos e cards já esvaziados. A
    grade só sai da tela se de facto não restar conteúdo — nunca às cegas.
  */
  if (!grade.querySelector("input, select, textarea, button")) {
    grade.hidden = true;
  }

  selecionarSubgrupo(documento, pagina.dataset.subgrupo || "marca");
  return movidos > 0;
}

/*
  Um navegador só.

  `config-page-enhancements.js` já montava a sua própria barra: cinco abas
  (Tudo, Acessos, Sistema, Painéis, Técnico), um campo de busca e um contador
  de seções. Ao acrescentar o navegador do SIGAV eu não removi aquilo, e a
  página passou a ter dois filtros, duas buscas e dois contadores que se
  contradiziam — "1 seção disponível" no topo, "7 seções disponíveis" ao lado.
  Medido no navegador: 5 abas antigas, duas buscas, dois contadores.

  O filtro antigo classificava os `.admin-card` originais, que agora estão
  vazios e ocultos — por isso o "1". Ele não tem mais o que filtrar.

  O que fica da barra antiga: o cabeçalho, o indicador de alterações não salvas
  e o resumo de validação, que continuam sendo os únicos donos dessas
  informações. Sai apenas o que duplica o navegador novo.
*/
export function removerNavegadorAntigo(documento = globalThis.document) {
  const barra = documento?.getElementById?.("configWorkspaceToolbar");
  if (!barra) return false;

  let removidos = 0;
  for (const seletor of [
    ".config-workspace-tabs",
    ".config-search-wrap",
    "#configWorkspaceResultCount",
  ]) {
    const alvo = barra.querySelector(seletor);
    if (!alvo) continue;
    alvo.remove();
    removidos += 1;
  }
  return removidos > 0;
}
