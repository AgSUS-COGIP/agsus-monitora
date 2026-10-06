import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 20000 });
import { clicar, digitar, esperar, teclar } from "../componentes/interacoes.js";
import { reacoesComAlternancia } from "../../src/lib/chat.js";
import { definirNaoLidasDaAba } from "../../src/lib/identidade-da-aba.js";

/*
  O chat (src/modulos/chat/): o ícone "Mensagens" no cabeçalho só com o
  recurso "chat"; o contador de não lidas (ícone e aba); o painel carregado
  sob demanda com a lista; abrir, enviar (Enter), editar e apagar a própria
  mensagem; o Realtime sem duplicar; e abrir pela pessoa online e pelo botão
  "Conversa" do edital.
*/

const { montarChat } = await import("../../src/modulos/chat/chat.jsx");
const { abrirConversaDoEdital } =
  await import("../../src/modulos/chat/ponte.js");

const EU = "00000000-0000-4000-a000-000000000001";
const ANA = "00000000-0000-4000-a000-000000000002";
const agora = new Date();
const hoje = (min) => new Date(agora.getTime() - min * 60000).toISOString();

const DIRETA = {
  id: "c-direta",
  tipo: "DIRETA",
  participantes: [
    { id: EU, nome: "Eu Mesma" },
    { id: ANA, nome: "Ana Souza", online: true },
  ],
  nao_lidas: 2,
  mencoes: 1,
  silenciada: false,
  atualizada_em: hoje(5),
  ultima: { id: "m2", autor: ANA, texto: "Viu @Eu Mesma?", criada_em: hoje(5) },
};
const GRUPO = {
  id: "c-grupo",
  tipo: "GRUPO",
  nome: "Equipe RH",
  participantes: [{ id: EU, nome: "Eu Mesma" }],
  nao_lidas: 1,
  silenciada: false,
  atualizada_em: hoje(60),
  ultima: { id: "g1", autor: EU, texto: "ok", criada_em: hoje(60) },
};
const SILENCIADA = {
  ...GRUPO,
  id: "c-mudo",
  nome: "Mudo",
  nao_lidas: 7,
  silenciada: true,
};

const MENSAGENS = [
  {
    id: "m1",
    conversa: "c-direta",
    autor: EU,
    texto: "Oi Ana",
    mencoes: [],
    criada_em: hoje(10),
    apagada: false,
  },
  {
    id: "m2",
    conversa: "c-direta",
    autor: ANA,
    texto: "Viu @Eu Mesma?",
    mencoes: [EU],
    criada_em: hoje(5),
    apagada: false,
  },
];

function supabaseFalso(sobrescrever = {}) {
  const canais = [];
  const respostas = {
    listar_conversas_chat: () => ({
      eu: EU,
      conversas: [DIRETA, GRUPO, SILENCIADA],
    }),
    listar_mensagens_chat: ({ p_conversa }) =>
      p_conversa === "c-direta"
        ? { conversa: DIRETA, mensagens: MENSAGENS, tem_mais: false }
        : { conversa: null, mensagens: [], tem_mais: false },
    marcar_conversa_lida_chat: ({ p_conversa }) => ({
      conversa: p_conversa,
      lida_em: agora.toISOString(),
    }),
    enviar_mensagem_chat: (a) => ({
      id: a.p_mensagem,
      conversa: a.p_conversa,
      autor: EU,
      texto: a.p_texto,
      link: a.p_link_tela,
      mencoes: a.p_mencoes || [],
      criada_em: new Date().toISOString(),
      apagada: false,
    }),
    editar_mensagem_chat: (a) => ({
      ...MENSAGENS[0],
      texto: a.p_texto,
      editada_em: new Date().toISOString(),
    }),
    apagar_mensagem_chat: () => ({ ...MENSAGENS[0], texto: "", apagada: true }),
    abrir_conversa_direta_chat: () => DIRETA,
    abrir_conversa_edital_chat: (a) => ({
      id: "c-edital",
      tipo: "EDITAL",
      edital: { id: a.p_edital, titulo: "83/2026" },
      participantes: [{ id: EU, nome: "Eu Mesma" }],
      nao_lidas: 0,
      participa: true,
      atualizada_em: hoje(1),
    }),
    listar_pessoas_chat: () => ({ pessoas: [] }),
    ...sobrescrever,
  };
  const canal = (nome) => {
    const c = {
      nome,
      ouvintes: [],
      on(tipo, filtro, fn) {
        c.ouvintes.push({ tipo, filtro, fn });
        return c;
      },
      subscribe(fn) {
        c.status = fn;
        fn?.("SUBSCRIBED");
        return c;
      },
      send: vi.fn(),
    };
    canais.push(c);
    return c;
  };
  return {
    canais,
    rpc: vi.fn(async (nome, argumentos) => {
      const r = respostas[nome];
      if (!r) return { data: null, error: { message: `sem ${nome}` } };
      const data = r(argumentos || {});
      if (data?.__erro) return { data: null, error: data.__erro };
      return { data, error: null };
    }),
    channel: vi.fn(canal),
    removeChannel: vi.fn(async () => {}),
  };
}

