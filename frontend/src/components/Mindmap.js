import { useEffect } from "react";
import mermaid from "mermaid";

export default function Mindmap({ mindmap }) {
  useEffect(() => {
    mermaid.initialize({ startOnLoad: true });
    if (mindmap) {
      const graph = `
        graph TD
        ${mindmap.nodes.map((node) => `${node.id}[${node.text}]`).join("\n")}
        ${mindmap.edges.map((edge) => `${edge.from} --> ${edge.to}`).join("\n")}
      `;
      mermaid.render("mindmap", graph, (svgCode) => {
        document.getElementById("mindmap").innerHTML = svgCode;
      });
    }
  }, [mindmap]);

  return (
    <div>
      {process.env.NODE_ENV === "development" && (
        <pre>{JSON.stringify(mindmap, null, 2)}</pre>
      )}
      <div id="mindmap"></div>
    </div>
  );
}