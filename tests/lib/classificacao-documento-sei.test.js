import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { instantaneoDaLista } from "../../src/lib/classificacao/exportacao.js";
import {
  CABECALHO_PADRAO,
  chaveDoModelo,
  dataPorExtenso,
  documentoOficial,
  htmlParaSei,
  itensDoTexto,
  MODELOS_PADRAO,
  numeroComExtenso,
  numeroDoEdital,
  paginaDaPrevia,
  textoDasNotasMinimas,
  textoParaSei,
  trechos,
  unidadeDoEdital,
} from "../../src/lib/classificacao/documento-sei.js";
import { gerarDocxOficial } from "../../src/lib/classificacao/documento-docx.js";
import { classificar } from "../../src/lib/classificacao/motor.js";
import {
  documentoDaRegra,
  normalizarRegra,
  validarRegra,
} from "../../src/lib/classificacao/regra.js";

/*
  O documento oficial (SEI) bate com as publicações do edital 83/2026 (DSEI
  Xingu, processo AGSUS.016954/2026-81): resultado preliminar da análise
  curricular (SEI 0641561), resultado final da entrevista (0736888),
  resultado final do processo seletivo (0739164) e convocação para entrevista
  (0663011) — títulos, textos das disposições, cabeçalhos das vagas, colunas,
  linhas e "Não houve candidatos aptos.". E o .docx com papel timbrado.
*/

const SEED = readFileSync(
  "supabase/correcoes/20261002-regras-de-classificacao-83-e-100.sql",
  "utf8",
);
const regraDoSeed = (marca) => {
  const inicio = SEED.indexOf(`$${marca}$`) + marca.length + 2;
  return JSON.parse(SEED.slice(inicio, SEED.indexOf(`$${marca}$`, inicio)));
};
const SEED_83 = regraDoSeed("regra83");
const REGRA_83 = {
  ...SEED_83,
  documental: {
    ...SEED_83.documental,
    nota_minima_por_nivel: {
      superior: 7,
      tecnico: 6,
      medio: 6,
      fundamental: 5,
    },
    parciais: ["FORMACAO", "CURSOS", "EXPERIENCIA", "ETNICO"],
  },
  documento: {
    unidade: "Distrito Sanitário Especial Indígena Xingu (DSEI/ XINGU)",
    processo: "AGSUS.016954/2026-81",
  },
};

let n = 0;
const id = () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const cand = (vaga, cargo, nome, [doc, form, cur, exp, etn], campos = {}) => ({
  analise_id: id(),
  codigo: String(5000 + n),
  nome,
  vaga,
  cargo,
  modalidade: "Ampla concorrência",
  pcd: "Não",
  status: "Aprovado",
  nota_documental: doc,
  pontuacao_formacao: form,
  pontuacao_cursos: cur,
  pontuacao_experiencia: exp,
  pontuacao_etnica: etn,
  data_nascimento: "1980-01-01",
  quadro: { 169672: "q1", 169673: "q2" }[vaga],
  ...campos,
});
const QUADRO = [
  {
    id: "q1",
    ordem: 1,
    cargo: "Agente de Combate a Endemias",
    lotacao: "Área de abrangência DSEI Xingu",
    modalidades: { "Ampla Concorrência": 1 },
    vagas_imediatas: 1,
    cadastro_reserva: true,
  },
  {
    id: "q2",
    ordem: 2,
    cargo: "Analista Técnico de Saúde Indígena",
    lotacao: "DSEI Xingu (Sede)",
    modalidades: { "Ampla Concorrência": 1 },
    vagas_imediatas: 1,
    cadastro_reserva: true,
  },
  {
    id: "q3",
    ordem: 3,
    cargo: "Apoiador Técnico de Saneamento",
    lotacao: "DSEI Xingu (Sede)",
    modalidades: {},
    vagas_imediatas: 0,
    cadastro_reserva: true,
  },
];
const ACE = "Agente de Combate a Endemias";
const ATSI = "Analista Técnico de Saúde Indígena";
const krumare = cand(
  "169672",
  ACE,
  "Krumare Trumai Aweti",
  [12.2, 5, 0, 7.2, 0],
);
const laucio = cand(
  "169673",
  ATSI,
  "Laucio Ambrosio Lorenço",
  [21.4, 1, 2, 6.4, 12],
);
const deysiane = cand(
  "169673",
  ATSI,
  "Deysiane Teodoro",
  [20.7, 0, 1.7, 7, 12],
);
const aliel = cand(
  "169673",
  ATSI,
  "Aliel Alexandrino",
  [14.6, 0, 1.8, 0.8, 12],
);
const reprovado = cand("169673", ATSI, "Fulano Reprovado", [4, 0, 0, 0, 0], {
  status: "Reprovado",
});
const candidatos = [krumare, laucio, deysiane, aliel, reprovado];
const entrevista = (c, nota) => ({
  id: id(),
  analise_id: c.analise_id,
  nome: c.nome,
  vaga: c.vaga,
  nota,
  parecer: "APTO",
  compareceu: "S",
  ligacao: "codigo",
  origem: "sistema",
  notas: [],
});
const entrevistas = [entrevista(krumare, 12), entrevista(laucio, 9)];
const EDITAL = { id: "e83", edital: "83/2026", unidade: "DSEI Xingu" };

