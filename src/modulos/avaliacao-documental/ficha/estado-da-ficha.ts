/*
  Estado da ficha aberta (fase F4), fora do React (useSyncExternalStore). Não
  importa React. A conta e as regras puras estão em
  src/lib/avaliacao-documental/ficha.ts e pontuacao.ts; aqui, a leitura, o
  lançamento em edição, o salvamento automático, a conclusão e a reabertura.

  RPCs (supabase/migrations/20261007130000_conteudo_da_ficha.sql; contrato em
  src/lib/rpc-contrato.js):
    obter_ficha_analise_leve(p_ficha, p_regra_chave)   (20261014231000) a ficha; com a
                                                    chave da configuração da regra que a
                                                    tela já guardou, sem ela (~29 KB a menos
                                                    por ficha). Banco sem ela:
    obter_ficha_analise(p_ficha)
    salvar_rascunho_ficha(p_ficha, p_versao, p_lancamento, p_resultado, p_parecer)
    concluir_ficha(p_ficha, p_versao, p_versao_regra, p_lancamento, p_resultado, p_parecer)
    reabrir_ficha(p_ficha, p_versao, p_motivo, p_complemento)
                                                    (20261021110000) p_motivo é o código
                                                    da lista; banco sem p_complemento: a
                                                    chamada antiga, com o texto legível
    registrar_acesso_ficha(p_ficha, p_tipo)

  A justificativa dos itens (justificativa-dos-itens.ts) acompanha os itens:
  na abertura em edição, preenche o campo vazio do item que precisa (sem
  marcar a ficha como alterada: vai no próximo rascunho ou na conclusão); a
  cada mudança, refaz o texto automático quando o resumo dos itens mudou.

  Salvamento automático: cada mudança agenda um rascunho para ATRASO_MS (10 s)
  depois da última; com mudanças seguidas, o envio sai no máximo
  MAXIMO_SEM_SALVAR_MS (60 s) depois da primeira que ficou pendente (eram 3 e
  15 s: salvar_rascunho_ficha era a função que mais custava ao banco, ~17 mil
  chamadas de 14 a 22/10/2026). Conteúdo igual ao último salvo não vai ao
  banco (marcar e desmarcar volta ao que estava). Fechar,
  trocar de ficha, concluir e esconder a aba (ficha.tsx: visibilitychange e
  pagehide) salvam na hora (salvar()). Uma mudança durante o envio agenda
  outro com a versão nova. "Salvo às HH:MM" só depois de o banco confirmar
  (AM-12.1). Versão velha (conflito de versão: PT409, antes 40001) ou reserva
  perdida (55P03) param a edição e o salvamento automático, com o aviso.
*/
import {
  calcularFicha,
  lancamentoParaGravar,
  conferenciaDaFicha,
  declaradaDaFicha,
  lancamentoInicial,
  pendenciasDaFicha,
  regraDaFicha,
  resumoParaGravar,
} from "../../../lib/avaliacao-documental/ficha.ts";
import { comJustificativasDosItens } from "../../../lib/avaliacao-documental/justificativa-dos-itens.ts";
import {
  funcaoAusente,
  type ChamadaDeRpc,
} from "../../../lib/avaliacao-documental/leitura-por-versao.ts";
import {
  AVISO_DE_FICHA_ALTERADA,
  ehConflitoDeVersao,
} from "../../../lib/conflito-de-versao.ts";
import { mensagemDoBanco } from "../estado.ts";
import type {
  Avaliacao as AvaliacaoDaConta,
  Candidato,
  ConferenciaDaFicha,
  PendenciaDaFicha,
} from "../../../lib/avaliacao-documental/tipos-da-ficha.ts";
import type { ItemDoHistorico } from "./conclusao-da-ficha.tsx";
import type { EstadoDaFicha, Lancamento, LojaDaFicha, Regra } from "./tipos.ts";

