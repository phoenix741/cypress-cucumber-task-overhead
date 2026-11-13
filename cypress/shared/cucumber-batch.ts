export const CUCUMBER_TASK_PREFIX = 'cypress-cucumber-preprocessor:';
export const CUCUMBER_BATCH_TASK = 'repro:cucumber-batch';
export const CUCUMBER_STEP_FINISHED_TASK = `${CUCUMBER_TASK_PREFIX}test-step-finished`;

export const CUCUMBER_FLUSH_TASKS: ReadonlySet<string> = new Set([
	`${CUCUMBER_TASK_PREFIX}test-case-finished`,
	`${CUCUMBER_TASK_PREFIX}test-run-hook-finished`
]);

export type CucumberBatchedTask = readonly [name: string, argument: unknown];
