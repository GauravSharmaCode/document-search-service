
---# ARCHITECTURE.md
# Architecture Documentation

## Table of Contents
1. [System Overview](#system-overview)
2. [Component Architecture](#component-architecture)
3. [Data Flow](#data-flow)
4. [Multi-Tenancy Strategy](#multi-tenancy-strategy)
5. [Caching Strategy](#caching-strategy)
6. [Consistency Model](#consistency-model)
7. [Technology Choices](#technology-choices)

---

## System Overview

The Document Search Service is a distributed system designed to provide fast, scalable full-text search capabilities with strict multi-tenant isolation. The architecture follows a layered approach with clear separation of concerns.

### High-Level Architecture

```mermaid
graph TB
    Client[Client Applications]
    
    API[API Server<br/>Express.js + TypeScript<br/>Port 3000]
    
    PG[(PostgreSQL<br/>Source of Truth<br/>Port 5432)]
    ES[(Elasticsearch<br/>Search Index<br/>Port 9200)]
    Redis[(Redis<br/>Cache + Rate Limit<br/>Port 6379)]
    
    Client -->|HTTP| API
    
    API -->|Metadata CRUD| PG
    API -->|Search Index| ES
    API -->|Cache & Rate Limit| Redis
    
    style API fill:#2196F3
    style PG fill:#4CAF50
    style ES fill:#FFC107
    style Redis fill:#F44336
```

**Current Deployment:**
- Single API server instance (prototype)
- All services containerized via Docker Compose
- Direct service-to-service communication within Docker network

**Production Scaling (High-Level):**
- Horizontal scaling via load balancer and stateless API servers
- Elasticsearch cluster for search scalability
- PostgreSQL primary + read replicas with connection pooling
- Redis HA (Cluster or Sentinel)
- Authentication, monitoring, and alerting documented in production readiness


### Key Design Principles

1. **Separation of Concerns**: Each data store serves a specific purpose
   - PostgreSQL: Authoritative source of truth for document metadata
   - Elasticsearch: Optimized search index with fuzzy matching
   - Redis: Temporary cache and rate limiting state

2. **Stateless API Servers**: All application state stored in backing services, enabling horizontal scaling

3. **Tenant Isolation**: Mandatory tenant filtering at every layer prevents cross-tenant data leakage

4. **Graceful Degradation**: Service boots without Redis or Elasticsearch; document CRUD stays online while search surfaces 503s until dependencies recover

---

## Component Architecture

### API Layer

```
┌─────────────────────────────────────────────────────┐
│              Express Application                    │
├─────────────────────────────────────────────────────┤
│  Middleware Stack (executed in order):              │
│  1. JSON Body Parser                                │
│  2. Correlation ID Middleware                       │
│  3. Tenant ID Validation                            │
│  4. Rate Limiter (Redis-based)                      │
│  5. Route Handlers                                  │
│  6. Error Handler                                   │
└─────────────────────────────────────────────────────┘
```

**Responsibilities:**
- Request validation using Zod schemas
- Tenant identification and validation
- Rate limiting enforcement
- Request/response logging with correlation IDs
- Error handling and formatting

### Service Layer

```
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Document Service │  │  Search Service  │  │  Health Service  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                     │                      │
         ├─────────────────────┼──────────────────────┤
         │                     │                      │
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Cache Service    │  │ Repository Layer │  │  DB Clients      │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Document Service:**
- Orchestrates document lifecycle (create, read, delete)
- Coordinates writes to PostgreSQL and Elasticsearch
- Manages cache invalidation

**Search Service:**
- Handles search queries with caching
- Interfaces with Elasticsearch; returns 503 when the cluster is unavailable
- Implements pagination

**Cache Service:**
- Abstracts Redis operations (no-ops when Redis is unavailable)
- Generates consistent cache keys
- Manages TTLs and invalidation patterns

### Data Layer

**PostgreSQL Schema:**
```sql
documents (
  id UUID PRIMARY KEY,
  tenant_id VARCHAR(255) NOT NULL,
  title VARCHAR(500) NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  deleted_at TIMESTAMP  -- Soft delete
)

Indexes:
- idx_documents_tenant_id ON (tenant_id) WHERE deleted_at IS NULL
- idx_documents_tenant_deleted ON (tenant_id, deleted_at)
```

**Elasticsearch Mapping:**
```json
{
  "document_id": "keyword",
  "tenant_id": "keyword",
  "title": "text (analyzed)",
  "content": "text (analyzed)",
  "indexed_at": "date"
}
```

---

## Data Flow

### Document Indexing Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant PostgreSQL
    participant Elasticsearch
    participant Redis
    
    Client->>API: POST /v1/documents
    API->>API: Validate tenant_id
    API->>API: Validate request body
    API->>PostgreSQL: INSERT document
    PostgreSQL-->>API: Return document with ID
    API->>Elasticsearch: Index document (async)
    Elasticsearch-->>API: Acknowledge
    API-->>Client: 201 Created + document ID
```

**Steps:**
1. **Validation**: Tenant ID header and request body validated
2. **PostgreSQL Write**: Document saved to database (ACID transaction)
3. **Elasticsearch Indexing**: Document indexed for search (async, best-effort)
  4. **Cache Consistency**: No synchronous cache work; TTL handles eventual freshness
5. **Response**: Return document ID to client

**Timing:**
- Total latency: < 200ms (typical)
- Searchable within: < 5 seconds (Elasticsearch refresh interval)

### Search Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Redis
    participant Elasticsearch
    
    Client->>API: GET /v1/search?q=database
    API->>API: Validate tenant_id
    API->>Redis: Check cache (key: search:tenant:query:limit:offset)
    
    alt Cache Hit
        Redis-->>API: Return cached results
        API-->>Client: 200 OK + results (< 50ms)
    else Cache Miss
        Redis-->>API: Cache miss
        API->>Elasticsearch: Search with tenant filter + fuzzy matching
        Elasticsearch-->>API: Return results
        API->>Redis: Cache results (TTL: 300s)
        API-->>Client: 200 OK + results (< 500ms)
    end
```

**Cache Key Format:**
```
search:{tenant_id}:{query}:{limit}:{offset}
```

**Elasticsearch Query:**
```json
{
  "query": {
    "bool": {
      "must": [
        {
          "multi_match": {
            "query": "database",
            "fields": ["title^2", "content"],
            "fuzziness": "AUTO"
          }
        }
      ],
      "filter": [
        { "term": { "tenant_id": "tenant_abc" } }
      ]
    }
  }
}
```

### Document Retrieval Flow

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant Redis
    participant PostgreSQL
    
    Client->>API: GET /v1/documents/:id
    API->>API: Validate tenant_id
    API->>Redis: Check cache (key: document:tenant:id)
    
    alt Cache Hit
        Redis-->>API: Return cached document
        API-->>Client: 200 OK + document
    else Cache Miss
        Redis-->>API: Cache miss
        API->>PostgreSQL: SELECT WHERE id AND tenant_id
        PostgreSQL-->>API: Return document
        API->>Redis: Cache document (TTL: 600s)
        API-->>Client: 200 OK + document
    end
```

---

## Multi-Tenancy Strategy

### Tenant Isolation Mechanisms

**1. Header-Based Identification**
```http
X-Tenant-ID: tenant_abc
```
- Required on all API requests (except `/health`)
- Validated by middleware before route execution
- Attached to request context for downstream use

**2. Database-Level Filtering**
```sql
-- Every query includes tenant_id filter
SELECT * FROM documents 
WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
```

**3. Elasticsearch Filtering**
```json
{
  "query": {
    "bool": {
      "filter": [
        { "term": { "tenant_id": "tenant_abc" } }
      ]
    }
  }
}
```

**4. Cache Key Namespacing**
```
search:tenant_abc:database:10:0
document:tenant_abc:550e8400-e29b-41d4-a716-446655440000
rate_limit:tenant_abc
```

### Security Guarantees

✅ **Tenant A cannot access Tenant B's documents** (enforced at DB, search, and cache layers)  
✅ **Tenant A cannot exhaust Tenant B's rate limit** (per-tenant rate limiting)  
✅ **Tenant A cannot invalidate Tenant B's cache** (namespaced cache keys)

### Scalability Considerations

**Current Approach (Shared Infrastructure):**
- All tenants share PostgreSQL, Elasticsearch, Redis
- Suitable for: < 1000 tenants, similar usage patterns

**Future Scaling Options:**
1. **Tenant Sharding**: Distribute tenants across multiple database instances
2. **Dedicated Clusters**: Large tenants get dedicated Elasticsearch clusters
3. **Namespace Isolation**: Elasticsearch index-per-tenant for complete isolation

---

## Caching Strategy

### Cache Layers

| Layer | Technology | TTL | Invalidation Trigger |
|-------|-----------|-----|---------------------|
| Search Results | Redis | 300s | TTL expiry (no immediate invalidation) |
| Document Retrieval | Redis | 600s | Document delete (async eviction) |

### Cache Key Design

**Search Cache:**
```
search:{tenant_id}:{query}:{limit}:{offset}
```
- Includes pagination parameters to avoid stale results
- Expires naturally through TTL; no wildcard invalidations required

**Document Cache:**
```
document:{tenant_id}:{document_id}
```
- Evicted on document delete; otherwise refreshed on cache miss

### Invalidation Strategy

**On Document Create:**
- No immediate cache busting. Search entries expire via TTL (300s), keeping writes fast.

**On Document Delete:**
```typescript
cacheService.evictDocumentCache(tenantId, documentId);
```
- Fire-and-forget removal of the document cache entry (O(1))
- Search results rely on TTL-based expiry

### Cache Performance

**Expected Hit Rates:**
- Search cache: 60-80% (repeated queries common)
- Document cache: 40-60% (less predictable access patterns)

**Latency Impact:**
- Cache hit: < 50ms
- Cache miss: < 500ms (Elasticsearch query + cache write)

---

## Consistency Model

### Write Path Consistency

**Strong Consistency (PostgreSQL):**
- All writes are ACID transactions
- Immediate consistency for document retrieval by ID

**Eventual Consistency (Elasticsearch):**
- Documents indexed asynchronously
- Searchable within ~5 seconds (refresh interval)
- Acceptable trade-off for search use case

### Read Path Consistency

**Document Retrieval:**
- Reads from PostgreSQL (source of truth)
- Strongly consistent
- Cache may be stale (max 600s)

**Search:**
- Reads from Elasticsearch (derived index)
- Eventually consistent with PostgreSQL
- Cache may be stale (max 300s)

### Consistency Trade-offs

| Scenario | Behavior | Acceptable? |
|----------|----------|-------------|
| Document created, immediately searched | May not appear in results for ~5s | ✅ Yes (search is best-effort) |
| Document deleted, still in cache | May return 404 on retrieval | ✅ Yes (document key evicted; search cache expires via TTL) |
| Elasticsearch down | Document retrieval works, search returns 503 | ✅ Yes (graceful degradation) |

### Handling Inconsistencies

**Elasticsearch Indexing Failure:**
```javascript
try {
  await elasticsearchClient.indexDocument(...);
} catch (error) {
  logger.error('Elasticsearch indexing failed', error);
  // Don't fail the request - document is in PostgreSQL
  // Background job can re-index later
}
```

**Cache Staleness:**
- Acceptable due to short TTLs (5-10 minutes)
- Critical updates can force cache invalidation
- Health checks detect Redis failures

---

## Technology Choices

### Why PostgreSQL?

**Chosen for:**
✅ ACID compliance (data integrity)  
✅ Proven reliability and durability  
✅ Rich query capabilities (JOINs, aggregations)  
✅ Excellent backup/restore tooling  
✅ Strong ecosystem and community

**Not chosen:**
- NoSQL databases (need ACID guarantees)
- In-memory databases (need durability)

### Why Elasticsearch?

**Chosen for:**
✅ Best-in-class full-text search  
✅ Built-in fuzzy matching and relevance ranking  
✅ Horizontal scalability  
✅ Rich query DSL  
✅ Sub-second search performance

**Not chosen:**
- PostgreSQL full-text search (limited fuzzy matching, slower at scale)
- Solr (Elasticsearch has better developer experience)

### Why Redis?

**Chosen for:**
✅ Extremely fast (< 1ms latency)  
✅ Simple data structures (strings, sets)  
✅ Built-in TTL support  
✅ Atomic operations (INCR for rate limiting)  
✅ Low operational overhead

**Not chosen:**
- Memcached (no TTL, no atomic operations)
- In-memory caching (no shared state across API servers)

### Why Node.js + TypeScript?

**Chosen for:**
✅ Excellent async I/O performance  
✅ Rich ecosystem for web services  
✅ TypeScript provides type safety  
✅ Fast development iteration  
✅ Easy to hire developers

**Not chosen:**
- Go (steeper learning curve, less ecosystem)
- Python (slower async performance)
- Java (more verbose, heavier runtime)

---

## Scalability Patterns

### Horizontal Scaling

**API Servers:**
- Stateless design enables unlimited horizontal scaling
- Load balancer distributes traffic across instances
- Each instance connects to shared data stores

**Elasticsearch:**
- Shard documents across multiple nodes
- Replica shards for read scaling
- Index-per-tenant for large tenants

**PostgreSQL:**
- Read replicas for read scaling
- Connection pooling to manage connections
- Partitioning by tenant_id for very large datasets

---

### Monitoring & Observability (Prototype)
- Structured JSON logging with correlation ID and tenant ID
- `/health` endpoint reporting dependency status and latency
- Errors logged with context for debugging

Advanced observability (metrics, tracing, dashboards) is documented for production readiness.


### Health Checks

```
GET /health
```
Returns status of all dependencies with latency metrics.

### Key Metrics to Monitor

**Application Metrics:**
- Request rate (per tenant)
- Error rate (by error code)
- Latency (p50, p95, p99)
- Cache hit rate

**Infrastructure Metrics:**
- PostgreSQL: Connection pool usage, query latency
- Elasticsearch: Index size, search latency, cluster health
- Redis: Memory usage, eviction rate, command latency

---

## Summary

This architecture demonstrates:

✅ **Separation of Concerns**: Each component has a clear, single responsibility  
✅ **Scalability**: Stateless API servers, horizontal scaling of data stores  
✅ **Performance**: Multi-layer caching, optimized search index  
✅ **Reliability**: Graceful degradation, health monitoring  
✅ **Multi-Tenancy**: Strict isolation at every layer  
✅ **Maintainability**: Clean code structure, comprehensive logging

The design balances **simplicity** (for a 3-4 hour prototype) with **production-readiness** (demonstrating real-world patterns).

---# END ARCHITECTURE.md