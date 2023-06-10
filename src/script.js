const ROLLING_AVERAGE_MS = 2e3;

const MAX_GHOST_LOS_SPEEDUP_MULTIPLIER = 1.65;
const MAX_GHOST_LOS_SPEEDUP_PERIOD_S = 13;
const NORMAL_SPEED = 1.7;
const JINN_LOS_SPEED = 2.5;
const JINN_BOOST_MIN_DISTANCE = 3;
const REVENANT_SLOW_SPEED = 1;
const REVENANT_FAST_SPEED = 3;
const TWIN_SLOW_SPEED = 1.5;
const TWIN_FAST_SPEED = 1.9;
const RAIJU_ELECTRONICS_SPEED = 2.5;
const MOROI_MAX_SPEED = 2.25;
const MOROI_MIN_SPEED = 1.5;
const MOROI_MAX_AT_SANITY = 0;
const MOROI_MIN_AT_SANITY = 0.5;
const DEOGEN_MIN_SPEED = 0.4;
const DEOGEN_MAX_SPEED = 3;
const DEOGEN_MIN_DISTANCE = 2.5;
const DEOGEN_MAX_DISTANCE = 6;
const DEOGEN_SPEED_TARGETLESS = 1.6;
const THAYE_MAX_SPEED = 2.75; // This is correct according to the wiki, and also to https://store.steampowered.com/news/app/739630/view/3339995286952592740, but the speed info on Discord at https://discord.com/channels/435431947963990026/1034831196674347088/1036343193853235311 disagrees and says 2.7m/s. 2.75m/s makes more sense given the other numbers. Assumption: 2.75 is correct.
const THAYE_MIN_SPEED = 1;
const THAYE_AGE_MIN_S = 60;
const THAYE_AGE_MAX_S = 120;
const THAYE_SPEED_NERF_PER_AGE = 0.175;
const HANTU_MAX_SPEED = 2.7; // The available information is ambiguous on the boundaries between these speed steps.
const HANTU_0_3_SPEED = 2.5;
const HANTU_3_6_SPEED = 2.4;
const HANTU_6_9_SPEED = 2.3;
const HANTU_9_12_SPEED = 2.1;
const HANTU_12_15_SPEED = 1.75;
const HANTU_MIN_SPEED = 1.4;

const SLOWEST_SPEED = DEOGEN_MIN_SPEED;
const FASTEST_SPEED = Math.max(Math.max(MOROI_MAX_SPEED, NORMAL_SPEED) * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER, REVENANT_FAST_SPEED, DEOGEN_MAX_SPEED, THAYE_MAX_SPEED, HANTU_MAX_SPEED, JINN_LOS_SPEED);

const SMUDGE_HUNT_SHORT_S = 60;
const SMUDGE_HUNT_NORMAL_S = 90;
const SMUDGE_HUNT_LONG_S = 180;

const NARROW_BY_TEMPO_LEEWAY = 0.05;

const byId = document.getElementById.bind(document);

const secondsFormatter = new Intl.NumberFormat("en", { style: "unit", unit: "second" });
const minutesFormatter = new Intl.NumberFormat("en", { style: "unit", unit: "minute", maximumFractionDigits: 1 });
const timerFormatter = new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("en", { style: "percent" });
const meterFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 1, maximumSignificantDigits: 2, style: "unit", unit: "meter" });

function getPreferencesFromForm() {
	return Object.fromEntries(new FormData(byId("preferences")));
}

function getPreferencesFromLocalStorage() {
	const saved = localStorage.getItem("preferences");
	try {
		const prefs = JSON.parse(saved);
		return prefs;
	} catch {
		return null;
	}
}

function setPreferences(prefs) {
	if (prefs == null) return;
	for (const [name, value] of Object.entries(prefs)) {
		try {
			byId("preferences").elements[name].value = value;
		} catch {
			console.error(`No such preference "${name}"`);
		}
	}
}

function savePreferences(prefs) {
	localStorage.setItem("preferences", JSON.stringify(prefs));
}

function tempoFromSpeed(speed) {
	// I took average tempos over a dozen or so full hunts of normal-speed ghosts,
	// with no line of sight, at Camp Woodwind, at all selectable ghost speed
	// multipliers.
	//
	// - 50% (0.85m/s): 54.0bpm
	// - 75% (1.275m/s): 83.3bpm
	// - 100% (1.7m/s): 115.3bpm
	// - 125% (2.125m/s): 147.7bpm
	// - 150% (2.55m/s): 184.9bpm
	//
	// It's easy to tell by plotting these that they're not quite linear. The
	// error is larger than I'd like to see at the extremes, and that's without
	// even making the line of best fit pass through 0,0.
	//
	// The following coefficients are based on a quadratic regression of
	// the above observations, plus a data point at 0,0.
	//
	// I based the quadratic on the normal-speed ghosts since they are the easiest
	// to measure (since they're most consistently found in games), and they have
	// known speeds.
	//
	// To verify, I also took average tempos over several full hunts of other
	// ghosts, also at Camp Woodwind. These were all done at 100% ghost speed.
	// Speeds are taken from the developer notes on Discord
	// (https://discord.com/channels/435431947963990026/1034831196674347088/1036343193853235311).
	//
	// - Revenant min (1m/s): 64.25bpm
	// - Revenant max (3m/s): 210.99bpm (this is rough; very hard to measure)
	// - Twin fast (1.9m/s): 130.64bpm
	// - Twin slow (1.5m/s): 100.03bpm
	// - Moroi max (2.25m/s): 158.95bpm
	//
	// When plotted, the quadratic regression fits very closely with all
	// observations.
	return 5.495996 * speed * speed + 58.2207731 * speed + 0.1638571;
}

function getSpeedMultiplier() {
	const value = byId("ghost-speed").value;
	switch (value) {
		case "50": return 0.5;
		case "75": return 0.75;
		case "100": return 1;
		case "125": return 1.25;
		case "150": return 1.5;
		default: throw new Error(`Unexpected ghost speed value "${value}"`);
	}
}

let taps = [];

