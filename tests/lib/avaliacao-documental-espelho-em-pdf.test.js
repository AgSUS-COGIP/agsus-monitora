import { readFileSync } from "node:fs";
import { unzipSync } from "fflate";
import { describe, expect, it, vi } from "vitest";
import {
  COLUNAS_DOS_CRITERIOS,
  montarEspelho,
  RODAPE_DO_ESPELHO,
  SECOES_DO_ESPELHO,
  SEM_OBSERVACAO,
  SUBTITULO_DO_ESPELHO,
} from "../../src/lib/avaliacao-documental/espelho-de-nota.ts";
import {
  carregarBibliotecasDoPdf,
  nomeDoPdfDoEspelho,
  nomeDoZipDosEspelhos,
  nomesSemRepetir,
  pdfDoEspelho,
  textoParaOPdf,
  trechoDoNome,
  zipDosEspelhos,
} from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  calcularFicha,
  declaradaDaFicha,
  regraDaFicha,
} from "../../src/lib/avaliacao-documental/ficha.js";
import { entradaDoEspelho } from "../../src/modulos/avaliacao-documental/ficha/espelho-de-nota.ts";

/*
  O espelho em PDF: sai do MESMO objeto Espelho (montarEspelho), com texto de
  verdade (lido aqui no PDF sem compressão), A4, os quadros na ordem da página
  impressa; os nomes dos arquivos; o ZIP com um PDF por espelho, em lotes.
*/

const f114 = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);
const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";
const EDITAL = { rotulo: "114/2026", area: "projetos" };

const ELIMINADO = {
  nivel: "medio",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  blocos: {
    IDENTIDADE: { situacao: "CONFORME" },
    ESCOLARIDADE: { situacao: "CONFORME" },
    REQUISITO_DO_CARGO: {
      situacao: "NAO_CONFORME",
      motivos: ["OUTRO"],
      motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
    },
  },
  titulos: [],
  cursos: [],
  vinculos: [],
};

const COM_PONTOS = {
  nivel: "medio",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  blocos: {
    IDENTIDADE: { situacao: "CONFORME" },
    ESCOLARIDADE: { situacao: "CONFORME" },
    REQUISITO_DO_CARGO: { situacao: "CONFORME" },
    CURSOS: {
      situacao: "CONFORME",
      nota_ajustada: 1,
      justificativas: ["OUTRO"],
      motivo_livre: "Certificado de 40 h sem assinatura da instituição.",
      observacao: "Enviou os certificados num único PDF.",
    },
    EXPERIENCIA: { situacao: "CONFORME" },
  },
  titulos: [],
  cursos: [
    { nome: "Primeiros socorros", horas: 120, aceito: true },
    { nome: "Curso recusado", horas: 20, aceito: false, motivo: "Sem carga" },
  ],
  vinculos: [
    {
      empregador: "Transportes Exemplo",
      categoria: f114.regra.blocos.find((b) => b.tipo === "VINCULOS")
        .categorias[0].codigo,
      inicio: "2019-01-01",
      fim: "2024-12-31",
      aceito: true,
    },
  ],
  observacoes: "Candidato(a) atendeu a todos os requisitos.",
};

function espelhoDe(lancamento, ficha = {}) {
  const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
  const avaliacao = calcularFicha(regra, lancamento, { nota_minima: 15 });
  const declarada = declaradaDaFicha(
    regra,
    f114.vagas["182528"].respostas,
    lancamento.nivel,
  );
  return montarEspelho(
    entradaDoEspelho(
      { regra, lancamento, avaliacao, declarada, dados: { edital: EDITAL } },
      {
        nome: "Maria Conceição Exemplo",
        codigo: "7001",
        modalidade: "AC",
        vaga: "182513",
        cargo: MOTORISTA,
        art: 40,
        tp_resultado: avaliacao.resultado,
        nota_final: avaliacao.nota_final,
        ...ficha,
      },
    ),
  );
}

const libs = await carregarBibliotecasDoPdf();
const decodificar = (bytes) => new TextDecoder("latin1").decode(bytes);

