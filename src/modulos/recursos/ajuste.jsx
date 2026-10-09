import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  candidatoAtual,
  itensDoAjuste,
  itensParaEnviar,
  LIMITES_DO_AJUSTE,
  listaDaOrigem,
  LISTAS_DA_PREVIA,
  montarItens,
  previaDoAjuste,
  validarAjuste,
} from "../../lib/classificacao/ajustes.js";
import { rotuloDoItem } from "../../lib/classificacao/motor.js";
import { formatarNota, ordinal } from "../../lib/classificacao/numeros.js";
import { Aviso, Campo, Secao, Segmentado, Selo } from "../../ui/index.js";
import { dataHora } from "./partes.ts";

/*
  "Ajuste da pontuação", na gaveta do recurso (migration
  20261005130000_recurso_ajusta_pontuacao.sql): no recurso deferido (total ou
  parcialmente), quem decide propõe os novos valores dos componentes da nota
  da REGRA DO EDITAL (src/lib/classificacao/ajustes.js), vê a prévia — nova
  nota e nova posição, calculadas pelo motor da Classificação — e quem aprova
  a resposta (o parecer jurídico) aprova. A nota da análise nunca muda: o
  ajuste é uma versão guardada, e só o aprovado vale na Classificação. Reabrir
  a decisão cancela o ajuste (o banco faz). Tudo é texto, nunca HTML.
*/

const SITUACOES = {
  PROPOSTO: ["pendente", "Proposto"],
  APROVADO: ["aprovado", "Aprovado"],
  CANCELADO: ["neutro", "Cancelado"],
};
const ROTULO_DA_LISTA = Object.fromEntries(LISTAS_DA_PREVIA);
const quemQuando = (em, por) => [dataHora(em), por].filter(Boolean).join(" · ");
const posicao = (r) =>
  !r?.naLista
    ? "fora da lista"
    : r.elegivel
      ? r.posicao
        ? ordinal(r.posicao)
        : "fora da geral"
      : "eliminado";
const posicaoDoAfetado = (p) => (p ? ordinal(p) : "fora da lista");

