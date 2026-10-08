import { useMemo, useState } from "react";
import {
  diferencasEntreRegras,
  fraseDaDiferenca,
} from "../../../lib/avaliacao-documental/comparar-regras.ts";
import {
  htmlDoResumo,
  paginaDoResumo,
  resumoDaRegra,
  textoDoResumo,
  type ContextoDoResumo,
} from "../../../lib/avaliacao-documental/resumo-da-regra.ts";
import type { PendenciaDoSalvar } from "../../../lib/avaliacao-documental/pendencias-do-salvar.ts";
import type {
  RegraAnalise,
  RegraSalva,
} from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import { rotuloDaVersao } from "../../../lib/nome-da-versao.ts";
import { Aviso, Campo, Selo } from "../../../ui/index.js";
import { CampoNomeDaVersao } from "../../../ui/nome-da-versao.tsx";
import {
  copiarParaAreaDeTransferencia,
  imprimirPagina,
} from "../../classificacao/documento-no-navegador.js";

/*
  Passo 5: testar e conferir. O resumo de uma página em linguagem simples
  (com "Copiar para o SEI" e imprimir), a comparação entre versões (a vigente
  e a nova, ou duas do histórico) e o salvar: versão nova com nome e motivo,
  pelo salvar_regra_analise de sempre. Ao lado do botão, a lista do que falta
  (pendencias-do-salvar.ts), cada item leva ao passo e ao campo. A prévia com
  candidato fictício (previa.tsx) fica junto, na tela do assistente.
*/

export type FerramentasDoDocumento = {
  copiar?: (conteudo: { html: string; texto: string }) => Promise<string>;
  imprimir?: (html: string) => void;
};

