import { requireThat } from './security.mjs';

// Scheduling — UTC milliseconds on the wire; server time decides visibility and lateness.
// A due date is advisory: late work stays accepted without an automatic grade penalty.
export function released(item, now) {
  return !!item.published && !item.archived && (item.publish_at == null || item.publish_at <= now);
}

export function scheduleFields(data) {
  for (const key of ['publish_at', 'due_at'])
    requireThat(data[key] === null || Number.isSafeInteger(data[key]) && data[key] > 0 && data[key] <= 4102444800000,
      400, 'Use a valid date through 2100, or clear the date.');
  requireThat(typeof data.published === 'boolean', 400, 'Choose draft, publish now or scheduled publishing.');
  requireThat(data.publish_at === null || data.published, 400, 'A scheduled entry must be enabled for publishing.');
  requireThat(data.publish_at === null || data.due_at === null || data.due_at > data.publish_at,
    400, 'The due date must be after the scheduled publish time.');
  return {publish_at: data.publish_at, due_at: data.due_at, published: data.published ? 1 : 0};
}

export function timing(item, now, completedAt = null) {
  return {publish_at: item.publish_at ?? null, due_at: item.due_at ?? null,
    publication_state: !item.published ? 'draft' : released(item, now) ? 'published' : 'scheduled',
    completed_at: completedAt,
    due_state: item.due_at == null ? 'none' : completedAt != null
      ? completedAt > item.due_at ? 'late' : 'completed'
      : now > item.due_at ? 'overdue' : 'upcoming'};
}
