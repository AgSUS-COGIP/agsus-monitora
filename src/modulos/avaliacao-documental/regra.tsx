import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  CRITERIOS_DA_DISTRIBUICAO,
  DESTINO_DOS_NOVOS,
  MODOS_DE_DISTRIBUICAO,
  rotuloDe,
  SINAIS_DA_REVISAO,
  SITUACOES_DA_REGRA,
} from "../../lib/avaliacao-documental/catalogo.ts";
import {
  codigoLivre,
  normalizarRegraAnalise,
  regrasIguais,
  validarRegraAnalise,
} from "../../lib/avaliacao-documental/regra.ts";
import { comecoDoEnunciado } from "../../lib/avaliacao-documental/nota-declarada.ts";
import {
  comPontosQuandoInapto,
  ROTULO_DA_OPCAO,
} from "../../lib/avaliacao-documental/pontos-informativos.ts";
import { DiferencasPorCargo } from "./assistente/diferencas-por-cargo.tsx";
import {
  erroDoNomeDaVersao,
  nomeParaGravar,
  sugerirNomeDaVersao,
} from "../../lib/nome-da-versao.ts";
import {
  Aviso,
  AvisoDeRascunho,
  Campo,
  CampoNomeDaVersao,
  EstadoVazio,
  Modal,
  NomeDaVersao,
  nomeDoCampo,
  RenomearVersao,
  Segmentado,
  Selo,
  SituacaoDoRascunho,
} from "../../ui/index.ts";
import { usarRascunhoDaRegra } from "../../app/usar-rascunho-da-regra.ts";
import type { Conteudo, RascunhoDaRegra } from "../../app/rascunho-da-regra.ts";
import type {
  ObservacaoPronta,
  PerguntaDaCarga,
  RegraAnalise,
  RegraSalva,
} from "../../lib/avaliacao-documental/tipos-da-regra.ts";
import {
  dataEHoraCurtas,
  textoDaGravacao,
} from "../../lib/rascunho-da-regra.ts";
import {
  AssistenteDaRegra,
  type ClassificacaoDoRascunho,
} from "./assistente/assistente.tsx";
import type { EstadoDaRegra } from "./assistente/tipos.ts";
import { ComparacaoDeVersoes, ResumoDaRegra } from "./assistente/conferir.tsx";
import { Blocos } from "./blocos.tsx";
import {
  BotaoMais,
  BotaoTirar,
  Caixa,
  CampoNumero,
  CampoTexto,
  comValor,
  Escolha,
  type Caminho,
} from "./campos.tsx";
import { Previa } from "./previa.tsx";
import type {
  AldeiasDoEdital,
  EstadoDaAvaliacao,
  ResultadoDaRegra,
  ResultadoDasAldeias,
} from "./tipos-do-estado.ts";
import { CarregandoConteudo } from "../../ui/index.ts";

/*
  A regra da Avaliação documental do edital (etapa 2 das Regras do edital,
  em Editais; a tela da Avaliação mostra só o resumo), que a coordenação (gestor do edital ou coordenação na equipe) cria e muda em
  versões com motivo. Dois jeitos sobre o MESMO rascunho: o assistente
  (assistente/, o padrão) e o modo avançado (o formulário inteiro, abaixo).
  "Conferida" é dupla conferência: quem salvou a versão não a confere (o
  banco recusa; o administrador global pode). Quem só lê vê o formulário
  travado, o resumo e a comparação de versões. A prévia "Testar com um
  candidato fictício" usa o rascunho e não grava. Requisitos da inscrição,
  nota declarada, desempate da lista e lote não se editam aqui: são da regra
  da Triagem (etapa 1); o que já estava gravado na regra da análise segue na
  configuração, sem mudança.
*/

/** O que a aba Regra usa do estado da avaliação (estado.ts). */
interface EstadoDaAbaRegra extends EstadoDaRegra {
  copiarModelo: (modelo: string) => Promise<ResultadoDaRegra>;
  salvarRegra: (
    configuracao: unknown,
    motivo: string,
    nome?: string | null,
  ) => Promise<ResultadoDaRegra>;
  conferirRegra: () => Promise<ResultadoDaRegra>;
  renomearVersao: (
    versao: number,
    nome: string | null,
    motivo: string,
  ) => Promise<ResultadoDaRegra>;
  salvarAldeias: (
    unidade: string | number | null | undefined,
    aldeias: string[],
    fonte: string,
  ) => Promise<ResultadoDasAldeias>;
}

/** O snapshot e o estado, como a tela da avaliação passa às peças da aba. */
interface PropsDoEstado {
  e: EstadoDaAvaliacao;
  estado: EstadoDaAbaRegra;
}

/** Uma parte do formulário que muda a regra inteira (o rascunho). */
interface PropsDaRegra {
  regra: RegraAnalise;
  aoMudar: (regra: RegraAnalise) => void;
}

type Modo = "assistente" | "avancado";

