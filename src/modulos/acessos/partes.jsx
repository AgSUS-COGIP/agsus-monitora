import { useState } from "react";
import { coordenacoesPorArea } from "../../lib/grupos-e-coordenacoes.js";
import { Icone } from "../../componentes/icone.jsx";
import { Aviso, Campo, classes } from "../../ui/index.js";

/*
  Peças que as abas de Acessos repetem e que não existem em src/ui/: lista
  mestre (grupos e coordenações, lista + detalhe), cabeçalho do modal da
  pessoa (com avatar), campo de motivo (obrigatório em toda gravação de
  acesso: vai para o histórico), caixas de área, as travas da matriz e as
  opções dos selects. O controle segmentado, as abas, os campos e os avisos
  são os de src/ui/.
*/

export const motivoValido = (motivo) => String(motivo || "").trim().length >= 3;

/**
 * Lista da esquerda no padrão lista + detalhe: busca, botão de criar e os
 * itens (título + linha secundária). O item escolhido fica marcado.
 */
export function ListaMestre({
  rotulo,
  itens,
  selecionado,
  aoEscolher,
  aoCriar,
  rotuloCriar,
}) {
  const [busca, setBusca] = useState("");
  const termo = busca.trim().toLocaleLowerCase("pt-BR");
  const visiveis = termo
    ? itens.filter((item) =>
        item.titulo.toLocaleLowerCase("pt-BR").includes(termo),
      )
    : itens;
  return (
    <nav className="acessos-mestre" aria-label={rotulo}>
      <div className="acessos-mestre-topo">
        <label className="acessos-busca">
          <Icone nome="search" tamanho={16} />
          <span className="sr-only">
            Pesquisar {rotulo.toLocaleLowerCase("pt-BR")}
          </span>
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar"
          />
        </label>
        {aoCriar ? (
          <button
            type="button"
            className="btn icon primary"
            aria-label={rotuloCriar}
            title={rotuloCriar}
            onClick={aoCriar}
          >
            <Icone nome="plus" tamanho={16} />
          </button>
        ) : null}
      </div>
      <ul>
        {visiveis.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className={classes(
                "acessos-mestre-item",
                item.id === selecionado && "ativo",
              )}
              aria-current={item.id === selecionado ? "true" : undefined}
              onClick={() => aoEscolher(item.id)}
            >
              <span>{item.titulo}</span>
              <small>{item.detalhe}</small>
            </button>
          </li>
        ))}
        {!visiveis.length ? (
          <li className="acessos-vazio">Nada encontrado.</li>
        ) : null}
      </ul>
    </nav>
  );
}

/** "Ana Luísa Costa" → "AC": primeira e última palavra. */
export function iniciais(nome) {
  const partes = String(nome || "")
    .replace(/[^\p{L}\s]/gu, " ")
    .split(/\s+/)
    .filter((parte) => parte.length > 2 || /^[A-ZÀ-Ý]/.test(parte));
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes.at(-1)[0] : "";
  return (primeira + ultima).toLocaleUpperCase("pt-BR");
}

export function CabecalhoDaGaveta({
  tituloId,
  titulo,
  subtitulo,
  avatar,
  aoFechar,
}) {
  return (
    <div className="acessos-gaveta-cabecalho">
      {avatar ? (
        <span
          className="acessos-avatar acessos-avatar-grande"
          aria-hidden="true"
        >
          {iniciais(avatar)}
        </span>
      ) : null}
      <div className="acessos-gaveta-titulo">
        <h3 id={tituloId}>{titulo}</h3>
        {subtitulo ? <p>{subtitulo}</p> : null}
      </div>
      <button
        type="button"
        className="btn icon outline"
        aria-label="Fechar"
        title="Fechar"
        onClick={aoFechar}
      >
        <Icone nome="x" tamanho={16} />
      </button>
    </div>
  );
}

export function CampoMotivo({
  id,
  valor,
  aoMudar,
  erro = false,
  rotulo = "Motivo da alteração",
}) {
  return (
    <Campo
      rotulo={rotulo}
      erro={erro ? "Informe o motivo (mínimo de 3 caracteres)." : undefined}
    >
      <input
        id={id}
        value={valor}
        onChange={(evento) => aoMudar(evento.target.value)}
        required
        minLength={3}
        maxLength={500}
      />
    </Campo>
  );
}

/**
 * Caixas das áreas que a pessoa vê inteiras (sem coordenação): a gaveta e a
 * reativação usam as mesmas. `marcadas` são ids; `aoAlternar(id, ligar)`.
 */
export function CaixasDeArea({
  areas,
  marcadas,
  aoAlternar,
  desabilitado = false,
}) {
  return (
    <fieldset className="acessos-opcoes">
      <legend className="sr-only">Áreas que a pessoa vê inteiras</legend>
      {areas.map((area) => (
        <label key={area.id}>
          <input
            type="checkbox"
            checked={marcadas.includes(area.id)}
            disabled={desabilitado}
            onChange={(e) => aoAlternar(area.id, e.target.checked)}
          />
          {area.titulo}
        </label>
      ))}
    </fieldset>
  );
}

/* As travas da matriz (23514 no banco), com o mesmo texto na gaveta e na reativação. */
export function AvisoSemArea({ nome }) {
  return (
    <Aviso tom="warning" papel="alert" como="p" className="acessos-sem-area">
      Sem área e sem coordenação, {nome} entra e não vê nada. Marque ao menos
      uma área (ou escolha uma coordenação) para poder salvar.
    </Aviso>
  );
}

export function AvisoSemCoordenacao() {
  return (
    <Aviso tom="warning" papel="alert" como="p" className="acessos-sem-area">
      Este grupo exige coordenação. Escolha uma (ou outro grupo).
    </Aviso>
  );
}

/** Coordenações agrupadas por área; a atual aparece mesmo se desativada. */
export function OpcoesDeCoordenacao({ coordenacoes, areas, atual }) {
  return coordenacoesPorArea(
    coordenacoes.filter((c) => c.ativo || c.codigo === atual),
    areas,
  ).map((grupo) => (
    <optgroup key={grupo.area.id} label={grupo.area.titulo}>
      {grupo.coordenacoes.map((c) => (
        <option key={c.codigo} value={c.codigo}>
          {c.nome}
        </option>
      ))}
    </optgroup>
  ));
}

/*
  O select do módulo mostra só o nível. Aberto, separa o que vem do grupo
  (valor "") do que vira permissão individual.
*/
export function OpcoesDoModulo({ opcoes }) {
  const [doGrupo, ...individuais] = opcoes;
  const opcao = (o) => (
    <option key={o.valor} value={o.valor} disabled={o.desabilitada}>
      {o.rotulo}
    </option>
  );
  return (
    <>
      <optgroup label="Do grupo">{opcao(doGrupo)}</optgroup>
      <optgroup label="Individual">{individuais.map(opcao)}</optgroup>
    </>
  );
}

/** Opções do grupo: o que quem está logado não pode atribuir fica desabilitado. */
export function OpcoesDoGrupo({ grupos, atribuiveis, atual }) {
  return grupos.map((g) => (
    <option
      key={g.codigo}
      value={g.codigo}
      disabled={g.codigo !== atual && !atribuiveis.includes(g)}
    >
      {g.nome}
    </option>
  ));
}
