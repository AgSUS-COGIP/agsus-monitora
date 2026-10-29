/*
  Estado da aba Triagem, fora do React (useSyncExternalStore). Não
  importa React. A conta é do job Python (scripts/pre_classificacao/); aqui só
  a leitura, o pedido de recálculo, o registro das listas e a exportação.

  RPCs (supabase/migrations/20261006110000_pre_classificacao_e_lote.sql;
  contrato em src/lib/rpc-contrato.js):
    A triagem em partes (20261029120000), cada uma lida quando a
    parte da tela abre (garantirParte):
    obter_resumo_pre_classificacao(p_edital)          a abertura (~35 KB no 114/2026): edital,
                                                      regra, execução, totais, congeladas e a
                                                      trava das inscrições
    obter_vagas_pre_classificacao(p_edital)           parte "vagas": o resumo por vaga
    obter_listas_pre_classificacao(p_edital)          parte "listas": listas registradas e lotes
    listar_pre_classificacao(p_edital, p_vaga, p_grupo, p_busca, p_apos, p_limite)
                                                      as linhas, 50 por vez (listar)
    conferir_eliminados_pre_classificacao(p_edital, p_chaves)
                                                      a situação de agora dos comunicados
                                                      marcados (conferirEliminados)
    O resumo, o cartão "Inscrições" e as partes já pedidas saem juntos (em
    paralelo). Banco sem elas (antes de 20261029120000), a leitura inteira:
    obter_pre_classificacao_se_mudou(p_edital, p_versao)
                                                      (20261014230000) o resultado gravado,
                                                      por versão: os inscritos em colunas e,
                                                      quando nada mudou, só { inalterado }
                                                      (src/lib/avaliacao-documental/
                                                      leitura-por-versao.ts; a cópia fica no
                                                      navegador). Banco sem ela:
    obter_pre_classificacao(p_edital)                 o resultado inteiro, como antes
    obter_situacao_pre_classificacao(p_edital)        (20261014230000) só a execução: o
                                                      acompanhamento do Recalcular
    obter_acompanhamento_inscricoes(p_edital)         (20261009140000) os retratos diários
                                                      das inscrições, para o cartão
                                                      "Inscrições" (falha não impede a aba)
    registrar_lista_pre_classificacao(p_edital, p_tipo, p_lote)
                                                      PROVISORIA ou LOTE
    publicar_lista_classificacao(p_lista)             marca a lista como publicada
    descongelar_declarada_pre_classificacao(p_edital, p_motivo, p_vaga)
                                                      (20261007170000) descongela a
                                                      nota declarada; depois, Recalcular
    incluir_no_lote_por_decisao / revogar_decisao_lote  (20261007200000, decisao-no-banco.ts)
                                                      a coordenação inclui no lote por
                                                      decisão ou revoga, com motivo
  "Recalcular": disparar_robo('pre_classificacao', { editais: [edital] })
  (o banco confere se quem clicou coordena o edital e pede o job ao GitHub
  com a chave do Vault, 20261008140000); situacao_do_disparo_robo diz, em
  poucos segundos, se o GitHub recusou ou se a chave falta ou expirou. O
  resultado do pedido fica na aba (`aviso`): o erro, com o botão de volta; ou
  "pedido", e a aba acompanha a execução (em_andamento e ultima_execucao de
  obter_situacao_pre_classificacao, ~0,4 KB a cada 15 s) e relê o resultado
  só quando ela termina. As releituras depois de uma gravação (decisão,
  lista) não relêem o cartão "Inscrições".
  O documento das listas sai do gerador da Classificação
  (src/lib/classificacao/documento-sei.ts e documento-docx.js).
*/
import {
  documentoOficial,
  htmlParaSei,
  paginaDaPrevia,
  textoParaSei,
} from "../../lib/classificacao/documento-sei.ts";
import { gerarDocxOficial } from "../../lib/classificacao/documento-docx.ts";
import { ehEditalDeTreinamento } from "../../lib/edital-de-treinamento.ts";
import { nomeDoArquivo } from "../../lib/classificacao/exportacao.ts";
import { CABECALHO_PADRAO } from "../../lib/cabecalho-dos-documentos.ts";
import { MIME_DOCX } from "../../lib/documento-da-resposta.ts";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede";
import { LOGO_PADRAO_DA_BARRA } from "../../lib/marca-da-barra-lateral.ts";
import {
  inputsDoPedido,
  mensagemDoErroDoDisparo,
  roboDeCarga,
  RPC_DISPARAR_ROBO,
  RPC_SITUACAO_DO_DISPARO,
  situacaoDoPedido,
} from "../../lib/robos-de-carga.ts";
import { baixarNoNavegador } from "../classificacao/estado.ts";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
  logoEmPng,
} from "../classificacao/documento-no-navegador.ts";
import { criarCopiasPorVersao } from "../../app/copias-por-versao.ts";
import {
  criarLeituraPorVersao,
  funcaoAusente,
} from "../../lib/avaliacao-documental/leitura-por-versao.ts";
import {
  argumentosDaPagina,
  contarPorVaga,
  motivosDasLinhas,
  linhasDaPreInteira,
  paginaDaResposta,
  resumoDaPreInteira,
  RPC_CONFERIR_ELIMINADOS,
  RPC_LISTAS_DA_PRE,
  RPC_PAGINA_DA_PRE,
  RPC_RESUMO_DA_PRE,
  RPC_VAGAS_DA_PRE,
} from "../../lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import type {
  PaginaDaPre,
  RecorteDaPre,
} from "../../lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import { RPC_OBTER_CONGELAMENTO } from "../../lib/avaliacao-documental/trava-das-inscricoes.ts";
import type { ParteDaPre } from "./tipos-da-pre-classificacao.ts";
import { decidirNoLote } from "./decisao-no-banco.ts";
import { mensagemDoBanco } from "./estado.ts";
import type { DadosDoAcompanhamento } from "../../lib/avaliacao-documental/acompanhamento-das-inscricoes.ts";
import type {
  CandidatoParaDecidir,
  DadosDaPreClassificacao,
  ExecucaoDaPre,
  ListaRegistradaDaPre,
  MetaDaLista,
  OpcoesDaPreClassificacao,
  RetratoDaPre,
  SituacaoDaPre,
  SnapshotDaPreClassificacao,
  TipoDaListaDaPre,
} from "./tipos-da-pre-classificacao.ts";

