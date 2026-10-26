import { readFileSync } from "node:fs";
import { TEXTOS_PADRAO_DO_ESPELHO } from "../../src/lib/avaliacao-documental/modelo-do-espelho.ts";
import { describe, expect, it } from "vitest";
import {
  modeloDoEspelho,
  montarEspelho,
  paginaDoEspelho,
} from "../../src/lib/avaliacao-documental/espelho-de-nota.ts";
import {
  calcularFicha,
  declaradaDaFicha,
  regraDaFicha,
} from "../../src/lib/avaliacao-documental/ficha.ts";
import { entradaDoEspelho } from "../../src/lib/avaliacao-documental/espelho-da-ficha-gravada.ts";

const f114 = JSON.parse(
  readFileSync(
    "tests/fixtures/avaliacao-documental/ficha-114-2026.json",
    "utf8",
  ),
);

/* A ficha concluída como estado-da-ficha.ts a deixa (regra da vaga, conta e declarada). */
function fichaConcluida(lancamento, documental = { nota_minima: 15 }) {
  const regra = regraDaFicha(structuredClone(f114.regra), lancamento);
  const avaliacao = calcularFicha(regra, lancamento, documental);
  const declarada = declaradaDaFicha(
    regra,
    f114.vagas["182528"].respostas,
    lancamento.nivel,
  );
  return { regra, lancamento, avaliacao, declarada };
}

const MOTORISTA = "CARGO 14: MOTORISTA - Categoria B (Nível Médio)";

const ELIMINADO = {
  nivel: "medio",
  modalidade: "AC",
  vaga: "182513",
  cargo: MOTORISTA,
  blocos: {
    IDENTIDADE: {
      situacao: "CONFORME",
      observacao: "RG com foto antiga, mas legível.",
    },
    ESCOLARIDADE: { situacao: "CONFORME" },
    REQUISITO_DO_CARGO: {
      situacao: "NAO_CONFORME",
      motivos: ["OUTRO"],
      motivo_livre: "CNH enviada cortada, sem a data de validade visível.",
    },
  },
  titulos: [],
  cursos: [{ nome: "Direção defensiva", horas: 60, aceito: true }],
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
  cursos: [{ nome: "Primeiros socorros", horas: 120, aceito: true }],
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
  const st = fichaConcluida(lancamento);
  const entrada = entradaDoEspelho(
    { ...st, dados: { edital: { rotulo: "114/2026", area: "projetos" } } },
    {
      nome: "Maria Exemplo",
      codigo: "7001",
      modalidade: "AC",
      vaga: "182513",
      cargo: MOTORISTA,
      art: 40,
      tp_resultado: st.avaliacao.resultado,
      nota_final: st.avaliacao.nota_final,
      ...ficha,
    },
  );
  return { st, espelho: montarEspelho(entrada) };
}

describe("modeloDoEspelho", () => {
  it("só o inapto por requisito é eliminado; apto e inapto por nota têm pontos", () => {
    expect(modeloDoEspelho("INAPTO_REQUISITO")).toBe("ELIMINADO");
    expect(modeloDoEspelho("APTO")).toBe("COM_PONTOS");
    expect(modeloDoEspelho("INAPTO_NOTA")).toBe("COM_PONTOS");
  });
});

describe("espelho do eliminado", () => {
  const { st, espelho } = espelhoDe(ELIMINADO);

  it("a ficha é inapta por requisito e o modelo é sem pontos", () => {
    expect(st.avaliacao.resultado).toBe("INAPTO_REQUISITO");
    expect(espelho.modelo).toBe("ELIMINADO");
    expect(espelho.criterios).toEqual([]);
  });

  it("notas: sem a nota declarada; a consolidada não se aplica", () => {
    expect(espelho.notas).toEqual([
      {
        rotulo: "Nota consolidada (após a análise documental)",
        valor: TEXTOS_PADRAO_DO_ESPELHO.nao_se_aplica,
      },
    ]);
  });

  it("justificativa: o outro motivo descrito como o avaliador escreveu (sem o item do edital), sem observações internas", () => {
    expect(espelho.justificativas).toHaveLength(1);
    expect(espelho.justificativas[0]).toMatch(
      /CNH enviada cortada, sem a data de validade visível\.?$/,
    );
    expect(espelho.justificativas[0]).not.toMatch(/— item/);
    expect(espelho.justificativas.join(" ")).not.toMatch(/RG com foto/);
  });

  it("a página não mostra pontos por critério nem pontuação informativa", () => {
    const html = paginaDoEspelho(espelho);
    expect(html).toContain('data-modelo="ELIMINADO"');
    expect(html).not.toContain("Pontuação por critério");
    expect(html).not.toMatch(/informativ/i);
    expect(html).toContain(TEXTOS_PADRAO_DO_ESPELHO.nao_se_aplica);
    expect(html).not.toMatch(/autodeclarada/i);
    // Sem o cabeçalho/rodapé do navegador (endereço do sistema, data).
    expect(html).toContain("@page { size: A4; margin: 0; }");
    expect(html).toContain(TEXTOS_PADRAO_DO_ESPELHO.rodape);
  });
});

