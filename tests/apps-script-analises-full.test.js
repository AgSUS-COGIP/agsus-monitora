import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/*
  Apps Script das análises: robustez do sync FULL, da URL do banco, do fuso, dos
  gatilhos e da FATO em PARTIAL (22/10/2026).

  - O FULL buscava "o sync pendente da planilha" sem olhar o modo e adotava um
    INCREMENTAL_ACTIVE parado; finalizar um incremental como FULL desativaria o
    resto da planilha. Agora o FULL recusa sync de outro modo e descarta o
    estado local órfão (sync que sumiu, terminou em erro ou é de outro modo).
  - URL do banco: SUPABASE_URL_FIXA no código (só o projeto atual) ou a
    propriedade SUPABASE_URL; sem nenhuma, erro claro (23/10/2026).
  - Datas formatadas em America/Sao_Paulo, não no fuso do projeto.
  - Gatilho só chama função pública (sem '_' no fim).
  - FATO em PARTIAL (promovida, com vagas em erro) não bloqueia o incremental.
  - Incremental já processado no banco conclui antes de comparar a planilha.

  Os .gs não têm módulo: rodam num contexto do node:vm com dublês mínimos.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const PLANILHAS = ["saude-indigena", "projetos", "sede"];
const FULL = Object.fromEntries(
  PLANILHAS.map((p) => [
    p,
    ler(`apps-script/${p}/2-sincronizar-com-supabase-full.gs`),
  ]),
);
const INCREMENTAL = Object.fromEntries(
  PLANILHAS.map((p) => [p, ler(`apps-script/${p}/3-analises-incremental.gs`)]),
);
const ORQUESTRADOR = Object.fromEntries(
  PLANILHAS.map((p) => [
    p,
    ler(`apps-script/${p}/4-orquestrador-fato-supabase.gs`),
  ]),
);
const BASE_PROJETOS = ler("apps-script/projetos/1-atualizar-base.gs");
const ARQUIVOS = {
  "saude-indigena": [
    FULL["saude-indigena"],
    INCREMENTAL["saude-indigena"],
    ORQUESTRADOR["saude-indigena"],
  ],
  projetos: [
    BASE_PROJETOS,
    FULL.projetos,
    INCREMENTAL.projetos,
    ORQUESTRADOR.projetos,
  ],
  sede: [FULL.sede, INCREMENTAL.sede, ORQUESTRADOR.sede],
};

function contexto(codigo, extra = {}) {
  const props = new Map();
  const logs = [];
  const gatilhos = [];
  const ctx = vm.createContext({
    Logger: { log: (m) => logs.push(String(m)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, String(v)),
        setProperties: (o) =>
          Object.entries(o).forEach(([k, v]) => props.set(k, String(v))),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger: () => {},
      newTrigger: (nome) => ({
        timeBased: () => ({
          after: () => ({ create: () => gatilhos.push(nome) }),
        }),
      }),
    },
    Utilities: {
      getUuid: (() => {
        let n = 0;
        return () => `novo-${++n}`;
      })(),
      sleep: () => {},
    },
    ...extra,
  });
  vm.runInContext(codigo, ctx);
  return { ctx, props, logs, gatilhos };
}

/* Banco falso do FULL: o log TL_SYNC_ANALISE e as RPCs que o cliente chama. */
function bancoFalsoDoFull(syncs) {
  const chamadas = [];
  const resposta = (corpo, codigo = 200) => ({
    getResponseCode: () => codigo,
    getContentText: () => (corpo === undefined ? "" : JSON.stringify(corpo)),
    getAllHeaders: () => ({}),
  });
  const UrlFetchApp = {
    fetch(url, opcoes) {
      const caminho = url.replace(/^https:\/\/[^/]+/, "");
      chamadas.push({ caminho, metodo: opcoes.method });
      if (caminho.startsWith("/rest/v1/TL_SYNC_ANALISE")) {
        const id = decodeURIComponent(
          caminho.match(/sync_id=eq\.([^&]+)/)?.[1] || "",
        );
        if (id)
          return resposta(
            syncs.has(id) ? [{ sync_id: id, ...syncs.get(id) }] : [],
          );
        return resposta(
          [...syncs.entries()]
            .filter(([, s]) => ["carregado", "processando"].includes(s.status))
            .map(([sync_id, s]) => ({ sync_id, ...s })),
        );
      }
      throw new Error(`chamada inesperada: ${opcoes.method} ${caminho}`);
    },
  };
  return { UrlFetchApp, chamadas };
}

