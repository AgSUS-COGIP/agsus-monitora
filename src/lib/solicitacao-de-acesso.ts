/*
  Solicitação de acesso (tela de quem entrou com Google e não tem perfil
  ativo), por área: Projetos · Saúde Indígena · SEDE. Aqui ficam as listas
  fixas (áreas, cargos/funções, motivos de recusa), a situação do pedido, o
  que a tela mostra, a validação e os argumentos das RPCs. Sem DOM; o estado
  é de src/app/entrada/pedido-de-acesso.ts e o desenho, de
  src/app/entrada/solicitacao-de-acesso.tsx. A aprovação é de
  Configurações › Acessos (src/modulos/acessos/solicitacoes.tsx).

  O acesso continua SÓ POR APROVAÇÃO: a pessoa pede, um administrador (ou o
  coordenador da coordenação pedida) aprova escolhendo o grupo e as áreas.
  O login continua pelo Google institucional.

  De onde vem cada situação (só dados que o banco expõe):
    - obter_minha_solicitacao_acesso → o pedido mais recente (o pendente
      primeiro) ou null;
    - minha_conta_desativada → true quando a conta existe e está desativada;
    - pedido "aprovado" sem perfil ativo: o acesso saiu depois (desativado).
      Com perfil ativo, é "liberado".

  As listas são as do banco (20261021140000: private."FC_CARGO_SOLICITACAO_ACESSO"
  e private."FC_MOTIVO_RECUSA_SOLICITACAO"); tests/solicitacao-de-acesso-migration
  .test.js compara código, rótulo e áreas.
*/
import {
  motivoPareceTexto,
  textoLimpo,
} from "./avaliacao-documental/qualidade-do-motivo.ts";

const txt = (valor: unknown): string => String(valor ?? "").trim();

// ── Áreas (as abas) ──────────────────────────────────────────────────────────

export type CodigoDaArea = "projetos" | "saude-indigena" | "sede";

export type AreaDaSolicitacao = Readonly<{
  codigo: CodigoDaArea;
  rotulo: string;
  /** Rótulo do campo de unidade/lotação da área. */
  rotuloDaLotacao: string;
  /** "lista": escolha numa lista do banco; "texto": livre. */
  lotacao: "lista" | "texto";
}>;

/** Na ordem das abas. */
export const AREAS_DA_SOLICITACAO: readonly AreaDaSolicitacao[] = Object.freeze(
  [
    Object.freeze({
      codigo: "projetos",
      rotulo: "Projetos",
      rotuloDaLotacao: "Projeto",
      lotacao: "lista",
    }),
    Object.freeze({
      codigo: "saude-indigena",
      rotulo: "Saúde Indígena",
      rotuloDaLotacao: "DSEI ou CASAI",
      lotacao: "lista",
    }),
    Object.freeze({
      codigo: "sede",
      rotulo: "SEDE",
      rotuloDaLotacao: "Setor ou diretoria",
      lotacao: "texto",
    }),
  ],
);

export function areaDaSolicitacao(codigo: unknown): AreaDaSolicitacao | null {
  return AREAS_DA_SOLICITACAO.find((a) => a.codigo === codigo) ?? null;
}

// ── Cargos / funções ─────────────────────────────────────────────────────────

export type CargoDaSolicitacao = Readonly<{
  codigo: string;
  rotulo: string;
  areas: readonly CodigoDaArea[];
  /** O grupo de acesso que o cargo sugere na aprovação (TB_GRUPO_ACESSO). */
  grupo: string;
}>;

const TODAS: readonly CodigoDaArea[] = Object.freeze([
  "projetos",
  "saude-indigena",
  "sede",
]);

const cargo = (
  codigo: string,
  rotulo: string,
  areas: readonly CodigoDaArea[],
  grupo: string,
): CargoDaSolicitacao =>
  Object.freeze({ codigo, rotulo, areas: Object.freeze([...areas]), grupo });

export const CARGO_OUTRO = "OUTRO";

