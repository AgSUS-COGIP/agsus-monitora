/*
  De onde a Aya tira os números das perguntas com dado ao vivo
  (src/lib/dados-da-aya.js). Só leitura, e só pelas RPCs que as telas já
  chamam — com a sessão da própria pessoa, então o banco confere a permissão
  de novo em cada uma. Nenhuma RPC nova e nada de nome ou CPF na resposta: a
  Aya só conta.

  Antes da rede, o que a tela já carregou: se a tela de Recursos ou Seleção
  está carregada na mesma área (Análises não: a tela carrega só o pacote da
  situação escolhida, e a Aya conta o edital ativo inteiro) (o controlador que
  src/main.js põe em window), os números saem do estado dela — o mesmo que o
  indicador mostra. Senão, uma chamada e a resposta fica guardada por um
  minuto, para a pergunta seguinte não chamar de novo.
*/
import { linhasDoPayload } from "../../lib/analises-curriculares.ts";
import { parametroDeAreaDaRpc } from "../../lib/area-do-painel-de-analises.js";
import { normalizarPayload as payloadDasEntrevistas } from "../../lib/entrevistas-do-painel.ts";
import { enriquecerRecursos } from "../../lib/recursos-dos-candidatos.js";
import { normalizarPayload as payloadDaSelecao } from "../../lib/selecao-do-painel.ts";
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
  /*
    O guardado foi lido com a permissão de quem estava na sessão: trocar de
    conta na mesma aba esquece tudo, inclusive a leitura que ainda está a
    caminho (a geração muda), como o módulo Editais faz no reiniciarSessao.
  */
  let usuario;
  let geracao = 0;
  function esquecer() {
    guardado.clear();
    geracao += 1;
  }
  cliente()?.auth?.onAuthStateChange?.((_evento, sessao) => {
    const atual = sessao?.user?.id || null;
    if (atual === usuario) return;
    if (usuario !== undefined) esquecer();
    usuario = atual;
  });

  async function chamar(nome, argumentos) {
    const { data, error } = await cliente().rpc(nome, argumentos);
    if (error) throw error;
    return data;
  }

  const LEITURAS = {
    /*
      Análises: os editais em situação Ativo, como no banco (situação do
      processo = a do edital). São dois pacotes do painel: "ativo" (o que a
      tela mostra em Ativo) e "desativadas" (análises de edital ativo que
      saíram da planilha; a tela só mostra em Todos). As desativadas vão
      marcadas, para a resposta dizer quantas são.
    */
    async analises({ area }) {
      const pacote = async (escopo) =>
        linhasDoPayload(
          primeiro(
            await chamar("get_analises_dashboard_payload_v2", {
              p_scope: escopo,
              ...parametroDeAreaDaRpc(area),
            }),
          ),
        );
      const [ativas, desativadas] = await Promise.all([
        pacote("ativo"),
        pacote("desativadas"),
      ]);
      return {
        linhas: [
          ...ativas,
          ...desativadas.map((linha) => ({ ...linha, __desativada: true })),
        ],
      };
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
    const daGeracao = geracao;
    const dados = await ler({ ...opcoes, area });
    if (daGeracao === geracao) guardado.set(chave, { em: agora(), dados });
    return dados;
  }

  return { buscar, esquecer };
}
