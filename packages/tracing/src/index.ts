import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";

// The service name is used to identify a specific service in the trace data
const serviceName = process.env.SERVICE_NAME || "unknown-service";
// Use environment variable for Jaeger endpoint, default to Docker service name
const jaegerEndpoint =
  process.env.JAEGER_ENDPOINT || "http://jaeger:4318/v1/traces";

const sdk = new NodeSDK({
  resource: new Resource({
    [ATTR_SERVICE_NAME]: serviceName,
  }),
  // The trace exporter sends the data to Jaeger
  traceExporter: new OTLPTraceExporter({
    url: jaegerEndpoint, // Jaeger's OTLP endpoint
  }),
  // This is the magic part: it automatically instruments popular libraries
  // like Express, pg (PostgreSQL), and axios.
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();

console.log(`✅ OpenTelemetry tracing enabled for [${serviceName}]`);