/** A ficha em obter_ficha_analise(_leve) → ficha (só o que a loja e a tela leem). */
export type FichaDoBanco = {
  id?: string;
  codigo?: string | number | null;
  nome?: string | null;
  situacao?: string | null;
  versao: number;
  modalidade?: string | null;
  modalidades?: string[] | null;
  cargo?: string | null;
  vaga?: string | null;
  /** O lançamento gravado (rascunho ou concluído; o banco validou a estrutura). */
  lancamento?: Candidato | null;
  rascunho_em?: string | null;
  parecer: string | null;
  tp_resultado: string | null;
  nota_final: number | null;
  concluida_por?: string | null;
};

/** A regra da ficha em obter_ficha_analise(_leve) → regra. */
export type RegraDoBanco = {
  /** md5 da configuração (a leve omite a configuração igual à desta chave). */
  chave?: string;
  versao: number;
  vigente: number;
  situacao?: string | null;
  configuracao: Regra;
};

/** O que obter_ficha_analise(_leve) devolve, no que a loja e a tela leem. */
export type DadosDaFicha = EstadoDaFicha["dados"] & {
  regra: RegraDoBanco;
  ficha: FichaDoBanco;
  /** O documental do edital (pontuacao.ts: notas mínimas e cotas). */
  documental?: unknown;
  pode_editar?: boolean;
  pode_reabrir?: boolean;
  /** Os endereços e anexos da Empregare (anexo-na-empregare.ts lê). */
  empregare?: {
    vaga_interno?: unknown;
    link_candidato?: unknown;
    [chave: string]: unknown;
  } | null;
  historico?: ItemDoHistorico[];
  declarada_gravada?: { art?: number | null; total?: number | null } | null;
  cpf_informado?: unknown;
  edital?: { rotulo?: string | null; area?: string | null } | null;
};

/** A leitura leve: a configuração da regra pode vir omitida (regra_omitida). */
type DadosDaLeitura = DadosDaFicha & { regra_omitida?: boolean };

/**
 * O retrato da conta (calcular): o que muda a cada lançamento. Os tipos da
 * conta (tipos-da-ficha.ts) cabem no recorte dos componentes (tipos.ts).
 */
export type RetratoDaFichaAberta = {
  regra: ReturnType<typeof regraDaFicha>;
  lancamento: Lancamento;
  avaliacao: AvaliacaoDaConta;
  declarada: ReturnType<typeof declaradaDaFicha>;
  pendencias: PendenciaDaFicha[];
  conferencia: ConferenciaDaFicha;
};

type BaseDoEstado = {
  fichaId: string;
  carregando: boolean;
  erro: string;
  versao: number;
  podeEditar: boolean;
  salvando: boolean;
  sujo: boolean;
  salvoEm: string | null;
  aviso: string;
  concluindo: boolean;
};

/** Sem ficha (abrindo ou com erro). */
export type FichaSemDados = BaseDoEstado & {
  dados: null;
  regra: null;
  lancamento: null;
  avaliacao: null;
  declarada: null;
  pendencias: PendenciaDaFicha[];
  conferencia: null;
};

/** A ficha carregada: os dados e o retrato juntos (carregar publica os dois). */
export type FichaComDados = BaseDoEstado &
  RetratoDaFichaAberta & { dados: DadosDaFicha };

/** O estado da loja (obter()): `dados` e `lancamento` separam as duas formas. */
export type EstadoDaFichaAberta = FichaSemDados | FichaComDados;

type MudancaDoEstado = {
  [K in keyof FichaComDados]?: EstadoDaFichaAberta[K];
};

type Toast = (mensagem: string, tipo?: string) => void;
type Temporizador = ReturnType<typeof setTimeout>;

/** O que concluir() devolve. */
export type ResultadoDaConclusao = {
  ok: boolean;
  emAndamento?: boolean;
  erro?: string;
  pendencias?: PendenciaDaFicha[];
  resultado?: unknown;
};

type TipoDeAcesso = Parameters<LojaDaFicha["registrarAcesso"]>[0];

