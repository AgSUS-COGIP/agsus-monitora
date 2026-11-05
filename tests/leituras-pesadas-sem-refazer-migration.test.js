import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Leituras pesadas sem refazer o que não mudou (20261103171500): a fila e o
  monitoramento operacional pela marca barata, a contagem das listas pelo
  índice, os municípios sem a expressão regular por par e o pacote dos
  aprovados só vencido por mudança no que ele mostra. O ensaio no banco prova
  payload igual antes e depois; aqui, o que dá para conferir no arquivo — e a
  trava para quem mudar depois uma função do fecho das leituras novas.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261103171500_leituras_pesadas_sem_refazer.sql";
const migration = ler(`supabase/migrations/${NOME}`);
const ensaio = ler(`supabase/ensaios/${NOME}`);
const rollback = ler(`supabase/rollback/${NOME}`);

const corpo = (sql, assinatura) => {
  const inicio = sql.indexOf(`create or replace function ${assinatura}`);
  expect(inicio, assinatura).toBeGreaterThanOrEqual(0);
  // O corpo vai do create até a linha que fecha o dólar ($$ ou $function$).
  const fim = sql.indexOf("\n$", sql.indexOf("$", inicio) + 2);
  return sql.slice(inicio, fim);
};

/* As funções que a migration troca (a guarda e o rollback conhecem as seis). */
const TROCADAS = [
  "obter_fila_avaliacao_desde",
  "listar_listas_aprovados",
  "listar_municipios_das_vagas_da_area",
  "listar_monitoramento_operacional",
  "FC_TG_CACHE_CANDIDATO_APROVADO",
  "FC_TG_CACHE_LISTA_APROVADO",
];

/*
  O fecho das duas leituras novas (fila_avaliacao e monitoramento_operacional)
  que não estava no fecho das leituras de 20261029170000: quem mudar uma delas
  roda private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"() na mesma migration.
*/
const FECHO_NOVO = [
  "FC_FILA_AVALIACAO_JSON",
  "FC_LINHAS_DA_FILA",
  "FC_ANALISTAS_DO_EDITAL",
  "FC_DISTRIBUICAO_DO_EDITAL",
  "FC_FILTROS_FILA_JSON",
  "FC_NO_NUCLEO_DA_FILA",
  "FC_PODE_ANALISAR_VAGA",
  "FC_PRAZO_RESERVA_FICHA",
  "FC_ROTULO_DO_EDITAL",
  "FC_VAGAS_DO_ANALISTA",
  "FC_MARCA_DO_MONITORAMENTO_OPERACIONAL",
  "get_monitoramento_cronograma_estado",
  "has_perm",
  "listar_monitoramento_operacional",
  "VW_MONITORAMENTO_INDIGENA_OPERACIONAL",
];

