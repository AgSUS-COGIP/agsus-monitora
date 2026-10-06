import { useEffect, useRef, useSyncExternalStore } from "react";
import { ACCESS_BACKGROUND_MIME_TYPES } from "../../lib/access-background-storage.js";
import {
  CHAVE_DA_COR_DA_BARRA,
  CHAVE_DO_LOGO_DA_BARRA,
  logoDaBarraSegura,
} from "../../lib/marca-da-barra-lateral.js";
import { camposDaSecao } from "../../lib/publicacao-de-configuracoes.js";
import { aplicarMarcaDaBarraLateral } from "../../modules/sidebar-branding.js";
import { Aviso, Selo } from "../../ui/index.js";
import { Icone } from "../../componentes/icone.jsx";
import {
  AvisoDeContraste,
  CampoDaSecao,
  fundoEmCss,
  Grupo,
  PreviaDoAcesso,
} from "./partes.jsx";

/*
  Configurações › Aparência: a arte de fundo, o logo e a cor do cartão da
  tela de acesso; a logo e a cor da barra lateral. Cada cor mostra o
  contraste do texto que vai sobre ela; a prévia da tela de acesso fica ao
  lado.

  A arte de fundo é aplicada na hora (imagens.js); o resto vai no rascunho e
  na publicação da barra fixa. Enquanto a logo ou a cor da barra estão no
  rascunho, a barra lateral de verdade já mostra a escolha; descartada ou
  publicada, volta ao valor publicado.
*/

const CAMPOS = camposDaSecao("aparencia");
const PREFIXO = "configAparencia";
const TIPOS_DE_IMAGEM = ACCESS_BACKGROUND_MIME_TYPES.join(",");

function usar(loja) {
  return useSyncExternalStore(loja.assinar, loja.obter);
}

/* Botão que abre o seletor de arquivo (o <input type="file"> fica escondido). */
function BotaoDeEnviar({ id, ocupado, aoEscolher }) {
  const entrada = useRef(null);
  return (
    <>
      <button
        type="button"
        className="btn"
        disabled={Boolean(ocupado)}
        aria-busy={ocupado === "enviar" || undefined}
        onClick={() => entrada.current?.click()}
      >
        {ocupado === "enviar" ? (
          <span className="botao-girando" aria-hidden="true" />
        ) : (
          <Icone nome="image" tamanho={16} />
        )}
        <span>{ocupado === "enviar" ? "Enviando..." : "Escolher imagem"}</span>
      </button>
      <input
        ref={entrada}
        id={id}
        type="file"
        accept={TIPOS_DE_IMAGEM}
        hidden
        onChange={(evento) => {
          const arquivo = evento.target.files?.[0];
          evento.target.value = "";
          if (arquivo) void aoEscolher(arquivo);
        }}
      />
    </>
  );
}