const sessaoCom = (permissoes) => ({
  obter: () => ({
    fase: "conectado",
    usuario: { id: EU },
    perfil: { ativo: true, permissoes },
  }),
  assinar: () => () => {},
});

let controlador;
let host;
const toast = vi.fn();

async function montar({
  permissoes = { chat: "leitor" },
  supabase = supabaseFalso(),
  ...opcoes
} = {}) {
  host = document.createElement("div");
  host.id = "chatHost";
  document.body.append(host);
  await act(async () => {
    controlador = montarChat({
      elemento: host,
      supabase,
      toast,
      sessao: sessaoCom(permissoes),
      armazenamento: null,
      ...opcoes,
    });
  });
  await esperar();
  return supabase;
}

async function aguardar(achar) {
  // O painel vem por lazy + Suspense (o React segura o fallback ~300 ms).
  for (let i = 0; i < 150; i += 1) {
    const achado = achar();
    if (achado) return achado;
    await esperar(() => new Promise((r) => setTimeout(r, 20)));
  }
  throw new Error("não apareceu");
}

const botaoDoChat = () => host.querySelector(".chat-botao");
const painel = () => document.querySelector(".chat-painel");
const botao = (texto, raiz = document) =>
  [...raiz.querySelectorAll("button")].find((b) =>
    b.textContent.trim().startsWith(texto),
  );

async function abrirConversaDireta() {
  await clicar(botaoDoChat());
  const item = await aguardar(() =>
    document.querySelector('[data-conversa="c-direta"]'),
  );
  await clicar(item);
  return aguardar(() => document.querySelector('[data-mensagem="m2"]'));
}

afterEach(async () => {
  await act(async () => controlador?.desmontar());
  document.body.innerHTML = "";
  definirNaoLidasDaAba(0);
  toast.mockClear();
});

describe("ícone e permissão", () => {
  it("sem o recurso chat, o ícone não aparece e nada é pedido ao banco", async () => {
    const supabase = await montar({ permissoes: { chat: "sem_acesso" } });
    expect(botaoDoChat()).toBeNull();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(supabase.channel).not.toHaveBeenCalled();
  });

  it("com o recurso, mostra as não lidas (sem as silenciadas) no ícone e na aba", async () => {
    const supabase = await montar();
    expect(supabase.rpc).toHaveBeenCalledWith(
      "listar_conversas_chat",
      undefined,
    );
    expect(botaoDoChat().getAttribute("aria-label")).toBe(
      "Mensagens, 3 não lidas",
    );
    expect(host.querySelector(".chat-botao__contador").textContent).toBe("3");
    expect(document.title).toBe("(3) MONITORA");
    // Realtime: o canal da pessoa com mensagens e participações.
    const canal = supabase.canais.find((c) => c.nome === `chat-usuario:${EU}`);
    expect(canal.ouvintes.map((o) => o.filtro.table)).toEqual([
      "TB_MENSAGEM",
      "RL_CONVERSA_PARTICIPANTE",
      "RL_MENSAGEM_REACAO",
    ]);
  });
});

describe("painel", () => {
  it("abre sob demanda com a lista: título, prévia, não lidas, menção e online", async () => {
    await montar();
    await clicar(botaoDoChat());
    const item = await aguardar(() =>
      document.querySelector('[data-conversa="c-direta"]'),
    );
    expect(botaoDoChat().getAttribute("aria-expanded")).toBe("true");
    expect(item.textContent).toContain("Ana Souza");
    expect(item.textContent).toContain("Viu @Eu Mesma?");
    expect(item.querySelector(".chat-item__contador").textContent).toBe("2");
    expect(item.querySelector(".chat-item__mencao")).not.toBeNull();
    expect(item.querySelector(".chat-avatar__online")).not.toBeNull();
    expect(painel().querySelectorAll(".chat-item")).toHaveLength(3);
  });

  it("abrir a conversa lista as mensagens por dia, destaca a menção e marca como lida", async () => {
    const supabase = await montar();
    await abrirConversaDireta();
    expect(supabase.rpc).toHaveBeenCalledWith("listar_mensagens_chat", {
      p_conversa: "c-direta",
      p_antes: null,
      p_limite: 50,
    });
    expect(painel().querySelector(".chat-dia__rotulo").textContent).toBe(
      "Hoje",
    );
    expect(painel().querySelector(".chat-mencao").textContent).toBe(
      "@Eu Mesma",
    );
    await aguardar(() =>
      supabase.rpc.mock.calls.some(
        ([nome]) => nome === "marcar_conversa_lida_chat",
      ),
    );
    await aguardar(
      () =>
        botaoDoChat().getAttribute("aria-label") === "Mensagens, 1 não lida",
    );
  });
});

