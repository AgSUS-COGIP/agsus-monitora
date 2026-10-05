/*
  Estado da agenda das entrevistas do edital aberto na Classificação (visão
  "Agenda"), fora do React. Os componentes leem com `useSyncExternalStore`.
  Este arquivo não importa React.

  RPCs (supabase/migrations/20261005120000_agenda_das_entrevistas.sql;
  contrato em src/lib/rpc-contrato.js):
    obter_agenda_entrevista(p_edital)          regra, horários, bancas, histórico
    salvar_regra_agenda_entrevista(...)        nova versão da regra
    salvar_agenda_entrevista(p_edital, p_dados) grava a agenda inteira

  A conta é do motor puro (src/lib/agenda-das-entrevistas.js), feita no
  componente; aqui só a carga, a gravação e o XLSX. A agenda salva também
  preenche DATA e HORA do documento da convocação (`agendaDoDocumento`).

  Sem a migration no banco (PGRST202), a agenda fica `indisponivel` e o
  resto da Classificação segue igual.
*/
import {
  agendaPorCandidato,
  gerarXlsxDaAgenda,
  itensDoBanco,
  MIME_XLSX,
  nomeDoArquivoDaAgenda,
  normalizarRegraDaAgenda,
} from "../../lib/agenda-das-entrevistas.js";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";
import { baixarNoNavegador } from "./estado.js";

const RPC_OBTER_AGENDA = "obter_agenda_entrevista";
const RPC_SALVAR_REGRA_AGENDA = "salvar_regra_agenda_entrevista";
const RPC_SALVAR_AGENDA = "salvar_agenda_entrevista";
const TEMPO_LIMITE_MS = 45000;

const ESTADO_INICIAL = Object.freeze({
  editalId: "",
  dados: null,
  carregando: false,
  erro: "",
  indisponivel: false,
  salvando: false,
});

export function mensagemDaAgenda(erro) {
  if (erro?.code === "PGRST202")
    return "A agenda das entrevistas ainda não foi publicada no banco.";
  if (erro?.code === "42501")
    return "Seu acesso não inclui a agenda deste edital.";
  if (erro?.code === "40001")
    return erro.message || "A agenda mudou desde que você abriu; recarregue.";
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return erro?.message || mensagemDeFalha(erro);
}

export function criarEstadoDaAgenda({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  baixar = baixarNoNavegador,
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  let estado = ESTADO_INICIAL;
  let pedido = 0;
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
      pedido += 1;
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

  /* A agenda do edital (troca de edital começa do zero). */
  async function carregar(editalId) {
    const meu = ++pedido;
    if (!editalId) {
      publicar(ESTADO_INICIAL);
      return false;
    }
    publicar({
      editalId,
      carregando: true,
      erro: "",
      ...(editalId !== estado.editalId ? { dados: null } : {}),
    });
    try {
      const dados = await rpc(RPC_OBTER_AGENDA, { p_edital: editalId });
      if (meu !== pedido) return false;
      publicar({ dados, carregando: false, indisponivel: false });
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({
        carregando: false,
        dados: null,
        indisponivel: erro?.code === "PGRST202",
        erro: mensagemDaAgenda(erro),
      });
      return false;
    }
  }

  /* Salva a regra como versão nova. Devolve true/false; erro vira aviso. */
  async function salvarRegra(configuracao, motivo = "") {
    if (!estado.editalId || estado.salvando) return false;
    publicar({ salvando: true });
    try {
      const regra = await rpc(RPC_SALVAR_REGRA_AGENDA, {
        p_edital: estado.editalId,
        p_configuracao: normalizarRegraDaAgenda(configuracao),
        p_versao_atual: estado.dados?.regra?.versao ?? 0,
        p_motivo: motivo || null,
      });
      publicar({
        salvando: false,
        dados: { ...(estado.dados || {}), regra },
      });
      toast(
        `Regra da agenda salva (versão ${regra?.versao ?? "—"}).`,
        "success",
      );
      return true;
    } catch (erro) {
      publicar({ salvando: false });
      toast(
        `Não foi possível salvar a regra: ${mensagemDaAgenda(erro)}`,
        "error",
      );
      return false;
    }
  }

  /*
    Grava a agenda inteira: acao GERAR | AJUSTAR | LIMPAR, itens no formato de
    itensParaSalvar, lista = a convocação registrada usada (ou null).
  */
  async function salvarAgenda({ acao, itens, lista = null, motivo = "" }) {
    if (!estado.editalId || estado.salvando) return false;
    publicar({ salvando: true });
    try {
      const dados = await rpc(RPC_SALVAR_AGENDA, {
        p_edital: estado.editalId,
        p_dados: {
          acao,
          itens,
          lista,
          versao_regra: estado.dados?.regra?.versao ?? null,
          ultimo_registro: estado.dados?.ultimo_registro ?? null,
          ...(motivo ? { motivo } : {}),
        },
      });
      publicar({ salvando: false, dados });
      toast("Agenda salva.", "success");
      return true;
    } catch (erro) {
      publicar({ salvando: false });
      toast(
        `Não foi possível salvar a agenda: ${mensagemDaAgenda(erro)}`,
        "error",
      );
      return false;
    }
  }

  /* XLSX dos itens mostrados (a agenda salva ou o rascunho). */
  function exportarXlsx(itens) {
    const regra = estado.dados?.regra?.configuracao || null;
    const nome = nomeDoArquivoDaAgenda(estado.dados?.edital?.edital);
    baixar(gerarXlsxDaAgenda(itens, regra), `${nome}.xlsx`, MIME_XLSX);
  }

  /* DATA e HORA do documento da convocação: a agenda salva DESTE edital. */
  function agendaDoDocumento(editalId) {
    if (!editalId || editalId !== estado.editalId || !estado.dados) return null;
    const mapa = agendaPorCandidato(itensDoBanco(estado.dados.itens));
    return mapa.size ? mapa : null;
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    salvarRegra,
    salvarAgenda,
    exportarXlsx,
    agendaDoDocumento,
  };
}
