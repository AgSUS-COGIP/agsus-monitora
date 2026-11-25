// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import { act, createElement, StrictMode } from "react";
import { afterEach, describe, expect, it, vi, beforeEach } from "vitest";
import {
  avaliarMarcosPersonalizados,
  instalarMarcosDosEditais,
} from "../src/app/marcos-personalizados.ts";
import {
  CHAVE_DA_PREFERENCIA_PESSOAL,
  CHAVE_DO_EFEITO_DO_DIA,
  definirConfiguracaoDasComemoracoes,
  normalizarConfiguracao,
} from "../src/lib/comemoracao/catalogo-de-comemoracoes.ts";
import { criarAleatorio } from "../src/lib/comemoracao/fogos.ts";
import {
  EVENTO_DA_AYA,
  Comemoracoes,
  comemorar,
} from "../src/modulos/comemoracao/comemoracoes.tsx";
import {
  planoDaComemoracao,
  TEMPO_DO_AVISO_MS,
} from "../src/modulos/comemoracao/plano.ts";
import {
  encerrarShowsAoFimDeCadaTeste,
  filaDeQuadros,
} from "./shows-de-comemoracao.js";
import { collectAyaPageContext } from "../src/modulos/aya/contexto.ts";
import {
  contextualAyaAnswer,
  resolverReferencia,
} from "../src/lib/aya/contexto-da-aya.ts";
import {
  CHAVE_COMEMORACOES_PESSOAIS,
  CHAVE_DO_ACENO,
  comemoracoesPessoaisDesligadas,
  definirEstadoDaAya,
  deveAcenar,
  DURACAO_PADRAO_MS,
  ESTADOS_DA_MASCOTE,
  EVENTO_ESTADO_DA_AYA,
  lerPedido,
  ponteiroPerto,
  resolverEstado,
  INATIVIDADE_PARA_DORMIR_MS,
} from "../src/lib/aya/estado-da-aya.ts";
import { readFileSync } from "node:fs";
import { CHAVE_DO_SOM } from "../src/lib/comemoracao/fogos-cena.ts";
import {
  definirAreaAtual,
  definirAreasDoUsuario,
  redefinirDadosDoMonitoramento,
} from "../src/componentes/dados-do-monitoramento.ts";
import { desenharNoTeste } from "./montar-tela.ts";
import { clicar, digitar, teclar } from "./componentes/interacoes.ts";
import { consumirPedidoDeFiltro } from "../src/app/pedido-de-filtro.ts";
import { createRoot } from "react-dom/client";
import { filaDeComemoracoes } from "../src/app/fila-de-comemoracoes.ts";
import { ComemoracoesDoApp } from "../src/app/casca/pecas.tsx";
import { ErrorBoundary } from "../src/app/ErrorBoundary.tsx";
import { obterPaginaDaAya } from "../src/modulos/aya/estado.ts";
import { criarNavegacao } from "../src/app/navegacao.ts";

bloco("comemoracoes-configuradas", () => {
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
    const doc = shows.acompanhar(
      document.implementation.createHTMLDocument("t"),
    );
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
        planoDaComemoracao({ marco: "marco-do-ano", teste: true, janela })
          .efeito,
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
});

bloco("contexto-da-aya", () => {
  describe("contexto da tela para a Aya", () => {
    beforeEach(() => {
      document.body.innerHTML = `
      <span class="mapa-si-painel__contagem">34 DSEIs · 2 CASAIs</span>
      <section class="ui-tela visao-geral-tela">
        <div class="visao-geral-filtros"><div class="ui-chips">
          <button class="ui-chip"><b>UF</b> AM</button>
          <button class="ui-chip"><b>Edital</b> 01/2026</button>
        </div></div>
        <section class="visao-geral-kpis">
          <div data-kpi="vagas">Vagas 120</div>
          <div data-kpi="ociosas">Ociosas 35</div>
        </section>
        <input class="ui-tabela-busca" value="Xavante" />
      </section>
      <button class="mapa-si-territorio">
        <strong>DSEI Xavante</strong>
        <small>2 ociosas · 1 processo · 22.000 hab.</small>
        <span class="mapa-si-territorio__vagas"><b>10</b> vagas</span>
      </button>
      <table class="visao-geral-tabela"><tbody>
        <tr><td>Edital 01/2026</td><td>DSEI Xavante</td><td>Aberto</td></tr>
      </tbody></table>
    `;
      document.title = "Saúde Indígena";
    });

    it("coleta mapa, filtros, indicadores, territórios e editais", () => {
      const context = collectAyaPageContext(document);

      expect(context.mapSummary).toBe("34 DSEIs · 2 CASAIs");
      expect(context.activeFilters.join(" ")).toContain("UF AM");
      expect(context.kpis).toEqual(["Vagas 120", "Ociosas 35"]);
      expect(context.search).toBe("Xavante");
      expect(context.territories[0]).toContain("DSEI Xavante");
      expect(context.territories[0]).toContain("10 vagas");
      expect(context.editais[0]).toContain("Edital 01/2026");
    });

    it("responde a própria identidade sem depender do Ollama", () => {
      expect(contextualAyaAnswer("qual é seu nome?", {})).toBe(
        "Eu sou a Aya, assistente do Yeendé da AgSUS.",
      );
      expect(contextualAyaAnswer("Quem é você?", {})).toContain("Aya");
    });

    it("responde a contagem de DSEIs pela lista de DSEIs, não pelo total de pontos", () => {
      document.querySelector(".visao-geral-filtros").textContent = "";
      document.querySelector(".mapa-si-painel__contagem").textContent =
        "36 pontos";
      document.body.insertAdjacentHTML(
        "beforeend",
        Array.from(
          { length: 33 },
          (_, index) =>
            `<button class="mapa-si-territorio"><strong>DSEI ${index + 2}</strong></button>`,
        ).join(""),
      );

      const context = collectAyaPageContext(document);
      const answer = contextualAyaAnswer(
        "Quantos DSEIs tem no Brasil?",
        context,
      );

      expect(context.territories).toHaveLength(34);
      expect(answer).toContain("34 DSEIs");
      expect(answer).not.toContain("36 DSEIs");
    });

    it("explicita quando a contagem de DSEIs corresponde a filtros ativos", () => {
      const answer = contextualAyaAnswer("Quantos DSEIs aparecem?", {
        mapSummary: "8 pontos",
        activeFilters: ["UF: AM"],
        territories: ["DSEI Alto Rio Negro", "DSEI Manaus"],
      });

      expect(answer).toContain("2 DSEIs");
      expect(answer).toContain("filtros ativos");
    });
  });

  describe("referência a um turno anterior", () => {
    it("resolve pronome usando a última pergunta do usuário", () => {
      const history = [
        { role: "user", content: "Dsei alagoas" },
        { role: "assistant", content: "..." },
      ];
      const resolvida = resolverReferencia(
        "Diga mais sobre esse DSEI",
        history,
      );
      expect(resolvida).toContain("Dsei alagoas");
      expect(resolvida).toContain("esse DSEI");
    });

    it("não arrasta assunto anterior para pergunta que já tem o seu", () => {
      const history = [{ role: "user", content: "Dsei alagoas" }];
      expect(resolverReferencia("o que é CASAI?", history)).toBe(
        "o que é CASAI?",
      );
    });

    it("aguenta histórico vazio ou só do assistente", () => {
      expect(resolverReferencia("diga mais sobre isso", [])).toBe(
        "diga mais sobre isso",
      );
      expect(
        resolverReferencia("diga mais sobre isso", [
          { role: "assistant", content: "x" },
        ]),
      ).toBe("diga mais sobre isso");
    });
  });
});

bloco("estado-da-aya", () => {
  /* A regra da mascote da Aya, sem DOM (src/lib/aya/estado-da-aya.ts). */

  function armazenamento(inicial = {}) {
    const dados = new Map(Object.entries(inicial));
    return {
      getItem: (k) => (dados.has(k) ? dados.get(k) : null),
      setItem: (k, v) => dados.set(k, String(v)),
    };
  }

  describe("estados e pedidos", () => {
    it("os oito estados (uma pose ilustrada cada)", () => {
      expect(ESTADOS_DA_MASCOTE).toEqual([
        "parada",
        "atenta",
        "falando",
        "pensando",
        "comemorando",
        "dormindo",
        "acenando",
        "apontando",
      ]);
    });

    it("lê o pedido: estado válido, duração informada ou a padrão", () => {
      expect(lerPedido("voando")).toBeNull();
      expect(lerPedido("pensando")).toEqual({
        estado: "pensando",
        duracaoMs: null,
      });
      expect(lerPedido("comemorando")).toEqual({
        estado: "comemorando",
        duracaoMs: DURACAO_PADRAO_MS.comemorando,
      });
      expect(lerPedido("comemorando", 1500).duracaoMs).toBe(1500);
      expect(lerPedido("acenando", -3).duracaoMs).toBe(
        DURACAO_PADRAO_MS.acenando,
      );
      // Teto de 1 minuto: ninguém prende a arara num estado.
      expect(lerPedido("falando", 999999).duracaoMs).toBe(60000);
    });

    it("definirEstadoDaAya dispara o evento global aya:estado", () => {
      const ouvinte = vi.fn();
      window.addEventListener(EVENTO_ESTADO_DA_AYA, ouvinte);
      expect(definirEstadoDaAya("comemorando", 2000)).toBe(true);
      expect(definirEstadoDaAya("inexistente")).toBe(false);
      window.removeEventListener(EVENTO_ESTADO_DA_AYA, ouvinte);
      expect(ouvinte).toHaveBeenCalledTimes(1);
      expect(ouvinte.mock.calls[0][0].detail).toEqual({
        estado: "comemorando",
        duracaoMs: 2000,
      });
    });
  });

  describe("qual estado aparece", () => {
    it("fixo > global > próprio > momento > atenta > dormindo > parada", () => {
      expect(resolverEstado({})).toBe("parada");
      expect(resolverEstado({ dormindo: true })).toBe("dormindo");
      expect(resolverEstado({ dormindo: true, perto: true })).toBe("atenta");
      expect(resolverEstado({ perto: true, momento: "acenando" })).toBe(
        "acenando",
      );
      expect(resolverEstado({ momento: "acenando", proprio: "falando" })).toBe(
        "falando",
      );
      expect(
        resolverEstado({ proprio: "falando", global: "comemorando" }),
      ).toBe("comemorando");
      expect(resolverEstado({ global: "comemorando", fixo: "dormindo" })).toBe(
        "dormindo",
      );
    });

    it("com as comemorações desligadas, não comemora", () => {
      expect(
        resolverEstado({
          global: "comemorando",
          proprio: "pensando",
          comemoracoesDesligadas: true,
        }),
      ).toBe("pensando");
      expect(
        resolverEstado({ fixo: "comemorando", comemoracoesDesligadas: true }),
      ).toBe("parada");
    });
  });

  describe("preferências", () => {
    it("acena uma vez por sessão", () => {
      const sessao = armazenamento();
      expect(deveAcenar(sessao)).toBe(true);
      expect(sessao.getItem(CHAVE_DO_ACENO)).toBe("1");
      expect(deveAcenar(sessao)).toBe(false);
      expect(deveAcenar(null)).toBe(false);
      const quebrado = {
        getItem: () => {
          throw new Error("bloqueado");
        },
      };
      expect(deveAcenar(quebrado)).toBe(false);
    });

    it("comemorações pessoais desligadas com '1'", () => {
      expect(comemoracoesPessoaisDesligadas(armazenamento())).toBe(false);
      expect(
        comemoracoesPessoaisDesligadas(
          armazenamento({ [CHAVE_COMEMORACOES_PESSOAIS]: "1" }),
        ),
      ).toBe(true);
    });
  });

  describe("atenção", () => {
    it("o ponteiro perto (raio mais meia caixa) deixa atenta", () => {
      const caixa = { left: 100, top: 100, width: 64, height: 64 };
      expect(ponteiroPerto(caixa, { x: 132, y: 132 })).toBe(true);
      expect(ponteiroPerto(caixa, { x: 132 + 160 + 32, y: 132 })).toBe(true);
      expect(ponteiroPerto(caixa, { x: 132 + 160 + 33, y: 132 })).toBe(false);
      expect(ponteiroPerto(caixa, { x: 900, y: 900 }, 10)).toBe(false);
    });
  });
});