describe("mensagens", () => {
  it("Enter envia com o id do navegador; Shift+Enter não envia", async () => {
    const supabase = await montar();
    await abrirConversaDireta();
    const campo = painel().querySelector(".chat-escrita__campo");
    await digitar(campo, "Bom dia, @Ana Souza");
    await teclar(campo, "Enter", { shiftKey: true });
    expect(
      supabase.rpc.mock.calls.some(([n]) => n === "enviar_mensagem_chat"),
    ).toBe(false);
    await teclar(campo, "Enter");
    await esperar();
    const envio = supabase.rpc.mock.calls.find(
      ([n]) => n === "enviar_mensagem_chat",
    )[1];
    expect(envio).toMatchObject({
      p_conversa: "c-direta",
      p_texto: "Bom dia, @Ana Souza",
      p_link_tela: null,
      p_mencoes: [ANA],
    });
    expect(envio.p_mensagem).toMatch(/^[0-9a-f-]{36}$/);
    const nova = await aguardar(() =>
      document.querySelector(`[data-mensagem="${envio.p_mensagem}"]`),
    );
    expect(nova.classList.contains("is-minha")).toBe(true);
    expect(campo.value).toBe("");

    // O Realtime entrega a mesma mensagem: continua uma só.
    await act(async () =>
      controlador.estado._aoMudarMensagem({
        eventType: "INSERT",
        new: {
          CO_MENSAGEM: envio.p_mensagem,
          CO_CONVERSA: "c-direta",
          CO_USUARIO_AUTOR: EU,
          DS_TEXTO: "Bom dia, @Ana Souza",
          DT_CRIACAO: new Date().toISOString(),
          ST_APAGADA: "N",
        },
      }),
    );
    expect(
      document.querySelectorAll(`[data-mensagem="${envio.p_mensagem}"]`),
    ).toHaveLength(1);
  });

  it("mensagem de outra pessoa pelo Realtime entra na conversa aberta", async () => {
    await montar();
    await abrirConversaDireta();
    await act(async () =>
      controlador.estado._aoMudarMensagem({
        eventType: "INSERT",
        new: {
          CO_MENSAGEM: "m3",
          CO_CONVERSA: "c-direta",
          CO_USUARIO_AUTOR: ANA,
          DS_TEXTO: "Chegou agora",
          DT_CRIACAO: new Date().toISOString(),
          ST_APAGADA: "N",
        },
      }),
    );
    expect(
      document.querySelector('[data-mensagem="m3"]').textContent,
    ).toContain("Chegou agora");
  });

  it("o menu ⋯ fica à vista em cada mensagem: na própria, Editar e Apagar (com confirmação); na dos outros, só Copiar", async () => {
    const supabase = await montar();
    await abrirConversaDireta();
    const minha = document.querySelector('[data-mensagem="m1"]');
    const deAna = document.querySelector('[data-mensagem="m2"]');
    const mais = (msg) => msg.querySelector('[aria-label="Ações da mensagem"]');
    expect(mais(minha)).not.toBeNull();
    expect(mais(deAna)).not.toBeNull();

    await clicar(mais(deAna));
    const itensDeAna = [...deAna.querySelectorAll('[role="menuitem"]')].map(
      (b) => b.textContent.trim(),
    );
    expect(itensDeAna).toEqual(["Copiar texto"]);
    await clicar(mais(deAna));

    await clicar(mais(minha));
    expect(mais(minha).getAttribute("aria-expanded")).toBe("true");
    await clicar(botao("Editar", minha.querySelector('[role="menu"]')));
    await digitar(minha.querySelector("textarea"), "Oi Ana!");
    await clicar(botao("Salvar", minha));
    expect(supabase.rpc).toHaveBeenCalledWith("editar_mensagem_chat", {
      p_mensagem: "m1",
      p_texto: "Oi Ana!",
    });
    await aguardar(
      () =>
        minha.textContent.includes("Oi Ana!") &&
        minha.textContent.includes("editada"),
    );

    await clicar(mais(minha));
    await clicar(botao("Apagar", minha.querySelector('[role="menu"]')));
    expect(minha.textContent).toContain("Apagar esta mensagem?");
    expect(
      supabase.rpc.mock.calls.some(([n]) => n === "apagar_mensagem_chat"),
    ).toBe(false);
    await clicar(botao("Apagar", minha.querySelector('[role="group"]')));
    expect(supabase.rpc).toHaveBeenCalledWith("apagar_mensagem_chat", {
      p_mensagem: "m1",
    });
    await aguardar(() =>
      document
        .querySelector('[data-mensagem="m1"]')
        .textContent.includes("Mensagem apagada"),
    );
    expect(
      document.querySelector(
        '[data-mensagem="m1"] [aria-label="Ações da mensagem"]',
      ),
    ).toBeNull();
  });

  it("Copiar texto põe o texto na área de transferência e avisa", async () => {
    const escrever = vi.fn(async () => {});
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: escrever },
    });
    try {
      await montar();
      await abrirConversaDireta();
      const deAna = document.querySelector('[data-mensagem="m2"]');
      await clicar(deAna.querySelector('[aria-label="Ações da mensagem"]'));
      await clicar(botao("Copiar texto", deAna));
      await esperar();
      expect(escrever).toHaveBeenCalledWith("Viu @Eu Mesma?");
      expect(toast).toHaveBeenCalledWith("Texto copiado.", "success");
      expect(deAna.querySelector('[role="menu"]')).toBeNull();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("menu ⋯ fecha com Escape sem sair da conversa e com clique fora", async () => {
    await montar();
    await abrirConversaDireta();
    const minha = document.querySelector('[data-mensagem="m1"]');
    await clicar(minha.querySelector('[aria-label="Ações da mensagem"]'));
    const item = minha.querySelector('[role="menuitem"]');
    await teclar(item, "Escape");
    expect(minha.querySelector('[role="menu"]')).toBeNull();
    expect(document.querySelector('[data-mensagem="m1"]')).not.toBeNull();
    await clicar(minha.querySelector('[aria-label="Ações da mensagem"]'));
    await act(async () => {
      document.body.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true }),
      );
    });
    expect(minha.querySelector('[role="menu"]')).toBeNull();
  });

  it("envio que falha fica como Não enviada, com Tentar de novo", async () => {
    const supabase = supabaseFalso({
      enviar_mensagem_chat: () => ({ __erro: { message: "Sem rede" } }),
    });
    await montar({ supabase });
    await abrirConversaDireta();
    const campo = painel().querySelector(".chat-escrita__campo");
    await digitar(campo, "vai falhar");
    await teclar(campo, "Enter");
    await aguardar(() => painel().querySelector(".chat-msg.is-falhou"));
    expect(painel().querySelector(".chat-msg.is-falhou").textContent).toContain(
      "Não enviada",
    );
    expect(botao("Tentar de novo", painel())).toBeTruthy();
    expect(toast).toHaveBeenCalledWith("Sem rede", "error");
  });
});

