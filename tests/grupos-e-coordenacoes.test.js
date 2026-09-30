import { describe, expect, it } from "vitest";
import {
  avisoDeTransformarEmCoordenacao,
  codigoAPartirDoNome,
  confirmacaoDeTransformarValida,
  nomeDaCoordenacaoDaConta,
  coordenacaoParaSalvar,
  coordenacaoVazia,
  opcoesDeUnidadesDaCoordenacao,
  grupoParaSalvar,
  grupoVazio,
  resumoDaCoordenacao,
  validarCoordenacao,
  validarGrupo,
} from "../src/lib/grupos-e-coordenacoes.js";

describe("grupo de permissões", () => {
  it("código sai do nome, sem acento", () => {
    expect(codigoAPartirDoNome("Gestão Regional", "_")).toBe("gestao_regional");
    expect(codigoAPartirDoNome("Coordenação Norte 2")).toBe(
      "coordenacao-norte-2",
    );
  });

  it("novo grupo exige nome único e todo módulo com nível válido", () => {
    const rascunho = { ...grupoVazio(), nome: "Usuário" };
    expect(
      validarGrupo(rascunho, {
        existentes: [{ codigo: "usuario", nome: "Usuário" }],
      }).nome,
    ).toBeTruthy();
    const ok = { ...grupoVazio(), nome: "Analista" };
    expect(validarGrupo(ok)).toEqual({});
    expect(grupoParaSalvar(ok)).toMatchObject({
      codigo: "analista",
      nome: "Analista",
      revisao: null,
    });
    expect(Object.keys(grupoParaSalvar(ok).niveis)).toContain("acessos");
    expect(
      validarGrupo({ ...ok, niveis: { ...ok.niveis, configuracoes: "leitor" } })
        .configuracoes,
    ).toBeTruthy();
  });
});

describe("coordenação", () => {
  it("valida nome e área; payload sem repetição", () => {
    expect(validarCoordenacao(coordenacaoVazia("")).nome).toBeTruthy();
    expect(
      validarCoordenacao({ ...coordenacaoVazia(""), nome: "Norte" }).area,
    ).toBeTruthy();
    const r = {
      ...coordenacaoVazia("saude-indigena"),
      nome: "Norte",
      unidades: ["DSEI X", "DSEI X"],
      editais: ["1"],
    };
    expect(validarCoordenacao(r)).toEqual({});
    expect(coordenacaoParaSalvar(r)).toEqual({
      codigo: "norte",
      nome: "Norte",
      area: "saude-indigena",
      responsavel: null,
      unidades: ["DSEI X"],
      editais: ["1"],
      ativo: true,
      revisao: null,
    });
  });

  it("resume o recorte; sem nada, a área inteira", () => {
    expect(resumoDaCoordenacao({ unidades: [], editais: [] })).toBe(
      "A área inteira",
    );
    expect(
      resumoDaCoordenacao({
        responsavel: "USI",
        unidades: ["a", "b"],
        editais: ["e"],
      }),
    ).toBe("USI · 2 unidades · 1 edital");
  });

  it("unidades: só as da área e, com responsável, só as dele", () => {
    const catalogo = [{ nome_oficial: "DSEI Alto Rio Negro", id_unidade: "1" }];
    const unidadesPorArea = [
      { unidade: "SEDE", area: "sede" },
      { unidade: "MFC", area: "projetos" },
    ];
    const daSaude = opcoesDeUnidadesDaCoordenacao({
      area: "saude-indigena",
      responsavel: "",
      catalogo,
      unidadesPorArea,
    });
    expect(daSaude.map((o) => o.value)).toEqual(["DSEI Alto Rio Negro"]);
    const daSede = opcoesDeUnidadesDaCoordenacao({
      area: "sede",
      responsavel: "CORES",
      catalogo,
      unidadesPorArea,
    });
    expect(daSede.map((o) => o.value)).toEqual(["SEDE"]);
    expect(
      opcoesDeUnidadesDaCoordenacao({
        area: "sede",
        responsavel: "USI",
        catalogo,
        unidadesPorArea,
      }),
    ).toEqual([]);
  });
});

/*
  Em 30/09 "transformar a conta em coordenação" foi usado numa conta de
  PESSOA: a conta foi desativada. A confirmação diz as consequências e só
  aceita CONFIRMAR ou o e-mail da conta.
*/
describe("conta de setor vira coordenação", () => {
  const conta = { nome: "COET – Saúde", email: "coet@agenciasus.org.br" };

  it("o aviso diz que desativa a conta e cria a coordenação na área", () => {
    expect(avisoDeTransformarEmCoordenacao(conta, "Saúde Indígena")).toBe(
      "Isto vai DESATIVAR a conta coet@agenciasus.org.br (ela não entra mais) e criar a coordenação COET – Saúde na área Saúde Indígena. Use só para contas compartilhadas de setor.",
    );
    expect(
      nomeDaCoordenacaoDaConta({ email: "setor.x@agenciasus.org.br" }),
    ).toBe("setor.x");
  });

  it("confirmação: CONFIRMAR (exato) ou o e-mail (sem caixa)", () => {
    expect(confirmacaoDeTransformarValida("CONFIRMAR", conta)).toBe(true);
    expect(
      confirmacaoDeTransformarValida(" COET@agenciasus.org.br ", conta),
    ).toBe(true);
    expect(confirmacaoDeTransformarValida("confirmar", conta)).toBe(false);
    expect(confirmacaoDeTransformarValida("sim", conta)).toBe(false);
    expect(confirmacaoDeTransformarValida("", conta)).toBe(false);
  });
});
