// P3 · ReBAC: permissões a partir de relações (o modelo do Zanzibar da Google, do SpiceDB e do OpenFGA).
//
// Tuplos: 'objeto#relacao@sujeito', em que o sujeito é um utilizador ('utilizador:ana') ou um
// conjunto ('grupo:eng#membro' = todos os membros do grupo eng). Exemplos:
//   'documento:d1#dono@utilizador:ana'      a Ana é dona do d1
//   'grupo:eng#membro@utilizador:rui'        o Rui é membro do grupo eng
//   'pasta:p1#leitor@grupo:eng#membro'       os membros do eng são leitores da p1
//   'documento:d1#pai@pasta:p1'              o d1 está dentro da p1
// Modelo: por tipo, cada relação diz de onde MAIS vem (além dos tuplos diretos):
//   { documento: { dono: [], editor: ['dono'], leitor: ['editor', 'pai->leitor'] }, ... }
//   'editor'      → quem é editor do mesmo objeto também é leitor
//   'pai->leitor' → para cada X com objeto#pai@X, quem é leitor de X também é leitor deste

// criarReBAC(modelo, tuplos) → { verificar(objeto, relacao, sujeito), listar(tipo, relacao, sujeito) }
//   verificar → true/false (cuidado com os ciclos: um conjunto que já está a ser verificado não se
//     volta a verificar). Uma relação que não existe no modelo para esse tipo → lança Error.
//   listar → os objetos desse tipo (os que aparecem nos tuplos como objeto) em que o sujeito tem
//     a relação, por ordem alfabética
export function criarReBAC(modelo, tuplos) {
  throw new Error('Por fazer: P3');
}
