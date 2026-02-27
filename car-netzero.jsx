import { useState, useEffect, useMemo, useCallback } from "react";

// === DESIGN SYSTEM ===
const C = {
  bg: "#F7F6F3", card: "#FFFFFF", dark: "#141414", mid: "#505050", light: "#999894",
  accent: "#D63031", accentFade: "#FEF0F0",
  opt: "#0B6E4F", optFade: "#EEFBF5",
  noopt: "#BF4A31", nooptFade: "#FDF3F0",
  blue: "#1B4965", blueFade: "#EDF4F8",
  amber: "#C57B1F", amberFade: "#FFF8EC",
  purple: "#5B2C8A", purpleFade: "#F6F0FC",
  slate: "#3D5A6E",
  border: "#E4E3DF", grid: "#EDECE8",
};

const font = {
  display: "'Libre Baskerville', 'Georgia', serif",
  body: "'DM Sans', 'Helvetica Neue', sans-serif",
  mono: "'JetBrains Mono', monospace",
};

// === DATA SIMULATION ENGINE ===
// Cumulative removal trajectories (Gt CO2/yr)
const years = Array.from({ length: 27 }, (_, i) => 2024 + i);

function genTrajectory(optimized) {
  // S-curve ramp to target, with noise
  return years.map((yr, i) => {
    const t = i / 26;
    const target = optimized ? 8.5 : 5.2;
    const midpoint = optimized ? 0.45 : 0.55;
    const steepness = optimized ? 8 : 6;
    const val = target / (1 + Math.exp(-steepness * (t - midpoint)));
    const noise = Math.sin(i * 1.7) * 0.08 * val;
    return { year: yr, value: Math.max(0.001, val + noise) };
  });
}

const optPath = genTrajectory(true);
const nooptPath = genTrajectory(false);

// Cost per tonne trajectories
function genCostCurve(optimized) {
  return years.map((yr, i) => {
    const t = i / 26;
    const start = optimized ? 180 : 220;
    const end = optimized ? 45 : 95;
    const val = start + (end - start) * (1 - Math.exp(-3.2 * t));
    return { year: yr, value: Math.round(val) };
  });
}

const optCost = genCostCurve(true);
const nooptCost = genCostCurve(false);

// === SHARED COMPONENTS ===
const Pill = ({ children, active, color, onClick }) => (
  <button onClick={onClick} style={{
    padding: "4px 14px", fontSize: 11, fontWeight: 600, fontFamily: font.body,
    border: `1.5px solid ${active ? color : C.border}`,
    background: active ? `${color}12` : "transparent",
    color: active ? color : C.mid, borderRadius: 2, cursor: "pointer",
    letterSpacing: 0.3, transition: "all 0.15s",
  }}>{children}</button>
);

const Legend = ({ items }) => (
  <div style={{ display: "flex", gap: 16, marginBottom: 6 }}>
    {items.map((it, i) => (
      <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <div style={{ width: it.dash ? 16 : 8, height: it.dash ? 0 : 8, borderRadius: 1, background: it.dash ? "none" : it.color, borderTop: it.dash ? `2px dashed ${it.color}` : "none" }} />
        <span style={{ fontSize: 10, color: C.mid, fontFamily: font.body }}>{it.label}</span>
      </div>
    ))}
  </div>
);

const SectionHead = ({ num, title, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
      <span style={{ fontFamily: font.mono, fontSize: 10, color: C.accent, fontWeight: 700 }}>{num}</span>
      <h3 style={{ fontFamily: font.display, fontSize: 19, fontWeight: 700, color: C.dark, margin: 0, lineHeight: 1.25 }}>{title}</h3>
    </div>
    {sub && <p style={{ fontSize: 12, color: C.light, margin: "4px 0 0 0", fontFamily: font.body, maxWidth: 560 }}>{sub}</p>}
    <div style={{ width: 28, height: 2, background: C.accent, marginTop: 8 }} />
  </div>
);

const Card = ({ children, style = {} }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 3, padding: 20, marginBottom: 28, ...style }}>
    {children}
  </div>
);

