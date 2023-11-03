import Polyfit from "./polyfit.js";

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
const SPEED_SCALE = [0, FASTEST_SPEED + SLOWEST_SPEED];

const NARROW_BY_SPEED_LEEWAY = 0.05;

const byId = document.getElementById.bind(document);

const secondsFormatter = new Intl.NumberFormat("en", { style: "unit", unit: "second" });
const minutesFormatter = new Intl.NumberFormat("en", { style: "unit", unit: "minute", maximumFractionDigits: 1 });
const timerFormatter = new Intl.NumberFormat("en", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const percentFormatter = new Intl.NumberFormat("en", { style: "percent" });
const meterFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 1, maximumSignificantDigits: 2, style: "unit", unit: "meter" });
const meterPerSecondFormatter = new Intl.NumberFormat("en", { maximumFractionDigits: 2, style: "unit", unit: "meter-per-second" });

/**
 * Ghost footstep tempo data
 *
 * Data collected between the release of Ascension and 2023-11-02,
 * all at Camp Woodwind, in solo games.
 * Audio was recorded, then cut to the first and last footstep in whatever was
 * the longest steady part of the hunt, then the average tempo calculated.
 */
const observations = [
	[[0, 0, 0]], // Try to pass through 0,0 (this doesn't force it though)
	[
		[53.80, 54.23, 54.29, 54.14, 53.93, 53.62, 53.80, 54.30, 54.08, 53.87, 54.26].map((tempo) => [NORMAL_SPEED, tempo]),
		[47.28, 47.25, 47.13, 47.12, 47.46, 47.41, 47.20, 47.25, 47.27, 47.60].map((tempo) => [TWIN_SLOW_SPEED, tempo]),
		[60.41, 60.53, 60.67, 61.01, 60.76, 60.49, 60.95, 60.92, 60.61, 60.85].map((tempo) => [TWIN_FAST_SPEED, tempo]),
		[89.69, 90.99, 90.61].map((tempo) => [THAYE_MAX_SPEED, tempo]),
		[72.50, 72.83, 72.79, 73.28, 72.46, 73.58, 72.47, 72.90, 73.27, 73.17, 72.77].map((tempo) => [MOROI_MAX_SPEED, tempo]),
		[82.37].map((tempo) => [RAIJU_ELECTRONICS_SPEED, tempo]),
		[31.20, 30.97, 31.19, 30.97, 31.00, 31.21, 30.91].map((tempo) => [REVENANT_SLOW_SPEED, tempo]),
		[99.75, 101.13, 99.02, 98.82].map((tempo) => [REVENANT_FAST_SPEED, tempo]),
		[99.75].map((tempo) => [DEOGEN_MAX_SPEED, tempo]),
	].flat().map(([speed, tempo]) => [0.5, speed, tempo]),
	[
		[83.24, 83.55, 83.31, 83.79, 83.30, 83.76, 83.20, 83.39, 83.02, 83.25].map((tempo) => [NORMAL_SPEED, tempo]),
		[72.51, 73.03, 72.77, 72.56, 72.71, 73.10, 72.64, 72.79, 73.07, 72.73, 72.61].map((tempo) => [TWIN_SLOW_SPEED, tempo]),
		[92.57, 94.15, 94.50, 94.79, 94.03, 93.93, 94.66, 93.89, 94.16, 93.42, 94.63].map((tempo) => [TWIN_FAST_SPEED, tempo]),
		[].map((tempo) => [THAYE_MAX_SPEED, tempo]),
		[113.25, 113.80, 114.08, 112.56, 113.10, 113.45, 112.64, 114.84, 112.76, 113.44, 113.24].map((tempo) => [MOROI_MAX_SPEED, tempo]),
		[125.12, 127.04, 127.27, 129.06].map((tempo) => [RAIJU_ELECTRONICS_SPEED, tempo]),
		[47.42, 47.03, 47.27, 47.60, 47.13, 47.41, 47.19, 47.13, 47.15, 47.41].map((tempo) => [REVENANT_SLOW_SPEED, tempo]),
		[156.40, 158.63, 160.46, 156.13, 157.30, 157.56, 159.18, 155.59].map((tempo) => [REVENANT_FAST_SPEED, tempo]),
		[157.50, 161.49, 161.17, 159.39, 157.81, 155.66, 156.60, 160.58, 154.50, 158.62, 159.02].map((tempo) => [DEOGEN_MAX_SPEED, tempo]),
	].flat().map(([speed, tempo]) => [0.75, speed, tempo]),
	[
		[114.6, 114.0, 114.5, 114.6, 115.0, 114.6, 114.4, 114.0, 115.2, 114.3, 114.8, 114.6, 114.8, 115.5, 115.3, 114.4].map((tempo) => [NORMAL_SPEED, tempo]),
		[100.0, 97.85, 99.5, 98.48, 100.2, 100.2, 99.51, 100.6, 100.3, 99.51].map((tempo) => [TWIN_SLOW_SPEED, tempo]),
		[130.6, 130.1, 129.1, 130.7, 129.8, 129.7, 130.7, 130.3, 130.1, 130.3].map((tempo) => [TWIN_FAST_SPEED, tempo]),
		[202.8, 200.9].map((tempo) => [THAYE_MAX_SPEED, tempo]),
		[157.9, 158.3, 158.6, 157.6, 159.2, 158.2, 159.1, 158.3, 158.2, 158.6].map((tempo) => [MOROI_MAX_SPEED, tempo]),
		[180.6, 176.4, 182.7, 179.6, 177.3, 178.3, 181.8, 179.0, 178.2, 179.9].map((tempo) => [RAIJU_ELECTRONICS_SPEED, tempo]),
		[64.4, 64.37, 64.39, 64.36, 63.72, 63.99, 63.99, 64.77, 64.13, 63.71].map((tempo) => [REVENANT_SLOW_SPEED, tempo]),
		[].map((tempo) => [REVENANT_FAST_SPEED, tempo]),
		[].map((tempo) => [DEOGEN_MAX_SPEED, tempo]),
	].flat().map(([speed, tempo]) => [1, speed, tempo]),
	[
		[149.8, 148.5, 147.4, 148.1, 149.4, 149.3, 147.7, 148.9, 148.2, 148.7, 148.6, 150.4, 148.4].map((tempo) => [NORMAL_SPEED, tempo]),
		[128.9, 128.8, 128.7, 127.8, 128.9, 127.7, 128.2, 128.5, 128.3, 127.7, 129.8].map((tempo) => [TWIN_SLOW_SPEED, tempo]),
		[167.0, 166.1, 169.9, 168.9, 166.6, 170.7, 167.4, 169.0, 168.3, 167.4, 167.4, 167.5].map((tempo) => [TWIN_FAST_SPEED, tempo]),
		[269.6, 268, 265.2, 267.4, 267.4].map((tempo) => [THAYE_MAX_SPEED, tempo]),
		[206, 205.6, 204, 204.6, 207.2, 203.2, 205.8, 203.4, 206.2, 207.4].map((tempo) => [MOROI_MAX_SPEED, tempo]),
		[235.0, 231.6, 238.8, 239.0, 232.6, 238.2, 233.0, 238.4, 237.1, 233.4].map((tempo) => [RAIJU_ELECTRONICS_SPEED, tempo]),
		[81.83, 80.42, 82.28, 81.57, 81.43].map((tempo) => [REVENANT_SLOW_SPEED, tempo]),
		[].map((tempo) => [REVENANT_FAST_SPEED, tempo]),
		[].map((tempo) => [DEOGEN_MAX_SPEED, tempo]),
	].flat().map(([speed, tempo]) => [1.25, speed, tempo]),
	[
		[183.5, 183.6, 185.2, 183.3, 183.6, 183.8, 181.1, 184.8, 181.8, 184.6, 184.4, 184.6, 182.8, 184.8, 184.6, 184.2, 183.14, 182.36].map((tempo) => [NORMAL_SPEED, tempo]),
		[158.9, 159.9, 157.6, 158.5, 161.3, 159.7, 158.1, 159.7, 157.9, 159.3, 159.2, 158.9, 159.8, 159.2, 157.4, 158, 161.3, 157.5, 159.2, 157.9, 159.5, 158.5].map((tempo) => [TWIN_SLOW_SPEED, tempo]),
		[206.6, 205.5, 207.9, 211.6, 209.8, 209.9, 209.6, 206, 209, 208, 210.2, 211.6, 213, 209.4, 207.6, 214.8, 211.9, 207.6, 212.4, 208.9].map((tempo) => [TWIN_FAST_SPEED, tempo]),
		[339.72].map((tempo) => [THAYE_MAX_SPEED, tempo]),
		[257.8, 252.2, 258.2, 263.6, 261.6, 257.2, 259.8, 258.8, 258.2, 258.2, 256.8, 257.2].map((tempo) => [MOROI_MAX_SPEED, tempo]),
		[293.6, 292.6, 299.4, 297.2, 292.8, 292.2, 288.2, 294, 293.2, 290.2].map((tempo) => [RAIJU_ELECTRONICS_SPEED, tempo]),
		[100.7, 100.8, 99.98, 99.74, 99.64, 100.6, 99.62, 101.1, 100, 99.25].map((tempo) => [REVENANT_SLOW_SPEED, tempo]),
		[].map((tempo) => [REVENANT_FAST_SPEED, tempo]),
		[].map((tempo) => [DEOGEN_MAX_SPEED, tempo]),
	].flat().map(([speed, tempo]) => [1.5, speed, tempo]),
].flat();

