import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  alteracoesDasComemoracoes,
  analisesConcluidasNoDia,
  CATALOGO_DE_MARCOS,
  CHAVE_DA_PREFERENCIA_PESSOAL,
  CHAVE_DAS_COMEMORACOES,
  comemoracoesPessoaisLigadas,
  configuracaoDasComemoracoes,
  contratadosDoEdital,
  decidirComemoracao,
  definirConfiguracaoDasComemoracoes,
  duracaoMsDasOpcoes,
  errosDaConfiguracao,
  estadoDosPersonalizados,
  guardarPreferenciaPessoal,
  hojeComoChave,
  mensagemDoPersonalizado,
  normalizarConfiguracao,
  normalizarDuracaoS,
  novoPersonalizado,
  opcoesDoMarco,
  personalizadosAlcancados,
  serializarConfiguracao,
} from "../src/lib/catalogo-de-comemoracoes.ts";
import {
  buildChanges,
  CAMPOS_DAS_SECOES,
  errosDasSecoes,
  normalizarValoresCarregados,
} from "../src/lib/publicacao-de-configuracoes.js";

/*
  O catálogo e a configuração das comemorações: os marcos que o código já
  comemora, o JSON publicado em TB_CONFIGURACAO (só o que difere do padrão),
  a decisão de mostrar (teste, preferência pessoal, marco desligado) e os
  marcos personalizados com dados do front.
*/

const memoria = () => {
  const guardado = new Map();
  return {
    getItem: (k) => (guardado.has(k) ? guardado.get(k) : null),
    setItem: (k, v) => guardado.set(k, String(v)),
    removeItem: (k) => guardado.delete(k),
    guardado,
  };
};

describe("catálogo de marcos", () => {
  it("inventaria os marcos que o código comemora, cada um usado no seu lugar", () => {
    const ids = CATALOGO_DE_MARCOS.map((m) => m.id);
    expect(ids).toEqual([
      "edital-concluido",
      "fila-zerada",
      "vaga-pronta",
      "marco-do-ano",
      "acesso-liberado",
      "fim-do-tour",
      "fim-da-trilha",
    ]);
    expect(new Set(ids).size).toBe(ids.length);
    // O id aparece no arquivo que dispara a comemoração.
    for (const marco of CATALOGO_DE_MARCOS) {
      const onde = readFileSync(marco.onde, "utf8");
      const lib = readFileSync("src/lib/comemoracao.js", "utf8");
      expect(
        onde.includes(`"${marco.id}"`) || lib.includes(`"${marco.id}"`),
      ).toBe(true);
    }
  });

  it("o padrão reproduz o de antes: fogos; suave na vaga pronta; festa no marco do ano e na trilha", () => {
    const config = normalizarConfiguracao("");
    expect(opcoesDoMarco(config, "vaga-pronta")).toMatchObject({
      ligado: true,
      efeito: "fogos",
      intensidade: "suave",
      som: false,
      publico: "quem-fez",
    });
    expect(opcoesDoMarco(config, "marco-do-ano").intensidade).toBe("festa");
    expect(opcoesDoMarco(config, "fim-da-trilha").intensidade).toBe("festa");
    expect(opcoesDoMarco(config, "fila-zerada").intensidade).toBe("normal");
    expect(opcoesDoMarco(config, "nao-existe")).toBeNull();
  });
});

