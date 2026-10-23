import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { gerarXlsx } from "../../src/lib/classificacao/exportacao.ts";
import {
  ESPERA_DO_RELATORIO_MS,
  estadoDoRelatorio,
  lerDesempateDaLista,
  lerRespostaDoDesempate,
  linhasDoCabecalho,
  momentoBR,
  nomeDaLista,
  paginaDoDesempate,
  planilhasDoDesempate,
  resumoDoDesempate,
  textoDoValor,
  VERSAO_DO_RELATORIO,
  VERSOES_LIDAS,
} from "../../src/lib/classificacao/relatorio-de-desempate.ts";

/*
  A leitura do relatório de desempate na tela (src/lib/classificacao/
  relatorio-de-desempate.ts). O relatório dourado é o que o Python gera hoje
  (python/monitora/classificacao/desempate.py) para o edital fictício dos casos
  dourados — o pytest (tests/python/test_classificacao_desempate.py) confere
  que o arquivo continua igual ao que o Python gera; aqui, que a tela o lê.
  O da versão 1 (relatorio-de-desempate-v1.json) é o que o Python gravava antes
  do cabeçalho e da idade em anos: a tela continua lendo e exportando.
*/
const ler = (arquivo) =>
  JSON.parse(readFileSync(`tests/fixtures/classificacao/${arquivo}`, "utf8"));
const DOURADO = ler("relatorio-de-desempate.json");
const DOURADO_V1 = ler("relatorio-de-desempate-v1.json");

/* O conteúdo do zip (sem compressão) como texto. */
const textoDoZip = (bytes) => new TextDecoder().decode(bytes);

