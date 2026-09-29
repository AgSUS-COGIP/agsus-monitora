import { describe, expect, it } from "vitest";
import {
  calcularIndicadores,
  compararEditais,
  csvDosRecursos,
  dadosParaSalvar,
  diasEntre,
  enriquecerRecursos,
  errosDoRascunho,
  esteiraDosRecursos,
  filtrarRecursos,
  FILTROS_VAZIOS,
  impactoNoResultado,
  notaMudou,
  opcoesDosFiltros,
  pendenciasPrioritarias,
  RASCUNHO_VAZIO,
  recursoDuplicado,
  recursosPorAnalista,
  recursosPorSituacao,
} from "../src/lib/recursos-dos-candidatos.js";

/*
  A aba Recursos sem DOM: o que se calcula de cada recurso, os indicadores e
  as pendências do painel antigo (Apps Script), agora com prazo e "a nota
  mudou" calculados.
*/

const HOJE = "2026-05-20";
const CRONOGRAMAS = [
  {
    edital_id: "e1",
    ordem: 1,
    atividade: "Prazo de recurso do resultado preliminar documental",
    inicio: "2026-05-05",
    fim: "2026-05-06",
  },
  {
    edital_id: "e1",
    ordem: 2,
    atividade: "Resultado Preliminar das Entrevistas",
    inicio: "2026-05-15",
    fim: "2026-05-15",
  },
  {
    edital_id: "e1",
    ordem: 3,
    atividade: "Prazo para recursos das entrevistas",
    inicio: "2026-05-21",
    fim: "2026-05-22",
  },
];

const recurso = (extra = {}) => {
  const n = extra.nu;
  return {
    id: `r${n}`,
    nu: n,
    edital_id: "e1",
    edital: "105/2026",
    unidade: "DSEI Litoral Sul",
    origem: "analise-curricular",
    analise_id: `a${n}`,
    fora_analise: false,
    candidato: `Candidato ${n}`,
    codigo: `C${n}`,
    cargo: "Enfermeiro",
    vaga: "V1",
    nota_anterior: 10,
    nota_atual: 10,
    analista: "Ana",
    situacao: "EM_ANALISE",
    processo_sei: null,
    mudou_classificacao: false,
    download_empregare_em: null,
    processo_sei_em: null,
    upload_sei_em: null,
    resposta_candidato_em: null,
    decisao_em: null,
    criado_em: "2026-05-10T12:00:00Z",
    revisao: 1,
    ...extra,
  };
};

const RECURSOS = () => [
  // Em análise, sem SEI, prazo da análise curricular vencido (06/05).
  recurso({ nu: 1 }),
  // Decidido sem resposta, nota mudou.
  recurso({
    nu: 2,
    situacao: "DEFERIDO",
    decisao_em: "2026-05-15T12:00:00Z",
    nota_atual: 12.5,
    processo_sei_em: "2026-05-11T00:00:00Z",
  }),
  // Entrevista, prazo ainda por vir (22/05), processo SEI sem upload.
  recurso({
    nu: 3,
    origem: "entrevista",
    processo_sei_em: "2026-05-11T00:00:00Z",
    analista: "",
  }),
  // Tudo feito.
  recurso({
    nu: 4,
    situacao: "INDEFERIDO",
    decisao_em: "2026-05-12T12:00:00Z",
    download_empregare_em: "2026-05-10T13:00:00Z",
    processo_sei_em: "2026-05-10T13:00:00Z",
    upload_sei_em: "2026-05-10T14:00:00Z",
    resposta_candidato_em: "2026-05-12T15:00:00Z",
    mudou_classificacao: true,
  }),
  // Fora das análises, resultado final (sem prazo no cronograma).
  recurso({
    nu: 5,
    origem: "resultado-final",
    fora_analise: true,
    analise_id: null,
    nota_anterior: null,
    nota_atual: null,
    candidato: "José da Silva",
  }),
];

const enriquecidos = () =>
  enriquecerRecursos({ recursos: RECURSOS(), cronogramas: CRONOGRAMAS }, HOJE);

