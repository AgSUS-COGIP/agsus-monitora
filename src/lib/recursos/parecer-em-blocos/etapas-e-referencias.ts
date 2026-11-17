/* Parecer em blocos: etapas do parecer e referências do edital (API pública em ../parecer-em-blocos.ts). */

import { texto } from "./meses-e-formatacao.ts";

/*
  Parecer de recurso montado em blocos (protótipo, docs/recursos/parecer-em-blocos.md).

  Espelha o "Sistema automatizado de elaboração de pareceres" que a equipe da
  Saúde Indígena usa (um HTML avulso): o cabeçalho, 1 Objeto, 2 Relatório,
  3 Admissibilidade, 4 Análise de mérito (requisitos eliminatórios e os blocos)
  e 5 Conclusão, com os gestores que assinam. A ordem das seções e os textos
  são os do simulador e viram o MODELO PADRÃO do parecer (TEXTOS_PADRAO), que
  o administrador poderá editar depois, como os modelos de resposta.

  Diferenças de propósito (todas listadas no doc):
  - cada bloco pertence a uma ETAPA (hoje só a Avaliação documental; a
    Entrevista entra depois, com blocos próprios, sem refazer a tela);
  - os números de item e anexo do edital ("6.4, alínea c", "8.12.2"…) não
    ficam no texto: vêm das referências do edital (Regras do edital), com os
    do simulador como padrão (REFERENCIAS_DO_EDITAL);
  - três palavras em inglês que escaparam no simulador (established,
    declared, confirmed) saem corrigidas (CORRECOES_DO_SIMULADOR).

  Sem DOM e sem estado: rascunho (JSON que o banco guardaria por versão) →
  documento (seções, parágrafos e listas, com trechos em negrito) → texto.
  A conta dos meses é a da ficha (diasDosIntervalos): dias corridos com o
  primeiro e o último, unidos, divididos por 30, só os inteiros.
*/

// ── Etapas ───────────────────────────────────────────────────────────────

export type EtapaDoParecer = "avaliacao" | "entrevista";

export interface DefinicaoDaEtapa {
  valor: EtapaDoParecer;
  rotulo: string;
  /** Como o texto chama a etapa ("Etapa de Avaliação Documental e de Títulos"). */
  titulo: string;
  /** A etapa já tem blocos no catálogo. */
  disponivel: boolean;
}

export const ETAPAS_DO_PARECER: readonly DefinicaoDaEtapa[] = Object.freeze([
  {
    valor: "avaliacao",
    rotulo: "Avaliação documental",
    titulo: "Avaliação Documental e de Títulos",
    disponivel: true,
  },
  {
    valor: "entrevista",
    rotulo: "Entrevista",
    titulo: "Entrevista",
    disponivel: false,
  },
]);

export const etapaDoParecer = (valor: unknown): DefinicaoDaEtapa =>
  ETAPAS_DO_PARECER.find((e) => e.valor === valor) ?? ETAPAS_DO_PARECER[0]!;

// ── Referências do edital ────────────────────────────────────────────────

export type ChaveDaReferencia =
  | "identificacao"
  | "identificacao_alinea"
  | "formacao"
  | "formacao_frente_verso"
  | "formacao_nato_digital"
  | "formacao_provavel_formando"
  | "experiencia"
  | "experiencia_quadro"
  | "experiencia_anterior"
  | "experiencia_indigena"
  | "ata_de_defesa"
  | "indigena"
  | "indigena_alinea"
  | "aldeia_alinea"
  | "indigena_no_recurso"
  | "anexo_aldeia"
  | "anexo_pcd"
  | "anexo_quilombola"
  | "heteroidentificacao"
  | "anexos_heteroidentificacao"
  | "recurso_forma"
  | "recurso_decisao_final";

export interface DefinicaoDaReferencia {
  chave: ChaveDaReferencia;
  rotulo: string;
  /** O valor que o simulador escreve no texto. */
  padrao: string;
  /** O tipo de bloco da regra da Avaliação documental cujo item_edital vale aqui. */
  tipoDoBloco?: "TITULOS" | "VINCULOS";
}

