import type { ResultadoDaPublicacao } from "../../lib/tipos-da-publicacao-de-aprovados.ts";
import type {
  CasamentoDaLista,
  PessoaDaListaVigente,
  QuemEntra,
} from "../../lib/casamento-da-lista.ts";
import type {
  EstadoDaClassificacao,
  ListaRegistrada,
  ResultadoDaClassificacao,
} from "./tipos-do-estado.ts";
type Preparo = NonNullable<
  Awaited<ReturnType<EstadoDaClassificacao["prepararPublicacaoDeAprovados"]>>
>;
type Props = {
  estado: Pick<
    EstadoDaClassificacao,
    "prepararPublicacaoDeAprovados" | "publicarComoListaDeAprovados"
  >;
  registro: ListaRegistrada;
  /** O cálculo de agora: a lista só é publicada se o retrato bater com ele. */
  resultado: ResultadoDaClassificacao | null;
  analises: ReadonlyMap<string, { vaga?: unknown; cargo?: unknown }>;
  aoFechar: () => void;
};

import { useEffect, useMemo, useRef, useState } from "react";
import { formatarNota } from "../../lib/classificacao/numeros.ts";
import { numerosDoCasamento } from "../../lib/casamento-da-lista.ts";
import {
  MOTIVO_MAXIMO,
  motivoValido,
  origemDaLista,
} from "../../lib/publicacao-de-aprovados.ts";
import { Aviso, GradeDeKpis, Kpi, Modal } from "../../ui/index.ts";

/*
  "Publicar como lista de aprovados" (Classificação › Listas › Resultado final):
  o resultado final registrado vira a lista de aprovados vigente do edital.
  Desde 20261030090000 a prévia é do job Python (o mesmo fluxo de "Substituir
  XLSX" na Lista de aprovados): quem da lista vigente casa com quem entra e leva
  o estado (status, matrícula, convocação, sub judice, anexos), quantos entram,
  saem e mudam de posição, e quem saiu com dados e precisa de revisão — ali dá
  para dizer quem é a mesma pessoa; "Recalcular" pede o casamento de novo com a
  revisão. A mesma permissão do XLSX: lista já cadastrada só quem pode
  substituir; lista com status pede o motivo.
*/

function rotuloDoNovo(n: QuemEntra) {
  return `${n.nome} — ${n.codigo_vaga || n.cargo} · ${n.posicao ?? "—"}º`;
}

