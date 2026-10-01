import { describe, expect, it } from "vitest";
import {
  chaveDoErroDoPainel,
  errosDosPaineis,
  linhasDosPaineis,
  mudarRascunhoDoPainel,
  normalizarPaineis,
  paineisComRascunho,
  resumoDosPaineis,
  situacaoDoPainel,
} from "../src/lib/paineis-externos-das-configuracoes.js";
import {
  CHAVES_DAS_SECOES,
  errosDasSecoes,
  linhasDasSecoes,
  normalizarBooleano,
  normalizarInteiro,
  normalizarValoresCarregados,
} from "../src/lib/publicacao-de-configuracoes.js";

/*
  Painéis externos e Operação em React (01/10): a regra sem DOM. O ponto
  delicado é o formato enviado ao banco, que tem de ser o mesmo do antigo
  `collectPanelRows` (src/modules/config-ui.js): [{ id, titulo, url, ativo,
  em_manutencao }], só painéis com id, textos aparados, booleanos.
*/

// Como a TB_PAINEL_EXTERNO chega de `loadPanels` (todas as colunas lidas).
const DO_BANCO = [
  {
    id: "p1",
    codigo: "recursos",
    titulo: " Recursos ",
    icone: "fa-file",
    url: "https://a.org/x ",
    ordem: 1,
    ativo: true,
    em_manutencao: false,
    tipo_abertura: "iframe",
  },
  {
    id: "p2",
    codigo: "bi",
    titulo: "",
    url: null,
    ordem: 2,
    ativo: false,
    em_manutencao: null,
  },
  { id: "", codigo: "sem-id", titulo: "Sem id", ativo: null },
];

describe("painéis: carga e formato enviado", () => {
  it("normaliza como a tabela antiga mostrava (ativo só falso com false)", () => {
    const [p1, p2, p3] = normalizarPaineis(DO_BANCO);
    expect(p1).toEqual({
      id: "p1",
      codigo: "recursos",
      titulo: "Recursos",
      url: "https://a.org/x",
      ativo: true,
      em_manutencao: false,
      nome: "Recursos",
    });
    expect(p2).toMatchObject({ titulo: "", url: "", ativo: false, nome: "bi" });
    expect(p3.ativo).toBe(true);
    expect(normalizarPaineis(undefined)).toEqual([]);
  });

  it("p_paineis tem o formato do collectPanelRows, sem os painéis sem id", () => {
    const linhas = linhasDosPaineis(normalizarPaineis(DO_BANCO));
    expect(linhas).toEqual([
      {
        id: "p1",
        titulo: "Recursos",
        url: "https://a.org/x",
        ativo: true,
        em_manutencao: false,
      },
      { id: "p2", titulo: "", url: "", ativo: false, em_manutencao: false },
    ]);
    for (const linha of linhas)
      expect(Object.keys(linha)).toEqual([
        "id",
        "titulo",
        "url",
        "ativo",
        "em_manutencao",
      ]);
  });

  it("o rascunho guarda só o que difere do carregado", () => {
    const paineis = normalizarPaineis(DO_BANCO);
    let rascunho = mudarRascunhoDoPainel(
      new Map(),
      paineis,
      "p1",
      "url",
      "https://b.org",
    );
    rascunho = mudarRascunhoDoPainel(
      rascunho,
      paineis,
      "p2",
      "em_manutencao",
      true,
    );
    expect(Object.fromEntries(rascunho)).toEqual({
      p1: { url: "https://b.org" },
      p2: { em_manutencao: true },
    });
    const atuais = paineisComRascunho(paineis, rascunho);
    expect(atuais[0].url).toBe("https://b.org");
    expect(atuais[1].em_manutencao).toBe(true);
    // Voltar ao valor carregado (com espaços) desfaz.
    rascunho = mudarRascunhoDoPainel(
      rascunho,
      paineis,
      "p1",
      "url",
      " https://a.org/x",
    );
    rascunho = mudarRascunhoDoPainel(
      rascunho,
      paineis,
      "p2",
      "em_manutencao",
      false,
    );
    expect(rascunho.size).toBe(0);
    // Campo que a RPC não grava (ícone, ordem) ou painel desconhecido: nada.
    expect(
      mudarRascunhoDoPainel(new Map(), paineis, "p1", "ordem", 9).size,
    ).toBe(0);
    expect(
      mudarRascunhoDoPainel(new Map(), paineis, "x", "url", "https://c").size,
    ).toBe(0);
  });
});

