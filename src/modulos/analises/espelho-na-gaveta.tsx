import type { EspelhoNoPainel } from "../../lib/espelho-do-painel-de-analises.ts";
import { COLUNAS_DOS_CRITERIOS } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import { GradeDeKv, Kv, Secao } from "../../ui/index.js";

/*
  A nota da análise pelo espelho de nota (linha publicada pela ficha concluída
  da Avaliação documental): autodeclarada × consolidada e, por critério,
  Declarada / Após análise / Teto, com as justificativas do critério que
  mudou; no eliminado, só a consolidada ("Não se aplica…") e os motivos. Os
  números e textos são os do espelho (espelho-do-painel-de-analises.ts).
*/
export function EspelhoNaGaveta({ espelho }: { espelho: EspelhoNoPainel }) {
  const [rotuloDoCriterio, ...colunasDeNumero] = COLUNAS_DOS_CRITERIOS;
  return (
    <Secao
      icone="fa-scale-balanced"
      titulo="Nota antes e após a análise"
      secao="espelho"
    >
      <GradeDeKv rotulo="Notas">
        {espelho.notas.map((nota) => (
          <Kv key={nota.rotulo} rotulo={nota.rotulo}>
            {nota.valor}
          </Kv>
        ))}
      </GradeDeKv>
      {espelho.criterios.length ? (
        <table
          className="ui-tabela-compacta"
          aria-label="Pontuação por critério"
        >
          <thead>
            <tr>
              <th scope="col">{rotuloDoCriterio}</th>
              {colunasDeNumero.map((coluna) => (
                <th key={coluna} scope="col" data-numero>
                  {coluna}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {espelho.criterios.flatMap((criterio) => [
              <tr
                key={criterio.rotulo}
                data-mudou={criterio.mudou || undefined}
              >
                <td>{criterio.rotulo}</td>
                <td data-numero>{criterio.declarada}</td>
                <td data-numero>{criterio.apurada}</td>
                <td data-numero>{criterio.teto}</td>
              </tr>,
              ...(criterio.justificativas.length
                ? [
                    <tr key={`${criterio.rotulo}:nota`} data-nota>
                      <td colSpan={4}>
                        <ul>
                          {criterio.justificativas.map((justificativa) => (
                            <li key={justificativa}>{justificativa}</li>
                          ))}
                        </ul>
                      </td>
                    </tr>,
                  ]
                : []),
            ])}
          </tbody>
        </table>
      ) : null}
      {espelho.motivos.length ? (
        <ul className="ui-lista-de-motivos" aria-label="Motivos da eliminação">
          {espelho.motivos.map((motivo) => (
            <li key={motivo}>{motivo}</li>
          ))}
        </ul>
      ) : null}
    </Secao>
  );
}
