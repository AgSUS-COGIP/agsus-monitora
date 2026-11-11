// @vitest-environment node
import { strFromU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { carregarBibliotecasDoPdf } from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import type {
  PedidoDaExportacao,
  RegistroDaExportacao,
} from "../../src/lib/exportacao-da-lista-de-aprovados.ts";
import {
  argumentosDoRegistroDoResumo,
  COLUNAS_DO_ARQUIVO_DO_RESUMO,
  csvDoResumo,
  identificacaoDoResumo,
  linhasDoArquivoDoResumo,
  nomeDoArquivoDoResumo,
  xlsxDoResumo,
} from "../../src/lib/exportacao-do-resumo-por-cargo.ts";
import { pdfDoResumo } from "../../src/lib/exportacao-do-resumo-por-cargo-em-pdf.ts";
import {
  montarResumoPorCargoEStatus,
  type CandidatoDoResumo,
} from "../../src/lib/resumo-por-cargo-e-status.ts";

/* Dados fictícios; o arquivo do resumo não leva nome nem id de candidato. */
const REGISTRO: RegistroDaExportacao = {
  id: "0f0e0d0c-0b0a-4000-8000-000000000002",
  emitidaEm: "2026-11-11T15:00:00Z",
};

const vinculo = (
  id: string,
  extra: Partial<CandidatoDoResumo> = {},
): CandidatoDoResumo => ({
  candidato_id: id,
  nome: `Pessoa Fictícia ${id}`,
  edital_id: "e1",
  edital: "01/2099",
  cargo: "Cargo Fictício - Teletrabalho - 20h",
  codigo_vaga: "500",
  modalidade: "Ampla",
  lista_ativa: true,
  status: "",
  ...extra,
});

const CANDIDATOS = [
  vinculo("1", { status: "Contratado" }),
  vinculo("2", { status: "Desistente" }),
  vinculo("3"),
  vinculo("4", { modalidade: '=HYPERLINK("x")' }),
];
const SITUACOES = new Map([
  ["3", "Cadastro de reserva"],
  ["4", "Cadastro de reserva"],
]);
const resumo = () =>
  montarResumoPorCargoEStatus({ candidatos: CANDIDATOS, situacoes: SITUACOES });

const pedido = (
  extra: Partial<PedidoDaExportacao> = {},
): PedidoDaExportacao => ({
  area: "projetos",
  rotuloDaArea: "Projetos",
  candidatos: CANDIDATOS,
  totalDoRecorte: CANDIDATOS.length,
  editais: [{ id: "e1", rotulo: "01/2099" }],
  todosOsEditais: false,
  cargos: [],
  modalidades: [],
  situacoes: [],
  recorteDoAviso: false,
  dadosDe: "2026-11-11T14:00:00Z",
  ...extra,
});

describe("arquivo do resumo", () => {
  it("registra como RESUMO, com os mesmos parâmetros da lista", () => {
    const args = argumentosDoRegistroDoResumo(pedido(), "CSV");
    expect(args.p_conteudo).toBe("RESUMO");
    expect(args.p_total_na_tela).toBe(4);
    expect(args.p_registros).toBe(4);
    expect(args.p_editais).toEqual(["e1"]);
  });

  it("as linhas são as da tela: vaga, subtotal e total; voluntária/tácita em branco sem subtipo", () => {
    const linhas = linhasDoArquivoDoResumo(resumo());
    expect(linhas.map((l) => l[0])).toEqual([
      "Vaga",
      "Vaga",
      "Subtotal do grupo",
      "Total geral",
    ]);
    const total = linhas.at(-1)!;
    const col = (rotulo: string) =>
      COLUNAS_DO_ARQUIVO_DO_RESUMO.indexOf(rotulo);
    expect(total[col("Aprovados")]).toBe(4);
    expect(total[col("Contratados")]).toBe(1);
    expect(total[col("Desistência voluntária")]).toBe("");
    expect(total[col("Desistência tácita")]).toBe("");
    expect(total[col("Desistência sem subtipo")]).toBe(1);
    expect(total[col("Cadastro de reserva")]).toBe(2);
    expect(total[col("Outras situações")]).toBe(0);
  });

  it("CSV: identificação do resumo, protegido contra fórmula, sem nome de candidato", () => {
    const csv = csvDoResumo(pedido(), REGISTRO, resumo());
    expect(csv).toContain("Documento;Resumo por cargo e status");
    expect(csv).toContain("Unidade de contagem;");
    expect(csv).toContain("Subtipo não registrado no sistema");
    expect(csv).toContain(REGISTRO.id);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).not.toMatch(/Pessoa Fictícia/);
  });

  it("a identificação avisa quando o filtro de situação restringe a base", () => {
    const linhas = identificacaoDoResumo(
      pedido({ situacoes: ["Contratado"] }),
      REGISTRO,
      resumo(),
    );
    expect(linhas.find(([r]) => r === "Base")?.[1]).toMatch(
      /restrita pelo filtro de situação/,
    );
    expect(linhas.some(([r]) => r === "Registros")).toBe(false);
  });

  it("XLSX com as planilhas Resumo e Identificação", () => {
    const zip = unzipSync(xlsxDoResumo(pedido(), REGISTRO, resumo(), zipSync));
    const workbook = strFromU8(zip["xl/workbook.xml"]!);
    expect(workbook).toContain('name="Resumo"');
    expect(workbook).toContain('name="Identificação"');
    const todas = Object.values(zip)
      .map((b) => strFromU8(b))
      .join("");
    expect(todas).not.toMatch(/Pessoa Fictícia/);
  });

  it("nome do arquivo próprio do resumo", () => {
    expect(nomeDoArquivoDoResumo(pedido(), "XLSX", REGISTRO.emitidaEm)).toBe(
      "resumo-por-cargo-e-status-projetos-01-2099-2026-11-11-1200.xlsx",
    );
  });

  it("PDF com título, total e o registro", async () => {
    const libs = await carregarBibliotecasDoPdf();
    const bytes = pdfDoResumo(pedido(), REGISTRO, resumo(), libs, {
      comprimir: false,
    });
    const texto = new TextDecoder("latin1").decode(bytes);
    expect(texto.startsWith("%PDF-")).toBe(true);
    for (const trecho of [
      "Resumo por cargo e status",
      "Total geral",
      REGISTRO.id,
    ])
      expect(texto).toContain(trecho);
    expect(texto).not.toMatch(/Pessoa Fict/);
  });
});

