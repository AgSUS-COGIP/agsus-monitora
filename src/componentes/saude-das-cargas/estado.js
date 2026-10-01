/*
  Estado da seção Status das atualizações, fora do React: a última leitura de
  `get_saude_das_cargas` já normalizada (src/lib/saude-das-cargas.js), o
  perfil e o erro. A tela lê com `useSyncExternalStore`. Não importa React.
*/
import { isAdminGlobal } from "../../lib/access-roles.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";
import { normalizarSaude } from "../../lib/saude-das-cargas.js";

export function criarEstadoDaSaude({
  supabase,
  getProfile,
  agora = () => new Date(),
}) {
  let estado = {
    status: "idle",
    dados: null,
    bruto: null,
    erro: "",
    erroCodigo: "",
    perfil: null,
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

  return {
    obter: () => estado,
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    carregar,
  };
}
