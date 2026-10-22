/*
  Perguntas com número: o catálogo de intenções da Aya que se respondem com
  dados ao vivo ("quantas análises pendentes tem o 93/2026?", "quando foi a
  última carga da Seleção?", "quantos convocados sem nota?").

  Sem DOM, sem rede e sem estado: aqui só se reconhece a intenção e as
  entidades (edital, área, módulo, métrica) e se escreve a resposta a partir
  dos números já calculados. Quem busca os dados é src/modulos/aya/fontes.js
  (RPCs de leitura que a pessoa já pode chamar); quem conta é
  src/lib/dados-da-aya.js. A resposta só traz números e datas — nunca nome,
  CPF ou outro dado de pessoa.

  Uma intenção:
  - `id`, `fonte` (de onde vêm os dados), `view` (a tela que o botão "Abrir"
    abre) e `pagina` (a regra de paginasPermitidas que a pessoa precisa ter);
  - `modulo`: palavras que dizem o assunto ("análise", "recurso"…);
  - `metricas`: cada métrica com as palavras que a pedem e o rótulo usado na
    resposta. A primeira é a padrão.
  Pergunta sem gatilho de número ("quantos", "quando foi", "tem"…) não é
  intenção de dado: vai para a base de verbetes.
*/
import { normalizar } from "./termos-da-aya.js";

/* ---------- Entidades ---------- */

/**
 * O número do edital ("93/2026") num texto: "93/2026", "93-2026", "nº 93/26",
 * "edital 93 de 2026". Ano de 2 dígitos vira 20xx. Sem número, "".
 */
export function numeroDoEdital(texto) {
  const bruto = String(texto ?? "");
  const completo = bruto.match(/\b(\d{1,4})\s*[/-]\s*(\d{4}|\d{2})\b/);
  if (completo) {
    const ano =
      completo[2].length === 2 ? `20${completo[2]}` : String(completo[2]);
    return `${Number(completo[1])}/${ano}`;
  }
  const deAno = normalizar(bruto).match(/\b(\d{1,4}) de (\d{4})\b/);
  if (deAno) return `${Number(deAno[1])}/${deAno[2]}`;
  return "";
}

/** "edital 93" sem ano: só o número ("93"), para casar com qualquer ano. */
function numeroSemAno(texto) {
  const achado = normalizar(texto).match(
    /\b(?:edital|edt|n|no|numero)\s+(\d{1,4})\b(?!\s*(?:de\s+)?\d)/,
  );
  return achado ? String(Number(achado[1])) : "";
}

/** O edital `alvo` ("93/2026" ou "93") casa com o texto do edital da linha? */
export function mesmoEdital(textoDaLinha, alvo) {
  const pedido = String(alvo || "");
  if (!pedido) return true;
  const daLinha = numeroDoEdital(textoDaLinha);
  if (!daLinha) return false;
  if (pedido.includes("/")) return daLinha === pedido;
  return daLinha.split("/")[0] === pedido;
}

const AREAS = Object.freeze([
  ["saude-indigena", /\b(saude indigena|indigena|si|dsei|dseis)\b/],
  ["sede", /\b(sede)\b/],
  ["projetos", /\b(projetos?)\b/],
]);

export const NOMES_DAS_AREAS = Object.freeze({
  "saude-indigena": "Saúde Indígena",
  sede: "SEDE",
  projetos: "Projetos",
});

/**
 * Edital, área e "aqui": o que a pergunta nomeia, completado pelo contexto
 * (a área atual e o edital escolhido na tela). `editalExplicito` e
 * `areaExplicita` dizem se veio da pergunta.
 */
export function extrairEntidades(pergunta, contexto = {}) {
  const texto = normalizar(pergunta);
  const edital = numeroDoEdital(pergunta) || numeroSemAno(pergunta);
  const area = AREAS.find(([, padrao]) => padrao.test(texto))?.[0] || "";
  const editalDaTela = numeroDoEdital(contexto.edital);
  return {
    edital: edital || editalDaTela,
    editalExplicito: Boolean(edital),
    area: area || String(contexto.area || ""),
    areaExplicita: Boolean(area),
  };
}

/* ---------- Catálogo ---------- */

const m = (id, palavras, rotulo, extra = {}) =>
  Object.freeze({ id, palavras, rotulo, ...extra });

