/* Item da ficha: as escolhas, os chips e o Não confere (API pública em ../item-da-ficha.tsx). */

import {
  marcouOutroMotivo,
  PERGUNTA_DA_DECISAO,
} from "../../../../lib/avaliacao-documental/ficha.ts";
import { blocoComEscolha } from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import type { Escolha } from "../../../../lib/avaliacao-documental/apurado-da-ficha.ts";
import {
  comOutroMotivo,
  MotivoEscrito,
  OPCAO_OUTRO_MOTIVO,
} from "../observacao-do-item.tsx";
import type { Bloco, EstadoDaFicha, Lancado, Mudar, Opcao } from "../tipos.ts";
import { ESCOLHAS, ICONE_DA_ESCOLHA, alterarBloco } from "./escolha.ts";

/* ── As escolhas e os chips ───────────────────────────────────────────── */

export function Escolhas({
  valor,
  comEditar,
  aoMudar,
  desabilitado,
  compacto,
  idDaPergunta,
}: {
  valor: Escolha | null;
  /** "Editar nota" só nos blocos que pontuam. */
  comEditar: boolean;
  aoMudar: (escolha: Escolha | null) => void;
  desabilitado: boolean;
  compacto?: boolean;
  idDaPergunta: string;
}) {
  return (
    <div className="avd-ficha-decidir" data-compacto={compacto || undefined}>
      <p
        className={compacto ? "sr-only" : "avd-ficha-decidir-pergunta"}
        id={idDaPergunta}
      >
        {PERGUNTA_DA_DECISAO}
      </p>
      <div
        className="avd-ficha-decisoes"
        role="group"
        aria-labelledby={idDaPergunta}
        data-compacto={compacto || undefined}
        data-opcoes={comEditar ? 3 : 2}
        data-tour="avd-ficha-decisoes"
      >
        {ESCOLHAS.filter(([codigo]) => comEditar || codigo !== "EDITAR").map(
          ([codigo, rotulo, tecla]) => {
            const escolhido = valor === codigo;
            return (
              <button
                key={codigo}
                type="button"
                className="avd-ficha-decisao"
                data-valor={codigo}
                aria-pressed={escolhido}
                aria-keyshortcuts={tecla}
                title={`${rotulo} (tecla ${tecla})`}
                disabled={desabilitado}
                // Clicar de novo na escolha marcada confirma (não desmarca):
                // quem completa a linha e clica Confere outra vez segue adiante.
                onClick={() => aoMudar(codigo)}
              >
                <span className="avd-ficha-decisao-icone" aria-hidden="true">
                  <i className={`fa-solid ${ICONE_DA_ESCOLHA[codigo]}`} />
                </span>
                <span className="avd-ficha-decisao-rotulo">{rotulo}</span>
              </button>
            );
          },
        )}
      </div>
    </div>
  );
}

export function Chips({
  rotulo,
  opcoes,
  marcados,
  aoMudar,
  desabilitado,
  tour,
  rotuloOculto,
}: {
  rotulo: string;
  opcoes: Opcao[];
  marcados: string[];
  aoMudar: (marcados: string[]) => void;
  desabilitado: boolean;
  tour?: string;
  /** O rótulo já aparece em volta (o resumo do "Outras justificativas"). */
  rotuloOculto?: boolean;
}) {
  return (
    <div
      className="avd-ficha-chips"
      role="group"
      aria-label={rotulo}
      data-tour={tour}
    >
      <span className={rotuloOculto ? "sr-only" : "avd-ficha-rotulo"}>
        {rotulo}
      </span>
      <div className="avd-ficha-chips-lista">
        {opcoes.map((o) => {
          const marcado = marcados.includes(o.codigo);
          return (
            <button
              key={o.codigo}
              type="button"
              className="avd-ficha-chip"
              data-motivo={o.codigo}
              aria-pressed={marcado}
              disabled={desabilitado}
              onClick={() =>
                aoMudar(
                  marcado
                    ? marcados.filter((c) => c !== o.codigo)
                    : [...marcados, o.codigo],
                )
              }
            >
              {marcado ? (
                <i className="fa-solid fa-check" aria-hidden="true" />
              ) : null}
              {o.texto}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ── Não confere: só o motivo ─────────────────────────────────────────── */

export function NaoConfere({
  st,
  bloco,
  lancado,
  mudar,
  desabilitado,
}: {
  st: EstadoDaFicha;
  bloco: Bloco;
  lancado: Lancado;
  mudar: Mudar;
  desabilitado: boolean;
}) {
  const motivos = bloco.motivos || [];
  const naoEnviou = lancado.situacao === "NAO_ENVIADO";
  const marcados = lancado.motivos || [];
  const alterar = (campos: Lancado) =>
    alterarBloco(mudar, bloco.codigo, campos);
  return (
    <div className="avd-ficha-nao-confere" data-tour="avd-ficha-motivos">
      {motivos.length ? (
        <Chips
          rotulo="Por que não confere?"
          opcoes={[...motivos, OPCAO_OUTRO_MOTIVO]}
          marcados={marcados}
          desabilitado={desabilitado}
          aoMudar={(escolhidos) =>
            alterar(comOutroMotivo("motivos", escolhidos, lancado))
          }
        />
      ) : null}
      {/* Sem motivos na regra, o texto é o motivo; com motivos, só no "Outro". */}
      {!motivos.length || marcouOutroMotivo(marcados) ? (
        <MotivoEscrito
          codigo={bloco.codigo}
          rotulo={motivos.length ? "Descreva o motivo" : "Motivo"}
          lancado={lancado}
          desabilitado={desabilitado}
          aoMudar={alterar}
        />
      ) : null}
      <label className="avd-ficha-opcao avd-ficha-nao-enviou">
        <input
          type="checkbox"
          checked={naoEnviou}
          disabled={desabilitado}
          onChange={(ev) => {
            const marcado = ev.target.checked;
            mudar((l) => {
              l.blocos = {
                ...l.blocos,
                [bloco.codigo]: blocoComEscolha({
                  bloco,
                  lancamento: l,
                  escolha: "NAO_CONFERE",
                  declarada: st.declarada,
                  naoEnviou: marcado,
                }) as Lancado,
              };
              return l;
            });
          }}
        />{" "}
        O candidato não enviou o documento
      </label>
    </div>
  );
}
