import { describe, expect, it } from "vitest";
import {
  areaDaUnidade,
  compararEditais,
  contarAtivosEInativos,
  editalParaSalvar,
  formularioDoEdital,
  indexarResumo,
  indicadoresDoResumo,
  mapaDeAreasDasUnidades,
  opcoesDeUnidade,
  periodoDoCronograma,
  passaNoFiltroOperacional,
  resumoDasLinhas,
  resumoDoEdital,
  rotuloDoFiltroOperacional,
  situacaoDoEdital,
  unidadesDaArea,
  unidadesDisponiveis,
} from "../src/lib/editais-do-nucleo.js";
import { UNIDADES_CORES } from "../src/lib/responsavel-do-edital.js";

const CATALOGO = [
  {
    id_unidade: "U1",
    sigla: "MAO",
    nome_oficial: "DSEI Manaus",
    tipo: "DSEI",
    uf_sede: "am",
  },
  {
    id_unidade: "U2",
    sigla: "SP",
    nome_oficial: "CASAI São Paulo",
    tipo: "CASAI",
    uf_sede: "sp",
  },
];

describe("fila do Núcleo", () => {
  it("risco alto primeiro; no mesmo risco, mais vagas ociosas primeiro", () => {
    const linhas = [
      { id: "a", risco: "Baixo", vagas_ociosas: 9 },
      { id: "b", risco: "Alto", vagas_ociosas: 1 },
      { id: "c", risco: "Médio", vagas_ociosas: 2 },
      { id: "d", risco: "Médio", vagas_ociosas: 5 },
      { id: "e", risco: "", vagas_ociosas: 50 },
    ];
    expect(linhas.sort(compararEditais).map((l) => l.id)).toEqual([
      "b",
      "d",
      "c",
      "a",
      "e",
    ]);
  });
});

describe("unidades do formulário", () => {
  it("o catálogo é completado pelas unidades que só existem nos editais", () => {
    const unidades = unidadesDisponiveis(CATALOGO, [
      { unidade: "DSEI Manaus" },
      { unidade: "CASAI Antiga", uf: "rr" },
    ]);
    expect(unidades.map((u) => u.nome_oficial)).toEqual([
      "CASAI Antiga",
      "CASAI São Paulo",
      "DSEI Manaus",
    ]);
  });

  it("o CORES tem as suas próprias unidades, sem UF", () => {
    expect(
      opcoesDeUnidade("CORES", CATALOGO, []).map((u) => u.nome_oficial),
    ).toEqual(UNIDADES_CORES);
  });

  it("acha a unidade pelo id e, na falta dele, pelo nome sem acento", () => {
    expect(formularioDoEdital({ id_unidade: "U2" }, CATALOGO, []).unidade).toBe(
      "U2",
    );
    const pelo = formularioDoEdital(
      { unidade: "casai sao paulo" },
      CATALOGO,
      [],
    );
    expect(pelo).toMatchObject({ unidade: "U2", idUnidade: "U2", uf: "SP" });
  });

  it("responsável antigo, com nome de pessoa, abre vazio", () => {
    expect(
      formularioDoEdital({ responsavel: "Maria" }, CATALOGO, []).responsavel,
    ).toBe("");
  });

  /*
    Edital do CORES com unidade que não está na lista: o select abre vazio, e
    salvar sem escolher tem de falhar na validação — e não gravar o texto do
    placeholder como unidade, como acontecia antes.
  */
  it("sem unidade escolhida, o payload vai sem unidade", () => {
    const formulario = formularioDoEdital(
      { edital: "1/2026", responsavel: "CORES", unidade: "Inexistente" },
      CATALOGO,
      [],
    );
    expect(formulario.unidade).toBe("");
    const edital = editalParaSalvar(
      formulario,
      null,
      { automatico: false, etapas: [] },
      { status: "", etapa: "" },
    );
    expect(edital.unidade).toBe("");
  });
});

