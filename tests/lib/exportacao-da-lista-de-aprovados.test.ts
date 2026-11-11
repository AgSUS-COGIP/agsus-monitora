// @vitest-environment node
import { strFromU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { carregarBibliotecasDoPdf } from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  argumentosDoRegistro,
  COLUNAS_DA_EXPORTACAO,
  csvDaExportacao,
  identificacaoDaExportacao,
  linhasDaExportacao,
  nomeDoArquivoDaExportacao,
  planilhasDaExportacao,
  registroDaResposta,
  xlsxDaExportacao,
  type CandidatoDaExportacao,
  type PedidoDaExportacao,
  type RegistroDaExportacao,
} from "../../src/lib/exportacao-da-lista-de-aprovados.ts";
import { pdfDaExportacao } from "../../src/lib/exportacao-da-lista-de-aprovados-em-pdf.ts";

/* Dados fictícios. */
const REGISTRO: RegistroDaExportacao = {
  id: "0f0e0d0c-0b0a-4000-8000-000000000001",
  emitidaEm: "2026-11-10T17:30:00Z",
};

const candidato = (
  id: number,
  extra: Partial<CandidatoDaExportacao> = {},
): CandidatoDaExportacao => ({
  candidato_id: `c${id}`,
  edital_id: "e1",
  edital: "01/2026",
  unidade: "Unidade A",
  codigo_vaga: "V01",
  cargo: "Enfermeiro",
  classificacao: id,
  nome: `Pessoa ${id}`,
  modalidade: "Ampla concorrência",
  nota: 80.5,
  status: "",
  ...extra,
});

const pedido = (
  candidatos: CandidatoDaExportacao[],
  extra: Partial<PedidoDaExportacao> = {},
): PedidoDaExportacao => ({
  area: "saude-indigena",
  rotuloDaArea: "Saúde Indígena",
  candidatos,
  totalDoRecorte: candidatos.length,
  editais: [{ id: "e1", rotulo: "01/2026 · Unidade A" }],
  todosOsEditais: true,
  cargos: [],
  modalidades: [],
  situacoes: [],
  recorteDoAviso: false,
  convocacoes: new Map(),
  dadosDe: "2026-11-10T16:00:00Z",
  ...extra,
});

const BOM_NO_INICIO = new RegExp(`^${String.fromCharCode(0xfeff)}`);

/* Lê um CSV de `;` com aspas (o bastante para conferir o que escrevemos). */
function lerCsv(csv: string): string[][] {
  const linhas: string[][] = [];
  let linha: string[] = [];
  let celula = "";
  let aspas = false;
  const t = csv.replace(BOM_NO_INICIO, "");
  for (let i = 0; i < t.length; i += 1) {
    const c = t[i];
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') {
        celula += '"';
        i += 1;
      } else if (c === '"') aspas = false;
      else celula += c;
    } else if (c === '"') aspas = true;
    else if (c === ";") {
      linha.push(celula);
      celula = "";
    } else if (c === "\r") continue;
    else if (c === "\n") {
      linha.push(celula);
      linhas.push(linha);
      linha = [];
      celula = "";
    } else celula += c;
  }
  return linhas;
}