function init() {
	setPreferences(getPreferencesFromLocalStorage());
	byId("ghost-speed").addEventListener("change", () => updateGhostSpeed());
	byId("tap-target").addEventListener("keydown", handleTapKeyDown);
	byId("reset-tempo").addEventListener("click", () => resetTempo());
	byId("narrow-by-tempo").addEventListener("click", () => narrowByTempo());
	byId("clear-rulings-by-tempo").addEventListener("click", () => clearRulingsByTempo());
	byId("line-of-sight").addEventListener("input", () => updateLineOfSight());
	byId("line-of-sight-known").addEventListener("input", () => updateLineOfSightKnown());
	byId("temperature").addEventListener("input", () => updateTemperature());
	byId("temperature-known").addEventListener("input", () => updateTemperatureKnown());
	byId("temperature-unit").addEventListener("change", () => {
		savePreferences(getPreferencesFromForm());
		updateTemperature();
	});
	byId("sanity").addEventListener("input", () => updateSanity());
	byId("sanity-known").addEventListener("change", () => updateSanityKnown());
	byId("ghost-distance").addEventListener("input", () => updateGhostDistance());
	byId("ghost-distance-known").addEventListener("change", () => updateGhostDistanceKnown());
	byId("time-spent-near-ghost").addEventListener("input", () => updateTimeSpentNearGhost());
	byId("time-spent-near-ghost-known").addEventListener("change", () => updateTimeSpentNearGhostKnown());
	byId("evidence-num").addEventListener("change", () => updateEvidenceNum());
	for (const radio of document.querySelectorAll(`.evidence-list input[type="radio"]`)) {
		radio.addEventListener("change", () => updateEvidence());
	}
	for (const range of document.querySelectorAll(`.evidence-list input[type="range"]`)) {
		range.addEventListener("input", () => updateEvidence());
	}
	byId("hunt-sanity-range").addEventListener("input", () => updateHuntSanityRangeReadout());
	for (const input of document.querySelectorAll("#ghosts input")) {
		input.addEventListener("change", () => {
				updateResetManualRuleOuts();
				updateEvidence();
		});
	}
	for (const label of document.querySelectorAll("#ghosts label")) {
		label.addEventListener("keydown", (event) => {
			if (event.key === " ") {
				event.preventDefault();
				label.closest("#ghosts li").querySelector("input").click();
			}
		});
	}
	for (const radio of document.querySelectorAll(`#ghost-speed input[type="radio"]`)) {
		radio.addEventListener("change", () => updateSpeedMarkers());
	}
	byId("tap").addEventListener("click", () => handleTap());
	byId("game-setup-form").addEventListener("reset", () => {
		requestAnimationFrame(() => {
			updateAll();
		});
	});
	byId("observations-form").addEventListener("reset", () => {
		resetTempo();
		clearRulingsByTempo();
		requestAnimationFrame(() => {
			updateAll();
		});
	});
	byId("reset-manual-rule-outs").addEventListener("click", () => resetManualRuleOuts());
	byId("timer-start-stop").addEventListener("click", () => startStopTimer());
	byId("timer-adjust").addEventListener("input", () => updateTimerAdjust());
	for (const button of document.querySelectorAll("#chart .ghost .label button")) {
		button.addEventListener("click", () => {
			byId(button.closest("div.ghost").dataset.ghost).classList.add("impossible-by-speed");
			updateClearRulingsByTempo();
			updateEvidence();
		});
	}
	updateAll();
	const resizeObserver = new ResizeObserver(() => resizeTapTraceCanvas());
	resizeObserver.observe(byId("tap-trace"));
	resizeTapTraceCanvas();
}

function updateAll() {
	updateLineOfSightKnown();
	updateTemperatureKnown();
	updateSanityKnown();
	updateGhostDistanceKnown();
	updateTimeSpentNearGhostKnown();
	updateGhostSpeed();
	updateEvidenceNum();
	updateTimerAdjust();
	updateHuntSanityRangeReadout();
	updateClearRulingsByTempo();
	updateResetManualRuleOuts();
}

function updateHuntSanityRangeReadout() {
	document.querySelector(`output[for="hunt-sanity-range"]`).textContent = percentFormatter.format(parseInt(byId("hunt-sanity-range").value) / 100);
}

function updateGhostSpeed() {
	byId("adjusted-average-tempo-box").hidden = getSpeedMultiplier() === 1;
	updateSpeedMarkers();
	updateTempos();
	updateTapTrace();
}

function resizeTapTraceCanvas() {
	const tapTrace = byId("tap-trace")
	tapTrace.width = Math.round(tapTrace.clientWidth * devicePixelRatio);
	tapTrace.height = Math.round(tapTrace.clientHeight * devicePixelRatio);
	updateTapTrace();
}

function handleTapKeyDown(event) {
	if (event.key === "Escape") {
		event.preventDefault();
		if (taps.length === 0) document.activeElement.blur();
		else resetTempo();
		return;
	}
	if (event.key.length === 1) {
		event.preventDefault();
		handleTap();
		return;
	}
}

function resetManualRuleOuts() {
	for (const input of document.querySelectorAll("#ghosts input"))
		input.checked = false;
	updateResetManualRuleOuts();
	updateEvidence();
}

function getSanityKnown() {
	return byId("sanity-known").checked;
}

function getSanity() {
	if (!getSanityKnown()) return null;
	return parseInt(byId("sanity").value) / 100;
}

function updateSanityKnown() {
	byId("sanity").disabled = !getSanityKnown();
	updateSanity();
}

function getSanityReadout() {
	if (!getSanityKnown()) return "unknown";
	return percentFormatter.format(getSanity());
}

function updateSanity() {
	byId("sanity-readout").textContent = getSanityReadout();
	updateSpeedMarkers();
}

function getGhostDistanceKnown() {
	return byId("ghost-distance-known").checked;
}

function getGhostDistance() {
	if (!getGhostDistanceKnown()) return null;
	return parseFloat(byId("ghost-distance").value);
}

function updateGhostDistanceKnown() {
	byId("ghost-distance").disabled = !getGhostDistanceKnown();
	updateGhostDistance();
}

function getGhostDistanceReadout() {
	if (!getGhostDistanceKnown()) return "unknown";
	const value = getGhostDistance();
	return meterFormatter.format(value);
}

function updateGhostDistance() {
	byId("ghost-distance-readout").textContent = getGhostDistanceReadout();
	updateSpeedMarkers();
}

function getTimeSpentNearGhostKnown() {
	return byId("time-spent-near-ghost-known").checked;
}

function getTimeSpentNearGhost() {
	if (!getTimeSpentNearGhostKnown()) return null;
	return parseInt(byId("time-spent-near-ghost").value) * 60;
}

function updateTimeSpentNearGhostKnown() {
	byId("time-spent-near-ghost").disabled = !getTimeSpentNearGhostKnown();
	updateTimeSpentNearGhost();
}

function getTimeSpentNearGhostReadout() {
	if (!getTimeSpentNearGhostKnown()) return "unknown";
	const value = getTimeSpentNearGhost();
	return minutesFormatter.format(value / 60);
}

function updateTimeSpentNearGhost() {
	byId("time-spent-near-ghost-readout").textContent = getTimeSpentNearGhostReadout();
	updateSpeedMarkers();
}

function getLineOfSight() {
	if (!getLineOfSightKnown()) return null;
	return parseInt(byId("line-of-sight").value);
}

function getLineOfSightKnown() {
	return byId("line-of-sight-known").checked;
}

function getLineOfSightReadout() {
	if (!getLineOfSightKnown()) return "unknown";
	return secondsFormatter.format(getLineOfSight());
}

