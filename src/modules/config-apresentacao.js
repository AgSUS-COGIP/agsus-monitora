/*
  Apresentação das seções legadas Página inicial e Tela de acesso (Marca,
  Painéis externos e Operação já são React: src/componentes/configuracoes/).

  Três coisas, sem trocar nenhum campo (os ids, os valores, os listeners e o
  salvamento continuam os de sempre — os nós só mudam de lugar, como em
  config-secoes.js):

  1. GRUPOS: os campos de cada seção entram em grupos com título, descrição e
     um ícone colorido (src/lib/apresentacao-das-configuracoes.js). Grupo sem
     nenhum campo visível fica escondido.
  2. DICAS: um "?" ao lado do rótulo abre a explicação do campo (tooltip do
     design.md 11.10). O mesmo texto vai para o aria-describedby do campo.
  3. PRÉVIA: ao lado dos campos, como aquilo aparece de verdade — a página
     inicial e o cartão de entrada.
     Atualiza enquanto se digita e sempre que a seção é aberta
     (evento agsus:secao-de-configuracao-aberta, de config-secoes.js), porque
     o legado preenche os campos por código, sem evento de input.

  Tudo com createElement/textContent: nada de innerHTML com valor digitado.
*/

import {
  DICAS_DOS_CAMPOS,
  GRUPOS_POR_SECAO,
  tomDoAviso,
  urlDeImagem,
} from "../lib/apresentacao-das-configuracoes.js";
import { corDoTextoPara } from "../lib/contraste.js";
import { EVENTO_SECAO_ABERTA } from "./config-secoes.js";
import { criarIcone } from "./icones.js";

const txt = (valor) => String(valor ?? "").trim();

function el(documento, tag, atributos = {}, ...filhos) {
  const no = documento.createElement(tag);
  for (const [nome, valor] of Object.entries(atributos)) {
    if (valor === undefined || valor === null || valor === false) continue;
    if (nome === "className") no.className = valor;
    else if (nome === "texto") no.textContent = valor;
    // Estilo pelo CSSOM (não pelo atributo style=""), que a CSP não bloqueia.
    else if (nome === "estilo") Object.assign(no.style, valor);
    else no.setAttribute(nome, valor === true ? "" : String(valor));
  }
  for (const filho of filhos.flat()) if (filho) no.append(filho);
  return no;
}

const icone = (nome, tamanho = 16) => criarIcone(nome, { tamanho });
const linhaDoCampo = (documento, id) =>
  documento.getElementById(id)?.closest(".form-row") || null;
const campoVisivel = (linha) =>
  linha && !linha.hidden && linha.style.display !== "none";

// ── 1. Grupos ────────────────────────────────────────────────────────────────────

function montarGrupos(documento, secaoId, corpo) {
  const grupos = GRUPOS_POR_SECAO[secaoId] || [];
  let anterior = null;
  for (const grupo of grupos) {
    const linhas = grupo.campos
      .map((id) => linhaDoCampo(documento, id))
      .filter(Boolean);
    if (!linhas.length) continue;
    const tituloId = `configGrupo-${secaoId}-${grupo.id}`;
    const campos = el(documento, "div", {
      className: "config-grupo__campos form-grid",
    });
    const caixa = el(
      documento,
      "section",
      {
        className: "config-grupo",
        "data-tom": grupo.tom,
        "data-grupo": grupo.id,
        "aria-labelledby": tituloId,
      },
      el(
        documento,
        "header",
        { className: "config-grupo__cabecalho" },
        el(
          documento,
          "span",
          { className: "config-grupo__icone", "aria-hidden": "true" },
          icone(grupo.icone),
        ),
        el(
          documento,
          "div",
          {},
          el(documento, "h4", { id: tituloId, texto: grupo.titulo }),
          el(documento, "p", { texto: grupo.descricao }),
        ),
      ),
      campos,
    );
    for (const linha of linhas) campos.append(linha);
    caixa.hidden = !linhas.some(campoVisivel);
    if (anterior) anterior.after(caixa);
    else corpo.prepend(caixa);
    anterior = caixa;
  }
}

// ── 2. Dicas ─────────────────────────────────────────────────────────────────────