describe("espelho com pontos", () => {
  const { st, espelho } = espelhoDe(COM_PONTOS);

  it("a ficha é apta e o modelo é com pontos", () => {
    expect(st.avaliacao.resultado).toBe("APTO");
    expect(espelho.modelo).toBe("COM_PONTOS");
    expect(espelho.notas[1].valor).toBe(
      st.avaliacao.nota_final.toLocaleString("pt-BR", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    );
  });

  it("uma linha por critério que pontua, com declarada, após análise e teto", () => {
    const rotulos = espelho.criterios.map((c) => c.rotulo);
    expect(rotulos).toContain("Cursos de Aperfeiçoamento");
    expect(rotulos).toContain("Experiência Profissional");
    const cursos = espelho.criterios.find(
      (c) => c.rotulo === "Cursos de Aperfeiçoamento",
    );
    expect(cursos.apurada).toBe("1,0");
    expect(cursos.declarada).not.toBe("");
    expect(cursos.teto).toMatch(/^\d/);
    expect(cursos.justificativas).toEqual([
      // O Outro motivo vai como o avaliador escreveu, sem o item do edital (#466).
      "Certificado de 40 h sem assinatura da instituição.",
    ]);
  });

  it("observações: a do avaliador no item e a geral, sem repetir a do critério", () => {
    expect(espelho.justificativas).toContain(
      "Enviou os certificados num único PDF.",
    );
    expect(espelho.justificativas).toContain(
      "Candidato(a) atendeu a todos os requisitos.",
    );
    expect(espelho.justificativas.join(" ")).not.toMatch(/sem assinatura/);
  });

  it("a página tem o quadro de critérios e nada interno", () => {
    const html = paginaDoEspelho(espelho);
    expect(html).toContain("Pontuação por critério");
    expect(html).toContain("Após análise");
    expect(html).not.toMatch(/CPF|avaliador\(a\)|questionário bruto/);
  });
});

describe("dados do registro", () => {
  it("sem regime nem carga horária, a linha Descrição sai", () => {
    const { espelho } = espelhoDe(COM_PONTOS);
    expect(espelho.dados.map((l) => l.rotulo)).not.toContain("Descrição");
    expect(paginaDoEspelho(espelho)).not.toContain("Descrição");
    expect(espelho.dados).toContainEqual({
      rotulo: "Código do candidato",
      valor: "7001",
    });
    expect(espelho.dados).toContainEqual({
      rotulo: "Vaga",
      valor: `182513 - ${MOTORISTA}`,
    });
    expect(espelho.dados).toContainEqual({
      rotulo: "Modalidade de concorrência",
      valor: "Ampla concorrência",
    });
    expect(espelho.dados).toContainEqual({
      rotulo: "Etapa",
      valor: "Análise Curricular",
    });
  });

  it("com regime e carga horária, a linha Descrição aparece", () => {
    const { espelho } = espelhoDe(COM_PONTOS, {
      regime: "CLT",
      carga_horaria: 40,
    });
    expect(espelho.dados).toContainEqual({
      rotulo: "Descrição",
      valor: "CLT / 40 horas semanais",
    });
  });

  it("escapa o HTML dos textos", () => {
    const { espelho } = espelhoDe(COM_PONTOS, { nome: "<b>Maria</b>" });
    const html = paginaDoEspelho(espelho);
    expect(html).toContain("&lt;b&gt;Maria&lt;/b&gt;");
    expect(html).not.toContain("<b>Maria</b>");
  });
});

describe("espelho do inapto pela nota mínima", () => {
  it("tem pontos e a justificativa diz a nota mínima", () => {
    const st = fichaConcluida(COM_PONTOS, { nota_minima: 50 });
    expect(st.avaliacao.resultado).toBe("INAPTO_NOTA");
    const espelho = montarEspelho(
      entradaDoEspelho(
        { ...st, dados: { edital: { rotulo: "114/2026", area: "projetos" } } },
        {
          nome: "Maria Exemplo",
          codigo: "7001",
          tp_resultado: "INAPTO_NOTA",
          nota_final: st.avaliacao.nota_final,
        },
      ),
    );
    expect(espelho.modelo).toBe("COM_PONTOS");
    expect(espelho.criterios.length).toBeGreaterThan(0);
    expect(espelho.justificativas[0]).toMatch(
      /^Nota consolidada 36,0 abaixo da nota mínima de 50,00 pontos/,
    );
    expect(espelho.dados).toContainEqual({
      rotulo: "Situação",
      valor: "Não classificado(a) — nota abaixo da mínima",
    });
  });
});
