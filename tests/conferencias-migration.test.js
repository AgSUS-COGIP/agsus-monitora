import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration das conferências de consistência (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Aqui, as invariantes estáticas:
  nomenclatura MAD, RLS sem acesso direto, job só por service_role, leitura
  da tela com permissão, exemplos só com ids/códigos, o Status das
  atualizações com as conferências, rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005210000_conferencias_de_consistencia.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const TABELAS = ["TL_CONFERENCIA", "TB_AVISO_CONFERENCIA"];
const DO_JOB = {
  conferencia_ler_contexto: "",
  conferencia_ler_analises: "uuid, integer",
  conferencia_ler_entrevistas: "",
  conferencia_ler_classificacao: "",
  conferencia_ler_aprovados: "",
  conferencia_ler_cargas: "",
  iniciar_conferencia: "text, text, uuid, text",
  gravar_avisos_conferencia: "text, jsonb",
  finalizar_conferencia: "text, text[], text[], text",
};
const DA_TELA = {
  listar_avisos_conferencia: "text, text",
  ignorar_aviso_conferencia: "uuid, text",
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

describe("migration das conferências: tabelas no padrão MAD", () => {
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
      ...MIGRATION.matchAll(
        /create index (?:if not exists )?"([A-Z_]+)" on public/g,
      ),
    ].map((m) => m[1]);
    expect(indices.length).toBeGreaterThanOrEqual(5);
    for (const nome of indices) {
      expect(nome).toMatch(/^IN_/);
      expect(nome.length).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
  });

  it("um aviso por conferência + escopo, com situação e o ignorado coerentes", () => {
    const bloco = blocoDaTabela("TB_AVISO_CONFERENCIA");
    expect(bloco).toContain(
      'constraint "UK_AVISOCONF_CONFESCOPO" unique ("CO_CONFERENCIA", "DS_ESCOPO")',
    );
    expect(bloco).toContain(
      `"TP_SITUACAO" in ('ABERTO', 'RESOLVIDO', 'IGNORADO')`,
    );
    expect(bloco).toContain(
      `("TP_SITUACAO" = 'IGNORADO') = ("CO_USUARIO_IGNORADO" is not null)`,
    );
    expect(bloco).toContain('jsonb_array_length("DS_EXEMPLO") <= 20');
  });
});