const retratoDe = (tipo) =>
  instantaneoDaLista(
    classificar({
      tipo,
      regra: REGRA_83,
      candidatos,
      entrevistas,
      quadro: QUADRO,
      unidade: "DSEI Xingu",
      dataCorte: "2026-07-20",
    }),
    { edital: EDITAL, regra: REGRA_83, versao: 1 },
  );
const semMarcas = (t) =>
  trechos(t)
    .map((x) => x.texto)
    .join("");
const rotulos = (t) => t.colunas.map((c) => c.rotulo);

describe("resultado preliminar da análise curricular (83/2026, SEI 0641561)", () => {
  const doc = documentoOficial(retratoDe("PRELIMINAR"), {
    lista: "geral",
    regra: REGRA_83,
  });

  it("título e local/data como no SEI", () => {
    expect(doc.localData).toBe("Brasília, na data da assinatura digital.");
    expect(doc.titulo).toEqual([
      "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR",
    ]);
    expect(doc.nome).toBe(
      "Resultado Preliminar - Etapa de Análise Curricular - Classificação Geral",
    );
  });

  it("1. Disposições preliminares: o texto publicado", () => {
    expect(doc.preliminares.map((i) => semMarcas(i.texto))).toEqual([
      "A Agência Brasileira de Apoio à Gestão do SUS (AgSUS), em conformidade com o Edital nº 83/2026, referente ao Processo Seletivo Simplificado destinado ao Distrito Sanitário Especial Indígena Xingu (DSEI/ XINGU), no exercício de seu compromisso institucional com a transparência, responsabilidade e adequada condução de seus certames, torna público o Resultado Preliminar da Etapa de Avaliação Documental e de Títulos das Vagas de Ampla Concorrência, conforme previsto no item 8 do referido Edital.",
      "A presente listagem contempla os candidatos classificados por cargo, em ordem decrescente de pontuação, contendo o nome completo e a respectiva nota obtida após a avaliação da documentação apresentada.",
      "Nos termos do item 8.20 do Edital, a pontuação mínima exigida para aptidão na Avaliação Documental e de Títulos é de 7 (sete) pontos para nível superior, 6 (seis) pontos para nível técnico e médio, e 5 (cinco) pontos para nível fundamental.",
      "Ressalta-se, ainda, que foram considerados desclassificados os candidatos que deixaram de apresentar documentação obrigatória ou que apresentaram documentos em desconformidade com os itens dispostos no item 8 do edital.",
      "Apresenta-se, a seguir, a relação preliminar dos(as) candidatos(as) aprovados(as) na etapa de Avaliação Documental e de Títulos.",
    ]);
    // Os negritos da publicação.
    expect(doc.preliminares[0].texto).toContain(
      "**Agência Brasileira de Apoio à Gestão do SUS (AgSUS)**",
    );
    expect(doc.preliminares[0].texto).toContain(
      "**Resultado Preliminar da Etapa de Avaliação Documental e de Títulos das Vagas de Ampla Concorrência**",
    );
  });

  it("todas as vagas, com o cabeçalho publicado, colunas e linhas", () => {
    expect(doc.blocos.map((b) => b.cabecalho)).toEqual([
      "VAGA 169672 - Agente de Combate a Endemias - Área de abrangência DSEI Xingu - DSEI Xingu - 1 vaga (1 AC + CR)",
      "VAGA 169673 - Analista Técnico de Saúde Indígena - DSEI Xingu (Sede) - DSEI Xingu - 1 vaga (1 AC + CR)",
      "VAGA - Apoiador Técnico de Saneamento - DSEI Xingu (Sede) - DSEI Xingu - Cadastro Reserva",
    ]);
    const [t] = doc.blocos[1].tabelas;
    expect(rotulos(t)).toEqual([
      "Classificação",
      "Nome",
      "Nota Final",
      "Formação Acadêmica",
      "Cursos de Aperfeiçoamento",
      "Experiência Profissional",
      "Pontuação Étnica",
    ]);
    expect(t.linhas).toEqual([
      ["1º", "Laucio Ambrosio Lorenço", "21,4", "1,0", "2,0", "6,4", "12,0"],
      ["2º", "Deysiane Teodoro", "20,7", "0,0", "1,7", "7,0", "12,0"],
      ["3º", "Aliel Alexandrino", "14,6", "0,0", "1,8", "0,8", "12,0"],
    ]);
    expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBe(100);
    expect(doc.blocos[2].tabelas[0]).toMatchObject({
      linhas: [],
      vazia: "Não houve candidatos aptos.",
    });
  });

  it("2. Disposições finais: o recurso do item 11", () => {
    expect(doc.finais.map((i) => i.texto)).toEqual([
      "Os candidatos poderão interpor recurso contra o resultado preliminar da etapa Avaliação Documental e de Títulos, nos termos do item 11 do Edital, exclusivamente por meio do e-mail recursos.nerssi@agenciasus.org.br, mediante requerimento específico, conforme modelo constante no Anexo VII, no período estabelecido no cronograma.",
    ]);
  });

  it("HTML para o SEI: classes do SEI, numeração automática, tabelas com borda e largura", () => {
    const html = htmlParaSei(doc);
    const pagina = new DOMParser().parseFromString(html, "text/html");
    const classes = (c) => pagina.querySelectorAll(`p.${c}`);
    expect(classes("Texto_Alinhado_Direita")[0].textContent).toBe(
      "Brasília, na data da assinatura digital.",
    );
    expect(classes("Texto_Centralizado_Maiusculas")[0].textContent).toBe(
      "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR",
    );
    expect([...classes("Item_Nivel1")].map((p) => p.textContent)).toEqual([
      "Disposições Preliminares",
      "Disposições Finais",
    ]);
    expect(classes("Item_Nivel2")).toHaveLength(5 + 1);
    // O número é do SEI (contador de CSS), não do texto.
    expect(classes("Item_Nivel2")[0].textContent).toMatch(/^A Agência/);
    expect(classes("Item_Nivel2")[0].querySelector("strong").textContent).toBe(
      "Agência Brasileira de Apoio à Gestão do SUS (AgSUS)",
    );
    const vagas = [...pagina.querySelectorAll("p.Texto_Centralizado > strong")];
    expect(vagas.map((s) => s.textContent)).toEqual(
      doc.blocos.map((b) => b.cabecalho),
    );
    const tabelas = pagina.querySelectorAll("table");
    expect(tabelas).toHaveLength(3);
    for (const tabela of tabelas) {
      expect(tabela.getAttribute("style")).toContain(
        "border-collapse:collapse",
      );
      expect(tabela.getAttribute("style")).toContain("width:100%");
    }
    const cabeca = tabelas[1].querySelector("tr");
    expect(
      [...cabeca.querySelectorAll("td")].map((td) => td.textContent),
    ).toEqual(rotulos(doc.blocos[1].tabelas[0]));
    expect(cabeca.querySelector("td").getAttribute("style")).toContain(
      "background-color:#d9d9d9",
    );
    expect(
      [...cabeca.querySelectorAll("td")].reduce(
        (s, td) => s + Number(td.style.width.replace("%", "")),
        0,
      ),
    ).toBe(100);
    expect(tabelas[1].querySelector("tr:nth-child(2) p").className).toBe(
      "Tabela_Texto_Alinhado_Esquerda",
    );
    expect(tabelas[2].textContent).toBe("Não houve candidatos aptos.");
    // Sem timbrado nem assinatura: o SEI põe.
    expect(html).not.toMatch(/<img|assinado eletronicamente|SEPN CRN/i);
  });

  it("texto puro: numerado e com as tabelas por tabulação", () => {
    const texto = textoParaSei(doc).split("\n");
    expect(texto).toContain("1. DISPOSIÇÕES PRELIMINARES");
    expect(texto.find((l) => l.startsWith("1.3. "))).toContain(
      "7 (sete) pontos",
    );
    expect(texto).toContain("2. DISPOSIÇÕES FINAIS");
    expect(texto).toContain(
      "Classificação\tNome\tNota Final\tFormação Acadêmica\tCursos de Aperfeiçoamento\tExperiência Profissional\tPontuação Étnica",
    );
    expect(texto).toContain(
      "1º\tLaucio Ambrosio Lorenço\t21,4\t1,0\t2,0\t6,4\t12,0",
    );
    expect(texto.join("\n")).not.toContain("**");
  });
});

