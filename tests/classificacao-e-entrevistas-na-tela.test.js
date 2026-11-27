// @vitest-environment jsdom
import { bloco } from "./apoio/bloco.ts";
import { readFileSync } from "node:fs";
import { describe, expect, it, afterEach, vi, beforeEach } from "vitest";
import { instantaneoDaLista } from "../src/lib/classificacao/exportacao.ts";
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
  textoDaComposicao,
  textoDasNotasMinimas,
  textoParaSei,
  trechos,
  unidadeDoEdital,
  houveDesempate,
  NOTA_DE_DESEMPATE_PADRAO,
  notaDeDesempatePadrao,
} from "../src/lib/classificacao/documento-sei.ts";
import {
  gerarDocxOficial,
  corpoXml,
} from "../src/lib/classificacao/documento-docx.ts";
import { classificar } from "../src/lib/classificacao/motor.ts";
import {
  documentoDaRegra,
  normalizarRegra,
  validarRegra,
} from "../src/lib/classificacao/regra.ts";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import {
  clicar,
  digitar,
  esperar,
  escolher,
  teclar,
} from "./componentes/interacoes.ts";
import { criarEstadoDaClassificacao } from "../src/modulos/classificacao/estado.ts";
import {
  definirAreaAtual,
  redefinirDadosDoMonitoramento,
  publicarErroDoMonitoramento,
  publicarLinhasDoMonitoramento,
} from "../src/componentes/dados-do-monitoramento.ts";
import {
  calcularClassificacao,
  criarClassificacao,
} from "../src/modulos/classificacao/classificacao.tsx";
import { ordemDoSorteio } from "../src/lib/classificacao/sorteio.ts";
import { retratoDaClassificacao } from "../src/lib/classificacao/dados-do-estado.ts";
import { montarRegrasDoEdital } from "./componentes/montar-regras-do-edital.ts";
import { montarTela } from "./montar-tela.ts";
import {
  consumirPedidoDeFiltro,
  pedirFiltro,
} from "../src/app/pedido-de-filtro.ts";
import { ContextoDoApp } from "../src/app/contexto-do-app.ts";
import { ESTADO_INICIAL_DA_NAVEGACAO } from "../src/app/navegacao.ts";
import { registrarTelas } from "../src/app/registro-das-telas.ts";
import { Blob as BlobDoNode } from "node:buffer";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "../src/modulos/classificacao/documento-no-navegador.ts";
import { aberturaPelasChamadasDeAntes } from "./componentes/abertura-dos-aprovados.ts";
import { compactarCandidatos } from "./componentes/candidatos-compactos-falsos.ts";
import { criarEstadoDaListaDeAprovados } from "../src/modulos/aprovados/estado.ts";

/*
  A tela com o perfil de quem entrou no contexto do app (`pecas.perfil`, como
  src/main.ts entrega): o "Ver em Convocações" lê o perfil dali.
*/
function comPerfilDoApp(criar, perfil) {
  const navegacao = {
    obter: () => ESTADO_INICIAL_DA_NAVEGACAO,
    assinar: () => () => {},
    esquecerEditalEVisao: () => {},
    abrirRegrasDoEdital: () => false,
    fecharRegrasDoEdital: () => {},
    voltarDaPaginaDoEdital: () => false,
    irParaInicio: () => {},
  };
  const pecas = { perfil: { obter: () => perfil, assinar: () => () => {} } };
  return (opcoes) => {
    const controlador = criar(opcoes);
    return {
      ...controlador,
      conteudo: createElement(
        ContextoDoApp.Provider,
        { value: { navegacao, avisar: () => {}, pecas } },
        controlador.conteudo,
      ),
    };
  };
}
const PERFIL_COM_CONVOCACOES = {
  perfil: "usuario",
  permissoes: {
    aprovados: "leitor",
    entrevistas: "editor",
    classificacao: "leitor",
  },
};

