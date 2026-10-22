import type {
  AvisoDaClassificacao,
  RecorteDasListas,
  ResultadoDoMotor,
  TipoDeLista,
} from "./tipos-do-resultado.ts";
import { objetoDosRecursos } from "../dados-dos-recursos.ts";

/*
  O que a tela de Classificação precisa em volta do motor, sem DOM:
  - a data de corte da idade a partir do cronograma do edital (o fim do
    período de inscrição; com prorrogação, o fim mais tarde);
  - os indicadores (KPIs) de um resultado;
  - o recorte da tela (vaga, lista, busca pelo nome) sobre o resultado;
  - os avisos agrupados por tipo, para o topo;
  - a lista em que a tela abre, pela fase do edital.
*/
import { semAcento } from "./catalogo.ts";
import { lerData, numeroBR } from "./numeros.ts";
import { instantaneoDaLista } from "./exportacao.ts";

/**
 * As etapas de inscrição do cronograma: "inscri" no nome, sem resultado,
 * recurso, homologação, deferimento ou validação ("Validação das inscrições"
 * é a etapa seguinte, dos Projetos). Mesma regra de etapas_de_inscricao
 * (python/monitora/avaliacao_documental/pre_classificacao.py).
 */
export function etapasDeInscricao(cronograma: unknown = []) {
  return (Array.isArray(cronograma) ? cronograma : [])
    .filter(
      (etapa): etapa is Record<string, unknown> =>
        etapa !== null && typeof etapa === "object" && !Array.isArray(etapa),
    )
    .filter((etapa) => {
      const nome = semAcento(etapa?.atividade);
      return (
        /inscri/.test(nome) &&
        !/resultado|recurso|homolog|deferid|valida/.test(nome)
      );
    });
}

const dia = (valor: unknown) =>
  lerData(valor) ? String(valor).slice(0, 10) : null;

/** { inicio, fim } ("AAAA-MM-DD" ou null) das inscrições: o início mais cedo e o fim mais tarde (sem fim, o início). */
export function janelaDasInscricoes(cronograma: unknown = []) {
  let inicio: string | null = null;
  let fim: string | null = null;
  for (const etapa of etapasDeInscricao(cronograma)) {
    const comeco = dia(etapa?.inicio);
    const termino = dia(etapa?.fim) || comeco;
    if (comeco && (!inicio || comeco < inicio)) inicio = comeco;
    if (termino && (!fim || termino > fim)) fim = termino;
  }
  return { inicio, fim };
}

/** "AAAA-MM-DD" do fim das inscrições, ou null. */
export function dataDeCorteDoCronograma(cronograma: unknown = []) {
  return janelaDasInscricoes(cronograma || []).fim;
}

export const ROTULOS_DOS_AVISOS: Readonly<Record<string, string>> =
  Object.freeze({
    EMPATE_PENDENTE: "Empate aguardando sorteio ou decisão",
    AGUARDANDO_ANALISE: "Candidatos aguardando a análise documental",
    SEM_DATA_CORTE: "Sem data de corte da idade",
    HORA_DE_NASCIMENTO: "Empate decidido pela hora de nascimento",
    PARCIAIS_DIFERENTES_DA_NOTA: "Parciais que não somam a nota documental",
    NUMERO_INVALIDO: "Número inválido",
    ENTREVISTA_SEM_ANALISE: "Entrevista sem análise ligada",
    CONVOCADO_SEM_ENTREVISTA: "Convocado sem entrevista lançada",
    ENTREVISTADO_NAO_CONVOCADO: "Entrevistado fora do limite de convocação",
    ENTREVISTADO_NAO_HABILITADO: "Entrevistado sem habilitação documental",
    SEM_NOTA_ENTREVISTA: "Entrevista sem nota",
    SEM_NOTAS_COMPETENCIA: "Sem notas por competência",
    DADO_FALTANDO: "Dado faltando para um critério",
    COMPONENTE_FALTANDO: "Componente da nota faltando",
    EMPATE_NO_LIMITE: "Empate no limite",
    VAGA_SEM_QUADRO: "Vaga sem quadro de vagas",
    NIVEL_DESCONHECIDO: "Nível da vaga não identificado",
    MODALIDADE_DESCONHECIDA: "Modalidade não informada",
    INSCRICAO_SEM_CODIGO: "Sem código de inscrição",
    ENTREVISTA_PELO_NOME: "Entrevista ligada pelo nome",
    ENTREVISTA_REPETIDA: "Entrevista repetida",
    DESEMPATE_OBSOLETO: "Desempate registrado que não vale mais",
    COTAS_DIFERENTES_DA_CONVOCACAO: "Cotas diferentes da convocação do edital",
    VAGAS_DIFERENTES_DA_CONVOCACAO: "Vagas diferentes da convocação do edital",
    AJUSTE_DIVERGENTE: "Nota da análise mudou depois do ajuste do recurso",
    AJUSTE_SEM_ENTREVISTA: "Ajuste de entrevista sem entrevista lançada",
  });

