import { useMemo, useRef, useState } from "react";
import type { Espelho } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import { nomeDoZipDosEspelhos } from "../../lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  filtrarPessoas,
  LINHAS_VISIVEIS,
  marcadas,
  type PessoaDoDocumento,
} from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import { Aviso, Campo } from "../../ui/index.ts";
import {
  abrirEspelhosEmMassa,
  baixarEspelhoProntoEmPdf,
  baixarZipDosEspelhos,
} from "./ficha/espelho-de-nota.ts";

/*
  Documentos em lote, no mesmo padrão dos Espelhos em massa: um PDF (uma
  pessoa marcada), ZIP com um PDF por pessoa (gerado no navegador, em lotes,
  com "x de N" e Cancelar) ou um documento só para imprimir. Nada é gravado.

  - <AcoesEmLote>: só os botões, o progresso e os avisos, para quem já tem a
    própria lista marcável (Pré-classificação › Comunicados de eliminação).
  - <DocumentosEmLote>: a lista pesquisável por código OU nome, com filtro de
    vaga e "Marcar as da busca", mais as ações (Avaliação documental ›
    Documentos › Espelhos das avaliações concluídas).

  Regras puras: src/lib/avaliacao-documental/documentos-em-lote.ts.
*/

type Vaga = { codigo: string | number; cargo?: string | null };

/** Monta os documentos das pessoas marcadas (pode ir ao banco); null = cancelado. */
export type MontarDocumentos = (
  escolhidas: PessoaDoDocumento[],
  cancelado: () => boolean,
) => Promise<{ documentos: Espelho[]; avisos: string[] } | null>;

type Saida = "pdf" | "zip" | "imprimir";

export interface PropsDasAcoesEmLote {
  /** Prefixo dos data-acao (ex.: "comunicados", "espelhos-concluidos"). */
  id: string;
  escolhidas: PessoaDoDocumento[];
  /** "comunicado" ou "espelho", no singular. */
  rotuloDoDocumento: string;
  /** O título do documento de impressão. */
  tituloDaImpressao: string;
  prefixoDoZip: string;
  edital: string;
  /** A vaga do filtro ("" = todas), no nome do ZIP. */
  vaga?: string;
  montar: MontarDocumentos;
  aoMudarOcupado?: (ocupado: boolean) => void;
  baixarPdf?: (espelho: Espelho) => Promise<string>;
  baixarZip?: typeof baixarZipDosEspelhos;
  abrir?: (espelhos: Espelho[], opcoes?: { titulo?: string }) => void;
  agora?: () => Date;
}

