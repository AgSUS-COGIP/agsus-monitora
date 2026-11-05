import { useCallback, useEffect, useMemo, useState } from "react";
import { copiarTexto } from "../../lib/convite-de-acesso.ts";
import { formatNumberBR } from "../../lib/formatters";
import { ordinal } from "../../lib/classificacao/numeros.ts";
import type { GrupoDaPre } from "../../lib/avaliacao-documental/paginas-da-pre-classificacao.ts";
import {
  acoesDaPessoa,
  chaveDasPessoas,
  FILTRO_DAS_PESSOAS_INICIAL,
  filtrosDasPessoasEmUso,
  gruposDaSituacao,
  normalizarFiltroDasPessoas,
  recorteDasPessoas,
  SITUACOES_DAS_PESSOAS,
} from "../../lib/avaliacao-documental/pessoas-da-triagem.ts";
import type {
  AcaoDaPessoa,
  FiltroDasPessoas,
  SituacaoDasPessoas,
} from "../../lib/avaliacao-documental/pessoas-da-triagem.ts";
import {
  DICA_DA_ART,
  nota,
  ROTULO_DA_ART,
  ROTULOS_DA_SITUACAO,
} from "../../lib/avaliacao-documental/tela-da-pre-classificacao.ts";
import {
  AcoesDaLinha,
  Aviso,
  BarraDeFiltros,
  Campo,
  Selo,
  TabelaInfinita,
  usarEstadoDaSessao,
  usarListaNoServidor,
} from "../../ui/index.ts";
import type {
  AcaoDoMenu,
  AcaoPrincipalDaLinha,
  BuscarPagina,
  ColunaDaTabela,
} from "../../ui/index.ts";
import { baixarComunicadoDoEliminado } from "./comunicado-do-eliminado.ts";
import {
  IncluirPorDecisao,
  RevogarDecisaoNaGaveta,
  SeloDaDecisao,
} from "./decisao-do-lote.tsx";
import type {
  EstadoDaPreClassificacao,
  InscritoDaPre,
  SituacaoDoInscrito,
  VagaDaPre,
} from "./tipos-da-pre-classificacao.ts";

/*
  Aba "Pessoas" da Triagem: achar uma pessoa no edital todo pelo código ou
  pelo nome, sem abrir vaga por vaga. A busca e os filtros (vaga e situação)
  vão ao banco (listar_pre_classificacao, 50 por vez, na ordem dele: vaga,
  no lote antes de fora, posição); "Todas" mostra os classificados e os
  eliminados em duas listas. O filtro fica na sessão da aba do navegador,
  por edital (volta no F5). Regras puras em
  src/lib/avaliacao-documental/pessoas-da-triagem.ts.

  Cada linha tem a ação principal (o comunicado do eliminado, ou "Incluir
  no lote" de quem está fora) e o "⋯" (revogar a decisão, ver na vaga,
  copiar o código). Incluir e revogar pedem motivo na gaveta (as mesmas de
  decisao-do-lote.tsx). Explicações: docs/aya/regras-da-avaliacao-documental.md.
*/

const TOM_DA_SITUACAO: Record<SituacaoDoInscrito, string> = {
  NO_LOTE: "aprovado",
  ANALISADO: "revisar",
  RANQUEADO: "neutro",
  ELIMINADO: "reprovado",
};
const semFiltro = <T,>(itens: readonly T[]) => itens;
const TITULO_DO_GRUPO: Record<GrupoDaPre, string> = {
  CLASSIFICADOS: "Classificados",
  ELIMINADOS: "Eliminados",
  PODE_INCLUIR: "Podem entrar por decisão",
};
const UNIDADE_DO_GRUPO: Record<GrupoDaPre, [string, string]> = {
  CLASSIFICADOS: ["classificado", "classificados"],
  ELIMINADOS: ["eliminado", "eliminados"],
  PODE_INCLUIR: ["pessoa", "pessoas"],
};
const contar = (n: number, [um, varios]: [string, string]) =>
  `${formatNumberBR(n)} ${n === 1 ? um : varios}`;

