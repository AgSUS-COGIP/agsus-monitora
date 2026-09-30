import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chaveDoMarco,
  comemoracaoDasAnalises,
  comemoracaoDasEntrevistas,
  comemoracoesLigadasNaResposta,
  editaisConcluidos,
  estadoGuardadoDasVagas,
  estadoGuardadoDosEditais,
  filaZerou,
  marcoAlcancado,
  marcoNovo,
  mensagemDaFilaZerada,
  mensagemDoMarcoDoAno,
  pendentesDaFila,
  proximoEstadoDoMarco,
  situacaoDasVagas,
  situacaoDosEditais,
  trocarEstadoGuardado,
} from "../src/lib/comemoracao.js";
import { decididoNoPrazo } from "../src/lib/prazo-do-recurso.js";
import { enriquecerRecurso } from "../src/lib/recursos-dos-candidatos.js";
import { normalizarSituacaoDoSistema } from "../src/lib/situacao-dos-modulos.js";
import {
  avaliarMarco,
  comemoracoesLigadasNoPainel,
  esquecerComemoracoesDoPainel,
} from "../src/modules/comemoracao.js";

/*
  Marcos e comemorações: só transições vistas por esta pessoa (linha de base
  silenciosa na primeira vez), do processo e da equipe, uma vez cada, com o
  liga/desliga global.
*/

function armazenamentoFalso() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    dados,
  };
}

const linha = (edital, unidade, status) => ({
  edital,
  unidade,
  status_consolidado: status,
});

describe("liga/desliga das comemorações", () => {
  it("lê sistema.comemoracoes; sem resposta, desligado; sem o campo, ligado", () => {
    expect(
      comemoracoesLigadasNaResposta({ sistema: { comemoracoes: true } }),
    ).toBe(true);
    expect(
      comemoracoesLigadasNaResposta({ sistema: { comemoracoes: false } }),
    ).toBe(false);
    expect(comemoracoesLigadasNaResposta({ sistema: {} })).toBe(true);
    expect(comemoracoesLigadasNaResposta(null)).toBe(false);
    expect(comemoracoesLigadasNaResposta({ areas: [] })).toBe(false);
  });

  it("a situação do sistema carrega o flag; sem resposta, desligado", () => {
    expect(
      normalizarSituacaoDoSistema({
        sistema: { situacao: "ATIVA", comemoracoes: false },
        areas: [],
      }).comemoracoes,
    ).toBe(false);
    expect(
      normalizarSituacaoDoSistema({
        sistema: { situacao: "ATIVA", comemoracoes: true },
        areas: [],
      }).comemoracoes,
    ).toBe(true);
    expect(normalizarSituacaoDoSistema(null).comemoracoes).toBe(false);
  });
});

describe("linha de base", () => {
  it("a primeira leitura só grava; a seguinte devolve a anterior", () => {
    const armazenamento = armazenamentoFalso();
    const chave = chaveDoMarco("fila", "u1", "sede");
    expect(chave).toBe("agsus_monitora_marco:fila:u1:sede");
    expect(trocarEstadoGuardado({ armazenamento, chave, atual: 3 })).toBeNull();
    expect(trocarEstadoGuardado({ armazenamento, chave, atual: 0 })).toBe(3);
  });

  it("sem armazenamento (bloqueado), nada a comemorar", () => {
    const quebrado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
      setItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(
      trocarEstadoGuardado({ armazenamento: quebrado, chave: "x", atual: 1 }),
    ).toBeNull();
  });
});

describe("edital concluído e fila zerada", () => {
  const antes = [
    linha("01/2026", "DSEI Xingu", "Aprovado"),
    linha("01/2026", "DSEI Xingu", "Pendente"),
    linha("02/2026", "DSEI Yanomami", "Pendente"),
    linha("03/2026", "DSEI Leste", "Aprovado"),
  ];
  const depois = [
    linha("01/2026", "DSEI Xingu", "Aprovado"),
    linha("01/2026", "DSEI Xingu", "Reprovado"),
    linha("02/2026", "DSEI Yanomami", "Pendente"),
    linha("03/2026", "DSEI Leste", "Aprovado"),
  ];

  it("comemora o edital que tinha pendência e zerou; não o que já estava completo", () => {
    const anterior = estadoGuardadoDosEditais(situacaoDosEditais(antes));
    const concluidos = editaisConcluidos(anterior, situacaoDosEditais(depois));
    expect(concluidos.map((e) => e.edital)).toEqual(["01/2026"]);
  });

  it("sem linha de base, nada; edital novo já completo, nada", () => {
    expect(editaisConcluidos(null, situacaoDosEditais(depois))).toEqual([]);
    expect(
      editaisConcluidos(
        {},
        situacaoDosEditais([linha("9/2026", "X", "Aprovado")]),
      ),
    ).toEqual([]);
  });

  it("status vazio conta como pendente; Revisar não", () => {
    expect(
      pendentesDaFila([
        linha("1", "A", ""),
        linha("1", "A", "Revisar"),
        linha("1", "A", "Pendente"),
      ]),
    ).toBe(2);
  });

  it("fila: de >0 para 0", () => {
    expect(filaZerou(4, 0)).toBe(true);
    expect(filaZerou(0, 0)).toBe(false);
    expect(filaZerou(null, 0)).toBe(false);
    expect(filaZerou(4, 1)).toBe(false);
  });

  it("um aviso só: o primeiro edital na frase, o resto na lista", () => {
    const situacao = situacaoDosEditais(depois.slice(0, 2));
    const comemoracao = comemoracaoDasAnalises({
      anteriorEditais: { "01/2026|DSEI Xingu": 1 },
      anteriorFila: 1,
      situacao,
      pendentes: 0,
      nomeDaArea: "SEDE",
    });
    expect(comemoracao.texto).toBe(
      "Edital 01/2026 · DSEI Xingu concluído! 🎉 Todas as análises foram feitas.",
    );
    expect(comemoracao.itens).toEqual([
      "Fila de análises zerada na SEDE! Parabéns, equipe. 🎉",
    ]);
    expect(mensagemDaFilaZerada("")).toBe(
      "Fila de análises zerada! Parabéns, equipe. 🎉",
    );
  });
});