const CHAVE_DO_MODO = "avd-regra-modo";
const MODOS: ReadonlyArray<{ valor: Modo; rotulo: string; icone: string }> = [
  {
    valor: "assistente",
    rotulo: "Assistente",
    icone: "fa-wand-magic-sparkles",
  },
  { valor: "avancado", rotulo: "Modo avançado", icone: "fa-sliders" },
];
function lerModo(): Modo {
  try {
    return globalThis.localStorage?.getItem(CHAVE_DO_MODO) === "avancado"
      ? "avancado"
      : "assistente";
  } catch {
    return "assistente";
  }
}
function guardarModo(modo: Modo) {
  try {
    globalThis.localStorage?.setItem(CHAVE_DO_MODO, modo);
  } catch {
    // Sem armazenamento (modo privado): vale só nesta abertura.
  }
}

/*
  O rascunho guardado (src/app/rascunho-da-regra.ts, tipo ANALISE):
  { regra, classificacao? } — a regra inteira e, se o assistente mudou a nota
  mínima ou o desempate, a regra de classificação com a versão de onde partiu.
*/
const ehObjeto = (v: unknown): v is Record<string, unknown> =>
  Boolean(v) && typeof v === "object" && !Array.isArray(v);
function classificacaoDoGuardado(
  conteudo: Conteudo | null | undefined,
): ClassificacaoDoRascunho | null {
  const c = conteudo?.classificacao;
  return ehObjeto(c) &&
    Number.isInteger(c.versao_base) &&
    ehObjeto(c.configuracao)
    ? (c as ClassificacaoDoRascunho)
    : null;
}
function guardadoIgualAoVigente(
  conteudo: Conteudo | null | undefined,
  inicial: RegraAnalise | null,
) {
  if (!ehObjeto(conteudo?.regra)) return true;
  if (classificacaoDoGuardado(conteudo)) return false;
  return (
    Boolean(inicial) &&
    regrasIguais(normalizarRegraAnalise(conteudo.regra), inicial)
  );
}

const dataHora = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

function SemRegra({ e, estado }: PropsDoEstado) {
  const modelos = e.dados?.modelos ?? [];
  const [modelo, setModelo] = useState(modelos[0]?.codigo ?? "");
  const [erro, setErro] = useState("");
  if (!e.dados?.pode_coordenar)
    return (
      <EstadoVazio>Este edital ainda não tem regra da avaliação.</EstadoVazio>
    );
  return (
    <section className="ui-card" aria-labelledby="avdSemRegra">
      <h2 className="ui-titulo" id="avdSemRegra">
        Criar a regra do edital
      </h2>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <div className="avd-inline">
        <Campo rotulo="Modelo">
          <select value={modelo} onChange={(ev) => setModelo(ev.target.value)}>
            {modelos.map((m) => (
              <option key={m.codigo} value={m.codigo}>
                {m.nome}
              </option>
            ))}
          </select>
        </Campo>
        <button
          type="button"
          className="btn"
          data-acao="copiar-modelo"
          disabled={!modelo || e.salvando}
          onClick={async () => {
            const r = await estado.copiarModelo(modelo);
            setErro(r.ok ? "" : r.erro);
          }}
        >
          Criar a partir do modelo
        </button>
      </div>
    </section>
  );
}

