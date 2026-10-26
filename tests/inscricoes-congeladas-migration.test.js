import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  inputsDoPedido,
  roboDeCarga,
  validarOpcoes,
} from "../src/lib/robos-de-carga.ts";

/*
  Inscrições congeladas por edital e o registro de todos os disparos
  (20261020170000): a trava no banco (robô da Empregare, FC_EMPREGARE_ABRIR_VAGA,
  pré-classificação, disparar_robo com override do administrador global), a
  origem certa em FC_DISPARAR_ROBO (AGENDA só do pg_cron, MANUAL no SQL direto),
  o registro das execuções iniciadas no GitHub e os workflows que passam o
  override e registram a execução sem nunca falhar por isso.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261020170000_inscricoes_congeladas.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const CORRECAO = ler("supabase/correcoes/20261020-congelar-inscricoes-114.sql");
const WF = (n) => ler(`.github/workflows/${n}`);

const corpo = (texto, cabeca) => {
  const i = texto.indexOf(cabeca);
  expect(i, cabeca).toBeGreaterThan(-1);
  return texto.slice(i, texto.indexOf("$function$;", i));
};

describe("migration das inscrições congeladas", () => {
  it("numa transação, com pré-requisito; RPCs novas com search_path vazio, comentário e grants", () => {
    expect(MIGRATION.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    expect(MIGRATION).toContain(
      "raise exception 'Aplique antes 20261020130000",
    );
    for (const [cabeca, assinatura, papel] of [
      [
        "create function public.obter_congelamento_inscricoes(",
        "public.obter_congelamento_inscricoes(uuid)",
        "authenticated",
      ],
      [
        "create function public.alterar_congelamento_inscricoes(",
        "public.alterar_congelamento_inscricoes(uuid, boolean, text)",
        "authenticated",
      ],
      [
        "create function public.registrar_uso_liberacao_congelamento(",
        "public.registrar_uso_liberacao_congelamento(uuid, text)",
        "service_role",
      ],
      [
        "create function public.registrar_disparo_externo(",
        "public.registrar_disparo_externo(text, text, text, text)",
        "service_role",
      ],
      [
        "create function public.listar_vagas_empregare(",
        "public.listar_vagas_empregare(text[], text[], integer, text, uuid)",
        "service_role",
      ],
      [
        "create function public.pre_classificacao_ler_editais(",
        "public.pre_classificacao_ler_editais(text[], boolean, boolean, uuid)",
        "service_role",
      ],
    ]) {
      const c = corpo(MIGRATION, cabeca);
      expect(c, cabeca).toMatch(/security definer/i);
      expect(c, cabeca).toMatch(/set search_path to ''/i);
      expect(MIGRATION).toContain(`comment on function ${assinatura} is`);
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to ${papel};`,
      );
    }
    // As tabelas da trava: RLS e nada concedido (só pelas RPCs).
    for (const t of [
      "TB_CONGELAMENTO_INSCRICAO",
      "TH_CONGELAMENTO_INSCRICAO",
    ]) {
      expect(MIGRATION).toContain(
        `alter table public."${t}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${t}" from public, anon, authenticated, service_role;`,
      );
    }
    expect(MIGRATION).toContain(
      '"ST_INSCRICOES_CONGELADAS" character varying(1) not null',
    );
  });

  it("o robô: a carga tira o congelado (explícito volta em congeladas), o modo anexos não", () => {
    const listar = corpo(
      MIGRATION,
      "create function public.listar_vagas_empregare(",
    );
    expect(listar).toContain("p_finalidade text default 'carga'");
    expect(listar).toContain(
      "where v_finalidade = 'anexos' or not m.congelada or m.liberada",
    );
    expect(listar).toContain("'pedido', v_modo <> 'PADRAO'");
    expect(listar).toContain(
      'private."FC_LIBERACAO_CONGELAMENTO_VALIDA"(p_liberacao, e.edital_id)',
    );
    const abrir = corpo(
      MIGRATION,
      'create or replace function private."FC_EMPREGARE_ABRIR_VAGA"(',
    );
    expect(abrir).toMatch(
      /FC_INSCRICOES_CONGELADAS"\(v_edital\)\s+and not private\."FC_EXECUCAO_LIBERADA_NO_CONGELAMENTO"\(p_sync, v_edital\)/,
    );
    expect(abrir).toContain(
      "'Inscrições congeladas no edital: nada foi gravado nem desativado",
    );
    // A trava de raiz vem antes da conta da metade (nada gravado nem desativado).
    expect(abrir.indexOf("FC_INSCRICOES_CONGELADAS")).toBeLessThan(
      abrir.indexOf("p_total * 2 < v_ativos"),
    );
  });

  it("a pré-classificação: o congelado sai salvo seco ou liberação", () => {
    const ler_ = corpo(
      MIGRATION,
      "create function public.pre_classificacao_ler_editais(",
    );
    expect(ler_).toContain("if not coalesce(p_incluir_congelados, false) then");
    expect(ler_).toContain("'congelados', coalesce((");
    expect(ler_).toContain(
      "'congelado', private.\"FC_INSCRICOES_CONGELADAS\"(m.id)",
    );
  });

  it("disparar_robo: 55000 nos modos que gravam; override só do administrador global, com motivo e liberação", () => {
    const d = corpo(
      MIGRATION,
      "create or replace function public.disparar_robo(",
    );
    expect(d).toContain(
      "'modos_que_gravam', jsonb_build_array('normal', 'forcar')",
    );
    expect(d).toContain(
      "'modos_que_gravam', jsonb_build_array('normal', 'refazer_lote')",
    );
    expect(d).toMatch(/Inscrições congeladas: %[\s\S]*using errcode = '55000'/);
    expect(d).toContain(
      "Só o administrador global força edital com inscrições congeladas.",
    );
    expect(d).toContain("now() + interval '12 hours'");
    expect(d).toContain(
      "jsonb_build_object('forcar_congelado', v_liberacao::text)",
    );
    expect(d).toContain('set "CO_DISPARO" = v_disparo');
    // A coordenação (Recalcular) não força.
    expect(d).toContain("or v_limite is not null or v_forcar_congelado");
  });

  it("FC_DISPARAR_ROBO: AGENDA só do pg_cron, MANUAL no SQL direto; tarefas com p_origem", () => {
    const f = corpo(MIGRATION, 'create function private."FC_DISPARAR_ROBO"(');
    expect(f).toContain(
      "when p_origem = 'AGENDA' or current_setting('application_name', true) = 'pg_cron' then 'AGENDA'",
    );
    expect(f).toContain("else 'MANUAL' end;");
    expect(f).toContain("else 'manual' end;");
    expect(f).toContain(
      "'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco', 'forcar_congelado')",
    );
    expect(MIGRATION).toContain(
      'drop function private."FC_DISPARAR_ROBO"(text, jsonb, uuid);',
    );
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text) from public, anon, authenticated, service_role;',
    );
    expect(MIGRATION).toContain(
      "jsonb_build_object('modo', 'normal', 'editais', btrim(p_editais)), null, 'AGENDA');",
    );
    expect(MIGRATION).toContain("perform cron.alter_job(r.jobid,");
    expect(MIGRATION).toContain(
      "add constraint \"CK_DISPROBO_TPORIGEM\" check (\"TP_ORIGEM\" in ('AGENDA', 'MONITORA', 'MANUAL', 'GITHUB'))",
    );
    const ext = corpo(
      MIGRATION,
      "create function public.registrar_disparo_externo(",
    );
    expect(ext).toContain(
      'on conflict ("DS_URL_EXECUCAO") where "TP_ORIGEM" = \'GITHUB\' do nothing',
    );
    expect(ext).toContain("'GITHUB', null, 'INICIADO'");
    expect(MIGRATION).toContain("'ator', x.\"NO_ATOR_GITHUB\"");
  });

  it("rollback volta tudo; o ensaio termina em rollback; a correção do 114 fica separada", () => {
    expect(ROLLBACK).toContain(
      'create function private."FC_DISPARAR_ROBO"(p_workflow text, p_inputs jsonb default',
    );
    expect(ROLLBACK).toContain(
      'drop function private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text);',
    );
    expect(ROLLBACK).toContain(
      "create function public.listar_vagas_empregare(p_editais text[] DEFAULT NULL::text[], p_vagas text[] DEFAULT NULL::text[], p_limite integer DEFAULT 60)",
    );
    expect(ROLLBACK).toContain(
      'drop table public."TB_CONGELAMENTO_INSCRICAO";',
    );
    expect(ROLLBACK).toContain(
      'delete from public."TL_DISPARO_ROBO" where "TP_ORIGEM" = \'GITHUB\';',
    );
    expect(ROLLBACK).toContain(
      "replace(r.command, ', p_origem => ''AGENDA'');', ');')",
    );
    expect(ROLLBACK).not.toContain("--@");
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("github_disparo_robos_ausente_no_ensaio");
    // A correção do 114 não entra na migration; é assinada pela conta do setor e idempotente.
    expect(MIGRATION).not.toContain("bcecfb08-88ef-4e06-8401-bcad6bf88fd0");
    expect(CORRECAO).toContain("'bcecfb08-88ef-4e06-8401-bcad6bf88fd0', 'S'");
    expect(CORRECAO).toContain("a01afddb-f64b-47d9-80e8-476a1ed14e43");
    expect(CORRECAO).toContain("where c.\"ST_INSCRICOES_CONGELADAS\" <> 'S'");
    expect(CORRECAO.trim().endsWith("commit;")).toBe(true);
  });
});

describe("workflows: o override e o registro da execução", () => {
  const entradas = (texto) => {
    const bloco = texto.slice(
      texto.indexOf("    inputs:\n"),
      texto.indexOf("\npermissions:"),
    );
    return [...bloco.matchAll(/^ {6}([a-z_]+):$/gm)].map((m) => m[1]);
  };

  it("robô e pré-classificação recebem forcar_congelado e o passam adiante (até 10 inputs)", () => {
    const robo = WF("robo-empregare.yml");
    expect(entradas(robo)).toContain("forcar_congelado");
    expect(entradas(robo).length).toBeLessThanOrEqual(10);
    expect(
      robo.match(/FORCAR_CONGELADO: \$\{\{ inputs\.forcar_congelado \}\}/g),
    ).toHaveLength(2);
    // A pré-classificação do fim do robô recebe o mesmo token (workflow_call).
    expect(robo).toContain(
      "forcar_congelado: ${{ inputs.forcar_congelado }}\n    secrets: inherit",
    );
    const pre = WF("pre-classificacao.yml");
    expect(entradas(pre)).toContain("forcar_congelado");
    expect(
      pre.match(/FORCAR_CONGELADO: \$\{\{ inputs\.forcar_congelado \}\}/g),
    ).toHaveLength(2);
  });

  it("os workflows da lista fixa registram a execução antes do trabalho, sem poder falhar por isso", () => {
    for (const nome of [
      "robo-empregare.yml",
      "pre-classificacao.yml",
      "conferencias.yml",
      "sincronizar-entrevistas.yml",
      "sincronizar-selecao.yml",
    ]) {
      const w = WF(nome);
      const i = w.indexOf("- name: Registrar a execução no MONITORA");
      expect(i, nome).toBeGreaterThan(-1);
      const passo = w.slice(i, w.indexOf("\n      - name:", i + 10));
      expect(passo, nome).toContain("continue-on-error: true");
      expect(passo, nome).toContain(
        "ATOR_GITHUB: ${{ github.triggering_actor }}",
      );
      expect(passo, nome).toContain(
        "DISPARADO_POR: ${{ inputs.disparado_por }}",
      );
      expect(passo, nome).toMatch(
        new RegExp(
          `-m monitora\\.disparo_externo ${nome.replace(".", "\\.")}$`,
          "m",
        ),
      );
      expect(passo, nome).not.toContain("CANDIDATOS");
    }
    const robo = WF("robo-empregare.yml");
    expect(robo.indexOf("Registrar a execução no MONITORA")).toBeLessThan(
      robo.indexOf("- name: Rodar o robô"),
    );
  });
});

describe("Rodar com opções: forçar edital congelado", () => {
  const empregare = roboDeCarga("empregare");
  const pre = roboDeCarga("pre_classificacao");

  it("só nos modos que gravam, com edital ou vagas e motivo", () => {
    expect(
      validarOpcoes(empregare, {
        modo: "normal",
        editais: ["114/2026"],
        forcar_congelado: true,
      }).erro,
    ).toBe("motivo_do_congelado");
    expect(
      validarOpcoes(empregare, {
        modo: "anexos",
        editais: ["114/2026"],
        seco: true,
        forcar_congelado: true,
        motivo: "x".repeat(12),
      }).erro,
    ).toBe("congelado_no_modo");
    // Só anexos grava respostas e anexos: com a liberação (20261022170000).
    expect(
      validarOpcoes(empregare, {
        modo: "anexos",
        editais: ["114/2026"],
        forcar_congelado: true,
        motivo: "x".repeat(12),
      }).opcoes,
    ).toMatchObject({ modo: "anexos", forcar_congelado: true });
    expect(
      validarOpcoes(empregare, {
        modo: "normal",
        forcar_congelado: true,
        motivo: "x".repeat(12),
      }).erro,
    ).toBe("congelado_sem_edital");
    expect(
      validarOpcoes(empregare, {
        modo: "normal",
        editais: ["114/2026"],
        motivo: "sem forçar o motivo",
      }).erro,
    ).toBe("motivo_sem_forcar");
    expect(
      validarOpcoes(roboDeCarga("conferencias"), { forcar_congelado: true })
        .erro,
    ).toBe("opcao_nao_aceita");
    const ok = validarOpcoes(pre, {
      modo: "refazer_lote",
      editais: ["bcecfb08-88ef-4e06-8401-bcad6bf88fd0"],
      forcar_congelado: true,
      motivo: "  Coordenação autorizou  ",
    });
    expect(ok.opcoes).toMatchObject({
      forcar_congelado: true,
      motivo: "Coordenação autorizou",
    });
    expect(inputsDoPedido({ opcoes: ok.opcoes })).toEqual({
      modo: "refazer_lote",
      editais: ["bcecfb08-88ef-4e06-8401-bcad6bf88fd0"],
      forcar_congelado: true,
      motivo: "Coordenação autorizou",
    });
  });
});
