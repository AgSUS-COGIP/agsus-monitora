import { describe, expect, it } from "vitest";
import {
  SITUACAO_ETAPA,
  TIPOS_DE_ETAPA,
  classificarEtapa,
  dataLocal,
  etapaConcluida,
  normalizarTexto,
  situacaoDaEtapa,
} from "../src/lib/etapas-de-edital.js";

/*
  As doze atividades do modelo padrão, copiadas de `nucleo-cronograma.js`
  (função que monta o modelo). São o caso real: a maioria dos editais usa este
  modelo sem alterar os nomes. Se a classificação regredir, regride aqui.
*/
const MODELO_PADRAO = [
  ["Publicação do Edital", "inscricoes"],
  ["Impugnação do Edital", "impugnacao"],
  ["Período de inscrição e envio dos documentos comprobatórios", "inscricoes"],
  ["Resultado Preliminar da Avaliação Documental e de Títulos", "resultado"],
  ["Prazo de recurso do resultado preliminar documental", "recursos"],
  ["Resultado Final da Avaliação Documental e de Títulos", "resultado"],
  ["Convocação para Entrevista", "convocacao-entrevista"],
  ["Período de Entrevistas", "entrevistas"],
  ["Resultado Preliminar das Entrevistas", "resultado"],
  ["Prazo para recursos das entrevistas", "recursos"],
  ["Resultado final da Entrevista", "resultado"],
  ["Resultado final do Processo Seletivo", "resultado-final"],
];

