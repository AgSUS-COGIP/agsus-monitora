import { useEffect, useState, useSyncExternalStore } from "react";
import { celulaExibida, coordenacaoDaLinha, pendenciasDoUsuario } from "../../lib/matriz-de-acessos.js";
import { nivelMaximo, podeEditarAreas, podeEditarUsuario } from "../../lib/teto-de-acessos.js";
import { capacidadesDoPerfil, menuDoContexto, perfilDoContexto, resumoDoEscopo } from "../../lib/ver-como.js";
import { Modal } from "../modal.jsx";
import { Icone } from "../icone.jsx";
import { BotaoDeAcao } from "../lista-aprovados/partes.jsx";
import { CabecalhoDaGaveta, motivoValido } from "./partes.jsx";

/*
  Gaveta da pessoa, aberta pelo nome na tabela: o que não cabe em coluna
  (áreas e painéis externos) e "como a pessoa vê" (menu e escopo lidos do que
  está salvo — não é entrar como ela). O que muda aqui vai para o mesmo
  rascunho da tabela e grava com "Salvar alterações".
*/

function ComoAPessoaVe({ estado, usuario, matriz, secoesDeConfiguracao }) {
  const [contexto, setContexto] = useState(null);
  const [erro, setErro] = useState("");
  useEffect(() => {
    let vivo = true;
    estado
      .lerContextoDoUsuario(usuario.id)
      .then((dados) => vivo && setContexto(dados))
      .catch((falha) => vivo && setErro(falha?.message || "Tente novamente."));
    return () => {
      vivo = false;
    };
  }, [estado, usuario.id]);

  if (erro) return <p className="acessos-erro"><Icone nome="circle-alert" tamanho={14} /> Não foi possível ler o acesso salvo.</p>;
  const perfil = contexto ? perfilDoContexto(contexto) : null;
  if (!perfil) return <p aria-busy="true"><span className="esqueleto" /></p>;
  const nomesDasAreas = new Map((matriz.areas || []).map((a) => [a.id, a.titulo]));
  const menu = menuDoContexto(contexto, { paineis: matriz.paineis || [], secoesDeConfiguracao });
  const capacidades = capacidadesDoPerfil(perfil);
  return (
    <>
      <p>{resumoDoEscopo(contexto, nomesDasAreas)}</p>
      <p className="acessos-secundario">{capacidades.length ? capacidades.join(" · ") : "Só consulta."}</p>
      {menu.length ? (
        <dl className="acessos-menu">
          {menu.map((grupo) => (
            <div key={grupo.id}>
              <dt>{grupo.rotulo}</dt>
              <dd>{grupo.itens.map((item) => item.rotulo).join(", ")}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="acessos-secundario">Nenhuma página liberada: a pessoa vê a tela "Sem acesso".</p>
      )}
    </>
  );
}

/*
  Conta de e-mail compartilhado de uma coordenação (ex.: "COET – …") não é uma
  pessoa: vira coordenação (com o nome da conta) e a conta é desativada.
*/
function MoverParaCoordenacoes({ estado, usuario, areas }) {
  const [aberto, setAberto] = useState(false);
  const [area, setArea] = useState(areas[0]?.id || "");
  const [motivo, setMotivo] = useState("");
  if (!aberto)
    return (
      <button type="button" className="btn outline acessos-ghost" onClick={() => setAberto(true)}>
        Mover para Coordenações
      </button>
    );
  return (
    <form
      className="acessos-mover"
      onSubmit={(evento) => {
        evento.preventDefault();
        if (motivoValido(motivo)) void estado.moverParaCoordenacoes(usuario, area, motivo.trim());
      }}
    >
      <p>
        Esta conta é de uma coordenação, não de uma pessoa? Ela vira a coordenação "{usuario.nome}" e a conta é desativada.
      </p>
      <div className="acessos-campo">
        <label htmlFor="acessosMoverArea">Área da coordenação</label>
        <select id="acessosMoverArea" value={area} onChange={(e) => setArea(e.target.value)}>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.titulo}
            </option>
          ))}
        </select>
      </div>
      <div className="acessos-campo">
        <label htmlFor="acessosMoverMotivo">Motivo</label>
        <input id="acessosMoverMotivo" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Vai para o histórico" />
      </div>
      <div className="acessos-acoes">
        <button type="button" className="btn outline acessos-ghost" onClick={() => setAberto(false)}>
          Cancelar
        </button>
        <BotaoDeAcao estado={estado} acao={`mover:${usuario.id}`} type="submit" className="btn primary" disabled={!motivoValido(motivo)}>
          Mover para Coordenações
        </BotaoDeAcao>
      </div>
    </form>
  );
}