describe("abrir de fora do painel", () => {
  it("o botão Mensagem de Pessoas online abre a conversa direta", async () => {
    const supabase = await montar();
    const pessoa = document.createElement("button");
    pessoa.setAttribute("data-chat-usuario", ANA);
    pessoa.textContent = "Mensagem";
    document.body.append(pessoa);
    await clicar(pessoa);
    expect(supabase.rpc).toHaveBeenCalledWith("abrir_conversa_direta_chat", {
      p_usuario: ANA,
    });
    await aguardar(() => document.querySelector('[data-mensagem="m2"]'));
    expect(painel().querySelector("h2").textContent).toBe("Ana Souza");
  });

  it("o botão Conversa do edital abre a conversa do edital", async () => {
    const supabase = await montar();
    await act(async () =>
      abrirConversaDoEdital({ id: "e-83", titulo: "83/2026" }),
    );
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("abrir_conversa_edital_chat", {
      p_edital: "e-83",
    });
    await aguardar(
      () => painel()?.querySelector("h2")?.textContent === "Edital 83/2026",
    );
  });
});

describe("reações", () => {
  function comReacoes(inicial = [{ emoji: "👀", usuarios: [ANA] }]) {
    let reacoes = inicial;
    return supabaseFalso({
      listar_mensagens_chat: () => ({
        conversa: DIRETA,
        mensagens: [MENSAGENS[0], { ...MENSAGENS[1], reacoes }],
        tem_mais: false,
      }),
      alternar_reacao_chat: (a) => {
        reacoes = reacoesComAlternancia(reacoes, a.p_emoji, EU);
        return { ...MENSAGENS[1], reacoes };
      },
    });
  }
  // Seletor de atributo com emoji falha no jsdom: procura pelo rótulo.
  const reagirCom = (msg, emoji) =>
    [...msg.querySelectorAll('[role="menu"] button')].find(
      (b) => b.getAttribute("aria-label") === `Reagir com ${emoji}`,
    );
  const chip = (msg, emoji) =>
    [...msg.querySelectorAll(".chat-reacao")].find((b) =>
      b.textContent.startsWith(emoji),
    );

  it("reagir pelo menu ⋯ aparece na hora com contagem e quem reagiu; clicar na reação tira ou põe", async () => {
    const supabase = comReacoes();
    await montar({ supabase });
    await abrirConversaDireta();
    const deAna = document.querySelector('[data-mensagem="m2"]');
    expect(chip(deAna, "👀").title).toBe("Ana Souza");
    expect(chip(deAna, "👀").getAttribute("aria-pressed")).toBe("false");

    await clicar(deAna.querySelector('[aria-label="Ações da mensagem"]'));
    await clicar(reagirCom(deAna, "👍"));
    expect(supabase.rpc).toHaveBeenCalledWith("alternar_reacao_chat", {
      p_mensagem: "m2",
      p_emoji: "👍",
    });
    expect(deAna.querySelector('[role="menu"]')).toBeNull();
    await esperar();
    const joinha = chip(deAna, "👍");
    expect(joinha.textContent).toBe("👍1");
    expect(joinha.title).toBe("Você");
    expect(joinha.getAttribute("aria-pressed")).toBe("true");
    // 👍 vem antes de 👀 (ordem das reações rápidas).
    expect(
      [...deAna.querySelectorAll(".chat-reacao")].map((b) => b.textContent),
    ).toEqual(["👍1", "👀1"]);

    await clicar(joinha);
    await esperar();
    expect(chip(deAna, "👍")).toBeUndefined();

    await clicar(chip(deAna, "👀"));
    await esperar();
    expect(chip(deAna, "👀").title).toBe("Ana Souza, Você");
    expect(chip(deAna, "👀").textContent).toBe("👀2");
  });

  it("reação de outra pessoa chega pelo Realtime (pôr e tirar); de outra conversa, não", async () => {
    await montar();
    await abrirConversaDireta();
    const linha = (ativa, conversa = "c-direta") => ({
      new: {
        CO_MENSAGEM: "m1",
        CO_USUARIO: ANA,
        DS_EMOJI: "❤️",
        CO_CONVERSA: conversa,
        ST_REGISTRO_ATIVO: ativa ? "S" : "N",
      },
    });
    const minha = document.querySelector('[data-mensagem="m1"]');
    await act(async () => controlador.estado._aoMudarReacao(linha(true)));
    expect(chip(minha, "❤️").title).toBe("Ana Souza");
    await act(async () => controlador.estado._aoMudarReacao(linha(false)));
    expect(chip(minha, "❤️")).toBeUndefined();
    await act(async () =>
      controlador.estado._aoMudarReacao(linha(true, "c-grupo")),
    );
    expect(minha.querySelector(".chat-reacao")).toBeNull();
  });

  it("reação que falha volta ao que era e avisa", async () => {
    const supabase = supabaseFalso({
      alternar_reacao_chat: () => ({ __erro: { message: "Sem rede" } }),
    });
    await montar({ supabase });
    await abrirConversaDireta();
    const deAna = document.querySelector('[data-mensagem="m2"]');
    await clicar(deAna.querySelector('[aria-label="Ações da mensagem"]'));
    await clicar(reagirCom(deAna, "🙏"));
    await esperar();
    expect(deAna.querySelector(".chat-reacao")).toBeNull();
    expect(toast).toHaveBeenCalledWith("Sem rede", "error");
  });
});

