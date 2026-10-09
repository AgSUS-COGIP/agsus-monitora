import type {
  DadosDoRecurso,
  IdentificadorDoRecurso,
  EtapaDoCronogramaDoRecurso,
} from "./tipos-dos-recursos.ts";
import type {
  DadosDosRecursos,
  DetalheDoRecurso,
  CandidatoDoRecurso,
  RegistroDosRecursos,
} from "../modulos/recursos/tipos-do-estado.ts";
import type {
  ModeloDaResposta,
  RespostaDoRecurso,
  DadosDosModelos,
} from "./tipos-da-resposta-do-recurso.ts";
export const objetoDosRecursos = (valor: unknown): RegistroDosRecursos =>
  valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as RegistroDosRecursos)
    : {};
const registros = (valor: unknown): RegistroDosRecursos[] =>
  Array.isArray(valor)
    ? valor.filter(
        (v): v is RegistroDosRecursos =>
          v !== null && typeof v === "object" && !Array.isArray(v),
      )
    : [];
const texto = (valor: unknown) => (typeof valor === "string" ? valor : "");
export const idDosRecursos = (valor: unknown): IdentificadorDoRecurso | null =>
  (typeof valor === "string" && valor.length > 0) ||
  (typeof valor === "number" && Number.isFinite(valor))
    ? valor
    : null;
const escalar = (valor: unknown) =>
  typeof valor === "string" ||
  (typeof valor === "number" && Number.isFinite(valor))
    ? valor
    : null;
const numero = (valor: unknown) =>
  typeof valor === "number" && Number.isFinite(valor) ? valor : undefined;

