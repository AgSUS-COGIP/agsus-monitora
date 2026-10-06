/*
  Estado da seção Status das atualizações, fora do React: a última leitura de
  `get_saude_das_cargas` já normalizada (src/lib/saude-das-cargas.js), o
  perfil e o erro. A tela lê com `useSyncExternalStore`. Não importa React.

  "Rodar agora" (só Empregare, Seleção e Entrevistas): `disparo` guarda a
  resposta do GET de /api/rodar-carga (configurado? o que roda no GitHub?);
  `pedidos` e `avisos`, o último clique de cada carga nesta tela. As regras
  do botão são de src/lib/robos-de-carga.js.
*/
import { isAdminGlobal } from "../../lib/access-roles.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import {
  ENDERECO_RODAR_CARGA,
  MENSAGENS_DO_DISPARO,
  motivoDaRecusa,
} from "../../lib/robos-de-carga.js";
import { normalizarSaude } from "../../lib/saude-das-cargas.js";
import { exigirSessao } from "../../lib/sessao.js";

const ESPERA_DEPOIS_DO_PEDIDO_MS = 20000;

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
  };
  let pedido = 0;
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
    void consultarDisparo();
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

  /* POST de /api/rodar-carga para um robô da lista. */
  async function rodarAgora(id) {
    const avisar = (aviso, pedido) =>
      publicar({
        avisos: { ...estado.avisos, [id]: aviso },
        pedidos: { ...estado.pedidos, [id]: pedido },
      });
    avisar(null, agora());
    let resposta;
    try {
      resposta = await comTempoLimite(pedir("POST", { robo: id }), 20000);
    } catch (falha) {
      avisar({ tom: "erro", texto: mensagemDeFalha(falha) }, null);
      return false;
    }
    const corpo = await lerJson(resposta);
    if (resposta.status === 202) {
      avisar({ tom: "sucesso", texto: "Pedido enviado." }, agora());
      agendar(() => {
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
  };
}
