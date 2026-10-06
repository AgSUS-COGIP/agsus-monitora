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
  O desenho das comemorações, sem biblioteca: um véu escuro suave, fogos de
  artifício num <canvas> (luz somada, halos e fumaça) por 5–6 s, a Aya (arara
  azul) atravessando a tela e soltando o primeiro foguete, o marco desenhado
  no céu pelo último estouro e um aviso no topo (role="status") com "Pular",
  o botão de som (desligado por padrão) e o ×. Com prefers-reduced-motion, só
  o aviso. O roteiro e a física são de src/lib/fogos.js; a cena (voo, véu,
  som), de src/lib/fogos-cena.js; a regra de quando comemorar, de
  src/lib/comemoracao.js. Quem usa: o acesso liberado
  (comemoracao-do-acesso.js), o painel de análises, a tela de Entrevistas
  (src/modulos/entrevistas/marcos.js), os marcos do ano
  (src/modulos/visao-geral/boas-vindas.jsx) e a Aya (fim de tour e de trilha).
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
export function criarSom(janela = globalThis.window) {
  let armazenamento = null;
  try {
    armazenamento = janela?.localStorage || null;
  } catch {
    armazenamento = null;
  }
  let ligado = somLigado(armazenamento);
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

// ── Fogos ───────────────────────────────────────────────────────────────────

/**
 * Fogos de artifício por 5–6 s: "pequeno", "cheio" (padrão), "fogos" (fim
 * de um tour) ou "festa" (fim de uma trilha, marco do ano). `forma` é o
 * marco no céu ("coracao", "estrela", "check" ou { tipo: "numero", texto });
 * `comAya` põe a Aya voando; `som` (de criarSom) toca os estouros;
 * `aoTerminar` é chamado quando tudo some (fim ou `parar`); `aleatorio`
 * fixa o sorteio (testes). Véu, canvas e
 * Aya sem clique, nítidos no devicePixelRatio, pausam com a aba oculta e se
 * removem ao fim. Não faz nada sem canvas 2D, sem requestAnimationFrame ou
 * com menos movimento (devolve false); senão, devolve `{ parar }`.
 */
export function soltarFogos(
  doc = globalThis.document,
  janela = globalThis.window,
  {
    intensidade = "cheio",
    forma = null,
    comAya = true,
    som = null,
    aoTerminar = null,
    aleatorio = Math.random,
  } = {},
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
  const veu = doc.createElement("div");
  veu.className = "comemoracao__veu";
  veu.setAttribute("aria-hidden", "true");
  veu.style.opacity = "0";
  doc.body.append(veu, canvas);
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
    comAya: comAya !== false,
    forma,
    aleatorio,
    amostrarTexto: (texto) => amostrarTexto(doc, janela, texto),
  });
  const aya = show.aya ? criarAya(doc, show.aya) : null;
  if (aya) doc.body.append(aya);
  const halo = criarHalos(doc);
  let parado = false;
  const parar = () => {
    if (parado) return;
    parado = true;
    canvas.remove();
    veu.remove();
    aya?.remove();
    aoTerminar?.();
  };
  let anterior = null;
  const quadro = (agora) => {
    if (parado) return;
    // Aba oculta: não avança (o navegador também segura os quadros).
    const dt = anterior === null || doc.hidden ? 0 : (agora - anterior) / 1000;
    anterior = agora;
    avancarShow(show, dt);
    desenhar(contexto, show, { largura, altura, dt, halo });
    veu.style.opacity = String(opacidadeDoVeu(show.t, show.duracao));
    if (aya) moverAya(aya, show.aya, show.t);
    for (const evento of show.eventos.splice(0))
      som?.tocar?.(somDoEstouro(evento));
    if (showAcabou(show)) parar();
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

/**
 * Aviso + fogos. `confete` (o nome ficou) é a intensidade: "pequeno",
 * "cheio", "fogos", "festa" ou false (só o aviso); `forma`, o marco no céu.
 * Com fogos, o aviso ganha "Pular" (some quando o show acaba) e o botão de
 * som; o × também encerra o show. Sem fogos quando a pessoa pediu menos
 * movimento. Devolve o aviso (ou null).
 */
export function comemorar({
  texto,
  itens = [],
  tituloDosItens = "",
  confete = "cheio",
  forma = null,
  doc = globalThis.document,
  janela = globalThis.window,
  aleatorio,
} = {}) {
  const animar = Boolean(confete) && !semMovimento(janela);
  const som = animar ? criarSom(janela) : null;
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
    intensidade: confete,
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
 * primeira vez) e, se `decidir(anterior)` devolver `{ texto, itens, forma }`
 * e as comemorações estiverem ligadas, comemora. O estado é guardado mesmo
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
