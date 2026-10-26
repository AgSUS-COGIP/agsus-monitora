import type {
  CandidatoDaListaFinal,
  OrigemDaLista,
} from "./tipos-da-publicacao-de-aprovados.ts";
import {
  registroDaPublicacao,
  vagasDoRetrato,
} from "./dados-da-publicacao-de-aprovados.ts";

/*
  A lista de aprovados publicada a partir do resultado FINAL da Classificação.

  A Classificação calcula posição e nota pela regra do edital e registra a
  lista FINAL (TB_LISTA_CLASSIFICACAO, retrato em src/lib/classificacao/
  exportacao.js). "Publicar como lista de aprovados" cria a lista vigente da
  Lista de aprovados com esses candidatos — sem digitação — e preserva o que é
  da Lista de aprovados de quem já estava na lista anterior.

  Quem da lista vigente é a mesma pessoa de quem entra (o casamento) é conta do
  job Python desde 20261026150000 (python/monitora/aprovados/casamento.py); a
  tela mostra o plano (src/lib/casamento-da-lista.ts). Aqui, sem DOM e sem rede:
  - `candidatosDaListaFinal`: os candidatos do retrato, um por análise (a
    posição da lista geral; quem só está na lista da modalidade, a posição
    dela) — para conferir o retrato antes de pedir a prévia. O banco faz a
    mesma conta (FC_NOVOS_DA_CLASSIFICACAO).
  - o motivo da substituição (`motivoValido`);
  - `origemDaLista` / `resumoDasOrigens`: o rótulo da origem da lista.
*/

const texto = (valor: unknown) => String(valor ?? "").trim();

const numero = (valor: unknown) => {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
};

/**
 * Os candidatos do retrato FINAL, um por análise, na ordem das vagas.
 * `analises`: analise_id → { vaga, cargo } (dados do edital na Classificação),
 * para o código da vaga quando a vaga do retrato não tem (vaga do quadro).
 */
export function candidatosDaListaFinal(
  retrato: unknown,
  {
    analises = new Map(),
  }: {
    analises?: ReadonlyMap<string, { vaga?: unknown; cargo?: unknown }>;
  } = {},
): CandidatoDaListaFinal[] {
  const vistos = new Map<
    string,
    CandidatoDaListaFinal & { ordem: number; fonte: number }
  >();
  const vagas = vagasDoRetrato(retrato);
  vagas.forEach((vaga, ordem) => {
    const linhas = [
      ...(vaga.geral || []).map((l) => ({ l, fonte: 0 })),
      ...Object.values(vaga.listas || {}).flatMap((ls) =>
        (ls || []).map((l) => ({ l, fonte: 1 })),
      ),
    ];
    for (const { l, fonte } of linhas) {
      const id = texto(l?.analise_id);
      if (!id) continue;
      const posicao = numero(l.posicao);
      const atual = vistos.get(id);
      const melhor =
        !atual ||
        (atual.ordem === ordem &&
          (fonte < atual.fonte ||
            (fonte === atual.fonte &&
              (posicao ?? Infinity) < (atual.posicao ?? Infinity))));
      if (!melhor) continue;
      const analise = analises.get(id) || {};
      vistos.set(id, {
        analise_id: id,
        nome: texto(l.nome),
        cargo: texto(vaga.cargo) || texto(analise.cargo),
        codigo_vaga:
          texto(vaga.codigo) || texto(analise.vaga) || texto(vaga.chave),
        posicao,
        nota: numero(l.nota),
        situacao:
          l.situacao === "VAGA" || l.situacao === "CR" ? l.situacao : null,
        modalidades: Array.isArray(l.modalidades) ? l.modalidades : [],
        ordem,
        fonte,
      });
    }
  });
  return [...vistos.values()]
    .sort(
      (a, b) =>
        a.ordem - b.ordem ||
        a.fonte - b.fonte ||
        (a.posicao ?? Infinity) - (b.posicao ?? Infinity),
    )
    .map(({ ordem: _o, fonte: _f, ...resto }) => resto);
}

/* O motivo para substituir uma lista com status (ou trocar pela planilha a da Classificação). */
export const MOTIVO_MINIMO = 3;
export const MOTIVO_MAXIMO = 500;
export function motivoValido(motivo: unknown) {
  const t = texto(motivo);
  return t.length >= MOTIVO_MINIMO && t.length <= MOTIVO_MAXIMO;
}

const diaMes = (valor: unknown) => {
  if (typeof valor !== "string" && typeof valor !== "number") return "";
  const d = new Date(valor);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
  });
};

/**
 * A origem da lista vigente (linha de listar_listas_aprovados):
 * { tipo: "CLASSIFICACAO" | "XLSX", texto }.
 */
export function origemDaLista(lista: unknown): OrigemDaLista | null {
  if (!lista) return null;
  const dados = registroDaPublicacao(lista);
  if (texto(dados.origem).toUpperCase() === "CLASSIFICACAO") {
    const quando = diaMes(dados.importado_em);
    return {
      tipo: "CLASSIFICACAO",
      texto: quando
        ? `Publicada da Classificação em ${quando}`
        : "Publicada da Classificação",
    };
  }
  return { tipo: "XLSX", texto: "Lista manual (planilha)" };
}

/**
 * A origem das listas na tela: a do edital quando só há um no recorte; com
 * vários, quantas vieram de cada origem.
 */
export function resumoDasOrigens(
  listas: readonly unknown[] | null | undefined,
) {
  const vigentes = (listas || []).filter(Boolean);
  if (!vigentes.length) return "";
  if (vigentes.length === 1) return origemDaLista(vigentes[0])?.texto ?? "";
  const daClassificacao = vigentes.filter(
    (l) => origemDaLista(l)?.tipo === "CLASSIFICACAO",
  ).length;
  const manuais = vigentes.length - daClassificacao;
  const partes = [];
  if (daClassificacao)
    partes.push(
      `${daClassificacao} ${daClassificacao === 1 ? "publicada" : "publicadas"} da Classificação`,
    );
  if (manuais)
    partes.push(
      `${manuais} ${manuais === 1 ? "manual" : "manuais"} (planilha)`,
    );
  return `Listas: ${partes.join(" · ")}`;
}
