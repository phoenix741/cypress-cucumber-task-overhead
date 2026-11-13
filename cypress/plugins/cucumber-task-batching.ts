import { CUCUMBER_BATCH_TASK, CUCUMBER_STEP_FINISHED_TASK, CucumberBatchedTask } from '../shared/cucumber-batch';

type TaskHandler = (argument: unknown) => unknown;
type ScreenshotHandler = (details: Cypress.ScreenshotDetails) => unknown;

interface StepFinishedArgument {
	testStepResult?: { status?: string };
}

const runSequentially = <T>(items: readonly T[], action: (item: T) => unknown): Promise<void> =>
	items.reduce<Promise<void>>(async (previous, item) => {
		await previous;
		await action(item);
	}, Promise.resolve());

const isFailedStepFinished = (name: string, argument: unknown): boolean =>
	name === CUCUMBER_STEP_FINISHED_TASK &&
	(argument as StepFinishedArgument | undefined)?.testStepResult?.status === 'FAILED';

/**
 * Wraps `on` so that the preprocessor tasks batched in the browser (see support/cucumber-task-batching.ts)
 * are replayed in order from a single round trip.
 * @param on Original Cypress plugin event registry
 * @returns Registry to hand to `addCucumberPreprocessorPlugin` instead of `on`
 */
export function batchCucumberTasks(on: Cypress.PluginEvents): Cypress.PluginEvents {
	const taskHandlers = new Map<string, TaskHandler>();
	const screenshotHandlers: ScreenshotHandler[] = [];
	const pendingScreenshots: Cypress.ScreenshotDetails[] = [];

	const attachPendingScreenshots = () => {
		const screenshots = pendingScreenshots.splice(0);
		return runSequentially(screenshotHandlers, handler =>
			runSequentially(screenshots, screenshot => handler(screenshot))
		);
	};

	on('task', {
		async [CUCUMBER_BATCH_TASK](batch: readonly CucumberBatchedTask[]) {
			await runSequentially(batch, async ([name, argument]) => {
				const handler = taskHandlers.get(name);
				if (!handler) {
					throw new Error(`Unknown cucumber task: ${name}`);
				}
				if (isFailedStepFinished(name, argument)) {
					await attachPendingScreenshots();
				}
				await handler(argument);
			});
			pendingScreenshots.splice(0);
			return null;
		}
	});

	return ((event: string, handler: unknown) => {
		if (event === 'task') {
			Object.entries(handler as Record<string, TaskHandler>).forEach(([name, taskHandler]) =>
				taskHandlers.set(name, taskHandler)
			);
		}
		if (event === 'after:screenshot') {
			screenshotHandlers.push(handler as ScreenshotHandler);
			return on('after:screenshot', details => {
				pendingScreenshots.push(details);
			});
		}
		return on(event as 'task', handler as Cypress.Tasks);
	}) as Cypress.PluginEvents;
}
