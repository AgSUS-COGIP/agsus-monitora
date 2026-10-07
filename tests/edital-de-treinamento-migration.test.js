import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Invariantes da migration 20261007230000 (edital de treinamento): o
  predicado nas funções de indicador, painel, cache, conferência e robô; o
  reinício que nunca toca edital real; ensaio e rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007230000_edital_de_treinamento.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

/* O corpo de uma função criada na migration (até o $function$/$$ que fecha). */
function corpoDa(nome) {
  const inicio = MIGRATION.search(
    new RegExp(
      `create or replace function (public|private)\\.("?)${nome}\\2\\(`,
      "i",
    ),
  );
  if (inicio < 0) throw new Error(`função ${nome} não está na migration`);
  const resto = MIGRATION.slice(inicio);
  const fim = resto.search(/\n(\$function\$|\$\$);\n/);
  return resto.slice(0, fim);
}

const PREDICADO = /private\."FC_(EH|EDITAL_EH|ANALISE_EH)_TREINAMENTO"\(/;

describe("a marca", () => {
  it("ST_TREINAMENTO S/N, padrão N, com CHECK", () => {
    expect(MIGRATION).toMatch(
      /add column if not exists "ST_TREINAMENTO" character varying\(1\) not null default 'N'/,
    );
    expect(MIGRATION).toContain(`check ("ST_TREINAMENTO" in ('S', 'N'))`);
  });

  it("transação, com lock_timeout", () => {
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION).toContain("set local lock_timeout");
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
  });
});

