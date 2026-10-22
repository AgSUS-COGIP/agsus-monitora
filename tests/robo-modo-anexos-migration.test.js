import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  inputsDoPedido,
  roboDeCarga,
  validarOpcoes,
} from "../src/lib/robos-de-carga.js";
import {
  acompanhamentoDoPedido,
  previaDoDisparo,
} from "../src/lib/painel-dos-robos.ts";

/*
  Robô da Empregare: modo "Só anexos" (20261020130000). Relê só os anexos do
  questionário sem exportar nem pré-classificar; a resposta editada depois da
  captura volta a ser lida; arquivo trocado invalida a leitura automática.
*/
const ler = (f) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261020130000_robo_modo_anexos.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const WORKFLOW = ler(".github/workflows/robo-empregare.yml");

const corpo = (texto, cabeca) => {
  const i = texto.indexOf(cabeca);
  expect(i, cabeca).toBeGreaterThan(-1);
  return texto.slice(i, texto.indexOf("$function$;", i));
};

describe("migration do modo anexos", () => {
  it("numa transação, com pré-requisito, e cada função com search_path vazio, comentário e grants", () => {
    expect(MIGRATION.trim()).toMatch(
      /^\/\*[\s\S]*\*\/\s*begin;[\s\S]*commit;$/,
    );
    expect(MIGRATION).toContain("raise exception 'Aplique antes");
    for (const [cabeca, assinatura, papel] of [
      [
        "create or replace function public.listar_prioridade_anexos_empregare(",
        "public.listar_prioridade_anexos_empregare(text)",
        "service_role",
      ],
      [
        "create or replace function public.gravar_anexos_empregare(",
        "public.gravar_anexos_empregare(text, text, jsonb)",
        "service_role",
      ],
      [
        "create function public.listar_anexos_empregare(",
        "public.listar_anexos_empregare(text, text[])",
        "service_role",
      ],
      [
        "create or replace function public.disparar_robo(",
        "public.disparar_robo(text, jsonb)",
        "authenticated",
      ],
    ]) {
      const c = corpo(MIGRATION, cabeca);
      expect(c, cabeca).toContain("security definer");
      expect(c, cabeca).toMatch(/set search_path (=|to) ''/);
      expect(MIGRATION).toContain(`comment on function ${assinatura} is`);
      expect(MIGRATION).toContain(
        `grant execute on function ${assinatura} to ${papel};`,
      );
    }
    for (const assinatura of [
      'private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(jsonb)',
      'private."FC_ARQUIVO_DO_LINK_EMPREGARE"(text)',
    ]) {
      expect(MIGRATION).toContain(`comment on function ${assinatura} is`);
      expect(MIGRATION).toContain(
        `revoke all on function ${assinatura} from public, anon, authenticated;`,
      );
    }
  });

  it("correção de raiz: lida só a resposta capturada a partir do dia seguinte à DATA DE RESPOSTA", () => {
    const limite = corpo(
      MIGRATION,
      'create function private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"',
    );
    expect(limite).toContain("e.key ilike 'DATA DE RESPOSTA%'");
    expect(limite).toContain(
      "(v_dia + 1)::timestamp at time zone 'America/Sao_Paulo'",
    );
    expect(limite).toContain("to_date(left(x.v, 10), 'DD/MM/YYYY')");
    const prior = corpo(
      MIGRATION,
      "create or replace function public.listar_prioridade_anexos_empregare(",
    );
    expect(prior).toContain(
      'private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(c."DS_COLUNA_ORIGINAL") as limite',
    );
    expect(prior).toContain(
      'and (k.limite is null or r."DT_CAPTURA" >= k.limite)',
    );
    expect(prior).toContain('having sum(r."QT_PERGUNTA") >= k.perguntas');
    expect(prior).not.toMatch(
      /\b(insert|update|delete)\b\s+(into|public|from)/i,
    );
  });

  it("gravar_anexos_empregare: arquivo trocado (pelo arquivo= do link) apaga só a leitura dele", () => {
    const gravar = corpo(
      MIGRATION,
      "create or replace function public.gravar_anexos_empregare(",
    );
    expect(gravar).toContain(
      'perform private."FC_EMPREGARE_EXIGIR_SYNC"(p_sync);',
    );
    expect(gravar.indexOf("into v_antigos")).toBeLessThan(
      gravar.indexOf('delete from public."TB_EMPREGARE_ANEXO"'),
    );
    expect(gravar).toContain('delete from public."TB_LEITURA_ARQUIVO" l');
    expect(gravar).toContain('l."CO_EMPREGARE_RESPOSTA" = v_resp');
    expect(gravar).toContain(
      'is distinct from coalesce(private."FC_ARQUIVO_DO_LINK_EMPREGARE"(a."DS_LINK"), a."DS_LINK")',
    );
    expect(gravar).toContain("'leituras_invalidadas', v_invalidadas");
    // Nada além da resposta, dos anexos e da leitura: a carga (candidatos, vagas, lote) não muda.
    expect(gravar).not.toMatch(
      /TB_EMPREGARE_VAGA|TB_PRE_CLASSIFICACAO|ST_REGISTRO_ATIVO/,
    );
  });

  it("listar_anexos_empregare: só leitura, só hashes (nunca o link) e, sem códigos, só os suspeitos", () => {
    const listar = corpo(
      MIGRATION,
      "create function public.listar_anexos_empregare(",
    );
    expect(listar).toMatch(/stable\s+security definer/);
    expect(listar).not.toMatch(
      /\b(insert|update|delete)\b\s+(into|public|from)/i,
    );
    expect(listar).toContain("a.capturado_em < a.limite) as suspeito");
    expect(listar).toContain("where cardinality(v_codigos) > 0 or m.suspeito");
    expect(listar).toContain("cardinality(v_codigos) > 1000");
    expect(listar).not.toMatch(/'link',|'impressao'|DS_LINK_IMPRESSAO/);
    expect(listar.match(/encode\(sha256\(/g)).toHaveLength(2);
  });

  it("disparo: modo anexos com candidatos e seco só nele; pede vagas ou editais", () => {
    const fc = corpo(
      MIGRATION,
      'create or replace function private."FC_DISPARAR_ROBO"',
    );
    expect(fc).toContain(
      "'robo-empregare.yml', jsonb_build_array('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco')",
    );
    const rpc = corpo(
      MIGRATION,
      "create or replace function public.disparar_robo(",
    );
    for (const trecho of [
      "'modos', jsonb_build_array('normal', 'seco', 'fumaca', 'forcar', 'sondar', 'anexos')",
      "if v_chave not in ('modo', 'editais', 'vagas', 'limite', 'anexos', 'candidatos', 'seco')",
      "raise exception 'O modo Só anexos pede vagas ou editais.'",
      "elsif cardinality(v_candidatos) > 0 or coalesce(v_seco, false) then",
      "cardinality(v_candidatos) > 1000",
      "jsonb_build_object('candidatos', array_to_string(v_candidatos, ','))",
      "if not public.pode_disparar_carga() then",
    ])
      expect(rpc).toContain(trecho);
  });

  it("rollback volta às versões anteriores e tira as funções novas; ensaio só lê e termina em rollback", () => {
    expect(ROLLBACK).toContain(
      "drop function if exists public.listar_anexos_empregare(text, text[]);",
    );
    expect(ROLLBACK).toContain(
      'drop function if exists private."FC_LIMITE_DA_RESPOSTA_EMPREGARE"(jsonb);',
    );
    expect(ROLLBACK).not.toContain('FC_LIMITE_DA_RESPOSTA_EMPREGARE"(c.');
    expect(ROLLBACK).not.toContain("TB_LEITURA_ARQUIVO");
    expect(ROLLBACK).toContain(
      "jsonb_build_array('normal', 'seco', 'fumaca', 'forcar', 'sondar'),",
    );
    expect(ENSAIO.trim()).toMatch(/^\/\*[\s\S]*\*\/\s*begin;[\s\S]*rollback;$/);
    expect(ENSAIO).toContain("2160872");
    expect(ENSAIO).not.toMatch(
      /gravar_anexos_empregare\(|disparar_robo\(|FC_DISPARAR_ROBO"\(/,
    );
  });
});

describe("workflow do robô no modo anexos", () => {
  it("aceita o modo anexos, candidatos e seco e roda o robô com --so-anexos", () => {
    expect(WORKFLOW).toMatch(/^ {10}- anexos$/m);
    expect(WORKFLOW).toMatch(
      /^ {6}candidatos:\n {8}description: .*\n {8}type: string/m,
    );
    expect(WORKFLOW).toMatch(
      /^ {6}seco:\n {8}description: .*\n {8}type: boolean/m,
    );
    expect(WORKFLOW).toContain(
      'args+=(--so-anexos --candidatos "$CANDIDATOS")',
    );
    expect(WORKFLOW).toContain(
      'if [ "$SECO" = "sim" ]; then args+=(--seco); fi',
    );
  });

  it("a pré-classificação NÃO roda no modo anexos (só normal e forcar)", () => {
    // Job que chama pre-classificacao.yml (20261022120000), só com carga gravada.
    const passo = WORKFLOW.slice(
      WORKFLOW.indexOf("name: Pré-classificar os editais carregados"),
    );
    const condicao = passo.match(/^\s*if: (.*)$/m)[1];
    expect(condicao).toBe(
      "${{ !cancelled() && needs.robo.outputs.carga == 'sim' && (inputs.modo == 'normal' || inputs.modo == 'forcar') }}",
    );
    expect(condicao).not.toContain("anexos");
  });
});

describe("Só anexos na tela (validarOpcoes, pedido e prévia)", () => {
  const robo = roboDeCarga("empregare");

  it("pede vagas ou editais; candidatos e seco só no modo anexos", () => {
    expect(validarOpcoes(robo, { modo: "anexos" }).erro).toBe(
      "anexos_sem_vagas",
    );
    expect(
      validarOpcoes(robo, { modo: "normal", candidatos: ["1"] }).erro,
    ).toBe("so_no_modo_anexos");
    expect(validarOpcoes(robo, { modo: "normal", seco: true }).erro).toBe(
      "so_no_modo_anexos",
    );
    expect(
      validarOpcoes(robo, { modo: "anexos", vagas: "1", candidatos: "x1" })
        .erro,
    ).toBe("candidato_invalido");
    expect(
      validarOpcoes(robo, { modo: "anexos", vagas: "1", anexos: true }).erro,
    ).toBe("anexos_no_modo");
    const { opcoes } = validarOpcoes(robo, {
      modo: "anexos",
      editais: ["114/2026"],
      candidatos: "2160872 2160872, 2160873",
      seco: true,
    });
    expect(opcoes).toEqual({
      modo: "anexos",
      editais: ["114/2026"],
      vagas: [],
      limite: null,
      candidatos: ["2160872", "2160873"],
      seco: true,
    });
    expect(inputsDoPedido({ opcoes })).toEqual({
      modo: "anexos",
      editais: ["114/2026"],
      candidatos: ["2160872", "2160873"],
      seco: true,
    });
    expect(
      validarOpcoes(roboDeCarga("pre_classificacao"), {
        modo: "normal",
        seco: true,
      }).erro,
    ).toBe("opcao_nao_aceita");
  });

  it("prévia diz que só relê os anexos; o seco não espera registro no banco", () => {
    expect(
      previaDoDisparo({
        robo: "empregare",
        modo: "anexos",
        codigos: ["182514"],
      }).frase,
    ).toBe(
      "Relê só os anexos de quem respondeu depois da última captura em 1 vaga: 182514",
    );
    const pedido = {
      em: new Date(),
      modo: "anexos",
      disparo: { aceito: true },
    };
    expect(
      acompanhamentoDoPedido({
        robo: "empregare",
        pedido: { ...pedido, seco: true },
      }).semRegistro,
    ).toBe(true);
    expect(
      acompanhamentoDoPedido({ robo: "empregare", pedido }).semRegistro,
    ).toBe(false);
  });
});
