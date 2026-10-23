import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  gerarXlsxDaLista,
  instantaneoDaLista,
  linhasDaPlanilha,
  nomeDoArquivo,
} from "../../src/lib/classificacao/exportacao.ts";
import {
  documentoOficial,
  htmlParaSei,
} from "../../src/lib/classificacao/documento-sei.ts";
import { gerarDocxOficial } from "../../src/lib/classificacao/documento-docx.ts";
import { classificar } from "../../src/lib/classificacao/motor.ts";

/*
  O retrato da lista (o que vai para o banco) e a exportação no padrão das
  publicações: só nome, cabeçalho da vaga, "Não houve candidatos aptos.",
  rodapé configurável; DOCX, XLSX e a página de impressão (PDF).
*/
const SEED = readFileSync(
  "supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql",
  "utf8",
);
const inicio = SEED.indexOf("$regra100$") + 10;
const REGRA_100 = JSON.parse(
  SEED.slice(inicio, SEED.indexOf("$regra100$", inicio)),
);

const c = (id, nome, nota, campos = {}) => ({
  analise_id: `00000000-0000-4000-8000-00000000000${id}`,
  codigo: `98765${id}`,
  nome,
  vaga: "178529",
  cargo: "Analista Técnico de Saúde Indígena",
  modalidade: "Ampla concorrência",
  status: "Aprovado",
  nota_documental: nota,
  data_nascimento: "1970-01-01",
  quadro: "q",
  ...campos,
});
const QUADRO = [
  {
    id: "q",
    ordem: 1,
    cargo: "Analista Técnico de Saúde Indígena",
    lotacao: "CASAI Brasília",
    modalidades: { "Ampla Concorrência": 2 },
    vagas_imediatas: 2,
    cadastro_reserva: true,
  },
  {
    id: "q2",
    ordem: 2,
    cargo: "Nutricionista",
    lotacao: "CASAI Brasília",
    modalidades: {},
    vagas_imediatas: 0,
    cadastro_reserva: true,
  },
];
const resultado = classificar({
  tipo: "PRELIMINAR",
  regra: REGRA_100,
  candidatos: [
    c(1, "Ana <img src=x onerror=alert(1)>", "15,5"),
    c(2, "Bruno Indígena", "13", {
      modalidade: "Indígenas",
      pontuacao_etnica: 8,
    }),
    c(3, "Carla Reprovada", "9", { status: "Reprovado" }),
  ],
  quadro: QUADRO,
  dataCorte: "2026-09-20",
});
const retrato = instantaneoDaLista(resultado, {
  edital: { id: "e1", edital: "100/2026", unidade: "CASAI Nacional Brasília" },
  regra: REGRA_100,
  versao: 3,
});
const texto = (bytes) => new TextDecoder().decode(bytes);

describe("retrato da lista", () => {
  it("só nome: sem CPF, nascimento, código de inscrição ou contato", () => {
    const json = JSON.stringify(retrato);
    expect(json).not.toContain("1970-01-01");
    expect(json).not.toContain("987651");
    expect(json).not.toMatch(/cpf|email|telefone|nascimento/i);
    const linhas = retrato.vagas.flatMap((v) => [
      ...v.geral,
      ...Object.values(v.listas).flat(),
      ...v.eliminados,
    ]);
    expect(
      linhas.every((l) =>
        Object.keys(l).every((k) =>
          [
            "posicao",
            "analise_id",
            "nome",
            "nota",
            "modalidades",
            "situacao",
            "motivo",
            "detalhe",
          ].includes(k),
        ),
      ),
    ).toBe(true);
    expect(retrato).toMatchObject({
      schema: 1,
      tipo: "PRELIMINAR",
      regra_versao: 3,
      casas: 2,
    });
  });

  it("guarda listas, eliminados com motivo, avisos e totais", () => {
    const vaga = retrato.vagas[0];
    expect(vaga.geral.map((l) => [l.posicao, l.nome])).toEqual([
      [1, "Ana <img src=x onerror=alert(1)>"],
      [2, "Bruno Indígena"],
    ]);
    expect(vaga.listas.PI.map((l) => l.posicao)).toEqual([1]);
    expect(vaga.eliminados).toEqual([
      {
        analise_id: "00000000-0000-4000-8000-000000000003",
        nome: "Carla Reprovada",
        motivo: "NAO_HABILITADO",
        detalhe: "Situação na análise: Reprovado.",
      },
    ]);
    expect(retrato.totais).toMatchObject({ elegiveis: 2, eliminados: 1 });
  });
});

