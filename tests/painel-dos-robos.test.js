import { describe, expect, it } from "vitest";
import {
  acompanhamentoDoPedido,
  editaisDoPedido,
  normalizarPainel,
  normalizarVagas,
  opcoesDosEditais,
  previaDoDisparo,
} from "../src/lib/painel-dos-robos.js";
import {
  inputsDoPedido,
  MENSAGEM_DA_CHAVE,
  mensagemDoErroDoDisparo,
  OPCOES_DOS_ROBOS,
  roboDeCarga,
  separarCodigos,
  situacaoDoPedido,
  validarOpcoes,
} from "../src/lib/robos-de-carga.js";

/*
  "Rodar com opções" dos robôs, sem DOM: a lista branca e a validação
  (src/lib/robos-de-carga.js, a mesma de disparar_robo) e a escolha de editais, a
  prévia, o histórico e o acompanhamento (src/lib/painel-dos-robos.js).
*/

const EMPREGARE = roboDeCarga("empregare");
const PRE = roboDeCarga("pre_classificacao");
const CONFERENCIAS = roboDeCarga("conferencias");
const ID_93 = "11111111-1111-4111-a111-111111111193";
const ID_80 = "11111111-1111-4111-a111-111111111180";
const ID_93_SEDE = "11111111-1111-4111-a111-222222222293";

const PAINEL = normalizarPainel({
  gerado_em: "2026-10-07T12:00:00Z",
  areas: [
    { area: "projetos", nome: "Projetos" },
    { area: "saude-indigena", nome: "Saúde Indígena" },
    { area: "sede", nome: "SEDE" },
  ],
  editais: [
    {
      id: ID_93,
      numero: "93/2026",
      area: "projetos",
      unidade: "SESMT",
      ativo: true,
      status: "Em andamento",
    },
    {
      id: ID_80,
      numero: "80/2026",
      area: "saude-indigena",
      unidade: "DSEI Yanomami",
      ativo: true,
      status: "Concluído",
    },
    {
      id: ID_93_SEDE,
      numero: "93/2026",
      area: "sede",
      unidade: "Sede",
      ativo: false,
      status: "Em andamento",
    },
    { id: "sem-numero", numero: null, area: "sede" },
  ],
  empregare: [
    {
      id: "gh-2",
      inicio: "2026-10-07T11:00:00Z",
      fim: "2026-10-07T11:30:00Z",
      situacao: "PARCIAL",
      disparo: "MONITORA",
      quem: "Pessoa Admin",
      filtro: { editais: [], vagas: ["179698", "180231"], limite: 2 },
      forcada: true,
      vagas_pedidas: 2,
      vagas_baixadas: 1,
      vagas_falha: 1,
      linhas: 210,
      execucao: "https://github.com/x/actions/runs/2",
      por_vaga: [
        {
          vaga: "179698",
          situacao: "GRAVADA",
          arquivo: 210,
          ativos: 208,
          com_link: 200,
        },
      ],
    },
    {
      id: "gh-1",
      inicio: "2026-10-06T11:00:00Z",
      situacao: "CONCLUIDA",
      disparo: "GITHUB",
      filtro: { editais: ["93/2026"], vagas: [], limite: 10 },
      vagas_pedidas: 5,
      vagas_baixadas: 5,
      por_vaga: [],
    },
  ],
  pre_classificacao: [
    {
      id: "precl-2",
      inicio: "2026-10-07T10:00:00Z",
      situacao: "CONCLUIDA",
      disparo: "MONITORA",
      quem: "Coordenação",
      pedido: [ID_93],
      refazer: true,
      editais: 1,
      vagas: 5,
      inscritos: 800,
      lote: 40,
    },
    {
      id: "precl-1",
      inicio: "2026-10-07T09:00:00Z",
      situacao: "CONCLUIDA",
      disparo: "ROBO",
      pedido: [],
    },
  ],
});

