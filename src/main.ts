import { hasSupabaseEnv } from "./lib/env";
// Antes de qualquer rede: pinta a tela de acesso com a marca da visita anterior.
import "./app/entrada/marca.ts";
import { installCsvBlobSecurityGuard } from "./lib/csv-security";
import { installSessionLifecycle } from "./lib/session-lifecycle";
import { installBackgroundResourceLifecycle } from "./lib/background-resource-lifecycle";
import { installFrontendPerformanceMonitor } from "./lib/frontend-performance-monitor";
import { installCspReportMonitor } from "./lib/csp-report-monitor";
import "./lib/chartjs-global.ts";
import "./styles/tokens.css";
import "./styles/icones-lucide.css";
import "./styles/visual-polish.css";
import "./styles/loading-experience.css";
import "./styles/mobile-app.css";
import "./styles/mobile-bottom-navigation.css";
import "./styles/mobile-table-cards.css";
import "./styles/connectivity-status.css";
import "./styles/google-profile-photo.css";
import "./styles/platform-shell.css";
import "./styles/map-base-layer-switcher.css";
import "./styles/indigenous-territories-layer.css";
import "./styles/nielsen-shell-ux.css";
import "./styles/post157-interface-tuning.css";
import "./styles/barra-lateral.css";
import "./styles/multi-select-busca.css";
import "./styles/carregamento.css";
import "./styles/manutencao.css";
import "./styles/saude-das-cargas.css";
// Componentes de src/ui/ e, depois, o CSS dos módulos que aparecem fora da própria tela. O CSS
// de uma tela sob demanda (Entrevistas, Recursos, Classificação, Avaliação documental, Convocação
// e carta) entra pelo ponto de entrada dela e baixa junto com o código.
import "./ui/ui.css";
import "./app/entrada/solicitacao-de-acesso.css";
import "./modulos/configuracoes/configuracoes.css";
import "./modulos/acessos/acessos.css";
import "./modulos/modulos/modulos.css";
import "./modulos/automacao/automacao.css";
import "./modulos/editais/editais.css";
import "./modulos/cronograma/cronograma.css";
import "./modulos/aprovados/aprovados.css";
import "./modulos/selecao/selecao.css";
import "./modulos/conferencias/conferencias.css";
import "./modulos/visao-geral/visao-geral.css";
import "./modulos/aya/aya.css";
import "./modulos/aya/tour/tour.css";
import "./modulos/mapa-saude-indigena/mapa-saude-indigena.css";
import "./modulos/mapa-de-projetos/mapa-de-projetos.css";
import { installLeafletMapGuard } from "./modules/map-guard.ts";
import { installMapBaseLayerSwitcher } from "./modules/map-base-layer-switcher.js";
import { installMapZoomRange } from "./modules/map-zoom-range.ts";
import { installIndigenousTerritoriesLayer } from "./modules/indigenous-territories-layer.js";
import { montarCasca } from "./app/casca/casca.tsx";
// O sistema depois de entrar (navegação, carga, presença, moldura): src/app/sistema.ts.
import { ligarSistema, recarregarPaineisExternos } from "./app/sistema.ts";
import { initLoadingExperience } from "./modules/loading-experience.js";
import { instalarCarregamento } from "./app/carregamento.ts";
import { initVisualPolish } from "./modules/visual-polish.js";
import { initSidebarBranding } from "./modules/sidebar-branding.js";
import {
  organizarConfiguracoesEmSecoes,
  SECOES,
} from "./modulos/configuracoes/secoes.ts";
import { montarConfiguracoes } from "./modulos/configuracoes/configuracoes.tsx";
import { initMobileAppExperience } from "./modules/mobile-app-experience.js";
import { initMobileBottomNavigation } from "./modules/mobile-bottom-navigation.js";
import { initMobileTableCards } from "./modules/mobile-table-cards.js";
import { initPwaLifecycle } from "./modules/pwa-lifecycle.ts";
import { initConnectivityStatus } from "./modules/connectivity-status.js";
import { initGoogleProfilePhoto } from "./modules/google-profile-photo.ts";
import { initNielsenShellUx } from "./modules/nielsen-shell-ux.js";
import { montarBarraLateral } from "./componentes/barra-lateral/barra-lateral.tsx";
import { montarNucleo } from "./modulos/editais/nucleo.tsx";
import { montarVisaoGeral } from "./modulos/visao-geral/visao-geral.tsx";
import { situacaoDoSistema } from "./modules/situacao-dos-modulos.ts";
import { montarBuscaGlobal } from "./componentes/busca-global/busca-global.tsx";
import { montarEntrada } from "./app/entrada/entrada.tsx";
import { telaSobDemanda } from "./app/tela-sob-demanda.ts";
import { TELAS_REACT } from "./app/navegacao.ts";
import { registrarPreCarga } from "./lib/carga-de-telas";
import { sessaoDoApp } from "./app/sessao.ts";

