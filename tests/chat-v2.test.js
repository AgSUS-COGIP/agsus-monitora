import { describe, expect, it } from "vitest";
import {
  aplicarLeituraDaLinha,
  cartaoDoLink,
  citacaoDe,
  deveAvisar,
  linkDaTela,
  mencionaMe,
  mensagemDaLinha,
  naoLidasDaConversa,
  ordenarConversas,
  partesDoTrecho,
  podeEnviar,
  precisaCompletar,
  presencaDe,
  previaDaUltima,
  rotuloDaPresenca,
  rotuloDoLink,
  rotuloSemTexto,
  termoDeBuscaValido,
  textoDaCitacao,
  totalDeNaoLidas,
  vistoPor,
} from "../src/lib/chat.js";

/*
  Regras puras da v2 do chat (src/lib/chat.js): envio só com anexo ou
  cartão, a linha do Realtime com anexos e citação, citação, Visto, menção
  que avisa mesmo silenciada, fixadas, não lida, cartões com permissão,
  busca e presença. Códigos CV-n.m: docs/historias-de-usuario/chat.md.
*/

const EU = "eu";
const ANA = "ana";
const BIA = "bia";
const EDITAL = "00000000-0000-4000-a000-0000000ed001";
const FICHA = "00000000-0000-4000-a000-0000000f1001";

describe("CV-1.5 — mensagem só com anexo ou cartão", () => {
  it("texto vazio vale com anexo ou com cartão; acima do limite, não", () => {
    expect(podeEnviar("", {}).ok).toBe(false);
    expect(podeEnviar("  ", { anexos: 1 }).ok).toBe(true);
    expect(podeEnviar("", { link: { view: "nucleo" } }).ok).toBe(true);
    expect(podeEnviar("x".repeat(4001), { anexos: 1 }).ok).toBe(false);
  });

  it("prévia da lista sem texto: anexo, anexos ou cartão", () => {
    expect(rotuloSemTexto(1)).toBe("Anexo");
    expect(rotuloSemTexto(3)).toBe("3 anexos");
    expect(rotuloSemTexto(0, true)).toBe("Cartão de tela");
    expect(
      previaDaUltima(
        { tipo: "DIRETA", ultima: { autor: EU, texto: "", anexos: 2 } },
        EU,
      ),
    ).toBe("Você: 2 anexos");
  });
});

describe("CV-1.6 — a linha do Realtime com anexos e citação", () => {
  const linha = {
    CO_MENSAGEM: "m1",
    CO_CONVERSA: "c1",
    CO_USUARIO_AUTOR: ANA,
    DS_TEXTO: "",
    DT_CRIACAO: "2026-10-07T10:00:00Z",
    ST_APAGADA: "N",
    QT_ANEXO: 2,
    CO_MENSAGEM_RESPOSTA: "m0",
    ST_ENCAMINHADA: "S",
  };

  it("anuncia os anexos e a citada sem inventar os dados deles", () => {
    const m = mensagemDaLinha(linha);
    expect(m).toMatchObject({
      qt_anexo: 2,
      resposta_id: "m0",
      encaminhada: true,
    });
    expect("anexos" in m).toBe(false);
    expect("resposta" in m).toBe(false);
    expect(precisaCompletar(m)).toBe(true);
  });

  it("depois de completar (anexos e citação da RPC), não pede de novo", () => {
    const m = {
      ...mensagemDaLinha(linha),
      anexos: [{ id: "a" }, { id: "b" }],
      resposta: { id: "m0" },
    };
    expect(precisaCompletar(m)).toBe(false);
  });

  it("sem anexo e sem citação, a linha já é a verdade (some a citação apagada pela retenção)", () => {
    const m = mensagemDaLinha({
      ...linha,
      QT_ANEXO: 0,
      CO_MENSAGEM_RESPOSTA: null,
    });
    expect(m.anexos).toEqual([]);
    expect(m.resposta).toBeNull();
    expect(precisaCompletar(m)).toBe(false);
  });

  it("apagada fica sem anexos e não pede nada", () => {
    const m = mensagemDaLinha({ ...linha, ST_APAGADA: "S" });
    expect(m.anexos).toEqual([]);
    expect(precisaCompletar(m)).toBe(false);
  });
});

describe("CV-2 — responder", () => {
  it("a citação leva o começo do texto, ou anexo/cartão/apagada", () => {
    const c = citacaoDe({
      id: "m1",
      autor: ANA,
      texto: "x".repeat(300),
      anexos: [],
    });
    expect(c.texto).toHaveLength(160);
    expect(textoDaCitacao(c)).toHaveLength(120);
    expect(textoDaCitacao({ texto: "", anexos: 1 })).toBe("Anexo");
    expect(textoDaCitacao({ texto: "", link: true })).toBe("Cartão de tela");
    expect(textoDaCitacao({ apagada: true })).toBe("Mensagem apagada");
    expect(citacaoDe(null)).toBeNull();
  });
});

