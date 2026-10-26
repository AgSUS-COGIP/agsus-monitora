/*
  A ficha da avaliação documental (fase F4): o que a tela precisa além da
  conta (pontuacao.ts). Sem DOM e sem estado.

  - o que o candidato DECLAROU em cada bloco: as respostas da Empregare das
    perguntas ligadas ao bloco na regra (o formato real: aspas, múltipla
    escolha, "--", &nbsp;), pela mesma leitura da nota declarada
    (nota-declarada.ts);
  - os pontos declarados por parcial (calcularNotaDeclarada com a regra, no
    nível da vaga do lançamento — itens com pontos_por_nivel);
  - o lançamento inicial (nível da vaga, modalidade, indígena e aldeia pelas
    respostas) e o que falta para concluir (pendências): situação de cada
    bloco, motivo do Não conforme/Não enviado, motivo do item recusado e
    JUSTIFICATIVA de toda nota diferente da declarada;
  - o resumo que vai para o banco (DS_RESULTADO) e o endereço da vaga na
    Empregare.

  O lançamento é o "candidato" de pontuacao.ts, com:
    blocos[<CODIGO>] = { situacao, motivos[], motivo_livre, nota_ajustada,
                         justificativas[], justificativa_livre, observacao }
  "Outro motivo (descrever)": o código OUTRO_MOTIVO em motivos (Não confere,
  Não enviou) ou em justificativas (nota diferente da declarada) e o texto em
  motivo_livre (10 caracteres ou mais), que vale como o motivo. A
  `observacao` (Observação do avaliador, opcional, até 2.000 caracteres) vai
  para "Observações da análise" com o item (pontuacao.ts).
    titulos[] = { titulo, nome, aceito, motivo }
    cursos[]  = { nome, horas, aceito, motivo }
    vinculos[]= { empregador, categoria, inicio, fim, aceito, motivo }
  O banco revalida a estrutura (supabase/migrations/20261007130000_conteudo_da_ficha.sql)
  e o Python reconfere a conta (python/monitora/avaliacao_documental/pontuacao.py).
*/
import { nivelDaVaga } from "../classificacao/vagas.ts";
import {
  PARCIAIS,
  PARCIAL_DO_TIPO,
  rotuloDe,
  TITULOS_ACADEMICOS,
} from "./catalogo.ts";
import {
  calcularNotaDeclarada,
  chaveDaOpcao,
  colunasDaPergunta,
  comecoDoEnunciado,
  opcoesDaResposta,
  textoDaResposta,
} from "./nota-declarada.ts";
import {
  calcularAvaliacao,
  modalidadesDoLancamento,
  OUTRO_MOTIVO,
  tetoDoBloco,
} from "./pontuacao.ts";
import { faltaNasDatasDoVinculo, hojeEmBrasilia } from "./datas-do-vinculo.ts";
import { normalizarRegraAnalise } from "./regra.ts";
import { faltasDoCargo, regraDaVaga } from "./regra-por-cargo.ts";

const lista = (v) => (Array.isArray(v) ? v : []);
const objeto = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
const DIFERENCA = 1e-4;

/**
 * A regra que vale para a ficha: normalizada e com a diferença do cargo da
 * vaga (regraDaVaga: cargo > nível > padrão). Aplicar de novo não muda nada.
 */
export function regraDaFicha(regra, lancamento) {
  return regraDaVaga(normalizarRegraAnalise(regra), lancamento);
}

/**
 * As escolhas de cada item, lado a lado (atalhos 1, 2 e 3): [código, rótulo,
 * tecla]. Sobre as situações que o banco conhece (apurado-da-ficha.ts):
 * Confere = CONFORME com a pontuação declarada; Não confere = NAO_CONFORME
 * (ou NAO_ENVIADO, "não enviou"); Editar nota = CONFORME com a pontuação
 * pelos itens registrados (só nos blocos que pontuam).
 */
export const ESCOLHAS_DA_FICHA = Object.freeze([
  ["CONFERE", "Confere", "1"],
  ["NAO_CONFERE", "Não confere", "2"],
  ["EDITAR", "Editar nota", "3"],
]);

/** A pergunta de cada item, acima das escolhas. */
export const PERGUNTA_DA_DECISAO = "O documento confere com o declarado?";

/** Escolha pela tecla (1, 2, 3); null para as outras. */
export function escolhaDaTecla(tecla) {
  return ESCOLHAS_DA_FICHA.find(([, , t]) => t === tecla)?.[0] ?? null;
}

/** Tipos de bloco que lançam itens (mini formulário). */
export const BLOCOS_COM_ITENS = Object.freeze({
  TITULOS: "titulos",
  CURSOS: "cursos",
  VINCULOS: "vinculos",
});

/**
 * Blocos que o avaliador decide pela faixa/nota do bloco, sem a lista item a
 * item (pedido da COREs, 14/10/2026: Cursos de Aperfeiçoamento): Confere (a
 * nota declarada), Editar nota (com justificativa) ou Não confere. A ficha
 * antiga que já tem cursos lançados continua com a lista como estava.
 */
export const BLOCOS_PELA_NOTA = Object.freeze(["CURSOS"]);

/**
 * O bloco decide pela nota, sem a lista? Sim em BLOCOS_PELA_NOTA, a menos que
 * o avaliador já tenha lançado à mão um item completo e aceito (ficha antiga).
 * A linha vazia ou sem horas (aberta pela tela antiga) e o item lido do
 * arquivo não trazem a lista de volta.
 */
export function decidePelaNota(bloco, lancamento) {
  if (!BLOCOS_PELA_NOTA.includes(bloco?.tipo)) return false;
  const chave = BLOCOS_COM_ITENS[bloco.tipo];
  return !lista(lancamento?.[chave]).some(
    (i) => i && !i.do_arquivo && i.aceito !== false && itemCompleto(chave, i),
  );
}

/** Bloco que a ficha mostra: os que só registram não pedem situação. */
const pedeSituacao = (bloco) => bloco.tipo !== "REGISTRO";

/* Efeito que muda o resultado (o SO_REGISTRO só registra). */
const mudaOResultado = (efeito) =>
  typeof efeito === "string" && efeito !== "" && efeito !== "SO_REGISTRO";

/**
 * O bloco de títulos, cursos ou experiência não pontua no nível da vaga: o
 * teto no nível é 0 ou, nos títulos por nível (pontos_por_nivel), não há
 * tabela para o nível (no 114/2026, a titulação só pontua no superior). Só
 * quando o bloco não tem como mudar o resultado: sem efeito (além de
 * SO_REGISTRO) na situação nem nos motivos, sem requisito do cargo, sem
 * linha extra e sem experiência mínima. Igual a FC_BLOCO_NAO_PONTUA_NO_NIVEL
 * (migration 20261014210000). Sem nível conhecido, pontua.
 */
