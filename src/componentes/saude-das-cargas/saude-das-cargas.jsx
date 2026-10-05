import { useEffect, useState, useSyncExternalStore } from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { isAdminGlobal } from "../../lib/access-roles.js";
import { formatNumberBR } from "../../lib/formatters.js";
import { estadoDoBotao, roboDeCarga } from "../../lib/robos-de-carga.js";
import {
  dataHora,
  SITUACOES,
  textoDaIdade,
  visaoSimples,
} from "../../lib/saude-das-cargas.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { CartaoDeAvisos } from "../../modulos/conferencias/avisos-de-conferencia.jsx";
import { Icone } from "../icone.jsx";
import { criarEstadoDaSaude } from "./estado.js";

/*
  Configurações › Status das atualizações (só administrador global). A tela responde
  primeiro "está tudo atualizado?": uma frase no topo e uma linha por aba do
  sistema (Análises por área, Entrevistas, Seleção e a atualização automática
  do banco), com o selo e "atualizado há X". Os detalhes técnicos — cada
  script ou tarefa, agenda, linhas e as últimas 10 execuções — ficam em
  "Detalhes". Só leitura: uma RPC, `get_saude_das_cargas`
  (20261001120000_saude_das_cargas.sql); as regras em src/lib/saude-das-cargas.js.

  Abre pela seção (src/modulos/configuracoes/secoes.js → `render()`), que relê a cada
  vez: o estado das cargas muda a cada poucos minutos.

  Abaixo da lista, o cartão "Avisos de conferência" (src/modulos/conferencias/):
  os avisos que o job Python das conferências gravou, de todos os módulos.

  Empregare, Seleção, Entrevistas e Conferências têm "Rodar agora": o botão chama
  /api/rodar-carga (api/rodar-carga.js), que dispara o workflow no GitHub;
  fica desabilitado enquanto a carga roda (src/lib/robos-de-carga.js).
*/

const classes = (...lista) => lista.filter(Boolean).join(" ");

const ICONE_DA_SITUACAO = Object.freeze({
  em_dia: "circle-check",
  atrasada: "triangle-alert",
  falhou: "circle-alert",
  em_andamento: "refresh-cw",
  nunca: "circle",
});

function Selo({ situacao }) {
  const s = SITUACOES[situacao];
  return (
    <span className={`saude-selo saude-selo--${s.tom}`}>
      <Icone nome={ICONE_DA_SITUACAO[situacao]} tamanho={12} />
      {s.rotulo}
    </span>
  );
}

