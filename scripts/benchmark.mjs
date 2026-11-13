import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const rounds = Number(process.argv[2] ?? 3);

const features = [
	{ name: 'counter.feature (clicks and assertions)', spec: 'cypress/e2e/counter.feature' },
	{ name: 'trivial.feature (no browser interaction)', spec: 'cypress/e2e/trivial.feature' }
];

const variants = [
	{ name: 'no report', args: ['--expose', 'jsonEnabled=false'] },
	{ name: 'JSON report', args: [] },
	{ name: 'JSON report + batched tasks', args: ['--expose', 'batchTasks=true'] }
];

const cypress = new URL('../node_modules/.bin/cypress', import.meta.url).pathname;
const projectRoot = new URL('..', import.meta.url).pathname;

const stripColors = text => text.replace(/\x1b\[[0-9;]*m/g, '');

const parseSeconds = output => {
	const [, minutes = '0', seconds] = output.match(/Duration:\s+(?:(\d+) minutes?,\s*)?(\d+) seconds?/) ?? [];
	return seconds === undefined ? undefined : Number(minutes) * 60 + Number(seconds);
};

const parseRoundTrips = output => Number(output.match(/\[task-stats\] roundTrips=(\d+)/)?.[1]);

const median = values => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];

const readNormalizedReport = () => {
	const path = new URL('../cypress/report/cucumber-report.json', import.meta.url);
	return JSON.stringify(JSON.parse(readFileSync(path, 'utf8')), (key, value) => (key === 'duration' ? 0 : value));
};

const measure = (feature, variant) => {
	const result = spawnSync(cypress, ['run', '--spec', feature.spec, ...variant.args], {
		cwd: projectRoot,
		encoding: 'utf8',
		maxBuffer: 1 << 28
	});
	const output = stripColors(`${result.stdout}${result.stderr}`);
	if (result.status !== 0) {
		throw new Error(`"${feature.name}" / "${variant.name}" failed with exit code ${result.status}\n${output.slice(-2000)}`);
	}
	return {
		feature: feature.name,
		variant: variant.name,
		seconds: parseSeconds(output),
		roundTrips: parseRoundTrips(output),
		report: variant.args.includes('jsonEnabled=false') ? undefined : readNormalizedReport()
	};
};

const measurements = Array.from({ length: rounds }, (_, round) =>
	features.flatMap(feature => variants.map(variant => ({ round, ...measure(feature, variant) })))
).flat();

const rowsOf = feature => {
	const base = median(
		measurements.filter(m => m.feature === feature.name && m.variant === 'no report').map(m => m.seconds)
	);
	return variants.map(variant => {
		const own = measurements.filter(m => m.feature === feature.name && m.variant === variant.name);
		const seconds = median(own.map(m => m.seconds));
		return {
			variant: variant.name,
			medianSeconds: seconds,
			allSeconds: own.map(m => m.seconds).join(', '),
			overheadVsNoReport: `${seconds - base >= 0 ? '+' : ''}${seconds - base} s (${Math.round((100 * (seconds - base)) / base)}%)`,
			roundTrips: own[0].roundTrips
		};
	});
};

const reportsIdentical = feature => {
	const reportOf = name => measurements.find(m => m.feature === feature.name && m.variant === name)?.report;
	return reportOf('JSON report') === reportOf('JSON report + batched tasks');
};

writeFileSync(
	new URL('../benchmark-results.json', import.meta.url),
	JSON.stringify({ measurements: measurements.map(({ report, ...rest }) => rest) }, null, 2)
);

features.forEach(feature => {
	console.log(`\n${feature.name}`);
	console.table(rowsOf(feature));
	console.log(`JSON reports identical with and without batching (durations ignored): ${reportsIdentical(feature)}`);
});
