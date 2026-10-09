import type {
  Avaliador,
  Avaliacao,
  Convocado,
  ItemDaAgendaNoBanco,
} from "./fila-de-conducao.ts";
import type { RoteiroDeEntrevista } from "./tipos-do-roteiro-de-entrevista.ts";
import type {
  DadosDoEdital,
  EstadoDaConducao,
} from "../modulos/entrevistas/tipos.ts";

export function objetoDaConducao(
  valor: unknown,
): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : null;
}
const texto = (v: unknown): v is string => typeof v === "string";
const textoNulo = (v: unknown) => v === null || texto(v);
const numero = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const numeroNulo = (v: unknown) => v === null || numero(v);
const nota = (v: unknown) => v === null || texto(v) || numero(v);
const booleano = (v: unknown) => typeof v === "boolean";
const opcionais = (
  o: Record<string, unknown>,
  campos: readonly string[],
  validar: (v: unknown) => boolean,
) => campos.every((c) => o[c] === undefined || validar(o[c]));
const lista = (v: unknown, validar: (item: unknown) => boolean): boolean =>
  v == null || (Array.isArray(v) && v.every(validar));
export const registrosDaConducao = (
  valor: unknown,
): Record<string, unknown>[] =>
  Array.isArray(valor)
    ? valor.flatMap((v) => {
        const o = objetoDaConducao(v);
        return o ? [o] : [];
      })
    : [];
const identificado = (v: unknown) => {
  const o = objetoDaConducao(v);
  return o && texto(o.id) && o.id.trim() ? o : null;
};

