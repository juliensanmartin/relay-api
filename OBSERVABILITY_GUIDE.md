# 🔍 Observability Stack - Where to Look for What

**The Confusion:** You have Jaeger, Prometheus, Grafana, and Pino logs. Where do you look when something goes wrong?

**The Answer:** Each tool serves a specific purpose. Here's your definitive guide.

---

## 📊 The Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────────┐
│                  YOUR OBSERVABILITY STACK                    │
├─────────────────┬─────────────────┬─────────────────────────┤
│   METRICS       │     TRACES      │        LOGS             │
│  (What & How    │   (Where &      │    (Why & Details)      │
│   Much)         │    When)        │                         │
├─────────────────┼─────────────────┼─────────────────────────┤
│  Prometheus     │     Jaeger      │      Pino               │
│  (Collect)      │   (Visualize)   │   (Raw output)          │
│       ↓         │                 │                         │
│   Grafana       │                 │                         │
│  (Visualize)    │                 │                         │
└─────────────────┴─────────────────┴─────────────────────────┘
```

---

## 🎯 Quick Decision Tree

**"Where should I look?"**

```
Is it about...

📈 PERFORMANCE & TRENDS?
   → Prometheus (http://localhost:9090) or Grafana (http://localhost:3009)
   Examples: "How many requests per second?"
             "Is cache hit rate going down?"
             "What's my P95 latency?"

🔍 A SPECIFIC REQUEST FLOW?
   → Jaeger (http://localhost:16686)
   Examples: "Why did this user's login take 5 seconds?"
             "Which service failed in this request?"
             "Where's the bottleneck in this API call?"

🐛 DEBUGGING / ERROR DETAILS?
   → Terminal logs (docker compose logs)
   Examples: "What was the exact error message?"
             "What variables were passed to this function?"
             "Did the database query succeed?"

📊 DASHBOARDS & ALERTING?
   → Grafana (http://localhost:3009)
   Examples: "I want a dashboard for my team"
             "I need alerts when cache hit rate < 50%"
             "Show me service health at a glance"
```

---

## 1️⃣ Prometheus (Port 9090) - "What & How Much?"

### **Purpose:** Collect and query numerical metrics over time

**When to use:**

- ✅ "How many cache hits happened in the last hour?"
- ✅ "What's my request rate across all services?"
- ✅ "Is my database response time increasing?"
- ✅ "What's my error rate?"

### **What it shows:**

- Counters (e.g., `cache_hits_total`, `http_requests_total`)
- Gauges (e.g., memory usage, active connections)
- Histograms (e.g., request duration buckets)
- Time-series data (trends over time)

### **URL:** http://localhost:9090

### **How to use it:**

#### Example 1: Cache Hit Rate

```promql
# Total cache hits in last 5 minutes
sum(rate(cache_hits_total[5m]))

# Total cache operations (hits + misses)
sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m]))

# Cache hit rate percentage
(sum(rate(cache_hits_total[5m])) /
 (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))) * 100
```

#### Example 2: Request Rate by Service

```promql
# Requests per second for post-service
rate(http_request_duration_ms_count{app="relay-post-service"}[1m])

# Total requests across all services
sum(rate(http_request_duration_ms_count[1m]))
```

#### Example 3: P95 Latency (95th percentile)

```promql
# 95% of requests complete within this time
histogram_quantile(0.95,
  rate(http_request_duration_ms_bucket[5m]))