describe("eliminados, modalidades e fase final da análise curricular", () => {
  const retrato = retratoDe("PRELIMINAR");

  it("eliminados: Nome | Nota Final | parciais | Justificativa, texto dos eliminados", () => {
    const doc = documentoOficial(retrato, {
      lista: "eliminados",
      regra: REGRA_83,
    });
    expect(doc.chave).toBe("PRELIMINAR_PRELIMINAR_ELIMINADOS");
    expect(doc.preliminares).toHaveLength(6);
    expect(doc.finais[0].texto).toContain(
      "divulga a relação dos candidatos eliminados",
    );
    const [t] = doc.blocos[1].tabelas;
    expect(rotulos(t)).toEqual([
      "Nome",
      "Nota Final",
      "Formação Acadêmica",
      "Cursos de Aperfeiçoamento",
      "Experiência Profissional",
      "Pontuação Étnica",
      "Justificativa",
    ]);
    expect(t.linhas[0][0]).toBe("Fulano Reprovado");
    expect(t.linhas[0].at(-1)).toContain(
      "Não habilitado na avaliação documental",
    );
    expect(doc.blocos[0].tabelas[0].vazia).toBe(
      "Não houve candidatos eliminados.",
    );
  });

  it("por modalidade: todas as vagas, vagas reservadas no 1.1, PcD com a sigla publicada", () => {
    const doc = documentoOficial(retrato, { lista: "PCD", regra: REGRA_83 });
    expect(doc.blocos).toHaveLength(3);
    expect(
      doc.blocos.every(
        (b) => b.tabelas.length === 1 && b.tabelas[0].linhas.length === 0,
      ),
    ).toBe(true);
    expect(semMarcas(doc.preliminares[0].texto)).toContain(
      "das Vagas Reservadas para Pessoas com Deficiência (PcD)",
    );
    expect(doc.nome).toMatch(/- PcD$/);
  });

  it("resultado final da etapa: título FINAL, 1.5 'relação final' e as disposições da convocação", () => {
    const doc = documentoOficial(retrato, { fase: "FINAL", regra: REGRA_83 });
    expect(doc.titulo).toEqual([
      "RESULTADO FINAL - ETAPA DE ANÁLISE CURRICULAR",
    ]);
    expect(doc.preliminares[4].texto).toContain("a relação final dos(as)");
    expect(doc.finais.map((i) => i.texto)).toHaveLength(3);
    expect(doc.finais[1].texto).toContain(
      "organização administrativa do DSEI Xingu",
    );
  });
});

