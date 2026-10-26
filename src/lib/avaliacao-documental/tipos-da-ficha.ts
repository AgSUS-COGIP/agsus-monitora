/*
  Contratos da conta da avaliação documental (pontuacao.ts) e da ficha
  (ficha.ts): o lançamento (o "candidato" da conta), o que a conta devolve e o
  que a ficha monta para a tela. Só tipos: o banco revalida a estrutura
  (FC_VALIDAR_LANCAMENTO_FICHA) e o Python reconfere a conta. Os componentes
  da ficha (src/modulos/avaliacao-documental/ficha/tipos.ts) leem um recorte
  compatível destes tipos.
*/
import type { PontosInformativos } from "./pontos-informativos.ts";
import type { Pergunta } from "./tipos-da-regra.ts";

/** A situação de um bloco na conta (o lançado ou o padrão; NAO_SE_APLICA pela condição). */
export type SituacaoDoBloco =
  "CONFORME" | "NAO_CONFORME" | "NAO_ENVIADO" | "NAO_SE_APLICA";

export type ResultadoDaAvaliacao = "APTO" | "INAPTO_REQUISITO" | "INAPTO_NOTA";

/** As listas de itens do lançamento (BLOCOS_COM_ITENS de ficha.ts). */
export type ChaveDosItens = "titulos" | "cursos" | "vinculos";

/** O que o avaliador lançou num bloco (lancamento.blocos[<CODIGO>]). */
export type LancadoDoBloco = {
  situacao?: string | null;
  motivos?: readonly string[];
  /** O "Outro motivo (descrever)" ou o motivo do bloco sem motivos na regra. */
  motivo_livre?: string | null;
  nota_ajustada?: number | null;
  justificativas?: readonly string[];
  justificativa_livre?: string | null;
  /** Observação do avaliador (até 2.000 caracteres). */
  observacao?: string | null;
  /** Editar nota (a pontuação pelos itens registrados). */
  edita_nota?: boolean;
  /** Linhas extras do cargo: true Confere, false Não confere. */
  extras?: Readonly<Record<string, boolean>>;
  /** Requisitos do cargo: true Confere, false Não confere. */
  requisitos?: Readonly<Record<string, boolean>>;
};

/** Um título, curso ou vínculo lançado (as três listas usam o mesmo formato solto). */
export type ItemDoLancamento = {
  titulo?: string;
  nome?: string;
  horas?: number | string | null;
  empregador?: string;
  categoria?: string;
  inicio?: string;
  fim?: string;
  aceito?: boolean;
  motivo?: string | null;
  /** A linha veio da resposta do candidato. */
  da_resposta?: boolean;
  /** A linha é um item lido do arquivo que o avaliador aceitou. */
  do_arquivo?: string;
  corrigido?: boolean;
};

/**
 * O lançamento da ficha, que é o "candidato" de calcularAvaliacao (o formato
 * no topo de pontuacao.ts). Tudo opcional: a prévia da regra monta um
 * candidato fictício só com parte dos campos.
 */
export type Candidato = {
  nivel?: string | null;
  vaga?: string | number | null;
  cargo?: string | null;
  modalidade?: string | null;
  /** As cotas optadas na pré-classificação (a principal primeiro); [] = só a ampla. */
  modalidades?: readonly string[];
  indigena?: boolean;
  mora_aldeia?: boolean;
  aldeia_na_lista?: boolean;
  blocos?: Readonly<Record<string, LancadoDoBloco | undefined>>;
  titulos?: readonly (ItemDoLancamento | null | undefined)[];
  cursos?: readonly (ItemDoLancamento | null | undefined)[];
  vinculos?: readonly (ItemDoLancamento | null | undefined)[];
  estagio_horas?: number | string | null;
  observacoes?: string | null;
  observacoes_prontas?: readonly string[];
};

/** Acúmulo e percentuais das cotas (FC_DOCUMENTAL_DO_EDITAL). */
export type CotasDaClassificacao = {
  acumulo?: string | null;
  percentuais?: Readonly<Record<string, number>> | null;
};

/** As opções da conta (as notas mínimas e as cotas da regra de classificação). */
export type OpcoesDaAvaliacao = {
  /** A nota mínima geral da regra de classificação. */
  notaMinima?: number | null;
  /** A mínima por nível (vale primeiro). */
  notaMinimaPorNivel?: Readonly<Record<string, number | null | undefined>>;
  /** Situação do bloco não lançado ("CONFORME"). */
  situacaoPadrao?: string;
  cotas?: CotasDaClassificacao | null;
};

/** Um motivo do bloco no resultado (o escrito vem com codigo null). */
export type MotivoAvaliado = {
  codigo: string | null;
  texto: string;
  item_edital: string;
};

/** Situação, efeito e motivos de um bloco no resultado da conta. */
export type BlocoAvaliado = {
  codigo: string;
  situacao: string;
  efeito: string | null;
  motivos: MotivoAvaliado[];
};