/* As perguntas da carga são lidas só aqui (e no passo das perguntas do assistente). */
function Perguntas({
  e,
  estado,
  regra,
  aoMudar,
}: PropsDoEstado & PropsDaRegra) {
  const [blocoAlvo, setBlocoAlvo] = useState("");
  useEffect(() => {
    void estado.carregarPerguntas?.();
  }, [estado, e.editalId]);
  const perguntas = e.perguntasDaCarga;
  if (e.erroDasPerguntas)
    return (
      <Aviso tom="warning" papel="alert">
        Não foi possível ler as perguntas da última carga: {e.erroDasPerguntas}{" "}
        <button
          type="button"
          className="btn secondary small"
          onClick={() => void estado.carregarPerguntas({ recarregar: true })}
        >
          Tentar novamente
        </button>
      </Aviso>
    );
  if (!perguntas?.length) return null;
  const ligar = (coluna: string) => {
    const prefixo = comecoDoEnunciado(coluna);
    aoMudar(
      comValor(
        regra,
        ["blocos"],
        regra.blocos.map((b) =>
          b.codigo === blocoAlvo && !(b.perguntas ?? []).includes(prefixo)
            ? { ...b, perguntas: [...(b.perguntas ?? []), prefixo] }
            : b,
        ),
      ),
    );
  };
  const paraNotaDeclarada = (p: PerguntaDaCarga) =>
    aoMudar(
      comValor(
        regra,
        ["provisoria", "nota_declarada"],
        [
          ...regra.provisoria.nota_declarada,
          {
            parcial: "FORMACAO",
            pergunta: comecoDoEnunciado(p.coluna),
            tipo: "OPCAO",
            pontos: Object.fromEntries(p.respostas.map((r) => [r.valor, 0])),
            teto: null,
          },
        ],
      ),
    );
  const usadas = new Set(regra.blocos.flatMap((b) => b.perguntas ?? []));
  return (
    <section className="ui-card" aria-labelledby="avdPerguntas">
      <h2 className="ui-titulo" id="avdPerguntas">
        Perguntas da última carga da Empregare
      </h2>
      <label className="avd-inline">
        Ligar ao bloco{" "}
        <select
          value={blocoAlvo}
          onChange={(ev) => setBlocoAlvo(ev.target.value)}
        >
          <option value="">…</option>
          {regra.blocos.map((b) => (
            <option key={b.codigo} value={b.codigo}>
              {b.titulo || b.codigo}
            </option>
          ))}
        </select>
      </label>
      <ul className="avd-perguntas">
        {perguntas.map((p) => (
          <li key={p.coluna} data-pergunta={p.coluna}>
            <div className="avd-pergunta-topo">
              <strong>{p.coluna}</strong>
              {usadas.has(comecoDoEnunciado(p.coluna)) ? (
                <Selo tom="aprovado">Ligada</Selo>
              ) : null}
              <button
                type="button"
                className="btn secondary small"
                disabled={!blocoAlvo}
                onClick={() => ligar(p.coluna)}
              >
                Ligar
              </button>
              <button
                type="button"
                className="btn secondary small"
                disabled={!p.respostas.length}
                onClick={() => paraNotaDeclarada(p)}
              >
                Pontuar na nota declarada
              </button>
            </div>
            {p.dado_pessoal ? (
              <span className="ui-texto-secundario" data-dado-pessoal="sim">
                Dado pessoal — não resumido
              </span>
            ) : (
              <span className="ui-texto-secundario">
                {p.respostas
                  .map((r) => `${r.valor} (${r.quantidade})`)
                  .join(" · ")}
                {p.outras
                  ? `${p.respostas.length ? " · " : ""}${p.outras} resposta(s) fora do resumo (únicas ou com cara de dado pessoal)`
                  : ""}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/* As diferenças por cargo no modo avançado: as vagas e os cargos do quadro vêm do apoio do assistente. */
function PorCargo({ e, estado, regra, aoMudar }: PropsDoEstado & PropsDaRegra) {
  useEffect(() => {
    if (!e.apoio && !e.carregandoApoio && !e.erroDoApoio)
      void estado.carregarApoio?.();
  }, [estado, e.apoio, e.carregandoApoio, e.erroDoApoio]);
  return (
    <div className="ui-card">
      <DiferencasPorCargo
        regra={regra}
        aoMudar={aoMudar}
        vagas={e.apoio?.perguntas_por_vaga ?? []}
        cargosDoQuadro={e.apoio?.cargos_do_quadro ?? []}
      />
    </div>
  );
}

function ObservacoesProntas({ regra, aoMudar }: PropsDaRegra) {
  const itens = regra.observacoes_prontas;
  const mudar = (i: number, chave: keyof ObservacaoPronta, valor: unknown) =>
    aoMudar(comValor(regra, ["observacoes_prontas", i, chave], valor));
  return (
    <div className="avd-subgrupo">
      <h3>Observações prontas</h3>
      {itens.map((o, i) => (
        <div className="avd-linha" key={i}>
          <CampoTexto
            rotulo="Código"
            valor={o.codigo}
            maximo={30}
            aoMudar={(v) => mudar(i, "codigo", v.toUpperCase())}
          />
          <CampoTexto
            rotulo="Rótulo"
            valor={o.rotulo}
            maximo={100}
            aoMudar={(v) => mudar(i, "rotulo", v)}
          />
          <CampoTexto
            rotulo="Item"
            valor={o.item_edital}
            maximo={40}
            aoMudar={(v) => mudar(i, "item_edital", v)}
          />
          <Campo rotulo="Texto" largo>
            <textarea
              rows={2}
              maxLength={1000}
              value={o.texto ?? ""}
              onChange={(ev) => mudar(i, "texto", ev.target.value)}
            />
          </Campo>
          <BotaoTirar
            rotulo="Tirar a observação"
            aoClicar={() =>
              aoMudar(
                comValor(
                  regra,
                  ["observacoes_prontas"],
                  itens.filter((_, j) => j !== i),
                ),
              )
            }
          />
        </div>
      ))}
      <BotaoMais
        aoClicar={() =>
          aoMudar(
            comValor(
              regra,
              ["observacoes_prontas"],
              [
                ...itens,
                {
                  codigo: codigoLivre(itens, "OBS"),
                  rotulo: "",
                  texto: "",
                  item_edital: "",
                },
              ],
            ),
          )
        }
      >
        Observação pronta
      </BotaoMais>
    </div>
  );
}

interface VersoesProps {
  regra: RegraSalva | null;
  podeUsar?: boolean;
  /** Leva a configuração da versão ao formulário. */
  aoUsar: (configuracao: RegraAnalise) => void;
  /** Sem ele (quem só lê), as versões não se renomeiam. */
  aoRenomear?: EstadoDaAbaRegra["renomearVersao"] | null;
}

function Versoes({ regra, podeUsar, aoUsar, aoRenomear }: VersoesProps) {
  if (!regra?.versoes?.length) return null;
  return (
    <section className="ui-card" aria-labelledby="avdVersoes">
      <h2 className="ui-titulo" id="avdVersoes">
        Versões
      </h2>
      <ol className="avd-versoes" reversed>
        {regra.versoes.map((v) => (
          <li key={v.versao} data-versao={v.versao}>
            <NomeDaVersao
              versao={v.versao}
              nome={v.nome}
              trocas={v.renomeacoes}
            />{" "}
            · {dataHora(v.em)} · {v.por || "—"}
            {v.motivo ? (
              <span className="ui-texto-secundario"> — {v.motivo}</span>
            ) : null}
            {podeUsar && v.versao !== regra.versao ? (
              <button
                type="button"
                className="btn secondary small"
                onClick={() => aoUsar(v.configuracao)}
              >
                Levar ao formulário
              </button>
            ) : null}
            {aoRenomear ? (
              <RenomearVersao
                versao={v.versao}
                nome={v.nome}
                aoRenomear={(nome, motivo) =>
                  aoRenomear(v.versao, nome, motivo)
                }
              />
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  );
}

function CarregarAldeias({
  e,
  estado,
  aoFechar,
}: PropsDoEstado & { aoFechar: () => void }) {
  const [texto, setTexto] = useState("");
  const [fonte, setFonte] = useState("");
  const [erro, setErro] = useState("");
  const unidade = e.dados?.edital?.id_unidade;
  return (
    <Modal
      rotulo="Lista de aldeias do DSEI"
      aoFechar={aoFechar}
      tamanho="medio"
    >
      <h2 className="ui-titulo">Lista de aldeias do DSEI</h2>
      {erro ? (
        <Aviso tom="danger" papel="alert">
          {erro}
        </Aviso>
      ) : null}
      <Campo rotulo="Aldeias (uma por linha; NOME-(polo))" largo>
        <textarea
          rows={10}
          value={texto}
          onChange={(ev) => setTexto(ev.target.value)}
        />
      </Campo>
      <Campo rotulo="Fonte" largo>
        <input
          value={fonte}
          maxLength={300}
          onChange={(ev) => setFonte(ev.target.value)}
        />
      </Campo>
      <div className="ui-acoes">
        <button type="button" className="btn secondary" onClick={aoFechar}>
          Cancelar
        </button>
        <button
          type="button"
          className="btn"
          disabled={e.salvando || !unidade}
          onClick={async () => {
            const aldeias = texto
              .split("\n")
              .map((t) => t.trim())
              .filter(Boolean);
            const r = await estado.salvarAldeias(
              unidade,
              aldeias,
              fonte.trim(),
            );
            if (r.ok) aoFechar();
            else setErro(r.erro);
          }}
        >
          Salvar a lista
        </button>
      </div>
    </Modal>
  );
}

interface CabecalhoDaRegraProps extends PropsDoEstado {
  regraSalva: RegraSalva;
  leitura: boolean;
  /** O rascunho difere da versão vigente (não confere antes de salvar). */
  mudou: boolean;
  aoErro: (erro: string) => void;
}

function CabecalhoDaRegra({
  regraSalva,
  leitura,
  mudou,
  e,
  estado,
  aoErro,
}: CabecalhoDaRegraProps) {
  const outraPessoa = Boolean(regraSalva.conferir_pede_outra_pessoa);
  return (
    <section
      className="ui-card avd-resumo-da-regra"
      aria-label="Situação da regra"
    >
      <NomeDaVersao versao={regraSalva.versao} nome={regraSalva.nome} />
      <Selo tom={regraSalva.situacao === "CONFERIDA" ? "aprovado" : "pendente"}>
        {rotuloDe(SITUACOES_DA_REGRA, regraSalva.situacao)}
      </Selo>
      <span className="ui-texto-secundario">
        {regraSalva.por} · {dataHora(regraSalva.atualizado_em)}
        {regraSalva.modelo_origem
          ? ` · modelo ${regraSalva.modelo_origem}`
          : ""}
        {regraSalva.situacao === "CONFERIDA" && regraSalva.conferida_por
          ? ` · conferida por ${regraSalva.conferida_por}`
          : ""}
      </span>
      {leitura || !estado.renomearVersao ? null : (
        <RenomearVersao
          versao={regraSalva.versao}
          nome={regraSalva.nome}
          desabilitado={e.salvando}
          aoRenomear={(nome, motivo) =>
            estado.renomearVersao(regraSalva.versao, nome, motivo)
          }
        />
      )}
      {!leitura && regraSalva.situacao !== "CONFERIDA" ? (
        <>
          <button
            type="button"
            className="btn secondary small"
            data-acao="conferir-regra"
            data-tour="avd-regra-conferir"
            disabled={mudou || e.salvando || outraPessoa}
            title={
              outraPessoa
                ? "Dupla conferência: outra pessoa da coordenação confere"
                : undefined
            }
            onClick={async () => {
              const r = await estado.conferirRegra();
              aoErro(r.ok ? "" : r.erro);
            }}
          >
            Marcar como conferida
          </button>
          {outraPessoa ? (
            <span className="avd-dupla-conferencia" data-dupla-conferencia="">
              <i className="fa-solid fa-user-check" aria-hidden="true" /> Você
              salvou esta versão: outra pessoa da coordenação confere.
            </span>
          ) : null}
        </>
      ) : null}
    </section>
  );
}

export interface RegraProps extends PropsDoEstado {
  /** O rascunho guardado da regra (src/app/rascunho-da-regra.ts, tipo ANALISE). */
  rascunhoGuardado: RascunhoDaRegra;
}

export function Regra({ e, estado, rascunhoGuardado }: RegraProps) {
  const dados = e.dados;
  const regraSalva = dados?.regra ?? null;
  const leitura = !dados?.pode_coordenar;
  const inicial = useMemo(
    () => (regraSalva ? normalizarRegraAnalise(regraSalva.configuracao) : null),
    [regraSalva],
  );
  const [rascunho, setRascunho] = useState(inicial);
  const [motivo, setMotivo] = useState("");
  const [nome, setNome] = useState<string | null>(null);
  const [tentou, setTentou] = useState(false);
  const [erroDoBanco, setErroDoBanco] = useState("");
  const [aldeiasAbertas, setAldeiasAbertas] = useState(false);
  const [modo, setModo] = useState(lerModo);
  // "Fechar o assistente" (passo 5): a regra em resumo, com "Abrir o assistente".
  const [assistenteFechado, setAssistenteFechado] = useState(false);
  // Nota mínima e desempate mudados no assistente (vão no rascunho guardado).
  const [classificacaoDoRascunho, setClassificacaoDoRascunho] =
    useState<ClassificacaoDoRascunho | null>(null);
  const [classificacaoRetomada, setClassificacaoRetomada] =
    useState<ClassificacaoDoRascunho | null>(null);
  const conteudoDoRascunho = useMemo(
    () =>
      rascunho
        ? {
            regra: rascunho,
            ...(classificacaoDoRascunho
              ? { classificacao: classificacaoDoRascunho }
              : {}),
          }
        : {},
    [rascunho, classificacaoDoRascunho],
  );
  const guardado = usarRascunhoDaRegra({
    loja: rascunhoGuardado,
    editalId: e.editalId,
    versaoVigente: regraSalva?.versao ?? 0,
    ativo: !leitura,
    conteudo: conteudoDoRascunho,
    comAlteracoes:
      Boolean(rascunho && (!inicial || !regrasIguais(rascunho, inicial))) ||
      Boolean(classificacaoDoRascunho),
    igualAoVigente: (conteudo) => guardadoIgualAoVigente(conteudo, inicial),
    aplicar: (conteudo) => {
      const classificacao = classificacaoDoGuardado(conteudo);
      setRascunho(normalizarRegraAnalise(conteudo.regra));
      setClassificacaoDoRascunho(classificacao);
      setClassificacaoRetomada(classificacao);
      setAssistenteFechado(false);
    },
  });
  const textoDoRascunho = textoDaGravacao(
    guardado.gravacao,
    guardado.guardadoEm,
  );
  const situacaoDoRascunho = (
    <SituacaoDoRascunho texto={textoDoRascunho} gravacao={guardado.gravacao} />
  );
  const descartarTudo = () => {
    setRascunho(inicial);
    setClassificacaoDoRascunho(null);
    setClassificacaoRetomada(null);
  };
  const mudarModo = (novo: Modo) => {
    setModo(novo);
    guardarModo(novo);
  };
  const seletorDeModo = leitura ? null : (
    <div className="avd-modo-da-regra">
      <Segmentado
        rotulo="Como editar a regra"
        opcoes={MODOS}
        valor={modo}
        aoMudar={mudarModo}
        tour="avd-regra-modo"
      />
    </div>
  );
  const assistente = (
    <AssistenteDaRegra
      e={e}
      estado={estado}
      rascunho={rascunho}
      inicial={inicial}
      aoMudarRascunho={setRascunho}
      aoFechar={regraSalva ? () => setAssistenteFechado(true) : undefined}
      classificacaoRetomada={classificacaoRetomada}
      aoMudarClassificacaoDoRascunho={setClassificacaoDoRascunho}
      situacaoDoRascunho={situacaoDoRascunho}
      aoDescartarTudo={descartarTudo}
    />
  );

  // Lendo o rascunho guardado, ou perguntando o que fazer com ele: sem editor.
  if (guardado.bloqueia)
    return (
      <div className="avd-regra" data-rascunho-guardado="">
        {guardado.perguntar && guardado.guardado ? (
          <AvisoDeRascunho
            quando={dataEHoraCurtas(guardado.guardado.atualizadoEm)}
            versaoBase={guardado.guardado.versaoBase}
            versaoVigente={regraSalva?.versao ?? 0}
            local={guardado.guardado.local}
            aoContinuar={guardado.continuar}
            aoDescartar={guardado.descartar}
          />
        ) : (
          <CarregandoConteudo rotulo="Carregando a regra…" />
        )}
      </div>
    );

  if (!regraSalva) {
    if (leitura) return <SemRegra e={e} estado={estado} />;
    return (
      <div className="avd-regra">
        {seletorDeModo}
        {modo === "assistente" ? (
          assistente
        ) : (
          <SemRegra e={e} estado={estado} />
        )}
      </div>
    );
  }
  if (!rascunho) return <SemRegra e={e} estado={estado} />;
  const cabecalho = (
    <CabecalhoDaRegra
      regraSalva={regraSalva}
      leitura={leitura}
      mudou={!regrasIguais(rascunho, inicial)}
      e={e}
      estado={estado}
      aoErro={setErroDoBanco}
    />
  );
  const avisoDoBanco = erroDoBanco ? (
    <Aviso tom="danger" papel="alert">
      {erroDoBanco}
    </Aviso>
  ) : null;
  if (!leitura && modo === "assistente")
    return (
      <div className="avd-regra">
        {cabecalho}
        {avisoDoBanco}
        {seletorDeModo}
        {assistenteFechado ? (
          <section
            className="ui-card avd-ast-fechado"
            aria-label="Assistente fechado"
          >
            <div className="ui-acoes">
              <button
                type="button"
                className="btn"
                data-acao="abrir-assistente"
                onClick={() => setAssistenteFechado(false)}
              >
                <i
                  className="fa-solid fa-wand-magic-sparkles"
                  aria-hidden="true"
                />{" "}
                Abrir o assistente
              </button>
            </div>
            <ResumoDaRegra
              regra={inicial!}
              contexto={{
                versao: regraSalva.versao,
                nome: regraSalva.nome ?? null,
                notaMinima: dados!.nota_minima?.nota_minima ?? null,
                notaMinimaPorNivel:
                  dados!.nota_minima?.nota_minima_por_nivel ?? {},
              }}
            />
          </section>
        ) : (
          assistente
        )}
        <Versoes
          regra={regraSalva}
          podeUsar
          aoUsar={(config) => setRascunho(normalizarRegraAnalise(config))}
          aoRenomear={estado.renomearVersao}
        />
      </div>
    );

  const erros = validarRegraAnalise(rascunho);
  const mudou = !regrasIguais(rascunho, inicial);
  const motivoCurto = motivo.trim().length < 10;
  const sugestao = sugerirNomeDaVersao({
    tipo: "regra",
    edital: dados!.edital?.numero,
    motivo,
  });
  const nomeEscolhido = nomeDoCampo(nome, sugestao);
  const nomeRuim = Boolean(erroDoNomeDaVersao(nomeEscolhido));
  const mudar = (caminho: Caminho, valor: unknown) =>
    setRascunho(comValor(rascunho, caminho, valor));
  const temEtnico = rascunho.blocos.some((b) => b.tipo === "PONTUACAO");
  const aldeias: AldeiasDoEdital = dados!.aldeias ?? {};

  async function salvar(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    setTentou(true);
    if (erros.length || motivoCurto || nomeRuim) return;
    const r = await estado.salvarRegra(
      rascunho,
      motivo.trim(),
      nomeParaGravar(nomeEscolhido),
    );
    if (r.ok) {
      setMotivo("");
      setNome(null);
      setTentou(false);
      setErroDoBanco("");
    } else setErroDoBanco(r.erro);
  }

  return (
    <form className="avd-regra" onSubmit={salvar} noValidate>
      {cabecalho}
      {avisoDoBanco}
      {seletorDeModo}

      <fieldset className="avd-campos" disabled={leitura}>
        <section className="ui-card" aria-labelledby="avdGeral">
          <h2 className="ui-titulo" id="avdGeral">
            Geral
          </h2>
          <div className="ui-grade-de-campos">
            <CampoTexto
              rotulo="Título da etapa"
              valor={rascunho.titulo_etapa}
              aoMudar={(v) => mudar(["titulo_etapa"], v)}
            />
            <CampoTexto
              rotulo="Edital no parecer"
              valor={rascunho.edital_rotulo}
              maximo={120}
              aoMudar={(v) => mudar(["edital_rotulo"], v)}
            />
            <CampoNumero
              rotulo="Casas decimais do parecer"
              valor={rascunho.casas_parecer}
              aoMudar={(v) => mudar(["casas_parecer"], v)}
            />
            <CampoTexto
              rotulo="Item da nota mínima"
              valor={rascunho.corte.item_edital}
              maximo={40}
              aoMudar={(v) => mudar(["corte", "item_edital"], v)}
            />
            {leitura ? null : (
              <Campo rotulo="Carregar um modelo no formulário">
                <select
                  value=""
                  onChange={(ev) => {
                    const m = dados!.modelos.find(
                      (x) => x.codigo === ev.target.value,
                    );
                    if (m)
                      setRascunho(
                        normalizarRegraAnalise({
                          ...m.configuracao,
                          modelo: m.codigo,
                          edital_rotulo:
                            rascunho.edital_rotulo ||
                            m.configuracao.edital_rotulo,
                        }),
                      );
                  }}
                >
                  <option value="">…</option>
                  {dados!.modelos.map((m) => (
                    <option key={m.codigo} value={m.codigo}>
                      {m.nome}
                    </option>
                  ))}
                </select>
              </Campo>
            )}
          </div>
          {temEtnico ? (
            <p className="avd-aldeias" data-aldeias={aldeias.quantidade ?? 0}>
              Aldeias do DSEI do edital:{" "}
              <strong>{aldeias.quantidade ?? 0}</strong>
              {aldeias.fonte ? (
                <span className="ui-texto-secundario"> · {aldeias.fonte}</span>
              ) : null}{" "}
              {dados!.pode_carregar_aldeias && dados!.edital?.id_unidade ? (
                <button
                  type="button"
                  className="btn secondary small"
                  onClick={() => setAldeiasAbertas(true)}
                >
                  Atualizar a lista
                </button>
              ) : null}
            </p>
          ) : null}
        </section>

        <section className="ui-card" aria-labelledby="avdBlocos">
          <h2 className="ui-titulo" id="avdBlocos">
            Blocos da ficha
          </h2>
          <Blocos
            blocos={rascunho.blocos}
            aoMudar={(v) => mudar(["blocos"], v)}
          />
        </section>

        <PorCargo
          e={e}
          estado={estado}
          regra={rascunho}
          aoMudar={setRascunho}
        />

        {leitura ? null : (
          <Perguntas
            e={e}
            estado={estado}
            regra={rascunho}
            aoMudar={setRascunho}
          />
        )}

        <section className="ui-card" aria-labelledby="avdDistribuicao">
          <h2 className="ui-titulo" id="avdDistribuicao">
            Distribuição e revisão
          </h2>
          <div className="ui-grade-de-campos">
            <Escolha
              rotulo="Distribuição"
              valor={rascunho.distribuicao.modo as string | undefined}
              opcoes={MODOS_DE_DISTRIBUICAO}
              aoMudar={(v) => mudar(["distribuicao", "modo"], v)}
            />
            {rascunho.distribuicao.modo === "DISTRIBUICAO_INICIAL" ? (
              <>
                <Escolha
                  rotulo="Como reparte"
                  valor={rascunho.distribuicao.criterio as string | undefined}
                  opcoes={CRITERIOS_DA_DISTRIBUICAO}
                  aoMudar={(v) => mudar(["distribuicao", "criterio"], v)}
                />
                <CampoNumero
                  rotulo="Limite por analista"
                  valor={rascunho.distribuicao.limite_por_analista}
                  aoMudar={(v) =>
                    mudar(["distribuicao", "limite_por_analista"], v)
                  }
                />
                <Escolha
                  rotulo="Quem entra depois"
                  valor={rascunho.distribuicao.novos as string | undefined}
                  opcoes={DESTINO_DOS_NOVOS}
                  aoMudar={(v) => mudar(["distribuicao", "novos"], v)}
                />
              </>
            ) : null}
            <CampoNumero
              rotulo="Parada vira pendência (dias úteis)"
              valor={rascunho.distribuicao.dias_parada}
              aoMudar={(v) => mudar(["distribuicao", "dias_parada"], v)}
            />
            <CampoNumero
              rotulo="Amostra para revisão (%)"
              valor={rascunho.revisao.amostra_percentual}
              aoMudar={(v) => mudar(["revisao", "amostra_percentual"], v)}
            />
            <CampoNumero
              rotulo="Mínimo por analista"
              valor={rascunho.revisao.minimo_por_analista}
              aoMudar={(v) => mudar(["revisao", "minimo_por_analista"], v)}
            />
            <CampoNumero
              rotulo="Divergência acima de (pontos)"
              valor={rascunho.revisao.divergencia_pontos}
              aoMudar={(v) => mudar(["revisao", "divergencia_pontos"], v)}
            />
          </div>
          <div className="avd-caixas">
            <Caixa
              rotulo="Revisa todas"
              marcado={rascunho.revisao.todas as boolean | undefined}
              aoMudar={(v) => mudar(["revisao", "todas"], v)}
            />
            <Caixa
              rotulo="Inaptos por requisito"
              marcado={
                rascunho.revisao.inaptos_requisito as boolean | undefined
              }
              aoMudar={(v) => mudar(["revisao", "inaptos_requisito"], v)}
            />
            <Caixa
              rotulo="Inaptos por nota"
              marcado={rascunho.revisao.inaptos_nota as boolean | undefined}
              aoMudar={(v) => mudar(["revisao", "inaptos_nota"], v)}
            />
            <Caixa
              rotulo="Os que entraram pela linha"
              marcado={
                rascunho.revisao.entrou_pela_linha as boolean | undefined
              }
              aoMudar={(v) => mudar(["revisao", "entrou_pela_linha"], v)}
            />
            <Caixa
              rotulo="Duplo-cego"
              marcado={rascunho.revisao.duplo_cego as boolean | undefined}
              aoMudar={(v) => mudar(["revisao", "duplo_cego"], v)}
            />
            {SINAIS_DA_REVISAO.map(([sinal, rotulo]) => (
              <Caixa
                key={sinal}
                rotulo={`Com sinal: ${rotulo}`}
                marcado={rascunho.revisao.sinais.includes(sinal)}
                aoMudar={(v) =>
                  mudar(
                    ["revisao", "sinais"],
                    v
                      ? [...rascunho.revisao.sinais, sinal]
                      : rascunho.revisao.sinais.filter((s) => s !== sinal),
                  )
                }
              />
            ))}
          </div>
        </section>

        <section className="ui-card" aria-labelledby="avdParecer">
          <h2 className="ui-titulo" id="avdParecer">
            Parecer
          </h2>
          {(
            [
              ["APTO", "Apto"],
              ["INAPTO_REQUISITO", "Inapto (requisito)"],
              ["INAPTO_NOTA", "Inapto (nota mínima)"],
              ["observacoes", "Observações"],
            ] as const
          ).map(([chave, rotulo]) => (
            <Campo key={chave} rotulo={`Modelo: ${rotulo}`} largo>
              <textarea
                rows={3}
                maxLength={4000}
                value={rascunho.parecer[chave] ?? ""}
                onChange={(ev) => mudar(["parecer", chave], ev.target.value)}
              />
            </Campo>
          ))}
          <Caixa
            rotulo={ROTULO_DA_OPCAO}
            marcado={rascunho.parecer.mostrar_pontos_quando_inapto === true}
            aoMudar={(v) => setRascunho(comPontosQuandoInapto(rascunho, v))}
          />
          {rascunho.parecer.mostrar_pontos_quando_inapto === true ? (
            <Campo
              rotulo="Modelo: Pontuação informativa (inapto por requisito)"
              largo
            >
              <textarea
                rows={2}
                maxLength={4000}
                value={rascunho.parecer.pontos_informativos ?? ""}
                onChange={(ev) =>
                  mudar(["parecer", "pontos_informativos"], ev.target.value)
                }
              />
            </Campo>
          ) : null}
          <ObservacoesProntas regra={rascunho} aoMudar={setRascunho} />
        </section>
      </fieldset>

      {leitura ? null : (
        <section
          className="ui-card ui-barra-de-salvar"
          aria-label="Salvar a regra"
        >
          {tentou && erros.length ? (
            <Aviso tom="danger" papel="alert">
              <ul>
                {erros.slice(0, 12).map((erro) => (
                  <li key={erro}>{erro}</li>
                ))}
              </ul>
            </Aviso>
          ) : null}
          <Campo
            rotulo="Motivo da alteração"
            obrigatorio
            erro={
              tentou && motivoCurto ? "De 10 a 2.000 caracteres." : undefined
            }
          >
            <input
              value={motivo}
              maxLength={2000}
              onChange={(ev) => setMotivo(ev.target.value)}
            />
          </Campo>
          <CampoNomeDaVersao
            valor={nome}
            sugestao={sugestao}
            aoMudar={setNome}
            mostrarErro={tentou}
          />
          <div className="ui-acoes">
            {situacaoDoRascunho}
            <button
              type="button"
              className="btn secondary"
              disabled={!mudou && !classificacaoDoRascunho}
              onClick={descartarTudo}
            >
              Descartar
            </button>
            <button
              type="submit"
              className="btn"
              data-acao="salvar-regra"
              disabled={e.salvando || !mudou}
            >
              Salvar como versão {regraSalva.versao + 1}
            </button>
          </div>
        </section>
      )}

      <Previa regra={rascunho} notaMinima={dados!.nota_minima} />

      {leitura ? (
        <ResumoDaRegra
          regra={rascunho}
          contexto={{
            versao: regraSalva.versao,
            nome: regraSalva.nome ?? null,
            notaMinima: dados!.nota_minima?.nota_minima ?? null,
            notaMinimaPorNivel: dados!.nota_minima?.nota_minima_por_nivel ?? {},
          }}
        />
      ) : null}
      <ComparacaoDeVersoes
        regraSalva={regraSalva}
        rascunho={leitura ? null : rascunho}
      />

      <Versoes
        regra={regraSalva}
        podeUsar={!leitura}
        aoUsar={(config) => setRascunho(normalizarRegraAnalise(config))}
        aoRenomear={leitura ? null : estado.renomearVersao}
      />
      {aldeiasAbertas ? (
        <CarregarAldeias
          e={e}
          estado={estado}
          aoFechar={() => setAldeiasAbertas(false)}
        />
      ) : null}
    </form>
  );
}
