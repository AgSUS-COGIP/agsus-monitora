/* Item da ficha: o resumo da pontuação e as justificativas (API pública em ../item-da-ficha.tsx). */

import {
  decidePelaNota,
  divergenciaDoBloco,
  marcouOutroMotivo,
  pontuacaoAcimaDoComprovado,
  textoDaNota,
} from "../../../../lib/avaliacao-documental/ficha.ts";
import {
  apuradoDoBloco,
  declaradoDoBloco,
} from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import type { Escolha } from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import { justificativasDoBloco } from "../../../../lib/avaliacao-documental/justificativas-do-bloco.ts";
import {
  justificativaDoBloco,
  TAMANHO_DA_JUSTIFICATIVA,
} from "../../../../lib/avaliacao-documental/justificativa-dos-itens.ts";
import type {
  BlocoComItens,
  RetratoDaFicha,
} from "../../../../lib/avaliacao-documental/justificativa-dos-itens.ts";
import { tetoDoBloco } from "../../../../lib/avaliacao-documental/pontuacao.ts";
import {
  comOutroMotivo,
  MotivoEscrito,
  OPCAO_OUTRO_MOTIVO,
} from "../observacao-do-item.tsx";
import type {
  Bloco,
  EstadoDaFicha,
  Lancado,
  Lancamento,
  Mudar,
  Opcao,
} from "../tipos.ts";
import { BLOCOS_COM_ITENS, PARCIAL_DO_TIPO, alterarBloco } from "./escolha.ts";
import { Chips } from "./escolhas.tsx";

/* ── O resumo: "Pontuação: X de 5 · declarou 5" ───────────────────────── */

