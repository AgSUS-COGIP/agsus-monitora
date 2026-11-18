/* Parecer em blocos: catálogos dos blocos (os do simulador) (API pública em ../parecer-em-blocos.ts). */

import type { ReferenciasDoEdital } from "./etapas-e-referencias.ts";

// ── Catálogos dos blocos (os do simulador) ───────────────────────────────

export type NivelDaVaga = "superior" | "tecnico" | "medio" | "fundamental";

export const NIVEIS_DA_VAGA: readonly (readonly [NivelDaVaga, string])[] =
  Object.freeze([
    ["superior", "Nível Superior"],
    ["tecnico", "Nível Técnico"],
    ["medio", "Nível Médio"],
    ["fundamental", "Nível Fundamental"],
  ]);

export interface TituloDaFormacao {
  id: string;
  pontos: number;
  descricao: string;
  /** Os títulos da ficha (TituloAcademico) que contam como este. */
  daFicha: readonly string[];
}

/** facDatabase do simulador (pontos cumulativos), com a ligação aos títulos da ficha. */
export const TITULOS_POR_NIVEL: Readonly<
  Record<NivelDaVaga, readonly TituloDaFormacao[]>
> = Object.freeze({
  superior: [
    {
      id: "fac_sup_1",
      pontos: 1.0,
      descricao: "Especialização na área à qual concorre",
      daFicha: ["ESPECIALIZACAO"],
    },
    {
      id: "fac_sup_2",
      pontos: 2.0,
      descricao: "Mestrado/Residência em Saúde",
      daFicha: ["MESTRADO", "RESIDENCIA"],
    },
    {
      id: "fac_sup_3",
      pontos: 3.0,
      descricao: "Doutorado na área à qual concorre",
      daFicha: ["DOUTORADO"],
    },
  ],
  tecnico: [
    {
      id: "fac_tec_1",
      pontos: 2.0,
      descricao: "Especialização Técnica na área à qual concorre",
      daFicha: ["TECNICO"],
    },
    {
      id: "fac_tec_2",
      pontos: 4.0,
      descricao:
        "Formação Acadêmica (graduação/pós-graduação) na área à qual concorre",
      daFicha: [
        "GRADUACAO",
        "ESPECIALIZACAO",
        "RESIDENCIA",
        "MESTRADO",
        "DOUTORADO",
      ],
    },
  ],
  medio: [
    {
      id: "fac_med_1",
      pontos: 1.0,
      descricao: "Formação técnica na área à qual concorre",
      daFicha: ["TECNICO"],
    },
    {
      id: "fac_med_2",
      pontos: 2.0,
      descricao: "Graduação na área a qual concorre",
      daFicha: ["GRADUACAO"],
    },
    {
      id: "fac_med_3",
      pontos: 3.0,
      descricao: "Pós-graduação na área a qual concorre",
      daFicha: ["ESPECIALIZACAO", "RESIDENCIA", "MESTRADO", "DOUTORADO"],
    },
  ],
  fundamental: [
    {
      id: "fac_fun_1",
      pontos: 6.0,
      descricao:
        "Formação Acadêmica (Ensino médio completo/Graduação/Pós-Graduação)",
      daFicha: [
        "ENSINO_MEDIO",
        "GRADUACAO",
        "ESPECIALIZACAO",
        "RESIDENCIA",
        "MESTRADO",
        "DOUTORADO",
      ],
    },
  ],
});

export type MotivoDaFormacao =
  "frente_verso" | "nato_digital" | "provavel_formando" | "nivel" | "area";

/** Motivos da formação invalidada: [código, rótulo curto do simulador]. */
export const MOTIVOS_DA_FORMACAO: readonly (readonly [
  MotivoDaFormacao,
  string,
])[] = Object.freeze([
  [
    "frente_verso",
    "não ter apresentado documentação em frente e verso, mesmo que o verso esteja em branco",
  ],
  [
    "nato_digital",
    "não ter apresentado documentos nato-digitais/eletrônicos anexados com autenticação/QR Code",
  ],
  [
    "provavel_formando",
    "ter apresentado declaração de provável formando, o que não é aceito",
  ],
  [
    "nivel",
    "documentação apresentada não ser compatível com o nível da vaga pleiteada",
  ],
  [
    "area",
    "documentação apresentada não ser compatível com a área de atuação da vaga pleiteada",
  ],
]);

export interface CriterioDaExperiencia {
  codigo: string;
  /** O rótulo da caixa no simulador. */
  rotulo: string;
}

