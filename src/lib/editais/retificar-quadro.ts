/*
  Retificar uma linha do quadro de vagas (Anexo II) sem subir o PDF inteiro, sem DOM.

  A equipe edita uma linha (cargo, lotação, vagas imediatas por modalidade, cadastro reserva),
  acrescenta uma linha ou retira uma. Grava pela mesma RPC do PDF (`salvar_quadro_de_vagas`,
  migration 20261126180000): o quadro inteiro, cada linha que fica com `anterior` (a linha
  vigente que ela substitui, e o vínculo das vagas vai junto), a linha mudada ou nova com origem
  MANUAL, e o motivo. Antes de gravar, a tela pede a simulação (`simular: true`) e mostra o que
  muda: a linha antes e depois e as vagas da seleção que seguem, ficam sem linha, passam a ela ou
  mudam de linha.

  A tela é `src/modulos/editais/retificar-quadro.tsx`; o vínculo das vagas, `vinculos-do-quadro.ts`.
*/

import { filaDoQuadro, rotuloDaLinha } from "./vinculos-do-quadro.ts";
import type { VinculoDaVaga } from "./vinculos-do-quadro.ts";

type Bruto = Record<string, unknown>;
type Quantidade = number | string | null;

/** Uma linha do quadro vigente, como `obter_quadro_de_vagas` devolve. */
export interface LinhaVigente {
  id: string;
  ordem: number;
  cargo: string;
  lotacao: string | null;
  /** Vagas imediatas por modalidade, na ordem do edital (null = só cadastro reserva). */
  modalidades: Record<string, Quantidade>;
  vagasImediatas: number;
  cadastroReserva: boolean;
  origem: "PDF" | "MANUAL";
  arquivo: string | null;
}

/** O que o modal edita: as quantidades como texto ("" = sem vaga imediata nessa modalidade). */
export interface RascunhoDaLinha {
  cargo: string;
  lotacao: string;
  modalidades: { nome: string; quantidade: string }[];
  cadastroReserva: boolean;
}

export type MudancaNoQuadro =
  | { tipo: "editar"; id: string; linha: RascunhoDaLinha }
  | { tipo: "acrescentar"; linha: RascunhoDaLinha }
  | { tipo: "retirar"; id: string };

/** Uma linha como `salvar_quadro_de_vagas` recebe. */
export interface LinhaParaGravar {
  cargo: string;
  lotacao: string;
  modalidades: Record<string, number | null>;
  vagas_imediatas: number;
  cadastro_reserva: boolean;
  anterior?: string;
  origem?: "MANUAL";
}

/** O payload da retificação (`salvar_quadro_de_vagas`, p_dados). */
export interface QuadroRetificado {
  motivo: string;
  numero_errata?: string;
  simular?: boolean;
  linhas: LinhaParaGravar[];
}

export const MOTIVO_MINIMO = 10;
export const MOTIVO_MAXIMO = 500;
const LIMITE_DE_VAGAS = 9999;

const objeto = (v: unknown): Bruto | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Bruto) : null;
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** As linhas vigentes do payload de `obter_quadro_de_vagas`, sem confiar no formato. */
export function linhasDoQuadro(dados: unknown): LinhaVigente[] {
  const lista = objeto(dados)?.["linhas"];
  if (!Array.isArray(lista)) return [];
  return lista
    .map((v, i): LinhaVigente | null => {
      const o = objeto(v);
      const id = texto(o?.["id"]);
      const cargo = texto(o?.["cargo"]);
      if (!o || !id || !cargo) return null;
      return {
        id,
        ordem: Number(o["ordem"]) || i + 1,
        cargo,
        lotacao: texto(o["lotacao"]) || null,
        modalidades: (objeto(o["modalidades"]) ?? {}) as Record<
          string,
          Quantidade
        >,
        vagasImediatas: Number(o["vagas_imediatas"]) || 0,
        cadastroReserva: o["cadastro_reserva"] === true,
        origem: o["origem"] === "MANUAL" ? "MANUAL" : "PDF",
        arquivo: texto(o["arquivo"]) || null,
      };
    })
    .filter((l): l is LinhaVigente => l !== null)
    .sort((a, b) => a.ordem - b.ordem);
}