/*
  A lista gerada é anterior a um ajuste da pontuação aprovado (ou ao
  cancelamento de um aprovado) em recurso: a tela avisa "gere de novo".
  `ajustesMudaramEm` vem do banco (obter_classificacao_do_edital).
*/
export function listaDesatualizada(lista: unknown, ajustesMudaramEm: unknown) {
  const dataDaGeracao = objetoDosRecursos(lista).gerada_em;
  const gerada = Date.parse(
    typeof dataDaGeracao === "string" ? dataDaGeracao : "",
  );
  const mudou = Date.parse(
    typeof ajustesMudaramEm === "string" ? ajustesMudaramEm : "",
  );
  return Number.isFinite(gerada) && Number.isFinite(mudou) && mudou > gerada;
}

/*
  A assinatura do conteúdo de uma lista (o que a publicação mostra): por
  vaga, o cabeçalho, as listas (quem, posição, nota, modalidades, situação)
  e os eliminados (quem e motivo). Serve para comparar a geração guardada
  (retrato) com o que os dados de agora produzem.
*/
export function assinaturaDoRetrato(retrato: unknown) {
  const r = objetoDosRecursos(retrato);
  const lista = (v: unknown) => (Array.isArray(v) ? v : []);
  const linha = (l: unknown) => {
    const x = objetoDosRecursos(l);
    return [
      x.analise_id ?? null,
      x.posicao ?? null,
      x.nota ?? null,
      lista(x.modalidades),
      x.situacao ?? null,
    ];
  };
  const vagas = lista(r.vagas)
    .map((v) => {
      const q = objetoDosRecursos(v);
      const listas = objetoDosRecursos(q.listas);
      return [
        String(q.chave ?? ""),
        String(q.cabecalho ?? ""),
        lista(q.geral).map(linha),
        Object.keys(listas)
          .sort()
          .map((k) => [k, lista(listas[k]).map(linha)]),
        lista(q.eliminados).map((e) => {
          const x = objetoDosRecursos(e);
          return [x.analise_id ?? null, x.motivo ?? null];
        }),
      ] as const;
    })
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return JSON.stringify([String(r.tipo ?? ""), vagas]);
}

/**
 * A geração guardada não corresponde mais aos dados de agora? Devolve o
 * motivo ("a regra mudou" / "os dados mudaram") ou null. Compara a versão da
 * regra, as quantidades registradas (nas listas e eliminados) e, quando o
 * retrato já foi lido, o conteúdo inteiro (posições, notas, empates decididos).
 */
