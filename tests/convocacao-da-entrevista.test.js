import { describe, expect, it } from "vitest";
import {
  aConvocar,
  avisosDaConvocacao,
  fonteDaConvocacao,
  gruposDaConvocacao,
  origemDasVagas,
  resumoDaConvocacao,
  textoDaRegraDaClassificacao,
  textoDasVagas,
  textoDoLimite,
  vagasDaLista,
} from "../src/lib/convocacao-da-entrevista.js";
import { instantaneoDaLista } from "../src/lib/classificacao/exportacao.js";

/*
  A convocação para a entrevista é a lista CONVOCACAO da Classificação: o
  retrato registrado (instantaneoDaLista) ou, sem lista, o resultado do motor.
  Nada de ranking, regra ou vagas próprios.
*/

const RETRATO = {
  schema: 1,
  tipo: "CONVOCACAO",
  vagas: [
    {
      chave: "V1",
      codigo: "V1",
      cargo: "Enfermeiro - DSEI Manaus",
      lotacao: "Polo Base Manaus",
      cabecalho: "VAGA V1 - Enfermeiro",
      total: 2,
      cadastro_reserva: true,
      origem_das_vagas: "QUADRO",
      limite_convocacao: { limite: 10, origem: "5 × 2 vaga(s)" },
      geral: [
        {
          posicao: 1,
          analise_id: "a1",
          nome: "Ana",
          nota: 90,
          modalidades: ["AC"],
        },
        {
          posicao: 2,
          analise_id: "a2",
          nome: "Bia",
          nota: 80,
          modalidades: ["AC", "PPIQ"],
        },
      ],
      listas: {
        PPIQ: [
          {
            posicao: 1,
            analise_id: "a2",
            nome: "Bia",
            nota: 80,
            modalidades: ["PPIQ"],
          },
          {
            posicao: 2,
            analise_id: "a3",
            nome: "Caio",
            nota: 70,
            modalidades: ["PPIQ"],
          },
        ],
      },
      eliminados: [{ analise_id: "a9", nome: "Zé", motivo: "FORA_DO_LIMITE" }],
    },
    {
      chave: "V2",
      codigo: "V2",
      cargo: "Médico",
      // Sem linha no quadro de vagas do edital.
      total: null,
      origem_das_vagas: null,
      geral: [],
      listas: {},
      eliminados: [],
    },
  ],
};

const DADOS = {
  regra_classificacao: {
    versao: 3,
    convocacao: { multiplo_vagas: 5, posicao_max_cr: 10, excecoes: [] },
  },
  lista_convocacao: {
    lista: { id: "l1", versao_regra: 3, gerada_em: "2026-10-05T12:00:00Z" },
    retrato: RETRATO,
  },
  convocados: [
    {
      id: "e1",
      analise_id: "a1",
      vaga: "V1",
      candidato: "Ana",
      avaliacoes: [],
    },
    {
      id: "e8",
      analise_id: "a8",
      vaga: "V1",
      candidato: "Antigo",
      avaliacoes: [],
    },
    {
      id: "e7",
      analise_id: "a7",
      vaga: "V9",
      cargo: "Outro",
      candidato: "Sem vaga",
    },
  ],
};

describe("a fonte da convocação", () => {
  it("a lista registrada na Classificação vale; sem ela, o cálculo atual; sem nada, nenhuma", () => {
    expect(fonteDaConvocacao(DADOS).tipo).toBe("LISTA");
    expect(fonteDaConvocacao(DADOS).lista.id).toBe("l1");
    const calculada = { tipo: "CONVOCACAO", vagas: [] };
    expect(
      fonteDaConvocacao({ ...DADOS, lista_convocacao: null }, calculada),
    ).toMatchObject({ tipo: "CALCULO", resultado: calculada });
    expect(fonteDaConvocacao({ lista_convocacao: null }).tipo).toBe("NENHUMA");
  });
});

describe("as vagas da lista", () => {
  it("geral e depois quem só está na lista da modalidade, sem repetir; eliminados fora", () => {
    const [v1, v2] = vagasDaLista(RETRATO);
    expect(v1.candidatos.map((c) => [c.analiseId, c.lista])).toEqual([
      ["a1", ""],
      ["a2", ""],
      ["a3", "PPIQ"],
    ]);
    expect(v1).toMatchObject({
      vaga: "V1",
      total: 2,
      cadastroReserva: true,
      origemDasVagas: "QUADRO",
      limite: 10,
      origemDoLimite: "5 × 2 vaga(s)",
    });
    expect(v2.candidatos).toEqual([]);
    expect(v2.total).toBeNull();
  });

  it("o resultado do motor (camelCase) entra igual ao retrato", () => {
    const motor = {
      vagas: [
        {
          chave: "V1",
          codigo: "V1",
          cargo: "Enfermeiro",
          total: 1,
          cadastroReserva: false,
          origemDasVagas: "CONVOCACAO",
          limiteConvocacao: { limite: 5, origem: "5 × 1 vaga(s)" },
          geral: [{ posicao: 1, analiseId: "a1", nome: "Ana" }],
          porModalidade: {
            PCD: [{ posicao: 1, analiseId: "a4", nome: "Duda" }],
          },
        },
      ],
    };
    const [v] = vagasDaLista(motor);
    expect(v.candidatos.map((c) => c.analiseId)).toEqual(["a1", "a4"]);
    expect(v.limite).toBe(5);
    expect(v.origemDasVagas).toBe("CONVOCACAO");
  });

  it("o retrato novo guarda as vagas e o limite que a Classificação contou", () => {
    const retrato = instantaneoDaLista(
      {
        tipo: "CONVOCACAO",
        casas: 2,
        dataCorte: null,
        vagas: [
          {
            chave: "V1",
            codigo: "V1",
            cargo: "Enfermeiro",
            lotacao: "",
            cabecalho: "VAGA V1",
            total: 2,
            cadastroReserva: false,
            origemDasVagas: "QUADRO",
            limiteConvocacao: { limite: 10, origem: "5 × 2 vaga(s)" },
            geral: [{ posicao: 1, analiseId: "a1", nome: "Ana", nota: 9 }],
            porModalidade: {},
            eliminados: [],
          },
        ],
        avisos: [],
        pendencias: [],
        totais: {},
      },
      { regra: {} },
    );
    expect(retrato.vagas[0]).toMatchObject({
      total: 2,
      cadastro_reserva: false,
      origem_das_vagas: "QUADRO",
      limite_convocacao: { limite: 10, origem: "5 × 2 vaga(s)" },
    });
    expect(vagasDaLista(retrato)[0].limite).toBe(10);
  });
});