export type OpcoesDaLojaDaFicha = {
  rpc: ChamadaDeRpc;
  toast?: Toast;
  agendar?: (fn: () => void, ms: number) => Temporizador;
  cancelar?: (id: Temporizador) => void;
  atrasoMs?: number;
  maximoSemSalvarMs?: number;
  relogio?: () => number;
  regras?: Map<string, Regra>;
};

const RPC_OBTER = "obter_ficha_analise";
const RPC_OBTER_LEVE = "obter_ficha_analise_leve";
const RPC_SALVAR = "salvar_rascunho_ficha";
const RPC_CONCLUIR = "concluir_ficha";
const RPC_REABRIR = "reabrir_ficha";
const RPC_ACESSO = "registrar_acesso_ficha";

export const ATRASO_MS = 10000;
export const MAXIMO_SEM_SALVAR_MS = 60000;

/*
  As configurações de regra já recebidas, pela chave (md5) que o banco manda
  em regra.chave: uma por versão da regra, iguais em todas as fichas dela.
  Da página inteira (a ficha monta uma loja por abertura).
*/
const REGRAS_DA_PAGINA = new Map<string, Regra>();
const MAXIMO_DE_REGRAS = 8;

/** Lembra a configuração da regra pela chave (as mais antigas saem). */
export function guardarRegra(
  regras: Map<string, Regra>,
  chave: unknown,
  configuracao: Regra | undefined,
): void {
  if (typeof chave !== "string" || !chave || configuracao === undefined) return;
  regras.delete(chave);
  regras.set(chave, structuredClone(configuracao));
  // Acima do máximo, o mapa tem chave: a primeira é a mais antiga.
  while (regras.size > MAXIMO_DE_REGRAS)
    regras.delete(regras.keys().next().value as string);
}

const INICIAL: Readonly<FichaSemDados> = Object.freeze({
  fichaId: "",
  carregando: false,
  erro: "",
  dados: null,
  regra: null,
  lancamento: null,
  avaliacao: null,
  declarada: null,
  pendencias: [],
  conferencia: null,
  versao: 0,
  podeEditar: false,
  salvando: false,
  sujo: false,
  salvoEm: null,
  aviso: "",
  concluindo: false,
});