/** A lista do banco, na mesma ordem (o select mostra só os da área). */
export const CARGOS_DA_SOLICITACAO: readonly CargoDaSolicitacao[] =
  Object.freeze([
    cargo(
      "AVALIADOR",
      "Avaliador(a) da análise curricular",
      TODAS,
      "avaliador",
    ),
    cargo("GESTOR", "Gestor(a) de processo seletivo", TODAS, "edital_gestor"),
    cargo("CONTRATACAO", "Contratação e admissão", TODAS, "contratador"),
    cargo(
      "COORDENACAO_DSEI",
      "Coordenação de DSEI ou CASAI",
      ["saude-indigena"],
      "coordenador",
    ),
    cargo(
      "COORDENACAO_PROJETO",
      "Coordenação de projeto",
      ["projetos"],
      "coordenador",
    ),
    cargo(
      "COORDENACAO_SEDE",
      "Coordenação ou diretoria",
      ["sede"],
      "coordenador",
    ),
    cargo("JURIDICO", "Jurídico", ["sede"], "juridico"),
    cargo("APOIO", "Apoio administrativo", TODAS, "usuario"),
    cargo("CONSULTA", "Consulta e acompanhamento", TODAS, "usuario"),
    cargo(CARGO_OUTRO, "Outro", TODAS, "usuario"),
  ]);

export function cargosDaArea(area: unknown): CargoDaSolicitacao[] {
  return CARGOS_DA_SOLICITACAO.filter((c) =>
    c.areas.includes(area as CodigoDaArea),
  );
}

export function cargoDaSolicitacao(codigo: unknown): CargoDaSolicitacao | null {
  return CARGOS_DA_SOLICITACAO.find((c) => c.codigo === codigo) ?? null;
}

/** "Avaliador(a) da análise curricular" ou "Outro: Apoio técnico" ("" sem cargo). */
export function rotuloDoCargo(
  codigo: unknown,
  outro: unknown = "",
  rotuloDoBanco: unknown = "",
): string {
  if (codigo === CARGO_OUTRO && txt(outro)) return `Outro: ${txt(outro)}`;
  return cargoDaSolicitacao(codigo)?.rotulo || txt(rotuloDoBanco);
}

type GrupoPossivel = { codigo: string };

/**
 * O grupo que o cargo pedido sugere, se quem aprova pode atribuí-lo; senão
 * "usuario" (ou o primeiro possível). Pedido de reativação: o grupo de antes.
 */
export function grupoSugeridoDoPedido(
  solicitacao: {
    cargo?: unknown;
    reativacao?: unknown;
    grupo_anterior?: unknown;
  } | null,
  gruposPossiveis: readonly GrupoPossivel[] = [],
): string {
  const existe = (codigo: unknown): codigo is string =>
    typeof codigo === "string" &&
    gruposPossiveis.some((g) => g.codigo === codigo);
  if (solicitacao?.reativacao && existe(solicitacao.grupo_anterior))
    return solicitacao.grupo_anterior;
  const sugerido = cargoDaSolicitacao(solicitacao?.cargo)?.grupo;
  if (existe(sugerido)) return sugerido;
  if (existe("usuario")) return "usuario";
  return gruposPossiveis[0]?.codigo || "";
}

// ── Limites ──────────────────────────────────────────────────────────────────

export const NOME_MINIMO = 2;
export const NOME_MAXIMO = 120;
export const CARGO_OUTRO_MINIMO = 3;
export const CARGO_OUTRO_MAXIMO = 120;
export const LOTACAO_MAXIMA = 200;
export const JUSTIFICATIVA_MINIMA = 20;
export const JUSTIFICATIVA_MAXIMA = 2000;
/** Palavras diferentes que a justificativa pede (a mesma regra do banco). */
export const PALAVRAS_DA_JUSTIFICATIVA = 3;

// ── Situação e tela ──────────────────────────────────────────────────────────

export const SITUACOES = Object.freeze({
  SEM_PEDIDO: "sem_pedido",
  PENDENTE: "pendente",
  RECUSADO: "recusado",
  DESATIVADA: "desativada",
  REATIVACAO_PENDENTE: "reativacao_pendente",
  LIBERADO: "liberado",
});
export type Situacao = (typeof SITUACOES)[keyof typeof SITUACOES];

