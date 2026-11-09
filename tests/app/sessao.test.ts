import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FASES,
  MENSAGENS,
  configuracaoDaEntrada,
  criarSessao,
  nomeDoUsuario,
} from "../../src/app/sessao.ts";
import type { GanchosDoSistema } from "../../src/app/sessao.ts";
import {
  SAIDA_EXPIRADA,
  declararSaida,
  reiniciarEstadoDeSaidaParaTestes,
} from "../../src/lib/estado-de-saida";
import { definido } from "../definido.ts";
import { sessaoFalsa } from "../supabase-falso.ts";

/*
  A sessão do app (src/app/sessao.ts): entrar, sair, sessão expirada, troca de
  usuário, sem acesso → pedido, domínio não permitido, login Google. O
  Supabase e a janela são falsos; o legado é o adaptador `sistema`.
*/

/* A sessão do Supabase com o token, o id, o e-mail e o nome do teste. */
const sessaoDe = (id: string, email = `${id}@agenciasus.org.br`): Session => {
  const base = sessaoFalsa(`token-${id}`);
  return {
    ...base,
    user: {
      ...base.user,
      id,
      email,
      user_metadata: { full_name: `Pessoa ${id}` },
    },
  };
};

const CONTEXTO = {
  profile: { id: "perfil-1", nome: "Ana", ativo: true, permissoes: {} },
  panel_ids: ["painel-1"],
};

type RespostaDaRpc = { data: unknown; error: unknown };
type RpcFalsa = (
  nome: string,
  argumentos?: Record<string, unknown>,
) => Promise<RespostaDaRpc>;
type OuvinteDaAutenticacao = (evento: string, sessao: Session | null) => void;

interface OpcoesDoCliente {
  guardada?: Session | null;
  contexto?: unknown;
  erroNoContexto?: { message: string } | null;
  meuUsuario?: unknown;
  troca?: Session | Error | null;
}

function clienteFalso({
  guardada = null,
  contexto = CONTEXTO,
  erroNoContexto = null,
  meuUsuario = null,
  troca = null,
}: OpcoesDoCliente = {}) {
  let atual = guardada;
  let ouvinte: OuvinteDaAutenticacao | null = null;
  const cliente = {
    emitir: (evento: string, sessao: Session | null) =>
      ouvinte?.(evento, sessao),
    definirSessao: (sessao: Session | null) => (atual = sessao),
    auth: {
      onAuthStateChange: vi.fn((funcao: OuvinteDaAutenticacao) => {
        ouvinte = funcao;
        return { data: { subscription: { unsubscribe() {} } } };
      }),
      getSession: vi.fn(async () => ({
        data: { session: atual },
        error: null,
      })),
      signOut: vi.fn(
        async (_opcoes?: {
          scope?: string;
        }): Promise<{ error: Error | null }> => {
          atual = null;
          ouvinte?.("SIGNED_OUT", null);
          return { error: null };
        },
      ),
      signInWithOAuth: vi.fn<
        (pedido?: unknown) => Promise<{ data?: unknown; error: unknown }>
      >(async () => ({
        data: { url: "https://accounts.google.com/o/oauth2" },
        error: null,
      })),
      exchangeCodeForSession: vi.fn(async (_codigo: string) =>
        troca instanceof Error
          ? { data: null, error: troca }
          : { data: { session: troca }, error: null },
      ),
    },
    rpc: vi.fn<RpcFalsa>(async (nome) => {
      if (nome === "obter_contexto_monitora")
        return erroNoContexto
          ? { data: null, error: erroNoContexto }
          : { data: contexto, error: null };
      if (nome === "meu_usuario") return { data: meuUsuario, error: null };
      return { data: null, error: null };
    }),
  };
  return cliente;
}
type ClienteFalso = ReturnType<typeof clienteFalso>;