export const INTENCOES = Object.freeze([
  Object.freeze({
    id: "analises",
    fonte: "analises",
    view: "analises",
    pagina: "analises",
    padrao: "total",
    modulo: /\b(analises?|curricul\w*|triagem|planilha de analises?)\b/,
    metricas: Object.freeze([
      m("pendente", /\bpendente?s?\b|\bfalta\w* analisar\b/, [
        "análise pendente",
        "análises pendentes",
      ]),
      m("revisar", /\b(em revisao|revisar|revisao)\b/, [
        "análise em revisão",
        "análises em revisão",
      ]),
      m("reprovado", /\breprovad\w*\b/, ["reprovado", "reprovados"]),
      m("aprovado", /\baprovad\w*\b/, [
        "aprovado na análise",
        "aprovados na análise",
      ]),
      m("analisado", /\b(realizad\w*|feitas?|analisad\w*|concluid\w*)\b/, [
        "análise realizada",
        "análises realizadas",
      ]),
      m("total", /\b(total|aptos?|todas?|candidatos?)\b/, [
        "candidato apto para análise",
        "candidatos aptos para análise",
      ]),
    ]),
  }),
  Object.freeze({
    id: "recursos",
    fonte: "recursos",
    view: "recursos",
    pagina: "recursos",
    padrao: "total",
    modulo: /\b(recursos?|contestac\w*|impugnac\w*|parecer|juridico)\b/,
    metricas: Object.freeze([
      m(
        "aguardandoParecer",
        /\b(aguardando|esperando|no juridico|sem parecer|parecer)\b/,
        ["recurso aguardando parecer", "recursos aguardando parecer"],
      ),
      m("atrasados", /\b(vencid\w*|atrasad\w*|fora do prazo|prazo)\b/, [
        "recurso com prazo vencido",
        "recursos com prazo vencido",
      ]),
      m("indeferidos", /\bindeferid\w*\b/, [
        "recurso indeferido",
        "recursos indeferidos",
      ]),
      m("deferidos", /\bdeferid\w*\b/, [
        "recurso deferido",
        "recursos deferidos",
      ]),
      m("total", /\b(total|todos|registrad\w*)\b/, ["recurso", "recursos"]),
    ]),
  }),
  Object.freeze({
    id: "entrevistas",
    fonte: "entrevistas",
    view: "entrevistas",
    pagina: "entrevistas",
    padrao: "candidatos",
    modulo: /\b(entrevistas?|entrevistad\w*|banca|convocad\w*)\b/,
    metricas: Object.freeze([
      m(
        "semNota",
        /\bsem (nota|notas|resultado)\b|\bfalta\w* (nota|lancar)\b/,
        ["convocado sem nota", "convocados sem nota"],
      ),
      m("semEntrevista", /\bsem entrevista\b/, [
        "aprovado na análise sem entrevista",
        "aprovados na análise sem entrevista",
      ]),
      m("compareceram", /\b(compareceu|compareceram|presentes?)\b/, [
        "candidato que compareceu",
        "candidatos que compareceram",
      ]),
      m("inaptos", /\binapt\w*\b/, ["inapto", "inaptos"]),
      m("aptos", /\b(apt|aprovad)\w*\b/, [
        "apto na entrevista",
        "aptos na entrevista",
      ]),
      m("candidatos", /\b(entrevistad\w*|candidatos?|total)\b/, [
        "candidato entrevistado",
        "candidatos entrevistados",
      ]),
    ]),
  }),
  Object.freeze({
    id: "selecao",
    fonte: "selecao",
    view: "selecao",
    pagina: "selecao",
    padrao: "vagas",
    modulo: /\b(selecao|funil|auditoria)\b/,
    metricas: Object.freeze([
      m("taxa", /\btaxa\b|\bpercentual\b/, ["taxa de contratação"], {
        porcentagem: true,
      }),
      m("contratados", /\bcontratad\w*\b/, ["contratado", "contratados"]),
      m("inscritos", /\binscrit\w*\b/, ["inscrito", "inscritos"]),
      m("triados", /\btriad\w*\b/, ["triado", "triados"]),
      m("convocados", /\bconvocad\w*\b/, ["convocado", "convocados"]),
      m("aprovados", /\baprovad\w*\b/, ["aprovado", "aprovados"]),
      m("vagas", /\bvagas?\b/, ["vaga", "vagas"]),
    ]),
  }),
]);

/* "Quando foi a última carga da Seleção?" — por fonte de carga. */
const FONTES_DA_CARGA = Object.freeze([
  ["selecao", /\b(selecao|funil|auditoria)\b/, "Seleção", "selecao"],
  ["entrevistas", /\b(entrevistas?)\b/, "Entrevistas", "entrevistas"],
  [
    "analises",
    /\b(analises?|curricul\w*)\b/,
    "Análises curriculares",
    "analises",
  ],
]);

