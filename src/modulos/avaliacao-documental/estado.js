/*
  Estado da tela Avaliação documental (`#page-avaliacao-documental`), fora do
  React. Os componentes leem com `useSyncExternalStore`. Este arquivo não
  importa React.

  RPCs (supabase/migrations/20261006100000_regra_da_analise.sql; contrato em
  src/lib/rpc-contrato.js):
    listar_editais_avaliacao(p_area)            os editais da área atual
    obter_regra_analise(p_edital)               regra, versões, modelos, nota
                                                mínima e aldeias
    obter_perguntas_carga_analise(p_edital)     perguntas e respostas da última
                                                carga da Empregare (instantâneo,
                                                só a coordenação), lidas só
                                                quando o assistente abre o passo
                                                das perguntas ou o formulário
                                                as mostra (20261009180000)
    copiar_modelo_regra_analise(...)            versão 1 a partir de um modelo
    salvar_regra_analise(...)                   versão nova (motivo da 2ª em diante)
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
    obter_equipe_edital(p_edital)               gestores, equipe e pessoas
    salvar_equipe_edital(...)                   a equipe inteira
    salvar_aldeias_dsei(...)                    lista de aldeias (admin global)
    definir_origem_analise(...)                 dono da avaliação: MONITORA (as
                                                fichas alimentam o Painel das
                                                análises) ou PLANILHA, com motivo
                                                (20261009200000; coordenação)

  A conta da prévia é a de src/lib/avaliacao-documental/pontuacao.js, feita no
  componente; aqui só a carga e a gravação. A aba aberta (`visao`) mora aqui
  para o "Atualizar" e a reabertura da tela relerem a aba certa.

  Leitura x gravação: a leitura do edital que estava no ar quando uma gravação
  terminou pode ter saído antes dela (banco lento): a resposta velha não
  sobrescreve a gravada; a leitura se refaz.
*/
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";

const RPC_LISTAR_EDITAIS = "listar_editais_avaliacao";
const RPC_OBTER_REGRA = "obter_regra_analise";
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

export const VISOES_DA_AVALIACAO = Object.freeze([
  "regra",
  "equipe",
  "pre",
  "fila",
]);

