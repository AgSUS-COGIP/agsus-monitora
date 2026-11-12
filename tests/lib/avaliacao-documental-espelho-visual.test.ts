import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { espelhoDaEliminacaoPreAnalise } from "../../src/lib/avaliacao-documental/espelho-da-pre-classificacao.ts";
import {
  espelhoDeExemplo,
  folhaDoEspelho,
  linhasDoTimbrado,
  paginaDoEspelho,
} from "../../src/lib/avaliacao-documental/espelho-de-nota.ts";
import {
  carregarBibliotecasDoPdf,
  pdfDoEspelho,
} from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  comMarcadorNoCursor,
  TEXTOS_PADRAO_DO_ESPELHO,
  textosDoModelo,
} from "../../src/lib/avaliacao-documental/modelo-do-espelho.ts";
import { CABECALHO_PADRAO } from "../../src/lib/cabecalho-dos-documentos.ts";

/*
  O visual do espelho de nota (issue #588): a folha HTML no padrão do Manual
  de Identidade da AgSUS (General Sans, azul do manual, impressão A4 e prévia
  responsiva), sem XSS pelos textos do modelo, pelo nome ou pelo timbrado; o
  PDF igual ao de antes (o desenho não mudou com o visual da folha); e o
  comunicado de eliminação antes da análise, documento distinto, que não vira
  nota apurada nem nota zero. Só dados fictícios.
*/

const parse = (html: string) =>
  new DOMParser().parseFromString(html, "text/html");

