import { useId, useState, useSyncExternalStore } from "react";
import { Aviso, Carregando, Gaveta } from "../../ui/index.ts";
import { nomeDaArea } from "../../lib/navegacao/menu-lateral.ts";
import { definicaoDoRelatorio } from "../../lib/relatorios-dos-paineis.ts";
import type { ColunaComFonte } from "../../lib/fontes-dos-paineis.ts";
import type { EstadoDaTelaDePaineis, TrocaPedida } from "./estado.ts";

/*
  A gaveta "Fontes dos dados" (migration 20261113220000): para o relatório
  aberto e a área do menu, cada coluna editável com a fonte em uso e, para o
  Administrador em Painéis, a troca — Origem (o padrão ou uma visão conferida
  do schema painel) e Coluna (as compatíveis), com motivo, ou Voltar ao
  padrão. Cada coluna salva sozinha (uma troca = uma linha no histórico). As
  opções vêm do banco; a tela só manda o nome escolhido, e o banco confere de
  novo.
*/

const HORA = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** A fonte em uso de uma coluna, como a tela escreve. */
export function textoDaFonteEmUso(coluna: ColunaComFonte): string {
  const escolha = coluna.escolha;
  if (!escolha) return coluna.padrao;
  const opcao = coluna.opcoes.find((o) => o.visao === escolha.visao);
  const campo = opcao?.colunas.find((c) => c.coluna === escolha.coluna);
  return opcao && campo
    ? `${opcao.rotulo} › ${campo.rotulo}`
    : `${escolha.visao} › ${escolha.coluna} (indisponível)`;
}

interface PropriedadesDaLinha {
  coluna: ColunaComFonte;
  podeEditar: boolean;
  salvando: string | null;
  aoSalvar: (troca: TrocaPedida) => void;
}

function LinhaDaColuna({
  coluna,
  podeEditar,
  salvando,
  aoSalvar,
}: PropriedadesDaLinha) {
  const id = useId();
  const [visao, setVisao] = useState(coluna.escolha?.visao ?? "");
  const [colunaDaVisao, setColunaDaVisao] = useState(
    coluna.escolha?.coluna ?? "",
  );
  const [motivo, setMotivo] = useState("");
  const opcao = coluna.opcoes.find((o) => o.visao === visao) ?? null;
  const mudou = visao
    ? visao !== coluna.escolha?.visao ||
      colunaDaVisao !== coluna.escolha?.coluna
    : coluna.escolha !== null;
  const ocupado = salvando !== null;

  return (
    <section className="ui-secao" data-coluna={coluna.coluna}>
      <h3>{coluna.rotulo}</h3>
      <p>
        Fonte em uso: <strong>{textoDaFonteEmUso(coluna)}</strong>
      </p>
      {podeEditar ? (
        <>
          <div className="ui-campo">
            <label htmlFor={`${id}-origem`}>Origem</label>
            <select
              id={`${id}-origem`}
              aria-label={`Origem — ${coluna.rotulo}`}
              value={visao}
              disabled={ocupado}
              onChange={(evento) => {
                const nova = evento.target.value;
                setVisao(nova);
                setColunaDaVisao(
                  coluna.opcoes.find((o) => o.visao === nova)?.colunas[0]
                    ?.coluna ?? "",
                );
              }}
            >
              <option value="">{coluna.padrao}</option>
              {coluna.opcoes.map((o) => (
                <option key={o.visao} value={o.visao}>
                  {o.rotulo}
                </option>
              ))}
            </select>
          </div>
          <div className="ui-campo">
            <label htmlFor={`${id}-coluna`}>Coluna</label>
            <select
              id={`${id}-coluna`}
              aria-label={`Coluna — ${coluna.rotulo}`}
              value={colunaDaVisao}
              disabled={ocupado || !opcao}
              onChange={(evento) => setColunaDaVisao(evento.target.value)}
            >
              {opcao ? (
                opcao.colunas.map((c) => (
                  <option key={c.coluna} value={c.coluna}>
                    {c.rotulo}
                  </option>
                ))
              ) : (
                <option value="">—</option>
              )}
            </select>
          </div>
          <div className="ui-campo">
            <label htmlFor={`${id}-motivo`}>Motivo da troca</label>
            <input
              id={`${id}-motivo`}
              aria-label={`Motivo — ${coluna.rotulo}`}
              value={motivo}
              maxLength={500}
              disabled={ocupado}
              onChange={(evento) => setMotivo(evento.target.value)}
            />
          </div>
          <div className="ui-acoes">
            <button
              type="button"
              className="btn primary small"
              disabled={ocupado || !mudou || Boolean(visao && !colunaDaVisao)}
              onClick={() =>
                aoSalvar({
                  coluna: coluna.coluna,
                  visao: visao || null,
                  colunaDaVisao: visao ? colunaDaVisao : null,
                  motivo,
                })
              }
            >
              {salvando === coluna.coluna ? "Salvando…" : "Salvar"}
            </button>
            {coluna.escolha ? (
              <button
                type="button"
                className="btn secondary small"
                disabled={ocupado}
                onClick={() =>
                  aoSalvar({
                    coluna: coluna.coluna,
                    visao: null,
                    colunaDaVisao: null,
                    motivo,
                  })
                }
              >
                Voltar ao padrão
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}

export function GavetaDeFontes({ estado }: { estado: EstadoDaTelaDePaineis }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const tituloId = useId();
  const { gaveta } = e;
  if (!gaveta.aberta) return null;
  const definicao = definicaoDoRelatorio(e.ativo);
  const dados = gaveta.dados;
  const algumaForaDoPadrao = Boolean(dados?.colunas.some((c) => c.escolha));

  return (
    <Gaveta
      tituloId={tituloId}
      aoFechar={() => estado.fecharFontes()}
      sobretitulo={`${definicao.rotulo} · ${nomeDaArea(e.area) || e.area}`}
      titulo="Fontes dos dados"
    >
      {gaveta.situacao === "carregando" ? <Carregando /> : null}
      {gaveta.situacao === "erro" ? (
        <Aviso tom="danger" papel="alert">
          {gaveta.erro}
        </Aviso>
      ) : null}
      {gaveta.erroAoSalvar ? (
        <Aviso tom="danger" papel="alert">
          {gaveta.erroAoSalvar}
        </Aviso>
      ) : null}
      {dados ? (
        <>
          {algumaForaDoPadrao ? (
            <Aviso tom="info">
              Com fonte diferente do padrão, os totais entre os relatórios podem
              não fechar.
            </Aviso>
          ) : null}
          {dados.colunas.map((coluna) => (
            <LinhaDaColuna
              key={`${coluna.coluna}:${coluna.escolha?.visao ?? ""}:${coluna.escolha?.coluna ?? ""}`}
              coluna={coluna}
              podeEditar={dados.podeEditar}
              salvando={gaveta.salvando}
              aoSalvar={(troca) => void estado.salvarFonte(troca)}
            />
          ))}
          {dados.historico.length ? (
            <section className="ui-secao">
              <h3>Histórico</h3>
              <ul>
                {dados.historico.map((h) => (
                  <li key={`${h.em}:${h.coluna}`}>
                    {HORA.format(new Date(h.em))} · {h.nome} · {h.coluna}:{" "}
                    {h.antes} → {h.depois} · “{h.motivo}”
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </Gaveta>
  );
}
