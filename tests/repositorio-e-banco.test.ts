// @vitest-environment node
import { bloco } from "./apoio/bloco.ts";
import fs, { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it, beforeAll, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import {
  ABA,
  abasDoXlsx,
  dataDaCelula,
  juntarVinculos,
  vinculosDaAba,
} from "../scripts/carregar-admissoes-conciliadas.mjs";
import path, { resolve } from "node:path";
import {
  type Banco,
  bancoDeHoje,
  EDITAL,
  entrar,
  erroDe,
  MIGRATION,
  novaVersaoDaRegra,
  REGRA,
  retratoDaTriagem,
  rpc,
} from "./apoio/banco-do-fundamento.ts";
import {
  conferirBiblioteca,
  extrairLinks,
  lerCabecalho,
  lerRepositorio,
} from "../scripts/checar-links-da-biblioteca.mjs";
import { PGlite } from "@electric-sql/pglite";
import { moldeDeBanco } from "./apoio/molde-de-banco.ts";
import { execFileSync } from "node:child_process";
import {
  ACIMA_DO_LIMITE,
  conferirLib,
  LIMITE_POR_PASTA,
  SOLTOS_PERMITIDOS,
} from "../scripts/check-lib-sem-arquivo-solto.mjs";
import { definicoes, resolver, valorDe } from "./apoio/tokens-de-camada.ts";
import { limparTextoDoErro } from "../src/lib/seguranca/registro-de-erros.ts";
import {
  ADMIN,
  ANA,
  BIA,
  CAIO,
  COORDENADOR,
  DANI,
  JUSTIFICATIVA,
  bancoDeHoje as bancoDoPedidoDeAcesso,
  ensaio as ensaioDoPedido,
  entrar as entrarNoPedido,
  erroDe as erroDoPedido,
  funcaoDoRetrato,
  migration as migrationDoPedido,
  rollback as rollbackDoPedido,
  rpc as rpcDoPedido,
  type Banco as BancoDoPedido,
} from "./apoio/banco-do-pedido-de-acesso.ts";

bloco("aba-mapa-no-banco", () => {
  /*
    A migration 20261118160000 (aba Mapa na Saúde Indígena) num Postgres de
    verdade (PGlite), sobre o catálogo de abas de hoje: as tabelas e a função
    do menu copiadas do banco (fixtures/sql-do-banco/catalogo-de-abas-em-18-11.sql)
    e as linhas da resposta real do menu
    (fixtures/listar-abas-do-menu-triagem.json, já com o Mapa: o "hoje" é ela
    sem o Mapa e com as abas uma posição acima).

    hoje × migrada (a resposta da fixture). A migration foi aplicada e registrada
    em 18/11/2026 e saiu de supabase/migrations/; o teste a lê da cópia em
    fixtures/sql-do-banco/ (o rollback e o ensaio saíram com ela).
  */

  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const NOME = "20261118160000_aba_mapa_na_saude_indigena.sql";
  const migration = () => ler(`tests/fixtures/sql-do-banco/${NOME}`);

  interface AreaDoMenu {
    co_area: string;
    nu_ordem: number;
    co_view: string;
    ds_icone: string;
  }
  interface AbaDoMenu {
    co_aba: string;
    no_aba: string;
    ds_icone: string;
    nu_ordem: number;
    co_view: string;
    co_recurso: string;
    tp_aba: string;
    st_beta: boolean;
    areas: AreaDoMenu[];
  }
  const DEPOIS: AbaDoMenu[] = JSON.parse(
    ler("tests/fixtures/listar-abas-do-menu-triagem.json"),
  );
  /* O catálogo de hoje: sem o Mapa, as abas da ordem 3 em diante uma posição acima. */
  const subir = (n: number) => (n >= 3 ? n - 1 : n);
  const HOJE: AbaDoMenu[] = DEPOIS.filter((a) => a.co_aba !== "mapa").map(
    (a) => ({
      ...a,
      nu_ordem: subir(a.nu_ordem),
      areas: a.areas.map((x) => ({ ...x, nu_ordem: subir(x.nu_ordem) })),
    }),
  );
  const AREAS = ["saude-indigena", "sede", "projetos"];

  const texto = (v: string) => `'${v.replace(/'/g, "''")}'`;
  function semear(abas: readonly AbaDoMenu[]): string {
    const linhas = [
      ...AREAS.map(
        (area, i) =>
          `insert into public."TB_AREA" ("CO_AREA","NO_AREA","NO_GRUPO_PLANILHA","NU_ORDEM") values (${texto(area)}, ${texto(area)}, ${texto(area)}, ${i + 1});`,
      ),
    ];
    for (const a of abas) {
      linhas.push(
        `insert into public."TB_ABA" ("CO_ABA","NO_ABA","DS_ICONE","NU_ORDEM","CO_VIEW","CO_RECURSO","TP_ABA","ST_BETA") values (${texto(a.co_aba)}, ${texto(a.no_aba)}, ${texto(a.ds_icone)}, ${a.nu_ordem}, ${texto(a.co_view)}, ${texto(a.co_recurso)}, ${texto(a.tp_aba)}, ${a.st_beta ? "'S'" : "'N'"});`,
      );
      for (const x of a.areas)
        linhas.push(
          `insert into public."RL_ABA_AREA" ("CO_ABA","CO_AREA","NU_ORDEM") values (${texto(a.co_aba)}, ${texto(x.co_area)}, ${x.nu_ordem === a.nu_ordem ? "null" : x.nu_ordem});`,
        );
    }
    return linhas.join("\n");
  }

  const banco = moldeDeBanco(async () => {
    const db = await PGlite.create();
    await db.exec(
      ler("tests/fixtures/sql-do-banco/catalogo-de-abas-em-18-11.sql"),
    );
    await db.exec(semear(HOJE));
    return db;
  });

  /* O menu como o front o lê: aba, ordem, view, ícone e as áreas com ordem. */
  async function menu(db: PGlite) {
    const { rows } = await db.query<{ menu: AbaDoMenu[] }>(
      "select public.listar_abas_do_menu() as menu",
    );
    return resumo(rows[0]?.menu ?? []);
  }
  const resumo = (abas: readonly AbaDoMenu[]) =>
    abas.map((a) => ({
      aba: a.co_aba,
      ordem: a.nu_ordem,
      view: a.co_view,
      icone: a.ds_icone,
      recurso: a.co_recurso,
      areas: a.areas.map((x) => `${x.co_area}:${x.nu_ordem}`),
    }));

  describe("migration 20261118160000: a aba Mapa no catálogo", () => {
    it("põe o Mapa na ordem 2, só na Saúde Indígena, e empurra as outras", async () => {
      const db = await banco();
      expect(await menu(db)).toEqual(resumo(HOJE));
      await db.exec(migration());
      const depois = await menu(db);
      expect(depois).toEqual(resumo(DEPOIS));
      expect(depois[1]).toEqual({
        aba: "mapa",
        ordem: 2,
        view: "mapa",
        icone: "globe",
        recurso: "dashboard",
        areas: ["saude-indigena:2"],
      });
    });

    it("não aplica duas vezes", async () => {
      const db = await banco();
      await db.exec(migration());
      await expect(db.exec(migration())).rejects.toThrow(/já existe/);
    });
  });
});

bloco("aba-relatorios-no-banco", () => {
  /*
    A migration 20261123180000 (a aba "Painéis" vira "Relatórios") num
    Postgres de verdade (PGlite), sobre o catálogo de abas copiado do banco
    (fixtures/sql-do-banco/catalogo-de-abas-em-18-11.sql) com as linhas da
    resposta real do menu (fixtures/listar-abas-do-menu-triagem.json, que já
    traz o nome novo: o "hoje" é ela com "Painéis"). Aplicada em 23/11/2026:
    o arquivo, como entrou no banco, está em tests/fixtures/sql-do-banco/ (o
    rollback e o ensaio saíram com ela).
  */
  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const NOME = "20261123180000_aba_paineis_vira_relatorios.sql";
  const migration = () => ler(`tests/fixtures/sql-do-banco/${NOME}`);

  interface AbaDoMenu {
    co_aba: string;
    no_aba: string;
    ds_icone: string;
    nu_ordem: number;
    co_view: string;
    co_recurso: string;
    tp_aba: string;
    st_beta: boolean;
    areas: { co_area: string; nu_ordem: number }[];
  }
  const DEPOIS: AbaDoMenu[] = JSON.parse(
    ler("tests/fixtures/listar-abas-do-menu-triagem.json"),
  );
  const HOJE: AbaDoMenu[] = DEPOIS.map((a) =>
    a.co_aba === "paineis-de-dados" ? { ...a, no_aba: "Painéis" } : a,
  );
  const AREAS = ["saude-indigena", "sede", "projetos"];
  const texto = (v: string) => `'${v.replace(/'/g, "''")}'`;
  const semear = (abas: readonly AbaDoMenu[]) =>
    [
      ...AREAS.map(
        (area, i) =>
          `insert into public."TB_AREA" ("CO_AREA","NO_AREA","NO_GRUPO_PLANILHA","NU_ORDEM") values (${texto(area)}, ${texto(area)}, ${texto(area)}, ${i + 1});`,
      ),
      ...abas.flatMap((a) => [
        `insert into public."TB_ABA" ("CO_ABA","NO_ABA","DS_ICONE","NU_ORDEM","CO_VIEW","CO_RECURSO","TP_ABA","ST_BETA") values (${texto(a.co_aba)}, ${texto(a.no_aba)}, ${texto(a.ds_icone)}, ${a.nu_ordem}, ${texto(a.co_view)}, ${texto(a.co_recurso)}, ${texto(a.tp_aba)}, ${a.st_beta ? "'S'" : "'N'"});`,
        ...a.areas.map(
          (x) =>
            `insert into public."RL_ABA_AREA" ("CO_ABA","CO_AREA","NU_ORDEM") values (${texto(a.co_aba)}, ${texto(x.co_area)}, ${x.nu_ordem === a.nu_ordem ? "null" : x.nu_ordem});`,
        ),
      ]),
    ].join("\n");

  const banco = moldeDeBanco(async () => {
    const db = await PGlite.create();
    await db.exec(
      ler("tests/fixtures/sql-do-banco/catalogo-de-abas-em-18-11.sql"),
    );
    await db.exec(semear(HOJE));
    return db;
  });

  /* O menu como o front o lê: aba, nome, ordem, view, ícone, recurso e áreas. */
  async function menu(db: PGlite) {
    const { rows } = await db.query<{ menu: AbaDoMenu[] }>(
      "select public.listar_abas_do_menu() as menu",
    );
    return resumo(rows[0]?.menu ?? []);
  }
  const resumo = (abas: readonly AbaDoMenu[]) =>
    abas.map((a) => ({
      aba: a.co_aba,
      nome: a.no_aba,
      ordem: a.nu_ordem,
      view: a.co_view,
      icone: a.ds_icone,
      recurso: a.co_recurso,
      areas: a.areas.map((x) => `${x.co_area}:${x.nu_ordem}`),
    }));

  describe("migration 20261123180000: Painéis vira Relatórios", () => {
    it("troca só o nome da aba; view, recurso, ordem e áreas ficam", async () => {
      const db = await banco();
      expect(await menu(db)).toEqual(resumo(HOJE));
      await db.exec(migration());
      expect(await menu(db)).toEqual(resumo(DEPOIS));
      // Idempotente: de novo, nada muda.
      await db.exec(migration());
      expect(await menu(db)).toEqual(resumo(DEPOIS));
    });
  });
});

bloco("cronograma-sem-codex-no-banco", () => {
  /*
    A migration 20261124150000 tira "Conferido por Codex, a pedido de …" das
    observações das etapas do cronograma, num Postgres de verdade (PGlite),
    com os formatos encontrados no banco em 24/11/2026: com vírgulas, sem
    vírgulas, com a fonte por extenso (que tem outra data no meio) e um texto
    sem Codex, que não muda. Aplicada em 24/11/2026 (506 etapas de 33
    editais): o arquivo, como entrou no banco, está em tests/fixtures/sql-do-banco/
    (o rollback e o ensaio saíram com ela; a cópia dos textos de antes ficou em
    arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES").
  */
  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const NOME = "20261124150000_observacao_do_cronograma_sem_codex.sql";
  const migration = () => ler(`tests/fixtures/sql-do-banco/${NOME}`);

  const URL =
    "https://www.agenciasus.org.br/trabalhe-na-agsus/saude-indigena/vagas-dsei-xavante/edital-no-15-2025/retificacao.pdf";
  const HOJE: Record<string, string | null> = {
    "00000000-0000-0000-0000-000000000001": `Conferido por Codex, a pedido de Pessoa Teste, em 17/11/2026. Fonte: ${URL} | Datas publicadas: 15/08/2025 057824) SEI AGSUS.001`,
    "00000000-0000-0000-0000-000000000002":
      "Conferido por Codex a pedido de Pessoa Teste em 17/11/2026. Fonte: Anexo I retificado em 01/09/2026; página oficial e edital atualizado até 10/09/2026.",
    "00000000-0000-0000-0000-000000000003":
      "Conferido por Codex a pedido de Pessoa Teste em 17/11/2026.",
    "00000000-0000-0000-0000-000000000004": "Etapa ajustada pela UGP.",
    "00000000-0000-0000-0000-000000000005": null,
  };
  const DEPOIS: Record<string, string | null> = {
    "00000000-0000-0000-0000-000000000001": `Conferido em 17/11/2026. Fonte: ${URL} | Datas publicadas: 15/08/2025 057824) SEI AGSUS.001`,
    "00000000-0000-0000-0000-000000000002":
      "Conferido em 17/11/2026. Fonte: Anexo I retificado em 01/09/2026; página oficial e edital atualizado até 10/09/2026.",
    "00000000-0000-0000-0000-000000000003": "Conferido em 17/11/2026.",
    "00000000-0000-0000-0000-000000000004": "Etapa ajustada pela UGP.",
    "00000000-0000-0000-0000-000000000005": null,
  };
  const texto = (v: string | null) =>
    v === null ? "null" : `'${v.replace(/'/g, "''")}'`;

  const banco = moldeDeBanco(async () => {
    const db = await PGlite.create();
    await db.exec(`
      create schema arquivo;
      create table public."TB_CRONOGRAMA_MONIT_INDIG" (id uuid primary key, observacao text);
      ${Object.entries(HOJE)
        .map(
          ([id, obs]) =>
            `insert into public."TB_CRONOGRAMA_MONIT_INDIG" values ('${id}', ${texto(obs)});`,
        )
        .join("\n")}
    `);
    return db;
  });

  async function observacoes(db: PGlite) {
    const { rows } = await db.query<{ id: string; observacao: string | null }>(
      'select id::text, observacao from public."TB_CRONOGRAMA_MONIT_INDIG" order by id',
    );
    return Object.fromEntries(rows.map((r) => [r.id, r.observacao]));
  }

  describe("migration 20261124150000: observação do cronograma sem Codex", () => {
    it("troca só o começo, guarda o texto de antes e é idempotente", async () => {
      const db = await banco();
      await db.exec(migration());
      expect(await observacoes(db)).toEqual(DEPOIS);
      const { rows } = await db.query<{ n: number }>(
        'select count(*)::int as n from arquivo."TB_OBSERVACAO_CRONOGRAMA_ANTES"',
      );
      expect(rows[0]?.n).toBe(3);
      await db.exec(migration());
      expect(await observacoes(db)).toEqual(DEPOIS);
    });

    it("formato que a troca não cobre: nada é gravado", async () => {
      const db = await banco();
      await db.exec(
        `insert into public."TB_CRONOGRAMA_MONIT_INDIG" values ('00000000-0000-0000-0000-000000000009', 'Revisado com o Codex.')`,
      );
      await expect(db.exec(migration())).rejects.toThrow(/Codex/);
      await db.exec("rollback");
      expect(
        (await observacoes(db))["00000000-0000-0000-0000-000000000001"],
      ).toBe(HOJE["00000000-0000-0000-0000-000000000001"]);
    });
  });
});

bloco("actions-por-sha", () => {
  /*
  Auditoria de 09/11/2026 (QA-01): Action de terceiro referenciada por tag
  (`@v7`) pode mudar sem aviso se a tag for movida. Toda Action externa fica
  presa ao SHA completo do commit, com a versão no comentário (`# v7`), o
  formato que o Dependabot (`.github/dependabot.yml`, github-actions) mantém
  atualizado. Workflow reutilizável do próprio repositório (`./…`) fica de fora.
*/
  const PASTA = ".github/workflows";
  const usos = readdirSync(PASTA)
    .filter((nome) => /\.ya?ml$/.test(nome))
    .flatMap((nome) =>
      readFileSync(`${PASTA}/${nome}`, "utf8")
        .split(/\r?\n/)
        .map((linha, i) => ({ onde: `${nome}:${i + 1}`, linha }))
        .filter(({ linha }) => /^\s*(?:-\s*)?uses:/.test(linha)),
    );

  describe("Actions presas ao SHA", () => {
    it("há Actions externas para conferir", () => {
      expect(usos.length).toBeGreaterThan(0);
    });

    it("toda Action externa usa o SHA completo e diz a versão", () => {
      const soltas = usos
        .filter(({ linha }) => !/uses:\s*\.\//.test(linha))
        .filter(
          ({ linha }) =>
            !/uses:\s*[\w.-]+\/[\w./-]+@[0-9a-f]{40}\s+#\s*v\d[\w.-]*\s*$/.test(
              linha,
            ),
        )
        .map(({ onde, linha }) => `${onde}: ${linha.trim()}`);
      expect(soltas).toEqual([]);
    });
  });

  /*
  Revisão de segurança de 16/11/2026: o `actions/checkout` guarda o token do
  job no `.git/config` por padrão, e qualquer passo seguinte (pip, npm, script
  do robô) consegue lê-lo. Nenhum workflow faz `git push`, e o `git fetch` da
  `main` é de repositório público: o token não precisa ficar.
*/
  describe("checkout sem credencial guardada", () => {
    it("todo actions/checkout tem persist-credentials: false", () => {
      const semGuarda = readdirSync(PASTA)
        .filter((nome) => /\.ya?ml$/.test(nome))
        .flatMap((nome) => {
          const linhas = readFileSync(`${PASTA}/${nome}`, "utf8").split(
            /\r?\n/,
          );
          return linhas.flatMap((linha, i) => {
            if (!/uses:\s*actions\/checkout@/.test(linha)) return [];
            const proximas = linhas.slice(i + 1, i + 8);
            const fim = proximas.findIndex((l) => /^\s*-\s/.test(l));
            const bloco = fim < 0 ? proximas : proximas.slice(0, fim);
            return bloco.some((l) =>
              /^\s*persist-credentials:\s*false\s*$/.test(l),
            )
              ? []
              : [`${nome}:${i + 1}`];
          });
        });
      expect(semGuarda).toEqual([]);
    });
  });
});

bloco("ambiente-padrao", () => {
  /*
  O ambiente padrão dos testes é node: montar o jsdom custava 2495 s somados
  numa suíte de 557 arquivos, metade deles sem DOM nenhum. Arquivo que usa DOM
  pede o jsdom na primeira linha (docs/biblioteca/testes.md). Este comentário
  não escreve a anotação por extenso: o Vitest a leria mesmo aqui dentro.
*/
  it("sem anotação, o arquivo roda em node (jsdom só onde é declarado)", () => {
    expect(typeof document).toBe("undefined");
    expect(typeof window).toBe("undefined");
  });
});

bloco("carregar-admissoes-conciliadas", () => {
  /*
  A CARGA DAS ADMISSÕES CONCILIADAS (13/11/2026)

  O script lê a aba "Vínculos conciliados" das planilhas de conciliação com o
  RH (.xlsx) sem dependência nova e manda ao banco um vínculo por linha: token,
  edital, linha da lista de aprovados e as datas. Dados fictícios.
*/

  /* Um .xlsx mínimo: zip com os arquivos dados (comprimidos com deflate). */
  function xlsx(arquivos: Record<string, string>): Buffer {
    const locais: Buffer[] = [];
    const centrais: Buffer[] = [];
    let posicao = 0;
    for (const [nome, texto] of Object.entries(arquivos)) {
      const nomeBuf = Buffer.from(nome, "utf8");
      const dados = deflateRawSync(Buffer.from(texto, "utf8"));
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(8, 8);
      local.writeUInt32LE(dados.length, 18);
      local.writeUInt16LE(nomeBuf.length, 26);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(8, 10);
      central.writeUInt32LE(dados.length, 20);
      central.writeUInt16LE(nomeBuf.length, 28);
      central.writeUInt32LE(posicao, 42);
      locais.push(local, nomeBuf, dados);
      centrais.push(central, nomeBuf);
      posicao += 30 + nomeBuf.length + dados.length;
    }
    const diretorio = Buffer.concat(centrais);
    const fim = Buffer.alloc(22);
    fim.writeUInt32LE(0x06054b50, 0);
    fim.writeUInt16LE(Object.keys(arquivos).length, 10);
    fim.writeUInt32LE(diretorio.length, 12);
    fim.writeUInt32LE(posicao, 16);
    return Buffer.concat([...locais, diretorio, fim]);
  }

  const EDITAL = "11111111-2222-4333-8444-555555555555";
  const LINHA = "66666666-7777-4888-9999-aaaaaaaaaaaa";

  const planilha = xlsx({
    "xl/workbook.xml":
      '<workbook xmlns:r="r"><sheets><sheet name="Resumo" sheetId="1" r:id="rId1"/>' +
      `<sheet name="${ABA}" sheetId="2" r:id="rId2"/></sheets></workbook>`,
    "xl/_rels/workbook.xml.rels":
      '<Relationships><Relationship Id="rId1" Target="worksheets/sheet1.xml"/>' +
      '<Relationship Id="rId2" Target="/xl/worksheets/sheet2.xml"/></Relationships>',
    "xl/sharedStrings.xml":
      "<sst><si><t>Token de vínculo</t></si><si><t>Edital</t></si>" +
      "<si><t>Data de admissão</t></si><si><t>Data de desligamento</t></si>" +
      "<si><t>Processo ID</t></si><si><t>Linha origem ID</t></si>" +
      "<si><r><t>Trilha &amp; </t></r><r><t>vínculos</t></r></si></sst>",
    "xl/worksheets/sheet1.xml": "<worksheet><sheetData/></worksheet>",
    "xl/worksheets/sheet2.xml":
      '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>6</v></c></row>' +
      '<row r="3"><c r="A3" t="s"><v>0</v></c><c r="B3" t="s"><v>1</v></c>' +
      '<c r="D3" t="s"><v>2</v></c><c r="F3" t="s"><v>3</v></c>' +
      '<c r="G3" t="s"><v>4</v></c><c r="H3" t="s"><v>5</v></c></row>' +
      `<row r="4"><c r="A4" t="inlineStr"><is><t>AB12cd34ef56</t></is></c><c r="B4" t="inlineStr"><is><t>01/2025</t></is></c>` +
      `<c r="D4" t="inlineStr"><is><t>2025-05-12</t></is></c><c r="F4"/>` +
      `<c r="G4" t="inlineStr"><is><t>${EDITAL}</t></is></c><c r="H4" t="inlineStr"><is><t>${LINHA}</t></is></c></row>` +
      `<row r="5"><c r="A5" t="inlineStr"><is><t>0011223344</t></is></c><c r="D5"><v>45658</v></c>` +
      `<c r="F5" t="inlineStr"><is><t>31/03/2025</t></is></c><c r="G5" t="inlineStr"><is><t>${EDITAL}</t></is></c></row>` +
      `<row r="6"><c r="A6" t="inlineStr"><is><t>99887766</t></is></c><c r="D6" t="inlineStr"><is><t>sem data</t></is></c>` +
      `<c r="G6" t="inlineStr"><is><t>${EDITAL}</t></is></c></row>` +
      "</sheetData></worksheet>",
  });

  describe("leitura do .xlsx", () => {
    it("acha as abas pelo nome, com texto compartilhado e embutido", () => {
      const abas = abasDoXlsx(planilha);
      expect([...abas.keys()]).toEqual(["Resumo", ABA]);
      expect(abas.get(ABA)?.[0]).toEqual({ A: "Trilha & vínculos" });
    });

    it("data em texto, em DD/MM/AAAA e no número de série do Excel", () => {
      expect(dataDaCelula("2026-09-15")).toBe("2026-09-15");
      expect(dataDaCelula("31/03/2025")).toBe("2025-03-31");
      expect(dataDaCelula("45658")).toBe("2025-01-01");
      expect(dataDaCelula("")).toBe("");
      expect(dataDaCelula("sem data")).toBe("");
    });
  });

  describe("vínculos da aba", () => {
    const { vinculos, ignoradas } = vinculosDaAba(
      abasDoXlsx(planilha).get(ABA) || [],
    );

    it("um vínculo por linha, com o cabeçalho achado pelo nome", () => {
      expect(vinculos).toEqual([
        {
          vinculo: "ab12cd34ef56",
          edital: EDITAL,
          linha: LINHA,
          admissao: "2025-05-12",
          desligamento: null,
        },
        {
          vinculo: "0011223344",
          edital: EDITAL,
          linha: null,
          admissao: "2025-01-01",
          desligamento: "2025-03-31",
        },
      ]);
      expect(ignoradas).toBe(1);
    });

    it("sem a coluna do token, recusa", () => {
      expect(() => vinculosDaAba([{ A: "Outra coisa" }])).toThrow(
        "Token de vínculo",
      );
    });

    it("junta as planilhas; o mesmo token com dados diferentes é erro", () => {
      expect(juntarVinculos([vinculos, [vinculos[0]]])).toHaveLength(2);
      expect(() =>
        juntarVinculos([
          vinculos,
          [{ ...vinculos[0], admissao: "2025-06-01" }],
        ]),
      ).toThrow("dados diferentes");
    });
  });
});

bloco("foco-e-borda-dos-campos", () => {
  /*
  Foco visível e borda de campo com contraste (regras de ouro 6, docs/biblioteca/design-e-tokens.md;
  seção 4, "Formulário").

  1. `--focus-ring` é uma COR (tokens.css), não uma sombra:
     `box-shadow: var(--focus-ring)` é declaração inválida e o navegador a
     descarta em silêncio. Seis regras faziam isso junto com `outline: none`;
     o anel que aparecia era o global de `app.css`, e não o que a regra dizia.
     Quem quiser anel próprio usa `outline: 2px solid var(--focus-ring)`.
  2. Campo (input, select, textarea) tem borda `--border-control` (3:1 sobre o
     cartão); `--border-subtle` (#e0e5ec, 1,3:1) some no branco. Achado na
     Convocação e na ficha de Entrevistas no pente fino de 10/11/2026.
*/

  const RAIZ = path.resolve(import.meta.dirname, "..");

  function cssDe(pasta: string): string[] {
    return fs
      .readdirSync(path.join(RAIZ, pasta), { withFileTypes: true })
      .flatMap((item) => {
        const relativo = `${pasta}/${item.name}`;
        if (item.isDirectory()) return cssDe(relativo);
        return item.name.endsWith(".css") ? [relativo] : [];
      });
  }

  interface Regra {
    arquivo: string;
    seletor: string;
    corpo: string;
  }

  function regras(arquivo: string): Regra[] {
    const texto = fs
      .readFileSync(path.join(RAIZ, arquivo), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ");
    return [...texto.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(
      ([, seletor = "", corpo = ""]) => ({
        arquivo,
        seletor: seletor.replace(/\s+/g, " ").trim(),
        corpo,
      }),
    );
  }

  /*
  Campo preenchido da matriz de notas das Entrevistas: a borda some de
  propósito e o fundo (`--surface-hover`) marca a célula.
*/
  const CAMPOS_SEM_BORDA_DE_PROPOSITO = new Set([
    "src/modulos/entrevistas/entrevistas.css .entrevistas-tela .entrevistas-matriz .entrevistas-celula.is-preenchida input.entrevistas-nota",
  ]);

  /* O último seletor simples da lista é um campo de texto ou de escolha? */
  function ehCampo(seletor: string): boolean {
    return seletor.split(",").some((parte) => {
      const ultimo =
        parte
          .trim()
          .split(/[\s>+~]+/)
          .pop() ?? "";
      if (/checkbox|radio|range|:disabled/.test(ultimo)) return false;
      return /^(input|select|textarea)\b|-select$/.test(ultimo);
    });
  }

  describe("foco e borda dos campos", () => {
    const todas = [...cssDe("src/modulos"), ...cssDe("src/ui")].flatMap(regras);

    it("não usa a cor do anel de foco como sombra", () => {
      const invalidas = [...todas, ...cssDe("src/styles").flatMap(regras)]
        .filter((r) =>
          /box-shadow:\s*var\(--focus-ring\)\s*[;}]?/.test(r.corpo),
        )
        .map((r) => `${r.arquivo} ${r.seletor}`);
      expect(invalidas).toEqual([]);
    });

    it("desenha a borda dos campos com --border-control", () => {
      const fracas = todas
        .filter(
          (r) =>
            ehCampo(r.seletor) &&
            /border(-color)?:[^;]*--border-subtle/.test(r.corpo) &&
            !CAMPOS_SEM_BORDA_DE_PROPOSITO.has(`${r.arquivo} ${r.seletor}`),
        )
        .map((r) => `${r.arquivo} ${r.seletor}`);
      expect(fracas).toEqual([]);
    });
  });
});

bloco("fundamento-da-eliminacao-no-banco", () => {
  /*
  Migration 20261110215930 (issue #593, já aplicada; o SQL em
  tests/fixtures/sql-do-banco/): o fundamento normativo das eliminações da
  Triagem é escolhido e conferido SÓ pelo gestor ou coordenador do edital, ou pelo
  administrador global; nada é presumido; a conferência é auditada e imutável; o
  comunicado (conferir_eliminados_pre_classificacao) leva o item só quando conferido; e
  nada da Triagem gravada muda. Postgres de verdade (PGlite), dados fictícios.
*/

  const LONGO = 120_000;
  const FONTE = "Edital nº 114/2026, texto publicado, conferido na íntegra";
  const JUSTIFICATIVA = "Retificação após conferir o texto publicado do edital";

  type Fundamento = {
    situacao: string;
    item_edital: string;
    versao_regra: number;
    fonte: string;
  } | null;
  type Conferencia = {
    ok: boolean;
    sem_mudanca: boolean;
    fundamento: Fundamento;
  };
  type Candidato = {
    codigo: string;
    situacao: string;
    motivo_codigo: string | null;
    fundamento: Fundamento;
  };
  type Quadro = {
    pode_conferir: boolean;
    regra: { versao: number; situacao: string; item_da_nota: string | null };
    motivos: {
      codigo: string;
      eliminados: number;
      item_na_regra: string | null;
      fundamento: Fundamento;
    }[];
    fora_da_regra: { codigo: string; eliminados: number }[];
    fora_do_lote_por_nota: number;
    historico: {
      motivo_codigo: string;
      item_edital: string;
      papel: string;
      por: string;
      justificativa: string | null;
    }[];
  };

  const conferir = (
    db: Banco,
    motivo: string,
    item: string,
    { versao = 1, fonte = FONTE, justificativa = null as string | null } = {},
  ) =>
    rpc<Conferencia>(
      db,
      `public.conferir_fundamento_da_eliminacao($1, $2, $3, $4, $5, $6)`,
      [EDITAL, motivo, versao, item, fonte, justificativa],
    );
  const quadro = (db: Banco) =>
    rpc<Quadro>(db, `public.obter_fundamentos_da_eliminacao($1)`, [EDITAL]);
  const comunicados = async (db: Banco) =>
    (
      await rpc<{ candidatos: Candidato[] }>(
        db,
        `public.conferir_eliminados_pre_classificacao($1, $2)`,
        [
          EDITAL,
          [
            "101|9001",
            "101|9002",
            "101|9003",
            "101|9004",
            "101|9005",
            "101|9006",
          ],
        ],
      )
    ).candidatos;
  const porCodigo = (lista: Candidato[], codigo: string) =>
    lista.find((c) => c.codigo === codigo);

  async function migrado(): Promise<Banco> {
    const db = await bancoDeHoje();
    await db.exec(MIGRATION);
    return db;
  }

  describe("fundamento da eliminação: quem confere", () => {
    let db: Banco;
    beforeAll(async () => {
      db = await migrado();
    }, LONGO);

    it("sem sessão, ninguém confere", async () => {
      await entrar(db, null);
      expect((await erroDe(conferir(db, "QUESTIONARIO", "6.4")))?.codigo).toBe(
        "42501",
      );
    });

    it.each([
      ["analista do edital", "analista"],
      [
        "coordenador só na equipe da avaliação (sem ser gestor)",
        "coordenadorDaEquipe",
      ],
      ["gestor que não vê o edital", "gestorDeOutraArea"],
      [
        "gestor sem nível de administrador na Avaliação documental",
        "gestorSemNivel",
      ],
    ] as const)("%s não confere (42501)", async (_, pessoa) => {
      await entrar(db, pessoa);
      const erro = await erroDe(conferir(db, "QUESTIONARIO", "6.4"));
      expect(erro?.codigo).toBe("42501");
      expect(erro?.mensagem).toMatch(/gestor ou o coordenador do edital/);
    });

    it.each([
      ["gestor do edital", "gestor", "QUESTIONARIO", "EDITAL_GESTOR"],
      ["coordenador do edital", "coordenador", "CANCELADO", "COORDENADOR"],
      ["administrador global", "admin", "REPROVADO_EMPREGARE", "ADMIN_GLOBAL"],
    ] as const)(
      "%s confere, e a auditoria guarda papel, responsável, regra e fonte",
      async (_, pessoa, motivo, papel) => {
        await entrar(db, pessoa);
        const r = await conferir(db, motivo, "6.4");
        expect(r.ok).toBe(true);
        expect(r.fundamento).toMatchObject({
          situacao: "CONFERIDO",
          item_edital: "6.4",
          versao_regra: 1,
          fonte: FONTE,
        });
        const linha = await db.query<Record<string, unknown>>(
          `select "TP_PAPEL", "CO_USUARIO"::text as usuario, "NU_VERSAO_REGRA", "DS_HASH_REGRA", "DS_FONTE",
              "DS_REGRA_MOTIVO" ->> 'codigo' as codigo, "DT_CONFERENCIA" is not null as quando
         from public."TH_FUNDAMENTO_ELIMINACAO" where "CO_MOTIVO_ELIMINACAO" = $1`,
          [motivo],
        );
        expect(linha.rows).toHaveLength(1);
        expect(linha.rows[0]).toMatchObject({
          TP_PAPEL: papel,
          NU_VERSAO_REGRA: 1,
          DS_HASH_REGRA: "1".padStart(64, "0"),
          DS_FONTE: FONTE,
          codigo: motivo,
          quando: true,
        });
      },
    );

    it("o quadro: analista não lê; coordenador da equipe lê sem poder conferir; gestor pode", async () => {
      await entrar(db, "analista");
      expect((await erroDe(quadro(db)))?.codigo).toBe("42501");
      await entrar(db, "coordenadorDaEquipe");
      expect((await quadro(db)).pode_conferir).toBe(false);
      await entrar(db, "gestor");
      const q = await quadro(db);
      expect(q.pode_conferir).toBe(true);
      expect(q.regra).toEqual({
        versao: 1,
        situacao: "CONFERIDA",
        item_da_nota: "8.2.6",
      });
      expect(q.motivos.map((m) => [m.codigo, m.eliminados])).toEqual([
        ["CANCELADO", 1],
        ["QUESTIONARIO", 1],
        ["REPROVADO_EMPREGARE", 1],
        ["TERMO", 0],
      ]);
      expect(q.motivos.find((m) => m.codigo === "TERMO")).toMatchObject({
        item_na_regra: "5.7.5",
        fundamento: null,
      });
      expect(q.fora_da_regra).toEqual([
        {
          codigo: "SAIU_DA_EMPREGARE",
          motivo: "Saiu do arquivo da Empregare",
          eliminados: 1,
        },
      ]);
      // Fora do lote pela nota não é eliminado nem recebe comunicado de eliminação.
      expect(q.fora_do_lote_por_nota).toBe(1);
      expect(q.historico.map((h) => h.papel).sort()).toEqual([
        "ADMIN_GLOBAL",
        "COORDENADOR",
        "EDITAL_GESTOR",
      ]);
      expect(q.historico[0]?.por).toMatch(/^Pessoa /);
    });
  });

  describe("fundamento da eliminação: o que se confere", () => {
    let db: Banco;
    beforeAll(async () => {
      db = await migrado();
      await entrar(db, "gestor");
    }, LONGO);

    it.each([
      [
        "versão da regra diferente da vigente",
        { motivo: "QUESTIONARIO", item: "6.4", versao: 2 },
        "40001",
        /mudou/,
      ],
      [
        "motivo fora da regra (SAIU_DA_EMPREGARE)",
        { motivo: "SAIU_DA_EMPREGARE", item: "6.4" },
        "22023",
        /não está na regra/,
      ],
      [
        "item fora do formato oficial",
        { motivo: "QUESTIONARIO", item: "item 6" },
        "22023",
        /item do edital/,
      ],
      [
        "fonte curta",
        { motivo: "QUESTIONARIO", item: "6.4", fonte: "edital" },
        "22023",
        /fonte/,
      ],
      [
        "item da nota mínima do lote (8.2.6) sem justificativa",
        { motivo: "QUESTIONARIO", item: "8.2.6" },
        "22023",
        /nota mínima do lote/,
      ],
    ] as const)("recusa %s", async (_, c, codigo, mensagem) => {
      const erro = await erroDe(
        conferir(db, c.motivo, c.item, {
          versao: "versao" in c ? c.versao : 1,
          fonte: "fonte" in c ? c.fonte : FONTE,
        }),
      );
      expect(erro?.codigo).toBe(codigo);
      expect(erro?.mensagem).toMatch(mensagem);
    });

    it("o item da nota só com justificativa expressa, registrada", async () => {
      const r = await conferir(db, "TERMO", "8.2.6", {
        justificativa:
          "O texto oficial agrupa o termo no subitem da nota mínima",
      });
      expect(r.fundamento?.item_edital).toBe("8.2.6");
    });

    it("retificar exige justificativa; a conferência anterior fica como estava", async () => {
      await conferir(db, "QUESTIONARIO", "6.4");
      expect((await conferir(db, "QUESTIONARIO", "6.4")).sem_mudanca).toBe(
        true,
      );
      const erro = await erroDe(conferir(db, "QUESTIONARIO", "6.5"));
      expect(erro?.mensagem).toMatch(/Para retificar, justifique/);
      const r = await conferir(db, "QUESTIONARIO", "6.5", {
        justificativa: JUSTIFICATIVA,
      });
      expect(r.fundamento?.item_edital).toBe("6.5");
      const linhas = await db.query<{
        item: string;
        justificativa: string | null;
      }>(
        `select "DS_ITEM_EDITAL" as item, "DS_JUSTIFICATIVA" as justificativa
         from public."TH_FUNDAMENTO_ELIMINACAO" where "CO_MOTIVO_ELIMINACAO" = 'QUESTIONARIO' order by "CO_HISTORICO"`,
      );
      expect(linhas.rows).toEqual([
        { item: "6.4", justificativa: null },
        { item: "6.5", justificativa: JUSTIFICATIVA },
      ]);
    });

    it("a conferência gravada não se altera nem se apaga", async () => {
      for (const sql of [
        `update public."TH_FUNDAMENTO_ELIMINACAO" set "DS_ITEM_EDITAL" = '1.1'`,
        `delete from public."TH_FUNDAMENTO_ELIMINACAO"`,
      ]) {
        const erro = await erroDe(db.query(sql));
        expect(erro?.codigo).toBe("42501");
      }
    });
  });

  describe("fundamento da eliminação: até o comunicado", () => {
    let db: Banco;
    let antes: string;
    beforeAll(async () => {
      db = await migrado();
      antes = await retratoDaTriagem(db);
      await entrar(db, "coordenador");
      await conferir(db, "QUESTIONARIO", "6.4");
    }, LONGO);

    it("só o motivo conferido leva fundamento; fora do lote pela nota e sem conferência, não", async () => {
      const lista = await comunicados(db);
      expect(porCodigo(lista, "9001")?.fundamento).toMatchObject({
        situacao: "CONFERIDO",
        item_edital: "6.4",
        versao_regra: 1,
      });
      expect(porCodigo(lista, "9002")?.fundamento).toBeNull(); // CANCELADO sem conferência
      expect(porCodigo(lista, "9004")).toMatchObject({
        situacao: "RANQUEADO",
        fundamento: null,
      });
      expect(porCodigo(lista, "9006")?.fundamento).toBeNull(); // fora da regra
      expect(await retratoDaTriagem(db)).toBe(antes);
    });

    it("regra nova com o mesmo motivo mantém o fundamento; motivo mudado pede reconferência", async () => {
      await novaVersaoDaRegra(db, 2, {
        ...REGRA,
        lote: { ...REGRA.lote, multiplo: 4 },
      });
      expect(
        porCodigo(await comunicados(db), "9001")?.fundamento?.item_edital,
      ).toBe("6.4");

      const mudada = structuredClone(REGRA);
      const questionario = mudada.requisitos.eliminacao_automatica.find(
        (e) => e.codigo === "QUESTIONARIO",
      );
      if (questionario) questionario.motivo = "Não concluiu o questionário";
      await novaVersaoDaRegra(db, 3, mudada);
      expect(porCodigo(await comunicados(db), "9001")?.fundamento).toBeNull();
      const q = await quadro(db);
      expect(
        q.motivos.find((m) => m.codigo === "QUESTIONARIO")?.fundamento
          ?.situacao,
      ).toBe("RECONFERIR");

      // Reconfere na versão 3: mesmo item, sem justificativa (não é retificação).
      expect(
        (await conferir(db, "QUESTIONARIO", "6.4", { versao: 3 })).fundamento
          ?.situacao,
      ).toBe("CONFERIDO");

      // Regra a conferir: ninguém confere e o comunicado não traz fundamento.
      await novaVersaoDaRegra(db, 4, mudada, "CONFERIR");
      expect(porCodigo(await comunicados(db), "9001")?.fundamento).toBeNull();
      expect(
        (await erroDe(conferir(db, "CANCELADO", "6.4", { versao: 4 })))
          ?.mensagem,
      ).toMatch(/Confira a regra da Triagem/);
      expect(await retratoDaTriagem(db)).toBe(antes);
    });
  });
});

bloco("lib/http-security-headers", () => {
  interface HeaderRule {
    source: string;
    headers?: { key: string; value: string }[];
  }

  interface VercelConfig {
    headers?: HeaderRule[];
  }

  function loadConfig(): VercelConfig {
    const configPath = resolve(process.cwd(), "vercel.json");
    return JSON.parse(readFileSync(configPath, "utf8"));
  }

  function headersForSource(config: VercelConfig, source: string) {
    const rule = config.headers?.find((item) => item.source === source);
    return new Map(
      (rule?.headers || []).map((header) => [header.key, header.value]),
    );
  }

  function effectiveHeaders(config: VercelConfig, pathname: string) {
    return new Map([
      ...headersForSource(config, "/(.*)"),
      ...headersForSource(config, pathname),
    ]);
  }

  describe("cabeçalhos HTTP de segurança", () => {
    it("mantém a linha de base institucional", () => {
      const config = loadConfig();
      const headers = headersForSource(config, "/(.*)");

      expect(headers.get("Strict-Transport-Security")).toMatch(
        /max-age=31536000/,
      );
      expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
      expect(headers.get("X-Permitted-Cross-Domain-Policies")).toBe("none");
      expect(headers.get("X-XSS-Protection")).toBe("0");
    });

    /*
    Proteção contra clickjacking (verificação de segurança de 21/10/2026): só
    a própria origem embute o MONITORA (o painel em iframe é da mesma origem).
    O X-Frame-Options e o frame-ancestors da CSP (aplicada desde 16/11/2026)
    dizem o mesmo; navegador antigo lê o primeiro.
  */
    it("não deixa outro site embutir o Yeendé em moldura", () => {
      const config = loadConfig();
      const headers = headersForSource(config, "/(.*)");

      expect(headers.get("X-Frame-Options")).toBe("SAMEORIGIN");
      expect(headers.get("Content-Security-Policy")).toContain(
        "frame-ancestors 'self'",
      );
      expect(
        effectiveHeaders(config, "/auth/callback").get("X-Frame-Options"),
      ).toBe("SAMEORIGIN");
    });

    /*
    Revisão de segurança de 16/11/2026: a CSP passou de Report-Only a
    aplicada. Em um mês de relatórios (TL_EVENTO_ACESSO,
    `csp_report_only_violation`) a produção não teve violação; a única, em
    localhost, era `fetch` de `blob:` — por isso `blob:` entra em connect-src
    e em frame-src (PDF gerado no navegador mostrado em quadro).
  */
    it("aplica a CSP e não a deixa só em relatório", () => {
      const config = loadConfig();
      const headers = headersForSource(config, "/(.*)");
      const csp = headers.get("Content-Security-Policy") || "";
      const diretiva = (nome: string) =>
        csp
          .split(";")
          .map((parte) => parte.trim())
          .find((parte) => parte.startsWith(`${nome} `)) || "";

      expect(headers.has("Content-Security-Policy-Report-Only")).toBe(false);
      expect(diretiva("object-src")).toBe("object-src 'none'");
      expect(diretiva("base-uri")).toBe("base-uri 'self'");
      expect(diretiva("form-action")).toBe("form-action 'self'");
      expect(diretiva("connect-src")).toContain("blob:");
      expect(diretiva("frame-src")).toContain("blob:");
      // Script só da própria origem, do Google Analytics e do cdnjs (Leaflet com SRI).
      expect(diretiva("script-src")).toBe(
        "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://cdnjs.cloudflare.com",
      );
      expect(diretiva("script-src")).not.toContain("unsafe-eval");
    });

    it("desabilita recursos de navegador não utilizados", () => {
      const config = loadConfig();
      const permissions =
        headersForSource(config, "/(.*)").get("Permissions-Policy") || "";

      for (const directive of [
        "camera=()",
        "microphone=()",
        "geolocation=()",
        "payment=()",
        "usb=()",
        "browsing-topics=()",
      ]) {
        expect(permissions).toContain(directive);
      }
    });

    it("impede cache do callback OAuth sem perder os cabeçalhos globais", () => {
      const config = loadConfig();
      const headers = effectiveHeaders(config, "/auth/callback");

      expect(headers.get("Cache-Control")).toContain("no-store");
      expect(headers.get("Pragma")).toBe("no-cache");
      expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
      expect(headers.get("Referrer-Policy")).toBe(
        "strict-origin-when-cross-origin",
      );
    });
  });
});

bloco("links-da-biblioteca", () => {
  /*
  A biblioteca de documentação (docs/biblioteca/, índice no CLAUDE.md da raiz): todo
  [[link]] aponta para uma nota que existe e toda nota é ligada por outro arquivo.
  O script é scripts/checar-links-da-biblioteca.mjs (npm run check:docs).
*/

  const CABECALHO =
    "---\ntipo: guia\narea: front\natualizado: 2026-11-10\n---\n\n";

  function nota(corpo: string): string {
    return `${CABECALHO}${corpo}\n`;
  }

  describe("extrairLinks", () => {
    it("lê o nome do link, com texto alternativo ou seção", () => {
      expect(
        extrairLinks(
          "Ver [[testes]], [[banco-e-migrations|o banco]] e [[css#Onde colocar]].",
        ),
      ).toEqual(["testes", "banco-e-migrations", "css"]);
    });

    it("não conta link dentro de crase nem de bloco de código", () => {
      const texto = [
        "Cada `[[nome]]` é uma nota.",
        "```",
        "[[exemplo-em-bloco]]",
        "```",
        "Mas [[de-verdade]] conta.",
      ].join("\n");
      expect(extrairLinks(texto)).toEqual(["de-verdade"]);
    });
  });

  describe("lerCabecalho", () => {
    it("lê tipo, area e atualizado", () => {
      expect(lerCabecalho(nota("# Título"))).toEqual({
        tipo: "guia",
        area: "front",
        atualizado: "2026-11-10",
      });
    });

    it("devolve null sem cabeçalho", () => {
      expect(lerCabecalho("# Título\n")).toBeNull();
    });
  });

  describe("conferirBiblioteca", () => {
    const indice = new Map([["CLAUDE.md", "Índice: [[a]] e [[b]]."]]);

    it("passa quando todo link tem nota e toda nota é ligada", () => {
      const notas = new Map([
        ["a", nota("Ver [[b]].")],
        ["b", nota("Ver [[a]].")],
      ]);
      expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([]);
    });

    it("acusa link quebrado, dizendo o arquivo e o destino", () => {
      const notas = new Map([
        ["a", nota("Ver [[nao-existe]].")],
        ["b", nota("")],
      ]);
      expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([
        "docs/biblioteca/a.md: [[nao-existe]] não tem nota em docs/biblioteca/nao-existe.md",
      ]);
    });

    it("acusa link quebrado também num CLAUDE.md de pasta", () => {
      const notas = new Map([
        ["a", nota("")],
        ["b", nota("")],
      ]);
      const fontes = new Map([
        ...indice,
        ["src/lib/CLAUDE.md", "Ver [[logica-que-sumiu]]."],
      ]);
      expect(conferirBiblioteca({ notas, fontes })).toEqual([
        "src/lib/CLAUDE.md: [[logica-que-sumiu]] não tem nota em docs/biblioteca/logica-que-sumiu.md",
      ]);
    });

    it("acusa nota órfã; o link dela para ela mesma não conta", () => {
      const notas = new Map([
        ["a", nota("")],
        ["b", nota("")],
        ["solta", nota("Esta é [[solta]].")],
      ]);
      expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([
        "docs/biblioteca/solta.md: nota órfã (nenhum CLAUDE.md nem outra nota liga para ela)",
      ]);
    });

    it("acusa nota com o nome de outro .md do vault", () => {
      const notas = new Map([
        ["a", nota("")],
        ["b", nota("")],
      ]);
      const outrosNomes = new Map([["b", "docs/b.md"]]);
      expect(
        conferirBiblioteca({ notas, fontes: indice, outrosNomes }),
      ).toEqual([
        "docs/biblioteca/b.md: mesmo nome de docs/b.md (o [[link]] fica ambíguo no Obsidian)",
      ]);
    });

    it("acusa cabeçalho ausente ou com valor fora da lista", () => {
      const notas = new Map([
        ["a", "# Sem cabeçalho\n"],
        ["b", "---\ntipo: rascunho\narea: front\natualizado: ontem\n---\n"],
      ]);
      expect(conferirBiblioteca({ notas, fontes: indice })).toEqual([
        "docs/biblioteca/a.md: sem cabeçalho YAML (tipo, area, atualizado)",
        'docs/biblioteca/b.md: tipo "rascunho" fora de regra, guia, modulo, decisao, referencia',
        'docs/biblioteca/b.md: atualizado "ontem" não é AAAA-MM-DD',
      ]);
    });
  });

  describe("a biblioteca deste repositório", () => {
    it("não tem link quebrado, nota órfã nem nome repetido", () => {
      const entrada = lerRepositorio(process.cwd());
      expect(entrada.notas.size).toBeGreaterThan(0);
      expect(entrada.fontes.has("CLAUDE.md")).toBe(true);
      expect(conferirBiblioteca(entrada)).toEqual([]);
    });
  });
});

bloco("molde-de-banco", () => {
  async function contagem(db: PGlite): Promise<number> {
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from t",
    );
    return rows[0]?.n ?? -1;
  }

  function bancoComTabela() {
    return vi.fn(async () => {
      const db = await PGlite.create();
      await db.exec("create table t (x int)");
      return db;
    });
  }

  describe("moldeDeBanco", () => {
    it("monta o banco uma vez só", async () => {
      const montar = bancoComTabela();
      const banco = moldeDeBanco(montar);
      await banco();
      await banco();
      expect(montar).toHaveBeenCalledTimes(1);
    });

    it("cada chamada é um banco independente", async () => {
      const banco = moldeDeBanco(bancoComTabela());
      const a = await banco();
      const b = await banco();
      await a.exec("insert into t values (1)");
      expect(await contagem(a)).toBe(1);
      expect(await contagem(b)).toBe(0);
    });

    it("o molde não é alterado pelos clones", async () => {
      const banco = moldeDeBanco(bancoComTabela());
      const a = await banco();
      await a.exec("insert into t values (1)");
      expect(await contagem(await banco())).toBe(0);
    });
  });
});

bloco("paleta-do-rio", () => {
  /*
  A PALETA DO RIO (a arte da tela de acesso), de apoio às cores do manual.

  Floresta, folha, rio, terracota e ocre pintam texto e ícone: nos selos, no
  tile dos indicadores e no título da área. Cada uma, sobre o próprio
  `-suave` e sobre o card, passa de 4,5:1 nos dois temas (regra de ouro 6,
  docs/biblioteca/design-e-tokens.md). O cálculo é sobre os valores de
  `tokens.css`, não sobre uma cópia: mudar um hex lá refaz a conta aqui.
*/

  const RAIZ = path.resolve(import.meta.dirname, "..");
  const tokens = fs.readFileSync(
    path.join(RAIZ, "src/styles/tokens.css"),
    "utf8",
  );
  const ui = fs.readFileSync(path.join(RAIZ, "src/ui/ui.css"), "utf8");
  const app = fs.readFileSync(path.join(RAIZ, "src/styles/app.css"), "utf8");

  /* As declarações `--nome: valor;` de um bloco (o primeiro que abre com `inicio`). */
  function bloco(inicio: string): Map<string, string> {
    const comeco = tokens.indexOf(inicio);
    expect(comeco, inicio).toBeGreaterThan(-1);
    const corpo = tokens.slice(comeco, tokens.indexOf("\n}", comeco));
    const pares = new Map<string, string>();
    for (const [, nome = "", valor = ""] of corpo.matchAll(
      /(--[\w-]+):\s*([^;]+);/g,
    ))
      pares.set(nome, valor.trim());
    return pares;
  }

  const claro = bloco(":root {");
  const escuro = bloco('html[data-theme="dark"] {');

  /* O hex de um token no tema, seguindo `var(--outro)` (no escuro, cai no claro). */
  function hex(nome: string, tema: Map<string, string>): string {
    const valor = tema.get(nome) ?? claro.get(nome) ?? "";
    expect(valor, nome).not.toBe("");
    const apelido = /^var\((--[\w-]+)\)$/.exec(valor)?.[1];
    if (apelido) return hex(apelido, tema);
    expect(valor, nome).toMatch(/^#[0-9a-f]{6}$/i);
    return valor;
  }

  function luminancia(cor: string): number {
    const canal = (i: number) => {
      const c = Number.parseInt(cor.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * canal(1) + 0.7152 * canal(3) + 0.0722 * canal(5);
  }

  function contraste(a: string, b: string): number {
    const [la, lb] = [luminancia(a), luminancia(b)];
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  }

  const CORES = ["floresta", "folha", "rio", "terracota", "ocre"];

  describe("paleta do rio: contraste", () => {
    for (const [nomeDoTema, tema, card] of [
      ["claro", claro, "#ffffff"],
      ["escuro", escuro, hex("--color-bg-canvas", escuro)],
    ] as const) {
      for (const cor of CORES) {
        it(`${cor} no tema ${nomeDoTema}: texto sobre o suave e sobre o card`, () => {
          const texto = hex(`--paleta-${cor}`, tema);
          expect(
            contraste(texto, hex(`--paleta-${cor}-suave`, tema)),
          ).toBeGreaterThanOrEqual(4.5);
          expect(contraste(texto, card)).toBeGreaterThanOrEqual(4.5);
        });
      }
    }

    it("os tons claros servem à barra lateral escura (a padrão do manual)", () => {
      const barra = hex("--color-blue-950", claro);
      for (const cor of ["floresta", "ocre", "terracota"]) {
        expect(
          contraste(hex(`--paleta-${cor}-claro`, claro), barra),
        ).toBeGreaterThanOrEqual(3);
      }
    });
  });

  describe("paleta do rio: onde entra", () => {
    it("cada área tem a sua cor", () => {
      expect(tokens).toMatch(
        /html\[data-area="saude-indigena"\] \{\s*--cor-da-area: var\(--paleta-floresta\)/,
      );
      expect(tokens).toMatch(
        /html\[data-area="sede"\] \{\s*--cor-da-area: var\(--paleta-ocre\)/,
      );
      expect(tokens).toMatch(
        /html\[data-area="projetos"\] \{\s*--cor-da-area: var\(--paleta-terracota\)/,
      );
    });

    it("a bolinha do seletor de área usa os tons vivos da paleta", () => {
      const barra = fs.readFileSync(
        path.join(RAIZ, "src/styles/barra-lateral.css"),
        "utf8",
      );
      for (const [area, cor] of [
        ["saude-indigena", "floresta-claro"],
        ["sede", "ocre-vivo"],
        ["projetos", "terracota-claro"],
      ]) {
        expect(barra).toContain(
          `[data-cor-da-area="${area}"] {
  --cor-da-area: var(--paleta-${cor});`,
        );
      }
    });

    it("o título da página segue a área, com o padrão de antes fora dela", () => {
      // O título da casca é do cabeçalho (src/app/casca/topo.css), sem !important.
      const topo = readFileSync("src/app/casca/topo.css", "utf8");
      expect(topo).toContain("color: var(--cor-da-area, var(--text-primary));");
      expect(topo).toContain(
        "color: var(--cor-da-area, var(--color-text-brand));",
      );
    });

    it("selos e indicadores usam a paleta, não o estado genérico", () => {
      for (const [tom, cor] of [
        ["sucesso", "folha"],
        ["perigo", "terracota"],
        ["alerta", "ocre"],
        ["info", "rio"],
      ]) {
        expect(ui).toContain(
          `.ui-selo[data-tom="${tom}"] {\n  background: var(--paleta-${cor}-suave);\n  color: var(--paleta-${cor});`,
        );
      }
      expect(ui).toContain(
        '.ui-kpi[data-tom="destaque"] {\n  --kpi-cor: var(--paleta-floresta);',
      );
      expect(ui).toContain("box-shadow: inset 0 3px 0 var(--kpi-cor);");
    });

    it("o ocre vivo é só preenchimento: nunca vira texto", () => {
      const usos = [ui, app].flatMap((css) =>
        [...css.matchAll(/^\s*color:[^;]*--paleta-ocre-vivo/gm)].map(
          (m) => m[0],
        ),
      );
      expect(usos).toEqual([]);
    });
  });
});

bloco("scripts/check-lib-sem-arquivo-solto", () => {
  /*
  src/lib/ é organizada por assunto (docs/biblioteca/mapa-do-repositorio.md):
  arquivo de lógica vai para a pasta do assunto, nunca solto na raiz, e
  nenhuma pasta passa de 30 arquivos diretos (passou, ganha subpasta).
*/

  const pasta = (caminho: string, quantos: number) =>
    Array.from({ length: quantos }, (_, i) => `${caminho}/arquivo-${i}.ts`);

  describe("conferirLib", () => {
    it("na raiz só podem ficar o CLAUDE.md e o contrato de RPC", () => {
      expect(SOLTOS_PERMITIDOS).toEqual(["CLAUDE.md", "rpc-contrato.ts"]);
      expect(LIMITE_POR_PASTA).toBe(30);
    });

    it("aceita a raiz com os permitidos e arquivos dentro de pastas", () => {
      expect(
        conferirLib([
          "src/lib/CLAUDE.md",
          "src/lib/rpc-contrato.ts",
          "src/lib/aya/busca-da-aya.ts",
        ]),
      ).toEqual([]);
    });

    it("acusa arquivo solto na raiz", () => {
      expect(
        conferirLib(["src/lib/rpc-contrato.ts", "src/lib/formatters.ts"]),
      ).toEqual([
        "src/lib/formatters.ts está solto em src/lib/: coloque na pasta do assunto",
      ]);
    });

    it("acusa pasta com mais de 30 arquivos diretos", () => {
      const problemas = conferirLib(pasta("src/lib/aya", 31));
      expect(problemas).toHaveLength(1);
      expect(problemas[0]).toContain("src/lib/aya/");
      expect(problemas[0]).toContain("31");
    });

    it("conta só os arquivos diretos: subpasta não soma na pasta de cima", () => {
      expect(
        conferirLib([
          ...pasta("src/lib/aya", 30),
          ...pasta("src/lib/aya/tours", 5),
        ]),
      ).toEqual([]);
    });

    it("pasta que já passava do limite antes da organização só pode encolher", () => {
      const [registrada = "", tamanho = 0] =
        Object.entries(ACIMA_DO_LIMITE)[0] ?? [];
      expect(registrada).toBe("src/lib/avaliacao-documental/");
      expect(tamanho).toBeGreaterThan(LIMITE_POR_PASTA);
      expect(conferirLib(pasta(registrada.slice(0, -1), tamanho))).toEqual([]);
      expect(conferirLib(pasta(registrada.slice(0, -1), tamanho - 1))).toEqual(
        [],
      );
      const cresceu = conferirLib(pasta(registrada.slice(0, -1), tamanho + 1));
      expect(cresceu).toHaveLength(1);
      expect(cresceu[0]).toContain(`${tamanho + 1}`);
    });

    /*
    O check:architecture não roda no CI; esta suíte roda. Assim um PR com
    arquivo solto em src/lib/ quebra no CI, não só quando alguém lembra de
    rodar a checagem à mão.
  */
    it("o repositório de verdade: nada solto em src/lib/ e nenhuma pasta acima do limite", () => {
      const arquivos = execFileSync("git", ["ls-files", "-z", "src/lib"], {
        encoding: "utf8",
      })
        .split("\0")
        .filter(Boolean);
      expect(arquivos.length).toBeGreaterThan(0);
      expect(conferirLib(arquivos)).toEqual([]);
    });

    it("ignora o que não está em src/lib/", () => {
      expect(
        conferirLib(["src/modulos/solto.ts", "tests/solto.test.ts"]),
      ).toEqual([]);
    });
  });
});

bloco("tipografia-das-telas", () => {
  /*
  Tipografia das telas React (regras de ouro 7, docs/biblioteca/design-e-tokens.md; Design System AgSUS
  4.1 e 4.3): pesos só até 600, nada abaixo de 12px e sentence case — sem
  `text-transform: uppercase` em rótulos, títulos e botões.

  Por que existe: o pente fino de 10/11/2026 achou rótulos de 9 e 10px na
  Convocação, pesos 700–900 em Conferências, AYA e no seletor múltiplo, e
  sobretítulos em caixa alta na Avaliação documental, Configurações, Mapa da
  Saúde Indígena e no modal institucional — além do título dos grupos da
  barra lateral, que o Design System pede em sentence case.

  Vale para o CSS de `src/modulos/` e `src/ui/`, para o CSS dos componentes
  React que ainda mora em `src/styles/` e para o CSS da casca, que pinta todas
  as telas: cabeçalho, entrada, carregamento, rótulos, chips e cabeçalhos de
  tabela (`app.css`, `platform-shell.css`, `loading-experience.css`,
  `nielsen-shell-ux.css`, `comemoracao.css`). Na segunda passada do pente fino
  (10/11/2026) esses arquivos ainda tinham pesos de 700 a 1000, textos de 8 a
  11px e caixa alta no perfil do cabeçalho, nos rótulos e nas tabelas; e o
  negrito (`<b>`/`<strong>`) herdava `bolder`, que sobe 600 para 900.
*/

  const RAIZ = path.resolve(import.meta.dirname, "..");
  const PASTAS = ["src/modulos", "src/ui"];
  const ARQUIVOS_DE_COMPONENTES = [
    "src/styles/app.css",
    "src/styles/barra-lateral.css",
    "src/styles/comemoracao.css",
    "src/styles/indigenous-territories-layer.css",
    "src/styles/loading-experience.css",
    "src/styles/mobile-table-cards.css",
    "src/styles/multi-select-busca.css",
    "src/styles/nielsen-shell-ux.css",
    "src/styles/platform-shell.css",
    "src/styles/saude-das-cargas.css",
  ];

  /*
  Exceções, por "arquivo seletor": o tamanho é de um ícone (não de texto) ou
  o texto é uma sigla digitada. Rótulo de mapa não é exceção: o de 11px do
  "Mapa DSEIs" e o das Terras Indígenas subiram para 12px (11/11/2026).
*/
  const EXCECOES = new Set([
    // A sigla da cota digitada no campo (PCD, PPI), não um rótulo.
    "src/modulos/aprovados/convocacao.css .convocacao-categoria-sigla",
    // Ícone de "conferido" num círculo de 20px.
    "src/modulos/entrevistas/entrevistas.css .entrevistas-aba-da-ficha-check",
    // Seta do botão do seletor múltiplo (ícone).
    "src/styles/multi-select-busca.css .multi-select-trigger .fa-chevron-down",
  ]);

  function cssDe(pasta: string): string[] {
    return fs
      .readdirSync(path.join(RAIZ, pasta), { withFileTypes: true })
      .flatMap((item) => {
        const relativo = `${pasta}/${item.name}`;
        if (item.isDirectory()) return cssDe(relativo);
        return item.name.endsWith(".css") ? [relativo] : [];
      });
  }

  interface Regra {
    arquivo: string;
    seletor: string;
    corpo: string;
  }

  function regras(arquivo: string): Regra[] {
    const texto = fs
      .readFileSync(path.join(RAIZ, arquivo), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, " ");
    const achadas: Regra[] = [];
    for (const [, seletor = "", corpo = ""] of texto.matchAll(
      /([^{}]+)\{([^{}]*)\}/g,
    )) {
      achadas.push({
        arquivo,
        seletor: seletor.replace(/\s+/g, " ").trim(),
        corpo,
      });
    }
    return achadas;
  }

  const TODAS = [...PASTAS.flatMap((p) => cssDe(p)), ...ARQUIVOS_DE_COMPONENTES]
    .flatMap(regras)
    .filter((r) => !EXCECOES.has(`${r.arquivo} ${r.seletor}`));

  function ondeAparece(teste: (corpo: string) => boolean): string[] {
    return TODAS.filter((r) => teste(r.corpo)).map(
      (r) => `${r.arquivo} ${r.seletor}`,
    );
  }

  describe("tipografia das telas", () => {
    it("dá ao negrito um peso fixo, sem o `bolder` do navegador", () => {
      const base = regras("src/styles/app.css").find((r) =>
        /^b, ?strong$/.test(r.seletor),
      );
      expect(base?.corpo).toMatch(/font-weight:\s*600/);
    });

    it("não usa peso acima de 600", () => {
      expect(
        ondeAparece((c) => /font-weight:\s*(bold|bolder|[7-9]\d\d)\b/.test(c)),
      ).toEqual([]);
    });

    it("não usa texto abaixo de 12px", () => {
      expect(
        ondeAparece((c) => {
          const px = /font-size:\s*(\d+(?:\.\d+)?)px/.exec(c);
          if (px && Number(px[1]) < 12) return true;
          const rem = /font-size:\s*(\d*\.?\d+)rem/.exec(c);
          return Boolean(rem && Number(rem[1]) < 0.75);
        }),
      ).toEqual([]);
    });

    it("escreve rótulos e títulos em sentence case, sem caixa alta", () => {
      expect(ondeAparece((c) => /text-transform:\s*uppercase/.test(c))).toEqual(
        [],
      );
    });
  });
});

bloco("tokens-do-acabamento", () => {
  describe("tokens usados pelo acabamento", () => {
    const nomes = [
      "--z-dropdown",
      "--z-modal",
      "--z-tooltip",
      ...["sm", "md", "lg", "xl", "full"].map((t) => `--radius-${t}`),
      ...["sm", "md", "lg"].map((t) => `--shadow-${t}`),
      ...["fast", "base", "slow"].map((t) => `--duration-${t}`),
      ...["standard", "exit"].map((t) => `--ease-${t}`),
    ];

    it.each(nomes)("%s está definido uma vez só no :root", (nome) => {
      const vezes = definicoes.filter(([n]) => n === nome).length;
      expect(vezes).toBe(1);
    });
  });

  describe("ordem das camadas", () => {
    it("cresce estritamente de sticky até tooltip", () => {
      const ordem = [
        "--z-sticky",
        "--z-header",
        "--z-sidebar",
        "--z-popover",
        "--z-overlay",
        "--z-loader",
        "--z-toast",
        "--z-tooltip",
      ];
      const numeros = ordem.map((n) => resolver(valorDe(n)));
      for (let i = 1; i < numeros.length; i += 1) {
        expect(
          numeros[i],
          `${ordem[i]} acima de ${ordem[i - 1]}`,
        ).toBeGreaterThan(numeros[i - 1] as number);
      }
    });

    it("dropdown vale o popover e modal vale o overlay", () => {
      expect(resolver(valorDe("--z-dropdown"))).toBe(
        resolver(valorDe("--z-popover")),
      );
      expect(resolver(valorDe("--z-modal"))).toBe(
        resolver(valorDe("--z-overlay")),
      );
    });
  });
});

bloco("registro-de-erros-no-banco", () => {
  /*
    A migration 20261123150000 (registro dos erros do navegador, aplicada em
    23/11/2026: o arquivo, do jeito que entrou no banco, está em
    tests/fixtures/sql-do-banco/; o rollback e o ensaio saíram com ela) num
    Postgres de verdade (PGlite).
    Imitações: os papéis, a sessão (auth.uid() lê teste.uid ou, como o
    Supabase, request.jwt.claims), o administrador global
    (FC_ADMIN_GLOBAL_ATIVO lê teste.admin) e as áreas. Dados fictícios.
  */
  const ler = (caminho: string) =>
    readFileSync(caminho, "utf8").replace(/\r\n/g, "\n");
  const NOME = "20261123150000_registro_de_erros_da_aplicacao.sql";
  const MIGRATION = ler(`tests/fixtures/sql-do-banco/${NOME}`);

  const PESSOA = "11111111-1111-4111-8111-111111111111";
  const ADMIN = "22222222-2222-4222-8222-222222222222";

  const INFRAESTRUTURA = `
create role anon;
create role authenticated;
create role service_role;
create schema private;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('teste.uid', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid
$$;
create function private."FC_ADMIN_GLOBAL_ATIVO"(p_usuario uuid) returns boolean
language sql stable as $$
  select p_usuario is not null and p_usuario::text = coalesce(current_setting('teste.admin', true), '')
$$;
create table public."TB_AREA" ("CO_AREA" text primary key);
insert into public."TB_AREA" values ('saude-indigena'), ('sede'), ('projetos');
`;

  const bancoAntes = moldeDeBanco(async () => {
    const db = await PGlite.create();
    await db.exec(INFRAESTRUTURA);
    return db;
  });
  const bancoMigrado = moldeDeBanco(async () => {
    const db = await PGlite.create();
    await db.exec(INFRAESTRUTURA);
    await db.exec(MIGRATION);
    return db;
  });

  async function como(db: PGlite, uid: string | null, admin = "") {
    await db.query(
      `select set_config('teste.uid', $1, false), set_config('teste.admin', $2, false)`,
      [uid ?? "", admin],
    );
  }

  type Resposta = {
    registrado: boolean;
    motivo?: string;
    referencia?: string;
  };
  type Pedido = {
    referencia?: string;
    tipo?: string;
    mensagem?: string;
    rota?: string | null;
    contexto?: unknown;
    versao?: string | null;
    area?: string | null;
    status?: number | null;
  };
  async function registrar(db: PGlite, p: Pedido = {}): Promise<Resposta> {
    const { rows } = await db.query<{ r: Resposta }>(
      `select public.registrar_erro_da_aplicacao($1, $2, $3, $4, $5::jsonb, $6, $7, $8) as r`,
      [
        p.referencia ?? "3f2a9c1b-0000-4000-8000-000000000001",
        p.tipo ?? "CLIENTE",
        p.mensagem ?? "Cannot read properties of undefined",
        p.rota === undefined ? "/sede/editais" : p.rota,
        JSON.stringify(p.contexto ?? {}),
        p.versao === undefined ? "abc123" : p.versao,
        p.area === undefined ? "sede" : p.area,
        p.status === undefined ? null : p.status,
      ],
    );
    const r = rows[0]?.r;
    if (!r) throw new Error("sem resposta");
    return r;
  }
  async function codigoDoErro(promessa: Promise<unknown>): Promise<string> {
    try {
      await promessa;
    } catch (erro) {
      return String((erro as { code?: unknown }).code ?? "");
    }
    return "sem erro";
  }
  const linhas = async (db: PGlite) =>
    (
      await db.query<Record<string, unknown>>(
        `select "CO_REFERENCIA", "TP_ERRO", "DS_MENSAGEM", "DS_ROTA", "DS_CONTEXTO",
                "CO_VERSAO_BUILD", "CO_AREA", "NU_STATUS_HTTP", "CO_USUARIO"
           from public."TL_ERRO_APLICACAO" order by "DT_REGISTRO", "CO_REFERENCIA"`,
      )
    ).rows;

  beforeAll(() => Promise.all([bancoAntes(), bancoMigrado()]), 60_000);

  describe("a limpeza do banco é a do navegador", () => {
    const CASOS: Array<[string, number]> = [
      ["Falhou para maria.souza@exemplo.org.br agora", 500],
      ["CPF 123.456.789-09 e 12345678909 na mensagem", 500],
      ["Authorization: Bearer abc.DEF-123_x~y+z/w= ok", 500],
      ["bearer   tok", 500],
      ["token eyJhbGciOi.eyJzdWIiOiIx.c2lnbmF0dXJh fim", 500],
      ["ligue (61) 99999-1234 ou 61 3333-4444", 500],
      ["edital 01/2026 cargo 1234 código 98765", 500],
      ["linha\u0001com\u0007controle\nE quebra de linha", 500],
      ["   espaços nas pontas   ", 500],
      ["id a0000000-0000-0000-0000-0000000000a1", 500],
      ["ação com acentuação e emoji 🙂 no meio do texto", 20],
      ["x".repeat(600), 500],
    ];

    it("cada caso sai igual no SQL e no TypeScript", async () => {
      const db = await bancoMigrado();
      for (const [texto, limite] of CASOS) {
        const { rows } = await db.query<{ t: string }>(
          `select private."FC_LIMPAR_TEXTO_ERRO"($1, $2) as t`,
          [texto, limite],
        );
        expect(rows[0]?.t, texto).toBe(limparTextoDoErro(texto, limite));
      }
    });

    it("não sobra e-mail, CPF, telefone, token nem número longo", async () => {
      const db = await bancoMigrado();
      const { rows } = await db.query<{ t: string }>(
        `select private."FC_LIMPAR_TEXTO_ERRO"($1, 500) as t`,
        [
          "pessoa@exemplo.org 123.456.789-09 (61) 99999-1234 Bearer segredo eyJa.eyJb 1234567",
        ],
      );
      expect(rows[0]?.t).toBe(
        "[e-mail] [número] [número] Bearer [token] [token] [número]",
      );
    });
  });

  describe("registrar_erro_da_aplicacao", () => {
    it("grava limpo: mensagem, rota sem consulta, contexto filtrado; o id, nunca o e-mail", async () => {
      const db = await bancoMigrado();
      await como(db, PESSOA);
      const r = await registrar(db, {
        referencia: "3F2A9C1B-AAAA-4000-8000-000000000001",
        tipo: "banco",
        mensagem: "Erro de maria@exemplo.org com CPF 123.456.789-09",
        rota: "/sede/aprovados?busca=Maria+Souza#linha-3",
        contexto: {
          origem: "promessa",
          linha: 12,
          online: true,
          pilha: "at f (Bearer abc.def) 98765",
          cpf: 12345678909,
          "Chave-Ruim": "x",
          objeto: { a: 1 },
        },
        status: 503,
      });
      expect(r).toEqual({
        registrado: true,
        referencia: "3f2a9c1b-aaaa-4000-8000-000000000001",
      });
      expect(await linhas(db)).toEqual([
        {
          CO_REFERENCIA: "3f2a9c1b-aaaa-4000-8000-000000000001",
          TP_ERRO: "BANCO",
          DS_MENSAGEM: "Erro de [e-mail] com CPF [número]",
          DS_ROTA: "/sede/aprovados",
          DS_CONTEXTO: {
            origem: "promessa",
            linha: 12,
            online: true,
            pilha: "at f (Bearer [token]) [número]",
          },
          CO_VERSAO_BUILD: "abc123",
          CO_AREA: "sede",
          NU_STATUS_HTTP: 503,
          CO_USUARIO: PESSOA,
        },
      ]);
    });

    it("tipo, versão, área e status fora do domínio viram DESCONHECIDO ou nulo; tamanhos cortados", async () => {
      const db = await bancoMigrado();
      await como(db, PESSOA);
      await registrar(db, {
        tipo: "OUTRO",
        mensagem: "m".repeat(900),
        rota: `/${"r".repeat(400)}`,
        versao: "versão com espaço",
        area: "inexistente",
        status: 42,
      });
      const [linha] = await linhas(db);
      expect(linha?.TP_ERRO).toBe("DESCONHECIDO");
      expect(String(linha?.DS_MENSAGEM)).toHaveLength(500);
      expect(String(linha?.DS_ROTA)).toHaveLength(200);
      expect(linha?.CO_VERSAO_BUILD).toBeNull();
      expect(linha?.CO_AREA).toBeNull();
      expect(linha?.NU_STATUS_HTTP).toBeNull();
    });

    it("sem sessão recusa (28000); referência fora do padrão recusa (22023)", async () => {
      const db = await bancoMigrado();
      await como(db, null);
      expect(await codigoDoErro(registrar(db))).toBe("28000");
      await como(db, PESSOA);
      expect(
        await codigoDoErro(registrar(db, { referencia: "<script>" })),
      ).toBe("22023");
      expect(await linhas(db)).toEqual([]);
    });

    it("o mesmo erro da mesma pessoa em 30 s não grava de novo e devolve a referência do primeiro", async () => {
      const db = await bancoMigrado();
      await como(db, PESSOA);
      await registrar(db, { referencia: "aaaaaaaa-0001" });
      expect(await registrar(db, { referencia: "aaaaaaaa-0002" })).toEqual({
        registrado: false,
        motivo: "repetido",
        referencia: "aaaaaaaa-0001",
      });
      // Outra mensagem, ou outra pessoa, grava.
      expect(
        (
          await registrar(db, {
            referencia: "aaaaaaaa-0003",
            mensagem: "outro",
          })
        ).registrado,
      ).toBe(true);
      await como(db, ADMIN);
      expect(
        (await registrar(db, { referencia: "aaaaaaaa-0004" })).registrado,
      ).toBe(true);
      expect(await linhas(db)).toHaveLength(3);
    });

    it("passa a ignorar depois de 30 registros da pessoa no último minuto, sem erro", async () => {
      const db = await bancoMigrado();
      await como(db, PESSOA);
      for (let i = 0; i < 30; i += 1)
        expect(
          (
            await registrar(db, {
              referencia: `bbbbbbbb-${String(i).padStart(4, "0")}`,
              mensagem: `erro ${String.fromCharCode(97 + (i % 26))}${i}`,
            })
          ).registrado,
        ).toBe(true);
      expect(
        await registrar(db, {
          referencia: "bbbbbbbb-9999",
          mensagem: "mais um",
        }),
      ).toEqual({ registrado: false, motivo: "limite" });
      // A conta é por pessoa.
      await como(db, ADMIN);
      expect(
        (
          await registrar(db, {
            referencia: "bbbbbbbb-8888",
            mensagem: "mais um",
          })
        ).registrado,
      ).toBe(true);
      // Passado o minuto, volta a gravar.
      await db.query(
        `update public."TL_ERRO_APLICACAO" set "DT_REGISTRO" = now() - interval '2 minutes'`,
      );
      await como(db, PESSOA);
      expect(
        (
          await registrar(db, {
            referencia: "bbbbbbbb-7777",
            mensagem: "mais um",
          })
        ).registrado,
      ).toBe(true);
    });

    it("apaga aos poucos o que passou de 180 dias", async () => {
      const db = await bancoMigrado();
      await db.query(
        `insert into public."TL_ERRO_APLICACAO" ("CO_REFERENCIA", "TP_ERRO", "DS_MENSAGEM", "CO_USUARIO", "DT_REGISTRO")
         select 'velho-' || lpad(g::text, 4, '0'), 'CLIENTE', 'antigo', $1, now() - interval '200 days'
           from generate_series(1, 60) g`,
        [PESSOA],
      );
      await como(db, PESSOA);
      await registrar(db, { referencia: "cccccccc-0001" });
      const contar = async () =>
        (
          await db.query<{ n: number }>(
            `select count(*)::int as n from public."TL_ERRO_APLICACAO" where "DS_MENSAGEM" = 'antigo'`,
          )
        ).rows[0]?.n;
      expect(await contar()).toBe(10);
      await registrar(db, { referencia: "cccccccc-0002", mensagem: "outro" });
      expect(await contar()).toBe(0);
    });
  });

  describe("ninguém lê direto; a leitura é só do administrador global", () => {
    it("RLS ligada e authenticated/anon sem privilégio na tabela", async () => {
      const db = await bancoMigrado();
      const { rows } = await db.query<{
        rls: boolean;
        anon: boolean;
        autenticado: boolean;
      }>(
        `select c.relrowsecurity as rls,
                has_table_privilege('anon', c.oid, 'select,insert,update,delete') as anon,
                has_table_privilege('authenticated', c.oid, 'select,insert,update,delete') as autenticado
           from pg_class c where c.oid = 'public."TL_ERRO_APLICACAO"'::regclass`,
      );
      expect(rows[0]).toEqual({ rls: true, anon: false, autenticado: false });
      await db.exec(`grant usage on schema public to authenticated`);
      await db.exec(`set role authenticated`);
      expect(
        await codigoDoErro(
          db.query(`select * from public."TL_ERRO_APLICACAO"`),
        ),
      ).toBe("42501");
      await db.exec(`reset role`);
    });

    it("quem não é administrador global recebe 42501; o administrador lê e acha pelo começo da referência", async () => {
      const db = await bancoMigrado();
      await como(db, PESSOA);
      await registrar(db, {
        referencia: "3f2a9c1b-0000-4000-8000-00000000000a",
      });
      await registrar(db, {
        referencia: "77777777-0000-4000-8000-00000000000b",
        tipo: "REDE",
        mensagem: "Failed to fetch",
      });
      expect(
        await codigoDoErro(
          db.query(`select public.listar_erros_da_aplicacao()`),
        ),
      ).toBe("42501");
      await como(db, null);
      expect(
        await codigoDoErro(
          db.query(`select public.listar_erros_da_aplicacao()`),
        ),
      ).toBe("28000");

      await como(db, ADMIN, ADMIN);
      type Item = { referencia: string; tipo: string; usuario: string };
      const listar = async (referencia: string | null, tipo: string | null) =>
        (
          await db.query<{ r: Item[] }>(
            `select public.listar_erros_da_aplicacao($1, $2) as r`,
            [referencia, tipo],
          )
        ).rows[0]?.r ?? [];
      expect(await listar(null, null)).toHaveLength(2);
      const achados = await listar("3F2A9C1B", null);
      expect(achados.map((i) => i.referencia)).toEqual([
        "3f2a9c1b-0000-4000-8000-00000000000a",
      ]);
      expect(achados[0]?.usuario).toBe(PESSOA);
      expect(JSON.stringify(achados)).not.toMatch(/@/);
      expect((await listar(null, "rede")).map((i) => i.tipo)).toEqual(["REDE"]);
      expect(
        await codigoDoErro(
          db.query(`select public.listar_erros_da_aplicacao('3f2a%')`),
        ),
      ).toBe("22023");
    });
  });
});

bloco("pedido-de-mais-acesso-no-banco", () => {
  /*
    A migration 20261124210000 (pendente) amplia o pedido de acesso para quem
    já tem conta: módulo com nível, outra área ou outro grupo. Num Postgres de
    verdade (PGlite), com as tabelas, as RPCs e as funções de permissão do
    retrato (tests/apoio/banco-do-pedido-de-acesso.ts). Confere o pedido, quem
    aprova o quê (admin, coordenador e teto), o que a aprovação concede e
    registra, o caminho de entrada que não muda, o rollback e o ensaio.
  */
  const entrar = entrarNoPedido;
  const rpc = rpcDoPedido;
  const erroDe = erroDoPedido;
  type Pedido = {
    id: string;
    status: string;
    tipo: string;
    recurso: string | null;
    nivel: string | null;
    area: string | null;
    grupo_solicitado: string | null;
    observacao_admin: string | null;
  } | null;
  type Linha = Record<string, unknown>;
  type Registro = { id: string; atualizado: boolean };

  async function migrado(): Promise<BancoDoPedido> {
    const db = await bancoDoPedidoDeAcesso();
    await db.exec(migrationDoPedido());
    return db;
  }
  const pedir = (db: BancoDoPedido, args: Record<string, unknown>) =>
    rpc<Registro>(db, "registrar_solicitacao_acesso", {
      p_nome: "",
      p_justificativa: JUSTIFICATIVA,
      ...args,
    });
  const meuPedido = (db: BancoDoPedido) =>
    rpc<Pedido>(db, "obter_minha_solicitacao_acesso");
  const listar = (db: BancoDoPedido) =>
    rpc<Linha[]>(db, "listar_solicitacoes_acesso");
  const aprovar = (db: BancoDoPedido, id: string, extra: Linha = {}) =>
    rpc(db, "aprovar_solicitacao_acesso", {
      p_solicitacao_id: id,
      p_grupo: null,
      ...extra,
    });
  async function nivelEfetivo(
    db: BancoDoPedido,
    idDoPerfil: string,
    recurso: string,
  ) {
    const { rows } = await db.query<{ n: string }>(
      `select private."FC_NIVEL_EFETIVO"(u.id, u.perfil, $2) as n from public."TB_PERFIL_USUARIO" u where u.id = $1`,
      [idDoPerfil, recurso],
    );
    return rows[0]?.n;
  }
  async function perfil(db: BancoDoPedido, id: string) {
    const { rows } = await db.query<{
      perfil: string;
      coordenacao: string | null;
      areas: string[];
    }>(
      `select u.perfil, u."CO_COORDENACAO" as coordenacao, private."FC_AREAS_DO_PERFIL"(u.id) as areas
         from public."TB_PERFIL_USUARIO" u where u.id = $1`,
      [id],
    );
    return rows[0];
  }
  async function historico(db: BancoDoPedido, id: string) {
    const { rows } = await db.query<Linha>(
      `select recurso, nivel_anterior as anterior, nivel_novo as novo, alterado_por::text as por, motivo
         from public."TH_PERMISSAO_RECURSO" where perfil_usuario_id = $1 order by id`,
      [id],
    );
    return rows;
  }

  describe("arquivos", () => {
    it("o ensaio roda o corpo da migration sem mudança e termina em rollback", () => {
      const m = migrationDoPedido();
      const corpo = m.slice(
        m.indexOf("\nbegin;\n") + "\nbegin;\n".length,
        m.lastIndexOf("\ncommit;"),
      );
      const e = ensaioDoPedido();
      expect(e).toContain(corpo);
      expect(e.trimEnd().endsWith("rollback;")).toBe(true);
      expect(e).not.toMatch(/^commit;/m);
    });

    it("o rollback volta as quatro RPCs com o corpo do retrato, letra por letra", () => {
      const r = rollbackDoPedido();
      for (const nome of [
        "public.registrar_solicitacao_acesso",
        "public.aprovar_solicitacao_acesso",
        "public.obter_minha_solicitacao_acesso",
        "public.listar_solicitacoes_acesso",
      ]) {
        const corpo = funcaoDoRetrato(nome).replace(/^CREATE FUNCTION /, "");
        expect(r, nome).toContain(corpo);
      }
    });

    it("o pedido de entrada aprovado segue o corpo de hoje (só entra a ida para o pedido de mais acesso)", () => {
      const hoje = funcaoDoRetrato("public.aprovar_solicitacao_acesso");
      const m = migrationDoPedido();
      const de = m.indexOf(
        "create or replace function public.aprovar_solicitacao_acesso",
      );
      const nova = m.slice(m.indexOf("declare", de), m.indexOf("\n$$;", de));
      const ida =
        /\n {2}-- Pedido de mais acesso \(20261124210000\)[^\n]*\n {2}if v_req\."TP_SOLICITACAO" <> 'ACESSO' then\n[^\n]*\n {2}end if;/;
      expect(nova).toMatch(ida);
      expect(hoje).toContain(nova.replace(ida, ""));
    });
  });

  describe("migration aplicada", () => {
    it("aplica no banco de hoje (o md5 dos corpos bate) e não aplica de novo", async () => {
      const db = await migrado();
      expect(await erroDe(db.exec(migrationDoPedido()))).toMatch(/já aplicada/);
    });

    it("só authenticated chama a RPC nova; as internas ficam fechadas", async () => {
      const db = await migrado();
      const { rows } = await db.query<Record<string, boolean>>(`select
        has_function_privilege('authenticated', 'public.registrar_solicitacao_acesso(text,text,text,text,text,text,text,text,text,text,text)', 'execute') as autenticado,
        has_function_privilege('anon', 'public.registrar_solicitacao_acesso(text,text,text,text,text,text,text,text,text,text,text)', 'execute') as anonimo,
        has_function_privilege('authenticated', 'private."FC_APROVAR_AMPLIACAO_ACESSO"(uuid, text)', 'execute') as aprovar_interno`);
      expect(rows[0]).toEqual({
        autenticado: true,
        anonimo: false,
        aprovar_interno: false,
      });
    });
  });

  describe("quem não tem conta: o pedido de entrada não muda", () => {
    it("registra com os argumentos de hoje, vê o pedido e é aprovado como antes", async () => {
      const db = await migrado();
      await entrar(db, DANI);
      await rpc(db, "registrar_solicitacao_acesso", {
        p_nome: "Dani Teste",
        p_area: "sede",
        p_cargo: "APOIO",
        p_lotacao: "Diretoria",
        p_justificativa: JUSTIFICATIVA,
      });
      const pedido = await meuPedido(db);
      expect(pedido).toMatchObject({
        status: "pendente",
        tipo: "ACESSO",
        recurso: null,
      });
      expect(
        await erroDe(
          pedir(db, {
            p_tipo: "MODULO",
            p_recurso: "nucleo",
            p_nivel: "editor",
          }),
        ),
      ).toMatch(/quem já tem acesso ativo/);
      await entrar(db, ADMIN);
      await rpc(db, "aprovar_solicitacao_acesso", {
        p_solicitacao_id: pedido!.id,
        p_grupo: "usuario",
        p_areas: ["sede"],
      });
      const { rows } = await db.query<{ perfil: string }>(
        `select perfil from public."TB_PERFIL_USUARIO" where user_id = $1`,
        [DANI.uid],
      );
      expect(rows).toEqual([{ perfil: "usuario" }]);
    });

    it("conta desativada não vê o pedido de mais acesso que sobrou; a reativação o converte", async () => {
      const db = await migrado();
      await db.query(
        `update public."TB_PERFIL_USUARIO" set ativo = true where id = $1`,
        [CAIO.perfil],
      );
      await entrar(db, CAIO);
      await pedir(db, {
        p_tipo: "MODULO",
        p_recurso: "calendario",
        p_nivel: "leitor",
      });
      await db.query(
        `update public."TB_PERFIL_USUARIO" set ativo = false where id = $1`,
        [CAIO.perfil],
      );
      expect(await meuPedido(db)).toBeNull();
      await rpc(db, "registrar_solicitacao_acesso", {
        p_nome: "Caio Teste",
        p_justificativa: JUSTIFICATIVA,
      });
      expect(await meuPedido(db)).toMatchObject({
        status: "pendente",
        tipo: "ACESSO",
        recurso: null,
        nivel: null,
      });
    });
  });

  describe("quem tem conta pede mais acesso", () => {
    it("módulo com nível: fica pendente, aparece na gaveta e pode ser trocado por outro pedido", async () => {
      const db = await migrado();
      await entrar(db, BIA);
      const r = await pedir(db, {
        p_tipo: "MODULO",
        p_recurso: "calendario",
        p_nivel: "editor",
      });
      expect(r).toMatchObject({
        ok: true,
        status: "pendente",
        tipo: "MODULO",
        atualizado: false,
      });
      expect(await meuPedido(db)).toMatchObject({
        tipo: "MODULO",
        recurso: "calendario",
        nivel: "editor",
        status: "pendente",
      });
      const troca = await pedir(db, { p_tipo: "AREA", p_area: "projetos" });
      expect(troca).toMatchObject({ atualizado: true, id: r.id });
      expect(await meuPedido(db)).toMatchObject({
        tipo: "AREA",
        area: "projetos",
        recurso: null,
        nivel: null,
      });
      await rpc(db, "cancelar_minha_solicitacao_acesso");
      expect(await meuPedido(db)).toMatchObject({ status: "cancelado" });
    });

    it("recusa o que não faz sentido pedir", async () => {
      const db = await migrado();
      await entrar(db, BIA);
      const casos: [Record<string, unknown>, RegExp][] = [
        [{}, /Escolha o que pedir/],
        [
          { p_tipo: "MODULO", p_recurso: "nucleo", p_nivel: "leitor" },
          /já tem esse nível/,
        ],
        [
          { p_tipo: "MODULO", p_recurso: "inventado", p_nivel: "editor" },
          /Módulo inválido/,
        ],
        [
          { p_tipo: "MODULO", p_recurso: "configuracoes", p_nivel: "leitor" },
          /Configurações exige/,
        ],
        [
          { p_tipo: "MODULO", p_recurso: "acessos", p_nivel: "admin" },
          /só tem o nível Editor/,
        ],
        [{ p_tipo: "AREA", p_area: "sede" }, /já tem acesso a esta área/],
        [
          { p_tipo: "GRUPO", p_grupo: "admin_global" },
          /administrador global não se pede/,
        ],
        [{ p_tipo: "GRUPO", p_grupo: "usuario" }, /já está neste grupo/],
        [
          {
            p_tipo: "MODULO",
            p_recurso: "calendario",
            p_nivel: "editor",
            p_justificativa: "quero",
          },
          /20 a 2\.000/,
        ],
      ];
      for (const [args, erro] of casos)
        expect(await erroDe(pedir(db, args)), JSON.stringify(args)).toMatch(
          erro,
        );
      await entrar(db, ANA);
      expect(
        await erroDe(pedir(db, { p_tipo: "AREA", p_area: "projetos" })),
      ).toMatch(/vem da sua coordenação/);
      await entrar(db, ADMIN);
      expect(
        await erroDe(
          pedir(db, {
            p_tipo: "MODULO",
            p_recurso: "nucleo",
            p_nivel: "admin",
          }),
        ),
      ).toMatch(/administrador global já tem acesso a tudo/);
    });
  });

  describe("quem aprova e o que a aprovação concede", () => {
    it("admin aprova a área: só ela entra, com quem aprovou no pedido e no histórico", async () => {
      const db = await migrado();
      await entrar(db, BIA);
      const { id } = await pedir(db, { p_tipo: "AREA", p_area: "projetos" });
      await entrar(db, COORDENADOR);
      expect(await listar(db)).toEqual([]);
      await entrar(db, ADMIN);
      const lista = await listar(db);
      expect(lista).toHaveLength(1);
      expect(lista[0]).toMatchObject({
        tipo: "AREA",
        area: "projetos",
        grupo_atual: "usuario",
        areas_atuais: ["sede"],
        reativacao: false,
      });
      // p_grupo, p_coordenacao e p_areas não valem para o pedido de mais acesso.
      await aprovar(db, id, {
        p_grupo: "admin_global",
        p_areas: ["saude-indigena"],
      });
      expect(await perfil(db, BIA.perfil)).toEqual({
        perfil: "usuario",
        coordenacao: null,
        areas: ["sede", "projetos"],
      });
      expect(await historico(db, BIA.perfil)).toEqual([
        {
          recurso: "area:projetos",
          anterior: "sem_acesso",
          novo: "leitor",
          por: ADMIN.uid,
          motivo: "Pedido de mais acesso aprovado",
        },
      ]);
      const { rows } = await db.query<Linha>(
        `select status, avaliado_por::text as por, avaliado_em is not null as em from public."TB_SOLICITACAO_ACESSO" where id = $1`,
        [id],
      );
      expect(rows[0]).toEqual({ status: "aprovado", por: ADMIN.uid, em: true });
      await entrar(db, BIA);
      expect(await meuPedido(db)).toMatchObject({
        status: "aprovado",
        tipo: "AREA",
      });
    });

    it("coordenador aprova módulo e grupo da própria coordenação, dentro do teto", async () => {
      const db = await migrado();
      await entrar(db, ANA);
      let { id } = await pedir(db, {
        p_tipo: "MODULO",
        p_recurso: "calendario",
        p_nivel: "editor",
      });
      await entrar(db, COORDENADOR);
      const lista = await listar(db);
      expect(lista.map((l) => l.id)).toEqual([id]);
      expect(lista[0]).toMatchObject({
        nivel_atual: "sem_acesso",
        recurso: "calendario",
        nivel: "editor",
      });
      await aprovar(db, id, { p_observacao_admin: "Conferido com a chefia" });
      expect(await nivelEfetivo(db, ANA.perfil, "calendario")).toBe("editor");
      expect((await historico(db, ANA.perfil)).at(-1)).toEqual({
        recurso: "calendario",
        anterior: "sem_acesso",
        novo: "editor",
        por: COORDENADOR.uid,
        motivo: "Conferido com a chefia",
      });

      await entrar(db, ANA);
      ({ id } = await pedir(db, {
        p_tipo: "MODULO",
        p_recurso: "nucleo",
        p_nivel: "admin",
      }));
      await entrar(db, COORDENADOR);
      expect(await erroDe(aprovar(db, id))).toMatch(
        /mais do que o seu próprio nível/,
      );
      await entrar(db, ADMIN);
      await aprovar(db, id);
      expect(await nivelEfetivo(db, ANA.perfil, "nucleo")).toBe("admin");

      await entrar(db, ANA);
      ({ id } = await pedir(db, { p_tipo: "GRUPO", p_grupo: "superior" }));
      await entrar(db, COORDENADOR);
      expect(await erroDe(aprovar(db, id))).toMatch(
        /dá mais acesso do que você tem/,
      );
      await entrar(db, ANA);
      ({ id } = await pedir(db, { p_tipo: "GRUPO", p_grupo: "edital_gestor" }));
      await entrar(db, COORDENADOR);
      await aprovar(db, id);
      expect(await perfil(db, ANA.perfil)).toEqual({
        perfil: "edital_gestor",
        coordenacao: "coord-sede",
        areas: ["sede"],
      });

      await entrar(db, ANA);
      ({ id } = await pedir(db, {
        p_tipo: "MODULO",
        p_recurso: "acessos",
        p_nivel: "editor",
      }));
      await entrar(db, COORDENADOR);
      expect(await erroDe(aprovar(db, id))).toMatch(
        /Só o administrador concede Acessos/,
      );
    });

    it("ninguém aprova o próprio pedido, nem o vê na lista", async () => {
      const db = await migrado();
      await entrar(db, COORDENADOR);
      const { id } = await pedir(db, {
        p_tipo: "MODULO",
        p_recurso: "calendario",
        p_nivel: "admin",
      });
      expect(await listar(db)).toEqual([]);
      expect(await erroDe(aprovar(db, id))).toMatch(
        /Outra pessoa deve aprovar/,
      );
      await entrar(db, ADMIN);
      expect((await listar(db)).map((l) => l.id)).toEqual([id]);
    });

    it("as travas da matriz: Gestão de acessos sem coordenação não passa, e nada muda", async () => {
      const db = await migrado();
      await entrar(db, BIA);
      const { id } = await pedir(db, {
        p_tipo: "MODULO",
        p_recurso: "acessos",
        p_nivel: "editor",
      });
      await entrar(db, ADMIN);
      expect(await erroDe(aprovar(db, id))).toMatch(
        /gerenciaria acessos sem coordenação/,
      );
      expect(await nivelEfetivo(db, BIA.perfil, "acessos")).toBe("sem_acesso");
      expect(await historico(db, BIA.perfil)).toEqual([]);
    });

    it("recusar: a pessoa vê o motivo na gaveta", async () => {
      const db = await migrado();
      await entrar(db, BIA);
      const { id } = await pedir(db, {
        p_tipo: "GRUPO",
        p_grupo: "edital_gestor",
      });
      await entrar(db, ADMIN);
      await rpc(db, "recusar_solicitacao_acesso", {
        p_solicitacao_id: id,
        p_motivo: "JUSTIFICATIVA_INSUFICIENTE",
      });
      await entrar(db, BIA);
      expect(await meuPedido(db)).toMatchObject({
        status: "recusado",
        tipo: "GRUPO",
        grupo_solicitado: "edital_gestor",
        observacao_admin: "Justificativa insuficiente",
      });
      expect((await perfil(db, BIA.perfil))?.perfil).toBe("usuario");
    });
  });

  describe("rollback e ensaio", () => {
    it("com pedido de mais acesso pendente, o rollback não desfaz nada", async () => {
      const db = await migrado();
      await entrar(db, BIA);
      await pedir(db, { p_tipo: "AREA", p_area: "projetos" });
      expect(await erroDe(db.exec(rollbackDoPedido()))).toMatch(/pendente/);
      await db.exec("rollback");
      expect(await meuPedido(db)).toMatchObject({
        tipo: "AREA",
        status: "pendente",
      });
    });

    it("volta as funções e a tabela de hoje, guarda o tipo dos pedidos decididos e aceita a migration de novo", async () => {
      const db = await migrado();
      await entrar(db, BIA);
      const { id } = await pedir(db, { p_tipo: "AREA", p_area: "projetos" });
      await entrar(db, ADMIN);
      await aprovar(db, id);
      await db.exec(rollbackDoPedido());
      const { rows: colunas } = await db.query(
        `select 1 from information_schema.columns where table_name = 'TB_SOLICITACAO_ACESSO' and column_name in ('TP_SOLICITACAO', 'NO_RECURSO', 'TP_NIVEL')`,
      );
      expect(colunas).toEqual([]);
      const { rows: guardados } = await db.query(
        `select "TP_SOLICITACAO" as tipo, "CO_AREA" as area from arquivo."TB_SOLICITACAO_AMPLIACAO_ANTES"`,
      );
      expect(guardados).toEqual([{ tipo: "AREA", area: "projetos" }]);
      // O que foi concedido fica.
      expect((await perfil(db, BIA.perfil))?.areas).toEqual([
        "sede",
        "projetos",
      ]);
      const { rows: funcoes } = await db.query<{ n: number }>(
        `select count(*)::int as n from pg_proc where proname in ('FC_APROVAR_AMPLIACAO_ACESSO', 'FC_REGISTRAR_AMPLIACAO_ACESSO')
            or (proname = 'registrar_solicitacao_acesso' and pronargs <> 7)`,
      );
      expect(funcoes[0]?.n).toBe(0);
      // Os corpos de hoje: a guarda da migration (md5) aceita aplicar de novo.
      await db.exec(migrationDoPedido());
    });

    it("o ensaio roda, confere e não grava nada", async () => {
      const db = await bancoDoPedidoDeAcesso();
      await db.exec(ensaioDoPedido());
      const { rows } = await db.query(
        `select 1 from information_schema.columns where table_name = 'TB_SOLICITACAO_ACESSO' and column_name = 'TP_SOLICITACAO'`,
      );
      expect(rows).toEqual([]);
    });
  });
});