/*
  O cliente e a janela de mentira só têm o que a sessão usa; os tipos do
  Supabase e de Window descrevem muito mais. A guarda confere a forma
  mínima e devolve o próprio objeto do teste (sem cópia: o teste troca
  `rpc` e `signInWithOAuth` depois de montar).
*/
function comoSupabase(cliente: ClienteFalso): SupabaseClient {
  if (!ehClienteSupabase(cliente)) throw new TypeError("cliente sem auth/rpc");
  return cliente;
}
function ehClienteSupabase(cliente: object): cliente is SupabaseClient {
  return "auth" in cliente && "rpc" in cliente;
}

type PopupFalso = {
  closed: boolean;
  location: { replace: (endereco: string) => void };
  close: () => void;
};
type OuvinteDaJanela = (evento: Record<string, unknown>) => unknown;

function janelaFalsa({
  search = "",
  largura = 1280,
  popup = null,
}: { search?: string; largura?: number; popup?: PopupFalso | null } = {}) {
  const ouvintes: Record<string, OuvinteDaJanela> = {};
  return {
    location: {
      search,
      hash: "",
      pathname: "/",
      origin: "https://monitora.test",
      href: `https://monitora.test/${search}`,
    },
    history: { replaceState: vi.fn() },
    document: { title: "MONITORA" },
    innerWidth: largura,
    screenX: 0,
    screenY: 0,
    outerWidth: largura,
    outerHeight: 900,
    open: vi.fn(() => popup),
    setInterval: vi.fn((_vigia: () => unknown, _ms?: number) => 1),
    clearInterval: vi.fn(),
    sessionStorage: window.sessionStorage,
    addEventListener: vi.fn(
      (tipo: string, funcao: OuvinteDaJanela) => (ouvintes[tipo] = funcao),
    ),
    ouvintes,
  };
}
type JanelaFalsa = ReturnType<typeof janelaFalsa>;

function comoJanela(janela: JanelaFalsa): Window {
  if (!ehJanela(janela)) throw new TypeError("janela sem location");
  return janela;
}
function ehJanela(janela: object): janela is Window {
  return "location" in janela && "addEventListener" in janela;
}

function sistemaFalso(sobre: GanchosDoSistema = {}) {
  return {
    carregarConfiguracao: vi.fn(async () => {}),
    mostrarEsqueleto: vi.fn(),
    aoVerificar: vi.fn(),
    abrir: vi.fn(async () => true),
    aoFicarSemAcesso: vi.fn(),
    aoFalharNaEntrada: vi.fn(),
    aoAtualizarPerfil: vi.fn(),
    antesDeSair: vi.fn(async () => {}),
    aoSair: vi.fn(),
    aoLimparSessao: vi.fn(async () => {}),
    encerrarEspera: vi.fn(),
    ...sobre,
  };
}

interface OpcoesDaMontagem {
  cliente?: ClienteFalso;
  janela?: JanelaFalsa;
  sistema?: ReturnType<typeof sistemaFalso>;
  celular?: boolean;
  temAmbiente?: boolean;
  armazenamento?: { clearAuthState: () => void };
}

function montar({
  cliente = clienteFalso(),
  janela = janelaFalsa(),
  sistema = sistemaFalso(),
  celular = false,
  temAmbiente = true,
  armazenamento = { clearAuthState: vi.fn() },
}: OpcoesDaMontagem = {}) {
  const sessao = criarSessao({
    cliente: () => comoSupabase(cliente),
    armazenamento: () => armazenamento,
    janela: comoJanela(janela),
    temAmbiente: () => temAmbiente,
    celular: () => celular,
    esperar: async () => {},
  });
  sessao.ligarSistema(sistema);
  return { sessao, cliente, janela, sistema };
}

const proximoCiclo = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 0));

beforeEach(() => {
  reiniciarEstadoDeSaidaParaTestes();
  sessionStorage.clear();
});