bloco("fogos-ao-concluir", () => {
  /*
  O desenho dos fogos (src/modulos/comemoracao/comemoracoes.tsx, React), com
  canvas e áudio falsos. Sorteio sempre fixo (`aleatorio: criarAleatorio(n)`):
  já houve teste instável por depender de Math.random sem semente.
*/

  const shows = encerrarShowsAoFimDeCadaTeste();
  const { comemorar, clicar } = shows;

  /* Os fogos pedidos direto (o Palco de testes): sem passar pela configuração. */
  const soltarFogos = (doc, janela, opcoes = {}) =>
    comemorar({
      texto: "Fogos",
      teste: true,
      efeito: "fogos",
      intensidade: "normal",
      doc,
      janela,
      ...opcoes,
    });
  const pular = (doc) => clicar(doc.querySelector(".comemoracao__pular"));

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
    const { quadros, requestAnimationFrame } = filaDeQuadros();
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
    const doc = shows.acompanhar(
      document.implementation.createHTMLDocument("t"),
    );
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
      requestAnimationFrame,
      matchMedia: () => ({ matches: !movimento }),
      getComputedStyle: () => ({
        getPropertyValue: (nome) =>
          nome === "--brand-primary" ? "#0f5db7" : "",
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
    it("sem canvas 2D ou sem requestAnimationFrame: só o aviso, sem efeito", () => {
      const doc = shows.acompanhar(
        document.implementation.createHTMLDocument("t"),
      );
      // Sem canvas 2D (o jsdom não desenha).
      vi.spyOn(console, "error").mockImplementation(() => {});
      soltarFogos(doc, {
        requestAnimationFrame: () => {},
        matchMedia: () => ({ matches: false }),
      });
      const { doc: comCanvas } = janelaComCanvas();
      // Sem requestAnimationFrame.
      soltarFogos(comCanvas, { innerWidth: 10 });
      for (const d of [doc, comCanvas]) {
        expect(d.querySelector(".comemoracao")).not.toBeNull();
        expect(d.querySelector("canvas")).toBeNull();
        expect(d.querySelector(".comemoracao__pular")).toBeNull();
        expect(sobras(d)).toBe(0);
      }
    });

    it("canvas, véu e Aya sem clique, escondidos do leitor de tela; canvas nítido no devicePixelRatio", () => {
      const { doc, janela, chamadas } = janelaComCanvas({ dpr: 3 });
      soltarFogos(doc, janela, { aleatorio: criarAleatorio(1) });
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
      // A arara de verdade (src/modulos/aya/mascote/), comemorando.
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
      // Sem fogos (confete), nenhuma arara voando.
      const outra = janelaComCanvas();
      soltarFogos(outra.doc, outra.janela, {
        efeito: "confete",
        aleatorio: criarAleatorio(5),
      });
      expect(outra.doc.querySelector(".comemoracao__fogos")).not.toBeNull();
      expect(outra.doc.querySelector(".comemoracao__aya")).toBeNull();
    });

    it("número do marco sem canvas de verdade: a fonte de pontos dá conta", () => {
      const { doc, janela, rodar } = janelaComCanvas();
      soltarFogos(doc, janela, {
        intensidade: "festa",
        forma: { tipo: "numero", texto: "1.000" },
        aleatorio: criarAleatorio(6),
      });
      expect(doc.querySelector(".comemoracao__fogos")).not.toBeNull();
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
      Object.defineProperty(doc, "hidden", {
        value: false,
        configurable: true,
      });
      while (quadros.length) quadros.shift()((agora += 16.7));
      expect(doc.querySelector("canvas")).toBeNull();
    });

    it("Pular remove tudo na hora, uma vez só", () => {
      const { doc, janela, quadros } = janelaComCanvas();
      soltarFogos(doc, janela, { aleatorio: criarAleatorio(9) });
      quadros.shift()(0);
      pular(doc);
      expect(sobras(doc)).toBe(0);
      expect(doc.querySelector(".comemoracao__pular")).toBeNull();
      // O quadro que estava na fila não volta a desenhar.
      while (quadros.length) quadros.shift()(16.7);
      expect(quadros).toHaveLength(0);
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
      clicar(aviso(doc).querySelector(".comemoracao__pular"));
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

      // O segundo efeito do dia sairia só como aviso: aqui, como teste.
      comemorar({
        texto: "De novo",
        teste: true,
        doc,
        janela,
        aleatorio: criarAleatorio(4),
      });
      quadros.shift()(0);
      clicar(
        [...doc.querySelectorAll(".comemoracao")]
          .at(-1)
          .querySelector(".comemoracao__fechar"),
      );
      expect(doc.body.textContent).not.toContain("De novo");
      expect(sobras(doc)).toBe(0);
    });

    it("efeito mais longo que o aviso: o aviso espera o efeito acabar", () => {
      vi.useFakeTimers();
      try {
        const { doc, janela, rodar, quadros } = janelaComCanvas();
        comemorar({
          texto: "Longo",
          teste: true,
          efeito: "fogos",
          duracaoMs: 15000,
          doc,
          janela,
          aleatorio: criarAleatorio(5),
        });
        quadros.shift()(0);
        act(() => vi.advanceTimersByTime(TEMPO_DO_AVISO_MS + 1));
        // Antes, o aviso fechava aos 12 s e levava o efeito junto.
        expect(aviso(doc)).not.toBeNull();
        expect(doc.querySelector(".comemoracao__pular")).not.toBeNull();
        rodar(5000);
        act(() => vi.advanceTimersByTime(0));
        expect(aviso(doc)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("efeito curto: o aviso ainda fica o tempo de leitura", () => {
      vi.useFakeTimers();
      try {
        const { doc, janela, rodar } = janelaComCanvas();
        comemorar({
          texto: "Curto",
          doc,
          janela,
          aleatorio: criarAleatorio(6),
        });
        rodar();
        expect(aviso(doc)).not.toBeNull();
        act(() => vi.advanceTimersByTime(TEMPO_DO_AVISO_MS));
        expect(aviso(doc)).toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("som desligado por padrão: nenhum áudio é criado, mesmo depois de interagir", () => {
      const { doc, janela, rodar, audios } = janelaComCanvas({
        interagiu: true,
      });
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
      clicar(botao);
      expect(botao.getAttribute("aria-pressed")).toBe("true");
      expect(botao.getAttribute("aria-label")).toBe("Desligar som");
      expect(guardado.get(CHAVE_DO_SOM)).toBe("1");
      rodar();
      expect(audios).toHaveLength(1);
      // Fechar o aviso fecha o áudio.
      clicar(doc.querySelector(".comemoracao__fechar"));
      expect(audios[0].fechado).toBe(true);
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
    });

    it("o fim do tour e da trilha da Aya não comemora mais", () => {
      const aya = readFileSync("src/modulos/aya/aya.tsx", "utf8");
      expect(aya).not.toMatch(/comemorar|fim-do-tour|fim-da-trilha/);
    });
  });

  describe("fogos mais divertidos: a dança e o desempenho", () => {
    const dancando = (doc) => doc.querySelectorAll(".comemoracao__aya--danca");

    it("no fim, a Aya volta para dançar (outra arara), solta confete num canvas próprio e tudo sai", () => {
      const { doc, janela, quadros } = janelaComCanvas();
      soltarFogos(doc, janela, { aleatorio: criarAleatorio(5) });
      const voo = doc.querySelector(".comemoracao__aya");
      // No começo, só o canvas dos fogos (o do confete entra perto da hora).
      expect(doc.querySelectorAll("canvas.comemoracao__fogos")).toHaveLength(1);
      let agora = 0;
      let viuADanca = false;
      let viuOConfete = false;
      const transformacoes = new Set();
      while (quadros.length) {
        quadros.shift()((agora += 16.7));
        const danca = dancando(doc);
        // Nunca as duas araras juntas, nem duas dançando.
        expect(danca.length).toBeLessThanOrEqual(1);
        if (danca.length) {
          viuADanca = true;
          expect(voo.isConnected).toBe(false);
          expect(danca[0].getAttribute("aria-hidden")).toBe("true");
          transformacoes.add(danca[0].style.transform);
        }
        if (doc.querySelector("canvas.comemoracao__motor")) viuOConfete = true;
      }
      expect(viuADanca).toBe(true);
      expect(transformacoes.size).toBeGreaterThan(30);
      expect(viuOConfete).toBe(true);
      expect(sobras(doc)).toBe(0);
      expect(agora).toBeLessThanOrEqual(5600);
    });

    it("no Suave, sem dança e sem o canvas do confete", () => {
      const { doc, janela, quadros } = janelaComCanvas();
      soltarFogos(doc, janela, {
        intensidade: "suave",
        aleatorio: criarAleatorio(5),
      });
      let agora = 0;
      while (quadros.length) {
        quadros.shift()((agora += 16.7));
        expect(dancando(doc)).toHaveLength(0);
        expect(doc.querySelector("canvas.comemoracao__motor")).toBeNull();
      }
      expect(sobras(doc)).toBe(0);
    });

    it("a frase fica só no aviso: nenhum letreiro no meio da tela, nem no Festa", () => {
      vi.useFakeTimers();
      const janelas = [];
      try {
        for (const intensidade of ["normal", "festa"]) {
          const j = janelaComCanvas();
          janelas.push(j);
          soltarFogos(j.doc, j.janela, {
            intensidade,
            aleatorio: criarAleatorio(2),
          });
          act(() => vi.advanceTimersByTime(3000));
          expect(j.doc.querySelector(".comemoracao__letreiro")).toBeNull();
          expect(j.doc.querySelector(".comemoracao").textContent).toContain(
            "Fogos",
          );
          // Os fogos também não escrevem frase em pontinhos.
          expect(j.contagem.getImageData).toBeUndefined();
        }
        const css = readFileSync("src/styles/comemoracao.css", "utf8");
        expect(css).not.toMatch(/letreiro/);
      } finally {
        vi.useRealTimers();
        for (const j of janelas) j.rodar();
      }
    });

    it("com a aba escondida, nada é desenhado (nem avança)", () => {
      const { doc, janela, quadros, contagem } = janelaComCanvas();
      soltarFogos(doc, janela, { aleatorio: criarAleatorio(8) });
      let agora = 0;
      for (let i = 0; i < 90; i += 1) quadros.shift()((agora += 16.7));
      Object.defineProperty(doc, "hidden", { value: true, configurable: true });
      const antes = { ...contagem };
      for (let i = 0; i < 300; i += 1) quadros.shift()((agora += 16.7));
      expect(contagem).toEqual(antes);
      expect(quadros).toHaveLength(1);
      Object.defineProperty(doc, "hidden", {
        value: false,
        configurable: true,
      });
      while (quadros.length) quadros.shift()((agora += 16.7));
      expect(sobras(doc)).toBe(0);
    });

    it("quadros lentos baixam a qualidade sozinha: menos brilho por quadro e, no fim, densidade de pixels 1", () => {
      const lento = janelaComCanvas({ dpr: 2 });
      soltarFogos(lento.doc, lento.janela, {
        intensidade: "festa",
        aleatorio: criarAleatorio(7),
      });
      const canvas = lento.doc.querySelector("canvas.comemoracao__fogos");
      expect(canvas.width).toBe(2000);
      // ~25 fps: dois níveis abaixo em pouco mais de um segundo.
      let agora = 0;
      for (let i = 0; i < 60; i += 1) lento.quadros.shift()((agora += 40));
      expect(canvas.width).toBe(1000);
      expect(lento.chamadas).toContainEqual(["setTransform", 1, 0, 0, 1, 0, 0]);
      let quadrosLentos = 60;
      while (lento.quadros.length) {
        lento.quadros.shift()((agora += 40));
        quadrosLentos += 1;
      }
      expect(sobras(lento.doc)).toBe(0);

      // O mesmo show a 60 fps: nítido até o fim e com mais halos.
      const rapido = janelaComCanvas({ dpr: 2 });
      soltarFogos(rapido.doc, rapido.janela, {
        intensidade: "festa",
        aleatorio: criarAleatorio(7),
      });
      const nitido = rapido.doc.querySelector("canvas.comemoracao__fogos");
      let quadrosRapidos = 0;
      let t = 0;
      while (rapido.quadros.length) {
        rapido.quadros.shift()((t += 16.7));
        quadrosRapidos += 1;
        if (nitido.isConnected) expect(nitido.width).toBe(2000);
      }
      expect(quadrosRapidos).toBeGreaterThan(300);
      // Sem o núcleo quente das faíscas: bem menos pontos por quadro.
      expect(rapido.contagem.arc / quadrosRapidos).toBeGreaterThan(
        (lento.contagem.arc / quadrosLentos) * 1.5,
      );
    });
  });
});

bloco("modulos/aya-dados", async () => {
  /*
  A Aya mais esperta no painel (src/modulos/aya/aya.tsx): a resposta com
  número traz "Abrir", que navega com o filtro pedido; "não ajudou" e "não
  entendi" guardam a pergunta (sem dado pessoal) e o administrador global
  copia a lista; "me mostra esta tela" digitado começa o tour; o perfil vai
  junto da pergunta.
*/

  const { Aya, CHAVE_SEM_RESPOSTA } =
    await import("../src/modulos/aya/aya.tsx");
  const { definirPaginaDaAya, redefinirPaginaDaAya } =
    await import("../src/modulos/aya/estado.ts");

  let raiz;
  let controlador;
  let perguntar;
  let navegar;
  let perfil;

  const $ = (seletor) => document.querySelector(seletor);
  const $$ = (seletor) => [...document.querySelectorAll(seletor)];
  const botao = (rotulo) =>
    $$("button").find(
      (b) =>
        b.getAttribute("aria-label") === rotulo ||
        b.textContent.trim() === rotulo,
    );

  async function montar() {
    raiz = document.createElement("div");
    document.body.append(raiz);
    await act(async () => {
      controlador = desenharNoTeste(
        raiz,
        createElement(Aya, {
          perguntar,
          navegar,
          abrirSecao: vi.fn(),
          obterPerfil: () => perfil,
          configuracao: () => "",
        }),
      );
    });
  }

  async function perguntarNoCampo(texto) {
    await digitar($("textarea"), texto);
    await teclar($("textarea"), "Enter");
  }

  let paginaFalsa;
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    // Sem os convites (primeiros passos e tour da tela) no meio do teste.
    localStorage.setItem("agsus_aya_primeiros_passos_oferecidos_v1", "1");
    localStorage.setItem(
      "agsus_aya_convites_de_tour_v1",
      JSON.stringify(["recursos"]),
    );
    localStorage.setItem("agsus_monitora_arara_oculta_v1", "0");
    redefinirDadosDoMonitoramento();
    definirAreasDoUsuario(["saude-indigena", "sede", "projetos"]);
    definirAreaAtual("sede");
    redefinirPaginaDaAya();
    definirPaginaDaAya("recursos", "Recursos");
    perfil = {
      ativo: true,
      perfil: "usuario",
      admin_global: false,
      permissoes: { recursos: "leitor" },
    };
    navegar = vi.fn();
    perguntar = vi.fn(async () => ({
      answer: "Há 3 recursos aguardando parecer no edital 93/2026.",
      provider: "monitora-dados",
      acaoDados: {
        view: "recursos",
        filtro: { edital: "93/2026", metrica: "aguardandoParecer" },
      },
    }));
    paginaFalsa = document.createElement("section");
    paginaFalsa.id = "page-recursos";
    paginaFalsa.className = "page active";
    paginaFalsa.innerHTML =
      '<div data-tour="recursos-kpis">KPIs</div><div data-tour="recursos-fila">Fila</div>';
    document.body.append(paginaFalsa);
  });

  afterEach(async () => {
    await act(async () => controlador?.desmontar());
    raiz?.remove();
    paginaFalsa?.remove();
  });

  describe("dados ao vivo", () => {
    it("o perfil vai junto e o Abrir navega com o filtro", async () => {
      await montar();
      await perguntarNoCampo("quantos recursos aguardando parecer no 93/2026?");
      expect(perguntar.mock.calls[0][0].perfil).toBe(perfil);
      expect($(".aya-mensagem__origem").textContent).toBe("Dados ao vivo");
      await clicar(botao("Abrir"));
      expect(navegar).toHaveBeenCalledWith("recursos");
      expect(consumirPedidoDeFiltro("recursos")).toEqual({
        edital: "93/2026",
        metrica: "aguardandoParecer",
      });
    });
  });

  describe("o que significa (ⓘ de uma tela)", () => {
    it("a pergunta deixada por uma tela abre a Aya e é enviada uma vez", async () => {
      // Revisão de 17/11/2026: o ⓘ dos indicadores da Visão geral.
      localStorage.setItem("agsus_monitora_arara_oculta_v1", "1");
      await montar();
      const { perguntarParaAAya } =
        await import("../src/app/pergunta-para-a-aya.ts");
      await act(async () =>
        perguntarParaAAya("o que significa ociosas na visao geral"),
      );
      await act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 0));
      });
      expect(perguntar).toHaveBeenCalledTimes(1);
      expect(perguntar.mock.calls[0][0].question).toBe(
        "o que significa ociosas na visao geral",
      );
      expect(localStorage.getItem("agsus_monitora_arara_oculta_v1")).toBe("0");
    });
  });

  describe("perguntas sem resposta", () => {
    it("não ajudou guarda a pergunta sem dado pessoal; só o admin copia", async () => {
      await montar();
      await perguntarNoCampo("recurso do CPF 123.456.789-09 sumiu?");
      await clicar(botao("Não ajudou"));
      const guardadas = JSON.parse(localStorage.getItem(CHAVE_SEM_RESPOSTA));
      expect(guardadas).toHaveLength(1);
      expect(guardadas[0]).toMatchObject({
        pergunta: "recurso do CPF [número] sumiu?",
        pagina: "recursos",
        motivo: "nao-ajudou",
      });
      expect(botao("Copiar perguntas sem resposta")).toBeFalsy();
    });

    it("não entendi também guarda, e o admin global copia a lista", async () => {
      perfil = { ...perfil, admin_global: true };
      perguntar.mockResolvedValueOnce({
        answer: "Não encontrei exatamente isso. Você quis dizer…?",
        semResposta: true,
        sugestoes: [],
      });
      const escrever = vi.fn(async () => {});
      Object.defineProperty(window.navigator, "clipboard", {
        configurable: true,
        value: { writeText: escrever },
      });
      await montar();
      await perguntarNoCampo("xpto da planilha?");
      await clicar(botao("Copiar perguntas sem resposta"));
      expect(escrever).toHaveBeenCalledWith(
        expect.stringContaining("- xpto da planilha? (recursos; não entendi"),
      );
    });
  });

  describe("educação guiada pelo texto", () => {
    it('"me mostra esta tela" começa o tour, sem perguntar à base', async () => {
      await montar();
      await perguntarNoCampo("me mostra esta tela");
      expect(perguntar).not.toHaveBeenCalled();
      expect($(".aya-tour__contador").textContent).toMatch(/^Passo 1 de \d+$/);
      expect($(".aya-tour__titulo").textContent).toBe("Indicadores");
    });
  });
});

bloco("modulos/aya-tour", async () => {
  /*
  O tour guiado da Aya (src/modulos/aya/tour/tour.tsx): mostra um passo por
  vez com contador, pula o passo cujo elemento não existe (nas duas
  direções), navega pelas setas, sai com Esc, prende o foco no balão,
  anuncia o passo ao leitor de tela e, no passo de outra tela, pede a troca
  e espera o elemento aparecer.
*/

  const { Tour, acharAlvo, LIMITE_DA_PROCURA_MS } =
    await import("../src/modulos/aya/tour/tour.tsx");

  let raiz;
  let reactRoot;
  let pagina;

  const $ = (seletor) => document.querySelector(seletor);
  const balao = () => $(".aya-tour__balao");
  const titulo = () => $(".aya-tour__titulo")?.textContent;
  const contador = () => $(".aya-tour__contador")?.textContent;
  const botao = (texto) =>
    [...document.querySelectorAll(".aya-tour button")].find(
      (b) => b.textContent.trim() === texto,
    );
  const visivel = (elemento) => elemento.isConnected && !elemento.hidden;

  const PASSOS = [
    { alvo: "#um", titulo: "Um", texto: "Primeiro." },
    { alvo: "#ausente", titulo: "Ausente", texto: "Não existe." },
    { alvo: ["#tambem-ausente", "#tres"], titulo: "Três", texto: "Terceiro." },
    { titulo: "Fim", texto: "Sem alvo, no meio da tela." },
  ];

  async function montar(props = {}) {
    raiz = document.createElement("div");
    document.body.append(raiz);
    reactRoot = createRoot(raiz);
    await act(async () => {
      reactRoot.render(
        createElement(Tour, {
          passos: PASSOS,
          visivel,
          aoFechar: props.aoFechar || vi.fn(),
          janela: window,
          documento: document,
          ...props,
        }),
      );
    });
  }

  beforeEach(() => {
    pagina = document.createElement("main");
    for (const id of ["um", "tres"]) {
      const el = document.createElement("div");
      el.id = id;
      el.textContent = id;
      pagina.append(el);
    }
    document.body.append(pagina);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(async () => {
    await act(async () => reactRoot?.unmount());
    raiz?.remove();
    pagina?.remove();
    vi.useRealTimers();
  });

  describe("passos", () => {
    it("começa no primeiro, com contador, título e texto", async () => {
      await montar();
      expect(contador()).toBe("Passo 1 de 4");
      expect(titulo()).toBe("Um");
      expect(balao().getAttribute("role")).toBe("dialog");
      expect($(".aya-tour__recorte")).not.toBeNull();
      expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    });

    it("pula o passo cujo elemento não existe, indo e voltando", async () => {
      await montar();
      await clicar(botao("Próximo"));
      expect(titulo()).toBe("Três");
      expect(contador()).toBe("Passo 3 de 4");
      await clicar(botao("Anterior"));
      expect(titulo()).toBe("Um");
    });

    it("vale o primeiro seletor da lista que acha um elemento", () => {
      expect(acharAlvo(PASSOS[2], document, visivel)?.id).toBe("tres");
      expect(acharAlvo(PASSOS[1], document, visivel)).toBeNull();
      expect(acharAlvo({ alvo: "[[inválido" }, document, visivel)).toBeNull();
    });

    it("passo sem alvo fica no meio, sem recorte; Concluir fecha como concluído", async () => {
      const aoFechar = vi.fn();
      await montar({ aoFechar, inicio: 3 });
      expect(titulo()).toBe("Fim");
      expect($(".aya-tour__recorte")).toBeNull();
      expect($(".aya-tour__faixa--inteira")).not.toBeNull();
      await clicar(botao("Concluir"));
      expect(aoFechar).toHaveBeenCalledWith("concluiu", 3);
    });

    it("a arara do balão aponta para o elemento da vez; sem elemento, fala", async () => {
      const araraDoBalao = () => $(".aya-tour__arara .mascote");
      await montar();
      expect($(".aya-tour__arara").getAttribute("aria-hidden")).toBe("true");
      expect(araraDoBalao().getAttribute("data-estado")).toBe("apontando");
      await clicar(botao("Próximo"));
      await clicar(botao("Próximo"));
      expect(titulo()).toBe("Fim");
      expect(araraDoBalao().getAttribute("data-pedido")).toBe("falando");
    });

    it("último passo ausente conclui ao avançar", async () => {
      const aoFechar = vi.fn();
      await montar({
        aoFechar,
        passos: [PASSOS[0], { alvo: "#nada", titulo: "X", texto: "x" }],
      });
      await clicar(botao("Próximo"));
      expect(aoFechar).toHaveBeenCalledWith("concluiu", 1);
    });

    it("avisa cada passo mostrado (a trilha guarda o progresso daí)", async () => {
      const aoMudarPasso = vi.fn();
      await montar({ aoMudarPasso });
      await clicar(botao("Próximo"));
      expect(aoMudarPasso.mock.calls.map(([i]) => i)).toEqual([0, 2]);
    });
  });

  describe("teclado e leitor de tela", () => {
    it("→ avança, ← volta", async () => {
      await montar();
      await teclar(document.activeElement, "ArrowRight");
      expect(titulo()).toBe("Três");
      await teclar(document.activeElement, "ArrowLeft");
      expect(titulo()).toBe("Um");
    });

    it("Esc sai como pulado, no passo em que estava", async () => {
      const aoFechar = vi.fn();
      await montar({ aoFechar });
      await teclar(document.activeElement, "ArrowRight");
      await teclar(document.activeElement, "Escape");
      expect(aoFechar).toHaveBeenCalledWith("pulou", 2);
    });

    it("Pular sai como pulado", async () => {
      const aoFechar = vi.fn();
      await montar({ aoFechar });
      await clicar(botao("Pular"));
      expect(aoFechar).toHaveBeenCalledWith("pulou", 0);
    });

    it("o foco vai para o balão e Tab não sai dele", async () => {
      await montar();
      expect(balao().contains(document.activeElement)).toBe(true);
      expect(document.activeElement.textContent).toBe("Próximo");
      // Tab no último focável volta ao primeiro (Anterior está desabilitado no 1º passo).
      await teclar(document.activeElement, "Tab");
      expect(document.activeElement.textContent).toBe("Pular");
      await teclar(document.activeElement, "Tab", { shiftKey: true });
      expect(document.activeElement.textContent).toBe("Próximo");
    });

    it("anuncia o passo numa região viva", async () => {
      await montar();
      const anuncio = $(".aya-tour [aria-live='polite']");
      expect(anuncio.textContent).toBe("Passo 1 de 4: Um. Primeiro.");
      expect(balao().getAttribute("aria-modal")).toBe("true");
    });
  });

  describe("passo em outra tela", () => {
    it("pede a troca de tela e espera o elemento aparecer", async () => {
      vi.useFakeTimers();
      const irPara = vi.fn(() => true);
      await montar({
        irPara,
        passos: [
          { pagina: "recursos", alvo: "#chega", titulo: "Chegou", texto: "." },
        ],
      });
      expect(irPara).toHaveBeenCalledWith(
        expect.objectContaining({ pagina: "recursos" }),
      );
      expect(balao()).toBeNull();
      const el = document.createElement("div");
      el.id = "chega";
      pagina.append(el);
      await act(async () => vi.advanceTimersByTime(300));
      expect(titulo()).toBe("Chegou");
    });

    it("se o elemento não aparece a tempo, pula", async () => {
      vi.useFakeTimers();
      const aoFechar = vi.fn();
      await montar({
        aoFechar,
        irPara: () => true,
        passos: [
          { pagina: "recursos", alvo: "#nunca", titulo: "N", texto: "." },
        ],
      });
      await act(async () => vi.advanceTimersByTime(2000));
      expect(aoFechar).toHaveBeenCalledWith("concluiu", 0);
    });

    it("com a tela ainda baixando, espera mais — mas não para sempre", async () => {
      vi.useFakeTimers();
      const aoFechar = vi.fn();
      await montar({
        aoFechar,
        irPara: () => true,
        carregando: () => true,
        passos: [
          { pagina: "recursos", alvo: "#nunca", titulo: "N", texto: "." },
        ],
      });
      await act(async () => vi.advanceTimersByTime(5000));
      expect(aoFechar).not.toHaveBeenCalled();
      await act(async () => vi.advanceTimersByTime(LIMITE_DA_PROCURA_MS));
      expect(aoFechar).toHaveBeenCalledWith("concluiu", 0);
      // Parou de procurar: nenhum temporizador da procura ficou para trás.
      expect(vi.getTimerCount()).toBe(0);
    });
  });

  describe("holofote acompanha o elemento", () => {
    it("observa o tamanho do elemento da vez e troca ao mudar de passo", async () => {
      const observados = [];
      const desligados = [];
      class ObservadorFalso {
        constructor(aoMudar) {
          this.aoMudar = aoMudar;
        }
        observe(elemento) {
          observados.push(elemento.id);
        }
        disconnect() {
          desligados.push(true);
        }
      }
      const original = window.ResizeObserver;
      window.ResizeObserver = ObservadorFalso;
      try {
        await montar();
        expect(observados).toEqual(["um"]);
        await clicar(botao("Próximo"));
        expect(observados).toEqual(["um", "tres"]);
        expect(desligados.length).toBeGreaterThanOrEqual(1);
        // O leitor de tela ouve "Passo 3 de 4: …" (o ausente foi pulado).
        expect($(".aya-tour [role='status']").textContent).toBe(
          "Passo 3 de 4: Três. Terceiro.",
        );
      } finally {
        window.ResizeObserver = original;
      }
    });

    it("recorta o elemento com quatro faixas em volta e o deixa clicável", async () => {
      await montar();
      expect(document.querySelectorAll(".aya-tour__faixa")).toHaveLength(4);
      const recorte = $(".aya-tour__recorte");
      expect(recorte.getAttribute("aria-hidden")).toBe("true");
      expect(balao().getAttribute("aria-modal")).toBe("true");
      expect(document.activeElement).toBe(botao("Próximo"));
    });
  });
});

bloco("modulos/aya-trilhas", async () => {
  /*
  Tours e trilhas no painel da Aya (src/modulos/aya/): o botão "Me mostra
  esta tela" no cabeçalho e a sugestão do mesmo nome, a seção "Aprender" com
  as trilhas do perfil e o progresso, a trilha que retoma de onde parou e
  marca concluída, e a oferta de "Primeiros passos" só na primeira entrada.
*/

  const { Aya } = await import("../src/modulos/aya/aya.tsx");
  const { definirPaginaDaAya, redefinirPaginaDaAya } =
    await import("../src/modulos/aya/estado.ts");
  const { CHAVE_PROGRESSO_DAS_TRILHAS, CHAVE_OFERTA_DE_PRIMEIROS_PASSOS } =
    await import("../src/modulos/aya/tour/progresso.ts");

  let raiz;
  let controlador;
  let paginaFalsa;
  let navegar;
  let perfil;

  const $ = (seletor) => document.querySelector(seletor);
  const $$ = (seletor) => [...document.querySelectorAll(seletor)];
  const botao = (rotulo) =>
    $$("button").find(
      (b) =>
        b.getAttribute("aria-label") === rotulo ||
        b.textContent.trim() === rotulo,
    );
  const tituloDoPasso = () => $(".aya-tour__titulo")?.textContent;
  const progressoGuardado = () =>
    JSON.parse(localStorage.getItem(CHAVE_PROGRESSO_DAS_TRILHAS) || "{}");

  const LEITOR = {
    ativo: true,
    perfil: "usuario",
    admin_global: false,
    permissoes: {
      dashboard: "leitor",
      nucleo: "leitor",
      calendario: "leitor",
      analises: "leitor",
      aprovados: "leitor",
      entrevistas: "leitor",
      recursos: "leitor",
      selecao: "leitor",
    },
  };

  /* Uma Visão geral e um Recursos de mentira, com os seletores dos roteiros. */
  function montarPaginasFalsas() {
    paginaFalsa = document.createElement("div");
    const pedacos = [
      [
        "section",
        { id: "page-dashboard", class: "page active" },
        [
          ["div", { "data-seletor-de-area": "" }],
          ["div", { class: "visao-geral-filtros" }],
          ["div", { class: "visao-geral-kpis" }],
        ],
      ],
      [
        "section",
        { id: "page-recursos", class: "page active" },
        [
          ["div", { class: "recursos-kpis" }],
          ["section", { "aria-labelledby": "recursosFilaTitulo" }],
        ],
      ],
    ];
    for (const [tag, atributos, filhos] of pedacos) {
      const el = document.createElement(tag);
      for (const [k, v] of Object.entries(atributos)) el.setAttribute(k, v);
      for (const [t, a] of filhos) {
        const filho = document.createElement(t);
        for (const [k, v] of Object.entries(a)) filho.setAttribute(k, v);
        el.append(filho);
      }
      paginaFalsa.append(el);
    }
    document.body.append(paginaFalsa);
  }

  async function montar() {
    raiz = document.createElement("div");
    document.body.append(raiz);
    await act(async () => {
      controlador = desenharNoTeste(
        raiz,
        createElement(Aya, {
          perguntar: vi.fn(async () => ({ answer: "ok" })),
          navegar,
          abrirSecao: vi.fn(),
          obterPerfil: () => perfil,
          configuracao: () => "",
        }),
      );
    });
  }

  const abrirPainel = () => clicar($(".aya-arara"));

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    // Quem já recebeu a oferta não a vê de novo (os testes da oferta limpam isto).
    localStorage.setItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS, "1");
    redefinirDadosDoMonitoramento();
    definirAreasDoUsuario(["saude-indigena", "sede"]);
    definirAreaAtual("sede");
    redefinirPaginaDaAya();
    definirPaginaDaAya("recursos", "Recursos");
    navegar = vi.fn((view) => definirPaginaDaAya(view, view));
    perfil = LEITOR;
    Element.prototype.scrollIntoView = vi.fn();
    montarPaginasFalsas();
  });

  afterEach(async () => {
    await act(async () => controlador?.desmontar());
    raiz?.remove();
    paginaFalsa?.remove();
    vi.useRealTimers();
  });

  describe("Me mostra esta tela", () => {
    it("botão no cabeçalho; abrir fecha o painel e mostra o 1º passo existente", async () => {
      await montar();
      await abrirPainel();
      expect($(".aya-sugestao--tour")).toBeNull();
      await clicar(botao("Me mostra esta tela"));
      expect($(".aya-painel")).toBeNull();
      // "Novo recurso" não existe para o leitor: o tour começa nos filtros/indicadores.
      expect(tituloDoPasso()).toBe("Indicadores");
      await teclar(document.activeElement, "Escape");
      expect($(".aya-tour")).toBeNull();
      expect(document.activeElement).toBe($(".aya-arara"));
    });

    it("tela sem roteiro não oferece o tour", async () => {
      definirPaginaDaAya("external", "Painel externo");
      await montar();
      await abrirPainel();
      expect(botao("Me mostra esta tela")).toBeFalsy();
    });
  });

  describe("Aprender", () => {
    it("nasce recolhido: só o botão Aprender; clicar mostra as trilhas", async () => {
      await montar();
      await abrirPainel();
      const abrir = $(".aya-aprender__abrir");
      expect(abrir.textContent).toContain("Aprender");
      expect(abrir.getAttribute("aria-expanded")).toBe("false");
      expect($(".aya-aprender__lista").hidden).toBe(true);
      await clicar(abrir);
      expect(abrir.getAttribute("aria-expanded")).toBe("true");
      expect($(".aya-aprender__lista").hidden).toBe(false);
    });

    it("lista só as trilhas do perfil, com o total de passos", async () => {
      await montar();
      await abrirPainel();
      const trilhas = $$(".aya-trilha").map((b) => b.dataset.trilha);
      expect(trilhas).toEqual([
        "primeiros-passos",
        "do-edital-ao-aprovado",
        "conduzir-entrevista",
      ]);
      expect(
        $(".aya-trilha[data-trilha='primeiros-passos']").textContent,
      ).toContain("8 passos");
    });

    it("a trilha navega, guarda o passo e retoma de onde parou", async () => {
      await montar();
      await abrirPainel();
      await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
      expect(navegar).toHaveBeenCalledWith("dashboard");
      expect(tituloDoPasso()).toBe("Boas-vindas ao Yeendé");
      await clicar(botao("Próximo"));
      expect(tituloDoPasso()).toBe("Área atual");
      await clicar(botao("Próximo"));
      // "Menu" (#nav) não existe aqui: pula para os filtros.
      expect(tituloDoPasso()).toBe("Visão geral: filtros");
      expect(progressoGuardado()["primeiros-passos"]).toEqual({
        passo: 3,
        concluida: false,
      });
      await clicar(botao("Pular"));

      await abrirPainel();
      expect(
        $(".aya-trilha[data-trilha='primeiros-passos']").textContent,
      ).toContain("4 de 8");
      await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
      expect(tituloDoPasso()).toBe("Visão geral: filtros");
    });

    it("chegar ao fim marca a trilha como concluída", async () => {
      localStorage.setItem(
        CHAVE_PROGRESSO_DAS_TRILHAS,
        JSON.stringify({ "primeiros-passos": { passo: 7, concluida: false } }),
      );
      definirPaginaDaAya("dashboard", "Visão geral");
      await montar();
      await abrirPainel();
      await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
      expect(tituloDoPasso()).toBe("Peça ajuda à Aya");
      await clicar(botao("Concluir"));
      expect(progressoGuardado()["primeiros-passos"].concluida).toBe(true);
      await abrirPainel();
      expect(
        $(".aya-trilha[data-trilha='primeiros-passos']").textContent,
      ).toContain("Concluída");
    });

    it("sem localStorage, a trilha funciona e só não lembra", async () => {
      const original = Storage.prototype.setItem;
      Storage.prototype.setItem = () => {
        throw new Error("bloqueado");
      };
      try {
        await montar();
        await abrirPainel();
        await clicar($(".aya-trilha[data-trilha='primeiros-passos']"));
        expect(tituloDoPasso()).toBe("Boas-vindas ao Yeendé");
      } finally {
        Storage.prototype.setItem = original;
      }
    });
  });

  describe("primeira entrada", () => {
    beforeEach(() => localStorage.removeItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS));

    it("oferece Primeiros passos uma vez, sem abrir nada sozinha", async () => {
      await montar();
      expect($(".aya-oferta--balao")).not.toBeNull();
      expect($(".aya-tour")).toBeNull();
      expect($(".aya-painel")).toBeNull();
      expect(localStorage.getItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS)).toBe("1");
      await clicar(botao("Agora não"));
      expect($(".aya-oferta[aria-label='Primeiros passos']")).toBeNull();
      // Depois dela, o convite discreto para o tour desta tela (uma vez só).
      expect($(".aya-oferta--balao").getAttribute("aria-label")).toMatch(
        /^Tour: /,
      );
      await clicar(botao("Agora não"));
      expect($(".aya-oferta")).toBeNull();

      // Recarregou: não oferece de novo.
      await act(async () => controlador.desmontar());
      raiz.remove();
      await montar();
      expect($(".aya-oferta")).toBeNull();
    });

    it("aceitar começa a trilha", async () => {
      await montar();
      await clicar(botao("Mostrar"));
      expect(tituloDoPasso()).toBe("Boas-vindas ao Yeendé");
    });

    it("sem perfil (antes de entrar), não oferece", async () => {
      perfil = null;
      await montar();
      expect($(".aya-oferta")).toBeNull();
      expect(localStorage.getItem(CHAVE_OFERTA_DE_PRIMEIROS_PASSOS)).toBeNull();
    });
  });
});