export const TITULO_DESATIVADA = "Seu acesso ao MONITORA foi desativado.";
export const TEXTO_DESATIVADA =
  "Se acha que é um engano, fale com a equipe responsável pelo MONITORA.";
export const PERGUNTA_DA_REATIVACAO = "Precisa do acesso de novo?";

/** O pedido como obter_minha_solicitacao_acesso devolve. */
export type MinhaSolicitacao = {
  id?: string;
  status?: string | null;
  nome?: string | null;
  setor?: string | null;
  justificativa?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  avaliado_em?: string | null;
  observacao_admin?: string | null;
  coordenacao?: string | null;
  coordenacao_nome?: string | null;
  area?: string | null;
  area_nome?: string | null;
  cargo?: string | null;
  cargo_rotulo?: string | null;
  cargo_outro?: string | null;
  motivo_recusa?: string | null;
};

const FORMATO_DIA_E_MES = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "America/Sao_Paulo",
});

/** "2026-09-29T13:00:00Z" → "29/09" ("" se não for data). */
export function diaEMes(valor: unknown): string {
  if (!valor) return "";
  const data = new Date(String(valor));
  return Number.isNaN(data.getTime()) ? "" : FORMATO_DIA_E_MES.format(data);
}

type DadosDaSituacao = {
  solicitacao?: MinhaSolicitacao | null;
  contaDesativada?: boolean;
  perfilAtivo?: boolean;
};

/**
 * Situação da tela. Desativada vence tudo (um pedido antigo aprovado não diz
 * "aprovado" a quem foi desligado), exceto o pedido pendente da conta
 * desativada: é o de reativação. Cancelado é como não ter pedido.
 */
export function situacaoDaSolicitacao({
  solicitacao = null,
  contaDesativada = false,
  perfilAtivo = false,
}: DadosDaSituacao = {}): Situacao {
  const status = txt(solicitacao?.status).toLowerCase();
  if (contaDesativada)
    return status === "pendente"
      ? SITUACOES.REATIVACAO_PENDENTE
      : SITUACOES.DESATIVADA;
  if (perfilAtivo) return SITUACOES.LIBERADO;
  if (status === "pendente") return SITUACOES.PENDENTE;
  if (status === "recusado") return SITUACOES.RECUSADO;
  if (status === "aprovado") return SITUACOES.DESATIVADA;
  return SITUACOES.SEM_PEDIDO;
}

export type TelaDaSolicitacao = {
  situacao: Situacao;
  tom: "" | "info" | "success" | "warn" | "danger";
  titulo: string;
  texto: string;
  /**
   * "formulario" (abas e campos), "resumo" (o pedido enviado, com Editar e
   * Cancelar) ou "oculto".
   */
  conteudo: "formulario" | "resumo" | "oculto";
  /** O formulário é o de reativação (só nome e justificativa). */
  reativacao: boolean;
  /** "Pedir reativação" aparece (conta desativada, sem pedido aberto). */
  oferecerReativacao: boolean;
  /** "Entrar agora" (acesso liberado). */
  entrar: boolean;
  triste: boolean;
};

const tela = (
  situacao: Situacao,
  parcial: Partial<TelaDaSolicitacao>,
): TelaDaSolicitacao => ({
  situacao,
  tom: "",
  titulo: "",
  texto: "",
  conteudo: "formulario",
  reativacao: false,
  oferecerReativacao: false,
  entrar: false,
  triste: false,
  ...parcial,
});

