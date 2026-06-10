# Chrono Founder Architecture Directive

Before making architectural decisions, understand that Chrono was not originally designed as a generic productivity application.

Chrono originated from a small set of deeply meaningful relationships and experiences involving Princess, Anwesha, Rayhaan, the Core, and the Inner Circle. These individuals are not simply users within the founder's mental model. They represent the original context, purpose, and design philosophy from which Chrono emerged.

## Layer 1: Original Chrono, Founder Layer

Original Chrono is built around companionship, continuity, memory, presence, care, trust, and long-term relationship support.

It is the architectural reference point for future development. It may contain experimental features, deeper relationship models, and founder-specific functionality. The Core and Inner Circle are not premium users or admins. They are the original design reference that defines what Chrono is trying to achieve.

## Layer 2: Public Chrono, Product Layer

Public Chrono is designed for MVPs, public users, trusted-user pilots, businesses, scalability, monetization, and growth.

It must be simpler, safer, and easier to understand. It should inherit principles from Original Chrono without requiring the same relationship context. It can include restrictions, simplified workflows, and business-focused functionality.

## Architectural Rule

Business Chrono must never replace Original Chrono.

Original Chrono guides vision, shapes product philosophy, and informs Public Chrono. Public Chrono must not flatten Chrono into a generic productivity tool.

## Current Priorities

- Founder observability and visibility
- Understanding real-world usage patterns
- Architecture cleanup and technical debt reduction
- Safe deployment to trusted users
- Traffic and scalability testing
- Maintaining separation between Founder Layer and Public Layer

## Refactor Rules

- Preserve the original Chrono philosophy.
- Distinguish founder-only functionality from public functionality.
- Keep public flows simple, private, recoverable, and understandable.
- Gate experimental, diagnostic, and stress-test features behind founder mode.
- Prefer observability, maintainability, and architectural clarity.
- Ensure future scalability without sacrificing the original vision.

Chrono should evolve from its origins, but never forget them.
