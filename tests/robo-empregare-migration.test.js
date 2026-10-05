import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration do robô da Empregare (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Aqui, as invariantes estáticas:
  nomenclatura MAD, RLS sem acesso direto, carga só por service_role, leitura
  com permissão, trava da metade, sem hard delete, CPF fora da chave, o
  Status das atualizações com o robô, rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005170000_robo_empregare.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const TABELAS = [
  "TL_SYNC_EMPREGARE",
  "TB_EMPREGARE_VAGA",
  "TB_EMPREGARE_CANDIDATO",
];
const CARGA = {
  listar_vagas_empregare: "text[], text[], integer",
  iniciar_sync_empregare: "text, text, uuid, jsonb, integer, text, boolean",
  gravar_lote_empregare: "text, text, integer, jsonb",
  fechar_vaga_empregare: "text, text, jsonb, text",
  finalizar_sync_empregare: "text, integer, integer, text",
};

const blocoDaTabela = (tabela) => {
  const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
  expect(inicio, tabela).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
};
const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

describe("migration do robô da Empregare: tabelas no padrão MAD", () => {
  it.each(TABELAS)(
    "%s: prefixo, colunas tipadas entre aspas, constraints nomeadas e COMMENT ON em tudo",
    (tabela) => {
      expect(tabela).toMatch(/^(TB|TL)_[A-Z_]+$/);
      expect(tabela.length).toBeLessThanOrEqual(30);
      const bloco = blocoDaTabela(tabela);
      expect(bloco).toContain(`constraint "PK_${tabela}" primary key`);
      const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      expect(colunas.length).toBeGreaterThan(8);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|TP|NO|DS|DT|ST|NU|QT)_[A-Z_]+$/);
        expect(coluna.length).toBeLessThanOrEqual(30);
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
      for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g)) {
        expect(nome.length, nome).toBeLessThanOrEqual(30);
        expect(nome).toMatch(/^(PK|UK|FK|CK)_/);
        if (!nome.startsWith("PK_"))
          expect(MIGRATION).toContain(
            `comment on constraint "${nome}" on public."${tabela}"`,
          );
      }
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
    },
  );

  it("índices nomeados (IN_) e comentados", () => {
    const indices = [
      ...MIGRATION.matchAll(/create index "([A-Z_]+)" on public/g),
    ].map((m) => m[1]);
    expect(indices.length).toBeGreaterThanOrEqual(5);
    for (const nome of indices) {
      expect(nome).toMatch(/^IN_/);
      expect(nome.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
  });

  it("chave natural sem CPF em claro: só código ou hash SHA-256 de CPF/e-mail", () => {
    const bloco = blocoDaTabela("TB_EMPREGARE_CANDIDATO");
    expect(bloco).toContain(
      `"CK_EMPREGCAND_CHAVE" check ("DS_CHAVE_CANDIDATO" ~ '^(cod:[A-Za-z0-9._-]{1,60}|cpf:[0-9a-f]{64}|email:[0-9a-f]{64})$')`,
    );
    expect(bloco).toContain(
      'constraint "UK_EMPREGCAND_VAGACHAVE" unique ("CO_VAGA", "DS_CHAVE_CANDIDATO")',
    );
    expect(bloco).toContain('"DS_COLUNA_ORIGINAL" jsonb not null');
    expect(bloco).toContain('"DS_HASH_LINHA" varchar(64) not null');
  });
});

