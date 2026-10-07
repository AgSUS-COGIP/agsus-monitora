import { describe, expect, it } from "vitest";
import {
  acoesDaSelecao,
  agruparPorVaga,
  andamentoDaFila,
  colunasDaEtapa,
  contadoresDaFila,
  csvDaFila,
  fichaPeloCodigo,
  filtrarFila,
  filtroEhInicial,
  FILTRO_INICIAL,
  naEtapa,
  nomeDoCsvDaFila,
  normalizarFiltro,
  ordenarFila,
  planoDeDistribuicao,
  proximaOrdem,
  reservaVigente,
  resumoDaVagaNaFila,
  textoDaColuna,
  textoDoAndamento,
  textoDaReserva,
  textoDaSituacaoNaFila,
} from "../../src/lib/avaliacao-documental/fila.js";
import {
  editaisDaEscolha,
  editalVigente,
} from "../../src/lib/avaliacao-documental/editais.js";

const AGORA = new Date("2026-10-06T15:00:00Z");
const EM_10_MIN = "2026-10-06T15:10:00Z";
const HA_5_MIN = "2026-10-06T14:55:00Z";

const ficha = (id, situacao, extra = {}) => ({
  id,
  versao: 2,
  situacao,
  responsavel: null,
  reserva: null,
  ...extra,
});
const FILA = [
  {
    id: "c1",
    vaga: "10",
    codigo: "7001",
    nome: "Ana Lúcia",
    situacao_pre: "NO_LOTE",
    posicao: 1,
    modalidade: "AC",
    ficha: ficha("f1", "EM_ANALISE", {
      responsavel: "u-a",
      reserva: {
        usuario: "u-a",
        nome: "Ana",
        desde: HA_5_MIN,
        expira: EM_10_MIN,
      },
    }),
  },
  {
    id: "c2",
    vaga: "10",
    codigo: "7002",
    nome: "Bruno",
    situacao_pre: "NO_LOTE",
    posicao: 2,
    modalidade: "PP",
    ficha: ficha("f2", "PENDENTE", { responsavel: "u-b" }),
  },
  {
    id: "c3",
    vaga: "20",
    codigo: "7003",
    nome: "Carla",
    situacao_pre: "NO_LOTE",
    posicao: 1,
    modalidade: "AC",
    ficha: ficha("f3", "PENDENTE"),
  },
  {
    id: "c4",
    vaga: "20",
    codigo: "7004",
    nome: "Davi",
    situacao_pre: "ANALISADO",
    posicao: 2,
    modalidade: "AC",
    ficha: ficha("f4", "CONCLUIDA", { responsavel: "u-a" }),
  },
  {
    id: "c5",
    vaga: "10",
    codigo: "7005",
    nome: "Eva",
    situacao_pre: "ELIMINADO",
    posicao: null,
    modalidade: "AC",
    ficha: ficha("f5", "FORA_LOTE", { responsavel: "u-b" }),
  },
  {
    id: "c6",
    vaga: "10",
    codigo: "7006",
    nome: "Fábio",
    situacao_pre: "RANQUEADO",
    posicao: 3,
    modalidade: "AC",
    ficha: null,
  },
  {
    id: "c7",
    vaga: "20",
    codigo: "7007",
    nome: "Gil",
    situacao_pre: "NO_LOTE",
    posicao: 3,
    modalidade: "AC",
    ficha: ficha("f7", "REVISAR", { responsavel: "u-b" }),
  },
];
const EQUIPE = [
  { usuario: "u-a", nome: "Ana", vagas: null, limite: null, pendentes: 1 },
  { usuario: "u-b", nome: "Beto", vagas: ["10"], limite: null, pendentes: 1 },
];

describe("etapas e contadores (abas com contadores)", () => {
  it("conta cada etapa do funil", () => {
    expect(contadoresDaFila(FILA)).toEqual({
      inscritos: 7,
      lote: 5,
      pendentes: 2,
      em_analise: 1,
      revisao: 1,
      concluidas: 1,
      eliminados: 1,
    });
    expect(contadoresDaFila(null).inscritos).toBe(0);
  });
  it("sem ficha não é pendente; fora do lote não é do lote", () => {
    expect(naEtapa(FILA[5], "pendentes")).toBe(false);
    expect(naEtapa(FILA[4], "lote")).toBe(false);
    expect(naEtapa(FILA[4], "eliminados")).toBe(true);
  });
});

