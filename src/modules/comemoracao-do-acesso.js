import {
  CHAVE_PENDENTE,
  DURACAO_DOS_FOGOS_MS,
  chaveDaDesativacao,
  chaveDoUsuario,
  mensagemDaComemoracao,
  oQuePodeUsar,
  tipoDeComemoracao,
} from "../lib/acesso-liberado.js";
import "../styles/boas-vindas.css";

/*
  "Parabéns, Ana! Seu acesso ao MONITORA foi liberado." (ou "Bem-vindo(a) de
  volta…" na reativação), com o que a pessoa pode usar agora. Regra em
  src/lib/acesso-liberado.js.

  Confete em <canvas>, ~3 s, sem biblioteca. Com prefers-reduced-motion, só a
  mensagem. Armazenamento sempre em try/catch (janela privada, bloqueado): sem
  ele, as marcas não ficam e a regra da primeira entrada ainda limita a um dia.
*/

const CORES = [
  "#00a86b",
  "#59f2c8",
  "#ffd23f",
  "#f7fbff",
  "#1e88e5",
  "#ff7a59",
];
const TEMPO_DA_MENSAGEM_MS = 12000;

function ler(armazenamento, chave) {
  try {
    return armazenamento?.getItem(chave) ?? null;
  } catch {
    return null;
  }
}

function gravar(armazenamento, chave, valor) {
  try {
    if (valor === null) armazenamento?.removeItem(chave);
    else armazenamento?.setItem(chave, valor);
  } catch {
    // Sem armazenamento: segue sem a marca.
  }
}

/** Chamado por "Entrar agora", antes de recarregar a página. */
export function marcarBoasVindasPendentes(janela = globalThis.window) {
  gravar(janela?.sessionStorage, CHAVE_PENDENTE, "1");
}

/** A tela de acesso desativado foi mostrada: na volta, é "reativado". */
export function lembrarContaDesativada(usuarioId, janela = globalThis.window) {
  if (usuarioId)
    gravar(janela?.localStorage, chaveDaDesativacao(usuarioId), "1");
}

function soltarConfete(doc, janela) {
  const canvas = doc.createElement("canvas");
  canvas.className = "acesso-liberado__confete";
  canvas.setAttribute("aria-hidden", "true");
  let contexto = null;
  try {
    contexto = canvas.getContext?.("2d") || null;
  } catch {
    contexto = null;
  }
  if (!contexto || !janela?.requestAnimationFrame) return;
  doc.body.appendChild(canvas);
  const largura = (canvas.width = janela.innerWidth || 800);
  const altura = (canvas.height = janela.innerHeight || 600);
  const pedacos = Array.from({ length: 140 }, (_, i) => ({
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
}

function mostrarMensagem(doc, texto, itens) {
  const aviso = doc.createElement("div");
  aviso.className = "acesso-liberado";
  aviso.setAttribute("role", "status");
  aviso.setAttribute("aria-live", "polite");
  const corpo = doc.createElement("div");
  corpo.className = "acesso-liberado__corpo";
  const frase = doc.createElement("strong");
  frase.textContent = texto;
  corpo.append(frase);
  if (itens.length) {
    const titulo = doc.createElement("span");
    titulo.textContent = "O que você já pode usar:";
    const lista = doc.createElement("ul");
    for (const item of itens) {
      const li = doc.createElement("li");
      li.textContent = item;
      lista.append(li);
    }
    corpo.append(titulo, lista);
  }
  const fechar = doc.createElement("button");
  fechar.type = "button";
  fechar.className = "acesso-liberado__fechar";
  fechar.setAttribute("aria-label", "Fechar mensagem");
  fechar.textContent = "×";
  fechar.addEventListener("click", () => aviso.remove());
  aviso.append(corpo, fechar);
  doc.body.appendChild(aviso);
  setTimeout(() => aviso.remove(), TEMPO_DA_MENSAGEM_MS);
  return aviso;
}

/**
 * Depois de abrir o app: comemora se for a hora e apaga/grava as marcas.
 * Devolve o tipo mostrado ("liberado" | "reativado") ou null.
 */
export function comemorarAcessoLiberado({
  usuario,
  perfil,
  doc = globalThis.document,
  janela = globalThis.window,
  agora = Date.now(),
} = {}) {
  const usuarioId = usuario?.id;
  const pedidoLiberado = ler(janela?.sessionStorage, CHAVE_PENDENTE) === "1";
  gravar(janela?.sessionStorage, CHAVE_PENDENTE, null);
  const estavaDesativada = Boolean(
    usuarioId && ler(janela?.localStorage, chaveDaDesativacao(usuarioId)),
  );
  const tipo = tipoDeComemoracao({
    usuarioId,
    estavaDesativada,
    jaComemorou: Boolean(ler(janela?.localStorage, chaveDoUsuario(usuarioId))),
    pedidoLiberado,
    contaCriadaEm: usuario?.created_at,
    perfilCriadoEm: perfil?.created_at,
    agora,
  });
  if (!tipo || !doc?.body) return null;
  gravar(janela?.localStorage, chaveDaDesativacao(usuarioId), null);
  gravar(
    janela?.localStorage,
    chaveDoUsuario(usuarioId),
    new Date(agora).toISOString(),
  );
  mostrarMensagem(
    doc,
    mensagemDaComemoracao(tipo, perfil?.nome, usuario?.email || perfil?.email),
    oQuePodeUsar(perfil),
  );
  const semMovimento = janela?.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  )?.matches;
  if (!semMovimento) soltarConfete(doc, janela);
  return tipo;
}