function LinhaDeRevisao({
  anterior,
  novos,
  escolhido,
  aoEscolher,
}: {
  anterior: PessoaDaListaVigente;
  novos: QuemEntra[];
  escolhido: string;
  aoEscolher: (valor: string) => void;
}) {
  const id = `revisao-${anterior.candidato_id}`;
  return (
    <li className="classificacao-revisao-linha">
      <label htmlFor={id}>
        <strong>{anterior.nome}</strong>
        <span className="ui-texto-secundario">
          {[
            anterior.codigo_vaga || anterior.cargo,
            anterior.classificacao ? `${anterior.classificacao}º` : "",
            anterior.status,
            anterior.matricula ? `matrícula ${anterior.matricula}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </label>
      <select
        id={id}
        value={escolhido}
        onChange={(evento) => aoEscolher(evento.target.value)}
      >
        <option value="">Não está na lista nova</option>
        {novos.map((n) => (
          <option key={n.chave} value={n.chave}>
            {rotuloDoNovo(n)}
          </option>
        ))}
      </select>
    </li>
  );
}

const iguais = (a: Record<string, string>, b: Record<string, string>) => {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
};

function Revisao({
  casamento,
  manuais,
  aoEscolher,
}: {
  casamento: CasamentoDaLista;
  manuais: Record<string, string>;
  aoEscolher: (candidatoId: string, chave: string) => void;
}) {
  const vinculos = casamento.plano?.vinculos ?? [];
  const novosPorNome = useMemo(
    () =>
      [...casamento.novos].sort((a, b) =>
        a.nome.localeCompare(b.nome, "pt-BR"),
      ),
    [casamento.novos],
  );
  if (!casamento.revisar.length) return null;
  // Quem já tem par (no plano ou na revisão de agora) sai das opções dos outros.
  const ocupados = new Set([
    ...vinculos.map((v) => v.chave),
    ...Object.values(manuais).filter(Boolean),
  ]);
  return (
    <section
      className="classificacao-revisao"
      aria-labelledby="classificacaoRevisaoTitulo"
    >
      <h3 id="classificacaoRevisaoTitulo">
        Revisar: {casamento.revisar.length} pessoa(s) da lista vigente sem par
        na lista nova
      </h3>
      <ul>
        {casamento.revisar.map((anterior) => {
          const id = anterior.candidato_id;
          const doPlano =
            vinculos.find((v) => v.candidato_id === id)?.chave ?? "";
          const escolhido = Object.prototype.hasOwnProperty.call(manuais, id)
            ? (manuais[id] ?? "")
            : doPlano;
          return (
            <LinhaDeRevisao
              key={id}
              anterior={anterior}
              novos={novosPorNome.filter(
                (n) => n.chave === escolhido || !ocupados.has(n.chave),
              )}
              escolhido={escolhido}
              aoEscolher={(valor) => aoEscolher(id, valor)}
            />
          );
        })}
      </ul>
    </section>
  );
}

export function ModalDePublicacaoDeAprovados({
  estado,
  registro,
  resultado: calculado,
  aoFechar,
}: Props) {
  const [preparo, setPreparo] = useState<Preparo | null>(null);
  const [pedidoDeManuais, setPedidoDeManuais] = useState<
    Record<string, string>
  >({});
  const [manuais, setManuais] = useState<Record<string, string>>({});
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [publicado, setPublicado] = useState<ResultadoDaPublicacao | null>(
    null,
  );

  /*
    Cada prévia é um pedido ao job Python: um por lista e revisão, mesmo que o
    efeito rode de novo (nova renderização do pai, StrictMode).
  */
  const pedidos = useRef(new Map<string, Promise<Preparo | null>>());
  const ultimo = useRef({ registro, calculado });
  ultimo.current = { registro, calculado };
  useEffect(() => {
    let vivo = true;
    const chave = `${registro.id}|${JSON.stringify(pedidoDeManuais)}`;
    if (!pedidos.current.has(chave))
      pedidos.current.set(
        chave,
        estado.prepararPublicacaoDeAprovados(
          ultimo.current.registro,
          ultimo.current.calculado,
          pedidoDeManuais,
        ),
      );
    setPreparo(null);
    void pedidos.current.get(chave)?.then((p) => {
      if (vivo) setPreparo(p || { erro: "Lista não encontrada." });
    });
    return () => {
      vivo = false;
    };
  }, [estado, registro.id, pedidoDeManuais]);

  const situacao = preparo && "situacao" in preparo ? preparo.situacao : null;
  const casamento =
    preparo && "casamento" in preparo ? preparo.casamento : null;
  const vigente = situacao?.vigente || null;
  const podeSubstituir = !vigente || situacao?.pode_substituir !== false;
  const revisaoMudou = casamento ? !iguais(manuais, casamento.manuais) : false;
  const exigeMotivo = Boolean(casamento?.exige_motivo);
  const bloqueada =
    !casamento ||
    !podeSubstituir ||
    revisaoMudou ||
    (exigeMotivo && !motivoValido(motivo));

  async function publicar() {
    if (enviando || bloqueada || !casamento) return;
    setEnviando(true);
    const r = await estado.publicarComoListaDeAprovados({
      pedidoId: casamento.pedido_id,
      motivo: exigeMotivo ? motivo : "",
    });
    setEnviando(false);
    if (r) setPublicado(r);
  }

  const n = casamento ? numerosDoCasamento(casamento) : null;
  const nomeDoNovo = new Map((casamento?.novos ?? []).map((x) => [x.chave, x]));
  const origem = origemDaLista(vigente);
  const kpis: [string, string, string, string, number][] = n
    ? [
        ["entram", "sucesso", "fa-user-plus", "Entram", n.entram],
        ["saem", "perigo", "fa-user-minus", "Saem", n.semPar],
        ["mudam", "alerta", "fa-right-left", "Mudam de posição", n.mudam],
        [
          "preservados",
          "info",
          "fa-user-check",
          "Status e sub judice preservados",
          n.preservados,
        ],
      ]
    : [];
  if (n?.subJudiceMantidos)
    kpis.push([
      "sub-judice",
      "destaque",
      "fa-gavel",
      "Sub judice mantidos",
      n.subJudiceMantidos,
    ]);

  return (
    <Modal
      id="classificacaoPublicarAprovados"
      rotuloId="classificacaoPublicarAprovadosTitulo"
      aoFechar={aoFechar}
      fecharAoClicarFora={false}
      cartaoClassName="classificacao-publicar-aprovados"
    >
      <div className="classificacao-publicar-corpo">
        <h2 id="classificacaoPublicarAprovadosTitulo">
          Publicar como lista de aprovados
        </h2>
        {!preparo ? (
          <div aria-busy="true" data-casando>
            <p className="ui-texto-secundario">Casando as pessoas…</p>
            <div className="ui-esqueleto-linha" />
            <div className="ui-esqueleto-linha" />
          </div>
        ) : "erro" in preparo ? (
          <Aviso tom="danger" papel="alert">
            {preparo.erro}
          </Aviso>
        ) : publicado ? (
          <>
            <Aviso tom="info" papel="status">
              Lista de aprovados publicada com {publicado.candidatos}{" "}
              candidato(s).
            </Aviso>
            {publicado.pendencias?.length ? (
              <Aviso tom="warning" papel="status">
                {publicado.pendencias.length} pessoa(s) da lista anterior com
                status ou matrícula ficaram fora: revise na Lista de aprovados
                (a lista anterior continua no histórico).
              </Aviso>
            ) : null}
            <div className="ui-acoes">
              <button type="button" className="btn" onClick={aoFechar}>
                Fechar
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="ui-texto-secundario" data-origem-vigente>
              {vigente
                ? `Lista vigente: ${origem?.texto ?? ""} · ${casamento?.anteriores ?? 0} candidato(s)`
                : "O edital ainda não tem lista de aprovados."}
              {casamento
                ? ` · Resultado final: ${casamento.novos_total} candidato(s)`
                : ""}
            </p>
            {!podeSubstituir ? (
              <Aviso tom="warning" papel="alert">
                Só o admin da Importação substitui a lista de aprovados vigente.
              </Aviso>
            ) : null}
            {casamento ? (
              <>
                <GradeDeKpis rotulo="O que muda na lista de aprovados">
                  {kpis.map(([chave, tom, icone, rotulo, valor]) => (
                    <Kpi
                      key={chave}
                      chave={chave}
                      tom={tom}
                      icone={icone}
                      rotulo={rotulo}
                      valor={String(valor)}
                    />
                  ))}
                </GradeDeKpis>
                {casamento.plano?.mudam.length ? (
                  <details className="classificacao-publicar-detalhe">
                    <summary>Quem muda de posição</summary>
                    <ul>
                      {casamento.plano.mudam.slice(0, 200).map((m) => {
                        const novo = nomeDoNovo.get(m.chave);
                        return (
                          <li key={m.candidato_id}>
                            {novo?.nome}: {m.de ?? "—"}º → {m.para ?? "—"}º{" "}
                            {novo?.nota != null ? (
                              <span className="ui-texto-secundario">
                                (nota {formatarNota(novo.nota, 2)})
                              </span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                ) : null}
                <Revisao
                  casamento={casamento}
                  manuais={manuais}
                  aoEscolher={(id, chave) =>
                    setManuais((atual) => ({ ...atual, [id]: chave }))
                  }
                />
                {revisaoMudou ? (
                  <Aviso tom="info" papel="status">
                    A revisão mudou: recalcule o casamento antes de publicar.
                    <button
                      type="button"
                      className="btn secondary small"
                      data-acao="recalcular-casamento"
                      onClick={() => setPedidoDeManuais({ ...manuais })}
                    >
                      Recalcular
                    </button>
                  </Aviso>
                ) : null}
                {casamento.plano?.pendencias.length ? (
                  <Aviso tom="warning" papel="status">
                    {casamento.plano.pendencias.length} pessoa(s) com status ou
                    matrícula saem da lista: o que têm fica na lista anterior
                    (histórico) e no registro desta publicação.
                  </Aviso>
                ) : null}
                {exigeMotivo ? (
                  <div className="form-row full">
                    <label htmlFor="classificacaoPublicarMotivo">
                      Motivo da substituição
                    </label>
                    <textarea
                      id="classificacaoPublicarMotivo"
                      rows={2}
                      maxLength={MOTIVO_MAXIMO}
                      value={motivo}
                      onChange={(evento) => setMotivo(evento.target.value)}
                    />
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="ui-acoes">
              <button
                type="button"
                className="btn secondary"
                onClick={aoFechar}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn"
                data-acao="confirmar-publicacao-aprovados"
                disabled={enviando || bloqueada}
                onClick={publicar}
              >
                {enviando ? "Publicando…" : "Publicar"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