const GATILHO_DE_NUMERO =
  /\bqual (e )?(a|o) (taxa|numero|total|quantidade)\b|\b(quant[oa]s?|qtd|quantidade|numero|total|tem|ha|existe\w*|sobrou|sobram|faltam?|restam?)\b/;
const GATILHO_FORTE =
  /\b(quant[oa]s?|qtd|quantidade|numero|total)\b|\bqual (e )?(a|o) (taxa|numero|total|quantidade)\b/;
const GATILHO_DE_CARGA =
  /\b(ultima (carga|atualizacao|sincronizacao|conferencia)|quando (foi|e|sera|roda|rodou) (a )?(ultima )?(carga|atualizacao|sincronizacao)|atualizad[oa] (quando|ate)|conferid[oa] (as|quando)|quando (atualizou|foi atualizad[oa]|carregou))\b/;
const GATILHO_DE_ATRASO =
  /\b(cargas? (atrasad\w*|falh\w*|com problema)|alguma carga (atrasad\w*|falh\w*)|atualizac\w* (atrasad\w*|falh\w*)|status das atualizacoes)\b/;
const GATILHO_DE_CONFERENCIA = /\b(avisos? de conferencia|conferencias?)\b/;

/* A intenção pela palavra da métrica, quando o módulo não foi dito. */
const METRICA_QUE_DIZ_O_MODULO = Object.freeze([
  [
    "recursos",
    /\b(aguardando parecer|parecer|deferid\w*|indeferid\w*|prazo vencido)\b/,
  ],
  ["entrevistas", /\bsem nota\b|\bsem entrevista\b|\bcompareceram\b/],
  ["analises", /\bpendentes?\b|\bem revisao\b|\breprovad\w*\b/],
  ["selecao", /\b(inscrit\w*|contratad\w*|taxa de contratacao|triad\w*)\b/],
]);

/**
 * A intenção de dado da pergunta, ou `null`:
 * `{ id, tipo: "contagem" | "carga" | "atrasos" | "conferencia", fonte, view,
 *    pagina, metrica, entidades, cargaDe? }`.
 * `contexto`: `{ view, area, edital }` da tela aberta.
 */
export function reconhecerIntencao(pergunta, contexto = {}) {
  const texto = normalizar(pergunta);
  if (!texto) return null;
  const entidades = extrairEntidades(pergunta, contexto);

  if (
    GATILHO_DE_CONFERENCIA.test(texto) &&
    /\b(tem|ha|algum|existe|aviso)\b/.test(texto)
  )
    return { id: "conferencias", tipo: "conferencia", fonte: "", entidades };

  if (GATILHO_DE_ATRASO.test(texto))
    return {
      id: "cargas",
      tipo: "atrasos",
      fonte: "cargas",
      view: "config",
      secao: "cargas",
      entidades,
    };

  if (GATILHO_DE_CARGA.test(texto)) {
    const daPergunta = FONTES_DA_CARGA.find(([, padrao]) => padrao.test(texto));
    const daTela = FONTES_DA_CARGA.find(([id]) => id === contexto.view);
    const escolhida = daPergunta || daTela;
    if (!escolhida)
      return {
        id: "cargas",
        tipo: "atrasos",
        fonte: "cargas",
        view: "config",
        secao: "cargas",
        entidades,
      };
    const [cargaDe, , nome, view] = escolhida;
    return {
      id: "ultima-carga",
      tipo: "carga",
      fonte: "conferencia",
      cargaDe,
      nome,
      view,
      pagina: view,
      entidades,
    };
  }

  if (!GATILHO_DE_NUMERO.test(texto)) return null;
  // "Quantos DSEIs…" e "quantos filtros…" são da tela (contexto-da-aya.js).
  if (/\b(dseis?|filtros?|casais?|polos?)\b/.test(texto)) return null;

  const porModulo = INTENCOES.filter((i) => i.modulo.test(texto));
  const porMetrica = METRICA_QUE_DIZ_O_MODULO.filter(([, p]) =>
    p.test(texto),
  ).map(([id]) => INTENCOES.find((i) => i.id === id));
  const daTela = INTENCOES.find((i) => i.view === contexto.view);
  // O módulo dito vence; entre vários ("convocados sem nota na entrevista"),
  // o que a métrica confirma; sem módulo, a métrica; sem nada, a tela.
  const intencao =
    porModulo.find((i) => porMetrica.includes(i)) ||
    (porModulo.length === 1 ? porModulo[0] : null) ||
    porMetrica[0] ||
    (porModulo.length ? porModulo[0] : null) ||
    daTela ||
    null;
  if (!intencao) return null;
  const dita = intencao.metricas.find((item) => item.palavras.test(texto));
  // "Tem"/"há" sozinhos ("o que tem nesta tela?") só valem com a métrica dita.
  if (!dita && !GATILHO_FORTE.test(texto)) return null;
  if (
    /^(o que|como|por que|porque|onde|quem|para que|pra que)\b/.test(texto) &&
    !GATILHO_FORTE.test(texto)
  )
    return null;
  const metrica =
    dita || intencao.metricas.find((item) => item.id === intencao.padrao);
  return {
    id: intencao.id,
    tipo: "contagem",
    fonte: intencao.fonte,
    view: intencao.view,
    pagina: intencao.pagina,
    metrica,
    entidades,
  };
}