const Source = ({ text }) => (
  <div style={{ fontSize: 9, color: C.light, fontFamily: font.body, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${C.grid}` }}>{text}</div>
);

// Mini SVG line chart component
const MiniChart = ({ dataA, dataB, height = 140, width = "100%", labelA = "CaR-optimized", labelB = "Non-optimized", unit = "", yMax: yMaxProp, showArea = false, targetLine = null }) => {
  const svgW = 520;
  const svgH = height;
  const pad = { t: 12, r: 8, b: 24, l: 42 };
  const plotW = svgW - pad.l - pad.r;
  const plotH = svgH - pad.t - pad.b;

  const allVals = [...dataA.map(d => d.value), ...(dataB || []).map(d => d.value)];
  if (targetLine) allVals.push(targetLine);
  const yMax = yMaxProp || Math.ceil(Math.max(...allVals) * 1.15);
  const yMin = 0;

  const toX = (i) => pad.l + (i / (dataA.length - 1)) * plotW;
  const toY = (v) => pad.t + plotH - ((v - yMin) / (yMax - yMin)) * plotH;

  const pathStr = (data) => data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i).toFixed(1)},${toY(d.value).toFixed(1)}`).join(" ");
  const areaStr = (data) => pathStr(data) + ` L${toX(data.length - 1).toFixed(1)},${toY(0).toFixed(1)} L${toX(0).toFixed(1)},${toY(0).toFixed(1)} Z`;

  const gridLines = Array.from({ length: 5 }, (_, i) => yMin + ((yMax - yMin) * i) / 4);

  return (
    <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width, height: "auto", display: "block" }}>
      {/* Grid */}
      {gridLines.map((v, i) => (
        <g key={i}>
          <line x1={pad.l} x2={svgW - pad.r} y1={toY(v)} y2={toY(v)} stroke={C.grid} strokeWidth={0.8} />
          <text x={pad.l - 4} y={toY(v) + 3} textAnchor="end" fontSize={9} fill={C.light} fontFamily={font.body}>{Math.round(v)}{unit}</text>
        </g>
      ))}
      {/* Year labels */}
      {dataA.filter((_, i) => i % 5 === 0 || i === dataA.length - 1).map((d, i) => (
        <text key={i} x={toX(dataA.indexOf(d))} y={svgH - 4} textAnchor="middle" fontSize={9} fill={C.light} fontFamily={font.body}>{d.year}</text>
      ))}
      {/* Target line */}
      {targetLine && (
        <g>
          <line x1={pad.l} x2={svgW - pad.r} y1={toY(targetLine)} y2={toY(targetLine)} stroke={C.accent} strokeWidth={1} strokeDasharray="4,3" />
          <text x={svgW - pad.r} y={toY(targetLine) - 4} textAnchor="end" fontSize={9} fill={C.accent} fontFamily={font.body} fontWeight={600}>Target</text>
        </g>
      )}
      {/* Area fills */}
      {showArea && <path d={areaStr(dataA)} fill={`${C.opt}15`} />}
      {showArea && dataB && <path d={areaStr(dataB)} fill={`${C.noopt}10`} />}
      {/* Lines */}
      {dataB && <path d={pathStr(dataB)} fill="none" stroke={C.noopt} strokeWidth={2} strokeDasharray="5,3" />}
      <path d={pathStr(dataA)} fill="none" stroke={C.opt} strokeWidth={2.5} />
      {/* End dots */}
      <circle cx={toX(dataA.length - 1)} cy={toY(dataA[dataA.length - 1].value)} r={3.5} fill={C.opt} />
      {dataB && <circle cx={toX(dataB.length - 1)} cy={toY(dataB[dataB.length - 1].value)} r={3.5} fill={C.noopt} />}
    </svg>
  );
};

// === 10 MECE GRAPHICS ===

// G1: Cumulative Removal Trajectory
const G1_Trajectory = () => (
  <Card>
    <SectionHead num="G1" title="Removal Trajectory: Optimized vs Baseline" sub="CaR-optimized deployment reaches 8.5 Gt/yr by 2050; non-optimized stalls at ~5 Gt/yr — a 3.3 Gt annual gap." />
    <Legend items={[{ label: "CaR-optimized", color: C.opt }, { label: "Non-optimized", color: C.noopt, dash: true }]} />
    <MiniChart dataA={optPath} dataB={nooptPath} height={160} unit="" showArea targetLine={7.5} />
    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
      {[
        { val: "8.5", unit: "Gt/yr", label: "CaR-optimized 2050", color: C.opt },
        { val: "5.2", unit: "Gt/yr", label: "Non-optimized 2050", color: C.noopt },
        { val: "3.3", unit: "Gt/yr", label: "Annual gap = lost removal", color: C.accent },
      ].map((m, i) => (
        <div key={i} style={{ flex: 1, textAlign: "center", padding: 10, background: `${m.color}08`, borderRadius: 2 }}>
          <div style={{ fontFamily: font.display, fontSize: 26, fontWeight: 700, color: m.color }}>{m.val}<span style={{ fontSize: 12, fontWeight: 400 }}>{m.unit}</span></div>
          <div style={{ fontSize: 10, color: C.mid }}>{m.label}</div>
        </div>
      ))}
    </div>
    <Source text="Modeled S-curve deployment. Target: Smith et al. 2024 (7-10 Gt/yr). Non-optimized reflects binary frameworks + static buffers." />
  </Card>
);

// G2: Cost Per Tonne
const G2_Cost = () => (
  <Card>
    <SectionHead num="G2" title="Blended Cost Per Tonne: Learning Curve Acceleration" sub="Risk transparency accelerates Wright's Law cost reductions via earlier capital deployment." />
    <Legend items={[{ label: "CaR-optimized", color: C.opt }, { label: "Non-optimized", color: C.noopt, dash: true }]} />
    <MiniChart dataA={optCost} dataB={nooptCost} height={140} unit="$" />
    <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
      <div style={{ flex: 1, padding: 10, background: C.optFade, borderRadius: 2, textAlign: "center" }}>
        <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: C.opt }}>$45/t</div>
        <div style={{ fontSize: 10, color: C.mid }}>CaR blended cost 2050</div>
      </div>
      <div style={{ flex: 1, padding: 10, background: C.nooptFade, borderRadius: 2, textAlign: "center" }}>
        <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: C.noopt }}>$95/t</div>
        <div style={{ fontSize: 10, color: C.mid }}>Non-optimized cost 2050</div>
      </div>
      <div style={{ flex: 1, padding: 10, background: C.accentFade, borderRadius: 2, textAlign: "center" }}>
        <div style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, color: C.accent }}>$425B</div>
        <div style={{ fontSize: 10, color: C.mid }}>Annual savings at 8.5 Gt</div>
      </div>
    </div>
    <Source text="Wright's Law: each doubling of cumulative deployment reduces cost ~15-20%. Earlier deployment = more doublings by 2050. CaR enables earlier capital allocation." />
  </Card>
);