export function ResumoDaRegra({
  regra,
  contexto,
  copiar = copiarParaAreaDeTransferencia,
  imprimir = imprimirPagina,
}: {
  regra: RegraAnalise;
  contexto: ContextoDoResumo;
} & FerramentasDoDocumento) {
  const resumo = useMemo(
    () => resumoDaRegra(regra, contexto),
    [regra, contexto],
  );
  const [copiado, setCopiado] = useState("");
  return (
    <section
      className="ui-card avd-ast-resumo"
      aria-labelledby="avdAstResumo"
      data-tour="avd-assistente-resumo"
    >
      <div className="avd-bloco-topo">
        <h3 className="ui-titulo" id="avdAstResumo">
          Resumo da regra
        </h3>
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary small"
            data-acao="copiar-resumo"
            onClick={async () => {
              const como = await copiar({
                html: htmlDoResumo(resumo),
                texto: textoDoResumo(resumo),
              });
              setCopiado(como ? "Copiado." : "Não foi possível copiar.");
            }}
          >
            <i className="fa-solid fa-copy" aria-hidden="true" /> Copiar para o
            SEI
          </button>
          <button
            type="button"
            className="btn secondary small"
            data-acao="imprimir-resumo"
            onClick={() => imprimir(paginaDoResumo(resumo))}
          >
            <i className="fa-solid fa-print" aria-hidden="true" /> Imprimir
          </button>
          {copiado ? (
            <span className="ui-texto-secundario" role="status">
              {copiado}
            </span>
          ) : null}
        </div>
      </div>
      <p className="avd-ast-resumo-sub">
        <strong>{resumo.titulo}</strong>
        {resumo.subtitulo ? ` · ${resumo.subtitulo}` : ""}
      </p>
      <div className="avd-ast-resumo-secoes">
        {resumo.secoes.map((s) => (
          <div key={s.titulo} className="avd-ast-resumo-secao">
            <h4>{s.titulo}</h4>
            <ul>
              {s.itens.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

const NOVA = "nova";

export function ComparacaoDeVersoes({
  regraSalva,
  rascunho,
}: {
  regraSalva: RegraSalva | null;
  rascunho: RegraAnalise | null;
}) {
  const versoes = regraSalva?.versoes ?? [];
  const [a, setA] = useState(String(regraSalva?.versao ?? ""));
  const [b, setB] = useState(
    rascunho ? NOVA : String(versoes[1]?.versao ?? regraSalva?.versao ?? ""),
  );
  const configuracao = (valor: string) =>
    valor === NOVA
      ? rascunho
      : (versoes.find((v) => String(v.versao) === valor)?.configuracao ?? null);
  const antes = configuracao(a);
  const depois = configuracao(b);
  const diferencas = useMemo(
    () => (antes && depois ? diferencasEntreRegras(antes, depois) : []),
    [antes, depois],
  );
  if (!versoes.length && !rascunho) return null;
  const opcoes = [
    ...(rascunho ? [{ valor: NOVA, rotulo: "Nova (este rascunho)" }] : []),
    ...versoes.map((v) => ({
      valor: String(v.versao),
      rotulo: `${rotuloDaVersao(v)}${v.versao === regraSalva?.versao ? " (vigente)" : ""}`,
    })),
  ];
  const seletor = (
    rotulo: string,
    valor: string,
    mudar: (v: string) => void,
  ) => (
    <Campo rotulo={rotulo}>
      <select value={valor} onChange={(ev) => mudar(ev.target.value)}>
        {opcoes.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.rotulo}
          </option>
        ))}
      </select>
    </Campo>
  );
  return (
    <section
      className="ui-card avd-ast-comparar"
      aria-labelledby="avdAstComparar"
      data-tour="avd-assistente-comparar"
    >
      <h3 className="ui-titulo" id="avdAstComparar">
        Comparar versões
      </h3>
      <div className="avd-linha">
        {seletor("De", a, setA)}
        {seletor("Para", b, setB)}
      </div>
      {!antes || !depois ? null : diferencas.length ? (
        <ul className="avd-ast-diferencas">
          {diferencas.map((d, i) => (
            <li key={`${d.onde}:${i}`} data-tipo={d.tipo}>
              <Selo
                tom={
                  d.tipo === "entrou"
                    ? "aprovado"
                    : d.tipo === "saiu"
                      ? "reprovado"
                      : "revisar"
                }
              >
                {d.tipo === "entrou"
                  ? "Entrou"
                  : d.tipo === "saiu"
                    ? "Saiu"
                    : "Mudou"}
              </Selo>{" "}
              <span>
                {fraseDaDiferenca(d).replace(/^(Entrou|Saiu|Mudou): /, "")}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ui-texto-secundario">Sem diferenças.</p>
      )}
    </section>
  );
}

function ListaDoQueFalta({
  pendencias,
  aoIrPara,
}: {
  pendencias: PendenciaDoSalvar[];
  aoIrPara: (p: PendenciaDoSalvar) => void;
}) {
  const impedem = pendencias.filter((p) => p.impede);
  const conferir = pendencias.filter((p) => !p.impede);
  const item = (p: PendenciaDoSalvar) => (
    <li key={p.texto}>
      <button
        type="button"
        className="avd-ast-falta-item"
        data-passo-alvo={p.passo}
        onClick={() => aoIrPara(p)}
      >
        <i
          className={`fa-solid ${p.impede ? "fa-circle-exclamation" : "fa-circle-info"}`}
          aria-hidden="true"
        />
        <span>{p.texto}</span>
        <i className="fa-solid fa-arrow-right" aria-hidden="true" />
      </button>
    </li>
  );
  return (
    <div className="avd-ast-falta" data-tour="avd-assistente-o-que-falta">
      {impedem.length ? (
        <div role="status" data-impede="sim">
          <h4>Para salvar, falta</h4>
          <ul>{impedem.slice(0, 12).map(item)}</ul>
        </div>
      ) : null}
      {conferir.length ? (
        <div data-impede="nao">
          <h4>Confira também</h4>
          <ul>{conferir.slice(0, 12).map(item)}</ul>
        </div>
      ) : null}
    </div>
  );
}

export function BarraDeSalvar({
  versaoNova,
  pendencias,
  aoIrPara,
  motivo,
  aoMudarMotivo,
  motivoObrigatorio,
  salvaClassificacao,
  podeDescartar,
  salvando,
  erroDoBanco,
  aoSalvar,
  aoDescartar,
  pedeNome = false,
  nome = null,
  sugestaoDoNome = "",
  aoMudarNome,
}: {
  versaoNova: number;
  /** O que falta (pendenciasDoSalvar): os que impedem desabilitam o botão. */
  pendencias: PendenciaDoSalvar[];
  aoIrPara: (p: PendenciaDoSalvar) => void;
  motivo: string;
  aoMudarMotivo: (m: string) => void;
  /** Mostra "Nome desta versão" (só quando a regra muda: versão nova). */
  pedeNome?: boolean;
  nome?: string | null;
  sugestaoDoNome?: string;
  aoMudarNome?: (n: string | null) => void;
  motivoObrigatorio: boolean;
  salvaClassificacao: boolean;
  /** Há alteração para descartar. */
  podeDescartar: boolean;
  salvando: boolean;
  erroDoBanco: string;
  aoSalvar: () => void;
  aoDescartar: () => void;
}) {
  const impede = pendencias.some((p) => p.impede);
  return (
    <section className="ui-card avd-ast-salvar" aria-label="Salvar a regra">
      {erroDoBanco ? (
        <Aviso tom="danger" papel="alert">
          {erroDoBanco}
        </Aviso>
      ) : null}
      <div className="avd-ast-salvar-campos">
        {pedeNome && aoMudarNome ? (
          <div data-campo="nome">
            <CampoNomeDaVersao
              valor={nome}
              sugestao={sugestaoDoNome}
              aoMudar={aoMudarNome}
              mostrarErro
            />
          </div>
        ) : null}
        <div data-campo="motivo">
          <Campo rotulo="Motivo da alteração" obrigatorio={motivoObrigatorio}>
            <input
              value={motivo}
              maxLength={2000}
              onChange={(ev) => aoMudarMotivo(ev.target.value)}
            />
          </Campo>
        </div>
      </div>
      {salvaClassificacao ? (
        <p className="avd-ast-nota" data-salva-classificacao="sim">
          <i className="fa-solid fa-link" aria-hidden="true" /> Também salva a
          nota mínima e o desempate na regra de classificação.
        </p>
      ) : null}
      <div className="avd-ast-salvar-rodape">
        {pendencias.length ? (
          <ListaDoQueFalta pendencias={pendencias} aoIrPara={aoIrPara} />
        ) : null}
        <div className="ui-acoes">
          <button
            type="button"
            className="btn secondary"
            disabled={!podeDescartar || salvando}
            onClick={aoDescartar}
          >
            Descartar
          </button>
          <button
            type="button"
            className="btn"
            data-acao="salvar-assistente"
            disabled={salvando || impede}
            onClick={aoSalvar}
          >
            <i className="fa-solid fa-floppy-disk" aria-hidden="true" /> Salvar
            como versão {versaoNova}
          </button>
        </div>
      </div>
    </section>
  );
}