function updateLineOfSight() {
	byId("line-of-sight-readout").textContent = getLineOfSightReadout();
	updateSpeedMarkers();
}

function updateLineOfSightKnown() {
	byId("line-of-sight").disabled = !getLineOfSightKnown();
	updateLineOfSight();
}

function getTemperature() {
	if (!getTemperatureKnown()) return null;
	return parseInt(byId("temperature").value);
}

function getTemperatureKnown() {
	return byId("temperature-known").checked;
}

function getTemperatureUnit() {
	return byId("temperature-unit").value;
}

function getTemperatureReadout() {
	let temp = getTemperature();
	if (temp == null) return "unknown";
	return formatTemperature(temp);
}

function updateTemperature() {
	byId("temperature-readout").textContent = getTemperatureReadout();
	updateSpeedMarkers();
}

function updateTemperatureKnown() {
	byId("temperature").disabled = !getTemperatureKnown();
	updateTemperature();
}

function getEvidenceNum() {
	return parseInt(byId("evidence-num").value);
}

function updateEvidenceNum() {
	const evidenceNum = getEvidenceNum();
	document.documentElement.classList.toggle("evidence-num-some", evidenceNum > 0);
	document.documentElement.classList.toggle("evidence-num-one", evidenceNum === 1);
	document.documentElement.classList.toggle("evidence-num-all", evidenceNum >= 3);
	updateEvidence();
}

const allPrimaryEvidence = new Set([...document.querySelectorAll(`#primary-evidence [type="radio"][value="yes"]`)].map((radio) => radio.name));

function radioTristate(name) {
	const value = document.querySelector(`[name="${name}"]:checked`).value;
	if (value === "unknown") return null;
	return value === "yes";
}

function evidenceName(evidence) {
	return byId(evidence).dataset.name;
}

function setWith(baseSet, newMember) {
	const newSet = new Set(baseSet);
	newSet.add(newMember);
	return newSet;
}
function setExclude(a, ...others) {
	const newSet = new Set(a);
	for (const toExclude of others)
		for (const item of toExclude)
			newSet.delete(item);
	return newSet;
}

function ghostImpossible(numCollectable, ghostContainer, confirmedEvidence, ruledOutEvidence, secondaryClasses = [], withReasons) {
	const classList = ghostContainer.classList;

	const confirmedMinusSpecial = new Set(confirmedEvidence);
	for (const evidence of confirmedEvidence)
		if (classList.contains(`special-${evidence}`))
			confirmedMinusSpecial.delete(evidence);

	const normalEvidence = [...allPrimaryEvidence].filter((evidence) => classList.contains(evidence));

	const reasons = {
		primary: new Set(),
		secondary: new Set(),
	};

	// Ghost is ruled out unless every confirmed evidence is something exhibited
	// by the ghost as normal or special evidence
	if (![...confirmedEvidence].every((evidence) => classList.contains(evidence) || classList.contains(`special-${evidence}`))) {
		if (withReasons) reasons.primary.add(`it cannot exhibit at least one confirmed evidence type`);
		else return true;
	}

	// Ghost is ruled out in zero evidence mode if something it exhibits as
	// special evidence has been ruled out
	if (numCollectable === 0 && [...ruledOutEvidence].some((evidence) => classList.contains(`special-${evidence}`))) {
		if (withReasons) reasons.primary.add(`even with zero collectable evidence it must exhibit particular evidence`);
		else return true;
	}

	// Ghost is ruled out if one or more evidence is collectable and something
	// it exhibits as guaranteed or special evidence has been ruled out
	if (numCollectable > 0 && [...ruledOutEvidence].some((evidence) => classList.contains(`guaranteed-${evidence}`) || classList.contains(`special-${evidence}`))) {
		if (withReasons) reasons.primary.add(`it has particular guaranteed evidence which has been ruled out`);
		else return true;
	}

	// Ghost is ruled out if one ore more envidence is collectable, we have
	// collected the maximum number of normal evidence items, and something it
	// exhibits as guaranteed evidence was not confirmed
	if (numCollectable > 0 && confirmedMinusSpecial.size >= numCollectable && [...setExclude(allPrimaryEvidence, confirmedMinusSpecial)].some((evidence) => classList.contains(`guaranteed-${evidence}`))) {
		if (withReasons) reasons.primary.add(`it has particular guaranteed evidence which has not been confirmed, but the maximum collectable has been reached`);
		else return true;
	}

	// Ghost is ruled out when all evidence is collectable and something it
	// exhibits as normal evidence has been ruled out
	if (numCollectable >= 3 && [...ruledOutEvidence].some((evidence) => classList.contains(evidence))) {
		if (withReasons) reasons.primary.add(`it exhibits a type of evidence which has been ruled out`);
		else return true;
	}

	// Ghost is ruled out if one or more evidence is collectable, and everything
	// it exhibits as normal evidence has been ruled out
	if (numCollectable > 0 && normalEvidence.every((evidence) => ruledOutEvidence.has(evidence))) {
		if (withReasons) reasons.primary.add(`everything it could exhibit has been ruled out`);
		else return true;
	}

	// Ghost is ruled out when more evidence has been confirmed than the ghost
	// exhibits, not taking into account collected evidence this ghost exhibits
	// as special evidence
	if (confirmedMinusSpecial.size > numCollectable) {
		if (withReasons) reasons.primary.add(`more evidence has been confirmed than it can exhibit`);
		else return true;
	}

	// Ghost is ruled out if there are the same number of still-collectable
	// evidences as the number of evidence types still marked unknown, and this
	// ghost does not exhibit at least one of the last unknown evidence types
	const unknownEvidence = setExclude(allPrimaryEvidence, confirmedEvidence, ruledOutEvidence);
	if (unknownEvidence.size > 0 && numCollectable - confirmedMinusSpecial.size === unknownEvidence.size && ![...unknownEvidence].some((evidence) => classList.contains(evidence))) {
		if (withReasons) reasons.primary.add(`the last evidence which has not yet been confirmed or ruled out is something it cannot exhibit`);
		else return true;
	}

	// Ghost is ruled out if it doesn't have any of the required secondary
	// evidence classes
	if ([...secondaryClasses].some((cls) => !classList.contains(cls))) {
		if (withReasons) reasons.secondary.add(`it doesn’t match the observed secondary evidence`);
		else return true;
	}

	if (withReasons) return reasons;
	return false;
}

function getRequiredSecondaryClasses() {
	const classes = new Set();

	for (const evidenceContainer of document.querySelectorAll("#secondary-evidence fieldset")) {
		const range = evidenceContainer.querySelector(`[type="range"]`);
		if (range != null) {
			classes.add(`${evidenceContainer.id}-${range.value}`);
			continue;
		}

		if (evidenceContainer.querySelector(`[type="radio"][value="unknown"]`).checked)
			continue;

		const value = evidenceContainer.querySelector(`[type="radio"]:checked`).value;
		classes.add(`${evidenceContainer.id}-${value}`);
	}

	return classes;
}

