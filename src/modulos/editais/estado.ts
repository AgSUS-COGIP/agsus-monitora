/*
  Estado da página "Editais" (Equipe Núcleo), fora do React: o resumo dos
  cronogramas, o filtro do painel operacional, qual modal está aberto e as
  ações que vão ao banco. As linhas e o catálogo de unidades não moram aqui:
  são do legado (`dados-do-monitoramento.ts`). Este arquivo não importa React.

  O resumo alimenta duas coisas — os indicadores e a lista de "copiar
  cronograma" — com UMA carga (`resumo.ts`). Trocar de usuário na mesma aba
  apaga tudo o que era da sessão anterior, inclusive a resposta que ainda
  estiver a caminho.
*/

import {
  canMoveEditalBetweenAreas,
  canManageEditais,
  isAdminGlobal,
} from "../../lib/access-roles.ts";
import { ehEditalDeTreinamento } from "../../lib/edital-de-treinamento.ts";
import { exigirSessao } from "../../lib/sessao";
import { analisarCronograma } from "../../lib/cronograma-do-edital.ts";
import { lerAnexoNoServidor } from "../../lib/anexos-do-edital.ts";
import { carregarResumoDoNucleo, createNucleoSummaryStore } from "./resumo.ts";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ClienteDoResumo } from "./resumo.ts";
import type {
  CronogramaNoBanco,
  EtapaDoCronograma,
} from "../../lib/cronograma-do-edital.ts";
import type { QuadroParaSalvar } from "../../lib/anexos-do-edital.ts";
import type {
  ItemDoResumo,
  UnidadeComArea,
  editalParaSalvar,
} from "../../lib/editais-do-nucleo.ts";

/** O cliente Supabase no que a página usa (o do app ou um falso nos testes). */
export interface ClienteDoNucleo extends ClienteDoResumo {
  auth?: Partial<
    Pick<SupabaseClient["auth"], "getSession" | "onAuthStateChange">
  > | null;
}

/**
 * O modal aberto: o formulário do edital (id vazio = novo), a linha do tempo
 * ou as Regras da Triagem do edital (id do monitoramento).
 */
export interface ModalDoNucleo {
  tipo: "edital" | "linha-do-tempo" | "regras-triagem";
  id: string;
  /** Muda a cada abertura: é a `key` do componente. */
  abertura: number;
}

/** "idle" (nada pedido), "loading", "ready" ou "error". */
export type StatusDoResumo = "idle" | "loading" | "ready" | "error";

/** O estado da página "Editais" (o que `obter()` devolve). */
export interface EstadoDoNucleo {
  perfil: unknown;
  resumo: readonly ItemDoResumo[];
  statusDoResumo: StatusDoResumo;
  atualizandoResumo: boolean;
  carregadoEm: string;
  filtro: string;
  modal: ModalDoNucleo | null;
  salvando: boolean;
  geracao: number;
}

/** A resposta de `get_monitoramento_cronograma`, com o que a linha do tempo lê. */
export interface CronogramaLido extends CronogramaNoBanco {
  monitoramento?:
    | (NonNullable<CronogramaNoBanco["monitoramento"]> & {
        edital?: string | null;
        unidade?: string | null;
      })
    | null;
  estado?: {
    status?: string | null;
    etapa?: string | null;
    proxima_atividade?: string | null;
    percentual?: number | string | null;
  } | null;
}

/** O payload do edital (`editalParaSalvar`). */
export type EditalParaSalvar = ReturnType<typeof editalParaSalvar>;

/** O que `salvarEdital` recebe do formulário. */
export interface DadosParaSalvarEdital {
  edital: EditalParaSalvar;
  etapas: readonly EtapaDoCronograma[];
  motivo: unknown;
  errata: unknown;
  quadro?: QuadroParaSalvar | null;
}

/** O que `moverEdital` recebe: o destino, o motivo e os textos da confirmação. */
export interface DadosParaMoverEdital {
  id: string;
  area: string;
  motivo: string;
  rotulo: string;
  de: string;
  para: string;
}

/** O aviso da tela (toast do app). */
export type AvisoDoNucleo = (mensagem: string, tom?: string) => void;

/** O carregador do app (o overlay de "Salvando..."). */
export type CarregadorDoNucleo = (
  ativo: boolean,
  titulo?: string,
  mensagem?: string,
  progresso?: number,
) => void;