describe("entrar", () => {
  it("sessão guardada: confere o perfil e abre o sistema", async () => {
    const { sessao, sistema } = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u1") }),
    });
    await sessao.iniciar();

    expect(sistema.carregarConfiguracao).toHaveBeenCalled();
    expect(sistema.aoVerificar).toHaveBeenCalledWith(
      expect.objectContaining({ origem: "boot" }),
    );
    expect(sistema.abrir).toHaveBeenCalledWith(
      expect.objectContaining({
        origem: "boot",
        perfil: expect.objectContaining({ id: "perfil-1" }),
        painelIds: ["painel-1"],
        contextoCarregado: true,
      }),
    );
    const estado = sessao.obter();
    expect(estado.fase).toBe(FASES.CONECTADO);
    expect(estado.usuario?.id).toBe("u1");
    expect(sistema.encerrarEspera).toHaveBeenCalled();
  });

  it("o skeleton e a cópia (aoVerificar) começam antes da consulta do perfil", async () => {
    const ordem: unknown[] = [];
    const cliente = clienteFalso({ guardada: sessaoDe("u1") });
    const rpcOriginal = cliente.rpc;
    cliente.rpc = vi.fn<RpcFalsa>((...args) => {
      ordem.push(args[0]);
      return rpcOriginal(...args);
    });
    const { sessao } = montar({
      cliente,
      sistema: sistemaFalso({ aoVerificar: () => ordem.push("aoVerificar") }),
    });
    await sessao.iniciar();
    expect(ordem.slice(0, 2)).toEqual([
      "aoVerificar",
      "obter_contexto_monitora",
    ]);
  });

  it("sem contexto unificado, usa meu_usuario (sem reviver permissões amplas)", async () => {
    const { sessao, sistema } = montar({
      cliente: clienteFalso({
        guardada: sessaoDe("u1"),
        contexto: null,
        meuUsuario: [{ id: "p2", nome: "Bia", ativo: null }],
      }),
    });
    await sessao.iniciar();
    expect(sistema.abrir).toHaveBeenCalledWith(
      expect.objectContaining({
        perfil: { id: "p2", nome: "Bia", ativo: true, permissoes: {} },
        contextoCarregado: false,
      }),
    );
  });

  it("os dados não vieram: volta à tela de acesso, sem abrir", async () => {
    const { sessao } = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u1") }),
      sistema: sistemaFalso({ abrir: vi.fn(async () => false) }),
    });
    await sessao.iniciar();
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
  });

  it("sem sessão guardada: tela de acesso, sem perfil", async () => {
    const { sessao, sistema, cliente } = montar();
    await sessao.iniciar();
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    expect(cliente.rpc).not.toHaveBeenCalled();
    expect(sistema.encerrarEspera).toHaveBeenCalled();
  });

  it("sem as variáveis do Supabase: aviso de configuração", async () => {
    const { sessao } = montar({ temAmbiente: false });
    await sessao.iniciar();
    expect(sessao.obter().erroDeConfiguracao).toContain("VITE_SUPABASE_URL");
  });

  it("volta do Google com ?code=: troca o código (PKCE) e abre", async () => {
    const cliente = clienteFalso({ troca: sessaoDe("u3") });
    const { sessao, sistema, janela } = montar({
      cliente,
      janela: janelaFalsa({ search: "?code=abc" }),
    });
    await sessao.iniciar();
    expect(cliente.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(sistema.mostrarEsqueleto).toHaveBeenCalled();
    expect(sistema.abrir).toHaveBeenCalledWith(
      expect.objectContaining({ origem: "oauth_callback" }),
    );
    expect(janela.history.replaceState).toHaveBeenCalled();
  });

  it("código recusado: mensagem e tela de acesso", async () => {
    const { sessao } = montar({
      cliente: clienteFalso({ troca: new Error("invalid grant") }),
      janela: janelaFalsa({ search: "?code=abc" }),
    });
    await sessao.iniciar();
    expect(sessao.obter().mensagem).toEqual({
      texto: MENSAGENS.falhaNoRetorno,
      tom: "error",
    });
  });

  it("?auth_error=: a mensagem do retorno aparece", async () => {
    const { sessao } = montar({
      janela: janelaFalsa({ search: "?auth_error=oauth_callback" }),
    });
    await sessao.iniciar();
    expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.falhaNoRetorno);
  });

  it("link de recuperação de senha: sai e mostra a mensagem configurada", async () => {
    const sistema = sistemaFalso({
      carregarConfiguracao: vi.fn(async () =>
        sessao.definirConfiguracao({
          password_reset_message: "Peça a redefinição ao administrador.",
        }),
      ),
    });
    const { sessao, cliente } = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u1") }),
      janela: janelaFalsa({ search: "?type=recovery" }),
      sistema,
    });
    await sessao.iniciar();
    expect(cliente.auth.signOut).toHaveBeenCalled();
    expect(sessao.obter().mensagem.texto).toBe(
      "Peça a redefinição ao administrador.",
    );
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
  });
});

