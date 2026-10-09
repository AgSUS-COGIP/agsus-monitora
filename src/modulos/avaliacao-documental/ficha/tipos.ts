/*
  Contratos da ficha de análise (ficha/*.tsx). Os dados vêm de
  obter_ficha_analise e da conta pura (src/lib/avaliacao-documental/ficha.js e
  pontuacao.js, em JavaScript); aqui só o que os componentes leem. O banco e o
  normalizador da regra validam a estrutura — estes tipos não validam JSON.
*/
import type { EnderecosDaEmpregare } from "../../../lib/avaliacao-documental/anexo-na-empregare.ts";

export type Situacao = "CONFORME" | "NAO_CONFORME" | "NAO_ENVIADO";

export type Opcao = { codigo: string; texto: string; item_edital?: string };

export type Bloco = {
  codigo: string;
  tipo: string;
  titulo: string;
  item_edital?: string | null;
  condicao?: string | null;
  motivos?: Opcao[];
  categorias?: { codigo: string; rotulo?: string }[];
  perguntas?: string[];
  rotulo_curto?: string;
};

export type ObservacaoPronta = {
  codigo: string;
  rotulo?: string;
  texto: string;
};

export type Regra = {
  blocos: Bloco[];
  observacoes_prontas?: ObservacaoPronta[];
};

export type Lancado = {
  situacao?: Situacao | null;
  motivos?: string[];
  motivo_livre?: string;
  nota_ajustada?: number | null;
  justificativas?: string[];
  justificativa_livre?: string;
};

export type Titulo = {
  titulo: string;
  nome?: string;
  aceito?: boolean;
  motivo?: string | null;
};
export type Curso = {
  nome?: string;
  horas?: number | "";
  aceito?: boolean;
  motivo?: string | null;
};
export type Vinculo = {
  empregador?: string;
  categoria?: string;
  inicio?: string;
  fim?: string;
  aceito?: boolean;
  motivo?: string | null;
};
export type ItemLancado = Partial<Titulo> & Curso & Vinculo;

export type Lancamento = {
  nivel: string;
  modalidade: string;
  indigena?: boolean;
  mora_aldeia?: boolean;
  aldeia_na_lista?: boolean;
  blocos: Record<string, Lancado | undefined>;
  titulos: ItemLancado[];
  cursos: ItemLancado[];
  vinculos: ItemLancado[];
  observacoes?: string;
  observacoes_prontas?: string[];
  [chave: string]: unknown;
};

/** Muda o lançamento numa cópia (estado-da-ficha.js: mudar). */
export type Mudar = (transformar: (l: Lancamento) => Lancamento) => void;

export type BlocoAvaliado = {
  codigo: string;
  efeito?: string | null;
  motivos?: { texto: string; item_edital?: string }[];
};

export type Avaliacao = {
  resultado: string;
  nota_apurada: number;
  nota_final: number;
  nota_minima: number | null;
  parciais: Record<string, number | undefined>;
  calculados: Record<string, number | undefined>;
  blocos: BlocoAvaliado[];
  parecer: string;
  /** O tempo dos vínculos aceitos (apurarExperiencia, em pontuacao.js). */
  experiencia?: ExperienciaApurada | null;
};

export type ExperienciaApurada = {
  dias_total: number;
  meses: number;
  meses_estagio: number;
  meses_considerados: number;
  pontos: number;
  abaixo_do_minimo: boolean;
};

export type Declarada = { parciais: Record<string, number | undefined> };

export type Pendencia = { bloco: string; tipo: string; texto: string };

export type Conferencia = {
  total: number;
  conferidos: number;
  requisitos: { total: number; conferidos: number };
  situacao: string;
  texto_da_falta: string;
  pode_concluir: boolean;
};

export type LinhaDeResposta = {
  coluna: string;
  enunciado: string;
  texto: string;
  opcoes: string[];
};

/** Estado do passo no stepper (ficha.js: etapasDaFicha e passosDaFicha). */
export type EstadoDoPasso =
  "nao_conferido" | "pendencia" | "opcional" | "pronta" | Situacao;

export type Passo = { codigo: string; nome: string; estado: EstadoDoPasso };

export type ParteDaNota = {
  bloco: string;
  parcial: string;
  rotulo: string;
  apurado: number | null;
  declarado: number | null;
  teto: number | null;
  divergente: boolean;
  /** O valor provisório do item ainda sem decisão (apurado null). */
  previa?: number | null;
};

/** A loja da ficha (estado-da-ficha.js), no que os componentes usam. */
export type LojaDaFicha = {
  registrarAcesso: (tipo: "ABRIR_EMPREGARE" | "COPIAR_CODIGO") => Promise<void>;
};

/** O que os links da Empregare precisam (ficha.jsx monta). */
export type ContextoDaEmpregare = {
  enderecos: EnderecosDaEmpregare;
  codigoDoCandidato: string;
  codigoDaVaga: string;
  loja: LojaDaFicha;
  aoAvisar: (mensagem: string) => void;
};

/** O snapshot da ficha que os componentes leem (estado-da-ficha.js: obter()). */
export type EstadoDaFicha = {
  lancamento: Lancamento;
  avaliacao: Avaliacao;
  declarada: Declarada | null;
  pendencias: Pendencia[];
  conferencia: Conferencia | null;
  dados: {
    regra: { configuracao: Regra };
    respostas: Record<string, unknown>;
    papel?: string;
  };
};
