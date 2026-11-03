import {
  blocoDo,
  novaExperiencia,
  rascunhoInicial,
  rascunhoVazio,
} from "../src/lib/parecer-em-blocos.ts";
import { dadosFicticios } from "../src/modulos/recursos/parecer-em-blocos/dados-ficticios.ts";

/*
  Os casos do parecer em blocos, todos com nomes fictícios. O texto esperado
  de cada um está em parecer-em-blocos-esperado.js; o teste de paridade (só
  com SIMULADOR_DE_PARECERES) preenche o simulador da equipe com os mesmos.
*/

export function casoCompleto() {
  const r = rascunhoVazio();
  r.cabecalho = {
    processo: "25000.123456/2026-11",
    edital: "28/2026",
    unidade: "DSEI Yanomami",
    candidato: "Maria Fictícia da Silva",
    codigo: "990001",
    vaga: "Enfermeiro",
  };
  r.alegacoes =
    "a experiência na Unidade Básica de Saúde Fictícia não foi computada e a especialização foi desconsiderada";
  Object.assign(r.admissibilidade, {
    prazo_de: "2026-10-20",
    prazo_ate: "2026-10-21",
    envio_data: "2026-10-21",
    envio_hora: "18:40",
  });
  const formacao = blocoDo(r, "formacao");
  formacao.titulos = ["fac_sup_1", "fac_sup_2"];
  formacao.adicional =
    "O certificado de especialização foi aceito na fase recursal.";
  const exp = blocoDo(r, "experiencia");
  exp.itens = [
    novaExperiencia({
      atende: true,
      empresa: "Hospital Fictício",
      inicio: "2019-01-31",
      fim: "2020-02-29",
    }),
    novaExperiencia({
      atende: true,
      empresa: "UBS Fictícia",
      inicio: "2020-02-15",
      fim: "2021-03-14",
    }),
    novaExperiencia({
      atende: false,
      empresa: "Clínica Exemplo",
      inicio: "2022-01-01",
      fim: "2022-12-31",
      criterios: [
        "out_5",
        "cel_3",
        "out_2",
        "vol_2",
        "out_1",
        "out_3",
        "res_2",
      ],
      quadro_relacao: "Médio",
      quadro_nivel: "Técnico",
      empresa_nivel: "Clínica Exemplo",
      cargo_nivel: "cargo de recepcionista",
      nivel_exigido: "Superior",
      experiencias_anteriores: "2015 a 2016",
      documento_indigena: "atividades de extensão",
    }),
    novaExperiencia({
      atende: true,
      empresa: "",
      inicio: "2023-03-01",
      fim: "2023-06-30",
    }),
  ];
  exp.adicional = "Experiências somadas sem sobreposição.";
  Object.assign(blocoDo(r, "pcd"), {
    marcado: true,
    opcao: "em_desacordo",
    adicional: "Laudo sem CID.",
  });
  Object.assign(blocoDo(r, "indigena"), {
    sem_documento: true,
    no_recurso: true,
    no_recurso_acatada: false,
    no_recurso_pontos: "0",
    aldeia: true,
    documento_aldeia: 2,
    condisi: true,
    razao_condisi: "divergência de etnia",
    adicional: "Documentação conferida.",
  });
  Object.assign(blocoDo(r, "quilombola"), {
    marcado: true,
    documento: 1,
    adicional: "Sem certificado.",
  });
  Object.assign(blocoDo(r, "heteroidentificacao"), {
    marcado: true,
    parcial: true,
    autodeclaracao: false,
    foto: true,
    video: true,
    adicional: "Vídeo ausente.",
  });
  Object.assign(r.conclusao, {
    decisao: "DEFERIMENTO PARCIAL",
    retificar: true,
    nota_antiga: "12,4",
    nota_nova: "15,4",
  });
  r.assinaturas[0].nome = "Ana Fictícia Coordenadora";
  r.assinaturas[1].nome = "Beatriz Fictícia Gestora";
  return r;
}

const comFormacao = (nivel, titulos) => () => {
  const r = casoCompleto();
  Object.assign(blocoDo(r, "formacao"), { nivel, titulos });
  return r;
};

/** [nome, rascunho] de cada caso (o fictício do protótipo chega por promessa). */
export const CASOS = [
  ["em branco", () => rascunhoVazio()],
  ["completo", () => casoCompleto()],
  [
    "intempestivo",
    () => {
      const r = casoCompleto();
      r.admissibilidade.tempestivo = false;
      r.admissibilidade.envio_data = "2026-10-23";
      r.conclusao.decisao = "INDEFERIMENTO";
      return r;
    },
  ],
  [
    "requisitos não atendidos",
    () => {
      const r = casoCompleto();
      Object.assign(blocoDo(r, "requisitos"), {
        atendeu: false,
        identificacao: true,
        identificacao_desacordo: true,
        diploma: true,
        experiencia_minima: true,
        experiencia_documentacao: true,
        tempo_minimo: "6 (seis) meses",
      });
      r.conclusao = {
        decisao: "INDEFERIMENTO",
        retificar: false,
        nota_antiga: "",
        nota_nova: "",
      };
      r.admissibilidade.fundamentacao_adequada = false;
      r.admissibilidade.admitido = false;
      r.admissibilidade.atende_forma = false;
      return r;
    },
  ],
  [
    "requisitos não atendidos sem critério",
    () => {
      const r = rascunhoVazio();
      blocoDo(r, "requisitos").atendeu = false;
      return r;
    },
  ],
  [
    "formação invalidada e blocos excluídos",
    () => {
      const r = casoCompleto();
      Object.assign(blocoDo(r, "formacao"), {
        situacao: "invalidada",
        motivo: "nato_digital",
        adicional: "",
      });
      r.blocos = r.blocos.filter(
        (b) => !["pcd", "quilombola", "heteroidentificacao"].includes(b.codigo),
      );
      blocoDo(r, "experiencia").itens = [
        novaExperiencia({
          atende: true,
          empresa: "Empresa A",
          inicio: "2020-01-31",
          fim: "2020-03-30",
        }),
        novaExperiencia({
          atende: true,
          empresa: "Empresa B",
          inicio: "2020-03-31",
          fim: "2020-05-31",
        }),
      ];
      return r;
    },
  ],
  [
    "formação não apresentada e indígena pelo 6.5.1",
    () => {
      const r = casoCompleto();
      Object.assign(blocoDo(r, "formacao"), {
        situacao: "nao_apresentada",
        nivel: "tecnico",
      });
      Object.assign(blocoDo(r, "indigena"), {
        sem_documento: false,
        no_recurso: true,
        no_recurso_acatada: true,
        no_recurso_pontos: "8",
        aldeia: false,
        condisi: false,
        adicional: "",
      });
      Object.assign(blocoDo(r, "heteroidentificacao"), {
        autodeclaracao: false,
        foto: false,
        video: false,
      });
      return r;
    },
  ],
  [
    "formação no nível técnico",
    comFormacao("tecnico", ["fac_tec_1", "fac_tec_2"]),
  ],
  ["formação no nível médio", comFormacao("medio", ["fac_med_3"])],
  ["formação no nível fundamental", comFormacao("fundamental", ["fac_fun_1"])],
  [
    "sem experiência",
    () => {
      const r = casoCompleto();
      blocoDo(r, "experiencia").itens = [];
      return r;
    },
  ],
  [
    "caso fictício do protótipo",
    async () =>
      rascunhoInicial(await dadosFicticios.carregar("ficticio-1")).rascunho,
  ],
];
