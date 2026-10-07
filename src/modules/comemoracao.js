import {
  comemoracoesLigadasNaResposta,
  trocarEstadoGuardado,
} from "../lib/comemoracao.js";
import {
  alfaDoRastro,
  brilhoDaParticula,
  corDaParticula,
  fatorDeSaida,
  paletaDosFogos,
} from "../lib/fogos.js";
import {
  avancarCena,
  cenaAcabou,
  criarCena,
  desenharParticulasDoMotor,
  efeitoChamaAya,
  normalizarDuracao,
  DURACAO_PADRAO_MS,
} from "../lib/motor-de-efeitos.js";
import {
  comemoracoesPessoaisLigadas,
  decidirComemoracao,
  duracaoMsDasOpcoes,
} from "../lib/catalogo-de-comemoracoes.ts";
import {
  guardarSom,
  IMAGEM_DA_AYA,
  opacidadeDoVeu,
  podeTocarSom,
  posicaoDaAya,
  somDoEstouro,
  somLigado,
} from "../lib/fogos-cena.js";
import { criarIcone } from "./icones.js";
import "../styles/comemoracao.css";

/*
  O desenho das comemorações, sem biblioteca: o efeito escolhido (fogos,
  confete, serpentina, chuva de estrelas, corações, balões, a Aya comemorando
  ou o combinado — src/lib/motor-de-efeitos.js) num <canvas>, um véu escuro
  suave quando há fogos ou estrelas, e um aviso no topo (role="status") com
  "Pular", o botão de som (desligado por padrão) e o ×. Os fogos: luz
  somada, halos e fumaça por 5–6 s (ou a duração configurada), a Aya (arara
  azul) atravessando a tela e soltando o primeiro foguete e o marco desenhado
  no céu pelo último estouro. Com prefers-reduced-motion, só o aviso.

  Cada comemoração de marco passa `marco` (id do catálogo de
  src/lib/catalogo-de-comemoracoes.ts): Configurações › Comemorações decide
  se aparece, o efeito, a intensidade, a duração, o som e a mensagem; a
  preferência pessoal (neste navegador) também desliga. `teste: true` (botão
  Testar e Palco de testes) passa por cima das duas e não grava nada.

  "Aya comemorando" não desenha a arara aqui: avisa a mascote pelo evento
  `aya:estado` na janela (detail: { estado: "comemorando", duracaoMs }) e,
  ao terminar, `{ estado: "parada" }` — a mascote decide como reage.

  O roteiro e a física dos fogos são de src/lib/fogos.js; a cena (voo, véu,
  som), de src/lib/fogos-cena.js; a regra de quando comemorar, de
  src/lib/comemoracao.js. Quem usa: o acesso liberado
  (comemoracao-do-acesso.js), o painel de análises, a tela de Entrevistas
  (src/modulos/entrevistas/marcos.js), os marcos do ano
  (src/modulos/visao-geral/boas-vindas.tsx) e a Aya (fim de tour e de trilha).
*/

export const TEMPO_DO_AVISO_MS = 12000;
/* Densidade de pixels no canvas: nítido em tela retina, sem passar de 2x. */
const DPR_MAXIMO = 2;

/** @param {Window | undefined} [janela] */
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

/*
  O brilho (bloom barato): um halo por cor — gradiente radial branco que
  some, tingido com 'source-in' —, feito uma vez e reaproveitado com
  drawImage. Sem gradiente (canvas limitado), sem halo.
*/
function criarHalos(doc) {
  const feitos = new Map();
  return (cor) => {
    if (feitos.has(cor)) return feitos.get(cor);
    let halo = null;
    try {
      const canvas = doc.createElement("canvas");
      canvas.width = 64;
      canvas.height = 64;
      const contexto = canvas.getContext?.("2d");
      const gradiente = contexto?.createRadialGradient?.(32, 32, 0, 32, 32, 32);
      if (gradiente) {
        gradiente.addColorStop(0, "rgba(255, 255, 255, 1)");
        gradiente.addColorStop(0.2, "rgba(255, 255, 255, 0.55)");
        gradiente.addColorStop(1, "rgba(255, 255, 255, 0)");
        contexto.fillStyle = gradiente;
        contexto.fillRect(0, 0, 64, 64);
        contexto.globalCompositeOperation = "source-in";
        contexto.fillStyle = cor;
        contexto.fillRect(0, 0, 64, 64);
        halo = canvas;
      }
    } catch {
      halo = null;
    }
    feitos.set(cor, halo);
    return halo;
  };
}

