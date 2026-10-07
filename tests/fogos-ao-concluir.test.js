import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CHAVE_DO_SOM } from "../src/lib/fogos-cena.js";
import { criarAleatorio } from "../src/lib/fogos.js";
import {
  comemorar,
  soltarConfete,
  soltarFogos,
} from "../src/modules/comemoracao.js";

/*
  O desenho dos fogos, com canvas e áudio falsos. Sorteio sempre fixo
  (`aleatorio: criarAleatorio(n)`): já houve teste instável por depender de
  Math.random sem semente.
*/

/* Um objeto que aceita qualquer chamada e atribuição (nó de áudio falso). */
const qualquer = () =>
  new Proxy(function () {}, {
    get: (_, chave) => (chave === "then" ? undefined : qualquer()),
    apply: () => qualquer(),
    set: () => true,
  });

/* Canvas 2D falso: registra o que foi chamado e o que foi atribuído. */
function janelaComCanvas({
  dpr = 1,
  tema = "",
  interagiu = false,
  movimento = true,
} = {}) {
  const quadros = [];
  const chamadas = [];
  const contagem = {};
  const atribuicoes = {};
  const contexto = new Proxy(
    {},
    {
      get:
        (_, chave) =>
        (...args) => {
          contagem[chave] = (contagem[chave] || 0) + 1;
          if (chave === "setTransform") chamadas.push([chave, ...args]);
        },
      set: (_, chave, valor) => {
        (atribuicoes[chave] ??= new Set()).add(valor);
        return true;
      },
    },
  );
  const doc = document.implementation.createHTMLDocument("t");
  // O documento do jsdom nasce "oculto"; aqui a aba está visível.
  Object.defineProperty(doc, "hidden", { value: false, configurable: true });
  if (tema) doc.documentElement.setAttribute("data-theme", tema);
  const criar = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = criar(tag);
    if (tag === "canvas") el.getContext = () => contexto;
    return el;
  };
  const guardado = new Map();
  const audios = [];
  const janela = {
    innerWidth: 1000,
    innerHeight: 700,
    devicePixelRatio: dpr,
    requestAnimationFrame: (fn) => quadros.push(fn),
    matchMedia: () => ({ matches: !movimento }),
    getComputedStyle: () => ({
      getPropertyValue: (nome) => (nome === "--brand-primary" ? "#0f5db7" : ""),
    }),
    localStorage: {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
      removeItem: (k) => guardado.delete(k),
    },
    navigator: { userActivation: { hasBeenActive: interagiu } },
    AudioContext: class {
      constructor() {
        audios.push(this);
        this.sampleRate = 8000;
        this.currentTime = 0;
        this.destination = qualquer();
        this.fechado = false;
      }
      createGain() {
        return qualquer();
      }
      createOscillator() {
        return qualquer();
      }
      createBufferSource() {
        return qualquer();
      }
      createBiquadFilter() {
        return qualquer();
      }
      createBuffer(_, tamanho) {
        return { getChannelData: () => new Float32Array(tamanho) };
      }
      resume() {}
      close() {
        this.fechado = true;
      }
    },
  };
  /* Roda os quadros a ~60 fps até o show acabar (ou `limite` quadros). */
  const rodar = (limite = 2000) => {
    let agora = 0;
    let n = 0;
    while (quadros.length && n < limite) {
      quadros.shift()(agora);
      agora += 16.7;
      n += 1;
    }
    return { n, agora };
  };
  return {
    doc,
    janela,
    quadros,
    chamadas,
    contagem,
    atribuicoes,
    rodar,
    guardado,
    audios,
  };
}

const sobras = (doc) =>
  doc.querySelectorAll(
    ".comemoracao__fogos, .comemoracao__veu, .comemoracao__aya",
  ).length;