describe("vaga pronta", () => {
  const dados = (parecer, semEntrevista = []) => ({
    entrevistas: [
      { edital: "E1", vaga: "V10", cargo: "Enfermeiro", parecer: "APTO" },
      { edital: "E1", vaga: "V10", cargo: "Enfermeiro", parecer },
    ],
    aprovadosSemEntrevista: semEntrevista,
  });

  it("pronta com todos entrevistados e com parecer", () => {
    expect(situacaoDasVagas(dados("INAPTO"))["E1|V10"].pronta).toBe(true);
    expect(situacaoDasVagas(dados("SEM_PARECER"))["E1|V10"].pronta).toBe(false);
    expect(
      situacaoDasVagas(dados("APTO", [{ edital: "E1", vaga: "V10" }]))["E1|V10"]
        .pronta,
    ).toBe(false);
  });

  it("comemora só a transição de incompleta para pronta", () => {
    const anterior = estadoGuardadoDasVagas(
      situacaoDasVagas(dados("SEM_PARECER")),
    );
    const comemoracao = comemoracaoDasEntrevistas({
      anterior,
      situacao: situacaoDasVagas(dados("APTO")),
    });
    expect(comemoracao.texto).toBe(
      "Vaga V10 · Enfermeiro pronta para o resultado final.",
    );
    expect(
      comemoracaoDasEntrevistas({
        anterior: { "E1|V10": true },
        situacao: situacaoDasVagas(dados("APTO")),
      }),
    ).toBeNull();
  });
});

describe("marcos do ano", () => {
  it("1.000, 2.500, 5.000, 7.500, 10.000 e a cada 5.000", () => {
    expect(marcoAlcancado(999)).toBe(0);
    expect(marcoAlcancado(1000)).toBe(1000);
    expect(marcoAlcancado(2600)).toBe(2500);
    expect(marcoAlcancado(7600)).toBe(7500);
    expect(marcoAlcancado(14999)).toBe(10000);
    expect(marcoAlcancado(15000)).toBe(15000);
    expect(marcoAlcancado(26000)).toBe(25000);
  });

  it("primeira vez anuncia o marco do ano; depois só contra o guardado; ano novo recomeça", () => {
    expect(marcoNovo(null, { ano: 2026, quantidade: 8000 })).toBe(7500);
    expect(marcoNovo(null, { ano: 2026, quantidade: 400 })).toBe(0);
    expect(
      marcoNovo({ ano: 2026, marco: 5000 }, { ano: 2026, quantidade: 7600 }),
    ).toBe(7500);
    expect(
      marcoNovo({ ano: 2026, marco: 7500 }, { ano: 2026, quantidade: 7900 }),
    ).toBe(0);
    expect(
      marcoNovo({ ano: 2025, marco: 10000 }, { ano: 2026, quantidade: 1200 }),
    ).toBe(1000);
  });

  it("o guardado não desce no mesmo ano", () => {
    expect(
      proximoEstadoDoMarco(
        { ano: 2026, marco: 7500 },
        { ano: 2026, quantidade: 7400 },
      ),
    ).toEqual({ estado: { ano: 2026, marco: 7500 }, novo: 0 });
  });

  it("a frase", () => {
    expect(
      mensagemDoMarcoDoAno({
        nomeDaArea: "Saúde Indígena",
        marco: 7500,
        ano: 2026,
      }),
    ).toBe(
      "🎉 A equipe da Saúde Indígena passou de 7.500 análises concluídas em 2026!",
    );
  });
});

