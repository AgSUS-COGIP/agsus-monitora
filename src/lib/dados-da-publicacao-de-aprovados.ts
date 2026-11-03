import type {
  CandidatoAnterior,
  ResultadoDaPublicacao,
  SituacaoDaPublicacao,
} from "./tipos-da-publicacao-de-aprovados.ts";

function ehRegistro(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}
export function registroDaPublicacao(valor: unknown): Record<string, unknown> {
  return ehRegistro(valor) ? valor : {};
}
const erro = () =>
  new Error(
    "Dados da publicação inválidos. Recarregue a lista antes de publicar.",
  );
function registroObrigatorio(valor: unknown) {
  if (valor === null || typeof valor !== "object" || Array.isArray(valor))
    throw erro();
  return registroDaPublicacao(valor);
}
function linhas(valor: unknown, opcional = false): Record<string, unknown>[] {
  if (opcional && valor == null) return [];
  if (!Array.isArray(valor)) throw erro();
  return valor.map(registroObrigatorio);
}
function identificador(valor: unknown) {
  if (typeof valor !== "string" || !valor.trim()) throw erro();
  return valor.trim();
}
function texto(valor: unknown): string | null {
  if (valor == null) return null;
  if (typeof valor !== "string") throw erro();
  return valor;
}
function booleano(valor: unknown): boolean | null {
  if (valor == null) return null;
  if (typeof valor !== "boolean") throw erro();
  return valor;
}
function posicao(valor: unknown): number | null {
  if (valor == null || valor === "") return null;
  if (typeof valor !== "number" && typeof valor !== "string") throw erro();
  const n = Number(valor);
  if (!Number.isFinite(n)) throw erro();
  return n;
}

/** Não descarta pessoas: uma resposta incompleta impediria a revisão dos vínculos. */
export function situacaoDaPublicacao(valor: unknown): SituacaoDaPublicacao {
  const dados = registroObrigatorio(valor);
  // Antes de 20261030090000 o banco não dizia: quem barra é o banco.
  const pode_substituir = booleano(dados.pode_substituir) !== false;
  if (dados.vigente === null) return { vigente: null, pode_substituir };
  const vigente = registroObrigatorio(dados.vigente);
  const vistos = new Set<string>();
  // Sem p_com_candidatos, o banco não manda os candidatos (null).
  const candidatos: CandidatoAnterior[] = linhas(vigente.candidatos, true).map(
    (c) => {
      const id = identificador(c.candidato_id);
      if (vistos.has(id)) throw erro();
      vistos.add(id);
      return {
        candidato_id: id,
        analise_id: texto(c.analise_id),
        nome: texto(c.nome),
        cargo: texto(c.cargo),
        codigo_vaga: texto(c.codigo_vaga),
        classificacao: posicao(c.classificacao),
        status: texto(c.status),
        matricula: texto(c.matricula),
        processo_sei: texto(c.processo_sei),
        sub_judice: booleano(c.sub_judice),
        alterado_judicialmente: booleano(c.alterado_judicialmente),
      };
    },
  );
  return {
    vigente: {
      lista_id: identificador(vigente.lista_id),
      origem: texto(vigente.origem) ?? "",
      importado_em: texto(vigente.importado_em),
      candidatos,
    },
    pode_substituir,
  };
}

export function resultadoDaPublicacao(valor: unknown): ResultadoDaPublicacao {
  const dados = registroObrigatorio(valor);
  if (
    dados.ok !== true ||
    typeof dados.candidatos !== "number" ||
    !Number.isSafeInteger(dados.candidatos) ||
    dados.candidatos < 0 ||
    !Array.isArray(dados.pendencias)
  )
    throw erro();
  return { candidatos: dados.candidatos, pendencias: dados.pendencias };
}

/** Mantém todas as linhas e a ordem do retrato; coleções malformadas não viram listas parciais. */
export function vagasDoRetrato(valor: unknown) {
  if (valor == null) return [];
  const retrato = registroObrigatorio(valor);
  return linhas(retrato.vagas, true).map((v) => {
    const listas = v.listas == null ? {} : registroObrigatorio(v.listas);
    const porModalidade: Record<string, Record<string, unknown>[]> = {};
    for (const [codigo, lista] of Object.entries(listas))
      porModalidade[codigo] = linhas(lista, true);
    return {
      ...v,
      cargo: v.cargo,
      codigo: v.codigo,
      chave: v.chave,
      geral: linhas(v.geral, true),
      listas: porModalidade,
    };
  });
}
