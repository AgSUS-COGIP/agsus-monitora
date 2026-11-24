import { useMemo } from "react";
import {
  gruposAteOLimite,
  totalDosGrupos,
} from "../../lib/carga/carga-continua.ts";
import { hojeEmBrasilia } from "../../lib/entrevistas/fila-de-conducao.ts";
import { agendaPorDia } from "../../lib/entrevistas/passos-do-preparar.ts";
import { EstadoVazio, MaisDaCarga, usarCargaContinua } from "../../ui/index.ts";
import { BotaoIrPara } from "./conducao.tsx";
import type { DadosDoEdital, EstadoDaConducao } from "./tipos.ts";

const contarLinhas = (dia: { linhas: readonly unknown[] }) => dia.linhas.length;

/**
 * A agenda dos convocados do edital, por dia, só leitura (montada na
 * Classificação › Agenda). No passo 4 de Preparar e na Central de
 * convocações (Lista de aprovados › Convocação › Para entrevistas, por
 * `convocacao-para-leitura.tsx`). `editar` é o texto do botão que abre a
 * Agenda da Classificação; `null` esconde (quem não vê a Classificação).
 */
export function AgendaDoEdital({
  e,
  dados,
  editar,
}: {
  e: Pick<EstadoDaConducao, "agenda">;
  dados: Pick<DadosDoEdital, "edital" | "convocados">;
  editar?: string | null;
}) {
  const { dias, semHorario } = useMemo(
    () => agendaPorDia(e.agenda, dados.convocados, hojeEmBrasilia()),
    [e.agenda, dados.convocados],
  );
  // 50 horários por vez, mais 50 ao rolar: o edital grande tem milhares.
  const total = useMemo(() => totalDosGrupos(dias, contarLinhas), [dias]);
  const carga = usarCargaContinua(dias, total);
  const visiveis = useMemo(
    () =>
      gruposAteOLimite(dias, carga.limite, {
        contar: contarLinhas,
        cortar: (d, quantos) => ({ ...d, linhas: d.linhas.slice(0, quantos) }),
      }).grupos,
    [dias, carga.limite],
  );
  const noDia = useMemo(
    () => new Map(dias.map((d) => [d.data, d.linhas.length])),
    [dias],
  );
  return (
    <div className="entrevistas-agenda-do-edital" data-bloco="agenda">
      {dias.length ? (
        visiveis.map((d) => (
          <section key={d.data} className="entrevistas-agenda-dia-bloco">
            <h4>
              {d.rotulo} <small>{noDia.get(d.data)}</small>
            </h4>
            <div className="entrevistas-tabela-rolagem">
              <table className="entrevistas-tabela entrevistas-tabela-curta">
                <thead>
                  <tr>
                    <th scope="col">Horário</th>
                    <th scope="col">Candidato</th>
                    <th scope="col">Vaga</th>
                    <th scope="col">Banca</th>
                  </tr>
                </thead>
                <tbody>
                  {d.linhas.map((l) => (
                    <tr key={l.id}>
                      <td>
                        {l.inicio}
                        {l.fim ? `–${l.fim}` : ""}
                      </td>
                      <td>
                        <span className="ui-texto-principal">{l.nome}</span>
                        {l.codigo ? (
                          <span className="ui-texto-secundario">
                            Cód. {l.codigo}
                          </span>
                        ) : null}
                      </td>
                      <td>{l.vaga || "—"}</td>
                      <td>{l.banca ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))
      ) : (
        <EstadoVazio>Nenhum horário salvo para este edital.</EstadoVazio>
      )}
      <MaisDaCarga carga={carga} oQue="horários" />
      {dias.length && semHorario.length ? (
        <p className="entrevistas-vazio-linha">
          Sem horário: {semHorario.map((c) => c.candidato).join(", ")}.
        </p>
      ) : null}
      {editar !== null ? (
        <div className="entrevistas-acoes">
          <BotaoIrPara
            view="classificacao"
            edital={dados.edital}
            visao="agenda"
          >
            <i className="fa-solid fa-calendar-days" aria-hidden="true" />{" "}
            {editar ??
              (dias.length
                ? "Editar a agenda na Classificação"
                : "Montar a agenda na Classificação")}
          </BotaoIrPara>
        </div>
      ) : null}
    </div>
  );
}
