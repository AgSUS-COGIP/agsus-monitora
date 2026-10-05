import { useMemo, useState } from "react";
import {
  dataComDia,
  diaInicialDaAgenda,
  hojeEmBrasilia,
  itensDoBanco,
  nomeDaBanca,
  ordenarAgenda,
} from "../../lib/agenda-das-entrevistas.js";
import { rotuloDoComparecimento } from "../../lib/entrevistas-do-painel.js";
import { Campo } from "../../ui/index.js";

/*
  "Agenda do dia" em Conduzir entrevistas: a agenda salva do edital (montada
  na Classificação › Agenda), só leitura, por horário — um dia e, se houver
  várias, uma banca de cada vez. A linha de quem já está convocado no sistema
  abre a ficha de notas (a mesma do Passo 3). Sem agenda salva, o cartão não
  aparece.
*/
export function AgendaDoDia({
  dados,
  agenda,
  aoAbrir,
  hoje = hojeEmBrasilia(),
}) {
  const regra = agenda?.regra?.configuracao || null;
  const itens = useMemo(
    () => ordenarAgenda(itensDoBanco(agenda?.itens)),
    [agenda],
  );
  const dias = useMemo(() => [...new Set(itens.map((i) => i.data))], [itens]);
  const bancas = useMemo(
    () => [...new Set(itens.map((i) => i.banca))].sort((a, b) => a - b),
    [itens],
  );
  const [dia, setDia] = useState(() => diaInicialDaAgenda(dias, hoje));
  const [banca, setBanca] = useState("");
  const convocadoPorAnalise = useMemo(
    () =>
      new Map(
        (dados?.convocados || [])
          .filter((c) => c.analise_id)
          .map((c) => [c.analise_id, c]),
      ),
    [dados],
  );
  if (!itens.length) return null;
  const diaEscolhido = dias.includes(dia) ? dia : dias[0];
  const visiveis = itens.filter(
    (i) =>
      i.data === diaEscolhido && (!banca || String(i.banca) === String(banca)),
  );

  return (
    <section
      className="ui-card entrevistas-passo"
      data-passo="agenda"
      data-tour="entrevistas-conduzir-agenda-do-dia"
      aria-labelledby="entrevistasAgendaTitulo"
    >
      <div className="entrevistas-passo-topo">
        <div>
          <h2 className="ui-titulo" id="entrevistasAgendaTitulo">
            Agenda do dia
          </h2>
        </div>
      </div>
      <div className="entrevistas-filtros">
        <Campo rotulo="Dia">
          <select
            data-campo="agenda-dia"
            value={diaEscolhido}
            onChange={(e) => setDia(e.target.value)}
          >
            {dias.map((d) => (
              <option key={d} value={d}>
                {dataComDia(d)}
                {d === hoje ? " · hoje" : ""}
              </option>
            ))}
          </select>
        </Campo>
        {bancas.length > 1 ? (
          <Campo rotulo="Banca">
            <select
              data-campo="agenda-banca"
              value={banca}
              onChange={(e) => setBanca(e.target.value)}
            >
              <option value="">Todas as bancas</option>
              {bancas.map((b) => (
                <option key={b} value={String(b)}>
                  {nomeDaBanca(regra, b)}
                </option>
              ))}
            </select>
          </Campo>
        ) : null}
      </div>
      <div className="entrevistas-tabela-rolagem">
        <table className="entrevistas-tabela" id="entrevistasAgenda">
          <thead>
            <tr>
              <th scope="col">Horário (Brasília)</th>
              <th scope="col">Banca</th>
              <th scope="col">Candidato</th>
              <th scope="col">Vaga / Cargo</th>
              <th scope="col">Compareceu</th>
            </tr>
          </thead>
          <tbody>
            {visiveis.map((i) => {
              const convocado = convocadoPorAnalise.get(i.analiseId);
              const abrir = convocado ? () => aoAbrir(convocado.id) : null;
              return (
                <tr
                  key={i.analiseId}
                  data-candidato={i.analiseId}
                  className={abrir ? "entrevistas-linha" : undefined}
                  tabIndex={abrir ? 0 : undefined}
                  aria-label={abrir ? `Ficha de ${i.nome}` : undefined}
                  onClick={abrir || undefined}
                  onKeyDown={
                    abrir
                      ? (e) => {
                          if (
                            e.target === e.currentTarget &&
                            (e.key === "Enter" || e.key === " ")
                          ) {
                            e.preventDefault();
                            abrir();
                          }
                        }
                      : undefined
                  }
                >
                  <td>
                    {i.inicio}–{i.fim}
                  </td>
                  <td>{nomeDaBanca(regra, i.banca)}</td>
                  <td>
                    <div className="ui-texto-principal">{i.nome}</div>
                  </td>
                  <td>
                    <div className="ui-texto-principal">{i.vaga}</div>
                    <span className="ui-texto-secundario">{i.cargo}</span>
                  </td>
                  <td>
                    {convocado
                      ? rotuloDoComparecimento(convocado.compareceu)
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {!visiveis.length ? (
              <tr>
                <td colSpan={5} className="ui-vazio">
                  Nenhuma entrevista nesta banca no dia.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </section>
  );
}
