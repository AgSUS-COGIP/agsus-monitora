import { describe, expect, it, vi } from "vitest";
import {
  casoAbreAnalise,
  casosRestantes,
  csvDosCasos,
  diaDoCaso,
  filtroDoCaso,
  juntarPaginasDeCasos,
  motivoDoCaso,
  nomeDoCsvDosCasos,
  normalizarCaso,
  normalizarCasos,
  ondeDoCaso,
  quemDoCaso,
  termoDeBusca,
} from "../src/lib/avisos-de-conferencia.js";
import { filtrosDasAnalises } from "../src/lib/filtro-da-aya.js";
import { criarEstadoDosAvisos } from "../src/modulos/conferencias/estado.js";

/*
  Casos dos avisos de conferência (listar_casos_aviso_conferencia,
  20261007120000): o formato de cada caso (quem, onde, motivo), as páginas,
  a busca, o CSV e o pedido que leva o Painel das análises ao caso.
*/

const bruto = (extra) => ({
  aviso_id: "a1",
  conferencia: "ANALISE_DATA_INVALIDA",
  ordem: 1,
  analise_id: "00000000-0000-4000-a000-0000000000a1",
  codigo: "4512",
  nome: "Maria Fictícia",
  edital: "Edital 101/2026",
  codigo_vaga: "177979",
  nome_vaga: "Enfermeiro",
  responsavel: "Ana Analista",
  status: "Aprovado",
  data_analise: "2026-09-01",
  referencia: null,
  detalhe: {
    data_analise: "2026-09-01",
    inscricao: "2026-09-10",
    motivo: "antes_da_inscricao",
  },
  analises: null,
  fora_do_acesso: null,
  ...extra,
});

describe("formato do caso", () => {
  it("análise com data antes da inscrição: quem, onde e motivo, sem UUID", () => {
    const caso = normalizarCaso(bruto());
    expect(caso.chave).toBe("a1:1");
    expect(caso.titulo).toBe("Data da análise no futuro ou antes da inscrição");
    expect(quemDoCaso(caso)).toBe("4512 · Maria Fictícia");
    expect(ondeDoCaso(caso)).toBe(
      "Edital 101/2026 · 177979 · Enfermeiro · Resp. Ana Analista",
    );
    expect(caso.motivo).toBe(
      "Análise em 01/09/2026, antes da inscrição em 10/09/2026",
    );
    expect(quemDoCaso(caso)).not.toMatch(/0000-4000/);
  });

  it("data futura, notas, teto e soma", () => {
    expect(
      motivoDoCaso("ANALISE_DATA_INVALIDA", {
        data_analise: "2026-12-01",
        motivo: "futuro",
      }),
    ).toBe("Análise em 01/12/2026, data futura");
    expect(
      motivoDoCaso("ANALISE_APROVADA_ABAIXO_DO_CORTE", { nota: 50, corte: 60 }),
    ).toBe("Nota 50 · mínima 60");
    expect(
      motivoDoCaso("ANALISE_NOTA_DIFERENTE_DA_SOMA", { nota: 7.5, soma: 8.25 }),
    ).toBe("Nota 7,5 · soma das parciais 8,25");
    expect(
      motivoDoCaso("ANALISE_EXPERIENCIA_ACIMA_DO_TETO", {
        experiencia: 45,
        teto: 30,
      }),
    ).toBe("Experiência 45 · teto 30");
    expect(motivoDoCaso("CARGA_VARIACAO_BRUSCA", {})).toBe("");
  });

  it("candidato em dois editais: as análises dele e as fora do acesso", () => {
    const caso = normalizarCaso(
      bruto({
        conferencia: "ANALISE_EM_DOIS_EDITAIS",
        analise_id: null,
        detalhe: { editais: 2 },
        analises: [
          {
            id: "x1",
            edital: "Edital 101/2026",
            codigo_vaga: "1",
            nome_vaga: "Médico",
            status: "Aprovado",
          },
          { id: "x2", edital: "Edital 80/2026", status: "Pendente" },
        ],
        fora_do_acesso: 1,
      }),
    );
    expect(caso.motivo).toBe("Em 2 editais ativos");
    expect(caso.analises.map((a) => a.vaga)).toEqual(["1 · Médico", ""]);
    expect(caso.foraDoAcesso).toBe(1);
    expect(filtroDoCaso(caso)).toEqual({
      busca: "Maria Fictícia",
      analise: "x1",
    });
  });

  it("caso sem análise visível: a referência ou o código", () => {
    expect(
      quemDoCaso(
        normalizarCaso(
          bruto({ codigo: null, nome: null, referencia: "lista-9" }),
        ),
      ),
    ).toBe("Referência lista-9");
    expect(quemDoCaso(normalizarCaso(bruto({ nome: null })))).toBe("4512");
  });

  it("dia sem fuso", () => {
    expect(diaDoCaso("2026-01-02")).toBe("02/01/2026");
    expect(diaDoCaso("2026-01-02T23:59:00-03:00")).toBe("02/01/2026");
    expect(diaDoCaso("")).toBe("");
  });
});

