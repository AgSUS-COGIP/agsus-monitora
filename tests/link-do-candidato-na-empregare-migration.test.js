import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration do link do candidato na Empregare (fase F7; ainda não aplicada: o
  ensaio begin…rollback está em supabase/ensaios/). Aqui, as invariantes
  estáticas: colunas e CKs, gravação que aceita o link sem quebrar o robô
  antigo, fechar com o identificador só para o service_role, a ficha como
  única leitura dos links, o mesmo formato de link no banco, no robô e na
  tela, rollback com os corpos de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007160000_link_do_candidato_na_empregare.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROBO = ler("supabase/migrations/20261005170000_robo_empregare.sql");
const FICHA = ler("supabase/migrations/20261007130000_conteudo_da_ficha.sql");
const NAVEGADOR = ler("scripts/robo-empregare/navegador_empregare.py");
const TELA = ler("src/lib/avaliacao-documental/ficha.js");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

const LOTE =
  "create or replace function public.gravar_lote_empregare(p_sync text, p_vaga text, p_total integer, p_linhas jsonb)";
const FECHAR = "create function public.fechar_vaga_empregare(";
const OBTER =
  "create or replace function public.obter_ficha_analise(p_ficha uuid)";
const PADRAO_DO_LINK =
  "^https://corporate\\.empregare\\.com/empresa/curriculo/detalhes\\?[A-Za-z0-9_.~=&%|+/:-]+$";

