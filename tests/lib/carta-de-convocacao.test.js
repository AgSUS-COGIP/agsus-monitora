import { describe, expect, it } from "vitest";
import {
  ESPACO_EM_BRANCO,
  MODELO_PADRAO,
  assinaturaDaEmissao,
  camposDesconhecidos,
  camposParaRegistrar,
  camposUsados,
  chaveDoCampo,
  conteudoParaSalvar,
  dataLimitePadrao,
  emissaoInicial,
  hojeEmBrasilia,
  lerModelosDoBanco,
  mascararCpf,
  modelosParaEmitir,
  preencherCarta,
  rascunhoDoModelo,
  validarEmissao,
  validarModelo,
} from "../../src/lib/carta-de-convocacao.js";
import {
  gerarDocxDasCartas,
  gerarZipDasCartas,
  htmlParaSei,
  montarCartas,
  paginaDaPrevia,
  soACarta,
  textoParaSei,
} from "../../src/lib/carta-de-convocacao-documento.js";

/*
  A carta de convocação sem DOM. Os testes seguem as histórias de
  docs/historias-de-usuario/lista-de-aprovados.md ("Manter o modelo da carta",
  "Emitir a carta de convocação").
*/

const ANA = {
  candidato_id: "ana",
  nome: "Ana Ribeiro",
  cargo: "Enfermeiro",
  codigo_vaga: "VG-1",
  unidade: "DSEI Manaus",
  edital: "03/2025",
  edital_id: "10",
  classificacao: 2,
  modalidade: '"Pessoa negra"',
  status: "",
};
const BRUNO = {
  ...ANA,
  candidato_id: "bruno",
  nome: "Bruno Lima",
  classificacao: 3,
};
const EMISSAO = {
  dataLimite: "2026-10-12",
  local: "Sede do DSEI Manaus",
  documentos: "RG\n- CPF\n3) Comprovante de residência",
  contato: "rh@agsus.org.br",
};
const VIGENTE = {
  titulo: "CARTA DE CONVOCAÇÃO",
  texto: [
    "Prezado(a) **{NOME}**,",
    "",
    "Convocamos para o cargo de {CARGO} (vaga {VAGA}, {LOTAÇÃO/UNIDADE}), Edital {EDITAL}, {POSIÇÃO}ª posição, {Modalidade}.",
    "Apresente-se até {DATA_LIMITE} em {LOCAL}, com:",
    "{DOCUMENTOS}",
    "- Leve também {DOCUMENTOS}.",
    "Dúvidas: {CONTATO}.",
  ].join("\n"),
};
const MODELO = { id: "m1", nome: "Padrão", versao: 2, vigente: VIGENTE };

describe("campos do modelo", () => {
  it("aceita acento, caixa e LOTAÇÃO/UNIDADE", () => {
    expect(chaveDoCampo("Lotação/Unidade")).toBe("LOTACAO");
    expect(chaveDoCampo("POSIÇÃO")).toBe("POSICAO");
    expect(chaveDoCampo("data limite")).toBe("DATA_LIMITE");
    expect(camposUsados(VIGENTE.titulo, VIGENTE.texto)).toEqual([
      "NOME",
      "CARGO",
      "VAGA",
      "LOTACAO",
      "EDITAL",
      "POSICAO",
      "MODALIDADE",
      "DATA_LIMITE",
      "LOCAL",
      "DOCUMENTOS",
      "CONTATO",
    ]);
  });

  it("aponta o campo que a carta não conhece", () => {
    expect(camposDesconhecidos("Olá {NOME}, {MATRICULA} e {RG}")).toEqual([
      "MATRICULA",
      "RG",
    ]);
  });

  it("CPF só mascarado, e só com 11 dígitos", () => {
    expect(mascararCpf("123.456.789-01")).toBe("***.456.789-**");
    expect(mascararCpf("12345678901")).toBe("***.456.789-**");
    expect(mascararCpf("123")).toBe("");
    expect(mascararCpf(null)).toBe("");
  });

  it("data limite padrão em dias corridos, e hoje em Brasília", () => {
    expect(dataLimitePadrao("2026-10-28", 5)).toBe("2026-11-02");
    expect(dataLimitePadrao("2026-10-05", 0)).toBe("2026-10-05");
    expect(dataLimitePadrao("x", 5)).toBe("");
    // 02:00 UTC de 6/10 ainda é 5/10 em Brasília.
    expect(hojeEmBrasilia(new Date("2026-10-06T02:00:00Z"))).toBe("2026-10-05");
  });
});

