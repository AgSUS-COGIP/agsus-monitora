import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/*
  Correções 20261104-apagar-edital-teste-sede (o edital "Teste" da SEDE) e
  20261104-apagar-editais-de-treinamento (991/2099 e 992/2099): apagam os
  editais e tudo ligado a eles, assinadas pela conta do setor, medindo antes e
  depois. Os ensaios begin…rollback rodaram no banco em 04/11/2026 (ENSAIO_OK
  com 3.173 e 812 linhas); aqui, as invariantes estáticas.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const CONTA_DO_SETOR = "a01afddb-f64b-47d9-80e8-476a1ed14e43";
const TESTE = "317709c7-e5a5-4333-b2f2-ef0a8cfb8c12";
const SI = "d06a691d-a3f5-4494-b3e2-c01220d6050d";
const PROJ = "efbb0a48-d5c5-4792-9c06-ad4e4c6f3f80";
const EDITAL_114 = "bcecfb08-88ef-4e06-8401-bcad6bf88fd0";

const CASOS = [
  {
    nome: "20261104-apagar-edital-teste-sede",
    editais: [TESTE],
    outros: [SI, PROJ],
    total: 3173,
  },
  {
    nome: "20261104-apagar-editais-de-treinamento",
    editais: [SI, PROJ],
    outros: [TESTE],
    total: 812,
  },
].map((c) => ({
  ...c,
  correcao: ler(`supabase/correcoes/${c.nome}.sql`),
  ensaio: ler(`supabase/ensaios/${c.nome}.sql`),
}));

const entreMarcadores = (texto, nome) =>
  texto.slice(
    texto.indexOf(`-- >>> ${nome}\n`),
    texto.indexOf(`-- <<< ${nome}\n`) + `-- <<< ${nome}\n`.length,
  );
const semComentarios = (texto) =>
  texto
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((linha) => linha.replace(/--.*$/, ""))
    .join("\n");
/** A máquina comum: da definição dos conjuntos ao fim do corpo, sem o rótulo e o comentário. */
const maquina = (texto) => {
  const corpo = entreMarcadores(texto, "correcao");
  return corpo
    .slice(corpo.indexOf("create temporary table tmp_def_conjunto"))
    .replace(/'correcao-20261104-[a-z-]+'/, "'<nome>'")
    .replace(
      /\n-- O comentário da marca[\s\S]*?apagou esse edital e tudo ligado a ele\.';\n/,
      "",
    );
};
const esperadoTotal = (texto) =>
  [
    ...entreMarcadores(texto, "correcao").matchAll(
      /\('public\."[A-Z_]+"', '[0-9a-f-]{36}', (\d+)\)/g,
    ),
  ]
    .map((m) => Number(m[1]))
    .reduce((a, b) => a + b, 0);

describe.each(CASOS)("correção $nome", (c) => {
  it("apaga só os editais dela, conferidos pelo id, nome, área e marca de treinamento", () => {
    const corpo = entreMarcadores(c.correcao, "correcao");
    for (const id of c.editais) expect(corpo).toContain(`'${id}'`);
    for (const id of [...c.outros, EDITAL_114]) expect(corpo).not.toContain(id);
    expect(corpo).toContain(`v_m."ST_TREINAMENTO" is distinct from 'S'`);
    expect(corpo).toContain("v_m.edital is distinct from e.edital");
    expect(corpo).toContain("for update");
  });

  it("assina pela conta do setor (admin global ativo e auth.uid)", () => {
    expect(c.correcao).toContain(`p.user_id = '${CONTA_DO_SETOR}'`);
    expect(c.correcao).toContain('a."ST_ADMIN_GLOBAL"');
    expect(c.correcao).toContain(
      `'{"sub":"${CONTA_DO_SETOR}","role":"authenticated"}'`,
    );
    expect(c.correcao).toContain(
      `auth.uid() is distinct from '${CONTA_DO_SETOR}'::uuid`,
    );
  });

  it("mede antes, exige o esperado e reprova se sobrar linha ou cair total fora do apagado", () => {
    expect(esperadoTotal(c.correcao)).toBe(c.total);
    const sql = semComentarios(c.correcao);
    expect(sql).toContain("O banco mudou desde o levantamento");
    expect(sql).toContain("Sobrou % linha(s) ligada(s)");
    expect(sql).toContain("que citam o edital");
    expect(sql).toContain("total_antes - total_depois <> apagadas");
    expect(sql).toContain('private."FC_MARCAR_CACHE"');
  });

  it("não usa atalho perigoso nem apaga Storage por SQL", () => {
    const sql = semComentarios(c.correcao);
    expect(sql).not.toMatch(/session_replication_role/i);
    expect(sql).not.toMatch(/\btruncate\b/i);
    expect(sql).not.toMatch(/delete\s+from\s+storage\./i);
    expect(sql).not.toMatch(/disable trigger all|disable trigger user/i);
    expect(sql).not.toMatch(/\bdrop\s+(table|function|view|trigger)\b/i);
    // Os únicos gatilhos desligados são os 3 da Triagem, religados na mesma transação.
    const desligados = [...sql.matchAll(/disable trigger "([A-Z_]+)"/g)].map(
      (m) => m[1],
    );
    const religados = [...sql.matchAll(/enable trigger "([A-Z_]+)"/g)].map(
      (m) => m[1],
    );
    expect(desligados.sort()).toEqual([
      "TG_REGRATRIAGEM_SEMAPAGAR",
      "TG_THREGRATRIAGEM_IMUTAVEL",
      "TG_TLPRECLASSIF_SEMAPAGAR",
    ]);
    expect(religados.sort()).toEqual(desligados.sort());
  });

  it("o ensaio é cópia literal do corpo e termina em ENSAIO_OK + rollback, sem commit", () => {
    const corpo = entreMarcadores(c.correcao, "correcao");
    expect(corpo.length).toBeGreaterThan(5000);
    expect(entreMarcadores(c.ensaio, "correcao")).toBe(corpo);
    const sql = semComentarios(c.ensaio);
    expect(sql).toMatch(/^\s*begin;/);
    expect(sql).not.toMatch(/\bcommit;/);
    expect(sql).toContain("raise exception 'ENSAIO_OK");
    expect(sql.indexOf("\nrollback;\n")).toBeGreaterThan(
      sql.indexOf("ENSAIO_OK"),
    );
    expect(c.correcao.trimEnd().endsWith("commit;")).toBe(true);
  });
});

describe("as duas correções", () => {
  it("usam a mesma máquina (conjuntos, tabelas, ordem e conferências)", () => {
    expect(maquina(CASOS[0].correcao)).toBe(maquina(CASOS[1].correcao));
  });
});
