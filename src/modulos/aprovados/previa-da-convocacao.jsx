import { useMemo, useState } from "react";
import { DISTRIBUICOES } from "../../lib/modelo-de-convocacao.js";
import {
  LIMITE_DA_PREVIA,
  lerInteiro,
  ordinalFeminino,
  previaDaConvocacao,
} from "../../lib/configuracao-de-convocacao.js";
import { classes } from "../../ui/index.js";
import { CampoEditavel } from "./partes.jsx";

/*
  "Como fica a ordem de chamada": com N vagas imediatas (a pessoa escolhe), o
  quadro que o modelo dá e quem é chamado em cada posição, do jeito que o
  simulador do MGI desenha. Serve para conferir o modelo contra o edital antes
  de salvar — "o 5º deveria ser PCD" se vê aqui, sem candidato nenhum.

  A conta é a da convocação (`previaDaConvocacao`); aqui só se desenha. Vale
  Para o rascunho do editor e para o modelo escolhido no formulário.

  Diz por qual regra a ordem está saindo: um modelo salvo antes da ordem do MGI
  continua na regra dele, e sem isso a prévia parecia simplesmente errada.
  `acao` é o botão que quem desenha a prévia oferece (no formulário, "Usar a
  ordem do MGI").
*/
export function PreviaDaConvocacao({
  modelo,
  totalInicial = 10,
  id,
  acao = null,
}) {
  const [total, setTotal] = useState(() => lerInteiro(totalInicial) || 10);
  const previa = useMemo(
    () => previaDaConvocacao(total, modelo),
    [total, modelo],
  );
  const campo = `${id}Total`;
  const regra =
    DISTRIBUICOES.find((item) => item.id === modelo.distribuicao) ||
    DISTRIBUICOES[0];

  return (
    <section
      id={id}
      className="convocacao-previa"
      aria-label="Prévia da ordem de chamada"
    >
      <div className="convocacao-previa-topo">
        <strong>Como fica a ordem de chamada</strong>
        <label className="convocacao-previa-total" htmlFor={campo}>
          com
          <CampoEditavel
            id={campo}
            type="number"
            min="0"
            max={LIMITE_DA_PREVIA}
            step="1"
            inputMode="numeric"
            valor={total}
            ler={lerInteiro}
            aoMudar={setTotal}
          />
          vagas imediatas
        </label>
      </div>
      <p
        className="convocacao-previa-regra"
        data-convocacao-previa-regra={regra.id}
      >
        <span>
          Ordem: <strong>{regra.rotulo}</strong>
        </span>
        {acao}
      </p>
      {previa.vagas ? (
        <>
          <p className="convocacao-previa-quadro">
            <span>Divisão das vagas:</span> <strong>{previa.resumo}</strong>
          </p>
          <ul className="convocacao-previa-primeiras">
            {previa.primeiras.map((item) => (
              <li key={item.id}>
                <span className="convocacao-previa-sigla">{item.sigla}</span>{" "}
                {item.posicao
                  ? `1ª vaga na ${ordinalFeminino(item.posicao)} posição`
                  : item.minimo > previa.vagas
                    ? `sem reserva (só com ${item.minimo} vagas ou mais)`
                    : "sem vaga reservada com este total"}
              </li>
            ))}
          </ul>
          <ol className="convocacao-previa-faixa">
            {previa.posicoes.map((item) => (
              <li
                key={item.posicao}
                className={classes(
                  "convocacao-previa-posicao",
                  item.reserva ? `tom-${item.tom % 4}` : "ampla",
                )}
                title={`${ordinalFeminino(item.posicao)} — ${item.rotulo} (${item.noGrupo} de ${item.doGrupo})`}
              >
                <span className="convocacao-previa-numero">
                  {ordinalFeminino(item.posicao)}
                </span>
                <span>{item.sigla}</span>
              </li>
            ))}
          </ol>
        </>
      ) : (
        <p className="convocacao-previa-quadro">
          Informe quantas vagas imediatas para ver a ordem.
        </p>
      )}
    </section>
  );
}
