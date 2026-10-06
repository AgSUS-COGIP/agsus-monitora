import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { calcularAvaliacao } from "../src/lib/avaliacao-documental/pontuacao.js";
import {
  preClassificarVaga,
  tamanhoDoLote,
} from "../src/lib/avaliacao-documental/pre-classificacao.js";
import {
  normalizarRegraAnalise,
  validarRegraAnalise,
} from "../src/lib/avaliacao-documental/regra.js";

/*
  Modelos da regra lidos dos editais recentes (91, 93, 100, 109, 111 e
  114/2026): docs/analises-no-monitora/regras-dos-editais-recentes.md.
  Os JSON de tests/fixtures/avaliacao-documental/modelos/ são a fonte dos
  testes (aqui e no pytest) e têm de ser iguais aos das correções.
*/
const ler = (caminho) => readFileSync(caminho, "utf8");
const MODELOS_SI = ["SI26-100", "SI26-ALSE", "SI26-MRSA", "SI26-PARINTINS"];
const DEPOIS_DA_F3 = ["PROJ26-RIO-DOCE"];
const modelo = (codigo) =>
  JSON.parse(ler(`tests/fixtures/avaliacao-documental/modelos/${codigo}.json`));
const CASOS = JSON.parse(
  ler("tests/fixtures/avaliacao-documental/casos-dos-modelos-recentes.json"),
);

const modelosDaCorrecao = (arquivo) =>
  Object.fromEntries(
    [
      ...ler(`supabase/correcoes/${arquivo}`).matchAll(
        /\('([A-Z0-9-]+)', '(?:[^']|'')*', \$modelo\$(.*?)\$modelo\$::jsonb\)/g,
      ),
    ].map((m) => [m[1], JSON.parse(m[2])]),
  );
const SI = modelosDaCorrecao("20261006-modelos-dos-editais-recentes.sql");
const RIO_DOCE = modelosDaCorrecao("20261006-modelo-proj26-rio-doce.sql");

describe("correções dos modelos dos editais recentes", () => {
  it("a da Saúde Indígena traz os quatro modelos, iguais aos JSON", () => {
    expect(Object.keys(SI).sort()).toEqual(MODELOS_SI);
    for (const codigo of MODELOS_SI) {
      expect(SI[codigo]).toEqual(modelo(codigo));
      expect(SI[codigo].modelo).toBe(codigo);
    }
  });

  it("a do Rio Doce traz o PROJ26-RIO-DOCE e avisa que é depois da F3", () => {
    expect(Object.keys(RIO_DOCE)).toEqual(DEPOIS_DA_F3);
    expect(RIO_DOCE["PROJ26-RIO-DOCE"]).toEqual(modelo("PROJ26-RIO-DOCE"));
    expect(
      ler("supabase/correcoes/20261006-modelo-proj26-rio-doce.sql"),
    ).toMatch(/^\/\*\s+APLICAR DEPOIS DA F3\./);
  });

  it.each([
    "20261006-modelos-dos-editais-recentes.sql",
    "20261006-modelo-proj26-rio-doce.sql",
  ])("%s é idempotente, valida no banco e fecha a transação", (arquivo) => {
    const sql = ler(`supabase/correcoes/${arquivo}`);
    expect(sql).toContain('on conflict ("CO_MODELO") do update');
    expect(sql).toContain(
      'perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");',
    );
    expect(sql).toMatch(/^begin;$/m);
    expect(sql).toMatch(/^commit;$/m);
  });
});

describe("os modelos passam na validação da regra", () => {
  it.each(MODELOS_SI)("%s é válido", (codigo) => {
    expect(validarRegraAnalise(modelo(codigo))).toEqual([]);
  });

  it("o PROJ26-RIO-DOCE só depende do que a F3 acrescenta (lote por nota mínima e desempates)", () => {
    const m = modelo("PROJ26-RIO-DOCE");
    expect(m.lote.base).toBe("NOTA_MINIMA");
    expect(m.provisoria.desempate).toEqual([
      "IDOSO",
      "EXPERIENCIA_DECLARADA",
      "MAIOR_IDADE",
    ]);
    const semF3 = {
      ...m,
      lote: { ...m.lote, base: "MULTIPLO_VAGAS", multiplo: 3 },
      provisoria: { ...m.provisoria, desempate: ["IDOSO"] },
    };
    expect(validarRegraAnalise(semF3)).toEqual([]);
  });
});