bloco("lib/classificacao-documento-sei", () => {
  /*
  O documento oficial (SEI) bate com as publicações do edital 83/2026 (DSEI
  Xingu, processo AGSUS.016954/2026-81): resultado preliminar da análise
  curricular (SEI 0641561), resultado final da entrevista (0736888),
  resultado final do processo seletivo (0739164) e convocação para entrevista
  (0663011) — títulos, textos das disposições, cabeçalhos das vagas, colunas,
  linhas e "Não houve candidatos aptos.". E o .docx com papel timbrado.
*/

  const SEED = readFileSync(
    "tests/fixtures/sql-de-dados/20261002-regras-de-classificacao-83-e-100.sql",
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
  const cand = (
    vaga,
    cargo,
    nome,
    [doc, form, cur, exp, etn],
    campos = {},
  ) => ({
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

    it("todas as vagas, com o cabeçalho publicado, colunas (padrão enxuto) e linhas", () => {
      expect(doc.blocos.map((b) => b.cabecalho)).toEqual([
        "VAGA 169672 - Agente de Combate a Endemias - Área de abrangência DSEI Xingu - DSEI Xingu - 1 vaga (1 AC + CR)",
        "VAGA 169673 - Analista Técnico de Saúde Indígena - DSEI Xingu (Sede) - DSEI Xingu - 1 vaga (1 AC + CR)",
        "VAGA - Apoiador Técnico de Saneamento - DSEI Xingu (Sede) - DSEI Xingu - Cadastro Reserva",
      ]);
      const [t] = doc.blocos[1].tabelas;
      // As parciais da regra ficam disponíveis, desmarcadas (colunas-do-documento.js).
      expect(rotulos(t)).toEqual(["Classificação", "Nome", "Nota Final"]);
      expect(t.linhas).toEqual([
        ["1º", "Laucio Ambrosio Lorenço", "21,4"],
        ["2º", "Deysiane Teodoro", "20,7"],
        ["3º", "Aliel Alexandrino", "14,6"],
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
      // A data fica no modelo do Comunicado do SEI; colada, saía duas vezes.
      expect(html).not.toContain("na data da assinatura digital");
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
      expect(
        classes("Item_Nivel2")[0].querySelector("strong").textContent,
      ).toBe("Agência Brasileira de Apoio à Gestão do SUS (AgSUS)");
      const vagas = [
        ...pagina.querySelectorAll("p.Texto_Centralizado > strong"),
      ];
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
      // Classificação e nota ao centro; nome e modalidade à esquerda.
      const indice = (rotulo) =>
        rotulos(doc.blocos[1].tabelas[0]).indexOf(rotulo);
      const classeDa = (rotulo) =>
        tabelas[1].querySelectorAll("tr:nth-child(2) p")[indice(rotulo)]
          .className;
      expect(classeDa("Classificação")).toBe("Tabela_Texto_Centralizado");
      expect(classeDa("Nome")).toBe("Tabela_Texto_Alinhado_Esquerda");
      expect(classeDa("Nota Final")).toBe("Tabela_Texto_Centralizado");
      // O título pode quebrar (Modalidade de Concorrência em duas linhas) e as
      // larguras seguem o modelo: Nome com o resto.
      expect(cabeca.querySelector("td").getAttribute("style")).not.toContain(
        "white-space:nowrap",
      );
      expect(
        [...cabeca.querySelectorAll("td")].map(
          (td) => td.getAttribute("style").match(/width:(\d+)%/)[1],
        ),
      ).toEqual(["12", "76", "12"]);
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
      expect(texto).toContain("Classificação\tNome\tNota Final");
      expect(texto).toContain("1º\tLaucio Ambrosio Lorenço\t21,4");
      expect(texto.join("\n")).not.toContain("**");
    });
  });

  describe("colunas escolhidas pelo gestor (regra.documento.colunas)", () => {
    const retrato = retratoDe("PRELIMINAR");
    const comColunas = (colunas) => ({
      ...REGRA_83,
      documento: { ...REGRA_83.documento, colunas },
    });

    it("as parciais marcadas, na ordem escolhida, em todas as saídas", () => {
      const doc = documentoOficial(retrato, {
        lista: "geral",
        regra: comColunas({
          PRELIMINAR_PRELIMINAR: [
            "NOME",
            "CLASSIFICACAO",
            "PARCIAL_EXPERIENCIA",
            "NOTA",
          ],
        }),
      });
      const [t] = doc.blocos[1].tabelas;
      expect(rotulos(t)).toEqual([
        "Nome",
        "Classificação",
        "Experiência Profissional",
        "Nota Final",
      ]);
      expect(t.linhas[0]).toEqual([
        "Laucio Ambrosio Lorenço",
        "1º",
        "6,4",
        "21,4",
      ]);
      expect(t.colunas.reduce((s, c) => s + c.largura, 0)).toBe(100);
      expect(textoParaSei(doc)).toContain(
        "Nome\tClassificação\tExperiência Profissional\tNota Final",
      );
      expect(htmlParaSei(doc)).toContain("Experiência Profissional");
      const docx = new TextDecoder().decode(
        gerarDocxOficial(doc, { cabecalho: "AGÊNCIA" }),
      );
      expect(docx).toContain("Experiência Profissional");
      expect(docx).not.toContain("Formação Acadêmica");
    });

    it("Classificação e Nome são obrigatórias; códigos desconhecidos são ignorados", () => {
      const doc = documentoOficial(retrato, {
        lista: "geral",
        regra: comColunas({ PRELIMINAR_PRELIMINAR: ["NOTA", "INSCRICAO"] }),
      });
      expect(rotulos(doc.blocos[1].tabelas[0])).toEqual([
        "Classificação",
        "Nome",
        "Nota Final",
      ]);
    });

    it("a escolha vale só para a publicação dela (os eliminados seguem o padrão)", () => {
      const regra = comColunas({
        PRELIMINAR_PRELIMINAR: ["CLASSIFICACAO", "NOME"],
      });
      const geral = documentoOficial(retrato, { lista: "geral", regra });
      expect(rotulos(geral.blocos[1].tabelas[0])).toEqual([
        "Classificação",
        "Nome",
      ]);
      const eliminados = documentoOficial(retrato, {
        lista: "eliminados",
        regra,
      });
      expect(rotulos(eliminados.blocos[1].tabelas[0])).toEqual([
        "Nome",
        "Nota Final",
        "Justificativa",
      ]);
    });

    it("eliminados com parcial: a Justificativa fica no fim", () => {
      const doc = documentoOficial(retrato, {
        lista: "eliminados",
        regra: comColunas({
          PRELIMINAR_PRELIMINAR_ELIMINADOS: ["NOME", "PARCIAL_FORMACAO"],
        }),
      });
      const [t] = doc.blocos[1].tabelas;
      expect(rotulos(t)).toEqual([
        "Nome",
        "Formação Acadêmica",
        "Justificativa",
      ]);
      expect(t.linhas[0][1]).toBe("0,0");
    });

    it("resultado final: a Situação (dentro das vagas ou cadastro reserva) é opcional", () => {
      const doc = documentoOficial(retratoDe("FINAL"), {
        lista: "geral",
        regra: comColunas({
          FINAL_FINAL: ["CLASSIFICACAO", "NOME", "NOTA", "SITUACAO"],
        }),
      });
      const [t] = doc.blocos[0].tabelas;
      expect(rotulos(t)).toEqual([
        "CLASSIFICAÇÃO",
        "NOME",
        "NOTA FINAL",
        "SITUAÇÃO",
      ]);
      expect(t.linhas[0][3]).toBe("Dentro das vagas");
    });

    it("a convocação tem colunas fixas", () => {
      const doc = documentoOficial(retratoDe("CONVOCACAO"), {
        lista: "geral",
        regra: comColunas({ CONVOCACAO: ["NOME"] }),
      });
      expect(rotulos(doc.blocos[0].tabelas[0])).toEqual([
        "Nº",
        "NOME",
        "Vaga",
        "DATA",
        "HORA",
      ]);
    });

    it("normalizarRegra guarda as colunas por publicação, sem repetir nem lixo", () => {
      const r = normalizarRegra({
        documento: {
          colunas: {
            PRELIMINAR_PRELIMINAR: ["NOME", "NOME", "nota", "PARCIAL_CURSOS"],
            "chave inválida": ["NOME"],
            FINAL_FINAL: [],
            ENTREVISTA_FINAL: "NOME",
          },
        },
      });
      expect(r.documento.colunas).toEqual({
        PRELIMINAR_PRELIMINAR: ["NOME", "PARCIAL_CURSOS"],
      });
      expect(
        normalizarRegra({ documento: { colunas: {} } }),
      ).not.toHaveProperty("documento");
    });
  });

  describe("eliminados, modalidades e fase final da análise curricular", () => {
    const retrato = retratoDe("PRELIMINAR");

    it("eliminados: Nome | Nota Final | Justificativa, texto dos eliminados", () => {
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
      expect(rotulos(t)).toEqual(["Nome", "Nota Final", "Justificativa"]);
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

    it("com a agenda das entrevistas salva, DATA e HORA saem preenchidas (e no DOCX); sem horário, em branco", () => {
      const agenda = new Map([
        [krumare.analise_id, { data: "2026-10-06", inicio: "08:30", banca: 2 }],
      ]);
      const comAgenda = documentoOficial(retratoDe("CONVOCACAO"), {
        lista: "geral",
        regra: REGRA_83,
        agenda,
      });
      const [t] = comAgenda.blocos[0].tabelas;
      // O modelo publicado não tem coluna de banca: as colunas não mudam.
      expect(rotulos(t)).toEqual(["Nº", "NOME", "Vaga", "DATA", "HORA"]);
      expect(t.linhas[0].slice(-2)).toEqual(["06/10/2026", "08:30"]);
      expect(t.linhas[1].slice(-2)).toEqual(["", ""]);
      expect(htmlParaSei(comAgenda)).toContain("06/10/2026");
      const docx = new TextDecoder().decode(
        gerarDocxOficial(comAgenda, { cabecalho: "AGÊNCIA" }),
      );
      expect(docx).toContain("06/10/2026");
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
      const doc = documentoOficial(retratoDe("FINAL"), {
        lista: "geral",
        regra,
      });
      expect(doc.titulo).toEqual(["RESULTADO FINAL - PROCESSO SELETIVO"]);
      expect(semMarcas(doc.preliminares[0].texto)).toBe(
        "A Agência Brasileira de Apoio à Gestão do SUS (AgSUS), por intermédio da Diretoria de Atenção Integral à Saúde, no uso das atribuições que lhe foram conferidas pela Designação nº 28/2026/PRES/AgSUS, em conformidade com o Edital nº 83/2026, referente ao Distrito Sanitário Especial Indígena Xingu (DSEI XINGU), no exercício de seu compromisso institucional com a transparência, responsabilidade e adequada condução de seus certames, torna público o Resultado Final do Processo Seletivo, conforme previsto no item 10 do referido Edital.",
      );
      // A conta sai da composição da regra (antes, "soma… até 30… até 20" fixo).
      expect(doc.preliminares[1].texto).toBe(
        "A nota final do processo seletivo é a soma da nota da análise curricular e da nota da entrevista.",
      );
      expect(rotulos(doc.blocos[0].tabelas[0])).toEqual([
        "CLASSIFICAÇÃO",
        "NOME",
        "NOTA FINAL",
      ]);
      expect(
        doc.blocos[0].tabelas[0].colunas.map((c) => c.alinhamento),
      ).toEqual(["centro", "centro", "centro"]);
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
        "A nota final é a soma da nota da análise curricular e da nota da entrevista.",
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
        desempate: "",
        data: null,
        modelos: { FINAL_FINAL: { finais: "x" } },
        colunas: {},
      });
      // Sem textos próprios, a regra continua igual (sem a chave).
      expect(normalizarRegra({})).not.toHaveProperty("documento");
      expect(documentoDaRegra({}).modelos).toEqual({});
      expect(
        validarRegra({
          documento: {
            modelos: { FINAL_FINAL: { finais: "x".repeat(10001) } },
          },
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
    const vista = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength,
    );
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
      // Sem rodapé de página: "título / pg. N" quem põe é o SEI.
      expect(zip.has("word/footer1.xml")).toBe(false);
    });

    it("corpo: título, itens numerados, vagas e tabelas, data por extenso, sem assinatura", () => {
      const corpo = xml("word/document.xml");
      expect(corpo).toContain(
        '<w:headerReference w:type="default" r:id="rIdCabecalho"/>',
      );
      expect(corpo).not.toContain("footerReference");
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
      const semLogo = lerZip(
        gerarDocxOficial(doc, { cabecalho: "LINHA ÚNICA" }),
      );
      expect(semLogo.has("word/media/logo.png")).toBe(false);
      const cabecalho = new TextDecoder().decode(
        semLogo.get("word/header1.xml"),
      );
      expect(cabecalho).toContain("LINHA ÚNICA");
      expect(cabecalho).not.toContain("rIdLogo");
    });
  });

  describe("prévia (Como fica no SEI)", () => {
    it("timbrado com o logo e o cabeçalho e o HTML do SEI, sem a linha de assinatura e rodapé", () => {
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
      // Sem a linha de assinatura/rodapé: quem põe é o SEI, a prévia não avisa.
      expect(lida.querySelector(".posto-pelo-sei")).toBeNull();
      expect(pagina).not.toMatch(/postos? pelo SEI|pg\. N/);
      expect(lida.querySelector("script")).toBeNull();
      // Endereço de logo estranho não entra.
      expect(
        paginaDaPrevia(doc, { logo: 'javascript:alert(1)"' }),
      ).not.toContain("<img");
    });
  });

  describe("a conta da nota final no resultado final", () => {
    const comPesos = (pesos) =>
      normalizarRegra({
        composicao: {
          componentes: pesos.map(([codigo, peso]) => ({ codigo, peso })),
          casas: 2,
        },
      });

    it("sai da composição da regra: média, soma ou porcentagem de cada nota", () => {
      expect(
        textoDaComposicao(
          comPesos([
            ["DOCUMENTAL", 0.5],
            ["ENTREVISTA", 0.5],
          ]),
        ),
      ).toBe(
        "A nota final é a média aritmética da nota da análise curricular e da nota da entrevista.",
      );
      expect(
        textoDaComposicao(
          comPesos([
            ["DOCUMENTAL", 1],
            ["ENTREVISTA", 1],
          ]),
        ),
      ).toBe(
        "A nota final é a soma da nota da análise curricular e da nota da entrevista.",
      );
      expect(
        textoDaComposicao(
          comPesos([
            ["DOCUMENTAL", 0.6],
            ["ENTREVISTA", 0.4],
          ]),
        ),
      ).toBe(
        "A nota final é a soma de 60% da nota da análise curricular e 40% da nota da entrevista.",
      );
      expect(
        textoDaComposicao(
          comPesos([
            ["DOCUMENTAL", 1],
            ["ENTREVISTA", 0],
          ]),
        ),
      ).toBe("");
      expect(textoDaComposicao(comPesos([["DOCUMENTAL", 1]]))).toBe("");
    });
  });

  describe("a conta da nota final nos textos padrão", () => {
    const regra = (pesos) => ({
      composicao: {
        componentes: pesos.map(([codigo, peso]) => ({ codigo, peso })),
        casas: 2,
      },
    });
    const final = {
      tipo: "FINAL",
      edital: { edital: "93/2026" },
      modalidades: [],
      vagas: [],
    };

    it("o resultado final diz a conta da regra no item de abertura, uma vez só", () => {
      const doc = documentoOficial(final, {
        lista: "geral",
        regra: regra([
          ["DOCUMENTAL", 0.5],
          ["ENTREVISTA", 0.5],
        ]),
      });
      const textos = [...doc.preliminares, ...doc.finais].map((i) => i.texto);
      expect(textos).toContain(
        "A nota final do processo seletivo é a média aritmética da nota da análise curricular e da nota da entrevista.",
      );
      expect(textos.join(" ")).not.toMatch(/até 30 pontos|até 20 pontos/);
      expect(textos.filter((x) => /nota final .*é a/.test(x))).toHaveLength(1);
    });

    it("sem conta a explicar (um componente só), o item sai", () => {
      const doc = documentoOficial(final, {
        lista: "geral",
        regra: regra([["DOCUMENTAL", 1]]),
      });
      const textos = [...doc.preliminares, ...doc.finais].map((i) => i.texto);
      expect(
        textos.some((x) => /nota final do processo seletivo é/.test(x)),
      ).toBe(false);
      expect(textos.every((x) => x.trim())).toBe(true);
    });

    it("o resultado final da entrevista também deixa o 'até 30 / até 20' fixo", () => {
      const doc = documentoOficial(
        { ...final, tipo: "ENTREVISTA" },
        {
          lista: "geral",
          fase: "FINAL",
          regra: regra([
            ["DOCUMENTAL", 0.5],
            ["ENTREVISTA", 0.5],
          ]),
        },
      );
      const textos = doc.finais.map((i) => i.texto).join(" ");
      expect(textos).toContain(
        "nota final do processo seletivo, que é a média aritmética da nota da análise curricular e da nota da entrevista.",
      );
      expect(textos).not.toMatch(/até 30 pontos/);
    });
  });
});

bloco("lib/classificacao-nota-de-desempate", () => {
  /*
  A nota de desempate logo abaixo de cada tabela (a geral ou a de uma cota)
  em que dois com a mesma nota ficaram em posições diferentes (empate
  resolvido por critério ou pelo empate final), na prévia, no HTML do SEI, no
  texto e no DOCX. Tabela sem empate: sem nota. Regra sem rodapé: sem nota.
*/

  const RODAPE =
    "Os critérios de desempate foram considerados conforme item 10.1 do edital.";
  const NOTA = `*${RODAPE}`;

  const linha = (posicao, nome, nota, modalidades = ["AC"]) => ({
    posicao,
    analise_id: nome,
    nome,
    nota,
    modalidades,
    situacao: "VAGA",
  });

  const retrato = (
    tipo,
    { rodape = RODAPE, vagas, modalidades = [] } = {},
  ) => ({
    schema: 1,
    tipo,
    edital: { id: "e1", edital: "Edital 50/2026", unidade: "DSEI Xingu" },
    casas: 2,
    rodape,
    modalidades,
    vagas: vagas || [
      {
        codigo: "101",
        cabecalho: "VAGA 101 - Enfermeiro",
        // 40 e 40 em 1º e 2º: o empate foi resolvido pelos critérios.
        geral: [linha(1, "Ana", 40), linha(2, "Bia", 40), linha(3, "Caio", 30)],
        listas: {},
        eliminados: [],
      },
      {
        codigo: "102",
        cabecalho: "VAGA 102 - Técnico",
        geral: [linha(1, "Duda", 41), linha(2, "Edu", 39)],
        listas: {},
        eliminados: [],
      },
    ],
  });

  /* Vaga com a geral e duas cotas: empate na geral e na PcD; PN sem empate. */
  const comCotas = (rodape = RODAPE) =>
    retrato("PRELIMINAR", {
      rodape,
      modalidades: [
        { codigo: "PCD", nome: "Pessoas com Deficiência" },
        { codigo: "PN", nome: "Pretos e Pardos" },
      ],
      vagas: [
        {
          codigo: "201",
          cabecalho: "VAGA 201 - Médico",
          geral: [
            linha(1, "Ana", 40, ["AC", "PCD"]),
            linha(2, "Bia", 40, ["AC", "PCD"]),
            linha(3, "Caio", 30, ["AC", "PN"]),
            linha(4, "Davi", 20, ["AC", "PN"]),
          ],
          listas: {
            PCD: [
              linha(1, "Ana", 40, ["AC", "PCD"]),
              linha(2, "Bia", 40, ["AC", "PCD"]),
            ],
            PN: [
              linha(1, "Caio", 30, ["AC", "PN"]),
              linha(2, "Davi", 20, ["AC", "PN"]),
            ],
          },
          eliminados: [],
        },
      ],
    });

  const notas = (doc) =>
    doc.blocos.map((b) => b.tabelas.map((t) => t.notaDeDesempate || ""));

  describe("houveDesempate", () => {
    it("mesma nota em posições diferentes; empate na mesma posição não conta", () => {
      expect(houveDesempate([linha(1, "A", 40), linha(2, "B", 40)])).toBe(true);
      expect(houveDesempate([linha(1, "A", 40), linha(1, "B", 40)])).toBe(
        false,
      );
      expect(houveDesempate([linha(1, "A", 41), linha(2, "B", 40)])).toBe(
        false,
      );
      // Na escala das casas publicadas (como o motor agrupa).
      expect(
        houveDesempate([linha(1, "A", 7.501), linha(2, "B", 7.499)], 2),
      ).toBe(true);
      expect(houveDesempate([])).toBe(false);
    });
  });

  describe("nota de desempate abaixo da tabela com empate", () => {
    it("tabela com empate resolvido leva a nota; tabela sem empate, não", () => {
      const doc = documentoOficial(retrato("FINAL"), { lista: "geral" });
      expect(notas(doc)).toEqual([[NOTA], [""]]);
      expect(NOTA_DE_DESEMPATE_PADRAO).toBe(
        "*Os critérios de desempate foram considerados conforme item 10 do referido edital.",
      );

      const html = htmlParaSei(doc);
      expect(html.match(/critérios de desempate/g)).toHaveLength(1);
      // Logo abaixo da tabela da vaga 101, antes do cabeçalho da 102, em itálico e menor.
      const nota = html.indexOf(
        '<p class="Texto_Alinhado_Esquerda"><span style="font-size:10pt"><em>*Os critérios de desempate',
      );
      expect(nota).toBeGreaterThan(html.indexOf("VAGA 101"));
      expect(html.lastIndexOf("</table>", nota)).toBeGreaterThan(
        html.indexOf("Caio"),
      );
      expect(nota).toBeLessThan(html.indexOf("VAGA 102"));
      // Sem asterisco nas linhas dos desempatados.
      expect(html).not.toMatch(/\*(Ana|Bia)|(Ana|Bia)\*|1º\*|2º\*/);

      const texto = textoParaSei(doc).split("\n");
      const i = texto.indexOf(NOTA);
      expect(texto[i - 1]).toContain("Caio");
    });

    it("cota com empate: a nota logo abaixo da geral e da cota com empate; a cota sem empate fica sem", () => {
      const doc = documentoOficial(comCotas(), { lista: "todas" });
      expect(notas(doc)).toEqual([[NOTA, NOTA, ""]]);
      const html = htmlParaSei(doc);
      expect(html.match(/critérios de desempate/g)).toHaveLength(2);
      const tabelas = [...html.matchAll(/<\/table>/g)].map((m) => m.index);
      const nas = [...html.matchAll(/<em>\*Os critérios/g)].map((m) => m.index);
      // A 1ª nota entre a tabela geral e a PcD; a 2ª entre a PcD e a PN.
      expect(nas[0]).toBeGreaterThan(tabelas[0]);
      expect(nas[0]).toBeLessThan(html.indexOf("Pessoas com Deficiência"));
      expect(nas[1]).toBeGreaterThan(tabelas[1]);
      expect(nas[1]).toBeLessThan(html.indexOf("Pretos e Pardos"));

      // Só a lista da cota: a nota abaixo dela.
      expect(notas(documentoOficial(comCotas(), { lista: "PCD" }))).toEqual([
        [NOTA],
      ]);
      expect(notas(documentoOficial(comCotas(), { lista: "PN" }))).toEqual([
        [""],
      ]);
    });

    it("regra sem rodapé (e sem texto do edital): nenhuma nota", () => {
      expect(notaDeDesempatePadrao("")).toBe("");
      const doc = documentoOficial(comCotas(""), { lista: "todas" });
      expect(notas(doc)).toEqual([["", "", ""]]);
      expect(htmlParaSei(doc)).not.toContain("critérios de desempate");
      expect(textoParaSei(doc)).not.toContain("critérios de desempate");
      expect(corpoXml(doc)).not.toContain("critérios de desempate");
    });

    it("vale na avaliação documental (preliminar) e na entrevista com critérios", () => {
      for (const tipo of ["PRELIMINAR", "ENTREVISTA"]) {
        const doc = documentoOficial(retrato(tipo), { lista: "geral" });
        expect(notas(doc)).toEqual([[NOTA], [""]]);
      }
    });

    it("empate na mesma posição (entrevista sem critérios) não leva a nota", () => {
      const doc = documentoOficial(
        retrato("ENTREVISTA", {
          vagas: [
            {
              codigo: "101",
              cabecalho: "VAGA 101",
              geral: [linha(1, "Ana", 12), linha(1, "Bia", 12)],
              listas: {},
              eliminados: [],
            },
          ],
        }),
        { lista: "geral" },
      );
      expect(notas(doc)).toEqual([[""]]);
      expect(htmlParaSei(doc)).not.toContain("critérios de desempate");
    });

    it("os eliminados e a convocação não levam a nota", () => {
      expect(
        notas(
          documentoOficial(retrato("FINAL"), { lista: "eliminados" }),
        ).flat(),
      ).not.toContain(NOTA);
      expect(
        notas(
          documentoOficial(retrato("CONVOCACAO"), { lista: "todas" }),
        ).flat(),
      ).not.toContain(NOTA);
    });

    it("o texto personalizado do edital aparece no lugar do padrão", () => {
      const regra = {
        documento: {
          desempate: "*Desempate conforme o item 9.4 do Edital nº {edital}.",
        },
      };
      expect(documentoDaRegra(regra).desempate).toBe(
        "*Desempate conforme o item 9.4 do Edital nº {edital}.",
      );
      const doc = documentoOficial(retrato("FINAL"), { lista: "geral", regra });
      expect(notas(doc)[0][0]).toBe(
        "*Desempate conforme o item 9.4 do Edital nº 50/2026.",
      );
      expect(htmlParaSei(doc)).toContain(
        "<em>*Desempate conforme o item 9.4 do Edital nº 50/2026.</em>",
      );
      expect(htmlParaSei(doc)).not.toContain("item 10 do referido edital");
    });

    it("o rodapé da regra com a frase do desempate é o padrão e não se repete no fim", () => {
      const rodape =
        "Os critérios de desempate foram considerados conforme item 10.4 do edital.";
      expect(notaDeDesempatePadrao(rodape)).toBe(`*${rodape}`);
      expect(notaDeDesempatePadrao("Outro texto qualquer.")).toBe(
        NOTA_DE_DESEMPATE_PADRAO,
      );
      const doc = documentoOficial(retrato("FINAL", { rodape }), {
        lista: "geral",
        regra: { rodape },
      });
      expect(notas(doc)[0][0]).toBe(`*${rodape}`);
      expect(doc.finais.map((i) => i.texto)).not.toContain(rodape);

      // Sem nenhuma tabela com empate, o rodapé segue no fim do resultado final.
      const semEmpate = documentoOficial(
        retrato("FINAL", {
          rodape,
          vagas: [retrato("FINAL").vagas[1]],
        }),
        { lista: "geral", regra: { rodape } },
      );
      expect(semEmpate.finais.map((i) => i.texto)).toContain(rodape);
    });

    it("o DOCX inclui a nota em itálico logo abaixo de cada tabela com empate", () => {
      const doc = documentoOficial(retrato("FINAL"), { lista: "geral" });
      const xml = corpoXml(doc);
      expect(xml.match(/critérios de desempate/g)).toHaveLength(1);
      const nota = xml.indexOf("*Os critérios de desempate");
      expect(xml.lastIndexOf("<w:i/>", nota)).toBeGreaterThan(
        xml.lastIndexOf("</w:tbl>", nota),
      );
      expect(nota).toBeGreaterThan(xml.indexOf("Caio"));
      expect(nota).toBeLessThan(xml.indexOf("VAGA 102"));
      const lido = new DOMParser().parseFromString(xml, "application/xml");
      expect(lido.querySelector("parsererror")).toBeNull();

      const cotas = corpoXml(documentoOficial(comCotas(), { lista: "todas" }));
      const nas = [...cotas.matchAll(/\*Os critérios de desempate/g)].map(
        (m) => m.index,
      );
      expect(nas).toHaveLength(2);
      expect(nas[0]).toBeLessThan(cotas.indexOf("Pessoas com Deficiência"));
      expect(nas[1]).toBeGreaterThan(cotas.indexOf("Pessoas com Deficiência"));
      expect(nas[1]).toBeLessThan(cotas.indexOf("Pretos e Pardos"));
    });
  });
});

bloco("modulos/classificacao-hora-de-nascimento", async () => {
  /*
  A hora de nascimento da certidão na explicação do candidato (Classificação):
  o campo só aparece quando decide (empate na idade com a mesma data) ou já
  foi informado; quem só lê vê a hora; salvar chama
  salvar_hora_nascimento_candidato e o candidato nos dados recebe a hora.
*/

  const { HoraDeNascimento } =
    await import("../src/modulos/classificacao/hora-de-nascimento.tsx");

  let raiz;
  let montagem;
  async function montar(props) {
    raiz = document.createElement("div");
    document.body.append(raiz);
    montagem = createRoot(raiz);
    await act(async () =>
      montagem.render(createElement(HoraDeNascimento, props)),
    );
    await esperar();
  }
  afterEach(async () => {
    await act(async () => montagem?.unmount());
    raiz?.remove();
  });

  describe("HoraDeNascimento", () => {
    it("não aparece quando a hora não decide e não foi informada", async () => {
      await montar({
        horaNascimento: null,
        horaDecide: false,
        podeEditar: true,
        aoSalvar: vi.fn(),
      });
      expect(raiz.textContent).toBe("");
    });

    it("no empate: campo com a dica de 23h59min59s; salvar manda HH:MM:SS", async () => {
      const aoSalvar = vi.fn(async () => true);
      await montar({
        horaNascimento: null,
        horaDecide: true,
        podeEditar: true,
        aoSalvar,
      });
      expect(raiz.textContent).toContain("Hora de nascimento (certidão)");
      expect(raiz.textContent).toContain("Sem certidão: 23h59min59s.");
      const salvar = raiz.querySelector("[data-acao='salvar-hora']");
      expect(salvar.disabled).toBe(true);
      await digitar(
        raiz.querySelector("[data-campo='hora-de-nascimento']"),
        "07:30",
      );
      expect(salvar.disabled).toBe(false);
      await clicar(salvar);
      expect(aoSalvar).toHaveBeenCalledWith("07:30:00");
    });

    it("hora já informada: tirar volta a 23h59min59s; leitor só vê", async () => {
      const aoSalvar = vi.fn(async () => true);
      await montar({
        horaNascimento: "07:30:00",
        horaDecide: false,
        podeEditar: true,
        aoSalvar,
      });
      await clicar(raiz.querySelector("[data-acao='tirar-hora']"));
      expect(aoSalvar).toHaveBeenCalledWith("");
      await act(async () => montagem.unmount());
      raiz.remove();
      await montar({
        horaNascimento: "07:30:00",
        horaDecide: true,
        podeEditar: false,
        aoSalvar,
      });
      expect(raiz.querySelector("input")).toBeNull();
      expect(raiz.textContent).toContain("07h30min00s");
    });
  });

  describe("estado.salvarHoraDeNascimento", () => {
    it("chama a RPC e põe a hora no candidato dos dados", async () => {
      const rpc = vi.fn(async (nome, args) => {
        if (nome === "listar_editais_classificacao")
          return {
            data: {
              editais: [{ id: "e93", edital: "93/2026" }],
              pode_editar: true,
            },
            error: null,
          };
        if (nome === "obter_classificacao_do_edital")
          return {
            data: {
              edital: { id: "e93" },
              pode_editar: true,
              candidatos: [{ analise_id: "a1" }, { analise_id: "a2" }],
            },
            error: null,
          };
        if (nome === "salvar_hora_nascimento_candidato")
          return {
            data: {
              analise_id: args.p_analise,
              hora_nascimento: args.p_hora ? "07:30:00" : null,
              mudou: true,
            },
            error: null,
          };
        return { data: [], error: null };
      });
      const toast = vi.fn();
      const estado = criarEstadoDaClassificacao({ supabase: { rpc }, toast });
      await estado.carregar("projetos");
      await estado.escolherEdital("e93");
      expect(await estado.salvarHoraDeNascimento("a2", "07:30")).toBe(true);
      expect(rpc).toHaveBeenCalledWith("salvar_hora_nascimento_candidato", {
        p_edital: "e93",
        p_analise: "a2",
        p_hora: "07:30",
      });
      expect(estado.obter().dados.candidatos).toEqual([
        { analise_id: "a1" },
        { analise_id: "a2", hora_nascimento: "07:30:00" },
      ]);
      await estado.salvarHoraDeNascimento("a2", "");
      expect(estado.obter().dados.candidatos[1].hora_nascimento).toBeNull();
      expect(toast).toHaveBeenLastCalledWith(
        "Hora de nascimento retirada: vale 23h59min59s.",
        "success",
      );
    });
  });
});

bloco("modulos/classificacao", () => {
  /*
  A tela de Classificação como módulo do app (src/modulos/classificacao/):
  monta na `#page-classificacao`, carrega os editais da área atual ao abrir,
  troca de edital, mostra as listas calculadas pelo motor com a regra do
  edital, gera (registro com versão da regra), explica a posição, registra o
  sorteio do empate, exporta e salva a regra como versão nova.
*/

  const A = (n) => `00000000-0000-4000-8000-00000000000${n}`;
  const REGRA = {
    schema: 1,
    documental: { situacoes_aptas: ["Aprovado"] },
    composicao: {
      componentes: [
        { codigo: "DOCUMENTAL", peso: 1 },
        { codigo: "ENTREVISTA", peso: 1 },
      ],
      casas: 2,
    },
    desempate: [{ criterio: "INDIGENA_COMPROVADO", direcao: "SIM_PRIMEIRO" }],
    listas: {
      PRELIMINAR: { empate: "CRITERIOS" },
      FINAL: { empate: "CRITERIOS" },
    },
    empate_final: { metodo: "SORTEIO", numeracao: "DENSA" },
    modalidades: [
      { codigo: "AC" },
      {
        codigo: "PP",
        nome: "Pretos e Pardos",
        percentual: 25,
        lista_propria: true,
        remanejar_para: ["AC"],
      },
    ],
    rodape: "Conforme item 10.4 do edital.",
  };
  const candidato = (n, nome, nota, campos = {}) => ({
    analise_id: A(n),
    codigo: `10${n}`,
    nome,
    vaga: "169681",
    cargo: "Cirurgião Dentista",
    modalidade: "Ampla concorrência",
    status: "Aprovado",
    nota_documental: nota,
    quadro: "q1",
    ...campos,
  });
  const EDITAL = {
    schema_version: 1,
    edital: {
      id: "e83",
      edital: "83/2026",
      unidade: "DSEI Xingu",
      area: "saude-indigena",
    },
    pode_editar: true,
    regra: {
      versao: 2,
      configuracao: REGRA,
      versoes: [
        {
          versao: 2,
          em: "2026-10-01T12:00:00Z",
          por: "Gestora",
          motivo: "Ajuste",
          configuracao: REGRA,
        },
        {
          versao: 1,
          em: "2026-09-30T12:00:00Z",
          por: "Gestora",
          motivo: null,
          configuracao: REGRA,
        },
      ],
    },
    cronograma: [
      {
        ordem: 1,
        atividade: "Período de inscrição",
        inicio: "2026-07-01",
        fim: "2026-07-20",
      },
    ],
    quadro: [
      {
        id: "q1",
        ordem: 1,
        cargo: "Cirurgião Dentista",
        lotacao: "Polo Leonardo",
        modalidades: { "Ampla Concorrência": 1 },
        vagas_imediatas: 1,
        cadastro_reserva: true,
      },
    ],
    candidatos: [
      candidato(1, "Ana Empatada", "10,0"),
      candidato(2, "Bia Empatada", "10,0"),
      candidato(3, "Caio Parda", "9,0", { modalidade: "Pretos e pardos" }),
      candidato(4, "Davi <b>Reprovado</b>", "8,0", { status: "Reprovado" }),
    ],
    entrevistas: [1, 2, 3].map((n) => ({
      id: `ent${n}`,
      analise_id: A(n),
      nome: "x",
      vaga: "169681",
      nota: 10,
      parecer: "APTO",
      compareceu: "S",
      ligacao: "codigo",
      origem: "sistema",
      notas: [],
    })),
    listas: [],
    desempates: [],
  };
  const EDITAIS = {
    area: "saude-indigena",
    pode_editar: true,
    editais: [
      {
        id: "e83",
        edital: "83/2026",
        unidade: "DSEI Xingu",
        ativo: true,
        candidatos: 4,
        versao_regra: 2,
      },
      {
        id: "e100",
        edital: "100/2026",
        unidade: "CASAI",
        ativo: true,
        candidatos: 0,
        versao_regra: null,
      },
    ],
  };

  function supabaseFalso(sobrescrever = {}) {
    const respostas = {
      listar_editais_classificacao: () => EDITAIS,
      obter_classificacao_do_edital: ({ p_edital }) =>
        p_edital === "e83"
          ? structuredClone(EDITAL)
          : {
              ...structuredClone(EDITAL),
              edital: { id: "e100" },
              regra: null,
              candidatos: [],
              entrevistas: [],
            },
      registrar_lista_classificacao: ({ p_tipo, p_versao }) => ({
        id: "l1",
        tipo: p_tipo,
        versao_regra: p_versao,
        hash: "f".repeat(64),
        gerada_em: "2026-10-02T13:00:00Z",
        por: "Gestora",
        pendencias: 0,
        publicada: false,
      }),
      registrar_desempate_classificacao: ({ p_dados }) => ({
        id: "d1",
        ...p_dados,
        semente: "s".repeat(64),
        origem_semente: "SERVIDOR",
        ordem: ordemDoSorteio("s".repeat(64), p_dados.candidatos),
      }),
      salvar_regra_classificacao: ({ p_configuracao }) => ({
        ...EDITAL.regra,
        versao: 3,
        configuracao: p_configuracao,
      }),
      ...sobrescrever,
    };
    return {
      rpc: vi.fn(async (nome, args) => ({
        data: respostas[nome]?.(args) ?? null,
        error: null,
      })),
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
      },
    };
  }

  let secao;
  let painel;
  const toast = vi.fn();
  const baixar = vi.fn();
  const imprimir = vi.fn();
  const copiar = vi.fn(async () => "html");
  const carregarLogo = vi.fn(async () => ({
    bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    largura: 320,
    altura: 320,
  }));

  async function montar(supabase) {
    secao = document.createElement("section");
    secao.id = "page-classificacao";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      painel = montarTela(criarClassificacao, "page-classificacao", {
        supabase,
        toast,
        baixar,
        imprimir,
        copiar,
        carregarLogo,
        cabecalho: () => "AGÊNCIA DE TESTE\nRua A, 1",
      });
    });
    await act(async () => void painel.render());
    await esperar();
  }
  const botao = (texto, raiz = document) =>
    [...raiz.querySelectorAll("button")].find((b) =>
      b.textContent.trim().startsWith(texto),
    );
  /*
  O editor da regra mora nas Regras do edital (Editais), etapa 4, desde
  03/11/2026; a visão Regra da tela mostra só o resumo.
*/
  async function montarRegra(supabase) {
    const montado = await montarRegrasDoEdital({
      supabase,
      editalId: "e83",
      etapa: "classificacao",
      toast,
    });
    secao = montado.secao;
    painel = montado;
    await esperar();
  }
  /* Sem edital escolhido: os cards dos editais da área; clicar abre. */
  const cardsDosEditais = () => [
    ...secao.querySelectorAll(".classificacao-editais [data-edital]"),
  ];
  async function abrirEdital(id = "e83") {
    // Com um edital aberto, "Trocar" volta aos cards.
    const trocar = secao.querySelector("[data-acao='trocar-edital']");
    if (trocar) {
      await clicar(trocar);
      await esperar();
    }
    await clicar(
      secao.querySelector(`.classificacao-editais [data-edital='${id}']`),
    );
    await esperar();
  }
  /* A tabela única da lista (agrupada por vaga) e o cabeçalho de uma vaga. */
  const tabelaDaLista = () =>
    secao.querySelector("[data-tour='classificacao-lista']");
  const grupoDaVaga = (texto) =>
    [...tabelaDaLista().querySelectorAll("tr.ui-tabela-grupo")].find((tr) =>
      tr.textContent.includes(texto),
    );
  const numeroDaFaixa = (valor) =>
    secao.querySelector(
      `[data-tour='classificacao-kpis'] [data-valor='${valor}'] .ui-faixa-numero`,
    )?.textContent;

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("saude-indigena");
    // No app, a casca já leu as linhas do monitoramento (o status dos editais).
    publicarLinhasDoMonitoramento([]);
  });
  afterEach(async () => {
    await act(async () => painel?.raiz?.unmount());
    secao?.remove();
    document.body.innerHTML = "";
    sessionStorage.clear();
    redefinirDadosDoMonitoramento();
    toast.mockClear();
    baixar.mockClear();
    imprimir.mockClear();
  });

  describe("tela de Classificação", () => {
    it("monta na seção, carrega os editais da área ao abrir e nenhum edital vem escolhido", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      expect(secao.querySelector(".ui-tela.classificacao-tela")).not.toBeNull();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "listar_editais_classificacao",
        {
          p_area: "saude-indigena",
        },
      );
      // Sem edital: a busca grande e um card por edital (o título só no cabeçalho da tela).
      expect(secao.querySelector(".ui-cabecalho-titulo").textContent).toBe(
        "Classificação",
      );
      expect(cardsDosEditais().map((c) => c.textContent)).toEqual([
        "83/2026 · DSEI XinguVersão 24 candidatos",
        "100/2026 · CASAISem regra0 candidatos",
      ]);
      expect(tabelaDaLista()).toBeNull();
      // A busca recorta os cards pelo número ou pela unidade.
      await digitar(
        secao.querySelector("[data-acao='buscar-edital']"),
        "casai",
      );
      expect(cardsDosEditais().map((c) => c.dataset.edital)).toEqual(["e100"]);
    });

    it("Ativos e Histórico não piscam: até o status chegar, só o esqueleto; depois, já separados", async () => {
      redefinirDadosDoMonitoramento();
      definirAreaAtual("saude-indigena");
      await montar(supabaseFalso());
      const abas = () =>
        secao.querySelector("[data-tour='classificacao-ativos-e-historico']");
      // Antes: os dois editais em "Ativos · Sem situação 2", e um pulava depois.
      expect(abas()).toBeNull();
      expect(cardsDosEditais()).toEqual([]);
      expect(
        secao.querySelector(".classificacao-editais[aria-busy='true']"),
      ).not.toBeNull();
      await act(async () =>
        publicarLinhasDoMonitoramento([
          { id: "e83", CO_AREA: "saude-indigena", status: "Em andamento" },
          { id: "e100", CO_AREA: "saude-indigena", status: "Concluído" },
        ]),
      );
      expect(abas().querySelector("[data-valor='ativos']").textContent).toBe(
        "Ativos1",
      );
      expect(cardsDosEditais().map((c) => c.dataset.edital)).toEqual(["e83"]);
    });

    it("se a leitura do status falhar, a lista abre assim mesmo (sem esqueleto para sempre)", async () => {
      redefinirDadosDoMonitoramento();
      definirAreaAtual("saude-indigena");
      await montar(supabaseFalso());
      expect(cardsDosEditais()).toEqual([]);
      await act(async () => publicarErroDoMonitoramento("Falha de rede"));
      expect(cardsDosEditais().length).toBeGreaterThan(0);
    });

    it("Ativos e Histórico: o edital concluído sai da lista de trabalho e fica a um clique", async () => {
      publicarLinhasDoMonitoramento([
        { id: "e83", CO_AREA: "saude-indigena", status: "Em andamento" },
        { id: "e100", CO_AREA: "saude-indigena", status: "Concluído" },
      ]);
      await montar(supabaseFalso());
      const controle = secao.querySelector(
        "[data-tour='classificacao-ativos-e-historico']",
      );
      const opcao = (valor) =>
        controle.querySelector(`[data-valor='${valor}']`);
      expect(opcao("ativos").textContent).toBe("Ativos1");
      expect(opcao("historico").textContent).toBe("Histórico1");
      expect(cardsDosEditais().map((c) => c.dataset.edital)).toEqual(["e83"]);
      expect(
        [...controle.querySelectorAll(".ui-ativos-situacoes li")].map(
          (li) => li.textContent,
        ),
      ).toEqual(["Em andamento 1"]);
      await clicar(opcao("historico"));
      expect(cardsDosEditais().map((c) => c.dataset.edital)).toEqual(["e100"]);
      expect(
        controle.querySelector(".ui-ativos-situacoes").textContent,
      ).toContain("Concluído 1");
    });

    it("área sem edital analisado: o seletor diz isso (o banco só manda os editais com análises)", async () => {
      const supabase = supabaseFalso({
        listar_editais_classificacao: () => ({
          area: "sede",
          pode_editar: true,
          editais: [],
        }),
      });
      await montar(supabase);
      expect(
        secao.querySelector(".classificacao-entrada").textContent,
      ).toContain("Nenhum edital com análises nesta área.");
    });

    it("edital que não abriu: erro com Tentar novamente, sem esqueleto carregando para sempre", async () => {
      let falhar = true;
      const supabase = supabaseFalso();
      const original = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation(async (nome, args, opcoes) =>
        falhar && nome.startsWith("obter_classificacao_do_edital")
          ? { data: null, error: { message: "Falha no banco", code: "XX000" } }
          : original(nome, args, opcoes),
      );
      await montar(supabase);
      await abrirEdital();
      expect(secao.textContent).toContain("Não foi possível abrir o edital");
      expect(secao.querySelector('[aria-busy="true"]')).toBeNull();
      for (const visao of ["agenda", "regra"]) {
        await clicar(secao.querySelector(`[data-valor="${visao}"]`));
        expect(secao.querySelector('[aria-busy="true"]')).toBeNull();
      }
      falhar = false;
      await clicar(botao("Tentar novamente", secao));
      await esperar();
      expect(secao.textContent).not.toContain(
        "Não foi possível abrir o edital",
      );
    });

    it("ao escolher o edital, calcula as listas pela regra dele (KPIs, vaga, eliminados)", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirEdital();
      expect(supabase.rpc).toHaveBeenCalledWith(
        "obter_classificacao_do_edital",
        {
          p_edital: "e83",
        },
      );
      // O cabeçalho mostra o edital escolhido com "Trocar".
      expect(
        secao.querySelector(".classificacao-edital-nome strong").textContent,
      ).toBe("83/2026 · DSEI Xingu");
      // A faixa: cada número é o total da lista que ele abre.
      expect(numeroDaFaixa("todos")).toBe("4");
      expect(numeroDaFaixa("ELIMINADOS")).toBe("1");
      expect(grupoDaVaga("VAGA 169681")).toBeTruthy();
      expect(grupoDaVaga("VAGA 169681").textContent).toContain(
        "VAGA 169681 - Cirurgião Dentista - Polo Leonardo - DSEI Xingu - 1 vaga (1 AC + CR)",
      );
      const linhas = [
        ...tabelaDaLista().querySelectorAll("tbody tr[data-candidato]"),
      ].map((tr) => tr.textContent);
      expect(linhas[0]).toContain("Ana Empatada");
      expect(linhas[0]).toContain("20,00");
      expect(linhas[2]).toContain("Caio Parda");
      // A posição é etiqueta; o 1º lugar em destaque.
      expect(
        tabelaDaLista().querySelector("tbody tr[data-candidato] .ui-posicao")
          .dataset.primeiro,
      ).toBe("");
      // Nome vindo do banco é texto, nunca HTML.
      expect(tabelaDaLista().querySelector("tbody b")).toBeNull();
      expect(
        tabelaDaLista().querySelector("tbody tr[data-eliminado]").textContent,
      ).toContain("Davi <b>Reprovado</b>");
      // "Trocar" volta aos cards.
      await clicar(secao.querySelector("[data-acao='trocar-edital']"));
      await esperar();
      expect(cardsDosEditais()).toHaveLength(2);
    });

    it("aberta pela navegação antes de a lista de editais chegar: o cabeçalho mostra o edital, nunca o id", async () => {
      // O fluxo entre etapas (e a página do edital) abre com ?edital=<id>, às vezes antes da lista.
      let soltarLista;
      const lista = new Promise((resolver) => (soltarLista = resolver));
      const supabase = supabaseFalso();
      const original = supabase.rpc.getMockImplementation();
      supabase.rpc.mockImplementation(async (nome, args, opcoes) => {
        if (nome === "listar_editais_classificacao") await lista;
        return original(nome, args, opcoes);
      });
      secao = document.createElement("section");
      secao.id = "page-classificacao";
      secao.className = "page active";
      document.body.append(secao);
      await act(async () => {
        painel = montarTela(criarClassificacao, "page-classificacao", {
          supabase,
          toast,
          baixar,
          imprimir,
          copiar,
          carregarLogo,
          cabecalho: () => "AGÊNCIA DE TESTE\nRua A, 1",
        });
      });
      await act(async () => {
        void painel.render();
        void painel.abrirEdital("e83");
      });
      await esperar();
      const nome = () =>
        secao.querySelector(".classificacao-edital-nome strong").textContent;
      expect(nome()).toBe("Carregando…");
      expect(secao.textContent).not.toContain("e83");
      await act(async () => soltarLista());
      await esperar();
      expect(nome()).toBe("83/2026 · DSEI Xingu");
      // Sem a trilha "Área / Seleção", como as outras telas.
      expect(secao.querySelector(".ui-cabecalho-trilha")).toBeNull();
    });

    it('edital fora da lista da tela: "Edital fora desta lista" com Trocar, e diz que não há classificação', async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      // Um edital sem análise curricular nem lista gerada (fora da lista da Classificação).
      await act(async () => void painel.abrirEdital("e999"));
      await esperar();
      expect(
        secao.querySelector(".classificacao-edital-nome strong").textContent,
      ).toBe("Edital fora desta lista");
      expect(secao.textContent).not.toContain("e999");
      expect(secao.textContent).toContain(
        "Nenhuma classificação gerada para este edital",
      );
      expect(secao.querySelector("[data-acao='trocar-edital']")).not.toBeNull();
      await clicar(secao.querySelector("[data-acao='trocar-edital']"));
      await esperar();
      expect(cardsDosEditais()).toHaveLength(2);
    });

    it("não confirma sorteio com ordem incompleta recebida do banco", async () => {
      const supabase = supabaseFalso({
        registrar_desempate_classificacao: ({ p_dados }) => ({
          ...p_dados,
          semente: "abcd",
          ordem: [A(1), null],
        }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(botao("Registrar sorteio", secao));
      await clicar(botao("Sortear e registrar"));
      await esperar();
      expect(document.body.textContent).not.toContain("Conferido: a ordem");
      expect(secao.querySelector(".classificacao-pendencias")).not.toBeNull();
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("Ordem do desempate inválida"),
        "error",
      );
    });

    it("o empate que espera sorteio aparece no topo e o sorteio é registrado e conferido", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirEdital();
      expect(
        secao.querySelector(".classificacao-pendencias").textContent,
      ).toContain("Ana Empatada, Bia Empatada");
      await clicar(botao("Registrar sorteio", secao));
      await clicar(botao("Sortear e registrar"));
      await esperar();
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "registrar_desempate_classificacao",
      );
      expect(chamada[1]).toMatchObject({
        p_edital: "e83",
        p_dados: {
          tipo_lista: "FINAL",
          vaga: "169681",
          metodo: "SORTEIO",
          candidatos: [A(1), A(2)],
          chave: `FINAL|169681|${A(1)},${A(2)}`,
        },
      });
      expect(chamada[1].p_dados).not.toHaveProperty("semente");
      expect(document.body.textContent).toContain(
        "Conferido: a ordem é a que a semente produz.",
      );
      await clicar(botao("Fechar"));
      // Com o sorteio registrado, a pendência some e as posições se separam.
      expect(secao.querySelector(".classificacao-pendencias")).toBeNull();
      const posicoes = [
        ...secao.querySelectorAll(
          "[data-tour='classificacao-lista'] tbody tr[data-candidato] td:first-child",
        ),
      ].map((td) => td.textContent);
      expect(posicoes).toEqual(["1º", "2º", "3º"]);
    });

    it("abre a explicação da posição do candidato", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      await clicar(botao("Caio Parda", secao));
      const gaveta =
        document.getElementById("classificacaoCandidato") ||
        document.querySelector(".ui-gaveta");
      expect(gaveta.textContent).toContain(
        "Nota 19,00 (documental 9,00 + entrevista 10,00).",
      );
      expect(gaveta.textContent).toContain("Pretos e Pardos: 1º");
    });

    it("Gerar registra a lista com a versão da regra; o retrato não leva CPF nem nascimento; exporta DOCX e XLSX", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "registrar_lista_classificacao",
      );
      expect(chamada[1]).toMatchObject({
        p_edital: "e83",
        p_tipo: "FINAL",
        p_versao: 2,
      });
      expect(chamada[1].p_resultado.vagas[0].geral.map((l) => l.nome)).toEqual([
        "Ana Empatada",
        "Bia Empatada",
        "Caio Parda",
      ]);
      expect(JSON.stringify(chamada[1].p_resultado)).not.toMatch(
        /codigo"\s*:\s*"10|nascimento|cpf/i,
      );
      expect(secao.querySelector("[data-geracao='l1']").textContent).toContain(
        "regra: Versão 2",
      );

      await clicar(secao.querySelector("[data-exportar='docx']"));
      expect(baixar).toHaveBeenCalledWith(
        expect.any(Uint8Array),
        "classificacao-final-83-2026.docx",
        expect.stringContaining("wordprocessingml"),
      );
      await clicar(secao.querySelector("[data-exportar='xlsx']"));
      expect(baixar).toHaveBeenLastCalledWith(
        expect.any(Uint8Array),
        "classificacao-final-83-2026.xlsx",
        expect.stringContaining("spreadsheetml"),
      );
      await clicar(secao.querySelector("[data-exportar='pdf']"));
      const pagina = imprimir.mock.calls[0][0];
      expect(pagina).toContain("RESULTADO FINAL - PROCESSO SELETIVO");
      expect(pagina).toContain("Conforme item 10.4 do edital.");
      expect(pagina).toContain("AGÊNCIA DE TESTE");
    });

    it("Relatório de desempate: só aparece quando a lista gerada tem um; exporta XLSX e PDF", async () => {
      const dourado = JSON.parse(
        readFileSync(
          "tests/fixtures/classificacao/relatorio-de-desempate.json",
          "utf8",
        ),
      );
      await montar(supabaseFalso());
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      expect(secao.querySelector("[data-desempate]")).toBeNull();
      await act(async () => painel.raiz.unmount());
      secao.remove();

      const supabase = supabaseFalso({
        obter_desempate_da_lista: ({ p_lista }) =>
          p_lista === "l1" ? { ...dourado, lista_id: "l1" } : null,
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      expect(
        supabase.rpc.mock.calls.some(
          ([nome, args]) =>
            nome === "obter_desempate_da_lista" && args.p_lista === "l1",
        ),
      ).toBe(true);
      baixar.mockClear();
      await clicar(secao.querySelector("[data-desempate='xlsx']"));
      expect(baixar).toHaveBeenLastCalledWith(
        expect.any(Uint8Array),
        "classificacao-final-83-2026-desempate.xlsx",
        expect.stringContaining("spreadsheetml"),
      );
      imprimir.mockClear();
      await clicar(secao.querySelector("[data-desempate='pdf']"));
      expect(imprimir.mock.calls[0][0]).toContain(
        "<h1>Relatório de desempate</h1>",
      );
      expect(imprimir.mock.calls[0][0]).toContain('href="#vaga-1"');
    });

    it("Relatório de desempate: depois de gerar, 'sendo preparado…' até o Python gravar; então os botões", async () => {
      const dourado = JSON.parse(
        readFileSync(
          "tests/fixtures/classificacao/relatorio-de-desempate.json",
          "utf8",
        ),
      );
      let pronto = false;
      const supabase = supabaseFalso({
        obter_desempate_da_lista: ({ p_lista }) =>
          p_lista !== "l1"
            ? null
            : pronto
              ? {
                  ...dourado,
                  lista_id: "l1",
                  preparo: {
                    situacao: "PRONTO",
                    pedido_em: new Date().toISOString(),
                  },
                }
              : {
                  lista_id: "l1",
                  preparo: {
                    situacao: "PEDIDO",
                    pedido_em: new Date().toISOString(),
                  },
                },
      });
      await montar(supabase);
      await abrirEdital();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        await clicar(secao.querySelector("[data-acao='gerar']"));
        await esperar();
        expect(
          secao.querySelector("[data-desempate-preparo='preparando']")
            ?.textContent,
        ).toBe("Relatório de desempate sendo preparado…");
        expect(secao.querySelector("[data-desempate]")).toBeNull();
        pronto = true;
        await act(async () => void vi.advanceTimersByTime(10000));
        await esperar();
        expect(secao.querySelector("[data-desempate-preparo]")).toBeNull();
        expect(secao.querySelector("[data-desempate='xlsx']")).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("Relatório de desempate: preparo sem fim para no prazo, com 'Tentar de novo'", async () => {
      const supabase = supabaseFalso({
        obter_desempate_da_lista: ({ p_lista }) =>
          p_lista !== "l1"
            ? null
            : // Sem pedido_em legível, só o prazo da tela para a releitura.
              {
                lista_id: "l1",
                preparo: { situacao: "PEDIDO", pedido_em: "" },
              },
      });
      await montar(supabase);
      await abrirEdital();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
      const leituras = () =>
        supabase.rpc.mock.calls.filter(
          ([nome]) => nome === "obter_desempate_da_lista",
        ).length;
      try {
        await clicar(secao.querySelector("[data-acao='gerar']"));
        await esperar();
        expect(
          secao.querySelector("[data-desempate-preparo='preparando']"),
        ).not.toBeNull();
        for (let minuto = 0; minuto < 17; minuto += 1) {
          await act(async () => void vi.advanceTimersByTime(60_000));
          await esperar();
        }
        const aviso = secao.querySelector(".classificacao-desempate-esgotado");
        expect(aviso?.textContent).toContain("ainda não ficou pronto");
        expect(secao.querySelector("[data-desempate-preparo]")).toBeNull();
        const lidas = leituras();
        await act(async () => void vi.advanceTimersByTime(30 * 60_000));
        await esperar();
        expect(leituras()).toBe(lidas);
        await clicar(aviso.querySelector("[data-acao='tentar-desempate']"));
        await esperar();
        expect(leituras()).toBe(lidas + 1);
        expect(
          secao.querySelector("[data-desempate-preparo='preparando']"),
        ).not.toBeNull();
      } finally {
        vi.useRealTimers();
      }
    });

    it("Relatório de desempate: não confere ou não saiu → aviso; automação desligada → nada", async () => {
      for (const [situacao, seletor, trecho] of [
        [
          "NAO_CONFERE",
          ".classificacao-desempate-nao-confere",
          "não confere com esta lista",
        ],
        ["FALHOU", ".classificacao-desempate-falhou", "não pôde ser preparado"],
        [
          "SEM_DISPARO",
          ".classificacao-desempate-falhou",
          "não pôde ser preparado",
        ],
        ["DESLIGADA", null, null],
      ]) {
        const supabase = supabaseFalso({
          obter_desempate_da_lista: () => ({
            lista_id: "l1",
            preparo: { situacao, pedido_em: new Date().toISOString() },
          }),
        });
        await montar(supabase);
        await abrirEdital();
        await clicar(secao.querySelector("[data-acao='gerar']"));
        await esperar();
        if (seletor)
          expect(secao.querySelector(seletor)?.textContent, situacao).toContain(
            trecho,
          );
        else
          expect(
            secao.querySelector(
              "[data-desempate-preparo], .classificacao-desempate-nao-confere, .classificacao-desempate-falhou",
            ),
            situacao,
          ).toBeNull();
        expect(secao.querySelector("[data-desempate]")).toBeNull();
        await act(async () => painel.raiz.unmount());
        secao.remove();
      }
    });

    it("Exportar: o recorte é de cada lista; o XLSX (planilha inteira) não leva o recorte no nome", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      const recorte = () =>
        secao.querySelector("[data-tour='classificacao-exportar-lista']");
      await escolher(recorte(), "geral");
      baixar.mockClear();
      await clicar(secao.querySelector("[data-exportar='docx']"));
      await esperar();
      expect(baixar.mock.calls[0][1]).toBe(
        "classificacao-final-83-2026-geral.docx",
      );
      await clicar(secao.querySelector("[data-exportar='xlsx']"));
      expect(baixar.mock.calls[1][1]).toBe("classificacao-final-83-2026.xlsx");

      await clicar(
        secao.querySelector(".classificacao-tipos [data-valor='PRELIMINAR']"),
      );
      expect(recorte().value).toBe("todas");
    });

    it("Copiar para o SEI: HTML com as classes do SEI e texto numerado, da lista registrada", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      expect(secao.querySelector("[data-acao='copiar-sei']").disabled).toBe(
        true,
      );
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      copiar.mockClear();
      await clicar(secao.querySelector("[data-acao='copiar-sei']"));
      await esperar();
      const [{ html, texto }] = copiar.mock.calls[0];
      expect(html).toContain(
        '<p class="Item_Nivel1">Disposições Preliminares</p>',
      );
      expect(html).toContain("VAGA 169681 - Cirurgião Dentista");
      expect(html).toContain("<strong>CLASSIFICAÇÃO</strong>");
      expect(html).not.toMatch(/<script|onerror/i);
      expect(texto).not.toContain("na data da assinatura digital");
      expect(texto).toContain("1. DISPOSIÇÕES PRELIMINARES");
      expect(texto).toContain("2.1. Os(as) candidatos(as) aprovados(as)");
      expect(toast).toHaveBeenCalledWith(
        "Copiado. No SEI, cole no editor do documento (Ctrl+V).",
        "success",
      );
    });

    it("Como fica no SEI: prévia, textos editáveis, Baixar DOCX e Salvar no edital", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      await clicar(secao.querySelector("[data-acao='ver-documento']"));
      await esperar();
      const modal = document.getElementById("classificacaoDocumento");
      const previa = () =>
        modal.querySelector("iframe.classificacao-documento-previa");
      // Sem script na prévia: só o mesmo origem, para medir a altura da folha.
      expect(previa().getAttribute("sandbox")).toBe("allow-same-origin");
      expect(previa().getAttribute("srcdoc")).toContain(
        "RESULTADO FINAL - PROCESSO SELETIVO",
      );
      expect(previa().getAttribute("srcdoc")).toContain("AGÊNCIA DE TESTE");
      // Painel recolhível com as abas "Dados" | "Textos".
      const textosDoModelo = () =>
        modal
          .querySelector("[data-campo-documento='finais']")
          .closest("[role='tabpanel']");
      expect(textosDoModelo().hidden).toBe(true);
      await digitar(
        modal.querySelector("[data-campo-documento='processo']"),
        "AGSUS.016954/2026-81",
      );
      // O processo vai no rodapé do Word; a prévia não simula a linha de
      // assinatura e rodapé que o SEI põe.
      expect(
        modal.querySelector("[data-campo-documento='processo']").value,
      ).toBe("AGSUS.016954/2026-81");
      expect(previa().getAttribute("srcdoc")).not.toContain("pg. N");
      await clicar(modal.querySelector(".ui-abas [data-aba='textos']"));
      expect(textosDoModelo().hidden).toBe(false);
      expect(
        modal
          .querySelector("[data-campo-documento='processo']")
          .closest("[role='tabpanel']").hidden,
      ).toBe(true);
      const finais = modal.querySelector("[data-campo-documento='finais']");
      await digitar(finais, "Texto final do edital.");
      expect(previa().getAttribute("srcdoc")).toContain(
        '<p class="Item_Nivel2">Texto final do edital.</p>',
      );

      baixar.mockClear();
      await clicar(modal.querySelector("[data-acao='baixar-docx']"));
      await esperar();
      const [bytes, nome] = baixar.mock.calls[0];
      expect(nome).toBe("classificacao-final-83-2026.docx");
      const conteudo = new TextDecoder().decode(bytes);
      expect(conteudo).toContain("word/header1.xml");
      expect(conteudo).toContain("word/media/logo.png");
      // Sem rodapé de página (o SEI põe "título / pg. N").
      expect(conteudo).not.toContain("word/footer1.xml");
      expect(conteudo).not.toContain(" / pg. ");
      expect(conteudo).toContain("Texto final do edital.");

      copiar.mockClear();
      await clicar(modal.querySelector("[data-acao='copiar-sei']"));
      await esperar();
      expect(copiar.mock.calls[0][0].html).toContain("Texto final do edital.");

      await clicar(modal.querySelector("[data-acao='salvar-textos']"));
      await esperar();
      const chamada = supabase.rpc.mock.calls.find(
        ([n]) => n === "salvar_regra_classificacao",
      );
      expect(chamada[1].p_motivo).toBe("Textos do documento oficial (SEI)");
      expect(chamada[1].p_configuracao.documento).toMatchObject({
        processo: "AGSUS.016954/2026-81",
        modelos: { FINAL_FINAL: { finais: "Texto final do edital." } },
      });
      expect(
        chamada[1].p_configuracao.documento.modelos.FINAL_FINAL,
      ).not.toHaveProperty("preliminares");
    });

    it("Como fica no SEI: folha A4 com zoom, painel recolhível, tela cheia e rodapé fixo; Esc fecha", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      await clicar(secao.querySelector("[data-acao='ver-documento']"));
      await esperar();
      const modal = document.getElementById("classificacaoDocumento");
      const cartao = modal.querySelector(".classificacao-documento");
      const escala = () =>
        modal.querySelector(".classificacao-documento-escala").textContent;
      const folha = () =>
        modal.querySelector("iframe.classificacao-documento-previa");
      // A folha tem a largura de uma A4 e começa ajustada (sem largura medida, 100%).
      expect(folha().style.width).toBe("794px");
      expect(escala()).toBe("100%");
      expect(
        modal
          .querySelector("[data-acao='zoom-ajustar']")
          .getAttribute("aria-pressed"),
      ).toBe("true");
      await clicar(modal.querySelector("[data-acao='zoom-mais']"));
      expect(escala()).toBe("110%");
      expect(folha().style.transform).toBe("scale(1.1)");
      await clicar(modal.querySelector("[data-acao='zoom-menos']"));
      await clicar(modal.querySelector("[data-acao='zoom-menos']"));
      expect(escala()).toBe("90%");
      expect(
        modal
          .querySelector("[data-acao='zoom-ajustar']")
          .getAttribute("aria-pressed"),
      ).toBe("false");
      await clicar(modal.querySelector("[data-acao='zoom-ajustar']"));
      expect(escala()).toBe("100%");

      // O painel dos textos recolhe; a prévia fica com a largura toda.
      const painel = modal.querySelector(".classificacao-documento-painel");
      await clicar(modal.querySelector("[data-acao='alternar-painel']"));
      expect(painel.hidden).toBe(true);
      expect(
        modal
          .querySelector(".classificacao-documento-corpo")
          .classList.contains("is-sem-painel"),
      ).toBe(true);
      await clicar(modal.querySelector("[data-acao='alternar-painel']"));
      expect(painel.hidden).toBe(false);

      await clicar(modal.querySelector("[data-acao='tela-cheia']"));
      expect(cartao.classList.contains("is-tela-cheia")).toBe(true);
      await clicar(modal.querySelector("[data-acao='tela-cheia']"));
      expect(cartao.classList.contains("is-tela-cheia")).toBe(false);

      // Restaurar e Salvar ficam no rodapé, fora da área que rola.
      const rodape = modal.querySelector(".classificacao-documento-rodape");
      expect(
        rodape.querySelector("[data-acao='restaurar-textos']"),
      ).toBeTruthy();
      expect(rodape.querySelector("[data-acao='salvar-textos']")).toBeTruthy();
      expect(rodape.querySelector("[data-acao='copiar-sei']")).toBeTruthy();

      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      await esperar();
      expect(document.getElementById("classificacaoDocumento")).toBeNull();
    });

    it("Como fica no SEI: aba Colunas marca, ordena, restaura e salva no edital", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      await clicar(secao.querySelector("[data-acao='ver-documento']"));
      await esperar();
      const modal = document.getElementById("classificacaoDocumento");
      const previa = () =>
        modal
          .querySelector("iframe.classificacao-documento-previa")
          .getAttribute("srcdoc");
      const noDocumento = () =>
        [
          ...modal.querySelectorAll(
            "[aria-label='Colunas no documento'] [data-coluna]",
          ),
        ].map((li) => li.dataset.coluna);
      await clicar(modal.querySelector(".ui-abas [data-aba='colunas']"));
      // Padrão enxuto; Classificação e Nome não se desmarcam.
      expect(noDocumento()).not.toContain("SITUACAO");
      expect(
        modal.querySelector("[data-marcar-coluna='CLASSIFICACAO']").disabled,
      ).toBe(true);
      expect(modal.querySelector("[data-marcar-coluna='NOME']").disabled).toBe(
        true,
      );
      expect(previa()).not.toContain("SITUAÇÃO");

      await clicar(modal.querySelector("[data-marcar-coluna='SITUACAO']"));
      expect(noDocumento().at(-1)).toBe("SITUACAO");
      expect(previa()).toContain("SITUAÇÃO");
      await clicar(
        modal.querySelector(
          "[data-coluna='SITUACAO'] [data-acao='subir-coluna']",
        ),
      );
      expect(noDocumento().at(-2)).toBe("SITUACAO");

      // "Restaurar o padrão", na aba Colunas, volta às colunas padrão.
      await clicar(modal.querySelector("[data-acao='restaurar-textos']"));
      expect(noDocumento()).not.toContain("SITUACAO");
      await clicar(modal.querySelector("[data-marcar-coluna='SITUACAO']"));

      await clicar(modal.querySelector("[data-acao='salvar-textos']"));
      await esperar();
      const chamada = supabase.rpc.mock.calls.find(
        ([n]) => n === "salvar_regra_classificacao",
      );
      expect(chamada[1].p_configuracao.documento.colunas.FINAL_FINAL).toEqual(
        expect.arrayContaining(["CLASSIFICACAO", "NOME", "NOTA", "SITUACAO"]),
      );
    });

    it("sem geração, exportar fica desligado; leitor não vê Gerar", async () => {
      await montar(
        supabaseFalso({
          obter_classificacao_do_edital: () => ({
            ...structuredClone(EDITAL),
            pode_editar: false,
          }),
        }),
      );
      await abrirEdital();
      expect(secao.querySelector("[data-exportar='docx']").disabled).toBe(true);
      expect(secao.querySelector("[data-acao='gerar']")).toBeNull();
      expect(secao.querySelector("[data-acao='resolver-empate']")).toBeNull();
    });

    it("troca de edital: o sem regra avisa e não inventa lista", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      await abrirEdital("e100");
      expect(secao.textContent).toContain(
        "Este edital ainda não tem regra de classificação.",
      );
      expect(tabelaDaLista()).toBeNull();
    });

    it("a lista preliminar e a de convocação vêm do mesmo edital", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      await clicar(
        secao.querySelector(".classificacao-tipos [data-valor='PRELIMINAR']"),
      );
      const notas = [
        ...secao.querySelectorAll(
          "[data-tour='classificacao-lista'] tbody tr[data-candidato] td:nth-child(4)",
        ),
      ].map((td) => td.textContent);
      expect(notas).toEqual(["10,00", "10,00", "9,00"]);
      await clicar(
        secao.querySelector(".classificacao-tipos [data-valor='CONVOCACAO']"),
      );
      expect(tabelaDaLista().textContent).toContain(
        "Limite da convocação: sem limite na regra",
      );
    });

    it("Regra na tela: o resumo (nota, desempate, cotas) e o Editar nas Regras do edital", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      await clicar(
        secao.querySelector(".ui-cabecalho-da-tela [data-valor='regra']"),
      );
      // O resumo baixa as regras por import() (fora do pacote de entrada).
      await act(async () => {
        await import("../src/lib/regras-do-edital/regras-do-edital-resumos.ts");
      });
      const resumo = secao.querySelector("[data-tour='classificacao-regra']");
      expect(resumo.textContent).toContain("Composição da nota");
      expect(resumo.textContent).toContain(
        "1º indígena comprovado (comprovado na Avaliação documental)",
      );
      expect(resumo.textContent).toContain("PP 25%");
      expect(secao.querySelector("[data-acao='salvar-regra']")).toBeNull();
      window.navigate = vi.fn();
      // As Regras do edital são rota de Editais (src/app/navegacao.ts).
      try {
        await clicar(
          resumo.querySelector("[data-acao='editar-nas-regras-do-edital']"),
        );
        expect(window.navigate).toHaveBeenCalledWith("nucleo", {
          edital: "e83",
          regras: "classificacao",
        });
      } finally {
        delete window.navigate;
        registrarTelas({});
      }
    });

    it("Regra: critérios reordenáveis, motivo obrigatório e salvar cria a versão 3", async () => {
      const supabase = supabaseFalso();
      await montarRegra(supabase);
      expect(
        secao.querySelectorAll(".classificacao-lista-ordenavel li"),
      ).toHaveLength(1);
      await escolher(
        secao.querySelector("[data-acao='adicionar-criterio']"),
        "IDOSO_60",
      );
      await clicar(
        botao("Subir 60 anos", secao) ||
          secao.querySelector("[aria-label^='Subir 60']"),
      );
      expect(
        [...secao.querySelectorAll(".classificacao-lista-ordenavel li")].map(
          (li) => li.dataset.criterio,
        ),
      ).toEqual(["IDOSO_60", "INDIGENA_COMPROVADO"]);
      expect(secao.textContent).toContain("Versões da regra");

      await clicar(secao.querySelector("[data-acao='salvar-regra']"));
      expect(
        supabase.rpc.mock.calls.some(
          ([nome]) => nome === "salvar_regra_classificacao",
        ),
      ).toBe(false);
      expect(secao.textContent).toContain("Informe o motivo.");

      const motivo = [
        ...secao.querySelectorAll(".classificacao-salvar input"),
      ][0];
      await digitar(motivo, "60+ é o primeiro critério (item 10.4 a)");
      await clicar(secao.querySelector("[data-acao='salvar-regra']"));
      await esperar();
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_regra_classificacao",
      );
      expect(chamada[1]).toMatchObject({
        p_edital: "e83",
        p_versao_atual: 2,
        p_motivo: "60+ é o primeiro critério (item 10.4 a)",
      });
      expect(
        chamada[1].p_configuracao.desempate.map((d) => d.criterio),
      ).toEqual(["IDOSO_60", "INDIGENA_COMPROVADO"]);
      // "Nome desta versão": a sugestão (edital + começo do motivo) vai junto.
      expect(chamada[1].p_nome).toMatch(/ – 60\+ é o primeiro critério/);
      expect(toast).toHaveBeenCalledWith(
        expect.stringMatching(/^Regra salva \((.+ · v3|Versão 3)\)\.$/),
        "success",
      );
    });

    it("Regra: o rascunho guardado volta ao abrir (Continuar) e salvar a versão o apaga", async () => {
      const configuracao = structuredClone(EDITAL.regra.configuracao);
      configuracao.desempate = [
        { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
        ...configuracao.desempate,
      ];
      let rascunho = {
        conteudo: { regra: configuracao },
        versao_base: 2,
        atualizado_em: new Date(2026, 9, 13, 14, 5).toISOString(),
      };
      const supabase = supabaseFalso({
        obter_rascunho_regra: ({ p_tipo }) =>
          p_tipo === "CLASSIFICACAO" ? rascunho : null,
        salvar_rascunho_regra: ({ p_conteudo, p_versao_base }) => {
          rascunho = {
            conteudo: p_conteudo,
            versao_base: p_versao_base,
            atualizado_em: "2026-10-13T15:00:00Z",
          };
          return { atualizado_em: rascunho.atualizado_em };
        },
        descartar_rascunho_regra: () => {
          rascunho = null;
          return { descartado: true };
        },
      });
      await montarRegra(supabase);
      await esperar();
      expect(
        secao.querySelector(".ui-aviso-de-rascunho").textContent,
      ).toContain("Você tem um rascunho não salvo de 13/10 14:05");
      await clicar(botao("Continuar de onde parei", secao));
      await esperar();
      expect(
        [...secao.querySelectorAll(".classificacao-lista-ordenavel li")].map(
          (li) => li.dataset.criterio,
        ),
      ).toEqual(["IDOSO_60", "INDIGENA_COMPROVADO"]);
      await digitar(
        secao.querySelector(".classificacao-salvar input"),
        "60+ primeiro, retomado do rascunho",
      );
      await clicar(secao.querySelector("[data-acao='salvar-regra']"));
      await esperar();
      await esperar();
      expect(
        supabase.rpc.mock.calls.some(
          ([nome, args]) =>
            nome === "descartar_rascunho_regra" &&
            args.p_tipo === "CLASSIFICACAO",
        ),
      ).toBe(true);
      expect(rascunho).toBeNull();
    });

    it("Regra: digitar tecla a tecla não come a vírgula nem o espaço (números e listas)", async () => {
      const supabase = supabaseFalso();
      await montarRegra(supabase);
      const campo = (rotulo) => {
        const label = [...secao.querySelectorAll("label")].find(
          (l) => l.textContent.trim() === rotulo,
        );
        return document.getElementById(label.htmlFor);
      };
      // Cada pedaço continua o que o campo mostra, como teclas seguidas.
      const digitarAosPoucos = async (entrada, pedacos) => {
        await digitar(entrada, "");
        for (const p of pedacos) await digitar(entrada, entrada.value + p);
      };
      const pp = secao.querySelector("[data-modalidade='PP']");

      const minimo = campo("Mínimo documental");
      await digitarAosPoucos(minimo, ["7,", "5"]);
      expect(minimo.value).toBe("7,5");
      const percentual = pp.querySelector("[aria-label='Percentual']");
      await digitarAosPoucos(percentual, ["12,", "5"]);
      expect(percentual.value).toBe("12,5");
      const niveis = campo("Nível pelo início do cargo");
      await digitarAosPoucos(niveis, [
        "Técnico",
        "=tecnico;",
        " Agente ",
        "de saúde=fundamental",
      ]);
      expect(niveis.value).toBe("Técnico=tecnico; Agente de saúde=fundamental");
      const agrupa = pp.querySelector("[aria-label='Reúne as modalidades']");
      await digitarAosPoucos(agrupa, ["PI,", " PQ"]);
      expect(agrupa.value).toBe("PI, PQ");
      const situacoes = campo("Situações aptas na análise");
      await digitarAosPoucos(situacoes, [
        "Aprovado,",
        " Apto ",
        "com ressalva",
      ]);
      expect(situacoes.value).toBe("Aprovado, Apto com ressalva");

      await digitar(
        [...secao.querySelectorAll(".classificacao-salvar input")][0],
        "Mínimos do item 9",
      );
      await clicar(secao.querySelector("[data-acao='salvar-regra']"));
      await esperar();
      const { p_configuracao } = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "salvar_regra_classificacao",
      )[1];
      expect(p_configuracao.documental).toMatchObject({
        nota_minima: 7.5,
        situacoes_aptas: ["Aprovado", "Apto com ressalva"],
        niveis_por_cargo: [
          { termo: "Técnico", nivel: "tecnico" },
          { termo: "Agente de saúde", nivel: "fundamental" },
        ],
      });
      expect(
        p_configuracao.modalidades.find((m) => m.codigo === "PP"),
      ).toMatchObject({ percentual: 12.5, agrupa: ["PI", "PQ"] });
    }, 30000);

    it("sem permissão no banco, mostra o aviso de acesso", async () => {
      const supabase = {
        rpc: vi.fn(async () => ({
          data: null,
          error: { code: "42501", message: "Sem permissão" },
        })),
        auth: {
          getSession: async () => ({
            data: { session: { user: { id: "u" } } },
          }),
        },
      };
      await montar(supabase);
      expect(secao.textContent).toContain("Sem acesso à Classificação");
      expect(cardsDosEditais()).toHaveLength(0);
    });
  });

  describe("Classificação com ajuste da pontuação aprovado em recurso", () => {
    const comAjuste = (extra = {}) =>
      supabaseFalso({
        obter_classificacao_do_edital: () => ({
          ...structuredClone(EDITAL),
          ajustes: [
            {
              id: "aj1",
              recurso_id: "r7",
              numero: 7,
              analise_id: A(3),
              aprovado_em: "2026-10-05T12:00:00Z",
              itens: [{ codigo: "DOCUMENTAL", anterior: 9, novo: 12 }],
            },
          ],
          ajustes_mudaram_em: "2026-10-05T12:00:00Z",
          ...extra,
        }),
      });

    it('o candidato aparece marcado "Recurso nº 7" na tabela e a explicação diz o que mudou', async () => {
      await montar(comAjuste());
      await abrirEdital();
      const linha = secao.querySelector(
        `[data-tour='classificacao-lista'] tr[data-candidato="${A(3)}"]`,
      );
      const marca = linha.querySelector(".classificacao-marca-recurso");
      expect(marca.textContent).toBe("Recurso nº 7");
      expect(marca.getAttribute("title")).toBe(
        "Nota alterada pelo recurso nº 7",
      );
      expect(
        secao.querySelectorAll(
          "[data-tour='classificacao-lista'] .classificacao-marca-recurso",
        ),
      ).toHaveLength(1);
      await clicar(botao("Caio Parda", secao));
      const gaveta = document.getElementById("classificacaoCandidato");
      expect(gaveta.textContent).toContain(
        "Nota 22,00 (documental 12,00 + entrevista 10,00).",
      );
      expect(gaveta.textContent).toContain(
        "Nota alterada pelo recurso nº 7: nota documental 9,00 → 12,00.",
      );
    });

    it("lista gerada antes do ajuste aprovado: avisa para gerar de novo; gerada depois, não", async () => {
      const lista = (gerada_em) => ({
        id: "l0",
        tipo: "FINAL",
        versao_regra: 2,
        hash: "a".repeat(64),
        gerada_em,
        por: "Gestora",
        pendencias: 0,
        publicada: false,
      });
      await montar(comAjuste({ listas: [lista("2026-10-04T12:00:00Z")] }));
      await abrirEdital();
      expect(
        secao.querySelector(".classificacao-desatualizada").textContent,
      ).toBe("Há recursos aprovados depois desta lista — gere de novo.");
      await act(async () => painel?.raiz?.unmount());
      secao.remove();
      await montar(comAjuste({ listas: [lista("2026-10-06T12:00:00Z")] }));
      await abrirEdital();
      expect(secao.querySelector(".classificacao-desatualizada")).toBeNull();
    });
  });

  describe("Classificação: publicar o resultado final como lista de aprovados", () => {
    // A prévia é do job Python (migration 20261030090000): o banco devolve o plano.
    const C1 = "c1c1c1c1-0000-4000-8000-000000000001";
    const C2 = "c2c2c2c2-0000-4000-8000-000000000002";
    const P1 = "a1a1a1a1-0000-4000-8000-000000000001";
    const P2 = "b2b2b2b2-0000-4000-8000-000000000002";
    const VIGENTE = {
      edital_id: "e83",
      pode_publicar: true,
      pode_substituir: true,
      tem_analises: true,
      vigente: {
        lista_id: "lv1",
        origem: "XLSX",
        importado_em: "2026-09-20T12:00:00Z",
        candidatos: null,
      },
      publicacoes: [],
    };
    const plano = (manuais = {}) => ({
      pedido_id: Object.keys(manuais).length ? P2 : P1,
      origem: "CLASSIFICACAO",
      situacao: "CALCULADO",
      disparo: "ACEITO",
      exige_motivo: true,
      pode_substituir: true,
      anteriores: 2,
      novos_total: 3,
      manuais,
      plano: {
        versao: 1,
        vinculos: [
          { candidato_id: C1, chave: A(1), forma: "NOME" },
          ...(manuais[C2]
            ? [{ candidato_id: C2, chave: A(2), forma: "MANUAL" }]
            : []),
        ],
        resumo: {
          casados: manuais[C2] ? 2 : 1,
          entram: manuais[C2] ? 1 : 2,
          sem_par: manuais[C2] ? 0 : 1,
          sem_dono: manuais[C2] ? 0 : 1,
          preservados: manuais[C2] ? 2 : 1,
          mudam: 0,
          sub_judice_mantidos: 0,
          ambiguos: 0,
        },
        pendencias: manuais[C2]
          ? []
          : [
              {
                candidato_id: C2,
                nome: "Pessoa Que Saiu",
                status: "Desistente",
              },
            ],
        mudam: [],
        revisar: [C2],
      },
      novos: [1, 2, 3].map((n) => ({
        chave: A(n),
        nome: ["Ana Empatada", "Bia Nova", "Caio Novo"][n - 1],
        codigo_vaga: "169681",
        posicao: n,
        nota: 20 - n,
      })),
      revisar: [
        {
          candidato_id: C2,
          nome: "Pessoa Que Saiu",
          codigo_vaga: "169681",
          classificacao: 2,
          status: "Desistente",
        },
      ],
    });
    const comCasamento = (extra = {}) => {
      let manuais = {};
      return supabaseFalso({
        obter_publicacao_lista_aprovados: () => structuredClone(VIGENTE),
        pedir_casamento_da_lista: ({ p_manuais }) => {
          manuais = p_manuais || {};
          return {
            pedido_id: Object.keys(manuais).length ? P2 : P1,
            situacao: "PENDENTE",
          };
        },
        obter_casamento_da_lista: () => plano(manuais),
        aplicar_casamento_da_lista: () => ({
          ok: true,
          lista_id: "nova",
          candidatos: 3,
          pendencias: [],
        }),
        ...extra,
      });
    };
    const chamadas = (supabase, nome) =>
      supabase.rpc.mock.calls.filter(([n]) => n === nome).map(([, a]) => a);

    it("bloqueia a publicação quando a lista vigente vem fora do formato", async () => {
      const supabase = comCasamento({
        obter_publicacao_lista_aprovados: () => ({
          ...VIGENTE,
          vigente: { ...VIGENTE.vigente, candidatos: [null] },
        }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
      await esperar();
      const modal = document.getElementById("classificacaoPublicarAprovados");
      expect(modal.querySelector("[role='alert']").textContent).toContain(
        "Recarregue a lista",
      );
      expect(
        modal.querySelector("[data-acao='confirmar-publicacao-aprovados']"),
      ).toBeNull();
      expect(chamadas(supabase, "pedir_casamento_da_lista")).toEqual([]);
    });

    it("mostra o plano do Python, recalcula com a revisão e publica pelo pedido, com motivo", async () => {
      const supabase = comCasamento();
      await montar(supabase);
      await abrirEdital();
      expect(
        secao.querySelector("[data-acao='publicar-aprovados']"),
      ).toBeNull();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
      await esperar();

      expect(chamadas(supabase, "pedir_casamento_da_lista")).toEqual([
        {
          p_edital: "e83",
          p_origem: "CLASSIFICACAO",
          p_lista_classificacao: "l1",
          p_lista_vigente: "lv1",
          p_manuais: {},
        },
      ]);
      const modal = document.getElementById("classificacaoPublicarAprovados");
      expect(modal.textContent).toContain("Lista manual (planilha)");
      const valor = (chave) =>
        modal.querySelector(`[data-kpi='${chave}'] .ui-kpi-valor`).textContent;
      expect(valor("entram")).toBe("2");
      expect(valor("saem")).toBe("1");
      expect(valor("preservados")).toBe("1");
      // Quem saiu com status vai para a revisão; aqui a pessoa diz que é a Bia.
      expect(
        modal.querySelector(".classificacao-revisao").textContent,
      ).toContain("Pessoa Que Saiu");
      await escolher(modal.querySelector(`#revisao-${C2}`), A(2));
      const confirmar = () =>
        document.querySelector("[data-acao='confirmar-publicacao-aprovados']");
      // A revisão mudou: publicar espera o recálculo.
      expect(confirmar().disabled).toBe(true);
      await clicar(modal.querySelector("[data-acao='recalcular-casamento']"));
      await esperar();
      expect(
        chamadas(supabase, "pedir_casamento_da_lista")[1].p_manuais,
      ).toEqual({ [C2]: A(2) });
      expect(valor("saem")).toBe("0");
      // A lista vigente tem status: como no XLSX, substituir pede o motivo.
      expect(confirmar().disabled).toBe(true);
      await digitar(
        document.querySelector("#classificacaoPublicarMotivo"),
        "Resultado após os recursos",
      );
      expect(confirmar().disabled).toBe(false);
      await clicar(confirmar());
      await esperar();

      expect(chamadas(supabase, "aplicar_casamento_da_lista")).toEqual([
        { p_pedido: P2, p_motivo: "Resultado após os recursos" },
      ]);
      expect(
        document.getElementById("classificacaoPublicarAprovados").textContent,
      ).toContain("Lista de aprovados publicada com 3 candidato(s).");
    });

    it("a mesma permissão do XLSX: sem poder substituir, avisa e não pede a prévia", async () => {
      const supabase = comCasamento({
        obter_publicacao_lista_aprovados: () => ({
          ...structuredClone(VIGENTE),
          pode_substituir: false,
        }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
      await esperar();
      const modal = document.getElementById("classificacaoPublicarAprovados");
      expect(modal.querySelector("[role='alert']").textContent).toContain(
        "Só o admin da Importação substitui a lista de aprovados vigente.",
      );
      expect(chamadas(supabase, "pedir_casamento_da_lista")).toEqual([]);
      expect(
        modal.querySelector("[data-acao='confirmar-publicacao-aprovados']")
          .disabled,
      ).toBe(true);
    });

    it("o job falhou: a prévia diz por quê e não publica", async () => {
      const supabase = comCasamento({
        obter_casamento_da_lista: () => ({
          ...plano(),
          situacao: "ERRO",
          plano: null,
          erro: "A lista vigente mudou desde o pedido; peça a prévia de novo.",
        }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
      await esperar();
      const modal = document.getElementById("classificacaoPublicarAprovados");
      expect(modal.querySelector("[role='alert']").textContent).toContain(
        "A lista vigente mudou desde o pedido",
      );
      expect(chamadas(supabase, "aplicar_casamento_da_lista")).toEqual([]);
    });

    it("num passo só: publica como lista de aprovados e marca o resultado final", async () => {
      const supabase = comCasamento({
        publicar_lista_classificacao: ({ p_lista }) => ({
          id: p_lista,
          tipo: "FINAL",
          versao_regra: 2,
          hash: "f".repeat(64),
          gerada_em: "2026-10-02T13:00:00Z",
          pendencias: 0,
          publicada: true,
        }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      // Quem pode publicar como lista não vê o "Marcar como publicada".
      expect(secao.querySelector("[data-acao='publicar']")).toBeNull();
      await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
      await esperar();
      await digitar(
        document.querySelector("#classificacaoPublicarMotivo"),
        "Resultado após os recursos",
      );
      await clicar(
        document.querySelector("[data-acao='confirmar-publicacao-aprovados']"),
      );
      await esperar();
      const nomes = supabase.rpc.mock.calls.map(([n]) => n);
      expect(nomes.indexOf("publicar_lista_classificacao")).toBeGreaterThan(
        nomes.indexOf("aplicar_casamento_da_lista"),
      );
      expect(chamadas(supabase, "publicar_lista_classificacao")).toEqual([
        { p_lista: "l1" },
      ]);
      expect(toast).toHaveBeenCalledWith(
        "Lista de aprovados publicada: 3 candidato(s).",
        "success",
      );
      expect(secao.querySelector("[data-geracao='l1']").textContent).toContain(
        "· publicada",
      );
    });

    it("quem só pode marcar continua com 'Marcar como publicada' e a frase", async () => {
      const supabase = comCasamento({
        obter_publicacao_lista_aprovados: () => ({
          ...structuredClone(VIGENTE),
          pode_publicar: false,
          pode_substituir: false,
        }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      expect(secao.querySelector("[data-acao='publicar']")).not.toBeNull();
      expect(
        secao.querySelector("[data-acao='publicar-aprovados']"),
      ).toBeNull();
      expect(secao.querySelector("[data-so-marca]").textContent).toBe(
        "A lista de aprovados é publicada por quem cuida da Lista de aprovados.",
      );
    });

    const FINAL_PUBLICADO = {
      id: "l9",
      tipo: "FINAL",
      versao_regra: 2,
      hash: "b".repeat(64),
      gerada_em: "2026-11-17T13:00:00Z",
      pendencias: 0,
      publicada: true,
    };
    const comFinalPublicado = (vigente, extra = {}) =>
      comCasamento({
        obter_classificacao_do_edital: () => ({
          ...structuredClone(EDITAL),
          listas: [structuredClone(FINAL_PUBLICADO)],
        }),
        obter_publicacao_lista_aprovados: () => ({
          ...structuredClone(VIGENTE),
          vigente,
        }),
        ...extra,
      });

    it("publicado e fora da Lista de aprovados: destaque com o botão", async () => {
      await montar(comFinalPublicado(null));
      await abrirEdital();
      const destaque = secao.querySelector(".classificacao-fora-da-lista");
      expect(destaque.textContent).toContain(
        "Publicado, mas ainda não está na Lista de aprovados.",
      );
      expect(
        destaque.querySelector("[data-acao='publicar-aprovados']"),
      ).not.toBeNull();
      // O botão fica só no destaque, sem repetir na linha das ações.
      expect(
        secao.querySelectorAll("[data-acao='publicar-aprovados']"),
      ).toHaveLength(1);
      expect(secao.querySelector("[data-acao='publicar']")).toBeNull();
    });

    it("a lista vigente veio deste resultado final: sem botão, a linha diz", async () => {
      await montar(
        comFinalPublicado({
          ...structuredClone(VIGENTE.vigente),
          origem: "CLASSIFICACAO",
          lista_classificacao_id: "l9",
        }),
      );
      await abrirEdital();
      expect(secao.querySelector(".classificacao-fora-da-lista")).toBeNull();
      expect(
        secao.querySelector("[data-acao='publicar-aprovados']"),
      ).toBeNull();
      expect(secao.querySelector("[data-geracao='l9']").textContent).toContain(
        "· publicada · na Lista de aprovados",
      );
    });

    it("o atalho da Lista de aprovados abre a lista pedida", async () => {
      await montar(comFinalPublicado(null));
      pedirFiltro("classificacao", {
        editalId: "e83",
        tipoDeLista: "PRELIMINAR",
      });
      await abrirEdital();
      expect(
        secao
          .querySelector(".classificacao-tipos [data-valor='PRELIMINAR']")
          .getAttribute("aria-checked"),
      ).toBe("true");
    });

    it("leitor não vê o botão de publicar", async () => {
      const supabase = supabaseFalso({
        obter_classificacao_do_edital: () => ({
          ...structuredClone(EDITAL),
          pode_editar: false,
          listas: [
            {
              id: "l9",
              tipo: "FINAL",
              versao_regra: 2,
              hash: "b".repeat(64),
              gerada_em: "2026-10-02T13:00:00Z",
              pendencias: 0,
              publicada: false,
            },
          ],
        }),
      });
      await montar(supabase);
      await abrirEdital();
      expect(
        secao.querySelector("[data-acao='publicar-aprovados']"),
      ).toBeNull();
    });
  });

  describe("Classificação: aguardando análise e geração guardada desatualizada", () => {
    const comPendente = (extra = {}) =>
      supabaseFalso({
        obter_classificacao_do_edital: () => ({
          ...structuredClone(EDITAL),
          candidatos: [
            ...structuredClone(EDITAL.candidatos),
            candidato(5, "Eva Pendente", null, { status: "Pendente" }),
          ],
          ...extra,
        }),
      });
    const kpi = (c) =>
      secao.querySelector(`[data-kpi="${c}"] .ui-kpi-valor`)?.textContent;

    it("quem não foi analisado não é eliminado: KPI e lista à parte", async () => {
      await montar(comPendente());
      await abrirEdital();
      expect([
        numeroDaFaixa("ELIMINADOS"),
        numeroDaFaixa("AGUARDANDO"),
      ]).toEqual(["1", "1"]);
      // Quem aguarda fica na mesma tabela, com a etiqueta dele (não é eliminado).
      const aguardando = tabelaDaLista().querySelector("tr[data-aguardando]");
      expect(aguardando.textContent).toContain("Eva Pendente");
      expect(aguardando.textContent).toContain("Aguardando análise");
      expect(
        tabelaDaLista().querySelectorAll("tr[data-eliminado]"),
      ).toHaveLength(1);
    });

    it("geração de 13/10 com outros números: avisa e bloqueia 'Marcar como publicada'", async () => {
      const supabase = comPendente({
        listas: [
          {
            id: "l0",
            tipo: "FINAL",
            versao_regra: 2,
            hash: "a".repeat(64),
            gerada_em: "2026-10-13T19:10:10Z",
            por: "Ana",
            elegiveis: 1,
            eliminados: 1576,
            pendencias: 0,
            publicada: false,
          },
        ],
      });
      await montar(supabase);
      await abrirEdital();
      expect(secao.querySelector(".classificacao-defasada").textContent).toBe(
        "Esta geração é de 13/10/2026, 16:10; os dados mudaram desde então — gere de novo.",
      );
      expect(secao.querySelector("[data-acao='publicar']").disabled).toBe(true);
    });
  });

  describe("Classificação: convocação e publicação conferidas", () => {
    const LISTA_GUARDADA = {
      id: "l0",
      tipo: "FINAL",
      versao_regra: 2,
      hash: "a".repeat(64),
      gerada_em: "2026-10-21T19:10:10Z",
      por: "Ana",
      pendencias: 0,
      publicada: false,
    };

    /* O retrato que o "Gerar" grava com os dados de EDITAL. */
    async function retratoGerado() {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "registrar_lista_classificacao",
      );
      await act(async () => painel.raiz.unmount());
      secao.remove();
      toast.mockClear();
      return chamada[1].p_resultado;
    }

    /* O edital com a lista l0 já registrada; `notaDoCaio` muda os dados depois da geração. */
    function comListaGuardada(
      retrato,
      { notaDoCaio = "9,0", extra = {} } = {},
    ) {
      return supabaseFalso({
        obter_classificacao_do_edital: () => {
          const edital = structuredClone(EDITAL);
          edital.candidatos[2].nota_documental = notaDoCaio;
          return { ...edital, listas: [structuredClone(LISTA_GUARDADA)] };
        },
        obter_lista_classificacao: () => ({
          lista: structuredClone(LISTA_GUARDADA),
          resultado: structuredClone(retrato),
        }),
        ...extra,
      });
    }
    const chamou = (supabase, nome) =>
      supabase.rpc.mock.calls.some(([n]) => n === nome);

    it("falha de rede na convocação: avisa, bloqueia o Gerar e libera ao ler de novo", async () => {
      let falhar = true;
      const supabase = supabaseFalso({
        listar_configuracao_convocacao: () => {
          if (falhar) throw new Error("Failed to fetch");
          return [];
        },
      });
      await montar(supabase);
      await abrirEdital();
      const aviso = secao.querySelector(".classificacao-erro-convocacao");
      expect(aviso.textContent).toContain(
        "Não foi possível carregar a convocação do edital",
      );
      expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(true);

      falhar = false;
      await clicar(aviso.querySelector("[data-acao='tentar-novamente']"));
      await esperar();
      expect(secao.querySelector(".classificacao-erro-convocacao")).toBeNull();
      expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(false);
    });

    it("sem acesso à convocação (42501): segue com a regra, sem aviso", async () => {
      const supabase = supabaseFalso({
        listar_configuracao_convocacao: () => {
          throw Object.assign(new Error("sem acesso"), { code: "42501" });
        },
      });
      await montar(supabase);
      await abrirEdital();
      expect(secao.querySelector(".classificacao-erro-convocacao")).toBeNull();
      expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(false);
    });

    it("'Marcar como publicada' confere o retrato: nota mudou, não publica e pede para gerar de novo", async () => {
      const retrato = await retratoGerado();
      const supabase = comListaGuardada(retrato, { notaDoCaio: "9,5" });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='publicar']"));
      await esperar();
      expect(toast).toHaveBeenCalledWith(
        expect.stringContaining("Gere de novo antes de publicar"),
        "error",
      );
      expect(chamou(supabase, "publicar_lista_classificacao")).toBe(false);
    });

    it("'Marcar como publicada' com o retrato em dia publica e mostra 'Publicando…' enquanto espera", async () => {
      const retrato = await retratoGerado();
      const supabase = comListaGuardada(retrato);
      const responder = supabase.rpc;
      let soltar;
      supabase.rpc = vi.fn((nome, args) =>
        nome === "publicar_lista_classificacao"
          ? new Promise((resolver) => {
              soltar = () =>
                resolver({
                  data: { ...LISTA_GUARDADA, publicada: true },
                  error: null,
                });
            })
          : responder(nome, args),
      );
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='publicar']"));
      await esperar();
      const enviando = secao.querySelector("[data-acao='publicar']");
      expect(enviando.textContent).toBe("Publicando…");
      expect(enviando.disabled).toBe(true);
      await act(async () => soltar());
      await esperar();
      expect(toast).toHaveBeenCalledWith(
        "Lista marcada como publicada.",
        "success",
      );
    });

    it("'Publicar como lista de aprovados' também confere: nota mudou, a prévia pede para gerar de novo", async () => {
      const retrato = await retratoGerado();
      const supabase = comListaGuardada(retrato, {
        notaDoCaio: "9,5",
        extra: { obter_publicacao_lista_aprovados: () => ({ vigente: null }) },
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='publicar-aprovados']"));
      await esperar();
      const modal = document.getElementById("classificacaoPublicarAprovados");
      expect(modal.querySelector("[role='alert']").textContent).toContain(
        "Gere de novo antes de publicar",
      );
      expect(
        modal.querySelector("[data-acao='confirmar-publicacao-aprovados']"),
      ).toBeNull();
      expect(chamou(supabase, "pedir_casamento_da_lista")).toBe(false);
    });
  });

  /*
  Etapa 2b (20261023200000): com a chave "Gerar listas pelo Python" ligada, o
  "Gerar" pede o cálculo ao Python, espera o job ("Calculando a lista…"),
  recebe o retrato, calcula o mesmo com o motor.ts e só registra quando são
  iguais (registrar_lista_calculada). Desligada, tudo como antes.
*/
  describe("Gerar com a lista calculada pelo Python", () => {
    const PEDIDO = "aaaaaaaa-1111-4111-8111-111111111111";
    const nomes = (supabase) => supabase.rpc.mock.calls.map(([nome]) => nome);
    /* O retrato que o Python calcularia com os mesmos dados, como o jsonb devolve (chaves em outra ordem). */
    function retratoDoPython(mexer = (r) => r) {
      const dados = painel.estado.obter().dados;
      const retrato = retratoDaClassificacao(
        instantaneoDaLista(calcularClassificacao(dados, "FINAL"), {
          edital: dados.edital,
          regra: dados.regra.configuracao,
          versao: dados.regra.versao,
        }),
      );
      const invertido = (v) =>
        Array.isArray(v)
          ? v.map(invertido)
          : v && typeof v === "object"
            ? Object.fromEntries(
                Object.entries(v)
                  .reverse()
                  .map(([k, x]) => [k, invertido(x)]),
              )
            : v;
      return invertido(mexer(JSON.parse(JSON.stringify(retrato))));
    }
    function ligada({
      situacoes = ["CALCULANDO", "PRONTO"],
      mexer,
      extra = {},
    } = {}) {
      const fila = [...situacoes];
      return supabaseFalso({
        pedir_calculo_classificacao: ({ p_tipo }) => ({
          ligada: true,
          pedido: PEDIDO,
          tipo: p_tipo,
          situacao: "PEDIDO",
          mensagem: null,
        }),
        obter_calculo_classificacao: ({ p_com_retrato }) => {
          const situacao = p_com_retrato ? "PRONTO" : fila.shift() || "PRONTO";
          return {
            pedido: PEDIDO,
            tipo: "FINAL",
            situacao,
            mensagem:
              situacao === "FALHOU"
                ? "A regra do edital mudou desde o pedido; gere a lista de novo."
                : null,
            retrato: p_com_retrato ? retratoDoPython(mexer) : null,
          };
        },
        registrar_lista_calculada: () => ({
          id: "l1",
          tipo: "FINAL",
          versao_regra: 2,
          hash: "e".repeat(64),
          gerada_em: "2026-10-23T13:00:00Z",
          por: "Gestora",
          pendencias: 0,
          publicada: false,
        }),
        registrar_divergencia_do_calculo: ({ p_pedido }) => ({
          pedido: p_pedido,
          situacao: "NAO_CONFERE",
        }),
        ...extra,
      });
    }
    async function gerarEsperando(supabase, passos = 2) {
      await montar(supabase);
      await abrirEdital();
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      const enquanto = {
        texto: secao.querySelector("[data-calculo='calculando']")?.textContent,
        gerarDesabilitado: secao.querySelector("[data-acao='gerar']").disabled,
      };
      for (let i = 0; i < passos; i += 1) {
        await act(async () => void vi.advanceTimersByTime(3000));
        await esperar();
      }
      return enquanto;
    }
    afterEach(() => vi.useRealTimers());

    it("desligada: registra pelo cálculo da tela, como antes, sem esperar o Python", async () => {
      const supabase = supabaseFalso({
        pedir_calculo_classificacao: () => ({ ligada: false }),
      });
      await montar(supabase);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      expect(nomes(supabase)).toContain("registrar_lista_classificacao");
      expect(nomes(supabase)).not.toContain("obter_calculo_classificacao");
      expect(nomes(supabase)).not.toContain("registrar_lista_calculada");
      expect(secao.querySelector("[data-calculo]")).toBeNull();
      expect(secao.querySelector("[data-geracao='l1']")).not.toBeNull();
    });

    it("ligada e igual: espera o job, confere e registra o retrato do Python", async () => {
      const supabase = ligada();
      const enquanto = await gerarEsperando(supabase);
      expect(enquanto.texto).toBe("Calculando a lista… (até 5 min)");
      expect(enquanto.gerarDesabilitado).toBe(true);
      expect(nomes(supabase)).not.toContain("registrar_lista_classificacao");
      const chamada = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "registrar_lista_calculada",
      );
      expect(chamada[1].p_pedido).toBe(PEDIDO);
      expect(chamada[1].p_resultado.vagas[0].geral.map((l) => l.nome)).toEqual([
        "Ana Empatada",
        "Bia Empatada",
        "Caio Parda",
      ]);
      expect(nomes(supabase)).not.toContain("registrar_divergencia_do_calculo");
      expect(secao.querySelector("[data-calculo]")).toBeNull();
      expect(secao.querySelector("[data-geracao='l1']")).not.toBeNull();
      expect(toast).toHaveBeenCalledWith(
        "Lista gerada e registrada.",
        "success",
      );
    });

    it("ligada e diferente: avisa, não registra e grava só os caminhos da diferença", async () => {
      const supabase = ligada({
        mexer: (r) => {
          r.vagas[0].geral[0].posicao = 9;
          return r;
        },
      });
      await gerarEsperando(supabase);
      expect(nomes(supabase)).not.toContain("registrar_lista_calculada");
      expect(nomes(supabase)).not.toContain("registrar_lista_classificacao");
      const divergencia = supabase.rpc.mock.calls.find(
        ([nome]) => nome === "registrar_divergencia_do_calculo",
      )[1];
      expect(divergencia).toEqual({
        p_pedido: PEDIDO,
        p_total: 1,
        p_caminhos: ["vagas[0].geral[0].posicao"],
      });
      const aviso = secao.querySelector("[data-calculo='diferente']");
      expect(aviso.textContent).toContain(
        "O cálculo em Python não confere com o da tela (1 diferença(s)); a lista não foi registrada.",
      );
      expect(secao.querySelector("[data-geracao]")).toBeNull();
      // Tentar de novo: um pedido novo.
      await clicar(secao.querySelector("[data-acao='tentar-calculo']"));
      expect(
        nomes(supabase).filter((n) => n === "pedir_calculo_classificacao"),
      ).toHaveLength(2);
    });

    it("ligada e o banco não confirma a igualdade: não registra e avisa", async () => {
      const supabase = ligada({
        extra: {
          registrar_lista_calculada: () => ({
            nao_confere: true,
            pedido: PEDIDO,
          }),
        },
      });
      await gerarEsperando(supabase);
      expect(
        secao.querySelector("[data-calculo='diferente']").textContent,
      ).toContain("O banco não confirmou");
      expect(secao.querySelector("[data-geracao]")).toBeNull();
    });

    it("ligada e o job falhou, ou o pedido não saiu: o motivo e Tentar de novo", async () => {
      const supabase = ligada({ situacoes: ["FALHOU"] });
      await gerarEsperando(supabase, 1);
      expect(
        secao.querySelector("[data-calculo='falhou']").textContent,
      ).toContain("A regra do edital mudou desde o pedido");
      expect(
        secao.querySelector("[data-acao='tentar-calculo']"),
      ).not.toBeNull();
      expect(nomes(supabase)).not.toContain("registrar_lista_calculada");
      await act(async () => painel.raiz.unmount());
      secao.remove();
      vi.useRealTimers();

      const semDisparo = supabaseFalso({
        pedir_calculo_classificacao: () => ({
          ligada: true,
          pedido: PEDIDO,
          situacao: "SEM_DISPARO",
          mensagem: "O pedido ao GitHub não saiu (SEM_TOKEN).",
        }),
      });
      await montar(semDisparo);
      await abrirEdital();
      await clicar(secao.querySelector("[data-acao='gerar']"));
      await esperar();
      expect(
        secao.querySelector("[data-calculo='falhou']").textContent,
      ).toContain("O pedido ao GitHub não saiu (SEM_TOKEN).");
      expect(nomes(semDisparo)).not.toContain("obter_calculo_classificacao");
      expect(secao.querySelector("[data-acao='gerar']").disabled).toBe(false);
    });
  });

  describe("família da seleção na Classificação: encontrar a pessoa, cards e ⋯", () => {
    const nomesNaVaga = () =>
      [
        ...secao.querySelectorAll(
          "[data-tour='classificacao-lista'] tbody tr[data-candidato]",
        ),
      ].map((tr) => tr.querySelector(".classificacao-nome").textContent);

    it("a barra fica à vista: busca pelo código, situação e o filtro volta no F5", async () => {
      const supabase = supabaseFalso();
      await montar(supabase);
      await abrirEdital();
      const barra = secao.querySelector(
        ".ui-barra-da-lista.classificacao-filtros",
      );
      expect(barra.getAttribute("aria-label")).toBe("Encontrar a pessoa");
      expect(
        tabelaDaLista().querySelector(".ui-lista-contagem").textContent,
      ).toBe("Mostrando 4 de 4");
      // O código da inscrição (103) acha a Caio, que a lista não mostra.
      await digitar(
        barra.querySelector("[data-acao='buscar-candidato']"),
        "103",
      );
      expect(nomesNaVaga()).toEqual(["Caio Parda"]);
      expect(
        barra.querySelector("[data-acao='limpar-filtros']"),
      ).not.toBeNull();
      expect(
        JSON.parse(
          sessionStorage.getItem("monitora:classificacao:recorte:e83"),
        ),
      ).toMatchObject({ busca: "103" });

      // F5: a tela monta de novo e o recorte do edital volta.
      await act(async () => painel.raiz.unmount());
      secao.remove();
      await montar(supabase);
      await abrirEdital();
      expect(secao.querySelector("[data-acao='buscar-candidato']").value).toBe(
        "103",
      );
      await clicar(secao.querySelector("[data-acao='limpar-filtros']"));
      expect(nomesNaVaga()).toHaveLength(3);
      expect(
        sessionStorage.getItem("monitora:classificacao:recorte:e83"),
      ).toBeNull();
    });

    it("os cards filtram a situação: Eliminados abre a lista deles; de novo, volta a todas", async () => {
      await montar(supabaseFalso());
      await abrirEdital();
      const card = () =>
        secao.querySelector(
          "[data-tour='classificacao-kpis'] [data-valor='ELIMINADOS']",
        );
      await clicar(card());
      expect(card().getAttribute("aria-pressed")).toBe("true");
      expect(nomesNaVaga()).toEqual([]);
      // O número é o total da lista que ele abre.
      const eliminados = [
        ...tabelaDaLista().querySelectorAll("tbody tr[data-eliminado]"),
      ];
      expect(String(eliminados.length)).toBe(numeroDaFaixa("ELIMINADOS"));
      expect(eliminados[0].textContent).toContain("Davi <b>Reprovado</b>");
      // A situação também está em "Filtros" (os secundários).
      await clicar(secao.querySelector("[data-acao='mais-filtros']"));
      expect(secao.querySelector("[data-acao='filtro-situacao']").value).toBe(
        "ELIMINADOS",
      );
      await clicar(card());
      expect(nomesNaVaga()).toHaveLength(3);
    });

    it("Ver posição abre a explicação; o ⋯ registra o empate da pessoa e copia o código", async () => {
      const copiado = vi.fn(async () => {});
      Object.defineProperty(globalThis.navigator, "clipboard", {
        configurable: true,
        value: { writeText: copiado },
      });
      await montar(supabaseFalso());
      await abrirEdital();
      const linha = secao.querySelector(
        `[data-tour='classificacao-lista'] tr[data-candidato='${A(1)}']`,
      );
      await clicar(linha.querySelector("[data-acao='ver-posicao']"));
      expect(
        document.getElementById("classificacaoCandidato").textContent,
      ).toContain("Ana Empatada");
      await clicar(
        document.querySelector("#classificacaoCandidato .ui-gaveta-fechar"),
      );
      await clicar(linha.querySelector("[data-acao='abrir-menu']"));
      expect(
        [...linha.querySelectorAll("[role='menuitem']")].map((b) =>
          b.textContent.trim(),
        ),
      ).toEqual(["Registrar sorteio do empate", "Copiar código"]);
      await clicar(linha.querySelector("[data-acao='linha-copiar-codigo']"));
      await esperar();
      expect(copiado).toHaveBeenCalledWith("101");
      expect(secao.textContent).toContain("Código 101 copiado.");
      await clicar(linha.querySelector("[data-acao='abrir-menu']"));
      await clicar(linha.querySelector("[data-acao='linha-resolver-empate']"));
      expect(document.body.textContent).toContain("Sorteio do empate");
      delete globalThis.navigator.clipboard;
    });

    it("a tabela mostra 50 e mais 50 ao chegar no fim da rolagem", async () => {
      // IntersectionObserver falso: `chegarAoFim` faz o que a rolagem faria.
      const observadores = [];
      const original = globalThis.IntersectionObserver;
      globalThis.IntersectionObserver = class {
        constructor(aviso) {
          this.aviso = aviso;
          observadores.push(this);
        }
        observe() {}
        disconnect() {
          observadores.splice(observadores.indexOf(this), 1);
        }
      };
      const chegarAoFim = () =>
        act(async () => {
          for (const o of [...observadores])
            o.aviso([{ isIntersecting: true }]);
        });
      const muitos = Array.from({ length: 60 }, (_, i) =>
        candidato(
          i + 1,
          `Pessoa ${String(i + 1).padStart(2, "0")}`,
          `${70 - i},0`,
        ),
      ).map((c, i) => ({ ...c, analise_id: `a-${i}`, codigo: `9${i}` }));
      await montar(
        supabaseFalso({
          obter_classificacao_do_edital: () => ({
            ...structuredClone(EDITAL),
            candidatos: muitos,
            entrevistas: [],
            desempates: [],
          }),
        }),
      );
      await abrirEdital();
      try {
        expect(nomesNaVaga()).toHaveLength(50);
        await chegarAoFim();
        expect(nomesNaVaga()).toHaveLength(60);
        expect(
          tabelaDaLista().querySelector(".ui-lista-contagem").textContent,
        ).toBe("Mostrando 60 de 60");
      } finally {
        globalThis.IntersectionObserver = original;
      }
    });
  });
});

bloco("modulos/documentos-no-navegador", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    delete document.execCommand;
    document.body.innerHTML = "";
  });

  describe("cópia do documento para o SEI", () => {
    it("a API leva HTML e texto juntos", async () => {
      const write = vi.fn().mockResolvedValue(undefined);
      class Item {
        constructor(dados) {
          this.dados = dados;
        }
      }
      expect(
        await copiarParaAreaDeTransferencia(
          { html: "<b>Ana</b>", texto: "Ana" },
          { navegador: { clipboard: { write } }, documento: null, Item },
        ),
      ).toBe("html");
      expect(Object.keys(write.mock.calls[0][0][0].dados)).toEqual([
        "text/html",
        "text/plain",
      ]);
    });
    it("a recusa da API tenta o evento copy e remove o listener", async () => {
      const setData = vi.fn(),
        remover = vi.spyOn(document, "removeEventListener");
      const evento = new Event("copy", { cancelable: true });
      Object.defineProperty(evento, "clipboardData", { value: { setData } });
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        value: vi.fn(() => {
          document.dispatchEvent(evento);
          return true;
        }),
      });
      class Item {}
      expect(
        await copiarParaAreaDeTransferencia(
          { html: "<b>Ana</b>", texto: "Ana" },
          {
            navegador: {
              clipboard: {
                write: vi.fn().mockRejectedValue(new Error("sem acesso")),
              },
            },
            documento: document,
            Item,
          },
        ),
      ).toBe("html");
      expect(setData.mock.calls).toEqual([
        ["text/html", "<b>Ana</b>"],
        ["text/plain", "Ana"],
      ]);
      expect(remover).toHaveBeenCalledWith("copy", expect.any(Function));
      expect(evento.defaultPrevented).toBe(true);
    });
    it("sem suporte a HTML usa o texto", async () => {
      const writeText = vi.fn().mockResolvedValue(undefined);
      expect(
        await copiarParaAreaDeTransferencia(
          { html: "<b>Ana</b>", texto: "Ana" },
          {
            navegador: { clipboard: { writeText } },
            documento: null,
            Item: null,
          },
        ),
      ).toBe("texto");
      expect(writeText).toHaveBeenCalledWith("Ana");
    });
    it("uma cópia recusada não informa sucesso", async () => {
      expect(
        await copiarParaAreaDeTransferencia(
          { html: "", texto: "Ana" },
          {
            navegador: {
              clipboard: {
                writeText: vi.fn().mockRejectedValue(new Error("sem acesso")),
              },
            },
            documento: null,
            Item: null,
          },
        ),
      ).toBe("");
    });
  });

  function prepararLogo() {
    vi.stubGlobal("Blob", BlobDoNode);
    const fetch = vi
      .fn()
      .mockResolvedValue({ ok: true, blob: async () => new BlobDoNode() });
    vi.stubGlobal("fetch", fetch);
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 100, height: 50, close }),
    );
    const contexto = { fillStyle: "", fillRect: vi.fn(), drawImage: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      contexto,
    );
    vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
      (callback) => callback(new BlobDoNode([new Uint8Array([1, 2, 3])])),
    );
    return { fetch, close, contexto };
  }
  describe("logo em PNG", () => {
    it("compartilha a conversão da mesma URL e largura", async () => {
      const { fetch, close, contexto } = prepararLogo();
      const a = logoEmPng("/cache-compartilhado.webp", { largura: 200 });
      const b = logoEmPng("/cache-compartilhado.webp", { largura: 200 });
      expect(a).toBe(b);
      expect(await a).toEqual({
        bytes: new Uint8Array([1, 2, 3]),
        largura: 200,
        altura: 100,
      });
      expect(fetch).toHaveBeenCalledTimes(1);
      expect(close).toHaveBeenCalledTimes(1);
      expect(contexto.fillStyle).toBe("#ffffff");
    });
    it("outra URL ou largura recebe sua própria conversão", async () => {
      const { fetch } = prepararLogo();
      const a = await logoEmPng("/marca-a.webp", { largura: 200 });
      const b = await logoEmPng("/marca-b.webp", { largura: 300 });
      const c = await logoEmPng("/marca-b.webp", { largura: 400 });
      expect([a.largura, b.largura, c.largura]).toEqual([200, 300, 400]);
      expect(fetch).toHaveBeenCalledTimes(3);
    });
    it("uma falha permite tentar novamente", async () => {
      const { fetch } = prepararLogo();
      fetch.mockRejectedValueOnce(new Error("rede"));
      expect(await logoEmPng("/tentar-novamente.webp")).toBeNull();
      expect(await logoEmPng("/tentar-novamente.webp")).not.toBeNull();
      expect(fetch).toHaveBeenCalledTimes(2);
    });
    it("canvas indisponível libera a imagem e volta ao timbrado textual", async () => {
      const { close } = prepararLogo();
      HTMLCanvasElement.prototype.getContext.mockReturnValue(null);
      expect(await logoEmPng("/sem-canvas.webp")).toBeNull();
      expect(close).toHaveBeenCalledTimes(1);
    });
    it("largura inválida não inicia a conversão", async () => {
      const { fetch } = prepararLogo();
      expect(
        await logoEmPng("/largura-invalida.webp", { largura: 0 }),
      ).toBeNull();
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe("impressão", () => {
    it("usa iframe sem script e o remove após a impressão", () => {
      vi.useFakeTimers();
      imprimirPagina("<p>Ana</p>");
      const quadro = document.querySelector("iframe");
      expect(quadro.getAttribute("sandbox")).toBe(
        "allow-modals allow-same-origin",
      );
      expect(quadro.srcdoc).toBe("<p>Ana</p>");
      vi.spyOn(quadro.contentWindow, "print").mockImplementation(() => {});
      vi.spyOn(quadro.contentWindow, "focus").mockImplementation(() => {});
      quadro.dispatchEvent(new Event("load"));
      quadro.contentWindow.dispatchEvent(new Event("afterprint"));
      vi.advanceTimersByTime(500);
      expect(document.querySelector("iframe")).toBeNull();
    });
  });
});

bloco("modulos/conduzir-entrevistas", async () => {
  /*
  "Conduzir entrevistas" (view `conduzir-entrevistas`), o fazer, separado do
  Painel de entrevistas: monta na própria `#page-conduzir-entrevistas`, abre
  pelo render() (a área atual do app; o último edital da área ou o único da
  lista abre sozinho), Fila (Hoje / Próximos / Todos pela agenda salva,
  situações, contador "X de Y hoje", ficha em tela cheia, comemoração ao
  concluir o dia) e Preparar (configuração, convocação, roteiros e o
  desempate só leitura da Classificação).
*/

  const { guardaDeAlteracoes } =
    await import("../src/app/guarda-de-alteracoes.ts");
  const { criarConducaoDeEntrevistas } =
    await import("../src/modulos/entrevistas/conduzir.tsx");
  // Preparar baixa sob demanda (lazy): já carregado aqui, o import da tela resolve na hora.
  await import("../src/modulos/entrevistas/preparar.tsx");

  let secao;
  let tela;
  /*
  O roteiro e a banca do edital se editam nas Regras do edital (etapa
  Entrevista), com o editor de editor-da-configuracao.tsx sobre a loja de
  condução; Preparar só mostra o gravado com "Editar nas Regras do edital".
*/
  let regras = null;
  async function abrirConfiguracaoNasRegras(supabase) {
    regras = await montarRegrasDoEdital({
      supabase,
      editalId: "m1",
      etapa: "entrevista",
    });
    for (let i = 0; i < 20; i += 1) {
      const editor = regras.secao.querySelector(
        "[data-tour='regras-do-edital-entrevista']",
      );
      if (editor) return editor;
      await esperar();
    }
    throw new Error("O editor da entrevista não abriu.");
  }

  const toast = vi.fn();
  const aoMudarResultados = vi.fn();
  const aoComemorar = vi.fn();
  const HOJE = "2026-10-07";

  function memoria() {
    const mapa = new Map();
    return {
      mapa,
      getItem: (chave) => mapa.get(chave) ?? null,
      setItem: (chave, valor) => void mapa.set(chave, String(valor)),
    };
  }
  let guardado = memoria();

  async function montar(
    supabase,
    {
      abrir = true,
      comemoracoesLigadas = () => true,
      perfilDoApp,
      ...opcoes
    } = {},
  ) {
    secao = document.createElement("section");
    secao.id = "page-conduzir-entrevistas";
    secao.className = "page active";
    document.body.append(secao);
    await act(async () => {
      tela = montarTela(
        perfilDoApp === undefined
          ? criarConducaoDeEntrevistas
          : comPerfilDoApp(criarConducaoDeEntrevistas, perfilDoApp),
        "page-conduzir-entrevistas",
        {
          secao,
          supabase,
          toast,
          aoMudarResultados,
          aoComemorar,
          comemoracoesLigadas,
          hojeDe: () => HOJE,
          horaDe: () => "08:30",
          armazenamento: () => guardado,
          ...opcoes,
        },
      );
    });
    if (abrir) {
      await act(async () => void tela.render());
      await esperar();
    }
    return tela;
  }

  const naTela = (texto) => document.body.textContent.includes(texto);

  beforeEach(() => {
    redefinirDadosDoMonitoramento();
    definirAreaAtual("saude-indigena");
    guardado = memoria();
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(async () => {
    await act(async () => regras?.raiz?.unmount());
    regras = null;
    await act(async () => tela?.raiz?.unmount());
    secao?.remove();
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
    toast.mockClear();
    aoMudarResultados.mockClear();
    aoComemorar.mockClear();
  });

  /*
  Preparar (configuração e convocação), roteiros (versão nova), ficha de
  notas (prévia do parecer, modo AVALIADOR, erros do banco) e o aviso ao
  painel depois de gravar.
*/

  const PERFIL_DA_ANA = "11111111-1111-4111-8111-111111111111";

  const ROTEIRO = {
    id: "r1",
    origem: "r1",
    versao: 1,
    area: "saude-indigena",
    nome: "Saúde Indígena 2026",
    descricao: null,
    etapa: "Entrevista Individual",
    escala: "NIVEIS",
    passo: 1,
    notas_permitidas: [],
    nota_minima_total: 4,
    notas_eliminatorias: [0, 1],
    ausencia_elimina: true,
    desempate: ["Idade igual ou superior a 60 anos"],
    soma_analise: true,
    convocacao_padrao: {
      multiplo_imediatas: 5,
      posicao_cadastro_reserva: 10,
      excecoes: [],
    },
    banca_padrao: [{ origem: "AgSUS", quantidade: 1 }],
    ativo: true,
    competencias: [
      {
        id: "c1",
        ordem: 1,
        nome: "Políticas públicas",
        descricao: "SUS e SasiSUS",
        nota_maxima: 5,
        peso: 1,
        minimo: 2,
        tipo_minimo: "VALOR",
        avaliacao: "INDIVIDUAL",
      },
      {
        id: "c2",
        ordem: 2,
        nome: "Habilidade interpessoal",
        descricao: null,
        nota_maxima: 5,
        peso: 1,
        minimo: 2,
        tipo_minimo: "VALOR",
        avaliacao: "INDIVIDUAL",
      },
    ],
    niveis: [0, 1, 2, 3, 4, 5].map((nota) => ({
      nota,
      nome: `Nível ${nota}`,
      descricao: `Parâmetro ${nota}`,
    })),
    editais_em_uso: 1,
  };

  const EDITAL = {
    edital: {
      id: "m1",
      edital: "100/2026",
      unidade: "CASAI Brasília",
      area: "saude-indigena",
    },
    pode_editar: true,
    pode_gerar_lista: true,
    admin_global: false,
    meu_perfil: PERFIL_DA_ANA,
    configuracao: {
      roteiro: ROTEIRO,
      banca: [{ origem: "AgSUS", quantidade: 1 }],
      lancamento: "SECRETARIA",
      atualizado_em: "2026-09-30T12:00:00Z",
    },
    regra_classificacao: {
      versao: 2,
      convocacao: {
        multiplo_vagas: 1,
        posicao_max_cr: 1,
        incluir_empatados: true,
        excecoes: [],
      },
    },
    // A convocação é a lista CONVOCACAO da Classificação (1× 2 vagas: os dois primeiros).
    lista_convocacao: {
      lista: {
        id: "lista1",
        tipo: "CONVOCACAO",
        versao_regra: 2,
        gerada_em: "2026-10-05T13:30:00Z",
        por: "Gestora",
        publicada: false,
      },
      retrato: {
        schema: 1,
        tipo: "CONVOCACAO",
        vagas: [
          {
            chave: "V1",
            codigo: "V1",
            cargo: "Enfermeiro",
            lotacao: "Polo Base",
            cabecalho: "VAGA V1 - Enfermeiro",
            total: 2,
            cadastro_reserva: false,
            origem_das_vagas: "QUADRO",
            limite_convocacao: { limite: 2, origem: "1 × 2 vaga(s)" },
            geral: [1, 2].map((posicao) => ({
              posicao,
              analise_id: `an${posicao}`,
              nome: `Candidato ${posicao}`,
              nota: 90 - posicao,
              modalidades: ["AC"],
            })),
            listas: {},
            eliminados: [
              {
                analise_id: "an3",
                nome: "Candidato 3",
                motivo: "FORA_DO_LIMITE",
              },
            ],
          },
        ],
      },
    },
    avaliadores: [
      {
        id: "a1",
        nome: "Ana",
        origem: "AgSUS",
        banca: 1,
        perfil: PERFIL_DA_ANA,
        ativo: true,
      },
      {
        id: "a2",
        nome: "Beto",
        origem: "CONDISI",
        banca: 1,
        perfil: null,
        ativo: true,
      },
    ],
    convocados: [
      {
        id: "e1",
        analise_id: "an1",
        candidato: "Candidato 1",
        codigo: "K1",
        vaga: "V1",
        cargo: "Enfermeiro",
        modalidade: "Ampla",
        banca: 1,
        compareceu: null,
        nota: null,
        parecer: "SEM_PARECER",
        nota_analise: 89,
        avaliacoes: [],
        notas: [],
      },
    ],
  };

  function supabaseDaConducao({ edital = EDITAL, respostas = {} } = {}) {
    const padrao = {
      listar_roteiros_entrevista: () => ({ data: [ROTEIRO], error: null }),
      listar_editais_entrevista: () => ({
        data: {
          admin_global: false,
          editais: [
            {
              id: "m1",
              edital: "100/2026",
              unidade: "CASAI Brasília",
              na_janela: true,
              visivel_por: "janela",
            },
          ],
        },
        error: null,
      }),
      obter_entrevistas_do_edital: () => ({ data: edital, error: null }),
      obter_previsao_entrevista_edital: () => ({
        data: {
          situacao: "NAO_INFORMADA",
          motivo: null,
          pode_alterar: false,
        },
        error: null,
      }),
      definir_previsao_entrevista_edital: () => ({
        data: {
          situacao: "PREVISTA",
          motivo: "Conforme edital",
          pode_alterar: true,
        },
        error: null,
      }),
      salvar_roteiro_entrevista: (args) => ({
        data: { ...ROTEIRO, id: "r1b", versao: 2, nome: args.p_dados.nome },
        error: null,
      }),
      configurar_entrevista_edital: () => ({ data: edital, error: null }),
      convocar_para_entrevista: () => ({
        data: { convocados: 1, dados: edital },
        error: null,
      }),
      lancar_notas_entrevista: () => ({ data: edital, error: null }),
    };
    return {
      rpc: vi.fn(async (nome, args) => (respostas[nome] || padrao[nome])(args)),
      auth: {
        getSession: async () => ({ data: { session: { user: { id: "u" } } } }),
      },
    };
  }

  const visao = (valor) =>
    document.querySelector(
      `.ui-cabecalho-da-tela .entrevistas-visoes button[data-valor="${valor}"]`,
    );
  /* Abre a ficha pela linha da fila: o botão dela (Iniciar, Continuar, Ver…) ou "Ver ficha" no ⋯. */
  async function abrirLinha(id) {
    const linha = document.querySelector(`tr[data-convocado="${id}"]`);
    const botao = linha?.querySelector("[data-acao='abrir-ficha']");
    if (botao) return clicar(botao);
    await clicar(linha?.querySelector("[data-acao='abrir-menu']"));
    return clicar(linha?.querySelector("[data-acao='linha-ver-ficha']"));
  }
  const chamadas = (supabase, nome) =>
    supabase.rpc.mock.calls.filter(([n]) => n === nome);

  /* O edital (único na lista) abre sozinho no render(); Preparar mostra os passos. */
  async function abrirEdital() {
    await clicar(visao("preparar"));
    await esperar();
    await preparado();
  }

  /* Preparar baixa sob demanda (lazy): espera os passos aparecerem. */
  async function preparado() {
    for (
      let i = 0;
      i < 100 && !document.querySelector(".entrevistas-passos");
      i++
    )
      await esperar(() => new Promise((resolver) => setTimeout(resolver, 10)));
  }

  /* Preparar: os passos (Roteiro, Banca, Convocação, Agenda) e o corpo do atual. */
  const botaoDoPasso = (id) =>
    document.querySelector(`.entrevistas-passos button[data-passo="${id}"]`);
  const corpoDoPasso = () =>
    document.querySelector(".entrevistas-preparar-corpo");
  async function abrirPasso(id) {
    await preparado();
    await clicar(botaoDoPasso(id));
    await esperar();
    return corpoDoPasso();
  }
  const convocacao = () => document.querySelector(".entrevistas-convocacao");
  const salvarConfiguracao = () =>
    document.querySelector('[data-acao="salvar-configuracao"]');
  const editarConfiguracao = () =>
    document.querySelector('[data-acao="editar-configuracao"]');

  /* A ficha do primeiro cartão da fila (sem agenda, a fila abre em Todos). */
  async function abrirAFicha(id = "e1") {
    await clicar(visao("fila"));
    await esperar();
    await abrirLinha(id);
    return document.getElementById("entrevistasFichaDoCandidato");
  }

  /* A ficha: as células editáveis, as colunas da matriz, a aba escolhida. */
  const notas = (ficha) => [
    ...ficha.querySelectorAll("input.entrevistas-nota"),
  ];
  /* A justificativa da banca (obrigatória para Inapto e Faltou). */
  const justificativa = (ficha) =>
    ficha.querySelector(".entrevistas-justificativa textarea");
  const colunas = (ficha) =>
    [...ficha.querySelectorAll(".entrevistas-matriz-coluna")].map(
      (c) => c.textContent,
    );
  const abaAtiva = () =>
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ||
    "";
  /* A troca automática de avaliador espera o check aparecer (380 ms). */
  const esperarAvanco = () =>
    esperar(() => new Promise((resolver) => setTimeout(resolver, 450)));

  /* ── A tela: visões, edital, fila do dia ───────────────────────────── */

  const convocado = (n, extra = {}) => ({
    ...EDITAL.convocados[0],
    id: `e${n}`,
    analise_id: `an${n}`,
    candidato: `Candidato ${n}`,
    codigo: `K${n}`,
    ...extra,
  });
  const todasAsNotas = ["c1", "c2"].flatMap((c) =>
    ["a1", "a2"].map((a) => ({ competencia: c, avaliador: a, nota: 4 })),
  );
  const EDITAL_DO_DIA = {
    ...EDITAL,
    convocados: [
      convocado(1),
      convocado(2, { compareceu: "S", avaliacoes: [todasAsNotas[0]] }),
      convocado(3, { compareceu: "N", parecer: "INAPTO" }),
      convocado(4, {
        compareceu: "S",
        parecer: "APTO",
        avaliacoes: todasAsNotas,
        concluida_em: "2026-10-07T13:00:00Z",
        concluida_por: "Secretaria",
      }),
      convocado(5),
    ],
  };
  const AGENDA_DO_DIA = {
    edital: { id: "m1", edital: "100/2026" },
    regra: { versao: 1, configuracao: { bancas: 1 } },
    itens: [
      {
        analise_id: "an2",
        data: HOJE,
        inicio: "09:00",
        fim: "09:30",
        banca: 1,
      },
      {
        analise_id: "an1",
        data: HOJE,
        inicio: "08:00",
        fim: "08:30",
        banca: 1,
      },
      {
        analise_id: "an3",
        data: HOJE,
        inicio: "10:00",
        fim: "10:30",
        banca: 1,
      },
      {
        analise_id: "an4",
        data: HOJE,
        inicio: "11:00",
        fim: "11:30",
        banca: 1,
      },
      {
        analise_id: "an5",
        data: "2026-10-08",
        inicio: "08:00",
        fim: "08:30",
        banca: 1,
      },
    ],
  };
  const cartoes = () =>
    [...document.querySelectorAll("tr.entrevistas-fila-linha")].map((c) => [
      c.dataset.convocado,
      c.dataset.situacao,
    ]);
  const contador = () =>
    document.querySelector(".entrevistas-contador-do-dia")?.textContent;

  describe("a tela de Conduzir entrevistas", () => {
    it("monta sem pedir nada; o render abre o único edital da lista na Fila", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase, { abrir: false });
      expect(supabase.rpc).not.toHaveBeenCalled();
      await act(async () => void tela.render());
      await esperar();
      expect(chamadas(supabase, "listar_editais_entrevista")[0][1]).toEqual({
        p_area: "saude-indigena",
        p_todos: false,
      });
      expect(chamadas(supabase, "obter_entrevistas_do_edital")[0][1]).toEqual({
        p_edital: "m1",
      });
      expect(visao("fila").getAttribute("aria-checked")).toBe("true");
      expect(
        [...secao.querySelectorAll(".entrevistas-visoes [role=radio]")].map(
          (b) => b.textContent.trim(),
        ),
      ).toEqual(["Fila1", "Preparar"]);
      // A seção Fila leva quantas estão na tela (ContagemDaAba).
      expect(visao("fila").querySelector(".ui-aba-contagem").textContent).toBe(
        "1",
      );
      // Sem agenda salva: a fila abre em Todos, com o convocado.
      expect(cartoes()).toEqual([["e1", "aguardando"]]);
      expect(
        secao.querySelector(".entrevistas-fila-recortes [aria-checked=true]")
          .textContent,
      ).toBe("Todos (1)");
      // A pessoa: nome e "código · modalidade", sem círculo de iniciais.
      expect(
        secao.querySelector('tr[data-convocado="e1"] .ui-pessoa').textContent,
      ).toBe("Candidato 1K1 · Ampla");
      expect(secao.querySelector(".entrevistas-avatar")).toBeNull();
      expect(
        guardado.mapa.get("agsus:conduzir-entrevistas:edital:saude-indigena"),
      ).toBe("m1");
    });

    it("com vários editais, abre o último aberto na área (guardado no navegador)", async () => {
      const supabase = supabaseDaConducao({
        respostas: {
          listar_editais_entrevista: () => ({
            data: {
              admin_global: false,
              editais: [
                { id: "m1", edital: "100/2026", unidade: "A", na_janela: true },
                { id: "m2", edital: "101/2026", unidade: "B", na_janela: true },
              ],
            },
            error: null,
          }),
        },
      });
      await montar(supabase);
      expect(chamadas(supabase, "obter_entrevistas_do_edital")).toHaveLength(0);
      expect(naTela("Escolha o edital para ver a fila.")).toBe(true);
      await act(async () => tela.raiz.unmount());
      secao.remove();
      guardado.setItem(
        "agsus:conduzir-entrevistas:edital:saude-indigena",
        "m2",
      );
      await montar(supabase);
      expect(
        chamadas(supabase, "obter_entrevistas_do_edital").at(-1)[1],
      ).toEqual({
        p_edital: "m2",
      });
    });

    it("o edital vai ao endereço (?edital=) e o endereço vence o último aberto guardado", async () => {
      const supabase = supabaseDaConducao({
        respostas: {
          listar_editais_entrevista: () => ({
            data: {
              admin_global: false,
              editais: [
                { id: "m1", edital: "100/2026", unidade: "A", na_janela: true },
                { id: "m2", edital: "101/2026", unidade: "B", na_janela: true },
              ],
            },
            error: null,
          }),
        },
      });
      const antes = location.pathname + location.search;
      try {
        // O link da página do edital: /<área>/entrevistas/<id> abre o edital…
        history.replaceState(null, "", "/saude-indigena/entrevistas");
        await montar(supabase);
        await act(async () => tela.abrirEdital("m2"));
        await esperar();
        // …e o endereço fica com ele, para o F5 e o link copiado.
        expect(location.search).toBe("?edital=m2");
        await act(async () => tela.raiz.unmount());
        secao.remove();

        // F5 com outro edital guardado no navegador: vale o do endereço.
        guardado.setItem(
          "agsus:conduzir-entrevistas:edital:saude-indigena",
          "m1",
        );
        await montar(supabase);
        await esperar();
        expect(
          chamadas(supabase, "obter_entrevistas_do_edital").at(-1)[1],
        ).toEqual({ p_edital: "m2" });
        expect(location.search).toBe("?edital=m2");
      } finally {
        history.replaceState(null, "", antes);
      }
    });

    it("Fila: abre em Hoje pela agenda, com situações, contador e recortes", async () => {
      const supabase = supabaseDaConducao({
        edital: EDITAL_DO_DIA,
        respostas: {
          obter_agenda_entrevista: () => ({ data: AGENDA_DO_DIA, error: null }),
        },
      });
      await montar(supabase);
      expect(cartoes()).toEqual([
        ["e1", "aguardando"],
        ["e2", "em_andamento"],
        ["e3", "faltou"],
        ["e4", "concluida"],
      ]);
      expect(contador()).toBe("2 de 4 hoje");
      expect(
        [
          ...secao.querySelectorAll(".entrevistas-fila-recortes [role=radio]"),
        ].map((b) => b.textContent),
      ).toEqual(["Hoje (4)", "Próximos (1)", "Todos (5)"]);
      await clicar(
        secao.querySelector(
          "[data-tour='conduzir-situacoes'] [data-valor='faltou']",
        ),
      );
      expect(cartoes()).toEqual([["e3", "faltou"]]);
      await clicar(
        secao.querySelector(
          "[data-tour='conduzir-situacoes'] [data-valor='faltou']",
        ),
      );
      await clicar(
        secao.querySelector(
          ".entrevistas-fila-recortes [data-valor='proximos']",
        ),
      );
      expect(cartoes()).toEqual([["e5", "aguardando"]]);
      // Fora de Hoje, o dia fica embaixo do horário; a vaga é coluna (código e cargo).
      expect(
        secao.querySelector(".entrevistas-fila-hora").textContent,
      ).toContain("Amanhã");
      expect(
        secao.querySelector('tr[data-convocado="e5"]').textContent,
      ).toContain("V1Enfermeiro");
    });

    it("a ficha abre do cartão; Salvar e abrir o próximo segue a fila; concluir o dia comemora uma vez", async () => {
      let dados = {
        ...EDITAL_DO_DIA,
        convocados: EDITAL_DO_DIA.convocados.map((c) =>
          c.id === "e1" || c.id === "e2" ? { ...c, compareceu: "N" } : c,
        ),
      };
      // Hoje: e1 e e3 faltaram, e4 concluída, e2 aguardando (3 de 4).
      dados = {
        ...dados,
        convocados: dados.convocados.map((c) =>
          c.id === "e2"
            ? { ...c, compareceu: null, parecer: "SEM_PARECER", avaliacoes: [] }
            : c,
        ),
      };
      const supabase = supabaseDaConducao({
        edital: dados,
        respostas: {
          obter_agenda_entrevista: () => ({ data: AGENDA_DO_DIA, error: null }),
          lancar_notas_entrevista: () => ({
            data: {
              ...dados,
              convocados: dados.convocados.map((c) =>
                c.id === "e2"
                  ? { ...c, compareceu: "N", parecer: "INAPTO" }
                  : c,
              ),
            },
            error: null,
          }),
        },
      });
      await montar(supabase);
      expect(contador()).toBe("3 de 4 hoje");
      expect(aoComemorar).not.toHaveBeenCalled();
      await abrirLinha("e2");
      const ficha = document.getElementById("entrevistasFichaDoCandidato");
      expect(ficha).not.toBeNull();
      expect(document.querySelector(".ui-cabecalho-da-tela")).toBeNull();
      await clicar(
        ficha.querySelector(
          '.entrevistas-comparecimento button[data-valor="N"]',
        ),
      );
      await digitar(justificativa(ficha), "Não compareceu.");
      const proximo = [...ficha.querySelectorAll("button")].find((b) =>
        b.textContent.includes("Salvar e abrir o próximo"),
      );
      await clicar(proximo);
      await esperar();
      expect(chamadas(supabase, "lancar_notas_entrevista")[0][1]).toMatchObject(
        {
          p_entrevista: "e2",
          p_dados: { compareceu: "N" },
        },
      );
      // O próximo da fila de hoje (por horário) é e3.
      expect(
        document.getElementById("entrevistasFichaTitulo").textContent,
      ).toContain("Candidato 3");
      expect(aoComemorar).toHaveBeenCalledTimes(1);
      expect(aoComemorar.mock.calls[0][0]).toMatchObject({
        texto: "Entrevistas de hoje concluídas: 4 de 4.",
        confete: false,
      });
      await clicar(document.querySelector('[data-acao="voltar-a-lista"]'));
      expect(contador()).toBe("4 de 4 hoje");
      expect(
        document.querySelector(".entrevistas-contador-do-dia").dataset.completo,
      ).toBe("sim");
    });

    it("fila filtrada por situação: a ficha segue a fila da tela, mesmo depois que o salvo sai do filtro", async () => {
      // Hoje: e3 (07:00) e e1 (08:00) aguardando; e2 em andamento; e4 concluída.
      const agenda = {
        ...AGENDA_DO_DIA,
        itens: AGENDA_DO_DIA.itens.map((i) =>
          i.analise_id === "an3" ? { ...i, inicio: "07:00", fim: "07:30" } : i,
        ),
      };
      const dados = {
        ...EDITAL_DO_DIA,
        convocados: EDITAL_DO_DIA.convocados.map((c) =>
          c.id === "e3"
            ? { ...c, compareceu: null, parecer: "SEM_PARECER", avaliacoes: [] }
            : c,
        ),
      };
      const supabase = supabaseDaConducao({
        edital: dados,
        respostas: {
          obter_agenda_entrevista: () => ({ data: agenda, error: null }),
          lancar_notas_entrevista: () => ({
            data: {
              ...dados,
              convocados: dados.convocados.map((c) =>
                c.id === "e3"
                  ? { ...c, compareceu: "N", parecer: "INAPTO" }
                  : c,
              ),
            },
            error: null,
          }),
        },
      });
      await montar(supabase);
      await clicar(
        document.querySelector(
          '[data-tour="conduzir-situacoes"] [data-valor="aguardando"]',
        ),
      );
      expect(cartoes().map(([id]) => id)).toEqual(["e3", "e1"]);
      await abrirLinha("e3");
      const ficha = document.getElementById("entrevistasFichaDoCandidato");
      await clicar(
        ficha.querySelector(
          '.entrevistas-comparecimento button[data-valor="N"]',
        ),
      );
      await digitar(justificativa(ficha), "Não compareceu.");
      expect(
        document.querySelector(".entrevistas-analise-posicao").textContent,
      ).toBe("1 de 2");
      await clicar(
        [...ficha.querySelectorAll("button")].find(
          (b) => b.textContent === "Salvar",
        ),
      );
      await esperar();
      // Antes, e3 saía do filtro e a ficha passava à ordem do edital inteiro.
      expect(
        document.querySelector(".entrevistas-analise-posicao").textContent,
      ).toBe("1 de 2");
      await clicar(document.querySelector('[data-acao="ficha-proxima"]'));
      expect(
        document.getElementById("entrevistasFichaTitulo").textContent,
      ).toContain("Candidato 1");
    });

    it("comemorações desligadas: concluir o dia não solta os fogos", async () => {
      const dados = {
        ...EDITAL_DO_DIA,
        convocados: EDITAL_DO_DIA.convocados.map((c) =>
          c.id === "e1" ? { ...c, compareceu: "N" } : c.id === "e2" ? c : c,
        ),
      };
      const supabase = supabaseDaConducao({
        edital: dados,
        respostas: {
          obter_agenda_entrevista: () => ({ data: AGENDA_DO_DIA, error: null }),
          lancar_notas_entrevista: () => ({
            data: {
              ...dados,
              convocados: dados.convocados.map((c) =>
                c.id === "e2"
                  ? { ...c, compareceu: "N", parecer: "INAPTO" }
                  : c,
              ),
            },
            error: null,
          }),
        },
      });
      await montar(supabase, { comemoracoesLigadas: () => false });
      await abrirLinha("e2");
      await clicar(
        document
          .getElementById("entrevistasFichaDoCandidato")
          .querySelector('.entrevistas-comparecimento button[data-valor="N"]'),
      );
      await digitar(
        justificativa(document.getElementById("entrevistasFichaDoCandidato")),
        "Não compareceu.",
      );
      await clicar(
        document
          .getElementById("entrevistasFichaDoCandidato")
          .querySelector('button[type="submit"]'),
      );
      await esperar();
      expect(chamadas(supabase, "lancar_notas_entrevista")).toHaveLength(1);
      expect(aoComemorar).not.toHaveBeenCalled();
    });

    it("as visões trocam pelo teclado (setas), como um radiogroup", async () => {
      await montar(supabaseDaConducao());
      visao("fila").focus();
      await teclar(visao("fila"), "ArrowRight");
      await esperar();
      expect(visao("preparar").getAttribute("aria-checked")).toBe("true");
      expect(document.activeElement).toBe(visao("preparar"));
      await preparado();
      expect(
        [...document.querySelectorAll(".entrevistas-passos button")].map(
          (b) => b.dataset.passo,
        ),
      ).toEqual(["roteiro", "banca", "convocacao", "agenda"]);
      await abrirPasso("roteiro");
      expect(naTela("Roteiros da área")).toBe(true);
    });

    it("links antigos: a visão Roteiros vira Preparar; link com edital abre o edital na Fila", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await act(async () => tela.abrirVisao("roteiros"));
      expect(visao("preparar").getAttribute("aria-checked")).toBe("true");
      await abrirPasso("roteiro");
      expect(document.querySelector('[data-roteiro="r1"]')).not.toBeNull();
      await act(async () => tela.abrirVisao("conduzir"));
      expect(visao("fila").getAttribute("aria-checked")).toBe("true");
      await act(async () => tela.abrirEdital("m1"));
      expect(chamadas(supabase, "obter_entrevistas_do_edital")).toHaveLength(1);
    });

    it("Preparar mostra o desempate da regra de classificação, só leitura, com Editar na Classificação", async () => {
      const edital = {
        ...EDITAL,
        regra_classificacao: {
          ...EDITAL.regra_classificacao,
          desempate: [
            { criterio: "IDOSO_60", direcao: "SIM_PRIMEIRO" },
            { criterio: "NOTA_ENTREVISTA", direcao: "MAIOR_PRIMEIRO" },
          ],
          empate_final: { metodo: "SORTEIO" },
        },
      };
      await montar(supabaseDaConducao({ edital }));
      await abrirEdital();
      // Em linguagem simples no resumo; os critérios técnicos em "Ver detalhes".
      expect(
        document.querySelector('.entrevistas-regras [data-bloco="desempate"]')
          .textContent,
      ).toContain(
        "Se a nota final empatar, vale, nesta ordem: 1º 60 anos ou mais na data de corte; 2º maior pontuação na entrevista. Se ainda empatar: sorteio registrado.",
      );
      const bloco = document.querySelector(
        '.entrevistas-regras-detalhes [data-bloco="desempate-da-classificacao"]',
      );
      expect(
        [...bloco.querySelectorAll("li")].map((li) => li.textContent),
      ).toEqual([
        "60 anos ou mais na data de corte",
        "Maior pontuação na entrevista",
        "Sorteio registrado",
      ]);
      // No editor do roteiro: os mesmos critérios, sem campo de texto, com o atalho.
      await abrirPasso("roteiro");
      const editar = [
        ...document.querySelectorAll('[data-roteiro="r1"] button'),
      ].find((b) => b.textContent.includes("Editar"));
      await clicar(editar);
      const editor = document.getElementById("entrevistasEditorDeRoteiro");
      const doEditor = editor.querySelector(
        '[data-bloco="desempate-da-classificacao"]',
      );
      expect(doEditor.textContent).toContain(
        "60 anos ou mais na data de corte",
      );
      expect(doEditor.querySelector("input")).toBeNull();
      expect(
        doEditor.querySelector('[data-ir-para="classificacao"]').textContent,
      ).toBe("Editar na Classificação");
      expect(
        editor.querySelector('[aria-label="Critérios de desempate"]'),
      ).toBeNull();
    });

    it("Preparar › Convocação: 'Ver em Convocações' leva à central, no edital; convocar continua aqui", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase, { perfilDoApp: PERFIL_COM_CONVOCACOES });
      await abrirEdital();
      const corpo = await abrirPasso("convocacao");
      const atalho = corpo.querySelector("[data-acao='ver-em-convocacoes']");
      expect(atalho.textContent.trim()).toBe("Ver em Convocações");
      expect(atalho.className).toBe("btn secondary small");
      // Nada sai daqui: as caixas e o "Convocar selecionados" continuam.
      expect(
        convocacao().querySelectorAll('input[type="checkbox"]').length,
      ).toBeGreaterThan(0);
      window.navigate = vi.fn();
      try {
        await clicar(atalho);
        expect(window.navigate).toHaveBeenCalledWith("approved");
        expect(consumirPedidoDeFiltro("approved")).toEqual({
          convocacao: "entrevista",
          editalId: "m1",
        });
      } finally {
        delete window.navigate;
      }
    });

    it("salvar o roteiro repassa o desempate antigo sem mudar (a coluna fica no banco)", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await abrirEdital();
      await abrirPasso("roteiro");
      await clicar(
        [...document.querySelectorAll('[data-roteiro="r1"] button')].find((b) =>
          b.textContent.includes("Editar"),
        ),
      );
      const editor = document.getElementById("entrevistasEditorDeRoteiro");
      await clicar(editor.querySelector('button[type="submit"]'));
      await esperar();
      const [[, { p_dados }]] = chamadas(supabase, "salvar_roteiro_entrevista");
      expect(p_dados.desempate).toEqual(["Idade igual ou superior a 60 anos"]);
    });

    it("trocar a área: o edital sai e os editais da nova área são lidos", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      expect(document.querySelector('[data-convocado="e1"]')).not.toBeNull();
      await act(async () => definirAreaAtual("projetos"));
      await esperar();
      expect(document.querySelector('[data-convocado="e1"]')).toBeNull();
      expect(chamadas(supabase, "listar_editais_entrevista").at(-1)[1]).toEqual(
        {
          p_area: "projetos",
          p_todos: false,
        },
      );
    });

    it("Atualizar relê os editais e o edital aberto", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      const antes = {
        editais: chamadas(supabase, "listar_editais_entrevista").length,
        edital: chamadas(supabase, "obter_entrevistas_do_edital").length,
      };
      await clicar(secao.querySelector('[data-acao="atualizar"]'));
      await esperar();
      expect(chamadas(supabase, "listar_editais_entrevista").length).toBe(
        antes.editais + 1,
      );
      expect(chamadas(supabase, "obter_entrevistas_do_edital").length).toBe(
        antes.edital + 1,
      );
    });

    it("edital sem configuração: a Fila avisa e leva ao Preparar", async () => {
      await montar(
        supabaseDaConducao({ edital: { ...EDITAL, configuracao: null } }),
      );
      expect(
        naTela(
          "A entrevista deste edital ainda não foi preparada (roteiro e banca).",
        ),
      ).toBe(true);
      await clicar(
        [...document.querySelectorAll(".ui-aviso button")].find(
          (b) => b.textContent === "Preparar",
        ),
      );
      expect(visao("preparar").getAttribute("aria-checked")).toBe("true");
      // Sem configuração, Preparar abre no passo 1: o roteiro se escolhe nas
      // Regras do edital (o atalho "Escolher o roteiro nas Regras do edital").
      expect(corpoDoPasso().dataset.passoAtual).toBe("roteiro");
      expect(
        document.querySelector('[data-campo="roteiro-do-edital"]'),
      ).toBeNull();
      expect(corpoDoPasso().textContent).toContain(
        "Escolher o roteiro nas Regras do edital",
      );
      window.navigate = vi.fn();
      // As Regras do edital são rota de Editais (src/app/navegacao.ts).
      try {
        await clicar(
          corpoDoPasso().querySelector(
            "[data-acao='editar-nas-regras-do-edital']",
          ),
        );
        expect(window.navigate).toHaveBeenCalledWith("nucleo", {
          edital: "m1",
          regras: "entrevista",
        });
      } finally {
        delete window.navigate;
        registrarTelas({});
      }
    });
  });

  describe("Preparar, roteiros e ficha", () => {
    it("editar um roteiro grava a versão seguinte, com a prévia e o +50%", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await clicar(visao("preparar"));
      await esperar();
      await abrirPasso("roteiro");
      const editar = [
        ...document.querySelectorAll('[data-roteiro="r1"] button'),
      ].find((b) => b.textContent.includes("Editar (cria versão 2)"));
      await clicar(editar);
      const editor = document.getElementById("entrevistasEditorDeRoteiro");
      expect(editor).not.toBeNull();
      expect(
        document.getElementById("entrevistasPreviaDoRoteiro").textContent,
      ).toBe("Pontuação máxima 10 · mínimo 4");
      const peso = editor.querySelectorAll(
        'li[data-competencia="1"] input[type="number"]',
      )[1];
      await digitar(peso, "1.5");
      expect(editor.textContent).toContain("+50% sobre a média da banca");
      expect(
        document.getElementById("entrevistasPreviaDoRoteiro").textContent,
      ).toBe("Pontuação máxima 12,5 · mínimo 4");
      await clicar(editor.querySelector('button[type="submit"]'));
      await esperar();
      const [[, { p_dados }]] = chamadas(supabase, "salvar_roteiro_entrevista");
      expect(p_dados.origem).toBe("r1");
      expect(p_dados.competencias[0].peso).toBe(1.5);
      expect(p_dados.niveis).toHaveLength(6);
      expect(document.getElementById("entrevistasEditorDeRoteiro")).toBeNull();
      expect(chamadas(supabase, "listar_roteiros_entrevista").length).toBe(2);
    });

    it("formulário inválido não chama o banco", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await clicar(visao("preparar"));
      await esperar();
      await abrirPasso("roteiro");
      await clicar(document.getElementById("entrevistasNovoRoteiro"));
      const editor = document.getElementById("entrevistasEditorDeRoteiro");
      await clicar(editor.querySelector('button[type="submit"]'));
      expect(editor.textContent).toContain("Nome do roteiro: de 3 a 150");
      // A lista do que falta, perto do Salvar, abre a seção do erro.
      const pendencias = editor.querySelector(
        ".entrevistas-pendencias-do-roteiro",
      );
      expect(pendencias.getAttribute("role")).toBe("alert");
      expect(pendencias.textContent).toContain("Faltam");
      expect(editor.querySelector('[data-secao="identificacao"]').open).toBe(
        true,
      );
      expect(chamadas(supabase, "salvar_roteiro_entrevista")).toHaveLength(0);
    });

    it("convoca os da lista de convocação da Classificação (com o id da lista) e relê os resultados", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await abrirEdital();
      expect(chamadas(supabase, "obter_entrevistas_do_edital")[0][1]).toEqual({
        p_edital: "m1",
      });
      // Com a lista registrada, o cálculo da Classificação nem é pedido.
      expect(chamadas(supabase, "obter_classificacao_do_edital")).toHaveLength(
        0,
      );
      await abrirPasso("convocacao");
      const passo = convocacao();
      // Sem o perfil de quem entrou, o atalho para a central não aparece.
      expect(
        document.querySelector("[data-acao='ver-em-convocacoes']"),
      ).toBeNull();
      expect(passo.dataset.fonte).toBe("LISTA");
      expect(passo.textContent).toContain(
        "Lista de convocação da Classificação · gerada em 05/10/2026, 10:30 por Gestora · regra v2",
      );
      const caixas = passo.querySelectorAll('input[type="checkbox"]');
      // Só os dois da lista (o 3º está entre os eliminados); o 1º já está na ficha.
      expect([...caixas].map((c) => [c.checked, c.disabled])).toEqual([
        [true, true],
        [true, false],
      ]);
      expect(passo.textContent).toContain(
        "2 vagas imediatas · até a 2ª (1 × 2 vaga(s))",
      );
      // O passo diz o que falta: 1 da lista ainda não convocado.
      expect(corpoDoPasso().textContent).toContain(
        "1 candidato da lista ainda não foi convocado.",
      );
      expect(passo.textContent).not.toContain("Candidato 3");
      expect(passo.textContent).not.toContain("Além da regra");
      await clicar(document.getElementById("entrevistasConvocar"));
      await esperar();
      expect(chamadas(supabase, "convocar_para_entrevista")[0][1]).toEqual({
        p_edital: "m1",
        p_lista: "lista1",
        p_analises: ["an2"],
      });
      expect(aoMudarResultados).toHaveBeenCalledTimes(1);
    });

    it("a lista mudou na Classificação (40001): avisa e relê o edital", async () => {
      const supabase = supabaseDaConducao({
        respostas: {
          convocar_para_entrevista: () => ({
            data: null,
            error: {
              code: "40001",
              message:
                "A lista de convocação mudou na Classificação; recarregue",
            },
          }),
        },
      });
      await montar(supabase);
      await abrirEdital();
      await abrirPasso("convocacao");
      await clicar(document.getElementById("entrevistasConvocar"));
      await esperar();
      expect(toast).toHaveBeenCalledWith(
        "A lista de convocação mudou na Classificação; recarregue",
        "error",
      );
      expect(chamadas(supabase, "obter_entrevistas_do_edital")).toHaveLength(2);
    });

    it("regras da entrevista: resumo simples com Editar; regra e vagas técnicas em Ver detalhes; sem digitar vagas", async () => {
      await montar(supabaseDaConducao());
      await abrirEdital();
      const regras = document.querySelector(".entrevistas-regras");
      const bloco = (id) => regras.querySelector(`[data-bloco="${id}"]`);
      expect(bloco("convocacao").textContent).toContain(
        "Até 1 pessoa por vaga imediata; nas vagas só de cadastro reserva, até a 1ª posição; quem empatar com o último chamado também entra.",
      );
      expect(
        [...bloco("convocacao").querySelectorAll("tbody td")].map(
          (td) => td.textContent,
        ),
      ).toEqual(["EnfermeiroV1", "2", "até a 2ª"]);
      expect(bloco("nota").textContent).toContain(
        "Cada avaliador dá uma nota de 0 a 5 em cada uma das 2 competências.",
      );
      expect(bloco("nota").textContent).toContain(
        "Abaixo de 2 em qualquer competência ou com média 0 ou 1 em alguma competência ou abaixo de 4 no total, o candidato fica inapto.",
      );
      expect(bloco("banca").textContent).toContain(
        "Banca 1 — Ana (AgSUS) avalia todas as competências; Beto (CONDISI) avalia todas as competências.",
      );
      // "Editar" de quem avalia leva às Regras do edital (etapa Entrevista); o
      // da nota abre o roteiro do edital aqui.
      window.navigate = vi.fn();
      // As Regras do edital são rota de Editais (src/app/navegacao.ts).
      try {
        await clicar(
          bloco("banca").querySelector('[data-ir-para="configuracao"]'),
        );
        expect(window.navigate).toHaveBeenCalledWith("nucleo", {
          edital: "m1",
          regras: "entrevista",
        });
      } finally {
        delete window.navigate;
        registrarTelas({});
      }
      await clicar(bloco("nota").querySelector('[data-ir-para="roteiro"]'));
      expect(
        document.getElementById("entrevistasEditorDeRoteiro"),
      ).not.toBeNull();
      const passo = regras.querySelector(".entrevistas-regras-detalhes");
      expect(passo.textContent).toContain(
        "Classificação, regra v2: 1× as vagas imediatas · até a 1ª no cadastro reserva",
      );
      const linha = document.querySelector(
        '#entrevistasVagas tr[data-vaga="V1"]',
      );
      expect(
        [...linha.querySelectorAll("td")].map((td) => td.textContent),
      ).toEqual([
        "V1",
        "EnfermeiroPolo Base",
        "2 vagas imediatas",
        "até a 2ª (1 × 2 vaga(s))",
        "quadro de vagas do editalEditais",
      ]);
      expect(linha.querySelector('[data-ir-para="nucleo"]')).not.toBeNull();
      expect(
        passo.querySelector('[data-ir-para="classificacao"]').textContent,
      ).toBe("Regra na Classificação");
      const configuracao = corpoDoPasso();
      expect(
        configuracao.querySelector('input[aria-label^="Vagas imediatas"]'),
      ).toBeNull();
      expect(configuracao.textContent).not.toContain(
        "Múltiplo das vagas imediatas",
      );
    });

    it("avaliador por competência: a configuração grava só estas, valida a cobertura e a ficha mostra só o atribuído", async () => {
      const supabase = supabaseDaConducao();
      const passo = await abrirConfiguracaoNasRegras(supabase);
      await clicar(editarConfiguracao());
      const membros = passo.querySelectorAll(".entrevistas-linha-membro");
      // Beto: só "Habilidade interpessoal".
      await clicar(membros[1].querySelector('button[data-valor="algumas"]'));
      await clicar(
        [...membros[1].querySelectorAll("label")]
          .find((l) => l.textContent.includes("Habilidade interpessoal"))
          .querySelector("input"),
      );
      // Ana só em "Políticas públicas" cobre tudo (Beto avalia a outra); desmarcar deixa sem ninguém.
      await clicar(membros[0].querySelector('button[data-valor="algumas"]'));
      await clicar(
        [...membros[0].querySelectorAll("label")]
          .find((l) => l.textContent.includes("Políticas públicas"))
          .querySelector("input"),
      );
      expect(passo.textContent).not.toContain("ninguém avalia");
      await clicar(
        [...membros[0].querySelectorAll("label")]
          .find((l) => l.textContent.includes("Políticas públicas"))
          .querySelector("input"),
      );
      expect(passo.textContent).toContain(
        "Banca 1: ninguém avalia “Políticas públicas”.",
      );
      await clicar(salvarConfiguracao());
      expect(chamadas(supabase, "configurar_entrevista_edital")).toHaveLength(
        0,
      );
      // O que falta fica na lista perto do Salvar.
      expect(
        passo.querySelector(".entrevistas-pendencias").textContent,
      ).toContain("Banca 1: ninguém avalia “Políticas públicas”.");
      await clicar(membros[0].querySelector('button[data-valor="todas"]'));
      await clicar(salvarConfiguracao());
      await esperar();
      const [[, argumentos]] = chamadas(
        supabase,
        "configurar_entrevista_edital",
      );
      expect(argumentos.p_dados.avaliadores.map((a) => a.competencias)).toEqual(
        [null, ["c2"]],
      );
    });

    it("ficha com avaliador por competência: esmaece o que não é dele, conta só o atribuído e calcula só com quem avalia", async () => {
      const edital = {
        ...EDITAL,
        avaliadores: [
          EDITAL.avaliadores[0],
          { ...EDITAL.avaliadores[1], competencias: ["c2"] },
        ],
      };
      await montar(supabaseDaConducao({ edital }));
      const ficha = await abrirAFicha();
      expect(
        [...ficha.querySelectorAll('[role="tab"]')].map((t) => t.textContent),
      ).toEqual(["AnaAgSUS0/2", "BetoCONDISI0/1"]);
      await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
      const linhas = ficha.querySelectorAll(".entrevistas-matriz-linha");
      expect(linhas[0].dataset.atribuida).toBe("nao");
      expect(linhas[0].textContent).toContain("avaliada por Ana");
      expect(notas(ficha)).toHaveLength(1);
      expect(ficha.textContent).toContain("0 de 3 notas");
      // Por competência: em "Políticas públicas", só a Ana.
      await clicar(ficha.querySelector('button[data-valor="competencia"]'));
      await clicar(ficha.querySelector('[role="tab"][data-aba="c1"]'));
      expect(
        [...ficha.querySelectorAll(".entrevistas-matriz-titulo span")].map(
          (s) => s.textContent,
        ),
      ).toEqual(["Ana"]);
    });

    it("sem lista gerada: o cálculo atual com aviso e atalho para gerar; não convoca", async () => {
      const UUID = "11111111-2222-4333-8444-555555555555";
      const edital = {
        ...EDITAL,
        edital: { ...EDITAL.edital, id: UUID },
        lista_convocacao: null,
      };
      const supabase = supabaseDaConducao({
        edital,
        respostas: {
          obter_classificacao_do_edital: () => ({
            data: {
              edital: {
                id: UUID,
                edital: "100/2026",
                unidade: "CASAI Brasília",
              },
              regra: {
                versao: 2,
                configuracao: {
                  convocacao: { multiplo_vagas: 1, posicao_max_cr: 1 },
                },
              },
              quadro: [
                {
                  id: "q1",
                  ordem: 1,
                  cargo: "Enfermeiro",
                  vagas_imediatas: 1,
                  cadastro_reserva: false,
                  modalidades: {},
                },
              ],
              candidatos: [1, 2, 3].map((n) => ({
                analise_id: `an${n}`,
                nome: `Candidato ${n}`,
                vaga: "V1",
                cargo: "Enfermeiro",
                status: "Aprovado",
                nota_documental: 90 - n,
                quadro: "q1",
              })),
              entrevistas: [],
              cronograma: [],
              desempates: [],
              ajustes: [],
            },
            error: null,
          }),
          listar_configuracao_convocacao: () => ({ data: [], error: null }),
          listar_modelos_convocacao: () => ({ data: [], error: null }),
        },
      });
      await montar(supabase);
      window.navigate = vi.fn();
      try {
        await abrirEdital();
        expect(
          chamadas(supabase, "obter_classificacao_do_edital")[0][1],
        ).toEqual({ p_edital: "m1" });
        await abrirPasso("convocacao");
        const passo = convocacao();
        expect(passo.dataset.fonte).toBe("CALCULO");
        expect(passo.textContent).toContain(
          "Lista ainda não gerada na Classificação",
        );
        // 1× 1 vaga: só o primeiro.
        expect(passo.textContent).toContain("Candidato 1");
        expect(passo.textContent).not.toContain("Candidato 2");
        expect(document.getElementById("entrevistasConvocar")).toBeNull();
        await clicar(
          [...passo.querySelectorAll("button")].find(
            (b) => b.textContent === "Gerar na Classificação",
          ),
        );
        // O edital vai junto no endereço; a rota abre a Classificação nele.
        expect(window.navigate).toHaveBeenCalledWith("classificacao", {
          edital: UUID,
        });
      } finally {
        delete window.navigate;
      }
    });

    it("sem lista e sem acesso à Classificação: avisa, sem cálculo nem convocação", async () => {
      const supabase = supabaseDaConducao({
        edital: { ...EDITAL, lista_convocacao: null, pode_gerar_lista: false },
        respostas: {
          obter_classificacao_do_edital: () => ({
            data: null,
            error: { code: "42501", message: "Sem permissão" },
          }),
        },
      });
      await montar(supabase);
      await abrirEdital();
      await abrirPasso("convocacao");
      const passo = convocacao();
      expect(passo.dataset.fonte).toBe("NENHUMA");
      expect(passo.textContent).toContain(
        "Lista ainda não gerada na Classificação.",
      );
      expect(passo.textContent).toContain(
        "Seu acesso não inclui a Classificação deste edital.",
      );
      expect(passo.textContent).not.toContain("Gerar na Classificação");
      expect(document.getElementById("entrevistasConvocar")).toBeNull();
      // O convocado de antes continua (fora da lista vigente), e na fila também.
      expect(passo.textContent).toContain("Fora da lista vigente");
      await clicar(visao("fila"));
      expect(document.querySelector('[data-convocado="e1"]')).not.toBeNull();
    });

    it("salva a configuração com o modo de lançamento e a banca", async () => {
      const supabase = supabaseDaConducao();
      const passo = await abrirConfiguracaoNasRegras(supabase);
      expect(passo.textContent).toContain("Saúde Indígena 2026");
      await clicar(editarConfiguracao());
      await clicar(passo.querySelector('button[data-valor="AVALIADOR"]'));
      await clicar(salvarConfiguracao());
      await esperar();
      const [[, argumentos]] = chamadas(
        supabase,
        "configurar_entrevista_edital",
      );
      expect(argumentos.p_edital).toBe("m1");
      expect(argumentos.p_dados).not.toHaveProperty("vagas");
      expect(argumentos.p_dados).not.toHaveProperty("convocacao");
      expect(argumentos.p_dados).toMatchObject({
        roteiro: "r1",
        lancamento: "AVALIADOR",
        avaliadores: [
          {
            id: "a1",
            nome: "Ana",
            origem: "AgSUS",
            banca: 1,
            perfil: PERFIL_DA_ANA,
          },
          { id: "a2", nome: "Beto", origem: "CONDISI", banca: 1, perfil: null },
        ],
      });
    });

    it("ficha de notas: prévia do parecer, gravação e erro do banco", async () => {
      let falhar = true;
      const supabase = supabaseDaConducao({
        respostas: {
          lancar_notas_entrevista: () =>
            falhar
              ? {
                  data: null,
                  error: { code: "22023", message: "Nota 7 fora da faixa" },
                }
              : { data: EDITAL, error: null },
        },
      });
      await montar(supabase);
      await abrirEdital();
      const ficha = await abrirAFicha();
      // Por avaliador (padrão): a aba da Ana, uma coluna "Nota", uma linha por competência.
      expect(abaAtiva()).toContain("Ana");
      expect(colunas(ficha)).toEqual(["Nota"]);
      let celulas = notas(ficha);
      expect(celulas).toHaveLength(2);
      // Legenda da escala numa linha.
      expect(ficha.querySelector(".entrevistas-legenda").textContent).toContain(
        "3 Nível 3",
      );
      await clicar(
        ficha.querySelector(
          '.entrevistas-comparecimento button[data-valor="S"]',
        ),
      );
      for (const celula of celulas) await digitar(celula, "3");
      // Ana completa: a aba ganha o check e a ficha passa sozinha ao Beto.
      await esperarAvanco();
      expect(abaAtiva()).toContain("Beto");
      expect(
        ficha.querySelector('[data-aba="a1"] .entrevistas-aba-da-ficha-check'),
      ).not.toBeNull();
      // Faltam as notas do Beto: a lateral é só uma prévia, em tom neutro.
      const cartao = () => ficha.querySelector(".entrevistas-parecer");
      expect(cartao().dataset.tom).toBe("neutro");
      expect(cartao().dataset.previa).toBe("sim");
      expect(cartao().textContent).toBe("PréviaApto · faltam 2 notas");
      celulas = notas(ficha);
      for (const celula of celulas) await digitar(celula, "3");
      // Tudo lançado: o parecer fica definitivo, na cor dele.
      expect(cartao().dataset.tom).toBe("ok");
      expect(cartao().dataset.previa).toBeUndefined();
      expect(cartao().textContent).toBe("ParecerApto");
      expect(
        document.getElementById("entrevistasFichaTotal").textContent,
      ).toContain("6");
      expect(
        document.getElementById("entrevistasFichaParecer").textContent,
      ).toBe("Apto");
      expect(
        ficha.querySelector(".entrevistas-progresso").textContent,
      ).toContain("4 de 4 notas");
      // Por competência: a aba de "Políticas públicas", os dois avaliadores nas linhas.
      await clicar(
        ficha.querySelector(
          '.entrevistas-modo-da-ficha [data-valor="competencia"]',
        ),
      );
      expect(abaAtiva()).toContain("Políticas públicas");
      celulas = notas(ficha);
      expect(celulas.map((c) => c.getAttribute("aria-label"))).toEqual([
        "Nota de Ana em Políticas públicas",
        "Nota de Beto em Políticas públicas",
      ]);
      await digitar(celulas[0], "1");
      await digitar(celulas[1], "1");
      expect(
        document.getElementById("entrevistasFichaParecer").textContent,
      ).toBe("Inapto");
      expect(ficha.textContent).toContain("é eliminatória");
      expect(
        ficha.querySelector(
          '.entrevistas-notas-da-banca li[data-situacao="abaixo"]',
        ),
      ).not.toBeNull();

      // Inapto: a justificativa da banca é obrigatória (o rodapé avisa; salvar não chama o banco).
      expect(
        ficha.querySelector('[data-acao="ir-para-justificativa"]').textContent,
      ).toContain("Falta a justificativa da banca");
      await clicar(ficha.querySelector('button[type="submit"]'));
      expect(chamadas(supabase, "lancar_notas_entrevista")).toHaveLength(0);
      expect(ficha.textContent).toContain(
        "Escreva a justificativa da banca: ela é obrigatória para Inapto.",
      );
      expect(document.activeElement).toBe(justificativa(ficha));
      await digitar(justificativa(ficha), "  Abaixo do mínimo.  ");
      await clicar(ficha.querySelector('button[type="submit"]'));
      await esperar();
      expect(ficha.textContent).toContain(
        "Dado inválido: Nota 7 fora da faixa.",
      );
      const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
      expect(argumentos.p_entrevista).toBe("e1");
      expect(argumentos.p_dados.compareceu).toBe("S");
      expect(argumentos.p_dados.justificativa).toBe("Abaixo do mínimo.");
      expect(argumentos.p_dados).not.toHaveProperty("observacoes");
      expect(argumentos.p_dados.notas).toHaveLength(4);
      expect(argumentos.p_dados.notas).toContainEqual({
        competencia: "c1",
        avaliador: "a1",
        nota: 1,
      });

      expect(aoMudarResultados).not.toHaveBeenCalled();
      falhar = false;
      await clicar(ficha.querySelector('button[type="submit"]'));
      await esperar();
      expect(aoMudarResultados).toHaveBeenCalledTimes(1);
    });

    it("ficha pelo teclado: o dígito lança e avança, Enter anda, Ctrl+Enter salva", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await abrirEdital();
      const ficha = await abrirAFicha();
      const celulas = notas(ficha);
      // Ao abrir, o foco já está na primeira célula vazia.
      expect(document.activeElement).toBe(celulas[0]);
      await digitar(celulas[0], "4");
      expect(document.activeElement).toBe(celulas[1]);
      // Digitar a primeira nota marca "Compareceu".
      expect(
        ficha
          .querySelector('.entrevistas-comparecimento button[data-valor="S"]')
          .getAttribute("aria-checked"),
      ).toBe("true");
      await teclar(celulas[1], "ArrowUp");
      expect(document.activeElement).toBe(celulas[0]);
      await teclar(celulas[0], "Enter");
      expect(document.activeElement).toBe(celulas[1]);
      await teclar(celulas[1], "Enter", { ctrlKey: true });
      await esperar();
      const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
      expect(argumentos.p_dados).toEqual({
        notas: [{ competencia: "c1", avaliador: "a1", nota: 4 }],
        compareceu: "S",
        banca: 1,
      });
    });

    it("Faltou: a matriz some e fica a confirmação com o efeito no parecer", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await abrirEdital();
      const ficha = await abrirAFicha();
      await clicar(
        ficha.querySelector(
          '.entrevistas-comparecimento button[data-valor="N"]',
        ),
      );
      expect(notas(ficha)).toHaveLength(0);
      expect(ficha.querySelector(".entrevistas-matriz")).toBeNull();
      expect(ficha.querySelector(".entrevistas-falta").textContent).toContain(
        "A ausência elimina neste roteiro: parecer Inapto, total 0.",
      );
      expect(
        document.getElementById("entrevistasFichaParecer").textContent,
      ).toBe("Inapto");
      expect(document.getElementById("entrevistasFichaTotal").textContent).toBe(
        "0",
      );
      // Só o motivo da falta (não as competências sem nota).
      expect(
        [...ficha.querySelectorAll(".entrevistas-resultado-motivos li")].map(
          (li) => li.textContent,
        ),
      ).toEqual(["Faltou: a ausência elimina neste roteiro."]);
      // Faltou pede a justificativa da banca.
      expect(
        ficha.querySelector(".entrevistas-justificativa").dataset.obrigatoria,
      ).toBe("sim");
      await clicar(ficha.querySelector('button[type="submit"]'));
      expect(chamadas(supabase, "lancar_notas_entrevista")).toHaveLength(0);
      expect(ficha.textContent).toContain("obrigatória para Faltou");
      await digitar(justificativa(ficha), "Não compareceu no horário.");
      await clicar(ficha.querySelector('button[type="submit"]'));
      await esperar();
      expect(
        chamadas(supabase, "lancar_notas_entrevista")[0][1].p_dados,
      ).toEqual({
        notas: [],
        justificativa: "Não compareceu no horário.",
        compareceu: "N",
        banca: 1,
      });
    });

    it("enquanto as notas são gravadas, a ficha (em tela cheia, sem o resto da condução) não aceita digitação", async () => {
      let liberar;
      const supabase = supabaseDaConducao({
        respostas: {
          lancar_notas_entrevista: () =>
            new Promise((resolver) => {
              liberar = () => resolver({ data: EDITAL, error: null });
            }),
        },
      });
      await montar(supabase);
      await abrirEdital();
      const ficha = await abrirAFicha();
      const celulas = ficha.querySelectorAll("input.entrevistas-nota");
      await digitar(celulas[0], "4");
      // Modo de análise: a ficha ocupa a tela; o topo e a fila somem.
      expect(document.querySelector(".ui-cabecalho-da-tela")).toBeNull();
      expect(document.getElementById("entrevistasConvocar")).toBeNull();
      await clicar(ficha.querySelector('button[type="submit"]'));
      expect([...celulas].every((c) => c.disabled)).toBe(true);
      expect(
        [...ficha.querySelectorAll(".entrevistas-comparecimento button")].every(
          (b) => b.disabled,
        ),
      ).toBe(true);
      await act(async () => liberar());
      await esperar();
      expect([...celulas].some((c) => c.disabled)).toBe(false);
    });

    it("roteiros indisponíveis: avisa e não relê a cada volta à visão", async () => {
      const supabase = supabaseDaConducao({
        respostas: {
          listar_roteiros_entrevista: () => ({
            data: null,
            error: { code: "XX000", message: "falhou" },
          }),
        },
      });
      await montar(supabase);
      await clicar(visao("preparar"));
      await esperar();
      await abrirPasso("roteiro");
      expect(naTela("Não foi possível carregar os roteiros")).toBe(true);
      expect(chamadas(supabase, "listar_roteiros_entrevista")).toHaveLength(1);
      await clicar(visao("fila"));
      await esperar();
      await clicar(visao("preparar"));
      await esperar();
      await abrirPasso("roteiro");
      expect(chamadas(supabase, "listar_roteiros_entrevista")).toHaveLength(1);
      expect(naTela("Não foi possível carregar os roteiros")).toBe(true);
    });

    it("modo AVALIADOR: só as notas do avaliador ligado ao perfil ficam abertas", async () => {
      const edital = {
        ...EDITAL,
        configuracao: { ...EDITAL.configuracao, lancamento: "AVALIADOR" },
      };
      await montar(supabaseDaConducao({ edital }));
      await abrirEdital();
      const ficha = await abrirAFicha();
      expect(abaAtiva()).toContain("Ana");
      const celulas = notas(ficha);
      expect(celulas).toHaveLength(2);
      expect(
        celulas.every((c) => c.getAttribute("aria-label").includes("Ana")),
      ).toBe(true);
      expect(ficha.textContent).toContain("Você lança só as suas notas.");
      await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
      expect(notas(ficha)).toHaveLength(0);
      expect(ficha.querySelectorAll(".entrevistas-celula-fixa")).toHaveLength(
        2,
      );
    });

    it("administrador global: mostra todos e libera edital fora da janela", async () => {
      const editais = (todos) => ({
        data: {
          admin_global: true,
          editais: [
            {
              id: "m1",
              edital: "100/2026",
              unidade: "CASAI Brasília",
              na_janela: true,
              visivel_por: "janela",
            },
            ...(todos
              ? [
                  {
                    id: "m9",
                    edital: "120/2026",
                    unidade: "DSEI X",
                    na_janela: false,
                    visivel_por: "admin",
                  },
                ]
              : []),
          ],
        },
        error: null,
      });
      const supabase = supabaseDaConducao({
        respostas: {
          listar_editais_entrevista: (args) => editais(args.p_todos),
          liberar_entrevista_edital: () => ({ data: {}, error: null }),
        },
      });
      await montar(supabase);
      const seletor = document.getElementById("entrevistasEdital");
      // O edital e, dentro do seletor, "mostrar também os concluídos".
      expect(seletor.querySelectorAll("option")).toHaveLength(3);
      await escolher(seletor, "__mostrar-todos__");
      await esperar();
      expect(chamadas(supabase, "listar_editais_entrevista").at(-1)[1]).toEqual(
        {
          p_area: expect.any(String),
          p_todos: true,
        },
      );
      expect(seletor.textContent).toContain(
        "120/2026 · DSEI X · fora da janela",
      );
      await escolher(seletor, "m9");
      await esperar();
      const caixa = document.getElementById("entrevistasLiberacao");
      expect(caixa.textContent).toContain(
        "sem etapa de entrevista no cronograma",
      );
      await digitar(caixa.querySelector('input[type="date"]'), "2026-11-15");
      await digitar(
        caixa.querySelector('input[type="text"]'),
        "Cronograma em revisão",
      );
      await clicar(caixa.querySelector("button"));
      await esperar();
      expect(chamadas(supabase, "liberar_entrevista_edital")[0][1]).toEqual({
        p_edital: "m9",
        p_ate: "2026-11-15",
        p_motivo: "Cronograma em revisão",
      });
    });

    it("com concluídos na lista, o seletor separa Ativos e Histórico, com a contagem por situação", async () => {
      publicarLinhasDoMonitoramento([
        { id: "m1", CO_AREA: "saude-indigena", status: "Em andamento" },
        { id: "m9", CO_AREA: "saude-indigena", status: "Concluído" },
      ]);
      const editais = (todos) => ({
        data: {
          admin_global: true,
          editais: [
            { id: "m1", edital: "100/2026", unidade: "CASAI Brasília" },
            ...(todos
              ? [
                  {
                    id: "m9",
                    edital: "120/2026",
                    unidade: "DSEI X",
                    na_janela: false,
                  },
                ]
              : []),
          ],
        },
        error: null,
      });
      await montar(
        supabaseDaConducao({
          respostas: {
            listar_editais_entrevista: (args) => editais(args.p_todos),
          },
        }),
      );
      const seletor = document.getElementById("entrevistasEdital");
      // Só os ativos: sem grupos.
      expect(
        seletor.querySelectorAll("optgroup[label^='Ativos']"),
      ).toHaveLength(0);
      await escolher(seletor, "__mostrar-todos__");
      await esperar();
      const grupos = [...seletor.querySelectorAll("optgroup")];
      expect(grupos.map((g) => g.label)).toEqual([
        "Ativos · Em andamento 1",
        "Histórico · Concluído 1",
        "Mais editais",
      ]);
      expect(
        [...grupos[1].querySelectorAll("option")].map((o) => o.value),
      ).toEqual(["m9"]);
    });

    it("sem nível de editor, tudo aparece só para consulta", async () => {
      const edital = { ...EDITAL, pode_editar: false };
      await montar(supabaseDaConducao({ edital }));
      await abrirEdital();
      await abrirPasso("convocacao");
      expect(document.getElementById("entrevistasConvocar")).toBeNull();
      // Sem selo "Somente consulta": quem só lê não vê os controles de edição.
      expect(naTela("Somente consulta")).toBe(false);
      const ficha = await abrirAFicha();
      expect(ficha.querySelectorAll("input.entrevistas-nota")).toHaveLength(0);
      expect(ficha.querySelector('button[type="submit"]')).toBeNull();
      await clicar(ficha.querySelector('[data-acao="voltar-a-lista"]'));
      await clicar(visao("preparar"));
      await esperar();
      expect(editarConfiguracao()).toBeNull();
      await abrirPasso("roteiro");
      expect(document.getElementById("entrevistasNovoRoteiro")).toBeNull();
      expect(
        document.querySelector('[data-roteiro="r1"]').textContent,
      ).toContain("Ver");
    });
  });

  describe("aspectos da entrevista (roteiro com Conceitua · Propriedade · Profundidade)", () => {
    const ASPECTOS = [
      { id: "s1", ordem: 1, nome: "Conceitua" },
      { id: "s2", ordem: 2, nome: "Propriedade" },
      { id: "s3", ordem: 3, nome: "Profundidade" },
    ];
    const editalComAspectos = () => ({
      ...EDITAL,
      configuracao: {
        ...EDITAL.configuracao,
        roteiro: { ...ROTEIRO, notas_eliminatorias: [], aspectos: ASPECTOS },
      },
      convocados: [
        {
          ...EDITAL.convocados[0],
          avaliacoes: [
            {
              competencia: "c1",
              avaliador: "a1",
              nota: 1.33,
              aspectos: [
                { aspecto: "s1", nota: 2 },
                { aspecto: "s2", nota: 1 },
                { aspecto: "s3", nota: 1 },
              ],
            },
          ],
        },
      ],
    });

    async function abrirFicha(supabase) {
      await montar(supabase);
      return abrirAFicha();
    }

    it("matriz competências × aspectos por avaliador, média da linha no chip, e grava todos os aspectos", async () => {
      const supabase = supabaseDaConducao({ edital: editalComAspectos() });
      const ficha = await abrirFicha(supabase);
      expect(colunas(ficha)).toEqual([
        "Conceitua",
        "Propriedade",
        "Profundidade",
        "Média",
      ]);
      let campos = notas(ficha);
      // Ana: 2 competências × 3 aspectos.
      expect(campos).toHaveLength(6);
      expect(campos.slice(0, 3).map((c) => c.value)).toEqual(["2", "1", "1"]);
      const chip = () => ficha.querySelector(".entrevistas-matriz-media");
      expect(chip().textContent).toBe("1,33");
      expect(chip().dataset.situacao).toBe("abaixo");
      // Beto em c1: 3 aspectos (2, 2, 3) → 2,33; a média da banca 1,83 fica abaixo do mínimo.
      await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
      campos = notas(ficha);
      await digitar(campos[0], "2");
      await digitar(campos[1], "2");
      await digitar(campos[2], "3");
      expect(chip().textContent).toBe("2,33");
      expect(chip().dataset.situacao).toBe("ok");
      expect(
        ficha.querySelector(".entrevistas-notas-da-banca li").dataset.situacao,
      ).toBe("abaixo");
      await clicar(
        ficha.querySelector(
          '.entrevistas-comparecimento button[data-valor="S"]',
        ),
      );
      await clicar(ficha.querySelector('button[type="submit"]'));
      await esperar();
      const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
      expect(argumentos.p_dados.notas).toEqual([
        {
          competencia: "c1",
          avaliador: "a2",
          aspectos: [
            { aspecto: "s1", nota: 2 },
            { aspecto: "s2", nota: 2 },
            { aspecto: "s3", nota: 3 },
          ],
        },
      ]);
    });

    it("aspecto faltando não salva, avisa e abre a aba; apagar todos manda aspectos nulo", async () => {
      const supabase = supabaseDaConducao({ edital: editalComAspectos() });
      const ficha = await abrirFicha(supabase);
      await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
      await digitar(notas(ficha)[0], "4");
      await clicar(ficha.querySelector('[role="tab"][data-aba="a1"]'));
      await clicar(ficha.querySelector('button[type="submit"]'));
      expect(ficha.textContent).toContain(
        "Complete os 3 aspectos de Beto em “Políticas públicas”",
      );
      expect(abaAtiva()).toContain("Beto");
      expect(chamadas(supabase, "lancar_notas_entrevista")).toHaveLength(0);
      await digitar(notas(ficha)[0], "");
      await clicar(ficha.querySelector('[role="tab"][data-aba="a1"]'));
      for (const campo of notas(ficha).slice(0, 3)) await digitar(campo, "");
      await clicar(ficha.querySelector('button[type="submit"]'));
      await esperar();
      const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
      expect(argumentos.p_dados.notas).toEqual([
        { competencia: "c1", avaliador: "a1", aspectos: null },
      ]);
    });

    it("fluxo de digitação: avança, recusa fora da escala, Backspace volta e passa ao próximo avaliador", async () => {
      const ficha = await abrirFicha(
        supabaseDaConducao({ edital: editalComAspectos() }),
      );
      let campos = notas(ficha);
      await act(async () => campos[3].focus());
      await digitar(campos[3], "5");
      expect(campos[3].value).toBe("5");
      expect(document.activeElement).toBe(campos[4]);
      // Fora da escala: a célula não muda, o foco fica e o aviso aparece.
      await digitar(campos[4], "7");
      expect(campos[4].value).toBe("");
      expect(document.activeElement).toBe(campos[4]);
      expect(ficha.querySelector(".entrevistas-matriz-aviso").textContent).toBe(
        "“7” não está na escala (0 a 5).",
      );
      // Backspace na célula vazia volta à anterior.
      await teclar(campos[4], "Backspace");
      expect(document.activeElement).toBe(campos[3]);
      await teclar(campos[3], "ArrowRight");
      await digitar(campos[4], "4");
      await digitar(campos[5], "3");
      // Ana completa: check na aba e a ficha passa sozinha ao Beto, na primeira célula vazia.
      await esperarAvanco();
      expect(
        ficha.querySelector('[data-aba="a1"] .entrevistas-aba-da-ficha-check'),
      ).not.toBeNull();
      expect(abaAtiva()).toContain("Beto");
      campos = notas(ficha);
      expect(document.activeElement).toBe(campos[0]);
      expect(campos[0].getAttribute("aria-label")).toBe(
        "Nota de Beto em Políticas públicas · Conceitua",
      );
      // Seta para baixo: a mesma coluna da competência seguinte.
      await teclar(campos[0], "ArrowDown");
      expect(document.activeElement).toBe(campos[3]);
    });

    it("Por competência fica lembrado no navegador", async () => {
      const ficha = await abrirFicha(
        supabaseDaConducao({ edital: editalComAspectos() }),
      );
      await clicar(
        ficha.querySelector(
          '.entrevistas-modo-da-ficha [data-valor="competencia"]',
        ),
      );
      expect(abaAtiva()).toContain("Políticas públicas");
      // Linhas = avaliadores (Ana e Beto) × 3 aspectos.
      expect(notas(ficha)).toHaveLength(6);
      await clicar(ficha.querySelector('[data-acao="voltar-a-lista"]'));
      const outra = await abrirAFicha();
      expect(abaAtiva()).toContain("Políticas públicas");
      expect(
        outra
          .querySelector(
            '.entrevistas-modo-da-ficha [data-valor="competencia"]',
          )
          .getAttribute("aria-checked"),
      ).toBe("true");
    });

    it("Voltar à fila sai do modo de análise e o topo volta", async () => {
      const ficha = await abrirFicha(
        supabaseDaConducao({ edital: editalComAspectos() }),
      );
      expect(document.querySelector(".ui-cabecalho-da-tela")).toBeNull();
      await clicar(ficha.querySelector('[data-acao="voltar-a-lista"]'));
      expect(document.getElementById("entrevistasFichaDoCandidato")).toBeNull();
      expect(document.querySelector(".ui-cabecalho-da-tela")).not.toBeNull();
      expect(document.querySelector(".entrevistas-fila")).not.toBeNull();
    });

    it("o editor do roteiro preenche o modelo e grava os aspectos", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await clicar(visao("preparar"));
      await esperar();
      await abrirPasso("roteiro");
      const editar = [
        ...document.querySelectorAll('[data-roteiro="r1"] button'),
      ].find((b) => b.textContent.includes("Editar (cria versão 2)"));
      await clicar(editar);
      const editor = document.getElementById("entrevistasEditorDeRoteiro");
      await clicar(editor.querySelector('[data-acao="modelo-de-aspectos"]'));
      // Com aspectos, as médias eliminatórias saem (vale o mínimo da competência).
      await clicar(editor.querySelector('[data-secao="aprovacao"] summary'));
      expect(editor.textContent).toContain(
        "O mínimo de cada competência fica em Competências e aspectos.",
      );
      await clicar(editor.querySelector('button[type="submit"]'));
      await esperar();
      const [[, { p_dados }]] = chamadas(supabase, "salvar_roteiro_entrevista");
      expect(p_dados.aspectos).toEqual([
        { nome: "Conceitua" },
        { nome: "Propriedade" },
        { nome: "Profundidade" },
      ]);
      expect(p_dados.notas_eliminatorias).toEqual([]);
    });
  });

  describe("entrevistas mais claras: fila, Preparar em passos e parecer pronto", () => {
    it("fila: cartões por vaga, busca por nome ou código e estado vazio da busca", async () => {
      const edital = {
        ...EDITAL_DO_DIA,
        convocados: [
          ...EDITAL_DO_DIA.convocados,
          convocado(6, {
            candidato: "Maria das Dores",
            codigo: "43015",
            vaga: "V2",
            cargo: "Técnico de enfermagem",
          }),
        ],
      };
      await montar(
        supabaseDaConducao({
          edital,
          respostas: {
            obter_agenda_entrevista: () => ({
              data: {
                ...AGENDA_DO_DIA,
                itens: [
                  ...AGENDA_DO_DIA.itens,
                  { analise_id: "an6", data: HOJE, inicio: "07:30", banca: 2 },
                ],
              },
              error: null,
            }),
          },
        }),
      );
      // Uma tabela só, em ordem de horário; a vaga é coluna.
      expect(cartoes().map(([id]) => id)).toEqual([
        "e6",
        "e1",
        "e2",
        "e3",
        "e4",
      ]);
      // A linha: horário em destaque, pessoa (nome e "código · modalidade"),
      // vaga com o cargo, banca e situação; sem "0/2" sem nota.
      const cartao = secao.querySelector('tr[data-convocado="e6"]');
      expect(cartao.querySelector(".entrevistas-fila-hora").textContent).toBe(
        "07:30",
      );
      expect(cartao.querySelector(".ui-pessoa").textContent).toBe(
        "Maria das Dores43015 · Ampla",
      );
      expect(cartao.textContent).toContain("V2Técnico de enfermagem");
      expect(cartao.textContent).toContain("Banca 2");
      expect(cartao.querySelector(".entrevistas-fila-notas")).toBeNull();
      // Concluída e faltou: o horário fica acinzentado (encerrada).
      expect(
        secao.querySelector('tr[data-convocado="e4"]').dataset.encerrada,
      ).toBe("");
      // A linha "Agora" (08:30 no teste) separa o que passou do que vem.
      const linhas = [...secao.querySelectorAll(".ui-lista tbody tr")];
      const agora = linhas.findIndex((tr) => tr.dataset.agora !== undefined);
      expect(linhas[agora].textContent).toBe("Agora · 08:30");
      expect(linhas[agora + 1].dataset.convocado).toBe("e2");
      // Em andamento: o botão é azul ("Continuar"); aguardando: neutro ("Iniciar").
      const botao = (id) =>
        secao.querySelector(
          `tr[data-convocado="${id}"] [data-acao="abrir-ficha"]`,
        );
      expect(botao("e2").textContent).toBe("Continuar");
      expect(botao("e2").className).toBe("btn small");
      expect(botao("e1").textContent).toBe("Iniciar");
      expect(botao("e1").className).toBe("btn contorno small");
      // Faltou: "Remarcar" (a agenda é da Classificação) e a ficha no ⋯.
      expect(
        secao.querySelector('tr[data-convocado="e3"] [data-acao="remarcar"]'),
      ).not.toBeNull();
      // A próxima do dia (a partir de agora, aguardando), com "Iniciar".
      expect(secao.querySelector(".entrevistas-proxima").textContent).toContain(
        "Próxima",
      );
      const busca = secao.querySelector('[data-acao="fila-busca"]');
      await digitar(busca, "dores");
      expect(cartoes()).toEqual([["e6", "aguardando"]]);
      await digitar(busca, "43015");
      expect(cartoes()).toEqual([["e6", "aguardando"]]);
      await digitar(busca, "ninguém assim");
      expect(cartoes()).toEqual([]);
      expect(naTela("Ninguém por aqui")).toBe(true);
      await clicar(secao.querySelector('[data-acao="limpar-filtros"]'));
      expect(cartoes()).toHaveLength(5);
    });

    it("faixa: cada número é o total da lista que abre; Sem nota é de qualquer dia, com Lançar nota", async () => {
      const agenda = {
        ...AGENDA_DO_DIA,
        // e5 era ontem e ninguém lançou a nota.
        itens: AGENDA_DO_DIA.itens.map((i) =>
          i.analise_id === "an5" ? { ...i, data: "2026-10-06" } : i,
        ),
      };
      await montar(
        supabaseDaConducao({
          edital: EDITAL_DO_DIA,
          respostas: {
            obter_agenda_entrevista: () => ({ data: agenda, error: null }),
          },
        }),
      );
      const faixa = secao.querySelector("[data-tour='conduzir-situacoes']");
      const numero = (v) =>
        faixa.querySelector(`[data-valor='${v}'] .ui-faixa-numero`).textContent;
      expect(
        [
          "todas",
          "aguardando",
          "em_andamento",
          "concluida",
          "faltou",
          "sem_nota",
        ].map(numero),
      ).toEqual(["4", "1", "1", "1", "1", "1"]);
      for (const v of ["aguardando", "faltou", "sem_nota"]) {
        await clicar(faixa.querySelector(`[data-valor='${v}']`));
        expect(String(cartoes().length)).toBe(numero(v));
      }
      // Sem nota (de ontem): o botão azul "Lançar nota".
      expect(cartoes()).toEqual([["e5", "sem_nota"]]);
      const lancar = secao.querySelector(
        'tr[data-convocado="e5"] [data-acao="abrir-ficha"]',
      );
      expect(lancar.textContent).toBe("Lançar nota");
      expect(lancar.className).toBe("btn small");
      // O contador do dia e a barra da distribuição ficam embaixo da faixa.
      expect(contador()).toBe("2 de 4 hoje");
      expect(faixa.querySelector("[role='img']")).not.toBeNull();
    });

    it("Preparar: quatro passos com o estado e o que falta; abre no primeiro pendente", async () => {
      await montar(supabaseDaConducao());
      await abrirEdital();
      const estados = () =>
        [...document.querySelectorAll(".entrevistas-passos li")].map((li) => [
          li.dataset.passo,
          li.dataset.estado,
        ]);
      // Roteiro e banca prontos; falta convocar o 2º da lista e montar a agenda.
      expect(estados()).toEqual([
        ["roteiro", "feito"],
        ["banca", "feito"],
        ["convocacao", "atual"],
        ["agenda", "pendente"],
      ]);
      expect(
        document.querySelector(".entrevistas-preparar-andamento").textContent,
      ).toBe("2 de 4 passos prontos");
      // A barra dos quatro passos diz cada um no nome acessível.
      expect(
        document
          .querySelector(".entrevistas-preparar-barra")
          .getAttribute("aria-label"),
      ).toBe(
        "Passos: Roteiro pronto, Banca pronto, Convocação pendente, Agenda pendente",
      );
      expect(
        corpoDoPasso().querySelector(".entrevistas-o-que-falta").textContent,
      ).toContain("1 candidato da lista ainda não foi convocado.");
      // Passo 3: a frase simples de quem é chamado e a tabela das vagas.
      expect(corpoDoPasso().textContent).toContain(
        "Até 1 pessoa por vaga imediata",
      );
      const agenda = await abrirPasso("agenda");
      expect(agenda.textContent).toContain(
        "Monte a agenda na Classificação (dia, horário e banca de cada candidato).",
      );
      expect(agenda.textContent).toContain(
        "Nenhum horário salvo para este edital.",
      );
      // O atalho abre a Classificação já na aba Agenda (?visao=agenda).
      const montarAgenda = agenda.querySelector(
        '[data-ir-para="classificacao"]',
      );
      expect(montarAgenda.textContent.trim()).toBe(
        "Montar a agenda na Classificação",
      );
      expect(montarAgenda.dataset.visao).toBe("agenda");
      const banca = await abrirPasso("banca");
      expect(banca.textContent).toContain("Banca 1");
      expect(banca.textContent).toContain("Avalia todas as competências");
      // Preparar só mostra: editar a banca é nas Regras do edital.
      expect(editarConfiguracao()).toBeNull();
      expect(banca.textContent).toContain(
        "Editar a banca nas Regras do edital",
      );
      // Lá, a lista do que falta fica perto do Salvar.
      const editor = await abrirConfiguracaoNasRegras(supabaseDaConducao());
      await clicar(editor.querySelector('[data-acao="editar-configuracao"]'));
      const nome = editor.querySelector(".entrevistas-linha-membro input");
      await digitar(nome, "A");
      expect(
        editor.querySelector(".entrevistas-pendencias").textContent,
      ).toContain("Membro 1 (A): Nome do avaliador: de 2 a 150 caracteres.");
    });

    it("ficha: com tudo lançado, o parecer em texto pronto com Copiar parecer", async () => {
      const writeText = vi.fn(async () => {});
      const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: { writeText },
      });
      try {
        const dados = {
          ...EDITAL,
          convocados: [
            {
              ...EDITAL.convocados[0],
              compareceu: "S",
              parecer: "APTO",
              nota: 8,
              avaliacoes: todasAsNotas,
            },
          ],
        };
        await montar(supabaseDaConducao({ edital: dados }));
        const ficha = await abrirAFicha();
        const parecer = ficha.querySelector(".entrevistas-parecer-pronto");
        expect(parecer).not.toBeNull();
        const texto = parecer.querySelector("pre").textContent;
        expect(texto).toContain(
          "Parecer da entrevista — Candidato 1 (cód. K1)",
        );
        expect(texto).toContain("Edital 100/2026 · Vaga V1 · Enfermeiro");
        expect(texto).toContain("1. Políticas públicas: 4 de 5 (mínimo 2)");
        expect(texto).toContain("Total: 8 de 10 (mínimo 4)");
        expect(texto).toContain("Parecer: APTO");
        await clicar(parecer.querySelector('[data-acao="copiar-parecer"]'));
        await esperar();
        expect(writeText).toHaveBeenCalledWith(texto);
        expect(parecer.textContent).toContain("Parecer copiado.");
        // Apagar uma nota tira o parecer pronto (volta a faltar nota).
        await digitar(notas(ficha)[0], "");
        expect(ficha.querySelector(".entrevistas-parecer-pronto")).toBeNull();
      } finally {
        if (original) Object.defineProperty(navigator, "clipboard", original);
        else delete navigator.clipboard;
      }
    });
  });

  describe("observação do avaliador e justificativa da banca", () => {
    it("observação embaixo da matriz de cada avaliador e junto do nome por competência; grava só o que mudou", async () => {
      const edital = {
        ...EDITAL,
        convocados: [
          {
            ...EDITAL.convocados[0],
            observacoes: [{ avaliador: "a2", texto: "Beto: boa escuta." }],
          },
        ],
      };
      const supabase = supabaseDaConducao({ edital });
      await montar(supabase);
      const ficha = await abrirAFicha();
      const observacao = () =>
        ficha.querySelector(".entrevistas-observacao textarea");
      // Aba da Ana: o campo dela, vazio; o "(opcional)" no rótulo.
      expect(abaAtiva()).toContain("Ana");
      expect(observacao().value).toBe("");
      expect(
        ficha.querySelector(".entrevistas-observacao label").textContent,
      ).toBe("Observação do avaliador (opcional)");
      await digitar(observacao(), "Ana: respostas objetivas.");
      // Aba do Beto: o texto gravado dele.
      await clicar(ficha.querySelector('[role="tab"][data-aba="a2"]'));
      expect(observacao().value).toBe("Beto: boa escuta.");
      // Por competência: um campo por avaliador, com o nome.
      await clicar(ficha.querySelector('button[data-valor="competencia"]'));
      expect(
        [...ficha.querySelectorAll(".entrevistas-observacoes label")].map(
          (l) => l.textContent,
        ),
      ).toEqual(["Ana", "Beto"]);
      await clicar(ficha.querySelector('button[type="submit"]'));
      await esperar();
      const [[, argumentos]] = chamadas(supabase, "lancar_notas_entrevista");
      expect(argumentos.p_dados.observacoes).toEqual([
        { avaliador: "a1", texto: "Ana: respostas objetivas." },
      ]);
      expect(argumentos.p_dados).not.toHaveProperty("justificativa");
    });

    it("Apto: justificativa opcional; o parecer pronto leva a justificativa", async () => {
      const dados = {
        ...EDITAL,
        convocados: [
          {
            ...EDITAL.convocados[0],
            compareceu: "S",
            parecer: "APTO",
            nota: 8,
            avaliacoes: todasAsNotas,
            justificativa: "Domínio do SasiSUS.",
          },
        ],
      };
      await montar(supabaseDaConducao({ edital: dados }));
      const ficha = await abrirAFicha();
      expect(
        ficha.querySelector(".entrevistas-justificativa label").textContent,
      ).toBe("Justificativa da banca (opcional para Apto)");
      expect(justificativa(ficha).value).toBe("Domínio do SasiSUS.");
      expect(
        ficha.querySelector('[data-acao="ir-para-justificativa"]'),
      ).toBeNull();
      expect(
        ficha.querySelector(".entrevistas-parecer-pronto pre").textContent,
      ).toContain("Justificativa da banca: Domínio do SasiSUS.");
    });
  });

  /*
  22/10: voltar à tela (render() relê o edital) reiniciava a ficha com os dados
  do banco e apagava as notas digitadas; o Preparar desmontava durante a
  releitura e perdia o rascunho; a ficha abria "suja" sem mexer quando o
  convocado não tinha banca num edital de banca única; o editor de roteiro
  fechava sem perguntar.
*/
  describe("conduzir sem perder trabalho", () => {
    const ficha = () => document.getElementById("entrevistasFichaDoCandidato");

    afterEach(() => vi.restoreAllMocks());

    it("notas não salvas: voltar à tela não reinicia a ficha e a guarda segura o F5", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await abrirAFicha();
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
      await digitar(notas(ficha())[0], "3");
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(true);
      expect(guardaDeAlteracoes.podeRecarregar()).toBe(false);
      const saida = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(saida);
      expect(saida.defaultPrevented).toBe(true);

      await act(async () => void tela.render());
      await esperar();
      expect(chamadas(supabase, "obter_entrevistas_do_edital").length).toBe(2);
      expect(notas(ficha())[0].value).toBe("3");

      // Sair confirmando: a guarda sai junto com a ficha.
      vi.spyOn(window, "confirm").mockReturnValue(true);
      await clicar(ficha().querySelector('[data-acao="voltar-a-lista"]'));
      expect(ficha()).toBeNull();
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
    });

    it("depois de salvar, a ficha recomeça do que o banco devolveu", async () => {
      const salvo = {
        ...EDITAL,
        convocados: [
          {
            ...EDITAL.convocados[0],
            compareceu: "S",
            avaliacoes: [{ competencia: "c1", avaliador: "a1", nota: 3 }],
          },
        ],
      };
      const supabase = supabaseDaConducao({
        respostas: {
          lancar_notas_entrevista: () => ({ data: salvo, error: null }),
        },
      });
      await montar(supabase);
      await abrirAFicha();
      await digitar(notas(ficha())[0], "3");
      await teclar(notas(ficha())[0], "Enter", { ctrlKey: true });
      await esperar();
      expect(chamadas(supabase, "lancar_notas_entrevista").length).toBe(1);
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
      expect(notas(ficha())[0].value).toBe("3");
    });

    it("convocado sem banca num edital de banca única: a ficha abre limpa", async () => {
      const supabase = supabaseDaConducao({
        edital: {
          ...EDITAL,
          convocados: [{ ...EDITAL.convocados[0], banca: null }],
        },
      });
      await montar(supabase);
      await abrirAFicha();
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
      const confirmar = vi.spyOn(window, "confirm");
      await clicar(ficha().querySelector('[data-acao="voltar-a-lista"]'));
      expect(confirmar).not.toHaveBeenCalled();
      expect(ficha()).toBeNull();
    });

    it("releitura do mesmo edital mantém o Preparar montado", async () => {
      let soltar = null;
      let vez = 0;
      const supabase = supabaseDaConducao({
        respostas: {
          obter_entrevistas_do_edital: () => {
            vez += 1;
            if (vez === 1) return { data: EDITAL, error: null };
            return new Promise((resolver) => {
              soltar = () => resolver({ data: EDITAL, error: null });
            });
          },
        },
      });
      await montar(supabase);
      await abrirEdital();
      const passos = document.querySelector(".entrevistas-passos");
      expect(passos).not.toBeNull();
      let render;
      await act(async () => {
        render = tela.render();
      });
      await esperar();
      expect(document.body.textContent).toContain("Abrindo o edital…");
      expect(document.querySelector(".entrevistas-passos")).toBe(passos);
      await act(async () => {
        soltar();
        await render;
      });
      expect(document.querySelector(".entrevistas-passos")).toBe(passos);
    });

    it("o editor de roteiro com alteração pergunta antes de fechar", async () => {
      const supabase = supabaseDaConducao();
      await montar(supabase);
      await clicar(visao("preparar"));
      await esperar();
      await abrirPasso("roteiro");
      const abrirEditor = async () => {
        await clicar(
          [...document.querySelectorAll('[data-roteiro="r1"] button')].find(
            (b) => b.textContent.includes("Editar (cria versão 2)"),
          ),
        );
        return document.getElementById("entrevistasEditorDeRoteiro");
      };
      const cancelar = (editor) =>
        [...editor.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === "Cancelar",
        );
      const pergunta = () => document.querySelector(".ui-modal-descarte");
      const botaoDaPergunta = (texto) =>
        [...pergunta().querySelectorAll("button")].find(
          (b) => b.textContent.trim() === texto,
        );

      // Sem mudança: fecha direto.
      let editor = await abrirEditor();
      await clicar(cancelar(editor));
      expect(pergunta()).toBeNull();
      expect(document.getElementById("entrevistasEditorDeRoteiro")).toBeNull();

      editor = await abrirEditor();
      await digitar(
        editor.querySelectorAll(
          'li[data-competencia="1"] input[type="number"]',
        )[1],
        "1.5",
      );
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(true);
      await clicar(cancelar(editor));
      expect(pergunta()?.textContent).toContain("Descartar as alterações?");
      await clicar(botaoDaPergunta("Continuar editando"));
      expect(pergunta()).toBeNull();
      expect(
        document.getElementById("entrevistasEditorDeRoteiro"),
      ).not.toBeNull();
      await clicar(cancelar(editor));
      await clicar(botaoDaPergunta("Descartar alterações"));
      expect(document.getElementById("entrevistasEditorDeRoteiro")).toBeNull();
      expect(guardaDeAlteracoes.comAlteracoes()).toBe(false);
    });
  });

  describe("concluir e reabrir a entrevista (como a ficha da Avaliação documental)", () => {
    const pronta = convocado(1, {
      compareceu: "S",
      parecer: "APTO",
      avaliacoes: todasAsNotas,
      justificativa: "Banca registrou o resultado.",
    });
    const concluida = {
      ...pronta,
      concluida_em: "2026-11-17T12:00:00Z",
      concluida_por: "Ana",
    };

    it("resultado definido e salvo: Concluir grava e a ficha fica só leitura, com quem concluiu", async () => {
      const edital = { ...EDITAL, convocados: [pronta] };
      const supabase = supabaseDaConducao({
        edital,
        respostas: {
          concluir_entrevista: () => ({
            data: { ...edital, convocados: [concluida] },
            error: null,
          }),
        },
      });
      await montar(supabase);
      const ficha = await abrirAFicha("e1");
      await clicar(ficha.querySelector('[data-acao="concluir-entrevista"]'));
      await esperar();
      expect(chamadas(supabase, "concluir_entrevista")).toEqual([
        ["concluir_entrevista", { p_entrevista: "e1" }],
      ]);
      const depois = document.getElementById("entrevistasFichaDoCandidato");
      expect(depois.textContent).toContain("Concluída por Ana em");
      expect(depois.querySelectorAll("input.entrevistas-nota")).toHaveLength(0);
      expect(depois.querySelector('button[type="submit"]')).toBeNull();
      expect(
        depois.querySelector('[data-acao="concluir-entrevista"]'),
      ).toBeNull();
      // Sem a coordenação, não há Reabrir.
      expect(depois.querySelector('[data-acao="reabrir-motivo"]')).toBeNull();
      expect(
        [...depois.querySelectorAll("button")].some(
          (b) => b.textContent.trim() === "Reabrir",
        ),
      ).toBe(false);
    });

    it("com notas por salvar, não aparece Concluir", async () => {
      await montar(
        supabaseDaConducao({ edital: { ...EDITAL, convocados: [pronta] } }),
      );
      const ficha = await abrirAFicha("e1");
      expect(
        ficha.querySelector('[data-acao="concluir-entrevista"]'),
      ).not.toBeNull();
      await digitar(notas(ficha)[0], "3");
      expect(
        ficha.querySelector('[data-acao="concluir-entrevista"]'),
      ).toBeNull();
    });

    it("a coordenação reabre com o motivo da lista; sem motivo nada vai ao banco", async () => {
      const edital = { ...EDITAL, pode_reabrir: true, convocados: [concluida] };
      const supabase = supabaseDaConducao({
        edital,
        respostas: {
          reabrir_entrevista: () => ({
            data: { ...edital, convocados: [pronta] },
            error: null,
          }),
        },
      });
      await montar(supabase);
      const ficha = await abrirAFicha("e1");
      expect(ficha.querySelectorAll("input.entrevistas-nota")).toHaveLength(0);
      await clicar(
        [...ficha.querySelectorAll("button")].find(
          (b) => b.textContent.trim() === "Reabrir",
        ),
      );
      const confirmar = () =>
        clicar(ficha.querySelector('[data-acao="confirmar-reabrir"]'));
      await confirmar();
      expect(ficha.textContent).toContain("Escolha o motivo da reabertura.");
      expect(chamadas(supabase, "reabrir_entrevista")).toEqual([]);
      await escolher(
        ficha.querySelector("[data-campo='motivo-da-reabertura']"),
        "NOTA",
      );
      await digitar(
        ficha.querySelector("[data-campo='complemento-da-reabertura']"),
        "nota da competência 2",
      );
      await confirmar();
      await esperar();
      expect(chamadas(supabase, "reabrir_entrevista")).toEqual([
        [
          "reabrir_entrevista",
          {
            p_entrevista: "e1",
            p_motivo: "NOTA",
            p_complemento: "nota da competência 2",
          },
        ],
      ]);
      const depois = document.getElementById("entrevistasFichaDoCandidato");
      expect(
        depois.querySelectorAll("input.entrevistas-nota").length,
      ).toBeGreaterThan(0);
    });
  });
});

