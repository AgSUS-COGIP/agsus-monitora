/* Item da ficha: pelos itens, o rodapé da decisão (API pública em ../item-da-ficha.tsx). */

import { textoDaNota } from "../../../../lib/avaliacao-documental/ficha.ts";
import { declaradoDoBloco } from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import type { Escolha } from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  comprovadoDaExperiencia,
  diasEmComum,
} from "../../../../lib/avaliacao-documental/comprovado-da-ficha.ts";
import { tetoDoBloco } from "../../../../lib/avaliacao-documental/pontuacao.ts";
import type { Bloco, EstadoDaFicha, Lancado, Mudar } from "../tipos.ts";
import { JustificativaDoAjuste, justificativaDosItens } from "./resultado.tsx";

/* ── Pelos itens: o rodapé da decisão ─────────────────────────────────── */

const milBr = (n: number) => n.toLocaleString("pt-BR");

/*
  "Pontuação pelos itens aceitos: X de 10 · declarou 10" e, na Experiência,
  o tempo já unido ("Comprovado: … · 1.160 dias") com os dias em comum entre
  vínculos (contam uma vez, sem alerta). Confirmar · Não confere e o "Editar
  nota" discreto, só para o ajuste fino. As teclas 1, 2 e 3 ficam na dica.
  Confirmado, embaixo, a "Justificativa do ajuste" quando o item precisa
  (pontuação diferente da declarada ou item não pontuado) ou já tem texto.
*/
export function DecisaoPelosItens({
  st,
  bloco,
  lancado,
  escolha,
  calculado,
  desabilitado,
  mudar,
  aoEscolher,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  escolha: Escolha | null;
  calculado: number;
  desabilitado: boolean;
  mudar: Mudar;
  aoEscolher: (escolha: Escolha) => void;
}) {
  const { lancamento } = st;
  const decl = declaradoDoBloco(bloco, st.declarada);
  const teto = tetoDoBloco(bloco, lancamento.nivel) as number | null;
  const diferenca = decl !== null ? calculado - decl : null;
  const temDiferenca = diferenca !== null && Math.abs(diferenca) >= 0.005;
  const confirmado = escolha === "CONFERE" || escolha === "EDITAR";
  const mostraJustificativa =
    confirmado &&
    lancado.situacao === "CONFORME" &&
    (Boolean(lancado.justificativa_livre) ||
      justificativaDosItens(st, bloco).precisa);
  const idDoResumo = `avdPelosItens-${bloco.codigo}`;
  let tempo: { texto: string; dias: number; comum: number } | null = null;
  if (bloco.tipo === "VINCULOS") {
    const exp = st.avaliacao.experiencia;
    tempo = {
      texto: comprovadoDaExperiencia(
        bloco as Parameters<typeof comprovadoDaExperiencia>[0],
        exp,
        lancamento.nivel,
      ).texto,
      dias: exp?.dias_total ?? 0,
      comum: diasEmComum(
        bloco as Parameters<typeof diasEmComum>[0],
        lancamento.vinculos as Parameters<typeof diasEmComum>[1],
      ),
    };
  }
  return (
    <div
      className="avd-ficha-pelos-itens"
      data-tour="avd-ficha-decisoes"
      data-diferenca={
        !temDiferenca ? "nenhuma" : (diferenca ?? 0) < 0 ? "menor" : "maior"
      }
    >
      <p className="avd-ficha-pelos-itens-resumo" id={idDoResumo}>
        <span className="avd-ficha-resultado-rotulo">
          Pontuação pelos itens aceitos:
        </span>{" "}
        <strong className="avd-ficha-resultado-valor">
          {textoDaNota(calculado)}
        </strong>
        {teto !== null ? (
          <span className="avd-ficha-resultado-teto">
            {" "}
            de {textoDaNota(teto)}
          </span>
        ) : null}
        {decl !== null ? (
          <span className="avd-ficha-resultado-declarado">
            {" "}
            · declarou {textoDaNota(decl)}
          </span>
        ) : null}
        {temDiferenca ? (
          <span className="avd-ficha-resultado-diferenca">
            {(diferenca ?? 0) > 0 ? "+" : "−"}
            {textoDaNota(Math.abs(diferenca ?? 0))}
          </span>
        ) : null}
      </p>
      {tempo ? (
        <p className="avd-ficha-pelos-itens-tempo">
          {tempo.texto}
          {tempo.dias ? ` · ${milBr(tempo.dias)} dias` : ""}
          {tempo.comum > 0 ? (
            <span className="avd-ficha-pelos-itens-comum">
              {" "}
              · {milBr(tempo.comum)}{" "}
              {tempo.comum === 1 ? "dia em comum" : "dias em comum"} entre
              vínculos {tempo.comum === 1 ? "conta" : "contam"} uma vez
            </span>
          ) : null}
        </p>
      ) : null}
      <div
        className="avd-ficha-pelos-itens-acoes"
        role="group"
        aria-labelledby={idDoResumo}
      >
        <button
          type="button"
          className="avd-ficha-decisao"
          data-valor="CONFERE"
          data-acao="confirmar-pelos-itens"
          aria-pressed={confirmado}
          aria-keyshortcuts="1"
          title={
            temDiferenca
              ? "Confirmar a pontuação dos itens aceitos (diferente do declarado: pede a justificativa) — tecla 1"
              : "Confirmar a pontuação dos itens aceitos — tecla 1"
          }
          disabled={desabilitado}
          onClick={() => aoEscolher("CONFERE")}
        >
          <span className="avd-ficha-decisao-icone" aria-hidden="true">
            <i className="fa-solid fa-check" />
          </span>
          <span className="avd-ficha-decisao-rotulo">
            {confirmado ? "Confirmado" : "Confirmar"}
          </span>
        </button>
        <button
          type="button"
          className="avd-ficha-decisao"
          data-valor="NAO_CONFERE"
          aria-pressed={escolha === "NAO_CONFERE"}
          aria-keyshortcuts="2"
          title="Não confere (o documento não comprova) — tecla 2"
          disabled={desabilitado}
          onClick={() => aoEscolher("NAO_CONFERE")}
        >
          <span className="avd-ficha-decisao-icone" aria-hidden="true">
            <i className="fa-solid fa-xmark" />
          </span>
          <span className="avd-ficha-decisao-rotulo">Não confere</span>
        </button>
        {!desabilitado ? (
          <button
            type="button"
            className="avd-ficha-link avd-ficha-ajuste-fino"
            data-valor="EDITAR"
            aria-pressed={escolha === "EDITAR"}
            aria-keyshortcuts="3"
            title="Ajuste fino da pontuação, com justificativa — tecla 3"
            onClick={() => aoEscolher("EDITAR")}
          >
            <i className="fa-solid fa-pen" aria-hidden="true" /> Editar nota
          </button>
        ) : null}
      </div>
      {mostraJustificativa ? (
        <JustificativaDoAjuste
          st={st}
          bloco={bloco}
          lancado={lancado}
          mudar={mudar}
          desabilitado={desabilitado}
        />
      ) : null}
    </div>
  );
}
