import { useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { formatarData } from "../../lib/cronograma-do-edital.ts";
import type { EtapaDoCronograma } from "../../lib/cronograma-do-edital.ts";
import { problemaDoArquivo } from "../../lib/anexos-do-edital.ts";
import {
  bloqueioDaRetificacao,
  compararRetificacao,
  etapasRetificadas,
  motivoDaRetificacao,
  numeroDaErrata,
  problemasDaComparacao,
  resumoDaComparacao,
} from "../../lib/retificacao-do-cronograma.ts";
import type {
  AjustesDaRetificacao,
  LinhaDaComparacao,
  RetificacaoLida,
  SituacaoDaEtapa,
} from "../../lib/retificacao-do-cronograma.ts";
import { Aviso, Campo, Selo } from "../../ui/index.ts";

/** O que a seção usa do estado da página (`estado.ts`). */
export interface EstadoDaRetificacao {
  /** A resposta da função Python para o PDF da retificação. */
  lerRetificacao(arquivo: File): Promise<RetificacaoLida>;
}

/** O que "Aplicar retificação" grava (`salvar_monitoramento_com_cronograma_v2`). */
export interface RetificacaoParaAplicar {
  etapas: EtapaDoCronograma[];
  motivo: string;
  errata: string;
}

export interface PropriedadesDeLancarRetificacao {
  estado: EstadoDaRetificacao;
  /** O número do edital aberto no formulário. */
  numeroDoEdital: string;
  /** O cronograma gravado (o rascunho do editor). */
  etapas: readonly EtapaDoCronograma[];
  /** Por que não dá para aplicar agora ("" se dá): formulário mexido, carregando… */
  impedimento?: string;
  aoAplicar: (dados: RetificacaoParaAplicar) => Promise<boolean>;
  aoFechar: () => void;
}

/*
  "Lançar retificação (PDF)" no editor de cronograma do edital. A pessoa
  escolhe o PDF da retificação publicada; a função Python lê o "Leia-se"; aqui
  se vê, etapa a etapa, o que muda no cronograma gravado (igual, data muda,
  etapa nova, etapa que sumiu), com os avisos da leitura. Dá para corrigir as
  datas, dizer a que etapa gravada uma etapa nova corresponde, deixar uma
  etapa nova de fora ou manter uma que sumiu. PDF de outro edital bloqueia.

  Nada é gravado até "Aplicar retificação", que salva o cronograma com o nome
  da retificação como número da errata e o SEI no motivo
  (`modal-do-edital.tsx` → `estado.salvarEdital`). Regras puras em
  `src/lib/retificacao-do-cronograma.ts`.
*/

const ROTULO: Record<SituacaoDaEtapa, { texto: string; tom: string }> = {
  igual: { texto: "Igual", tom: "neutro" },
  muda: { texto: "Data muda", tom: "pendente" },
  nova: { texto: "Etapa nova", tom: "revisar" },
  sumiu: { texto: "Sumiu", tom: "reprovado" },
};

const periodo = (inicio: string, fim: string) =>
  !inicio
    ? "—"
    : inicio === fim || !fim
      ? formatarData(inicio)
      : `${formatarData(inicio)} a ${formatarData(fim)}`;

function SituacaoDaLinha({ linha }: { linha: LinhaDaComparacao }) {
  const { texto, tom } = ROTULO[linha.situacao];
  return (
    <Selo tom={tom} className="retificacao-selo">
      {texto}
    </Selo>
  );
}

export function LancarRetificacao({
  estado,
  numeroDoEdital,
  etapas,
  impedimento = "",
  aoAplicar,
  aoFechar,
}: PropriedadesDeLancarRetificacao) {
  const entrada = useRef<HTMLInputElement>(null);
  const [lendo, setLendo] = useState(false);
  const [erro, setErro] = useState("");
  const [lida, setLida] = useState<RetificacaoLida | null>(null);
  const [ajustes, setAjustes] = useState<AjustesDaRetificacao>({});
  /* null = o motivo sugerido (acompanha os ajustes); texto = o que a pessoa escreveu. */
  const [motivo, setMotivo] = useState<string | null>(null);
  const [errata, setErrata] = useState("");
  const [aplicando, setAplicando] = useState(false);

  async function ler(evento: ChangeEvent<HTMLInputElement>) {
    const [arquivo] = [...(evento.target.files || [])];
    evento.target.value = "";
    if (!arquivo) return;
    const problema = problemaDoArquivo(arquivo);
    if (problema) {
      setErro(problema);
      return;
    }
    setLendo(true);
    setErro("");
    setLida(null);
    setAjustes({});
    setMotivo(null);
    try {
      const resposta = await estado.lerRetificacao(arquivo);
      setLida(resposta);
      setErrata(numeroDaErrata(resposta));
    } catch (e) {
      setErro((e as Error | null)?.message || String(e));
    } finally {
      setLendo(false);
    }
  }

  const bloqueio = bloqueioDaRetificacao(numeroDoEdital, lida);
  const linhas =
    lida && !bloqueio
      ? compararRetificacao(etapas, lida.leia_se || [], ajustes)
      : [];
  const resumo = resumoDaComparacao(linhas);
  const problemas = lida && !bloqueio ? problemasDaComparacao(linhas) : [];
  const motivoFinal = motivo ?? motivoDaRetificacao(lida, resumo);
  /* Etapas gravadas livres para o "corresponde a" de uma etapa nova. */
  const usadas = new Set(
    linhas
      .filter((l) => l.indicePdf !== null && l.indiceAtual !== null)
      .map((l) => l.indiceAtual!),
  );

  const mudarDatas = (p: number, campo: "inicio" | "fim", valor: string) =>
    setAjustes((atual) => {
      const linha = linhas.find((l) => l.indicePdf === p);
      const anterior = atual.datas?.[p] || {};
      const proximo = { ...anterior, [campo]: valor };
      // Etapa de um dia: o fim acompanha o início enquanto era igual a ele.
      if (campo === "inicio" && linha && linha.fim === linha.inicio)
        proximo.fim = valor;
      return { ...atual, datas: { ...atual.datas, [p]: proximo } };
    });
  const alternar = (lista: "ignorar" | "manter", indice: number) =>
    setAjustes((atual) => {
      const valores = new Set(atual[lista] || []);
      if (valores.has(indice)) valores.delete(indice);
      else valores.add(indice);
      return { ...atual, [lista]: [...valores] };
    });
  const parear = (p: number, valor: string) =>
    setAjustes((atual) => ({
      ...atual,
      pares: { ...atual.pares, [p]: valor === "" ? null : Number(valor) },
    }));

  const podeAplicar =
    Boolean(lida) &&
    !bloqueio &&
    !impedimento &&
    !problemas.length &&
    Boolean(motivoFinal.trim()) &&
    Boolean(errata.trim()) &&
    !aplicando;

  async function aplicar() {
    if (!podeAplicar) return;
    setAplicando(true);
    try {
      await aoAplicar({
        etapas: etapasRetificadas(linhas),
        motivo: motivoFinal.trim(),
        errata: errata.trim(),
      });
    } finally {
      setAplicando(false);
    }
  }

  return (
    <section
      id="retificacaoPdf"
      className="cronograma-copy-box retificacao-box"
      aria-labelledby="retificacaoPdfTitulo"
    >
      <div className="cronograma-bulk-head">
        <strong id="retificacaoPdfTitulo" className="cronograma-copy-heading">
          Lançar retificação (PDF)
        </strong>
        <button
          id="retificacaoFechar"
          type="button"
          className="btn outline"
          onClick={aoFechar}
        >
          Fechar
        </button>
      </div>
      <div className="cronograma-copy-controls retificacao-controles">
        <input
          ref={entrada}
          id="retificacaoArquivo"
          type="file"
          accept="application/pdf,.pdf"
          hidden
          onChange={(e) => void ler(e)}
        />
        <button
          id="retificacaoEscolher"
          className="btn secondary"
          type="button"
          disabled={lendo || aplicando}
          onClick={() => entrada.current?.click()}
        >
          {lendo ? (
            <>
              <i className="fa-solid fa-spinner fa-spin" aria-hidden="true" />{" "}
              Lendo o PDF…
            </>
          ) : (
            <>
              <i className="fa-solid fa-file-pdf" aria-hidden="true" /> Escolher
              PDF da retificação
            </>
          )}
        </button>
      </div>

      {erro && (
        <p className="cronograma-copy-feedback is-error" role="alert">
          {erro}
        </p>
      )}

      {lida && (
        <div className="anexos-resultado" role="status">
          <div id="retificacaoDocumento" className="anexos-linha">
            <div>
              <strong>{lida.rotulo || "Retificação"}</strong>
              {lida.edital ? ` · Edital ${lida.edital}` : ""}
              {lida.sei ? ` · SEI ${lida.sei}` : ""}
              {lida.assinada_em
                ? ` · assinada em ${formatarData(lida.assinada_em)}`
                : ""}
              {lida.arquivo ? ` (${lida.arquivo})` : ""}
            </div>
          </div>
          {bloqueio ? (
            <Aviso tom="danger" papel="alert" className="retificacao-bloqueio">
              <span id="retificacaoBloqueio">{bloqueio}</span>
            </Aviso>
          ) : null}
          {(lida.avisos || []).map((aviso) => (
            <p key={aviso} className="cronograma-copy-feedback is-warning">
              {aviso}
            </p>
          ))}
        </div>
      )}

      {linhas.length > 0 && (
        <>
          <p id="retificacaoResumo" className="retificacao-resumo">
            {`${resumo.mudam} com data nova · ${resumo.novas} nova(s) · ${resumo.somem} sai(em) · ${resumo.iguais} igual(is)`}
          </p>
          <div className="anexos-quadro retificacao-quadro">
            <table id="retificacaoComparacao" className="anexos-tabela">
              <thead>
                <tr>
                  <th>Situação</th>
                  <th>Etapa</th>
                  <th>Atual</th>
                  <th>Retificação</th>
                  <th>
                    <span className="sr-only">Escolha</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {linhas.map((linha) => {
                  const p = linha.indicePdf;
                  const nome =
                    linha.atual?.atividade || linha.pdf?.atividade || "";
                  return (
                    <tr
                      key={linha.chave}
                      data-situacao={linha.situacao}
                      data-incluir={linha.incluir ? "sim" : "nao"}
                      className="retificacao-linha"
                    >
                      <td>
                        <SituacaoDaLinha linha={linha} />
                      </td>
                      <td>
                        <span className="retificacao-etapa">{nome}</span>
                        {linha.atual &&
                        linha.pdf &&
                        linha.pdf.atividade &&
                        linha.pdf.atividade !== linha.atual.atividade ? (
                          <small className="retificacao-no-pdf">
                            No PDF: {linha.pdf.atividade}
                          </small>
                        ) : null}
                        {linha.avisos.map((aviso) => (
                          <small key={aviso} className="retificacao-aviso">
                            {aviso}
                          </small>
                        ))}
                      </td>
                      <td className="anexos-num">
                        {linha.atual
                          ? periodo(
                              linha.atual.data_inicio,
                              linha.atual.data_fim,
                            )
                          : "—"}
                      </td>
                      <td className="retificacao-datas">
                        {p === null ? (
                          "—"
                        ) : (
                          <>
                            <input
                              type="date"
                              aria-label={`Início de ${nome}`}
                              value={linha.inicio}
                              onChange={(e) =>
                                mudarDatas(p, "inicio", e.target.value)
                              }
                            />
                            <input
                              type="date"
                              aria-label={`Fim de ${nome}`}
                              value={linha.fim}
                              onChange={(e) =>
                                mudarDatas(p, "fim", e.target.value)
                              }
                            />
                          </>
                        )}
                      </td>
                      <td>
                        {linha.situacao === "sumiu" ? (
                          <label className="retificacao-escolha">
                            <input
                              type="checkbox"
                              checked={linha.incluir}
                              onChange={() =>
                                alternar("manter", linha.indiceAtual!)
                              }
                            />{" "}
                            Manter
                          </label>
                        ) : null}
                        {/* O par é escolhido na etapa nova e conferido quando os nomes diferem. */}
                        {p !== null &&
                        (linha.situacao === "nova" ||
                          ajustes.pares?.[p] !== undefined ||
                          linha.atual?.atividade !== linha.pdf?.atividade) ? (
                          <select
                            aria-label={`Etapa gravada que corresponde a ${linha.pdf?.atividade}`}
                            value={
                              linha.indiceAtual === null
                                ? ""
                                : String(linha.indiceAtual)
                            }
                            onChange={(e) => parear(p, e.target.value)}
                          >
                            <option value="">Etapa nova</option>
                            {etapas.map((etapa, a) =>
                              usadas.has(a) &&
                              linha.indiceAtual !== a ? null : (
                                <option key={a} value={String(a)}>
                                  {`É: ${etapa.atividade}`}
                                </option>
                              ),
                            )}
                          </select>
                        ) : null}
                        {linha.situacao === "nova" && p !== null ? (
                          <label className="retificacao-escolha">
                            <input
                              type="checkbox"
                              checked={linha.incluir}
                              onChange={() => alternar("ignorar", p)}
                            />{" "}
                            Incluir
                          </label>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="cronograma-governance-grid">
            <Campo rotulo="Motivo" obrigatorio>
              <textarea
                id="retificacaoMotivo"
                rows={2}
                maxLength={500}
                value={motivoFinal}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </Campo>
            <Campo rotulo="Número da errata" obrigatorio>
              <input
                id="retificacaoErrata"
                maxLength={100}
                value={errata}
                onChange={(e) => setErrata(e.target.value)}
              />
            </Campo>
          </div>

          {problemas.length || impedimento ? (
            <Aviso
              tom="warning"
              papel="status"
              className="retificacao-bloqueio"
            >
              <ul id="retificacaoPendencias">
                {impedimento ? <li>{impedimento}</li> : null}
                {problemas.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}

          <div className="cronograma-bulk-actions">
            <button
              id="retificacaoAplicar"
              type="button"
              className="btn green"
              disabled={!podeAplicar}
              onClick={() => void aplicar()}
            >
              {aplicando ? (
                <>
                  <i
                    className="fa-solid fa-spinner fa-spin"
                    aria-hidden="true"
                  />{" "}
                  Aplicando…
                </>
              ) : (
                <>
                  <i className="fa-solid fa-file-pen" aria-hidden="true" />{" "}
                  Aplicar retificação
                </>
              )}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
