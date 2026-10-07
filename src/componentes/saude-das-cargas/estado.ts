import type {
  DependenciasDaSaude,
  EstadoDaSaude,
  SnapshotDaSaude,
  OpcoesConferidas,
} from "./tipos.ts";
/*
  Estado da seção Status das atualizações, fora do React: a última leitura de
  `get_saude_das_cargas` já normalizada (src/lib/saude-das-cargas.ts), o
  perfil e o erro. A tela lê com `useSyncExternalStore`. Não importa React.

  "Rodar agora" (os robôs de ROBOS_DE_CARGA): a RPC disparar_robo pede ao
  banco, que chama o GitHub com a chave do Vault (20261008140000); `pedidos`
  e `avisos` guardam o último clique de cada carga nesta tela, e
  situacao_do_disparo_robo diz se o GitHub aceitou (ou se a chave falta ou
  expirou). As regras do botão são de src/lib/robos-de-carga.js.

  "Rodar com opções" e as últimas execuções: `painel` guarda
  get_painel_dos_robos (editais e histórico, src/lib/painel-dos-robos.ts);
  `buscarVagas` pede listar_vagas_dos_robos para as sugestões do formulário;
  `acompanhamentos` guarda o último pedido de cada robô (quando, qual modo,
  o id do pedido e a situação dele) e, enquanto ele não termina, a tela
  relê a cada 20 s.
*/
import { isAdminGlobal } from "../../lib/access-roles.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import {
  acompanhamentoDoPedido,
  normalizarPainel,
  normalizarVagas,
} from "../../lib/painel-dos-robos.ts";
import {
  inputsDoPedido,
  mensagemDoErroDoDisparo,
  roboDeCarga,
  RPC_DISPARAR_ROBO,
  RPC_SITUACAO_DO_DISPARO,
  situacaoDoPedido,
} from "../../lib/robos-de-carga.js";
import { normalizarSaude } from "../../lib/saude-das-cargas.ts";

const ESPERA_DEPOIS_DO_PEDIDO_MS = 20000;
/* O GitHub responde ao banco em 1 ou 2 s: a primeira conferência do pedido. */
const ESPERA_DA_RESPOSTA_MS = 3000;
const RPC_PAINEL_DOS_ROBOS = "get_painel_dos_robos";
const RPC_VAGAS_DOS_ROBOS = "listar_vagas_dos_robos";

