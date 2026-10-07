import {
  avisar as avisarEvento,
  EVENTO_BARRA_ALTERNADA,
  EVENTO_TEMA_ALTERADO,
} from "../lib/eventos-da-barra-lateral.js";
import { nomeDaArea } from "../lib/menu-lateral.js";
import { resumoDoRelatorio } from "../lib/visao-geral.ts";
import { obterDadosDoMonitoramento } from "../componentes/dados-do-monitoramento.js";
import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.ts";
import { avisar as avisarPadrao } from "./avisos.js";

/*
  A moldura do app, sem React: a barra lateral recolhida (e aberta por cima no
  celular), o tema claro/escuro, a tela cheia e o relatório em PDF.

  As chaves do localStorage são as que o script do <head> do index.html lê
  antes do primeiro quadro (barra e tema da visita anterior).

  Contratos: `window.toggleSidebar`, `toggleDarkMode`, `toggleBrowserFullscreen`
  e `exportPDF` (onclick do index.html e barra lateral React), publicados por
  src/app/sistema.js. A barra lateral (React) lê a classe de `body` e o tema
  de `html[data-theme]`, avisada pelos eventos de eventos-da-barra-lateral.js.
*/

export const CHAVE_DA_BARRA_RECOLHIDA = "agsus_monitora_sidebar_collapsed_v1";
export const CHAVE_DO_TEMA = "agsus_dark_mode_v1";
const LARGURA_DO_CELULAR = 900;

