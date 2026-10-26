/*
  Catálogos da regra da avaliação documental (docs/analises-no-monitora/).

  Aqui ficam só os NOMES do que a regra pode escolher: tipos de bloco,
  situações, efeitos, parciais, níveis e títulos. Nenhum peso, ponto ou teto
  mora no código: tudo isso é dado da regra de cada edital (TH_REGRA_ANALISE),
  e o banco confere o mesmo vocabulário em private."FC_VALIDAR_REGRA_ANALISE"
  (supabase/migrations/20261006100000_regra_da_analise.sql).
*/
import type { DesempateDaProvisoria, Parcial } from "./tipos-da-regra.ts";

/** Um par [código, rótulo] de um catálogo. */
export type ParDoCatalogo = readonly [string, string];
export type ListaDoCatalogo = ReadonlyArray<ParDoCatalogo>;

export const SCHEMA_DA_REGRA = 1;

export const TITULO_PADRAO_DA_ETAPA = "Avaliação Documental e de Títulos";

/** Tipos de bloco da ficha: um cartão por documento ou pergunta. */
export const TIPOS_DE_BLOCO: ListaDoCatalogo = Object.freeze([
  ["DOCUMENTO", "Documento (situação, motivo e efeito)"],
  ["PONTUACAO", "Critério étnico (pontos de indígena e de aldeia)"],
  ["TITULOS", "Formação acadêmica (títulos por nível)"],
  ["CURSOS", "Cursos de aperfeiçoamento (faixas de carga horária)"],
  ["VINCULOS", "Experiência profissional (vínculos)"],
  ["COTA", "Cota (encaminhamento)"],
  ["REGISTRO", "Só registro"],
]);

/** A parcial que cada tipo de bloco pontua (uma por regra). */
export const PARCIAL_DO_TIPO: Readonly<Record<string, Parcial>> = Object.freeze(
  {
    PONTUACAO: "ETNICO",
    TITULOS: "FORMACAO",
    CURSOS: "CURSOS",
    VINCULOS: "EXPERIENCIA",
  },
);

/** Rótulos das parciais no parecer e na tela (os nomes das colunas da lista oficial). */
export const PARCIAIS: ListaDoCatalogo = Object.freeze([
  ["ETNICO", "Critério Étnico"],
  ["FORMACAO", "Formação Acadêmica"],
  ["CURSOS", "Cursos de Aperfeiçoamento"],
  ["EXPERIENCIA", "Experiência Profissional"],
]);

/** Rótulos curtos das parciais na pontuação informativa do inapto por requisito. */
export const PARCIAIS_CURTAS: ListaDoCatalogo = Object.freeze([
  ["ETNICO", "Critério étnico"],
  ["FORMACAO", "Titulação"],
  ["CURSOS", "Cursos"],
  ["EXPERIENCIA", "Experiência"],
]);

export const SITUACOES_DO_BLOCO: ListaDoCatalogo = Object.freeze([
  ["CONFORME", "Conforme"],
  ["NAO_CONFORME", "Não conforme"],
  ["NAO_ENVIADO", "Não enviado"],
  ["NAO_SE_APLICA", "Não se aplica"],
]);

/** Situações que podem ter efeito configurado na regra. */
export const SITUACOES_COM_EFEITO: ReadonlyArray<string> = Object.freeze([
  "CONFORME",
  "NAO_CONFORME",
  "NAO_ENVIADO",
]);

export const EFEITOS: ListaDoCatalogo = Object.freeze([
  ["ELIMINA", "Elimina (inapto, nota 0)"],
  ["ZERA_PONTOS", "Zera os pontos do bloco"],
  ["SEM_PONTOS_ALDEIA", "Tira só os pontos de aldeia"],
  ["AJUSTA_PONTOS", "Ajusta pontos (pelos itens lançados)"],
  ["SO_REGISTRO", "Só registro"],
  ["ENCAMINHA_HETEROIDENTIFICACAO", "Encaminha à heteroidentificação"],
  ["ENCAMINHA_PERICIA", "Encaminha à perícia"],
  ["SEGUE_AMPLA", "Segue na ampla concorrência"],
]);

/*
  Quando dois efeitos valem no mesmo bloco (o da situação e o de um motivo),
  vale o mais forte, nesta ordem.
*/
export const FORCA_DO_EFEITO: ReadonlyArray<string> = Object.freeze([
  "ELIMINA",
  "ZERA_PONTOS",
  "SEM_PONTOS_ALDEIA",
  "AJUSTA_PONTOS",
  "ENCAMINHA_HETEROIDENTIFICACAO",
  "ENCAMINHA_PERICIA",
  "SEGUE_AMPLA",
  "SO_REGISTRO",
]);

/** Efeitos que só fazem sentido em bloco que pontua. */
export const EFEITOS_DE_PONTUACAO: ReadonlyArray<string> = Object.freeze([
  "ZERA_PONTOS",
  "AJUSTA_PONTOS",
]);
export const EFEITOS_DE_ENCAMINHAMENTO: ReadonlyArray<string> = Object.freeze([
  "ENCAMINHA_HETEROIDENTIFICACAO",
  "ENCAMINHA_PERICIA",
  "SEGUE_AMPLA",
]);

