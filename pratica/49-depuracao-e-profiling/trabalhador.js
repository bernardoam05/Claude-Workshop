// O código que corre dentro de cada worker (já feito: não é um exercício).
// Recebe { ms, valor, falhar } e ocupa a CPU durante `ms` milissegundos antes de responder.
import { parentPort } from 'node:worker_threads';

parentPort.on('message', ({ ms = 0, valor, falhar }) => {
  if (falhar) throw new Error(`O trabalho ${valor} falhou`);
  const fim = Date.now() + ms;
  while (Date.now() < fim);
  parentPort.postMessage(valor * 2);
});
