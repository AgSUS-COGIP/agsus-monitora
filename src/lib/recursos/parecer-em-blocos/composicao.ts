/* Parecer em blocos: composição do documento a partir do rascunho (API pública em ../parecer-em-blocos.ts). */

import {
  DOCUMENTOS_DA_ALDEIA,
  DOCUMENTOS_DO_QUILOMBOLA,
  ORDEM_DOS_CRITERIOS,
  TITULOS_POR_NIVEL,
  rotuloDoQuadro,
} from "./catalogos.ts";
import {
  REFERENCIAS_DO_EDITAL,
  etapaDoParecer,
} from "./etapas-e-referencias.ts";
import type { ReferenciasDoEdital } from "./etapas-e-referencias.ts";
import {
  dataDoParecer,
  pontosDoParecer,
  texto,
  totalSemSobreposicao,
} from "./meses-e-formatacao.ts";
import { TEXTOS_PADRAO } from "./modelo.ts";
import type { ChaveDoTexto, TextosDoModelo } from "./modelo.ts";
import { blocoDo, blocosDaEtapa } from "./rascunho.ts";
import type {
  BlocoDeExperiencia,
  BlocoDeFormacao,
  BlocoDoParecer,
  ExperienciaDoParecer,
  RascunhoDoParecer,
} from "./rascunho.ts";

// ── Composição do documento ──────────────────────────────────────────────

export interface Trecho {
  texto: string;
  negrito?: boolean;
}

export type LinhaDoDocumento =
  | { tipo: "titulo"; trechos: Trecho[] }
  | {
      tipo: "paragrafo";
      trechos: Trecho[];
      estilo?: "adicional" | "aviso" | "cabecalho";
    }
  | { tipo: "lista"; itens: Trecho[][] }
  | {
      tipo: "assinatura";
      linhas: { texto: string; estilo?: "nota" | "nome" | "destaque" }[];
    };

export interface DocumentoDoParecer {
  linhas: LinhaDoDocumento[];
}

type Valores = Record<string, string>;

/**
 * Um texto do modelo em trechos: separa o negrito (** **) ANTES de preencher,
 * para que um valor digitado com ** não vire negrito; marcador sem valor fica
 * como está.
 */
export function preencher(modelo: string, valores: Valores): Trecho[] {
  return modelo
    .split("**")
    .map((parte, indice) => ({
      texto: parte.replace(/\{([a-z0-9_]+)\}/g, (inteiro, nome: string) =>
        Object.prototype.hasOwnProperty.call(valores, nome)
          ? valores[nome]!
          : inteiro,
      ),
      ...(indice % 2 === 1 ? { negrito: true } : {}),
    }))
    .filter((t) => t.texto !== "");
}

const sim = (valor: string, padrao: string) => (valor.trim() ? valor : padrao);

/** Os marcadores comuns: as referências ({ref_…}) e o cabeçalho. */
function valoresBase(rascunho: RascunhoDoParecer): Valores {
  const c = rascunho.cabecalho;
  const refs = Object.fromEntries(
    Object.entries(rascunho.referencias).map(([k, v]) => [`ref_${k}`, v]),
  );
  return {
    ...refs,
    processo: sim(c.processo, "____"),
    edital: sim(c.edital, "____"),
    unidade: sim(c.unidade, "[Selecione o DSEI/CASAI]"),
    candidato: sim(c.candidato, "____"),
    codigo: sim(c.codigo, "____"),
    vaga: sim(c.vaga, "[Selecione a Vaga]"),
    titulo_etapa: etapaDoParecer(rascunho.etapa).titulo,
  };
}

/** Um texto do modelo já preenchido como texto puro (para os valores que entram em outro texto). */
const textoPuro = (modelo: string, valores: Valores) =>
  preencher(modelo, valores)
    .map((t) => t.texto)
    .join("");

function adicional(linhas: LinhaDoDocumento[], texto: string) {
  const limpo = texto.trim();
  if (limpo)
    linhas.push({
      tipo: "paragrafo",
      trechos: [{ texto: limpo }],
      estilo: "adicional",
    });
}

const paragrafo = (modelo: string, valores: Valores): LinhaDoDocumento => ({
  tipo: "paragrafo",
  trechos: preencher(modelo, valores),
});

