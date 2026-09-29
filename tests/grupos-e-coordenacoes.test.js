import { describe, expect, it } from "vitest";
import {
  codigoAPartirDoNome,
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
    expect(codigoAPartirDoNome("Coordenação Norte 2")).toBe("coordenacao-norte-2");
  });

  it("novo grupo exige nome único e todo módulo com nível válido", () => {
    const rascunho = { ...grupoVazio(), nome: "Usuário" };
    expect(validarGrupo(rascunho, { existentes: [{ codigo: "usuario", nome: "Usuário" }] }).nome).toBeTruthy();
    const ok = { ...grupoVazio(), nome: "Analista" };
    expect(validarGrupo(ok)).toEqual({});
    expect(grupoParaSalvar(ok)).toMatchObject({ codigo: "analista", nome: "Analista", revisao: null });
    expect(Object.keys(grupoParaSalvar(ok).niveis)).toContain("acessos");
    expect(validarGrupo({ ...ok, niveis: { ...ok.niveis, configuracoes: "leitor" } }).configuracoes).toBeTruthy();
  });
});

describe("coordenação", () => {
  it("valida nome e área; payload sem repetição", () => {
    expect(validarCoordenacao(coordenacaoVazia("")).nome).toBeTruthy();
    expect(validarCoordenacao({ ...coordenacaoVazia(""), nome: "Norte" }).area).toBeTruthy();
    const r = { ...coordenacaoVazia("saude-indigena"), nome: "Norte", unidades: ["DSEI X", "DSEI X"], editais: ["1"] };
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
    expect(resumoDaCoordenacao({ unidades: [], editais: [] })).toBe("A área inteira");
    expect(resumoDaCoordenacao({ responsavel: "USI", unidades: ["a", "b"], editais: ["e"] })).toBe("USI · 2 unidades · 1 edital");
  });

  it("unidades: só as da área e, com responsável, só as dele", () => {
    const catalogo = [{ nome_oficial: "DSEI Alto Rio Negro", id_unidade: "1" }];
    const unidadesPorArea = [{ unidade: "SEDE", area: "sede" }, { unidade: "MFC", area: "projetos" }];
    const daSaude = opcoesDeUnidadesDaCoordenacao({ area: "saude-indigena", responsavel: "", catalogo, unidadesPorArea });
    expect(daSaude.map((o) => o.value)).toEqual(["DSEI Alto Rio Negro"]);
    const daSede = opcoesDeUnidadesDaCoordenacao({ area: "sede", responsavel: "CORES", catalogo, unidadesPorArea });
    expect(daSede.map((o) => o.value)).toEqual(["SEDE"]);
    expect(opcoesDeUnidadesDaCoordenacao({ area: "sede", responsavel: "USI", catalogo, unidadesPorArea })).toEqual([]);
  });
});
