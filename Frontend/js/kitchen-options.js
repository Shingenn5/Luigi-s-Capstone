export const STAGES = ['Pending', 'Preparing', 'In oven', 'Ready'];
export const TERMINAL_STAGES = ['Completed', 'Cancelled'];
export const stageLabel = (stage) => (stage === 'Pending' ? 'New' : stage);
export const advanceLabel = (stage, hasPizza) =>
  ({
    Pending: 'Start preparing',
    Preparing: hasPizza ? 'Send to oven' : 'Mark ready',
    'In oven': 'Mark ready',
    Ready: 'Complete handoff',
  })[stage];
export function nextStage(stage, hasPizza) {
  const flow = hasPizza
    ? [...STAGES, 'Completed']
    : ['Pending', 'Preparing', 'Ready', 'Completed'];
  return flow[flow.indexOf(stage) + 1];
}