/* Componente · antes · depois · justificativa. */
function TabelaDeItens({ itens, rotulos = {} }) {
  return (
    <div className="ui-tabela-rolagem">
      <table className="recursos-ajuste-itens">
        <thead>
          <tr>
            <th scope="col">Componente</th>
            <th scope="col">Antes</th>
            <th scope="col">Depois</th>
            <th scope="col">Justificativa</th>
          </tr>
        </thead>
        <tbody>
          {itens.map((i) => (
            <tr key={i.codigo} data-item={i.codigo}>
              <td>{rotulos[i.codigo] || rotuloDoItem(i.codigo)}</td>
              <td>{formatarNota(numeroOuNulo(i.anterior), 2)}</td>
              <td>
                <strong>{formatarNota(numeroOuNulo(i.novo), 2)}</strong>
              </td>
              <td>{i.justificativa || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const numeroOuNulo = (v) =>
  v === null || v === undefined || v === "" || !Number.isFinite(Number(v))
    ? null
    : Number(v);

/* Nova nota e nova posição (e quem muda de posição por causa dele). */
export function ResumoDaPrevia({ previa }) {
  if (!previa?.antes) return null;
  const { antes, depois } = previa;
  return (
    <div className="recursos-ajuste-previa" data-previa={previa.tipo}>
      <p>
        <strong>{ROTULO_DA_LISTA[previa.tipo] || previa.tipo}:</strong> nota{" "}
        {formatarNota(antes.nota, 2)} →{" "}
        <strong>{formatarNota(depois.nota, 2)}</strong>; posição{" "}
        {posicao(antes)} → <strong>{posicao(depois)}</strong>
        {previa.mudou ? "" : " (a posição não muda)"}.
      </p>
      {previa.afetados?.length ? (
        <p className="recursos-motivo" data-afetados={previa.totalAfetados}>
          Mudam de posição:{" "}
          {previa.afetados
            .map(
              (a) =>
                `${a.nome} ${posicaoDoAfetado(a.antes)} → ${posicaoDoAfetado(a.depois)}`,
            )
            .join("; ")}
          {previa.totalAfetados > previa.afetados.length
            ? ` e mais ${previa.totalAfetados - previa.afetados.length}`
            : ""}
          .
        </p>
      ) : null}
    </div>
  );
}

/* O que a tela precisa dos dados da prévia: o candidato e os componentes da regra. */
function usarBaseDoAjuste(dados, recurso) {
  return useMemo(() => {
    if (!dados || dados.erro) return { erro: dados?.erro || "" };
    if (!dados.regra?.configuracao)
      return { erro: "O edital ainda não tem regra de classificação." };
    const candidato = candidatoAtual(dados, recurso.analise_id, {
      semRecurso: recurso.id,
    });
    if (!candidato)
      return { erro: "O candidato não está nas análises do edital." };
    return {
      candidato,
      itens: itensDoAjuste(dados.regra.configuracao, candidato),
    };
  }, [dados, recurso.analise_id, recurso.id]);
}

function FormularioDoAjuste({
  estado,
  recurso,
  dados,
  base,
  emCurso,
  aoFechar,
}) {
  const { itens = [], erro } = usarBaseDoAjuste(dados, recurso);
  const [lista, setLista] = useState(listaDaOrigem(recurso.origem));
  const [valores, setValores] = useState(() =>
    Object.fromEntries(
      (base?.itens || []).map((i) => [
        i.codigo,
        formatarNota(numeroOuNulo(i.novo), 2),
      ]),
    ),
  );
  const [justificativas, setJustificativas] = useState(() =>
    Object.fromEntries(
      (base?.itens || [])
        .filter((i) => i.justificativa)
        .map((i) => [i.codigo, i.justificativa]),
    ),
  );
  const [geral, setGeral] = useState(base?.justificativa || "");
  const idGeral = useId();
  const montados = useMemo(
    () => montarItens(itens, { valores, justificativas }),
    [itens, valores, justificativas],
  );
  const erros = validarAjuste(montados, geral);
  const enviar = useMemo(() => itensParaEnviar(montados), [montados]);
  const previa = useMemo(
    () =>
      erro || !enviar.length
        ? null
        : previaDoAjuste({
            dados,
            tipo: lista,
            analiseId: recurso.analise_id,
            recursoId: recurso.id,
            numero: recurso.nu,
            itens: enviar,
          }),
    [dados, lista, recurso, enviar, erro],
  );

  if (erro)
    return (
      <Aviso como="p" className="recursos-aviso" tom="warning">
        {erro}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={aoFechar}
        >
          Fechar
        </button>
      </Aviso>
    );

  return (
    <form
      className="recursos-bloco recursos-ajuste-formulario"
      onSubmit={async (evento) => {
        evento.preventDefault();
        if (erros.length || !previa) return;
        const ok = await estado.proporAjuste(recurso, {
          lista,
          justificativa: geral.trim() || null,
          itens: enviar,
          previa,
        });
        if (ok) aoFechar();
      }}
    >
      <div className="ui-tabela-rolagem">
        <table className="recursos-ajuste-itens">
          <thead>
            <tr>
              <th scope="col">Componente</th>
              <th scope="col">Atual</th>
              <th scope="col">Novo</th>
              <th scope="col">Justificativa</th>
            </tr>
          </thead>
          <tbody>
            {montados.map((i) => (
              <tr key={i.codigo} data-item={i.codigo}>
                <th scope="row">{i.rotulo}</th>
                <td>{formatarNota(i.atual, 2)}</td>
                <td>
                  {i.calculado ? (
                    <strong data-calculado="">{formatarNota(i.novo, 2)}</strong>
                  ) : (
                    <input
                      name={`novo-${i.codigo}`}
                      inputMode="decimal"
                      aria-label={`Novo valor: ${i.rotulo}`}
                      aria-invalid={i.invalido || undefined}
                      placeholder={formatarNota(i.atual, 2)}
                      value={valores[i.codigo] ?? ""}
                      onChange={(ev) =>
                        setValores((v) => ({
                          ...v,
                          [i.codigo]: ev.target.value,
                        }))
                      }
                    />
                  )}
                </td>
                <td>
                  {i.calculado ? (
                    <span className="recursos-motivo">
                      Soma dos componentes
                    </span>
                  ) : (
                    <input
                      name={`justificativa-${i.codigo}`}
                      aria-label={`Justificativa: ${i.rotulo}`}
                      maxLength={LIMITES_DO_AJUSTE.itemJustificativa.maximo}
                      value={justificativas[i.codigo] ?? ""}
                      onChange={(ev) =>
                        setJustificativas((v) => ({
                          ...v,
                          [i.codigo]: ev.target.value,
                        }))
                      }
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Campo rotulo="Justificativa geral">
        <textarea
          id={idGeral}
          name="justificativa"
          rows={3}
          maxLength={LIMITES_DO_AJUSTE.justificativa.maximo}
          value={geral}
          onChange={(ev) => setGeral(ev.target.value)}
        />
      </Campo>
      <Segmentado
        rotulo="Prévia na lista"
        opcoes={LISTAS_DA_PREVIA.map(([valor, rotulo]) => ({ valor, rotulo }))}
        valor={lista}
        aoMudar={setLista}
      />
      {previa ? <ResumoDaPrevia previa={previa} /> : null}
      {erros.length ? (
        <ul className="recursos-motivo" data-erros-do-ajuste="">
          {erros.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      ) : null}
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary small"
          onClick={aoFechar}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="btn small"
          data-acao-ajuste="propor"
          disabled={Boolean(erros.length) || !previa || emCurso}
        >
          {emCurso ? "Salvando…" : "Propor ajuste"}
        </button>
      </div>
    </form>
  );
}

/* Aprovar: a prévia é recalculada com os dados de agora e gravada com a aprovação. */
function ConfirmarAprovacao({
  estado,
  recurso,
  ajuste,
  dados,
  emCurso,
  aoFechar,
}) {
  const previa = useMemo(() => {
    if (!dados || dados.erro || !dados.regra?.configuracao) return null;
    return previaDoAjuste({
      dados,
      tipo: ajuste.lista,
      analiseId: recurso.analise_id,
      recursoId: recurso.id,
      numero: recurso.nu,
      itens: ajuste.itens,
    });
  }, [dados, ajuste, recurso]);
  return (
    <div className="recursos-bloco recursos-confirmacao" data-aprovar-ajuste="">
      {dados?.erro ? (
        <Aviso como="p" className="recursos-aviso" tom="danger">
          Não foi possível calcular a prévia: {dados.erro}
        </Aviso>
      ) : !dados ? (
        <p className="recursos-motivo">Calculando a prévia…</p>
      ) : previa ? (
        <ResumoDaPrevia previa={previa} />
      ) : (
        <Aviso como="p" className="recursos-aviso" tom="warning">
          O edital ainda não tem regra de classificação.
        </Aviso>
      )}
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary small"
          onClick={aoFechar}
        >
          Voltar
        </button>
        <button
          type="button"
          className="btn small"
          data-acao-ajuste="confirmar-aprovacao"
          disabled={!previa || emCurso}
          onClick={async () => {
            const ok = await estado.aprovarAjuste(recurso, ajuste.id, previa);
            if (ok) aoFechar();
          }}
        >
          {emCurso ? "Salvando…" : "Aprovar ajuste"}
        </button>
      </div>
    </div>
  );
}

function ConfirmarCancelamento({ estado, recurso, ajuste, emCurso, aoFechar }) {
  const [motivo, setMotivo] = useState("");
  const idMotivo = useId();
  const valido = motivo.trim().length >= 3;
  return (
    <form
      className="recursos-bloco recursos-confirmacao"
      onSubmit={async (evento) => {
        evento.preventDefault();
        if (!valido) return;
        const ok = await estado.cancelarAjuste(recurso, ajuste.id, motivo);
        if (ok) aoFechar();
      }}
    >
      <Campo rotulo="Motivo do cancelamento">
        <input
          id={idMotivo}
          name="motivo"
          maxLength={2000}
          value={motivo}
          data-foco-inicial
          onChange={(ev) => setMotivo(ev.target.value)}
        />
      </Campo>
      <div className="ui-acoes">
        <button
          type="button"
          className="btn secondary small"
          onClick={aoFechar}
        >
          Voltar
        </button>
        <button
          type="submit"
          className="btn danger small"
          data-acao-ajuste="confirmar-cancelamento"
          disabled={!valido || emCurso}
        >
          {emCurso ? "Salvando…" : "Cancelar ajuste"}
        </button>
      </div>
    </form>
  );
}

function CartaoDoAjuste({ ajuste, children }) {
  const [tom, rotulo] = SITUACOES[ajuste.situacao] || [
    "neutro",
    ajuste.situacao,
  ];
  const previa = ajuste.previa_aprovacao || ajuste.previa;
  return (
    <article
      className="recursos-bloco recursos-ajuste"
      data-ajuste={ajuste.situacao}
      data-versao={ajuste.versao}
    >
      <p className="recursos-ajuste-cabeca">
        <Selo tom={tom}>{rotulo}</Selo> <strong>Versão {ajuste.versao}</strong>{" "}
        <small>
          proposto {quemQuando(ajuste.proposto_em, ajuste.proposto_por)}
          {ajuste.aprovado_em
            ? ` · aprovado ${quemQuando(ajuste.aprovado_em, ajuste.aprovado_por)}`
            : ""}
          {ajuste.cancelado_em
            ? ` · cancelado ${quemQuando(ajuste.cancelado_em, ajuste.cancelado_por)}`
            : ""}
        </small>
      </p>
      <TabelaDeItens itens={ajuste.itens || []} />
      {ajuste.justificativa ? (
        <p className="ui-secao-texto">{ajuste.justificativa}</p>
      ) : null}
      {ajuste.motivo_cancelamento ? (
        <p className="recursos-motivo">
          Cancelado: {ajuste.motivo_cancelamento}
        </p>
      ) : null}
      <ResumoDaPrevia previa={previa} />
      {ajuste.situacao === "APROVADO" ? (
        <p
          className="recursos-motivo"
          data-mudou-posicao={ajuste.mudou_posicao}
        >
          {ajuste.mudou_posicao
            ? "Mudou a classificação (marca automática do recurso)."
            : "Não mudou a posição do candidato."}
        </p>
      ) : null}
      {children}
    </article>
  );
}

export function SecaoDoAjuste({ estado, recurso: r, acao }) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const dados = e.ajustes.get(r.id);
  const previa = e.previas.get(r.id) || null;
  const [modo, setModo] = useState(null); // { tipo: propor|aprovar|cancelar, ajuste }

  useEffect(() => {
    if (!r.fora_analise && !e.ajustes.has(r.id))
      void estado.carregarAjustes(r.id);
  }, [estado, r.id, r.fora_analise, e.ajustes]);

  if (r.fora_analise || !dados) return null;
  if (dados.erro)
    return (
      <Secao icone="fa-sliders" titulo="Ajuste da pontuação" secao="ajuste">
        <Aviso como="p" className="recursos-aviso" tom="danger">
          Não foi possível carregar o ajuste da pontuação.{" "}
          <small>{dados.erro}</small>
        </Aviso>
      </Secao>
    );
  const versoes = dados.ajustes || [];
  if (!dados.pode_propor && !versoes.length) return null;

  const proposto = versoes.find((v) => v.situacao === "PROPOSTO") || null;
  const aprovado = versoes.find((v) => v.situacao === "APROVADO") || null;
  const anteriores = versoes.filter((v) => v.situacao === "CANCELADO");
  const ocupado = Boolean(acao);
  const emCurso = (tipo) => acao?.tipo === `ajuste:${tipo}`;
  const abrir = async (tipo, ajuste = null) => {
    setModo({ tipo, ajuste });
    if (tipo === "propor") await estado.carregarDadosDaPrevia(r.id);
    if (tipo === "aprovar")
      await estado.carregarDadosDaPrevia(r.id, { forcar: true });
  };
  const fechar = () => setModo(null);

  const acoesDo = (ajuste) =>
    modo?.ajuste?.id === ajuste.id ? (
      modo.tipo === "aprovar" ? (
        <ConfirmarAprovacao
          estado={estado}
          recurso={r}
          ajuste={ajuste}
          dados={previa}
          emCurso={emCurso("aprovar")}
          aoFechar={fechar}
        />
      ) : (
        <ConfirmarCancelamento
          estado={estado}
          recurso={r}
          ajuste={ajuste}
          emCurso={emCurso("cancelar")}
          aoFechar={fechar}
        />
      )
    ) : modo ? null : (
      <div className="ui-acoes">
        {ajuste.situacao === "PROPOSTO" && dados.pode_cancelar ? (
          <button
            type="button"
            className="btn small"
            data-acao-ajuste="aprovar"
            disabled={!dados.pode_aprovar || ocupado}
            title={
              dados.pode_aprovar
                ? "Aprovar ajuste"
                : "Defira o recurso (total ou parcialmente) antes de aprovar o ajuste"
            }
            onClick={() => void abrir("aprovar", ajuste)}
          >
            Aprovar
          </button>
        ) : null}
        {dados.pode_cancelar ? (
          <button
            type="button"
            className="btn secondary small"
            data-acao-ajuste="cancelar"
            disabled={ocupado}
            onClick={() => setModo({ tipo: "cancelar", ajuste })}
          >
            Cancelar ajuste
          </button>
        ) : null}
      </div>
    );

  return (
    <Secao icone="fa-sliders" titulo="Ajuste da pontuação" secao="ajuste">
      <div className="recursos-ajustes" data-tour="recursos-ajuste">
        {aprovado ? (
          <CartaoDoAjuste ajuste={aprovado}>{acoesDo(aprovado)}</CartaoDoAjuste>
        ) : null}
        {proposto ? (
          <CartaoDoAjuste ajuste={proposto}>{acoesDo(proposto)}</CartaoDoAjuste>
        ) : null}

        {modo?.tipo === "propor" ? (
          previa ? (
            <FormularioDoAjuste
              key={proposto?.id || aprovado?.id || "novo"}
              estado={estado}
              recurso={r}
              dados={previa}
              base={proposto || aprovado}
              emCurso={emCurso("propor")}
              aoFechar={fechar}
            />
          ) : (
            <p className="recursos-motivo">
              Carregando os dados da classificação…
            </p>
          )
        ) : dados.pode_propor && !modo ? (
          <div className="ui-acoes">
            <button
              type="button"
              className="btn small"
              data-acao-ajuste="propor"
              disabled={ocupado}
              onClick={() => void abrir("propor")}
            >
              {proposto || aprovado ? "Propor nova versão" : "Propor ajuste"}
            </button>
          </div>
        ) : null}

        {anteriores.length ? (
          <details className="recursos-historico-resposta">
            <summary>Versões anteriores ({anteriores.length})</summary>
            {anteriores.map((v) => (
              <CartaoDoAjuste key={v.id} ajuste={v} />
            ))}
          </details>
        ) : null}
      </div>
    </Secao>
  );
}