describe("códigos de vaga colados", () => {
  it("separa por vírgula, ponto e vírgula, espaço e linha; sem repetir; o resto é inválido", () => {
    expect(
      separarCodigos("179698, 180231;180232\n179698  17797x\t999"),
    ).toEqual({
      codigos: ["179698", "180231", "180232", "999"],
      invalidos: ["17797x"],
    });
    expect(separarCodigos("")).toEqual({ codigos: [], invalidos: [] });
    expect(separarCodigos(["1", "2 3"]).codigos).toEqual(["1", "2", "3"]);
    expect(separarCodigos("123456789012345678901").invalidos).toHaveLength(1);
  });
});

describe("lista branca de cada robô (validarOpcoes)", () => {
  it("Empregare: modo, editais pelo número, vagas só dígitos e limite", () => {
    expect(
      validarOpcoes(EMPREGARE, {
        modo: "forcar",
        editais: ["93/2026", "93/2026", " 81/2026 "],
        vagas: "179698, 180231",
        limite: "5",
      }),
    ).toEqual({
      opcoes: {
        modo: "forcar",
        editais: ["93/2026", "81/2026"],
        vagas: ["179698", "180231"],
        limite: 5,
      },
    });
    expect(validarOpcoes(EMPREGARE, {})).toEqual({
      opcoes: { modo: "normal", editais: [], vagas: [], limite: null },
    });
  });

  it("recusa formato errado, modo de outro robô e opção que o robô não aceita", () => {
    expect(validarOpcoes(EMPREGARE, { vagas: ["17797x"] }).erro).toBe(
      "vaga_invalida",
    );
    expect(validarOpcoes(EMPREGARE, { editais: [ID_93] }).erro).toBe(
      "edital_invalido",
    );
    expect(validarOpcoes(EMPREGARE, { editais: ["93-2026"] }).texto).toMatch(
      /93\/2026/,
    );
    expect(validarOpcoes(EMPREGARE, { modo: "refazer_lote" }).erro).toBe(
      "modo_invalido",
    );
    expect(validarOpcoes(EMPREGARE, { limite: 0 }).erro).toBe(
      "limite_invalido",
    );
    expect(validarOpcoes(EMPREGARE, { limite: 501 }).erro).toBe(
      "limite_invalido",
    );
    expect(validarOpcoes(EMPREGARE, { limite: "1e2" }).erro).toBe(
      "limite_invalido",
    );
    expect(validarOpcoes(EMPREGARE, { ref: "outro-ramo" }).erro).toBe(
      "opcao_nao_aceita",
    );
    expect(validarOpcoes(EMPREGARE, { disparado_por: "x" }).erro).toBe(
      "opcao_nao_aceita",
    );
    expect(validarOpcoes(PRE, { vagas: ["179698"] }).erro).toBe(
      "opcao_nao_aceita",
    );
    expect(validarOpcoes(PRE, { limite: 5 }).erro).toBe("opcao_nao_aceita");
    expect(validarOpcoes(CONFERENCIAS, { editais: ["93/2026"] }).erro).toBe(
      "opcao_nao_aceita",
    );
    expect(validarOpcoes(roboDeCarga("selecao"), { modo: "seco" }).erro).toBe(
      "sem_opcoes",
    );
    expect(validarOpcoes(EMPREGARE, "modo=seco").erro).toBe("opcoes_invalidas");
    expect(validarOpcoes(EMPREGARE, ["seco"]).erro).toBe("opcoes_invalidas");
    const muitas = Array.from({ length: 501 }, (_, i) => String(100000 + i));
    expect(validarOpcoes(EMPREGARE, { vagas: muitas }).erro).toBe(
      "vagas_demais",
    );
    const editais = Array.from({ length: 101 }, (_, i) => `${i + 1}/2026`);
    expect(validarOpcoes(EMPREGARE, { editais }).erro).toBe("editais_demais");
  });

  it("chave vazia de opção que o robô não usa passa (o formulário manda só o que tem)", () => {
    expect(
      validarOpcoes(PRE, { modo: "seco", vagas: [], limite: "" }).opcoes,
    ).toEqual({
      modo: "seco",
      editais: [],
      vagas: [],
      limite: null,
    });
  });

  it("Pré-classificação: editais pelo número ou pelo id (minúsculo); modos do workflow", () => {
    expect(
      validarOpcoes(PRE, {
        modo: "refazer_lote",
        editais: [ID_93.toUpperCase(), "94/2026"],
      }).opcoes,
    ).toMatchObject({ modo: "refazer_lote", editais: [ID_93, "94/2026"] });
    expect(validarOpcoes(PRE, { modo: "forcar" }).erro).toBe("modo_invalido");
    expect(validarOpcoes(PRE, { editais: ["SESMT; drop"] }).erro).toBe(
      "edital_invalido",
    );
  });

  it("os modos são os options de cada workflow", async () => {
    const { readFileSync } = await import("node:fs");
    for (const [id, aceitas] of Object.entries(OPCOES_DOS_ROBOS)) {
      const yml = readFileSync(
        `.github/workflows/${roboDeCarga(id).workflow}`,
        "utf8",
      );
      const bloco = yml.slice(
        yml.indexOf("modo:"),
        yml.indexOf("default:", yml.indexOf("modo:")),
      );
      const opcoes = [...bloco.matchAll(/^\s+- (\w+)$/gm)].map((m) => m[1]);
      expect(
        aceitas.modos.map((m) => m.valor),
        id,
      ).toEqual(opcoes);
      if (aceitas.editais) expect(yml, id).toMatch(/^\s+editais:$/m);
      if (aceitas.vagas) expect(yml, id).toMatch(/^\s+vagas:$/m);
      if (aceitas.limite) expect(yml, id).toMatch(/^\s+limite:$/m);
    }
  });
});