/** O que a tela mostra em cada situação. */
export function telaDaSolicitacao(
  dados: DadosDaSituacao = {},
): TelaDaSolicitacao {
  const situacao = situacaoDaSolicitacao(dados);
  const req = dados.solicitacao || null;
  if (situacao === SITUACOES.DESATIVADA)
    return tela(situacao, {
      tom: "danger",
      titulo: TITULO_DESATIVADA,
      texto: TEXTO_DESATIVADA,
      conteudo: "oculto",
      oferecerReativacao: true,
      triste: true,
    });
  if (situacao === SITUACOES.REATIVACAO_PENDENTE) {
    const dia = diaEMes(req?.created_at);
    return tela(situacao, {
      tom: "info",
      titulo: "Pedido de reativação enviado",
      texto: `Enviado${dia ? ` em ${dia}` : ""}, aguardando aprovação.`,
      conteudo: "resumo",
      reativacao: true,
    });
  }
  if (situacao === SITUACOES.LIBERADO)
    return tela(situacao, {
      tom: "success",
      titulo: "Acesso liberado",
      texto: "Seu acesso ao MONITORA está liberado.",
      conteudo: "oculto",
      entrar: true,
    });
  if (situacao === SITUACOES.PENDENTE) {
    const dia = diaEMes(req?.created_at);
    return tela(situacao, {
      tom: "info",
      titulo: "Pedido enviado — aguardando aprovação",
      texto: `Enviado${dia ? ` em ${dia}` : ""}. Quando for aprovado, entre de novo com esta conta.`,
      conteudo: "resumo",
    });
  }
  if (situacao === SITUACOES.RECUSADO) {
    const dia = diaEMes(req?.avaliado_em);
    const motivo = txt(req?.observacao_admin);
    return tela(situacao, {
      tom: "warn",
      titulo: `Pedido recusado${dia ? ` em ${dia}` : ""}`,
      texto: `${motivo ? `Motivo: ${motivo}. ` : ""}Você pode corrigir e enviar um novo pedido.`,
    });
  }
  return tela(situacao, {});
}

// ── Formulário ───────────────────────────────────────────────────────────────

export type CamposDaSolicitacao = {
  area: CodigoDaArea;
  nome: string;
  cargo: string;
  cargoOutro: string;
  lotacao: string;
  coordenacao: string;
  justificativa: string;
};

export type ErrosDaSolicitacao = Partial<
  Record<keyof CamposDaSolicitacao, string>
>;

export const AREA_INICIAL: CodigoDaArea = "saude-indigena";

export const CAMPOS_VAZIOS: Readonly<CamposDaSolicitacao> = Object.freeze({
  area: AREA_INICIAL,
  nome: "",
  cargo: "",
  cargoOutro: "",
  lotacao: "",
  coordenacao: "",
  justificativa: "",
});

/** Os campos a partir de um pedido gravado (editar, recusado, cancelado). */
export function camposDoPedido(
  solicitacao: MinhaSolicitacao | null,
  nomeDoGoogle = "",
): CamposDaSolicitacao {
  const area = areaDaSolicitacao(solicitacao?.area)?.codigo ?? AREA_INICIAL;
  const cargoValido = cargosDaArea(area).some(
    (c) => c.codigo === solicitacao?.cargo,
  );
  return {
    area,
    nome: txt(solicitacao?.nome) || txt(nomeDoGoogle),
    cargo: cargoValido ? txt(solicitacao?.cargo) : "",
    cargoOutro: txt(solicitacao?.cargo_outro),
    lotacao: solicitacao?.area ? txt(solicitacao?.setor) : "",
    coordenacao: txt(solicitacao?.coordenacao),
    justificativa: txt(solicitacao?.justificativa),
  };
}

/**
 * Trocar de aba: o que não vale na área nova sai (cargo que ela não tem,
 * lotação e coordenação); nome e justificativa ficam.
 */
export function camposNaArea(
  campos: CamposDaSolicitacao,
  area: CodigoDaArea,
): CamposDaSolicitacao {
  if (campos.area === area) return campos;
  const mantemCargo = cargosDaArea(area).some((c) => c.codigo === campos.cargo);
  return {
    ...campos,
    area,
    cargo: mantemCargo ? campos.cargo : "",
    cargoOutro: mantemCargo ? campos.cargoOutro : "",
    lotacao: "",
    coordenacao: "",
  };
}

