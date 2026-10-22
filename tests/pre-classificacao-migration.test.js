import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da Avaliação documental, fase F2 (pré-classificação por ART,
  lote de convocação e as listas PROVISORIA e LOTE), ainda não aplicada: o
  ensaio begin…rollback está em supabase/ensaios/. Aqui, as invariantes
  estáticas: padrão MAD, RLS sem acesso direto, RPCs SECURITY DEFINER com
  search_path vazio, job só pelo service_role, a tela pelo porteiro do recurso,
  contrato de RPC, ensaio com o corpo idêntico e rollback completo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261006110000_pre_classificacao_e_lote.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

const TABELAS = [
  "TL_PRE_CLASSIFICACAO",
  "TB_PRE_CLASSIFICACAO",
  "TB_PRE_CLASSIF_VAGA",
  "TH_PRE_CLASSIFICACAO",
];
const JOB = {
  pre_classificacao_ler_editais: "text[], boolean",
  pre_classificacao_ler_candidatos: "uuid, text",
  iniciar_pre_classificacao: "text, text, uuid, text, boolean, jsonb",
  gravar_pre_classificacao_vaga: "text, uuid, text, integer, jsonb, jsonb",
  finalizar_pre_classificacao: "text, jsonb, text",
};
const TELA = {
  obter_pre_classificacao: {
    args: ["p_edital"],
    porteiro: 'FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
  },
  registrar_lista_pre_classificacao: {
    args: ["p_edital", "p_tipo", "p_lote"],
    porteiro: 'FC_EXIGIR_CLASSIFICACAO_EDITAL"(p_edital, 2)',
  },
};

const blocoDaTabela = (tabela) => {
  const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
  expect(inicio, tabela).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
};
const corpoDaFuncao = (cabeca) => {
  const inicio = MIGRATION.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return MIGRATION.slice(
    inicio,
    MIGRATION.indexOf(
      "$function$;",
      MIGRATION.indexOf("as $function$", inicio),
    ) + 11,
  );
};

describe("nomenclatura MAD (20261006110000)", () => {
  it.each(TABELAS)(
    "%s: prefixo, colunas com prefixo e comentário, constraints nomeadas e comentadas",
    (tabela) => {
      expect(tabela).toMatch(/^(TB|TH|TL)_[A-Z_]+$/);
      expect(tabela.length).toBeLessThanOrEqual(30);
      const bloco = blocoDaTabela(tabela);
      const colunas = bloco
        .split("\n")
        .slice(1)
        .map((l) => l.trim())
        .filter((l) => l.startsWith('"'))
        .map((l) => l.match(/^"([^"]+)"/)[1]);
      expect(colunas.length).toBeGreaterThan(0);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|NO|DS|TP|ST|NU|QT|VL|DT)_[A-Z_]+$/);
        expect(coluna.length).toBeLessThanOrEqual(30);
        expect(MIGRATION, `${tabela}.${coluna}`).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      const constraints = [...bloco.matchAll(/constraint "([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(constraints).toContain(`PK_${tabela}`);
      for (const c of constraints) {
        expect(c).toMatch(/^(PK|FK|CK|UK)_[A-Z_]+$/);
        expect(c.length, c).toBeLessThanOrEqual(30);
        expect(MIGRATION, c).toContain(
          `comment on constraint "${c}" on public."${tabela}" is`,
        );
      }
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
    },
  );

  it("índices, gatilhos e funções privadas com nome no padrão, até 30 caracteres e comentados", () => {
    const indices = [
      ...MIGRATION.matchAll(/create (?:unique )?index "([^"]+)"/g),
    ].map((m) => m[1]);
    const gatilhos = [...MIGRATION.matchAll(/create trigger "([^"]+)"/g)].map(
      (m) => m[1],
    );
    const funcoes = [
      ...MIGRATION.matchAll(/create function private\."([^"]+)"/g),
    ].map((m) => m[1]);
    for (const nome of indices) {
      expect(nome).toMatch(/^(IN|UK)_[A-Z_]+$/);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
    for (const nome of gatilhos) {
      expect(nome).toMatch(/^TG_[A-Z0-9_]+$/);
      expect(MIGRATION).toContain(`comment on trigger "${nome}" on public.`);
    }
    for (const nome of funcoes) {
      expect(nome).toMatch(/^FC_[A-Z0-9_]+$/);
      expect(MIGRATION).toContain(`comment on function private."${nome}"(`);
      expect(MIGRATION).toContain(`revoke all on function private."${nome}"(`);
    }
    for (const nome of [...indices, ...gatilhos, ...funcoes])
      expect(nome.length, nome).toBeLessThanOrEqual(30);
  });
});

