import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Robôs mais robustos (20261022170000): execução esperando no grupo de
  concorrência do GitHub, Só anexos com a trava das inscrições congeladas,
  leitura de arquivo trocado e leitura-de-arquivos.yml no registro dos disparos.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261022170000_robos_mais_robustos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const WF = (nome) => ler(`.github/workflows/${nome}`);

const corpo = (texto, cabeca) => {
  const i = texto.indexOf(cabeca);
  expect(i, cabeca).toBeGreaterThan(-1);
  return texto.slice(i, texto.indexOf("$function$;", i));
};

describe("migration dos robôs mais robustos", () => {
  it("numa transação, com rollback e ensaio que termina em rollback", () => {
    expect(MIGRATION.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    expect(ENSAIO.trim()).toMatch(/rollback;$/);
    expect(ENSAIO).toContain("github_disparo_robos_ausente_no_ensaio");
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(text);',
    );
    for (const f of [MIGRATION, ROLLBACK]) {
      expect(f).toContain('add constraint "CK_DISPROBO_NOWORKFLOW"');
    }
  });

  it("disparar_robo recusa o pedido que cancelaria a execução que espera no grupo", () => {
    const fc = corpo(
      MIGRATION,
      'create or replace function private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(',
    );
    expect(fc).toContain("set search_path = ''");
    expect(fc).toContain(
      "then array['robo-empregare.yml', 'leitura-de-arquivos.yml']",
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_EXECUCAO_PENDENTE_NO_GRUPO"(text) from public, anon, authenticated;',
    );
    const d = corpo(
      MIGRATION,
      "create or replace function public.disparar_robo(",
    );
    const fila = d.indexOf(
      "if private.\"FC_EXECUCAO_PENDENTE_NO_GRUPO\"(v_robo ->> 'workflow') then",
    );
    expect(fila).toBeGreaterThan(d.indexOf("-- Duplo clique"));
    // Antes de pedir ao GitHub (e de gravar a liberação).
    expect(fila).toBeLessThan(d.indexOf('private."FC_DISPARAR_ROBO"('));
  });

  it("Só anexos sem seco conta como modo que grava no edital congelado", () => {
    const d = corpo(
      MIGRATION,
      "create or replace function public.disparar_robo(",
    );
    expect(d).toContain(
      "'modos_que_gravam_sem_seco', jsonb_build_array('anexos')",
    );
    expect(d).toContain("and not coalesce(v_seco, false));");
    expect(d).toContain("  if v_grava then");
  });

  it("gravar_anexos_empregare confere a trava e gravar_leituras_de_arquivos o arquivo lido", () => {
    const a = corpo(
      MIGRATION,
      "create or replace function public.gravar_anexos_empregare(",
    );
    expect(a).toContain(
      'not private."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"(p_sync, v_edital)',
    );
    expect(a.indexOf("FC_INSCRICOES_CONGELADAS")).toBeLessThan(
      a.indexOf('insert into public."TB_EMPREGARE_RESPOSTA"'),
    );
    const l = corpo(
      MIGRATION,
      "create or replace function public.gravar_leituras_de_arquivos(",
    );
    expect(l).toContain("v ->> 'hash_link_arquivo'");
    expect(l).toContain("'trocadas', v_trocadas");
  });

  it("registrar_disparo_externo aceita a leitura e não o expurgo", () => {
    const r = corpo(
      MIGRATION,
      "create or replace function public.registrar_disparo_externo(",
    );
    expect(r).toContain("'leitura-de-arquivos.yml'");
    expect(r).not.toContain("expurgo-anexos-chat.yml");
  });
});

describe("workflows dos robôs", () => {
  it("robô e leitura dividem o grupo de concorrência", () => {
    for (const nome of ["robo-empregare.yml", "leitura-de-arquivos.yml"]) {
      expect(WF(nome), nome).toMatch(
        /^concurrency:\n {2}group: empregare\n {2}cancel-in-progress: false$/m,
      );
    }
  });

  it("a pré-classificação do fim do robô só roda com carga e no grupo dela", () => {
    const robo = WF("robo-empregare.yml");
    expect(robo).toContain("carga: ${{ steps.robo.outputs.carga }}");
    expect(robo).toContain("needs.robo.outputs.carga == 'sim'");
    expect(robo).toContain("uses: ./.github/workflows/pre-classificacao.yml");
    expect(robo).not.toContain("pre_classificacao.py --apos-robo");
    const pre = WF("pre-classificacao.yml");
    expect(pre).toContain("  workflow_call:");
    expect(pre).toMatch(
      / {4}concurrency:\n {6}group: pre-classificacao\n {6}cancel-in-progress: false/,
    );
    expect(pre).toContain("args+=(--apos-robo)");
  });

  it("a leitura registra a execução antes do trabalho e com o orçamento de 90 min", () => {
    const w = WF("leitura-de-arquivos.yml");
    const i = w.indexOf("- name: Registrar a execução no MONITORA");
    expect(i).toBeGreaterThan(-1);
    expect(i).toBeLessThan(w.indexOf("- name: Ler os arquivos"));
    const passo = w.slice(i, w.indexOf("\n      - name:", i + 10));
    expect(passo).toContain("continue-on-error: true");
    expect(passo).toMatch(
      /-m monitora\.disparo_externo leitura-de-arquivos\.yml$/m,
    );
    expect(w).toContain('ORCAMENTO_MINUTOS: "90"');
  });
});
