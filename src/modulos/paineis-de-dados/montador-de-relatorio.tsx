import type {
  Configuracoes,
  Perfil,
  TextosDaVisaoGeral,
} from "../visao-geral/tipos.ts";
import type {
  EscolhaDoRelatorio,
  FormatoDoRelatorio,
  RecorteDoRelatorio,
} from "../../lib/paineis/relatorio-da-visao-geral.ts";
import type { ClienteDoRelatorio } from "./dados-da-diretoria.ts";
import type { AprovadosLidos } from "./gerar-relatorio.ts";
import { useEffect, useMemo, useRef, useState } from "react";
import { FecharModal, Modal, Segmentado } from "../../ui/index.ts";
import { baixarArquivo } from "../../ui/botoes-de-exportacao.tsx";
import { CHAVE_DO_CABECALHO } from "../../lib/base/cabecalho-dos-documentos.ts";
import { nomeDaArea } from "../../lib/navegacao/menu-lateral.ts";
import { usarTemaEscuro } from "../../app/tema.ts";
import {
  dadosDosGraficos,
  GRAFICOS_DO_RELATORIO,
  graficosPermitidos,
  precisaDosAprovados,
} from "../../lib/paineis/graficos-do-relatorio.ts";
import {
  csvDaVisaoGeral,
  nomeDoCsv,
} from "../../lib/visao-geral/visao-geral.ts";
import {
  alternarNaEscolha,
  COLUNAS_DO_RELATORIO,
  FORMATOS_DO_RELATORIO,
  MODELOS_DO_RELATORIO,
  modeloDaEscolha,
  normalizarEscolha,
  SECOES_DO_RELATORIO,
  secoesPermitidas,
} from "../../lib/paineis/relatorio-da-visao-geral.ts";
import { baixarAprovadosDaDiretoria } from "./dados-da-diretoria.ts";
import { gerarRelatorio, mensagemDaFalha } from "./gerar-relatorio.ts";
import { MiniaturaDoGrafico } from "./graficos-do-relatorio.tsx";

