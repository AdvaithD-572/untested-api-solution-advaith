# Bug report

Scope: the original API plus the requested assignment feature. Three small,
unambiguous service bugs are fixed. The other findings below were reproduced with
Supertest probes and remain open, as the brief explicitly allows reporting bugs
without fixing them all. They are not claimed as passing regression coverage.

## Fixed

### 1. Pagination skips the first page

- **Location/cause:** `task-api/src/services/taskService.js`, `getPaginated` used
  `page * limit` as the array offset, although the API starts pages at 1.
- **Expected:** five tasks with `page=1&limit=2` return tasks 1-2, followed by
  tasks 3-4 on page 2 and task 5 on page 3.
- **Actual before fix:** page 1 returned tasks 3-4; the first two were inaccessible
  with the documented page numbering.
- **Discovery:** the service's one-based-page test and API pagination/default
  tests failed on the original code.
- **Fix:** use `(page - 1) * limit`. Regression tests cover first, middle, partial
  last, empty, and out-of-range pages, plus omitted query parameters.

### 2. Status filtering matches substrings

- **Location/cause:** `taskService.js`, `getByStatus` used `t.status.includes(status)`.
- **Expected:** an enum filter matches the complete status value.
- **Actual before fix:** `GET /tasks?status=do` matched both `todo` and `done`;
  a direct service call with an empty string matched everything.
- **Discovery:** exact/partial-status service and API tests failed before the fix.
- **Fix:** strict equality. Unknown status filters return an empty array; changing
  them to validation errors would require a separate API-contract decision.

### 3. Completing a task silently changes its priority

- **Location/cause:** `taskService.js`, `completeTask` explicitly overwrote
  `priority` with `medium` while constructing the updated task.
- **Expected:** completion changes status and completion time, preserving priority
  and other fields.
- **Actual before fix:** low/high priority became medium.
- **Discovery:** both service and API completion tests failed for low/high priority.
- **Fix:** remove that override. Tests assert the full returned task and persisted
  state, including unchanged priority, description, and deadline.

## Reproduced, still open

### 4. Combining a status filter and pagination ignores pagination

- **Location/cause:** `task-api/src/routes/tasks.js`, `GET /` returns from the
  `if (status)` branch before processing `page` or `limit`.
- **Expected:** assuming the independently documented query options compose,
  `?status=todo&page=1&limit=1` returns one matching task.
- **Actual/discovery:** a Supertest probe with two todo tasks returned both.
- **Proposed fix:** filter first, then paginate the filtered collection. Confirm
  the intended combined-query contract and add first/last/empty-page tests.

### 5. Invalid pagination values are silently accepted

- **Location/cause:** `routes/tasks.js`, `parseInt(value) || default` accepts numeric
  prefixes, replaces zero/NaN with defaults, and allows negative integers.
- **Expected:** assuming positive integer page/limit inputs, malformed values
  receive 400 instead of selecting an unintended page.
- **Actual/discovery:** `GET /tasks?page=abc&limit=1` returned 200 and the first task.
- **Proposed fix:** validate complete scalar inputs as positive safe integers;
  decide a maximum limit. Test zero, negatives, fractions, junk suffixes, repeated
  query parameters, and oversized values.

### 6. Create/update validation allows malformed task fields

- **Location/cause:** `task-api/src/utils/validators.js`, `validateCreateTask` and
  `validateUpdateTask` guard enum/date checks with truthiness. `description` is
  never validated, and `Date.parse` alone does not enforce an ISO string type.
- **Expected:** supplied statuses/priorities are valid enum strings, description
  is a string, and dueDate is null or a valid ISO date string.
- **Actual/discovery:** a POST probe with
  `{"title":"Invalid","status":null,"priority":false,"dueDate":false,"description":{}}`
  returned 201 and stored those exact invalid values. The same truthiness checks
  are present in PUT validation.
- **Proposed fix:** distinguish omitted fields from explicit invalid values,
  validate types before values, and define the accepted ISO date/time format.

### 7. PUT can overwrite identity and bypass assignment validation

- **Location/cause:** `taskService.js`, `update` spreads arbitrary client fields
  into the stored object; `validateUpdateTask` does not reject protected fields.
- **Expected:** ID, creation/completion metadata are server-controlled, and
  assignment validation cannot be bypassed through another endpoint.
- **Actual/discovery:** PUT with
  `{"id":"replaced-id","createdAt":"invalid","assignee":42}` returned 200 and
  stored all three values, making the original task ID unresolvable.
- **Proposed fix:** allowlist editable fields at the update boundary and either
  reject assignment through PUT or share its validation/normalization rules.
  This existing update-contract problem is not fixed by the new assignment route.

### 8. Completion metadata is inconsistent across status transitions

- **Location/cause:** `taskService.js`, `create` always sets `completedAt: null`;
  `update` does not manage it when status changes. `completeTask` generates a new
  timestamp on every call, even if already done.
- **Expected:** assuming completedAt records the transition to done, entering done
  sets it, reopening clears it, and repeated completion preserves it.
- **Actual/discovery:** POST with `status: "done"` returned null completedAt;
  completing then PUT-ing `status: "todo"` retained the previous completion time.
  Code inspection also shows repeated completion replaces the timestamp.
- **Proposed fix:** confirm transition/reopening and idempotency semantics, then
  share transition logic across create/update/complete and test using a fixed clock.

### 9. Malformed JSON is reported as an internal server failure

- **Location/cause:** `task-api/src/app.js`, the error middleware converts every
  parser/service error to 500, ignoring the parser's client-error status.
- **Expected:** syntactically invalid JSON returns 400 with a safe client message.
- **Actual/discovery:** a Supertest POST with `Content-Type: application/json`
  and body `{` returned 500. This also applies to the new assignment endpoint
  before its route handler executes.
- **Proposed fix:** handle known body-parser errors explicitly and retain the
  generic 500 response for unexpected failures. Test malformed/oversized bodies.

## Documentation conflicts resolved

The original README listed `pending | in-progress | completed`, but the assignment
and validators use `todo | in_progress | done`. Its status-filter example therefore
returned no tasks. README now uses the assignment's vocabulary. It also called
PUT a full update despite the implementation merging supplied fields; README now
describes existing behavior, leaving a possible PUT/PATCH contract change for
clarification. No changes were made to `ASSIGNMENT.md`.
