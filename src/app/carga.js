import { getSupabaseClient } from "../lib/supabaseClient.js";
import { ordenarUnidades } from "../lib/editais-do-nucleo.js";
import { erroAmigavel } from "../lib/erro-amigavel.js";
import {
  canImportApprovedList,
  canViewCore,
  permissaoLegada,
} from "../lib/access-roles.js";
import {
  assinaturaDoAcesso,
  consultasDosDados,
  copiaServe,
  dadosDasRespostas,
  montarCopia,
  partesQueMudaram,
  respostasDasConsultas,
} from "../lib/copia-da-sessao.js";
import { ehPainelExterno, codigoDoPainel } from "../lib/navegacao.js";
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
import {
  esconderEsqueleto,
  marcarAtualizacao,
} from "../modules/carregamento.js";
import {
  publicarLinhasDoMonitoramento,
  publicarUnidadesDoCatalogo,
} from "../componentes/dados-do-monitoramento.js";
import { estadoDaVisaoGeral } from "../modulos/visao-geral/estado.js";
import { avisar as avisarPadrao } from "./avisos.js";

/*
  A carga dos dados do app, sem React.

  Na entrada, as consultas (configuração, painéis, mapa, unidades, catálogo de
  abas e monitoramento) saem juntas e cada uma é aplicada na ordem de sempre;
  a espera é a da mais lenta. Se a cópia da sessão (IndexedDB, regras em
  src/lib/copia-da-sessao.js) servir, a tela abre por ela e as consultas reais
  atualizam por trás, reaplicando só o que mudou. "Atualizar dados" refaz as
  consultas sem tela de carregamento. O Realtime do monitoramento relê as
  linhas quando a tabela muda.

  As linhas e as unidades vão para src/componentes/dados-do-monitoramento.js
  (as telas React assinam lá); o mapa da Saúde Indígena, para o estado da
  Visão geral.
*/

const RPC_PAYLOAD_DO_MONITORAMENTO = "get_monitoramento_dashboard_payload";
const TABELA_DO_MAPA = "TB_CONFIG_MAPA_SAUDE_INDIG";

/*
  As seis colunas `cronograma_*` entram de propósito: uma leitura só do
  monitoramento (a Visão geral e os detalhes leem daqui). A consulta nomeia a
  tabela, mas quem responde é a view (monitoramento-operational-transport.js).
*/
export const COLUNAS_DO_MONITORAMENTO =
  "aprovados_analise,aprovados_prova,aptos_analise,ativo,cancelados,cargos,ciclo,contratados,cronograma_atividade_atual,cronograma_automatico,cronograma_dias_para_proxima,cronograma_percentual,cronograma_proxima_atividade,cronograma_proxima_data,data_fim,data_inicio,edital,eliminados_nota,entrevistados,etapa,id,id_unidade,inscritos,link_edital,observacoes,observacoes_internas,processo,reprovados_analise,responsavel,risco,sigla_unidade,status,tipo_unidade,total_eliminados,uf,unidade,vagas_ociosas,vagas_total,CO_AREA";

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

/**
 * @param {object} dependencias
 * @param {object} dependencias.configuracao src/app/configuracao.js
 * @param {object} dependencias.paineis src/app/paineis-externos.js
 * @param {object} dependencias.navegacao src/app/navegacao.js
 * @param {() => object|null} dependencias.obterPerfil
 * @param {() => object|null} dependencias.obterUsuario
 * @param {() => void} dependencias.mostrarApp mostra `#appScreen` com quem entrou
 * @param {() => void} dependencias.comemorar comemoração do acesso liberado
 */
