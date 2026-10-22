import {
  avisosDoTituloUnico,
  lancadoComExtra,
  lancadoComRequisito,
} from "../../../lib/avaliacao-documental/regra-por-cargo.ts";
import type {
  ItemExtra,
  RequisitoDoCargo,
} from "../../../lib/avaliacao-documental/regra-por-cargo.ts";
import type { Bloco, Lancado, Lancamento, Mudar, Regra } from "./tipos.ts";

/*
  O que o cargo da vaga muda num item da ficha (a regra da vaga:
  regra-por-cargo.ts). Só aparece quando a regra tem diferença para a vaga:
  - Requisito do cargo: uma linha por requisito DAQUELE cargo, cada uma com
    Confere / Não confere; o Não confere entra como motivo (elimina) e o
    texto do motivo já vem da regra;
  - Títulos e cursos: as linhas extras do cargo (ex.: certificado UMCQA do
    Motorista D, +5), cada uma com Confere / Não confere, somando até o teto;
  - o aviso do item 8.2.7 (cada título conta uma única vez) quando o
    documento usado como requisito aparece lançado para pontuar;
  - Experiência: a área exigida do cargo.
*/

type Marca = boolean | null;

function ConfereOuNao({
  valor,
  rotulo,
  aoMudar,
  desabilitado,
}: {
  valor: Marca;
  rotulo: string;
  aoMudar: (valor: Marca) => void;
  desabilitado: boolean;
}) {
  return (
    <div className="avd-ficha-cargo-marcas" role="group" aria-label={rotulo}>
      <button
        type="button"
        className="avd-ficha-chip"
        data-marca="confere"
        aria-pressed={valor === true}
        disabled={desabilitado}
        onClick={() => aoMudar(valor === true ? null : true)}
      >
        {valor === true ? (
          <i className="fa-solid fa-check" aria-hidden="true" />
        ) : null}
        Confere
      </button>
      <button
        type="button"
        className="avd-ficha-chip"
        data-marca="nao-confere"
        aria-pressed={valor === false}
        disabled={desabilitado}
        onClick={() => aoMudar(valor === false ? null : false)}
      >
        {valor === false ? (
          <i className="fa-solid fa-xmark" aria-hidden="true" />
        ) : null}
        Não confere
      </button>
    </div>
  );
}

const marcaDe = (mapa: Record<string, boolean> | undefined, codigo: string) =>
  typeof mapa?.[codigo] === "boolean" ? (mapa[codigo] as boolean) : null;

/** A lista de requisitos do cargo da vaga, no item "Requisito específico do cargo". */
export function RequisitosDoCargo({
  bloco,
  lancado,
  mudar,
  desabilitado,
}: {
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const requisitos: RequisitoDoCargo[] = bloco.requisitos ?? [];
  if (!requisitos.length) return null;
  const marcar = (codigo: string, valor: Marca) =>
    mudar((l: Lancamento) => ({
      ...l,
      blocos: {
        ...l.blocos,
        [bloco.codigo]: lancadoComRequisito(
          bloco,
          l.blocos?.[bloco.codigo],
          codigo,
          valor,
        ) as Lancado,
      },
    }));
  return (
    <ul className="avd-ficha-cargo-lista" aria-label="Requisitos do cargo">
      {requisitos.map((q) => {
        const valor = marcaDe(lancado.requisitos, q.codigo);
        return (
          <li
            key={q.codigo}
            className="avd-ficha-cargo-linha"
            data-requisito={q.codigo}
            data-marca={valor === null ? undefined : String(valor)}
          >
            <span className="avd-ficha-cargo-rotulo">{q.rotulo}</span>
            <ConfereOuNao
              valor={valor}
              rotulo={q.rotulo}
              desabilitado={desabilitado}
              aoMudar={(v) => marcar(q.codigo, v)}
            />
            {valor === false ? (
              <small className="avd-ficha-cargo-motivo">
                {q.item_edital ? `Item ${q.item_edital}: ` : ""}
                {q.motivo}
              </small>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** As linhas extras do cargo num bloco de títulos ou cursos (ex.: UMCQA, +5). */
export function ExtrasDoBloco({
  bloco,
  lancado,
  mudar,
  desabilitado,
}: {
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const extras: ItemExtra[] = bloco.extras ?? [];
  if (!extras.length) return null;
  const marcar = (codigo: string, valor: Marca) =>
    mudar((l: Lancamento) => ({
      ...l,
      blocos: {
        ...l.blocos,
        [bloco.codigo]: lancadoComExtra(
          l.blocos?.[bloco.codigo],
          codigo,
          valor,
        ) as Lancado,
      },
    }));
  return (
    <ul className="avd-ficha-cargo-lista" aria-label="Itens do cargo">
      {extras.map((e) => {
        const valor = marcaDe(lancado.extras, e.codigo);
        return (
          <li
            key={e.codigo}
            className="avd-ficha-cargo-linha"
            data-extra={e.codigo}
            data-marca={valor === null ? undefined : String(valor)}
          >
            <span className="avd-ficha-cargo-rotulo">
              {e.rotulo}{" "}
              <strong className="avd-ficha-cargo-pontos">+{e.pontos}</strong>
            </span>
            <ConfereOuNao
              valor={valor}
              rotulo={e.rotulo}
              desabilitado={desabilitado}
              aoMudar={(v) => marcar(e.codigo, v)}
            />
          </li>
        );
      })}
    </ul>
  );
}

/** O aviso do item 8.2.7: o documento do requisito lançado para pontuar. */
export function AvisosDoTituloUnico({
  regra,
  bloco,
  lancamento,
  itens,
}: {
  regra: Regra | null | undefined;
  bloco: Bloco;
  lancamento: Lancamento;
  itens: unknown[];
}) {
  const avisos = avisosDoTituloUnico(regra, bloco, itens, lancamento);
  if (!avisos.length) return null;
  return (
    <>
      {avisos.map((a) => (
        <p
          key={`${a.requisito}-${a.item ?? ""}`}
          className="avd-ficha-mensagem"
          data-tom="falta"
          data-aviso="8.2.7"
          role="status"
        >
          <i className="fa-solid fa-circle-exclamation" aria-hidden="true" />
          <span>{a.texto}</span>
        </p>
      ))}
    </>
  );
}

/** A área exigida da experiência para o cargo da vaga. */
export function AreaExigida({ area }: { area?: string }) {
  if (!area) return null;
  return (
    <p className="avd-ficha-cargo-area">
      <span className="avd-ficha-rotulo">Área exigida</span> {area}
    </p>
  );
}