describe("sem acesso → pedido", () => {
  it("sem perfil ativo: fase do pedido, o legado esconde o sistema", async () => {
    const { sessao, sistema } = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u1"), contexto: null }),
    });
    await sessao.iniciar();
    const estado = sessao.obter();
    expect(estado.fase).toBe(FASES.SEM_ACESSO);
    expect(estado.consultarPedido).toBe(true);
    expect(estado.perfil).toBeNull();
    expect(sistema.aoFicarSemAcesso).toHaveBeenCalled();
    expect(sistema.abrir).not.toHaveBeenCalled();
  });

  it("contexto com erro: falha na entrada (Tentar de novo), não o pedido", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sessao, sistema } = montar({
      cliente: clienteFalso({
        guardada: sessaoDe("u1"),
        erroNoContexto: { message: "falhou" },
      }),
    });
    await sessao.iniciar();
    const estado = sessao.obter();
    expect(estado.fase).toBe(FASES.FALHA_NA_ENTRADA);
    expect(estado.mensagem).toEqual({
      texto: MENSAGENS.permissoes,
      tom: "error",
    });
    expect(sistema.aoFalharNaEntrada).toHaveBeenCalled();
    expect(sistema.aoFicarSemAcesso).not.toHaveBeenCalled();
    expect(sistema.abrir).not.toHaveBeenCalled();
    vi.mocked(console.warn).mockRestore();
  });

  it("Tentar de novo relê o perfil com a mesma sessão e abre o sistema", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cliente = clienteFalso({
      guardada: sessaoDe("u1"),
      erroNoContexto: { message: "falhou" },
    });
    const { sessao, sistema } = montar({ cliente });
    await sessao.iniciar();
    cliente.rpc.mockImplementation(async (nome) =>
      nome === "obter_contexto_monitora"
        ? { data: CONTEXTO, error: null }
        : { data: null, error: null },
    );
    await sessao.tentarDeNovo();
    expect(sessao.obter().fase).toBe(FASES.CONECTADO);
    expect(sistema.abrir).toHaveBeenCalledTimes(1);
    vi.mocked(console.warn).mockRestore();
  });

  it("perfil ilegível com o sistema aberto: fica o perfil que estava", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cliente = clienteFalso({ guardada: sessaoDe("u1") });
    const { sessao, sistema } = montar({ cliente });
    await sessao.iniciar();
    cliente.rpc.mockImplementation(async () => ({
      data: null,
      error: { message: "sem rede" },
    }));
    await sessao.recarregarPerfil(sessaoDe("u1"));
    expect(sessao.obter().fase).toBe(FASES.CONECTADO);
    expect(sessao.obter().perfil).toEqual(CONTEXTO.profile);
    expect(sistema.aoFicarSemAcesso).not.toHaveBeenCalled();
    vi.mocked(console.warn).mockRestore();
  });

  it("a carga do login quebrou: falha na entrada, não o pedido de acesso", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { sessao } = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u1") }),
      sistema: sistemaFalso({
        abrir: vi.fn(async () => {
          throw new Error("quebrou");
        }),
      }),
    });
    await sessao.iniciar();
    const estado = sessao.obter();
    expect(estado.fase).toBe(FASES.FALHA_NA_ENTRADA);
    expect(estado.mensagem.texto).toBe(MENSAGENS.falhaAoAbrir);
    vi.mocked(console.error).mockRestore();
  });

  it("o nome do Google preenche o pedido", () => {
    expect(nomeDoUsuario({ user_metadata: { name: "Caio" } })).toBe("Caio");
    expect(nomeDoUsuario({ email: "dani@agsus.org.br" })).toBe("dani");
    expect(nomeDoUsuario(null)).toBe("");
  });
});

