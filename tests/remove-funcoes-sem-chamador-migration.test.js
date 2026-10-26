import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration que remove funções sem chamador e tira o EXECUTE de anon
  (20261026120000), ainda não aplicada: o ensaio begin…rollback está em
  supabase/ensaios/. Aqui, as invariantes estáticas: só as oito funções saem
  (sem CASCADE), as duas analises_* trocam PUBLIC/anon por authenticated e
  service_role, o ensaio roda o mesmo corpo e desfaz, o rollback recria as
  oito e devolve o privilégio padrão, e nenhum código vivo chama o que saiu.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261026120000_remove_funcoes_sem_chamador.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);

const corpo = (sql) =>
  sql.slice(sql.indexOf("begin;\n") + 7, sql.lastIndexOf("commit;")).trim();
const semComentarios = (sql) =>
  sql.replace(/\/\*[\s\S]*?\*\//g, "").replace(/--[^\n]*/g, "");

const REMOVIDAS = [
  ["public.diagnostico_agsus_monitora()", "diagnostico_agsus_monitora"],
  [
    "public.limpar_eventos_acesso_antigos(integer)",
    "limpar_eventos_acesso_antigos",
  ],
  ["public.limpar_logs_operacionais(integer)", "limpar_logs_operacionais"],
  [
    "public.limpar_staging_monitoramento_indigena(integer)",
    "limpar_staging_monitoramento_indigena",
  ],
  ["public.obter_candidatos_empregare(text)", "obter_candidatos_empregare"],
  ['private."FC_LOTE_REFEITO_EM"(text)', "FC_LOTE_REFEITO_EM"],
  ['private."FC_PCD_PUBLICADA"(text)', "FC_PCD_PUBLICADA"],
  ["private.nivel_padrao_recurso(text,text)", "nivel_padrao_recurso"],
];
const ANALISES = [
  "public.analises_norm_key(text)",
  "public.analises_make_chave_natural(text,text,text,text,text,text)",
];
const INTOCADAS = [
  "FC_HOOK_ANTES_CRIAR_USUARIO",
  "FC_AGENDA_DAS_INSCRICOES",
  "rls_auto_enable",
];

describe("remove funções sem chamador e tira EXECUTE de anon (20261026120000)", () => {
  it("é uma transação, e o ensaio roda o mesmo corpo e desfaz", () => {
    expect(MIGRATION.startsWith("/*")).toBe(true);
    expect(MIGRATION).toMatch(/\nbegin;\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(ENSAIO).toContain(corpo(MIGRATION));
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/\ncommit;/);
    expect(ENSAIO).toContain(corpo(ROLLBACK));
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
  });

  it("tira só as oito funções, sem CASCADE", () => {
    const sql = semComentarios(MIGRATION);
    const drops = sql.match(/^drop function if exists [^;]+;$/gm) || [];
    expect(drops).toEqual(
      REMOVIDAS.map(([assin]) => `drop function if exists ${assin};`),
    );
    expect(sql).not.toMatch(/cascade/i);
    expect(sql).not.toMatch(/^\s*(create|alter)\s/im);
    for (const nome of INTOCADAS) expect(sql).not.toContain(nome);
  });

  it("analises_* deixam PUBLIC e anon e ficam com authenticated e service_role", () => {
    const sql = semComentarios(MIGRATION);
    for (const a of ANALISES) {
      expect(sql).toContain(
        `revoke execute on function ${a} from public, anon;`,
      );
      expect(sql).toContain(
        `grant execute on function ${a} to authenticated, service_role;`,
      );
    }
    expect(sql).not.toMatch(/grant [^;]* to [^;]*\banon\b/i);
  });

  it("o rollback recria as oito com privilégios e devolve o EXECUTE de PUBLIC", () => {
    for (const [assin] of REMOVIDAS) {
      expect(ROLLBACK).toContain(`-- ${assin}\nCREATE OR REPLACE FUNCTION `);
      expect(ROLLBACK).toContain(
        `revoke all on function ${assin} from public, anon, authenticated, service_role;`,
      );
    }
    expect(ROLLBACK).toContain(
      "grant execute on function public.obter_candidatos_empregare(text) to authenticated, service_role;",
    );
    expect(ROLLBACK).toContain(
      "grant execute on function public.limpar_logs_operacionais(integer) to service_role, authenticated;",
    );
    for (const a of ANALISES) {
      expect(ROLLBACK).toContain(`grant execute on function ${a} to public;`);
    }
  });

  it("nenhum código vivo chama o que saiu", () => {
    const vivos = [
      "src",
      "api",
      "server",
      "python",
      "scripts",
      "apps-script",
      ".github",
      "public",
      "*.html",
    ];
    for (const [, nome] of REMOVIDAS) {
      let saida = "";
      try {
        saida = execFileSync(
          "git",
          ["grep", "-l", "-w", nome, "--", ...vivos],
          {
            encoding: "utf8",
          },
        );
      } catch (erro) {
        if (erro.status !== 1) throw erro;
      }
      expect(saida.trim(), nome).toBe("");
    }
  });
});
