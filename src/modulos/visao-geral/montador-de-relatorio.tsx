import type { Configuracoes, Perfil, TextosDaVisaoGeral } from "./tipos.ts";
import type {
  EscolhaDoRelatorio,
  FormatoDoRelatorio,
  RecorteDoRelatorio,
} from "../../lib/relatorio-da-visao-geral.ts";
import type { ClienteDoRelatorio } from "./dados-da-diretoria.ts";
import { useEffect, useRef, useState } from "react";
import { Modal, Segmentado } from "../../ui/index.ts";
import { CHAVE_DO_CABECALHO } from "../../lib/cabecalho-dos-documentos.ts";
import { erroDeVersaoNova } from "../../lib/importar-com-recarga.ts";
import { nomeDaArea } from "../../lib/menu-lateral.ts";
import { csvDaVisaoGeral, nomeDoCsv } from "../../lib/visao-geral.ts";
import {
  aprovadosNoRecorte,
  LIMITE_DE_APROVADOS_NO_PDF,
  linhasDeAprovados,
  linhasPorCargo,
} from "../../lib/relatorio-da-diretoria.ts";
import {
  alternarNaEscolha,
  COLUNAS_DO_RELATORIO,
  conteudoDoRelatorio,
  FORMATOS_DO_RELATORIO,
  MODELOS_DO_RELATORIO,
  modeloDaEscolha,
  nomeDoArquivoDoRelatorio,
  normalizarEscolha,
  SECOES_DO_RELATORIO,
  secoesPermitidas,
  xlsxDoRelatorio,
} from "../../lib/relatorio-da-visao-geral.ts";
import {
  baixarAprovadosDaDiretoria,
  lerVagasPorCargo,
} from "./dados-da-diretoria.ts";

/*
  O MONTADOR DE RELATÓRIO da Visão geral (botão "Exportar", com o recorte da
  tela) e dos Painéis (botão "Montar relatório", com a área inteira —
  src/modulos/paineis-de-dados/): um modelo pronto
  ou a escolha de quem gera — as seções, as colunas da tabela dos editais e o
  formato (PDF, Excel ou o CSV de antes). Sai do recorte recebido. A última
  escolha fica guardada neste navegador. "Vagas por cargo" e "Aprovados" (abas
  2 e 3 do relatório da diretoria) são lidas do banco ao gerar; "Aprovados" só
  aparece para quem tem acesso à Lista de aprovados, e o banco registra cada
  download. A lógica está em
  src/lib/relatorio-da-visao-geral.ts; o PDF, em
  src/lib/relatorio-da-visao-geral-em-pdf.ts.
*/

export const CHAVE_DA_ESCOLHA = "yeende_relatorio_visao_geral_v1";

function lerEscolha(): EscolhaDoRelatorio {
  try {
    return normalizarEscolha(
      JSON.parse(globalThis.localStorage?.getItem(CHAVE_DA_ESCOLHA) || "null"),
    );
  } catch {
    return normalizarEscolha(null);
  }
}
function guardarEscolha(escolha: EscolhaDoRelatorio) {
  try {
    globalThis.localStorage?.setItem(CHAVE_DA_ESCOLHA, JSON.stringify(escolha));
  } catch {
    // Sem armazenamento: a escolha vale só agora.
  }
}

