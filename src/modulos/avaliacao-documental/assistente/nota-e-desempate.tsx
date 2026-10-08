import {
  comDesempateDaProvisoria,
  perguntaSugeridaDaParcial,
} from "../../../lib/avaliacao-documental/assistente-da-regra.ts";
import { DESEMPATES_DA_PROVISORIA } from "../../../lib/avaliacao-documental/catalogo.js";
import type {
  DesempateDaProvisoria,
  RegraAnalise,
} from "../../../lib/avaliacao-documental/tipos-da-regra.ts";
import {
  CATALOGO_DE_CRITERIOS,
  DIRECOES,
  NIVEIS,
} from "../../../lib/classificacao/catalogo.js";
import { rotuloDaVersao } from "../../../lib/nome-da-versao.ts";
import { Aviso } from "../../../ui/index.js";
import { CampoNumero } from "../campos.jsx";
import { ListaOrdenavel } from "./lista-ordenavel.tsx";
import type { ApoioDaRegra, NotaMinimaDaClassificacao } from "./tipos.ts";

/*
  Passo 4: nota mínima e desempate na mesma tela. A nota mínima e os
  critérios de desempate são da regra de CLASSIFICAÇÃO do edital (gravados
  pelo salvar_regra_classificacao, com a permissão da Classificação); o
  desempate da Provisória (a lista do lote) é da regra da avaliação.
  Arrastar ou as setas mudam a ordem.
*/

export type CriterioDaClassificacao = { criterio: string; direcao: string };
export type RegraDeClassificacao = {
  documental: {
    nota_minima: number | null;
    nota_minima_por_nivel: Record<string, number | null>;
  } & Record<string, unknown>;
  desempate: CriterioDaClassificacao[];
} & Record<string, unknown>;

type Props = {
  regra: RegraAnalise;
  aoMudar: (regra: RegraAnalise) => void;
  classificacao: ApoioDaRegra["classificacao"] | null;
  rascunhoDaClassificacao: RegraDeClassificacao | null;
  aoMudarClassificacao: (regra: RegraDeClassificacao) => void;
  notaMinimaAtual: NotaMinimaDaClassificacao;
};

type CriterioDoCatalogo = { codigo: string; nome: string; direcao: string };
const CRITERIOS =
  CATALOGO_DE_CRITERIOS as unknown as ReadonlyArray<CriterioDoCatalogo>;
const NOME_DO_CRITERIO = new Map(CRITERIOS.map((c) => [c.codigo, c.nome]));
const DIRECOES_DA_TELA = DIRECOES as unknown as ReadonlyArray<
  readonly [string, string]
>;
const NIVEIS_DA_TELA = NIVEIS as unknown as ReadonlyArray<
  readonly [string, string]
>;
const DESEMPATES = DESEMPATES_DA_PROVISORIA as unknown as ReadonlyArray<
  readonly [DesempateDaProvisoria, string]
>;
const ROTULO_DO_DESEMPATE = new Map(DESEMPATES);