function full(planilha, syncs) {
  const banco = bancoFalsoDoFull(syncs);
  const c = contexto(FULL[planilha], { UrlFetchApp: banco.UrlFetchApp });
  c.props.set("SUPABASE_URL", "https://banco.exemplo");
  c.props.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste123");
  return { ...c, chamadas: banco.chamadas };
}

const ESTADO_FULL = "ANALISES_SYNC_LOTES_CLIENT_V1";

describe("o FULL não adota sync INCREMENTAL_ACTIVE", () => {
  it.each(PLANILHAS)(
    "%s: incremental pendente na planilha: o FULL recusa, sem RPC e sem guardar estado",
    (p) => {
      const { ctx, props, chamadas } = full(
        p,
        new Map([
          [
            "inc-1",
            {
              status: "processando",
              modo: "INCREMENTAL_ACTIVE",
              resultado: {},
            },
          ],
        ]),
      );
      const r = ctx.retomarSyncAnalisesCurriculares();
      expect(r).toMatchObject({
        ok: false,
        pending: true,
        skipped: true,
        sync_id: "inc-1",
        modo: "INCREMENTAL_ACTIVE",
      });
      expect(r.motivo).toContain("O FULL não o adota");
      expect(props.has(ESTADO_FULL)).toBe(false);
      expect(chamadas.some((c) => c.caminho.includes("/rpc/"))).toBe(false);
    },
  );

  it.each(PLANILHAS)(
    "%s: estado local apontando para um incremental (adotado antes da correção) é descartado",
    (p) => {
      const { ctx, props, logs, chamadas } = full(
        p,
        new Map([
          [
            "inc-2",
            {
              status: "processando",
              modo: "INCREMENTAL_ACTIVE",
              resultado: {},
            },
          ],
        ]),
      );
      props.set(
        ESTADO_FULL,
        JSON.stringify({
          sync_id: "inc-2",
          modo: "INCREMENTAL_ACTIVE",
          phase: "PROCESSING",
        }),
      );
      const r = ctx.continuarSyncAnalisesCurriculares();
      expect(props.has(ESTADO_FULL)).toBe(false);
      expect(logs.join("\n")).toContain(
        "estado local do sync inc-2 (fase PROCESSING) descartado: O sync inc-2 é INCREMENTAL_ACTIVE",
      );
      // O incremental ainda pendente continua sendo recusado, não adotado.
      expect(r).toMatchObject({ ok: false, skipped: true, sync_id: "inc-2" });
      expect(chamadas.some((c) => c.caminho.includes("/rpc/"))).toBe(false);
    },
  );
});

describe("o FULL descarta estado local órfão (decidirEstadoLocalLotesAnalises_)", () => {
  const { ctx } = contexto(FULL.projetos);
  const decidir = (remoto) =>
    ctx.decidirEstadoLocalLotesAnalises_({ sync_id: "s1" }, remoto);

  it("log sumiu, erro (inclusive encerrado por inatividade) ou outro modo: descarta", () => {
    expect(decidir(null).acao).toBe("DESCARTAR");
    expect(decidir({ status: "erro", modo: "FULL" })).toEqual({
      acao: "DESCARTAR",
      motivo: "Status remoto não permite processamento: erro",
    });
    expect(
      decidir({ status: "carregado", modo: "INCREMENTAL_ACTIVE" }).acao,
    ).toBe("DESCARTAR");
  });

  it("carregado, processando ou processado em FULL: segue", () => {
    for (const status of ["carregado", "processando", "processado"])
      expect(decidir({ status, modo: "FULL" }).acao).toBe("SEGUIR");
  });

  it.each(PLANILHAS)(
    "%s: sync guardado em 'erro': descarta e, sem pendente, a retomada fica ociosa (antes: pendente para sempre)",
    (p) => {
      const {
        ctx: c,
        props,
        logs,
      } = full(
        p,
        new Map([["velho", { status: "erro", modo: "FULL", resultado: {} }]]),
      );
      props.set(
        ESTADO_FULL,
        JSON.stringify({ sync_id: "velho", modo: "FULL", phase: "PROCESSING" }),
      );
      const r = c.retomarSyncAnalisesCurriculares();
      expect(r).toMatchObject({ ok: false, idle: true });
      expect(props.has(ESTADO_FULL)).toBe(false);
      expect(logs.join("\n")).toContain(
        "descartado: Status remoto não permite processamento: erro",
      );
    },
  );

  it.each(PLANILHAS)(
    "%s: sync guardado que não existe mais no banco também é descartado",
    (p) => {
      const { ctx: c, props } = full(p, new Map());
      props.set(
        ESTADO_FULL,
        JSON.stringify({ sync_id: "sumiu", modo: "FULL", phase: "UPLOADING" }),
      );
      expect(c.retomarSyncAnalisesCurriculares()).toMatchObject({
        idle: true,
      });
      expect(props.has(ESTADO_FULL)).toBe(false);
    },
  );
});

