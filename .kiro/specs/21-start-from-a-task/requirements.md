# Spec 21: start from a task

The landing page described spec 09's app. A newcomer (an administrator with a folder of forms,
or a judge with five minutes) should see what the app does, as tasks, and land on each one.

## Requirements

1. THE landing page SHALL list seven tasks, one line each, starting with a verb: read a form and
   its records, see the rules behind a field, fill in a form and see why values changed, find and
   total records, keep records readable, print what a form does, decide which forms move first.
2. WHEN the person chooses a task, THE SYSTEM SHALL open its bundled sample at the task's screen
   and state: 02 record 1; 04 with X-ray on; 04 record 1 with Fill on and Rule Trace open; 02
   Records; 05 with the "Export records" choices open; 04 Documentation; Triage of all samples.
3. WHERE a task lands, THE SYSTEM SHALL show one line in the page on what to try first, with a
   "Close tip" button; it SHALL be announced once and SHALL go when the person acts elsewhere on
   the page or closes it. It is not a dialog, a tour or an overlay.
4. WHEN the person chooses Back on the screen a task landed on, THE SYSTEM SHALL show the landing
   page, with focus on the task list's heading; the open files stay in the session.
5. EACH task SHALL have an address, `#<task>` on the app's own URL; opening it SHALL open the task,
   and choosing a task on the page SHALL put its address in the address bar.
6. WHEN the address names no task, THE SYSTEM SHALL show the landing page and say nothing.
7. THE two lead sentences SHALL say what the app does now; "Try a sample", "Triage all samples",
   the drop line and the privacy line stay.
8. THE landing page SHALL stay within its bundle budget, work offline, and have no sideways
   scroll at 390 px, with each task a target of at least 24 px.