describe("CV-3 — menções avisam mesmo com a conversa silenciada", () => {
  const silenciada = { id: "c1", silenciada: true };
  it("silenciada não avisa, a não ser que mencione você", () => {
    const comum = { autor: ANA, mencoes: [] };
    const comMencao = { autor: ANA, mencoes: [EU] };
    expect(mencionaMe(comMencao, EU)).toBe(true);
    expect(deveAvisar({ mensagem: comum, eu: EU, conversa: silenciada })).toBe(
      false,
    );
    expect(
      deveAvisar({ mensagem: comMencao, eu: EU, conversa: silenciada }),
    ).toBe(true);
    expect(
      deveAvisar({
        mensagem: comMencao,
        eu: EU,
        conversa: silenciada,
        abertaAVista: true,
      }),
    ).toBe(false);
  });

  it("o contador soma as menções da silenciada e 1 na marcada como não lida", () => {
    expect(
      totalDeNaoLidas([
        { nao_lidas: 2 },
        { nao_lidas: 9, mencoes: 1, silenciada: true },
        { nao_lidas: 0, marcada_nao_lida: true },
      ]),
    ).toBe(4);
    expect(naoLidasDaConversa({ nao_lidas: 0, marcada_nao_lida: true })).toBe(
      1,
    );
    expect(naoLidasDaConversa({ nao_lidas: 3, marcada_nao_lida: true })).toBe(
      3,
    );
  });
});

describe("CV-4 — trecho da busca", () => {
  it("destaca o termo sem diferenciar maiúsculas e acentos", () => {
    expect(partesDoTrecho("…o Relatório final", "relatorio")).toEqual([
      { tipo: "texto", texto: "…o " },
      { tipo: "termo", texto: "Relatório" },
      { tipo: "texto", texto: " final" },
    ]);
    expect(partesDoTrecho("abc", "")).toEqual([
      { tipo: "texto", texto: "abc" },
    ]);
    expect(partesDoTrecho("", "x")).toEqual([]);
  });

  it("termo de 2 a 100 caracteres", () => {
    expect(termoDeBuscaValido("a")).toBe(false);
    expect(termoDeBuscaValido(" ab ")).toBe(true);
    expect(termoDeBuscaValido("x".repeat(101))).toBe(false);
  });
});

describe("CV-5 — Visto", () => {
  const enviada = "2026-10-07T10:00:00Z";
  const minha = { id: "m", autor: EU, criada_em: enviada };
  const direta = (lida) => ({
    tipo: "DIRETA",
    participantes: [
      { id: EU, nome: "Eu", lida_em: enviada },
      { id: ANA, nome: "Ana", lida_em: lida },
    ],
  });

  it("direta: vista quando a outra leu depois do envio", () => {
    expect(vistoPor(minha, direta("2026-10-07T09:00:00Z"), EU)).toEqual({
      total: 1,
      viram: [],
      todos: false,
    });
    expect(vistoPor(minha, direta("2026-10-07T10:05:00Z"), EU)).toEqual({
      total: 1,
      viram: ["Ana"],
      todos: true,
    });
  });

  it("grupo: quem viu, pelo nome", () => {
    const grupo = {
      tipo: "GRUPO",
      participantes: [
        { id: EU, nome: "Eu", lida_em: enviada },
        { id: ANA, nome: "Ana", lida_em: "2026-10-07T10:01:00Z" },
        { id: BIA, nome: "Bia", lida_em: null },
      ],
    };
    expect(vistoPor(minha, grupo, EU)).toEqual({
      total: 2,
      viram: ["Ana"],
      todos: false,
    });
  });

  it("nada para mensagem dos outros, pendente, apagada ou sem a leitura (quem não participa)", () => {
    const conversa = direta("2026-10-07T10:05:00Z");
    expect(vistoPor({ ...minha, autor: ANA }, conversa, EU)).toBeNull();
    expect(vistoPor({ ...minha, pendente: true }, conversa, EU)).toBeNull();
    expect(vistoPor({ ...minha, apagada: true }, conversa, EU)).toBeNull();
    expect(
      vistoPor(
        minha,
        { participantes: [{ id: EU }, { id: ANA, nome: "Ana" }] },
        EU,
      ),
    ).toBeNull();
  });

  it("a leitura que chega pelo Realtime só avança", () => {
    const conversa = { id: "c1", ...direta("2026-10-07T09:00:00Z") };
    const nova = aplicarLeituraDaLinha(conversa, {
      CO_CONVERSA: "c1",
      CO_USUARIO: ANA,
      DT_ULTIMA_LEITURA: "2026-10-07T10:05:00Z",
    });
    expect(nova.participantes[1].lida_em).toBe("2026-10-07T10:05:00Z");
    expect(
      aplicarLeituraDaLinha(nova, {
        CO_CONVERSA: "c1",
        CO_USUARIO: ANA,
        DT_ULTIMA_LEITURA: "2026-10-07T08:00:00Z",
      }),
    ).toBe(nova);
    expect(
      aplicarLeituraDaLinha(nova, { CO_CONVERSA: "outra", CO_USUARIO: ANA }),
    ).toBe(nova);
  });
});