function aplicarDicas(documento, corpo) {
  for (const [id, dica] of Object.entries(DICAS_DOS_CAMPOS)) {
    const campo = documento.getElementById(id);
    if (!campo || !corpo.contains(campo)) continue;
    const rotulo = corpo.querySelector(`label[for="${id}"]`);
    if (!rotulo || rotulo.parentElement?.classList.contains("config-rotulo"))
      continue;
    const descricaoId = `${id}Dica`;
    const envoltorio = el(documento, "div", { className: "config-rotulo" });
    rotulo.before(envoltorio);
    envoltorio.append(
      rotulo,
      el(
        documento,
        "button",
        {
          type: "button",
          className: "config-dica",
          "aria-label": `Ajuda: ${txt(rotulo.textContent)}`,
          "data-dica": dica,
        },
        icone("circle-help", 14),
      ),
      el(documento, "span", {
        id: descricaoId,
        className: "sr-only",
        texto: dica,
      }),
    );
    const descritos = new Set(
      txt(campo.getAttribute("aria-describedby")).split(/\s+/).filter(Boolean),
    );
    descritos.add(descricaoId);
    campo.setAttribute("aria-describedby", [...descritos].join(" "));
  }
}

// ── 3. Prévias ───────────────────────────────────────────────────────────────────

const valor = (documento, id) => txt(documento.getElementById(id)?.value);

function imagem(documento, url, alt, className, reserva) {
  const src = urlDeImagem(url);
  if (!src) return reserva;
  const img = el(documento, "img", {
    className,
    src,
    alt,
    loading: "lazy",
    referrerpolicy: "no-referrer",
  });
  // Endereço que não carrega: volta para a reserva em vez de mostrar imagem quebrada.
  img.addEventListener("error", () => img.replaceWith(reserva), { once: true });
  return img;
}

const KPIS = [
  ["cfgKpiProcessos", "Processos", "48", "folder-kanban"],
  ["cfgKpiVagas", "Vagas", "1.236", "users"],
  ["cfgKpiContratados", "Contratações", "812", "circle-check"],
  ["cfgKpiOciosas", "Vagas ociosas", "57", "circle-alert"],
  ["cfgKpiCriticos", "Críticos", "6", "flame"],
  ["cfgKpiInscritos", "Inscritos", "9.410", "file-text"],
];

function previaDaPaginaInicial(documento) {
  const mensagem = valor(documento, "cfgBroadcastMsg");
  const aviso = tomDoAviso(valor(documento, "cfgBroadcastType"));
  return el(
    documento,
    "div",
    { className: "previa-inicio" },
    el(documento, "strong", {
      className: "previa-inicio__titulo",
      texto: valor(documento, "cfgPageTitle") || "Título da página inicial",
    }),
    el(documento, "small", {
      className: "previa-inicio__subtitulo",
      texto: valor(documento, "cfgPageSubtitle") || "Subtítulo",
    }),
    mensagem
      ? el(
          documento,
          "div",
          { className: "previa-aviso", "data-tom": aviso.tom },
          icone(aviso.icone, 14),
          el(
            documento,
            "span",
            {},
            el(documento, "strong", { texto: `${aviso.rotulo}: ` }),
            mensagem,
          ),
        )
      : el(documento, "p", {
          className: "previa-vazio",
          texto: "Sem aviso no topo (mensagem em branco).",
        }),
    el(
      documento,
      "div",
      { className: "previa-inicio__filtros" },
      icone("list-filter", 14),
      el(
        documento,
        "div",
        {},
        el(documento, "strong", {
          texto: valor(documento, "cfgFilterTitle") || "Filtros",
        }),
        el(documento, "small", {
          texto: valor(documento, "cfgFilterSubtitle"),
        }),
      ),
      el(documento, "span", {
        className: "previa-inicio__botao",
        texto: valor(documento, "cfgFilterToggleShow") || "Mostrar filtros",
      }),
    ),
    el(
      documento,
      "div",
      { className: "previa-inicio__kpis" },
      KPIS.map(([id, padrao, numero, nomeDoIcone]) =>
        el(
          documento,
          "div",
          { className: "previa-kpi" },
          el(
            documento,
            "span",
            { className: "previa-kpi__rotulo" },
            icone(nomeDoIcone, 12),
            valor(documento, id) || padrao,
          ),
          el(documento, "strong", { texto: numero }),
        ),
      ),
    ),
    el(documento, "small", {
      className: "previa-nota",
      texto: "Números de exemplo.",
    }),
  );
}

