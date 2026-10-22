import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ABAS_DO_MENU } from "../src/lib/menu-lateral.ts";
import { RESOURCES } from "../src/lib/permissoes-recursos.js";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";
import { ORIGENS_DO_RECURSO } from "../src/lib/prazo-do-recurso.ts";
import { canEditRecursos, canViewRecursos } from "../src/lib/access-roles.js";

/*
  A migration da aba Recursos (ensaiada em produção com begin…rollback em
  29/09/2026: admin cria/edita/marca, usuario lê e recebe 42501 ao gravar,
  gestor de uma área recebe 42501 na outra, anon não executa). Aqui ficam as
  invariantes que não podem se perder numa edição.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler("supabase/migrations/20260929120000_recursos.sql");
const ROLLBACK = ler("supabase/rollback/20260929120000_recursos.sql");
const RPCS = {
  get_recursos_da_area: "text",
  get_recurso_candidato_detalhe: "uuid",
  buscar_candidatos_recurso: "uuid, text",
  salvar_recurso_candidato: "jsonb",
  marcar_etapa_recurso: "uuid, text, boolean",
  excluir_recurso_candidato: "uuid, text",
};

describe("segurança da migration", () => {
  it.each(Object.keys(RPCS))(
    "%s: security definer, search_path vazio e checagem de área",
    (nome) => {
      const inicio = MIGRATION.indexOf(`create function public.${nome}(`);
      expect(inicio).toBeGreaterThan(-1);
      const corpo = MIGRATION.slice(
        inicio,
        MIGRATION.indexOf("$function$;", inicio),
      );
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      expect(corpo).toMatch(
        /private\."FC_EXIGIR_RECURSOS_NA_AREA"\(v?_?\w+, [12]\)/,
      );
    },
  );

  it("as escritas exigem editor (2); as leituras, leitor (1)", () => {
    for (const nome of [
      "salvar_recurso_candidato",
      "marcar_etapa_recurso",
      "excluir_recurso_candidato",
      "buscar_candidatos_recurso",
    ]) {
      const inicio = MIGRATION.indexOf(`create function public.${nome}(`);
      const corpo = MIGRATION.slice(
        inicio,
        MIGRATION.indexOf("$function$;", inicio),
      );
      expect(corpo, nome).not.toMatch(/FC_EXIGIR_RECURSOS_NA_AREA"\(\w+, 1\)/);
    }
  });

  it("anon não executa; tabelas sem grant nem policy (só as funções leem)", () => {
    const lista = Object.entries(RPCS).map(
      ([nome, args]) => `public.${nome}(${args})`,
    );
    for (const assinatura of lista)
      expect(MIGRATION).toContain(`  ${assinatura}`);
    expect(MIGRATION).toContain("from public, anon;");
    expect(MIGRATION).toContain("to authenticated, service_role;");
    expect(MIGRATION).toContain(
      'revoke all on public."TB_ORIGEM_RECURSO", public."TB_RECURSO_CANDIDATO", public."TH_RECURSO_CANDIDATO" from public, anon, authenticated;',
    );
    expect(MIGRATION).not.toMatch(
      /grant [a-z, ]+ on (table )?public\."T[BH]_(ORIGEM_)?RECURSO/i,
    );
    expect(MIGRATION).not.toMatch(/create policy/i);
    for (const tabela of [
      "TB_ORIGEM_RECURSO",
      "TB_RECURSO_CANDIDATO",
      "TH_RECURSO_CANDIDATO",
    ])
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
  });

  it("a leitura da aba é json (não jsonb), numa chamada", () => {
    expect(MIGRATION).toContain(
      "create function public.get_recursos_da_area(p_area text)\nreturns json",
    );
  });
});

describe("permissão 'recursos'", () => {
  it("entra no CHECK, no padrão por perfil, no contexto e na matriz", () => {
    const listas =
      MIGRATION.match(/'aprovados','recursos','importacao'/g) || [];
    // CHECK, nivel_padrao_recurso, obter_contexto_monitora, obter_matriz_acessos e salvar_matriz_acessos.
    expect(listas).toHaveLength(5);
    expect(MIGRATION).toContain(
      "when p_recurso='recursos' and p_perfil='edital_gestor' then 'editor'",
    );
    expect(RESOURCES.map(([id]) => id)).toContain("recursos");
  });

  it("no front: leitor vê, editor edita; sem matriz, admin e gestor editam", () => {
    const perfil = (nivel) => ({
      perfil: "usuario",
      permissoes: { recursos: nivel },
    });
    expect(canViewRecursos(perfil("leitor"))).toBe(true);
    expect(canEditRecursos(perfil("leitor"))).toBe(false);
    expect(canEditRecursos(perfil("editor"))).toBe(true);
    expect(canViewRecursos(perfil("sem_acesso"))).toBe(false);
    // Contexto sem a chave (banco antes da migration): a aba some.
    expect(canViewRecursos({ perfil: "admin", permissoes: {} })).toBe(false);
    expect(canEditRecursos({ perfil: "edital_gestor" })).toBe(true);
    expect(canEditRecursos({ perfil: "usuario" })).toBe(false);
  });
});

describe("catálogo, contrato e domínio", () => {
  it("a aba recursos está nas três áreas, com o recurso de permissão dela", () => {
    const aba = ABAS_DO_MENU.find((item) => item.id === "recursos");
    expect(aba).toMatchObject({
      view: "recursos",
      recurso: "recursos",
      icone: "scale",
    });
    expect(aba.areas.map((a) => a.area)).toEqual([
      "saude-indigena",
      "sede",
      "projetos",
    ]);
  });

  it("toda RPC nova está no contrato, com os argumentos da migration", () => {
    for (const [nome, args] of Object.entries(RPCS)) {
      expect(CONTRATO_RPC[nome], nome).toBeTruthy();
      expect(CONTRATO_RPC[nome].argumentos).toHaveLength(
        args.split(",").length,
      );
      for (const argumento of CONTRATO_RPC[nome].argumentos)
        expect(MIGRATION).toMatch(
          new RegExp(`public\\.${nome}\\([^)]*${argumento} `),
        );
    }
  });

  it("as origens do banco são as do classificador de prazo", () => {
    for (const codigo of Object.values(ORIGENS_DO_RECURSO))
      expect(MIGRATION).toContain(`('${codigo}', `);
  });

  it("o rollback apaga o que a migration cria e devolve a permissão", () => {
    for (const [nome, args] of Object.entries(RPCS))
      expect(ROLLBACK).toContain(
        `drop function if exists public.${nome}(${args});`,
      );
    for (const tabela of [
      "TH_RECURSO_CANDIDATO",
      "TB_RECURSO_CANDIDATO",
      "TB_ORIGEM_RECURSO",
    ])
      expect(ROLLBACK).toContain(`drop table if exists public."${tabela}";`);
    expect(ROLLBACK).toContain(
      `delete from public."TB_PERMISSAO_RECURSO" where recurso = 'recursos';`,
    );
    expect(ROLLBACK).toContain(
      `delete from public."TB_ABA" where "CO_ABA" = 'recursos';`,
    );
    expect(ROLLBACK).not.toContain("'recursos','importacao'");
  });
});

describe("recorte por coordenação (20260929190200)", () => {
  const RECORTE = ler(
    "supabase/migrations/20260929190200_recorte_por_coordenacao_nos_recursos.sql",
  );
  const corpoDe = (nome) => {
    const inicio = RECORTE.indexOf(
      `create or replace function public.${nome}(`,
    );
    expect(inicio).toBeGreaterThan(-1);
    return RECORTE.slice(inicio, RECORTE.indexOf("$function$;", inicio));
  };

  it("a lista e os editais do formulário ficam na coordenação", () => {
    const corpo = corpoDe("get_recursos_da_area");
    expect(
      corpo.match(/\(select private\."FC_EDITAIS_VISIVEIS"\(\)\) is null/g),
    ).toHaveLength(2);
    expect(corpo).toContain('private."FC_EXIGIR_RECURSOS_NA_AREA"(p_area, 1)');
  });

  it.each(Object.keys(RPCS).filter((nome) => nome !== "get_recursos_da_area"))(
    "%s: o edital passa pelo porteiro da coordenação depois da área",
    (nome) => {
      const corpo = corpoDe(nome);
      const area = corpo.indexOf('private."FC_EXIGIR_RECURSOS_NA_AREA"');
      const edital = corpo.indexOf('private."FC_EXIGIR_AREA_EDITAL"(');
      expect(area).toBeGreaterThan(-1);
      expect(edital).toBeGreaterThan(area);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
    },
  );

  it("salvar confere o edital no cadastro e na edição", () => {
    expect(
      corpoDe("salvar_recurso_candidato").match(/FC_EXIGIR_AREA_EDITAL/g),
    ).toHaveLength(2);
  });
});
