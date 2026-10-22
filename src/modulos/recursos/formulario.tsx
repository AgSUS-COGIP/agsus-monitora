import type { FormEvent } from "react";
import type {
  EstadoDosRecursos,
  CandidatoDoRecurso,
  EditalDosRecursos,
  DetalheDoRecurso,
} from "./tipos-do-estado.ts";
import type {
  DadosDoRecurso,
  OrigemDoRecurso,
  RascunhoDoRecurso,
} from "../../lib/tipos-dos-recursos.ts";
type RascunhoDoFormulario = Omit<RascunhoDoRecurso, "analise"> & {
  analise:
    | CandidatoDoRecurso
    | {
        id?: string | number | null;
        candidato?: string;
        cargo?: string;
        vaga?: string;
        codigo?: string | number | null;
        nota?: number | string | null;
        resultado?: string;
        responsavel?: string;
      }
    | null;
};
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  compararEditais,
  dadosParaSalvar,
  errosDoRascunho,
  RASCUNHO_VAZIO,
  rascunhoDoRecurso,
  recursoDuplicado,
} from "../../lib/recursos-dos-candidatos.ts";
import {
  Aviso,
  Campo,
  classes,
  Kv,
  Modal,
  TopoDaGaveta,
  usarClassesDaGaveta,
} from "../../ui/index.js";
import { nota } from "./partes.ts";

/*
  Cadastro e edição de recurso, numa gaveta (src/ui/, `usarClassesDaGaveta`),
  com os campos de src/ui/ (Campo: rótulo em cima, controle embaixo).

  Cadastro: edital (só os da área atual) → origem → candidato, buscado nas
  análises curriculares daquele edital (a base de nomes das três origens). Ao
  escolher, cargo, vaga, código, nota atual e resultado da análise aparecem
  sozinhos, e o analista vem preenchido com o responsável pela análise (pode
  trocar). "Não encontrei o candidato" é a exceção: nome digitado, e o recurso
  fica marcado como fora das análises. Outro recurso sem decisão do mesmo
  candidato, edital e origem gera um aviso, e só grava confirmando.

  Edição: o edital e o candidato não mudam (para isso, exclua e cadastre de
  novo); os demais campos, sim. O banco confere a revisão: se outra pessoa
  salvou no meio, pede para recarregar.
*/

const ESPERA_DA_BUSCA_MS = 300;

function ResumoDoCandidato({
  analise,
}: {
  analise: NonNullable<RascunhoDoFormulario["analise"]>;
}) {
  return (
    <div
      className="ui-kv-grade recursos-resumo"
      aria-label="Dados da análise do candidato"
    >
      <Kv rotulo="Cargo">{analise.cargo}</Kv>
      <Kv rotulo="Vaga">{analise.vaga}</Kv>
      <Kv rotulo="Código">{analise.codigo}</Kv>
      <Kv rotulo="Nota atual">{nota(analise.nota)}</Kv>
      <Kv rotulo="Resultado da análise">{analise.resultado}</Kv>
      <Kv rotulo="Responsável pela análise">{analise.responsavel}</Kv>
    </div>
  );
}

