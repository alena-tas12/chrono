# Architectural Contracts

## 1. Evaluation Contract for New Features
Before any new capability is written, it must answer:
1. Does it belong in the State Manager?
2. Is it a discrete Module?
3. Does Dispatch need to retrieve it?
4. Does it belong in the Knowledge Base or Memory Graph?
5. Is it only a presentation layer concern?

## 2. Defined Failure Modes
Undefined behavior is unacceptable. Subsystems must implement recovery paths: `Retry → Cache → Fallback → Inform user`.

- **Failure:** Cannot retrieve calendar.
  - **Behavior:** Tell user.
  - **Invariant:** Never hallucinate schedule.
- **Failure:** Contradictory facts.
  - **Behavior:** Surface contradiction.
  - **Invariant:** Do not silently merge.
- **Failure:** LLM unavailable.
  - **Behavior:** State-only mode.
  - **Invariant:** Provide transparency, not fake conversation.

## 3. Architectural Metrics
Architecture must improve scientifically. The following metrics are tracked:
- **Quality:** Hallucination Rate, Contradiction Detection Rate, Retrieval Accuracy, Average Retrieval Depth, Module Usage, Decision Trace Completeness.
- **Performance:** Intent Planning `<20 ms`, Dispatch `<100 ms`, Retrieval `<300 ms`, Conversation `<2 seconds`.
