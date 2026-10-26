import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseClient } from "../lib/supabaseClient";
import { ordenarUnidades } from "../lib/editais-do-nucleo.ts";
import { erroAmigavel } from "../lib/erro-amigavel";
import {
  canImportApprovedList,
  canViewCore,
  permissaoLegada,
} from "../lib/access-roles.ts";
import {
  assinaturaDoAcesso,
  consultasDosDados,
  copiaServe,
  dadosDasRespostas,
  montarCopia,
  partesQueMudaram,
  respostasDasConsultas,
} from "../lib/copia-da-sessao";
import type { CopiaDaSessao, DadosDaCopia } from "../lib/copia-da-sessao";
import type {
  PerfilDeAcesso,
  PermissaoLegada,
} from "../lib/tipos-dos-acessos.ts";
import type { LinhaDoMonitoramento } from "../modulos/visao-geral/tipos.ts";
import type { Configuracao } from "./configuracao.ts";
import type { Navegacao } from "./navegacao.ts";
import { ehPainelExterno, codigoDoPainel } from "../lib/navegacao";
import {
  VERSAO_DA_COPIA,
  apagarCopiaDaSessao,
  guardarCopiaDaSessao,
  lerCopiaDaSessao,
} from "../modules/copia-da-sessao-indexeddb.js";
import {
  carregarCatalogoDeAbas,
  consultaDoCatalogoDeAbas,
} from "../modules/catalogo-de-abas.js";
import {
  carregarSituacaoDoSistema,
  consultaDaSituacaoDoSistema,
} from "../modules/situacao-dos-modulos.js";
import { esconderEsqueleto, marcarAtualizacao } from "./carregamento.ts";
import {
  assinarPedidosDasLinhas,
  esquecerLinhasDoMonitoramento,
  linhasPedidas,
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
} from "../componentes/dados-do-monitoramento.ts";
import { telaUsaAsLinhas } from "../lib/telas-com-linhas.ts";
import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.ts";
import { avisar as avisarPadrao } from "./avisos.ts";

/*
  A carga dos dados do app, sem React.

  Na entrada, as consultas (configuração, painéis, mapa, unidades, catálogo de
  abas e, se a tela de entrada as usa, as linhas do monitoramento) saem juntas
  e cada uma é aplicada na ordem de sempre; a espera é a da mais lenta. Se a
  cópia da sessão (IndexedDB, regras em src/lib/copia-da-sessao.ts) servir, a
  tela abre por ela e as consultas reais atualizam por trás, reaplicando só o
  que mudou. "Atualizar dados" refaz as consultas sem tela de carregamento.

  AS LINHAS DO MONITORAMENTO SÃO SOB DEMANDA. `listar_monitoramento_operacional`
  custa ~0,8 s no banco (mesmo respondendo `inalterado`), e em 19/10/2026 o
  Supabase NANO saturou com ~10 avaliadores que nunca abriam uma página com
  elas. Agora só são lidas quando alguém as pede (src/componentes/
  dados-do-monitoramento.ts: a página aberta que as usa, src/lib/
  telas-com-linhas.ts, ou a busca global e as Coordenações). A primeira
  pintura não piora: a entrada já as pede junto se a tela de entrada as usa, e
  a página aberta depois pinta pela cópia da sessão (se servir) enquanto a
  leitura com versão chega. O Realtime do monitoramento só é assinado depois
  que alguém pediu as linhas; uma mudança com ninguém precisando delas só as
  marca como desatualizadas, e a próxima página que as pedir relê.

  As linhas e as unidades vão para src/componentes/dados-do-monitoramento.ts
  (as telas React assinam lá); o mapa da Saúde Indígena, para o estado da
  Visão geral.
*/

/*
  O mapa da Saúde Indígena (`lmap` e `rede_cnes` de TB_CONFIG_MAPA_SAUDE_INDIG,
  ~150 kB) vem por RPC com versão (migration 20261015000100): a entrada manda
  a versão que já tem (da memória ou da cópia da sessão) e, sem mudança, o
  banco responde só `{ inalterado: true }`.
*/
const RPC_DO_MAPA = "listar_mapa_da_saude_indigena";

