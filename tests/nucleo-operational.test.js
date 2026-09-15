import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), auth: vi.fn() }));
vi.mock("../src/lib/supabaseClient.js", () => ({
  getSupabaseClient: () => ({
    rpc: mocks.rpc,
    auth: { onAuthStateChange: mocks.auth },
  }),
}));
vi.mock("../src/lib/sessao.js", () => ({
  exigirSessao: vi.fn(async () => ({ user: { id: "user" } })),
}));

const item = {
  id: "1",
  unidade: "DSEI",
  edital: "01",
  alerta_tipo: "incompleto",
  status: "Planejado",
};
const row =
  '<tr data-record-id="1"><td>DSEI</td><td>01</td><td>Planejado</td><td>Etapa</td><td></td></tr>';
const listeners = [];
let operational;

beforeEach(async () => {
  vi.resetModules();
  mocks.rpc.mockReset().mockResolvedValue({ data: [{ ...item }] });
  mocks.auth.mockReset();
  document.body.innerHTML = `<section id="page-nucleo" class="active"><table><tbody id="nucleoRows">${row}</tbody></table></section>`;
  const add = document.addEventListener.bind(document);
  vi.spyOn(document, "addEventListener").mockImplementation((...args) => {
    listeners.push(args);
    add(...args);
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((fn) => {
    queueMicrotask(fn);
    return 1;
  });
  operational = await import("../src/modules/nucleo-operational.js");
});
afterEach(() => {
  for (const args of listeners.splice(0)) document.removeEventListener(...args);
  vi.restoreAllMocks();
});

describe("Núcleo operacional", () => {
  it("resposta pendente após logout não repõe painel nem catálogo da sessão anterior", async () => {
    document.body.insertAdjacentHTML(
      "beforeend",
      '<div id="cronogramaEditor"><div class="cronograma-actions-box"></div></div>',
    );
    let complete;
    mocks.rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    operational.initNucleoOperationalSafe();
    const pending = operational.loadSummary();
    const { initNucleoCronogramaTools } =
      await import("../src/modules/nucleo-cronograma-tools.js");
    initNucleoCronogramaTools();
    document.dispatchEvent(
      new CustomEvent("agsus:nucleo-cronograma-loaded", {
        detail: { id: "other" },
      }),
    );
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    mocks.auth.mock.calls[0][0]("SIGNED_OUT", null);
    complete({ data: [{ ...item, cronograma_total: 3 }] });
    await pending;
    await Promise.resolve();
    expect(document.querySelector(".nucleo-row-alert")).toBeNull();
    expect(
      document.querySelectorAll("#cronogramaCopySource option"),
    ).toHaveLength(1);
    expect(document.getElementById("nucleoOperationalRefresh").disabled).toBe(
      false,
    );
    const { peekNucleoSummary } =
      await import("../src/modules/nucleo-summary-store.js");
    expect(peekNucleoSummary()).toBeNull();
  });

  it("usa ID para distinguir dois registros com o mesmo edital e unidade", async () => {
    mocks.rpc.mockResolvedValue({
      data: [item, { ...item, id: "2", alerta_tipo: "ok" }],
    });
    operational.initNucleoOperationalSafe();
    await operational.loadSummary();
    expect(document.querySelector(".nucleo-row-alert").textContent).toContain(
      "incompleto",
    );
    expect(
      document.querySelector("#nucleoRows tr").dataset.monitoramentoId,
    ).toBe("1");
  });

  it("catálogo e painel compartilham a RPC e SIGNED_IN inicial não duplica", async () => {
    let complete;
    mocks.rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    operational.initNucleoOperationalSafe();
    mocks.auth.mock.calls[0][0]("SIGNED_IN", { user: { id: "user" } });
    const { initNucleoCronogramaTools } =
      await import("../src/modules/nucleo-cronograma-tools.js");
    initNucleoCronogramaTools();
    document.dispatchEvent(
      new CustomEvent("agsus:nucleo-cronograma-loaded", {
        detail: { id: "1" },
      }),
    );
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    complete({ data: [item] });
    await operational.loadSummary();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(document.querySelector(".nucleo-row-alert")).not.toBeNull();
  });

  it("salvar durante carga só renderiza o resumo atualizado após recarga em série", async () => {
    let complete;
    mocks.rpc.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    operational.initNucleoOperationalSafe();
    const pending = operational.loadSummary();
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledTimes(1));
    document.dispatchEvent(new Event("agsus:nucleo-cronograma-saved"));
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    const fresh = operational.loadSummary();
    complete({ data: [{ ...item, alerta_tipo: "ok" }] });
    await pending;
    await fresh;
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".nucleo-row-alert").textContent).toContain(
      "incompleto",
    );
  });

  it("reutiliza carga simultânea e não agenda timers de decoração", async () => {
    const timer = vi.spyOn(window, "setTimeout");
    operational.initNucleoOperationalSafe();
    operational.initNucleoOperationalSafe();
    document.dispatchEvent(new Event("agsus:nucleo-rendered"));
    const pending = operational.loadSummary();
    expect(operational.loadSummary({ force: true })).toBe(pending);
    await pending;
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
    expect(timer).not.toHaveBeenCalled();
    expect(mocks.auth).toHaveBeenCalledTimes(1);
  });

  it("reabertura com cache não chama RPC nem recria KPIs, botões ou badges", async () => {
    operational.initNucleoOperationalSafe();
    await operational.loadSummary();
    const card = document.querySelector('[data-alert-filter="incompleto"]');
    const badge = document.querySelector(".nucleo-row-alert");
    const button = document.querySelector(".nucleo-view-timeline");
    await operational.loadSummary();
    expect(document.querySelector('[data-alert-filter="incompleto"]')).toBe(
      card,
    );
    expect(document.querySelector(".nucleo-row-alert")).toBe(badge);
    expect(document.querySelector(".nucleo-view-timeline")).toBe(button);
    expect(document.querySelectorAll(".nucleo-view-timeline")).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("decorra linhas substituídas pela busca e mantém filtro sem RPC", async () => {
    operational.initNucleoOperationalSafe();
    await operational.loadSummary();
    document.querySelector('[data-alert-filter="sem_cronograma"]').click();
    await Promise.resolve();
    expect(document.querySelector("#nucleoRows tr").hidden).toBe(true);
    document.getElementById("nucleoRows").innerHTML = row;
    document.dispatchEvent(new Event("agsus:nucleo-rendered"));
    await operational.loadSummary();
    expect(document.querySelector("#nucleoRows tr").hidden).toBe(true);
    document.getElementById("clearNucleoAlertFilter").click();
    await Promise.resolve();
    expect(document.querySelector("#nucleoRows tr").hidden).toBe(false);
    expect(document.querySelectorAll(".nucleo-view-timeline")).toHaveLength(1);
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("salvar invalida cache; alerta regular remove badge antigo", async () => {
    operational.initNucleoOperationalSafe();
    await operational.loadSummary();
    mocks.rpc.mockResolvedValue({ data: [{ ...item, alerta_tipo: "ok" }] });
    document.dispatchEvent(new Event("agsus:nucleo-cronograma-saved"));
    await operational.loadSummary();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
    expect(document.querySelector(".nucleo-row-alert")).toBeNull();
  });

  it("mudança de identidade limpa dados sem consultar auth dentro do callback", async () => {
    operational.initNucleoOperationalSafe();
    await operational.loadSummary();
    mocks.auth.mock.calls[0][0]("SIGNED_OUT", null);
    await Promise.resolve();
    expect(document.querySelector(".nucleo-row-alert")).toBeNull();
    expect(document.querySelector(".nucleo-view-timeline")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it("não carrega resumo no boot com outra tela ativa", () => {
    document.getElementById("page-nucleo").classList.remove("active");
    operational.initNucleoOperationalSafe();
    document.dispatchEvent(new Event("agsus:nucleo-rendered"));
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("recupera erro com atualização explícita", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.rpc.mockResolvedValueOnce({ error: new Error("rede indisponível") });
    operational.initNucleoOperationalSafe();
    await expect(operational.loadSummary()).rejects.toThrow(
      "rede indisponível",
    );
    expect(
      document.querySelector(".nucleo-summary-error").textContent,
    ).toContain("Não foi possível carregar os alertas");
    document.getElementById("nucleoOperationalRefresh").click();
    await operational.loadSummary();
    expect(document.querySelector(".nucleo-summary-error")).toBeNull();
    expect(mocks.rpc).toHaveBeenCalledTimes(2);
  });
});