describe("domínio permitido", () => {
  it("e-mail fora dos domínios: sai e diz qual conta usar", async () => {
    const { sessao, sistema, cliente } = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u9", "u9@gmail.com") }),
    });
    await sessao.iniciar();
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(sistema.abrir).not.toHaveBeenCalled();
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    expect(sessao.obter().mensagem).toEqual({
      texto:
        "Use uma conta institucional (@agenciasus.org.br ou @agsus.org.br).",
      tom: "error",
    });
  });

  it("os domínios vêm da configuração", async () => {
    const sistema = sistemaFalso({
      carregarConfiguracao: vi.fn(async () =>
        sessao.definirConfiguracao({
          auth_google_allowed_domains: "@gmail.com",
        }),
      ),
    });
    const { sessao } = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u9", "u9@gmail.com") }),
      sistema,
    });
    await sessao.iniciar();
    expect(sessao.obter().fase).toBe(FASES.CONECTADO);
  });

  it("configuração da entrada: padrões e o que veio do banco", () => {
    expect(configuracaoDaEntrada()).toMatchObject({
      googleAtivo: true,
      dominios: ["agenciasus.org.br", "agsus.org.br"],
    });
    expect(
      configuracaoDaEntrada({
        auth_google_enabled: "não",
        auth_google_button_text: " Entrar ",
        auth_google_domain_hint: "agenciasus.org.br",
      }),
    ).toMatchObject({
      googleAtivo: false,
      textoDoBotao: "Entrar",
      dicaDeDominio: "agenciasus.org.br",
    });
  });
});

