import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  As migrations da Avaliação documental, fase F3 (fichas, fila, distribuição e
  reserva; lote pela nota mínima e desempate pela experiência declarada), ainda
  não aplicadas: os ensaios begin…rollback estão em supabase/ensaios/ (rodados
  no Supabase real). Aqui, as invariantes estáticas: padrão MAD, RLS sem acesso
  direto, RPCs SECURITY DEFINER com search_path vazio, job só pelo
  service_role, a tela pelo porteiro do recurso, contrato de RPC, ensaio com o
  corpo idêntico e rollback completo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261006120000_fichas_fila_e_reserva.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const NOME_LOTE = "20261006120500_lote_por_nota_minima.sql";
const MIGRATION_LOTE = ler(`supabase/migrations/${NOME_LOTE}`);
const ENSAIO_LOTE = ler(`supabase/ensaios/${NOME_LOTE}`);
const ROLLBACK_LOTE = ler(`supabase/rollback/${NOME_LOTE}`);

const TABELAS = [
  "TB_FICHA_ANALISE",
  "TH_FICHA_ANALISE",
  "TL_ACESSO_FICHA_ANALISE",
  "TB_FILTRO_FILA_ANALISE",
];
const JOB = {
  pre_classificacao_ler_distribuicao: "uuid",
  abrir_fichas_pre_classificacao: "text, uuid, jsonb",
};
const TELA = {
  obter_fila_avaliacao: 'FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
  pegar_proxima_ficha: 'FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 2)',
  reservar_ficha: 'FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 1)',
  renovar_reserva: 'FC_EXIGIR_AVALIACAO_EDITAL"(v_f."CO_MONITORAMENTO", 2)',
  liberar_reserva: 'FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 2)',
  distribuir_fichas: 'FC_EXIGIR_COORD_FICHAS"(p_edital)',
  mandar_fichas_revisao: 'FC_EXIGIR_COORD_FICHAS"(p_edital)',
  abrir_fichas_do_edital: 'FC_EXIGIR_COORD_FICHAS"(p_edital)',
  salvar_filtro_fila: "private.pode_recurso('avaliacao_documental', 1)",
  excluir_filtro_fila: "private.pode_recurso('avaliacao_documental', 1)",
};

const blocoDaTabela = (tabela) => {
  const inicio = MIGRATION.indexOf(`create table public."${tabela}" (`);
  expect(inicio, tabela).toBeGreaterThan(-1);
  return MIGRATION.slice(inicio, MIGRATION.indexOf("\n);", inicio));
};
const corpoDaFuncao = (cabeca, texto = MIGRATION) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(
    inicio,
    texto.indexOf("$function$;", texto.indexOf("as $function$", inicio)) + 11,
  );
};

describe("nomenclatura MAD (20261006120000)", () => {
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
    const gatilhos = [
      ...MIGRATION.matchAll(/create (?:constraint )?trigger "([^"]+)"/g),
    ].map((m) => m[1]);
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
  it("RLS ligada, sem grant direto, policy nem tabela temporária", () => {
    for (const tabela of TABELAS)
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
    expect(MIGRATION).toMatch(
      /revoke all on public\."TB_FICHA_ANALISE"[\s\S]*?from public, anon, authenticated;/,
    );
    expect(MIGRATION).not.toMatch(/grant [^;]* on public\."(TB|TH|TL)_/i);
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).not.toMatch(/create (temporary|temp) table/i);
  });

  it("nada se apaga e o histórico e os acessos não mudam", () => {
    for (const tabela of ["TB_FICHA_ANALISE", "TB_FILTRO_FILA_ANALISE"])
      expect(MIGRATION).toMatch(
        new RegExp(
          `before delete on public\\."${tabela}"\\s+for each row execute function private\\."FC_TG_FICHA_IMUTAVEL"`,
        ),
      );
    for (const tabela of ["TH_FICHA_ANALISE", "TL_ACESSO_FICHA_ANALISE"])
      expect(MIGRATION).toContain(
        `before update or delete on public."${tabela}"`,
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
      expect(CONTRATO_RPC[nome]).toBeUndefined();
    },
  );

  it.each(Object.entries(TELA))(
    "%s: definer, search_path vazio, porteiro, grant só a authenticated e no contrato",
    (nome, porteiro) => {
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
      const args = [
        ...corpo.slice(0, corpo.indexOf(")")).matchAll(/\b(p_[a-z_]+)\b/g),
      ].map((m) => m[1]);
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(args);
    },
  );

  it("Pegar próximo não entrega a mesma ficha a duas pessoas e a reserva tem 15 minutos", () => {
    expect(
      corpoDaFuncao("create function public.pegar_proxima_ficha("),
    ).toMatch(/for update of f skip locked/);
    expect(MIGRATION).toContain("select interval '15 minutes';");
  });

  it("distribuir confere a versão antes e pede motivo para redistribuir", () => {
    const corpo = corpoDaFuncao("create function public.distribuir_fichas(");
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain("AM-6.3");
    expect(corpo).toContain("Informe o motivo para redistribuir");
  });

  it("o nome do candidato sai na fila, o CPF não", () => {
    for (const cabeca of [
      "create function public.obter_fila_avaliacao(",
      'create function private."FC_FICHA_ANALISE_JSON"(',
    ]) {
      const corpo = corpoDaFuncao(cabeca);
      expect(corpo).toContain('"NO_CANDIDATO"');
      expect(corpo).not.toContain('"NU_CPF"');
      expect(corpo).not.toContain('"DS_EMAIL"');
    }
    expect(
      corpoDaFuncao('create function private."FC_ANALISTAS_DO_EDITAL"('),
    ).toContain("case when p_com_nome then");
  });
});