bloco("modulos/aya", async () => {
  /*
  O painel da Aya (src/modulos/aya/): abre com a saudação e a mensagem da
  página e da área atuais, sem botões de sugestão; a pergunta vai pelo campo;
  o acesso ao suporte é um ícone do cabeçalho; Aprender fica recolhido; Esc
  fecha e devolve o foco à arara; "não ajudou" mostra o cartão do chamado; a
  conversa fica na aba; a resposta pode trazer o botão da tela citada.
*/

  const { Aya, CHAVE_OCULTA, CHAVE_AVALIACOES, CHAVE_POSICAO_DA_ARARA } =
    await import("../src/modulos/aya/aya.tsx");
  const { definirPaginaDaAya, esquecerConversaDaAya, redefinirPaginaDaAya } =
    await import("../src/modulos/aya/estado.ts");

  let raiz;
  let controlador;
  let perguntar;
  let navegar;
  let abrirSecao;

  const $ = (seletor) => raiz.querySelector(seletor);
  const $$ = (seletor) => [...raiz.querySelectorAll(seletor)];
  const textoDe = (seletor) => $(seletor)?.textContent || "";
  const botao = (rotulo) =>
    $$("button").find(
      (b) =>
        b.getAttribute("aria-label") === rotulo ||
        b.textContent.trim() === rotulo,
    );
  async function perguntarNoCampo(texto) {
    await digitar($("textarea"), texto);
    await teclar($("textarea"), "Enter");
  }

  async function montar() {
    raiz = document.createElement("div");
    document.body.append(raiz);
    await act(async () => {
      controlador = desenharNoTeste(
        raiz,
        createElement(Aya, {
          perguntar,
          navegar,
          abrirSecao,
          configuracao: (chave) =>
            ({
              support_email: "suporte@agenciasus.org.br",
              app_version_current: "V1",
            })[chave] || "",
        }),
      );
    });
  }

  async function abrirPainel() {
    await clicar($(".aya-arara"));
  }

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    redefinirDadosDoMonitoramento();
    definirAreasDoUsuario(["saude-indigena", "sede", "projetos"]);
    definirAreaAtual("sede");
    redefinirPaginaDaAya();
    definirPaginaDaAya("recursos", "Painel de recursos");
    perguntar = vi.fn(async ({ question }) => ({
      answer: `Resposta para: ${question}`,
      provider: "curated-official",
      sources: [],
      acao: "config:acessos",
    }));
    navegar = vi.fn();
    abrirSecao = vi.fn();
  });

  afterEach(async () => {
    await act(async () => controlador?.desmontar());
    raiz?.remove();
  });

  describe("abrir e fechar", () => {
    it("começa fechada, só com a arara (sem o ponto Beta)", async () => {
      await montar();
      expect($(".aya-painel")).toBeNull();
      expect($(".aya-arara")).not.toBeNull();
      expect($(".aya-arara .aya-selo-beta")).toBeNull();
    });

    it("abre com a saudação e a mensagem da página, sem sugestões", async () => {
      await montar();
      await abrirPainel();
      const painel = $(".aya-painel");
      expect(painel.getAttribute("role")).toBe("dialog");
      expect(textoDe(".aya-balao")).toBe("Olá, sou a Aya.");
      expect(textoDe(".aya-painel__pagina")).toBe("Painel de recursos · SEDE");
      expect(painel.textContent).toContain(
        "Posso explicar os indicadores, as pendências, os prazos e o fluxo do parecer jurídico.",
      );
      expect(painel.textContent).toContain(
        "Para começar, digite sua pergunta.",
      );
      // Só o chip do tour da tela; as sugestões de pergunta não aparecem.
      expect(
        [...document.querySelectorAll(".aya-sugestao")].map((b) =>
          b.textContent.trim(),
        ),
      ).toEqual(["Me mostra esta tela, item por item"]);
      expect($(".aya-selo-beta--nome").textContent).toContain("Beta");
      expect($(".aya-arara")).toBeNull();
      expect(localStorage.getItem(CHAVE_OCULTA)).toBe("0");
    });

    it("feedback e suporte pelo Gmail num ícone do cabeçalho, sem rodapé fixo", async () => {
      await montar();
      await abrirPainel();
      expect($(".aya-aviso")).toBeNull();
      expect($(".aya-painel__rodape").textContent).not.toContain("chamado");
      const suporte = $(".aya-painel__acoes .aya-suporte");
      expect(suporte.getAttribute("aria-label")).toBe("Feedback e suporte");
      const gmail = new URL(suporte.href);
      expect(gmail.origin).toBe("https://mail.google.com");
      expect(gmail.searchParams.get("to")).toBe("suporte@agenciasus.org.br");
      expect(gmail.searchParams.get("body")).toContain(
        "Página: Painel de recursos",
      );
      expect(suporte.target).toBe("_blank");
      expect($$("a[href^='mailto:']")).toHaveLength(0);
      expect($("textarea").getAttribute("placeholder")).toBe("Pergunte à Aya…");
      expect(botao("Enviar pergunta").disabled).toBe(true);
      await digitar($("textarea"), "oi");
      expect(botao("Enviar pergunta").disabled).toBe(false);
    });

    it("Esc fecha e devolve o foco à arara", async () => {
      await montar();
      await abrirPainel();
      await teclar($("textarea"), "Escape");
      expect($(".aya-painel")).toBeNull();
      expect(document.activeElement).toBe($(".aya-arara"));
      expect(localStorage.getItem(CHAVE_OCULTA)).toBe("1");
    });

    it("o × fecha", async () => {
      await montar();
      await abrirPainel();
      await clicar(botao("Fechar a Aya"));
      expect($(".aya-painel")).toBeNull();
    });
  });

  describe("página e área atuais", () => {
    it("trocar de página troca a mensagem", async () => {
      await montar();
      await abrirPainel();
      expect($(".aya-painel").textContent).toContain("parecer jurídico");
      await act(async () =>
        definirPaginaDaAya("entrevistas", "Painel de entrevistas"),
      );
      expect($(".aya-painel").textContent).not.toContain("parecer jurídico");
      expect(textoDe(".aya-painel__pagina")).toBe(
        "Painel de entrevistas · SEDE",
      );
    });

    it("a Visão geral segue a área: SEDE sem mapa, Projetos com o mapa", async () => {
      await montar();
      await abrirPainel();
      await act(async () => definirPaginaDaAya("dashboard", "SEDE"));
      expect(textoDe(".aya-painel__pagina")).toBe("Visão geral · SEDE");
      expect($(".aya-painel").textContent).not.toContain("Saúde Indígena");
      await act(async () => definirAreaAtual("projetos"));
      expect(textoDe(".aya-painel__pagina")).toBe("Visão geral · Projetos");
      expect($(".aya-painel").textContent).toContain("mapa");
    });
  });

  describe("conversa", () => {
    it("a pergunta vai com página, área e seção", async () => {
      await montar();
      await abrirPainel();
      await perguntarNoCampo("Quem pode decidir um recurso?");
      expect(perguntar).toHaveBeenCalledTimes(1);
      expect(perguntar.mock.calls[0][0]).toMatchObject({
        question: "Quem pode decidir um recurso?",
        section: "recursos",
        area: "sede",
        secao: "",
      });
      const log = $('[role="log"]');
      expect(log.getAttribute("aria-live")).toBe("polite");
      expect(log.textContent).toContain("Quem pode decidir um recurso?");
      expect(log.textContent).toContain(
        "Resposta para: Quem pode decidir um recurso?",
      );
      expect(log.textContent).toContain("Fonte oficial");
    });

    it("Enter envia; a conversa fica guardada na aba", async () => {
      await montar();
      await abrirPainel();
      await digitar($("textarea"), "Como dar acesso a alguém?");
      await teclar($("textarea"), "Enter");
      expect(perguntar).toHaveBeenCalledTimes(1);
      const guardada = JSON.parse(
        sessionStorage.getItem("agsus_aya_conversa_v1"),
      );
      expect(guardada.map((t) => t.role)).toEqual(["user", "assistant"]);
    });

    it("a resposta traz o botão da tela citada, que navega no app", async () => {
      await montar();
      await abrirPainel();
      await perguntarNoCampo("Quem pode decidir um recurso?");
      await clicar(botao("Ir para Configurações › Acessos"));
      expect(navegar).toHaveBeenCalledWith("config");
      expect(abrirSecao).toHaveBeenCalledWith("acessos");
    });

    it("em Configurações manda a seção aberta", async () => {
      // A navegação diz a seção aberta (src/app/navegacao.ts → definirPaginaDaAya).
      await act(async () =>
        definirPaginaDaAya("config", "Configurações", "modulos"),
      );
      await montar();
      await abrirPainel();
      expect(textoDe(".aya-painel__pagina")).toBe(
        "Configurações › Módulos e abas",
      );
      await perguntarNoCampo("O que é o selo BETA?");
      expect(perguntar.mock.calls[0][0]).toMatchObject({
        section: "config",
        secao: "modulos",
      });
    });

    it("pensando: o campo fica só leitura, com o foco, e não envia de novo", async () => {
      let responder;
      perguntar = vi.fn(
        () =>
          new Promise((resolver) => {
            responder = resolver;
          }),
      );
      await montar();
      await abrirPainel();
      const campo = $("textarea");
      campo.focus();
      await perguntarNoCampo("Quem decide um recurso?");
      expect(campo.disabled).toBe(false);
      expect(campo.readOnly).toBe(true);
      expect(campo.getAttribute("aria-disabled")).toBe("true");
      expect(document.activeElement).toBe(campo);
      await teclar(campo, "Enter");
      expect(perguntar).toHaveBeenCalledTimes(1);
      await act(async () =>
        responder({
          answer: "A comissão.",
          provider: "curated-official",
          sources: [],
        }),
      );
      expect(campo.readOnly).toBe(false);
    });

    it("sair do sistema limpa a conversa que está na tela", async () => {
      await montar();
      await abrirPainel();
      await perguntarNoCampo("Quem pode decidir um recurso?");
      expect($('[role="log"]').textContent).not.toBe("");
      await act(async () => esquecerConversaDaAya());
      expect($('[role="log"]').textContent).toBe("");
      expect(sessionStorage.getItem("agsus_aya_conversa_v1")).toBe("[]");
    });

    it("Limpar conversa apaga a conversa e volta o Aprender", async () => {
      await montar();
      await abrirPainel();
      await perguntarNoCampo("Quem pode decidir um recurso?");
      await clicar(botao("Limpar conversa"));
      expect($('[role="log"]').textContent).toBe("");
      expect(sessionStorage.getItem("agsus_aya_conversa_v1")).toBe("[]");
    });
  });

  describe("avaliação e chamado", () => {
    it("na dúvida oferece perguntas clicáveis e Gmail em outra aba", async () => {
      perguntar.mockResolvedValueOnce({
        answer: "Não encontrei exatamente isso. Você quis dizer…?",
        sugestoes: [
          {
            rotulo: "Prazo do recurso",
            pergunta: "De onde vem o prazo do recurso?",
          },
        ],
        oferecerChamado: true,
      });
      await montar();
      await abrirPainel();
      await digitar($("textarea"), "prazo");
      await clicar(botao("Enviar pergunta"));
      const principal = $(".aya-chamado__botao");
      expect(principal.getAttribute("target")).toBe("_blank");
      expect(principal.getAttribute("rel")).toContain("noopener");
      expect($(".aya-chamado a[href^='mailto:']")).toBeNull();
      await clicar(botao("Prazo do recurso"));
      expect(perguntar).toHaveBeenLastCalledWith(
        expect.objectContaining({
          question: "De onde vem o prazo do recurso?",
        }),
      );
    });

    it("'não ajudou' guarda a avaliação no navegador e mostra o cartão do chamado", async () => {
      await montar();
      await abrirPainel();
      await perguntarNoCampo("Quem pode decidir um recurso?");
      expect($(".aya-chamado")).toBeNull();
      await clicar(botao("Não ajudou"));
      const cartao = $(".aya-chamado");
      expect(cartao.textContent).toContain(
        "Vou abrir o Gmail com a conversa preenchida.",
      );
      const link = cartao.querySelector("a");
      expect(link.textContent).toContain("Abrir chamado");
      const href = link.getAttribute("href");
      expect(
        href.startsWith(
          "https://mail.google.com/mail/?view=cm&fs=1&to=suporte%40agenciasus.org.br",
        ),
      ).toBe(true);
      expect(decodeURIComponent(href)).toContain(
        "Yeendé · Chamado · Painel de recursos · SEDE",
      );
      expect(decodeURIComponent(href)).toContain(
        "Pergunta: Quem pode decidir um recurso?",
      );
      const avaliacoes = JSON.parse(localStorage.getItem(CHAVE_AVALIACOES));
      expect(avaliacoes).toEqual([
        expect.objectContaining({
          pagina: "recursos",
          area: "sede",
          util: false,
        }),
      ]);
    });

    it("'ajudou' agradece, sem cartão", async () => {
      await montar();
      await abrirPainel();
      await perguntarNoCampo("Quem pode decidir um recurso?");
      await clicar(botao("Ajudou"));
      expect($(".aya-chamado")).toBeNull();
      expect($(".aya-avaliacao__obrigado").textContent).toContain("Obrigada");
    });

    it("pedir o suporte mostra o cartão do chamado", async () => {
      await montar();
      await abrirPainel();
      await digitar($("textarea"), "Quero falar com o suporte");
      await teclar($("textarea"), "Enter");
      expect($(".aya-chamado")).not.toBeNull();
    });
  });

  describe("foco preso no painel", () => {
    it("Tab no último controle volta ao primeiro", async () => {
      await montar();
      await abrirPainel();
      await digitar($("textarea"), "oi");
      const enviar = botao("Enviar pergunta");
      enviar.focus();
      await teclar(enviar, "Tab");
      // O primeiro do cabeçalho é "Me mostra esta tela" (Recursos tem tour).
      expect(document.activeElement).toBe(botao("Me mostra esta tela"));
    });
  });

  describe("a arara: rosto fechada, corpo no painel e escondida na borda", () => {
    const arara = () => $(".aya-arara");
    const mascoteDoBotao = () => $(".aya-arara .mascote");
    const tamanhoDe = (mascote) =>
      mascote.style.getPropertyValue("--mascote-tamanho");
    const posicaoGuardada = () =>
      JSON.parse(localStorage.getItem(CHAVE_POSICAO_DA_ARARA) || "null");

    function ponteiro(tipo, x, y) {
      const evento = new MouseEvent(tipo, {
        bubbles: true,
        clientX: x,
        clientY: y,
        button: 0,
      });
      Object.defineProperty(evento, "pointerId", { value: 1 });
      return evento;
    }

    it("fechada mostra só o rosto; aberta, o painel mostra a arara inteira, maior", async () => {
      await montar();
      expect(mascoteDoBotao().getAttribute("data-enquadramento")).toBe("rosto");
      expect(tamanhoDe(mascoteDoBotao())).toBe("56px");
      // A área clicável e o nome acessível continuam os mesmos.
      expect(arara().getAttribute("aria-label")).toBe(
        "Abrir a Aya, assistente do Yeendé",
      );
      await abrirPainel();
      const doPainel = $(".aya-avatar .mascote");
      expect(tamanhoDe(doPainel)).toBe("88px");
      await act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 80));
      });
      expect(doPainel.getAttribute("data-enquadramento")).toBe("corpo");
      await clicar(botao("Fechar a Aya"));
      expect(mascoteDoBotao().getAttribute("data-enquadramento")).toBe("corpo");
      await act(async () => {
        await new Promise((resolver) => setTimeout(resolver, 80));
      });
      expect(mascoteDoBotao().getAttribute("data-enquadramento")).toBe("rosto");
    });

    it("solta encostada numa borda, se esconde; a borda fica guardada com a posição", async () => {
      await montar();
      const alvo = arara();
      await act(async () => {
        alvo.dispatchEvent(ponteiro("pointerdown", 100, 100));
        alvo.dispatchEvent(ponteiro("pointermove", 400, 300));
      });
      expect(alvo.dataset.borda).toBeUndefined();
      await act(async () => {
        alvo.dispatchEvent(ponteiro("pointermove", 5000, 300));
        alvo.dispatchEvent(ponteiro("pointerup", 5000, 300));
      });
      expect(alvo.dataset.borda).toBe("direita");
      expect(posicaoGuardada()).toMatchObject({ borda: "direita" });
      // O clique do fim do arraste não abre o painel.
      await clicar(alvo);
      expect($(".aya-painel")).toBeNull();
      // Clicar nela escondida abre o chat como sempre.
      await clicar(arara());
      expect($(".aya-painel")).not.toBeNull();
    });

    it("lembra escondida ao recarregar; as setas a tiram da borda (e a escondem)", async () => {
      // Guardada escondida na direita de uma tela mais larga: ao carregar, ela
      // volta para a borda direita desta janela (margem de 8px).
      localStorage.setItem(
        CHAVE_POSICAO_DA_ARARA,
        JSON.stringify({ left: 1856, top: 300, borda: "direita" }),
      );
      await montar();
      expect(arara().dataset.borda).toBe("direita");
      expect(arara().getAttribute("title")).toMatch(/tirá-la da borda/);
      await teclar(arara(), "ArrowLeft");
      expect(arara().dataset.borda).toBeUndefined();
      expect(posicaoGuardada()).toEqual({
        left: window.innerWidth - 8 - 24,
        top: 300,
      });
      await teclar(arara(), "ArrowUp", { shiftKey: true });
      await teclar(arara(), "ArrowUp", { shiftKey: true });
      await teclar(arara(), "ArrowUp", { shiftKey: true });
      expect(arara().dataset.borda).toBe("topo");
      expect(posicaoGuardada()).toMatchObject({ top: 8, borda: "topo" });
      // Outras teclas não mexem (Enter continua abrindo).
      await teclar(arara(), "a");
      expect(arara().dataset.borda).toBe("topo");
    });
  });
});