describe("limpar conversa", () => {
  it("pede confirmação, esconde o histórico só na tela de quem limpou e o antigo não volta pelo Realtime", async () => {
    const limpaEm = new Date().toISOString();
    const supabase = supabaseFalso({
      limpar_conversa_chat: () => ({
        ...DIRETA,
        nao_lidas: 0,
        mencoes: 0,
        limpa_em: limpaEm,
        ultima: null,
        participa: true,
      }),
    });
    await montar({ supabase });
    await abrirConversaDireta();
    await clicar(painel().querySelector('[aria-label="Opções da conversa"]'));
    const itens = [
      ...painel().querySelectorAll('.chat-conversa__menu [role="menuitem"]'),
    ].map((b) => b.textContent.trim());
    // Direta: sem "Sair"; nada de "Apagar conversa".
    expect(itens).toEqual(["Silenciar", "Limpar conversa"]);
    await clicar(botao("Limpar conversa", painel()));
    const confirmar = painel().querySelector('[aria-label="Limpar conversa?"]');
    expect(confirmar.textContent).toContain("Limpar o histórico só para você?");
    expect(
      supabase.rpc.mock.calls.some(([n]) => n === "limpar_conversa_chat"),
    ).toBe(false);
    await clicar(botao("Limpar", confirmar));
    expect(supabase.rpc).toHaveBeenCalledWith("limpar_conversa_chat", {
      p_conversa: "c-direta",
    });
    await aguardar(() => !document.querySelector('[data-mensagem="m1"]'));
    expect(document.querySelector('[data-mensagem="m2"]')).toBeNull();
    expect(painel().textContent).toContain("Nenhuma mensagem ainda.");
    expect(
      painel().querySelector('[aria-label="Limpar conversa?"]'),
    ).toBeNull();

    // Edição de mensagem antiga pelo Realtime não volta; a nova entra.
    await act(async () =>
      controlador.estado._aoMudarMensagem({
        eventType: "UPDATE",
        new: {
          CO_MENSAGEM: "m2",
          CO_CONVERSA: "c-direta",
          CO_USUARIO_AUTOR: ANA,
          DS_TEXTO: "Viu @Eu Mesma? (editada)",
          DT_CRIACAO: MENSAGENS[1].criada_em,
          ST_APAGADA: "N",
        },
      }),
    );
    expect(document.querySelector('[data-mensagem="m2"]')).toBeNull();
    await act(async () =>
      controlador.estado._aoMudarMensagem({
        eventType: "INSERT",
        new: {
          CO_MENSAGEM: "m9",
          CO_CONVERSA: "c-direta",
          CO_USUARIO_AUTOR: ANA,
          DS_TEXTO: "Depois da limpeza",
          DT_CRIACAO: new Date(Date.now() + 1000).toISOString(),
          ST_APAGADA: "N",
        },
      }),
    );
    expect(document.querySelector('[data-mensagem="m9"]')).not.toBeNull();
  });

  it("no grupo, o menu tem Limpar conversa e Sair do grupo", async () => {
    await montar({
      supabase: supabaseFalso({
        listar_mensagens_chat: () => ({
          conversa: GRUPO,
          mensagens: [],
          tem_mais: false,
        }),
      }),
    });
    await clicar(botaoDoChat());
    await clicar(
      await aguardar(() => document.querySelector('[data-conversa="c-grupo"]')),
    );
    await clicar(
      await aguardar(() =>
        painel().querySelector('[aria-label="Opções da conversa"]'),
      ),
    );
    const itens = [
      ...painel().querySelectorAll('.chat-conversa__menu [role="menuitem"]'),
    ].map((b) => b.textContent.trim());
    expect(itens).toEqual([
      "Silenciar",
      "Adicionar pessoas",
      "Limpar conversa",
      "Sair do grupo",
    ]);
  });
});

