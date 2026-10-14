// Já feito: um backend "eco" para os testes. Responde com JSON a dizer QUEM respondeu (NOME),
// que caminho recebeu e com que cabeçalhos. É assim que se vê o que o Nginx encaminhou.
import http from 'node:http';

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ servico: process.env.NOME, caminho: req.url, cabecalhos: req.headers }));
  })
  .listen(3000, () => console.log(`${process.env.NOME} a ouvir na porta 3000`));
