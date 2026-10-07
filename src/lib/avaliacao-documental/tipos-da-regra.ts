/*
  Contratos da regra da avaliação documental (TH_REGRA_ANALISE."DS_CONFIGURACAO").
  O formato é o de src/lib/avaliacao-documental/regra.js (schema 1), que o
  banco confere em private."FC_VALIDAR_REGRA_ANALISE": aqui só os tipos, para
  o assistente e o resumo. Uma anotação não valida JSON: quem valida é
  validarRegraAnalise.
*/

export type Nivel = "superior" | "tecnico" | "medio" | "fundamental";
export type TipoDeBloco =
  | "DOCUMENTO"
  | "PONTUACAO"
  | "TITULOS"
  | "CURSOS"
  | "VINCULOS"
  | "COTA"
  | "REGISTRO";
export type Parcial = "ETNICO" | "FORMACAO" | "CURSOS" | "EXPERIENCIA";
export type SituacaoComEfeito = "CONFORME" | "NAO_CONFORME" | "NAO_ENVIADO";
export type Efeito =
  | "ELIMINA"
  | "ZERA_PONTOS"
  | "SEM_PONTOS_ALDEIA"
  | "AJUSTA_PONTOS"
  | "SO_REGISTRO"
  | "ENCAMINHA_HETEROIDENTIFICACAO"
  | "ENCAMINHA_PERICIA"
  | "SEGUE_AMPLA";
export type TituloAcademico =
  | "ENSINO_MEDIO"
  | "TECNICO"
  | "GRADUACAO"
  | "ESPECIALIZACAO"
  | "RESIDENCIA"
  | "MESTRADO"
  | "DOUTORADO";

/** O começo do enunciado da pergunta da Empregare, ou alternativas. */
export type Pergunta = string | string[];

export type Motivo = {
  codigo: string;
  texto: string;
  item_edital?: string;
  efeito?: Efeito | null;
};

export type Faixa = {
  min_horas: number;
  max_horas: number | null;
  pontos: number;
};
export type FaixasDeCursos = { teto?: number | null; faixas: Faixa[] };
export type PontosDeExperiencia = {
  pontos_por_mes?: number;
  pontos_por_periodo?: number;
  teto?: number | null;
};
export type TituloComPontos = { titulo: TituloAcademico; pontos: number };
export type CategoriaDeVinculo = {
  codigo: string;
  rotulo: string;
  desempate: number | null;
  pontua?: boolean;
};

export type Bloco = {
  codigo: string;
  titulo: string;
  item_edital?: string;
  tipo: TipoDeBloco;
  perguntas?: string[];
  condicao?: string | null;
  efeitos?: Partial<Record<SituacaoComEfeito, Efeito>>;
  motivos?: Motivo[];
  parcial?: Parcial;
  teto?: number | null;
  // PONTUACAO (critério étnico)
  indigena?: number;
  aldeia?: number;
  lista_aldeias?: "DSEI_DO_EDITAL" | null;
  // TITULOS
  cumulativa?: boolean;
  pontos_por_nivel?: Partial<Record<Nivel, TituloComPontos[]>>;
  // CURSOS (faixas) e VINCULOS (pontos), gerais e por nível
  faixas?: Faixa[];
  por_nivel?: Partial<Record<Nivel, FaixasDeCursos | PontosDeExperiencia>>;
  // VINCULOS
  categorias?: CategoriaDeVinculo[];
  minimo_meses?: number;
  efeito_minimo?: "ELIMINA" | "SO_REGISTRO" | null;
  item_minimo?: string;
  pontuacao?: "POR_MES" | "POR_PERIODO";
  pontos_por_mes?: number;
  periodo_meses?: number;
  pontos_por_periodo?: number;
  desconta_minimo?: boolean;
  dias_por_mes?: number;
  unir_sobreposicao?: boolean;
  data_limite?: string | null;
  max_vinculos?: number;
  minimo_conta_estagio?: boolean;
  estagio_indigena?: {
    ativo: boolean;
    horas_por_dia?: number;
    dias_por_mes?: number;
    so_sem_experiencia?: boolean;
  } | null;
};

