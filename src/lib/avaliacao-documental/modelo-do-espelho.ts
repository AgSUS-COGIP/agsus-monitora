/*
  O MODELO DO ESPELHO DE NOTA, por edital: os TEXTOS da folha que a
  coordenação ajusta sem deploy (título, subtítulo, saudação com o nome do
  candidato, abertura, nomes dos quadros, rótulos das notas, "Não se aplica"
  do eliminado, "Sem observação registrada.", rodapé e se a nota autodeclarada
  aparece no modelo com pontos). O conteúdo (quem aparece, notas, critérios,
  justificativas) continua só de montarEspelho: aqui não há regra de conteúdo.

  O banco guarda só o que difere do padrão (TB_MODELO_ESPELHO_NOTA.DS_TEXTOS,
  migration 20261019120000; "Restaurar padrão" grava {}), valida com as
  mesmas regras de validarModeloDoEspelho (private."FC_VALIDAR_MODELO_ESPELHO_NOTA")
  e recusa a versão velha com PT409 (src/lib/conflito-de-versao.ts). Sem
  modelo salvo, ou com a RPC indisponível, vale o padrão.
*/

/** O marcador do nome do candidato (na saudação, em negrito; na abertura, texto). */
export const MARCADOR_DO_CANDIDATO = "{candidato}";

export type TextosDoEspelho = {
  titulo: string;
  subtitulo: string;
  saudacao: string;
  abertura: string;
  secao_dados: string;
  secao_notas: string;
  secao_criterios: string;
  secao_justificativas: string;
  rotulo_autodeclarada: string;
  rotulo_consolidada: string;
  nao_se_aplica: string;
  sem_observacao: string;
  rodape: string;
  mostrar_autodeclarada: boolean;
};

export type ChaveDeTexto = Exclude<
  keyof TextosDoEspelho,
  "mostrar_autodeclarada"
>;

/** Os textos de hoje (o layout de referência): o padrão de todo edital. */
export const TEXTOS_PADRAO_DO_ESPELHO: Readonly<TextosDoEspelho> =
  Object.freeze({
    titulo: "Espelho de Pontuação da Análise Curricular",
    subtitulo: "Documento simplificado para atendimento ao candidato",
    saudacao: `Prezado(a) ${MARCADOR_DO_CANDIDATO},`,
    abertura:
      "Apresenta-se, a seguir, o espelho de nota referente à avaliação realizada pela comissão avaliadora, para fins de consulta.",
    secao_dados: "Dados do registro",
    secao_notas: "Notas",
    secao_criterios: "Pontuação por critério",
    secao_justificativas: "Justificativa / observação registrada",
    rotulo_autodeclarada: "Nota autodeclarada (antes da análise)",
    rotulo_consolidada: "Nota consolidada (após a análise documental)",
    nao_se_aplica:
      "Não se aplica — candidato(a) eliminado(a) na análise documental",
    sem_observacao: "Sem observação registrada.",
    rodape:
      "Observação: este espelho apresenta exclusivamente os dados necessários para comunicação da nota ao candidato, sem reprodução integral do questionário ou de informações internas adicionais.",
    mostrar_autodeclarada: true,
  });

export type CampoDoModelo = {
  chave: ChaveDeTexto;
  rotulo: string;
  grupo: "Cabeçalho" | "Quadros" | "Notas" | "Textos fixos";
  /** Vazio permitido: a linha some da folha. */
  podeFicarVazio: boolean;
  maximo: number;
  linhas: number;
  /** Aceita {candidato}. */
  aceitaCandidato?: boolean;
};

