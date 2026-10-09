/*
  A lista de aprovados publicada a partir do resultado FINAL da Classificação.

  A Classificação calcula posição e nota pela regra do edital e registra a
  lista FINAL (TB_LISTA_CLASSIFICACAO, retrato em src/lib/classificacao/
  exportacao.js). "Publicar como lista de aprovados" cria a lista vigente da
  Lista de aprovados com esses candidatos — sem digitação — e preserva o que é
  da Lista de aprovados: status (Contratado, Desistente…), matrícula, processo
  SEI, sub judice e anexos de quem já estava na lista anterior.

  Aqui, sem DOM e sem rede:
  - `candidatosDaListaFinal`: os candidatos do retrato, um por análise (a
    posição da lista geral; quem só está na lista da modalidade, a posição
    dela). O banco faz a mesma conta em
    publicar_lista_aprovados_da_classificacao (migration 20261005160000).
  - `casarCandidatos`: quem da lista vigente é a mesma pessoa de quem entra.
    Pela análise (lista já publicada da Classificação); senão, para as listas
    importadas por planilha — que não trazem CPF nem código do candidato —,
    pelo nome normalizado no edital, desempatando pela vaga. Homônimo que não
    se resolve não casa: vai para a revisão manual (`manuais`).
  - `resumoDaPublicacao`: quantos entram, saem, mudam de posição, o que é
    preservado e o que fica para revisão. O banco recalcula e grava no
    histórico da publicação.
  - `origemDaLista`: o rótulo da origem da lista na tela de aprovados.

  O banco recebe os vínculos (`argumentosDaPublicacao`) e confere cada um.
*/

const texto = (valor) => String(valor ?? "").trim();

