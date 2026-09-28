import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  autoriaDaImportacao,
  canEditCandidateStatus,
  motivoDoStatusBloqueado,
  statusTravadoParaPerfil,
} from "../src/lib/lista-aprovados-rules.js";

const MIGRATION = readFileSync(
  "supabase/migrations/20260928120000_autoria_e_trava_da_lista_de_aprovados.sql",
  "utf8",
);

const perfil = (valor) => ({ perfil: valor, ativo: true });
const contratador = perfil("contratador");
const admin = perfil("admin");
const gestor = perfil("edital_gestor");

const candidato = (extra = {}) => ({
  candidato_id: "1",
  lista_ativa: true,
  status: null,
  ...extra,
});

describe("trava do status do candidato", () => {
  it("deixa o contratador definir o primeiro status", () => {
    expect(canEditCandidateStatus(contratador, candidato())).toBe(true);
    expect(motivoDoStatusBloqueado(contratador, candidato())).toBe("");
  });

  it("trava o contratador quando o candidato já tem status", () => {
    const definido = candidato({ status: "Contratado" });
    expect(statusTravadoParaPerfil(contratador, definido)).toBe(true);
    expect(canEditCandidateStatus(contratador, definido)).toBe(false);
    expect(motivoDoStatusBloqueado(contratador, definido)).toMatch(
      /Somente admin/,
    );
  });

  it("deixa o admin alterar um status já definido", () => {
    const definido = candidato({ status: "Desistente" });
    expect(statusTravadoParaPerfil(admin, definido)).toBe(false);
    expect(canEditCandidateStatus(admin, definido)).toBe(true);
  });

  it("destrava quando o admin volta o candidato para Sem status", () => {
    expect(canEditCandidateStatus(contratador, candidato({ status: "" }))).toBe(
      true,
    );
  });

  it("dá prioridade ao aviso de lista inativa", () => {
    const inativo = candidato({ lista_ativa: false, status: "Contratado" });
    expect(motivoDoStatusBloqueado(contratador, inativo)).toBe("Lista inativa");
    expect(canEditCandidateStatus(admin, inativo)).toBe(false);
  });

  it("não mostra cadeado a quem nunca poderia alterar status", () => {
    const definido = candidato({ status: "Contratado" });
    expect(motivoDoStatusBloqueado(gestor, definido)).toBe("");
    expect(canEditCandidateStatus(gestor, candidato())).toBe(false);
  });
});

describe("autoriaDaImportacao", () => {
  const importado_em = "2026-09-28T17:05:00Z";

  it("junta nome, e-mail e data no fuso de Brasília", () => {
    const texto = autoriaDaImportacao({
      importado_por_nome: "Fulana de Tal",
      importado_por_email: "fulana@agenciasus.org.br",
      importado_em,
    });
    expect(texto).toBe(
      "Importado por Fulana de Tal (fulana@agenciasus.org.br) em 28/09/2026, 14:05",
    );
  });

  it("não repete o e-mail quando o perfil não tem nome", () => {
    const texto = autoriaDaImportacao({
      importado_por_nome: "fulana@agenciasus.org.br",
      importado_por_email: "fulana@agenciasus.org.br",
      importado_em,
    });
    expect(texto).toMatch(/^Importado por fulana@agenciasus\.org\.br em /);
  });

  it("mostra só a data em lista antiga, sem autoria gravada", () => {
    expect(autoriaDaImportacao({ importado_em })).toMatch(/^Importado em /);
    expect(autoriaDaImportacao({})).toBe("");
  });
});

describe("migration 20260928120000", () => {
  it("usa na trava o mesmo critério da tela: status atual e perfil admin", () => {
    expect(MIGRATION).toMatch(
      /if v_role <> 'admin' and v_candidato\.status is not null then/,
    );
  });

  it("mantém a importação única para quem não é admin", () => {
    expect(MIGRATION).toMatch(/if v_ja_teve_lista and v_role <> 'admin' then/);
  });

  it("tira a autoria da sessão, nunca de parâmetro vindo do navegador", () => {
    const assinatura = MIGRATION.match(
      /create or replace function public\.importar_lista_aprovados\(([^)]*)\)/,
    )?.[1];
    const parametros = assinatura
      .split(",")
      .map((trecho) => trecho.trim().split(/\s+/)[0]);
    expect(parametros).toEqual([
      "p_edital_id",
      "p_ativo",
      "p_arquivo_nome",
      "p_arquivo_path",
      "p_candidatos",
      "p_substituir",
    ]);
    expect(MIGRATION).toMatch(/auth\.jwt\(\) ->> 'email'/);
  });

  it("atribui as listas antigas à Gestão da Informação de Pessoal sem mexer no UUID", () => {
    const preenchimento = MIGRATION.match(
      /update public\."TB_LISTA_APROVADO"\s+set "DS_EMAIL_IMPORTACAO"[\s\S]*?;/,
    )?.[0];
    expect(preenchimento).toContain("'dados.recursoshumanos@agenciasus.org.br'");
    expect(preenchimento).toContain("'Gestão da Informação de Pessoal'");
    expect(preenchimento).toMatch(/where "DS_EMAIL_IMPORTACAO" is null;$/);
    expect(preenchimento).not.toMatch(/importado_por\s*=/);
  });

  it("devolve a autoria em listar_listas_aprovados", () => {
    expect(MIGRATION).toMatch(/importado_por_email text,\s*importado_por_nome text/);
  });
});
