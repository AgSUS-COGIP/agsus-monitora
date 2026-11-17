import { describe, expect, it } from "vitest";
import {
  classificarRegistros,
  dicaDoRegistro,
  registrosDoDsei,
} from "../../src/lib/mapa-saude-indigena/mapa-do-dsei.ts";
import type { DseiDoMapa } from "../../src/lib/mapa-saude-indigena/tipos.ts";
import {
  VINCULO_EXTERNO,
  VINCULO_INDETERMINADO,
  VINCULO_NORMAL,
} from "../../src/lib/uf-ibge.ts";

/*
  PONTO DO SIGEPSI SEM CEP: VÍNCULO NÃO CLASSIFICADO

  A UF de cada ponto vem só do CEP (`ufDoCep`, localizacoes-do-sigepsi.ts).
  Sem CEP, o ponto não herda a UF da sede: herdar escondia a unidade de fora
  da área, sempre contada como local. Fica indeterminado (desenhado e contado
  como local no enquadramento, sem afirmar que está dentro), e a dica avisa.
  Dados fictícios.
*/

const dsei: DseiDoMapa = {
  k: "TESTE",
  n: "Teste",
  lat: -9.6,
  lon: -35.7,
  sedeuf: "AL",
  ufs: ["AL"],
  polos: [
    { n: "POLO COM CEP", lat: -9.9, lon: -36.0, uf: "AL", tipo: "polo" },
    { n: "POLO FORA", lat: -8.0, lon: -35.0, uf: "PE", tipo: "polo" },
    { n: "UBSI SEM CEP", lat: -10.1, lon: -36.4, uf: "", tipo: "unidade" },
  ],
};

describe("ponto do SIGEPSI sem CEP no mapa do DSEI", () => {
  const classificados = classificarRegistros(registrosDoDsei(dsei), dsei);
  const porNome = (nome: string) => {
    const achado = classificados.find((r) => r.name === nome);
    if (!achado) throw new Error(`sem ${nome}`);
    return achado;
  };

  it("não herda a UF da sede: o vínculo fica indeterminado", () => {
    const semCep = porNome("UBSI SEM CEP");
    expect(semCep.uf).toBe("");
    expect(semCep.vinculo).toBe(VINCULO_INDETERMINADO);
    expect(semCep.ufAdministrativa).toBeNull();
  });

  it("a dica diz que a UF não veio do SIGEPSI", () => {
    expect(dicaDoRegistro(porNome("UBSI SEM CEP"), dsei).linhas).toContain(
      "UF não informada no SIGEPSI (sem CEP) — vínculo não classificado",
    );
  });

  it("com CEP, segue a UF do CEP: dentro ou fora da área", () => {
    expect(porNome("POLO COM CEP").vinculo).toBe(VINCULO_NORMAL);
    expect(porNome("POLO FORA").vinculo).toBe(VINCULO_EXTERNO);
  });
});