function ponto(contexto, x, y, raio) {
  contexto.beginPath();
  contexto.arc(x, y, raio, 0, Math.PI * 2);
  contexto.fill();
}

/*
  Um quadro: apaga parte do anterior (rastro), desenha a fumaça por cima do
  véu e acende, somando luz, foguetes, faíscas, halos e o marco.
*/
function desenhar(contexto, show, { largura, altura, dt, halo }) {
  contexto.globalCompositeOperation = "destination-out";
  contexto.globalAlpha = 1;
  contexto.fillStyle = `rgba(0, 0, 0, ${alfaDoRastro(dt)})`;
  contexto.fillRect(0, 0, largura, altura);
  const saida = fatorDeSaida(show.t, show.duracao);

  // Fumaça: nuvens macias (o mesmo halo, grande e tênue).
  contexto.globalCompositeOperation = "source-over";
  for (const p of show.particulas) {
    if (p.tipo !== "fumaca") continue;
    const nuvem = halo(p.cor);
    if (!nuvem) continue;
    contexto.globalAlpha = brilhoDaParticula(p) * saida;
    const r = p.tamanho;
    contexto.drawImage(nuvem, p.x - r, p.y - r, 2 * r, 2 * r);
  }

  contexto.globalCompositeOperation = show.paleta.composicao;
  contexto.lineCap = "round";
  for (const f of show.foguetes) {
    contexto.globalAlpha = saida;
    contexto.fillStyle = show.paleta.dourado;
    ponto(contexto, f.x, f.y, 2.2 * show.escala);
    const brilho = halo(show.paleta.dourado);
    if (brilho) {
      const r = 12 * show.escala;
      contexto.globalAlpha = 0.5 * saida;
      contexto.drawImage(brilho, f.x - r, f.y - r, 2 * r, 2 * r);
    }
  }
  show.particulas.forEach((p, i) => {
    if (p.tipo === "fumaca" || p.tipo === "semente") return;
    const brilho = brilhoDaParticula(p, show.aleatorio) * saida;
    if (brilho <= 0.01) return;
    const cor = corDaParticula(p);
    if (p.tipo === "clarao") {
      const imagem = halo(cor);
      const raio = p.tamanho * (1.4 - p.vida / p.vidaMax);
      contexto.globalAlpha = brilho;
      if (imagem)
        contexto.drawImage(imagem, p.x - raio, p.y - raio, 2 * raio, 2 * raio);
      else {
        contexto.fillStyle = cor;
        ponto(contexto, p.x, p.y, raio * 0.6);
      }
      return;
    }
    contexto.globalAlpha = brilho;
    if (Math.hypot(p.vx, p.vy) < 4) {
      // Parada (a forma do marco): um ponto.
      contexto.fillStyle = cor;
      ponto(contexto, p.x, p.y, p.tamanho * 0.8);
    } else {
      // Um traço do ponto até onde estava há pouco: o rastro de cada faísca.
      const recuo = 0.016 + 0.03 * p.rastro;
      contexto.strokeStyle = cor;
      contexto.lineWidth = p.tamanho;
      contexto.beginPath();
      contexto.moveTo(p.x - p.vx * recuo, p.y - p.vy * recuo);
      contexto.lineTo(p.x, p.y);
      contexto.stroke();
    }
    // Halo: em toda faísca do marco; nas outras, nas mais fortes (metade).
    const doMarco = p.tipo === "alvo";
    if (!doMarco && (brilho < 0.35 || p.tamanho < 1.6 || i % 2)) return;
    const imagem = halo(cor);
    if (!imagem) return;
    const raio = p.tamanho * (doMarco ? 3.5 : 4);
    contexto.globalAlpha = brilho * (doMarco ? 0.4 : 0.3);
    contexto.drawImage(imagem, p.x - raio, p.y - raio, 2 * raio, 2 * raio);
  });
}

