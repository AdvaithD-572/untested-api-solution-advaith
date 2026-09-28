const { validateCreateTask, validateUpdateTask, validateAssignTask } = require('../src/utils/validators');

describe('create and update validation', () => {
  test.each(['todo', 'in_progress', 'done'])('accepts documented status %s', (status) => {
    expect(validateCreateTask({ title: 'Task', status })).toBeNull();
    expect(validateUpdateTask({ status })).toBeNull();
  });

  test.each(['low', 'medium', 'high'])('accepts documented priority %s', (priority) => {
    expect(validateCreateTask({ title: 'Task', priority })).toBeNull();
    expect(validateUpdateTask({ priority })).toBeNull();
  });

  test.each([null, '2030-01-01T00:00:00.000Z'])('accepts optional due date %j', (dueDate) => {
    expect(validateCreateTask({ title: 'Task', dueDate })).toBeNull();
    expect(validateUpdateTask({ dueDate })).toBeNull();
  });

  test('allows an empty update while requiring a title on creation', () => {
    expect(validateUpdateTask({})).toBeNull();
    expect(validateCreateTask({})).toBe('title is required and must be a non-empty string');
  });
});

describe('assignment validation', () => {
  test.each([undefined, null, {}, [], { assignee: null }, { assignee: 1 },
    { assignee: true }, { assignee: {} }, { assignee: [] }, { assignee: '' },
    { assignee: ' \t\n ' }])('rejects %j', (body) => {
    expect(validateAssignTask(body)).toBe('assignee must be a non-empty string');
  });

  test.each(['Ada', '  Ada Lovelace  ', '李 明', "Jean-Luc O'Neill"])('accepts name %j without mutating the input', (assignee) => {
    const body = { assignee };
    expect(validateAssignTask(body)).toBeNull();
    expect(body).toEqual({ assignee });
  });
});