export function geracaoDesatualizada(
  lista: unknown,
  resultado: ResultadoDoMotor | null | undefined,
  versaoVigente?: number | null,
): string | null {
  if (!lista || !resultado) return null;
  const l = objetoDosRecursos(lista);
  if (
    typeof l.versao_regra === "number" &&
    typeof versaoVigente === "number" &&
    l.versao_regra !== versaoVigente
  )
    return "a regra mudou";
  const totais: Record<string, number> = resultado.totais;
  for (const chave of ["elegiveis", "eliminados"]) {
    const registrado = l[chave];
    if (typeof registrado === "number" && registrado !== totais[chave])
      return "os dados mudaram";
  }
  if (
    l.retrato &&
    assinaturaDoRetrato(l.retrato) !==
      assinaturaDoRetrato(instantaneoDaLista(resultado))
  )
    return "os dados mudaram";
  return null;
}

const PESO_DO_TOM: Record<string, number> = { danger: 0, warning: 1, info: 2 };

/** Os avisos agrupados por código, do mais grave: `[{ codigo, rotulo, tom, itens }]`. */
export function avisosAgrupados(avisos: AvisoDaClassificacao[] = []) {
  const grupos = new Map<
    string,
    {
      codigo: string;
      rotulo: string;
      tom: string;
      itens: AvisoDaClassificacao[];
    }
  >();
  for (const a of avisos) {
    if (!grupos.has(a.codigo))
      grupos.set(a.codigo, {
        codigo: a.codigo,
        rotulo: ROTULOS_DOS_AVISOS[a.codigo] || a.codigo,
        tom: a.tom || "info",
        itens: [],
      });
    grupos.get(a.codigo)?.itens.push(a);
  }
  return [...grupos.values()].sort(
    (a, b) =>
      (PESO_DO_TOM[a.tom] ?? 3) - (PESO_DO_TOM[b.tom] ?? 3) ||
      b.itens.length - a.itens.length,
  );
}

/* O recorte da tela: vaga (chave), lista ("geral" ou modalidade) e busca pelo nome. */
export const RECORTE_VAZIO: Readonly<RecorteDasListas> = Object.freeze({
  vaga: "",
  lista: "geral",
  busca: "",
});

export function recortarResultado(
  resultado: ResultadoDoMotor | null | undefined,
  recorte: RecorteDasListas = RECORTE_VAZIO,
) {
  if (!resultado) return [];
  const busca = semAcento(recorte.busca).trim();
  const casa = (nome: string) => !busca || semAcento(nome).includes(busca);
  return resultado.vagas
    .filter((v) => !recorte.vaga || v.chave === recorte.vaga)
    .map((v) => {
      const linhas =
        recorte.lista === "geral"
          ? v.geral
          : v.porModalidade[recorte.lista] || [];
      return {
        ...v,
        linhas: linhas.filter((l) => casa(l.nome)),
        eliminadosFiltrados: v.eliminados.filter((e) => casa(e.nome)),
        aguardandoFiltrados: (v.aguardando || []).filter((a) => casa(a.nome)),
      };
    })
    .filter(
      (v) =>
        !busca ||
        v.linhas.length ||
        v.eliminadosFiltrados.length ||
        v.aguardandoFiltrados.length,
    );
}

/** Quantos filtros estão ativos (para o painel recolhível). */
export function filtrosAtivosDoRecorte(recorte: RecorteDasListas) {
  return [
    recorte.vaga,
    recorte.lista !== "geral" ? recorte.lista : "",
    recorte.busca.trim(),
  ].filter(Boolean).length;
}

/**
 * A lista em que a tela abre: o resultado final quando já há nota de
 * entrevista lançada; senão a preliminar (o edital ainda está na avaliação
 * documental ou nas entrevistas, e o final sairia vazio).
 */
export function listaDaFase(dados: unknown): TipoDeLista {
  const entrevistas = objetoDosRecursos(dados).entrevistas;
  const comNota = (Array.isArray(entrevistas) ? entrevistas : []).some(
    (e) => numeroBR(objetoDosRecursos(e).nota) !== null,
  );
  return comNota ? "FINAL" : "PRELIMINAR";
}