/*
  O texto do marco em pixels: escrito num canvas fora da tela (fillText) e
  lido com getImageData. Sem canvas 2D, null (fogos-formas.js usa a fonte de
  pontos).
*/
function amostrarTexto(doc, janela, texto) {
  try {
    const canvas = doc.createElement("canvas");
    const largura = 640;
    const altura = 220;
    canvas.width = largura;
    canvas.height = altura;
    const contexto = canvas.getContext?.("2d", { willReadFrequently: true });
    if (!contexto?.fillText || !contexto.getImageData) return null;
    let familia = "system-ui, sans-serif";
    try {
      familia = janela.getComputedStyle?.(doc.body)?.fontFamily || familia;
    } catch {
      /* fica a padrão */
    }
    let corpo = 170;
    contexto.font = `800 ${corpo}px ${familia}`;
    const medida = contexto.measureText?.(texto)?.width || 0;
    if (medida > largura * 0.94) {
      corpo = Math.floor((corpo * largura * 0.94) / medida);
      contexto.font = `800 ${corpo}px ${familia}`;
    }
    contexto.textAlign = "center";
    contexto.textBaseline = "middle";
    contexto.fillStyle = "#fff";
    contexto.fillText(texto, largura / 2, altura / 2);
    const imagem = contexto.getImageData(0, 0, largura, altura);
    return imagem?.data ? imagem : null;
  } catch {
    return null;
  }
}

/* A Aya: a imagem do sistema, movida por transform a cada quadro. */
function criarAya(doc, trajeto) {
  const imagem = doc.createElement("img");
  imagem.className = "comemoracao__aya";
  imagem.alt = "";
  imagem.setAttribute("aria-hidden", "true");
  imagem.decoding = "async";
  imagem.style.width = `${trajeto.tamanho}px`;
  imagem.style.height = `${trajeto.tamanho}px`;
  imagem.style.opacity = "0";
  imagem.addEventListener("error", () => imagem.remove());
  imagem.src = IMAGEM_DA_AYA;
  return imagem;
}

function moverAya(imagem, trajeto, t) {
  if (!imagem?.isConnected) return;
  if (t > trajeto.inicio + trajeto.duracao) {
    imagem.remove();
    return;
  }
  const aya = posicaoDaAya(trajeto, t);
  if (!aya) return;
  const meio = trajeto.tamanho / 2;
  imagem.style.opacity = String(aya.opacidade);
  imagem.style.transform = `translate(${aya.x - meio}px, ${aya.y - meio}px) rotate(${aya.rotacao}rad) scale(${aya.escalaX}, ${aya.escalaY})`;
}

// ── Som (opcional, desligado por padrão) ────────────────────────────────────

/* Ruído branco que decai: a matéria-prima do estalo. */
function ruido(audio, duracao) {
  const tamanho = Math.max(1, Math.ceil(audio.sampleRate * duracao));
  const buffer = audio.createBuffer(1, tamanho, audio.sampleRate);
  const dados = buffer.getChannelData(0);
  for (let i = 0; i < tamanho; i += 1)
    dados[i] = (Math.random() * 2 - 1) * (1 - i / tamanho) ** 2;
  return buffer;
}

function rajada(audio, saida, { inicio, duracao, corte, filtro = "lowpass" }) {
  const fonte = audio.createBufferSource();
  fonte.buffer = ruido(audio, duracao);
  const passa = audio.createBiquadFilter();
  passa.type = filtro;
  passa.frequency.value = corte;
  const volume = audio.createGain();
  volume.gain.setValueAtTime(1, inicio);
  volume.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
  fonte.connect(passa);
  passa.connect(volume);
  volume.connect(saida);
  fonte.start(inicio);
  fonte.stop(inicio + duracao);
}