```

#### Example 4: Error Rate

```promql
# Requests with 5xx status codes
sum(rate(http_request_duration_ms_count{code=~"5.."}[5m]))
```

### **Pros:**

- ✅ Powerful query language (PromQL)
- ✅ Great for trends and patterns
- ✅ Efficient time-series storage

### **Cons:**

- ❌ Not user-friendly for non-technical users
- ❌ Basic visualization (use Grafana instead)
- ❌ Doesn't show individual request details

---

## 2️⃣ Grafana (Port 3009) - "Pretty Dashboards & Alerts"

### **Purpose:** Visualize Prometheus metrics with beautiful dashboards

**When to use:**

- ✅ "I want a dashboard to monitor my services"
- ✅ "I need to show metrics to my team"
- ✅ "Alert me when something goes wrong"
- ✅ "What's the health of my system right now?"

### **What it shows:**

- Same data as Prometheus, but with:
  - Beautiful charts and graphs
  - Multiple metrics on one dashboard
  - Real-time updates
  - Alerts and notifications

### **URL:** http://localhost:3009 (admin/admin)

### **How to use it:**

#### Step 1: Create a Dashboard

1. Click "+" → "Dashboard"
2. Click "Add visualization"
3. Select "Prometheus" as data source
4. Enter a PromQL query (same as Prometheus examples above)
5. Choose visualization type (line chart, gauge, stat, etc.)

#### Example Dashboard: "Post Service Health"

**Panel 1: Request Rate**

```promql
Query: rate(http_request_duration_ms_count{app="relay-post-service"}[1m])
Visualization: Line chart
Title: "Requests per Second"
```

**Panel 2: Cache Hit Rate**

```promql
Query: (sum(rate(cache_hits_total[5m])) /
        (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))) * 100
Visualization: Gauge (0-100%)
Title: "Cache Hit Rate"
Alert: If < 50% for 5 minutes
```

**Panel 3: P95 Latency**

```promql
Query: histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))
Visualization: Line chart
Title: "95th Percentile Response Time"
Alert: If > 500ms for 5 minutes
```

**Panel 4: Active Redis Keys**

```promql
Query: redis_keys_total (if you add this metric)
Visualization: Stat
Title: "Cached Keys"
```

#### Step 2: Set Up Alerts

1. In any panel, click "Alert" tab
2. Define condition (e.g., cache hit rate < 50%)
3. Configure notification channel (Slack, email, etc.)

### **Pros:**

- ✅ Beautiful, shareable dashboards
- ✅ Great for monitoring at a glance
- ✅ Alerts and notifications
- ✅ Non-technical team members can use it

### **Cons:**

- ❌ Still shows aggregated data (not individual requests)
- ❌ Requires setup time to create dashboards

---

## 3️⃣ Jaeger (Port 16686) - "Where & When?"

### **Purpose:** Trace individual requests across multiple services

**When to use:**

- ✅ "Why is THIS specific request slow?"
- ✅ "Which service is the bottleneck?"
- ✅ "Where did this error happen in the request flow?"
- ✅ "How long did the database query take?"
- ✅ "Did the request reach all services?"

### **What it shows:**

- Complete journey of a single request
- Timeline of operations (spans)
- Service dependencies
- Latency breakdown by operation
- Errors and exceptions

### **URL:** http://localhost:16686

### **How to use it:**

#### Example 1: Debug a Slow Request

**Scenario:** User reports slow post loading

1. **Go to Jaeger UI** → http://localhost:16686
2. **Select Service:** "api-gateway"
3. **Click "Find Traces"**
4. **Look for slow traces** (duration > 500ms)
5. **Click on a trace** to see the waterfall view

**What you'll see:**

```
api-gateway (250ms total)
  ├─ POST /api/posts (5ms)
  │  └─ Authorization check (2ms)
  │
  ├─ HTTP POST to post-service (240ms)  ← BOTTLENECK!
  │  ├─ Redis GET posts:all (200ms)  ← WHY SO SLOW?
  │  └─ PostgreSQL SELECT (35ms)
  │
  └─ Response serialization (5ms)
```

**Diagnosis:** Redis operation took 200ms (should be ~5ms). Check Redis health!

#### Example 2: Find Where an Error Occurred

**Scenario:** User got 500 error

1. **Select Service:** "api-gateway"
2. **Add Tag:** `error=true`
3. **Click "Find Traces"**
4. **Click on failed trace**

**What you'll see:**

```
api-gateway (ERROR)
  └─ POST /api/posts/:id/upvote
     └─ HTTP POST to post-service (ERROR)
        └─ PostgreSQL INSERT upvotes (ERROR)
           Error: "duplicate key violation"  ← ROOT CAUSE