export function GavetaDoUsuario({ estado, secoesDeConfiguracao = [] }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const { matriz, rascunho, gaveta } = atual;
  const usuario = matriz?.usuarios?.find((u) => u.id === gaveta?.usuarioId);
  if (!usuario) return null;
  const teto = matriz.teto;
  const usuarioLogado = atual.perfil ? { id: atual.perfil.user_id, email: atual.perfil.email } : null;
  const edicao = podeEditarUsuario(teto, usuario, usuarioLogado);
  const coordenacao = coordenacaoDaLinha(usuario, rascunho);
  const nomeDaCoordenacao = (matriz.coordenacoes || []).find((c) => c.codigo === coordenacao)?.nome;
  const nome = usuario.nome || usuario.email;
  const pendentes = pendenciasDoUsuario(rascunho, usuario.id);
  const marcado = (recurso) => celulaExibida(usuario, recurso, rascunho).nivel === "leitor";
  // Desmarcar o que só estava marcado no rascunho desfaz; desmarcar o que estava salvo grava "sem acesso".
  const alternar = (recurso, ligar) =>
    estado.registrar(
      usuario,
      recurso,
      ligar ? "leitor" : usuario.permissoes?.[recurso]?.origem === "excecao" ? "sem_acesso" : null,
    );

  return (
    <Modal id="acessosGaveta" rotuloId="acessosGavetaTitulo" className="acessos-gaveta" cartaoClassName="acessos-gaveta-cartao" aoFechar={estado.fecharGaveta}>
      <CabecalhoDaGaveta
        tituloId="acessosGavetaTitulo"
        titulo={nome}
        subtitulo={usuario.setor ? `${usuario.email} · setor informado: ${usuario.setor}` : usuario.email}
        aoFechar={estado.fecharGaveta}
      />
      <div className="acessos-gaveta-corpo">
        {edicao.motivo ? <p className="acessos-secundario">{edicao.motivo}</p> : null}
        {pendentes ? (
          <p className="alert info">
            <Icone nome="triangle-alert" tamanho={16} /> {pendentes} {pendentes === 1 ? "alteração pendente" : "alterações pendentes"}: salve na página, com o motivo.
          </p>
        ) : null}

        <section aria-labelledby="acessosGavetaAreas">
          <h4 id="acessosGavetaAreas">Áreas</h4>
          {usuario.admin_global ? (
            <p className="acessos-secundario">Administrador global: vê todas as áreas.</p>
          ) : coordenacao ? (
            <p className="acessos-secundario">Vê só o recorte da coordenação {nomeDaCoordenacao || coordenacao}.</p>
          ) : (
            <fieldset className="acessos-opcoes">
              <legend className="sr-only">Áreas que a pessoa vê inteiras</legend>
              {(matriz.areas || []).map((area) => (
                <label key={area.id}>
                  <input
                    type="checkbox"
                    checked={marcado(`area:${area.id}`)}
                    disabled={!edicao.pode || !podeEditarAreas(teto)}
                    onChange={(e) => alternar(`area:${area.id}`, e.target.checked)}
                  />
                  {area.titulo}
                </label>
              ))}
            </fieldset>
          )}
        </section>

        {(matriz.paineis || []).length ? (
          <section aria-labelledby="acessosGavetaPaineis">
            <h4 id="acessosGavetaPaineis">Painéis externos</h4>
            <fieldset className="acessos-opcoes">
              <legend className="sr-only">Painéis que a pessoa abre</legend>
              {matriz.paineis.map((painel) => {
                const recurso = `painel:${painel.id}`;
                return (
                  <label key={painel.id}>
                    <input
                      type="checkbox"
                      checked={marcado(recurso)}
                      disabled={!edicao.pode || usuario.admin_global || nivelMaximo(teto, recurso) === "sem_acesso"}
                      onChange={(e) => alternar(recurso, e.target.checked)}
                    />
                    {painel.titulo}
                  </label>
                );
              })}
            </fieldset>
          </section>
        ) : null}

        <section aria-labelledby="acessosGavetaVe">
          <h4 id="acessosGavetaVe">Como a pessoa vê</h4>
          <ComoAPessoaVe estado={estado} usuario={usuario} matriz={matriz} secoesDeConfiguracao={secoesDeConfiguracao} />
        </section>
      </div>
      {teto.admin_global && edicao.pode ? (
        <div className="acessos-gaveta-rodape">
          <MoverParaCoordenacoes estado={estado} usuario={usuario} areas={matriz.areas || []} />
          <BotaoDeAcao
            estado={estado}
            acao={`desativar:${usuario.id}`}
            className="btn outline acessos-ghost acessos-perigo"
            onClick={() => {
              const motivo = window.prompt(`Desativar o acesso de ${nome}? Informe o motivo:`);
              if (motivoValido(motivo)) void estado.desativarUsuario(usuario, motivo.trim());
            }}
          >
            <Icone nome="user-x" tamanho={16} /> Desativar acesso
          </BotaoDeAcao>
        </div>
      ) : null}
    </Modal>
  );
}
