import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da agenda das entrevistas (ainda não aplicada: o ensaio
  begin…rollback está em supabase/ensaios/). Aqui, as invariantes estáticas:
  nomenclatura MAD (prefixos, maiúsculas entre aspas, até 30 caracteres,
  constraints e índices nomeados, COMMENT ON), RLS sem acesso direto, RPCs
  SECURITY DEFINER com search_path vazio e a permissão (entrevistas ou
  classificacao, área e recorte do edital), contrato de RPC, rollback e ensaio
  com o mesmo corpo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261005120000_agenda_das_entrevistas.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);

const TABELAS = [
  "TB_REGRA_AGENDA_ENTREVISTA",
  "TH_REGRA_AGENDA_ENTREVISTA",
  "TB_AGENDA_ENTREVISTA",
  "TH_AGENDA_ENTREVISTA",
];
const RPCS = {
  obter_agenda_entrevista: { assinatura: "uuid", minimo: 1 },
  salvar_regra_agenda_entrevista: {
    assinatura: "uuid, jsonb, integer, text",
    minimo: 2,
  },
  salvar_agenda_entrevista: { assinatura: "uuid, jsonb", minimo: 2 },
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

describe("migration da agenda: tabelas no padrão MAD", () => {
  it.each(TABELAS)(
    "%s: prefixo, colunas tipadas entre aspas, PK nomeada e COMMENT ON em tudo",
    (tabela) => {
      expect(tabela).toMatch(/^(TB|TH)_[A-Z_]+$/);
      expect(tabela.length).toBeLessThanOrEqual(30);
      const bloco = blocoDaTabela(tabela);
      expect(bloco).toContain(`constraint "PK_${tabela}" primary key`);
      const colunas = [...bloco.matchAll(/^\s+"([A-Z_]+)" /gm)].map(
        (m) => m[1],
      );
      expect(colunas.length).toBeGreaterThan(4);
      for (const coluna of colunas) {
        expect(coluna).toMatch(/^(CO|TP|NO|DS|DT|HR|ST|NU|QT)_[A-Z_]+$/);
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

  it("hora em HR_ (time) e dia em DT_ (date); uma entrevista por banca e hora; um horário por convocado", () => {
    const bloco = blocoDaTabela("TB_AGENDA_ENTREVISTA");
    expect(bloco).toContain('"DT_ENTREVISTA" date not null');
    expect(bloco).toContain('"HR_INICIO" time not null');
    expect(bloco).toContain('"HR_FIM" time not null');
    expect(bloco).toContain(
      'constraint "UK_AGENDAENTREV_ANALISE" unique ("CO_MONITORAMENTO", "CO_ANALISE_CURRICULAR")',
    );
    expect(bloco).toContain(
      'constraint "UK_AGENDAENTREV_HORARIO" unique ("CO_MONITORAMENTO", "DT_ENTREVISTA", "HR_INICIO", "NU_BANCA")',
    );
    expect(bloco).toContain(`check ("TP_ORIGEM" in ('GERADA', 'MANUAL'))`);
  });

  it("índices nomeados (IN_) e comentados", () => {
    const indices = [
      ...MIGRATION.matchAll(/create index "([A-Z_]+)" on public/g),
    ].map((m) => m[1]);
    expect(indices.length).toBeGreaterThanOrEqual(4);
    for (const nome of indices) {
      expect(nome).toMatch(/^IN_/);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
  });
});

describe("migration da agenda: acesso", () => {
  it("tabelas sem grant: nada de acesso direto, nem leitura", () => {
    expect(MIGRATION).toContain(
      'revoke all on public."TB_REGRA_AGENDA_ENTREVISTA", public."TH_REGRA_AGENDA_ENTREVISTA",\n  public."TB_AGENDA_ENTREVISTA", public."TH_AGENDA_ENTREVISTA"\n  from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(/grant [^;]*on public\."T[BH]_/i);
  });

  it("o porteiro aceita entrevistas OU classificacao no nível pedido e confere área e recorte do edital", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_EXIGIR_AGENDA_ENTREVISTA"',
    );
    expect(corpo).toContain(
      "private.pode_recurso('entrevistas', p_minimo) or private.pode_recurso('classificacao', p_minimo)",
    );
    expect(corpo).toContain('private."FC_PODE_AREA"(v_area)');
    expect(corpo).toContain('private."FC_EXIGIR_AREA_EDITAL"(p_edital::text)');
  });

  it.each(Object.entries(RPCS))(
    "%s: SECURITY DEFINER, search_path vazio, porteiro no nível certo, só authenticated, contrato e rollback",
    (nome, { assinatura, minimo }) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain(
        `private."FC_EXIGIR_AGENDA_ENTREVISTA"(p_edital, ${minimo})`,
      );
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
      const argumentos = corpo
        .slice(corpo.indexOf("(") + 1, corpo.indexOf(")"))
        .split(",")
        .map((a) => a.trim().split(" ")[0]);
      expect(CONTRATO_RPC[nome]?.argumentos).toEqual(argumentos);
    },
  );

  it("funções privadas sem execução pública", () => {
    for (const [, nome, assinatura] of MIGRATION.matchAll(
      /create function private\."([A-Z_]+)"\(([^)]*)\)/g,
    )) {
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

  it("salvar a agenda recusa repetido, sobreposição na mesma banca e candidato fora do edital; tela desatualizada = 40001", () => {
    const corpo = corpoDaFuncao(
      "create function public.salvar_agenda_entrevista(",
    );
    expect(corpo).toContain("'Candidato repetido na agenda.'");
    expect(corpo).toContain("a.inicio < b.fim and b.inicio < a.fim");
    expect(corpo).toContain("'Há candidato fora deste edital.'");
    expect(corpo).toContain(
      "'A agenda mudou desde que você abriu; recarregue.' using errcode = '40001'",
    );
    expect(corpo).toContain("pg_advisory_xact_lock");
  });

  it("a regra só aceita o fuso de Brasília", () => {
    expect(
      corpoDaFuncao('create function private."FC_VALIDAR_REGRA_AGENDA"'),
    ).toContain("<> 'America/Sao_Paulo'");
  });
});

describe("rollback e ensaio da agenda", () => {
  it("rollback derruba as quatro tabelas", () => {
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

  it("confere leitor, sem área, conflitos e volta o papel antes de ler as tabelas e do resumo", () => {
    for (const marca of [
      "FALHOU E4: leitor salvou a agenda",
      "FALHOU E4: sem a área leu a agenda",
      "FALHOU E4: mesma banca com horário sobreposto passou",
      "FALHOU E4: candidato repetido passou",
      "FALHOU E4: gravação sobre agenda desatualizada",
      "FALHOU E6: alteração sem antes e depois",
    ])
      expect(ENSAIO).toContain(marca);
    const papel = ENSAIO.indexOf("set local role authenticated;");
    const volta = ENSAIO.indexOf("reset role;");
    const e6 = ENSAIO.indexOf("-- E6.");
    const resumo = ENSAIO.indexOf("'ENSAIO OK' as resultado");
    expect(papel).toBeGreaterThan(-1);
    expect(volta).toBeGreaterThan(papel);
    expect(e6).toBeGreaterThan(volta);
    expect(resumo).toBeGreaterThan(e6);
  });
});
