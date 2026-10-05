import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration que faz o robô da Empregare ler as vagas também do quadro de vagas
  do edital (ainda não aplicada: o ensaio begin…rollback está em
  supabase/ensaios/). Aqui, as invariantes estáticas: contrato da lista
  mantido, quadro antes da Seleção sem duplicar, gravação ligada ao edital
  pelo quadro, só service_role, rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261006080000_robo_empregare_vagas_do_quadro.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ANTERIOR = ler("supabase/migrations/20261005170000_robo_empregare.sql");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

const LISTAR =
  "create or replace function public.listar_vagas_empregare(p_editais text[] default null, p_vagas text[] default null, p_limite integer default 60)";
const ABRIR =
  'create or replace function private."FC_EMPREGARE_ABRIR_VAGA"(p_sync text, p_vaga text, p_total integer)';
const DO_QUADRO = 'create function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga text default null)';

describe("robô da Empregare: vagas do quadro do edital", () => {
  it("a lista mantém a assinatura, os filtros e as chaves de antes e ganha a origem", () => {
    const corpo = corpoDaFuncao(MIGRATION, LISTAR);
    expect(corpo).toContain("returns jsonb");
    expect(corpo).toContain("security definer");
    expect(corpo).toContain("set search_path to ''");
    for (const trecho of [
      "least(greatest(coalesce(p_limite, 60), 1), 500)",
      "'Código de vaga inválido: use só dígitos'",
      "'Edital inválido: use o número, como 80/2026'",
      "s.fim_do_cronograma >= current_date - 30",
      'order by ev."DT_ULTIMA_CARGA" nulls first',
    ])
      expect(corpo).toContain(trecho);
    for (const chave of [
      "'vaga'",
      "'edital_id'",
      "'edital'",
      "'unidade'",
      "'cargo'",
      "'area'",
      "'ultima_carga'",
      "'origem'",
    ])
      expect(corpo).toContain(chave);
    for (const origem of ["'quadro'", "'selecao'", "'pedida'"])
      expect(corpo).toContain(origem);
  });

  it("quadro primeiro; a Seleção só entra com código que o quadro não tem", () => {
    const corpo = corpoDaFuncao(MIGRATION, LISTAR);
    expect(corpo).toContain('private."FC_EMPREGARE_VAGAS_DO_QUADRO"()');
    expect(corpo).toMatch(
      /select s\.\* from selecao s where not exists \(select 1 from quadro q where q\.vaga = s\.vaga\)/,
    );
  });

  it("as vagas do quadro vêm do quadro vigente e do vínculo das análises do edital", () => {
    const corpo = corpoDaFuncao(MIGRATION, DO_QUADRO);
    expect(corpo).toContain('public."TB_QUADRO_VAGA_EDITAL"');
    expect(corpo).toContain('q."ST_REGISTRO_ATIVO" = \'S\'');
    expect(corpo).toContain('public."TB_ANALISE_CURRICULAR"');
    expect(corpo).toContain('private."FC_QUADRO_DA_VAGA"(m.id, n.nome_vaga)');
    expect(corpo).toContain('m."CO_AREA" = n.area');
    expect(corpo).toContain("distinct on (l.vaga)");
    expect(corpo).toContain("set search_path to ''");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text) from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      'comment on function private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text) is',
    );
  });

  it("a gravação liga a vaga ao edital pelo quadro e, sem ele, pela Seleção", () => {
    const corpo = corpoDaFuncao(MIGRATION, ABRIR);
    const quadro = corpo.indexOf('private."FC_EMPREGARE_VAGAS_DO_QUADRO"(p_vaga)');
    const selecao = corpo.indexOf('public."TB_SELECAO_VAGA"');
    expect(quadro).toBeGreaterThan(-1);
    expect(selecao).toBeGreaterThan(quadro);
    // A trava e o resto da abertura não mudam.
    const anterior = corpoDaFuncao(
      ANTERIOR,
      'create function private."FC_EMPREGARE_ABRIR_VAGA"',
    );
    const daTrava = (texto) => texto.slice(texto.indexOf("insert into"));
    expect(daTrava(corpo)).toBe(daTrava(anterior));
  });

  it("carga continua só do service_role", () => {
    expect(MIGRATION).toContain(
      "revoke all on function public.listar_vagas_empregare(text[], text[], integer) from public, anon, authenticated;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.listar_vagas_empregare(text[], text[], integer) to service_role;",
    );
    expect(MIGRATION).not.toMatch(/to (anon|authenticated)\b/);
  });

  it("rollback volta os corpos de 20261005170000 e apaga a função do quadro", () => {
    const listarAntes = corpoDaFuncao(
      ANTERIOR,
      "create function public.listar_vagas_empregare(",
    ).replace("create function", "create or replace function");
    const abrirAntes = corpoDaFuncao(
      ANTERIOR,
      'create function private."FC_EMPREGARE_ABRIR_VAGA"',
    ).replace("create function", "create or replace function");
    expect(ROLLBACK).toContain(listarAntes);
    expect(ROLLBACK).toContain(abrirAntes);
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_EMPREGARE_VAGAS_DO_QUADRO"(text);',
    );
    expect(ROLLBACK).not.toContain("drop table");
  });

  it("o ensaio tem o mesmo corpo da migration, confere as duas fontes e volta o papel antes de ler as tabelas", () => {
    const daMigration = corpoDaMigration(MIGRATION, "\nbegin;\n", "\ncommit;");
    const doEnsaio = corpoDaMigration(
      ENSAIO,
      "-- ═══ CORPO DA MIGRATION (início) ═══\n",
      "-- ═══ CORPO DA MIGRATION (fim) ═══",
    );
    expect(doEnsaio).toBe(daMigration);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    for (const marca of [
      "FALHOU E3: vaga das duas fontes duplicou ou faltou",
      "FALHOU E3: vagas do quadro sem origem, edital ou área do quadro",
      "FALHOU E3: lote da vaga só do quadro",
      "FALHOU E5: vagas gravadas sem o edital do quadro",
    ])
      expect(ENSAIO).toContain(marca);
    // Não cria grupo de acesso (só existe um admin global).
    expect(ENSAIO).not.toContain("TB_GRUPO_ACESSO");
    const volta = ENSAIO.lastIndexOf("reset role;");
    const e5 = ENSAIO.indexOf("-- E5.");
    const resumo = ENSAIO.indexOf("'ENSAIO OK' as resultado");
    expect(volta).toBeGreaterThan(ENSAIO.indexOf("set local role authenticated;"));
    expect(e5).toBeGreaterThan(volta);
    expect(resumo).toBeGreaterThan(e5);
  });
});
