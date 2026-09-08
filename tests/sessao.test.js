import { describe, expect, it } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import {
  FalhaDeConexao,
  SESSAO_ATIVA,
  SESSAO_ENCERRADA,
  SESSAO_INDETERMINADA,
  SessaoEncerrada,
  ehFalhaTransitoria,
  ehSessaoEncerrada,
  estadoDaSessao,
  exigirSessao,
} from "../src/lib/sessao.js";

const clienteQue = (resposta) => ({
  auth: {
    getSession: async () => {
      if (resposta instanceof Error) throw resposta;
      return resposta;
    },
  },
});

const sessaoValida = { session: { access_token: "abc", user: { id: "u1" } } };

describe("classificação de falha transitória", () => {
  it("reconhece a falha de rede do auth-js", () => {
    expect(
      ehFalhaTransitoria(new AuthRetryableFetchError("Failed to fetch", 0)),
    ).toBe(true);
  });

  it("reconhece o TypeError que o fetch lança quando a rede cai", () => {
    expect(ehFalhaTransitoria(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("reconhece requisição abortada e tempo esgotado", () => {
    const abortada = new Error("abort");
    abortada.name = "AbortError";
    expect(ehFalhaTransitoria(abortada)).toBe(true);
  });

  it("reconhece indisponibilidade temporária do servidor", () => {
    expect(ehFalhaTransitoria({ status: 503 })).toBe(true);
    expect(ehFalhaTransitoria({ status: 429 })).toBe(true);
  });

  it("não confunde falta de permissão com falha de rede", () => {
    expect(ehFalhaTransitoria({ status: 403, code: "42501" })).toBe(false);
  });
});

describe("classificação de sessão encerrada", () => {
  it("aceita a ausência de sessão declarada pela biblioteca", () => {
    expect(ehSessaoEncerrada(new AuthSessionMissingError())).toBe(true);
  });

  it("aceita 401 vindo da API de autenticação", () => {
    expect(
      ehSessaoEncerrada(new AuthApiError("invalid claim", 401, "bad_jwt")),
    ).toBe(true);
  });

  it("aceita os códigos de JWT vencido do PostgREST", () => {
    expect(ehSessaoEncerrada({ code: "PGRST301" })).toBe(true);
  });

  /*
    Este é o teste da regressão original. A mensagem abaixo é uma função ausente
    no banco — contém a palavra "session" no nome do parâmetro, e era isso que
    fazia o sistema anunciar expiração a quem estava perfeitamente autenticado.
  */
  it("não trata função ausente como sessão expirada", () => {
    const ausente = {
      code: "PGRST202",
      message:
        "Could not find the function public.registrar_evento_acesso(p_client_session_id, p_evento) in the schema cache",
    };
    expect(ehSessaoEncerrada(ausente)).toBe(false);
  });

  it("não trata falta de permissão como sessão expirada", () => {
    expect(
      ehSessaoEncerrada(new AuthApiError("forbidden", 403, "not_admin")),
    ).toBe(false);
    expect(
      ehSessaoEncerrada({
        code: "42501",
        message: "permission denied for table configuracoes",
      }),
    ).toBe(false);
  });

  it("não trata queda de rede como sessão expirada", () => {
    expect(
      ehSessaoEncerrada(new AuthRetryableFetchError("Failed to fetch", 0)),
    ).toBe(false);
    expect(ehSessaoEncerrada(new TypeError("Failed to fetch"))).toBe(false);
  });
});

describe("estado da sessão", () => {
  it("é ativa quando há token", async () => {
    const r = await estadoDaSessao(
      clienteQue({ data: sessaoValida, error: null }),
    );
    expect(r.estado).toBe(SESSAO_ATIVA);
    expect(r.sessao.access_token).toBe("abc");
  });

  it("é encerrada quando a leitura funciona e não há sessão guardada", async () => {
    const r = await estadoDaSessao(
      clienteQue({ data: { session: null }, error: null }),
    );
    expect(r.estado).toBe(SESSAO_ENCERRADA);
  });

  /*
    O caso que motivou tudo: a renovação do token falhou porque a rede caiu. A
    sessão continua válida — só não deu para confirmar agora.
  */
  it("é indeterminada quando a rede falha, nunca encerrada", async () => {
    const r = await estadoDaSessao(
      clienteQue({
        data: { session: null },
        error: new AuthRetryableFetchError("Failed to fetch", 0),
      }),
    );
    expect(r.estado).toBe(SESSAO_INDETERMINADA);
  });

  it("é indeterminada quando getSession lança por rede", async () => {
    const r = await estadoDaSessao(
      clienteQue(new TypeError("Failed to fetch")),
    );
    expect(r.estado).toBe(SESSAO_INDETERMINADA);
  });

  it("é indeterminada, e não encerrada, sem cliente algum", async () => {
    expect((await estadoDaSessao(null)).estado).toBe(SESSAO_INDETERMINADA);
  });
});

describe("exigirSessao", () => {
  it("devolve a sessão quando ativa", async () => {
    const s = await exigirSessao(
      clienteQue({ data: sessaoValida, error: null }),
    );
    expect(s.access_token).toBe("abc");
  });

  it("lança SessaoEncerrada só com prova", async () => {
    await expect(
      exigirSessao(clienteQue({ data: { session: null }, error: null })),
    ).rejects.toBeInstanceOf(SessaoEncerrada);
  });

  it("lança FalhaDeConexao — não SessaoEncerrada — quando a rede cai", async () => {
    const erro = await exigirSessao(
      clienteQue({
        data: null,
        error: new AuthRetryableFetchError("Failed to fetch", 0),
      }),
    ).catch((e) => e);
    expect(erro).toBeInstanceOf(FalhaDeConexao);
    expect(erro.sessaoEncerrada).toBeUndefined();
    expect(erro.message).not.toContain("Sessão expirada");
  });
});