/** O erro da justificativa, ou "" quando vale (a mesma regra do banco). */
export function erroDaJustificativa(texto: unknown): string {
  const limpo = textoLimpo(texto);
  if (!limpo) return "Explique por que precisa do acesso.";
  if (limpo.length < JUSTIFICATIVA_MINIMA)
    return `Escreva ao menos ${JUSTIFICATIVA_MINIMA} caracteres (faltam ${JUSTIFICATIVA_MINIMA - limpo.length}).`;
  if (limpo.length > JUSTIFICATIVA_MAXIMA)
    return `Use no máximo ${JUSTIFICATIVA_MAXIMA.toLocaleString("pt-BR")} caracteres.`;
  if (!motivoPareceTexto(limpo, PALAVRAS_DA_JUSTIFICATIVA))
    return `Escreva com pelo menos ${PALAVRAS_DA_JUSTIFICATIVA} palavras: para que você vai usar o MONITORA?`;
  return "";
}

type OpcoesDaValidacao = {
  reativacao?: boolean;
  /** As lotações da lista da área (vazia: a lista não carregou). */
  lotacoes?: readonly string[];
};

/** Erros por campo ({} = válido). */
export function validarSolicitacao(
  campos: Partial<CamposDaSolicitacao> = {},
  { reativacao = false, lotacoes }: OpcoesDaValidacao = {},
): ErrosDaSolicitacao {
  const erros: ErrosDaSolicitacao = {};
  const nome = txt(campos.nome);
  if (nome.length < NOME_MINIMO) erros.nome = "Informe seu nome completo.";
  else if (nome.length > NOME_MAXIMO)
    erros.nome = `Use no máximo ${NOME_MAXIMO} caracteres.`;
  const justificativa = erroDaJustificativa(campos.justificativa);
  if (justificativa) erros.justificativa = justificativa;
  if (reativacao) return erros;

  const area = areaDaSolicitacao(campos.area);
  if (!area) {
    erros.area = "Escolha a área.";
    return erros;
  }
  if (!cargosDaArea(area.codigo).some((c) => c.codigo === campos.cargo))
    erros.cargo = "Escolha o cargo ou a função.";
  else if (campos.cargo === CARGO_OUTRO) {
    const outro = txt(campos.cargoOutro).length;
    if (outro < CARGO_OUTRO_MINIMO || outro > CARGO_OUTRO_MAXIMO)
      erros.cargoOutro = `Descreva o cargo ou a função (${CARGO_OUTRO_MINIMO} a ${CARGO_OUTRO_MAXIMO} caracteres).`;
  }
  const lotacao = txt(campos.lotacao);
  if (!lotacao)
    erros.lotacao =
      area.lotacao === "lista"
        ? `Escolha o ${area.rotuloDaLotacao === "Projeto" ? "projeto" : "DSEI ou a CASAI"}.`
        : "Informe o setor ou a diretoria.";
  else if (lotacao.length > LOTACAO_MAXIMA)
    erros.lotacao = `Use no máximo ${LOTACAO_MAXIMA} caracteres.`;
  else if (area.lotacao === "lista" && lotacoes && !lotacoes.includes(lotacao))
    erros.lotacao = "Escolha uma opção da lista.";
  return erros;
}

/** Os argumentos de registrar_solicitacao_acesso. */
export function argumentosDaSolicitacao(
  campos: CamposDaSolicitacao,
  { reativacao = false }: { reativacao?: boolean } = {},
) {
  const comArea = !reativacao;
  return {
    p_nome: txt(campos.nome),
    p_area: comArea ? campos.area : null,
    p_cargo: comArea ? txt(campos.cargo) || null : null,
    p_cargo_outro:
      comArea && campos.cargo === CARGO_OUTRO
        ? txt(campos.cargoOutro) || null
        : null,
    p_lotacao: comArea ? txt(campos.lotacao) || null : null,
    p_justificativa: txt(campos.justificativa) || null,
    p_coordenacao: txt(campos.coordenacao) || null,
  };
}

/**
 * As linhas do resumo do pedido enviado ("Área", "Cargo ou função"…), só as
 * que têm valor.
 */