/** O tempo de uma categoria de vínculo (o desempate usa anos, meses e dias). */
export type TempoDaCategoria = {
  dias_total: number;
  anos: number;
  meses: number;
  dias: number;
  desempate: number | null;
};

/** O tempo dos vínculos aceitos (apurarExperiencia). */
export type ExperienciaApurada = {
  dias_total: number;
  meses: number;
  meses_estagio: number;
  meses_considerados: number;
  por_categoria: Record<string, TempoDaCategoria>;
  pontos: number;
  abaixo_do_minimo: boolean;
};

/** O calculado pelos itens e o ajustado pela ficha numa parcial. */
export type AjusteDaParcial = { calculado: number; ajustado: number };

/** O que calcularAvaliacao devolve. */
export type Avaliacao = {
  resultado: ResultadoDaAvaliacao;
  modalidade_final: string;
  modalidades_confirmadas: string[];
  nota_apurada: number;
  nota_final: number;
  nota_minima: number | null;
  parciais: Record<string, number>;
  calculados: Record<string, number>;
  ajustes: Record<string, AjusteDaParcial>;
  blocos: BlocoAvaliado[];
  eliminatorios: string[];
  encaminhamentos: string[];
  observacoes: string[];
  experiencia: ExperienciaApurada | null;
  pontos_informativos: PontosInformativos | null;
  parecer: string;
};

/** Um motivo do bloco como a ficha lê (o da regra ou o recorte da tela). */
export type MotivoLido = {
  codigo: string;
  texto?: string;
  item_edital?: string | null;
  efeito?: string | null;
};

/**
 * O bloco como a ficha lê: o da regra (tipos-da-regra.ts: Bloco) ou o
 * recorte que a tela tem (ficha/tipos.ts: Bloco). Só os campos lidos aqui.
 */
export type BlocoLido = {
  codigo: string;
  tipo: string;
  titulo?: string;
  item_edital?: string | null;
  condicao?: string | null;
  rotulo_curto?: string;
  perguntas?: readonly Pergunta[];
  efeitos?: Readonly<Record<string, string | undefined>>;
  motivos?: readonly MotivoLido[];
  requisitos?: readonly unknown[];
  extras?: readonly unknown[];
  teto?: number | null;
  por_nivel?: unknown;
  pontos_por_nivel?: unknown;
  minimo_meses?: number | null;
  efeito_minimo?: string | null;
  minimo_conta_estagio?: boolean;
  nao_se_aplica?: boolean;
};

/** Uma resposta do candidato ligada ao bloco (respostasDoBloco). */
export type RespostaDoBloco = {
  coluna: string;
  enunciado: string;
  texto: string;
  opcoes: string[];
};

/** Os pontos declarados por parcial (declaradaDaFicha). */
export type DeclaradaDaFicha<Item = unknown> = {
  parciais: Record<string, number>;
  total: number;
  itens: Item[];
};

/** O tipo de uma falta (pendenciasDaFicha). */
export type TipoDaFalta =
  | "situacao"
  | "motivo"
  | "requisito"
  | "extra"
  | "comprovado"
  | "horas"
  | "datas"
  | "item"
  | "minimo"
  | "acima"
  | "justificativa"
  | "nota";

/** Uma falta para concluir: [{ bloco, tipo, texto }]. */
export type PendenciaDaFicha = {
  bloco: string;
  tipo: TipoDaFalta;
  texto: string;
};

/** Um bloco com falta no "Falta: …" (conferenciaDaFicha). */
export type FaltaDoBloco = {
  bloco: string;
  nome: string;
  complementos: string[];
};

export type SituacaoDaConferencia = ResultadoDaAvaliacao | "EM_ANALISE";

/** Onde a conferência está (conferenciaDaFicha). */
export type ConferenciaDaFicha = {
  total: number;
  conferidos: number;
  requisitos: { total: number; conferidos: number };
  situacao: SituacaoDaConferencia;
  faltam: FaltaDoBloco[];
  texto_da_falta: string;
  pode_concluir: boolean;
};

/** A decisão gravada num bloco (Confere/Editar nota = CONFORME). */
export type SituacaoLancada = "CONFORME" | "NAO_CONFORME" | "NAO_ENVIADO";

/** Estado do passo no stepper (etapasDaFicha e passosDaFicha). */
export type EstadoDoPasso =
  "nao_conferido" | "pendencia" | "opcional" | "pronta" | SituacaoLancada;

/** Uma etapa ou passo do modo de análise. */
export type PassoDaFicha = {
  codigo: string;
  nome: string;
  estado: EstadoDoPasso;
  /** No "!": o que falta (a mesma mensagem do item). */
  motivo?: string | null;
};

/** Uma linha da composição da nota (composicaoDaNota). */
export type ParteDaComposicao = {
  bloco: string;
  parcial: string;
  rotulo: string;
  /** null antes de conferir. */
  apurado: number | null;
  declarado: number | null;
  teto: number | null;
  divergente: boolean;
};
