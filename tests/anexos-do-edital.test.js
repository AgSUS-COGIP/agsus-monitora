import { describe, expect, it, vi } from "vitest";
import {
  editalDiferente,
  etapasDoAnexo,
  juntarAnexos,
  lerAnexoNoServidor,
  numeroDoEdital,
  problemaDoArquivo,
  quadroParaSalvar,
  resumoDoQuadro,
  textoDaModalidade,
} from "../src/lib/anexos-do-edital.js";

const CRONOGRAMA = [
  {
    atividade: "Publicação do Edital",
    data_inicio: "2026-09-29",
    data_fim: "2026-09-29",
    texto_datas: "29/09",
  },
  {
    atividade: "Impugnação do Edital",
    data_inicio: "2026-09-30",
    data_fim: "2026-10-02",
    texto_datas: "30/09 a 02/10",
  },
];
const VAGAS = [
  {
    cargo: "Enfermeiro",
    lotacao: "Polo Base Leonardo",
    modalidades: { "Ampla Concorrência": 1, PcD: null },
    vagas_imediatas: 1,
    cadastro_reserva: true,
  },
  {
    cargo: "Enfermeiro",
    lotacao: "Polo Base Pavuru",
    modalidades: { "Ampla Concorrência": null, PcD: null },
    vagas_imediatas: 0,
    cadastro_reserva: true,
  },
];

describe("arquivo e número do edital", () => {
  it("normaliza o número", () => {
    expect(numeroDoEdital("Edital 091/2026")).toBe("91/2026");
    expect(numeroDoEdital("sem número")).toBe("");
  });

  it("recusa o que não é PDF ou passa de 4 MB", () => {
    expect(
      problemaDoArquivo({ name: "a.pdf", type: "application/pdf", size: 10 }),
    ).toBe("");
    expect(problemaDoArquivo({ name: "a.docx", type: "", size: 10 })).toMatch(
      /não é PDF/,
    );
    expect(
      problemaDoArquivo({
        name: "a.pdf",
        type: "application/pdf",
        size: 5 * 1024 * 1024,
      }),
    ).toMatch(/4 MB/);
  });

  it("avisa quando o PDF é de outro edital", () => {
    expect(editalDiferente("117/2026", "117/2026")).toBe(false);
    expect(editalDiferente("117/2026", "105/2026")).toBe(true);
    expect(editalDiferente("", "105/2026")).toBe(false);
  });
});

describe("leitura no servidor", () => {
  const arquivo = { name: "anexos.pdf", type: "application/pdf", size: 100 };

  it("manda o PDF com o token e devolve a resposta com o nome do arquivo", async () => {
    const buscar = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        edital: "117/2026",
        cronograma: CRONOGRAMA,
        vagas: VAGAS,
      }),
    }));
    const r = await lerAnexoNoServidor(arquivo, { token: "tk", buscar });
    expect(buscar).toHaveBeenCalledWith(
      "/api/anexos-do-edital",
      expect.objectContaining({
        method: "POST",
        body: arquivo,
        headers: expect.objectContaining({ Authorization: "Bearer tk" }),
      }),
    );
    expect(r.arquivo).toBe("anexos.pdf");
  });

  it("traduz 404 (fora da Vercel) e erros da função", async () => {
    await expect(
      lerAnexoNoServidor(arquivo, {
        token: "tk",
        buscar: async () => ({
          ok: false,
          status: 404,
          json: async () => ({}),
        }),
      }),
    ).rejects.toThrow(/Vercel/);
    await expect(
      lerAnexoNoServidor(arquivo, {
        token: "tk",
        buscar: async () => ({
          ok: false,
          status: 422,
          json: async () => ({ erro: "Não consegui ler este PDF." }),
        }),
      }),
    ).rejects.toThrow("Não consegui ler este PDF.");
  });
});

describe("juntar e converter", () => {
  it("junta cronograma de um PDF e quadro de outro (Projetos)", () => {
    const j = juntarAnexos([
      {
        arquivo: "anexo-i.pdf",
        edital: "93/2026",
        cronograma: [],
        vagas: VAGAS,
        modalidades: [],
      },
      {
        arquivo: "anexo-ii.pdf",
        edital: "93/2026",
        cronograma: CRONOGRAMA,
        vagas: [],
      },
    ]);
    expect(j.edital).toBe("93/2026");
    expect(j.arquivoDoCronograma).toBe("anexo-ii.pdf");
    expect(j.arquivoDoQuadro).toBe("anexo-i.pdf");
    expect(j.vagas).toHaveLength(2);
    expect(j.avisos).toEqual([]);
  });

  it("avisa o que faltou", () => {
    const j = juntarAnexos([{ arquivo: "x.pdf", cronograma: [], vagas: [] }]);
    expect(j.avisos).toHaveLength(2);
  });

  it("vira etapas do editor com origem PDF", () => {
    const etapas = etapasDoAnexo([
      ...CRONOGRAMA,
      {
        atividade: "Resultado",
        data_inicio: "",
        data_fim: "",
        texto_datas: "A definir",
      },
    ]);
    expect(etapas.map((e) => e.ordem)).toEqual([1, 2, 3]);
    expect(etapas[1]).toMatchObject({
      data_inicio: "2026-09-30",
      data_fim: "2026-10-02",
      origem: "PDF",
    });
    expect(etapas[2].observacao).toBe("No PDF: A definir");
  });

  it("monta o p_dados do quadro e o resumo", () => {
    const dados = quadroParaSalvar({
      arquivoDoQuadro: "anexos.pdf",
      vagas: VAGAS,
    });
    expect(dados.origem).toBe("PDF");
    expect(dados.linhas[0]).toEqual({
      cargo: "Enfermeiro",
      lotacao: "Polo Base Leonardo",
      modalidades: { "Ampla Concorrência": 1, PcD: null },
      vagas_imediatas: 1,
      cadastro_reserva: true,
    });
    expect(resumoDoQuadro(VAGAS)).toEqual({
      linhas: 2,
      cargos: 1,
      imediatas: 1,
      soCadastroReserva: 1,
    });
    expect(textoDaModalidade(null, true)).toBe("CR");
    expect(textoDaModalidade(2, true)).toBe("2");
    expect(textoDaModalidade(null, false)).toBe("—");
  });
});
