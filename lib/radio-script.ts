/**
 * V FOR X — Radio script mode (todo-018)
 *
 * Turns a Briefing stat (number + label + unit + context) into a ~90-second
 * radio voiceover script: a cold open, the hard number read aloud, a
 * "why it matters" line, and a close with a share token.
 *
 * Static / offline / no network. Reads only the stat object you pass in.
 * Designed for low-bandwidth broadcast and TTS — plain ASCII prose, short
 * sentences, no jargon.
 */

export interface BriefingStat {
	/** Human label, e.g. "People facing acute hunger". */
	label: string;
	/** Numeric value. */
	value: number;
	/** Unit, e.g. "people", "%", "million". */
	unit: string;
	/** Optional ISO3 the stat is scoped to (else "world"). */
	iso3?: string;
	/** Optional one-sentence source citation. */
	source?: string;
	/** Optional short share token (VFX*) to read at the close. */
	token?: string;
}

/** Result of formatting a number for speech. */
export interface SpokenNumber {
	/** Words to read, e.g. "three hundred and forty-two million". */
	words: string;
	/** Compact display magnitude, e.g. "342M". */
	display: string;
	/** Spoken display magnitude, e.g. "342 million" — for radio repeat lines. */
	displayWords: string;
}

const SMALL_WORDS = [
	"zero",
	"one",
	"two",
	"three",
	"four",
	"five",
	"six",
	"seven",
	"eight",
	"nine",
	"ten",
	"eleven",
	"twelve",
	"thirteen",
	"fourteen",
	"fifteen",
	"sixteen",
	"seventeen",
	"eighteen",
	"nineteen",
];

const TENS = [
	"",
	"",
	"twenty",
	"thirty",
	"forty",
	"fifty",
	"sixty",
	"seventy",
	"eighty",
	"ninety",
];

/** Convert a non-negative integer under 1000 to British/US English words. */
function under1000(n: number): string {
	if (n === 0) return "zero";
	const parts: string[] = [];
	const hundreds = Math.floor(n / 100);
	const rest = n % 100;
	if (hundreds > 0) parts.push(`${SMALL_WORDS[hundreds]} hundred`);
	if (rest > 0) {
		if (rest < 20) {
			parts.push(SMALL_WORDS[rest]);
		} else {
			const ten = Math.floor(rest / 10);
			const one = rest % 10;
			parts.push(one === 0 ? TENS[ten] : `${TENS[ten]}-${SMALL_WORDS[one]}`);
		}
	}
	return parts.join(" and ");
}

const MAGNITUDES: { threshold: number; singular: string; display: string }[] = [
	{ threshold: 1_000_000_000, singular: "billion", display: "B" },
	{ threshold: 1_000_000, singular: "million", display: "M" },
	{ threshold: 1_000, singular: "thousand", display: "K" },
];

/** Speak a number with magnitude, e.g. 342_000_000 → "three hundred and forty-two million". */
export function speakNumber(value: number): SpokenNumber {
	const n = Math.max(0, Math.floor(value));
	if (n < 1000) {
		const words = under1000(n);
		return { words, display: `${n}`, displayWords: words };
	}
	for (const mag of MAGNITUDES) {
		if (n >= mag.threshold) {
			const lead = Math.floor(n / mag.threshold);
			const remainder = n % mag.threshold;
			const leadWords = under1000(lead);
			const display = `${(n / mag.threshold).toFixed(remainder === 0 ? 0 : 1)}${mag.display}`;
			const displayWords = `${lead} ${mag.singular}`;
			return { words: `${leadWords} ${mag.singular}`, display, displayWords };
		}
	}
	const words = under1000(n);
	return { words, display: `${n}`, displayWords: words };
}

/** Estimated spoken seconds for a script (avg 2.5 words/sec, conservative). */
export function estimateSeconds(script: string): number {
	const words = script.trim().split(/\s+/).filter(Boolean).length;
	return Math.max(15, Math.round(words / 2.5));
}

/** Build a ~90s voiceover script from a briefing stat. */
export function radioScript(stat: BriefingStat): string {
	const place = stat.iso3 && stat.iso3 !== "world" ? stat.iso3 : "the world";
	const spoken = speakNumber(stat.value);
	const lines: string[] = [
		`This is V for X. In sixty seconds, one number.`,
		`Tonight, from ${place}: ${stat.label}.`,
		`The number: ${spoken.words} ${stat.unit}.`,
		`Say it again. ${spoken.displayWords} ${stat.unit}.`,
	];
	if (stat.source) {
		lines.push(`Source: ${stat.source}.`);
	}
	lines.push(
		`Why it matters: behind every digit is a person who can be reached, a choice that can be changed, a record that can be kept.`,
		`If you can hear this, you can act. Share the number. Verify it. Hold it.`,
	);
	if (stat.token) {
		lines.push(`Token: ${stat.token}.`);
	}
	lines.push(`This was V for X. The number does not forget.`);
	return lines.join("\n");
}

/** Convenience: build the script and check it lands near 90s spoken. */
export function radioScriptCard(stat: BriefingStat): {
	script: string;
	spokenSeconds: number;
} {
	const script = radioScript(stat);
	return { script, spokenSeconds: estimateSeconds(script) };
}
