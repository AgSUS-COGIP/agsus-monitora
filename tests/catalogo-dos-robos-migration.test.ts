import { createHash } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ROBOS_DE_CARGA } from "../src/lib/robos-de-carga.ts";
import { CONTRATO_RPC } from "../src/lib/rpc-contrato.ts";
import {
  BANCO_DE_ANTES,
  COMENTARIOS_DE_HOJE,
  definicaoVigente,
  ENSAIO,
  FUNCOES_DE_HOJE,
  lerMigration,
  MIGRATION,
  NOME_DA_MIGRATION,
  ROLLBACK,
} from "./apoio/banco-dos-robos.ts";
import { CATALOGO_DOS_ROBOS } from "./fixtures/catalogo-dos-robos.ts";

/*
  Migration 20261109180000 (catálogo dos robôs e chave única): invariantes
  estáticas. O comportamento no banco está em tests/catalogo-dos-robos-no-banco.test.ts.

  - O catálogo é a soma exata das listas fixas de antes, lidas da fixture
    tests/fixtures/banco-antes-do-catalogo-dos-robos.sql (cópia literal das
    migrations de origem, que saíram do repositório).
  - Tudo o que pede ou registra workflow (disparar_robo, as tarefas do pg_cron,
    ROBOS_DE_CARGA da tela, os .yml do repositório) cabe no catálogo.
  - FC_DISPARAR_ROBO, registrar_disparo_externo e alterar_chave_da_automacao
    novas são as de antes com só as trocas declaradas aqui.
  - O rollback devolve o corpo e o comentário de antes, letra por letra.
  - O md5 das guardas é o do corpo de antes.
  - O ensaio contém o corpo da migration e termina em rollback.
  - Padrão MAD nas tabelas novas.
*/

/* As migrations de origem saíram do repositório; os trechos estão na fixture do banco de antes. */
const DE_HOJE = { disparar: BANCO_DE_ANTES, etapa2b: BANCO_DE_ANTES };
const antiga = (nome: string) => {
  if (!FUNCOES_DE_HOJE.includes(nome)) throw new Error(nome);
  return definicaoVigente(nome);
};
const nova = (texto: string, cabeca: string) => {
  const inicio = texto.toLowerCase().indexOf(cabeca.toLowerCase());
  expect(inicio, cabeca).toBeGreaterThan(-1);
  return texto.slice(
    inicio,
    texto.indexOf("$function$;", inicio) + "$function$;".length,
  );
};
const prosrc = (sql: string) =>
  sql.slice(
    sql.indexOf("$function$") + "$function$".length,
    sql.lastIndexOf("$function$"),
  );
const md5 = (s: string) => createHash("md5").update(s, "utf8").digest("hex");
const strings = (texto: string) =>
  [...texto.matchAll(/'([^']+)'/g)].map((m) => m[1] ?? "");

/* ── O catálogo, lido da migration ─────────────────────────────────────────── */
interface LinhaDoWorkflow {
  workflow: string;
  chave: string | null;
  inputs: string[];
  disparavel: boolean;
  externo: boolean;
}
const CATALOGO: LinhaDoWorkflow[] = [
  ...MIGRATION.matchAll(
    /\('([a-z0-9-]+\.yml)', '[^']+', (null|'\w+'),\s*'\{([a-z_,]*)\}', '([SN])', '([SN])'\)/g,
  ),
].map(([, workflow = "", chave = "", inputs = "", disparavel, externo]) => ({
  workflow,
  chave: chave === "null" ? null : chave.slice(1, -1),
  inputs: inputs ? inputs.split(",") : [],
  disparavel: disparavel === "S",
  externo: externo === "S",
}));
const porWorkflow = new Map(CATALOGO.map((l) => [l.workflow, l]));
interface LinhaDaTarefa {
  tarefa: string;
  prefixo: boolean;
  chave: string | null;
  workflow: string | null;
}
const TAREFAS: LinhaDaTarefa[] = [
  ...MIGRATION.matchAll(
    /\('(agsus_[a-z0-9_]+)', '([SN])', '[^']+', (null|'\w+'), (null|'[a-z0-9-]+\.yml')\)/g,
  ),
].map(([, tarefa = "", prefixo, chave = "", workflow = ""]) => ({
  tarefa,
  prefixo: prefixo === "S",
  chave: chave === "null" ? null : chave.slice(1, -1),
  workflow: workflow === "null" ? null : workflow.slice(1, -1),
}));

