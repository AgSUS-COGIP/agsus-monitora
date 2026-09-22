import { readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  classificar,
  escaparLiteral,
  ficheirosNoDisco,
  hashDoConteudo,
} from "../scripts/estado-das-migrations-nucleo.mjs";

/*
  O QUE JÁ CORREU NO BANCO, E O QUE FALTA

  Este repositório tinha 25 migrations e 7 ficheiros de correção de dados, e
  nenhum sítio que dissesse quais deles já tinham corrido. `docs/banco-de-dados.md`
  reconhecia isso ao dizer que três ficheiros "não devem ser renomeados: já foram
  aplicados, e renomear quebraria o histórico de quem os aplicou" — histórico que
  não existia em lado nenhum além das pessoas.

  O custo foi medido: na revisão de setembro de 2026 a pergunta "preciso rodar
  algum SQL?" apareceu cinco vezes, e cada resposta exigiu puxar o payload do
  banco e comparar coordenada a coordenada. Treze scripts descartáveis para a
  mesma pergunta.

  A ideia é do SIGAV (`sigav."TB_MIGRACAO"`). O que não veio de lá é o modo de
  aplicar: aqui quem executa SQL é a equipa, e o que faltava era saber o estado.
*/
const ficheiro = (caminho, hash) => ({
  caminho,
  hash,
  diretorio: caminho.split("/")[0],
});
const registo = (caminho, hash, aplicada = "2026-09-22") => ({
  caminho,
  hash,
  origem: "arquivo",
  aplicada,
});

describe("os quatro estados", () => {
  it("o que está no disco e não no banco está por aplicar", () => {
    const r = classificar([ficheiro("migrations/a.sql", "h1")], []);
    expect(r.pendentes.map((f) => f.caminho)).toEqual(["migrations/a.sql"]);
    expect(r.aplicados).toEqual([]);
  });

  it("o que bate em caminho e hash está aplicado", () => {
    const r = classificar(
      [ficheiro("migrations/a.sql", "h1")],
      [registo("migrations/a.sql", "h1")],
    );
    expect(r.aplicados).toHaveLength(1);
    expect(r.pendentes).toEqual([]);
  });

  /*
    O achado que só o hash encontra, e o mais perigoso: alguém corrige um erro
    de digitação numa migration já aplicada, o Git fica coerente, o banco não, e
    ninguém descobre até um ambiente novo nascer diferente.
  */
  it("mesmo caminho e hash diferente é divergência, não pendência", () => {
    const r = classificar(
      [ficheiro("migrations/a.sql", "h2")],
      [registo("migrations/a.sql", "h1")],
    );
    expect(r.divergentes).toHaveLength(1);
    expect(r.divergentes[0].registo.hash).toBe("h1");
    expect(r.pendentes).toEqual([]);
    expect(r.aplicados).toEqual([]);
  });

  /*
    Registado no banco e sem ficheiro no disco. Não é erro por si — o SIGAV
    apagou 181 migrations ao criar um baseline —, mas tem de ser visível.
  */
  it("registado sem ficheiro é órfão", () => {
    const r = classificar([], [registo("migrations/apagada.sql", "h1")]);
    expect(r.orfaos).toHaveLength(1);
    expect(r.pendentes).toEqual([]);
  });

  it("aguenta entrada vazia ou inválida", () => {
    for (const vazio of [undefined, null, "não é lista"]) {
      const r = classificar(vazio, vazio);
      expect(r.aplicados).toEqual([]);
      expect(r.pendentes).toEqual([]);
      expect(r.divergentes).toEqual([]);
      expect(r.orfaos).toEqual([]);
    }
  });

  it("não confunde ficheiros de mesmo nome em diretórios diferentes", () => {
    const r = classificar(
      [ficheiro("migrations/x.sql", "h1"), ficheiro("correcoes/x.sql", "h2")],
      [registo("migrations/x.sql", "h1")],
    );
    expect(r.aplicados.map((f) => f.caminho)).toEqual(["migrations/x.sql"]);
    expect(r.pendentes.map((f) => f.caminho)).toEqual(["correcoes/x.sql"]);
  });
});

