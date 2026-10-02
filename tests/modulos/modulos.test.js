import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { montarModulos } from "../../src/modulos/modulos/modulos.jsx";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";

/*
  Configurações › Módulos e abas: só o admin global vê; as mudanças se
  acumulam e vão juntas em "Revisar e salvar", com motivo; as recusas do banco
  (23514: última área; 42501: sem permissão) aparecem em português claro.
*/

const ARVORE = () => ({
  sistema: { situacao: "ATIVA", mensagem: null, previsao: null },
  areas: [
    {
      co_area: "saude-indigena",
      no_area: "Saúde Indígena",
      ativo: true,
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
      abas: [
        {
          co_aba: "editais",
          ativo: true,
          situacao: "ATIVA",
          mensagem: null,
          previsao: null,
        },
      ],
    },
    {
      co_area: "sede",
      no_area: "SEDE",
      ativo: true,
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
      abas: [],
    },
  ],
  abas: [
    {
      co_aba: "editais",
      no_aba: "Editais",
      ds_icone: "file-text",
      nu_ordem: 2,
      ativo: true,
      situacao: "ATIVA",
      mensagem: null,
      previsao: null,
      beta: false,
    },
  ],
  paineis: [
    { id: "p-1", titulo: "Painel BI", ativo: true, em_manutencao: false },
  ],
  historico: [
    {
      escopo: "area",
      area: "sede",
      campo: "situacao",
      anterior: "MANUTENCAO",
      novo: "ATIVA",
      motivo: "fim do ajuste",
      quando: "2026-09-29T10:00:00Z",
      autor: "adm@agenciasus.org.br",
    },
  ],
});