bloco("modulos/comemoracoes-na-casca", () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  /*
  As comemorações são filhas da casca (src/app/casca/pecas.tsx): o desenho
  baixa quando a primeira entra na fila; no StrictMode (que monta, desmonta
  e monta de novo) o laço de quadros não dobra e nada sobra no fim.
*/

  let raiz = null;
  let lugar = null;
  afterEach(() => {
    act(() => filaDeComemoracoes.esvaziar());
    act(() => raiz?.unmount());
    lugar?.remove();
    raiz = null;
  });

  function montar(componente) {
    lugar = document.createElement("div");
    document.body.append(lugar);
    raiz = createRoot(lugar);
    act(() => raiz.render(createElement(StrictMode, null, componente)));
  }

  function janelaComCanvas() {
    const { quadros, requestAnimationFrame } = filaDeQuadros();
    const contexto = new Proxy({}, { get: () => () => {}, set: () => true });
    const doc = document.implementation.createHTMLDocument("t");
    Object.defineProperty(doc, "hidden", { value: false, configurable: true });
    const criar = doc.createElement.bind(doc);
    doc.createElement = (tag) => {
      const el = criar(tag);
      if (tag === "canvas") el.getContext = () => contexto;
      return el;
    };
    const janela = {
      innerWidth: 800,
      innerHeight: 600,
      requestAnimationFrame,
      matchMedia: () => ({ matches: false }),
      getComputedStyle: () => ({ getPropertyValue: () => "" }),
      localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    };
    return { doc, janela, quadros };
  }

  describe("comemorações na casca", () => {
    it("sem comemoração, nada (nem o desenho baixa); com uma, o aviso aparece", async () => {
      montar(createElement(ComemoracoesDoApp));
      expect(document.querySelector(".comemoracao")).toBeNull();
      await act(async () => {
        comemorar({ texto: "Parabéns!", confete: false });
      });
      await act(async () => new Promise((r) => setTimeout(r, 0)));
      expect(document.querySelector(".comemoracao").textContent).toContain(
        "Parabéns!",
      );
    });

    it("no StrictMode, um laço de quadros só, e o show limpa tudo ao acabar", () => {
      const { doc, janela, quadros } = janelaComCanvas();
      montar(createElement(Comemoracoes));
      act(() => {
        comemorar({
          texto: "Fogos",
          teste: true,
          efeito: "fogos",
          doc,
          janela,
          aleatorio: criarAleatorio(2),
        });
      });
      expect(doc.querySelectorAll("canvas.comemoracao__fogos")).toHaveLength(1);
      // O StrictMode pediu dois quadros (monta duas vezes), mas só um laço anda.
      quadros.shift()(0);
      quadros.shift()(0);
      expect(quadros).toHaveLength(1);
      let agora = 0;
      let dancou = false;
      let confete = false;
      while (quadros.length) {
        quadros.shift()((agora += 16.7));
        // Um laço só até o fim (a dança e o confete não abrem outro).
        expect(quadros.length).toBeLessThanOrEqual(1);
        const danca = doc.querySelectorAll(".comemoracao__aya--danca");
        expect(danca.length).toBeLessThanOrEqual(1);
        if (danca.length) dancou = true;
        if (doc.querySelector("canvas.comemoracao__motor")) confete = true;
      }
      // A Aya dançou e soltou confete também no StrictMode.
      expect(dancou).toBe(true);
      expect(confete).toBe(true);
      expect(
        doc.querySelectorAll(
          ".comemoracao__fogos, .comemoracao__veu, .comemoracao__aya",
        ),
      ).toHaveLength(0);
      // O aviso fica até o tempo de leitura (ou o ×).
      expect(doc.querySelector(".comemoracao")).not.toBeNull();
    });
  });
});

