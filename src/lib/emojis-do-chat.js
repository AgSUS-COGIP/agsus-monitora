/*
  Emojis do seletor do chat (src/modulos/chat/seletor-de-emoji.jsx), sem
  biblioteca: uma lista própria com os mais comuns no trabalho, em categorias,
  com nome e palavras em português para a busca. Os emojis são texto Unicode:
  entram no campo como qualquer letra e o banco guarda como texto.

  "Recentes" ficam no navegador (localStorage), com try/catch: navegador sem
  armazenamento só não lembra.
*/

const texto = (valor) => (typeof valor === "string" ? valor : "");
const semAcento = (valor) =>
  texto(valor).normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("pt-BR");

/* [emoji, nome, outras palavras para a busca] */
const CARINHAS = [
  ["😀", "sorriso", "feliz alegre"],
  ["😃", "sorriso aberto", "feliz alegre"],
  ["😄", "sorriso com olhos felizes", "feliz alegre"],
  ["😁", "sorriso largo", "dentes feliz"],
  ["😆", "rindo", "risada"],
  ["😅", "riso nervoso", "suor alivio"],
  ["😂", "chorando de rir", "risada kkk"],
  ["🤣", "rolando de rir", "risada kkk"],
  ["😊", "sorriso tímido", "feliz corado"],
  ["🙂", "sorriso leve", "ok"],
  ["😉", "piscadela", "piscando"],
  ["😍", "apaixonado", "olhos de coracao amor"],
  ["🥰", "carinho", "amor coracoes"],
  ["😘", "beijo", "mandando beijo"],
  ["😎", "óculos escuros", "legal tranquilo"],
  ["🤩", "deslumbrado", "estrelas incrivel"],
  ["🥳", "festa", "comemoracao parabens"],
  ["🤔", "pensando", "duvida hmm"],
  ["🤨", "desconfiado", "sobrancelha"],
  ["😐", "neutro", "sem expressao"],
  ["😶", "sem palavras", "calado"],
  ["🙄", "revirando os olhos", "tedio"],
  ["😏", "sorriso de lado", "malicia"],
  ["😴", "dormindo", "sono cansado"],
  ["😌", "aliviado", "calmo"],
  ["😜", "brincalhão", "lingua piscando"],
  ["🤪", "maluco", "doido"],
  ["😬", "constrangido", "dentes careta"],
  ["😮", "surpreso", "boca aberta"],
  ["😲", "espantado", "chocado"],
  ["😳", "envergonhado", "corado"],
  ["🥺", "pidão", "por favor olhos"],
  ["😢", "triste", "lagrima"],
  ["😭", "chorando", "choro"],
  ["😤", "bufando", "frustrado"],
  ["😠", "bravo", "irritado"],
  ["😡", "furioso", "raiva"],
  ["🤯", "cabeça explodindo", "chocado"],
  ["😱", "assustado", "medo grito"],
  ["😓", "suando frio", "preocupado"],
  ["🤗", "abraço", "acolhimento"],
  ["🤭", "mão na boca", "risadinha ops"],
  ["🤫", "silêncio", "segredo psiu"],
  ["🫡", "continência", "sim senhor entendido"],
];

const GESTOS = [
  ["👍", "joinha", "positivo ok curti"],
  ["👎", "negativo", "nao"],
  ["👌", "ok", "perfeito"],
  ["✌️", "paz", "vitoria"],
  ["🤞", "dedos cruzados", "torcendo sorte"],
  ["🤝", "aperto de mãos", "acordo parceria"],
  ["👏", "palmas", "aplausos parabens"],
  ["🙌", "mãos para cima", "comemorar viva"],
  ["🙏", "por favor", "obrigado agradecer reza"],
  ["💪", "força", "forte"],
  ["👋", "tchau", "oi aceno ola"],
  ["🤙", "me liga", "valeu"],
  ["👊", "soquinho", "punho"],
  ["✊", "punho erguido", "luta"],
  ["👉", "apontando para a direita", "seta"],
  ["👈", "apontando para a esquerda", "seta"],
  ["👆", "apontando para cima", "seta"],
  ["👇", "apontando para baixo", "seta"],
  ["☝️", "um minuto", "atencao dedo"],
  ["✋", "pare", "mao espera"],
  ["🫶", "mãos de coração", "amor carinho"],
  ["🤲", "mãos abertas", "oferecer"],
  ["🙋", "levantando a mão", "eu pergunta"],
  ["🤷", "dar de ombros", "nao sei"],
  ["🙆", "tudo certo", "ok"],
  ["🙅", "não pode", "nao proibido"],
  ["👀", "olhos", "vendo olhando de olho"],
];

