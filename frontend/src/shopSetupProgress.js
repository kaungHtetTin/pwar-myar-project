// Shared API stage IDs remain stable for saved web/mobile progress.
const stages = [1, 4, 5, 6, 7];
export function setupDisplayStep(stage) {
  const index = stages.findIndex(value => value >= Number(stage || 1));
  return index < 0 ? stages.length : index + 1;
}
export const setupServerStage = step => stages[Math.max(0, Math.min(stages.length - 1, step - 1))];
export const nextSetupProgress = step => ({ status: step === stages.length ? 'complete' : 'pending', step: setupServerStage(Math.min(stages.length, step + 1)), version: 2 });