export function resumoDoPedido(
  solicitacao: MinhaSolicitacao | null,
): { rotulo: string; valor: string }[] {
  if (!solicitacao) return [];
  const area = areaDaSolicitacao(solicitacao.area);
  const linhas = [
    { rotulo: "Nome", valor: txt(solicitacao.nome) },
    {
      rotulo: "Área",
      valor: area?.rotulo || txt(solicitacao.area_nome),
    },
    {
      rotulo: "Cargo ou função",
      valor: rotuloDoCargo(
        solicitacao.cargo,
        solicitacao.cargo_outro,
        solicitacao.cargo_rotulo,
      ),
    },
    {
      rotulo: area?.rotuloDaLotacao || "Unidade ou lotação",
      valor: txt(solicitacao.setor),
    },
    { rotulo: "Coordenação", valor: txt(solicitacao.coordenacao_nome) },
    { rotulo: "Justificativa", valor: txt(solicitacao.justificativa) },
  ];
  return linhas.filter((l) => l.valor);
}

// ── Recusa (quem aprova) ─────────────────────────────────────────────────────

export type MotivoDeRecusa = Readonly<{ codigo: string; rotulo: string }>;

export const MOTIVO_DE_RECUSA_OUTRO = "OUTRO";

export const MOTIVOS_DE_RECUSA: readonly MotivoDeRecusa[] = Object.freeze(
  [
    ["FORA_DO_PUBLICO", "Não faz parte do público do MONITORA"],
    ["VINCULO_NAO_CONFIRMADO", "Vínculo com a área não confirmado"],
    ["AREA_OU_LOTACAO", "Área ou lotação não confere"],
    ["JA_TEM_ACESSO", "Já tem acesso por outra conta"],
    ["JUSTIFICATIVA_INSUFICIENTE", "Justificativa insuficiente"],
    [MOTIVO_DE_RECUSA_OUTRO, "Outro"],
  ].map(
    ([codigo, rotulo]) => Object.freeze({ codigo, rotulo }) as MotivoDeRecusa,
  ),
);

/** Limites do complemento da recusa (os do banco). */
export const COMPLEMENTO_DA_RECUSA = Object.freeze({
  maximo: 500,
  minimoDoOutro: 15,
  palavrasDoOutro: 3,
});

export type RecusaValida = {
  ok: true;
  argumentos: { p_motivo: string; p_complemento: string | null };
  /** O texto que a pessoa vai ler (o mesmo que o banco grava). */
  texto: string;
};
export type RecusaInvalida = {
  ok: false;
  campo: "motivo" | "complemento";
  erro: string;
};

/** Confere a recusa como o banco confere (recusar_solicitacao_acesso). */
export function validarRecusa({
  motivo,
  complemento,
}: {
  motivo?: unknown;
  complemento?: unknown;
}): RecusaValida | RecusaInvalida {
  const item = MOTIVOS_DE_RECUSA.find((m) => m.codigo === motivo);
  if (!item)
    return { ok: false, campo: "motivo", erro: "Escolha o motivo da recusa." };
  const texto = textoLimpo(complemento);
  const { maximo, minimoDoOutro, palavrasDoOutro } = COMPLEMENTO_DA_RECUSA;
  if (item.codigo === MOTIVO_DE_RECUSA_OUTRO) {
    if (
      texto.length < minimoDoOutro ||
      texto.length > maximo ||
      !motivoPareceTexto(texto, palavrasDoOutro)
    )
      return {
        ok: false,
        campo: "complemento",
        erro: `Descreva o motivo: de ${minimoDoOutro} a ${maximo} caracteres, com pelo menos ${palavrasDoOutro} palavras.`,
      };
    return {
      ok: true,
      argumentos: { p_motivo: item.codigo, p_complemento: texto },
      texto,
    };
  }
  if (texto && (texto.length > maximo || !motivoPareceTexto(texto, 1)))
    return {
      ok: false,
      campo: "complemento",
      erro: `O complemento precisa ser um texto de até ${maximo} caracteres.`,
    };
  return {
    ok: true,
    argumentos: { p_motivo: item.codigo, p_complemento: texto || null },
    texto: texto ? `${item.rotulo} — ${texto}` : item.rotulo,
  };
}
