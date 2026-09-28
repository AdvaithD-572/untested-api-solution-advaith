const service = require('../src/services/taskService');

const NOW = '2026-01-15T12:00:00.000Z';

beforeEach(() => {
  service._reset();
  jest.useFakeTimers({ now: new Date(NOW) });
});

afterEach(() => jest.useRealTimers());

describe('create, read and reset', () => {
  test('creates a task with defaults and a unique ID', () => {
    const first = service.create({ title: 'First' });
    const second = service.create({ title: 'Second' });
    expect(first).toEqual({
      id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      title: 'First', description: '', status: 'todo', priority: 'medium',
      dueDate: null, completedAt: null, createdAt: NOW,
    });
    expect(second.id).not.toBe(first.id);
    expect(service.findById(first.id)).toEqual(first);
    expect(service.getAll()).toEqual([first, second]);
  });

  test('preserves explicitly supplied task fields', () => {
    const fields = {
      title: 'Task', description: 'Details', status: 'in_progress',
      priority: 'high', dueDate: '2026-02-01T00:00:00.000Z',
    };
    expect(service.create(fields)).toMatchObject(fields);
  });

  test('returns empty results for an empty store or unknown ID', () => {
    expect(service.getAll()).toEqual([]);
    expect(service.findById('missing')).toBeUndefined();
  });

  test('changing the returned array does not change store membership', () => {
    const task = service.create({ title: 'Keep me' });
    service.getAll().pop();
    expect(service.getAll()).toEqual([task]);
    service._reset();
    expect(service.getAll()).toEqual([]);
  });
});

describe('filtering and pagination', () => {
  test.each(['todo', 'in_progress', 'done'])('filters exact status %s', (status) => {
    const tasks = ['todo', 'in_progress', 'done'].map((value) =>
      service.create({ title: value, status: value }));
    expect(service.getByStatus(status)).toEqual(tasks.filter((t) => t.status === status));
  });

  test.each(['do', '', 'unknown'])('does not match partial or unknown status %j', (status) => {
    service.create({ title: 'Task' });
    expect(service.getByStatus(status)).toEqual([]);
  });

  test('uses one-based pages without gaps or overlap', () => {
    const tasks = Array.from({ length: 5 }, (_, i) => service.create({ title: `Task ${i}` }));
    expect(service.getPaginated(1, 2)).toEqual(tasks.slice(0, 2));
    expect(service.getPaginated(2, 2)).toEqual(tasks.slice(2, 4));
    expect(service.getPaginated(3, 2)).toEqual(tasks.slice(4));
    expect(service.getPaginated(4, 2)).toEqual([]);
  });

  test('paginates an empty store', () => {
    expect(service.getPaginated(1, 10)).toEqual([]);
  });
});

describe('update and remove', () => {
  test('updates supplied fields and preserves omitted fields', () => {
    const task = service.create({ title: 'Original', priority: 'high' });
    const updated = service.update(task.id, { title: 'Edited', status: 'in_progress' });
    expect(updated).toEqual({ ...task, title: 'Edited', status: 'in_progress' });
    expect(service.findById(task.id)).toEqual(updated);
  });

  test('an empty update preserves the task', () => {
    const task = service.create({ title: 'Original' });
    expect(service.update(task.id, {})).toEqual(task);
  });

  test('updating a missing ID does not affect other tasks', () => {
    const task = service.create({ title: 'Keep me' });
    expect(service.update('missing', { title: 'Edited' })).toBeNull();
    expect(service.getAll()).toEqual([task]);
  });

  test('removes only the matching task and returns false on repeated deletion', () => {
    const first = service.create({ title: 'Keep me' });
    const second = service.create({ title: 'Delete me' });
    expect(service.remove(second.id)).toBe(true);
    expect(service.getAll()).toEqual([first]);
    expect(service.remove(second.id)).toBe(false);
    expect(service.getAll()).toEqual([first]);
  });

  test('removing a missing ID from an empty store returns false', () => {
    expect(service.remove('missing')).toBe(false);
  });
});

describe('completion', () => {
  test.each(['low', 'medium', 'high'])('completes and preserves %s priority and other fields', (priority) => {
    const task = service.create({ title: 'Task', priority, description: 'Keep', dueDate: NOW });
    const completed = service.completeTask(task.id);
    expect(completed).toEqual({ ...task, status: 'done', completedAt: NOW });
    expect(service.findById(task.id)).toEqual(completed);
  });

  test('returns null for a missing task', () => {
    expect(service.completeTask('missing')).toBeNull();
  });

  test('completing one task leaves other tasks untouched', () => {
    const first = service.create({ title: 'First' });
    const second = service.create({ title: 'Second' });
    service.completeTask(first.id);
    expect(service.findById(second.id)).toEqual(second);
  });
});

describe('statistics', () => {
  test('returns zeros for an empty store', () => {
    expect(service.getStats()).toEqual({ todo: 0, in_progress: 0, done: 0, overdue: 0 });
  });

  test('counts statuses and only unfinished tasks strictly before now as overdue', () => {
    const past = '2026-01-15T11:59:59.999Z';
    service.create({ title: 'Late todo', dueDate: past });
    service.create({ title: 'Late active', status: 'in_progress', dueDate: past });
    const done = service.create({ title: 'Finished', dueDate: past });
    service.completeTask(done.id);
    service.create({ title: 'No deadline' });
    service.create({ title: 'Exactly now', dueDate: NOW });
    service.create({ title: 'Future', dueDate: '2026-01-15T12:00:00.001Z' });
    expect(service.getStats()).toEqual({ todo: 4, in_progress: 1, done: 1, overdue: 2 });
  });
});

describe('assignment', () => {
  test('stores the assignee and preserves all other fields', () => {
    const task = service.create({ title: 'Task', priority: 'high' });
    expect(service.assignTask(task.id, 'Ada Lovelace')).toEqual({ ...task, assignee: 'Ada Lovelace' });
    expect(service.findById(task.id).assignee).toBe('Ada Lovelace');
  });

  test('supports reassignment and repeated assignment', () => {
    const task = service.create({ title: 'Task' });
    service.assignTask(task.id, 'Ada');
    const reassigned = service.assignTask(task.id, 'Grace');
    expect(reassigned.assignee).toBe('Grace');
    expect(service.assignTask(task.id, 'Grace')).toEqual(reassigned);
  });

  test('returns null for an unknown task and does not mutate existing tasks', () => {
    const task = service.create({ title: 'Task' });
    expect(service.assignTask('missing', 'Ada')).toBeNull();
    expect(service.getAll()).toEqual([task]);
  });

  test('allows completed tasks to be assigned and preserves assignment on completion and update', () => {
    const task = service.create({ title: 'Task' });
    service.assignTask(task.id, 'Ada');
    expect(service.completeTask(task.id).assignee).toBe('Ada');
    const completed = service.findById(task.id);
    expect(service.assignTask(task.id, 'Grace')).toEqual({ ...completed, assignee: 'Grace' });
    expect(service.update(task.id, { title: 'Edited' }).assignee).toBe('Grace');
  });
});