describe("o catálogo é a soma exata das listas fixas de antes", () => {
  it("as linhas foram lidas (11 workflows, 17 tarefas)", () => {
    expect(CATALOGO).toHaveLength(11);
    expect(TAREFAS).toHaveLength(17);
  });

  it("CK_DISPROBO_NOWORKFLOW de antes = todos os workflows do catálogo", () => {
    const ck =
      /"CK_DISPROBO_NOWORKFLOW" check \("NO_WORKFLOW" = any \(array\[([\s\S]*?)\]\)\)/.exec(
        DE_HOJE.disparar,
      );
    expect(strings(ck?.[1] ?? "").sort()).toEqual(
      CATALOGO.map((l) => l.workflow).sort(),
    );
  });

  it("c_aceitos de FC_DISPARAR_ROBO de antes = os disparáveis, com os mesmos inputs", () => {
    const corpo = antiga('private."FC_DISPARAR_ROBO"');
    const bloco = corpo.slice(
      corpo.indexOf("c_aceitos constant"),
      corpo.indexOf("v_inputs jsonb"),
    );
    const aceitos = Object.fromEntries(
      [
        ...bloco.matchAll(/'([a-z0-9-]+\.yml)', jsonb_build_array\(([^)]*)\)/g),
      ].map(([, w = "", lista = ""]) => [w, strings(lista).sort()]),
    );
    expect(Object.keys(aceitos)).toHaveLength(9);
    expect(
      Object.fromEntries(
        CATALOGO.filter((l) => l.disparavel).map((l) => [
          l.workflow,
          [...l.inputs].sort(),
        ]),
      ),
    ).toEqual(aceitos);
    // Quem não é disparável não aceita input.
    for (const l of CATALOGO.filter((x) => !x.disparavel))
      expect(l.inputs).toEqual([]);
  });

  it("a lista de registrar_disparo_externo de antes = os de registro externo", () => {
    const corpo = antiga("public.registrar_disparo_externo");
    const lista = /p_workflow not in \(([\s\S]*?)\) then/.exec(corpo);
    expect(strings(lista?.[1] ?? "").sort()).toEqual(
      CATALOGO.filter((l) => l.externo)
        .map((l) => l.workflow)
        .sort(),
    );
  });

  it("FC_CHAVE_DO_WORKFLOW de antes = a chave de cada workflow (nula nos de fora do case)", () => {
    const corpo = antiga('private."FC_CHAVE_DO_WORKFLOW"');
    const casos = Object.fromEntries(
      [...corpo.matchAll(/when '([a-z0-9-]+\.yml)' then '(\w+)'/g)].map(
        ([, w, c]) => [w, c],
      ),
    );
    expect(Object.keys(casos)).toHaveLength(8);
    for (const l of CATALOGO)
      expect(l.chave, l.workflow).toBe(casos[l.workflow] ?? null);
  });

  it("FC_CHAVE_DA_TAREFA de antes = a chave de cada tarefa; o prefixo das inscrições continua prefixo", () => {
    const corpo = antiga('private."FC_CHAVE_DA_TAREFA"');
    const casos: Record<string, string> = {};
    for (const [, nomes = "", chave = ""] of corpo.matchAll(
      /when p_tarefa (?:= |in \()([^)]*?)\)? then '(\w+)'/g,
    ))
      for (const nome of strings(nomes)) casos[nome] = chave;
    const prefixo =
      /when p_tarefa like 'agsus\\_robo\\_inscricoes\\_%' then '(\w+)'/.exec(
        corpo,
      );
    expect(prefixo?.[1]).toBe("robo_de_inscricoes");
    expect(Object.keys(casos)).toHaveLength(11);
    for (const [nome, chave] of Object.entries(casos))
      expect(
        TAREFAS.find((t) => t.tarefa === nome && !t.prefixo)?.chave,
        nome,
      ).toBe(chave);
    expect(TAREFAS.find((t) => t.prefixo)).toEqual({
      tarefa: "agsus_robo_inscricoes_",
      prefixo: true,
      chave: "robo_de_inscricoes",
      workflow: "robo-empregare.yml",
    });
    // As que não têm chave nas listas de antes continuam sem chave.
    for (const t of TAREFAS.filter((x) => !x.prefixo && !(x.tarefa in casos)))
      expect(t.chave, t.tarefa).toBeNull();
  });

  it("toda chave do catálogo existe na lista de chaves (CK_CHAVEAUTOM_COCHAVE de 20261023200000)", () => {
    const ck =
      /"CK_CHAVEAUTOM_COCHAVE" check \("CO_CHAVE" in \(([\s\S]*?)\)\)/.exec(
        DE_HOJE.etapa2b,
      );
    const chaves = new Set(strings(ck?.[1] ?? ""));
    expect(chaves.size).toBe(10);
    for (const c of [
      ...CATALOGO.map((l) => l.chave),
      ...TAREFAS.map((t) => t.chave),
    ])
      if (c) expect(chaves, c).toContain(c);
  });
});

