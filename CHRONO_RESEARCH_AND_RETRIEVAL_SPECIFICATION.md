# 🌐 Chrono Research & Retrieval Engine Specification (v2.3+)

> **Architecture Status**: Blueprint & Boundary Specification for Future Release Cycle (Chrono 2.3+)  
> **Core Release Invariant**: Preserves **Chrono OS 2.2.0 Frozen Stability** while defining the formal information boundaries for external web/document retrieval.

---

## 1. Executive Summary & Philosophy

In Chrono, external web and document retrieval is a **stateless research capability**, not a replacement for personal episodic memory. 

$$\text{PERSONAL MEMORY (Sovereign SQLite)} \quad \neq \quad \text{EXTERNAL KNOWLEDGE (Ephemeral Web/Docs)}$$

External web search is never executed blindly for every prompt. Instead, the **Source Router** determines whether a request is personal, conceptual, or requires live external ground truth.

```text
                    USER REQUEST
                         │
                         ▼
                  SOURCE ROUTER
                         │
       ┌─────────────────┼──────────────────┐
       ▼                 ▼                  ▼
  Personal Context   External Web       No Retrieval
  (Memory / Notes)   (Docs / Pricing)   (Pure Reasoning)
       │                 │                  │
       ▼                 ▼                  ▼
  SQLite / Spaces    Search / Fetch     Model Kernel
       │                 │                  │
       └─────────────────┼──────────────────┘
                         ▼
                  CONTEXT ASSEMBLY
                         ▼
            MODEL REASONING & SYNTHESIS
                         ▼
             RESPONSE WITH CITATIONS
```

---

## 2. The 8 Components of the Research Engine

```text
Research Engine Subsystem
│
├── 1. Source Router (Intent-based routing: Personal vs External vs Pure Model)
├── 2. Web Search Adapter (Stateless query execution via DuckDuckGo / SearXNG / Serper)
├── 3. URL & Document Fetcher (HTML-to-markdown sanitizer & PDF parser)
├── 4. Source Scorer & Ranker (Relevance filtering against user query)
├── 5. Content Extractor (Extracts key claims, definitions, tables, code blocks)
├── 6. Citation Manager (Preserves URLs, timestamps, publisher metadata)
├── 7. Research Context Builder (Injects labeled external sources into context assembly)
└── 8. Knowledge Ingestion Pipeline (1-click export to Knowledge OS pages & Space Proposals)
```

---

## 3. The Source Selection Decision Matrix

| Query Type | Example Query | Selected Source | Action Taken |
| :--- | :--- | :--- | :--- |
| **Personal Epistemic** | *"What was I working on yesterday?"* | `Personal Memory` | Query SQLite `cognitive_memories` & `events` |
| **Static Conceptual** | *"Explain what a subnet mask is"* | `No Retrieval` | Direct LLM synthesis (Zero latency / Zero cost) |
| **Live External** | *"Compare latest Gemini 2.0 and OpenRouter pricing"* | `External Web` | Web search $\to$ fetch docs $\to$ synthesize |
| **Personal + External** | *"Research OSPF routing and add a note to my study space"* | `Hybrid` | Web search $\to$ format note $\to$ draft Knowledge block |

---

## 4. Source Transparency & Citation Protocol

When external retrieval is triggered, Chrono enforces strict attribution boundaries:

```markdown
### Analysis & Synthesis
Chrono's comparative reasoning over the retrieved sources...

---
### 📚 Sources Consulted
1. [Google Gemini API Documentation](https://ai.google.dev/pricing) — *Retrieved Aug 17, 2026*
2. [OpenRouter Model Index](https://openrouter.ai/models) — *Retrieved Aug 17, 2026*
```

---

## 5. UI Control & Toggle Integration (Settings -> Research & Search)

Matching modern sovereign operating systems, users maintain full deterministic control over automated search capabilities:

```
┌───────────────────────────────────────────────────────────┐
│ ⚙️ Search & External Research Controls                    │
├───────────────────────────────────────────────────────────┤
│ 🌐 Web Search                                      [ON]   │
│    Allow Chrono to automatically search the web when      │
│    answering queries requiring live external data.        │
│                                                           │
│ 📚 Library & Knowledge Search                      [ON]   │
│    Search across local notes, documents, and spaces.      │
│                                                           │
│ 🛡️ Strict Privacy Mode                             [OFF]  │
│    Block all external network requests during chat.       │
└───────────────────────────────────────────────────────────┘
```

---

## 6. Release Boundary Invariant
- **Chrono OS 2.2.0**: Remains 100% frozen, packaged, and verified.
- **Chrono Spaces 1.0 & Research Engine**: Finalized as the unified modular architecture for Chrono 2.3+.
