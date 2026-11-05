import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  avaliarMarcosPersonalizados,
  instalarMarcosDosEditais,
} from "../src/app/marcos-personalizados.ts";
import {
  CHAVE_DA_PREFERENCIA_PESSOAL,
  definirConfiguracaoDasComemoracoes,
  normalizarConfiguracao,
} from "../src/lib/catalogo-de-comemoracoes.ts";
import { criarAleatorio } from "../src/lib/fogos.ts";
import { EVENTO_DA_AYA } from "../src/modulos/comemoracao/comemoracoes.tsx";
import { planoDaComemoracao } from "../src/modulos/comemoracao/plano.ts";
import {
  encerrarShowsAoFimDeCadaTeste,
  filaDeQuadros,
} from "./shows-de-comemoracao.js";

/*
  As comemorações com a configuração de Configurações › Comemorações:
  marco desligado não aparece, a preferência pessoal desliga, o teste passa
  por cima, cada efeito monta o canvas certo e a Aya é avisada por evento.
  Canvas falso e sorteio fixo.
*/

const shows = encerrarShowsAoFimDeCadaTeste();
const { comemorar, clicar } = shows;

/* O efeito pedido direto (o Palco de testes), sem passar pela configuração. */
const soltarFogos = (doc, janela, opcoes = {}) =>
  comemorar({ texto: "Efeito", teste: true, doc, janela, ...opcoes });
const avisoDe = (doc) => doc.querySelector(".comemoracao");

function janelaFalsa({ movimento = true } = {}) {
  const { quadros, requestAnimationFrame } = filaDeQuadros();
  const eventos = [];
  const contexto = new Proxy({}, { get: () => () => {}, set: () => true });
  const doc = shows.acompanhar(document.implementation.createHTMLDocument("t"));
  Object.defineProperty(doc, "hidden", { value: false, configurable: true });
  const criar = doc.createElement.bind(doc);
  doc.createElement = (tag) => {
    const el = criar(tag);
    if (tag === "canvas") el.getContext = () => contexto;
    return el;
  };
  const guardado = new Map();
  const janela = {
    innerWidth: 1000,
    innerHeight: 700,
    devicePixelRatio: 1,
    requestAnimationFrame,
    matchMedia: () => ({ matches: !movimento }),
    getComputedStyle: () => ({ getPropertyValue: () => "" }),
    localStorage: {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
      removeItem: (k) => guardado.delete(k),
    },
    navigator: { userActivation: { hasBeenActive: false } },
    CustomEvent,
    dispatchEvent: (evento) => eventos.push(evento),
  };
  const rodar = (limite = 3000) => {
    let agora = 0;
    let n = 0;
    while (quadros.length && n < limite) {
      quadros.shift()(agora);
      agora += 16.7;
      n += 1;
    }
    return n;
  };
  return { doc, janela, quadros, eventos, guardado, rodar };
}

const canvases = (doc) => doc.querySelectorAll("canvas").length;
const veus = (doc) => doc.querySelectorAll(".comemoracao__veu").length;

afterEach(() => {
  definirConfiguracaoDasComemoracoes("");
  vi.useRealTimers();
});