/** As modalidades do quadro, na ordem em que aparecem. */
export function modalidadesDoQuadro(
  linhas: readonly Pick<LinhaVigente, "modalidades">[],
): string[] {
  const nomes: string[] = [];
  for (const l of linhas)
    for (const m of Object.keys(l.modalidades))
      if (!nomes.includes(m)) nomes.push(m);
  return nomes.length ? nomes : ["Ampla Concorrência"];
}

const quantidadeEmTexto = (v: Quantidade | undefined) =>
  v === null || v === undefined || v === "" ? "" : String(v);

/** O rascunho do modal: a linha que se edita, ou uma linha em branco com as modalidades do quadro. */
export function rascunhoDaLinha(
  linha: LinhaVigente | null,
  modalidades: readonly string[],
): RascunhoDaLinha {
  const nomes = [
    ...modalidades,
    ...Object.keys(linha?.modalidades ?? {}).filter(
      (m) => !modalidades.includes(m),
    ),
  ];
  return {
    cargo: linha?.cargo ?? "",
    lotacao: linha?.lotacao ?? "",
    modalidades: nomes.map((nome) => ({
      nome,
      quantidade: quantidadeEmTexto(linha?.modalidades[nome]),
    })),
    cadastroReserva: linha?.cadastroReserva ?? false,
  };
}

const ehQuantidade = (t: string) => /^\d{1,4}$/.test(t.trim());

/** O total de vagas imediatas do rascunho: a soma das modalidades. */
export const totalDoRascunho = (r: RascunhoDaLinha): number =>
  r.modalidades.reduce(
    (soma, m) => soma + (ehQuantidade(m.quantidade) ? Number(m.quantidade) : 0),
    0,
  );

/** A mesma chave de `FC_CHAVE_LINHA_QUADRO`: cargo e lotação sem acento, caixa e pontuação. */
export function chaveDaLinha(cargo: string, lotacao: string | null): string {
  const limpar = (t: string | null) =>
    (t ?? "")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  return `${limpar(cargo)}|${limpar(lotacao)}`;
}

/** O rascunho como linha a gravar (sem `anterior` nem origem). */
function linhaDoRascunho(r: RascunhoDaLinha): LinhaParaGravar {
  const modalidades: Record<string, number | null> = {};
  for (const m of r.modalidades)
    modalidades[m.nome] = ehQuantidade(m.quantidade)
      ? Number(m.quantidade)
      : null;
  return {
    cargo: r.cargo.trim(),
    lotacao: r.lotacao.trim(),
    modalidades,
    vagas_imediatas: totalDoRascunho(r),
    cadastro_reserva: r.cadastroReserva,
  };
}

/** A linha vigente como está, para gravar de novo (com `anterior` = ela mesma). */
function linhaComoEsta(l: LinhaVigente): LinhaParaGravar {
  const modalidades: Record<string, number | null> = {};
  for (const [nome, v] of Object.entries(l.modalidades))
    modalidades[nome] =
      v === null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
  return {
    cargo: l.cargo,
    lotacao: l.lotacao ?? "",
    modalidades,
    vagas_imediatas: l.vagasImediatas,
    cadastro_reserva: l.cadastroReserva,
    anterior: l.id,
  };
}

/** O que impede gravar o rascunho (lista vazia = pode). */
export function problemasDoRascunho(
  r: RascunhoDaLinha,
  linhas: readonly LinhaVigente[],
  idEditado: string | null,
): string[] {
  const problemas: string[] = [];
  const cargo = r.cargo.trim();
  if (!cargo) problemas.push("Informe o cargo.");
  else if (cargo.length > 300)
    problemas.push("O cargo passa de 300 caracteres.");
  if (r.lotacao.trim().length > 300)
    problemas.push("A lotação passa de 300 caracteres.");
  const invalidas = r.modalidades.filter(
    (m) => m.quantidade.trim() && !ehQuantidade(m.quantidade),
  );
  if (invalidas.length)
    problemas.push(
      `Quantidade inválida em ${invalidas.map((m) => m.nome).join(", ")}: use um número inteiro.`,
    );
  if (totalDoRascunho(r) > LIMITE_DE_VAGAS)
    problemas.push(`O total passa de ${LIMITE_DE_VAGAS} vagas.`);
  if (!totalDoRascunho(r) && !r.cadastroReserva)
    problemas.push("A linha precisa de vaga imediata ou de cadastro reserva.");
  const chave = chaveDaLinha(cargo, r.lotacao);
  const repetida = linhas.find(
    (l) => l.id !== idEditado && chaveDaLinha(l.cargo, l.lotacao) === chave,
  );
  if (cargo && repetida)
    problemas.push(
      `Já há a linha ${rotuloDaLinha(repetida)} no quadro: edite-a em vez de repetir.`,
    );
  const atual = idEditado ? linhas.find((l) => l.id === idEditado) : null;
  if (atual && rascunhoIgualALinha(r, atual)) problemas.push("Nada mudou.");
  return problemas;
}

