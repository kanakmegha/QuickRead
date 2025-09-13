import React from 'react';
import './ChapterSidebar.css';

export default function ChapterSidebar({ chapters, activeIndex, onSelect, disabled }) {
	return (
		<aside className="sidebar">
			<h3 className="sidebar-title">Chapters</h3>
			<ul className="chapter-list">
				{(chapters || []).map((c, idx) => (
					<li key={idx}>
						<button
							className={`chapter-item ${idx === activeIndex ? 'active' : ''}`}
							onClick={() => onSelect?.(idx)}
							disabled={disabled}
						>
							{c.title?.slice(0, 80) || `Chapter ${idx+1}`}
						</button>
					</li>
				))}
			</ul>
		</aside>
	);
} 