const TRABALHO = [
  ["💼", "maleta", "trabalho"],
  ["📁", "pasta", "arquivo"],
  ["📂", "pasta aberta", "arquivo"],
  ["🗂️", "fichário", "divisorias organizar"],
  ["📄", "documento", "pagina folha"],
  ["📃", "página", "documento"],
  ["📑", "marcadores", "documento abas"],
  ["📊", "gráfico de barras", "dados relatorio"],
  ["📈", "gráfico subindo", "crescimento alta"],
  ["📉", "gráfico descendo", "queda baixa"],
  ["📋", "prancheta", "lista checklist"],
  ["📌", "alfinete", "fixar importante"],
  ["📍", "local", "alfinete mapa"],
  ["📎", "clipe", "anexo"],
  ["🖇️", "clipes", "anexos"],
  ["✏️", "lápis", "editar escrever"],
  ["🖊️", "caneta", "assinar"],
  ["📝", "anotação", "nota escrever memorando"],
  ["📅", "calendário", "data agenda"],
  ["📆", "calendário de folhas", "data agenda"],
  ["🗓️", "agenda", "calendario espiral"],
  ["⏰", "despertador", "hora alarme prazo"],
  ["⏳", "ampulheta", "aguardando prazo"],
  ["⌛", "tempo esgotado", "ampulheta prazo"],
  ["💻", "notebook", "computador"],
  ["🖥️", "computador", "monitor tela"],
  ["🖨️", "impressora", "imprimir"],
  ["📱", "celular", "telefone"],
  ["☎️", "telefone", "ligar"],
  ["📞", "fone", "ligacao telefone"],
  ["📧", "e-mail", "email correio"],
  ["✉️", "envelope", "carta email"],
  ["📨", "mensagem recebida", "email"],
  ["📬", "caixa de correio", "correspondencia"],
  ["🔍", "lupa", "buscar procurar"],
  ["💡", "ideia", "lampada"],
  ["🔒", "cadeado", "seguro bloqueado"],
  ["🔑", "chave", "acesso senha"],
  ["🏥", "hospital", "saude"],
  ["🩺", "estetoscópio", "medico saude"],
  ["💊", "remédio", "medicamento"],
  ["☕", "café", "pausa"],
];

const SIMBOLOS = [
  ["✅", "feito", "ok concluido certo check"],
  ["☑️", "marcado", "caixa check"],
  ["✔️", "certo", "check visto"],
  ["❌", "errado", "x nao cancelado"],
  ["❎", "x quadrado", "cancelar"],
  ["⚠️", "atenção", "aviso alerta cuidado"],
  ["🚫", "proibido", "bloqueado nao"],
  ["⛔", "entrada proibida", "pare"],
  ["❗", "exclamação", "importante"],
  ["❓", "pergunta", "interrogacao duvida"],
  ["‼️", "exclamação dupla", "urgente"],
  ["💯", "cem", "perfeito nota"],
  ["🔴", "círculo vermelho", "parado urgente"],
  ["🟠", "círculo laranja", "atencao"],
  ["🟡", "círculo amarelo", "pendente"],
  ["🟢", "círculo verde", "ok liberado"],
  ["🔵", "círculo azul", "info"],
  ["⚪", "círculo branco", ""],
  ["⚫", "círculo preto", ""],
  ["⭐", "estrela", "favorito destaque"],
  ["🌟", "estrela brilhante", "destaque"],
  ["✨", "brilho", "novo"],
  ["🔥", "fogo", "urgente quente"],
  ["❤️", "coração", "amor"],
  ["🧡", "coração laranja", "amor"],
  ["💛", "coração amarelo", "amor"],
  ["💚", "coração verde", "amor"],
  ["💙", "coração azul", "amor"],
  ["💜", "coração roxo", "amor"],
  ["➡️", "seta para a direita", "proximo"],
  ["⬅️", "seta para a esquerda", "voltar"],
  ["⬆️", "seta para cima", "subir"],
  ["⬇️", "seta para baixo", "descer"],
  ["🔄", "atualizar", "recarregar setas"],
  ["🆕", "novo", "new"],
  ["🆗", "ok", ""],
];

