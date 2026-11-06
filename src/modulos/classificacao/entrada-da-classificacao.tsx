import { useMemo, useState } from "react";
import { formatNumberBR } from "../../lib/formatters";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { SeloDeTreinamento } from "../../componentes/selo-de-treinamento.tsx";
import { Selo } from "../../ui/index.ts";
import type { EditalDaClassificacao } from "./tipos-do-estado.ts";

/*
  A Classificação sem edital escolhido: a busca grande e a grade de cards dos
  editais da área (os que têm análises: listar_editais_classificacao). Cada
  card mostra o número e a unidade, quantos candidatos, a versão da regra da
  Classificação (ou "Sem regra") e o selo de treinamento; clicar abre o
  edital. A busca recorta os cards pelo número ou pela unidade.

  Só o que a lista dos editais traz: etapa, progresso e prazos não estão
  nela (ficam dentro do edital), então o card não os mostra.
*/

const semAcento = (texto: string) =>
  texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export function EntradaDaClassificacao({
  editais,
  carregado,
  aoAbrir,
}: {
  editais: readonly EditalDaClassificacao[];
  carregado: boolean;
  aoAbrir: (id: string) => void;
}) {
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
      {!carregado ? (
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
              : "Nenhum edital com análises nesta área."}
          </span>
        </div>
      )}
    </section>
  );
}