describe("migration do robô da Empregare: acesso", () => {
  it("tabelas sem grant nenhum", () => {
    expect(MIGRATION).toContain(
      'revoke all on public."TL_SYNC_EMPREGARE", public."TB_EMPREGARE_VAGA", public."TB_EMPREGARE_CANDIDATO"\n  from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\."T[BLH]_/i);
  });

  it.each(Object.entries(CARGA))(
    "%s: SECURITY DEFINER, search_path vazio, só service_role, comentada e no rollback",
    (nome, assinatura) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}(${assinatura}) from public, anon, authenticated;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${assinatura}) to service_role;`,
      );
      expect(MIGRATION).toContain(
        `comment on function public.${nome}(${assinatura}) is`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists public.${nome}(${assinatura});`,
      );
      // Carga não é chamada pelo front: fora do contrato de RPC.
      expect(CONTRATO_RPC[nome]).toBeUndefined();
    },
  );

  it("leitura dos candidatos: selecao >= editor, área e recorte; sem edital, só o admin global", () => {
    const corpo = corpoDaFuncao(
      "create function public.obter_candidatos_empregare(",
    );
    expect(corpo).toContain("security definer");
    expect(corpo).toContain("set search_path to ''");
    expect(corpo).toContain("private.pode_recurso('selecao', 2)");
    expect(corpo).toContain('private."FC_PODE_AREA"(v_area)');
    expect(corpo).toContain('private."FC_EDITAIS_VISIVEIS"()');
    expect(corpo).toContain("private.is_master()");
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_candidatos_empregare(text) to authenticated, service_role;",
    );
  });

  it("porteiro do Rodar agora: administrador global com sessão", () => {
    const corpo = corpoDaFuncao("create function public.pode_disparar_carga()");
    expect(corpo).toContain(
      "select (select auth.uid()) is not null and private.is_master();",
    );
    expect(MIGRATION).toContain(
      "revoke all on function public.pode_disparar_carga() from public, anon;",
    );
    expect(ROLLBACK).toContain(
      "drop function if exists public.pode_disparar_carga();",
    );
  });

  it("funções privadas sem execução pública e no rollback", () => {
    const privadas = [
      ...MIGRATION.matchAll(/create function private\."([A-Z_]+)"\(([^)]*)\)/g),
    ];
    expect(privadas.length).toBe(4);
    for (const [, nome, assinatura] of privadas) {
      const tipos = assinatura
        .split(",")
        .map((a) => a.trim().split(" ").pop())
        .join(", ");
      expect(MIGRATION).toContain(
        `revoke all on function private."${nome}"(${tipos}) from public, anon, authenticated;`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists private."${nome}"(${tipos});`,
      );
    }
  });
});

describe("migration do robô da Empregare: regras da carga", () => {
  it("trava: menos da metade dos ativos sem forçar recusa a vaga, sem gravar nem desativar", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_EMPREGARE_ABRIR_VAGA"',
    );
    expect(corpo).toContain(
      "if not v_forcada and v_ativos > 0 and p_total * 2 < v_ativos then",
    );
    expect(corpo).toContain("'RECUSADA'");
    const lote = corpoDaFuncao("create function public.gravar_lote_empregare(");
    expect(lote.indexOf("FC_EMPREGARE_ABRIR_VAGA")).toBeLessThan(
      lote.indexOf('insert into public."TB_EMPREGARE_CANDIDATO"'),
    );
  });

  it("sem hard delete: quem sai fica inativo", () => {
    expect(MIGRATION).not.toMatch(/delete from public\."TB_EMPREGARE/i);
    const fechar = corpoDaFuncao("create function public.fechar_vaga_empregare(");
    expect(fechar).toContain(`"ST_REGISTRO_ATIVO" = 'N', "DT_DESATIVACAO" = now()`);
  });

  it("hash da linha calculado no banco e data de atualização só quando muda", () => {
    const lote = corpoDaFuncao("create function public.gravar_lote_empregare(");
    expect(lote).toContain(
      "encode(sha256(convert_to(l.colunas::text, 'UTF8')), 'hex')",
    );
    expect(lote).toContain(
      `when c."DS_HASH_LINHA" is distinct from excluded."DS_HASH_LINHA" or c."ST_REGISTRO_ATIVO" = 'N' then now()`,
    );
  });

  it("vagas padrão: editais ativos em curso (30 dias), nunca carregadas primeiro", () => {
    const corpo = corpoDaFuncao("create function public.listar_vagas_empregare(");
    expect(corpo).toContain("s.edital_ativo is true");
    expect(corpo).toContain("s.fim_do_cronograma >= current_date - 30");
    expect(corpo).toContain('order by ev."DT_ULTIMA_CARGA" nulls first');
  });

  it("uma execução por vez e a esquecida não segura as próximas", () => {
    const corpo = corpoDaFuncao("create function public.iniciar_sync_empregare(");
    expect(corpo).toContain("interval '3 hours'");
    expect(corpo).toContain("errcode = '55P03'");
  });

  it("sem `if case … then … end then` (quebra no PL/pgSQL)", () => {
    expect(MIGRATION).not.toMatch(/\bif\s+case\b/i);
  });
});

describe("Status das atualizações com o robô da Empregare", () => {
  it("get_saude_das_cargas ganha 'empregare' com contagens e o rollback volta sem ela", () => {
    const corpo = corpoDaFuncao(
      "create or replace function public.get_saude_das_cargas()",
    );
    expect(corpo).toContain("private.is_master()");
    for (const chave of [
      "'empregare'",
      "'vagas_pedidas'",
      "'vagas_baixadas'",
      "'vagas_falha'",
      "'vagas_recusadas'",
      "'disparo'",
    ])
      expect(corpo).toContain(chave);
    expect(ROLLBACK).toContain(
      "create or replace function public.get_saude_das_cargas()",
    );
    expect(ROLLBACK).not.toContain("'empregare'");
    expect(CONTRATO_RPC.get_saude_das_cargas.resumo).toMatch(/Empregare/);
  });
});

describe("rollback e ensaio do robô da Empregare", () => {
  it("rollback derruba as três tabelas", () => {
    for (const tabela of TABELAS)
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
  });

  it("o ensaio tem o mesmo corpo da migration, entre begin e rollback", () => {
    const daMigration = corpoDaMigration(MIGRATION, "\nbegin;\n", "\ncommit;");
    const doEnsaio = corpoDaMigration(
      ENSAIO,
      "-- ═══ CORPO DA MIGRATION (início) ═══\n",
      "-- ═══ CORPO DA MIGRATION (fim) ═══",
    );
    expect(doEnsaio).toBe(daMigration);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("confere trava, saída, permissões e volta o papel antes de ler as tabelas e do resumo", () => {
    for (const marca of [
      "FALHOU E2: trava não recusou",
      "FALHOU E2: a recusa desativou alguém ou a saída não desativou",
      "FALHOU E4: usuário comum pode disparar carga",
      "FALHOU E4: authenticated listou as vagas do robô",
      "FALHOU E5: CPF em claro na chave",
      "FALHOU E5: quem saiu não ficou inativo",
    ])
      expect(ENSAIO).toContain(marca);
    const papel = ENSAIO.indexOf("set local role authenticated;");
    const volta = ENSAIO.lastIndexOf("reset role;");
    const e5 = ENSAIO.indexOf("-- E5.");
    const resumo = ENSAIO.indexOf("'ENSAIO OK' as resultado");
    expect(papel).toBeGreaterThan(-1);
    expect(volta).toBeGreaterThan(papel);
    expect(e5).toBeGreaterThan(volta);
    expect(resumo).toBeGreaterThan(e5);
  });
});
