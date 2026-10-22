import { describe, expect, it } from "vitest";
import {
  espelhoDeExemplo,
  notasDoEspelho,
  paginaDoEspelho,
} from "../../src/lib/avaliacao-documental/espelho-de-nota.ts";
import {
  carregarBibliotecasDoPdf,
  pdfDoEspelho,
} from "../../src/lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  CAMPOS_DO_MODELO,
  comOCandidato,
  diferencasDoPadrao,
  lerModeloDoEdital,
  TEXTOS_PADRAO_DO_ESPELHO,
  textosDoModelo,
  trechosDaSaudacao,
  validarModeloDoEspelho,
} from "../../src/lib/avaliacao-documental/modelo-do-espelho.ts";

/*
  O modelo do espelho de nota por edital: o padrão (os textos de hoje), a
  validação (as mesmas regras do banco), o que vai ao banco (só as
  diferenças) e a folha (HTML e PDF) com um modelo customizado — só os
  textos mudam; o conteúdo continua o da montagem.
*/

const CUSTOM = {
  ...TEXTOS_PADRAO_DO_ESPELHO,
  titulo: "Espelho da Análise Curricular — 114/2026",
  subtitulo: "",
  saudacao: "Olá, {candidato}!",
  abertura: "{candidato}, segue o resultado.",
  secao_dados: "Seus dados",
  secao_notas: "Suas notas",
  secao_criterios: "Critérios",
  secao_justificativas: "Observações",
  rotulo_consolidada: "Nota final",
  nao_se_aplica: "Eliminado(a): sem nota",
  sem_observacao: "Nada a observar.",
  rodape: "",
  mostrar_autodeclarada: false,
};

describe("padrão e validação", () => {
  it("o padrão são os textos de hoje e é válido", () => {
    expect(TEXTOS_PADRAO_DO_ESPELHO.titulo).toBe(
      "Espelho de Pontuação da Análise Curricular",
    );
    expect(TEXTOS_PADRAO_DO_ESPELHO.saudacao).toBe("Prezado(a) {candidato},");
    expect(TEXTOS_PADRAO_DO_ESPELHO.mostrar_autodeclarada).toBe(true);
    expect(validarModeloDoEspelho({ ...TEXTOS_PADRAO_DO_ESPELHO })).toEqual({});
    expect(validarModeloDoEspelho(CUSTOM)).toEqual({});
    // Um campo para cada texto do padrão.
    expect(CAMPOS_DO_MODELO.map((c) => c.chave).sort()).toEqual(
      Object.keys(TEXTOS_PADRAO_DO_ESPELHO)
        .filter((k) => k !== "mostrar_autodeclarada")
        .sort(),
    );
  });

  it("recusa o que o banco recusa", () => {
    expect(validarModeloDoEspelho({ titulo: "" }).titulo).toMatch(/vazio/);
    expect(validarModeloDoEspelho({ titulo: "x".repeat(201) }).titulo).toMatch(
      /200/,
    );
    expect(
      validarModeloDoEspelho({ saudacao: "Prezado(a)," }).saudacao,
    ).toMatch(/\{candidato\}/);
    expect(validarModeloDoEspelho({ rodape: "Até {data}" }).rodape).toMatch(
      /marcador/,
    );
    expect(
      validarModeloDoEspelho({ titulo: "Espelho de {candidato}" }).titulo,
    ).toMatch(/saudação e na abertura/);
    expect(validarModeloDoEspelho({ campo: "x" })._).toMatch(/desconhecido/);
    expect(
      validarModeloDoEspelho({ mostrar_autodeclarada: "sim" })
        .mostrar_autodeclarada,
    ).toBeTruthy();
    // Vazio só onde a linha some da folha.
    expect(
      validarModeloDoEspelho({ subtitulo: "", abertura: " ", rodape: "" }),
    ).toEqual({});
  });
});

describe("o que vai ao banco e o que volta", () => {
  it("só as diferenças do padrão; o padrão vira {}", () => {
    expect(diferencasDoPadrao({ ...TEXTOS_PADRAO_DO_ESPELHO })).toEqual({});
    expect(
      diferencasDoPadrao({
        ...TEXTOS_PADRAO_DO_ESPELHO,
        titulo: "  Outro título  ",
        mostrar_autodeclarada: false,
      }),
    ).toEqual({ titulo: "Outro título", mostrar_autodeclarada: false });
  });

  it("textosDoModelo: padrão por baixo; campo inválido volta ao padrão", () => {
    expect(textosDoModelo(null)).toEqual(TEXTOS_PADRAO_DO_ESPELHO);
    const t = textosDoModelo({
      titulo: "Novo",
      saudacao: "sem marcador",
      desconhecido: "x",
      mostrar_autodeclarada: false,
    });
    expect(t.titulo).toBe("Novo");
    expect(t.saudacao).toBe(TEXTOS_PADRAO_DO_ESPELHO.saudacao);
    expect(t.mostrar_autodeclarada).toBe(false);
    expect(t).not.toHaveProperty("desconhecido");
  });

  it("lerModeloDoEdital lê a resposta da RPC", () => {
    const m = lerModeloDoEdital({
      versao: 3,
      textos: { titulo: "T" },
      atualizado_em: "2026-10-19T10:00:00Z",
      atualizado_por: "Gestão Pessoal",
      pode_editar: true,
    });
    expect(m.versao).toBe(3);
    expect(m.textos.titulo).toBe("T");
    expect(m.salvos).toEqual({ titulo: "T" });
    expect(m.podeEditar).toBe(true);
    expect(lerModeloDoEdital(null).versao).toBe(0);
  });
});