describe("documento no padrão das publicações (100/2026: modalidades no mesmo documento)", () => {
  const doc = documentoOficial(retrato, { regra: REGRA_100 });
  const rotulos = (t) => t.colunas.map((c) => c.rotulo);

  it("título, cabeçalho da vaga, geral com Modalidade e sublistas", () => {
    expect(doc.titulo).toEqual([
      "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR",
    ]);
    expect(doc.blocos.map((b) => b.cabecalho)).toEqual([
      "VAGA 178529 - Analista Técnico de Saúde Indígena - CASAI Brasília - 2 vagas (2 AC + CR)",
      "VAGA - Nutricionista - CASAI Brasília - Cadastro Reserva",
    ]);
    const [geral, pp, pi] = doc.blocos[0].tabelas;
    expect(geral.titulo).toBe("Classificação Geral");
    expect(rotulos(geral)).toEqual([
      "Classificação",
      "Nome",
      "Modalidade de Concorrência",
      "Nota Final",
      ...rotulos(geral).slice(4),
    ]);
    expect(geral.linhas.map((l) => l.slice(0, 4))).toEqual([
      ["1º", "Ana <img src=x onerror=alert(1)>", "AC", "15,50"],
      ["2º", "Bruno Indígena", "PI", "13,00"],
    ]);
    expect([pp.titulo, pp.linhas]).toEqual(["Pretos e Pardos", []]);
    expect(rotulos(pi).slice(0, 3)).toEqual([
      "Classificação",
      "Nome",
      "Nota Final",
    ]);
    expect(doc.preliminares[0].texto).toContain(
      "destinado à **Casa de Apoio à Saúde Indígena Nacional Brasília (CASAI Nacional Brasília)**",
    );
  });

  it("uma lista só (modalidade): sem a coluna Modalidade, texto das vagas reservadas", () => {
    const so = documentoOficial(retrato, { lista: "PI", regra: REGRA_100 });
    expect(so.blocos[0].tabelas).toHaveLength(1);
    expect(so.blocos[0].tabelas[0].titulo).toBe("");
    expect(so.preliminares[0].texto).toContain(
      "das Vagas Reservadas para Indígenas (PI)",
    );
    expect(so.nome).toBe(
      "Resultado Preliminar - Etapa de Análise Curricular - Indígenas",
    );
    expect(nomeDoArquivo(retrato, "PI")).toBe(
      "classificacao-preliminar-100-2026-pi",
    );
  });

  it("HTML do SEI e DOCX: nomes escapados, vazia = 'Não houve candidatos aptos.'", () => {
    const html = htmlParaSei(doc);
    expect(html).toContain("Ana &lt;img src=x onerror=alert(1)&gt;");
    expect(html).not.toContain("<img");
    expect(html).toContain("Não houve candidatos aptos.");
    const conteudo = texto(
      gerarDocxOficial(doc, { quando: new Date("2026-10-02T12:00:00") }),
    );
    expect([...conteudo.slice(0, 2)].join("")).toBe("PK");
    expect(conteudo).toContain("Ana &lt;img src=x onerror=alert(1)&gt;");
    expect(conteudo).not.toContain("<img");
    expect(conteudo).toContain("Não houve candidatos aptos.");
  });

  it("XLSX: duas planilhas (Classificação e Eliminados), números como número", () => {
    const { classificacao, eliminados } = linhasDaPlanilha(retrato);
    expect(classificacao[0]).toEqual([
      "Vaga",
      "Cargo",
      "Lista",
      "Classificação",
      "Nome",
      "Nota",
      "Modalidade",
      "Situação",
    ]);
    expect(classificacao[1]).toEqual([
      "178529",
      "Analista Técnico de Saúde Indígena",
      "Classificação Geral",
      1,
      "Ana <img src=x onerror=alert(1)>",
      15.5,
      "AC",
      "",
    ]);
    expect(eliminados[1][3]).toBe("Não habilitado na avaliação documental");
    const conteudo = texto(gerarXlsxDaLista(retrato));
    expect(conteudo).toContain('<sheet name="Eliminados"');
    expect(conteudo).toContain("<v>15.5</v>");
    expect(conteudo).not.toContain("<img");
  });
});