function baque(audio, saida, { inicio, frequencia, duracao }) {
  const oscilador = audio.createOscillator();
  oscilador.type = "sine";
  oscilador.frequency.setValueAtTime(frequencia * 1.6, inicio);
  oscilador.frequency.exponentialRampToValueAtTime(
    frequencia,
    inicio + duracao * 0.5,
  );
  const volume = audio.createGain();
  volume.gain.setValueAtTime(0.8, inicio);
  volume.gain.exponentialRampToValueAtTime(0.001, inicio + duracao);
  oscilador.connect(volume);
  volume.connect(saida);
  oscilador.start(inicio);
  oscilador.stop(inicio + duracao);
}

/* Estalos suaves sintetizados (sem arquivo): baque + chiado, ou crepitar. */
function sintetizar(audio, { tipo, volume }) {
  const agora = audio.currentTime || 0;
  const mestre = audio.createGain();
  mestre.gain.value = 0.2 * volume;
  mestre.connect(audio.destination);
  if (tipo === "crepitar") {
    for (let i = 0; i < 8; i += 1)
      rajada(audio, mestre, {
        inicio: agora + 0.12 + i * 0.05 + Math.random() * 0.04,
        duracao: 0.025,
        corte: 2500,
        filtro: "highpass",
      });
    return;
  }
  const grave = tipo === "grave";
  rajada(audio, mestre, {
    inicio: agora,
    duracao: grave ? 0.5 : 0.28,
    corte: grave ? 900 : 1600,
  });
  baque(audio, mestre, {
    inicio: agora,
    frequencia: grave ? 55 : 85,
    duracao: grave ? 0.6 : 0.3,
  });
}

/**
 * O som das comemorações: desligado por padrão, liga no botão do aviso (a
 * escolha fica neste navegador). Só toca depois de a pessoa interagir com a
 * página; o AudioContext só nasce quando vai tocar.
 */
export function criarSom(
  janela = globalThis.window,
  { ligadoPorPadrao = false } = {},
) {
  let armazenamento = null;
  try {
    armazenamento = janela?.localStorage || null;
  } catch {
    armazenamento = null;
  }
  // O marco configurado com som começa ligado (sem guardar a escolha).
  let ligado = ligadoPorPadrao === true || somLigado(armazenamento);
  let interagiu = janela?.navigator?.userActivation?.hasBeenActive === true;
  let audio = null;
  const contexto = () => {
    if (audio) return audio;
    const Classe = janela?.AudioContext || janela?.webkitAudioContext;
    if (!Classe) return null;
    try {
      audio = new Classe();
    } catch {
      audio = null;
    }
    return audio;
  };
  return {
    get ligado() {
      return ligado;
    },
    /** O clique no botão: é a interação que libera o áudio. */
    alternar() {
      interagiu = true;
      ligado = !ligado;
      guardarSom(armazenamento, ligado);
      return ligado;
    },
    /** Toca um som (de somDoEstouro), se pode. Devolve se tocou. */
    tocar(som) {
      if (!podeTocarSom({ ligado, interagiu })) return false;
      const atual = contexto();
      if (!atual) return false;
      try {
        atual.resume?.();
        sintetizar(atual, som);
        return true;
      } catch {
        return false;
      }
    },
    fechar() {
      try {
        audio?.close?.();
      } catch {
        /* nada a fazer */
      }
      audio = null;
    },
  };
}

// ── Efeitos ─────────────────────────────────────────────────────────────────

/* O aviso à mascote (ponto de integração fino; a mascote ouve, se existir). */
export const EVENTO_DA_AYA = "aya:estado";
function avisarAya(janela, detalhe) {
  try {
    const Evento = janela?.CustomEvent || globalThis.CustomEvent;
    janela?.dispatchEvent?.(new Evento(EVENTO_DA_AYA, { detail: detalhe }));
  } catch {
    /* sem mascote ou sem eventos: nada a fazer */
  }
}

function criarCanvas(doc, classe) {
  const canvas = doc.createElement("canvas");
  canvas.className = classe;
  canvas.setAttribute("aria-hidden", "true");
  let contexto = null;
  try {
    contexto = canvas.getContext?.("2d") || null;
  } catch {
    contexto = null;
  }
  return { canvas, contexto };
}

