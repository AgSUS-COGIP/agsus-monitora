// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  avaliarMarcosPersonalizados,
  instalarMarcosDosEditais,
} from "../src/app/marcos-personalizados.ts";
import {
  CHAVE_DA_PREFERENCIA_PESSOAL,
  CHAVE_DO_EFEITO_DO_DIA,
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
          "edital-concluido": {
            efeito: "confete",
            intensidade: "festa",
            duracaoS: 3,
            som: true,
            mensagem: "Edital concluído.",
          },
        },
      }),
    );
    const { janela } = janelaFalsa();
    expect(
      planoDaComemoracao({
        marco: "edital-concluido",
        janela,
        hoje: "2026-11-17",
      }),
    ).toEqual({
      efeito: "confete",
      intensidade: "festa",
      duracaoMs: 3000,
      som: true,
      mensagem: "Edital concluído.",
    });
    const { doc, janela: outra } = janelaFalsa();
    comemorar({
      texto: "Edital X: as 3 fichas foram analisadas.",
      marco: "edital-concluido",
      doc,
      janela: outra,
      aleatorio: criarAleatorio(1),
    });
    const aviso = avisoDe(doc);
    expect(aviso.textContent).toContain("Edital concluído.");
    // Som configurado: o botão já nasce ligado (toca depois da interação).
    expect(
      aviso.querySelector(".comemoracao__som").getAttribute("aria-pressed"),
    ).toBe("true");
    // Confete: um canvas, sem véu escuro.
    expect(canvases(doc)).toBe(1);
    expect(veus(doc)).toBe(0);
    // A frase fica só no aviso: nada de letreiro no meio da tela.
    expect(doc.querySelector(".comemoracao__letreiro")).toBeNull();
  });

  it("fila zerada e vaga pronta: só o aviso, mesmo com efeito na configuração antiga", () => {
    definirConfiguracaoDasComemoracoes(
      JSON.stringify({
        marcos: { "fila-zerada": { efeito: "fogos", intensidade: "festa" } },
      }),
    );
    const { doc, janela, guardado } = janelaFalsa();
    expect(planoDaComemoracao({ marco: "fila-zerada", janela })).toEqual({
      efeito: null,
      intensidade: null,
      duracaoMs: null,
      som: false,
      mensagem: "",
    });
    comemorar({
      texto: "Vaga 1 (Químico): todas as entrevistas têm parecer.",
      marco: "vaga-pronta",
      doc,
      janela,
    });
    expect(avisoDe(doc).textContent).toContain("todas as entrevistas");
    expect(canvases(doc)).toBe(0);
    expect(avisoDe(doc).querySelector(".comemoracao__pular")).toBeNull();
    // Só o aviso não gasta o efeito do dia.
    expect(guardado.has(CHAVE_DO_EFEITO_DO_DIA)).toBe(false);
  });

  it("uma comemoração com efeito por dia: a segunda sai só como aviso; o teste não conta", () => {
    const { janela, guardado } = janelaFalsa();
    const pedido = (hoje) =>
      planoDaComemoracao({ marco: "marco-do-ano", janela, hoje });
    expect(pedido("2026-11-17").efeito).toBe("fogos");
    expect(guardado.get(CHAVE_DO_EFEITO_DO_DIA)).toBe("2026-11-17");
    expect(pedido("2026-11-17")).toMatchObject({ efeito: null });
    // O Testar e o Soltar de Configurações: sempre com efeito, sem gastar.
    expect(
      planoDaComemoracao({ marco: "marco-do-ano", teste: true, janela }).efeito,
    ).toBe("fogos");
    expect(
      planoDaComemoracao({ teste: true, efeito: "baloes", janela }).efeito,
    ).toBe("baloes");
    // Outro dia: de novo com efeito.
    expect(pedido("2026-11-18").efeito).toBe("fogos");
    // Na tela: o primeiro do dia com canvas, o segundo sem.
    const outra = janelaFalsa();
    const hoje = (j) => j.janela.localStorage.getItem(CHAVE_DO_EFEITO_DO_DIA);
    comemorar({
      texto: "Primeiro",
      marco: "acesso-liberado",
      doc: outra.doc,
      janela: outra.janela,
      aleatorio: criarAleatorio(7),
    });
    expect(canvases(outra.doc)).toBe(1);
    expect(hoje(outra)).not.toBeNull();
    const antes = canvases(outra.doc);
    comemorar({
      texto: "Segundo",
      marco: "edital-concluido",
      doc: outra.doc,
      janela: outra.janela,
    });
    expect(canvases(outra.doc)).toBe(antes);
    expect(outra.doc.body.textContent).toContain("Segundo");
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
      texto: "Edital 012/2026: 10 contratados.",
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
