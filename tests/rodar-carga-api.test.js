import { describe, expect, it } from "vitest";
import handler from "../api/rodar-carga.js";
import {
  ESPERA_DO_PEDIDO_MIN,
  estadoDoBotao,
  execucaoEmCurso,
  roboDeCarga,
  ROBOS_DE_CARGA,
} from "../src/lib/robos-de-carga.js";

/*
  /api/rodar-carga com fetch falso: Bearer conferido no Supabase, só o
  administrador global, lista fixa de robôs, token do GitHub só do ambiente,
  nada rodando antes de disparar. E as regras do botão (src/lib/robos-de-carga.js).
*/
const AMBIENTE = {
  VITE_SUPABASE_URL: "https://projeto.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "chave-publica",
  GITHUB_DISPATCH_TOKEN: "token-falso-do-github",
};
const USUARIO = "0b8f2a8e-1111-4c2d-9e3f-123456789abc";

function respostaFalsa(status, corpo) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  };
}

function montarBuscar({
  usuario = 200,
  admin = true,
  coordena = false,
  emCurso = {},
  despacho = 204,
  listagem = 200,
} = {}) {
  const chamadas = [];
  const buscar = async (url, opcoes = {}) => {
    chamadas.push({ url, opcoes });
    if (url.endsWith("/auth/v1/user"))
      return respostaFalsa(usuario, { id: USUARIO });
    if (url.endsWith("/rest/v1/rpc/pode_disparar_carga"))
      return respostaFalsa(200, admin);
    if (url.endsWith("/rest/v1/rpc/pode_recalcular_pre_classificacao"))
      return respostaFalsa(200, coordena);
    const runs = url.match(/workflows\/([^/]+)\/runs/);
    if (runs) {
      const robo = ROBOS_DE_CARGA.find((r) => r.workflow === runs[1]);
      return respostaFalsa(listagem, {
        workflow_runs: emCurso[robo.id]
          ? [
              {
                status: "in_progress",
                html_url: "https://github.com/x/actions/runs/1",
              },
            ]
          : [{ status: "completed" }],
      });
    }
    if (url.endsWith("/dispatches")) return respostaFalsa(despacho, null);
    throw new Error(`inesperado: ${url}`);
  };
  return { buscar, chamadas };
}

function chamar({
  metodo = "POST",
  corpo = { robo: "empregare" },
  autorizacao = "Bearer token-do-usuario",
  ambiente = AMBIENTE,
  cabecalhos = {},
  ...opcoes
} = {}) {
  const { buscar, chamadas } = montarBuscar(opcoes);
  const res = {
    statusCode: 0,
    headers: {},
    corpo: null,
    status(codigo) {
      this.statusCode = codigo;
      return this;
    },
    setHeader(nome, valor) {
      this.headers[nome.toLowerCase()] = valor;
    },
    end(texto) {
      this.corpo = texto ? JSON.parse(texto) : null;
    },
  };
  const req = {
    method: metodo,
    headers: {
      host: "monitora.exemplo",
      authorization: autorizacao,
      ...cabecalhos,
    },
    body: corpo,
  };
  return handler(req, res, { ambiente, buscar }).then(() => ({
    res,
    chamadas,
  }));
}

