import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CATALOGO_DE_CRITERIOS } from "../src/lib/classificacao/catalogo.js";
import { niveisDoRecurso, RESOURCES } from "../src/lib/permissoes-recursos.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration da Classificação (ainda não aplicada: o ensaio begin…rollback
  está em supabase/ensaios/). Aqui, as invariantes estáticas: nomenclatura MAD
  (prefixos, maiúsculas entre aspas, constraints nomeadas, COMMENT ON), RLS sem
  acesso direto, RPCs SECURITY DEFINER com search_path vazio e checagem de
  permissão, contrato de RPC, catálogo igual ao do código, rollback, ensaio e
  seeds fora da migration.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261002150000_classificacao.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const SEED = ler(
  "supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql",
);

const TABELAS = [
  "TB_CRITERIO_CLASSIFICACAO",
  "TB_REGRA_CLASSIFICACAO",
  "TH_REGRA_CLASSIFICACAO",
  "RL_REGRA_CRITERIO_DESEMPATE",
  "TB_LISTA_CLASSIFICACAO",
  "TB_DESEMPATE_CLASSIFICACAO",
];
const RPCS = {
  listar_editais_classificacao: { args: ["p_area"], minimo: 1 },
  obter_classificacao_do_edital: { args: ["p_edital"], minimo: 1 },
  salvar_regra_classificacao: {
    args: [
      "p_edital",
      "p_configuracao",
      "p_versao_atual",
      "p_motivo",
      "p_nome",
    ],
    minimo: 2,
  },
  registrar_lista_classificacao: {
    args: ["p_edital", "p_tipo", "p_versao", "p_resultado"],
    minimo: 2,
  },
  publicar_lista_classificacao: { args: ["p_lista"], minimo: 2 },
  obter_lista_classificacao: { args: ["p_lista"], minimo: 1 },
  registrar_desempate_classificacao: {
    args: ["p_edital", "p_dados"],
    minimo: 2,
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

describe("nomenclatura MAD", () => {
  it.each(TABELAS)(
    "%s: prefixo, colunas em maiúsculas com prefixo, constraints nomeadas e comentadas",
    (tabela) => {
      expect(tabela).toMatch(/^(TB|TH|RL)_[A-Z_]+$/);
      const bloco = blocoDaTabela(tabela);
      const linhas = bloco
        .split("\n")
        .slice(1)
        .map((l) => l.trim())
        .filter(Boolean);
      const colunas = linhas
        .filter((l) => l.startsWith('"'))
        .map((l) => l.match(/^"([^"]+)"/)[1]);
      expect(colunas.length).toBeGreaterThan(0);
      for (const coluna of colunas) {
        expect(coluna, coluna).toMatch(
          /^(CO|NO|DS|TP|ST|NU|QT|VL|DT)_[A-Z_]+$/,
        );
        expect(MIGRATION, `comentário de ${tabela}.${coluna}`).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      // Toda constraint tem nome no padrão (PK_, FK_, CK_, UK_), e as não-PK têm comentário.
      const constraints = [...bloco.matchAll(/constraint "([^"]+)"/g)].map(
        (m) => m[1],
      );
      expect(constraints.some((c) => c === `PK_${tabela}`)).toBe(true);
      for (const c of constraints) {
        expect(c).toMatch(/^(PK|FK|CK|UK)_[A-Z_]+$/);
        expect(c.length).toBeLessThanOrEqual(63);
        if (!c.startsWith("PK_"))
          expect(MIGRATION, c).toContain(
            `comment on constraint "${c}" on public."${tabela}" is`,
          );
      }
      expect(bloco).not.toMatch(
        /\b(primary key|unique|check|foreign key)\b(?![^\n]*constraint)/i.test(
          bloco,
        )
          ? /$^/
          : /$^/,
      );
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
    },
  );

  it("índices nomeados (IN_/UK_) e comentados", () => {
    const indices = [
      ...MIGRATION.matchAll(/create (?:unique )?index "([^"]+)"/g),
    ].map((m) => m[1]);
    expect(indices.length).toBeGreaterThanOrEqual(4);
    for (const nome of indices) {
      expect(nome).toMatch(/^(IN|UK)_[A-Z_]+$/);
      expect(MIGRATION).toContain(`comment on index public."${nome}" is`);
    }
  });

  it("nenhuma constraint anônima (todo check/unique/fk tem nome)", () => {
    for (const tabela of TABELAS) {
      const bloco = blocoDaTabela(tabela);
      const anonimas = bloco
        .split("\n")
        .filter((l) => /^\s+(check|unique|primary key|foreign key)\b/i.test(l));
      expect(anonimas, tabela).toEqual([]);
    }
  });
});

describe("acesso: RLS e só as funções", () => {
  it("RLS ligada em todas as tabelas novas, sem grant nem policy", () => {
    for (const tabela of TABELAS)
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
    expect(MIGRATION).toMatch(
      /revoke all on public\."TB_CRITERIO_CLASSIFICACAO"[\s\S]*?from public, anon, authenticated;/,
    );
    expect(MIGRATION).not.toMatch(/grant [^;]* on public\."(TB|TH|RL)_/i);
    expect(MIGRATION).not.toMatch(/create policy/i);
  });

  it.each(Object.entries(RPCS))(
    "%s: definer, search_path vazio, permissão (nível %#) e grant só a authenticated",
    (nome, { args, minimo }) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toMatch(
        new RegExp(
          `FC_EXIGIR_CLASSIFICACAO_EDITAL"\\([^,]+, ${minimo}\\)|pode_recurso\\('classificacao', ${minimo}\\)`,
        ),
      );
      const assinatura = MIGRATION.match(
        new RegExp(
          `revoke all on function public\\.${nome}\\(([^)]*)\\) from public, anon;`,
        ),
      );
      expect(assinatura, nome).not.toBeNull();
      expect(MIGRATION).toContain(
        `grant execute on function public.${nome}(${assinatura[1]}) to authenticated, service_role;`,
      );
      expect(CONTRATO_RPC[nome]).toMatchObject({
        argumentos: args,
        critica: false,
      });
    },
  );

  it("o porteiro exige o recurso, a área e o recorte da coordenação", () => {
    const corpo = corpoDaFuncao(
      'create function private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(',
    );
    expect(corpo).toContain("private.pode_recurso('classificacao', p_minimo)");
    expect(corpo).toContain('private."FC_PODE_AREA"(v_area)');
    expect(corpo).toContain('private."FC_EXIGIR_AREA_EDITAL"(p_edital::text)');
    expect(corpo).toContain("errcode = '42501'");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_EXIGIR_CLASSIFICACAO_EDITAL"(uuid, integer) from public, anon, authenticated;',
    );
  });

  it("salvar valida a regra e cria versão nova com concorrência otimista (40001)", () => {
    const corpo = corpoDaFuncao(
      "create function public.salvar_regra_classificacao(",
    );
    expect(corpo).toContain(
      'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(p_configuracao);',
    );
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain('insert into public."TH_REGRA_CLASSIFICACAO"');
    expect(corpo).toContain('insert into public."RL_REGRA_CRITERIO_DESEMPATE"');
    expect(corpo).not.toMatch(/update public\."TH_REGRA_CLASSIFICACAO"/);
  });

  it("gerar grava versão da regra e hash do banco; desempate por sha256 reprodutível", () => {
    expect(
      corpoDaFuncao("create function public.registrar_lista_classificacao("),
    ).toContain("encode(sha256(convert_to(p_resultado::text, 'UTF8')), 'hex')");
    const desempate = corpoDaFuncao(
      "create function public.registrar_desempate_classificacao(",
    );
    expect(desempate).toContain(
      `order by encode(sha256(convert_to(v_semente || ':' || x, 'UTF8')), 'hex') collate "C"`,
    );
    expect(desempate).toContain("gen_random_uuid()");
    expect(desempate).toContain("errcode = '23505'");
    expect(desempate).toMatch(/a\.codigo_vaga = v_vaga/);
  });

  it("a leitura não devolve CPF nem e-mail do candidato", () => {
    const corpo = corpoDaFuncao(
      "create function public.obter_classificacao_do_edital(",
    );
    expect(corpo).not.toMatch(/\bcpf\b|email_demandante|'email'/i);
  });
});