function ghostMarkedImpossible(ghostContainer) {
	if (ghostContainer.classList.contains("impossible-by-primary")) return true;
	if (ghostContainer.classList.contains("impossible-by-secondary")) return true;
	if (ghostContainer.classList.contains("impossible-by-speed")) return true;
	if (ghostContainer.querySelector("input").checked) return true;
	return false;
}

function updateEvidence() {
	console.time("update evidence total");
	console.time("setup");
	const numCollectable = getEvidenceNum();
	const checkedEvidenceRadios = Array.from(document.querySelectorAll(`#primary-evidence [type="radio"]:checked`));
	const confirmedEvidence = new Set(checkedEvidenceRadios.filter((radio) => radio.value === "yes").map((radio) => radio.name));
	const ruledOutEvidence = new Set(checkedEvidenceRadios.filter((radio) => radio.value === "no").map((radio) => radio.name));
	const secondaryClasses = getRequiredSecondaryClasses();

	const ghostContainers = Array.from(document.querySelectorAll("#ghosts li"));
	console.timeEnd("setup");

	console.time("rule out");
	for (const ghost of ghostContainers) {
		const impossibleReasons = ghostImpossible(numCollectable, ghost, confirmedEvidence, ruledOutEvidence, secondaryClasses, true);
		ghost.classList.toggle("impossible-by-primary", impossibleReasons.primary.size > 0);
		ghost.classList.toggle("impossible-by-secondary", impossibleReasons.secondary.size > 0);
		if (impossibleReasons.primary.size > 0 || impossibleReasons.secondary.size > 0) {
			ghost.title = `Ruled out: ${[...impossibleReasons.primary].concat([...impossibleReasons.secondary]).join("; ")}`;
		} else {
			ghost.removeAttribute("title");
		}
	}
	console.timeEnd("rule out");

	console.time("find remaining");
	const remainingGhostContainers = ghostContainers.filter((g) => !ghostMarkedImpossible(g));
	const remainingGhostsCount = remainingGhostContainers.length;
	console.timeEnd("find remaining");

	function narrowsDownTo(confirmedEvidence, ruledOutEvidence, secondaryClasses) {
		return remainingGhostContainers.reduce((acc, ghostContainer) => {
			if (ghostImpossible(numCollectable, ghostContainer, confirmedEvidence, ruledOutEvidence, secondaryClasses, false))
				return acc;
			return acc + 1;
		}, 0);
	}

	console.time("primary");
	// Loop through primary evidence types
	for (const evidenceContainer of document.querySelectorAll("#primary-evidence fieldset")) {
		const evidence = evidenceContainer.id;

		// Reset flags
		evidenceContainer.classList.remove("interesting", "investigated", "uninteresting");
		for (const controlContainer of evidenceContainer.querySelectorAll(".control-container")) {
			controlContainer.classList.remove("impossible", "inevitable");
		}

		// Mark and move on if this evidence has already been investigated
		if (!evidenceContainer.querySelector(`[type="radio"][value="unknown"]`).checked) {
			evidenceContainer.classList.add("investigated");
			continue;
		}

		// If confirming this evidence would rule out all remaining ghosts,
		// mark this impossible
		if (narrowsDownTo(setWith(confirmedEvidence, evidence), ruledOutEvidence, secondaryClasses) === 0) {
			evidenceContainer.classList.add("uninteresting");
			for (const radio of Array.from(evidenceContainer.querySelectorAll(`[type="radio"]`))) {
				if (radio.value === "no") radio.closest(".control-container").classList.add("inevitable");
				else radio.closest(".control-container").classList.add("impossible");
			}
			continue;
		}

		// If ruling out this evidence would rule out all remaining ghosts,
		// mark this impossible
		if (narrowsDownTo(confirmedEvidence, setWith(ruledOutEvidence, evidence), secondaryClasses) === 0) {
			evidenceContainer.classList.add("uninteresting");
			for (const radio of Array.from(evidenceContainer.querySelectorAll(`[type="radio"]`))) {
				if (radio.value === "yes") radio.closest(".control-container").classList.add("inevitable");
				else radio.closest(".control-container").classList.add("impossible");
			}
			continue;
		}

		// If we get to here, there's something interesting to learn from
		// investigating this evidence
		evidenceContainer.classList.add("interesting");
	}
	console.timeEnd("primary");

	console.time("secondary");
	// Loop through secondary evidence types
	secondaryEvidence: for (const evidenceContainer of document.querySelectorAll("#secondary-evidence fieldset")) {
		const evidence = evidenceContainer.id;

		// Reset flags
		evidenceContainer.classList.remove("interesting", "investigated", "uninteresting", "impossible");
		for (const controlContainer of evidenceContainer.querySelectorAll(".control-container")) {
			controlContainer.classList.remove("impossible", "inevitable");
		}

		const range = evidenceContainer.querySelector(`[type="range"]`);
		if (range != null) {
			// Can we narrow down the remaining ghosts by changing the range value?
			const min = parseInt(range.min);
			const max = parseInt(range.max);
			const step = parseInt(range.step);
			const current = parseInt(range.value);
			for (let value = max; value -= step; value >= min) {
				if (value === current) continue;
				const remaining = narrowsDownTo(confirmedEvidence, ruledOutEvidence, setWith(setExclude(secondaryClasses, `${evidence}-${current}`), `${evidence}-${value}`));
				if (remaining > 0 && remaining < remainingGhostsCount) {
					evidenceContainer.classList.add("interesting");
					continue secondaryEvidence;
				}
			}
			evidenceContainer.classList.add("investigated");
			continue;
		}

		// Mark and move on if this evidence has already been investigated
		if (!evidenceContainer.querySelector(`[type="radio"][value="unknown"]`).checked) {
			evidenceContainer.classList.add("investigated");
			continue;
		}

		// If this evidence requires a particular piece of primary evidence,
		// but that primary evidence is ruled out or impossible
		// this piece of secondary evidence is also impossible.
		for (const cls of [...evidenceContainer.classList].filter((cls) => cls.endsWith("-required"))) {
			const requiredEvidenceContainer = byId(cls.replace(/-required$/, ""));
			if (
				requiredEvidenceContainer.querySelector(`[type="radio"][value="no"]`).checked
				|| requiredEvidenceContainer.querySelector(`[type="radio"][value="yes"]`).closest(".control-container").classList.contains("impossible")
			) {
				evidenceContainer.classList.add("impossible");
				continue secondaryEvidence;
			}
		}

		// See how each of the options would affect the remaining possible ghosts
		const optionLeavesGhosts = [];
		for (const radio of Array.from(evidenceContainer.querySelectorAll(`[type="radio"]:not([value="unknown"])`))) {
			const controlContainer = radio.closest(".control-container");
			const remaining = narrowsDownTo(confirmedEvidence, ruledOutEvidence, setWith(secondaryClasses, `${evidence}-${radio.value}`));
			if (remaining === 0) controlContainer.classList.add("impossible");
			optionLeavesGhosts.push({ radio, controlContainer, remaining });
		}
		if (optionLeavesGhosts.every(({ num }) => num === remainingGhostsCount)) {
			// Makes no difference whichever option is chosen
			evidenceContainer.classList.add("uninteresting");
			continue;
		}
		if (optionLeavesGhosts.every(({ remaining }) => remaining === 0 || remaining === remainingGhostsCount)) {
			// Rules out either everything or nothing, whichever option is chosen
			evidenceContainer.classList.add("uninteresting");
			if (optionLeavesGhosts.reduce((acc, { remaining }) => remaining > 0 ? acc + 1 : acc, 0) === 1) {
				for (const { controlContainer, remaining } of optionLeavesGhosts) {
					if (remaining > 0) controlContainer.classList.add("inevitable");
					else controlContainer.classList.add("impossible");
				}
				evidenceContainer.querySelector(`[type="radio"][value="unknown"]`).closest(".control-container").classList.add("impossible");
			}
			continue;
		}

		// If we get to here, there's something interesting to learn from
		// investigating this evidence
		evidenceContainer.classList.add("interesting");
	}
	console.timeEnd("secondary");

	console.time("speed");
	updateSpeedMarkers();
	console.timeEnd("speed");
	console.timeEnd("update evidence total");
}

