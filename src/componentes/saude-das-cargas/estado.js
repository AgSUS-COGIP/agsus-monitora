/*
  Estado da seção Status das atualizações, fora do React: a última leitura de
  `get_saude_das_cargas` já normalizada (src/lib/saude-das-cargas.js), o
  perfil e o erro. A tela lê com `useSyncExternalStore`. Não importa React.

  "Rodar agora" (os robôs de ROBOS_DE_CARGA): `disparo` guarda a resposta
  do GET de /api/rodar-carga (configurado? o que roda no GitHub? a última
  execução de cada um); `pedidos` e `avisos`, o último clique de cada carga
  nesta tela. As regras do botão são de src/lib/robos-de-carga.js.

  "Rodar com opções" e as últimas execuções: `painel` guarda
  get_painel_dos_robos (editais e histórico, src/lib/painel-dos-robos.js);
  `buscarVagas` pede listar_vagas_dos_robos para as sugestões do formulário;
  `acompanhamentos` guarda o último pedido de cada robô (quando e qual modo)
  e, enquanto ele não termina, a tela relê a cada 20 s.
*/
import { isAdminGlobal } from "../../lib/access-roles.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import {
  acompanhamentoDoPedido,
  normalizarPainel,
  normalizarVagas,
} from "../../lib/painel-dos-robos.js";
import {
  ENDERECO_RODAR_CARGA,
  MENSAGENS_DO_DISPARO,
  motivoDaRecusa,
  roboDeCarga,
} from "../../lib/robos-de-carga.js";
import { normalizarSaude } from "../../lib/saude-das-cargas.js";
import { exigirSessao } from "../../lib/sessao.js";

const ESPERA_DEPOIS_DO_PEDIDO_MS = 20000;
const RPC_PAINEL_DOS_ROBOS = "get_painel_dos_robos";
const RPC_VAGAS_DOS_ROBOS = "listar_vagas_dos_robos";

const lerJson = (resposta) => resposta.json().catch(() => ({}));

export function criarEstadoDaSaude({
  supabase,
  getProfile,
  agora = () => new Date(),
  buscar = (...args) => globalThis.fetch(...args),
  obterToken = async () => (await exigirSessao(supabase)).access_token,
  agendar = (fn, ms) => setTimeout(fn, ms),
}) {
  let estado = {
    status: "idle",
    dados: null,
    bruto: null,
    erro: "",
    erroCodigo: "",
    perfil: null,
    disparo: { status: "carregando", robos: {}, erro: "" },
    pedidos: {},
    avisos: {},
    painel: { status: "idle", dados: null, erro: "" },
    acompanhamentos: {},
  };
  let pedido = 0;
  let releituraAgendada = false;
  const ouvintes = new Set();
  const publicar = (mudancas) => {
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
    const extras = Promise.all([consultarDisparo(), carregarPainel()]);
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
  async function buscarVagas({ editais = [], vagas = [] } = {}) {
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
        const etapa = acompanhamentoDoPedido({
          robo: id,
          pedido: pedidoDoRobo,
          execucoes: estado.painel.dados?.execucoes?.[id] || [],
          github: estado.disparo.robos?.[id] || null,
        })?.etapa;
        return etapa !== "terminou" && etapa !== "terminou_no_github";
      },
    );
    if (!pendente) return;
    releituraAgendada = true;
    agendar(() => {
      releituraAgendada = false;
      void carregar();
    }, ESPERA_DEPOIS_DO_PEDIDO_MS);
  }

  async function pedir(metodo, corpo) {
    const token = await obterToken();
    return buscar(ENDERECO_RODAR_CARGA, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(corpo ? { "Content-Type": "application/json" } : {}),
      },
      ...(corpo ? { body: JSON.stringify(corpo) } : {}),
    });
  }

  /* GET de /api/rodar-carga: configurado? o que roda agora no GitHub? */
  async function consultarDisparo() {
    let resposta;
    try {
      resposta = await comTempoLimite(pedir("GET"), 20000);
    } catch {
      publicar({
        disparo: {
          status: "erro",
          robos: {},
          erro: "Não consegui consultar o GitHub.",
        },
      });
      return;
    }
    const corpo = await lerJson(resposta);
    const status =
      resposta.status === 404
        ? "indisponivel"
        : resposta.status === 503
          ? "sem_token"
          : resposta.ok
            ? "ok"
            : "erro";
    publicar({
      disparo: {
        status,
        robos: corpo?.robos || {},
        erro: status === "erro" ? corpo?.erro || "" : "",
      },
    });
  }

  /* POST de /api/rodar-carga para um robô da lista (opções: "Rodar com opções"). */
  async function disparar(id, opcoes = null, frase = "") {
    const avisar = (aviso, pedido) =>
      publicar({
        avisos: { ...estado.avisos, [id]: aviso },
        pedidos: { ...estado.pedidos, [id]: pedido },
      });
    avisar(null, agora());
    let resposta;
    try {
      resposta = await comTempoLimite(
        pedir("POST", opcoes ? { robo: id, opcoes } : { robo: id }),
        20000,
      );
    } catch (falha) {
      avisar({ tom: "erro", texto: mensagemDeFalha(falha) }, null);
      return false;
    }
    const corpo = await lerJson(resposta);
    if (resposta.status === 202) {
      avisar({ tom: "sucesso", texto: "Pedido enviado." }, agora());
      publicar({
        acompanhamentos: {
          ...estado.acompanhamentos,
          [id]: { em: agora(), modo: opcoes?.modo || "normal", frase },
        },
      });
      releituraAgendada = true;
      agendar(() => {
        releituraAgendada = false;
        void carregar();
      }, ESPERA_DEPOIS_DO_PEDIDO_MS);
      return true;
    }
    if (resposta.status === 409) {
      avisar({ tom: "info", texto: MENSAGENS_DO_DISPARO.rodando }, null);
      void consultarDisparo();
      return false;
    }
    avisar(
      {
        tom: "erro",
        texto: motivoDaRecusa(
          resposta.status,
          corpo,
          "Não consegui pedir a carga.",
        ),
      },
      null,
    );
    return false;
  }

  const rodarAgora = (id) => disparar(id);
  const rodarComOpcoes = (id, opcoes, frase = "") =>
    disparar(id, opcoes, frase);
  function dispensarAcompanhamento(id) {
    const resto = { ...estado.acompanhamentos };
    delete resto[id];
    publicar({ acompanhamentos: resto });
  }

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
    consultarDisparo,
    agora,
    rodarAgora,
    rodarComOpcoes,
    buscarVagas,
    carregarPainel,
    dispensarAcompanhamento,
  };
}
