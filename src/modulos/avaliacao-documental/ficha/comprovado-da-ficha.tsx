import {
  comprovadoDaExperiencia,
  comprovadoDosCursos,
  comprovadoDosTitulos,
} from "../../../lib/avaliacao-documental/comprovado-da-ficha.ts";
import { titulosDoNivel } from "../../../lib/avaliacao-documental/ficha.js";
import type { Bloco, ExperienciaApurada, Lancamento } from "./tipos.ts";

/*
  "Comprovado: …" logo abaixo da lista de títulos, cursos ou vínculos: o que
  os itens ACEITOS comprovam, ao lado do que o candidato declarou. Muda a cada
  item ou aceite; o tempo é o da conta (avaliacao.experiencia).
*/

export function ComprovadoDaFicha({
  bloco,
  lancamento,
  experiencia,
}: {
  bloco: Bloco;
  lancamento: Lancamento;
  experiencia: ExperienciaApurada | null | undefined;
}) {
  let comprovado;
  if (bloco.tipo === "VINCULOS")
    comprovado = comprovadoDaExperiencia(
      bloco as Parameters<typeof comprovadoDaExperiencia>[0],
      experiencia,
      lancamento.nivel,
    );
  else if (bloco.tipo === "CURSOS")
    comprovado = comprovadoDosCursos(
      lancamento.cursos as Parameters<typeof comprovadoDosCursos>[0],
    );
  else if (bloco.tipo === "TITULOS") {
    const rotulos = Object.fromEntries(
      (
        titulosDoNivel(bloco, lancamento.nivel) as {
          codigo: string;
          rotulo: string;
        }[]
      ).map((t) => [t.codigo, t.rotulo]),
    );
    comprovado = comprovadoDosTitulos(
      lancamento.titulos as Parameters<typeof comprovadoDosTitulos>[0],
      rotulos,
    );
  } else return null;
  return (
    <p
      className="avd-ficha-comprovado"
      role="status"
      data-abaixo={comprovado.abaixoDoMinimo ? "sim" : undefined}
    >
      <strong>{comprovado.texto}</strong>
      {comprovado.detalhe ? <span>{comprovado.detalhe}</span> : null}
    </p>
  );
}