describe("convocação para entrevista (83/2026, SEI 0663011)", () => {
  const doc = documentoOficial(retratoDe("CONVOCACAO"), {
    lista: "geral",
    regra: REGRA_83,
  });

  it("COMUNICADO EXTERNO e os itens 1.3.x / 1.3.3.x", () => {
    expect(doc.titulo.map(semMarcas)).toEqual([
      "COMUNICADO EXTERNO",
      "EDITAL DE CONVOCAÇÃO PARA ENTREVISTA",
      "PROCESSO SELETIVO SIMPLIFICADO – DSEI Xingu – EDITAL Nº 83/2026",
    ]);
    expect(doc.preliminares.map((i) => i.nivel)).toEqual([
      2, 2, 2, 3, 3, 3, 4, 4, 4, 2,
    ]);
    const texto = textoParaSei(doc);
    expect(texto).toContain("1.3.3.1. Os candidatos não poderão utilizar");
    expect(texto).toContain("1.4. Apresenta-se, a seguir, a lista");
    const html = htmlParaSei(doc);
    expect(html).toContain(
      '<p class="Item_Nivel3"><strong>Os candidatos convocados',
    );
    expect(html).toContain('<p class="Item_Nivel4">');
  });

  it("uma tabela: Nº | NOME | Vaga | DATA | HORA (data e hora em branco para o SEI)", () => {
    expect(doc.blocos).toHaveLength(1);
    const [t] = doc.blocos[0].tabelas;
    expect(rotulos(t)).toEqual(["Nº", "NOME", "Vaga", "DATA", "HORA"]);
    expect(t.linhas[0]).toEqual([
      "1",
      "Krumare Trumai Aweti",
      "169672 - Agente de Combate a Endemias - Área de abrangência DSEI Xingu",
      "",
      "",
    ]);
    expect(t.linhas.map((l) => l[0])).toEqual(
      t.linhas.map((_, i) => String(i + 1)),
    );
  });
});