function Historico({ execucoes }) {
  if (!execucoes.length)
    return <p className="saude-parte__vazio">Nenhuma execução registrada.</p>;
  return (
    <div className="saude-historico">
      <table>
        <thead>
          <tr>
            <th scope="col">Início</th>
            <th scope="col">Fim</th>
            <th scope="col">Resultado</th>
            <th scope="col" className="num">
              Linhas
            </th>
            <th scope="col">Mensagem</th>
          </tr>
        </thead>
        <tbody>
          {execucoes.map((e, i) => (
            <tr key={i}>
              <td>{dataHora(e.inicio)}</td>
              <td>{dataHora(e.fim)}</td>
              <td>
                <span
                  className={classes(
                    "saude-resultado",
                    `saude-resultado--${e.situacao}`,
                  )}
                >
                  {e.situacao === "ok"
                    ? "Concluída"
                    : e.situacao === "falha"
                      ? "Falhou"
                      : "Em andamento"}
                </span>
              </td>
              <td className="num">
                {e.linhas === null ? "—" : formatNumberBR(e.linhas)}
              </td>
              <td className="saude-mensagem">{e.mensagem || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* Uma parte técnica (um script ou uma tarefa) dentro de "Detalhes". */
function Parte({ parte }) {
  return (
    <div className="saude-parte">
      <div className="saude-parte__topo">
        <strong>{parte.nome}</strong>
        <Selo situacao={parte.situacao} />
      </div>
      <small className="saude-parte__onde">
        {parte.onde} · esperado {parte.esperado || "—"}
        {parte.ultimaOk
          ? ` · última concluída ${dataHora(parte.ultimaOk.fim || parte.ultimaOk.inicio)}`
          : ""}
      </small>
      <Historico execucoes={parte.historico} />
    </div>
  );
}

function textoDaAtualizacao(linha) {
  if (linha.indisponivel) return "Sem acesso às tarefas";
  if (!linha.ultimaAtualizacao) return "Ainda não houve carga";
  return `Atualizado ${textoDaIdade(linha.idadeMin)}`;
}

function RodarAgora({ robo, linha, atual, estado }) {
  const botao = estadoDoBotao({
    robo,
    disponibilidade: atual.disparo,
    linha,
    pedidoEm: atual.pedidos[robo.id] || null,
    agora: estado.agora(),
  });
  const aviso = atual.avisos[robo.id];
  return (
    <>
      <button
        type="button"
        className="btn secondary saude-botao saude-rodar"
        disabled={botao.desabilitado}
        title={botao.aviso || undefined}
        onClick={() => void estado.rodarAgora(robo.id)}
      >
        <Icone nome="refresh-cw" tamanho={14} />
        {botao.rotulo}
      </button>
      {aviso ? (
        <small
          className={`saude-rodar__aviso saude-rodar__aviso--${aviso.tom}`}
          role={aviso.tom === "erro" ? "alert" : "status"}
        >
          {aviso.texto}
        </small>
      ) : botao.aviso ? (
        <small className="saude-rodar__aviso">{botao.aviso}</small>
      ) : null}
    </>
  );
}

function Linha({ linha, atual, estado }) {
  const [aberta, setAberta] = useState(false);
  const robo = roboDeCarga(linha.id);
  return (
    <li
      className={classes("saude-item", `saude-item--${linha.situacao}`)}
      data-carga={linha.id}
    >
      <div className="saude-item__topo">
        <div className="saude-item__nome">
          <strong>{linha.titulo}</strong>
          <small>{linha.explicacao}</small>
        </div>
        <div className="saude-item__estado">
          <Selo situacao={linha.situacao} />
          {linha.emAndamento ? (
            <span className="saude-selo saude-selo--info">
              <Icone nome="refresh-cw" tamanho={12} />
              Rodando agora
            </span>
          ) : null}
          <span
            className="saude-item__quando"
            title={
              linha.ultimaAtualizacao ? dataHora(linha.ultimaAtualizacao) : ""
            }
          >
            {textoDaAtualizacao(linha)}
          </span>
          {robo ? (
            <RodarAgora
              robo={robo}
              linha={linha}
              atual={atual}
              estado={estado}
            />
          ) : null}
          {linha.partes.length ? (
            <button
              type="button"
              className="btn secondary saude-botao"
              aria-expanded={aberta}
              onClick={() => setAberta((a) => !a)}
            >
              <Icone
                nome={aberta ? "chevron-up" : "chevron-down"}
                tamanho={14}
              />
              {aberta ? "Esconder" : "Detalhes"}
            </button>
          ) : null}
        </div>
      </div>
      {linha.erro ? (
        <p className="saude-erro" role="note">
          <strong>
            Falhou em {dataHora(linha.erro.quando)} ({linha.erro.parte}):
          </strong>{" "}
          {linha.erro.mensagem || "sem mensagem registrada."}
        </p>
      ) : null}
      {aberta ? (
        <div className="saude-item__detalhes">
          {linha.partes.map((parte) => (
            <Parte key={parte.id} parte={parte} />
          ))}
        </div>
      ) : null}
    </li>
  );
}

function Resumo({ atencao, geradoEm, carregando, aoAtualizar }) {
  const tudoBem = !atencao.length;
  return (
    <div
      className={classes(
        "saude-resumo",
        tudoBem ? "saude-resumo--ok" : "saude-resumo--atencao",
      )}
      role="status"
      aria-live="polite"
    >
      <Icone nome={tudoBem ? "circle-check" : "triangle-alert"} tamanho={20} />
      <div className="saude-resumo__texto">
        <strong>
          {tudoBem
            ? "Tudo em dia."
            : `${atencao.length} ${atencao.length === 1 ? "atualização precisa" : "atualizações precisam"} de atenção.`}
        </strong>
        <span>
          {tudoBem
            ? "Todas as atualizações rodaram dentro do esperado."
            : atencao
                .map(
                  (l) =>
                    `${l.titulo} (${SITUACOES[l.situacao].rotulo.toLowerCase()})`,
                )
                .join(" · ")}
        </span>
      </div>
      <div className="saude-resumo__acoes">
        <small>Consultado em {dataHora(geradoEm)}</small>
        <button
          type="button"
          className="btn secondary"
          disabled={carregando}
          onClick={aoAtualizar}
        >
          <Icone nome="refresh-cw" tamanho={14} />
          Atualizar
        </button>
      </div>
    </div>
  );
}

export function SaudeDasCargas({ estado, supabase }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);

  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  });

  if (atual.perfil && !isAdminGlobal(atual.perfil))
    return (
      <p className="acessos-vazio" role="status">
        Só o administrador global vê o status das atualizações.
      </p>
    );

  if (atual.status === "error")
    return (
      <div className="alert error acessos-erro-da-carga" role="alert">
        <Icone nome="circle-alert" tamanho={16} />
        <div>
          <strong>Não foi possível consultar as atualizações.</strong>
          <p>
            {atual.erroCodigo === "PGRST202"
              ? "O banco ainda não tem a função. Aplique a migration 20261001120000_saude_das_cargas.sql e recarregue a página."
              : atual.erro}
          </p>
          {atual.erroCodigo ? <small>Código: {atual.erroCodigo}</small> : null}
        </div>
        <button
          type="button"
          className="btn secondary"
          onClick={() => void estado.carregar()}
        >
          Tentar novamente
        </button>
      </div>
    );

  if (!atual.dados)
    return (
      <p className="acessos-vazio" role="status">
        Consultando as atualizações…
      </p>
    );

  const { linhas, atencao } = visaoSimples(atual.dados);

  return (
    <div className="modulos-tela saude-tela">
      <Resumo
        atencao={atencao}
        geradoEm={atual.dados.geradoEm}
        carregando={atual.status === "loading"}
        aoAtualizar={() => void estado.carregar()}
      />
      <ul className="saude-lista">
        {linhas.map((linha) => (
          <Linha key={linha.id} linha={linha} atual={atual} estado={estado} />
        ))}
      </ul>
      {supabase ? (
        <CartaoDeAvisos
          key={atual.dados.geradoEm?.getTime() ?? 0}
          supabase={supabase}
        />
      ) : null}
    </div>
  );
}

/**
 * Monta a seção no `#saudeDasCargasApp` e devolve o controlador que
 * src/modulos/configuracoes/secoes.js chama ao abrir a seção.
 */
export function montarSaudeDasCargas({
  raizDaTela = document.getElementById("saudeDasCargasApp"),
  supabase = getSupabaseClient(),
  getProfile,
  agora,
  buscar,
  obterToken,
  agendar,
} = {}) {
  const estado = criarEstadoDaSaude({
    supabase,
    getProfile,
    ...(agora ? { agora } : {}),
    ...(buscar ? { buscar } : {}),
    ...(obterToken ? { obterToken } : {}),
    ...(agendar ? { agendar } : {}),
  });
  const raiz = raizDaTela
    ? montarModulo(
        raizDaTela,
        <SaudeDasCargas estado={estado} supabase={supabase} />,
        {
          nome: "Status das atualizações",
        },
      ).raiz
    : null;
  return {
    estado,
    raiz,
    /* Ao abrir a seção: relê (o estado das cargas muda a cada poucos minutos). */
    render: () => estado.carregar(),
    temAlteracoesPendentes: () => false,
    confirmarSaida: () => true,
  };
}