/*
  As colunas de cada linha do monitoramento, as que
  `listar_monitoramento_operacional` devolve (migration 20261022200000, da view
  VW_MONITORAMENTO_INDIGENA_OPERACIONAL). As seis `cronograma_*` entram de
  propósito: uma leitura só do monitoramento (a Visão geral e os detalhes
  leem daqui). tests/app/carga.test.js confere que a migration seleciona
  exatamente estas.
*/
export const COLUNAS_DO_MONITORAMENTO =
  "aprovados_analise,aprovados_prova,aptos_analise,ativo,cancelados,cargos,ciclo,contratados,cronograma_atividade_atual,cronograma_automatico,cronograma_dias_para_proxima,cronograma_percentual,cronograma_proxima_atividade,cronograma_proxima_data,data_fim,data_inicio,edital,eliminados_nota,entrevistados,etapa,id,id_unidade,inscritos,link_edital,observacoes,observacoes_internas,processo,reprovados_analise,responsavel,risco,sigla_unidade,status,tipo_unidade,total_eliminados,uf,unidade,vagas_ociosas,vagas_total,CO_AREA,ST_TREINAMENTO,TP_FONTE_FUNIL,DT_FONTE_FUNIL";
const RPC_DO_MONITORAMENTO = "listar_monitoramento_operacional";

const COPIA_PADRAO = Object.freeze({
  ler: lerCopiaDaSessao,
  guardar: guardarCopiaDaSessao,
  apagar: apagarCopiaDaSessao,
  versao: VERSAO_DA_COPIA,
});
const ABAS_PADRAO = Object.freeze({
  consulta: consultaDoCatalogoDeAbas,
  carregar: carregarCatalogoDeAbas,
});
const SITUACAO_PADRAO = Object.freeze({
  consulta: consultaDaSituacaoDoSistema,
  carregar: carregarSituacaoDoSistema,
});
const PEDIDOS_PADRAO = Object.freeze({
  assinar: assinarPedidosDasLinhas,
  ha: linhasPedidas,
});

/** Linhas com a versão do banco (`{ linhas, versao }`): o que a tela já tem. */
export type ConhecidasComVersao = { linhas: unknown; versao: unknown };

/** As conhecidas, já lidas ou ainda a caminho (a cópia da sessão). */
export type ConhecidasDaCarga =
  | ConhecidasComVersao
  | PromiseLike<ConhecidasComVersao | null | undefined>
  | null
  | undefined;

/** Resposta no formato do Supabase (`{ data, error }`), com a `versao` nas RPCs com versão. */
export type RespostaComVersao = {
  data: unknown;
  versao?: unknown;
  error: unknown;
};

/** Uma consulta já disparada (ou a resposta já pronta, da cópia). */
export type ConsultaDaCarga = PromiseLike<RespostaComVersao>;

export type OpcoesDaConsulta = { consulta?: ConsultaDaCarga | null };

/** Uma linha de TB_CONFIG_MAPA_SAUDE_INDIG. */
export type LinhaDoMapa = {
  chave: string;
  payload: { dsei?: unknown; rede?: unknown } | null | undefined;
};

/** O que a carga usa de src/app/paineis-externos.ts. */
export type PaineisDaCarga = {
  consulta(): ConsultaDaCarga;
  carregar(opcoes?: { consulta?: ConsultaDaCarga }): Promise<unknown>;
  completarLiberados(): void;
  liberados(): Iterable<unknown>;
  descartarAbertos(): void;
  podeAbrir(codigo: string): boolean;
  esquecerAtual(): void;
};

/** O catálogo de abas e a situação do sistema: consulta já disparada e aplicação. */
export type ParteDaCarga = {
  consulta(sb: SupabaseClient | null): Promise<RespostaComVersao>;
  carregar(opcoes: OpcoesDaConsulta): Promise<unknown>;
};

/** A cópia da sessão (IndexedDB, src/modules/copia-da-sessao-indexeddb.js). */
export type CopiaDaCarga = {
  ler(): Promise<CopiaDaSessao | null>;
  guardar(copia: CopiaDaSessao): Promise<unknown>;
  apagar(): Promise<unknown>;
  versao: string;
};

/**
 * `configuracao` (src/app/configuracao.ts), `paineis`
 * (src/app/paineis-externos.ts) e `navegacao` (src/app/navegacao.ts) são
 * obrigatórios. `mostrarApp` mostra `#appScreen` com quem entrou; `comemorar`
 * é a comemoração do acesso liberado; `pedidos`, quem precisa das linhas do
 * monitoramento (dados-do-monitoramento.ts).
 */