/* Busca do candidato com espera: só a resposta do último texto digitado vale. */
function BuscaDoCandidato({
  estado,
  editalId,
  aoEscolher,
  aoNaoEncontrar,
  erro,
}: {
  estado: EstadoDosRecursos;
  editalId: string;
  aoEscolher: (item: CandidatoDoRecurso) => void;
  aoNaoEncontrar: () => void;
  erro?: string;
}) {
  const [texto, setTexto] = useState("");
  const [resultado, setResultado] = useState<{
    itens: CandidatoDoRecurso[];
    buscado: string;
    erro: string;
  }>({
    itens: [],
    buscado: "",
    erro: "",
  });
  const [buscando, setBuscando] = useState(false);
  const ultimo = useRef(0);

  useEffect(() => {
    const busca = texto.trim();
    if (!editalId || busca.length < 2) {
      ultimo.current += 1;
      setBuscando(false);
      setResultado({ itens: [], buscado: "", erro: "" });
      return undefined;
    }
    const meu = ++ultimo.current;
    setBuscando(true);
    const espera = setTimeout(async () => {
      try {
        const itens = await estado.buscarCandidatos(editalId, busca);
        if (meu === ultimo.current)
          setResultado({ itens, buscado: busca, erro: "" });
      } catch (falha) {
        if (meu === ultimo.current)
          setResultado({
            itens: [],
            buscado: busca,
            erro: falha instanceof Error ? falha.message : String(falha),
          });
      } finally {
        if (meu === ultimo.current) setBuscando(false);
      }
    }, ESPERA_DA_BUSCA_MS);
    return () => {
      ultimo.current += 1;
      clearTimeout(espera);
    };
  }, [texto, editalId, estado]);

  return (
    <div className="recursos-busca">
      <Campo
        rotulo="Candidato (nas análises do edital)"
        obrigatorio
        erro={erro}
        largo
      >
        <input
          type="search"
          name="busca_candidato"
          value={texto}
          disabled={!editalId}
          autoComplete="off"
          placeholder={
            editalId
              ? "Digite o nome ou o código do candidato"
              : "Escolha o edital primeiro"
          }
          onChange={(evento) => setTexto(evento.target.value)}
        />
      </Campo>
      {buscando ? <p className="recursos-busca-status">Buscando…</p> : null}
      {resultado.erro ? (
        <Aviso como="p" className="recursos-aviso" tom="danger">
          Não foi possível buscar: {resultado.erro}
        </Aviso>
      ) : null}
      {!buscando &&
      resultado.buscado &&
      !resultado.itens.length &&
      !resultado.erro ? (
        <p className="recursos-busca-status">
          Nenhum candidato com “{resultado.buscado}” nas análises deste edital.
        </p>
      ) : null}
      {resultado.itens.length ? (
        <ul
          className="recursos-busca-lista"
          aria-label="Candidatos encontrados"
        >
          {resultado.itens.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="recursos-busca-item"
                onClick={() => aoEscolher(item)}
              >
                <b>{item.candidato}</b>
                <small>
                  {[
                    item.codigo && `Cód. ${item.codigo}`,
                    item.vaga && `Vaga ${item.vaga}`,
                    item.cargo,
                    `Nota ${nota(item.nota)}`,
                    item.resultado,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {editalId ? (
        <button
          type="button"
          className="recursos-link"
          onClick={aoNaoEncontrar}
        >
          Não encontrei o candidato
        </button>
      ) : null}
    </div>
  );
}

export function FormularioDoRecurso({
  estado,
  recurso,
  detalhe,
  recursos,
  editais,
  origens,
}: {
  estado: EstadoDosRecursos;
  recurso?: DadosDoRecurso | null;
  detalhe?: DetalheDoRecurso | null;
  recursos: readonly DadosDoRecurso[];
  editais: readonly EditalDosRecursos[];
  origens: readonly OrigemDoRecurso[];
}) {
  const { acao } = useSyncExternalStore(estado.assinar, estado.obter);
  const gaveta = usarClassesDaGaveta();
  const edicao = Boolean(recurso);
  const [rascunho, setRascunho] = useState<RascunhoDoFormulario>(() =>
    recurso ? rascunhoDoRecurso(recurso, detalhe || {}) : RASCUNHO_VAZIO,
  );
  const [tentou, setTentou] = useState(false);
  const [confirmaDuplicado, setConfirmaDuplicado] = useState(false);
  const [duplicadoDoBanco, setDuplicadoDoBanco] = useState<
    string | number | null
  >(null);
  const analistaAutomatico = useRef("");

  /*
    A observação e os dados digitados chegam com o detalhe, uma vez só (uma
    releitura não desfaz o que a pessoa mudou). Sem ele, a edição não salva:
    mandaria esses campos vazios e o banco apagaria o que estava gravado.
  */
  const detalheChegou = Boolean(detalhe && !detalhe.erro);
  const semDetalhe = edicao && !detalheChegou;
  const preenchido = useRef(edicao && detalheChegou);
  useEffect(() => {
    if (!edicao || !detalheChegou || !detalhe || preenchido.current) return;
    preenchido.current = true;
    setRascunho((atual) => ({
      ...atual,
      observacao: atual.observacao || detalhe.observacao || "",
      nome_informado: detalhe.nome_informado ?? atual.nome_informado,
      codigo_informado: detalhe.codigo_informado ?? atual.codigo_informado,
      cargo_informado: detalhe.cargo_informado ?? atual.cargo_informado,
      vaga_informada: detalhe.vaga_informada ?? atual.vaga_informada,
    }));
  }, [edicao, detalheChegou, detalhe]);

  const editaisOrdenados = useMemo(
    () => [...editais].sort((a, b) => compararEditais(a.edital, b.edital)),
    [editais],
  );
  const origensAtivas = origens.filter(
    (o) => o.ativo || o.id === rascunho.origem,
  );
  const analistas = useMemo(
    () =>
      [
        ...new Set(
          recursos
            .map((r) => r.analista)
            .filter((nome): nome is string => Boolean(nome)),
        ),
      ].sort(),
    [recursos],
  );
  const erros = errosDoRascunho(rascunho, { edicao });
  const duplicado = edicao
    ? null
    : recursoDuplicado(recursos, {
        editalId: rascunho.edital_id,
        origem: rascunho.origem,
        analiseId: rascunho.fora_analise ? null : rascunho.analise?.id,
        nomeInformado: rascunho.fora_analise ? rascunho.nome_informado : "",
      });
  const numeroDuplicado = duplicado?.nu ?? duplicadoDoBanco;
  const salvando = acao?.tipo === "salvar";

  const mudar = <K extends keyof RascunhoDoFormulario>(
    campo: K,
    valor: RascunhoDoFormulario[K],
  ) => {
    setRascunho((atual) => ({ ...atual, [campo]: valor }));
    if (
      [
        "edital_id",
        "origem",
        "analise",
        "nome_informado",
        "fora_analise",
      ].includes(campo)
    ) {
      setConfirmaDuplicado(false);
      setDuplicadoDoBanco(null);
    }
  };

  function escolherCandidato(item: CandidatoDoRecurso) {
    setRascunho((atual) => {
      const analistaFoiAutomatico =
        !atual.analista || atual.analista === analistaAutomatico.current;
      analistaAutomatico.current = item.responsavel || "";
      return {
        ...atual,
        analise: item,
        analista: analistaFoiAutomatico
          ? item.responsavel || ""
          : atual.analista,
      };
    });
    setConfirmaDuplicado(false);
    setDuplicadoDoBanco(null);
  }

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setTentou(true);
    if (semDetalhe || Object.keys(erros).length) return;
    if (numeroDuplicado && !confirmaDuplicado) return;
    const resposta = await estado.salvar(
      dadosParaSalvar(rascunho, {
        id: recurso?.id ?? null,
        revisao: recurso?.revisao ?? null,
        permitirDuplicado: confirmaDuplicado,
      }),
    );
    if (resposta?.duplicado) {
      setDuplicadoDoBanco(
        resposta.duplicado === true ? "?" : resposta.duplicado,
      );
      setConfirmaDuplicado(false);
    }
  }

  const erro = (campo: keyof typeof erros) => (tentou ? erros[campo] : "");

  return (
    <Modal
      id="recursosFormulario"
      rotuloId="recursosFormularioTitulo"
      aoFechar={estado.fecharFormulario}
      fecharAoClicarFora={false}
      className={classes(gaveta.fundo, "recursos-formulario-gaveta")}
      cartaoClassName={classes(gaveta.cartao, "recursos-formulario-cartao")}
    >
      <form onSubmit={enviar} noValidate>
        <TopoDaGaveta
          sobretitulo={edicao ? "Edição do recurso" : "Cadastro de recurso"}
          titulo={recurso ? `Editar recurso nº ${recurso.nu}` : "Novo recurso"}
          tituloId="recursosFormularioTitulo"
          resumo={null}
          rotuloDoFechar="Fechar formulário"
          aoFechar={estado.fecharFormulario}
        />
        {recurso ? (
          <div className="ui-gaveta-contexto">
            <div>
              <small>Candidato</small>
              <strong>{recurso.candidato}</strong>
            </div>
            <div>
              <small>Edital</small>
              <strong>{recurso.edital}</strong>
            </div>
            <div>
              <small>Unidade</small>
              <strong>{recurso.unidade || "—"}</strong>
            </div>
            <div>
              <small>{recurso.fora_analise ? "Candidato" : "Vaga"}</small>
              <strong>
                {recurso.fora_analise
                  ? "Fora das análises"
                  : [
                      recurso.codigo && `Cód. ${recurso.codigo}`,
                      recurso.vaga && `Vaga ${recurso.vaga}`,
                      recurso.cargo,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
              </strong>
            </div>
          </div>
        ) : null}
        <div className="ui-gaveta-corpo">
          <div className="recursos-corpo recursos-formulario">
            {semDetalhe && detalhe?.erro ? (
              <Aviso como="p" className="recursos-aviso" tom="danger">
                Não foi possível carregar a observação e os dados deste recurso;
                sem eles, a edição não salva. <small>{detalhe.erro}</small>{" "}
                <button
                  type="button"
                  className="recursos-link"
                  onClick={() =>
                    recurso && void estado.carregarDetalhe(recurso.id)
                  }
                >
                  Tentar novamente
                </button>
              </Aviso>
            ) : semDetalhe ? (
              <p className="recursos-busca-status" data-sem-detalhe="">
                Carregando a observação e os dados deste recurso…
              </p>
            ) : null}
            {edicao ? null : (
              <div className="recursos-formulario-grade">
                <Campo rotulo="Edital" obrigatorio erro={erro("edital_id")}>
                  <select
                    name="edital_id"
                    value={rascunho.edital_id}
                    data-foco-inicial
                    onChange={(evento) => {
                      mudar("edital_id", evento.target.value);
                      mudar("analise", null);
                    }}
                  >
                    <option value="">Escolha o edital</option>
                    {editaisOrdenados.map((ed) => (
                      <option key={ed.id} value={ed.id}>
                        {ed.edital} · {ed.unidade}
                        {ed.tem_analises ? "" : " (sem análises)"}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo
                  rotulo="Origem do recurso"
                  obrigatorio
                  erro={erro("origem")}
                >
                  <select
                    name="origem"
                    value={rascunho.origem}
                    onChange={(evento) => mudar("origem", evento.target.value)}
                  >
                    <option value="">Escolha a origem</option>
                    {origensAtivas.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </Campo>
              </div>
            )}

            {!edicao && !rascunho.fora_analise ? (
              rascunho.analise ? (
                <div className="recursos-escolhido">
                  <div className="recursos-escolhido-topo">
                    <b>{rascunho.analise.candidato}</b>
                    <button
                      type="button"
                      className="recursos-link"
                      onClick={() => mudar("analise", null)}
                    >
                      Trocar candidato
                    </button>
                  </div>
                  <ResumoDoCandidato analise={rascunho.analise} />
                </div>
              ) : (
                <BuscaDoCandidato
                  estado={estado}
                  editalId={rascunho.edital_id}
                  erro={erro("candidato")}
                  aoEscolher={escolherCandidato}
                  aoNaoEncontrar={() => {
                    mudar("fora_analise", true);
                    mudar("analise", null);
                  }}
                />
              )
            ) : null}

            {rascunho.fora_analise ? (
              <div className="recursos-fora">
                {!edicao ? (
                  <Aviso como="p" className="recursos-aviso" tom="warning">
                    <i
                      className="fa-solid fa-triangle-exclamation"
                      aria-hidden="true"
                    />{" "}
                    <b>Fora das análises</b> (dados digitados).{" "}
                    <button
                      type="button"
                      className="recursos-link"
                      onClick={() => mudar("fora_analise", false)}
                    >
                      Voltar à busca
                    </button>
                  </Aviso>
                ) : null}
                <div className="recursos-formulario-grade">
                  <Campo
                    rotulo="Nome do candidato"
                    obrigatorio
                    erro={erro("nome_informado")}
                    largo
                  >
                    <input
                      name="nome_informado"
                      value={rascunho.nome_informado}
                      maxLength={200}
                      onChange={(evento) =>
                        mudar("nome_informado", evento.target.value)
                      }
                    />
                  </Campo>
                  <Campo rotulo="Código do candidato">
                    <input
                      name="codigo_informado"
                      value={rascunho.codigo_informado}
                      maxLength={60}
                      onChange={(evento) =>
                        mudar("codigo_informado", evento.target.value)
                      }
                    />
                  </Campo>
                  <Campo rotulo="Vaga">
                    <input
                      name="vaga_informada"
                      value={rascunho.vaga_informada}
                      maxLength={60}
                      onChange={(evento) =>
                        mudar("vaga_informada", evento.target.value)
                      }
                    />
                  </Campo>
                  <Campo rotulo="Cargo" largo>
                    <input
                      name="cargo_informado"
                      value={rascunho.cargo_informado}
                      maxLength={200}
                      onChange={(evento) =>
                        mudar("cargo_informado", evento.target.value)
                      }
                    />
                  </Campo>
                </div>
              </div>
            ) : null}

            {numeroDuplicado ? (
              <Aviso className="recursos-aviso" tom="warning" papel="alert">
                <p>
                  <i
                    className="fa-solid fa-triangle-exclamation"
                    aria-hidden="true"
                  />{" "}
                  Já existe o recurso nº {numeroDuplicado} sem decisão para este
                  candidato, edital e origem.
                </p>
                <label className="recursos-check">
                  <input
                    type="checkbox"
                    name="confirma_duplicado"
                    checked={confirmaDuplicado}
                    onChange={(evento) =>
                      setConfirmaDuplicado(evento.target.checked)
                    }
                  />
                  <span>Cadastrar mesmo assim</span>
                </label>
              </Aviso>
            ) : null}

            <div className="recursos-formulario-grade">
              {edicao ? (
                <Campo
                  rotulo="Origem do recurso"
                  obrigatorio
                  erro={erro("origem")}
                >
                  <select
                    name="origem"
                    value={rascunho.origem}
                    onChange={(evento) => mudar("origem", evento.target.value)}
                  >
                    {origensAtivas.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.rotulo}
                      </option>
                    ))}
                  </select>
                </Campo>
              ) : null}
              <Campo rotulo="Analista responsável">
                <input
                  name="analista"
                  value={rascunho.analista}
                  maxLength={200}
                  list="recursosAnalistas"
                  onChange={(evento) => mudar("analista", evento.target.value)}
                />
                <datalist id="recursosAnalistas">
                  {analistas.map((nome) => (
                    <option key={nome} value={nome} />
                  ))}
                </datalist>
              </Campo>
              <Campo rotulo="Nº do processo SEI">
                <input
                  name="processo_sei"
                  value={rascunho.processo_sei}
                  maxLength={60}
                  placeholder="Ex.: 25000.000000/2026-00"
                  onChange={(evento) =>
                    mudar("processo_sei", evento.target.value)
                  }
                />
              </Campo>
              <Campo rotulo="Observação" erro={erro("observacao")} largo>
                <textarea
                  name="observacao"
                  rows={3}
                  maxLength={2000}
                  value={rascunho.observacao}
                  onChange={(evento) =>
                    mudar("observacao", evento.target.value)
                  }
                />
              </Campo>
            </div>
          </div>
        </div>
        <div className="ui-gaveta-rodape">
          <button
            type="button"
            className="btn secondary"
            onClick={estado.fecharFormulario}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="btn"
            disabled={
              Boolean(acao) ||
              semDetalhe ||
              (Boolean(numeroDuplicado) && !confirmaDuplicado)
            }
            aria-busy={salvando || undefined}
          >
            {salvando ? (
              <>
                <span className="recursos-girando" aria-hidden="true" />{" "}
                {acao?.rotulo}
              </>
            ) : edicao ? (
              "Salvar alterações"
            ) : (
              "Cadastrar recurso"
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
}