function linhasDaFormacao(b: BlocoDeFormacao, t: TextosDoModelo, v: Valores) {
  const linhas: LinhaDoDocumento[] = [];
  if (b.situacao === "comprovada") {
    const escolhidos = (TITULOS_POR_NIVEL[b.nivel] ?? []).filter((x) =>
      b.titulos.includes(x.id),
    );
    const total = escolhidos.reduce((s, x) => s + x.pontos, 0);
    linhas.push(
      escolhidos.length
        ? paragrafo(t.formacao_comprovada, {
            ...v,
            titulos: escolhidos
              .map((x) => `${x.descricao} (${pontosDoParecer(x.pontos)} pt)`)
              .join("; "),
            pontos: pontosDoParecer(total),
          })
        : paragrafo(t.formacao_sem_titulo, v),
    );
  } else if (b.situacao === "nao_apresentada") {
    linhas.push(paragrafo(t.formacao_nao_apresentada, v));
  } else {
    const chave = `formacao_motivo_${b.motivo}` as ChaveDoTexto;
    linhas.push(
      paragrafo(t.formacao_invalidada, {
        ...v,
        motivo: textoPuro(t[chave] ?? "", v),
      }),
    );
  }
  adicional(linhas, b.adicional);
  return linhas;
}

function criterioPreenchido(
  codigo: string,
  e: ExperienciaDoParecer,
  t: TextosDoModelo,
  v: Valores,
): Trecho[] {
  const valores: Valores = { ...v };
  if (codigo === "out_1")
    valores.quadro = rotuloDoQuadro(e.quadro_relacao, rascunhoRefs(v));
  if (codigo === "out_2") {
    valores.quadro = rotuloDoQuadro(e.quadro_nivel, rascunhoRefs(v));
    valores.empresa = sim(e.empresa_nivel, "[empresa]");
    valores.cargo = sim(e.cargo_nivel, "[cargo]");
    valores.nivel = e.nivel_exigido;
  }
  if (codigo === "out_3")
    valores.experiencias = sim(e.experiencias_anteriores, "____");
  if (codigo === "out_5") valores.documento = e.documento_indigena;
  return preencher(t[`criterio_${codigo}` as ChaveDoTexto] ?? "", valores);
}

/** As referências de volta dos marcadores {ref_…}. */
function rascunhoRefs(v: Valores): ReferenciasDoEdital {
  return Object.fromEntries(
    REFERENCIAS_DO_EDITAL.map((r) => [
      r.chave,
      v[`ref_${r.chave}`] ?? r.padrao,
    ]),
  ) as ReferenciasDoEdital;
}

function linhasDaExperiencia(
  b: BlocoDeExperiencia,
  t: TextosDoModelo,
  v: Valores,
  pontosPorMes: number,
) {
  const linhas: LinhaDoDocumento[] = [];
  if (!b.itens.length) linhas.push(paragrafo(t.experiencia_nenhuma, v));
  const empresas: string[] = [];
  for (const e of b.itens) {
    const empresa = sim(e.empresa, "[empresa]");
    if (e.atende) {
      empresas.push(empresa);
      continue;
    }
    linhas.push(paragrafo(t.experiencia_nao_atende, { ...v, empresa }));
    const criterios = ORDEM_DOS_CRITERIOS.filter((c) =>
      e.criterios.includes(c),
    );
    if (criterios.length)
      linhas.push({
        tipo: "lista",
        itens: criterios.map((c) => criterioPreenchido(c, e, t, v)),
      });
  }
  if (empresas.length) {
    const total = totalSemSobreposicao(b.itens, pontosPorMes);
    linhas.push(
      paragrafo(t.experiencia_total, {
        ...v,
        empresas: empresas.join(", "),
        meses: String(total.meses),
        pontos: pontosDoParecer(total.pontos),
      }),
    );
  }
  adicional(linhas, b.adicional);
  return linhas;
}

