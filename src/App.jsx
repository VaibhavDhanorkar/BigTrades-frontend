import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
// In production: set VITE_API_URL=https://your-backend.railway.app in .env
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : "http://localhost:8000";
const WS_BASE = API_BASE.replace("https://", "wss://").replace("http://", "ws://");

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  bg: "#0A0B0F", bgCard: "#12141A", bgEl: "#1A1D26", bgIn: "#1E2130",
  acc: "#00D4FF", grn: "#00E396", red: "#FF4560", amb: "#FEB019", pur: "#775DD0",
  txt: "#F0F2FF", mut: "#8890AA", dim: "#4A5068",
  bdr: "rgba(255,255,255,0.07)", bdrH: "rgba(0,212,255,0.3)",
  gradA: "linear-gradient(135deg,#00D4FF,#775DD0)",
  gradG: "linear-gradient(135deg,#00E396,#00B074)",
};

// ─── API CLIENT ───────────────────────────────────────────────────────────────
const api = {
  async get(path) {
    try {
      const r = await fetch(`${API_BASE}${path}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn(`API GET ${path} failed:`, e.message);
      return null;
    }
  },
  async post(path, body) {
    try {
      const r = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      console.warn(`API POST ${path} failed:`, e.message);
      return null;
    }
  },
};

// ─── WEBSOCKET HOOK ───────────────────────────────────────────────────────────
function useWebSocket(onMessage) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);
  const [connected, setConnected] = useState(false);

  const connect = useCallback(() => {
    try {
      ws.current = new WebSocket(`${WS_BASE}/ws`);
      ws.current.onopen = () => {
        setConnected(true);
        // Keepalive ping every 25s
        const ping = setInterval(() => ws.current?.readyState === 1 && ws.current.send("ping"), 25000);
        ws.current._ping = ping;
      };
      ws.current.onmessage = (e) => {
        try { onMessage(JSON.parse(e.data)); } catch {}
      };
      ws.current.onclose = () => {
        setConnected(false);
        clearInterval(ws.current?._ping);
        reconnectTimer.current = setTimeout(connect, 3000);
      };
      ws.current.onerror = () => ws.current?.close();
    } catch (e) {
      reconnectTimer.current = setTimeout(connect, 5000);
    }
  }, [onMessage]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  return connected;
}

// ─── FALLBACK / DEMO DATA ─────────────────────────────────────────────────────
const DEMO_SIGNALS = [
  { id: 1, ticker: "PLTR", name: "Palantir Technologies", tier: "MID", sector: "Tech",
    score: 91, level: "CONVICTION", price: 24.38, change: 4.2, marketCap: "48.2B", avgVol: "62M", relVol: 2.8,
    catalyst_summary: "DoD AI contract expanded to $480M — USASpending.gov confirmed",
    insider_summary: "CEO Alex Karp bought $2.1M open market (Form 4, 3 days ago)",
    reasons: ["Pentagon AI mandate drives $480M recurring revenue","CEO personal buy signals extreme conviction","Technical breakout on 2.8x average volume"],
    risks: ["DoD budget cuts under NDAA pressure","35x revenue multiple compresses on rate hike"],
    upside: "Bull case: $35–$40 (+43–64%) if AIP platform achieves commercial breakout alongside gov contracts.",
    monitor: ["$25.20 resistance — clean break = next leg","PLTR earnings date TBD","New DoD/HHS contract announcements"],
    entry: { low: 23.80, high: 24.60 }, targets: { tp1: 27.50, tp1pct: 12.8, tp2: 31.00, tp2pct: 27.1, stop: 22.40, stopPct: 8.1, rr: 2.8 },
    breakdown: { catalyst: 22, insider: 18, technical: 18, macro: 12, news: 8, liquidity: 10 },
    sparkline: [21,21.5,22,21.8,22.5,23,22.8,23.5,24,24.2,23.9,24.38] },
  { id: 2, ticker: "RKLB", name: "Rocket Lab USA", tier: "SMALL", sector: "Aerospace",
    score: 83, level: "STRONG BUY", price: 7.92, change: 6.8, marketCap: "3.9B", avgVol: "28M",
    catalyst_summary: "NASA VCLS Task Order awarded — $143M dedicated launch contract",
    insider_summary: "CFO purchased 150,000 shares at market open (Form 4, 2 days ago)",
    reasons: ["NASA contract = 37% of annual revenue — massive materiality","CFO $1.2M buy signals balance sheet confidence","Neutron rocket on track for 2025 debut"],
    risks: ["Launch failure = 20–40% drawdown","SpaceX competitive pricing pressure"],
    upside: "Neutron success + recurring NASA missions could re-rate to $15–$18 (+90–127%)",
    monitor: ["Electron launch in 3 weeks","Neutron milestones Q4","NSSL competition results"],
    entry: { low: 7.60, high: 8.10 }, targets: { tp1: 9.40, tp1pct: 18.7, tp2: 11.20, tp2pct: 41.4, stop: 7.00, stopPct: 11.6, rr: 2.9 },
    breakdown: { catalyst: 20, insider: 16, technical: 14, macro: 12, news: 10, liquidity: 8 },
    sparkline: [6.2,6.4,6.8,7.1,6.9,7.3,7.0,7.5,7.6,7.8,7.7,7.92] },
  { id: 3, ticker: "SMCI", name: "Super Micro Computer", tier: "MID", sector: "Hardware",
    score: 77, level: "BUY", price: 312.40, change: -1.4, marketCap: "18.3B", avgVol: "4.2M",
    catalyst_summary: "NVIDIA partnership for H200 direct-liquid cooled AI server racks announced",
    insider_summary: "Director bought 8,000 shares — first purchase in 14 months",
    reasons: ["Only NVIDIA-preferred liquid cooling at scale","AI capex supercycle $200B+ spend","14-month insider gap = meaningful signal"],
    risks: ["Accounting restatement risk","Supply chain constraints on H200 GPUs"],
    upside: "$450–$500 achievable in 12 months if AI server demand holds.",
    monitor: ["NVIDIA GTC partnership updates","Short interest: 15.2% of float","Q2 earnings delivery numbers"],
    entry: { low: 298, high: 318 }, targets: { tp1: 360, tp1pct: 15.2, tp2: 420, tp2pct: 34.5, stop: 275, stopPct: 11.9, rr: 2.3 },
    breakdown: { catalyst: 18, insider: 12, technical: 14, macro: 12, news: 8, liquidity: 10 },
    sparkline: [295,310,325,318,305,298,308,315,320,310,318,312] },
];

const DEMO_CONGRESS = [
  { member: "Sen. Mark Kelly", party: "D", state: "AZ", ticker: "PLTR", action: "Buy", amount: "$50K–$100K", date: "May 9", committee: "Armed Services", relevance: "Direct" },
  { member: "Rep. Mike Turner", party: "R", state: "OH", ticker: "RKLB", action: "Buy", amount: "$15K–$50K", date: "May 3", committee: "Intelligence", relevance: "Direct" },
  { member: "Sen. Cynthia Lummis", party: "R", state: "WY", ticker: "IBIT", action: "Buy", amount: "$100K–$250K", date: "May 1", committee: "Banking", relevance: "Direct" },
  { member: "Rep. Nancy Pelosi", party: "D", state: "CA", ticker: "NVDA", action: "Buy (call)", amount: "$1M–$5M", date: "Apr 28", committee: "Leadership", relevance: "Adjacent" },
];

const DEMO_NEWS = [
  { ticker: "PLTR", headline: "Pentagon awards Palantir $480M AI contract expansion for battlefield logistics", source: "Defense One", time: "2h ago", sentiment: "bull" },
  { ticker: "RKLB", headline: "Rocket Lab secures NASA VCLS Task Order worth $143M for dedicated launches", source: "Space News", time: "4h ago", sentiment: "bull" },
  { ticker: "NVDA", headline: "NVIDIA Blackwell shipments ahead of schedule — supply chain checks positive", source: "Barrons", time: "5h ago", sentiment: "bull" },
  { ticker: "XLE", headline: "OPEC+ surprises market with 500K bpd production cut — Brent crude surges 4%", source: "Reuters", time: "7h ago", sentiment: "bull" },
  { ticker: "TSLA", headline: "Tesla Cybertruck recall expands to 99% of deliveries", source: "Reuters", time: "9h ago", sentiment: "bear" },
];

// ─── SCORE UTILITIES ──────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? T.grn : s >= 65 ? T.acc : s >= 50 ? T.amb : T.red;
const levelBadge = (l) => ({
  CONVICTION: { bg: "#00E39615", text: T.grn, border: "#00E39640" },
  "STRONG BUY": { bg: "#00D4FF15", text: T.acc, border: "#00D4FF40" },
  BUY:    { bg: "#775DD015", text: T.pur, border: "#775DD040" },
  WATCH:  { bg: "#FEB01915", text: T.amb, border: "#FEB01940" },
  PASS:   { bg: "#FF456015", text: T.red, border: "#FF456040" },
}[l] || { bg: "#FEB01915", text: T.amb, border: "#FEB01940" });
const tierColor = (t) => ({ NANO: "#FF6B6B", SMALL: T.amb, MID: T.acc, LARGE: T.grn, ETF: T.pur }[t] || T.mut);

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Sparkline = ({ data = [], color, h = 36, w = 80 }) => {
  if (!data.length) return null;
  const min = Math.min(...data), max = Math.max(...data), rng = max - min || 1;
  const pts = data.map((v, i) => `${(i/(data.length-1))*w},${h-((v-min)/rng)*(h-4)-2}`).join(" ");
  const fill = `${pts} ${w},${h} 0,${h}`;
  const id = `sg${color.replace(/[^a-z0-9]/gi,"")}${w}`;
  return (
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <polygon points={fill} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const ScoreRing = ({ score, size = 52 }) => {
  const r = (size-6)/2, circ = 2*Math.PI*r, dash = (score/100)*circ, color = scoreColor(score);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.bdr} strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{fill:color,fontSize:size>48?13:10,fontWeight:700,transform:`rotate(90deg)`,transformOrigin:`${size/2}px ${size/2}px`,fontFamily:"system-ui"}}>
        {score}
      </text>
    </svg>
  );
};

const Tag = ({ text, color }) => (
  <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${color}18`,color,border:`1px solid ${color}30`,fontWeight:700,whiteSpace:"nowrap"}}>{text}</span>
);

const Pill = ({ label, active, onClick, color }) => (
  <button onClick={onClick} style={{
    background: active ? (color || T.acc) : T.bgEl,
    border: `1px solid ${active ? (color || T.acc) : T.bdr}`,
    color: active ? (active && color ? T.txt : T.bg) : T.mut,
    borderRadius:20, padding:"6px 14px", fontSize:11, fontWeight:700,
    cursor:"pointer", whiteSpace:"nowrap", flexShrink:0,
    transition:"all 0.15s"
  }}>{label}</button>
);

const Divider = () => <div style={{height:1,background:T.bdr,margin:"12px 0"}}/>;

const LoadingPulse = ({ lines = 3 }) => (
  <div style={{padding:"0 0 16px"}}>
    {Array.from({length:lines}).map((_,i) => (
      <div key={i} style={{height:14,background:T.bgEl,borderRadius:7,marginBottom:10,width:`${70+Math.random()*25}%`,opacity:0.6}}/>
    ))}
  </div>
);

const StatusDot = ({ connected }) => (
  <div style={{display:"flex",alignItems:"center",gap:5}}>
    <div style={{width:6,height:6,borderRadius:"50%",background: connected ? T.grn : T.amb,boxShadow:`0 0 6px ${connected?T.grn:T.amb}`}}/>
    <span style={{fontSize:10,color:T.mut}}>{connected ? "Live" : "Demo"}</span>
  </div>
);

// ─── SCORE BAR ────────────────────────────────────────────────────────────────
const ScoreBar = ({ label, score, max, color }) => (
  <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:11,color:T.mut}}>{label}</span>
      <span style={{fontSize:11,color,fontWeight:700}}>{score}/{max}</span>
    </div>
    <div style={{background:T.bdr,borderRadius:3,height:3}}>
      <div style={{width:`${(score/max)*100}%`,height:"100%",background:color,borderRadius:3,transition:"width 0.8s ease"}}/>
    </div>
  </div>
);

