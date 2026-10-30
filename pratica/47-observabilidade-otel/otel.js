// A configuração do OpenTelemetry para os testes (já feita: lê-a, é o que farias no arranque de uma app).
//   - um TracerProvider que guarda os spans terminados em memória (InMemorySpanExporter), para os
//     testes os poderem ler; numa app, seria um exportador OTLP para o Jaeger, o Tempo ou outro
//   - um gestor de contexto com AsyncLocalStorage: é o que faz o "span ativo" seguir o código através
//     dos await, sem o passares à mão de função em função
//   - o propagador W3C Trace Context: lê e escreve o cabeçalho traceparent nos pedidos HTTP
import { context, propagation, trace } from '@opentelemetry/api';
import { AsyncLocalStorageContextManager } from '@opentelemetry/context-async-hooks';
import { W3CTraceContextPropagator } from '@opentelemetry/core';
import { BasicTracerProvider, InMemorySpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';

export const exportador = new InMemorySpanExporter();
trace.setGlobalTracerProvider(new BasicTracerProvider({ spanProcessors: [new SimpleSpanProcessor(exportador)] }));
context.setGlobalContextManager(new AsyncLocalStorageContextManager().enable());
propagation.setGlobalPropagator(new W3CTraceContextPropagator());

// Os spans terminados, simplificados para os testes.
export function spans() {
  return exportador.getFinishedSpans().map((s) => ({
    nome: s.name,
    traceId: s.spanContext().traceId,
    spanId: s.spanContext().spanId,
    pai: s.parentSpanContext?.spanId ?? null,
    atributos: s.attributes,
    estado: s.status,
    eventos: s.events.map((e) => e.name),
  }));
}
export const limpar = () => exportador.reset();
