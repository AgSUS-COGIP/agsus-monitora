import { describe, expect, it, vi } from "vitest";
import {
  contarAnalises,
  contarEntrevistas,
  contarSelecao,
  responderComDados,
} from "../src/lib/dados-da-aya.js";
import {
  consumirPedidoDeFiltro,
  pedirFiltro,
} from "../src/app/pedido-de-filtro.js";

/*
  As perguntas com número da Aya (src/lib/dados-da-aya.js): contas iguais às
  dos indicadores das telas, só leitura, respeitando a permissão do perfil
  antes de buscar, e nenhum nome na resposta.
*/

const LINHAS = [
  {
    edital: "Edital 93/2026",
    status_consolidado: "Pendente",
    candidato: "Ana",
  },
  {
    edital: "Edital 93/2026",
    status_consolidado: "Pendente",
    candidato: "Bia",
  },
  {
    edital: "Edital 93/2026",
    status_consolidado: "Aprovado",
    candidato: "Caio",
  },
  {
    edital: "Edital 12/2026",
    status_consolidado: "Pendente",
    candidato: "Davi",
  },
];

const perfil = (permissoes, extra = {}) => ({
  ativo: true,
  perfil: "usuario",
  admin_global: false,
  permissoes,
  ...extra,
});
const LEITOR = perfil({
  analises: "leitor",
  selecao: "leitor",
  entrevistas: "leitor",
  recursos: "leitor",
});

describe("contas", () => {
  it("análises do edital, com os mesmos KPIs da tela", () => {
    const n = contarAnalises(LINHAS, { edital: "93/2026" });
    expect([n.pendente, n.aprovado, n.total, n.vazio]).toEqual([
      2,
      1,
      3,
      false,
    ]);
    expect(contarAnalises(LINHAS, { edital: "1/2020" }).vazio).toBe(true);
  });

  it("convocado sem nota: sem nota final e não marcado como ausente", () => {
    const n = contarEntrevistas({
      entrevistas: [
        { edital: "93/2026", nota: null, compareceu: "" },
        { edital: "93/2026", nota: null, compareceu: "N" },
        { edital: "93/2026", nota: 15, compareceu: "S", parecer: "APTO" },
      ],
      aprovadosSemEntrevista: [{ edital: "93/2026" }],
    });
    expect([n.semNota, n.semEntrevista, n.aptos]).toEqual([1, 1, 1]);
  });

  it("funil da Seleção", () => {
    const n = contarSelecao([
      { edital: "5/2026", aprovados: 10, contratados: 4, inscritos: 100 },
      { edital: "6/2026", aprovados: 10, contratados: 6, inscritos: 50 },
    ]);
    expect([n.inscritos, n.contratados, n.taxa]).toEqual([150, 10, 0.5]);
  });
});

describe("responder com dados", () => {
  it("pergunta comum segue para a base (null)", async () => {
    expect(
      await responderComDados({ pergunta: "o que é recurso?", perfil: LEITOR }),
    ).toBeNull();
  });

  it("conta, responde só números e oferece Abrir com o filtro", async () => {
    const buscar = vi.fn(async () => ({ linhas: LINHAS }));
    const r = await responderComDados({
      pergunta: "quantas análises pendentes tem o 93/2026?",
      contexto: { view: "dashboard", area: "sede" },
      perfil: LEITOR,
      buscar,
    });
    expect(buscar).toHaveBeenCalledWith("analises", {
      area: "sede",
      cargaDe: undefined,
    });
    expect(r.answer).toBe(
      "Há 2 análises pendentes no edital 93/2026 na SEDE, de 3 no total.",
    );
    for (const nome of ["Ana", "Bia", "Caio", "Davi"])
      expect(r.answer).not.toContain(nome);
    expect(r.provider).toBe("monitora-dados");
    expect(r.acaoDados).toEqual({
      view: "analises",
      filtro: { edital: "93/2026", metrica: "pendente" },
    });
  });

  it("sem permissão da tela, não busca e diz por quê", async () => {
    const buscar = vi.fn();
    const r = await responderComDados({
      pergunta: "quantos recursos aguardando parecer?",
      perfil: perfil({ analises: "leitor" }),
      buscar,
    });
    expect(buscar).not.toHaveBeenCalled();
    expect(r.answer).toContain("não inclui Recursos");
  });

  it("Status das atualizações só para o administrador global", async () => {
    const buscar = vi.fn(async () => ({}));
    const r = await responderComDados({
      pergunta: "tem alguma carga atrasada?",
      perfil: LEITOR,
      buscar,
    });
    expect(buscar).not.toHaveBeenCalled();
    expect(r.answer).toContain("administrador global");
  });

  it("erro de acesso do banco vira 'sem acesso', sem dado", async () => {
    const r = await responderComDados({
      pergunta: "quantos inscritos?",
      contexto: { view: "selecao", area: "projetos" },
      perfil: LEITOR,
      buscar: async () => {
        throw { code: "42501", message: "permission denied" };
      },
    });
    expect(r.answer).toBe("Seu acesso não deixa ver esses dados da Projetos.");
  });

  it("edital que não está nos dados", async () => {
    const r = await responderComDados({
      pergunta: "quantas análises pendentes no 1/2020?",
      perfil: LEITOR,
      buscar: async () => ({ linhas: LINHAS }),
    });
    expect(r.answer).toContain("Não achei o edital 1/2020");
  });

  it("última carga pela fonte da pergunta", async () => {
    const buscar = vi.fn(async () => ({ em: "2026-10-05T12:00:00Z" }));
    const r = await responderComDados({
      pergunta: "quando foi a última carga das entrevistas?",
      contexto: { area: "saude-indigena" },
      perfil: LEITOR,
      buscar,
    });
    expect(buscar).toHaveBeenCalledWith("conferencia", {
      area: "saude-indigena",
      cargaDe: "entrevistas",
    });
    expect(r.answer).toContain("09:00");
  });
});

describe("pedido de filtro (Abrir)", () => {
  it("vale uma vez, só para a tela pedida e por pouco tempo", () => {
    pedirFiltro("analises", { edital: "93/2026" }, 1000);
    expect(consumirPedidoDeFiltro("recursos", 1000)).toBeNull();
    pedirFiltro("analises", { edital: "93/2026" }, 1000);
    expect(consumirPedidoDeFiltro("analises", 2000)).toEqual({
      edital: "93/2026",
    });
    expect(consumirPedidoDeFiltro("analises", 2000)).toBeNull();
    pedirFiltro("analises", { edital: "1/2026" }, 1000);
    expect(consumirPedidoDeFiltro("analises", 60_000)).toBeNull();
  });
});
