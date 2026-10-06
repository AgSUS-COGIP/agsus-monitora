/*
  Estado dos avisos de conferência, fora do React: a última leitura de
  `listar_avisos_conferencia` (área e módulo opcionais), já normalizada por
  src/lib/avisos-de-conferencia.js, e o "ignorar" com motivo
  (`ignorar_aviso_conferencia`). A tela lê com `useSyncExternalStore`.

  Quem usa: o cartão "Avisos de conferência" de Configurações › Status das
  atualizações (todos os módulos) e o selo de cada tela (Análises,
  Entrevistas, Classificação, Lista de aprovados), recortado pela área.
*/
import { normalizarAvisos } from "../../lib/avisos-de-conferencia.js";
import { comTempoLimite, mensagemDeFalha } from "../../lib/falha-de-rede.js";

export function criarEstadoDosAvisos({ supabase }) {
  let estado = {
    status: "idle",
    lista: null,
    erro: "",
    erroCodigo: "",
    ignorando: null,
    erroAoIgnorar: "",
  };
  let pedido = 0;
  let filtro = { area: null, modulo: null };
  const ouvintes = new Set();
  const publicar = (mudancas) => {
    estado = { ...estado, ...mudancas };
    for (const ouvinte of ouvintes) ouvinte();
  };

  async function carregar({ area = null, modulo = null } = {}) {
    const anterior = filtro;
    filtro = { area: area || null, modulo: modulo || null };
    const meu = ++pedido;
    /* Outra área ou outro módulo: a lista anterior não vale para este
       recorte (o selo mostraria a contagem da área de antes se a leitura falhar). */
    const outroRecorte =
      anterior.area !== filtro.area || anterior.modulo !== filtro.modulo;
    if (outroRecorte) publicar({ lista: null });
    if (!supabase) {
      publicar({ status: "error", erro: "Sem conexão com o banco." });
      return;
    }
    publicar({ status: "loading", erro: "", erroCodigo: "" });
    try {
      const { data, error } = await comTempoLimite(
        supabase.rpc("listar_avisos_conferencia", {
          p_area: filtro.area,
          p_modulo: filtro.modulo,
        }),
        20000,
      );
      if (meu !== pedido) return;
      if (error) {
        publicar({
          status: "error",
          erro: error.message || "Não foi possível ler os avisos.",
          erroCodigo: error.code || "",
        });
        return;
      }
      publicar({ status: "ready", lista: normalizarAvisos(data) });
    } catch (falha) {
      if (meu !== pedido) return;
      publicar({ status: "error", erro: mensagemDeFalha(falha) });
    }
  }

  async function ignorar(id, motivo) {
    if (!supabase) return false;
    publicar({ ignorando: id, erroAoIgnorar: "" });
    try {
      const { error } = await comTempoLimite(
        supabase.rpc("ignorar_aviso_conferencia", {
          p_id: id,
          p_motivo: String(motivo || "").trim(),
        }),
        20000,
      );
      if (error) {
        publicar({
          ignorando: null,
          erroAoIgnorar: error.message || "Não foi possível ignorar o aviso.",
        });
        return false;
      }
    } catch (falha) {
      publicar({ ignorando: null, erroAoIgnorar: mensagemDeFalha(falha) });
      return false;
    }
    publicar({ ignorando: null });
    await carregar(filtro);
    return true;
  }

  return {
    assinar(ouvinte) {
      ouvintes.add(ouvinte);
      return () => ouvintes.delete(ouvinte);
    },
    obter: () => estado,
    carregar,
    ignorar,
  };
}
