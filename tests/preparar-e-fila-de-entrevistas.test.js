import { describe, expect, it } from "vitest";
import {
  agruparPorVaga,
  buscarNaFila,
  iniciais,
  montarFila,
  ordemDaTela,
} from "../src/lib/fila-de-conducao.ts";
import {
  parecerPronto,
  textoDoParecerDaEntrevista,
} from "../src/lib/parecer-da-entrevista.ts";
import {
  agendaPorDia,
  passoInicial,
  passosDoPreparar,
  pendenciasDaConfiguracao,
  textoDoAndamento,
} from "../src/lib/passos-do-preparar.ts";
import {
  errosPorSecao,
  pendenciasDoRoteiro,
  secaoDoErro,
} from "../src/lib/pendencias-do-roteiro.ts";
import { frasesDaEliminacao } from "../src/lib/resumo-da-entrevista.ts";
import { errosDoRoteiro } from "../src/lib/roteiro-de-entrevista.js";

/*
  Entrevistas mais claras: as iniciais do avatar, a busca e o agrupamento da
  fila por vaga, os passos de Preparar (com o que falta), a lista do que
  falta no editor do roteiro, as frases da eliminação e o parecer em texto
  pronto da ficha.
*/

const HOJE = "2026-10-07";

describe("iniciais do avatar", () => {
  it("primeiro e último nome, sem números, códigos nem partículas", () => {
    expect(iniciais("Candidato Teste 03")).toBe("CT");
    expect(iniciais("Candidato Teste 13")).toBe("CT");
    expect(iniciais("Maria das Dores da Silva")).toBe("MS");
    expect(iniciais("José de Souza Terena")).toBe("JT");
    expect(iniciais("Ana Lúcia Terena")).toBe("AT");
    expect(iniciais("Érica d'Ávila")).toBe("ÉD");
    expect(iniciais("Bruno")).toBe("BR");
    expect(iniciais("Candidato 1")).toBe("CA");
    expect(iniciais("João Pedro - 2º")).toBe("JP");
  });
  it("sem palavra com letra: os primeiros caracteres; vazio: ?", () => {
    expect(iniciais("12345")).toBe("12");
    expect(iniciais("  ")).toBe("?");
    expect(iniciais(null)).toBe("?");
  });
});

const convocado = (n, extra = {}) => ({
  id: `e${n}`,
  analise_id: `an${n}`,
  candidato: `Pessoa ${n}`,
  codigo: `K${n}`,
  vaga: "V1",
  cargo: "Enfermeiro",
  avaliacoes: [],
  ...extra,
});

describe("fila: busca, vaga e ordem", () => {
  const dados = {
    convocados: [
      convocado(1, { candidato: "Zé Ninguém", vaga: "V2", cargo: "Técnico" }),
      convocado(2, { candidato: "Ana Íris" }),
      convocado(3, { candidato: "Bruna Lima", codigo: "43015" }),
      convocado(4, { candidato: "Carlos", vaga: "" }),
    ],
    avaliadores: [],
  };
  const agenda = {
    itens: [
      { analise_id: "an3", data: HOJE, inicio: "09:00", banca: 1 },
      { analise_id: "an2", data: HOJE, inicio: "09:00", banca: 2 },
      { analise_id: "an1", data: HOJE, inicio: "08:00", banca: 1 },
    ],
  };
  const fila = montarFila(dados, agenda);

  it("ordena por horário e depois pelo nome (sem desempatar pela banca)", () => {
    expect(fila.map((i) => i.nome)).toEqual([
      "Zé Ninguém",
      "Ana Íris",
      "Bruna Lima",
      "Carlos",
    ]);
  });

  it("agrupa por vaga, com o cargo; sem vaga fica no fim", () => {
    const grupos = agruparPorVaga(fila);
    expect(grupos.map((g) => [g.vaga, g.cargo, g.itens.length])).toEqual([
      ["V1", "Enfermeiro", 2],
      ["V2", "Técnico", 1],
      ["", "Enfermeiro", 1],
    ]);
    // A ordem do "Salvar e abrir o próximo" é a da tela, vaga a vaga.
    expect(ordemDaTela(fila).map((i) => i.id)).toEqual([
      "e2",
      "e3",
      "e1",
      "e4",
    ]);
  });

  it("busca por nome (sem acento) ou código, palavra por palavra", () => {
    expect(buscarNaFila(fila, "ana iris").map((i) => i.id)).toEqual(["e2"]);
    expect(buscarNaFila(fila, "43015").map((i) => i.id)).toEqual(["e3"]);
    expect(buscarNaFila(fila, "v2").map((i) => i.id)).toEqual(["e1"]);
    expect(buscarNaFila(fila, "  ")).toHaveLength(4);
    expect(buscarNaFila(fila, "ninguém lima")).toEqual([]);
  });
});

