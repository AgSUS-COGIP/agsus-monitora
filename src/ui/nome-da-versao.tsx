import { useState } from "react";
import {
  erroDoNomeDaVersao,
  nomeParaGravar,
  normalizarNomeDaVersao,
  partesDaVersao,
  rotuloDaVersao,
  TAMANHO_MAXIMO_DO_NOME,
} from "../lib/nome-da-versao.ts";
import type { VersaoComNome } from "../lib/nome-da-versao.ts";
import { Aviso } from "./aviso.tsx";
import { Campo } from "./campo.jsx";
import { Modal } from "./modal.jsx";

/*
  O nome das versões das três regras (avaliação documental, classificação e
  roteiro de entrevista), regras em src/lib/nome-da-versao.ts:
    NomeDaVersao        "Decisão CORES · v7" (nome em destaque, número
                        discreto); sem nome, "Versão 7".
    CampoNomeDaVersao   "Nome desta versão" ao salvar: vem com a sugestão
                        (editável); vazio grava sem nome.
    RenomearVersao      botão + diálogo: troca só o nome, com motivo.
*/

export type Renomeacao = {
  em?: string | null;
  por?: string | null;
  de?: string | null;
  para?: string | null;
  motivo?: string | null;
};

const dataCurta = (valor: string | null | undefined) => {
  const d = valor ? new Date(valor) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })
    : "";
};

/** As trocas de nome em texto (título do selo "nome trocado"). */
export function textoDasTrocas(trocas: ReadonlyArray<Renomeacao>): string {
  return trocas
    .map((t) =>
      [
        `${t.de ? `“${t.de}”` : "sem nome"} → ${t.para ? `“${t.para}”` : "sem nome"}`,
        [dataCurta(t.em), t.por].filter(Boolean).join(", "),
        t.motivo,
      ]
        .filter(Boolean)
        .join(" · "),
    )
    .join("\n");
}

export function NomeDaVersao({
  versao,
  nome,
  trocas,
  className,
}: VersaoComNome & {
  trocas?: ReadonlyArray<Renomeacao> | null;
  className?: string;
}) {
  const partes = partesDaVersao({ versao, nome });
  if (!partes.nome && !partes.numero) return null;
  return (
    <span
      className={["ui-nome-da-versao", className].filter(Boolean).join(" ")}
      data-versao={versao ?? undefined}
      title={rotuloDaVersao({ versao, nome })}
    >
      {partes.nome ? (
        <>
          <strong className="ui-nome-da-versao-nome">{partes.nome}</strong>
          {partes.numero ? (
            <small className="ui-nome-da-versao-numero">
              · {partes.numero}
            </small>
          ) : null}
        </>
      ) : (
        <strong className="ui-nome-da-versao-nome">{partes.numero}</strong>
      )}
      {trocas?.length ? (
        <small
          className="ui-nome-da-versao-trocas"
          title={textoDasTrocas(trocas)}
          data-trocas={trocas.length}
        >
          (nome trocado)
        </small>
      ) : null}
    </span>
  );
}

/** O nome que vai ser gravado: o digitado ou, sem mexer, a sugestão. */
export const nomeDoCampo = (valor: string | null, sugestao: string) =>
  valor ?? sugestao;

export function CampoNomeDaVersao({
  valor,
  sugestao,
  aoMudar,
  mostrarErro = false,
  desabilitado = false,
}: {
  /** null = acompanha a sugestão (a pessoa ainda não mexeu). */
  valor: string | null;
  sugestao: string;
  aoMudar: (valor: string | null) => void;
  mostrarErro?: boolean;
  desabilitado?: boolean;
}) {
  const atual = nomeDoCampo(valor, sugestao);
  const erro = erroDoNomeDaVersao(atual);
  return (
    <Campo
      rotulo="Nome desta versão"
      erro={mostrarErro && erro ? erro : undefined}
    >
      <input
        value={atual}
        maxLength={TAMANHO_MAXIMO_DO_NOME}
        placeholder="Sem nome"
        disabled={desabilitado}
        data-campo="nome-da-versao"
        onChange={(ev) => aoMudar(ev.target.value)}
      />
    </Campo>
  );
}

export type ResultadoDoRenomear = { ok: boolean; erro?: string };

export function RenomearVersao({
  versao,
  nome,
  aoRenomear,
  desabilitado = false,
}: VersaoComNome & {
  aoRenomear: (
    nome: string | null,
    motivo: string,
  ) => Promise<ResultadoDoRenomear>;
  desabilitado?: boolean;
}) {
  const [aberto, setAberto] = useState(false);
  const [novo, setNovo] = useState("");
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const [erroDoBanco, setErroDoBanco] = useState("");
  const [gravando, setGravando] = useState(false);
  const antes = normalizarNomeDaVersao(nome);
  const erroDoNome = erroDoNomeDaVersao(novo);
  const igual = normalizarNomeDaVersao(novo) === antes;
  const motivoCurto = motivo.trim().length < 10;
  const abrir = () => {
    setNovo(antes);
    setMotivo("");
    setTentou(false);
    setErroDoBanco("");
    setAberto(true);
  };
  async function gravar() {
    setTentou(true);
    if (erroDoNome || igual || motivoCurto) return;
    setGravando(true);
    const r = await aoRenomear(nomeParaGravar(novo), motivo.trim());
    setGravando(false);
    if (r.ok) setAberto(false);
    else setErroDoBanco(r.erro || "Não foi possível trocar o nome.");
  }
  return (
    <>
      <button
        type="button"
        className="btn ghost small"
        data-acao="renomear-versao"
        data-versao={versao ?? undefined}
        disabled={desabilitado}
        title={`Renomear ${rotuloDaVersao({ versao, nome })}`}
        onClick={abrir}
      >
        <i className="fa-solid fa-pen" aria-hidden="true" /> Renomear
      </button>
      {aberto ? (
        <Modal rotulo="Renomear a versão" aoFechar={() => setAberto(false)}>
          <h2 className="ui-titulo">
            Renomear <NomeDaVersao versao={versao} nome={nome} />
          </h2>
          {erroDoBanco ? (
            <Aviso tom="danger" papel="alert">
              {erroDoBanco}
            </Aviso>
          ) : null}
          <Campo
            rotulo="Nome desta versão"
            erro={
              tentou
                ? erroDoNome || (igual ? "O nome não mudou." : undefined)
                : undefined
            }
          >
            <input
              value={novo}
              maxLength={TAMANHO_MAXIMO_DO_NOME}
              placeholder="Sem nome"
              data-foco-inicial=""
              onChange={(ev) => setNovo(ev.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Motivo da troca"
            obrigatorio
            erro={tentou && motivoCurto ? "De 10 a 500 caracteres." : undefined}
          >
            <input
              value={motivo}
              maxLength={500}
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </Campo>
          <div className="ui-acoes">
            <button
              type="button"
              className="btn secondary"
              onClick={() => setAberto(false)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="btn"
              data-acao="salvar-nome-da-versao"
              disabled={gravando}
              onClick={() => void gravar()}
            >
              Salvar o nome
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  );
}