describe("o que o edital oficial pede, conferido nos modelos", () => {
  const bloco = (codigo, b) =>
    modelo(codigo).blocos.find((x) => x.codigo === b);

  it("Saúde Indígena: étnico 8 + 6, Anexo VI irregular zera (não elimina), aldeia sem lista", () => {
    for (const codigo of MODELOS_SI) {
      const etnico = bloco(codigo, "ETNICO");
      expect([etnico.indigena, etnico.aldeia, etnico.teto]).toEqual([8, 6, 14]);
      expect(etnico.efeitos.NAO_CONFORME).toBe("ZERA_PONTOS");
      expect(etnico.lista_aldeias).toBeNull();
    }
  });

  it("Saúde Indígena: títulos cumulativos até 6, experiência 0,2/mês até 10, sem cursos", () => {
    for (const codigo of MODELOS_SI) {
      const formacao = bloco(codigo, "FORMACAO");
      expect([formacao.cumulativa, formacao.teto]).toEqual([true, 6]);
      const exp = bloco(codigo, "EXPERIENCIA");
      expect([exp.pontos_por_mes, exp.teto]).toEqual([0.2, 10]);
      expect(exp.estagio_indigena.so_sem_experiencia).toBe(false);
      expect(modelo(codigo).blocos.some((b) => b.tipo === "CURSOS")).toBe(
        false,
      );
    }
  });

  it("mínimo de experiência, estágio e nível fundamental de cada edital", () => {
    const resumo = (codigo) => {
      const exp = bloco(codigo, "EXPERIENCIA");
      return [
        exp.minimo_meses,
        exp.estagio_indigena.horas_por_dia,
        Boolean(bloco(codigo, "FORMACAO").pontos_por_nivel.fundamental),
      ];
    };
    expect(resumo("SI26-100")).toEqual([6, 8, false]);
    expect(resumo("SI26-ALSE")).toEqual([3, 8, true]);
    expect(resumo("SI26-PARINTINS")).toEqual([3, 4, true]);
    expect(resumo("SI26-MRSA")).toEqual([6, 4, true]);
  });

  it("SI26-100 corrigido mantém as perguntas do questionário e a nota declarada", () => {
    const m = modelo("SI26-100");
    expect(bloco("SI26-100", "ETNICO").perguntas).toEqual([
      "Pergunta 6 -",
      "Pergunta 7 -",
    ]);
    expect(bloco("SI26-100", "GRADUACAO").perguntas).toEqual([
      "Pergunta 13 -",
      "Pergunta 14 -",
    ]);
    expect(m.provisoria.nota_declarada).toHaveLength(2);
    expect(m.provisoria.eliminacao_automatica.map((e) => e.codigo)).toContain(
      "TERMO",
    );
  });

  it("Rio Doce: 5 pontos por bloco de 6 meses e máximo de 35 em todos os níveis", () => {
    const exp = bloco("PROJ26-RIO-DOCE", "EXPERIENCIA");
    expect(exp.por_nivel).toBeUndefined();
    expect([exp.pontos_por_periodo, exp.teto, exp.desconta_minimo]).toEqual([
      5,
      35,
      true,
    ]);
    expect(
      modelo("PROJ26-RIO-DOCE").blocos.find((b) => b.tipo === "PONTUACAO"),
    ).toBeUndefined();
  });
});

describe("casos dourados de pontuação", () => {
  it.each(CASOS.pontuacao.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
    const r = calcularAvaliacao(
      modelo(caso.modelo),
      caso.candidato,
      caso.opcoes,
    );
    const e = caso.esperado;
    expect(r.resultado).toBe(e.resultado);
    expect(r.nota_apurada).toBe(e.nota_apurada);
    expect(r.nota_final).toBe(e.nota_final);
    expect(r.parciais).toEqual(e.parciais);
    expect(r.eliminatorios).toEqual(e.eliminatorios);
    expect(r.encaminhamentos).toEqual(e.encaminhamentos);
    const {
      meses,
      meses_estagio,
      meses_considerados,
      pontos,
      abaixo_do_minimo,
    } = r.experiencia;
    expect({
      meses,
      meses_estagio,
      meses_considerados,
      pontos,
      abaixo_do_minimo,
    }).toEqual(e.experiencia);
  });
});

describe("lote e Provisória (os mesmos casos no pytest)", () => {
  it.each(CASOS.lote.map((c) => [`${c.modelo} ${c.vaga.codigo}`, c]))(
    "%s",
    (_nome, caso) => {
      const lote = normalizarRegraAnalise(modelo(caso.modelo)).lote;
      const { tamanho, descricao, aviso } = tamanhoDoLote(lote, caso.vaga);
      expect({ tamanho, descricao, aviso }).toEqual(caso.esperado);
    },
  );

  it.each(CASOS.provisoria.map((c) => [c.nome, c]))("%s", (_nome, caso) => {
    const r = preClassificarVaga({
      regra: normalizarRegraAnalise(modelo(caso.modelo)),
      vaga: CASOS.provisoria_vaga,
      candidatos: CASOS.provisoria_candidatos,
      anterior: {},
      ultimo_lote: 0,
      refazer: false,
      hoje: CASOS.hoje,
    });
    expect(Object.fromEntries(r.linhas.map((l) => [l.id, l.posicao]))).toEqual(
      caso.esperado,
    );
  });
});