describe("passos de Preparar", () => {
  const base = {
    roteiro: { nome: "Roteiro", rotuloDaVersao: "v2" },
    membros: 2,
    bancas: 1,
    errosDaBanca: [],
    convocacao: { temLista: true, naLista: 2, naFicha: 2, aConvocar: 0 },
    agenda: { comHorario: 2, convocados: 2 },
  };

  it("tudo pronto: quatro passos feitos, com o resumo de cada um", () => {
    const passos = passosDoPreparar(base);
    expect(passos.map((p) => [p.id, p.estado, p.resumo])).toEqual([
      ["roteiro", "feito", "Roteiro · v2"],
      ["banca", "feito", "2 membros em 1 banca"],
      ["convocacao", "feito", "2 convocados"],
      ["agenda", "feito", "2 horários"],
    ]);
    expect(textoDoAndamento(passos)).toBe("4 de 4 prontos");
    expect(passoInicial(passos)).toBe(0);
  });

  it("diz o que falta em cada passo e abre no primeiro pendente", () => {
    const passos = passosDoPreparar({
      ...base,
      roteiro: null,
      membros: 0,
      bancas: 0,
      errosDaBanca: ["Banca 1: ninguém avalia “Escuta”."],
      convocacao: { temLista: false, naLista: 0, naFicha: 0, aConvocar: 0 },
      agenda: { comHorario: 0, convocados: 0 },
    });
    expect(passos.map((p) => p.falta)).toEqual([
      ["Escolha o roteiro da entrevista."],
      ["Cadastre os membros da banca.", "Banca 1: ninguém avalia “Escuta”."],
      ["Gere a lista de convocação na Classificação."],
      ["Convoque os candidatos antes de montar a agenda."],
    ]);
    expect(textoDoAndamento(passos)).toBe("0 de 4 prontos");
    expect(passoInicial(passos)).toBe(0);
  });

  it("convocação e agenda pela metade", () => {
    const passos = passosDoPreparar({
      ...base,
      convocacao: { temLista: true, naLista: 5, naFicha: 2, aConvocar: 3 },
      agenda: { comHorario: 1, convocados: 2 },
    });
    expect(passos[2].falta).toEqual([
      "3 candidatos da lista ainda não foram convocados.",
    ]);
    expect(passos[3].falta).toEqual(["1 convocado ainda está sem horário."]);
    expect(passoInicial(passos)).toBe(2);
    expect(
      passosDoPreparar({
        ...base,
        convocacao: { temLista: true, naLista: 2, naFicha: 0, aConvocar: 2 },
      })[2].falta,
    ).toEqual(["Convoque os 2 candidatos da lista."]);
  });

  it("o que falta para salvar a configuração, com o membro pelo nome", () => {
    expect(
      pendenciasDaConfiguracao(
        {
          roteiro: "Escolha o roteiro da entrevista.",
          "avaliador.k2.origem": "Origem: de 2 a 80 caracteres.",
          "banca.b1.quantidade": "Quantidade: número inteiro de 1 a 20.",
          cobertura: "Banca 1: ninguém avalia “Escuta”.",
        },
        [
          { chave: "k1", nome: "Ana" },
          { chave: "k2", nome: "Beto" },
        ],
      ),
    ).toEqual([
      {
        chave: "roteiro",
        passo: "roteiro",
        texto: "Escolha o roteiro da entrevista.",
      },
      {
        chave: "avaliador.k2.origem",
        passo: "banca",
        texto: "Membro 2 (Beto): Origem: de 2 a 80 caracteres.",
      },
      {
        chave: "banca.b1.quantidade",
        passo: "banca",
        texto: "Composição: Quantidade: número inteiro de 1 a 20.",
      },
      {
        chave: "cobertura",
        passo: "banca",
        texto: "Banca 1: ninguém avalia “Escuta”.",
      },
    ]);
  });

  it("a agenda por dia, em ordem, e quem está sem horário", () => {
    const { dias, semHorario } = agendaPorDia(
      {
        itens: [
          { analise_id: "an2", data: "2026-10-08", inicio: "09:00:00" },
          { analise_id: "an1", data: HOJE, inicio: "10:00:00", banca: 2 },
          { analise_id: "an9", data: HOJE, inicio: "08:00:00" },
        ],
      },
      [convocado(1), convocado(2), convocado(3)],
      HOJE,
    );
    expect(
      dias.map((d) => [d.rotulo, d.linhas.map((l) => [l.inicio, l.nome])]),
    ).toEqual([
      ["Hoje", [["10:00", "Pessoa 1"]]],
      ["Amanhã", [["09:00", "Pessoa 2"]]],
    ]);
    expect(semHorario.map((c) => c.id)).toEqual(["e3"]);
  });
});