describe("quem vai para a ficha", () => {
  const grupos = gruposDaConvocacao(RETRATO, DADOS.convocados);

  it("marca os já convocados; quem não está na lista fica em `fora` (na própria vaga ou numa nova)", () => {
    expect(grupos[0].candidatos.map((c) => c.convocado?.id ?? null)).toEqual([
      "e1",
      null,
      null,
    ]);
    expect(grupos[0].fora.map((c) => c.id)).toEqual(["e8"]);
    expect(grupos.at(-1)).toMatchObject({ vaga: "V9", candidatos: [] });
    expect(grupos.at(-1).fora.map((c) => c.id)).toEqual(["e7"]);
  });

  it("a convocar = os da lista ainda fora da ficha; o resumo conta", () => {
    expect(aConvocar(grupos)).toEqual(["a2", "a3"]);
    expect(resumoDaConvocacao(grupos)).toEqual({
      naLista: 3,
      naFicha: 1,
      aConvocar: 2,
      fora: 2,
    });
  });
});

describe("textos e avisos", () => {
  it("vagas, limite e origem", () => {
    const [v1, v2] = vagasDaLista(RETRATO);
    expect(textoDasVagas(v1)).toBe("2 vagas imediatas + cadastro reserva");
    expect(textoDasVagas({ total: 0 })).toBe("cadastro reserva");
    expect(textoDasVagas(v2)).toBe("sem quadro de vagas");
    expect(textoDoLimite(v1)).toBe("até a 10ª (5 × 2 vaga(s))");
    expect(textoDoLimite(v2)).toBe("");
    expect(origemDasVagas(v1)).toMatchObject({
      view: "nucleo",
      onde: "Editais",
    });
    expect(origemDasVagas({ origemDasVagas: "CONVOCACAO" }).view).toBe(
      "aprovados",
    );
    expect(origemDasVagas({ origemDasVagas: "REGRA" }).view).toBe(
      "classificacao",
    );
  });

  it("lista gerada antes de o retrato guardar as vagas: não diz que falta quadro", () => {
    const [antiga] = vagasDaLista({
      vagas: [{ codigo: "V1", cargo: "Enfermeiro", geral: [], listas: {} }],
    });
    expect(antiga.semVagasNaLista).toBe(true);
    expect(textoDasVagas(antiga)).toBe("");
    expect(origemDasVagas(antiga)).toMatchObject({
      rotulo: "não registrado nesta lista",
      view: "classificacao",
    });
    expect(vagasDaLista(RETRATO)[1].semVagasNaLista).toBe(false);
  });

  it("a regra da Classificação em uma linha, com as exceções", () => {
    expect(
      textoDaRegraDaClassificacao({
        multiplo_vagas: 5,
        posicao_max_cr: 10,
        incluir_empatados: true,
        excecoes: [
          {
            termos: ["Enfermeiro", "Técnico de Enfermagem"],
            multiplo_vagas: 10,
            posicao_max_cr: 20,
          },
        ],
      }),
    ).toBe(
      "5× as vagas imediatas · até a 10ª no cadastro reserva · empatados no limite entram · exceções: Enfermeiro, Técnico de Enfermagem (10× / 20ª)",
    );
    expect(textoDaRegraDaClassificacao({})).toBe("sem limite na regra");
    expect(textoDaRegraDaClassificacao(null)).toBe("");
  });

  it("avisa sem lista, regra mudada depois da lista e convocado fora da lista", () => {
    const semLista = avisosDaConvocacao(
      DADOS,
      { tipo: "CALCULO", lista: null },
      [],
    );
    expect(semLista.map((a) => a.codigo)).toEqual(["SEM_LISTA"]);
    expect(semLista[0].texto).toContain(
      "Lista ainda não gerada na Classificação",
    );
    const grupos = gruposDaConvocacao(RETRATO, DADOS.convocados);
    const mudou = avisosDaConvocacao(
      { ...DADOS, regra_classificacao: { versao: 4 } },
      fonteDaConvocacao(DADOS),
      grupos,
    );
    expect(mudou.map((a) => a.codigo)).toEqual([
      "REGRA_MUDOU",
      "FORA_DA_LISTA",
    ]);
    expect(mudou[0].texto).toContain("v3 → v4");
    expect(mudou[1].texto).toBe("2 convocados não estão na lista vigente.");
    expect(avisosDaConvocacao(DADOS, fonteDaConvocacao(DADOS), [])).toEqual([]);
  });
});
