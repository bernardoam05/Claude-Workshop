// Não mexas aqui. Os teus testes importam o código através desta função, e não diretamente,
// para o verificador conseguir trocar o código verdadeiro por um "mutante" (uma cópia com um bug).
//   const { estadoDaTarefa } = await carregar('prazos');
export async function carregar(nome) {
  const mutante = process.env.MUTANTE; // ex.: 'prazos-3', posto pelo verificar.mjs
  const caminho = mutante?.startsWith(`${nome}-`) ? `./mutantes/${mutante}.js` : `./${nome}.js`;
  return import(caminho);
}
