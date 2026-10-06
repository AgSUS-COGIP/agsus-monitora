import { aplicarAtualizacaoPendente } from "../modules/pwa-lifecycle.js";
import { aplicarManutencaoNaNavegacao } from "../modules/situacao-dos-modulos.js";
import { situacaoDoSistema } from "../modules/situacao-dos-modulos.js";
import { abasDoMenu } from "../modules/catalogo-de-abas.js";
import { filtrarAreasAtivas } from "../lib/situacao-dos-modulos.js";
import {
  areasDoUsuario,
  montarArvoreDoMenu,
  nomeDaArea,
} from "../lib/menu-lateral.js";
import {
  isAdminGlobal,
  paginasPermitidas,
  secaoDeConfiguracaoPermitida,
} from "../lib/access-roles.js";
import {
  CHAVE_DA_TELA_GUARDADA,
  TELA_SEM_ACESSO,
  bloqueioDaTela,
  codigoDoPainel,
  ehPainelExterno,
  telaDeEntrada,
  telaInicialDoSistema,
  telaPermitida,
} from "../lib/navegacao.js";
import { definirPaginaDaAba } from "../lib/identidade-da-aba.js";
import { cabecalhoDaVisaoGeral } from "../lib/visao-geral-da-area.js";
import { erroAmigavel } from "../lib/erro-amigavel.js";
import {
  assinarDadosDoMonitoramento,
  definirAreasDoUsuario,
  obterDadosDoMonitoramento,
} from "../componentes/dados-do-monitoramento.js";
import {
  atualizarMenuLateral,
  marcarItemAtivoNoMenu,
} from "../componentes/barra-lateral/estado.js";
import {
  abrirSecaoDeConfiguracao,
  definirSecoesPermitidas,
  SECOES,
  secaoAtualDeConfiguracao,
} from "../modulos/configuracoes/secoes.js";
import { estadoDasConfiguracoes } from "../modulos/configuracoes/estado.js";
import { definirPaginaDaAya } from "../modulos/aya/estado.js";

/*
  A navegação do app, sem React: qual tela está aberta, a troca de tela (a
  `.active` das `<section class="page">`, o título do cabeçalho, o menu
  marcado), as permissões por tela, a guarda de saída de Acessos, Módulos e
  abas e Configurações, a tela guardada para a próxima entrada e o menu da
  barra lateral que o perfil vê. As regras puras estão em src/lib/navegacao.js.

  Contratos mantidos: `window.navigate(view)` (é `irPara`), os itens
  `#nav [data-view][data-area]` da barra lateral (React, pelo estado dela) e o
  `render()` dos controladores em `window` (`recursosController`…) ao abrir a
  tela de cada um.

  Quem acompanha a navegação assina: `assinar(ouvinte)` recebe
  `{ tipo: "menu" }` a cada marcação do menu (o lugar da pessoa pode ter
  mudado) e `{ tipo: "abertura", view, anterior }` quando uma tela abriu
  (auditoria e presença, em src/app/presenca.js).
*/

/*
  Telas React de página inteira (montadas por src/main.js na própria
  `#page-<view>`): título, subtítulo (depois da área) e o controlador.
*/
export const TELAS_REACT = Object.freeze({
  nucleo: (valor, janela) => [
    "Editais",
    valor("nucleo_page_subtitle"),
    janela.nucleoController,
  ],
  calendario: (_valor, janela) => [
    "Cronograma",
    "Etapas dos editais, por data.",
    janela.calendarioEditaisController,
  ],
  approved: (_valor, janela) => [
    "Lista de Aprovados",
    "Candidatos por edital e situação de contratação.",
    janela.aprovadosController,
  ],
  recursos: (_valor, janela) => ["Recursos", "", janela.recursosController],
  entrevistas: (_valor, janela) => [
    "Entrevistas",
    "",
    janela.entrevistasController,
  ],
  classificacao: (_valor, janela) => [
    "Classificação",
    "",
    janela.classificacaoController,
  ],
  analises: (_valor, janela) => [
    "Painel das análises",
    "",
    janela.analisesController,
  ],
  "avaliacao-documental": (_valor, janela) => [
    "Avaliação documental",
    "",
    janela.avaliacaoDocumentalController,
  ],
  selecao: (_valor, janela) => ["Seleção", "", janela.selecaoController],
});

/* Sair com alteração não salva (Acessos, Módulos e abas ou campos de Configurações) pergunta antes. */
function confirmarSaidaPadrao(janela) {
  return (
    janela?.acessosController?.confirmarSaida() !== false &&
    janela?.modulosController?.confirmarSaida() !== false &&
    estadoDasConfiguracoes.confirmarSaida()
  );
}

const PAINEIS_VAZIOS = Object.freeze({
  podeAbrir: () => false,
  primeiro: () => null,
  doMenu: () => [],
  mostrar: () => {},
  esquecerAtual: () => {},
});

const TEXTO_SEM_ACESSO =
  "Seu usuário ainda não tem módulos liberados. Solicite a liberação a um administrador.";

