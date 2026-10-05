import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { REACOES_RAPIDAS } from "../src/lib/chat.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da v1.1 do chat (limpar conversa para mim e reações), a aplicar
  depois de 20261002210000_chat.sql. Invariantes estáticas: padrão MAD,
  RLS da tabela nova igual à da mensagem, escrita só por RPC SECURITY DEFINER
  que exige o recurso chat, Realtime, listagens filtrando a limpeza, rollback
  que volta os corpos da v1 e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005100000_chat_limpar_e_reacoes.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const V1 = ler("supabase/migrations/20261002210000_chat.sql");

const RPCS = {
  limpar_conversa_chat: "uuid",
  alternar_reacao_chat: "uuid, text",
};

const corpoDaFuncao = (texto, cabeca) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(inicio, texto.indexOf("$function$;", inicio));
};
const corpoEntre = (texto, abre, fecha) =>
  texto
    .slice(texto.indexOf(abre) + abre.length, texto.lastIndexOf(fecha))
    .trim();

describe("migration da v1.1 do chat: ordem e padrão MAD", () => {
  it("vem depois da migration do chat e não repete o horário de outra", () => {
    const datas = readdirSync("supabase/migrations")
      .filter((n) => /^\d{14}_/.test(n) && n !== NOME)
      .map((n) => n.slice(0, 14));
    expect(NOME.slice(0, 14) > "20261002210000").toBe(true);
    expect(datas).not.toContain(NOME.slice(0, 14));
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261002210000_chat.sql",
    );
  });

  it("RL_MENSAGEM_REACAO: colunas MAD comentadas, constraints e índice nomeados e comentados", () => {
    const inicio = MIGRATION.indexOf(
      'create table public."RL_MENSAGEM_REACAO" (',
    );
    const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
    const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map((m) => m[1]);
    expect(colunas).toEqual([
      "CO_MENSAGEM",
      "CO_USUARIO",
      "DS_EMOJI",
      "CO_CONVERSA",
      "DT_CRIACAO",
      "DT_ATUALIZACAO",
      "ST_REGISTRO_ATIVO",
    ]);
    for (const coluna of colunas)
      expect(MIGRATION).toContain(
        `comment on column public."RL_MENSAGEM_REACAO"."${coluna}" is`,
      );
    expect(bloco).toContain(
      'constraint "PK_RL_MENSAGEM_REACAO" primary key ("CO_MENSAGEM", "CO_USUARIO", "DS_EMOJI")',
    );
    for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g))
      expect(MIGRATION).toContain(
        `comment on constraint "${nome}" on public."RL_MENSAGEM_REACAO"`,
      );
    expect(MIGRATION).toContain(
      'create index "IN_MENSREACAO_CONVERSA" on public."RL_MENSAGEM_REACAO"',
    );
    expect(MIGRATION).toContain(
      'comment on index public."IN_MENSREACAO_CONVERSA"',
    );
    expect(MIGRATION).toContain('comment on table public."RL_MENSAGEM_REACAO"');
  });

  it("DT_LIMPEZA entra em RL_CONVERSA_PARTICIPANTE com comentário", () => {
    expect(MIGRATION).toContain(
      'alter table public."RL_CONVERSA_PARTICIPANTE" add column "DT_LIMPEZA" timestamptz;',
    );
    expect(MIGRATION).toContain(
      'comment on column public."RL_CONVERSA_PARTICIPANTE"."DT_LIMPEZA" is',
    );
  });

  it("as reações aceitas são as mesmas na tela, no CHECK e em FC_CHAT_REACOES", () => {
    const lista = REACOES_RAPIDAS.map((e) => `'${e}'`).join(", ");
    expect(MIGRATION).toContain(`check ("DS_EMOJI" in (${lista}))`);
    expect(MIGRATION).toContain(`select array[${lista}]::text[];`);
  });
});

