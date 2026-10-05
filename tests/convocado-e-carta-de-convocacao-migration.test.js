import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration do status Convocado e da carta de convocação (ainda não
  aplicada: o ensaio begin…rollback está em supabase/ensaios/). Histórias em
  docs/historias-de-usuario/lista-de-aprovados.md. Aqui, as invariantes
  estáticas: Fim de Fila fora e Convocado com data, nomenclatura MAD, RLS sem
  acesso direto, RPCs SECURITY DEFINER com search_path vazio e permissão,
  nada apagado, contados como contratados só Contratado e Migração, contrato
  de RPC, rollback e ensaio com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005180000_convocado_e_carta_de_convocacao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("$function$;", inicio));
};

const RPCS = {
  alterar_status_candidato_aprovado: "uuid, text, text, text, date",
  marcar_candidatos_convocados: "uuid[], date, uuid",
  listar_modelos_carta_convocacao: "text",
  salvar_modelo_carta_convocacao: "uuid, text, uuid, jsonb, integer, text",
  definir_modelo_carta_ativo: "uuid, boolean, text",
  registrar_carta_convocacao: "uuid, integer, uuid[], text, text, jsonb",
  listar_cartas_do_candidato: "uuid",
  listar_convocacoes_aprovados: "text",
};

const TABELAS = [
  "TB_MODELO_CARTA_CONVOCACAO",
  "TH_MODELO_CARTA_CONVOCACAO",
  "TH_CARTA_CONVOCACAO",
  "RL_CARTA_CANDIDATO",
];

