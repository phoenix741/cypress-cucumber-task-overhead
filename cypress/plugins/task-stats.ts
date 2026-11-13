import { monitorEventLoopDelay } from 'node:perf_hooks';

type TaskHandler = (argument: unknown) => unknown;

interface TaskStats {
	on: Cypress.PluginEvents;
	summary: () => string;
}

const STEP_FINISHED_TASK = 'cypress-cucumber-preprocessor:test-step-finished';
const SLICES = 5;

const average = (values: readonly number[]): number =>
	values.length === 0 ? 0 : values.reduce((total, value) => total + value, 0) / values.length;

/**
 * Wraps `on` to count the cy.task round trips received by the plugin process, the time spent in their handlers
 * (overall and for `test-step-finished` along the run) and the event loop delay of the plugin process.
 * @param on Original Cypress plugin event registry
 * @returns The wrapped registry and a function formatting the collected numbers
 */
export function countTaskRoundTrips(on: Cypress.PluginEvents): TaskStats {
	const stats = { roundTrips: 0, handlerMilliseconds: 0 };
	const stepFinishedMilliseconds: number[] = [];
	const eventLoopDelay = monitorEventLoopDelay({ resolution: 10 });
	eventLoopDelay.enable();

	const measured =
		(name: string, handler: TaskHandler): TaskHandler =>
		async argument => {
			const start = performance.now();
			try {
				return await handler(argument);
			} finally {
				const elapsed = performance.now() - start;
				stats.roundTrips++;
				stats.handlerMilliseconds += elapsed;
				if (name === STEP_FINISHED_TASK) {
					stepFinishedMilliseconds.push(elapsed);
				}
			}
		};

	const wrappedOn = ((event: string, handler: unknown) => {
		if (event !== 'task') {
			return on(event as 'task', handler as Cypress.Tasks);
		}
		const tasks = Object.fromEntries(
			Object.entries(handler as Record<string, TaskHandler>).map(([name, taskHandler]) => [
				name,
				measured(name, taskHandler)
			])
		);
		return on('task', tasks);
	}) as Cypress.PluginEvents;

	return {
		on: wrappedOn,
		summary: () => {
			const size = Math.ceil(stepFinishedMilliseconds.length / SLICES);
			const slices = Array.from({ length: SLICES }, (_, index) =>
				average(stepFinishedMilliseconds.slice(index * size, (index + 1) * size)).toFixed(2)
			);
			return [
				`[task-stats] roundTrips=${stats.roundTrips} handlerMs=${Math.round(stats.handlerMilliseconds)}`,
				`[task-stats] stepFinishedHandlerMsByFifth=${slices.join('|')}`,
				`[task-stats] eventLoopDelayMs p50=${(eventLoopDelay.percentile(50) / 1e6).toFixed(0)} p99=${(eventLoopDelay.percentile(99) / 1e6).toFixed(0)} max=${(eventLoopDelay.max / 1e6).toFixed(0)}`
			].join('\n');
		}
	};
}
