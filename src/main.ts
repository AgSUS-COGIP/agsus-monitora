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
import "./styles/mobile-table-cards.css";
import "./styles/connectivity-status.css";
import "./styles/google-profile-photo.css";
import "./styles/platform-shell.css";
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
import { montarRaiz } from "./app/raiz.tsx";
// O sistema depois de entrar (navegação, carga, presença, moldura): src/app/sistema.ts.
import {
  avisoDeVersao,
  encerramento,
  ligarSistema,
  navegacao,
  presenca,
  recarregarPaineisExternos,
} from "./app/sistema.ts";
import { instalarCarregamento } from "./app/carregamento.ts";
import {
  EVENTO_SECAO_ABERTA,
  organizarConfiguracoesEmSecoes,
  SECOES,
} from "./modulos/configuracoes/secoes.ts";
import { importarComRecarga } from "./lib/importar-com-recarga";
import { initPwaLifecycle } from "./modules/pwa-lifecycle.ts";
import { initGoogleProfilePhoto } from "./modules/google-profile-photo.ts";
import { aplicarMarcaDaBarraLateral } from "./componentes/barra-lateral/marca.ts";
import { ligarEntradaAPagina } from "./app/entrada/entrada.tsx";
import { marcaDaEntrada } from "./app/entrada/marca.ts";
import { criarPedidoDeAcesso } from "./app/entrada/pedido-de-acesso.ts";
import { telaSobDemanda } from "./app/tela-sob-demanda.ts";
import { preCarregarTelaRegistrada } from "./app/registro-das-telas.ts";
import { registrarPreCarga } from "./lib/carga-de-telas";
import { FASES, sessaoDoApp } from "./app/sessao.ts";

import type { avisar, mostrarCarregamento } from "./app/avisos.ts";
import type { TelaSobDemanda } from "./app/tela-sob-demanda.ts";
import type { montarAcessos } from "./modulos/acessos/acessos.tsx";
import type { montarModulos } from "./modulos/modulos/modulos.tsx";
import type { montarSaudeDasCargas } from "./componentes/saude-das-cargas/saude-das-cargas.tsx";
import type { montarAutomacao } from "./modulos/automacao/automacao.tsx";

/** O controlador de uma seção sob demanda, a partir da função que a monta. */
type SobDemanda<F extends (...argumentos: never[]) => unknown> = TelaSobDemanda<
  NonNullable<ReturnType<F>>
>;

/*
  Os controladores das seções de Configurações (passo 3 de
  docs/arquitetura/raiz-react.md: viram rotas filhas). As telas de página
  inteira não estão mais em window: são rotas (src/app/telas.tsx).
*/
declare global {
  interface Window {
    monitoraToast?: typeof avisar;
    monitoraLoader?: typeof mostrarCarregamento;
    acessosController?: SobDemanda<typeof montarAcessos>;
    modulosController?: SobDemanda<typeof montarModulos>;
    saudeDasCargasController?: SobDemanda<typeof montarSaudeDasCargas>;
    automacaoController?: SobDemanda<typeof montarAutomacao>;
  }
}

// Os imports de CSS acima já rodaram: a tela de acesso pode aparecer (index.html, `vite-dev-carregando`).
document.documentElement.classList.remove("vite-dev-carregando");

/*
  A raiz do app (src/app/raiz.tsx), o único `createRoot` das telas: os avisos
  por cima de tudo, a tela de acesso, a casca (barra lateral, cabeçalho e as
  telas, que são rotas) e a busca global. Desenha na hora: o sistema e o
  legado abaixo a encontram no DOM pelos ids de sempre.

  A Aya (src/modulos/aya/, com os tours ~110 kB) é filha da casca e só baixa
  quando a sessão abre o app (`appAberto`): a tela de acesso não a carrega.
*/
const FASES_COM_O_APP: ReadonlySet<string> = new Set([
  FASES.ABRINDO,
  FASES.CONECTADO,
]);
const pedidoDeAcesso = criarPedidoDeAcesso();
// A cor padrão da marca da barra vale desde já (a gravada chega com a configuração).
aplicarMarcaDaBarraLateral();
montarRaiz({
  navegacao,
  sessao: sessaoDoApp,
  marca: marcaDaEntrada,
  pedido: pedidoDeAcesso,
  pecas: {
    presenca,
    avisoDeVersao,
    encerramento,
    appAberto: {
      obter: () => FASES_COM_O_APP.has(sessaoDoApp.obter().fase),
      assinar: sessaoDoApp.assinar,
    },
    // Busca global (Ctrl+K / Cmd+K): só abre com usuário conectado.
    estaConectado: () => Boolean(sessaoDoApp.obter().usuario),
  },
});

/*
  O sistema se liga à sessão antes de tudo: tema e barra guardados, as funções
  em window (monitoraToast, navigate…) e os ganchos da entrada.
*/
ligarSistema();

/*
  A tela de acesso acompanha a fase da sessão (#loginScreen, pedido de
  acesso). Quem entra é a sessão (src/app/sessao.ts), iniciada no fim,
  depois de o legado e as telas se ligarem a ela.
*/
ligarEntradaAPagina({ sessao: sessaoDoApp, pedido: pedidoDeAcesso });

installCsvBlobSecurityGuard();
installSessionLifecycle({
  aoExpirar: (mensagem) => sessaoDoApp.mostrarMensagem(mensagem, "warn"),
});
installBackgroundResourceLifecycle();
installFrontendPerformanceMonitor();
installCspReportMonitor();
instalarCarregamento();
/*
  O esqueleto das seções de Configurações já; a moldura e as seções em React
  (portais, src/modulos/configuracoes/configuracoes.tsx) só para quem abre a
  página (quem administra): baixam na primeira seção aberta com a página
  ativa, ou antes, com o mouse em Configurações no menu.
*/
organizarConfiguracoesEmSecoes();
const baixarConfiguracoes = importarComRecarga(
  () => import("./modulos/configuracoes/configuracoes.tsx"),
);
let configuracoesPedidas: Promise<unknown> | null = null;
function carregarConfiguracoes() {
  configuracoesPedidas ??= baixarConfiguracoes()
    .then(({ montarConfiguracoes }) => montarConfiguracoes())
    .catch((erro: unknown) => {
      configuracoesPedidas = null;
      console.error("Falha ao abrir Configurações:", erro);
      window.monitoraToast?.(
        "Não foi possível abrir Configurações. Tente de novo.",
        "error",
      );
    });
  return configuracoesPedidas;
}
document.addEventListener(EVENTO_SECAO_ABERTA, () => {
  if (navegacao.obter().view === "config") void carregarConfiguracoes();
});
initPwaLifecycle();
initGoogleProfilePhoto();

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
  if (view === "config") void carregarConfiguracoes();
  const daSecao = {
    acessos: window.acessosController,
    modulos: window.modulosController,
    cargas: window.saudeDasCargasController,
    automacao: window.automacaoController,
  }[secao ?? ""];
  if (daSecao) void Promise.resolve(daSecao.carregar()).catch(() => {});
  // As telas de página inteira: o registro das rotas (src/app/registro-das-telas.ts).
  else preCarregarTelaRegistrada(view);
});

// A entrada: sessão guardada, retorno do Google ou a tela de acesso.
void sessaoDoApp.iniciar();

if (!hasSupabaseEnv()) {
  console.warn(
    "Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no Vercel.",
  );
}
