import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { montarAutomacao } from "../../src/modulos/automacao/automacao.tsx";
import { clicar, digitar, esperar } from "../componentes/interacoes.js";

/*
  Configurações › Automação (20261022190000): só o administrador global vê;
  cada chave mostra estado, última e próxima execução e quem mudou; ligar e
  desligar pede motivo (10 a 500) e vai por alterar_chave_da_automacao; as
  recusas do banco aparecem em português; a função que falta é dita.
*/

const ADMIN = { id: "u", ativo: true, admin_global: true };
const COMUM = { id: "c", ativo: true, admin_global: false };

const CHAVES = (entrevistasLigada = false) => ({
  schema_version: 1,
  gerado_em: "2026-10-22T14:00:00Z",
  cron_disponivel: true,
  chaves: [
    {
      chave: "entrevistas",
      nome: "Entrevistas",
      ligada: entrevistasLigada,
      motivo: entrevistasLigada
        ? "Volta da carga de hora em hora"
        : "Já estava desligada no pg_cron, pausa de propósito desde 16/10/2026",
      em: "2026-10-22T13:00:00Z",
      por: "Gestão da Informação de Pessoal",
      tarefas: [
        {
          nome: "agsus_robo_sincronizar_entrevistas",
          agenda: "5 * * * *",
          ativa: entrevistasLigada,
          ultima: { inicio: "2026-10-16T10:05:00Z", situacao: "succeeded" },
        },
      ],
    },
    {
      chave: "conferencias",
      nome: "Conferências",
      ligada: true,
      motivo: "Estado inicial (migração 20261022190000).",
      em: "2026-10-22T13:00:00Z",
      por: null,
      tarefas: [
        // Parada direto no banco com a chave ligada.
        {
          nome: "agsus_robo_conferencias",
          agenda: "0 9 * * *",
          ativa: false,
          ultima: null,
        },
      ],
    },
  ],
  sem_chave: [
    {
      nome: "agsus_robo_conferir_disparos",
      agenda: "*/5 * * * *",
      ativa: true,
    },
  ],
  historico: [
    {
      chave: "entrevistas",
      ligada: false,
      motivo: "Já estava desligada no pg_cron",
      em: "2026-10-22T13:00:00Z",
      por: "Gestão da Informação de Pessoal",
      tarefas: [],
    },
  ],
});

let raiz;
let controlador;

async function montar({ perfil = ADMIN, rpc } = {}) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  const supabase = {
    rpc: vi.fn(
      rpc ||
        (async (nome) =>
          nome === "obter_chaves_da_automacao"
            ? { data: CHAVES(), error: null }
            : { data: null, error: { code: "XX000", message: "inesperado" } }),
    ),
  };
  const toast = vi.fn();
  await act(async () => {
    controlador = montarAutomacao({
      raizDaTela: raiz,
      supabase,
      getProfile: () => perfil,
      toast,
    });
  });
  await act(async () => {
    await controlador.render();
  });
  await esperar();
  return { supabase, toast };
}

const linha = (chave) => raiz.querySelector(`[data-chave="${chave}"]`);
const botao = (onde, texto) =>
  [...onde.querySelectorAll("button")].find(
    (b) => b.textContent.trim() === texto,
  );

