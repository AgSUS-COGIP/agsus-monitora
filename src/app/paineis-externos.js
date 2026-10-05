import { getSupabaseClient } from "../lib/supabaseClient.js";
import { permissaoLegada } from "../lib/access-roles.js";
import { enderecoDoPainel } from "../lib/endereco-do-painel.js";
import { semOPainelAntigoDeAnalises } from "../lib/pagina-do-painel.js";
import { acompanharCarregamentoDoPainel } from "./carregamento.js";
import { estadoDasConfiguracoes } from "../modulos/configuracoes/estado.js";
import { avisar as avisarPadrao } from "./avisos.js";

/*
  Os painéis externos (TB_PAINEL_EXTERNO): a lista, os liberados para o perfil
  e o quadro (`#page-external`, um iframe por painel). Quem troca de tela é a
  navegação (src/app/navegacao.js), que chama `mostrar(codigo)` e põe o título.

  O iframe nasce na primeira abertura e fica até a página fechar (ou até o
  "Atualizar dados", que descarta os abertos para recarregarem). Antes, a
  entrada criava de uma vez o iframe de cada painel ativo, escondido, e todos
  carregavam a cada login.
*/

const ATRIBUTOS_DO_QUADRO = Object.freeze({
  class: "external-frame",
  loading: "eager",
  referrerpolicy: "no-referrer-when-downgrade",
  allow:
    "fullscreen *; clipboard-read *; clipboard-write *; encrypted-media *; geolocation *; display-capture *",
  allowfullscreen: "true",
});