const PROJETO_ATUAL = "https://tabmkiokfuxyqjuvfiha.supabase.co";
const semUrlFixa = (codigo) =>
  codigo.replace(
    `SUPABASE_URL_FIXA: '${PROJETO_ATUAL}',`,
    "SUPABASE_URL_FIXA: '',",
  );

describe("URL do banco: fixa no código ou propriedade SUPABASE_URL", () => {
  it("nenhum .gs aponta para outro projeto Supabase nem tem DEFAULT_SUPABASE_URL", () => {
    for (const p of PLANILHAS)
      for (const codigo of ARQUIVOS[p]) {
        expect(codigo).not.toMatch(/DEFAULT_SUPABASE_URL/);
        for (const url of codigo.match(
          /https:\/\/[a-z0-9]{20}\.supabase\.co/g,
        ) || [])
          expect(url).toBe(PROJETO_ATUAL);
      }
  });

  it.each(PLANILHAS)("%s: a URL fixa vale antes da propriedade", (p) => {
    expect(FULL[p]).toContain(`SUPABASE_URL_FIXA: '${PROJETO_ATUAL}',`);
    const { ctx, props } = contexto(FULL[p]);
    props.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste123");
    props.set("SUPABASE_URL", "https://outro.exemplo");
    expect(ctx.obterConfiguracaoSupabaseAnalises_()).toMatchObject({
      url: PROJETO_ATUAL,
    });
  });

  it.each(PLANILHAS)(
    "%s: sem URL fixa nem propriedade, erro claro antes de qualquer requisição",
    (p) => {
      const { ctx, props } = contexto(semUrlFixa(FULL[p]));
      props.set("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_teste123");
      expect(() => ctx.obterConfiguracaoSupabaseAnalises_()).toThrow(
        /Configure a propriedade do script SUPABASE_URL .*ou SUPABASE_URL_FIXA no codigo/,
      );
      props.set("SUPABASE_URL", "https://banco.exemplo/");
      expect(ctx.obterConfiguracaoSupabaseAnalises_()).toMatchObject({
        url: "https://banco.exemplo",
      });
    },
  );
});