describe("resultado da entrevista e resultado final (83/2026)", () => {
  it("entrevista final (SEI 0736888): Classificação | NOME | NOTA e o 2.1 publicado", () => {
    const doc = documentoOficial(retratoDe("ENTREVISTA"), {
      lista: "geral",
      fase: "FINAL",
      regra: REGRA_83,
    });
    expect(doc.titulo).toEqual(["RESULTADO FINAL - ETAPA DE ENTREVISTA"]);
    expect(doc.preliminares[1].texto).toBe(
      "Foram considerados(as) aprovados(as) na etapa de Entrevistas os(as) candidatos(as) relacionados(as) a seguir, por ordem de classificação, com indicação do nome completo e da respectiva nota obtida:",
    );
    expect(rotulos(doc.blocos[0].tabelas[0])).toEqual([
      "Classificação",
      "NOME",
      "NOTA",
    ]);
    expect(doc.blocos[0].tabelas[0].linhas).toEqual([
      ["1º", "Krumare Trumai Aweti", "12,0"],
    ]);
    expect(doc.blocos[2].tabelas[0].linhas).toEqual([]);
    expect(doc.finais[0].texto).toMatch(
      /^Esta nota corresponde somente à nota atribuída na etapa de Entrevista\..*item 10\.4\.$/,
    );
  });

  it("resultado final (SEI 0739164): autoridade no 1.1, CLASSIFICAÇÃO | NOME | NOTA FINAL, 2.1 e 2.2", () => {
    const regra = {
      ...REGRA_83,
      documento: {
        ...REGRA_83.documento,
        unidade: "Distrito Sanitário Especial Indígena Xingu (DSEI XINGU)",
        autoridade:
          "por intermédio da Diretoria de Atenção Integral à Saúde, no uso das atribuições que lhe foram conferidas pela Designação nº 28/2026/PRES/AgSUS",
      },
    };
    const doc = documentoOficial(retratoDe("FINAL"), { lista: "geral", regra });
    expect(doc.titulo).toEqual(["RESULTADO FINAL - PROCESSO SELETIVO"]);
    expect(semMarcas(doc.preliminares[0].texto)).toBe(
      "A Agência Brasileira de Apoio à Gestão do SUS (AgSUS), por intermédio da Diretoria de Atenção Integral à Saúde, no uso das atribuições que lhe foram conferidas pela Designação nº 28/2026/PRES/AgSUS, em conformidade com o Edital nº 83/2026, referente ao Distrito Sanitário Especial Indígena Xingu (DSEI XINGU), no exercício de seu compromisso institucional com a transparência, responsabilidade e adequada condução de seus certames, torna público o Resultado Final do Processo Seletivo, conforme previsto no item 10 do referido Edital.",
    );
    expect(doc.preliminares[1].texto).toContain(
      "(até 30 pontos) e na Entrevista Individual (até 20 pontos)",
    );
    expect(rotulos(doc.blocos[0].tabelas[0])).toEqual([
      "CLASSIFICAÇÃO",
      "NOME",
      "NOTA FINAL",
    ]);
    expect(doc.blocos[0].tabelas[0].colunas.map((c) => c.alinhamento)).toEqual([
      "centro",
      "centro",
      "centro",
    ]);
    expect(doc.finais.map((i) => i.texto)).toEqual([
      "Os(as) candidatos(as) aprovados(as) dentro do quantitativo de vagas ofertadas para início imediato serão convocados(as) para a realização dos exames médicos admissionais, seguindo rigorosamente a ordem de classificação.",
      "Os(as) candidatos(as) integrantes do cadastro de reserva poderão ser convocados(as) à medida que surgirem novas vagas, observados o prazo de validade do processo seletivo e as necessidades operacionais do DSEI Xingu.",
      "Os critérios de desempate foram considerados conforme item 10.4 do edital.",
    ]);
  });
});