describe("editor do roteiro: o que falta e as frases da eliminação", () => {
  const rascunho = {
    nome: "",
    etapa: "",
    descricao: "",
    escala: "NIVEIS",
    niveis: [{ chave: "n1", nota: "0", nome: "", descricao: "" }],
    aspectos: [],
    competencias: [
      {
        chave: "k1",
        nome: "Escuta",
        descricao: "",
        nota_maxima: "0",
        peso: "1",
        minimo: "",
        tipo_minimo: "VALOR",
      },
    ],
    nota_minima_total: "",
    notas_eliminatorias: [],
    banca: [],
  };

  it("cada erro com o lugar, na ordem das seções", () => {
    const pendencias = pendenciasDoRoteiro(errosDoRoteiro(rascunho), rascunho);
    expect(pendencias.map((p) => [p.secao, p.texto])).toEqual([
      ["identificacao", "Nome do roteiro: de 3 a 150 caracteres."],
      [
        "competencias",
        "Competência 1 (Escuta): Nota máxima: maior que 0 e até 100.",
      ],
      ["escala", "Nível 1: Nome do nível: de 2 a 80 caracteres."],
    ]);
    expect(errosPorSecao(pendencias)).toMatchObject({
      identificacao: 1,
      competencias: 1,
      escala: 1,
      aprovacao: 0,
    });
    expect(secaoDoErro("nota_minima_total")).toBe("aprovacao");
    expect(secaoDoErro("banca.x.quantidade")).toBe("banca");
  });

  it("frases simples do que elimina, do rascunho", () => {
    expect(
      frasesDaEliminacao({
        competencias: [
          { id: "a", nota_maxima: "5", minimo: "2", tipo_minimo: "VALOR" },
          { id: "b", nota_maxima: "5", minimo: "2", tipo_minimo: "VALOR" },
        ],
        notas_eliminatorias: [],
        nota_minima_total: "8",
        ausencia_elimina: true,
      }),
    ).toEqual([
      "Abaixo de 2 em qualquer competência ou abaixo de 8 no total, o candidato fica inapto.",
      "Quem falta é eliminado.",
    ]);
    expect(
      frasesDaEliminacao({
        competencias: [{ id: "a", nota_maxima: "5" }],
        ausencia_elimina: false,
      }),
    ).toEqual(["Quem falta fica com nota 0, sem ser eliminado."]);
  });
});

describe("parecer da entrevista em texto pronto", () => {
  const base = {
    candidato: "Bruna Lima",
    codigo: "43015",
    edital: "991/2099",
    vaga: "V1",
    cargo: "Enfermeiro",
    roteiro: "Entrevista individual",
    versao: "Banca de outubro · v2",
    avaliadores: [
      { nome: "Ana", origem: "AgSUS" },
      { nome: "Beto", origem: "DSEI" },
    ],
    competencias: [
      { nome: "Escuta", nota: 3.333, maximo: 5, minimo: 2 },
      { nome: "Equipe", nota: 4, maximo: 5, minimo: 2 },
    ],
    total: 7.333,
    maxima: 10,
    minimoTotal: 6,
    parecer: "APTO",
    motivos: [],
    faltou: false,
  };

  it("só fica pronto com tudo lançado e parecer Apto ou Inapto", () => {
    expect(parecerPronto("APTO", "")).toBe(true);
    expect(parecerPronto("INAPTO", "")).toBe(true);
    expect(parecerPronto("APTO", "faltam 2 notas")).toBe(false);
    expect(parecerPronto("SEM_PARECER", "")).toBe(false);
  });

  it("apto: quem, onde, roteiro, banca, notas, total e o parecer", () => {
    expect(textoDoParecerDaEntrevista(base)).toBe(
      [
        "Parecer da entrevista — Bruna Lima (cód. 43015)",
        "Edital 991/2099 · Vaga V1 · Enfermeiro",
        "Roteiro: Entrevista individual · Banca de outubro · v2",
        "Banca: Ana (AgSUS), Beto (DSEI)",
        "",
        "Notas por competência (média da banca):",
        "1. Escuta: 3,33 de 5 (mínimo 2)",
        "2. Equipe: 4 de 5 (mínimo 2)",
        "Total: 7,33 de 10 (mínimo 6)",
        "",
        "Parecer: APTO — atingiu os mínimos do roteiro.",
      ].join("\n"),
    );
  });

  it("inapto com os motivos; falta com o efeito da ausência", () => {
    expect(
      textoDoParecerDaEntrevista({
        ...base,
        parecer: "INAPTO",
        motivos: ["Escuta abaixo do mínimo (1 < 2)."],
      })
        .split("\n")
        .at(-1),
    ).toBe("Parecer: INAPTO — Escuta abaixo do mínimo (1 < 2).");
    const falta = textoDoParecerDaEntrevista({
      ...base,
      parecer: "INAPTO",
      faltou: true,
    });
    expect(falta).toContain("O candidato não compareceu à entrevista.");
    expect(falta.split("\n").at(-1)).toBe(
      "Parecer: INAPTO — a ausência elimina neste roteiro.",
    );
    expect(falta).not.toContain("Notas por competência");
  });
});
