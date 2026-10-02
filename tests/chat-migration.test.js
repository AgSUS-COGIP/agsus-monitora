import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration do chat (ainda não aplicada: o ensaio begin…rollback está em
  supabase/ensaios/). Aqui, as invariantes estáticas: nomenclatura MAD
  (prefixos, maiúsculas entre aspas, constraints nomeadas, COMMENT ON), RLS
  ligada com leitura só pela policy, nenhuma escrita direta, RPCs SECURITY
  DEFINER com search_path vazio que exigem o recurso 'chat', Realtime,
  rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261002210000_chat.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const TABELAS = ["TB_CONVERSA", "RL_CONVERSA_PARTICIPANTE", "TB_MENSAGEM"];
const RPCS = {
  listar_conversas_chat: "",
  listar_mensagens_chat: "uuid, timestamptz, integer",
  listar_pessoas_chat: "text",
  enviar_mensagem_chat: "uuid, text, jsonb, uuid[], uuid",
  editar_mensagem_chat: "uuid, text",
  apagar_mensagem_chat: "uuid",
  marcar_conversa_lida_chat: "uuid, timestamptz",
  abrir_conversa_direta_chat: "uuid",
  criar_grupo_chat: "text, uuid[]",
  adicionar_participantes_chat: "uuid, uuid[]",
  sair_conversa_chat: "uuid",
  silenciar_conversa_chat: "uuid, boolean",
  abrir_conversa_edital_chat: "uuid",
};

const blocoDaTabela = (tabela) => {
  const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
  expect(inicio, tabela).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
};
const corpoDaFuncao = (nome) => {
  const inicio = MIGRATION.indexOf(`create function public.${nome}(`);
  expect(inicio, nome).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};
const corpoDaMigration = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

describe("migration do chat: tabelas no padrão MAD", () => {
  it.each(TABELAS)(
    "%s: identificadores entre aspas, PK nomeada e COMMENT ON em tudo",
    (tabela) => {
      const bloco = blocoDaTabela(tabela);
      expect(bloco).toContain(`constraint "PK_${tabela}" primary key`);
      const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      expect(colunas.length).toBeGreaterThan(3);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|TP|NO|DS|DT|ST)_[A-Z_]+$/);
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
      for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g))
        expect(MIGRATION).toMatch(
          new RegExp(`comment on constraint "${nome}" on public."${tabela}"`),
        );
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
    },
  );

  it("índices nomeados e comentados para listar por conversa e data e por pessoa", () => {
    expect(MIGRATION).toContain(
      'create index "IN_MENSAGEM_CONVERSA_DATA" on public."TB_MENSAGEM" ("CO_CONVERSA", "DT_CRIACAO" desc, "CO_MENSAGEM" desc);',
    );
    expect(MIGRATION).toContain(
      'create index "IN_CONVPARTICIP_USUARIO" on public."RL_CONVERSA_PARTICIPANTE"',
    );
    expect(MIGRATION).toContain(
      'comment on index public."IN_MENSAGEM_CONVERSA_DATA"',
    );
    expect(MIGRATION).toContain(
      'comment on index public."IN_CONVPARTICIP_USUARIO"',
    );
  });

  it("direta é uma por par e edital é uma por edital (unique nomeada)", () => {
    expect(blocoDaTabela("TB_CONVERSA")).toContain(
      'constraint "UK_CONVERSA_CHAVEDIRETA" unique ("DS_CHAVE_DIRETA")',
    );
    expect(blocoDaTabela("TB_CONVERSA")).toContain(
      'constraint "UK_CONVERSA_COMONITORAMENTO" unique ("CO_MONITORAMENTO")',
    );
    expect(corpoDaFuncao("abrir_conversa_direta_chat")).toContain(
      'on conflict on constraint "UK_CONVERSA_CHAVEDIRETA" do nothing',
    );
    expect(corpoDaFuncao("abrir_conversa_edital_chat")).toContain(
      'on conflict on constraint "UK_CONVERSA_COMONITORAMENTO" do nothing',
    );
  });

  it("texto até 4.000 e apagar lógico garantidos também por CHECK", () => {
    const bloco = blocoDaTabela("TB_MENSAGEM");
    expect(bloco).toContain('length("DS_TEXTO") <= 4000');
    expect(bloco).toContain('constraint "CK_MENSAGEM_APAGADA"');
  });
});

