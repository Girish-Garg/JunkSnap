---
status: accepted
superseded_by:
area: frontend
by: hem
date: 2026-10-11T03:03+05:30
---
# Every app action that can be off goes through one gate; every failure through one classifier

Context: issue 124. Buttons were disabled silently, hidden, or failed only after a call; errors were mapped per hook, logged with console.error, and a crash in a sheet could blank the app.

Decision:
- `domain/ActionAvailability` + `GateRules`: each action (`SITE_GATES`, `CAPTURE_GATES`, `NOTE_SEND_GATE`, `LETTER_DRAFT_GATE`, `AREA_LETTER_GATE`, `ACTIVITY_DELETE_GATE`) lists ordered rules over app state and returns `enabled` or `blocked(reason)`. Hooks decide (`useSiteGates`, `useSessionGate`) and hand components a `GatedAction`; a new action is a new gate, not a branch in a component. Letter and cleanup links check the same gates for their site or area and show why instead of the form. "Too far" uses only a fix under 2 minutes old, and a tap takes a fresh one first.
- Looks: a reason the person must act on is `aria-disabled` (muted, still tappable, the tap shows the reason in the app toast); a wait that clears by itself (sending, camera starting, first GPS fix) is natively `disabled`; a sign-in reason looks normal and opens sign-in with the reason, then runs the action. Never hide an action while a reason exists; hide only when it never applies (closed sites, someone else's report).
- `ErrorClassifier` sorts every thrown value into one category; `useActionErrors` reports it (`console.warn('[junksnap:error]', ...)`, no telemetry), holds the action group for 60 s after a 429, and on a 401 reopens sign-in and retries once, keeping typed drafts; a second 401 shows the inline line only. UI text always comes from i18n keys, never the server message.
- App-wide `Notifier` toast queue (top of the screen), an offline line in every sheet, "Back online", and one `SheetBoundary` per route sheet with "Something went wrong · Try again".

Consequences for other lanes: frontend only, no contract change. New action buttons should use a gate plus `useGate`, and new api calls `useActionErrors` (or `services.errors.report` for loads). Area and ranking loads still use console.error; move them when those files are next touched.

Rejected alternatives: disabling buttons natively (the tap cannot explain itself); one global error toast for every failure (inline errors stay next to the action that failed).
