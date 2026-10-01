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

/* Disparado a cada troca de seção, com { detail: { secao } }. */
export const EVENTO_SECAO_ABERTA = "agsus:secao-de-configuracao-aberta";

export const SECOES = Object.freeze([
  {
    id: "marca",
    rotulo: "Marca",
    icone: "fa-font",
    iconeDoMenu: "type",
    descricao: "Nomes, versão e identidade que aparecem em todo o sistema.",
  },
  {
    id: "inicio",
    rotulo: "Página inicial",
    icone: "fa-bullhorn",
    iconeDoMenu: "house",
    descricao: "Comunicado, títulos e rótulos do painel de monitoramento.",
  },
  {
    id: "acesso",
    rotulo: "Tela de acesso",
    icone: "fa-right-to-bracket",
    iconeDoMenu: "door-open",
    descricao: "Textos do login e regras de autenticação institucional.",
  },
  {
    id: "aparencia",
    rotulo: "Aparência",
    icone: "fa-image",
    iconeDoMenu: "image",
    descricao: "Arte de fundo, cores e logotipos. Cada cor mostra o contraste.",
  },
  {
    id: "recursos",
    rotulo: "Painéis externos",
    icone: "fa-tower-broadcast",
    iconeDoMenu: "monitor",
    descricao: "Os painéis externos do menu: título, endereço e situação.",
  },
  {
    id: "operacao",
    rotulo: "Operação",
    icone: "fa-sliders",
    iconeDoMenu: "sliders-horizontal",
    descricao: "Versão, atualização em tempo real e histórico de publicações.",
  },
  {
    id: "acessos",
    rotulo: "Acessos",
    icone: "fa-user-group",
    iconeDoMenu: "users",
    descricao: "Pessoas, grupos de permissões e coordenações.",
  },
  {
    id: "modulos",
    rotulo: "Módulos e abas",
    icone: "fa-layer-group",
    iconeDoMenu: "layers",
    descricao:
      "Ativar, desativar e pôr em manutenção o sistema, as áreas, as abas e os painéis; selo BETA.",
  },
  {
    id: "cargas",
    rotulo: "Status das atualizações",
    icone: "fa-clock",
    iconeDoMenu: "heart-pulse",
    descricao:
      "Se os dados de cada aba estão atualizados: quando rodou cada atualização, o que atrasou e o que falhou.",
  },
]);

/*
  Seções que salvam pela própria tela React, com motivo (Acessos e Módulos e
  abas): o "Salvar alterações" fixo das Configurações não vale nelas, e sair
  delas com alteração pendente pergunta antes (`confirmarSaida` do controlador).
*/
const CONTROLADOR_DA_SECAO = Object.freeze({
  acessos: "acessosController",
  modulos: "modulosController",
  cargas: "saudeDasCargasController",
});
const controladorDaSecao = (documento, secao) =>
  CONTROLADOR_DA_SECAO[secao]
    ? documento.defaultView?.[CONTROLADOR_DA_SECAO[secao]]
    : null;

/*
  Onde cada campo vai parar. Um campo sem entrada aqui cai em "Operação", que é
  o balde honesto: melhor aparecer numa seção discutível do que sumir da tela.
*/
export const SECAO_POR_CAMPO = Object.freeze({
  // Marca: em React (src/componentes/configuracoes/marca.jsx), sem campo aqui.

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

  // Painéis externos e Operação: em React (paineis-externos.jsx e operacao.jsx), sem campo aqui.
});

/* Blocos inteiros que não são campos de formulário, e a seção que os recebe. */
export const SECAO_POR_BLOCO = Object.freeze({
  acessosApp: "acessos",
  modulosApp: "modulos",
  saudeDasCargasApp: "cargas",
});

export const SECAO_PADRAO = "operacao";

export function secaoDoCampo(id) {
  return SECAO_POR_CAMPO[id] || SECAO_PADRAO;
}

/*
  O cabeçalho da seção (ícone, nome e descrição) é da moldura React
  (src/componentes/configuracoes/configuracoes.jsx), um só para a página.
*/
function criarCartaoDaSecao(documento, secao) {
  const artigo = documento.createElement("article");
  artigo.className = "config-secao";
  artigo.dataset.secao = secao.id;
  artigo.setAttribute("aria-label", secao.rotulo);
  const corpo = documento.createElement("div");
  corpo.className = "config-secao__corpo form-grid";
  artigo.appendChild(corpo);
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
  // A moldura React (cabeçalho e barra de salvar) e as prévias acompanham a seção aberta.
  const Evento = documento.defaultView?.CustomEvent || globalThis.CustomEvent;
  documento.dispatchEvent(
    new Evento(EVENTO_SECAO_ABERTA, { detail: { secao } }),
  );
}

const secoesPermitidas = (pagina) =>
  pagina?.dataset.secoesPermitidas
    ? pagina.dataset.secoesPermitidas.split(",")
    : SECOES.map((s) => s.id);

/*
  Seções que o perfil abre (buildNav, pelas regras de access-roles.js): o
  coordenador só vê Acessos; quem edita configurações sem gerenciar acessos,
  as demais. Se a seção aberta deixou de valer, abre a primeira permitida.
*/
export function definirSecoesPermitidas(documento, ids) {
  const pagina = documento?.getElementById?.("page-config");
  if (!pagina) return;
  pagina.dataset.secoesPermitidas = ids.join(",");
  if (ids.length && !ids.includes(pagina.dataset.subgrupo || SECOES[0].id))
    selecionarSubgrupo(documento, ids[0]);
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
  const pagina = documento?.getElementById?.("page-config");
  if (!secoesPermitidas(pagina).includes(secao)) return false;
  const atual = secaoAtualDeConfiguracao(documento);
  // Sair de Acessos (ou de Módulos e abas) com alteração não salva pergunta antes (o rascunho é da tela React).
  if (
    atual !== secao &&
    controladorDaSecao(documento, atual)?.confirmarSaida() === false
  )
    return false;
  selecionarSubgrupo(documento, secao);
  void controladorDaSecao(documento, secao)?.render();
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