function competencia(v: unknown): boolean {
  const o = identificado(v);
  return Boolean(
    o &&
    texto(o.nome) &&
    opcionais(o, ["ordem"], numeroNulo) &&
    opcionais(o, ["descricao", "tipo_minimo", "avaliacao"], textoNulo) &&
    opcionais(o, ["nota_maxima", "peso", "minimo"], nota),
  );
}
const aspecto = (v: unknown): boolean => {
  const o = identificado(v);
  return Boolean(
    o && opcionais(o, ["nome"], texto) && opcionais(o, ["ordem"], numeroNulo),
  );
};
function convocacao(v: unknown): boolean {
  if (v == null) return true;
  const o = objetoDaConducao(v);
  return Boolean(
    o &&
    opcionais(o, ["multiplo_imediatas", "posicao_cadastro_reserva"], nota) &&
    lista(o.excecoes, (e) => {
      const x = objetoDaConducao(e);
      return Boolean(
        x &&
        opcionais(x, ["termo_cargo"], textoNulo) &&
        opcionais(x, ["multiplo_imediatas", "posicao_cadastro_reserva"], nota),
      );
    }),
  );
}
export function ehRoteiroDaConducao(v: unknown): v is RoteiroDeEntrevista {
  const o = identificado(v);
  return Boolean(
    o &&
    opcionais(o, ["nome"], texto) &&
    opcionais(o, ["versao"], numero) &&
    opcionais(
      o,
      ["origem", "nome_versao", "descricao", "etapa", "area", "escala"],
      textoNulo,
    ) &&
    opcionais(o, ["ativo", "ausencia_elimina", "soma_analise"], booleano) &&
    opcionais(o, ["editais_em_uso"], numeroNulo) &&
    opcionais(o, ["passo", "nota_minima_total"], nota) &&
    lista(o.competencias, competencia) &&
    lista(o.aspectos, aspecto) &&
    lista(o.notas_permitidas, nota) &&
    lista(o.notas_eliminatorias, nota) &&
    lista(o.desempate, texto) &&
    lista(o.niveis, (v) => {
      const n = objetoDaConducao(v);
      return Boolean(
        n &&
        opcionais(n, ["nota"], nota) &&
        opcionais(n, ["nome", "descricao"], textoNulo),
      );
    }) &&
    lista(o.renomeacoes, (v) => {
      const n = objetoDaConducao(v);
      return Boolean(
        n && opcionais(n, ["em", "por", "de", "para", "motivo"], textoNulo),
      );
    }) &&
    lista(o.banca_padrao, (v) => {
      const b = objetoDaConducao(v);
      return Boolean(
        b &&
        opcionais(b, ["origem"], textoNulo) &&
        opcionais(b, ["quantidade"], nota),
      );
    }) &&
    convocacao(o.convocacao_padrao),
  );
}
export function roteirosDaConducao(v: unknown): RoteiroDeEntrevista[] {
  return Array.isArray(v) ? v.filter(ehRoteiroDaConducao) : [];
}
function ehAvaliador(v: unknown): v is Avaliador {
  const o = identificado(v);
  return Boolean(
    o &&
    opcionais(o, ["nome", "origem", "perfil"], textoNulo) &&
    opcionais(o, ["banca"], nota) &&
    opcionais(o, ["ativo"], booleano) &&
    lista(o.competencias, texto),
  );
}
function ehAvaliacao(v: unknown): v is Avaliacao {
  const o = objetoDaConducao(v);
  return Boolean(
    o &&
    opcionais(o, ["competencia", "avaliador", "aspecto"], textoNulo) &&
    opcionais(o, ["nota"], nota) &&
    lista(o.aspectos, (v) => {
      const a = objetoDaConducao(v);
      return Boolean(a && texto(a.aspecto) && nota(a.nota));
    }),
  );
}
function ehConvocado(v: unknown): v is Convocado {
  const o = identificado(v);
  return Boolean(
    o &&
    opcionais(
      o,
      [
        "analise_id",
        "candidato",
        "codigo",
        "vaga",
        "cargo",
        "modalidade",
        "compareceu",
        "parecer",
        "justificativa",
      ],
      textoNulo,
    ) &&
    opcionais(o, ["banca", "nota", "nota_analise"], numeroNulo) &&
    lista(o.avaliacoes, ehAvaliacao) &&
    lista(o.observacoes, (v) => {
      const x = objetoDaConducao(v);
      return Boolean(
        x && texto(x.avaliador) && opcionais(x, ["texto"], textoNulo),
      );
    }),
  );
}
function filtrar<T>(v: unknown, validar: (item: unknown) => item is T): T[] {
  return Array.isArray(v) ? v.filter(validar) : [];
}
/** Verifica os campos usados nas telas; retratos da Classificação continuam opacos. */
export function dadosDoEditalDaConducao(v: unknown): DadosDoEdital | null {
  const o = objetoDaConducao(v);
  if (!o) return null;
  const e = identificado(o.edital);
  if (!e) return null;
  const c = objetoDaConducao(o.configuracao);
  const regra = objetoDaConducao(o.regra_classificacao);
  const registrada = objetoDaConducao(o.lista_convocacao);
  const l = objetoDaConducao(registrada?.lista);
  return {
    ...o,
    edital: e
      ? {
          ...e,
          id: String(e.id),
          edital: texto(e.edital) ? e.edital : undefined,
          unidade: texto(e.unidade) ? e.unidade : undefined,
          treinamento: e.treinamento === true,
        }
      : null,
    pode_editar: o.pode_editar === true,
    pode_gerar_lista: o.pode_gerar_lista === true,
    admin_global: o.admin_global === true,
    meu_perfil: texto(o.meu_perfil) ? o.meu_perfil : null,
    configuracao: c
      ? {
          ...c,
          roteiro: ehRoteiroDaConducao(c.roteiro) ? c.roteiro : null,
          lancamento: texto(c.lancamento) ? c.lancamento : null,
          banca: registrosDaConducao(c.banca).flatMap((b) =>
            texto(b.origem) && numero(b.quantidade)
              ? [{ origem: b.origem, quantidade: Number(b.quantidade) }]
              : [],
          ),
        }
      : null,
    regra_classificacao: regra
      ? {
          ...regra,
          versao: numero(regra.versao) ? Number(regra.versao) : undefined,
        }
      : null,
    lista_convocacao: registrada
      ? { ...registrada, lista: l && texto(l.id) ? { ...l, id: l.id } : null }
      : null,
    avaliadores: filtrar(o.avaliadores, ehAvaliador),
    convocados: filtrar(o.convocados, ehConvocado),
  };
}
export function agendaDaConducao(v: unknown): EstadoDaConducao["agenda"] {
  const o = objetoDaConducao(v);
  if (!o) return null;
  return {
    ...o,
    itens: filtrar(o.itens, (v): v is ItemDaAgendaNoBanco => {
      const i = objetoDaConducao(v);
      return Boolean(
        i &&
        opcionais(i, ["analise_id", "data", "inicio", "fim"], textoNulo) &&
        opcionais(i, ["banca"], numeroNulo),
      );
    }),
  };
}
export function codigoDaFalhaDaConducao(v: unknown): string {
  const o = objetoDaConducao(v);
  return o && texto(o.code) ? o.code : "";
}