describe("configuração publicada", () => {
  it("JSON quebrado, vazio ou com lixo vira o padrão; valores fora da faixa são corrigidos", () => {
    expect(serializarConfiguracao(normalizarConfiguracao("{quebrado"))).toBe(
      "",
    );
    expect(serializarConfiguracao(normalizarConfiguracao(null))).toBe("");
    const config = normalizarConfiguracao({
      marcos: {
        "fila-zerada": {
          efeito: "laser",
          intensidade: "nuclear",
          duracaoS: 99,
          publico: "area-online",
          mensagem: "x".repeat(400),
        },
        inventado: { ligado: false },
      },
    });
    const fila = opcoesDoMarco(config, "fila-zerada");
    expect(fila.efeito).toBe("fogos");
    expect(fila.intensidade).toBe("normal");
    expect(fila.duracaoS).toBe(15);
    // "Toda a área online" ainda não existe (sem tempo real por área).
    expect(fila.publico).toBe("quem-fez");
    expect(fila.mensagem).toHaveLength(160);
    expect(config.marcos.inventado).toBeUndefined();
  });

  it("serializa só o que difere do padrão, estável, e volta igual", () => {
    const config = normalizarConfiguracao("");
    const mudada = {
      ...config,
      marcos: {
        ...config.marcos,
        "fila-zerada": {
          ...config.marcos["fila-zerada"],
          efeito: "confete",
          duracaoS: 8,
        },
        "fim-do-tour": { ...config.marcos["fim-do-tour"], ligado: false },
      },
    };
    const texto = serializarConfiguracao(mudada);
    expect(JSON.parse(texto)).toEqual({
      marcos: {
        "fila-zerada": { efeito: "confete", duracaoS: 8 },
        "fim-do-tour": { ligado: false },
      },
    });
    expect(serializarConfiguracao(normalizarConfiguracao(texto))).toBe(texto);
    expect(duracaoMsDasOpcoes({ duracaoS: 8 })).toBe(8000);
    expect(duracaoMsDasOpcoes({ duracaoS: null })).toBeNull();
  });

  it("duração em segundos: de 2 a 15, meio em meio; vazio é automática", () => {
    expect(normalizarDuracaoS("")).toBeNull();
    expect(normalizarDuracaoS("0")).toBeNull();
    expect(normalizarDuracaoS("1")).toBe(2);
    expect(normalizarDuracaoS("7,3")).toBe(7.5);
    expect(normalizarDuracaoS(40)).toBe(15);
  });

  it("marcos personalizados: validados, com id próprio e mensagem padrão", () => {
    const um = novoPersonalizado([]);
    const dois = novoPersonalizado([um], "analises-no-dia");
    expect(um.id).not.toBe(dois.id);
    const config = normalizarConfiguracao({
      personalizados: [
        { ...um, nome: "", edital: "" },
        { ...dois, nome: "Dia cheio", meta: 0 },
        { tipo: "desconhecido" },
      ],
    });
    expect(config.personalizados).toHaveLength(2);
    expect(errosDaConfiguracao(config)).toEqual([
      "Dê um nome ao marco personalizado 1.",
      "Marco personalizado 1: informe o número do edital.",
      "Dia cheio: a meta deve ser um número inteiro de 1 a 100.000.",
    ]);
    expect(
      mensagemDoPersonalizado({ ...um, edital: "012/2026", meta: 30 }),
    ).toBe("Edital 012/2026 chegou a 30 contratados! 🎉");
    expect(
      mensagemDoPersonalizado({ ...dois, meta: 50, mensagem: "Uau" }),
    ).toBe("Uau");
  });

  it("o registro guarda o que o app carregou", () => {
    definirConfiguracaoDasComemoracoes(
      JSON.stringify({ marcos: { "vaga-pronta": { ligado: false } } }),
    );
    expect(configuracaoDasComemoracoes().marcos["vaga-pronta"].ligado).toBe(
      false,
    );
    definirConfiguracaoDasComemoracoes("");
    expect(configuracaoDasComemoracoes().marcos["vaga-pronta"].ligado).toBe(
      true,
    );
  });
});

describe("decisão de mostrar", () => {
  const desligado = normalizarConfiguracao({
    marcos: { "fila-zerada": { ligado: false } },
  });

  it("marco desligado não aparece; o teste passa por cima", () => {
    expect(
      decidirComemoracao({ marco: "fila-zerada", config: desligado }).mostrar,
    ).toBe(false);
    expect(
      decidirComemoracao({
        marco: "fila-zerada",
        config: desligado,
        teste: true,
      }).mostrar,
    ).toBe(true);
    expect(
      decidirComemoracao({ marco: "edital-concluido", config: desligado })
        .mostrar,
    ).toBe(true);
  });

  it("a preferência pessoal desliga tudo, menos o teste; guardada neste navegador", () => {
    const armazenamento = memoria();
    expect(comemoracoesPessoaisLigadas(armazenamento)).toBe(true);
    guardarPreferenciaPessoal(armazenamento, false);
    expect(armazenamento.guardado.get(CHAVE_DA_PREFERENCIA_PESSOAL)).toBe("1");
    expect(comemoracoesPessoaisLigadas(armazenamento)).toBe(false);
    const pessoal = comemoracoesPessoaisLigadas(armazenamento);
    expect(
      decidirComemoracao({ marco: "edital-concluido", pessoal }).mostrar,
    ).toBe(false);
    expect(
      decidirComemoracao({ marco: "edital-concluido", pessoal, teste: true })
        .mostrar,
    ).toBe(true);
    guardarPreferenciaPessoal(armazenamento, true);
    expect(armazenamento.guardado.has(CHAVE_DA_PREFERENCIA_PESSOAL)).toBe(
      false,
    );
    // Armazenamento bloqueado: ligadas (o padrão), sem erro.
    const bloqueado = {
      getItem: () => {
        throw new Error("bloqueado");
      },
    };
    expect(comemoracoesPessoaisLigadas(bloqueado)).toBe(true);
  });
});

