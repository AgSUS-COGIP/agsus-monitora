import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { validarRegraAnalise } from "../src/lib/avaliacao-documental/regra.js";
import { niveisDoRecurso, RESOURCES } from "../src/lib/permissoes-recursos.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  As migrations da Avaliação documental, fase F1 (ainda não aplicadas: os
  ensaios begin…rollback estão em supabase/ensaios/). Aqui, as invariantes
  estáticas: padrão MAD (prefixos, maiúsculas entre aspas, nomes ≤ 30,
  constraints nomeadas, COMMENT ON), RLS sem acesso direto, RPCs SECURITY
  DEFINER com search_path vazio e o porteiro do recurso novo, contrato de RPC,
  ensaio com o corpo idêntico, rollback e os modelos da correção iguais aos
  casos dourados.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const MENU = "20261006090000_avaliacao_documental_permissao_e_menu.sql";
const REGRA = "20261006100000_regra_da_analise.sql";
const LIGA = "20261006090500_liga_aba_avaliacao_documental.sql";
const MIGRATION = ler(`supabase/migrations/${REGRA}`);
const MIGRATION_MENU = ler(`supabase/migrations/${MENU}`);
const CORRECAO = ler(
  "supabase/correcoes/20261006-modelos-da-regra-da-analise.sql",
);
const CASOS = JSON.parse(
  ler("tests/fixtures/avaliacao-documental/casos-de-pontuacao.json"),
);