describe("emojis", () => {
  afterEach(() => {
    try {
      localStorage.clear();
    } catch {
      /* sem armazenamento */
    }
  });

  const seletor = () =>
    painel().querySelector('[role="dialog"][aria-label="Emojis"]');

  it("o botão abre o seletor; escolher insere no cursor e guarda nos recentes; busca por nome; Escape fecha", async () => {
    const supabase = await montar();
    await abrirConversaDireta();
    const campo = painel().querySelector(".chat-escrita__campo");
    await digitar(campo, "Oi tudo");
    campo.setSelectionRange(2, 2);
    const abrir = painel().querySelector('[aria-label="Emojis"]');
    await clicar(abrir);
    expect(abrir.getAttribute("aria-expanded")).toBe("true");
    expect(
      seletor()
        .querySelector('[role="tab"][aria-selected="true"]')
        .getAttribute("aria-label"),
    ).toBe("Carinhas");
    await clicar(seletor().querySelector('[role="tab"][aria-label="Gestos"]'));
    await clicar(seletor().querySelector('[aria-label="joinha"]'));
    expect(campo.value).toBe("Oi👍 tudo");
    expect(
      JSON.parse(localStorage.getItem("monitora.chat.emojis-recentes")),
    ).toEqual(["👍"]);

    const busca = seletor().querySelector('input[type="search"]');
    await digitar(busca, "cafe");
    expect(
      [...seletor().querySelectorAll(".chat-emojis__emoji")].map(
        (b) => b.textContent,
      ),
    ).toContain("☕");
    // Enter na busca escolhe o primeiro e não envia a mensagem.
    await teclar(busca, "Enter");
    expect(campo.value).toContain("☕");
    expect(
      supabase.rpc.mock.calls.some(([n]) => n === "enviar_mensagem_chat"),
    ).toBe(false);
    await digitar(busca, "xyzxyz");
    expect(seletor().textContent).toContain("Nenhum emoji encontrado.");

    await teclar(busca, "Escape");
    expect(seletor()).toBeNull();
    expect(painel().querySelector(".chat-escrita__campo")).not.toBeNull();

    // Reabrir começa nos Recentes (o último usado primeiro).
    await clicar(painel().querySelector('[aria-label="Emojis"]'));
    expect(
      seletor()
        .querySelector('[role="tab"][aria-selected="true"]')
        .getAttribute("aria-label"),
    ).toBe("Recentes");
    expect(
      [...seletor().querySelectorAll(".chat-emojis__emoji")].map(
        (b) => b.textContent,
      ),
    ).toEqual(["☕", "👍"]);
  });

  it("o emoji vai no texto enviado (é texto Unicode)", async () => {
    const supabase = await montar();
    await abrirConversaDireta();
    const campo = painel().querySelector(".chat-escrita__campo");
    await digitar(campo, "Feito ");
    campo.setSelectionRange(6, 6);
    await clicar(painel().querySelector('[aria-label="Emojis"]'));
    await digitar(seletor().querySelector('input[type="search"]'), "feito");
    await clicar(seletor().querySelector('[aria-label="feito"]'));
    await teclar(campo, "Enter");
    await esperar();
    const envio = supabase.rpc.mock.calls.find(
      ([n]) => n === "enviar_mensagem_chat",
    )[1];
    expect(envio.p_texto).toBe("Feito ✅");
  });
});

