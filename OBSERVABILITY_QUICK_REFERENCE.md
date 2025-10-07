# 🎯 Observability Quick Reference Card

**Keep this handy!** Quick answers to "Where do I look?"

---

## 🔍 The Simple Rule

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│  METRICS = What & How Much  (Prometheus/Grafana)   │
│  TRACES  = Where & When     (Jaeger)                │
│  LOGS    = Why & Details    (Pino/Terminal)         │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Where to Look

| Your Question                   | Go To              | URL                             |
| ------------------------------- | ------------------ | ------------------------------- |
| **"Show me a dashboard"**       | Grafana            | http://localhost:3009           |
| **"How many requests/sec?"**    | Prometheus         | http://localhost:9090           |
| **"What's my cache hit rate?"** | Prometheus/Grafana | Query: `cache_hits_total`       |
| **"Why is THIS request slow?"** | Jaeger             | http://localhost:16686          |
| **"Which service failed?"**     | Jaeger             | Filter by `error=true`          |
| **"What's the exact error?"**   | Logs               | `docker compose logs <service>` |
| **"Is Redis healthy?"**         | Health endpoint    | `curl localhost:5002/health`    |
| **"Set up alerts"**             | Grafana            | Alerting tab in panels          |

---

## 🚀 Common Commands

### View Metrics

```bash
# Open Prometheus
open http://localhost:9090

# Query cache hit rate
# rate(cache_hits_total[5m])

# Open Grafana dashboard
open http://localhost:3009  # admin/admin
```

### View Traces

```bash
# Open Jaeger
open http://localhost:16686

# 1. Select service (api-gateway, post-service, etc.)
# 2. Click "Find Traces"
# 3. Click on a trace to see waterfall view
```

### View Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f post-service

# Filter for errors
docker compose logs post-service | grep -i error

# Filter for cache operations
docker compose logs post-service | grep -i cache

# Search for specific request
docker compose logs api-gateway | grep "POST /api/posts"
```

---

## 🎯 Debugging Workflow

### When something is slow:

```
1. Prometheus → Check if it's a trend (query P95 latency)
2. Jaeger → Find a slow trace from that time
3. Jaeger → Look at waterfall, find bottleneck
4. Logs → Get detailed error if any
```

### When something errors:

```
1. Logs → Get error message immediately
2. Jaeger → Find the exact request trace (filter error=true)
3. Prometheus → Check if many users affected (error rate)
4. Grafana → Create alert to catch it next time
```

---

## 📈 Useful Prometheus Queries

```promql
# Request rate (requests per second)
rate(http_request_duration_ms_count[1m])

# Cache hit rate (percentage)
(sum(rate(cache_hits_total[5m])) /
 (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))) * 100

# P95 latency (95% of requests complete within this time)
histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))

# Error rate (5xx responses)
sum(rate(http_request_duration_ms_count{code=~"5.."}[5m]))

# Total requests across all services
sum(rate(http_request_duration_ms_count[1m]))
```

---

## 🏥 Health Checks

```bash
# Check all services
docker compose ps

# API Gateway health
curl http://localhost:5000/health

# Post Service health (includes Redis status)
curl http://localhost:5002/health

# Auth Service health
curl http://localhost:5001/health

# Check Redis
docker compose exec redis redis-cli ping
# Expected: PONG
```

---

## 📊 Your First Grafana Dashboard

**Create "System Health" dashboard:**

1. Go to http://localhost:3009 (admin/admin)
2. Click "+" → "Dashboard"
3. Add panels with these queries:

```
Panel 1: Request Rate
Query: sum(rate(http_request_duration_ms_count[1m]))

Panel 2: Cache Hit Rate
Query: (sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))) * 100

Panel 3: P95 Latency
Query: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))

Panel 4: Error Rate
Query: sum(rate(http_request_duration_ms_count{code=~"5.."}[5m]))
```

---

## 🎯 Remember

- **Daily monitoring?** → Use Grafana dashboards
- **Something wrong now?** → Check Logs first
- **Need to debug a request?** → Use Jaeger
- **Want to query data?** → Use Prometheus

**Full guide:** [OBSERVABILITY_GUIDE.md](./OBSERVABILITY_GUIDE.md)

---

## 🔗 Quick Links

- **Grafana**: http://localhost:3009 (admin/admin)
- **Prometheus**: http://localhost:9090
- **Jaeger**: http://localhost:16686
- **RabbitMQ**: http://localhost:15672 (guest/guest)
- **API Gateway**: http://localhost:5000
- **Frontend**: http://localhost:5173

