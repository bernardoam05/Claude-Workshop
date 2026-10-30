// P4 · Path traversal e SSRF: quando o utilizador escolhe um ficheiro ou um URL.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

// lerAnexo(pasta, nome): lê um anexo que está DENTRO de "pasta".
// Corrige: um nome como "../../etc/passwd" (ou um caminho absoluto) não pode sair da pasta.
// Nesse caso, lança um Error cuja mensagem contém "anexo".
export async function lerAnexo(pasta, nome) {
  return readFile(join(pasta, nome), 'utf8');
}

// validarUrlExterna(texto): o servidor vai descarregar a imagem de pré-visualização deste URL.
// Devolve o URL (objeto URL) se for seguro; lança um Error cuja mensagem contém "URL" se não for.
// Corrige. Só são aceites URLs que:
//   - sejam https:
//   - não apontem para a própria máquina nem para a rede interna: "localhost", e IPs
//     127.x.x.x, 10.x.x.x, 172.16–31.x.x, 192.168.x.x, 169.254.x.x (o endereço dos metadados da
//     cloud!), 0.0.0.0 e [::1]
export function validarUrlExterna(texto) {
  return new URL(texto);
}
