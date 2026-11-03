import { GradeDeKv, Kv, Selo } from "../../ui/index.ts";
import type { LinhaDoResumo } from "../../lib/regras-do-edital.ts";
import "./resumo-da-regra-da-etapa.css";

/*
  A regra de uma etapa, só para ler, no topo da tela da etapa (Avaliação
  documental, Classificação): versão, situação e as regras em uma linha cada.
  Editar é nas Regras do edital: o botão "Editar nas Regras do edital" abre a
  página na etapa (abrir.ts). Sem regra: o aviso curto e o mesmo botão.
*/
export function ResumoDaRegraDaEtapa({
  id,
  titulo,
  versao,
  nome,
  conferida,
  linhas,
  semRegra,
  aoEditar,
  tour,
}: {
  id: string;
  titulo: string;
  versao?: number | null;
  nome?: string | null;
  /** true/false mostra o selo Conferida/A conferir; sem valor, sem selo. */
  conferida?: boolean | null;
  linhas: readonly LinhaDoResumo[];
  semRegra: string;
  aoEditar?: (() => void) | null;
  tour?: string;
}) {
  const temRegra = Boolean(versao);
  return (
    <section
      className="ui-card resumo-da-regra-da-etapa"
      aria-labelledby={id}
      data-tour={tour}
    >
      <header className="resumo-da-regra-da-etapa__topo">
        <h2 className="ui-titulo" id={id}>
          {titulo}
        </h2>
        {temRegra ? (
          <span className="resumo-da-regra-da-etapa__versao">
            versão {versao}
            {nome ? ` · ${nome}` : ""}
          </span>
        ) : (
          <Selo tom="pendente">Sem regra</Selo>
        )}
        {temRegra && typeof conferida === "boolean" ? (
          <Selo tom={conferida ? "aprovado" : "pendente"}>
            {conferida ? "Conferida" : "A conferir"}
          </Selo>
        ) : null}
        {aoEditar ? (
          <button
            type="button"
            className="btn secondary small resumo-da-regra-da-etapa__editar"
            data-acao="editar-nas-regras-do-edital"
            onClick={aoEditar}
          >
            Editar nas Regras do edital
          </button>
        ) : null}
      </header>
      {temRegra && linhas.length ? (
        <GradeDeKv rotulo={`Resumo: ${titulo}`}>
          {linhas.map((linha) => (
            <Kv key={linha.rotulo} rotulo={linha.rotulo}>
              {linha.valor}
            </Kv>
          ))}
        </GradeDeKv>
      ) : (
        <p className="ui-texto-suave">{semRegra}</p>
      )}
    </section>
  );
}
