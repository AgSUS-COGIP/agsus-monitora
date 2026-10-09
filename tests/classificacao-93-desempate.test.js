import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { classificar } from "../src/lib/classificacao/motor.js";
import {
  horaBR,
  lerHora,
  segundosDeVida,
} from "../src/lib/classificacao/numeros.js";
import { validarRegra } from "../src/lib/classificacao/regra.js";

/*
  Auditoria do edital 93/2026 (Projetos, análise documental pela planilha):
  a lista "Avaliação documental — resultado preliminar" contra o edital
  (8.2.6 nota mínima 15; 8.2.1 eliminação; 8.2.10.10 e 9.3 ordem de
  classificação com desempate; 10.1 a) 60+, b) maior tempo de experiência,
  c) maior idade com a hora da certidão, 6.11.5/6.11.6; 4.1 vagas por
  modalidade). Casos montados a partir dos padrões reais do 93 (códigos e
  nomes fictícios, sem dado pessoal). A regra é a do seed (02/10/2026) com o
  $patch$ da correção supabase/correcoes/20261009-classificacao-93-desempate-e-quadro.sql.
*/

const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const SEED = ler(
  "supabase/correcoes/20261002-regras-de-classificacao-todos-os-editais.sql",
);
const CORRECAO = ler(
  "supabase/correcoes/20261009-classificacao-93-desempate-e-quadro.sql",
);

const REGRA_SEED = JSON.parse(
  /\('f57d77e1-7f6b-416c-9f9e-6e40c6d5bded'::uuid, '93\/2026', 'projetos', '[^']+', \$r\$(.*?)\$r\$::jsonb\)/.exec(
    SEED,
  )[1],
);
const PATCH = JSON.parse(/\$patch\$(.*?)\$patch\$/.exec(CORRECAO)[1]);
const REGRA_93 = {
  ...REGRA_SEED,
  data_corte: PATCH.data_corte,
  listas: {
    ...REGRA_SEED.listas,
    PRELIMINAR: { ...REGRA_SEED.listas.PRELIMINAR, ...PATCH.listas.PRELIMINAR },
  },
};
const QUADRO_DA_CORRECAO = [
  ...CORRECAO.matchAll(/\((\d), '([^']+)',\s+\$q\$(.*?)\$q\$::jsonb\)/g),
].map((m) => ({
  ordem: Number(m[1]),
  termo: m[2],
  modalidades: JSON.parse(m[3]),
}));

let n = 0;
const id = () => `00000000-0000-4000-8093-${String(++n).padStart(12, "0")}`;
/* Uma análise da planilha como o RPC devolve (vaga técnica de 6 vagas). */
const cand = (nome, nota, campos = {}) => ({
  analise_id: id(),
  codigo: String(9300000 + n),
  nome,
  vaga: "900258",
  cargo: "CARGO 5: TÉCNICO DE SEGURANÇA DO TRABALHO -",
  modalidade: "Ampla concorrência",
  pcd: "NÃO",
  status: "Aprovado",
  etapa: "Triados",
  nota_documental: nota,
  data_nascimento: "1985-06-15",
  exp_profissional: 1500,
  quadro: "q5",
  ...campos,
});
const QUADRO = (modalidades, vagas = 6) => [
  {
    id: "q5",
    ordem: 5,
    cargo: "TÉCNICO DE SEGURANÇA DO TRABALHO (Nível Médio)",
    modalidades,
    vagas_imediatas: vagas,
    cadastro_reserva: true,
  },
];
const preliminar = (candidatos, regra = REGRA_93, quadro = QUADRO({})) =>
  classificar({ tipo: "PRELIMINAR", regra, candidatos, quadro });
const geral = (r) =>
  r.vagas[0].geral.map((l) => `${l.posicao} ${l.nome}`).join(" | ");

describe("regra do 93/2026 depois da correção", () => {
  it("critérios do item 10.1, na ordem, e a preliminar passa a usá-los", () => {
    expect(REGRA_SEED.listas.PRELIMINAR.empate).toBe("MESMA_POSICAO");
    expect(REGRA_93.desempate).toEqual([
      { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
      { criterio: "EXP_PROFISSIONAL_TEMPO", direcao: "MAIOR_PRIMEIRO" },
      { criterio: "MAIOR_IDADE", direcao: "MAIOR_PRIMEIRO" },
    ]);
    expect(REGRA_93.listas.PRELIMINAR.empate).toBe("CRITERIOS");
    expect(REGRA_93.data_corte).toBe("2026-09-29");
    expect(REGRA_93.documental.nota_minima).toBe(15);
    expect(validarRegra(REGRA_93)).toEqual([]);
    // A correção confere a ordem antes de gravar e só grava uma vez.
    expect(CORRECAO).toContain(
      `'["IDOSO_60", "EXP_PROFISSIONAL_TEMPO", "MAIOR_IDADE"]'::jsonb`,
    );
    expect(CORRECAO).toContain(
      "if v_atual #>> '{listas,PRELIMINAR,empate}' = 'CRITERIOS' then",
    );
    expect(CORRECAO).toContain(
      'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(v_nova);',
    );
  });

  it("quadro do item 4.1: a soma de cada cargo bate com as vagas imediatas", () => {
    const total = (m) =>
      Object.values(m).reduce((s, v) => s + (Number(v) || 0), 0);
    expect(
      QUADRO_DA_CORRECAO.map((q) => [q.ordem, total(q.modalidades)]),
    ).toEqual([
      [1, 2],
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 6],
    ]);
    expect(QUADRO_DA_CORRECAO[4].modalidades).toMatchObject({
      "Ampla Concorrência": 3,
      PcD: 1,
      "Pretos e Pardos": 2,
    });
  });
});