function supabaseFalso({ recusa = null } = {}) {
  const rpc = vi.fn((nome) => {
    if (nome === "obter_modulos_e_abas")
      return Promise.resolve({ data: ARVORE(), error: null });
    if (nome === "salvar_situacao_modulos")
      return Promise.resolve(
        recusa
          ? { data: null, error: recusa }
          : { data: { alteradas: 2 }, error: null },
      );
    return Promise.resolve({ data: null, error: null });
  });
  return {
    rpc,
    auth: {
      getSession: async () => ({
        data: { session: { access_token: "x" } },
        error: null,
      }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  };
}

let controlador = null;
async function montar({ perfil, recusa, confirmar = () => true } = {}) {
  document.body.innerHTML = '<div id="modulosApp" data-modulos></div>';
  const supabase = supabaseFalso({ recusa });
  const toast = vi.fn();
  await act(async () => {
    controlador = montarModulos({
      raizDaTela: document.getElementById("modulosApp"),
      supabase,
      toast,
      getProfile: () => perfil,
      confirmar,
    });
  });
  await esperar(() => controlador.render());
  return { supabase, toast };
}

afterEach(async () => {
  controlador?.estado.desligar();
  await act(async () => controlador?.raiz?.unmount());
  controlador = null;
  document.body.innerHTML = "";
});

const ADMIN = { admin_global: true, permissoes: {} };
const EDITOR = { admin_global: false, permissoes: { configuracoes: "admin" } };

const botao = (texto, raiz = document) =>
  [...raiz.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === texto,
  );
const grupo = (rotulo) =>
  document.querySelector(`[role="radiogroup"][aria-label="${rotulo}"]`);
const opcao = (rotulo, texto) => botao(texto, grupo(rotulo));
const salvarChamadas = (supabase) =>
  supabase.rpc.mock.calls.filter(
    ([nome]) => nome === "salvar_situacao_modulos",
  );

describe("Configurações › Módulos e abas", () => {
  it("quem não é admin global não carrega nem vê a árvore", async () => {
    const { supabase } = await montar({ perfil: EDITOR });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain(
      "Só o administrador global gerencia módulos e abas.",
    );
  });

  it("mostra sistema, uma área por cartão com as abas, abas, painéis e histórico", async () => {
    await montar({ perfil: ADMIN });
    const titulos = [...document.querySelectorAll(".modulos-cartao h4")].map(
      (h) => h.textContent,
    );
    expect(titulos).toEqual([
      "Sistema inteiro",
      "Saúde Indígena",
      "SEDE",
      "Abas (em todas as áreas)",
      "Painéis externos",
      "Histórico",
    ]);
    expect(grupo("Situação de Editais")).not.toBeNull();
    expect(document.querySelector(".modulos-historico").textContent).toContain(
      "Área SEDE · Situação: Em manutenção → Ativa",
    );
    // Nada pendente, nada a salvar.
    expect(botao("Revisar e salvar")).toBeUndefined();
  });

  it("acumula as mudanças e salva tudo junto, com motivo", async () => {
    const { supabase, toast } = await montar({ perfil: ADMIN });
    await clicar(opcao("Situação do sistema inteiro", "Em manutenção"));
    await digitar(
      document.getElementById("modulos-sistema-mensagem"),
      "Atualização do banco",
    );
    await clicar(document.querySelector(".modulos-beta input[type=checkbox]"));
    expect(document.querySelector(".modulos-salvar").textContent).toContain(
      "3 alterações pendentes",
    );
    await clicar(botao("Revisar e salvar"));
    const revisao = document.querySelector(".modulos-revisao").textContent;
    expect(revisao).toContain(
      "Sistema inteiro · Situação: Ativa → Em manutenção",
    );
    expect(revisao).toContain("Aba Editais (todas as áreas) · Selo BETA");

    // Sem motivo, não salva.
    await clicar(botao("Salvar alterações"));
    expect(salvarChamadas(supabase)).toHaveLength(0);
    expect(document.body.textContent).toContain("Informe o motivo");

    await digitar(
      document.getElementById("modulosMotivo"),
      "janela de manutenção",
    );
    await clicar(botao("Salvar alterações"));
    await esperar();
    const [[, argumentos]] = salvarChamadas(supabase);
    expect(argumentos).toEqual({
      p_alteracoes: [
        { escopo: "sistema", campo: "situacao", valor: "MANUTENCAO" },
        { escopo: "sistema", campo: "mensagem", valor: "Atualização do banco" },
        { escopo: "aba", aba: "editais", campo: "beta", valor: "S" },
      ],
      p_motivo: "janela de manutenção",
    });
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("2 alterações salvas"),
      "success",
    );
    expect(controlador.temAlteracoesPendentes()).toBe(false);
  });

  it("não deixa salvar com todas as áreas desativadas", async () => {
    const { supabase } = await montar({ perfil: ADMIN });
    await clicar(opcao("Situação da área Saúde Indígena", "Desativada"));
    await clicar(opcao("Situação da área SEDE", "Desativada"));
    await clicar(botao("Revisar e salvar"));
    expect(document.querySelector(".modulos-problemas").textContent).toContain(
      "Pelo menos uma área precisa ficar ativa.",
    );
    expect(botao("Salvar alterações").disabled).toBe(true);
    expect(salvarChamadas(supabase)).toHaveLength(0);
  });

  it("recusa 23514 do banco vira aviso claro e mantém o rascunho", async () => {
    await montar({
      perfil: ADMIN,
      recusa: {
        code: "23514",
        message: "Pelo menos uma área precisa ficar ativa",
      },
    });
    await clicar(opcao("Situação de Painel BI", "Em manutenção"));
    await clicar(botao("Revisar e salvar"));
    await digitar(document.getElementById("modulosMotivo"), "teste de recusa");
    await clicar(botao("Salvar alterações"));
    await esperar();
    expect(document.querySelector('[role="alert"]').textContent).toContain(
      "Pelo menos uma área precisa ficar ativa. Reative uma área",
    );
    expect(controlador.temAlteracoesPendentes()).toBe(true);
  });

  it("recusa 42501 diz que só o admin global pode", async () => {
    await montar({
      perfil: ADMIN,
      recusa: { code: "42501", message: "Somente o administrador global" },
    });
    await clicar(opcao("Situação de Editais", "Desativada"));
    await clicar(botao("Revisar e salvar"));
    await digitar(document.getElementById("modulosMotivo"), "sem poder");
    await clicar(botao("Salvar alterações"));
    await esperar();
    expect(document.body.textContent).toContain(
      "Só o administrador global pode mudar módulos e abas.",
    );
  });

  it("aba em manutenção numa área pede mensagem e previsão", async () => {
    const { supabase } = await montar({ perfil: ADMIN });
    const linha = document.querySelector(
      '[data-alvo="modulos-aba_area-saude-indigena-editais"]',
    );
    await clicar(botao("Em manutenção", linha));
    await digitar(
      document.getElementById(
        "modulos-aba_area-saude-indigena-editais-previsao",
      ),
      "2026-10-10",
    );
    await clicar(botao("Revisar e salvar"));
    await digitar(document.getElementById("modulosMotivo"), "ajuste local");
    await clicar(botao("Salvar alterações"));
    await esperar();
    expect(salvarChamadas(supabase)[0][1].p_alteracoes).toEqual([
      {
        escopo: "aba_area",
        area: "saude-indigena",
        aba: "editais",
        campo: "situacao",
        valor: "MANUTENCAO",
      },
      {
        escopo: "aba_area",
        area: "saude-indigena",
        aba: "editais",
        campo: "previsao",
        valor: "2026-10-10",
      },
    ]);
  });

  it("sair com pendência pergunta antes", async () => {
    const confirmar = vi.fn(() => false);
    await montar({ perfil: ADMIN, confirmar });
    await clicar(opcao("Situação de Editais", "Em manutenção"));
    expect(controlador.confirmarSaida()).toBe(false);
    expect(confirmar).toHaveBeenCalled();
    confirmar.mockReturnValue(true);
    expect(controlador.confirmarSaida()).toBe(true);
    expect(controlador.temAlteracoesPendentes()).toBe(false);
  });
  it("desliga as comemorações do sistema inteiro pelo rascunho, com motivo", async () => {
    const { supabase } = await montar({ perfil: ADMIN });
    const caixa = document.querySelector(
      ".modulos-comemoracoes input[type=checkbox]",
    );
    expect(caixa.checked).toBe(true);
    await clicar(caixa);
    await clicar(botao("Revisar e salvar"));
    expect(document.querySelector(".modulos-revisao").textContent).toContain(
      "Sistema inteiro · Comemorações: Ligadas → Desligadas",
    );
    await digitar(document.getElementById("modulosMotivo"), "pedido da gestão");
    await clicar(botao("Salvar alterações"));
    await esperar();
    expect(salvarChamadas(supabase)[0][1].p_alteracoes).toEqual([
      { escopo: "sistema", campo: "comemoracoes", valor: "N" },
    ]);
  });
});