/*
  O MONTADOR DE RELATÓRIO (cartão "Montar relatório" de Relatórios, grupo
  Editais): um modelo pronto ou a escolha de quem gera — as seções, as
  colunas da tabela dos editais, os gráficos (com a miniatura de cada um) e
  o formato (PDF, Excel ou CSV). Sai do
  recorte recebido: a área inteira ou, vindo do "Ver em Relatórios" da Visão
  geral, a Visão geral como estava (filtros, busca e atalho). A última
  escolha fica guardada neste navegador. Os gráficos dos aprovados leem a
  RPC que registra o download: a miniatura deles só carrega no botão, e a
  geração reaproveita essa leitura no mesmo formato. O arquivo é gerado em
  ./gerar-relatorio.ts (a mesma geração do cartão da diretoria); a lógica do
  conteúdo está em src/lib/paineis/relatorio-da-visao-geral.ts.
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

function Marcar<T extends string>({
  titulo,
  itens,
  marcados,
  aoMudar,
  desabilitado,
  minimo = 1,
}: {
  titulo: string;
  itens: readonly { id: T; rotulo: string }[];
  marcados: readonly T[];
  aoMudar: (proximos: T[]) => void;
  desabilitado?: boolean;
  /** Quantos ficam marcados no mínimo (0: pode desmarcar todos). */
  minimo?: number;
}) {
  const todos = itens.map((i) => i.id);
  return (
    <fieldset className="relatorios-montador-grupo" disabled={desabilitado}>
      <legend>{titulo}</legend>
      {itens.map((item) => (
        <label key={item.id}>
          <input
            type="checkbox"
            checked={marcados.includes(item.id)}
            onChange={() =>
              aoMudar(alternarNaEscolha(todos, marcados, item.id, minimo))
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
  descricao = "da área",
  textos,
  configuracoes,
  obterPerfil,
  agora,
  aoFechar,
  supabase = null,
  podeAprovados = false,
}: {
  e: RecorteDoRelatorio;
  /** De onde vêm os processos, no subtítulo ("da área", "do recorte da Visão geral"). */
  descricao?: string;
  textos: TextosDaVisaoGeral;
  configuracoes: Configuracoes;
  obterPerfil: () => Perfil | null;
  agora: () => Date;
  aoFechar: () => void;
  supabase?: ClienteDoRelatorio | null;
  podeAprovados?: boolean;
}) {
  const [escolha, setEscolha] = useState<EscolhaDoRelatorio>(lerEscolha);
  const [escolhaAoAbrir] = useState(escolha);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState("");
  const [lidos, setLidos] = useState<AprovadosLidos | null>(null);
  const [lendo, setLendo] = useState(false);
  const escuro = usarTemaEscuro();
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
  const podeGraficos = graficosPermitidos(podeAprovados);
  const graficos = escolha.graficos.filter((g) => podeGraficos.includes(g));
  const chaveDosGraficos = graficos.join();
  const editais = useMemo(
    () => e.filtradas.map((l) => String(l.id ?? "")).filter(Boolean),
    [e.filtradas],
  );
  const aprovadosDaPrevia =
    lidos &&
    lidos.editais.length === editais.length &&
    lidos.editais.every((id, i) => id === editais[i])
      ? lidos.exportacao.aprovados
      : null;
  const previas = useMemo(
    () =>
      dadosDosGraficos({
        graficos: chaveDosGraficos
          ? (chaveDosGraficos.split(",") as typeof graficos)
          : [],
        linhas: e.filtradas,
        aprovados: aprovadosDaPrevia,
      }),
    [chaveDosGraficos, e.filtradas, aprovadosDaPrevia],
  );
  const semPrevia = GRAFICOS_DO_RELATORIO.filter(
    (g) => g.comAprovados && graficos.includes(g.id) && !aprovadosDaPrevia,
  );

  async function carregarPrevia() {
    setErro("");
    setLendo(true);
    try {
      const exportacao = await baixarAprovadosDaDiretoria(
        supabase,
        e.area,
        escolha.formato,
        editais,
      );
      if (aberto.current)
        setLidos({ formato: escolha.formato, editais, exportacao });
    } catch (falha) {
      if (aberto.current) setErro(mensagemDaFalha(falha));
    } finally {
      if (aberto.current) setLendo(false);
    }
  }

  async function gerar() {
    setErro("");
    guardarEscolha(escolha);
    if (csv) {
      if (e.filtradas.length)
        baixarArquivo(
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
      const { arquivo, nome } = await gerarRelatorio({
        escolha: { ...escolha, secoes, graficos },
        recorte: e,
        textos,
        cabecalho: String(
          configuracoes.obter().valores?.get?.(CHAVE_DO_CABECALHO) || "",
        ),
        quem: String(obterPerfil()?.nome || ""),
        agora: agora(),
        supabase,
        podeAprovados,
        aprovadosLidos: lidos,
      });
      if (!aberto.current) return;
      baixarArquivo(arquivo, nome);
      aoFechar();
    } catch (falha) {
      if (aberto.current) setErro(mensagemDaFalha(falha));
    } finally {
      if (aberto.current) setGerando(false);
    }
  }

  return (
    <Modal
      id="montadorDeRelatorio"
      className="relatorios-montador"
      rotuloId="montadorDeRelatorioTitulo"
      aoFechar={aoFechar}
      alterado={JSON.stringify(escolha) !== JSON.stringify(escolhaAoAbrir)}
      tamanho="medio"
    >
      <div className="modal-head">
        <div>
          <h3 id="montadorDeRelatorioTitulo">Montar relatório</h3>
          <p className="relatorios-montador-recorte">
            {e.filtradas.length.toLocaleString("pt-BR")}{" "}
            {e.filtradas.length === 1 ? "processo" : "processos"} {descricao} ·{" "}
            {nomeDaArea(e.area) || e.area}
          </p>
        </div>
        <FecharModal className="btn secondary">Fechar</FecharModal>
      </div>
      <div className="modal-body relatorios-montador-corpo">
        <label className="relatorios-montador-modelo">
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
          <p className="relatorios-montador-nota">
            O CSV leva todas as colunas da tabela, sem as seções nem os
            gráficos.
          </p>
        ) : (
          <div className="relatorios-montador-escolhas">
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
        {csv ? null : (
          <div className="relatorios-montador-graficos">
            <Marcar
              titulo="Gráficos"
              itens={GRAFICOS_DO_RELATORIO.filter((g) =>
                podeGraficos.includes(g.id),
              )}
              marcados={graficos}
              aoMudar={(graficos) => mudar({ graficos })}
              minimo={0}
            />
            {graficos.length ? (
              <div
                className="relatorios-montador-previa"
                role="group"
                aria-label="Prévia dos gráficos"
              >
                {graficos.map((id) => {
                  const dados = previas.find((d) => d.id === id);
                  if (dados)
                    return (
                      <MiniaturaDoGrafico
                        key={id}
                        dados={dados}
                        escuro={escuro}
                      />
                    );
                  const grafico = semPrevia.find((g) => g.id === id);
                  return grafico ? (
                    <figure
                      key={id}
                      className="relatorios-montador-miniatura"
                      data-grafico={id}
                    >
                      <figcaption>{grafico.rotulo}</figcaption>
                      <button
                        type="button"
                        className="btn secondary relatorios-montador-carregar"
                        disabled={lendo || !editais.length}
                        aria-busy={lendo ? "true" : "false"}
                        onClick={() => void carregarPrevia()}
                      >
                        {lendo ? "Carregando…" : "Carregar prévia"}
                      </button>
                    </figure>
                  ) : null;
                })}
              </div>
            ) : null}
          </div>
        )}
        {!csv &&
        (secoes.includes("aprovados") || precisaDosAprovados(graficos)) ? (
          <p className="relatorios-montador-nota">
            O download dos aprovados fica registrado com o seu nome.
          </p>
        ) : null}
        {erro ? (
          <p className="relatorios-montador-erro" role="alert">
            {erro}
          </p>
        ) : null}
        <div className="relatorios-montador-acoes">
          <FecharModal className="btn secondary">Cancelar</FecharModal>
          <button
            id="montadorDeRelatorioGerar"
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
