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

function htmlDoNavegador() {
  const itens = SECOES.map(
    (s) =>
      `<button type="button" class="config-nav__item" data-secao="${s.id}">` +
      `<i class="fa-solid ${escapar(s.icone)}" aria-hidden="true"></i>` +
      `<span>${escapar(s.rotulo)}</span></button>`,
  ).join("");

  return (
    `<nav class="config-nav" aria-label="Seções das configurações">` +
    `<label class="config-nav__busca">` +
    `<i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>` +
    `<input id="configBuscaSecao" type="search" placeholder="Buscar seção..." autocomplete="off" />` +
    `</label>` +
    `<div class="config-nav__lista">` +
    `<button type="button" class="config-nav__item is-active" data-secao="tudo">` +
    `<i class="fa-solid fa-table-cells-large" aria-hidden="true"></i><span>Tudo</span></button>` +
    itens +
    `</div>` +
    `<p class="config-nav__contagem" id="configContagemSecoes">${SECOES.length} seções disponíveis</p>` +
    `</nav>`
  );
}

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

function ligarFiltro(documento, raiz) {
  const busca = documento.getElementById("configBuscaSecao");
  const botoes = [...raiz.querySelectorAll(".config-nav__item")];
  const secoes = [...raiz.querySelectorAll(".config-secao")];
  const contagem = documento.getElementById("configContagemSecoes");

  let escolhida = "tudo";

  const aplicar = () => {
    const termo = (busca?.value || "").trim().toLowerCase();
    let visiveis = 0;

    for (const artigo of secoes) {
      const id = artigo.dataset.secao;
      const porSecao = escolhida === "tudo" || escolhida === id;
      const porTermo =
        !termo || artigo.textContent.toLowerCase().includes(termo);
      const mostrar = porSecao && porTermo;
      artigo.hidden = !mostrar;
      if (mostrar) visiveis += 1;
    }

    for (const botao of botoes) {
      botao.classList.toggle("is-active", botao.dataset.secao === escolhida);
    }

    if (contagem) {
      contagem.textContent =
        visiveis === 1
          ? "1 seção disponível"
          : `${visiveis} seções disponíveis`;
    }
  };

  for (const botao of botoes) {
    botao.addEventListener("click", () => {
      escolhida = botao.dataset.secao;
      aplicar();
    });
  }
  busca?.addEventListener("input", aplicar);
  aplicar();
  return aplicar;
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
  layout.innerHTML = htmlDoNavegador();

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

  ligarFiltro(documento, layout);
  return movidos > 0;
}
