import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clicar, digitar, esperar, teclar } from "../componentes/interacoes.js";
import { definirNaoLidasDaAba } from "../../src/lib/identidade-da-aba.js";

vi.setConfig({ testTimeout: 20000 });

/*
  O chat v2 na tela (src/modulos/chat/), com Supabase falso (RPCs, Storage e
  Realtime): anexar arquivo e colar print (sobe ao bucket e envia com
  p_anexos), miniatura por URL assinada, responder (citação que rola até a
  original), encaminhar, busca nas mensagens (abre na mensagem), Visto (✓✓ e
  a leitura que chega pelo Realtime), cartão com "Abrir" só para quem tem a
  página, fixar e marcar como não lida, status, "Compartilhar esta ficha",
  a linha do Realtime completada por obter_mensagem_chat e a menção que avisa
  mesmo com a conversa silenciada. Códigos CV-n.m:
  docs/historias-de-usuario/chat.md.
*/

const { montarChat } = await import("../../src/modulos/chat/chat.jsx");
const { compartilharNoChat } = await import("../../src/modulos/chat/ponte.js");

const EU = "00000000-0000-4000-a000-000000000001";
const ANA = "00000000-0000-4000-a000-000000000002";
const BIA = "00000000-0000-4000-a000-000000000003";
const C_DIRETA = "00000000-0000-4000-a000-0000000000c1";
const C_GRUPO = "00000000-0000-4000-a000-0000000000c2";
const C_MUDO = "00000000-0000-4000-a000-0000000000c3";
const EDITAL = "00000000-0000-4000-a000-0000000ed001";
const FICHA = "00000000-0000-4000-a000-0000000f1001";
const agora = new Date();
const antes = (min) => new Date(agora.getTime() - min * 60000).toISOString();

const DIRETA = {
  id: C_DIRETA,
  tipo: "DIRETA",
  participa: true,
  participantes: [
    { id: EU, nome: "Eu Mesma", lida_em: antes(1) },
    {
      id: ANA,
      nome: "Ana Souza",
      online: true,
      status: "OCUPADO",
      lida_em: antes(12),
    },
  ],
  nao_lidas: 0,
  atualizada_em: antes(5),
  ultima: { id: "m2", autor: ANA, texto: "Relatório", criada_em: antes(5) },
};
const GRUPO = {
  id: C_GRUPO,
  tipo: "GRUPO",
  nome: "Equipe RH",
  participa: true,
  participantes: [
    { id: EU, nome: "Eu Mesma", lida_em: antes(1) },
    { id: ANA, nome: "Ana Souza", lida_em: antes(1) },
    { id: BIA, nome: "Bia Lima", lida_em: null },
  ],
  nao_lidas: 0,
  atualizada_em: antes(60),
};
const MUDO = {
  ...GRUPO,
  id: C_MUDO,
  nome: "Mudo",
  silenciada: true,
  atualizada_em: antes(90),
};

const LINK_DA_FICHA = {
  view: "avaliacao-documental",
  area: "saude-indigena",
  edital: { id: EDITAL, titulo: "93/2026" },
  ficha: { id: FICHA, codigo: "123456" },
  rotulo: "Candidato 123456",
};

const MENSAGENS = [
  {
    id: "m1",
    conversa: C_DIRETA,
    autor: EU,
    texto: "Mandei o arquivo",
    mencoes: [],
    criada_em: antes(10),
    apagada: false,
    anexos: [
      {
        id: "a1",
        nome: "Relatório.pdf",
        mime: "application/pdf",
        bytes: 2048,
        caminho: `${C_DIRETA}/00000000-0000-4000-a000-0000000a0001.pdf`,
      },
      {
        id: "a2",
        nome: "print.png",
        mime: "image/png",
        bytes: 4096,
        caminho: `${C_DIRETA}/00000000-0000-4000-a000-0000000a0002.png`,
      },
    ],
  },
  {
    id: "m2",
    conversa: C_DIRETA,
    autor: ANA,
    texto: "Vi. Olha esta ficha",
    mencoes: [],
    criada_em: antes(5),
    apagada: false,
    link: LINK_DA_FICHA,
    resposta: { id: "m1", autor: EU, texto: "Mandei o arquivo" },
  },
];

