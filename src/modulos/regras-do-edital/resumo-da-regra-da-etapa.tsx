import { useEffect, useState } from "react";
import { importarComRecarga } from "../../lib/importar-com-recarga";
import type { LinhaDoResumo } from "../../lib/regras-do-edital.ts";
import { GradeDeKv, Kv, Selo } from "../../ui/index.ts";
import "./resumo-da-regra-da-etapa.css";
import { CarregandoConteudo } from "../../ui/index.ts";

/*
  A regra de uma etapa, só para ler, no topo da tela da etapa (Avaliação
  documental, Classificação): versão, situação e as regras em uma linha cada.
  Editar é nas Regras do edital: o botão "Editar nas Regras do edital" abre a
  página na etapa (abrir.ts). Sem regra: o aviso curto e o mesmo botão.

  As linhas saem de regras-do-edital-resumos.ts, que puxa o código das regras
  da Avaliação e da Classificação: o módulo chega por import() na primeira
  vez (uma carga só, guardada) e, até lá, o resumo mostra o esqueleto.
*/

export type ResumosDasRegras =
  typeof import("../../lib/regras-do-edital-resumos.ts");

let resumosCarregados: ResumosDasRegras | null = null;
let pedidoDosResumos: Promise<ResumosDasRegras> | null = null;
const importarResumos = importarComRecarga(
  () => import("../../lib/regras-do-edital-resumos.ts"),
);

function baixarResumos() {
  pedidoDosResumos ??= importarResumos().then((m) => {
    resumosCarregados = m;
    return m;
  });
  // Falhou: a próxima abertura tenta de novo.
  pedidoDosResumos.catch(() => {
    pedidoDosResumos = null;
  });
  return pedidoDosResumos;
}

/** Os resumos das regras, ou `null` enquanto o módulo baixa. */
export function usarResumosDasRegras(): ResumosDasRegras | null {
  const [modulo, setModulo] = useState(resumosCarregados);
  useEffect(() => {
    if (modulo) return;
    let vivo = true;
    baixarResumos()
      .then((m) => {
        if (vivo) setModulo(m);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [modulo]);
  return modulo;
}

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
  /** As linhas, a partir dos resumos (carregados sob demanda). */
  linhas: (resumos: ResumosDasRegras) => readonly LinhaDoResumo[];
  semRegra: string;
  aoEditar?: (() => void) | null;
  tour?: string;
}) {
  const resumos = usarResumosDasRegras();
  const temRegra = Boolean(versao);
  const lidas = temRegra && resumos ? linhas(resumos) : [];
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
      {temRegra && !resumos ? (
        <CarregandoConteudo
          rotulo={`Carregando o resumo: ${titulo}…`}
          semMoldura
        />
      ) : temRegra && lidas.length ? (
        <GradeDeKv rotulo={`Resumo: ${titulo}`}>
          {lidas.map((linha) => (
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
