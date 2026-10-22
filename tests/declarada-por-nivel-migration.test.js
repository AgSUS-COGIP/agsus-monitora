import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  A migration da nota declarada com pontos por nível (20261007140000), ainda
  não aplicada: o ensaio begin…rollback está em supabase/ensaios/ (rodado no
  Supabase real). Aqui, as invariantes estáticas: a validação aceita
  pontos_por_nivel com as mesmas mensagens de validarRegraAnalise(), a leitura
  do job traz o cargo e o documental, ensaio com o corpo idêntico (e a
  correção dos modelos) e rollback para as versões anteriores.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const NOME = "20261007140000_declarada_por_nivel.sql";
const MIGRATION = ler(`supabase/migrations/${NOME}`);
const ENSAIO = ler(`supabase/ensaios/${NOME}`);
const ROLLBACK = ler(`supabase/rollback/${NOME}`);
const REGRA_JS = ler("src/lib/avaliacao-documental/regra.js");
const CORRECAO = ler(
  "supabase/correcoes/20261007-declarada-experiencia-por-nivel.sql",
);

const corpoDaFuncao = (cabeca, texto = MIGRATION) => {
  const inicio = texto.indexOf(cabeca);
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(
    inicio,
    texto.indexOf("$function$;", texto.indexOf("as $function$", inicio)) + 11,
  );
};

describe("validação da regra com pontos por nível", () => {
  const validar = corpoDaFuncao(
    'create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)',
  );

  it("aceita pontos_por_nivel só em OPCAO/OPCOES_SOMADAS, nos níveis conhecidos, sem os pontos simples", () => {
    expect(validar).toContain("v_item.value -> 'pontos_por_nivel'");
    expect(validar).toContain(
      "n.key not in ('superior', 'tecnico', 'medio', 'fundamental')",
    );
    expect(validar).toContain(
      'private."FC_JSON_MAPA_DECLARADA_OK"(n.value, 100)',
    );
  });

  it("as mensagens são as do formulário (validarRegraAnalise)", () => {
    for (const mensagem of [
      "pontos por nível só em OPCAO ou OPCOES_SOMADAS.",
      "pontos ou pontos por nível, não os dois.",
      "pontos por nível (superior, tecnico, medio, fundamental), de 0 a 100 em cada resposta (até 50 respostas).",
    ]) {
      expect(validar).toContain(mensagem);
      expect(REGRA_JS).toContain(mensagem);
    }
  });

  it("o resto da validação é o de 20261007100000", () => {
    const anterior = corpoDaFuncao(
      'create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)',
      ler("supabase/migrations/20261007100000_pergunta_com_alternativas.sql"),
    );
    const semANotaDeclarada = (texto) =>
      texto.replace(
        / {2}v_lista := coalesce\(v_obj -> 'nota_declarada'[\s\S]*?end loop;\n/,
        "",
      );
    expect(
      semANotaDeclarada(validar).replace("  v_por_nivel jsonb;\n", ""),
    ).toBe(semANotaDeclarada(anterior));
  });
});

describe("leitura do job", () => {
  it("cada vaga traz o cargo do quadro e o edital, o documental da regra de classificação", () => {
    const ler = corpoDaFuncao(
      "create or replace function public.pre_classificacao_ler_editais(",
    );
    expect(ler).toContain(`'cargo', q."NO_CARGO"`);
    expect(ler).toContain(
      `'documental', private."FC_DOCUMENTAL_DO_EDITAL"(m.id)`,
    );
    expect(ler).toContain("security definer");
    expect(ler).toContain("set search_path to ''");
  });
});

describe("ensaio e rollback", () => {
  it("o ensaio traz o corpo sem mudança, a correção duas vezes e termina em rollback", () => {
    const linhas = MIGRATION.split("\n");
    const corpo = linhas
      .slice(linhas.indexOf("begin;") + 1, linhas.lastIndexOf("commit;"))
      .join("\n");
    expect(ENSAIO).toContain(corpo);
    const correcao = CORRECAO.split("\n");
    const corpoDaCorrecao = correcao
      .slice(correcao.indexOf("begin;") + 1, correcao.lastIndexOf("commit;"))
      .join("\n")
      .trim();
    expect(ENSAIO.split(corpoDaCorrecao).length - 1).toBe(2);
    expect(ENSAIO.trim().endsWith("rollback;")).toBe(true);
    expect(ENSAIO).not.toMatch(/^commit;/m);
    expect(ENSAIO).toContain("ENSAIO OK");
    expect(ENSAIO).toContain("raise exception 'FALHOU");
  });

  it("o rollback devolve as versões anteriores e tira a função nova", () => {
    expect(ROLLBACK).toContain(
      corpoDaFuncao(
        'create or replace function private."FC_VALIDAR_REGRA_ANALISE"(p_regra jsonb)',
        ler("supabase/migrations/20261007100000_pergunta_com_alternativas.sql"),
      ),
    );
    expect(ROLLBACK).not.toContain("pontos_por_nivel'");
    expect(ROLLBACK).not.toContain(`'cargo', q."NO_CARGO"`);
    expect(ROLLBACK).toContain(
      'drop function private."FC_JSON_MAPA_DECLARADA_OK"(jsonb, numeric);',
    );
    expect(ROLLBACK).toMatch(/^begin;$/m);
    expect(ROLLBACK).toMatch(/^commit;$/m);
  });
});
