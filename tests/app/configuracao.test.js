import { beforeEach, describe, expect, it, vi } from "vitest";
import { criarConfiguracao, PADROES } from "../../src/app/configuracao.js";

/*
  A configuração do sistema (src/app/configuracao.js): carrega
  TB_CONFIGURACAO, aplica os textos do app e o aviso global, e repassa à
  sessão, à marca da tela de acesso e às seções de Configurações.
*/

function montar({ linhas = [], erro = null } = {}) {
  document.body.className = "config-loading";
  document.body.innerHTML = `
    <span id="sidebarVersion"></span>
    <h1 id="pageTitle"></h1>
    <span id="externalBackText"></span>
    <button id="externalBackBtn"></button>
    <div id="externalMount" class="external-placeholder"></div>
    <div id="broadcastBar" hidden></div>`;
  const consulta = vi.fn(() =>
    Promise.resolve({ data: erro ? null : linhas, error: erro }),
  );
  const cliente = {
    from: vi.fn(() => ({ select: consulta })),
  };
  const sessao = { definirConfiguracao: vi.fn() };
  const definirMarca = vi.fn();
  const estado = { definirValoresCarregados: vi.fn() };
  const avisar = vi.fn();
  const configuracao = criarConfiguracao({
    cliente: () => cliente,
    avisar,
    sessao,
    definirMarca,
    estado,
  });
  return { configuracao, cliente, sessao, definirMarca, estado, avisar };
}

const $ = (id) => document.getElementById(id);

beforeEach(() => {
  document.title = "MONITORA";
});

describe("valores", () => {
  it("chave que não veio do banco vale o padrão; a que veio, o valor (mesmo vazio)", async () => {
    const { configuracao } = montar({
      linhas: [
        { chave: "external_back_text", valor: "" },
        { chave: "access_heartbeat_minutos", valor: "9" },
        { chave: "feature_realtime_monitoramento", valor: "não" },
      ],
    });
    expect(configuracao.valor("external_back_text")).toBe(
      PADROES.external_back_text,
    );
    await configuracao.carregar();
    expect(configuracao.valor("external_back_text")).toBe("");
    expect(configuracao.inteiro("access_heartbeat_minutos", 5)).toBe(9);
    expect(configuracao.booleano("feature_realtime_monitoramento", true)).toBe(
      false,
    );
    expect(configuracao.booleano("chave_sem_valor", true)).toBe(true);
  });
});

describe("carregar", () => {
  it("aplica os textos, repassa à sessão, à marca e às Configurações", async () => {
    const { configuracao, sessao, definirMarca, estado } = montar({
      linhas: [
        { chave: "app_version_current", valor: "V3" },
        { chave: "page_title", valor: "Visão geral" },
        { chave: "external_placeholder", valor: "Escolha um painel" },
      ],
    });
    await expect(configuracao.carregar()).resolves.toBe(true);
    expect($("sidebarVersion").textContent).toBe("V3");
    expect(configuracao.versao()).toBe("V3");
    expect($("pageTitle").textContent).toBe("Visão geral");
    expect($("externalMount").textContent).toBe("Escolha um painel");
    expect($("externalBackText").textContent).toBe("Voltar ao sistema");
    expect($("externalBackBtn").getAttribute("aria-label")).toBe(
      "Voltar ao sistema",
    );
    expect(sessao.definirConfiguracao).toHaveBeenCalledWith(
      expect.objectContaining({ page_title: "Visão geral" }),
    );
    expect(definirMarca).toHaveBeenCalledWith(
      expect.objectContaining({ carregou: true }),
    );
    expect(estado.definirValoresCarregados).toHaveBeenCalled();
    expect(document.body.classList.contains("config-loading")).toBe(false);
    // O nome da aba não é a versão publicada.
    expect(document.title).not.toContain("V3");
  });

  it("usa a consulta já disparada (entrada em paralelo)", async () => {
    const { configuracao, cliente } = montar();
    await configuracao.carregar({
      consulta: Promise.resolve({
        data: [{ chave: "page_title", valor: "Da cópia" }],
        error: null,
      }),
    });
    expect(cliente.from).not.toHaveBeenCalled();
    expect(configuracao.valor("page_title")).toBe("Da cópia");
  });

  it("erro: avisa (salvo silent), aplica os padrões e tira o config-loading", async () => {
    const { configuracao, avisar, definirMarca } = montar({
      erro: { message: "fora do ar" },
    });
    await expect(configuracao.carregar()).resolves.toBe(false);
    expect(avisar).toHaveBeenCalledWith(
      "Erro ao carregar configurações: fora do ar",
      "error",
    );
    expect(definirMarca).toHaveBeenCalledWith(
      expect.objectContaining({ carregou: false }),
    );
    expect(document.body.classList.contains("config-loading")).toBe(false);
    avisar.mockClear();
    await configuracao.carregar({ silent: true });
    expect(avisar).not.toHaveBeenCalled();
  });
});

describe("aviso global", () => {
  it("aparece com a mensagem do banco, como texto", async () => {
    const { configuracao } = montar({
      linhas: [
        { chave: "broadcast_msg", valor: "<b>Manutenção</b> às 18h" },
        { chave: "broadcast_type", valor: "warning" },
      ],
    });
    await configuracao.carregar();
    const barra = $("broadcastBar");
    expect(barra.hidden).toBe(false);
    expect(barra.textContent).toBe("<b>Manutenção</b> às 18h");
    expect(barra.querySelector("b")).toBeNull();
  });

  it("sem mensagem, fica escondido", async () => {
    const { configuracao } = montar();
    await configuracao.carregar();
    expect($("broadcastBar").hidden).toBe(true);
  });
});

describe("fundo da tela de acesso gravado em Aparência", () => {
  it("vale na hora, sem esperar a próxima carga", async () => {
    const { configuracao, definirMarca } = montar();
    await configuracao.carregar();
    const parar = configuracao.acompanharFundoDoAcesso();
    document.dispatchEvent(
      new CustomEvent("agsus:fundo-do-acesso-definido", {
        detail: { url: "https://x/fundo.webp", caminho: "fundo.webp" },
      }),
    );
    expect(configuracao.valor("auth_access_background_url")).toBe(
      "https://x/fundo.webp",
    );
    expect(definirMarca).toHaveBeenLastCalledWith(
      expect.objectContaining({
        valores: expect.objectContaining({
          auth_access_background_path: "fundo.webp",
        }),
      }),
    );
    parar();
  });
});
