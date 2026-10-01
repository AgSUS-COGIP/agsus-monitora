import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { niveisDoRecurso, RESOURCES } from "../src/lib/permissoes-recursos.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration do parecer jurídico dos recursos (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Aqui, as invariantes que não
  podem se perder numa edição: decidir confere recursos_parecer no banco.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261001170000_recursos_parecer_juridico.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDe = (fonte, cabeca) => {
  const inicio = fonte.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return fonte.slice(inicio, fonte.indexOf("$function$;", inicio));
};

describe("decidir exige o parecer jurídico no banco", () => {
  it("transicionar_recurso_candidato: definer, search_path vazio, porteiro do recurso e do parecer", () => {
    const corpo = corpoDe(
      MIGRATION,
      "create function public.transicionar_recurso_candidato(",
    );
    expect(corpo).toContain("security definer");
    expect(corpo).toContain("set search_path to ''");
    expect(corpo).toMatch(
      /FC_EXIGIR_RECURSO_ACESSIVEL"\(p_id, case when p_acao = 'enviar_parecer' then 2 else 1 end\)/,
    );
    // Toda ação que não é enviar passa pelo porteiro do parecer.
    expect(corpo).toMatch(
      /if p_acao <> 'enviar_parecer' then\s+perform private\."FC_EXIGIR_PARECER_RECURSO"\(\);/,
    );
    // Parecer obrigatório na decisão; revisão; quem e quando.
    expect(corpo).toContain("not between 10 and 20000");
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain(
      `"CO_USUARIO_DECISAO" = case when v_decisao then v_uid`,
    );
    expect(corpo).toContain("'parecer', p_acao");
  });

  it("o porteiro do parecer é recursos_parecer = editor (42501)", () => {
    expect(
      corpoDe(MIGRATION, 'create function private."FC_PODE_PARECER_RECURSO"('),
    ).toContain("private.pode_recurso('recursos_parecer', 2)");
    const exigir = corpoDe(
      MIGRATION,
      'create function private."FC_EXIGIR_PARECER_RECURSO"(',
    );
    expect(exigir).toContain('private."FC_PODE_PARECER_RECURSO"()');
    expect(exigir).toContain("errcode = '42501'");
  });

  it.each([
    [
      "transicionar_resposta_recurso",
      /if p_acao in \('aprovar', 'devolver', 'marcar_enviada'\) then\s+perform private\."FC_EXIGIR_PARECER_RECURSO"\(\);/,
    ],
    [
      "marcar_etapa_recurso",
      /if p_etapa = 'resposta_candidato' then\s+perform private\."FC_EXIGIR_PARECER_RECURSO"\(\);/,
    ],
    [
      "excluir_recurso_candidato",
      /'PARCIALMENTE_INDEFERIDO'\) then\s+perform private\."FC_EXIGIR_PARECER_RECURSO"\(\);/,
    ],
  ])("%s: publicar ou apagar a decisão exige o parecer", (nome, regra) => {
    expect(
      corpoDe(MIGRATION, `create or replace function public.${nome}(`),
    ).toMatch(regra);
  });

  it("salvar não muda a situação; o cadastro nasce REGISTRADO", () => {
    const corpo = corpoDe(
      MIGRATION,
      "create or replace function public.salvar_recurso_candidato(",
    );
    expect(corpo).toContain("'REGISTRADO',");
    expect(corpo).not.toMatch(/"TP_SITUACAO" = v_novo/);
    expect(corpo).not.toContain("EM_ANALISE'");
    expect(corpo).toContain("muda só pelo fluxo do parecer jurídico");
  });

  it("o gatilho barra qualquer decisão sem o parecer", () => {
    const corpo = corpoDe(
      MIGRATION,
      'create function private."FC_TG_SITUACAO_RECURSO"(',
    );
    expect(corpo).toContain('private."FC_PODE_PARECER_RECURSO"()');
    expect(corpo).toContain(
      `not (old."TP_SITUACAO" = 'REGISTRADO' and new."TP_SITUACAO" = 'EM_ANALISE_JURIDICA')`,
    );
    expect(MIGRATION).toContain(
      'create trigger "TG_RECURSOCANDIDATO_SITUACAO"\n  before insert or update on public."TB_RECURSO_CANDIDATO"',
    );
  });

  it("a leitura devolve pode_decidir; anon não executa a RPC nova", () => {
    expect(
      corpoDe(
        MIGRATION,
        "create or replace function public.get_recursos_da_area(",
      ),
    ).toContain(`'pode_decidir', private."FC_PODE_PARECER_RECURSO"()`);
    expect(MIGRATION).toContain(
      "revoke all on function public.transicionar_recurso_candidato(uuid, text, integer, text) from public, anon;",
    );
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).not.toMatch(
      /grant [a-z, ]+ on (table )?public\."T[BH]_RECURSO/i,
    );
  });
});