export type MapaDeRespostas = Record<string, number>;
export type ItemDaNotaDeclarada = {
  parcial: Parcial;
  pergunta: Pergunta;
  tipo: "OPCAO" | "OPCOES_SOMADAS" | "FAIXA_EM_MESES";
  pontos?: MapaDeRespostas;
  pontos_por_nivel?: Partial<Record<Nivel, MapaDeRespostas>>;
  meses?: MapaDeRespostas;
  pontos_por_mes?: number;
  teto?: number | null;
};

export type EliminacaoAutomatica = {
  codigo: string;
  coluna?: string;
  coluna_prefixo?: string;
  pergunta?: string;
  quando?: string[];
  exceto?: string[];
  motivo: string;
};

export type DesempateDaProvisoria =
  | "IDOSO"
  | "EXPERIENCIA_DECLARADA"
  | "MAIOR_IDADE"
  | "MAIS_VELHO"
  | "CANDIDATURA";

export type Provisoria = {
  eliminacao_automatica: EliminacaoAutomatica[];
  nota_declarada: ItemDaNotaDeclarada[];
  divergencia_tolerancia: number;
  desempate: DesempateDaProvisoria[];
  pergunta_experiencia: Pergunta | null;
  base_da_nota: "DECLARADA" | "ART";
};

export type Lote = {
  base: "MULTIPLO_VAGAS" | "FIXO" | "NOTA_MINIMA";
  multiplo: number | null;
  fixo: number | null;
  nota_minima?: number | null;
  item_edital?: string | null;
  inclui_cr: boolean;
  por_modalidade: boolean;
  inclui_empatados: boolean;
  linha_anda: boolean;
  publica_reposicao: boolean;
  por_vaga?: Record<string, number> | null;
};

export type ObservacaoPronta = {
  codigo: string;
  rotulo: string;
  texto: string;
  item_edital?: string;
};

export type RegraAnalise = {
  schema: 1;
  modelo: string | null;
  titulo_etapa: string;
  edital_rotulo: string;
  casas_parecer: number;
  provisoria: Provisoria;
  lote: Lote;
  distribuicao: Record<string, unknown>;
  revisao: Record<string, unknown> & { sinais: string[] };
  blocos: Bloco[];
  corte: { fonte: "REGRA_CLASSIFICACAO"; item_edital: string };
  parecer: Record<
    "APTO" | "INAPTO_REQUISITO" | "INAPTO_NOTA" | "observacoes",
    string
  >;
  observacoes_prontas: ObservacaoPronta[];
};

/** A regra salva como obter_regra_analise devolve (FC_REGRA_ANALISE_JSON). */
export type VersaoDaRegra = {
  versao: number;
  em: string;
  por: string | null;
  motivo: string | null;
  configuracao: RegraAnalise;
};
export type RegraSalva = {
  versao: number;
  situacao: "CONFERIR" | "CONFERIDA";
  modelo_origem: string | null;
  configuracao: RegraAnalise;
  atualizado_em: string;
  por: string | null;
  conferida_em?: string | null;
  conferida_por?: string | null;
  /** Quem está logado salvou a versão vigente e não é administrador global. */
  conferir_pede_outra_pessoa?: boolean;
  versoes: VersaoDaRegra[];
};

/** As colunas "Pergunta N - …" da última carga de uma vaga do edital. */
export type ColunasDaVaga = {
  vaga: string;
  cargo: string | null;
  colunas: string[];
};

/** Uma pergunta da última carga com as respostas que aparecem 2+ vezes. */
export type PerguntaDaCarga = {
  coluna: string;
  respostas: { valor: string; quantidade: number }[];
  outras: number;
  distintas?: number;
};

/** Regra conferida de outro edital da área (obter_apoio_regra_analise). */
export type RegraDeOutroEdital = {
  id: string;
  edital: string;
  numero: string | null;
  unidade: string | null;
  versao: number;
  conferida_em: string | null;
  configuracao: RegraAnalise;
};

export type ModeloDaRegra = {
  codigo: string;
  nome: string;
  configuracao: RegraAnalise;
};
