import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import { usarFiltrosNaUrl } from "../../app/usar-filtros-na-url.ts";
import type { EsquemaDosFiltros } from "../../app/filtros-no-endereco.ts";
import { copiarTexto } from "../../lib/convite-de-acesso.ts";
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
  BarraDaLista,
  Campo,
  CardDaLista,
  CelulaDaPessoa,
  Selo,
  TabelaDaLista,
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
  eliminados em duas listas. A vaga e a situação vão na URL (?vaga=&situacao=,
  src/app/usar-filtros-na-url.ts); a busca, não (nome e código). Sem filtro
  na URL, vale o guardado na sessão da aba, por edital. Regras puras em
  src/lib/avaliacao-documental/pessoas-da-triagem.ts.

  O layout da seleção: num card só, a barra (busca com "/", Vaga e, em
  "Filtros", a Situação, que a faixa de situação da Triagem também escolhe)
  e a lista 50 por vez ("1–50 de N", Anterior / Próxima), com a pessoa numa
  coluna (nome e "código · modalidade"). Cada linha tem a ação principal (o
  comunicado do eliminado; "Incluir no lote", azul, de quem está fora; senão
  "Ver na vaga") e o "⋯" (revogar a decisão, ver na vaga, copiar o código). Incluir e revogar pedem motivo na gaveta (as mesmas de
  decisao-do-lote.tsx). Explicações: docs/aya/regras-da-avaliacao-documental.md.
*/

const TOM_DA_SITUACAO: Record<SituacaoDoInscrito, string> = {
  NO_LOTE: "aprovado",
  ANALISADO: "revisar",
  RANQUEADO: "neutro",
  ELIMINADO: "reprovado",
};
const TITULO_DO_GRUPO: Record<GrupoDaPre, string> = {
  CLASSIFICADOS: "Classificados",
  ELIMINADOS: "Eliminados",
  PODE_INCLUIR: "Podem entrar por decisão",
};
const ACOES: ColunaDaTabela = {
  rotulo: "Ações",
  chave: "acoes",
  numero: true,
  cabecalho: <span className="sr-only">Ações</span>,
};
const COLUNAS_DOS_CLASSIFICADOS: ColunaDaTabela[] = [
  { rotulo: "Pessoa" },
  { rotulo: "Vaga" },
  { rotulo: ROTULO_DA_ART, dica: DICA_DA_ART, numero: true },
  { rotulo: "Posição", numero: true },
  { rotulo: "Triagem" },
  ACOES,
];
const COLUNAS_DOS_ELIMINADOS: ColunaDaTabela[] = [
  { rotulo: "Pessoa" },
  { rotulo: "Vaga" },
  { rotulo: "Motivo" },
  ACOES,
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
  /** A situação escolhida na faixa da Triagem (cada `vez` nova aplica). */
  situacaoPedida?: { situacao: SituacaoDasPessoas; vez: number };
  /** A situação em uso (a faixa marca o número dela). */
  aoMudarSituacao?: (situacao: SituacaoDasPessoas) => void;
}

type Pedido =
  | { tipo: "incluir"; pessoa: InscritoDaPre }
  | { tipo: "revogar"; pessoa: InscritoDaPre }
  | null;

/*
  A lista de baixo (Eliminados, em "Todas") só pede ao banco quando chega
  perto da tela: abrir Pessoas lê as 50 linhas da lista à vista, não as das
  duas. Sem IntersectionObserver (testes antigos, navegador velho), lê já.
*/
function usarPertoDaTela(
  ref: RefObject<HTMLElement | null>,
  preguicoso: boolean,
): boolean {
  const [perto, setPerto] = useState(
    () => !preguicoso || typeof IntersectionObserver === "undefined",
  );
  useEffect(() => {
    const alvo = ref.current;
    if (perto || !alvo || typeof IntersectionObserver === "undefined")
      return undefined;
    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas.some((e) => e.isIntersecting)) setPerto(true);
      },
      { rootMargin: "200px 0px" },
    );
    observador.observe(alvo);
    return () => observador.disconnect();
  }, [ref, perto]);
  return perto;
}

