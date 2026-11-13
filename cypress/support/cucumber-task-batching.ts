import {
	CUCUMBER_BATCH_TASK,
	CUCUMBER_FLUSH_TASKS,
	CUCUMBER_TASK_PREFIX,
	CucumberBatchedTask
} from '../shared/cucumber-batch';

const pending: CucumberBatchedTask[] = [];

if (String(Cypress.expose('batchTasks')) === 'true') {
	// The preprocessor sends two cy.task per step; they are sent as one call at the end of each scenario.
	Cypress.Commands.overwrite(
		'task',
		(originalTask, event: string, argument?: unknown, options?: Partial<Cypress.Loggable & Cypress.Timeoutable>) => {
			if (!event.startsWith(CUCUMBER_TASK_PREFIX)) {
				return originalTask(event, argument, options);
			}

			pending.push([event, argument]);

			return CUCUMBER_FLUSH_TASKS.has(event)
				? originalTask(CUCUMBER_BATCH_TASK, pending.splice(0), { log: false })
				: undefined;
		}
	);

	after(() => {
		if (pending.length > 0) {
			cy.task(CUCUMBER_BATCH_TASK, pending.splice(0), { log: false });
		}
	});
}
