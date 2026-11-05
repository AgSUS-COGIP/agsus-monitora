import { useDeferredValue, useMemo, useState } from "react";
import { copiarTexto } from "../../lib/convite-de-acesso.ts";
import { formatNumberBR } from "../../lib/formatters";
import { acoesDaPessoa } from "../../lib/avaliacao-documental/pessoas-da-triagem.ts";
import {
  chaveDaPessoa,
  comunicadosDosEliminados,
  ordenarPessoas,
  pessoaEliminada,
} from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import type { PessoaDoDocumento } from "../../lib/avaliacao-documental/documentos-em-lote.ts";
import type {
  MotivoDaPre,
  RecorteDaPre,
} from "../../lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import {
  AcoesDaLinha,
  Aviso,
  BarraDeFiltros,
  CaixaDeMarcarTodos,
  Campo,
  estadoDaMarcacao,
  TabelaInfinita,
  usarListaNoServidor,
} from "../../ui/index.ts";
import type {
  BuscarPagina,
  ColunaDaTabela,
  EstadoDaMarcacao,
} from "../../ui/index.ts";
import { baixarComunicadoDoEliminado } from "./comunicado-do-eliminado.ts";
import { IncluirPorDecisao } from "./decisao-do-lote.tsx";
import { AcoesEmLote, type MontarDocumentos } from "./documentos-em-lote.tsx";
import type {
  EstadoDaPreClassificacao,
  InscritoDaPre,
  VagaDaPre,
} from "./tipos-da-pre-classificacao.ts";

/*
  Aba "Eliminados" da Triagem: todos os eliminados do edital numa lista só,
  50 por vez do banco (listar_pre_classificacao, grupo ELIMINADOS), com busca
  por código ou nome, filtro por vaga e por motivo (p_motivo e por_motivo,
  20261029210000), marcação de várias pessoas e os comunicados de eliminação
  em lote (PDF, ZIP ou imprimir, a peça de documentos-em-lote.tsx). Cada
  comunicado confere no banco a situação de agora: quem deixou de estar
  eliminado sai (e o aviso diz quem).

  A marcação é da tela da Triagem (`marcadas`): a mesma das listas de
  eliminados de cada vaga, na aba Por vaga.

  A busca e os filtros ficam na BarraDeFiltros (a mesma da aba Pessoas e das
  outras telas da seleção); cada linha tem o comunicado como ação principal
  e o "⋯" com "Incluir no lote" (coordenação), "Ver na vaga" e "Copiar
  código".
*/

const TODAS = "";

const semFiltro = <T,>(itens: readonly T[]) => itens;

export interface PropriedadesDosEliminados {
  pre: EstadoDaPreClassificacao;
  vagas: readonly VagaDaPre[];
  /** Muda a cada releitura do resumo: a lista recomeça. */
  leitura: string;
  rotuloEdital: string;
  unidade: string;
  totalDeEliminados: number;
  marcadas: ReadonlyMap<string, PessoaDoDocumento>;
  aoMarcar: (pessoas: readonly PessoaDoDocumento[], sim: boolean) => void;
  aoLimpar: () => void;
  /** A coordenação inclui no lote por decisão (o "⋯" da linha). */
  podeCoordenar?: boolean;
  /** "Ver na vaga": a aba Por vaga, com a vaga aberta. */
  aoVerVaga?: (vaga: string) => void;
}

