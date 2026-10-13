import { objetoDosRecursos as objeto } from "../dados-dos-recursos.ts";
import type {
  RegistroDaClassificacao,
  EditalDaClassificacao,
  RegraDaClassificacao,
  ListaRegistrada,
  DadosDaClassificacao,
  RetratoDaClassificacao,
  DesempateRegistrado,
  VersaoDaRegraDaClassificacao,
} from "../../modulos/classificacao/tipos-do-estado.ts";
export { objeto };
export const textoDaClassificacao = (v: unknown) =>
  typeof v === "string" ? v : "";
const numero = (v: unknown) =>
  typeof v === "number" && Number.isFinite(v) ? v : undefined;
const registros = (v: unknown): RegistroDaClassificacao[] =>
  Array.isArray(v)
    ? v.filter(
        (r): r is RegistroDaClassificacao =>
          r !== null && typeof r === "object" && !Array.isArray(r),
      )
    : [];
export function editaisDaClassificacao(v: unknown): {
  editais: EditalDaClassificacao[];
  pode_editar: boolean;
} {
  const d = objeto(v);
  return {
    pode_editar: d.pode_editar === true,
    editais: registros(d.editais).flatMap((e) =>
      typeof e.id !== "string" || !e.id
        ? []
        : [
            {
              ...e,
              id: e.id,
              edital: textoDaClassificacao(e.edital),
              unidade: textoDaClassificacao(e.unidade),
              candidatos: numero(e.candidatos) ?? 0,
              versao_regra: numero(e.versao_regra),
              nome_regra: textoDaClassificacao(e.nome_regra) || null,
              treinamento: e.treinamento === true,
            },
          ],
    ),
  };
}
function versoesDaRegra(
  v: unknown,
): VersaoDaRegraDaClassificacao[] | undefined {
  if (v == null) return undefined;
  if (!Array.isArray(v) || registros(v).length !== v.length)
    throw new Error("Histórico de versões da regra inválido.");
  return registros(v).map((r) => {
    const versao = numero(r.versao);
    if (versao === undefined || !Number.isInteger(versao) || versao < 1)
      throw new Error("Versão da regra inválida.");
    if (
      r.configuracao != null &&
      (typeof r.configuracao !== "object" || Array.isArray(r.configuracao))
    )
      throw new Error("Configuração da versão inválida.");
    return {
      ...r,
      versao,
      nome: textoDaClassificacao(r.nome) || null,
      em: textoDaClassificacao(r.em),
      por: textoDaClassificacao(r.por),
      motivo: textoDaClassificacao(r.motivo),
      configuracao: r.configuracao == null ? undefined : objeto(r.configuracao),
      renomeacoes: registros(r.renomeacoes).map((t) => ({
        em: textoDaClassificacao(t.em),
        por: textoDaClassificacao(t.por),
        de: textoDaClassificacao(t.de),
        para: textoDaClassificacao(t.para),
        motivo: textoDaClassificacao(t.motivo),
      })),
    };
  });
}
export function regraDaClassificacao(v: unknown): RegraDaClassificacao | null {
  const r = objeto(v),
    versao = numero(r.versao);
  if (versao === undefined || !Number.isInteger(versao) || versao < 1)
    return null;
  return {
    ...r,
    versao,
    nome: textoDaClassificacao(r.nome) || null,
    configuracao: objeto(r.configuracao),
    versoes: versoesDaRegra(r.versoes),
  };
}
export function listaRegistrada(v: unknown): ListaRegistrada | null {
  const r = objeto(v);
  if (
    r.pendencias != null &&
    (typeof r.pendencias !== "number" ||
      !Number.isSafeInteger(r.pendencias) ||
      r.pendencias < 0)
  )
    throw new Error("Quantidade de pendências da lista inválida.");
  if (r.publicada != null && typeof r.publicada !== "boolean")
    throw new Error("Situação de publicação da lista inválida.");
  return typeof r.id !== "string" || !r.id
    ? null
    : {
        ...r,
        id: r.id,
        tipo: typeof r.tipo === "string" ? r.tipo : undefined,
        publicada: typeof r.publicada === "boolean" ? r.publicada : undefined,
        pendencias: numero(r.pendencias),
        gerada_em: typeof r.gerada_em === "string" ? r.gerada_em : undefined,
        por: typeof r.por === "string" ? r.por : undefined,
        versao_regra: numero(r.versao_regra),
        hash: typeof r.hash === "string" ? r.hash : undefined,
      };
}
/** Uma ordem incompleta não pode ser apresentada como resultado de um sorteio. */
export function desempateRegistrado(v: unknown): DesempateRegistrado {
  const r = objeto(v);
  const chave = textoDaClassificacao(r.chave),
    metodo = textoDaClassificacao(r.metodo);
  if (!chave || (metodo !== "SORTEIO" && metodo !== "MANUAL"))
    throw new Error("Registro de desempate inválido.");
  let ordem: string[] | undefined;
  if (r.ordem != null) {
    if (
      !Array.isArray(r.ordem) ||
      !r.ordem.every(
        (id): id is string => typeof id === "string" && Boolean(id.trim()),
      )
    )
      throw new Error("Ordem do desempate inválida.");
    ordem = r.ordem;
    if (new Set(ordem).size !== ordem.length)
      throw new Error("Ordem do desempate inválida.");
  }
  const semente = typeof r.semente === "string" ? r.semente : undefined;
  if (metodo === "SORTEIO" && (!semente?.trim() || !ordem?.length))
    throw new Error("Resultado do sorteio incompleto.");
  return {
    ...r,
    chave,
    metodo,
    ordem,
    semente,
    origem_semente:
      typeof r.origem_semente === "string" ? r.origem_semente : undefined,
  };
}
export function retratoDaClassificacao(
  v: unknown,
): RetratoDaClassificacao | null {
  const r = objeto(v),
    edital = objeto(r.edital);
  if (
    typeof r.tipo !== "string" ||
    !r.tipo ||
    !Array.isArray(r.vagas) ||
    registros(r.vagas).length !== r.vagas.length ||
    (r.modalidades != null &&
      (!Array.isArray(r.modalidades) ||
        registros(r.modalidades).length !== r.modalidades.length))
  )
    return null;
  return {
    ...r,
    tipo: r.tipo,
    edital: {
      ...edital,
      id: typeof edital.id === "string" ? edital.id : undefined,
      edital: textoDaClassificacao(edital.edital),
      unidade: textoDaClassificacao(edital.unidade),
    },
    vagas: registros(r.vagas),
    modalidades: registros(r.modalidades),
    parciais: Array.isArray(r.parciais)
      ? r.parciais.filter((p): p is string => typeof p === "string")
      : undefined,
    rodape: typeof r.rodape === "string" ? r.rodape : undefined,
  };
}
export function listaComRetrato(v: unknown): ListaRegistrada | null {
  const d = objeto(v),
    lista = listaRegistrada(d.lista),
    retrato = retratoDaClassificacao(d.resultado);
  return lista && retrato ? { ...lista, retrato } : null;
}
export function dadosDaClassificacao(v: unknown): DadosDaClassificacao {
  const d = objeto(v),
    edital = objeto(d.edital);
  for (const campo of [
    "candidatos",
    "cronograma",
    "desempates",
    "listas",
    "entrevistas",
    "quadro",
    "ajustes",
  ]) {
    const linhas = d[campo];
    if (
      linhas != null &&
      (!Array.isArray(linhas) || registros(linhas).length !== linhas.length)
    )
      throw new Error(
        "Os dados da classificação recebidos são inválidos. Recarregue o edital.",
      );
  }
  const regra = objeto(d.regra);
  if (
    regra.configuracao != null &&
    (typeof regra.configuracao !== "object" ||
      Array.isArray(regra.configuracao))
  )
    throw new Error("A configuração da regra recebida é inválida.");
  return {
    ...d,
    edital: {
      ...edital,
      id: typeof edital.id === "string" ? edital.id : undefined,
      treinamento: edital.treinamento === true,
    },
    regra: regraDaClassificacao(d.regra),
    pode_editar: d.pode_editar === true,
    listas: registros(d.listas)
      .map(listaRegistrada)
      .filter((r): r is ListaRegistrada => r !== null),
    candidatos: registros(d.candidatos),
    cronograma: registros(d.cronograma),
    desempates: registros(d.desempates).map(desempateRegistrado),
  };
}