describe("comemorar com a configuração dos marcos", () => {
  it("marco desligado: nada aparece; sem marco, o pedido de sempre", () => {
    definirConfiguracaoDasComemoracoes(
      JSON.stringify({ marcos: { "fila-zerada": { ligado: false } } }),
    );
    const { doc, janela } = janelaFalsa();
    expect(
      comemorar({ texto: "Fila zerada!", marco: "fila-zerada", doc, janela }),
    ).toBeNull();
    expect(doc.querySelector(".comemoracao")).toBeNull();
    expect(comemorar({ texto: "Oi", doc, janela })).not.toBeNull();
  });

  it("o efeito, a duração, o som e a mensagem vêm do marco", () => {
    definirConfiguracaoDasComemoracoes(
      JSON.stringify({
        marcos: {
          "vaga-pronta": {
            efeito: "confete",
            intensidade: "festa",
            duracaoS: 3,
            som: true,
            mensagem: "Vaga pronta, equipe!",
          },
        },
      }),
    );
    const { janela } = janelaFalsa();
    expect(planoDaComemoracao({ marco: "vaga-pronta", janela })).toEqual({
      efeito: "confete",
      intensidade: "festa",
      duracaoMs: 3000,
      som: true,
      mensagem: "Vaga pronta, equipe!",
      // O texto no céu do marco (só os fogos escrevem; aqui, confete).
      letreiro: "Vaga pronta!",
    });
    const { doc, janela: outra } = janelaFalsa();
    comemorar({
      texto: "Vaga X pronta.",
      marco: "vaga-pronta",
      doc,
      janela: outra,
      aleatorio: criarAleatorio(1),
    });
    const aviso = avisoDe(doc);
    expect(aviso.textContent).toContain("Vaga pronta, equipe!");
    // Som configurado: o botão já nasce ligado (toca depois da interação).
    expect(
      aviso.querySelector(".comemoracao__som").getAttribute("aria-pressed"),
    ).toBe("true");
    // Confete: um canvas, sem véu escuro.
    expect(canvases(doc)).toBe(1);
    expect(veus(doc)).toBe(0);
  });

  it("o letreiro (texto no céu): o do marco, o pedido ou, no Festa, Parabéns!", () => {
    const { janela } = janelaFalsa();
    expect(planoDaComemoracao({ marco: "fila-zerada", janela }).letreiro).toBe(
      "Fila zerada!",
    );
    // O marco do número já escreve o número: sem letreiro próprio (no Festa,
    // o padrão).
    expect(planoDaComemoracao({ marco: "marco-do-ano", janela }).letreiro).toBe(
      "Parabéns!",
    );
    const direto = (opcoes) =>
      planoDaComemoracao({ teste: true, efeito: "fogos", janela, ...opcoes })
        .letreiro;
    expect(direto({ intensidade: "festa" })).toBe("Parabéns!");
    expect(direto({ intensidade: "normal" })).toBeNull();
    expect(direto({ intensidade: "normal", letreiro: "Valeu!" })).toBe(
      "Valeu!",
    );
    // Letreiro vazio pedido: nenhum, nem no Festa.
    expect(direto({ intensidade: "festa", letreiro: "" })).toBeNull();
    // Sem efeito (só o aviso), sem letreiro.
    expect(
      planoDaComemoracao({ teste: true, confete: false, janela }).letreiro,
    ).toBeNull();
    // A configuração salva continua valendo do mesmo jeito (o letreiro não
    // é gravado: vem do catálogo).
    definirConfiguracaoDasComemoracoes(
      JSON.stringify({ marcos: { "fila-zerada": { intensidade: "festa" } } }),
    );
    expect(planoDaComemoracao({ marco: "fila-zerada", janela })).toMatchObject({
      efeito: "fogos",
      intensidade: "festa",
      letreiro: "Fila zerada!",
    });
  });

  it("preferência pessoal desligada: nada, nem sem marco; o teste aparece", () => {
    const { doc, janela, guardado } = janelaFalsa();
    guardado.set(CHAVE_DA_PREFERENCIA_PESSOAL, "1");
    expect(
      comemorar({ texto: "x", marco: "fila-zerada", doc, janela }),
    ).toBeNull();
    expect(comemorar({ texto: "x", doc, janela })).toBeNull();
    expect(
      comemorar({
        texto: "Prévia",
        marco: "fila-zerada",
        teste: true,
        doc,
        janela,
        aleatorio: criarAleatorio(2),
      }),
    ).not.toBeNull();
  });

  it("o teste usa o que a tela escolheu e não grava nada", () => {
    const { doc, janela, guardado } = janelaFalsa();
    const aviso = comemorar({
      texto: "Prévia: Balões",
      teste: true,
      efeito: "baloes",
      intensidade: "suave",
      duracaoMs: 2500,
      doc,
      janela,
      aleatorio: criarAleatorio(3),
    });
    expect(aviso).not.toBeNull();
    expect(canvases(doc)).toBe(1);
    expect(guardado.size).toBe(0);
  });

  it("com menos movimento, só o aviso", () => {
    const { doc, janela } = janelaFalsa({ movimento: false });
    expect(
      comemorar({
        texto: "Prévia",
        teste: true,
        efeito: "combinado",
        doc,
        janela,
      }),
    ).not.toBeNull();
    const aviso = avisoDe(doc);
    expect(canvases(doc)).toBe(0);
    expect(aviso.querySelector(".comemoracao__pular")).toBeNull();
  });
});