const ESTADO_INICIAL = Object.freeze({
  area: "",
  visao: "regra",
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
const APOIO_VAZIO = Object.freeze({
  perguntas_por_vaga: [],
  regras_da_area: [],
  classificacao: { pode_ler: false, pode_editar: false, regra: null },
  indisponivel: true,
});

export function mensagemDoBanco(erro) {
  if (erro?.code === "PGRST202")
    return "A Avaliação documental ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return erro.message || "Seu acesso não inclui esta ação.";
  if (erro?.code === "40001")
    return erro.message || "A regra mudou desde que você abriu; recarregue.";
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return erro?.message || mensagemDeFalha(erro);
}

export function criarEstadoDaAvaliacao({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  let estado = ESTADO_INICIAL;
  let pedidoDosEditais = 0;
  let pedidoDoEdital = 0;
  let gravacoes = 0;
  const ouvintes = new Set();

  function publicar(mudancas) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  let identidade;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) {
      pedidoDosEditais += 1;
      pedidoDoEdital += 1;
      publicar(ESTADO_INICIAL);
    }
    identidade = atual;
  });

  async function rpc(nome, argumentos) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /* Os editais da área. Troca de área recomeça do zero. */
  async function carregar(area = estado.area) {
    if (!area) return false;
    const meu = ++pedidoDosEditais;
    if (area !== estado.area) {
      pedidoDoEdital += 1;
      publicar({ ...ESTADO_INICIAL, area, carregandoEditais: true });
    } else publicar({ carregandoEditais: true, erroAoCarregar: "" });
    try {
      const dados = await rpc(RPC_LISTAR_EDITAIS, { p_area: area });
      if (meu !== pedidoDosEditais) return false;
      const editais = Array.isArray(dados?.editais) ? dados.editais : [];
      const escolhido = editais.some((e) => e.id === estado.editalId)
        ? estado.editalId
        : "";
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
        semAcesso: erro?.code === "42501",
        erroAoCarregar: mensagemDoBanco(erro),
      });
      return false;
    }
  }

  /* Abre o edital: a regra e a equipe juntas. */
  async function escolherEdital(editalId) {
    const meu = ++pedidoDoEdital;
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
      const [dados, equipe] = await Promise.all([
        rpc(RPC_OBTER_REGRA, { p_edital: editalId }),
        rpc(RPC_OBTER_EQUIPE, { p_edital: editalId }),
      ]);
      if (meu !== pedidoDoEdital) return false;
      // Gravou-se no meio da leitura: ela pode ser de antes; lê de novo.
      if (gravacoesAntes !== gravacoes) return escolherEdital(editalId);
      publicar({ dados, equipe, carregandoEdital: false });
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

  /* Grava e devolve { ok, erro }; a regra nova volta para a tela. */
  async function gravarRegra(
    nome,
    argumentos,
    aviso,
    { versaoNova = false } = {},
  ) {
    const editalId = estado.editalId;
    publicar({ salvando: true });
    try {
      const resposta = await rpc(nome, argumentos);
      gravacoes += 1;
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

  function atualizarEditalNaLista(editalId, regra) {
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
  async function carregarApoio({ recarregar = false } = {}) {
    const editalId = estado.editalId;
    if (!editalId || (estado.apoio && !recarregar) || estado.carregandoApoio)
      return estado.apoio;
    const meu = ++pedidoDoApoio;
    publicar({ carregandoApoio: true, erroDoApoio: "" });
    try {
      const apoio = await rpc(RPC_OBTER_APOIO, { p_edital: editalId });
      if (meu !== pedidoDoApoio || editalId !== estado.editalId) return null;
      publicar({ apoio: apoio ?? APOIO_VAZIO, carregandoApoio: false });
      return apoio;
    } catch (erro) {
      if (meu !== pedidoDoApoio || editalId !== estado.editalId) return null;
      publicar({
        carregandoApoio: false,
        apoio: erro?.code === "PGRST202" ? APOIO_VAZIO : null,
        erroDoApoio: erro?.code === "PGRST202" ? "" : mensagemDoBanco(erro),
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
  async function carregarPerguntas({ recarregar = false } = {}) {
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
      const dados = await rpc(RPC_OBTER_PERGUNTAS, { p_edital: editalId });
      if (meu !== pedidoDasPerguntas || editalId !== estado.editalId)
        return null;
      const perguntas = Array.isArray(dados?.perguntas) ? dados.perguntas : [];
      publicar({ perguntasDaCarga: perguntas, carregandoPerguntas: false });
      return perguntas;
    } catch (erro) {
      if (meu !== pedidoDasPerguntas || editalId !== estado.editalId)
        return null;
      const semRpc = erro?.code === "PGRST202";
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
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    escolherEdital,
    mudarVisao(visao) {
      if (VISOES_DA_AVALIACAO.includes(visao) && visao !== estado.visao)
        publicar({ visao });
    },
    copiarModelo: (modelo) =>
      gravarRegra(
        RPC_COPIAR_MODELO,
        { p_edital: estado.editalId, p_modelo: modelo },
        "Regra criada a partir do modelo. Confira antes de usar.",
      ),
    /* O nome só vai quando preenchido: sem ele, a chamada é a de antes. */
    salvarRegra: (configuracao, motivo, nome = null) =>
      gravarRegra(
        RPC_SALVAR_REGRA,
        {
          p_edital: estado.editalId,
          p_configuracao: configuracao,
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
    renomearVersao: (versao, nome, motivo) =>
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
    async salvarRegraClassificacao(configuracao, versaoAtual, motivo) {
      const editalId = estado.editalId;
      publicar({ salvando: true });
      try {
        const regra = await rpc(RPC_SALVAR_CLASSIFICACAO, {
          p_edital: editalId,
          p_configuracao: configuracao,
          p_versao_atual: versaoAtual ?? 0,
          p_motivo: motivo || null,
        });
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
    async definirOrigem(origem, motivo) {
      const editalId = estado.editalId;
      publicar({ salvando: true });
      try {
        const r = await rpc(RPC_DEFINIR_ORIGEM, {
          p_edital: editalId,
          p_origem: origem,
          p_motivo: motivo,
        });
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
    async salvarEquipe(equipe, motivo) {
      const editalId = estado.editalId;
      publicar({ salvando: true });
      try {
        const nova = await rpc(RPC_SALVAR_EQUIPE, {
          p_edital: editalId,
          p_equipe: equipe,
          p_motivo: motivo || null,
        });
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
    async salvarAldeias(unidade, aldeias, fonte) {
      publicar({ salvando: true });
      try {
        const r = await rpc(RPC_SALVAR_ALDEIAS, {
          p_unidade: unidade,
          p_aldeias: aldeias,
          p_fonte: fonte,
        });
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
