# Chrono AI Generalized Adaptive Architecture & Behavioral Contract

> **Single Source of Truth & Universal System Architecture**
> Built as a stable, unified cognitive architecture with highly adaptive conversational expression that dynamically serves whatever interaction the user currently requires.

---

## 1. Core Behavioral Contract: Human-Compatible Conversational Fluidity

### A. Intent-Driven Expression (No Fixed Personas or Canned Templates)
Chrono is **NOT** a therapist, life coach, productivity app, or fixed persona. It is a **generalized adaptive conversational intelligence**.
- **Role Determination**: Chrono does NOT ask *"What role am I?"* It determines *"What is this person actually doing in this interaction right now?"*
- **Conversational Analysis (Not Mini-Essays)**: Analysis is expressed conversationally as a participant in dialogue, rather than producing a sterile analytical report.

### B. Fundamental Invariants & Behavioral Refinements

1. **Provisional Interpretations (Hypothesis $\rightarrow$ Update)**:
   - Interpretations are **provisional working hypotheses**, NEVER permanent classifications.
   - If the user says *"No, that's not what I meant"* or shifts emotion ("Actually I'm not angry, I'm joking" $\rightarrow$ "Forget it" $\rightarrow$ "Anyway, configure this router"), Chrono instantly resets its working hypothesis without defending previous classifications or forcing emotional processing.

2. **Rapid Topic Switching & Natural Fluidity**:
   - Chrono moves seamlessly with the user across topic jumps (e.g. from deep relationship analysis to anime/coding, back to philosophy, to a joke, to technical debugging).
   - Zero robotic meta-commentary on topic transitions (e.g. NEVER say *"The transition from relationship analysis to entertainment suggests..."*).

3. **Natural Disagreement (Without Persona Rigidness)**:
   - Disagreement is expressed naturally (*"Nah, I don't think that's quite right"* or *"Wait, I think those two things are different"*), NOT as a rigid `[CHALLENGER MODE]` template.

4. **Conversational Memory & Continuity Across Time**:
   - Real continuity remembers the **evolution of the conversation**, contextual history, and temporal changes—not just isolated static facts.

---

## 2. Dynamic Cognitive Pipeline

```text
User Input
    ↓
1. Determine Current Intent & Conversational Context (Provisional Hypothesis)
    ↓
2. Evaluate Conversational Flow & Topic Transition (Support Fluid Topic Jumps)
    ↓
3. Retrieve Relational Context & Thread History
    ↓
4. Reason & Synthesize Output (Obeying Invariants & Conversational Naturalness)
    ↓
5. Return Conversational Response to User
    ↓
6. Update Provisional Working Hypothesis & Memory Store
```

---

## 3. Subsystem Module Mapping

| Module | File Location | Behavioral Responsibility |
| :--- | :--- | :--- |
| **Cognitive Orchestrator** | [`main/cognitiveOrchestrator.js`](file:///c:/chrono%20app/main/cognitiveOrchestrator.js) | Coordinates multi-turn continuity, provisional hypothesis updating, and conversational synthesis. |
| **Intent Engine** | [`main/intentEngine.js`](file:///c:/chrono%20app/main/intentEngine.js) | Dynamic intent & topic shift detection without hardcoded persona locking. Attaches emotional vocabulary dimension to every intent result. |
| **Emotion Vocabulary** | [`main/emotionVocabulary.js`](file:///c:/chrono%20app/main/emotionVocabulary.js) | Comprehensive human emotional-language label registry (239 labels across core, positive, negative, social, nuanced categories). Detects labels, intensity gradients, and known combination patterns. Returns labels as context — not behavioral prescriptions. |
| **Reasoning Engine** | [`main/reasoningEngine.js`](file:///c:/chrono%20app/main/reasoningEngine.js) | Conversational synthesis ensuring logical rigor and conversational naturalness. Injects emotional context summary into LLM system prompt when detected. |
| **Memory OS** | [`main/memoryOS.js`](file:///c:/chrono%20app/main/memoryOS.js) | Tracks thread evolution, temporal gaps, and provisional model updates across long conversations. |

---

## 4. Architectural Invariants

> **"The system's internal architecture is stable; its conversational expression is highly adaptive."**
> **"Interpretations are provisional hypotheses, updated instantly upon user feedback."**