describe("textos do edital (regra.documento)", () => {
  it("todos os tipos de lista têm modelo, com título e as duas disposições", () => {
    for (const tipo of ["PRELIMINAR", "ENTREVISTA", "FINAL"])
      for (const fase of ["PRELIMINAR", "FINAL"])
        for (const lista of ["geral", "eliminados"]) {
          const chave = chaveDoModelo(tipo, fase, lista);
          expect(MODELOS_PADRAO[chave], chave).toMatchObject({
            titulo: expect.any(String),
            preliminares: expect.any(String),
            finais: expect.any(String),
          });
          expect(chave.endsWith("_ELIMINADOS")).toBe(lista === "eliminados");
        }
    expect(chaveDoModelo("CONVOCACAO", "FINAL", "geral")).toBe("CONVOCACAO");
    expect(chaveDoModelo("FINAL", null)).toBe("FINAL_FINAL");
    expect(chaveDoModelo("PRELIMINAR", null)).toBe("PRELIMINAR_PRELIMINAR");
  });

  it("o gestor troca título, disposições, edital, local e data; ** vira negrito", () => {
    const regra = {
      ...REGRA_83,
      documento: {
        edital: "83/2026 (retificado)",
        local: "Brasília - DF",
        data: "2026-10-01",
        modelos: {
          FINAL_FINAL: {
            titulo: "RESULTADO {FASE} - PROCESSO SELETIVO - EDITAL {edital}",
            preliminares: "Primeiro item com **destaque**.\n>Subitem.",
            finais: "Único item final.",
          },
        },
      },
    };
    const doc = documentoOficial(retratoDe("FINAL"), {
      regra,
      hoje: new Date("2026-10-05T12:00:00Z"),
    });
    expect(doc.titulo).toEqual([
      "RESULTADO FINAL - PROCESSO SELETIVO - EDITAL 83/2026 (retificado)",
    ]);
    expect(doc.localData).toBe("Brasília - DF, 1º de outubro de 2026.");
    expect(doc.localDataPorExtenso).toBe(
      "Brasília - DF, 1º de outubro de 2026.",
    );
    expect(doc.preliminares).toEqual([
      { nivel: 2, texto: "Primeiro item com **destaque**." },
      { nivel: 3, texto: "Subitem." },
    ]);
    expect(htmlParaSei(doc)).toContain(
      '<p class="Item_Nivel2">Primeiro item com <strong>destaque</strong>.</p>',
    );
    expect(doc.finais.map((i) => i.texto)).toEqual([
      "Único item final.",
      "Os critérios de desempate foram considerados conforme item 10.4 do edital.",
    ]);
  });

  it("normalizarRegra guarda o documento; validarRegra limita o tamanho", () => {
    const r = normalizarRegra({
      documento: {
        processo: "  AGSUS.1/2026-1 ",
        data: "data ruim",
        modelos: {
          FINAL_FINAL: { finais: "  x  ", lixo: "y" },
          "chave inválida": { titulo: "z" },
          ENTREVISTA_FINAL: { titulo: "" },
        },
      },
    });
    expect(r.documento).toEqual({
      edital: "",
      processo: "AGSUS.1/2026-1",
      unidade: "",
      autoridade: "",
      local: "",
      data: null,
      modelos: { FINAL_FINAL: { finais: "x" } },
    });
    // Sem textos próprios, a regra continua igual (sem a chave).
    expect(normalizarRegra({})).not.toHaveProperty("documento");
    expect(documentoDaRegra({}).modelos).toEqual({});
    expect(
      validarRegra({
        documento: { modelos: { FINAL_FINAL: { finais: "x".repeat(10001) } } },
      }).map((e) => e.campo),
    ).toContain("documento");
  });

  it("campos: número do edital, unidade por extenso com o artigo, notas mínimas, data", () => {
    expect(numeroDoEdital("Edital 083/2026 - DSEI Xingu")).toBe("83/2026");
    expect(unidadeDoEdital("DSEI Xingu")).toMatchObject({
      nome: "Distrito Sanitário Especial Indígena Xingu (DSEI Xingu)",
      ao: "ao",
      do: "do",
    });
    expect(unidadeDoEdital("CASAI Brasília")).toMatchObject({
      nome: "Casa de Apoio à Saúde Indígena Brasília (CASAI Brasília)",
      ao: "à",
      do: "da",
    });
    expect(numeroComExtenso(7)).toBe("7 (sete)");
    expect(numeroComExtenso(23)).toBe("23 (vinte e três)");
    expect(numeroComExtenso(7.5)).toBe("7,5");
    expect(textoDasNotasMinimas({ documental: { nota_minima: 1 } })).toBe(
      "1 (um) ponto",
    );
    expect(textoDasNotasMinimas({})).toBe("____ (____) pontos");
    expect(dataPorExtenso("2026-10-02")).toBe("2 de outubro de 2026");
    expect(itensDoTexto(" a \n\n> b\n>> c ")).toEqual([
      { nivel: 2, texto: "a" },
      { nivel: 3, texto: "b" },
      { nivel: 4, texto: "c" },
    ]);
  });
});

