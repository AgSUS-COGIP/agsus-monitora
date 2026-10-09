import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  canAnalisarRecursos,
  paginasPermitidas,
} from "../src/lib/access-roles.js";
import { linkDaTela } from "../src/lib/chat.js";
import { ABAS_DO_MENU, montarArvoreDoMenu } from "../src/lib/menu-lateral.ts";
import { bloqueioDaTela, destinoDaTela } from "../src/lib/navegacao.js";

/*
  Migrations 20261009230000 (Recursos vira "Painel de recursos"; "Analisar
  recursos" entra desligada) e 20261009230500 (liga a aba). Invariantes
  estáticas: só catálogo do menu (nenhum objeto novo nem permissão), a aba
  igual à do código, as áreas copiadas do painel, o ensaio com o mesmo corpo
  e o rollback que desfaz tudo na ordem de antes.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261009230000_analisar_recursos_no_menu.sql";
const LIGA = "20261009230500_liga_aba_analisar_recursos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const MIGRATION_LIGA = ler(`supabase/migrations/${LIGA}`);
const ROLLBACK_LIGA = ler(`supabase/rollback/${LIGA}`);
const corpo = (texto) =>
  texto.slice(texto.indexOf("\nbegin;\n") + 8, texto.lastIndexOf("\ncommit;"));
const semComentarios = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, "");

describe("migration de Analisar recursos no menu", () => {
  it("mexe só no catálogo do menu: nenhuma tabela, função, grant ou recurso novo", () => {
    const sql = semComentarios(corpo(MIGRATION)).toLowerCase();
    for (const proibido of [
      "create table",
      "alter table",
      "create function",
      "create or replace function",
      "grant ",
      "tb_grupo_acesso",
      "delete from",
    ])
      expect(sql).not.toContain(proibido);
  });

  it("a aba nova entra desligada, com o selo, e é a do código", () => {
    expect(MIGRATION).toContain(
      `values ('analisar-recursos', 'Analisar recursos', 'gavel', 7, 'analisar-recursos', 'recursos', 'nativa', 'N', 'S');`,
    );
    const doCodigo = ABAS_DO_MENU.find((aba) => aba.id === "analisar-recursos");
    expect(doCodigo).toMatchObject({
      rotulo: "Analisar recursos",
      icone: "gavel",
      ordem: 7,
      view: "analisar-recursos",
      recurso: "recursos",
      tipo: "nativa",
      beta: true,
    });
  });

  it("o painel muda de rótulo e sai do beta, no banco e no código", () => {
    expect(MIGRATION).toContain(
      `set "NO_ABA" = 'Painel de recursos', "ST_BETA" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos'`,
    );
    const painel = ABAS_DO_MENU.find((aba) => aba.id === "recursos");
    expect(painel.rotulo).toBe("Painel de recursos");
    expect(Object.hasOwn(painel, "beta")).toBe(false);
  });

  it("as áreas e a situação em cada uma vêm do painel de recursos", () => {
    expect(MIGRATION).toContain(
      `select 'analisar-recursos', r."CO_AREA", r."ST_ATIVO" from public."RL_ABA_AREA" r where r."CO_ABA" = 'recursos'`,
    );
  });

  it("a ordem do banco é a do código", () => {
    const ordens = Object.fromEntries(
      [
        ...MIGRATION.matchAll(
          /set "NU_ORDEM" = (\d+)[^;]*where "CO_ABA" = '([^']+)'/g,
        ),
      ].map(([, ordem, aba]) => [aba, Number(ordem)]),
    );
    for (const [aba, ordem] of Object.entries(ordens))
      expect(ABAS_DO_MENU.find((a) => a.id === aba)?.ordem, aba).toBe(ordem);
    expect(Object.keys(ordens).sort()).toEqual(
      [
        "aprovados",
        "classificacao",
        "conduzir-entrevistas",
        "entrevistas",
        "selecao",
      ].sort(),
    );
  });

  it("recusa aplicar duas vezes e exige a de Conduzir entrevistas antes", () => {
    expect(MIGRATION).toContain(
      "A aba analisar-recursos já existe: esta migration já foi aplicada.",
    );
    expect(MIGRATION).toContain(
      "Aplique antes 20261008130000_conduzir_entrevistas_no_menu.sql.",
    );
  });

  it("a que liga só liga a aba", () => {
    expect(semComentarios(corpo(MIGRATION_LIGA)).trim()).toBe(
      `update public."TB_ABA" set "ST_ATIVO" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analisar-recursos';`,
    );
  });

  it("o ensaio aplica o mesmo corpo, liga, confere e termina em rollback", () => {
    const corpoDaMigration = semComentarios(corpo(MIGRATION)).trim();
    expect(ENSAIO).toContain(corpoDaMigration);
    expect(ENSAIO).toContain(semComentarios(corpo(MIGRATION_LIGA)).trim());
    for (const etapa of ["E1", "E2", "E3", "E4"])
      expect(ENSAIO).toContain(`FALHOU ${etapa}`);
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^\s*commit\s*;/m);
  });

  it("o ensaio desfaz com os mesmos comandos dos rollbacks", () => {
    expect(ENSAIO).toContain(semComentarios(corpo(ROLLBACK_LIGA)).trim());
    const rollback = corpo(ROLLBACK)
      .split("\n")
      .filter((linha) => linha && !linha.startsWith("--"));
    for (const linha of rollback) expect(ENSAIO).toContain(linha);
  });

  it("o rollback tira a aba e devolve rótulo, selo e ordem de antes", () => {
    expect(ROLLBACK).toContain(
      `delete from public."RL_ABA_AREA" where "CO_ABA" = 'analisar-recursos';`,
    );
    expect(ROLLBACK).toContain(
      `delete from public."TB_ABA" where "CO_ABA" = 'analisar-recursos';`,
    );
    expect(ROLLBACK).toContain(
      `set "NO_ABA" = 'Recursos', "ST_BETA" = 'S', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'recursos'`,
    );
    for (const [aba, ordem] of [
      ["entrevistas", 7],
      ["conduzir-entrevistas", 8],
      ["classificacao", 9],
      ["aprovados", 10],
      ["selecao", 11],
    ])
      expect(ROLLBACK).toContain(
        `set "NU_ORDEM" = ${ordem}, "DT_ATUALIZACAO" = now() where "CO_ABA" = '${aba}'`,
      );
    expect(ROLLBACK_LIGA).toContain(
      `set "ST_ATIVO" = 'N', "DT_ATUALIZACAO" = now() where "CO_ABA" = 'analisar-recursos'`,
    );
  });
});

describe("quem vê cada entrada de Recursos", () => {
  const perfil = (recursos, parecer = "sem_acesso") => ({
    perfil: "analista",
    permissoes: { recursos, recursos_parecer: parecer },
  });
  const itens = (p) =>
    montarArvoreDoMenu({ permitidas: paginasPermitidas(p), areas: ["sede"] })
      .flatMap((grupo) => grupo.itens)
      .map((item) => item.rotulo);

  it("quem só acompanha (Leitor) vê o painel; quem analisa vê os dois", () => {
    expect(itens(perfil("leitor"))).toEqual(["Painel de recursos"]);
    expect(itens(perfil("editor"))).toEqual([
      "Painel de recursos",
      "Analisar recursos",
    ]);
    expect(itens(perfil("leitor", "editor"))).toEqual([
      "Painel de recursos",
      "Analisar recursos",
    ]);
    expect(itens(perfil("sem_acesso", "editor"))).toEqual([]);
  });

  it("canAnalisarRecursos: Editor em Recursos ou o Parecer jurídico, vendo Recursos", () => {
    expect(canAnalisarRecursos(perfil("leitor"))).toBe(false);
    expect(canAnalisarRecursos(perfil("editor"))).toBe(true);
    expect(canAnalisarRecursos(perfil("admin"))).toBe(true);
    expect(canAnalisarRecursos(perfil("leitor", "editor"))).toBe(true);
    expect(canAnalisarRecursos(perfil("sem_acesso", "editor"))).toBe(false);
    // Contexto antigo, sem a matriz: os papéis que editavam Recursos.
    expect(canAnalisarRecursos({ perfil: "edital_gestor" })).toBe(true);
    expect(canAnalisarRecursos({ perfil: "usuario" })).toBe(false);
  });

  it("link antigo de Recursos abre o painel; a análise sem permissão avisa", () => {
    expect(destinoDaTela("recursos")).toEqual({ view: "recursos", visao: "" });
    expect(bloqueioDaTela("recursos", perfil("leitor"))).toBe("");
    expect(bloqueioDaTela("analisar-recursos", perfil("leitor"))).toBe(
      "Sem permissão para analisar recursos.",
    );
    expect(bloqueioDaTela("analisar-recursos", perfil("editor"))).toBe("");
  });

  it("as duas telas valem como link interno (Compartilhar, atalhos)", () => {
    expect(linkDaTela({ view: "recursos" })?.view).toBe("recursos");
    expect(linkDaTela({ view: "analisar-recursos" })?.view).toBe(
      "analisar-recursos",
    );
  });
});