describe("filtros", () => {
  it("normaliza o filtro salvo (só chaves conhecidas, etapa válida)", () => {
    expect(normalizarFiltro({ etapa: "x", vaga: " 10 ", outra: 1 })).toEqual({
      ...FILTRO_INICIAL,
      vaga: "10",
    });
    expect(normalizarFiltro(null)).toEqual(FILTRO_INICIAL);
    expect(filtroEhInicial({})).toBe(true);
    expect(filtroEhInicial({ etapa: "pendentes" })).toBe(false);
  });
  it("Minhas fichas, sem responsável, vaga, modalidade e busca sem acento", () => {
    const ids = (f, eu) => filtrarFila(FILA, f, eu).map((c) => c.id);
    expect(ids({ etapa: "inscritos", responsavel: "eu" }, "u-a")).toEqual([
      "c1",
      "c4",
    ]);
    expect(ids({ etapa: "inscritos", responsavel: "eu" }, "")).toEqual([]);
    expect(ids({ etapa: "lote", responsavel: "ninguem" })).toEqual(["c3"]);
    expect(ids({ etapa: "lote", responsavel: "u-b" })).toEqual(["c2", "c7"]);
    expect(ids({ etapa: "lote", vaga: "20" })).toEqual(["c3", "c4", "c7"]);
    expect(ids({ etapa: "inscritos", modalidade: "PP" })).toEqual(["c2"]);
    expect(ids({ etapa: "inscritos", busca: "lucia" })).toEqual(["c1"]);
    expect(ids({ etapa: "inscritos", busca: "7006" })).toEqual(["c6"]);
  });
  it("AM-6.4: o código abre direto só com uma ficha que casa", () => {
    expect(fichaPeloCodigo(FILA, " 7002 ")?.id).toBe("c2");
    expect(fichaPeloCodigo(FILA, "7006")).toBeNull();
    expect(fichaPeloCodigo(FILA, "")).toBeNull();
  });
});

describe("AM-12.2: reserva", () => {
  const reserva = FILA[0].ficha.reserva;
  it("vale até expirar", () => {
    expect(reservaVigente(reserva, AGORA)).toBe(true);
    expect(reservaVigente(reserva, new Date("2026-10-06T15:11:00Z"))).toBe(
      false,
    );
    expect(reservaVigente(null, AGORA)).toBe(false);
  });
  it("mostra quem está e desde quando", () => {
    expect(textoDaReserva(reserva, "u-b", AGORA)).toMatch(
      /^Em uso por Ana desde \d{2}:\d{2}$/,
    );
    expect(textoDaReserva(reserva, "u-a", AGORA)).toMatch(
      /^Com você até \d{2}:\d{2}$/,
    );
    expect(
      textoDaReserva(reserva, "u-a", new Date("2026-10-07T00:00:00Z")),
    ).toBe("");
  });
});

describe("ações em lote e o plano da distribuição", () => {
  it("cada ação pega só o que cabe nela", () => {
    const a = acoesDaSelecao(FILA, AGORA);
    expect(a.distribuir.map((c) => c.id)).toEqual(["c1", "c2", "c3", "c7"]);
    expect(a.liberar.map((c) => c.id)).toEqual(["c1"]);
    expect(a.revisao.map((c) => c.id)).toEqual(["c1", "c2", "c3"]);
  });
  it("AM-6.2: a prévia distribui na ordem da Provisória, tirando da carga o que é redistribuído", () => {
    const p = planoDeDistribuicao([FILA[2], FILA[1]], EQUIPE, {
      criterio: "PARTES_IGUAIS",
    });
    // c2 (vaga 10, pos 2) e c3 (vaga 20, pos 1): c3 primeiro; Beto só analisa a vaga 10.
    expect(p.atribuicoes).toEqual([
      { ficha: "f3", usuario: "u-a", versao: 2 },
      { ficha: "f2", usuario: "u-b", versao: 2 },
    ]);
    expect(p.redistribui).toBe(true);
    expect(p.resumo).toEqual([
      { usuario: "u-a", nome: "Ana", novas: 1, total: 2 },
      { usuario: "u-b", nome: "Beto", novas: 1, total: 1 },
    ]);
  });
  it("para uma pessoa ou de volta à fila", () => {
    const p = planoDeDistribuicao([FILA[2], FILA[1]], EQUIPE, {}, "u-b");
    expect(p.atribuicoes).toEqual([{ ficha: "f2", usuario: "u-b", versao: 2 }]);
    expect(p.sobra).toEqual(["f3"]);
    const f = planoDeDistribuicao([FILA[1]], EQUIPE, {}, "fila");
    expect(f.atribuicoes).toEqual([{ ficha: "f2", usuario: null, versao: 2 }]);
    expect(f.resumo).toEqual([]);
  });
});