export function blocoNaoPontuaNoNivel(bloco, nivel) {
  if (!nivel || !["TITULOS", "CURSOS", "VINCULOS"].includes(bloco?.tipo))
    return false;
  const doNivelDaVaga = objeto(objeto(bloco.por_nivel)[nivel]);
  const podeMudar =
    Object.values(objeto(bloco.efeitos)).some(mudaOResultado) ||
    lista(bloco.motivos).some((m) => mudaOResultado(m?.efeito)) ||
    lista(bloco.requisitos).length > 0 ||
    lista(bloco.extras).length > 0 ||
    lista(doNivelDaVaga.extras).length > 0 ||
    (typeof bloco.minimo_meses === "number" && bloco.minimo_meses > 0);
  if (podeMudar) return false;
  if (tetoDoBloco(bloco, nivel) === 0) return true;
  const porNivel = objeto(bloco.pontos_por_nivel);
  return (
    bloco.tipo === "TITULOS" &&
    Object.keys(porNivel).length > 0 &&
    lista(porNivel[nivel]).length === 0
  );
}

/**
 * O bloco vale para este candidato (condição de modalidade ou indígena)? O
 * que não se aplica ao cargo da vaga (regraDaVaga: nao_se_aplica) não vale,
 * nem o que não pontua no nível da vaga (blocoNaoPontuaNoNivel).
 */
export function blocoSeAplica(bloco, lancamento) {
  if (bloco?.nao_se_aplica === true) return false;
  if (blocoNaoPontuaNoNivel(bloco, lancamento?.nivel)) return false;
  const condicao =
    bloco.condicao ?? (bloco.tipo === "PONTUACAO" ? "INDIGENA" : null);
  if (!condicao) return true;
  if (condicao === "INDIGENA") return Boolean(lancamento?.indigena);
  // O bloco de cota vale para quem optou pela cota, entre as várias (114/2026, 5.8.1).
  const [, modalidade] = String(condicao).split("=");
  return modalidadesDoLancamento(lancamento).includes(
    String(modalidade ?? "")
      .trim()
      .toUpperCase(),
  );
}

/**
 * As respostas das perguntas ligadas ao bloco: uma linha por coluna que casa
 * (enunciado curto, texto sem aspas, opções da múltipla escolha).
 */
export function respostasDoBloco(bloco, respostas) {
  const linhas = [];
  const vistas = new Set();
  for (const pergunta of lista(bloco?.perguntas)) {
    for (const coluna of colunasDaPergunta(respostas, pergunta)) {
      if (vistas.has(coluna)) continue;
      vistas.add(coluna);
      const valor = respostas[coluna];
      const opcoes = opcoesDaResposta(valor);
      const texto =
        opcoes.length > 1 ? opcoes.join(", ") : textoDaResposta(valor);
      linhas.push({
        coluna,
        enunciado: comecoDoEnunciado(coluna),
        texto,
        opcoes,
      });
    }
  }
  return linhas;
}

/** Sem resposta em nenhuma pergunta ligada: sugere "Não enviado" (AM-7.5). */
export function sugereNaoEnviado(linhas) {
  return linhas.length > 0 && linhas.every((l) => !l.texto);
}

/**
 * Os pontos declarados por parcial: a nota declarada da regra a partir das
 * respostas, no nível da vaga do lançamento (a experiência do 93/2026 vale
 * 5 a cada 6 meses no nível superior e 4 no técnico). Só entra a parcial cuja
 * pergunta foi achada nas respostas e, no item por nível, com pontos para o
 * nível.
 */
export function declaradaDaFicha(regra, respostas, nivel = null) {
  const calc = calcularNotaDeclarada(regra, respostas ?? {}, nivel);
  const parciais = {};
  for (const item of calc.itens)
    if (item.coluna && !item.nivel_desconhecido)
      parciais[item.parcial] =
        Math.round(((parciais[item.parcial] ?? 0) + item.pontos) * 1e4) / 1e4;
  return {
    parciais,
    total: Object.values(parciais).reduce((a, b) => a + b, 0),
    itens: calc.itens,
  };
}

/** O nível da vaga pela regra de classificação (niveis_por_cargo, nivel_padrao). */
export function nivelDaFicha(cargo, documental) {
  return (
    nivelDaVaga({ cargo: cargo ?? "" }, { documental: objeto(documental) }) ||
    "superior"
  );
}

/** Uma opção marcada que diz "indígena" / "aldeia" (sem "não"). */
function marcou(linhas, termo) {
  return linhas.some((l) =>
    (l.opcoes.length ? l.opcoes : [l.texto]).some((o) => {
      const chave = chaveDaOpcao(o);
      return chave.includes(termo) && !chave.startsWith("nao");
    }),
  );
}

/**
 * O lançamento de uma ficha nova: nível, modalidade e, quando a regra tem o
 * critério étnico, indígena e aldeia como o candidato respondeu (o analista
 * confirma). Lançamento gravado vem por cima. A vaga e o cargo são sempre os
 * da ficha (a diferença por cargo da regra: regra-por-cargo.ts; o banco grava
 * os mesmos em salvar_rascunho_ficha e concluir_ficha).
 */
export function lancamentoInicial({
  regra,
  respostas,
  modalidade,
  modalidades,
  cargo,
  vaga,
  documental,
  gravado,
}) {
  const r = normalizarRegraAnalise(regra);
  const etnico = r.blocos.find((b) => b.tipo === "PONTUACAO");
  const linhas = etnico ? respostasDoBloco(etnico, respostas) : [];
  const base = {
    nivel: nivelDaFicha(cargo, documental),
    modalidade: modalidade || "AC",
    // As cotas optadas na pré-classificação (a principal primeiro); [] = só a ampla.
    modalidades: Array.isArray(modalidades)
      ? modalidades
      : modalidadesDoLancamento({ modalidade }),
    indigena: etnico ? marcou(linhas, "indigena") : false,
    mora_aldeia: etnico ? marcou(linhas, "aldeia") : false,
    aldeia_na_lista: false,
    blocos: {},
    titulos: [],
    cursos: [],
    vinculos: [],
    estagio_horas: 0,
    observacoes: "",
    observacoes_prontas: [],
  };
  const g = objeto(gravado);
  const daFicha = {
    vaga: vaga === undefined || vaga === null ? null : String(vaga),
    cargo: cargo ?? null,
  };
  return Object.keys(g).length
    ? { ...base, ...g, blocos: objeto(g.blocos), ...daFicha }
    : { ...base, ...daFicha };
}

