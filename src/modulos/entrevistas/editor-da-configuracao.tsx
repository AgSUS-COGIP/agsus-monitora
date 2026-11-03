import { useMemo, useRef, useState } from "react";
import {
  bancasDoEdital,
  dadosDaConfiguracaoParaSalvar,
  errosDaConfiguracao,
  rascunhoDaConfiguracao,
  rotuloDoLancamento,
} from "../../lib/conducao-de-entrevista.ts";
import { rotuloDaVersao } from "../../lib/nome-da-versao.ts";
import { pendenciasDaConfiguracao } from "../../lib/passos-do-preparar.ts";
import { frasesDaBanca } from "../../lib/resumo-da-entrevista.ts";
import type { EntradaDoResumo } from "../../lib/resumo-da-entrevista.ts";
import { textoDaPontuacao } from "../../lib/roteiro-de-entrevista.ts";
import { Aviso, EstadoVazio } from "../../ui/index.ts";
import {
  BarraDaConfiguracao,
  CampoDoRoteiro,
  CamposDaBanca,
  type RoteiroDaLista,
} from "./configuracao-do-edital.tsx";
import type {
  DadosDaConfiguracaoDaEntrevista,
  DadosDoEdital,
  Resultado,
} from "./tipos.ts";

/*
  A configuração da entrevista do edital — o roteiro (a versão exata) e a
  banca (modo de lançamento, composição, membros e as competências de cada
  um) —, para ler e para editar, num componente só:

  - `RoteiroEscolhido` e `BancaGravada`: o que está gravado, só leitura. Os
    passos 1 e 2 de Conduzir entrevistas › Preparar mostram estes dois, com
    "Editar nas Regras do edital".
  - `EditorDaConfiguracaoDaEntrevista`: o editor, com o rascunho, o "o que
    falta" e o Salvar na própria memória. Está nas Regras do edital, etapa
    Entrevista. Grava pela mesma `configurar_entrevista_edital` (o
    `aoSalvar` é o `configurar` da loja de condução) e quem edita é quem o
    banco diz (`pode_editar` do `obter_entrevistas_do_edital`); quem não pode
    vê a configuração sem botões.
*/

type DadosComNotas = DadosDoEdital & {
  convocados: (DadosDoEdital["convocados"][number] & {
    avaliacoes?: unknown[] | null;
  })[];
};

const ordem = (a: { ordem?: number | null }, b: { ordem?: number | null }) =>
  (a.ordem ?? 0) - (b.ordem ?? 0);