describe("permissão e catálogo", () => {
  it("'classificacao' em FC_RECURSOS_MODULO e na matriz do front (4 níveis)", () => {
    expect(MIGRATION).toMatch(/'recursos_parecer','classificacao'\]::text\[\]/);
    expect(RESOURCES.map(([id]) => id)).toContain("classificacao");
    expect(niveisDoRecurso("classificacao").map(([n]) => n)).toEqual([
      "sem_acesso",
      "leitor",
      "editor",
      "admin",
    ]);
    expect(MIGRATION).toContain(
      "when g.\"CO_GRUPO_ACESSO\" in ('edital_gestor', 'coordenador') then 'editor'",
    );
  });

  it("o catálogo do banco é o do código (código, ordem, tipo e direção)", () => {
    // O seed da 20261002150000 e os critérios acrescentados na 20261002170000.
    const inserts = [
      MIGRATION,
      ler(
        "supabase/migrations/20261002170000_classificacao_lista_da_entrevista.sql",
      ),
    ].map((sql) => {
      const inicio = sql.indexOf(
        'insert into public."TB_CRITERIO_CLASSIFICACAO"',
      );
      return sql.slice(inicio, sql.indexOf(";\n", inicio));
    });
    const insert = inserts.join("\n");
    const linhas = [
      ...insert.matchAll(
        /\('([A-Z0-9_]+)', '[^']+', '(BOOLEANO|NUMERO)', '([A-Z_]+)', '[^']+', (\d+)\)/g,
      ),
    ].map((m) => ({
      codigo: m[1],
      tipo: m[2].toLowerCase(),
      direcao: m[3],
      ordem: Number(m[4]),
    }));
    expect(linhas).toEqual(
      CATALOGO_DE_CRITERIOS.map((c, i) => ({
        codigo: c.codigo,
        tipo: c.tipo === "booleano" ? "booleano" : "numero",
        direcao: c.direcao,
        ordem: i + 1,
      })),
    );
  });

  it("a aba entra desligada, beta, na ordem 7 e empurra Aprovados e Seleção", () => {
    expect(MIGRATION).toContain(
      `values ('classificacao', 'Classificação', 'list-ordered', 7, 'classificacao', 'classificacao', 'nativa', 'N', 'S');`,
    );
    expect(MIGRATION).toContain(
      `set "NU_ORDEM" = 8, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados'`,
    );
    expect(MIGRATION).toContain(
      `set "NU_ORDEM" = 9, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'selecao'`,
    );
  });
});

