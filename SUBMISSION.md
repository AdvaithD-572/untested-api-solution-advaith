# Submission notes

## Implementation and decisions

- Added direct service unit tests, validator unit tests, and Supertest integration
  tests. Every endpoint has a happy path and at least two edge cases.
- Fixed one-based pagination, exact status filtering, and completion preserving
  priority. Root causes, reproductions, and remaining findings are in
  [BUG_REPORT.md](./BUG_REPORT.md).
- Added `PATCH /tasks/:id/assign`, with a dedicated validator and service function.
  The route accepts only a non-empty string, trims surrounding whitespace, and
  passes only the normalized assignee to the service. Other payload fields cannot
  change the task through this endpoint. Unicode and internal spaces are allowed;
  no arbitrary name-length restriction or user-directory dependency was added.
- Reassignment replaces the previous value; repeating the same name is a no-op
  in observable task data. Completed tasks may be assigned because the brief does
  not restrict their ownership. No unassign operation was invented: blank/null
  names return 400. The assignee field appears only after assignment, preserving
  the original shape of unassigned tasks.
- Missing tasks return 404 before assignment validation for parsed JSON bodies.
  The existing global malformed-JSON behavior remains a reported issue.
- Validation stays at the HTTP boundary, consistent with the original service.
  Internal service calls are trusted. PUT's existing unrestricted merge can bypass
  validation; it is explicitly documented, not presented as fixed.
- Preserved the existing in-memory store, dependencies, lockfile, app startup,
  partial-update behavior, and completion timestamp semantics. Coverage is now
  checked against an 80% global threshold for all four metrics.

## Verification

Verified on Windows with Node.js **v24.19.0**, npm **10.9.2**, and the original
locked dependency versions. Standard commands, from `task-api/`:

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm test -- --runInBand
npm run coverage -- --runInBand
```

The environment did not have npm on PATH, so the equivalent commands were run
through a workspace-local npm CLI. No package or lockfile edits were required.

The initial 77 tests ran against untouched source: **49 passed, 28 failed**.
Failures reproduced the three fixed bugs and missing assignment feature. After
implementation and adding 24 validator cases: **101 passed, 0 failed, 0 skipped**
across three suites. Tests reset the store between cases; service time-boundary
tests use a fixed clock. Integration tests use the real Express app and service.

Actual coverage summary:

```text
File             | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
-----------------|---------|----------|---------|---------|------------------
All files        |   98.64 |    97.61 |   96.55 |   98.52 |
 src             |   84.61 |       75 |      50 |   84.61 |
  app.js         |   84.61 |       75 |      50 |   84.61 | 17-18
 src/routes      |     100 |      100 |     100 |     100 |
  tasks.js       |     100 |      100 |     100 |     100 |
 src/services    |     100 |    94.11 |     100 |     100 |
  taskService.js |     100 |    94.11 |     100 |     100 | 22
 src/utils       |     100 |      100 |     100 |     100 |
  validators.js  |     100 |      100 |     100 |     100 |
-----------------|---------|----------|---------|---------|------------------
Test Suites: 3 passed, 3 total
Tests:       101 passed, 101 total
```

Uncovered Jest paths are executable server startup and the statistics guard for
invalid stored statuses. The latter is reachable through the existing validation
bug. High coverage does not mean the reported open bugs are fixed. Local HTML
coverage is generated at `task-api/coverage/lcov-report/index.html` and remains
gitignored.

A separate live-process smoke check passed for server startup, creation,
assignment, completion with priority/assignee preservation, deletion, and an empty
final list. That check started and stopped its own local server.

## Short note for the reviewer

With more time, the next tests would cover combined filtering/pagination, strict
input schemas and protected-field updates, completion/reopening semantics, and
malformed/oversized bodies, followed by restart persistence and concurrent updates
once storage is defined. The surprising parts were the conflicting status names
in the brief and README, substring enum matching, and completion resetting an
unrelated priority field; the tradeoff was to fix the three isolated defects and
report broader contract changes instead of expanding the assignment into an API
redesign. Before production, the questions are who may read, modify, or assign a
task; whether assignees identify real users; how reassignment/unassignment and
completion timestamps should work; whether PUT replaces or merges; and what
persistence, pagination limits, date formats, and error contract are required.

## Source provenance and submission

This is **AdvaithD-572's solution** to
[The Untested API assignment](https://github.com/rohit-ups/Take-Home-Assignment-The-Untested-API).
The original brief is preserved in `ASSIGNMENT.md`. A public source archive was
used because the supplied Git runtime lacks its HTTPS transport, so the local
baseline does not share upstream Git ancestry.

The repository includes the source, tests, bug report, and coverage summary needed
for review. Read through the implementation and decisions before sharing the
repository link so the submission reflects your understanding, as requested by
the original README's AI-tools note.

## Changed files

- `README.md`
- `BUG_REPORT.md` (new)
- `SUBMISSION.md` (new)
- `task-api/jest.config.js`
- `task-api/src/routes/tasks.js`
- `task-api/src/services/taskService.js`
- `task-api/src/utils/validators.js`
- `task-api/tests/taskService.test.js` (new)
- `task-api/tests/tasks.test.js` (new)
- `task-api/tests/validators.test.js` (new)