describe("resumo e filtro operacional", () => {
  const resumo = [
    {
      id: "1",
      unidade: "DSEI",
      edital: "01",
      alerta_tipo: "incompleto",
      status: "Planejado",
    },
    {
      id: "2",
      unidade: "DSEI",
      edital: "01",
      alerta_tipo: "proxima_3d",
      status: "Em andamento",
    },
    {
      id: "3",
      unidade: "CASAI",
      edital: "02",
      alerta_tipo: "ok",
      status: "Concluído",
    },
  ];

  it("o id distingue dois registros com o mesmo edital e unidade", () => {
    const indice = indexarResumo(resumo);
    expect(
      resumoDoEdital(indice, { id: "2", unidade: "DSEI", edital: "01" })
        .alerta_tipo,
    ).toBe("proxima_3d");
    // Sem id no resumo, cai no nome — sem acento nem caixa.
    expect(
      resumoDoEdital(indice, { id: "9", unidade: "casai", edital: "02" }).id,
    ).toBe("3");
  });

  it("conta os indicadores", () => {
    const valores = Object.fromEntries(
      indicadoresDoResumo(resumo).map((cartao) => [cartao.key, cartao.value]),
    );
    expect(valores).toEqual({
      todos: 3,
      ativos: 2,
      inativos: 1,
      andamento: 2,
      sem_cronograma: 0,
      incompleto: 1,
      proxima: 1,
      excepcional: 0,
    });
  });

  it("sem resumo, a linha só aparece sem filtro", () => {
    expect(passaNoFiltroOperacional(null, "todos")).toBe(true);
    expect(passaNoFiltroOperacional(null, "incompleto")).toBe(false);
    expect(passaNoFiltroOperacional(null, "ativos")).toBe(false);
    expect(passaNoFiltroOperacional(resumo[1], "proxima")).toBe(true);
  });
});

/* Histórias em docs/historias-de-usuario/editais.md. */
describe("ED-1 — editais ativos e inativos (regra)", () => {
  it("ED-1.1 — os cartões Editais ativos e Editais inativos, e o Total de editais é a soma", () => {
    const resumo = [
      { id: "1", status: "Em andamento" },
      { id: "2", status: "Planejado" },
      { id: "3", status: "Concluído" },
    ];
    const cartoes = Object.fromEntries(
      indicadoresDoResumo(resumo).map((c) => [c.key, c]),
    );
    expect(cartoes.todos.label).toBe("Total de editais");
    expect(cartoes.ativos).toMatchObject({ label: "Editais ativos", value: 2 });
    expect(cartoes.inativos).toMatchObject({
      label: "Editais inativos",
      value: 1,
    });
    expect(cartoes.ativos.value + cartoes.inativos.value).toBe(
      cartoes.todos.value,
    );
  });

  it("ED-1.2 — cancelado é inativo; suspenso, paralisado e sem status são ativos (sem caixa nem acento)", () => {
    expect(situacaoDoEdital("Cancelado")).toBe("inativo");
    expect(situacaoDoEdital("concluido")).toBe("inativo");
    expect(situacaoDoEdital("CONCLUÍDO")).toBe("inativo");
    expect(situacaoDoEdital("Suspenso")).toBe("ativo");
    expect(situacaoDoEdital("Paralisado")).toBe("ativo");
    expect(situacaoDoEdital("")).toBe("ativo");
    expect(situacaoDoEdital(null)).toBe("ativo");
    expect(
      contarAtivosEInativos([
        { status: "Cancelado" },
        { status: "Suspenso" },
        {},
        null,
      ]),
    ).toEqual({ ativos: 3, inativos: 1 });
  });

  it("ED-1.3 — conta só os editais da área (o resumo recortado pelas linhas da área)", () => {
    const resumo = [
      { id: "1", unidade: "DSEI", edital: "01", status: "Em andamento" },
      { id: "2", unidade: "SEDE", edital: "02", status: "Concluído" },
      { id: "3", unidade: "SEDE", edital: "03", status: "Cancelado" },
    ];
    const daArea = resumoDasLinhas(resumo, [{ id: "2" }, { id: "3" }]);
    expect(contarAtivosEInativos(daArea)).toEqual({ ativos: 0, inativos: 2 });
  });

  it("ED-2.1 — o filtro de situação recorta pelo status e o chip diz Situação", () => {
    expect(passaNoFiltroOperacional({ status: "Concluído" }, "inativos")).toBe(
      true,
    );
    expect(passaNoFiltroOperacional({ status: "Concluído" }, "ativos")).toBe(
      false,
    );
    expect(passaNoFiltroOperacional({ status: "Suspenso" }, "ativos")).toBe(
      true,
    );
    expect(rotuloDoFiltroOperacional("inativos")).toBe("Situação");
    expect(rotuloDoFiltroOperacional("sem_cronograma")).toBe("Alerta");
  });
});