/* O texto escrito no PDF sem compressão (os operadores de texto "(...) Tj"), em ordem. */
function textosDoPdf(bytes) {
  const bruto = decodificar(bytes);
  return [...bruto.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)].map((m) =>
    m[1].replace(/\\([()\\])/g, "$1"),
  );
}
const winAnsi = (t) =>
  new TextDecoder("latin1").decode(
    new Uint8Array(
      Array.from(textoParaOPdf(t)).map((c) =>
        c === "—" ? 0x97 : c === "•" ? 0x95 : c.charCodeAt(0),
      ),
    ),
  );

describe("pdfDoEspelho", () => {
  it("com pontos: A4, texto de verdade e os quadros na ordem da página impressa", () => {
    const espelho = espelhoDe(COM_PONTOS);
    expect(espelho.modelo).toBe("COM_PONTOS");
    const bytes = pdfDoEspelho(espelho, libs, { comprimir: false });
    const bruto = decodificar(bytes);
    expect(bruto.startsWith("%PDF-")).toBe(true);
    // A4 em pontos (595,28 × 841,89).
    expect(bruto).toMatch(/\/MediaBox \[0 0 595\.2\d+ 841\.8\d+\]/);
    // Fonte padrão (sem fonte embutida): leve.
    expect(bruto).toContain("/BaseFont /Helvetica");
    expect(bruto).not.toContain("/FontFile");

    const textos = textosDoPdf(bytes).join("\n");
    const ordem = [
      "AGÊNCIA BRASILEIRA DE APOIO",
      espelho.titulo,
      SUBTITULO_DO_ESPELHO,
      "Prezado(a) ",
      "Maria Conceição Exemplo",
      SECOES_DO_ESPELHO.dados.toUpperCase(),
      "Código do candidato",
      SECOES_DO_ESPELHO.notas.toUpperCase(),
      "Nota autodeclarada",
      SECOES_DO_ESPELHO.criterios.toUpperCase(),
      COLUNAS_DOS_CRITERIOS[2],
      SECOES_DO_ESPELHO.justificativas.toUpperCase(),
    ].map(winAnsi);
    let desde = -1;
    for (const trecho of ordem) {
      const onde = textos.indexOf(trecho, desde + 1);
      expect(onde, trecho).toBeGreaterThan(desde);
      desde = onde;
    }
    for (const c of espelho.criterios)
      expect(textos).toContain(winAnsi(c.rotulo));
    expect(textos).toContain(
      winAnsi("Certificado de 40 h sem assinatura da instituição."),
    );
    // O rodapé (quebrado em linhas) inteiro.
    expect(textos.replace(/\s+/g, " ")).toContain(
      winAnsi(RODAPE_DO_ESPELHO).slice(0, 60),
    );
  });

  it("eliminado: sem o quadro de critérios e sem a nota autodeclarada", () => {
    const espelho = espelhoDe(ELIMINADO);
    expect(espelho.modelo).toBe("ELIMINADO");
    const textos = textosDoPdf(
      pdfDoEspelho(espelho, libs, { comprimir: false }),
    ).join("\n");
    expect(textos).not.toContain(
      winAnsi(SECOES_DO_ESPELHO.criterios.toUpperCase()),
    );
    expect(textos).not.toContain("Nota autodeclarada");
    expect(textos.replace(/\s+/g, " ")).toContain(winAnsi("Não se aplica"));
    expect(textos).toContain(winAnsi("CNH enviada cortada"));
  });

  it("sem justificativa: 'Sem observação registrada.'", () => {
    const espelho = { ...espelhoDe(ELIMINADO), justificativas: [] };
    const textos = textosDoPdf(
      pdfDoEspelho(espelho, libs, { comprimir: false }),
    ).join("\n");
    expect(textos).toContain(winAnsi(SEM_OBSERVACAO));
  });

  it("o cabeçalho configurado substitui o timbrado padrão", () => {
    const textos = textosDoPdf(
      pdfDoEspelho(espelhoDe(ELIMINADO), libs, {
        comprimir: false,
        cabecalho: "AGÊNCIA DE TESTE\nRua Exemplo, 1",
      }),
    ).join("\n");
    expect(textos).toContain(winAnsi("AGÊNCIA DE TESTE"));
    expect(textos).not.toContain("BRASILEIRA DE APOIO");
  });

  it("comprimido é menor e continua um PDF", () => {
    const espelho = espelhoDe(COM_PONTOS);
    const leve = pdfDoEspelho(espelho, libs);
    const aberto = pdfDoEspelho(espelho, libs, { comprimir: false });
    expect(decodificar(leve).startsWith("%PDF-")).toBe(true);
    expect(leve.byteLength).toBeLessThan(aberto.byteLength);
    expect(leve.byteLength).toBeLessThan(40_000);
  });
});