// ─── AI CHAT PANEL ────────────────────────────────────────────────────────────
const AIChatPanel = ({ context, onClose }) => {
  const [msgs, setMsgs] = useState([
    { role: "ai", text: "Ask me anything about this signal — entry timing, risk sizing, catalyst analysis, or market conditions." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:"smooth"}); }, [msgs]);

  const send = async () => {
    if (!input.trim() || loading) return;
    const q = input.trim();
    setInput("");
    setMsgs(m => [...m, {role:"user", text:q}]);
    setLoading(true);
    const res = await api.post("/api/chat", { message: q, context });
    setLoading(false);
    setMsgs(m => [...m, {role:"ai", text: res?.response || "AI unavailable — check API key in Settings."}]);
  };

  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:430,margin:"0 auto",zIndex:200,
      background:T.bgCard,borderTop:`1px solid ${T.bdr}`,borderRadius:"16px 16px 0 0",
      display:"flex",flexDirection:"column",height:"60vh"}}>
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.bdr}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:T.gradA,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>AI</div>
          <span style={{fontSize:13,fontWeight:700,color:T.txt}}>Signal AI</span>
          {context?.ticker && <Tag text={context.ticker} color={T.acc}/>}
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.mut,fontSize:18,cursor:"pointer",lineHeight:1}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m,i) => (
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{
              maxWidth:"82%",background:m.role==="user"?T.acc:T.bgEl,
              borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
              padding:"10px 14px",fontSize:13,color:m.role==="user"?T.bg:T.txt,lineHeight:1.5
            }}>{m.text}</div>
          </div>
        ))}
        {loading && <div style={{display:"flex",gap:4,alignItems:"center",padding:"8px 0"}}>
          {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.acc,opacity:0.6,animation:`pulse 1s ${i*0.2}s infinite`}}/>)}
        </div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${T.bdr}`,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&send()}
          placeholder="Ask about this signal..."
          style={{flex:1,background:T.bgIn,border:`1px solid ${T.bdr}`,borderRadius:24,padding:"10px 16px",
            color:T.txt,fontSize:13,outline:"none",fontFamily:"inherit"}}/>
        <button onClick={send} style={{background:T.acc,border:"none",borderRadius:"50%",width:40,height:40,
          display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:T.bg,flexShrink:0}}>↑</button>
      </div>
    </div>
  );
};

// ─── SIGNAL DETAIL ────────────────────────────────────────────────────────────
const SignalDetail = ({ signal, onClose }) => {
  const [tab, setTab] = useState("overview");
  const [showChat, setShowChat] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [liveSignal, setLiveSignal] = useState(signal);
  const badge = levelBadge(liveSignal.level);
  const sc = scoreColor(liveSignal.score);
  const pos = liveSignal.change >= 0;

  const refresh = async () => {
    setRefreshing(true);
    const fresh = await api.get(`/api/signals/${liveSignal.ticker}?refresh=true`);
    if (fresh && !fresh.error) setLiveSignal(fresh);
    setRefreshing(false);
  };

  const Section = ({icon, title, color, children}) => (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
        <span style={{fontSize:13}}>{icon}</span>
        <span style={{fontSize:11,fontWeight:700,color:color||T.mut,textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</span>
      </div>
      {children}
    </div>
  );

  const TargetRow = ({label, price, pct, color}) => (
    <div style={{background:T.bgEl,borderRadius:10,padding:"11px 14px",marginBottom:8,
      display:"flex",alignItems:"center",justifyContent:"space-between",borderLeft:`3px solid ${color}`}}>
      <span style={{fontSize:12,fontWeight:700,color}}>{label}</span>
      <span style={{fontSize:15,fontWeight:700,color:T.txt}}>${price}</span>
      <span style={{fontSize:12,fontWeight:700,color,background:`${color}15`,padding:"2px 8px",borderRadius:6}}>
        {pct>=0?"+":""}{pct}%
      </span>
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:T.bg,overflowY:showChat?"hidden":"auto",zIndex:100,maxWidth:430,margin:"0 auto"}}>
      {/* Header */}
      <div style={{background:T.bgCard,borderBottom:`1px solid ${T.bdr}`,padding:"16px 20px",
        position:"sticky",top:0,zIndex:10,display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onClose} style={{background:T.bgEl,border:`1px solid ${T.bdr}`,borderRadius:"50%",
          width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",color:T.txt,fontSize:16}}>←</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20,fontWeight:800,color:T.txt}}>{liveSignal.ticker}</span>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:badge.bg,color:badge.text,border:`1px solid ${badge.border}`,fontWeight:700}}>{liveSignal.level}</span>
          </div>
          <div style={{fontSize:11,color:T.mut}}>{liveSignal.name}</div>
        </div>
        <button onClick={refresh} disabled={refreshing} style={{background:"none",border:`1px solid ${T.bdr}`,borderRadius:8,padding:"6px 10px",color:T.mut,fontSize:11,cursor:"pointer"}}>
          {refreshing?"↻ ...":"↻ Live"}
        </button>
        <ScoreRing score={liveSignal.score} size={52}/>
      </div>

      {/* Price */}
      <div style={{background:T.bgEl,padding:"12px 20px",display:"flex",alignItems:"center",gap:14}}>
        <div>
          <span style={{fontSize:28,fontWeight:800,color:T.txt}}>${liveSignal.price?.toFixed?.(2) ?? liveSignal.price}</span>
          <span style={{fontSize:13,color:pos?T.grn:T.red,fontWeight:700,background:pos?"#00E39618":"#FF456018",
            padding:"3px 8px",borderRadius:6,marginLeft:8}}>{pos?"+":""}{liveSignal.change}%</span>
        </div>
        <div style={{marginLeft:"auto"}}>
          <Sparkline data={liveSignal.sparkline||[]} color={pos?T.grn:T.red} h={40} w={100}/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:T.bgCard,borderBottom:`1px solid ${T.bdr}`}}>
        {[["overview","Overview"],["trade","Trade"],["intel","Intel"],["scores","Scores"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"12px 4px",fontSize:11,fontWeight:700,
            cursor:"pointer",background:"none",border:"none",
            borderBottom:tab===k?`2px solid ${T.acc}`:"2px solid transparent",
            color:tab===k?T.acc:T.mut}}>
            {l}
          </button>
        ))}
      </div>

      <div style={{padding:"20px",paddingBottom:100}}>
        {tab==="overview" && (
          <>
            <Section icon="⚡" title="Primary Catalyst" color={T.grn}>
              <div style={{background:`${T.grn}10`,border:`1px solid ${T.grn}30`,borderRadius:12,padding:14}}>
                <div style={{fontSize:13,color:T.txt,lineHeight:1.6,marginBottom:8}}>{liveSignal.catalyst_summary || liveSignal.catalyst?.text || "Loading..."}</div>
              </div>
            </Section>
            <Section icon="✅" title="Why This Conviction?" color={T.grn}>
              {(liveSignal.reasons||[]).map((r,i)=>(
                <div key={i} style={{display:"flex",gap:10,marginBottom:10}}>
                  <div style={{width:18,height:18,borderRadius:"50%",background:`${T.grn}20`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:T.grn,flexShrink:0,marginTop:2}}>{i+1}</div>
                  <span style={{fontSize:13,color:T.txt,lineHeight:1.5}}>{r}</span>
                </div>
              ))}
            </Section>
            <Section icon="⚠️" title="Risks" color={T.amb}>
              {(liveSignal.risks||[]).map((r,i)=>(
                <div key={i} style={{display:"flex",gap:8,marginBottom:10}}>
                  <span style={{color:T.amb,flexShrink:0}}>▲</span>
                  <span style={{fontSize:13,color:T.mut,lineHeight:1.5}}>{r}</span>
                </div>
              ))}
            </Section>
            {liveSignal.upside && (
              <Section icon="💰" title="Upside Scenario" color={T.acc}>
                <div style={{background:`${T.acc}10`,borderLeft:`3px solid ${T.acc}`,padding:"12px 14px",borderRadius:"0 8px 8px 0"}}>
                  <span style={{fontSize:13,color:T.txt,lineHeight:1.6}}>{liveSignal.upside}</span>
                </div>
              </Section>
            )}
            {(liveSignal.monitor||[]).length>0 && (
              <Section icon="👁" title="Monitor" color={T.pur}>
                {liveSignal.monitor.map((m,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:8}}>
                    <span style={{color:T.pur}}>•</span>
                    <span style={{fontSize:13,color:T.txt,lineHeight:1.5}}>{m}</span>
                  </div>
                ))}
              </Section>
            )}
          </>
        )}

        {tab==="trade" && (
          <>
            <Section icon="🎯" title="Entry Zone" color={T.acc}>
              <div style={{background:T.bgEl,borderRadius:12,padding:16,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:T.mut}}>Low</div>
                  <div style={{fontSize:22,fontWeight:800,color:T.txt}}>${liveSignal.entry?.low}</div>
                </div>
                <span style={{color:T.dim,fontSize:20}}>→</span>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:T.mut}}>High</div>
                  <div style={{fontSize:22,fontWeight:800,color:T.txt}}>${liveSignal.entry?.high}</div>
                </div>
              </div>
            </Section>
            <Section icon="📈" title="Targets" color={T.grn}>
              <TargetRow label="TP1" price={liveSignal.targets?.tp1} pct={liveSignal.targets?.tp1pct} color={T.grn}/>
              <TargetRow label="TP2" price={liveSignal.targets?.tp2} pct={liveSignal.targets?.tp2pct} color={T.acc}/>
              <TargetRow label="Stop" price={liveSignal.targets?.stop} pct={-liveSignal.targets?.stopPct} color={T.red}/>
            </Section>
            <Section icon="⚖️" title="Risk / Reward" color={T.amb}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["R:R Ratio",`${liveSignal.targets?.rr}:1`,liveSignal.targets?.rr>=2?T.grn:T.red],
                  ["Stop %",`-${liveSignal.targets?.stopPct}%`,T.red],
                  ["Tier",liveSignal.tier,tierColor(liveSignal.tier)],
                  ["Score",`${liveSignal.score}/100`,sc]].map(([l,v,c])=>(
                  <div key={l} style={{background:T.bgEl,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:T.dim,marginBottom:4}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:700,color:c||T.txt}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,padding:12,background:`${T.amb}10`,border:`1px solid ${T.amb}30`,borderRadius:10,fontSize:12,color:T.mut,lineHeight:1.6}}>
                <strong style={{color:T.amb}}>Position sizing:</strong> {liveSignal.score>=85?"High conviction: up to 5% of portfolio":"Standard: 2–3% of portfolio"}. Sell 50% at TP1, move stop to breakeven.
              </div>
            </Section>
          </>
        )}

        {tab==="intel" && (
          <>
            <Section icon="🏢" title="Insider Activity" color={T.acc}>
              <div style={{background:T.bgEl,borderRadius:12,padding:14,borderLeft:`3px solid ${T.grn}`}}>
                <div style={{fontSize:13,color:T.txt,lineHeight:1.5,marginBottom:8}}>{liveSignal.insider_summary||"Loading..."}</div>
                {(liveSignal.insider_trades||[]).slice(0,3).map((t,i)=>(
                  <div key={i} style={{fontSize:11,color:T.mut,marginTop:4}}>• {t.entity} — {t.file_date}</div>
                ))}
              </div>
            </Section>
            <Section icon="🏛" title="Congressional Activity" color={T.pur}>
              {(liveSignal.congress_trades||[]).length>0 ? (liveSignal.congress_trades.slice(0,3).map((t,i)=>(
                <div key={i} style={{background:T.bgEl,borderRadius:10,padding:12,marginBottom:8,borderLeft:`3px solid ${T.pur}`}}>
                  <div style={{fontSize:12,fontWeight:700,color:T.txt}}>{t.Representative||t.member} — {t.Ticker||t.ticker}</div>
                  <div style={{fontSize:11,color:T.mut,marginTop:3}}>{t.Transaction||t.action} · {t.Range||t.amount} · {t.Date||t.date}</div>
                </div>
              ))) : <div style={{fontSize:13,color:T.dim,fontStyle:"italic"}}>No recent congressional activity</div>}
            </Section>
          </>
        )}

        {tab==="scores" && (
          <>
            <div style={{background:T.bgEl,borderRadius:16,padding:20,marginBottom:16,display:"flex",alignItems:"center",gap:16}}>
              <ScoreRing score={liveSignal.score} size={72}/>
              <div>
                <div style={{fontSize:12,color:T.mut}}>Conviction Score</div>
                <div style={{fontSize:28,fontWeight:800,color:sc}}>{liveSignal.score}/100</div>
                <div style={{fontSize:11,color:T.mut}}>{liveSignal.level}</div>
              </div>
            </div>
            <div style={{background:T.bgCard,borderRadius:16,padding:20}}>
              {Object.entries(liveSignal.breakdown||{}).map(([k,v])=>{
                const maxes = {catalyst:25,insider:20,technical:20,macro:15,news:10,liquidity:10};
                const colors = {catalyst:T.grn,insider:T.acc,technical:T.pur,macro:T.amb,news:T.mut,liquidity:T.acc};
                const labels = {catalyst:"Catalyst Strength",insider:"Insider Activity",technical:"Technical Setup",macro:"Macro Alignment",news:"News Momentum",liquidity:"Liquidity Score"};
                return <ScoreBar key={k} label={labels[k]||k} score={v} max={maxes[k]||10} color={colors[k]||T.acc}/>;
              })}
            </div>
          </>
        )}
      </div>

      {/* AI Chat Button */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:430,margin:"0 auto",padding:"12px 20px",
        background:T.bgCard,borderTop:`1px solid ${T.bdr}`,zIndex:50}}>
        <button onClick={()=>setShowChat(true)} style={{width:"100%",background:T.gradA,border:"none",borderRadius:14,
          padding:14,fontSize:14,fontWeight:800,color:T.bg,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span>✦</span> Ask Signal AI
        </button>
      </div>

      {showChat && <AIChatPanel context={liveSignal} onClose={()=>setShowChat(false)}/>}
    </div>
  );
};

// ─── SIGNAL CARD (LIST) ───────────────────────────────────────────────────────
const SignalCard = ({ signal, onClick }) => {
  const badge = levelBadge(signal.level);
  const pos = signal.change >= 0;
  return (
    <div onClick={onClick} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:16,
      padding:16,marginBottom:12,cursor:"pointer",transition:"border-color 0.2s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=T.bdrH}
      onMouseLeave={e=>e.currentTarget.style.borderColor=T.bdr}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:18,fontWeight:800,color:T.txt}}>{signal.ticker}</span>
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:badge.bg,color:badge.text,border:`1px solid ${badge.border}`,fontWeight:700}}>{signal.level}</span>
            <span style={{fontSize:10,color:tierColor(signal.tier),background:`${tierColor(signal.tier)}15`,padding:"2px 7px",borderRadius:4,fontWeight:600}}>{signal.tier}</span>
          </div>
          <div style={{fontSize:12,color:T.mut,marginBottom:6}}>{signal.name}</div>
          <div style={{fontSize:11,color:T.mut,lineHeight:1.4,overflow:"hidden",display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
            {signal.catalyst_summary||signal.catalyst?.text||""}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
          <ScoreRing score={signal.score} size={48}/>
          <Sparkline data={signal.sparkline||[]} color={pos?T.grn:T.red} h={28} w={64}/>
          <span style={{fontSize:12,color:pos?T.grn:T.red,fontWeight:700}}>{pos?"+":""}{signal.change}%</span>
        </div>
      </div>
      <Divider/>
      <div style={{display:"flex",gap:0}}>
        {[["Entry",`$${signal.entry?.low}–$${signal.entry?.high}`,T.txt],
          ["TP1",`$${signal.targets?.tp1} (+${signal.targets?.tp1pct}%)`,T.grn],
          ["Stop",`$${signal.targets?.stop} (-${signal.targets?.stopPct}%)`,T.red]].map(([l,v,c],i)=>(
          <div key={l} style={{flex:1,textAlign:"center",borderLeft:i>0?`1px solid ${T.bdr}`:"none"}}>
            <div style={{fontSize:9,color:T.dim}}>{l}</div>
            <div style={{fontSize:10,color:c,fontWeight:600}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── SCREENS ─────────────────────────────────────────────────────────────────

const HomeScreen = ({ signals, loading, connected, onSelect, market }) => {
  const [filter, setFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const tiers = ["ALL","SMALL","MID","LARGE","ETF","NANO"];

  const filtered = useMemo(() => signals
    .filter(s => filter === "ALL" || s.tier === filter)
    .filter(s => !search || s.ticker.includes(search.toUpperCase()) || s.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => b.score - a.score), [signals, filter, search]);

  const top3 = useMemo(() => [...signals].sort((a,b)=>b.score-a.score).slice(0,4), [signals]);

  return (
    <div style={{paddingBottom:80}}>
      {/* Header */}
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>StockSignalPro</div>
          <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Market Intel</div>
          <div style={{fontSize:12,color:T.mut,marginTop:2}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
        </div>
        <StatusDot connected={connected}/>
      </div>

      {/* Market Strip */}
      <div style={{margin:"14px 20px 0",display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {[["SPY","512.40","+0.34%",true],["QQQ","438.20","+0.61%",true],
          ["VIX",market?.vix?.toFixed?.(1)||"16.8","-4.2%",false],["BTC","$67.4K","+2.1%",true]].map(([l,p,c,pos])=>(
          <div key={l} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:10,color:T.dim}}>{l}</div>
            <div style={{fontSize:13,fontWeight:700,color:T.txt}}>{p}</div>
            <div style={{fontSize:11,color:pos?T.grn:T.red}}>{c}</div>
          </div>
        ))}
      </div>

      {/* Top Picks Carousel */}
      {top3.length > 0 && (
        <div style={{margin:"18px 20px 0"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.mut,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>
            🔥 Top Conviction
          </div>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
            {top3.map(s=>(
              <div key={s.ticker} onClick={()=>onSelect(s)} style={{
                background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:14,
                padding:14,minWidth:148,cursor:"pointer",flexShrink:0,transition:"border-color 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.bdrH}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.bdr}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:15,fontWeight:800,color:T.txt}}>{s.ticker}</span>
                  <ScoreRing score={s.score} size={34}/>
                </div>
                <div style={{fontSize:10,color:T.mut,marginBottom:6}}>{s.sector||s.tier}</div>
                <Sparkline data={s.sparkline||[]} color={s.change>=0?T.grn:T.red} h={28} w={118}/>
                <div style={{fontSize:12,color:s.change>=0?T.grn:T.red,fontWeight:700,marginTop:4}}>
                  {s.change>=0?"+":""}{s.change}%
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div style={{margin:"16px 20px 0"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="Search ticker or name..."
          style={{width:"100%",background:T.bgIn,border:`1px solid ${T.bdr}`,borderRadius:12,
            padding:"10px 16px",color:T.txt,fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
      </div>

      {/* Tier Filter */}
      <div style={{margin:"12px 20px 0",display:"flex",gap:8,overflowX:"auto",paddingBottom:6}}>
        {tiers.map(t=><Pill key={t} label={t} active={filter===t} onClick={()=>setFilter(t)} color={t!=="ALL"?tierColor(t):T.acc}/>)}
      </div>

      {/* List */}
      <div style={{padding:"12px 20px 0"}}>
        {loading && signals.length===0 ? (
          <><LoadingPulse/><LoadingPulse/><LoadingPulse/></>
        ) : filtered.length === 0 ? (
          <div style={{textAlign:"center",padding:"40px 0",color:T.dim}}>
            <div style={{fontSize:32,marginBottom:8}}>📡</div>
            <div style={{fontSize:13}}>No signals match your filter</div>
          </div>
        ) : filtered.map(s=><SignalCard key={s.ticker||s.id} signal={s} onClick={()=>onSelect(s)}/>)}
      </div>
    </div>
  );
};

const CongressScreen = ({ data, loading }) => (
  <div style={{padding:"20px 20px 80px"}}>
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Intelligence</div>
      <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Congressional Trades</div>
      <div style={{fontSize:12,color:T.mut,marginTop:2}}>STOCK Act disclosures · Live feed</div>
    </div>
    <div style={{background:`${T.amb}12`,border:`1px solid ${T.amb}30`,borderRadius:12,padding:"10px 14px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
      <span>🏛</span>
      <span style={{fontSize:12,color:T.amb,lineHeight:1.4}}>Members disclose within 45 days. Committee-relevant buys = highest alpha signal.</span>
    </div>
    {loading ? <><LoadingPulse/><LoadingPulse/></> :
    (data||DEMO_CONGRESS).map((t,i)=>(
      <div key={i} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:16,padding:16,marginBottom:10}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
          <div>
            <div style={{fontSize:13,fontWeight:700,color:T.txt}}>{t.member||t.Representative}</div>
            <div style={{fontSize:11,color:T.mut}}>{t.party==="D"?"🔵":"🔴"} {t.state} · {t.date||t.Date}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:18,fontWeight:800,color:(t.action||t.Transaction||"").includes("Buy")?T.grn:T.red}}>{t.ticker||t.Ticker}</div>
            <div style={{fontSize:11,color:(t.action||t.Transaction||"").includes("Buy")?T.grn:T.red,fontWeight:600}}>{t.action||t.Transaction}</div>
          </div>
        </div>
        <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
          <Tag text={t.amount||t.Range} color={T.acc}/>
          {t.committee && <Tag text={`${t.committee} Cmte`} color={T.mut}/>}
          {t.relevance && <Tag text={t.relevance} color={t.relevance==="Direct"?T.grn:T.amb}/>}
        </div>
      </div>
    ))}
  </div>
);

const NewsScreen = ({ data, loading }) => (
  <div style={{padding:"20px 20px 80px"}}>
    <div style={{marginBottom:16}}>
      <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Catalyst Feed</div>
      <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Market News</div>
      <div style={{fontSize:12,color:T.mut,marginTop:2}}>8-K filings · SEC catalysts · Live</div>
    </div>
    {loading ? <><LoadingPulse lines={4}/></> :
    (data?.length ? data : DEMO_NEWS).map((n,i)=>(
      <div key={i} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:14,padding:16,marginBottom:10,
        borderLeft:`3px solid ${n.sentiment==="bull"?T.grn:n.sentiment==="bear"?T.red:T.mut}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
          <div style={{display:"flex",gap:7,alignItems:"center"}}>
            <span style={{fontSize:13,fontWeight:800,color:n.sentiment==="bull"?T.grn:T.red}}>{n.ticker||n.keyword}</span>
            <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,fontWeight:700,
              background:n.sentiment==="bull"?"#00E39615":"#FF456015",
              color:n.sentiment==="bull"?T.grn:T.red}}>{n.sentiment==="bull"?"BULLISH":"BEARISH"}</span>
          </div>
          <span style={{fontSize:10,color:T.dim}}>{n.time||n.published?.slice(0,10)}</span>
        </div>
        <div style={{fontSize:13,color:T.txt,lineHeight:1.5,marginBottom:5}}>{n.headline||n.title}</div>
        <div style={{fontSize:11,color:T.dim}}>{n.source}</div>
      </div>
    ))}
  </div>
);