describe("fogos de artifício no canvas", () => {
  it("sem canvas 2D ou sem requestAnimationFrame não faz nada", () => {
    const doc = document.implementation.createHTMLDocument("t");
    expect(soltarFogos(doc, { requestAnimationFrame: () => {} })).toBe(false);
    const { doc: comCanvas } = janelaComCanvas();
    expect(soltarFogos(comCanvas, { innerWidth: 10 })).toBe(false);
    expect(comCanvas.querySelector("canvas")).toBeNull();
    expect(sobras(comCanvas)).toBe(0);
  });

  it("canvas, véu e Aya sem clique, escondidos do leitor de tela; canvas nítido no devicePixelRatio", () => {
    const { doc, janela, chamadas } = janelaComCanvas({ dpr: 3 });
    expect(soltarFogos(doc, janela)).toEqual({ parar: expect.any(Function) });
    const canvas = doc.querySelector("canvas.comemoracao__fogos");
    expect(canvas.getAttribute("aria-hidden")).toBe("true");
    expect(
      doc.querySelector(".comemoracao__veu").getAttribute("aria-hidden"),
    ).toBe("true");
    expect(
      doc.querySelector(".comemoracao__aya").getAttribute("aria-hidden"),
    ).toBe("true");
    // DPR limitado a 2.
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1400);
    expect(chamadas).toContainEqual(["setTransform", 2, 0, 0, 2, 0, 0]);
    const css = readFileSync("src/styles/comemoracao.css", "utf8");
    for (const classe of ["fogos", "veu", "aya"])
      expect(css).toMatch(
        new RegExp(`\\.comemoracao__${classe} \\{[^}]*pointer-events: none`),
      );
  });

  it("desenha estouros com rastro, halos e fumaça e remove tudo sozinho em até 6 s", () => {
    const { doc, janela, contagem, atribuicoes, rodar } = janelaComCanvas({
      tema: "dark",
    });
    soltarFogos(doc, janela, {
      intensidade: "festa",
      forma: "estrela",
      aleatorio: criarAleatorio(7),
    });
    const { agora } = rodar();
    expect(sobras(doc)).toBe(0);
    expect(agora).toBeLessThanOrEqual(6100);
    expect(contagem.stroke).toBeGreaterThan(1000);
    expect([...atribuicoes.globalCompositeOperation]).toEqual(
      expect.arrayContaining(["destination-out", "lighter", "source-over"]),
    );
    // A cor da marca, lida do tema.
    expect(atribuicoes.strokeStyle.has("#0f5db7")).toBe(true);
  });

  it("no tema claro também soma luz: o véu escurece a tela por baixo", () => {
    const { doc, janela, atribuicoes, rodar } = janelaComCanvas();
    soltarFogos(doc, janela, { aleatorio: criarAleatorio(3) });
    rodar();
    expect(atribuicoes.globalCompositeOperation.has("lighter")).toBe(true);
  });

  it("o véu entra e sai com o show", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    soltarFogos(doc, janela, { aleatorio: criarAleatorio(4) });
    const veu = doc.querySelector(".comemoracao__veu");
    expect(veu.style.opacity).toBe("0");
    let agora = 0;
    for (let i = 0; i < 90; i += 1) quadros.shift()((agora += 16.7));
    expect(Number(veu.style.opacity)).toBe(1);
    while (quadros.length) quadros.shift()((agora += 16.7));
    expect(veu.isConnected).toBe(false);
  });

  it("a Aya voa (transform muda a cada quadro), solta o primeiro foguete e sai", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    soltarFogos(doc, janela, { aleatorio: criarAleatorio(5) });
    // A arara viva (src/modulos/aya/mascote/), batendo as asas.
    const aya = doc.querySelector(".comemoracao__aya");
    expect(aya.getAttribute("aria-hidden")).toBe("true");
    let agora = 0;
    const transformacoes = new Set();
    for (let i = 0; i < 60; i += 1) {
      quadros.shift()((agora += 16.7));
      transformacoes.add(aya.style.transform);
    }
    expect(transformacoes.size).toBeGreaterThan(30);
    // Depois do voo (2,2 s), sai da página; o show continua.
    for (let i = 0; i < 120; i += 1) quadros.shift()((agora += 16.7));
    expect(aya.isConnected).toBe(false);
    expect(doc.querySelector(".comemoracao__fogos")).not.toBeNull();
    // Sem a Aya, nenhuma imagem.
    const outra = janelaComCanvas();
    soltarFogos(outra.doc, outra.janela, {
      comAya: false,
      aleatorio: criarAleatorio(5),
    });
    expect(outra.doc.querySelector(".comemoracao__aya")).toBeNull();
  });

  it("número do marco sem canvas de verdade: a fonte de pontos dá conta", () => {
    const { doc, janela, rodar } = janelaComCanvas();
    expect(
      soltarFogos(doc, janela, {
        intensidade: "festa",
        forma: { tipo: "numero", texto: "1.000" },
        aleatorio: criarAleatorio(6),
      }),
    ).toBeTruthy();
    rodar();
    expect(sobras(doc)).toBe(0);
  });

  it("com a aba oculta, o show não avança", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    soltarFogos(doc, janela, { aleatorio: criarAleatorio(8) });
    Object.defineProperty(doc, "hidden", { value: true, configurable: true });
    let agora = 0;
    for (let i = 0; i < 600; i += 1) quadros.shift()((agora += 16.7));
    expect(doc.querySelector("canvas")).not.toBeNull();
    Object.defineProperty(doc, "hidden", { value: false, configurable: true });
    while (quadros.length) quadros.shift()((agora += 16.7));
    expect(doc.querySelector("canvas")).toBeNull();
  });

  it("parar remove tudo na hora, uma vez só, e avisa", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    let avisos = 0;
    const fogos = soltarFogos(doc, janela, {
      aleatorio: criarAleatorio(9),
      aoTerminar: () => (avisos += 1),
    });
    quadros.shift()(0);
    fogos.parar();
    fogos.parar();
    expect(sobras(doc)).toBe(0);
    expect(avisos).toBe(1);
    // O quadro que estava na fila não volta a desenhar.
    while (quadros.length) quadros.shift()(16.7);
    expect(quadros).toHaveLength(0);
  });

  it("soltarConfete (nome antigo) solta os mesmos fogos", () => {
    const { doc, janela } = janelaComCanvas();
    expect(soltarConfete(doc, janela, { quantidade: 50 })).toBeTruthy();
    expect(doc.querySelectorAll("canvas.comemoracao__fogos")).toHaveLength(1);
  });
});