describe("rolagem", () => {
  it("abre na última; lendo acima, mensagem nova mostra ↓ Nova mensagem e o botão leva ao fim", async () => {
    const topo = new WeakMap();
    const ehLista = (el) => el.classList?.contains("chat-conversa__mensagens");
    const definir = (nome, descritor) =>
      Object.defineProperty(HTMLElement.prototype, nome, {
        configurable: true,
        ...descritor,
      });
    definir("scrollHeight", {
      get() {
        return ehLista(this) ? 1000 : 0;
      },
    });
    definir("clientHeight", {
      get() {
        return ehLista(this) ? 300 : 0;
      },
    });
    definir("scrollTop", {
      get() {
        return topo.get(this) ?? 0;
      },
      set(valor) {
        topo.set(this, valor);
      },
    });
    try {
      await montar();
      await abrirConversaDireta();
      const lista = painel().querySelector(".chat-conversa__mensagens");
      expect(lista.scrollTop).toBe(1000);

      lista.scrollTop = 100;
      await act(async () => lista.dispatchEvent(new Event("scroll")));
      await act(async () =>
        controlador.estado._aoMudarMensagem({
          eventType: "INSERT",
          new: {
            CO_MENSAGEM: "m4",
            CO_CONVERSA: "c-direta",
            CO_USUARIO_AUTOR: ANA,
            DS_TEXTO: "Nova",
            DT_CRIACAO: new Date().toISOString(),
            ST_APAGADA: "N",
          },
        }),
      );
      expect(lista.scrollTop).toBe(100);
      const novas = painel().querySelector(".chat-conversa__novas");
      expect(novas.textContent).toContain("Nova mensagem");
      await clicar(novas);
      expect(lista.scrollTop).toBe(1000);
      expect(painel().querySelector(".chat-conversa__novas")).toBeNull();
    } finally {
      for (const nome of ["scrollHeight", "clientHeight", "scrollTop"])
        delete HTMLElement.prototype[nome];
    }
  });
});

describe("rolagem ao carregar anteriores", () => {
  it("Carregar anteriores mantém na tela a mensagem que a pessoa via", async () => {
    const topo = new WeakMap();
    const ehLista = (el) => el.classList?.contains("chat-conversa__mensagens");
    const definir = (nome, descritor) =>
      Object.defineProperty(HTMLElement.prototype, nome, {
        configurable: true,
        ...descritor,
      });
    // 100 px por mensagem.
    definir("scrollHeight", {
      get() {
        return ehLista(this)
          ? this.querySelectorAll("[data-mensagem]").length * 100
          : 0;
      },
    });
    definir("clientHeight", {
      get() {
        return ehLista(this) ? 100 : 0;
      },
    });
    definir("scrollTop", {
      get() {
        return topo.get(this) ?? 0;
      },
      set(valor) {
        topo.set(this, valor);
      },
    });
    const ANTIGAS = [
      { ...MENSAGENS[0], id: "m-2", texto: "Antiga 1", criada_em: hoje(30) },
      { ...MENSAGENS[0], id: "m-1", texto: "Antiga 2", criada_em: hoje(20) },
    ];
    const supabase = supabaseFalso({
      listar_mensagens_chat: ({ p_antes }) =>
        p_antes
          ? { conversa: DIRETA, mensagens: ANTIGAS, tem_mais: false }
          : { conversa: DIRETA, mensagens: MENSAGENS, tem_mais: true },
    });
    try {
      await montar({ supabase });
      await abrirConversaDireta();
      const lista = painel().querySelector(".chat-conversa__mensagens");
      // Leu até o topo: a primeira mensagem (m1) está na tela.
      lista.scrollTop = 0;
      await act(async () => lista.dispatchEvent(new Event("scroll")));
      await clicar(botao("Carregar anteriores"));
      await aguardar(() => document.querySelector('[data-mensagem="m-2"]'));
      // Entraram 200 px acima: m1 continua no mesmo lugar da tela.
      expect(lista.scrollTop).toBe(200);
    } finally {
      for (const nome of ["scrollHeight", "clientHeight", "scrollTop"])
        delete HTMLElement.prototype[nome];
    }
  });
});