function supabaseFalso(sobrescrever = {}) {
  const canais = [];
  const subidos = [];
  const respostas = {
    listar_conversas_chat: () => ({
      eu: EU,
      meu_status: "DISPONIVEL",
      conversas: [DIRETA, GRUPO, MUDO],
    }),
    listar_mensagens_chat: ({ p_conversa }) =>
      p_conversa === C_DIRETA
        ? { conversa: DIRETA, mensagens: MENSAGENS, tem_mais: false }
        : {
            conversa: p_conversa === C_GRUPO ? GRUPO : MUDO,
            mensagens: [],
            tem_mais: false,
          },
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
      resposta: a.p_resposta
        ? { id: a.p_resposta, autor: EU, texto: "x" }
        : null,
      anexos: (a.p_anexos || []).map((x, i) => ({
        id: `g${i}`,
        nome: x.nome,
        mime: "application/pdf",
        bytes: 10,
        caminho: x.caminho,
      })),
    }),
    encaminhar_mensagem_chat: (a) => ({
      id: "f1",
      conversa: a.p_conversa,
      autor: EU,
      texto: "Mandei o arquivo",
      encaminhada: true,
      criada_em: new Date().toISOString(),
      apagada: false,
    }),
    buscar_mensagens_chat: ({ p_termo }) => ({
      termo: p_termo,
      resultados: [
        {
          id: "m1",
          conversa: C_DIRETA,
          autor: EU,
          criada_em: antes(10),
          trecho: "Mandei o arquivo",
          anexo: "Relatório.pdf",
        },
      ],
    }),
    fixar_conversa_chat: (a) => ({
      ...DIRETA,
      fixada_em: a.p_fixada ? agora.toISOString() : null,
    }),
    marcar_nao_lida_chat: () => ({ ...DIRETA, marcada_nao_lida: true }),
    definir_status_chat: (a) => ({ status: a.p_status }),
    obter_mensagem_chat: (a) => ({
      id: a.p_mensagem,
      conversa: C_DIRETA,
      autor: ANA,
      texto: "",
      criada_em: new Date().toISOString(),
      apagada: false,
      anexos: [
        {
          id: "z1",
          nome: "Planilha.xlsx",
          mime: "application/vnd.ms-excel",
          bytes: 99,
          caminho: `${C_DIRETA}/00000000-0000-4000-a000-0000000a0009.xls`,
        },
      ],
      resposta: null,
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
        fn?.("SUBSCRIBED");
        return c;
      },
      send: vi.fn(),
    };
    canais.push(c);
    return c;
  };
  const bucket = {
    upload: vi.fn(async (caminho, arquivo, opcoes) => {
      subidos.push({ caminho, nome: arquivo?.name, opcoes });
      return { data: { path: caminho }, error: null };
    }),
    createSignedUrl: vi.fn(async (caminho, validade, opcoes) => ({
      data: {
        signedUrl: `https://armazenamento.invalid/${caminho}?t=${validade}${opcoes?.download ? "&download" : ""}`,
      },
      error: null,
    })),
  };
  return {
    canais,
    subidos,
    bucket,
    rpc: vi.fn(async (nome, argumentos) => {
      const r = respostas[nome];
      if (!r) return { data: null, error: { message: `sem ${nome}` } };
      const data = r(argumentos || {});
      if (data?.__erro) return { data: null, error: data.__erro };
      return { data, error: null };
    }),
    storage: { from: vi.fn(() => bucket) },
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
      criarUrlLocal: () => null,
    });
  });
  await esperar();
  return supabase;
}