describe("linhasDaExportacao", () => {
  it("uma linha por candidato, sem repetir, na ordem edital → cargo → classificação → nome", () => {
    const linhas = linhasDaExportacao([
      candidato(3, { cargo: "Médico" }),
      candidato(2),
      candidato(2),
      candidato(10),
      candidato(1, { edital: "02/2026" }),
      candidato(9, { classificacao: null }),
    ]);
    expect(linhas.map((l) => [l[0], l[3], l[4]])).toEqual([
      ["01/2026", "Enfermeiro", 2],
      ["01/2026", "Enfermeiro", 10],
      ["01/2026", "Enfermeiro", ""],
      ["01/2026", "Médico", 3],
      ["02/2026", "Enfermeiro", 1],
    ]);
  });

  it("preserva modalidade e classificação, escreve a situação efetiva e o que a decisão judicial mudou", () => {
    const [linha] = linhasDaExportacao(
      [
        candidato(4, {
          modalidade: "Pessoas pretas e pardas",
          status: "Contratado",
          contratacao_situacao: "OUTRA_LISTA",
          sub_judice: true,
          alterado_judicialmente: true,
          nota_original: 70,
          classificacao_original: 9,
          modalidade_original: "Ampla concorrência",
        }),
      ],
      new Map([["c4", { data: "2026-11-03" }]]),
    );
    expect(
      Object.fromEntries(COLUNAS_DA_EXPORTACAO.map((c, i) => [c, linha?.[i]])),
    ).toEqual({
      Edital: "01/2026",
      Unidade: "Unidade A",
      "Código da vaga": "V01",
      Cargo: "Enfermeiro",
      Classificação: 4,
      Nome: "Pessoa 4",
      Modalidade: "Pessoas pretas e pardas",
      Nota: 80.5,
      Situação: "Contratado em outra lista",
      "Data da convocação": "03/11/2026",
      "Sub judice": "Sim",
      "Antes da decisão judicial":
        "Classificação 9; Nota 70; Modalidade Ampla concorrência",
    });
    expect(linhasDaExportacao([candidato(5)])[0]?.[8]).toBe("Sem status");
  });
});

describe("identificação, registro e nome do arquivo", () => {
  it("leva área, editais, filtros, registros de quantos, a data dos dados, a emissão e o registro", () => {
    const linhas = Object.fromEntries(
      identificacaoDaExportacao(
        pedido([candidato(1)], {
          totalDoRecorte: 5,
          todosOsEditais: false,
          cargos: ["Enfermeiro"],
          situacoes: ["__sem_status__", "Convocado"],
          recorteDoAviso: true,
        }),
        REGISTRO,
      ),
    );
    expect(linhas).toEqual({
      Documento: "Lista de aprovados",
      Área: "Saúde Indígena",
      Edital: "01/2026 · Unidade A",
      Cargo: "Enfermeiro",
      Modalidade: "Todas",
      Situação: "Sem status; Convocado",
      Recorte: "Só as vagas da pessoa do aviso",
      Registros: "1 de 5 da lista vigente no recorte",
      "Dados da lista de": "10/11/2026, 13:00",
      "Emitida em": "10/11/2026, 14:30",
      "Registro da exportação": REGISTRO.id,
    });
  });

  it("monta os parâmetros da RPC sem id de candidato", () => {
    const args = argumentosDoRegistro(
      pedido([candidato(1), candidato(1), candidato(2)], {
        totalDoRecorte: 7,
        situacoes: ["Contratado"],
      }),
      "PDF",
    );
    expect(args).toEqual({
      p_area: "saude-indigena",
      p_formato: "PDF",
      p_editais: ["e1"],
      p_cargos: [],
      p_modalidades: [],
      p_situacoes: ["Contratado"],
      p_recorte_do_aviso: false,
      p_total_na_tela: 7,
      p_registros: 2,
    });
    expect(JSON.stringify(args)).not.toContain("c1");
  });

  it("só gera com o registro confirmado pelo banco", () => {
    expect(
      registroDaResposta({
        exportacao_id: REGISTRO.id,
        emitida_em: REGISTRO.emitidaEm,
      }),
    ).toEqual(REGISTRO);
    for (const resposta of [
      null,
      {},
      { exportacao_id: "x", emitida_em: REGISTRO.emitidaEm },
      { exportacao_id: REGISTRO.id, emitida_em: "ontem" },
    ])
      expect(() => registroDaResposta(resposta)).toThrow("não confirmou");
  });

  it("nomeia o arquivo pela área, o edital (se um só) e a hora de Brasília", () => {
    const p = pedido([]);
    expect(nomeDoArquivoDaExportacao(p, "XLSX", REGISTRO.emitidaEm)).toBe(
      "lista-de-aprovados-saude-indigena-2026-11-10-1430.xlsx",
    );
    expect(
      nomeDoArquivoDaExportacao(
        { ...p, todosOsEditais: false },
        "CSV",
        REGISTRO.emitidaEm,
      ),
    ).toBe(
      "lista-de-aprovados-saude-indigena-01-2026-unidade-a-2026-11-10-1430.csv",
    );
  });
});

