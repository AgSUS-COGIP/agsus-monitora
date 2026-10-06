/*
  A ficha da avaliação documental (fase F4): o que a tela precisa além da
  conta (pontuacao.js). Sem DOM e sem estado.

  - o que o candidato DECLAROU em cada bloco: as respostas da Empregare das
    perguntas ligadas ao bloco na regra (o formato real: aspas, múltipla
    escolha, "--", &nbsp;), pela mesma leitura da nota declarada
    (nota-declarada.js);
  - os pontos declarados por parcial (calcularNotaDeclarada com a regra);
  - o lançamento inicial (nível da vaga, modalidade, indígena e aldeia pelas
    respostas) e o que falta para concluir (pendências): situação de cada
    bloco, motivo do Não conforme/Não enviado, motivo do item recusado e
    JUSTIFICATIVA de toda nota diferente da declarada;
  - o resumo que vai para o banco (DS_RESULTADO) e o endereço da vaga na
    Empregare.

  O lançamento é o "candidato" de pontuacao.js, com:
    blocos[<CODIGO>] = { situacao, motivos[], motivo_livre, nota_ajustada,
                         justificativas[], justificativa_livre }
    titulos[] = { titulo, nome, aceito, motivo }
    cursos[]  = { nome, horas, aceito, motivo }
    vinculos[]= { empregador, categoria, inicio, fim, aceito, motivo }
  O banco revalida a estrutura (supabase/migrations/20261007130000_conteudo_da_ficha.sql)
  e o Python reconfere a conta (python/monitora/avaliacao_documental/pontuacao.py).
*/
import { nivelDaVaga } from "../classificacao/vagas.js";
import {
  PARCIAIS,
  PARCIAL_DO_TIPO,
  rotuloDe,
  TITULOS_ACADEMICOS,
} from "./catalogo.js";
import {
  calcularNotaDeclarada,
  chaveDaOpcao,
  colunasDaPergunta,
  comecoDoEnunciado,
  opcoesDaResposta,
  textoDaResposta,
} from "./nota-declarada.js";
import { calcularAvaliacao, tetoDoBloco } from "./pontuacao.js";
import { normalizarRegraAnalise } from "./regra.js";

const lista = (v) => (Array.isArray(v) ? v : []);
const objeto = (v) =>
  v !== null && typeof v === "object" && !Array.isArray(v) ? v : {};
const DIFERENCA = 1e-4;

/** Situações que o analista marca (atalhos 1, 2 e 3). */
export const SITUACOES_DA_FICHA = Object.freeze([
  ["CONFORME", "Conforme", "1"],
  ["NAO_CONFORME", "Não conforme", "2"],
  ["NAO_ENVIADO", "Não enviado", "3"],
]);

/** Situação pela tecla (1, 2, 3); null para as outras. */
export function situacaoDaTecla(tecla) {
  return SITUACOES_DA_FICHA.find(([, , t]) => t === tecla)?.[0] ?? null;
}

/** Tipos de bloco que lançam itens (mini formulário). */
export const BLOCOS_COM_ITENS = Object.freeze({
  TITULOS: "titulos",
  CURSOS: "cursos",
  VINCULOS: "vinculos",
});

/** Bloco que a ficha mostra: os que só registram não pedem situação. */
const pedeSituacao = (bloco) => bloco.tipo !== "REGISTRO";