export interface OpcoesDoEstadoDoNucleo {
  supabase?: ClienteDoNucleo | null;
  toast?: AvisoDoNucleo;
  loader?: CarregadorDoNucleo;
  getProfile?: () => unknown;
  confirmar?: (mensagem: string) => boolean;
  aoSalvar?: () => unknown;
}

/** A linha que `reiniciarTreinamento` recebe (a do monitoramento). */
interface LinhaParaReiniciar {
  readonly id?: unknown;
}

/** A resposta de `salvar_monitoramento_com_cronograma_v2` e de `mover_edital_de_area`. */
type ConfirmacaoDoBanco = {
  ok?: boolean;
  registro?: { id?: string } | null;
} | null;

/** O erro no que a página lê (PostgrestError, Error e afins). */
type ErroLido = { message?: string } | null | undefined;

const RPC_CRONOGRAMA = "get_monitoramento_cronograma";
const RPC_SALVAR = "salvar_monitoramento_com_cronograma_v2";
const RPC_UNIDADES_POR_AREA = "listar_unidades_por_area";
const RPC_MOVER_DE_AREA = "mover_edital_de_area";
const RPC_QUADRO = "obter_quadro_de_vagas";
const RPC_SALVAR_QUADRO = "salvar_quadro_de_vagas";
const RPC_REINICIAR_TREINAMENTO = "reiniciar_edital_treinamento";
export const EVENTO_CRONOGRAMA_SALVO = "agsus:nucleo-cronograma-saved";

const txt = (valor: unknown) => String(valor ?? "").trim();

const ESTADO_INICIAL: EstadoDoNucleo = Object.freeze({
  perfil: null,
  resumo: Object.freeze([]),
  /** "idle" (nada pedido), "loading", "ready" ou "error". */
  statusDoResumo: "idle" as StatusDoResumo,
  atualizandoResumo: false,
  /** Quando o último resumo chegou (ISO), para a data discreta do topo. */
  carregadoEm: "",
  filtro: "todos",
  /*
    O modal aberto, ou `null`. `abertura` muda a cada abertura, e o componente
    a usa como `key`: reabrir começa de um formulário limpo.
      { tipo: "edital", id }          id vazio = edital novo
      { tipo: "linha-do-tempo", id }
  */
  modal: null,
  salvando: false,
  /** Muda quando a sessão troca de usuário: o que foi pedido antes não vale. */
  geracao: 0,
});

/* Depois de salvar: o legado recarrega tudo (mapa incluído) e reabre a página. */
async function recarregarPeloLegado() {
  await window.refreshData?.();
  window.navigate?.("nucleo");
}

