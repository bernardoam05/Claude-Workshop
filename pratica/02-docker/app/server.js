// App já feita (não precisas de mexer): o teu trabalho neste módulo é empacotá-la.
// Não tem dependências npm de propósito: fala com o Redis à mão, por TCP, para o exemplo ser pequeno.
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';

const port = Number(process.env.PORT ?? 3000);
const redisUrl = process.env.REDIS_URL ? new URL(process.env.REDIS_URL) : null;

// Envia "PING" ao Redis e espera "+PONG" (é o protocolo do Redis em texto simples).
function pingRedis() {
  return new Promise((resolve, reject) => {
    const socket = net.connect(Number(redisUrl.port || 6379), redisUrl.hostname);
    socket.setTimeout(1000, () => socket.destroy(new Error('timeout')));
    socket.once('error', reject);
    socket.once('connect', () => socket.write('PING\r\n'));
    socket.once('data', (data) => {
      socket.end();
      resolve(data.toString().trim().replace(/^\+/, ''));
    });
  });
}

http
  .createServer(async (req, res) => {
    if (req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    const body = { status: 'ok', user: os.userInfo().username };
    let status = 200;
    if (redisUrl) {
      try {
        body.redis = await pingRedis();
      } catch (err) {
        status = 503;
        body.status = 'degraded';
        body.redis = err.message;
      }
    }
    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(body));
  })
  .listen(port, () => console.log(`app a ouvir na porta ${port}`));
