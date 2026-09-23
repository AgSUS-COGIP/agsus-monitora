/*
  Ordem de convocação: quem é chamado, em que posição, por conta de que vaga.

  A lista de aprovados responde "quem passou". A de convocação responde "quem é
  chamado primeiro", e a resposta não é a classificação: quando o edital reserva
  vagas, as chamadas de cota entram ao longo da sequência segundo uma regra que
  o edital define.

  AS REGRAS VÊM DO MODELO, NÃO DAQUI

  Este ficheiro não sabe que existem "pretos e pardos" ou "PCD". Sabe que há
  categorias, uma delas a ampla, e que cada uma tem percentual, arredondamento,
  cascata e um jeito de entrar na fila. Tudo isso chega num MODELO
  (`modelo-de-convocacao.js`), que é dado editável — porque a leitura de oito
  editais da AgSUS mostrou que quase nada é constante: o 97/2025 tem cota trans,
  o edital da FCC junta negros e indígenas numa cota só e publica as posições
  literais em vez de proporcionalidade, e o 91/2026 manda a vaga de PCD vazia
  para os indígenas.

  O QUE É CONSTANTE, E FICA AQUI

  Três coisas se repetem em todos os editais lidos, e por isso são código:

  1. Quem concorre a uma reserva concorre TAMBÉM à ampla.
  2. Ser chamado pela ampla não gasta a vaga da reserva — "não serão computados
     para efeito de preenchimento das vagas reservadas", na redação que os oito
     editais repetem com numeração diferente (5.2.3.1.3 no 96/2025, 97/2025 e
     Cebraspe; 5.7.15 no 30/2026; 5.8.4 no 93/2026; 7.4.2 no da FGV). Cai de
     graça do desenho: a vaga é uma POSIÇÃO na sequência, e ocupar uma posição
     de ampla deixa as posições de reserva intactas, para o próximo daquela
     fila.
  3. Reserva sem candidato não fica vazia — desce a cascata e, no fim, reverte
     para a ampla.

  E duas regras de operação, que valem em todos os editais lidos:

    - Desistente e Documentação Rejeitada não ocupam vaga; quem vem a seguir na
      mesma fila toma o lugar. Continuam visíveis, fora da numeração.
    - Fim de Fila é outra coisa: a pessoa CONTINUA na fila, e em todas as filas
      em que estava, mas ordenada depois de todos os demais.

  O ciclo de posições repete-se depois de esgotadas as vagas imediatas: é assim
  que o cadastro de reserva sai ordenado pelo mesmo critério da convocação, e
  não pela classificação crua.
*/

import {
  categoriaDaAmpla,
  categoriasDeReserva,
  lerModalidade,
  normalizarModelo,
} from "./modelo-de-convocacao.js";

const texto = (valor) => String(valor ?? "").trim();

/** Status que tiram o candidato da fila sem consumir a vaga. */
export const STATUS_FORA_DA_FILA = Object.freeze([
  "Desistente",
  "Documentação Rejeitada",
]);

export function estaForaDaFila(candidato) {
  return STATUS_FORA_DA_FILA.includes(texto(candidato?.status));
}

/**
 * Quem pediu posicionamento no final da lista.
 *
 * Não sai da fila — é a diferença para Desistente, e o motivo de o status
 * existir: continua convocável, só que depois de todos os outros. O instituto
 * está no edital da FCC (125), item 13.7.
 */
export const STATUS_FIM_DE_FILA = "Fim de Fila";

export function vaiParaOFimDaFila(candidato) {
  return texto(candidato?.status) === STATUS_FIM_DE_FILA;
}

