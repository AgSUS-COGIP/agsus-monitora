/*
  Avisos de conferência, sem React e sem banco: o que chega de
  `listar_avisos_conferencia` (20261005210000_conferencias_de_consistencia.sql)
  vira a lista da tela — título de cada conferência, tom da gravidade, onde
  (edital, área ou vaga), contagem do selo de cada módulo e a validação do
  motivo ao ignorar.

  Os avisos são gravados pelo job Python scripts/conferencias/ (todo dia às 6h
  e pelo "Rodar agora"). O catálogo (código → módulo, gravidade, título) é o
  mesmo do job: tests/fixtures/conferencias/catalogo.json é o caso dourado que
  o vitest e o pytest conferem.
*/

export const CONFERENCIAS = Object.freeze({
  ANALISE_APROVADA_ABAIXO_DO_CORTE: Object.freeze({
    modulo: "analises",
    gravidade: "CRITICA",
    titulo: "Aprovada com nota abaixo da mínima",
  }),
  ANALISE_NOTA_DIFERENTE_DA_SOMA: Object.freeze({
    modulo: "analises",
    gravidade: "ATENCAO",
    titulo: "Nota final diferente da soma das parciais",
  }),
  ANALISE_EXPERIENCIA_ACIMA_DO_TETO: Object.freeze({
    modulo: "analises",
    gravidade: "ATENCAO",
    titulo: "Experiência acima do teto da regra",
  }),
  ANALISE_DATA_INVALIDA: Object.freeze({
    modulo: "analises",
    gravidade: "ATENCAO",
    titulo: "Data da análise no futuro ou antes da inscrição",
  }),
  ANALISE_EM_DOIS_EDITAIS: Object.freeze({
    modulo: "analises",
    gravidade: "INFORMATIVO",
    titulo: "Candidato analisado em dois editais ativos",
  }),
  ENTREVISTA_SEM_NOTA_APOS_DATA: Object.freeze({
    modulo: "entrevistas",
    gravidade: "ATENCAO",
    titulo: "Convocado sem nota depois da data da entrevista",
  }),
  ENTREVISTA_NOTA_FORA_DA_ESCALA: Object.freeze({
    modulo: "entrevistas",
    gravidade: "CRITICA",
    titulo: "Nota fora da escala do roteiro",
  }),
  ENTREVISTA_FORA_DA_CONVOCACAO: Object.freeze({
    modulo: "entrevistas",
    gravidade: "CRITICA",
    titulo: "Convocado fora da lista de convocação vigente",
  }),
  ENTREVISTA_HORARIO_DUPLICADO: Object.freeze({
    modulo: "entrevistas",
    gravidade: "ATENCAO",
    titulo: "Dois horários para o mesmo candidato",
  }),
  CLASSIFICACAO_LISTA_FINAL_DESATUALIZADA: Object.freeze({
    modulo: "classificacao",
    gravidade: "CRITICA",
    titulo: "Lista final gerada antes da última mudança nas análises",
  }),
  CLASSIFICACAO_EMPATE_PENDENTE: Object.freeze({
    modulo: "classificacao",
    gravidade: "ATENCAO",
    titulo: "Empate sem desempate registrado",
  }),
  CLASSIFICACAO_VAGA_SEM_QUADRO: Object.freeze({
    modulo: "classificacao",
    gravidade: "ATENCAO",
    titulo: "Vaga sem linha no quadro de vagas",
  }),
  CLASSIFICACAO_AJUSTE_APOS_LISTA: Object.freeze({
    modulo: "classificacao",
    gravidade: "ATENCAO",
    titulo: "Ajuste de recurso aprovado depois da última lista",
  }),
  APROVADOS_CONTRATADO_DUPLICADO: Object.freeze({
    modulo: "aprovados",
    gravidade: "CRITICA",
    titulo: "Contratado em duas vagas",
  }),
  APROVADOS_CONVOCADO_SEM_DESFECHO: Object.freeze({
    modulo: "aprovados",
    gravidade: "ATENCAO",
    titulo: "Convocado há muitos dias sem desfecho",
  }),
  APROVADOS_PENDENCIA_DA_PUBLICACAO: Object.freeze({
    modulo: "aprovados",
    gravidade: "ATENCAO",
    titulo: "Pendência da publicação sem revisão",
  }),
  CARGA_VARIACAO_BRUSCA: Object.freeze({
    modulo: "cargas",
    gravidade: "ATENCAO",
    titulo: "Variação brusca de candidatos na Empregare",
  }),
});

export const MODULOS_DOS_AVISOS = Object.freeze([
  Object.freeze({ valor: "analises", rotulo: "Análises" }),
  Object.freeze({ valor: "entrevistas", rotulo: "Entrevistas" }),
  Object.freeze({ valor: "classificacao", rotulo: "Classificação" }),
  Object.freeze({ valor: "aprovados", rotulo: "Aprovados" }),
  Object.freeze({ valor: "cargas", rotulo: "Cargas" }),
]);

export const GRAVIDADES = Object.freeze({
  CRITICA: Object.freeze({ rotulo: "Crítico", tom: "perigo", ordem: 0 }),
  ATENCAO: Object.freeze({ rotulo: "Atenção", tom: "aviso", ordem: 1 }),
  INFORMATIVO: Object.freeze({ rotulo: "Informativo", tom: "info", ordem: 2 }),
});

export const LIMITES_DO_MOTIVO = Object.freeze({ minimo: 10, maximo: 500 });

