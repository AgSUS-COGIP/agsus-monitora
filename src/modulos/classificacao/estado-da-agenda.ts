import type {
  ClienteDaClassificacao,
  OpcoesDoEstado,
} from "./tipos-do-estado.ts";
import type {
  ItemDaAgenda,
  ItemParaSalvar,
} from "../../lib/tipos-da-agenda.ts";
import {
  dadosDaAgenda,
  objeto,
  regraRegistradaDaAgenda,
} from "../../lib/dados-da-agenda.ts";
import type { DadosDaAgenda } from "../../lib/dados-da-agenda.ts";
import { ehConflitoDeVersao } from "../../lib/conflito-de-versao.ts";
type SnapshotDaAgenda = {
  editalId: string;
  dados: DadosDaAgenda | null;
  carregando: boolean;
  erro: string;
  indisponivel: boolean;
  salvando: boolean;
};
type Opcoes = {
  supabase?: ClienteDaClassificacao | null;
  toast?: OpcoesDoEstado["toast"];
  baixar?: OpcoesDoEstado["baixar"];
  tempoLimiteMs?: number;
};

/*
  Estado da agenda das entrevistas do edital aberto na Classificação (visão
  "Agenda"), fora do React. Os componentes leem com `useSyncExternalStore`.
  Este arquivo não importa React.

  RPCs (supabase/migrations/20261005120000_agenda_das_entrevistas.sql;
  contrato em src/lib/rpc-contrato.js):
    obter_agenda_entrevista(p_edital)          regra, horários, bancas, histórico
    salvar_regra_agenda_entrevista(...)        nova versão da regra
    salvar_agenda_entrevista(p_edital, p_dados) grava a agenda inteira

  A conta é do motor puro (src/lib/agenda-das-entrevistas.ts), feita no
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
} from "../../lib/agenda-das-entrevistas.ts";
import {
  comTempoLimite,
  ehFalhaDeConexao,
  mensagemDeFalha,
} from "../../lib/falha-de-rede.js";
import { baixarNoNavegador } from "./estado.ts";

const RPC_OBTER_AGENDA = "obter_agenda_entrevista";
const RPC_SALVAR_REGRA_AGENDA = "salvar_regra_agenda_entrevista";
const RPC_SALVAR_AGENDA = "salvar_agenda_entrevista";
const TEMPO_LIMITE_MS = 45000;

const ESTADO_INICIAL: SnapshotDaAgenda = Object.freeze({
  editalId: "",
  dados: null,
  carregando: false,
  erro: "",
  indisponivel: false,
  salvando: false,
});

export function mensagemDaAgenda(erro: unknown) {
  const dados = objeto(erro);
  if (objeto(erro).code === "PGRST202")
    return "A agenda das entrevistas ainda não foi publicada no banco.";
  if (objeto(erro).code === "42501")
    return "Seu acesso não inclui a agenda deste edital.";
  if (ehConflitoDeVersao(erro))
    return (
      String(dados.message || "") ||
      "A agenda mudou desde que você abriu; recarregue."
    );
  if (ehFalhaDeConexao(erro)) return mensagemDeFalha(erro);
  return String(dados.message || "") || mensagemDeFalha(erro);
}

/** @param {{supabase?: import("./tipos-do-estado.ts").ClienteDaClassificacao | null, toast?: (mensagem: string, tom?: string) => void, baixar?: import("./tipos-do-estado.ts").OpcoesDoEstado['baixar']}} [opcoes] */
export function criarEstadoDaAgenda({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  baixar = baixarNoNavegador,
  tempoLimiteMs = TEMPO_LIMITE_MS,
}: Opcoes = {}) {
  let estado = ESTADO_INICIAL;
  let pedido = 0;
  const ouvintes = new Set<() => void>();
  let geracao = 0;

  function publicar(mudancas: Partial<SnapshotDaAgenda>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  let identidade: string | null | undefined;
  supabase?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === identidade) return;
    if (identidade !== undefined || !atual) {
      pedido += 1;
      geracao += 1;
      publicar(ESTADO_INICIAL);
    }
    identidade = atual;
  });

  async function rpc(
    nome:
      | typeof RPC_OBTER_AGENDA
      | typeof RPC_SALVAR_REGRA_AGENDA
      | typeof RPC_SALVAR_AGENDA,
    argumentos: Record<string, unknown>,
  ) {
    if (!supabase) throw new Error("Sem conexão com o banco.");
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /*
    A agenda do edital (troca de edital começa do zero). Falha ao recarregar
    o mesmo edital ("Atualizar") mantém a agenda que já estava na tela — e o
    rascunho em cima dela; só o aviso do erro aparece.
  */
  async function carregar(editalId: string) {
    const meu = ++pedido;
    const mudou = editalId !== estado.editalId;
    if (mudou) geracao += 1;
    if (!editalId) {
      publicar(ESTADO_INICIAL);
      return false;
    }
    publicar({
      editalId,
      carregando: true,
      erro: "",
      ...(mudou ? { dados: null, salvando: false, indisponivel: false } : {}),
    });
    try {
      const dados = dadosDaAgenda(
        await rpc(RPC_OBTER_AGENDA, { p_edital: editalId }),
      );
      if (meu !== pedido) return false;
      if (dados.edital.id !== editalId)
        throw new Error("A agenda recebida pertence a outro edital.");
      publicar({ dados, carregando: false, indisponivel: false });
      return true;
    } catch (erro) {
      if (meu !== pedido) return false;
      publicar({
        carregando: false,
        indisponivel: objeto(erro).code === "PGRST202",
        erro: mensagemDaAgenda(erro),
      });
      return false;
    }
  }

  /*
    Aplica a resposta de uma gravação só se o edital ainda é o mesmo: trocar de
    edital enquanto a RPC corre não pode pôr a regra ou a agenda de um edital
    nos dados do outro.
  */
  const mudarDados = (
    edital: string,
    mudar: (d: DadosDaAgenda | null) => DadosDaAgenda,
  ) => {
    if (estado.editalId !== edital) return;
    publicar({ dados: mudar(estado.dados) });
  };

  /* Salva a regra como versão nova. Devolve true/false; erro vira aviso. */
  async function salvarRegra(configuracao: unknown, motivo = "") {
    if (!estado.editalId || estado.salvando) return false;
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    publicar({ salvando: true });
    try {
      const regra = regraRegistradaDaAgenda(
        await rpc(RPC_SALVAR_REGRA_AGENDA, {
          p_edital: edital,
          p_configuracao: normalizarRegraDaAgenda(configuracao),
          p_versao_atual: estado.dados?.regra?.versao ?? 0,
          p_motivo: motivo || null,
        }),
      );
      if (!vigente()) return false;
      if (!regra) throw new Error("Regra da agenda inválida.");
      mudarDados(edital, (d) =>
        dadosDaAgenda({
          ...(d || {}),
          edital: { ...d?.edital, id: edital },
          regra,
        }),
      );
      publicar({ salvando: false });
      toast(
        `Regra da agenda salva (versão ${regra?.versao ?? "—"}).`,
        "success",
      );
      return true;
    } catch (erro) {
      if (!vigente()) return false;
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
  async function salvarAgenda({
    acao,
    itens,
    lista = null,
    motivo = "",
  }: {
    acao: "GERAR" | "AJUSTAR" | "LIMPAR";
    itens: ItemParaSalvar[];
    lista?: string | null;
    motivo?: string;
  }) {
    if (!estado.editalId || estado.salvando) return false;
    const edital = estado.editalId;
    const minhaGeracao = geracao;
    const vigente = () =>
      minhaGeracao === geracao && estado.editalId === edital;
    publicar({ salvando: true });
    try {
      const dados = dadosDaAgenda(
        await rpc(RPC_SALVAR_AGENDA, {
          p_edital: edital,
          p_dados: {
            acao,
            itens,
            lista,
            versao_regra: estado.dados?.regra?.versao ?? null,
            ultimo_registro: estado.dados?.ultimo_registro ?? null,
            ...(motivo ? { motivo } : {}),
          },
        }),
      );
      if (!vigente()) return false;
      if (dados.edital.id !== edital)
        throw new Error("A agenda recebida pertence a outro edital.");
      mudarDados(edital, () => dados);
      publicar({ salvando: false });
      toast("Agenda salva.", "success");
      return true;
    } catch (erro) {
      if (!vigente()) return false;
      publicar({ salvando: false });
      toast(
        `Não foi possível salvar a agenda: ${mensagemDaAgenda(erro)}`,
        "error",
      );
      return false;
    }
  }

  /* XLSX dos itens mostrados (a agenda salva ou o rascunho). */
  function exportarXlsx(itens: ItemDaAgenda[]) {
    const regra = estado.dados?.regra?.configuracao || null;
    const nome = nomeDoArquivoDaAgenda(estado.dados?.edital?.edital);
    baixar(gerarXlsxDaAgenda(itens, regra), `${nome}.xlsx`, MIME_XLSX);
  }

  /* DATA e HORA do documento da convocação: a agenda salva DESTE edital. */
  function agendaDoDocumento(editalId: string) {
    if (!editalId || editalId !== estado.editalId || !estado.dados) return null;
    const mapa = agendaPorCandidato(itensDoBanco(estado.dados.itens));
    return mapa.size ? mapa : null;
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
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
