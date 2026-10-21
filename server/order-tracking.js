// Expose kitchen milestones without employee identities, notes, or cancellation reasons.
export function readOrderTracking(database, orderId) {
  const workflow = database
    .prepare(
      'SELECT revision, entered_at AS enteredAt FROM order_workflow WHERE order_id = ?',
    )
    .get(orderId);
  const events = database
    .prepare(
      'SELECT to_status AS stage, action, occurred_at AS occurredAt FROM order_events WHERE order_id = ? ORDER BY revision',
    )
    .all(orderId);
  const stages = ['Pending', 'Preparing', 'In oven', 'Ready', 'Completed'];
  const milestones = new Map();
  for (const event of events) {
    if (event.stage === 'Cancelled') continue;
    const index = stages.indexOf(event.stage);
    if (index < 0) continue;
    // A recall invalidates later milestones; cancelled orders retain their last path.
    for (const later of stages.slice(index + 1)) milestones.delete(later);
    if (event.action !== 'Imported' || event.stage === 'Pending')
      milestones.set(
        event.stage,
        event.stage === 'Pending' ? events[0].occurredAt : event.occurredAt,
      );
  }
  return {
    ...workflow,
    createdAt: events[0]?.occurredAt,
    serverTime: Date.now(),
    milestones: [...milestones].map(([stage, occurredAt]) => ({
      stage,
      occurredAt,
    })),
  };
}