describe("CV-6 — cartões", () => {
  const ficha = {
    view: "avaliacao-documental",
    area: "saude-indigena",
    edital: { id: EDITAL, titulo: "93/2026" },
    ficha: { id: FICHA, codigo: "123456" },
  };

  it("aceita view com hífen e a ficha pelo código (só com edital)", () => {
    const link = linkDaTela(ficha);
    expect(link.ficha).toEqual({ id: FICHA, codigo: "123456" });
    expect(link.rotulo).toBe(
      "Candidato 123456 · Avaliação documental · Saúde Indígena · Edital 93/2026",
    );
    expect(linkDaTela({ ...ficha, ficha: { codigo: "123456" } }).ficha).toEqual(
      { codigo: "123456" },
    );
    expect(linkDaTela({ ...ficha, edital: undefined })).toBeNull();
    expect(linkDaTela({ ...ficha, ficha: { codigo: "1 2" } })).toBeNull();
    expect(
      linkDaTela({ ...ficha, ficha: { id: "x", codigo: "1" } }),
    ).toBeNull();
    expect(linkDaTela({ view: "https://exemplo.invalid" })).toBeNull();
  });

  it("cartão: tipo, título, detalhe e Abrir só para quem tem a página", () => {
    const pode = cartaoDoLink(ficha, { "avaliacao-documental": true });
    expect(pode).toMatchObject({
      tipo: "ficha",
      titulo: "Candidato 123456",
      detalhe: "Avaliação documental · Saúde Indígena · Edital 93/2026",
      icone: "fa-id-card",
      podeAbrir: true,
    });
    expect(
      cartaoDoLink(ficha, { "avaliacao-documental": false }).podeAbrir,
    ).toBe(false);
    expect(
      cartaoDoLink({
        view: "classificacao",
        edital: { id: EDITAL, titulo: "83" },
      }),
    ).toMatchObject({ tipo: "edital", titulo: "Edital 83", podeAbrir: true });
    expect(cartaoDoLink({ view: "nucleo", area: "sede" })).toMatchObject({
      tipo: "tela",
      titulo: "Editais",
    });
    expect(cartaoDoLink({ view: "inventada" })).toBeNull();
  });

  it("rótulo do link sem ficha continua o de antes", () => {
    expect(rotuloDoLink({ view: "classificacao" })).toBe("Classificação");
  });
});

describe("CV-7 — fixadas no topo", () => {
  it("a fixada por último vem primeiro; depois, a mais recente", () => {
    const lista = ordenarConversas([
      { id: "a", atualizada_em: "2026-10-07T12:00:00Z" },
      {
        id: "b",
        atualizada_em: "2026-10-01T00:00:00Z",
        fixada_em: "2026-10-05T00:00:00Z",
      },
      {
        id: "c",
        atualizada_em: "2026-10-02T00:00:00Z",
        fixada_em: "2026-10-06T00:00:00Z",
      },
      { id: "d", atualizada_em: "2026-10-07T13:00:00Z" },
    ]);
    expect(lista.map((c) => c.id)).toEqual(["c", "b", "d", "a"]);
  });
});

describe("CV-8 — presença", () => {
  it("online com o status escolhido; fora do MONITORA, sem ponto", () => {
    expect(presencaDe({ online: true })).toBe("disponivel");
    expect(presencaDe({ online: true, status: "OCUPADO" })).toBe("ocupado");
    expect(presencaDe({ online: true, status: "AUSENTE" })).toBe("ausente");
    expect(presencaDe({ online: false, status: "OCUPADO" })).toBe("offline");
    expect(rotuloDaPresenca({ online: true })).toBe("Online");
    expect(rotuloDaPresenca({ online: true, status: "OCUPADO" })).toBe(
      "Ocupado",
    );
    expect(rotuloDaPresenca(null)).toBe("");
  });
});
