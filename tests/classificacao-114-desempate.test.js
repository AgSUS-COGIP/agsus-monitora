import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classificar } from "../src/lib/classificacao/motor.ts";
import { validarRegra } from "../src/lib/classificacao/regra.ts";

/*
  Edital 114/2026 (Projetos, AGSUS/FUNASA PES Rio Doce): versão 2 da regra de
  classificação — o desempate do item 10.1 (a) 60 anos ou mais, b) maior tempo
  de experiência profissional comprovado, c) maior idade, com a hora da
  certidão, 6.11.3/6.11.4) também na lista preliminar (8.2.10.10, 9.1, 9.2).
  A regra é a do seed (v1, 02/10/2026) com o $patch$ da correção
  supabase/correcoes/20261015-edital-114-classificacao-v2-desempate.sql.
  A data de corte da regra continua nula: vale o fim das inscrições do
  cronograma (14/10/2026), que a tela passa ao motor como `dataCorte`.
  Códigos e nomes fictícios, sem dado pessoal.
*/

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const SEED = ler(
  "supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql",
);
const CORRECAO = ler(
  "supabase/correcoes/20261015-edital-114-classificacao-v2-desempate.sql",
);

const REGRA_V1 = JSON.parse(
  /\('bcecfb08-88ef-4e06-8401-bcad6bf88fd0'::uuid, '114\/2026', 'projetos', '[^']+', \$r\$(.*?)\$r\$::jsonb\)/.exec(
    SEED,
  )[1],
);
const PATCH = JSON.parse(/\$patch\$(.*?)\$patch\$/.exec(CORRECAO)[1]);
const REGRA_V2 = {
  ...REGRA_V1,
  listas: {
    ...REGRA_V1.listas,
    PRELIMINAR: { ...REGRA_V1.listas.PRELIMINAR, ...PATCH.listas.PRELIMINAR },
  },
};
const FIM_DAS_INSCRICOES = "2026-10-14";

let n = 0;
const id = () => `00000000-0000-4000-8114-${String(++n).padStart(12, "0")}`;
const cand = (nome, nota, campos = {}) => ({
  analise_id: id(),
  codigo: String(11400000 + n),
  nome,
  vaga: "114001",
  cargo: "CARGO 1: ANALISTA DE GESTÃO -",
  modalidade: "Ampla concorrência",
  pcd: "NÃO",
  status: "Aprovado",
  etapa: "Triados",
  nota_documental: nota,
  data_nascimento: "1985-06-15",
  exp_profissional: 1500,
  quadro: "q1",
  ...campos,
});
const QUADRO = [
  {
    id: "q1",
    ordem: 1,
    cargo: "ANALISTA DE GESTÃO (Nível Superior)",
    modalidades: {},
    vagas_imediatas: 2,
    cadastro_reserva: true,
  },
];
const lista = (
  candidatos,
  {
    regra = REGRA_V2,
    tipo = "PRELIMINAR",
    dataCorte = FIM_DAS_INSCRICOES,
  } = {},
) => classificar({ tipo, regra, candidatos, quadro: QUADRO, dataCorte });
const geral = (r) =>
  r.vagas[0].geral.map((l) => `${l.posicao} ${l.nome}`).join(" | ");