describe("colunas do documento: larguras ajustadas aos títulos (114/2026)", () => {
  const doc = documentoOficial(retrato, { regra: REGRA_100 });
  const [geral, , pi] = doc.blocos[0].tabelas;
  const colunas = (t) =>
    t.colunas
      .slice(0, 4)
      .map((c) => [c.rotulo, c.largura, c.alinhamento].join(" "));
  const soParciaisFora = (t) =>
    t.colunas.filter((c) => !/Formação|Cursos|Experiência/.test(c.rotulo));

  it("Classificação 12% e Nota Final 12% ao centro; Nome (60%) e Modalidade (16%) à esquerda", () => {
    const semParciais = documentoOficial(retrato, {
      regra: {
        ...REGRA_100,
        documental: { ...REGRA_100.documental, parciais: [] },
      },
    }).blocos[0].tabelas[0];
    expect(colunas(semParciais)).toEqual([
      "Classificação 12 centro",
      "Nome 60 esquerda",
      "Modalidade de Concorrência 16 esquerda",
      "Nota Final 12 centro",
    ]);
    expect(soParciaisFora(pi).map((c) => c.largura)).toEqual([12, 76, 12]);
    for (const t of [geral, pi])
      expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBe(100);
  });

  it("documento com as listas das cotas não diz 'das Vagas de Ampla Concorrência'", () => {
    expect(doc.preliminares[0].texto).not.toContain("Ampla Concorrência");
    expect(doc.preliminares[0].texto).toContain(
      "Avaliação Documental e de Títulos**",
    );
    const soGeral = documentoOficial(retrato, {
      lista: "geral",
      regra: REGRA_100,
    });
    expect(soGeral.preliminares[0].texto).toContain(
      "das Vagas de Ampla Concorrência",
    );
  });

  it("DOCX: título sem quebra, margens estreitas, mesma largura do quadro vazio", () => {
    const conteudo = texto(
      gerarDocxOficial(doc, { quando: new Date("2026-10-02T12:00:00") }),
    );
    expect(conteudo).toContain("<w:noWrap/>");
    expect(conteudo).toContain('<w:tblCellMar><w:left w:w="57" w:type="dxa"/>');
    const larguras = [...conteudo.matchAll(/<w:tblW w:w="(\d+)"/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.max(...larguras) - Math.min(...larguras)).toBeLessThanOrEqual(
      3,
    );
  });

  it("XLSX: larguras de coluna proporcionais", () => {
    const conteudo = texto(gerarXlsxDaLista(retrato));
    expect(conteudo).toContain(
      '<col min="5" max="5" width="40" customWidth="1"/>',
    );
  });
});

describe("aguardando análise no retrato e no XLSX", () => {
  const comPendente = classificar({
    tipo: "PRELIMINAR",
    regra: REGRA_100,
    candidatos: [
      c(1, "Ana Apta", "15,5"),
      c(4, "Davi Pendente", null, { status: "Pendente" }),
    ],
    quadro: QUADRO,
    dataCorte: "2026-09-20",
  });
  const r = instantaneoDaLista(comPendente, { regra: REGRA_100 });

  it("o retrato guarda quem aguarda (só nome e situação), fora dos eliminados", () => {
    expect(r.vagas[0].eliminados).toEqual([]);
    expect(r.vagas[0].aguardando).toEqual([
      {
        analise_id: "00000000-0000-4000-8000-000000000004",
        nome: "Davi Pendente",
        situacao: "Pendente",
      },
    ]);
    expect(r.totais).toMatchObject({ eliminados: 0, aguardando: 1 });
    expect(retrato.vagas[0].aguardando).toBeUndefined();
  });

  it("planilha 'Aguardando análise' só quando há alguém", () => {
    const { aguardando } = linhasDaPlanilha(r);
    expect(aguardando).toEqual([
      ["Vaga", "Cargo", "Nome", "Situação na análise"],
      [
        "178529",
        "Analista Técnico de Saúde Indígena",
        "Davi Pendente",
        "Pendente",
      ],
    ]);
    expect(texto(gerarXlsxDaLista(r))).toContain(
      '<sheet name="Aguardando análise"',
    );
    expect(texto(gerarXlsxDaLista(retrato))).not.toContain(
      "Aguardando análise",
    );
  });
});