describe("migration do Convocado: status", () => {
  it("Fim de Fila sai do domínio e da função; Convocado entra com a data", () => {
    const dominio = MIGRATION.slice(
      MIGRATION.indexOf('add constraint "CK_CANDIDATO_APROVADO_STATUS"'),
      MIGRATION.indexOf('add constraint "CK_CANDAPROVADO_DTCONVOCACAO"'),
    );
    expect(dominio).toContain("'Convocado'");
    expect(dominio).not.toContain("Fim de Fila");
    const funcao = corpoDaFuncao(
      "create function public.alterar_status_candidato_aprovado(",
    );
    expect(funcao).not.toContain("Fim de Fila");
    expect(funcao).toContain(
      "'Convocado', 'Contratado', 'Desistente', 'Migração', 'Documentação Rejeitada'",
    );
    expect(MIGRATION).toContain(
      "drop function public.alterar_status_candidato_aprovado(uuid, text, text, text);",
    );
    // Para se alguém ainda estiver em Fim de Fila (a troca é decisão manual).
    expect(MIGRATION).toContain(
      "if exists (select 1 from public.\"TB_CANDIDATO_APROVADO\" where status = 'Fim de Fila') then",
    );
    expect(MIGRATION).not.toMatch(
      /update public\."TB_CANDIDATO_APROVADO"\s+set status = null/i,
    );
  });

  it("Convocado sempre com data, nunca futura; do Convocado o editor segue o fluxo, sem status só o admin", () => {
    expect(MIGRATION).toContain(
      `(status is distinct from 'Convocado' or "DT_CONVOCACAO" is not null)`,
    );
    const funcao = corpoDaFuncao(
      "create function public.alterar_status_candidato_aprovado(",
    );
    expect(funcao).toContain("if p_data_convocacao > v_hoje then");
    expect(funcao).toContain(
      "and not (v_candidato.status = 'Convocado' and v_status is not null) then",
    );
    expect(funcao).toContain(`"DT_CONVOCACAO" = v_data`);
    expect(funcao).toContain("private.pode_recurso('aprovados', 2)");
    expect(funcao).toContain('private."FC_EXIGIR_AREA_EDITAL"');
  });

  it("marcar vários: só sem status ou já convocados, ligado à carta, tudo ou nada na permissão", () => {
    const funcao = corpoDaFuncao(
      "create function public.marcar_candidatos_convocados(",
    );
    expect(funcao).toContain(
      "elsif v_c.status is not null and v_c.status <> 'Convocado' then",
    );
    expect(funcao).toContain('"CO_CARTA_CONVOCACAO"');
    expect(funcao).toContain('set "DT_CONVOCACAO_MARCADA" = v_data');
    expect(
      funcao.indexOf('private."FC_EXIGIR_AREA_EDITAL"(l.edital_id)'),
    ).toBeLessThan(funcao.indexOf("for v_c in"));
  });

  it("a lista publicada herda a data pelo candidato anterior, sem refazer a publicação", () => {
    expect(MIGRATION).toContain('create trigger "TG_CANDAPROVADO_CONVOCACAO"');
    expect(MIGRATION).toContain(
      'before insert on public."TB_CANDIDATO_APROVADO"',
    );
    expect(MIGRATION).not.toContain(
      "function public.publicar_lista_aprovados_da_classificacao(",
    );
  });

  it("contratados continuam só Contratado e Migração (Seleção e KPIs intocados)", () => {
    expect(MIGRATION).not.toMatch(/get_selecao_da_area\s*\(/);
    expect(MIGRATION).not.toMatch(
      /status in \('Contratado', 'Migração', 'Convocado'\)/,
    );
  });
});

describe("migration da carta de convocação: banco", () => {
  it.each(TABELAS)(
    "%s no padrão MAD: colunas tipadas, constraints nomeadas, COMMENT ON e RLS sem grant",
    (tabela) => {
      expect(tabela.length).toBeLessThanOrEqual(30);
      const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
      expect(inicio).toBeGreaterThan(-1);
      const bloco = MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
      expect(bloco).toContain(`constraint "PK_${tabela}" primary key`);
      const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      expect(colunas.length).toBeGreaterThanOrEqual(5);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|TP|NO|DS|DT|NU|QT|ST)_[A-Z_]+$/);
        expect(coluna.length).toBeLessThanOrEqual(30);
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      for (const [, nome] of bloco.matchAll(/constraint "([A-Z_]+)"/g)) {
        expect(nome.length, nome).toBeLessThanOrEqual(30);
        if (!nome.startsWith("PK_"))
          expect(MIGRATION).toContain(
            `comment on constraint "${nome}" on public."${tabela}"`,
          );
      }
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated;`,
      );
    },
  );

  it("sem grant direto em tabela, colunas legadas não renomeadas, nada apagado", () => {
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\."(TB|TH|RL)_/i);
    expect(MIGRATION).not.toMatch(/rename column/i);
    expect(MIGRATION).not.toMatch(/delete from public\./i);
    expect(MIGRATION).not.toMatch(/truncate public\./i);
    expect(MIGRATION).not.toMatch(/drop table/i);
    for (const [tabela, coluna] of [
      ["TB_CANDIDATO_APROVADO", "DT_CONVOCACAO"],
      ["TH_CANDIDATO_APROVADO", "DT_CONVOCACAO"],
      ["TH_CANDIDATO_APROVADO", "CO_CARTA_CONVOCACAO"],
    ])
      expect(MIGRATION).toContain(
        `comment on column public."${tabela}"."${coluna}" is`,
      );
  });

  it("constraints e índices nomeados (até 30 caracteres) e comentados", () => {
    for (const [, nome] of MIGRATION.matchAll(/constraint "([A-Z_]+)"/g))
      expect(nome.length, nome).toBeLessThanOrEqual(30);
    const indices = [
      ...MIGRATION.matchAll(/create (?:unique )?index "([A-Z_]+)" on public/g),
    ].map((m) => m[1]);
    expect(indices.length).toBeGreaterThanOrEqual(8);
    for (const nome of indices) {
      expect(nome).toMatch(/^IN_/);
      expect(nome.length, nome).toBeLessThanOrEqual(30);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
  });

  it("versões: motivo obrigatório a partir da 2ª, no banco e na RPC; conflito = 40001", () => {
    expect(MIGRATION).toContain(
      `and ("NU_VERSAO" = 1 or "DS_MOTIVO" is not null))`,
    );
    const funcao = corpoDaFuncao(
      "create function public.salvar_modelo_carta_convocacao(",
    );
    expect(funcao).toContain(
      'if p_versao_atual is distinct from v_modelo."NU_VERSAO_VIGENTE" then',
    );
    expect(funcao).toContain("using errcode = '40001'");
    expect(funcao).toContain(
      "raise exception 'Informe o motivo da alteração do modelo.'",
    );
    expect(funcao).toContain("private.pode_recurso('aprovados', 2)");
  });
});

describe("migration da carta de convocação: RPCs", () => {
  it.each(Object.entries(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio, só authenticated, comentada, contrato",
    (nome, assinatura) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toMatch(/set search_path (to|=) ''/);
      expect(corpo).toMatch(/private\.pode_recurso\('aprovados', [123]\)/);
      expect(MIGRATION).toContain(
        `revoke all on function public.${nome}(${assinatura}) from public, anon;`,
      );
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${assinatura}) to authenticated;`,
      );
      expect(MIGRATION).toContain(
        `comment on function public.${nome}(${assinatura}) is`,
      );
      const argumentos = corpo
        .slice(corpo.indexOf("(") + 1, corpo.indexOf(")\nreturns"))
        .split(",")
        .map((a) => a.trim().split(" ")[0])
        .filter(Boolean);
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(argumentos);
    },
  );

  it("emitir: só listas vigentes e ativas, da área do modelo e do edital do modelo, com o recorte", () => {
    const corpo = corpoDaFuncao(
      "create function public.registrar_carta_convocacao(",
    );
    for (const trecho of [
      "'Há candidato de lista inativa ou substituída.'",
      "'Há candidato de outra área que a do modelo.'",
      "'O modelo é de outro edital que o de algum candidato.'",
      'private."FC_PODE_VER_EDITAL"(t.edital)',
      'insert into public."TH_CARTA_CONVOCACAO"',
      'insert into public."RL_CARTA_CANDIDATO"',
    ])
      expect(corpo).toContain(trecho);
  });

  it("leituras: histórico do candidato segue as listas anteriores; convocações da área com o recorte", () => {
    expect(
      corpoDaFuncao("create function public.listar_cartas_do_candidato("),
    ).toContain('c."CO_CANDIDATO_ANTERIOR"');
    const area = corpoDaFuncao(
      "create function public.listar_convocacoes_aprovados(",
    );
    expect(area).toContain('private."FC_EDITAIS_VISIVEIS"()');
    expect(area).toContain('private."FC_AREAS_USUARIO"()');
  });
});

