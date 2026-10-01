import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { montarModulo } from "../../app/montar-modulo.jsx";
import { usarTemaEscuro } from "../../app/tema.js";
import { estadoDasConfiguracoes } from "../../componentes/configuracoes/estado.js";
import { getSupabaseClient } from "../../lib/supabaseClient.js";
import { textosDaVisaoGeral } from "../../lib/visao-geral.js";
import { BoasVindas, MarcosDoAno } from "./boas-vindas.jsx";
import { estadoDaVisaoGeral } from "./estado.js";
import { GavetaDoProcesso } from "./gaveta.jsx";
import {
  Atencao,
  Filtros,
  Indicadores,
  ResumoPorEtapa,
  StatusOperacional,
  Topo,
  UnidadesComVariosProcessos,
} from "./paineis.jsx";
import { TabelaDeProcessos } from "./tabela.jsx";

/*
  A Visão geral (view `dashboard`), um módulo do app: monta direto na
  `<section id="page-dashboard">` do index.html. O legado continua dono da
  navegação (classe `.active`, título do cabeçalho por área com
  `cabecalhoDaVisaoGeral`, permissão `ind`) e da carga das linhas
  (`loadData` → dados-do-monitoramento.js); a tela lê o estado
  (`estado.js`) e não pede nada ao banco, fora os marcos do ano.

  Ordem: boas-vindas e marcos do ano, topo (hora da carga, Atualizar,
  Exportar CSV), filtros, indicadores, "Unidades com mais de um processo
  seletivo", o BLOCO DO MAPA, resumo por etapa, status operacional,
  "Atenção" e a tabela de processos, com os detalhes numa gaveta.

  O BLOCO DO MAPA É UMA FOLHA DO LEGADO (Etapa 5, parte 2): a marcação fica
  no index.html (`#mapaDaVisaoGeral`, guardada em
  `#reservaDoMapaDaVisaoGeral`) e o React só reserva o lugar
  (`.visao-geral-mapa`) e muda o nó para dentro dele ao montar — sem prop que
  mude e sem filhos React, para não desfazer o que o legado desenha. Ao
  desmontar (ou se a tela quebrar), o nó volta para a reserva, com o Leaflet
  intacto.

  Textos de Configurações › Página inicial (publicados): filtros, rótulos
  dos indicadores e títulos dos blocos (`textosDaVisaoGeral`).
*/

function EspacoDoMapa({ bloco, reserva }) {
  const espaco = useRef(null);
  useLayoutEffect(() => {
    const destino = espaco.current;
    if (!destino || !bloco) return undefined;
    destino.append(bloco);
    return () => {
      if (reserva) reserva.append(bloco);
      else bloco.remove();
    };
  }, [bloco, reserva]);
  return <div className="visao-geral-mapa" ref={espaco} />;
}

function usarTextos(configuracoes) {
  const { valores } = useSyncExternalStore(
    configuracoes.assinar,
    configuracoes.obter,
  );
  return useMemo(
    () => textosDaVisaoGeral((chave) => valores?.get?.(chave)),
    [valores],
  );
}

export function TelaDaVisaoGeral({
  estado,
  configuracoes,
  blocoDoMapa,
  reservaDoMapa,
  obterPerfil,
  supabase,
  comemoracoesLigadas,
  agora,
}) {
  const e = useSyncExternalStore(estado.assinar, estado.obter);
  const textos = usarTextos(configuracoes);
  const escuro = usarTemaEscuro();
  const [aberta, setAberta] = useState(null);
  // A linha aberta segue os dados: recarga atualiza a gaveta; se sumir, fecha.
  const linhaAberta = aberta
    ? e.linhasDaArea.find((linha) => String(linha.id) === aberta) || null
    : null;

  return (
    <div className="ui-tela visao-geral-tela">
      <BoasVindas obterPerfil={obterPerfil} agora={agora} />
      <MarcosDoAno
        obterPerfil={obterPerfil}
        supabase={supabase}
        comemoracoesLigadas={comemoracoesLigadas}
      />
      <Topo e={e} aoExportar={estado.exportarCsv} />
      <Filtros e={e} estado={estado} textos={textos} />
      <Indicadores e={e} estado={estado} textos={textos} />
      <UnidadesComVariosProcessos e={e} estado={estado} />
      <EspacoDoMapa bloco={blocoDoMapa} reserva={reservaDoMapa} />
      <ResumoPorEtapa e={e} estado={estado} textos={textos} />
      <div className="ui-linha-de-cards">
        <StatusOperacional
          e={e}
          estado={estado}
          textos={textos}
          escuro={escuro}
        />
        <Atencao
          e={e}
          textos={textos}
          aoAbrir={(linha) => setAberta(String(linha.id))}
        />
      </div>
      <TabelaDeProcessos
        e={e}
        estado={estado}
        textos={textos}
        agora={agora}
        aoAbrir={(linha) => setAberta(String(linha.id))}
      />
      {linhaAberta ? (
        <GavetaDoProcesso
          linha={linhaAberta}
          aoFechar={() => setAberta(null)}
          aoVoltarALinha={() => {
            setAberta(null);
            estado.destacar(linhaAberta.id);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Monta a tela na `<section id="page-dashboard">` e devolve o controlador do
 * legado (`window.visaoGeralController`): o estado e a raiz do React (os
 * testes desmontam por ela). Desenha na hora (`flushSync`): o bloco do mapa
 * já está no lugar quando o resto do app inicia.
 */
export function montarVisaoGeral({
  secao = document.getElementById("page-dashboard"),
  blocoDoMapa = document.getElementById("mapaDaVisaoGeral"),
  reservaDoMapa = document.getElementById("reservaDoMapaDaVisaoGeral"),
  estado = estadoDaVisaoGeral,
  configuracoes = estadoDasConfiguracoes,
  toast,
  obterPerfil = () => window.getMonitoraProfile?.() || null,
  supabase = getSupabaseClient(),
  comemoracoesLigadas = () => false,
  agora = () => new Date(),
} = {}) {
  estado.definirAviso(toast);
  const raiz = secao
    ? montarModulo(
        secao,
        <TelaDaVisaoGeral
          estado={estado}
          configuracoes={configuracoes}
          blocoDoMapa={blocoDoMapa}
          reservaDoMapa={reservaDoMapa}
          obterPerfil={obterPerfil}
          supabase={supabase}
          comemoracoesLigadas={comemoracoesLigadas}
          agora={agora}
        />,
        { nome: "a Visão geral", flushSync: true },
      ).raiz
    : null;
  return { estado, raiz };
}