/** Os campos do editor, na ordem da folha (o banco repete os limites). */
export const CAMPOS_DO_MODELO: readonly CampoDoModelo[] = [
  {
    chave: "titulo",
    rotulo: "Título",
    grupo: "Cabeçalho",
    podeFicarVazio: false,
    maximo: 200,
    linhas: 1,
  },
  {
    chave: "subtitulo",
    rotulo: "Subtítulo",
    grupo: "Cabeçalho",
    podeFicarVazio: true,
    maximo: 300,
    linhas: 1,
  },
  {
    chave: "saudacao",
    rotulo: "Saudação",
    grupo: "Cabeçalho",
    podeFicarVazio: false,
    maximo: 300,
    linhas: 1,
    aceitaCandidato: true,
  },
  {
    chave: "abertura",
    rotulo: "Texto de abertura",
    grupo: "Cabeçalho",
    podeFicarVazio: true,
    maximo: 2000,
    linhas: 3,
    aceitaCandidato: true,
  },
  {
    chave: "secao_dados",
    rotulo: "Quadro dos dados",
    grupo: "Quadros",
    podeFicarVazio: false,
    maximo: 120,
    linhas: 1,
  },
  {
    chave: "secao_notas",
    rotulo: "Quadro das notas",
    grupo: "Quadros",
    podeFicarVazio: false,
    maximo: 120,
    linhas: 1,
  },
  {
    chave: "secao_criterios",
    rotulo: "Quadro dos critérios",
    grupo: "Quadros",
    podeFicarVazio: false,
    maximo: 120,
    linhas: 1,
  },
  {
    chave: "secao_justificativas",
    rotulo: "Quadro da justificativa",
    grupo: "Quadros",
    podeFicarVazio: false,
    maximo: 120,
    linhas: 1,
  },
  {
    chave: "rotulo_autodeclarada",
    rotulo: "Nota autodeclarada",
    grupo: "Notas",
    podeFicarVazio: false,
    maximo: 150,
    linhas: 1,
  },
  {
    chave: "rotulo_consolidada",
    rotulo: "Nota consolidada",
    grupo: "Notas",
    podeFicarVazio: false,
    maximo: 150,
    linhas: 1,
  },
  {
    chave: "nao_se_aplica",
    rotulo: "Nota do eliminado",
    grupo: "Notas",
    podeFicarVazio: false,
    maximo: 300,
    linhas: 2,
  },
  {
    chave: "sem_observacao",
    rotulo: "Sem justificativa",
    grupo: "Textos fixos",
    podeFicarVazio: false,
    maximo: 300,
    linhas: 1,
  },
  {
    chave: "rodape",
    rotulo: "Rodapé",
    grupo: "Textos fixos",
    podeFicarVazio: true,
    maximo: 2000,
    linhas: 3,
  },
];

const CHAVES_DE_TEXTO = new Set<string>(CAMPOS_DO_MODELO.map((c) => c.chave));
const CAMPO = new Map(CAMPOS_DO_MODELO.map((c) => [c.chave, c]));

const limpo = (valor: string) => valor.replace(/\s+/g, " ").trim();
// Um marcador entre chaves que não é {candidato}.
const MARCADOR_DESCONHECIDO = /\{(?!candidato\})[^{}]*\}/;

/**
 * Os erros do modelo por campo (vazio = válido). As mesmas regras do banco:
 * só as chaves conhecidas, textos dentro do limite, vazio só onde pode,
 * {candidato} só na saudação e na abertura (obrigatório na saudação) e
 * mostrar_autodeclarada booleano.
 */
export function validarModeloDoEspelho(
  textos: Record<string, unknown>,
): Partial<Record<keyof TextosDoEspelho | "_", string>> {
  const erros: Partial<Record<keyof TextosDoEspelho | "_", string>> = {};
  for (const [chave, valor] of Object.entries(textos ?? {})) {
    if (chave === "mostrar_autodeclarada") {
      if (typeof valor !== "boolean")
        erros.mostrar_autodeclarada = "Use sim ou não.";
      continue;
    }
    const campo = CAMPO.get(chave as ChaveDeTexto);
    if (!campo) {
      erros._ = `Campo desconhecido: ${chave}.`;
      continue;
    }
    if (typeof valor !== "string") {
      erros[campo.chave] = "Precisa ser um texto.";
      continue;
    }
    const texto = valor.trim();
    if (!texto && !campo.podeFicarVazio)
      erros[campo.chave] = "Não pode ficar vazio.";
    else if (texto.length > campo.maximo)
      erros[campo.chave] =
        `No máximo ${campo.maximo.toLocaleString("pt-BR")} caracteres.`;
    else if (MARCADOR_DESCONHECIDO.test(texto))
      erros[campo.chave] = `Só o marcador ${MARCADOR_DO_CANDIDATO} é aceito.`;
    else if (!campo.aceitaCandidato && texto.includes(MARCADOR_DO_CANDIDATO))
      erros[campo.chave] =
        `${MARCADOR_DO_CANDIDATO} só na saudação e na abertura.`;
    else if (
      campo.chave === "saudacao" &&
      !texto.includes(MARCADOR_DO_CANDIDATO)
    )
      erros.saudacao = `Inclua ${MARCADOR_DO_CANDIDATO} (o nome do candidato).`;
  }
  return erros;
}

