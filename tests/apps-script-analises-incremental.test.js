import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/*
  Apps Script das análises (apps-script/<planilha>/3-analises-incremental.gs e
  4-orquestrador-fato-supabase.gs): o sync incremental não fica preso.

  Incidente de 06–07/10/2026: o sync guardado na propriedade
  ANALISES_SYNC_INCREMENTAL_CLIENT_V1 ficou em 'erro' no banco e o cliente
  repetia "Status remoto nao permite retomada: erro" a cada gatilho, até alguém
  apagar a propriedade à mão. Os .gs não têm módulo: o arquivo roda num
  contexto do node:vm com dublês mínimos do Apps Script (PropertiesService,
  UrlFetchApp…) e dos auxiliares do sync FULL, que ficam em outro arquivo.
*/
const ler = (arquivo) => readFileSync(arquivo, "utf8").replace(/\r\n/g, "\n");
const PLANILHAS = ["saude-indigena", "projetos", "sede"];
const INCREMENTAL = Object.fromEntries(
  PLANILHAS.map((p) => [p, ler(`apps-script/${p}/3-analises-incremental.gs`)]),
);
const ORQUESTRADOR = Object.fromEntries(
  PLANILHAS.map((p) => [
    p,
    ler(`apps-script/${p}/4-orquestrador-fato-supabase.gs`),
  ]),
);
const MIN = 60 * 1000;