function resetTempo() {
	taps = [];
	updateTempos();
	updateTapTrace();
}

function handleTap() {
	const tap = new Date();

	// Reset if this is the first tap in a while
	if (taps.length && tap.getTime() - taps[taps.length - 1].getTime() > 2e3) resetTempo();

	taps.push(tap);
	updateTempos();
	updateTapTrace();
}

function getAverageTempo() {
	if (taps.length < 2) return null;
	const elapsedMs = taps[taps.length - 1].getTime() - taps[0].getTime();
	const msPerTap = elapsedMs / (taps.length - 1);
	return 1e3 * 60 / msPerTap;
}

function updateTempos() {
	byId("narrow-by-tempo").disabled = taps.length < 2;
	if (taps.length === 0) {
		byId("average-tempo").innerText = "";
		byId("adjusted-average-tempo").innerText = "";
	} else if (taps.length === 1) {
		byId("average-tempo").innerText = "…";
		byId("adjusted-average-tempo").innerText = "…";
	} else {
		const formatter = new Intl.NumberFormat("en", { maximumSignificantDigits: 4 });
		const tempo = getAverageTempo();
		const adjustedTempo = tempo / getSpeedMultiplier();
		byId("average-tempo").innerText = `${formatter.format(tempo)} bpm`;
		byId("adjusted-average-tempo").innerText = `${formatter.format(adjustedTempo)} bpm`;
	}
}

function narrowByTempo() {
	const tempo = getAverageTempo();
	if (tempo == null) return;
	const adjustedTempo = getAverageTempo() / getSpeedMultiplier();
	const speedMarkers = getSpeedMarkers();
	for (const ghost of speedMarkers) {
		if (
			adjustedTempo * (1 + NARROW_BY_TEMPO_LEEWAY) < tempoFromSpeed(ghost.speeds[0].speed)
			|| adjustedTempo * (1 - NARROW_BY_TEMPO_LEEWAY) > tempoFromSpeed(ghost.speeds[ghost.speeds.length - 1].speed)
		) byId(nameToIdentifier(ghost.name)).classList.add("impossible-by-speed");
	}
	updateClearRulingsByTempo();
	updateEvidence();
}

function updateClearRulingsByTempo() {
	byId("clear-rulings-by-tempo").disabled = document.querySelector("#ghosts li.impossible-by-speed") == null;
}

function updateResetManualRuleOuts() {
	byId("reset-manual-rule-outs").disabled = document.querySelector("#ghosts li input:checked") == null;
}

function clearRulingsByTempo() {
	for (const ghostContainer of document.querySelectorAll("#ghosts li"))
		ghostContainer.classList.remove("impossible-by-speed");
	updateClearRulingsByTempo();
	updateEvidence();
}

function cToF(tempC) {
	return tempC * 9 / 5 + 32;
}

function temperatureInPreferredUnit(tempC) {
	switch (getTemperatureUnit()) {
		case "C": return tempC;
		case "F": return cToF(tempC);
		default: throw new Error(`Unexpected temperature unit "${getTemperatureUnit()}"`);
	}
}

function getTemperatureFormatter() {
	switch (getTemperatureUnit()) {
		case "F": return new Intl.NumberFormat("en", { style: "unit", unit: "fahrenheit", maximumFractionDigits: 0 });
		case "C": return new Intl.NumberFormat("en", { style: "unit", unit: "celsius" });
		default: throw new Error(`Unexpected temperature unit "${getTemperatureUnit()}"`);
	}
}

function formatTemperature(tempC) {
	return getTemperatureFormatter().format(temperatureInPreferredUnit(tempC));
}