function baixar(arquivo: Blob, nome: string) {
  const url = URL.createObjectURL(arquivo);
  const ancora = document.createElement("a");
  ancora.href = url;
  ancora.download = nome;
  ancora.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function gerarPdf(
  conteudo: ReturnType<typeof conteudoDoRelatorio>,
  cabecalho: string,
) {
  const [{ carregarBibliotecasDoPdf }, { pdfDoRelatorio }, { logoEmPng }] =
    await Promise.all([
      import("../../lib/avaliacao-documental/espelho-em-pdf.ts"),
      import("../../lib/relatorio-da-visao-geral-em-pdf.ts"),
      import("../classificacao/documento-no-navegador.ts"),
    ]).catch((erro: unknown) => {
      throw erroDeVersaoNova(erro);
    });
  const [bibliotecas, logo] = await Promise.all([
    carregarBibliotecasDoPdf(),
    logoEmPng().catch(() => null),
  ]);
  const bytes = await pdfDoRelatorio(conteudo, bibliotecas, {
    cabecalho,
    logo,
  });
  return new Blob([bytes], { type: "application/pdf" });
}

async function gerarXlsx(conteudo: ReturnType<typeof conteudoDoRelatorio>) {
  const fflate = await import("fflate").catch((erro: unknown) => {
    throw erroDeVersaoNova(erro);
  });
  const bytes = xlsxDoRelatorio(conteudo, (arquivos, opcoes) =>
    fflate.zipSync(arquivos, opcoes),
  );
  return new Blob([new Uint8Array(bytes)], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

function Marcar<T extends string>({
  titulo,
  itens,
  marcados,
  aoMudar,
  desabilitado,
}: {
  titulo: string;
  itens: readonly { id: T; rotulo: string }[];
  marcados: readonly T[];
  aoMudar: (proximos: T[]) => void;
  desabilitado?: boolean;
}) {
  const todos = itens.map((i) => i.id);
  return (
    <fieldset className="visao-geral-relatorio-grupo" disabled={desabilitado}>
      <legend>{titulo}</legend>
      {itens.map((item) => (
        <label key={item.id}>
          <input
            type="checkbox"
            checked={marcados.includes(item.id)}
            onChange={() =>
              aoMudar(alternarNaEscolha(todos, marcados, item.id))
            }
          />
          {item.rotulo}
        </label>
      ))}
    </fieldset>
  );
}

export function MontadorDeRelatorio({
  e,
  descricao = "do recorte da tela",
  aoBaixarCsv,
  textos,
  configuracoes,
  obterPerfil,
  agora,
  aoFechar,
  supabase = null,
  podeAprovados = false,
}: {
  e: RecorteDoRelatorio;
  /** De onde vêm os processos, no subtítulo ("do recorte da tela", "da área"). */
  descricao?: string;
  /** O CSV de antes; sem ele, o montador baixa o CSV das linhas do recorte. */
  aoBaixarCsv?: () => void;
  textos: TextosDaVisaoGeral;
  configuracoes: Configuracoes;
  obterPerfil: () => Perfil | null;
  agora: () => Date;
  aoFechar: () => void;
  supabase?: ClienteDoRelatorio | null;
  podeAprovados?: boolean;
}) {
  const [escolha, setEscolha] = useState<EscolhaDoRelatorio>(lerEscolha);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const aberto = useRef(true);
  useEffect(() => {
    aberto.current = true;
    return () => {
      aberto.current = false;
    };
  }, []);

  const mudar = (parcial: Partial<EscolhaDoRelatorio>) =>
    setEscolha((atual) => ({ ...atual, ...parcial }));
  const modelo = modeloDaEscolha(escolha);
  const csv = escolha.formato === "CSV";
  const semEditais = !escolha.secoes.includes("editais");
  const permitidas = secoesPermitidas(podeAprovados);
  const secoes = escolha.secoes.filter((s) => permitidas.includes(s));

  async function gerar() {
    setErro("");
    guardarEscolha(escolha);
    if (csv) {
      if (aoBaixarCsv) aoBaixarCsv();
      else if (e.filtradas.length)
        baixar(
          new Blob([csvDaVisaoGeral(e.filtradas)], {
            type: "text/csv;charset=utf-8;",
          }),
          nomeDoCsv(e.area, agora()),
        );
      aoFechar();
      return;
    }
    setGerando(true);
    try {
      const area = e.area;
      const editais = e.filtradas
        .map((l) => String(l.id ?? ""))
        .filter(Boolean);
      const comAprovados = secoes.includes("aprovados");
      if (
        comAprovados &&
        escolha.formato === "PDF" &&
        aprovadosNoRecorte(e.filtradas) > LIMITE_DE_APROVADOS_NO_PDF
      )
        throw new Error(
          `São ${aprovadosNoRecorte(e.filtradas).toLocaleString("pt-BR")} aprovados no recorte: acima de ${LIMITE_DE_APROVADOS_NO_PDF.toLocaleString("pt-BR")}, gere em Excel ou filtre os editais.`,
        );
      const [vagas, exportacao] = await Promise.all([
        secoes.includes("cargos")
          ? lerVagasPorCargo(supabase, area, editais)
          : null,
        comAprovados
          ? baixarAprovadosDaDiretoria(supabase, area, escolha.formato, editais)
          : null,
      ]);
      const conteudo = conteudoDoRelatorio({
        escolha: { ...escolha, secoes },
        linhas: e.filtradas,
        filtros: e.filtros,
        busca: e.busca,
        atalho: e.atalho,
        area: e.area,
        rotuloDaArea: nomeDaArea(e.area) || e.area,
        indicadores: e.indicadores,
        textos,
        quem: String(obterPerfil()?.nome || ""),
        agora: agora(),
        porCargo: vagas ? linhasPorCargo(vagas, e.filtradas) : null,
        aprovados: exportacao
          ? {
              linhas: linhasDeAprovados(exportacao.aprovados, e.filtradas),
              registro: exportacao.id,
            }
          : null,
      });
      const cabecalho = String(
        configuracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
      );
      const arquivo =
        escolha.formato === "PDF"
          ? await gerarPdf(conteudo, cabecalho)
          : await gerarXlsx(conteudo);
      if (!aberto.current) return;
      baixar(
        arquivo,
        nomeDoArquivoDoRelatorio(e.area, escolha.formato, agora()),
      );
      aoFechar();
    } catch (falha) {
      if (aberto.current)
        setErro(
          falha instanceof Error && falha.message
            ? falha.message
            : "Não foi possível gerar o relatório.",
        );
    } finally {
      if (aberto.current) setGerando(false);
    }
  }

  return (
    <Modal
      id="visaoGeralRelatorio"
      className="visao-geral-relatorio"
      rotuloId="visaoGeralRelatorioTitulo"
      aoFechar={aoFechar}
      tamanho="medio"
    >
      <div className="modal-head">
        <div>
          <h3 id="visaoGeralRelatorioTitulo">Montar relatório</h3>
          <p className="visao-geral-relatorio-recorte">
            {e.filtradas.length.toLocaleString("pt-BR")}{" "}
            {e.filtradas.length === 1 ? "processo" : "processos"} {descricao} ·{" "}
            {nomeDaArea(e.area) || e.area}
          </p>
        </div>
        <button className="btn secondary" type="button" onClick={aoFechar}>
          Fechar
        </button>
      </div>
      <div className="modal-body visao-geral-relatorio-corpo">
        <label className="visao-geral-relatorio-modelo">
          <span>Modelo</span>
          <select
            value={modelo}
            onChange={(evento) => {
              const escolhido = MODELOS_DO_RELATORIO.find(
                (m) => m.id === evento.target.value,
              );
              if (escolhido) setEscolha(escolhido.escolha);
            }}
          >
            {modelo ? null : <option value="">Personalizado</option>}
            {MODELOS_DO_RELATORIO.map((m) => (
              <option key={m.id} value={m.id}>
                {m.rotulo}
              </option>
            ))}
          </select>
        </label>
        <Segmentado
          rotulo="Formato do arquivo"
          opcoes={FORMATOS_DO_RELATORIO}
          valor={escolha.formato}
          aoMudar={(formato: FormatoDoRelatorio) => mudar({ formato })}
        />
        {csv ? (
          <p className="visao-geral-relatorio-nota">
            O CSV leva todas as colunas da tabela, sem as seções.
          </p>
        ) : (
          <div className="visao-geral-relatorio-escolhas">
            <Marcar
              titulo="Seções"
              itens={SECOES_DO_RELATORIO.filter((s) =>
                permitidas.includes(s.id),
              )}
              marcados={secoes}
              aoMudar={(secoes) => mudar({ secoes })}
            />
            <Marcar
              titulo="Colunas da tabela dos editais"
              itens={COLUNAS_DO_RELATORIO.map((c) => ({
                id: c.campo,
                rotulo: c.rotulo,
              }))}
              marcados={escolha.colunas}
              aoMudar={(colunas) => mudar({ colunas })}
              desabilitado={semEditais}
            />
          </div>
        )}
        {!csv && secoes.includes("aprovados") ? (
          <p className="visao-geral-relatorio-nota">
            O download dos aprovados fica registrado com o seu nome.
          </p>
        ) : null}
        {erro ? (
          <p className="visao-geral-relatorio-erro" role="alert">
            {erro}
          </p>
        ) : null}
        <div className="visao-geral-relatorio-acoes">
          <button className="btn secondary" type="button" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            id="visaoGeralRelatorioGerar"
            className="btn green"
            type="button"
            disabled={gerando || !e.filtradas.length}
            aria-busy={gerando ? "true" : "false"}
            data-foco-inicial
            onClick={() => void gerar()}
          >
            <i className="fa-solid fa-download" aria-hidden="true" />{" "}
            {gerando ? "Gerando…" : "Gerar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