export function criarEstadoDaFicha(
  {
    rpc,
    toast = (mensagem) => console.info(mensagem),
    agendar = (fn, ms) => setTimeout(fn, ms),
    cancelar = (id) => clearTimeout(id),
    atrasoMs = ATRASO_MS,
    maximoSemSalvarMs = MAXIMO_SEM_SALVAR_MS,
    relogio = () => Date.now(),
    regras = REGRAS_DA_PAGINA,
  }: OpcoesDaLojaDaFicha = {} as OpcoesDaLojaDaFicha,
) {
  let estado: EstadoDaFichaAberta = { ...INICIAL };
  let pedido = 0;
  let temporizador: Temporizador | null = null;
  let mudancas = 0;
  let envio: Promise<boolean> | null = null;
  let pendenteDesde: number | null = null;
  let semLeve = false;
  /* O conteúdo do último rascunho que o banco confirmou (JSON), para não reenviar o mesmo. */
  let ultimoSalvo: string | null = null;

  /*
    A ficha: a leve, com a chave da última regra guardada (o banco omite a
    configuração igual); banco sem ela, a de sempre.
  */
  async function lerFicha(fichaId: string): Promise<DadosDaFicha> {
    if (!semLeve) {
      try {
        const ultima = [...regras.keys()].pop() ?? null;
        let dados = (await rpc(RPC_OBTER_LEVE, {
          p_ficha: fichaId,
          p_regra_chave: ultima,
        })) as DadosDaLeitura | null;
        // Omitida e já sem a cópia (não deveria): pede de novo, com a configuração.
        if (
          dados?.regra_omitida === true &&
          !regras.has(dados.regra?.chave as string)
        )
          dados = (await rpc(RPC_OBTER_LEVE, {
            p_ficha: fichaId,
            p_regra_chave: null,
          })) as DadosDaLeitura | null;
        const regra = dados?.regra;
        if (regra && typeof regra === "object") {
          // Com a regra, há dados (o let não estreita pelo alias).
          if (dados!.regra_omitida === true)
            return {
              ...dados!,
              // Cópia: a ficha não divide o objeto com as outras.
              regra: {
                ...regra,
                // Omitida, a chave está guardada (conferido acima).
                configuracao: structuredClone(
                  regras.get(regra.chave as string),
                ) as Regra,
              },
            };
          guardarRegra(regras, regra.chave, regra.configuracao);
          return dados!;
        }
        if (dados && typeof dados === "object") return dados;
      } catch (erro) {
        if (!funcaoAusente(erro)) throw erro;
        semLeve = true;
      }
    }
    return rpc(RPC_OBTER, { p_ficha: fichaId }) as Promise<DadosDaFicha>;
  }
  const ouvintes = new Set<() => void>();
  // carregar publica os dados com o retrato: a mistura fica numa das duas formas.
  const publicar = (m: MudancaDoEstado) => {
    estado = { ...estado, ...m } as EstadoDaFichaAberta;
    for (const ouvinte of ouvintes) ouvinte();
  };

  /*
    A declarada segue o nível do lançamento (pontos por nível da regra). A
    regra da ficha é a da vaga: a diferença do cargo por cima do nível
    (regra-por-cargo.ts); a tela lê os blocos dela (requisitos, extras, teto).
  */
  function calcular(
    lancamento: Lancamento,
    dados: DadosDaFicha = estado.dados!,
  ): RetratoDaFichaAberta {
    const regra = regraDaFicha(dados.regra.configuracao, lancamento);
    const declarada = declaradaDaFicha(
      regra,
      dados.respostas,
      lancamento?.nivel,
    );
    const avaliacao = calcularFicha(regra, lancamento, dados.documental);
    const pendencias = pendenciasDaFicha(
      regra,
      lancamento,
      avaliacao,
      declarada,
    );
    return {
      regra,
      lancamento,
      avaliacao,
      declarada,
      pendencias,
      conferencia: conferenciaDaFicha(regra, lancamento, avaliacao, pendencias),
    };
  }

  /* O retrato com a justificativa dos itens em dia (recalcula se mudou). */
  function comJustificativas(
    antes: RetratoDaFichaAberta | null,
    retrato: RetratoDaFichaAberta,
    dados: DadosDaFicha = estado.dados!,
  ): RetratoDaFichaAberta {
    const lancamento = comJustificativasDosItens(
      antes,
      retrato,
      dados.leituras,
    );
    return lancamento === retrato.lancamento
      ? retrato
      : calcular(lancamento, dados);
  }

  function pararTemporizador() {
    if (temporizador !== null) cancelar(temporizador);
    temporizador = null;
  }

  /*
    Agenda o rascunho: ATRASO_MS depois da última mudança, mas nunca mais de
    MAXIMO_SEM_SALVAR_MS depois da primeira que ficou pendente.
  */
  function agendarRascunho() {
    const agora = relogio();
    if (pendenteDesde === null) pendenteDesde = agora;
    const espera = Math.max(
      0,
      Math.min(atrasoMs, pendenteDesde + maximoSemSalvarMs - agora),
    );
    pararTemporizador();
    temporizador = agendar(() => {
      temporizador = null;
      void salvar();
    }, espera);
  }

  async function carregar(fichaId: string = estado.fichaId): Promise<boolean> {
    const meu = ++pedido;
    pararTemporizador();
    mudancas = 0;
    pendenteDesde = null;
    ultimoSalvo = null;
    publicar({ ...INICIAL, fichaId, carregando: true });
    try {
      const dados = await lerFicha(fichaId);
      if (meu !== pedido) return false;
      const regra = dados.regra.configuracao;
      const lancamento = lancamentoInicial({
        regra,
        respostas: dados.respostas,
        modalidade: dados.ficha.modalidade,
        modalidades: dados.ficha.modalidades,
        cargo: dados.ficha.cargo,
        vaga: dados.ficha.vaga,
        documental: dados.documental,
        gravado: dados.ficha.lancamento,
        // O lançamento da conta (Candidato, listas readonly) é o que a tela edita
        // numa cópia (mudar: structuredClone): o mesmo objeto, no tipo da tela.
      }) as unknown as Lancamento;
      const podeEditar = Boolean(dados.pode_editar);
      let retrato = calcular(lancamento, dados);
      if (podeEditar) retrato = comJustificativas(null, retrato, dados);
      publicar({
        carregando: false,
        dados,
        versao: dados.ficha.versao,
        podeEditar,
        salvoEm: dados.ficha.rascunho_em || null,
        ...retrato,
      });
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({ carregando: false, erro: mensagemDoBanco(erro) });
      return false;
    }
  }

  /*
    Muda o lançamento (só em edição) e agenda o rascunho. Durante a conclusão,
    nada muda: a mudança iria para um rascunho que a ficha concluída não
    aceita mais e sumiria em silêncio.
  */
  function mudar(transformar: (l: Lancamento) => Lancamento): void {
    if (!estado.podeEditar || !estado.lancamento || estado.concluindo) return;
    const lancamento = transformar(structuredClone(estado.lancamento));
    mudancas += 1;
    publicar({
      ...comJustificativas(estado, calcular(lancamento)),
      sujo: true,
    });
    agendarRascunho();
  }

  function pararEdicao(erro: unknown) {
    pararTemporizador();
    publicar({
      podeEditar: false,
      aviso: ehConflitoDeVersao(erro)
        ? AVISO_DE_FICHA_ALTERADA
        : mensagemDoBanco(erro),
    });
  }

  async function enviarRascunho(): Promise<boolean> {
    const minhas = mudancas;
    // O que mudar a partir daqui conta a espera máxima de novo.
    pendenteDesde = null;
    // Só há rascunho a enviar com a ficha carregada (mudar exige o lançamento).
    const { lancamento, avaliacao, declarada, versao } =
      estado as FichaComDados;
    const conteudo = {
      p_lancamento: lancamentoParaGravar(
        estado.dados!.regra.configuracao,
        lancamento,
      ),
      p_resultado: resumoParaGravar(avaliacao, declarada),
      p_parecer: avaliacao.parecer,
    };
    const assinatura = JSON.stringify(conteudo);
    if (assinatura === ultimoSalvo) {
      publicar({ sujo: mudancas !== minhas });
      return true;
    }
    publicar({ salvando: true });
    try {
      const r = (await rpc(RPC_SALVAR, {
        p_ficha: estado.fichaId,
        p_versao: versao,
        ...conteudo,
      })) as { versao: number; salvo_em: string | null };
      ultimoSalvo = assinatura;
      const nada = mudancas === minhas;
      publicar({
        salvando: false,
        versao: r.versao,
        salvoEm: r.salvo_em,
        sujo: !nada,
        aviso: "",
      });
      return true;
    } catch (erro) {
      publicar({ salvando: false });
      if (
        ehConflitoDeVersao(erro) ||
        (["55P03", "42501"] as unknown[]).includes(
          (erro as { code?: unknown } | null | undefined)?.code,
        )
      )
        pararEdicao(erro);
      else
        publicar({
          aviso: `Não foi possível salvar: ${mensagemDoBanco(erro)}`,
        });
      return false;
    }
  }

  /* Salva agora (Ctrl+S, "Salvar rascunho", antes de fechar e de concluir). */
  async function salvar(): Promise<boolean> {
    pararTemporizador();
    if (!estado.podeEditar) return !estado.sujo;
    while (envio) await envio;
    if (!estado.sujo || !estado.podeEditar) return true;
    envio = enviarRascunho();
    const ok = await envio;
    envio = null;
    if (ok && estado.sujo && estado.podeEditar) return salvar();
    return ok;
  }

  /*
    Conclui; devolve { ok, pendencias, erro } ou { ok: false, emAndamento }
    quando já há uma conclusão em curso (duplo clique, Ctrl+Enter repetido):
    a segunda chamada não vai ao banco (lá daria 40001 e recarregaria a ficha
    com "a ficha mudou" enquanto a primeira concluía).
  */
  async function concluir(): Promise<ResultadoDaConclusao> {
    if (estado.concluindo) return { ok: false, emAndamento: true };
    if (!estado.podeEditar)
      return { ok: false, erro: "Ficha só para leitura." };
    if (estado.pendencias.length)
      return { ok: false, pendencias: estado.pendencias };
    publicar({ concluindo: true });
    if (!(await salvar())) {
      publicar({ concluindo: false });
      return { ok: false, erro: estado.aviso };
    }
    try {
      // Sem pendência e em edição, a ficha está carregada.
      const { lancamento, avaliacao, declarada } = estado as FichaComDados;
      const r = (await rpc(RPC_CONCLUIR, {
        p_ficha: estado.fichaId,
        p_versao: estado.versao,
        p_versao_regra: estado.dados!.regra.versao,
        p_lancamento: lancamentoParaGravar(
          estado.dados!.regra.configuracao,
          lancamento,
        ),
        p_resultado: resumoParaGravar(avaliacao, declarada),
        p_parecer: avaliacao.parecer,
      })) as { versao: number };
      publicar({
        concluindo: false,
        sujo: false,
        podeEditar: false,
        versao: r.versao,
      });
      toast("Ficha concluída.", "success");
      return { ok: true, resultado: r };
    } catch (erro) {
      publicar({ concluindo: false });
      if (ehConflitoDeVersao(erro)) {
        await carregar();
        return {
          ok: false,
          erro: "A regra ou a ficha mudou: a ficha foi recalculada. Confira e conclua de novo.",
        };
      }
      return { ok: false, erro: mensagemDoBanco(erro) };
    }
  }

  /*
    Reabre com o código do motivo da lista e o complemento (20261021110000).
    Banco ainda sem p_complemento (o front vai ao ar antes da migration): a
    chamada dá PGRST202 e repete a antiga, com o motivo legível (`texto`) no
    p_motivo livre. Sai quando a migration estiver aplicada.
  */
  async function reabrir(
    motivo: string,
    complemento: string | null | undefined,
    texto: string,
  ): Promise<{ ok: boolean; erro?: string }> {
    try {
      try {
        await rpc(RPC_REABRIR, {
          p_ficha: estado.fichaId,
          p_versao: estado.versao,
          p_motivo: motivo,
          p_complemento: complemento ?? null,
        });
      } catch (erro) {
        if (!funcaoAusente(erro)) throw erro;
        await rpc(RPC_REABRIR, {
          p_ficha: estado.fichaId,
          p_versao: estado.versao,
          p_motivo: texto,
        });
      }
      toast("Ficha reaberta.", "success");
      await carregar();
      return { ok: true };
    } catch (erro) {
      return { ok: false, erro: mensagemDoBanco(erro) };
    }
  }

  async function registrarAcesso(tipo: TipoDeAcesso): Promise<void> {
    try {
      await rpc(RPC_ACESSO, { p_ficha: estado.fichaId, p_tipo: tipo });
    } catch {
      /* O registro não impede o trabalho; a falha aparece no log do banco. */
    }
  }

  return {
    obter: (): EstadoDaFichaAberta => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    mudar,
    salvar,
    concluir,
    reabrir,
    registrarAcesso,
    temAlteracaoPendente: () => estado.sujo || estado.salvando,
    /*
      A ficha sai da tela (outra ficha, outra área, a fila fechando): a
      alteração pendente vai ao banco agora, antes de a reserva ser liberada.
      Devolve o envio (true = nada ficou para trás).
    */
    descartar(): Promise<boolean> {
      pedido += 1;
      ouvintes.clear();
      const pendente = estado.sujo && estado.podeEditar;
      return salvar().then((ok) => {
        if (!ok && pendente)
          toast("A última alteração da ficha não foi salva.", "error");
        return ok;
      });
    },
  };
}
