import { mkdirSync, writeFileSync } from 'node:fs';

const scenarioCount = Number(process.argv[2] ?? 40);
const clicksPerScenario = Number(process.argv[3] ?? 12);
const trivialStepsPerScenario = Number(process.argv[4] ?? 50);

const feature = (title, stepsOf) =>
	[
		`Feature: ${title}`,
		'',
		...Array.from({ length: scenarioCount }, (_, index) =>
			[`  Scenario: ${title} ${index + 1}`, ...stepsOf().map(step => `    ${step}`), ''].join('\n')
		)
	].join('\n');

const counterSteps = () => [
	'Given I open the counter page',
	...Array.from({ length: clicksPerScenario }, (_, click) => [
		'When I click the increment button',
		`Then the counter shows ${click + 1}`
	]).flat()
];

const trivialSteps = () => Array.from({ length: trivialStepsPerScenario }, () => 'When I run a trivial step');

const target = name => new URL(`../cypress/e2e/${name}.feature`, import.meta.url);

mkdirSync(new URL('../cypress/e2e/', import.meta.url), { recursive: true });
writeFileSync(target('counter'), feature('Counter', counterSteps));
writeFileSync(target('trivial'), feature('Trivial', trivialSteps));

console.log(`counter.feature: ${scenarioCount} scenarios x ${counterSteps().length} steps (browser clicks and assertions)`);
console.log(`trivial.feature: ${scenarioCount} scenarios x ${trivialSteps().length} steps (no browser interaction)`);
