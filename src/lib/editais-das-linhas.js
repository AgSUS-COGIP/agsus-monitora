/*
  Deriva a lista de editais, com as janelas oficiais de análise, a partir das
  linhas que a view do painel já devolve.

  POR QUE ISTO EXISTE

  O painel consultava `TB_EDITAL_ANALISE` numa segunda ida ao servidor para
  obter grupo, unidade, edital, situação e janela. As views
  `VW_ANALISES_DASHBOARD_BASE` e `VW_ANALISES_DASHBOARD_BASE_TODOS` já trazem
  esses campos em cada linha — a migration 20260918170000 os declara. A segunda
  consulta era redundante e, quando falhava, o painel mostrava um aviso de
  janela indisponível que não correspondia a problema nenhum.

  POR QUE NUM MÓDULO PRÓPRIO, E NÃO DENTRO DO PAINEL

  `src/analises/analises-app.js` está na lista de ignorados do ESLint e não é
  importável por teste. Uma função com coerção de tipo e regra de mesclagem
  precisa das duas redes; aqui ela tem.
*/

const VALORES_DE_ATIVO = ["sim", "s", "ativo", "1", "true", "x"];

function texto(valor) {
  return String(valor ?? "").trim();
}

function normalizar(valor) {
  return texto(valor).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function chaveDoEdital(grupo, unidade, edital) {
  return [normalizar(grupo), normalizar(unidade), normalizar(edital)].join("|");
}

/*
  A situação chega ora como booleano da view, ora como texto vindo da planilha
  ("SIM", "x", "1"). O retorno é sempre booleano.
*/
export function editalEstaAtivo(valor) {
  if (typeof valor === "boolean") return valor;
  return VALORES_DE_ATIVO.includes(normalizar(valor));
}

/*
  Uma linha por edital, montada a partir de muitas linhas de candidato.

  Quando o mesmo edital aparece em várias linhas, a primeira janela encontrada
  vence e as seguintes só preenchem o que estiver faltando. Isso assume que a
  view é consistente — a janela vem do mesmo registro de origem para todas as
  linhas do edital. Se um dia deixar de ser, a divergência é descartada aqui em
  silêncio, e é neste ponto que a checagem teria de entrar.
*/
export function editaisDasLinhas(linhas) {
  const porChave = new Map();

  for (const linha of Array.isArray(linhas) ? linhas : []) {
    const grupo = texto(linha?.grupo);
    const unidade = texto(linha?.unidade);
    const edital = texto(linha?.edital);
    if (!unidade || !edital) continue;

    const novo = {
      grupo: grupo || null,
      unidade,
      edital,
      ativo: editalEstaAtivo(linha?.edital_ativo ?? linha?.ativo),
      data_inicio_analise: texto(linha?.data_inicio_analise) || null,
      data_fim_analise: texto(linha?.data_fim_analise) || null,
    };

    const atual = porChave.get(chaveDoEdital(grupo, unidade, edital));
    if (!atual) {
      porChave.set(chaveDoEdital(grupo, unidade, edital), novo);
      continue;
    }

    if (!atual.data_inicio_analise && novo.data_inicio_analise) {
      atual.data_inicio_analise = novo.data_inicio_analise;
    }
    if (!atual.data_fim_analise && novo.data_fim_analise) {
      atual.data_fim_analise = novo.data_fim_analise;
    }
    atual.ativo = atual.ativo || novo.ativo;
  }

  return [...porChave.values()];
}