import { montarAya } from "./modulos/aya/aya.tsx";
import type { avisar, mostrarCarregamento } from "./app/avisos.ts";
import type { TelaSobDemanda } from "./app/tela-sob-demanda.ts";
import type { montarCalendarioEditais } from "./modulos/cronograma/calendario-editais.tsx";
import type {
  montarAnaliseDeRecursos,
  montarRecursos,
} from "./modulos/recursos/recursos.tsx";
import type { montarEntrevistas } from "./modulos/entrevistas/entrevistas.tsx";
import type { montarConducaoDeEntrevistas } from "./modulos/entrevistas/conduzir.tsx";
import type { montarAnalises } from "./modulos/analises/analises.tsx";
import type { montarSelecao } from "./modulos/selecao/selecao.tsx";
import type { montarClassificacao } from "./modulos/classificacao/classificacao.tsx";
import type { montarAvaliacaoDocumental } from "./modulos/avaliacao-documental/avaliacao-documental.tsx";
import type { montarAcessos } from "./modulos/acessos/acessos.tsx";
import type { montarModulos } from "./modulos/modulos/modulos.tsx";
import type { montarSaudeDasCargas } from "./componentes/saude-das-cargas/saude-das-cargas.tsx";
import type { montarAutomacao } from "./modulos/automacao/automacao.tsx";

/** O controlador de uma tela sob demanda, a partir da função que a monta. */
type SobDemanda<F extends (...argumentos: never[]) => unknown> = TelaSobDemanda<
  NonNullable<ReturnType<F>>
>;

/*
  Os controladores e avisos que este arquivo e src/app/sistema.ts publicam em
  window (contrato com o legado, a navegação e o index.html).
*/
declare global {
  interface Window {
    monitoraToast?: typeof avisar;
    monitoraLoader?: typeof mostrarCarregamento;
    visaoGeralController?: ReturnType<typeof montarVisaoGeral>;
    calendarioEditaisController?: SobDemanda<typeof montarCalendarioEditais>;
    recursosController?: SobDemanda<typeof montarRecursos>;
    analisarRecursosController?: SobDemanda<typeof montarAnaliseDeRecursos>;
    entrevistasController?: SobDemanda<typeof montarEntrevistas>;
    conduzirEntrevistasController?: SobDemanda<
      typeof montarConducaoDeEntrevistas
    >;
    analisesController?: SobDemanda<typeof montarAnalises>;
    selecaoController?: SobDemanda<typeof montarSelecao>;
    classificacaoController?: SobDemanda<typeof montarClassificacao>;
    avaliacaoDocumentalController?: SobDemanda<
      typeof montarAvaliacaoDocumental
    >;
    acessosController?: SobDemanda<typeof montarAcessos>;
    modulosController?: SobDemanda<typeof montarModulos>;
    saudeDasCargasController?: SobDemanda<typeof montarSaudeDasCargas>;
    automacaoController?: SobDemanda<typeof montarAutomacao>;
  }
}

// Os imports de CSS acima já rodaram: a tela de acesso pode aparecer (index.html, `vite-dev-carregando`).
document.documentElement.classList.remove("vite-dev-carregando");