bloco("modulos/mascote", async () => {
  /*
  A mascote da Aya (src/modulos/aya/mascote/): uma pose ilustrada por estado,
  a troca suave (a nova entra, a antiga sai), o evento global aya:estado,
  movimento reduzido (troca direta, sem animação), só a pose da vez baixada
  (as outras depois, em prioridade baixa), aceno uma vez por sessão, sono por
  inatividade, pausa com a aba oculta e o enquadramento (rosto com a Aya
  fechada, corpo com o painel aberto e nos fogos).
*/

  const { Mascote, enderecoDaPose, reiniciarPosesDaMascote, TROCA_DE_POSE_MS } =
    await import("../src/modulos/aya/mascote/mascote.tsx");
  const { reiniciarPedidoDaAya } =
    await import("../src/modulos/aya/mascote/estado.ts");
  const { CartaoDaMascote } =
    await import("../src/modulos/configuracoes/cartao-da-mascote.tsx");

  let raiz;
  let elemento;
  const ImagemOriginal = window.Image;
  const arara = () => elemento.querySelector(".mascote");
  const estado = () => arara()?.getAttribute("data-estado");
  const poses = () =>
    [...arara().querySelectorAll(".mascote__pose")].map((p) => p.dataset.pose);
  const imagens = () => [...arara().querySelectorAll("img")];

  async function montar(props = {}) {
    await act(async () => raiz.render(createElement(Mascote, props)));
  }

  async function avancar(ms) {
    await act(async () => {
      vi.advanceTimersByTime(ms);
    });
  }

  function oculto(valor) {
    Object.defineProperty(document, "hidden", {
      value: valor,
      configurable: true,
    });
  }

  /* Imagem falsa do navegador: guarda o que foi pedido; `decode` controlável. */
  function imagemFalsa({ decode } = {}) {
    const pedidos = [];
    window.Image = class {
      set src(valor) {
        pedidos.push({ src: valor, prioridade: this.fetchPriority });
      }
      decode() {
        return decode ? decode() : Promise.resolve();
      }
    };
    return pedidos;
  }

  beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
    reiniciarPedidoDaAya();
    reiniciarPosesDaMascote();
    oculto(false);
    elemento = document.createElement("div");
    document.body.append(elemento);
    raiz = createRoot(elemento);
  });

  afterEach(async () => {
    await act(async () => raiz.unmount());
    elemento.remove();
    window.Image = ImagemOriginal;
    delete window.matchMedia;
    delete window.devicePixelRatio;
    vi.useRealTimers();
  });

  describe("a imagem", () => {
    it("nasce no tamanho final, com a pose da vez e nada mais", async () => {
      await montar({ tamanho: 84 });
      expect(arara().style.getPropertyValue("--mascote-tamanho")).toBe("84px");
      expect(poses()).toEqual(["parada"]);
      expect(imagens()).toHaveLength(1);
      expect(imagens()[0].getAttribute("src")).toBe(
        enderecoDaPose("parada", "1x"),
      );
    });

    it("decorativa por padrão (alt vazio); com rótulo vira imagem com nome", async () => {
      await montar();
      expect(arara().getAttribute("aria-hidden")).toBe("true");
      expect(imagens()[0].getAttribute("alt")).toBe("");
      await montar({ rotulo: "Aya" });
      expect(arara().getAttribute("role")).toBe("img");
      expect(arara().getAttribute("aria-label")).toBe("Aya");
      expect(arara().getAttribute("aria-hidden")).toBeNull();
    });

    it("o arquivo segue o tamanho na tela e a densidade de pixels", async () => {
      await montar({ tamanho: 56, enquadramento: "rosto" });
      expect(imagens()[0].getAttribute("src")).toBe(
        enderecoDaPose("parada", "1x"),
      );
      await act(async () => raiz.unmount());
      raiz = createRoot(elemento);
      window.devicePixelRatio = 2;
      await montar({ tamanho: 56, enquadramento: "rosto" });
      expect(imagens()[0].getAttribute("src")).toBe(
        enderecoDaPose("parada", "2x"),
      );
    });

    it("cada pose fica no quadro pelas medidas dela (e o recorte do rosto)", async () => {
      await montar({ estado: "comemorando" });
      const pose = arara().querySelector(".mascote__pose");
      expect(pose.style.getPropertyValue("--pose-largura")).toMatch(/^13\d\./);
      expect(
        Number(pose.style.getPropertyValue("--rosto-escala")),
      ).toBeGreaterThan(2);
    });
  });

  describe("carga das poses", () => {
    it("a arara livre pede as outras poses em prioridade baixa, depois da carga e no ócio", async () => {
      const pedidos = imagemFalsa();
      await montar();
      expect(pedidos).toHaveLength(0);
      await avancar(1600);
      expect(pedidos.map((p) => p.src).sort()).toEqual(
        ESTADOS_DA_MASCOTE.map((pose) => enderecoDaPose(pose, "1x")).sort(),
      );
      expect(new Set(pedidos.map((p) => p.prioridade))).toEqual(
        new Set(["low"]),
      );
    });

    it("a de estado fixo (prévia, fogos, tour) só baixa a pose que mostra", async () => {
      const pedidos = imagemFalsa();
      await montar({ estado: "comemorando" });
      await avancar(5000);
      expect(pedidos).toHaveLength(0);
      expect(poses()).toEqual(["comemorando"]);
    });

    it("a pose nova só entra depois de decodificada (sem piscar vazio)", async () => {
      let liberar;
      imagemFalsa({
        decode: () =>
          new Promise((resolver) => {
            liberar = resolver;
          }),
      });
      await montar({ proprio: null, atencao: false });
      await montar({ proprio: "pensando", atencao: false });
      expect(arara().dataset.pedido).toBe("pensando");
      expect(estado()).toBe("parada");
      expect(poses()).toEqual(["parada"]);
      await act(async () => liberar());
      expect(estado()).toBe("pensando");
    });
  });

  describe("troca de estados", () => {
    it("o painel diz falando/pensando; fixo vence tudo", async () => {
      await montar({ proprio: "pensando" });
      expect(estado()).toBe("pensando");
      await montar({ proprio: "falando" });
      expect(estado()).toBe("falando");
      await montar({ proprio: null });
      expect(estado()).toBe("parada");
      await montar({ estado: "dormindo", proprio: "falando" });
      expect(estado()).toBe("dormindo");
    });

    it("troca suave: a nova entra e a antiga sai, e some no fim da troca", async () => {
      await montar();
      await montar({ proprio: "falando" });
      expect(poses()).toEqual(["parada", "falando"]);
      const [antiga, nova] = arara().querySelectorAll(".mascote__pose");
      expect(antiga.dataset.saindo).toBe("sim");
      expect(nova.dataset.entrando).toBe("sim");
      await avancar(TROCA_DE_POSE_MS + 10);
      expect(poses()).toEqual(["falando"]);
    });

    it("momento inicial vale pelo tempo pedido", async () => {
      await montar({ momentoInicial: { estado: "atenta", duracaoMs: 2000 } });
      expect(estado()).toBe("atenta");
      await avancar(2100);
      expect(estado()).toBe("parada");
    });

    it("acena ao entrar uma vez por sessão", async () => {
      await montar({ acenarAoEntrar: true });
      expect(estado()).toBe("acenando");
      await avancar(3000);
      expect(estado()).toBe("parada");
      await act(async () => raiz.unmount());
      raiz = createRoot(elemento);
      await montar({ acenarAoEntrar: true });
      expect(estado()).toBe("parada");
    });

    it("dorme depois de muito tempo parada e acorda ao interagir", async () => {
      await montar();
      await avancar(INATIVIDADE_PARA_DORMIR_MS - 1000);
      expect(estado()).toBe("parada");
      await avancar(2000);
      expect(estado()).toBe("dormindo");
      await act(async () => {
        window.dispatchEvent(new Event("keydown"));
      });
      expect(estado()).toBe("parada");
    });

    it("fica atenta com o ponteiro perto e volta quando ele se afasta", async () => {
      await montar();
      arara().getBoundingClientRect = () => ({
        left: 100,
        top: 100,
        width: 64,
        height: 64,
        right: 164,
        bottom: 164,
      });
      const mover = async (x, y) =>
        act(async () => {
          window.dispatchEvent(
            Object.assign(new Event("pointermove"), {
              clientX: x,
              clientY: y,
            }),
          );
          vi.advanceTimersByTime(20);
        });
      await mover(300, 132);
      expect(estado()).toBe("atenta");
      await mover(900, 900);
      expect(estado()).toBe("parada");
    });
  });

  describe("evento global aya:estado", () => {
    it("qualquer tela pede um estado; ele expira sozinho", async () => {
      await montar();
      await act(async () => {
        definirEstadoDaAya("comemorando", 1500);
      });
      expect(estado()).toBe("comemorando");
      await avancar(1600);
      expect(estado()).toBe("parada");
    });

    it("pelo CustomEvent direto, e 'parada' limpa o pedido", async () => {
      await montar({ proprio: "falando" });
      await act(async () => {
        window.dispatchEvent(
          new CustomEvent("aya:estado", { detail: { estado: "pensando" } }),
        );
      });
      expect(estado()).toBe("pensando");
      await avancar(60000);
      expect(estado()).toBe("pensando");
      await act(async () => {
        definirEstadoDaAya("parada");
      });
      expect(estado()).toBe("falando");
    });

    it("estado fixo (prévia, fogos) não ouve o evento", async () => {
      await montar({ estado: "acenando" });
      await act(async () => {
        definirEstadoDaAya("dormindo", 1000);
      });
      expect(estado()).toBe("acenando");
    });

    it("comemorações desligadas pela pessoa: não comemora", async () => {
      localStorage.setItem(CHAVE_COMEMORACOES_PESSOAIS, "1");
      await montar();
      await act(async () => {
        definirEstadoDaAya("comemorando", 1500);
      });
      expect(estado()).toBe("parada");
    });
  });

  describe("movimento reduzido e aba oculta", () => {
    beforeEach(() => {
      window.matchMedia = vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
    });

    it("sem animação: a pose troca direto, sem a antiga saindo", async () => {
      await montar();
      expect(arara().getAttribute("data-reduzido")).toBe("sim");
      await montar({ proprio: "falando" });
      expect(estado()).toBe("falando");
      expect(poses()).toEqual(["falando"]);
      expect(
        arara().querySelector(".mascote__pose").dataset.entrando,
      ).toBeUndefined();
    });

    it("com a aba oculta as animações pausam", async () => {
      await montar();
      oculto(true);
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(arara().dataset.pausada).toBe("sim");
      oculto(false);
      await act(async () => {
        document.dispatchEvent(new Event("visibilitychange"));
      });
      expect(arara().dataset.pausada).toBeUndefined();
    });
  });

  describe("enquadramento: rosto (fechada) e corpo (painel aberto, fogos)", () => {
    const quadro = () => arara()?.getAttribute("data-enquadramento");
    const reduzir = () => {
      window.matchMedia = vi.fn(() => ({
        matches: true,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }));
    };

    it("corpo por padrão; o rosto usa a mesma caixa, do mesmo tamanho", async () => {
      await montar({ tamanho: 56 });
      expect(quadro()).toBe("corpo");
      await montar({ tamanho: 56, enquadramento: "rosto" });
      expect(quadro()).toBe("rosto");
      expect(arara().style.getPropertyValue("--mascote-tamanho")).toBe("56px");
    });

    it("trocar o enquadramento na mesma arara não remonta (a transição é do CSS)", async () => {
      await montar({ tamanho: 56, enquadramento: "rosto" });
      const antes = arara();
      const imagem = imagens()[0];
      await montar({ tamanho: 56, enquadramento: "corpo" });
      expect(arara()).toBe(antes);
      expect(imagens()[0]).toBe(imagem);
      expect(quadro()).toBe("corpo");
    });

    it("enquadramentoInicial: nasce no outro e passa ao pedido logo depois", async () => {
      await montar({ tamanho: 88, enquadramentoInicial: "rosto" });
      expect(quadro()).toBe("rosto");
      await avancar(100);
      expect(quadro()).toBe("corpo");
    });

    it("com movimento reduzido, a troca é direta (sem a entrada pelo outro)", async () => {
      reduzir();
      await montar({ tamanho: 88, enquadramentoInicial: "rosto" });
      expect(quadro()).toBe("corpo");
      expect(arara().dataset.reduzido).toBe("sim");
    });

    it("os estados continuam valendo no rosto", async () => {
      for (const pedido of ESTADOS_DA_MASCOTE) {
        await montar({ enquadramento: "rosto", estado: pedido });
        expect(estado()).toBe(pedido);
        expect(quadro()).toBe("rosto");
      }
    });

    it("os fogos (src/modulos/comemoracao/) voam de corpo inteiro, de asas abertas", async () => {
      await montar({
        estado: "comemorando",
        tamanho: 120,
        ouvirAya: false,
        atencao: false,
        dormir: false,
      });
      expect(quadro()).toBe("corpo");
      expect(estado()).toBe("comemorando");
      expect(imagens()[0].getAttribute("src")).toBe(
        enderecoDaPose("comemorando", "1x"),
      );
    });
  });

  describe("a arara dos fogos: erro na mascote não derruba a página", () => {
    it("o erro fica na arara (ErrorBoundary da comemoração)", async () => {
      const erro = vi.spyOn(console, "error").mockImplementation(() => {});
      await act(async () =>
        raiz.render(
          createElement(
            ErrorBoundary,
            { nome: "a arara da comemoração" },
            createElement(Mascote, {
              // Um tamanho que estoura ao ser lido.
              tamanho: {
                valueOf() {
                  throw new Error("mascote quebrada");
                },
              },
              ouvirAya: false,
              atencao: false,
              dormir: false,
            }),
          ),
        ),
      );
      expect(elemento.querySelector(".ui-erro-do-modulo")).not.toBeNull();
      expect(
        erro.mock.calls.some(([texto]) =>
          String(texto).includes("a arara da comemoração"),
        ),
      ).toBe(true);
      erro.mockRestore();
    });
  });

  describe("Configurações › Marca › Mascote (prévia para o administrador)", () => {
    it("um botão por estado; 'Ver na arara do canto' manda o estado pelo evento", async () => {
      await act(async () => raiz.render(createElement(CartaoDaMascote)));
      const opcoes = [...elemento.querySelectorAll("[role=radio]")];
      expect(opcoes.map((b) => b.textContent.trim())).toEqual([
        "Parada",
        "Atenta",
        "Falando",
        "Pensando",
        "Comemorando",
        "Dormindo",
        "Acenando",
        "Apontando",
      ]);
      const grande = () =>
        elemento.querySelector(".cartao-da-mascote__palco > .mascote");
      expect(grande().getAttribute("data-estado")).toBe("parada");
      // Fechada (só o rosto), no painel (inteira) e no menor tamanho.
      expect(
        [
          ...elemento.querySelectorAll(".cartao-da-mascote__tamanhos .mascote"),
        ].map((a) => a.getAttribute("data-enquadramento")),
      ).toEqual(["rosto", "corpo", "corpo"]);
      await act(async () => opcoes[4].click());
      expect(grande().getAttribute("data-estado")).toBe("comemorando");
      // As araras pequenas acompanham.
      for (const pequena of elemento.querySelectorAll(
        ".cartao-da-mascote__tamanhos .mascote",
      ))
        expect(pequena.getAttribute("data-estado")).toBe("comemorando");
      const ouvinte = vi.fn();
      window.addEventListener("aya:estado", ouvinte);
      await act(async () =>
        [...elemento.querySelectorAll("button")]
          .find((b) => b.textContent === "Ver na arara do canto")
          .click(),
      );
      window.removeEventListener("aya:estado", ouvinte);
      expect(ouvinte.mock.calls[0][0].detail).toEqual({
        estado: "comemorando",
        duracaoMs: 4000,
      });
    });
  });
});