type Mudancas = Partial<SnapshotDaPreClassificacao>;
type Publicar = (mudancas: Mudancas) => void;
/** O que incluirPorDecisao e revogarDecisao devolvem. */
export type ResultadoDaDecisao =
  { ok: true; quantidade: number } | { ok: false; erro: string };

/** O erro do banco (PostgREST) com o código. */
type ErroComCodigo = { code?: unknown } | null | undefined;

const RPC_OBTER_PRE_CLASSIFICACAO = "obter_pre_classificacao";
const RPC_OBTER_PRE_SE_MUDOU = "obter_pre_classificacao_se_mudou";
const RPC_SITUACAO_PRE = "obter_situacao_pre_classificacao";
const RPC_OBTER_INSCRICOES = "obter_acompanhamento_inscricoes";
const RPC_REGISTRAR_LISTA = "registrar_lista_pre_classificacao";
const RPC_PUBLICAR_LISTA = "publicar_lista_classificacao";
const RPC_DESCONGELAR = "descongelar_declarada_pre_classificacao";
const TEMPO_LIMITE_MS = 45000;
/* O GitHub responde ao banco em 1 ou 2 s: quando conferir se aceitou o pedido. */
const ESPERA_DA_RESPOSTA_MS = 3000;
/* O job leva de segundos a poucos minutos: a aba relê neste intervalo até
   a execução terminar, no máximo pelo tempo limite do workflow. */
const INTERVALO_DO_ACOMPANHAMENTO_MS = 15000;
/* Voltar à aba não relê se a leitura é recente (com a versão, a releitura que nada mudou é ~70 bytes). */
const VALIDADE_DA_LEITURA_MS = 5 * 60 * 1000;
const LIMITE_DO_ACOMPANHAMENTO_MS =
  (roboDeCarga("pre_classificacao")?.limiteMin ?? 20) * 60000;

const INICIAL: Readonly<SnapshotDaPreClassificacao> = Object.freeze({
  editalId: "",
  dados: null,
  inscricoes: null,
  congelamento: undefined,
  partes: Object.freeze({ vagas: false, listas: false }),
  carregando: false,
  erro: "",
  pedidoEm: null,
  aviso: null,
  registrando: "",
  registradas: {},
});

