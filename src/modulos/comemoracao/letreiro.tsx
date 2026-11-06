import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import {
  CORES_DO_LETREIRO,
  duracaoDoEfeito,
  faseDoLetreiro,
  layoutDoLetreiro,
  tempoDoLetreiro,
} from "./letreiro.ts";
import type { FaseDoLetreiro } from "./letreiro.ts";
import type { PlanoDaComemoracao } from "./plano.ts";

/*
  O letreiro na tela: a frase do marco em texto de verdade, numa placa
  escura translúcida por cima das partículas, com um véu suave em volta só
  enquanto ela está lá. Entra letra a letra (escala e subida, uma depois da
  outra), fica parada para ler e sai suave. Com menos movimento, só
  aparece e some (CSS em src/styles/comemoracao.css).

  O relógio é próprio (o letreiro pode durar mais que um efeito curto, para
  dar tempo de ler). `pulado` (o botão Pular) faz sair na hora. A frase não
  é anunciada (aria-hidden): quem lê a tela já ouve o aviso.
*/

const RGB = (cor: string) =>
  [1, 3, 5].map((i) => parseInt(cor.slice(i, i + 2), 16)).join(" ");

export function Letreiro({
  plano,
  reduzido = false,
  pulado = false,
}: {
  plano: PlanoDaComemoracao;
  reduzido?: boolean;
  pulado?: boolean;
}) {
  const layout = useMemo(() => layoutDoLetreiro(plano.letreiro), [plano]);
  const tempo = useMemo(
    () =>
      tempoDoLetreiro({
        duracao: duracaoDoEfeito(plano),
        efeito: plano.efeito,
        reduzido,
      }),
    [plano, reduzido],
  );
  const [fase, definirFase] = useState<FaseDoLetreiro>("antes");
  const puladoRef = useRef(pulado);
  puladoRef.current = pulado;

  // As trocas de fase no tempo do letreiro, desde a montagem.
  useEffect(() => {
    const comeco = Date.now();
    const relogios = [tempo.inicio, tempo.saida, tempo.fim].map((s) =>
      setTimeout(
        () =>
          definirFase((atual) =>
            puladoRef.current
              ? atual
              : faseDoLetreiro((Date.now() - comeco) / 1000, tempo),
          ),
        Math.max(0, s * 1000 - (Date.now() - comeco)) + 5,
      ),
    );
    return () => relogios.forEach(clearTimeout);
  }, [tempo]);

  // Pular: a frase sai agora (ou nem entra).
  useEffect(() => {
    if (!pulado) return undefined;
    definirFase((atual) => (atual === "entrando" ? "saindo" : "fim"));
    const relogio = setTimeout(
      () => definirFase("fim"),
      tempo.fim * 1000 - tempo.saida * 1000,
    );
    return () => clearTimeout(relogio);
  }, [pulado, tempo]);

  const estilo = useMemo<CSSProperties>(
    () =>
      ({
        "--letreiro-fonte": layout?.fonte,
        "--letreiro-placa": `rgb(${RGB(CORES_DO_LETREIRO.placa)} / ${CORES_DO_LETREIRO.alfaDaPlaca})`,
        "--letreiro-texto": CORES_DO_LETREIRO.texto,
        "--letreiro-destaque": CORES_DO_LETREIRO.destaque,
        "--letreiro-contorno": CORES_DO_LETREIRO.contorno,
      }) as CSSProperties,
    [layout],
  );

  if (!layout || fase === "antes" || fase === "fim") return null;
  return (
    <div
      className="comemoracao__letreiro"
      data-fase={fase}
      aria-hidden="true"
      style={estilo}
    >
      <div className="comemoracao__letreiro-placa">
        <span className="comemoracao__letreiro-texto">
          {layout.letras.map(({ letra, atraso, espaco }, i) => (
            <span
              key={i}
              className={
                espaco
                  ? "comemoracao__letreiro-letra comemoracao__letreiro-letra--espaco"
                  : "comemoracao__letreiro-letra"
              }
              style={{ animationDelay: `${atraso}s` }}
            >
              {espaco ? "\u00a0" : letra}
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}