describe("rollback e ensaio do Convocado e da carta", () => {
  it("rollback derruba as RPCs, as tabelas, o gatilho e a coluna; volta a função de 4 argumentos", () => {
    for (const trecho of [
      "drop function if exists public.alterar_status_candidato_aprovado(uuid, text, text, text, date);",
      "drop function if exists public.registrar_carta_convocacao(uuid, integer, uuid[], text, text, jsonb);",
      'drop table if exists public."RL_CARTA_CANDIDATO";',
      'drop table if exists public."TB_MODELO_CARTA_CONVOCACAO";',
      'drop trigger if exists "TG_CANDAPROVADO_CONVOCACAO"',
      'drop column if exists "DT_CONVOCACAO";',
      "CREATE OR REPLACE FUNCTION public.alterar_status_candidato_aprovado(p_candidato_id uuid, p_status text, p_processo_sei text DEFAULT NULL::text, p_matricula text DEFAULT NULL::text)",
      "'Fim de Fila'",
    ])
      expect(ROLLBACK).toContain(trecho);
  });

  it("o ensaio aplica o corpo idêntico ao da migration e termina em rollback", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length,
      MIGRATION.lastIndexOf("\ncommit;"),
    );
    const noEnsaio = ENSAIO.slice(
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (início) ═══\n") +
        "-- ═══ CORPO DA MIGRATION (início) ═══\n".length,
      ENSAIO.indexOf("-- ═══ CORPO DA MIGRATION (fim) ═══"),
    );
    expect(noEnsaio.trim()).toBe(corpo.trim());
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    for (const trecho of [
      "FALHOU E3: leitor salvou modelo",
      "FALHOU E3: aceitou Fim de Fila",
      "FALHOU E3: segunda versão sem motivo",
      "FALHOU E3: editor tirou o status de um convocado",
      "FALHOU E3: marcar convocados",
      "FALHOU E4: o gatilho não herdou a data da convocação",
      "FALHOU E4: o banco aceitou Fim de Fila",
      "exception when insufficient_privilege then null;",
      "reset role;",
      "ENSAIO OK",
    ])
      expect(ENSAIO).toContain(trecho);
    expect(ENSAIO.indexOf("reset role;")).toBeLessThan(
      ENSAIO.indexOf("-- E4. O que ficou gravado."),
    );
  });

  it("PL/pgSQL sem `if case when … then … end then`", () => {
    expect(MIGRATION).not.toMatch(/if\s+case\s+when/i);
    expect(ENSAIO).not.toMatch(/if\s+case\s+when/i);
  });
});