describe("migration do chat: acesso", () => {
  it("leitura direta só pela policy (FC_CHAT_PODE_LER); nenhuma escrita direta", () => {
    expect(MIGRATION).toContain(
      'revoke all on public."TB_CONVERSA", public."RL_CONVERSA_PARTICIPANTE", public."TB_MENSAGEM" from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      'grant select on public."TB_CONVERSA", public."RL_CONVERSA_PARTICIPANTE", public."TB_MENSAGEM" to authenticated;',
    );
    expect(MIGRATION).not.toMatch(
      /grant (insert|update|delete|all)[^;]*"T[BL]_/i,
    );
    expect(MIGRATION).not.toMatch(/grant (insert|update|delete|all)[^;]*"RL_/i);
    expect(MIGRATION).not.toMatch(/delete from public\."TB_MENSAGEM"/i);
    for (const tabela of TABELAS)
      expect(MIGRATION).toMatch(
        new RegExp(
          `create policy "PL_[A-Z_]+" on public\\."${tabela}"\\s+for select to authenticated using \\(private\\."FC_CHAT_PODE_LER"\\("CO_CONVERSA"\\)\\);`,
        ),
      );
  });

  it("a conversa do edital segue o acesso ao edital (FC_PODE_VER_EDITAL), a direta e o grupo seguem a participação", () => {
    const inicio = MIGRATION.indexOf(
      'create function private."FC_CHAT_PODE_LER"',
    );
    const corpo = MIGRATION.slice(
      inicio,
      MIGRATION.indexOf("$function$;", inicio),
    );
    expect(corpo).toContain("private.pode_recurso('chat', 1)");
    expect(corpo).toContain(
      `when c."TP_CONVERSA" = 'EDITAL' then private."FC_PODE_VER_EDITAL"(c."CO_MONITORAMENTO")`,
    );
    expect(corpo).toContain('p."DT_SAIDA" is null');
    expect(corpoDaFuncao("abrir_conversa_edital_chat")).toContain(
      'private."FC_PODE_VER_EDITAL"(p_edital)',
    );
  });

  it.each(Object.entries(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio, exige o recurso chat e só authenticated executa",
    (nome, assinatura) => {
      const corpo = corpoDaFuncao(nome);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain('private."FC_CHAT_EXIGIR"()');
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}(${assinatura}) from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${assinatura}) to authenticated, service_role;`,
      );
      expect(MIGRATION).toContain(
        `comment on function public.${nome}(${assinatura}) is`,
      );
      expect(ROLLBACK).toContain(
        `drop function if exists public.${nome}(${assinatura});`,
      );
    },
  );

  it("editar e apagar conferem a autoria; apagar não apaga a linha", () => {
    for (const nome of ["editar_mensagem_chat", "apagar_mensagem_chat"]) {
      const corpo = corpoDaFuncao(nome);
      expect(corpo).toContain('if v."CO_USUARIO_AUTOR" <> v_uid then');
      expect(corpo).toContain("errcode = '42501'");
    }
    expect(corpoDaFuncao("apagar_mensagem_chat")).toContain(
      `set "ST_APAGADA" = 'S'`,
    );
  });

  it("enviar valida texto e link, aceita o id do navegador e só menciona participante", () => {
    const corpo = corpoDaFuncao("enviar_mensagem_chat");
    expect(corpo).toContain('private."FC_CHAT_VALIDAR_TEXTO"(p_texto)');
    expect(corpo).toContain('private."FC_CHAT_VALIDAR_LINK"(p_link_tela)');
    expect(corpo).toContain("coalesce(p_mensagem, gen_random_uuid())");
    expect(corpo).toContain('p."CO_USUARIO" = x and p."DT_SAIDA" is null');
  });

  it("o link da tela aceita só campos internos (nunca URL)", () => {
    const inicio = MIGRATION.indexOf(
      'create function private."FC_CHAT_VALIDAR_LINK"',
    );
    const corpo = MIGRATION.slice(
      inicio,
      MIGRATION.indexOf("$function$;", inicio),
    );
    expect(corpo).toContain(
      "not in ('view', 'area', 'secao', 'edital', 'rotulo')",
    );
    expect(corpo).toContain("'^[a-z][a-z_]{0,39}$'");
  });
});

describe("migration do chat: permissão e Realtime", () => {
  it("recurso 'chat' com dois níveis e semente leitor em todos os grupos", () => {
    expect(MIGRATION).toMatch(
      /'recursos_parecer','classificacao','chat'\]::text\[\]/,
    );
    expect(MIGRATION).toContain(
      `check ("NO_RECURSO" <> 'chat' or "TP_NIVEL" in ('sem_acesso', 'leitor'))`,
    );
    expect(MIGRATION).toContain(
      `check (recurso <> 'chat' or nivel in ('sem_acesso', 'leitor'))`,
    );
    expect(MIGRATION).toContain(`select g."CO_GRUPO_ACESSO", 'chat', 'leitor'`);
  });

  it("as três tabelas entram na publicação supabase_realtime; o digitando usa canal privado com a mesma regra", () => {
    expect(MIGRATION).toContain(
      "foreach v_tabela in array array['TB_CONVERSA', 'RL_CONVERSA_PARTICIPANTE', 'TB_MENSAGEM'] loop",
    );
    expect(MIGRATION).toContain(
      "execute format('alter publication supabase_realtime add table public.%I', v_tabela);",
    );
    expect(MIGRATION).toContain(
      `private."FC_CHAT_PODE_TOPICO"(realtime.topic())`,
    );
  });

  it("rollback desfaz o recurso, as policies do Realtime e as tabelas", () => {
    expect(ROLLBACK).toContain(
      `delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'chat';`,
    );
    expect(ROLLBACK).toContain(`'recursos_parecer','classificacao']::text[]`);
    expect(ROLLBACK).toContain(
      'drop policy if exists "PL_CHAT_REALTIME_LEITURA"',
    );
    for (const tabela of TABELAS)
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
  });
});

describe("ensaio do chat", () => {
  it("tem o mesmo corpo da migration, entre begin e rollback", () => {
    const daMigration = corpoDaMigration(MIGRATION, "\nbegin;\n", "\ncommit;");
    const doEnsaio = corpoDaMigration(
      ENSAIO,
      "-- ═══ CORPO DA MIGRATION (início) ═══\n",
      "-- ═══ CORPO DA MIGRATION (fim) ═══",
    );
    expect(doEnsaio).toBe(daMigration);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("confere quem está fora, a direta idempotente, a autoria, o edital e volta o papel antes do resumo", () => {
    for (const marca of [
      "FALHOU E3: A abriu duas diretas com B",
      "FALHOU E4: C leu a direta de A e B",
      "FALHOU E4: C enviou na direta de A e B",
      "FALHOU E6: B editou a mensagem de A",
      "FALHOU E6: B apagou a mensagem de A",
      "FALHOU E8: C (sem a área) leu a conversa do edital",
    ])
      expect(ENSAIO).toContain(marca);
    const papel = ENSAIO.indexOf("set local role authenticated;");
    const volta = ENSAIO.indexOf("reset role;");
    const resumo = ENSAIO.indexOf("'ENSAIO OK' as resultado");
    expect(papel).toBeGreaterThan(-1);
    expect(volta).toBeGreaterThan(papel);
    expect(resumo).toBeGreaterThan(volta);
  });
});