describe("avisos de mensagem nova", () => {
  const linha = (extra = {}) => ({
    CO_MENSAGEM: "m9",
    CO_CONVERSA: "c-direta",
    CO_USUARIO_AUTOR: ANA,
    DS_TEXTO: "Pode ver o <b>edital</b>?",
    DT_CRIACAO: new Date().toISOString(),
    ST_APAGADA: "N",
    ...extra,
  });
  const chegar = (extra, eventType = "INSERT") =>
    act(async () =>
      controlador.estado._aoMudarMensagem({ eventType, new: linha(extra) }),
    );
  const avisos = () => [...document.querySelectorAll(".chat-aviso")];

  it("mensagem de outra pessoa com o painel fechado: aviso com nome e prévia sem marcação, contador sobe e clicar abre a conversa", async () => {
    await montar();
    await chegar();
    const [aviso] = avisos();
    expect(aviso.textContent).toContain("Ana Souza");
    expect(aviso.textContent).toContain("Pode ver o edital?");
    expect(aviso.closest('[role="status"]').getAttribute("aria-live")).toBe(
      "polite",
    );
    expect(host.querySelector(".chat-botao__contador").textContent).toBe("4");
    // O foco não sai de onde estava.
    expect(aviso.contains(document.activeElement)).toBe(false);
    await clicar(aviso.querySelector(".chat-aviso__abrir"));
    await aguardar(() => document.querySelector('[data-mensagem="m2"]'));
    expect(avisos()).toHaveLength(0);
  });

  it("não avisa: a própria, a apagada, a silenciada nem a da conversa à vista", async () => {
    await montar();
    await chegar({ CO_USUARIO_AUTOR: EU });
    await chegar({ CO_MENSAGEM: "x1", ST_APAGADA: "S" });
    await chegar({ CO_MENSAGEM: "x2", CO_CONVERSA: "c-mudo" });
    expect(avisos()).toHaveLength(0);
    await abrirConversaDireta();
    await chegar({ CO_MENSAGEM: "x3" });
    expect(avisos()).toHaveLength(0);
  });

  it("mensagem apagada depois tira o aviso; Dispensar tira; some sozinho", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      await montar();
      await chegar();
      expect(avisos()).toHaveLength(1);
      await chegar({ ST_APAGADA: "S", DS_TEXTO: "" }, "UPDATE");
      expect(avisos()).toHaveLength(0);
      await chegar({ CO_MENSAGEM: "m10" });
      await clicar(avisos()[0].querySelector(".chat-aviso__fechar"));
      expect(avisos()).toHaveLength(0);
      await chegar({ CO_MENSAGEM: "m11" });
      expect(avisos()).toHaveLength(1);
      await act(async () => vi.advanceTimersByTime(8000));
      expect(avisos()).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("no máximo 3 avisos, um por conversa", async () => {
    const extras = ["c-a", "c-b", "c-c"].map((id) => ({
      ...GRUPO,
      id,
      nome: `Grupo ${id}`,
      participantes: [
        { id: EU, nome: "Eu Mesma" },
        { id: ANA, nome: "Ana Souza" },
      ],
    }));
    await montar({
      supabase: supabaseFalso({
        listar_conversas_chat: () => ({
          eu: EU,
          conversas: [DIRETA, GRUPO, SILENCIADA, ...extras],
        }),
      }),
    });
    await chegar({ CO_MENSAGEM: "a1" });
    await chegar({ CO_MENSAGEM: "a2" });
    for (const [i, c] of extras.entries())
      await chegar({ CO_MENSAGEM: `b${i}`, CO_CONVERSA: c.id });
    expect(avisos().map((a) => a.getAttribute("data-aviso"))).toEqual([
      "c-a",
      "c-b",
      "c-c",
    ]);
    expect(avisos()[0].textContent).toContain("Ana: ");
  });

  it("conversa nova que alguém começou: relê a lista e avisa", async () => {
    const NOVA = { ...DIRETA, id: "c-nova", nao_lidas: 1 };
    let conversas = [DIRETA, GRUPO, SILENCIADA];
    await montar({
      supabase: supabaseFalso({
        listar_conversas_chat: () => ({ eu: EU, conversas }),
      }),
    });
    conversas = [NOVA, ...conversas];
    await chegar({ CO_MENSAGEM: "n1", CO_CONVERSA: "c-nova" });
    await aguardar(() => avisos().length);
    expect(avisos()[0].getAttribute("data-aviso")).toBe("c-nova");
  });

  it("aba em segundo plano: notificação do navegador (só se ativada), sem aviso na tela; clicar abre a conversa", async () => {
    const notificacao = { close: vi.fn() };
    const notificar = vi.fn(() => notificacao);
    const janela = {
      focus: vi.fn(),
      Notification: {
        permission: "default",
        requestPermission: vi.fn(async () => "granted"),
      },
    };
    await montar({ notificar, janela });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => "hidden",
    });
    try {
      await chegar({ CO_MENSAGEM: "h1" });
      expect(notificar).not.toHaveBeenCalled();
      expect(janela.Notification.requestPermission).not.toHaveBeenCalled();
      // A permissão só é pedida quando a pessoa liga a preferência.
      await act(async () => {
        await controlador.estado.definirPreferencia("notificacoes", true);
      });
      expect(janela.Notification.requestPermission).toHaveBeenCalledTimes(1);
      await chegar({ CO_MENSAGEM: "h2" });
      expect(notificar).toHaveBeenCalledWith("Ana Souza", {
        body: "Pode ver o edital?",
        tag: "monitora-chat-c-direta",
      });
      expect(avisos()).toHaveLength(0);
    } finally {
      delete document.visibilityState;
    }
    await act(async () => notificacao.onclick());
    expect(janela.focus).toHaveBeenCalled();
    expect(notificacao.close).toHaveBeenCalled();
    await aguardar(() => document.querySelector('[data-mensagem="m2"]'));
  });
});
