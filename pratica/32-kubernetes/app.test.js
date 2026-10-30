import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contentor, lerManifests, obter, seleciona } from './ajuda.js';

const app = () => {
  const objetos = lerManifests('app.yaml');
  return { dep: obter(objetos, 'Deployment', 'notas'), svc: obter(objetos, 'Service', 'notas') };
};

describe('P1 · app.yaml', () => {
  it('Deployment "notas" (apps/v1) com 2 réplicas e uma imagem com versão', () => {
    const { dep } = app();
    assert.equal(dep.apiVersion, 'apps/v1');
    assert.equal(dep.spec?.replicas, 2);
    const imagem = contentor(dep.spec?.template?.spec).image;
    assert.equal(imagem, 'workshop/notas:1.0.0');
  });

  it('o selector do Deployment escolhe as labels dos pods que ele próprio cria', () => {
    const { dep } = app();
    const labels = dep.spec?.template?.metadata?.labels;
    assert.deepEqual(labels, { app: 'notas' });
    assert.ok(
      seleciona(dep.spec?.selector?.matchLabels, labels),
      'spec.selector.matchLabels tem de coincidir com spec.template.metadata.labels (senão o kubectl apply recusa)',
    );
  });

  it('o contentor expõe a porta 3000 com o nome "http"', () => {
    const c = contentor(app().dep.spec?.template?.spec);
    assert.deepEqual(c.ports, [{ name: 'http', containerPort: 3000 }]);
  });

  it('readiness com GET /health; liveness só com tcpSocket (barata, não depende da BD)', () => {
    const c = contentor(app().dep.spec?.template?.spec);
    assert.equal(c.readinessProbe?.httpGet?.path, '/health');
    assert.equal(c.readinessProbe?.httpGet?.port, 'http');
    assert.equal(c.livenessProbe?.tcpSocket?.port, 'http');
    assert.equal(c.livenessProbe?.httpGet, undefined, 'a liveness não deve chamar o /health (porquê? secção 6)');
  });

  it('requests e limits de CPU e memória', () => {
    const { resources } = contentor(app().dep.spec?.template?.spec);
    assert.deepEqual(resources, {
      requests: { cpu: '100m', memory: '64Mi' },
      limits: { cpu: '500m', memory: '128Mi' },
    });
  });

  it('Service ClusterIP: porta 80 → porta "http" dos pods app: notas', () => {
    const { dep, svc } = app();
    assert.equal(svc.apiVersion, 'v1');
    assert.equal(svc.spec?.type ?? 'ClusterIP', 'ClusterIP');
    assert.ok(seleciona(svc.spec?.selector, dep.spec?.template?.metadata?.labels), 'o selector do Service não escolhe os pods do Deployment');
    assert.equal(svc.spec?.ports?.length, 1);
    assert.equal(svc.spec.ports[0].port, 80);
    assert.equal(svc.spec.ports[0].targetPort, 'http', 'usa o NOME da porta: se o número mudar no contentor, o Service continua certo');
  });
});
