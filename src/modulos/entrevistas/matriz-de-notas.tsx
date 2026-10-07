import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent } from "react";
import {
  movimentoDaTecla,
  moverNaGrade,
  type Movimento,
  type Posicao,
} from "../../lib/digitacao-de-notas.ts";
import { classes } from "../../ui/classes.js";
import { animar, CelulaDeNota, type OpcaoDeNota } from "./campo-de-nota.tsx";

/*
  A matriz da ficha de notas (ficha.jsx), como a folha de papel que a
  secretaria passa a limpo: linhas (as competências de um avaliador, ou os
  avaliadores de uma competência) × colunas (os aspectos do roteiro —
  Conceitua · Propriedade · Profundidade — ou uma coluna "Nota").

  Fluxo de planilha: digitar uma nota completa avança; Enter avança, Shift+
  Enter volta; setas andam; Tab/Shift+Tab seguem a ordem natural; Backspace
  na célula vazia volta à anterior; fora da escala, a célula não muda e um
  aviso curto aparece embaixo. Passando da última célula, foca a primeira
  vazia desta matriz ou, com tudo preenchido, chama `aoFim` (a ficha passa
  ao próximo avaliador ou ao Salvar).

  Cada linha mostra a média dela num chip (vermelho abaixo do mínimo, verde
  ok) quando há aspectos. `focarAoMontar` foca a primeira célula vazia
  editável quando a matriz aparece (troca automática de avaliador).
*/

export type ColunaDaMatriz = { id: string; nome: string };

export type CelulaDaMatriz = {
  chave: string;
  valor: string;
  rotulo: string;
  editavel: boolean;
  invalida: boolean;
};

export type LinhaDaMatriz = {
  id: string;
  titulo: string;
  /** "mín. 2", "AgSUS", "saiu da banca": discreto, ao lado do título. */
  detalhe?: string;
  descricao?: string;
  celulas: CelulaDaMatriz[];
  /** As notas da escala da linha (a nota máxima pode mudar por competência). */
  opcoes: readonly OpcaoDeNota[];
  /** "0 a 5". */
  escala: string;
  decimal: boolean;
  /** A média da linha (aspectos); null enquanto falta algum. */
  media: number | null;
  abaixoDoMinimo: boolean;
  incompleta: boolean;
};

export type PropriedadesDaMatriz = {
  rotulo: string;
  colunas: ColunaDaMatriz[];
  linhas: LinhaDaMatriz[];
  mostrarMedia: boolean;
  desabilitado: boolean;
  focarAoMontar?: boolean;
  aoMudar: (chave: string, valor: string) => void;
  aoFim?: () => void;
  aoFocar?: (chave: string) => void;
};

const media2 = (n: number) =>
  (Math.round(n * 100) / 100).toLocaleString("pt-BR", {
    maximumFractionDigits: 2,
  });