export function criarPaineisExternos({
  cliente = getSupabaseClient,
  documento = globalThis.document,
  origem = () => globalThis.location?.origin,
  obterPerfil = () => null,
  configuracao = () => "",
  avisar = avisarPadrao,
  aoTentarDeNovo = () => {},
  estado = estadoDasConfiguracoes,
} = {}) {
  let lista = [];
  let liberados = new Set();
  let atual = null;

  const $ = (id) => documento.getElementById(id);
  const perfil = () => obterPerfil();
  const podeVerPaineis = () => permissaoLegada(perfil(), "paineis");

  // ── Lista e permissões ────────────────────────────────────────────────

  const consulta = () =>
    cliente()
      .from("TB_PAINEL_EXTERNO")
      .select(
        "id,codigo,titulo,icone,url,ordem,ativo,em_manutencao,tipo_abertura",
      )
      .order("ordem", { ascending: true });

  async function carregar({ consulta: disparada } = {}) {
    const { data, error } = await (disparada || consulta());
    // Análises curriculares virou página (view `analises`): o painel antigo sai.
    lista =
      !error && Array.isArray(data) && data.length
        ? semOPainelAntigoDeAnalises(data)
        : [];
    // Configurações › Painéis externos (React) lê daqui.
    estado.definirPaineisCarregados(lista);
  }

  /** Os ids liberados que vieram da sessão (`obter_contexto_monitora`). */
  function definirLiberados(ids) {
    liberados = new Set(ids || []);
  }

  /* Perfil sem matriz de permissões: todos os painéis ativos ficam liberados. */
  function completarLiberados() {
    const atualPerfil = perfil();
    if (atualPerfil?.permissoes) return;
    if (!atualPerfil?.id || !podeVerPaineis()) return;
    liberados = new Set(
      lista
        .filter((painel) => painel.ativo !== false && painel.id)
        .map((painel) => painel.id),
    );
  }

  function permitido(painel) {
    return (
      !!painel &&
      painel.ativo !== false &&
      podeVerPaineis() &&
      (!perfil()?.permissoes || liberados.has(String(painel.id)))
    );
  }

  const podeAbrir = (codigo) =>
    lista.some((painel) => painel.codigo === codigo && permitido(painel));
  const primeiro = () => lista.find(permitido) || null;
  const doMenu = () =>
    podeVerPaineis()
      ? lista
          .filter(permitido)
          .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
      : [];

  // ── Quadro ────────────────────────────────────────────────────────────

  function aviso(titulo, texto, icone = "") {
    const caixa = documento.createElement("div");
    caixa.className = "external-placeholder";
    const corpo = documento.createElement("div");
    if (icone) {
      const tile = documento.createElement("div");
      tile.style.fontSize = "58px";
      tile.style.color = "#555";
      const i = documento.createElement("i");
      i.className = `fa-solid ${icone}`;
      tile.append(i);
      corpo.append(tile);
    }
    const h2 = documento.createElement("h2");
    h2.textContent = titulo;
    const p = documento.createElement("p");
    p.textContent = texto;
    corpo.append(h2, p);
    caixa.append(corpo);
    return caixa;
  }

  function montarQuadro(holder, painel) {
    if (painel.em_manutencao) {
      holder.replaceChildren(
        aviso(
          configuracao("maintenance_title"),
          configuracao("maintenance_message"),
          "fa-screwdriver-wrench",
        ),
      );
      return;
    }
    const endereco = enderecoDoPainel(painel.url, origem());
    if (!endereco) {
      holder.replaceChildren(
        aviso(
          painel.titulo,
          "Cadastre uma URL http(s) válida deste painel em paineis_externos.",
        ),
      );
      return;
    }
    const quadro = documento.createElement("iframe");
    for (const [nome, valor] of Object.entries(ATRIBUTOS_DO_QUADRO))
      quadro.setAttribute(nome, valor);
    quadro.setAttribute("src", endereco);
    holder.replaceChildren(quadro);
    // Até o site de fora responder, o quadro ficaria em branco.
    acompanharCarregamentoDoPainel(holder, { aoTentarDeNovo });
  }

  /**
   * Mostra o quadro do painel (a navegação já trocou a tela). Devolve o painel,
   * ou `null` se ele não estiver liberado.
   */
  function mostrar(codigo) {
    const painel = lista.find((p) => p.codigo === codigo && permitido(p));
    if (!painel) {
      avisar("Painel indisponível ou inativo.", "warn");
      return null;
    }
    /*
      O painel externo traz o seu próprio cabeçalho: `external-panel-mode`
      esconde **apenas** o cabeçalho superior do app. A barra lateral fica,
      porque é por ela que se volta (o antigo `external-clean` a escondia).
    */
    documento.body.classList.remove("external-clean");
    documento.body.classList.add("external-panel-mode");
    atual = painel;
    $("page-external")?.classList.add("active");
    const titulo = $("externalTitle");
    if (titulo) titulo.textContent = painel.titulo;
    const abrir = $("externalOpen");
    if (abrir) abrir.href = enderecoDoPainel(painel.url, origem()) || "#";
    const montagem = $("externalMount");
    if (!montagem) return painel;
    if (montagem.classList.contains("external-placeholder")) {
      montagem.className = "";
      montagem.replaceChildren();
    }
    montagem
      .querySelectorAll(".external-panel")
      .forEach((holder) => (holder.hidden = true));
    let holder = $("external-panel-" + codigo);
    if (!holder) {
      holder = documento.createElement("div");
      holder.id = "external-panel-" + codigo;
      holder.className = "external-panel";
      montagem.appendChild(holder);
      montarQuadro(holder, painel);
    }
    holder.hidden = false;
    return painel;
  }

  /** Tira o quadro do painel (o próximo `mostrar` cria de novo). */
  function descartar(codigo) {
    $("external-panel-" + codigo)?.remove();
  }

  /** Os quadros abertos recarregam na próxima abertura ("Atualizar dados"). */
  function descartarAbertos() {
    documento
      .querySelectorAll(".external-panel")
      .forEach((holder) => holder.remove());
  }

  /* A pessoa saiu: nenhum quadro dela fica na página. */
  function limpar() {
    descartarAbertos();
    const montagem = $("externalMount");
    if (montagem) {
      montagem.className = "external-placeholder";
      montagem.textContent = configuracao("external_placeholder");
    }
    atual = null;
    liberados = new Set();
  }

  return {
    consulta,
    carregar,
    definirLiberados,
    completarLiberados,
    liberados: () => liberados,
    permitido,
    podeAbrir,
    primeiro,
    doMenu,
    mostrar,
    descartar,
    descartarAbertos,
    limpar,
    atual: () => atual,
    esquecerAtual: () => {
      atual = null;
    },
  };
}