describe("migration das conferências: acesso", () => {
  it("tabelas sem grant nenhum", () => {
    expect(MIGRATION).toContain(
      'revoke all on public."TL_CONFERENCIA", public."TB_AVISO_CONFERENCIA" from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\."T[BLH]_/i);
  });

  it.each(Object.entries(DO_JOB))(
    "%s: SECURITY DEFINER, search_path vazio, só service_role, comentada, no rollback e fora do contrato",
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
      expect(CONTRATO_RPC[nome]).toBeUndefined();
    },
  );

  it.each(Object.entries(DA_TELA))(
    "%s: authenticated com sessão, no contrato de RPC e no rollback",
    (nome, assinatura) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain("if auth.uid() is null then");
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}(${assinatura}) from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${assinatura}) to authenticated;`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists public.${nome}(${assinatura});`,
      );
      expect(CONTRATO_RPC[nome]).toBeDefined();
    },
  );

  it("quem vê: módulo, área e recorte do edital; cargas e sem área só o admin global", () => {
    const ver = corpoDaFuncao('create function private."FC_PODE_VER_AVISO"');
    expect(ver).toContain("private.is_master()");
    expect(ver).toContain("private.pode_recurso(v_recurso, 1)");
    expect(ver).toContain('private."FC_PODE_AREA"(p_area)');
    expect(ver).toContain('private."FC_PODE_VER_EDITAL"(p_edital)');
    expect(ver).toContain('private."FC_EDITAIS_VISIVEIS"() is null');
    const recurso = corpoDaFuncao(
      'create function private."FC_CONFERENCIA_RECURSO"',
    );
    expect(recurso).not.toContain("'cargas'");
    const ignorar = corpoDaFuncao(
      'create function private."FC_PODE_IGNORAR_AVISO"',
    );
    expect(ignorar).toContain("when 'classificacao' then 2 else 3 end");
    const listar = corpoDaFuncao(
      "create function public.listar_avisos_conferencia(",
    );
    expect(listar).toContain(
      'private."FC_PODE_VER_AVISO"(a."CO_MODULO", a."CO_AREA", a."CO_MONITORAMENTO")',
    );
  });

  it("funções privadas sem execução pública e no rollback", () => {
    const privadas = [
      ...MIGRATION.matchAll(/create function private\."([A-Z_]+)"\(([^)]*)\)/g),
    ];
    expect(privadas.length).toBe(6);
    for (const [, nome, assinatura] of privadas) {
      const tipos = assinatura
        .split(",")
        .filter((a) => a.trim())
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

describe("migration das conferências: sem dado pessoal", () => {
  it("exemplos só com ids e códigos; resumo sem e-mail nem CPF", () => {
    const gravar = corpoDaFuncao(
      "create function public.gravar_avisos_conferencia(",
    );
    expect(gravar).toContain("(e #>> '{}') !~ '^[A-Za-z0-9._:/-]{1,80}$'");
    expect(gravar).toContain("(e #>> '{}') ~ '[0-9]{11}'");
    expect(gravar).toContain('private."FC_TEXTO_SEGURO_DO_AVISO"(v_resumo)');
  });

  it("as leituras do job não devolvem nome, CPF, e-mail nem telefone", () => {
    for (const nome of Object.keys(DO_JOB).filter((n) =>
      n.startsWith("conferencia_ler_"),
    )) {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      for (const proibido of [
        "'nome'",
        "'cpf'",
        "'email'",
        "'telefone'",
        "NU_CPF",
        "DS_EMAIL",
        "NO_CANDIDATO",
        "'candidato',",
      ])
        expect(corpo, `${nome} ${proibido}`).not.toContain(proibido);
    }
    // A mesma pessoa em duas listas de aprovados vai por hash.
    expect(
      corpoDaFuncao("create function public.conferencia_ler_aprovados("),
    ).toContain("encode(sha256(convert_to('conferencia:'");
  });

  it("só conferência que rodou até o fim resolve aviso", () => {
    const fim = corpoDaFuncao("create function public.finalizar_conferencia(");
    expect(fim).toContain(`"CO_CONFERENCIA" = any (v_conferencias)`);
    expect(fim).toContain(`not ("CO_CONFERENCIA" = any (v_falhas))`);
    expect(fim).toContain("if v_mensagem is null then");
  });

  it("uma execução por vez e a esquecida não segura as próximas", () => {
    const corpo = corpoDaFuncao("create function public.iniciar_conferencia(");
    expect(corpo).toContain("interval '1 hour'");
    expect(corpo).toContain("errcode = '55P03'");
  });

  it("sem `if case … then … end then` (quebra no PL/pgSQL)", () => {
    expect(MIGRATION).not.toMatch(/\bif\s+case\b/i);
  });
});

describe("Status das atualizações com as conferências", () => {
  it("get_saude_das_cargas ganha 'conferencias' e o rollback volta à versão do robô", () => {
    const corpo = corpoDaFuncao(
      "create or replace function public.get_saude_das_cargas()",
    );
    expect(corpo).toContain("private.is_master()");
    for (const chave of [
      "'conferencias'",
      "'empregare'",
      "'novos'",
      "'abertos'",
      "'resolvidos'",
    ])
      expect(corpo).toContain(chave);
    expect(ROLLBACK).toContain(
      "create or replace function public.get_saude_das_cargas()",
    );
    expect(ROLLBACK).toContain("'empregare'");
    expect(ROLLBACK).not.toContain("'conferencias'");
    expect(CONTRATO_RPC.get_saude_das_cargas.resumo).toMatch(/conferências/);
  });
});

describe("rollback e ensaio das conferências", () => {
  it("rollback derruba as duas tabelas e o índice novo", () => {
    for (const tabela of TABELAS)
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
    expect(ROLLBACK).toContain(
      'drop index if exists public."IN_EMPREGCAND_COCANDEMPREG";',
    );
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

  it("admin no grupo 'admin', contagem pela RPC e o papel volta antes de ler as tabelas", () => {
    expect(ENSAIO).toContain("'Ensaio Admin', 'admin', true");
    expect(ENSAIO).not.toMatch(/"ST_ADMIN_GLOBAL"[^;]*\btrue\b[^;]*998/);
    for (const marca of [
      "FALHOU E2: aceitou nome nos exemplos",
      "FALHOU E2: aceitou CPF nos exemplos",
      "FALHOU E4: o leitor vê aviso de carga",
      "FALHOU E4: leitor ignorou",
      "FALHOU E5: o ignorado devia reabrir com 5",
    ])
      expect(ENSAIO).toContain(marca);
    const papel = ENSAIO.indexOf("set local role authenticated;");
    const volta = ENSAIO.lastIndexOf("reset role;");
    const e6 = ENSAIO.indexOf("-- E6.");
    const resumo = ENSAIO.indexOf("'ENSAIO OK' as resultado");
    expect(papel).toBeGreaterThan(-1);
    expect(volta).toBeGreaterThan(papel);
    expect(e6).toBeGreaterThan(volta);
    expect(resumo).toBeGreaterThan(e6);
  });
});
