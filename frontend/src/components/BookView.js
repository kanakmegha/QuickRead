import React, { useMemo, useEffect, useRef } from 'react';
import './BookView.css';

function splitWordBoldFirstHalf(word) {
	if (!word) return word;
	const lettersOnly = word.match(/^[\p{L}\p{N}]+/u)?.[0] || '';
	const nonLetters = word.slice(lettersOnly.length);
	const middle = Math.ceil(lettersOnly.length / 2);
	const first = lettersOnly.slice(0, middle);
	const second = lettersOnly.slice(middle);
	return (
		<span className="word" key={word + Math.random()}>
			<strong>{first}</strong>{second}{nonLetters}
		</span>
	);
}

export default function BookView({ text, scrollToWordIndex }) {
	const paragraphRefs = useRef([]);
	const paragraphs = useMemo(() => {
		if (!text) return [];
		const raw = text
			.split(/\n\s*\n/g)
			.map(p => p.trim())
			.filter(Boolean);
		let cumulative = 0;
		return raw.map((p) => {
			const words = p.split(/\s+/).filter(Boolean);
			const start = cumulative;
			cumulative += words.length;
			return { p, startWordIndex: start };
		});
	}, [text]);

	useEffect(() => {
		if (typeof scrollToWordIndex !== 'number') return;
		if (!paragraphs.length) return;
		let targetIdx = 0;
		for (let i = 0; i < paragraphs.length; i++) {
			const start = paragraphs[i].startWordIndex;
			const nextStart = paragraphs[i + 1]?.startWordIndex ?? Number.MAX_SAFE_INTEGER;
			if (scrollToWordIndex >= start && scrollToWordIndex < nextStart) {
				targetIdx = i;
				break;
			}
		}
		const el = paragraphRefs.current[targetIdx];
		el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, [scrollToWordIndex, paragraphs]);

	return (
		<div className="book-wrapper">
			<div className="book">
				{paragraphs.length === 0 && (
					<p className="empty">Upload a PDF to see the book view.</p>
				)}
				{paragraphs.map(({ p, startWordIndex }, idx) => (
					<p className="paragraph" key={idx} ref={el => paragraphRefs.current[idx] = el}>
						{p.split(/\s+/).map((w, i) => (
							<React.Fragment key={`${idx}-${i}`}>
								{splitWordBoldFirstHalf(w)}{' '}
							</React.Fragment>
						))}
					</p>
				))}
			</div>
		</div>
	);
} 