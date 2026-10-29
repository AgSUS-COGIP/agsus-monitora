/*
  Estado da tela Avaliação documental (`#page-avaliacao-documental`), fora do
  React. Os componentes leem com `useSyncExternalStore`. Este arquivo não
  importa React.

  RPCs (supabase/migrations/20261006100000_regra_da_analise.sql; contrato em
  src/lib/rpc-contrato.js):
    listar_editais_avaliacao(p_area)            os editais da área atual
    obter_regra_analise_se_mudou(p_edital, p_versao)
                                                (20261014230000) regra, versões,
                                                modelos, nota mínima e aldeias,
                                                por versão: quando nada mudou, só
                                                { inalterado } (a cópia fica na
                                                memória e no navegador:
                                                leitura-por-versao.ts). Banco sem ela:
    obter_regra_analise(p_edital)               o mesmo, inteiro, como antes
    obter_perguntas_carga_analise(p_edital)     perguntas e respostas da última
                                                carga da Empregare (instantâneo,
                                                só a coordenação), lidas só
                                                quando o assistente abre o passo
                                                das perguntas ou o formulário
                                                as mostra (20261009180000)
    copiar_modelo_regra_analise(...)            versão 1 a partir de um modelo
    salvar_regra_analise(...)                   versão nova (motivo da 2ª em diante)
                                                (os textos do parecer sem espaço nas
                                                pontas: textos-da-regra.ts)
    conferir_regra_analise(...)                 outra pessoa da coordenação
                                                conferiu (dupla conferência)
    renomear_versao_regra_analise(...)          troca só o nome de uma versão
                                                (20261008180000)
    obter_apoio_regra_analise(p_edital)         o que o assistente lê: colunas
                                                de pergunta por vaga, regras
                                                conferidas da área e a regra
                                                de classificação
    salvar_regra_classificacao(...)             nota mínima e desempate, pela
                                                RPC da Classificação (Editor)
    obter_equipe_edital(p_edital)               gestores, equipe e pessoas, lidos só
                                                quando a aba Equipe abre (carregarEquipe)
    salvar_equipe_edital(...)                   a equipe inteira
    salvar_aldeias_dsei(...)                    lista de aldeias (admin global)
    definir_origem_analise(...)                 dono da avaliação: MONITORA (as
                                                fichas alimentam o Painel das
                                                análises) ou PLANILHA, com motivo
                                                (20261009200000; coordenação)

  A conta da prévia é a de src/lib/avaliacao-documental/pontuacao.ts, feita no
  componente; aqui só a carga e a gravação. A aba aberta (`visao`) mora aqui
  para o "Atualizar" e a reabertura da tela relerem a aba certa. Regra, Equipe
  e Triagem são só de quem coordena o edital (abas-e-entrada.ts):
  para os demais a visão cai na Fila e a equipe nem é lida.

  Entrada: ao chegar na área, abre sozinho o edital da ficha que estava
  aberta, o último edital aberto (lembrado por pessoa e área no navegador) ou
  o único vigente; senão, a tela mostra os cartões dos editais.

  Rascunho: o que a pessoa muda na regra é guardado a cada mudança por
  src/app/rascunho-da-regra.ts (montado em avaliacao-documental.tsx); ao
  salvar a versão nova, `aoGravarVersao` o apaga antes de a aba remontar.

  Leitura x gravação: a leitura do edital que estava no ar quando uma gravação
  terminou pode ter saído antes dela (banco lento): a resposta velha não
  sobrescreve a gravada; a leitura se refaz.
*/
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede";
import { criarCopiasPorVersao } from "../../app/copias-por-versao.ts";
import { criarLeituraPorVersao } from "../../lib/avaliacao-documental/leitura-por-versao.ts";
import { editalVigente } from "../../lib/avaliacao-documental/editais.ts";
import { regraComTextosSemEspacosNasPontas } from "../../lib/avaliacao-documental/textos-da-regra.ts";
import { ehConflitoDeVersao } from "../../lib/conflito-de-versao.ts";
import {
  coordenaOEdital,
  editalParaAbrir,
  lembrarEdital,
  lerEditalLembrado,
  VISAO_DE_QUEM_AVALIA,
  visaoProibida,
} from "./abas-e-entrada.ts";
import type { Visao } from "./abas-e-entrada.ts";
import type { ApoioDaRegra } from "./assistente/tipos.ts";
import type {
  PerguntaDaCarga,
  RegraAnalise,
  RegraSalva,
} from "../../lib/avaliacao-documental/tipos-da-regra.ts";
import type {
  DadosDoEdital,
  EditalDaAvaliacao,
  EquipeDoEdital,
  ErroDoBanco,
  EstadoDaAvaliacao,
  LinhaDaEquipeParaSalvar,
  OpcoesDaAvaliacao,
  RegraDeClassificacaoGravada,
  Registro,
  RespostaDaGravacaoDaRegra,
  ResultadoDaClassificacao,
  ResultadoDaRegra,
  ResultadoDasAldeias,
  ResultadoSimples,
} from "./tipos-do-estado.ts";

