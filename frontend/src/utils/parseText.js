// Utilities for parsing text into chapters, generating summaries, and building graph data

const STOPWORDS = new Set([
	"the","and","a","an","to","of","in","on","for","with","as","by","at","from","is","are","was","were","be","been","being","that","this","it","its","or","but","if","then","so","than","into","about","over","after","before","during","most","more","many","much","can","could","should","would","may","might","will","just","very","not","no","yes","you","we","they","he","she","him","her","them"
]);

export function tokenizeWords(text) {
	return (text || '').split(/\s+/).filter(Boolean);
}

export function parseChapters(text) {
	if (!text) return { chapters: [{ title: 'Full Text', startWordIndex: 0 }], words: [] };
	const lines = text.split(/\n/);
	const indices = [];
	let charPos = 0;
	for (const line of lines) {
		const trimmed = line.trim();
		const isChapter = /^(chapter\s+\d+\b.*|\d+\.\s+.+|[IVXLC]+\.?\s+.+|[A-Z][A-Z\s]{3,})$/i.test(trimmed);
		if (isChapter && trimmed.length > 0) {
			indices.push({ title: trimmed, charIndex: charPos });
		}
		charPos += line.length + 1; // include newline
	}
	const words = tokenizeWords(text);
	if (indices.length === 0) {
		return { chapters: [{ title: 'Full Text', startWordIndex: 0 }], words };
	}
	const chapters = indices.map((c) => ({
		title: c.title,
		startWordIndex: tokenizeWords(text.slice(0, c.charIndex)).length
	}));
	// Ensure unique and sorted
	const unique = [];
	const seen = new Set();
	for (const c of chapters.sort((a,b)=>a.startWordIndex-b.startWordIndex)) {
		if (!seen.has(c.startWordIndex)) { seen.add(c.startWordIndex); unique.push(c); }
	}
	if (unique[0]?.startWordIndex !== 0) {
		unique.unshift({ title: 'Introduction', startWordIndex: 0 });
	}
	return { chapters: unique, words };
}

export function summariseText(text, maxSentences = 7) {
	if (!text) return '';
	const sentences = text.split(/(?<=[.!?])\s+/);
	// Score sentences by term frequency excluding stopwords
	const freq = new Map();
	const wordify = (s) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu,'').split(/\s+/).filter(Boolean);
	for (const s of sentences) {
		for (const w of wordify(s)) {
			if (!STOPWORDS.has(w)) freq.set(w, (freq.get(w) || 0) + 1);
		}
	}
	const scoreSentence = (s, idx) => {
		let score = 0;
		for (const w of wordify(s)) score += freq.get(w) || 0;
		// Slight boost for earlier sentences
		return score + Math.max(0, (sentences.length - idx) * 0.01);
	};
	const ranked = sentences
		.map((s, i) => ({ s, i, score: scoreSentence(s, i) }))
		.sort((a,b)=>b.score-a.score)
		.slice(0, maxSentences)
		.sort((a,b)=>a.i-b.i)
		.map(r=>r.s);
	return ranked.join(' ');
}

export function buildChapterGraph(text, startWordIndex = 0, endWordIndex = null, maxKeywords = 12) {
	const words = tokenizeWords(text);
	const start = Math.max(0, startWordIndex);
	const end = endWordIndex == null ? words.length : Math.min(words.length, endWordIndex);
	const segment = words.slice(start, end).map(w=>w.replace(/[^\p{L}\p{N}-]/gu,''));
	const freq = new Map();
	for (const w of segment) {
		const lw = w.toLowerCase();
		if (!lw || STOPWORDS.has(lw)) continue;
		freq.set(lw, (freq.get(lw) || 0) + 1);
	}
	const keywords = Array.from(freq.entries()).sort((a,b)=>b[1]-a[1]).slice(0, maxKeywords).map(([k,v])=>({ id: k, value: v }));
	const nodes = [{ id: 'Chapter', value: 10 }, ...keywords];
	const links = keywords.map(k => ({ source: 'Chapter', target: k.id, value: k.value }));
	return { nodes, links };
} 