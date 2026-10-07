import { describe, expect, it } from "vitest";
import {
  anexoDaColuna,
  anexosDaEmpregare,
  apresentacaoDoAnexo,
  enderecoDoAnexo,
  enunciadoCompleto,
  linkValido,
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
  O link de cada anexo na ficha (links fictícios): o arquivo capturado pelo
  robô vira "Ver documento"; a página do questionário e a falta de captura
  mantêm "Abrir na Empregare" com a dica da aba Questionários.
*/
const CANDIDATO_2 =
  "https://corporate.empregare.com/empresa/curriculo/detalhes?tokenCandidato=TKfict&id=IDfict|";
const VAGA =
  "https://corporate.empregare.com/empresa/vagas/candidaturas/Vfict|";
const ARQUIVO = "https://arquivos.exemplo.invalid/anexos/ABCfict.pdf";
const PAGINA =
  "https://corporate.empregare.com/empresa/questionarios/imprimir/Qfict|#pergunta-5";
const COLUNA_4 =
  "Pergunta 4 - Anexe o documento de identificação com foto (RG ou CNH)";
const COLUNA_5 = "Pergunta 5 - Anexe o diploma de graduação";

const DA_RPC = {
  link_candidato: CANDIDATO_2,
  anexos: [
    {
      pergunta: 4,
      enunciado: "Anexe o documento",
      tipo: "ARQUIVO",
      link: ARQUIVO,
      capturado_em: "2026-10-08T12:00:00Z",
    },
    {
      pergunta: 5,
      enunciado: "Anexe o diploma de graduação",
      tipo: "QUESTIONARIO",
      link: PAGINA,
    },
    { pergunta: 6, tipo: "ARQUIVO", link: "javascript:alert(1)" },
    { pergunta: 7, tipo: "QUESTIONARIO", link: "https://outro.invalid/x" },
    { pergunta: 0, tipo: "ARQUIVO", link: ARQUIVO },
    { pergunta: 4, tipo: "ARQUIVO", link: `${ARQUIVO}?repetido` },
  ],
};

describe("anexo capturado pelo robô (empregare.anexos)", () => {
  it("valida os anexos da RPC: formato do link por tipo, pergunta de 1 a 999, um por pergunta", () => {
    const anexos = anexosDaEmpregare(DA_RPC);
    expect(anexos.map((a) => [a.pergunta, a.tipo])).toEqual([
      [4, "ARQUIVO"],
      [5, "QUESTIONARIO"],
    ]);
    expect(anexos[0]).toMatchObject({
      link: ARQUIVO,
      capturadoEm: "2026-10-08T12:00:00Z",
    });
    expect(anexos[1].capturadoEm).toBeNull();
    expect(anexosDaEmpregare(null)).toEqual([]);
    expect(anexosDaEmpregare({ anexos: "x" })).toEqual([]);
    expect(linkValido("ARQUIVO", 'https://a.invalid/x".pdf')).toBeNull();
    expect(linkValido("ARQUIVO", "http://a.invalid/x.pdf")).toBeNull();
    expect(linkValido("OUTRO", ARQUIVO)).toBeNull();
  });

  it("com o link do arquivo: 'Ver documento', sem dica", () => {
    const anexos = anexosDaEmpregare(DA_RPC);
    const enderecos = {
      candidato: CANDIDATO_2,
      vaga: VAGA,
      vagaDireta: true,
      anexos,
    };
    const endereco = enderecoDoAnexo(enderecos, COLUNA_4);
    expect(endereco).toEqual({ href: ARQUIVO, destino: "arquivo" });
    expect(apresentacaoDoAnexo(COLUNA_4, endereco)).toEqual({
      rotulo: "Ver documento",
      dica: "",
    });
  });

  it("com a página do questionário: abre a página e mantém a dica", () => {
    const enderecos = {
      candidato: CANDIDATO_2,
      vaga: VAGA,
      vagaDireta: true,
      anexos: anexosDaEmpregare(DA_RPC),
    };
    const endereco = enderecoDoAnexo(enderecos, COLUNA_5);
    expect(endereco).toEqual({ href: PAGINA, destino: "questionario" });
    expect(apresentacaoDoAnexo(COLUNA_5, endereco)).toEqual({
      rotulo: "Abrir na Empregare",
      dica: "Na Empregare: aba Questionários › Pergunta 5 — Anexe o diploma de graduação",
    });
  });

  it("sem anexo capturado: o candidato, a vaga ou as vagas, como antes, com a dica", () => {
    const coluna = "Pergunta 9 - Anexe o comprovante de residência";
    const comCandidato = enderecoDoAnexo(
      { candidato: CANDIDATO_2, vaga: VAGA, vagaDireta: true, anexos: [] },
      coluna,
    );
    expect(comCandidato).toEqual({ href: CANDIDATO_2, destino: "candidato" });
    expect(apresentacaoDoAnexo(coluna, comCandidato)).toEqual({
      rotulo: "Abrir na Empregare",
      dica: "Na Empregare: aba Questionários › Pergunta 9 — Anexe o comprovante de residência",
    });
    expect(
      enderecoDoAnexo(
        { candidato: null, vaga: VAGA, vagaDireta: true },
        coluna,
      ),
    ).toEqual({ href: VAGA, destino: "vaga" });
    expect(
      enderecoDoAnexo(
        {
          candidato: null,
          vaga: "https://corporate.empregare.com/empresa/vagas",
          vagaDireta: false,
        },
        coluna,
      ),
    ).toMatchObject({ destino: "vagas" });
    expect(
      enderecoDoAnexo({ candidato: null, vaga: null, vagaDireta: false }),
    ).toBeNull();
    expect(apresentacaoDoAnexo("Anexo")).toEqual({
      rotulo: "Abrir na Empregare",
      dica: "Na Empregare: aba Questionários › Anexo",
    });
  });

  it("casa pela pergunta e, sem número, pelo enunciado", () => {
    const anexos = anexosDaEmpregare(DA_RPC);
    expect(anexoDaColuna(anexos, COLUNA_4)?.pergunta).toBe(4);
    expect(
      anexoDaColuna(anexos, "Anexe o diploma de graduação")?.pergunta,
    ).toBe(5);
    expect(
      anexoDaColuna(anexos, "ANEXE O DIPLOMA DE GRADUACAO e o histórico")
        ?.pergunta,
    ).toBe(5);
    expect(anexoDaColuna(anexos, "Anexe")).toBeNull();
    expect(anexoDaColuna([], COLUNA_4)).toBeNull();
    expect(numeroDaPergunta(COLUNA_4)).toBe("Pergunta 4");
    expect(numeroDaPergunta("Sem número")).toBeNull();
  });
});