describe("editais vigentes no seletor", () => {
  const EDITAIS = [
    { id: "a", edital: "93/2026", ativo: true, status: "Em andamento" },
    { id: "b", edital: "23/2025", ativo: true, status: "Concluído" },
    { id: "c", edital: "FCC", ativo: true, status: "Cancelado" },
    { id: "d", edital: "10/2026", ativo: false, status: "Em andamento" },
    { id: "e", edital: "11/2026", ativo: true },
  ];
  it("só os vigentes, com o escolhido mantido e o total dos ocultos", () => {
    expect(editaisDaEscolha(EDITAIS).lista.map((e) => e.id)).toEqual([
      "a",
      "e",
    ]);
    expect(editaisDaEscolha(EDITAIS).ocultos).toBe(3);
    expect(
      editaisDaEscolha(EDITAIS, { escolhido: "b" }).lista.map((e) => e.id),
    ).toEqual(["a", "b", "e"]);
    expect(editaisDaEscolha(EDITAIS, { todos: true }).lista).toHaveLength(5);
    expect(editalVigente(null)).toBe(false);
  });
});

describe("colunas de cada aba, ordem e CSV", () => {
  const eliminado = {
    id: "c9",
    vaga: "11",
    codigo: "7009",
    nome: "=Cmd|' /C calc'!A0",
    situacao_pre: "ELIMINADO",
    posicao: null,
    art: 12.5,
    motivo_eliminacao: "Cancelou a inscrição",
    ficha: null,
  };
  const concluida = {
    id: "c3",
    vaga: "10",
    codigo: "7003",
    nome: "Carla",
    situacao_pre: "NO_LOTE",
    posicao: 3,
    art: 20,
    ficha: ficha("f3", "CONCLUIDA", {
      resultado: "INAPTO_NOTA",
      nota_final: 12.25,
      responsavel_nome: "Ana",
      concluida_em: "2026-10-06T17:30:00Z",
    }),
  };

  it("Eliminados mostra código, nome, vaga, motivo e ART (sem posição, reserva nem responsável)", () => {
    expect(colunasDaEtapa("eliminados")).toEqual([
      "codigo",
      "nome",
      "vaga",
      "motivo",
      "art",
    ]);
    expect(textoDaColuna(eliminado, "motivo")).toBe("Cancelou a inscrição");
    expect(textoDaColuna(eliminado, "art")).toBe("12,5");
    expect(textoDaSituacaoNaFila(eliminado)).toBe("Eliminado");
  });

  it("Concluídas: nota, resultado, responsável e data; Pendentes: posição, ART, responsável e reserva", () => {
    expect(colunasDaEtapa("concluidas")).toEqual(
      expect.arrayContaining([
        "nota",
        "resultado",
        "responsavel",
        "concluida_em",
      ]),
    );
    expect(colunasDaEtapa("concluidas")).not.toContain("reserva");
    expect(textoDaColuna(concluida, "resultado")).toBe("Inapto (nota mínima)");
    expect(textoDaColuna(concluida, "nota")).toBe("12,25");
    expect(textoDaColuna(concluida, "concluida_em")).toBe("06/10/2026, 14:30");
    expect(colunasDaEtapa("pendentes")).toEqual(
      expect.arrayContaining(["posicao", "art", "responsavel", "reserva"]),
    );
  });

  it("ordena por coluna (números como número, vazio no fim) e volta à ordem do banco", () => {
    const lista = [concluida, eliminado, FILA[0], FILA[1]];
    expect(
      ordenarFila(lista, { chave: "posicao", sentido: "asc" }).map(
        (c) => c.codigo,
      ),
    ).toEqual(["7001", "7002", "7003", "7009"]);
    expect(
      ordenarFila(lista, { chave: "posicao", sentido: "desc" }).map(
        (c) => c.codigo,
      ),
    ).toEqual(["7003", "7002", "7001", "7009"]);
    expect(
      ordenarFila(lista, { chave: "nome", sentido: "asc" })[0].codigo,
    ).toBe("7009");
    expect(ordenarFila(lista, { chave: "", sentido: "" })).toBe(lista);
    let ordem = proximaOrdem({ chave: "", sentido: "" }, "art");
    expect(ordem).toEqual({ chave: "art", sentido: "asc" });
    ordem = proximaOrdem(ordem, "art");
    expect(ordem).toEqual({ chave: "art", sentido: "desc" });
    expect(proximaOrdem(ordem, "art")).toEqual({ chave: "", sentido: "" });
  });

  it("CSV da aba: colunas da aba, ';', BOM e célula protegida contra fórmula", () => {
    const csv = csvDaFila([eliminado], "eliminados");
    expect(
      csv.startsWith(
        "\uFEFFCódigo;Nome;Vaga;Motivo da eliminação;Nota declarada (ART)\r\n",
      ),
    ).toBe(true);
    expect(csv).toContain(
      "7009;'=Cmd|' /C calc'!A0;11;Cancelou a inscrição;12,5",
    );
    expect(nomeDoCsvDaFila("93/2026", "eliminados", new Date(2026, 9, 6))).toBe(
      "fila-93-2026-eliminados-2026-10-06.csv",
    );
  });
});