describe("o predicado em todos os pontos", () => {
  const FORA = [
    "listar_acompanhamento_da_visao_geral",
    "FC_MONTAR_ENTREVISTAS_AREA",
    "FC_MONTAR_APROVADOS_AREA",
    "listar_candidatos_aprovados_compacto",
    "conferencia_ler_analises",
    "conferencia_ler_entrevistas",
    "conferencia_ler_classificacao",
    "conferencia_ler_aprovados",
    "listar_vagas_empregare",
    "pre_classificacao_ler_editais",
    "finalizar_sync_analises_lotes",
  ];
  const COM_SELO = [
    "listar_editais_entrevista",
    "obter_entrevistas_do_edital",
    "listar_editais_avaliacao",
    "listar_editais_classificacao",
    "FC_DADOS_CLASSIFICACAO_EDITAL",
    "obter_pre_classificacao",
    "get_painel_dos_robos",
  ];

  it.each(FORA)("%s aplica o predicado", (nome) => {
    expect(corpoDa(nome)).toMatch(PREDICADO);
  });

  it.each(COM_SELO)("%s devolve a marca 'treinamento'", (nome) => {
    const corpo = corpoDa(nome);
    expect(corpo).toContain("'treinamento'");
    expect(corpo).toMatch(PREDICADO);
  });

  it("as views dos indicadores e do painel das análises filtram; a operacional ganha a coluna", () => {
    const view = (nome) => {
      const i = MIGRATION.indexOf(`create or replace view public."${nome}"`);
      expect(i, nome).toBeGreaterThan(-1);
      return MIGRATION.slice(i, MIGRATION.indexOf(";\n", i));
    };
    for (const nome of [
      "VW_MONITORAMENTO_INDIGENA_KPIS",
      "VW_MONITORAMENTO_INDIGENA_POR_EDITAL",
      "VW_MONITORAMENTO_INDIGENA_POR_UNIDADE",
    ])
      expect(view(nome)).toContain(
        `NOT private."FC_EH_TREINAMENTO"("ST_TREINAMENTO")`,
      );
    expect(view("VW_ANALISES_DASHBOARD_BASE_TODOS")).toContain(
      `WHERE NOT private."FC_ANALISE_EH_TREINAMENTO"(a.origem_planilha)`,
    );
    expect(view("VW_MONITORAMENTO_INDIGENA_OPERACIONAL")).toContain(
      `m."ST_TREINAMENTO"`,
    );
    expect(view("VW_MONITORAMENTO_INDIGENA_OPERACIONAL")).not.toMatch(
      PREDICADO,
    );
    for (const nome of [
      "VW_MONITORAMENTO_INDIGENA_KPIS",
      "VW_ANALISES_DASHBOARD_BASE_TODOS",
    ])
      expect(view(nome)).toContain("with (security_invoker = true)");
  });

  it("fora das funções de predicado, a marca só é lida direto pelo preparar e pelo reiniciar", () => {
    const codigo = MIGRATION.replace(/\/\*[\s\S]*?\*\//g, "");
    const usos = [...codigo.matchAll(/"ST_TREINAMENTO" = 'S'/g)].map(
      (m) => m.index,
    );
    const dentro = (nome, i) => {
      const inicio = codigo.indexOf(corpoDa(nome).slice(0, 80));
      return i > inicio && i < inicio + corpoDa(nome).length;
    };
    expect(usos.length).toBeGreaterThan(0);
    for (const i of usos)
      expect(
        dentro("FC_PREPARAR_EDITAL_TREINAMENTO", i) ||
          dentro("reiniciar_edital_treinamento", i),
      ).toBe(true);
  });
});

describe("o reinício nunca toca edital real", () => {
  const APAGAR = corpoDa("FC_APAGAR_DADOS_DO_TREINAMENTO");
  const REINICIAR = corpoDa("reiniciar_edital_treinamento");

  it("o apagar trava a linha e recusa edital real ANTES do primeiro delete", () => {
    const trava = APAGAR.indexOf("for update");
    const recusa = APAGAR.indexOf(
      `if v_m."ST_TREINAMENTO" is distinct from 'S' then`,
    );
    const primeiroDelete = APAGAR.search(/\bdelete from\b/);
    expect(trava).toBeGreaterThan(-1);
    expect(recusa).toBeGreaterThan(trava);
    expect(primeiroDelete).toBeGreaterThan(recusa);
    expect(APAGAR.slice(recusa, recusa + 200)).toContain("errcode = '42501'");
  });

  it("todo delete do apagar é do edital pedido (ou das análises de origem treinamento)", () => {
    const deletes = APAGAR.split(/\bdelete from\b/).slice(1);
    expect(deletes.length).toBeGreaterThan(30);
    for (const d of deletes) {
      const comando = d.slice(0, d.indexOf(";"));
      expect(
        /p_edital|tmp_treino_listas|FC_ANALISE_EH_TREINAMENTO/.test(comando),
        comando,
      ).toBe(true);
    }
    const analises = deletes.find((d) =>
      d.trimStart().startsWith('public."TB_ANALISE_CURRICULAR"'),
    );
    expect(analises).toContain('private."FC_ANALISE_EH_TREINAMENTO"');
    expect(analises).toContain('a."CO_AREA" = v_m."CO_AREA"');
  });

  it("vaga carregada pelo robô da Empregare: recusa", () => {
    expect(APAGAR).toContain(`v."CO_SYNC" is not null) then`);
    expect(APAGAR).toMatch(
      /delete from public\."TB_EMPREGARE_VAGA"[^;]*"CO_SYNC" is null;/,
    );
  });

  it("o RPC é só do admin global, confere a marca e atualiza só a linha de treinamento", () => {
    expect(REINICIAR).toContain("if not private.is_master() then");
    expect(REINICIAR).toContain(
      `if v_m."ST_TREINAMENTO" is distinct from 'S' then`,
    );
    expect(REINICIAR).toContain(
      `where id = p_edital and "ST_TREINAMENTO" = 'S';`,
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.reiniciar_edital_treinamento(uuid) to authenticated, service_role;",
    );
    for (const privada of [
      'private."FC_APAGAR_DADOS_DO_TREINAMENTO"(uuid)',
      'private."FC_PREPARAR_EDITAL_TREINAMENTO"(text)',
    ])
      expect(MIGRATION).toContain(
        `revoke all on function ${privada} from public, anon, authenticated;`,
      );
  });

  it("os gatilhos de imutabilidade só liberam o reinício de um edital de treinamento", () => {
    const permite = corpoDa("FC_REINICIO_TREINAMENTO_PERMITE");
    expect(permite).toContain(
      "current_setting('agsus.reinicio_treinamento', true)",
    );
    expect(permite).toContain('private."FC_EDITAL_EH_TREINAMENTO"(v_edital)');
    expect(permite).toContain(
      "p_linha ->> 'CO_MONITORAMENTO' = v_edital::text",
    );
    for (const gatilho of [
      "FC_TG_FICHA_IMUTAVEL",
      "FC_TG_PRE_CLASSIF_IMUTAVEL",
      "FC_TG_REGRA_ANALISE_IMUTAVEL",
      "FC_TG_AJUSTE_PONTUACAO_IMUTAVEL",
    ]) {
      const i = MIGRATION.indexOf(`private."${gatilho}"()`);
      const corpo = MIGRATION.slice(i, MIGRATION.indexOf("$function$;", i));
      expect(corpo, gatilho).toContain(
        `if tg_op = 'DELETE' and private."FC_REINICIO_TREINAMENTO_PERMITE"(tg_table_name, to_jsonb(old)) then`,
      );
      // O resto do gatilho continua recusando.
      expect(corpo, gatilho).toContain("raise exception");
    }
  });
});

describe("dados fictícios", () => {
  const PREPARAR = corpoDa("FC_PREPARAR_EDITAL_TREINAMENTO");

  it("nomes 'Candidato Teste NN', e-mails @exemplo.invalid, CPF nulo ou inválido", () => {
    expect(PREPARAR).toContain("'Candidato Teste ' || lpad(n::text, 2, '0')");
    expect(PREPARAR).toContain("'@exemplo.invalid'");
    expect(PREPARAR).toContain("'000.000.000-00'");
    expect(PREPARAR).not.toMatch(
      /\b\d{3}\.\d{3}\.\d{3}-\d{2}\b(?<!000\.000\.000-00)/,
    );
    // NU_CPF e cpf_hash vão nulos.
    expect(PREPARAR).toMatch(/x\.nome, x\.email, null,/);
    expect(PREPARAR).toMatch(/c\.vaga, v\.cargo, c\.nome, null,/);
  });

  it("edital com a marca, só Saúde Indígena, análises com origem treinamento", () => {
    expect(PREPARAR).toContain("if v_area <> 'saude-indigena' then");
    expect(PREPARAR).toContain("c_origem constant text := 'treinamento';");
    expect(PREPARAR).toContain(`v_area, 'S')`);
    expect(MIGRATION).toContain(
      `select private."FC_PREPARAR_EDITAL_TREINAMENTO"('saude-indigena');`,
    );
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio aplica, confere E1 a E7 e termina em rollback", () => {
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;$/m);
    for (const n of [1, 2, 3, 4, 5, 6, 7])
      expect(ENSAIO).toContain(`FALHOU E${n}`);
    expect(ENSAIO).toContain("reiniciou edital real");
    expect(ENSAIO).toContain("dado real mudou");
  });

  it("o rollback apaga só o treinamento e tira a coluna", () => {
    expect(ROLLBACK).toContain(
      `delete from public."TB_MONITORAMENTO_INDIGENA" where id = v_id and "ST_TREINAMENTO" = 'S';`,
    );
    expect(ROLLBACK).toContain(
      `alter table public."TB_MONITORAMENTO_INDIGENA" drop column if exists "ST_TREINAMENTO";`,
    );
    expect(ROLLBACK).toContain(
      'grant select on public."VW_MONITORAMENTO_INDIGENA_OPERACIONAL" to authenticated;',
    );
    expect(ROLLBACK).not.toContain('FC_EH_TREINAMENTO"("ST_TREINAMENTO")');
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });
});
