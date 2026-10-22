import { useState, type ReactNode } from "react";
import {
  cargoCurto,
  gravarPorVagaAberto,
  lerPorVagaAberto,
  ordenarPorVaga,
  resumoPorVaga,
  type AndamentoDaVaga,
  type OrdemPorVaga,
} from "../../lib/avaliacao-documental/andamento-por-vaga.ts";
import { textoDoAndamento } from "../../lib/avaliacao-documental/fila.js";
import { textoDoLote } from "../../lib/avaliacao-documental/tela-da-pre-classificacao.js";

/*
  O resumo do andamento no alto da Fila: a barra do edital (concluídas, em
  análise, pendentes) e, embaixo, o bloco recolhível "Por vaga (N)", fechado
  por padrão e lembrado por usuário (andamento-por-vaga.ts). Aberto, uma
  tabela enxuta: código, cargo curto e lotação, barra, concluídas de N, em
  análise e pendentes (destacadas quando há). Os títulos das colunas
  ordenam; clicar numa vaga filtra a fila (de novo, tira o filtro), o mesmo
  filtro "Vaga" da linha de filtros. Contado com a lista já carregada
  (obter_fila_avaliacao), sem consulta nova.
*/

type Contas = Pick<
  AndamentoDaVaga,
  "lote" | "concluidas" | "em_analise" | "revisao" | "pendentes"
>;

/* A barra: concluídas, em análise e em revisão, na cor de cada uma; o resto é pendente. */
export function BarraDoAndamento({ a }: { a: Contas }) {
  const parte = (n: number) => `${a.lote ? (n / a.lote) * 100 : 0}%`;
  return (
    <span
      className="avd-andamento-barra"
      role="progressbar"
      aria-label="Fichas concluídas"
      aria-valuemin={0}
      aria-valuemax={a.lote}
      aria-valuenow={a.concluidas}
    >
      <span data-parte="concluidas" style={{ width: parte(a.concluidas) }} />
      <span data-parte="em_analise" style={{ width: parte(a.em_analise) }} />
      <span data-parte="revisao" style={{ width: parte(a.revisao) }} />
    </span>
  );
}

function Coluna({
  chave,
  ordem,
  aoOrdenar,
  children,
  titulo,
}: {
  chave: OrdemPorVaga;
  ordem: OrdemPorVaga;
  aoOrdenar: (o: OrdemPorVaga) => void;
  children: ReactNode;
  titulo: string;
}) {
  const ativa = ordem === chave;
  return (
    <th scope="col" aria-sort={ativa ? "descending" : "none"}>
      <button
        type="button"
        className="avd-porvaga-ordenar"
        data-ordenar={chave}
        aria-pressed={ativa}
        title={ativa ? "Voltar à ordem do edital" : titulo}
        onClick={() => aoOrdenar(ativa ? "banco" : chave)}
      >
        {children}
        <span aria-hidden="true">{ativa ? " ▾" : ""}</span>
      </button>
    </th>
  );
}

type Andamento = { total: Contas; vagas: AndamentoDaVaga[] };