describe("classificarEtapa", () => {
  it.each(MODELO_PADRAO)("classifica %j como %s", (atividade, esperado) => {
    expect(classificarEtapa(atividade).id).toBe(esperado);
  });

  it("ignora acentos e caixa, porque a atividade é digitada à mão", () => {
    expect(classificarEtapa("IMPUGNAÇÃO DO EDITAL").id).toBe("impugnacao");
    expect(classificarEtapa("impugnacao do edital").id).toBe("impugnacao");
    expect(classificarEtapa("  Impugnação  ").id).toBe("impugnacao");
  });

  it("dá precedência a recurso sobre resultado na mesma frase", () => {
    // O caso que motiva a ordem de TIPOS_DE_ETAPA: a frase tem as duas palavras.
    expect(
      classificarEtapa("Prazo de recurso do resultado preliminar").id,
    ).toBe("recursos");
  });

  it("dá precedência a resultado sobre entrevista na mesma frase", () => {
    expect(classificarEtapa("Resultado Preliminar das Entrevistas").id).toBe(
      "resultado",
    );
  });

  it("não confunde 'documentos comprobatórios' com análise documental", () => {
    // "documentos" não casa com o termo "documental"; inscrição deve vencer.
    expect(
      classificarEtapa("Período de inscrição e envio dos documentos").id,
    ).toBe("inscricoes");
  });

  /*
    Os três tipos abaixo foram separados de tipos maiores a pedido de quem usa a
    tela. Cada um contém a palavra-chave do tipo de onde saiu, por isso depende
    inteiramente da ordem de `TIPOS_DE_ETAPA`. Estes testes são o que impede que
    reordenar a lista os devolva silenciosamente ao tipo antigo.
  */
  it("separa impugnação de recursos", () => {
    expect(classificarEtapa("Impugnação do Edital").id).toBe("impugnacao");
    // Recurso continua recurso: contesta um resultado, não o edital.
    expect(classificarEtapa("Prazo de recurso das entrevistas").id).toBe(
      "recursos",
    );
  });

  it("separa convocação para entrevista da entrevista em si", () => {
    expect(classificarEtapa("Convocação para Entrevista").id).toBe(
      "convocacao-entrevista",
    );
    expect(classificarEtapa("Convocação para a Entrevista").id).toBe(
      "convocacao-entrevista",
    );
    expect(classificarEtapa("Período de Entrevistas").id).toBe("entrevistas");
  });

  it("não confunde outras convocações com a da entrevista", () => {
    // Não existe tipo para admissão; o que importa é não virar entrevista.
    expect(classificarEtapa("Convocação para admissão").id).not.toBe(
      "convocacao-entrevista",
    );
  });

  /*
    Homologação e admissão tiveram tipo próprio e deixaram de ter: o cronograma
    dos editais não tem essas etapas, e duas cores que nunca pintavam nada só
    gastavam a legenda. Cair em `outros`, com cor neutra, é o comportamento certo
    para o que o sistema não sabe classificar — e este teste impede que voltem
    por acidente, capturadas por termos de outro tipo.
  */
  it("deixa homologação e admissão em 'outros'", () => {
    expect(classificarEtapa("Homologação do certame").id).toBe("outros");
    expect(classificarEtapa("Início das admissões").id).toBe("outros");
    expect(classificarEtapa("Posse dos aprovados").id).toBe("outros");
  });

  it("mantém a homologação do resultado final como resultado final", () => {
    // O marco importa mais que o verbo: é o fecho do processo, não um trâmite.
    expect(
      classificarEtapa("Homologação do resultado final do processo").id,
    ).toBe("resultado-final");
  });

  it("separa o resultado final do processo dos resultados parciais", () => {
    expect(classificarEtapa("Resultado final do Processo Seletivo").id).toBe(
      "resultado-final",
    );
    expect(
      classificarEtapa("Resultado Final da Avaliação Documental e de Títulos")
        .id,
    ).toBe("resultado");
    expect(classificarEtapa("Resultado final da Entrevista").id).toBe(
      "resultado",
    );
  });

  it("não trata qualquer menção a processo seletivo como resultado final", () => {
    // Motivo de os termos serem frases inteiras e não "processo seletivo".
    expect(
      classificarEtapa("Publicação do Edital do Processo Seletivo").id,
    ).toBe("inscricoes");
  });

  it("cai em 'outros' em vez de adivinhar, quando nada casa", () => {
    expect(classificarEtapa("Reunião com a comissão").id).toBe("outros");
    expect(classificarEtapa("").id).toBe("outros");
    expect(classificarEtapa(null).id).toBe("outros");
    expect(classificarEtapa(undefined).id).toBe("outros");
  });

  it("sempre devolve um tipo utilizável, nunca null", () => {
    for (const entrada of ["", null, undefined, 42, {}, []]) {
      const tipo = classificarEtapa(entrada);
      expect(tipo).toBeTruthy();
      expect(typeof tipo.rotulo).toBe("string");
      expect(typeof tipo.cor).toBe("string");
    }
  });

  it("não tem ids nem cores duplicados entre os tipos", () => {
    const ids = TIPOS_DE_ETAPA.map((tipo) => tipo.id);
    expect(new Set(ids).size).toBe(ids.length);
    const cores = TIPOS_DE_ETAPA.map((tipo) => tipo.cor);
    expect(new Set(cores).size).toBe(cores.length);
  });
});

describe("normalizarTexto", () => {
  // É a base da busca do calendário: quem digita sem acento tem de encontrar.
  it("remove acentos e baixa a caixa", () => {
    expect(normalizarTexto("Homologação")).toBe("homologacao");
    expect(normalizarTexto("DSEI ALTO RIO NEGRO")).toBe("dsei alto rio negro");
    expect(normalizarTexto("Avaliação Documental")).toBe(
      "avaliacao documental",
    );
  });

  it("apara as pontas e aguenta entrada inválida", () => {
    expect(normalizarTexto("  Entrevistas  ")).toBe("entrevistas");
    expect(normalizarTexto("")).toBe("");
    expect(normalizarTexto(null)).toBe("");
    expect(normalizarTexto(undefined)).toBe("");
  });

  it("permite achar a etapa digitando sem acento", () => {
    const alvo = normalizarTexto("Convocação para a Entrevista — Ed. 97/2026");
    expect(alvo.includes(normalizarTexto("convocacao"))).toBe(true);
    expect(alvo.includes(normalizarTexto("ENTREVISTA"))).toBe(true);
  });
});

