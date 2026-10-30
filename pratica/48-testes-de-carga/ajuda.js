// Corre os teus scripts do k6 (na imagem Docker oficial) contra a API em servidor.js.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import { criarServidor } from './servidor.js';

const IMAGEM = 'grafana/k6:2.3.0';
export const temDocker = spawnSync('docker', ['info'], { stdio: 'ignore' }).status === 0;

// O contentor do k6 chega ao teu computador pelo nome host.docker.internal. Com o Docker Desktop, isso
// chega a 127.0.0.1; com o Docker nativo em Linux, chega à ponte docker0, e o servidor tem de ouvir
// nesse IP (e não em 0.0.0.0, que o abriria à tua rede local).
function enderecoParaOuvir() {
  const so = spawnSync('docker', ['info', '--format', '{{.OperatingSystem}}'], { encoding: 'utf8' }).stdout.trim();
  if (so === 'Docker Desktop') return '127.0.0.1';
  const ponte = spawnSync('docker', ['network', 'inspect', 'bridge', '--format', '{{(index .IPAM.Config 0).Gateway}}'], { encoding: 'utf8' });
  return ponte.status === 0 && ponte.stdout.trim() ? ponte.stdout.trim() : '127.0.0.1';
}

export async function arrancarApi(opcoes) {
  const { servidor, pedidos } = criarServidor(opcoes);
  servidor.listen(0, enderecoParaOuvir());
  await once(servidor, 'listening');
  return {
    baseUrl: `http://host.docker.internal:${servidor.address().port}`,
    local: `http://${servidor.address().address}:${servidor.address().port}`,
    pedidos,
    fechar: () => servidor.close(),
  };
}

export function comecado(nome) {
  return readFileSync(new URL(nome, import.meta.url), 'utf8')
    .split('\n')
    .some((l) => l.trim() && !l.trim().startsWith('//'));
}

// correrK6("carga-basica.js", { BASE_URL }) → { codigo, resumo, stderr }
//   codigo: 0 se tudo passou, 99 se algum threshold falhou
//   resumo: os dados do fim do teste (as métricas, com os thresholds e se passaram)
export async function correrK6(nome, env) {
  assert.ok(comecado(nome), `ainda não começaste o ${nome}`);
  const args = ['run', '--rm', '-i', '--add-host=host.docker.internal:host-gateway'];
  for (const [k, v] of Object.entries(env)) args.push('-e', `${k}=${v}`);
  args.push(IMAGEM, 'run', '--quiet', '--no-color', '-');
  const p = spawn('docker', args);
  let stdout = '';
  let stderr = '';
  p.stdout.on('data', (d) => (stdout += d));
  p.stderr.on('data', (d) => (stderr += d));
  // O script vai pelo stdin, com um handleSummary acrescentado no fim, para o resumo vir em JSON.
  const script = readFileSync(new URL(nome, import.meta.url), 'utf8');
  p.stdin.end(`${script}\nexport function handleSummary(data) { return { stdout: JSON.stringify(data) }; }\n`);
  const [codigo] = await once(p, 'close');
  let resumo = null;
  try {
    resumo = JSON.parse(stdout);
  } catch {}
  assert.ok(resumo, `o k6 não chegou ao fim do teste (código ${codigo}):\n${stderr.slice(-1500)}`);
  return { codigo, resumo, stderr };
}

// Os thresholds de uma métrica, como { "p(95)<300": true } (true = passou).
export const thresholds = (resumo, metrica) =>
  Object.fromEntries(Object.entries(resumo.metrics[metrica]?.thresholds ?? {}).map(([k, v]) => [k, v.ok]));