describe("lista preliminar do 93/2026 — desempate (item 10.1)", () => {
  it("antes: 8 empatados com 45 ficavam todos em 1º; agora saem na ordem do 10.1", () => {
    const candidatos = [
      cand("Ana", 45, {
        exp_profissional: 1678,
        data_nascimento: "1995-03-01",
      }),
      cand("Bia", 45, {
        exp_profissional: 5077,
        data_nascimento: "1987-03-01",
      }),
      cand("Caio", 45, {
        exp_profissional: 1499,
        data_nascimento: "1959-05-10",
      }),
      cand("Davi", 45, {
        exp_profissional: 1501,
        data_nascimento: "1965-02-10",
      }),
      cand("Eva", 44, { modalidade: "Pretos e pardos" }),
    ];
    expect(geral(preliminar(candidatos, REGRA_SEED))).toBe(
      "1 Ana | 1 Bia | 1 Caio | 1 Davi | 2 Eva",
    );
    const r = preliminar(candidatos);
    // a) os dois com 60+ primeiro; entre eles, b) a experiência (1501 × 1499 dias);
    // depois b) entre os demais.
    expect(geral(r)).toBe("1 Davi | 2 Caio | 3 Bia | 4 Ana | 5 Eva");
    const davi = r.explicacoes[candidatos[3].analise_id].explicacao.join(" ");
    expect(davi).toContain("por 60+ (sim × não)");
    expect(davi).toContain("por tempo de experiência (1501 dias × 1499 dias)");
    expect(r.pendencias).toEqual([]);
  });

  it("mesma experiência: c) maior idade pela data de nascimento", () => {
    const candidatos = [
      cand("Ana", 30, { data_nascimento: "1990-01-02" }),
      cand("Bia", 30, { data_nascimento: "1980-01-02" }),
    ];
    const r = preliminar(candidatos);
    expect(geral(r)).toBe("1 Bia | 2 Ana");
    expect(
      r.explicacoes[candidatos[1].analise_id].explicacao.join(" "),
    ).toContain("por idade (nasc. 02/01/1980 × nasc. 02/01/1990)");
    expect(r.avisos.filter((a) => a.codigo === "HORA_DE_NASCIMENTO")).toEqual(
      [],
    );
    expect(r.explicacoes[candidatos[0].analise_id].horaDecide).toBe(false);
  });

  it("mesmo dia de nascimento: decide a hora da certidão; sem certidão vale 23h59min59s", () => {
    const candidatos = [
      cand("Ana", 30, { data_nascimento: "1985-06-15" }),
      cand("Bia", 30, {
        data_nascimento: "1985-06-15",
        hora_nascimento: "22:10",
      }),
    ];
    const r = preliminar(candidatos);
    expect(geral(r)).toBe("1 Bia | 2 Ana");
    const bia = r.explicacoes[candidatos[1].analise_id];
    expect(bia.explicacao.join(" ")).toContain(
      "por idade (22h10min00s pela certidão × 23h59min59s, sem certidão)",
    );
    expect(bia.horaDecide).toBe(true);
    expect(bia.horaNascimento).toBe("22:10:00");
    expect(r.explicacoes[candidatos[0].analise_id].horaDecide).toBe(true);
    const aviso = r.avisos.filter((a) => a.codigo === "HORA_DE_NASCIMENTO");
    expect(aviso).toHaveLength(1);
    expect(aviso[0].tom).toBe("warning");
    expect(aviso[0].texto).toContain("15/06/1985");
  });

  it("mesmo dia e as duas sem certidão: empate até o fim, na mesma posição (o edital não define)", () => {
    const candidatos = [cand("Ana", 30), cand("Bia", 30)];
    const r = preliminar(candidatos);
    expect(geral(r)).toBe("1 Ana | 1 Bia");
    expect(
      r.explicacoes[candidatos[0].analise_id].explicacao.join(" "),
    ).toContain("Empate final: mesma posição.");
  });

  it("as duas com a hora da certidão: a mais velha (nasceu mais cedo) vem antes", () => {
    const candidatos = [
      cand("Ana", 30, { hora_nascimento: "08:00:00" }),
      cand("Bia", 30, { hora_nascimento: "07:59:59" }),
    ];
    const r = preliminar(candidatos);
    expect(geral(r)).toBe("1 Bia | 2 Ana");
    expect(r.avisos.find((a) => a.codigo === "HORA_DE_NASCIMENTO")?.tom).toBe(
      "info",
    );
  });
});