function contexto(codigo, extra = {}) {
  const props = new Map();
  const logs = [];
  const ctx = vm.createContext({
    Logger: { log: (m) => logs.push(String(m)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    LockService: {
      getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }),
    },
    ScriptApp: {
      getProjectTriggers: () => [],
      deleteTrigger: () => {},
      newTrigger: () => ({
        timeBased: () => ({ after: () => ({ create: () => {} }) }),
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
  return { ctx, props, logs };
}

/* O que muda entre as planilhas: o cabeçalho e as origens. */
const semOrigens = (texto) =>
  texto
    .split("\n")
    .filter(
      (l) =>
        !/^ \* (PLANILHA |Sincronizacao incremental|Mesmo codigo)/.test(l) &&
        !/^\s+ORIGE(M|NS_PLANILHA): /.test(l),
    )
    .join("\n");

describe("as três planilhas têm o mesmo incremental e o mesmo orquestrador", () => {
  it("3-analises-incremental.gs só muda no cabeçalho e nas origens", () => {
    expect(semOrigens(INCREMENTAL.projetos)).toBe(
      semOrigens(INCREMENTAL["saude-indigena"]),
    );
    expect(semOrigens(INCREMENTAL.sede)).toBe(
      semOrigens(INCREMENTAL["saude-indigena"]),
    );
  });

  it("4-orquestrador: SEDE igual a Projetos; a SI sem a processarLoteSincronizacaoAnalises pública", () => {
    const corpo = (t) => t.slice(t.indexOf("const FATO_SUPABASE_ORQ_CFG"));
    expect(corpo(ORQUESTRADOR.sede)).toBe(corpo(ORQUESTRADOR.projetos));
    expect(ORQUESTRADOR["saude-indigena"]).not.toMatch(
      /function processarLoteSincronizacaoAnalises\(/,
    );
    expect(
      corpo(ORQUESTRADOR.projetos).replace(
        /\/\*\*\n \* Handler PUBLICO[\s\S]*?\n}\n\n/,
        "",
      ),
    ).toBe(corpo(ORQUESTRADOR["saude-indigena"]));
  });

  it("os nomes que os acionadores chamam continuam existindo", () => {
    for (const p of PLANILHAS) {
      for (const nome of [
        "syncAnalisesCurricularesIncremental",
        "retomarSyncAnalisesCurricularesIncremental",
        "continuarSyncAnalisesCurricularesIncremental",
        "limparEstadoLocalAnalisesIncremental",
      ])
        expect(INCREMENTAL[p]).toContain(`function ${nome}(`);
      expect(ORQUESTRADOR[p]).toContain(
        "function orquestrarFatoESupabaseAgendado(",
      );
    }
  });
});

describe("retomar ou descartar o sync guardado (decidirRetomadaAnalisesIncremental_)", () => {
  const { ctx } = contexto(INCREMENTAL["saude-indigena"]);
  const decidir = (estado, remoto, agora) =>
    ctx.decidirRetomadaAnalisesIncremental_(estado, remoto, agora);
  const AGORA = Date.parse("2026-10-07T12:00:00Z");
  const ha = (min) => new Date(AGORA - min * MIN).toISOString();
  const estado = (extra = {}) => ({
    sync_id: "s1",
    phase: "COMPARING",
    remote_started: true,
    created_at: ha(120),
    progress_at: ha(2),
    ...extra,
  });

  it("o incidente: status 'erro' no banco descarta (antes travava)", () => {
    expect(decidir(estado(), { status: "erro" }, AGORA)).toEqual({
      acao: "DESCARTAR",
      motivo: "Status remoto nao permite retomada: erro",
    });
  });

  it("sync que sumiu do banco depois de iniciado também descarta", () => {
    expect(decidir(estado(), null, AGORA).acao).toBe("DESCARTAR");
  });

  it("ainda não iniciado no banco: inicia com o mesmo sync_id", () => {
    expect(decidir(estado({ remote_started: false }), null, AGORA).acao).toBe(
      "INICIAR",
    );
  });

  it("carregado/processando com progresso recente: retoma", () => {
    expect(decidir(estado(), { status: "carregado" }, AGORA).acao).toBe(
      "RETOMAR",
    );
    expect(
      decidir(estado({ progress_at: ha(29) }), { status: "processando" }, AGORA)
        .acao,
    ).toBe("RETOMAR");
  });

  it("processado: retoma para concluir, mesmo sem progresso recente", () => {
    expect(
      decidir(estado({ progress_at: ha(300) }), { status: "processado" }, AGORA)
        .acao,
    ).toBe("RETOMAR");
  });

  it("mais de 30 min sem progresso local descarta, mesmo com o banco aceitando", () => {
    const r = decidir(
      estado({ progress_at: ha(31) }),
      { status: "carregado" },
      AGORA,
    );
    expect(r.acao).toBe("DESCARTAR");
    expect(r.motivo).toContain("Sem progresso local ha mais de 30 min");
  });

  it("estado antigo, sem progress_at, usa created_at (a propriedade do incidente)", () => {
    const antigo = estado({ created_at: ha(16 * 60) });
    delete antigo.progress_at;
    expect(decidir(antigo, { status: "carregado" }, AGORA).acao).toBe(
      "DESCARTAR",
    );
  });

  it("pendente remoto sem estado local: parado só depois de 30 min sem sinal no log", () => {
    const parado = (remoto) =>
      ctx.pendenteRemotoParadoAnalisesIncremental_(remoto, AGORA);
    expect(parado({ updated_at: ha(31), created_at: ha(60) })).toBe(true);
    expect(parado({ updated_at: ha(5), created_at: ha(60) })).toBe(false);
    expect(parado(null)).toBe(false);
  });
});

/* Banco falso: o que o cliente consulta e chama pelo REST. */
function bancoFalso(syncs) {
  const chamadas = [];
  const resposta = (corpo, codigo = 200) => ({
    getResponseCode: () => codigo,
    getContentText: () => (corpo === undefined ? "" : JSON.stringify(corpo)),
  });
  const UrlFetchApp = {
    fetch(url, opcoes) {
      const caminho = url.replace("https://banco", "");
      const corpo = opcoes.payload ? JSON.parse(opcoes.payload) : undefined;
      chamadas.push({ caminho, metodo: opcoes.method, corpo });
      const rpc = caminho.match(/^\/rest\/v1\/rpc\/(\w+)/)?.[1];
      if (caminho.startsWith("/rest/v1/TL_SYNC_ANALISE")) {
        const id = decodeURIComponent(
          caminho.match(/sync_id=eq\.([^&]+)/)?.[1] || "",
        );
        if (!id) return resposta([]); // nenhum pendente da planilha
        return resposta(
          syncs.has(id) ? [{ sync_id: id, ...syncs.get(id) }] : [],
        );
      }
      if (caminho.startsWith("/rest/v1/TM_ANALISE_CURRICULAR"))
        return resposta(undefined, 201);
      if (rpc === "iniciar_sync_analises_incremental") {
        syncs.set(corpo.p_sync_id, { status: "carregado", resultado: {} });
        return resposta({
          ok: true,
          sync_id: corpo.p_sync_id,
          status: "carregado",
        });
      }
      if (rpc === "comparar_analises_incremental_v2")
        return resposta({ ok: true, linhas_alteradas: [2] });
      if (rpc === "preparar_sync_analises_incremental")
        return resposta({ ok: true, sync_id: corpo.p_sync_id });
      if (rpc === "processar_sync_analises_incremental_lote")
        return resposta({
          ok: true,
          sync_id: corpo.p_sync_id,
          concluido_fato: true,
          cursor: 1,
        });
      if (rpc === "finalizar_sync_analises_incremental") {
        syncs.set(corpo.p_sync_id, { status: "processado", resultado: {} });
        return resposta({ ok: true, sync_id: corpo.p_sync_id });
      }
      if (rpc === "verificar_sync_analises_incremental")
        return resposta({ ok: true });
      throw new Error(`chamada inesperada: ${caminho}`);
    },
  };
  return { UrlFetchApp, chamadas };
}

/* Auxiliares do sync FULL (2-sincronizar-com-supabase-full.gs) e a planilha. */
const AUXILIARES_DO_FULL = {
  obterConfiguracaoSupabaseAnalises_: () => ({
    url: "https://banco",
    key: "k",
    jwt: false,
  }),
  readSheetObjectsForAnalises_: (_aba, nome) => ({
    rows:
      nome === "DIM_EDITAIS"
        ? [
            {
              linha_origem: 2,
              payload: {
                grupo: "Saúde Indígena",
                unidade: "DSEI",
                edital: "1/2026",
                ativo: "SIM",
              },
            },
          ]
        : [
            {
              linha_origem: 2,
              payload: {
                grupo: "Saúde Indígena",
                unidade: "DSEI",
                edital: "1/2026",
                id: 7,
                candidato: "Fulano",
              },
            },
          ],
  }),
  buildHashPayloadAnalises_: (p) => p,
  hashTextAnalises_: (t) => `h${t.length}`,
  SpreadsheetApp: {
    getActiveSpreadsheet: () => ({ getSheetByName: (n) => ({ nome: n }) }),
  },
};

describe("o incidente de 06/10, ponta a ponta no cliente", () => {
  it("sync guardado em 'erro': descarta, começa outro e conclui na mesma execução", () => {
    const syncs = new Map([["51a31446-velho", { status: "erro" }]]);
    const { UrlFetchApp, chamadas } = bancoFalso(syncs);
    const { ctx, props, logs } = contexto(INCREMENTAL["saude-indigena"], {
      UrlFetchApp,
      ...AUXILIARES_DO_FULL,
    });
    props.set(
      "ANALISES_SYNC_INCREMENTAL_CLIENT_V1",
      JSON.stringify({
        sync_id: "51a31446-velho",
        phase: "COMPARING",
        remote_started: true,
        compare_index: 0,
        created_at: "2026-10-06T19:36:55Z",
      }),
    );

    // O orquestrador chama a retomada (resumeOnly): antes, devolvia pending para sempre.
    const r = ctx.retomarSyncAnalisesCurricularesIncremental();

    expect(r).toMatchObject({
      ok: true,
      sync_id: "novo-1",
      status: "processado",
    });
    expect(props.has("ANALISES_SYNC_INCREMENTAL_CLIENT_V1")).toBe(false);
    expect(logs.join("\n")).toContain(
      "estado local do sync 51a31446-velho (fase COMPARING) descartado: Status remoto nao permite retomada: erro",
    );
    const iniciar = chamadas.find((c) =>
      c.caminho.endsWith("/rpc/iniciar_sync_analises_incremental"),
    );
    expect(iniciar.corpo).toEqual({
      p_sync_id: "novo-1",
      p_origem: "apps_script_analises_incremental_v1",
    });
    // Nada do sync velho foi chamado nem apagado no banco.
    expect(
      chamadas.some(
        (c) =>
          c.metodo !== "GET" && JSON.stringify(c).includes("51a31446-velho"),
      ),
    ).toBe(false);
  });

  it("sync guardado ainda ativo e com progresso: segue o mesmo, sem descartar", () => {
    const syncs = new Map([
      ["s-ativo", { status: "carregado", resultado: {} }],
    ]);
    const { UrlFetchApp, chamadas } = bancoFalso(syncs);
    const { ctx, props } = contexto(INCREMENTAL.projetos, {
      UrlFetchApp,
      ...AUXILIARES_DO_FULL,
    });
    const agora = new Date().toISOString();
    props.set(
      "ANALISES_SYNC_INCREMENTAL_CLIENT_V1",
      JSON.stringify({
        sync_id: "s-ativo",
        phase: "COMPARING",
        remote_started: true,
        compare_index: 0,
        created_at: agora,
        progress_at: agora,
      }),
    );
    const r = ctx.continuarSyncAnalisesCurricularesIncremental();
    expect(r).toMatchObject({ ok: true, sync_id: "s-ativo" });
    expect(
      chamadas.some((c) =>
        c.caminho.endsWith("/rpc/iniciar_sync_analises_incremental"),
      ),
    ).toBe(false);
  });
});

describe("orquestrador: não espera retomada impossível", () => {
  const orquestrador = (incremental) =>
    contexto(ORQUESTRADOR.projetos, {
      consultarSyncAnalisesIncremental_: () => ({ status: "erro" }),
      retomarSyncAnalisesCurricularesIncremental: () => ({
        ok: false,
        idle: true,
      }),
      syncAnalisesCurricularesIncremental: incremental,
      limparContinuacoesAnalisesIncremental_: () => {},
    });

  it("sync do ciclo em 'erro' e sem estado local: começa um novo na hora", () => {
    let chamou = 0;
    const { ctx } = orquestrador(() => {
      chamou += 1;
      return { ok: true, status: "processado", sync_id: "novo" };
    });
    const r = ctx.acompanharIncrementalFatoSupabase_({
      cycle_id: "c1",
      phase: "WAIT_INCREMENTAL",
      supabase_sync_id: "velho",
    });
    expect(chamou).toBe(1);
    expect(r).toMatchObject({
      ok: true,
      sync_id: "novo",
      supabase_status: "processado",
    });
  });

  it("FATO que já gastou mais de 20 min: o incremental fica para a próxima verificação", () => {
    let chamou = 0;
    const { ctx } = orquestrador(() => {
      chamou += 1;
      return { ok: true, status: "processado" };
    });
    vm.runInContext(
      "INICIO_EXECUCAO_ORQ_MS_ = Date.now() - 25 * 60 * 1000;",
      ctx,
    );
    const r = ctx.iniciarOuRetomarIncrementalFatoSupabase_(
      { cycle_id: "c2", phase: "WAIT_INCREMENTAL" },
      false,
    );
    expect(chamou).toBe(0);
    expect(r).toMatchObject({ pending: true, phase: "WAIT_INCREMENTAL" });
    expect(r.motivo).toContain("o incremental comeca na proxima verificacao");
  });
});

describe("leitura lenta da planilha não trava o sync (07/10/2026)", () => {
  it.each(PLANILHAS)(
    "%s: depois de ler a planilha sobra prazo e o primeiro lote sempre sai",
    (p) => {
      const s = INCREMENTAL[p];
      expect(s).toMatch(/MIN_WORK_MS: 4 \* 60 \* 1000/);
      expect(s).toMatch(
        /const snapshot = montarSnapshotAnalisesIncremental_\(\);\n\s+deadline = Math\.max\(deadline, Date\.now\(\) \+ ANALISES_INCREMENTAL_CFG\.MIN_WORK_MS\)/,
      );
      expect(s).toMatch(
        /if \(lotesNestaExecucao > 0 && Date\.now\(\) >= deadline/,
      );
      expect(s).toMatch(
        /while \(lotesProcessados === 0 \|\| Date\.now\(\) < deadline/,
      );
    },
  );
  it.each(PLANILHAS)(
    "%s: o orquestrador deixa o incremental para depois com 15 min de FATO",
    (p) => {
      expect(ORQUESTRADOR[p]).toMatch(
        /MAX_ELAPSED_BEFORE_INCREMENTAL_MS: 15 \* 60 \* 1000/,
      );
    },
  );
});
