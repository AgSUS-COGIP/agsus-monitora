import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  CHAVES_DOS_MARCADORES,
  dadosDoModelo,
  dataPorExtenso,
  errosDoModelo,
  marcadoresDesconhecidos,
  marcadoresDoTexto,
  modelosAplicaveis,
  renderizarModelo,
  valoresDoRecurso,
} from "../src/lib/modelos-de-resposta.ts";

/*
  Os modelos de resposta a recurso: o preenchimento dos marcadores (texto
  puro, uma passada, sem valor vira "[não informado: …]"), a escolha dos
  modelos do recurso e a lista de marcadores, que tem de ser a do banco.
*/
const MIGRATION = readFileSync(
  "supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql",
  "utf8",
).replace(/\r\n/g, "\n");

const RECURSO = {
  id: "r1",
  nu: 7,
  candidato: "Ana Ribeiro",
  codigo: "111",
  edital: "105/2026",
  unidade: "DSEI Litoral Sul",
  cargo: "Enfermeiro 40h",
  vaga: "V-10",
  origem: "analise-curricular",
  nota_anterior: 50,
  nota_atual: 55.5,
  resultado_anterior: "Reprovado",
  resultado_atual: "Aprovado",
  analista: "Carla",
  situacao: "DEFERIDO",
};

