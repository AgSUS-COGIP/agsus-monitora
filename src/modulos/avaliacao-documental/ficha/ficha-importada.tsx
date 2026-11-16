import type { ReactNode } from "react";
import {
  parciaisDaMarca,
  type MarcaDaImportacao,
} from "../../../lib/avaliacao-documental/importacao-da-planilha.ts";
import {
  textoDoResultado,
  tomDoResultado,
} from "../../../lib/avaliacao-documental/ficha.ts";
import { dataBR, formatarNota } from "../../../lib/classificacao/numeros.ts";
import { Aviso, Selo } from "../../../ui/index.ts";
import { RodapeDaFicha } from "./rodape-da-ficha.tsx";

/*
  A ficha importada da planilha (importar_avaliacao_da_planilha, 16/11/2026):
  o resultado, a nota, as parciais, o parecer e quem analisou são os da
  planilha, só para ler. Não há itens: a análise foi feita lá. Reaberta pela
  coordenação, a ficha volta a ser analisada no sistema, item a item.
*/
export function FichaImportada({
  marca,
  resultado,
  nota,
  parecer,
  cabecalho,
  reabrir,
  children,
}: {
  marca: MarcaDaImportacao;
  resultado: string | null | undefined;
  nota: number | null | undefined;
  parecer: string | null | undefined;
  cabecalho?: ReactNode;
  reabrir?: ReactNode;
  children?: ReactNode;
}) {
  const parciais = parciaisDaMarca(marca);
  const quando = dataBR(marca.importadaEm.slice(0, 10));
  return (
    <div className="avd-ficha" data-importada="sim">
      {cabecalho}
      {children}
      <Aviso>
        Resultado importado da planilha{quando ? ` em ${quando}` : ""}.
      </Aviso>
      <section
        className="ui-card avd-ficha-importada"
        aria-label="Resultado da planilha"
      >
        <Selo tom={tomDoResultado(resultado)}>
          {textoDoResultado(resultado)}
        </Selo>
        <dl className="avd-ficha-importada-dados">
          <div>
            <dt>Nota final</dt>
            <dd>
              {formatarNota(typeof nota === "number" ? nota : marca.nota)}
            </dd>
          </div>
          {parciais.map((p) => (
            <div key={p.codigo}>
              <dt>{p.rotulo}</dt>
              <dd>{p.valor}</dd>
            </div>
          ))}
          {marca.modalidade ? (
            <div>
              <dt>Modalidade</dt>
              <dd>{marca.modalidade}</dd>
            </div>
          ) : null}
          {marca.responsavel ? (
            <div>
              <dt>Analisada por</dt>
              <dd>
                {marca.responsavel}
                {marca.data ? ` em ${dataBR(marca.data)}` : ""}
              </dd>
            </div>
          ) : null}
        </dl>
        <h3 className="avd-ficha-importada-titulo">Parecer</h3>
        <p className="avd-ficha-importada-parecer">{parecer || "—"}</p>
        {marca.link ? (
          <a
            className="btn secondary small"
            href={marca.link}
            target="_blank"
            rel="noopener noreferrer"
          >
            Espelho da planilha
          </a>
        ) : null}
      </section>
      <RodapeDaFicha estado="Concluída na planilha">{reabrir}</RodapeDaFicha>
    </div>
  );
}