afterEach(() => {
  act(() => controlador?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
});

describe("Configurações › Automação", () => {
  it("lista as chaves com estado, última, próxima, quem mudou e o histórico", async () => {
    await montar();
    const entrevistas = linha("entrevistas");
    expect(entrevistas.textContent).toContain("Desligada pelo administrador");
    expect(entrevistas.textContent).toContain(
      "Não roda enquanto estiver desligada",
    );
    expect(entrevistas.textContent).toContain(
      "Gestão da Informação de Pessoal",
    );
    expect(entrevistas.textContent).toContain(
      "pausa de propósito desde 16/10/2026",
    );
    expect(entrevistas.textContent).toContain("concluída");
    expect(botao(entrevistas, "Ligar")).toBeTruthy();
    const conferencias = linha("conferencias");
    expect(conferencias.textContent).toContain("Ligada");
    expect(conferencias.textContent).toContain(
      "Parada direto no banco: agsus_robo_conferencias.",
    );
    expect(raiz.textContent).toContain("Sempre ligadas");
    expect(raiz.textContent).toContain("agsus_robo_conferir_disparos");
    expect(raiz.textContent).toContain("Histórico");
  });

  it("o cálculo pelo Python ligado com a Classificação em Python desligada avisa que não tem efeito", async () => {
    const dados = CHAVES();
    dados.chaves.push(
      {
        chave: "classificacao",
        nome: "Classificação em Python",
        ligada: false,
        motivo: "Pausa do Python",
        tarefas: [],
      },
      {
        chave: "classificacao_calculo",
        nome: "Gerar listas pelo Python",
        ligada: true,
        motivo: "Depois da publicação do 114/2026",
        tarefas: [],
      },
    );
    await montar({
      rpc: async (nome) =>
        nome === "obter_chaves_da_automacao"
          ? { data: dados, error: null }
          : { data: null, error: { code: "XX000", message: "inesperado" } },
    });
    expect(linha("classificacao_calculo").textContent).toContain(
      'Sem efeito enquanto "Classificação em Python" estiver desligada',
    );
    expect(linha("classificacao").textContent).not.toContain("Sem efeito");
  });

  it("ligar pede motivo de 10 caracteres e manda a chave ao banco", async () => {
    const { supabase, toast } = await montar({
      rpc: async (nome) =>
        nome === "obter_chaves_da_automacao"
          ? { data: CHAVES(), error: null }
          : { data: CHAVES(true), error: null },
    });
    await clicar(botao(linha("entrevistas"), "Ligar"));
    const campo = raiz.querySelector("#automacaoMotivo-entrevistas");
    await digitar(campo, "curto");
    await clicar(botao(linha("entrevistas"), "Ligar"));
    expect(raiz.textContent).toContain(
      "Informe o motivo (de 10 a 500 caracteres).",
    );
    expect(supabase.rpc).not.toHaveBeenCalledWith(
      "alterar_chave_da_automacao",
      expect.anything(),
    );

    await digitar(campo, "  Volta da carga de hora em hora  ");
    await clicar(botao(linha("entrevistas"), "Ligar"));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("alterar_chave_da_automacao", {
      p_chave: "entrevistas",
      p_ligar: true,
      p_motivo: "Volta da carga de hora em hora",
    });
    expect(linha("entrevistas").textContent).toContain("Ligada");
    expect(raiz.querySelector("#automacaoMotivo-entrevistas")).toBeNull();
    expect(toast).toHaveBeenCalledWith("Entrevistas: automação ligada.");
  });

  it("desligar: a recusa do banco aparece em português e relê no 55000", async () => {
    let leituras = 0;
    await montar({
      rpc: async (nome) => {
        if (nome === "obter_chaves_da_automacao") {
          leituras += 1;
          return { data: CHAVES(), error: null };
        }
        return {
          data: null,
          error: { code: "55000", message: "já desligada" },
        };
      },
    });
    await clicar(botao(linha("conferencias"), "Desligar"));
    await digitar(
      raiz.querySelector("#automacaoMotivo-conferencias"),
      "Conferências em revisão",
    );
    await clicar(botao(linha("conferencias"), "Desligar"));
    await esperar();
    expect(raiz.textContent).toContain("Outra pessoa já mudou esta automação.");
    expect(leituras).toBe(2);
  });

  it("quem não é administrador global não vê nem consulta", async () => {
    const { supabase } = await montar({ perfil: COMUM });
    expect(raiz.textContent).toContain(
      "Só o administrador global liga e desliga a automação.",
    );
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  it("sem a função no banco, diz qual migration falta", async () => {
    await montar({
      rpc: async () => ({
        data: null,
        error: { code: "PGRST202", message: "not found" },
      }),
    });
    expect(raiz.textContent).toContain("20261022190000");
  });
});