describe("marcadores", () => {
  it("a lista do front é a de FC_MARCADORES_MODELO_RESPOSTA", () => {
    const trecho = MIGRATION.match(
      /FC_MARCADORES_MODELO_RESPOSTA"\(\)\nreturns text\[\][\s\S]*?select array\[([\s\S]*?)\]::text\[\]/,
    );
    expect(trecho).not.toBeNull();
    const doBanco = [...trecho[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
    expect(doBanco).toEqual([...CHAVES_DOS_MARCADORES]);
    // A pedida do chamado.
    expect(CHAVES_DOS_MARCADORES).toEqual([
      "nome_candidato",
      "codigo_candidato",
      "edital",
      "unidade",
      "cargo",
      "vaga",
      "origem",
      "nota_anterior",
      "nota_atual",
      "resultado_anterior",
      "resultado_atual",
      "data_hoje",
      "analista",
      "fundamentacao",
    ]);
  });

  it("acha os marcadores do texto, sem repetir, e os desconhecidos", () => {
    const corpo = "{nome_candidato} {foo} {nome_candidato} {Maiusculo} {x_y}";
    expect(marcadoresDoTexto(corpo)).toEqual(["nome_candidato", "foo", "x_y"]);
    expect(marcadoresDesconhecidos(corpo)).toEqual(["foo", "x_y"]);
  });

  it("os 6 modelos iniciais só usam marcadores aceitos e cobrem situação × origem", () => {
    const semente = MIGRATION.slice(
      MIGRATION.indexOf("-- 12. Modelos iniciais"),
    );
    const corpos = [...semente.matchAll(/\$modelo\$([\s\S]*?)\$modelo\$/g)].map(
      (m) => m[1],
    );
    expect(corpos).toHaveLength(6);
    for (const corpo of corpos) {
      expect(marcadoresDesconhecidos(corpo)).toEqual([]);
      expect(corpo).toContain("{fundamentacao}");
      expect(corpo).toContain("{nome_candidato}");
      expect(corpo.length).toBeGreaterThan(20);
      expect(corpo.length).toBeLessThanOrEqual(20000);
    }
    const combinacoes = [
      ...semente.matchAll(
        /null, '(analise-curricular|entrevista)', '(DEFERIDO|INDEFERIDO|PARCIALMENTE_INDEFERIDO)'/g,
      ),
    ].map((m) => `${m[1]}:${m[2]}`);
    expect(new Set(combinacoes).size).toBe(6);
  });
});

describe("preenchimento", () => {
  const hoje = new Date(2026, 8, 29, 10);

  it("troca cada marcador pelo valor do recurso", () => {
    const valores = valoresDoRecurso(RECURSO, {
      fundamentacao: "O diploma foi aceito.",
      hoje,
    });
    const { texto, faltando, desconhecidos } = renderizarModelo(
      "{nome_candidato} ({codigo_candidato}) — {edital}/{unidade} — {origem}: {nota_anterior} → {nota_atual}; {resultado_atual}. {fundamentacao} {data_hoje}, {analista}.",
      valores,
    );
    expect(texto).toBe(
      "Ana Ribeiro (111) — 105/2026/DSEI Litoral Sul — Análise curricular: 50 → 55,5; Aprovado. O diploma foi aceito. 29 de setembro de 2026, Carla.",
    );
    expect(faltando).toEqual([]);
    expect(desconhecidos).toEqual([]);
  });

  it("sem valor: marca visível e a lista do que falta", () => {
    const valores = valoresDoRecurso(
      { ...RECURSO, nota_atual: null, analista: "" },
      { hoje },
    );
    const { texto, faltando } = renderizarModelo(
      "Nota {nota_atual}. {fundamentacao} {analista}",
      valores,
    );
    expect(texto).toBe(
      "Nota [não informado: Nota atual]. [não informado: Fundamentação] [não informado: Analista]",
    );
    expect(faltando).toEqual(["nota_atual", "fundamentacao", "analista"]);
  });

  it("o analista cai no nome dado quando o recurso não tem", () => {
    expect(
      valoresDoRecurso({ ...RECURSO, analista: " " }, { analista: "Diego" })
        .analista,
    ).toBe("Diego");
  });

  it("marcador desconhecido fica como está e é avisado", () => {
    const { texto, desconhecidos } = renderizarModelo("Olá {apelido}", {});
    expect(texto).toBe("Olá {apelido}");
    expect(desconhecidos).toEqual(["apelido"]);
  });

  it("uma passada: valor com marcador ou HTML não vira marcador nem HTML", () => {
    const { texto } = renderizarModelo("{fundamentacao} / {nome_candidato}", {
      fundamentacao: "Veja {nota_atual} <script>alert(1)</script>",
      nome_candidato: "Ana & <b>Bia</b>",
      nota_atual: "99",
    });
    expect(texto).toBe(
      "Veja {nota_atual} <script>alert(1)</script> / Ana & <b>Bia</b>",
    );
  });

  it("normaliza quebras de linha e aceita corpo vazio", () => {
    expect(renderizarModelo("a\r\nb\rc", {}).texto).toBe("a\nb\nc");
    expect(renderizarModelo(null, {}).texto).toBe("");
  });

  it("data por extenso, em português", () => {
    expect(dataPorExtenso(new Date(2026, 0, 5))).toBe("5 de janeiro de 2026");
    expect(dataPorExtenso("x")).toBe("");
  });
});

describe("modelos do recurso", () => {
  const MODELOS = [
    {
      id: "a",
      nome: "Deferido — geral",
      situacao: "DEFERIDO",
      origem: null,
      area: null,
    },
    {
      id: "b",
      nome: "Deferido — análise",
      situacao: "DEFERIDO",
      origem: "analise-curricular",
      area: null,
    },
    {
      id: "c",
      nome: "Indeferido — análise",
      situacao: "INDEFERIDO",
      origem: "analise-curricular",
      area: null,
    },
    {
      id: "d",
      nome: "Deferido — entrevista",
      situacao: "DEFERIDO",
      origem: "entrevista",
      area: null,
    },
    {
      id: "e",
      nome: "Deferido — só SEDE",
      situacao: "DEFERIDO",
      origem: null,
      area: "sede",
    },
  ];

  it("recurso decidido: da área, da origem e da situação; a origem exata primeiro", () => {
    expect(
      modelosAplicaveis(MODELOS, RECURSO, "saude-indigena").map((m) => m.id),
    ).toEqual(["b", "a"]);
    expect(
      modelosAplicaveis(MODELOS, RECURSO, "sede").map((m) => m.id),
    ).toEqual(["b", "a", "e"]);
  });

  it("recurso em análise: todas as situações da origem", () => {
    expect(
      modelosAplicaveis(
        MODELOS,
        { ...RECURSO, situacao: "EM_ANALISE" },
        "saude-indigena",
      ).map((m) => m.id),
    ).toEqual(["b", "c", "a"]);
  });
});

describe("formulário de modelo", () => {
  it("valida nome, situação, tamanho e marcadores", () => {
    expect(
      errosDoModelo({ nome: "ab", situacao: "EM_ANALISE", corpo: "curto" }),
    ).toEqual({
      nome: expect.any(String),
      situacao: expect.any(String),
      corpo: expect.any(String),
    });
    expect(
      errosDoModelo({
        nome: "Modelo",
        situacao: "DEFERIDO",
        corpo: "Prezado {nome_candidato}, veja {nota_final}.",
      }).corpo,
    ).toBe("Marcador desconhecido: {nota_final}.");
    expect(
      errosDoModelo({
        nome: "Modelo",
        situacao: "DEFERIDO",
        corpo: "Prezado {nome_candidato}, {fundamentacao}",
      }),
    ).toEqual({});
  });

  it("o p_dados: novo sem id; edição com id e versão; vazios viram null", () => {
    expect(
      dadosDoModelo({
        id: null,
        nome: " A ",
        situacao: "DEFERIDO",
        origem: "",
        area: "",
        corpo: " x ",
      }),
    ).toEqual({
      nome: "A",
      situacao: "DEFERIDO",
      origem: null,
      area: null,
      corpo: "x",
    });
    expect(
      dadosDoModelo({
        id: "m",
        versao: 3,
        nome: "A",
        situacao: "INDEFERIDO",
        origem: "entrevista",
        area: "sede",
        corpo: "x",
      }),
    ).toMatchObject({ id: "m", versao: 3, origem: "entrevista", area: "sede" });
  });
});
