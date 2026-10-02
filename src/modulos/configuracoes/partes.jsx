import { useState } from "react";
import { DEFAULT_ACCESS_BRANDING } from "../../lib/access-branding.js";
import { urlDeImagem } from "../../lib/apresentacao-das-configuracoes.js";
import { avaliarCor, corDoTextoPara } from "../../lib/contraste.js";
import { Aviso, Campo } from "../../ui/index.js";
import { Icone } from "../../componentes/icone.jsx";

/*
  Peças comuns das seções de Configurações (Marca, Página inicial, Tela de
  acesso, Aparência e Operação): o grupo de campos com título e ícone, o
  campo ligado ao rascunho do estado (o `Campo` de src/ui/), a prévia ao
  lado, o aviso de contraste das cores e a prévia da tela de acesso (a mesma
  nas duas seções que a mudam).
*/

const camelo = (chave) =>
  chave.replace(/_([a-z])/g, (_, letra) => letra.toUpperCase());

/** Id estável do campo: `config<Secao>-<chaveEmCamelo>` (contrato dos testes). */
export const idDoCampo = (prefixo, chave) => `${prefixo}-${camelo(chave)}`;

/** Um grupo de campos com o ícone colorido do assunto (configuracoes.css). */
export function Grupo({ secao, id, titulo, icone, tom, children }) {
  const tituloId = `configGrupo-${secao}-${id}`;
  return (
    <section
      className="config-grupo"
      data-tom={tom}
      data-grupo={id}
      aria-labelledby={tituloId}
    >
      <header className="config-grupo__cabecalho">
        <span className="config-grupo__icone" aria-hidden="true">
          <Icone nome={icone} tamanho={16} />
        </span>
        <div>
          <h4 id={tituloId}>{titulo}</h4>
        </div>
      </header>
      <div className="config-grupo__campos ui-grade-de-campos">{children}</div>
    </section>
  );
}

const TIPO_DO_INPUT = Object.freeze({
  url: "url",
  email: "email",
});

/**
 * Um campo da seção (definido em CAMPOS_DAS_SECOES): texto, endereço,
 * e-mail, número, lista de opções ou cor. O valor é o do rascunho (ou o
 * publicado) e a mudança vai para o rascunho; o erro é o da última validação.
 */
export function CampoDaSecao({ estado, campos, prefixo, chave }) {
  const campo = campos.get(chave);
  const erro = estado.obter().errosDosCampos.get(chave);
  const comum = {
    id: idDoCampo(prefixo, chave),
    value: estado.valor(chave),
    className: erro ? "config-field-invalid" : undefined,
    onChange: (evento) => estado.mudarCampo(chave, evento.target.value),
  };
  let controle;
  if (campo.opcoes)
    controle = (
      <select {...comum}>
        {campo.opcoes.map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </select>
    );
  else if (campo.tipo === "cor")
    controle = <input {...comum} type="color" className="config-cor" />;
  else if (campo.tipo === "inteiro")
    controle = (
      <input
        {...comum}
        type="number"
        min={campo.minimo}
        max={campo.maximo}
        step={1}
        placeholder={campo.placeholder}
      />
    );
  else
    controle = (
      <input
        {...comum}
        type={TIPO_DO_INPUT[campo.tipo] || "text"}
        placeholder={campo.placeholder}
      />
    );
  return (
    <Campo
      rotulo={campo.rotulo}
      erro={erro}
      obrigatorio={campo.obrigatorio}
      largo={campo.largo}
    >
      {controle}
    </Campo>
  );
}

/** A prévia ao lado dos campos (fixa no desktop; embaixo no celular). */
export function Previa({ rotulo, children }) {
  return (
    <aside className="config-previa" aria-label={rotulo}>
      <p className="config-previa__rotulo">
        <Icone nome="eye" tamanho={14} />
        {rotulo}
      </p>
      <div className="config-previa__conteudo" aria-live="polite">
        {children}
      </div>
    </aside>
  );
}

/*
  A cor escolhida com o texto que a tela vai usar sobre ela (o modo do
  texto pesa) e a razão de contraste escrita — não só a cor do aviso.
*/
export function AvisoDeContraste({ cor, modo, comBotao = false }) {
  const avaliacao = avaliarCor(cor, modo);
  if (!avaliacao) return null;
  return (
    <div className="config-contraste ui-campo-largo">
      <div
        className="config-contraste__previa"
        style={{ background: avaliacao.cor, color: avaliacao.corDoTexto }}
      >
        <strong>{DEFAULT_ACCESS_BRANDING.greeting}</strong>
        {comBotao ? (
          <span className="config-contraste__botao">
            Entrar com sua conta institucional
          </span>
        ) : null}
      </div>
      <Aviso
        tom={avaliacao.passa ? "info" : "warning"}
        como="p"
        className="config-contraste__aviso"
      >
        {avaliacao.mensagem}
      </Aviso>
    </div>
  );
}

/* Imagem da prévia; se o endereço não carrega, fica a reserva. */
export function Imagem({ url, alt, className, reserva }) {
  const src = urlDeImagem(url);
  const [falhou, setFalhou] = useState("");
  if (!src || falhou === src) return reserva;
  return (
    <img
      className={className}
      src={src}
      alt={alt}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFalhou(src)}
    />
  );
}

const txt = (valor) => String(valor ?? "").trim();

/** `url("…")` para o CSSOM, sem aspas nem barras que fechem a string. */
export const fundoEmCss = (url) =>
  url ? `url("${String(url).replace(/["\\]/g, "")}")` : undefined;

/*
  A tela de acesso como ela fica: a arte de fundo, o cartão na cor do painel
  (com o texto no modo escolhido), a marca, o slogan, a saudação e o botão do
  Google — ou nenhum botão, se o login Google está desligado.
*/
export function PreviaDoAcesso({ estado }) {
  const cor = txt(estado.valor("auth_access_panel_color")) || "#c296eb";
  const corDoTexto = corDoTextoPara(
    cor,
    estado.valor("auth_access_texto_modo"),
  );
  const arte = urlDeImagem(estado.valor("auth_access_background_url"));
  const google = estado.valor("auth_google_enabled") !== "false";
  return (
    <Previa rotulo="Prévia da tela de acesso">
      <div
        className="previa-acesso"
        style={arte ? { backgroundImage: fundoEmCss(arte) } : undefined}
      >
        <div
          className="previa-acesso__cartao"
          style={{ background: cor, color: corDoTexto }}
        >
          <span className="previa-acesso__marca">
            <Imagem
              url={estado.valor("auth_access_logo_url")}
              alt="Logo no acesso"
              className="previa-acesso__logo"
              reserva={<strong>AgSUS</strong>}
            />
            <span aria-hidden="true">|</span>
            <strong>MONITORA</strong>
          </span>
          <small>Monitoramento de Processos Seletivos</small>
          <strong className="previa-acesso__saudacao">
            {txt(estado.valor("auth_access_greeting")) ||
              DEFAULT_ACCESS_BRANDING.greeting}
          </strong>
          {google ? (
            <span className="previa-acesso__google">
              <span className="previa-acesso__g" aria-hidden="true">
                G
              </span>
              {txt(estado.valor("auth_google_button_text")) ||
                "Entrar com sua conta institucional"}
            </span>
          ) : (
            <small className="previa-acesso__desligado">
              Login Google desligado
            </small>
          )}
        </div>
      </div>
    </Previa>
  );
}