describe("o pedido ao banco (disparar_robo)", () => {
  it("p_inputs: as opções conferidas; no Recalcular, só o edital; sem nada, {}", () => {
    expect(inputsDoPedido()).toEqual({});
    expect(
      inputsDoPedido({
        opcoes: {
          modo: "seco",
          editais: ["93/2026", "81/2026"],
          vagas: ["179698"],
          limite: 5,
        },
      }),
    ).toEqual({
      modo: "seco",
      editais: ["93/2026", "81/2026"],
      vagas: ["179698"],
      limite: "5",
    });
    expect(
      inputsDoPedido({
        opcoes: { modo: "seco", editais: [], vagas: [], limite: null },
      }),
    ).toEqual({ modo: "seco" });
    expect(inputsDoPedido({ edital: ID_93 })).toEqual({ editais: [ID_93] });
    expect(inputsDoPedido({ edital: "  " })).toEqual({});
  });

  it("o erro do banco vira frase curta; sem a função, diz a migration", () => {
    expect(
      mensagemDoErroDoDisparo({
        code: "42501",
        message: "Só o administrador global roda as cargas.",
      }),
    ).toBe("Só o administrador global roda as cargas.");
    expect(mensagemDoErroDoDisparo({ code: "PGRST202" })).toContain(
      "20261008140000",
    );
    expect(mensagemDoErroDoDisparo({}, "Padrão.")).toBe("Padrão.");
  });

  it("situação do pedido: PEDIDO espera; ACEITO segue; FALHOU e SEM_TOKEN avisam", () => {
    expect(situacaoDoPedido({ situacao: "PEDIDO" })).toMatchObject({
      terminou: false,
      aceito: false,
      aviso: null,
    });
    expect(situacaoDoPedido({ situacao: "ACEITO", http: 204 })).toMatchObject({
      terminou: true,
      aceito: true,
      http: 204,
      aviso: null,
    });
    expect(situacaoDoPedido({ situacao: "SEM_TOKEN" }).aviso).toEqual({
      tom: "erro",
      texto: MENSAGEM_DA_CHAVE,
    });
    expect(MENSAGEM_DA_CHAVE).toBe(
      "A chave de disparo dos robôs expirou ou foi recusada; um administrador precisa trocá-la no cofre (Vault) com o nome github_disparo_robos.",
    );
  });
});