function recursoDoBanco(r: RegistroDosRecursos): DadosDoRecurso | null {
  const id = idDosRecursos(r.id);
  if (id === null) return null;
  return {
    ...r,
    id,
    nu: numero(r.nu),
    edital_id: idDosRecursos(r.edital_id),
    analise_id: idDosRecursos(r.analise_id),
    edital: texto(r.edital),
    unidade: texto(r.unidade),
    origem: texto(r.origem),
    candidato: texto(r.candidato),
    codigo: escalar(r.codigo),
    cargo: texto(r.cargo),
    vaga: texto(r.vaga),
    analista: texto(r.analista),
    situacao: texto(r.situacao),
    processo_sei: texto(r.processo_sei),
    fora_analise: r.fora_analise === true,
    mudou_classificacao: r.mudou_classificacao === true,
    nota_anterior: escalar(r.nota_anterior),
    nota_atual: escalar(r.nota_atual),
    resultado_atual: texto(r.resultado_atual),
    resultado_anterior: texto(r.resultado_anterior),
    parecer_enviado_em: texto(r.parecer_enviado_em) || null,
    criado_em: texto(r.criado_em),
    decisao_em: texto(r.decisao_em) || null,
    devolvido_em: texto(r.devolvido_em) || null,
    download_empregare_em: texto(r.download_empregare_em) || null,
    processo_sei_em: texto(r.processo_sei_em) || null,
    upload_sei_em: texto(r.upload_sei_em) || null,
    resposta_candidato_em: texto(r.resposta_candidato_em) || null,
    resposta_estado: texto(r.resposta_estado) || null,
    qt_anexos: escalar(r.qt_anexos),
    revisao: numero(r.revisao),
  };
}
export function normalizarDadosDosRecursos(valor: unknown): DadosDosRecursos {
  const d = objetoDosRecursos(valor);
  const cronogramas: EtapaDoCronogramaDoRecurso[] = registros(
    d.cronogramas,
  ).map((r) => ({
    ...r,
    edital_id: idDosRecursos(r.edital_id),
    ordem: escalar(r.ordem),
    atividade: texto(r.atividade),
    inicio: texto(r.inicio),
    fim: texto(r.fim),
  }));
  return {
    ...d,
    modelos: normalizarModelosDaResposta(d.modelos),
    recursos: registros(d.recursos)
      .map(recursoDoBanco)
      .filter((r): r is DadosDoRecurso => r !== null),
    cronogramas,
    origens: registros(d.origens)
      .filter((r) => typeof r.id === "string")
      .map((r) => ({
        ...r,
        id: texto(r.id),
        rotulo: texto(r.rotulo),
        ativo: r.ativo === true,
      })),
    editais: registros(d.editais).flatMap((r) => {
      const id = idDosRecursos(r.id);
      return id === null
        ? []
        : [
            {
              ...r,
              id,
              edital: texto(r.edital),
              unidade: texto(r.unidade),
              tem_analises: r.tem_analises === true,
            },
          ];
    }),
    pode_editar: d.pode_editar === true,
    pode_decidir: d.pode_decidir === true,
    pode_administrar_modelos: d.pode_administrar_modelos === true,
  };
}
export function normalizarDetalheDoRecurso(valor: unknown): DetalheDoRecurso {
  const d = objetoDosRecursos(valor);
  const resposta = normalizarRespostaDoRecurso(d.resposta);
  const etapas = objetoDosRecursos(d.etapas);
  return {
    ...d,
    modalidade: texto(d.modalidade),
    responsavel_analise: texto(d.responsavel_analise),
    criado_por: texto(d.criado_por),
    parecer_enviado_por: texto(d.parecer_enviado_por),
    decisao_por: texto(d.decisao_por),
    devolvido_por: texto(d.devolvido_por),
    comentario_devolucao: texto(d.comentario_devolucao),
    parecer: texto(d.parecer),
    etapas: {
      download_empregare: texto(etapas.download_empregare),
      processo_sei: texto(etapas.processo_sei),
      upload_sei: texto(etapas.upload_sei),
      resposta_candidato: texto(etapas.resposta_candidato),
    },
    historico: registros(d.historico).map((h) => ({
      acao: texto(h.acao),
      campo: texto(h.campo),
      anterior: escalar(h.anterior) === null ? null : String(h.anterior),
      novo: escalar(h.novo) === null ? null : String(h.novo),
      motivo: texto(h.motivo),
      em: texto(h.em),
      autor: texto(h.autor),
    })),
    anexos: registros(d.anexos).flatMap((a) => {
      const id = idDosRecursos(a.id);
      return id === null
        ? []
        : [
            {
              ...a,
              id,
              nome: texto(a.nome),
              tipo: texto(a.tipo),
              mime: texto(a.mime),
              bytes: numero(a.bytes) ?? 0,
              ativo: a.ativo === true,
              incluido_em: texto(a.incluido_em),
              incluido_por: texto(a.incluido_por),
              arquivado_em: texto(a.arquivado_em),
              arquivado_por: texto(a.arquivado_por),
              motivo_arquivamento: texto(a.motivo_arquivamento),
            },
          ];
    }),
    resposta,
    eu: idDosRecursos(d.eu),
    erro:
      texto(d.erro) ||
      (d.resposta != null && resposta === null
        ? "A resposta recebida é inválida. Recarregue o recurso."
        : undefined),
    observacao: texto(d.observacao),
    nome_informado:
      typeof d.nome_informado === "string" ? d.nome_informado : undefined,
    codigo_informado: escalar(d.codigo_informado) ?? undefined,
    cargo_informado:
      typeof d.cargo_informado === "string" ? d.cargo_informado : undefined,
    vaga_informada:
      typeof d.vaga_informada === "string" ? d.vaga_informada : undefined,
  };
}

