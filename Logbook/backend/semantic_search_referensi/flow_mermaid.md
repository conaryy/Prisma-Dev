# Flow Diagram

```mermaid
flowchart TD
    A[User di Browser] --> B[Frontend public/index.html]

    B -->|POST /api/search| C[Express server.js]
    B -->|POST /api/chat| C
    B -->|POST /api/chat/stream| C

    C --> D[search-service.js]
    C --> E[chat-service.js]

    D --> F[retrieval.js]
    E --> Q[query-filters.js]
    E --> F

    Q -->|normalize explicit filters| F
    Q -->|decide structured date filter| E

    F --> G[embedding.js]
    G -->|Embedding Provider| H[Ollama atau Gemini]

    F --> I[qdrant.js]
    I --> J[Qdrant Collection logbook_entries]
    J -->|payload: source_type, source_id, entry_date, entry_year, entry_month, entry_day, entry_date_key| F

    F -->|semantic retrieval| K[postgres.js]
    K --> L[PostgreSQL]
    L -->|detail record logbook| F

    E -->|structured retrieval by source/date range| K

    F --> R[Hybrid Reranking]
    R -->|semanticScore + lexicalBoost + queryMode| D
    R -->|semantic result for chat| E

    E --> S{structured results >= chunk threshold?}
    S -->|No| M[chat-model.js]
    S -->|Yes| T[Chunk Summarization]
    T -->|chunk 1..N summary| M
    M -->|final synthesis or single summary| U[Chat Answer]

    M -->|Chat Provider| N[Ollama atau Gemini]

    E -->|status events| V[/api/chat/stream NDJSON]
    V --> B

    D --> C
    U --> C
    C --> B
    B --> A

    O[scripts/seed.js] --> K
    O --> G
    O --> I
    K -->|fetch all logbook entries| O
    G -->|generate embedding per entry| O
    O -->|upsert vectors + payload| J
    O --> P[.seed-state.json checkpoint]
```