describe("os efeitos no canvas", () => {
  it("combinado: dois canvases (fogos com rastro e o motor), véu e a Aya avisada", () => {
    const { doc, janela, eventos, rodar } = janelaFalsa();
    expect(
      soltarFogos(doc, janela, {
        efeito: "combinado",
        duracaoMs: 4000,
        aleatorio: criarAleatorio(4),
      }),
    ).toBeTruthy();
    expect(canvases(doc)).toBe(2);
    expect(veus(doc)).toBe(1);
    // A arara voando dos fogos fica de fora: quem comemora é a mascote.
    expect(doc.querySelector(".comemoracao__aya")).toBeNull();
    expect(eventos[0].type).toBe(EVENTO_DA_AYA);
    expect(eventos[0].detail).toEqual({
      estado: "comemorando",
      duracaoMs: 4000,
    });
    rodar();
    expect(canvases(doc) + veus(doc)).toBe(0);
    // Acabou: o "Pular" sai e o aviso fica o tempo de leitura.
    expect(doc.querySelector(".comemoracao__pular")).toBeNull();
    expect(eventos.at(-1).detail).toEqual({
      estado: "parada",
      duracaoMs: null,
    });
  });

  it("cada efeito do motor monta, anima e some sozinho", () => {
    for (const efeito of [
      "confete",
      "serpentina",
      "estrelas",
      "coracoes",
      "baloes",
    ]) {
      const { doc, janela, rodar, eventos } = janelaFalsa();
      soltarFogos(doc, janela, {
        efeito,
        duracaoMs: 3000,
        aleatorio: criarAleatorio(5),
      });
      expect(canvases(doc)).toBe(1);
      expect(veus(doc)).toBe(efeito === "estrelas" ? 1 : 0);
      const quadros = rodar();
      expect(quadros).toBeLessThanOrEqual(Math.ceil(3000 / 16.7) + 3);
      expect(canvases(doc) + veus(doc)).toBe(0);
      // A arara do canto comemora junto (evento), e para ao fim.
      expect(eventos.map((e) => e.detail.estado)).toEqual([
        "comemorando",
        "parada",
      ]);
    }
  });

  it("só a Aya: nada a desenhar, o evento e o fim pelo relógio", () => {
    vi.useFakeTimers();
    const { doc, janela, eventos } = janelaFalsa();
    soltarFogos(doc, janela, { efeito: "aya", duracaoMs: 3000 });
    expect(canvases(doc)).toBe(0);
    expect(eventos.map((e) => e.detail)).toEqual([
      { estado: "comemorando", duracaoMs: 3000 },
    ]);
    expect(doc.querySelector(".comemoracao__pular")).not.toBeNull();
    act(() => vi.advanceTimersByTime(3000));
    expect(doc.querySelector(".comemoracao__pular")).toBeNull();
    expect(eventos.map((e) => e.detail.estado)).toEqual([
      "comemorando",
      "parada",
    ]);
    clicar(doc.querySelector(".comemoracao__fechar"));
    expect(eventos).toHaveLength(2);
  });

  it("janela sem eventos (painel antigo) não quebra o efeito da Aya", () => {
    const { doc, janela, rodar } = janelaFalsa();
    delete janela.dispatchEvent;
    expect(
      soltarFogos(doc, janela, {
        efeito: "combinado",
        duracaoMs: 4000,
        aleatorio: criarAleatorio(6),
      }),
    ).toBeTruthy();
    rodar();
    expect(canvases(doc)).toBe(0);
  });
});

describe("marcos personalizados no app", () => {
  const config = normalizarConfiguracao({
    personalizados: [
      {
        id: "pessoal-1",
        nome: "Edital 12",
        tipo: "edital-contratados",
        edital: "012/2026",
        meta: 10,
      },
    ],
  });

  const memoria = () => {
    const guardado = new Map();
    return {
      getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
      setItem: (k, v) => guardado.set(k, String(v)),
      removeItem: (k) => guardado.delete(k),
    };
  };

  it("linha de base em silêncio, comemora ao cruzar a meta e só uma vez", () => {
    const armazenamento = memoria();
    const comemorarFalso = vi.fn();
    const avaliar = (contratados, ligadas = true) =>
      avaliarMarcosPersonalizados({
        tipo: "edital-contratados",
        linhas: [{ edital: "012/2026", contratados }],
        usuarioId: "u1",
        ligadas,
        config,
        armazenamento,
        comemorar: comemorarFalso,
      });
    expect(avaliar(8)).toEqual([]);
    expect(avaliar(9)).toEqual([]);
    expect(avaliar(10).map((p) => p.id)).toEqual(["pessoal-1"]);
    expect(comemorarFalso).toHaveBeenCalledWith({
      texto: "Edital 012/2026 chegou a 10 contratados! 🎉",
      itens: [],
      marco: "pessoal-1",
    });
    expect(avaliar(12)).toEqual([]);
    expect(comemorarFalso).toHaveBeenCalledTimes(1);
  });

  it("sem personalizados do tipo, nem guarda nada", () => {
    const armazenamento = memoria();
    const setItem = vi.spyOn(armazenamento, "setItem");
    avaliarMarcosPersonalizados({
      tipo: "analises-no-dia",
      linhas: [],
      usuarioId: "u1",
      ligadas: true,
      config,
      armazenamento,
    });
    expect(setItem).not.toHaveBeenCalled();
  });

  it("instalarMarcosDosEditais avalia a cada carga nova das linhas", () => {
    let ouvinte = null;
    let dados = { linhas: [], carregado: false };
    const avaliar = vi.fn();
    const cancelar = instalarMarcosDosEditais({
      obterUsuario: () => ({ id: "u1" }),
      ligadas: () => true,
      assinar: (fn) => {
        ouvinte = fn;
        return () => (ouvinte = null);
      },
      obter: () => dados,
      avaliar,
    });
    ouvinte();
    expect(avaliar).not.toHaveBeenCalled();
    dados = { linhas: [{ edital: "1" }], carregado: true };
    ouvinte();
    ouvinte();
    expect(avaliar).toHaveBeenCalledTimes(1);
    expect(avaliar.mock.calls[0][0]).toMatchObject({
      tipo: "edital-contratados",
      usuarioId: "u1",
      ligadas: true,
    });
    cancelar();
    expect(ouvinte).toBeNull();
  });
});