/** Níveis da vaga (os mesmos da regra de classificação). */
export const NIVEIS: ListaDoCatalogo = Object.freeze([
  ["superior", "Superior"],
  ["tecnico", "Técnico"],
  ["medio", "Médio"],
  ["fundamental", "Fundamental"],
]);

export const TITULOS_ACADEMICOS: ListaDoCatalogo = Object.freeze([
  ["ENSINO_MEDIO", "Ensino médio"],
  ["TECNICO", "Técnico"],
  ["GRADUACAO", "Graduação"],
  ["ESPECIALIZACAO", "Especialização"],
  ["RESIDENCIA", "Residência"],
  ["MESTRADO", "Mestrado"],
  ["DOUTORADO", "Doutorado"],
]);

/** Como a nota declarada lê uma resposta da Empregare. */
export const TIPOS_DA_NOTA_DECLARADA: ListaDoCatalogo = Object.freeze([
  ["OPCAO", "Uma opção vale pontos"],
  ["OPCOES_SOMADAS", "Opções marcadas somam pontos"],
  ["FAIXA_EM_MESES", "Faixa de meses × pontos por mês"],
]);

/*
  Desempate da Provisória depois da ART (decrescente), na ordem da regra.
  Por último vale sempre o código do candidato (para a ordem não variar).
*/
export const DESEMPATES_DA_PROVISORIA: ListaDoCatalogo = Object.freeze([
  [
    "IDOSO",
    "Idade de 60 anos ou mais (Estatuto da Pessoa Idosa), o mais velho primeiro",
  ],
  [
    "EXPERIENCIA_DECLARADA",
    "Maior experiência declarada no questionário (a pergunta da experiência)",
  ],
  ["MAIOR_IDADE", "Maior idade (o mais velho primeiro)"],
  ["MAIS_VELHO", "O mais velho primeiro (o mesmo que Maior idade)"],
  ["CANDIDATURA", "A candidatura mais antiga primeiro"],
]);

/*
  A nota que faz o corte e a ordem do lote (provisoria.base_da_nota). No
  93/2026 (item 8.2.6) vale a pontuação AUTODECLARADA na inscrição: a nota
  declarada recalculada pela regra, quando completa; a ART da Empregare muda
  quando a equipe ajusta pontos na conferência e fica só para comparar. Sem
  base na regra: DECLARADA quando há nota declarada configurada, senão ART.
*/
export const BASES_DA_NOTA_DO_LOTE: ListaDoCatalogo = Object.freeze([
  ["DECLARADA", "Nota declarada na inscrição"],
  ["ART", "ART da Empregare"],
]);

export const DESEMPATE_PADRAO_DA_PROVISORIA: ReadonlyArray<DesempateDaProvisoria> =
  Object.freeze(["IDOSO", "CANDIDATURA"]);

export const BASES_DO_LOTE: ListaDoCatalogo = Object.freeze([
  ["MULTIPLO_VAGAS", "Múltiplo das vagas imediatas"],
  ["FIXO", "Número fixo por vaga"],
  ["NOTA_MINIMA", "Todos com a nota mínima (ex.: item 8.2.6)"],
]);

export const MODOS_DE_DISTRIBUICAO: ListaDoCatalogo = Object.freeze([
  ["PEGAR_PROXIMO", "Pegar próximo"],
  ["DISTRIBUICAO_INICIAL", "Distribuição inicial"],
]);

export const CRITERIOS_DA_DISTRIBUICAO: ListaDoCatalogo = Object.freeze([
  ["PARTES_IGUAIS", "Partes iguais"],
  ["LIMITE", "Até um limite por analista"],
]);

export const DESTINO_DOS_NOVOS: ListaDoCatalogo = Object.freeze([
  ["MENOS_PENDENTES", "Para quem tem menos pendentes"],
  ["PEGAR_PROXIMO", "Ficam livres para pegar"],
]);

export const SINAIS_DA_REVISAO: ListaDoCatalogo = Object.freeze([
  ["VINCULO_ATIVO", "Vínculo ativo"],
  ["PARENTESCO", "Parentesco"],
]);

export const RESULTADOS: ListaDoCatalogo = Object.freeze([
  ["APTO", "Apto"],
  ["INAPTO_REQUISITO", "Inapto (requisito)"],
  ["INAPTO_NOTA", "Inapto (nota mínima)"],
]);

/** Situações da regra (TB_REGRA_ANALISE.TP_SITUACAO). */
export const SITUACOES_DA_REGRA: ListaDoCatalogo = Object.freeze([
  ["CONFERIR", "Conferir"],
  ["CONFERIDA", "Conferida"],
]);

/** Papéis na equipe do edital (RL_ANALISTA_EDITAL.TP_PAPEL). */
export const PAPEIS_DA_EQUIPE: ListaDoCatalogo = Object.freeze([
  ["ANALISTA", "Analista"],
  ["REVISOR", "Revisor"],
  ["COORDENADOR", "Coordenação"],
]);

export const rotuloDe = (lista: ListaDoCatalogo, valor: unknown): string =>
  lista.find(([v]) => v === valor)?.[1] ?? String(valor ?? "");