describe(NOME, () => {
  it("numa transação, com a guarda das seis funções de antes e sem drop", () => {
    expect(migration.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    expect(migration).toContain(
      "Função(ões) diferente(s) da que esta migration conhece",
    );
    for (const nome of TROCADAS) expect(migration).toContain(`'${nome}', '`);
    expect(migration).not.toMatch(/\bdrop\s+(table|function|trigger|index)\b/i);
  });

  it("fila: a marca barata e as reservas vencidas são conferidas antes de montar", () => {
    const fila = corpo(migration, "public.obter_fila_avaliacao_desde(");
    const barata = fila.indexOf(
      `private."FC_MARCA_DA_LEITURA"('fila_avaliacao', p_edital::text)`,
    );
    const reservas = fila.indexOf(`f."DT_RESERVA_EXPIRA" <= now()`);
    const vazia = fila.indexOf("'candidatos', '[]'::json, 'saiu', '[]'::json");
    const montagem = fila.indexOf('private."FC_FILA_AVALIACAO_JSON"(');
    const md5 = fila.indexOf("select md5(concat_ws('|', count(*)");
    expect(
      fila.indexOf('perform private."FC_EXIGIR_AVALIACAO_EDITAL"'),
    ).toBeLessThan(barata);
    expect(barata).toBeGreaterThan(0);
    expect(reservas).toBeGreaterThan(barata);
    expect(vazia).toBeGreaterThan(reservas);
    expect(md5).toBeGreaterThan(vazia);
    expect(montagem).toBeGreaterThan(md5);
    // A marca de sempre segue sendo a primeira parte; a que sai leva a barata e o total.
    expect(fila).toContain("v_partes[1] is distinct from v_marca");
    expect(fila).toContain(
      "v_marca := v_marca || '.' || v_barata || '.' || v_total::text;",
    );
  });

  it("monitoramento: inalterado pela marca antes de montar; sem fontes, FC_SE_MUDOU", () => {
    const m = corpo(migration, "public.listar_monitoramento_operacional(");
    const marca = m.indexOf(
      'private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"()',
    );
    const inalterado = m.indexOf("'inalterado', true");
    const view = m.indexOf('"VW_MONITORAMENTO_INDIGENA_OPERACIONAL"');
    expect(marca).toBeGreaterThan(0);
    expect(inalterado).toBeGreaterThan(marca);
    expect(view).toBeGreaterThan(inalterado);
    expect(m).toContain('return private."FC_SE_MUDOU"(v_payload, p_versao);');
    // security invoker (a RLS de quem lê); a marca com a data de hoje.
    expect(m).not.toMatch(/security definer/i);
    const marcaFn = corpo(
      migration,
      'private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"(',
    );
    expect(marcaFn).toContain("current_date::text");
    expect(marcaFn).toMatch(/security definer/i);
  });

  it("registra as duas leituras e recalcula fontes e gatilhos no fim", () => {
    expect(migration).toContain("('fila_avaliacao',");
    expect(migration).toContain("('monitoramento_operacional',");
    expect(migration).toMatch(
      /select private\."FC_ATUALIZAR_FONTES_DAS_LEITURAS"\(\);\s+notify pgrst/,
    );
  });

  it("listas: contagem pelo índice parcial dos não removidos", () => {
    expect(migration).toMatch(
      /create index if not exists "IN_CANDAPROVADO_LISTAVIVA"\s+on public\."TB_CANDIDATO_APROVADO" \(lista_id\) where removido_em is null;/,
    );
    const l = corpo(migration, "public.listar_listas_aprovados(");
    expect(l).toContain("where c.lista_id = l.id and c.removido_em is null");
    expect(l).not.toMatch(/left join public\."TB_CANDIDATO_APROVADO"/);
  });

  it("municípios: texto de busca uma vez e strpos só sem caractere especial", () => {
    const m = corpo(migration, "public.listar_municipios_das_vagas_da_area(");
    expect(m).toContain("municipio_do_edital as materialized");
    expect(m).toContain("texto_da_analise as materialized");
    expect(m).toContain("(l.especial or strpos(t.texto, l.texto) > 0)");
    expect(m).toContain("x.texto !~ '^[a-z0-9 ''-]*$' as especial");
    expect(m).toContain("a.nome_vaga like '%UBS m%'");
  });

  it("pacote dos aprovados: o UPDATE só marca com mudança nas colunas que ele lê", () => {
    const c = corpo(migration, 'private."FC_TG_CACHE_CANDIDATO_APROVADO"(');
    for (const coluna of [
      "lista_id",
      "cargo",
      "classificacao",
      "nota",
      "nome",
      "modalidade",
      "status",
      "processo_sei",
      "matricula",
      "sub_judice",
      "codigo_vaga",
      "alterado_judicialmente",
      "nota_original",
      "modalidade_original",
      "classificacao_original",
      "removido_em",
    ])
      expect(c).toContain(`n.${coluna}`);
    expect(c).not.toContain("DT_CONVOCACAO");
    const l = corpo(migration, 'private."FC_TG_CACHE_LISTA_APROVADO"(');
    expect(l).toContain(
      "(n.edital_id, n.vigente, n.ativo, n.arquivo_nome, n.importado_em)",
    );
  });

  it("ensaio termina em rollback e confere cada parte; rollback volta as seis", () => {
    expect(ensaio.trim()).toMatch(/rollback;$/);
    expect(ensaio).toContain("p_gatilhos => false");
    for (const etapa of ["E1", "E2", "E3", "E4", "E5", "E6", "E7"])
      expect(ensaio).toContain(`${etapa} reprovado`);
    expect(rollback.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/);
    for (const nome of TROCADAS)
      expect(rollback).toMatch(
        new RegExp(
          `create or replace function (public|private)\\.("${nome}"|${nome})\\(`,
        ),
      );
    expect(rollback).toContain(
      'drop index if exists public."IN_CANDAPROVADO_LISTAVIVA";',
    );
    expect(rollback).toContain(
      'drop function if exists private."FC_MARCA_DO_MONITORAMENTO_OPERACIONAL"();',
    );
    expect(rollback).toContain(
      "('fila_avaliacao', 'monitoramento_operacional')",
    );
    expect(rollback).not.toContain("20261103171500%");
  });
});

describe("quem muda o fecho das leituras novas recalcula as fontes", () => {
  const depois = readdirSync("supabase/migrations").filter(
    (f) => /^\d{14}_.*\.sql$/.test(f) && f.slice(0, 14) > NOME.slice(0, 14),
  );

  it.each(depois.length ? depois : ["(nenhuma)"])("%s", (arquivo) => {
    if (arquivo === "(nenhuma)") return;
    const sql = ler(`supabase/migrations/${arquivo}`);
    const mexe = FECHO_NOVO.filter((nome) =>
      new RegExp(
        `create\\s+(or\\s+replace\\s+)?(function|view|materialized\\s+view)\\s+(public|private)\\.("${nome}"|${nome})(?![A-Za-z0-9_])`,
        "i",
      ).test(sql),
    );
    if (mexe.length) {
      // Na mesma migration, ou numa seguinte que diga "recalcula fontes de <arquivo>".
      const seguinte = depois.find(
        (f) =>
          f > arquivo &&
          ler(`supabase/migrations/${f}`).includes(
            `recalcula fontes de ${arquivo}`,
          ),
      );
      const onde = seguinte ? ler(`supabase/migrations/${seguinte}`) : sql;
      expect(onde, `${arquivo} muda ${mexe.join(", ")}`).toContain(
        'private."FC_ATUALIZAR_FONTES_DAS_LEITURAS"(',
      );
    }
  });
});
