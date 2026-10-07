import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, esperar } from "./interacoes.js";

/*
  Configurações › Status das atualizações (React): carrega ao abrir a seção, mostra o
  resumo e um selo por carga, abre o histórico, mostra o erro da última falha
  como texto, avisa quem não é administrador global e a função que falta.
  "Rodar agora" (Empregare, Seleção, Entrevistas) pela RPC disparar_robo falsa.
*/

const { montarSaudeDasCargas } =
  await import("../../src/componentes/saude-das-cargas/saude-das-cargas.tsx");

const AGORA = new Date("2026-10-01T12:00:00Z");
const ha = (min) => new Date(AGORA.getTime() - min * 60000).toISOString();

const PAYLOAD = {
  schema_version: 1,
  gerado_em: AGORA.toISOString(),
  analises: [
    {
      origem: "apps_script_analises_incremental_v1",
      area: "saude-indigena",
      tipo: "INCREMENTAL",
      execucoes: [
        {
          inicio: ha(6),
          fim: ha(5),
          situacao: "erro",
          mensagem: "<b>Timeout</b>",
        },
        { inicio: ha(26), fim: ha(25), situacao: "processado", linhas: 120 },
      ],
    },
  ],
  entrevistas: [
    { inicio: ha(61), fim: ha(60), situacao: "CONCLUIDA", linhas: 3404 },
  ],
  selecao: [],
  tarefas: null,
};

const ADMIN = { id: "u", ativo: true, admin_global: true };
const supabaseFalso = (resposta, rpcs = {}) => ({
  rpc: vi.fn(async (nome, argumentos) =>
    rpcs[nome] ? rpcs[nome](argumentos) : resposta,
  ),
});

let raiz;
let controlador;

async function montar({
  resposta = { data: PAYLOAD, error: null },
  perfil = ADMIN,
  rpcs = {},
  agendar = vi.fn(),
} = {}) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  const supabase = supabaseFalso(resposta, rpcs);
  await act(async () => {
    controlador = montarSaudeDasCargas({
      raizDaTela: raiz,
      supabase,
      getProfile: () => perfil,
      agora: () => AGORA,
      agendar,
    });
  });
  await act(async () => {
    await controlador.render();
  });
  await esperar();
  return supabase;
}

const naTela = (texto) => document.body.textContent.includes(texto);

afterEach(async () => {
  await act(async () => controlador?.raiz?.unmount());
  raiz?.remove();
  document.body.innerHTML = "";
});

describe("Status das atualizações", () => {
  it("consulta ao abrir e responde primeiro se está tudo em dia", async () => {
    const supabase = await montar();
    expect(supabase.rpc).toHaveBeenCalledWith("get_saude_das_cargas");
    const resumo = document.querySelector(".saude-resumo");
    expect(resumo.textContent).toContain("1 atualização precisa de atenção.");
    expect(resumo.textContent).toContain(
      "Análises curriculares · Saúde Indígena (falhou)",
    );
    expect(
      [...document.querySelectorAll(".saude-item__nome strong")].map(
        (n) => n.textContent,
      ),
    ).toEqual([
      "Análises curriculares · Saúde Indígena",
      "Entrevistas",
      "Seleção",
      "Atualização automática do banco",
    ]);
    // Seleção sem nenhuma carga: neutro, e fora do aviso do topo.
    const selecao = document.querySelector('[data-carga="selecao"]');
    expect(selecao.textContent).toContain("Ainda sem carga");
    expect(selecao.textContent).toContain("Ainda não houve carga");
    expect(naTela("Entrevistas") && naTela("Atualizado há 1 h")).toBe(true);
  });

  it("mostra o erro como texto e abre os detalhes com o histórico", async () => {
    await montar();
    const erro = document.querySelector(".saude-erro");
    expect(erro.textContent).toContain("<b>Timeout</b>");
    expect(erro.querySelector("b")).toBeNull();
    const analises = document.querySelector(
      '[data-carga="analises:saude-indigena"]',
    );
    expect(analises.querySelector(".saude-historico")).toBeNull();
    await clicar(analises.querySelector(".saude-botao"));
    const linhas = analises.querySelectorAll(".saude-historico tbody tr");
    expect(linhas).toHaveLength(2);
    expect(linhas[0].textContent).toContain("Falhou");
    expect(linhas[1].textContent).toContain("Concluída");
  });

  it("tudo em dia vira uma frase só", async () => {
    await montar({
      resposta: {
        data: {
          ...PAYLOAD,
          analises: [],
          selecao: [
            {
              inicio: ha(31),
              fim: ha(30),
              situacao: "CONCLUIDA",
              linhas: 3146,
            },
          ],
          tarefas: [],
        },
        error: null,
      },
    });
    expect(document.querySelector(".saude-resumo").textContent).toContain(
      "Tudo em dia.",
    );
  });

  it("quem não é administrador global não consulta e vê o aviso", async () => {
    const supabase = await montar({
      perfil: { id: "x", ativo: true, admin_global: false },
    });
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(
      naTela("Só o administrador global vê o status das atualizações."),
    ).toBe(true);
  });

  it("sem a função no banco, diz qual migration aplicar", async () => {
    await montar({
      resposta: { data: null, error: { code: "PGRST202", message: "x" } },
    });
    expect(naTela("20261001120000_saude_das_cargas.sql")).toBe(true);
  });
});