export function AcoesEmLote({
  id,
  escolhidas,
  rotuloDoDocumento,
  tituloDaImpressao,
  prefixoDoZip,
  edital,
  vaga = "",
  montar,
  aoMudarOcupado = () => {},
  baixarPdf = baixarEspelhoProntoEmPdf,
  baixarZip = baixarZipDosEspelhos,
  abrir = abrirEspelhosEmMassa,
  agora = () => new Date(),
}: PropsDasAcoesEmLote) {
  const [etapa, setEtapa] = useState<"" | "lendo" | "pdfs">("");
  const [pdfs, setPdfs] = useState<{ feitos: number; total: number } | null>(
    null,
  );
  const [erro, setErro] = useState("");
  const [aviso, setAviso] = useState("");
  const [avisos, setAvisos] = useState<string[]>([]);
  const cancelar = useRef(false);
  const ocupado = etapa !== "";
  const plural = (n: number) =>
    `${n.toLocaleString("pt-BR")} ${rotuloDoDocumento}${n === 1 ? "" : "s"}`;

  function ocupar(nova: "" | "lendo" | "pdfs") {
    setEtapa(nova);
    aoMudarOcupado(nova !== "");
  }

  async function gerar(saida: Saida) {
    setErro("");
    setAviso("");
    setAvisos([]);
    cancelar.current = false;
    ocupar("lendo");
    try {
      const montados = await montar(escolhidas, () => cancelar.current);
      if (!montados) return;
      setAvisos(montados.avisos);
      const { documentos } = montados;
      if (!documentos.length) {
        setAviso(`Nenhum ${rotuloDoDocumento} disponível para as marcadas.`);
        return;
      }
      if (saida === "pdf" && documentos.length === 1) {
        const arquivo = await baixarPdf(documentos[0]!);
        setAviso(`Arquivo preparado: ${arquivo}`);
      } else if (saida === "imprimir") {
        abrir(documentos, { titulo: tituloDaImpressao });
        setAviso(`${plural(documentos.length)} no documento para imprimir.`);
      } else {
        const arquivo = nomeDoZipDosEspelhos(
          edital,
          agora(),
          vaga || null,
          prefixoDoZip,
        );
        ocupar("pdfs");
        setPdfs({ feitos: 0, total: documentos.length });
        const feitos = await baixarZip(documentos, arquivo, {
          aoProgredir: (f, total) => setPdfs({ feitos: f, total }),
          cancelado: () => cancelar.current,
        });
        if (feitos !== null) setAviso(`${plural(feitos)} em ${arquivo}.`);
      }
    } catch (e) {
      setErro(
        e instanceof Error
          ? e.message
          : `Não foi possível gerar o ${rotuloDoDocumento}.`,
      );
    } finally {
      ocupar("");
      setPdfs(null);
    }
  }

  return (
    <>
      {pdfs ? (
        <div className="avd-espelhos-progresso" role="status">
          <progress
            max={Math.max(pdfs.total, 1)}
            value={pdfs.feitos}
            aria-label="PDFs gerados"
          />
          <span>
            {pdfs.feitos.toLocaleString("pt-BR")} de{" "}
            {pdfs.total.toLocaleString("pt-BR")} PDFs…
          </span>
        </div>
      ) : etapa === "lendo" ? (
        <p role="status" className="ui-texto-secundario">
          Preparando…
        </p>
      ) : null}

      <div className="ui-acoes avd-docs-lote-acoes">
        {ocupado ? (
          <button
            type="button"
            className="btn secondary"
            onClick={() => {
              cancelar.current = true;
            }}
          >
            Cancelar
          </button>
        ) : null}
        <button
          type="button"
          className="btn secondary"
          data-acao={`${id}-pdf`}
          disabled={ocupado || escolhidas.length !== 1}
          title={
            escolhidas.length === 1 ? undefined : "Marque exatamente uma pessoa"
          }
          onClick={() => void gerar("pdf")}
        >
          <i className="fa-regular fa-file-pdf" aria-hidden="true" /> Baixar PDF
        </button>
        <button
          type="button"
          className="btn secondary"
          data-acao={`${id}-imprimir`}
          disabled={ocupado || !escolhidas.length}
          onClick={() => void gerar("imprimir")}
        >
          <i className="fa-solid fa-print" aria-hidden="true" /> Imprimir
          {escolhidas.length ? ` (${escolhidas.length})` : ""}
        </button>
        <button
          type="button"
          className="btn primary"
          data-acao={`${id}-zip`}
          disabled={ocupado || !escolhidas.length}
          onClick={() => void gerar("zip")}
        >
          <i className="fa-regular fa-file-zipper" aria-hidden="true" /> Baixar
          ZIP{escolhidas.length ? ` (${escolhidas.length})` : ""}
        </button>
      </div>

      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      {aviso ? (
        <Aviso tom="info" papel="status">
          {aviso}
        </Aviso>
      ) : null}
      {avisos.length ? (
        <Aviso tom="warning">
          <span data-acao={`${id}-avisos`}>{avisos.join(" ")}</span>
        </Aviso>
      ) : null}
    </>
  );
}

