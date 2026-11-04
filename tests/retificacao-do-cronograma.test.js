import { describe, expect, it, vi } from "vitest";
import { novaEtapa } from "../src/lib/cronograma-do-edital.ts";
import {
  bloqueioDaRetificacao,
  casarEtapas,
  compararRetificacao,
  etapasRetificadas,
  lerRetificacaoNoServidor,
  motivoDaRetificacao,
  numeroDaErrata,
  problemasDaComparacao,
  resumoDaComparacao,
  semelhancaDeAtividade,
} from "../src/lib/retificacao-do-cronograma.ts";

/*
  Retificação do cronograma: o "Leia-se" lido do PDF (pela função Python)
  comparado com o cronograma gravado, os ajustes de quem confere e o que vai
  para salvar_monitoramento_com_cronograma_v2. Nomes no formato da Saúde
  Indígena: o gravado nem sempre é igual ao do PDF.
*/

const etapa = (atividade, inicio, fim = inicio, origem = "PDF") =>
  novaEtapa({ atividade, data_inicio: inicio, data_fim: fim, origem });

const ATUAIS = [
  etapa("Publicação do Edital", "2026-09-08"),
  etapa("Impugnação do Edital", "2026-09-09", "2026-09-11"),
  etapa("Convocação para Entrevista", "2026-10-09", "2026-10-09", "MANUAL"),
  etapa("Período de Entrevistas", "2026-10-13", "2026-11-17"),
  etapa(
    "Prazo de recurso do resultado preliminar documental",
    "2026-10-01",
    "2026-10-02",
  ),
  etapa("Etapa extinta", "2026-11-20"),
  etapa("Resultado final do Processo Seletivo", "2026-11-27"),
];

const pdf = (atividade, inicio, fim = inicio, extra = {}) => ({
  atividade,
  data_inicio: inicio,
  data_fim: fim,
  texto_datas: "",
  negrito: false,
  avisos: [],
  ...extra,
});

const LEIA = [
  pdf("Publicação do Edital", "2026-09-08"),
  pdf("Impugnação do Edital", "2026-09-09", "2026-09-11"),
  pdf("Publicação da Lista Geral de Classificação Provisória", "2026-09-22"),
  pdf(
    "Prazo de recurso referente ao resultado preliminar da Avaliação Documental e de Títulos",
    "2026-10-01",
    "2026-10-02",
  ),
  pdf("Convocação para a Entrevista", "2026-10-09"),
  pdf("Período de Entrevistas", "2026-10-13", "2026-11-18", {
    negrito: true,
  }),
  pdf("Resultado final do Processo Seletivo", "2026-12-03", "2026-12-03", {
    negrito: true,
    avisos: ['"03/12" conferir'],
  }),
];

const LIDA = {
  tipo: "retificacao",
  numero: 2,
  rotulo: "2ª Retificação do Cronograma",
  edital: "105/2026",
  sei: "0868574",
  assinada_em: "2026-10-28",
  leia_se: LEIA,
  avisos: [],
};

describe("casamento das etapas", () => {
  it("nomes diferentes da mesma etapa casam; etapas diferentes não", () => {
    expect(
      semelhancaDeAtividade(
        "Convocação para Entrevista",
        "Convocação para a Entrevista",
      ),
    ).toBe(1);
    expect(
      semelhancaDeAtividade(
        "Resultado final da Entrevista",
        "Resultado final do Processo Seletivo",
      ),
    ).toBeLessThan(0.5);
    expect(casarEtapas(ATUAIS, LEIA)).toEqual([0, 1, null, 4, 2, 3, 6]);
  });

  it("nome repetido casa pela posição", () => {
    const atuais = [
      etapa("Resultado", "2026-01-01"),
      etapa("Resultado", "2026-02-01"),
    ];
    const lidas = [
      pdf("Resultado", "2026-01-05"),
      pdf("Resultado", "2026-02-05"),
    ];
    expect(casarEtapas(atuais, lidas)).toEqual([0, 1]);
  });
});

