import { EVENTO_ESCOLHA_DA_BUSCA } from "../lib/busca-global.ts";
import { codigoDoPainel } from "../lib/navegacao.js";
import { apagarCacheDePayload } from "../modules/cache-de-payload-indexeddb.js";
import { comemorarAcessoLiberado } from "../modules/comemoracao-do-acesso.js";
import {
  esquecerSituacaoDoSistema,
  situacaoDoSistema,
} from "../modules/situacao-dos-modulos.js";
import { esconderEsqueleto, mostrarEsqueleto } from "./carregamento.js";
import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.ts";
import { montarPessoasOnline } from "../componentes/pessoas-online/pessoas-online.jsx";
import { montarAvisoDeVersao } from "../componentes/aviso-de-versao/aviso-de-versao.tsx";
import { criarEstadoDoEncerramento } from "../modulos/encerramento-do-edital/estado.ts";
import { montarEncerramentoDoEdital } from "../modulos/encerramento-do-edital/encerramento-do-edital.tsx";
import { montarSelosDoEdital } from "../modulos/encerramento-do-edital/selos-do-edital.tsx";
import { criarAvisoDeVersao } from "./aviso-de-versao.ts";
import { avisar, mostrarCarregamento } from "./avisos.js";
import { criarCarga } from "./carga.js";
import { configuracaoDoApp as configuracao } from "./configuracao.js";
import { criarMoldura } from "./moldura.js";
import { confirmarSaidaPadrao, criarNavegacao } from "./navegacao.js";
import { criarPaineisExternos } from "./paineis-externos.js";
import { criarPerfil } from "./perfil.js";
import { criarPresenca } from "./presenca.js";
import { criarVigiaDoCatalogo } from "./vigia-do-catalogo.ts";
import { instalarMarcosDosEditais } from "./marcos-personalizados.js";
import { acompanharPaginaAberta } from "./pagina-aberta.ts";
import { sessaoDoApp } from "./sessao.js";

/*
  O sistema depois de entrar: liga as peças do app à sessão (src/app/sessao.js)
  — no lugar do antigo src/modules/legacy-app.js.

    perfil.js            quem entrou (cópia da sessão) e o #appScreen
    configuracao.js      TB_CONFIGURACAO e os textos do app
    paineis-externos.js  painéis externos (lista, liberados, quadro)
    navegacao.js         troca de tela, menu, título, permissões
    carga.js             carga dos dados, cópia da sessão, Realtime
    pagina-aberta.ts     a página aberta pede as linhas e abre a Visão geral
    aviso-de-versao.ts   versão nova publicada: aviso no topo, sem recarregar à força
    encerramento-do-edital/  tela de fim de edital e selos no perfil (src/modulos/)
    presenca.js          auditoria, heartbeat e Pessoas online
    vigia-do-catalogo.ts página desligada pela coordenação fecha sem recarregar
    moldura.js           barra recolhida, tema, tela cheia, PDF

  Os ganchos de `sessaoDoApp.ligarSistema` são o contrato com a sessão
  (docs/arquitetura-react.md, "Sessão ↔ sistema"). As funções em `window` são
  os contratos de quem ainda chama por elas: os `onclick` do index.html, a
  barra lateral, a Aya e as telas montadas em src/main.js.
*/

export const perfil = criarPerfil();

export const paineis = criarPaineisExternos({
  obterPerfil: perfil.obterPerfil,
  configuracao: configuracao.valor,
  aoTentarDeNovo: () => recarregarPainel(),
});

export const moldura = criarMoldura({
  // O painel externo aberto vai sozinho para a tela cheia.
  alvoDaTelaCheia: () => {
    const painel = paineis.atual();
    if (!painel || !codigoDoPainel(navegacao.obter().view)) return null;
    return document.querySelector(
      `#external-panel-${painel.codigo} .external-frame`,
    );
  },
});

export const navegacao = criarNavegacao({
  obterPerfil: perfil.obterPerfil,
  paineis,
  configuracao: configuracao.valor,
  avisar,
  ajustarBarra: moldura.ajustarBarra,
});

export const carga = criarCarga({
  configuracao,
  paineis,
  navegacao,
  obterPerfil: perfil.obterPerfil,
  obterUsuario: perfil.obterUsuario,
  mostrarApp: perfil.mostrarApp,
  comemorar: () =>
    comemorarAcessoLiberado({
      usuario: perfil.obterUsuario(),
      perfil: perfil.obterPerfil(),
      ligadas: situacaoDoSistema().comemoracoes,
    }),
});