/* ---------- Resposta ---------- */

const inteiro = (valor) => Number(valor || 0).toLocaleString("pt-BR");

function dataHora(valor) {
  if (!valor) return "";
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function recorte({ edital, area }) {
  const partes = [];
  if (edital)
    partes.push(
      edital.includes("/") ? `no edital ${edital}` : `no edital nº ${edital}`,
    );
  if (area && NOMES_DAS_AREAS[area]) partes.push(`na ${NOMES_DAS_AREAS[area]}`);
  return partes.join(" ");
}

/**
 * O texto da resposta de uma intenção, a partir do `resultado` contado:
 * `{ valor, total?, em?, editalSemDados?, atrasadas?, falhas? }`.
 */
export function textoDaIntencao(intencao, resultado = {}) {
  const onde = recorte(intencao.entidades || {});
  const sufixo = onde ? ` ${onde}` : "";
  if (intencao.tipo === "carga") {
    const quando = dataHora(resultado.em);
    return quando
      ? `A última carga de ${intencao.nome}${sufixo ? sufixo.replace(/ no edital [^ ]+/, "") : ""} terminou bem em ${quando} (horário de Brasília).`
      : `Não achei carga concluída de ${intencao.nome} para o seu acesso.`;
  }
  if (intencao.tipo === "atrasos") {
    const atrasadas = resultado.atrasadas || [];
    if (!resultado.total) return "Não achei as cargas para mostrar agora.";
    if (!atrasadas.length)
      return `As ${inteiro(resultado.total)} atualizações de dados estão em dia.`;
    return `${atrasadas.length === 1 ? "1 atualização pede" : `${atrasadas.length} atualizações pedem`} atenção: ${atrasadas.join("; ")}.`;
  }
  if (intencao.editalSemDados || resultado.editalSemDados)
    return `Não achei o edital ${intencao.entidades.edital} nos dados de ${intencao.view === "analises" ? "Análises" : intencao.view === "selecao" ? "Seleção" : intencao.view === "recursos" ? "Recursos" : "Entrevistas"} do seu acesso${intencao.entidades.area ? ` ${recorte({ area: intencao.entidades.area })}` : ""}.`;
  const { metrica } = intencao;
  if (metrica.porcentagem)
    return `A ${metrica.rotulo[0]}${sufixo} é ${inteiro(resultado.valor)}%${resultado.contratados !== undefined ? ` (${inteiro(resultado.contratados)} contratados de ${inteiro(resultado.aprovados)} aprovados)` : ""}.`;
  const valor = Number(resultado.valor || 0);
  const rotulo = valor === 1 ? metrica.rotulo[0] : metrica.rotulo[1];
  const deTotal =
    resultado.total !== undefined && metrica.id !== "total"
      ? `, de ${inteiro(resultado.total)} no total`
      : "";
  const desativadas = Number(resultado.desativadas || 0);
  const nota =
    desativadas === 1
      ? " Uma delas saiu da planilha (desativada) e só aparece na tela com a situação Todos."
      : desativadas > 1
        ? ` ${inteiro(desativadas)} delas saíram da planilha (desativadas) e só aparecem na tela com a situação Todos.`
        : "";
  return `Há ${inteiro(valor)} ${rotulo}${sufixo}${deTotal}.${nota}`;
}

/** O botão "Abrir" da resposta: a tela e o filtro que ela aplica ao abrir. */
export function acaoDaIntencao(intencao) {
  if (!intencao?.view) return null;
  const filtro = {};
  if (intencao.entidades?.edital) filtro.edital = intencao.entidades.edital;
  if (intencao.metrica && intencao.metrica.id !== "total")
    filtro.metrica = intencao.metrica.id;
  return {
    view: intencao.view,
    ...(intencao.secao ? { secao: intencao.secao } : {}),
    filtro,
  };
}
