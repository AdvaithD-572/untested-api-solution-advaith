const request = require('supertest');
const app = require('../src/app');
const service = require('../src/services/taskService');

beforeEach(() => service._reset());
afterEach(() => jest.restoreAllMocks());

const createTask = async (fields = {}) => {
  const response = await request(app).post('/tasks').send({ title: 'Test task', ...fields }).expect(201);
  return response.body;
};

describe('POST /tasks', () => {
  test('creates a task with defaults and persists it', async () => {
    const task = await createTask();
    expect(task).toMatchObject({ title: 'Test task', description: '', status: 'todo', priority: 'medium', dueDate: null, completedAt: null });
    expect(task.id).toEqual(expect.any(String));
    expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    const list = await request(app).get('/tasks').expect(200);
    expect(list.body).toEqual([task]);
  });

  test('accepts all supported optional fields', async () => {
    const fields = { title: 'Plan', description: 'Details', status: 'in_progress', priority: 'low', dueDate: '2030-01-01T00:00:00.000Z' };
    expect(await createTask(fields)).toMatchObject(fields);
  });

  test.each([{}, { title: '' }, { title: '   ' }, { title: 42 }, { title: null },
    { title: 'Task', status: 'pending' }, { title: 'Task', priority: 'urgent' },
    { title: 'Task', dueDate: 'not-a-date' }])('rejects invalid input %j without inserting a task', async (body) => {
    const response = await request(app).post('/tasks').send(body).expect(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(service.getAll()).toEqual([]);
  });
});

describe('GET /tasks', () => {
  test('lists tasks in insertion order', async () => {
    const tasks = [await createTask({ title: 'First' }), await createTask({ title: 'Second' })];
    expect((await request(app).get('/tasks').expect(200)).body).toEqual(tasks);
  });

  test('returns an empty array for an empty store', async () => {
    expect((await request(app).get('/tasks').expect(200)).body).toEqual([]);
  });

  test('filters by exact status and does not match substrings or unknown values', async () => {
    const todo = await createTask();
    await createTask({ status: 'done' });
    expect((await request(app).get('/tasks?status=todo').expect(200)).body).toEqual([todo]);
    expect((await request(app).get('/tasks?status=do').expect(200)).body).toEqual([]);
    expect((await request(app).get('/tasks?status=unknown').expect(200)).body).toEqual([]);
  });

  test('paginates from page one and handles the last and out-of-range pages', async () => {
    const tasks = [];
    for (let i = 0; i < 5; i++) tasks.push(await createTask({ title: `Task ${i}` }));
    expect((await request(app).get('/tasks?page=1&limit=2').expect(200)).body).toEqual(tasks.slice(0, 2));
    expect((await request(app).get('/tasks?page=2&limit=2').expect(200)).body).toEqual(tasks.slice(2, 4));
    expect((await request(app).get('/tasks?page=3&limit=2').expect(200)).body).toEqual(tasks.slice(4));
    expect((await request(app).get('/tasks?page=4&limit=2').expect(200)).body).toEqual([]);
  });

  test('defaults an omitted page to 1 and an omitted limit to 10', async () => {
    const tasks = [];
    for (let i = 0; i < 11; i++) tasks.push(await createTask());
    expect((await request(app).get('/tasks?limit=2').expect(200)).body).toEqual(tasks.slice(0, 2));
    expect((await request(app).get('/tasks?page=2').expect(200)).body).toEqual(tasks.slice(10));
  });
});

describe('PUT /tasks/:id', () => {
  test('updates fields and persists the result', async () => {
    const task = await createTask();
    const fields = { title: 'Edited', description: 'New details', status: 'in_progress', priority: 'high', dueDate: '2030-01-01T00:00:00.000Z' };
    const response = await request(app).put(`/tasks/${task.id}`).send(fields).expect(200);
    expect(response.body).toEqual({ ...task, ...fields });
    expect(service.findById(task.id)).toEqual(response.body);
  });

  test('preserves omitted fields and allows a deadline to be cleared', async () => {
    const task = await createTask({ dueDate: '2030-01-01T00:00:00.000Z' });
    expect((await request(app).put(`/tasks/${task.id}`).send({ dueDate: null }).expect(200)).body).toEqual({ ...task, dueDate: null });
  });

  test('returns 404 for an unknown ID', async () => {
    expect((await request(app).put('/tasks/missing').send({ title: 'Edited' }).expect(404)).body).toEqual({ error: 'Task not found' });
  });

  test.each([{ title: '' }, { title: '  ' }, { title: 42 }, { status: 'invalid' }, { priority: 'urgent' }, { dueDate: 'invalid' }])('rejects invalid fields %j without mutating the task', async (fields) => {
    const task = await createTask();
    const response = await request(app).put(`/tasks/${task.id}`).send(fields).expect(400);
    expect(response.body.error).toEqual(expect.any(String));
    expect(service.findById(task.id)).toEqual(task);
  });
});

describe('DELETE /tasks/:id', () => {
  test('returns an empty 204 response and deletes only the requested task', async () => {
    const first = await createTask();
    const second = await createTask();
    const response = await request(app).delete(`/tasks/${first.id}`).expect(204);
    expect(response.text).toBe('');
    expect((await request(app).get('/tasks').expect(200)).body).toEqual([second]);
  });

  test('returns 404 for a missing task', async () => {
    expect((await request(app).delete('/tasks/missing').expect(404)).body).toEqual({ error: 'Task not found' });
  });

  test('returns 404 when deleting the same task twice', async () => {
    const task = await createTask();
    await request(app).delete(`/tasks/${task.id}`).expect(204);
    await request(app).delete(`/tasks/${task.id}`).expect(404);
    expect(service.getAll()).toEqual([]);
  });
});

describe('PATCH /tasks/:id/complete', () => {
  test.each(['low', 'high'])('completes a task without changing %s priority', async (priority) => {
    const task = await createTask({ priority, dueDate: '2030-01-01T00:00:00.000Z' });
    const before = Date.now();
    const response = await request(app).patch(`/tasks/${task.id}/complete`).expect(200);
    expect(response.body).toEqual({ ...task, status: 'done', completedAt: expect.any(String) });
    expect(Date.parse(response.body.completedAt)).toBeGreaterThanOrEqual(before);
    expect(Date.parse(response.body.completedAt)).toBeLessThanOrEqual(Date.now());
    expect(service.findById(task.id)).toEqual(response.body);
  });

  test('returns 404 for a missing task', async () => {
    expect((await request(app).patch('/tasks/missing/complete').expect(404)).body).toEqual({ error: 'Task not found' });
  });

  test('keeps an already completed task done without creating another task', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/complete`).expect(200);
    const response = await request(app).patch(`/tasks/${task.id}/complete`).expect(200);
    expect(response.body.status).toBe('done');
    expect(service.getAll()).toHaveLength(1);
  });
});

describe('GET /tasks/stats', () => {
  test('reports status counts and overdue unfinished tasks', async () => {
    await createTask({ dueDate: '2000-01-01T00:00:00.000Z' });
    await createTask({ status: 'in_progress', dueDate: '2000-01-01T00:00:00.000Z' });
    await createTask({ status: 'done', dueDate: '2000-01-01T00:00:00.000Z' });
    await createTask({ dueDate: '2999-01-01T00:00:00.000Z' });
    expect((await request(app).get('/tasks/stats').expect(200)).body).toEqual({ todo: 2, in_progress: 1, done: 1, overdue: 2 });
  });

  test('returns all zeros for an empty store', async () => {
    expect((await request(app).get('/tasks/stats').expect(200)).body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('does not count tasks without deadlines as overdue and updates counts after deletion', async () => {
    const task = await createTask();
    expect((await request(app).get('/tasks/stats').expect(200)).body).toEqual({ todo: 1, in_progress: 0, done: 0, overdue: 0 });
    await request(app).delete(`/tasks/${task.id}`).expect(204);
    expect((await request(app).get('/tasks/stats').expect(200)).body).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });
});

describe('PATCH /tasks/:id/assign', () => {
  test('trims and persists a name while preserving all other fields', async () => {
    const task = await createTask({ priority: 'high' });
    const response = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '  Ada Lovelace  ', title: 'Ignored' }).expect(200);
    expect(response.body).toEqual({ ...task, assignee: 'Ada Lovelace' });
    expect((await request(app).get('/tasks').expect(200)).body).toEqual([response.body]);
  });

  test('supports reassignment, repeated assignment, and Unicode names', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ada' }).expect(200);
    const response = await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '李 明' }).expect(200);
    expect(response.body).toEqual({ ...task, assignee: '李 明' });
    expect((await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: '李 明' }).expect(200)).body).toEqual(response.body);
  });

  test('allows assignment of completed tasks without changing completion metadata', async () => {
    const task = await createTask();
    const completed = (await request(app).patch(`/tasks/${task.id}/complete`).expect(200)).body;
    expect((await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ada' }).expect(200)).body).toEqual({ ...completed, assignee: 'Ada' });
  });

  test.each([{}, { assignee: '' }, { assignee: ' \t\n ' }, { assignee: null }, { assignee: 42 }, { assignee: false }, { assignee: [] }, { assignee: {} }, []])('rejects invalid assignment %j without changing an existing assignee', async (body) => {
    const task = await createTask();
    const assigned = (await request(app).patch(`/tasks/${task.id}/assign`).send({ assignee: 'Ada' }).expect(200)).body;
    expect((await request(app).patch(`/tasks/${task.id}/assign`).send(body).expect(400)).body).toEqual({ error: 'assignee must be a non-empty string' });
    expect(service.findById(task.id)).toEqual(assigned);
  });

  test('rejects a missing body', async () => {
    const task = await createTask();
    await request(app).patch(`/tasks/${task.id}/assign`).expect(400);
    expect(service.findById(task.id)).toEqual(task);
  });

  test('returns 404 for a missing task with valid or invalid assignment input', async () => {
    for (const body of [{ assignee: 'Ada' }, {}]) {
      expect((await request(app).patch('/tasks/missing/assign').send(body).expect(404)).body).toEqual({ error: 'Task not found' });
    }
    expect(service.getAll()).toEqual([]);
  });
});

test('unexpected service errors return a generic 500 response', async () => {
  const log = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(service, 'getAll').mockImplementation(() => { throw new Error('private internal detail'); });
  expect((await request(app).get('/tasks').expect(500)).body).toEqual({ error: 'Internal server error' });
  expect(log).toHaveBeenCalled();
});