export function MatrizDeNotas({
  rotulo,
  colunas,
  linhas,
  mostrarMedia,
  desabilitado,
  focarAoMontar = false,
  aoMudar,
  aoFim,
  aoFocar,
}: PropriedadesDaMatriz) {
  const campos = useRef<Map<string, HTMLInputElement>>(new Map());
  const [aviso, setAviso] = useState("");
  const chaveDe = (p: Posicao) => `${p.linha}:${p.coluna}`;
  const campo = (p: Posicao) => campos.current.get(chaveDe(p)) || null;

  function focar(p: Posicao) {
    const alvo = campo(p);
    if (!alvo) return false;
    alvo.focus();
    alvo.select();
    return true;
  }

  /* A primeira célula editável vazia, fora `exceto` (a que acabou de ser preenchida: o estado ainda não a tem). */
  function primeiraVazia(exceto?: Posicao): Posicao | null {
    for (let linha = 0; linha < linhas.length; linha += 1)
      for (let coluna = 0; coluna < colunas.length; coluna += 1) {
        if (exceto && exceto.linha === linha && exceto.coluna === coluna)
          continue;
        const celula = linhas[linha]?.celulas[coluna];
        if (celula?.editavel && celula.valor === "") return { linha, coluna };
      }
    return null;
  }

  /* Anda na direção até achar uma célula editável; `true` se focou. */
  function mover(de: Posicao, movimento: Movimento) {
    let atual: Posicao | null = de;
    for (let i = 0; i < linhas.length * colunas.length; i += 1) {
      atual = moverNaGrade(atual, movimento, linhas.length, colunas.length);
      if (!atual) break;
      if (focar(atual)) return true;
    }
    return false;
  }

  function avancar(de: Posicao) {
    if (mover(de, "proxima")) return;
    // Passou da última: a primeira vazia (fora a que acabou de ser preenchida) ou o fim.
    const vazia = primeiraVazia(de);
    if (vazia) focar(vazia);
    else aoFim?.();
  }

  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>, de: Posicao) {
    if (evento.ctrlKey || evento.metaKey || evento.altKey) return;
    if (evento.key === "Backspace" && evento.currentTarget.value === "") {
      evento.preventDefault();
      mover(de, "anterior");
      return;
    }
    const movimento = movimentoDaTecla(evento.key, evento.shiftKey);
    if (!movimento) return;
    evento.preventDefault();
    if (movimento === "proxima") avancar(de);
    else mover(de, movimento);
  }

  useEffect(() => {
    if (!focarAoMontar) return;
    const vazia = primeiraVazia();
    if (vazia) focar(vazia);
    // Só ao montar: a troca automática de avaliador remonta a matriz.
  }, []);

  useEffect(() => {
    if (!aviso) return undefined;
    const t = setTimeout(() => setAviso(""), 2600);
    return () => clearTimeout(t);
  }, [aviso]);

  return (
    <div
      className="entrevistas-matriz"
      role="group"
      aria-label={rotulo}
      data-colunas={colunas.length}
      data-media={mostrarMedia || undefined}
      style={{ "--colunas": colunas.length } as CSSProperties}
      data-tour="entrevistas-ficha-matriz"
    >
      <div className="entrevistas-matriz-cabecalho" aria-hidden="true">
        <span />
        {colunas.map((c) => (
          <span key={c.id} className="entrevistas-matriz-coluna">
            {c.nome}
          </span>
        ))}
        {mostrarMedia ? (
          <span className="entrevistas-matriz-coluna">Média</span>
        ) : null}
      </div>
      {linhas.map((linha, i) => (
        <div
          key={linha.id}
          className={classes(
            "entrevistas-matriz-linha",
            linha.incompleta && "is-incompleta",
          )}
          data-linha={linha.id}
        >
          <div className="entrevistas-matriz-titulo" title={linha.descricao}>
            <span>{linha.titulo}</span>
            {linha.detalhe ? <small>{linha.detalhe}</small> : null}
          </div>
          {linha.celulas.map((celula, j) => (
            <CelulaDeNota
              key={celula.chave}
              campo={(el) => {
                if (el) campos.current.set(`${i}:${j}`, el);
                else campos.current.delete(`${i}:${j}`);
              }}
              valor={celula.valor}
              rotulo={celula.rotulo}
              editavel={celula.editavel}
              invalida={celula.invalida}
              opcoes={linha.opcoes}
              escala={linha.escala}
              decimal={linha.decimal}
              desabilitado={desabilitado}
              linha={i}
              coluna={j}
              chave={celula.chave}
              aoMudar={(valor) => aoMudar(celula.chave, valor)}
              aoAvancar={() => avancar({ linha: i, coluna: j })}
              aoRecusar={(texto) => {
                setAviso(
                  `“${texto}” não está na escala${linha.escala ? ` (${linha.escala})` : ""}.`,
                );
                animar(campo({ linha: i, coluna: j })?.parentElement, [
                  { transform: "translateX(0)" },
                  { transform: "translateX(-4px)" },
                  { transform: "translateX(4px)" },
                  { transform: "translateX(0)" },
                ]);
              }}
              aoTeclar={(e) => aoTeclar(e, { linha: i, coluna: j })}
              aoFocar={() => aoFocar?.(celula.chave)}
            />
          ))}
          {mostrarMedia ? (
            <span
              className="entrevistas-matriz-media"
              data-situacao={
                linha.media === null
                  ? "vazia"
                  : linha.abaixoDoMinimo
                    ? "abaixo"
                    : "ok"
              }
              aria-label={
                linha.media === null
                  ? undefined
                  : `Média ${media2(linha.media)}${linha.abaixoDoMinimo ? ", abaixo do mínimo" : ""}`
              }
            >
              {linha.media === null ? "—" : media2(linha.media)}
            </span>
          ) : null}
        </div>
      ))}
      <p className="entrevistas-matriz-aviso" role="status" aria-live="polite">
        {aviso}
      </p>
    </div>
  );
}
