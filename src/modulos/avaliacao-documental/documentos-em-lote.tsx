import { useCallback, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Espelho } from "../../lib/avaliacao-documental/espelho-de-nota.ts";
import { nomeDoZipDosEspelhos } from "../../lib/avaliacao-documental/espelho-em-pdf.ts";
import {
  filtrarPessoas,
  marcadas,
  type PessoaDoDocumento,
} from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import { formatNumberBR } from "../../lib/formatters";
import {
  Aviso,
  CaixaDeMarcarTodos,
  estadoDaMarcacao,
  TabelaInfinita,
  type ColunaDaTabela,
} from "../../ui/index.ts";
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
    própria lista marcável (Triagem › Comunicados de eliminação).
  - <DocumentosEmLote>: a lista pesquisável por código OU nome, com filtro de
    vaga, na TabelaInfinita (50 por vez, cabeçalho fixo, "Mostrando N de M")
    e a caixa "marcar todos" no cabeçalho (todos da busca, não só os
    desenhados), mais as ações numa barra fixa ao pé enquanto há marcação
    (Avaliação documental › Documentos › Espelhos das avaliações concluídas).

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
  /** Com marcação, a barra fica presa ao pé da tela (a lista é longa). */
  fixa?: boolean;
  /** O que vai à esquerda dos botões (ex.: "N marcada(s)" e "Limpar marcação"). */
  resumo?: ReactNode;
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
  fixa = false,
  resumo = null,
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

      <div
        className={`ui-acoes avd-docs-lote-acoes${fixa && (escolhidas.length || ocupado) ? " avd-docs-lote-acoes-fixa" : ""}`}
        data-acao={`${id}-barra`}
      >
        {resumo ? (
          <span className="avd-docs-lote-acoes-resumo">{resumo}</span>
        ) : null}
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

/* A busca e a vaga já recortam a lista: a tabela não filtra de novo. */
const semFiltro = <T,>(itens: readonly T[]) => itens;

export function DocumentosEmLote({
  pessoas,
  vagas,
  rotuloDoDetalhe,
  tituloDaTabela,
  ...acoes
}: Omit<PropsDasAcoesEmLote, "escolhidas" | "vaga" | "aoMudarOcupado"> & {
  pessoas: PessoaDoDocumento[];
  vagas: Vaga[];
  rotuloDoDetalhe: string;
  /** O título da tabela (ex.: "Avaliações concluídas"). */
  tituloDaTabela: string;
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
  const escolhidas = useMemo(
    () => marcadas(pessoas, selecao),
    [pessoas, selecao],
  );
  const marcadasNaBusca = useMemo(
    () => filtradas.filter((p) => selecao.has(p.chave)).length,
    [filtradas, selecao],
  );

  const alternar = useCallback((chave: string, sim: boolean) => {
    setSelecao((atual) => {
      const nova = new Set(atual);
      if (sim) nova.add(chave);
      else nova.delete(chave);
      return nova;
    });
  }, []);

  // A caixa do cabeçalho: todos da busca e da vaga, não só as linhas desenhadas.
  const marcarFiltradas = useCallback(
    (sim: boolean) =>
      setSelecao((atual) => {
        const nova = new Set(atual);
        for (const p of filtradas) {
          if (sim) nova.add(p.chave);
          else nova.delete(p.chave);
        }
        return nova;
      }),
    [filtradas],
  );

  const colunas = useMemo<ColunaDaTabela[]>(
    () => [
      {
        rotulo: "Marcar",
        chave: "marcar",
        largura: "2.75rem",
        cabecalho: (
          <CaixaDeMarcarTodos
            rotulo={
              busca || vaga ? "Marcar todos da busca" : "Marcar todos da lista"
            }
            estado={estadoDaMarcacao(marcadasNaBusca, filtradas.length)}
            desabilitada={ocupado || !filtradas.length}
            acao={`${id}-marcar-todos`}
            aoMudar={marcarFiltradas}
          />
        ),
      },
      { rotulo: "Código" },
      { rotulo: "Nome" },
      { rotulo: "Vaga" },
      { rotulo: rotuloDoDetalhe },
    ],
    [
      busca,
      vaga,
      marcadasNaBusca,
      filtradas.length,
      ocupado,
      id,
      marcarFiltradas,
      rotuloDoDetalhe,
    ],
  );

  const linha = useCallback(
    (p: PessoaDoDocumento) => (
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
    ),
    [selecao, ocupado, alternar],
  );

  return (
    <div className="avd-docs-lote" data-acao={`${id}-lote`}>
      <TabelaInfinita
        idDoTitulo={`${id}-titulo`}
        titulo={tituloDaTabela}
        className="avd-docs-lote-tabela"
        classeDaTabela="avd-tabela"
        busca={{
          placeholder: "Código da Empregare ou nome",
          rotulo: "Buscar por código ou nome",
          id: `${id}-busca`,
          valor: busca,
          aoMudar: setBusca,
        }}
        ferramentas={
          <select
            className="ui-tabela-busca avd-docs-lote-vaga"
            aria-label="Vaga"
            value={vaga}
            data-acao={`${id}-vaga`}
            onChange={(ev) => setVaga(ev.target.value)}
          >
            <option value="">Todas as vagas</option>
            {vagas.map((v) => (
              <option key={String(v.codigo)} value={String(v.codigo)}>
                {v.cargo ? `${v.codigo} · ${v.cargo}` : String(v.codigo)}
              </option>
            ))}
          </select>
        }
        colunas={colunas}
        carregado
        itens={filtradas}
        filtrarPelaBusca={semFiltro}
        linha={linha}
        total={pessoas.length}
        informacao={(quantos) =>
          quantos === null
            ? ""
            : busca || vaga
              ? `${formatNumberBR(quantos)} na busca`
              : `${formatNumberBR(quantos)} no edital`
        }
        vazio={
          <span data-acao={`${id}-vazio`}>
            Ninguém neste edital para este documento.
          </span>
        }
      />

      <AcoesEmLote
        {...acoes}
        escolhidas={escolhidas}
        vaga={vaga}
        aoMudarOcupado={setOcupado}
        fixa
        resumo={
          <>
            <strong data-acao={`${id}-marcadas`}>
              {escolhidas.length.toLocaleString("pt-BR")} marcada(s)
            </strong>
            {selecao.size ? (
              <button
                type="button"
                className="btn ghost small"
                disabled={ocupado}
                data-acao={`${id}-limpar`}
                onClick={() => setSelecao(new Set())}
              >
                Limpar marcação
              </button>
            ) : null}
          </>
        }
      />
    </div>
  );
}
