import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar, escolher, esperar } from "./interacoes.js";
import { criarEstadoDasMensagensDoChat } from "../../src/modulos/configuracoes/estado-das-mensagens-do-chat.js";
import { SecaoMensagensDoChat } from "../../src/modulos/configuracoes/mensagens-do-chat.jsx";

/*
  Configurações › Mensagens (chat), só administrador global: lê ao abrir a
  seção, mostra os números, calcula quantas mensagens o prazo apaga, pede
  confirmação antes de apagar, exige ZERAR e motivo para zerar e mostra o
  histórico. RPCs falsas (CR-n.m: docs/historias-de-usuario/chat.md).
*/

const LEITURA = {
  dias: null,
  atualizado_em: null,
  atualizado_por: null,
  gerado_em: "2026-10-05T12:00:00Z",
  mensagens: 120,
  reacoes: 7,
  conversas: 9,
  conversas_sem_participante: 2,
  mais_antiga: "2025-01-10T12:00:00Z",
  idades: [
    { dias: 20, mensagens: 10 },
    { dias: 40, mensagens: 3 },
    { dias: 400, mensagens: 5 },
  ],
  historico: [
    {
      id: "h1",
      tipo: "PRAZO",
      origem: "AGENDA",
      dias: 30,
      corte: "2026-09-05T06:15:00Z",
      mensagens: 4,
      reacoes: 1,
      conversas: 0,
      motivo: null,
      email: null,
      nome: null,
      em: "2026-10-04T06:15:00Z",
    },
  ],
};

let raiz;
let alvo;
afterEach(() => {
  act(() => raiz?.unmount());
  alvo?.remove();
  document.body.innerHTML = "";
});

const SECAO_ABERTA = { secao: "mensagens" };
const configuracoes = {
  assinar: () => () => {},
  obter: () => SECAO_ABERTA,
};

async function montar(respostas = {}) {
  const rpc = vi.fn(async (nome, argumentos) => {
    const r = respostas[nome] ?? (() => LEITURA);
    const data = await r(argumentos);
    if (data?.__erro) return { data: null, error: data.__erro };
    return { data, error: null };
  });
  const estado = criarEstadoDasMensagensDoChat({ supabase: { rpc } });
  alvo = document.createElement("div");
  document.body.appendChild(alvo);
  raiz = createRoot(alvo);
  await act(async () => {
    raiz.render(createElement(SecaoMensagensDoChat, { estado, configuracoes }));
  });
  await esperar(() => estado.obter().status === "ready");
  return { rpc, estado };
}

const botao = (texto) =>
  [...document.querySelectorAll("button")].find((b) =>
    b.textContent.includes(texto),
  );

