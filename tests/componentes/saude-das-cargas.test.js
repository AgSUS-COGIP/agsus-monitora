import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, esperar } from "./interacoes.js";

/*
  Configurações › Status das atualizações (React): carrega ao abrir a seção, mostra o
  resumo e um selo por carga, abre o histórico, mostra o erro da última falha
  como texto, avisa quem não é administrador global e a função que falta.
  "Rodar agora" (Empregare, Seleção, Entrevistas) com /api/rodar-carga falso.
*/

const { montarSaudeDasCargas } =
  await import("../../src/componentes/saude-das-cargas/saude-das-cargas.jsx");

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
const supabaseFalso = (resposta) => ({ rpc: vi.fn(async () => resposta) });

let raiz;
let controlador;

const respostaHttp = (status, corpo = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
});

async function montar({
  resposta = { data: PAYLOAD, error: null },
  perfil = ADMIN,
  buscar = vi.fn(async () => respostaHttp(404)),
  agendar = vi.fn(),
} = {}) {
  raiz = document.createElement("div");
  document.body.append(raiz);
  const supabase = supabaseFalso(resposta);
  await act(async () => {
    controlador = montarSaudeDasCargas({
      raizDaTela: raiz,
      supabase,
      getProfile: () => perfil,
      agora: () => AGORA,
      buscar,
      obterToken: async () => "token-do-usuario",
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

describe("Rodar agora", () => {
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
  const disponivel = (rodando = {}) =>
    respostaHttp(200, {
      configurado: true,
      robos: {
        empregare: { rodando: Boolean(rodando.empregare) },
        selecao: { rodando: Boolean(rodando.selecao) },
        entrevistas: { rodando: false },
      },
    });
  const botaoDe = (id) =>
    document.querySelector(`[data-carga="${id}"] .saude-rodar`);

  it("só as três cargas do GitHub têm o botão; a linha do robô aparece", async () => {
    await montar({
      resposta: { data: COM_ROBO, error: null },
      buscar: vi.fn(async () => disponivel()),
    });
    expect(botaoDe("empregare")).not.toBeNull();
    expect(botaoDe("selecao")).not.toBeNull();
    expect(botaoDe("entrevistas")).not.toBeNull();
    expect(botaoDe("analises:saude-indigena")).toBeNull();
    expect(botaoDe("tarefas")).toBeNull();
    expect(botaoDe("empregare").disabled).toBe(false);
    expect(
      document.querySelector('[data-carga="empregare"]').textContent,
    ).toContain("Robô da Empregare");
  });

  it("clicar pede ao /api/rodar-carga com o Bearer e desabilita até o GitHub mostrar", async () => {
    const buscar = vi.fn(async (_url, opcoes) =>
      opcoes?.method === "POST"
        ? respostaHttp(202, { ok: true })
        : disponivel(),
    );
    const agendar = vi.fn();
    await montar({
      resposta: { data: COM_ROBO, error: null },
      buscar,
      agendar,
    });
    await clicar(botaoDe("empregare"));
    const post = buscar.mock.calls.find(([, o]) => o?.method === "POST");
    expect(post[0]).toBe("/api/rodar-carga");
    expect(JSON.parse(post[1].body)).toEqual({ robo: "empregare" });
    expect(post[1].headers.Authorization).toBe("Bearer token-do-usuario");
    expect(botaoDe("empregare").disabled).toBe(true);
    expect(botaoDe("empregare").textContent).toContain("Pedido enviado");
    expect(naTela("Pedido enviado.")).toBe(true);
    expect(agendar).toHaveBeenCalledTimes(1);
    // As outras cargas continuam liberadas.
    expect(botaoDe("selecao").disabled).toBe(false);
  });

  it("desabilitado enquanto o GitHub roda", async () => {
    await montar({
      resposta: { data: COM_ROBO, error: null },
      buscar: vi.fn(async () => disponivel({ selecao: true })),
    });
    expect(botaoDe("selecao").disabled).toBe(true);
    expect(botaoDe("selecao").textContent).toContain("Rodando…");
    expect(botaoDe("empregare").disabled).toBe(false);
  });

  it("sem token na Vercel: mostra o estado e diz o que falta configurar", async () => {
    await montar({
      resposta: { data: COM_ROBO, error: null },
      buscar: vi.fn(async () =>
        respostaHttp(503, { configurado: false, erro: "x" }),
      ),
    });
    expect(botaoDe("empregare").disabled).toBe(true);
    expect(
      document.querySelector('[data-carga="empregare"]').textContent,
    ).toContain("Falta configurar GITHUB_DISPATCH_TOKEN na Vercel.");
    expect(naTela("Atualizado há 30 min")).toBe(true);
  });

  it("erro do disparo aparece na linha e libera o botão", async () => {
    const buscar = vi.fn(async (_url, opcoes) =>
      opcoes?.method === "POST"
        ? respostaHttp(403, {
            erro: "Só o administrador global roda as cargas.",
          })
        : disponivel(),
    );
    await montar({ resposta: { data: COM_ROBO, error: null }, buscar });
    await clicar(botaoDe("entrevistas"));
    expect(
      document.querySelector('[data-carga="entrevistas"] [role="alert"]')
        .textContent,
    ).toBe("Só o administrador global roda as cargas.");
    expect(botaoDe("entrevistas").disabled).toBe(false);
  });

  it("fora da versão publicada o botão fica desabilitado", async () => {
    await montar({ resposta: { data: COM_ROBO, error: null } });
    expect(botaoDe("empregare").disabled).toBe(true);
    expect(naTela("Só na versão publicada.")).toBe(true);
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