describe("exportarResumoPorCargo: registro antes do arquivo", () => {
  it("registra com p_conteudo RESUMO e só então baixa", async () => {
    const { exportarResumoPorCargo } =
      await import("../../src/modulos/aprovados/exportacao/exportar-resumo.ts");
    const chamadas: string[] = [];
    const baixados: string[] = [];
    const resultado = await exportarResumoPorCargo(pedido(), resumo(), "CSV", {
      supabase: {
        rpc: async (nome: string, args: Record<string, unknown>) => {
          chamadas.push(`${nome}:${String(args.p_conteudo)}`);
          return {
            data: {
              exportacao_id: REGISTRO.id,
              emitida_em: REGISTRO.emitidaEm,
            },
            error: null,
          };
        },
      } as never,
      baixar: (_arquivo, nome) => baixados.push(nome),
    });
    expect(chamadas).toEqual(["registrar_exportacao_aprovados:RESUMO"]);
    expect(baixados).toEqual([resultado?.nome]);
  });

  it("banco sem a atualização: diz o que falta e não baixa nada", async () => {
    const { exportarResumoPorCargo } =
      await import("../../src/modulos/aprovados/exportacao/exportar-resumo.ts");
    const baixados: string[] = [];
    await expect(
      exportarResumoPorCargo(pedido(), resumo(), "XLSX", {
        supabase: {
          rpc: async () => ({
            data: null,
            error: { code: "PGRST202", message: "x" },
          }),
        } as never,
        baixar: (_a, nome) => baixados.push(nome),
      }),
    ).rejects.toThrow(/exportação do resumo ainda não está disponível/);
    expect(baixados).toEqual([]);
  });
});
