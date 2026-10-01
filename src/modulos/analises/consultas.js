/*
  As consultas da tela de Análises curriculares, todas por RPC (contrato em
  src/lib/rpc-contrato.js). Este arquivo não importa React.

  - `podeLer()`: o porteiro (`usuario_pode_ler_analises`).
  - `carregarEscopo()`: a lista enxuta da área (get_analises_dashboard_payload_v2)
    no escopo da "Situação do processo". "Ativo" e "Inativo" são um pacote
    cada; "Todos" são os pacotes 'ativo', 'inativo' e 'desativadas' juntos, na
    ordem do banco (src/lib/lista-do-painel-de-analises.js).
    Cópia no navegador (IndexedDB, src/lib/cache-do-painel-de-analises.js): com
    cópia, devolve na hora (`daCopia`) e revalida por trás (`revalidacao`);
    `aoMudar` recebe o payload novo se o servidor mandou outro, e
    `aoPerderAcesso` é chamado se o acesso caiu (as cópias são apagadas).
  - `detalhe(id)`: o detalhamento de um registro (parecer, pontuações,
    experiências, links, datas), ao abrir a gaveta. Guardado por id.
  - `textos(area, escopo)`: parecer, link do PDF e experiência de todas as
    linhas, em lote, para a busca geral e o CSV. Guardado por área + escopo.
  - `esquecer()`: o "Atualizar" e a troca de usuário descartam o guardado.
*/
import { parametroDeAreaDaRpc } from "../../lib/area-do-painel-de-analises.js";
import { linhasDoPayload } from "../../lib/analises-curriculares.js";
import {
  criarCacheDoPainel,
  revalidarPayload,
} from "../../lib/cache-do-painel-de-analises.js";
import { comTempoLimite } from "../../lib/falha-de-rede.js";
import {
  envelopeDeTodos,
  juntarPartesDoPainel,
  partesDoEscopo,
} from "../../lib/lista-do-painel-de-analises.js";
import { mapaDosTextos } from "../../lib/textos-do-painel-de-analises.js";
import { armazenamentoDePayload } from "../../modules/cache-de-payload-indexeddb.js";

const RPC_PORTEIRO = "usuario_pode_ler_analises";
const RPC_LISTA = "get_analises_dashboard_payload_v2";
const RPC_DETALHE = "get_analise_detalhe_do_painel";
const RPC_TEXTOS = "get_analises_texto_do_painel";

/* A cópia vale só para a mesma publicação do front (o endereço do módulo muda a cada build). */
const VERSAO_DA_COPIA = `1:${import.meta.url}`;
const TEMPO_LIMITE_MS = 30000;

const primeiro = (data) => (Array.isArray(data) ? data[0] : data);