export function ResumoDoAndamento({
  andamento,
  lote,
  vaga,
  usuario,
  aoEscolherVaga,
}: {
  andamento: Andamento;
  lote: { pelaRegra: number; porDecisao: number };
  vaga: string;
  usuario?: string | null;
  aoEscolherVaga: (vaga: string) => void;
}) {
  const [aberto, setAberto] = useState(() => lerPorVagaAberto(usuario));
  const [ordem, setOrdem] = useState<OrdemPorVaga>("banco");
  const t = andamento.total;
  const vagas = ordenarPorVaga(andamento.vagas, ordem);
  const escolhida = andamento.vagas.find((v) => v.codigo === vaga);
  const mostrarVagas = andamento.vagas.length > 1 || Boolean(vaga);
  return (
    <section
      className="ui-card avd-andamento"
      aria-label="Andamento da avaliação"
      data-tour="avd-fila-andamento"
    >
      <div className="avd-andamento-total">
        <strong>Edital</strong>
        <span>
          {textoDoAndamento({ ...t, cargo: "" })}
          {lote.pelaRegra || lote.porDecisao ? (
            <span className="ui-texto-secundario">
              {" · "}
              <span data-lote-da-fila>
                {textoDoLote(lote.pelaRegra, lote.porDecisao)}
              </span>
            </span>
          ) : null}
        </span>
        <BarraDoAndamento a={t} />
        {vaga ? (
          <button
            type="button"
            className="avd-porvaga-filtro"
            data-acao="todas-as-vagas"
            title="Mostrar todas as vagas"
            onClick={() => aoEscolherVaga("")}
          >
            Vaga {vaga}
            {escolhida?.cargo ? ` · ${cargoCurto(escolhida.cargo)}` : ""}
            <span aria-hidden="true"> ×</span>
          </button>
        ) : null}
      </div>
      {mostrarVagas ? (
        <details
          className="avd-porvaga"
          data-por-vaga
          open={aberto}
          onToggle={(ev) => {
            const agora = (ev.currentTarget as HTMLDetailsElement).open;
            if (agora === aberto) return;
            setAberto(agora);
            gravarPorVagaAberto(usuario, agora);
          }}
        >
          <summary>
            <strong>Por vaga ({andamento.vagas.length})</strong>
            <span className="ui-texto-secundario" data-resumo-por-vaga>
              {resumoPorVaga(andamento.vagas)}
            </span>
          </summary>
          <div className="ui-tabela-rolagem">
            <table
              className="avd-porvaga-tabela"
              aria-label="Andamento por vaga"
            >
              <thead>
                <tr>
                  <Coluna
                    chave="vaga"
                    ordem={ordem}
                    aoOrdenar={setOrdem}
                    titulo="Ordenar pelo código da vaga"
                  >
                    Vaga
                  </Coluna>
                  <Coluna
                    chave="progresso"
                    ordem={ordem}
                    aoOrdenar={setOrdem}
                    titulo="Menos concluídas primeiro"
                  >
                    Concluídas
                  </Coluna>
                  <th scope="col">Em análise</th>
                  <Coluna
                    chave="pendentes"
                    ordem={ordem}
                    aoOrdenar={setOrdem}
                    titulo="Mais pendentes primeiro"
                  >
                    Pendentes
                  </Coluna>
                </tr>
              </thead>
              <tbody>
                {vagas.map((v) => {
                  const marcada = vaga === v.codigo;
                  const curto = cargoCurto(v.cargo);
                  return (
                    <tr
                      key={v.codigo}
                      data-linha-vaga={v.codigo}
                      data-pendente={v.pendentes > 0 ? "sim" : undefined}
                      data-marcada={marcada ? "sim" : undefined}
                    >
                      <td className="avd-porvaga-vaga">
                        <button
                          type="button"
                          data-vaga={v.codigo}
                          aria-pressed={marcada}
                          title={
                            marcada
                              ? "Mostrar todas as vagas"
                              : `Mostrar só a vaga ${v.codigo}${v.cargo ? ` · ${v.cargo}` : ""}`
                          }
                          onClick={() =>
                            aoEscolherVaga(marcada ? "" : v.codigo)
                          }
                        >
                          <strong>{v.codigo}</strong>
                          <span className="avd-porvaga-cargo">
                            {[curto, v.lotacao].filter(Boolean).join(" · ")}
                          </span>
                        </button>
                      </td>
                      <td className="avd-porvaga-progresso">
                        <BarraDoAndamento a={v} />
                        <span>
                          {v.concluidas} de {v.lote}
                        </span>
                      </td>
                      <td>
                        {v.em_analise}
                        {v.revisao ? (
                          <span className="ui-texto-secundario">
                            {" "}
                            + {v.revisao} rev.
                          </span>
                        ) : null}
                      </td>
                      <td className="avd-porvaga-pendentes">{v.pendentes}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
    </section>
  );
}