/* Uma lista (um grupo) da aba: 50 por vez do banco, com as ações de cada linha. */
function ListaDoGrupo({
  grupo,
  pre,
  filtro,
  busca,
  chaveDaLeitura,
  acoesDaLinha,
  titulo = "",
  preguicoso = false,
}: {
  titulo?: string;
  preguicoso?: boolean;
  grupo: GrupoDaPre;
  pre: EstadoDaPreClassificacao;
  filtro: FiltroDasPessoas;
  busca: string;
  chaveDaLeitura: string;
  acoesDaLinha: (c: InscritoDaPre) => {
    principal: AcaoPrincipalDaLinha | null;
    outras: AcaoDoMenu[];
  };
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
  const chave = `${chaveDaLeitura}:${grupo}:${recorte.vaga ?? ""}:${recorte.busca ?? ""}`;
  const caixa = useRef<HTMLDivElement>(null);
  const perto = usarPertoDaTela(caixa, preguicoso);
  const lista = usarListaNoServidor(buscar, chave, { ativo: perto });
  const eliminados = grupo === "ELIMINADOS";

  const linha = (c: InscritoDaPre) => {
    const { principal, outras } = acoesDaLinha(c);
    return (
      <tr
        key={`${c.vaga}:${c.id}`}
        data-candidato={c.codigo}
        data-situacao={c.situacao}
      >
        <td>
          <CelulaDaPessoa
            nome={c.nome}
            codigo={c.codigo}
            modalidade={c.modalidade}
          />
        </td>
        <td>{c.vaga}</td>
        {eliminados ? (
          <td>{c.motivo || "—"}</td>
        ) : (
          <>
            <td className="num">{nota(c.art)}</td>
            <td className="num">{c.posicao ? ordinal(c.posicao) : "—"}</td>
            <td>
              <Selo
                ponto
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
        <td className="num">
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
    <div
      className="avd-pessoas-lista"
      data-grupo-das-pessoas={grupo}
      ref={caixa}
    >
      {titulo ? <h3 className="ui-lista-subtitulo">{titulo}</h3> : null}
      <TabelaDaLista
        rotulo={TITULO_DO_GRUPO[grupo]}
        classeDaTabela="avd-tabela"
        colunas={
          eliminados ? COLUNAS_DOS_ELIMINADOS : COLUNAS_DOS_CLASSIFICADOS
        }
        carregado={lista.carregado}
        itens={lista.itens}
        linha={linha}
        chaveDoRecorte={chave}
        vazio={
          busca || filtro.vaga
            ? "Ninguém com esses filtros."
            : `Nenhuma pessoa em ${TITULO_DO_GRUPO[grupo].toLowerCase()}.`
        }
        servidor={lista}
      />
    </div>
  );
}

/* Vaga e situação na URL; a busca (nome, código) fica fora dela. */
const FILTROS_DAS_PESSOAS: EsquemaDosFiltros<keyof FiltroDasPessoas> =
  Object.freeze({
    situacao: {
      padrao: FILTRO_DAS_PESSOAS_INICIAL.situacao,
      aceita: (valor: string) =>
        SITUACOES_DAS_PESSOAS.some((s) => s.valor === valor),
    },
    vaga: { padrao: "" },
    busca: { padrao: "", naUrl: false },
  });

export function PessoasDaTriagem({
  pre,
  editalId,
  vagas,
  leitura,
  rotuloEdital,
  unidade,
  podeCoordenar,
  aoVerVaga,
  situacaoPedida,
  aoMudarSituacao,
}: PropriedadesDasPessoas) {
  const [valores, setFiltro] = usarFiltrosNaUrl(FILTROS_DAS_PESSOAS, {
    sessao: chaveDasPessoas(editalId),
  });
  const filtro = useMemo(() => normalizarFiltroDasPessoas(valores), [valores]);
  // A busca vai ao banco 300 ms depois da última tecla (não a cada tecla).
  const [busca, setBusca] = useState(() => filtro.busca.trim());
  useEffect(() => {
    const espera = setTimeout(() => setBusca(filtro.busca.trim()), 300);
    return () => clearTimeout(espera);
  }, [filtro.busca]);
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
  const mudar = useCallback(
    (parte: Partial<FiltroDasPessoas>) =>
      setFiltro((atual) => ({ ...atual, ...parte })),
    [setFiltro],
  );
  // A faixa da Triagem escolhe a situação (Inscritos, Fora do lote).
  const vezDoPedido = situacaoPedida?.vez ?? 0;
  const situacaoDoPedido = situacaoPedida?.situacao;
  useEffect(() => {
    if (vezDoPedido && situacaoDoPedido) mudar({ situacao: situacaoDoPedido });
  }, [vezDoPedido, situacaoDoPedido, mudar]);
  useEffect(
    () => aoMudarSituacao?.(filtro.situacao),
    [aoMudarSituacao, filtro.situacao],
  );

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
    const acoes = acoesDaPessoa(c, { podeCoordenar });
    // Sem o que fazer (comunicado ou incluir), o botão da linha é "Ver na vaga".
    const principal: AcaoDaPessoa =
      acoes.principal ??
      (acoes.outras.includes("ver-vaga") ? "ver-vaga" : "copiar");
    const outras = acoes.outras.filter((a) => a !== principal);
    return {
      principal: principal
        ? {
            ...ROTULOS[principal],
            destaque: principal === "incluir",
            acao:
              principal === "comunicado"
                ? "espelho-eliminado-pre"
                : principal === "incluir"
                  ? "incluir-pessoa"
                  : `pessoa-${principal}`,
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

  const chaveDaLeitura = `${leitura}:${versao}`;

  return (
    <div className="avd-pre-pessoas" data-aba-da-triagem="pessoas">
      <CardDaLista
        rotulo="Pessoas da triagem"
        tour="triagem-pessoas"
        className="avd-pessoas"
      >
        <BarraDaLista
          rotulo="Encontrar a pessoa"
          tour="triagem-pessoas-busca"
          busca={{
            valor: filtro.busca,
            aoMudar: (valor) => mudar({ busca: valor }),
            placeholder: "Buscar por código ou nome",
            rotulo: "Buscar pessoa pelo código ou nome",
            acao: "buscar-pessoa",
          }}
          quantos={filtrosDasPessoasEmUso(filtro)}
          aoLimpar={() => setFiltro({ ...FILTRO_DAS_PESSOAS_INICIAL })}
          quantosSecundarios={
            filtro.situacao !== FILTRO_DAS_PESSOAS_INICIAL.situacao ? 1 : 0
          }
          secundarios={
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
          }
        >
          <select
            aria-label="Vaga"
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
        </BarraDaLista>
        {grupos.map((grupo, indice) => (
          <ListaDoGrupo
            key={grupo}
            grupo={grupo}
            titulo={grupos.length > 1 ? TITULO_DO_GRUPO[grupo] : ""}
            preguicoso={indice > 0}
            pre={pre}
            filtro={filtro}
            busca={busca}
            chaveDaLeitura={chaveDaLeitura}
            acoesDaLinha={acoesDaLinha}
          />
        ))}
      </CardDaLista>
      {mensagem ? (
        <Aviso
          tom={mensagem.tom === "danger" ? "danger" : undefined}
          papel={mensagem.tom === "danger" ? "alert" : "status"}
        >
          {mensagem.texto}
        </Aviso>
      ) : null}
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
