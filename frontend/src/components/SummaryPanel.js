import React from 'react';
import './SummaryPanel.css';

export default function SummaryPanel({ summary, onGenerate, generating }) {
	return (
		<aside className="summary-panel">
			<div className="summary-header">
				<h3>Summary</h3>
				<button onClick={onGenerate} disabled={generating}>
					{generating ? 'Generating...' : 'Generate Summary'}
				</button>
			</div>
			{summary ? (
				<ul className="summary-list">
					{summary.split(/(?<=[.!?])\s+/).slice(0, 12).map((s, i) => (
						<li key={i}>{s}</li>
					))}
				</ul>
			) : (
				<p className="summary-empty">No summary yet.</p>
			)}
		</aside>
	);
} 