describe("preencher a carta (história: Emitir a carta de convocação)", () => {
  it("troca os campos do candidato e da emissão; {DOCUMENTOS} sozinho vira itens", () => {
    const carta = preencherCarta(VIGENTE, ANA, {
      ...EMISSAO,
      data: "2026-10-05",
    });
    expect(carta.titulo).toBe("CARTA DE CONVOCAÇÃO");
    expect(carta.blocos[0]).toEqual({
      tipo: "paragrafo",
      texto: "Prezado(a) **Ana Ribeiro**,",
    });
    expect(carta.blocos[1].texto).toBe(
      "Convocamos para o cargo de Enfermeiro (vaga VG-1, DSEI Manaus), Edital 03/2025, 2ª posição, Pessoa negra.",
    );
    expect(carta.blocos[2].texto).toBe(
      "Apresente-se até 12/10/2026 em Sede do DSEI Manaus, com:",
    );
    expect(carta.blocos.slice(3, 6)).toEqual([
      { tipo: "item", texto: "RG" },
      { tipo: "item", texto: "CPF" },
      { tipo: "item", texto: "Comprovante de residência" },
    ]);
    // No meio do texto, os documentos vão separados por ponto e vírgula.
    expect(carta.blocos[6]).toEqual({
      tipo: "item",
      texto: "Leve também RG; CPF; Comprovante de residência.",
    });
    expect(carta.faltando).toEqual([]);
  });

  it("campo sem valor sai em branco e é anotado; desconhecido fica como está", () => {
    const carta = preencherCarta(
      { titulo: "Carta", texto: "CPF {CPF}; {MATRICULA}" },
      ANA,
      {},
    );
    expect(carta.blocos[0].texto).toBe(`CPF ${ESPACO_EM_BRANCO}; {MATRICULA}`);
    expect(carta.faltando).toEqual(["CPF"]);
    expect(
      preencherCarta(
        { titulo: "C", texto: "CPF {CPF}" },
        { ...ANA, cpf: "12345678901" },
        {},
      ).blocos[0].texto,
    ).toBe("CPF ***.456.789-**");
  });
});

describe("validar o modelo (história: Manter o modelo da carta)", () => {
  it("o padrão é válido e avisa só do que importa", () => {
    expect(validarModelo(rascunhoDoModelo(null))).toEqual({
      erros: [],
      avisos: [],
    });
  });

  it("recusa nome curto, campo desconhecido e chave sem par", () => {
    const { erros } = validarModelo({
      nome: "X",
      titulo: "Carta",
      texto: "Olá {NOME}, {RG} e {CARGO",
    });
    expect(erros).toContain("O nome do modelo deve ter de 3 a 120 caracteres.");
    expect(erros).toContain("Campo desconhecido: {RG}.");
    expect(erros).toContain("Há uma chave { ou } sem par no texto.");
  });

  it("a partir da 2ª versão, o motivo é obrigatório", () => {
    const rascunho = rascunhoDoModelo(null);
    expect(validarModelo(rascunho, { versaoAtual: 1 }).erros).toContain(
      "Informe o motivo da alteração (3 a 500 caracteres).",
    );
    expect(
      validarModelo(
        { ...rascunho, motivo: "Prazo do edital" },
        { versaoAtual: 1 },
      ).erros,
    ).toEqual([]);
  });

  it("{CPF} no modelo avisa que a lista não guarda CPF", () => {
    expect(
      validarModelo({ ...rascunhoDoModelo(null), texto: "CPF {CPF}" })
        .avisos[0],
    ).toMatch(/não guarda CPF/);
  });

  it("prazo de 0 a 90 dias", () => {
    expect(
      validarModelo({ ...rascunhoDoModelo(null), prazoDias: "91" }).erros,
    ).toContain("O prazo vai de 0 a 90 dias.");
    expect(
      validarModelo({ ...rascunhoDoModelo(null), prazoDias: "" }).erros,
    ).toEqual([]);
  });

  it("o conteúdo salvo: documentos um por linha, prazo número ou nulo", () => {
    expect(
      conteudoParaSalvar({
        ...rascunhoDoModelo(null),
        documentos: "- RG\n\n• CPF ",
        prazoDias: "",
      }),
    ).toMatchObject({ documentos: "RG\nCPF", prazo_dias: null });
  });
});