describe("lote pela nota mínima e desempate (20261006120500)", () => {
  it("a validação aceita NOTA_MINIMA e o gatilho aceita os desempates novos", () => {
    expect(MIGRATION_LOTE).toContain(
      `not in ('MULTIPLO_VAGAS', 'FIXO', 'NOTA_MINIMA')`,
    );
    expect(MIGRATION_LOTE).toContain("'Lote: nota mínima de 0 a 1.000.'");
    expect(MIGRATION_LOTE).toContain(
      `not in ('IDOSO', 'EXPERIENCIA_DECLARADA', 'MAIOR_IDADE', 'MAIS_VELHO', 'CANDIDATURA')`,
    );
    expect(MIGRATION_LOTE).toContain("'status', m.status");
  });
});

describe("ensaios e rollbacks", () => {
  it.each([
    [NOME, MIGRATION, ENSAIO],
    [NOME_LOTE, MIGRATION_LOTE, ENSAIO_LOTE],
  ])(
    "%s: o ensaio traz o corpo sem mudança e termina em rollback",
    (_n, mig, ensaio) => {
      const linhas = mig.split("\n");
      const corpo = linhas
        .slice(linhas.indexOf("begin;") + 1, linhas.lastIndexOf("commit;"))
        .join("\n");
      expect(ensaio).toContain(corpo);
      expect(ensaio.trim().endsWith("rollback;")).toBe(true);
      expect(ensaio).not.toMatch(/^commit;/m);
      expect(ensaio).toContain("ENSAIO OK");
      expect(ensaio).toContain("raise exception 'FALHOU");
      expect(ensaio).not.toMatch(/insert into public\."TB_GRUPO_ACESSO"/);
      expect(ensaio.indexOf("reset role;")).toBeGreaterThan(
        ensaio.indexOf("set local role authenticated;"),
      );
      expect(ensaio).not.toMatch(/if case/);
    },
  );

  it("o rollback da F3 desfaz tudo o que a migration cria", () => {
    for (const tabela of TABELAS)
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
    for (const nome of [...Object.keys(JOB), ...Object.keys(TELA)])
      expect(ROLLBACK).toContain(`drop function if exists public.${nome}(`);
    for (const [, nome] of MIGRATION.matchAll(
      /create function private\."([^"]+)"/g,
    ))
      expect(ROLLBACK).toContain(`drop function if exists private."${nome}"(`);
    expect(ROLLBACK).toContain(
      `drop trigger if exists "TG_ANALISTAEDT_FICHAS"`,
    );
    expect(ROLLBACK).toContain(`drop trigger if exists "TG_PRECLASSIF_FICHA"`);
  });

  it("o rollback do lote devolve as três funções às versões anteriores", () => {
    expect(ROLLBACK_LOTE).toContain(`not in ('MULTIPLO_VAGAS', 'FIXO') then`);
    expect(ROLLBACK_LOTE).not.toContain("'EXPERIENCIA_DECLARADA'");
    expect(ROLLBACK_LOTE).not.toContain("'status', m.status");
    expect(ROLLBACK_LOTE).toContain(
      "create or replace function public.listar_editais_avaliacao(p_area text)",
    );
  });
});