function linhasDoBloco(
  bloco: BlocoDoParecer,
  t: TextosDoModelo,
  v: Valores,
  rascunho: RascunhoDoParecer,
): LinhaDoDocumento[] {
  switch (bloco.codigo) {
    case "requisitos":
      return [];
    case "formacao":
      return linhasDaFormacao(bloco, t, v);
    case "experiencia":
      return linhasDaExperiencia(bloco, t, v, rascunho.pontos_por_mes);
    case "pcd": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.marcado)
        linhas.push(
          paragrafo(t.pcd, {
            ...v,
            constatacao: textoPuro(
              t[`pcd_${bloco.opcao}` as ChaveDoTexto] ?? "",
              v,
            ),
          }),
        );
      adicional(linhas, bloco.adicional);
      return linhas;
    }
    case "indigena": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.sem_documento)
        linhas.push(paragrafo(t.indigena_sem_documento, v));
      if (bloco.no_recurso)
        linhas.push(
          paragrafo(t.indigena_no_recurso, {
            ...v,
            situacao: bloco.no_recurso_acatada
              ? "foi acatada e validada"
              : "não foi acatada",
            pontos: bloco.no_recurso_pontos,
            complemento:
              bloco.no_recurso_pontos === "0"
                ? t.indigena_no_recurso_zerado
                : t.indigena_no_recurso_com_pontos,
          }),
        );
      if (bloco.aldeia)
        linhas.push(
          paragrafo(t.indigena_aldeia, {
            ...v,
            documento: textoPuro(
              DOCUMENTOS_DA_ALDEIA[bloco.documento_aldeia] ?? "",
              v,
            ),
          }),
        );
      if (bloco.condisi)
        linhas.push(
          paragrafo(t.indigena_condisi, {
            ...v,
            razao: sim(bloco.razao_condisi, "____"),
          }),
        );
      adicional(linhas, bloco.adicional);
      return linhas;
    }
    case "quilombola": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.marcado) {
        linhas.push(
          paragrafo(t.quilombola, {
            ...v,
            documento: DOCUMENTOS_DO_QUILOMBOLA[bloco.documento] ?? "",
          }),
        );
        linhas.push({
          tipo: "paragrafo",
          trechos: preencher(`**${t.quilombola_aviso}**`, v),
          estilo: "aviso",
        });
      }
      adicional(linhas, bloco.adicional);
      return linhas;
    }
    case "heteroidentificacao": {
      const linhas: LinhaDoDocumento[] = [];
      if (bloco.marcado) {
        const docs = [
          bloco.autodeclaracao && "autodeclaração",
          bloco.foto && "foto",
          bloco.video && "vídeo",
        ].filter(Boolean) as string[];
        linhas.push(
          paragrafo(t.heteroidentificacao, {
            ...v,
            situacao: bloco.parcial
              ? "comprovou parcialmente"
              : "não comprovou",
            documentos: docs.length
              ? docs.join(", ")
              : t.heteroidentificacao_nenhum,
          }),
        );
      }
      adicional(linhas, bloco.adicional);
      return linhas;
    }
  }
}

function linhasDasAssinaturas(
  rascunho: RascunhoDoParecer,
  t: TextosDoModelo,
): LinhaDoDocumento[] {
  const linhas: LinhaDoDocumento[] = [
    {
      tipo: "assinatura",
      linhas: [{ texto: t.assinatura_comissao, estilo: "destaque" }],
    },
  ];
  for (const a of rascunho.assinaturas) {
    linhas.push({
      tipo: "assinatura",
      linhas: [
        ...(a.de_acordo
          ? [{ texto: t.assinatura_de_acordo, estilo: "destaque" as const }]
          : []),
        { texto: t.assinatura_eletronica, estilo: "nota" as const },
        { texto: a.nome, estilo: "nome" as const },
        { texto: a.cargo },
        ...a.lotacao.map((texto) => ({ texto })),
      ],
    });
  }
  return linhas;
}

/**
 * O documento do parecer, na ordem do simulador: cabeçalho, 1 Objeto,
 * 2 Relatório, 3 Admissibilidade, 4 Análise de mérito (só tempestivo),
 * 5 Conclusão e as assinaturas. Os blocos de mérito entram na ordem do
 * catálogo, só os que estão no rascunho.
 */
