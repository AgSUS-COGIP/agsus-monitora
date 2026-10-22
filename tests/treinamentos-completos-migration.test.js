import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Invariantes da migration 20261009120000 (treinamentos completos): os dois
  editais de treinamento com as duas etapas — Saúde Indígena (991/2099) com a
  avaliação documental pronta (regra do 111/2026 conferida e nomeada, 30
  fictícios, a pré-classificação do Python: tests/python/test_treinamento_saude_indigena.py)
  e Projetos (992/2099) com a entrevista pronta (roteiro do SESMT, banca com
  avaliador por competência, lista de convocação do lote) —, convocados e
  agenda a partir de hoje, as travas do reinício, ensaio e rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009120000_treinamentos_completos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const FIXTURE = JSON.parse(
  ler("tests/fixtures/avaliacao-documental/treinamento-saude-indigena.json"),
);

/* O corpo de uma função criada no texto (até o $function$/$$ que fecha). */
function corpoDa(nome, texto = MIGRATION) {
  const inicio = texto.search(
    new RegExp(
      `create or replace function (public|private)\\.("?)${nome}\\2\\(`,
      "i",
    ),
  );
  if (inicio < 0) throw new Error(`função ${nome} não está no arquivo`);
  const resto = texto.slice(inicio);
  const fim = resto.search(/\n(\$function\$|\$\$);?\n/);
  return resto.slice(0, fim);
}

/* O bloco da pré-classificação gravado no preparar da Saúde Indígena. */
function preDaMigration() {
  const trecho = MIGRATION.split(
    "-- pre-classificacao-do-treinamento-si:inicio",
  )[1].split("-- pre-classificacao-do-treinamento-si:fim")[0];
  return JSON.parse(trecho.split("$pre$")[1]);
}