function NotaMinimaEDesempate({
  rascunho,
  aoMudar,
  podeEditar,
}: {
  rascunho: RegraDeClassificacao;
  aoMudar: (r: RegraDeClassificacao) => void;
  podeEditar: boolean;
}) {
  const doc = rascunho.documental;
  const porNivel = doc.nota_minima_por_nivel ?? {};
  const escolhidos = new Set(rascunho.desempate.map((d) => d.criterio));
  const disponiveis = CRITERIOS.filter((c) => !escolhidos.has(c.codigo));
  return (
    <fieldset className="avd-ast-fieldset" disabled={!podeEditar}>
      <div className="avd-linha" data-tour="avd-assistente-nota-minima">
        <CampoNumero
          rotulo="Nota mínima (pontos)"
          valor={doc.nota_minima}
          aoMudar={(v) =>
            aoMudar({
              ...rascunho,
              documental: { ...doc, nota_minima: v as number | null },
            })
          }
        />
        {NIVEIS_DA_TELA.map(([n, rotulo]) => (
          <CampoNumero
            key={n}
            rotulo={`${rotulo} (se diferente)`}
            valor={porNivel[n] ?? null}
            aoMudar={(v) => {
              const novo = { ...porNivel };
              if (v === null) delete novo[n];
              else novo[n] = v as number;
              aoMudar({
                ...rascunho,
                documental: { ...doc, nota_minima_por_nivel: novo },
              });
            }}
          />
        ))}
      </div>
      <h4 className="avd-ast-subtitulo">Desempate da classificação</h4>
      <ListaOrdenavel
        rotulo="Critérios de desempate da classificação, em ordem"
        itens={rascunho.desempate}
        chave={(d) => d.criterio}
        desabilitado={!podeEditar}
        tour="avd-assistente-desempate"
        aoMudar={(desempate) => aoMudar({ ...rascunho, desempate })}
        conteudo={(d, i) => (
          <div className="avd-ast-criterio">
            <span>{NOME_DO_CRITERIO.get(d.criterio) ?? d.criterio}</span>
            <select
              aria-label={`Direção do ${i + 1}º critério`}
              value={d.direcao}
              onChange={(ev) =>
                aoMudar({
                  ...rascunho,
                  desempate: rascunho.desempate.map((x, j) =>
                    j === i ? { ...x, direcao: ev.target.value } : x,
                  ),
                })
              }
            >
              {DIRECOES_DA_TELA.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </div>
        )}
      />
      {disponiveis.length ? (
        <label className="avd-ast-escolha">
          <span>Acrescentar critério</span>
          <select
            value=""
            onChange={(ev) => {
              const c = CRITERIOS.find((x) => x.codigo === ev.target.value);
              if (c)
                aoMudar({
                  ...rascunho,
                  desempate: [
                    ...rascunho.desempate,
                    { criterio: c.codigo, direcao: c.direcao },
                  ],
                });
            }}
          >
            <option value="">Escolha…</option>
            {disponiveis.map((c) => (
              <option key={c.codigo} value={c.codigo}>
                {c.nome}
              </option>
            ))}
          </select>
        </label>
      ) : null}
    </fieldset>
  );
}

export function PassoNotaEDesempate({
  regra,
  aoMudar,
  classificacao,
  rascunhoDaClassificacao,
  aoMudarClassificacao,
  notaMinimaAtual,
}: Props) {
  const desempate = regra.provisoria.desempate ?? [];
  const faltam = DESEMPATES.filter(([d]) => !desempate.includes(d));
  const mudarDesempate = (lista: DesempateDaProvisoria[]) => {
    let nova = comDesempateDaProvisoria(regra, lista);
    // A experiência declarada precisa da pergunta: a da nota declarada ou a do bloco.
    if (
      lista.includes("EXPERIENCIA_DECLARADA") &&
      !regra.provisoria.pergunta_experiencia
    ) {
      const daDeclarada = regra.provisoria.nota_declarada.find(
        (i) => i.parcial === "EXPERIENCIA",
      )?.pergunta;
      const pergunta =
        daDeclarada || perguntaSugeridaDaParcial(regra, "EXPERIENCIA") || null;
      nova = {
        ...nova,
        provisoria: { ...nova.provisoria, pergunta_experiencia: pergunta },
      };
    }
    aoMudar(nova);
  };
  return (
    <div className="avd-ast-passo">
      <section className="avd-ast-grupo" aria-label="Regra de classificação">
        <h3 className="avd-ast-grupo-titulo">
          Nota mínima e desempate da classificação
          {classificacao?.regra ? (
            <span className="avd-ast-contagem">
              regra de classificação: {rotuloDaVersao(classificacao.regra)}
            </span>
          ) : null}
        </h3>
        {!classificacao?.pode_ler ? (
          <Aviso tom="info">
            Sem acesso à Classificação: nota mínima{" "}
            {notaMinimaAtual?.nota_minima === null ||
            notaMinimaAtual?.nota_minima === undefined
              ? "—"
              : String(notaMinimaAtual.nota_minima).replace(".", ",")}
            , sem mudar aqui.
          </Aviso>
        ) : !classificacao.regra || !rascunhoDaClassificacao ? (
          <Aviso tom="warning">
            O edital ainda não tem regra de classificação: crie-a na
            Classificação.
          </Aviso>
        ) : (
          <NotaMinimaEDesempate
            rascunho={rascunhoDaClassificacao}
            aoMudar={aoMudarClassificacao}
            podeEditar={classificacao.pode_editar}
          />
        )}
      </section>

      <section
        className="avd-ast-grupo"
        aria-label="Desempate da Provisória"
        data-tour="avd-assistente-desempate-provisoria"
      >
        <h3 className="avd-ast-grupo-titulo">
          Desempate da lista do lote (Provisória)
        </h3>
        <ListaOrdenavel
          rotulo="Critérios de desempate da Provisória, em ordem"
          itens={desempate}
          chave={(d) => d}
          aoMudar={mudarDesempate}
          conteudo={(d) => <span>{ROTULO_DO_DESEMPATE.get(d) ?? d}</span>}
        />
        {faltam.length ? (
          <label className="avd-ast-escolha">
            <span>Acrescentar critério</span>
            <select
              value=""
              onChange={(ev) => {
                const d = ev.target.value as DesempateDaProvisoria;
                if (d) mudarDesempate([...desempate, d]);
              }}
            >
              <option value="">Escolha…</option>
              {faltam.map(([v, r]) => (
                <option key={v} value={v}>
                  {r}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>
    </div>
  );
}
