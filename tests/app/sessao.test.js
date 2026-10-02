import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  FASES,
  MENSAGENS,
  configuracaoDaEntrada,
  criarSessao,
  nomeDoUsuario,
} from "../../src/app/sessao.js";
import {
  SAIDA_EXPIRADA,
  declararSaida,
  reiniciarEstadoDeSaidaParaTestes,
} from "../../src/lib/estado-de-saida.js";

/*
  A sessão do app (src/app/sessao.js): entrar, sair, sessão expirada, troca de
  usuário, sem acesso → pedido, domínio não permitido, login Google. O
  Supabase e a janela são falsos; o legado é o adaptador `sistema`.
*/

const sessaoDe = (id, email = `${id}@agenciasus.org.br`) => ({
  access_token: `token-${id}`,
  user: { id, email, user_metadata: { full_name: `Pessoa ${id}` } },
});

const CONTEXTO = {
  profile: { id: "perfil-1", nome: "Ana", ativo: true, permissoes: {} },
  panel_ids: ["painel-1"],
};

function clienteFalso({
  guardada = null,
  contexto = CONTEXTO,
  erroNoContexto = null,
  meuUsuario = null,
  troca = null,
} = {}) {
  let atual = guardada;
  let ouvinte = null;
  const cliente = {
    emitir: (evento, sessao) => ouvinte?.(evento, sessao),
    definirSessao: (sessao) => (atual = sessao),
    auth: {
      onAuthStateChange: vi.fn((funcao) => {
        ouvinte = funcao;
        return { data: { subscription: { unsubscribe() {} } } };
      }),
      getSession: vi.fn(async () => ({
        data: { session: atual },
        error: null,
      })),
      signOut: vi.fn(async () => {
        atual = null;
        ouvinte?.("SIGNED_OUT", null);
        return { error: null };
      }),
      signInWithOAuth: vi.fn(async () => ({
        data: { url: "https://accounts.google.com/o/oauth2" },
        error: null,
      })),
      exchangeCodeForSession: vi.fn(async () =>
        troca instanceof Error
          ? { data: null, error: troca }
          : { data: { session: troca }, error: null },
      ),
    },
    rpc: vi.fn(async (nome) => {
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

function janelaFalsa({ search = "", largura = 1280, popup = null } = {}) {
  const ouvintes = {};
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
    setInterval: vi.fn(() => 1),
    clearInterval: vi.fn(),
    sessionStorage: window.sessionStorage,
    addEventListener: vi.fn((tipo, funcao) => (ouvintes[tipo] = funcao)),
    ouvintes,
  };
}

function sistemaFalso(sobre = {}) {
  return {
    carregarConfiguracao: vi.fn(async () => {}),
    mostrarEsqueleto: vi.fn(),
    aoVerificar: vi.fn(),
    abrir: vi.fn(async () => true),
    aoFicarSemAcesso: vi.fn(),
    aoAtualizarPerfil: vi.fn(),
    antesDeSair: vi.fn(async () => {}),
    aoSair: vi.fn(),
    aoLimparSessao: vi.fn(async () => {}),
    encerrarEspera: vi.fn(),
    ...sobre,
  };
}

function montar({
  cliente = clienteFalso(),
  janela = janelaFalsa(),
  sistema = sistemaFalso(),
  celular = false,
  avisar = vi.fn(),
  temAmbiente = true,
} = {}) {
  const sessao = criarSessao({
    cliente: () => cliente,
    armazenamento: () => ({ clearAuthState: vi.fn() }),
    janela,
    temAmbiente: () => temAmbiente,
    celular: () => celular,
    avisar,
    esperar: async () => {},
  });
  sessao.ligarSistema(sistema);
  return { sessao, cliente, janela, sistema, avisar };
}

const proximoCiclo = () => new Promise((resolve) => setTimeout(resolve, 0));

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
    expect(estado.usuario.id).toBe("u1");
    expect(sistema.encerrarEspera).toHaveBeenCalled();
  });

  it("o skeleton e a cópia (aoVerificar) começam antes da consulta do perfil", async () => {
    const ordem = [];
    const cliente = clienteFalso({ guardada: sessaoDe("u1") });
    const rpcOriginal = cliente.rpc;
    cliente.rpc = vi.fn((...args) => {
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

  it("contexto com erro: avisa e mostra o pedido, como antes", async () => {
    const { sessao, avisar } = montar({
      cliente: clienteFalso({
        guardada: sessaoDe("u1"),
        erroNoContexto: { message: "falhou" },
      }),
    });
    await sessao.iniciar();
    expect(avisar).toHaveBeenCalledWith(MENSAGENS.permissoes, "error");
    expect(sessao.obter().fase).toBe(FASES.SEM_ACESSO);
  });

  it("a carga do login quebrou: pedido sem consulta e a mensagem de liberação", async () => {
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
    expect(estado.fase).toBe(FASES.SEM_ACESSO);
    expect(estado.consultarPedido).toBe(false);
    expect(estado.mensagem.texto).toBe(MENSAGENS.aguardandoLiberacao);
    console.error.mockRestore();
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
  async function conectado(sobre = {}) {
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
    console.warn.mockRestore();
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
    expect(sessao.obter().usuario.email).toBe("u1.novo@agenciasus.org.br");
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
    expect(sessao.obter().usuario.id).toBe("u2");
  });

  it("duas chegadas da mesma sessão ao mesmo tempo carregam uma vez só", async () => {
    let liberar;
    const sistema = sistemaFalso({
      abrir: vi.fn(() => new Promise((resolve) => (liberar = resolve))),
    });
    const { sessao } = montar({ sistema });
    await sessao.iniciar();
    const primeira = sessao.entrar(sessaoDe("u1"), "oauth_popup");
    const segunda = sessao.entrar(sessaoDe("u1"), "oauth_popup");
    await proximoCiclo();
    liberar(true);
    await Promise.all([primeira, segunda]);
    expect(sistema.abrir).toHaveBeenCalledTimes(1);
  });
});

describe("login Google", () => {
  it("no computador: popup no clique, sessão local limpa, escolha de conta", async () => {
    const popup = {
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
    await janela.ouvintes.message({
      origin: "https://monitora.test",
      data: { type: "agsus-monitora:login-concluido" },
    });
    expect(sistema.abrir).toHaveBeenCalledWith(
      expect.objectContaining({ origem: "oauth_popup" }),
    );
  });

  it("mensagem de outra origem é ignorada", async () => {
    const janela = janelaFalsa();
    const { sessao, cliente } = montar({ janela });
    await sessao.iniciar();
    await janela.ouvintes.message({
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
    janela.ouvintes.pageshow({ persisted: true });
    await proximoCiclo();
    expect(sessao.obter().entrando).toBe(false);
  });
});
