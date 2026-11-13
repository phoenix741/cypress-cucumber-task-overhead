import { addCucumberPreprocessorPlugin } from '@badeball/cypress-cucumber-preprocessor';
import { createEsbuildPlugin } from '@badeball/cypress-cucumber-preprocessor/esbuild';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';
import { defineConfig } from 'cypress';
import cypressOnFix from 'cypress-on-fix';

import { batchCucumberTasks } from './cypress/plugins/cucumber-task-batching';
import { countTaskRoundTrips } from './cypress/plugins/task-stats';

export default defineConfig({
	e2e: {
		specPattern: 'cypress/e2e/**/*.feature',
		supportFile: 'cypress/support/e2e.ts',
		screenshotOnRunFailure: false,
		async setupNodeEvents(on, config) {
			const fixedOn = cypressOnFix(on);
			const stats = countTaskRoundTrips(fixedOn);
			const isBatched = String(config.expose.batchTasks) === 'true';

			await addCucumberPreprocessorPlugin(isBatched ? batchCucumberTasks(stats.on) : stats.on, config);

			fixedOn('file:preprocessor', createBundler({ plugins: [createEsbuildPlugin(config)] }));
			fixedOn('after:run', () => {
				console.log(stats.summary());
			});

			return config;
		}
	}
});
