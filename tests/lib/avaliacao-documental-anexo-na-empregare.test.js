import { describe, expect, it } from "vitest";
import {
  anexosDaColuna,
  anexosDaEmpregare,
  apresentacaoDoAnexo,
  enderecoDoAnexo,
  enunciadoCompleto,
  impressaoDasRespostas,
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
  Os anexos capturados pelo robô (GetRespostaDetails; links fictícios): o
  "Visualizar Arquivo" da pergunta vira "Ver documento"; sem ele, a impressão
  das respostas ("Ver respostas na Empregare"); sem ela, o fallback de antes.
*/
const ARQ = (pergunta, arquivo) =>
  `https://corporate.empregare.com/Company/VacancyTests/GetViewerLogArquivo?arquivo=${arquivo}.pdf&token=TKfict&questionarioRespostaID=9900001&perguntaID=${pergunta}`;
const IMPRESSAO =
  "https://corporate.empregare.com/Company/VacancyTests/PrintResult?respostaID=9900001&pessoa=PSfict&vaga=Vaga%20Ficticia";
const VAGA =
  "https://corporate.empregare.com/empresa/vagas/candidaturas/Vfict|";
const COLUNA_6 = "Pergunta 6 - Anexe o diploma de graduação";
const DA_RPC = {
  respostas: [
    { resposta: "9900002", link_impressao: "javascript:alert(1)" },
    { resposta: "9900001", link_impressao: IMPRESSAO },
  ],
  anexos: [
    {
      resposta: "9900001",
      pergunta: "501",
      arquivo: 1,
      enunciado:
        "Pergunta 4 - Anexe o documento de identificação com foto (RG ou CNH)",
      coluna: COLUNA,
      link: ARQ(501, "a"),
    },
    {
      resposta: "9900001",
      pergunta: "502",
      arquivo: 2,
      enunciado: "Anexe o diploma de graduação",
      coluna: "",
      link: ARQ(502, "c"),
    },
    {
      resposta: "9900001",
      pergunta: "502",
      arquivo: 1,
      enunciado: "Anexe o diploma de graduação",
      coluna: "",
      link: ARQ(502, "b"),
    },
    {
      resposta: "9900001",
      pergunta: "503",
      arquivo: 1,
      link: "https://storage.empregare.com/anexocurriculo/x.pdf?se=1&sig=y",
    },
    { resposta: "9900001", pergunta: "x", arquivo: 1, link: ARQ(504, "d") },
  ],
};

describe("anexos capturados pelo robô (empregare.anexos e respostas)", () => {
  it("valida o que veio da RPC: só Visualizar Arquivo e PrintResult da Empregare", () => {
    expect(
      anexosDaEmpregare(DA_RPC).map((a) => [a.pergunta, a.arquivo]),
    ).toEqual([
      ["501", 1],
      ["502", 2],
      ["502", 1],
    ]);
    expect(impressaoDasRespostas(DA_RPC)).toBe(IMPRESSAO);
    expect(anexosDaEmpregare(null)).toEqual([]);
    expect(impressaoDasRespostas({ respostas: "x" })).toBeNull();
  });

  it("com o link da pergunta (pela coluna casada): 'Ver documento', sem dica", () => {
    const enderecos = {
      candidato: CANDIDATO,
      vaga: VAGA,
      vagaDireta: true,
      anexos: anexosDaEmpregare(DA_RPC),
      impressao: impressaoDasRespostas(DA_RPC),
    };
    const endereco = enderecoDoAnexo(enderecos, COLUNA);
    expect(endereco).toEqual({
      href: ARQ(501, "a"),
      destino: "arquivo",
      outros: [],
    });
    expect(apresentacaoDoAnexo(COLUNA, endereco)).toEqual({
      rotulo: "Ver documento",
      dica: "",
    });
  });

  it("sem coluna casada, pelo enunciado; com dois arquivos, abre o primeiro e diz quantos são", () => {
    const enderecos = {
      candidato: CANDIDATO,
      vaga: VAGA,
      vagaDireta: true,
      anexos: anexosDaEmpregare(DA_RPC),
    };
    const endereco = enderecoDoAnexo(enderecos, COLUNA_6);
    expect(endereco).toEqual({
      href: ARQ(502, "b"),
      destino: "arquivo",
      outros: [ARQ(502, "c")],
    });
    expect(apresentacaoDoAnexo(COLUNA_6, endereco)).toEqual({
      rotulo: "Ver documento",
      dica: "2 arquivos nesta pergunta",
    });
    expect(anexosDaColuna(enderecos.anexos, "Anexe")).toEqual([]);
  });

  it("sem o link da pergunta: a impressão das respostas; sem ela, o candidato", () => {
    const coluna = "Pergunta 9 - Anexe o comprovante de residência";
    const comImpressao = enderecoDoAnexo(
      {
        candidato: CANDIDATO,
        vaga: VAGA,
        vagaDireta: true,
        anexos: anexosDaEmpregare(DA_RPC),
        impressao: IMPRESSAO,
      },
      coluna,
    );
    expect(comImpressao).toEqual({ href: IMPRESSAO, destino: "respostas" });
    expect(apresentacaoDoAnexo(coluna, comImpressao)).toEqual({
      rotulo: "Ver respostas na Empregare",
      dica: "Pergunta 9 — Anexe o comprovante de residência",
    });
    const semNada = enderecoDoAnexo(
      { candidato: CANDIDATO, vaga: VAGA, vagaDireta: true },
      coluna,
    );
    expect(semNada).toEqual({ href: CANDIDATO, destino: "candidato" });
    expect(apresentacaoDoAnexo(coluna, semNada).rotulo).toBe(
      "Abrir na Empregare",
    );
  });
});