describe("editais da escolha", () => {
  it("normaliza: sem número fica fora; vigente pela regra da Avaliação documental", () => {
    expect(PAINEL.editais.map((e) => [e.id, e.vigente])).toEqual([
      [ID_93, true],
      [ID_80, false],
      [ID_93_SEDE, false],
    ]);
  });

  it("só os vigentes da área; mostrar todos traz os outros; o escolhido fica", () => {
    expect(opcoesDosEditais(PAINEL.editais, PAINEL.areas)).toEqual({
      opcoes: [{ value: ID_93, label: "93/2026 · SESMT (Projetos)" }],
      ocultos: 2,
    });
    expect(
      opcoesDosEditais(PAINEL.editais, PAINEL.areas, { todos: true }).opcoes,
    ).toHaveLength(3);
    expect(
      opcoesDosEditais(PAINEL.editais, PAINEL.areas, {
        area: "saude-indigena",
        escolhidos: [ID_80],
      }),
    ).toEqual({
      opcoes: [
        { value: ID_80, label: "80/2026 · DSEI Yanomami (Saúde Indígena)" },
      ],
      ocultos: 0,
    });
    expect(
      opcoesDosEditais(PAINEL.editais, PAINEL.areas, { area: "sede" }),
    ).toEqual({ opcoes: [], ocultos: 1 });
  });

  it("no pedido: o número para o robô da Empregare (sem repetir), o id para a pré-classificação", () => {
    expect(
      editaisDoPedido("empregare", [ID_93, ID_93_SEDE], PAINEL.editais),
    ).toEqual(["93/2026"]);
    expect(
      editaisDoPedido("pre_classificacao", [ID_93, ID_93_SEDE], PAINEL.editais),
    ).toEqual([ID_93, ID_93_SEDE]);
    expect(editaisDoPedido("conferencias", [ID_93], PAINEL.editais)).toEqual(
      [],
    );
    expect(editaisDoPedido("empregare", ["sumiu"], PAINEL.editais)).toEqual([]);
  });
});