const NOMES_DAS_AREAS = Object.freeze({
  "saude-indigena": "Saúde Indígena",
  sede: "SEDE",
  projetos: "Projetos",
});

const texto = (valor) => String(valor ?? "").trim();

const data = (valor) => {
  if (!valor) return null;
  const d = new Date(valor);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Título da conferência (o código, se for uma que a tela ainda não conhece). */
export const tituloDaConferencia = (codigo) =>
  CONFERENCIAS[codigo]?.titulo || texto(codigo);

/** "Edital 101/2026", "Saúde Indígena" ou "Vaga 177979". */
export function ondeDoAviso(aviso) {
  const [tipo, ...resto] = texto(aviso?.escopo).split(":");
  const id = resto.join(":");
  if (tipo === "edital")
    return aviso?.edital ? `Edital ${texto(aviso.edital)}` : "Edital";
  if (tipo === "vaga") return `Vaga ${id}`;
  return NOMES_DAS_AREAS[aviso?.area] || NOMES_DAS_AREAS[id] || "Sem área";
}

function normalizarAviso(bruto) {
  const gravidade = GRAVIDADES[bruto?.gravidade] ? bruto.gravidade : "ATENCAO";
  return {
    id: texto(bruto?.id),
    conferencia: texto(bruto?.conferencia),
    titulo: tituloDaConferencia(bruto?.conferencia),
    escopo: texto(bruto?.escopo),
    gravidade,
    tom: GRAVIDADES[gravidade].tom,
    rotuloDaGravidade: GRAVIDADES[gravidade].rotulo,
    modulo: texto(bruto?.modulo),
    area: texto(bruto?.area) || null,
    editalId: texto(bruto?.edital_id) || null,
    edital: texto(bruto?.edital) || null,
    onde: ondeDoAviso(bruto),
    quantidade: Math.max(0, Math.round(Number(bruto?.quantidade) || 0)),
    exemplos: (Array.isArray(bruto?.exemplos) ? bruto.exemplos : [])
      .map(texto)
      .filter(Boolean),
    resumo: texto(bruto?.resumo),
    situacao: bruto?.situacao === "IGNORADO" ? "IGNORADO" : "ABERTO",
    primeiraVez: data(bruto?.primeira_vez),
    ultimaVez: data(bruto?.ultima_vez),
    ignoradoEm: data(bruto?.ignorado_em),
    motivo: texto(bruto?.motivo) || null,
    podeIgnorar: bruto?.pode_ignorar === true,
  };
}

/** O payload de `listar_avisos_conferencia` em abertos (por gravidade) e ignorados. */
export function normalizarAvisos(dados) {
  const avisos = (Array.isArray(dados?.avisos) ? dados.avisos : []).map(
    normalizarAviso,
  );
  const porGravidade = (a, b) =>
    GRAVIDADES[a.gravidade].ordem - GRAVIDADES[b.gravidade].ordem ||
    (a.primeiraVez?.getTime() ?? 0) - (b.primeiraVez?.getTime() ?? 0);
  const ultima = dados?.ultima_execucao;
  return {
    geradoEm: data(dados?.gerado_em),
    ultimaExecucao: ultima
      ? {
          inicio: data(ultima.inicio),
          fim: data(ultima.fim),
          situacao: texto(ultima.situacao),
        }
      : null,
    abertos: avisos.filter((a) => a.situacao === "ABERTO").sort(porGravidade),
    ignorados: avisos.filter((a) => a.situacao === "IGNORADO"),
  };
}

/** Avisos abertos por módulo (o selo de cada tela). */
export function contagemPorModulo(lista) {
  const contagem = Object.fromEntries(
    MODULOS_DOS_AVISOS.map((m) => [m.valor, 0]),
  );
  for (const aviso of lista?.abertos || [])
    if (aviso.modulo in contagem) contagem[aviso.modulo] += 1;
  return contagem;
}

/** Só os avisos de um módulo ("todos" = todos). */
export function filtrarPorModulo(lista, modulo) {
  if (!lista) return lista;
  if (!modulo || modulo === "todos") return lista;
  return {
    ...lista,
    abertos: lista.abertos.filter((a) => a.modulo === modulo),
    ignorados: lista.ignorados.filter((a) => a.modulo === modulo),
  };
}

/** Tom do selo de um módulo: o do aviso mais grave aberto. */
export function tomDoSelo(abertos) {
  const mais = [...(abertos || [])].sort(
    (a, b) => GRAVIDADES[a.gravidade].ordem - GRAVIDADES[b.gravidade].ordem,
  )[0];
  return mais ? mais.tom : null;
}

/** Erro do motivo ao ignorar, ou "" quando está bom. */
export function erroDoMotivo(motivo) {
  const t = texto(motivo);
  if (t.length < LIMITES_DO_MOTIVO.minimo)
    return `Escreva o motivo (pelo menos ${LIMITES_DO_MOTIVO.minimo} caracteres).`;
  if (t.length > LIMITES_DO_MOTIVO.maximo)
    return `O motivo passa de ${LIMITES_DO_MOTIVO.maximo} caracteres.`;
  return "";
}

/** "dd/mm/aaaa"; "—" sem data. */
export function diaDoAviso(valor) {
  if (!(valor instanceof Date)) return "—";
  const dois = (n) => String(n).padStart(2, "0");
  return `${dois(valor.getDate())}/${dois(valor.getMonth() + 1)}/${valor.getFullYear()}`;
}