describe("o aviso da comemoração", () => {
  const aviso = (doc) => doc.querySelector(".comemoracao");

  it("comemorar põe o aviso (com Pular e som) e os fogos", () => {
    const { doc, janela } = janelaComCanvas();
    comemorar({
      texto: "Parabéns!",
      confete: "festa",
      forma: "coracao",
      doc,
      janela,
      aleatorio: criarAleatorio(1),
    });
    expect(aviso(doc).textContent).toContain("Parabéns!");
    expect(doc.querySelectorAll("canvas.comemoracao__fogos")).toHaveLength(1);
    expect(aviso(doc).querySelector(".comemoracao__pular").textContent).toBe(
      "Pular",
    );
    expect(aviso(doc).querySelector(".comemoracao__som")).not.toBeNull();
  });

  it("Pular encerra o show na hora e o aviso fica", () => {
    const { doc, janela, quadros } = janelaComCanvas();
    comemorar({
      texto: "Oi",
      doc,
      janela,
      aleatorio: criarAleatorio(2),
    });
    quadros.shift()(0);
    aviso(doc).querySelector(".comemoracao__pular").click();
    expect(sobras(doc)).toBe(0);
    expect(aviso(doc)).not.toBeNull();
    expect(doc.querySelector(".comemoracao__pular")).toBeNull();
  });

  it("o show acaba sozinho: tira o Pular; o × fecha o aviso e encerra o show", () => {
    const { doc, janela, rodar, quadros } = janelaComCanvas();
    comemorar({ texto: "Oi", doc, janela, aleatorio: criarAleatorio(3) });
    rodar();
    expect(doc.querySelector(".comemoracao__pular")).toBeNull();
    expect(aviso(doc)).not.toBeNull();

    comemorar({ texto: "De novo", doc, janela, aleatorio: criarAleatorio(4) });
    quadros.shift()(0);
    [...doc.querySelectorAll(".comemoracao")]
      .at(-1)
      .querySelector(".comemoracao__fechar")
      .click();
    expect(doc.body.textContent).not.toContain("De novo");
    expect(sobras(doc)).toBe(0);
  });

  it("som desligado por padrão: nenhum áudio é criado, mesmo depois de interagir", () => {
    const { doc, janela, rodar, audios } = janelaComCanvas({ interagiu: true });
    comemorar({ texto: "Oi", doc, janela, aleatorio: criarAleatorio(5) });
    const botao = doc.querySelector(".comemoracao__som");
    expect(botao.getAttribute("aria-pressed")).toBe("false");
    expect(botao.getAttribute("aria-label")).toBe("Ligar som");
    rodar();
    expect(audios).toHaveLength(0);
  });

  it("o botão liga o som (é a interação), guarda a escolha e os estouros tocam", () => {
    const { doc, janela, rodar, audios, guardado } = janelaComCanvas();
    comemorar({ texto: "Oi", doc, janela, aleatorio: criarAleatorio(6) });
    const botao = doc.querySelector(".comemoracao__som");
    botao.click();
    expect(botao.getAttribute("aria-pressed")).toBe("true");
    expect(botao.getAttribute("aria-label")).toBe("Desligar som");
    expect(guardado.get(CHAVE_DO_SOM)).toBe("1");
    rodar();
    expect(audios).toHaveLength(1);
    // Fechar o aviso fecha o áudio.
    doc.querySelector(".comemoracao__fechar").click();
    expect(audios[0].fechado).toBe(true);
    // Desligar de novo também fica guardado.
    botao.click();
    expect(guardado.get(CHAVE_DO_SOM)).toBe("0");
  });

  it("som ligado de antes só toca depois de a pessoa interagir com a página", () => {
    const semInteracao = janelaComCanvas({ interagiu: false });
    semInteracao.guardado.set(CHAVE_DO_SOM, "1");
    comemorar({
      texto: "Oi",
      doc: semInteracao.doc,
      janela: semInteracao.janela,
      aleatorio: criarAleatorio(7),
    });
    expect(
      semInteracao.doc
        .querySelector(".comemoracao__som")
        .getAttribute("aria-pressed"),
    ).toBe("true");
    semInteracao.rodar();
    expect(semInteracao.audios).toHaveLength(0);

    const comInteracao = janelaComCanvas({ interagiu: true });
    comInteracao.guardado.set(CHAVE_DO_SOM, "1");
    comemorar({
      texto: "Oi",
      doc: comInteracao.doc,
      janela: comInteracao.janela,
      aleatorio: criarAleatorio(7),
    });
    comInteracao.rodar();
    expect(comInteracao.audios).toHaveLength(1);
  });

  it("confete: false, só o aviso (sem Pular nem som)", () => {
    const { doc, janela } = janelaComCanvas();
    comemorar({ texto: "Oi", confete: false, doc, janela });
    expect(aviso(doc)).not.toBeNull();
    expect(doc.querySelector("canvas")).toBeNull();
    expect(doc.querySelector(".comemoracao__pular")).toBeNull();
    expect(doc.querySelector(".comemoracao__som")).toBeNull();
  });

  it("com menos movimento, só a mensagem: sem animação, sem véu e sem a Aya voando", () => {
    const { doc, janela, quadros, audios } = janelaComCanvas({
      movimento: false,
      interagiu: true,
    });
    comemorar({
      texto: "Parabéns!",
      confete: "festa",
      forma: { tipo: "numero", texto: "1.000" },
      doc,
      janela,
    });
    expect(aviso(doc)).not.toBeNull();
    expect(sobras(doc)).toBe(0);
    expect(doc.querySelector(".comemoracao__pular")).toBeNull();
    expect(doc.querySelector(".comemoracao__som")).toBeNull();
    expect(quadros).toHaveLength(0);
    expect(audios).toHaveLength(0);
    expect(soltarFogos(doc, janela)).toBe(false);
  });

  it("o fim do tour (Concluir) celebra: fogos no tour, festa e estrela na trilha", () => {
    const aya = readFileSync("src/modulos/aya/aya.jsx", "utf8");
    expect(aya).toMatch(/motivo === "concluiu"\) celebrarFimDoTour\(tour\)/);
    expect(aya).toContain('confete: concluido.trilha ? "festa" : "fogos"');
    expect(aya).toContain('forma: concluido.trilha ? "estrela" : null');
  });
});
