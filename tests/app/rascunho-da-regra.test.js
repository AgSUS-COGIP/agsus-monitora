import { describe, expect, it, vi } from "vitest";
import { criarGuardaDeAlteracoes } from "../../src/app/guarda-de-alteracoes.ts";
import { criarRascunhoDaRegra } from "../../src/app/rascunho-da-regra.ts";
import { chaveDoRascunhoLocal } from "../../src/lib/rascunho-da-regra.ts";

/*
  O rascunho da regra guardado a cada mudança (src/app/rascunho-da-regra.ts):
  gravação com atraso, cópia neste computador sem conexão (e envio quando ela
  volta), recuperar, descartar, versão nova salva e a guarda do app (F5 e
  versão nova do sistema).
*/

const EDITAL = "e114";
const USUARIO = "u1";
const CHAVE = chaveDoRascunhoLocal("ANALISE", EDITAL, USUARIO);

function memoria() {
  const dados = new Map();
  return {
    getItem: (k) => (dados.has(k) ? dados.get(k) : null),
    setItem: (k, v) => dados.set(k, String(v)),
    removeItem: (k) => dados.delete(k),
    dados,
  };
}

function relogio() {
  let fila = [];
  return {
    agendar: (fn) => {
      const id = Symbol("t");
      fila.push({ id, fn });
      return id;
    },
    cancelar: (id) => {
      fila = fila.filter((t) => t.id !== id);
    },
    /** Dispara o que estiver agendado (o "1 segundo depois"). */
    passar() {
      const agora = fila;
      fila = [];
      agora.forEach((t) => t.fn());
    },
    get agendados() {
      return fila.length;
    },
  };
}

function criar({ banco = null, rpcFalha = null } = {}) {
  let guardado = banco;
  const chamadas = [];
  const rpc = vi.fn(async (nome, args) => {
    chamadas.push([nome, args]);
    const falha = rpcFalha?.(nome);
    if (falha) throw falha;
    if (nome === "obter_rascunho_regra") return guardado;
    if (nome === "salvar_rascunho_regra") {
      guardado = {
        conteudo: args.p_conteudo,
        versao_base: args.p_versao_base,
        atualizado_em: "2026-10-13T17:05:00.000Z",
      };
      return { atualizado_em: guardado.atualizado_em };
    }
    if (nome === "descartar_rascunho_regra") {
      const havia = Boolean(guardado);
      guardado = null;
      return { descartado: havia };
    }
    return null;
  });
  const armazenamento = memoria();
  const r = relogio();
  const ouvintes = {};
  const janela = {
    addEventListener: (tipo, fn) => (ouvintes[tipo] = fn),
    removeEventListener: () => {},
  };
  const guarda = criarGuardaDeAlteracoes({ janela });
  const loja = criarRascunhoDaRegra({
    tipo: "ANALISE",
    rpc,
    usuario: async () => USUARIO,
    armazenamento: () => armazenamento,
    agendar: r.agendar,
    cancelar: r.cancelar,
    agora: () => new Date("2026-10-13T17:10:00.000Z"),
    guarda,
    janela,
  });
  return {
    loja,
    rpc,
    chamadas,
    armazenamento,
    relogio: r,
    guarda,
    ouvintes,
    banco: () => guardado,
  };
}

const esperar = () => new Promise((resolve) => setTimeout(resolve, 0));
const nomes = (chamadas) => chamadas.map(([n]) => n);