/*
  A casca do app (src/app/casca/: barra lateral, cabeçalho e as áreas das
  telas) desenha primeiro, na hora: o sistema, as ilhas React e o legado
  abaixo a encontram no DOM pelos ids de sempre.
*/
montarCasca();

/*
  O sistema se liga à sessão antes de tudo: tema e barra guardados, as funções
  em window (monitoraToast, navigate…) que as telas abaixo recebem e os ganchos
  da entrada.
*/
ligarSistema();

/*
  A tela de acesso (React, src/app/entrada/) monta primeiro: o cartão vazio do
  index.html vira o de verdade. Quem entra é a sessão (src/app/sessao.ts),
  iniciada no fim, depois de o legado e as telas se ligarem a ela.
*/
montarEntrada();

installCsvBlobSecurityGuard();
installLeafletMapGuard();
installMapBaseLayerSwitcher();
installMapZoomRange();
installIndigenousTerritoriesLayer();
installSessionLifecycle({
  aoExpirar: (mensagem) => sessaoDoApp.mostrarMensagem(mensagem, "warn"),
});
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
/*
  A barra lateral é React e monta primeiro, de forma síncrona: o branding, o
  legado e o menu do celular a encontram no DOM quando rodam.
*/
montarBarraLateral();
/*
  A Visão geral (React, src/modulos/visao-geral/, com os mapas da Saúde
  Indígena e de Projetos) também monta já, de forma síncrona. O legado fala
  com ela pelo estado (estado.js), não pelo DOM.
*/
window.visaoGeralController = montarVisaoGeral({
  toast: window.monitoraToast,
  comemoracoesLigadas: () => situacaoDoSistema().comemoracoes === true,
});
instalarCarregamento();
initLoadingExperience();
initVisualPolish();
// A logo e a cor gravadas da barra lateral (a escolha é de Configurações › Aparência).
initSidebarBranding();
// O esqueleto das seções de Configurações, depois a moldura e as seções em React (portais).
organizarConfiguracoesEmSecoes();
montarConfiguracoes();
initMobileAppExperience();
initMobileBottomNavigation();
initMobileTableCards();
initPwaLifecycle();
initConnectivityStatus();
initGoogleProfilePhoto();
initNielsenShellUx();

/*
  Núcleo, Lista de Aprovados e Calendário são React e montam nas próprias
  <section>. O legado as abre por estes controladores (`render()` ao navegar e
  `openImportModal` no Núcleo), nunca pelo DOM delas.
*/
window.nucleoController = montarNucleo({
  toast: window.monitoraToast,
  loader: window.monitoraLoader,
  getProfile: window.getMonitoraProfile,
});

/*
  Daqui para baixo, as telas que não abrem na entrada carregam sob demanda
  (src/app/tela-sob-demanda.ts): o código baixa na primeira abertura (ou ao
  passar o mouse no item do menu) e o controlador em window mantém o mesmo
  contrato (render(), abrirVisao()…). A Visão geral e o casco ficam no
  pacote principal.
*/
const comemoracoesLigadas = () => situacaoDoSistema().comemoracoes === true;

// Sem loader de tela cheia: skeleton na carga, e cada ação mostra o estado no botão.
// `openImportModal` está em `metodos`: existe antes da carga (o tipo de window é o do Núcleo).
window.aprovadosController = telaSobDemanda({
  secao: "page-approved",
  metodos: ["render", "openImportModal"],
  carregar: () =>
    import("./modulos/aprovados/lista-aprovados.tsx").then((m) =>
      m.montarListaAprovados({
        toast: window.monitoraToast,
        getProfile: window.getMonitoraProfile,
      }),
    ),
}) as NonNullable<Window["aprovadosController"]>;

// Sem loader de tela cheia: a grade mostra "Carregando…" por conta própria.
window.calendarioEditaisController = telaSobDemanda({
  secao: "page-calendario",
  carregar: () =>
    import("./modulos/cronograma/calendario-editais.tsx").then((m) =>
      m.montarCalendarioEditais({ toast: window.monitoraToast }),
    ),
});