describe("prévia do que vai rodar", () => {
  const VAGAS = normalizarVagas([
    { vaga: "179698", edital_id: ID_93, cargo: "Técnico" },
    { vaga: "180231", edital_id: ID_93, cargo: "Engenheiro" },
    { vaga: "180232", edital_id: ID_93 },
    { vaga: "180233", edital_id: ID_93 },
    { vaga: "180234", edital_id: ID_93 },
    { vaga: "x1", edital_id: ID_93 },
  ]);
  const base = { robo: "empregare", editais: PAINEL.editais, vagas: VAGAS };

  it("vagas conhecidas do edital: '5 vagas do 93/2026: …'", () => {
    expect(VAGAS).toHaveLength(5);
    expect(previaDoDisparo({ ...base, editaisIds: [ID_93] })).toEqual({
      frase: "5 vagas do 93/2026: 179698, 180231, 180232, 180233, 180234",
      codigos: ["179698", "180231", "180232", "180233", "180234"],
      avisos: [],
    });
  });

  it("o limite corta e avisa; forçar avisa; seco diz que só lista", () => {
    const p = previaDoDisparo({
      ...base,
      editaisIds: [ID_93],
      limite: 2,
      modo: "forcar",
    });
    expect(p.frase).toBe(
      "2 de 5 vagas do 93/2026: 179698, 180231, 180232, 180233, 180234",
    );
    expect(p.avisos).toEqual([
      "O limite corta em 2: ficam as nunca carregadas ou carregadas há mais tempo.",
      "Forçar: a trava da metade não vale.",
    ]);
    expect(
      previaDoDisparo({ ...base, codigos: ["179698"], modo: "seco" }).frase,
    ).toBe("Lista, sem baixar, 1 vaga do 93/2026: 179698");
  });

  it("com códigos valem os códigos; avisa só se algum não é dos editais escolhidos", () => {
    expect(
      previaDoDisparo({ ...base, editaisIds: [ID_93], codigos: ["180231"] })
        .avisos,
    ).toEqual([]);
    const fora = previaDoDisparo({
      ...base,
      editaisIds: [ID_93],
      codigos: ["180231", "999999"],
    });
    expect(fora.frase).toBe("2 vagas do 93/2026: 180231, 999999");
    expect(fora.avisos).toEqual([
      "Com códigos de vaga, o robô roda só os códigos.",
    ]);
    const muitos = Array.from({ length: 10 }, (_, i) => String(200000 + i));
    expect(previaDoDisparo({ ...base, codigos: muitos }).frase).toBe(
      "10 vagas: 200000, 200001, 200002, 200003, 200004, 200005, 200006, 200007…",
    );
  });

  it("sem filtro, os editais em curso até o limite; edital sem vaga conhecida avisa; fumaça só testa o login", () => {
    expect(previaDoDisparo({ ...base }).frase).toBe(
      "As vagas dos editais em curso, até 60 (as nunca carregadas primeiro).",
    );
    expect(previaDoDisparo({ ...base, editaisIds: [ID_80] })).toMatchObject({
      frase: "Nenhuma vaga da Empregare conhecida do 80/2026.",
      codigos: [],
    });
    expect(
      previaDoDisparo({ ...base, editaisIds: [ID_93], modo: "fumaca" }).frase,
    ).toBe("Só o teste de login na Empregare.");
  });

  it("pré-classificação e conferências", () => {
    const p = { editais: PAINEL.editais };
    expect(
      previaDoDisparo({ ...p, robo: "pre_classificacao", editaisIds: [ID_93] })
        .frase,
    ).toBe("Pré-classifica 1 edital: 93/2026.");
    expect(
      previaDoDisparo({ ...p, robo: "pre_classificacao", modo: "seco" }).frase,
    ).toBe("Calcula sem gravar os editais ativos com vagas da Empregare.");
    expect(
      previaDoDisparo({
        ...p,
        robo: "pre_classificacao",
        modo: "refazer_lote",
        editaisIds: [ID_93],
      }).frase,
    ).toBe("Refaz o lote de 1 edital: 93/2026.");
    expect(previaDoDisparo({ robo: "conferencias", modo: "seco" }).frase).toBe(
      "Todas as conferências, sem gravar avisos.",
    );
  });
});

describe("histórico dos robôs", () => {
  it("robô: parâmetros, quem pediu, resultado e vaga pedida sem arquivo", () => {
    const [ultima, anterior] = PAINEL.execucoes.empregare;
    expect(ultima).toMatchObject({
      quem: "Pessoa Admin",
      situacao: "PARCIAL",
      parametros: { texto: "2 vagas: 179698, 180231 · limite 2 · forçar" },
      resultado: "1 de 2 vagas baixadas · 1 falha · 210 candidatos",
      execucao: "https://github.com/x/actions/runs/2",
    });
    expect(ultima.porVaga.map((v) => [v.vaga, v.situacao, v.comLink])).toEqual([
      ["179698", "GRAVADA", 200],
      ["180231", "SEM_ARQUIVO", null],
    ]);
    expect(anterior).toMatchObject({
      quem: "GitHub",
      parametros: { texto: "Edital 93/2026 · limite 10" },
    });
  });

  it("pré-classificação: o id pedido vira o número; disparo do robô diz de onde vieram os editais", () => {
    const [monitora, robo] = PAINEL.execucoes.pre_classificacao;
    expect(monitora.parametros.texto).toBe("Edital 93/2026 · refazer lote");
    expect(monitora.resultado).toBe(
      "1 edital · 5 vagas · 800 inscritos · lote 40",
    );
    expect(robo.quem).toBe("Depois do robô");
    expect(robo.parametros.texto).toBe("Editais da última carga do robô");
  });

  it("aguenta payload vazio ou de outra RPC", () => {
    expect(normalizarPainel(null)).toMatchObject({
      areas: [],
      editais: [],
      execucoes: { empregare: [], pre_classificacao: [] },
    });
    expect(normalizarPainel({ empregare: "x" }).execucoes.empregare).toEqual(
      [],
    );
  });
});