```

#### Example 3: Understand Service Dependencies

1. **Click "System Architecture"** tab
2. See visual graph of how services call each other
3. Identify critical paths and dependencies

### **Pros:**

- ✅ See EXACTLY what happened in a single request
- ✅ Find bottlenecks instantly
- ✅ Understand service dependencies
- ✅ Debug production issues

### **Cons:**

- ❌ Only shows individual requests (not trends)
- ❌ Requires you to find a specific trace
- ❌ Storage intensive (can't store all traces forever)

---

## 4️⃣ Pino Logs - "Why & Details?"

### **Purpose:** Detailed, structured logs for debugging

**When to use:**

- ✅ "What was the exact error message?"
- ✅ "What were the variable values?"
- ✅ "Did this function execute?"
- ✅ "What SQL query was run?"
- ✅ "What was in the request body?"

### **What it shows:**

- Structured JSON logs with context
- Debug information
- Error stack traces
- Custom log messages from your code

### **How to view:**

#### In Development:

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f post-service

# Filter for errors
docker compose logs post-service | grep -i error

# Filter for cache operations
docker compose logs post-service | grep -i cache
```

#### Example Log Output:

```json
{
  "level": 30,
  "time": 1696348800000,
  "msg": "Cache HIT",
  "key": "posts:all",
  "pid": 1,
  "hostname": "post-service"
}

{
  "level": 50,
  "time": 1696348801000,
  "msg": "Error upvoting post",
  "err": {
    "type": "DatabaseError",
    "message": "duplicate key violation",
    "stack": "..."
  },
  "postId": 123,
  "userId": 456
}
```

### **Pros:**

- ✅ Most detailed information
- ✅ Includes stack traces and error details
- ✅ Can add custom context
- ✅ Good for debugging during development

### **Cons:**

- ❌ Hard to search in production (need a log aggregator like ELK stack)
- ❌ Overwhelming amount of data
- ❌ Not good for trends or patterns

---

## 🎯 Real-World Scenarios

### Scenario 1: "My API is slow!"

**Step 1: Prometheus** → Check overall trends

```promql
histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))
```

**Finding:** P95 latency jumped from 50ms to 500ms at 2pm

**Step 2: Jaeger** → Find a slow trace from ~2pm
**Finding:** Database query taking 400ms (usually 20ms)

**Step 3: Logs** → Check database errors

```bash
docker compose logs post-service | grep -i "database"
```

**Finding:** "connection pool exhausted" errors

**Root Cause:** Database connection pool too small!

---

### Scenario 2: "Cache isn't working!"

**Step 1: Prometheus** → Check cache metrics

```promql
rate(cache_hits_total[5m])
rate(cache_misses_total[5m])
```

**Finding:** 100% cache misses

**Step 2: Logs** → Look for cache errors

```bash
docker compose logs post-service | grep -i "cache"
```

**Finding:** "Redis connection error"

**Step 3: Check Redis health**

```bash
docker compose ps redis
docker compose logs redis
```

**Root Cause:** Redis container crashed!

---

### Scenario 3: "User reported error on upvoting"

**Step 1: Jaeger** → Search for user's request

- Service: api-gateway
- Operation: POST /api/posts/:id/upvote
- Time range: Last 1 hour
- Tag: error=true

**Finding:** Request failed in post-service

**Step 2: Logs** → Get error details

```bash
docker compose logs post-service | grep -i "upvote" | grep -i "error"
```

**Finding:** "duplicate key violation" - user already upvoted

**Root Cause:** Frontend allowed double-click, should disable button!

---

## 📋 Cheat Sheet: Where to Look

