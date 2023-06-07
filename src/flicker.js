/**
 * These numbers are based on the table at
 * https://phasmophobia.fandom.com/wiki/Hunt#Other_hunt-related_behaviour
 *
 * According to the person who edits this section of the wiki (sos cili, aka
 * Skaijie), the numbers are a mixture of datamined exact values and
 * observations.
 *
 * Where there are + or - operators, that's where the values were observed
 * rather than known, and taking the full range of uncertainty in such a way as
 * to give the largest range.
 */
const FLICKER_NORMAL = Object.seal({
	visibility: [80, 300],
	invisibility: [100, 920],
	total: [300, 1000],
});
const FLICKER_DEOGEN = Object.seal({
	visibility: [200 - 20, 300 + 20],
	invisibility: [10 - 10, 400 + 20],
	total: [300 - 20, 600 + 20],
});
const FLICKER_ONI = Object.seal({
	visibility: [20 - 20, 500 + 20],
	invisibility: [10 - 10, 500 + 20],
	total: [300 - 20, 1000 + 20],
});
const FLICKER_PHANTOM = Object.seal({
	visibility: [80, 300],
	invisibility: [700, 1920],
	total: [1000, 2000],
});

/**
 * The game's algorithm is unknown, but the following is based on sos cili /
 * Skaijie's description.
 *
 * It could be that the game actually just picks random values from each range,
 * then adjusts them in some other way to fit the allowable total range, like
 * scaling them proportionally or linearly.
 */
function getFlicker(ranges) {
	// Choose any visibility term from the allowable range
	const visibleTerm = randomInRange(ranges.visibility);

	// Adjust the invisibility range so that any chosen value from it plus the
	// chosen visible term falls in the allowed total range
	const adjustedInvisibilityRange = [
		Math.max(ranges.invisibility[0], ranges.total[0] - visibleTerm),
		Math.min(ranges.invisibility[1], ranges.total[1] - visibleTerm),
	];

	if (visibleTerm + adjustedInvisibilityRange[0] < ranges.total[0]) throw new Error("Assertion error");
	if (visibleTerm + adjustedInvisibilityRange[1] > ranges.total[1]) throw new Error("Assertion error");

	// Choose any invisibility term from the adjusted allowable range
	const invisibleTerm = randomInRange(adjustedInvisibilityRange);

	return [visibleTerm, invisibleTerm];
}

/**
 * Get a bunch of flickers and turn them into an animation
 */
function getAnimation(name, ranges, targetDuration = 30e3) {
	const flickers = [];
	let totalDuration = 0;
	while (totalDuration < targetDuration) {
		const flicker = getFlicker(ranges);
		totalDuration += flicker[0] + flicker[1];
		flickers.push(flicker);
	}
	const keyframes = [];
	let elapsed = 0;
	for (const [visibleTerm, invisibleTerm] of flickers) {
		keyframes.push(`${elapsed / totalDuration * 100}% { visibility: visible; } ${(elapsed + visibleTerm) / totalDuration * 100}% { visibility: hidden; }`);
		elapsed += visibleTerm + invisibleTerm;
	}
	return [totalDuration, `@keyframes ${name} {\n\t${keyframes.join("\n\t")}\n}`];
}

function randomInRange([min, max]) {
	return min + Math.random() * (max - min);
}

/**
 * Add animations to the stylesheet
 */
function addAnimations() {
	const cssLines = [];
	for (const [name, ranges] of [
		["flicker-normal", FLICKER_NORMAL],
		["flicker-deogen", FLICKER_DEOGEN],
		["flicker-oni", FLICKER_ONI],
		["flicker-phantom", FLICKER_PHANTOM],
	]) {
		const [totalDuration, animation] = getAnimation(name, ranges);
		cssLines.push(`.${name} { animation: ${totalDuration}ms backwards infinite ${name} step-end; }`);
		cssLines.push(animation);
	}
	const stylesheet = new CSSStyleSheet();
	stylesheet.replace(cssLines.join("\n"));
	document.adoptedStyleSheets.push(stylesheet);
}

addAnimations();