describe("tudo o que pede ou registra workflow cabe no catálogo", () => {
  it("disparar_robo (Rodar agora): cada robô pede um workflow disparável que aceita tudo o que ele manda", () => {
    const corpo = antiga("public.disparar_robo");
    const robos = corpo.slice(
      corpo.indexOf("c_robos constant"),
      corpo.indexOf("c_uuid constant"),
    );
    const partes = robos.split(/\n\s{4}'(\w+)', jsonb_build_object\(/).slice(1);
    expect(partes.length / 2).toBe(6);
    for (let i = 0; i < partes.length; i += 2) {
      const [robo = "", trecho = ""] = [partes[i], partes[i + 1]];
      const workflow =
        /'workflow', '([a-z0-9-]+\.yml)'/.exec(trecho)?.[1] ?? "";
      const linha = porWorkflow.get(workflow);
      expect(linha?.disparavel, `${robo} → ${workflow}`).toBe(true);
      // O que disparar_robo pode pôr em v_saida para este robô.
      const manda = ["modo"];
      if (/'editais'|'por_edital'/.test(trecho)) manda.push("editais");
      for (const opcao of [
        "vagas",
        "limite",
        "anexos",
        "candidatos",
        "seco",
        "forcar_congelado",
      ])
        if (trecho.includes(`'${opcao}', true`)) manda.push(opcao);
      for (const input of manda)
        expect(linha?.inputs, `${robo}: ${input}`).toContain(input);
    }
  });

  it("os robôs da tela (ROBOS_DE_CARGA) pedem workflows disparáveis", () => {
    for (const robo of ROBOS_DE_CARGA)
      expect(porWorkflow.get(robo.workflow)?.disparavel, robo.workflow).toBe(
        true,
      );
  });

  // As migrations antigas saíram do repositório: isto vale para as que vierem depois desta.
  it("todo FC_DISPARAR_ROBO('x.yml' das migrations do repositório (tarefas do pg_cron e funções) está no catálogo", () => {
    const pedidos = new Set<string>();
    for (const arquivo of readdirSync("supabase/migrations").filter((f) =>
      f.endsWith(".sql"),
    ))
      for (const [, w = ""] of lerMigration(arquivo).matchAll(
        /"FC_DISPARAR_ROBO"\('{1,2}([a-z0-9-]+\.yml)'/g,
      ))
        pedidos.add(w);
    for (const w of pedidos) expect(porWorkflow.has(w), w).toBe(true);
  });

  it("todo workflow que o banco pede ou deixa registrar existe em .github/workflows", () => {
    for (const l of CATALOGO.filter((x) => x.disparavel || x.externo))
      expect(existsSync(`.github/workflows/${l.workflow}`), l.workflow).toBe(
        true,
      );
  });

  it("as tarefas apontam para workflows do catálogo e para a chave do próprio workflow", () => {
    for (const t of TAREFAS.filter((x) => x.workflow)) {
      const w = porWorkflow.get(t.workflow ?? "");
      expect(w?.disparavel, t.tarefa).toBe(true);
      expect(t.chave, t.tarefa).toBe(w?.chave);
    }
  });
});

/* As trocas declaradas: o corpo novo é o de antes com só estas mudanças. */
const TROCAS: Record<string, readonly (readonly [string, string])[]> = {
  'private."FC_DISPARAR_ROBO"': [
    [
      "  -- Lista fixa: workflow → inputs que ele aceita (além de disparado_por).\n  c_aceitos constant jsonb := jsonb_build_object(",
      "  -- Catálogo (TB_ROBO_WORKFLOW, 20261109180000): inputs que o workflow aceita (além de disparado_por).\n  v_aceitos text[];\n",
    ],
    [
      "  if p_workflow is null or not (c_aceitos ? p_workflow) then",
      "  if p_workflow is null or v_aceitos is null then",
    ],
    [
      "        where not ((c_aceitos -> p_workflow) ? i.key)",
      "        where not (i.key = any (v_aceitos))",
    ],
  ],
  "public.registrar_disparo_externo": [
    [
      "  if p_workflow is null or p_workflow not in (",
      "  if p_workflow is null or not exists (",
    ],
  ],
  "public.alterar_chave_da_automacao": [
    ["  v_tarefa record;\n", ""],
    ['v_tarefas := private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(p_chave);', ""],
  ],
};

describe("as funções trocadas: o corpo de antes com só as trocas declaradas", () => {
  it("FC_DISPARAR_ROBO: tudo fora da lista de inputs é igual (validações, Vault, pg_net, log)", () => {
    const velha = antiga('private."FC_DISPARAR_ROBO"');
    const novaF = nova(
      MIGRATION,
      'CREATE OR REPLACE FUNCTION private."FC_DISPARAR_ROBO"',
    );
    // Tira de cada lado o que mudou de propósito; o resto tem de ser igual.
    const semLista = (s: string) =>
      s
        .replace(
          / {2}-- Lista fixa: workflow[\s\S]*?'casamento-da-lista\.yml', jsonb_build_array\('modo', 'pedido'\)\);\n/,
          "",
        )
        .replace(
          / {2}-- Catálogo \(TB_ROBO_WORKFLOW[^\n]*\n {2}v_aceitos text\[\];\n/,
          "",
        )
        .replace(
          / {2}select w\."DS_INPUT_ACEITO" into v_aceitos\n[\s\S]*?"ST_DISPARAVEL" = 'S';\n/,
          "",
        )
        .replace(
          "  if p_workflow is null or not (c_aceitos ? p_workflow) then",
          "IF_WORKFLOW",
        )
        .replace(
          "  if p_workflow is null or v_aceitos is null then",
          "IF_WORKFLOW",
        )
        .replace(
          "        where not ((c_aceitos -> p_workflow) ? i.key)",
          "WHERE_INPUT",
        )
        .replace("        where not (i.key = any (v_aceitos))", "WHERE_INPUT");
    expect(semLista(novaF)).toBe(semLista(velha));
    expect(novaF).not.toContain("c_aceitos");
    for (const [, depois] of TROCAS['private."FC_DISPARAR_ROBO"'] ?? [])
      expect(novaF).toContain(depois.trim().split("\n")[0]);
    // A ordem das guardas é a de antes: workflow, origem, inputs, chave, Vault.
    const ordem = [
      "Workflow fora da lista fixa dos robôs",
      "Origem inválida",
      "Inputs inválidos para",
      'FC_AUTOMACAO_LIGADA"(private."FC_CHAVE_DO_WORKFLOW"(p_workflow))',
      "vault.decrypted_secrets",
      "net.http_post",
    ].map((t) => novaF.indexOf(t));
    expect(ordem.every((p) => p > 0)).toBe(true);
    expect([...ordem].sort((a, b) => a - b)).toEqual(ordem);
  });

  it("registrar_disparo_externo: só a lista virou consulta ao catálogo", () => {
    const velha = antiga("public.registrar_disparo_externo");
    const novaF = nova(
      MIGRATION,
      "create or replace function public.registrar_disparo_externo",
    );
    const semLista = (s: string) =>
      s.replace(
        / {2}if p_workflow is null or (?:p_workflow not in|not exists) \([\s\S]*?\) then/,
        "IF_WORKFLOW",
      );
    expect(semLista(novaF)).toBe(semLista(velha));
    expect(novaF).toContain(`w."ST_REGISTRO_EXTERNO" = 'S'`);
  });

  it("alterar_chave_da_automacao: o laço virou o alinhador, depois de gravar a chave; o resto é igual", () => {
    const velha = antiga("public.alterar_chave_da_automacao");
    const novaF = nova(
      MIGRATION,
      "create or replace function public.alterar_chave_da_automacao",
    );
    const semLaco = (s: string) =>
      s
        .replace("  v_tarefa record;\n", "")
        .replace(
          / {2}-- As tarefas do pg_cron da chave acompanham \(o que já está no estado pedido fica\)\.\n[\s\S]*?end loop;\n\n/,
          "",
        )
        .replace(
          /\n {2}-- As tarefas do pg_cron da chave acompanham o estado gravado acima[\s\S]*?\(p_chave\);\n/,
          "",
        );
    expect(semLaco(novaF)).toBe(semLaco(velha));
    const gravar = novaF.indexOf('update public."TB_CHAVE_AUTOMACAO" set');
    const alinhar = novaF.indexOf(
      'private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(p_chave)',
    );
    const historico = novaF.indexOf('insert into public."TH_CHAVE_AUTOMACAO"');
    expect(gravar).toBeGreaterThan(0);
    expect(alinhar).toBeGreaterThan(gravar);
    expect(historico).toBeGreaterThan(alinhar);
  });

  it("as guardas de md5 são as do corpo de antes, e a migration recusa se já aplicada", () => {
    const pares: [string, string][] = [
      [
        'private."FC_DISPARAR_ROBO"',
        'private."FC_DISPARAR_ROBO"(text, jsonb, uuid, text)',
      ],
      [
        'private."FC_CHAVE_DO_WORKFLOW"',
        'private."FC_CHAVE_DO_WORKFLOW"(text)',
      ],
      ['private."FC_CHAVE_DA_TAREFA"', 'private."FC_CHAVE_DA_TAREFA"(text)'],
      [
        "public.registrar_disparo_externo",
        "public.registrar_disparo_externo(text, text, text, text)",
      ],
      [
        "public.alterar_chave_da_automacao",
        "public.alterar_chave_da_automacao(text, boolean, text)",
      ],
    ];
    for (const [nome, assinatura] of pares) {
      const linha = new RegExp(
        `to_regprocedure\\('${assinatura.replace(/[.*+?^${}()|[\]\\"]/g, "\\$&")}'\\)\\)\\)\\s+is distinct from '([0-9a-f]{32})'`,
      ).exec(MIGRATION);
      expect(linha?.[1], nome).toBe(md5(prosrc(antiga(nome))));
    }
    expect(MIGRATION).toContain("já foi aplicada (TB_ROBO_WORKFLOW existe)");
  });
});

describe("o rollback", () => {
  it("devolve cada função trocada letra por letra, com o comentário de antes", () => {
    for (const nome of [
      'private."FC_DISPARAR_ROBO"',
      'private."FC_CHAVE_DO_WORKFLOW"',
      'private."FC_CHAVE_DA_TAREFA"',
      "public.registrar_disparo_externo",
      "public.alterar_chave_da_automacao",
    ])
      expect(ROLLBACK, nome).toContain(antiga(nome));
    const trocados = [
      'comment on function private."FC_DISPARAR_ROBO"(',
      'comment on function private."FC_CHAVE_DO_WORKFLOW"(',
      'comment on function private."FC_CHAVE_DA_TAREFA"(',
      "comment on function public.registrar_disparo_externo(",
      "comment on function public.alterar_chave_da_automacao(",
      'comment on constraint "CK_DISPROBO_NOWORKFLOW"',
      'comment on column public."TL_DISPARO_ROBO"."NO_WORKFLOW"',
    ];
    const deles = COMENTARIOS_DE_HOJE.filter((c) =>
      trocados.some((t) => c.startsWith(t)),
    );
    expect(deles).toHaveLength(trocados.length);
    for (const comentario of deles) expect(ROLLBACK).toContain(comentario);
  });

  it("devolve o CHECK com a mesma lista, tira a tarefa, as funções e as tabelas novas, nessa ordem", () => {
    const ck =
      /"CK_DISPROBO_NOWORKFLOW" check \("NO_WORKFLOW" = any \(array\[([\s\S]*?)\]\)\)/;
    expect(strings(ck.exec(ROLLBACK)?.[1] ?? "")).toEqual(
      strings(ck.exec(DE_HOJE.disparar)?.[1] ?? ""),
    );
    const passos = [
      "cron.unschedule('agsus_alinhar_chaves_da_automacao')",
      'drop constraint "FK_DISPROBO_ROBOWKF"',
      'drop index public."IN_DISPROBO_NOWORKFLOW"',
      'add constraint "CK_DISPROBO_NOWORKFLOW"',
      "drop function public.obter_catalogo_dos_robos();",
      'drop function private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(text);',
      'drop table public."TB_TAREFA_AGENDADA";',
      'drop table public."TB_ROBO_WORKFLOW";',
    ].map((t) => ROLLBACK.indexOf(t));
    expect(passos.every((p) => p > 0)).toBe(true);
    expect([...passos].sort((a, b) => a - b)).toEqual(passos);
    expect(ROLLBACK.trim().startsWith("/*")).toBe(true);
    expect(ROLLBACK.trimEnd().endsWith("commit;")).toBe(true);
    // Fora dos corpos restaurados, não mexe no estado das tarefas nem apaga histórico.
    let semCorpos = ROLLBACK;
    for (const nome of FUNCOES_DE_HOJE)
      if (ROLLBACK.includes(antiga(nome)))
        semCorpos = semCorpos.replace(antiga(nome), "");
    expect(semCorpos).not.toMatch(
      /(perform|select) cron\.alter_job|delete from public\."TH_CHAVE_AUTOMACAO"/,
    );
  });
});

describe("o ensaio", () => {
  it("é begin + respostas de antes + o corpo da migration, igual + conferências + rollback; nunca commit", () => {
    const corpo = MIGRATION.slice(
      MIGRATION.indexOf("\nbegin;\n") + "\nbegin;\n".length,
      MIGRATION.lastIndexOf("\ncommit;"),
    );
    expect(ENSAIO).toContain(corpo);
    expect(ENSAIO.indexOf('create temp table "ENSAIO_ANTES"')).toBeLessThan(
      ENSAIO.indexOf(corpo),
    );
    expect(ENSAIO.indexOf("Respostas mudaram com a migration")).toBeGreaterThan(
      ENSAIO.indexOf(corpo),
    );
    expect(ENSAIO.trimEnd().endsWith("rollback;")).toBe(true);
    expect(ENSAIO.replace(corpo, "")).not.toMatch(/^commit;/m);
    // Nada vai ao GitHub no ensaio.
    expect(ENSAIO).toContain("set_config('agsus.segredo_disparo_robos'");
  });
});

describe("padrão do repositório", () => {
  it("tabelas MAD: nomes curtos e entre aspas, PK nomeada, toda coluna comentada, RLS e sem acesso direto", () => {
    for (const [, tabela = "", colunas = ""] of MIGRATION.matchAll(
      /create table public\."(\w+)" \(([\s\S]*?)\n\);/g,
    )) {
      expect(tabela.length).toBeLessThanOrEqual(30);
      expect(colunas).toContain(`constraint "PK_${tabela}" primary key`);
      for (const [, coluna = ""] of colunas.matchAll(/^\s+"(\w+)" /gm)) {
        expect(coluna).toMatch(/^(NO|DS|CO|ST|DT)_[A-Z_]+$/);
        expect(coluna.length).toBeLessThanOrEqual(30);
        expect(MIGRATION).toContain(
          `comment on column public."${tabela}"."${coluna}" is`,
        );
      }
      for (const [, constraint = ""] of colunas.matchAll(
        /constraint "(\w+)"/g,
      )) {
        expect(constraint).toMatch(/^(PK|FK|CK|UK)_/);
        expect(constraint.length).toBeLessThanOrEqual(30);
        expect(MIGRATION).toContain(
          `comment on constraint "${constraint}" on public."${tabela}" is`,
        );
      }
      expect(MIGRATION).toContain(
        `alter table public."${tabela}" enable row level security;`,
      );
      expect(MIGRATION).toContain(
        `revoke all on public."${tabela}" from public, anon, authenticated, service_role;`,
      );
      expect(MIGRATION).toContain(`comment on table public."${tabela}" is`);
    }
    for (const [, indice = ""] of MIGRATION.matchAll(/create index "(\w+)"/g)) {
      expect(indice).toMatch(/^IN_/);
      expect(MIGRATION).toContain(`comment on index public."${indice}" is`);
    }
  });

  it("funções novas com search_path vazio; o alinhador só do dono; o catálogo só para quem entra", () => {
    const alinhar = nova(
      MIGRATION,
      'create function private."FC_ALINHAR_TAREFAS_DAS_CHAVES"',
    );
    expect(alinhar).toContain("security definer");
    expect(alinhar).toContain("set search_path to ''");
    expect(MIGRATION).toContain(
      'revoke all on function private."FC_ALINHAR_TAREFAS_DAS_CHAVES"(text) from public, anon, authenticated, service_role;',
    );
    const catalogo = nova(
      MIGRATION,
      "create function public.obter_catalogo_dos_robos",
    );
    expect(catalogo).toContain("set search_path to ''");
    expect(catalogo).toContain("if not private.is_master() then");
    expect(MIGRATION).toContain(
      "revoke all on function public.obter_catalogo_dos_robos() from public, anon;",
    );
    expect(MIGRATION).toContain(
      "grant execute on function public.obter_catalogo_dos_robos() to authenticated;",
    );
    for (const cabeca of [
      'create or replace function private."FC_CHAVE_DO_WORKFLOW"',
      'create or replace function private."FC_CHAVE_DA_TAREFA"',
    ])
      expect(nova(MIGRATION, cabeca)).toContain("set search_path to ''");
  });

  it("a fixture dos testes da tela (tests/fixtures/catalogo-dos-robos.ts) é o catálogo da migration", () => {
    expect(
      CATALOGO_DOS_ROBOS.workflows
        .map((w) => [w.workflow, w.chave, w.disparavel])
        .sort(),
    ).toEqual(CATALOGO.map((l) => [l.workflow, l.chave, l.disparavel]).sort());
    expect(
      CATALOGO_DOS_ROBOS.tarefas
        .map((t) => [t.tarefa, t.prefixo, t.chave, t.workflow])
        .sort(),
    ).toEqual(
      TAREFAS.map((t) => [t.tarefa, t.prefixo, t.chave, t.workflow]).sort(),
    );
    for (const w of CATALOGO_DOS_ROBOS.workflows)
      expect(MIGRATION).toContain(`('${w.workflow}', '${w.nome}',`);
    for (const t of CATALOGO_DOS_ROBOS.tarefas)
      expect(MIGRATION).toContain(
        `('${t.tarefa}', '${t.prefixo ? "S" : "N"}', '${t.rotulo}',`,
      );
  });

  it("o RPC novo está no contrato, sem argumentos", () => {
    expect(CONTRATO_RPC.obter_catalogo_dos_robos?.argumentos).toEqual([]);
  });

  it("migration, ensaio e rollback com o mesmo nome; begin/commit; lock_timeout", () => {
    expect(NOME_DA_MIGRATION).toMatch(/^\d{14}_[a-z_]+\.sql$/);
    expect(MIGRATION).toMatch(/\nbegin;\n\nset local lock_timeout = '5s';\n/);
    expect(MIGRATION.trimEnd().endsWith("commit;")).toBe(true);
    expect(existsSync(`supabase/rollback/${NOME_DA_MIGRATION}`)).toBe(true);
    expect(existsSync(`supabase/ensaios/${NOME_DA_MIGRATION}`)).toBe(true);
  });
});