/*
  Recursos dos candidatos, em duas entradas do menu (src/modulos/recursos/):
  o Painel de recursos (acompanhar, só leitura) e Analisar recursos (fazer),
  cada um na própria <section> e com o próprio estado. A área é a atual do
  app; `render()` recarrega a cada abertura (permissões do banco e
  comemorações relidas), então o que se decide em Analisar aparece no painel
  ao voltar.
*/
window.recursosController = telaSobDemanda({
  secao: "page-recursos",
  carregar: () =>
    import("./modulos/recursos/recursos.tsx").then((m) =>
      m.montarRecursos({ toast: window.monitoraToast, comemoracoesLigadas }),
    ),
});
window.analisarRecursosController = telaSobDemanda({
  secao: "page-analisar-recursos",
  carregar: () =>
    import("./modulos/recursos/recursos.tsx").then((m) =>
      m.montarAnaliseDeRecursos({
        toast: window.monitoraToast,
        comemoracoesLigadas,
      }),
    ),
});

/*
  Entrevistas, em duas entradas do menu (src/modulos/entrevistas/): o Painel
  de entrevistas (acompanhar) e Conduzir entrevistas (fazer), cada um na
  própria <section>, como Recursos (área do app, render() a cada abertura,
  comemorações relidas). Gravar notas ou convocar em Conduzir relê o painel;
  as entrevistas do painel, quando já lidas, marcam "com entrevistas" na
  lista de editais de Conduzir.
*/
window.entrevistasController = telaSobDemanda({
  secao: "page-entrevistas",
  metodos: ["render", "abrirVisao"],
  carregar: () =>
    import("./modulos/entrevistas/entrevistas.tsx").then((m) =>
      m.montarEntrevistas({ toast: window.monitoraToast, comemoracoesLigadas }),
    ),
});
window.conduzirEntrevistasController = telaSobDemanda({
  secao: "page-conduzir-entrevistas",
  metodos: ["render", "abrirVisao", "abrirEdital"],
  carregar: () =>
    import("./modulos/entrevistas/conduzir.tsx").then((m) =>
      m.montarConducaoDeEntrevistas({
        toast: window.monitoraToast,
        comemoracoesLigadas,
        aoMudarResultados: () => {
          const painel = window.entrevistasController?.estado;
          if (painel?.obter().area) void painel.carregar();
        },
        doPainel: () =>
          window.entrevistasController?.estado?.obter().dados?.entrevistas ||
          [],
      }),
    ),
});

/*
  Análises curriculares: módulo de src/modulos/, na própria <section>. A área
  é a atual do app; `render()` carrega na primeira abertura (e relê por trás
  se a carga tiver mais de 5 minutos).
*/
window.analisesController = telaSobDemanda({
  secao: "page-analises",
  metodos: ["render", "abrirVisao"],
  carregar: () =>
    import("./modulos/analises/analises.tsx").then((m) =>
      m.montarAnalises({ toast: window.monitoraToast, comemoracoesLigadas }),
    ),
});

/*
  Seleção: módulo de src/modulos/, na própria <section>, como Recursos e
  Entrevistas (área do app, render() a cada abertura). Só leitura.
*/
window.selecaoController = telaSobDemanda({
  secao: "page-selecao",
  metodos: ["render", "abrirVisao"],
  carregar: () =>
    import("./modulos/selecao/selecao.tsx").then((m) =>
      m.montarSelecao({ toast: window.monitoraToast }),
    ),
});

/*
  Classificação: módulo de src/modulos/, na própria <section> (área do app,
  render() a cada abertura). A regra é de cada edital; a conta, do motor puro
  (src/lib/classificacao/).
*/
window.classificacaoController = telaSobDemanda({
  secao: "page-classificacao",
  metodos: ["render", "abrirVisao"],
  carregar: () =>
    import("./modulos/classificacao/classificacao.tsx").then((m) =>
      m.montarClassificacao({ toast: window.monitoraToast }),
    ),
});

