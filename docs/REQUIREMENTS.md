# Document Search Service - Simplified Requirements (3-4 Hour Prototype)

## Overview
Build a functional prototype of a distributed document search service demonstrating enterprise-grade architectural patterns. Focus on **architectural thinking** over complete implementation.

**Time Budget**: 3-4 hours  
**Stack**: Node.js + Express + TypeScript, Elasticsearch, Redis, PostgreSQL, Zod, Docker

---

## 1. Functional Requirements (Must Have)

### 1.1 Document Management
| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-1.1 | Index documents via REST API | POST /v1/documents returns 201 with document ID |
| FR-1.2 | Retrieve document by ID | GET /v1/documents/{id} returns document, 404 for non-existent |
| FR-1.3 | Delete documents | DELETE /v1/documents/{id} returns 204, soft delete preferred |
| FR-1.4 | Document schema | Contains: id, tenant_id, title, content, metadata, timestamps |

### 1.2 Search Functionality
| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-2.1 | Full-text search | GET /v1/search?q={query} matches document content |
| FR-2.2 | Relevance ranking | Results ranked by BM25 or similar algorithm |
| FR-2.3 | Pagination | Support limit and offset parameters (max 100 per page) |
| FR-2.4 | Tenant filtering | Automatic filtering by X-Tenant-ID header |
| FR-2.5 | **Fuzzy search** | Typo tolerance (e.g., "databse" matches "database") |

### 1.3 Multi-Tenancy
| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-3.1 | Tenant isolation | All queries automatically filter by tenant_id |
| FR-3.2 | Header-based identification | X-Tenant-ID header required, reject if missing |
| FR-3.3 | Cross-tenant prevention | Tenant A cannot access Tenant B's documents |

### 1.4 API & Integration
| ID | Requirement | Acceptance Criteria |
|----|-------------|---------------------|
| FR-4.1 | RESTful HTTP API | Follows REST conventions, appropriate HTTP methods/status codes |
| FR-4.2 | JSON format | Content-Type: application/json for all endpoints |
| FR-4.3 | Health check | GET /health returns status of DB, Elasticsearch, Redis |
| FR-4.4 | Structured errors | Errors include: error_code, message, details, trace_id |

---

## 2. Non-Functional Requirements (Prototype)

### 2.1 Performance Targets
| Requirement | Target | Notes |
|-------------|--------|-------|
| Search latency p95 | < 500ms | Demonstrate with sample data |
| Document indexing | < 5 seconds | Time from POST to searchable |
| Cache hit rate | > 50% | For repeated queries |

### 2.2 Multi-Tenancy & Security
| Requirement | Implementation |
|-------------|----------------|
| Tenant isolation | Mandatory tenant_id filter in all queries |
| Rate limiting | 100 req/min per tenant (Redis-based) |
| Input validation | Prevent SQL/NoSQL injection via parameterized queries |
| Request tracing | Correlation ID in all logs and responses |

### 2.3 Caching Strategy
| Layer | Technology | TTL | Invalidation |
|-------|-----------|-----|--------------|
| Search results | Redis | 300s | On document update/delete |
| Document retrieval | Redis | 600s | On document update/delete |

### 2.4 Observability (Basic)
| Requirement | Implementation |
|-------------|----------------|
| Structured logging | JSON logs with correlation ID, tenant_id |
| Health checks | Dependency status with latency |
| Error tracking | Log all errors with stack traces |

---

## 3. Data Schema

### 3.1 PostgreSQL - Document Metadata
```typescript
{
  id: string (uuid, primary key)
  tenant_id: string (indexed, required)
  title: string (max 500 chars, required)
  content: string (max 1MB, required)
  metadata: object (optional JSONB)
  created_at: timestamp
  updated_at: timestamp
  deleted_at: timestamp (nullable, for soft delete)
}
```

### 3.2 Elasticsearch - Search Index
```json
{
  "mappings": {
    "properties": {
      "document_id": { "type": "keyword" },
      "tenant_id": { "type": "keyword" },
      "title": { "type": "text", "analyzer": "standard" },
      "content": { "type": "text", "analyzer": "standard" },
      "indexed_at": { "type": "date" }
    }
  },
  "settings": {
    "index": {
      "max_result_window": 10000
    }
  }
}
```

---

## 4. API Specification

### 4.1 Endpoints
```
POST   /v1/documents          - Index new document
GET    /v1/documents/:id      - Retrieve document by ID
DELETE /v1/documents/:id      - Delete document (soft delete)
GET    /v1/search             - Search documents
GET    /health                - Health check
```

### 4.2 Request/Response Examples

#### POST /v1/documents
```json
// Request
Headers: { "X-Tenant-ID": "tenant_abc" }
Body: {
  "title": "Database Performance Tuning",
  "content": "Optimizing PostgreSQL queries for production...",
  "metadata": { "category": "engineering", "author": "john" }
}

// Response: 201 Created
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant_abc",
  "title": "Database Performance Tuning",
  "created_at": "2026-01-21T10:30:00Z"
}
```

#### GET /v1/search?q=database&limit=10&offset=0
```json
// Request
Headers: { "X-Tenant-ID": "tenant_abc" }

// Response: 200 OK
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Database Performance Tuning",
      "snippet": "...Optimizing <em>PostgreSQL</em> queries...",
      "score": 0.95
    }
  ],
  "total": 42,
  "limit": 10,
  "offset": 0,
  "took_ms": 145
}
```

