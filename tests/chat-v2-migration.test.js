import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  LIMITE_DO_ANEXO_DO_CHAT,
  MAXIMO_DE_ANEXOS,
  TIPOS_DE_ANEXO,
} from "../src/lib/anexos-do-chat.js";
import { STATUS_DE_PRESENCA } from "../src/lib/chat.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da v2 do chat (anexos, responder e encaminhar, busca, Visto,
  cartões, fixar, não lida e status). Invariantes estáticas: padrão MAD
  (MAIÚSCULAS entre aspas, TB_/RL_/TH_, nomes até 30, constraints nomeadas e
  comentadas), RLS sem grant direto nas tabelas novas, SECURITY DEFINER com
  search_path vazio, nenhum DELETE físico fora da retenção, bucket privado
  com as políticas pelo caminho, o mesmo limite e os mesmos tipos da tela,
  contrato de RPC, ensaio com o mesmo corpo e rollback.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007210000_chat_v2.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const RPCS_NOVAS = {
  obter_mensagem_chat: "uuid",
  encaminhar_mensagem_chat: "uuid, uuid",
  buscar_mensagens_chat: "text, integer",
  fixar_conversa_chat: "uuid, boolean",
  marcar_nao_lida_chat: "uuid",
  definir_status_chat: "text",
  preparar_expurgo_anexos_chat: "",
  confirmar_expurgo_anexos_chat: "text[]",
  enviar_mensagem_chat: "uuid, text, jsonb, uuid[], uuid, uuid, jsonb",
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

describe("migration da v2 do chat: ordem e padrão MAD", () => {
  it("vem depois da retenção, a partir de 20261007210000, sem repetir horário", () => {
    const datas = readdirSync("supabase/migrations")
      .filter((n) => /^\d{14}_/.test(n) && n !== NOME)
      .map((n) => n.slice(0, 14));
    expect(NOME.slice(0, 14) >= "20261007210000").toBe(true);
    expect(datas).not.toContain(NOME.slice(0, 14));
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261005190000_chat_retencao_das_mensagens.sql",
    );
  });

  it.each([
    [
      "TB_ANEXO_MENSAGEM",
      [
        "CO_ANEXO_MENSAGEM",
        "CO_MENSAGEM",
        "CO_CONVERSA",
        "CO_USUARIO_INCLUSAO",
        "NO_ARQUIVO",
        "DS_CAMINHO",
        "DS_MIME",
        "QT_BYTES",
        "DT_CRIACAO",
        "ST_REGISTRO_ATIVO",
      ],
    ],
    [
      "TB_EXPURGO_ANEXO_CHAT",
      ["DS_CAMINHO", "TP_ORIGEM", "DT_CRIACAO", "DT_EXPURGO"],
    ],
    ["TB_STATUS_PRESENCA_CHAT", ["CO_USUARIO", "TP_STATUS", "DT_ATUALIZACAO"]],
  ])(
    "%s: colunas MAD comentadas, constraints nomeadas e comentadas, RLS sem grant",
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
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated;`,
      );
      expect(MIGRATION).not.toMatch(
        new RegExp(`grant [a-z, ]+ on public\\."${tabela}"`),
      );
    },
  );

  it("todo nome novo (tabela, constraint, índice, função) tem até 30 caracteres e prefixo MAD", () => {
    const nomes = [
      ...MIGRATION.matchAll(
        /(?:create table public\.|constraint |create index |create function private\.)"([A-Za-z_]+)"/g,
      ),
    ].map((m) => m[1]);
    expect(nomes.length).toBeGreaterThan(20);
    for (const nome of nomes) {
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      expect(nome, nome).toMatch(/^(TB|RL|TH|PK|FK|CK|UK|IN|FC)_[A-Z0-9_]+$/);
    }
    for (const [, coluna] of MIGRATION.matchAll(/add column "([A-Za-z_]+)"/g))
      expect(coluna).toMatch(/^(CO|ST|QT|DT|DS|NO|TP)_[A-Z_]+$/);
  });

  it("colunas novas de tabelas antigas comentadas", () => {
    for (const [tabela, coluna] of [
      ["TB_MENSAGEM", "CO_MENSAGEM_RESPOSTA"],
      ["TB_MENSAGEM", "ST_ENCAMINHADA"],
      ["TB_MENSAGEM", "QT_ANEXO"],
      ["RL_CONVERSA_PARTICIPANTE", "DT_FIXACAO"],
      ["RL_CONVERSA_PARTICIPANTE", "ST_NAO_LIDA"],
      ["TH_LIMPEZA_CHAT", "QT_ANEXO_APAGADO"],
    ])
      expect(MIGRATION).toContain(
        `comment on column public."${tabela}"."${coluna}" is`,
      );
  });
});

describe("anexos: bucket, políticas e a mesma regra da tela", () => {
  it("bucket privado de 10 MB com os tipos de src/lib/anexos-do-chat.js", () => {
    expect(LIMITE_DO_ANEXO_DO_CHAT).toBe(10485760);
    expect(MIGRATION).toContain(
      "values ('chat-anexos', 'chat-anexos', false, 10485760, private.\"FC_CHAT_TIPOS_ANEXO\"())",
    );
    const tipos = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_CHAT_TIPOS_ANEXO"()',
    );
    const doBanco = [...tipos.matchAll(/'([a-z]+\/[a-z0-9.+-]+)'/g)].map(
      (m) => m[1],
    );
    expect(doBanco).toEqual(TIPOS_DE_ANEXO.map((t) => t.mime));
    const check = MIGRATION.slice(
      MIGRATION.indexOf('constraint "CK_ANEXOMENSAGEM_DSMIME"'),
      MIGRATION.indexOf('constraint "CK_ANEXOMENSAGEM_QTBYTES"'),
    );
    for (const t of TIPOS_DE_ANEXO) expect(check).toContain(`'${t.mime}'`);
    expect(MIGRATION).toContain(
      `check ("QT_ANEXO" between 0 and ${MAXIMO_DE_ANEXOS})`,
    );
  });

  it("caminho sem o nome original; política de envio, leitura e exclusão, sem update", () => {
    expect(MIGRATION).toContain(
      "create policy chat_anexos_storage_insert on storage.objects\nfor insert to authenticated",
    );
    expect(MIGRATION).toContain(
      "create policy chat_anexos_storage_select on storage.objects\nfor select to authenticated",
    );
    expect(MIGRATION).toContain(
      "create policy chat_anexos_storage_delete on storage.objects\nfor delete to authenticated",
    );
    expect(MIGRATION).not.toMatch(/chat_anexos_storage_update/);
    const anexar = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_CHAT_PODE_ANEXAR"(',
    );
    // O uuid só é lido depois de o formato conferir (CASE, não AND).
    expect(anexar).toMatch(/case\s+when coalesce\(p_caminho, ''\) ~/);
    const expurgar = corpoDaFuncao(
      MIGRATION,
      'create function private."FC_CHAT_PODE_EXPURGAR"(',
    );
    expect(expurgar).toContain("private.is_master()");
  });

  it("o envio lê tipo, tamanho e dono do Storage (o navegador não decide)", () => {
    const enviar = corpoDaFuncao(
      MIGRATION,
      "create function public.enviar_mensagem_chat(",
    );
    expect(enviar).toContain("from storage.objects o");
    expect(enviar).toContain("o.metadata->>'mimetype'");
    expect(enviar).toContain("v_objeto.dono is distinct from v_uid::text");
    expect(enviar).toContain("not between 1 and 10485760");
  });
});

describe("RPCs: segurança e contrato", () => {
  it.each(Object.entries(RPCS_NOVAS))(
    "%s: SECURITY DEFINER, search_path vazio, recurso chat ou admin, sem anon, no contrato com os mesmos argumentos",
    (nome, tipos) => {
      const corpo = corpoDaFuncao(MIGRATION, `create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toMatch(
        /private\."FC_CHAT_EXIGIR"\(\)|private\."FC_CHAT_EXIGIR_ADMIN"\(\)/,
      );
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}(${tipos}) from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${tipos}) to authenticated, service_role;`,
      );
      expect(MIGRATION).toContain(`comment on function public.${nome}(`);
      const argumentos = [
        ...corpo
          .slice(corpo.indexOf("("), corpo.indexOf(")\nreturns"))
          .matchAll(/\b(p_[a-z_]+)\b/g),
      ].map((m) => m[1]);
      expect(CONTRATO_RPC[nome]?.argumentos, nome).toEqual(argumentos);
    },
  );

  it("a assinatura antiga do envio sai (sem sobrecarga ambígua no PostgREST)", () => {
    expect(MIGRATION).toContain(
      "drop function public.enviar_mensagem_chat(uuid, text, jsonb, uuid[], uuid);",
    );
  });

  it("toda função nova ou trocada tem search_path vazio", () => {
    const cabecas = [
      ...MIGRATION.matchAll(/create (?:or replace )?function ([^(]+)\(/g),
    ];
    expect(cabecas.length).toBeGreaterThan(25);
    for (const m of cabecas) {
      const corpo = corpoDaFuncao(MIGRATION.slice(m.index), m[0]);
      expect(corpo, m[1]).toContain("set search_path to ''");
    }
  });

  it("status: os mesmos três da tela", () => {
    expect(STATUS_DE_PRESENCA.map((s) => s.valor)).toEqual([
      "DISPONIVEL",
      "OCUPADO",
      "AUSENTE",
    ]);
    expect(MIGRATION).toContain(
      `check ("TP_STATUS" in ('DISPONIVEL', 'OCUPADO', 'AUSENTE'))`,
    );
  });
});

describe("sem DELETE físico fora da retenção", () => {
  it("delete só em FC_CHAT_APAGAR_MENSAGENS (retenção e zerar) e no zerar com conversas", () => {
    const deletes = [...MIGRATION.matchAll(/delete from ([a-z."A-Z_]+)/g)];
    const apagar = corpoDaFuncao(
      MIGRATION,
      'create or replace function private."FC_CHAT_APAGAR_MENSAGENS"(',
    );
    const zerar = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.zerar_mensagens_chat(",
    );
    for (const d of deletes)
      expect(
        apagar.includes(d[0]) || zerar.includes(d[0]),
        `${d[0]} fora da retenção`,
      ).toBe(true);
    expect(MIGRATION).not.toMatch(/delete from storage\./);
  });

  it("apagar a mensagem é lógico e desliga os anexos", () => {
    const apagar = corpoDaFuncao(
      MIGRATION,
      "create or replace function public.apagar_mensagem_chat(",
    );
    expect(apagar).toContain(`set "ST_REGISTRO_ATIVO" = 'N'`);
    expect(apagar).not.toContain("delete from");
  });

  it("a retenção conta os anexos (sem nome nem caminho) e põe o objeto na fila só sem referência", () => {
    const apagar = corpoDaFuncao(
      MIGRATION,
      'create or replace function private."FC_CHAT_APAGAR_MENSAGENS"(',
    );
    expect(apagar).toContain('insert into public."TB_EXPURGO_ANEXO_CHAT"');
    expect(apagar).toMatch(
      /where not exists \(select 1 from public\."TB_ANEXO_MENSAGEM" a where a\."DS_CAMINHO" = c\)/,
    );
    for (const f of ["salvar_retencao_chat", "zerar_mensagens_chat"])
      expect(
        corpoDaFuncao(MIGRATION, `create or replace function public.${f}(`),
      ).toContain('"QT_ANEXO_APAGADO"');
  });
});

describe("Visto sem expor para quem não participa", () => {
  it("a política de leitura dos participantes exige participar (ou ser a própria linha)", () => {
    expect(MIGRATION).toMatch(
      /create policy "PL_CONVPARTICIP_LEITURA"[\s\S]+"CO_USUARIO" = \(select auth\.uid\(\)\) or private\."FC_CHAT_PARTICIPA"\("CO_CONVERSA"\)/,
    );
    const conversa = corpoDaFuncao(
      MIGRATION,
      'create or replace function private."FC_CHAT_CONVERSA_JSON"(',
    );
    expect(conversa).toMatch(
      /when eu\."CO_USUARIO" is not null and eu\."DT_SAIDA" is null\s+then jsonb_build_object\('lida_em'/,
    );
  });
});

describe("rollback e ensaio", () => {
  it("o rollback volta a assinatura antiga, tira as tabelas, colunas e políticas, e para com anexos", () => {
    for (const [nome, tipos] of Object.entries(RPCS_NOVAS))
      expect(ROLLBACK).toContain(
        `drop function if exists public.${nome}(${tipos});`,
      );
    expect(ROLLBACK).toContain(
      "create function public.enviar_mensagem_chat(\n  p_conversa uuid,",
    );
    for (const tabela of [
      "TB_ANEXO_MENSAGEM",
      "TB_EXPURGO_ANEXO_CHAT",
      "TB_STATUS_PRESENCA_CHAT",
    ])
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
    expect(ROLLBACK).toContain(
      "drop policy if exists chat_anexos_storage_select on storage.objects;",
    );
    expect(ROLLBACK).toContain('drop column "QT_ANEXO"');
    expect(ROLLBACK).toMatch(
      /if exists \(select 1 from public\."TB_ANEXO_MENSAGEM"\)[\s\S]+raise exception/,
    );
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

  it("o ensaio percorre E1…E13 com atores sintéticos e o admin global do grupo admin", () => {
    for (const marca of [
      "ok E1",
      "ok E5",
      "ok E6",
      "ok E7b",
      "ok E8",
      "ok E9",
      "ok E10",
      "ok E11",
      "ok E12c",
      "ok E13",
      "'ENSAIO OK' as resultado",
    ])
      expect(ENSAIO).toContain(marca);
    expect(ENSAIO).toContain("'Ensaio Diana', 'admin', true");
    expect(ENSAIO).not.toMatch(
      /"ST_ADMIN_GLOBAL"[^)]*\)\s*values \([^)]*true, \d+\)/,
    );
  });
});
