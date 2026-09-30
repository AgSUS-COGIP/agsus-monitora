import {
  comemoracoesLigadasNaResposta,
  DURACAO_DOS_FOGOS_MS,
  trocarEstadoGuardado,
} from "../lib/comemoracao.js";
import "../styles/comemoracao.css";

/*
  O desenho das comemorações, sem biblioteca: confete em <canvas> por ~3 s e
  um aviso no topo (role="status"), que fecha no × ou sozinho. Com
  prefers-reduced-motion, só o aviso. A regra de quando comemorar é de
  src/lib/comemoracao.js; quem usa: o acesso liberado
  (comemoracao-do-acesso.js), os painéis de análises e de entrevistas e os
  marcos do ano (marcos-do-ano.js).
*/

const CORES = [
  "#00a86b",
  "#59f2c8",
  "#ffd23f",
  "#f7fbff",
  "#1e88e5",
  "#ff7a59",
];
export const TEMPO_DO_AVISO_MS = 12000;
const PEDACOS = { cheio: 140, pequeno: 50 };

export function semMovimento(janela = globalThis.window) {
  try {
    return Boolean(
      janela?.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches,
    );
  } catch {
    return false;
  }
}

/** Confete por ~3 s; não faz nada sem canvas 2D ou requestAnimationFrame. */
export function soltarConfete(
  doc = globalThis.document,
  janela = globalThis.window,
  { quantidade = PEDACOS.cheio } = {},
) {
  if (!doc?.body) return false;
  const canvas = doc.createElement("canvas");
  canvas.className = "comemoracao__confete";
  canvas.setAttribute("aria-hidden", "true");
  let contexto = null;
  try {
    contexto = canvas.getContext?.("2d") || null;
  } catch {
    contexto = null;
  }
  if (!contexto || !janela?.requestAnimationFrame) return false;
  doc.body.appendChild(canvas);
  const largura = (canvas.width = janela.innerWidth || 800);
  const altura = (canvas.height = janela.innerHeight || 600);
  const pedacos = Array.from({ length: quantidade }, (_, i) => ({
    x: largura / 2 + (Math.random() - 0.5) * largura * 0.3,
    y: altura * 0.35,
    vx: (Math.random() - 0.5) * 14,
    vy: -Math.random() * 13 - 4,
    tamanho: 5 + Math.random() * 6,
    giro: Math.random() * Math.PI,
    cor: CORES[i % CORES.length],
  }));
  let inicio = null;
  const quadro = (agora) => {
    inicio ??= agora;
    const passado = agora - inicio;
    contexto.clearRect(0, 0, largura, altura);
    contexto.globalAlpha = Math.max(0, 1 - passado / DURACAO_DOS_FOGOS_MS);
    for (const p of pedacos) {
      p.vy += 0.32;
      p.vx *= 0.99;
      p.x += p.vx;
      p.y += p.vy;
      p.giro += 0.12;
      contexto.fillStyle = p.cor;
      contexto.save();
      contexto.translate(p.x, p.y);
      contexto.rotate(p.giro);
      contexto.fillRect(
        -p.tamanho / 2,
        -p.tamanho / 4,
        p.tamanho,
        p.tamanho / 2,
      );
      contexto.restore();
    }
    if (passado < DURACAO_DOS_FOGOS_MS) janela.requestAnimationFrame(quadro);
    else canvas.remove();
  };
  janela.requestAnimationFrame(quadro);
  return true;
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
 * Aviso + confete ("cheio", "pequeno" ou false). Sem confete quando a pessoa
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
  if (aviso && confete && !semMovimento(janela))
    soltarConfete(doc, janela, {
      quantidade: PEDACOS[confete] || PEDACOS.cheio,
    });
  return aviso;
}

/*
  Painéis (análises, entrevistas, recursos) são apps à parte, em iframe: cada
  um lê o liga/desliga por conta própria, uma vez por página. Falhou (rede,
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