describe("abrir e gravar", () => {
  it("sem rascunho: edita; cada mudança grava 1 s depois (só a última)", async () => {
    const { loja, chamadas, relogio: r, banco } = criar();
    await loja.abrir(EDITAL, 2);
    expect(loja.obter().fase).toBe("editando");
    loja.mudar({ regra: { titulo_etapa: "A" } }, true);
    loja.mudar({ regra: { titulo_etapa: "AB" } }, true);
    expect(loja.naoGuardado()).toBe(true);
    expect(nomes(chamadas)).toEqual(["obter_rascunho_regra"]);
    r.passar();
    expect(loja.obter().gravacao).toBe("guardando");
    await esperar();
    expect(banco()).toMatchObject({
      conteudo: { regra: { titulo_etapa: "AB" } },
      versao_base: 2,
    });
    expect(loja.obter()).toMatchObject({
      gravacao: "guardado",
      guardadoEm: "2026-10-13T17:05:00.000Z",
    });
    expect(loja.naoGuardado()).toBe(false);
  });

  it("voltar à versão vigente apaga o guardado", async () => {
    const { loja, relogio: r, banco } = criar();
    await loja.abrir(EDITAL, 2);
    loja.mudar({ regra: { x: 1 } }, true);
    r.passar();
    await esperar();
    expect(banco()).not.toBeNull();
    loja.mudar({ regra: { x: 0 } }, false);
    r.passar();
    await esperar();
    expect(banco()).toBeNull();
    expect(loja.obter().gravacao).toBe("ocioso");
  });

  it("sem conexão: guarda neste computador e manda quando a conexão volta", async () => {
    let fora = true;
    const {
      loja,
      relogio: r,
      armazenamento,
      ouvintes,
      banco,
    } = criar({
      rpcFalha: (nome) =>
        fora && nome === "salvar_rascunho_regra"
          ? new TypeError("Failed to fetch")
          : null,
    });
    await loja.abrir(EDITAL, 2);
    loja.mudar({ regra: { x: 1 } }, true);
    r.passar();
    await esperar();
    expect(loja.obter().gravacao).toBe("local");
    expect(JSON.parse(armazenamento.getItem(CHAVE))).toMatchObject({
      conteudo: { regra: { x: 1 } },
      versao_base: 2,
      local: true,
    });
    expect(loja.naoGuardado()).toBe(false);
    fora = false;
    ouvintes.online();
    await esperar();
    expect(banco()).toMatchObject({ conteudo: { regra: { x: 1 } } });
    expect(armazenamento.getItem(CHAVE)).toBeNull();
    expect(loja.obter().gravacao).toBe("guardado");
  });

  it("RPC ainda não publicada: guarda neste computador, sem dizer que caiu a conexão", async () => {
    const { loja, relogio: r } = criar({
      rpcFalha: (nome) =>
        nome === "salvar_rascunho_regra"
          ? Object.assign(new Error("not found"), { code: "PGRST202" })
          : null,
    });
    await loja.abrir(EDITAL, 0);
    loja.mudar({ regra: { x: 1 } }, true);
    r.passar();
    await esperar();
    expect(loja.obter().gravacao).toBe("neste-computador");
  });
});

