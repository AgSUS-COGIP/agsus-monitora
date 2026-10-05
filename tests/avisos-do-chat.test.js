import { describe, expect, it } from "vitest";
import {
  comoAvisar,
  empilharAvisos,
  MAXIMO_DE_AVISOS,
  montarAviso,
  previaDoAviso,
  textoDaNotificacao,
} from "../src/lib/avisos-do-chat.js";

const EU = "eu";
const ANA = "ana";
const DIRETA = {
  id: "c1",
  tipo: "DIRETA",
  participantes: [
    { id: EU, nome: "Eu Mesma" },
    { id: ANA, nome: "Ana Souza", avatar: "https://exemplo.org/a.png" },
  ],
};
const GRUPO = {
  id: "c2",
  tipo: "GRUPO",
  nome: "Equipe RH",
  participantes: [
    { id: EU, nome: "Eu Mesma" },
    { id: ANA, nome: "Ana Souza" },
  ],
};
const msg = (extra = {}) => ({
  id: "m1",
  conversa: "c1",
  autor: ANA,
  texto: "Oi",
  apagada: false,
  ...extra,
});

describe("previaDoAviso", () => {
  it("tira marcação, junta espaços e corta com reticências", () => {
    expect(previaDoAviso("  <b>Olá</b>\n\n  mundo  ")).toBe("Olá mundo");
    expect(previaDoAviso("<script>x</script>ok")).toBe("x ok");
    const longo = "a".repeat(200);
    const previa = previaDoAviso(longo, 20);
    expect(previa).toHaveLength(20);
    expect(previa.endsWith("…")).toBe(true);
    expect(previaDoAviso("curto", 20)).toBe("curto");
    expect(previaDoAviso(null)).toBe("");
  });
});

describe("comoAvisar", () => {
  const base = {
    mensagem: msg(),
    eu: EU,
    conversa: DIRETA,
    abertaAVista: false,
    carregado: true,
    abaVisivel: true,
    preferencias: { som: false, notificacoes: false },
  };

  it("aba à vista: aviso na tela, sem notificação do navegador", () => {
    expect(comoAvisar(base)).toEqual({
      tela: true,
      navegador: false,
      som: false,
    });
  });

  it("aba em segundo plano: notificação só se a pessoa ativou; som pela preferência", () => {
    expect(comoAvisar({ ...base, abaVisivel: false })).toEqual({
      tela: false,
      navegador: false,
      som: false,
    });
    expect(
      comoAvisar({
        ...base,
        abaVisivel: false,
        preferencias: { som: true, notificacoes: true },
      }),
    ).toEqual({ tela: false, navegador: true, som: true });
  });

  it("nada: carregamento inicial, própria, apagada, silenciada, conversa à vista", () => {
    const nada = { tela: false, navegador: false, som: false };
    expect(comoAvisar({ ...base, carregado: false })).toEqual(nada);
    expect(comoAvisar({ ...base, mensagem: msg({ autor: EU }) })).toEqual(nada);
    expect(comoAvisar({ ...base, mensagem: msg({ apagada: true }) })).toEqual(
      nada,
    );
    expect(
      comoAvisar({ ...base, conversa: { ...DIRETA, silenciada: true } }),
    ).toEqual(nada);
    expect(comoAvisar({ ...base, abertaAVista: true })).toEqual(nada);
    expect(comoAvisar({ ...base, conversa: null })).toEqual(nada);
  });
});

describe("montarAviso e textoDaNotificacao", () => {
  it("direta: título é quem mandou, sem prefixo no corpo", () => {
    const aviso = montarAviso({
      mensagem: msg({ texto: "Pode ver o edital?" }),
      conversa: DIRETA,
      eu: EU,
    });
    expect(aviso).toMatchObject({
      id: "m1",
      conversa: "c1",
      tipo: "DIRETA",
      titulo: "Ana Souza",
      autor: { id: ANA, nome: "Ana Souza" },
      remetente: "",
      previa: "Pode ver o edital?",
    });
    expect(textoDaNotificacao(aviso)).toEqual({
      titulo: "Ana Souza",
      corpo: "Pode ver o edital?",
    });
  });

  it("grupo: título é o grupo e o corpo leva o primeiro nome", () => {
    const aviso = montarAviso({
      mensagem: msg({ conversa: "c2", texto: "Reunião às 15h" }),
      conversa: GRUPO,
      eu: EU,
    });
    expect(aviso.titulo).toBe("Equipe RH");
    expect(textoDaNotificacao(aviso)).toEqual({
      titulo: "Equipe RH",
      corpo: "Ana: Reunião às 15h",
    });
  });
});

describe("empilharAvisos", () => {
  it(`um por conversa, o mais novo por último, no máximo ${MAXIMO_DE_AVISOS}`, () => {
    let pilha = [];
    for (const n of [1, 2, 3, 4])
      pilha = empilharAvisos(pilha, { id: `m${n}`, conversa: `c${n}` });
    expect(pilha.map((a) => a.id)).toEqual(["m2", "m3", "m4"]);
    pilha = empilharAvisos(pilha, { id: "m5", conversa: "c3" });
    expect(pilha.map((a) => a.id)).toEqual(["m2", "m4", "m5"]);
    expect(empilharAvisos(pilha, null)).toBe(pilha);
  });
});