describe("textoParaOPdf", () => {
  it("compõe acentos e troca o que as fontes padrão não têm", () => {
    expect(textoParaOPdf("Conceição")).toBe("Conceição");
    expect(textoParaOPdf("nota ≥ 15 — ok • “sim”")).toBe(
      "nota >= 15 — ok • “sim”",
    );
    expect(textoParaOPdf("a\tb\u0007c 😀")).toBe("a bc ?");
  });
});

describe("nomes dos arquivos", () => {
  it("o PDF: vaga, código e nome sem acento, minúsculo e seguro", () => {
    const espelho = espelhoDe(COM_PONTOS, {
      nome: "  Ágata D'Ávila / São João  ",
    });
    expect(nomeDoPdfDoEspelho(espelho)).toBe(
      "espelho-182513-7001-agata-d-avila-sao-joao.pdf",
    );
    expect(
      nomeDoPdfDoEspelho({
        ...espelho,
        codigoDaVaga: "",
        candidato: "../../x",
      }),
    ).toBe("espelho-7001-x.pdf");
  });

  it("o ZIP: edital, vaga (se escolhida) e data", () => {
    const quando = new Date(2026, 9, 19, 10, 0);
    expect(nomeDoZipDosEspelhos("114/2026", quando)).toBe(
      "espelhos-114-2026-2026-10-19.zip",
    );
    expect(nomeDoZipDosEspelhos("Edital 114/2026", quando, "182513")).toBe(
      "espelhos-114-2026-vaga-182513-2026-10-19.zip",
    );
    expect(nomeDoZipDosEspelhos(null, quando)).toBe("espelhos-2026-10-19.zip");
  });

  it("trechoDoNome corta no tamanho sem hífen no fim", () => {
    expect(trechoDoNome("Maria da Silva Santos", 11)).toBe("maria-da-si");
    expect(trechoDoNome("Maria da Silva", 9)).toBe("maria-da");
  });

  it("nomes repetidos ganham sufixo", () => {
    expect(nomesSemRepetir(["a.pdf", "b.pdf", "a.pdf", "a.pdf"])).toEqual([
      "a.pdf",
      "b.pdf",
      "a-2.pdf",
      "a-3.pdf",
    ]);
  });
});

describe("zipDosEspelhos", () => {
  it("um PDF por espelho, com os nomes, em lotes com progresso", async () => {
    const espelhos = [
      espelhoDe(COM_PONTOS),
      espelhoDe(ELIMINADO, { codigo: "7002", nome: "João" }),
      espelhoDe(COM_PONTOS),
    ];
    const progresso = vi.fn();
    const esperar = vi.fn(async () => {});
    const zip = await zipDosEspelhos(espelhos, libs, {
      porLote: 2,
      aoProgredir: progresso,
      esperar,
    });
    expect(zip.nomes).toEqual([
      "espelho-182513-7001-maria-conceicao-exemplo.pdf",
      "espelho-182513-7002-joao.pdf",
      "espelho-182513-7001-maria-conceicao-exemplo-2.pdf",
    ]);
    const arquivos = unzipSync(zip.bytes);
    expect(Object.keys(arquivos)).toEqual(zip.nomes);
    for (const bytes of Object.values(arquivos))
      expect(decodificar(bytes.slice(0, 5))).toBe("%PDF-");
    expect(progresso.mock.calls).toEqual([
      [0, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(esperar).toHaveBeenCalledTimes(2);
  });

  it("cancelar para no fim do lote", async () => {
    let cancelar = false;
    const zip = await zipDosEspelhos(
      [espelhoDe(COM_PONTOS), espelhoDe(COM_PONTOS), espelhoDe(COM_PONTOS)],
      libs,
      {
        porLote: 1,
        esperar: async () => {
          cancelar = true;
        },
        cancelado: () => cancelar,
      },
    );
    expect(zip).toBeNull();
  });
});
