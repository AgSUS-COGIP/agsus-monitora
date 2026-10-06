import {
  comemoracoesLigadasNaResposta,
  trocarEstadoGuardado,
} from "../lib/comemoracao.js";
import {
  alfaDoRastro,
  avancarShow,
  brilhoDaParticula,
  corDaParticula,
  criarShow,
  fatorDeSaida,
  INTENSIDADES,
  paletaDosFogos,
  showAcabou,
} from "../lib/fogos.js";
import "../styles/comemoracao.css";

/*
  O desenho das comemorações, sem biblioteca: fogos de artifício num <canvas>
  por 3–4,5 s e um aviso no topo (role="status"), que fecha no × ou sozinho.
  Com prefers-reduced-motion, só o aviso. O roteiro e a física dos fogos são
  de src/lib/fogos.js; a regra de quando comemorar, de src/lib/comemoracao.js.
  Quem usa: o acesso liberado (comemoracao-do-acesso.js), o painel de
  análises, a tela de Entrevistas (src/modulos/entrevistas/marcos.js), os
  marcos do ano (src/modulos/visao-geral/boas-vindas.jsx) e a Aya (fim de
  tour e de trilha).
*/

export const TEMPO_DO_AVISO_MS = 12000;
/* Densidade de pixels no canvas: nítido em tela retina, sem passar de 2x. */
const DPR_MAXIMO = 2;

export function semMovimento(janela = globalThis.window) {
  try {
    return Boolean(
      janela?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  } catch {
    return false;
  }
}

/* O tema do app (html[data-theme="dark"]) e as cores dele para os fogos. */
function paletaDoTema(doc, janela) {
  const raiz = doc.documentElement;
  const escuro = raiz?.getAttribute?.("data-theme") === "dark";
  let estilo = null;
  try {
    estilo = janela.getComputedStyle?.(raiz) || null;
  } catch {
    estilo = null;
  }
  return paletaDosFogos((nome) => estilo?.getPropertyValue?.(nome), {
    escuro,
  });
}

/* Desenha um quadro: apaga parte do anterior (rastro) e acende as faíscas. */
function desenhar(contexto, show, { largura, altura, dt }) {
  contexto.globalCompositeOperation = "destination-out";
  contexto.globalAlpha = 1;
  contexto.fillStyle = `rgba(0, 0, 0, ${alfaDoRastro(dt)})`;
  contexto.fillRect(0, 0, largura, altura);
  contexto.globalCompositeOperation = show.paleta.composicao;
  contexto.lineCap = "round";
  const saida = fatorDeSaida(show.t, show.duracao);
  for (const f of show.foguetes) {
    contexto.globalAlpha = saida;
    contexto.fillStyle = show.paleta.dourado;
    contexto.beginPath();
    contexto.arc(f.x, f.y, 2.2 * show.escala, 0, Math.PI * 2);
    contexto.fill();
  }
  for (const p of show.particulas) {
    const brilho = brilhoDaParticula(p, show.aleatorio) * saida;
    if (brilho <= 0.01) continue;
    contexto.globalAlpha = brilho;
    if (p.tipo === "clarao") {
      contexto.fillStyle = p.cor;
      contexto.beginPath();
      contexto.arc(p.x, p.y, p.tamanho * (1.2 - p.vida / p.vidaMax), 0, 7);
      contexto.fill();
      continue;
    }
    // Um traço do ponto até onde estava há pouco: o rastro de cada faísca.
    const recuo = 0.016 + 0.03 * p.rastro;
    contexto.strokeStyle = corDaParticula(p);
    contexto.lineWidth = p.tamanho;
    contexto.beginPath();
    contexto.moveTo(p.x - p.vx * recuo, p.y - p.vy * recuo);
    contexto.lineTo(p.x, p.y);
    contexto.stroke();
  }
}

/**
 * Fogos de artifício por 3–4,5 s: "pequeno", "cheio" (padrão), "fogos" (fim
 * de um tour) ou "festa" (fim de uma trilha). Canvas sem clique, nítido no
 * devicePixelRatio, que pausa com a aba oculta e se remove ao fim. Não faz
 * nada sem canvas 2D, sem requestAnimationFrame ou com menos movimento.
 */
export function soltarFogos(
  doc = globalThis.document,
  janela = globalThis.window,
  { intensidade = "cheio" } = {},
) {
  if (!doc?.body || semMovimento(janela)) return false;
  const canvas = doc.createElement("canvas");
  canvas.className = "comemoracao__fogos";
  canvas.setAttribute("aria-hidden", "true");
  let contexto = null;
  try {
    contexto = canvas.getContext?.("2d") || null;
  } catch {
    contexto = null;
  }
  if (!contexto || !janela?.requestAnimationFrame) return false;
  doc.body.appendChild(canvas);
  const largura = janela.innerWidth || 800;
  const altura = janela.innerHeight || 600;
  const dpr = Math.min(DPR_MAXIMO, Math.max(1, janela.devicePixelRatio || 1));
  canvas.width = Math.round(largura * dpr);
  canvas.height = Math.round(altura * dpr);
  contexto.setTransform?.(dpr, 0, 0, dpr, 0, 0);
  const show = criarShow({
    largura,
    altura,
    intensidade: INTENSIDADES[intensidade] ? intensidade : "cheio",
    paleta: paletaDoTema(doc, janela),
  });
  let anterior = null;
  const quadro = (agora) => {
    // Aba oculta: não avança (o navegador também segura os quadros).
    const dt = anterior === null || doc.hidden ? 0 : (agora - anterior) / 1000;
    anterior = agora;
    avancarShow(show, dt);
    desenhar(contexto, show, { largura, altura, dt });
    if (showAcabou(show)) canvas.remove();
    else janela.requestAnimationFrame(quadro);
  };
  janela.requestAnimationFrame(quadro);
  return true;
}

/** O nome antigo: os mesmos fogos ("pequeno" até 50 pedaços). */
export function soltarConfete(
  doc = globalThis.document,
  janela = globalThis.window,
  { quantidade = 140 } = {},
) {
  return soltarFogos(doc, janela, {
    intensidade: quantidade <= 50 ? "pequeno" : "cheio",
  });
}

/** O aviso no topo: a frase e, se houver, uma lista curta. */
export function mostrarAviso(
  doc = globalThis.document,
  { texto, itens = [], tituloDosItens = "", tempoMs = TEMPO_DO_AVISO_MS } = {},
) {
  if (!doc?.body) return null;
  const aviso = doc.createElement("div");
  aviso.className = "comemoracao";
  aviso.setAttribute("role", "status");
  aviso.setAttribute("aria-live", "polite");
  const corpo = doc.createElement("div");
  corpo.className = "comemoracao__corpo";
  const frase = doc.createElement("strong");
  frase.textContent = texto;
  corpo.append(frase);
  if (itens.length) {
    if (tituloDosItens) {
      const titulo = doc.createElement("span");
      titulo.textContent = tituloDosItens;
      corpo.append(titulo);
    }
    const lista = doc.createElement("ul");
    for (const item of itens) {
      const li = doc.createElement("li");
      li.textContent = item;
      lista.append(li);
    }
    corpo.append(lista);
  }
  const fechar = doc.createElement("button");
  fechar.type = "button";
  fechar.className = "comemoracao__fechar";
  fechar.setAttribute("aria-label", "Fechar mensagem");
  fechar.textContent = "×";
  fechar.addEventListener("click", () => aviso.remove());
  aviso.append(corpo, fechar);
  doc.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), tempoMs);
  return aviso;
}