describe("recurso decidido no prazo", () => {
  it("no dia do prazo ou antes: no prazo; depois: fora; sem prazo: nada", () => {
    expect(decididoNoPrazo("2026-09-10", "2026-09-10")).toBe(true);
    expect(decididoNoPrazo("2026-09-11", "2026-09-10")).toBe(false);
    expect(decididoNoPrazo("2026-09-11", null)).toBeNull();
    expect(decididoNoPrazo("", "2026-09-10")).toBeNull();
  });

  it("enriquecerRecurso: noPrazo só no decidido", () => {
    const cronogramas = new Map([
      [
        "7",
        [
          {
            atividade: "Resposta aos recursos da análise curricular",
            inicio: "2026-09-01",
            fim: "2026-09-10",
          },
        ],
      ],
    ]);
    const base = {
      edital_id: 7,
      origem: "analise-curricular",
      criado_em: "2026-09-02T12:00:00",
    };
    const hoje = "2026-09-30";
    expect(
      enriquecerRecurso(
        { ...base, situacao: "DEFERIDO", decisao_em: "2026-09-09T12:00:00" },
        { cronogramas, hoje },
      ).noPrazo,
    ).toBe(true);
    expect(
      enriquecerRecurso(
        { ...base, situacao: "DEFERIDO", decisao_em: "2026-09-12T12:00:00" },
        { cronogramas, hoje },
      ).noPrazo,
    ).toBe(false);
    expect(
      enriquecerRecurso(
        { ...base, situacao: "EM_ANALISE" },
        { cronogramas, hoje },
      ).noPrazo,
    ).toBeNull();
  });
});

describe("avaliar um marco na tela", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    esquecerComemoracoesDoPainel();
  });

  const janelaSemMovimento = {
    matchMedia: () => ({ matches: true }),
    requestAnimationFrame: vi.fn(),
  };

  it("primeira vez em silêncio; na transição, o aviso (sem confete com menos movimento), uma vez", () => {
    const armazenamento = armazenamentoFalso();
    const decidir = (anterior) =>
      anterior > 0 ? { texto: "Fila zerada!", itens: [] } : null;
    const avaliar = (atual) =>
      avaliarMarco({
        armazenamento,
        chave: "k",
        atual,
        ligadas: true,
        decidir,
        janela: janelaSemMovimento,
      });
    expect(avaliar(2)).toBeNull();
    expect(document.querySelector(".comemoracao")).toBeNull();
    expect(avaliar(0)).toEqual({ texto: "Fila zerada!", itens: [] });
    expect(document.querySelector(".comemoracao").textContent).toContain(
      "Fila zerada!",
    );
    expect(document.querySelector(".comemoracao__confete")).toBeNull();
    expect(janelaSemMovimento.requestAnimationFrame).not.toHaveBeenCalled();
    // Recarregou: o estado já é 0, nada de novo.
    document.body.innerHTML = "";
    expect(avaliar(0)).toBeNull();
  });

  it("desligadas: guarda o estado, não mostra nada", () => {
    const armazenamento = armazenamentoFalso();
    const decidir = () => ({ texto: "x", itens: [] });
    avaliarMarco({
      armazenamento,
      chave: "k",
      atual: 2,
      ligadas: false,
      decidir,
    });
    expect(
      avaliarMarco({
        armazenamento,
        chave: "k",
        atual: 0,
        ligadas: false,
        decidir,
      }),
    ).toBeNull();
    expect(armazenamento.getItem("k")).toBe("0");
    expect(document.querySelector(".comemoracao")).toBeNull();
  });

  it("o × fecha o aviso", () => {
    const armazenamento = armazenamentoFalso();
    armazenamento.setItem("k", "1");
    avaliarMarco({
      armazenamento,
      chave: "k",
      atual: 0,
      ligadas: true,
      decidir: () => ({ texto: "Pronto", itens: [] }),
      janela: janelaSemMovimento,
    });
    document.querySelector(".comemoracao__fechar").click();
    expect(document.querySelector(".comemoracao")).toBeNull();
  });

  it("painel: lê o flag uma vez; falha vira desligado", async () => {
    const rpc = vi.fn(async () => ({
      data: { sistema: { comemoracoes: true } },
      error: null,
    }));
    expect(await comemoracoesLigadasNoPainel({ rpc })).toBe(true);
    expect(await comemoracoesLigadasNoPainel({ rpc })).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("obter_situacao_do_sistema");

    esquecerComemoracoesDoPainel();
    const falha = vi.fn(async () => {
      throw new Error("rede");
    });
    expect(await comemoracoesLigadasNoPainel({ rpc: falha })).toBe(false);
    esquecerComemoracoesDoPainel();
    expect(
      await comemoracoesLigadasNoPainel({
        rpc: async () => ({ data: null, error: { code: "42501" } }),
      }),
    ).toBe(false);
  });
});