describe("dataLocal", () => {
  it("ancora ao meio-dia local, para a etapa não recuar um dia", () => {
    const data = dataLocal("2026-09-29");
    expect(data.getFullYear()).toBe(2026);
    expect(data.getMonth()).toBe(8); // setembro
    expect(data.getDate()).toBe(29);
  });

  it("devolve null para entrada vazia ou inválida", () => {
    expect(dataLocal("")).toBeNull();
    expect(dataLocal(null)).toBeNull();
    expect(dataLocal("não é data")).toBeNull();
  });
});

describe("situacaoDaEtapa", () => {
  const hoje = new Date(2026, 8, 29, 9, 30); // 29/09/2026, de manhã

  it("marca como concluída quando a data fim já passou", () => {
    expect(
      situacaoDaEtapa(
        { data_inicio: "2026-09-01", data_fim: "2026-09-10" },
        hoje,
      ),
    ).toBe(SITUACAO_ETAPA.CONCLUIDA);
  });

  it("marca como em andamento quando hoje está dentro do intervalo", () => {
    expect(
      situacaoDaEtapa(
        { data_inicio: "2026-09-25", data_fim: "2026-10-05" },
        hoje,
      ),
    ).toBe(SITUACAO_ETAPA.EM_ANDAMENTO);
  });

  it("inclui os dias de início e fim no intervalo", () => {
    expect(
      situacaoDaEtapa(
        { data_inicio: "2026-09-29", data_fim: "2026-09-29" },
        hoje,
      ),
    ).toBe(SITUACAO_ETAPA.EM_ANDAMENTO);
  });

  /*
    Houve um quarto estado, separando "Pendente" de "Programado" por um limite de
    dez dias que não vinha de regra nenhuma. Este teste fixa que não voltou: o
    que ainda não começou é futuro, esteja a cinco dias ou a dois meses.
  */
  it("não distingue futuro próximo de futuro distante", () => {
    const daquiA5Dias = situacaoDaEtapa(
      { data_inicio: "2026-10-04", data_fim: "2026-10-06" },
      hoje,
    );
    const daquiA2Meses = situacaoDaEtapa(
      { data_inicio: "2026-11-30", data_fim: "2026-12-01" },
      hoje,
    );
    expect(daquiA5Dias).toBe(SITUACAO_ETAPA.FUTURA);
    expect(daquiA2Meses).toBe(SITUACAO_ETAPA.FUTURA);
  });

  it("usa a data de início quando falta a data fim", () => {
    expect(situacaoDaEtapa({ data_inicio: "2026-09-29" }, hoje)).toBe(
      SITUACAO_ETAPA.EM_ANDAMENTO,
    );
  });

  it("devolve null quando a etapa não tem datas utilizáveis", () => {
    expect(situacaoDaEtapa({}, hoje)).toBeNull();
    expect(situacaoDaEtapa({ data_fim: "2026-09-30" }, hoje)).toBeNull();
    expect(situacaoDaEtapa(null, hoje)).toBeNull();
  });
});

describe("etapaConcluida", () => {
  const hoje = new Date(2026, 8, 29, 9, 30);

  it("é verdadeiro só para o que já terminou", () => {
    expect(
      etapaConcluida(
        { data_inicio: "2026-09-01", data_fim: "2026-09-10" },
        hoje,
      ),
    ).toBe(true);
    expect(
      etapaConcluida(
        { data_inicio: "2026-09-29", data_fim: "2026-09-29" },
        hoje,
      ),
    ).toBe(false);
    expect(
      etapaConcluida(
        { data_inicio: "2026-10-20", data_fim: "2026-10-21" },
        hoje,
      ),
    ).toBe(false);
  });

  // Sem datas não dá para afirmar que terminou; esconder seria perder a etapa.
  it("não trata etapa sem datas como concluída", () => {
    expect(etapaConcluida({}, hoje)).toBe(false);
  });
});