const hora = (data: Date) =>
  data.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

export function chaveDaLista(
  tipo: TipoDaListaDaPre | string,
  lote: number | null = null,
): string {
  return lote ? `${tipo}:${lote}` : tipo;
}

export function criarEstadoDaPreClassificacao({
  supabase = null,
  toast = (mensagem: string) => console.info(mensagem),
  agendar = (fn: () => void, ms: number) => setTimeout(fn, ms),
  agora = () => new Date(),
  baixar = baixarNoNavegador,
  copiar = copiarParaAreaDeTransferencia,
  imprimir = imprimirPagina,
  carregarLogo = logoEmPng,
  cabecalho = () => CABECALHO_PADRAO,
  tempoLimiteMs = TEMPO_LIMITE_MS,
  copias = criarCopiasPorVersao(supabase, RPC_OBTER_PRE_SE_MUDOU),
}: OpcoesDaPreClassificacao = {}) {
  let estado: SnapshotDaPreClassificacao = INICIAL;
  const leitura = criarLeituraPorVersao({
    nova: RPC_OBTER_PRE_SE_MUDOU,
    antiga: RPC_OBTER_PRE_CLASSIFICACAO,
    copias,
  });
  let semSituacao = false;
  // Banco sem o resumo e as páginas (antes de 20261029120000): lê tudo, como antes.
  let semPaginas = false;
  // A leitura inteira (só nesse banco), de onde saem o resumo e as páginas.
  let inteira: {
    editalId: string;
    dados: DadosDaPreClassificacao | null;
  } | null = null;
  let emCurso: { editalId: string; promessa: Promise<boolean> } | null = null;
  let lendoInteira: {
    editalId: string;
    promessa: Promise<DadosDaPreClassificacao | null>;
  } | null = null;
  // As partes que a tela já abriu: "Atualizar" e as releituras as trazem de novo.
  const partesPedidas = new Set<ParteDaPre>();
  let pedido = 0;
  let lidoEm = 0;
  let chaveLida = "";
  let acompanhamento = 0;
  const ouvintes = new Set<() => void>();
  const publicar: Publicar = (mudancas) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function rpc(
    nome: string,
    argumentos: Record<string, unknown>,
  ): Promise<unknown> {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /* A leitura inteira (banco antigo), uma por vez por edital. */
  function lerInteira(
    editalId: string,
  ): Promise<DadosDaPreClassificacao | null> {
    if (lendoInteira?.editalId === editalId) return lendoInteira.promessa;
    const promessa = (
      leitura.ler(
        rpc,
        { p_edital: editalId },
        editalId,
      ) as Promise<DadosDaPreClassificacao | null>
    )
      .then((dados) => {
        inteira = { editalId, dados };
        return dados;
      })
      .finally(() => {
        if (lendoInteira?.promessa === promessa) lendoInteira = null;
      });
    lendoInteira = { editalId, promessa };
    return promessa;
  }

  /* Uma parte nova; banco sem ela, tirada da leitura inteira (já resumida). */
  async function lerParte(
    nome: string,
    editalId: string,
  ): Promise<DadosDaPreClassificacao | null> {
    if (!semPaginas) {
      try {
        return (await rpc(nome, {
          p_edital: editalId,
        })) as DadosDaPreClassificacao | null;
      } catch (erro) {
        if (!funcaoAusente(erro)) throw erro;
        semPaginas = true;
      }
    }
    // Leituras ao mesmo tempo (o resumo e as partes) dividem a mesma; com a
    // versão, reler o que não mudou custa ~70 bytes.
    const dados = await lerInteira(editalId);
    return dados ? resumoDaPreInteira(dados) : null;
  }

  /* O que cada parte põe nos dados da aba. */
  function daParte(
    parte: ParteDaPre,
    r: DadosDaPreClassificacao | null,
  ): Partial<DadosDaPreClassificacao> {
    if (parte === "vagas") return { vagas: r?.vagas ?? [] };
    return {
      listas: r?.listas ?? [],
      lotes: r?.lotes ?? [],
      regra_classificacao: r?.regra_classificacao ?? null,
    };
  }
  const RPC_DA_PARTE: Record<ParteDaPre, string> = {
    vagas: RPC_VAGAS_DA_PRE,
    listas: RPC_LISTAS_DA_PRE,
  };

  /*
    Garante uma parte da aba ("vagas" ou "listas"), lida só quando a parte
    abre na tela (uma aba de cada vez). Já lida para o edital: não relê.
  */
  async function garantirParte(parte: ParteDaPre): Promise<boolean> {
    partesPedidas.add(parte);
    if (emCurso) await emCurso.promessa;
    const editalId = estado.editalId;
    if (!editalId || !estado.dados) return false;
    if (estado.partes[parte]) return true;
    try {
      const r = await lerParte(RPC_DA_PARTE[parte], editalId);
      if (editalId !== estado.editalId || !estado.dados) return false;
      publicar({
        dados: { ...estado.dados, ...daParte(parte, r) },
        partes: { ...estado.partes, [parte]: true },
      });
      return true;
    } catch (erro) {
      if (editalId === estado.editalId)
        publicar({ erro: mensagemDoBanco(erro) });
      return false;
    }
  }

  /*
    As partes que a tela vai mostrar, avisadas antes da leitura: saem junto
    com o resumo (em paralelo), e não depois dele.
  */
  function pedirPartes(partes: readonly ParteDaPre[]) {
    for (const parte of partes) partesPedidas.add(parte);
  }

  /*
    Os comunicados de eliminação (um ou em lote): a situação de agora só dos
    marcados (chaves "vaga|código") e o cargo das vagas deles. Banco sem a RPC:
    a leitura inteira, como antes.
  */
  async function conferirEliminados(chaves: readonly string[]): Promise<{
    candidatos: NonNullable<DadosDaPreClassificacao["candidatos"]>;
    vagas: DadosDaPreClassificacao["vagas"];
  }> {
    const editalId = estado.editalId;
    if (!editalId) throw new Error("Escolha o edital.");
    if (!semPaginas) {
      try {
        const r = (await rpc(RPC_CONFERIR_ELIMINADOS, {
          p_edital: editalId,
          p_chaves: [...chaves],
        })) as Partial<DadosDaPreClassificacao> | null;
        return { candidatos: r?.candidatos ?? [], vagas: r?.vagas ?? [] };
      } catch (erro) {
        if (!funcaoAusente(erro)) throw erro;
        semPaginas = true;
      }
    }
    const atual = (await rpc(RPC_OBTER_PRE_CLASSIFICACAO, {
      p_edital: editalId,
    })) as DadosDaPreClassificacao | null;
    if (!atual || atual.edital?.id !== editalId)
      throw new Error("Não foi possível confirmar o edital.");
    return { candidatos: atual.candidatos ?? [], vagas: atual.vagas ?? [] };
  }

  /*
    Uma página de uma lista da aba (50 por vez): as linhas de uma vaga num
    grupo (CLASSIFICADOS, ELIMINADOS, PODE_INCLUIR) ou, sem vaga, a busca no
    edital todo. Banco sem a RPC: a página sai da leitura inteira, na mesma
    ordem (o cursor vira o deslocamento).
  */
  async function listar(
    recorte: RecorteDaPre,
    apos: unknown = null,
    limite = 50,
  ): Promise<PaginaDaPre> {
    const editalId = estado.editalId;
    if (!editalId) throw new Error("Escolha o edital.");
    if (!semPaginas) {
      try {
        return paginaDaResposta(
          await rpc(
            RPC_PAGINA_DA_PRE,
            argumentosDaPagina(editalId, recorte, apos, limite),
          ),
        );
      } catch (erro) {
        if (!funcaoAusente(erro)) throw erro;
        semPaginas = true;
      }
    }
    const dados =
      inteira?.editalId === editalId
        ? inteira.dados
        : await lerInteira(editalId);
    const todos = linhasDaPreInteira(dados, recorte);
    const inicio = Number.isInteger(apos) ? (apos as number) : 0;
    const fim = inicio + limite;
    return {
      linhas: todos.slice(inicio, fim),
      proximo: fim < todos.length ? fim : null,
      total: todos.length,
      porVaga: recorte.vaga === null ? contarPorVaga(todos) : {},
      porMotivo:
        recorte.grupo === "ELIMINADOS"
          ? motivosDasLinhas(
              linhasDaPreInteira(dados, { ...recorte, motivo: "" }),
            )
          : [],
    };
  }

  /* Todas as linhas de um recorte (ex.: quem pode entrar por decisão numa vaga), página a página. */
  async function listarTudo(
    recorte: RecorteDaPre,
  ): Promise<PaginaDaPre["linhas"]> {
    const linhas: PaginaDaPre["linhas"] = [];
    let apos: unknown = null;
    for (let pagina = 0; pagina < 100; pagina += 1) {
      const r = await listar(recorte, apos, 500);
      linhas.push(...r.linhas);
      apos = r.proximo;
      if (apos === null || apos === undefined) return linhas;
    }
    throw new Error("A lista não terminou de carregar.");
  }

  /*
    Lê o resultado gravado do edital (troca de edital recomeça do zero): o
    resumo, o cartão "Inscrições" e a trava das inscrições, juntos. As
    releituras depois de uma gravação passam { inscricoes: false }: o cartão
    "Inscrições" (retratos diários) e a trava não mudam com elas.
  */
  async function carregar(
    editalId: string = estado.editalId,
    { inscricoes: lerInscricoes = true }: { inscricoes?: boolean } = {},
  ): Promise<boolean> {
    const meu = ++pedido;
    if (!editalId) {
      publicar({ ...INICIAL });
      return false;
    }
    publicar(
      editalId !== estado.editalId
        ? { ...INICIAL, editalId, carregando: true }
        : { carregando: true, erro: "" },
    );
    try {
      const releitura =
        !lerInscricoes && editalId === estado.editalId && estado.inscricoes;
      const partes = [...partesPedidas];
      const [resumo, inscricoes, ...lidas] = await Promise.all([
        lerParte(RPC_RESUMO_DA_PRE, editalId),
        // O cartão "Inscrições" é extra: banco sem a migration ou falha = sem cartão.
        releitura
          ? estado.inscricoes
          : rpc(RPC_OBTER_INSCRICOES, { p_edital: editalId }).catch(() => null),
        ...partes.map((parte) => lerParte(RPC_DA_PARTE[parte], editalId)),
      ]);
      if (meu !== pedido) return false;
      // A trava vem no resumo; banco antigo, na RPC dela (falha = sem cartão).
      const congelamento =
        resumo && "congelamento" in resumo
          ? resumo.congelamento
          : releitura
            ? estado.congelamento
            : await rpc(RPC_OBTER_CONGELAMENTO, { p_edital: editalId }).catch(
                () => null,
              );
      if (meu !== pedido) return false;
      lidoEm = agora().getTime();
      // Os payloads validados no banco: o resumo e as partes abertas.
      let dados: DadosDaPreClassificacao | null = resumo
        ? { ...resumo, vagas: resumo.vagas ?? [], listas: resumo.listas ?? [] }
        : null;
      const lidasAgora = { vagas: false, listas: false };
      partes.forEach((parte, i) => {
        lidasAgora[parte] = true;
        if (dados) dados = { ...dados, ...daParte(parte, lidas[i] ?? null) };
      });
      publicar({
        dados,
        inscricoes: inscricoes as DadosDoAcompanhamento | null,
        congelamento,
        partes: lidasAgora,
        carregando: false,
        erro: "",
      });
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({ carregando: false, erro: mensagemDoBanco(erro) });
      return false;
    }
  }

  /*
    Ao abrir a aba: relê só com outro edital, outra chave (a versão da regra)
    ou leitura com mais de 5 minutos. A tela pede a leitura assim que o edital
    é escolhido (sem chave), junto com a regra; a aba, ao montar, passa a
    versão da regra: se é a que veio no resumo, não relê. Leitura do mesmo
    edital já em curso é reaproveitada. "Atualizar" e o acompanhamento do
    recálculo chamam carregar e sempre relêem.
  */
  async function garantirCarregado(
    editalId: string,
    chave = "",
  ): Promise<boolean> {
    if (emCurso?.editalId === editalId) {
      if (chave) chaveLida = chave;
      return emCurso.promessa;
    }
    const daLeitura = String(estado.dados?.regra?.versao ?? 0);
    const recente =
      Boolean(estado.dados) &&
      !estado.erro &&
      estado.editalId === editalId &&
      (!chave || chave === chaveLida || chave === daLeitura) &&
      agora().getTime() - lidoEm < VALIDADE_DA_LEITURA_MS;
    if (chave) chaveLida = chave;
    if (recente) return true;
    const promessa = carregar(editalId).finally(() => {
      if (emCurso?.promessa === promessa) emCurso = null;
    });
    emCurso = { editalId, promessa };
    return promessa;
  }

  /* "Recalcular": pede o job da triagem só deste edital. */
  async function recalcular(): Promise<boolean> {
    const editalId = estado.editalId;
    if (!editalId) return false;
    const antes = estado.dados?.ultima_execucao?.id ?? null;
    const em = agora();
    acompanhamento += 1;
    const doEdital: Publicar = (mudancas) => {
      if (estado.editalId === editalId) publicar(mudancas);
    };
    publicar({
      pedidoEm: em,
      aviso: { tom: "info", texto: "Pedindo o recálculo…" },
    });
    let disparo: unknown;
    try {
      disparo = await rpc(RPC_DISPARAR_ROBO, {
        p_robo: "pre_classificacao",
        p_inputs: inputsDoPedido({ edital: editalId }),
      });
    } catch (erro) {
      if ((erro as ErroComCodigo)?.code === "55006") {
        const texto = `${mensagemDoErroDoDisparo(erro)} A lista atualiza sozinha quando terminar.`;
        doEdital({ aviso: { tom: "info", texto } });
        toast(texto, "info");
        acompanhar(editalId, antes, em);
        return false;
      }
      return recusado(
        doEdital,
        (erro as ErroComCodigo)?.code
          ? mensagemDoErroDoDisparo(erro, "Não foi possível pedir o recálculo.")
          : mensagemDeFalha(erro),
      );
    }
    const texto = `Recálculo pedido às ${hora(em)}. A lista atualiza sozinha quando terminar.`;
    doEdital({ aviso: { tom: "info", texto } });
    toast(texto, "success");
    agendar(
      () => void conferirDisparo(editalId, disparo),
      ESPERA_DA_RESPOSTA_MS,
    );
    acompanhar(editalId, antes, em);
    return true;
  }

  /* O GitHub aceitou? Se recusou (ou falta a chave), a aba diz o que fazer. */
  async function conferirDisparo(
    editalId: string,
    disparo: unknown,
  ): Promise<void> {
    if (!supabase || disparo === null || disparo === undefined) return;
    let situacao: ReturnType<typeof situacaoDoPedido>;
    try {
      situacao = situacaoDoPedido(
        await rpc(RPC_SITUACAO_DO_DISPARO, { p_disparo: disparo }),
      );
    } catch {
      return;
    }
    if (!situacao.aviso || estado.editalId !== editalId) return;
    acompanhamento += 1;
    recusado((mudancas) => publicar(mudancas), situacao.aviso.texto);
  }

  /*
    "Descongelar e recalcular" (coordenação): apaga a nota declarada congelada
    do edital, com o motivo no histórico, e pede o recálculo, que congela de
    novo com as respostas de agora.
  */
  async function descongelar(
    motivo: string | null | undefined,
  ): Promise<boolean> {
    const editalId = estado.editalId;
    if (!editalId) return false;
    let r: { descongeladas?: unknown } | null | undefined;
    try {
      r = (await rpc(RPC_DESCONGELAR, {
        p_edital: editalId,
        p_motivo: String(motivo ?? "").trim(),
        p_vaga: null,
      })) as { descongeladas?: unknown } | null | undefined;
    } catch (erro) {
      toast(`Não foi possível descongelar: ${mensagemDoBanco(erro)}`, "error");
      return false;
    }
    const n = Number(r?.descongeladas) || 0;
    toast(
      `${n} ${n === 1 ? "nota declarada descongelada" : "notas declaradas descongeladas"}.`,
      "success",
    );
    if (estado.editalId === editalId) await recalcular();
    return true;
  }

  /*
    "Incluir por decisão da coordenação" e "Revogar decisão": candidatos
    [{ codigo, vaga }] e o motivo. O banco põe (ou tira) do lote na hora e
    abre (ou tira do lote) a ficha; a aba relê. Devolve { ok, erro }.
  */
  async function decidir(
    acao: "incluir" | "revogar",
    candidatos: readonly CandidatoParaDecidir[],
    motivo: string,
  ): Promise<ResultadoDaDecisao> {
    const editalId = estado.editalId;
    if (!editalId) return { ok: false, erro: "Escolha o edital." };
    try {
      const r = await decidirNoLote(rpc, acao, editalId, candidatos, motivo);
      toast(r.texto, "success");
      if (estado.editalId === editalId)
        await carregar(editalId, { inscricoes: false });
      return { ok: true, quantidade: r.quantidade };
    } catch (erro) {
      return { ok: false, erro: mensagemDoBanco(erro) };
    }
  }

  function recusado(doEdital: Publicar, motivo: string): false {
    const texto = `Recálculo não pedido: ${motivo}`;
    doEdital({ pedidoEm: null, aviso: { tom: "danger", texto } });
    toast(texto, "error");
    return false;
  }

  /*
    A situação da execução: a RPC leve (~0,4 KB), que a aba mostra na hora
    (em_andamento e ultima_execucao nos dados); banco sem ela, relê o
    resultado inteiro, como antes. null = falhou (tenta na próxima volta).
  */
  async function situacaoDaExecucao(
    editalId: string,
  ): Promise<SituacaoDaPre | null> {
    if (!semSituacao) {
      try {
        const s = (await rpc(RPC_SITUACAO_PRE, {
          p_edital: editalId,
        })) as SituacaoDaPre | null;
        if (s && typeof s === "object") {
          if (estado.editalId === editalId && estado.dados)
            publicar({
              dados: {
                ...estado.dados,
                em_andamento: Boolean(s.em_andamento),
                ultima_execucao: s.ultima_execucao ?? null,
              },
            });
          return s;
        }
      } catch (erro) {
        if (!funcaoAusente(erro)) return null;
        semSituacao = true;
      }
    }
    return (await carregar(editalId, { inscricoes: false }))
      ? estado.dados
      : null;
  }

  /*
    Acompanha até a execução pedida terminar: sem execução em andamento e com
    uma última execução diferente da que havia no clique; só então relê o
    resultado. Para no tempo limite do workflow, ao trocar de edital ou num
    pedido novo.
  */
  function acompanhar(editalId: string, antes: string | null, desde: Date) {
    const meu = acompanhamento;
    const vale = () => meu === acompanhamento && estado.editalId === editalId;
    const passo = async (): Promise<void> => {
      if (!vale()) return;
      const d = await situacaoDaExecucao(editalId);
      if (!vale()) return;
      const ultima: ExecucaoDaPre | null | undefined = d?.ultima_execucao;
      if (
        d &&
        !d.em_andamento &&
        ultima?.id &&
        ultima.id !== antes &&
        ultima.situacao !== "EM_ANDAMENTO"
      ) {
        // Terminou: o resultado novo (com a RPC leve, a única releitura do pacote).
        if (!semSituacao) await carregar(editalId, { inscricoes: false });
        if (!vale()) return;
        const falhou = ultima.situacao === "FALHOU";
        const texto = falhou
          ? `O recálculo falhou${ultima.mensagem ? `: ${ultima.mensagem}` : "."}`
          : `Triagem recalculada às ${hora(ultima.fim ? new Date(ultima.fim) : agora())}.`;
        publicar({
          pedidoEm: null,
          aviso: { tom: falhou ? "danger" : "info", texto },
        });
        toast(texto, falhou ? "error" : "success");
        return;
      }
      if (agora().getTime() - desde.getTime() >= LIMITE_DO_ACOMPANHAMENTO_MS) {
        publicar({
          pedidoEm: null,
          aviso: {
            tom: "warning",
            texto: "O recálculo ainda não terminou. Use Atualizar mais tarde.",
          },
        });
        return;
      }
      agendar(passo, INTERVALO_DO_ACOMPANHAMENTO_MS);
    };
    agendar(passo, INTERVALO_DO_ACOMPANHAMENTO_MS);
  }

  /* Registra a lista PROVISORIA ou LOTE (o banco monta o retrato). */
  async function registrarLista(
    tipo: TipoDaListaDaPre,
    lote: number | null = null,
  ): Promise<boolean> {
    const editalId = estado.editalId;
    const chave = chaveDaLista(tipo, lote);
    publicar({ registrando: chave });
    try {
      const r = (await rpc(RPC_REGISTRAR_LISTA, {
        p_edital: editalId,
        p_tipo: tipo,
        p_lote: lote,
      })) as { lista?: MetaDaLista; resultado?: RetratoDaPre } | null;
      if (editalId === estado.editalId)
        publicar({
          registradas: {
            ...estado.registradas,
            [chave]: { meta: r?.lista, retrato: r?.resultado },
          },
        });
      toast("Lista registrada. Copie para o SEI ou baixe o DOCX.", "success");
      void carregar(editalId, { inscricoes: false });
      return true;
    } catch (erro) {
      toast(`Não foi possível registrar: ${mensagemDoBanco(erro)}`, "error");
      return false;
    } finally {
      publicar({ registrando: "" });
    }
  }

  async function publicarLista(id: string): Promise<boolean> {
    try {
      await rpc(RPC_PUBLICAR_LISTA, { p_lista: id });
      toast("Lista marcada como publicada.", "success");
      void carregar(estado.editalId, { inscricoes: false });
      return true;
    } catch (erro) {
      toast(`Não foi possível marcar: ${mensagemDoBanco(erro)}`, "error");
      return false;
    }
  }

  function documento(
    registrado: ListaRegistradaDaPre | null | undefined,
    lista = "todas",
  ) {
    if (!registrado?.retrato) return null;
    return documentoOficial(registrado.retrato, {
      lista,
      regra: estado.dados?.regra_classificacao?.configuracao || {},
      treinamento:
        Boolean(estado.dados?.edital?.treinamento) ||
        ehEditalDeTreinamento(registrado.retrato.edital),
    });
  }

  function marca() {
    let texto = "";
    try {
      texto = String(cabecalho() ?? "").trim();
    } catch {
      texto = "";
    }
    return { cabecalho: texto || CABECALHO_PADRAO, logo: LOGO_PADRAO_DA_BARRA };
  }

  /* DOCX timbrado ou impressão (PDF) de uma lista registrada; lista = todas | eliminados. */
  async function exportar(
    registrado: ListaRegistradaDaPre,
    formato: string,
    lista = "todas",
  ): Promise<boolean> {
    const doc = documento(registrado, lista);
    if (!doc) return false;
    const m = marca();
    if (formato === "docx") {
      const logo = await Promise.resolve()
        .then(() => carregarLogo())
        .catch(() => null);
      baixar(
        gerarDocxOficial(doc, { cabecalho: m.cabecalho, logo }),
        `${nomeDoArquivo(registrado.retrato, lista)}.docx`,
        MIME_DOCX,
      );
    } else imprimir(paginaDaPrevia(doc, m));
    return true;
  }

  async function copiarParaSei(
    registrado: ListaRegistradaDaPre,
    lista = "todas",
  ): Promise<string> {
    const doc = documento(registrado, lista);
    if (!doc) return "";
    const resultado = await copiar({
      html: htmlParaSei(doc),
      texto: textoParaSei(doc),
    });
    if (resultado === "html")
      toast(
        "Copiado. No SEI, cole no editor do documento (Ctrl+V).",
        "success",
      );
    else if (resultado === "texto")
      toast(
        "Copiado só como texto: o navegador não liberou o formato com tabelas. Use o DOCX.",
        "warn",
      );
    else
      toast(
        "Não foi possível copiar. Libere a área de transferência ou use o DOCX.",
        "error",
      );
    return resultado;
  }

  return {
    obter: (): SnapshotDaPreClassificacao => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    // A chamada com tempo limite, para o cartão "Inscrições congeladas"
    // (trava-das-inscricoes.tsx, que lê e muda a trava sozinho).
    rpc,
    carregar,
    garantirCarregado,
    garantirParte,
    pedirPartes,
    listar,
    listarTudo,
    conferirEliminados,
    recalcular,
    descongelar,
    incluirPorDecisao: (
      candidatos: readonly CandidatoParaDecidir[],
      motivo: string,
    ) => decidir("incluir", candidatos, motivo),
    revogarDecisao: (
      candidatos: readonly CandidatoParaDecidir[],
      motivo: string,
    ) => decidir("revogar", candidatos, motivo),
    registrarLista,
    publicarLista,
    exportar,
    copiarParaSei,
  };
}