const COLUNAS_DOS_CLASSIFICADOS: ColunaDaTabela[] = [
  { rotulo: "Vaga" },
  { rotulo: "Classificação" },
  { rotulo: "Código" },
  { rotulo: "Nome" },
  { rotulo: "Modalidade" },
  { rotulo: ROTULO_DA_ART, dica: DICA_DA_ART },
  { rotulo: "Situação" },
  { rotulo: "Ações", chave: "acoes" },
];
const COLUNAS_DOS_ELIMINADOS: ColunaDaTabela[] = [
  { rotulo: "Vaga" },
  { rotulo: "Código" },
  { rotulo: "Nome" },
  { rotulo: "Motivo" },
  { rotulo: "Ações", chave: "acoes" },
];

export interface PropriedadesDasPessoas {
  pre: EstadoDaPreClassificacao;
  editalId: string;
  vagas: readonly VagaDaPre[];
  /** Muda a cada releitura do resumo: as listas recomeçam. */
  leitura: string;
  rotuloEdital: string;
  unidade: string;
  podeCoordenar: boolean;
  /** "Ver na vaga": a aba Por vaga, com a vaga aberta. */
  aoVerVaga: (vaga: string) => void;
}

type Pedido =
  | { tipo: "incluir"; pessoa: InscritoDaPre }
  | { tipo: "revogar"; pessoa: InscritoDaPre }
  | null;

