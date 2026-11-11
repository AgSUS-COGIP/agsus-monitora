import { readFileSync } from "node:fs";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

/*
  Orquestrador das análises (4-orquestrador-fato-supabase.gs), 11/11/2026: o
  gatilho da Saúde Indígena era de outra conta, que perdeu a autorização do
  script. Cada execução marcava o início do ciclo e só então falhava ao abrir a
  planilha; a janela de 20 minutos recomeçava e nada ia ao banco de 29/10 a
  11/11. Agora o gatilho sem acesso sai antes de tocar no estado.

  Os .gs não têm módulo: rodam num contexto do node:vm com dublês mínimos.
*/
const PLANILHAS = ["saude-indigena", "projetos", "sede"];
const ler = (p) =>
  readFileSync(`apps-script/${p}/4-orquestrador-fato-supabase.gs`, "utf8");

function rodar(planilha, { comAcesso }) {
  const props = new Map();
  const logs = [];
  const chamadas = [];
  const ctx = vm.createContext({
    Logger: { log: (m) => logs.push(String(m)) },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => props.set(k, String(v)),
        deleteProperty: (k) => props.delete(k),
      }),
    },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => {
        if (!comAcesso)
          throw new Error(
            "Você não tem permissão para chamar SpreadsheetApp.getActiveSpreadsheet.",
          );
        return {};
      },
    },
    ScriptApp: { getProjectTriggers: () => [] },
    Utilities: { getUuid: () => "ciclo-1" },
    // A FATO (no "Atualizar base") só é chamada quando o ciclo começa de fato.
    atualizarDimVagasESincronizar: () => {
      chamadas.push("FATO");
      throw new Error("FATO falhou no dublê");
    },
  });
  vm.runInContext(ler(planilha), ctx);
  const resultado = ctx.orquestrarFatoESupabaseAgendado();
  return { resultado, props, logs, chamadas };
}

describe.each(PLANILHAS)("orquestrador de %s", (planilha) => {
  it("gatilho sem acesso à planilha: não marca o ciclo nem chama a FATO", () => {
    const { resultado, props, chamadas, logs } = rodar(planilha, {
      comAcesso: false,
    });
    expect(resultado.sem_permissao).toBe(true);
    expect(chamadas).toEqual([]);
    expect(props.size).toBe(0);
    expect(logs.join("\n")).toContain("statusGatilhoFatoESupabase");
  });

  it("com acesso: o ciclo começa como antes (marca a janela e chama a FATO)", () => {
    const { resultado, props, chamadas } = rodar(planilha, {
      comAcesso: true,
    });
    expect(chamadas).toEqual(["FATO"]);
    expect(props.has("FATO_SUPABASE_ORQ_LAST_CYCLE_AT")).toBe(true);
    expect(resultado.phase).toBe("FATO_ERROR");
  });

  it("a conferência é a primeira coisa do handler", () => {
    const codigo = ler(planilha);
    const inicio = codigo.indexOf(
      "function orquestrarFatoESupabaseAgendado() {",
    );
    const guarda = codigo.indexOf("if (!temAcessoAPlanilhaOrq_())", inicio);
    const estado = codigo.indexOf("lerEstadoFatoSupabase_()", inicio);
    expect(guarda).toBeGreaterThan(inicio);
    expect(estado).toBeGreaterThan(guarda);
  });
});
