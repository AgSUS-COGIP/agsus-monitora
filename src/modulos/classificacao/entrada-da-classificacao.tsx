import { useMemo, useState } from "react";
import { formatNumberBR } from "../../lib/base/formatters";
import { rotuloDaVersao } from "../../lib/base/nome-da-versao.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { usarAreaAtual } from "../../componentes/usar-area-atual.ts";
import {
  comSituacaoDoMonitoramento,
  editalDoHistorico,
  situacaoDoEdital,
  tomDaSituacaoDoEdital,
} from "../../lib/editais/editais-ativos.ts";
import {
  AtivosEHistorico,
  Selo,
  usarAtivosEHistorico,
} from "../../ui/index.ts";
import type { EditalDaClassificacao } from "./tipos-do-estado.ts";

/*
  A Classificação sem edital escolhido: a busca grande e a grade de cards dos
  editais da área (os que têm análises: listar_editais_classificacao). Cada
  card mostra o número e a unidade, quantos candidatos, a versão da regra da
  Classificação (ou "Sem regra") e o selo de treinamento; clicar abre o
  edital. Os ativos (vigentes) ficam separados do Histórico, com a contagem
  por situação; o status vem das linhas do monitoramento (a lista da
  Classificação não o traz). A busca recorta os cards da vista pelo número
  ou pela unidade.

  Enquanto as linhas do monitoramento não chegam, os cards esperam no
  esqueleto: sem elas todo edital seria "Sem situação" nos Ativos e, ao
  chegarem, metade pularia para o Histórico (as abas piscavam: "Ativos 22",
  depois 9 e 13). Se a leitura delas falhar, a lista abre assim mesmo.

  Só o que a lista dos editais traz: etapa, progresso e prazos não estão
  nela (ficam dentro do edital), então o card não os mostra.
*/

const semAcento = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function EntradaDaClassificacao({
  editais: daLista,
  carregado,
  aoAbrir,
}: {
  editais: readonly EditalDaClassificacao[];
  carregado: boolean;
  aoAbrir: (id: string) => void;
}) {
  const monitoramento = usarAreaAtual();
  const { area, linhas } = monitoramento;
  const pronto =
    carregado && (monitoramento.carregado || Boolean(monitoramento.erro));
  const comSituacao = useMemo(
    () => comSituacaoDoMonitoramento(daLista, linhas),
    [daLista, linhas],
  );
  const { visiveis: editais, controle } = usarAtivosEHistorico(comSituacao, {
    chave: `yeende:classificacao:vista:${area}`,
    ehHistorico: editalDoHistorico,
    situacao: situacaoDoEdital,
  });
  const [busca, setBusca] = useState("");
  const termo = semAcento(busca.trim());
  const lista = useMemo(
    () =>
      termo
        ? editais.filter((ed) =>
            semAcento(`${ed.edital ?? ""} ${ed.unidade ?? ""}`).includes(termo),
          )
        : editais,
    [editais, termo],
  );
  return (
    <section
      className="classificacao-entrada"
      aria-label="Editais da área"
      data-tour="classificacao-entrada"
    >
      <label className="ui-barra-busca classificacao-entrada-busca">
        <i className="fa-solid fa-magnifying-glass" aria-hidden="true" />
        <span className="sr-only">Encontrar o edital</span>
        <input
          type="search"
          value={busca}
          placeholder="Encontrar o edital pelo número ou pela unidade"
          data-acao="buscar-edital"
          onChange={(ev) => setBusca(ev.target.value)}
          onKeyDown={(ev) => {
            if (ev.key === "Escape" && busca) {
              ev.preventDefault();
              setBusca("");
            }
            if (ev.key === "Enter" && lista.length === 1) aoAbrir(lista[0]!.id);
          }}
        />
      </label>
      {pronto && daLista.length ? (
        <AtivosEHistorico
          {...controle}
          rotulo="Editais da área"
          tomDaSituacao={tomDaSituacaoDoEdital}
          tour="classificacao-ativos-e-historico"
        />
      ) : null}
      {!pronto ? (
        <div className="classificacao-editais" aria-busy="true">
          <div className="ui-card ui-esqueleto classificacao-edital-esqueleto" />
          <div className="ui-card ui-esqueleto classificacao-edital-esqueleto" />
        </div>
      ) : lista.length ? (
        <ul className="classificacao-editais">
          {lista.map((ed) => (
            <li key={ed.id}>
              <button
                type="button"
                className="ui-card ui-card-de-edital"
                data-edital={ed.id}
                onClick={() => aoAbrir(ed.id)}
              >
                <span className="ui-card-de-edital-topo">
                  <strong>
                    {[ed.edital, ed.unidade].filter(Boolean).join(" · ")}
                  </strong>
                  {ed.versao_regra ? (
                    <Selo tom="aprovado" ponto>
                      {rotuloDaVersao({
                        versao: ed.versao_regra,
                        nome: ed.nome_regra ?? null,
                      })}
                    </Selo>
                  ) : (
                    <Selo tom="pendente" ponto>
                      Sem regra
                    </Selo>
                  )}
                </span>
                <span className="ui-texto-secundario">
                  {formatNumberBR(ed.candidatos ?? 0)}{" "}
                  {ed.candidatos === 1 ? "candidato" : "candidatos"}
                </span>
                <SeloDeTreinamento edital={ed} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="ui-lista-vazia" role="status">
          <strong>Nenhum edital por aqui</strong>
          <span>
            {editais.length
              ? "Nenhum edital com essa busca."
              : daLista.length
                ? controle.vista === "historico"
                  ? "Nenhum edital no histórico."
                  : "Nenhum edital ativo."
                : "Nenhum edital com análises nesta área."}
          </span>
        </div>
      )}
    </section>
  );
}
