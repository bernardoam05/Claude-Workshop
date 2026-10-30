// P3 · Um chat com salas, sobre WebSockets (biblioteca ws).
import { WebSocketServer } from 'ws'; // eslint-disable-line no-unused-vars

// criarChat({ server, batimentoMs = 30000 }) → { wss, salas(), fechar() }
//   Um WebSocketServer ligado ao http.Server dado. Mensagens (JSON) de cada cliente:
//     { tipo: "entrar", sala, nome } → o cliente passa a estar nessa sala (e sai da anterior, se houver);
//        todos na sala (incluindo ele) recebem { tipo: "entrou", nome }
//     { tipo: "mensagem", texto } → todos na sala do cliente (incluindo ele) recebem
//        { tipo: "mensagem", nome, texto }
//   Erros: o próprio cliente recebe { tipo: "erro", motivo } quando:
//     - a mensagem não é JSON → motivo "json"
//     - envia "mensagem" sem ter entrado numa sala → motivo "sem-sala"
//     - o texto não é uma string de 1 a 500 caracteres → motivo "texto"
//     - o tipo é desconhecido → motivo "tipo"
//   Quando um cliente se desliga, os outros da sala recebem { tipo: "saiu", nome }.
//   Batimento: a cada batimentoMs, termina (ws.terminate()) os clientes que não responderam ao ping
//   anterior (o evento "pong"), e envia um ping novo aos restantes. É o que apanha ligações mortas que
//   nunca chegaram a fechar (o portátil fechado, o Wi-Fi que caiu).
//   salas(): um objeto { nomeDaSala: número de clientes }, só com as salas não vazias
//   fechar(): para o batimento e fecha o servidor de WebSockets
export function criarChat({ server, batimentoMs = 30000 }) {
  throw new Error('Por fazer: P3');
}
