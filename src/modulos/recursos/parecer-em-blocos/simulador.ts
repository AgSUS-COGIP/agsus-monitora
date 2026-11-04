import {
  CORRECOES_DO_SIMULADOR,
  DOCUMENTOS_DO_QUILOMBOLA,
  MOTIVOS_DA_FORMACAO,
  OPCOES_DO_PCD,
  rotuloDoQuadro,
  type RascunhoDoParecer,
} from "../../../lib/parecer-em-blocos.ts";

/*
  Ponte com o simulador original (o HTML da equipe, fora do repositório),
  só para a comparação do protótipo e o teste de paridade: preenche os campos
  do simulador com um rascunho do MONITORA, chamando as funções dele como o
  clique faria, e lê o texto visível da prévia dele, uma linha por parágrafo,
  item de lista ou título — o mesmo formato de linhasDeTexto.
*/

type JanelaDoSimulador = Window & {
  updatePreview(): void;
  handleTempestividade(): void;
  toggleRequisitosEliminatorios(): void;
  toggleAcaoResultado(): void;
  renderFacCheckboxes(): void;
  toggleFacOptions(): void;
  addExperienciaBlock(): void;
  removeExperienciaBlock(id: number): void;
  calcularExperienciasEGlobal(): unknown;
};

const BLOCOS_DO_SIMULADOR: Record<string, string> = {
  formacao: "block_formacao_academica",
  experiencia: "block_experiencia_profissional",
  pcd: "block_laudo_pcd",
  indigena: "block_etnico_indigena",
  quilombola: "block_etnico_quilombola",
  heteroidentificacao: "block_heteroidentificacao",
};