export type DependenciasDaCarga = {
  cliente?: () => SupabaseClient | null;
  configuracao: Pick<Configuracao, "consulta" | "carregar" | "booleano">;
  paineis: PaineisDaCarga;
  navegacao: Pick<
    Navegacao,
    "montarMenu" | "obter" | "telaPermitida" | "irPara" | "telaDeEntrada"
  >;
  obterPerfil?: () => PerfilDeAcesso | null;
  obterUsuario?: () => { id?: string | null } | null;
  avisar?: (texto: string, tom?: string) => void;
  mostrarApp?: () => void;
  comemorar?: () => void;
  copia?: CopiaDaCarga;
  abas?: ParteDaCarga;
  situacao?: ParteDaCarga;
  esqueleto?: {
    esconder(): void;
    marcarAtualizacao(ativa: boolean): void;
  };
  visaoGeral?: Pick<typeof estadoDaVisaoGeral, "obter" | "definirDadosDoMapa">;
  pedidos?: {
    assinar(ouvinte: () => void): () => unknown;
    ha(): boolean;
  };
  agora?: () => number;
};

/** Quem abriu a sessão: a cópia guardada só serve a ela. */
type SessaoDaCopia = { usuarioId: unknown; acesso: unknown; versao: unknown };

export type Carga = ReturnType<typeof criarCarga>;

