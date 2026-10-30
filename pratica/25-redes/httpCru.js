// P3 · Um cliente HTTP/1.1 escrito à mão, sobre uma ligação TCP (node:net). Sem fetch, sem http.
import net from 'node:net';

// pedir({ host, porta, caminho, metodo = "GET", cabecalhos = {}, corpo })
//   → Promise<{ status, cabecalhos, corpo }>
//
// 1. Abre uma ligação TCP (net.connect) e escreve o pedido em texto:
//      GET /caminho HTTP/1.1\r\n
//      Host: host:porta\r\n
//      Connection: close\r\n          (pede ao servidor que feche a ligação no fim)
//      <os teus cabeçalhos>\r\n
//      Content-Length: <bytes do corpo>\r\n   (só se houver corpo)
//      \r\n
//      <corpo>
// 2. Junta TODOS os bytes que chegarem até a ligação fechar.
// 3. Separa o cabeçalho do corpo pela primeira linha em branco (\r\n\r\n). A primeira linha é
//    "HTTP/1.1 200 OK": o status é o número. Os nomes dos cabeçalhos ficam em minúsculas.
// 4. Se a resposta tiver "transfer-encoding: chunked", o corpo vem aos pedaços:
//      <tamanho em HEXADECIMAL>\r\n<bytes>\r\n ... 0\r\n\r\n
//    e tens de os juntar. Senão, o corpo é o que vem a seguir ao cabeçalho.
// O corpo devolvido é uma string (UTF-8). Atenção: o Content-Length conta BYTES, não caracteres.
export function pedir({ host, porta, caminho, metodo = 'GET', cabecalhos = {}, corpo }) {
  throw new Error('Por fazer: P3');
}
