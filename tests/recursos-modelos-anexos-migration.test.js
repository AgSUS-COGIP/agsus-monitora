import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.js";

/*
  A migration de anexos, modelos e respostas da aba Recursos (ensaiada em
  produção com begin…rollback em 29/09/2026, depois de 20260929190200: admin
  mantém modelos com versão, usuario lê e recebe 42501 ao gravar, a autora não
  aprova depois da revisão, coordenação recortada não vê o recurso nem envia
  arquivo, leitor só gera URL depois de registrar o download; migration +
  rollback devolvem as funções como estavam). Aqui, as invariantes que não
  podem se perder numa edição.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const MIGRATION = ler(
  "supabase/migrations/20260929230000_recursos_modelos_anexos_respostas.sql",
);
const ROLLBACK = ler(
  "supabase/rollback/20260929230000_recursos_modelos_anexos_respostas.sql",
);
const RECORTE = ler(
  "supabase/migrations/20260929190200_recorte_por_coordenacao_nos_recursos.sql",
);

const NOVAS = {
  listar_modelos_resposta_recurso: "",
  salvar_modelo_resposta_recurso: "jsonb",
  arquivar_modelo_resposta_recurso: "uuid, text",
  salvar_resposta_recurso: "jsonb",
  transicionar_resposta_recurso: "uuid, text, integer, text",
  registrar_anexo_recurso: "uuid, text, text, text, uuid",
  arquivar_anexo_recurso: "uuid, text",
  registrar_download_anexo_recurso: "uuid",
};
const TABELAS = [
  "TB_MODELO_RESPOSTA_RECURSO",
  "TB_RESPOSTA_RECURSO",
  "TH_RESPOSTA_RECURSO",
  "TB_ANEXO_RECURSO",
  "TH_ANEXO_RECURSO",
];

const corpoDe = (fonte, cabeca) => {
  const inicio = fonte.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return fonte.slice(inicio, fonte.indexOf("$function$;", inicio));
};

describe("segurança", () => {
  it.each(Object.keys(NOVAS))(
    "%s: security definer, search_path vazio e a permissão de Recursos",
    (nome) => {
      const corpo = corpoDe(MIGRATION, `create function public.${nome}(`);
      expect(corpo).toContain("security definer");
      expect(corpo).toContain("set search_path to ''");
      if (nome.includes("modelo"))
        expect(corpo).toContain("private.pode_recurso('recursos', 3)");
      else
        expect(corpo).toMatch(
          /private\."FC_EXIGIR_RECURSO_ACESSIVEL"\([^;]*?, (2|case when)/,
        );
    },
  );

  it("o porteiro do recurso confere nível, área e coordenação", () => {
    const corpo = corpoDe(
      MIGRATION,
      'create function private."FC_EXIGIR_RECURSO_ACESSIVEL"(',
    );
    const area = corpo.indexOf(
      'private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, p_minimo)',
    );
    const edital = corpo.indexOf(
      'private."FC_EXIGIR_AREA_EDITAL"(v_edital::text)',
    );
    expect(area).toBeGreaterThan(-1);
    expect(edital).toBeGreaterThan(area);
    expect(corpo).toContain(`r."ST_ATIVO" = 'S'`);
  });

  it("as escritas de resposta e anexo exigem editor; só o download aceita leitor", () => {
    for (const nome of [
      "salvar_resposta_recurso",
      "transicionar_resposta_recurso",
      "registrar_anexo_recurso",
      "arquivar_anexo_recurso",
    ])
      expect(
        corpoDe(MIGRATION, `create function public.${nome}(`),
        nome,
      ).toMatch(/FC_EXIGIR_RECURSO_ACESSIVEL"\([^;]*?, 2\)/);
    expect(
      corpoDe(
        MIGRATION,
        "create function public.registrar_download_anexo_recurso(",
      ),
    ).toContain(`case when v_anexo."ST_ATIVO" = 'S' then 1 else 2 end`);
  });

  it("anon não executa; tabelas com RLS, sem grant nem policy", () => {
    const lista = Object.entries(NOVAS).map(
      ([nome, args]) => `  public.${nome}(${args})`,
    );
    const revoke = MIGRATION.slice(
      MIGRATION.indexOf("revoke all on function\n  public.listar_modelos"),
    );
    for (const assinatura of lista) expect(revoke).toContain(assinatura);
    expect(revoke).toContain("from public, anon;");
    expect(revoke).toContain("to authenticated, service_role;");
    for (const tabela of TABELAS) {
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).not.toMatch(
        new RegExp(`create policy \\w+ on public\\."${tabela}"`),
      );
    }
    expect(MIGRATION).toContain(
      `revoke all on ${TABELAS.map((t) => `public."${t}"`).join(", ")} from public, anon, authenticated;`,
    );
  });

  it("nada se apaga: sem delete nas funções, arquivar é lógico", () => {
    expect(MIGRATION).not.toMatch(/\bdelete from\b/i);
    expect(MIGRATION).not.toMatch(/\btruncate\b/i);
    expect(ROLLBACK).not.toMatch(
      /delete from storage\.|storage\.allow_delete_query/,
    );
  });
});

describe("leitura e detalhe continuam com o recorte da coordenação", () => {
  it("get_recursos_da_area: os dois recortes de 20260929190200 e os acréscimos", () => {
    const corpo = corpoDe(
      MIGRATION,
      "create or replace function public.get_recursos_da_area(",
    );
    expect(
      corpo.match(/\(select private\."FC_EDITAIS_VISIVEIS"\(\)\) is null/g),
    ).toHaveLength(2);
    expect(corpo).toContain('private."FC_EXIGIR_RECURSOS_NA_AREA"(p_area, 1)');
    for (const chave of [
      "'resposta_estado'",
      "'qt_anexos'",
      "'modelos'",
      "'pode_administrar_modelos'",
    ])
      expect(corpo).toContain(chave);
  });

  it("get_recurso_candidato_detalhe: área e coordenação antes de tudo", () => {
    const corpo = corpoDe(
      MIGRATION,
      "create or replace function public.get_recurso_candidato_detalhe(",
    );
    const area = corpo.indexOf(
      'private."FC_EXIGIR_RECURSOS_NA_AREA"(v_area, 1)',
    );
    const edital = corpo.indexOf('private."FC_EXIGIR_AREA_EDITAL"(');
    expect(area).toBeGreaterThan(-1);
    expect(edital).toBeGreaterThan(area);
    for (const chave of ["'eu'", "'anexos'", "'resposta'", "'modelo_corpo'"])
      expect(corpo).toContain(chave);
  });

  it("a migration para sem 20260929190200", () => {
    expect(MIGRATION).toContain(
      "position('FC_EDITAIS_VISIVEIS' in pg_get_functiondef('public.get_recursos_da_area(text)'::regprocedure)) = 0",
    );
  });
});

describe("rollback e contrato", () => {
  it("o rollback devolve leitura e detalhe exatamente como em 20260929190200", () => {
    for (const cabeca of [
      "create or replace function public.get_recursos_da_area(",
      "create or replace function public.get_recurso_candidato_detalhe(",
    ])
      expect(corpoDe(ROLLBACK, cabeca)).toBe(corpoDe(RECORTE, cabeca));
  });

  it("o rollback tira funções e políticas, mantém bucket e só apaga tabela vazia", () => {
    for (const [nome, args] of Object.entries(NOVAS))
      expect(ROLLBACK).toContain(
        `drop function if exists public.${nome}(${args});`,
      );
    expect(ROLLBACK).toContain(
      "drop policy if exists recursos_anexos_storage_select on storage.objects;",
    );
    expect(ROLLBACK).toContain(
      "drop policy if exists recursos_anexos_storage_insert on storage.objects;",
    );
    expect(ROLLBACK).not.toMatch(/storage\.buckets/);
    expect(ROLLBACK).toMatch(
      /if v_com_dados then[\s\S]*?raise notice[\s\S]*?else[\s\S]*?drop table public\."TB_ANEXO_RECURSO";/,
    );
  });

  it("toda RPC nova está no contrato, com os argumentos da migration", () => {
    for (const [nome, tipos] of Object.entries(NOVAS)) {
      expect(CONTRATO_RPC[nome], nome).toBeTruthy();
      const quantos = tipos ? tipos.split(",").length : 0;
      expect(CONTRATO_RPC[nome].argumentos).toHaveLength(quantos);
      for (const argumento of CONTRATO_RPC[nome].argumentos)
        expect(MIGRATION).toMatch(
          new RegExp(`public\\.${nome}\\([^)]*${argumento} `),
        );
    }
  });
});