export function EliminadosDaTriagem({
  pre,
  vagas,
  leitura,
  rotuloEdital,
  unidade,
  totalDeEliminados,
  marcadas,
  aoMarcar,
  aoLimpar,
  podeCoordenar = false,
  aoVerVaga,
}: PropriedadesDosEliminados) {
  const [buscaDigitada, setBuscaDigitada] = useState("");
  const busca = useDeferredValue(buscaDigitada.trim());
  const [vaga, setVaga] = useState(TODAS);
  const [motivo, setMotivo] = useState(TODAS);
  const [motivos, setMotivos] = useState<readonly MotivoDaPre[]>([]);
  const [marcandoTodos, setMarcandoTodos] = useState(false);
  const [emitindo, setEmitindo] = useState("");
  const [erro, setErro] = useState("");
  const [copiado, setCopiado] = useState("");
  const [incluindo, setIncluindo] = useState<InscritoDaPre | null>(null);
  // Depois de incluir alguém no lote, a lista recomeça (ele deixou de estar eliminado).
  const [versao, setVersao] = useState(0);
  const recorte: RecorteDaPre = useMemo(
    () => ({ vaga: vaga || null, grupo: "ELIMINADOS", busca, motivo }),
    [vaga, busca, motivo],
  );
  const cargoDaVaga = useMemo(
    () => new Map(vagas.map((v) => [String(v.codigo), v.cargo ?? null])),
    [vagas],
  );

  // As opções de motivo vêm da primeira página (por_motivo conta sem o filtro de motivo).
  const buscar: BuscarPagina<InscritoDaPre> = useMemo(
    () => async (apos, limite) => {
      const r = await pre.listar(recorte, apos, limite);
      if (apos === null || apos === undefined) setMotivos(r.porMotivo);
      return { linhas: r.linhas, proximo: r.proximo, total: r.total };
    },
    [pre, recorte],
  );
  const lista = usarListaNoServidor(
    buscar,
    `${leitura}:${versao}:eliminados:${vaga}:${motivo}:${busca}`,
  );

  const marcados = useMemo(() => new Set(marcadas.keys()), [marcadas]);
  const escolhidos = ordenarPessoas(marcadas.values());

  /*
    A caixa do cabeçalho vale para o filtro inteiro (vaga, motivo e busca),
    não só as 50 já vindas do banco: sabe-se o filtro inteiro quando ele já
    foi lido (marcar todos) ou quando todas as páginas vieram.
  */
  const chaveDoFiltro = `${leitura}|${vaga}|${motivo}|${busca}`;
  const [todosDoFiltro, setTodosDoFiltro] = useState<{
    chave: string;
    pessoas: PessoaDoDocumento[];
  } | null>(null);
  const chavesDoFiltro =
    todosDoFiltro?.chave === chaveDoFiltro
      ? todosDoFiltro.pessoas.map((x) => x.chave)
      : lista.carregado && !lista.temMais
        ? lista.itens.map((c) => chaveDaPessoa(c.vaga, c.codigo))
        : null;
  let estadoDoFiltro: EstadoDaMarcacao;
  if (chavesDoFiltro)
    estadoDoFiltro = estadoDaMarcacao(
      chavesDoFiltro.filter((chave) => marcados.has(chave)).length,
      chavesDoFiltro.length,
    );
  else
    estadoDoFiltro = lista.itens.some((c) =>
      marcados.has(chaveDaPessoa(c.vaga, c.codigo)),
    )
      ? "parte"
      : "nenhuma";

  /* Marca (ou desmarca) todos do filtro (vaga, motivo e busca), lidos do banco em páginas. */
  async function marcarTodosDoFiltro(sim = true) {
    setErro("");
    if (!sim) {
      const pessoas =
        todosDoFiltro?.chave === chaveDoFiltro
          ? todosDoFiltro.pessoas
          : lista.itens.map(pessoaEliminada);
      aoMarcar(pessoas, false);
      return;
    }
    setMarcandoTodos(true);
    try {
      const linhas = await pre.listarTudo(recorte);
      const pessoas = linhas.map(pessoaEliminada);
      setTodosDoFiltro({ chave: chaveDoFiltro, pessoas });
      aoMarcar(pessoas, true);
    } catch (e) {
      setErro(
        `Não foi possível marcar todos: ${e instanceof Error ? e.message : String(e)}`,
      );
    } finally {
      setMarcandoTodos(false);
    }
  }

  async function emitir(c: InscritoDaPre) {
    if (emitindo) return;
    setErro("");
    setEmitindo(c.codigo);
    try {
      await baixarComunicadoDoEliminado(pre, c, {
        cargo: cargoDaVaga.get(String(c.vaga)),
        edital: rotuloEdital,
        unidade,
      });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível gerar o PDF.");
    } finally {
      setEmitindo("");
    }
  }

  // Confere só os marcados, como estão agora: quem deixou de estar eliminado sai.
  const montarComunicados: MontarDocumentos = async (escolhidas) => {
    const atual = await pre.conferirEliminados(escolhidas.map((x) => x.chave));
    const r = comunicadosDosEliminados(
      atual.candidatos as Parameters<typeof comunicadosDosEliminados>[0],
      atual.vagas,
      escolhidas,
      { edital: rotuloEdital, unidade },
    );
    return {
      documentos: r.documentos,
      avisos: [
        ...(r.foraDaSituacao.length
          ? [
              `Não estão mais eliminados (${r.foraDaSituacao.length}): ${r.foraDaSituacao.join(", ")}. Atualize a lista.`,
            ]
          : []),
        ...(r.semMotivo.length
          ? [
              `Sem justificativa registrada, verificar antes de emitir (${r.semMotivo.length}): ${r.semMotivo.join(", ")}.`,
            ]
          : []),
      ],
    };
  };

  const filtrando = Boolean(vaga || motivo || busca);
  const colunas: ColunaDaTabela[] = [
    {
      rotulo: "Marcar",
      chave: "marcar",
      largura: "2.75rem",
      cabecalho: (
        <CaixaDeMarcarTodos
          rotulo={
            filtrando
              ? "Marcar todos os eliminados do filtro"
              : "Marcar todos os eliminados do edital"
          }
          estado={estadoDoFiltro}
          desabilitada={marcandoTodos || !lista.carregado || !lista.total}
          acao="marcar-todos-eliminados"
          aoMudar={(sim) => void marcarTodosDoFiltro(sim)}
        />
      ),
    },
    { rotulo: "Vaga" },
    { rotulo: "Código" },
    { rotulo: "Nome" },
    { rotulo: "Motivo" },
    { rotulo: "Comunicado" },
  ];

  async function copiar(c: InscritoDaPre) {
    setErro("");
    if (await copiarTexto(String(c.codigo)))
      setCopiado(`Código ${c.codigo} copiado.`);
    else setErro("Não foi possível copiar o código.");
  }

  const ROTULOS = {
    incluir: { rotulo: "Incluir no lote", icone: "fa-user-plus" },
    "ver-vaga": { rotulo: "Ver na vaga", icone: "fa-briefcase" },
    copiar: { rotulo: "Copiar código", icone: "fa-copy" },
  } as const;
  type AcaoDoMenuDaLinha = keyof typeof ROTULOS;
  const outrasAcoes = (c: InscritoDaPre) =>
    acoesDaPessoa(c, { podeCoordenar })
      .outras.filter(
        (a): a is AcaoDoMenuDaLinha =>
          a in ROTULOS && (a !== "ver-vaga" || Boolean(aoVerVaga)),
      )
      .map((a) => ({
        id: a,
        ...ROTULOS[a],
        dados: { "data-acao": `pessoa-${a}` },
        aoEscolher: () => {
          if (a === "incluir") setIncluindo(c);
          else if (a === "ver-vaga") aoVerVaga?.(String(c.vaga));
          else void copiar(c);
        },
      }));

  const linha = (c: InscritoDaPre) => {
    const pessoa = pessoaEliminada(c);
    return (
      <tr key={c.id} data-candidato={c.codigo} data-situacao="ELIMINADO">
        <td>
          <input
            type="checkbox"
            aria-label={`Marcar ${c.codigo}`}
            data-acao="marcar-comunicado"
            checked={marcados.has(chaveDaPessoa(c.vaga, c.codigo))}
            onChange={(ev) => aoMarcar([pessoa], ev.target.checked)}
          />
        </td>
        <td>{c.vaga}</td>
        <td>{c.codigo}</td>
        <td>{c.nome}</td>
        <td>{c.motivo}</td>
        <td>
          <AcoesDaLinha
            pessoa={c.codigo}
            principal={{
              rotulo: "PDF",
              icone: "fa-file-pdf",
              acao: "espelho-eliminado-pre",
              titulo: "Baixar o comunicado de eliminação",
              desabilitado: Boolean(emitindo) || !c.motivo,
              ocupado: emitindo === c.codigo ? "Gerando PDF…" : false,
              aoClicar: () => void emitir(c),
            }}
            outras={outrasAcoes(c)}
          />
        </td>
      </tr>
    );
  };

  return (
    <div className="avd-pre-eliminados" data-aba-da-triagem="eliminados">
      <BarraDeFiltros
        rotulo="Filtros dos eliminados"
        busca={{
          valor: buscaDigitada,
          aoMudar: setBuscaDigitada,
          placeholder: "Código ou nome",
          rotulo: "Buscar eliminado pelo código ou nome",
          acao: "buscar-espelho-eliminado",
        }}
        quantos={[busca, vaga, motivo].filter(Boolean).length}
        aoLimpar={() => {
          setBuscaDigitada("");
          setVaga(TODAS);
          setMotivo(TODAS);
        }}
        resultado={
          lista.carregado
            ? `${formatNumberBR(lista.total)} ${lista.total === 1 ? "eliminado" : "eliminados"}`
            : "Procurando…"
        }
      >
        <Campo rotulo="Vaga">
          <select
            value={vaga}
            data-acao="filtro-vaga-eliminados"
            onChange={(ev) => setVaga(ev.target.value)}
          >
            <option value={TODAS}>Todas as vagas</option>
            {vagas.map((v) => (
              <option key={v.codigo} value={String(v.codigo)}>
                {[v.codigo, v.cargo].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Motivo">
          <select
            value={motivo}
            data-acao="filtro-motivo-eliminados"
            onChange={(ev) => setMotivo(ev.target.value)}
          >
            <option value={TODAS}>Todos os motivos</option>
            {motivos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.motivo} ({formatNumberBR(m.total)})
              </option>
            ))}
          </select>
        </Campo>
      </BarraDeFiltros>
      <section className="ui-card" aria-label="Comunicados em lote">
        <div className="avd-docs-lote-resumo" data-acao="comunicados-lote">
          <span>
            <strong data-acao="comunicados-marcados">
              {escolhidos.length.toLocaleString("pt-BR")} marcado(s)
            </strong>{" "}
            de {formatNumberBR(totalDeEliminados)} eliminado(s)
          </span>
          <span className="ui-acoes">
            <button
              type="button"
              className="btn ghost small"
              data-acao="comunicados-marcar-busca"
              disabled={!lista.total || marcandoTodos}
              onClick={() => void marcarTodosDoFiltro(true)}
            >
              {marcandoTodos
                ? "Marcando…"
                : filtrando
                  ? `Marcar todos do filtro (${formatNumberBR(lista.total)})`
                  : `Marcar todos os eliminados (${formatNumberBR(lista.total)})`}
            </button>
            {marcadas.size ? (
              <button
                type="button"
                className="btn ghost small"
                data-acao="comunicados-limpar"
                onClick={aoLimpar}
              >
                Limpar marcação
              </button>
            ) : null}
          </span>
        </div>
        <AcoesEmLote
          id="comunicados"
          escolhidas={escolhidos}
          rotuloDoDocumento="comunicado"
          tituloDaImpressao="Comunicados de eliminação"
          prefixoDoZip="comunicados"
          edital={rotuloEdital}
          montar={montarComunicados}
        />
      </section>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : copiado ? (
        <Aviso papel="status">{copiado}</Aviso>
      ) : null}
      {incluindo ? (
        <IncluirPorDecisao
          candidatos={[{ ...incluindo, nota: incluindo.nota ?? incluindo.art }]}
          marcadosDeInicio={[incluindo.id]}
          aoIncluir={(escolhidos, motivoDaDecisao) =>
            pre.incluirPorDecisao(escolhidos, motivoDaDecisao)
          }
          aoFechar={(incluiu) => {
            setIncluindo(null);
            if (incluiu) setVersao((n) => n + 1);
          }}
        />
      ) : null}
      {lista.erro ? (
        <Aviso tom="danger" papel="alert">
          Não foi possível ler os eliminados: {lista.erro}{" "}
          <button
            type="button"
            className="btn secondary small"
            onClick={lista.recarregar}
          >
            Tentar novamente
          </button>
        </Aviso>
      ) : (
        <TabelaInfinita
          idDoTitulo="avdTriagemEliminados"
          titulo="Eliminados"
          className="avd-pre-lista"
          classeDaTabela="avd-tabela"
          colunas={colunas}
          carregado={lista.carregado}
          itens={lista.itens}
          filtrarPelaBusca={semFiltro}
          linha={linha}
          total={lista.total}
          informacao={(quantos) =>
            quantos === null
              ? ""
              : `${formatNumberBR(quantos)} ${quantos === 1 ? "eliminado" : "eliminados"}`
          }
          vazio={
            filtrando ? "Nenhum eliminado no filtro." : "Nenhum eliminado."
          }
          servidor={lista}
        />
      )}
    </div>
  );
}
