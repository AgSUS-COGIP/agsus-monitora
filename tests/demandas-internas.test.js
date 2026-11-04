import { describe, expect, it } from "vitest";
import {
  TIPO_DEMANDA_INTERNA,
  comDemanda,
  demandaAtrasada,
  demandaComoEtapa,
  demandaDoEditalId,
  demandasDaArea,
  formularioDaDemanda,
  juntarPorInicio,
  lerDemanda,
  lerDemandasInternas,
  payloadDaDemanda,
  periodoDaDemanda,
  problemaDoFormulario,
  situacaoDaDemanda,
} from "../src/lib/demandas-internas.ts";
import {
  TIPOS_DA_LEGENDA,
  filtrarEtapas,
  tiposOcultosValidos,
} from "../src/lib/calendario-editais.ts";

const BRUTA = {
  id: "d1",
  area: "sede",
  edital_id: null,
  titulo: "Relatório",
  data_inicio: "2026-09-08",
  data_fim: "2026-09-10",
  concluida: false,
  responsaveis: [{ id: "p1", nome: "Ana" }, { nome: "sem id" }],
  pode_editar: true,
};

describe("leitura da RPC", () => {
  it("lê a demanda e descarta o que não serve", () => {
    const demanda = lerDemanda(BRUTA);
    expect(demanda).toMatchObject({
      id: "d1",
      area: "sede",
      editalId: "",
      dataFim: "2026-09-10",
      podeEditar: true,
      responsaveis: [{ id: "p1", nome: "Ana" }],
    });
    expect(lerDemanda({ ...BRUTA, titulo: "" })).toBeNull();
    expect(lerDemanda({ ...BRUTA, data_inicio: "ontem" })).toBeNull();
    // Fim antes do início ou inválido: vale o início (data única).
    expect(lerDemanda({ ...BRUTA, data_fim: "2026-09-01" })?.dataFim).toBe(
      "2026-09-08",
    );
    expect(lerDemanda(null)).toBeNull();
  });

  it("lista ordenada por início e as áreas onde pode criar", () => {
    const lista = lerDemandasInternas({
      pode_criar_em: ["sede", 3, null],
      demandas: [
        { ...BRUTA, id: "b", titulo: "B", data_inicio: "2026-09-09" },
        BRUTA,
        "lixo",
      ],
    });
    expect(lista.demandas.map((item) => item.id)).toEqual(["d1", "b"]);
    expect(lista.podeCriarEm).toEqual(["sede", "3"]);
    expect(lerDemandasInternas(null)).toEqual({
      demandas: [],
      podeCriarEm: [],
    });
  });

  it("comDemanda troca a que já existe e mantém a ordem", () => {
    const [a] = lerDemandasInternas({ demandas: [BRUTA] }).demandas;
    const trocada = { ...a, titulo: "Novo", dataInicio: "2026-01-01" };
    expect(comDemanda([a], trocada)).toEqual([trocada]);
  });
});

describe("atrasada, situação e período", () => {
  const demanda = lerDemanda(BRUTA);
  it("atrasada é a em aberto com fim antes de hoje", () => {
    expect(demandaAtrasada(demanda, "2026-09-10")).toBe(false);
    expect(demandaAtrasada(demanda, "2026-09-11")).toBe(true);
    expect(demandaAtrasada({ ...demanda, concluida: true }, "2026-09-11")).toBe(
      false,
    );
    expect(situacaoDaDemanda(demanda, "2026-09-11")).toBe("Atrasada");
    expect(situacaoDaDemanda(demanda, "2026-09-09")).toBe("Em aberto");
    expect(
      situacaoDaDemanda({ ...demanda, concluida: true }, "2026-09-11"),
    ).toBe("Concluída");
  });

  it("período em texto", () => {
    expect(periodoDaDemanda(demanda)).toBe("08/09/2026 a 10/09/2026");
    expect(periodoDaDemanda({ ...demanda, dataFim: "2026-09-08" })).toBe(
      "08/09/2026",
    );
  });

  it("recorte pela área", () => {
    expect(demandasDaArea([demanda], "sede")).toHaveLength(1);
    expect(demandasDaArea([demanda], "projetos")).toHaveLength(0);
  });
});