export function criarEstadoDaSaude({
  supabase,
  getProfile,
  agora = () => new Date(),
  agendar = (fn, ms) => setTimeout(fn, ms),
}: DependenciasDaSaude): EstadoDaSaude {
  let estado: SnapshotDaSaude = {
    status: "idle",
    dados: null,
    bruto: null,
    erro: "",
    erroCodigo: "",
    perfil: null,
    pedidos: {},
    avisos: {},
    painel: { status: "idle", dados: null, erro: "" },
    acompanhamentos: {},
  };
  let pedido = 0;
  let releituraAgendada = false;
  const ouvintes = new Set<() => void>();
  const publicar = (mudancas: Partial<SnapshotDaSaude>) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function carregar() {
    const meu = ++pedido;
    const perfil = getProfile?.() || null;
    publicar({ status: "loading", perfil });
    if (perfil && !isAdminGlobal(perfil)) {
      publicar({ status: "ready" });
      return;
    }
    const extras = Promise.all([conferirPedidos(), carregarPainel()]);
    if (!supabase) {
      publicar({
        status: "error",
        erro: "Sem conexão com o banco.",
        erroCodigo: "",
      });
      return;
    }
    let resposta;
    try {
      resposta = await comTempoLimite(
        supabase.rpc("get_saude_das_cargas"),
        30000,
      );
    } catch (falha) {
      if (meu !== pedido) return;
      publicar({
        status: "error",
        erro: mensagemDeFalha(falha),
        erroCodigo: "",
      });
      return;
    }
    const { data, error } = resposta;
    if (meu !== pedido) return;
    if (error) {
      publicar({
        status: "error",
        erro: error.message || "Falha ao consultar as atualizações.",
        erroCodigo: error.code || "",
      });
      return;
    }
    publicar({
      status: "ready",
      bruto: data,
      dados: normalizarSaude(data, agora()),
      erro: "",
      erroCodigo: "",
    });
    await extras;
    if (meu === pedido) acompanhar();
  }

  /* get_painel_dos_robos: editais da escolha e as últimas execuções. */
  async function carregarPainel() {
    if (!supabase) return;
    publicar({ painel: { ...estado.painel, status: "loading" } });
    try {
      const { data, error } = await comTempoLimite(
        supabase.rpc(RPC_PAINEL_DOS_ROBOS),
        30000,
      );
      if (error) {
        publicar({
          painel: {
            status: error.code === "PGRST202" ? "sem_funcao" : "error",
            dados: estado.painel.dados,
            erro: error.message || "Falha ao consultar os robôs.",
          },
        });
        return;
      }
      publicar({
        painel: { status: "ready", dados: normalizarPainel(data), erro: "" },
      });
    } catch (falha) {
      publicar({
        painel: {
          status: "error",
          dados: estado.painel.dados,
          erro: mensagemDeFalha(falha),
        },
      });
    }
  }

  /* listar_vagas_dos_robos: as vagas conhecidas dos editais ou dos códigos. */
  async function buscarVagas({
    editais = [],
    vagas = [],
  }: { editais?: string[]; vagas?: string[] } = {}) {
    if (!supabase || (!editais.length && !vagas.length))
      return { vagas: [], erro: "" };
    try {
      const { data, error } = await comTempoLimite(
        supabase.rpc(RPC_VAGAS_DOS_ROBOS, {
          p_editais: editais.length ? editais : null,
          p_vagas: vagas.length ? vagas : null,
        }),
        30000,
      );
      if (error)
        return {
          vagas: [],
          erro:
            error.code === "PGRST202"
              ? "O banco ainda não tem as vagas dos robôs (migration 20261007180000)."
              : error.message || "Não consegui buscar as vagas.",
        };
      return { vagas: normalizarVagas(data), erro: "" };
    } catch (falha) {
      return { vagas: [], erro: mensagemDeFalha(falha) };
    }
  }

  /*
    Enquanto algum pedido desta tela não terminou (e não passou do tempo
    limite do workflow), relê em 20 s: uma releitura agendada por vez.
  */
  function acompanhar() {
    if (releituraAgendada) return;
    const agoraMs = agora().getTime();
    const pendente = Object.entries(estado.acompanhamentos).some(
      ([id, pedidoDoRobo]) => {
        const robo = roboDeCarga(id);
        if (!robo || !pedidoDoRobo?.em) return false;
        if (agoraMs - pedidoDoRobo.em.getTime() > robo.limiteMin * 60000)
          return false;
        const situacao = acompanhamentoDoPedido({
          robo: id,
          pedido: pedidoDoRobo,
          execucoes: estado.painel.dados?.execucoes?.[id] || [],
        });
        return !(
          situacao?.etapa === "terminou" ||
          situacao?.etapa === "recusado" ||
          (situacao?.etapa === "github" && situacao.semRegistro)
        );
      },
    );
    if (!pendente) return;
    releituraAgendada = true;
    agendar(() => {
      releituraAgendada = false;
      void carregar();
    }, ESPERA_DEPOIS_DO_PEDIDO_MS);
  }

  /*
    situacao_do_disparo_robo: o GitHub aceitou? Se recusou (ou falta a chave),
    o acompanhamento da linha diz o que fazer e o botão volta a ficar
    disponível.
  */
  async function conferirPedido(id: string) {
    const pedidoDoRobo = estado.acompanhamentos[id];
    if (!supabase || !pedidoDoRobo?.id || pedidoDoRobo.disparo?.terminou)
      return;
    let resposta;
    try {
      resposta = await comTempoLimite(
        supabase.rpc(RPC_SITUACAO_DO_DISPARO, { p_disparo: pedidoDoRobo.id }),
        20000,
      );
    } catch {
      return;
    }
    if (resposta?.error || estado.acompanhamentos[id] !== pedidoDoRobo) return;
    const disparo = situacaoDoPedido(resposta.data);
    publicar({
      acompanhamentos: {
        ...estado.acompanhamentos,
        [id]: { ...pedidoDoRobo, disparo },
      },
      ...(disparo.aviso
        ? {
            // O aviso fica no acompanhamento da linha (uma frase só).
            avisos: { ...estado.avisos, [id]: null },
            pedidos: { ...estado.pedidos, [id]: null },
          }
        : {}),
    });
  }

  /* Os pedidos desta tela que ainda esperam a resposta do GitHub. */
  const conferirPedidos = () =>
    Promise.all(Object.keys(estado.acompanhamentos).map(conferirPedido));

  /* disparar_robo para um robô da lista (opções: "Rodar com opções"). */
  async function disparar(
    id: string,
    opcoes: OpcoesConferidas | null = null,
    frase = "",
  ) {
    const avisar = (
      aviso: SnapshotDaSaude["avisos"][string],
      pedido: Date | null,
    ) =>
      publicar({
        avisos: { ...estado.avisos, [id]: aviso },
        pedidos: { ...estado.pedidos, [id]: pedido },
      });
    if (!supabase) {
      avisar({ tom: "erro", texto: "Sem conexão com o banco." }, null);
      return false;
    }
    avisar(null, agora());
    let resposta;
    try {
      resposta = await comTempoLimite(
        supabase.rpc(RPC_DISPARAR_ROBO, {
          p_robo: id,
          p_inputs: inputsDoPedido({ opcoes }),
        }),
        20000,
      );
    } catch (falha) {
      avisar({ tom: "erro", texto: mensagemDeFalha(falha) }, null);
      return false;
    }
    const { data, error } = resposta || {};
    if (
      error ||
      !(
        (typeof data === "number" && Number.isSafeInteger(data) && data > 0) ||
        (typeof data === "string" && /^[1-9]\d*$/.test(data))
      )
    ) {
      avisar(
        {
          tom: error?.code === "55006" ? "info" : "erro",
          texto: mensagemDoErroDoDisparo(error),
        },
        null,
      );
      return false;
    }
    avisar({ tom: "sucesso", texto: "Pedido enviado." }, agora());
    publicar({
      acompanhamentos: {
        ...estado.acompanhamentos,
        [id]: {
          em: agora(),
          modo: opcoes?.modo || "normal",
          frase,
          id: data,
          disparo: situacaoDoPedido({ situacao: "PEDIDO" }),
        },
      },
    });
    agendar(() => void conferirPedido(id), ESPERA_DA_RESPOSTA_MS);
    releituraAgendada = true;
    agendar(() => {
      releituraAgendada = false;
      void carregar();
    }, ESPERA_DEPOIS_DO_PEDIDO_MS);
    return true;
  }

  const rodarAgora = (id: string) => disparar(id);
  const rodarComOpcoes = (id: string, opcoes: OpcoesConferidas, frase = "") =>
    disparar(id, opcoes, frase);
  function dispensarAcompanhamento(id: string) {
    const resto = { ...estado.acompanhamentos };
    delete resto[id];
    publicar({ acompanhamentos: resto });
  }

  return {
    obter: () => estado,
    assinar(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    conferirPedido,
    agora,
    rodarAgora,
    rodarComOpcoes,
    buscarVagas,
    carregarPainel,
    dispensarAcompanhamento,
  };
}
