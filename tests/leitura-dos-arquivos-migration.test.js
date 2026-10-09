import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Migration da leitura automática dos arquivos (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Invariantes estáticas: tabela no
  padrão MAD (aspas, maiúsculas, PK/UK/FK/CK nomeadas, comentário em tudo,
  RLS sem grant), RPCs do robô só para o service_role, a ficha ganha só
  "leituras" (o resto igual a 20261009210000), o validador do lançamento ganha
  só a chamada da conferência das decisões (o resto igual a 20261007130000),
  rollback com os corpos de antes e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009220000_leitura_dos_arquivos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const VIGENTE = ler(
  "supabase/migrations/20261009210000_ficha_com_a_resposta_vigente.sql",
);
const CONTEUDO = ler(
  "supabase/migrations/20261007130000_conteudo_da_ficha.sql",
);
const ROBO = ler("scripts/robo-empregare/leitura_de_arquivos.py");
const TELA = ler("src/lib/avaliacao-documental/leitura-dos-arquivos.ts");

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const OBTER =
  "create or replace function public.obter_ficha_analise(p_ficha uuid)";
const VALIDADOR =
  'function private."FC_VALIDAR_LANCAMENTO_FICHA"(p_regra jsonb, p_lanc jsonb)';
const LISTAR =
  "public.listar_anexos_para_leitura(text[], text, boolean, integer, text)";
const GRAVAR = "public.gravar_leituras_de_arquivos(text, jsonb)";

describe("leitura automática dos arquivos — migration", () => {
  it("tabela no padrão MAD, comentada coluna a coluna, com RLS e sem grant", () => {
    const tabela = MIGRATION.slice(
      MIGRATION.indexOf('create table public."TB_LEITURA_ARQUIVO"'),
      MIGRATION.indexOf(
        "\n);",
        MIGRATION.indexOf('create table public."TB_LEITURA_ARQUIVO"'),
      ),
    );
    const colunas = [...tabela.matchAll(/^ {2}"([A-Z_]+)" /gm)].map(
      (m) => m[1],
    );
    expect(colunas.length).toBeGreaterThan(15);
    for (const c of colunas) {
      expect(c).toMatch(/^(CO|NU|TP|QT|VL|ST|DS|DT)_[A-Z_]+$/);
      expect(c.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(
        `comment on column public."TB_LEITURA_ARQUIVO"."${c}" is`,
      );
    }
    const restricoes = [...tabela.matchAll(/constraint "([A-Z_]+)"/g)].map(
      (m) => m[1],
    );
    expect(restricoes).toContain("PK_TB_LEITURA_ARQUIVO");
    expect(restricoes).toContain("UK_LEITARQ_RESPPERGARQ");
    expect(restricoes).toContain("FK_EMPREGRESP_LEITARQ");
    for (const r of restricoes) {
      expect(r).toMatch(/^(PK|UK|FK|CK)_[A-Z_]+$/);
      expect(r.length).toBeLessThanOrEqual(30);
    }
    expect(MIGRATION).toContain(
      'comment on table public."TB_LEITURA_ARQUIVO" is',
    );
    expect(MIGRATION).toContain(
      'alter table public."TB_LEITURA_ARQUIVO" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."TB_LEITURA_ARQUIVO" from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(
      /grant [^;]*on public\."TB_LEITURA_ARQUIVO"/i,
    );
    // Nenhuma coluna para o texto do documento, o nome ou o CPF lidos.
    expect(tabela).not.toMatch(/"(DS_TEXTO|NO_[A-Z_]+|NU_CPF)"/);
  });

  it("as RPCs do robô são só do service_role; as conferências são privadas", () => {
    for (const assinatura of [LISTAR, GRAVAR]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to service_role;`,
      );
      expect(MIGRATION).toContain(`comment on function ${assinatura} is`);
    }
    for (const privada of [
      'private."FC_VALIDAR_LEITURA_ARQUIVO"(jsonb)',
      'private."FC_VALIDAR_LEITURAS_LANCAMENTO"(jsonb)',
    ]) {
      expect(MIGRATION).toContain(
        `revoke all on function ${privada} from public, anon, authenticated;`,
      );
      expect(MIGRATION).not.toMatch(
        new RegExp(`grant [^;]*${privada.replace(/[\\^$.*+?()[\]{}|"]/g, "\\$&")}`),
      );
    }
    for (const cabeca of [
      "create function public.listar_anexos_para_leitura(",
      "create function public.gravar_leituras_de_arquivos(",
    ]) {
      const funcao = corpoDaFuncao(MIGRATION, cabeca);
      expect(funcao).toContain("security definer");
      expect(funcao).toContain("set search_path to ''");
    }
    // O CPF só sai como hash com o sal da execução; a leitura recusa número com cara de CPF.
    const listar = corpoDaFuncao(
      MIGRATION,
      "create function public.listar_anexos_para_leitura(",
    );
    expect(listar).toContain(
      "encode(sha256(convert_to(p_sal || lpad(x.cpf, 11, '0'), 'UTF8')), 'hex')",
    );
    expect(listar).toContain(
      'private."FC_RESPOSTA_VIGENTE_EMPREGARE"(c."CO_EMPREGARE_CANDIDATO")',
    );
    expect(listar).toContain("order by pd.com_ficha desc");
    expect(
      corpoDaFuncao(
        MIGRATION,
        'create function private."FC_VALIDAR_LEITURA_ARQUIVO"(p jsonb)',
      ),
    ).toContain("'\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}'");
  });

  it("a ficha ganha só as leituras da resposta vigente; o resto igual a 20261009210000", () => {
    const agora = corpoDaFuncao(MIGRATION, OBTER);
    const antes = corpoDaFuncao(VIGENTE, OBTER);
    expect(agora).toContain("'leituras', coalesce((");
    expect(agora).toContain(
      "where l.\"CO_EMPREGARE_RESPOSTA\" = v_envio), '[]'::json),",
    );
    const desfeito = agora.replace(
      /\n {4}-- O que o robô leu dos anexos[\s\S]*?where l\."CO_EMPREGARE_RESPOSTA" = v_envio\), '\[\]'::json\),/,
      "",
    );
    expect(desfeito).toBe(antes);
    // A tela lê o que a RPC devolve.
    expect(TELA).toContain("leituras");
    expect(TELA).toContain("recusas_lidas");
    expect(TELA).toContain("do_arquivo");
  });

  it("o validador do lançamento ganha só a conferência das decisões; o resto igual a 20261007130000", () => {
    const agora = corpoDaFuncao(MIGRATION, `create or replace ${VALIDADOR}`);
    const antes = corpoDaFuncao(CONTEUDO, `create ${VALIDADOR}`);
    expect(agora).toContain(
      'perform private."FC_VALIDAR_LEITURAS_LANCAMENTO"(p_lanc);',
    );
    const desfeito = agora
      .replace("create or replace function", "create function")
      .replace(
        /\n {2}-- O que o robô leu dos arquivos[^\n]*\n {2}perform private\."FC_VALIDAR_LEITURAS_LANCAMENTO"\(p_lanc\);/,
        "",
      );
    expect(desfeito).toBe(antes);
    const decisoes = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_VALIDAR_LEITURAS_LANCAMENTO"(p_lanc jsonb)',
    );
    for (const motivo of [
      "FORA_DA_AREA",
      "CARGA_NAO_COMPROVADA",
      "NOME_DIVERGENTE",
      "ILEGIVEL",
      "PERIODO_SOBREPOSTO",
      "OUTRO",
    ]) {
      expect(decisoes).toContain(`'${motivo}'`);
      expect(TELA).toContain(motivo);
    }
  });

  it("rollback volta os dois corpos e apaga o que entrou", () => {
    expect(corpoDaFuncao(ROLLBACK, OBTER)).toBe(corpoDaFuncao(VIGENTE, OBTER));
    expect(
      corpoDaFuncao(ROLLBACK, `create or replace ${VALIDADOR}`).replace(
        "create or replace function",
        "create function",
      ),
    ).toBe(corpoDaFuncao(CONTEUDO, `create ${VALIDADOR}`));
    for (const apagar of [
      'drop function if exists private."FC_VALIDAR_LEITURAS_LANCAMENTO"(jsonb);',
      `drop function if exists ${GRAVAR};`,
      `drop function if exists ${LISTAR};`,
      'drop function if exists private."FC_VALIDAR_LEITURA_ARQUIVO"(jsonb);',
      'drop table if exists public."TB_LEITURA_ARQUIVO";',
    ]) {
      expect(ROLLBACK).toContain(apagar);
      expect(ROLLBACK.indexOf(OBTER)).toBeLessThan(ROLLBACK.indexOf(apagar));
    }
  });

  it("o ensaio aplica o mesmo corpo da migration e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length,
      MIGRATION.lastIndexOf("\ncommit;"),
    ).trim();
    const noEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══") +
        "-- ═══ CORPO DA MIGRATION (início) ═══".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    ).trim();
    expect(noEnsaio).toBe(corpo);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/im);
    for (const e of ["E1 ok", "E2 ok", "E3 ok", "E4 ok", "E5 ok", "E6 ok"])
      expect(ENSAIO).toContain(e);
  });

  it("o robô chama as RPCs com os nomes e argumentos da migration", () => {
    expect(ROBO).toContain('"listar_anexos_para_leitura"');
    for (const arg of [
      "p_editais",
      "p_versao",
      "p_forcar",
      "p_limite",
      "p_sal",
    ])
      expect(ROBO).toContain(`"${arg}"`);
    expect(ROBO).toContain('"gravar_leituras_de_arquivos"');
    expect(ROBO).toContain('"p_execucao"');
    expect(ROBO).toContain('"p_leituras"');
  });
});