describe("sair e sessão expirada", () => {
  async function conectado(sobre: OpcoesDaMontagem = {}) {
    const montado = montar({
      cliente: clienteFalso({ guardada: sessaoDe("u1") }),
      ...sobre,
    });
    await montado.sessao.iniciar();
    expect(montado.sessao.obter().fase).toBe(FASES.CONECTADO);
    return montado;
  }

  it("sair: auditoria antes, signOut, tela de acesso sem mensagem de falha", async () => {
    const { sessao, sistema, cliente } = await conectado();
    await sessao.sair();
    expect(sistema.antesDeSair).toHaveBeenCalled();
    expect(cliente.auth.signOut).toHaveBeenCalled();
    expect(sistema.aoSair).toHaveBeenCalledTimes(1);
    const estado = sessao.obter();
    expect(estado.fase).toBe(FASES.DESLOGADO);
    expect(estado.usuario).toBeNull();
    expect(estado.perfil).toBeNull();
    expect(estado.mensagem.texto).toBe("");

    // Um segundo SIGNED_OUT continua sendo a mesma saída (não "expirou").
    cliente.emitir("SIGNED_OUT", null);
    expect(sessao.obter().mensagem.texto).toBe("");
    expect(sistema.aoSair).toHaveBeenCalledTimes(1);
  });

  it("sair continua mesmo se a auditoria falhar", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const { sessao } = await conectado({
      sistema: sistemaFalso({
        antesDeSair: vi.fn(async () => {
          throw new Error("rede");
        }),
      }),
    });
    await sessao.sair();
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    vi.mocked(console.warn).mockRestore();
  });

  it("sair com signOut devolvendo erro (rede fora, token vencido) apaga o token local", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const armazenamento = { clearAuthState: vi.fn() };
    const { sessao, cliente } = await conectado({ armazenamento });
    armazenamento.clearAuthState.mockClear();
    // A auth-js devolve o erro sem apagar a sessão nem emitir SIGNED_OUT.
    cliente.auth.signOut.mockImplementationOnce(async () => ({
      error: new Error("Failed to fetch"),
    }));
    await sessao.sair();
    expect(armazenamento.clearAuthState).toHaveBeenCalled();
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    vi.mocked(console.warn).mockRestore();
  });

  it("sair com signOut lançando exceção também apaga o token local", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const armazenamento = { clearAuthState: vi.fn() };
    const { sessao, cliente } = await conectado({ armazenamento });
    armazenamento.clearAuthState.mockClear();
    cliente.auth.signOut.mockImplementationOnce(async () => {
      throw new Error("rede");
    });
    await sessao.sair();
    expect(armazenamento.clearAuthState).toHaveBeenCalled();
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
    vi.mocked(console.warn).mockRestore();
  });

  it("sair com signOut bem-sucedido não precisa apagar à mão", async () => {
    const armazenamento = { clearAuthState: vi.fn() };
    const { sessao } = await conectado({ armazenamento });
    armazenamento.clearAuthState.mockClear();
    await sessao.sair();
    expect(armazenamento.clearAuthState).not.toHaveBeenCalled();
  });

  it("sessão expirada (com prova): a mensagem de expiração", async () => {
    const { sessao, cliente } = await conectado();
    declararSaida(SAIDA_EXPIRADA);
    cliente.emitir("SIGNED_OUT", null);
    expect(sessao.obter().mensagem).toEqual({
      texto: "Sessão encerrada. Faça login novamente.",
      tom: "warn",
    });
    expect(sessao.obter().fase).toBe(FASES.DESLOGADO);
  });

  it("aviso de inatividade (session-lifecycle) chega pela mensagem", () => {
    const { sessao } = montar();
    sessao.mostrarMensagem(
      "Sua sessão foi encerrada após 1 hora de inatividade.",
      "warn",
    );
    expect(sessao.obter().mensagem.tom).toBe("warn");
  });

  it("voltar ao login: limpa a cópia e diz que a sessão foi limpa", async () => {
    const { sessao, sistema } = await conectado();
    await sessao.limparSessao();
    expect(sistema.aoLimparSessao).toHaveBeenCalled();
    expect(sessao.obter().mensagem).toEqual({
      texto: MENSAGENS.sessaoLimpa,
      tom: "ok",
    });
  });

  it("token renovado só atualiza o usuário", async () => {
    const { sessao, cliente, sistema } = await conectado();
    const renovada = sessaoDe("u1");
    renovada.user.email = "u1.novo@agenciasus.org.br";
    cliente.emitir("TOKEN_REFRESHED", renovada);
    expect(sessao.obter().usuario?.email).toBe("u1.novo@agenciasus.org.br");
    expect(sistema.abrir).toHaveBeenCalledTimes(1);
  });

  it("perfil atualizado (USER_UPDATED) com o sistema aberto avisa o legado", async () => {
    const { sessao, cliente, sistema } = await conectado();
    cliente.emitir("USER_UPDATED", sessaoDe("u1"));
    await proximoCiclo();
    await proximoCiclo();
    expect(sistema.aoAtualizarPerfil).toHaveBeenCalledWith(
      expect.objectContaining({ painelIds: ["painel-1"] }),
    );
    expect(sessao.obter().fase).toBe(FASES.CONECTADO);
  });
});

