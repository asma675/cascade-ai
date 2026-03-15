import { useState } from "react";
import mockData from "../data/mockData";
import "./CascadingFlowchart.css";

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  );
}

function WorkflowCard({ layer }) {
  return (
    <div className="workflow-card" style={{ backgroundColor: layer.color }}>
      <div className="workflow-header">
        <span className="workflow-type">{layer.type}</span>
        <span className="workflow-icon">{layer.icon}</span>
      </div>
      <h3 className="workflow-title">{layer.title}</h3>
      <p className="workflow-description">{layer.description}</p>
      <div className="workflow-impact">
        <span className="impact-label">Impact Level</span>
        <span className="impact-value">{layer.impactLevel}</span>
      </div>
    </div>
  );
}

function Arrow() {
  return (
    <div className="arrow-connector">
      <div className="arrow-line" />
      <div className="arrow-head">&#8595;</div>
      <div className="arrow-line" />
    </div>
  );
}

export default function CascadingFlowchart() {
  const [activeChain, setActiveChain] = useState(0);

  const chain = mockData[activeChain];

  return (
    <div className="flowchart-container">
      <h1 className="flowchart-title">
        <span className="title-icon">&#10072;&#126;&#10072;</span>
        Cascading Impact Flowchart
      </h1>

      <div className="chain-buttons">
        {mockData.map((item, index) => (
          <button
            key={item.id}
            className={`chain-btn ${activeChain === index ? "active" : ""}`}
            onClick={() => setActiveChain(index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="stats-row" key={`stats-${activeChain}`}>
        <StatCard label="Probability" value={chain.probability} />
        <StatCard label="Severity" value={chain.severity} />
        <StatCard label="Confidence" value={chain.confidence} />
      </div>

      <div className="workflow-stack" key={`workflow-${activeChain}`}>
        {chain.layers.map((layer, index) => (
          <div key={layer.type} className="workflow-entry" style={{ animationDelay: `${index * 0.12}s` }}>
            {index > 0 && <Arrow />}
            <WorkflowCard layer={layer} />
          </div>
        ))}
      </div>
    </div>
  );
}