describe("migration da v1.1 do chat: acesso", () => {
  it("reações: RLS ligada, leitura pela mesma regra da mensagem, nenhuma escrita direta, Realtime", () => {
    expect(MIGRATION).toContain(
      'alter table public."RL_MENSAGEM_REACAO" enable row level security;',
    );
    expect(MIGRATION).toContain(
      'revoke all on public."RL_MENSAGEM_REACAO" from public, anon, authenticated;',
    );
    expect(MIGRATION).toContain(
      'grant select on public."RL_MENSAGEM_REACAO" to authenticated;',
    );
    expect(MIGRATION).toMatch(
      /create policy "PL_MENSREACAO_LEITURA" on public\."RL_MENSAGEM_REACAO"\s+for select to authenticated using \(private\."FC_CHAT_PODE_LER"\("CO_CONVERSA"\)\);/,
    );
    expect(MIGRATION).not.toMatch(/grant (insert|update|delete|all)/i);
    expect(MIGRATION).not.toMatch(/delete from public\."RL_MENSAGEM_REACAO"/i);
    expect(MIGRATION).toContain(
      'alter publication supabase_realtime add table public."RL_MENSAGEM_REACAO";',
    );
  });

  it.each(Object.entries(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio, recurso chat, acesso à conversa, só authenticated, no contrato e no rollback",
    (nome, assinatura) => {
      const corpo = corpoDaFuncao(MIGRATION, `create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain('private."FC_CHAT_EXIGIR"()');
      expect(corpo).toContain('private."FC_CHAT_EXIGIR_CONVERSA"(');
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
      expect(CONTRATO_RPC[nome]).toBeTruthy();
    },
  );

  it("alternar_reacao_chat confere o emoji e a mensagem apagada e alterna sem apagar a linha", () => {
    const corpo = corpoDaFuncao(
      MIGRATION,
      "create function public.alternar_reacao_chat(",
    );
    expect(corpo).toContain('v_emoji = any (private."FC_CHAT_REACOES"())');
    expect(corpo).toContain(`if v."ST_APAGADA" = 'S' then`);
    expect(corpo).toContain(
      `"ST_REGISTRO_ATIVO" = case when r."ST_REGISTRO_ATIVO" = 'S' then 'N' else 'S' end`,
    );
    expect(CONTRATO_RPC.alternar_reacao_chat.argumentos).toEqual([
      "p_mensagem",
      "p_emoji",
    ]);
  });

  it("limpar grava DT_LIMPEZA só na linha de quem limpou", () => {
    const corpo = corpoDaFuncao(
      MIGRATION,
      "create function public.limpar_conversa_chat(",
    );
    expect(corpo).toContain(
      "values (p_conversa, v_uid, 'MEMBRO', v_agora, v_agora)",
    );
    expect(corpo).toContain('set "DT_LIMPEZA" = v_agora');
    expect(CONTRATO_RPC.limpar_conversa_chat.argumentos).toEqual([
      "p_conversa",
    ]);
  });

  it("listagem, não lidas, menções e última mensagem filtram a limpeza de quem pergunta", () => {
    const listar = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.listar_mensagens_chat(",
    );
    expect(listar).toContain(
      '(v_limpeza is null or m."DT_CRIACAO" > v_limpeza)',
    );
    const conversa = corpoDaFuncao(
      MIGRATION,
      'create or replace function private."FC_CHAT_CONVERSA_JSON"(',
    );
    expect(
      conversa.match(
        /\(eu\."DT_LIMPEZA" is null or x\."DT_CRIACAO" > eu\."DT_LIMPEZA"\)/g,
      ),
    ).toHaveLength(3);
    expect(conversa).toContain(`'limpa_em', eu."DT_LIMPEZA"`);
    const mensagem = corpoDaFuncao(
      MIGRATION,
      'create or replace function private."FC_CHAT_MENSAGEM_JSON"(',
    );
    expect(mensagem).toContain(`'reacoes', case when m."ST_APAGADA" = 'S'`);
  });
});

describe("rollback e ensaio da v1.1 do chat", () => {
  it("o rollback volta os três corpos ao da v1 e tira a tabela e a coluna", () => {
    for (const cabeca of [
      'function private."FC_CHAT_MENSAGEM_JSON"(p_mensagem uuid)',
      'function private."FC_CHAT_CONVERSA_JSON"(p_conversa uuid, p_usuario uuid)',
      "function public.listar_mensagens_chat(",
    ]) {
      const daV1 = corpoDaFuncao(V1, `create ${cabeca}`).replace(
        /^create /,
        "",
      );
      const doRollback = corpoDaFuncao(
        ROLLBACK,
        `create or replace ${cabeca}`,
      ).replace(/^create or replace /, "");
      expect(doRollback).toBe(daV1);
    }
    expect(ROLLBACK).toContain(
      'drop table if exists public."RL_MENSAGEM_REACAO";',
    );
    expect(ROLLBACK).toContain(
      'alter table public."RL_CONVERSA_PARTICIPANTE" drop column if exists "DT_LIMPEZA";',
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_CHAT_REACOES"();',
    );
  });

  it("o ensaio tem o mesmo corpo da migration, entre begin e rollback", () => {
    expect(
      corpoEntre(
        ENSAIO,
        "-- ═══ CORPO DA MIGRATION (início) ═══\n",
        "-- ═══ CORPO DA MIGRATION (fim) ═══",
      ),
    ).toBe(corpoEntre(MIGRATION, "\nbegin;\n", "\ncommit;"));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("confere que limpar esconde só para quem limpou e que só participante reage; volta o papel antes do resumo", () => {
    for (const marca of [
      "FALHOU E3: alternar não tirou a reação de B",
      "FALHOU E4: C reagiu na direta de A e B",
      "FALHOU E4: C vê as reações da direta pela RLS",
      "FALHOU E5: B ainda vê mensagens depois de limpar",
      "FALHOU E5: limpar de B escondeu mensagens de A",
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
