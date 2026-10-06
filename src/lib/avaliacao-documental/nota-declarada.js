/*
  Nota declarada: a ART (nota do questionário da Empregare, "x/30") recalculada
  pela regra a partir das respostas, só para CONFERIR a ART — divergência vira
  aviso; a ordem da Provisória continua pela ART. Sem DOM e sem estado.

  Como a regra acha a pergunta: as colunas da Empregare se chamam
  "Pergunta N - <enunciado>", e o NÚMERO N da mesma pergunta muda de vaga para
  vaga dentro do mesmo edital (no 93/2026, a experiência é a Pergunta 10, 11
  ou 12, conforme o cargo). Por isso o texto da regra casa com a coluna quando
  é o começo
    - do nome inteiro da coluna ("Pergunta 15 -", como sempre foi), ou
    - do enunciado, depois do prefixo "Pergunta N - " ("Experiência
      Profissional" acha a Pergunta 11 numa vaga e a 12 noutra, e não confunde
      com "Anexe o comprovante de Experiência Profissional…").
  Quando o enunciado muda de questionário para questionário (na Saúde
  Indígena: "Selecione sua Experiência Profissional…" ou "Marque a pontuação
  referente…"), a regra traz uma lista de alternativas e casa com qualquer uma.
  A comparação é sem acento, sem caixa, com os espaços colapsados e o &nbsp;
  da Empregare como espaço. Se o texto casar com mais de uma coluna, é
  ambíguo: não vale nenhuma (colunaDaPergunta devolve null) e a
  pré-classificação avisa (PERGUNTA_AMBIGUA:<de onde>). Prefira o começo do
  enunciado ao número.

  As respostas vêm como a Empregare exporta (DS_COLUNA_ORIGINAL): escolha
  única entre aspas ("\"1 ano\""), múltipla escolha como lista entre aspas
  separada por vírgula ("\"Sou indígena\", \"Moro em aldeia\""), "--" ou
  "Resposta não informada" quando vazia, &nbsp; no meio, e às vezes sem o
  espaço de uma quebra de linha perdida ("porinstituição"). Por isso a opção é
  comparada sem aspas, acento, caixa nem espaços (chaveDaOpcao).
*/

