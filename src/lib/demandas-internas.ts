import type { EtapaDoCalendario } from "../modulos/cronograma/tipos.ts";
import type { TipoDeEtapa } from "./etapas-de-edital.ts";
import { normalizarTexto } from "./etapas-de-edital.ts";

/*
  Demandas internas do Cronograma (migration 20261104120000): itens próprios
  da equipe, por área, com edital opcional, responsáveis e conclusão. Regras
  puras — leitura da RPC, "Atrasada", o formulário e a demanda vista como uma
  etapa do calendário. A permissão é do banco: a RPC devolve `pode_editar`
  por demanda e as áreas onde a pessoa pode criar (`pode_criar_em`).
*/

/** Tipo próprio no calendário: cor e item na legenda/filtro de tipos. */
export const TIPO_DEMANDA_INTERNA: TipoDeEtapa = Object.freeze({
  id: "demanda-interna",
  rotulo: "Demanda interna",
  cor: "demanda",
  termos: Object.freeze([]) as readonly string[],
});

export type PessoaDaDemanda = { id: string; nome: string };

export type DemandaInterna = {
  id: string;
  area: string;
  editalId: string;
  edital: string;
  unidade: string;
  titulo: string;
  descricao: string;
  dataInicio: string;
  dataFim: string;
  concluida: boolean;
  concluidaEm: string;
  concluidaPor: string;
  responsaveis: PessoaDaDemanda[];
  podeEditar: boolean;
  criadaEm: string;
  criadaPor: string;
  atualizadaEm: string;
  atualizadaPor: string;
};

export type ListaDeDemandas = {
  demandas: DemandaInterna[];
  podeCriarEm: string[];
};

export const LISTA_DE_DEMANDAS_VAZIA: ListaDeDemandas = Object.freeze({
  demandas: [],
  podeCriarEm: [],
}) as ListaDeDemandas;

const registro = (valor: unknown): Record<string, unknown> =>
  valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
const txt = (valor: unknown) =>
  typeof valor === "string" || typeof valor === "number"
    ? String(valor).trim()
    : "";
const DATA = /^\d{4}-\d{2}-\d{2}$/;
const dia = (valor: unknown) => {
  const texto = txt(valor).slice(0, 10);
  return DATA.test(texto) ? texto : "";
};

export function lerPessoas(valor: unknown): PessoaDaDemanda[] {
  if (!Array.isArray(valor)) return [];
  return valor
    .map((item) => {
      const pessoa = registro(item);
      return { id: txt(pessoa.id), nome: txt(pessoa.nome) || "Sem nome" };
    })
    .filter((pessoa) => pessoa.id);
}

/** Uma demanda da RPC; `null` se faltar id, título ou início válido. */
export function lerDemanda(valor: unknown): DemandaInterna | null {
  const bruta = registro(valor);
  const id = txt(bruta.id);
  const titulo = txt(bruta.titulo);
  const dataInicio = dia(bruta.data_inicio);
  if (!id || !titulo || !dataInicio) return null;
  const dataFim = dia(bruta.data_fim);
  return {
    id,
    area: txt(bruta.area),
    editalId: txt(bruta.edital_id),
    edital: txt(bruta.edital),
    unidade: txt(bruta.unidade),
    titulo,
    descricao: txt(bruta.descricao),
    dataInicio,
    dataFim: dataFim && dataFim >= dataInicio ? dataFim : dataInicio,
    concluida: bruta.concluida === true,
    concluidaEm: txt(bruta.concluida_em),
    concluidaPor: txt(bruta.concluida_por),
    responsaveis: lerPessoas(bruta.responsaveis),
    podeEditar: bruta.pode_editar === true,
    criadaEm: txt(bruta.criada_em),
    criadaPor: txt(bruta.criada_por),
    atualizadaEm: txt(bruta.atualizada_em),
    atualizadaPor: txt(bruta.atualizada_por),
  };
}

/** A resposta de `listar_demandas_internas`. */
export function lerDemandasInternas(resposta: unknown): ListaDeDemandas {
  const bruta = registro(resposta);
  const demandas = Array.isArray(bruta.demandas)
    ? bruta.demandas
        .map(lerDemanda)
        .filter((item): item is DemandaInterna => item !== null)
    : [];
  const podeCriarEm = Array.isArray(bruta.pode_criar_em)
    ? bruta.pode_criar_em.map(txt).filter(Boolean)
    : [];
  return { demandas: ordenarDemandas(demandas), podeCriarEm };
}

export const ordenarDemandas = (demandas: readonly DemandaInterna[]) =>
  [...demandas].sort(
    (a, b) =>
      a.dataInicio.localeCompare(b.dataInicio) ||
      a.titulo.localeCompare(b.titulo, "pt-BR"),
  );

/** Troca (ou inclui) uma demanda na lista, mantendo a ordem. */
export function comDemanda(
  lista: readonly DemandaInterna[],
  demanda: DemandaInterna,
) {
  return ordenarDemandas([
    ...lista.filter((item) => item.id !== demanda.id),
    demanda,
  ]);
}

/** Em aberto e com o último dia antes de hoje (`AAAA-MM-DD`). */
export const demandaAtrasada = (demanda: DemandaInterna, hojeChave: string) =>
  !demanda.concluida && demanda.dataFim < hojeChave;

export function situacaoDaDemanda(demanda: DemandaInterna, hojeChave: string) {
  if (demanda.concluida) return "Concluída";
  return demandaAtrasada(demanda, hojeChave) ? "Atrasada" : "Em aberto";
}

