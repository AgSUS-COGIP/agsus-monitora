import { useEffect, useMemo, useState } from "react";
import { formatarNota } from "../../lib/classificacao/numeros.js";
import {
  argumentosDaPublicacao,
  candidatosDaListaFinal,
  casarCandidatos,
  origemDaLista,
  resumoDaPublicacao,
  temDadosDaLista,
} from "../../lib/publicacao-de-aprovados.js";
import { Aviso, GradeDeKpis, Kpi, Modal } from "../../ui/index.js";

/*
  "Publicar como lista de aprovados" (Classificação › Listas › Resultado final):
  o resultado final registrado vira a lista de aprovados vigente do edital
  (migration 20261005160000). A confirmação mostra, em relação à lista
  vigente, quantos entram, saem e mudam de posição, o que é preservado
  (status, matrícula, sub judice) e quem saiu com dados e precisa de revisão:
  ali dá para dizer quem é a mesma pessoa na lista nova. A conta é de
  src/lib/publicacao-de-aprovados.js; o banco confere e grava o histórico.
*/

const texto = (valor) => String(valor ?? "").trim();

function rotuloDoNovo(n) {
  return `${n.nome} — ${n.codigo_vaga || n.cargo} · ${n.posicao}º`;
}

function LinhaDeRevisao({ anterior, novos, escolhido, aoEscolher }) {
  const id = `revisao-${anterior.candidato_id}`;
  return (
    <li className="classificacao-revisao-linha">
      <label htmlFor={id}>
        <strong>{anterior.nome}</strong>
        <span className="ui-texto-secundario">
          {[
            anterior.codigo_vaga || anterior.cargo,
            anterior.classificacao ? `${anterior.classificacao}º` : "",
            texto(anterior.status),
            texto(anterior.matricula) ? `matrícula ${anterior.matricula}` : "",
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </label>
      <select
        id={id}
        value={escolhido ?? ""}
        onChange={(evento) => aoEscolher(evento.target.value)}
      >
        <option value="">Não está na lista nova</option>
        {novos.map((n) => (
          <option key={n.analise_id} value={n.analise_id}>
            {rotuloDoNovo(n)}
          </option>
        ))}
      </select>
    </li>
  );
}

export function ModalDePublicacaoDeAprovados({
  estado,
  registro,
  analises,
  aoFechar,
}) {
  const [preparo, setPreparo] = useState(null);
  const [manuais, setManuais] = useState({});
  const [enviando, setEnviando] = useState(false);
  const [publicado, setPublicado] = useState(null);

  useEffect(() => {
    let vivo = true;
    void estado.prepararPublicacaoDeAprovados(registro).then((p) => {
      if (vivo) setPreparo(p || { erro: "Lista não encontrada." });
    });
    return () => {
      vivo = false;
    };
  }, [estado, registro]);

  const vigente = preparo?.situacao?.vigente || null;
  const anteriores = useMemo(() => vigente?.candidatos || [], [vigente]);
  const novos = useMemo(
    () =>
      preparo?.registrado
        ? candidatosDaListaFinal(preparo.registrado.retrato, { analises })
        : [],
    [preparo, analises],
  );
  const casamento = useMemo(
    () => casarCandidatos(anteriores, novos, { manuais }),
    [anteriores, novos, manuais],
  );
  const resumo = useMemo(
    () => resumoDaPublicacao(anteriores, novos, casamento),
    [anteriores, novos, casamento],
  );
  const novosPorNome = useMemo(
    () =>
      [...novos].sort((a, b) =>
        texto(a.nome).localeCompare(texto(b.nome), "pt-BR"),
      ),
    [novos],
  );

  /* Para revisar: quem não casou e tem dados da lista (ou é homônimo), e quem já foi revisto. */
  const paraRevisar = anteriores.filter((a) => {
    const id = texto(a.candidato_id);
    if (Object.prototype.hasOwnProperty.call(manuais, id)) return true;
    const naoCasado = casamento.naoCasados.find(
      (n) => texto(n.candidato_id) === id,
    );
    return (
      naoCasado && !a.sub_judice && (temDadosDaLista(a) || naoCasado.ambiguo)
    );
  });
  const ocupados = new Set(casamento.vinculos.map((v) => v.analise_id));
  const opcoesPara = (anterior) => {
    const meu = casamento.vinculos.find(
      (v) => v.candidato_id === texto(anterior.candidato_id),
    )?.analise_id;
    return novosPorNome.filter(
      (n) => n.analise_id === meu || !ocupados.has(n.analise_id),
    );
  };

  async function publicar() {
    if (enviando || !preparo?.registrado) return;
    setEnviando(true);
    const resultado = await estado.publicarComoListaDeAprovados({
      listaId: preparo.registrado.id,
      listaVigente: vigente?.lista_id || null,
      vinculos: argumentosDaPublicacao(casamento),
    });
    setEnviando(false);
    if (resultado) setPublicado(resultado);
  }

  const origem = origemDaLista(vigente);
  const kpis = [
    ["entram", "sucesso", "fa-user-plus", "Entram", resumo.entram.length],
    ["saem", "perigo", "fa-user-minus", "Saem", resumo.saem.length],
    [
      "mudam",
      "alerta",
      "fa-right-left",
      "Mudam de posição",
      resumo.mudam.length,
    ],
    [
      "preservados",
      "info",
      "fa-user-check",
      "Status e sub judice preservados",
      resumo.preservados.length,
    ],
  ];
  if (resumo.subJudiceMantidos.length)
    kpis.push([
      "sub-judice",
      "destaque",
      "fa-gavel",
      "Sub judice mantidos",
      resumo.subJudiceMantidos.length,
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
          <div aria-busy="true">
            <div className="ui-esqueleto-linha" />
            <div className="ui-esqueleto-linha" />
          </div>
        ) : preparo.erro ? (
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
                ? `Lista vigente: ${origem.texto} · ${anteriores.length} candidato(s)`
                : "O edital ainda não tem lista de aprovados."}{" "}
              · Resultado final: {novos.length} candidato(s)
            </p>
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
            {resumo.mudam.length ? (
              <details className="classificacao-publicar-detalhe">
                <summary>Quem muda de posição</summary>
                <ul>
                  {resumo.mudam.slice(0, 200).map(({ anterior, novo }) => (
                    <li key={anterior.candidato_id}>
                      {novo.nome}: {anterior.classificacao ?? "—"}º →{" "}
                      {novo.posicao}º{" "}
                      <span className="ui-texto-secundario">
                        (nota {formatarNota(novo.nota, 2)})
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {paraRevisar.length ? (
              <section
                className="classificacao-revisao"
                aria-labelledby="classificacaoRevisaoTitulo"
              >
                <h3 id="classificacaoRevisaoTitulo">
                  Revisar: {paraRevisar.length} pessoa(s) da lista vigente sem
                  par na lista nova
                </h3>
                <ul>
                  {paraRevisar.map((anterior) => {
                    const id = texto(anterior.candidato_id);
                    const vinculo = casamento.vinculos.find(
                      (v) => v.candidato_id === id,
                    );
                    return (
                      <LinhaDeRevisao
                        key={id}
                        anterior={anterior}
                        novos={opcoesPara(anterior)}
                        escolhido={vinculo?.analise_id ?? manuais[id] ?? ""}
                        aoEscolher={(valor) =>
                          setManuais((atual) => ({ ...atual, [id]: valor }))
                        }
                      />
                    );
                  })}
                </ul>
              </section>
            ) : null}
            {resumo.pendencias.length ? (
              <Aviso tom="warning" papel="status">
                {resumo.pendencias.length} pessoa(s) com status ou matrícula
                saem da lista: o que têm fica na lista anterior (histórico) e no
                registro desta publicação.
              </Aviso>
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
                disabled={enviando || !novos.length}
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