export function criarCarga(
  {
    cliente = getSupabaseClient,
    configuracao,
    paineis,
    navegacao,
    obterPerfil = () => null,
    obterUsuario = () => null,
    avisar = avisarPadrao,
    mostrarApp = () => {},
    comemorar = () => {},
    copia = COPIA_PADRAO,
    abas = ABAS_PADRAO,
    situacao = SITUACAO_PADRAO,
    esqueleto = { esconder: esconderEsqueleto, marcarAtualizacao },
    visaoGeral = estadoDaVisaoGeral,
    pedidos = PEDIDOS_PADRAO,
    agora = () => Date.now(),
    // `configuracao`, `paineis` e `navegacao` vêm sempre; o `{}` é o padrão do JS.
  }: DependenciasDaCarga = {} as DependenciasDaCarga,
) {
  let linhas: LinhaDoMonitoramento[] = [];
  /* A versão das `linhas` que o banco mandou: a próxima carga pergunta só se mudou. */
  let versaoDasLinhas: unknown = null;
  /* As linhas já publicadas no store (resposta `inalterada` não republica). */
  let publicadas: LinhaDoMonitoramento[] | null = null;
  /* As linhas vieram nesta sessão (do banco); antes disso, ninguém as pediu. */
  let linhasCarregadas = false;
  /* O Realtime avisou de mudança com ninguém precisando: a próxima página relê. */
  let desatualizadas = false;
  /* As linhas da cópia da sessão que serve (`{ linhas, versao }`, promessa), quando a entrada não as leu. */
  let linhasDaCopia: Promise<ConhecidasComVersao | null | undefined> | null =
    null;
  /* A entrada terminou: daqui em diante, pedido de linhas vira leitura. */
  let sessaoAberta = false;
  /* A sessão quer o Realtime (`iniciarRealtime`); o canal só abre se alguém usa as linhas. */
  let realtimePermitido = false;
  /* O mapa que a tela tem (`{ linhas, versao }`), pelo mesmo motivo. */
  let mapaAtual: ConhecidasComVersao | null = null;
  let unidades: unknown[] = [];
  let copiaEmLeitura: Promise<CopiaDaSessao | null> | null = null;
  let cargaDasLinhas: Promise<boolean> | null = null;
  let rodadaDasLinhas = 0;
  let atualizacao: Promise<boolean> | null = null;
  let canal: RealtimeChannel | null = null;
  let esperaDoRealtime: ReturnType<typeof setTimeout> | null = null;

  const sb = () => cliente();
  const perfil = () => obterPerfil();
  const pode = (permissao: PermissaoLegada) =>
    permissaoLegada(perfil(), permissao);
  const usuarioId = () => obterUsuario()?.id;

  // ── Consultas ─────────────────────────────────────────────────────────

  const consultaDeUnidades = () =>
    sb()!
      .from("TD_UNIDADE")
      .select("id_unidade,sigla,nome_oficial,tipo,uf_sede,ativo")
      .eq("ativo", true)
      .order("tipo", { ascending: true })
      .order("nome_oficial", { ascending: true });

  function podeCarregarMonitoramento() {
    return (
      pode("ind") ||
      pode("cores") ||
      pode("calendario") ||
      canViewCore(perfil()) ||
      canImportApprovedList(perfil())
    );
  }

  /*
    RPC com versão (`*_se_mudou`, FC_SE_MUDOU). `conhecidas` (`{ linhas,
    versao }`, ou a promessa dele) é o que a tela já tem: o da memória ou o da
    cópia da sessão. Se a versão ainda vale, o banco responde só
    `{ inalterado: true }` e voltam as mesmas linhas. Responde no formato do
    Supabase (`{ data, error }`) mais a `versao`.
  */
  const consultaComVersao = (rpc: string, conhecidas: ConhecidasDaCarga) =>
    Promise.resolve(conhecidas)
      .catch(() => null)
      .then(async (base): Promise<RespostaComVersao> => {
        const versao = base?.versao || null;
        const { data, error } = await sb()!.rpc(rpc, { p_versao: versao });
        if (error) return { data: null, error };
        // `versao` só existe com `base`.
        if (versao && data?.inalterado === true)
          return { data: base!.linhas, versao, error: null };
        return {
          data: Array.isArray(data?.linhas) ? data.linhas : [],
          versao: typeof data?.versao === "string" ? data.versao : null,
          error: null,
        };
      });

  /*
    As linhas que a tela já tem: as da memória ou, antes da primeira leitura
    da sessão, as da cópia da sessão (a versão dela ainda serve ao banco).
  */
  const linhasConhecidas = (): ConhecidasDaCarga =>
    versaoDasLinhas || !linhasDaCopia
      ? { linhas, versao: versaoDasLinhas }
      : linhasDaCopia;

  /* As linhas ativas, por unidade e edital (sem a versão eram ~300 kB a cada entrada). */
  const consultaDoMonitoramento = (
    conhecidas: ConhecidasDaCarga = linhasConhecidas(),
  ) => consultaComVersao(RPC_DO_MONITORAMENTO, conhecidas);

  /* `lmap` e `rede_cnes` (~150 kB): `[{ chave, payload }]`, como a tabela. */
  const consultaDoMapa = (conhecido: ConhecidasDaCarga = mapaAtual) =>
    consultaComVersao(RPC_DO_MAPA, conhecido);

  /*
    As consultas da entrada saem juntas: dependem só da sessão e do perfil, não
    umas das outras. Quem aplica o resultado continua sendo cada carga, na
    ordem de sempre; muda só a hora em que o pedido sai. `Promise.resolve` é o
    que dispara, porque a consulta do Supabase só vai para a rede quando alguém
    chama `then`. As linhas do monitoramento só entram com `comLinhas` (alguém
    vai usá-las); sem elas, `monitoramento` fica `null`.
  */
  function iniciarConsultas({
    monitoramento,
    mapa,
    comLinhas = true,
  }: {
    monitoramento?: ConhecidasDaCarga;
    mapa?: ConhecidasDaCarga;
    comLinhas?: boolean;
  } = {}) {
    const iniciar = <T>(consulta: T) => Promise.resolve(consulta);
    return {
      config: iniciar(configuracao.consulta()),
      paineis: iniciar(paineis.consulta()),
      mapa: consultaDoMapa(mapa),
      unidades: iniciar(consultaDeUnidades()),
      abas: abas.consulta(sb()),
      monitoramento:
        comLinhas && podeCarregarMonitoramento()
          ? consultaDoMonitoramento(monitoramento)
          : null,
    };
  }

  // ── Cargas ────────────────────────────────────────────────────────────

  async function carregarUnidades({ consulta }: OpcoesDaConsulta = {}) {
    if (!sb()) {
      unidades = [];
      publicarUnidadesDoCatalogo(unidades);
      return false;
    }
    const { data, error } = await (consulta || consultaDeUnidades());
    if (error) {
      unidades = [];
      publicarUnidadesDoCatalogo(unidades);
      avisar("Catálogo dim_unidades não disponível.", "warn");
      return false;
    }
    unidades = Array.isArray(data)
      ? data
          .filter((unidade) => String(unidade.nome_oficial ?? "").trim())
          .sort(ordenarUnidades)
      : [];
    publicarUnidadesDoCatalogo(unidades);
    return true;
  }

  async function carregarMapa({ consulta }: OpcoesDaConsulta = {}) {
    if (!sb()) return false;
    const { data, error, versao } = await (consulta || consultaDoMapa());
    if (error) {
      console.warn("Mapa/rede do Supabase indisponível:", error);
      if (pode("config"))
        avisar(
          "Mapa/rede do Supabase indisponível. Verifique a tabela de configuração do mapa.",
          "warn",
        );
      return false;
    }
    mapaAtual = {
      linhas: Array.isArray(data) ? data : [],
      versao: versao || null,
    };
    const porChave = Object.fromEntries(
      ((data || []) as LinhaDoMapa[]).map((linha) => [
        linha.chave,
        linha.payload,
      ]),
    );
    // O mapa da Saúde Indígena (React) lê do estado da Visão geral.
    const anteriores = visaoGeral.obter().mapa || {};
    visaoGeral.definirDadosDoMapa({
      lmap:
        porChave.lmap && Array.isArray(porChave.lmap.dsei)
          ? porChave.lmap
          : anteriores.lmap,
      redeCnes:
        porChave.rede_cnes && porChave.rede_cnes.rede
          ? porChave.rede_cnes
          : anteriores.redeCnes,
    });
    const completo = !!(porChave.lmap && porChave.rede_cnes);
    if (!completo && pode("config"))
      avisar("Configuração do mapa incompleta no Supabase.", "warn");
    return completo;
  }

  /* As linhas do monitoramento; duas chamadas juntas esperam a mesma carga. */
  async function carregarLinhas({ consulta }: OpcoesDaConsulta = {}) {
    if (cargaDasLinhas) return cargaDasLinhas;
    const rodada = ++rodadaDasLinhas;
    const carga = (async () => {
      if (!podeCarregarMonitoramento()) {
        linhas = [];
        publicarLinhasDoMonitoramento(linhas);
        navegacao.montarMenu();
        return true;
      }
      const { data, error, versao } = await (consulta ||
        consultaDoMonitoramento());
      if (rodada !== rodadaDasLinhas) return false;
      if (error) {
        avisar("Erro ao carregar dados: " + erroAmigavel(error), "error");
        return false;
      }
      linhas = Array.isArray(data) ? (data as LinhaDoMonitoramento[]) : [];
      versaoDasLinhas = versao || null;
      linhasCarregadas = true;
      desatualizadas = false;
      // A Visão geral (React) recorta; o mapa da Saúde Indígena lê o recorte dela.
      // Resposta `inalterada` devolve as mesmas linhas: nada a republicar.
      if (linhas !== publicadas) publicarLinhasDoMonitoramento(linhas);
      publicadas = linhas;
      sincronizarCanal();
      return true;
    })();
    cargaDasLinhas = carga;
    try {
      return await carga;
    } finally {
      // `esquecer` pode ter soltado esta carga e outra já ter começado.
      if (cargaDasLinhas === carga) cargaDasLinhas = null;
    }
  }

  /*
    Alguém pediu as linhas (a página aberta, a busca global…). Já lidas e em
    dia: nada. Nunca lidas nesta sessão: a cópia da sessão que serve pinta a
    página na hora e a leitura com a versão dela vem logo atrás (quase sempre
    `inalterado`). O Realtime marcou como desatualizadas: relê.
  */
  async function garantirLinhas() {
    if (!sessaoAberta || !pedidos.ha() || !podeCarregarMonitoramento()) return;
    if (linhasCarregadas && !desatualizadas) return;
    try {
      if (!linhasCarregadas && linhasDaCopia && !publicadas) {
        const daCopia = await linhasDaCopia.catch(() => null);
        if (daCopia && sessaoAberta && !linhasCarregadas && !publicadas) {
          linhas = Array.isArray(daCopia.linhas)
            ? (daCopia.linhas as LinhaDoMonitoramento[])
            : [];
          versaoDasLinhas = daCopia.versao || null;
          publicarLinhasDoMonitoramento(linhas);
          publicadas = linhas;
        }
      }
      // Outro pedido pode ter lido enquanto a cópia era lida.
      if (linhasCarregadas && !desatualizadas) return;
      await carregarLinhas();
    } catch (erro) {
      console.warn("Falha ao carregar as linhas do monitoramento:", erro);
      avisar("Erro ao carregar dados: " + erroAmigavel(erro), "error");
    }
  }

  async function carregarPaineis(consulta: ConsultaDaCarga | undefined) {
    await paineis.carregar({ consulta });
    paineis.completarLiberados();
  }

  // ── Entrada ───────────────────────────────────────────────────────────

  /*
    Sessão válida, perfil ainda chegando: a leitura local da cópia da sessão
    corre junto com a consulta do perfil.
  */
  function prepararEntrada() {
    copiaEmLeitura = copia.ler();
  }

  /*
    Depois que a tela abriu: espera as consultas reais e guarda a cópia nova.
    Se a tela abriu pela cópia (`anteriores`), reaplica antes só o que mudou;
    quase sempre nada, e nada pisca.
  */
  async function atualizarCopia(
    sessao: SessaoDaCopia,
    consultas: ReturnType<typeof iniciarConsultas>,
    anteriores: DadosDaCopia | null,
  ) {
    const dados = dadosDasRespostas(await respostasDasConsultas(consultas));
    if (usuarioId() !== sessao.usuarioId) return;
    // A entrada não leu as linhas: a cópia nova leva as que a tela tem (lidas
    // depois, sob demanda) ou as da cópia anterior, para a versão não se perder.
    if (dados && !consultas.monitoramento && podeCarregarMonitoramento())
      dados.monitoramento = linhasCarregadas
        ? { linhas, versao: versaoDasLinhas }
        : ((await linhasDaCopia?.catch(() => null)) ?? null);
    if (!dados) {
      if (anteriores)
        avisar(
          "Não foi possível atualizar os dados; mostrando os da última entrada.",
          "warn",
        );
      return;
    }
    if (anteriores) {
      const mudou = partesQueMudaram(anteriores, dados);
      const novas = consultasDosDados(dados);
      if (mudou.has("config"))
        await configuracao.carregar({ consulta: novas.config, silent: true });
      if (mudou.has("paineis")) await carregarPaineis(novas.paineis);
      if (mudou.has("abas")) await abas.carregar({ consulta: novas.abas });
      if (mudou.has("config") || mudou.has("paineis") || mudou.has("abas"))
        navegacao.montarMenu();
      const view = navegacao.obter().view;
      // Só painel: a permissão por tela não conhece todas (Acessos, por exemplo).
      if (ehPainelExterno(view) && !navegacao.telaPermitida(view))
        navegacao.irPara(navegacao.telaDeEntrada());
      // A cópia trazia o catálogo antigo: a manutenção das abas pode ter mudado.
      // Configurações fica (reabrir repreencheria os campos que a pessoa edita).
      else if (mudou.has("abas") && view !== "config") navegacao.irPara(view);
      if (mudou.has("mapa")) await carregarMapa({ consulta: novas.mapa });
      if (mudou.has("unidades"))
        await carregarUnidades({ consulta: novas.unidades });
      // As linhas só se reaplicam se a entrada as leu (ninguém mais as tem).
      if (
        consultas.monitoramento &&
        novas.monitoramento &&
        (mudou.has("mapa") ||
          mudou.has("unidades") ||
          mudou.has("monitoramento"))
      )
        await carregarLinhas({ consulta: novas.monitoramento });
    }
    if (usuarioId() !== sessao.usuarioId) return;
    await copia.guardar(montarCopia({ ...sessao, agora: agora(), dados }));
  }

  /**
   * Perfil confirmado pela sessão: carrega tudo e abre o app na tela de
   * entrada. `true` = aberto.
   */
  async function carregarEntrada() {
    const copiaLida = copiaEmLeitura || copia.ler();
    copiaEmLeitura = null;
    const sessao = {
      usuarioId: usuarioId(),
      acesso: assinaturaDoAcesso(perfil(), paineis.liberados()),
      versao: copia.versao,
    };
    // A cópia que serve diz ao banco a versão das linhas e do mapa que a tela já tem.
    const daCopiaQueServe = <T>(parte: (dados: DadosDaCopia) => T) =>
      Promise.resolve(copiaLida).then((guardada) =>
        copiaServe(guardada, { ...sessao, agora: agora() })
          ? parte(guardada!.dados)
          : null,
      );
    const linhasDaCopiaQueServe = daCopiaQueServe(
      (dados) => dados.monitoramento,
    );
    /*
      As linhas saem junto só se a tela de entrada as usa. A conta é a de
      antes do catálogo de abas desta entrada chegar: a tela guardada ou a
      inicial do perfil. Se o catálogo mudar a tela, a página aberta pede (ou
      não) por conta própria.
    */
    const comLinhas = telaUsaAsLinhas(navegacao.telaDeEntrada());
    // Sem elas agora, a cópia que serve guarda as linhas para a primeira página que as pedir.
    linhasDaCopia = comLinhas ? null : linhasDaCopiaQueServe;
    const consultas = iniciarConsultas({
      comLinhas,
      monitoramento: linhasDaCopiaQueServe,
      mapa: daCopiaQueServe((dados) =>
        dados.versaoDoMapa
          ? { linhas: dados.mapa, versao: dados.versaoDoMapa }
          : null,
      ),
    });
    // Fora da cópia da sessão: a manutenção é sempre a do banco, nesta entrada.
    const situacaoDoBanco = situacao.consulta(sb());
    const guardada = await copiaLida;
    // Outra pessoa entrou neste navegador: a cópia de quem saiu vai embora.
    if (guardada && guardada.usuarioId !== sessao.usuarioId)
      void copia.apagar();
    const daCopia = copiaServe(guardada, { ...sessao, agora: agora() });
    const fonte = daCopia ? consultasDosDados(guardada!.dados) : consultas;
    await configuracao.carregar({ consulta: fonte.config });
    await carregarPaineis(fonte.paineis);
    await abas.carregar({ consulta: fonte.abas });
    await situacao.carregar({ consulta: situacaoDoBanco });
    navegacao.montarMenu();
    await carregarMapa({ consulta: fonte.mapa });
    await carregarUnidades({ consulta: fonte.unidades });
    // Sem permissão para as linhas, a carga só publica a lista vazia (sem rede).
    // Cópia que serve sem as linhas (quem nunca as abriu): espera a consulta real.
    // Falha nas linhas não impede abrir o app: o erro já foi avisado e a
    // próxima página que pedir as linhas tenta de novo.
    const linhasOk =
      comLinhas || !podeCarregarMonitoramento()
        ? await carregarLinhas({
            consulta: comLinhas
              ? fonte.monitoramento || consultas.monitoramento
              : null,
          })
        : true;
    mostrarApp();
    sessaoAberta = true;
    navegacao.irPara(navegacao.telaDeEntrada());
    // A página aberta já pediu as linhas (ou o pedido ficou da sessão anterior).
    // Se acabaram de falhar, não repete na hora (seria o mesmo erro, avisado duas vezes).
    if (linhasOk) void garantirLinhas();
    esqueleto.esconder();
    comemorar();
    atualizarCopia(sessao, consultas, daCopia ? guardada!.dados : null).catch(
      (erro) => console.warn("Falha ao atualizar a cópia da sessão:", erro),
    );
    return true;
  }

  /*
    "Atualizar dados": sem tela de carregamento. O que está na tela fica, com a
    barra de atualização no cabeçalho, até os dados novos chegarem. Tudo é
    esperado antes de aplicar, porque a configuração zera enquanto espera a
    sua. Como dá para navegar nesse meio-tempo, a tela reaberta no fim é a de
    agora, e não a do clique.
  */
  async function atualizarDados() {
    if (atualizacao) return atualizacao;
    esqueleto.marcarAtualizacao(true);
    atualizacao = (async () => {
      // As linhas, só se alguém as usa agora; lidas antes, ficam para a próxima página que as pedir.
      const comLinhas = pedidos.ha();
      if (!comLinhas && linhasCarregadas) desatualizadas = true;
      const consultas = iniciarConsultas({ comLinhas });
      const situacaoDoBanco = situacao.consulta(sb());
      await respostasDasConsultas(consultas);
      await configuracao.carregar({ consulta: consultas.config });
      await carregarPaineis(consultas.paineis);
      await carregarMapa({ consulta: consultas.mapa });
      await abas.carregar({ consulta: consultas.abas });
      await situacao.carregar({ consulta: situacaoDoBanco });
      navegacao.montarMenu();
      await carregarUnidades({ consulta: consultas.unidades });
      const linhasOk =
        comLinhas || !podeCarregarMonitoramento()
          ? await carregarLinhas({ consulta: consultas.monitoramento })
          : true;
      if (!linhasOk) return false;
      // Painel já aberto recarrega na próxima abertura; o atual, logo abaixo.
      paineis.descartarAbertos();
      const view = navegacao.obter().view;
      const painel = codigoDoPainel(view);
      if (painel && paineis.podeAbrir(painel)) navegacao.irPara(view);
      else if (!painel && navegacao.telaPermitida(view)) navegacao.irPara(view);
      else {
        paineis.esquecerAtual();
        navegacao.irPara(navegacao.telaDeEntrada());
      }
      avisar("Dados atualizados.");
      return true;
    })();
    try {
      return await atualizacao;
    } finally {
      atualizacao = null;
      esqueleto.marcarAtualizacao(false);
    }
  }

  // ── Realtime do monitoramento ─────────────────────────────────────────

  /*
    Sucesso só quando as linhas vieram; a falha já foi avisada pela carga.
    Ninguém usando as linhas agora: não relê — ficam desatualizadas, e a
    próxima página que as pedir relê (`garantirLinhas`).
  */
  async function releituraDoRealtime() {
    if (!pedidos.ha()) {
      desatualizadas = true;
      return;
    }
    try {
      if (await carregarLinhas())
        avisar("Dashboard atualizado automaticamente.", "ok");
    } catch (erro) {
      console.warn("Falha na releitura do Realtime:", erro);
      avisar("Erro ao carregar dados: " + erroAmigavel(erro), "error");
    }
  }

  /*
    O canal só existe depois que alguém pediu as linhas nesta sessão: quem só
    usa páginas sem elas (a Avaliação documental, por exemplo) nem assina.
    Lidas uma vez, o canal fica (até sair ou a aba ir para o fundo), para a
    mudança vinda com a pessoa em outra página só marcar "desatualizadas" — sem
    ele, cada volta a uma página com linhas teria de reler para saber.
  */
  function sincronizarCanal() {
    const quer =
      realtimePermitido &&
      podeCarregarMonitoramento() &&
      (pedidos.ha() || linhasCarregadas);
    if (quer) abrirCanal();
    else fecharCanal();
  }

  /* A sessão quer o Realtime (entrada, volta da aba); o canal segue os pedidos. */
  function iniciarRealtime() {
    realtimePermitido = true;
    sincronizarCanal();
  }

  /* Saída ou aba no fundo: nada de Realtime até `iniciarRealtime`. */
  function pararRealtime() {
    realtimePermitido = false;
    fecharCanal();
  }

  function abrirCanal() {
    if (!sb() || !obterUsuario()) return;
    if (!configuracao.booleano("feature_realtime_monitoramento", true)) return;
    if (canal) return;
    try {
      canal = sb()!
        .channel("monitoramento_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "TB_MONITORAMENTO_INDIGENA" },
          () => {
            // Mudanças em rajada viram uma releitura só.
            clearTimeout(esperaDoRealtime!);
            esperaDoRealtime = setTimeout(releituraDoRealtime, 800);
          },
        )
        .subscribe();
    } catch (erro) {
      console.warn("Realtime não disponível:", erro);
      canal = null;
    }
  }

  function fecharCanal() {
    clearTimeout(esperaDoRealtime!);
    if (!canal) return;
    try {
      sb()?.removeChannel(canal);
    } catch {
      // O canal já caiu junto com a conexão.
    }
    canal = null;
  }

  /*
    A pessoa saiu (ou ficou sem acesso): nada dela fica na memória nem na
    escuta. Sem o canal, o próximo login assina de novo (`iniciarRealtime`); a
    rodada nova descarta a carga de linhas que ainda estiver a caminho.
  */
  function esquecer() {
    pararRealtime();
    rodadaDasLinhas += 1;
    cargaDasLinhas = null;
    linhas = [];
    versaoDasLinhas = null;
    publicadas = null;
    linhasCarregadas = false;
    desatualizadas = false;
    linhasDaCopia = null;
    sessaoAberta = false;
    mapaAtual = null;
    copiaEmLeitura = null;
    esquecerLinhasDoMonitoramento();
  }

  /* Pedido novo (ou devolvido): lê as linhas se preciso e acerta o canal. */
  pedidos.assinar(() => {
    sincronizarCanal();
    void garantirLinhas();
  });

  return {
    iniciarConsultas,
    prepararEntrada,
    carregarEntrada,
    atualizarDados,
    carregarLinhas,
    carregarUnidades,
    carregarMapa,
    iniciarRealtime,
    pararRealtime,
    esquecer,
    linhas: () => linhas,
    apagarCopia: () => copia.apagar(),
  };
}