describe("saudação e abertura", () => {
  it("o nome no lugar de {candidato}, em negrito na saudação", () => {
    expect(trechosDaSaudacao("Prezado(a) {candidato},", "Ana")).toEqual([
      { texto: "Prezado(a) ", negrito: false },
      { texto: "Ana", negrito: true },
      { texto: ",", negrito: false },
    ]);
    expect(comOCandidato("{candidato}, veja.", "Ana")).toBe("Ana, veja.");
  });
});

describe("a folha com o modelo do edital", () => {
  it("padrão: a página igual à de antes do modelo", () => {
    const html = paginaDoEspelho(espelhoDeExemplo("COM_PONTOS"));
    expect(html).toContain(
      "<h1>Espelho de Pontuação da Análise Curricular</h1>",
    );
    expect(html).toContain(
      '<p class="subtitulo">Documento simplificado para atendimento ao candidato</p>',
    );
    expect(html).toContain(
      "<p>Prezado(a) <strong>Maria Exemplo da Silva</strong>,</p>",
    );
    expect(html).toContain("<h2>Dados do registro</h2>");
    expect(html).toContain("Nota autodeclarada (antes da análise)");
    expect(html).toContain('<p class="rodape">');
  });

  it("customizado: títulos, saudação, quadros e rótulos; sem subtítulo, rodapé e autodeclarada", () => {
    const espelho = espelhoDeExemplo("COM_PONTOS", CUSTOM);
    const html = paginaDoEspelho(espelho);
    expect(html).toContain(`<h1>${CUSTOM.titulo}</h1>`);
    expect(html).not.toContain('class="subtitulo"');
    expect(html).toContain(
      "<p>Olá, <strong>Maria Exemplo da Silva</strong>!</p>",
    );
    expect(html).toContain("<p>Maria Exemplo da Silva, segue o resultado.</p>");
    for (const s of ["Seus dados", "Suas notas", "Critérios", "Observações"])
      expect(html).toContain(`<h2>${s}</h2>`);
    expect(html).toContain("Nota final");
    expect(html).not.toContain("autodeclarada");
    expect(html).not.toContain('class="rodape"');
    // O conteúdo não muda: os mesmos critérios e justificativas.
    expect(espelho.criterios).toEqual(espelhoDeExemplo("COM_PONTOS").criterios);
  });

  it("eliminado: o 'Não se aplica' e o 'sem observação' do modelo", () => {
    expect(notasDoEspelho("ELIMINADO", "30,0", "0,0", CUSTOM)).toEqual([
      { rotulo: "Nota final", valor: "Eliminado(a): sem nota" },
    ]);
    const html = paginaDoEspelho({
      ...espelhoDeExemplo("ELIMINADO", CUSTOM),
      justificativas: [],
    });
    expect(html).toContain("Eliminado(a): sem nota");
    expect(html).toContain("Nada a observar.");
  });

  it("escapa o HTML dos textos do modelo", () => {
    const html = paginaDoEspelho(
      espelhoDeExemplo("COM_PONTOS", { ...CUSTOM, titulo: "<b>x</b>" }),
    );
    expect(html).toContain("&lt;b&gt;x&lt;/b&gt;");
  });

  it("o PDF usa os mesmos textos do modelo", async () => {
    const libs = await carregarBibliotecasDoPdf();
    const bytes = pdfDoEspelho(espelhoDeExemplo("COM_PONTOS", CUSTOM), libs, {
      comprimir: false,
    });
    const bruto = new TextDecoder("latin1").decode(bytes);
    const textos = [...bruto.matchAll(/\(((?:\\.|[^\\)])*)\)\s*Tj/g)]
      .map((m) => m[1])
      .join("\n");
    expect(textos).toContain("SEUS DADOS");
    expect(textos).toContain("OBSERVA");
    expect(textos).toContain("Ol");
    expect(textos).toContain("Maria Exemplo da Silva");
    expect(textos).not.toContain("autodeclarada");
    expect(textos).not.toContain("Documento simplificado");
    expect(textos).not.toContain("Observação: este espelho");
  });
});