describe("dados e permissão", () => {
  it("EM_ANALISE vira REGISTRADO; decididos ganham a marca de parecer", () => {
    expect(MIGRATION).toMatch(
      /set "TP_SITUACAO" = 'REGISTRADO'\s+where "TP_SITUACAO" = 'EM_ANALISE';/,
    );
    expect(MIGRATION).toContain("Decisão registrada antes do parecer jurídico");
  });

  it("recursos_parecer: módulo, dois níveis no banco e na tela, grupo Jurídico", () => {
    expect(MIGRATION).toMatch(/'selecao','recursos_parecer'\]::text\[\]/);
    expect(MIGRATION).toContain(`"TP_NIVEL" in ('sem_acesso', 'editor')`);
    expect(MIGRATION).toContain(`nivel in ('sem_acesso', 'editor')`);
    expect(MIGRATION).toContain("('juridico', 'Jurídico'");
    expect(RESOURCES.map(([id]) => id)).toContain("recursos_parecer");
    expect(niveisDoRecurso("recursos_parecer").map(([n]) => n)).toEqual([
      "sem_acesso",
      "editor",
    ]);
  });

  it("nomes MAD: maiúsculos entre aspas e no máximo 30 caracteres nos objetos novos", () => {
    const novos = [
      ...MIGRATION.matchAll(/add (?:column|constraint) "([A-Z_]+)"/g),
      ...MIGRATION.matchAll(
        /create (?:trigger|function private\.) ?"([A-Z_]+)"/g,
      ),
    ].map((m) => m[1]);
    expect(novos.length).toBeGreaterThan(8);
    for (const nome of novos) expect(nome.length, nome).toBeLessThanOrEqual(30);
  });

  it("o contrato de RPC conhece a nova", () => {
    expect(CONTRATO_RPC.transicionar_recurso_candidato.argumentos).toEqual([
      "p_id",
      "p_acao",
      "p_revisao",
      "p_texto",
    ]);
  });
});

describe("rollback e ensaio", () => {
  it("o rollback volta as 6 funções aos corpos de antes e tira o módulo", () => {
    const antes = {
      "20260929230000_recursos_modelos_anexos_respostas.sql": [
        "get_recursos_da_area",
        "get_recurso_candidato_detalhe",
        "transicionar_resposta_recurso",
      ],
      "20260929190200_recorte_por_coordenacao_nos_recursos.sql": [
        "salvar_recurso_candidato",
        "marcar_etapa_recurso",
        "excluir_recurso_candidato",
      ],
    };
    for (const [arquivo, nomes] of Object.entries(antes)) {
      const origem = ler(`supabase/migrations/${arquivo}`);
      for (const nome of nomes) {
        const deLa = corpoDe(
          origem.replace(
            `create function public.${nome}(`,
            `create or replace function public.${nome}(`,
          ),
          `create or replace function public.${nome}(`,
        );
        expect(ROLLBACK, nome).toContain(deLa);
      }
    }
    expect(ROLLBACK).toContain(
      'drop trigger if exists "TG_RECURSOCANDIDATO_SITUACAO"',
    );
    expect(ROLLBACK).toMatch(/'selecao'\]::text\[\]/);
    expect(ROLLBACK).toContain("TP_ACAO\" = 'parecer'");
  });

  it("o ensaio traz o corpo da migration sem mudança e termina em rollback", () => {
    const linhas = MIGRATION.split("\n");
    const corpo = linhas
      .slice(linhas.indexOf("begin;") + 1, linhas.lastIndexOf("commit;"))
      .join("\n");
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
  });
});
