/*
  Cópia da sessão guardada no navegador, para a entrada abrir sem esperar a rede.

  ## O problema

  A cada entrada, inclusive ao sair e entrar de novo, o sistema pedia ao Supabase
  configurações, painéis, mapa, unidades e monitoramento, e a tela de
  carregamento ficava até o último voltar.

  ## O que este módulo decide

  Quando uma cópia da sessão anterior serve, a tela abre com ela e as consultas
  reais chegam por trás; só o que mudou é reaplicado. A cópia fica no navegador
  depois da saída, por decisão do produto: é isso que faz sair e entrar ser
  imediato. As proteções:

  - uma cópia só, de um usuário: outro usuário entrando naquele navegador a apaga;
  - vale só com o mesmo acesso: mudou perfil, permissão, área ou painel liberado,
    ela é descartada, para nunca mostrar o que a pessoa deixou de poder ver;
  - vale só para a mesma versão publicada do sistema e por `VALIDADE_DA_COPIA_MS`;
  - o perfil é sempre consultado antes: acesso revogado não chega a ver a cópia.

  A leitura e a gravação no IndexedDB são de `src/modules/copia-da-sessao-indexeddb.js`.
*/

export const VALIDADE_DA_COPIA_MS = 7 * 24 * 60 * 60 * 1000;

const PARTES_SIMPLES = Object.freeze(["config", "paineis", "mapa", "unidades"]);

/** O que muda a cada acesso sem mudar o que a pessoa pode ver. */
const CAMPO_DE_DATA = /(^|_)(em|at)$|^ultimo_|^last_/;

/** JSON com as chaves em ordem, para a mesma informação dar o mesmo texto. */
function jsonEstavel(valor) {
  if (Array.isArray(valor)) return `[${valor.map(jsonEstavel).join(",")}]`;
  if (valor && typeof valor === "object")
    return `{${Object.keys(valor)
      .sort()
      .map((chave) => `${JSON.stringify(chave)}:${jsonEstavel(valor[chave])}`)
      .join(",")}}`;
  return JSON.stringify(valor ?? null);
}

/**
 * Resumo do que define o acesso: o perfil inteiro (menos datas) e os painéis
 * liberados. Campo novo no perfil entra sozinho; na dúvida, a cópia é descartada.
 */
export function assinaturaDoAcesso(perfil, paineisLiberados = []) {
  const campos = Object.fromEntries(
    Object.entries(perfil || {}).filter(
      ([chave]) => !CAMPO_DE_DATA.test(chave),
    ),
  );
  const paineis = [...paineisLiberados].map(String).sort();
  return jsonEstavel({ perfil: campos, paineis });
}

/** Espera todas as consultas e devolve as respostas com as mesmas chaves. */
export async function respostasDasConsultas(consultas) {
  const partes = Object.keys(consultas);
  const respostas = await Promise.all(partes.map((parte) => consultas[parte]));
  return Object.fromEntries(partes.map((parte, i) => [parte, respostas[i]]));
}

/**
 * Dados das respostas das consultas da entrada, ou `null` se alguma falhou:
 * cópia pela metade misturaria versões.
 */
export function dadosDasRespostas(respostas) {
  const dados = {};
  for (const parte of PARTES_SIMPLES) {
    const resposta = respostas?.[parte];
    if (!resposta || resposta.error) return null;
    dados[parte] = resposta.data ?? [];
  }
  const monitoramento = respostas.monitoramento;
  if (!monitoramento) {
    dados.monitoramento = null;
    return dados;
  }
  const [payload, tabela] = monitoramento;
  if (!tabela || tabela.error) return null;
  dados.monitoramento = { payload: payload ?? null, linhas: tabela.data ?? [] };
  return dados;
}

/** O inverso de `dadosDasRespostas`: respostas já resolvidas, no formato das consultas. */
export function consultasDosDados(dados) {
  const resposta = (data) => Promise.resolve({ data, error: null });
  return {
    config: resposta(dados.config),
    paineis: resposta(dados.paineis),
    mapa: resposta(dados.mapa),
    unidades: resposta(dados.unidades),
    monitoramento: dados.monitoramento
      ? Promise.resolve([
          dados.monitoramento.payload,
          { data: dados.monitoramento.linhas, error: null },
        ])
      : null,
  };
}

export function montarCopia({ usuarioId, acesso, versao, agora, dados }) {
  return { usuarioId, acesso, versao, guardadaEm: agora, dados };
}

/** A cópia pode abrir a tela desta sessão? */
export function copiaServe(copia, { usuarioId, acesso, versao, agora }) {
  if (!copia || typeof copia !== "object" || !copia.dados) return false;
  const idade = agora - Number(copia.guardadaEm);
  return (
    !!usuarioId &&
    copia.usuarioId === usuarioId &&
    copia.acesso === acesso &&
    copia.versao === versao &&
    idade >= 0 &&
    idade <= VALIDADE_DA_COPIA_MS
  );
}

/**
 * Partes cujo conteúdo mudou entre a cópia e as respostas novas. `JSON.stringify`
 * simples: os dois lados vêm da mesma consulta, com as chaves na mesma ordem, e
 * o mapa é grande demais para ordenar chave por chave.
 */
export function partesQueMudaram(anteriores, atuais) {
  const texto = (valor) => JSON.stringify(valor ?? null);
  return new Set(
    [...PARTES_SIMPLES, "monitoramento"].filter(
      (parte) => texto(anteriores?.[parte]) !== texto(atuais?.[parte]),
    ),
  );
}
