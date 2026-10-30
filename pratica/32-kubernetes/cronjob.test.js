import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { contentor, lerManifests, obter } from './ajuda.js';

const cron = () => obter(lerManifests('cronjob.yaml'), 'CronJob', 'limpeza');

describe('P4 · cronjob.yaml', () => {
  it('CronJob (batch/v1) todos os dias às 03:00', () => {
    const c = cron();
    assert.equal(c.apiVersion, 'batch/v1');
    assert.equal(c.spec?.schedule, '0 3 * * *', 'formato cron: minuto hora dia-do-mês mês dia-da-semana');
  });

  it('nunca duas limpezas ao mesmo tempo, e histórico de 3 sucessos e 1 falha', () => {
    const { spec } = cron();
    assert.equal(spec?.concurrencyPolicy, 'Forbid');
    assert.equal(spec?.successfulJobsHistoryLimit, 3);
    assert.equal(spec?.failedJobsHistoryLimit, 1);
  });

  it('cada execução: 2 tentativas no máximo, e morta ao fim de 10 minutos', () => {
    const job = cron().spec?.jobTemplate?.spec;
    assert.equal(job?.backoffLimit, 2);
    assert.equal(job?.activeDeadlineSeconds, 600);
  });

  it('o pod corre a limpeza e recomeça o contentor em caso de erro', () => {
    const pod = cron().spec?.jobTemplate?.spec?.template?.spec;
    assert.equal(pod?.restartPolicy, 'OnFailure', 'num Job, o restartPolicy tem de ser OnFailure ou Never (Always não é aceite)');
    const c = contentor(pod);
    assert.equal(c.image, 'workshop/notas:1.0.0');
    assert.deepEqual(c.command, ['node', 'limpeza.js', '--dias=30']);
  });
});
