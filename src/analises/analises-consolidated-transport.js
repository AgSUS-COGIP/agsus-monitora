/*
  Carga do payload consolidado do painel de análises
  (get_analises_dashboard_payload_v2) — a fonte das linhas dos três escopos da
  "Situação do processo". O analises-app.js chama `carregarEscopoDoPainel`
  direto; nada aqui embrulha o cliente do Supabase.

  "Ativo" e "Inativo" são um pacote cada. "Todos" não tem pacote próprio: são
  os pacotes 'ativo', 'inativo' e 'desativadas' juntos aqui, na ordem do banco
  (regras em src/lib/lista-do-painel-de-analises.js) — quem já abriu "Ativo"
  e "Inativo" tem as cópias e só busca o que falta.

  A cópia guardada no navegador (IndexedDB) mora aqui, no lugar do antigo cache
  do localStorage do analises-app.js e do cache em memória que este módulo
  tinha: a abertura devolve a cópia na hora e revalida por trás; se o servidor
  mandar outro payload, `aoMudar` recebe o novo. As regras estão em
  src/lib/cache-do-painel-de-analises.js.
*/
import {
  grupoDaPlanilhaDaArea,
  parametroDeAreaDaRpc,
} from "../lib/area-do-painel-de-analises.js";
import {
  chavesDoCacheAntigo,
  criarCacheDoPainel,
  revalidarPayload,
} from "../lib/cache-do-painel-de-analises.js";
import {
  completarLinhaPeloEnvelope,
  envelopeDeTodos,
  juntarPartesDoPainel,
  partesDoEscopo,
} from "../lib/lista-do-painel-de-analises.js";
import { armazenamentoDePayload } from "../modules/cache-de-payload-indexeddb.js";
import { AREA_DO_PAINEL } from "./analises-area.js";

const RPC_PAINEL_DE_ANALISES = "get_analises_dashboard_payload_v2";
const MISSING_RESPONSIBLE_LABEL = "Sem responsável";
/* Erro de permissão ou de área: não há fallback pela view, e a cópia guardada é apagada. */
export const ERROS_SEM_FALLBACK = new Set(["42501", "22023"]);

/*
  Versão da cópia. `import.meta.url` é o endereço do bundle do painel, que traz
  o hash do conteúdo: cada publicação nova do painel invalida as cópias antigas
  sozinha. Fica aqui, e não no módulo do IndexedDB, porque aquele também entra
  no bundle do MONITORA (que o usa para apagar) e cai num pedaço compartilhado,
  cujo hash não muda junto com o painel. O número à frente é para mudança do
  formato do registro.
*/
const cacheLocal = criarCacheDoPainel({
  armazenamento: armazenamentoDePayload,
  versao: `1:${import.meta.url}`,
});

function normalizeAnaliseRow(row) {
  if (!row || typeof row !== "object") return row;
  const responsavel = String(row.responsavel_analise ?? "").trim();
  if (responsavel) return row;
  return {
    ...row,
    responsavel_analise: MISSING_RESPONSIBLE_LABEL,
    responsavel_ausente: true,
  };
}

export function normalizeAnaliseRows(rows) {
  return Array.isArray(rows) ? rows.map(normalizeAnaliseRow) : [];
}

/*
  Linhas do payload (colunas + arrays) como objetos, pelo NOME da coluna. O que
  a lista enxuta manda uma vez no envelope (grupo, situação do edital) entra em
  cada linha.
*/
export function decodeRows(payload) {
  if (
    !payload ||
    !Array.isArray(payload.columns) ||
    !Array.isArray(payload.rows)
  ) {
    throw new Error("Payload consolidado de Análises inválido.");
  }

  const columns = payload.columns;
  return payload.rows.map((values) => {
    const row = {};
    columns.forEach((column, index) => {
      row[column] = Array.isArray(values) ? values[index] : null;
    });
    return normalizeAnaliseRow(completarLinhaPeloEnvelope(row, payload));
  });
}

/* O grupo da área, para o fallback pela view (que traz todas as áreas). */
export function grupoDoFallbackPelaView() {
  return grupoDaPlanilhaDaArea(AREA_DO_PAINEL);
}

