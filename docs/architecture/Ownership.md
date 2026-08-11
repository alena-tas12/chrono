# Explicit Component Ownership

| Component | Owns | Must Never Own |
|---|---|---|
| **Event Bus** | Event routing | State |
| **State Manager** | Current truth, Schema versions | Reasoning |
| **Dispatch** | Retrieval planning, Intent classification | Memory updates |
| **Executive** | Objective selection, Decision categorization | Data retrieval |
| **LLM** | Language & reasoning over supplied state | Hidden memory, state mutation |
| **UI** | Presentation | Decision making |