export function Resultado({
  st,
  bloco,
  lancado,
  escolha,
  mudar,
  desabilitado,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  escolha: Escolha;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const { lancamento, avaliacao, declarada } = st;
  const parcial = PARCIAL_DO_TIPO[bloco.tipo] ?? "";
  const calculado = avaliacao.calculados?.[parcial] ?? 0;
  const decl = declaradoDoBloco(bloco, declarada);
  const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
  const ajuste =
    typeof lancado.nota_ajustada === "number" ? lancado.nota_ajustada : null;
  // O que a conta dá (o efeito do bloco vale); no Editar, o ajuste por cima.
  const valor =
    escolha === "EDITAR"
      ? (ajuste ?? apuradoDoBloco({ bloco, lancamento, calculado }).valor)
      : (avaliacao.parciais?.[parcial] ?? 0);
  const diferenca = decl !== null ? valor - decl : null;
  const temDiferenca = diferenca !== null && Math.abs(diferenca) >= 0.005;
  const editar = escolha === "EDITAR";
  const definir = (v: number | null) => {
    const limitado =
      v === null ? null : Math.max(0, teto !== null ? Math.min(teto, v) : v);
    alterarBloco(mudar, bloco.codigo, { nota_ajustada: limitado });
  };
  const idDoValor = `avdPontuacao-${bloco.codigo}`;
  return (
    <div
      className="avd-ficha-resultado"
      data-tour="avd-ficha-nota"
      data-diferenca={
        !temDiferenca ? "nenhuma" : (diferenca ?? 0) < 0 ? "menor" : "maior"
      }
    >
      <span className="avd-ficha-resultado-rotulo" id={idDoValor}>
        Pontuação:
      </span>
      {editar ? (
        <span className="avd-ficha-passador">
          <button
            type="button"
            aria-label="Diminuir meio ponto"
            disabled={desabilitado || valor <= 0}
            onClick={() => definir(valor - 0.5)}
          >
            −
          </button>
          <input
            type="number"
            min="0"
            max={teto ?? undefined}
            step="0.5"
            inputMode="decimal"
            aria-labelledby={idDoValor}
            value={valor}
            disabled={desabilitado}
            onChange={(ev) =>
              definir(ev.target.value === "" ? null : Number(ev.target.value))
            }
          />
          <button
            type="button"
            aria-label="Aumentar meio ponto"
            disabled={desabilitado || (teto !== null && valor >= teto)}
            onClick={() => definir(valor + 0.5)}
          >
            +
          </button>
        </span>
      ) : (
        <strong className="avd-ficha-resultado-valor">
          {textoDaNota(valor)}
        </strong>
      )}
      {teto !== null ? (
        <span className="avd-ficha-resultado-teto">de {textoDaNota(teto)}</span>
      ) : null}
      {decl !== null ? (
        <span className="avd-ficha-resultado-declarado">
          · declarou {textoDaNota(decl)}
        </span>
      ) : null}
      {temDiferenca ? (
        <span className="avd-ficha-resultado-diferenca">
          {(diferenca ?? 0) > 0 ? "+" : "−"}
          {textoDaNota(Math.abs(diferenca ?? 0))}
        </span>
      ) : null}
      {editar &&
      ajuste !== null &&
      ajuste !== calculado &&
      !desabilitado &&
      !decidePelaNota(bloco, lancamento) ? (
        <button
          type="button"
          className="avd-ficha-link"
          onClick={() =>
            alterarBloco(mudar, bloco.codigo, { nota_ajustada: null })
          }
        >
          Usar o calculado ({textoDaNota(calculado)})
        </button>
      ) : null}
    </div>
  );
}

/* O resumo dos itens do bloco e se o item pede a justificativa. */
export const justificativaDosItens = (st: EstadoDaFicha, bloco: Bloco) =>
  justificativaDoBloco(
    st as unknown as RetratoDaFicha,
    bloco as unknown as BlocoComItens,
    st.dados.leituras,
  );

/*
  "Justificativa do ajuste": o resumo dos itens aceitos e dos não pontuados,
  já preenchido no campo justificativa_livre (estado-da-ficha.ts) e editável;
  o texto entra no parecer. Quando o texto não é o resumo atual (editado, ou
  os itens mudaram depois de editar), "Usar o resumo dos itens" volta a ele.
*/
export function JustificativaDoAjuste({
  st,
  bloco,
  lancado,
  mudar,
  desabilitado,
  rotulo = "Justificativa do ajuste",
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
  rotulo?: string;
}) {
  const { texto: resumo } = justificativaDosItens(st, bloco);
  const valor = lancado.justificativa_livre || "";
  const id = `avdJustificativaDoAjuste-${bloco.codigo}`;
  return (
    <div
      className="avd-ficha-justificativa-do-ajuste"
      data-tour="avd-ficha-justificativa-do-ajuste"
    >
      <div className="avd-ficha-justificativa-do-ajuste-topo">
        <label className="avd-ficha-rotulo" htmlFor={id}>
          {rotulo}
        </label>
        {resumo && valor !== resumo && !desabilitado ? (
          <button
            type="button"
            className="avd-ficha-link"
            onClick={() =>
              alterarBloco(mudar, bloco.codigo, { justificativa_livre: resumo })
            }
          >
            Usar o resumo dos itens
          </button>
        ) : null}
      </div>
      <textarea
        id={id}
        rows={3}
        value={valor}
        maxLength={TAMANHO_DA_JUSTIFICATIVA}
        disabled={desabilitado}
        onChange={(ev) =>
          alterarBloco(mudar, bloco.codigo, {
            // Uma linha só: o parecer lista uma observação por linha.
            justificativa_livre: ev.target.value.replace(/\s*\n\s*/g, " "),
          })
        }
      />
    </div>
  );
}

/* A justificativa da pontuação diferente da declarada (uma só área). */
export function Justificativa({
  st,
  bloco,
  lancado,
  mudar,
  desabilitado,
  textoNoRodape = false,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
  /** Pelos itens: a "Justificativa do ajuste" fica no rodapé da decisão. */
  textoNoRodape?: boolean;
}) {
  const regra = st.dados.regra.configuracao;
  const divergencia = divergenciaDoBloco(bloco, st.avaliacao, st.declarada) as {
    diferenca: number;
  } | null;
  const marcadas = lancado.justificativas || [];
  // Editar nota acima do que os itens aceitos dão: a justificativa é o
  // caminho (pendência "acima" em pendenciasDaFicha), mesmo na declarada.
  const acima =
    lancado.edita_nota === true &&
    pontuacaoAcimaDoComprovado(bloco, st.lancamento, st.avaliacao) !== null;
  // Bloco com itens: o texto é a "Justificativa do ajuste" (resumo dos itens).
  const comItens = Boolean(BLOCOS_COM_ITENS[bloco.tipo]);
  const comTexto =
    Boolean(lancado.justificativa_livre) ||
    (comItens && justificativaDosItens(st, bloco).precisa);
  if (lancado.situacao !== "CONFORME") return null;
  if (
    !divergencia &&
    !acima &&
    !marcadas.length &&
    (!comTexto || (comItens && textoNoRodape))
  )
    return null;
  const { doBloco, outras } = justificativasDoBloco(regra, bloco);
  const opcoes: Opcao[] = [...doBloco, ...outras];
  const outraMarcada = outras.some((o) => marcadas.includes(o.codigo));
  const rotulo =
    divergencia && divergencia.diferenca < 0
      ? "Por que a pontuação é menor que a declarada?"
      : acima
        ? "Por que a pontuação é maior que a comprovada pelos vínculos?"
        : "Justificativa da pontuação";
  const mudarJustificativas = (justificativas: string[]) =>
    alterarBloco(
      mudar,
      bloco.codigo,
      comOutroMotivo("justificativas", justificativas, lancado),
    );
  return (
    <div
      className="avd-ficha-justificativa"
      data-tour="avd-ficha-justificativa"
    >
      {opcoes.length ? (
        <Chips
          rotulo={rotulo}
          opcoes={[...doBloco, OPCAO_OUTRO_MOTIVO]}
          marcados={marcadas}
          desabilitado={desabilitado}
          aoMudar={mudarJustificativas}
        />
      ) : null}
      {marcouOutroMotivo(marcadas) ? (
        <MotivoEscrito
          codigo={bloco.codigo}
          lancado={lancado}
          desabilitado={desabilitado}
          aoMudar={(campos) => alterarBloco(mudar, bloco.codigo, campos)}
        />
      ) : null}
      {outras.length ? (
        <details
          className="avd-ficha-outras-justificativas"
          open={outraMarcada || !doBloco.length || undefined}
        >
          <summary>Outras justificativas ({outras.length})</summary>
          <Chips
            rotulo="Outras justificativas"
            rotuloOculto
            opcoes={outras}
            marcados={marcadas}
            desabilitado={desabilitado}
            aoMudar={mudarJustificativas}
          />
        </details>
      ) : null}
      {comItens ? (
        textoNoRodape ? null : (
          <JustificativaDoAjuste
            st={st}
            bloco={bloco}
            lancado={lancado}
            mudar={mudar}
            desabilitado={desabilitado}
            rotulo={
              opcoes.length || !divergencia
                ? "Justificativa do ajuste"
                : "Justificativa do ajuste (10 caracteres ou mais)"
            }
          />
        )
      ) : opcoes.length ? null : (
        // Sem justificativas na regra, o texto é a justificativa (o comentário
        // à parte vai na Observação do avaliador, no fim do card).
        <label className="avd-ficha-campo">
          <span className="avd-ficha-rotulo">
            {rotulo} (10 caracteres ou mais)
          </span>
          <input
            value={lancado.justificativa_livre || ""}
            maxLength={TAMANHO_DA_JUSTIFICATIVA}
            disabled={desabilitado}
            onChange={(ev) =>
              alterarBloco(mudar, bloco.codigo, {
                justificativa_livre: ev.target.value,
              })
            }
          />
        </label>
      )}
    </div>
  );
}

export function Etnico({
  lancamento,
  mudar,
  desabilitado,
}: {
  lancamento: Lancamento;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const caixa = (
    campo: "indigena" | "mora_aldeia" | "aldeia_na_lista",
    rotulo: string,
  ) => (
    <label className="avd-ficha-opcao">
      <input
        type="checkbox"
        checked={Boolean(lancamento[campo])}
        disabled={desabilitado}
        onChange={(ev) =>
          mudar((l) => {
            l[campo] = ev.target.checked;
            return l;
          })
        }
      />{" "}
      {rotulo}
    </label>
  );
  return (
    <div className="avd-ficha-etnico">
      {caixa("indigena", "Indígena")}
      {caixa("mora_aldeia", "Mora em aldeia")}
      {caixa("aldeia_na_lista", "Aldeia na lista do DSEI")}
    </div>
  );
}