describe("páginas e busca", () => {
  it("normaliza a página e junta sem repetir", () => {
    const pagina1 = normalizarCasos({
      total: 3,
      casos: [bruto(), bruto({ ordem: 2 })],
    });
    expect(pagina1.total).toBe(3);
    const pagina2 = normalizarCasos({
      total: 3,
      casos: [bruto({ ordem: 2 }), bruto({ ordem: 3 })],
    });
    const juntos = juntarPaginasDeCasos(pagina1.casos, pagina2.casos);
    expect(juntos.map((c) => c.ordem)).toEqual([1, 2, 3]);
    expect(casosRestantes(pagina1.casos, pagina1.total)).toBe(1);
    expect(casosRestantes(juntos, 3)).toBe(0);
    expect(normalizarCasos(null)).toEqual({ total: 0, casos: [] });
  });

  it("termo de busca: espaços simples e até 80 caracteres", () => {
    expect(termoDeBusca("  maria   fic ")).toBe("maria fic");
    expect(termoDeBusca("x".repeat(100))).toHaveLength(80);
    expect(termoDeBusca(null)).toBe("");
  });

  it("o estado pede a página certa: aviso, busca, recorte e deslocamento", async () => {
    const supabase = {
      rpc: vi.fn(async (nome) =>
        nome === "listar_casos_aviso_conferencia"
          ? { data: { total: 1, casos: [bruto()] }, error: null }
          : { data: { avisos: [] }, error: null },
      ),
    };
    const estado = criarEstadoDosAvisos({ supabase });
    await estado.carregar({ area: "saude-indigena", modulo: "analises" });
    await estado.listarCasos({ avisoId: "a1", deslocamento: 50 });
    expect(supabase.rpc).toHaveBeenLastCalledWith(
      "listar_casos_aviso_conferencia",
      {
        p_aviso: "a1",
        p_busca: null,
        p_area: null,
        p_modulo: null,
        p_limite: 50,
        p_deslocamento: 50,
      },
    );
    await estado.listarCasos({ busca: " 4512 " });
    expect(supabase.rpc).toHaveBeenLastCalledWith(
      "listar_casos_aviso_conferencia",
      {
        p_aviso: null,
        p_busca: "4512",
        p_area: "saude-indigena",
        p_modulo: "analises",
        p_limite: 50,
        p_deslocamento: 0,
      },
    );
  });

  it("o CSV lê todas as páginas de 1000 e baixa", async () => {
    const paginas = [
      Array.from({ length: 1000 }, (_, i) => bruto({ ordem: i + 1 })),
      [bruto({ ordem: 1001 })],
    ];
    const supabase = {
      rpc: vi.fn(async (_nome, args) => ({
        data: {
          total: 1001,
          casos: paginas[args.p_deslocamento === 0 ? 0 : 1],
        },
        error: null,
      })),
    };
    const baixar = vi.fn();
    const estado = criarEstadoDosAvisos({ supabase, baixar });
    const foi = await estado.exportarCasos({
      aviso: { id: "a1", conferencia: "ANALISE_DATA_INVALIDA" },
    });
    expect(foi).toBe(true);
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc.mock.calls[1][1]).toMatchObject({
      p_limite: 1000,
      p_deslocamento: 1000,
    });
    const [conteudo, nome] = baixar.mock.calls[0];
    expect(conteudo.split("\n")).toHaveLength(1002);
    expect(nome).toMatch(
      /^avisos-analise-data-invalida-\d{4}-\d{2}-\d{2}\.csv$/,
    );
  });
});

describe("CSV dos casos", () => {
  it("cabeçalho, uma linha por caso e célula protegida contra fórmula", () => {
    const csv = csvDosCasos([
      normalizarCaso(bruto()),
      normalizarCaso(bruto({ ordem: 2, nome: "=HYPERLINK(1)", codigo: "9" })),
    ]);
    const linhas = csv.split("\n");
    expect(linhas[0]).toBe(
      "Aviso;Código do candidato;Nome;Edital;Vaga;Responsável pela análise;Situação;Data da análise;Motivo;Análises do candidato;Vagas na lista de aprovados;Referência",
    );
    expect(linhas[1]).toContain(
      "4512;Maria Fictícia;Edital 101/2026;177979 · Enfermeiro;Ana Analista;Aprovado;01/09/2026",
    );
    expect(linhas[2]).toContain(";'=HYPERLINK(1);");
    expect(linhas).toHaveLength(3);
  });

  it("nome do arquivo da busca geral", () => {
    expect(nomeDoCsvDosCasos(null, new Date(2026, 9, 6))).toBe(
      "avisos-busca-2026-10-06.csv",
    );
  });
});

describe("caso → Painel das análises", () => {
  it("só caso de aviso das análises, com análise, abre o painel", () => {
    const caso = normalizarCaso(bruto());
    expect(casoAbreAnalise(caso, "analises")).toBe(true);
    expect(casoAbreAnalise(caso, "entrevistas")).toBe(false);
    expect(
      casoAbreAnalise(normalizarCaso(bruto({ analise_id: null })), "analises"),
    ).toBe(false);
  });

  it("o pedido vira a busca do painel", () => {
    const { filtros } = filtrosDasAnalises(
      { busca: "", edital: [] },
      filtroDoCaso(normalizarCaso(bruto())),
      [],
    );
    expect(filtros.busca).toBe("Maria Fictícia");
    // Sem nome (fora do acesso), a busca fica como estava.
    expect(
      filtrosDasAnalises({ busca: "x", edital: [] }, { busca: "" }, []).filtros
        .busca,
    ).toBe("x");
  });
});