describe("CSV", () => {
  it("identificação no topo, cabeçalho, uma linha por candidato, `;`, BOM e CRLF", () => {
    const csv = csvDaExportacao(
      pedido([candidato(1), candidato(2, { nota: 7 })]),
      REGISTRO,
    );
    expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true);
    expect(csv).toContain("\r\n");
    const linhas = lerCsv(csv);
    const inicio = linhas.findIndex(
      (l) => l[0] === "Edital" && l[1] === "Unidade",
    );
    expect(linhas[inicio - 1]).toEqual([""]);
    expect(linhas[0]).toEqual(["Documento", "Lista de aprovados"]);
    expect(linhas[inicio]).toEqual([...COLUNAS_DA_EXPORTACAO]);
    expect(linhas.slice(inicio + 1).map((l) => [l[5], l[7]])).toEqual([
      ["Pessoa 1", "80,5"],
      ["Pessoa 2", "7"],
    ]);
  });

  it("protege contra fórmula e mantém `;`, aspas e quebra de linha dentro da célula", () => {
    const csv = csvDaExportacao(
      pedido([
        candidato(1, {
          nome: '=HYPERLINK("http://x")',
          cargo: "Cargo; com ponto e vírgula",
        }),
        candidato(2, { nome: "+55 61", modalidade: '-1 "x"\nlinha' }),
        candidato(3, { nome: "@soma", cargo: "\t=1+1" }),
      ]),
      REGISTRO,
    );
    const porNome = new Map(
      lerCsv(csv)
        .filter((l) => l[0] === "01/2026")
        .map((l) => [l[5], l]),
    );
    expect([...porNome.keys()].sort()).toEqual([
      "'+55 61",
      '\'=HYPERLINK("http://x")',
      "'@soma",
    ]);
    expect(porNome.get('\'=HYPERLINK("http://x")')?.[3]).toBe(
      "Cargo; com ponto e vírgula",
    );
    expect(porNome.get("'+55 61")?.[6]).toBe('\'-1 "x"\nlinha');
    // As pontas em branco saem; a fórmula que sobra continua protegida.
    expect(porNome.get("'@soma")?.[3]).toBe("'=1+1");
  });

  it("zero registros: identificação e cabeçalho", () => {
    const linhas = lerCsv(csvDaExportacao(pedido([]), REGISTRO));
    expect(linhas.at(-1)).toEqual([...COLUNAS_DA_EXPORTACAO]);
    expect(
      Object.fromEntries(
        linhas.filter((l) => l.length === 2).map((l) => [l[0], l[1]]),
      ).Registros,
    ).toBe("0");
  });
});

describe("XLSX", () => {
  it("duas planilhas (Aprovados com filtro; Identificação), números como número e texto sem fórmula", () => {
    const bytes = xlsxDaExportacao(
      pedido([candidato(1, { nome: "=1+1" }), candidato(2)]),
      REGISTRO,
      zipSync,
    );
    const arquivos = unzipSync(bytes);
    const livro = strFromU8(arquivos["xl/workbook.xml"] as Uint8Array);
    expect(livro).toContain('name="Aprovados"');
    expect(livro).toContain('name="Identificação"');
    const folha = strFromU8(arquivos["xl/worksheets/sheet1.xml"] as Uint8Array);
    expect(folha).toContain('<autoFilter ref="A1:L3"/>');
    expect(folha).toContain('<c r="E2"><v>1</v></c>');
    expect(folha).toContain('<c r="H2"><v>80.5</v></c>');
    // "=1+1" é texto (inlineStr), não fórmula (<f>).
    expect(folha).toContain('<t xml:space="preserve">=1+1</t>');
    expect(folha).not.toContain("<f>");
    const id = strFromU8(arquivos["xl/worksheets/sheet2.xml"] as Uint8Array);
    expect(id).toContain(REGISTRO.id);
    expect(id).toContain("10/11/2026, 14:30");
  });

  it("as planilhas trazem cabeçalho + linhas, também com zero registros", () => {
    const [aprovados, identificacao] = planilhasDaExportacao(
      pedido([]),
      REGISTRO,
    );
    expect(aprovados?.linhas).toEqual([[...COLUNAS_DA_EXPORTACAO]]);
    expect(identificacao?.linhas[0]).toEqual(["Campo", "Valor"]);
  });
});