const lista = (v) => (Array.isArray(v) ? v : []);
const numero = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Texto comparável: sem acento, minúsculo, espaços simples (&nbsp; vira espaço). */
export function normalizarTexto(valor) {
  return String(valor ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** O prefixo "Pergunta N - " de uma coluna já normalizada. */
const PREFIXO_DA_PERGUNTA = /^pergunta ?[0-9]+ ?[-–—] ?/;

/**
 * Todas as colunas das respostas que casam com o texto da regra: o nome
 * inteiro ou o enunciado (sem "Pergunta N - ") começa por ele. O texto pode
 * ser uma lista de alternativas (o enunciado muda de questionário para
 * questionário): casa com qualquer uma.
 */
export function colunasDaPergunta(respostas, pergunta) {
  const alvos = (Array.isArray(pergunta) ? pergunta : [pergunta])
    .map(normalizarTexto)
    .filter(Boolean);
  if (!alvos.length) return [];
  return Object.keys(respostas ?? {}).filter((coluna) => {
    const nome = normalizarTexto(coluna);
    const enunciado = nome.replace(PREFIXO_DA_PERGUNTA, "");
    return alvos.some(
      (alvo) => nome.startsWith(alvo) || enunciado.startsWith(alvo),
    );
  });
}

/**
 * O começo do enunciado de uma coluna, para ligar a pergunta na regra sem o
 * número: "Pergunta 11 - Experiência Profissional em atividades compatíveis
 * com o cargo: (contabilizada…" → "Experiência Profissional em atividades
 * compatíveis com o cargo" (até o primeiro "?", ":" ou "(", no máximo 120
 * caracteres). Coluna sem "Pergunta N - " fica como está.
 */
export function comecoDoEnunciado(coluna) {
  const nome = String(coluna ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  const m = /^pergunta ?[0-9]+ ?[-–—] ?(.*)$/i.exec(nome);
  if (!m) return nome.slice(0, 200);
  const comeco = m[1].split(/[?:(]/)[0].trim() || m[1].trim();
  if (comeco.length <= 120) return comeco;
  const corte = comeco.slice(0, 120);
  return corte.slice(
    0,
    corte.lastIndexOf(" ") > 40 ? corte.lastIndexOf(" ") : 120,
  );
}

/** A coluna da pergunta; null quando nenhuma ou mais de uma casa (ambígua). */
export function colunaDaPergunta(respostas, pergunta) {
  const colunas = colunasDaPergunta(respostas, pergunta);
  return colunas.length === 1 ? colunas[0] : null;
}

/** O texto da regra casa com mais de uma coluna? */
export function perguntaAmbigua(respostas, pergunta) {
  return colunasDaPergunta(respostas, pergunta).length > 1;
}

const SEM_RESPOSTA = new Set(["", "--", "resposta nao informada"]);

/**
 * A resposta como a Empregare exporta, sem as aspas e sem o &nbsp;
 * ("\"1 ano&nbsp;\"" → "1 ano"); vazia, "--" ou "Resposta não informada" → "".
 */
export function textoDaResposta(valor) {
  const t = String(valor ?? "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .trim();
  const semAspas = /^"[^"]*"$/.test(t) ? t.slice(1, -1).trim() : t;
  return SEM_RESPOSTA.has(normalizarTexto(semAspas)) ? "" : semAspas;
}

/**
 * As opções marcadas numa múltipla escolha: a Empregare exporta
 * "\"Sou indígena\", \"Moro em aldeia\""; sem aspas, separadas por ";", "|"
 * ou linha.
 */
export function opcoesDaResposta(valor) {
  const t = String(valor ?? "").replace(/&nbsp;|&#160;/gi, " ");
  const entreAspas = [...t.matchAll(/"([^"]*)"/g)].map((m) => m[1]);
  return (entreAspas.length ? entreAspas : t.split(/[;|\n]/))
    .map(textoDaResposta)
    .filter(Boolean);
}

/**
 * A chave tolerante de uma opção: sem aspas, acento, caixa nem espaços — a
 * Empregare às vezes perde a quebra de linha ("porinstituição").
 */
export function chaveDaOpcao(valor) {
  return normalizarTexto(textoDaResposta(valor)).replace(/ /g, "");
}

function valorDoMapa(mapa, resposta) {
  const alvo = chaveDaOpcao(resposta);
  if (!alvo) return null;
  const chave = Object.keys(mapa ?? {}).find((k) => chaveDaOpcao(k) === alvo);
  return chave === undefined ? null : numero(mapa[chave]);
}

const comTeto = (valor, teto) =>
  teto === null || teto === undefined ? valor : Math.min(valor, teto);
const arredondar = (n) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/**
 * Recalcula a nota declarada de um candidato.
 * @param {object} regra a regra do edital (usa provisoria.nota_declarada)
 * @param {Record<string, string>} respostas as colunas da Empregare (DS_COLUNA_ORIGINAL)
 * @returns {{ total: number, parciais: Record<string, number>, itens: object[], sem_mapa: number }}
 */
export function calcularNotaDeclarada(regra, respostas) {
  const itens = lista(regra?.provisoria?.nota_declarada).map((item) => {
    const coluna = colunaDaPergunta(respostas, item.pergunta);
    const resposta = coluna ? String(respostas[coluna] ?? "") : "";
    let pontos = 0;
    let mapeada = false;
    if (coluna && textoDaResposta(resposta)) {
      if (item.tipo === "OPCAO") {
        const v = valorDoMapa(item.pontos, resposta);
        mapeada = v !== null;
        pontos = v ?? 0;
      } else if (item.tipo === "FAIXA_EM_MESES") {
        const meses = valorDoMapa(item.meses, resposta);
        mapeada = meses !== null;
        pontos = (meses ?? 0) * numero(item.pontos_por_mes);
      } else if (item.tipo === "OPCOES_SOMADAS") {
        const marcadas = new Set(opcoesDaResposta(resposta).map(chaveDaOpcao));
        const casadas = Object.keys(item.pontos ?? {}).filter((opcao) =>
          marcadas.has(chaveDaOpcao(opcao)),
        );
        mapeada = casadas.length > 0;
        pontos = casadas.reduce(
          (soma, opcao) => soma + numero(item.pontos[opcao]),
          0,
        );
      }
    }
    return {
      parcial: item.parcial,
      pergunta: item.pergunta,
      coluna,
      resposta,
      mapeada,
      pontos: arredondar(comTeto(pontos, item.teto)),
    };
  });
  const parciais = {};
  for (const item of itens)
    parciais[item.parcial] = arredondar(
      (parciais[item.parcial] ?? 0) + item.pontos,
    );
  return {
    total: arredondar(Object.values(parciais).reduce((a, b) => a + b, 0)),
    parciais,
    itens,
    sem_mapa: itens.filter(
      (i) => i.coluna && textoDaResposta(i.resposta) && !i.mapeada,
    ).length,
  };
}

/** A ART como número: "6,0/30,0" ou "45,0/50,0" → 6 ou 45. Sem número ("--"), null. */
export function lerArt(texto) {
  const m = textoDaResposta(texto).match(/^(-?\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** A ART diverge da nota declarada além da tolerância da regra? */
export function divergeDaArt(art, declarada, tolerancia = 0) {
  if (art === null || art === undefined || !Number.isFinite(Number(art)))
    return false;
  return Math.abs(Number(art) - Number(declarada)) > Number(tolerancia) + 1e-9;
}
