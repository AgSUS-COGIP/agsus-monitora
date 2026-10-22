import { useState } from "react";
import {
  areaDoModelo,
  type PontoDePartida,
} from "../../../lib/avaliacao-documental/assistente-da-regra.ts";
import type {
  ModeloDaRegra,
  RegraDeOutroEdital,
  RegraSalva,
} from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import { rotuloDaVersao } from "../../../lib/nome-da-versao.ts";
import { Aviso } from "../../../ui/index.js";

/*
  Passo 1: de onde a regra começa. A versão vigente (quem edita), a regra
  conferida de outro edital da mesma área, um modelo ou do zero — sempre uma
  cópia independente (mudar aqui não muda a origem).
*/
type Escolha = "vigente" | "edital" | "modelo" | "zero";

type Props = {
  regraSalva: RegraSalva | null;
  regrasDaArea: ReadonlyArray<RegraDeOutroEdital>;
  modelos: ReadonlyArray<ModeloDaRegra>;
  area: string;
  carregandoApoio: boolean;
  /** Já há escolhas no rascunho: trocar o ponto de partida pede confirmação. */
  temEscolhas: boolean;
  pontoAtual: PontoDePartida | null;
  aoUsar: (ponto: PontoDePartida) => void;
};

const rotuloDoEdital = (r: RegraDeOutroEdital) =>
  [r.numero ? `Edital ${r.numero}` : r.edital, r.unidade, rotuloDaVersao(r)]
    .filter(Boolean)
    .join(" · ");

export function PassoPartida({
  regraSalva,
  regrasDaArea,
  modelos,
  area,
  carregandoApoio,
  temEscolhas,
  pontoAtual,
  aoUsar,
}: Props) {
  const daArea = [...modelos].sort(
    (a, b) =>
      Number(areaDoModelo(b.codigo) === area) -
        Number(areaDoModelo(a.codigo) === area) || a.nome.localeCompare(b.nome),
  );
  const [escolha, setEscolha] = useState<Escolha>(
    pontoAtual?.tipo ??
      (regraSalva ? "vigente" : daArea.length ? "modelo" : "zero"),
  );
  const [edital, setEdital] = useState(regrasDaArea[0]?.id ?? "");
  const [modelo, setModelo] = useState(daArea[0]?.codigo ?? "");
  const [confirmar, setConfirmar] = useState(false);

  const ponto = (): PontoDePartida | null => {
    if (escolha === "vigente" && regraSalva)
      return {
        tipo: "vigente",
        versao: regraSalva.versao,
        configuracao: regraSalva.configuracao,
      };
    if (escolha === "edital") {
      const r = regrasDaArea.find((x) => x.id === edital);
      return r
        ? {
            tipo: "edital",
            edital: r.numero ?? r.edital,
            versao: r.versao,
            configuracao: r.configuracao,
          }
        : null;
    }
    if (escolha === "modelo") {
      const m = modelos.find((x) => x.codigo === modelo);
      return m
        ? { tipo: "modelo", codigo: m.codigo, configuracao: m.configuracao }
        : null;
    }
    return escolha === "zero" ? { tipo: "zero" } : null;
  };
  const escolhido = ponto();

  const opcao = (
    valor: Escolha,
    titulo: string,
    icone: string,
    desabilitada = false,
  ) => (
    <label
      className="avd-ast-opcao"
      data-escolhida={escolha === valor ? "sim" : undefined}
    >
      <input
        type="radio"
        name="avd-ast-partida"
        value={valor}
        checked={escolha === valor}
        disabled={desabilitada}
        onChange={() => {
          setEscolha(valor);
          setConfirmar(false);
        }}
      />
      <i className={`fa-solid ${icone}`} aria-hidden="true" />
      <span>{titulo}</span>
    </label>
  );

  return (
    <div className="avd-ast-passo" data-tour="avd-assistente-partida">
      <div
        className="avd-ast-opcoes"
        role="radiogroup"
        aria-label="Ponto de partida"
      >
        {regraSalva
          ? opcao(
              "vigente",
              `Continuar da versão vigente (${rotuloDaVersao(regraSalva)})`,
              "fa-code-branch",
            )
          : null}
        {opcao(
          "edital",
          "Copiar a regra conferida de outro edital da área",
          "fa-copy",
          !regrasDaArea.length,
        )}
        {opcao("modelo", "Começar de um modelo", "fa-shapes", !modelos.length)}
        {opcao("zero", "Começar do zero", "fa-file")}
      </div>

      {escolha === "edital" ? (
        <label className="avd-ast-escolha">
          <span>Edital</span>
          <select value={edital} onChange={(ev) => setEdital(ev.target.value)}>
            {regrasDaArea.map((r) => (
              <option key={r.id} value={r.id}>
                {rotuloDoEdital(r)}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {escolha === "modelo" ? (
        <label className="avd-ast-escolha">
          <span>Modelo</span>
          <select value={modelo} onChange={(ev) => setModelo(ev.target.value)}>
            {daArea.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {!regrasDaArea.length && !carregandoApoio ? (
        <p className="ui-texto-secundario avd-ast-nota">
          Nenhuma regra conferida de outro edital da área.
        </p>
      ) : null}

      {confirmar ? (
        <Aviso tom="warning" papel="alert">
          Trocar o ponto de partida descarta as escolhas feitas no assistente.{" "}
          <button
            type="button"
            className="btn small"
            data-acao="confirmar-partida"
            onClick={() => escolhido && aoUsar(escolhido)}
          >
            Trocar mesmo assim
          </button>
        </Aviso>
      ) : null}

      <div className="ui-acoes">
        <button
          type="button"
          className="btn"
          data-acao="usar-partida"
          disabled={!escolhido}
          onClick={() => {
            if (!escolhido) return;
            if (temEscolhas) setConfirmar(true);
            else aoUsar(escolhido);
          }}
        >
          Usar este ponto de partida
          <i className="fa-solid fa-arrow-right" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