describe("comparação etapa a etapa", () => {
  it("igual, data muda, etapa nova e etapa que sumiu, na ordem do Leia-se", () => {
    const linhas = compararRetificacao(ATUAIS, LEIA);
    expect(
      linhas.map((l) => [l.situacao, l.atual?.atividade || l.pdf.atividade]),
    ).toEqual([
      ["igual", "Publicação do Edital"],
      ["igual", "Impugnação do Edital"],
      ["nova", "Publicação da Lista Geral de Classificação Provisória"],
      ["igual", "Prazo de recurso do resultado preliminar documental"],
      ["igual", "Convocação para Entrevista"],
      ["muda", "Período de Entrevistas"],
      ["sumiu", "Etapa extinta"],
      ["muda", "Resultado final do Processo Seletivo"],
    ]);
    expect(linhas.find((l) => l.situacao === "sumiu").incluir).toBe(false);
    expect(linhas.at(-1).avisos).toEqual(['"03/12" conferir']);
    expect(resumoDaComparacao(linhas)).toEqual({
      iguais: 4,
      mudam: 2,
      novas: 1,
      somem: 1,
    });
  });

  it("o cronograma novo guarda o nome gravado e marca ERRATA no que muda", () => {
    const novas = etapasRetificadas(compararRetificacao(ATUAIS, LEIA));
    expect(
      novas.map((e) => [
        e.ordem,
        e.atividade,
        e.data_inicio,
        e.data_fim,
        e.origem,
      ]),
    ).toEqual([
      [1, "Publicação do Edital", "2026-09-08", "2026-09-08", "PDF"],
      [2, "Impugnação do Edital", "2026-09-09", "2026-09-11", "PDF"],
      [
        3,
        "Publicação da Lista Geral de Classificação Provisória",
        "2026-09-22",
        "2026-09-22",
        "ERRATA",
      ],
      [
        4,
        "Prazo de recurso do resultado preliminar documental",
        "2026-10-01",
        "2026-10-02",
        "PDF",
      ],
      [5, "Convocação para Entrevista", "2026-10-09", "2026-10-09", "MANUAL"],
      [6, "Período de Entrevistas", "2026-10-13", "2026-11-18", "ERRATA"],
      [
        7,
        "Resultado final do Processo Seletivo",
        "2026-12-03",
        "2026-12-03",
        "ERRATA",
      ],
    ]);
  });

  it("ajustes: datas à mão, par escolhido, etapa nova de fora e etapa que sumiu mantida", () => {
    const linhas = compararRetificacao(ATUAIS, LEIA, {
      datas: { 5: { fim: "2026-11-19" } },
      pares: { 2: 5 },
      manter: [],
      ignorar: [],
    });
    const lista = linhas.find((l) => l.indicePdf === 2);
    expect(lista.situacao).toBe("muda");
    expect(lista.atual.atividade).toBe("Etapa extinta");
    expect(linhas.find((l) => l.indicePdf === 5).fim).toBe("2026-11-19");
    expect(linhas.some((l) => l.situacao === "sumiu")).toBe(false);

    const outras = compararRetificacao(ATUAIS, LEIA, {
      ignorar: [2],
      manter: [5],
    });
    const novas = etapasRetificadas(outras).map((e) => e.atividade);
    expect(novas).not.toContain(
      "Publicação da Lista Geral de Classificação Provisória",
    );
    expect(novas).toContain("Etapa extinta");
    expect(resumoDaComparacao(outras)).toMatchObject({ novas: 0, somem: 0 });
  });

  it("etapa sem data ou com fim antes do início impede aplicar", () => {
    const linhas = compararRetificacao(
      [],
      [
        pdf("Resultado final", "", ""),
        pdf("Recurso", "2026-10-10", "2026-10-01"),
      ],
    );
    expect(problemasDaComparacao(linhas)).toEqual([
      "Resultado final: preencha início e fim.",
      "Recurso: o fim é anterior ao início.",
    ]);
    expect(
      problemasDaComparacao(
        compararRetificacao([], [pdf("A", "2026-01-01")], { ignorar: [0] }),
      ),
    ).toEqual(["A retificação deixaria o cronograma vazio."]);
  });
});

describe("conferência e registro", () => {
  it("PDF de outro edital bloqueia; mesmo número com zeros passa", () => {
    expect(bloqueioDaRetificacao("Edital 105/2026", LIDA)).toBe("");
    expect(bloqueioDaRetificacao("0105/2026", LIDA)).toBe("");
    expect(bloqueioDaRetificacao("118/2026", LIDA)).toBe(
      "O PDF é do edital 105/2026, e este é o 118/2026. Escolha a retificação deste edital.",
    );
    expect(bloqueioDaRetificacao("105/2026", { ...LIDA, edital: "" })).toMatch(
      /número do edital no PDF/,
    );
    expect(bloqueioDaRetificacao("105/2026", { ...LIDA, leia_se: [] })).toMatch(
      /Leia-se/,
    );
    expect(bloqueioDaRetificacao("", LIDA)).toMatch(/sem número/);
  });

  it("errata com o nome da retificação e motivo citando o SEI", () => {
    expect(numeroDaErrata(LIDA)).toBe("2ª Retificação do Cronograma");
    expect(numeroDaErrata({ numero: 3 })).toBe("3ª Retificação do Cronograma");
    const resumo = resumoDaComparacao(compararRetificacao(ATUAIS, LEIA));
    expect(motivoDaRetificacao(LIDA, resumo)).toBe(
      "Lançada pela 2ª Retificação do Cronograma (SEI 0868574, assinada em 28/10/2026): 2 etapa(s) com data nova, 1 incluída(s), 1 retirada(s).",
    );
  });

  it("lê pela função Python com o token e devolve o nome do arquivo", async () => {
    const buscar = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => LIDA,
    }));
    const arquivo = new File(["%PDF-1.4"], "retificacao.pdf", {
      type: "application/pdf",
    });
    const lida = await lerRetificacaoNoServidor(arquivo, {
      token: "t",
      buscar,
    });
    expect(buscar).toHaveBeenCalledWith(
      "/api/anexos-do-edital?tipo=retificacao",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer t" }),
      }),
    );
    expect(lida.arquivo).toBe("retificacao.pdf");
    await expect(
      lerRetificacaoNoServidor(
        new File(["x"], "a.txt", { type: "text/plain" }),
        { buscar },
      ),
    ).rejects.toThrow("não é PDF");
    const falha = vi.fn(async () => ({
      ok: false,
      status: 422,
      json: async () => ({ erro: "Não consegui ler este PDF." }),
    }));
    await expect(
      lerRetificacaoNoServidor(arquivo, { buscar: falha }),
    ).rejects.toThrow("Não consegui ler este PDF.");
  });
});