describe("PDF", () => {
  it("tem a identificação, a tabela e o rodapé com a página", async () => {
    const libs = await carregarBibliotecasDoPdf();
    const bytes = await pdfDaExportacao(
      pedido([candidato(1, { nome: "Ana Lúcia" }), candidato(2)]),
      REGISTRO,
      libs,
      { comprimir: false },
      { ceder: async () => {} },
    );
    const texto = new TextDecoder("latin1").decode(bytes);
    expect(texto.startsWith("%PDF-")).toBe(true);
    for (const trecho of [
      "Lista de aprovados",
      "Ana L",
      "Pessoa 2",
      "Registro da exporta",
      REGISTRO.id,
      "gina 1 de 1",
    ])
      expect(texto).toContain(trecho);
  });
});

/*
  Os limites do navegador: a maior área tem 12.796 candidatos vigentes (issue
  #583). Com 13 mil, os três formatos saem em poucos segundos e o arquivo fica
  de tamanho razoável; o teste falha se algum passar do teto.
*/
describe("13 mil registros", () => {
  const MUITOS = Array.from({ length: 13_000 }, (_, i) =>
    candidato(i + 1, {
      edital: `${String((i % 40) + 1).padStart(2, "0")}/2026`,
      cargo: [
        "Enfermeiro",
        "Médico",
        "Técnico de enfermagem",
        "Agente indígena de saúde",
      ][i % 4],
      modalidade: i % 3 ? "Ampla concorrência" : "Pessoas pretas e pardas",
      status: ["", "Convocado", "Contratado", "Desistente"][i % 4],
    }),
  );
  const p = pedido(MUITOS, {
    editais: Array.from({ length: 40 }, (_, i) => ({
      id: `e${i + 1}`,
      rotulo: `${String(i + 1).padStart(2, "0")}/2026 · Unidade ${i + 1}`,
    })),
  });

  it("CSV e XLSX", () => {
    let t = performance.now();
    const csv = csvDaExportacao(p, REGISTRO);
    const tempoCsv = performance.now() - t;
    expect(
      lerCsv(csv).filter((l) => l.length === COLUNAS_DA_EXPORTACAO.length)
        .length,
    ).toBe(13_001);
    t = performance.now();
    const xlsx = xlsxDaExportacao(p, REGISTRO, zipSync);
    const tempoXlsx = performance.now() - t;
    expect(csv.length).toBeLessThan(3_000_000);
    expect(xlsx.length).toBeLessThan(2_000_000);
    expect(tempoCsv).toBeLessThan(5_000);
    expect(tempoXlsx).toBeLessThan(10_000);
  }, 30_000);

  it("PDF", async () => {
    const libs = await carregarBibliotecasDoPdf();
    const t = performance.now();
    const progresso: number[] = [];
    let pausas = 0;
    const pdf = await pdfDaExportacao(
      p,
      REGISTRO,
      libs,
      {},
      {
        aoProgresso: (f) => progresso.push(f),
        ceder: async () => {
          pausas += 1;
        },
      },
    );
    const tempo = performance.now() - t;
    expect(new TextDecoder("latin1").decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.length).toBeLessThan(15_000_000);
    expect(tempo).toBeLessThan(45_000);
    // Cede a vez à tela a cada 300 linhas e informa o progresso até 100%.
    expect(pausas).toBe(43);
    expect(progresso.at(-1)).toBe(1);
    expect(progresso).toEqual([...progresso].sort((a, b) => a - b));
    console.info(
      `PDF de 13 mil linhas: ${(pdf.length / 1e6).toFixed(1)} MB em ${(tempo / 1000).toFixed(1)} s`,
    );
  }, 90_000);
});
