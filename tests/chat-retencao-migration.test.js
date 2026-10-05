import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PALAVRA_DE_CONFIRMACAO,
  PRAZO_MAXIMO,
  PRAZO_MINIMO,
} from "../src/lib/retencao-do-chat.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da retenção das mensagens do chat (Configurações › Mensagens
  (chat), só administrador global). Invariantes estáticas: padrão MAD, RLS sem
  grant, RPCs SECURITY DEFINER que exigem o administrador global, exclusão
  real, histórico sem o conteúdo das mensagens, tarefa diária no pg_cron,
  rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005190000_chat_retencao_das_mensagens.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const RPCS = {
  obter_retencao_chat: "",
  salvar_retencao_chat: "integer, text",
  zerar_mensagens_chat: "text, text, boolean",
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
const blocoDaTabela = (nome) => {
  const inicio = MIGRATION.indexOf(`create table public."${nome}" (`);
  expect(inicio, nome).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
};

describe("migration da retenção do chat: ordem e padrão MAD", () => {
  it("vem depois das reações do chat e não repete o horário de outra", () => {
    const datas = readdirSync("supabase/migrations")
      .filter((n) => /^\d{14}_/.test(n) && n !== NOME)
      .map((n) => n.slice(0, 14));
    expect(NOME.slice(0, 14) > "20261005100000").toBe(true);
    expect(datas).not.toContain(NOME.slice(0, 14));
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261005100000_chat_limpar_e_reacoes.sql",
    );
  });

  it.each([
    [
      "TB_RETENCAO_CHAT",
      [
        "CO_RETENCAO_CHAT",
        "QT_DIAS_RETENCAO",
        "CO_USUARIO_ATUALIZACAO",
        "DS_EMAIL_ATUALIZACAO",
        "DT_ATUALIZACAO",
      ],
    ],
    [
      "TH_LIMPEZA_CHAT",
      [
        "CO_LIMPEZA_CHAT",
        "TP_LIMPEZA",
        "TP_ORIGEM",
        "QT_DIAS_RETENCAO",
        "DT_CORTE",
        "QT_MENSAGEM_APAGADA",
        "QT_REACAO_APAGADA",
        "QT_CONVERSA_APAGADA",
        "DS_MOTIVO",
        "CO_USUARIO_RESPONSAVEL",
        "DS_EMAIL_RESPONSAVEL",
        "DT_CRIACAO",
      ],
    ],
  ])(
    "%s: colunas MAD comentadas, constraints nomeadas e comentadas",
    (tabela, esperadas) => {
      const bloco = blocoDaTabela(tabela);
      const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      expect(colunas).toEqual(esperadas);
      for (const coluna of colunas)
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      expect(bloco).toContain(`constraint "PK_${tabela}" primary key`);
      for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g))
        expect(MIGRATION).toContain(
          `comment on constraint "${nome}" on public."${tabela}"`,
        );
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
    },
  );

  it("o histórico nunca guarda o conteúdo (nem a chave) das mensagens", () => {
    const bloco = blocoDaTabela("TH_LIMPEZA_CHAT");
    for (const coluna of [
      "DS_TEXTO",
      "DS_LINK_TELA",
      "CO_MENSAGEM",
      "CO_CONVERSA",
    ])
      expect(bloco).not.toContain(`"${coluna}"`);
  });

  it("o prazo vale de 7 a 3.650 dias, igual à regra da tela", () => {
    expect(PRAZO_MINIMO).toBe(7);
    expect(PRAZO_MAXIMO).toBe(3650);
    expect(MIGRATION).toContain(
      `check ("QT_DIAS_RETENCAO" is null or "QT_DIAS_RETENCAO" between ${PRAZO_MINIMO} and ${PRAZO_MAXIMO})`,
    );
    expect(MIGRATION).toContain(
      `p_dias is not null and (p_dias < ${PRAZO_MINIMO} or p_dias > ${PRAZO_MAXIMO})`,
    );
    expect(MIGRATION).toContain(
      `insert into public."TB_RETENCAO_CHAT" ("CO_RETENCAO_CHAT", "QT_DIAS_RETENCAO") values (1, null);`,
    );
  });

  it("tabelas novas com RLS e sem grant para anon/authenticated", () => {
    for (const tabela of ["TB_RETENCAO_CHAT", "TH_LIMPEZA_CHAT"]) {
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated;`,
      );
      expect(MIGRATION).not.toMatch(
        new RegExp(`grant [a-z, ]+ on public\\."${tabela}"`),
      );
    }
  });
});

describe("migration da retenção do chat: RPCs e exclusão", () => {
  it.each(Object.entries(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio, exige o admin global, só authenticated",
    (nome, tipos) => {
      const corpo = corpoDaFuncao(MIGRATION, `create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain('private."FC_CHAT_EXIGIR_ADMIN"()');
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}(${tipos}) from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${tipos}) to authenticated, service_role;`,
      );
      expect(MIGRATION).toContain(`comment on function public.${nome}(`);
      expect(CONTRATO_RPC[nome], `${nome} fora do contrato`).toBeTruthy();
    },
  );

  it("o administrador global é private.is_master(), com 28000 sem sessão e 42501 para os demais", () => {
    const corpo = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_CHAT_EXIGIR_ADMIN"()',
    );
    expect(corpo).toContain("if not private.is_master() then");
    expect(corpo).toContain("errcode = '42501'");
    expect(corpo).toContain("errcode = '28000'");
  });

  it("zerar exige exatamente a palavra ZERAR e o motivo", () => {
    expect(PALAVRA_DE_CONFIRMACAO).toBe("ZERAR");
    const corpo = corpoDaFuncao(
      MIGRATION,
      "create function public.zerar_mensagens_chat(",
    );
    expect(corpo).toContain(
      `if p_confirmacao is distinct from '${PALAVRA_DE_CONFIRMACAO}' then`,
    );
    expect(corpo).toContain('private."FC_CHAT_VALIDAR_MOTIVO"(p_motivo)');
    expect(corpo).toContain('private."FC_CHAT_APAGAR_MENSAGENS"(null)');
  });

  it("a limpeza é exclusão real: reações e depois mensagens, travando antes", () => {
    const corpo = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_CHAT_APAGAR_MENSAGENS"(',
    );
    const trava = corpo.indexOf("for update");
    const reacoes = corpo.indexOf('delete from public."RL_MENSAGEM_REACAO"');
    const mensagens = corpo.indexOf('delete from public."TB_MENSAGEM"');
    expect(trava).toBeGreaterThan(-1);
    expect(reacoes).toBeGreaterThan(trava);
    expect(mensagens).toBeGreaterThan(reacoes);
    expect(corpo).toContain("pg_advisory_xact_lock");
    expect(corpo).not.toMatch(/update public\."TB_MENSAGEM"/);
  });

  it("salvar aplica o prazo na hora e registra; a tarefa só registra quando apaga", () => {
    const salvar = corpoDaFuncao(
      MIGRATION,
      "create function public.salvar_retencao_chat(",
    );
    expect(salvar).toContain("now() - make_interval(days => p_dias)");
    expect(salvar).toContain('insert into public."TH_LIMPEZA_CHAT"');
    const tarefa = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_CHAT_RETENCAO_DIARIA"()',
    );
    expect(tarefa).toMatch(
      /if \(v_apagou->>'mensagens'\)::int > 0 or \(v_apagou->>'reacoes'\)::int > 0 then\s+insert into public\."TH_LIMPEZA_CHAT"/,
    );
  });

  it("conversas só saem no zerar com p_incluir_conversas e sem participante ativo", () => {
    const corpo = corpoDaFuncao(
      MIGRATION,
      "create function public.zerar_mensagens_chat(",
    );
    expect(corpo).toContain("if coalesce(p_incluir_conversas, false) then");
    expect(corpo).toContain('p."DT_SAIDA" is null');
    expect(corpo).toContain('delete from public."TB_CONVERSA"');
    const salvar = corpoDaFuncao(
      MIGRATION,
      "create function public.salvar_retencao_chat(",
    );
    expect(salvar).not.toContain('"TB_CONVERSA"');
  });

  it("agenda a tarefa diária agsus_chat_retencao_diaria (o Status das atualizações a lista)", () => {
    expect(MIGRATION).toContain(
      "perform cron.schedule('agsus_chat_retencao_diaria', '15 6 * * *', v_comando);",
    );
    expect(MIGRATION).toContain(
      `v_comando constant text := 'select private."FC_CHAT_RETENCAO_DIARIA"();';`,
    );
    expect(ler("src/lib/saude-das-cargas.js")).toContain(
      "agsus_chat_retencao_diaria:",
    );
  });

  it("nenhuma função usa `if case … then … end then` (quebra no PL/pgSQL)", () => {
    expect(MIGRATION).not.toMatch(/\bif\s+case\b/i);
  });
});

describe("rollback e ensaio", () => {
  it("o rollback tira tarefa, RPCs, funções e tabelas, e avisa que não recupera o apagado", () => {
    expect(ROLLBACK).toContain("cron.unschedule('agsus_chat_retencao_diaria')");
    for (const [nome, tipos] of Object.entries(RPCS))
      expect(ROLLBACK).toContain(
        `drop function if exists public.${nome}(${tipos});`,
      );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TH_LIMPEZA_CHAT";',
    );
    expect(ROLLBACK).toContain(
      'drop table if exists public."TB_RETENCAO_CHAT";',
    );
    expect(ROLLBACK).toContain("NÃO recupera");
  });

  it("o ensaio tem o mesmo corpo da migration, entre begin e rollback", () => {
    expect(
      corpoEntre(
        ENSAIO,
        "-- ═══ CORPO DA MIGRATION (início) ═══",
        "-- ═══ CORPO DA MIGRATION (fim) ═══",
      ),
    ).toBe(corpoEntre(MIGRATION, "\nbegin;\n", "\ncommit;"));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
  });

  it("o ensaio confere 42501, ZERAR errado, prazo, reações, histórico e tarefa", () => {
    for (const marca of [
      "ok E1",
      "ok E3",
      "ok E5",
      "ok E6",
      "ok E7",
      "ok E8",
      "sqlstate '42501'",
      "zerar_mensagens_chat('zerar'",
      "agsus_chat_retencao_diaria",
      'private."FC_CHAT_RETENCAO_DIARIA"()',
    ])
      expect(ENSAIO).toContain(marca);
    const papel = ENSAIO.indexOf("set local role authenticated;");
    const volta = ENSAIO.indexOf("reset role;", papel);
    const resumo = ENSAIO.indexOf("'ENSAIO OK' as resultado");
    expect(papel).toBeGreaterThan(-1);
    expect(volta).toBeGreaterThan(papel);
    expect(resumo).toBeGreaterThan(ENSAIO.lastIndexOf("reset role;"));
  });
});