describe("validar a emissão", () => {
  it("exige data limite futura e os campos da emissão que o modelo usa", () => {
    const { erros } = validarEmissao({
      modelo: VIGENTE,
      candidatos: [ANA],
      emissao: { dataLimite: "2026-10-01" },
      hoje: "2026-10-05",
    });
    expect(erros).toEqual([
      "A data limite já passou.",
      "Informe local de apresentação.",
      "Informe documentos exigidos.",
      "Informe contato para dúvidas.",
    ]);
  });

  it("avisa quem fica com campo em branco e quem já tem outro status", () => {
    const { erros, avisos } = validarEmissao({
      modelo: { titulo: "C", texto: "{NOME} {CPF}" },
      candidatos: [ANA, { ...BRUNO, status: "Contratado" }],
      emissao: EMISSAO,
      hoje: "2026-10-05",
    });
    expect(erros).toEqual([]);
    expect(avisos).toEqual([
      "CPF mascarado (***.456.789-**) em branco para 2 candidatos.",
      "Bruno Lima já está com outro status (Contratado).",
    ]);
  });

  it("sem candidato ou sem modelo não emite", () => {
    expect(validarEmissao({ modelo: null, candidatos: [] }).erros).toEqual([
      "Escolha o modelo da carta.",
      "Escolha ao menos um candidato.",
    ]);
  });
});

describe("modelos do banco", () => {
  const dados = {
    pode_editar: true,
    modelos: [
      {
        modelo_id: "a",
        nome: "Da área",
        ativo: true,
        versao: 2,
        vigente: { titulo: "T", texto: "X", prazo_dias: 5 },
        versoes: [{ versao: 2, motivo: "m" }],
      },
      {
        modelo_id: "b",
        nome: "Do edital 10",
        edital_id: "10",
        ativo: true,
        versao: 1,
        vigente: { titulo: "T", texto: "Y" },
      },
      {
        modelo_id: "c",
        nome: "Do edital 20",
        edital_id: "20",
        ativo: true,
        versao: 1,
        vigente: {},
      },
      { modelo_id: "d", nome: "Inativo", ativo: false, versao: 1, vigente: {} },
    ],
  };

  it("normaliza a resposta", () => {
    const { podeEditar, modelos } = lerModelosDoBanco(dados);
    expect(podeEditar).toBe(true);
    expect(modelos[0]).toMatchObject({
      id: "a",
      versao: 2,
      vigente: { prazoDias: "5" },
      versoes: [{ versao: 2, motivo: "m" }],
    });
    expect(modelos[3].ativo).toBe(false);
  });

  it("para emitir: ativos, os do edital (de todos os candidatos) primeiro", () => {
    const { modelos } = lerModelosDoBanco(dados);
    expect(modelosParaEmitir(modelos, [ANA, BRUNO]).map((m) => m.id)).toEqual([
      "b",
      "a",
    ]);
    expect(
      modelosParaEmitir(modelos, [ANA, { ...BRUNO, edital_id: "20" }]).map(
        (m) => m.id,
      ),
    ).toEqual(["a"]);
  });

  it("a emissão começa com os valores da versão vigente e a data pelo prazo", () => {
    const { modelos } = lerModelosDoBanco(dados);
    expect(emissaoInicial(modelos[0], "2026-10-05").dataLimite).toBe(
      "2026-10-10",
    );
    expect(emissaoInicial(modelos[1], "2026-10-05").dataLimite).toBe("");
  });

  it("a mesma carta registra uma vez só (DOCX e PDF da mesma emissão)", () => {
    const base = {
      modeloId: "a",
      versao: 2,
      candidatoIds: ["ana"],
      agrupamento: "UNICO",
      emissao: EMISSAO,
    };
    expect(assinaturaDaEmissao(base)).toBe(assinaturaDaEmissao({ ...base }));
    expect(assinaturaDaEmissao(base)).not.toBe(
      assinaturaDaEmissao({
        ...base,
        emissao: { ...EMISSAO, dataLimite: "2026-10-13" },
      }),
    );
    expect(camposParaRegistrar(EMISSAO)).toEqual({
      data_limite: "2026-10-12",
      local: "Sede do DSEI Manaus",
      documentos: "RG\nCPF\nComprovante de residência",
      contato: "rh@agsus.org.br",
    });
  });
});