bloco("section-guide-integration", () => {
  /*
  A navegação real (src/app/navegacao.ts) avisa a Aya da página aberta: é daí
  que saem a saudação, as sugestões e o contexto das perguntas. O título vai
  para o store da navegação (o cabeçalho React lê), não para o nome da aba.
*/
  describe("título e Aya conectados à navegação real", () => {
    beforeEach(() => redefinirDadosDoMonitoramento());

    it.each([
      ["dashboard", "Saúde Indígena"],
      ["nucleo", "Editais"],
      ["recursos", "Painel de recursos"],
      ["config", ""],
    ])("avisa a Aya de %s sem renomear a aba", (view, titulo) => {
      document.body.innerHTML = "";
      const navegacao = criarNavegacao({
        janela: {},
        obterPerfil: () => ({ id: "a", ativo: true, perfil: "admin" }),
        configuracao: (chave) =>
          ({ page_title: "Saúde Indígena" })[chave] || "",
        confirmarSaida: () => true,
        aplicarAtualizacao: () => false,
      });
      navegacao.irPara(view);
      expect(document.title).toBe("Yeendé");
      expect(navegacao.obter().titulo).toBe(titulo);
      expect(obterPaginaDaAya()).toMatchObject({ view, titulo });
      navegacao.desligar();
    });
  });
});
