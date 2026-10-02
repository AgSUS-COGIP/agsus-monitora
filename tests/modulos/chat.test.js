import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 20000 });
import { clicar, digitar, esperar, teclar } from "../componentes/interacoes.js";
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

  it("editar e apagar a própria mensagem; a dos outros não tem os botões", async () => {
    const supabase = await montar();
    await abrirConversaDireta();
    const minha = document.querySelector('[data-mensagem="m1"]');
    const deAna = document.querySelector('[data-mensagem="m2"]');
    expect(deAna.querySelector('[aria-label="Editar mensagem"]')).toBeNull();

    await clicar(minha.querySelector('[aria-label="Editar mensagem"]'));
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

    await clicar(minha.querySelector('[aria-label="Apagar mensagem"]'));
    expect(minha.textContent).toContain("Apagar esta mensagem?");
    await clicar(botao("Apagar", minha.querySelector('[role="group"]')));
    expect(supabase.rpc).toHaveBeenCalledWith("apagar_mensagem_chat", {
      p_mensagem: "m1",
    });
    await aguardar(() =>
      document
        .querySelector('[data-mensagem="m1"]')
        .textContent.includes("Mensagem apagada"),
    );
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