/** Só as da área aberta no menu (sem área: todas). */
export const demandasDaArea = (
  demandas: readonly DemandaInterna[],
  area: string,
) => (area ? demandas.filter((demanda) => demanda.area === area) : demandas);

const PREFIXO = "demanda:";

/*
  A demanda como etapa do calendário: as vistas (Mês, Semana, Lista) e o
  popup do dia a desenham sem saber que é demanda. Com edital, entra no
  filtro e na linha do edital; sem edital, o id é "demanda:<id>".
  "Atrasada" vai escrita no nome — destaque discreto, sem cor nova.
*/
export function demandaComoEtapa(
  demanda: DemandaInterna,
  hojeChave: string,
): EtapaDoCalendario {
  const sufixo = demanda.concluida
    ? " · concluída"
    : demandaAtrasada(demanda, hojeChave)
      ? " · atrasada"
      : "";
  const etapa: EtapaDoCalendario = {
    editalId: demanda.editalId || `${PREFIXO}${demanda.id}`,
    unidade: demanda.unidade || "Demanda interna",
    edital: demanda.edital,
    atividade: `${demanda.titulo}${sufixo}`,
    data_inicio: demanda.dataInicio,
    data_fim: demanda.dataFim,
    ordem: 0,
    tipo: TIPO_DEMANDA_INTERNA,
    busca: "",
    demandaId: demanda.id,
    concluida: demanda.concluida,
  };
  etapa.busca = normalizarTexto(
    `${demanda.titulo} ${demanda.edital} ${demanda.unidade} demanda interna ${demanda.responsaveis
      .map((pessoa) => pessoa.nome)
      .join(" ")}`,
  );
  return etapa;
}

/** O id da demanda num `editalId` de etapa sem edital ("demanda:<id>"). */
export const demandaDoEditalId = (editalId: string) =>
  editalId.startsWith(PREFIXO) ? editalId.slice(PREFIXO.length) : "";

/** Etapas e demandas juntas, por data de início (como a carga entrega). */
export const juntarPorInicio = (
  etapas: readonly EtapaDoCalendario[],
  demandas: readonly EtapaDoCalendario[],
) =>
  demandas.length
    ? [...etapas, ...demandas].sort((a, b) =>
        a.data_inicio.localeCompare(b.data_inicio),
      )
    : [...etapas];

// ── Formulário ────────────────────────────────────────────────────────────

export type FormularioDaDemanda = {
  id: string;
  area: string;
  editalId: string;
  titulo: string;
  descricao: string;
  periodo: boolean;
  dataInicio: string;
  dataFim: string;
  responsaveis: string[];
};

export function formularioDaDemanda(
  demanda: DemandaInterna | null,
  area: string,
): FormularioDaDemanda {
  if (!demanda)
    return {
      id: "",
      area,
      editalId: "",
      titulo: "",
      descricao: "",
      periodo: false,
      dataInicio: "",
      dataFim: "",
      responsaveis: [],
    };
  return {
    id: demanda.id,
    area: demanda.area,
    editalId: demanda.editalId,
    titulo: demanda.titulo,
    descricao: demanda.descricao,
    periodo: demanda.dataFim !== demanda.dataInicio,
    dataInicio: demanda.dataInicio,
    dataFim: demanda.dataFim,
    responsaveis: demanda.responsaveis.map((pessoa) => pessoa.id),
  };
}

/** O primeiro problema do formulário, ou "" se pode salvar. */
export function problemaDoFormulario(formulario: FormularioDaDemanda) {
  const titulo = formulario.titulo.trim();
  if (!formulario.area) return "Escolha a área.";
  if (titulo.length < 3) return "O título precisa ter ao menos 3 caracteres.";
  if (titulo.length > 200) return "O título pode ter até 200 caracteres.";
  if (formulario.descricao.trim().length > 2000)
    return "A descrição pode ter até 2.000 caracteres.";
  if (!DATA.test(formulario.dataInicio)) return "Informe a data.";
  if (formulario.periodo) {
    if (!DATA.test(formulario.dataFim)) return "Informe o fim do período.";
    if (formulario.dataFim < formulario.dataInicio)
      return "O fim não pode ser antes do início.";
  }
  return "";
}

/** O `p_demanda` de `salvar_demanda_interna`. */
export function payloadDaDemanda(formulario: FormularioDaDemanda) {
  return {
    ...(formulario.id ? { id: formulario.id } : {}),
    area: formulario.area,
    edital_id: formulario.editalId || null,
    titulo: formulario.titulo.trim().replace(/\s+/g, " "),
    descricao: formulario.descricao.trim() || null,
    data_inicio: formulario.dataInicio,
    data_fim: formulario.periodo ? formulario.dataFim : formulario.dataInicio,
    responsaveis: [...new Set(formulario.responsaveis)],
  };
}

const formatoDoDia = (chave: string) => {
  const [ano, mes, d] = chave.split("-");
  return `${d}/${mes}/${ano}`;
};

/** "12/11/2026" ou "12/11/2026 a 15/11/2026". */
export const periodoDaDemanda = (demanda: DemandaInterna) =>
  demanda.dataFim === demanda.dataInicio
    ? formatoDoDia(demanda.dataInicio)
    : `${formatoDoDia(demanda.dataInicio)} a ${formatoDoDia(demanda.dataFim)}`;