describe("/api/rodar-carga", () => {
  it("dispara o workflow do robô pedido com modo normal e quem disparou", async () => {
    const { res, chamadas } = await chamar();
    expect(res.statusCode).toBe(202);
    expect(res.corpo).toEqual({ ok: true, robo: "empregare" });
    const despacho = chamadas.find((c) => c.url.endsWith("/dispatches"));
    expect(despacho.url).toBe(
      "https://api.github.com/repos/AgSUS-COGIP/agsus-monitora/actions/workflows/robo-empregare.yml/dispatches",
    );
    expect(JSON.parse(despacho.opcoes.body)).toEqual({
      ref: "main",
      inputs: { modo: "normal", disparado_por: USUARIO },
    });
    expect(despacho.opcoes.headers.Authorization).toBe(
      "Bearer token-falso-do-github",
    );
    // A permissão é conferida com o token de quem clicou, no banco.
    const rpc = chamadas.find((c) => c.url.includes("pode_disparar_carga"));
    expect(rpc.opcoes.headers.Authorization).toBe("Bearer token-do-usuario");
  });

  it("o token do GitHub nunca volta na resposta", async () => {
    for (const metodo of ["GET", "POST"]) {
      const { res } = await chamar({ metodo });
      expect(JSON.stringify(res.corpo)).not.toContain("token-falso");
    }
  });

  it("GET diz o que está rodando no GitHub", async () => {
    const { res, chamadas } = await chamar({
      metodo: "GET",
      emCurso: { selecao: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.corpo.configurado).toBe(true);
    expect(res.corpo.robos.selecao.rodando).toBe(true);
    expect(res.corpo.robos.empregare.rodando).toBe(false);
    expect(chamadas.some((c) => c.url.endsWith("/dispatches"))).toBe(false);
  });

  it("recusa sem sessão, sem permissão e de outra origem", async () => {
    expect((await chamar({ autorizacao: "" })).res.statusCode).toBe(401);
    expect((await chamar({ usuario: 401 })).res.statusCode).toBe(401);
    const semAdmin = await chamar({ admin: false });
    expect(semAdmin.res.statusCode).toBe(403);
    expect(semAdmin.chamadas.some((c) => c.url.includes("github"))).toBe(false);
    const outraOrigem = await chamar({
      cabecalhos: { origin: "https://outro.exemplo" },
    });
    expect(outraOrigem.res.statusCode).toBe(403);
  });

  it("só robôs da lista fixa", async () => {
    for (const robo of ["../../etc", "build-and-smoke", "", null]) {
      const { res, chamadas } = await chamar({ corpo: { robo } });
      expect(res.statusCode).toBe(400);
      expect(chamadas.some((c) => c.url.endsWith("/dispatches"))).toBe(false);
    }
    const { res } = await chamar({
      corpo: JSON.stringify({ robo: "selecao" }),
    });
    expect(res.statusCode).toBe(202);
  });

  it("não dispara o que já está rodando", async () => {
    const { res, chamadas } = await chamar({ emCurso: { empregare: true } });
    expect(res.statusCode).toBe(409);
    expect(chamadas.some((c) => c.url.endsWith("/dispatches"))).toBe(false);
  });

  it("sem token configurado: 503 com configurado false", async () => {
    const { res, chamadas } = await chamar({
      ambiente: { ...AMBIENTE, GITHUB_DISPATCH_TOKEN: "" },
    });
    expect(res.statusCode).toBe(503);
    expect(res.corpo.configurado).toBe(false);
    expect(chamadas.some((c) => c.url.includes("github"))).toBe(false);
  });

  it("GitHub recusando o token vira mensagem que pede ação", async () => {
    const { res } = await chamar({ listagem: 401 });
    expect(res.statusCode).toBe(502);
    expect(res.corpo.erro).toMatch(/GITHUB_DISPATCH_TOKEN/);
    const fora = await chamar({ despacho: 500 });
    expect(fora.res.corpo.erro).toMatch(/não respondeu/);
  });

  it("Recalcular: a coordenação do edital dispara a pré-classificação só daquele edital", async () => {
    const edital = "11111111-1111-4111-a111-111111111193";
    const { res, chamadas } = await chamar({
      admin: false,
      coordena: true,
      corpo: { robo: "pre_classificacao", edital },
    });
    expect(res.statusCode).toBe(202);
    const permissao = chamadas.find((c) =>
      c.url.includes("pode_recalcular_pre_classificacao"),
    );
    expect(JSON.parse(permissao.opcoes.body)).toEqual({ p_edital: edital });
    expect(permissao.opcoes.headers.Authorization).toBe(
      "Bearer token-do-usuario",
    );
    const despacho = chamadas.find((c) => c.url.endsWith("/dispatches"));
    expect(despacho.url).toContain("/workflows/pre-classificacao.yml/");
    expect(JSON.parse(despacho.opcoes.body).inputs).toEqual({
      modo: "normal",
      disparado_por: USUARIO,
      editais: edital,
    });
  });

  it("Recalcular: quem não coordena o edital, edital inválido e robô que não é por edital são recusados", async () => {
    const edital = "11111111-1111-4111-a111-111111111193";
    const semCoordenar = await chamar({
      admin: false,
      corpo: { robo: "pre_classificacao", edital },
    });
    expect(semCoordenar.res.statusCode).toBe(403);
    expect(semCoordenar.res.corpo.erro).toMatch(/coordenação da avaliação/);
    expect(semCoordenar.chamadas.some((c) => c.url.includes("github"))).toBe(
      false,
    );
    const invalido = await chamar({
      corpo: { robo: "pre_classificacao", edital: "93/2026" },
    });
    expect(invalido.res.statusCode).toBe(400);
    // O edital não abre os outros robôs para quem não é administrador global.
    const outroRobo = await chamar({
      admin: false,
      coordena: true,
      corpo: { robo: "empregare", edital },
    });
    expect(outroRobo.res.statusCode).toBe(403);
    expect(
      outroRobo.chamadas.some((c) =>
        c.url.includes("pode_recalcular_pre_classificacao"),
      ),
    ).toBe(false);
  });

  it("Rodar agora da pré-classificação pelo administrador: todos os editais", async () => {
    const { res, chamadas } = await chamar({
      corpo: { robo: "pre_classificacao" },
    });
    expect(res.statusCode).toBe(202);
    const despacho = chamadas.find((c) => c.url.endsWith("/dispatches"));
    expect(JSON.parse(despacho.opcoes.body).inputs.editais).toBe("");
  });

  it("só GET e POST", async () => {
    expect((await chamar({ metodo: "DELETE" })).res.statusCode).toBe(405);
  });
});

describe("botão Rodar agora", () => {
  const robo = roboDeCarga("empregare");
  const agora = new Date("2026-10-05T12:00:00Z");
  const ok = { status: "ok", robos: { empregare: { rodando: false } } };

  it("liberado quando nada roda", () => {
    expect(estadoDoBotao({ robo, disponibilidade: ok, agora })).toEqual({
      desabilitado: false,
      rotulo: "Rodar agora",
      aviso: "",
    });
  });

  it("desabilitado enquanto o GitHub roda, o banco registra em andamento ou o pedido acabou de sair", () => {
    expect(
      estadoDoBotao({
        robo,
        disponibilidade: {
          status: "ok",
          robos: { empregare: { rodando: true } },
        },
        agora,
      }).desabilitado,
    ).toBe(true);
    const linha = (minutos) => ({
      partes: [
        {
          ultima: {
            situacao: "andamento",
            inicio: new Date(agora.getTime() - minutos * 60000),
          },
        },
      ],
    });
    expect(
      estadoDoBotao({ robo, disponibilidade: ok, linha: linha(30), agora })
        .rotulo,
    ).toBe("Rodando…");
    // Em andamento há mais que o tempo limite do workflow: execução morta, não segura o botão.
    expect(
      estadoDoBotao({ robo, disponibilidade: ok, linha: linha(500), agora })
        .desabilitado,
    ).toBe(false);
    const pedido = new Date(agora.getTime() - 60000);
    expect(
      estadoDoBotao({ robo, disponibilidade: ok, pedidoEm: pedido, agora })
        .rotulo,
    ).toBe("Pedido enviado");
    const antigo = new Date(
      agora.getTime() - (ESPERA_DO_PEDIDO_MIN + 1) * 60000,
    );
    expect(
      estadoDoBotao({ robo, disponibilidade: ok, pedidoEm: antigo, agora })
        .desabilitado,
    ).toBe(false);
  });

  it("explica quando falta configurar ou fora da versão publicada", () => {
    expect(
      estadoDoBotao({ robo, disponibilidade: { status: "sem_token" } }),
    ).toMatchObject({
      desabilitado: true,
      aviso: expect.stringMatching(/GITHUB_DISPATCH_TOKEN/),
    });
    expect(
      estadoDoBotao({ robo, disponibilidade: { status: "indisponivel" } })
        .aviso,
    ).toBe("Só na versão publicada.");
  });

  it("execução em curso pela lista do GitHub", () => {
    expect(execucaoEmCurso([{ status: "completed" }])).toBeNull();
    expect(
      execucaoEmCurso([{ status: "completed" }, { status: "queued", id: 2 }]),
    ).toMatchObject({ id: 2 });
    expect(execucaoEmCurso(null)).toBeNull();
  });

  it("os workflows da lista existem", async () => {
    const { existsSync } = await import("node:fs");
    for (const r of ROBOS_DE_CARGA)
      expect(existsSync(`.github/workflows/${r.workflow}`), r.workflow).toBe(
        true,
      );
  });
});
