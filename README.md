# Untested API — My Solution

Assignment solution by **AdvaithD-572**, based on
[rohit-ups/Take-Home-Assignment-The-Untested-API](https://github.com/rohit-ups/Take-Home-Assignment-The-Untested-API).

Includes service and API tests, three bug fixes, and task assignment/reassignment.
All **101 tests pass**, with **98.64% statement coverage**. See
[BUG_REPORT.md](./BUG_REPORT.md) for findings and
[SUBMISSION.md](./SUBMISSION.md) for verification and design decisions.

## Original assignment overview

A 2-day take-home assignment. You'll read unfamiliar code, write tests, track down bugs, and ship a small feature.

Read **[ASSIGNMENT.md](./ASSIGNMENT.md)** for the full brief before you start.

---

## A note on AI tools

You're welcome to use AI tools. What we're evaluating is your ability to read and reason about unfamiliar code — so your submission should reflect your own understanding, not just generated output.

Concretely:
- For each bug you report: include where in the code it lives and why it happens
- For the feature you implement: briefly explain the design decisions you made
- If something surprised you or you had to make a tradeoff, say so

---

## Getting Started

**Prerequisites:** Node.js 18+

```bash
cd task-api
npm install
npm start        # runs on http://localhost:3000
```

**Tests:**

```bash
npm test           # run test suite
npm run coverage   # run with coverage report
```

---

## Project Structure

```
task-api/
  src/
    app.js                  # Express app setup
    routes/tasks.js         # Route handlers
    services/taskService.js # Business logic + in-memory data store
    utils/validators.js     # Input validation helpers
  tests/                    # Your tests go here
  package.json
  jest.config.js
ASSIGNMENT.md               # Full brief — read this first
```

> The data store is in-memory. It resets every time the server restarts.

---

## API Reference

| Method   | Path                      | Description                              |
|----------|---------------------------|------------------------------------------|
| `GET`    | `/tasks`                  | List all tasks. Supports `?status=`, `?page=`, `?limit=` |
| `POST`   | `/tasks`                  | Create a new task                        |
| `PUT`    | `/tasks/:id`              | Update supplied fields; omitted fields are preserved |
| `DELETE` | `/tasks/:id`              | Delete a task (returns 204)              |
| `PATCH`  | `/tasks/:id/complete`     | Mark a task as complete                  |
| `GET`    | `/tasks/stats`            | Counts by status + overdue count         |
| `PATCH`  | `/tasks/:id/assign`       | Assign or reassign a task to a name       |

### Task shape

```json
{
  "id": "uuid",
  "title": "string",
  "description": "string",
  "status": "todo | in_progress | done",
  "priority": "low | medium | high",
  "dueDate": "ISO 8601 or null",
  "completedAt": "ISO 8601 or null",
  "createdAt": "ISO 8601"
}
```

After assignment, the task also contains an `assignee` string. Unassigned tasks
omit that field. Status names follow `ASSIGNMENT.md` and the existing code.

### Sample requests

**Create a task**
```bash
curl -X POST http://localhost:3000/tasks \
  -H "Content-Type: application/json" \
  -d '{"title": "Write tests", "priority": "high"}'
```

**List tasks with filter**
```bash
curl "http://localhost:3000/tasks?status=todo"
```

List a page (pages start at 1)
```bash
curl "http://localhost:3000/tasks?page=1&limit=10"
```

Filtering and pagination currently work separately; combining them is a known
issue documented in [BUG_REPORT.md](./BUG_REPORT.md).

**Mark complete**
```bash
curl -X PATCH http://localhost:3000/tasks/<id>/complete
```

Assign or reassign
```bash
curl -X PATCH http://localhost:3000/tasks/<id>/assign \
  -H "Content-Type: application/json" \
  -d '{"assignee": "Ada Lovelace"}'
```

The endpoint returns the updated task with status 200. Names are trimmed; missing,
blank, or non-string names return 400. Reassignment replaces the previous name,
and completed tasks can be assigned. Unknown task IDs return 404 before assignment
validation. Other body fields are ignored. These rules apply to parsed JSON bodies;
the existing global malformed-JSON handling is a known issue in the bug report.

See [SUBMISSION.md](./SUBMISSION.md) for test results, design decisions, limitations,
and submission steps.

---

## What to Submit

See [ASSIGNMENT.md](./ASSIGNMENT.md) for full submission requirements. At minimum, include:

- **Test files** — covering the endpoints and edge cases you identified
- **Bug report** — what you found, where in the code, and why it's a bug (not just symptoms)
- **At least one fix** — with a note on your approach
- **`PATCH /tasks/:id/assign` implementation** — plus a short explanation of any design decisions (validation, edge cases, etc.)
