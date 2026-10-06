import {
  useEffect,
  useId,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  conflitosDaAgenda,
  convocadosDaLista,
  dataBR,
  dataComDia,
  diasDaRegra,
  gerarAgenda,
  horariosLivres,
  itensDoBanco,
  itensParaSalvar,
  juntarComConvocados,
  lerDias,
  LIMITES_DA_AGENDA,
  moverNaAgenda,
  nomeDaBanca,
  normalizarRegraDaAgenda,
  ORDENS_DA_AGENDA,
  ordenarAgenda,
  temAjusteManual,
  textoDaDuracao,
  textoDosDias,
  trocarNaAgenda,
  validarRegraDaAgenda,
} from "../../lib/agenda-das-entrevistas.js";
import {
  Aviso,
  Campo,
  ErroAoCarregar,
  EstadoVazio,
  GradeDeKpis,
  Kpi,
  Modal,
  Segmentado,
  Selo,
} from "../../ui/index.js";

/*
  A visão "Agenda" da Classificação: a regra da agenda das entrevistas do
  edital (versionada) e a agenda dos convocados da lista "Convocação para
  entrevista" — a última registrada ou, sem lista gerada, o cálculo atual.

  "Gerar" distribui pelo motor (src/lib/agenda-das-entrevistas.js) num
  rascunho; "Mudar" troca o horário/banca de alguém (horário livre ou troca
  com outro convocado); conflitos (mesma banca e horário, repetido) aparecem
  e impedem salvar; "Salvar agenda" grava (com histórico). Gerar de novo
  sobre ajustes manuais pede confirmação. Quem só lê vê a regra e a agenda,
  sem os controles.
*/

function dataHora(valor) {
  const d = new Date(valor);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "short",
      });
}

const ROTULO_DA_ORDEM = Object.fromEntries(ORDENS_DA_AGENDA);
const ROTULO_DA_ACAO = {
  GERAR: "Gerada",
  AJUSTAR: "Ajustada",
  LIMPAR: "Limpa",
};

/* ── Regra ──────────────────────────────────────────────────────────── */

function rascunhoDaRegra(configuracao, bancasDoCadastro) {
  if (configuracao) return normalizarRegraDaAgenda(configuracao);
  const r = normalizarRegraDaAgenda(null);
  const numeros = bancasDoCadastro.map((b) => Number(b.banca) || 1);
  return numeros.length ? { ...r, bancas: Math.max(...numeros) } : r;
}

function ResumoDaRegra({ r }) {
  const dias = diasDaRegra(r);
  return (
    <ul className="agenda-resumo">
      <li>
        Dias: {dias.length}
        {dias.length ? ` (${dataBR(dias[0])} a ${dataBR(dias.at(-1))})` : ""}
      </li>
      <li>
        Períodos: {r.periodos.map((p) => `${p.inicio}–${p.fim}`).join(", ")}{" "}
        (Brasília)
      </li>
      <li>
        Entrevista de {textoDaDuracao(r.duracao_min)}
        {r.intervalo_min
          ? `, intervalo de ${textoDaDuracao(r.intervalo_min)}`
          : ""}
        {r.pausa ? `, pausa ${r.pausa.inicio}–${r.pausa.fim}` : ""}
      </li>
      <li>
        {r.bancas} {r.bancas === 1 ? "banca" : "bancas simultâneas"} · ordem:{" "}
        {ROTULO_DA_ORDEM[r.ordem]}
        {r.agrupar_por_cargo ? " · agrupada por cargo" : ""}
        {r.reservar_primeiro_horario
          ? " · primeiro horário de cada período reservado"
          : ""}
      </li>
    </ul>
  );
}