describe("acompanhamento do pedido", () => {
  const em = new Date("2026-10-07T12:00:00Z");
  const execucoes = (situacao, inicio = "2026-10-07T12:01:00Z") =>
    normalizarPainel({
      empregare: [
        { id: "n", inicio, situacao, disparo: "MONITORA", filtro: {} },
      ],
    }).execucoes.empregare;
  const pedido = (situacao, extra = {}) => ({
    em,
    disparo: situacaoDoPedido({ situacao, ...extra }),
  });

  it("aguardando → aceito pelo GitHub → rodando → terminou", () => {
    expect(
      acompanhamentoDoPedido({ robo: "empregare", pedido: null }),
    ).toBeNull();
    expect(
      acompanhamentoDoPedido({ robo: "empregare", pedido: pedido("PEDIDO") })
        .etapa,
    ).toBe("aguardando");
    // A execução de antes do pedido não conta.
    expect(
      acompanhamentoDoPedido({
        robo: "empregare",
        pedido: pedido("PEDIDO"),
        execucoes: execucoes("CONCLUIDA", "2026-10-07T10:00:00Z"),
      }).etapa,
    ).toBe("aguardando");
    expect(
      acompanhamentoDoPedido({
        robo: "empregare",
        pedido: pedido("ACEITO", { http: 204 }),
      }),
    ).toEqual({
      etapa: "github",
      execucao: null,
      url: null,
      semRegistro: false,
    });
    const rodando = acompanhamentoDoPedido({
      robo: "empregare",
      pedido: pedido("ACEITO"),
      execucoes: execucoes("EM_ANDAMENTO"),
    });
    expect(rodando.etapa).toBe("rodando");
    expect(
      acompanhamentoDoPedido({
        robo: "empregare",
        pedido: pedido("ACEITO"),
        execucoes: execucoes("PARCIAL"),
      }).etapa,
    ).toBe("terminou");
  });

  it("modo seco: aceito pelo GitHub e sem registro no banco", () => {
    expect(
      acompanhamentoDoPedido({
        robo: "empregare",
        pedido: { ...pedido("ACEITO"), modo: "seco" },
      }),
    ).toMatchObject({ etapa: "github", semRegistro: true });
  });

  it("chave ausente, vencida ou sem permissão: recusado, com a frase do cofre", () => {
    for (const disparo of [
      { situacao: "SEM_TOKEN" },
      {
        situacao: "FALHOU",
        http: 401,
        mensagem: "GitHub 401: Bad credentials",
      },
      { situacao: "FALHOU", http: 403 },
      { situacao: "FALHOU", http: 404 },
    ])
      expect(
        acompanhamentoDoPedido({
          robo: "empregare",
          pedido: pedido(disparo.situacao, disparo),
        }),
      ).toMatchObject({ etapa: "recusado", texto: MENSAGEM_DA_CHAVE });
    expect(
      acompanhamentoDoPedido({
        robo: "empregare",
        pedido: pedido("FALHOU", {
          http: 422,
          mensagem: "GitHub 422: Unexpected inputs provided",
        }),
      }).texto,
    ).toBe(
      "O GitHub não aceitou o pedido (GitHub 422: Unexpected inputs provided). Tente de novo em instantes.",
    );
  });
});