describe("Rodar agora (pelo banco: disparar_robo)", () => {
  const COM_ROBO = {
    ...PAYLOAD,
    empregare: [
      {
        inicio: ha(40),
        fim: ha(30),
        situacao: "CONCLUIDA",
        linhas: 812,
        vagas_pedidas: 12,
        vagas_baixadas: 12,
        disparo: "AGENDA",
      },
    ],
  };
  const botaoDe = (id) =>
    document.querySelector(`[data-carga="${id}"] .saude-rodar`);
  const linhaDe = (id) => document.querySelector(`[data-carga="${id}"]`);

  it("só as cargas do GitHub têm o botão, liberado sem consultar nada fora do banco", async () => {
    const supabase = await montar({
      resposta: { data: COM_ROBO, error: null },
    });
    expect(botaoDe("empregare")).not.toBeNull();
    expect(botaoDe("selecao")).not.toBeNull();
    expect(botaoDe("entrevistas")).not.toBeNull();
    expect(botaoDe("analises:saude-indigena")).toBeNull();
    expect(botaoDe("tarefas")).toBeNull();
    expect(botaoDe("empregare").disabled).toBe(false);
    expect(linhaDe("empregare").textContent).toContain("Robô da Empregare");
    expect(supabase.rpc.mock.calls.map(([nome]) => nome)).not.toContain(
      "disparar_robo",
    );
  });

  it("clicar chama disparar_robo, desabilita e acompanha até o GitHub aceitar", async () => {
    const agendar = vi.fn();
    const supabase = await montar({
      resposta: { data: COM_ROBO, error: null },
      rpcs: {
        disparar_robo: async () => ({ data: 41, error: null }),
        situacao_do_disparo_robo: async () => ({
          data: { disparo: 41, situacao: "ACEITO", http: 204 },
          error: null,
        }),
      },
      agendar,
    });
    await clicar(botaoDe("empregare"));
    expect(supabase.rpc).toHaveBeenCalledWith("disparar_robo", {
      p_robo: "empregare",
      p_inputs: {},
    });
    expect(botaoDe("empregare").disabled).toBe(true);
    expect(botaoDe("empregare").textContent).toContain("Pedido enviado");
    expect(linhaDe("empregare").textContent).toContain(
      "Pedido enviado. Aguardando o GitHub.",
    );
    // A primeira conferência (3 s) e a releitura (20 s).
    expect(agendar.mock.calls.map(([, ms]) => ms)).toEqual([3000, 20000]);
    await act(async () => {
      agendar.mock.calls[0][0]();
    });
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("situacao_do_disparo_robo", {
      p_disparo: 41,
    });
    expect(linhaDe("empregare").textContent).toContain(
      "Aceito pelo GitHub. Na fila ou rodando.",
    );
    // As outras cargas continuam liberadas.
    expect(botaoDe("selecao").disabled).toBe(false);
  });

  it("chave do cofre vencida: a linha diz o que fazer e o botão volta", async () => {
    const agendar = vi.fn();
    await montar({
      resposta: { data: COM_ROBO, error: null },
      rpcs: {
        disparar_robo: async () => ({ data: 42, error: null }),
        situacao_do_disparo_robo: async () => ({
          data: {
            disparo: 42,
            situacao: "FALHOU",
            http: 401,
            mensagem: "GitHub 401: Bad credentials",
          },
          error: null,
        }),
      },
      agendar,
    });
    await clicar(botaoDe("selecao"));
    await act(async () => {
      agendar.mock.calls[0][0]();
    });
    await esperar();
    expect(linhaDe("selecao").textContent).toContain(
      "A chave de disparo dos robôs expirou ou foi recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos.",
    );
    expect(botaoDe("selecao").disabled).toBe(false);
  });

  it("desabilitado enquanto a carga roda (registro do banco)", async () => {
    await montar({
      resposta: {
        data: {
          ...COM_ROBO,
          selecao: [{ inicio: ha(2), situacao: "EM_ANDAMENTO" }],
        },
        error: null,
      },
    });
    expect(botaoDe("selecao").disabled).toBe(true);
    expect(botaoDe("selecao").textContent).toContain("Rodando…");
    expect(botaoDe("empregare").disabled).toBe(false);
  });

  it("recusa do banco aparece na linha e libera o botão", async () => {
    await montar({
      resposta: { data: COM_ROBO, error: null },
      rpcs: {
        disparar_robo: async () => ({
          data: null,
          error: {
            code: "42501",
            message: "Só o administrador global roda as cargas.",
          },
        }),
      },
    });
    await clicar(botaoDe("entrevistas"));
    expect(
      linhaDe("entrevistas").querySelector('[role="alert"]').textContent,
    ).toBe("Só o administrador global roda as cargas.");
    expect(botaoDe("entrevistas").disabled).toBe(false);
  });

  it("pedido repetido em 2 min: aviso informativo, sem erro", async () => {
    await montar({
      resposta: { data: COM_ROBO, error: null },
      rpcs: {
        disparar_robo: async () => ({
          data: null,
          error: {
            code: "55006",
            message: "Esta carga acabou de ser pedida. Aguarde alguns minutos.",
          },
        }),
      },
    });
    await clicar(botaoDe("entrevistas"));
    expect(linhaDe("entrevistas").querySelector('[role="alert"]')).toBeNull();
    expect(linhaDe("entrevistas").textContent).toContain(
      "Esta carga acabou de ser pedida.",
    );
  });
});