describe("datas no fuso America/Sao_Paulo", () => {
  it("nenhum .gs usa o fuso do projeto", () => {
    for (const p of PLANILHAS)
      for (const codigo of ARQUIVOS[p])
        expect(codigo).not.toContain("getScriptTimeZone");
  });

  it("todo formatDate/parseDate usa a constante FUSO_HORARIO = 'America/Sao_Paulo'", () => {
    const comFuso = [...PLANILHAS.map((p) => FULL[p]), BASE_PROJETOS];
    for (const codigo of comFuso) {
      expect(codigo).toContain("FUSO_HORARIO: 'America/Sao_Paulo',");
      const usos = [
        ...codigo.matchAll(/Utilities\.(?:formatDate|parseDate)\(([^;]+)/g),
      ];
      expect(usos.length).toBeGreaterThan(0);
      for (const [, args] of usos) expect(args).toMatch(/CFG\.FUSO_HORARIO/);
    }
  });
});

describe("gatilhos apontam para funções públicas que existem", () => {
  /* Valor de uma constante (CFG.X, ANALISES_SYNC_CFG.X...) nos arquivos da planilha. */
  const valor = (arquivos, expr) => {
    const nome = expr.trim().split(".").pop();
    for (const codigo of arquivos) {
      const m = codigo.match(new RegExp(`\\n\\s+${nome}: '([^']+)'`));
      if (m) return m[1];
    }
    throw new Error(`constante ${expr} não encontrada`);
  };

  it.each(PLANILHAS)(
    "%s: cada ScriptApp.newTrigger(...) chama uma função sem '_' definida nos arquivos",
    (p) => {
      const arquivos = ARQUIVOS[p];
      const gatilhos = arquivos.flatMap((codigo) =>
        [...codigo.matchAll(/ScriptApp\.newTrigger\(([^)]+)\)/g)].map((m) =>
          m[1].startsWith("'") ? m[1].slice(1, -1) : valor(arquivos, m[1]),
        ),
      );
      expect(gatilhos.length).toBeGreaterThan(0);
      for (const nome of gatilhos) {
        expect(nome, `gatilho ${nome}`).not.toMatch(/_$/);
        expect(
          arquivos.some((c) => c.includes(`\nfunction ${nome}(`)),
          `função ${nome} não existe nos arquivos de ${p}`,
        ).toBe(true);
      }
    },
  );

  it("Atualizar base de Projetos: os três gatilhos de continuação são públicos", () => {
    expect(BASE_PROJETOS).toContain(
      "CONTINUATION_SYNC_TRIGGER_HANDLER: 'processarLoteSincronizacaoAnalises',",
    );
    expect(BASE_PROJETOS).toContain(
      "RECLASS_STATUS_TRIGGER_HANDLER: 'continuarRecalculoStatusFato',",
    );
    expect(BASE_PROJETOS).toContain(
      "REPAIR_SCORE_TRIGGER_HANDLER: 'continuarRecalculoNotasPontuacoesFato',",
    );
  });
});

describe("FATO em PARTIAL não bloqueia o incremental para sempre", () => {
  const { ctx } = contexto(ORQUESTRADOR.projetos);
  const avaliar = (meta) => ctx.avaliarFatoParaIncrementalOrq_(meta).acao;

  it("PARTIAL com a FATO promovida na mesma execução: segue", () => {
    expect(
      avaliar({
        last_run_status: "PARTIAL",
        last_run_finished_at: "2026-10-22 10:00:01",
        last_success_at: "2026-10-22 10:00:00",
        sources_error: "1",
      }),
    ).toBe("SEGUIR");
    expect(
      avaliar({
        last_run_status: "PARTIAL",
        last_run_finished_at: "22/10/2026 10:00:00",
        last_success_at: "22/10/2026 10:00:00",
      }),
    ).toBe("SEGUIR");
  });

  it("PARTIAL sem promoção confirmada (sucesso antigo ou vazio): bloqueia", () => {
    expect(
      avaliar({
        last_run_status: "PARTIAL",
        last_run_finished_at: "2026-10-22 10:00:00",
        last_success_at: "2026-10-21 08:00:00",
      }),
    ).toBe("BLOQUEAR");
    expect(
      avaliar({
        last_run_status: "PARTIAL",
        last_run_finished_at: "2026-10-22 10:00:00",
      }),
    ).toBe("BLOQUEAR");
  });

  it("SUCCESS/NO_CHANGES seguem; ERROR/BLOCKED bloqueiam; RUNNING aguarda", () => {
    expect(avaliar({ last_run_status: "SUCCESS" })).toBe("SEGUIR");
    expect(avaliar({ last_run_status: "no_changes" })).toBe("SEGUIR");
    expect(avaliar({ last_run_status: "ERROR" })).toBe("BLOQUEAR");
    expect(avaliar({ last_run_status: "BLOCKED" })).toBe("BLOQUEAR");
    expect(avaliar({ last_run_status: "RUNNING" })).toBe("AGUARDAR");
    expect(avaliar({})).toBe("AGUARDAR");
  });

  it("Atualizar base grava PARTIAL só com a FATO promovida e last_success_at junto", () => {
    expect(BASE_PROJETOS).toMatch(
      /last_run_status: blockedPromotion \? 'BLOCKED' : \(erroCount \? 'PARTIAL' : 'SUCCESS'\),\n\s+last_run_mode: syncMode,\n\s+last_run_finished_at: new Date\(\),\n\s+last_success_at: \(!blockedPromotion && promoted\) \? new Date\(\) : '',/,
    );
  });
});