export function criarEstadoDoNucleo({
  supabase = null,
  toast = (mensagem) => console.info(mensagem),
  loader = () => {},
  getProfile = () => null,
  confirmar = (mensagem) => window.confirm(mensagem),
  aoSalvar = recarregarPeloLegado,
}: OpcoesDoEstadoDoNucleo = {}) {
  let estado = ESTADO_INICIAL;
  let aberturas = 0;
  const ouvintes = new Set<() => void>();
  const resumo = createNucleoSummaryStore({
    loader: () => carregarResumoDoNucleo(supabase),
  });
  let pedido: {
    fonte: Promise<ItemDoResumo[]> | null;
    pendente: Promise<ItemDoResumo[]> | null;
    token: number;
  } = { fonte: null, pendente: null, token: 0 };
  /* Unidades com área (TA_UNIDADE_AREA): uma carga por sessão, refeita depois de salvar. */
  let unidadesPorArea: Promise<UnidadeComArea[]> | null = null;
  let identidade: string | null | undefined;

  function publicar(mudancas: Partial<EstadoDoNucleo>) {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  }

  const perfil = () => getProfile() || null;

  // ── Resumo ─────────────────────────────────────────────────────────────

  function carregarResumo({
    force = false,
    invalidate = false,
  }: { force?: boolean; invalidate?: boolean } = {}): Promise<ItemDoResumo[]> {
    if (invalidate) resumo.invalidate();
    const fonte = resumo.get({ force });
    // Duas chamadas seguidas partilham a mesma carga.
    if (pedido.fonte === fonte) return pedido.pendente!;
    const token = pedido.token + 1;
    pedido = { fonte, pendente: null, token };
    publicar({
      atualizandoResumo: true,
      ...(estado.statusDoResumo === "ready"
        ? {}
        : { statusDoResumo: "loading" }),
    });
    const pendente = fonte
      .then((linhas) => {
        if (token !== pedido.token) return linhas;
        publicar({
          resumo: Array.isArray(linhas) ? linhas : [],
          statusDoResumo: "ready",
          carregadoEm: new Date().toISOString(),
        });
        return linhas;
      })
      .catch((erro) => {
        if (token !== pedido.token) throw erro;
        // O detalhe técnico fica no console; a tela oferece "Tentar de novo".
        console.error("Erro ao carregar resumo da Equipe Núcleo:", erro);
        publicar({ statusDoResumo: "error" });
        throw erro;
      })
      .finally(() => {
        if (token !== pedido.token) return;
        pedido = { fonte: null, pendente: null, token };
        publicar({ atualizandoResumo: false });
      });
    pedido.pendente = pendente;
    return pendente;
  }

  /** O mesmo resumo, para a lista de "copiar cronograma de outro edital". */
  function editaisParaCopiar() {
    return resumo.get();
  }

  /*
    Sessão de outro usuário na mesma aba: o que era da anterior sai. Nada de
    chamar o `auth` aqui dentro — é o callback do próprio `auth`.
  */
  function reiniciarSessao() {
    resumo.invalidate();
    unidadesPorArea = null;
    pedido = { fonte: null, pendente: null, token: pedido.token + 1 };
    publicar({
      resumo: [],
      statusDoResumo: "idle",
      atualizandoResumo: false,
      carregadoEm: "",
      filtro: "todos",
      geracao: estado.geracao + 1,
    });
  }

  const assinaturaDoAuth = supabase?.auth?.onAuthStateChange?.(
    (_evento, sessao) => {
      const atual = sessao?.user?.id || null;
      if (atual === identidade) return;
      // O primeiro SIGNED_IN da página só registra quem é; não há o que limpar.
      if (identidade !== undefined || !atual) reiniciarSessao();
      identidade = atual;
    },
  );

  // Um cronograma salvo (daqui ou de outra tela) deixa o resumo velho.
  const invalidarResumo = () => resumo.invalidate();
  document.addEventListener(EVENTO_CRONOGRAMA_SALVO, invalidarResumo);

  // ── Cronograma ─────────────────────────────────────────────────────────

  async function lerCronograma(id: unknown): Promise<CronogramaLido> {
    if (!supabase) throw new Error("Supabase indisponível.");
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(RPC_CRONOGRAMA, {
      p_monitoramento_id: id,
    });
    if (error) throw error;
    // A fronteira com o banco: a resposta da RPC.
    return (data || {}) as CronogramaLido;
  }

  // ── Anexos (PDF) e quadro de vagas ─────────────────────────────────────

  /** Lê os PDFs de anexos na função Python, um por vez. */
  async function lerAnexos(arquivos: readonly File[] | null | undefined) {
    if (!supabase) throw new Error("Supabase indisponível.");
    const sessao = await exigirSessao(supabase);
    const resultados: Awaited<ReturnType<typeof lerAnexoNoServidor>>[] = [];
    for (const arquivo of arquivos || [])
      resultados.push(
        // `exigirSessao` só volta com a sessão ativa; sem ela, lança.
        await lerAnexoNoServidor(arquivo, { token: sessao!.access_token }),
      );
    return resultados;
  }

  async function lerQuadroDeVagas(id: unknown): Promise<unknown> {
    if (!supabase) throw new Error("Supabase indisponível.");
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(RPC_QUADRO, { p_edital: id });
    if (error) throw error;
    return data || {};
  }

  /** Grava o quadro de vagas de um edital já cadastrado, sem esperar o Salvar do edital. */
  async function salvarQuadroDeVagas(
    id: unknown,
    quadro: QuadroParaSalvar,
  ): Promise<unknown> {
    if (!supabase) throw new Error("Supabase indisponível.");
    await exigirSessao(supabase);
    const { data, error } = await supabase.rpc(RPC_SALVAR_QUADRO, {
      p_edital: id,
      p_dados: quadro,
    });
    if (error) throw error;
    return data || {};
  }

  /*
    As unidades com área definida, para o formulário oferecer só as da área.
    Falhar aqui não impede de editar: o formulário cai na área gravada nos
    editais, e o banco confere a unidade ao salvar.
  */
  function lerUnidadesPorArea(): Promise<UnidadeComArea[]> {
    if (!supabase) return Promise.resolve([]);
    if (!unidadesPorArea)
      unidadesPorArea = exigirSessao(supabase)
        .then(() => supabase.rpc(RPC_UNIDADES_POR_AREA))
        .then(({ data, error }) => {
          if (error) throw error;
          return Array.isArray(data) ? (data as UnidadeComArea[]) : [];
        })
        .catch((erro: unknown) => {
          console.warn(
            "Unidades por área indisponíveis:",
            (erro as ErroLido)?.message || erro,
          );
          unidadesPorArea = null;
          return [];
        });
    return unidadesPorArea;
  }

  /**
   * Salva o edital e o cronograma numa só RPC, com o motivo no histórico.
   * Erro de validação não chega ao banco; aviso pede confirmação.
   */
  async function salvarEdital({
    edital,
    etapas,
    motivo,
    errata,
    quadro = null,
  }: DadosParaSalvarEdital): Promise<boolean> {
    if (estado.salvando) return false;
    if (!canManageEditais(perfil())) {
      toast("Sem permissão para salvar editais.", "warn");
      return false;
    }
    // Edital novo não tem cronograma anterior a justificar (o banco registra "Cadastro do edital").
    const analise = analisarCronograma(edital, etapas, motivo, {
      exigirMotivo: Boolean(edital.id),
    });
    if (analise.erros.length) {
      toast(analise.erros[0]!, "warn");
      return false;
    }
    if (
      analise.avisos.length &&
      !confirmar(
        `Foram encontrados ${analise.avisos.length} ponto(s) para revisão. Deseja salvar mesmo assim?`,
      )
    )
      return false;

    publicar({ salvando: true });
    loader(true, "Editais", "Salvando edital e cronograma...", 70);
    try {
      await exigirSessao(supabase);
      const cronograma = etapas.map((etapa, indice) => ({
        ...etapa,
        ordem: indice + 1,
      }));
      // Sem Supabase, `exigirSessao` já lançou (o erro vira o aviso abaixo).
      const { data, error } = await supabase!.rpc(RPC_SALVAR, {
        p_payload: edital,
        p_cronograma: cronograma,
        p_motivo: txt(motivo),
        p_numero_errata: txt(errata) || null,
      });
      if (error) throw error;
      if (!(data as ConfirmacaoDoBanco)?.ok)
        throw new Error("O Supabase não confirmou o salvamento.");
      // Uma unidade nova pode ter sido registrada na área.
      unidadesPorArea = null;

      /*
        O quadro de vagas importado do PDF vai depois do edital (o edital novo
        só tem id agora). Falhar aqui não desfaz o edital salvo: avisa.
      */
      let avisoDoQuadro = "";
      const idSalvo = (data as ConfirmacaoDoBanco)?.registro?.id || edital.id;
      if (quadro?.linhas?.length && idSalvo) {
        const gravou = await supabase!.rpc(RPC_SALVAR_QUADRO, {
          p_edital: idSalvo,
          p_dados: quadro,
        });
        avisoDoQuadro = gravou.error
          ? ` O quadro de vagas não foi salvo: ${gravou.error.message}`
          : ` Quadro de vagas: ${quadro.linhas.length} linha(s).`;
      }

      /*
        O aviso sai antes de reabrir a página: ele invalida o resumo (aqui e no
        calendário), e a página reaberta já pede o novo.
      */
      publicar({ modal: null });
      document.dispatchEvent(
        new CustomEvent(EVENTO_CRONOGRAMA_SALVO, {
          detail: { id: (data as ConfirmacaoDoBanco)?.registro?.id, data },
        }),
      );
      await aoSalvar();
      const mensagem = `${edital.edital} salvo. ${cronograma.length} etapa(s) registradas e histórico atualizado.${avisoDoQuadro}`;
      if (avisoDoQuadro.includes("não foi salvo")) toast(mensagem, "warn");
      else toast(mensagem);
      return true;
    } catch (erro) {
      toast(
        `Erro ao salvar edital: ${(erro as ErroLido)?.message || erro}`,
        "error",
      );
      return false;
    } finally {
      loader(false);
      publicar({ salvando: false });
    }
  }

  /**
   * Só admin: muda o edital de área, com motivo (auditado no banco). Pede
   * confirmação citando o edital e as duas áreas.
   */
  async function moverEdital({
    id,
    area,
    motivo,
    rotulo,
    de,
    para,
  }: DadosParaMoverEdital): Promise<boolean> {
    if (estado.salvando) return false;
    if (!canMoveEditalBetweenAreas(perfil())) {
      toast("Só administradores podem mover editais de área.", "warn");
      return false;
    }
    if (!txt(area)) {
      toast("Escolha a área de destino.", "warn");
      return false;
    }
    if (!txt(motivo)) {
      toast("Informe o motivo da mudança de área.", "warn");
      return false;
    }
    if (!confirmar(`Mover o edital ${rotulo} de ${de} para ${para}?`))
      return false;

    publicar({ salvando: true });
    loader(true, "Editais", "Movendo edital de área...", 70);
    try {
      await exigirSessao(supabase);
      const { data, error } = await supabase!.rpc(RPC_MOVER_DE_AREA, {
        p_id: id,
        p_area: area,
        p_motivo: txt(motivo),
      });
      if (error) throw error;
      if (!(data as ConfirmacaoDoBanco)?.ok)
        throw new Error("O Supabase não confirmou a mudança.");
      publicar({ modal: null });
      document.dispatchEvent(
        new CustomEvent(EVENTO_CRONOGRAMA_SALVO, { detail: { id, data } }),
      );
      await aoSalvar();
      toast(`${rotulo} movido para ${para}.`);
      return true;
    } catch (erro) {
      toast(
        `Erro ao mover edital: ${(erro as ErroLido)?.message || erro}`,
        "error",
      );
      return false;
    } finally {
      loader(false);
      publicar({ salvando: false });
    }
  }

  /**
   * Só admin global, só o edital de treinamento: volta os dados fictícios ao
   * início (o banco recusa edital real). A confirmação é na própria página
   * (LinhaDoEdital), por isso aqui não pergunta de novo.
   */
  async function reiniciarTreinamento(
    linha: LinhaParaReiniciar,
  ): Promise<boolean> {
    if (estado.salvando) return false;
    if (!isAdminGlobal(perfil())) {
      toast("Só o administrador global reinicia o treinamento.", "warn");
      return false;
    }
    if (!ehEditalDeTreinamento(linha)) {
      toast("Só o edital de treinamento pode ser reiniciado.", "warn");
      return false;
    }
    publicar({ salvando: true });
    loader(true, "Editais", "Reiniciando o treinamento...", 70);
    try {
      await exigirSessao(supabase);
      const { error } = await supabase!.rpc(RPC_REINICIAR_TREINAMENTO, {
        p_edital: linha.id,
      });
      if (error) throw error;
      document.dispatchEvent(
        new CustomEvent(EVENTO_CRONOGRAMA_SALVO, { detail: { id: linha.id } }),
      );
      await aoSalvar();
      toast("Treinamento reiniciado.");
      return true;
    } catch (erro) {
      toast(
        `Erro ao reiniciar o treinamento: ${(erro as ErroLido)?.message || erro}`,
        "error",
      );
      return false;
    } finally {
      loader(false);
      publicar({ salvando: false });
    }
  }

  // ── Modais ─────────────────────────────────────────────────────────────

  function abrir(modal: Omit<ModalDoNucleo, "abertura">) {
    aberturas += 1;
    publicar({ modal: { ...modal, abertura: aberturas }, perfil: perfil() });
  }

  function abrirEdital(id: unknown = "") {
    if (!canManageEditais(perfil())) {
      toast(
        "Seu perfil pode consultar Editais, mas não editar editais.",
        "warn",
      );
      return;
    }
    abrir({ tipo: "edital", id: txt(id) });
  }

  return {
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    toast,
    confirmar,
    /* O perfil muda sem aviso do legado: a página relê a cada abertura. */
    sincronizarPerfil: () => publicar({ perfil: perfil() }),
    carregarResumo,
    editaisParaCopiar,
    filtrarPor: (filtro: string | null | undefined) =>
      publicar({ filtro: filtro || "todos" }),
    abrirEdital,
    abrirLinhaDoTempo: (id: unknown) =>
      abrir({ tipo: "linha-do-tempo", id: txt(id) }),
    /* Quem lê e quem edita é o banco (obter/salvar_regra_triagem). */
    abrirRegrasDaTriagem: (id: unknown) =>
      abrir({ tipo: "regras-triagem", id: txt(id) }),
    /* O cliente das RPCs da regra da Triagem (o modal chama direto). */
    clienteDaRegra: () => supabase,
    fecharModal: () => estado.modal && publicar({ modal: null }),
    lerCronograma,
    lerUnidadesPorArea,
    lerAnexos,
    lerQuadroDeVagas,
    salvarQuadroDeVagas,
    salvarEdital,
    moverEdital,
    reiniciarTreinamento,
    desligar() {
      assinaturaDoAuth?.data?.subscription?.unsubscribe?.();
      document.removeEventListener(EVENTO_CRONOGRAMA_SALVO, invalidarResumo);
    },
  };
}