describe("robô da Empregare: link do candidato para a ficha", () => {
  it("colunas novas com CK e comentário, no padrão MAD", () => {
    for (const trecho of [
      'add column "CO_VAGA_INTERNO" varchar(100)',
      'add column "DS_LINK_DETALHE" varchar(600)',
      'add constraint "CK_EMPREGVAGA_COVAGAINTERNO"',
      'add constraint "CK_EMPREGCAND_DSLINKDETALHE"',
      'comment on column public."TB_EMPREGARE_CANDIDATO"."DS_LINK_DETALHE" is',
      'comment on column public."TB_EMPREGARE_VAGA"."CO_VAGA_INTERNO" is',
    ])
      expect(MIGRATION).toContain(trecho);
    expect(
      MIGRATION.match(/add column "DT_CAPTURA_LINK" timestamptz/g),
    ).toHaveLength(2);
    // Sem grant novo em tabela: os links só saem pelas funções.
    expect(MIGRATION).not.toMatch(/grant [^;]* on (table )?public\."TB_/i);
  });

  it("o lote aceita o link (opcional) e só o válido troca o anterior", () => {
    const corpo = corpoDaFuncao(MIGRATION, LOTE);
    expect(corpo).toContain("colunas jsonb, link text)");
    expect(corpo).toContain(`case when l.link ~ '${PADRAO_DO_LINK}'`);
    expect(corpo).toContain("and length(l.link) <= 600");
    expect(corpo).toContain(
      '"DS_LINK_DETALHE" = coalesce(excluded."DS_LINK_DETALHE", c."DS_LINK_DETALHE")',
    );
    // O link não entra no hash da linha: trocar o token não marca o candidato como alterado.
    expect(corpo).toContain(
      "encode(sha256(convert_to(l.colunas::text, 'UTF8')), 'hex')",
    );
    // A trava e o resto da gravação seguem os de 20261005170000.
    const antes = corpoDaFuncao(
      ROBO,
      "create function public.gravar_lote_empregare(",
    );
    const daTrava = (t) =>
      t.slice(t.indexOf("perform"), t.indexOf("create temporary table"));
    expect(daTrava(corpo)).toBe(daTrava(antes));
  });

  it("fechar ganha o identificador no fim, com default, só para o service_role", () => {
    const corpo = corpoDaFuncao(MIGRATION, FECHAR);
    expect(corpo).toContain("p_arquivo text default null,");
    expect(corpo).toContain("p_vaga_interno text default null)");
    expect(corpo).toContain("!~ '^[0-9]+[|]*$'");
    expect(MIGRATION).toContain(
      "drop function public.fechar_vaga_empregare(text, text, jsonb, text);",
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.fechar_vaga_empregare(text, text, jsonb, text, text) from public, anon, authenticated;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.fechar_vaga_empregare(text, text, jsonb, text, text) to service_role;",
    );
    // A desativação e o fechamento seguem os de 20261005170000.
    const antes = corpoDaFuncao(ROBO, FECHAR);
    const doFechamento = (t) =>
      t.slice(t.indexOf('  update public."TB_EMPREGARE_CANDIDATO" c set'));
    expect(
      doFechamento(corpo).replace(/,\n\s+'vaga_interno'[^)]*\)/, ")"),
    ).toBe(doFechamento(antes));
  });

  it("a ficha é a única leitura dos links e mantém o resto igual", () => {
    const corpo = corpoDaFuncao(MIGRATION, OBTER);
    expect(corpo).toContain('private."FC_EXIGIR_VER_FICHA"(v_f)');
    expect(corpo).toContain("'link_candidato', c.\"DS_LINK_DETALHE\"");
    expect(corpo).toContain(
      "'https://corporate.empregare.com/empresa/vagas/candidaturas/' || ev.\"CO_VAGA_INTERNO\"",
    );
    const antes = corpoDaFuncao(
      FICHA,
      "create function public.obter_ficha_analise(p_ficha uuid)",
    ).replace("create function", "create or replace function");
    const semEmpregare = corpo.replace(
      /\n {4}-- Links da Empregare[\s\S]*?v_f\."CO_EMPREGARE_CANDIDATO"\),/,
      "",
    );
    expect(semEmpregare).toBe(antes);
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_ficha_analise(uuid) to authenticated;",
    );
    // Nenhuma outra função da migration devolve o link.
    const funcoes = MIGRATION.split(/\ncreate (?:or replace )?function /).slice(
      1,
    );
    const comLink = funcoes
      .filter((f) => f.includes('"DS_LINK_DETALHE"'))
      .map((f) => f.slice(0, f.indexOf("(")));
    expect(comLink).toEqual([
      "public.gravar_lote_empregare",
      "public.obter_ficha_analise",
    ]);
  });

  it("o mesmo formato de link e de identificador no banco, no robô e na tela", () => {
    expect(MIGRATION).toContain(`"DS_LINK_DETALHE" ~ '${PADRAO_DO_LINK}'`);
    expect(NAVEGADOR).toContain(`re.compile(r"${PADRAO_DO_LINK}")`);
    expect(TELA).toContain(
      "/^https:\\/\\/corporate\\.empregare\\.com\\/empresa\\/curriculo\\/detalhes\\?[A-Za-z0-9_.~=&%|+/:-]+$/",
    );
    expect(MIGRATION).toContain("'^[A-Za-z0-9_.~=-]{1,96}[|]{0,3}$'");
    expect(NAVEGADOR).toContain(
      're.compile(r"^[A-Za-z0-9_.~=-]{1,96}\\|{0,3}$")',
    );
    expect(TELA).toContain("[A-Za-z0-9_.~=-]{1,96}\\|{0,3}$/");
  });

  it("rollback volta os corpos de antes e apaga as colunas", () => {
    const loteAntes = corpoDaFuncao(
      ROBO,
      "create function public.gravar_lote_empregare(",
    ).replace("create function", "create or replace function");
    const fecharAntes = corpoDaFuncao(ROBO, FECHAR);
    const fichaAntes = corpoDaFuncao(
      FICHA,
      "create function public.obter_ficha_analise(p_ficha uuid)",
    ).replace("create function", "create or replace function");
    expect(ROLLBACK).toContain(loteAntes);
    expect(ROLLBACK).toContain(fecharAntes);
    expect(ROLLBACK).toContain(fichaAntes);
    expect(ROLLBACK).toContain(
      "drop function if exists public.fechar_vaga_empregare(text, text, jsonb, text, text);",
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.fechar_vaga_empregare(text, text, jsonb, text) to service_role;",
    );
    for (const coluna of ["DS_LINK_DETALHE", "CO_VAGA_INTERNO"])
      expect(ROLLBACK).toContain(`drop column if exists "${coluna}"`);
    expect(ROLLBACK).not.toContain("drop table");
  });

  it("o ensaio tem o mesmo corpo da migration, só dados fictícios, e termina em rollback", () => {
    const daMigration = corpoDaMigration(MIGRATION, "\nbegin;\n", "\ncommit;");
    const doEnsaio = corpoDaMigration(
      ENSAIO,
      "-- ═══ CORPO DA MIGRATION (início) ═══\n",
      "-- ═══ CORPO DA MIGRATION (fim) ═══",
    );
    expect(doEnsaio).toBe(daMigration);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    for (const marca of [
      "FALHOU E1: outras funções leem o link",
      "FALHOU E2: fechar como o robô antigo",
      "FALHOU E3: quem não vê a ficha recebeu o link",
      "FALHOU E3: a fila traz o link do candidato",
      "FALHOU E4: a CK aceitou link de outro site",
    ])
      expect(ENSAIO).toContain(marca);
    // Tokens do ensaio são fictícios (ENSAIO…).
    for (const token of ENSAIO.matchAll(/tokenCandidato=([^&']+)/g))
      expect(token[1]).toMatch(/^ENSAIO/);
    const volta = ENSAIO.lastIndexOf("reset role;");
    expect(volta).toBeGreaterThan(
      ENSAIO.indexOf("set local role authenticated;"),
    );
    expect(ENSAIO.indexOf("-- E4.")).toBeGreaterThan(volta);
  });
});