/**
 * @param {object} dependencias
 * @param {() => object|null} dependencias.obterPerfil perfil de quem entrou
 * @param {object} dependencias.paineis painéis externos: `podeAbrir(codigo)`,
 *   `primeiro()`, `doMenu()`, `mostrar(codigo)` e `esquecerAtual()`
 * @param {(chave: string) => string} dependencias.configuracao valor de TB_CONFIGURACAO
 * @param {(texto: string, tom?: string) => void} dependencias.avisar toast
 * @param {() => void} dependencias.ajustarBarra barra lateral recolhida no celular
 */
export function criarNavegacao({
  documento = globalThis.document,
  janela = globalThis.window,
  armazenamento = () => globalThis.localStorage,
  obterPerfil = () => null,
  paineis = PAINEIS_VAZIOS,
  configuracao = () => "",
  avisar = () => {},
  ajustarBarra = () => {},
  confirmarSaida = () => confirmarSaidaPadrao(janela),
  aplicarAtualizacao = aplicarAtualizacaoPendente,
  recarregar = () => janela.location.reload(),
} = {}) {
  let view = "dashboard";
  let estado = Object.freeze({ view });
  const ouvintes = new Set();

  const $ = (id) => documento.getElementById(id);
  const perfil = () => obterPerfil();
  const areaAtual = () => obterDadosDoMonitoramento().areaAtual;

  function avisarOuvintes(evento) {
    ouvintes.forEach((ouvinte) => ouvinte(evento));
  }

  function definirView(nova) {
    if (nova === view) return;
    view = nova;
    estado = Object.freeze({ view });
  }

  // ── Tela guardada ─────────────────────────────────────────────────────

  function guardarTela(tela) {
    if (!tela) return;
    try {
      armazenamento()?.setItem(CHAVE_DA_TELA_GUARDADA, tela);
    } catch {
      // Sem localStorage (aba privada, bloqueio): a próxima entrada abre a inicial.
    }
  }

  function telaGuardada() {
    try {
      return armazenamento()?.getItem(CHAVE_DA_TELA_GUARDADA) || "";
    } catch {
      return "";
    }
  }

  const permitida = (tela) => telaPermitida(tela, perfil(), paineis);
  const inicialDoSistema = () => telaInicialDoSistema(perfil(), paineis);
  const deEntrada = () => telaDeEntrada(telaGuardada(), perfil(), paineis);

  // ── Cabeçalho e menu ──────────────────────────────────────────────────

  function definirTitulo(titulo, subtitulo) {
    const h1 = $("pageTitle");
    const sub = $("pageSubtitle");
    if (h1) h1.textContent = titulo || "";
    if (sub) sub.textContent = subtitulo || "";
    // O nome da aba tem um dono só; aqui entra apenas a metade da página.
    definirPaginaDaAba(titulo);
    // A Aya (src/modulos/aya/) acompanha a página: saudação, sugestões e contexto.
    definirPaginaDaAya(view, titulo);
  }

  /* Editais, Cronograma e Aprovados mostram só a área atual; o subtítulo diz qual. */
  function subtituloDaArea(sub) {
    return [nomeDaArea(areaAtual()), sub].filter(Boolean).join(" · ");
  }

  /*
    A Visão geral é uma só para as três áreas (React, src/modulos/visao-geral/):
    daqui sai só o cabeçalho, que muda com a área.
  */
  function tituloDaVisaoGeral() {
    if (view !== "dashboard") return;
    const { titulo, subtitulo } = cabecalhoDaVisaoGeral(areaAtual(), {
      titulo: configuracao("page_title"),
      subtitulo: configuracao("page_subtitle"),
    });
    definirTitulo(titulo, subtitulo);
  }

  function marcarMenu(tela = view) {
    marcarItemAtivoNoMenu(tela, secaoAtualDeConfiguracao(documento));
    avisarOuvintes({ tipo: "menu" });
  }

  /*
    A barra lateral é React (src/componentes/barra-lateral/). Aqui só se decide
    o que o perfil vê; a árvore vai para o estado da barra, que desenha o menu.
  */
  function montarMenu() {
    const atual = perfil();
    // As mesmas regras do "Ver como" de Acessos (src/lib/access-roles.js).
    const permitidas = paginasPermitidas(atual);
    // Seção "Acessos" só para quem gerencia acessos; as demais, para quem edita configurações.
    const secoes = SECOES.filter((secao) =>
      secaoDeConfiguracaoPermitida(atual, secao.id),
    );
    definirSecoesPermitidas(
      documento,
      secoes.map((secao) => secao.id),
    );
    // Um grupo por área do usuário; a área atual passa a ser uma delas.
    // Área desativada (Configurações › Módulos e abas) sai do menu.
    const situacao = situacaoDoSistema();
    const areas = areasDoUsuario(atual?.areas);
    const ativas = filtrarAreasAtivas(areas, situacao);
    definirAreasDoUsuario(ativas.length ? ativas : areas);
    atualizarMenuLateral(
      montarArvoreDoMenu({
        permitidas,
        paineis: paineis.doMenu(),
        secoesDeConfiguracao: secoes,
        areas,
        abas: abasDoMenu(),
        situacao,
      }),
      {
        aoAbrirSecao: (_view, secao) =>
          abrirSecaoDeConfiguracao(documento, secao),
        textoVazio: configuracao("permissions_empty_text"),
      },
    );
    marcarMenu(view);
  }

  // ── Troca de tela ─────────────────────────────────────────────────────

  function mostrarSemAcesso() {
    let vazia = $("page-sem-acesso");
    if (!vazia) {
      vazia = documento.createElement("section");
      vazia.id = "page-sem-acesso";
      vazia.className = "page";
      const aviso = documento.createElement("div");
      aviso.className = "alert warn";
      aviso.textContent = TEXTO_SEM_ACESSO;
      vazia.append(aviso);
      $("page-dashboard")?.parentElement?.append(vazia);
    }
    vazia.classList.add("active");
    definirTitulo(
      "Acesso aos módulos",
      "Nenhum módulo disponível para seu perfil.",
    );
  }

  function abriu(tela, anterior) {
    avisarOuvintes({ tipo: "abertura", view: tela, anterior });
  }

  /** Abre a tela (o `navigate` de sempre). Sem permissão, avisa e fica onde está. */
  function irPara(pedida) {
    const anterior = view;
    const tela = String(pedida ?? "").trim() || deEntrada();
    if (tela !== view && !confirmarSaida()) return;
    // Versão nova do sistema esperando: entra agora. A tela pedida fica guardada
    // e abre depois da recarga (a tela de entrada confere a permissão).
    if (
      tela !== view &&
      aplicarAtualizacao(() => {
        guardarTela(tela);
        recarregar();
      })
    )
      return;

    // A permissão vem antes de mudar a tela atual e de esconder as páginas.
    const bloqueio = bloqueioDaTela(tela, perfil(), paineis);
    if (bloqueio) {
      avisar(bloqueio, "warn");
      return;
    }

    documento.body.classList.remove("external-clean");
    documento.body.classList.remove("external-panel-mode");
    definirView(tela);
    guardarTela(tela);
    if (!ehPainelExterno(tela)) paineis.esquecerAtual();
    ajustarBarra();
    marcarMenu(tela);
    documento
      .querySelectorAll(".page")
      .forEach((pagina) => pagina.classList.remove("active"));

    if (tela === TELA_SEM_ACESSO) {
      mostrarSemAcesso();
      return;
    }

    // Sistema, área ou aba em manutenção: quem não é admin global vê a tela de manutenção.
    if (
      aplicarManutencaoNaNavegacao({
        documento,
        view: tela,
        area: areaAtual(),
        abas: abasDoMenu(),
        adminGlobal: isAdminGlobal(perfil()),
      })
    ) {
      definirTitulo("Em manutenção", subtituloDaArea(""));
      return;
    }

    if (tela === "dashboard") {
      $("page-dashboard")?.classList.add("active");
      // A página, com os mapas, é React (src/modulos/visao-geral/); aqui só o título.
      tituloDaVisaoGeral();
      abriu(tela, anterior);
      return;
    }
    if (Object.hasOwn(TELAS_REACT, tela)) {
      const [titulo, subtitulo, controlador] = TELAS_REACT[tela](
        configuracao,
        janela,
      );
      $("page-" + tela)?.classList.add("active");
      definirTitulo(titulo, subtituloDaArea(subtitulo));
      // O render das telas React costuma carregar dados: a falha vira aviso.
      Promise.resolve(controlador?.render()).catch((erro) => {
        console.error(`Falha ao abrir ${titulo}:`, erro);
        avisar(
          `Não foi possível abrir ${titulo}: ${erroAmigavel(erro)}`,
          "error",
        );
      });
      abriu(tela, anterior);
      return;
    }
    if (tela === "config") {
      $("page-config")?.classList.add("active");
      definirTitulo(
        configuracao("config_nav_title"),
        configuracao("config_page_subtitle"),
      );
      // Reabre a seção guardada (ou a primeira permitida); em Acessos, carrega a tela React.
      abrirSecaoDeConfiguracao(documento, secaoAtualDeConfiguracao(documento));
      abriu(tela, anterior);
      return;
    }
    if (ehPainelExterno(tela)) {
      const painel = paineis.mostrar(codigoDoPainel(tela));
      if (painel)
        definirTitulo(painel.titulo, configuracao("external_default_title"));
      abriu(tela, anterior);
    }
  }

  /*
    Trocou a área (menu): o cabeçalho da Visão geral muda (o estado dela tira o
    DSEI aberto, poda os filtros e troca o mapa). Devolve o cancelamento.
  */
  function acompanharArea() {
    let area = areaAtual();
    return assinarDadosDoMonitoramento(() => {
      const nova = areaAtual();
      if (nova === area) return;
      area = nova;
      tituloDaVisaoGeral();
    });
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    irPara,
    montarMenu,
    marcarMenu,
    definirTitulo,
    acompanharArea,
    telaPermitida: permitida,
    telaInicialDoSistema: inicialDoSistema,
    telaDeEntrada: deEntrada,
    telaGuardada,
    guardarTela,
  };
}