export function comporParecer(
  rascunho: RascunhoDoParecer,
  textos: TextosDoModelo = TEXTOS_PADRAO,
): DocumentoDoParecer {
  const t = textos;
  const v = valoresBase(rascunho);
  const a = rascunho.admissibilidade;
  const linhas: LinhaDoDocumento[] = [];
  const titulo = (modelo: string) =>
    linhas.push({ tipo: "titulo", trechos: preencher(modelo, v) });
  const p = (modelo: string, extra: Valores = {}) =>
    linhas.push(paragrafo(modelo, { ...v, ...extra }));

  for (const chave of [
    "cabecalho_processo",
    "cabecalho_certame",
    "cabecalho_candidato",
    "cabecalho_codigo",
    "cabecalho_vaga",
  ] as const)
    linhas.push({
      ...paragrafo(t[chave], v),
      estilo: "cabecalho",
    } as LinhaDoDocumento);

  titulo(t.titulo_objeto);
  p(t.objeto);
  titulo(t.titulo_relatorio);
  p(t.relatorio_pedido);
  p(t.relatorio_alegacoes, {
    alegacoes: sim(
      rascunho.alegacoes,
      "[inserir breve resumo das alegações do candidato]",
    ),
  });

  const tempestivo = a.tempestivo;
  titulo(t.titulo_admissibilidade);
  const valoresDaAdmissibilidade: Valores = {
    prazo_de: dataDoParecer(a.prazo_de),
    prazo_ate: dataDoParecer(a.prazo_ate),
    envio_data: dataDoParecer(a.envio_data),
    envio_hora: a.envio_hora || "--:--",
    tempestividade: tempestivo ? "tempestivamente" : "intempestivamente",
    atendimento: tempestivo && a.atende_periodo ? "atendendo" : "não atendendo",
    forma_admissao: a.admitido ? "foi admitido" : "não foi admitido",
    forma_atendimento: a.atende_forma ? "atender" : "não atender",
    fundamentacao: a.fundamentacao_adequada
      ? "foi admitido por apresentar fundamentação adequada"
      : "não foi admitido por ausência de fundamentação adequada",
  };
  const prazo = preencher(t.admissibilidade_prazo, {
    ...v,
    ...valoresDaAdmissibilidade,
  });
  linhas.push({
    tipo: "paragrafo",
    trechos: tempestivo
      ? [
          ...prazo,
          { texto: " " },
          ...preencher(t.admissibilidade_forma, {
            ...v,
            ...valoresDaAdmissibilidade,
          }),
        ]
      : prazo,
  });

  if (tempestivo) {
    titulo(t.titulo_merito);
    const requisitos = blocoDo(rascunho, "requisitos");
    const atendeu = requisitos?.atendeu !== false;
    if (atendeu) p(t.requisitos_atendeu);
    else {
      p(t.requisitos_nao_atendeu);
      const r = requisitos!;
      const itens: Trecho[][] = [];
      if (r.identificacao) itens.push(preencher(t.requisito_identificacao, v));
      if (r.identificacao_desacordo)
        itens.push(preencher(t.requisito_identificacao_desacordo, v));
      if (r.diploma) itens.push(preencher(t.requisito_diploma, v));
      if (r.experiencia_minima)
        itens.push(
          preencher(t.requisito_experiencia_minima, {
            ...v,
            tempo_minimo: r.tempo_minimo,
          }),
        );
      if (r.experiencia_documentacao)
        itens.push(
          preencher(t.requisito_experiencia_documentacao, {
            ...v,
            tempo_minimo: r.tempo_minimo_documentacao,
          }),
        );
      if (!itens.length) itens.push(preencher(t.requisitos_nenhum, v));
      linhas.push({ tipo: "lista", itens });
    }
    if (atendeu) {
      p(t.merito_introducao);
      for (const def of blocosDaEtapa(rascunho.etapa)) {
        const bloco = rascunho.blocos.find((b) => b.codigo === def.codigo);
        if (bloco) linhas.push(...linhasDoBloco(bloco, t, v, rascunho));
      }
    }
  }

  titulo(t.titulo_conclusao);
  if (!tempestivo) {
    p(t.conclusao_intempestiva);
    p(t.conclusao_intempestiva_resultado);
  } else {
    const c = rascunho.conclusao;
    p(t.conclusao_decisao, { decisao: c.decisao });
    const retificacao = c.retificar
      ? preencher(t.conclusao_retificacao, {
          ...v,
          nota_antiga: sim(c.nota_antiga, "____"),
          nota_nova: sim(c.nota_nova, "____"),
        })
      : [];
    const [antes, depois] = t.conclusao_resultado.split("{retificacao}");
    linhas.push({
      tipo: "paragrafo",
      trechos: [
        ...preencher(antes ?? "", {
          ...v,
          acao: c.retificar ? "retificar" : "manter",
        }),
        ...retificacao,
        ...preencher(depois ?? "", v),
      ],
    });
  }
  p(t.conclusao_final);
  linhas.push(...linhasDasAssinaturas(rascunho, t));
  return { linhas };
}

/** As linhas do documento como texto (uma por parágrafo, item de lista, título ou linha de assinatura). */
export function linhasDeTexto(documento: DocumentoDoParecer): string[] {
  const juntar = (trechos: Trecho[]) => trechos.map((t) => t.texto).join("");
  return documento.linhas.flatMap((l) => {
    if (l.tipo === "lista") return l.itens.map(juntar);
    if (l.tipo === "assinatura") return l.linhas.map((x) => x.texto);
    return [juntar(l.trechos)];
  });
}

/** O texto do parecer (o que vai para o "Parecer jurídico" e para o SEI). */
export function textoDoParecer(documento: DocumentoDoParecer): string {
  return linhasDeTexto(documento).join("\n");
}