const textoComparavel = (t) =>
  String(t ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const mesmoTexto = (a, b) =>
  Boolean(textoComparavel(a)) && textoComparavel(a) === textoComparavel(b);

/**
 * As justificativas que o bloco oferece: os motivos do bloco e as
 * observações prontas (sem a observação de texto igual a um motivo do bloco:
 * vale o motivo).
 */
export function opcoesDeJustificativa(regra, bloco) {
  const r = normalizarRegraAnalise(regra);
  return [
    ...lista(bloco?.motivos).map((m) => ({
      codigo: m.codigo,
      texto: m.texto,
      grupo: "Motivos do bloco",
    })),
    ...r.observacoes_prontas
      .filter(
        (o) =>
          !lista(bloco?.motivos).some(
            (m) =>
              m.codigo === o.codigo ||
              mesmoTexto(m.texto, o.texto) ||
              mesmoTexto(m.texto, o.rotulo),
          ),
      )
      .map((o) => ({
        codigo: o.codigo,
        texto: o.rotulo || o.texto,
        grupo: "Observações prontas",
      })),
  ];
}

/** Calcula a ficha com a regra e as notas mínimas da regra de classificação. */
export function calcularFicha(regra, lancamento, documental) {
  const doc = objeto(documental);
  return calcularAvaliacao(regra, lancamento, {
    notaMinima: doc.nota_minima ?? null,
    notaMinimaPorNivel: objeto(doc.nota_minima_por_nivel),
    // Acúmulo e percentuais das cotas (FC_DOCUMENTAL_DO_EDITAL): a modalidade final.
    cotas: objeto(doc.cotas),
  });
}

const temTexto = (v, min = 1) => String(v ?? "").trim().length >= min;

export { OUTRO_MOTIVO };
/** O mínimo do motivo escrito (o banco pede o mesmo em FC_PENDENCIAS_FICHA). */
export const MINIMO_DO_MOTIVO_LIVRE = 10;
/** O limite da Observação do avaliador (FC_VALIDAR_LANCAMENTO_FICHA). */
export const TAMANHO_DA_OBSERVACAO = 2000;

/** Marcou "Outro motivo (descrever)" nesta lista de códigos? */
export const marcouOutroMotivo = (codigos) =>
  lista(codigos).includes(OUTRO_MOTIVO);
const daRegra = (codigos) => lista(codigos).filter((c) => c !== OUTRO_MOTIVO);
const motivoLivreBasta = (l) =>
  temTexto(l.motivo_livre, MINIMO_DO_MOTIVO_LIVRE);

/** O bloco tem justificativa para a nota diferente da declarada? */
export function blocoJustificado(regra, bloco, lancado) {
  const l = objeto(lancado);
  if (daRegra(l.justificativas).length) return true;
  if (marcouOutroMotivo(l.justificativas) && motivoLivreBasta(l)) return true;
  if (
    ["NAO_CONFORME", "NAO_ENVIADO"].includes(l.situacao) &&
    (lista(l.motivos).length || motivoLivreBasta(l))
  )
    return true;
  return (
    !opcoesDeJustificativa(regra, bloco).length &&
    temTexto(l.justificativa_livre, 10)
  );
}

/** A nota apurada do bloco difere da declarada? (null = sem declarada) */
export function divergenciaDoBloco(bloco, avaliacao, declarada) {
  const parcial = PARCIAL_DO_TIPO[bloco.tipo];
  if (!parcial) return null;
  const decl = objeto(declarada?.parciais)[parcial];
  const apur = avaliacao?.parciais?.[parcial];
  if (typeof decl !== "number" || typeof apur !== "number") return null;
  return Math.abs(apur - decl) > DIFERENCA
    ? { parcial, declarada: decl, apurada: apur, diferenca: apur - decl }
    : null;
}

const datasValidas = (v) =>
  /^\d{4}-\d{2}-\d{2}$/.test(String(v?.inicio ?? "")) &&
  /^\d{4}-\d{2}-\d{2}$/.test(String(v?.fim ?? "")) &&
  v.fim >= v.inicio;

/** O item lançado está completo (título com nível, curso com horas, vínculo com datas)? */
export function itemCompleto(chave, item) {
  if (!item || typeof item !== "object") return false;
  if (chave === "titulos") return Boolean(item.titulo);
  if (chave === "cursos") return Number(item.horas) > 0;
  if (chave === "vinculos") return datasValidas(item);
  return true;
}

const FALTA_DO_COMPROVADO = {
  titulos: "Registre ao menos um título.",
  cursos: "Registre ao menos um curso com carga horária.",
  vinculos: "Registre ao menos um vínculo com início e fim.",
};

/**
 * Com Declarado acima de 0, o Confere e o Editar nota (CONFORME) pedem ao
 * menos um título ou vínculo completo e aceito (os cursos não: BLOCOS_PELA_NOTA). Devolve o texto da falta (ou null).
 */
export function faltaDoComprovado(bloco, lancamento, declarada) {
  const chave = BLOCOS_COM_ITENS[bloco?.tipo];
  // Cursos: pela faixa/nota do bloco, sem exigir a lista (BLOCOS_PELA_NOTA).
  if (!chave || BLOCOS_PELA_NOTA.includes(bloco.tipo)) return null;
  const decl = objeto(declarada?.parciais)[PARCIAL_DO_TIPO[bloco.tipo]];
  if (!(typeof decl === "number" && decl > 0)) return null;
  const algum = lista(lancamento?.[chave]).some(
    (i) => i && i.aceito !== false && itemCompleto(chave, i),
  );
  return algum ? null : FALTA_DO_COMPROVADO[chave];
}

const ZERAM_O_BLOCO = ["NAO_CONFORME", "NAO_ENVIADO"];

/**
 * O caminho legítimo da pontuação acima do comprovado: Editar nota
 * (edita_nota) com a justificativa do ajuste (blocoJustificado). O Confere
 * "silencioso" não basta.
 */
export const acimaDoComprovadoJustificado = (regra, bloco, lancado) =>
  objeto(lancado).edita_nota === true &&
  blocoJustificado(regra, bloco, lancado);

/**
 * O bloco de itens (títulos, vínculos; cursos só na ficha antiga com a lista)
 * Conforme com a pontuação que vai valer ACIMA do que os itens aceitos dão
 * (o calculado): o Confere grava a declarada (Doutorado declarado com só a
 * Especialização registrada). Abaixo não é falta: no Confere vale a
 * declarada, mesmo que os itens comprovem mais (decisão de 23/10/2026).
 * Devolve { parcial, valor, calculado, meses } ou null. Só o Editar nota com
 * justificativa (acimaDoComprovadoJustificado) aceita a diferença; o banco
 * recalcula os itens e recusa o mesmo (FC_PENDENCIAS_FICHA e
 * FC_VALIDAR_RESULTADO_FICHA, migration 20261023090000) e o Python também
 * (pendencias_da_ficha). Cursos pela nota (decidePelaNota) não têm itens.
 */
export function pontuacaoAcimaDoComprovado(bloco, lancamento, avaliacao) {
  const chave = BLOCOS_COM_ITENS[bloco?.tipo];
  const lancado = objeto(objeto(lancamento?.blocos)[bloco?.codigo]);
  if (!chave || lancado.situacao !== "CONFORME") return null;
  if (decidePelaNota(bloco, lancamento)) return null;
  const parcial = PARCIAL_DO_TIPO[bloco.tipo];
  const valor = avaliacao?.parciais?.[parcial];
  const calculado = avaliacao?.calculados?.[parcial];
  if (typeof valor !== "number" || typeof calculado !== "number") return null;
  if (!(valor - calculado > DIFERENCA)) return null;
  const exp = objeto(avaliacao?.experiencia);
  const meses =
    bloco.tipo === "VINCULOS"
      ? Number(exp.meses_considerados ?? exp.meses) || 0
      : null;
  return { parcial, valor, calculado, meses };
}

const NOME_DOS_ITENS = {
  titulos: "os títulos aceitos dão",
  cursos: "os cursos aceitos dão",
};

/** O texto da pendência da pontuação acima do comprovado. */
function textoDoAcimaDoComprovado(bloco, acima) {
  const mes = (n) => `${n} ${Number(n) === 1 ? "mês" : "meses"}`;
  const pts = (n) =>
    `${textoDaNota(n)} ${Number(n) === 1 ? "ponto" : "pontos"}`;
  if (bloco.tipo === "VINCULOS")
    return `Experiência confirmada com ${pts(acima.valor)}, mas os vínculos aceitos comprovam ${mes(acima.meses)} (${pts(acima.calculado)}). Lance os vínculos que comprovam o período declarado ou ajuste a pontuação em Editar nota, com justificativa.`;
  const itens = NOME_DOS_ITENS[BLOCOS_COM_ITENS[bloco.tipo]];
  return `${nomeCurtoDoBloco(bloco)} confirmada com ${pts(acima.valor)}, mas ${itens} ${pts(acima.calculado)}. Registre os itens que comprovam o declarado ou ajuste a pontuação em Editar nota, com justificativa.`;
}

/**
 * O lançamento que vai para o banco (rascunho e conclusão): no bloco Não
 * conforme ou Não enviado, as linhas incompletas saem (não contam e não
 * pedem nada); nos outros, o curso sem horas vai sem o campo, para a linha
 * em preenchimento não travar o rascunho (a falta fica na tela).
 */
export function lancamentoParaGravar(regraEntrada, lancamento) {
  const regra = regraDaFicha(regraEntrada, lancamento);
  const saida = { ...objeto(lancamento) };
  const blocos = objeto(saida.blocos);
  for (const bloco of regra.blocos) {
    const chave = BLOCOS_COM_ITENS[bloco.tipo];
    if (!chave || !Array.isArray(saida[chave])) continue;
    const zerado = ZERAM_O_BLOCO.includes(
      objeto(blocos[bloco.codigo]).situacao,
    );
    // Pela nota (Cursos): a lista não aparece, então não vão para o banco as
    // linhas incompletas nem a recusada sem motivo (ficha antiga) — a tela não
    // pede nada delas e o banco (FC_PENDENCIAS_FICHA) travaria a conclusão.
    const pelaNota = decidePelaNota(bloco, saida);
    const semIncompletas = zerado || pelaNota;
    saida[chave] = saida[chave]
      .filter((i) => !semIncompletas || itemCompleto(chave, i))
      .filter((i) => !pelaNota || !(i?.aceito === false && !i.motivo))
      .map((i) => {
        if (chave !== "cursos" || !i || typeof i !== "object") return i;
        const horas = Number(i.horas);
        if (i.horas !== "" && i.horas !== null && Number.isFinite(horas))
          return i;
        const { horas: _semHoras, ...resto } = i;
        return resto;
      });
  }
  return saida;
}

/** O analista já marcou a situação do bloco (Conforme, Não conforme, Não enviado)? */
export const blocoConferido = (lancamento, bloco) =>
  Boolean(objeto(objeto(lancamento?.blocos)[bloco?.codigo]).situacao);

/*
  A ordem das faltas de um item: a mais útil para o próximo passo primeiro
  (decidir, dizer o motivo, registrar o comprovado, completar a linha…).
*/
const ORDEM_DAS_FALTAS = [
  "situacao",
  "motivo",
  "requisito",
  "extra",
  "comprovado",
  "horas",
  "datas",
  "item",
  "minimo",
  "acima",
  "justificativa",
  "nota",
];

/**
 * A única mensagem do item (a falta mais útil, pelas pendências da ficha) ou
 * null. Sem `comSituacao`, a falta da decisão não conta (ela só aparece
 * depois de tentar concluir).
 */
export function mensagemDoBloco(
  pendencias,
  codigo,
  { comSituacao = false } = {},
) {
  const doBloco = lista(pendencias).filter(
    (p) => p.bloco === codigo && (comSituacao || p.tipo !== "situacao"),
  );
  if (!doBloco.length) return null;
  const ordem = (p) => {
    const i = ORDEM_DAS_FALTAS.indexOf(p.tipo);
    return i < 0 ? ORDEM_DAS_FALTAS.length : i;
  };
  return [...doBloco].sort((a, b) => ordem(a) - ordem(b))[0].texto;
}

/**
 * O item está conferido: tem decisão e nada falta nele (pelas pendências da
 * ficha). É a regra do contador "X de 6 conferidos" e das marcas do stepper.
 */
export const itemConferido = (bloco, lancamento, pendencias = []) =>
  blocoConferido(lancamento, bloco) &&
  !mensagemDoBloco(pendencias, bloco?.codigo);

/**
 * O que falta para concluir, bloco a bloco: [{ bloco, tipo, texto }]. Vazio =
 * pode concluir. O banco confere o mesmo em concluir_ficha. `tipo`: situacao,
 * motivo, item, datas, horas, comprovado, minimo, acima, justificativa ou
 * nota. `acima`: o bloco de itens (títulos, vínculos, cursos com a lista)
 * Conforme com a pontuação acima do que os itens aceitos dão
 * (pontuacaoAcimaDoComprovado), sem Editar nota com justificativa. `minimo`:
 * a experiência Conforme abaixo do mínimo pelos vínculos aceitos ou Não
 * confere/Não enviou com os vínculos aceitos cumprindo o mínimo (não
 * eliminaria) — fora quando outro bloco já elimina (a experiência é só
 * informativa). `datas`: o vínculo aceito com data inválida, antes de 1960 ou
 * com o fim depois de hoje (`opcoes.hoje`, AAAA-MM-DD; padrão: hoje em
 * Brasília). A nota diferente da declarada só pede justificativa depois que o
 * bloco foi conferido (antes, a falta é a própria situação).
 */
export function pendenciasDaFicha(
  regraEntrada,
  lancamento,
  avaliacao,
  declarada,
  opcoes = {},
) {
  const regra = regraDaFicha(regraEntrada, lancamento);
  const hoje = opcoes.hoje ?? hojeEmBrasilia();
  const pendencias = [];
  const blocos = objeto(lancamento?.blocos);
  const eliminadoPorBloco = lista(avaliacao?.blocos).some(
    (b) => b?.efeito === "ELIMINA",
  );
  for (const bloco of regra.blocos) {
    if (!pedeSituacao(bloco) || !blocoSeAplica(bloco, lancamento)) continue;
    const l = objeto(blocos[bloco.codigo]);
    const falta = (tipo, texto) =>
      pendencias.push({ bloco: bloco.codigo, tipo, texto });
    if (!l.situacao)
      falta(
        "situacao",
        PARCIAL_DO_TIPO[bloco.tipo]
          ? "Escolha Confere, Não confere ou Editar nota."
          : "Escolha Confere ou Não confere.",
      );
    // O motivo do Não confere: um da regra, o "Outro motivo" descrito ou,
    // no bloco sem motivos, o texto. Marcado, o "Outro motivo" pede o texto
    // (também na justificativa da nota).
    const zera = ["NAO_CONFORME", "NAO_ENVIADO"].includes(l.situacao);
    const outro = marcouOutroMotivo(
      zera ? l.motivos : l.situacao === "CONFORME" ? l.justificativas : [],
    );
    if (outro && !motivoLivreBasta(l))
      falta(
        zera ? "motivo" : "justificativa",
        "Descreva o outro motivo (10 caracteres ou mais).",
      );
    else if (
      zera &&
      !daRegra(l.motivos).length &&
      !(outro || (!lista(bloco.motivos).length && motivoLivreBasta(l)))
    )
      falta(
        "motivo",
        lista(bloco.motivos).length
          ? "Escolha o motivo."
          : "Escreva o motivo (10 caracteres ou mais).",
      );
    // Pela nota (Cursos): sem lista, os itens não pedem nada.
    const chave = decidePelaNota(bloco, lancamento)
      ? null
      : BLOCOS_COM_ITENS[bloco.tipo];
    // Não conforme/Não enviado: as linhas incompletas são ignoradas.
    const zerado = ZERAM_O_BLOCO.includes(l.situacao);
    if (chave) {
      const itens = lista(lancamento?.[chave]).filter(
        (i) => !zerado || itemCompleto(chave, i),
      );
      if (itens.some((i) => i && i.aceito === false && !i.motivo))
        falta("item", "Escolha o motivo da recusa do item.");
      // O item recusado não conta: não pede as datas nem a carga horária (a
      // recusa pode ser justamente "carga horária não comprovada").
      const aceitos = itens.filter((i) => i && i.aceito !== false);
      const faltaNasDatas =
        chave === "vinculos"
          ? aceitos.map((v) => faltaNasDatasDoVinculo(v, hoje)).find(Boolean)
          : null;
      if (faltaNasDatas) falta("datas", faltaNasDatas);
      if (chave === "cursos" && aceitos.some((c) => !(Number(c.horas) > 0)))
        falta("horas", "Informe a carga horária do curso.");
      // Já eliminado por outro bloco (efeito Elimina): não pede o registro.
      const comprovado =
        l.situacao === "CONFORME" && !eliminadoPorBloco
          ? faltaDoComprovado(bloco, lancamento, declarada)
          : null;
      if (comprovado) falta("comprovado", comprovado);
      // A experiência mínima que elimina, pelos vínculos aceitos (os meses do
      // mínimo em apurarExperiencia; o banco pede o mesmo em FC_PENDENCIAS_FICHA).
      // Eliminado por OUTRO bloco (identidade, escolaridade, requisito…), a
      // experiência é só informativa e o resultado não muda: não pede nada
      // (decisão da coordenação, 22/10/2026). Continua valendo quando a única
      // eliminação é a da própria experiência.
      const exp = avaliacao?.experiencia;
      const minimo = Number(bloco.minimo_meses);
      const eliminadoPorOutro = lista(avaliacao?.blocos).some(
        (b) => b?.efeito === "ELIMINA" && b.codigo !== bloco.codigo,
      );
      if (
        chave === "vinculos" &&
        exp &&
        minimo > 0 &&
        (bloco.efeito_minimo ?? "ELIMINA") === "ELIMINA" &&
        !eliminadoPorOutro
      ) {
        const meses =
          Number(
            bloco.minimo_conta_estagio ? exp.meses_considerados : exp.meses,
          ) || 0;
        const mes = (n) => `${n} ${Number(n) === 1 ? "mês" : "meses"}`;
        // Conforme abaixo do mínimo eliminaria em silêncio: lance os vínculos
        // ou marque Não conforme.
        if (!comprovado && l.situacao === "CONFORME" && meses < minimo)
          falta(
            "minimo",
            `Experiência mínima de ${mes(minimo)} não comprovada (comprovado ${mes(meses)}): registre os vínculos que comprovam ou escolha Não confere.`,
          );
        // Não confere (ou Não enviou) com os vínculos aceitos cumprindo o
        // mínimo não elimina (só zera a experiência): desmarque os vínculos
        // não aceitos ou marque Confere.
        if (zera && meses >= minimo)
          falta(
            "minimo",
            `Experiência marcada como ${l.situacao === "NAO_ENVIADO" ? "Não enviou" : "Não confere"}, mas os vínculos aceitos somam ${mes(meses)} (mínimo ${mes(minimo)}). Desmarque os vínculos que não foram aceitos — sem a experiência mínima o candidato é eliminado — ou marque Confere.`,
          );
      }
      // A pontuação confirmada acima do que os itens aceitos dão (o banco
      // recalcula e pede o mesmo em FC_PENDENCIAS_FICHA): só com Editar nota e
      // justificativa. Sem item ou abaixo do mínimo, a falta já é outra. No
      // inapto por requisito a pontuação é só informativa e não vale
      // (20261021090000).
      const acima =
        !comprovado &&
        avaliacao?.resultado !== "INAPTO_REQUISITO" &&
        !pendencias.some((p) => p.bloco === bloco.codigo && p.tipo === "minimo")
          ? pontuacaoAcimaDoComprovado(bloco, lancamento, avaliacao)
          : null;
      if (acima && !acimaDoComprovadoJustificado(regra, bloco, l))
        falta("acima", textoDoAcimaDoComprovado(bloco, acima));
    }
    // Com Não confere, o motivo do bloco já justifica o zero.
    if (
      l.situacao === "CONFORME" &&
      avaliacao?.resultado !== "INAPTO_REQUISITO" &&
      divergenciaDoBloco(bloco, avaliacao, declarada) &&
      !blocoJustificado(regra, bloco, l) &&
      // O "Outro motivo" sem texto já pediu a descrição (uma falta só).
      !(outro && !motivoLivreBasta(l))
    )
      falta(
        "justificativa",
        "Pontuação diferente da declarada: escolha a justificativa.",
      );
    // Diferenças por cargo (a regra da vaga): cada requisito do cargo e cada
    // item extra conferido (o banco pede o mesmo em FC_PENDENCIAS_FICHA).
    for (const f of faltasDoCargo(bloco, l)) falta(f.tipo, f.texto);
    const ajuste = l.nota_ajustada;
    const teto = tetoDoBloco(bloco, lancamento?.nivel);
    if (
      typeof ajuste === "number" &&
      (ajuste < 0 || (teto !== null && ajuste > teto))
    )
      falta("nota", `Ajuste a pontuação entre 0 e ${teto}.`);
  }
  return pendencias;
}

/** O bloco pode eliminar (situação, motivo ou experiência mínima com efeito ELIMINA)? */
function blocoEhRequisito(bloco) {
  if (Object.values(objeto(bloco.efeitos)).includes("ELIMINA")) return true;
  if (lista(bloco.motivos).some((m) => m?.efeito === "ELIMINA")) return true;
  return (
    bloco.tipo === "VINCULOS" &&
    Number(bloco.minimo_meses) > 0 &&
    (bloco.efeito_minimo ?? "ELIMINA") === "ELIMINA"
  );
}

/** Nome curto do bloco nas faltas: a parcial ("Formação Acadêmica") ou o título até o parêntese ou a vírgula. */
export function nomeCurtoDoBloco(bloco) {
  const parcial = PARCIAL_DO_TIPO[bloco?.tipo];
  if (parcial) return rotuloDe(PARCIAIS, parcial);
  return String(bloco?.titulo ?? bloco?.codigo ?? "")
    .split(/ \(|,/)[0]
    .trim();
}

/* Quantos blocos o "Falta: …" nomeia antes do "e mais N". */
const MAXIMO_NA_FALTA = 3;

const COMPLEMENTO_DA_FALTA = {
  motivo: "motivo",
  item: "motivo do item",
  datas: "datas",
  horas: "carga horária",
  justificativa: "justificativa",
  nota: "nota",
  minimo: "experiência mínima",
  acima: "pontuação acima do comprovado",
  comprovado: "item comprovado",
  requisito: "requisitos do cargo",
  extra: "item extra",
};

/**
 * Onde a conferência está (a barra de progresso, o resultado provisório e o
 * "Concluir e próxima"), sem mudar a conta: os blocos que pedem situação e se
 * aplicam ao candidato são os itens; os que podem eliminar são os requisitos.
 *
 * situacao: "EM_ANALISE" enquanto falta conferir algum item e nenhum item
 * conferido eliminou; "INAPTO_REQUISITO" assim que um item conferido elimina;
 * com tudo conferido, o resultado da conta.
 * faltam: [{ bloco, nome, complementos[] }]; texto_da_falta: "Falta: Formação
 * Acadêmica, Experiência Profissional (justificativa)".
 */
export function conferenciaDaFicha(
  regraEntrada,
  lancamento,
  avaliacao,
  pendencias = [],
) {
  const regra = regraDaFicha(regraEntrada, lancamento);
  const itens = regra.blocos.filter(
    (b) => pedeSituacao(b) && blocoSeAplica(b, lancamento),
  );
  const conferido = (b) => blocoConferido(lancamento, b);
  // Conta como conferido o item com decisão e sem falta: a mesma regra das
  // marcas do stepper (etapasDaFicha), para o contador não contradizer o "!".
  const semFalta = (b) => itemConferido(b, lancamento, pendencias);
  const requisitos = itens.filter(blocoEhRequisito);
  const efeitos = Object.fromEntries(
    lista(avaliacao?.blocos).map((b) => [b.codigo, b.efeito]),
  );
  const eliminou = itens.some(
    (b) =>
      conferido(b) &&
      (efeitos[b.codigo] === "ELIMINA" ||
        (b.tipo === "VINCULOS" &&
          blocoEhRequisito(b) &&
          Boolean(avaliacao?.experiencia?.abaixo_do_minimo))),
  );
  const conferidos = itens.filter(semFalta).length;
  const situacao = eliminou
    ? "INAPTO_REQUISITO"
    : conferidos < itens.length
      ? "EM_ANALISE"
      : (avaliacao?.resultado ?? "EM_ANALISE");

  const faltam = [];
  for (const b of regra.blocos) {
    const doBloco = lista(pendencias).filter((p) => p.bloco === b.codigo);
    if (!doBloco.length) continue;
    const complementos = [
      ...new Set(
        doBloco.map((p) => COMPLEMENTO_DA_FALTA[p.tipo]).filter(Boolean),
      ),
    ];
    faltam.push({ bloco: b.codigo, nome: nomeCurtoDoBloco(b), complementos });
  }
  const nomes = faltam.map((f) =>
    f.complementos.length ? `${f.nome} (${f.complementos.join(", ")})` : f.nome,
  );
  const texto_da_falta = !nomes.length
    ? ""
    : nomes.length > MAXIMO_NA_FALTA + 1
      ? `Falta: ${nomes.slice(0, MAXIMO_NA_FALTA).join(", ")} e mais ${nomes.length - MAXIMO_NA_FALTA}`
      : `Falta: ${nomes.join(", ")}`;
  return {
    total: itens.length,
    conferidos,
    requisitos: {
      total: requisitos.length,
      conferidos: requisitos.filter(semFalta).length,
    },
    situacao,
    faltam,
    texto_da_falta,
    pode_concluir: !lista(pendencias).length,
  };
}

/** "Em análise · 2 de 4 requisitos conferidos"; fora da análise, o resultado. */
export function textoDaSituacaoDaConferencia(conferencia) {
  if (conferencia.situacao !== "EM_ANALISE")
    return textoDoResultado(conferencia.situacao);
  const r = conferencia.requisitos;
  return r.total
    ? `Em análise · ${r.conferidos} de ${r.total} requisitos conferidos`
    : `Em análise · ${textoDoProgresso(conferencia)}`;
}

/** "4 de 7 conferidos". */
export const textoDoProgresso = ({ conferidos, total }) =>
  `${conferidos} de ${total} ${total === 1 ? "conferido" : "conferidos"}`;

/** O resumo da conta que vai para o banco (TB_FICHA_ANALISE."DS_RESULTADO"). */
export function resumoParaGravar(avaliacao, declarada) {
  const exp = avaliacao.experiencia;
  return {
    resultado: avaliacao.resultado,
    // Informativo: o banco publica pela mesma conta (FC_COTAS_CONFIRMADAS).
    modalidade_final: avaliacao.modalidade_final,
    modalidades_confirmadas: avaliacao.modalidades_confirmadas,
    nota_apurada: avaliacao.nota_apurada,
    nota_final: avaliacao.nota_final,
    nota_minima: avaliacao.nota_minima,
    parciais: avaliacao.parciais,
    calculados: avaliacao.calculados,
    ajustes: avaliacao.ajustes,
    declarada: objeto(declarada?.parciais),
    eliminatorios: avaliacao.eliminatorios,
    encaminhamentos: avaliacao.encaminhamentos,
    observacoes: avaliacao.observacoes,
    experiencia: exp
      ? {
          dias_total: exp.dias_total,
          meses: exp.meses,
          meses_considerados: exp.meses_considerados,
          por_categoria: exp.por_categoria,
        }
      : null,
    // Só com parecer.mostrar_pontos_quando_inapto no inapto por requisito (o banco confere).
    ...(avaliacao.pontos_informativos
      ? { pontos_informativos: avaliacao.pontos_informativos }
      : {}),
  };
}

/** Nota como a tela mostra: vírgula decimal, até 2 casas ("12,5"). */
export function textoDaNota(valor) {
  const n = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(n)) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

const RESULTADOS_DA_FICHA = {
  APTO: ["Apto", "aprovado"],
  INAPTO_REQUISITO: ["Inapto (requisito)", "reprovado"],
  INAPTO_NOTA: ["Inapto (nota mínima)", "reprovado"],
};

/** "Apto", "Inapto (requisito)", "Inapto (nota mínima)". */
export const textoDoResultado = (resultado) =>
  RESULTADOS_DA_FICHA[resultado]?.[0] ?? "";

/** O tom do selo do resultado (src/ui/selo.jsx). */
export const tomDoResultado = (resultado) =>
  RESULTADOS_DA_FICHA[resultado]?.[1] ?? "neutro";

/** Rótulo de um título acadêmico. */
export function rotuloDoTitulo(codigo) {
  return (
    TITULOS_ACADEMICOS.find(([v]) => v === codigo)?.[1] ?? String(codigo ?? "")
  );
}

/** Os títulos que o bloco pontua no nível (para o select do mini formulário). */
export function titulosDoNivel(bloco, nivel) {
  const tabela = lista(objeto(bloco?.pontos_por_nivel)[nivel]);
  return tabela.length
    ? tabela.map((t) => ({
        codigo: t.titulo,
        rotulo: rotuloDoTitulo(t.titulo),
        pontos: t.pontos,
      }))
    : TITULOS_ACADEMICOS.map(([codigo, rotulo]) => ({
        codigo,
        rotulo,
        pontos: 0,
      }));
}

/*
  Endereços da Empregare para a ficha. O robô captura (F7, migration
  20261007160000) o identificador interno da vaga e o link de detalhes de
  cada candidato; obter_ficha_analise devolve os dois em `empregare`.
  - Com o identificador interno, a vaga abre direto nas candidaturas
    (".../candidaturas/<id>|"). Sem ele, Vagas Anunciadas: a URL com o código
    numérico dá "Sem permissão" e a busca na URL é descartada pelo
    redirecionamento, então a ficha copia o código para colar na busca.
  - O link do candidato só vale se for a página de detalhes da Empregare
    (o mesmo formato que o banco aceita); qualquer outro vira null.
*/
const EMPREGARE = "https://corporate.empregare.com";
const ID_INTERNO_DA_VAGA = /^(?![0-9]+\|*$)[A-Za-z0-9_.~=-]{1,96}\|{0,3}$/;
const LINK_DO_CANDIDATO =
  /^https:\/\/corporate\.empregare\.com\/empresa\/curriculo\/detalhes\?[A-Za-z0-9_.~=&%|+/:-]+$/;

export function enderecoDaVagaNaEmpregare(codigoDaVaga, idInterno) {
  const interno = String(idInterno ?? "").trim();
  if (ID_INTERNO_DA_VAGA.test(interno))
    return `${EMPREGARE}/empresa/vagas/candidaturas/${interno}`;
  const codigo = String(codigoDaVaga ?? "").trim();
  return /^\d{1,20}$/.test(codigo) ? `${EMPREGARE}/empresa/vagas` : null;
}

export function enderecoDoCandidatoNaEmpregare(link) {
  const texto = String(link ?? "").trim();
  return texto.length <= 600 && LINK_DO_CANDIDATO.test(texto) ? texto : null;
}

/** "Salvo às HH:MM" no fuso de Brasília. */
export function textoDoSalvo(data) {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return `Salvo às ${d.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  })}`;
}

/** Ações do histórico da ficha, como a tela mostra. */
export const ACOES_DO_HISTORICO = Object.freeze({
  CRIAR: "Ficha aberta no lote",
  PEGAR: "Pegou a ficha",
  RESERVAR: "Abriu a ficha",
  LIBERAR: "Fechou a ficha",
  LIBERAR_RESERVA: "Reserva liberada pela coordenação",
  DISTRIBUIR: "Distribuída",
  REDISTRIBUIR: "Redistribuída",
  DEVOLVER_FILA: "Devolvida à fila",
  REVISAR: "Mandada para revisão",
  SAIR_LOTE: "Saiu do lote",
  VOLTAR_LOTE: "Voltou ao lote",
  SALVAR: "Rascunho salvo",
  CONCLUIR: "Concluída",
  REABRIR: "Reaberta",
  CORRIGIR: "Corrigida (correção de dados)",
});

/** Uma alteração do histórico em texto ("Experiência: 25 → 20 (justificativa)"). */
export function textoDaAlteracao(alt) {
  const a = objeto(alt);
  const de = a.de === null || a.de === undefined ? "—" : String(a.de);
  const para = a.para === null || a.para === undefined ? "—" : String(a.para);
  return `${a.rotulo || a.campo || ""}: ${de} → ${para}`;
}

/* ── Apoio do modo de análise: etapas, prévia do parecer e anexos ─────── */

/* O nome curto da etapa pelo título do bloco (a regra pode trazer rotulo_curto). */
const NOMES_DA_ETAPA = [
  [/identifica|identidade/i, "Identidade"],
  [/escolaridade|diploma|forma[cç][aã]o exigida/i, "Formação"],
  [/conselho/i, "Conselho"],
];
const NOME_DO_TIPO_NA_ETAPA = {
  TITULOS: "Titulação",
  CURSOS: "Cursos",
  VINCULOS: "Experiência",
  PONTUACAO: "Critério étnico",
};

/** "Identidade", "Formação", "Conselho", "Titulação", "Cursos", "Experiência"… */
export function nomeDaEtapa(bloco) {
  const proprio = String(bloco?.rotulo_curto ?? "").trim();
  if (proprio) return proprio;
  if (NOME_DO_TIPO_NA_ETAPA[bloco?.tipo])
    return NOME_DO_TIPO_NA_ETAPA[bloco.tipo];
  const titulo = String(bloco?.titulo ?? "");
  const achado = NOMES_DA_ETAPA.find(([padrao]) => padrao.test(titulo));
  if (achado) return achado[1];
  const curto = nomeCurtoDoBloco(bloco);
  return curto.length > 18 ? `${curto.slice(0, 17).trim()}…` : curto;
}

/**
 * As etapas do topo do modo de análise, uma por item que pede situação e se
 * aplica: { codigo, nome, estado, motivo }. estado: "nao_conferido",
 * "pendencia" (decidido, mas falta algo: o motivo diz o quê, a mesma mensagem
 * do item), "CONFORME", "NAO_CONFORME" ou "NAO_ENVIADO".
 */
export function etapasDaFicha(regraEntrada, lancamento, pendencias = []) {
  const regra = regraDaFicha(regraEntrada, lancamento);
  return regra.blocos
    .filter((b) => pedeSituacao(b) && blocoSeAplica(b, lancamento))
    .map((b) => {
      const situacao = objeto(objeto(lancamento?.blocos)[b.codigo]).situacao;
      const motivo = situacao ? mensagemDoBloco(pendencias, b.codigo) : null;
      return {
        codigo: b.codigo,
        nome: nomeDaEtapa(b),
        estado: !situacao ? "nao_conferido" : motivo ? "pendencia" : situacao,
        motivo,
      };
    });
}

export const TEXTO_DO_PARECER_EM_ANALISE =
  "Em análise — o parecer é gerado quando todos os itens forem conferidos.";

/**
 * A prévia do parecer na lateral. Enquanto falta conferir algum item, nada de
 * resultado (a conta trata o bloco não marcado como Conforme e a experiência
 * sem vínculo como abaixo do mínimo): só o aviso e os motivos já lançados nos
 * itens conferidos. Com tudo conferido, o parecer da conta.
 * Devolve { completa, texto, motivos[] }.
 */
export function previaDoParecer(avaliacao, conferencia, lancamento) {
  const completa =
    !conferencia || (conferencia.conferidos ?? 0) >= (conferencia.total ?? 0);
  if (completa)
    return { completa: true, texto: avaliacao?.parecer ?? "", motivos: [] };
  const motivos = [];
  for (const b of lista(avaliacao?.blocos)) {
    if (!blocoConferido(lancamento, { codigo: b.codigo })) continue;
    for (const m of lista(b.motivos)) {
      const texto = m.item_edital
        ? `Item ${m.item_edital}: ${m.texto}`
        : m.texto;
      if (texto && !motivos.includes(texto)) motivos.push(texto);
    }
  }
  return { completa: false, texto: TEXTO_DO_PARECER_EM_ANALISE, motivos };
}

/** A resposta declarada é um anexo (a Empregare escreve "Anexo")? */
export const ehAnexo = (texto) => /^anexo\b/i.test(String(texto ?? "").trim());

/* ── Modo foco: passos, para onde ir depois de decidir e a composição da nota ── */

/** O último passo do modo foco: o resumo, a nota final, as observações e o parecer. */
export const PASSO_DA_CONCLUSAO = "CONCLUSAO";

const RESOLVIDOS = new Set([
  "CONFORME",
  "NAO_CONFORME",
  "NAO_ENVIADO",
  "opcional",
]);

/**
 * Os passos do modo de análise (o stepper do topo): as etapas de etapasDaFicha,
 * o critério étnico mesmo quando ainda não vale (é nele que se marca "Indígena";
 * estado "opcional") e, no fim, a Conclusão (estado "pronta" quando nada falta).
 */
export function passosDaFicha(regraEntrada, lancamento, pendencias = []) {
  const regra = regraDaFicha(regraEntrada, lancamento);
  const etapas = new Map(
    etapasDaFicha(regra, lancamento, pendencias).map((e) => [e.codigo, e]),
  );
  const passos = [];
  for (const b of regra.blocos) {
    const etapa = etapas.get(b.codigo);
    if (etapa) passos.push(etapa);
    else if (b.tipo === "PONTUACAO")
      passos.push({
        codigo: b.codigo,
        nome: nomeDaEtapa(b),
        estado: "opcional",
      });
  }
  passos.push({
    codigo: PASSO_DA_CONCLUSAO,
    nome: "Conclusão",
    estado: lista(pendencias).length ? "nao_conferido" : "pronta",
  });
  return passos;
}

/**
 * Para onde o modo foco vai depois de uma decisão: o próximo passo, depois do
 * atual, que ainda pede algo; não havendo, o primeiro que pede antes dele; e,
 * com tudo resolvido, a Conclusão.
 */
export function proximoPassoPendente(passos, atual) {
  const itens = lista(passos).filter((p) => p.codigo !== PASSO_DA_CONCLUSAO);
  const i = itens.findIndex((p) => p.codigo === atual);
  const pede = (p) => !RESOLVIDOS.has(p.estado);
  const depois = itens.slice(i + 1).find(pede);
  const antes = i > 0 ? itens.slice(0, i).find(pede) : undefined;
  return (depois ?? antes)?.codigo ?? PASSO_DA_CONCLUSAO;
}

/**
 * A composição da nota (as barras da lateral e da Conclusão): uma linha por
 * bloco que pontua e se aplica, com o apurado (null antes de conferir), o
 * declarado (null sem pergunta mapeada), o teto no nível e se diverge.
 */
export function composicaoDaNota(
  regraEntrada,
  lancamento,
  avaliacao,
  declarada,
) {
  const regra = regraDaFicha(regraEntrada, lancamento);
  return regra.blocos
    .filter((b) => PARCIAL_DO_TIPO[b.tipo] && blocoSeAplica(b, lancamento))
    .map((b) => {
      const parcial = PARCIAL_DO_TIPO[b.tipo];
      const conferido = blocoConferido(lancamento, b);
      const decl = objeto(declarada?.parciais)[parcial];
      return {
        bloco: b.codigo,
        parcial,
        rotulo: rotuloDe(PARCIAIS, parcial),
        apurado: conferido ? (avaliacao?.parciais?.[parcial] ?? 0) : null,
        declarado: typeof decl === "number" ? decl : null,
        teto: tetoDoBloco(b, lancamento?.nivel),
        divergente:
          conferido && Boolean(divergenciaDoBloco(b, avaliacao, declarada)),
      };
    });
}