describe("incremental já processado no banco conclui antes de comparar a planilha", () => {
  it.each(PLANILHAS)(
    "%s: planilha mudou depois do envio e o sync está 'processado': conclui e limpa (antes: travava)",
    (p) => {
      const chamadas = [];
      const UrlFetchApp = {
        fetch(url, opcoes) {
          const caminho = url.replace(/^https:\/\/[^/]+/, "");
          chamadas.push(caminho);
          const corpo = (c) => ({
            getResponseCode: () => 200,
            getContentText: () => JSON.stringify(c),
          });
          if (caminho.startsWith("/rest/v1/TL_SYNC_ANALISE"))
            return corpo([
              { sync_id: "s-ok", status: "processado", resultado: {} },
            ]);
          if (caminho.endsWith("/rpc/verificar_sync_analises_incremental"))
            return corpo({ ok: true });
          throw new Error(`chamada inesperada: ${caminho}`);
        },
      };
      const linha = (p) => ({ linha_origem: 2, payload: p });
      const { ctx, props } = contexto(INCREMENTAL[p], {
        UrlFetchApp,
        obterConfiguracaoSupabaseAnalises_: () => ({
          url: "https://banco.exemplo",
          key: "k",
          jwt: false,
        }),
        readSheetObjectsForAnalises_: (_aba, nome) => ({
          rows:
            nome === "DIM_EDITAIS"
              ? [linha({ grupo: "G", unidade: "U", edital: "1", ativo: "SIM" })]
              : [linha({ grupo: "G", unidade: "U", edital: "1", id: 9 })],
        }),
        buildHashPayloadAnalises_: (x) => x,
        hashTextAnalises_: (t) => `h${t.length}`,
        SpreadsheetApp: {
          getActiveSpreadsheet: () => ({ getSheetByName: (n) => ({ n }) }),
        },
      });
      const agora = new Date().toISOString();
      props.set(
        "ANALISES_SYNC_INCREMENTAL_CLIENT_V1",
        JSON.stringify({
          sync_id: "s-ok",
          phase: "CONFIRMING",
          prepared: true,
          remote_started: true,
          snapshot_hash: "hash-de-antes",
          total_ativos_local: 1,
          created_at: agora,
          progress_at: agora,
        }),
      );
      const r = ctx.retomarSyncAnalisesCurricularesIncremental();
      expect(r).toMatchObject({
        ok: true,
        sync_id: "s-ok",
        status: "processado",
      });
      expect(props.has("ANALISES_SYNC_INCREMENTAL_CLIENT_V1")).toBe(false);
      // O hash guardado é o do envio: com a planilha mudada, o próximo ciclo envia.
      expect(
        JSON.parse(props.get("ANALISES_SYNC_INCREMENTAL_ULTIMO_V1")).hash,
      ).toBe("hash-de-antes");
    },
  );
});

describe("as três cópias seguem iguais onde devem", () => {
  const semOrigens = (texto) =>
    texto
      .split("\n")
      .filter(
        (l) =>
          !/^ \* PLANILHA /.test(l) && !/^\s+ORIGE(M|NS_PLANILHA): /.test(l),
      )
      .join("\n");

  it("2-sincronizar FULL: SEDE igual a Projetos, menos cabeçalho e origens", () => {
    expect(semOrigens(FULL.sede)).toBe(semOrigens(FULL.projetos));
  });

  it("2-sincronizar FULL: as funções desta correção são as mesmas na Saúde Indígena", () => {
    const funcao = (texto, nome) => {
      const i = texto.indexOf(`\nfunction ${nome}(`);
      expect(i, nome).toBeGreaterThan(-1);
      return texto.slice(i, texto.indexOf("\n}\n", i));
    };
    for (const nome of [
      "executarSyncAnalisesCurriculares_",
      "decidirEstadoLocalLotesAnalises_",
      "descartarEstadoLotesAnalises_",
      "mensagemSemUrlSupabaseAnalises_",
      "obterConfiguracaoSupabaseAnalises_",
      "configurarSupabaseAnalisesCurriculares",
      "verificarConfiguracaoSupabaseAnalisesCurriculares",
      "toIsoDateAnalises_",
      "toIsoTimestampAnalises_",
      "coerceDateAnalises_",
    ])
      expect(funcao(FULL["saude-indigena"], nome)).toBe(
        funcao(FULL.projetos, nome),
      );
  });
});