/** Se o rascunho é igual à linha vigente (nada a gravar). */
export function rascunhoIgualALinha(
  r: RascunhoDaLinha,
  linha: LinhaVigente,
): boolean {
  const novo = linhaDoRascunho(r);
  const atual = linhaComoEsta(linha);
  const nomes = new Set([
    ...Object.keys(novo.modalidades),
    ...Object.keys(atual.modalidades),
  ]);
  return (
    novo.cargo === atual.cargo &&
    novo.lotacao === atual.lotacao &&
    novo.cadastro_reserva === atual.cadastro_reserva &&
    [...nomes].every(
      (m) => (novo.modalidades[m] ?? null) === (atual.modalidades[m] ?? null),
    )
  );
}

/** Por que o motivo não serve ("" = serve). */
export function problemaDoMotivo(motivo: string): string {
  const t = motivo.trim();
  if (t.length < MOTIVO_MINIMO)
    return `Diga o motivo da retificação (pelo menos ${MOTIVO_MINIMO} caracteres).`;
  if (t.length > MOTIVO_MAXIMO)
    return `O motivo passa de ${MOTIVO_MAXIMO} caracteres.`;
  return "";
}

/**
 * O quadro inteiro depois da mudança: cada linha vigente com `anterior` = ela mesma, a editada com
 * os dados do rascunho e origem MANUAL, a retirada de fora e a acrescentada no fim, sem `anterior`.
 */
export function aplicarMudanca(
  linhas: readonly LinhaVigente[],
  mudanca: MudancaNoQuadro,
): LinhaParaGravar[] {
  const resultado: LinhaParaGravar[] = [];
  for (const l of linhas) {
    if (mudanca.tipo === "retirar" && mudanca.id === l.id) continue;
    if (mudanca.tipo === "editar" && mudanca.id === l.id)
      resultado.push({
        ...linhaDoRascunho(mudanca.linha),
        anterior: l.id,
        origem: "MANUAL",
      });
    else resultado.push(linhaComoEsta(l));
  }
  if (mudanca.tipo === "acrescentar")
    resultado.push({ ...linhaDoRascunho(mudanca.linha), origem: "MANUAL" });
  return resultado;
}

/** O payload de `salvar_quadro_de_vagas` para a retificação (ou a simulação dela). */
export function quadroRetificado(
  linhas: readonly LinhaVigente[],
  mudanca: MudancaNoQuadro,
  motivo: string,
  errata: string,
  simular = false,
): QuadroRetificado {
  const payload: QuadroRetificado = {
    motivo: motivo.trim(),
    linhas: aplicarMudanca(linhas, mudanca),
  };
  if (errata.trim()) payload.numero_errata = errata.trim().slice(0, 100);
  if (simular) payload.simular = true;
  return payload;
}

/* ── O que muda ─────────────────────────────────────────────────────── */

export type EfeitoNaVaga =
  /** Estava ligada à linha e continua (na linha corrigida). */
  | "continua"
  /** Estava ligada a uma linha e fica sem linha. */
  | "sem-linha"
  /** Não estava ligada à linha e passa a ela (pela regra ou porque a linha é nova). */
  | "passa"
  /** Estava ligada a outra linha e muda (a regra recalculou). */
  | "muda";

export interface VagaQueMuda {
  vaga: string;
  nome: string;
  efeito: EfeitoNaVaga;
  /** "Cargo — Lotação" de antes e de depois (null = sem linha). */
  antes: string | null;
  depois: string | null;
  /** Ligada pela equipe (MANUAL) antes. */
  pelaEquipe: boolean;
}

export interface ResumoDaMudanca {
  antes: LinhaVigente | null;
  depois: LinhaVigente | null;
  vagas: VagaQueMuda[];
}

/**
 * O que muda, comparando o quadro de agora com o simulado: a linha antes e depois e cada vaga da
 * seleção que estava ou vai ficar ligada à linha mudada, ou que mudou de linha por tabela.
 * A linha sucessora de cada linha vigente é a da mesma posição em `aplicarMudanca`.
 */