describe("recuperar", () => {
  const GUARDADO = {
    conteudo: { regra: { titulo_etapa: "do incidente" } },
    versao_base: 2,
    atualizado_em: "2026-10-13T14:05:00.000Z",
  };

  it("com rascunho no banco: pergunta; continuar devolve o conteúdo e regrava na vigente", async () => {
    const { loja, relogio: r, banco } = criar({ banco: GUARDADO });
    await loja.abrir(EDITAL, 3);
    expect(loja.obter()).toMatchObject({
      fase: "decidir",
      retomarSemPerguntar: false,
      guardado: { versaoBase: 2, local: false },
    });
    expect(loja.continuar()).toEqual(GUARDADO.conteudo);
    expect(loja.obter().fase).toBe("editando");
    expect(loja.comAlteracoes()).toBe(true);
    r.passar();
    await esperar();
    expect(banco().versao_base).toBe(3);
  });

  it("descartar apaga no banco e neste computador", async () => {
    const { loja, banco, armazenamento } = criar({ banco: GUARDADO });
    armazenamento.setItem(CHAVE, "{}");
    await loja.abrir(EDITAL, 2);
    await loja.descartar();
    expect(banco()).toBeNull();
    expect(armazenamento.getItem(CHAVE)).toBeNull();
    expect(loja.obter()).toMatchObject({ fase: "editando", guardado: null });
  });

  it("a cópia deste computador mais nova que a do banco ganha (ficou sem conexão)", async () => {
    const { loja, armazenamento } = criar({ banco: GUARDADO });
    armazenamento.setItem(
      CHAVE,
      JSON.stringify({
        conteudo: { regra: { titulo_etapa: "offline" } },
        versao_base: 2,
        atualizado_em: "2026-10-13T15:00:00.000Z",
        local: true,
      }),
    );
    await loja.abrir(EDITAL, 2);
    expect(loja.obter().guardado).toMatchObject({
      conteudo: { regra: { titulo_etapa: "offline" } },
      local: true,
    });
  });

  it("banco fora ao abrir: vale a cópia deste computador", async () => {
    const { loja, armazenamento } = criar({
      rpcFalha: () => new TypeError("Failed to fetch"),
    });
    armazenamento.setItem(
      CHAVE,
      JSON.stringify({
        conteudo: { regra: { x: 1 } },
        versao_base: 1,
        atualizado_em: "2026-10-13T15:00:00.000Z",
        local: true,
      }),
    );
    await loja.abrir(EDITAL, 1);
    expect(loja.obter().fase).toBe("decidir");
  });

  it("o rascunho desta sessão, na mesma versão, volta sem perguntar (trocar de aba)", async () => {
    const { loja, relogio: r } = criar();
    await loja.abrir(EDITAL, 2);
    loja.mudar({ regra: { x: 1 } }, true);
    loja.fechar(EDITAL); // grava já o agendado
    expect(r.agendados).toBe(0);
    await loja.abrir(EDITAL, 2);
    expect(loja.obter()).toMatchObject({
      fase: "decidir",
      retomarSemPerguntar: true,
    });
  });

  it("outra pessoa salvou no meio (versão vigente mudou): pergunta, mesmo nesta sessão", async () => {
    const { loja } = criar();
    await loja.abrir(EDITAL, 2);
    loja.mudar({ regra: { x: 1 } }, true);
    loja.fechar(EDITAL);
    await loja.abrir(EDITAL, 3);
    expect(loja.obter()).toMatchObject({
      fase: "decidir",
      retomarSemPerguntar: false,
      guardado: { versaoBase: 2 },
    });
  });
});

describe("versão nova salva", () => {
  it("esquecer apaga antes de a tela reabrir; a reabertura não acha nada", async () => {
    const { loja, relogio: r, banco } = criar();
    await loja.abrir(EDITAL, 2);
    loja.mudar({ regra: { x: 1 } }, true);
    r.passar();
    await esperar();
    loja.mudar({ regra: { x: 2 } }, true);
    void loja.esquecer(EDITAL);
    expect(r.agendados).toBe(0);
    loja.fechar(EDITAL);
    await loja.abrir(EDITAL, 3);
    expect(banco()).toBeNull();
    expect(loja.obter()).toMatchObject({ fase: "editando", guardado: null });
  });
});

describe("guarda do app", () => {
  it("F5 com alteração pede confirmação e grava a cópia local do que estava por gravar", async () => {
    const { loja, guarda, ouvintes, armazenamento } = criar();
    await loja.abrir(EDITAL, 2);
    const evento = { preventDefault: vi.fn(), returnValue: undefined };
    ouvintes.beforeunload(evento);
    expect(evento.preventDefault).not.toHaveBeenCalled();
    loja.mudar({ regra: { x: 1 } }, true);
    expect(guarda.podeRecarregar()).toBe(false);
    ouvintes.beforeunload(evento);
    expect(evento.preventDefault).toHaveBeenCalled();
    expect(JSON.parse(armazenamento.getItem(CHAVE)).conteudo).toEqual({
      regra: { x: 1 },
    });
  });

  it("versão nova do sistema espera a gravação terminar", async () => {
    const { loja, guarda, relogio: r } = criar();
    await loja.abrir(EDITAL, 2);
    expect(guarda.podeRecarregar()).toBe(true);
    loja.mudar({ regra: { x: 1 } }, true);
    expect(guarda.podeRecarregar()).toBe(false);
    r.passar();
    expect(guarda.podeRecarregar()).toBe(false);
    await esperar();
    expect(guarda.podeRecarregar()).toBe(true);
    expect(guarda.comAlteracoes()).toBe(true);
  });
});
