import { StrictMode, useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { isAdminGlobal } from "../../lib/access-roles.js";
import {
  contarPendencias,
  estadoDoAlvo,
  LIMITE_DA_MENSAGEM,
  linhaDoHistorico,
  motivoValido,
  problemasDoRascunho,
  resumoDoRascunho,
  valorDoCampo,
} from "../../lib/modulos-e-abas.js";
import { criarEstadoDosModulos } from "./estado.js";
import { classes, ControleSegmentado } from "../acessos/partes.jsx";
import { BotaoDeAcao } from "../lista-aprovados/partes.jsx";
import { Icone } from "../icone.jsx";

/*
  Configurações › Módulos e abas (só admin global): ativar, desativar e pôr
  em manutenção o sistema inteiro, cada área, cada aba (em todas as áreas ou
  só numa) e os painéis externos, e ligar o selo BETA de cada aba.

    Sistema inteiro       Ativo / Em manutenção (+ mensagem e previsão) e o
                          liga/desliga das comemorações (marcos do processo)
    Um cartão por área    a situação da área e, dentro, as abas dela
    Abas (todas as áreas) a situação de cada aba e o selo BETA
    Painéis externos      Ativo / Em manutenção / Desativado
    Histórico             as 50 últimas mudanças

  Nada grava na hora: as mudanças se acumulam no rascunho (`estado.js`) e
  vão juntas em "Revisar e salvar", com motivo — como em Acessos.
*/

const OPCOES = Object.freeze([
  { valor: "ativa", rotulo: "Ativa" },
  { valor: "manutencao", rotulo: "Em manutenção" },
  { valor: "desativada", rotulo: "Desativada" },
]);
const OPCOES_DO_SISTEMA = Object.freeze([
  { valor: "ativa", rotulo: "Ativo" },
  { valor: "manutencao", rotulo: "Em manutenção" },
]);
const OPCOES_DO_PAINEL = Object.freeze([
  { valor: "ativa", rotulo: "Ativo" },
  { valor: "manutencao", rotulo: "Em manutenção" },
  { valor: "desativada", rotulo: "Desativado" },
]);

const idDoAlvo = (alvo) =>
  ["modulos", alvo.escopo, alvo.area, alvo.aba, alvo.painel]
    .filter(Boolean)
    .join("-");

function SeloDoEstado({ estado }) {
  if (estado === "ativa") return null;
  return (
    <span className={classes("modulos-selo", `modulos-selo--${estado}`)}>
      {estado === "manutencao" ? (
        <>
          <Icone nome="wrench" tamanho={12} /> Manutenção
        </>
      ) : (
        "Desativada"
      )}
    </span>
  );
}

/** Mensagem e previsão de volta, só quando o alvo está em manutenção. */
function CamposDaManutencao({ estado: estadoDaTela, alvo, valor }) {
  const id = idDoAlvo(alvo);
  const mensagem = valor(alvo, "mensagem");
  return (
    <div className="modulos-manutencao">
      <div className="acessos-campo modulos-manutencao__mensagem">
        <label htmlFor={`${id}-mensagem`}>Mensagem para quem abrir</label>
        <textarea
          id={`${id}-mensagem`}
          rows={2}
          maxLength={LIMITE_DA_MENSAGEM}
          value={mensagem}
          placeholder="Ex.: Estamos atualizando os editais. Volte mais tarde."
          onChange={(evento) =>
            estadoDaTela.mudarCampo(alvo, "mensagem", evento.target.value)
          }
        />
        <small className="acessos-secundario">
          {mensagem.length}/{LIMITE_DA_MENSAGEM}
        </small>
      </div>
      <div className="acessos-campo modulos-manutencao__previsao">
        <label htmlFor={`${id}-previsao`}>Previsão de volta</label>
        <input
          id={`${id}-previsao`}
          type="date"
          value={valor(alvo, "previsao")}
          onChange={(evento) =>
            estadoDaTela.mudarCampo(alvo, "previsao", evento.target.value)
          }
        />
      </div>
    </div>
  );
}

/** Uma linha de aba (ou painel): nome, situação e, em manutenção, os campos. */
function LinhaDoItem({
  estado: estadoDaTela,
  alvo,
  titulo,
  opcoes = OPCOES,
  valor,
  situacao,
  extra = null,
  comCampos = true,
}) {
  const atual = situacao(alvo);
  return (
    <li
      className={classes("modulos-linha", `modulos-linha--${atual}`)}
      data-alvo={idDoAlvo(alvo)}
    >
      <div className="modulos-linha__topo">
        <span className="modulos-linha__nome">
          {titulo}
          <SeloDoEstado estado={atual} />
        </span>
        <div className="modulos-linha__controles">
          {extra}
          <ControleSegmentado
            rotulo={`Situação de ${titulo}`}
            opcoes={opcoes}
            valor={atual}
            aoMudar={(novo) => estadoDaTela.mudarEstado(alvo, novo)}
          />
        </div>
      </div>
      {comCampos && atual === "manutencao" ? (
        <CamposDaManutencao estado={estadoDaTela} alvo={alvo} valor={valor} />
      ) : null}
    </li>
  );
}

function Cartao({ titulo, icone, controles = null, children }) {
  return (
    <section className="modulos-cartao">
      <header className="modulos-cartao__cabecalho">
        <span className="modulos-cartao__icone" aria-hidden="true">
          <Icone nome={icone} tamanho={16} />
        </span>
        <div className="modulos-cartao__titulo">
          <h4>{titulo}</h4>
        </div>
        {controles ? (
          <div className="modulos-cartao__controles">{controles}</div>
        ) : null}
      </header>
      {children}
    </section>
  );
}

function BarraDeRevisao({ estado, atual }) {
  const [revisando, setRevisando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [tentou, setTentou] = useState(false);
  const pendentes = contarPendencias(atual.rascunho);
  useEffect(() => {
    if (!pendentes) {
      setRevisando(false);
      setTentou(false);
    }
  }, [pendentes]);
  if (!pendentes) return null;
  const problemas = problemasDoRascunho(
    atual.arvore,
    atual.rascunho,
    atual.originais,
  );
  const linhas = resumoDoRascunho(
    atual.arvore,
    atual.rascunho,
    atual.originais,
  );
  const rotulo = `${pendentes} ${pendentes === 1 ? "alteração pendente" : "alterações pendentes"}`;

  if (!revisando)
    return (
      <div className="acessos-salvar modulos-salvar">
        <strong className="modulos-salvar__contagem">{rotulo}</strong>
        <div className="acessos-acoes">
          <button
            type="button"
            className="btn outline acessos-ghost"
            onClick={estado.descartar}
          >
            Descartar
          </button>
          <button
            type="button"
            className="btn primary"
            onClick={() => setRevisando(true)}
          >
            Revisar e salvar
          </button>
        </div>
      </div>
    );

  return (
    <form
      className="acessos-salvar modulos-salvar modulos-salvar--revisao"
      aria-label="Revisar alterações"
      noValidate
      onSubmit={(evento) => {
        evento.preventDefault();
        setTentou(true);
        if (problemas.length || !motivoValido(motivo)) return;
        void estado
          .salvar(motivo)
          .then((ok) => ok && (setMotivo(""), setTentou(false)));
      }}
    >
      <div className="modulos-revisao">
        <strong>{rotulo}</strong>
        <ul>
          {linhas.map((linha) => (
            <li key={linha.chave}>
              <span>{linha.onde}</span> · {linha.campo}: {linha.de} →{" "}
              {linha.para}
            </li>
          ))}
        </ul>
        {problemas.length ? (
          <ul className="modulos-problemas" role="alert">
            {problemas.map((problema) => (
              <li key={problema} className="acessos-erro">
                <Icone nome="circle-alert" tamanho={14} /> {problema}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="acessos-campo">
        <label htmlFor="modulosMotivo">Motivo da alteração</label>
        <input
          id="modulosMotivo"
          value={motivo}
          onChange={(evento) => setMotivo(evento.target.value)}
          required
          minLength={3}
          maxLength={500}
          aria-invalid={(tentou && !motivoValido(motivo)) || undefined}
        />
        {tentou && !motivoValido(motivo) ? (
          <small className="acessos-erro">
            <Icone nome="circle-alert" tamanho={14} /> Informe o motivo (de 3 a
            500 caracteres).
          </small>
        ) : null}
      </div>
      <div className="acessos-acoes">
        <button
          type="button"
          className="btn outline acessos-ghost"
          onClick={() => setRevisando(false)}
        >
          Voltar
        </button>
        <BotaoDeAcao
          estado={estado}
          acao="salvar"
          type="submit"
          className="btn primary"
          disabled={problemas.length > 0}
        >
          Salvar alterações
        </BotaoDeAcao>
      </div>
    </form>
  );
}

function Historico({ arvore }) {
  const registros = (arvore?.historico || []).slice(0, 50);
  return (
    <Cartao titulo="Histórico" icone="rotate-ccw">
      {registros.length ? (
        <ul className="modulos-historico">
          {registros.map((registro, indice) => {
            const linha = linhaDoHistorico(arvore, registro);
            return (
              <li key={`${registro.quando}-${indice}`}>
                <div>
                  <strong>{linha.onde}</strong> · {linha.campo}: {linha.de} →{" "}
                  {linha.para}
                </div>
                <small className="acessos-secundario">
                  {[linha.quando, linha.autor, linha.motivo]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="acessos-vazio">Nenhuma mudança registrada ainda.</p>
      )}
    </Cartao>
  );
}

export function ModulosEAbas({ estado }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const { arvore, rascunho, originais } = atual;

  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  });

  if (atual.perfil && !isAdminGlobal(atual.perfil))
    return (
      <p className="acessos-vazio" role="status">
        Só o administrador global gerencia módulos e abas.
      </p>
    );

  if (atual.status === "error" && !arvore)
    return (
      <div className="alert error acessos-erro-da-carga" role="alert">
        <Icone nome="circle-alert" tamanho={16} />
        <div>
          <strong>Não foi possível carregar módulos e abas.</strong>
          <p>
            {atual.erroCodigo === "PGRST202"
              ? "O banco ainda não tem a atualização de módulos. Aplique a migration 20260930140000_modulos_e_manutencao.sql e recarregue a página."
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

  if (!arvore)
    return (
      <p className="acessos-vazio" role="status">
        Carregando módulos e abas…
      </p>
    );

  const valor = (alvo, campo) => valorDoCampo(rascunho, originais, alvo, campo);
  const situacao = (alvo) => estadoDoAlvo(rascunho, originais, alvo);
  const nomeDaAba = new Map(
    (arvore.abas || []).map((aba) => [aba.co_aba, aba.no_aba]),
  );
  const sistema = { escopo: "sistema" };
  const estadoDoSistema = situacao(sistema);

  return (
    <div className="modulos-tela">
      {atual.aviso ? (
        <div
          className={classes(
            "alert",
            atual.aviso.tom === "danger" ? "error" : "warn",
          )}
          role="alert"
        >
          {atual.aviso.texto}
        </div>
      ) : null}

      <Cartao
        titulo="Sistema inteiro"
        icone="gauge"
        controles={
          <ControleSegmentado
            rotulo="Situação do sistema inteiro"
            opcoes={OPCOES_DO_SISTEMA}
            valor={estadoDoSistema}
            aoMudar={(novo) => estado.mudarEstado(sistema, novo)}
          />
        }
      >
        {estadoDoSistema === "manutencao" ? (
          <CamposDaManutencao estado={estado} alvo={sistema} valor={valor} />
        ) : null}
        <label className="modulos-comemoracoes">
          <input
            type="checkbox"
            checked={valor(sistema, "comemoracoes") !== "N"}
            onChange={(evento) =>
              estado.mudarCampo(
                sistema,
                "comemoracoes",
                evento.target.checked ? "S" : "N",
              )
            }
          />
          <span>Comemorações (marcos do processo)</span>
        </label>
      </Cartao>

      {(arvore.areas || []).map((area) => {
        const alvo = { escopo: "area", area: area.co_area };
        const estadoDaArea = situacao(alvo);
        return (
          <Cartao
            key={area.co_area}
            titulo={area.no_area || area.co_area}
            icone="layout-dashboard"
            controles={
              <>
                <SeloDoEstado estado={estadoDaArea} />
                <ControleSegmentado
                  rotulo={`Situação da área ${area.no_area || area.co_area}`}
                  opcoes={OPCOES}
                  valor={estadoDaArea}
                  aoMudar={(novo) => estado.mudarEstado(alvo, novo)}
                />
              </>
            }
          >
            {estadoDaArea === "manutencao" ? (
              <CamposDaManutencao estado={estado} alvo={alvo} valor={valor} />
            ) : null}
            {(area.abas || []).length ? (
              <ul
                className="modulos-lista"
                aria-label={`Abas de ${area.no_area || area.co_area}`}
              >
                {area.abas.map((aba) => (
                  <LinhaDoItem
                    key={aba.co_aba}
                    estado={estado}
                    alvo={{
                      escopo: "aba_area",
                      area: area.co_area,
                      aba: aba.co_aba,
                    }}
                    titulo={nomeDaAba.get(aba.co_aba) || aba.co_aba}
                    valor={valor}
                    situacao={situacao}
                  />
                ))}
              </ul>
            ) : (
              <p className="acessos-vazio">Nenhuma aba nesta área.</p>
            )}
          </Cartao>
        );
      })}

      <Cartao titulo="Abas (em todas as áreas)" icone="list-filter">
        <ul className="modulos-lista" aria-label="Abas em todas as áreas">
          {(arvore.abas || []).map((aba) => {
            const alvo = { escopo: "aba", aba: aba.co_aba };
            const beta = valor(alvo, "beta") === "S";
            return (
              <LinhaDoItem
                key={aba.co_aba}
                estado={estado}
                alvo={alvo}
                titulo={aba.no_aba || aba.co_aba}
                valor={valor}
                situacao={situacao}
                extra={
                  <label className="modulos-beta">
                    <input
                      type="checkbox"
                      checked={beta}
                      onChange={(evento) =>
                        estado.mudarCampo(
                          alvo,
                          "beta",
                          evento.target.checked ? "S" : "N",
                        )
                      }
                    />
                    <span>Selo BETA</span>
                  </label>
                }
              />
            );
          })}
        </ul>
      </Cartao>

      <Cartao titulo="Painéis externos" icone="square-arrow-out-up-right">
        {(arvore.paineis || []).length ? (
          <ul className="modulos-lista" aria-label="Painéis externos">
            {arvore.paineis.map((painel) => (
              <LinhaDoItem
                key={painel.id}
                estado={estado}
                alvo={{ escopo: "painel", painel: painel.id }}
                titulo={painel.titulo || "Painel sem título"}
                opcoes={OPCOES_DO_PAINEL}
                valor={valor}
                situacao={situacao}
                comCampos={false}
              />
            ))}
          </ul>
        ) : (
          <p className="acessos-vazio">Nenhum painel externo cadastrado.</p>
        )}
      </Cartao>

      <BarraDeRevisao estado={estado} atual={atual} />

      <Historico arvore={arvore} />
    </div>
  );
}

export function montarModulos({
  raizDaTela = document.getElementById("modulosApp"),
  supabase = getSupabaseClient(),
  toast,
  getProfile,
  confirmar,
} = {}) {
  const estado = criarEstadoDosModulos({
    supabase,
    toast,
    getProfile,
    confirmar,
  });
  let raiz = null;
  if (raizDaTela) {
    raiz = createRoot(raizDaTela);
    raiz.render(
      <StrictMode>
        <ModulosEAbas estado={estado} />
      </StrictMode>,
    );
  }
  return {
    estado,
    raiz,
    /* Ao abrir a seção: relê o perfil e carrega o que ainda não veio. */
    render: () => estado.garantirCarregado(),
    temAlteracoesPendentes: estado.temAlteracoesPendentes,
    confirmarSaida: estado.confirmarSaida,
  };
}