describe("folha do espelho no padrão do manual", () => {
  const html = paginaDoEspelho(espelhoDeExemplo("COM_PONTOS"));
  const estilo = parse(html).querySelector("style")?.textContent ?? "";

  it("General Sans do próprio site, com reserva, e o azul do manual", () => {
    expect(estilo).toContain('font-family: "General Sans"');
    expect(estilo).toContain(
      'url("/fonts/general-sans/GeneralSans-Variable.woff2")',
    );
    expect(estilo).toMatch(
      /body \{[^}]*font-family: "General Sans", Calibri, Carlito, "Segoe UI", Arial, sans-serif/,
    );
    expect(estilo).toContain("--azul: #0055a1");
    // A cor antiga (antes do manual) saiu da folha.
    expect(estilo).not.toContain("#003b70");
  });

  it("impressão: A4 sem margem do navegador, cores de fundo e títulos presos ao quadro", () => {
    expect(estilo).toContain("@page { size: A4; margin: 0; }");
    expect(estilo).toContain("print-color-adjust: exact");
    expect(estilo).toMatch(/h2 \{[^}]*break-after: avoid/);
    expect(estilo).toContain(
      ".folha + .folha { break-before: page; page-break-before: always; }",
    );
    // Os ajustes de tela (mesa, sombra, celular) não valem no papel.
    const telas = [...estilo.matchAll(/@media ([^{]+)\{/g)].map((m) =>
      (m[1] ?? "").trim(),
    );
    expect(telas).toEqual(["screen", "screen and (max-width: 640px)"]);
  });

  it("prévia responsiva: em largura de celular, a folha perde a margem de papel", () => {
    expect(estilo).toMatch(
      /@media screen and \(max-width: 640px\) \{[^@]*\.folha \{ margin: 0; padding: 20px 16px 24px;/,
    );
  });

  it("acessível: idioma, título do documento, cabeçalhos das linhas e das colunas", () => {
    const doc = parse(html);
    expect(doc.documentElement.getAttribute("lang")).toBe("pt-BR");
    expect(doc.title).toBe("Espelho de nota (exemplo)");
    expect(doc.querySelectorAll("h1")).toHaveLength(1);
    for (const th of doc.querySelectorAll("table.dados th"))
      expect(th.getAttribute("scope")).toBe("row");
    for (const th of doc.querySelectorAll("table.criterios thead th"))
      expect(th.getAttribute("scope")).toBe("col");
    expect(doc.querySelector("script")).toBeNull();
  });

  it("os dois modelos continuam: com pontos tem critérios; eliminado, não", () => {
    const com = parse(paginaDoEspelho(espelhoDeExemplo("COM_PONTOS")));
    const eli = parse(paginaDoEspelho(espelhoDeExemplo("ELIMINADO")));
    expect(com.querySelector<HTMLElement>(".folha")?.dataset.modelo).toBe(
      "COM_PONTOS",
    );
    expect(com.querySelector("table.criterios")).not.toBeNull();
    expect(eli.querySelector<HTMLElement>(".folha")?.dataset.modelo).toBe(
      "ELIMINADO",
    );
    expect(eli.querySelector("table.criterios")).toBeNull();
    expect(eli.querySelector("table.notas")?.textContent).toContain(
      TEXTOS_PADRAO_DO_ESPELHO.nao_se_aplica,
    );
    expect(eli.body.textContent).not.toContain(
      TEXTOS_PADRAO_DO_ESPELHO.rotulo_autodeclarada,
    );
  });
});

describe("sem XSS na folha", () => {
  const ATAQUE = '<script>alert(1)</script><img src=x onerror="alert(2)">';

  function semCodigo(html: string) {
    const doc = parse(html);
    expect(doc.querySelector("script")).toBeNull();
    expect(doc.querySelector("img[src='x']")).toBeNull();
    for (const el of doc.querySelectorAll("*"))
      for (const atributo of Array.from(el.attributes))
        expect(atributo.name.startsWith("on"), atributo.name).toBe(false);
    return doc;
  }

  it("textos do modelo, nome do candidato e timbrado entram como texto", () => {
    const textos = {
      ...TEXTOS_PADRAO_DO_ESPELHO,
      titulo: `Título ${ATAQUE}`,
      subtitulo: ATAQUE,
      saudacao: `Prezado(a) {candidato} ${ATAQUE}`,
      abertura: `Para {candidato}: ${ATAQUE}`,
      secao_dados: ATAQUE,
      rodape: ATAQUE,
    };
    const espelho = {
      ...espelhoDeExemplo("COM_PONTOS", textos),
      candidato: `Pessoa ${ATAQUE}`,
      justificativas: [ATAQUE],
    };
    const doc = semCodigo(
      folhaDoEspelho(espelho, { cabecalho: `AGÊNCIA\n${ATAQUE}` }),
    );
    expect(doc.querySelector("h1")?.textContent).toBe(`Título ${ATAQUE}`);
    expect(doc.querySelector(".timbrado")?.textContent).toContain(ATAQUE);
    expect(doc.querySelector("strong")?.textContent).toBe(`Pessoa ${ATAQUE}`);
  });

  it("logo só por endereço http(s) ou do próprio site", () => {
    for (const logo of [
      "javascript:alert(1)",
      'x" onerror="alert(1)',
      "data:text/html,<script>alert(1)</script>",
    ])
      expect(
        parse(
          folhaDoEspelho(espelhoDeExemplo("ELIMINADO"), { logo }),
        ).querySelector("img"),
      ).toBeNull();
    const doc = parse(
      folhaDoEspelho(espelhoDeExemplo("ELIMINADO"), {
        logo: "/assets/logo.svg",
      }),
    );
    expect(doc.querySelector("img")?.getAttribute("alt")).toBe("AgSUS");
  });

  it("modelo salvo com marcador estranho volta ao padrão (a folha nunca sai quebrada)", () => {
    const textos = textosDoModelo({ titulo: "Olá {constructor}" });
    expect(textos.titulo).toBe(TEXTOS_PADRAO_DO_ESPELHO.titulo);
  });
});

describe("timbrado e marcador do editor", () => {
  it("linhasDoTimbrado: as linhas do cabeçalho; vazio = o padrão da AgSUS", () => {
    expect(
      linhasDoTimbrado(" AGÊNCIA DE TESTE \r\n\r\nRua de Exemplo "),
    ).toEqual(["AGÊNCIA DE TESTE", "Rua de Exemplo"]);
    expect(linhasDoTimbrado("")).toEqual(CABECALHO_PADRAO.split("\n"));
    expect(linhasDoTimbrado(undefined)).toEqual(CABECALHO_PADRAO.split("\n"));
  });

  it("comMarcadorNoCursor: no cursor, no lugar da seleção ou no fim", () => {
    expect(comMarcadorNoCursor("Olá, !", 5, 5)).toEqual({
      valor: "Olá, {candidato}!",
      cursor: 16,
    });
    expect(comMarcadorNoCursor("Olá, NOME!", 5, 9)).toEqual({
      valor: "Olá, {candidato}!",
      cursor: 16,
    });
    expect(comMarcadorNoCursor("Olá, ", null, null)).toEqual({
      valor: "Olá, {candidato}",
      cursor: 16,
    });
    // Posições fora do texto ficam nas pontas.
    expect(comMarcadorNoCursor("ab", -3, 99).valor).toBe("{candidato}");
  });
});

const libs = await carregarBibliotecasDoPdf();

describe("PDF do espelho (regressão)", () => {
  /*
    O conteúdo desenhado nas páginas (os streams sem compressão), sem as
    datas do PDF. Mudou o desenho do PDF ou a versão do jsPDF de propósito?
    Confira o PDF gerado e atualize a impressão digital aqui.
  */
  function impressaoDigital(modelo: "COM_PONTOS" | "ELIMINADO") {
    const bytes = pdfDoEspelho(espelhoDeExemplo(modelo), libs, {
      comprimir: false,
    });
    const bruto = new TextDecoder("latin1").decode(bytes);
    const streams = [...bruto.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)]
      .map((m) => m[1])
      .join("\n--\n");
    return {
      paginas: (bruto.match(/\/Type \/Page\b/g) ?? []).length,
      hash: createHash("sha256").update(streams).digest("hex").slice(0, 16),
    };
  }

  it("com pontos e eliminado: o mesmo desenho de antes do visual novo da folha", () => {
    expect(impressaoDigital("COM_PONTOS")).toEqual(PDF_COM_PONTOS);
    expect(impressaoDigital("ELIMINADO")).toEqual(PDF_ELIMINADO);
  });

  it("determinístico: o mesmo espelho dá o mesmo desenho", () => {
    expect(impressaoDigital("COM_PONTOS")).toEqual(
      impressaoDigital("COM_PONTOS"),
    );
  });
});

describe("comunicado de eliminação antes da análise: documento distinto", () => {
  const eliminado = {
    codigo: "C900",
    nome: "Pessoa Fictícia",
    vaga: "V900",
    cargo: "Cargo Fictício",
    edital: "Edital 900/2026",
    situacao: "ELIMINADO",
    motivo: "Documento obrigatório não enviado.",
    motivo_codigo: "OUTRO",
    art: null,
    declarada: 12.5,
  };
  const DO_EDITAL = {
    ...TEXTOS_PADRAO_DO_ESPELHO,
    titulo: "Espelho do edital",
    rotulo_consolidada: "Nota após a análise",
    nao_se_aplica: "Eliminado na análise",
  };

  it("não usa o título nem as notas do modelo do edital", () => {
    const espelho = espelhoDaEliminacaoPreAnalise(eliminado, DO_EDITAL);
    expect(espelho.titulo).toBe("Comunicado de eliminação na triagem");
    const rotulos = espelho.notas.map((n) => n.rotulo);
    expect(rotulos).not.toContain(DO_EDITAL.rotulo_consolidada);
    expect(rotulos).toContain(
      "Nota declarada/recalculada da inscrição (não apurada)",
    );
    expect(espelho.notas.map((n) => n.valor)).not.toContain(
      DO_EDITAL.nao_se_aplica,
    );
  });

  it("nota declarada não é apurada e ausência de nota nunca vira zero", () => {
    const html = folhaDoEspelho(
      espelhoDaEliminacaoPreAnalise({ ...eliminado, declarada: null }),
    );
    const notas = parse(html).querySelector("table.notas")?.textContent ?? "";
    expect(notas).toContain("Não se aplica — análise não realizada");
    expect(notas).not.toMatch(/(^|\D)0(,0+)?(\D|$)/);
    expect(notas).not.toContain("declarada");
  });
});

/* A impressão digital do PDF de exemplo (espelhoDeExemplo, timbrado padrão, sem logo). */
const PDF_COM_PONTOS = { paginas: 1, hash: "1edea29090eb0492" };
const PDF_ELIMINADO = { paginas: 1, hash: "47a975da855116a9" };