describe("marcos personalizados com dados do front", () => {
  const edital = {
    ...novoPersonalizado([]),
    id: "pessoal-1",
    nome: "Edital 12",
    edital: "012/2026",
    meta: 10,
  };
  const dia = {
    ...novoPersonalizado([edital], "analises-no-dia"),
    id: "pessoal-2",
    nome: "Dia",
    meta: 3,
  };

  it("conta contratados do edital e análises concluídas do dia", () => {
    const linhas = [
      { edital: "012/2026", contratados: 4 },
      { edital: " 012/2026 ", contratados: "5" },
      { edital: "013/2026", contratados: 50 },
      { edital: "012/2026", contratados: null },
    ];
    expect(contratadosDoEdital(linhas, "012/2026")).toBe(9);
    const analises = [
      { status_consolidado: "Apto", data_analise: "07/10/2026" },
      { status_consolidado: "Inapto", data_analise: "2026-10-07" },
      { status_consolidado: "Pendente", data_analise: "07/10/2026" },
      { status_consolidado: "Apto", data_analise: "06/10/2026" },
    ];
    expect(analisesConcluidasNoDia(analises, "2026-10-07")).toBe(2);
    expect(hojeComoChave(new Date(2026, 9, 7, 23, 0))).toBe("2026-10-07");
  });

  it("comemora a transição pela meta, uma vez; sem leitura anterior, nada", () => {
    const lista = [edital, dia];
    const antes = estadoDosPersonalizados(lista, "edital-contratados", {
      linhas: [{ edital: "012/2026", contratados: 9 }],
      dia: "2026-10-07",
    });
    expect(personalizadosAlcancados(null, antes, lista)).toEqual([]);
    const depois = estadoDosPersonalizados(lista, "edital-contratados", {
      linhas: [{ edital: "012/2026", contratados: 10 }],
      dia: "2026-10-07",
    });
    expect(personalizadosAlcancados(antes, depois, lista)).toEqual([edital]);
    expect(personalizadosAlcancados(depois, depois, lista)).toEqual([]);
    // Desligado: não comemora.
    expect(
      personalizadosAlcancados(antes, depois, [{ ...edital, ligado: false }]),
    ).toEqual([]);
  });

  it("no dia: recomeça a cada dia", () => {
    const lista = [dia];
    const ontem = { dia: "2026-10-06", valores: { "pessoal-2": 9 } };
    const hoje = { dia: "2026-10-07", valores: { "pessoal-2": 3 } };
    expect(personalizadosAlcancados(ontem, hoje, lista)).toEqual([dia]);
    const mesmoDia = { dia: "2026-10-07", valores: { "pessoal-2": 3 } };
    expect(personalizadosAlcancados(mesmoDia, hoje, lista)).toEqual([]);
  });
});

describe("publicação com histórico (mesma das outras seções)", () => {
  it("a chave entra nas seções, vazia por padrão, e valida os personalizados", () => {
    const campo = CAMPOS_DAS_SECOES.comemoracoes[0];
    expect(campo.chave).toBe(CHAVE_DAS_COMEMORACOES);
    expect(normalizarValoresCarregados({}).get(CHAVE_DAS_COMEMORACOES)).toBe(
      "",
    );
    const invalido = JSON.stringify({
      personalizados: [{ tipo: "analises-no-dia", nome: "", meta: 3 }],
    });
    const erros = errosDasSecoes(new Map([[CHAVE_DAS_COMEMORACOES, invalido]]));
    expect(erros.get(CHAVE_DAS_COMEMORACOES)).toMatch(/Comemorações/);
  });

  it("a revisão mostra cada campo mudado, não o JSON", () => {
    const depois = JSON.stringify({
      marcos: { "fila-zerada": { efeito: "confete" } },
    });
    expect(alteracoesDasComemoracoes("", depois)).toEqual([
      {
        label: "Comemorações · Fila de análises zerada",
        field: "Efeito",
        before: "fogos",
        after: "confete",
      },
    ]);
    const mudancas = buildChanges(
      { configuracoes: [] },
      [{ chave: CHAVE_DAS_COMEMORACOES, valor: depois, descricao: "x" }],
      [],
    );
    expect(mudancas).toEqual([
      {
        entity: "Configuração",
        label: "Comemorações · Fila de análises zerada",
        field: "Efeito",
        before: "fogos",
        after: "confete",
      },
    ]);
  });
});

describe("preferência pessoal compartilhada com a mascote", () => {
  it('a chave e o formato que a arara lê: "1" = desligadas', async () => {
    const { CHAVE_COMEMORACOES_PESSOAIS } =
      await import("../src/lib/preferencia-de-comemoracoes.js");
    expect(CHAVE_COMEMORACOES_PESSOAIS).toBe(
      "agsus_monitora_comemoracoes_desligadas",
    );
    expect(CHAVE_DA_PREFERENCIA_PESSOAL).toBe(CHAVE_COMEMORACOES_PESSOAIS);
    const armazenamento = memoria();
    armazenamento.setItem(CHAVE_COMEMORACOES_PESSOAIS, "1");
    expect(comemoracoesPessoaisLigadas(armazenamento)).toBe(false);
  });
});