| Question                            | Tool               | Query/Action                                                                   |
| ----------------------------------- | ------------------ | ------------------------------------------------------------------------------ |
| **"How many requests per second?"** | Prometheus         | `rate(http_request_duration_ms_count[1m])`                                     |
| **"What's my cache hit rate?"**     | Prometheus/Grafana | `rate(cache_hits_total) / (rate(cache_hits_total) + rate(cache_misses_total))` |
| **"Why is this request slow?"**     | Jaeger             | Find trace, look at waterfall                                                  |
| **"Where's the bottleneck?"**       | Jaeger             | Find slowest span in trace                                                     |
| **"What error occurred?"**          | Jaeger + Logs      | Find error trace, check logs for details                                       |
| **"What's the error message?"**     | Logs               | `docker compose logs <service> \| grep error`                                  |
| **"Show me a dashboard"**           | Grafana            | Create dashboard with Prometheus queries                                       |
| **"Alert me if X happens"**         | Grafana            | Set up alert rule                                                              |
| **"Is Redis healthy?"**             | Prometheus/Logs    | Check `up` metric or health check logs                                         |
| **"What's the P95 latency?"**       | Prometheus/Grafana | `histogram_quantile(0.95, rate(..._bucket[5m]))`                               |

---

## 🔄 The Workflow

**For Monitoring (Proactive):**

```
Daily: Grafana dashboards
  ↓ (notice trend)
Deep dive: Prometheus queries
  ↓ (identify time range)
Example: Jaeger trace from that time
  ↓ (find root cause)
Details: Logs
```

**For Debugging (Reactive):**

```
User reports issue
  ↓
Logs: Get error message and context
  ↓
Jaeger: Find the specific request trace
  ↓
Prometheus: Check if it's a pattern or one-off
  ↓
Grafana: Create dashboard to monitor the fix
```

---

## 🎯 Next Steps: Set Up Your First Dashboard

### Create a "System Health" Dashboard in Grafana

1. **Go to Grafana:** http://localhost:3009 (admin/admin)
2. **Click "+" → "Dashboard"**
3. **Add these panels:**

#### Panel 1: Request Rate (All Services)

- Query: `sum(rate(http_request_duration_ms_count[1m]))`
- Visualization: Line chart
- Legend: "Requests/sec"

#### Panel 2: Cache Hit Rate

- Query: `(sum(rate(cache_hits_total[5m])) / (sum(rate(cache_hits_total[5m])) + sum(rate(cache_misses_total[5m])))) * 100`
- Visualization: Gauge (0-100%)
- Thresholds: Red < 50%, Yellow 50-80%, Green > 80%

#### Panel 3: Service Status

- Query: `up{job="relay-services"}`
- Visualization: Stat
- Value: 1 = UP, 0 = DOWN

#### Panel 4: P95 Latency

- Query: `histogram_quantile(0.95, rate(http_request_duration_ms_bucket[5m]))`
- Visualization: Line chart
- Legend: "P95 Response Time (ms)"

4. **Save dashboard** as "System Health"

Now you have a single place to see your system's health at a glance! 📊

---

## 🚀 Pro Tips

1. **Start with Grafana** for daily monitoring
2. **Use Jaeger** when something goes wrong with a specific request
3. **Check Logs** when you need the full error details
4. **Use Prometheus** when you need custom queries or deeper analysis

**Remember:**

- **Metrics** = What happened (trends)
- **Traces** = Where it happened (individual requests)
- **Logs** = Why it happened (details)

---

## 📚 Further Reading

- [The Three Pillars of Observability](https://www.oreilly.com/library/view/distributed-systems-observability/9781492033431/)
- [Grafana Dashboard Best Practices](https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/best-practices/)
- [PromQL for Humans](https://prometheus.io/docs/prometheus/latest/querying/basics/)
- [Jaeger Documentation](https://www.jaegertracing.io/docs/)

---

**You now have a complete observability stack! Use it to understand your system deeply. 🔍**