describe("o que se calcula de cada recurso", () => {
  it("a nota mudou quando a atual difere da do cadastro; sem nota, não", () => {
    expect(notaMudou({ nota_anterior: 10, nota_atual: 10 })).toBe(false);
    expect(notaMudou({ nota_anterior: 10, nota_atual: "12.5" })).toBe(true);
    expect(notaMudou({ nota_anterior: null, nota_atual: 3 })).toBe(false);
    expect(notaMudou({ nota_anterior: 0, nota_atual: 0 })).toBe(false);
  });

  it("prazo, atraso e dias em aberto", () => {
    const [r1, r2, r3, r4, r5] = enriquecidos();
    expect(r1.prazo).toMatchObject({ data: "2026-05-06", fonte: "abertura" });
    expect(r1.atrasado).toBe(true);
    expect(r1.diasParaPrazo).toBe(-14);
    expect(r1.diasEmAberto).toBe(10);
    // Decidido: os dias em aberto param na decisão.
    expect(r2.diasEmAberto).toBe(5);
    expect(r3.prazo.data).toBe("2026-05-22");
    expect(r3.atrasado).toBe(false);
    // Respondido não fica atrasado, mesmo com o prazo passado.
    expect(r4.atrasado).toBe(false);
    expect(r4.etapasFeitas).toBe(4);
    expect(r5.prazo.data).toBeNull();
  });

  it("dias entre datas atravessam o mês", () => {
    expect(diasEntre("2026-01-30", "2026-02-02")).toBe(3);
    expect(diasEntre(null, "2026-02-02")).toBeNull();
  });
});

describe("indicadores e pendências", () => {
  it("indicadores do painel antigo, com prazo vencido e taxa de conclusão", () => {
    expect(calcularIndicadores(enriquecidos())).toEqual({
      total: 5,
      pendentes: 3,
      concluidos: 2,
      semSei: 2,
      semResposta: 4,
      mudouResultado: 2,
      atrasados: 2,
      taxaConclusao: 40,
    });
    expect(calcularIndicadores([]).taxaConclusao).toBe(0);
  });

  it("pendências com ocorrência, na ordem de prioridade", () => {
    const pendencias = pendenciasPrioritarias(enriquecidos());
    expect(pendencias.map((p) => [p.chave, p.valor])).toEqual([
      ["prazo_vencido", 2],
      ["sem_analista", 1],
      ["sem_sei", 2],
      ["sem_upload_sei", 2],
      ["sem_resposta", 1],
      ["mudou_resultado", 2],
      ["sem_prazo", 1],
      ["fora_analise", 1],
    ]);
    expect(pendenciasPrioritarias([])).toEqual([]);
  });
});

describe("filtros", () => {
  it("por origem, analista (inclusive sem analista), situação, pendência e busca sem acento", () => {
    const todos = enriquecidos();
    const nus = (filtros) =>
      filtrarRecursos(todos, { ...FILTROS_VAZIOS, ...filtros }).map(
        (r) => r.nu,
      );
    expect(nus({ origem: "entrevista" })).toEqual([3]);
    expect(nus({ analista: "Sem analista" })).toEqual([3]);
    expect(nus({ situacao: "EM_ANALISE" })).toEqual([1, 3, 5]);
    expect(nus({ pendencia: "prazo_vencido" })).toEqual([1, 2]);
    expect(nus({ busca: "jose" })).toEqual([5]);
    expect(nus({ busca: "C3" })).toEqual([3]);
    expect(nus({})).toEqual([1, 2, 3, 4, 5]);
  });

  it("opções: editais do mais novo, origens ativas ou em uso, analistas ordenados", () => {
    const opcoes = opcoesDosFiltros(enriquecidos());
    expect(opcoes.origens.map((o) => o.valor)).toEqual([
      "analise-curricular",
      "entrevista",
      "resultado-final",
    ]);
    expect(opcoes.analistas.map((a) => a.valor)).toEqual([
      "Ana",
      "Sem analista",
    ]);
    expect(["30/2026", "105/2026", "07/2025"].sort(compararEditais)).toEqual([
      "105/2026",
      "30/2026",
      "07/2025",
    ]);
  });
});