export type { EstadoDaAvaliacao } from "./tipos-do-estado.ts";

const RPC_LISTAR_EDITAIS = "listar_editais_avaliacao";
const RPC_OBTER_REGRA = "obter_regra_analise";
const RPC_OBTER_REGRA_SE_MUDOU = "obter_regra_analise_se_mudou";
const RPC_COPIAR_MODELO = "copiar_modelo_regra_analise";
const RPC_SALVAR_REGRA = "salvar_regra_analise";
const RPC_CONFERIR_REGRA = "conferir_regra_analise";
const RPC_RENOMEAR_VERSAO = "renomear_versao_regra_analise";
const RPC_OBTER_APOIO = "obter_apoio_regra_analise";
const RPC_OBTER_PERGUNTAS = "obter_perguntas_carga_analise";
const RPC_SALVAR_CLASSIFICACAO = "salvar_regra_classificacao";
const RPC_OBTER_EQUIPE = "obter_equipe_edital";
const RPC_SALVAR_EQUIPE = "salvar_equipe_edital";
const RPC_DEFINIR_ORIGEM = "definir_origem_analise";
const RPC_SALVAR_ALDEIAS = "salvar_aldeias_dsei";

export const MENSAGEM_SEM_ACESSO = "Sem acesso à Avaliação documental";
const TEMPO_LIMITE_MS = 45000;

export const VISOES_DA_AVALIACAO: ReadonlyArray<Visao> = Object.freeze([
  "fila",
  "resultados",
  "espelhos",
  "configuracoes",
  "regra",
  "equipe",
  "pre",
]);

const ESTADO_INICIAL: Readonly<EstadoDaAvaliacao> = Object.freeze({
  area: "",
  visao: "fila",
  editais: [],
  carregado: false,
  carregandoEditais: false,
  erroAoCarregar: "",
  semAcesso: false,
  editalId: "",
  dados: null,
  equipe: null,
  carregandoEdital: false,
  erroDoEdital: "",
  salvando: false,
  apoio: null,
  carregandoApoio: false,
  erroDoApoio: "",
  /* Perguntas e respostas da última carga (null = ainda não lidas). */
  perguntasDaCarga: null,
  carregandoPerguntas: false,
  erroDasPerguntas: "",
  /*
    A versão que o assistente acabou de salvar ({ editalId, versao }): a aba
    Regra remonta a cada versão (key), e o assistente reabre no passo 5 com a
    confirmação e o "Marcar como conferida" em vez de voltar ao passo 1.
  */
  regraSalvaAgora: null,
});

/* Sem a RPC do assistente publicada: abre sem as perguntas por vaga, as regras da área e a classificação. */
const APOIO_VAZIO: ApoioDaRegra = Object.freeze({
  perguntas_por_vaga: [],
  regras_da_area: [],
  classificacao: { pode_ler: false, pode_editar: false, regra: null },
  indisponivel: true,
});

/** O erro do banco como chega (sem garantia de forma). */
type ErroLido = ErroDoBanco | null | undefined;

export function mensagemDoBanco(erro: unknown): string {
  if ((erro as ErroLido)?.code === "PGRST202")
    return "A Avaliação documental ainda não foi publicada no banco.";
  if ((erro as ErroLido)?.code === "42501")
    return (erro as ErroDoBanco).message || "Seu acesso não inclui esta ação.";
  if (ehConflitoDeVersao(erro))
    return (
      (erro as ErroDoBanco).message ||
      "A regra mudou desde que você abriu; recarregue."
    );
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return (erro as ErroLido)?.message || mensagemDeFalha(erro);
}

