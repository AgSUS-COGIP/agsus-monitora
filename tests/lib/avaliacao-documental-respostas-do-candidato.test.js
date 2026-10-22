import { describe, expect, it } from "vitest";
import { linhasDasRespostas } from "../../src/lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  arquivosDaPergunta,
  itensSugeridos,
} from "../../src/lib/avaliacao-documental/respostas-do-candidato.ts";

/*
  O que o candidato informou, para a ficha vir pronta para conferir: os
  arquivos de cada pergunta de anexo (link direto e nome) e as linhas que o
  job Python tirou das respostas (sugestoes da ficha; a interpretação e os
  testes dela estão em tests/python/test_sugestoes_da_ficha.py). A tela só lê.
*/
const LINK = (arquivo, n = 1) =>
  `https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=${arquivo}&nome=Case&token=TK${n}&questionarioRespostaID=9`;
const COLUNA = "Pergunta 16 - Anexe os certificados dos cursos";
const anexo = (arquivo, link) => ({
  resposta: "9",
  pergunta: "16",
  arquivo,
  ordem: 16,
  enunciado: "",
  coluna: COLUNA,
  link,
});

// O anexo na Empregare, a chave da leitura automática dos arquivos.
const ID = (arquivo) => ({ resposta: "9", pergunta: "16", arquivo });

describe("arquivos da pergunta de anexo", () => {
  it("um link por arquivo, na ordem, com o nome que a Empregare guardou", () => {
    const enderecos = {
      candidato: null,
      vaga: null,
      vagaDireta: false,
      anexos: [
        anexo(2, LINK("0a1b2c3d4e5f_certificado%20NR-35.pdf", 2)),
        anexo(1, LINK("NR-10.pdf")),
        anexo(3, LINK("%20", 3)),
      ],
    };
    expect(arquivosDaPergunta(enderecos, COLUNA)).toEqual([
      { numero: 1, nome: "NR-10.pdf", link: LINK("NR-10.pdf"), ...ID(1) },
      {
        numero: 2,
        nome: "certificado NR-35.pdf",
        link: LINK("0a1b2c3d4e5f_certificado%20NR-35.pdf", 2),
        ...ID(2),
      },
      // Sem nome legível: o número.
      { numero: 3, nome: "Arquivo 3", link: LINK("%20", 3), ...ID(3) },
    ]);
    expect(arquivosDaPergunta({ ...enderecos, anexos: [] }, COLUNA)).toEqual(
      [],
    );
  });
});

describe("linhas sugeridas pelo job Python", () => {
  const CURSOS = { codigo: "CURSOS", tipo: "CURSOS" };
  const EXPERIENCIA = {
    codigo: "EXPERIENCIA",
    tipo: "VINCULOS",
    categorias: [{ codigo: "AREA_OU_SUS" }],
  };

  it("lê as sugestões do bloco; o vínculo sem categoria ganha a do bloco", () => {
    const sugestoes = {
      CURSOS: [{ nome: "NR-10", horas: 120, aceito: true, da_resposta: true }],
      EXPERIENCIA: [
        { empregador: "H", inicio: "2020-01-01", fim: "2021-12-31" },
      ],
    };
    expect(itensSugeridos(sugestoes, CURSOS)).toEqual(sugestoes.CURSOS);
    expect(itensSugeridos(sugestoes, EXPERIENCIA)).toEqual([
      {
        empregador: "H",
        inicio: "2020-01-01",
        fim: "2021-12-31",
        categoria: "AREA_OU_SUS",
        aceito: true,
        da_resposta: true,
      },
    ]);
    expect(itensSugeridos(null, CURSOS)).toEqual([]);
    expect(itensSugeridos({ CURSOS: "x" }, CURSOS)).toEqual([]);
  });

  it("a primeira linha: a sugestão; sem ela, vazia", () => {
    expect(linhasDasRespostas(CURSOS, "superior", ['"5 pontos"'])).toEqual([
      { nome: "", horas: "", aceito: true },
    ]);
    expect(
      linhasDasRespostas(CURSOS, "superior", [], {
        CURSOS: [{ nome: "Gestão em saúde", horas: 60 }],
      }),
    ).toEqual([
      { nome: "Gestão em saúde", horas: 60, aceito: true, da_resposta: true },
    ]);
  });
});