describe("andamento por vaga e agrupamento da tabela", () => {
  const c = (codigo, vaga, extra = {}) => ({
    id: `c-${codigo}`,
    codigo,
    vaga,
    situacao_pre: "NO_LOTE",
    entrada: "REGRA",
    ficha: null,
    ...extra,
  });
  const f = (situacao) => ({ id: `f-${situacao}`, situacao });
  const CANDIDATOS = [
    c("1", "A", { ficha: f("CONCLUIDA"), nota: 30 }),
    c("2", "A", { ficha: f("EM_ANALISE"), nota: 28 }),
    c("3", "A", { ficha: f("PENDENTE"), nota: 25 }),
    c("4", "A", { nota: 24 }),
    c("5", "A", { entrada: "DECISAO", ficha: f("PENDENTE"), nota: 9 }),
    c("6", "A", { situacao_pre: "ELIMINADO", nota: 40 }),
    c("7", "B", { ficha: f("REVISAR"), art: 18 }),
    c("8", "B", { ficha: f("CONCLUIDA"), situacao_pre: "ANALISADO", art: 20 }),
    c("9", "C", { situacao_pre: "RANQUEADO" }),
  ];
  const VAGAS = [
    { codigo: "B", cargo: "Enfermeiro" },
    { codigo: "A", cargo: "Técnico" },
    { codigo: "C", cargo: "Médico" },
  ];

  it("conta o andamento do edital e de cada vaga com lote, na ordem das vagas", () => {
    const a = andamentoDaFila(CANDIDATOS, VAGAS);
    expect(a.total).toEqual({
      lote: 7,
      concluidas: 2,
      em_analise: 1,
      revisao: 1,
      pendentes: 3,
    });
    expect(a.vagas.map((v) => v.codigo)).toEqual(["B", "A"]);
    expect(a.vagas[1]).toEqual({
      codigo: "A",
      cargo: "Técnico",
      lote: 5,
      concluidas: 1,
      em_analise: 1,
      revisao: 0,
      pendentes: 3,
    });
    expect(textoDoAndamento(a.vagas[1])).toBe(
      "Técnico · concluídas 1 de 5 · em análise 1 · pendentes 3",
    );
    expect(textoDoAndamento(a.vagas[0])).toBe(
      "Enfermeiro · concluídas 1 de 2 · em análise 0 · em revisão 1 · pendentes 0",
    );
  });

  it("o grupo da vaga: lote pela regra + por decisão e a linha de corte só com os da regra", () => {
    expect(resumoDaVagaNaFila(CANDIDATOS, "A")).toEqual({
      pelaRegra: 4,
      porDecisao: 1,
      total: 5,
      corte: 24,
    });
    // Sem a nota do lote, a ART.
    expect(resumoDaVagaNaFila(CANDIDATOS, "B").corte).toBe(18);
    expect(resumoDaVagaNaFila(CANDIDATOS, "C")).toMatchObject({
      total: 0,
      corte: null,
    });
  });

  it("agrupa por vaga sem mudar a ordem dentro do grupo", () => {
    const linhas = [CANDIDATOS[2], CANDIDATOS[6], CANDIDATOS[0], CANDIDATOS[7]];
    expect(agruparPorVaga(linhas, VAGAS).map((x) => x.codigo)).toEqual([
      "7",
      "8",
      "3",
      "1",
    ]);
  });
});