describe("o documento (SEI, PDF, DOCX)", () => {
  const doc = montarCartas({
    modelo: MODELO,
    candidatos: [ANA, BRUNO],
    emissao: EMISSAO,
    hoje: "2026-10-05",
  });

  it("uma carta por candidato, com local e data", () => {
    expect(doc.cartas.map((c) => c.nome)).toEqual([
      "Ana Ribeiro",
      "Bruno Lima",
    ]);
    expect(doc.nome).toBe("Carta de convocação - 2 candidatos");
    expect(doc.localData).toBe("Brasília, na data da assinatura digital.");
    expect(doc.localDataPorExtenso).toBe("Brasília, 5 de outubro de 2026.");
    expect(soACarta(doc, 1).nome).toBe("Carta de convocação - Bruno Lima");
  });

  it("HTML para o SEI com as classes do SEI, negrito e quebra de página entre as cartas", () => {
    const html = htmlParaSei(doc);
    expect(html).toContain(
      '<p class="Texto_Centralizado_Maiusculas">CARTA DE CONVOCAÇÃO</p>',
    );
    expect(html).toContain(
      '<p class="Texto_Justificado_Recuo_Primeira_Linha">Prezado(a) <strong>Ana Ribeiro</strong>,</p>',
    );
    expect(html).toContain('<p class="Texto_Justificado">&bull; RG</p>');
    expect(html.match(/page-break-after: always/g)).toHaveLength(1);
    expect(
      htmlParaSei({
        ...doc,
        cartas: [{ ...doc.cartas[0], titulo: "<script>x</script>" }],
      }),
    ).not.toContain("<script>");
  });

  it("texto puro sem as marcas de negrito", () => {
    const t = textoParaSei(doc);
    expect(t).toContain("Prezado(a) Ana Ribeiro,");
    expect(t).toContain("• RG");
    expect(t).not.toContain("**");
  });

  it("prévia: timbrado, uma carta por página, sem script", () => {
    const pagina = paginaDaPrevia(doc, {
      cabecalho: "AGÊNCIA X\nRua Y",
      logo: "/assets/agsus-logo.webp",
    });
    const lida = new DOMParser().parseFromString(pagina, "text/html");
    expect(lida.querySelectorAll("section.carta")).toHaveLength(2);
    expect(lida.querySelectorAll("section.quebra-de-pagina")).toHaveLength(1);
    expect(
      [...lida.querySelectorAll(".timbrado p")].map((p) => p.textContent),
    ).toEqual(["AGÊNCIA X", "Rua Y"]);
    expect(lida.querySelector("script")).toBeNull();
  });

  it("DOCX: um arquivo com as duas cartas; ZIP: um .docx por candidato", () => {
    const leitor = new TextDecoder();
    const docx = leitor.decode(
      gerarDocxDasCartas(doc, { quando: new Date("2026-10-05T12:00:00Z") }),
    );
    expect(docx).toContain("word/document.xml");
    expect(docx).toContain('<w:br w:type="page"/>');
    expect(docx).toContain("Ana Ribeiro");
    expect(docx).toContain("Bruno Lima");
    expect(docx).toContain('<w:ind w:firstLine="1418"/>');
    const zip = leitor.decode(
      gerarZipDasCartas(doc, { quando: new Date("2026-10-05T12:00:00Z") }),
    );
    expect(zip).toContain("01 - Ana Ribeiro.docx");
    expect(zip).toContain("02 - Bruno Lima.docx");
  });

  it("o modelo padrão preenche sem campo desconhecido", () => {
    expect(
      camposDesconhecidos(MODELO_PADRAO.titulo, MODELO_PADRAO.texto),
    ).toEqual([]);
  });
});