async function aguardar(achar) {
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
const campo = () => painel().querySelector(".chat-escrita__campo");

async function abrir(id = C_DIRETA, esperarMensagem = "m2") {
  if (!painel()) await clicar(botaoDoChat());
  const item = await aguardar(() =>
    document.querySelector(`[data-conversa="${id}"]`),
  );
  await clicar(item);
  if (esperarMensagem)
    return aguardar(() =>
      document.querySelector(`[data-mensagem="${esperarMensagem}"]`),
    );
  return aguardar(() => campo());
}

async function menuDa(mensagem, item) {
  await clicar(mensagem.querySelector('[aria-label="Ações da mensagem"]'));
  await clicar(botao(item, mensagem.querySelector('[role="menu"]')));
}

afterEach(async () => {
  await act(async () => controlador?.desmontar());
  document.body.innerHTML = "";
  definirNaoLidasDaAba(0);
  toast.mockClear();
  delete globalThis.navigate;
});

describe("CV-1 — anexos", () => {
  it("CV-1.7 escolher arquivo: sobe ao bucket pelo caminho da conversa e envia com p_anexos", async () => {
    const supabase = await montar();
    await abrir();
    const seletor = painel().querySelector('input[type="file"]');
    const pdf = new File(["%PDF-1"], "Ofício 12.pdf", {
      type: "application/pdf",
    });
    await act(async () => {
      Object.defineProperty(seletor, "files", {
        value: [pdf],
        configurable: true,
      });
      seletor.dispatchEvent(new Event("change", { bubbles: true }));
    });
    const chip = painel().querySelector(".chat-escrita__anexo");
    expect(chip.textContent).toContain("Ofício 12.pdf");
    // Sem texto, com anexo: Enviar habilitado.
    expect(botao("Enviar", painel()).disabled).toBe(false);
    await clicar(botao("Enviar", painel()));
    await esperar();
    expect(supabase.storage.from).toHaveBeenCalledWith("chat-anexos");
    expect(supabase.subidos).toHaveLength(1);
    expect(supabase.subidos[0].caminho).toMatch(
      new RegExp(`^${C_DIRETA}/[0-9a-f-]{36}\\.pdf$`),
    );
    expect(supabase.subidos[0].opcoes).toEqual({
      contentType: "application/pdf",
      upsert: false,
    });
    const envio = supabase.rpc.mock.calls.find(
      ([n]) => n === "enviar_mensagem_chat",
    )[1];
    expect(envio.p_anexos).toEqual([
      { caminho: supabase.subidos[0].caminho, nome: "Ofício 12.pdf" },
    ]);
    expect(envio.p_texto).toBe("");
    expect(painel().querySelector(".chat-escrita__anexo")).toBeNull();
  });

  it("CV-1.8 tipo não aceito avisa e não entra", async () => {
    await montar();
    await abrir();
    const seletor = painel().querySelector('input[type="file"]');
    await act(async () => {
      Object.defineProperty(seletor, "files", {
        value: [new File(["x"], "virus.exe", { type: "" })],
        configurable: true,
      });
      seletor.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(painel().querySelector(".chat-escrita__anexo")).toBeNull();
    expect(toast).toHaveBeenCalledWith(
      expect.stringContaining("virus.exe: Tipo de arquivo não aceito"),
      "warn",
    );
  });

  it("CV-1.4 colar print (Ctrl+V) vira anexo com nome de print", async () => {
    await montar();
    await abrir();
    const imagem = new File(["png"], "image.png", { type: "image/png" });
    await act(async () => {
      const evento = new Event("paste", { bubbles: true, cancelable: true });
      Object.defineProperty(evento, "clipboardData", {
        value: { files: [imagem], items: [] },
      });
      campo().dispatchEvent(evento);
    });
    const chip = painel().querySelector(".chat-escrita__anexo");
    expect(chip.textContent).toMatch(
      /^print-\d{4}-\d{2}-\d{2}-\d{2}h\d{2}m\d{2}\.png/,
    );
  });

  it("CV-1.9 na mensagem: arquivo para baixar e miniatura da imagem por URL assinada curta", async () => {
    const supabase = await montar();
    const m1 = await abrir(C_DIRETA, "m1");
    await esperar();
    const img = await aguardar(() =>
      m1.querySelector(".chat-anexo--imagem img"),
    );
    expect(img.getAttribute("src")).toContain("?t=60");
    await clicar(botao("Relatório.pdf", m1));
    expect(supabase.bucket.createSignedUrl).toHaveBeenCalledWith(
      MENSAGENS[0].anexos[0].caminho,
      60,
      { download: "Relatório.pdf" },
    );
  });
});

describe("CV-2 — responder e encaminhar", () => {
  it("CV-2.1 Responder mostra a citação no campo e envia p_resposta", async () => {
    const supabase = await montar();
    const m2 = await abrir();
    await menuDa(m2, "Responder");
    const barra = painel().querySelector(".chat-escrita__resposta");
    expect(barra.textContent).toContain("Ana Souza");
    expect(barra.textContent).toContain("Vi. Olha esta ficha");
    await digitar(campo(), "Combinado");
    await teclar(campo(), "Enter");
    await esperar();
    const envio = supabase.rpc.mock.calls.find(
      ([n]) => n === "enviar_mensagem_chat",
    )[1];
    expect(envio.p_resposta).toBe("m2");
    expect(painel().querySelector(".chat-escrita__resposta")).toBeNull();
  });

  it("CV-2.2 clicar na citação rola até a original e destaca", async () => {
    await montar();
    const m2 = await abrir();
    await clicar(m2.querySelector(".chat-citacao"));
    await esperar();
    expect(
      document
        .querySelector('[data-mensagem="m1"]')
        .classList.contains("is-destaque"),
    ).toBe(true);
  });

  it("CV-2.3 Encaminhar: escolhe a conversa, chama a RPC e abre o destino", async () => {
    const supabase = await montar();
    const m1 = await abrir(C_DIRETA, "m1");
    await menuDa(m1, "Encaminhar");
    expect(painel().querySelector("h2").textContent).toBe("Encaminhar");
    await clicar(painel().querySelector(`[data-conversa="${C_GRUPO}"]`));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("encaminhar_mensagem_chat", {
      p_mensagem: "m1",
      p_conversa: C_GRUPO,
    });
    expect(painel().querySelector("h2").textContent).toBe("Equipe RH");
    expect(toast).toHaveBeenCalledWith("Mensagem encaminhada.", "success");
  });
});

describe("CV-3 — menções", () => {
  it("CV-3.1 menção em conversa silenciada avisa; sem menção, não", async () => {
    await montar();
    const linha = (id, mencoes) => ({
      eventType: "INSERT",
      new: {
        CO_MENSAGEM: id,
        CO_CONVERSA: C_MUDO,
        CO_USUARIO_AUTOR: ANA,
        DS_TEXTO: "Oi",
        CO_USUARIOS_MENCIONADOS: mencoes,
        DT_CRIACAO: new Date().toISOString(),
        ST_APAGADA: "N",
        QT_ANEXO: 0,
      },
    });
    await act(async () => controlador.estado._aoMudarMensagem(linha("x1", [])));
    expect(document.querySelector(".chat-aviso")).toBeNull();
    await act(async () =>
      controlador.estado._aoMudarMensagem(linha("x2", [EU])),
    );
    expect(document.querySelector(".chat-aviso").textContent).toContain("Mudo");
  });
});

describe("CV-4 — busca nas mensagens", () => {
  it("CV-4.1 com 2 letras procura nas mensagens; o resultado abre na mensagem", async () => {
    const supabase = await montar();
    await clicar(botaoDoChat());
    const busca = await aguardar(() => painel()?.querySelector(".chat-busca"));
    await digitar(busca, "relat");
    const resultado = await aguardar(() =>
      painel().querySelector('[data-resultado="m1"]'),
    );
    expect(supabase.rpc).toHaveBeenCalledWith("buscar_mensagens_chat", {
      p_termo: "relat",
      p_limite: 30,
    });
    expect(resultado.querySelector("mark").textContent).toBe("Relat");
    await clicar(resultado);
    await aguardar(() => document.querySelector('[data-mensagem="m1"]'));
    await esperar();
    expect(
      document
        .querySelector('[data-mensagem="m1"]')
        .classList.contains("is-destaque"),
    ).toBe(true);
  });
});

describe("CV-5 — Visto", () => {
  it("CV-5.1 direta: ✓ enviada; a leitura de Ana pelo Realtime vira ✓✓ vista", async () => {
    await montar();
    const m1 = await abrir(C_DIRETA, "m1");
    expect(m1.querySelector(".chat-visto").getAttribute("title")).toBe(
      "Enviada",
    );
    await act(async () =>
      controlador.estado._aoMudarParticipante({
        new: {
          CO_CONVERSA: C_DIRETA,
          CO_USUARIO: ANA,
          DT_ULTIMA_LEITURA: new Date().toISOString(),
        },
      }),
    );
    const visto = document.querySelector('[data-mensagem="m1"] .chat-visto');
    expect(visto.getAttribute("title")).toBe("Vista");
    expect(visto.textContent).toBe("✓✓");
  });

  it("CV-5.2 o canal da pessoa escuta todos os participantes que a RLS entrega", async () => {
    const supabase = await montar();
    const canal = supabase.canais.find((c) => c.nome === `chat-usuario:${EU}`);
    const participantes = canal.ouvintes.find(
      (o) => o.filtro.table === "RL_CONVERSA_PARTICIPANTE",
    );
    expect(participantes.filtro.filter).toBeUndefined();
  });
});

describe("CV-6 — cartões", () => {
  it("CV-6.1 sem a página, o cartão mostra Sem acesso; com ela, Abrir navega dentro do app", async () => {
    await montar();
    let m2 = await abrir();
    expect(m2.querySelector(".chat-cartao").textContent).toContain(
      "Candidato 123456",
    );
    expect(botao("Abrir", m2)).toBeUndefined();
    expect(m2.querySelector(".chat-cartao__sem-acesso")).not.toBeNull();
    await act(async () => controlador.desmontar());
    document.body.innerHTML = "";

    await montar({
      permissoes: { chat: "leitor", avaliacao_documental: "leitor" },
    });
    m2 = await abrir();
    globalThis.navigate = vi.fn();
    await clicar(botao("Abrir", m2));
    expect(globalThis.navigate).toHaveBeenCalledWith("avaliacao-documental");
  });

  it("CV-6.2 Compartilhar esta ficha: escolhe a conversa e o cartão vai no envio", async () => {
    const supabase = await montar();
    await act(async () => {
      compartilharNoChat(LINK_DA_FICHA);
    });
    const aviso = await aguardar(() =>
      painel()?.querySelector(".chat-compartilhar"),
    );
    expect(aviso.textContent).toContain("Escolha a conversa");
    await clicar(painel().querySelector(`[data-conversa="${C_GRUPO}"]`));
    const cartao = await aguardar(() =>
      painel().querySelector(".chat-escrita__link"),
    );
    expect(cartao.textContent).toContain("Candidato 123456");
    await clicar(botao("Enviar", painel()));
    await esperar();
    const envio = supabase.rpc.mock.calls.find(
      ([n]) => n === "enviar_mensagem_chat",
    )[1];
    expect(envio.p_link_tela.ficha).toEqual({ id: FICHA, codigo: "123456" });
    expect(envio.p_conversa).toBe(C_GRUPO);
  });
});

describe("CV-7 — fixar e não lida", () => {
  it("CV-7.1 fixar no topo e marcar como não lida (volta para a lista com o contador)", async () => {
    const supabase = await montar();
    await abrir();
    await clicar(painel().querySelector('[aria-label="Opções da conversa"]'));
    await clicar(botao("Fixar no topo", painel()));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("fixar_conversa_chat", {
      p_conversa: C_DIRETA,
      p_fixada: true,
    });
    await clicar(painel().querySelector('[aria-label="Opções da conversa"]'));
    expect(botao("Soltar do topo", painel())).toBeTruthy();
    await clicar(botao("Marcar como não lida", painel()));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("marcar_nao_lida_chat", {
      p_conversa: C_DIRETA,
    });
    const item = await aguardar(() =>
      painel().querySelector(`[data-conversa="${C_DIRETA}"]`),
    );
    expect(item.querySelector(".chat-item__contador").textContent).toBe("1");
    expect(botaoDoChat().getAttribute("aria-label")).toBe(
      "Mensagens, 1 não lida",
    );
  });
});

describe("CV-8 — status", () => {
  it("CV-8.1 meu status muda pela RPC; o ponto de quem está Ocupado fica vermelho", async () => {
    const supabase = await montar();
    await clicar(botaoDoChat());
    const grupo = await aguardar(() =>
      painel()?.querySelector('[aria-label="Meu status"]'),
    );
    await clicar(botao("Ocupado", grupo));
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("definir_status_chat", {
      p_status: "OCUPADO",
    });
    expect(
      painel()
        .querySelector(`[data-conversa="${C_DIRETA}"] .chat-avatar__online`)
        .getAttribute("data-presenca"),
    ).toBe("ocupado");
  });
});

describe("Realtime da v2", () => {
  it("CV-1.6 a linha com anexo é completada por obter_mensagem_chat", async () => {
    const supabase = await montar();
    await abrir();
    await act(async () =>
      controlador.estado._aoMudarMensagem({
        eventType: "INSERT",
        new: {
          CO_MENSAGEM: "m9",
          CO_CONVERSA: C_DIRETA,
          CO_USUARIO_AUTOR: ANA,
          DS_TEXTO: "",
          CO_USUARIOS_MENCIONADOS: [],
          DT_CRIACAO: new Date().toISOString(),
          ST_APAGADA: "N",
          QT_ANEXO: 1,
        },
      }),
    );
    await esperar();
    expect(supabase.rpc).toHaveBeenCalledWith("obter_mensagem_chat", {
      p_mensagem: "m9",
    });
    const m9 = await aguardar(() =>
      document.querySelector('[data-mensagem="m9"] .chat-anexo'),
    );
    expect(m9.textContent).toContain("Planilha.xlsx");
  });
});