function getSpeedMarkers() {
	const speedMarkers = [];

	// How much faster than base speed could the ghost be,
	// given how long it had line of sight?
	const losMultiplier = getLineOfSight() == null ? null : 1 + (MAX_GHOST_LOS_SPEEDUP_MULTIPLIER - 1) * getLineOfSight() / MAX_GHOST_LOS_SPEEDUP_PERIOD_S;

	function getNormalSpeedGhost(name) {
		const speeds = [];
		if (getLineOfSight() == null) {
			// Line of sight time unknown; could be the full range of possible speeds
			speeds.push(
				{
					name: "Base",
					speed: NORMAL_SPEED,
				},
				{
					name: `Max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
					speed: NORMAL_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
				},
			);
		} else {
			// Line of sight time known; we can calculate what speed it should be
			speeds.push({
				name: `At ${secondsFormatter.format(getLineOfSight())} line of sight`,
				speed: NORMAL_SPEED * losMultiplier,
			});
		}
		return {
			name,
			speeds,
		};
	}

	speedMarkers.push(getNormalSpeedGhost("Spirit"));
	speedMarkers.push(getNormalSpeedGhost("Wraith"));
	speedMarkers.push(getNormalSpeedGhost("Phantom"));
	speedMarkers.push(getNormalSpeedGhost("Poltergeist"));
	speedMarkers.push(getNormalSpeedGhost("Banshee"));

	{
		// The Jinn has special speed rules when the breaker is on, it has line of
		// sight to the player, and it's more than 3 metres away.
		const jinn = {
			name: "Jinn",
			speeds: [],
		};

		const fuseBox = radioTristate("fuse-box-on");
		const far = getGhostDistance() == null ? null : getGhostDistance() >= JINN_BOOST_MIN_DISTANCE;
		const someLos = getLineOfSight() == null ? null : getLineOfSight() > 0;

		if (fuseBox !== false && far !== false && someLos !== false) {
			jinn.speeds.push({
				name: `${meterFormatter.format(JINN_BOOST_MIN_DISTANCE)} or further from player, breaker on, with line of sight`,
				speed: JINN_LOS_SPEED,
			});
		}

		if (someLos !== true) {
			jinn.speeds.push({
				name: "Base speed",
				speed: NORMAL_SPEED,
			});
		}

		if (someLos !== false && !(fuseBox && someLos && far)) {
			if (getLineOfSight() == null || getLineOfSight >= MAX_GHOST_LOS_SPEEDUP_PERIOD_S) {
				jinn.speeds.push({
					name: `Max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
					speed: NORMAL_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
				});
			} else {
				jinn.speeds.push({
					name: `At ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: NORMAL_SPEED * losMultiplier,
				});
			}
		}
		speedMarkers.push(jinn);
	}

	speedMarkers.push(getNormalSpeedGhost("Mare"));

	{
		// Revenant has a fixed fast speed when it knows where the player is, and
		// when it doesn't it'll quite quickly slow down to a fixed slow speed.
		// Detection for revenant purposes isn't just line of sight, it's also
		// electronics detection.
		// The revenant doesn't speed up gradually with line of sight.
		const revenant = {
			name: "Revenant",
			speeds: [],
		};
		const detectedHeldElectronics = radioTristate("detected-held-electronics");
		if ((getLineOfSight() == null || getLineOfSight() === 0) && detectedHeldElectronics !== true) {
			revenant.speeds.push({
				name: "When a player is not detected",
				speed: REVENANT_SLOW_SPEED,
			});
		}
		if ((getLineOfSight() == null || getLineOfSight() > 0) || detectedHeldElectronics !== false) {
			revenant.speeds.push({
				name: "When a player is detected",
				speed: REVENANT_FAST_SPEED
			});
		}
		speedMarkers.push(revenant);
	}

	speedMarkers.push(getNormalSpeedGhost("Shade"));
	speedMarkers.push(getNormalSpeedGhost("Demon"));
	speedMarkers.push(getNormalSpeedGhost("Yurei"));
	speedMarkers.push(getNormalSpeedGhost("Oni"));
	speedMarkers.push(getNormalSpeedGhost("Yokai"));

	{
		// Observation: the available speed data has ambiguous speeds for the
		// boundaries between temperature ranges.
		// Assumption: with descending temperature ranges, test in order using
		// greater-than-or-equal-to the lower bound.
		// Rationale: this leaves the fastest speed for strictly sub-zero
		// temperatures, which seems thematically fitting.
		const temperature = getTemperature();
		const hantu = {
			name: "Hantu",
			speeds: [],
		};
		if (temperature == null || temperature >= 15) hantu.speeds.push({
			name: `At ${formatTemperature(15)} or warmer`,
			speed: HANTU_MIN_SPEED,
		});
		if (getTemperature() == null || temperature < 15 && temperature >= 12) hantu.speeds.push({
			name: `Between ${formatTemperature(12)} and ${formatTemperature(15)}`,
			speed: HANTU_12_15_SPEED,
		});
		if (getTemperature() == null || temperature < 12 && temperature >= 9) hantu.speeds.push({
			name: `Between ${formatTemperature(9)} and ${formatTemperature(12)}`,
			speed: HANTU_9_12_SPEED,
		});
		if (getTemperature() == null || temperature < 9 && temperature >= 6) hantu.speeds.push({
			name: `Between ${formatTemperature(6)} and ${formatTemperature(9)}`,
			speed: HANTU_6_9_SPEED,
		});
		if (getTemperature() == null || temperature < 6 && temperature >= 3) hantu.speeds.push({
			name: `Between ${formatTemperature(3)} and ${formatTemperature(6)}`,
			speed: HANTU_3_6_SPEED,
		});
		if (getTemperature() == null || temperature < 3 && temperature >= 0) hantu.speeds.push({
			name: `Between ${formatTemperature(0)} and ${formatTemperature(3)}`,
			speed: HANTU_0_3_SPEED,
		});
		if (getTemperature() == null || temperature < 0) hantu.speeds.push({
			name: `Colder than ${formatTemperature(0)}`,
			speed: HANTU_MAX_SPEED,
		});
		speedMarkers.push(hantu);
	}

	speedMarkers.push(getNormalSpeedGhost("Goryo"));
	speedMarkers.push(getNormalSpeedGhost("Myling"));
	speedMarkers.push(getNormalSpeedGhost("Onryo"));

	{
		const twins = {
			name: "The Twins",
			speeds: [],
		};
		if (getLineOfSight() == null) {
			// Line of sight time unknown; could be the full range of possible speeds
			twins.speeds.push(
				{
					name: "Slow twin base",
					speed: TWIN_SLOW_SPEED,
				},
				{
					name: `Slow twin max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
					speed: TWIN_SLOW_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
				},
				{
					name: "Fast twin base",
					speed: TWIN_FAST_SPEED,
				},
				{
					name: `Fast twin max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
					speed: TWIN_FAST_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
				},
			);
		} else {
			// Line of sight time known; we can calculate what speed it should be
			twins.speeds.push(
				{
					name: `Slow twin at ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: TWIN_SLOW_SPEED * losMultiplier,
				},
				{
					name: `Fast twin at ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: TWIN_FAST_SPEED * losMultiplier,
				},
			);
		}
		speedMarkers.push(twins);
	}

	{
		const raiju = {
			name: "Raiju",
			speeds: [],
		};
		const nearElectronics = radioTristate("near-electronics");
		if (nearElectronics !== false) raiju.speeds.push({
			name: "When near active electronics",
			speed: RAIJU_ELECTRONICS_SPEED,
		});
		if (nearElectronics !== true) {
			if (getLineOfSight() == null) {
				// Line of sight time unknown; could be the full range of possible speeds
				raiju.speeds.push(
					{
						name: "Base, not near active electronics",
						speed: NORMAL_SPEED,
					},
					{
						name: `Max, not near active electronics, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
						speed: NORMAL_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
					},
				);
			} else {
				// Line of sight time known; we can calculate what speed it should be
				raiju.speeds.push({
					name: `At ${secondsFormatter.format(getLineOfSight())} line of sight, not near active electronics`,
					speed: NORMAL_SPEED * losMultiplier,
				});
			}
		}
		speedMarkers.push(raiju);
	}

	speedMarkers.push(getNormalSpeedGhost("Obake"));

	{
		// Information from the developer looks like the ghost changes speed in
		// discrete intervals of 5% sanity. Plotted on a graph they are a dead
		// straight line other than probably rounding errors.
		// Assumption: it is expressed that way just to be digestible by the average
		// player.
		// Assumption: it is in fact a continuous line rather than discrete
		// intervals.
		// Assumption: the range runs smoothly from 0% to 50% sanity.
		const moroi = {
			name: "Moroi",
			speeds: [],
		};
		const sanity = getSanity();
		if (sanity == null && losMultiplier == null) {
			moroi.speeds.push(
				{
					name: `At ${percentFormatter.format(MOROI_MIN_AT_SANITY)} or higher sanity, and no line of sight`,
					speed: MOROI_MIN_SPEED,
				},
				{
					name: `At ${percentFormatter.format(MOROI_MAX_AT_SANITY)} sanity, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
					speed: MOROI_MAX_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
				},
			);
		} else if (sanity == null) {
			moroi.speeds.push(
				{
					name: `At ${percentFormatter.format(MOROI_MIN_AT_SANITY)} or higher sanity, with ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: MOROI_MIN_SPEED * losMultiplier,
				},
				{
					name: `At ${percentFormatter.format(MOROI_MAX_AT_SANITY)} sanity, with ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: MOROI_MAX_SPEED * losMultiplier,
				},
			);
		} else {
			const sanitySpeed = Math.max(MOROI_MIN_SPEED, MOROI_MAX_SPEED + sanity * (MOROI_MIN_SPEED - MOROI_MAX_SPEED) / (MOROI_MIN_AT_SANITY - MOROI_MAX_AT_SANITY));
			if (losMultiplier == null) {
				moroi.speeds.push(
					{
						name: `At ${percentFormatter.format(sanity)} sanity, with no line of sight`,
						speed: sanitySpeed,
					},
					{
						name: `At ${percentFormatter.format(sanity)} sanity, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
						speed: sanitySpeed * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
					},
				);
			} else {
				moroi.speeds.push({
					name: `At ${percentFormatter.format(sanity)} sanity, with ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: sanitySpeed * losMultiplier,
				});
			}
		}
		speedMarkers.push(moroi);
	}

	{
		// Information from the developer is confusing; it says "If not chasing
		// anyone then remain at the same speed, if speed is greater then 3m/s then
		// limit it to 1.6m/s". But it also says the maximum speed is 3m/s, so how
		// could it ever be greater than 3m/s?
		// Observation: if a player is very close to a Deogen (so it's going very
		// slowly) and they light a smudge stick (which would mean the Deogen no
		// longer has a target), it smoothly speeds up over a couple of seconds.
		// Assumption: it's out of date, or badly written. The Deogen quickly
		// changes speed to 1.6m/s when it has no target.
		const deogen = {
			name: "Deogen",
			speeds: [],
		};
		const smudged = radioTristate("ghost-smudged");
		if (smudged !== false) {
			deogen.speeds.push({
				name: "When targetless (smudged)",
				speed: DEOGEN_SPEED_TARGETLESS,
			});
		}
		if (smudged !== true) {
			const slowSpeed = {
				name: `When ${meterFormatter.format(DEOGEN_MIN_DISTANCE)} or closer to the player`,
				speed: DEOGEN_MIN_SPEED,
			};
			const fastSpeed = {
				name: `When ${meterFormatter.format(DEOGEN_MAX_DISTANCE)} or further from the player`,
				speed: DEOGEN_MAX_SPEED,
			};
			const distance = getGhostDistance();
			if (distance == null) deogen.speeds.push(slowSpeed, fastSpeed);
			else if (distance <= DEOGEN_MIN_DISTANCE) deogen.speeds.push(slowSpeed);
			else if (distance >= DEOGEN_MAX_DISTANCE) deogen.speeds.push(fastSpeed);
			else deogen.speeds.push({
				name: `When ${meterFormatter.format(getGhostDistance())} from target player`,
				speed: Math.min(DEOGEN_MAX_SPEED, Math.max(DEOGEN_MIN_SPEED, DEOGEN_MIN_SPEED + (getGhostDistance() - DEOGEN_MIN_DISTANCE) * (DEOGEN_MAX_SPEED - DEOGEN_MIN_SPEED) / (DEOGEN_MAX_DISTANCE - DEOGEN_MIN_DISTANCE))),
			});
		}
		speedMarkers.push(deogen);
	}

	{
		const thaye = {
			name: "Thaye",
			speeds: [
			],
		};
		const timeSpentNearGhost = getTimeSpentNearGhost();
		const minSpeedObj = {
			name: "Before ageing (players have spent little or no time in the same room as the ghost)",
			speed: THAYE_MAX_SPEED,
		};
		const maxSpeedObj = {
			name: "After ageing 10 times (players have spent a lot of time in the same room as the ghost)",
			speed: THAYE_MIN_SPEED,
		};
		const ageLimit = Math.ceil((THAYE_MAX_SPEED - THAYE_MIN_SPEED) / THAYE_SPEED_NERF_PER_AGE);
		if (timeSpentNearGhost == null)
			thaye.speeds.push(minSpeedObj, maxSpeedObj);
		else {
			const minAges = Math.floor(timeSpentNearGhost / THAYE_AGE_MAX_S);
			const maxAges = Math.floor(timeSpentNearGhost / THAYE_AGE_MIN_S);
			if (minAges === 0)
				thaye.speeds.push(minSpeedObj);
			else
				thaye.speeds.push({
					name: `After ageing ${minAges} times (players have spent between ${minutesFormatter.format(minAges * THAYE_AGE_MIN_S / 60)} and ${minutesFormatter.format(minAges * THAYE_AGE_MAX_S / 60)} in the same room as the ghost)`,
					speed: Math.max(THAYE_MIN_SPEED, THAYE_MAX_SPEED - minAges * THAYE_SPEED_NERF_PER_AGE),
				});
			if (minAges !== maxAges) {
				if (maxAges === ageLimit)
					thaye.speeds.push(maxSpeedObj);
				else
					thaye.speeds.push({
						name: `After ageing ${maxAges} times (players have spent between ${minutesFormatter.format(maxAges * THAYE_AGE_MIN_S / 60)} and ${minutesFormatter.format(maxAges * THAYE_AGE_MAX_S / 60)} in the same room as the ghost)`,
						speed: Math.max(THAYE_MIN_SPEED, THAYE_MAX_SPEED - maxAges * THAYE_SPEED_NERF_PER_AGE),
					});
			}
		}
		speedMarkers.push(thaye);
	}

	let slowest = null;
	let fastest = null;

	// Sort all speeds
	for (const ghost of speedMarkers) {
		ghost.speeds.sort((a, b) => a.speed - b.speed);
	}

	// We do the mimic last, since it could be the speed of any other ghost
	{
		const mimic = {
			name: "The Mimic",
			speeds: [],
		};

		// Find lowest and highest speed of all ghosts
		for (const ghost of speedMarkers) {
			if (slowest == null || ghost.speeds[0].speed < slowest.speed) slowest = {
				name: `Mimic of ${ghost.name}, ${ghost.speeds[0].name}`,
				speed: ghost.speeds[0].speed,
			};
			if (fastest == null || ghost.speeds[ghost.speeds.length - 1].speed > fastest.speed) fastest = {
				name: `Mimic of ${ghost.name}, ${ghost.speeds[ghost.speeds.length - 1].name}`,
				speed: ghost.speeds[ghost.speeds.length - 1].speed,
			};
		}
		if (slowest != null) mimic.speeds.push(slowest);
		if (fastest != null) mimic.speeds.push(fastest);
		if (slowest != null || fastest != null) speedMarkers.push(mimic);
	}

	return speedMarkers;
}

function nameToIdentifier(name) {
	return name.toLowerCase().replace(/\s/g, "-");
}

function updateSpeedMarkers() {
	const speedMarkers = getSpeedMarkers();
	for (const [index, ghost] of speedMarkers.entries()) {
		const identifier = nameToIdentifier(ghost.name);
		const ghostContainer = document.querySelector(`#chart .ghost[data-ghost="${identifier}"]`);
		ghostContainer.style.setProperty("--index", index);
		ghostContainer.hidden = ghostMarkedImpossible(byId(identifier));
		const colorL = 55 + 35 * (index % 3) / 2;
		const colorC = 40 + 30 * (index % 8) / 7;
		const colorH = index / speedMarkers.length + (index % 2) / 2;
		const color = `oklch(${colorL}% ${colorC / 100 * 0.4} ${colorH}turn)`; // Chrome 113 doesn't seem to like percentage chroma
		ghostContainer.style.color = color;
		const markersContainer = ghostContainer.querySelector(".markers");
		markersContainer.replaceChildren(...ghost.speeds.map((speed) => {
			const div = document.createElement("div");
			div.style.bottom = `${toScale(tempoFromSpeed(speed.speed)) * 100}%`;
			div.title = speed.name;
			return div;
		}));
		const label = ghostContainer.querySelector(".label");
		label.style.bottom = `${toScale((tempoFromSpeed(ghost.speeds[0].speed) + tempoFromSpeed(ghost.speeds[ghost.speeds.length - 1].speed)) / 2) * 100}%`;
		const range = ghostContainer.querySelector(".range");
		const rangeArea = ghostContainer.querySelector(".range-area");
		range.style.bottom = rangeArea.style.bottom = `${toScale(tempoFromSpeed(ghost.speeds[0].speed)) * 100}%`;
		range.style.height = rangeArea.style.height = `${toScale(tempoFromSpeed(ghost.speeds[ghost.speeds.length - 1].speed) - tempoFromSpeed(ghost.speeds[0].speed)) * 100}%`;
	}
}

const scale = [0, tempoFromSpeed(FASTEST_SPEED + SLOWEST_SPEED)];
function toScale(tempo) {
	return (tempo - scale[0]) / (scale[1] - scale[0]);
}

function updateTapTrace() {
	const canvas = byId("tap-trace");
	const ctx = canvas.getContext("2d");
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	if (taps.length < 2) return;

	const msToShow = Math.max(4e3, taps[taps.length - 1].getTime() - taps[1].getTime());
	const pxPerMs = canvas.width / msToShow;

	// Draw last-tap tempo line
	ctx.beginPath();
	for (let i = 1; i < taps.length; i++) {
		const x = (taps[i].getTime() - taps[1].getTime()) * pxPerMs;
		const y = canvas.height * (1 - toScale(60e3 / (taps[i].getTime() - taps[i - 1].getTime()) / getSpeedMultiplier()));
		if (i === 1) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.lineWidth = 3;
	ctx.strokeStyle = "#fff2";
	ctx.stroke();

	// Draw rolling average tempo line
	ctx.beginPath();
	for (let i = 1; i < taps.length; i++) {
		// Get the earliest sample within n seconds
		let j = i;
		while (j - 1 >= 0 && taps[i].getTime() - taps[j - 1].getTime() < ROLLING_AVERAGE_MS) j--;
		const x = (taps[i].getTime() - taps[1].getTime()) * pxPerMs;

		// Calculate the average over those samples
		const y = canvas.height * (1 - toScale(60e3 / (taps[i].getTime() - taps[j].getTime()) * (i - j) / getSpeedMultiplier()));

		if (i === 1) ctx.moveTo(x, y);
		else ctx.lineTo(x, y);
	}
	ctx.lineWidth = 8;
	ctx.strokeStyle = "white";
	ctx.stroke();
	ctx.lineWidth = 4;
	ctx.strokeStyle = "black";
	ctx.stroke();
}

let timerStart = null;
let timerStop = null;
let timerInterval = null;

function startStopTimer() {
	if (timerInterval == null) {
		timerStart = new Date();
		timerStop = null;
		updateTimerReadout();
		timerInterval = setInterval(updateTimerReadout, 100);
	} else {
		timerStop = new Date();
		clearInterval(timerInterval);
		timerInterval = null;
		updateTimerReadout();
	}
}

function updateTimerAdjust() {
	updateTimerReadout();
	byId("timer-adjust-readout").innerText = secondsFormatter.format(getTimerAdjust() / 1e3);
}

function getTimerAdjust() {
	return parseInt(byId("timer-adjust").value) * 1e3;
}

function getHuntSafety(secondsSinceSmudge) {
	let possibleShort = false;
	let possibleNormal = false;
	let possibleLong = false;
	for (const ghostContainer of document.querySelectorAll("#ghosts li")) {
		if (ghostMarkedImpossible(ghostContainer)) continue;
		if (!possibleShort && ghostContainer.classList.contains("smudge-hunt-suspension-short")) possibleShort = true;
		if (!possibleNormal && ghostContainer.classList.contains("smudge-hunt-suspension-normal")) possibleNormal = true;
		if (!possibleLong && ghostContainer.classList.contains("smudge-hunt-suspension-long")) possibleLong = true;
	}
	if (!possibleShort && !possibleNormal && !possibleLong) return null;
	const minSafe = possibleShort ? SMUDGE_HUNT_SHORT_S : possibleNormal ? SMUDGE_HUNT_NORMAL_S : SMUDGE_HUNT_LONG_S;
	const maxSafe = possibleLong  ? SMUDGE_HUNT_LONG_S : possibleNormal ? SMUDGE_HUNT_NORMAL_S : SMUDGE_HUNT_SHORT_S;
	if (secondsSinceSmudge < minSafe) return "safe";
	if (secondsSinceSmudge < maxSafe) return "caution";
	return "danger";
}

function updateTimerReadout() {
	const seconds = (getTimerAdjust() + (timerStart == null ? 0 : ((timerStop == null ? new Date().getTime() : timerStop.getTime()) - timerStart))) / 1e3;
	const readout = byId("timer-readout");
	const safety = getHuntSafety(seconds);
	readout.classList.toggle("safe", safety === "safe");
	readout.classList.toggle("caution", safety === "caution");
	readout.classList.toggle("danger", safety === "danger");
	readout.innerText = timerFormatter.format(seconds);
}

init();