/**
 * Aviso + fogos. `confete` (o nome ficou) é a intensidade: "pequeno",
 * "cheio", "fogos", "festa" ou false (só o aviso). Sem fogos quando a pessoa
 * pediu menos movimento. Devolve o aviso (ou null).
 */
export function comemorar({
  texto,
  itens = [],
  tituloDosItens = "",
  confete = "cheio",
  doc = globalThis.document,
  janela = globalThis.window,
} = {}) {
  const aviso = mostrarAviso(doc, { texto, itens, tituloDosItens });
  if (!aviso || !confete || semMovimento(janela)) return aviso;
  soltarFogos(doc, janela, { intensidade: confete });
  return aviso;
}

/*
  O painel no quadro (análises) é um app à parte, em iframe: lê o
  liga/desliga por conta própria, uma vez por página. Falhou (rede,
  sem sessão), desligado — e nada mais depende disso.
*/
let consultaDoPainel = null;
export function comemoracoesLigadasNoPainel(supabase) {
  if (!supabase?.rpc) return Promise.resolve(false);
  consultaDoPainel ??= Promise.resolve()
    .then(() => supabase.rpc("obter_situacao_do_sistema"))
    .then(({ data, error } = {}) =>
      error ? false : comemoracoesLigadasNaResposta(data),
    )
    .catch(() => false);
  return consultaDoPainel;
}

/** Só para os testes: esquece a leitura do liga/desliga. */
export function esquecerComemoracoesDoPainel() {
  consultaDoPainel = null;
}

/**
 * Um tipo de marco num painel: troca o estado guardado (linha de base na
 * primeira vez) e, se `decidir(anterior)` devolver `{ texto, itens }` e as
 * comemorações estiverem ligadas, comemora. O estado é guardado mesmo
 * desligado, para que religar não traga o que aconteceu no meio.
 */
export function avaliarMarco({
  armazenamento = globalThis.window?.localStorage,
  chave,
  atual,
  ligadas,
  decidir,
  confete = "cheio",
  doc = globalThis.document,
  janela = globalThis.window,
}) {
  const anterior = trocarEstadoGuardado({ armazenamento, chave, atual });
  if (anterior === null || !ligadas) return null;
  const comemoracao = decidir(anterior);
  if (!comemoracao) return null;
  comemorar({ ...comemoracao, confete, doc, janela });
  return comemoracao;
}
