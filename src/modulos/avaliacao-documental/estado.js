/*
  Estado da tela Avaliação documental (`#page-avaliacao-documental`), fora do
  React. Os componentes leem com `useSyncExternalStore`. Este arquivo não
  importa React.

  RPCs (supabase/migrations/20261006100000_regra_da_analise.sql; contrato em
  src/lib/rpc-contrato.js):
    listar_editais_avaliacao(p_area)            os editais da área atual
    obter_regra_analise(p_edital)               regra, versões, modelos, nota
                                                mínima, aldeias e perguntas
    copiar_modelo_regra_analise(...)            versão 1 a partir de um modelo
    salvar_regra_analise(...)                   versão nova (motivo da 2ª em diante)
    conferir_regra_analise(...)                 a coordenação conferiu
    obter_equipe_edital(p_edital)               gestores, equipe e pessoas
    salvar_equipe_edital(...)                   a equipe inteira
    salvar_aldeias_dsei(...)                    lista de aldeias (admin global)

  A conta da prévia é a de src/lib/avaliacao-documental/pontuacao.js, feita no
  componente; aqui só a carga e a gravação.
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
const RPC_OBTER_EQUIPE = "obter_equipe_edital";
const RPC_SALVAR_EQUIPE = "salvar_equipe_edital";
const RPC_SALVAR_ALDEIAS = "salvar_aldeias_dsei";

export const MENSAGEM_SEM_ACESSO = "Sem acesso à Avaliação documental";
const TEMPO_LIMITE_MS = 45000;

const ESTADO_INICIAL = Object.freeze({
  area: "",
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
      ...(editalId !== estado.editalId ? { dados: null, equipe: null } : {}),
    });
    try {
      const [dados, equipe] = await Promise.all([
        rpc(RPC_OBTER_REGRA, { p_edital: editalId }),
        rpc(RPC_OBTER_EQUIPE, { p_edital: editalId }),
      ]);
      if (meu !== pedidoDoEdital) return false;
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
  async function gravarRegra(nome, argumentos, aviso) {
    const editalId = estado.editalId;
    publicar({ salvando: true });
    try {
      const resposta = await rpc(nome, argumentos);
      if (editalId === estado.editalId && estado.dados)
        publicar({
          dados: { ...estado.dados, regra: resposta?.regra ?? null },
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
          ? { ...e, versao_regra: regra.versao, situacao_regra: regra.situacao }
          : e,
      ),
    });
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    escolherEdital,
    copiarModelo: (modelo) =>
      gravarRegra(
        RPC_COPIAR_MODELO,
        { p_edital: estado.editalId, p_modelo: modelo },
        "Regra criada a partir do modelo. Confira antes de usar.",
      ),
    salvarRegra: (configuracao, motivo) =>
      gravarRegra(
        RPC_SALVAR_REGRA,
        {
          p_edital: estado.editalId,
          p_configuracao: configuracao,
          p_versao_atual: estado.dados?.regra?.versao ?? 0,
          p_motivo: motivo || null,
        },
        "Regra salva como versão nova.",
      ),
    conferirRegra: () =>
      gravarRegra(
        RPC_CONFERIR_REGRA,
        { p_edital: estado.editalId, p_versao: estado.dados?.regra?.versao },
        "Regra marcada como conferida.",
      ),
    async salvarEquipe(equipe, motivo) {
      const editalId = estado.editalId;
      publicar({ salvando: true });
      try {
        const nova = await rpc(RPC_SALVAR_EQUIPE, {
          p_edital: editalId,
          p_equipe: equipe,
          p_motivo: motivo || null,
        });
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