describe("painéis: validação e situação", () => {
  it("endereço http(s) ou vazio; ativo precisa de endereço", () => {
    const paineis = normalizarPaineis([
      { id: "a", titulo: "A", url: "ftp://x", ativo: true },
      { id: "b", codigo: "b", url: "javascript:alert(1)", ativo: false },
      { id: "c", titulo: "C", url: "", ativo: true },
      { id: "d", titulo: "D", url: "", ativo: false },
      { id: "e", titulo: "E", url: "http://intranet", ativo: true },
    ]);
    const erros = errosDosPaineis(paineis);
    expect(Object.fromEntries(erros)).toEqual({
      [chaveDoErroDoPainel("a")]:
        "URL inválida no campo Endereço do painel A: use https:// ou http://.",
      [chaveDoErroDoPainel("b")]:
        "URL inválida no campo Endereço do painel b: use https:// ou http://.",
      [chaveDoErroDoPainel("c")]:
        "Painéis ativos precisam de uma URL configurada.",
    });
  });

  it("situação: inativo > manutenção > ativo com URL > sem URL", () => {
    expect(
      situacaoDoPainel({ ativo: false, em_manutencao: true, url: "x" }),
    ).toBe("inativo");
    expect(
      situacaoDoPainel({ ativo: true, em_manutencao: true, url: "" }),
    ).toBe("manutencao");
    expect(situacaoDoPainel({ ativo: true, url: " " })).toBe("semUrl");
    expect(
      resumoDosPaineis([{ ativo: true, url: "x" }, { ativo: false }]),
    ).toEqual({ total: 2, ativo: 1, manutencao: 0, inativo: 1, semUrl: 0 });
  });
});

describe("Operação: campos em React", () => {
  const OPERACAO = [
    "cogip_versao",
    "app_version_current",
    "feature_realtime_monitoramento",
    "access_heartbeat_minutos",
  ];

  it("entraram nas seções (monit_id, morto, saiu)", () => {
    for (const chave of OPERACAO) expect(CHAVES_DAS_SECOES).toContain(chave);
    expect(CHAVES_DAS_SECOES).not.toContain("monit_id");
    // O aviso global é da Página inicial, também em React.
    expect(CHAVES_DAS_SECOES).toContain("broadcast_msg");
  });

  it("normaliza como cfgBool/cfgInt do legado", () => {
    expect(normalizarBooleano("SIM")).toBe("true");
    expect(normalizarBooleano("0")).toBe("false");
    expect(normalizarBooleano("")).toBe("true");
    expect(normalizarInteiro("7min", 5)).toBe("7");
    expect(normalizarInteiro("0", 5)).toBe("1");
    expect(normalizarInteiro("", 5)).toBe("5");
    const valores = normalizarValoresCarregados({
      feature_realtime_monitoramento: "não",
      cogip_nome: "COGIP",
    });
    expect(valores.get("feature_realtime_monitoramento")).toBe("false");
    // Chave ausente: o padrão que o formulário legado mostrava.
    expect(valores.get("access_heartbeat_minutos")).toBe("5");
    expect(valores.get("cogip_nome")).toBe("COGIP");
    expect(valores.has("cogip_versao")).toBe(false);
  });

  it("heartbeat inteiro de 1 a 60; as linhas levam a descrição de antes", () => {
    const erro = (valor) =>
      errosDasSecoes(new Map([["access_heartbeat_minutos", valor]])).get(
        "access_heartbeat_minutos",
      );
    expect(erro("5")).toBeUndefined();
    expect(erro("60")).toBeUndefined();
    for (const ruim of ["0", "61", "2.5", ""])
      expect(erro(ruim)).toBe(
        "O heartbeat deve ser um número inteiro entre 1 e 60.",
      );
    const linhas = new Map(
      linhasDasSecoes(
        normalizarValoresCarregados({ cogip_versao: " V.2 " }),
      ).map((linha) => [linha.chave, linha]),
    );
    expect(linhas.get("cogip_versao")).toEqual({
      chave: "cogip_versao",
      valor: "V.2",
      descricao: "Versão do sistema",
    });
    expect(linhas.get("feature_realtime_monitoramento")).toEqual({
      chave: "feature_realtime_monitoramento",
      valor: "true",
      descricao: "Habilita atualização em tempo real do monitoramento",
    });
    expect(linhas.get("access_heartbeat_minutos").descricao).toBe(
      "Intervalo de auditoria heartbeat, em minutos",
    );
    expect(linhas.get("app_version_current").descricao).toBe(
      "Versão corrente publicada",
    );
  });
});