// G3: Goal Achievement Probability
const G3_Probability = () => {
  const bars = [
    { yr: 2030, opt: 92, noopt: 68 },
    { yr: 2035, opt: 88, noopt: 55 },
    { yr: 2040, opt: 85, noopt: 42 },
    { yr: 2045, opt: 82, noopt: 35 },
    { yr: 2050, opt: 78, noopt: 28 },
  ];
  return (
    <Card>
      <SectionHead num="G3" title="Probability of Meeting Interim Targets" sub="CaR maintains >78% confidence across all milestones. Non-optimized drops below 30% by 2050." />
      <Legend items={[{ label: "CaR-optimized", color: C.opt }, { label: "Non-optimized", color: C.noopt }]} />
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", height: 130, marginTop: 8 }}>
        {bars.map((b, i) => (
          <div key={i} style={{ flex: 1, display: "flex", gap: 2, alignItems: "flex-end", height: "100%" }}>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: C.opt, fontWeight: 700, fontFamily: font.mono }}>{b.opt}%</span>
              <div style={{ width: "100%", height: `${b.opt * 1.1}px`, background: C.opt, borderRadius: "2px 2px 0 0", transition: "height 0.5s" }} />
            </div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ fontSize: 9, color: C.noopt, fontWeight: 700, fontFamily: font.mono }}>{b.noopt}%</span>
              <div style={{ width: "100%", height: `${b.noopt * 1.1}px`, background: C.noopt, borderRadius: "2px 2px 0 0", opacity: 0.7, transition: "height 0.5s" }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        {bars.map((b, i) => <div key={i} style={{ flex: 1, textAlign: "center", fontSize: 10, color: C.mid }}>{b.yr}</div>)}
      </div>
      <Source text="Simulated: confidence of meeting NDC-aligned interim removal targets. Non-optimized suffers from adverse selection, delivery failures, and correlated risks." />
    </Card>
  );
};

// G4: Buffer Pool Efficiency
const G4_Buffers = () => (
  <Card>
    <SectionHead num="G4" title="Buffer Pool Efficiency: Static vs Dynamic" sub="Risk-based buffers release 20-40% of locked capital back into deployment." />
    <div style={{ display: "flex", gap: 12 }}>
      {[
        {
          label: "Static Buffer (Current)", pct: 20, locked: "$100B", deployed: "$400B",
          color: C.noopt, desc: "Flat 15-20% withheld regardless of project quality",
        },
        {
          label: "CaR Dynamic Buffer", pct: 8, locked: "$40B", deployed: "$460B",
          color: C.opt, desc: "Risk-calibrated: 3% for DAC, 15% for NBS, weighted avg ~8%",
        },
      ].map((b, i) => (
        <div key={i} style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 8 }}>{b.label}</div>
          <div style={{ height: 24, background: C.grid, borderRadius: 2, overflow: "hidden", display: "flex" }}>
            <div style={{ width: `${100 - b.pct}%`, background: b.color, transition: "width 0.6s" }} />
            <div style={{ width: `${b.pct}%`, background: `${b.color}30` }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.mid, marginTop: 4 }}>
            <span>Deployed: {b.deployed}</span><span>Locked: {b.locked}</span>
          </div>
          <div style={{ fontSize: 10, color: C.light, marginTop: 4 }}>{b.desc}</div>
        </div>
      ))}
    </div>
    <div style={{ marginTop: 14, padding: 10, background: C.optFade, borderRadius: 2, borderLeft: `3px solid ${C.opt}` }}>
      <span style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: C.opt }}>$60B</span>
      <span style={{ fontSize: 12, color: C.mid, marginLeft: 8 }}>unlocked annually for additional removal deployment</span>
    </div>
    <Source text="At $500B annual market (5Gt × $100/t). Static: Verra/Gold Standard typical 15-20%. CaR: weighted by project CaR scores." />
  </Card>
);