export function criarEstadoDaAvaliacao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  tempoLimiteMs = TEMPO_LIMITE_MS,
  aoGravarVersao = (_editalId) => {},
  copias = criarCopiasPorVersao(supabase, RPC_OBTER_REGRA_SE_MUDOU),
}: OpcoesDaAvaliacao = {}) {
  let estado: EstadoDaAvaliacao = ESTADO_INICIAL;
  const leituraDaRegra = criarLeituraPorVersao({
    nova: RPC_OBTER_REGRA_SE_MUDOU,
    antiga: RPC_OBTER_REGRA,
    copias,
  });
  let pedidoDosEditais = 0;
  let pedidoDoEdital = 0;
  let gravacoes = 0;
  const ouvintes = new Set<() => void>();

  function publicar(mudancas: Partial<EstadoDaAvaliacao>) {
    estado = { ...estado, ...mudancas };
    // Quem não coordena o edital não fica numa aba da coordenação.
    if (visaoProibida(estado))
      estado = { ...estado, visao: VISAO_DE_QUEM_AVALIA };
    for (const ouvinte of ouvintes) ouvinte();
  }

  let identidade: string | null | undefined;
  /* A área em que a entrada (abrir um edital sozinho) já foi feita. */
  let areaDaEntrada = "";
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) {
      pedidoDosEditais += 1;
      pedidoDoEdital += 1;
      leituraDaRegra.esquecer();
      areaDaEntrada = "";
      publicar(ESTADO_INICIAL);
    }
    identidade = atual;
  });

  /* Quem está na tela (para lembrar o edital por pessoa). */
  async function usuarioAtual(): Promise<string | null> {
    if (identidade !== undefined) return identidade;
    try {
      const { data } = (await supabase?.auth?.getSession?.()) ?? {};
      return data?.session?.user?.id || null;
    } catch {
      return null;
    }
  }

  async function rpc(nome: string, argumentos?: Registro): Promise<unknown> {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /*
    Os editais da área. Troca de área recomeça do zero. Na primeira carga da
    área, sem edital escolhido, abre sozinho o `preferido` (o edital da ficha
    que estava aberta), o último aberto ou o único vigente.
  */
  async function carregar(
    area = estado.area,
    { preferido = "" }: { preferido?: string } = {},
  ): Promise<boolean> {
    if (!area) return false;
    const meu = ++pedidoDosEditais;
    if (area !== estado.area) {
      pedidoDoEdital += 1;
      publicar({ ...ESTADO_INICIAL, area, carregandoEditais: true });
    } else publicar({ carregandoEditais: true, erroAoCarregar: "" });
    try {
      const dados = (await rpc(RPC_LISTAR_EDITAIS, { p_area: area })) as {
        editais?: EditalDaAvaliacao[] | null;
      } | null;
      if (meu !== pedidoDosEditais) return false;
      const editais = Array.isArray(dados?.editais) ? dados.editais : [];
      let escolhido = editais.some((e) => e.id === estado.editalId)
        ? estado.editalId
        : "";
      if (!escolhido && areaDaEntrada !== area) {
        const usuario = await usuarioAtual();
        if (meu !== pedidoDosEditais) return false;
        escolhido = editalParaAbrir(editais, editalVigente, [
          preferido,
          lerEditalLembrado(usuario, area),
        ]);
      }
      areaDaEntrada = area;
      publicar({
        editais,
        carregado: true,
        carregandoEditais: false,
        semAcesso: false,
        erroAoCarregar: "",
        editalId: escolhido,
      });
      if (escolhido) void escolherEdital(escolhido);
      return true;
    } catch (erro) {
      if (meu !== pedidoDosEditais) return false;
      publicar({
        carregandoEditais: false,
        semAcesso: (erro as ErroLido)?.code === "42501",
        erroAoCarregar: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  /*
    Abre o edital: só a regra (a equipe, com gestores e pessoas, vem quando a
    aba Equipe abre: carregarEquipe). Lembra o edital aberto ("" esquece: a
    próxima entrada mostra os cartões).
  */
  async function escolherEdital(editalId: string): Promise<boolean> {
    const meu = ++pedidoDoEdital;
    void usuarioAtual().then((usuario) =>
      lembrarEdital(usuario, estado.area, editalId),
    );
    if (!editalId) {
      publicar({ editalId: "", dados: null, equipe: null, erroDoEdital: "" });
      return false;
    }
    publicar({
      editalId,
      carregandoEdital: true,
      erroDoEdital: "",
      ...(editalId !== estado.editalId
        ? {
            dados: null,
            equipe: null,
            apoio: null,
            erroDoApoio: "",
            perguntasDaCarga: null,
            erroDasPerguntas: "",
          }
        : {}),
    });
    const gravacoesAntes = gravacoes;
    try {
      const dados = (await leituraDaRegra.ler(
        rpc,
        { p_edital: editalId },
        editalId,
      )) as DadosDoEdital | null;
      if (meu !== pedidoDoEdital) return false;
      // Gravou-se no meio da leitura: ela pode ser de antes; lê de novo.
      if (gravacoesAntes !== gravacoes) return escolherEdital(editalId);
      publicar({ dados, carregandoEdital: false });
      return true;
    } catch (erro) {
      if (meu !== pedidoDoEdital) return false;
      publicar({
        carregandoEdital: false,
        erroDoEdital: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  /*
    A equipe do edital (gestores, equipe e quem pode entrar), só para a
    coordenação e só quando a aba Equipe abre: obter_equipe_edital monta a
    lista de pessoas, e abrir o edital (Triagem, Fila) não precisa
    dela. Falha vira erroDoEdital (a aba mostra "Tentar novamente").
  */
  let pedidoDaEquipe = 0;
  async function carregarEquipe(
    editalId: string = estado.editalId,
  ): Promise<boolean> {
    if (!editalId) return false;
    const meu = ++pedidoDaEquipe;
    try {
      const equipe = (await rpc(RPC_OBTER_EQUIPE, {
        p_edital: editalId,
      })) as EquipeDoEdital | null;
      if (meu !== pedidoDaEquipe || editalId !== estado.editalId) return false;
      publicar({ equipe });
      return true;
    } catch (erro) {
      if (meu !== pedidoDaEquipe || editalId !== estado.editalId) return false;
      publicar({ erroDoEdital: mensagemDoBanco(erro) });
      return false;
    }
  }

  /* Grava e devolve { ok, erro }; a regra nova volta para a tela. */
  async function gravarRegra(
    nome: string,
    argumentos: Registro,
    aviso: string,
    { versaoNova = false }: { versaoNova?: boolean } = {},
  ): Promise<ResultadoDaRegra> {
    const editalId = estado.editalId;
    publicar({ salvando: true });
    try {
      const resposta = (await rpc(
        nome,
        argumentos,
      )) as RespostaDaGravacaoDaRegra | null;
      gravacoes += 1;
      if (versaoNova && resposta?.regra) aoGravarVersao(editalId);
      if (editalId === estado.editalId && estado.dados)
        publicar({
          dados: { ...estado.dados, regra: resposta?.regra ?? null },
          ...(versaoNova && resposta?.regra
            ? { regraSalvaAgora: { editalId, versao: resposta.regra.versao } }
            : {}),
        });
      atualizarEditalNaLista(editalId, resposta?.regra);
      toast(aviso, "success");
      return { ok: true, resposta };
    } catch (erro) {
      return { ok: false, erro: mensagemDoBanco(erro) };
    } finally {
      publicar({ salvando: false });
    }
  }

  function atualizarEditalNaLista(
    editalId: string,
    regra: RegraSalva | null | undefined,
  ) {
    if (!regra) return;
    publicar({
      editais: estado.editais.map((e) =>
        e.id === editalId
          ? {
              ...e,
              versao_regra: regra.versao,
              nome_regra: regra.nome ?? null,
              situacao_regra: regra.situacao,
            }
          : e,
      ),
    });
  }

  /* O que o assistente lê (uma vez por edital; "recarregar" lê de novo). */
  let pedidoDoApoio = 0;
  async function carregarApoio({
    recarregar = false,
  }: { recarregar?: boolean } = {}): Promise<ApoioDaRegra | null> {
    const editalId = estado.editalId;
    if (!editalId || (estado.apoio && !recarregar) || estado.carregandoApoio)
      return estado.apoio;
    const meu = ++pedidoDoApoio;
    publicar({ carregandoApoio: true, erroDoApoio: "" });
    try {
      const apoio = (await rpc(RPC_OBTER_APOIO, {
        p_edital: editalId,
      })) as ApoioDaRegra | null;
      if (meu !== pedidoDoApoio || editalId !== estado.editalId) return null;
      publicar({ apoio: apoio ?? APOIO_VAZIO, carregandoApoio: false });
      return apoio;
    } catch (erro) {
      if (meu !== pedidoDoApoio || editalId !== estado.editalId) return null;
      publicar({
        carregandoApoio: false,
        apoio: (erro as ErroLido)?.code === "PGRST202" ? APOIO_VAZIO : null,
        erroDoApoio:
          (erro as ErroLido)?.code === "PGRST202" ? "" : mensagemDoBanco(erro),
      });
      return null;
    }
  }

  /*
    As perguntas e respostas da última carga: só quando a coordenação abre a
    parte que as usa (uma vez por edital; "recarregar" lê de novo). Banco sem
    a RPC (PGRST202): abre sem as perguntas.
  */
  let pedidoDasPerguntas = 0;
  async function carregarPerguntas({
    recarregar = false,
  }: { recarregar?: boolean } = {}): Promise<PerguntaDaCarga[] | null> {
    const editalId = estado.editalId;
    if (
      !editalId ||
      (estado.perguntasDaCarga && !recarregar) ||
      estado.carregandoPerguntas
    )
      return estado.perguntasDaCarga;
    const meu = ++pedidoDasPerguntas;
    publicar({ carregandoPerguntas: true, erroDasPerguntas: "" });
    try {
      const dados = (await rpc(RPC_OBTER_PERGUNTAS, {
        p_edital: editalId,
      })) as { perguntas?: PerguntaDaCarga[] | null } | null;
      if (meu !== pedidoDasPerguntas || editalId !== estado.editalId)
        return null;
      const perguntas = Array.isArray(dados?.perguntas) ? dados.perguntas : [];
      publicar({ perguntasDaCarga: perguntas, carregandoPerguntas: false });
      return perguntas;
    } catch (erro) {
      if (meu !== pedidoDasPerguntas || editalId !== estado.editalId)
        return null;
      const semRpc = (erro as ErroLido)?.code === "PGRST202";
      publicar({
        carregandoPerguntas: false,
        perguntasDaCarga: semRpc ? [] : null,
        erroDasPerguntas: semRpc ? "" : mensagemDoBanco(erro),
      });
      return null;
    }
  }

  return {
    obter: () => estado,
    carregarApoio,
    carregarPerguntas,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    escolherEdital,
    carregarEquipe,
    /* Aba da coordenação para quem não coordena: fica na Fila. */
    mudarVisao(visao: string) {
      // Compatibilidade com links/sessoes antigas: Resultados foi unido a Fila.
      const destino = visao === "resultados" ? "fila" : visao;
      if (
        (VISOES_DA_AVALIACAO as ReadonlyArray<string>).includes(destino) &&
        destino !== estado.visao &&
        !visaoProibida({ ...estado, visao: destino as Visao })
      )
        publicar({ visao: destino as Visao });
    },
    copiarModelo: (modelo: string) =>
      gravarRegra(
        RPC_COPIAR_MODELO,
        { p_edital: estado.editalId, p_modelo: modelo },
        "Regra criada a partir do modelo. Confira antes de usar.",
      ),
    /* O nome só vai quando preenchido: sem ele, a chamada é a de antes. */
    salvarRegra: (
      configuracao: unknown,
      motivo: string,
      nome: string | null = null,
    ) =>
      gravarRegra(
        RPC_SALVAR_REGRA,
        {
          p_edital: estado.editalId,
          p_configuracao: regraComTextosSemEspacosNasPontas(
            configuracao as RegraAnalise,
          ),
          p_versao_atual: estado.dados?.regra?.versao ?? 0,
          p_motivo: motivo || null,
          ...(nome ? { p_nome: nome } : {}),
        },
        "Regra salva como versão nova.",
        { versaoNova: true },
      ),
    /* O assistente fechou a confirmação da versão salva. */
    esquecerRegraSalvaAgora() {
      if (estado.regraSalvaAgora) publicar({ regraSalvaAgora: null });
    },
    /* Troca só o nome de uma versão (null tira o nome); conteúdo e hash ficam. */
    renomearVersao: (versao: number, nome: string | null, motivo: string) =>
      gravarRegra(
        RPC_RENOMEAR_VERSAO,
        {
          p_edital: estado.editalId,
          p_versao: versao,
          p_nome: nome || null,
          p_motivo: motivo,
        },
        "Nome da versão trocado.",
      ),
    conferirRegra: () =>
      gravarRegra(
        RPC_CONFERIR_REGRA,
        { p_edital: estado.editalId, p_versao: estado.dados?.regra?.versao },
        "Regra marcada como conferida.",
      ),
    /*
      Nota mínima e desempate: a regra de classificação inteira, pela RPC da
      Classificação (a permissão é a dela). Devolve { ok, erro }.
    */
    async salvarRegraClassificacao(
      configuracao: unknown,
      versaoAtual: number | null | undefined,
      motivo: string,
    ): Promise<ResultadoDaClassificacao> {
      const editalId = estado.editalId;
      publicar({ salvando: true });
      try {
        const regra = (await rpc(RPC_SALVAR_CLASSIFICACAO, {
          p_edital: editalId,
          p_configuracao: configuracao,
          p_versao_atual: versaoAtual ?? 0,
          p_motivo: motivo || null,
        })) as RegraDeClassificacaoGravada | null;
        gravacoes += 1;
        if (editalId === estado.editalId) {
          const documental = regra?.configuracao?.documental ?? {};
          publicar({
            apoio: estado.apoio
              ? {
                  ...estado.apoio,
                  classificacao: {
                    ...estado.apoio.classificacao,
                    regra: regra
                      ? {
                          versao: regra.versao,
                          nome: regra.nome ?? null,
                          configuracao: regra.configuracao,
                          atualizado_em: regra.atualizado_em,
                          por: regra.por,
                        }
                      : null,
                  },
                }
              : estado.apoio,
            dados: estado.dados
              ? {
                  ...estado.dados,
                  nota_minima: {
                    nota_minima: documental.nota_minima ?? null,
                    nota_minima_por_nivel:
                      documental.nota_minima_por_nivel ?? {},
                    versao_regra_classificacao: regra?.versao ?? null,
                  },
                }
              : estado.dados,
          });
        }
        toast(
          "Nota mínima e desempate salvos na regra de classificação.",
          "success",
        );
        return { ok: true, regra };
      } catch (erro) {
        return { ok: false, erro: mensagemDoBanco(erro) };
      } finally {
        publicar({ salvando: false });
      }
    },
    /*
      O dono da avaliação do edital (MONITORA ou PLANILHA), com motivo. No
      MONITORA, as fichas alimentam o Painel das análises. Devolve { ok, erro }.
    */
    async definirOrigem(
      origem: string,
      motivo: string,
    ): Promise<ResultadoSimples> {
      const editalId = estado.editalId;
      publicar({ salvando: true });
      try {
        const r = (await rpc(RPC_DEFINIR_ORIGEM, {
          p_edital: editalId,
          p_origem: origem,
          p_motivo: motivo,
        })) as { origem?: string | null } | null;
        gravacoes += 1;
        const nova = r?.origem ?? origem;
        if (editalId === estado.editalId && estado.dados)
          publicar({ dados: { ...estado.dados, origem: nova } });
        publicar({
          editais: estado.editais.map((e) =>
            e.id === editalId ? { ...e, origem: nova } : e,
          ),
        });
        toast(
          nova === "MONITORA"
            ? "A avaliação deste edital passa a ser feita no MONITORA."
            : "A avaliação deste edital voltou para a planilha.",
          "success",
        );
        return { ok: true };
      } catch (erro) {
        return { ok: false, erro: mensagemDoBanco(erro) };
      } finally {
        publicar({ salvando: false });
      }
    },
    async salvarEquipe(
      equipe: ReadonlyArray<LinhaDaEquipeParaSalvar>,
      motivo: string,
    ): Promise<ResultadoSimples> {
      const editalId = estado.editalId;
      publicar({ salvando: true });
      try {
        const nova = (await rpc(RPC_SALVAR_EQUIPE, {
          p_edital: editalId,
          p_equipe: equipe,
          p_motivo: motivo || null,
        })) as EquipeDoEdital | null;
        gravacoes += 1;
        if (editalId === estado.editalId) publicar({ equipe: nova });
        toast("Equipe salva.", "success");
        return { ok: true };
      } catch (erro) {
        return { ok: false, erro: mensagemDoBanco(erro) };
      } finally {
        publicar({ salvando: false });
      }
    },
    async salvarAldeias(
      unidade: string | number | null | undefined,
      aldeias: ReadonlyArray<string>,
      fonte: string,
    ): Promise<ResultadoDasAldeias> {
      publicar({ salvando: true });
      try {
        const r = (await rpc(RPC_SALVAR_ALDEIAS, {
          p_unidade: unidade,
          p_aldeias: aldeias,
          p_fonte: fonte,
        })) as { ativas?: number | null } | null;
        toast(`Lista de aldeias salva: ${r?.ativas ?? 0} ativas.`, "success");
        void escolherEdital(estado.editalId);
        return { ok: true, resposta: r };
      } catch (erro) {
        return { ok: false, erro: mensagemDoBanco(erro) };
      } finally {
        publicar({ salvando: false });
      }
    },
  };
}

/** A loja da avaliação (o que criarEstadoDaAvaliacao devolve). */
export type LojaDaAvaliacao = ReturnType<typeof criarEstadoDaAvaliacao>;
