import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { lerManifests, obter, seleciona } from './ajuda.js';

const objetos = () => lerManifests('exposicao-e-escala.yaml');

describe('P3 · exposicao-e-escala.yaml', () => {
  it('Ingress: notas.local, prefixo /, para o Service "notas" na porta 80', () => {
    const ing = obter(objetos(), 'Ingress', 'notas');
    assert.equal(ing.apiVersion, 'networking.k8s.io/v1');
    assert.equal(ing.spec?.ingressClassName, 'nginx');
    const regra = ing.spec?.rules?.[0];
    assert.equal(regra?.host, 'notas.local');
    const caminho = regra?.http?.paths?.[0];
    assert.equal(caminho?.path, '/');
    assert.equal(caminho?.pathType, 'Prefix');
    assert.deepEqual(caminho?.backend, { service: { name: 'notas', port: { number: 80 } } });
  });

  it('o Ingress aponta para um Service e uma porta que existem mesmo no app.yaml', () => {
    const svc = obter(lerManifests('app.yaml'), 'Service', 'notas');
    const alvo = obter(objetos(), 'Ingress', 'notas').spec?.rules?.[0]?.http?.paths?.[0]?.backend?.service;
    assert.equal(alvo?.name, svc.metadata.name);
    assert.ok(svc.spec?.ports?.some((p) => p.port === alvo?.port?.number), 'essa porta não existe no Service');
  });

  it('HPA (autoscaling/v2): Deployment "notas" entre 2 e 6 réplicas, CPU a 70%', () => {
    const hpa = obter(objetos(), 'HorizontalPodAutoscaler', 'notas');
    assert.equal(hpa.apiVersion, 'autoscaling/v2');
    assert.deepEqual(hpa.spec?.scaleTargetRef, { apiVersion: 'apps/v1', kind: 'Deployment', name: 'notas' });
    assert.equal(hpa.spec?.minReplicas, 2);
    assert.equal(hpa.spec?.maxReplicas, 6);
    assert.deepEqual(hpa.spec?.metrics, [
      { type: 'Resource', resource: { name: 'cpu', target: { type: 'Utilization', averageUtilization: 70 } } },
    ]);
  });

  it('o HPA só funciona porque o Deployment tem requests de CPU (a percentagem é sobre eles)', () => {
    const dep = obter(lerManifests('app.yaml'), 'Deployment', 'notas');
    assert.ok(dep.spec?.template?.spec?.containers?.[0]?.resources?.requests?.cpu, 'faz primeiro o P1');
  });

  it('PodDisruptionBudget: pelo menos 1 pod app: notas sempre de pé', () => {
    const pdb = obter(objetos(), 'PodDisruptionBudget', 'notas');
    assert.equal(pdb.apiVersion, 'policy/v1');
    assert.equal(pdb.spec?.minAvailable, 1);
    const dep = obter(lerManifests('app.yaml'), 'Deployment', 'notas');
    assert.ok(seleciona(pdb.spec?.selector?.matchLabels, dep.spec?.template?.metadata?.labels), 'o PDB não escolhe os pods do Deployment');
  });
});