describe("a demanda no calendário", () => {
  const demanda = lerDemanda(BRUTA);

  it("é uma etapa do tipo Demanda interna, que entra na legenda e no filtro", () => {
    const etapa = demandaComoEtapa(demanda, "2026-09-15");
    expect(etapa).toMatchObject({
      editalId: "demanda:d1",
      unidade: "Demanda interna",
      atividade: "Relatório · atrasada",
      tipo: TIPO_DEMANDA_INTERNA,
      demandaId: "d1",
    });
    expect(etapa.busca).toContain("ana");
    expect(demandaDoEditalId(etapa.editalId)).toBe("d1");
    expect(demandaDoEditalId("123")).toBe("");
    expect(TIPOS_DA_LEGENDA).toContain(TIPO_DEMANDA_INTERNA);
    expect(tiposOcultosValidos('["demanda-interna"]')).toEqual([
      "demanda-interna",
    ]);
  });

  it("com edital, fica no edital; concluída leva o sufixo", () => {
    const etapa = demandaComoEtapa(
      {
        ...demanda,
        editalId: "7",
        edital: "10/2026",
        unidade: "DSEI X",
        concluida: true,
      },
      "2026-09-15",
    );
    expect(etapa.editalId).toBe("7");
    expect(etapa.unidade).toBe("DSEI X");
    expect(etapa.atividade).toBe("Relatório · concluída");
  });

  it("'Ocultar concluídas' esconde só a demanda marcada como concluída", () => {
    const hoje = new Date(2026, 8, 15);
    const atrasada = demandaComoEtapa(demanda, "2026-09-15");
    const concluida = demandaComoEtapa(
      { ...demanda, id: "d2", concluida: true },
      "2026-09-15",
    );
    expect(
      filtrarEtapas(
        [atrasada, concluida],
        {},
        { ocultarConcluidas: true, hoje },
      ),
    ).toEqual([atrasada]);
    expect(
      filtrarEtapas(
        [atrasada],
        {},
        { tiposOcultos: ["demanda-interna"], hoje },
      ),
    ).toEqual([]);
  });

  it("junta etapas e demandas pela data de início", () => {
    const a = demandaComoEtapa(demanda, "2026-09-15");
    const b = { ...a, data_inicio: "2026-09-01" };
    expect(juntarPorInicio([a], [b])).toEqual([b, a]);
    expect(juntarPorInicio([a], [])).toEqual([a]);
  });
});

describe("formulário", () => {
  it("valida e monta o p_demanda", () => {
    const vazio = formularioDaDemanda(null, "sede");
    expect(problemaDoFormulario(vazio)).toBe(
      "O título precisa ter ao menos 3 caracteres.",
    );
    const comTitulo = { ...vazio, titulo: "  Fazer   algo " };
    expect(problemaDoFormulario(comTitulo)).toBe("Informe a data.");
    const comData = { ...comTitulo, dataInicio: "2026-09-10" };
    expect(problemaDoFormulario(comData)).toBe("");
    expect(
      problemaDoFormulario({
        ...comData,
        periodo: true,
        dataFim: "2026-09-01",
      }),
    ).toBe("O fim não pode ser antes do início.");
    expect(
      payloadDaDemanda({ ...comData, responsaveis: ["p1", "p1"] }),
    ).toEqual({
      area: "sede",
      edital_id: null,
      titulo: "Fazer algo",
      descricao: null,
      data_inicio: "2026-09-10",
      data_fim: "2026-09-10",
      responsaveis: ["p1"],
    });
  });

  it("editar parte da demanda, com período e responsáveis", () => {
    const formulario = formularioDaDemanda(lerDemanda(BRUTA), "outra");
    expect(formulario).toMatchObject({
      id: "d1",
      area: "sede",
      periodo: true,
      dataFim: "2026-09-10",
      responsaveis: ["p1"],
    });
    expect(payloadDaDemanda(formulario)).toMatchObject({
      id: "d1",
      data_fim: "2026-09-10",
    });
  });
});