#### GET /health
```json
// Response: 200 OK
{
  "status": "healthy",
  "dependencies": {
    "postgres": { "status": "up", "latency_ms": 2 },
    "elasticsearch": { "status": "up", "latency_ms": 15 },
    "redis": { "status": "up", "latency_ms": 1 }
  },
  "timestamp": "2026-01-21T10:30:00Z"
}
```

#### Error Response
```json
// 400 Bad Request
{
  "error_code": "INVALID_REQUEST",
  "message": "Missing required field: title",
  "details": { "field": "title" },
  "trace_id": "abc123"
}

// 429 Too Many Requests
{
  "error_code": "RATE_LIMIT_EXCEEDED",
  "message": "Tenant has exceeded rate limit",
  "retry_after": 60,
  "trace_id": "def456"
}
```

---

## 5. Architecture (Prototype)

### 5.1 Docker Compose Services
```yaml
services:
  - api (Node.js + Express)
  - postgres (metadata storage)
  - elasticsearch (search engine)
  - redis (cache + rate limiting)
```

### 5.2 Data Flow

**Indexing Flow:**
```
POST /documents → Validate → Write to PostgreSQL → 
Index to Elasticsearch → Invalidate cache → Response
```

**Search Flow:**
```
GET /search → Check Redis cache →
  Cache hit: Return cached results
  Cache miss: Query Elasticsearch (with tenant filter) → 
            Cache results (TTL: 300s) → Return
```

---

## 6. Testing Requirements (Simplified)

### 6.1 Unit Tests (Jest)
- ✅ Service layer business logic
- ✅ Validation schemas
- ✅ Cache key generation
- ✅ Error handling utilities
- **Target**: Core logic coverage, not comprehensive

### 6.2 Manual Testing
- ✅ Index documents and verify searchable within 5s
- ✅ Test tenant isolation (cross-tenant access fails)
- ✅ Verify fuzzy search works
- ✅ Test cache hit on repeated queries
- ✅ Verify rate limiting returns 429

---

## 7. Documentation Deliverables

### 7.1 Architecture Document (2-3 pages)
- System architecture diagram
- Component responsibilities
- Data flow (indexing & search)
- Multi-tenancy strategy
- Caching strategy
- Consistency model and trade-offs

### 7.2 Production Readiness Analysis (1-2 pages)
- Scalability approach for 100x growth
- Resilience patterns (circuit breakers, retries)
- Security implementation plan
- Observability strategy
- Performance optimization approach
- Deployment strategy

### 7.3 Code Repository
- README with setup instructions
- Docker Compose file
- Sample curl commands or Postman collection
- Architecture diagrams (Mermaid or ASCII)
- Brief note on AI tool usage

### 7.4 Experience Showcase (1 page)
- Similar distributed system built (scale, impact)
- Performance optimization case study
- Production incident resolution story
- Architectural decision case study

---

## 8. Success Criteria

### 8.1 Prototype Must Demonstrate
✅ Documents can be indexed and retrieved  
✅ Search returns relevant results with fuzzy matching  
✅ Tenant isolation enforced (manual testing)  
✅ Health check reports dependency statuses  
✅ Basic caching works (observable in logs)  
✅ Rate limiting returns 429 when exceeded  
✅ System runs via `docker-compose up`  

### 8.2 Documentation Must Show
✅ Clear architectural thinking and trade-off analysis  
✅ Realistic path from prototype to production  
✅ Understanding of distributed systems challenges  
✅ Security and multi-tenancy considerations  
✅ Concrete production experience  

### 8.3 Code Must Demonstrate
✅ Clean separation of concerns (API, service, repository layers)  
✅ Proper error handling  
✅ Structured logging with context  
✅ Configuration via environment variables  
✅ Basic unit tests for core logic  

---

## 9. Out of Scope (Document for Production)

These are explicitly **not required** for the prototype but should be documented in production readiness:

❌ Full authentication/authorization (use tenant ID in header only)  
❌ TLS/HTTPS (assume terminated at load balancer)  
❌ Distributed tracing implementation (document what you'd use)  
❌ Advanced search features beyond fuzzy (faceted, highlighting - bonus only)  
❌ Kubernetes deployment (Docker Compose sufficient)  
❌ Multi-region deployment  
❌ Advanced monitoring dashboards  
❌ CI/CD pipelines  
❌ Comprehensive test suite (basic unit tests sufficient)  
❌ Production-grade secrets management  
❌ Load testing (document approach only)  

---

## 10. Bonus Points (If Time Permits)

⭐ Search result highlighting  
⭐ Performance benchmarks from prototype  
⭐ Blue-green deployment strategy documentation  
⭐ Cost optimization strategies for cloud deployment  

---

## Timeline Estimate (3-4 hours)

| Phase | Time | Deliverable |
|-------|------|-------------|
| Project setup + Docker | 30 min | Running services |
| Core API + middleware | 60 min | CRUD + search endpoints |
| Caching + rate limiting | 30 min | Redis integration |
| Fuzzy search | 20 min | Elasticsearch fuzziness |
| Basic unit tests | 30 min | Core logic coverage |
| Documentation | 50 min | Architecture + production readiness |
| **Total** | **3h 40min** | Complete submission |