export function criarConsultasDasAnalises({
  supabase,
  armazenamento = armazenamentoDePayload,
  versao = VERSAO_DA_COPIA,
  tempoLimiteMs = TEMPO_LIMITE_MS,
} = {}) {
  const copias = criarCacheDoPainel({ armazenamento, versao });
  const detalhes = new Map();
  const textosGuardados = new Map();

  async function chamar(nome, argumentos) {
    const { data, error } = await comTempoLimite(
      supabase.rpc(nome, argumentos),
      tempoLimiteMs,
    );
    if (error) throw error;
    return data;
  }

  /** true/false; `null` se o porteiro não respondeu (a lista decide). */
  async function podeLer() {
    try {
      return Boolean(primeiro(await chamar(RPC_PORTEIRO)));
    } catch (erro) {
      console.warn("Não foi possível conferir o acesso às análises:", erro);
      return null;
    }
  }

  const buscarPacote = async (area, escopo) =>
    primeiro(
      await chamar(RPC_LISTA, {
        p_scope: escopo,
        ...parametroDeAreaDaRpc(area),
      }),
    );

  async function carregarPacote({
    area,
    escopo,
    usuarioId,
    forcarRede,
    aoMudar,
    aoPerderAcesso,
  }) {
    const contexto = { usuarioId, area, escopo };
    const guardado = forcarRede ? null : await copias.ler(contexto);
    if (guardado) {
      const revalidacao = revalidarPayload({
        guardado,
        buscar: () => buscarPacote(area, escopo),
        guardar: (novo) => copias.guardar(contexto, novo),
        apagarTudo: () => copias.apagarTudo(),
        aoMudar: (novo) =>
          aoMudar?.({ payload: novo, linhas: linhasDoPayload(novo) }),
        aoPerderAcesso: (erro) => aoPerderAcesso?.(erro),
      });
      return {
        payload: guardado,
        linhas: linhasDoPayload(guardado),
        daCopia: true,
        revalidacao,
      };
    }
    const payload = await buscarPacote(area, escopo);
    const linhas = linhasDoPayload(payload);
    void copias.guardar(contexto, payload);
    return { payload, linhas, daCopia: false, revalidacao: Promise.resolve() };
  }

  /*
    "Todos": os três pacotes em paralelo. A revalidação de cada um refaz a
    junção com o mais novo e chama `aoMudar` de fora; o primeiro acesso
    perdido avisa uma vez só. Falha de um pacote rejeita tudo.
  */
  async function carregarTodos(opcoes) {
    const partes = partesDoEscopo("todos");
    const atuais = new Array(partes.length);
    let pronto = false;
    let semAcesso = false;
    const juntar = () => {
      const linhas = juntarPartesDoPainel(atuais);
      return { payload: envelopeDeTodos(atuais, linhas.length), linhas };
    };
    const resultados = await Promise.all(
      partes.map((escopo, indice) =>
        carregarPacote({
          ...opcoes,
          escopo,
          aoMudar: (novo) => {
            atuais[indice] = novo;
            if (pronto && !semAcesso) opcoes.aoMudar?.(juntar());
          },
          aoPerderAcesso: (erro) => {
            if (semAcesso) return;
            semAcesso = true;
            opcoes.aoPerderAcesso?.(erro);
          },
        }),
      ),
    );
    resultados.forEach((resultado, indice) => {
      if (!atuais[indice]) atuais[indice] = resultado;
    });
    pronto = true;
    return {
      ...juntar(),
      daCopia: resultados.some((resultado) => resultado.daCopia),
      revalidacao: Promise.all(resultados.map((r) => r.revalidacao)),
    };
  }

  /**
   * O escopo ('ativo', 'inativo' ou 'todos') da área: `{ payload, linhas,
   * daCopia, revalidacao }`. Erro da RPC (sem cópia) é lançado.
   */
  function carregarEscopo(opcoes) {
    return opcoes.escopo === "todos"
      ? carregarTodos(opcoes)
      : carregarPacote(opcoes);
  }

  /** O detalhamento da linha (objeto ou null). Rejeita se a consulta falhar. */
  function detalhe(id) {
    const chave = String(id ?? "").trim();
    if (!chave) return Promise.resolve(null);
    if (!detalhes.has(chave)) {
      const promessa = chamar(RPC_DETALHE, { p_id: chave }).then((data) => {
        const dados = primeiro(data);
        return dados && typeof dados === "object" ? dados : null;
      });
      detalhes.set(chave, promessa);
      promessa.catch(() => detalhes.delete(chave));
    }
    return detalhes.get(chave);
  }

  /** Map(id → { analise, link_pdf, … }) de todas as linhas da área no escopo. */
  function textos(area, escopo) {
    const chave = `${area}|${escopo}`;
    if (!textosGuardados.has(chave)) {
      const promessa = chamar(RPC_TEXTOS, {
        p_scope: escopo,
        ...parametroDeAreaDaRpc(area),
      }).then((data) => mapaDosTextos(primeiro(data)));
      textosGuardados.set(chave, promessa);
      promessa.catch(() => textosGuardados.delete(chave));
    }
    return textosGuardados.get(chave);
  }

  function esquecer() {
    detalhes.clear();
    textosGuardados.clear();
  }

  return {
    podeLer,
    carregarEscopo,
    detalhe,
    textos,
    esquecer,
    apagarCopias: () => copias.apagarTudo(),
  };
}