async function buscarDoServidor(client, escopo) {
  const { data, error } = await client.rpc(RPC_PAINEL_DE_ANALISES, {
    p_scope: escopo,
    ...parametroDeAreaDaRpc(AREA_DO_PAINEL),
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

/**
 * O payload de um pacote ('ativo', 'inativo' ou 'desativadas'), com as linhas
 * já decodificadas.
 *
 * - Com cópia guardada (e sem `forcarRede`): devolve a cópia na hora
 *   (`daCopia: true`) e revalida por trás; `aoMudar({ payload, linhas })` só é
 *   chamado se o servidor mandou outro payload. Sem acesso (42501/22023), as
 *   cópias são apagadas e `aoPerderAcesso(erro)` é chamado.
 * - Sem cópia: espera a RPC, guarda a cópia e devolve. Erro da RPC é lançado.
 */
export async function carregarPayloadDoPainel(
  client,
  { escopo, usuarioId, forcarRede = false, aoMudar, aoPerderAcesso },
) {
  const contexto = { usuarioId, area: AREA_DO_PAINEL, escopo };
  const guardado = forcarRede ? null : await cacheLocal.ler(contexto);

  if (guardado) {
    void revalidarPayload({
      guardado,
      buscar: () => buscarDoServidor(client, escopo),
      guardar: (novo) => cacheLocal.guardar(contexto, novo),
      apagarTudo: () => cacheLocal.apagarTudo(),
      aoMudar: (novo) => aoMudar?.({ payload: novo, linhas: decodeRows(novo) }),
      aoPerderAcesso: (erro) => aoPerderAcesso?.(erro),
    });
    return { payload: guardado, linhas: decodeRows(guardado), daCopia: true };
  }

  const payload = await buscarDoServidor(client, escopo);
  const linhas = decodeRows(payload);
  void cacheLocal.guardar(contexto, payload);
  return { payload, linhas, daCopia: false };
}

/*
  "Todos": os três pacotes em paralelo, juntos. A revalidação de cada um
  (`aoMudar` do pacote) refaz a junção com o que há de mais novo e chama o
  `aoMudar` de fora uma vez por pacote que mudou. Falha de um pacote rejeita
  tudo (o painel cai na leitura pela view, como nos outros escopos).
*/
async function carregarTodosDoPainel(
  client,
  { usuarioId, forcarRede, aoMudar, aoPerderAcesso },
) {
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
      carregarPayloadDoPainel(client, {
        escopo,
        usuarioId,
        forcarRede,
        aoMudar: (novo) => {
          atuais[indice] = novo;
          if (pronto && !semAcesso) aoMudar?.(juntar());
        },
        aoPerderAcesso: (erro) => {
          if (semAcesso) return;
          semAcesso = true;
          aoPerderAcesso?.(erro);
        },
      }),
    ),
  );
  // A revalidação de um pacote pode ter chegado antes dos outros: fica a nova.
  resultados.forEach((resultado, indice) => {
    if (!atuais[indice]) atuais[indice] = resultado;
  });
  pronto = true;
  return {
    ...juntar(),
    daCopia: resultados.some((resultado) => resultado.daCopia),
  };
}

/**
 * O escopo da "Situação do processo" ('ativo', 'inativo' ou 'todos'), com as
 * mesmas opções e o mesmo retorno de `carregarPayloadDoPainel`.
 */
export function carregarEscopoDoPainel(client, opcoes) {
  return opcoes.escopo === "todos"
    ? carregarTodosDoPainel(client, opcoes)
    : carregarPayloadDoPainel(client, opcoes);
}

/*
  O cache antigo do painel ficava no localStorage (agsus_analises_cache_*):
  grande demais para ele, falhava calado e ocupava a cota do MONITORA inteiro.
  Sai de vez; a cópia agora é a do IndexedDB.
*/
export function limparCacheAntigoDoLocalStorage() {
  try {
    const chaves = [];
    for (let index = 0; index < window.localStorage.length; index += 1)
      chaves.push(window.localStorage.key(index));
    chavesDoCacheAntigo(chaves).forEach((chave) =>
      window.localStorage.removeItem(chave),
    );
  } catch (error) {
    console.warn(
      "Não foi possível limpar o cache local antigo de Análises:",
      error,
    );
  }
}