/** "José  da Silva" e "JOSE DA SILVA" viram "jose da silva". */
export function normalizarNome(nome) {
  return texto(nome)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const normalizarVaga = (codigo) => texto(codigo).toLowerCase();

const numero = (valor) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/**
 * Os candidatos do retrato FINAL, um por análise, na ordem das vagas.
 * `analises`: analise_id → { vaga, cargo } (dados do edital na Classificação),
 * para o código da vaga quando a vaga do retrato não tem (vaga do quadro).
 */
export function candidatosDaListaFinal(retrato, { analises = new Map() } = {}) {
  const vistos = new Map();
  const vagas = Array.isArray(retrato?.vagas) ? retrato.vagas : [];
  vagas.forEach((vaga, ordem) => {
    const linhas = [
      ...(vaga.geral || []).map((l) => ({ l, fonte: 0 })),
      ...Object.values(vaga.listas || {}).flatMap((ls) =>
        (ls || []).map((l) => ({ l, fonte: 1 })),
      ),
    ];
    for (const { l, fonte } of linhas) {
      const id = texto(l?.analise_id);
      if (!id) continue;
      const posicao = numero(l.posicao);
      const atual = vistos.get(id);
      const melhor =
        !atual ||
        (atual.ordem === ordem &&
          (fonte < atual.fonte ||
            (fonte === atual.fonte &&
              (posicao ?? Infinity) < (atual.posicao ?? Infinity))));
      if (!melhor) continue;
      const analise = analises.get?.(id) || {};
      vistos.set(id, {
        analise_id: id,
        nome: texto(l.nome),
        cargo: texto(vaga.cargo) || texto(analise.cargo),
        codigo_vaga:
          texto(vaga.codigo) || texto(analise.vaga) || texto(vaga.chave),
        posicao,
        nota: numero(l.nota),
        situacao:
          l.situacao === "VAGA" || l.situacao === "CR" ? l.situacao : null,
        modalidades: Array.isArray(l.modalidades) ? l.modalidades : [],
        ordem,
        fonte,
      });
    }
  });
  return [...vistos.values()]
    .sort(
      (a, b) =>
        a.ordem - b.ordem ||
        a.fonte - b.fonte ||
        (a.posicao ?? Infinity) - (b.posicao ?? Infinity),
    )
    .map(({ ordem: _o, fonte: _f, ...resto }) => resto);
}

/** O candidato da lista de aprovados tem algo que é só da lista (e se perde se não casar)? */
export function temDadosDaLista(candidato) {
  return Boolean(
    texto(candidato?.status) ||
    texto(candidato?.matricula) ||
    texto(candidato?.processo_sei) ||
    candidato?.sub_judice ||
    candidato?.alterado_judicialmente,
  );
}

const agruparPorNome = (lista) => {
  const grupos = new Map();
  for (const item of lista) {
    const chave = normalizarNome(item.nome);
    if (!chave) continue;
    if (!grupos.has(chave)) grupos.set(chave, []);
    grupos.get(chave).push(item);
  }
  return grupos;
};

/**
 * Quem da lista vigente (`anteriores`, TB_CANDIDATO_APROVADO) é quem entra
 * (`novos`, de candidatosDaListaFinal). `manuais`: candidato_id → analise_id
 * escolhido na revisão ("" = não está na lista nova).
 * Devolve { vinculos: [{ candidato_id, analise_id, forma }], naoCasados }.
 * forma: ANALISE | NOME | NOME_VAGA | MANUAL.
 */
export function casarCandidatos(anteriores, novos, { manuais = {} } = {}) {
  const livres = new Map((novos || []).map((n) => [texto(n.analise_id), n]));
  const vinculos = [];
  const decididos = new Set();
  const ambiguos = new Set();
  const vincular = (anterior, novo, forma) => {
    vinculos.push({
      candidato_id: texto(anterior.candidato_id),
      analise_id: texto(novo.analise_id),
      forma,
    });
    livres.delete(texto(novo.analise_id));
    decididos.add(texto(anterior.candidato_id));
  };
  const lista = (anteriores || []).filter((a) => texto(a?.candidato_id));

  // 1. A revisão manual manda.
  for (const a of lista) {
    const id = texto(a.candidato_id);
    if (!Object.prototype.hasOwnProperty.call(manuais, id)) continue;
    const escolhido = texto(manuais[id]);
    if (!escolhido) {
      decididos.add(id);
      continue;
    }
    const novo = livres.get(escolhido);
    if (novo) vincular(a, novo, "MANUAL");
  }

  // 2. A mesma análise.
  for (const a of lista) {
    if (decididos.has(texto(a.candidato_id))) continue;
    const novo = livres.get(texto(a.analise_id));
    if (novo) vincular(a, novo, "ANALISE");
  }

  // 3. O nome normalizado no edital; homônimo desempata pela vaga.
  const restantes = lista.filter((a) => !decididos.has(texto(a.candidato_id)));
  const porNomeAntes = agruparPorNome(restantes);
  const porNomeDepois = agruparPorNome([...livres.values()]);
  for (const [chave, antes] of porNomeAntes) {
    const depois = (porNomeDepois.get(chave) || []).filter((n) =>
      livres.has(texto(n.analise_id)),
    );
    if (!depois.length) continue;
    if (antes.length === 1 && depois.length === 1) {
      vincular(antes[0], depois[0], "NOME");
      continue;
    }
    for (const a of antes) {
      const vaga = normalizarVaga(a.codigo_vaga);
      const mesmos = depois.filter(
        (n) =>
          livres.has(texto(n.analise_id)) &&
          vaga &&
          normalizarVaga(n.codigo_vaga) === vaga,
      );
      const rivais = antes.filter(
        (b) => b !== a && vaga && normalizarVaga(b.codigo_vaga) === vaga,
      );
      if (mesmos.length === 1 && !rivais.length)
        vincular(a, mesmos[0], "NOME_VAGA");
      else ambiguos.add(texto(a.candidato_id));
    }
  }

  const casados = new Set(vinculos.map((v) => v.candidato_id));
  const naoCasados = lista
    .filter((a) => !casados.has(texto(a.candidato_id)))
    .map((a) => ({
      ...a,
      ambiguo: ambiguos.has(texto(a.candidato_id)),
      decidido: decididos.has(texto(a.candidato_id)),
    }));
  return { vinculos, naoCasados };
}

const mudouDePosicao = (anterior, novo) => {
  if (numero(anterior.classificacao) !== numero(novo.posicao)) return true;
  const vaga = normalizarVaga(anterior.codigo_vaga);
  return Boolean(vaga) && vaga !== normalizarVaga(novo.codigo_vaga);
};

/**
 * O que a publicação faz, em relação à lista vigente. A mesma conta do banco
 * (que grava os números no histórico da publicação).
 */
export function resumoDaPublicacao(anteriores, novos, casamento) {
  const porId = new Map(
    (anteriores || []).map((a) => [texto(a.candidato_id), a]),
  );
  const porAnalise = new Map(
    (novos || []).map((n) => [texto(n.analise_id), n]),
  );
  const vinculados = new Set(
    casamento.vinculos.map((v) => texto(v.analise_id)),
  );
  const mudam = [];
  const preservados = [];
  for (const v of casamento.vinculos) {
    const anterior = porId.get(v.candidato_id);
    const novo = porAnalise.get(v.analise_id);
    if (!anterior || !novo) continue;
    if (mudouDePosicao(anterior, novo)) mudam.push({ anterior, novo });
    if (temDadosDaLista(anterior)) preservados.push({ anterior, novo });
  }
  const entram = (novos || []).filter(
    (n) => !vinculados.has(texto(n.analise_id)),
  );
  const subJudiceMantidos = casamento.naoCasados.filter((a) => a.sub_judice);
  const saem = casamento.naoCasados.filter((a) => !a.sub_judice);
  const pendencias = saem.filter(temDadosDaLista);
  return {
    total: (novos || []).length + subJudiceMantidos.length,
    entram,
    saem,
    mudam,
    preservados,
    subJudiceMantidos,
    pendencias,
    ambiguos: casamento.naoCasados.filter((a) => a.ambiguo && !a.decidido),
  };
}

/** Os vínculos como o banco os recebe (p_vinculos). */
export function argumentosDaPublicacao(casamento) {
  return casamento.vinculos.map(({ candidato_id, analise_id, forma }) => ({
    candidato_id,
    analise_id,
    forma,
  }));
}

/* O motivo para trocar pela planilha uma lista publicada da Classificação. */
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 500;
export function motivoValido(motivo) {
  const t = texto(motivo);
  return t.length >= MOTIVO_MINIMO && t.length <= MOTIVO_MAXIMO;
}

const diaMes = (valor) => {
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
};

/**
 * A origem da lista vigente (linha de listar_listas_aprovados):
 * { tipo: "CLASSIFICACAO" | "XLSX", texto }.
 */
export function origemDaLista(lista) {
  if (!lista) return null;
  if (texto(lista.origem).toUpperCase() === "CLASSIFICACAO") {
    const quando = diaMes(lista.importado_em);
    return {
      tipo: "CLASSIFICACAO",
      texto: quando
        ? `Publicada da Classificação em ${quando}`
        : "Publicada da Classificação",
    };
  }
  return { tipo: "XLSX", texto: "Lista manual (planilha)" };
}

/**
 * A origem das listas na tela: a do edital quando só há um no recorte; com
 * vários, quantas vieram de cada origem.
 */
export function resumoDasOrigens(listas) {
  const vigentes = (listas || []).filter(Boolean);
  if (!vigentes.length) return "";
  if (vigentes.length === 1) return origemDaLista(vigentes[0]).texto;
  const daClassificacao = vigentes.filter(
    (l) => origemDaLista(l).tipo === "CLASSIFICACAO",
  ).length;
  const manuais = vigentes.length - daClassificacao;
  const partes = [];
  if (daClassificacao)
    partes.push(
      `${daClassificacao} ${daClassificacao === 1 ? "publicada" : "publicadas"} da Classificação`,
    );
  if (manuais)
    partes.push(
      `${manuais} ${manuais === 1 ? "manual" : "manuais"} (planilha)`,
    );
  return `Listas: ${partes.join(" · ")}`;
}
