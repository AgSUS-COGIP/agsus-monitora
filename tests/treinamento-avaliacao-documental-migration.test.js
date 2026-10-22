import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Invariantes da migration 20261008110000 (treinamento da avaliação documental
  com regras de editais verdadeiros): o preparar para Saúde Indígena e Projetos
  com as travas, a regra do 93/2026 copiada sem vínculo, a pré-classificação
  pronta (a mesma do Python: tests/python/test_treinamento_projetos.py), a
  execução fictícia fora dos painéis, só dados fictícios, ensaio e rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261008110000_treinamento_avaliacao_documental.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const FIXTURE = JSON.parse(
  ler("tests/fixtures/avaliacao-documental/treinamento-projetos.json"),
);

/* O corpo de uma função criada na migration (até o $function$/$$ que fecha). */
function corpoDa(nome, texto = MIGRATION) {
  const inicio = texto.search(
    new RegExp(
      `create or replace function (public|private)\\.("?)${nome}\\2\\(`,
      "i",
    ),
  );
  if (inicio < 0) throw new Error(`função ${nome} não está na migration`);
  const resto = texto.slice(inicio);
  const fim = resto.search(/\n(\$function\$|\$\$);?\n/);
  return resto.slice(0, fim);
}

describe("a migration", () => {
  it("transação com lock_timeout; cria os dois editais de treinamento", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(MIGRATION).toContain(
      `select private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');`,
    );
    expect(MIGRATION).toContain(
      `select private."FC_PREPARAR_EDITAL_TREINAMENTO"('projetos');`,
    );
  });
});