describe("lista preliminar do 93/2026 — nota mínima, eliminados e vagas", () => {
  it("nota mínima 15 (8.2.6): 15 fica; 14,99 sai; reprovado na planilha sai com o motivo", () => {
    const candidatos = [
      cand("Ana", 15),
      cand("Bia", "14,99"),
      cand("Caio", 10, { status: "Reprovado", etapa: "Reprovado" }),
      cand("Davi", 45, { status: "Reprovado", etapa: "Reprovado" }),
    ];
    const r = preliminar(candidatos);
    expect(geral(r)).toBe("1 Ana");
    const elim = Object.fromEntries(
      r.vagas[0].eliminados.map((e) => [e.nome, [e.motivo, e.detalhe]]),
    );
    expect(elim.Bia[0]).toBe("ABAIXO_NOTA_MINIMA_DOCUMENTAL");
    expect(elim.Caio).toEqual([
      "NAO_HABILITADO",
      "Situação na análise: Reprovado. Nota 10,00, abaixo do mínimo de 15,00.",
    ]);
    // Reprovado com nota alta: não comprovou o requisito (8.2.1).
    expect(elim.Davi).toEqual([
      "NAO_HABILITADO",
      "Situação na análise: Reprovado.",
    ]);
  });

  it("vaga de 2 vagas (1 AC + 1 PP) só com reprovado: sem aptos e 1 eliminado", () => {
    const r = classificar({
      tipo: "PRELIMINAR",
      regra: REGRA_93,
      candidatos: [
        cand("Ana", 40, {
          vaga: "900698",
          cargo: "CARGO 1: MÉDICO DO TRABALHO -",
          status: "Reprovado",
          etapa: "Reprovado",
          quadro: "q1",
        }),
      ],
      quadro: [
        {
          id: "q1",
          ordem: 1,
          cargo: "ANALISTA DE GESTÃO: MÉDICO DO TRABALHO (Nível Superior)",
          modalidades: QUADRO_DA_CORRECAO[0].modalidades,
          vagas_imediatas: 2,
          cadastro_reserva: true,
        },
      ],
    });
    const v = r.vagas[0];
    expect(v.geral).toEqual([]);
    expect(v.eliminados).toHaveLength(1);
    expect(v.vagasPorModalidade).toMatchObject({ AC: 1, PP: 1 });
    expect(v.cabecalho).toContain("2 vagas (1 AC + 1 Pretos e pardos + CR)");
  });

  it("Técnico de Segurança (6 vagas): a divisão publicada (3 AC + 1 PcD + 2 PP), não a dos percentuais", () => {
    const candidatos = [cand("Ana", 40)];
    const pelaRegra = preliminar(candidatos, REGRA_93, QUADRO({}));
    expect(pelaRegra.vagas[0].vagasPorModalidade).toEqual({ AC: 4, PP: 2 });
    const corrigido = preliminar(
      candidatos,
      REGRA_93,
      QUADRO(QUADRO_DA_CORRECAO[4].modalidades),
    );
    expect(corrigido.vagas[0].vagasPorModalidade).toMatchObject({
      AC: 3,
      PCD: 1,
      PP: 2,
    });
    expect(corrigido.vagas[0].origemDasVagas).toBe("QUADRO");
  });
});

describe("hora de nascimento (6.11.5 e 6.11.6)", () => {
  it("lê HH:MM e HH:MM:SS; inválida fica de fora", () => {
    expect(lerHora("8:05")).toBe("08:05:00");
    expect(lerHora("23:59:59")).toBe("23:59:59");
    expect(lerHora("24:00")).toBeNull();
    expect(lerHora("")).toBeNull();
    expect(horaBR("07:03:09")).toBe("07h03min09s");
  });

  it("sem hora vale 23:59:59: no mesmo dia, quem tem hora é mais velho", () => {
    const sem = segundosDeVida("1985-06-15", "", "2026-09-29");
    const com = segundosDeVida("1985-06-15", "23:59:58", "2026-09-29");
    expect(com - sem).toBe(1);
    // Um dia antes, mesmo sem hora, é mais velho que qualquer hora do dia seguinte.
    expect(segundosDeVida("1985-06-14", "", "2026-09-29")).toBeGreaterThan(
      segundosDeVida("1985-06-15", "00:00:00", "2026-09-29"),
    );
  });
});