describe("regra do 114/2026: v1 → v2", () => {
  it("só a preliminar muda; critérios do 10.1 na ordem; data de corte segue nula", () => {
    expect(REGRA_V1.listas.PRELIMINAR.empate).toBe("MESMA_POSICAO");
    expect(REGRA_V1.listas.FINAL.empate).toBe("CRITERIOS");
    expect(REGRA_V2.desempate).toEqual([
      { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
      { criterio: "EXP_PROFISSIONAL_TEMPO", direcao: "MAIOR_PRIMEIRO" },
      { criterio: "MAIOR_IDADE", direcao: "MAIOR_PRIMEIRO" },
    ]);
    expect(REGRA_V2.listas).toEqual({
      ...REGRA_V1.listas,
      PRELIMINAR: { empate: "CRITERIOS" },
    });
    expect(PATCH).toEqual({ listas: { PRELIMINAR: { empate: "CRITERIOS" } } });
    expect(REGRA_V2.data_corte).toBeNull();
    expect(validarRegra(REGRA_V2)).toEqual([]);
    expect(CORRECAO).toContain(
      "if v_atual #>> '{listas,PRELIMINAR,empate}' = 'CRITERIOS' then",
    );
    expect(CORRECAO).toContain(
      'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_nova);',
    );
    expect(CORRECAO).toContain("a01afddb-f64b-47d9-80e8-476a1ed14e43");
  });
});

describe("lista preliminar do 114/2026 — desempate do item 10.1", () => {
  it("v1: empatados na mesma posição; v2: a) 60+ primeiro, mesmo com menos experiência", () => {
    const candidatos = [
      cand("Ana", 40, {
        exp_profissional: 3000,
        data_nascimento: "1990-01-01",
      }),
      cand("Bia", 40, { exp_profissional: 200, data_nascimento: "1960-03-01" }),
      cand("Caio", 35),
    ];
    expect(geral(lista(candidatos, { regra: REGRA_V1 }))).toBe(
      "1 Ana | 1 Bia | 2 Caio",
    );
    const r = lista(candidatos);
    expect(geral(r)).toBe("1 Bia | 2 Ana | 3 Caio");
    expect(
      r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
    ).toContain("por 60+ (sim × não)");
    expect(r.pendencias).toEqual([]);
  });

  it("60 anos contados até o fim das inscrições (14/10/2026): quem faz 60 no dia 15 não é idoso", () => {
    const candidatos = [
      cand("Ana", 30, {
        exp_profissional: 5000,
        data_nascimento: "1966-10-15",
      }),
      cand("Bia", 30, { exp_profissional: 100, data_nascimento: "1966-10-14" }),
    ];
    expect(geral(lista(candidatos))).toBe("1 Bia | 2 Ana");
  });

  it("dois com 60+: b) a experiência decide", () => {
    const candidatos = [
      cand("Ana", 30, {
        exp_profissional: 1000,
        data_nascimento: "1950-01-01",
      }),
      cand("Bia", 30, {
        exp_profissional: 1001,
        data_nascimento: "1960-01-01",
      }),
    ];
    const r = lista(candidatos);
    expect(geral(r)).toBe("1 Bia | 2 Ana");
    expect(
      r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
    ).toContain("por tempo de experiência (1001 dias × 1000 dias)");
  });

  it("nenhum com 60+: b) mais experiência primeiro", () => {
    const candidatos = [
      cand("Ana", 30, { exp_profissional: 900, data_nascimento: "1970-01-01" }),
      cand("Bia", 30, {
        exp_profissional: 2400,
        data_nascimento: "1995-01-01",
      }),
    ];
    expect(geral(lista(candidatos))).toBe("1 Bia | 2 Ana");
  });

  it("mesma experiência: c) maior idade pela data de nascimento", () => {
    const candidatos = [
      cand("Ana", 30, { data_nascimento: "1990-01-02" }),
      cand("Bia", 30, { data_nascimento: "1980-01-02" }),
    ];
    const r = lista(candidatos);
    expect(geral(r)).toBe("1 Bia | 2 Ana");
    expect(
      r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
    ).toContain("por idade (nasc. 02/01/1980 × nasc. 02/01/1990)");
  });

  it("mesmo dia: a hora da certidão (6.11.3); sem certidão vale 23h59min59s (6.11.4)", () => {
    const candidatos = [
      cand("Ana", 30),
      cand("Bia", 30, { hora_nascimento: "22:10" }),
    ];
    const r = lista(candidatos);
    expect(geral(r)).toBe("1 Bia | 2 Ana");
    expect(
      r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
    ).toContain(
      "por idade (22h10min00s pela certidão × 23h59min59s, sem certidão)",
    );
  });

  it("empate em tudo (mesmo dia, sem certidão): mesma posição, o edital não define", () => {
    const r = lista([cand("Ana", 30), cand("Bia", 30)]);
    expect(geral(r)).toBe("1 Ana | 1 Bia");
  });

  it("a final não muda (já usava os critérios na v1)", () => {
    const candidatos = [
      cand("Ana", 40, {
        exp_profissional: 3000,
        data_nascimento: "1990-01-01",
      }),
      cand("Bia", 40, { exp_profissional: 200, data_nascimento: "1960-03-01" }),
    ];
    expect(geral(lista(candidatos, { regra: REGRA_V1, tipo: "FINAL" }))).toBe(
      geral(lista(candidatos, { tipo: "FINAL" })),
    );
    expect(geral(lista(candidatos, { tipo: "FINAL" }))).toBe("1 Bia | 2 Ana");
  });

  it("sem a data do cronograma, o motor avisa (a regra não tem data de corte)", () => {
    const r = lista([cand("Ana", 30), cand("Bia", 30)], { dataCorte: null });
    expect(r.avisos.some((a) => a.codigo === "SEM_DATA_CORTE")).toBe(true);
  });
});