/** O bloco vale para este candidato (condição de modalidade ou indígena)? */
export function blocoSeAplica(bloco, lancamento) {
  const condicao =
    bloco.condicao ?? (bloco.tipo === "PONTUACAO" ? "INDIGENA" : null);
  if (!condicao) return true;
  if (condicao === "INDIGENA") return Boolean(lancamento?.indigena);
  const [, modalidade] = String(condicao).split("=");
  return (
    String(lancamento?.modalidade ?? "").toUpperCase() ===
    String(modalidade ?? "").toUpperCase()
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
 * respostas. Só entra a parcial cuja pergunta foi achada nas respostas.
 */
export function declaradaDaFicha(regra, respostas) {
  const calc = calcularNotaDeclarada(regra, respostas ?? {});
  const parciais = {};
  for (const item of calc.itens)
    if (item.coluna)
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
 * confirma). Lançamento gravado vem por cima.
 */
export function lancamentoInicial({
  regra,
  respostas,
  modalidade,
  cargo,
  documental,
  gravado,
}) {
  const r = normalizarRegraAnalise(regra);
  const etnico = r.blocos.find((b) => b.tipo === "PONTUACAO");
  const linhas = etnico ? respostasDoBloco(etnico, respostas) : [];
  const base = {
    nivel: nivelDaFicha(cargo, documental),
    modalidade: modalidade || "AC",
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
  return Object.keys(g).length
    ? { ...base, ...g, blocos: objeto(g.blocos) }
    : base;
}

/** As justificativas que o bloco oferece: os motivos do bloco e as observações prontas. */
export function opcoesDeJustificativa(regra, bloco) {
  const r = normalizarRegraAnalise(regra);
  return [
    ...lista(bloco?.motivos).map((m) => ({
      codigo: m.codigo,
      texto: m.texto,
      grupo: "Motivos do bloco",
    })),
    ...r.observacoes_prontas
      .filter((o) => !lista(bloco?.motivos).some((m) => m.codigo === o.codigo))
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
  });
}

const temTexto = (v, min = 1) => String(v ?? "").trim().length >= min;

/** O bloco tem justificativa para a nota diferente da declarada? */
export function blocoJustificado(regra, bloco, lancado) {
  const l = objeto(lancado);
  if (lista(l.justificativas).length) return true;
  if (
    ["NAO_CONFORME", "NAO_ENVIADO"].includes(l.situacao) &&
    (lista(l.motivos).length || temTexto(l.motivo_livre, 10))
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

/** O analista já marcou a situação do bloco (Conforme, Não conforme, Não enviado)? */
export const blocoConferido = (lancamento, bloco) =>
  Boolean(objeto(objeto(lancamento?.blocos)[bloco?.codigo]).situacao);

/**
 * O que falta para concluir, bloco a bloco: [{ bloco, tipo, texto }]. Vazio =
 * pode concluir. O banco confere o mesmo em concluir_ficha. `tipo`: situacao,
 * motivo, item, datas, horas, justificativa ou nota. A nota diferente da
 * declarada só pede justificativa depois que o bloco foi conferido (antes, a
 * falta é a própria situação).
 */
export function pendenciasDaFicha(
  regraEntrada,
  lancamento,
  avaliacao,
  declarada,
) {
  const regra = normalizarRegraAnalise(regraEntrada);
  const pendencias = [];
  const blocos = objeto(lancamento?.blocos);
  for (const bloco of regra.blocos) {
    if (!pedeSituacao(bloco) || !blocoSeAplica(bloco, lancamento)) continue;
    const l = objeto(blocos[bloco.codigo]);
    const falta = (tipo, texto) =>
      pendencias.push({ bloco: bloco.codigo, tipo, texto });
    if (!l.situacao)
      falta("situacao", "Marque Conforme, Não conforme ou Não enviado.");
    if (
      ["NAO_CONFORME", "NAO_ENVIADO"].includes(l.situacao) &&
      !lista(l.motivos).length &&
      !(lista(bloco.motivos).length === 0 && temTexto(l.motivo_livre, 10))
    )
      falta(
        "motivo",
        lista(bloco.motivos).length
          ? "Escolha o motivo."
          : "Escreva o motivo (10 caracteres ou mais).",
      );
    const chave = BLOCOS_COM_ITENS[bloco.tipo];
    if (chave) {
      const itens = lista(lancamento?.[chave]);
      if (itens.some((i) => i && i.aceito === false && !i.motivo))
        falta("item", "Item recusado sem motivo.");
      if (chave === "vinculos" && itens.some((v) => v && !datasValidas(v)))
        falta("datas", "Vínculo com data de início ou fim inválida.");
      if (chave === "cursos" && itens.some((c) => c && !(Number(c.horas) > 0)))
        falta("horas", "Curso sem carga horária.");
    }
    if (
      l.situacao &&
      avaliacao?.resultado !== "INAPTO_REQUISITO" &&
      divergenciaDoBloco(bloco, avaliacao, declarada) &&
      !blocoJustificado(regra, bloco, l)
    )
      falta(
        "justificativa",
        "Nota diferente da declarada: escolha a justificativa.",
      );
    const ajuste = l.nota_ajustada;
    const teto = tetoDoBloco(bloco, lancamento?.nivel);
    if (
      typeof ajuste === "number" &&
      (ajuste < 0 || (teto !== null && ajuste > teto))
    )
      falta("nota", `Nota ajustada de 0 a ${teto}.`);
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
  const regra = normalizarRegraAnalise(regraEntrada);
  const itens = regra.blocos.filter(
    (b) => pedeSituacao(b) && blocoSeAplica(b, lancamento),
  );
  const conferido = (b) => blocoConferido(lancamento, b);
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
  const conferidos = itens.filter(conferido).length;
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
      conferidos: requisitos.filter(conferido).length,
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

/** "4 de 7 itens conferidos". */
export const textoDoProgresso = ({ conferidos, total }) =>
  `${conferidos} de ${total} ${total === 1 ? "item conferido" : "itens conferidos"}`;

/** O resumo da conta que vai para o banco (TB_FICHA_ANALISE."DS_RESULTADO"). */
export function resumoParaGravar(avaliacao, declarada) {
  const exp = avaliacao.experiencia;
  return {
    resultado: avaliacao.resultado,
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
  Vagas Anunciadas da Empregare. As candidaturas da vaga só abrem pelo
  identificador interno dela (".../candidaturas/<id>|"), que o robô ainda não
  guarda (F7); a URL com o código numérico dá "Sem permissão" e a busca na URL
  é descartada pelo redirecionamento da Empregare. Por isso a ficha abre a
  lista de vagas e copia o código da vaga para colar na busca.
*/
export function enderecoDaVagaNaEmpregare(codigoDaVaga) {
  const codigo = String(codigoDaVaga ?? "").trim();
  return /^\d{1,20}$/.test(codigo)
    ? "https://corporate.empregare.com/empresa/vagas"
    : null;
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
});

/** Uma alteração do histórico em texto ("Experiência: 25 → 20 (justificativa)"). */
export function textoDaAlteracao(alt) {
  const a = objeto(alt);
  const de = a.de === null || a.de === undefined ? "—" : String(a.de);
  const para = a.para === null || a.para === undefined ? "—" : String(a.para);
  return `${a.rotulo || a.campo || ""}: ${de} → ${para}`;
}