export const REFERENCIAS_DO_EDITAL: readonly DefinicaoDaReferencia[] =
  Object.freeze([
    {
      chave: "identificacao",
      rotulo: "Documento de identificação",
      padrao: "6.4",
    },
    {
      chave: "identificacao_alinea",
      rotulo: "Alínea do documento de identificação",
      padrao: "c",
    },
    {
      chave: "formacao",
      rotulo: "Formação acadêmica",
      padrao: "8.12",
      tipoDoBloco: "TITULOS",
    },
    {
      chave: "formacao_frente_verso",
      rotulo: "Frente e verso",
      padrao: "8.12.2",
    },
    {
      chave: "formacao_nato_digital",
      rotulo: "Documento nato-digital",
      padrao: "8.12.2.1",
    },
    {
      chave: "formacao_provavel_formando",
      rotulo: "Declaração de provável formando",
      padrao: "8.12.2.2",
    },
    {
      chave: "experiencia",
      rotulo: "Experiência profissional",
      padrao: "8.15",
      tipoDoBloco: "VINCULOS",
    },
    {
      chave: "experiencia_quadro",
      rotulo: "Quadro de experiência por nível",
      padrao: "8.8",
    },
    {
      chave: "experiencia_anterior",
      rotulo: "Experiência anterior à escolaridade",
      padrao: "8.15.1",
    },
    {
      chave: "experiencia_indigena",
      rotulo: "Estágio e atuação do candidato indígena",
      padrao: "8.15.2.1",
    },
    {
      chave: "ata_de_defesa",
      rotulo: "Ata de defesa e provável formando",
      padrao: "8.14.5.2",
    },
    { chave: "indigena", rotulo: "Pertencimento indígena", padrao: "6.4" },
    {
      chave: "indigena_alinea",
      rotulo: "Alínea do pertencimento indígena",
      padrao: "h",
    },
    {
      chave: "aldeia_alinea",
      rotulo: "Alínea do residente em aldeia",
      padrao: "i",
    },
    {
      chave: "indigena_no_recurso",
      rotulo: "Documento indígena no recurso",
      padrao: "6.5.1",
    },
    {
      chave: "anexo_aldeia",
      rotulo: "Anexo da residência em aldeia",
      padrao: "VI",
    },
    { chave: "anexo_pcd", rotulo: "Anexo do laudo PcD", padrao: "VIII" },
    { chave: "anexo_quilombola", rotulo: "Anexo do quilombola", padrao: "XI" },
    {
      chave: "heteroidentificacao",
      rotulo: "Heteroidentificação",
      padrao: "5.5.1",
    },
    {
      chave: "anexos_heteroidentificacao",
      rotulo: "Anexos da heteroidentificação",
      padrao: "IX e X",
    },
    {
      chave: "recurso_forma",
      rotulo: "Prazo e forma do recurso",
      padrao: "11.1, 11.4, 11.6 e 11.8",
    },
    {
      chave: "recurso_decisao_final",
      rotulo: "Decisão final do recurso",
      padrao: "11.8",
    },
  ]);

export type ReferenciasDoEdital = Record<ChaveDaReferencia, string>;

export const REFERENCIAS_PADRAO: Readonly<ReferenciasDoEdital> = Object.freeze(
  Object.fromEntries(
    REFERENCIAS_DO_EDITAL.map((r) => [r.chave, r.padrao]),
  ) as ReferenciasDoEdital,
);

/** O recorte da regra da Avaliação documental que as referências leem. */
export interface RegraParaOParecer {
  blocos?: readonly {
    codigo: string;
    tipo: string;
    item_edital?: string | null;
    indigena?: number;
    aldeia?: number;
    pontos_por_mes?: number;
    por_nivel?: unknown;
  }[];
  /**
   * PROPOSTA (não existe no banco): as referências do parecer de recurso
   * gravadas nas Regras do edital, só as que diferem do padrão.
   */
  referencias_do_parecer?: Partial<Record<string, string>> | null;
}

export type FonteDaReferencia = "regra" | "bloco" | "padrao";

/**
 * As referências do edital: a gravada nas Regras do edital
 * (referencias_do_parecer), o item_edital do bloco da regra (formação e
 * experiência) ou o padrão do simulador. Devolve também de onde veio cada uma.
 */
export function referenciasDoEdital(
  regra: RegraParaOParecer | null | undefined,
): {
  referencias: ReferenciasDoEdital;
  fontes: Record<ChaveDaReferencia, FonteDaReferencia>;
} {
  const referencias = { ...REFERENCIAS_PADRAO };
  const fontes = Object.fromEntries(
    REFERENCIAS_DO_EDITAL.map((r) => [r.chave, "padrao"]),
  ) as Record<ChaveDaReferencia, FonteDaReferencia>;
  for (const def of REFERENCIAS_DO_EDITAL) {
    const gravada = texto(regra?.referencias_do_parecer?.[def.chave]);
    if (gravada) {
      referencias[def.chave] = gravada;
      fontes[def.chave] = "regra";
      continue;
    }
    if (!def.tipoDoBloco) continue;
    const doBloco = texto(
      regra?.blocos?.find((b) => b.tipo === def.tipoDoBloco)?.item_edital,
    );
    if (doBloco) {
      referencias[def.chave] = doBloco;
      fontes[def.chave] = "bloco";
    }
  }
  return { referencias, fontes };
}