/** O roteiro gravado do edital (nome, versão, pontuação, competências). */
export function RoteiroEscolhido({ dados }: { dados: DadosDoEdital }) {
  const roteiro = dados.configuracao?.roteiro;
  if (!roteiro) return null;
  const competencias = [...(roteiro.competencias || [])].sort(ordem);
  const aspectos = [...(roteiro.aspectos || [])].sort(ordem);
  return (
    <div
      className="entrevistas-roteiro-escolhido"
      data-bloco="roteiro-do-edital"
    >
      <div className="entrevistas-roteiro-escolhido-topo">
        <i className="fa-solid fa-clipboard-check" aria-hidden="true" />
        <div>
          <strong>{roteiro.nome}</strong>
          <span>
            {rotuloDaVersao({
              versao: roteiro.versao,
              nome: roteiro.nome_versao,
            })}{" "}
            · {textoDaPontuacao(roteiro)}
          </span>
        </div>
      </div>
      <dl className="entrevistas-roteiro-escolhido-itens">
        <div>
          <dt>Competências</dt>
          <dd>
            <ol>
              {competencias.map((c) => (
                <li key={c.id}>{c.nome}</li>
              ))}
            </ol>
          </dd>
        </div>
        {aspectos.length ? (
          <div>
            <dt>Cada competência em</dt>
            <dd>{aspectos.map((a) => a.nome).join(" · ")}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

/** A banca gravada: o modo de lançamento e os membros de cada banca. */
export function BancaGravada({ dados }: { dados: DadosDoEdital }) {
  const roteiro = dados.configuracao?.roteiro || null;
  const competencias = [...(roteiro?.competencias || [])].sort(ordem);
  const ativos = (dados.avaliadores || []).filter((a) => a.ativo !== false);
  if (!ativos.length) return null;
  const bancas = bancasDoEdital(ativos);
  const nomeDa = (id: string) =>
    competencias.find((c) => c.id === id)?.nome || id;
  return (
    <div className="entrevistas-banca-gravada" data-bloco="banca-do-edital">
      <p className="entrevistas-banca-lancamento">
        <i className="fa-solid fa-keyboard" aria-hidden="true" />{" "}
        {rotuloDoLancamento(dados.configuracao?.lancamento)}
      </p>
      <div className="entrevistas-bancas">
        {bancas.map((b) => (
          <article key={b} className="entrevistas-banca" data-banca={b}>
            <h4>Banca {b}</h4>
            <ul>
              {ativos
                .filter((a) => Number(a.banca) === Number(b))
                .map((a) => {
                  const membro = a as typeof a & {
                    nome?: string;
                    origem?: string;
                  };
                  const so = Array.isArray(a.competencias)
                    ? a.competencias
                    : null;
                  return (
                    <li key={a.id}>
                      <strong>{membro.nome}</strong>
                      {membro.origem ? <span> · {membro.origem}</span> : null}
                      <small>
                        {so && so.length < competencias.length
                          ? `Avalia só ${so.map(nomeDa).join(", ")}`
                          : "Avalia todas as competências"}
                      </small>
                    </li>
                  );
                })}
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Os avisos da banca gravada (competência sem avaliador e afins). */
export function AvisosDaBanca({ dados }: { dados: DadosDoEdital }) {
  const avisos = useMemo(
    () =>
      frasesDaBanca(
        (dados.avaliadores || []) as EntradaDoResumo["avaliadores"],
        (dados.configuracao?.roteiro ?? null) as EntradaDoResumo["roteiro"],
        dados.configuracao?.lancamento || null,
      ).avisos,
    [dados],
  );
  return avisos.map((a) => (
    <Aviso key={a} tom="warning">
      {a}
    </Aviso>
  ));
}

export interface PropriedadesDoEditorDaConfiguracao {
  dados: DadosDoEdital;
  /** Os roteiros da área (listar_roteiros_entrevista). */
  roteiros: readonly RoteiroDaLista[];
  salvando: boolean;
  /** Grava (configurar_entrevista_edital) e diz se deu certo. */
  aoSalvar: (dados: DadosDaConfiguracaoDaEntrevista) => Promise<Resultado>;
}

/**
 * O editor da configuração da entrevista do edital (roteiro e banca), com o
 * rascunho próprio. Sem configuração e com permissão, já abre editando.
 * Outro payload gravado (outro edital, ou o mesmo relido) recomeça o
 * rascunho quando não se está editando.
 */
export function EditorDaConfiguracaoDaEntrevista({
  dados,
  roteiros,
  salvando,
  aoSalvar,
}: PropriedadesDoEditorDaConfiguracao) {
  const podeEditar = Boolean(dados.pode_editar);
  const configurado = Boolean(dados.configuracao);
  const roteiro = dados.configuracao?.roteiro || null;
  const [editando, setEditando] = useState(!configurado && podeEditar);
  const [r, setR] = useState(() => rascunhoDaConfiguracao(dados));
  const [visto, setVisto] = useState(dados);
  const [tentou, setTentou] = useState(false);
  const [erroDoBanco, setErroDoBanco] = useState("");
  // O payload mudou (gravou, releu): fora da edição, o rascunho acompanha.
  if (visto !== dados) {
    setVisto(dados);
    if (!editando) setR(rascunhoDaConfiguracao(dados));
  }
  const secaoDoRoteiro = useRef<HTMLElement>(null);
  const secaoDaBanca = useRef<HTMLElement>(null);

  const opcoes = useMemo(() => {
    const lista = roteiros.slice();
    if (roteiro && !lista.some((x) => x.id === roteiro.id))
      lista.unshift(roteiro);
    return lista;
  }, [roteiros, roteiro]);
  const escolhido = opcoes.find((x) => x.id === r.roteiro) || null;
  const competencias = useMemo(
    () =>
      [...(escolhido?.competencias || [])]
        .sort(ordem)
        .map((c) => ({ id: c.id, nome: c.nome })),
    [escolhido],
  );
  const erros = useMemo(
    () => errosDaConfiguracao(r, escolhido),
    [r, escolhido],
  );
  const pendencias = useMemo(
    () => pendenciasDaConfiguracao(erros, r.avaliadores),
    [erros, r.avaliadores],
  );
  const errosVisiveis = tentou ? erros : {};
  const temNotas = (dados as DadosComNotas).convocados.some(
    (c) => c.avaliacoes?.length,
  );
  const ativos = (dados.avaliadores || []).filter((a) => a.ativo !== false);

  async function salvar() {
    setTentou(true);
    if (pendencias.length) return;
    setErroDoBanco("");
    const resultado = await aoSalvar(
      dadosDaConfiguracaoParaSalvar(r, escolhido),
    );
    if (resultado?.erro) setErroDoBanco(resultado.erro);
    else if (resultado?.ok) {
      setEditando(false);
      setTentou(false);
    }
  }
  const cancelar = configurado
    ? () => {
        setEditando(false);
        setTentou(false);
        setErroDoBanco("");
        setR(rascunhoDaConfiguracao(dados));
      }
    : null;
  const irA = (passo: "roteiro" | "banca") =>
    (passo === "roteiro"
      ? secaoDoRoteiro
      : secaoDaBanca
    ).current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const emEdicao = editando && podeEditar;

  return (
    <section
      className="ui-card entrevistas-preparar entrevistas-configuracao"
      aria-labelledby="entrevistaConfiguracaoTitulo"
      data-tour="regras-do-edital-entrevista"
    >
      <header className="entrevistas-preparar-topo">
        <h2 className="ui-titulo" id="entrevistaConfiguracaoTitulo">
          Roteiro e banca
        </h2>
        {emEdicao && configurado ? (
          <span className="entrevistas-chip-alerta">
            Editando a configuração
          </span>
        ) : null}
        {podeEditar && !editando ? (
          <button
            type="button"
            className="btn secondary small entrevistas-configuracao-editar"
            data-acao="editar-configuracao"
            data-tour="entrevistas-conduzir-editar-configuracao"
            onClick={() => setEditando(true)}
          >
            <i className="fa-solid fa-pen" aria-hidden="true" />{" "}
            {configurado ? "Editar roteiro e banca" : "Configurar"}
          </button>
        ) : null}
      </header>

      <section
        ref={secaoDoRoteiro}
        className="entrevistas-preparar-corpo"
        aria-labelledby="entrevistaConfiguracaoRoteiro"
        data-passo-atual="roteiro"
      >
        <div className="entrevistas-preparar-titulo">
          <h3 id="entrevistaConfiguracaoRoteiro">
            <i className="fa-solid fa-clipboard-check" aria-hidden="true" />{" "}
            Roteiro
          </h3>
        </div>
        {emEdicao ? (
          <CampoDoRoteiro
            r={r}
            opcoes={opcoes}
            temNotas={temNotas}
            erro={errosVisiveis.roteiro}
            aoTrocar={setR}
          />
        ) : roteiro ? (
          <RoteiroEscolhido dados={dados} />
        ) : (
          <EstadoVazio>O edital ainda não tem roteiro.</EstadoVazio>
        )}
      </section>

      <section
        ref={secaoDaBanca}
        className="entrevistas-preparar-corpo"
        aria-labelledby="entrevistaConfiguracaoBanca"
        data-passo-atual="banca"
      >
        <div className="entrevistas-preparar-titulo">
          <h3 id="entrevistaConfiguracaoBanca">
            <i className="fa-solid fa-users" aria-hidden="true" /> Banca
          </h3>
        </div>
        {emEdicao ? (
          <CamposDaBanca
            r={r}
            competencias={competencias}
            erros={errosVisiveis}
            meuPerfil={dados.meu_perfil}
            mudar={(m) => setR((atual) => ({ ...atual, ...m }))}
          />
        ) : ativos.length ? (
          <>
            <BancaGravada dados={dados} />
            <AvisosDaBanca dados={dados} />
          </>
        ) : (
          <EstadoVazio>O edital ainda não tem banca.</EstadoVazio>
        )}
      </section>

      {emEdicao ? (
        <BarraDaConfiguracao
          pendencias={pendencias}
          mostrarPendencias={tentou}
          erroDoBanco={erroDoBanco}
          salvando={salvando}
          aoIrAoPasso={irA}
          aoCancelar={cancelar}
          aoSalvar={() => void salvar()}
        />
      ) : null}
    </section>
  );
}