/* Uma lista (um grupo) da aba: 50 por vez do banco, com as ações de cada linha. */
function ListaDoGrupo({
  grupo,
  pre,
  filtro,
  busca,
  chaveDaLeitura,
  acoesDaLinha,
  aoContar,
}: {
  grupo: GrupoDaPre;
  pre: EstadoDaPreClassificacao;
  filtro: FiltroDasPessoas;
  busca: string;
  chaveDaLeitura: string;
  acoesDaLinha: (c: InscritoDaPre) => {
    principal: AcaoPrincipalDaLinha | null;
    outras: AcaoDoMenu[];
  };
  aoContar: (grupo: GrupoDaPre, total: number | null) => void;
}) {
  const recorte = useMemo(
    () => recorteDasPessoas(filtro, grupo, busca),
    [filtro, grupo, busca],
  );
  const buscar: BuscarPagina<InscritoDaPre> = useMemo(
    () => async (apos, limite) => {
      const r = await pre.listar(recorte, apos, limite);
      return { linhas: r.linhas, proximo: r.proximo, total: r.total };
    },
    [pre, recorte],
  );
  const lista = usarListaNoServidor(
    buscar,
    `${chaveDaLeitura}:${grupo}:${recorte.vaga ?? ""}:${recorte.busca ?? ""}`,
  );
  // O total do recorte vai para o resultado da barra (null enquanto procura).
  const total = lista.carregado && !lista.erro ? lista.total : null;
  useEffect(() => aoContar(grupo, total), [aoContar, grupo, total]);
  const eliminados = grupo === "ELIMINADOS";

  const linha = (c: InscritoDaPre) => {
    const { principal, outras } = acoesDaLinha(c);
    return (
      <tr
        key={`${c.vaga}:${c.id}`}
        data-candidato={c.codigo}
        data-situacao={c.situacao}
      >
        <td>{c.vaga}</td>
        {eliminados ? null : <td>{c.posicao ? ordinal(c.posicao) : "—"}</td>}
        <td>{c.codigo}</td>
        <td>{c.nome}</td>
        {eliminados ? (
          <td>{c.motivo || "—"}</td>
        ) : (
          <>
            <td>{c.modalidade || "—"}</td>
            <td className="num">{nota(c.art)}</td>
            <td>
              <Selo
                tom={TOM_DA_SITUACAO[c.situacao]}
                titulo={c.motivo_entrada || c.motivo || undefined}
              >
                {ROTULOS_DA_SITUACAO[c.situacao]}
                {c.lote ? ` · lote ${c.lote}` : ""}
              </Selo>{" "}
              <SeloDaDecisao c={c} />
            </td>
          </>
        )}
        <td>
          <AcoesDaLinha
            pessoa={c.codigo}
            principal={principal}
            outras={outras}
          />
        </td>
      </tr>
    );
  };

  if (lista.erro)
    return (
      <Aviso tom="danger" papel="alert">
        Não foi possível ler a lista: {lista.erro}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={lista.recarregar}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  return (
    <TabelaInfinita
      idDoTitulo={`avdPessoas${grupo}`}
      titulo={TITULO_DO_GRUPO[grupo]}
      className="avd-pre-lista avd-pessoas-lista"
      classeDaTabela="avd-tabela"
      colunas={eliminados ? COLUNAS_DOS_ELIMINADOS : COLUNAS_DOS_CLASSIFICADOS}
      carregado={lista.carregado}
      itens={lista.itens}
      filtrarPelaBusca={semFiltro}
      linha={linha}
      total={lista.total}
      informacao={(quantos) =>
        quantos === null ? "" : contar(quantos, UNIDADE_DO_GRUPO[grupo])
      }
      vazio={
        busca || filtro.vaga
          ? "Ninguém com este filtro."
          : `Nenhuma pessoa em ${TITULO_DO_GRUPO[grupo].toLowerCase()}.`
      }
      servidor={lista}
    />
  );
}

export function PessoasDaTriagem({
  pre,
  editalId,
  vagas,
  leitura,
  rotuloEdital,
  unidade,
  podeCoordenar,
  aoVerVaga,
}: PropriedadesDasPessoas) {
  const [filtro, setFiltro] = usarEstadoDaSessao(
    chaveDasPessoas(editalId),
    FILTRO_DAS_PESSOAS_INICIAL as FiltroDasPessoas,
    normalizarFiltroDasPessoas,
  );
  // A busca vai ao banco 300 ms depois da última tecla (não a cada tecla).
  const [busca, setBusca] = useState(() => filtro.busca.trim());
  useEffect(() => {
    const espera = setTimeout(() => setBusca(filtro.busca.trim()), 300);
    return () => clearTimeout(espera);
  }, [filtro.busca]);
  const [totais, setTotais] = useState<
    Partial<Record<GrupoDaPre, number | null>>
  >({});
  // Depois de incluir ou revogar, as listas recomeçam (a situação mudou).
  const [versao, setVersao] = useState(0);
  const [pedido, setPedido] = useState<Pedido>(null);
  const [emitindo, setEmitindo] = useState("");
  const [mensagem, setMensagem] = useState<{
    tom: "danger" | "info";
    texto: string;
  } | null>(null);
  const grupos = gruposDaSituacao(filtro.situacao);
  const cargoDaVaga = useMemo(
    () => new Map(vagas.map((v) => [String(v.codigo), v.cargo ?? null])),
    [vagas],
  );
  const aoContar = useCallback(
    (grupo: GrupoDaPre, total: number | null) =>
      setTotais((t) => (t[grupo] === total ? t : { ...t, [grupo]: total })),
    [],
  );
  const mudar = (parte: Partial<FiltroDasPessoas>) =>
    setFiltro((atual) => ({ ...atual, ...parte }));

  async function emitir(c: InscritoDaPre) {
    if (emitindo) return;
    setMensagem(null);
    setEmitindo(c.codigo);
    try {
      await baixarComunicadoDoEliminado(pre, c, {
        cargo: cargoDaVaga.get(String(c.vaga)),
        edital: rotuloEdital,
        unidade,
      });
    } catch (erro) {
      setMensagem({
        tom: "danger",
        texto:
          erro instanceof Error
            ? erro.message
            : "Não foi possível gerar o PDF.",
      });
    } finally {
      setEmitindo("");
    }
  }

  async function copiar(c: InscritoDaPre) {
    const ok = await copiarTexto(String(c.codigo));
    setMensagem(
      ok
        ? { tom: "info", texto: `Código ${c.codigo} copiado.` }
        : { tom: "danger", texto: "Não foi possível copiar o código." },
    );
  }

  const fazer = (acao: AcaoDaPessoa, c: InscritoDaPre) => {
    if (acao === "comunicado") return void emitir(c);
    if (acao === "incluir") return setPedido({ tipo: "incluir", pessoa: c });
    if (acao === "revogar") return setPedido({ tipo: "revogar", pessoa: c });
    if (acao === "ver-vaga") return aoVerVaga(String(c.vaga));
    return void copiar(c);
  };
  const ROTULOS: Record<AcaoDaPessoa, { rotulo: string; icone: string }> = {
    comunicado: { rotulo: "Comunicado PDF", icone: "fa-file-pdf" },
    incluir: { rotulo: "Incluir no lote", icone: "fa-user-plus" },
    revogar: { rotulo: "Revogar decisão", icone: "fa-user-minus" },
    "ver-vaga": { rotulo: "Ver na vaga", icone: "fa-briefcase" },
    copiar: { rotulo: "Copiar código", icone: "fa-copy" },
  };
  const acoesDaLinha = (
    c: InscritoDaPre,
  ): { principal: AcaoPrincipalDaLinha | null; outras: AcaoDoMenu[] } => {
    const { principal, outras } = acoesDaPessoa(c, { podeCoordenar });
    return {
      principal: principal
        ? {
            ...ROTULOS[principal],
            acao:
              principal === "comunicado"
                ? "espelho-eliminado-pre"
                : "incluir-pessoa",
            ocupado:
              principal === "comunicado" && emitindo === c.codigo
                ? "Gerando PDF…"
                : false,
            desabilitado: principal === "comunicado" && Boolean(emitindo),
            aoClicar: () => fazer(principal, c),
          }
        : null,
      outras: outras.map((acao) => ({
        id: acao,
        ...ROTULOS[acao],
        dados: { "data-acao": `pessoa-${acao}` },
        aoEscolher: () => fazer(acao, c),
      })),
    };
  };

  const somados = grupos.map((g) => totais[g]);
  const resultado = somados.every((n) => n !== undefined && n !== null)
    ? contar(
        somados.reduce<number>((s, n) => s + (n ?? 0), 0),
        ["pessoa", "pessoas"],
      )
    : "Procurando…";
  const chaveDaLeitura = `${leitura}:${versao}`;

  return (
    <div className="avd-pre-pessoas" data-aba-da-triagem="pessoas">
      <BarraDeFiltros
        rotulo="Encontrar a pessoa"
        tour="triagem-pessoas-busca"
        busca={{
          valor: filtro.busca,
          aoMudar: (valor) => mudar({ busca: valor }),
          placeholder: "Código ou nome",
          rotulo: "Buscar pessoa pelo código ou nome",
          acao: "buscar-pessoa",
        }}
        quantos={filtrosDasPessoasEmUso(filtro)}
        aoLimpar={() => setFiltro({ ...FILTRO_DAS_PESSOAS_INICIAL })}
        resultado={resultado}
      >
        <Campo rotulo="Vaga">
          <select
            value={filtro.vaga}
            data-acao="filtro-vaga-pessoas"
            onChange={(ev) => mudar({ vaga: ev.target.value })}
          >
            <option value="">Todas as vagas</option>
            {vagas.map((v) => (
              <option key={v.codigo} value={String(v.codigo)}>
                {[v.codigo, v.cargo].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Situação">
          <select
            value={filtro.situacao}
            data-acao="filtro-situacao-pessoas"
            onChange={(ev) =>
              mudar({ situacao: ev.target.value as SituacaoDasPessoas })
            }
          >
            {SITUACOES_DAS_PESSOAS.map((s) => (
              <option key={s.valor} value={s.valor}>
                {s.rotulo}
              </option>
            ))}
          </select>
        </Campo>
      </BarraDeFiltros>
      {mensagem ? (
        <Aviso
          tom={mensagem.tom === "danger" ? "danger" : undefined}
          papel={mensagem.tom === "danger" ? "alert" : "status"}
        >
          {mensagem.texto}
        </Aviso>
      ) : null}
      {grupos.map((grupo) => (
        <ListaDoGrupo
          key={grupo}
          grupo={grupo}
          pre={pre}
          filtro={filtro}
          busca={busca}
          chaveDaLeitura={chaveDaLeitura}
          acoesDaLinha={acoesDaLinha}
          aoContar={aoContar}
        />
      ))}
      {pedido?.tipo === "incluir" ? (
        <IncluirPorDecisao
          candidatos={[
            { ...pedido.pessoa, nota: pedido.pessoa.nota ?? pedido.pessoa.art },
          ]}
          marcadosDeInicio={[pedido.pessoa.id]}
          aoIncluir={(escolhidos, motivo) =>
            pre.incluirPorDecisao(escolhidos, motivo)
          }
          aoFechar={(incluiu) => {
            setPedido(null);
            if (incluiu) setVersao((n) => n + 1);
          }}
        />
      ) : null}
      {pedido?.tipo === "revogar" ? (
        <RevogarDecisaoNaGaveta
          c={pedido.pessoa}
          aoRevogar={(motivo) => pre.revogarDecisao([pedido.pessoa], motivo)}
          aoFechar={(revogou) => {
            setPedido(null);
            if (revogou) setVersao((n) => n + 1);
          }}
        />
      ) : null}
    </div>
  );
}