describe("o hash", () => {
  it("muda com o conteúdo e não com o nome", () => {
    expect(hashDoConteudo("begin; commit;")).toBe(
      hashDoConteudo("begin; commit;"),
    );
    expect(hashDoConteudo("begin; commit;")).not.toBe(
      hashDoConteudo("begin;  commit;"),
    );
  });

  /*
    Um espaço a mais conta como mudança. É deliberado: o script não tem como
    saber se a diferença é de forma ou de efeito, e quem lê decide — há um modo
    próprio para reconhecer a mudança que foi só de forma.
  */
  it("é sensível a espaço em branco", () => {
    expect(hashDoConteudo("a\n")).not.toBe(hashDoConteudo("a\r\n"));
  });
});

/*
  O caminho vem do disco. Nome de ficheiro com apóstrofo é raro e legal em quase
  todo sistema de ficheiros, e é a forma que uma injeção teria aqui.
*/
describe("o literal que vai para o SQL", () => {
  it("dobra o apóstrofo", () => {
    expect(escaparLiteral("migrations/o'brien.sql")).toBe(
      "'migrations/o''brien.sql'",
    );
  });

  /*
    A propriedade que importa não é "não contém `';`" — `''` contém isso
    legitimamente, e foi assim que a primeira versão deste caso reprovou código
    correto. O que fecha um literal antes da hora é um apóstrofo ÍMPAR: depois
    de remover os pares, não pode sobrar nenhum.
  */
  it("não deixa escapar uma aspa solta", () => {
    const perigoso = "x'; drop table public.migracoes_aplicadas; --";
    const escapado = escaparLiteral(perigoso);
    expect(escapado.startsWith("'")).toBe(true);
    expect(escapado.endsWith("'")).toBe(true);
    expect(escapado.slice(1, -1).replace(/''/g, "")).not.toContain("'");
  });
});

describe("contra os ficheiros deste repositório", () => {
  const noDisco = ficheirosNoDisco("supabase");

  it("encontra as migrations e as correções", () => {
    expect(noDisco.length).toBeGreaterThan(25);
    expect(noDisco.some((f) => f.diretorio === "migrations")).toBe(true);
    expect(noDisco.some((f) => f.diretorio === "correcoes")).toBe(true);
  });

  it("cada ficheiro tem caminho único", () => {
    const vistos = new Set(noDisco.map((f) => f.caminho));
    expect(vistos.size).toBe(noDisco.length);
  });

  it("diretório ausente não é erro", () => {
    expect(() => ficheirosNoDisco("não-existe")).not.toThrow();
    expect(ficheirosNoDisco("não-existe")).toEqual([]);
  });

  /*
    A migration que cria a tabela tem de estar entre os ficheiros, senão o
    script não teria onde consultar.
  */
  it("a migration do próprio registro está lá", () => {
    expect(
      noDisco.some((f) =>
        f.caminho.includes("criar_registro_de_migracoes_aplicadas"),
      ),
    ).toBe(true);
  });
});

/*
  A tabela é ferramenta de operação, não superfície da aplicação: o navegador
  não a alcança, e nada no frontend deve passar a alcançá-la.
*/
describe("a tabela não é exposta ao navegador", () => {
  const migration = readdirSync("supabase/migrations").find((n) =>
    n.includes("criar_registro_de_migracoes_aplicadas"),
  );
  const sql = readFileSync(`supabase/migrations/${migration}`, "utf8");

  it("tem RLS ligada e nenhuma policy", () => {
    expect(sql).toContain("enable row level security");
    expect(sql.toLowerCase()).not.toContain("create policy");
  });

  it("revoga de anon e de authenticated", () => {
    expect(sql).toContain(
      "revoke all on table public.migracoes_aplicadas from anon",
    );
    expect(sql).toContain(
      "revoke all on table public.migracoes_aplicadas from authenticated",
    );
  });

  it("nenhum módulo do frontend a menciona", () => {
    const procurar = (dir) =>
      readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
        e.isDirectory()
          ? procurar(`${dir}/${e.name}`)
          : e.name.endsWith(".js")
            ? [`${dir}/${e.name}`]
            : [],
      );
    for (const caminho of procurar("src")) {
      expect(
        readFileSync(caminho, "utf8"),
        `${caminho} menciona a tabela de migrations`,
      ).not.toContain("migracoes_aplicadas");
    }
  });
});