describe("troca de usuário na mesma aba", () => {
  it("SIGNED_IN do mesmo usuário não recarrega; de outro, recarrega tudo", async () => {
    const cliente = clienteFalso({ guardada: sessaoDe("u1") });
    const { sessao, sistema } = montar({ cliente });
    await sessao.iniciar();
    expect(sistema.abrir).toHaveBeenCalledTimes(1);

    cliente.emitir("SIGNED_IN", sessaoDe("u1"));
    await proximoCiclo();
    expect(sistema.abrir).toHaveBeenCalledTimes(1);

    cliente.definirSessao(sessaoDe("u2"));
    cliente.emitir("SIGNED_IN", sessaoDe("u2"));
    await proximoCiclo();
    await proximoCiclo();
    expect(sistema.abrir).toHaveBeenCalledTimes(2);
    expect(sistema.abrir).toHaveBeenLastCalledWith(
      expect.objectContaining({
        origem: "oauth",
        usuario: expect.objectContaining({ id: "u2" }),
      }),
    );
    expect(sessao.obter().usuario?.id).toBe("u2");
  });

  it("duas chegadas da mesma sessão ao mesmo tempo carregam uma vez só", async () => {
    let liberar: ((aberto: boolean) => void) | undefined;
    const sistema = sistemaFalso({
      abrir: vi.fn(
        () => new Promise<boolean>((resolve) => (liberar = resolve)),
      ),
    });
    const { sessao } = montar({ sistema });
    await sessao.iniciar();
    const primeira = sessao.entrar(sessaoDe("u1"), "oauth_popup");
    const segunda = sessao.entrar(sessaoDe("u1"), "oauth_popup");
    await proximoCiclo();
    definido(liberar)(true);
    await Promise.all([primeira, segunda]);
    expect(sistema.abrir).toHaveBeenCalledTimes(1);
  });
});