// G5: Technology Diversification
const G5_Diversity = () => {
  const [view, setView] = useState("opt");
  const portfolios = {
    opt: [
      { name: "DAC + Storage", pct: 15, car: "10kg/t", color: C.opt },
      { name: "BioCCS", pct: 12, car: "25kg/t", color: "#148F77" },
      { name: "Biochar", pct: 18, car: "50kg/t", color: "#1B7A5A" },
      { name: "ERW", pct: 14, car: "80kg/t", color: C.amber },
      { name: "OAE", pct: 8, car: "120kg/t", color: C.blue },
      { name: "Reforestation", pct: 20, car: "400kg/t", color: "#6B8E5A" },
      { name: "Peatland", pct: 8, car: "300kg/t", color: "#4A6741" },
      { name: "Innovation", pct: 5, car: "varies", color: C.purple },
    ],
    noopt: [
      { name: "DAC + Storage", pct: 5, car: "?", color: C.noopt },
      { name: "Reforestation", pct: 55, car: "?", color: "#B86B5A" },
      { name: "Biochar", pct: 15, car: "?", color: "#C07850" },
      { name: "Other", pct: 25, car: "?", color: "#D49880" },
    ],
  };
  const p = portfolios[view];
  return (
    <Card>
      <SectionHead num="G5" title="Technology Diversification & Concentration Risk" sub="CaR enables 8-pathway portfolios vs binary-era concentration in cheapest-to-deliver." />
      <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
        <Pill active={view === "opt"} color={C.opt} onClick={() => setView("opt")}>CaR-Optimized</Pill>
        <Pill active={view === "noopt"} color={C.noopt} onClick={() => setView("noopt")}>Non-Optimized</Pill>
      </div>
      <div style={{ display: "flex", height: 28, borderRadius: 2, overflow: "hidden", marginBottom: 12 }}>
        {p.map((s, i) => <div key={i} style={{ width: `${s.pct}%`, background: s.color, transition: "width 0.4s" }} />)}
      </div>
      {p.map((s, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", fontSize: 11 }}>
          <div style={{ width: 8, height: 8, borderRadius: 1, background: s.color }} />
          <span style={{ width: 110, fontWeight: 600, color: C.dark }}>{s.name}</span>
          <span style={{ width: 40, color: C.mid, fontFamily: font.mono, fontSize: 10 }}>{s.pct}%</span>
          <span style={{ fontSize: 10, color: C.light }}>CaR 1000yr: {s.car}</span>
        </div>
      ))}
      <Source text="CaRPS framework: min 5-10% innovation, ≥20% Global South, diversified risk profiles. Source: CaRPS proposal." />
    </Card>
  );
};