function previaDaTelaDeAcesso(documento) {
  const cor = valor(documento, "cfgAccessPanelColor") || "#0b1f3d";
  const corDoTexto = corDoTextoPara(
    cor,
    valor(documento, "cfgAccessTextoModo"),
  );
  const arte =
    documento.querySelector(".access-background-preview")?.style
      .backgroundImage || "";
  const googleLigado = valor(documento, "cfgGoogleEnabled") !== "false";
  const reservaDoLogo = el(documento, "strong", {
    className: "previa-acesso__marca",
    texto: "AgSUS",
  });
  return el(
    documento,
    "div",
    {
      className: "previa-acesso",
      estilo: arte ? { backgroundImage: arte } : undefined,
    },
    el(
      documento,
      "div",
      {
        className: "previa-acesso__cartao",
        estilo: { background: cor, color: corDoTexto },
      },
      imagem(
        documento,
        valor(documento, "cfgAccessLogoUrl"),
        "Logo no acesso",
        "previa-acesso__logo",
        reservaDoLogo,
      ),
      valor(documento, "cfgLoginEyebrow")
        ? el(documento, "small", { texto: valor(documento, "cfgLoginEyebrow") })
        : null,
      el(documento, "strong", {
        className: "previa-acesso__saudacao",
        texto:
          valor(documento, "cfgAccessGreeting") || "Bem-vindo(a) ao MONITORA",
      }),
      googleLigado
        ? el(
            documento,
            "span",
            { className: "previa-acesso__google" },
            el(documento, "span", {
              className: "previa-acesso__g",
              "aria-hidden": "true",
              texto: "G",
            }),
            valor(documento, "cfgGoogleButtonText") ||
              "Entrar com sua conta institucional",
          )
        : el(documento, "small", {
            className: "previa-acesso__desligado",
            texto: "Botão do Google desligado.",
          }),
    ),
  );
}

const PREVIAS = Object.freeze({
  inicio: ["Prévia da página inicial", previaDaPaginaInicial],
  acesso: ["Prévia do cartão de entrada", previaDaTelaDeAcesso],
});

function montarPrevia(documento, secao) {
  const [titulo] = PREVIAS[secao.dataset.secao] || [];
  if (!titulo || secao.querySelector(":scope > .config-previa")) return;
  secao.classList.add("config-secao--com-previa");
  secao.append(
    el(
      documento,
      "aside",
      { className: "config-previa", "aria-label": titulo },
      el(
        documento,
        "p",
        { className: "config-previa__rotulo" },
        icone("eye", 14),
        titulo,
      ),
      el(documento, "div", {
        className: "config-previa__conteudo",
        "aria-live": "polite",
      }),
    ),
  );
}

export function atualizarPrevia(documento, secao) {
  const [, desenhar] = PREVIAS[secao?.dataset.secao] || [];
  const alvo = secao?.querySelector(
    ":scope > .config-previa .config-previa__conteudo",
  );
  if (!desenhar || !alvo) return false;
  alvo.replaceChildren(desenhar(documento));
  return true;
}

export function atualizarPrevias(documento = globalThis.document) {
  for (const secao of documento.querySelectorAll(
    "#page-config .config-secao--com-previa",
  ))
    atualizarPrevia(documento, secao);
}

// ── Instalação ──────────────────────────────────────────────────────────────────

export function instalarApresentacaoDasConfiguracoes(
  documento = globalThis.document,
) {
  const pagina = documento?.getElementById?.("page-config");
  if (!pagina || pagina.dataset.apresentacao === "1") return false;
  pagina.dataset.apresentacao = "1";

  for (const secao of pagina.querySelectorAll(".config-secao")) {
    const id = secao.dataset.secao;
    const corpo = secao.querySelector(".config-secao__corpo");
    if (!corpo || (!GRUPOS_POR_SECAO[id] && !PREVIAS[id])) continue;
    secao.dataset.apresentacao = id;
    montarGrupos(documento, id, corpo);
    aplicarDicas(documento, corpo);
    montarPrevia(documento, secao);
  }

  // Uma redesenhada por quadro, mesmo digitando rápido.
  const pendentes = new Set();
  let quadro = 0;
  const agendar = (secao) => {
    if (!secao?.classList.contains("config-secao--com-previa")) return;
    pendentes.add(secao);
    if (quadro) return;
    const raf =
      documento.defaultView?.requestAnimationFrame ||
      ((fn) => setTimeout(fn, 16));
    quadro = raf(() => {
      quadro = 0;
      for (const alvo of pendentes) atualizarPrevia(documento, alvo);
      pendentes.clear();
    });
  };
  const aoMudar = (evento) =>
    agendar(evento.target?.closest?.(".config-secao"));
  pagina.addEventListener("input", aoMudar);
  pagina.addEventListener("change", aoMudar);
  documento.addEventListener(EVENTO_SECAO_ABERTA, (evento) => {
    agendar(
      pagina.querySelector(
        `.config-secao[data-secao="${evento.detail?.secao}"]`,
      ),
    );
  });

  atualizarPrevias(documento);
  return true;
}