describe("acesso: RLS, job e tela", () => {
  it("RLS ligada nas tabelas novas, sem grant, policy nem tabela temporária", () => {
    for (const tabela of TABELAS)
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
    expect(MIGRATION).toMatch(
      /revoke all on public\."TL_PRE_CLASSIFICACAO"[\s\S]*?from public, anon, authenticated;/,
    );
    expect(MIGRATION).not.toMatch(/grant [^;]* on public\."(TB|TH|TL)_/i);
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).not.toMatch(/create (temporary|temp) table/i);
  });

  it("nada se apaga e o histórico não muda (gatilhos)", () => {
    for (const tabela of [
      "TB_PRE_CLASSIFICACAO",
      "TB_PRE_CLASSIF_VAGA",
      "TL_PRE_CLASSIFICACAO",
    ])
      expect(MIGRATION).toMatch(
        new RegExp(
          `before delete on public\\."${tabela}"\\s+for each row execute function private\\."FC_TG_PRE_CLASSIF_IMUTAVEL"`,
        ),
      );
    expect(MIGRATION).toContain(
      'before update or delete on public."TH_PRE_CLASSIFICACAO"',
    );
  });

  it.each(Object.entries(JOB))(
    "%s: definer, search_path vazio, só service_role e fora do contrato do front",
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
      expect(CONTRATO_RPC[nome]).toBeUndefined();
    },
  );

  it.each(Object.entries(TELA))(
    "%s: definer, search_path vazio, porteiro, grant só a authenticated e no contrato",
    (nome, { args, porteiro }) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain(porteiro);
      expect(MIGRATION).toMatch(
        new RegExp(
          `revoke all on function public\\.${nome}\\([^)]*\\) from public, anon;`,
        ),
      );
      expect(MIGRATION).toMatch(
        new RegExp(
          `grant execute on function public\\.${nome}\\([^)]*\\) to authenticated;`,
        ),
      );
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(args);
    },
  );

  it("a gravação confere a regra conferida, a forma, a ficha e o lote", () => {
    const corpo = corpoDaFuncao(
      "create function public.gravar_pre_classificacao_vaga(",
    );
    expect(corpo).toContain(`r."TP_SITUACAO" = 'CONFERIDA'`);
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain("faltam inscritos já pré-classificados");
    expect(corpo).toContain("quem já tem ficha não muda");
    expect(corpo).toContain("quem está no lote só sai eliminado (AM-5.5)");
    expect(corpo).toContain('insert into public."TH_PRE_CLASSIFICACAO"');
    // Contagens e quadro vêm do banco, não do job.
    expect(corpo).toContain(
      'private."FC_QUADRO_DA_VAGA_EMPREGARE"(p_edital, p_vaga)',
    );
    expect(corpo).toContain("count(*) filter (where t.situacao = 'ELIMINADO')");
  });

  it("o job não recebe o cadastro do candidato", () => {
    const corpo = corpoDaFuncao(
      "create function public.pre_classificacao_ler_candidatos(",
    );
    expect(corpo).toMatch(/nome\|e-\?mail\|cpf\|telefone\|celular/);
    expect(corpo).not.toContain('"NO_CANDIDATO"');
    expect(corpo).not.toContain('"NU_CPF"');
    expect(corpo).not.toContain('"DS_EMAIL"');
  });

  it("as listas novas e o Status das atualizações", () => {
    expect(MIGRATION).toContain(
      `check ("TP_LISTA" in ('PROVISORIA', 'LOTE', 'PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL'))`,
    );
    expect(
      corpoDaFuncao("create or replace function public.get_saude_das_cargas("),
    ).toContain("'pre_classificacao', (");
    expect(
      corpoDaFuncao(
        "create function public.pode_recalcular_pre_classificacao(",
      ),
    ).toContain(`private."FC_PAPEL_AVALIACAO"(p_edital) = 'COORDENADOR'`);
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio traz o corpo sem mudança e termina em rollback", () => {
    const linhas = MIGRATION.split("\n");
    const corpo = linhas
      .slice(linhas.indexOf("begin;") + 1, linhas.lastIndexOf("commit;"))
      .join("\n");
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("ENSAIO OK");
    expect(ENSAIO).toContain("raise exception 'FALHOU");
    expect(ENSAIO).not.toMatch(/insert into public\."TB_GRUPO_ACESSO"/);
    expect(ENSAIO.indexOf("reset role;")).toBeGreaterThan(
      ENSAIO.indexOf("set local role authenticated;"),
    );
    expect(ENSAIO).not.toMatch(/if case/);
  });

  it("o rollback desfaz tudo o que a migration cria", () => {
    for (const tabela of TABELAS)
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
    for (const nome of [
      ...Object.keys(JOB),
      ...Object.keys(TELA),
      "pode_recalcular_pre_classificacao",
    ])
      expect(ROLLBACK).toContain(`drop function if exists public.${nome}(`);
    for (const [, nome] of MIGRATION.matchAll(
      /create function private\."([^"]+)"/g,
    ))
      expect(ROLLBACK).toContain(`drop function if exists private."${nome}"(`);
    expect(ROLLBACK).toContain(
      `drop trigger if exists "TG_THREGRAANALISE_CAMPOSF2"`,
    );
    expect(ROLLBACK).toContain(
      `check ("TP_LISTA" in ('PRELIMINAR', 'CONVOCACAO', 'ENTREVISTA', 'FINAL'))`,
    );
    expect(ROLLBACK).toContain(
      "create or replace function public.get_saude_das_cargas()",
    );
    expect(ROLLBACK).not.toContain("'pre_classificacao'");
  });
});