/* A versão do catálogo de abas vem de carona na presença (sem chamada nova). */
export const vigiaDoCatalogo = criarVigiaDoCatalogo({ navegacao });

export const presenca = criarPresenca({
  obterUsuario: perfil.obterUsuario,
  obterPerfil: perfil.obterPerfil,
  configuracao,
  navegacao,
  aoRegistrar: vigiaDoCatalogo.aoRegistrarPresenca,
});

/* Versão nova publicada (/versao.json, sem banco): aviso no topo; a pessoa decide. */
export const avisoDeVersao = criarAvisoDeVersao({
  confirmarSaida: () => confirmarSaidaPadrao(window),
});

const viewAtual = () => navegacao.obter().view;

/* Edital encerrado: a tela (uma vez por pessoa) e os selos do perfil. */
export const encerramento = criarEstadoDoEncerramento({
  ligadas: () => situacaoDoSistema().comemoracoes,
});

/*
  Relê a lista de painéis externos e refaz o menu: Configurações › Módulos e
  abas grava ativo/manutenção dos painéis (src/main.js).
*/
export async function recarregarPaineisExternos() {
  await paineis.carregar();
  paineis.completarLiberados();
  navegacao.montarMenu();
}

/* Recarrega o painel externo aberto (botão do quadro e "Tentar de novo"). */
function recarregarPainel() {
  const painel = paineis.atual();
  if (!painel) return;
  paineis.descartar(painel.codigo);
  navegacao.irPara("panel:" + painel.codigo);
}

/* Sai do painel externo para a tela inicial do sistema (e da tela cheia, se estiver). */
function sairDoPainelExterno() {
  moldura.sairDaTelaCheia();
  document.body.classList.remove("external-clean", "external-panel-mode");
  paineis.esquecerAtual();
  navegacao.irPara(navegacao.telaInicialDoSistema());
}

/*
  Busca global (Ctrl+K, src/componentes/busca-global/): a linha escolhida fica
  à vista na Visão geral, que troca o recorte pela unidade e pelo edital dela
  (sem DSEI aberto) e destaca a linha.
*/
export function localizarLinhaDoMonitoramento(id) {
  const linha = carga.linhas().find((item) => String(item.id) === String(id));
  if (!linha) return;
  if (!perfil.pode("ind")) {
    avisar(
      "Busca localizada, mas seu perfil não tem acesso ao dashboard de Saúde Indígena.",
      "warn",
    );
    return;
  }
  navegacao.irPara("dashboard");
  estadoDaVisaoGeral.localizar(linha);
}

// ── Ganchos da sessão ───────────────────────────────────────────────────

/*
  A pessoa saiu (ou a sessão acabou, ou saiu em outra aba): nada dela fica na
  tela. `carga.esquecer` também fecha o Realtime e tira as linhas do store.
*/
function limparEstadoDeslogado() {
  carga.esquecer();
  encerramento.esquecer();
  presenca.pararTudo();
  vigiaDoCatalogo.esquecer();
  paineis.limpar();
  esquecerSituacaoDoSistema(document);
  esconderEsqueleto();
  perfil.esconderApp();
}

/* Fim da espera da entrada, aconteça o que acontecer: sem skeleton. */
function encerrarEspera() {
  esconderEsqueleto();
  document.body.classList.remove("config-loading");
}

/*
  Sessão válida, perfil ainda chegando: o skeleton da entrada (no formato da
  última tela) e a leitura local da cópia da sessão, que corre junto com a
  consulta do perfil.
*/
function prepararEntrada() {
  mostrarEsqueleto(navegacao.telaGuardada());
  carga.prepararEntrada();
}

/* Perfil confirmado: carrega e abre o sistema. `true` = aberto. */
async function abrirSistema({ origem }) {
  perfil.mostrarNaBarra();
  const pronto = await carga.carregarEntrada();
  if (!pronto) return false;
  // Sem esperar: a tela já abriu (a sessão esconde a de acesso ao voltar daqui).
  void presenca.registrarEvento(
    origem === "boot" ? "sessao_restaurada" : "login_google",
    { tela: origem },
  );
  presenca.iniciarHeartbeat();
  presenca.iniciar();
  carga.iniciarRealtime();
  void encerramento.verificar();
  return true;
}