/**
 * Solta um efeito: `efeito` ("fogos" — padrão —, "confete", "serpentina",
 * "estrelas", "coracoes", "baloes", "aya" ou "combinado"), `intensidade`
 * ("suave", "normal", "festa"; aceita os nomes antigos dos fogos: "pequeno",
 * "cheio", "fogos") e `duracaoMs` (vazia: a padrão do efeito). `forma` é o
 * marco no céu dos fogos ("coracao", "estrela", "check" ou { tipo: "numero",
 * texto }); `comAya` põe a Aya voando nos fogos; `som` (de criarSom) toca
 * os estouros; `aoTerminar` é chamado quando tudo some (fim ou `parar`);
 * `aleatorio` fixa o sorteio (testes). Véu e canvas sem clique, nítidos no
 * devicePixelRatio, pausam com a aba oculta e se removem ao fim. Não faz
 * nada sem canvas 2D, sem requestAnimationFrame ou com menos movimento
 * (devolve false); senão, devolve `{ parar }`.
 */
export function soltarFogos(
  doc = globalThis.document,
  janela = globalThis.window,
  {
    efeito = "fogos",
    intensidade = "cheio",
    duracaoMs = null,
    forma = null,
    comAya = true,
    som = null,
    aoTerminar = null,
    aleatorio = Math.random,
  } = {},
) {
  if (!doc?.body || semMovimento(janela)) return false;
  if (!janela?.requestAnimationFrame) return false;
  const chamaAya = efeitoChamaAya(efeito);
  // Só a Aya: nada a desenhar; o evento e um relógio para o fim.
  if (efeito === "aya") {
    const duracao = normalizarDuracao(duracaoMs) ?? DURACAO_PADRAO_MS;
    let parado = false;
    const parar = () => {
      if (parado) return;
      parado = true;
      avisarAya(janela, { estado: "parada" });
      aoTerminar?.();
    };
    avisarAya(janela, { estado: "comemorando", duracaoMs: duracao });
    setTimeout(parar, duracao);
    return { parar };
  }
  const fogos = criarCanvas(doc, "comemoracao__fogos");
  if (!fogos.contexto) return false;
  const largura = janela.innerWidth || 800;
  const altura = janela.innerHeight || 600;
  const cena = criarCena({
    efeito,
    intensidade,
    duracaoMs,
    largura,
    altura,
    paleta: paletaDoTema(doc, janela),
    // Com a mascote comemorando, a arara voando dos fogos fica de fora.
    comAya: comAya !== false && !chamaAya,
    forma,
    aleatorio,
    amostrarTexto: (texto) => amostrarTexto(doc, janela, texto),
  });
  const show = cena.show;
  // Os fogos apagam o quadro anterior aos poucos (rastro); o motor limpa
  // tudo a cada quadro: um canvas para cada, quando há os dois.
  const motor = cena.lotes.length
    ? show
      ? criarCanvas(doc, "comemoracao__fogos comemoracao__motor")
      : fogos
    : null;
  if (motor && !motor.contexto) return false;
  const veu = cena.comVeu ? doc.createElement("div") : null;
  if (veu) {
    veu.className = "comemoracao__veu";
    veu.setAttribute("aria-hidden", "true");
    veu.style.opacity = "0";
    doc.body.append(veu);
  }
  const telas = [fogos, ...(motor && motor !== fogos ? [motor] : [])];
  const dpr = Math.min(DPR_MAXIMO, Math.max(1, janela.devicePixelRatio || 1));
  for (const { canvas, contexto } of telas) {
    doc.body.append(canvas);
    canvas.width = Math.round(largura * dpr);
    canvas.height = Math.round(altura * dpr);
    contexto.setTransform?.(dpr, 0, 0, dpr, 0, 0);
  }
  const aya = show?.aya ? criarAya(doc, show.aya) : null;
  if (aya) doc.body.append(aya);
  const halo = criarHalos(doc);
  if (chamaAya)
    avisarAya(janela, {
      estado: "comemorando",
      duracaoMs: Math.round(cena.duracao * 1000),
    });
  let parado = false;
  const parar = () => {
    if (parado) return;
    parado = true;
    for (const { canvas } of telas) canvas.remove();
    veu?.remove();
    aya?.remove();
    if (chamaAya) avisarAya(janela, { estado: "parada" });
    aoTerminar?.();
  };
  let anterior = null;
  const quadro = (agora) => {
    if (parado) return;
    // Aba oculta: não avança (o navegador também segura os quadros).
    const dt = anterior === null || doc.hidden ? 0 : (agora - anterior) / 1000;
    anterior = agora;
    avancarCena(cena, dt);
    if (show) desenhar(fogos.contexto, show, { largura, altura, dt, halo });
    if (motor) {
      motor.contexto.clearRect?.(0, 0, largura, altura);
      desenharParticulasDoMotor(motor.contexto, cena);
    }
    if (veu) veu.style.opacity = String(opacidadeDoVeu(cena.t, cena.duracao));
    if (aya) moverAya(aya, show.aya, show.t);
    for (const evento of cena.eventos.splice(0))
      som?.tocar?.(somDoEstouro(evento));
    if (cenaAcabou(cena)) parar();
    else janela.requestAnimationFrame(quadro);
  };
  janela.requestAnimationFrame(quadro);
  return { parar };
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

/**
 * O aviso no topo: a frase e, se houver, uma lista curta. `aoFechar` é
 * chamado quando ele sai (× ou tempo).
 */
export function mostrarAviso(
  doc = globalThis.document,
  {
    texto,
    itens = [],
    tituloDosItens = "",
    tempoMs = TEMPO_DO_AVISO_MS,
    aoFechar = null,
  } = {},
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
  let aberto = true;
  const fecharAviso = () => {
    if (!aberto) return;
    aberto = false;
    aviso.remove();
    aoFechar?.();
  };
  const fechar = doc.createElement("button");
  fechar.type = "button";
  fechar.className = "comemoracao__fechar";
  fechar.setAttribute("aria-label", "Fechar mensagem");
  fechar.textContent = "×";
  fechar.addEventListener("click", fecharAviso);
  aviso.append(corpo, fechar);
  doc.body.appendChild(aviso);
  setTimeout(fecharAviso, tempoMs);
  return aviso;
}

/* O ícone e o rótulo do botão de som, conforme o estado. */
function marcarSom(botao, ligado) {
  const rotulo = ligado ? "Desligar som" : "Ligar som";
  botao.setAttribute("aria-pressed", String(ligado));
  botao.setAttribute("aria-label", rotulo);
  botao.title = rotulo;
  botao.replaceChildren(
    criarIcone(ligado ? "volume-2" : "volume-x", { tamanho: 16 }),
  );
}

function armazenamentoDa(janela) {
  try {
    return janela?.localStorage || null;
  } catch {
    return null;
  }
}

/**
 * O que soltar: com `marco`, a configuração dele (ou nada, se desligado —
 * no marco ou na preferência pessoal); sem `marco`, o pedido direto
 * (`efeito`/`intensidade`/`duracaoMs`, ou `confete`, o nome antigo da
 * intensidade dos fogos: "pequeno", "cheio", "fogos", "festa" ou false).
 */
export function planoDaComemoracao({
  marco = "",
  teste = false,
  confete = "cheio",
  efeito = null,
  intensidade = null,
  duracaoMs = null,
  som = false,
  janela = globalThis.window,
} = {}) {
  if (marco) {
    const { mostrar, opcoes } = decidirComemoracao({
      marco,
      teste,
      pessoal: comemoracoesPessoaisLigadas(armazenamentoDa(janela)),
    });
    if (!mostrar) return null;
    if (opcoes && !(teste && efeito))
      return {
        efeito: opcoes.efeito,
        intensidade: opcoes.intensidade,
        duracaoMs: duracaoMsDasOpcoes(opcoes),
        som: opcoes.som,
        mensagem: opcoes.mensagem,
      };
  } else if (!teste && !comemoracoesPessoaisLigadas(armazenamentoDa(janela)))
    return null;
  if (efeito)
    return {
      efeito,
      intensidade: intensidade || "normal",
      duracaoMs,
      som: som === true,
      mensagem: "",
    };
  return confete
    ? {
        efeito: "fogos",
        intensidade: confete === true ? "cheio" : confete,
        duracaoMs: null,
        som: false,
        mensagem: "",
      }
    : {
        efeito: null,
        intensidade: null,
        duracaoMs: null,
        som: false,
        mensagem: "",
      };
}

/**
 * Aviso + efeito. Com `marco` (id do catálogo ou de um personalizado), a
 * configuração de Configurações › Comemorações decide; desligado, nada
 * aparece (devolve null). `teste` ignora a configuração e a preferência
 * pessoal, e `efeito`/`intensidade`/`duracaoMs`/`som` escolhem na hora
 * (Palco de testes). `confete` (nome antigo) é a intensidade dos fogos de
 * quem não passa marco ("pequeno", "cheio", "fogos", "festa" ou false: só o
 * aviso); `forma`, o marco no céu. Com efeito, o aviso ganha "Pular" (some
 * quando o efeito acaba) e o botão de som; o × também encerra. Sem efeito
 * quando a pessoa pediu menos movimento. Devolve o aviso (ou null).
 */
/**
 * @param {{texto?: string, itens?: readonly string[], tituloDosItens?: string, forma?: string | {tipo: string, texto: string} | null, confete?: string | boolean, marco?: string, teste?: boolean, efeito?: string | null, intensidade?: string | null, duracaoMs?: number | null, som?: boolean, doc?: Document, janela?: Window, aleatorio?: () => number}} [opcoes]
 */
export function comemorar({
  texto,
  itens = [],
  tituloDosItens = "",
  confete = "cheio",
  forma = null,
  marco = "",
  teste = false,
  efeito = null,
  intensidade = null,
  duracaoMs = null,
  som: comSom = false,
  doc = globalThis.document,
  janela = globalThis.window,
  aleatorio,
} = {}) {
  const plano = planoDaComemoracao({
    marco,
    teste,
    confete,
    efeito,
    intensidade,
    duracaoMs,
    som: comSom,
    janela,
  });
  if (!plano) return null;
  if (plano.mensagem) texto = plano.mensagem;
  const animar = Boolean(plano.efeito) && !semMovimento(janela);
  const som = animar
    ? criarSom(janela, { ligadoPorPadrao: plano.som === true })
    : null;
  let fogos = null;
  const aviso = mostrarAviso(doc, {
    texto,
    itens,
    tituloDosItens,
    aoFechar: () => {
      fogos?.parar?.();
      som?.fechar();
    },
  });
  if (!aviso || !animar) return aviso;
  const acoes = doc.createElement("div");
  acoes.className = "comemoracao__acoes";
  const botaoSom = doc.createElement("button");
  botaoSom.type = "button";
  botaoSom.className = "comemoracao__som";
  marcarSom(botaoSom, som.ligado);
  botaoSom.addEventListener("click", () => marcarSom(botaoSom, som.alternar()));
  const pular = doc.createElement("button");
  pular.type = "button";
  pular.className = "comemoracao__pular";
  pular.textContent = "Pular";
  pular.addEventListener("click", () => fogos?.parar?.());
  acoes.append(botaoSom, pular);
  fogos = soltarFogos(doc, janela, {
    efeito: plano.efeito,
    intensidade: plano.intensidade,
    duracaoMs: plano.duracaoMs,
    forma,
    som,
    aoTerminar: () => pular.remove(),
    ...(aleatorio ? { aleatorio } : {}),
  });
  if (fogos)
    aviso.insertBefore(acoes, aviso.querySelector(".comemoracao__fechar"));
  else som.fechar();
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
 * primeira vez) e, se `decidir(anterior)` devolver `{ texto, itens, forma,
 * marco }` e as comemorações estiverem ligadas, comemora (`marco` é o id
 * do catálogo: a configuração dele decide o efeito). O estado é guardado
 * mesmo desligado, para que religar não traga o que aconteceu no meio.
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
