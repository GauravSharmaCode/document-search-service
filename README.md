# Document Search Service

A distributed, multi-tenant document search service built with Node.js, TypeScript, Elasticsearch, PostgreSQL, and Redis. This prototype demonstrates enterprise-grade architectural patterns including tenant isolation, distributed caching, rate limiting, and fuzzy search capabilities.

## Features

- **Full-Text Search** with fuzzy matching and typo tolerance
- **Multi-Tenancy** with strict tenant isolation
- **Distributed Caching** using Redis for performance optimization
- **Rate Limiting** (100 requests/minute per tenant)
- **Soft Delete** pattern for documents
- **Health Monitoring** for all dependencies
- **Structured Logging** with correlation IDs
- **RESTful API** with comprehensive error handling

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Express API Server                  │
│  ┌──────────────────────────────────────────────┐  │
│  │  Middleware Stack                            │  │
│  │  • Correlation ID                            │  │
│  │  • Tenant Validation                         │  │
│  │  • Rate Limiting (Redis)                     │  │
│  │  • Error Handling                            │  │
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
    PostgreSQL    Elasticsearch      Redis
    (Metadata)      (Search)        (Cache)
```

## Tech Stack

- **Runtime**: Node.js 20 + TypeScript
- **Framework**: Express.js
- **Validation**: Zod
- **Database**: PostgreSQL 15 (metadata storage)
- **Search Engine**: Elasticsearch 8.11 (full-text search)
- **Cache**: Redis 7 (caching + rate limiting)
- **Testing**: Jest
- **Containerization**: Docker + Docker Compose

## Prerequisites

- Docker and Docker Compose
- Node.js 20+ (for local development)
- npm or yarn

## Quick Start

### 1. Clone and Setup

```bash
# Copy environment variables
cp .env.example .env

# Start all services with Docker Compose
docker-compose up -d
```

### 2. Verify Setup

```bash
# Check service status
docker-compose ps

# View API logs
docker-compose logs -f api

# Test health endpoint
curl http://localhost:3000/health
```

The API will be available at `http://localhost:3000`

### 3. Expected Health Response

```bash
curl http://localhost:3000/health
```

Expected response:
```json
{
  "status": "healthy",
  "dependencies": {
    "postgres": { "status": "up", "latency_ms": 2 },
    "elasticsearch": { "status": "up", "latency_ms": 15 },
    "redis": { "status": "up", "latency_ms": 1 }
  },
  "timestamp": "2026-01-22T00:00:00.000Z"
}
```

## API Usage

### Create Document

```bash
curl -X POST http://localhost:3000/v1/documents \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_abc" \
  -d '{
    "title": "Database Performance Tuning",
    "content": "Optimizing PostgreSQL queries for production workloads requires understanding query execution plans...",
    "metadata": {
      "category": "engineering",
      "author": "john_doe"
    }
  }'
```

Response (201 Created):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant_abc",
  "title": "Database Performance Tuning",
  "created_at": "2026-01-22T00:00:00.000Z"
}
```

### Search Documents

```bash
curl "http://localhost:3000/v1/search?q=database&limit=10&offset=0" \
  -H "X-Tenant-ID: tenant_abc"
```

Response (200 OK):
```json
{
  "results": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Database Performance Tuning",
      "snippet": "Optimizing <em>PostgreSQL</em> queries...",
      "score": 0.95
    }
  ],
  "total": 1,
  "limit": 10,
  "offset": 0,
  "took_ms": 145
}
```

### Fuzzy Search (Typo Tolerance)

```bash
# Search with typo - "databse" instead of "database"
curl "http://localhost:3000/v1/search?q=databse" \
  -H "X-Tenant-ID: tenant_abc"
```

Elasticsearch will still match "database" documents!

### Get Document by ID

```bash
curl http://localhost:3000/v1/documents/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-Tenant-ID: tenant_abc"
```

Response (200 OK):
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "tenant_id": "tenant_abc",
  "title": "Database Performance Tuning",
  "content": "Optimizing PostgreSQL queries...",
  "metadata": {
    "category": "engineering",
    "author": "john_doe"
  },
  "created_at": "2026-01-22T00:00:00.000Z",
  "updated_at": "2026-01-22T00:00:00.000Z"
}
```

### Delete Document

```bash
curl -X DELETE http://localhost:3000/v1/documents/550e8400-e29b-41d4-a716-446655440000 \
  -H "X-Tenant-ID: tenant_abc" \
```

Response (204 No Content)

## Testing

### Run Tests

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Manual Testing Scenarios

#### 1. Test Tenant Isolation

```bash
# Create document for tenant A
DOC_ID=$(curl -s -X POST http://localhost:3000/v1/documents \
  -H "Content-Type: application/json" \
  -H "X-Tenant-ID: tenant_a" \
  -d '{"title":"Secret A","content":"Tenant A data"}' | jq -r '.id')

# Try to access from tenant B (should return 404)
curl http://localhost:3000/v1/documents/$DOC_ID \
  -H "X-Tenant-ID: tenant_b"
```