describe("Configurações › Mensagens (chat)", () => {
  it("lê ao abrir e mostra números, prazo em vigor e o histórico", async () => {
    const { rpc } = await montar();
    expect(rpc).toHaveBeenCalledWith("obter_retencao_chat", undefined);
    const texto = alvo.textContent;
    expect(texto).toContain("120");
    expect(texto).toContain("10/01/2025");
    expect(texto).toContain("Em vigor: Guardar para sempre");
    expect(texto).toContain("Prazo de 30 dias (limpeza diária)");
    expect(texto).toContain("Tarefa diária");
  });

  it("CR-1.3/CR-1.4: prevê quantas o prazo apaga e confirma antes de salvar", async () => {
    const { rpc } = await montar({
      salvar_retencao_chat: () => ({ ...LEITURA, dias: 30, idades: [] }),
    });
    await escolher(document.getElementById("configChatPrazo"), "30");
    expect(alvo.querySelector("[data-previsao]").textContent).toBe(
      "8 mensagens serão apagadas ao salvar.",
    );
    await clicar(botao("Salvar prazo"));
    expect(alvo.textContent).toContain("Informe o motivo.");
    expect(rpc).not.toHaveBeenCalledWith(
      "salvar_retencao_chat",
      expect.anything(),
    );

    await digitar(document.getElementById("configChatMotivoPrazo"), "LGPD");
    await clicar(botao("Salvar prazo"));
    expect(document.body.textContent).toContain(
      "Isto apaga 8 mensagens com mais de 30 dias; não dá para desfazer.",
    );
    await clicar(botao("Apagar e salvar"));
    await esperar(() =>
      rpc.mock.calls.some(([nome]) => nome === "salvar_retencao_chat"),
    );
    expect(rpc).toHaveBeenCalledWith("salvar_retencao_chat", {
      p_dias: 30,
      p_motivo: "LGPD",
    });
    expect(alvo.textContent).toContain("Prazo salvo.");
    expect(alvo.textContent).toContain("Em vigor: 30 dias");
  });

  it("CR-1.2: valor livre fora de 7 a 3.650 dias não salva", async () => {
    const { rpc } = await montar();
    await escolher(document.getElementById("configChatPrazo"), "outro");
    await digitar(document.getElementById("configChatPrazoDias"), "5");
    expect(alvo.textContent).toContain("O prazo vai de 7 a 3.650 dias.");
    await digitar(document.getElementById("configChatMotivoPrazo"), "LGPD");
    await clicar(botao("Salvar prazo"));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("CR-2.1/CR-2.2: zerar mostra o que apaga e exige ZERAR e motivo", async () => {
    const { rpc } = await montar({
      zerar_mensagens_chat: () => ({
        ...LEITURA,
        mensagens: 0,
        reacoes: 0,
        idades: [],
      }),
    });
    await clicar(alvo.querySelector(".config-chat-opcao input"));
    await clicar(botao("Zerar mensagens…"));
    const corpo = document.body.textContent;
    expect(corpo).toContain("120 mensagens");
    expect(corpo).toContain("7 reações");
    expect(corpo).toContain("2 conversas sem participante ativo");

    const confirmar = () =>
      [...document.querySelectorAll(".config-governance-footer button")].find(
        (b) => b.textContent.includes("Zerar mensagens"),
      );
    await digitar(document.getElementById("configChatZerarPalavra"), "zerar");
    await digitar(
      document.getElementById("configChatMotivoZerar"),
      "Fim do piloto",
    );
    expect(confirmar().disabled).toBe(true);
    await digitar(document.getElementById("configChatZerarPalavra"), "ZERAR");
    expect(confirmar().disabled).toBe(false);
    await clicar(confirmar());
    await esperar(() =>
      rpc.mock.calls.some(([nome]) => nome === "zerar_mensagens_chat"),
    );
    expect(rpc).toHaveBeenCalledWith("zerar_mensagens_chat", {
      p_confirmacao: "ZERAR",
      p_motivo: "Fim do piloto",
      p_incluir_conversas: true,
    });
    expect(document.getElementById("configChatZerarPalavra")).toBeNull();
    expect(alvo.textContent).toContain("Mensagens zeradas.");
  });

  it("recusa do banco aparece e nada é dado como feito", async () => {
    await montar({
      zerar_mensagens_chat: () => ({
        __erro: { code: "42501", message: "x" },
      }),
    });
    await clicar(botao("Zerar mensagens…"));
    await digitar(document.getElementById("configChatZerarPalavra"), "ZERAR");
    await digitar(document.getElementById("configChatMotivoZerar"), "Teste");
    const confirmar = [
      ...document.querySelectorAll(".config-governance-footer button"),
    ].find((b) => b.textContent.includes("Zerar mensagens"));
    await clicar(confirmar);
    await esperar(() =>
      document.body.textContent.includes("Nada foi apagado."),
    );
    expect(document.body.textContent).toContain(
      "Só o administrador global cuida da retenção das mensagens.",
    );
  });

  it("sem a migration, diz qual aplicar", async () => {
    await montar({
      obter_retencao_chat: () => ({ __erro: { code: "PGRST202" } }),
    });
    await esperar(() => alvo.textContent.includes("20261005190000"));
    expect(alvo.textContent).toContain("Não foi possível carregar");
  });
});
