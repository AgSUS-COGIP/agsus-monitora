import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  Publicação das Configurações (config-governance.js, que absorveu
  config-page-enhancements.js). Pedidos de 29/09:
  - na seção Acessos, a barra fixa e o Ctrl+S não publicam Configurações;
  - "não salvo" só vale para campos de configuração ([id^=cfg], painéis);
  - falha de rede: mensagem clara e botões de volta (publicar, histórico,
    restaurar);
  - o card "Histórico de configurações" fica visível na seção Operação;
  - a revisão lê `configuracoes` do snapshot e, sem mudança, não acusa nada.
*/

const cliente = { rpc: vi.fn() };
vi.mock("../src/lib/supabaseClient.js", () => ({
  getSupabaseClient: () => cliente,
}));

const SEM_SERVIDOR =
  "Não foi possível falar com o servidor. Verifique a conexão e tente de novo.";

// Valores que a tela manda quando os campos não estão no DOM (FIELD_MAP).
const PADROES = {
  auth_google_enabled: "true",
  auth_access_texto_modo: "auto",
  broadcast_type: "info",
  feature_realtime_monitoramento: "true",
  access_heartbeat_minutos: "5",
  page_title: "Saúde Indígena",
};
const snapshotIgual = () => ({
  configuracoes: Object.entries(PADROES).map(([chave, valor]) => ({
    chave,
    valor,
  })),
  paineis: [],
});

let governanca;
async function montar({ secao = "marca" } = {}) {
  document.body.innerHTML = `
    <section id="page-config" class="page active">
      <div class="admin-grid">
        <div id="accessRequestsAdminCard" class="admin-card card full">
          <div id="acessosApp" class="full" data-acessos>
            <input id="buscaDeAcessos" type="search" />
            <select id="nivelDeAcesso"><option>Leitor</option><option>Editor</option></select>
          </div>
        </div>
        <div class="admin-card card config-main-card"><div class="form-grid">
          <div class="form-row"><label>Título</label><input id="cfgPageTitle" value="Saúde Indígena" /></div>
          <div class="form-row"><label>Outro</label><input id="campoSolto" /></div>
          <div class="form-row"><label>Monitoramento</label><input id="cfgMonitId" value="" /></div>
        </div></div>
      </div>
    </section>`;
  vi.resetModules();
  const secoes = await import("../src/modules/config-secoes.js");
  secoes.organizarConfiguracoesEmSecoes(document);
  document.getElementById("page-config").dataset.subgrupo = secao;
  governanca = await import("../src/modules/config-governance.js");
  governanca.initConfigGovernance();
  await vi.waitFor(() =>
    expect(
      document.getElementById("configHistoryBody").textContent,
    ).not.toContain("Carregando"),
  );
}

const digitar = (id, valor) => {
  const campo = document.getElementById(id);
  campo.value = valor;
  campo.dispatchEvent(new Event("input", { bubbles: true }));
};
const sujo = () => !document.getElementById("configWorkspaceDirtyTop").hidden;
const ctrlS = () =>
  document.dispatchEvent(
    new KeyboardEvent("keydown", { key: "s", ctrlKey: true, bubbles: true }),
  );