describe("a seção na Administração", async () => {
  const { SECOES } = await import("../../src/modulos/configuracoes/secoes.js");
  const { secaoDeConfiguracaoPermitida } =
    await import("../../src/lib/access-roles.js");

  it("existe e é só do administrador global", () => {
    expect(SECOES.find((s) => s.id === "cargas")).toMatchObject({
      rotulo: "Status das atualizações",
      iconeDoMenu: "heart-pulse",
    });
    expect(secaoDeConfiguracaoPermitida(ADMIN, "cargas")).toBe(true);
    expect(
      secaoDeConfiguracaoPermitida(
        { id: "x", ativo: true, admin_global: false },
        "cargas",
      ),
    ).toBe(false);
  });
});

describe("Agenda dos robôs (20261008140000)", () => {
  const comAgenda = (agenda) => ({
    resposta: { data: { ...PAYLOAD, agenda_dos_robos: agenda }, error: null },
  });

  it("mostra o último pedido aceito e as falhas das últimas 24 h", async () => {
    await montar(
      comAgenda({
        chave_cadastrada: true,
        ultimo_aceito: ha(20),
        falhas_24h: 2,
        sem_chave_24h: 0,
        disparos: [
          {
            workflow: "sincronizar-entrevistas.yml",
            inicio: ha(20),
            fim: ha(20),
            situacao: "ACEITO",
            http: 204,
          },
        ],
      }),
    );
    const linha = document.querySelector('[data-carga="agenda_dos_robos"]');
    expect(linha.querySelector("strong").textContent).toBe("Agenda dos robôs");
    expect(linha.querySelector(".saude-agenda").textContent).toMatch(
      /^Último pedido aceito: .+ · 2 falhas em 24 h$/,
    );
    expect(linha.querySelector('[role="alert"]')).toBeNull();
    await clicar(linha.querySelector(".saude-botao"));
    expect(linha.querySelector(".saude-historico tbody").textContent).toContain(
      "Entrevistas · HTTP 204",
    );
  });

  it("sem a chave no Vault, avisa e pede o cadastro", async () => {
    await montar(
      comAgenda({
        chave_cadastrada: false,
        ultimo_aceito: null,
        falhas_24h: 0,
        sem_chave_24h: 3,
        disparos: [],
      }),
    );
    const linha = document.querySelector('[data-carga="agenda_dos_robos"]');
    const aviso = linha.querySelector('.saude-agenda[role="alert"]');
    expect(aviso.textContent).toBe(
      "Sem chave no Vault: os robôs não rodam sozinhos. Cadastre github_disparo_robos.",
    );
    expect(linha.textContent).toContain("Falhou");
    expect(document.querySelector(".saude-resumo").textContent).toContain(
      "Agenda dos robôs (falhou)",
    );
  });
});