/*
  Avaliação documental: módulo de src/modulos/, na própria <section> (área do
  app, render() a cada abertura). A regra é de cada edital; a conta da prévia,
  da lib pura (src/lib/avaliacao-documental/).
*/
window.avaliacaoDocumentalController = telaSobDemanda({
  secao: "page-avaliacao-documental",
  metodos: ["render", "abrirVisao"],
  carregar: () =>
    import("./modulos/avaliacao-documental/avaliacao-documental.tsx").then(
      (m) =>
        m.montarAvaliacaoDocumental({
          toast: window.monitoraToast,
          getProfile: window.getMonitoraProfile,
        }),
    ),
});

// Configurações › Acessos: abre pela seção (configuracoes/secoes.ts → render()).
window.acessosController = telaSobDemanda({
  secao: "acessosApp",
  padroes: { confirmarSaida: () => true },
  carregar: () =>
    import("./modulos/acessos/acessos.tsx").then((m) =>
      m.montarAcessos({
        toast: window.monitoraToast,
        getProfile: window.getMonitoraProfile,
        secoesDeConfiguracao: SECOES,
      }),
    ),
});

// Configurações › Módulos e abas (só admin global): abre pela seção (configuracoes/secoes.ts → render()).
window.modulosController = telaSobDemanda({
  secao: "modulosApp",
  padroes: { confirmarSaida: () => true },
  carregar: () =>
    import("./modulos/modulos/modulos.tsx").then((m) =>
      m.montarModulos({
        toast: window.monitoraToast,
        getProfile: window.getMonitoraProfile,
        aoSalvar: recarregarPaineisExternos,
      }),
    ),
});

// Configurações › Status das atualizações (só admin global): relê a cada abertura da seção.
window.saudeDasCargasController = telaSobDemanda({
  secao: "saudeDasCargasApp",
  padroes: { confirmarSaida: () => true },
  carregar: () =>
    import("./componentes/saude-das-cargas/saude-das-cargas.tsx").then((m) =>
      m.montarSaudeDasCargas({ getProfile: window.getMonitoraProfile }),
    ),
});

// Configurações › Automação (só admin global): relê a cada abertura da seção.
window.automacaoController = telaSobDemanda({
  secao: "automacaoApp",
  padroes: { confirmarSaida: () => true },
  carregar: () =>
    import("./modulos/automacao/automacao.tsx").then((m) =>
      m.montarAutomacao({
        toast: window.monitoraToast,
        getProfile: window.getMonitoraProfile,
      }),
    ),
});

// Mouse ou foco no item do menu: a tela começa a baixar antes do clique.
registrarPreCarga((view, secao) => {
  const daSecao = {
    acessos: window.acessosController,
    modulos: window.modulosController,
    cargas: window.saudeDasCargasController,
    automacao: window.automacaoController,
  }[secao ?? ""];
  const daTela = Object.hasOwn(TELAS_REACT, view)
    ? TELAS_REACT[view]!(() => "", window)[2]
    : null;
  // As telas de TELAS_REACT em window são sob demanda: têm `carregar()`.
  void Promise.resolve(
    (
      (daSecao ?? daTela) as { carregar?: () => unknown } | null | undefined
    )?.carregar?.(),
  ).catch(() => {});
});

/*
  Busca global (Ctrl+K / Cmd+K): só abre com usuário conectado. A escolha vai
  ao legado por evento (filtros e navegação continuam lá).
*/
montarBuscaGlobal({
  estaConectado: () => Boolean(sessaoDoApp.obter().usuario),
});

// A entrada: sessão guardada, retorno do Google ou a tela de acesso.
void sessaoDoApp.iniciar();

/*
  A Aya (src/modulos/aya/): a arara flutuante e o painel de conversa. Sabe a
  página pelo estado que o legado atualiza a cada navegação (setPageTitle →
  definirPaginaDaAya) e a área pelo estado do monitoramento.
*/
montarAya();

if (!hasSupabaseEnv()) {
  console.warn(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.",
  );
}