/*
  As imagens já enviadas: usar (a que está em uso não tem botão) e apagar
  (a que está em uso não pode ser apagada).
*/
function Galeria({
  titulo,
  itens,
  emUso,
  protegida = emUso,
  ocupado,
  aoUsar,
  aoApagar,
  formato,
}) {
  if (!itens.length) return null;
  return (
    <div className="config-galeria">
      <p className="config-galeria__titulo">{titulo}</p>
      <ul className="config-galeria__grade" data-formato={formato}>
        {itens.map((item) => {
          const ativa = emUso(item);
          const semApagar = ativa || protegida(item);
          return (
            <li
              key={item.caminho}
              className="config-galeria__cartao"
              data-ativa={ativa || undefined}
            >
              <button
                type="button"
                className="config-galeria__item"
                disabled={ativa || Boolean(ocupado)}
                aria-label={
                  ativa ? `${item.nome}, em uso` : `Usar ${item.nome}`
                }
                onClick={() => void aoUsar(item)}
              >
                <span
                  className="config-galeria__miniatura"
                  style={{ backgroundImage: fundoEmCss(item.url) }}
                />
                {ativa ? null : <small>Usar</small>}
              </button>
              {semApagar ? (
                <Selo tom="aprovado">Em uso</Selo>
              ) : (
                <button
                  type="button"
                  className="config-galeria__apagar"
                  disabled={Boolean(ocupado)}
                  aria-label={`Apagar ${item.nome}`}
                  onClick={() => void aoApagar(item)}
                >
                  Apagar
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ArteDeFundo({ estado, imagens }) {
  const atual = usar(imagens);
  const arte = estado.valor("auth_access_background_url");
  const emUso = String(
    estado.valor("auth_access_background_path") || "",
  ).trim();
  const ocupado = atual.fundoOcupado;
  return (
    <div
      className="config-imagem ui-campo-largo"
      aria-busy={Boolean(ocupado) || undefined}
    >
      <span className="config-imagem__rotulo" id="configAparencia-arteRotulo">
        Arte de fundo
      </span>
      <div className="config-imagem__linha">
        <div
          className="config-imagem__previa config-imagem__previa--arte"
          role="img"
          aria-labelledby="configAparencia-arteRotulo"
          style={{ backgroundImage: fundoEmCss(arte) }}
        />
        <div className="config-imagem__acoes">
          <BotaoDeEnviar
            id="configAparencia-arteArquivo"
            ocupado={ocupado}
            aoEscolher={imagens.enviarFundo}
          />
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(ocupado)}
            aria-busy={ocupado === "restaurar" || undefined}
            onClick={() => void imagens.restaurarFundo()}
          >
            <Icone nome="rotate-ccw" tamanho={16} />
            <span>Restaurar padrão</span>
          </button>
        </div>
      </div>
      <Galeria
        titulo="Artes enviadas"
        formato="paisagem"
        itens={atual.fundos.itens}
        emUso={(item) => Boolean(emUso) && item.caminho === emUso}
        ocupado={ocupado}
        aoUsar={imagens.usarFundo}
        aoApagar={imagens.apagarFundo}
      />
    </div>
  );
}

function LogoDaBarra({ estado, imagens }) {
  const atual = usar(imagens);
  const escolhida = logoDaBarraSegura(estado.valor(CHAVE_DO_LOGO_DA_BARRA));
  const ocupado = atual.logoOcupado;
  return (
    <div
      className="config-imagem ui-campo-largo"
      aria-busy={Boolean(ocupado) || undefined}
    >
      <span className="config-imagem__rotulo">Logo da barra lateral</span>
      <div className="config-imagem__linha">
        <img
          className="config-imagem__previa config-imagem__previa--logo"
          src={escolhida}
          alt="Logo escolhida para a barra lateral"
        />
        <div className="config-imagem__acoes">
          <BotaoDeEnviar
            id="configAparencia-logoArquivo"
            ocupado={ocupado}
            aoEscolher={imagens.enviarLogo}
          />
          <button
            type="button"
            className="btn secondary"
            disabled={Boolean(ocupado)}
            onClick={imagens.restaurarLogo}
          >
            <Icone nome="rotate-ccw" tamanho={16} />
            <span>Restaurar padrão</span>
          </button>
        </div>
      </div>
      {atual.avisoDoLogo ? (
        <Aviso
          tom={atual.avisoDoLogo.tom === "erro" ? "danger" : "info"}
          papel={atual.avisoDoLogo.tom === "erro" ? "alert" : "status"}
          className="config-imagem__aviso"
        >
          {atual.avisoDoLogo.texto}
        </Aviso>
      ) : null}
      <Galeria
        titulo="Logos enviadas"
        formato="quadrado"
        itens={atual.logos.itens}
        emUso={(item) => logoDaBarraSegura(item.url) === escolhida}
        protegida={(item) => imagens.logoProtegida(item.url)}
        ocupado={ocupado}
        aoUsar={imagens.usarLogo}
        aoApagar={imagens.apagarLogo}
      />
    </div>
  );
}

/*
  A barra lateral de verdade acompanha a logo e a cor do rascunho; sem
  rascunho (descartado ou publicado), volta ao valor publicado.
*/
function usarBarraLateralAoVivo(estado) {
  const { rascunho } = estado.obter();
  const emRascunho =
    rascunho.has(CHAVE_DO_LOGO_DA_BARRA) || rascunho.has(CHAVE_DA_COR_DA_BARRA);
  const logo = estado.valor(CHAVE_DO_LOGO_DA_BARRA);
  const cor = estado.valor(CHAVE_DA_COR_DA_BARRA);
  const aplicada = useRef(false);
  useEffect(() => {
    if (!emRascunho && !aplicada.current) return;
    aplicarMarcaDaBarraLateral({ logo, cor });
    aplicada.current = emRascunho;
  }, [emRascunho, logo, cor]);
}

export function SecaoAparencia({ estado, imagens }) {
  const { secao } = useSyncExternalStore(estado.assinar, estado.obter);
  usarBarraLateralAoVivo(estado);
  useEffect(() => {
    if (secao === "aparencia") void imagens.carregar();
  }, [imagens, secao]);
  const campo = (chave) => (
    <CampoDaSecao
      estado={estado}
      campos={CAMPOS}
      prefixo={PREFIXO}
      chave={chave}
    />
  );
  return (
    <div
      className="config-secao-react config-secao-react--com-previa"
      data-tour="config-aparencia"
    >
      <div className="config-secao-react__campos">
        <Grupo
          secao="aparencia"
          id="acesso"
          titulo="Tela de acesso"
          icone="log-in"
          tom="azul"
        >
          <ArteDeFundo estado={estado} imagens={imagens} />
          {campo("auth_access_logo_url")}
          {campo("auth_access_panel_color")}
          {campo("auth_access_texto_modo")}
          <AvisoDeContraste
            cor={estado.valor("auth_access_panel_color")}
            modo={estado.valor("auth_access_texto_modo")}
            comBotao
          />
        </Grupo>
        <Grupo
          secao="aparencia"
          id="barra"
          titulo="Barra lateral"
          icone="panel-left"
          tom="petroleo"
        >
          <LogoDaBarra estado={estado} imagens={imagens} />
          {campo(CHAVE_DA_COR_DA_BARRA)}
          <AvisoDeContraste cor={estado.valor(CHAVE_DA_COR_DA_BARRA)} />
        </Grupo>
      </div>
      <PreviaDoAcesso estado={estado} />
    </div>
  );
}