/** Os critérios de indeferimento da experiência, nos grupos do simulador. */
export const CRITERIOS_DA_EXPERIENCIA: readonly {
  grupo: string;
  criterios: readonly CriterioDaExperiencia[];
}[] = Object.freeze([
  {
    grupo: "Empregado celetista",
    criterios: [
      {
        codigo: "cel_1",
        rotulo:
          "CTPS física: não apresenta todos os dados de identificação do candidato",
      },
      {
        codigo: "cel_2",
        rotulo:
          "CTPS física: não contempla as folhas de identificação (foto e dados civis)",
      },
      {
        codigo: "cel_3",
        rotulo:
          "CTPS física/digital: não permite aferir as datas de admissão e saída",
      },
      {
        codigo: "cel_4",
        rotulo:
          "CTPS física/digital: não contempla de forma expressa o cargo ou função",
      },
    ],
  },
  {
    grupo: "Servidor ou empregado de órgão público",
    criterios: [
      { codigo: "pub_1", rotulo: "Declaração não está em papel timbrado" },
      {
        codigo: "pub_2",
        rotulo:
          "Declaração sem identificação do emissor ou assinatura verificável",
      },
      {
        codigo: "pub_3",
        rotulo: "CTPS ou declaração sem identificação do cargo exercido",
      },
      {
        codigo: "pub_4",
        rotulo:
          "CTPS ou declaração não permite aferir as datas de admissão e saída",
      },
      {
        codigo: "pub_5",
        rotulo:
          "CTPS ou declaração não contempla de forma expressa o cargo ou função",
      },
    ],
  },
  {
    grupo: "Prestador de serviços (PJ ou contratado)",
    criterios: [
      {
        codigo: "pj_1",
        rotulo: "Não apresentou a cópia do contrato de prestação de serviços",
      },
      {
        codigo: "pj_2",
        rotulo:
          "Sem declaração da contratante com o tempo de execução e a vigência",
      },
      {
        codigo: "pj_3",
        rotulo: "Sem declaração da contratante com a categoria profissional",
      },
      {
        codigo: "pj_4",
        rotulo:
          "Declaração da contratante sem identificação/assinatura do responsável",
      },
    ],
  },
  {
    grupo: "Profissional autônomo",
    criterios: [
      {
        codigo: "aut_1",
        rotulo: "Não apresentou a CAT ou CAT com Registro de Atestado",
      },
      {
        codigo: "aut_2",
        rotulo:
          "Sem contrato, ou declaração do tomador sem o período de atuação",
      },
      {
        codigo: "aut_3",
        rotulo: "Sem declaração do tomador especificando o período de atuação",
      },
      {
        codigo: "aut_4",
        rotulo:
          "Sem certidão da Prefeitura com o tempo de cadastro como autônomo",
      },
    ],
  },
  {
    grupo: "Residência em saúde",
    criterios: [
      {
        codigo: "res_1",
        rotulo: "Documento sem as datas de início e término da Residência",
      },
      {
        codigo: "res_2",
        rotulo:
          "Documento acadêmico sem frente e verso: Residência não considerada",
      },
    ],
  },
  {
    grupo: "Atuação voluntária em emergências de saúde indígena",
    criterios: [
      {
        codigo: "vol_1",
        rotulo: "Declaração ou certificado não emitido pelos órgãos do edital",
      },
      {
        codigo: "vol_2",
        rotulo: "Não detalha o período de atuação (início e término)",
      },
      { codigo: "vol_3", rotulo: "Não detalha a função desempenhada" },
      {
        codigo: "vol_4",
        rotulo: "Não indica a emergência sanitária/ações contempladas",
      },
    ],
  },
  {
    grupo: "Outros",
    criterios: [
      {
        codigo: "out_1",
        rotulo:
          "A experiência não guarda relação direta com a área (quadro do edital)",
      },
      {
        codigo: "out_2",
        rotulo: "Experiência incompatível com o nível de escolaridade da vaga",
      },
      {
        codigo: "out_3",
        rotulo: "Experiência anterior à conclusão da escolaridade exigida",
      },
      {
        codigo: "out_4",
        rotulo: "Atas de defesa ou declarações de provável formando não contam",
      },
      {
        codigo: "out_5",
        rotulo:
          "Estágio ou extensão do candidato indígena sem histórico escolar",
      },
      {
        codigo: "out_6",
        rotulo:
          "Atuação comunitária do candidato indígena sem validação da liderança",
      },
    ],
  },
]);

export const ORDEM_DOS_CRITERIOS = CRITERIOS_DA_EXPERIENCIA.flatMap((g) =>
  g.criterios.map((c) => c.codigo),
);

/** Os quadros do critério "Outros" 1 e 2: [nível, número do quadro]. */
export const QUADROS_DA_EXPERIENCIA: readonly (readonly [string, string])[] =
  Object.freeze([
    ["Superior", "2"],
    ["Técnico", "1"],
    ["Médio", "3"],
  ]);

export const rotuloDoQuadro = (
  nivel: string,
  referencias: ReferenciasDoEdital,
) => {
  const numero = QUADROS_DA_EXPERIENCIA.find(([n]) => n === nivel)?.[1] ?? "2";
  return `${numero} - Nível ${nivel}, do item ${referencias.experiencia_quadro}`;
};

export const TEMPOS_MINIMOS = Object.freeze([
  "3 (três) meses",
  "6 (seis) meses",
]);

export type OpcaoDoPcd = "sem_deficiencia" | "em_desacordo" | "sem_documento";
export const OPCOES_DO_PCD: readonly (readonly [OpcaoDoPcd, string])[] =
  Object.freeze([
    [
      "sem_deficiencia",
      "O laudo médico não aponta deficiência enquadrada na legislação vigente",
    ],
    [
      "em_desacordo",
      "Apresentou documentação em desacordo com o anexo do edital",
    ],
    [
      "sem_documento",
      "Informou se reconhecer como PcD, mas não anexou documento comprobatório",
    ],
  ]);

export const DOCUMENTOS_DA_ALDEIA = Object.freeze([
  "Declaração de Residência em Aldeia",
  "Declaração de Residência em Aldeia assinada pelo candidato indígena",
  "Declaração conforme modelo estabelecido no Anexo {ref_anexo_aldeia}",
]);

export const DOCUMENTOS_DO_QUILOMBOLA = Object.freeze([
  "Declaração emitida e assinada por liderança/associação local",
  "certificado de reconhecimento do território de pertencimento emitido pela Fundação Cultural Palmares (FCP)",
  "Declaração emitida e assinada por liderança/associação local ou certificado de reconhecimento do território de pertencimento emitido pela Fundação Cultural Palmares (FCP)",
]);