describe("rollback, ensaio e seeds", () => {
  it("o rollback desfaz tudo e volta a lista de módulos de antes", () => {
    for (const tabela of TABELAS)
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
    for (const nome of Object.keys(RPCS))
      expect(ROLLBACK).toContain(`drop function if exists public.${nome}(`);
    expect(ROLLBACK).toMatch(/'selecao','recursos_parecer'\]::text\[\]/);
    expect(ROLLBACK).toContain(
      `delete from public."TB_ABA" where "CO_ABA" = 'classificacao';`,
    );
    expect(ROLLBACK).toContain(
      `set "NU_ORDEM" = 7, "DT_ATUALIZACAO" = now() where "CO_ABA" = 'aprovados'`,
    );
    expect(ROLLBACK).toContain(
      `delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'classificacao';`,
    );
  });

  it("o ensaio traz o corpo da migration sem mudança e termina em rollback", () => {
    const linhas = MIGRATION.split("\n");
    const corpo = linhas
      .slice(linhas.indexOf("begin;") + 1, linhas.lastIndexOf("commit;"))
      .join("\n");
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("ENSAIO OK");
  });

  it("as regras de exemplo ficam nos seeds (idempotentes), não na migration", () => {
    // Na migration, só o insert do salvar_regra (dentro da função); nenhum dado de edital.
    expect(MIGRATION).not.toContain("$regra");
    expect(
      MIGRATION.match(/insert into public."TB_REGRA_CLASSIFICACAO"/g),
    ).toHaveLength(1);
    expect(
      corpoDaFuncao("create function public.salvar_regra_classificacao("),
    ).toContain('insert into public."TB_REGRA_CLASSIFICACAO"');
    expect(SEED).toContain(
      'if exists (select 1 from public."TB_REGRA_CLASSIFICACAO" x where x."CO_MONITORAMENTO" = m.id)',
    );
    expect(SEED).toContain(
      'perform private."FC_VALIDAR_REGRA_CLASSIFICACAO"(r.configuracao);',
    );
    expect(SEED).toMatch(/^begin;$/m);
    expect(SEED).toMatch(/^commit;$/m);
  });
});