/**
 * Os textos que valem: o padrão com o que o edital salvou por cima. Campo
 * inválido (gravado antes de uma regra nova, ou corrompido) volta ao padrão,
 * para a folha nunca sair quebrada.
 */
export function textosDoModelo(salvos: unknown): TextosDoEspelho {
  const textos: TextosDoEspelho = { ...TEXTOS_PADRAO_DO_ESPELHO };
  if (!salvos || typeof salvos !== "object" || Array.isArray(salvos))
    return textos;
  for (const [chave, valor] of Object.entries(salvos)) {
    if (validarModeloDoEspelho({ [chave]: valor })[chave as ChaveDeTexto])
      continue;
    if (chave === "mostrar_autodeclarada" && typeof valor === "boolean")
      textos.mostrar_autodeclarada = valor;
    else if (CHAVES_DE_TEXTO.has(chave) && typeof valor === "string")
      textos[chave as ChaveDeTexto] = valor.trim();
  }
  return textos;
}

/** Só o que difere do padrão (o que vai ao banco; {} = o padrão). */
export function diferencasDoPadrao(
  textos: TextosDoEspelho,
): Partial<TextosDoEspelho> {
  const diferencas: Record<string, string | boolean> = {};
  for (const campo of CAMPOS_DO_MODELO) {
    const valor = textos[campo.chave].trim();
    if (limpo(valor) !== limpo(TEXTOS_PADRAO_DO_ESPELHO[campo.chave]))
      diferencas[campo.chave] = valor;
  }
  if (
    textos.mostrar_autodeclarada !==
    TEXTOS_PADRAO_DO_ESPELHO.mostrar_autodeclarada
  )
    diferencas.mostrar_autodeclarada = textos.mostrar_autodeclarada;
  return diferencas as Partial<TextosDoEspelho>;
}

export type TrechoDaSaudacao = { texto: string; negrito: boolean };

/** A saudação em trechos: o nome do candidato no lugar de {candidato}, em negrito. */
export function trechosDaSaudacao(
  saudacao: string,
  nome: string,
): TrechoDaSaudacao[] {
  const partes = saudacao.split(MARCADOR_DO_CANDIDATO);
  const trechos: TrechoDaSaudacao[] = [];
  partes.forEach((parte, i) => {
    if (parte) trechos.push({ texto: parte, negrito: false });
    if (i < partes.length - 1) trechos.push({ texto: nome, negrito: true });
  });
  return trechos;
}

/** Um texto com o nome do candidato no lugar de {candidato}. */
export function comOCandidato(texto: string, nome: string): string {
  return texto.split(MARCADOR_DO_CANDIDATO).join(nome);
}

/* ── O que a RPC devolve ───────────────────────────────────────────── */

export type ModeloDoEdital = {
  /** 0 = nunca salvo (vale o padrão). */
  versao: number;
  textos: TextosDoEspelho;
  /** O que o banco tem (só as diferenças). */
  salvos: Partial<TextosDoEspelho>;
  atualizadoEm: string | null;
  atualizadoPor: string | null;
  podeEditar: boolean;
};

export const MODELO_PADRAO_DO_EDITAL: Readonly<ModeloDoEdital> = Object.freeze({
  versao: 0,
  textos: { ...TEXTOS_PADRAO_DO_ESPELHO },
  salvos: {},
  atualizadoEm: null,
  atualizadoPor: null,
  podeEditar: false,
});

/** obter_modelo_espelho_nota / salvar_modelo_espelho_nota → o modelo da tela. */
export function lerModeloDoEdital(resposta: unknown): ModeloDoEdital {
  const r = (resposta && typeof resposta === "object" ? resposta : {}) as {
    versao?: unknown;
    textos?: unknown;
    atualizado_em?: unknown;
    atualizado_por?: unknown;
    pode_editar?: unknown;
  };
  const textos = textosDoModelo(r.textos);
  return {
    versao:
      typeof r.versao === "number" && Number.isSafeInteger(r.versao)
        ? r.versao
        : 0,
    textos,
    salvos: diferencasDoPadrao(textos),
    atualizadoEm: typeof r.atualizado_em === "string" ? r.atualizado_em : null,
    atualizadoPor:
      typeof r.atualizado_por === "string" ? r.atualizado_por : null,
    podeEditar: r.pode_editar === true,
  };
}
