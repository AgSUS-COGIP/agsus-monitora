/*
  FILTROS DO MAPA E DA TABELA DE PROCESSOS — LÓGICA PURA

  Tudo o que decide "esta linha entra no recorte?" e "que opções este filtro
  oferece?" vive aqui, sem DOM, para poder ser testado. O `legacy-app.js`
  guarda o estado (um Set de valores por campo) e só delega a estas funções.

  Duas regras que corrigiram bugs:

  1. Comparação por CHAVE normalizada (sem acento, sem caixa, espaços
     colapsados). "Médio" e "Medio" são a mesma opção; o rótulo mostrado é a
     grafia mais frequente nos dados.

  2. A poda repete até estabilizar. Tirar uma seleção que deixou de existir
     muda as opções dos outros campos, que por sua vez podem invalidar outra
     seleção. Uma passada só deixava seleções órfãs — os filtros "não
     encadeavam".
*/

/** Chave de comparação de um valor de filtro. */
export function chaveDeFiltro(valor) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function valorDoCampo(linha, campo) {
  return String(linha?.[campo] ?? "").trim();
}

function chavesSelecionadas(selecionados) {
  const chaves = new Set();
  (selecionados || []).forEach((valor) => {
    const chave = chaveDeFiltro(valor);
    if (chave) chaves.add(chave);
  });
  return chaves;
}

/**
 * A linha entra no recorte?
 *
 * @param {object} linha
 * @param {Record<string, Iterable<string>>} estado  valores selecionados por campo
 * @param {object} [opcoes]
 * @param {string[]} [opcoes.campos]           campos considerados (padrão: chaves do estado)
 * @param {string} [opcoes.ignorarCampo]       campo desconsiderado (para montar as opções dele)
 * @param {(linha: object) => boolean} [opcoes.excluir]  regra extra de exclusão (ex.: encerrados)
 * @param {string} [opcoes.dsei]               chave do DSEI selecionado no mapa
 * @param {(linha: object) => string} [opcoes.chaveDsei]  chave do DSEI da linha
 */
export function linhaAtende(linha, estado, opcoes = {}) {
  const { ignorarCampo = "", excluir, dsei = "", chaveDsei } = opcoes;
  if (excluir && excluir(linha)) return false;
  if (dsei && chaveDsei && chaveDsei(linha) !== dsei) return false;
  const campos = opcoes.campos || Object.keys(estado || {});
  return campos.every((campo) => {
    if (campo === ignorarCampo) return true;
    const chaves = chavesSelecionadas(estado?.[campo]);
    if (!chaves.size) return true;
    return chaves.has(chaveDeFiltro(valorDoCampo(linha, campo)));
  });
}

/**
 * Opções que o filtro `campo` oferece: os valores das linhas que atendem aos
 * OUTROS filtros, sem duplicata pela chave. O rótulo é a grafia mais frequente
 * (empate: a primeira que apareceu).
 *
 * @returns {string[]} rótulos, na ordem de `comparar` (ou alfabética)
 */
export function opcoesDoCampo(linhas, estado, campo, opcoes = {}) {
  const porChave = new Map();
  (linhas || []).forEach((linha) => {
    if (!linhaAtende(linha, estado, { ...opcoes, ignorarCampo: campo })) return;
    const valor = valorDoCampo(linha, campo);
    const chave = chaveDeFiltro(valor);
    if (!chave) return;
    let grafias = porChave.get(chave);
    if (!grafias) porChave.set(chave, (grafias = new Map()));
    grafias.set(valor, (grafias.get(valor) || 0) + 1);
  });
  const rotulos = Array.from(porChave.values()).map((grafias) => {
    let melhor = "";
    let maior = 0;
    grafias.forEach((contagem, grafia) => {
      if (contagem > maior) {
        melhor = grafia;
        maior = contagem;
      }
    });
    return melhor;
  });
  const comparar =
    opcoes.comparar ||
    ((a, b) =>
      a.localeCompare(b, "pt-BR", { numeric: true, sensitivity: "base" }));
  return rotulos.sort(comparar);
}

/**
 * Remove, até estabilizar, as seleções que nenhuma opção oferece mais.
 * Uma seleção que sobrevive é reescrita com o rótulo canônico da opção.
 * Altera `estado` no lugar.
 *
 * @returns {boolean} se alguma seleção mudou
 */
export function podarSelecoes(linhas, estado, opcoes = {}) {
  const campos = opcoes.campos || Object.keys(estado || {});
  let mudou = false;
  // Cada volta só pode remover seleções; o limite é uma trava de segurança.
  for (let volta = 0; volta <= campos.length; volta += 1) {
    let mudouNestaVolta = false;
    campos.forEach((campo) => {
      const selecionados = estado[campo];
      if (!selecionados || !selecionados.size) return;
      const disponiveis = new Map(
        opcoesDoCampo(linhas, estado, campo, { ...opcoes, campos }).map(
          (rotulo) => [chaveDeFiltro(rotulo), rotulo],
        ),
      );
      const proximos = new Set();
      selecionados.forEach((valor) => {
        const rotulo = disponiveis.get(chaveDeFiltro(valor));
        if (rotulo) proximos.add(rotulo);
      });
      const iguais =
        proximos.size === selecionados.size &&
        Array.from(proximos).every((v) => selecionados.has(v));
      if (!iguais) {
        estado[campo] = proximos;
        mudouNestaVolta = true;
      }
    });
    if (!mudouNestaVolta) break;
    mudou = true;
  }
  return mudou;
}

/**
 * Assinatura do que o mapa desenha: por DSEI, processos, vagas e ociosas.
 * Se não mudou, o mapa não precisa ser redesenhado. Contar só linhas deixava
 * bolhas e lista com vagas antigas quando a troca mantinha a mesma contagem.
 */
export function chaveDeRenderDoMapa(linhas, chaveDsei, prefixo = "") {
  const porDsei = new Map();
  (linhas || []).forEach((linha) => {
    const chave = chaveDsei(linha);
    if (!chave) return;
    const atual = porDsei.get(chave) || [0, 0, 0];
    atual[0] += 1;
    atual[1] += Number(linha.vagas_total) || 0;
    atual[2] += Number(linha.vagas_ociosas) || 0;
    porDsei.set(chave, atual);
  });
  return (
    prefixo +
    Array.from(porDsei.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([chave, [processos, vagas, ociosas]]) =>
        [chave, processos, vagas, ociosas].join(":"),
      )
      .join("|")
  );
}