#### 2. Test Rate Limiting

```bash
# Send 101 requests rapidly
for i in {1..101}; do
  curl -s http://localhost:3000/v1/search?q=test \
    -H "X-Tenant-ID: tenant_abc" \
    -w "\nStatus: %{http_code}\n"
done
```

The 101st request should return 429 (Rate Limit Exceeded).

#### 3. Test Caching

```bash
# First search (cache miss - check logs)
curl "http://localhost:3000/v1/search?q=performance" \
  -H "X-Tenant-ID: tenant_abc"

# Second search (cache hit - should be faster)
curl "http://localhost:3000/v1/search?q=performance" \
  -H "X-Tenant-ID: tenant_abc"
```

Check logs with `docker-compose logs api` to see cache hit/miss.

## Error Handling

All errors follow a consistent format:

```json
{
  "error_code": "VALIDATION_ERROR",
  "message": "Request validation failed",
  "details": { "field": "title" },
  "trace_id": "abc123-correlation-id"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `TENANT_ERROR` | 400 | Missing or invalid tenant ID |
| `NOT_FOUND` | 404 | Document not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

## Configuration

Environment variables (see `.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 3000 | API server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `ELASTICSEARCH_NODE` | http://elasticsearch:9200 | Elasticsearch URL |
| `REDIS_URL` | redis://redis:6379 | Redis URL |
| `CACHE_TTL_SEARCH` | 300 | Search cache TTL (seconds) |
| `CACHE_TTL_DOCUMENT` | 600 | Document cache TTL (seconds) |
| `RATE_LIMIT_MAX_REQUESTS` | 100 | Max requests per minute per tenant |

## Development

### Docker Development (Recommended)

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Rebuild after code changes
docker-compose up -d --build

# Stop services
docker-compose down
```

### Local Development (without Docker)

```bash
# Start dependencies
docker-compose up -d postgres elasticsearch redis

# Install dependencies
npm install

# Run migrations
npm run migrate

# Start dev server
npm run dev
```

### Build

```bash
npm run build
```

### Lint

```bash
npm run lint
```

## Project Structure

```
document-search-service/
├── src/
│   ├── config/           # Configuration
│   ├── db/               # Database clients
│   │   ├── migrations/   # SQL migrations
│   │   ├── pool.ts       # PostgreSQL pool
│   │   ├── elasticsearch.ts
│   │   └── redis.ts
│   ├── middleware/       # Express middleware
│   ├── repositories/     # Data access layer
│   ├── routes/           # API routes
│   ├── schemas/          # Zod validation schemas
│   ├── services/         # Business logic
│   ├── utils/            # Utilities (logger, errors)
│   ├── __tests__/        # Unit tests
│   └── server.ts         # Main entry point
├── docs/                 # Documentation
├── docker-compose.yml
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Performance

- **Search Latency**: < 500ms (p95) with caching
- **Indexing Time**: < 5 seconds from POST to searchable
- **Cache Hit Rate**: > 50% for repeated queries

## Monitoring

### View Logs

```bash
# All services
docker-compose logs -f

# API only
docker-compose logs -f api

# Elasticsearch
docker-compose logs -f elasticsearch
```

### Check Elasticsearch Index

```bash
curl http://localhost:9200/documents/_count
```

### Check Redis Cache

```bash
docker-compose exec redis redis-cli
> KEYS *
> GET search:tenant_abc:database:10:0
```

## Troubleshooting

### Services not starting

```bash
# Check service status
docker-compose ps

# Restart services
docker-compose restart

# Rebuild and restart
docker-compose up -d --build
```

### Elasticsearch index issues

```bash
# Delete and recreate index
curl -X DELETE http://localhost:9200/documents
docker-compose restart api
```

### Database migration issues

```bash
# Run migrations manually
docker-compose exec api npm run migrate
```

## Documentation

- [Architecture Documentation](docs/ARCHITECTURE.md) - System design and data flows
- [Production Readiness](docs/PRODUCTION_READINESS.md) - Deployment, monitoring, and scaling
- [Experience & Lessons Learned](docs/EXPERIENCE.md) - Industry experience insights
  
## Prototype vs Production

**This is a functional prototype demonstrating architectural patterns.**

**What's implemented:**
- ✅ Working end-to-end document search
- ✅ Multi-tenant isolation
- ✅ Caching and rate limiting
- ✅ Comprehensive health checks
- ✅ Graceful error handling

**What's documented but requires additional work for production:**
- ⚠️ Async indexing uses try/catch pattern; production would add message queue with retry logic
- ⚠️ Single-instance deployment; production requires horizontal scaling
- ⚠️ Performance metrics are estimates; production requires load testing and validation

**See `docs/PRODUCTION_READINESS.md` for complete production strategy.**

## License

MIT
