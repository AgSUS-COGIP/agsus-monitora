import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  documentoDaLista,
  gerarDocxDaLista,
  gerarXlsxDaLista,
  instantaneoDaLista,
  linhasDaPlanilha,
  montarPaginaDaLista,
  nomeDoArquivo,
} from "../../src/lib/classificacao/exportacao.js";
import { classificar } from "../../src/lib/classificacao/motor.js";

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

describe("documento no padrão das publicações", () => {
  const doc = documentoDaLista(retrato, {
    registro: {
      gerada_em: "2026-10-02T13:00:00Z",
      por: "Gestora",
      versao_regra: 3,
      hash: "a".repeat(64),
    },
  });

  it("título, edital, cabeçalho da vaga, geral com Modalidade e sublistas", () => {
    expect(doc.titulo).toBe(
      "RESULTADO PRELIMINAR - AVALIAÇÃO DOCUMENTAL E DE TÍTULOS",
    );
    expect(doc.subtitulo).toBe("EDITAL Nº 100/2026 - CASAI Nacional Brasília");
    expect(doc.blocos.map((b) => b.cabecalho)).toEqual([
      "VAGA 178529 - Analista Técnico de Saúde Indígena - CASAI Brasília - 2 vagas (2 AC + CR)",
      "VAGA - Nutricionista - CASAI Brasília - Cadastro Reserva",
    ]);
    const [geral, pp, pi] = doc.blocos[0].tabelas;
    expect(geral.colunas).toEqual([
      "Classificação",
      "Nome",
      "Nota",
      "Modalidade",
    ]);
    expect(geral.linhas).toEqual([
      ["1º", "Ana <img src=x onerror=alert(1)>", "15,50", "AC"],
      ["2º", "Bruno Indígena", "13,00", "Indígenas"],
    ]);
    expect([pp.titulo, pp.linhas]).toEqual(["Pretos e Pardos", []]);
    expect(pi.colunas).toEqual(["Classificação", "Nome", "Nota"]);
    expect(doc.rodape).toBe(
      "Os critérios de desempate foram considerados conforme item 10.4 do edital.",
    );
    expect(doc.controle).toContain("regra versão 3 · SHA-256 aaaaaaaaaaaaaaaa");
  });

  it("uma lista só (modalidade) sai sem a coluna Modalidade e com o nome no título", () => {
    const so = documentoDaLista(retrato, { lista: "PI" });
    expect(so.titulo).toBe(
      "RESULTADO PRELIMINAR - AVALIAÇÃO DOCUMENTAL E DE TÍTULOS - INDÍGENAS",
    );
    expect(so.blocos[0].tabelas).toHaveLength(1);
    expect(so.blocos[0].tabelas[0].colunas).toHaveLength(3);
    expect(nomeDoArquivo(retrato, "PI")).toBe(
      "classificacao-preliminar-100-2026-pi",
    );
  });

  it("DOCX: zip com document.xml, nomes escapados, vazia = 'Não houve candidatos aptos.'", () => {
    const bytes = gerarDocxDaLista(doc, new Date("2026-10-02T12:00:00"));
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const conteudo = texto(bytes);
    expect(conteudo).toContain("word/document.xml");
    expect(conteudo).toContain("Ana &lt;img src=x onerror=alert(1)&gt;");
    expect(conteudo).not.toContain("<img");
    expect(conteudo).toContain("Não houve candidatos aptos.");
    expect(conteudo).toContain(
      "VAGA 178529 - Analista Técnico de Saúde Indígena",
    );
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

  it("página de impressão: tabelas com textContent, nunca HTML", () => {
    const pagina = document.implementation.createHTMLDocument("x");
    montarPaginaDaLista(pagina, doc);
    expect(pagina.title).toBe(doc.titulo);
    expect(pagina.querySelectorAll("table")).toHaveLength(2 + 8);
    expect(pagina.querySelector("img")).toBeNull();
    expect(pagina.body.textContent).toContain(
      "Ana <img src=x onerror=alert(1)>",
    );
    expect(
      [...pagina.querySelectorAll("td")].some(
        (td) =>
          td.textContent === "Não houve candidatos aptos." && td.colSpan === 4,
      ),
    ).toBe(true);
  });
});