describe("unidades por área", () => {
  const TA = [
    { unidade: "SEDE", area: "sede" },
    { unidade: "Rio Doce", area: "projetos" },
  ];

  it("TA_UNIDADE_AREA manda; depois o catálogo (Saúde Indígena); depois os editais", () => {
    const mapa = mapaDeAreasDasUnidades({
      unidadesPorArea: TA,
      catalogo: CATALOGO,
      linhas: [
        // Edital movido para a SEDE não tira o DSEI da Saúde Indígena.
        { unidade: "DSEI Manaus", CO_AREA: "sede" },
        { unidade: "Unidade Antiga", CO_AREA: "projetos" },
        { unidade: "sede", CO_AREA: "saude-indigena" },
      ],
    });
    expect(areaDaUnidade("DSEI  Manaus", mapa)).toBe("saude-indigena");
    expect(areaDaUnidade("Unidade Antiga", mapa)).toBe("projetos");
    expect(areaDaUnidade("Sede", mapa)).toBe("sede");
    expect(areaDaUnidade("Desconhecida", mapa)).toBe("");
  });

  it("filtra pela área, deixa as desconhecidas e mantém a unidade do edital aberto", () => {
    const mapa = mapaDeAreasDasUnidades({ unidadesPorArea: TA });
    const opcoes = opcoesDeUnidade("CORES", CATALOGO, []);
    expect(
      unidadesDaArea(opcoes, "sede", mapa).map((u) => u.nome_oficial),
    ).toEqual(UNIDADES_CORES.filter((nome) => nome !== "Rio Doce"));
    expect(
      unidadesDaArea(opcoes, "sede", mapa, "Rio Doce").map(
        (u) => u.nome_oficial,
      ),
    ).toContain("Rio Doce");
  });

  it("unidade registrada com área entra em qualquer responsável, uma vez só", () => {
    const registradas = [
      ...TA,
      { unidade: "CCE", area: "projetos" },
      { unidade: "Projeto Novo", area: "projetos" },
    ];
    const mapa = mapaDeAreasDasUnidades({
      unidadesPorArea: registradas,
      catalogo: CATALOGO,
    });
    const nomes = (responsavel) =>
      unidadesDaArea(
        opcoesDeUnidade(responsavel, CATALOGO, [], registradas),
        "projetos",
        mapa,
      ).map((u) => u.nome_oficial);
    expect(nomes("")).toEqual(["CCE", "Projeto Novo", "Rio Doce"]);
    expect(nomes("USI")).toEqual(["CCE", "Projeto Novo", "Rio Doce"]);
    expect(nomes("CORES")).toEqual([
      ...UNIDADES_CORES.filter((nome) => nome !== "SEDE"),
      "Projeto Novo",
    ]);
  });

  it("o payload leva co_area só quando há área", () => {
    const formulario = formularioDoEdital(null, CATALOGO, []);
    const cronograma = { automatico: false, etapas: [] };
    const previa = { status: "", etapa: "" };
    expect(
      editalParaSalvar(formulario, null, cronograma, previa, "sede").co_area,
    ).toBe("sede");
    expect(
      editalParaSalvar(formulario, null, cronograma, previa),
    ).not.toHaveProperty("co_area");
  });
});

describe("datas do edital pelo cronograma", () => {
  const etapas = [
    {
      atividade: "Publicação",
      data_inicio: "2026-09-14",
      data_fim: "2026-09-15",
    },
    { atividade: "Erro", data_inicio: "0202-10-09", data_fim: "0202-10-09" },
    {
      atividade: "Resultado final",
      data_inicio: "2026-11-12",
      data_fim: "2026-11-12",
    },
  ];
  it("primeira data e última, ignorando etapa com ano impossível", () => {
    expect(periodoDoCronograma(etapas)).toEqual({
      inicio: "2026-09-14",
      fim: "2026-11-12",
    });
    expect(periodoDoCronograma([])).toBeNull();
  });
  it("com o automático, as datas digitadas não valem; sem ele, valem", () => {
    const formulario = {
      edital: "107/2026",
      dataInicio: "0202-11-12",
      dataFim: "20206-09-14",
    };
    const previa = { status: "Em andamento", etapa: "x" };
    const auto = editalParaSalvar(
      formulario,
      null,
      { automatico: true, etapas },
      previa,
    );
    expect([auto.data_inicio, auto.data_fim]).toEqual([
      "2026-09-14",
      "2026-11-12",
    ]);
    const manual = editalParaSalvar(
      formulario,
      null,
      { automatico: false, etapas },
      previa,
    );
    expect(manual.data_inicio).toBe("0202-11-12");
  });
});