/* Lê um ZIP "stored" (sem compressão): nome → bytes. */
function lerZip(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const arquivos = new Map();
  let i = 0;
  while (vista.getUint32(i, true) === 0x04034b50) {
    const tamanho = vista.getUint32(i + 18, true);
    const nome = vista.getUint16(i + 26, true);
    const extra = vista.getUint16(i + 28, true);
    const inicio = i + 30 + nome + extra;
    arquivos.set(
      new TextDecoder().decode(bytes.slice(i + 30, i + 30 + nome)),
      bytes.slice(inicio, inicio + tamanho),
    );
    i = inicio + tamanho;
  }
  return arquivos;
}

describe("DOCX com papel timbrado", () => {
  const doc = documentoOficial(retratoDe("PRELIMINAR"), {
    lista: "geral",
    regra: REGRA_83,
    hoje: new Date("2026-10-02T15:00:00Z"),
  });
  const logo = {
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    largura: 320,
    altura: 160,
  };
  const zip = lerZip(
    gerarDocxOficial(doc, {
      logo,
      cabecalho: CABECALHO_PADRAO,
      quando: new Date("2026-10-02T12:00:00"),
    }),
  );
  const xml = (nome) => new TextDecoder().decode(zip.get(nome));

  it("pacote válido: partes, tipos e relações; todo XML bem formado", () => {
    expect([...zip.keys()]).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "docProps/core.xml",
        "word/document.xml",
        "word/_rels/document.xml.rels",
        "word/header1.xml",
        "word/footer1.xml",
        "word/_rels/header1.xml.rels",
        "word/media/logo.png",
      ]),
    );
    for (const [nome, conteudo] of zip) {
      if (!nome.endsWith(".xml") && !nome.endsWith(".rels")) continue;
      const lido = new DOMParser().parseFromString(
        new TextDecoder().decode(conteudo),
        "application/xml",
      );
      expect(lido.querySelector("parsererror"), nome).toBeNull();
    }
    expect(xml("[Content_Types].xml")).toContain('Extension="png"');
    expect(xml("[Content_Types].xml")).toContain("/word/header1.xml");
    expect(xml("word/_rels/document.xml.rels")).toContain(
      'Target="header1.xml"',
    );
    expect(xml("word/_rels/header1.xml.rels")).toContain(
      'Target="media/logo.png"',
    );
    expect([...zip.get("word/media/logo.png")]).toEqual([...logo.bytes]);
  });

  it("cabeçalho: logo + nome e endereço da agência; rodapé com o nome, o processo e a página", () => {
    const cabecalho = xml("word/header1.xml");
    expect(cabecalho).toContain('r:embed="rIdLogo"');
    expect(cabecalho).toContain('cx="792000" cy="396000"');
    expect(cabecalho).toContain(
      "AGÊNCIA BRASILEIRA DE APOIO À GESTÃO DO SISTEMA ÚNICO DE SAÚDE",
    );
    expect(cabecalho).toContain("SEPN CRN 514, Bloco D");
    const rodape = xml("word/footer1.xml");
    expect(rodape).toContain(
      "Resultado Preliminar - Etapa de Análise Curricular - Classificação Geral · SEI AGSUS.016954/2026-81 / pg. ",
    );
    expect(rodape).toContain(" PAGE ");
  });

  it("corpo: título, itens numerados, vagas e tabelas, data por extenso, sem assinatura", () => {
    const corpo = xml("word/document.xml");
    expect(corpo).toContain(
      '<w:headerReference w:type="default" r:id="rIdCabecalho"/>',
    );
    expect(corpo).toContain(
      '<w:footerReference w:type="default" r:id="rIdRodape"/>',
    );
    expect(corpo).toContain(
      "RESULTADO PRELIMINAR - ETAPA DE ANÁLISE CURRICULAR",
    );
    expect(corpo).toContain(">DISPOSIÇÕES PRELIMINARES<");
    expect(corpo).toContain(">1.5.<");
    expect(corpo).toContain(">2.1.<");
    expect(corpo).toContain(
      "VAGA 169673 - Analista Técnico de Saúde Indígena - DSEI Xingu (Sede) - DSEI Xingu - 1 vaga (1 AC + CR)",
    );
    expect(corpo.match(/<w:tbl>/g)).toHaveLength(3);
    expect(corpo).toContain("Não houve candidatos aptos.");
    expect(corpo).toContain("Brasília, 2 de outubro de 2026.");
    expect(corpo).not.toMatch(/assinado eletronicamente|Diretor/i);
  });

  it("sem logo: só o texto do cabeçalho, sem imagem no pacote", () => {
    const semLogo = lerZip(gerarDocxOficial(doc, { cabecalho: "LINHA ÚNICA" }));
    expect(semLogo.has("word/media/logo.png")).toBe(false);
    const cabecalho = new TextDecoder().decode(semLogo.get("word/header1.xml"));
    expect(cabecalho).toContain("LINHA ÚNICA");
    expect(cabecalho).not.toContain("rIdLogo");
  });
});