/** Preenche o simulador (já carregado) com o rascunho e atualiza a prévia dele. */
export function preencherOSimulador(
  janela: Window,
  rascunho: RascunhoDoParecer,
) {
  const w = janela as JanelaDoSimulador;
  const doc = w.document;
  const el = <T extends HTMLElement = HTMLInputElement>(id: string) => {
    const achado = doc.getElementById(id);
    if (!achado) throw new Error(`Campo do simulador não encontrado: ${id}`);
    return achado as unknown as T;
  };
  const valor = (id: string, v: string) => {
    const campo = el<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(id);
    if (
      campo.tagName === "SELECT" &&
      ![...(campo as HTMLSelectElement).options].some((o) => o.value === v)
    ) {
      // Unidade ou vaga fora da lista do simulador: entra como opção nova.
      const opcao = doc.createElement("option");
      opcao.value = v;
      opcao.textContent = v;
      campo.append(opcao);
    }
    campo.value = v;
  };
  const marcado = (id: string, v: boolean) => (el(id).checked = v);
  const indice = (id: string, i: number) =>
    (el<HTMLSelectElement>(id).selectedIndex = i);

  const c = rascunho.cabecalho;
  valor("in_processo", c.processo);
  valor("in_edital", c.edital);
  if (c.unidade) valor("in_dsei", c.unidade);
  valor("in_candidato", c.candidato);
  valor("in_codigo", c.codigo);
  if (c.vaga) valor("in_vaga", c.vaga);
  valor("in_razoes_recursais", rascunho.alegacoes);

  const a = rascunho.admissibilidade;
  valor("in_prazo_de", a.prazo_de);
  valor("in_prazo_ate", a.prazo_ate);
  valor("in_envio_data", a.envio_data);
  valor("in_envio_hora", a.envio_hora);
  valor(
    "in_tempestividade",
    a.tempestivo ? "tempestivamente" : "intempestivamente",
  );
  w.handleTempestividade();
  if (a.tempestivo)
    valor(
      "in_atendimento_periodo",
      a.atende_periodo ? "atendendo" : "não atendendo",
    );
  valor("in_forma_admissao", a.admitido ? "foi admitido" : "não foi admitido");
  valor("in_forma_atendimento", a.atende_forma ? "atender" : "não atender");
  indice("in_fundamentacao_preliminar", a.fundamentacao_adequada ? 0 : 1);

  for (const [codigo, id] of Object.entries(BLOCOS_DO_SIMULADOR))
    if (!rascunho.blocos.some((b) => b.codigo === codigo))
      doc.getElementById(id)?.remove();

  for (const b of rascunho.blocos) {
    if (b.codigo === "requisitos") {
      valor("in_status_eliminatorio", b.atendeu ? "atendeu" : "nao_atendeu");
      marcado("chk_elim_1", b.identificacao);
      marcado("chk_elim_2", b.identificacao_desacordo);
      marcado("chk_elim_3", b.diploma);
      marcado("chk_elim_4", b.experiencia_minima);
      marcado("chk_elim_5", b.experiencia_documentacao);
      valor("sel_tempo_min_1", b.tempo_minimo);
      valor("sel_tempo_min_2", b.tempo_minimo_documentacao);
      w.toggleRequisitosEliminatorios();
    } else if (b.codigo === "formacao") {
      valor("sel_fac_situacao", b.situacao);
      valor("sel_fac_nivel_vaga", b.nivel);
      w.renderFacCheckboxes();
      // Título de outro nível não aparece no simulador (nem conta no texto).
      for (const id of b.titulos) if (doc.getElementById(id)) marcado(id, true);
      indice(
        "sel_fac_motivo",
        MOTIVOS_DA_FORMACAO.findIndex(([m]) => m === b.motivo),
      );
      valor("in_parecer_fac", b.adicional);
      w.toggleFacOptions();
    } else if (b.codigo === "experiencia") {
      // O simulador abre com a experiência nº 1; as outras entram pelo botão.
      if (!b.itens.length) w.removeExperienciaBlock(1);
      b.itens.forEach((e, i) => {
        const n = i + 1;
        if (n > 1) w.addExperienciaBlock();
        valor(`in_exp_resultado_${n}`, e.atende ? "Atende" : "Não Atende");
        valor(`in_exp_empresa_${n}`, e.empresa);
        valor(`in_exp_dt_inicio_${n}`, e.inicio);
        valor(`in_exp_dt_saida_${n}`, e.fim);
        for (const criterio of e.criterios)
          marcado(`chk_${criterio}_${n}`, true);
        valor(
          `sel_out_1_quadro_${n}`,
          rotuloDoQuadro(e.quadro_relacao, rascunho.referencias),
        );
        valor(
          `sel_out_2_quadro_${n}`,
          rotuloDoQuadro(e.quadro_nivel, rascunho.referencias),
        );
        valor(`in_out_2_emp_${n}`, e.empresa_nivel);
        valor(`in_out_2_cargo_${n}`, e.cargo_nivel);
        valor(`sel_out_2_nivel_${n}`, e.nivel_exigido);
        valor(`in_out_3_exp_${n}`, e.experiencias_anteriores);
        valor(`sel_out_5_doc_${n}`, e.documento_indigena);
      });
      valor("in_parecer_exp", b.adicional);
      w.calcularExperienciasEGlobal();
    } else if (b.codigo === "pcd") {
      marcado("chk_pcd", b.marcado);
      indice(
        "sel_doc_pcd",
        OPCOES_DO_PCD.findIndex(([o]) => o === b.opcao),
      );
      valor("in_parecer_pcd", b.adicional);
    } else if (b.codigo === "indigena") {
      marcado("chk_etnico_h", b.sem_documento);
      marcado("chk_etnico_651", b.no_recurso);
      valor(
        "sel_etnico_651_status",
        b.no_recurso_acatada ? "foi acatada e validada" : "não foi acatada",
      );
      valor("sel_etnico_651_pontos", b.no_recurso_pontos);
      marcado("chk_residencia_i", b.aldeia);
      indice("sel_doc_residencia", b.documento_aldeia);
      marcado("chk_condisi", b.condisi);
      valor("in_razao_condisi", b.razao_condisi);
      valor("in_parecer_etnico", b.adicional);
    } else if (b.codigo === "quilombola") {
      marcado("chk_quilombola", b.marcado);
      indice(
        "sel_doc_quilombola",
        Math.min(b.documento, DOCUMENTOS_DO_QUILOMBOLA.length - 1),
      );
      valor("in_parecer_quilombola", b.adicional);
    } else if (b.codigo === "heteroidentificacao") {
      marcado("chk_hetero", b.marcado);
      valor(
        "sel_hetero_status",
        b.parcial ? "comprovou parcialmente" : "não comprovou",
      );
      marcado("chk_het_doc_auto", b.autodeclaracao);
      marcado("chk_het_doc_foto", b.foto);
      marcado("chk_het_doc_video", b.video);
      valor("in_parecer_hetero", b.adicional);
    }
  }

  if (a.tempestivo) {
    valor("in_decisao", rascunho.conclusao.decisao);
    valor(
      "in_acao_resultado",
      rascunho.conclusao.retificar ? "retificar" : "manter",
    );
    w.toggleAcaoResultado();
    valor("in_nota_antiga", rascunho.conclusao.nota_antiga);
    valor("in_nota_nova", rascunho.conclusao.nota_nova);
  }
  const [g1, g2] = rascunho.assinaturas;
  if (g1) {
    valor("in_gestor1_nome", g1.nome);
    valor("in_gestor1_cargo", g1.cargo);
  }
  if (g2) {
    valor("in_gestor2_nome", g2.nome);
    valor("in_gestor2_cargo", g2.cargo);
  }
  w.updatePreview();
}

/* O texto visível de um nó: o que está com display:none não conta. */
function textoVisivel(no: Node): string {
  if (no.nodeType === 3) return (no as Text).data;
  if (no.nodeType !== 1) return "";
  if ((no as HTMLElement).style?.display === "none") return "";
  return [...no.childNodes].map(textoVisivel).join("");
}

function visivel(elemento: Element) {
  for (let e: Element | null = elemento; e; e = e.parentElement)
    if (
      (e as HTMLElement).style?.display === "none" ||
      e.hasAttribute("hidden")
    )
      return false;
  return true;
}

/**
 * As linhas visíveis de um documento de parecer: parágrafos, itens de lista e
 * títulos, com os espaços normalizados. `corrigir` aplica CORRECOES_DO_SIMULADOR.
 */
export function linhasVisiveis(
  raiz: ParentNode,
  { seletor = "p, li, .section-title, h3", corrigir = false } = {},
): string[] {
  return [...raiz.querySelectorAll(seletor)]
    .filter(visivel)
    .map((el) => {
      let linha = textoVisivel(el).replace(/\s+/g, " ").trim();
      if (corrigir)
        for (const [de, para] of CORRECOES_DO_SIMULADOR)
          linha = linha.split(de).join(para);
      return linha;
    })
    .filter(Boolean);
}