export function criarMoldura({
  documento = globalThis.document,
  janela = globalThis.window,
  armazenamento = () => globalThis.localStorage,
  avisar = avisarPadrao,
  alvoDaTelaCheia = () => null,
  relatorio = () => estadoDaVisaoGeral.obter(),
  areaAtual = () => obterDadosDoMonitoramento().areaAtual,
} = {}) {
  const corpo = () => documento.body;
  const $ = (id) => documento.getElementById(id);

  function guardar(chave, valor) {
    try {
      armazenamento()?.setItem(chave, valor);
    } catch {
      // Sem localStorage (aba privada, bloqueio): vale só nesta visita.
    }
  }
  function ler(chave) {
    try {
      return armazenamento()?.getItem(chave) ?? null;
    } catch {
      return null;
    }
  }

  // ── Barra lateral ─────────────────────────────────────────────────────

  const ehCelular = () =>
    janela.matchMedia(`(max-width:${LARGURA_DO_CELULAR}px)`).matches;
  const avisarBarra = () => avisarEvento(EVENTO_BARRA_ALTERNADA);

  /* No celular, a barra só fica aberta quando a pessoa abriu (`sidebar-open`). */
  function ajustarBarra() {
    if (ehCelular() && !corpo().classList.contains("sidebar-open"))
      corpo().classList.add("sidebar-collapsed");
    avisarBarra();
  }

  function aplicarBarraGuardada() {
    if (ehCelular()) return;
    const guardada = ler(CHAVE_DA_BARRA_RECOLHIDA);
    if (guardada === "0") corpo().classList.remove("sidebar-collapsed");
    if (guardada === "1") corpo().classList.add("sidebar-collapsed");
    avisarBarra();
  }

  function alternarBarra() {
    if (ehCelular()) {
      const abrindo =
        corpo().classList.contains("sidebar-collapsed") &&
        !corpo().classList.contains("sidebar-open");
      corpo().classList.toggle("sidebar-open", abrindo);
      corpo().classList.toggle("sidebar-collapsed", !abrindo);
      avisarBarra();
      janela.dispatchEvent(new Event("resize"));
      return;
    }
    ajustarBarra();
    corpo().classList.toggle("sidebar-collapsed");
    avisarBarra();
    guardar(
      CHAVE_DA_BARRA_RECOLHIDA,
      corpo().classList.contains("sidebar-collapsed") ? "1" : "0",
    );
  }

  /* Mudou a largura (ou a orientação): no celular, a barra volta a recolher. */
  function acompanharLargura() {
    let espera = null;
    const aoMudar = (atraso) => () => {
      clearTimeout(espera);
      espera = setTimeout(ajustarBarra, atraso);
    };
    const aoRedimensionar = aoMudar(220);
    const aoGirar = aoMudar(300);
    janela.addEventListener("resize", aoRedimensionar);
    janela.addEventListener("orientationchange", aoGirar);
    return () => {
      clearTimeout(espera);
      janela.removeEventListener("resize", aoRedimensionar);
      janela.removeEventListener("orientationchange", aoGirar);
    };
  }

  // ── Tema ──────────────────────────────────────────────────────────────

  const temaEscuro = () =>
    documento.documentElement.getAttribute("data-theme") === "dark";

  function aplicarTema(escuro) {
    documento.documentElement.setAttribute("data-theme", escuro ? "dark" : "");
    documento.documentElement.style.colorScheme = escuro ? "dark" : "light";
    // O CSS antigo ainda lê `body.dark-mode`; o novo, `html[data-theme]`.
    corpo()?.classList.toggle("dark-mode", escuro);
    avisarEvento(EVENTO_TEMA_ALTERADO);
  }

  function alternarTema() {
    const escuro = !temaEscuro();
    guardar(CHAVE_DO_TEMA, escuro ? "1" : "0");
    aplicarTema(escuro);
  }

  /* Sem preferência guardada, claro: a tela de acesso não abre escura no primeiro acesso. */
  function aplicarTemaGuardado() {
    aplicarTema(ler(CHAVE_DO_TEMA) === "1");
  }

  /* O tema trocado em outra aba chega pelo `storage`. Devolve o cancelamento. */
  function acompanharTemaDeOutraAba() {
    const aoGuardar = (evento) => {
      if (evento.key && evento.key !== CHAVE_DO_TEMA) return;
      if (evento.newValue !== "1" && evento.newValue !== "0") return;
      aplicarTema(evento.newValue === "1");
    };
    janela.addEventListener("storage", aoGuardar);
    return () => janela.removeEventListener("storage", aoGuardar);
  }

  // ── Tela cheia ────────────────────────────────────────────────────────

  const emTelaCheia = () =>
    !!documento.fullscreenElement ||
    corpo().classList.contains("app-fullscreen-fallback");

  /* O ícone do item "Tela cheia" no menu da conta. */
  function marcarTelaCheia() {
    const icone = $("fullscreenActionIcon");
    if (icone)
      icone.className = emTelaCheia()
        ? "fa-solid fa-compress"
        : "fa-solid fa-expand";
  }

  /* Sem a tela cheia do navegador: o app se expande dentro da janela. */
  function telaCheiaDoApp(forcar) {
    const ativa =
      typeof forcar === "boolean"
        ? forcar
        : !corpo().classList.contains("app-fullscreen-fallback");
    corpo().classList.toggle("app-fullscreen-fallback", ativa);
    corpo().classList.toggle(
      "system-fullscreen-mode",
      ativa || !!documento.fullscreenElement,
    );
    marcarTelaCheia();
    avisar(ativa ? "Modo expandido ativado." : "Modo expandido desativado.");
  }

  function alternarTelaCheia() {
    try {
      if (corpo().classList.contains("app-fullscreen-fallback")) {
        telaCheiaDoApp(false);
        return;
      }
      if (documento.fullscreenElement) {
        documento.exitFullscreen?.()?.catch?.(() => telaCheiaDoApp(false));
        return;
      }
      // O painel externo aberto vai para a tela cheia sozinho; senão, o app.
      const alvo = alvoDaTelaCheia() || documento.documentElement;
      if (!documento.fullscreenEnabled || !alvo?.requestFullscreen) {
        telaCheiaDoApp(true);
        return;
      }
      alvo.requestFullscreen()?.catch?.(() => telaCheiaDoApp(true));
    } catch {
      telaCheiaDoApp(true);
    }
  }

  /* Sai da tela cheia (do navegador ou do app), se houver. */
  function sairDaTelaCheia() {
    try {
      if (documento.fullscreenElement && documento.exitFullscreen)
        documento.exitFullscreen()?.catch?.(() => {});
    } catch {
      // O navegador já saiu da tela cheia.
    }
    if (corpo().classList.contains("app-fullscreen-fallback"))
      telaCheiaDoApp(false);
  }

  function acompanharTelaCheia() {
    const aoMudar = () => {
      corpo().classList.toggle("system-fullscreen-mode", emTelaCheia());
      marcarTelaCheia();
    };
    documento.addEventListener("fullscreenchange", aoMudar);
    return () => documento.removeEventListener("fullscreenchange", aoMudar);
  }

  // ── Relatório em PDF (pelo diálogo de impressão, funciona sem rede) ────

  function elemento(tag, estilo, texto) {
    const el = documento.createElement(tag);
    if (estilo) el.setAttribute("style", estilo);
    if (texto !== undefined) el.textContent = texto;
    return el;
  }

  function numero(rotulo, valor, estilo = "") {
    const span = elemento("span", estilo);
    const b = elemento("b", "", Number(valor || 0).toLocaleString("pt-BR"));
    span.append(b, ` ${rotulo}`);
    return span;
  }

  function exportarPdf() {
    const geradoEm = new Date().toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    // O recorte da Visão geral: filtros aplicados e os números dele.
    const { filtros, busca, filtradas } = relatorio();
    const resumo = resumoDoRelatorio({ filtros, busca, linhas: filtradas });
    $("printReportHeader")?.remove();
    const cabecalho = elemento("div");
    cabecalho.id = "printReportHeader";
    cabecalho.className = "print-only";
    const caixa = elemento(
      "div",
      "padding:0 0 12px;border-bottom:2px solid #003b70;margin-bottom:14px;",
    );
    const filtrosAplicados = elemento(
      "div",
      "font-size:11px;color:#555;margin-top:6px;",
    );
    filtrosAplicados.append(
      elemento("b", "", "Filtros:"),
      ` ${resumo.filtros}`,
    );
    const numeros = elemento(
      "div",
      "font-size:12px;color:#222;margin-top:8px;display:flex;gap:18px;flex-wrap:wrap;",
    );
    const ociosas = numero(
      `ociosas (${resumo.pctOciosas}%)`,
      resumo.ociosas,
      "color:#a3322b;",
    );
    numeros.append(
      numero("processos", resumo.processos),
      numero("vagas previstas", resumo.vagas),
      numero("contratações", resumo.contratados),
      ociosas,
    );
    caixa.append(
      elemento(
        "div",
        "font-size:20px;font-weight:700;color:#003b70;",
        // O recorte é o da área aberta (Saúde Indígena, SEDE ou Projetos).
        ["AgSUS Monitora", nomeDaArea(areaAtual())].filter(Boolean).join(" — "),
      ),
      elemento(
        "div",
        "font-size:12px;color:#444;margin-top:2px;",
        `Relatório de processos seletivos · gerado em ${geradoEm}`,
      ),
      filtrosAplicados,
      numeros,
    );
    cabecalho.append(caixa);
    const conteudo = documento.querySelector(".content") || corpo();
    conteudo.insertBefore(cabecalho, conteudo.firstChild);
    const limpar = () => {
      $("printReportHeader")?.remove();
      janela.removeEventListener("afterprint", limpar);
    };
    janela.addEventListener("afterprint", limpar);
    setTimeout(() => {
      janela.print();
      setTimeout(limpar, 1500);
    }, 120);
    avisar(
      'Gerando relatório PDF… escolha "Salvar como PDF" na janela de impressão.',
    );
  }

  return {
    ajustarBarra,
    aplicarBarraGuardada,
    alternarBarra,
    acompanharLargura,
    aplicarTema,
    alternarTema,
    aplicarTemaGuardado,
    acompanharTemaDeOutraAba,
    marcarTelaCheia,
    alternarTelaCheia,
    sairDaTelaCheia,
    acompanharTelaCheia,
    exportarPdf,
  };
}