export function criarCarga({
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
  agora = () => Date.now(),
} = {}) {
  let linhas = [];
  let unidades = [];
  let copiaEmLeitura = null;
  let cargaDasLinhas = null;
  let rodadaDasLinhas = 0;
  let atualizacao = null;
  let canal = null;
  let esperaDoRealtime = null;

  const sb = () => cliente();
  const perfil = () => obterPerfil();
  const pode = (permissao) => permissaoLegada(perfil(), permissao);
  const usuarioId = () => obterUsuario()?.id;

  // ── Consultas ─────────────────────────────────────────────────────────

  const consultaDeUnidades = () =>
    sb()
      .from("TD_UNIDADE")
      .select("id_unidade,sigla,nome_oficial,tipo,uf_sede,ativo")
      .eq("ativo", true)
      .order("tipo", { ascending: true })
      .order("nome_oficial", { ascending: true });

  const consultaDoMapa = () =>
    sb()
      .from(TABELA_DO_MAPA)
      .select("chave,payload")
      .in("chave", ["lmap", "rede_cnes"]);

  async function payloadDoMonitoramento() {
    const { data, error } = await sb().rpc(RPC_PAYLOAD_DO_MONITORAMENTO);
    if (error) {
      console.warn(
        "Payload consolidado de monitoramento indisponível; usando carregamento legado:",
        error,
      );
      return null;
    }
    return data || null;
  }

  function podeCarregarMonitoramento() {
    return (
      pode("ind") ||
      pode("cores") ||
      pode("calendario") ||
      canViewCore(perfil()) ||
      canImportApprovedList(perfil())
    );
  }

  const consultaDoMonitoramento = () =>
    Promise.all([
      payloadDoMonitoramento(),
      sb()
        .from("TB_MONITORAMENTO_INDIGENA")
        .select(COLUNAS_DO_MONITORAMENTO)
        .eq("ativo", true)
        .order("unidade", { ascending: true })
        .order("edital", { ascending: true }),
    ]);

  /*
    As consultas da entrada saem juntas: dependem só da sessão e do perfil, não
    umas das outras. Quem aplica o resultado continua sendo cada carga, na
    ordem de sempre; muda só a hora em que o pedido sai. `Promise.resolve` é o
    que dispara, porque a consulta do Supabase só vai para a rede quando alguém
    chama `then`.
  */
  function iniciarConsultas() {
    const iniciar = (consulta) => Promise.resolve(consulta);
    return {
      config: iniciar(configuracao.consulta()),
      paineis: iniciar(paineis.consulta()),
      mapa: iniciar(consultaDoMapa()),
      unidades: iniciar(consultaDeUnidades()),
      abas: abas.consulta(sb()),
      monitoramento: podeCarregarMonitoramento()
        ? consultaDoMonitoramento()
        : null,
    };
  }

  // ── Cargas ────────────────────────────────────────────────────────────

  async function carregarUnidades({ consulta } = {}) {
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

  async function carregarMapa({ consulta } = {}) {
    if (!sb()) return false;
    const { data, error } = await (consulta || consultaDoMapa());
    if (error) {
      console.warn("Mapa/rede do Supabase indisponível:", error);
      if (pode("config"))
        avisar(
          "Mapa/rede do Supabase indisponível. Verifique a tabela de configuração do mapa.",
          "warn",
        );
      return false;
    }
    const porChave = Object.fromEntries(
      (data || []).map((linha) => [linha.chave, linha.payload]),
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
  async function carregarLinhas({ consulta } = {}) {
    if (cargaDasLinhas) return cargaDasLinhas;
    const rodada = ++rodadaDasLinhas;
    cargaDasLinhas = (async () => {
      if (!podeCarregarMonitoramento()) {
        linhas = [];
        publicarLinhasDoMonitoramento(linhas);
        navegacao.montarMenu();
        return true;
      }
      const [, resposta] = await (consulta || consultaDoMonitoramento());
      if (rodada !== rodadaDasLinhas) return false;
      const { data, error } = resposta;
      if (error) {
        avisar("Erro ao carregar dados: " + erroAmigavel(error), "error");
        return false;
      }
      linhas = Array.isArray(data) ? data : [];
      // A Visão geral (React) recorta; o mapa da Saúde Indígena lê o recorte dela.
      publicarLinhasDoMonitoramento(linhas);
      return true;
    })();
    try {
      return await cargaDasLinhas;
    } finally {
      cargaDasLinhas = null;
    }
  }

  async function carregarPaineis(consulta) {
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
  async function atualizarCopia(sessao, consultas, anteriores) {
    const dados = dadosDasRespostas(await respostasDasConsultas(consultas));
    if (usuarioId() !== sessao.usuarioId) return;
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
      if (
        mudou.has("mapa") ||
        mudou.has("unidades") ||
        mudou.has("monitoramento")
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
    const consultas = iniciarConsultas();
    // Fora da cópia da sessão: a manutenção é sempre a do banco, nesta entrada.
    const situacaoDoBanco = situacao.consulta(sb());
    const guardada = await copiaLida;
    // Outra pessoa entrou neste navegador: a cópia de quem saiu vai embora.
    if (guardada && guardada.usuarioId !== sessao.usuarioId)
      void copia.apagar();
    const daCopia = copiaServe(guardada, { ...sessao, agora: agora() });
    const fonte = daCopia ? consultasDosDados(guardada.dados) : consultas;
    await configuracao.carregar({ consulta: fonte.config });
    await carregarPaineis(fonte.paineis);
    await abas.carregar({ consulta: fonte.abas });
    await situacao.carregar({ consulta: situacaoDoBanco });
    navegacao.montarMenu();
    await carregarMapa({ consulta: fonte.mapa });
    await carregarUnidades({ consulta: fonte.unidades });
    const linhasOk = await carregarLinhas({ consulta: fonte.monitoramento });
    if (!linhasOk) {
      esqueleto.esconder();
      return false;
    }
    mostrarApp();
    navegacao.irPara(navegacao.telaDeEntrada());
    esqueleto.esconder();
    comemorar();
    atualizarCopia(sessao, consultas, daCopia ? guardada.dados : null).catch(
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
      const consultas = iniciarConsultas();
      const situacaoDoBanco = situacao.consulta(sb());
      await respostasDasConsultas(consultas);
      await configuracao.carregar({ consulta: consultas.config });
      await carregarPaineis(consultas.paineis);
      await carregarMapa({ consulta: consultas.mapa });
      await abas.carregar({ consulta: consultas.abas });
      await situacao.carregar({ consulta: situacaoDoBanco });
      navegacao.montarMenu();
      await carregarUnidades({ consulta: consultas.unidades });
      const linhasOk = await carregarLinhas({
        consulta: consultas.monitoramento,
      });
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

  function iniciarRealtime() {
    if (!sb() || !obterUsuario()) return;
    if (!configuracao.booleano("feature_realtime_monitoramento", true)) return;
    if (canal) return;
    try {
      canal = sb()
        .channel("monitoramento_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "TB_MONITORAMENTO_INDIGENA" },
          () => {
            // Mudanças em rajada viram uma releitura só.
            clearTimeout(esperaDoRealtime);
            esperaDoRealtime = setTimeout(async () => {
              await carregarLinhas();
              avisar("Dashboard atualizado automaticamente.", "ok");
            }, 800);
          },
        )
        .subscribe();
    } catch (erro) {
      console.warn("Realtime não disponível:", erro);
      canal = null;
    }
  }

  function pararRealtime() {
    clearTimeout(esperaDoRealtime);
    if (!canal) return;
    try {
      sb()?.removeChannel(canal);
    } catch {
      // O canal já caiu junto com a conexão.
    }
    canal = null;
  }

  /* A pessoa saiu (ou ficou sem acesso): nada dela fica na memória. */
  function esquecer() {
    linhas = [];
    copiaEmLeitura = null;
  }

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