// G6: Confidence Bands
const G6_Confidence = () => {
  const genBand = (opt) => years.map((yr, i) => {
    const t = i / 26;
    const target = opt ? 8.5 : 5.2;
    const mid = opt ? 0.45 : 0.55;
    const val = target / (1 + Math.exp(-8 * (t - mid)));
    const spread = opt ? val * 0.12 : val * 0.35;
    return { year: yr, low: Math.max(0, val - spread), mid: val, high: val + spread };
  });
  const optB = genBand(true);
  const nooptB = genBand(false);

  const svgW = 520, svgH = 160;
  const pad = { t: 12, r: 8, b: 24, l: 42 };
  const plotW = svgW - pad.l - pad.r;
  const plotH = svgH - pad.t - pad.b;
  const yMax = 12;
  const toX = (i) => pad.l + (i / (years.length - 1)) * plotW;
  const toY = (v) => pad.t + plotH - (v / yMax) * plotH;

  const bandPath = (data, key1, key2) => {
    const fwd = data.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d[key1])}`).join(" ");
    const bwd = [...data].reverse().map((d, i) => `L${toX(data.length - 1 - i)},${toY(d[key2])}`).join(" ");
    return `${fwd} ${bwd} Z`;
  };

  return (
    <Card>
      <SectionHead num="G6" title="Uncertainty Bands: CaR Narrows the Cone" sub="Risk quantification reduces 95% confidence interval width by ~65%." />
      <Legend items={[{ label: "CaR-optimized ±12%", color: C.opt }, { label: "Non-optimized ±35%", color: C.noopt }]} />
      <svg viewBox={`0 0 ${svgW} ${svgH}`} style={{ width: "100%", height: "auto" }}>
        {[0, 3, 6, 9, 12].map(v => (
          <g key={v}>
            <line x1={pad.l} x2={svgW - pad.r} y1={toY(v)} y2={toY(v)} stroke={C.grid} strokeWidth={0.7} />
            <text x={pad.l - 4} y={toY(v) + 3} textAnchor="end" fontSize={9} fill={C.light}>{v}</text>
          </g>
        ))}
        <path d={bandPath(nooptB, "high", "low")} fill={`${C.noopt}18`} />
        <path d={bandPath(optB, "high", "low")} fill={`${C.opt}20`} />
        <path d={nooptB.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.mid)}`).join(" ")} fill="none" stroke={C.noopt} strokeWidth={1.5} strokeDasharray="4,3" />
        <path d={optB.map((d, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(d.mid)}`).join(" ")} fill="none" stroke={C.opt} strokeWidth={2} />
        <line x1={pad.l} x2={svgW - pad.r} y1={toY(7.5)} y2={toY(7.5)} stroke={C.accent} strokeWidth={1} strokeDasharray="3,3" />
        <text x={svgW - pad.r} y={toY(7.5) - 4} textAnchor="end" fontSize={9} fill={C.accent} fontWeight="600">7.5 Gt target</text>
        {years.filter((_, i) => i % 5 === 0 || i === 26).map((yr, idx) => {
          const i = years.indexOf(yr);
          return <text key={idx} x={toX(i)} y={svgH - 4} textAnchor="middle" fontSize={9} fill={C.light}>{yr}</text>;
        })}
      </svg>
      <Source text="Confidence bands reflect portfolio-level delivery uncertainty. CaR narrows via: quantified project risk, diversification, dynamic rebalancing." />
    </Card>
  );
};

// G7: Capital Deployment Efficiency
const G7_Capital = () => (
  <Card>
    <SectionHead num="G7" title="Capital Mobilization: Unlocking Institutional Investment" sub="VaR enabled $600T in global financial markets. CaR aims to unlock $1T+ for removal." />
    <div style={{ display: "flex", gap: 12 }}>
      {[
        { title: "Non-Optimized", total: "$150B", sources: [{ name: "Philanthropic", pct: 35 }, { name: "Corporate voluntary", pct: 40 }, { name: "Government", pct: 20 }, { name: "Institutional", pct: 5 }], color: C.noopt },
        { title: "CaR-Optimized", total: "$1.2T", sources: [{ name: "Institutional capital", pct: 40 }, { name: "Green bonds/ABS", pct: 25 }, { name: "Insurance-backed", pct: 15 }, { name: "Corp + Gov", pct: 20 }], color: C.opt },
      ].map((col, ci) => (
        <div key={ci} style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dark }}>{col.title}</div>
          <div style={{ fontFamily: font.display, fontSize: 24, fontWeight: 700, color: col.color, margin: "4px 0 10px" }}>{col.total}</div>
          {col.sources.map((s, i) => (
            <div key={i} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.mid, marginBottom: 2 }}>
                <span>{s.name}</span><span style={{ fontFamily: font.mono }}>{s.pct}%</span>
              </div>
              <div style={{ height: 5, background: C.grid, borderRadius: 1 }}>
                <div style={{ height: "100%", width: `${s.pct}%`, background: col.color, borderRadius: 1, opacity: 0.6 + (s.pct / 100) * 0.4 }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
    <Source text="VaR analog: before VaR, portfolio risk was ad-hoc. After: institutional capital scaled 10×. CaR provides same standardized risk language for carbon." />
  </Card>
);

// G8: Insurance & Risk Transfer Market
const G8_Insurance = () => (
  <Card>
    <SectionHead num="G8" title="Risk Transfer Market Creation" sub="CaR enables a $5-15B carbon removal insurance market — analogous to catastrophe insurance." />
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
      {[
        { title: "Project Delivery Insurance", val: "$3-5B", desc: "Covers technology underperformance, delays, abandonment. Premiums scaled to CaR delivery scores.", color: C.blue },
        { title: "Storage Guarantee Products", val: "$2-4B", desc: "Long-tail coverage for reversal events. 100-1000yr horizons. Reinsurance-backed.", color: C.opt },
        { title: "Portfolio Wraps", val: "$1-3B", desc: "Whole-portfolio insurance wrapping mixed CaR profiles. Enables pension fund entry.", color: C.amber },
        { title: "Parametric Triggers", val: "$1-3B", desc: "Automatic payouts on verified shortfall (e.g. >15kg/t lost). No claims process.", color: C.purple },
      ].map((p, i) => (
        <div key={i} style={{ padding: 14, background: `${p.color}08`, borderRadius: 2, borderLeft: `3px solid ${p.color}` }}>
          <div style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, color: p.color }}>{p.val}</div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginTop: 2 }}>{p.title}</div>
          <div style={{ fontSize: 10, color: C.mid, marginTop: 4, lineHeight: 1.4 }}>{p.desc}</div>
        </div>
      ))}
    </div>
    <Source text="Analog: Cat bond market grew from $0 to $45B after standardized risk models. Source: CaRGov framework, Swiss Re estimates." />
  </Card>
);

// G9: Cumulative Warming Impact
const G9_Warming = () => {
  const optTemp = years.map((yr, i) => ({ year: yr, value: 1.2 + (i / 26) * 0.25 + Math.sin(i * 0.5) * 0.02 }));
  const nooptTemp = years.map((yr, i) => ({ year: yr, value: 1.2 + (i / 26) * 0.55 + Math.sin(i * 0.5) * 0.03 }));
  return (
    <Card>
      <SectionHead num="G9" title="Cumulative Warming Avoided" sub="Earlier, larger removals reduce cumulative CO₂ burden — each year of delay amplifies warming." />
      <Legend items={[{ label: "CaR pathway (peak ~1.45°C)", color: C.opt }, { label: "Non-optimized (1.75°C)", color: C.noopt, dash: true }]} />
      <MiniChart dataA={optTemp} dataB={nooptTemp} height={130} unit="°C" yMax={2.0} />
      <div style={{ display: "flex", gap: 16, marginTop: 12 }}>
        <div style={{ flex: 1, textAlign: "center", padding: 10, background: C.optFade, borderRadius: 2 }}>
          <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, color: C.opt }}>~1.45°C</div>
          <div style={{ fontSize: 10, color: C.mid }}>Peak warming (CaR pathway)</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: 10, background: C.nooptFade, borderRadius: 2 }}>
          <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, color: C.noopt }}>~1.75°C</div>
          <div style={{ fontSize: 10, color: C.mid }}>Peak warming (non-optimized)</div>
        </div>
        <div style={{ flex: 1, textAlign: "center", padding: 10, background: C.accentFade, borderRadius: 2 }}>
          <div style={{ fontFamily: font.display, fontSize: 20, fontWeight: 700, color: C.accent }}>0.3°C</div>
          <div style={{ fontSize: 10, color: C.mid }}>Avoided warming = trillions in damages</div>
        </div>
      </div>
      <Source text="0.3°C difference: Bauer & Rudebusch (2023) estimate 2.5% GDP/yr per degree. At ~$100T global GDP, 0.3°C ≈ $750B/yr avoided damages." />
    </Card>
  );
};

// G10: Ongoing Reductions & Monitoring
const G10_Monitoring = () => (
  <Card>
    <SectionHead num="G10" title="Continuous Improvement Flywheel" sub="CaR creates a virtuous cycle: better data → better risk scores → lower premiums → more deployment → better data." />
    <div style={{ position: "relative", height: 240, display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* Center */}
      <div style={{ width: 80, height: 80, borderRadius: "50%", background: C.dark, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
        <span style={{ color: "#fff", fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>CaR<br />Score</span>
      </div>
      {/* Orbital items */}
      {[
        { label: "Deploy", sub: "More projects funded", angle: 0, color: C.opt },
        { label: "Measure", sub: "Performance data", angle: 72, color: C.blue },
        { label: "Update", sub: "Refine CaR scores", angle: 144, color: C.amber },
        { label: "Price", sub: "Lower premiums", angle: 216, color: C.purple },
        { label: "Scale", sub: "Institutional capital", angle: 288, color: C.accent },
      ].map((item, i) => {
        const r = 95;
        const rad = (item.angle - 90) * Math.PI / 180;
        const x = Math.cos(rad) * r;
        const y = Math.sin(rad) * r;
        return (
          <div key={i} style={{
            position: "absolute", left: `calc(50% + ${x}px - 42px)`, top: `calc(50% + ${y}px - 22px)`,
            width: 84, textAlign: "center",
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: item.color }}>{item.label}</div>
            <div style={{ fontSize: 9, color: C.mid }}>{item.sub}</div>
          </div>
        );
      })}
      {/* Circular arrow suggestion */}
      <div style={{ position: "absolute", width: 180, height: 180, borderRadius: "50%", border: `1.5px dashed ${C.grid}` }} />
    </div>
    <div style={{ fontSize: 11, color: C.mid, textAlign: "center", marginTop: 8 }}>
      Analog: Auto insurance. Data → safety improvements → lower premiums → more drivers → more data. The market improved safety.
    </div>
    <Source text="Source: CaR Nature Perspective — 'wisdom of crowds' effect from multiple market participants." />
  </Card>
);

// === 10 MECE STAKEHOLDERS ===
const stakeholders = [
  {
    id: "S1", name: "Project Developer", varAnalog: "Trading Desk",
    varHow: "VaR tells a desk its max daily loss at 95% confidence → sizes positions accordingly.",
    carHow: "CaR tells a developer their project's expected carbon loss → optimizes design, secures financing, sets buffer needs.",
    impact: "15-30% ROI increase via risk-adjusted project design. 20-40% buffer reduction.",
    example: "A biochar producer uses CaR 1000yr = 50kg/t to negotiate 5% buffer (vs 20% static) → frees $2M for expansion.",
    color: C.opt,
  },
  {
    id: "S2", name: "Credit Buyer", varAnalog: "Portfolio Manager",
    varHow: "VaR enables portfolio construction across asset classes with known risk budgets.",
    carHow: "CaR enables portfolio construction across removal types with known delivery/storage risk budgets.",
    impact: "10-20% credit cost reduction. Match removal durability to emission profile.",
    example: "Corporate buyer constructs portfolio: 30% DAC (CaR 10), 40% biochar (CaR 50), 30% NBS (CaR 400) — achieving 50kt durable at lowest blended cost.",
    color: C.blue,
  },
  {
    id: "S3", name: "Insurer", varAnalog: "Underwriter / Actuary",
    varHow: "VaR + actuarial tables enable premium pricing for complex financial risks.",
    carHow: "CaR scores enable actuarially-sound premium pricing for carbon delivery & storage risks.",
    impact: "$1-5B new market. 30-50% better risk assessment. New product lines.",
    example: "Swiss Re prices delivery insurance: CaR 1yr = 20kg → 2.5% annual premium. CaR 1yr = 5kg → 0.8% premium. Performance drives pricing.",
    color: C.amber,
  },
  {
    id: "S4", name: "Financial Regulator", varAnalog: "Basel Committee",
    varHow: "Basel I/II/III used VaR to set bank capital requirements — standardized risk across institutions.",
    carHow: "CaR enables regulators to set risk-adjusted buffer requirements and compliance thresholds.",
    impact: "50-70% regulatory uncertainty reduction. Evidence-based compliance markets.",
    example: "EU regulator sets: compliance credits must demonstrate CaR 100yr < 100kg/t. Dynamic threshold replaces binary 'permanent' label.",
    color: C.purple,
  },
  {
    id: "S5", name: "Standards Body", varAnalog: "Credit Rating Agency",
    varHow: "Moody's/S&P rate bonds by default probability → standardized risk communication.",
    carHow: "CaR enables risk-graded credit ratings: AAA (CaR<10), AA (CaR<50), A (CaR<100), BBB (CaR<200).",
    impact: "30-50% verification efficiency gain. Adaptive standards evolving with data.",
    example: "Gold Standard adopts CaR-based tier system. Projects demonstrate improvement over time: from BBB to A rating as performance data accumulates.",
    color: C.slate,
  },
  {
    id: "S6", name: "Investor / Bank", varAnalog: "Investment Bank / PE Fund",
    varHow: "VaR enables risk-adjusted returns (Sharpe ratio) → rational capital allocation.",
    carHow: "CaR enables risk-adjusted carbon returns → rational allocation of climate capital.",
    impact: "8× capital mobilization ($150B → $1.2T). New investable asset class.",
    example: "Pension fund allocates $500M to carbon removal fund: 60% low-CaR / 40% higher-CaR projects. Risk-return profile comparable to infrastructure debt.",
    color: C.opt,
  },
  {
    id: "S7", name: "Credit Trader", varAnalog: "Market Maker",
    varHow: "VaR enables bid-ask pricing, inventory management, and hedging across positions.",
    carHow: "CaR enables risk-differentiated pricing, replacement ratios, and carbon derivatives.",
    impact: "2-5× market liquidity. 25-50% tighter spreads.",
    example: "Trader quotes: CaR-10 credit at $180/t, CaR-400 at $45/t. Replacement ratio: 1 CaR-10 = 0.25 CaR-400 credits (risk-adjusted equivalence).",
    color: C.accent,
  },
  {
    id: "S8", name: "Verifier / Auditor", varAnalog: "External Auditor (Big 4)",
    varHow: "Financial audits verify reported risk positions against standardized frameworks.",
    carHow: "CaR-based verification checks declared risk scores against observed performance data.",
    impact: "30-50% verification efficiency. Clear pass/fail criteria on risk metrics.",
    example: "DNV verifies: project declared CaR 10yr = 80kg. Actual 3-year performance trending to 60kg. Updated CaR improves rating → lower buffer.",
    color: C.blue,
  },
  {
    id: "S9", name: "Policymaker", varAnalog: "Central Bank / Treasury",
    varHow: "Central banks use VaR-derived metrics for systemic risk monitoring and monetary policy.",
    carHow: "CaR provides policymakers with quantitative tools for NDC planning, procurement design, and incentive calibration.",
    impact: "Risk-adjusted NDCs. Tax incentives scaled to CaR scores. $100-200B annual savings.",
    example: "UK structures 45Q-equivalent: £80/t tax credit for CaR<50, £40/t for CaR<200, £20/t for CaR<500. Incentivizes durability without excluding approaches.",
    color: C.purple,
  },
  {
    id: "S10", name: "Researcher / MRV", varAnalog: "Quant Analyst",
    varHow: "Quants build and refine VaR models, discover correlations, improve risk forecasting.",
    carHow: "Researchers refine CaR models, validate assumptions, discover cross-project risk correlations.",
    impact: "40-60% improvement in risk modeling accuracy. New scientific insights.",
    example: "LSE team publishes: reforestation CaR in tropical regions 2× higher than temperate due to El Niño correlation. Updates global CaR curves.",
    color: C.amber,
  },
];

const StakeholderCard = ({ s, expanded, onToggle }) => (
  <div
    onClick={onToggle}
    style={{
      padding: 16, background: C.card, border: `1px solid ${expanded ? s.color : C.border}`,
      borderRadius: 3, cursor: "pointer", transition: "all 0.2s",
      borderLeft: expanded ? `4px solid ${s.color}` : `1px solid ${C.border}`,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <div>
        <span style={{ fontFamily: font.mono, fontSize: 10, color: s.color, fontWeight: 700, marginRight: 8 }}>{s.id}</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: C.dark }}>{s.name}</span>
      </div>
      <span style={{ fontSize: 10, color: C.light, fontStyle: "italic" }}>VaR ≈ {s.varAnalog}</span>
    </div>
    {expanded && (
      <div style={{ marginTop: 12, fontSize: 11, lineHeight: 1.6 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div style={{ padding: 10, background: C.grid, borderRadius: 2 }}>
            <div style={{ fontSize: 9, color: C.light, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>VaR World</div>
            <div style={{ color: C.mid }}>{s.varHow}</div>
          </div>
          <div style={{ padding: 10, background: `${s.color}08`, borderRadius: 2 }}>
            <div style={{ fontSize: 9, color: s.color, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>CaR World</div>
            <div style={{ color: C.dark }}>{s.carHow}</div>
          </div>
        </div>
        <div style={{ padding: 10, background: C.optFade, borderRadius: 2, marginBottom: 8 }}>
          <div style={{ fontSize: 9, color: C.opt, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Quantified Impact</div>
          <div style={{ fontWeight: 600, color: C.dark }}>{s.impact}</div>
        </div>
        <div style={{ padding: 10, background: C.grid, borderRadius: 2 }}>
          <div style={{ fontSize: 9, color: C.light, textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>Worked Example</div>
          <div style={{ color: C.mid }}>{s.example}</div>
        </div>
      </div>
    )}
  </div>
);

// === MAIN APP ===
export default function CaRNetZero() {
  const [expandedStakeholder, setExpandedStakeholder] = useState("S1");

  return (
    <div style={{ fontFamily: font.body, background: C.bg, minHeight: "100vh", color: C.dark }}>
      <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=DM+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;600;700&display=swap" rel="stylesheet" />

      {/* Hero */}
      <div style={{ background: C.dark, padding: "36px 28px 28px" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontFamily: font.mono, fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 6 }}>NET-ZERO SIMULATION</div>
          <h1 style={{ fontFamily: font.display, fontSize: 30, fontWeight: 700, color: "#fff", margin: 0, lineHeight: 1.15 }}>
            CaR Makes Net-Zero<br />Faster, Cheaper, Safer
          </h1>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", margin: "10px 0 0", maxWidth: 520, lineHeight: 1.5 }}>
            10 simulated graphics comparing risk-optimized vs non-optimized pathways to 2050 removal targets, plus 10 stakeholder use-cases with Value at Risk analogs.
          </p>
        </div>
      </div>

      {/* BLUF */}
      <div style={{ background: C.accentFade, padding: "14px 28px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <div style={{ fontFamily: font.mono, fontSize: 9, color: C.accent, letterSpacing: 1.5, marginBottom: 3 }}>BOTTOM LINE</div>
          <div style={{ fontSize: 12.5, color: C.dark, lineHeight: 1.55 }}>
            <strong>Faster:</strong> CaR unlocks diverse capital 5-8 years earlier by quantifying risk for institutional investors.{" "}
            <strong>Cheaper:</strong> Dynamic buffers + Wright's Law acceleration save ~$425B/yr at scale.{" "}
            <strong>Safer:</strong> Portfolio diversification + continuous monitoring narrow delivery uncertainty from ±35% to ±12%.{" "}
            Result: <strong>78% probability</strong> of hitting 7.5 Gt/yr by 2050 vs <strong>28%</strong> without CaR.
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 28px 60px" }}>

        {/* Section A: 10 MECE Graphics */}
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontFamily: font.mono, fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 4 }}>PART A</div>
          <h2 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: C.dark }}>
            10 Graphics: Optimized vs Non-Optimized Path to 2050
          </h2>
          <p style={{ fontSize: 12, color: C.light, margin: "0 0 24px" }}>
            Each graphic isolates one MECE dimension of how CaR improves the net-zero trajectory.
          </p>
        </div>

        <G1_Trajectory />
        <G2_Cost />
        <G3_Probability />
        <G4_Buffers />
        <G5_Diversity />
        <G6_Confidence />
        <G7_Capital />
        <G8_Insurance />
        <G9_Warming />
        <G10_Monitoring />

        {/* Section B: 10 MECE Stakeholders */}
        <div style={{ marginBottom: 24, marginTop: 48 }}>
          <div style={{ fontFamily: font.mono, fontSize: 10, color: C.accent, letterSpacing: 2, marginBottom: 4 }}>PART B</div>
          <h2 style={{ fontFamily: font.display, fontSize: 22, fontWeight: 700, margin: "0 0 4px", color: C.dark }}>
            10 Stakeholders: How Each Uses CaR (with VaR Analogs)
          </h2>
          <p style={{ fontSize: 12, color: C.light, margin: "0 0 8px" }}>
            Each stakeholder maps directly to a financial market role that was transformed by VaR. Click to expand.
          </p>

          {/* Summary table */}
          <Card style={{ padding: 14, marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: C.light, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>VaR → CaR Analog Map</div>
            <div style={{ display: "grid", gridTemplateColumns: "auto 1fr auto 1fr", gap: "4px 16px", fontSize: 11 }}>
              {stakeholders.map(s => [
                <span key={s.id+"a"} style={{ fontFamily: font.mono, fontSize: 10, color: s.color, fontWeight: 700 }}>{s.id}</span>,
                <span key={s.id+"b"} style={{ color: C.dark, fontWeight: 600 }}>{s.name}</span>,
                <span key={s.id+"c"} style={{ color: C.light }}>≈</span>,
                <span key={s.id+"d"} style={{ color: C.mid, fontStyle: "italic" }}>{s.varAnalog}</span>,
              ])}
            </div>
          </Card>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {stakeholders.map(s => (
            <StakeholderCard
              key={s.id}
              s={s}
              expanded={expandedStakeholder === s.id}
              onToggle={() => setExpandedStakeholder(expandedStakeholder === s.id ? null : s.id)}
            />
          ))}
        </div>

        {/* Synthesis */}
        <Card style={{ marginTop: 36, background: C.dark, color: "#fff" }}>
          <div style={{ fontFamily: font.mono, fontSize: 9, color: C.accent, letterSpacing: 2, marginBottom: 8 }}>SYNTHESIS</div>
          <h3 style={{ fontFamily: font.display, fontSize: 18, fontWeight: 700, margin: "0 0 12px" }}>The Compounding Effect</h3>
          <div style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
            Just as VaR didn't merely measure financial risk but <em>created</em> the infrastructure for modern capital markets,
            CaR doesn't merely measure carbon risk — it creates the infrastructure for a trillion-dollar removal market.
            Each stakeholder's adoption compounds: developers produce data that improves insurer pricing, which lowers buyer costs,
            which attracts investor capital, which funds more projects, which generates more data.
          </div>
          <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
            {[
              { label: "FASTER", val: "5-8yr earlier institutional capital", color: C.opt },
              { label: "CHEAPER", val: "$425B/yr savings at scale", color: C.amber },
              { label: "SAFER", val: "78% vs 28% goal probability", color: C.blue },
            ].map((d, i) => (
              <div key={i} style={{ flex: 1, padding: 12, background: "rgba(255,255,255,0.06)", borderRadius: 2, borderTop: `3px solid ${d.color}` }}>
                <div style={{ fontSize: 10, color: d.color, fontWeight: 700, letterSpacing: 1 }}>{d.label}</div>
                <div style={{ fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{d.val}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Footer */}
        <div style={{ marginTop: 36, paddingTop: 16, borderTop: `1px solid ${C.border}` }}>
          <div style={{ fontSize: 9, color: C.light, lineHeight: 1.7 }}>
            Sources: Gogerty & Johnson (2024) SSRN:4745542 · Smith et al. (2024) · Lee, Gogerty et al. Nature Perspective ·
            CaRGov Framework · CaR Policy Use Cases · CaRPS Proposal · Forced Errors & Gains (2024) ·
            Bauer & Rudebusch (2023) Review of Economics & Statistics · Groom & Venmans (2023) Nature ·
            IPCC AR6 cost estimates · Wright's Law learning curves
          </div>
        </div>
      </div>
    </div>
  );
}