describe("a migration", () => {
  it("transação com lock_timeout, pré-requisitos e os dois editais preparados", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      `select private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');`,
    );
    expect(MIGRATION).toContain(
      `select private."FC_PREPARAR_EDITAL_TREINAMENTO"('projetos');`,
    );
    expect(MIGRATION).toContain("Aplique antes 20261008170000");
  });

  it("o preparar chama a entrevista de Projetos e a agenda nos dois", () => {
    const preparar = corpoDa("FC_PREPARAR_EDITAL_TREINAMENTO");
    expect(preparar).toContain(
      "if v_area not in ('saude-indigena', 'projetos') then",
    );
    expect(preparar).toContain("pg_advisory_xact_lock");
    expect(preparar).toContain(
      'perform private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(v_id);',
    );
    expect(preparar).toContain(
      'perform private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(v_id);',
    );
  });

  it("só o service_role chama as funções privadas", () => {
    for (const assinatura of [
      'private."FC_PREPARAR_TREINAMENTO_SI"(text, text)',
      'private."FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS"(uuid)',
      'private."FC_CONVOCAR_E_AGENDAR_TREINAMENTO"(uuid)',
      'private."FC_PREPARAR_EDITAL_TREINAMENTO"(text)',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated;`,
      );
    }
  });
});

describe("as travas", () => {
  it("reiniciar: admin global, marca e área conferidas ANTES de apagar", () => {
    const reiniciar = corpoDa("reiniciar_edital_treinamento");
    const apagar = reiniciar.indexOf(
      'private."FC_APAGAR_DADOS_DO_TREINAMENTO"',
    );
    for (const trava of [
      "if not private.is_master() then",
      `if v_m."ST_TREINAMENTO" is distinct from 'S' then`,
      `not in ('saude-indigena', 'projetos') then`,
    ]) {
      const i = reiniciar.indexOf(trava);
      expect(i).toBeGreaterThan(0);
      expect(i).toBeLessThan(apagar);
    }
    for (const update of reiniciar.split(/\bupdate public\./).slice(1)) {
      expect(update).toMatch(/where id = p_edital and "ST_TREINAMENTO" = 'S'/);
    }
    expect(reiniciar).toContain("inscritos = 30, aptos_analise = 30");
  });

  it("as funções novas recusam edital real (42501) antes de gravar", () => {
    for (const nome of [
      "FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS",
      "FC_CONVOCAR_E_AGENDAR_TREINAMENTO",
    ]) {
      const corpo = corpoDa(nome);
      const trava = corpo.search(
        /if not private\."FC_EDITAL_EH_TREINAMENTO"\(p_edital\)/,
      );
      expect(trava).toBeGreaterThan(0);
      expect(corpo.indexOf("insert into", trava)).toBeGreaterThan(trava);
      expect(corpo.slice(trava, corpo.indexOf("insert into"))).toContain(
        "errcode = '42501'",
      );
    }
  });

  it("vaga fictícia já usada fora do treinamento ou do robô: recusa", () => {
    const si = corpoDa("FC_PREPARAR_TREINAMENTO_SI");
    expect(si).toContain(
      `where v."CO_MONITORAMENTO" is distinct from v_id or v."CO_SYNC" is not null) then`,
    );
    expect(si).toContain("errcode = '23514'");
    expect(si).toMatch(/"CO_SYNC" is null/);
  });

  it("nada novo é lido fora do edital: só tabelas do próprio edital de treinamento", () => {
    const convocar = corpoDa("FC_CONVOCAR_E_AGENDAR_TREINAMENTO");
    expect(convocar).toContain(
      'private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)',
    );
    const entrevista = corpoDa("FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS");
    expect(entrevista).toContain(
      'private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)',
    );
    expect(entrevista).toContain('p."CO_MONITORAMENTO" = p_edital');
  });
});

describe("Saúde Indígena: avaliação documental pronta", () => {
  const SI = corpoDa("FC_PREPARAR_TREINAMENTO_SI");

  it("a regra do 111/2026 conferida e nomeada, com a pré-classificação", () => {
    expect(SI).toContain(
      `private."FC_REGRA_DO_TREINAMENTO"(v_id, v_config_analise, 'CONFERIDA',`,
    );
    expect(SI).toContain(
      "c_nome_regra constant text := 'SI26-PARINTINS — Edital 111/2026';",
    );
    expect(SI).toContain(`set "NO_VERSAO" = c_nome_regra`);
    expect(SI).toContain(
      'perform private."FC_PRE_CLASSIFICAR_TREINAMENTO"(v_id, c_pre);',
    );
    // A que estava em Conferir só é conferida sem pré-classificação.
    expect(SI).toMatch(
      /"TP_SITUACAO" = 'CONFERIDA'[\s\S]+not exists \(select 1 from public\."TB_PRE_CLASSIFICACAO" p where p\."CO_MONITORAMENTO" = v_id\)/,
    );
  });

  it("a pré-classificação gravada é a do Python", () => {
    expect(preDaMigration()).toEqual(FIXTURE.resultado);
    expect(FIXTURE.resultado.edital).toMatchObject({
      vagas: 3,
      inscritos: 30,
      eliminados: 4,
      no_lote: 24,
    });
  });

  it("30 fictícios com casos variados; análises só dos 15 da entrevista", () => {
    const linhas = SI.match(/^\s+\((\d\d|\s\d), '990991000\d'/gm) || [];
    expect(linhas).toHaveLength(30);
    for (const caso of [
      "'CANCELADO'",
      "'PENDENTE'",
      "'EM ANDAMENTO'",
      "'\"Pretos ou pardos\"'",
      "'\"Pessoa com deficiência (PcD)\"'",
      "'\"Quilombolas\"'",
      "'SIM'",
    ]) {
      expect(SI).toContain(caso);
    }
    expect(SI).toMatch(/where c\.nota is not null\n\s+on conflict/);
    expect(SI).toContain("'Candidato Teste ' || lpad(x.n::text, 2, '0')");
    const cpfs = new Set(
      MIGRATION.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g) || [],
    );
    expect([...cpfs]).toEqual(["000.000.000-00"]);
    const emails = MIGRATION.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || [];
    expect(emails.every((e) => e.endsWith("exemplo.invalid"))).toBe(true);
  });
});

describe("Projetos: entrevista pronta", () => {
  const P = corpoDa("FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS");

  it("roteiro de exemplo do SESMT (FAIXA 0–2, sem aspectos), secretaria e banca", () => {
    expect(P).toContain("'Treinamento — Entrevista Projetos (exemplo)'");
    expect(P).toContain("'Análise Comportamental', 'FAIXA', 0.5");
    expect(P.match(/'PERCENTUAL', '(INDIVIDUAL|GRUPO)'\)/g)).toHaveLength(4);
    expect(P).not.toContain("TB_ROTEIRO_ASPECTO");
    expect(P).toContain("c_banca, 'SECRETARIA', v_uid");
    expect(P).toContain("'Avaliador Teste P3', 'CONDISI', 1");
    expect(P).toContain(`k."NO_COMPETENCIA" = 'Habilidade intercultural'`);
  });

  it("a lista de convocação vem do lote da pré-classificação, e a janela é liberada", () => {
    expect(P).toContain(`p."TP_SITUACAO" in ('NO_LOTE', 'ANALISADO')`);
    expect(P).toContain(`'CONVOCACAO', v_regra_classif, v_versao_classif`);
    expect(P).toContain('insert into public."TB_ENTREVISTA_LIBERACAO"');
  });
});

describe("convocados e agenda a partir de hoje", () => {
  const C = corpoDa("FC_CONVOCAR_E_AGENDAR_TREINAMENTO");

  it("convoca como convocar_para_entrevista, sem mexer no que já existe", () => {
    expect(C).toContain(`'sistema', 'sistema|' || p_edital || '|' || a.id`);
    expect(C).toContain('private."FC_CONVOCADOS_DA_LISTA"(v_lista)');
    expect(C).toContain(`on conflict ("DS_CHAVE_ORIGEM") do nothing`);
    expect(C).toMatch(
      /if not exists \(select 1 from public\."TB_AGENDA_ENTREVISTA" g where g\."CO_MONITORAMENTO" = p_edital\)/,
    );
  });

  it("6 hoje, as demais nos dias úteis seguintes, regra validada", () => {
    expect(C).toContain("when o.i < 6 then v_dias[1]");
    expect(C).toContain("extract(isodow from g) < 6");
    expect(C).toContain('perform private."FC_VALIDAR_REGRA_AGENDA"(v_config);');
    expect(C).toContain("'GERAR'");
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio tira o retrato real, aplica a migration inteira, confere E1 a E6 e termina em rollback", () => {
    expect(
      ENSAIO.indexOf("create temporary table tmp_ensaio_real"),
    ).toBeLessThan(ENSAIO.indexOf("═══ A MIGRATION"));
    for (let n = 1; n <= 6; n++) expect(ENSAIO).toContain(`FALHOU E${n}`);
    // A migration vai inteira (sem begin/commit) no ensaio.
    const corpo = MIGRATION.split("\n")
      .filter((l) => !/^\s*(begin|commit)\s*;\s*$/i.test(l))
      .join("\n")
      .trim();
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO).not.toMatch(/\ncommit;\n/);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("o rollback devolve as funções, tira as novas e refaz só o treinamento", () => {
    for (const nome of [
      "FC_PREPARAR_TREINAMENTO_SI",
      "FC_PREPARAR_EDITAL_TREINAMENTO",
      "reiniciar_edital_treinamento",
    ]) {
      expect(() => corpoDa(nome, ROLLBACK)).not.toThrow();
    }
    expect(corpoDa("FC_PREPARAR_TREINAMENTO_SI", ROLLBACK)).toContain(
      "generate_series(1, 15)",
    );
    for (const nome of [
      "FC_CONVOCAR_E_AGENDAR_TREINAMENTO",
      "FC_PREPARAR_ENTREVISTA_TREINAMENTO_PROJETOS",
    ]) {
      expect(ROLLBACK).toContain(`drop function private."${nome}"(uuid);`);
    }
    expect(ROLLBACK).toContain(`where m."ST_TREINAMENTO" = 'S'`);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });
});