describe("login Google", () => {
  it("no computador: popup no clique, sessão local limpa, escolha de conta", async () => {
    const popup: PopupFalso = {
      closed: false,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    const janela = janelaFalsa({ popup });
    const { sessao, cliente } = montar({ janela });
    sessao.definirConfiguracao({
      auth_google_domain_hint: "agenciasus.org.br",
    });
    await sessao.entrarComGoogle();

    expect(janela.open).toHaveBeenCalled();
    expect(cliente.auth.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(cliente.auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: "google",
      options: {
        redirectTo: "https://monitora.test/auth/callback.html",
        queryParams: { prompt: "select_account", hd: "agenciasus.org.br" },
        skipBrowserRedirect: true,
      },
    });
    expect(popup.location.replace).toHaveBeenCalledWith(
      "https://accounts.google.com/o/oauth2",
    );
    // O botão fica ocupado enquanto a janela do Google está aberta.
    expect(sessao.obter().entrando).toBe(true);
    expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.escolherConta);
  });

  it("o popup avisa o fim do login: a sessão entra", async () => {
    const janela = janelaFalsa();
    const cliente = clienteFalso();
    const { sessao, sistema } = montar({ janela, cliente });
    await sessao.iniciar();
    cliente.definirSessao(sessaoDe("u5"));
    await definido(janela.ouvintes.message)({
      origin: "https://monitora.test",
      data: { type: "agsus-monitora:login-concluido", result: "success" },
    });
    expect(sistema.abrir).toHaveBeenCalledWith(
      expect.objectContaining({ origem: "oauth_popup" }),
    );
  });

  it("o popup avisa que falhou: mensagem certa na hora e o vigia da janela sai", async () => {
    const popup: PopupFalso = {
      closed: false,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    const janela = janelaFalsa({ popup });
    janela.setInterval = vi.fn(() => 7);
    const { sessao, cliente } = montar({ janela });
    await sessao.iniciar();
    await sessao.entrarComGoogle();
    const vigia = definido(janela.setInterval.mock.calls[0])[0];
    const consultas = cliente.auth.getSession.mock.calls.length;

    await definido(janela.ouvintes.message)({
      origin: "https://monitora.test",
      data: {
        type: "agsus-monitora:login-concluido",
        result: "oauth_callback",
      },
    });
    expect(janela.clearInterval).toHaveBeenCalledWith(7);
    expect(sessao.obter().entrando).toBe(false);
    expect(sessao.obter().mensagem).toEqual({
      texto: MENSAGENS.falhaNoRetorno,
      tom: "error",
    });
    // Sem esperar sessão que não vem.
    expect(cliente.auth.getSession).toHaveBeenCalledTimes(consultas);

    // A janela fechou por conclusão: nada de "fechada antes de concluir".
    popup.closed = true;
    await vigia();
    expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.falhaNoRetorno);
  });

  it("janela fechada e a sessão não pôde ser lida: o botão volta", async () => {
    const popup: PopupFalso = {
      closed: false,
      location: { replace: vi.fn() },
      close: vi.fn(),
    };
    const janela = janelaFalsa({ popup });
    const { sessao, cliente } = montar({ janela });
    await sessao.iniciar();
    await sessao.entrarComGoogle();
    const vigia = definido(janela.setInterval.mock.calls[0])[0];
    const erro = vi.spyOn(console, "error").mockImplementation(() => {});
    cliente.auth.getSession.mockRejectedValue(new Error("armazenamento"));
    popup.closed = true;
    vigia();
    await proximoCiclo();
    expect(sessao.obter().entrando).toBe(false);
    expect(sessao.obter().mensagem).toEqual({
      texto: MENSAGENS.falhaNoPopup,
      tom: "error",
    });
    erro.mockRestore();
  });

  it("mensagem de outra origem é ignorada", async () => {
    const janela = janelaFalsa();
    const { sessao, cliente } = montar({ janela });
    await sessao.iniciar();
    await definido(janela.ouvintes.message)({
      origin: "https://outro.site",
      data: { type: "agsus-monitora:login-concluido" },
    });
    expect(cliente.auth.getSession).toHaveBeenCalledTimes(1);
  });

  it("falha ao iniciar: o botão volta e a mensagem diz o motivo", async () => {
    const cliente = clienteFalso();
    cliente.auth.signInWithOAuth = vi.fn(async () => ({
      data: null,
      error: { message: "provedor desligado" },
    }));
    const { sessao } = montar({ cliente });
    await sessao.entrarComGoogle();
    expect(sessao.obter().entrando).toBe(false);
    expect(sessao.obter().mensagem).toEqual({
      texto: "Falha ao iniciar login Google: provedor desligado",
      tom: "error",
    });
  });

  it("no celular: redirecionamento, sem popup e sem signOut", async () => {
    const janela = janelaFalsa({ largura: 390 });
    const { sessao, cliente } = montar({ janela, celular: true });
    await sessao.entrarComGoogle();
    expect(janela.open).not.toHaveBeenCalled();
    expect(cliente.auth.signOut).not.toHaveBeenCalled();
    expect(cliente.auth.signInWithOAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          queryParams: { prompt: "select_account consent", max_age: "0" },
        }),
      }),
    );
  });

  it("no celular, se o OAuth não inicia: botão volta e o erro aparece", async () => {
    const cliente = clienteFalso();
    cliente.auth.signInWithOAuth = vi.fn(async () => ({
      error: new Error("OAuth indisponível"),
    }));
    const { sessao } = montar({ cliente, celular: true });
    await sessao.entrarComGoogle();
    expect(sessao.obter().entrando).toBe(false);
    expect(sessao.obter().mensagem.texto).toBe("OAuth indisponível");
  });

  it("Google desligado nas configurações: não abre nada", async () => {
    const janela = janelaFalsa();
    const { sessao, cliente } = montar({ janela });
    sessao.definirConfiguracao({ auth_google_enabled: "false" });
    await sessao.entrarComGoogle();
    expect(janela.open).not.toHaveBeenCalled();
    expect(cliente.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(sessao.obter().mensagem.texto).toBe(MENSAGENS.googleDesligado);
  });

  it("voltar do Google pelo histórico sem sessão: o botão volta", async () => {
    const janela = janelaFalsa();
    const { sessao } = montar({ janela, celular: true });
    await sessao.iniciar();
    await sessao.entrarComGoogle();
    expect(sessao.obter().entrando).toBe(true);
    definido(janela.ouvintes.pageshow)({ persisted: true });
    await proximoCiclo();
    expect(sessao.obter().entrando).toBe(false);
  });
});
