# Changelog

This file records the main changes made to the Chrono app during the current revision, with focus on UI architecture, calendar/chat integration, and implementation updates.

## 2026-05-29 18:42 UTC

### UI architecture restoration
- Reworked the app layout to restore the screenshot-based design.
- Converted the app into two primary workspaces:
  - `Calendar` workspace occupying the top portion of the screen
  - `Chrono Chat` workspace occupying the bottom portion
- Removed dashboard-style multi-widget layouts and excessive AI cards.
- Preserved Google Calendar-like navigation with view tabs, date controls, and calendar layers.
- Added top-level quick add event input and event rendering inside calendar cells.

### Chat interface implementation
- Replaced the small assistant widget with a full ChatGPT-style chat panel.
- Added scrollable chat history, user/AI message bubbles, input field, and send button.
- Integrated natural language command handling for event creation, calendar layer toggles, and schedule review requests.

### Functional updates
- Updated `ui/app.js` to support:
  - month navigation and selected date handling
  - calendar rendering for daily layout and events
  - chat command parsing and AI response display
- Updated `ui/index.html` and `ui/styles.css` for the new visual architecture.

### Documentation
- Added `ui/UI_HISTORY.md` to capture the UI display history and redesign decisions.

## Notes
- `ui/UI_HISTORY.md` contains the UI-specific implementation history.
- This `CHANGELOG.md` file captures the broader set of changes made in the current revision.