export function DocumentosEmLote({
  pessoas,
  vagas,
  rotuloDoDetalhe,
  ...acoes
}: Omit<PropsDasAcoesEmLote, "escolhidas" | "vaga" | "aoMudarOcupado"> & {
  pessoas: PessoaDoDocumento[];
  vagas: Vaga[];
  rotuloDoDetalhe: string;
}) {
  const { id } = acoes;
  const [busca, setBusca] = useState("");
  const [vaga, setVaga] = useState("");
  const [selecao, setSelecao] = useState(() => new Set<string>());
  const [ocupado, setOcupado] = useState(false);

  const filtradas = useMemo(
    () => filtrarPessoas(pessoas, busca, vaga),
    [pessoas, busca, vaga],
  );
  const visiveis = filtradas.slice(0, LINHAS_VISIVEIS);
  const escolhidas = useMemo(
    () => marcadas(pessoas, selecao),
    [pessoas, selecao],
  );
  const todasFiltradasMarcadas =
    filtradas.length > 0 && filtradas.every((p) => selecao.has(p.chave));

  function alternar(chave: string, sim: boolean) {
    setSelecao((atual) => {
      const nova = new Set(atual);
      if (sim) nova.add(chave);
      else nova.delete(chave);
      return nova;
    });
  }

  function marcarFiltradas(sim: boolean) {
    setSelecao((atual) => {
      const nova = new Set(atual);
      for (const p of filtradas) {
        if (sim) nova.add(p.chave);
        else nova.delete(p.chave);
      }
      return nova;
    });
  }

  return (
    <div className="avd-docs-lote" data-acao={`${id}-lote`}>
      <div className="avd-espelhos-individual">
        <Campo rotulo="Buscar por código ou nome">
          <input
            type="search"
            value={busca}
            placeholder="Código da Empregare ou nome"
            disabled={ocupado}
            data-acao={`${id}-busca`}
            onChange={(ev) => setBusca(ev.target.value)}
          />
        </Campo>
        <Campo rotulo="Vaga">
          <select
            value={vaga}
            disabled={ocupado}
            onChange={(ev) => setVaga(ev.target.value)}
          >
            <option value="">Todas as vagas</option>
            {vagas.map((v) => (
              <option key={String(v.codigo)} value={String(v.codigo)}>
                {v.cargo ? `${v.codigo} · ${v.cargo}` : String(v.codigo)}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <div className="avd-docs-lote-resumo">
        <span>
          {filtradas.length.toLocaleString("pt-BR")} na busca ·{" "}
          <strong data-acao={`${id}-marcadas`}>
            {escolhidas.length.toLocaleString("pt-BR")} marcada(s)
          </strong>
        </span>
        <span className="ui-acoes">
          <button
            type="button"
            className="btn ghost small"
            disabled={ocupado || !filtradas.length}
            data-acao={`${id}-marcar-filtradas`}
            onClick={() => marcarFiltradas(!todasFiltradasMarcadas)}
          >
            {todasFiltradasMarcadas
              ? "Desmarcar as da busca"
              : `Marcar as da busca (${filtradas.length.toLocaleString("pt-BR")})`}
          </button>
          {selecao.size ? (
            <button
              type="button"
              className="btn ghost small"
              disabled={ocupado}
              onClick={() => setSelecao(new Set())}
            >
              Limpar marcação
            </button>
          ) : null}
        </span>
      </div>

      {pessoas.length ? (
        <div className="ui-tabela-rolagem avd-docs-lote-tabela">
          <table className="avd-tabela">
            <thead>
              <tr>
                <th scope="col" className="avd-docs-lote-marca">
                  <span className="sr-only">Marcar</span>
                </th>
                <th scope="col">Código</th>
                <th scope="col">Nome</th>
                <th scope="col">Vaga</th>
                <th scope="col">{rotuloDoDetalhe}</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((p) => (
                <tr key={p.chave} data-pessoa={p.codigo}>
                  <td className="avd-docs-lote-marca">
                    <input
                      type="checkbox"
                      aria-label={`Marcar ${p.codigo}`}
                      checked={selecao.has(p.chave)}
                      disabled={ocupado}
                      onChange={(ev) => alternar(p.chave, ev.target.checked)}
                    />
                  </td>
                  <td>{p.codigo}</td>
                  <td>{p.nome}</td>
                  <td>{p.vaga}</td>
                  <td>{p.detalhe}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length > visiveis.length ? (
            <p className="ui-texto-secundario">
              Mostrando {visiveis.length.toLocaleString("pt-BR")} de{" "}
              {filtradas.length.toLocaleString("pt-BR")}. Refine a busca ou use
              “Marcar as da busca”.
            </p>
          ) : null}
          {!filtradas.length ? (
            <p className="ui-texto-secundario">Ninguém encontrado na busca.</p>
          ) : null}
        </div>
      ) : (
        <p className="ui-texto-secundario" data-acao={`${id}-vazio`}>
          Ninguém neste edital para este documento.
        </p>
      )}

      <AcoesEmLote
        {...acoes}
        escolhidas={escolhidas}
        vaga={vaga}
        aoMudarOcupado={setOcupado}
      />
    </div>
  );
}