function FormularioDaRegra({ agenda, a, podeEditar }) {
  const regraSalva = a.dados?.regra || null;
  const bancasDoCadastro = useMemo(() => a.dados?.bancas || [], [a.dados]);
  const [r, setR] = useState(() =>
    rascunhoDaRegra(regraSalva?.configuracao, bancasDoCadastro),
  );
  const [textoDias, setTextoDias] = useState(() => textoDosDias(r.datas.dias));
  const [textoExcluir, setTextoExcluir] = useState(() =>
    textoDosDias(r.datas.excluir),
  );
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const ids = { motivo: useId(), dias: useId(), excluir: useId() };

  const erros = validarRegraDaAgenda(r);
  const lidosDias = lerDias(textoDias);
  const lidosExcluir = lerDias(textoExcluir);
  const precisaMotivo = Boolean(regraSalva);
  const invalidos = [...lidosDias.invalidos, ...lidosExcluir.invalidos];
  const podeSalvar =
    !erros.length &&
    !invalidos.length &&
    (!precisaMotivo || motivo.trim().length >= 3) &&
    !a.salvando;

  const mudar = (campos) => setR((x) => ({ ...x, ...campos }));
  const mudarDatas = (campos) =>
    setR((x) => ({ ...x, datas: { ...x.datas, ...campos } }));
  const mudarPeriodo = (i, campo, valor) =>
    setR((x) => ({
      ...x,
      periodos: x.periodos.map((p, k) =>
        k === i ? { ...p, [campo]: valor } : p,
      ),
    }));
  const numero = (valor) => (valor === "" ? "" : Number(valor));

  async function salvar(evento) {
    evento.preventDefault();
    setTentou(true);
    if (!podeSalvar) return;
    await agenda.salvarRegra(r, motivo.trim());
  }

  return (
    <section
      className="ui-card agenda-regra"
      aria-labelledby="agendaRegraTitulo"
      data-tour="classificacao-agenda-regra"
    >
      <h3 className="ui-titulo" id="agendaRegraTitulo">
        Regra da agenda
      </h3>
      {regraSalva ? (
        <p className="status-discreto">
          Versão {regraSalva.versao} · {dataHora(regraSalva.atualizado_em)}
          {regraSalva.por ? ` por ${regraSalva.por}` : ""}
        </p>
      ) : null}
      {!podeEditar ? (
        regraSalva ? (
          <ResumoDaRegra r={r} />
        ) : (
          <EstadoVazio>Este edital ainda não tem regra da agenda.</EstadoVazio>
        )
      ) : (
        <form onSubmit={salvar} noValidate>
          <Segmentado
            rotulo="Dias"
            opcoes={[
              { valor: "INTERVALO", rotulo: "Intervalo" },
              { valor: "LISTA", rotulo: "Lista de dias" },
            ]}
            valor={r.datas.modo}
            aoMudar={(modo) => mudarDatas({ modo })}
          />
          <div className="ui-grade-de-campos">
            {r.datas.modo === "INTERVALO" ? (
              <>
                <Campo rotulo="Primeiro dia" obrigatorio>
                  <input
                    type="date"
                    data-campo="inicio"
                    value={r.datas.inicio}
                    onChange={(ev) => mudarDatas({ inicio: ev.target.value })}
                  />
                </Campo>
                <Campo rotulo="Último dia" obrigatorio>
                  <input
                    type="date"
                    data-campo="fim"
                    value={r.datas.fim}
                    onChange={(ev) => mudarDatas({ fim: ev.target.value })}
                  />
                </Campo>
                <label className="agenda-caixa">
                  <input
                    type="checkbox"
                    data-campo="so_dias_uteis"
                    checked={r.datas.so_dias_uteis}
                    onChange={(ev) =>
                      mudarDatas({ so_dias_uteis: ev.target.checked })
                    }
                  />{" "}
                  Só dias úteis
                </label>
              </>
            ) : (
              <Campo
                rotulo="Dias (dd/mm/aaaa)"
                obrigatorio
                largo
                idDoControle={ids.dias}
                erro={
                  lidosDias.invalidos.length
                    ? `Dia inválido: ${lidosDias.invalidos.join(", ")}`
                    : ""
                }
              >
                <input
                  id={ids.dias}
                  data-campo="dias"
                  value={textoDias}
                  placeholder="06/10/2026, 07/10/2026"
                  onChange={(ev) => {
                    setTextoDias(ev.target.value);
                    mudarDatas({ dias: lerDias(ev.target.value).dias });
                  }}
                />
              </Campo>
            )}
            <Campo
              rotulo="Dias sem entrevista (feriados)"
              largo
              idDoControle={ids.excluir}
              erro={
                lidosExcluir.invalidos.length
                  ? `Dia inválido: ${lidosExcluir.invalidos.join(", ")}`
                  : ""
              }
            >
              <input
                id={ids.excluir}
                data-campo="excluir"
                value={textoExcluir}
                placeholder="12/10/2026"
                onChange={(ev) => {
                  setTextoExcluir(ev.target.value);
                  mudarDatas({ excluir: lerDias(ev.target.value).dias });
                }}
              />
            </Campo>
          </div>

          <h4 className="agenda-subtitulo">Períodos (horário de Brasília)</h4>
          <div className="agenda-periodos">
            {r.periodos.map((p, i) => (
              <div className="agenda-periodo" key={i} data-periodo={i}>
                <Campo rotulo={`Início do ${i + 1}º período`}>
                  <input
                    type="time"
                    value={p.inicio}
                    onChange={(ev) =>
                      mudarPeriodo(i, "inicio", ev.target.value)
                    }
                  />
                </Campo>
                <Campo rotulo="Fim">
                  <input
                    type="time"
                    value={p.fim}
                    onChange={(ev) => mudarPeriodo(i, "fim", ev.target.value)}
                  />
                </Campo>
                {r.periodos.length > 1 ? (
                  <button
                    type="button"
                    className="btn ghost small"
                    aria-label={`Tirar o ${i + 1}º período`}
                    onClick={() =>
                      mudar({ periodos: r.periodos.filter((_, k) => k !== i) })
                    }
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ))}
            {r.periodos.length < LIMITES_DA_AGENDA.periodos ? (
              <button
                type="button"
                className="btn secondary small"
                onClick={() =>
                  mudar({
                    periodos: [...r.periodos, { inicio: "", fim: "" }],
                  })
                }
              >
                <i className="fa-solid fa-plus" aria-hidden="true" /> Período
              </button>
            ) : null}
          </div>

          <div className="ui-grade-de-campos">
            <Campo rotulo="Duração de cada entrevista (min)" obrigatorio>
              <input
                type="number"
                data-campo="duracao"
                min={LIMITES_DA_AGENDA.duracao[0]}
                max={LIMITES_DA_AGENDA.duracao[1]}
                value={r.duracao_min}
                onChange={(ev) =>
                  mudar({ duracao_min: numero(ev.target.value) })
                }
              />
            </Campo>
            <Campo rotulo="Intervalo entre entrevistas (min)">
              <input
                type="number"
                data-campo="intervalo"
                min={0}
                max={LIMITES_DA_AGENDA.intervalo[1]}
                value={r.intervalo_min}
                onChange={(ev) =>
                  mudar({ intervalo_min: numero(ev.target.value) })
                }
              />
            </Campo>
            <Campo rotulo="Pausa: início">
              <input
                type="time"
                data-campo="pausa-inicio"
                value={r.pausa?.inicio || ""}
                onChange={(ev) =>
                  mudar({
                    pausa:
                      ev.target.value || r.pausa?.fim
                        ? { inicio: ev.target.value, fim: r.pausa?.fim || "" }
                        : null,
                  })
                }
              />
            </Campo>
            <Campo rotulo="Pausa: fim">
              <input
                type="time"
                data-campo="pausa-fim"
                value={r.pausa?.fim || ""}
                onChange={(ev) =>
                  mudar({
                    pausa:
                      ev.target.value || r.pausa?.inicio
                        ? {
                            inicio: r.pausa?.inicio || "",
                            fim: ev.target.value,
                          }
                        : null,
                  })
                }
              />
            </Campo>
            <Campo rotulo="Bancas simultâneas" obrigatorio>
              <input
                type="number"
                data-campo="bancas"
                min={1}
                max={LIMITES_DA_AGENDA.bancas[1]}
                value={r.bancas}
                onChange={(ev) => mudar({ bancas: numero(ev.target.value) })}
              />
            </Campo>
            <Campo rotulo="Ordem dos candidatos">
              <select
                data-campo="ordem"
                value={r.ordem}
                onChange={(ev) => mudar({ ordem: ev.target.value })}
              >
                {ORDENS_DA_AGENDA.map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </Campo>
          </div>
          {Number(r.bancas) > 1 ||
          bancasDoCadastro.length ||
          r.nomes_das_bancas.some(Boolean) ? (
            <div className="ui-grade-de-campos agenda-bancas">
              {Array.from(
                {
                  length: Math.min(
                    Math.max(Number(r.bancas) || 1, 1),
                    LIMITES_DA_AGENDA.bancas[1],
                  ),
                },
                (_, i) => {
                  const membros =
                    bancasDoCadastro.find((b) => Number(b.banca) === i + 1)
                      ?.membros || [];
                  return (
                    <Campo
                      key={i}
                      rotulo={`Nome da banca ${i + 1}`}
                      dica={membros.map((m) => m.nome).join(", ")}
                    >
                      <input
                        data-campo={`banca-${i + 1}`}
                        value={r.nomes_das_bancas[i] || ""}
                        placeholder={`Banca ${i + 1}`}
                        maxLength={LIMITES_DA_AGENDA.nomeDaBanca}
                        onChange={(ev) => {
                          const nomes = [...r.nomes_das_bancas];
                          nomes[i] = ev.target.value;
                          mudar({ nomes_das_bancas: nomes });
                        }}
                      />
                    </Campo>
                  );
                },
              )}
            </div>
          ) : null}
          <div className="agenda-caixas">
            <label className="agenda-caixa">
              <input
                type="checkbox"
                data-campo="agrupar"
                checked={r.agrupar_por_cargo}
                onChange={(ev) =>
                  mudar({ agrupar_por_cargo: ev.target.checked })
                }
              />{" "}
              Agrupar por cargo
            </label>
            <label className="agenda-caixa">
              <input
                type="checkbox"
                data-campo="reservar"
                checked={r.reservar_primeiro_horario}
                onChange={(ev) =>
                  mudar({ reservar_primeiro_horario: ev.target.checked })
                }
              />{" "}
              Reservar o primeiro horário de cada período
            </label>
          </div>
          {precisaMotivo ? (
            <Campo
              rotulo="Motivo da alteração"
              obrigatorio
              largo
              idDoControle={ids.motivo}
            >
              <input
                id={ids.motivo}
                data-campo="motivo"
                value={motivo}
                maxLength={500}
                onChange={(ev) => setMotivo(ev.target.value)}
              />
            </Campo>
          ) : null}
          {tentou && (erros.length || invalidos.length) ? (
            <Aviso tom="danger" papel="alert" className="agenda-erros">
              <ul>
                {erros.map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          <div className="ui-acoes">
            <button
              type="submit"
              className="btn"
              data-acao="salvar-regra-agenda"
              data-tour="classificacao-agenda-salvar-regra"
              disabled={a.salvando}
            >
              Salvar regra
            </button>
          </div>
        </form>
      )}
      {regraSalva?.versoes?.length > 1 ? (
        <details
          className="agenda-versoes"
          data-tour="classificacao-agenda-versoes"
        >
          <summary>Versões ({regraSalva.versoes.length})</summary>
          <ul>
            {regraSalva.versoes.map((v) => (
              <li key={v.versao}>
                v{v.versao} · {dataHora(v.em)}
                {v.por ? ` · ${v.por}` : ""}
                {v.motivo ? ` · ${v.motivo}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

/* ── Ajuste manual ──────────────────────────────────────────────────── */

const chaveDoHorario = (h) => `${h.data}|${h.inicio}|${h.fim}|${h.banca}`;
const textoDoHorario = (h, regra) =>
  `${dataComDia(h.data)} · ${h.inicio}–${h.fim} · ${nomeDaBanca(regra, h.banca)}`;

function ModalDeAjuste({ item, itens, regra, aoAplicar, aoFechar }) {
  const [modo, setModo] = useState("HORARIO");
  const [horario, setHorario] = useState("");
  const [outro, setOutro] = useState("");
  const livres = useMemo(() => horariosLivres(itens, regra), [itens, regra]);
  const outros = useMemo(
    () =>
      ordenarAgenda(itens).filter(
        (i) => i.analiseId !== item.analiseId && i.data,
      ),
    [itens, item.analiseId],
  );
  const pode = modo === "HORARIO" ? Boolean(horario) : Boolean(outro);

  function aplicar(evento) {
    evento.preventDefault();
    if (!pode) return;
    if (modo === "TROCA") {
      aoAplicar(trocarNaAgenda(itens, item.analiseId, outro));
      return;
    }
    const escolhido =
      horario === "SEM"
        ? null
        : livres.find((h) => chaveDoHorario(h) === horario) || null;
    aoAplicar(moverNaAgenda(itens, item.analiseId, escolhido));
  }

  return (
    <Modal
      id="agendaAjuste"
      rotuloId="agendaAjusteTitulo"
      aoFechar={aoFechar}
      cartaoClassName="agenda-ajuste"
    >
      <form onSubmit={aplicar}>
        <h2 id="agendaAjusteTitulo">{item.nome}</h2>
        <p className="ui-texto-secundario">
          {item.data ? textoDoHorario(item, regra) : "Sem horário"}
        </p>
        <Segmentado
          rotulo="Ajuste"
          opcoes={[
            { valor: "HORARIO", rotulo: "Mudar o horário" },
            { valor: "TROCA", rotulo: "Trocar com outro" },
          ]}
          valor={modo}
          aoMudar={setModo}
        />
        {modo === "HORARIO" ? (
          <Campo rotulo="Horário livre" largo>
            <select
              data-campo="horario-livre"
              value={horario}
              onChange={(ev) => setHorario(ev.target.value)}
            >
              <option value="">Escolha o horário</option>
              {item.data ? <option value="SEM">Sem horário</option> : null}
              {livres.map((h) => (
                <option key={chaveDoHorario(h)} value={chaveDoHorario(h)}>
                  {textoDoHorario(h, regra)}
                  {h.reservado ? " · reservado" : ""}
                </option>
              ))}
            </select>
          </Campo>
        ) : (
          <Campo rotulo="Trocar de lugar com" largo>
            <select
              data-campo="trocar-com"
              value={outro}
              onChange={(ev) => setOutro(ev.target.value)}
            >
              <option value="">Escolha o convocado</option>
              {outros.map((o) => (
                <option key={o.analiseId} value={o.analiseId}>
                  {o.nome} · {dataBR(o.data)} {o.inicio} ·{" "}
                  {nomeDaBanca(regra, o.banca)}
                </option>
              ))}
            </select>
          </Campo>
        )}
        <div className="ui-acoes">
          <button type="button" className="btn secondary" onClick={aoFechar}>
            Cancelar
          </button>
          <button
            type="submit"
            className="btn"
            data-acao="aplicar-ajuste"
            disabled={!pode}
          >
            Aplicar
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ConfirmarGerar({ quantos, aoConfirmar, aoFechar }) {
  return (
    <Modal
      id="agendaConfirmar"
      rotuloId="agendaConfirmarTitulo"
      aoFechar={aoFechar}
      cartaoClassName="agenda-confirmar"
    >
      <h2 id="agendaConfirmarTitulo">Gerar a agenda de novo?</h2>
      <p>
        {quantos}{" "}
        {quantos === 1 ? "ajuste manual será" : "ajustes manuais serão"}{" "}
        substituídos pela distribuição da regra.
      </p>
      <div className="ui-acoes">
        <button type="button" className="btn secondary" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          data-acao="confirmar-gerar"
          onClick={aoConfirmar}
        >
          Gerar de novo
        </button>
      </div>
    </Modal>
  );
}

/* ── A agenda dos convocados ────────────────────────────────────────── */

const semHorario = (c) => ({
  ...c,
  data: null,
  inicio: null,
  fim: null,
  banca: null,
  origem: "GERADA",
});

function AgendaDosConvocados({ estado, agenda, a, e, calcular, podeEditar }) {
  const dados = e.dados;
  const listaRegistrada =
    (dados?.listas || []).find((l) => l.tipo === "CONVOCACAO") || null;
  const idDaLista = listaRegistrada?.id || "";
  const [fonte, setFonte] = useState(null);
  const [rascunho, setRascunho] = useState(null);
  const [confirmar, setConfirmar] = useState(false);
  const [ajuste, setAjuste] = useState("");
  const regra = a.dados?.regra?.configuracao || null;

  /* Os convocados: a última convocação registrada ou o cálculo atual. */
  useEffect(() => {
    let vivo = true;
    async function carregarFonte() {
      if (idDaLista) {
        const registrada = await estado.obterLista(idDaLista);
        if (!vivo) return;
        if (registrada?.retrato) {
          setFonte({
            lista: idDaLista,
            convocados: convocadosDaLista(registrada.retrato),
          });
          return;
        }
      }
      const calculada = dados?.regra ? calcular(dados, "CONVOCACAO") : null;
      if (vivo)
        setFonte({ lista: null, convocados: convocadosDaLista(calculada) });
    }
    void carregarFonte();
    return () => {
      vivo = false;
    };
  }, [estado, idDaLista, dados, calcular]);

  const salvos = useMemo(() => itensDoBanco(a.dados?.itens), [a.dados]);
  const base = useMemo(
    () => (fonte ? juntarComConvocados(salvos, fonte.convocados) : salvos),
    [salvos, fonte],
  );
  const itens = rascunho?.itens ?? base;
  const ordenados = useMemo(() => ordenarAgenda(itens), [itens]);
  const conflitos = useMemo(
    () => conflitosDaAgenda(itens, regra),
    [itens, regra],
  );
  const emConflito = useMemo(
    () => new Set(conflitos.flatMap((c) => c.ids)),
    [conflitos],
  );
  const semHorarioQt = itens.filter((i) => !i.data).length;
  const foraDaLista = itens.filter((i) => i.foraDaLista).length;
  const dias = new Set(itens.filter((i) => i.data).map((i) => i.data));
  const aberto = ajuste ? itens.find((i) => i.analiseId === ajuste) : null;

  function gerar() {
    setConfirmar(false);
    const resultado = gerarAgenda(fonte?.convocados || [], regra);
    setRascunho({
      acao: "GERAR",
      avisos: resultado.avisos,
      itens: [...resultado.itens, ...resultado.semHorario.map(semHorario)],
    });
  }
  function pedirGerar() {
    if (temAjusteManual(itens)) setConfirmar(true);
    else gerar();
  }
  function aplicarAjuste(novos) {
    setAjuste("");
    setRascunho((r) => ({
      acao: r?.acao === "GERAR" ? "GERAR" : "AJUSTAR",
      avisos: r?.avisos || [],
      itens: novos,
    }));
  }
  async function salvar() {
    if (!rascunho || conflitos.length) return;
    const ok = await agenda.salvarAgenda({
      acao: rascunho.acao,
      itens: itensParaSalvar(rascunho.itens),
      lista: fonte?.lista ?? null,
    });
    if (ok) setRascunho(null);
  }

  let porDia = [];
  for (const i of ordenados) {
    const chave = i.data || "";
    const ultimo = porDia.at(-1);
    if (ultimo && ultimo.chave === chave) ultimo.itens.push(i);
    else porDia = [...porDia, { chave, itens: [i] }];
  }

  return (
    <section
      className="ui-card agenda-convocados"
      aria-labelledby="agendaConvocadosTitulo"
      data-tour="classificacao-agenda-convocados"
    >
      <h3 className="ui-titulo" id="agendaConvocadosTitulo">
        Agenda dos convocados
      </h3>
      <GradeDeKpis
        tour="classificacao-agenda-kpis"
        rotulo="Indicadores da agenda"
        className="agenda-kpis"
      >
        <Kpi
          chave="agenda-convocados"
          icone="fa-users"
          rotulo="Convocados"
          valor={String(fonte?.convocados.length ?? "—")}
          carregando={!fonte}
        />
        <Kpi
          chave="agenda-com-horario"
          tom="sucesso"
          icone="fa-calendar-check"
          rotulo="Com horário"
          valor={String(itens.length - semHorarioQt)}
          carregando={!fonte}
        />
        <Kpi
          chave="agenda-sem-horario"
          tom={semHorarioQt ? "perigo" : "neutro"}
          icone="fa-calendar-xmark"
          rotulo="Sem horário"
          valor={String(semHorarioQt)}
          carregando={!fonte}
        />
        <Kpi
          chave="agenda-dias"
          tom="neutro"
          icone="fa-calendar-days"
          rotulo="Dias"
          valor={String(dias.size)}
          carregando={!fonte}
        />
      </GradeDeKpis>

      {fonte && !fonte.lista ? (
        <Aviso tom="warning" papel="status" className="agenda-fonte">
          Sem lista de convocação gerada: a agenda usa o cálculo atual. Gere a
          lista em Listas › Convocação para entrevista.
        </Aviso>
      ) : null}
      {(rascunho?.avisos || []).map((aviso) => (
        <Aviso
          key={aviso.codigo}
          tom={aviso.tom}
          papel="status"
          className="agenda-aviso"
        >
          <span data-aviso={aviso.codigo}>{aviso.texto}</span>
        </Aviso>
      ))}
      {!rascunho && salvos.length && semHorarioQt ? (
        <Aviso tom="warning" papel="status" className="agenda-aviso">
          <span data-aviso="SEM_HORARIO">
            {semHorarioQt}{" "}
            {semHorarioQt === 1
              ? "convocado sem horário"
              : "convocados sem horário"}{" "}
            na agenda salva.
          </span>
        </Aviso>
      ) : null}
      {foraDaLista ? (
        <Aviso tom="warning" papel="status" className="agenda-aviso">
          <span data-aviso="FORA_DA_LISTA">
            {foraDaLista} na agenda fora da lista de convocação atual.
          </span>
        </Aviso>
      ) : null}
      {conflitos.length ? (
        <Aviso tom="danger" papel="alert" className="agenda-conflitos">
          <strong>Conflitos</strong>
          <ul>
            {conflitos.map((c) => (
              <li key={`${c.tipo}-${c.ids.join("-")}`}>{c.texto}</li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      <div className="classificacao-acoes-linha agenda-acoes">
        {podeEditar ? (
          <>
            <button
              type="button"
              className="btn"
              data-acao="gerar-agenda"
              data-tour="classificacao-agenda-gerar"
              disabled={!regra || !fonte || a.salvando}
              onClick={pedirGerar}
            >
              <i className="fa-solid fa-calendar-check" aria-hidden="true" />{" "}
              {salvos.length || rascunho ? "Gerar de novo" : "Gerar agenda"}
            </button>
            <button
              type="button"
              className="btn"
              data-acao="salvar-agenda"
              data-tour="classificacao-agenda-salvar"
              disabled={!rascunho || conflitos.length > 0 || a.salvando}
              onClick={salvar}
            >
              Salvar agenda
            </button>
            {rascunho ? (
              <button
                type="button"
                className="btn secondary"
                data-acao="descartar-agenda"
                onClick={() => setRascunho(null)}
              >
                Descartar
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="btn secondary"
          data-exportar="xlsx-agenda"
          data-tour="classificacao-agenda-xlsx"
          disabled={!itens.some((i) => i.data)}
          onClick={() => agenda.exportarXlsx(itens)}
        >
          XLSX
        </button>
      </div>
      {podeEditar && !regra ? (
        <p className="status-discreto">Salve a regra da agenda para gerar.</p>
      ) : null}

      {itens.length ? (
        <div className="ui-tabela-rolagem">
          <table
            className="agenda-tabela"
            data-tour="classificacao-agenda-tabela"
          >
            <thead>
              <tr>
                <th scope="col">Hora</th>
                <th scope="col">Banca</th>
                <th scope="col">Nome</th>
                <th scope="col">Vaga</th>
                <th scope="col">Modalidade</th>
                <th scope="col">Situação</th>
                {podeEditar ? (
                  <th scope="col">
                    <span className="sr-only">Ações</span>
                  </th>
                ) : null}
              </tr>
            </thead>
            {porDia.map((dia) => (
              <tbody key={dia.chave || "sem"} data-dia={dia.chave || "sem"}>
                <tr className="agenda-dia">
                  <th colSpan={podeEditar ? 7 : 6} scope="colgroup">
                    {dia.chave ? dataComDia(dia.chave) : "Sem horário"}
                  </th>
                </tr>
                {dia.itens.map((i) => (
                  <tr
                    key={i.analiseId}
                    data-candidato={i.analiseId}
                    className={
                      emConflito.has(i.analiseId) ? "agenda-conflito" : ""
                    }
                  >
                    <td>{i.inicio ? `${i.inicio}–${i.fim}` : "—"}</td>
                    <td>{i.banca ? nomeDaBanca(regra, i.banca) : "—"}</td>
                    <td>{i.nome}</td>
                    <td>
                      <div className="ui-texto-principal">{i.vaga}</div>
                      <span className="ui-texto-secundario">{i.cargo}</span>
                    </td>
                    <td>{(i.modalidades || []).join(" / ") || "—"}</td>
                    <td className="agenda-selos">
                      {emConflito.has(i.analiseId) ? (
                        <Selo tom="reprovado">Conflito</Selo>
                      ) : null}
                      {!i.data ? <Selo tom="pendente">Sem horário</Selo> : null}
                      {i.origem === "MANUAL" && i.data ? (
                        <Selo tom="revisar">Ajuste manual</Selo>
                      ) : null}
                      {i.foraDaLista ? (
                        <Selo tom="neutro">Fora da lista</Selo>
                      ) : null}
                    </td>
                    {podeEditar ? (
                      <td>
                        <button
                          type="button"
                          className="btn secondary small"
                          data-acao="mudar"
                          aria-label={`Mudar o horário de ${i.nome}`}
                          onClick={() => setAjuste(i.analiseId)}
                        >
                          Mudar
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      ) : fonte ? (
        <EstadoVazio>Nenhum convocado na lista de convocação.</EstadoVazio>
      ) : null}

      {a.dados?.historico?.length ? (
        <details
          className="agenda-historico"
          data-tour="classificacao-agenda-historico"
        >
          <summary>Gravações ({a.dados.historico.length})</summary>
          <ul>
            {a.dados.historico.map((h) => (
              <li key={h.id}>
                {ROTULO_DA_ACAO[h.acao] || h.acao} · {dataHora(h.em)}
                {h.por ? ` · ${h.por}` : ""} · {h.itens} com horário ·{" "}
                {h.alteracoes} {h.alteracoes === 1 ? "mudança" : "mudanças"}
                {h.motivo ? ` · ${h.motivo}` : ""}
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {aberto ? (
        <ModalDeAjuste
          item={aberto}
          itens={itens}
          regra={regra}
          aoAplicar={aplicarAjuste}
          aoFechar={() => setAjuste("")}
        />
      ) : null}
      {confirmar ? (
        <ConfirmarGerar
          quantos={itens.filter((i) => i.origem === "MANUAL").length}
          aoConfirmar={gerar}
          aoFechar={() => setConfirmar(false)}
        />
      ) : null}
    </section>
  );
}

export function Agenda({ estado, agenda, e, calcular }) {
  const a = useSyncExternalStore(agenda.assinar, agenda.obter);
  if (a.indisponivel)
    return (
      <Aviso tom="warning" papel="status">
        {a.erro}
      </Aviso>
    );
  const erro = a.erro ? (
    <ErroAoCarregar
      oQue="a agenda das entrevistas"
      mensagem={a.erro}
      aoTentar={() => void agenda.carregar(e.editalId)}
    />
  ) : null;
  if (erro && !a.dados) return erro;
  if (!a.dados || a.editalId !== e.editalId)
    return (
      <div className="ui-card" aria-busy="true">
        <div className="ui-esqueleto-linha" />
        <div className="ui-esqueleto-linha" />
      </div>
    );
  const podeEditar = Boolean(a.dados.pode_editar);
  return (
    <div className="classificacao-agenda">
      {erro}
      <FormularioDaRegra
        key={`${e.editalId}:${a.dados.regra?.versao ?? 0}`}
        agenda={agenda}
        a={a}
        podeEditar={podeEditar}
      />
      <AgendaDosConvocados
        key={e.editalId}
        estado={estado}
        agenda={agenda}
        a={a}
        e={e}
        calcular={calcular}
        podeEditar={podeEditar}
      />
    </div>
  );
}