const CELEBRACAO = [
  ["🎉", "comemoração", "festa parabens confete"],
  ["🎊", "confete", "festa"],
  ["🎂", "bolo de aniversário", "parabens"],
  ["🎁", "presente", "aniversario"],
  ["🏆", "troféu", "vitoria campeao"],
  ["🥇", "medalha de ouro", "primeiro lugar"],
  ["🚀", "foguete", "lancamento rapido"],
  ["☀️", "sol", "bom dia"],
  ["🌧️", "chuva", "tempo"],
  ["🌈", "arco-íris", ""],
  ["🌱", "broto", "inicio crescimento"],
  ["🌻", "girassol", "flor"],
  ["🍰", "bolo", "lanche"],
  ["🇧🇷", "Brasil", "bandeira"],
];

function categoria(id, rotulo, lista) {
  return Object.freeze({
    id,
    rotulo,
    emojis: Object.freeze(
      lista.map(([emoji, nome, palavras]) =>
        Object.freeze({
          emoji,
          nome,
          busca: semAcento(`${nome} ${palavras}`),
        }),
      ),
    ),
  });
}

/** As categorias do seletor, na ordem das abas. */
export const CATEGORIAS_DE_EMOJI = Object.freeze([
  categoria("carinhas", "Carinhas", CARINHAS),
  categoria("gestos", "Gestos", GESTOS),
  categoria("trabalho", "Trabalho", TRABALHO),
  categoria("simbolos", "Símbolos", SIMBOLOS),
  categoria("celebracao", "Celebração", CELEBRACAO),
]);

const TODOS = CATEGORIAS_DE_EMOJI.flatMap((c) => c.emojis);
const POR_EMOJI = new Map(TODOS.map((item) => [item.emoji, item]));

/** Quantos emojis há na lista (o seletor tem ~150). */
export const TOTAL_DE_EMOJIS = TODOS.length;

/** O nome de um emoji da lista ("joinha"); fora dela, o próprio emoji. */
export function nomeDoEmoji(emoji) {
  return POR_EMOJI.get(emoji)?.nome || texto(emoji);
}

/**
 * Busca por nome ou palavra em português, sem diferenciar acento e
 * maiúsculas; todas as palavras do termo têm de aparecer. Termo vazio → [].
 */
export function buscarEmojis(termo, limite = 60) {
  const partes = semAcento(termo).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return [];
  return TODOS.filter((item) =>
    partes.every((parte) => item.busca.includes(parte)),
  ).slice(0, limite);
}

export const CHAVE_DOS_RECENTES = "monitora.chat.emojis-recentes";
export const MAXIMO_DE_RECENTES = 18;

/** O emoji usado vai para o começo, sem repetir, até o máximo. */
export function comRecente(recentes, emoji, maximo = MAXIMO_DE_RECENTES) {
  const lista = Array.isArray(recentes) ? recentes : [];
  if (!texto(emoji)) return lista.slice(0, maximo);
  return [emoji, ...lista.filter((e) => e !== emoji)].slice(0, maximo);
}

/** Recentes guardados no navegador (só emojis da lista); sem armazenamento → []. */
export function lerRecentes(armazenamento) {
  try {
    const salvo = JSON.parse(
      armazenamento?.getItem(CHAVE_DOS_RECENTES) || "[]",
    );
    return Array.isArray(salvo)
      ? salvo.filter((e) => POR_EMOJI.has(e)).slice(0, MAXIMO_DE_RECENTES)
      : [];
  } catch {
    return [];
  }
}

/** Guarda o emoji usado nos recentes e devolve a lista nova. */
export function guardarRecente(armazenamento, emoji) {
  const lista = comRecente(lerRecentes(armazenamento), emoji);
  try {
    armazenamento?.setItem(CHAVE_DOS_RECENTES, JSON.stringify(lista));
  } catch {
    /* navegador sem armazenamento: vale só nesta visita */
  }
  return lista;
}

/** Os itens (emoji e nome) dos recentes, para desenhar. */
export function itensDosRecentes(recentes) {
  return (Array.isArray(recentes) ? recentes : [])
    .map((e) => POR_EMOJI.get(e))
    .filter(Boolean);
}