/** Modelos com escopo inválido são ignorados para não virar modelos de todas as áreas. */
export function normalizarModelosDaResposta(
  valor: unknown,
): ModeloDaResposta[] {
  return registros(valor).flatMap((m) => {
    const id = idDosRecursos(m.id),
      versao = numero(m.versao);
    if (
      id === null ||
      versao === undefined ||
      !Number.isInteger(versao) ||
      versao < 1 ||
      (m.area != null && typeof m.area !== "string") ||
      (m.origem != null && typeof m.origem !== "string")
    )
      return [];
    return [
      {
        ...m,
        id,
        versao,
        nome: texto(m.nome),
        corpo: texto(m.corpo),
        situacao: texto(m.situacao),
        origem: texto(m.origem),
        area: texto(m.area),
        ativo: m.ativo === true,
        em_uso: numero(m.em_uso) ?? 0,
        arquivado_em: texto(m.arquivado_em),
        arquivado_por: texto(m.arquivado_por),
        motivo_arquivamento: texto(m.motivo_arquivamento),
      },
    ];
  });
}
export function normalizarDadosDosModelos(valor: unknown): DadosDosModelos {
  const d = objetoDosRecursos(valor);
  const opcoes = (v: unknown) =>
    registros(v).flatMap((o) =>
      typeof o.id === "string" ? [{ id: o.id, rotulo: texto(o.rotulo) }] : [],
    );
  return {
    erro: texto(d.erro) || undefined,
    modelos: normalizarModelosDaResposta(d.modelos),
    areas: opcoes(d.areas),
    origens: opcoes(d.origens),
  };
}
export function normalizarRespostaDoRecurso(
  valor: unknown,
): RespostaDoRecurso | null {
  if (valor == null) return null;
  const r = objetoDosRecursos(valor),
    id = idDosRecursos(r.id),
    revisao = numero(r.revisao);
  if (
    id === null ||
    revisao === undefined ||
    !Number.isInteger(revisao) ||
    revisao < 1 ||
    typeof r.estado !== "string" ||
    !["rascunho", "em_revisao", "aprovada", "devolvida", "enviada"].includes(
      r.estado,
    )
  )
    return null;
  return {
    ...r,
    id,
    revisao,
    estado: r.estado,
    modelo_id: idDosRecursos(r.modelo_id),
    modelo_versao: numero(r.modelo_versao) ?? null,
    modelo_nome: texto(r.modelo_nome),
    modelo_corpo: texto(r.modelo_corpo),
    modelo_situacao: texto(r.modelo_situacao),
    modelo_vigente: r.modelo_vigente === true,
    fundamentacao: texto(r.fundamentacao),
    texto_final: texto(r.texto_final),
    autor: texto(r.autor),
    autor_id: idDosRecursos(r.autor_id),
    envio_revisao_por_id: idDosRecursos(r.envio_revisao_por_id),
    passou_revisao: Boolean(r.passou_revisao),
    atualizado_em: texto(r.atualizado_em),
    envio_revisao_em: texto(r.envio_revisao_em),
    envio_revisao_por: texto(r.envio_revisao_por),
    revisor: texto(r.revisor),
    revisao_em: texto(r.revisao_em),
    enviada_em: texto(r.enviada_em),
    enviada_por: texto(r.enviada_por),
    comentario_revisao: texto(r.comentario_revisao),
    historico: registros(r.historico).map((h) => ({
      acao: texto(h.acao),
      comentario: texto(h.comentario),
      em: texto(h.em),
      autor: texto(h.autor),
    })),
  };
}
export function normalizarCandidatosDosRecursos(
  valor: unknown,
): CandidatoDoRecurso[] {
  return registros(valor).flatMap((r) => {
    const id = idDosRecursos(r.id);
    return id === null
      ? []
      : [
          {
            ...r,
            id,
            candidato: texto(r.candidato),
            codigo: escalar(r.codigo),
            cargo: texto(r.cargo),
            vaga: texto(r.vaga),
            nota: escalar(r.nota),
            resultado: texto(r.resultado),
            responsavel: texto(r.responsavel),
          },
        ];
  });
}
/** Metadados das escritas. JSON de prévias de pontuação continua opaco e é preservado. */
export function metadadosDaRpcDosRecursos(
  valor: unknown,
): RegistroDosRecursos & {
  id?: IdentificadorDoRecurso;
  nu?: number;
  revisao?: number;
  versao?: number;
  estado?: string;
  em?: string;
  caminho?: string;
  nome?: string;
} {
  const d = objetoDosRecursos(valor);
  return {
    ...d,
    id: idDosRecursos(d.id) ?? undefined,
    nu: numero(d.nu),
    revisao: numero(d.revisao),
    versao: numero(d.versao),
    estado: typeof d.estado === "string" ? d.estado : undefined,
    em: typeof d.em === "string" ? d.em : undefined,
    caminho: typeof d.caminho === "string" ? d.caminho : undefined,
    nome: typeof d.nome === "string" ? d.nome : undefined,
  };
}