describe("o preparar e o reinício", () => {
  const PREPARAR = corpoDa("FC_PREPARAR_EDITAL_TREINAMENTO");
  const REINICIAR = corpoDa("reiniciar_edital_treinamento");

  it("aceita só Saúde Indígena e Projetos, com a trava por área", () => {
    expect(PREPARAR).toContain(
      "if v_area not in ('saude-indigena', 'projetos') then",
    );
    expect(PREPARAR).toContain("pg_advisory_xact_lock");
    expect(PREPARAR).toContain('private."FC_PREPARAR_TREINAMENTO_PROJETOS"');
    expect(PREPARAR).toContain('private."FC_PREPARAR_TREINAMENTO_SI"');
  });

  it("só o service_role chama as funções privadas", () => {
    for (const assinatura of [
      'private."FC_PREPARAR_EDITAL_TREINAMENTO"(text)',
      'private."FC_PREPARAR_TREINAMENTO_SI"(text, text)',
      'private."FC_PREPARAR_TREINAMENTO_PROJETOS"(text, text)',
      'private."FC_REGRA_DO_TREINAMENTO"(uuid, jsonb, text, text, uuid)',
      'private."FC_PRE_CLASSIFICAR_TREINAMENTO"(uuid, jsonb)',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated;`,
      );
    }
  });

  it("reiniciar: admin global, marca e área conferidas ANTES de apagar", () => {
    const apagar = REINICIAR.indexOf(
      'private."FC_APAGAR_DADOS_DO_TREINAMENTO"',
    );
    for (const trava of [
      "if not private.is_master() then",
      `if v_m."ST_TREINAMENTO" is distinct from 'S' then`,
      `not in ('saude-indigena', 'projetos') then`,
    ]) {
      const i = REINICIAR.indexOf(trava);
      expect(i).toBeGreaterThan(0);
      expect(i).toBeLessThan(apagar);
    }
    // Só a linha de treinamento muda; a área volta à do edital.
    for (const update of REINICIAR.split(/\bupdate public\./).slice(1)) {
      expect(update).toMatch(/where id = p_edital and "ST_TREINAMENTO" = 'S'/);
    }
    expect(REINICIAR).toContain(
      'v_id := private."FC_PREPARAR_EDITAL_TREINAMENTO"(v_m."CO_AREA");',
    );
  });

  it("regra copiada e pré-classificação pronta recusam edital real", () => {
    for (const nome of [
      "FC_REGRA_DO_TREINAMENTO",
      "FC_PRE_CLASSIFICAR_TREINAMENTO",
    ]) {
      const corpo = corpoDa(nome);
      expect(corpo).toMatch(
        /if not private\."FC_EDITAL_EH_TREINAMENTO"\(p_edital\) then\s+raise exception [^;]+errcode = '42501'/,
      );
    }
  });

  it("vaga fictícia já usada fora do treinamento ou vinda do robô: recusa", () => {
    for (const nome of [
      "FC_PREPARAR_TREINAMENTO_SI",
      "FC_PREPARAR_TREINAMENTO_PROJETOS",
    ]) {
      const corpo = corpoDa(nome);
      expect(corpo).toContain(
        `where v."CO_MONITORAMENTO" is distinct from v_id or v."CO_SYNC" is not null) then`,
      );
      expect(corpo).toContain("errcode = '23514'");
      // A atualização das respostas nunca toca linha do robô.
      expect(corpo).toMatch(/"CO_SYNC" is null/);
    }
  });
});

describe("Projetos: a regra do 93/2026 e a pré-classificação", () => {
  const PROJETOS = corpoDa("FC_PREPARAR_TREINAMENTO_PROJETOS");
  const regra = JSON.parse(MIGRATION.split("$regra93$")[1]);

  it("a regra é a da entrada do Python, conferida, com o rótulo do treinamento", () => {
    expect(regra).toEqual(FIXTURE.entrada.edital.regra.configuracao);
    expect(regra.edital_rotulo).toBe("Edital 992/2099 (TREINAMENTO)");
    expect(regra.provisoria.base_da_nota).toBe("DECLARADA");
    expect(regra.lote).toMatchObject({
      base: "NOTA_MINIMA",
      nota_minima: 15,
      item_edital: "8.2.6",
    });
    expect(regra.provisoria.eliminacao_automatica.map((e) => e.codigo)).toEqual(
      ["CANCELADO", "QUESTIONARIO"],
    );
    expect(PROJETOS).toContain("'CONFERIDA'");
  });

  it("a cópia não guarda vínculo com a regra real (só o JSON)", () => {
    expect(corpoDa("FC_REGRA_DO_TREINAMENTO")).not.toMatch(
      /select [^;]*from public\."TH_REGRA_ANALISE"[^;]*93\/2026/,
    );
    expect(PROJETOS).not.toMatch(/'93\/2026'/);
    expect(MIGRATION).not.toMatch(/CO_REGRA_ANALISE_ORIGEM|CO_REGRA_ORIGEM/);
  });

  it("grava a pré-classificação calculada pelo Python pelas RPCs do job", () => {
    const pre = corpoDa("FC_PRE_CLASSIFICAR_TREINAMENTO");
    for (const rpc of [
      "public.gravar_pre_classificacao_vaga(",
      "public.abrir_fichas_pre_classificacao(",
      "public.finalizar_pre_classificacao(",
    ]) {
      expect(pre).toContain(rpc);
    }
    expect(pre).toContain("'treinamento-' || p_edital::text");
    expect(FIXTURE.resultado.edital).toMatchObject({
      inscritos: 40,
      eliminados: 11,
      no_lote: 21,
    });
  });

  it("40 fictícios: nomes de teste, e-mail @exemplo.invalid, sem CPF", () => {
    expect(PROJETOS).toContain(
      "'Candidato Teste P' || lpad(c.n::text, 2, '0')",
    );
    expect(PROJETOS).toContain("'@exemplo.invalid'");
    expect(PROJETOS).toMatch(/x\.nome, x\.email, null,/);
    const cpfs = new Set(
      MIGRATION.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/g) || [],
    );
    expect([...cpfs]).toEqual(["000.000.000-00"]);
    const emails = MIGRATION.match(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g) || [];
    expect(emails.every((e) => e.endsWith("exemplo.invalid"))).toBe(true);
  });
});

describe("fora dos painéis", () => {
  it("o painel dos robôs e o Status das atualizações não leem a execução do treinamento", () => {
    for (const nome of ["get_painel_dos_robos", "get_saude_das_cargas"]) {
      expect(corpoDa(nome)).toContain(
        'from public."TL_PRE_CLASSIFICACAO" t where not private."FC_EXECUCAO_EH_TREINAMENTO"(t."CO_EXECUCAO")',
      );
    }
    expect(corpoDa("FC_EXECUCAO_EH_TREINAMENTO")).toContain(
      "like 'treinamento-%'",
    );
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio tira o retrato real, aplica, confere E1 a E7 e termina em rollback", () => {
    expect(
      ENSAIO.indexOf("create temporary table tmp_ensaio_real"),
    ).toBeLessThan(ENSAIO.indexOf("═══ A MIGRATION"));
    for (let n = 1; n <= 7; n++) expect(ENSAIO).toContain(`FALHOU E${n}`);
    expect(ENSAIO).not.toMatch(/\ncommit;\n/);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("o rollback apaga só o treinamento de Projetos e tira as funções novas", () => {
    expect(ROLLBACK).toMatch(
      /where m\."ST_TREINAMENTO" = 'S' and m\."CO_AREA" = 'projetos'/,
    );
    expect(ROLLBACK).toContain(
      `delete from public."TB_MONITORAMENTO_INDIGENA" where id = v_id and "ST_TREINAMENTO" = 'S';`,
    );
    for (const nome of [
      "FC_PREPARAR_TREINAMENTO_PROJETOS",
      "FC_PREPARAR_TREINAMENTO_SI",
      "FC_PRE_CLASSIFICAR_TREINAMENTO",
      "FC_REGRA_DO_TREINAMENTO",
      "FC_TREINO_INSCRICAO",
      "FC_TREINO_RESPOSTA",
      "FC_TREINO_COLUNAS",
      "FC_EXECUCAO_EH_TREINAMENTO",
    ]) {
      expect(ROLLBACK).toContain(`drop function if exists private."${nome}"`);
    }
    expect(corpoDa("FC_PREPARAR_EDITAL_TREINAMENTO", ROLLBACK)).toContain(
      "if v_area <> 'saude-indigena' then",
    );
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });
});