describe("gráficos", () => {
  it("por analista, situação, impacto e esteira", () => {
    const todos = enriquecidos();
    expect(recursosPorAnalista(todos)).toEqual([
      { rotulo: "Ana", total: 4, pendentes: 2, concluidos: 2 },
      { rotulo: "Sem analista", total: 1, pendentes: 1, concluidos: 0 },
    ]);
    expect(recursosPorSituacao(todos).map((s) => s.valor)).toEqual([
      3, 1, 1, 0,
    ]);
    expect(impactoNoResultado(todos).map((i) => i.valor)).toEqual([1, 1, 3]);
    expect(esteiraDosRecursos(todos).map((e) => e.valor)).toEqual([
      5, 1, 3, 1, 1,
    ]);
  });
});

describe("duplicado e formulário", () => {
  it("acha outro em análise do mesmo candidato, edital e origem", () => {
    const todos = enriquecidos();
    expect(
      recursoDuplicado(todos, {
        editalId: "e1",
        origem: "analise-curricular",
        analiseId: "a1",
      })?.nu,
    ).toBe(1);
    // Outra origem ou já decidido: não é duplicado.
    expect(
      recursoDuplicado(todos, {
        editalId: "e1",
        origem: "entrevista",
        analiseId: "a1",
      }),
    ).toBeNull();
    expect(
      recursoDuplicado(todos, {
        editalId: "e1",
        origem: "analise-curricular",
        analiseId: "a2",
      }),
    ).toBeNull();
    // Fora das análises: pelo nome, sem acento.
    expect(
      recursoDuplicado(todos, {
        editalId: "e1",
        origem: "resultado-final",
        nomeInformado: " jose da  silva",
      })?.nu,
    ).toBe(5);
  });

  it("valida o rascunho e monta o p_dados do banco", () => {
    expect(errosDoRascunho(RASCUNHO_VAZIO)).toEqual({
      edital_id: "Escolha o edital.",
      origem: "Escolha a origem do recurso.",
      candidato: "Escolha o candidato na lista das análises.",
    });
    const fora = {
      ...RASCUNHO_VAZIO,
      edital_id: "e1",
      origem: "entrevista",
      fora_analise: true,
      nome_informado: "Jo",
    };
    expect(Object.keys(errosDoRascunho(fora))).toEqual(["nome_informado"]);
    const rascunho = {
      ...RASCUNHO_VAZIO,
      edital_id: "e1",
      origem: "entrevista",
      analise: { id: "a9" },
      analista: " Bia ",
      processo_sei: " 1 ",
    };
    expect(errosDoRascunho(rascunho)).toEqual({});
    expect(dadosParaSalvar(rascunho)).toEqual({
      edital_id: "e1",
      fora_analise: false,
      analise_id: "a9",
      permitir_duplicado: false,
      origem: "entrevista",
      analista: "Bia",
      situacao: "EM_ANALISE",
      processo_sei: "1",
      mudou_classificacao: false,
      observacao: "",
    });
    expect(dadosParaSalvar(rascunho, { id: "r1", revisao: 3 })).toMatchObject({
      id: "r1",
      revisao: 3,
      origem: "entrevista",
    });
    expect(dadosParaSalvar(rascunho, { id: "r1" })).not.toHaveProperty(
      "edital_id",
    );
  });
});

describe("CSV", () => {
  it("cabeçalho, ; e BOM, com célula protegida contra fórmula", () => {
    const [r1] = enriquecidos();
    const csv = csvDosRecursos([
      { ...r1, candidato: "=HYPERLINK(1)", analista: "Ana; Bia" },
    ]);
    expect(csv.startsWith("\uFEFFNº;Edital;Unidade;Origem;")).toBe(true);
    expect(csv).toContain(";'=HYPERLINK(1);");
    expect(csv).toContain(';"Ana; Bia";');
    expect(csv).toContain(";06/05/2026;Sim;10;10/05/2026");
  });
});