export function resumoDaMudanca(
  agora: unknown,
  simulado: unknown,
  mudanca: MudancaNoQuadro,
): ResumoDaMudanca {
  const linhasAgora = linhasDoQuadro(agora);
  const linhasDepois = linhasDoQuadro(simulado);
  const gravar = aplicarMudanca(linhasAgora, mudanca);
  // ordem (1, 2, …) na gravação → a linha simulada; id de agora → id simulado.
  const porOrdem = new Map(linhasDepois.map((l) => [l.ordem, l]));
  const sucessora = new Map<string, string>();
  gravar.forEach((l, i) => {
    const nova = porOrdem.get(i + 1);
    if (l.anterior && nova) sucessora.set(l.anterior, nova.id);
  });
  const rotuloAgora = new Map(linhasAgora.map((l) => [l.id, rotuloDaLinha(l)]));
  const rotuloDepois = new Map(
    linhasDepois.map((l) => [l.id, rotuloDaLinha(l)]),
  );

  const alvoAgora = mudanca.tipo === "acrescentar" ? null : mudanca.id;
  const alvoDepois =
    mudanca.tipo === "editar"
      ? (sucessora.get(mudanca.id) ?? null)
      : mudanca.tipo === "acrescentar"
        ? (porOrdem.get(gravar.length)?.id ?? null)
        : null;

  const antes = alvoAgora
    ? (linhasAgora.find((l) => l.id === alvoAgora) ?? null)
    : null;
  const depois = alvoDepois
    ? (linhasDepois.find((l) => l.id === alvoDepois) ?? null)
    : null;

  const vinculosDepois = new Map(
    filaDoQuadro(simulado).vinculos.map((v) => [v.vaga, v]),
  );
  const ligada = (v: VinculoDaVaga | undefined) =>
    v && v.situacao === "CONFIRMADO" ? v.quadro : null;

  const vagas: VagaQueMuda[] = [];
  const vistas = new Set<string>();
  const registrar = (
    vaga: string,
    nome: string,
    pelaEquipe: boolean,
    quadroAntes: string | null,
    quadroDepois: string | null,
  ) => {
    vistas.add(vaga);
    const tocaAlvo =
      (alvoAgora !== null && quadroAntes === alvoAgora) ||
      (alvoDepois !== null && quadroDepois === alvoDepois);
    const mesmaLinha =
      quadroAntes !== null && sucessora.get(quadroAntes) === quadroDepois;
    let efeito: EfeitoNaVaga;
    if (mesmaLinha) {
      if (!tocaAlvo) return; // vaga de outra linha que não mudou
      efeito = "continua";
    } else if (quadroAntes === null && quadroDepois === null) return;
    else if (quadroDepois === null) efeito = "sem-linha";
    else if (quadroDepois === alvoDepois) efeito = "passa";
    else efeito = "muda";
    vagas.push({
      vaga,
      nome,
      efeito,
      antes: quadroAntes ? (rotuloAgora.get(quadroAntes) ?? null) : null,
      depois: quadroDepois ? (rotuloDepois.get(quadroDepois) ?? null) : null,
      pelaEquipe,
    });
  };

  for (const v of filaDoQuadro(agora).vinculos) {
    const d = vinculosDepois.get(v.vaga);
    registrar(v.vaga, v.nome, v.origem === "MANUAL", ligada(v), ligada(d));
  }
  for (const d of vinculosDepois.values())
    if (!vistas.has(d.vaga)) registrar(d.vaga, d.nome, false, null, ligada(d));

  const peso: Record<EfeitoNaVaga, number> = {
    "sem-linha": 0,
    muda: 1,
    passa: 2,
    continua: 3,
  };
  vagas.sort(
    (a, b) =>
      peso[a.efeito] - peso[b.efeito] ||
      a.nome.localeCompare(b.nome, "pt-BR") ||
      a.vaga.localeCompare(b.vaga, "pt-BR", { numeric: true }),
  );
  return { antes, depois, vagas };
}

/** A frase de cada efeito, para a prévia. */
export const TEXTO_DO_EFEITO: Readonly<Record<EfeitoNaVaga, string>> = {
  continua: "Continua nesta linha",
  "sem-linha": "Fica sem linha",
  passa: "Passa a esta linha",
  muda: "Muda de linha",
};