const TABELAS = [
  "TB_REGRA_ANALISE_MODELO",
  "TB_REGRA_ANALISE",
  "TH_REGRA_ANALISE",
  "RL_ANALISTA_EDITAL",
  "TD_ALDEIA_DSEI",
  "TB_ORIGEM_ANALISE_EDITAL",
  "TH_ORIGEM_ANALISE_EDITAL",
];
// RPC → argumentos e quem pode (porteiro).
const RPCS = {
  listar_editais_avaliacao: {
    args: ["p_area"],
    porteiro: "pode_recurso('avaliacao_documental', 1)",
  },
  obter_regra_analise: {
    args: ["p_edital"],
    porteiro: 'FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
  },
  salvar_regra_analise: {
    args: ["p_edital", "p_configuracao", "p_versao_atual", "p_motivo"],
    porteiro: 'FC_EXIGIR_COORD_AVALIACAO"(p_edital)',
  },
  copiar_modelo_regra_analise: {
    args: ["p_edital", "p_modelo"],
    porteiro: 'FC_EXIGIR_COORD_AVALIACAO"(p_edital)',
  },
  conferir_regra_analise: {
    args: ["p_edital", "p_versao"],
    porteiro: 'FC_EXIGIR_COORD_AVALIACAO"(p_edital)',
  },
  obter_equipe_edital: {
    args: ["p_edital"],
    porteiro: 'FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 1)',
  },
  salvar_equipe_edital: {
    args: ["p_edital", "p_equipe", "p_motivo"],
    porteiro: 'FC_EXIGIR_COORD_AVALIACAO"(p_edital)',
  },
  salvar_aldeias_dsei: {
    args: ["p_unidade", "p_aldeias", "p_fonte"],
    porteiro: "private.is_master()",
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

describe("permissão e menu (20261006090000)", () => {
  it("o recurso novo entra na lista do banco e na matriz do front, com três níveis", () => {
    expect(MIGRATION_MENU).toMatch(
      /select array\[[^\]]*'chat','avaliacao_documental'\]::text\[\];/,
    );
    expect(RESOURCES).toContainEqual([
      "avaliacao_documental",
      "Avaliação documental",
    ]);
    expect(niveisDoRecurso("avaliacao_documental").map(([n]) => n)).toEqual([
      "sem_acesso",
      "leitor",
      "editor",
      "admin",
    ]);
  });

  it("semente: administrador global, gestor e coordenador = admin; os demais sem acesso", () => {
    expect(MIGRATION_MENU).toContain(`when g."ST_ADMIN_GLOBAL" then 'admin'`);
    expect(MIGRATION_MENU).toContain(
      `when g."CO_GRUPO_ACESSO" in ('edital_gestor', 'coordenador') then 'admin'`,
    );
    expect(MIGRATION_MENU).toContain("else 'sem_acesso'");
  });

  it("o painel muda só o rótulo; a aba nova entra desligada e a liga vem depois", () => {
    expect(MIGRATION_MENU).toContain(
      `update public."TB_ABA" set "NO_ABA" = 'Painel das análises', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analises';`,
    );
    expect(MIGRATION_MENU).toMatch(
      /'avaliacao-documental', 'Avaliação documental', 'graduation-cap', 5, 'avaliacao-documental', 'avaliacao_documental', 'nativa', 'N', 'S'/,
    );
    expect(ler(`supabase/migrations/${LIGA}`)).toContain(
      `set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'avaliacao-documental'`,
    );
  });
});

describe("nomenclatura MAD (20261006100000)", () => {
  it.each(TABELAS)(
    "%s: prefixo, colunas com prefixo e comentário, constraints nomeadas e comentadas",
    (tabela) => {
      expect(tabela).toMatch(/^(TB|TH|RL|TD)_[A-Z_]+$/);
      expect(tabela.length).toBeLessThanOrEqual(30);
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
      expect(
        bloco
          .split("\n")
          .filter((l) =>
            /^\s+(check|unique|primary key|foreign key)\b/i.test(l),
          ),
      ).toEqual([]);
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
    },
  );

  it("índices, gatilhos e funções com nome no padrão, até 30 caracteres e comentados", () => {
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
    for (const nome of gatilhos) expect(nome).toMatch(/^TG_[A-Z_]+$/);
    for (const nome of funcoes) {
      expect(nome).toMatch(/^FC_[A-Z_]+$/);
      expect(MIGRATION).toContain(`comment on function private."${nome}"(`);
    }
    for (const nome of [...indices, ...gatilhos, ...funcoes])
      expect(nome.length, nome).toBeLessThanOrEqual(30);
    expect(gatilhos.length).toBe(6);
  });
});

describe("acesso: RLS, porteiros e contrato", () => {
  it("RLS ligada em todas as tabelas novas, sem grant nem policy", () => {
    for (const tabela of TABELAS)
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
    expect(MIGRATION).toMatch(
      /revoke all on public\."TB_REGRA_ANALISE_MODELO"[\s\S]*?from public, anon, authenticated;/,
    );
    expect(MIGRATION).not.toMatch(/grant [^;]* on public\."(TB|TH|RL|TD)_/i);
    expect(MIGRATION).not.toMatch(/create policy/i);
    expect(MIGRATION).not.toMatch(/create (temporary|temp) table/i);
  });

  it.each(Object.entries(RPCS))(
    "%s: definer, search_path vazio, porteiro e grant só a authenticated",
    (nome, { args, porteiro }) => {
      const corpo = corpoDaFuncao(`create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toContain(porteiro);
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

  it("funções privadas sem execute para ninguém", () => {
    for (const [, nome, args] of MIGRATION.matchAll(
      /create function private\."([^"]+)"\(([^)]*)\)/g,
    )) {
      const tipos = args
        .split(",")
        .map((a) => a.trim().split(/\s+/).pop())
        .filter(Boolean)
        .join(", ");
      expect(MIGRATION, nome).toContain(
        `revoke all on function private."${nome}"(${tipos}) from public, anon, authenticated;`,
      );
    }
  });

  it("o porteiro exige o recurso, a área e o recorte; a coordenação exige o papel", () => {
    const porteiro = corpoDaFuncao(
      'create function private."FC_EXIGIR_AVALIACAO_EDITAL"(',
    );
    expect(porteiro).toContain(
      "private.pode_recurso('avaliacao_documental', p_minimo)",
    );
    expect(porteiro).toContain('private."FC_PODE_AREA"(v_area)');
    expect(porteiro).toContain(
      'private."FC_EXIGIR_AREA_EDITAL"(p_edital::text)',
    );
    const coordenacao = corpoDaFuncao(
      'create function private."FC_EXIGIR_COORD_AVALIACAO"(',
    );
    expect(coordenacao).toContain('FC_EXIGIR_AVALIACAO_EDITAL"(p_edital, 3)');
    expect(coordenacao).toContain("is distinct from 'COORDENADOR'");
    const papel = corpoDaFuncao(
      'create function private."FC_PAPEL_AVALIACAO"(',
    );
    expect(papel).toContain(
      'private."FC_GESTOR_DO_EDITAL"(v_perfil.id, p_edital)',
    );
  });

  it("salvar valida, cria versão nova (40001 na velha) e nunca muda uma versão", () => {
    const corpo = corpoDaFuncao("create function public.salvar_regra_analise(");
    expect(corpo).toContain(
      'perform private."FC_VALIDAR_REGRA_ANALISE"(p_configuracao);',
    );
    expect(corpo).toContain("errcode = '40001'");
    expect(corpo).toContain('insert into public."TH_REGRA_ANALISE"');
    expect(MIGRATION).not.toMatch(/update public\."TH_REGRA_ANALISE"/);
    expect(MIGRATION).not.toMatch(/delete from public\./);
  });

  it("a equipe diz a permissão que falta (AM-3.2) e só desativa quem sai", () => {
    const corpo = corpoDaFuncao("create function public.salvar_equipe_edital(");
    expect(corpo).toContain("não tem Editor em Avaliação documental");
    expect(corpo).toContain("não tem Administrador em Avaliação documental");
    expect(corpo).toContain(`set "ST_ATIVO" = 'N'`);
  });

  it("as perguntas da carga vão só para a coordenação e sem resposta única", () => {
    const corpo = corpoDaFuncao("create function public.obter_regra_analise(");
    expect(corpo).toContain(
      "'perguntas', case when coalesce(v_coordena, false)",
    );
    expect(corpo).toContain("r.qt >= 2");
  });
});

describe("ensaios e rollbacks", () => {
  it.each([MENU, REGRA])(
    "%s: o ensaio traz o corpo sem mudança e termina em rollback",
    (nome) => {
      const migration = ler(`supabase/migrations/${nome}`);
      const ensaio = ler(`supabase/ensaios/${nome}`);
      const linhas = migration.split("\n");
      const corpo = linhas
        .slice(linhas.indexOf("begin;") + 1, linhas.lastIndexOf("commit;"))
        .join("\n");
      expect(ensaio).toContain(corpo);
      expect(ensaio.trim().endsWith("rollback;")).toBe(true);
      expect(ensaio).not.toMatch(/^commit;/m);
      expect(ensaio).toContain("ENSAIO OK");
      expect(ensaio).toContain("raise exception 'FALHOU");
    },
  );

  it("o ensaio da regra usa o grupo de administrador global que já existe e lê as tabelas depois de reset role", () => {
    const ensaio = ler(`supabase/ensaios/${REGRA}`);
    expect(ensaio).not.toMatch(/insert into public\."TB_GRUPO_ACESSO"/);
    expect(ensaio.indexOf("reset role;")).toBeGreaterThan(
      ensaio.indexOf("set local role authenticated;"),
    );
    expect(ensaio).not.toMatch(/if case/);
  });

  it("os rollbacks desfazem tudo o que as migrations criam", () => {
    const rollback = ler(`supabase/rollback/${REGRA}`);
    for (const tabela of TABELAS)
      expect(rollback).toContain(`drop table if exists public."${tabela}";`);
    for (const nome of Object.keys(RPCS))
      expect(rollback).toContain(`drop function if exists public.${nome}(`);
    const rollbackMenu = ler(`supabase/rollback/${MENU}`);
    expect(rollbackMenu).toContain(
      `delete from public."TB_ABA" where "CO_ABA" = 'avaliacao-documental';`,
    );
    expect(rollbackMenu).toContain(
      `delete from public."TA_GRUPO_ACESSO_RECURSO" where "NO_RECURSO" = 'avaliacao_documental';`,
    );
    expect(rollbackMenu).toContain("'Análises curriculares'");
    expect(ler(`supabase/rollback/${LIGA}`)).toContain(`set "ST_ATIVO" = 'N'`);
  });
});

describe("modelos da correção", () => {
  const modelos = Object.fromEntries(
    [
      ...CORRECAO.matchAll(
        /\('([A-Z0-9-]+)', '(?:[^']|'')*', \$modelo\$(.*?)\$modelo\$::jsonb\)/g,
      ),
    ].map((m) => [m[1], JSON.parse(m[2])]),
  );

  it("traz o de Projetos (piloto 93/2026), o do simulador do 28/2026 e o do 100/2026", () => {
    expect(Object.keys(modelos).sort()).toEqual([
      "PROJ26-CURRICULAR",
      "SI26-100",
      "SI26-INTERIOR-SUL",
    ]);
  });

  it.each(["PROJ26-CURRICULAR", "SI26-100", "SI26-INTERIOR-SUL"])(
    "%s é válido e igual à cópia dos casos dourados",
    (codigo) => {
      expect(validarRegraAnalise(modelos[codigo])).toEqual([]);
      expect(modelos[codigo]).toEqual(CASOS.regras[codigo]);
      expect(modelos[codigo].modelo).toBe(codigo);
    },
  );

  it("o modelo de Projetos não tem critério étnico; os da Saúde Indígena têm pesos diferentes", () => {
    const etnico = (codigo) =>
      modelos[codigo].blocos.find((b) => b.tipo === "PONTUACAO");
    expect(etnico("PROJ26-CURRICULAR")).toBeUndefined();
    expect([
      etnico("SI26-INTERIOR-SUL").indigena,
      etnico("SI26-INTERIOR-SUL").aldeia,
    ]).toEqual([7, 5]);
    expect([etnico("SI26-100").indigena, etnico("SI26-100").aldeia]).toEqual([
      8, 6,
    ]);
  });

  it("o 93/2026 fica em PLANILHA e a correção valida os modelos no banco", () => {
    expect(CORRECAO).toContain(
      `private."FC_NUMERO_EDITAL"(m.edital) = '93/2026'`,
    );
    expect(CORRECAO).toContain("'PLANILHA'");
    expect(CORRECAO).toContain(
      'perform private."FC_VALIDAR_REGRA_ANALISE"(v_modelo."DS_CONFIGURACAO");',
    );
  });
});