describe("prévia (Como fica no SEI)", () => {
  it("timbrado com o logo e o cabeçalho, o HTML do SEI e o aviso do que o SEI põe", () => {
    const doc = documentoOficial(retratoDe("PRELIMINAR"), {
      lista: "geral",
      regra: REGRA_83,
    });
    const pagina = paginaDaPrevia(doc, {
      cabecalho: "AGÊNCIA X\nRua Y",
      logo: "/assets/agsus-logo.webp",
    });
    const lida = new DOMParser().parseFromString(pagina, "text/html");
    expect(lida.querySelector(".timbrado img").getAttribute("src")).toBe(
      "/assets/agsus-logo.webp",
    );
    expect(
      [...lida.querySelectorAll(".timbrado p")].map((p) => p.textContent),
    ).toEqual(["AGÊNCIA X", "Rua Y"]);
    expect(lida.querySelector("style").textContent).toContain(
      'content: counter(item-n1) "." counter(item-n2) "."',
    );
    expect(lida.querySelectorAll("table")).toHaveLength(3);
    expect(lida.querySelector(".posto-pelo-sei").textContent).toContain(
      "SEI AGSUS.016954/2026-81 / pg. N",
    );
    expect(lida.querySelector("script")).toBeNull();
    // Endereço de logo estranho não entra.
    expect(paginaDaPrevia(doc, { logo: 'javascript:alert(1)"' })).not.toContain(
      "<img",
    );
  });
});