/*
  Sem acesso, ou acesso revogado: nada desta pessoa fica no navegador, e nada
  dela continua batendo no banco (heartbeat e Pessoas online param juntos).
*/
function fecharSistema() {
  carga.esquecer();
  encerramento.esquecer();
  presenca.pararTudo();
  vigiaDoCatalogo.esquecer();
  encerrarEspera();
  perfil.esconderApp();
}

function ficarSemAcesso() {
  fecharSistema();
  void carga.apagarCopia();
}

/* O perfil mudou com o sistema aberto (USER_UPDATED). */
async function atualizarPerfilAberto() {
  perfil.mostrarNaBarra();
  paineis.completarLiberados();
  navegacao.montarMenu();
  if (!navegacao.telaPermitida(viewAtual()))
    navegacao.irPara(navegacao.telaDeEntrada());
}

/*
  Antes do `signOut()` do botão Sair: auditoria e Realtime. A cópia da sessão
  fica (entrar de novo é imediato); a do painel de análises, com nomes e notas
  de candidatos, sai com a pessoa.
*/
async function antesDeSair() {
  await presenca.registrarEvento("logout", {
    detalhes: { current_view: viewAtual() },
  });
  carga.pararRealtime();
  await apagarCacheDePayload();
}

/** Liga tudo (uma vez, importado por src/main.js antes de montar as telas). */
export function ligarSistema() {
  moldura.aplicarTemaGuardado();
  moldura.ajustarBarra();
  moldura.aplicarBarraGuardada();
  moldura.marcarTelaCheia();
  moldura.acompanharLargura();
  moldura.acompanharTemaDeOutraAba();
  moldura.acompanharTelaCheia();

  Object.assign(window, {
    getMonitoraProfile: perfil.obterPerfil,
    getMonitoraUser: perfil.obterUsuario,
    monitoraToast: avisar,
    monitoraLoader: mostrarCarregamento,
    exitExternalPanel: sairDoPainelExterno,
    exportPDF: moldura.exportarPdf,
    navigate: navegacao.irPara,
    refreshData: carga.atualizarDados,
    reloadExternal: recarregarPainel,
    toggleBrowserFullscreen: moldura.alternarTelaCheia,
    toggleDarkMode: moldura.alternarTema,
    toggleSidebar: moldura.alternarBarra,
  });

  perfil.aoMudarPerfil((sessao) => paineis.definirLiberados(sessao.painelIds));
  perfil.acompanharSessao();
  // "Edital chegou a N contratados" (Configurações › Comemorações), a cada carga.
  instalarMarcosDosEditais({
    obterUsuario: perfil.obterUsuario,
    ligadas: () => situacaoDoSistema().comemoracoes,
  });
  configuracao.acompanharFundoDoAcesso();
  navegacao.acompanharArea();
  // Linhas do monitoramento e acompanhamento da Visão geral, só para a página que os usa.
  acompanharPaginaAberta({ navegacao });
  presenca.acompanhar();
  montarPessoasOnline({ presenca });
  montarAvisoDeVersao({ aviso: avisoDeVersao });
  montarEncerramentoDoEdital({ estado: encerramento });
  montarSelosDoEdital({ estado: encerramento });
  encerramento.acompanhar();
  avisoDeVersao.iniciar();

  document.addEventListener(EVENTO_ESCOLHA_DA_BUSCA, (evento) =>
    localizarLinhaDoMonitoramento(evento.detail?.id),
  );
  window.addEventListener("agsus:background-suspend", () => {
    presenca.pararHeartbeat();
    carga.pararRealtime();
  });
  // A batida da presença pausa e retoma sozinha com a aba (presenca.acompanhar).
  window.addEventListener("agsus:background-resume", () => {
    if (!perfil.obterUsuario()?.id) return;
    presenca.iniciarHeartbeat();
    carga.iniciarRealtime();
  });

  // A entrada é da sessão do app (src/main.js chama sessaoDoApp.iniciar()).
  sessaoDoApp.ligarSistema({
    carregarConfiguracao: () => configuracao.carregar({ silent: true }),
    mostrarEsqueleto: () => mostrarEsqueleto(navegacao.telaGuardada()),
    aoVerificar: prepararEntrada,
    abrir: abrirSistema,
    aoFicarSemAcesso: ficarSemAcesso,
    // Perfil ilegível (falha passageira): fecha, mas a cópia da sessão fica.
    aoFalharNaEntrada: fecharSistema,
    aoAtualizarPerfil: atualizarPerfilAberto,
    antesDeSair,
    aoSair: limparEstadoDeslogado,
    aoLimparSessao: () => carga.apagarCopia(),
    encerrarEspera,
  });
}
