import {
  StrictMode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createRoot } from "react-dom/client";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { abasDeAcessos } from "../../lib/teto-de-acessos.js";
import { criarEstadoDosAcessos } from "./estado.js";
import { AbaUsuarios } from "./aba-usuarios.jsx";
import { AbaGrupos } from "./aba-grupos.jsx";
import { AbaCoordenacoes } from "./aba-coordenacoes.jsx";
import { GavetaDoUsuario } from "./gaveta-do-usuario.jsx";
import { classes } from "./partes.jsx";
import { Icone } from "../icone.jsx";

/*
  Configurações › Acessos: permissões individuais + grupos de permissões.
    Usuários      cada pessoa: grupo (tag) + um select por módulo; pedidos pendentes
    Grupos        lista + detalhe: o nível de cada módulo no grupo
    Coordenações  lista + detalhe: o recorte de dados de cada coordenação
  O admin global vê as três; o coordenador (módulo "acessos" ≥ editor), só
  Usuários, recortado pela coordenação dele (o banco recorta de novo).

  As abas ficam montadas e escondidas: busca, rascunho e formulários
  sobrevivem à troca de aba.
*/

function Abas({ abas, ativa, aoEscolher, contagens }) {
  const botoes = useRef([]);
  function aoTeclar(evento, indice) {
    const passo = { ArrowRight: 1, ArrowLeft: -1 }[evento.key];
    if (!passo) return;
    evento.preventDefault();
    const proximo = (indice + passo + abas.length) % abas.length;
    aoEscolher(abas[proximo].id);
    botoes.current[proximo]?.focus();
  }
  return (
    <div
      className="approved-tabs acessos-abas"
      role="tablist"
      aria-label="Acessos"
    >
      {abas.map((aba, indice) => (
        <button
          key={aba.id}
          ref={(el) => (botoes.current[indice] = el)}
          type="button"
          role="tab"
          id={`acessos-aba-${aba.id}`}
          aria-controls={`acessos-painel-${aba.id}`}
          aria-selected={ativa === aba.id}
          tabIndex={ativa === aba.id ? 0 : -1}
          className={classes("approved-tab", ativa === aba.id && "active")}
          onClick={() => aoEscolher(aba.id)}
          onKeyDown={(evento) => aoTeclar(evento, indice)}
        >
          {aba.rotulo}
          {contagens[aba.id] ? (
            <span className="acessos-contador">{contagens[aba.id]}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

/*
  PGRST202: o PostgREST não achou a função com os parâmetros novos, ou seja,
  as migrations de acessos (20260929121000 a 121300) ainda não foram aplicadas.
*/
function ErroDaCarga({ estado, codigo, mensagem }) {
  const bancoDesatualizado = codigo === "PGRST202";
  return (
    <div className="alert error acessos-erro-da-carga" role="alert">
      <Icone nome="circle-alert" tamanho={16} />
      <div>
        <strong>
          {bancoDesatualizado
            ? "O banco ainda não tem a atualização de acessos."
            : "Não foi possível carregar os acessos."}
        </strong>
        <p>
          {bancoDesatualizado
            ? "Aplique as migrations 20260929121000 a 20260929121300 (supabase/migrations) no SQL Editor e recarregue a página."
            : mensagem}
        </p>
        {codigo ? <small>Código: {codigo}</small> : null}
      </div>
      <button
        type="button"
        className="btn secondary"
        onClick={() => void estado.carregarMatriz()}
      >
        Tentar novamente
      </button>
    </div>
  );
}

export function Acessos({ estado, secoesDeConfiguracao = [] }) {
  const atual = useSyncExternalStore(estado.assinar, estado.obter);
  const abas = abasDeAcessos(atual.perfil);
  const [ativa, setAtiva] = useState("usuarios");
  const abaAtiva = abas.some((aba) => aba.id === ativa) ? ativa : abas[0]?.id;

  useEffect(() => {
    document.dispatchEvent(new CustomEvent("agsus:content-updated"));
  });

  if (!abas.length)
    return (
      <p className="acessos-vazio" role="status">
        Você não tem permissão para gerenciar acessos. Peça a um administrador.
      </p>
    );

  const painel = (id, conteudo) =>
    abas.some((aba) => aba.id === id) ? (
      <div
        id={`acessos-painel-${id}`}
        role="tabpanel"
        aria-labelledby={`acessos-aba-${id}`}
        className="acessos-painel"
        hidden={abaAtiva !== id}
      >
        {conteudo}
      </div>
    ) : null;

  // Sem a primeira carga não há o que mostrar em nenhuma aba: o erro fica no lugar delas.
  if (atual.status === "error" && !atual.matriz)
    return (
      <ErroDaCarga
        estado={estado}
        codigo={atual.erroCodigo}
        mensagem={atual.erro}
      />
    );

  const verPessoasDoGrupo = (codigo) => {
    setAtiva("usuarios");
    void estado.carregarMatriz({ filtroGrupo: codigo, offset: 0 });
  };

  return (
    <div className="acessos-tela">
      <Abas
        abas={abas}
        ativa={abaAtiva}
        aoEscolher={setAtiva}
        contagens={{ usuarios: atual.solicitacoes.length || "" }}
      />
      {painel("usuarios", <AbaUsuarios estado={estado} />)}
      {painel(
        "grupos",
        <AbaGrupos estado={estado} aoVerPessoas={verPessoasDoGrupo} />,
      )}
      {painel("coordenacoes", <AbaCoordenacoes estado={estado} />)}
      {atual.gaveta ? (
        <GavetaDoUsuario
          key={atual.gaveta.abertura}
          estado={estado}
          secoesDeConfiguracao={secoesDeConfiguracao}
        />
      ) : null}
    </div>
  );
}

export function montarAcessos({
  raizDaTela = document.getElementById("acessosApp"),
  supabase = getSupabaseClient(),
  toast,
  getProfile,
  confirmar,
  secoesDeConfiguracao = [],
} = {}) {
  const estado = criarEstadoDosAcessos({
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
        <Acessos estado={estado} secoesDeConfiguracao={secoesDeConfiguracao} />
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