bloco("modulos/regras-do-edital", () => {
  /*
  Regras do edital (Editais › Regras do edital), etapas 3 e 5: a Entrevista
  edita o roteiro e a banca (loja de condução, configurar_entrevista_edital)
  e a Chamada para contratação, a configuração de convocação (loja da Lista
  de aprovados, salvar_configuracao_convocacao). Mesmas RPCs e permissões
  das telas de antes; abrir só lê.
*/

  const EDITAL = "e93";
  const ROTEIRO = {
    id: "r1",
    nome: "Roteiro da Saúde Indígena",
    versao: 1,
    ativo: true,
    escala_min: 0,
    escala_max: 5,
    competencias: [
      { id: "c1", nome: "Políticas públicas", ordem: 1 },
      { id: "c2", nome: "Habilidade interpessoal", ordem: 2 },
    ],
    aspectos: [],
  };

  const ENTREVISTAS = (mudancas = {}) => ({
    edital: { id: EDITAL, edital: "93/2026" },
    pode_editar: true,
    configuracao: { roteiro: ROTEIRO, lancamento: "SECRETARIA", banca: [] },
    regra_classificacao: {
      versao: 1,
      convocacao: { multiplo_vagas: 3, incluir_empatados: true },
      desempate: [{ criterio: "IDOSO_60" }],
      empate_final: { metodo: "SORTEIO" },
    },
    lista_convocacao: { lista: { id: "l1" } },
    avaliadores: [
      {
        id: "a1",
        nome: "Ana Fictícia",
        origem: "AgSUS",
        banca: 1,
        ativo: true,
      },
    ],
    convocados: [],
    ...mudancas,
  });

  function supabaseDaEntrevista(mudancas) {
    const respostas = {
      obter_entrevistas_do_edital: ENTREVISTAS(mudancas),
      obter_previsao_entrevista_edital: {
        situacao: "PREVISTA",
        motivo: null,
        pode_alterar: true,
      },
      obter_agenda_entrevista: { itens: [] },
      listar_roteiros_entrevista: [ROTEIRO],
      configurar_entrevista_edital: ENTREVISTAS(mudancas),
    };
    return {
      rpc: vi.fn(async (nome) => ({
        data: respostas[nome] ?? null,
        error: null,
      })),
      auth: {
        getSession: async () => ({ data: { session: null } }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe() {} } },
        }),
      },
    };
  }

  const MODELO = {
    modelo_id: "m1",
    nome: "Modelo de teste",
    distribuicao: "serie_mgi",
    cota_multipla: "maior_percentual",
    editais: 1,
    categorias: [
      { id: "ac", sigla: "AC", rotulo: "Ampla", ampla: true, ordem: 0 },
      {
        id: "pp",
        sigla: "PP",
        rotulo: "Pretos e pardos",
        percentual: 25,
        ordem: 1,
      },
    ],
  };

  /* O banco da Lista de aprovados: a abertura numa chamada e as gravações. */
  function supabaseDosAprovados() {
    const responder = (nome) => {
      const respostas = {
        listar_listas_aprovados: [
          { lista_id: "L1", edital_id: EDITAL, edital: "93/2026", ativo: true },
        ],
        listar_candidatos_aprovados_compacto: compactarCandidatos([
          {
            candidato_id: "c1",
            nome: "Pessoa Fictícia",
            modalidade: "Ampla",
            nota: 90,
            classificacao: 1,
            cargo: "Analista",
            codigo_vaga: "177001",
            edital_id: EDITAL,
            edital: "93/2026",
            lista_ativa: true,
            status: "",
          },
        ]),
        listar_modelos_convocacao: [MODELO],
        listar_configuracao_convocacao: [
          {
            edital_id: EDITAL,
            modelo_id: "m1",
            proporcionalidade: true,
            padrao_imediata: 0,
            vagas: [{ codigo_vaga: "177001", cargo: "Analista", imediatas: 2 }],
          },
        ],
        salvar_configuracao_convocacao: { ok: true },
      };
      const resposta = Promise.resolve({
        data: respostas[nome] ?? null,
        error: null,
      });
      resposta.range = () => resposta;
      return resposta;
    };
    return {
      rpc: vi.fn((nome, argumentos) =>
        nome === "abrir_lista_aprovados"
          ? aberturaPelasChamadasDeAntes(responder, argumentos)
          : responder(nome, argumentos),
      ),
    };
  }

  function lojaDosAprovados(perfil) {
    const supabase = supabaseDosAprovados();
    const estado = criarEstadoDaListaDeAprovados({
      supabase,
      getProfile: () => perfil,
      areaAtual: () => "saude-indigena",
      toast: () => {},
      confirmar: () => true,
    });
    return { supabase, estado };
  }

  let montado;
  beforeEach(() => {
    definirAreaAtual("saude-indigena");
    publicarLinhasDoMonitoramento([{ id: EDITAL, CO_AREA: "saude-indigena" }]);
  });
  afterEach(async () => {
    await act(async () => montado?.raiz.unmount());
    montado = null;
    document.body.innerHTML = "";
    redefinirDadosDoMonitoramento();
  });

  const nomes = (supabase) => supabase.rpc.mock.calls.map(([n]) => n);

  async function esperarPor(seletor) {
    for (let i = 0; i < 30; i += 1) {
      const achado = montado.secao.querySelector(seletor);
      if (achado) return achado;
      await esperar();
    }
    return null;
  }

  describe("Regras do edital: Entrevista", () => {
    it("o resumo e o roteiro e a banca gravados; abrir só lê", async () => {
      const supabase = supabaseDaEntrevista();
      montado = await montarRegrasDoEdital({
        supabase,
        editalId: EDITAL,
        etapa: "entrevista",
      });
      const editor = await esperarPor(
        "[data-tour='regras-do-edital-entrevista']",
      );
      const texto = montado.secao.textContent;
      expect(texto).toContain("Quem é chamado para a entrevista");
      expect(editor.textContent).toContain("Roteiro da Saúde Indígena");
      expect(editor.textContent).toContain("Ana Fictícia");
      expect(
        editor.querySelector("[data-acao='editar-configuracao']").textContent,
      ).toContain("Editar roteiro e banca");
      expect(nomes(supabase)).not.toContain("configurar_entrevista_edital");
      expect(nomes(supabase)).toContain("listar_roteiros_entrevista");
    });

    it("editar e salvar grava pela configurar_entrevista_edital", async () => {
      const supabase = supabaseDaEntrevista();
      montado = await montarRegrasDoEdital({
        supabase,
        editalId: EDITAL,
        etapa: "entrevista",
      });
      const editor = await esperarPor(
        "[data-tour='regras-do-edital-entrevista']",
      );
      await clicar(editor.querySelector("[data-acao='editar-configuracao']"));
      expect(
        editor.querySelector("[data-campo='roteiro-do-edital']").value,
      ).toBe("r1");
      await clicar(editor.querySelector('button[data-valor="AVALIADOR"]'));
      await clicar(editor.querySelector("[data-acao='salvar-configuracao']"));
      await esperar();
      const gravacoes = supabase.rpc.mock.calls.filter(
        ([n]) => n === "configurar_entrevista_edital",
      );
      expect(gravacoes).toHaveLength(1);
      expect(gravacoes[0][1]).toMatchObject({
        p_edital: EDITAL,
        p_dados: {
          roteiro: "r1",
          lancamento: "AVALIADOR",
          avaliadores: [{ id: "a1", nome: "Ana Fictícia", banca: 1 }],
        },
      });
      // Salvo: volta à leitura.
      expect(
        editor.querySelector("[data-acao='salvar-configuracao']"),
      ).toBeNull();
    });

    it("quem o banco não deixa editar vê sem botões", async () => {
      montado = await montarRegrasDoEdital({
        supabase: supabaseDaEntrevista({ pode_editar: false }),
        editalId: EDITAL,
        etapa: "entrevista",
      });
      const editor = await esperarPor(
        "[data-tour='regras-do-edital-entrevista']",
      );
      expect(
        editor.querySelector("[data-acao='editar-configuracao']"),
      ).toBeNull();
      expect(editor.textContent).toContain("Roteiro da Saúde Indígena");
    });
  });

  describe("Regras do edital: Chamada para contratação", () => {
    it("o formulário sobre a loja da Lista de aprovados; salvar usa a RPC de sempre", async () => {
      const { supabase, estado } = lojaDosAprovados({
        ativo: true,
        admin_global: true,
        perfil: "admin",
      });
      montado = await montarRegrasDoEdital({
        supabase: supabaseDaEntrevista(),
        editalId: EDITAL,
        etapa: "chamada",
        aprovados: async () => estado,
      });
      const salvar = await esperarPor("#convocacaoSalvar");
      expect(salvar).not.toBeNull();
      expect(montado.secao.querySelector("#convocacaoModelo").value).toBe("m1");
      expect(
        [...montado.secao.querySelectorAll("[data-convocacao-vaga]")].map(
          (l) => l.dataset.convocacaoVaga,
        ),
      ).toEqual(["177001"]);
      expect(nomes(supabase)).not.toContain("salvar_configuracao_convocacao");
      await clicar(montado.secao.querySelector('input[value="sem"]'));
      await clicar(salvar);
      await esperar();
      const [[, argumentos]] = supabase.rpc.mock.calls.filter(
        ([n]) => n === "salvar_configuracao_convocacao",
      );
      expect(argumentos).toMatchObject({
        p_edital_id: EDITAL,
        p_proporcionalidade: false,
      });
    });

    it("sem permissão, o formulário fica travado; trocar de etapa", async () => {
      const { estado } = lojaDosAprovados({ ativo: true, perfil: "usuario" });
      montado = await montarRegrasDoEdital({
        supabase: supabaseDaEntrevista(),
        editalId: EDITAL,
        etapa: "chamada",
        aprovados: async () => estado,
      });
      expect(await esperarPor("#convocacaoPermissionNote")).not.toBeNull();
      expect(montado.secao.querySelector("#convocacaoSalvar")).toBeNull();
      expect(montado.secao.querySelector("#convocacaoModelo").disabled).toBe(
        true,
      );
      await clicar(
        [...montado.secao.querySelectorAll(".ui-segmentado button")].find((b) =>
          b.textContent.includes("Entrevista"),
        ),
      );
      await esperar();
      expect(
        montado.secao.querySelector("[data-tour='regras-do-edital']").dataset
          .etapa,
      ).toBe("entrevista");
    });

    it("a Lista de aprovados indisponível vira erro com Tentar de novo", async () => {
      let vezes = 0;
      montado = await montarRegrasDoEdital({
        supabase: supabaseDaEntrevista(),
        editalId: EDITAL,
        etapa: "chamada",
        aprovados: async () => {
          vezes += 1;
          return null;
        },
      });
      await esperar();
      const chamada = montado.secao.querySelector(
        "[data-tour='regras-do-edital-chamada']",
      );
      expect(chamada.textContent).toContain(
        "A Lista de aprovados não está disponível.",
      );
      await clicar(chamada.querySelector("button"));
      await esperar();
      expect(vezes).toBe(2);
    });
  });
});
