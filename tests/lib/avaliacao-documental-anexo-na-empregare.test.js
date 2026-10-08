import { describe, expect, it } from "vitest";
import {
  apresentacaoDoAnexo,
  enderecoDoAnexo,
  enunciadoCompleto,
  linkDasRespostas,
  numeroDaPergunta,
} from "../../src/lib/avaliacao-documental/anexo-na-empregare.ts";

/*
  O "Abrir na Empregare" do anexo declarado (src/lib/avaliacao-documental/anexo-na-empregare.ts):
  hoje abre o candidato (o currículo) e diz onde achar o arquivo; o link
  direto do arquivo entra só ali. Dados fictícios.
*/
const COLUNA =
  "Pergunta 4 - Anexe o documento de identificação com foto (frente e verso, legível)";
const CANDIDATO =
  "https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=TKfict&id=IDfict|";

describe("anexo na Empregare", () => {
  it("número e enunciado inteiro da pergunta pela coluna", () => {
    expect(numeroDaPergunta(COLUNA)).toBe("Pergunta 4");
    expect(numeroDaPergunta("Sem número")).toBeNull();
    expect(enunciadoCompleto(COLUNA)).toBe(
      "Anexe o documento de identificação com foto (frente e verso, legível)",
    );
    expect(enunciadoCompleto("Pergunta 7&nbsp;-  Anexe   o registro")).toBe(
      "Anexe o registro",
    );
  });

  it("o endereço: o candidato; sem ele, a vaga ou a lista de vagas", () => {
    expect(
      enderecoDoAnexo(
        { candidato: CANDIDATO, vaga: "x", vagaDireta: true },
        COLUNA,
      ),
    ).toEqual({ href: CANDIDATO, destino: "candidato" });
    expect(
      enderecoDoAnexo({
        candidato: null,
        vaga: "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1|",
        vagaDireta: true,
      }),
    ).toEqual({
      href: "https://corporate.empregare.com/empresa/vagas/candidaturas/Ab1|",
      destino: "vaga",
    });
    expect(
      enderecoDoAnexo({
        candidato: null,
        vaga: "https://corporate.empregare.com/empresa/vagas",
        vagaDireta: false,
      })?.destino,
    ).toBe("vagas");
    expect(
      enderecoDoAnexo({ candidato: null, vaga: null, vagaDireta: false }),
    ).toBeNull();
  });

  it('rótulo "Abrir na Empregare" e a dica com a aba Questionários e a pergunta', () => {
    expect(apresentacaoDoAnexo(COLUNA)).toEqual({
      rotulo: "Abrir na Empregare",
      dica: "Na Empregare: aba Questionários › Pergunta 4 — Anexe o documento de identificação com foto",
    });
    expect(
      apresentacaoDoAnexo(
        "Pergunta 6 - Anexe o diploma ou certificado de conclusão da formação exigida para a vaga, frente e verso",
      ).dica,
    ).toBe(
      "Na Empregare: aba Questionários › Pergunta 6 — Anexe o diploma ou certificado de conclusão da formação…",
    );
    expect(apresentacaoDoAnexo("").dica).toBe(
      "Na Empregare: aba Questionários",
    );
  });
});

/*
  A visão de respostas do questionário (com os anexos), pelo identificador da
  resposta que o robô captura: "Ver respostas e anexos na Empregare" e a dica
  da pergunta; sem ela, o fallback de antes. Identificadores fictícios.
*/
const RESPOSTAS =
  "https://corporate.empregare.com/empresa/questionarios/imprimir/9988776|";
const VAGA =
  "https://corporate.empregare.com/empresa/vagas/candidaturas/Vfict|";

describe("visão de respostas do questionário (empregare.link_respostas)", () => {
  it("aceita só o link da visão de respostas", () => {
    expect(linkDasRespostas({ link_respostas: RESPOSTAS })).toBe(RESPOSTAS);
    expect(
      linkDasRespostas({ link_respostas: `${RESPOSTAS}#pergunta-4` }),
    ).toBe(`${RESPOSTAS}#pergunta-4`);
    for (const ruim of [
      "https://corporate.empregare.com/empresa/questionarios/imprimir/12a|",
      "https://outro.invalid/empresa/questionarios/imprimir/1|",
      "javascript:alert(1)",
      "https://storage.empregare.com/anexocurriculo/x.pdf?se=1&sig=y",
      "",
    ])
      expect(linkDasRespostas({ link_respostas: ruim })).toBeNull();
    expect(linkDasRespostas(null)).toBeNull();
  });

  it("com a visão de respostas: o botão abre direto e a dica diz a pergunta", () => {
    const endereco = enderecoDoAnexo(
      {
        candidato: CANDIDATO,
        vaga: VAGA,
        vagaDireta: true,
        respostas: RESPOSTAS,
      },
      COLUNA,
    );
    expect(endereco).toEqual({ href: RESPOSTAS, destino: "respostas" });
    expect(apresentacaoDoAnexo(COLUNA, endereco)).toEqual({
      rotulo: "Ver respostas e anexos na Empregare",
      dica: "Pergunta 4 — Anexe o documento de identificação com foto",
    });
  });

  it("sem a visão de respostas: o candidato, como antes", () => {
    const endereco = enderecoDoAnexo(
      { candidato: CANDIDATO, vaga: VAGA, vagaDireta: true, respostas: null },
      COLUNA,
    );
    expect(endereco).toEqual({ href: CANDIDATO, destino: "candidato" });
    expect(apresentacaoDoAnexo(COLUNA, endereco).rotulo).toBe(
      "Abrir na Empregare",
    );
  });
});
