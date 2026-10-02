import { describe, expect, it } from "vitest";
import {
  agruparPorDia,
  deveAvisar,
  extrairMencoes,
  filtrarConversas,
  horaCurta,
  inserirMencao,
  linkDaTela,
  mencaoEmDigitacao,
  mensagemDaLinha,
  mesclarMensagens,
  naoLidasDasMensagens,
  partesDoTexto,
  previaDaUltima,
  quandoNaLista,
  rotuloDoDia,
  rotuloDoLink,
  tituloDaConversa,
  totalDeNaoLidas,
  validarTexto,
} from "../src/lib/chat.js";
import { podeUsarChat } from "../src/lib/access-roles.js";
import {
  niveisDoRecurso,
  RESOURCES,
  rotuloDoNivel,
} from "../src/lib/permissoes-recursos.js";

const AGORA = new Date(2026, 9, 2, 15, 30); // 02/10/2026 15:30, hora local

describe("texto da mensagem", () => {
  it("aceita de 1 a 4.000 caracteres; recusa vazio e só espaços", () => {
    expect(validarTexto("oi").ok).toBe(true);
    expect(validarTexto("x".repeat(4000)).ok).toBe(true);
    expect(validarTexto("x".repeat(4001))).toEqual({
      ok: false,
      erro: "A mensagem passa de 4.000 caracteres.",
    });
    expect(validarTexto("   \n ").ok).toBe(false);
    expect(validarTexto(null).ok).toBe(false);
  });
});

describe("datas agrupadas", () => {
  it("Hoje, Ontem, dia/mês no ano e dia/mês/ano fora dele", () => {
    expect(rotuloDoDia(new Date(2026, 9, 2, 8), AGORA)).toBe("Hoje");
    expect(rotuloDoDia(new Date(2026, 9, 1, 23, 59), AGORA)).toBe("Ontem");
    expect(rotuloDoDia(new Date(2026, 8, 30, 10), AGORA)).toBe("30/09");
    expect(rotuloDoDia(new Date(2025, 9, 2, 10), AGORA)).toBe("02/10/2025");
    expect(rotuloDoDia("lixo", AGORA)).toBe("");
  });

  it("Ontem atravessa a virada do mês", () => {
    const primeiro = new Date(2026, 10, 1, 9);
    expect(rotuloDoDia(new Date(2026, 9, 31, 22), primeiro)).toBe("Ontem");
  });

  it("agrupa em ordem, um grupo por dia, e ignora data inválida", () => {
    const grupos = agruparPorDia(
      [
        { id: "1", criada_em: new Date(2026, 8, 30, 9).toISOString() },
        { id: "2", criada_em: new Date(2026, 9, 1, 9).toISOString() },
        { id: "3", criada_em: new Date(2026, 9, 1, 18).toISOString() },
        { id: "x", criada_em: null },
        { id: "4", criada_em: new Date(2026, 9, 2, 7).toISOString() },
      ],
      AGORA,
    );
    expect(grupos.map((g) => [g.rotulo, g.mensagens.map((m) => m.id)])).toEqual(
      [
        ["30/09", ["1"]],
        ["Ontem", ["2", "3"]],
        ["Hoje", ["4"]],
      ],
    );
  });

  it("hora curta e o quando da lista (hora hoje, dia nos outros)", () => {
    expect(horaCurta(new Date(2026, 9, 2, 9, 5))).toBe("09:05");
    expect(quandoNaLista(new Date(2026, 9, 2, 9, 5), AGORA)).toBe("09:05");
    expect(quandoNaLista(new Date(2026, 9, 1, 9, 5), AGORA)).toBe("Ontem");
  });
});