beforeEach(() => {
  cliente.rpc.mockReset();
  cliente.rpc.mockImplementation(async (nome) => ({
    data: nome === "get_configuracoes_historico" ? [] : snapshotIgual(),
    error: null,
  }));
  vi.spyOn(window, "alert").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("controle de 'não salvo'", () => {
  it("só campos de configuração marcam a página", async () => {
    await montar();
    digitar("buscaDeAcessos", "ana");
    document
      .getElementById("nivelDeAcesso")
      .dispatchEvent(new Event("change", { bubbles: true }));
    digitar("campoSolto", "x");
    expect(sujo()).toBe(false);
    expect(document.getElementById("configStickySaveButton").disabled).toBe(
      true,
    );
    digitar("cfgPageTitle", "Novo título");
    expect(sujo()).toBe(true);
    expect(document.getElementById("configStickySaveButton").disabled).toBe(
      false,
    );
  });

  it("sair com alteração pergunta; recusado, fica; aceito, descarta", async () => {
    await montar();
    expect(governanca.confirmarSaidaDasConfiguracoes(() => false)).toBe(true);
    digitar("cfgPageTitle", "Outro");
    expect(governanca.confirmarSaidaDasConfiguracoes(() => false)).toBe(false);
    expect(sujo()).toBe(true);
    expect(governanca.confirmarSaidaDasConfiguracoes(() => true)).toBe(true);
    expect(sujo()).toBe(false);
  });
});

describe("seção Acessos", () => {
  it("a barra fixa some e o Ctrl+S não publica Configurações", async () => {
    await montar({ secao: "acessos" });
    expect(document.getElementById("configStickyActions").hidden).toBe(true);
    digitar("cfgPageTitle", "Mudou em outra seção");
    cliente.rpc.mockClear();
    ctrlS();
    await Promise.resolve();
    expect(cliente.rpc).not.toHaveBeenCalled();
    expect(document.getElementById("configGovernanceModal").hidden).toBe(true);
  });

  it("fora de Acessos, o Ctrl+S abre a revisão", async () => {
    await montar();
    expect(document.getElementById("configStickyActions").hidden).toBe(false);
    digitar("cfgPageTitle", "Título novo");
    ctrlS();
    await vi.waitFor(() =>
      expect(document.getElementById("configGovernanceTitle").textContent).toBe(
        "Revisar publicação",
      ),
    );
  });
});

describe("revisão da publicação", () => {
  it("sem mudança real, nada a publicar (lê `configuracoes` do snapshot)", async () => {
    await montar();
    await governanca.reviewAndPublish();
    expect(document.getElementById("configGovernanceTitle").textContent).toBe(
      "Nenhuma alteração",
    );
  });

  it("uma mudança aparece sozinha, com o valor de antes", async () => {
    await montar();
    digitar("cfgPageTitle", "Título novo");
    await governanca.reviewAndPublish();
    const linhas = document.querySelectorAll(".config-change-row");
    expect(linhas).toHaveLength(1);
    expect(linhas[0].textContent).toContain("Saúde Indígena");
    expect(linhas[0].textContent).toContain("Título novo");
  });
});

describe("falha de rede", () => {
  it("ao preparar: mensagem clara e o botão volta a 'Salvar alterações'", async () => {
    await montar();
    digitar("cfgPageTitle", "Título novo");
    cliente.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    await governanca.reviewAndPublish();
    expect(
      document.getElementById("configGovernanceBody").textContent,
    ).toContain(SEM_SERVIDOR);
    const salvar = document.getElementById("configStickySaveButton");
    expect(salvar.textContent).toContain("Salvar alterações");
    expect(salvar.disabled).toBe(false);
  });

  it("ao publicar: erro no modal e 'Tentar novamente' habilitado", async () => {
    await montar();
    digitar("cfgPageTitle", "Título novo");
    await governanca.reviewAndPublish();
    cliente.rpc.mockResolvedValue({
      data: null,
      error: { message: "TypeError: Failed to fetch" },
    });
    document.getElementById("configPublishReason").value = "Ajuste";
    document.getElementById("configConfirmPublish").click();
    await vi.waitFor(() =>
      expect(
        document.getElementById("configGovernanceBody").textContent,
      ).toContain(SEM_SERVIDOR),
    );
    const botao = document.getElementById("configConfirmPublish");
    expect(botao.disabled).toBe(false);
    expect(botao.textContent).toContain("Tentar novamente");
    expect(sujo()).toBe(true);
  });

  it("histórico e restauração: mensagem clara, sem 'Carregando…' nem botão preso", async () => {
    cliente.rpc.mockImplementation(async (nome) =>
      nome === "get_configuracoes_historico"
        ? {
            data: [
              {
                id: "v1",
                acao: "salvar",
                motivo: "m",
                alteracoes: [],
                total_alteracoes: 1,
              },
            ],
            error: null,
          }
        : { data: snapshotIgual(), error: null },
    );
    await montar();
    vi.spyOn(window, "confirm").mockReturnValue(true);
    cliente.rpc.mockRejectedValue(new TypeError("Failed to fetch"));
    document.querySelector(".config-history-restore").click();
    document.getElementById("configRestoreReason").value = "Voltar";
    document.getElementById("configConfirmRestore").click();
    await vi.waitFor(() =>
      expect(
        document.getElementById("configGovernanceBody").textContent,
      ).toContain(SEM_SERVIDOR),
    );
    expect(document.getElementById("configConfirmRestore").disabled).toBe(
      false,
    );

    document.getElementById("configHistoryRefresh").click();
    await vi.waitFor(() =>
      expect(
        document.getElementById("configHistoryBody").textContent,
      ).toContain(SEM_SERVIDOR),
    );
  });
});

describe("histórico de configurações", () => {
  it("fica na seção Operação, fora da grade antiga escondida", async () => {
    await montar();
    const cartao = document.getElementById("configHistoryCard");
    expect(cartao.closest('.config-secao[data-secao="operacao"]')).toBeTruthy();
    expect(cartao.closest(".admin-grid")).toBeNull();
  });
});
