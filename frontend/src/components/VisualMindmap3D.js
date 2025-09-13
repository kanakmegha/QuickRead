import React, { useRef, useEffect } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import './VisualMindmap3D.css';

export default function VisualMindmap3D({ graph }) {
	const fgRef = useRef();
	useEffect(() => {
		const fg = fgRef.current;
		if (fg) {
			fg.d3Force('charge')?.strength(-80);
		}
	}, [graph]);
	if (!graph) return null;
	return (
		<div className="mindmap3d-wrapper">
			<ForceGraph3D
				ref={fgRef}
				graphData={graph}
				nodeAutoColorBy="group"
				nodeLabel={(n) => `${n.id}`}
				nodeVal={(n) => n.value || 3}
				linkOpacity={0.4}
				linkWidth={(l) => Math.max(1, Math.log((l.value || 1) + 1))}
				width={400}
				height={300}
			/>
		</div>
	);
} 