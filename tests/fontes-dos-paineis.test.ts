import { strFromU8, unzipSync, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import {
  lerFontesDoPainel,
  lerFontesDoRelatorio,
} from "../src/lib/fontes-dos-paineis.ts";
import {
  definicaoDoRelatorio,
  linhasDoRelatorio,
  xlsxDoRelatorio,
} from "../src/lib/relatorios-dos-paineis.ts";
import type { ZiparRelatorio } from "../src/lib/relatorios-dos-paineis.ts";
import { canManagePaineisDeDados } from "../src/lib/access-roles.ts";

/*
  Fontes das colunas dos Painéis no front: a leitura tolerante do que as RPCs
  devolvem ("fontes" e "avisos" nos relatórios; o editor de fontes), quem pode
  trocar a fonte e a aba "Fontes" do XLSX. Dados fictícios.
*/

describe("fontes na resposta do relatório", () => {
  it("lê a fonte de cada coluna e só os avisos de texto", () => {
    expect(
      lerFontesDoRelatorio({
        linhas: [],
        fontes: {
          vagas_imediatas: {
            padrao: false,
            visao: "VW_VAGA_CONVOCACAO",
            coluna: "QT_VAGA_IMEDIATA",
            rotulo: "Vagas da convocação › Vagas imediatas configuradas",
          },
          inscritos: {
            padrao: true,
            visao: null,
            coluna: null,
            rotulo: "Padrão: inscritos da Seleção",
          },
          estranha: "não é objeto",
        },
        avisos: ["A fonte sumiu.", 3, null],
      }),
    ).toEqual({
      fontes: {
        vagas_imediatas: {
          padrao: false,
          visao: "VW_VAGA_CONVOCACAO",
          coluna: "QT_VAGA_IMEDIATA",
          rotulo: "Vagas da convocação › Vagas imediatas configuradas",
        },
        inscritos: {
          padrao: true,
          visao: null,
          coluna: null,
          rotulo: "Padrão: inscritos da Seleção",
        },
      },
      avisos: ["A fonte sumiu."],
    });
  });

  it("resposta sem fontes (banco antigo ou estranha) vira vazio", () => {
    expect(lerFontesDoRelatorio({ linhas: [] })).toEqual({
      fontes: {},
      avisos: [],
    });
    expect(lerFontesDoRelatorio(null)).toEqual({ fontes: {}, avisos: [] });
  });
});

describe("o editor de fontes", () => {
  const RESPOSTA = {
    pode_editar: true,
    colunas: [
      {
        coluna: "vagas_imediatas",
        rotulo: "Vagas imediatas (título da vaga)",
        tipo: "inteiro",
        padrao: "Padrão: número no título da vaga",
        escolha: { visao: "VW_VAGA_CONVOCACAO", coluna: "QT_VAGA_IMEDIATA" },
        opcoes: [
          {
            visao: "VW_VAGA_CONVOCACAO",
            rotulo: "Vagas da convocação",
            colunas: [
              {
                coluna: "QT_VAGA_IMEDIATA",
                rotulo: "Vagas imediatas configuradas",
              },
            ],
          },
        ],
      },
      { coluna: "sem rótulo" },
    ],
    historico: [
      {
        em: "2026-11-13T15:00:00Z",
        nome: "Pessoa",
        coluna: "Vagas imediatas (título da vaga)",
        antes: "Padrão: número no título da vaga",
        depois: "Vagas da convocação › Vagas imediatas configuradas",
        motivo: "Conferência.",
      },
    ],
  };

  it("lê colunas, opções, escolha e histórico", () => {
    const f = lerFontesDoPainel(RESPOSTA);
    expect(f?.podeEditar).toBe(true);
    expect(f?.colunas).toHaveLength(1);
    expect(f?.colunas[0]).toEqual({
      coluna: "vagas_imediatas",
      rotulo: "Vagas imediatas (título da vaga)",
      tipo: "inteiro",
      padrao: "Padrão: número no título da vaga",
      escolha: { visao: "VW_VAGA_CONVOCACAO", coluna: "QT_VAGA_IMEDIATA" },
      opcoes: [
        {
          visao: "VW_VAGA_CONVOCACAO",
          rotulo: "Vagas da convocação",
          colunas: [
            {
              coluna: "QT_VAGA_IMEDIATA",
              rotulo: "Vagas imediatas configuradas",
            },
          ],
        },
      ],
    });
    expect(f?.historico[0]?.motivo).toBe("Conferência.");
  });

  it("sem pode_editar verdadeiro, só leitura; não objeto, nulo", () => {
    expect(
      lerFontesDoPainel({ ...RESPOSTA, pode_editar: "sim" })?.podeEditar,
    ).toBe(false);
    expect(lerFontesDoPainel("x")).toBeNull();
  });
});

describe("quem troca a fonte", () => {
  const perfil = (nivel: string) => ({
    id: "u1",
    ativo: true,
    permissoes: { paineis_dados: nivel },
  });
  it("só o Administrador em Painéis", () => {
    expect(canManagePaineisDeDados(perfil("admin"))).toBe(true);
    expect(canManagePaineisDeDados(perfil("editor"))).toBe(false);
    expect(canManagePaineisDeDados(perfil("leitor"))).toBe(false);
    expect(canManagePaineisDeDados({ id: "u1", ativo: true })).toBe(false);
  });
});

describe("a aba Fontes do XLSX", () => {
  const porCargo = definicaoDoRelatorio("editais-por-cargo");
  const linhas = linhasDoRelatorio(porCargo, [
    { edital: "39/2026", unidade: "DSEI Teste", codigo_vaga: "178962" },
  ]);
  const zipar: ZiparRelatorio = (arquivos, opcoes) => zipSync(arquivos, opcoes);
  const quando = new Date("2026-11-13T15:00:00Z");

  it("com as fontes, a 2ª aba diz a fonte de cada coluna", () => {
    const arquivos = unzipSync(
      xlsxDoRelatorio(porCargo, linhas, zipar, quando, {
        vagas_imediatas: {
          padrao: false,
          visao: "VW_VAGA_CONVOCACAO",
          coluna: "QT_VAGA_IMEDIATA",
          rotulo: "Vagas da convocação › Vagas imediatas configuradas",
        },
      }),
    );
    expect(strFromU8(arquivos["xl/workbook.xml"]!)).toContain('name="Fontes"');
    const aba = strFromU8(arquivos["xl/worksheets/sheet2.xml"]!);
    expect(aba).toContain("Vagas da convocação › Vagas imediatas configuradas");
    expect(aba).toContain("Padrão");
  });

  it("sem as fontes, uma aba só", () => {
    const arquivos = unzipSync(
      xlsxDoRelatorio(porCargo, linhas, zipar, quando),
    );
    expect(arquivos["xl/worksheets/sheet2.xml"]).toBeUndefined();
  });
});