const WatchlistScreen = ({ signals, onSelect }) => {
  const [tickers] = useState(["PLTR","RKLB","SMCI"]);
  const watched = signals.filter(s => tickers.includes(s.ticker));
  return (
    <div style={{padding:"20px 20px 80px"}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Portfolio</div>
        <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Watchlist</div>
      </div>
      {watched.length === 0
        ? <div style={{textAlign:"center",padding:"60px 0",color:T.dim}}>
            <div style={{fontSize:36,marginBottom:10}}>👁</div>
            <div style={{fontSize:13}}>No signals on watchlist</div>
            <div style={{fontSize:11,marginTop:6}}>Add tickers from the Signals tab</div>
          </div>
        : watched.map(s => <SignalCard key={s.ticker} signal={s} onClick={()=>onSelect(s)}/>)}
    </div>
  );
};

const SettingsScreen = ({ connected, onSettingsSaved }) => {
  const [tgToken, setTgToken] = useState("");
  const [tgChat, setTgChat]   = useState("");
  const [avKey, setAvKey]     = useState("");
  const [threshold, setThreshold] = useState(80);
  const [llm, setLlm]         = useState("anthropic");
  const [saved, setSaved]     = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [health, setHealth]   = useState(null);

  useEffect(() => {
    api.get("/api/health").then(h => h && setHealth(h));
  }, []);

  const save = async () => {
    const ok = await api.post("/api/settings", {
      telegram_token: tgToken, telegram_chat_id: tgChat,
      alpha_vantage_key: avKey, alert_threshold: threshold, llm_backend: llm
    });
    if (ok) { setSaved(true); onSettingsSaved?.(); setTimeout(()=>setSaved(false), 2500); }
  };

  const testTelegram = async () => {
    if (!tgToken || !tgChat) { setTestResult("error"); return; }
    setTesting(true);
    const r = await fetch(`${API_BASE}/api/telegram/test?token=${encodeURIComponent(tgToken)}&chat_id=${encodeURIComponent(tgChat)}`, {method:"POST"});
    const d = await r.json();
    setTesting(false);
    setTestResult(d.success ? "ok" : "error");
    setTimeout(() => setTestResult(null), 3000);
  };

  const Inp = ({label, value, onChange, placeholder, mono}) => (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,color:T.dim,marginBottom:5}}>{label}</div>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:T.bgIn,border:`1px solid ${T.bdr}`,borderRadius:8,
          padding:"10px 12px",color:T.txt,fontSize:12,boxSizing:"border-box",
          fontFamily:mono?"monospace":"inherit",outline:"none"}}/>
    </div>
  );

  const GrpCard = ({title, children}) => (
    <div style={{marginBottom:20}}>
      <div style={{fontSize:11,fontWeight:700,color:T.mut,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>{title}</div>
      <div style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:14,padding:16}}>{children}</div>
    </div>
  );

  return (
    <div style={{padding:"20px 20px 80px"}}>
      <div style={{marginBottom:20}}>
        <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Configuration</div>
        <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Settings</div>
      </div>

      {health && (
        <GrpCard title="🟢 Backend Health">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[["API Status",health.status==="healthy"?"Online ✓":"Offline","grn"],
              ["WebSocket",connected?"Connected":"Disconnected",connected?"grn":"amb"],
              ["LLM",health.llm_backend,health.llm_configured?"grn":"amb"],
              ["Telegram",health.telegram_configured?"Configured":"Not set",health.telegram_configured?"grn":"mut"]].map(([l,v,c])=>(
              <div key={l} style={{background:T.bgEl,borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:T.dim}}>{l}</div>
                <div style={{fontSize:12,fontWeight:700,color:T[c]||T.txt}}>{v}</div>
              </div>
            ))}
          </div>
        </GrpCard>
      )}

      <GrpCard title="📡 Telegram Bot">
        <Inp label="Bot Token (from @BotFather)" value={tgToken} onChange={setTgToken} placeholder="7XXXXXXXX:AAXXXXXXXXXX" mono/>
        <Inp label="Channel / Chat ID" value={tgChat} onChange={setTgChat} placeholder="-100XXXXXXXXXX" mono/>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button onClick={testTelegram} disabled={testing} style={{
            flex:1,background:testResult==="ok"?T.grn:testResult==="error"?T.red:T.bgEl,
            border:`1px solid ${T.bdr}`,borderRadius:10,padding:"10px 0",fontSize:12,
            fontWeight:700,color:T.txt,cursor:"pointer"}}>
            {testing?"Testing...":testResult==="ok"?"✓ Connected!":testResult==="error"?"✗ Failed":"Test Connection"}
          </button>
          <button onClick={()=>api.post("/api/telegram/digest",{})} style={{flex:1,background:T.bgEl,border:`1px solid ${T.bdr}`,borderRadius:10,padding:"10px 0",fontSize:12,fontWeight:700,color:T.mut,cursor:"pointer"}}>
            Send Digest Now
          </button>
        </div>
      </GrpCard>

      <GrpCard title="📊 Data APIs">
        <Inp label="Alpha Vantage (free at alphavantage.co)" value={avKey} onChange={setAvKey} placeholder="Your free API key" mono/>
        <div style={{fontSize:11,color:T.dim,lineHeight:1.6}}>
          Also set: QUIVER_API_KEY (quiverquant.com) for congressional data.<br/>
          POLYGON_API_KEY (polygon.io) for real-time prices.
        </div>
      </GrpCard>

      <GrpCard title="🤖 LLM Backend">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {["anthropic","ollama","openai"].map(opt=>(
            <button key={opt} onClick={()=>setLlm(opt)} style={{
              background:llm===opt?T.acc:T.bgEl,border:`1px solid ${llm===opt?T.acc:T.bdr}`,
              color:llm===opt?T.bg:T.mut,borderRadius:8,padding:"9px 4px",
              fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize"
            }}>{opt}</button>
          ))}
        </div>
        <div style={{fontSize:11,color:T.dim,lineHeight:1.6}}>
          {llm==="ollama"?"Runs locally — needs Ollama at localhost:11434. No API cost. Best for privacy.":
           llm==="anthropic"?"Claude API — fastest & smartest for signal narratives. Set ANTHROPIC_API_KEY.":
           "GPT-4o — solid fallback. Set OPENAI_API_KEY in backend .env."}
        </div>
      </GrpCard>

      <GrpCard title="⚡ Alert Threshold">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:12,color:T.mut}}>Instant Telegram Alert</span>
          <span style={{fontSize:14,fontWeight:700,color:scoreColor(threshold)}}>{threshold}/100</span>
        </div>
        <input type="range" min={50} max={95} step={5} value={threshold} onChange={e=>setThreshold(Number(e.target.value))}
          style={{width:"100%",accentColor:T.acc}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.dim,marginTop:4}}>
          <span>50 – Relaxed</span><span>95 – Strict</span>
        </div>
      </GrpCard>

      <button onClick={save} style={{width:"100%",background:saved?T.grn:T.gradA,border:"none",borderRadius:14,
        padding:16,fontSize:15,fontWeight:800,color:T.bg,cursor:"pointer",transition:"all 0.3s"}}>
        {saved?"✓ Saved Successfully!":"Save All Settings"}
      </button>
    </div>
  );
};

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
const NAV = [
  {id:"home",icon:"⚡",label:"Signals"},
  {id:"congress",icon:"🏛",label:"Congress"},
  {id:"news",icon:"📰",label:"News"},
  {id:"watchlist",icon:"👁",label:"Watchlist"},
  {id:"settings",icon:"⚙️",label:"Settings"},
];