describe("mensagens sem duplicar", () => {
  it("mescla pelo id, a nova versão substitui e a ordem é a de envio", () => {
    const atuais = [
      { id: "b", criada_em: "2026-10-02T10:01:00Z", texto: "dois" },
      {
        id: "a",
        criada_em: "2026-10-02T10:00:00Z",
        texto: "um",
        pendente: true,
      },
    ];
    const novas = [
      {
        id: "a",
        criada_em: "2026-10-02T10:00:00Z",
        texto: "um",
        pendente: false,
      },
      { id: "b", criada_em: "2026-10-02T10:01:00Z", texto: "", apagada: true },
      { id: "c", criada_em: "2026-10-02T10:02:00Z", texto: "três" },
    ];
    const r = mesclarMensagens(atuais, novas);
    expect(r.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(r[0].pendente).toBe(false);
    expect(r[1].apagada).toBe(true);
    expect(mesclarMensagens(r, novas)).toHaveLength(3);
  });

  it("a linha do Realtime vira o formato da tela", () => {
    expect(
      mensagemDaLinha({
        CO_MENSAGEM: "m1",
        CO_CONVERSA: "c1",
        CO_USUARIO_AUTOR: "u1",
        DS_TEXTO: "oi",
        DS_LINK_TELA: null,
        CO_USUARIOS_MENCIONADOS: ["u2"],
        DT_CRIACAO: "2026-10-02T10:00:00Z",
        DT_EDICAO: null,
        ST_APAGADA: "N",
      }),
    ).toEqual({
      id: "m1",
      conversa: "c1",
      autor: "u1",
      texto: "oi",
      link: null,
      mencoes: ["u2"],
      criada_em: "2026-10-02T10:00:00Z",
      editada_em: null,
      apagada: false,
    });
    expect(mensagemDaLinha({ CO_MENSAGEM: "m" })).toBeNull();
  });
});

describe("não lidas", () => {
  const msgs = [
    { id: "1", autor: "eu", criada_em: "2026-10-02T10:00:00Z" },
    { id: "2", autor: "ana", criada_em: "2026-10-02T10:01:00Z" },
    { id: "3", autor: "ana", criada_em: "2026-10-02T10:02:00Z", apagada: true },
    { id: "4", autor: "ana", criada_em: "2026-10-02T10:03:00Z" },
  ];

  it("conta só as de outras pessoas, depois da leitura, sem as apagadas", () => {
    expect(naoLidasDasMensagens(msgs, null, "eu")).toBe(2);
    expect(naoLidasDasMensagens(msgs, "2026-10-02T10:01:00Z", "eu")).toBe(1);
    expect(naoLidasDasMensagens(msgs, "2026-10-02T11:00:00Z", "eu")).toBe(0);
  });

  it("o total ignora as conversas silenciadas", () => {
    expect(
      totalDeNaoLidas([
        { nao_lidas: 2 },
        { nao_lidas: 5, silenciada: true },
        { nao_lidas: 1 },
        { nao_lidas: "x" },
      ]),
    ).toBe(3);
  });

  it("avisa só mensagem de outra pessoa, em conversa não silenciada e fora da vista", () => {
    const base = {
      mensagem: { autor: "ana" },
      eu: "eu",
      conversa: { silenciada: false },
      abertaAVista: false,
    };
    expect(deveAvisar(base)).toBe(true);
    expect(deveAvisar({ ...base, abertaAVista: true })).toBe(false);
    expect(deveAvisar({ ...base, mensagem: { autor: "eu" } })).toBe(false);
    expect(deveAvisar({ ...base, conversa: { silenciada: true } })).toBe(false);
  });
});

describe("conversas na lista", () => {
  const eu = "u0";
  const direta = {
    id: "d",
    tipo: "DIRETA",
    participantes: [
      { id: "u0", nome: "Eu Mesma" },
      { id: "u1", nome: "Ana Paula Souza", online: true },
    ],
    ultima: { autor: "u1", texto: "Bom  dia\n", apagada: false },
  };
  const grupo = {
    id: "g",
    tipo: "GRUPO",
    nome: "Equipe RH",
    participantes: [
      { id: "u0", nome: "Eu Mesma" },
      { id: "u2", nome: "Bruno Lima" },
    ],
    ultima: { autor: "u2", texto: "ok" },
  };
  const edital = {
    id: "e",
    tipo: "EDITAL",
    edital: { titulo: "83/2026", unidade: "DSEI Xingu" },
    participantes: [],
    ultima: { autor: "u0", texto: "vi", apagada: false },
  };

  it("título: a outra pessoa, o nome do grupo ou o edital", () => {
    expect(tituloDaConversa(direta, eu)).toBe("Ana Paula Souza");
    expect(tituloDaConversa(grupo, eu)).toBe("Equipe RH");
    expect(tituloDaConversa(edital, eu)).toBe("Edital 83/2026");
  });

  it("prévia: Você, o primeiro nome no grupo, mensagem apagada", () => {
    expect(previaDaUltima(direta, eu)).toBe("Bom dia");
    expect(previaDaUltima(grupo, eu)).toBe("Bruno: ok");
    expect(previaDaUltima(edital, eu)).toBe("Você: vi");
    expect(
      previaDaUltima({ ...grupo, ultima: { apagada: true, autor: "u2" } }, eu),
    ).toBe("Mensagem apagada");
  });

  it("busca sem acento por título, participante e unidade do edital", () => {
    const todas = [direta, grupo, edital];
    expect(filtrarConversas(todas, "ana", eu).map((c) => c.id)).toEqual(["d"]);
    expect(filtrarConversas(todas, "BRUNO", eu).map((c) => c.id)).toEqual([
      "g",
    ]);
    expect(filtrarConversas(todas, "xingu", eu).map((c) => c.id)).toEqual([
      "e",
    ]);
    expect(filtrarConversas(todas, "", eu)).toHaveLength(3);
  });
});

describe("menções", () => {
  const pessoas = [
    { id: "a", nome: "Ana" },
    { id: "ap", nome: "Ana Paula" },
    { id: "j", nome: "João Silva" },
  ];

  it("reconhece @Nome (sem acento e maiúsculas); o nome mais longo vence", () => {
    expect(extrairMencoes("Oi @ana paula, tudo bem?", pessoas)).toEqual(["ap"]);
    expect(extrairMencoes("@Ana e @joao silva.", pessoas)).toEqual(["j", "a"]);
    expect(extrairMencoes("email@ana.com", pessoas)).toEqual([]);
    expect(extrairMencoes("@Anabela", pessoas)).toEqual([]);
  });

  it("partes do texto destacam só quem foi mencionado", () => {
    expect(partesDoTexto("Oi @Ana Paula!", [pessoas[1]])).toEqual([
      { tipo: "texto", texto: "Oi " },
      { tipo: "mencao", texto: "@Ana Paula" },
      { tipo: "texto", texto: "!" },
    ]);
    expect(partesDoTexto("Oi @Ana", [])).toEqual([
      { tipo: "texto", texto: "Oi @Ana" },
    ]);
  });

  it("acha a menção em digitação e troca pelo nome escolhido", () => {
    expect(mencaoEmDigitacao("Oi @an", 6)).toEqual({ inicio: 3, termo: "an" });
    expect(mencaoEmDigitacao("e-mail@an", 9)).toBeNull();
    expect(mencaoEmDigitacao("sem arroba", 10)).toBeNull();
    const m = mencaoEmDigitacao("Oi @an fim", 6);
    expect(inserirMencao("Oi @an fim", 6, m, pessoas[1])).toEqual({
      texto: "Oi @Ana Paula  fim",
      cursor: 14,
    });
  });
});

describe("link da tela (só dentro do app)", () => {
  it("aceita view do menu com área, Configurações com seção e edital com uuid", () => {
    expect(
      linkDaTela({
        view: "classificacao",
        area: "saude-indigena",
        edital: {
          id: "00000000-0000-4000-a000-00000000f001",
          titulo: "83/2026",
        },
      }),
    ).toEqual({
      view: "classificacao",
      area: "saude-indigena",
      edital: { id: "00000000-0000-4000-a000-00000000f001", titulo: "83/2026" },
      rotulo: "Classificação · Saúde Indígena · Edital 83/2026",
    });
    expect(
      linkDaTela({ view: "config", area: "sede", secao: "acessos" }),
    ).toEqual({
      view: "config",
      secao: "acessos",
      rotulo: "Configurações · acessos",
    });
  });

  it("recusa URL, painel externo, view desconhecida e edital sem uuid", () => {
    for (const ruim of [
      { view: "https://exemplo.invalid" },
      { view: "javascript:alert(1)" },
      { view: "panel:123" },
      { view: "inventada" },
      { view: "nucleo", area: "../x" },
      { view: "nucleo", edital: { id: "1" } },
      null,
      "nucleo",
    ])
      expect(linkDaTela(ruim)).toBeNull();
  });

  it("rótulo do link", () => {
    expect(rotuloDoLink({ view: "nucleo", area: "sede" })).toBe(
      "Editais · SEDE",
    );
  });
});

describe("permissão Mensagens (chat)", () => {
  it("é recurso da matriz com Sem acesso | Usar", () => {
    expect(RESOURCES).toContainEqual(["chat", "Mensagens"]);
    expect(niveisDoRecurso("chat")).toEqual([
      ["sem_acesso", "Sem acesso"],
      ["leitor", "Usar"],
    ]);
    expect(rotuloDoNivel("leitor", "chat")).toBe("Usar");
  });

  it("só aparece com o recurso na matriz", () => {
    expect(podeUsarChat({ ativo: true, permissoes: { chat: "leitor" } })).toBe(
      true,
    );
    expect(
      podeUsarChat({ ativo: true, permissoes: { chat: "sem_acesso" } }),
    ).toBe(false);
    expect(podeUsarChat({ ativo: true, permissoes: {} })).toBe(false);
    expect(podeUsarChat({ ativo: true, perfil: "admin" })).toBe(false);
    expect(podeUsarChat(null)).toBe(false);
  });
});