describe("relatório de desempate na tela", () => {
  it("lê a resposta de obter_desempate_da_lista gerada pelo Python", () => {
    const d = lerDesempateDaLista(DOURADO);
    expect(d).not.toBeNull();
    expect(d.listaId).toBe("lista-ficticia-final");
    expect(d.relatorio.versao).toBe(VERSAO_DO_RELATORIO);
    expect(d.relatorio.vagas.length).toBeGreaterThan(0);
    expect(d.grupos).toBe(
      d.relatorio.vagas.reduce((s, v) => s + v.grupos.length, 0),
    );
    expect(d.texto).toContain("RELATÓRIO DE DESEMPATE");
  });

  it("sem relatório, versão desconhecida ou resposta malformada: null (o botão não aparece)", () => {
    expect(lerDesempateDaLista(null)).toBeNull();
    expect(
      lerDesempateDaLista({
        ...DOURADO,
        relatorio: { ...DOURADO.relatorio, versao: 99 },
      }),
    ).toBeNull();
    const quebrado = structuredClone(DOURADO);
    quebrado.relatorio.vagas[0].grupos[0].candidatos[0] = { codigo: "x" };
    expect(lerDesempateDaLista(quebrado)).toBeNull();
    expect(lerDesempateDaLista({ ...DOURADO, lista_id: 5 })).toBeNull();
  });

  it("monta as planilhas Resumo, Grupos, Pares e Candidatos, com filtro nas três últimas", () => {
    const d = lerDesempateDaLista(DOURADO);
    const primeiro = d.relatorio.vagas[0].grupos[0].candidatos[0];
    expect(primeiro.nome).toBeTruthy();
    const planilhas = planilhasDoDesempate(d);
    expect(planilhas.map((p) => p.nome)).toEqual([
      "Resumo",
      "Grupos",
      "Pares",
      "Candidatos",
    ]);
    expect(planilhas.map((p) => p.filtro === true)).toEqual([
      false,
      true,
      true,
      true,
    ]);
    const [resumo, grupos, pares, candidatos] = planilhas;
    expect(resumo.linhas).toContainEqual(["Edital", "nº 999/2026"]);
    expect(resumo.linhas).toContainEqual([
      "Gerada por",
      "Maria Exemplo da Silva",
    ]);
    expect(resumo.linhas).toContainEqual(["Grupos de empate", 16]);
    expect(resumo.linhas).toContainEqual(["60+", 3, 3]);
    expect(resumo.linhas).toContainEqual(["sorteio registrado", 1, 2]);
    expect(grupos.linhas.length).toBe(1 + 16);
    expect(grupos.linhas.map((l) => l[2])).toContain(
      "Lista de cota: Pretos, pardos, indígenas e quilombolas (PPIQ)",
    );
    expect(candidatos.linhas[0]).toContain("Decidido por");
    expect(candidatos.linhas[0]).toContain("60+");
    expect(candidatos.linhas[0]).toContain("Idade na data de corte");
    expect(candidatos.linhas.flat()).toContain(primeiro.nome);
    expect(candidatos.linhas.flat()).toContain(primeiro.codigo);
    expect(candidatos.linhas.flat()).toContain(primeiro.idade);
    expect(pares.linhas.flat()).toContain(
      `${primeiro.nome} (insc. ${primeiro.codigo})`,
    );
    expect(d.texto).toContain(`${primeiro.nome} (insc. ${primeiro.codigo})`);
    const porIdade = pares.linhas.find((l) =>
      String(l[6]).includes("hora da certidão"),
    );
    expect(porIdade?.[5]).toBe("idade");
    expect(porIdade?.[6]).toBe(
      "34 anos, 1º mais velho do grupo × 34 anos, 2º mais velho do grupo, sem certidão (mesma data; hora da certidão)",
    );
    expect(
      pares.linhas.some((l) => String(l[7]).includes("sorteio registrado")),
    ).toBe(true);
    expect(pares.linhas.some((l) => String(l[7]).includes("pendente"))).toBe(
      true,
    );
  });

  it("o XLSX leva o filtro e o cabeçalho fixo nas planilhas com filtro", () => {
    const xlsx = textoDoZip(
      gerarXlsx(planilhasDoDesempate(lerDesempateDaLista(DOURADO))),
    );
    expect(xlsx).toContain('<autoFilter ref="A1:J17"/>');
    expect(xlsx).toContain('state="frozen"');
    expect(xlsx).toContain(
      `<definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">'Grupos'!$A$1:$J$17</definedName>`,
    );
    // Sem filtro pedido, a planilha sai como antes.
    const simples = textoDoZip(gerarXlsx([{ nome: "X", linhas: [["a"]] }]));
    expect(simples).not.toContain("autoFilter");
    expect(simples).not.toContain("definedNames");
  });

  it("o resumo calculado na tela é o que o Python grava (totais e resumo)", () => {
    const d = lerDesempateDaLista(DOURADO);
    const { totais, resumo: doPython } = DOURADO.relatorio;
    expect(resumoDoDesempate(d)).toEqual({ ...totais, ...doPython });
    // E o nome de cada lista: o do Python, igual ao que a tela calcula das modalidades.
    const nomes = Object.fromEntries(
      DOURADO.relatorio.modalidades.map((m) => [m.codigo, m.nome]),
    );
    for (const v of DOURADO.relatorio.vagas)
      for (const g of v.grupos)
        expect(nomeDaLista(g.lista, nomes)).toBe(g.listaNome);
  });

  it("o cabeçalho: edital, unidade, lista, fase, geração, id, quando, quem, regra e data de corte", () => {
    const d = lerDesempateDaLista(DOURADO);
    expect(linhasDoCabecalho(d)).toEqual([
      ["Edital", "nº 999/2026"],
      ["Unidade", "DSEI Fictício"],
      ["Lista", "Final"],
      ["Fase", "Resultado final do processo seletivo"],
      ["Geração", "2ª desta lista"],
      ["Identificador da lista", "lista-ficticia-final"],
      ["Lista gerada em", "23/10/2026 10:00"],
      ["Gerada por", "Maria Exemplo da Silva"],
      ["Versão da regra", "3"],
      ["Data de corte (idade e 60+)", "28/02/2025"],
      ["Relatório preparado em", "23/10/2026 10:00"],
    ]);
    expect(momentoBR("2026-10-24T02:30:00Z")).toBe("23/10/2026 23:30");
    expect(momentoBR("ontem")).toBe("");
  });

  it("o relatório da versão 1 continua abrindo e exportando", () => {
    expect(VERSOES_LIDAS).toEqual([1, 2]);
    const d = lerDesempateDaLista(DOURADO_V1);
    expect(d).not.toBeNull();
    expect(d.relatorio.versao).toBe(1);
    expect(d.relatorio.cabecalho).toBeNull();
    const cota = d.relatorio.vagas
      .flatMap((v) => v.grupos)
      .find((g) => g.lista !== "GERAL");
    expect(cota?.listaNome).toBe("Lista de cota: PPIQ");
    expect(cota?.cota).toBe(true);
    expect(linhasDoCabecalho(d).map(([k]) => k)).toEqual([
      "Lista",
      "Identificador da lista",
      "Data de corte (idade e 60+)",
      "Relatório preparado em",
    ]);
    const planilhas = planilhasDoDesempate(d);
    expect(planilhas[3].linhas[0]).not.toContain("Idade na data de corte");
    expect(planilhas[3].linhas.flat()).toContain(
      "1º mais velho do grupo, sem certidão",
    );
    expect(resumoDoDesempate(d)).toEqual({
      ...DOURADO_V1.relatorio.totais,
      ...DOURADO.relatorio.resumo,
    });
    const pagina = paginaDoDesempate(d, "Relatório de desempate");
    expect(pagina).toContain('href="#vaga-1"');
    expect(pagina).not.toContain('<th class="num">Idade</th>');
  });

  it("o valor de cada critério como texto, sem data de nascimento", () => {
    expect(textoDoValor(true, "IDOSO_60")).toBe("sim");
    expect(textoDoValor(true, "IDOSO_60", 61)).toBe("sim (61 anos)");
    expect(textoDoValor(false, "PCD", 40)).toBe("não");
    expect(
      textoDoValor(
        { idade: 44, ordemDeIdade: 1, certidao: true },
        "MAIOR_IDADE",
      ),
    ).toBe("44 anos, 1º mais velho do grupo");
    expect(
      textoDoValor(
        { idade: null, ordemDeIdade: null, certidao: false },
        "MAIOR_IDADE",
      ),
    ).toBe("sem data de nascimento, sem certidão");
    expect(textoDoValor(null, "EXP_SAUDE_INDIGENA")).toBe("sem dado");
    expect(textoDoValor(1500, "EXP_PROFISSIONAL_TEMPO")).toBe("1500 dias");
    expect(textoDoValor(2.5, "PONTUACAO_ETNICA")).toBe("2,50");
    expect(
      textoDoValor({ ordemDeIdade: 1, certidao: false }, "MAIOR_IDADE"),
    ).toBe("1º mais velho do grupo, sem certidão");
  });

  it("a página do PDF: cabeçalho, resumo, índice com links e o cabeçalho da vaga em cada tabela", () => {
    const d = lerDesempateDaLista(DOURADO);
    const html = paginaDoDesempate(d, "Relatório de desempate");
    expect(html).toContain(
      "<dt>Gerada por</dt><dd>Maria Exemplo da Silva</dd>",
    );
    expect(html).toContain("<dt>Edital</dt><dd>nº 999/2026</dd>");
    expect(html).toContain(
      '<td>60+</td><td class="num">3</td><td class="num">3</td>',
    );
    const vagas = d.relatorio.vagas.length;
    for (let i = 1; i <= vagas; i++) {
      expect(html).toContain(`href="#vaga-${i}"`);
      expect(html).toContain(`id="vaga-${i}"`);
    }
    // O cabeçalho da vaga fica no <thead>: o navegador o repete em cada página.
    expect(html.match(/<thead><tr><th class="vaga"/g)?.length).toBe(vagas);
    expect(html).toContain(
      '<span class="selo cota">Lista de cota: Pretos, pardos, indígenas e quilombolas (PPIQ)</span>',
    );
    expect(html).toContain('<th class="num">Idade</th>');
    expect(html).toContain("decidiu a hora da certidão");
    expect(html).toContain('content:"Página " counter(page)');
  });

  it("a página do PDF escapa os textos do relatório", () => {
    const quebrado = structuredClone(DOURADO);
    quebrado.relatorio.vagas[0].grupos[0].candidatos[0].nome = "<b>Ana</b>";
    quebrado.relatorio.cabecalho.lista.geradaPor = "<i>x</i>";
    const html = paginaDoDesempate(
      lerDesempateDaLista(quebrado),
      "Relatório de desempate",
    );
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).toContain("&lt;i&gt;x&lt;/i&gt;");
    expect(html).not.toContain("<b>Ana");
    expect(html).not.toContain("<i>x");
  });

  it("lê o preparo junto do relatório (migration 20261023170000)", () => {
    const pedido = "2026-10-23T14:00:00Z";
    const so = lerRespostaDoDesempate({
      lista_id: "l1",
      preparo: { situacao: "PEDIDO", pedido_em: pedido },
    });
    expect(so).toEqual({
      preparo: { situacao: "PEDIDO", pedidoEm: pedido },
      desempate: null,
    });
    const pronta = lerRespostaDoDesempate({
      ...DOURADO,
      preparo: { situacao: "PRONTO", pedido_em: pedido },
    });
    expect(pronta.preparo?.situacao).toBe("PRONTO");
    expect(pronta.desempate?.listaId).toBe("lista-ficticia-final");
    expect(lerRespostaDoDesempate(null)).toEqual({
      preparo: null,
      desempate: null,
    });
    expect(
      lerRespostaDoDesempate({ preparo: { situacao: "OUTRA" } }).preparo,
    ).toBeNull();
  });

  it("o estado do relatório: pronto, preparando (até a espera), não confere, falhou ou nada", () => {
    const agora = Date.parse("2026-10-23T14:05:00Z");
    const com = (situacao, pedidoEm = "2026-10-23T14:00:00Z") => ({
      preparo: { situacao, pedidoEm },
      desempate: null,
    });
    expect(estadoDoRelatorio(null, agora)).toBe("nada");
    expect(estadoDoRelatorio({ preparo: null, desempate: null }, agora)).toBe(
      "nada",
    );
    expect(
      estadoDoRelatorio(
        { ...com("PEDIDO"), desempate: lerDesempateDaLista(DOURADO) },
        agora,
      ),
    ).toBe("pronto");
    expect(estadoDoRelatorio(com("PEDIDO"), agora)).toBe("preparando");
    expect(estadoDoRelatorio(com("PREPARANDO"), agora)).toBe("preparando");
    const velho = new Date(agora - ESPERA_DO_RELATORIO_MS).toISOString();
    expect(estadoDoRelatorio(com("PEDIDO", velho), agora)).toBe("falhou");
    expect(estadoDoRelatorio(com("NAO_CONFERE"), agora)).toBe("nao_confere");
    expect(estadoDoRelatorio(com("FALHOU"), agora)).toBe("falhou");
    expect(estadoDoRelatorio(com("SEM_DISPARO"), agora)).toBe("falhou");
    expect(estadoDoRelatorio(com("DESLIGADA"), agora)).toBe("nada");
    // Relatório lido mas preparo sem relatório legível (versão nova): nada.
    expect(estadoDoRelatorio(com("PRONTO"), agora)).toBe("nada");
  });
});