const BottomNav = ({ active, onChange }) => (
  <div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:430,margin:"0 auto",
    background:T.bgCard,borderTop:`1px solid ${T.bdr}`,display:"flex",zIndex:50,
    paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
    {NAV.map(item=>(
      <button key={item.id} onClick={()=>onChange(item.id)} style={{
        flex:1,background:"none",border:"none",padding:"10px 0 8px",cursor:"pointer",
        display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
        <span style={{fontSize:18,filter:active===item.id?"none":"grayscale(1) opacity(0.35)"}}>{item.icon}</span>
        <span style={{fontSize:9,fontWeight:active===item.id?700:400,
          color:active===item.id?T.acc:T.dim,letterSpacing:"0.03em"}}>{item.label}</span>
      </button>
    ))}
  </div>
);

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen]   = useState("home");
  const [selected, setSelected] = useState(null);
  const [signals, setSignals] = useState(DEMO_SIGNALS);
  const [congress, setCongress] = useState([]);
  const [news, setNews]       = useState([]);
  const [market, setMarket]   = useState({});
  const [loading, setLoading] = useState(true);
  const [toast, setToast]     = useState(null);

  const showToast = useCallback((msg) => {
    setToast(msg); setTimeout(() => setToast(null), 3000);
  }, []);

  // WebSocket handler
  const handleWsMessage = useCallback((msg) => {
    if (msg.type === "initial_load" && msg.data?.length) {
      setSignals(msg.data);
      setLoading(false);
    } else if (msg.type === "signal_update" && msg.data?.ticker) {
      setSignals(prev => {
        const idx = prev.findIndex(s => s.ticker === msg.data.ticker);
        if (idx >= 0) { const n = [...prev]; n[idx] = msg.data; return n; }
        return [msg.data, ...prev];
      });
      if (msg.data.fire_telegram) showToast(`🔥 ${msg.data.ticker} fired signal (${msg.data.score}/100)`);
    }
  }, [showToast]);

  const connected = useWebSocket(handleWsMessage);

  // Initial REST fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [sig, cong, nws, mkt] = await Promise.all([
        api.get("/api/signals"),
        api.get("/api/congress"),
        api.get("/api/news"),
        api.get("/api/market"),
      ]);
      if (sig?.signals?.length)  setSignals(sig.signals);
      if (cong?.trades?.length)  setCongress(cong.trades);
      if (nws?.catalysts?.length) setNews(nws.catalysts);
      if (mkt) setMarket(mkt);
      setLoading(false);
    };
    load();
    // Refresh market data every 60s
    const interval = setInterval(() => api.get("/api/market").then(m => m && setMarket(m)), 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{background:T.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto",
      fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
      position:"relative",overflowX:"hidden"}}>
      <h2 className="sr-only">StockSignalPro — Professional Stock Signal Intelligence</h2>
      <div style={{height:"env(safe-area-inset-top,0px)",background:T.bgCard}}/>

      {screen==="home"      && <HomeScreen signals={signals} loading={loading} connected={connected} onSelect={setSelected} market={market}/>}
      {screen==="congress"  && <CongressScreen data={congress} loading={loading}/>}
      {screen==="news"      && <NewsScreen data={news} loading={loading}/>}
      {screen==="watchlist" && <WatchlistScreen signals={signals} onSelect={setSelected}/>}
      {screen==="settings"  && <SettingsScreen connected={connected} onSettingsSaved={()=>showToast("✓ Settings saved")}/>}

      {selected && <SignalDetail signal={selected} onClose={()=>setSelected(null)}/>}
      {!selected && <BottomNav active={screen} onChange={setScreen}/>}

      {toast && (
        <div style={{position:"fixed",bottom:90,left:"50%",transform:"translateX(-50%)",
          background:T.bgEl,border:`1px solid ${T.bdr}`,borderRadius:24,
          padding:"10px 20px",fontSize:12,color:T.txt,zIndex:300,whiteSpace:"nowrap",
          boxShadow:"0 4px 20px rgba(0,0,0,0.5)"}}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:0.4;transform:scale(1)} 50%{opacity:1;transform:scale(1.2)} }
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
        input,button{font-family:inherit}
        ::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
}