/**
 * Regress the data to get a function to convert from speed to tempo.
 */
const speedToTempo = new Polyfit(
	observations.map(([multiplier, speed, tempo]) => speed * multiplier),
	observations.map(([multiplier, speed, tempo]) => tempo),
).getPolynomial(2);

/**
 * Regress the data the other way around to get a function to convert from tempo to speed.
 */
const tempoToSpeed = new Polyfit(
	observations.map(([multiplier, speed, tempo]) => tempo),
	observations.map(([multiplier, speed, tempo]) => speed * multiplier),
).getPolynomial(2);

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
	document.documentElement.addEventListener("keydown", handleDocumentKeyDown);
	byId("filter").addEventListener("keydown", handleFilterKeyDown);
	byId("filter").addEventListener("input", handleFilterInput);
	byId("filter").addEventListener("focus", handleFilterFocus);
	byId("filter").addEventListener("blur", handleFilterBlur);
	byId("secondary-evidence").addEventListener("mousedown", handleSecondaryEvidenceMouseDown);
	byId("clear-filter").addEventListener("click", () => clearFilter());
	byId("ghost-speed").addEventListener("change", () => updateGhostSpeed());
	byId("tap-target").addEventListener("keydown", handleTapKeyDown);
	byId("reset-tempo").addEventListener("click", () => resetTempo());
	byId("narrow-by-speed").addEventListener("click", () => narrowBySpeed());
	byId("clear-rulings-by-speed").addEventListener("click", () => clearRulingsBySpeed());
	byId("line-of-sight").addEventListener("input", () => updateLineOfSight());
	byId("line-of-sight-known").addEventListener("input", () => updateLineOfSightKnown());
	byId("temperature").addEventListener("input", () => updateTemperature());
	byId("temperature-known").addEventListener("input", () => updateTemperatureKnown());
	byId("temperature-unit").addEventListener("change", () => {
		savePreferences(getPreferencesFromForm());
		updateTemperature();
	});
	byId("always-show-confidence-readouts").addEventListener("change", () => {
		savePreferences(getPreferencesFromForm());
		updateConfidenceReadouts();
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
	byId("incense-hunt-suspension-range").addEventListener("input", () => updateIncenseHuntSuspensionRangeReadout());
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
	for (const input of document.querySelectorAll(`input[name="ghost-speed-factors-preset"]`)) {
		input.addEventListener("change", () => updateGhostSpeedFactorsPreset());
	}
	byId("tap").addEventListener("click", () => handleTap());
	byId("game-setup-form").addEventListener("reset", () => {
		requestAnimationFrame(() => {
			updateAll();
		});
	});
	byId("game-setup-form").addEventListener("submit", (event) => {
		event.preventDefault();
	});
	byId("observations-form").addEventListener("reset", () => {
		resetTimer();
		resetTempo();
		clearRulingsBySpeed();
		requestAnimationFrame(() => {
			updateAll();
		});
	});
	byId("observations-form").addEventListener("submit", (event) => {
		event.preventDefault();
	});
	byId("reset-manual-rule-outs").addEventListener("click", () => resetManualRuleOuts());
	byId("timer-start-stop").addEventListener("click", () => startStopTimer());
	byId("timer-adjust").addEventListener("input", () => updateTimerAdjust());
	for (const button of document.querySelectorAll("#chart .ghost .label button")) {
		button.addEventListener("click", () => {
			byId(button.closest("div.ghost").dataset.ghost).classList.add("impossible-by-speed");
			updateClearRulingsBySpeed();
			updateEvidence();
		});
	}
	updateAll();
	const resizeObserver = new ResizeObserver(() => resizeTapTraceCanvas());
	resizeObserver.observe(byId("tap-trace"));
	resizeTapTraceCanvas();
	for (const counter of document.querySelectorAll(".confidence-counter")) {
		counter.addEventListener("input", () => updateConfidenceReadout(counter));
	}
}

function handleDocumentKeyDown(event) {
	switch (event.key) {
		case "t":
			event.preventDefault();
			const tapTarget = byId("tap-target");
			tapTarget.scrollIntoView({ behavior: "smooth", block: "nearest" });
			tapTarget.focus();
			handleTapKeyDown(event);
			return;
		case "/":
			event.preventDefault();
			byId("observations-form").scrollIntoView({ behavior: "smooth", block: "nearest" });
			const input = byId("filter");
			clearFilter();
			input.focus();
			return;
		case "R":
			event.preventDefault();
			if (confirm("Reset observations?")) byId("observations-form").reset();
			return;
		case "C":
			event.preventDefault();
			clearFilter();
			return;
	}
	if (event.key === "s") {
		event.preventDefault();
		startStopTimer();
		byId("incense-timer").scrollIntoView({ behavior: "smooth", block: "nearest" });
		byId("timer-start-stop").focus();
		return;
	}
}

function handleFilterKeyDown() {
	const input = byId("filter");
	event.stopPropagation();
	switch (event.key) {
		case "/":
			event.preventDefault();
			clearFilter();
			return;
		case "Escape":
			event.preventDefault();
			if (input.value !== "") {
				clearFilter();
			} else {
				input.blur();
			}
			return;
		case "Enter":
			event.preventDefault();
			if (input.value !== "") byId("secondary-evidence-details").openAtFilterBlur = true;
			input.blur();
			return;
		case "Tab":
			if (input.value !== "") byId("secondary-evidence-details").openAtFilterBlur = true;
			return;
	}
}

function handleSecondaryEvidenceMouseDown() {
	const filterInput = byId("filter");
	if (document.activeElement === filterInput) {
		if (filterInput.value !== "") byId("secondary-evidence-details").openAtFilterBlur = true;
	}
}

function handleFilterInput() {
	updateFilter();
}

function handleFilterFocus() {
	const details = byId("secondary-evidence-details");
	details.openAtFilterBlur = details.open;
}

function handleFilterBlur() {
	const details = byId("secondary-evidence-details");
	if (!details.openAtFilterBlur) details.open = false;
}

function updateFilter() {
	const string = byId("filter").value.trim();
	const terms = string.length === 0 ? null : string.split(/\s+/);
	const secondaryDetails = byId("secondary-evidence-details");
	secondaryDetails.open = terms != null || secondaryDetails.openAtFilterBlur;

	// Check for primary evidence with matching tags
	let havePrimary = false;
	for (const element of document.querySelectorAll("#primary-evidence fieldset")) {
		const match = matchFilter(terms, element);
		element.hidden = !match;
		if (match) havePrimary = true;
	}

	// Check for secondary evidence with matching tags
	let haveSecondary = false;
	for (const element of document.querySelectorAll("#secondary-evidence fieldset")) {
		const match = matchFilter(terms, element);
		element.hidden = !match;
		if (match) haveSecondary = true;
	}

	// Check if a term was a ghost name, and if so, show its possible primary
	// evidence
	const numCollectable = getEvidenceNum();
	if (terms != null) {
		for (const ghost of document.querySelectorAll("#ghosts li")) {
			const names = [ghost.id];
			if (ghost.dataset.nicknames) names.push(...ghost.dataset.nicknames.split(/\s+/));
			if (names.some((name) => terms.some((term) => name.startsWith(term)))) {
				for (const element of document.querySelectorAll("#primary-evidence fieldset")) {
					if (
						ghost.classList.contains(`special-${element.id}`)
						|| numCollectable > 0 && (
							ghost.classList.contains(`guaranteed-${element.id}`)
							|| (numCollectable > 1 || !Array.from(ghost.classList).some((cls) => /^guaranteed-/.test(cls))) && ghost.classList.contains(element.id)
						)
					) {
						element.hidden = false;
						havePrimary = true;
					}
				}
			}
		}
	}

	document.querySelector("#primary-evidence .none-matching-filter").hidden = havePrimary;
	document.querySelector("#secondary-evidence .none-matching-filter").hidden = haveSecondary;

	byId("clear-filter").disabled = terms == null;
}

function matchFilter(terms, element) {
	if (terms == null) return true;
	return terms.every((term) => element.classList.contains(term) || Array.from(element.classList).some((cls) => cls.startsWith(term)));
}

function clearFilter() {
	const input = byId("filter");
	if (input.value !== "") {
		input.value = "";
		updateFilter();
	}
}

function updateAll() {
	updateLineOfSightKnown();
	updateTemperatureKnown();
	updateSanityKnown();
	updateGhostDistanceKnown();
	updateTimeSpentNearGhostKnown();
	updateGhostSpeedFactorsPreset();
	updateEvidenceNum();
	updateTimerAdjust();
	updateHuntSanityRangeReadout();
	updateIncenseHuntSuspensionRangeReadout();
	updateClearRulingsBySpeed();
	updateResetManualRuleOuts();
	updateConfidenceReadouts();
}

function updateHuntSanityRangeReadout() {
	document.querySelector(`output[for="hunt-sanity-range"]`).textContent = percentFormatter.format(parseInt(byId("hunt-sanity-range").value) / 100);
}

function updateIncenseHuntSuspensionRangeReadout() {
	document.querySelector(`output[for="incense-hunt-suspension-range"]`).textContent = secondsFormatter.format(parseInt(byId("incense-hunt-suspension-range").value));
}

function getGhostSpeedFactorsPreset() {
	return document.querySelector(`input[name="ghost-speed-factors-preset"]:checked`).value;
}

function updateGhostSpeedFactorsPreset() {
	byId("ghost-speed-factors-advanced").hidden = getGhostSpeedFactorsPreset() !== "advanced";
	updateGhostSpeed();
}

function updateGhostSpeed() {
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
		event.stopPropagation();
		document.activeElement.blur();
		return;
	}
	if (/^[a-z ]$/.test(event.key)) {
		event.preventDefault();
		event.stopPropagation();
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
	if (getGhostSpeedFactorsPreset() !== "advanced") return false;
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
	if (getGhostSpeedFactorsPreset() !== "advanced") return false;
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
	if (getGhostSpeedFactorsPreset() !== "advanced") return false;
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
	switch (getGhostSpeedFactorsPreset()) {
		case "unknown": return null;
		case "undetected": return 0;
		case "advanced":
			if (!getLineOfSightKnown()) return null;
			return parseInt(byId("line-of-sight").value);
	}
}

function getLineOfSightKnown() {
	switch (getGhostSpeedFactorsPreset()) {
		case "unknown": return false;
		case "undetected": return true;
		case "advanced":
			return byId("line-of-sight-known").checked;
	}
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
	if (getGhostSpeedFactorsPreset() !== "advanced") return false;
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

function getShowConfidenceReadouts() {
	return byId("always-show-confidence-readouts").value === "yes";
}

function updateConfidenceReadouts() {
	const alwaysShow = getShowConfidenceReadouts();
	for (const counter of document.querySelectorAll(".confidence-counter")) {
		const fieldset = counter.closest("fieldset");
		if (fieldset == null) continue;
		const compact = fieldset.querySelector(".confidence-counter-compact");
		const details = fieldset.querySelector(".confidence-counter-details");
		if (compact == null || details == null) continue;
		if (alwaysShow) {
			details.hidden = true;
			compact.querySelector(".confidence-counter-slot").appendChild(fieldset.querySelector(".confidence-counter"));
			compact.querySelector(".confidence-counter-output-slot").appendChild(fieldset.querySelector(`output[for="${counter.id}"]`));
			compact.hidden = false;
		} else {
			compact.hidden = true;
			details.querySelector(".confidence-counter-slot").appendChild(fieldset.querySelector(".confidence-counter"));
			details.querySelector(".confidence-counter-output-slot").appendChild(fieldset.querySelector(`output[for="${counter.id}"]`));
			details.hidden = false;
		}
		updateConfidenceReadout(counter);
	}
}

function getDetectedHeldElectronics() {
	switch (getGhostSpeedFactorsPreset()) {
		case "unknown": return null;
		case "undetected": return false;
		case "advanced": return radioTristate("detected-held-electronics");
	}
}

function getNearElectronics() {
	switch (getGhostSpeedFactorsPreset()) {
		case "unknown": return null;
		case "undetected": return null;
		case "advanced": return radioTristate("near-electronics");
	}
}

function getFuseBoxOn() {
	switch (getGhostSpeedFactorsPreset()) {
		case "unknown": return null;
		case "undetected": return null;
		case "advanced": return radioTristate("fuse-box-on");
	}
}

function getGhostIncensed() {
	switch (getGhostSpeedFactorsPreset()) {
		case "unknown": return null;
		case "undetected": return false;
		case "advanced": return radioTristate("ghost-incensed");
	}
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
	updateFilter();
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
function setUnion(...sets) {
	const newSet = new Set();
	for (const set of sets)
		for (const item of set)
			newSet.add(item);
	return newSet;
}
function setExclude(a, ...others) {
	const newSet = new Set(a);
	for (const toExclude of others)
		for (const item of toExclude)
			newSet.delete(item);
	return newSet;
}
function setIntersect(a, b) {
	const newSet = new Set();
	for (const item of a)
		if (b.has(item))
			newSet.add(item);
	return newSet;
}

function ghostImpossible(numCollectable, ghostContainer, confirmedEvidence, ruledOutEvidence, secondaryClasses = [], withReasons) {
	const classList = ghostContainer.classList;

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

	// Ghost is ruled out if something it exhibits as special evidence has been
	// ruled out
	if ([...ruledOutEvidence].some((evidence) => classList.contains(`special-${evidence}`))) {
		if (withReasons) reasons.primary.add(`it must exhibit particular evidence which has been ruled out`);
		else return true;
	}

	// Ghost is ruled out if one or more evidence is collectable and something
	// it exhibits as guaranteed or special evidence has been ruled out
	if (numCollectable > 0 && [...ruledOutEvidence].some((evidence) => classList.contains(`guaranteed-${evidence}`))) {
		if (withReasons) reasons.primary.add(`it has particular guaranteed evidence which has been ruled out`);
		else return true;
	}

	const confirmedMinusSpecial = new Set(confirmedEvidence);
	for (const evidence of confirmedEvidence)
		if (classList.contains(`special-${evidence}`))
			confirmedMinusSpecial.delete(evidence);

	// Ghost is ruled out if one ore more envidence is collectable, we have
	// collected the maximum number of normal evidence items, and something it
	// exhibits as guaranteed evidence was not confirmed
	if (numCollectable > 0 && confirmedMinusSpecial.size >= numCollectable && [...setExclude(allPrimaryEvidence, confirmedMinusSpecial)].some((evidence) => classList.contains(`guaranteed-${evidence}`))) {
		if (withReasons) reasons.primary.add(`it has particular guaranteed evidence which has not been confirmed, but the maximum collectable has been reached`);
		else return true;
	}

	const ghostAllNormalEvidence = [...allPrimaryEvidence].filter((evidence) => classList.contains(evidence));
	const unknownEvidence = setExclude(allPrimaryEvidence, confirmedEvidence, ruledOutEvidence);

	// Ghost is ruled out when enough of the items it exhibits as normal evidence
	// have been ruled out that it can no longer exhibit enough
	if (setUnion(confirmedMinusSpecial, setIntersect(ghostAllNormalEvidence, unknownEvidence)).size < numCollectable) {
		if (withReasons) reasons.primary.add(`too many of its possible evidence types have been ruled out`);
		else return true;
	}

	// Ghost is ruled out when more evidence has been confirmed than the ghost
	// exhibits, not taking into account collected evidence this ghost exhibits
	// as special evidence
	if (confirmedMinusSpecial.size > numCollectable) {
		if (withReasons) reasons.primary.add(`more evidence has been confirmed than it can exhibit`);
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
	console.time("timer");
	updateTimerReadout();
	console.timeEnd("timer");
	console.timeEnd("update evidence total");
}

function resetTempo() {
	taps = [];
	updateTempos();
	updateTapTrace();
}

function handleTap() {
	const tap = performance.now();

	// Reset if this is the first tap in a while
	if (taps.length && tap - taps[taps.length - 1] > 2e3) resetTempo();

	taps.push(tap);
	updateTempos();
	updateTapTrace();
}

function getAverageTempo() {
	if (taps.length < 2) return null;
	const elapsedMs = taps[taps.length - 1] - taps[0];
	const msPerTap = elapsedMs / (taps.length - 1);
	return 1e3 * 60 / msPerTap;
}

function updateTempos() {
	byId("narrow-by-speed").disabled = taps.length < 2;
	byId("average-box").classList.toggle("is-populated", taps.length > 0);
	if (taps.length === 0) {
		byId("average-tempo").innerText = "";
		byId("average-speed").innerText = "";
	} else if (taps.length === 1) {
		byId("average-tempo").innerText = "…";
		byId("average-speed").innerText = "…";
	} else {
		const formatter = new Intl.NumberFormat("en", { maximumSignificantDigits: 4 });
		const tempo = getAverageTempo();
		const speed = tempoToSpeed(tempo);
		byId("average-speed").innerText = meterPerSecondFormatter.format(speed);
		byId("average-tempo").innerText = `${formatter.format(tempo)} bpm`;
	}
}

function narrowBySpeed() {
	const tempo = getAverageTempo();
	if (tempo == null) return;
	const speed = tempoToSpeed(tempo);
	const adjustedSpeed = speed / getSpeedMultiplier();
	const speedMarkers = getSpeedMarkers();
	const avgPlusLeeway = adjustedSpeed * (1 + NARROW_BY_SPEED_LEEWAY);
	const avgMinusLeeway = adjustedSpeed * (1 - NARROW_BY_SPEED_LEEWAY);
	for (const ghost of speedMarkers) {
		if (ghost.speeds.every((speed) => {
			if (Array.isArray(speed)) {
				const min = Math.min(...speed.map(({ speed }) => speed));
				const max = Math.max(...speed.map(({ speed }) => speed));
				return avgPlusLeeway < min || avgMinusLeeway > max;
			}
			return avgPlusLeeway < speed.speed || avgMinusLeeway > speed.speed;
		})) {
			byId(nameToIdentifier(ghost.name)).classList.add("impossible-by-speed");
		}
	}
	updateClearRulingsBySpeed();
	updateEvidence();
}

function updateClearRulingsBySpeed() {
	byId("clear-rulings-by-speed").disabled = document.querySelector("#ghosts li.impossible-by-speed") == null;
}

function updateResetManualRuleOuts() {
	byId("reset-manual-rule-outs").disabled = document.querySelector("#ghosts li input:checked") == null;
}

function clearRulingsBySpeed() {
	for (const ghostContainer of document.querySelectorAll("#ghosts li"))
		ghostContainer.classList.remove("impossible-by-speed");
	updateClearRulingsBySpeed();
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

function slowestOf(ghost) {
	let slowest = null;
	for (const speed of ghost.speeds.flat())
		if (slowest == null || speed.speed < slowest.speed) slowest = speed;
	return slowest;
}

function fastestOf(ghost) {
	let fastest = null;
	for (const speed of ghost.speeds.flat())
		if (fastest == null || speed.speed > fastest.speed) fastest = speed;
	return fastest;
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
			speeds.push([
				{
					name: "Base",
					speed: NORMAL_SPEED,
				},
				{
					name: `Max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
					speed: NORMAL_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
				},
			]);
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

		const fuseBox = getFuseBoxOn();
		const far = getGhostDistance() == null ? null : getGhostDistance() >= JINN_BOOST_MIN_DISTANCE;
		const someLos = getLineOfSight() == null ? null : getLineOfSight() > 0;

		if (fuseBox !== false && far !== false && someLos !== false) {
			jinn.speeds.push({
				name: `${meterFormatter.format(JINN_BOOST_MIN_DISTANCE)} or further from player, breaker on, with line of sight`,
				speed: JINN_LOS_SPEED,
			});
		}

		if (!(fuseBox && someLos && far)) {
			if (getLineOfSight() == null) {
				jinn.speeds.push([
					{
						name: "Base",
						speed: NORMAL_SPEED,
					},
					{
						name: `Max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
						speed: NORMAL_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
					},
				]);
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
		const detectedHeldElectronics = getDetectedHeldElectronics();
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
				[
					{
						name: "Slow twin base",
						speed: TWIN_SLOW_SPEED,
					},
					{
						name: `Slow twin max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
						speed: TWIN_SLOW_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
					},
				],
				[
					{
						name: "Fast twin base",
						speed: TWIN_FAST_SPEED,
					},
					{
						name: `Fast twin max, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
						speed: TWIN_FAST_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
					},
				],
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
		const nearElectronics = getNearElectronics();
		if (nearElectronics !== false) raiju.speeds.push({
			name: "When near active electronics",
			speed: RAIJU_ELECTRONICS_SPEED,
		});
		if (nearElectronics !== true) {
			if (getLineOfSight() == null) {
				// Line of sight time unknown; could be the full range of possible speeds
				raiju.speeds.push([
					{
						name: "Base, not near active electronics",
						speed: NORMAL_SPEED,
					},
					{
						name: `Max, not near active electronics, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
						speed: NORMAL_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
					},
				]);
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
			moroi.speeds.push([
				{
					name: `At ${percentFormatter.format(MOROI_MIN_AT_SANITY)} or higher sanity, and no line of sight`,
					speed: MOROI_MIN_SPEED,
				},
				{
					name: `At ${percentFormatter.format(MOROI_MAX_AT_SANITY)} sanity, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
					speed: MOROI_MAX_SPEED * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
				},
			]);
		} else if (sanity == null) {
			moroi.speeds.push([
				{
					name: `At ${percentFormatter.format(MOROI_MIN_AT_SANITY)} or higher sanity, with ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: MOROI_MIN_SPEED * losMultiplier,
				},
				{
					name: `At ${percentFormatter.format(MOROI_MAX_AT_SANITY)} sanity, with ${secondsFormatter.format(getLineOfSight())} line of sight`,
					speed: MOROI_MAX_SPEED * losMultiplier,
				},
			]);
		} else {
			const sanitySpeed = Math.max(MOROI_MIN_SPEED, MOROI_MAX_SPEED + sanity * (MOROI_MIN_SPEED - MOROI_MAX_SPEED) / (MOROI_MIN_AT_SANITY - MOROI_MAX_AT_SANITY));
			if (losMultiplier == null) {
				moroi.speeds.push([
					{
						name: `At ${percentFormatter.format(sanity)} sanity, with no line of sight`,
						speed: sanitySpeed,
					},
					{
						name: `At ${percentFormatter.format(sanity)} sanity, after at least ${secondsFormatter.format(MAX_GHOST_LOS_SPEEDUP_PERIOD_S)} line of sight`,
						speed: sanitySpeed * MAX_GHOST_LOS_SPEEDUP_MULTIPLIER,
					},
				]);
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
		// slowly) and they light incense (which would mean the Deogen no
		// longer has a target), it smoothly speeds up over a couple of seconds.
		// Assumption: it's out of date, or badly written. The Deogen quickly
		// changes speed to 1.6m/s when it has no target.
		const deogen = {
			name: "Deogen",
			speeds: [],
		};
		const incensed = getGhostIncensed();
		if (incensed !== false) {
			deogen.speeds.push({
				name: "When targetless (incensed)",
				speed: DEOGEN_SPEED_TARGETLESS,
			});
		}
		if (incensed !== true) {
			const slowSpeed = {
				name: `When ${meterFormatter.format(DEOGEN_MIN_DISTANCE)} or closer to the player`,
				speed: DEOGEN_MIN_SPEED,
			};
			const fastSpeed = {
				name: `When ${meterFormatter.format(DEOGEN_MAX_DISTANCE)} or further from the player`,
				speed: DEOGEN_MAX_SPEED,
			};
			const distance = getGhostDistance();
			if (distance == null) deogen.speeds.push([slowSpeed, fastSpeed]);
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
			thaye.speeds.push([minSpeedObj, maxSpeedObj]);
		else {
			const minAges = Math.floor(timeSpentNearGhost / THAYE_AGE_MAX_S);
			const maxAges = Math.floor(timeSpentNearGhost / THAYE_AGE_MIN_S);
			const speedrange = [];
			if (minAges === 0)
				speedrange.push(minSpeedObj);
			else
				speedrange.push({
					name: `After ageing ${minAges} times (players have spent between ${minutesFormatter.format(minAges * THAYE_AGE_MIN_S / 60)} and ${minutesFormatter.format(minAges * THAYE_AGE_MAX_S / 60)} in the same room as the ghost)`,
					speed: Math.max(THAYE_MIN_SPEED, THAYE_MAX_SPEED - minAges * THAYE_SPEED_NERF_PER_AGE),
				});
			if (minAges !== maxAges) {
				if (maxAges === ageLimit)
					speedrange.push(maxSpeedObj);
				else
					speedrange.push({
						name: `After ageing ${maxAges} times (players have spent between ${minutesFormatter.format(maxAges * THAYE_AGE_MIN_S / 60)} and ${minutesFormatter.format(maxAges * THAYE_AGE_MAX_S / 60)} in the same room as the ghost)`,
						speed: Math.max(THAYE_MIN_SPEED, THAYE_MAX_SPEED - maxAges * THAYE_SPEED_NERF_PER_AGE),
					});
			}
			thaye.speeds.push(speedrange);
		}
		speedMarkers.push(thaye);
	}

	// We do the mimic last, since it could be the speed of any other ghost
	{
		const mimic = {
			name: "The Mimic",
			speeds: [],
		};

		let slowestSpeed = null;
		let slowestGhost = null;
		let fastestSpeed = null;
		let fastestGhost = null;

		// Find lowest and highest speed of all ghosts
		for (const ghost of speedMarkers) {
			const slowestOfGhost = slowestOf(ghost);
			if (slowestSpeed == null || slowestOfGhost.speed < slowestSpeed.speed) {
				slowestSpeed = slowestOfGhost;
				slowestGhost = ghost;
			}
			const fastestOfGhost = fastestOf(ghost);
			if (fastestSpeed == null || fastestOfGhost.speed > fastestSpeed.speed) {
				fastestSpeed = fastestOfGhost;
				fastestGhost = ghost;
			}
		}

		mimic.speeds.push([
			{
				name: `Mimic of ${slowestGhost.name}, ${slowestSpeed.name}`,
				speed: slowestSpeed.speed,
			},
			{
				name: `Mimic of ${fastestGhost.name}, ${fastestSpeed.name}`,
				speed: fastestSpeed.speed,
			},
		]);

		speedMarkers.push(mimic);
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
			if (Array.isArray(speed)) {
				const range = document.createElement("div");
				div.appendChild(range);
				range.classList.add("continuous-range");
				range.style.bottom = `${toScale(slowestOf(ghost).speed) * 100}%`;
				range.style.height = `${toScale(fastestOf(ghost).speed - slowestOf(ghost).speed) * 100}%`;
				for (const speedChild of speed) {
					const marker = document.createElement("div");
					div.appendChild(marker);
					marker.classList.add("marker");
					marker.style.bottom = `calc(${toScale(speedChild.speed) * 100}% + var(--bottom-offset))`;
					marker.title = speedChild.name;
				}
			} else {
				div.classList.add("marker");
				div.style.bottom = `calc(${toScale(speed.speed) * 100}% + var(--bottom-offset))`;
				div.title = speed.name;
			}
			return div;
		}));
		const label = ghostContainer.querySelector(".label");
		label.style.bottom = `${toScale((slowestOf(ghost).speed + fastestOf(ghost).speed) / 2) * 100}%`;
		const entireRange = ghostContainer.querySelector(".entire-range");
		entireRange.style.bottom = `${toScale(slowestOf(ghost).speed) * 100}%`;
		entireRange.style.height = `${toScale(fastestOf(ghost).speed - slowestOf(ghost).speed) * 100}%`;
	}
}

function toScale(speed) {
	return (speed - SPEED_SCALE[0]) / (SPEED_SCALE[1] - SPEED_SCALE[0]);
}

function updateTapTrace() {
	const canvas = byId("tap-trace");
	const ctx = canvas.getContext("2d");
	ctx.save();

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Transform so origin is in bottom left
	ctx.translate(0, canvas.height);
	ctx.scale(1, -1);

	if (taps.length < 2) return;

	const msToShow = Math.max(4e3, taps[taps.length - 1] - taps[1]);
	const pxPerUnitTime = canvas.width / msToShow;
	const pxPerUnitSpeed = canvas.height / (SPEED_SCALE[1] - SPEED_SCALE[0]);
	function withUnitSpace(fn) {
		ctx.save();
		ctx.scale(pxPerUnitTime, pxPerUnitSpeed);
		ctx.translate(0, -SPEED_SCALE[0]);
		fn();
		ctx.restore();
	}

	// Draw last-tap tempo line
	ctx.beginPath();
	withUnitSpace(() => {
		for (let i = 1; i < taps.length; i++) {
			const x = taps[i] - taps[1];
			const y = tempoToSpeed(60e3 / (taps[i] - taps[i - 1]));
			if (i === 1) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
	});
	ctx.save();
	ctx.lineWidth = 3;
	ctx.strokeStyle = "#fff2";
	ctx.stroke();
	ctx.restore();

	// Draw rolling average tempo line
	ctx.beginPath();
	withUnitSpace(() => {
		for (let i = 1; i < taps.length; i++) {
			// Get the earliest sample within n seconds
			let j = i;
			while (j - 1 >= 0 && taps[i] - taps[j - 1] < ROLLING_AVERAGE_MS) j--;
			const x = taps[i] - taps[1];

			// Calculate the average over those samples
			const y = tempoToSpeed(60e3 / (taps[i] - taps[j]) * (i - j));

			if (i === 1) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
	});
	ctx.save();
	ctx.lineWidth = 8;
	ctx.strokeStyle = "white";
	ctx.stroke();
	ctx.lineWidth = 4;
	ctx.strokeStyle = "black";
	ctx.stroke();
	ctx.restore();

	ctx.restore();
}

let timerStart = null;
let timerStop = null;
let timerInterval = null;

function resetTimer() {
	clearInterval(timerInterval);
	timerStart = timerStop = timerInterval = null;
	updateTimerReadout();
}

function startStopTimer() {
	if (timerInterval == null) {
		timerStart = performance.now();
		timerStop = null;
		updateTimerReadout();
		timerInterval = setInterval(updateTimerReadout, 100);
	} else {
		timerStop = performance.now();
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

function getHuntSafety(secondsSinceIncense) {
	let minSafe = Infinity;
	let maxSafe = -Infinity;
	for (const ghostContainer of document.querySelectorAll("#ghosts li")) {
		if (ghostMarkedImpossible(ghostContainer)) continue;
		const minSuspension = Math.min(...Array.from(ghostContainer.classList)
			.filter((cls) => /^incense-hunt-suspension-/.test(cls))
			.map((cls) => parseInt(cls.substring("incense-hunt-suspension-".length))));
		minSafe = Math.min(minSafe, minSuspension);
		maxSafe = Math.max(maxSafe, minSuspension);
	}
	if (minSafe === Infinity || maxSafe === -Infinity) return null;
	if (secondsSinceIncense < minSafe) return "safe";
	if (secondsSinceIncense < maxSafe) return "caution";
	return "danger";
}

function updateTimerReadout() {
	const seconds = (getTimerAdjust() + (timerStart == null ? 0 : ((timerStop == null ? performance.now() : timerStop) - timerStart))) / 1e3;
	const readout = byId("timer-readout");
	const safety = getHuntSafety(seconds);
	readout.classList.toggle("safe", safety === "safe");
	readout.classList.toggle("caution", safety === "caution");
	readout.classList.toggle("danger", safety === "danger");
	readout.innerText = timerFormatter.format(seconds);
}

function updateConfidenceReadout(counter) {
	const output = document.querySelector(`output[for="${counter.id}"]`);
	const count = parseInt(counter.value);
	if (isNaN(count)) {
		output.innerText = "…";
		return;
	}
	const [numerator, denominator] = counter.dataset.chance.split("/").map((strnum) => parseInt(strnum));
	const chance = numerator / denominator;
	const invChance = 1 - chance;
	const confidence = 1 - Math.pow(invChance, count);
	output.innerText = `${Math.round(100 * confidence)}%`;
}

init();
