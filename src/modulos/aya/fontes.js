/*
  De onde a Aya tira os números das perguntas com dado ao vivo
  (src/lib/dados-da-aya.js). Só leitura, e só pelas RPCs que as telas já
  chamam — com a sessão da própria pessoa, então o banco confere a permissão
  de novo em cada uma. Nenhuma RPC nova e nada de nome ou CPF na resposta: a
  Aya só conta.

  Antes da rede, o que a tela já carregou: se a tela de Análises, Recursos,
  Entrevistas ou Seleção está carregada na mesma área (o controlador que
  src/main.js põe em window), os números saem do estado dela — o mesmo que o
  indicador mostra. Senão, uma chamada e a resposta fica guardada por um
  minuto, para a pergunta seguinte não chamar de novo.
*/
import { linhasDoPayload } from "../../lib/analises-curriculares.js";
import { parametroDeAreaDaRpc } from "../../lib/area-do-painel-de-analises.js";
import { normalizarPayload as payloadDasEntrevistas } from "../../lib/entrevistas-do-painel.js";
import { enriquecerRecursos } from "../../lib/recursos-dos-candidatos.js";
import { normalizarPayload as payloadDaSelecao } from "../../lib/selecao-do-painel.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";

const VALIDADE_MS = 60 * 1000;

const primeiro = (data) => (Array.isArray(data) ? data[0] : data);

/* O estado já carregado da tela, quando é da mesma área. */
function daTela(janela, controlador, area, campo) {
  try {
    const estado = janela?.[controlador]?.estado?.obter?.();
    if (!estado?.carregado || String(estado.area || "") !== area) return null;
    return estado[campo] ?? null;
  } catch {
    return null;
  }
}

export function criarFontesDaAya({
  supabase = null,
  janela = globalThis.window,
  agora = () => Date.now(),
} = {}) {
  const guardado = new Map();
  const cliente = () => supabase || getSupabaseClient();

  async function chamar(nome, argumentos) {
    const { data, error } = await cliente().rpc(nome, argumentos);
    if (error) throw error;
    return data;
  }

  const LEITURAS = {
    async analises({ area }) {
      const linhas = daTela(janela, "analisesController", area, "linhas");
      if (linhas) return { linhas };
      const payload = primeiro(
        await chamar("get_analises_dashboard_payload_v2", {
          p_scope: "ativo",
          ...parametroDeAreaDaRpc(area),
        }),
      );
      return { linhas: linhasDoPayload(payload) };
    },
    async recursos({ area }) {
      const carregados = daTela(janela, "recursosController", area, "dados");
      if (carregados) return { recursos: enriquecerRecursos(carregados) };
      const dados = await chamar("get_recursos_da_area", { p_area: area });
      return { recursos: enriquecerRecursos(primeiro(dados)) };
    },
    async entrevistas({ area }) {
      const dados = await chamar("get_entrevistas_da_area", { p_area: area });
      return payloadDasEntrevistas(primeiro(dados));
    },
    async selecao({ area }) {
      const carregados = daTela(janela, "selecaoController", area, "dados");
      if (Array.isArray(carregados?.vagas)) return { vagas: carregados.vagas };
      const dados = await chamar("get_selecao_da_area", { p_area: area });
      return payloadDaSelecao(primeiro(dados));
    },
    async conferencia({ area, cargaDe }) {
      const em = primeiro(
        await chamar("obter_ultima_conferencia", {
          p_fonte: cargaDe,
          p_area: area || null,
        }),
      );
      return { em: em ?? null };
    },
    async cargas() {
      return primeiro(await chamar("get_saude_das_cargas"));
    },
  };

  /** Os dados da fonte para a área; lança o erro da RPC (sem acesso, rede). */
  async function buscar(fonte, opcoes = {}) {
    const ler = LEITURAS[fonte];
    if (!ler) throw new Error(`Fonte desconhecida: ${fonte}`);
    const area = String(opcoes.area || "");
    const chave = `${fonte}|${area}|${opcoes.cargaDe || ""}`;
    const antes = guardado.get(chave);
    if (antes && agora() - antes.em < VALIDADE_MS) return antes.dados;
    const dados = await ler({ ...opcoes, area });
    guardado.set(chave, { em: agora(), dados });
    return dados;
  }

  return { buscar, esquecer: () => guardado.clear() };
}