function inteiroNaoNegativo(valor) {
  const numero = Math.floor(Number(valor));
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

/**
 * Arredondamento da fração de vagas, conforme o modo declarado na categoria.
 *
 * `meio_acima` é a redação repetida na maioria dos editais: fração igual ou
 * maior que 0,5 sobe para o inteiro seguinte, menor que 0,5 desce.
 * `sempre_acima` é a do 91/2026 para PCD, que sobe qualquer fração — e por isso
 * vem sempre acompanhada de um teto.
 */
export function arredondarVaga(valor, modo = "meio_acima") {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  if (modo === "sempre_acima") return Math.ceil(valor);
  const inteiro = Math.floor(valor);
  return valor - inteiro >= 0.5 ? inteiro + 1 : inteiro;
}

/** Quadro zerado com uma entrada por categoria do modelo. */
export function quadroVazio(modelo) {
  return Object.fromEntries(
    modelo.categorias.map((categoria) => [categoria.id, 0]),
  );
}

export function normalizarQuadro(quadro, modelo) {
  const base = quadroVazio(modelo);
  modelo.categorias.forEach((categoria) => {
    base[categoria.id] = inteiroNaoNegativo(quadro?.[categoria.id]);
  });
  return base;
}

export function totalDoQuadro(quadro) {
  return Object.values(quadro || {}).reduce(
    (soma, valor) => soma + inteiroNaoNegativo(valor),
    0,
  );
}

/**
 * Deriva o quadro por categoria a partir do total de vagas imediatas da vaga e
 * dos percentuais do modelo.
 *
 * As reservas são servidas da maior taxa para a menor, com orçamento: a soma
 * nunca passa o total. A ordem pesa pouco com os percentuais reais, mas torna o
 * resultado previsível se alguém configurar taxas que somem mais de 100, em vez
 * de devolver uma ampla negativa.
 *
 * O que sobra é da ampla. Não é um percentual à parte: é o resto, e é assim que
 * os editais a definem.
 */
export function derivarQuadro(totalImediatas, modelo) {
  const total = inteiroNaoNegativo(totalImediatas);
  const quadro = quadroVazio(modelo);
  const ampla = categoriaDaAmpla(modelo);
  if (!total) return quadro;

  let restante = total;
  [...categoriasDeReserva(modelo)]
    .sort((a, b) => b.percentual - a.percentual || a.ordem - b.ordem)
    .forEach((categoria) => {
      /*
        Abaixo do mínimo a reserva simplesmente não existe nesta vaga, e o que
        lhe caberia fica com a ampla. O mínimo é por CATEGORIA porque o edital
        da FGV pede duas vagas para as cotas raciais (7.1.3) e cinco para PCD
        (6.5): no mesmo edital, uma vaga de 3 tem reserva racial e não tem PCD.
      */
      if (categoria.minimo > 0 && total < categoria.minimo) return;
      const bruto = (total * categoria.percentual) / 100;
      let vagas = arredondarVaga(bruto, categoria.arredondamento);
      // O teto do 91/2026: a reserva não pode passar dessa fatia do total.
      if (categoria.teto > 0)
        vagas = Math.min(vagas, Math.floor((total * categoria.teto) / 100));
      vagas = Math.min(vagas, restante);
      quadro[categoria.id] = vagas;
      restante -= vagas;
    });

  quadro[ampla.id] = restante;
  return quadro;
}

/*
  Ordem geral dentro da vaga.

  A nota manda, e a classificação só desempata. É de propósito: em boa parte dos
  editais a coluna `classificacao` do XLSX vem POR modalidade, de modo que o 1º
  da ampla e o 1º da cota indígena chegam ambos como "1". Ordenar por ela
  embaralharia a lista; ordenar por nota reconstrói a classificação geral e
  continua correta quando a planilha já trazia a classificação única.
*/
export function ordenarPorClassificacao(candidatos) {
  return [...(candidatos || [])].sort((a, b) => {
    /*
      Quem pediu fim de fila vai para depois de todos, antes de qualquer outro
      critério. Uma comparação só resolve TODAS as filas: as de cota são
      recortes desta mesma ordem, então quem cai para o fim aqui cai para o fim
      na sua reserva também. Entre eles, a ordem normal continua a valer.
    */
    const fimA = vaiParaOFimDaFila(a);
    const fimB = vaiParaOFimDaFila(b);
    if (fimA !== fimB) return fimA ? 1 : -1;

    const notaA = Number(a?.nota);
    const notaB = Number(b?.nota);
    const temA = Number.isFinite(notaA);
    const temB = Number.isFinite(notaB);
    if (temA && temB && notaA !== notaB) return notaB - notaA;
    if (temA !== temB) return temA ? -1 : 1;

    const classA = Number(a?.classificacao);
    const classB = Number(b?.classificacao);
    const temClassA = Number.isFinite(classA);
    const temClassB = Number.isFinite(classB);
    if (temClassA && temClassB && classA !== classB) return classA - classB;
    if (temClassA !== temClassB) return temClassA ? -1 : 1;

    return texto(a?.nome).localeCompare(texto(b?.nome), "pt-BR");
  });
}

/*
  Distribuição proporcional: a k-ésima vaga de uma categoria com `n` vagas num
  total de `T` fica na posição ideal `(k - 0.5) * T / n` — o ponto médio da
  k-ésima fatia da sequência. Ordenar todas as vagas por essa posição espalha
  cada categoria em vez de despejar as reservas no fim, que é a "alternância e
  proporcionalidade" que os editais descrevem sem publicar a sequência.

  Com 2 de ampla e 1 de pretos e pardos sai `AC, PP, AC`.
*/
function sequenciaProporcional(quadro, modelo, total) {
  const posicoes = [];
  modelo.categorias.forEach((categoria) => {
    const quantidade = quadro[categoria.id] || 0;
    for (let k = 1; k <= quantidade; k += 1) {
      posicoes.push({
        id: categoria.id,
        ideal: ((k - 0.5) * total) / quantidade,
        ordem: categoria.ordem,
        k,
      });
    }
  });
  posicoes.sort((a, b) => a.ideal - b.ideal || a.ordem - b.ordem || a.k - b.k);
  return posicoes.map((posicao) => posicao.id);
}

/*
  Distribuição por posições publicadas: o edital da FCC diz que a cota
  étnico-racial ocupa "a 3ª, a 8ª, a 13ª… seguindo intervalos de cinco vagas", e
  a de PCD "a 5ª, 21ª, 41ª… de vinte em vinte". As duas séries não são
  aritméticas desde o início — daí a categoria guardar as posições que o edital
  LISTA e o intervalo com que a série continua a partir da última delas.

  Posição já tomada por outra categoria passa à seguinte livre: o edital não
  prevê o choque, e empurrar é menos errado do que perder a vaga.
*/
function sequenciaPorPosicao(quadro, modelo, total) {
  const slots = new Array(total).fill(null);

  const seriePosicoes = (categoria, quantidade) => {
    const serie = [...categoria.posicoes];
    let proxima = serie.length ? serie[serie.length - 1] : 0;
    while (serie.length < quantidade && categoria.intervalo > 0) {
      proxima += categoria.intervalo;
      if (proxima > total * 2 + categoria.intervalo) break;
      serie.push(proxima);
    }
    return serie.slice(0, quantidade);
  };

  [...categoriasDeReserva(modelo)]
    .sort((a, b) => a.ordem - b.ordem)
    .forEach((categoria) => {
      const quantidade = quadro[categoria.id] || 0;
      if (!quantidade) return;
      let colocadas = 0;
      seriePosicoes(categoria, quantidade).forEach((posicao) => {
        let indice = posicao - 1;
        while (indice < total && slots[indice] !== null) indice += 1;
        if (indice >= total) return;
        slots[indice] = categoria.id;
        colocadas += 1;
      });
      // Sobrou vaga da categoria sem posição publicada: entra no 1º lugar livre.
      for (
        let indice = 0;
        indice < total && colocadas < quantidade;
        indice += 1
      ) {
        if (slots[indice] !== null) continue;
        slots[indice] = categoria.id;
        colocadas += 1;
      }
    });

  const ampla = categoriaDaAmpla(modelo);
  return slots.map((id) => id ?? ampla.id);
}

/**
 * O ciclo de categorias, do 1º ao último chamado imediato.
 *
 * Empates resolvem-se pela ordem declarada das categorias, para que o resultado
 * seja sempre o mesmo entre execuções.
 */
export function sequenciaDeConvocacao(quadro, modelo) {
  const total = totalDoQuadro(quadro);
  if (!total) return [];
  return modelo.distribuicao === "posicao_fixa"
    ? sequenciaPorPosicao(quadro, modelo, total)
    : sequenciaProporcional(quadro, modelo, total);
}

/**
 * Decide em quais reservas o candidato de fato concorre.
 *
 * `maior_percentual` — a maioria dos editais: uma só, a de percentual mais
 * elevado; empatado o percentual, aquela em que tem a melhor posição relativa.
 *
 * `acumula_com_acumulavel` — 91/2026: mantém a reserva marcada como acumulável
 * (PCD, na prática) MAIS a de maior percentual entre as outras.
 *
 * `todas` — escape, não usado por nenhum edital lido.
 *
 * @param {string[]} reservas Reservas declaradas, já lidas da modalidade.
 * @param {object} modelo Modelo normalizado.
 * @param {Map<string, number>} posicaoNaReserva Posição do candidato,
 *   1-indexada, dentro da lista específica de cada reserva que declarou.
 * @returns {string[]} as reservas em que concorre.
 */
export function reservasEfetivas(reservas, modelo, posicaoNaReserva) {
  const declaradas = (reservas || []).filter((id) =>
    modelo.categorias.some(
      (categoria) => categoria.id === id && !categoria.ampla,
    ),
  );
  if (declaradas.length <= 1) return declaradas;
  if (modelo.cotaMultipla === "todas") return declaradas;

  const percentual = (id) =>
    modelo.categorias.find((categoria) => categoria.id === id)?.percentual ?? 0;
  const eAcumulavel = (id) =>
    modelo.categorias.find((categoria) => categoria.id === id)?.acumulavel ===
    true;

  const porPrioridade = [...declaradas].sort(
    (a, b) =>
      percentual(b) - percentual(a) ||
      (posicaoNaReserva?.get(a) ?? Infinity) -
        (posicaoNaReserva?.get(b) ?? Infinity) ||
      declaradas.indexOf(a) - declaradas.indexOf(b),
  );

  if (modelo.cotaMultipla === "acumula_com_acumulavel") {
    const acumulavel = porPrioridade.find(eAcumulavel);
    const outra = porPrioridade.find((id) => !eAcumulavel(id));
    return [acumulavel, outra].filter(Boolean);
  }

  return [porPrioridade[0]];
}

/*
  Posição de cada candidato dentro da lista específica de cada reserva que
  declarou. É o insumo do desempate de percentuais iguais, e tem de ser
  calculado sobre a fila JÁ ordenada.
*/
function posicoesNasReservas(fila) {
  const contadores = new Map();
  return fila.map((item) => {
    const posicoes = new Map();
    item.declaradas.forEach((id) => {
      const proxima = (contadores.get(id) ?? 0) + 1;
      contadores.set(id, proxima);
      posicoes.set(id, proxima);
    });
    return posicoes;
  });
}

/**
 * Monta a convocação de UMA vaga (um código de vaga de um edital).
 *
 * @param {object} entrada
 * @param {Array} entrada.candidatos Candidatos daquela vaga, em qualquer ordem.
 * @param {object} entrada.quadro Vagas imediatas por categoria.
 * @param {object} entrada.modelo Modelo de convocação já normalizado.
 * @param {boolean} [entrada.proporcionalidade=true] Quando falso, devolve a
 *   ordem pura de classificação, sem categorias.
 */
export function montarConvocacaoDaVaga({
  candidatos,
  quadro,
  modelo: modeloCru,
  proporcionalidade = true,
}) {
  const modelo = modeloCru?.categorias
    ? modeloCru
    : normalizarModelo(modeloCru);
  const quadroFinal = normalizarQuadro(quadro, modelo);
  const ampla = categoriaDaAmpla(modelo);

  const declaradasDe = (candidato) =>
    lerModalidade(candidato?.modalidade, modelo).reservas;

  const ordenados = ordenarPorClassificacao(candidatos);
  const foraDaFila = ordenados.filter(estaForaDaFila).map((candidato) => ({
    candidato,
    posicao: null,
    categoria: null,
    categoriaReservada: null,
    imediata: false,
    reservas: declaradasDe(candidato),
    reservasEfetivas: [],
  }));
  const naFila = ordenados.filter((candidato) => !estaForaDaFila(candidato));

  if (!proporcionalidade) {
    const total = totalDoQuadro(quadroFinal);
    return {
      linhas: naFila.map((candidato, indice) => ({
        candidato,
        posicao: indice + 1,
        categoria: null,
        categoriaReservada: null,
        imediata: total > 0 && indice < total,
        reservas: declaradasDe(candidato),
        reservasEfetivas: [],
      })),
      foraDaFila,
      totalImediatas: total,
      ciclo: [],
    };
  }

  const ciclo = sequenciaDeConvocacao(quadroFinal, modelo);
  const totalImediatas = ciclo.length;

  /*
    Sem quadro de vagas não há ciclo a repetir; a vaga inteira é cadastro de
    reserva e sai na ordem geral. Chamar a isso um ciclo de ampla mantém uma só
    travessia em vez de um segundo caminho de código.
  */
  const cicloEfetivo = ciclo.length ? ciclo : [ampla.id];

  /*
    As reservas de cada candidato são lidas UMA vez: a leitura passa os termos de
    todas as categorias pela célula, e refazê-la a cada tentativa de preencher
    uma vaga tornaria o cálculo quadrático numa vaga com centenas de aprovados.
  */
  const fila = naFila.map((candidato) => ({
    candidato,
    declaradas: declaradasDe(candidato),
  }));
  const posicoes = posicoesNasReservas(fila);
  fila.forEach((item, indice) => {
    item.efetivas = reservasEfetivas(item.declaradas, modelo, posicoes[indice]);
  });

  /*
    Cada categoria guarda um ponteiro na fila, que só avança. Pode fazê-lo
    porque candidato que já foi chamado, ou que não disputa aquela categoria,
    nunca volta a ser elegível — o que deixa o preenchimento linear.
  */
  const ocupado = new Array(fila.length).fill(false);
  const ponteiros = new Map();

  const disputa = (item, categoriaId) =>
    categoriaId === ampla.id || item.efetivas.includes(categoriaId);

  const proximoDa = (categoriaId) => {
    let indice = ponteiros.get(categoriaId) ?? 0;
    while (
      indice < fila.length &&
      (ocupado[indice] || !disputa(fila[indice], categoriaId))
    )
      indice += 1;
    ponteiros.set(categoriaId, indice);
    return indice < fila.length ? indice : -1;
  };

  /*
    A vaga tenta a sua reserva, depois a cascata declarada no modelo, e só então
    a ampla — que nunca fica vazia enquanto sobrar gente na fila, e é o que
    garante o fim do laço.
  */
  const preencher = (categoriaId) => {
    const categoria = modelo.categorias.find((item) => item.id === categoriaId);
    const tentativas = [categoriaId, ...(categoria?.cascata || []), ampla.id];
    for (const alvo of tentativas) {
      const indice = proximoDa(alvo);
      if (indice >= 0) return { indice, categoria: alvo };
    }
    return null;
  };

  const linhas = [];
  for (let volta = 0; linhas.length < fila.length; volta += 1) {
    const categoriaDaVaga = cicloEfetivo[volta % cicloEfetivo.length];
    const escolha = preencher(categoriaDaVaga);
    if (!escolha) break;

    ocupado[escolha.indice] = true;
    const reverteu = escolha.categoria !== categoriaDaVaga;
    linhas.push({
      candidato: fila[escolha.indice].candidato,
      posicao: linhas.length + 1,
      categoria: escolha.categoria,
      categoriaReservada: reverteu ? categoriaDaVaga : null,
      imediata: linhas.length < totalImediatas,
      reservas: fila[escolha.indice].declaradas,
      reservasEfetivas: fila[escolha.indice].efetivas,
    });
  }

  return { linhas, foraDaFila, totalImediatas, ciclo };
}

/*
  Sub judice entra sem código de vaga — a inclusão manual só pede edital, cargo,
  nome e nota. Para não virar uma "vaga" só dele, o candidato é anexado à vaga do
  mesmo cargo quando existe exatamente uma; havendo várias, o cargo passa a ser a
  própria chave, porque não há como adivinhar a qual delas ele pertence.
*/
function indexarCodigosPorCargo(candidatos) {
  const porCargo = new Map();
  (candidatos || []).forEach((candidato) => {
    const codigo = texto(candidato?.codigo_vaga);
    if (!codigo) return;
    const cargo = texto(candidato?.cargo);
    if (!porCargo.has(cargo)) porCargo.set(cargo, new Set());
    porCargo.get(cargo).add(codigo);
  });
  return porCargo;
}

function resolverCodigoDaVaga(candidato, porCargo) {
  const codigo = texto(candidato?.codigo_vaga);
  if (codigo) return codigo;
  const codigos = porCargo.get(texto(candidato?.cargo));
  if (codigos && codigos.size === 1) return [...codigos][0];
  return "";
}

/**
 * Agrupa os candidatos por edital e vaga e resolve a convocação de cada grupo.
 *
 * @param {Array} candidatos Linhas de `listar_candidatos_aprovados`.
 * @param {(editalId: string, codigoVaga: string) => ({
 *   proporcionalidade: boolean, quadro: object, modelo: object
 * })} obterConfiguracao Devolve a configuração da vaga. A escolha entre o quadro
 *   derivado do percentual e o quadro manual é de quem chama; aqui só se consome
 *   o resultado.
 * @returns {Array} um grupo por vaga, ordenado por edital, cargo e código.
 */
export function montarListaDeConvocacao(candidatos, obterConfiguracao) {
  const porCargo = indexarCodigosPorCargo(candidatos);
  const grupos = new Map();

  (candidatos || []).forEach((candidato) => {
    const editalId = String(candidato?.edital_id ?? "");
    const cargo = texto(candidato?.cargo);
    const codigoVaga = resolverCodigoDaVaga(candidato, porCargo);
    const chave = `${editalId}\u0000${codigoVaga || `cargo:${cargo}`}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        chave,
        editalId,
        edital: texto(candidato?.edital),
        unidade: texto(candidato?.unidade),
        cargo,
        codigoVaga,
        listaAtiva: Boolean(candidato?.lista_ativa),
        candidatos: [],
      });
    }
    grupos.get(chave).candidatos.push(candidato);
  });

  return [...grupos.values()]
    .map((grupo) => {
      const configuracao = obterConfiguracao(grupo.editalId, grupo.codigoVaga);
      const modelo = configuracao?.modelo?.categorias
        ? configuracao.modelo
        : normalizarModelo(configuracao?.modelo);
      const quadro = normalizarQuadro(configuracao?.quadro, modelo);
      const resultado = montarConvocacaoDaVaga({
        candidatos: grupo.candidatos,
        quadro,
        modelo,
        proporcionalidade: configuracao?.proporcionalidade !== false,
      });
      return {
        ...grupo,
        quadro,
        modelo,
        proporcionalidade: configuracao?.proporcionalidade !== false,
        ...resultado,
      };
    })
    .sort(
      (a, b) =>
        a.edital.localeCompare(b.edital, "pt-BR") ||
        a.cargo.localeCompare(b.cargo, "pt-BR") ||
        a.codigoVaga.localeCompare(b.codigoVaga, "pt-BR", { numeric: true }),
    );
}

/**
 * Resumo da convocação para os KPIs da aba.
 */
export function resumirConvocacao(grupos) {
  const resumo = {
    vagas: 0,
    imediatas: 0,
    convocaveis: 0,
    reserva: 0,
    foraDaFila: 0,
    vagasRevertidas: 0,
  };
  (grupos || []).forEach((grupo) => {
    resumo.vagas += 1;
    resumo.imediatas += grupo.totalImediatas;
    grupo.linhas.forEach((linha) => {
      if (linha.imediata) resumo.convocaveis += 1;
      else resumo.reserva += 1;
      if (linha.categoriaReservada) resumo.vagasRevertidas += 1;
    });
    resumo.foraDaFila += grupo.foraDaFila.length;
  });
  return resumo;
}
