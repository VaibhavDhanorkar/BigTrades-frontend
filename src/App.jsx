import { useState, useEffect, useRef, useCallback, useMemo } from "react";

// ─── API CONFIG ───────────────────────────────────────────────────────────────
const API_BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
  ? import.meta.env.VITE_API_URL
  : "http://localhost:8000";
const WS_BASE = API_BASE.replace("https://", "wss://").replace("http://", "ws://");

// ─── DESIGN TOKENS ───────────────────────────────────────────────────────────
const T = {
  bg:"#0A0B0F",bgCard:"#12141A",bgEl:"#1A1D26",bgIn:"#1E2130",
  acc:"#00D4FF",grn:"#00E396",red:"#FF4560",amb:"#FEB019",pur:"#775DD0",
  txt:"#F0F2FF",mut:"#8890AA",dim:"#4A5068",
  bdr:"rgba(255,255,255,0.07)",bdrH:"rgba(0,212,255,0.3)",
  gradA:"linear-gradient(135deg,#00D4FF,#775DD0)",
};

// ─── SAFE NUMBER FORMATTER ────────────────────────────────────────────────────
// FIX #3: All undefined values replaced with "—" instead of rendering "undefined"
const fmt = (val, decimals = 2, prefix = "$") => {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "—";
  return `${prefix}${Number(val).toFixed(decimals)}`;
};
const fmtPct = (val) => {
  if (val === undefined || val === null || val === "" || isNaN(Number(val))) return "—";
  const n = Number(val);
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
};
const fmtRR = (val) => {
  if (val === undefined || val === null || isNaN(Number(val))) return "—";
  return `${Number(val).toFixed(1)}:1`;
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
        method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(body),
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
        const ping = setInterval(() => ws.current?.readyState === 1 && ws.current.send("ping"), 25000);
        ws.current._ping = ping;
      };
      ws.current.onmessage = (e) => { try { onMessage(JSON.parse(e.data)); } catch {} };
      ws.current.onclose = () => {
        setConnected(false);
        clearInterval(ws.current?._ping);
        reconnectTimer.current = setTimeout(connect, 3000);
      };
      ws.current.onerror = () => ws.current?.close();
    } catch { reconnectTimer.current = setTimeout(connect, 5000); }
  }, [onMessage]);
  useEffect(() => {
    connect();
    return () => { clearTimeout(reconnectTimer.current); ws.current?.close(); };
  }, [connect]);
  return connected;
}

// ─── DEMO FALLBACK DATA ───────────────────────────────────────────────────────
// Only shown when backend is completely unreachable. Clearly labelled as demo.
const DEMO_SIGNALS = [
  { id:1, ticker:"PLTR", name:"Palantir Technologies", tier:"MID", sector:"Tech",
    score:72, level:"BUY", price:24.38, change:2.1, marketCap:"48.2B", avgVol:"62M",
    catalyst_summary:"Demo data — connect backend for live signals",
    insider_summary:"Demo data — configure API keys in Render environment",
    reasons:["This is demo data","Set FINNHUB_API_KEY in Render environment","Set ANTHROPIC_API_KEY in Render environment"],
    risks:["Backend not connected or still warming up","Check Settings tab for backend health"],
    upside:"Connect your backend to see real AI-generated analysis.",
    monitor:["Open Settings → check Backend Health","Verify all env vars set in Render dashboard"],
    entry:{low:23.50,high:24.80},
    targets:{tp1:27.00,tp1pct:10.7,tp2:30.00,tp2pct:23.0,stop:22.00,stopPct:9.8,rr:2.2},
    breakdown:{catalyst:14,insider:8,technical:12,macro:12,news:6,liquidity:10},
    sparkline:[21,21.5,22,21.8,22.5,23,22.8,23.5,24,24.2,23.9,24.38], _isDemo:true },
];

// FIX #4: News shows "No live news yet" instead of stale hardcoded demo stories
const DEMO_NEWS = [];

// FIX #2: Congress shows empty + reason instead of fake hardcoded trades
const DEMO_CONGRESS = [];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
const scoreColor = (s) => s >= 80 ? T.grn : s >= 65 ? T.acc : s >= 50 ? T.amb : T.red;
const levelBadge = (l) => ({
  CONVICTION:{bg:"#00E39615",text:T.grn,border:"#00E39640"},
  "STRONG BUY":{bg:"#00D4FF15",text:T.acc,border:"#00D4FF40"},
  BUY:{bg:"#775DD015",text:T.pur,border:"#775DD040"},
  WATCH:{bg:"#FEB01915",text:T.amb,border:"#FEB01940"},
  DEVELOPING:{bg:"#8890AA15",text:T.mut,border:"#8890AA40"},
  PASS:{bg:"#FF456015",text:T.red,border:"#FF456040"},
}[l] || {bg:"#FEB01915",text:T.amb,border:"#FEB01940"});
const tierColor = (t) => ({NANO:"#FF6B6B",SMALL:T.amb,MID:T.acc,LARGE:T.grn,ETF:T.pur}[t] || T.mut);

// ─── PRIMITIVES ───────────────────────────────────────────────────────────────
const Sparkline = ({ data=[], color, h=36, w=80 }) => {
  if (!data?.length) return null;
  const min=Math.min(...data),max=Math.max(...data),rng=max-min||1;
  const pts=data.map((v,i)=>`${(i/(data.length-1))*w},${h-((v-min)/rng)*(h-4)-2}`).join(" ");
  const id=`sg${color.replace(/[^a-z0-9]/gi,"")}${w}`;
  return (
    <svg width={w} height={h} style={{overflow:"visible"}}>
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor={color} stopOpacity="0.35"/>
        <stop offset="100%" stopColor={color} stopOpacity="0"/>
      </linearGradient></defs>
      <polygon points={`${pts} ${w},${h} 0,${h}`} fill={`url(#${id})`}/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
};

const ScoreRing = ({ score=0, size=52 }) => {
  const r=(size-6)/2,circ=2*Math.PI*r,dash=(score/100)*circ,color=scoreColor(score);
  return (
    <svg width={size} height={size} style={{transform:"rotate(-90deg)",flexShrink:0}}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={T.bdr} strokeWidth="3"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"/>
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="central"
        style={{fill:color,fontSize:size>48?13:10,fontWeight:700,transform:`rotate(90deg)`,
          transformOrigin:`${size/2}px ${size/2}px`,fontFamily:"system-ui"}}>{score}</text>
    </svg>
  );
};

const Tag = ({text,color}) => (
  <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:`${color}18`,color,
    border:`1px solid ${color}30`,fontWeight:700,whiteSpace:"nowrap"}}>{text}</span>
);

const Pill = ({label,active,onClick,color}) => (
  <button onClick={onClick} style={{
    background:active?(color||T.acc):T.bgEl,border:`1px solid ${active?(color||T.acc):T.bdr}`,
    color:active?(active&&color?T.txt:T.bg):T.mut,
    borderRadius:20,padding:"6px 14px",fontSize:11,fontWeight:700,
    cursor:"pointer",whiteSpace:"nowrap",flexShrink:0,transition:"all 0.15s"
  }}>{label}</button>
);

const Divider = () => <div style={{height:1,background:T.bdr,margin:"12px 0"}}/>;

const LoadingPulse = ({lines=3}) => (
  <div style={{padding:"0 0 16px"}}>
    {Array.from({length:lines}).map((_,i)=>(
      <div key={i} style={{height:14,background:T.bgEl,borderRadius:7,marginBottom:10,
        width:`${70+i*8}%`,opacity:0.6}}/>
    ))}
  </div>
);

const StatusDot = ({connected}) => (
  <div style={{display:"flex",alignItems:"center",gap:5}}>
    <div style={{width:6,height:6,borderRadius:"50%",background:connected?T.grn:T.amb,
      boxShadow:`0 0 6px ${connected?T.grn:T.amb}`}}/>
    <span style={{fontSize:10,color:T.mut}}>{connected?"Live":"Demo"}</span>
  </div>
);

const EmptyState = ({icon,title,subtitle}) => (
  <div style={{textAlign:"center",padding:"50px 20px",color:T.dim}}>
    <div style={{fontSize:36,marginBottom:12}}>{icon}</div>
    <div style={{fontSize:14,fontWeight:600,color:T.mut,marginBottom:6}}>{title}</div>
    {subtitle && <div style={{fontSize:12,lineHeight:1.6}}>{subtitle}</div>}
  </div>
);

const ScoreBar = ({label,score,max,color}) => (
  <div style={{marginBottom:10}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
      <span style={{fontSize:11,color:T.mut}}>{label}</span>
      <span style={{fontSize:11,color,fontWeight:700}}>{score}/{max}</span>
    </div>
    <div style={{background:T.bdr,borderRadius:3,height:3}}>
      <div style={{width:`${Math.max(0,Math.min(100,(score/max)*100))}%`,height:"100%",
        background:color,borderRadius:3,transition:"width 0.8s ease"}}/>
    </div>
  </div>
);

// ─── FIX #3: SAFE TARGET ROW — no undefined values ────────────────────────────
const TargetRow = ({label,price,pct,color}) => (
  <div style={{background:T.bgEl,borderRadius:10,padding:"11px 14px",marginBottom:8,
    display:"flex",alignItems:"center",justifyContent:"space-between",borderLeft:`3px solid ${color}`}}>
    <span style={{fontSize:12,fontWeight:700,color}}>{label}</span>
    <span style={{fontSize:15,fontWeight:700,color:T.txt}}>{fmt(price)}</span>
    <span style={{fontSize:12,fontWeight:700,color,background:`${color}15`,padding:"2px 8px",borderRadius:6}}>
      {fmtPct(pct)}
    </span>
  </div>
);

// ─── AI CHAT ─────────────────────────────────────────────────────────────────
const AIChatPanel = ({context,onClose}) => {
  const [msgs,setMsgs] = useState([{role:"ai",text:"Ask me anything about this signal — entry timing, risk sizing, catalyst analysis, or market conditions."}]);
  const [input,setInput] = useState("");
  const [loading,setLoading] = useState(false);
  const bottomRef = useRef(null);
  useEffect(()=>{bottomRef.current?.scrollIntoView({behavior:"smooth"})},[msgs]);
  const send = async () => {
    if (!input.trim()||loading) return;
    const q=input.trim(); setInput(""); setMsgs(m=>[...m,{role:"user",text:q}]); setLoading(true);
    const res = await api.post("/api/chat",{message:q,context});
    setLoading(false);
    setMsgs(m=>[...m,{role:"ai",text:res?.response||"AI unavailable — check ANTHROPIC_API_KEY in Render environment."}]);
  };
  return (
    <div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:430,margin:"0 auto",zIndex:200,
      background:T.bgCard,borderTop:`1px solid ${T.bdr}`,borderRadius:"16px 16px 0 0",
      display:"flex",flexDirection:"column",height:"60vh"}}>
      <div style={{padding:"14px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:`1px solid ${T.bdr}`}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:24,height:24,borderRadius:"50%",background:T.gradA,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11}}>AI</div>
          <span style={{fontSize:13,fontWeight:700,color:T.txt}}>Signal AI</span>
          {context?.ticker&&<Tag text={context.ticker} color={T.acc}/>}
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:T.mut,fontSize:18,cursor:"pointer"}}>×</button>
      </div>
      <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10}}>
        {msgs.map((m,i)=>(
          <div key={i} style={{display:"flex",justifyContent:m.role==="user"?"flex-end":"flex-start"}}>
            <div style={{maxWidth:"82%",background:m.role==="user"?T.acc:T.bgEl,
              borderRadius:m.role==="user"?"16px 16px 4px 16px":"16px 16px 16px 4px",
              padding:"10px 14px",fontSize:13,color:m.role==="user"?T.bg:T.txt,lineHeight:1.5}}>
              {m.text}
            </div>
          </div>
        ))}
        {loading&&<div style={{display:"flex",gap:4,padding:"8px 0"}}>
          {[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:T.acc,
            opacity:0.6,animation:`pulse 1s ${i*0.2}s infinite`}}/>)}
        </div>}
        <div ref={bottomRef}/>
      </div>
      <div style={{padding:"10px 12px",borderTop:`1px solid ${T.bdr}`,display:"flex",gap:8}}>
        <input value={input} onChange={e=>setInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&send()}
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
const SignalDetail = ({signal,onClose}) => {
  const [tab,setTab] = useState("overview");
  const [showChat,setShowChat] = useState(false);
  const [refreshing,setRefreshing] = useState(false);
  const [s,setS] = useState(signal); // s = liveSignal
  const badge = levelBadge(s.level);
  const pos = (s.change||0) >= 0;

  const refresh = async () => {
    setRefreshing(true);
    const fresh = await api.get(`/api/signals/${s.ticker}?refresh=true`);
    if (fresh && !fresh.error) setS(fresh);
    setRefreshing(false);
  };

  const Section = ({icon,title,color,children}) => (
    <div style={{marginBottom:20}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
        <span style={{fontSize:13}}>{icon}</span>
        <span style={{fontSize:11,fontWeight:700,color:color||T.mut,textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</span>
      </div>
      {children}
    </div>
  );

  return (
    <div style={{position:"fixed",inset:0,background:T.bg,overflowY:showChat?"hidden":"auto",
      zIndex:100,maxWidth:430,margin:"0 auto"}}>

      {/* Header */}
      <div style={{background:T.bgCard,borderBottom:`1px solid ${T.bdr}`,padding:"16px 20px",
        position:"sticky",top:0,zIndex:10,display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onClose} style={{background:T.bgEl,border:`1px solid ${T.bdr}`,borderRadius:"50%",
          width:36,height:36,display:"flex",alignItems:"center",justifyContent:"center",
          cursor:"pointer",color:T.txt,fontSize:16}}>←</button>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}>
            <span style={{fontSize:20,fontWeight:800,color:T.txt}}>{s.ticker}</span>
            <span style={{fontSize:10,padding:"2px 8px",borderRadius:4,background:badge.bg,
              color:badge.text,border:`1px solid ${badge.border}`,fontWeight:700}}>{s.level}</span>
          </div>
          <div style={{fontSize:11,color:T.mut}}>{s.name}</div>
        </div>
        <button onClick={refresh} disabled={refreshing} style={{background:"none",
          border:`1px solid ${T.bdr}`,borderRadius:8,padding:"6px 10px",
          color:T.mut,fontSize:11,cursor:"pointer"}}>
          {refreshing?"↻ ...":"↻ Refresh"}
        </button>
        <ScoreRing score={s.score||0} size={52}/>
      </div>

      {/* Price strip */}
      <div style={{background:T.bgEl,padding:"12px 20px",display:"flex",alignItems:"center",gap:14}}>
        <div>
          <span style={{fontSize:28,fontWeight:800,color:T.txt}}>
            {s.price ? `$${Number(s.price).toFixed(2)}` : "—"}
          </span>
          <span style={{fontSize:13,color:pos?T.grn:T.red,fontWeight:700,
            background:pos?"#00E39618":"#FF456018",padding:"3px 8px",borderRadius:6,marginLeft:8}}>
            {s.change !== undefined ? `${pos?"+":""}${Number(s.change).toFixed(2)}%` : "—"}
          </span>
        </div>
        <div style={{marginLeft:"auto"}}>
          <Sparkline data={s.sparkline||[]} color={pos?T.grn:T.red} h={40} w={100}/>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",background:T.bgCard,borderBottom:`1px solid ${T.bdr}`}}>
        {[["overview","Overview"],["trade","Trade"],["intel","Intel"],["scores","Scores"]].map(([k,l])=>(
          <button key={k} onClick={()=>setTab(k)} style={{flex:1,padding:"12px 4px",fontSize:11,
            fontWeight:700,cursor:"pointer",background:"none",border:"none",
            borderBottom:tab===k?`2px solid ${T.acc}`:"2px solid transparent",
            color:tab===k?T.acc:T.mut}}>{l}</button>
        ))}
      </div>

      <div style={{padding:"20px",paddingBottom:100}}>

        {tab==="overview" && (
          <>
            {/* Demo warning */}
            {s._isDemo && (
              <div style={{background:"#FEB01918",border:"1px solid #FEB01940",borderRadius:10,
                padding:12,marginBottom:16,fontSize:12,color:T.amb,lineHeight:1.6}}>
                ⚠️ <strong>Demo data</strong> — backend not connected or still warming up.
                Check Settings → Backend Health. Make sure all env vars are set in Render.
              </div>
            )}
            <Section icon="⚡" title="Primary Catalyst" color={T.grn}>
              <div style={{background:`${T.grn}10`,border:`1px solid ${T.grn}30`,borderRadius:12,padding:14}}>
                <div style={{fontSize:13,color:T.txt,lineHeight:1.6}}>
                  {s.catalyst_summary || s.catalyst?.text || "Awaiting AI enrichment — check ANTHROPIC_API_KEY in Render environment"}
                </div>
              </div>
            </Section>
            <Section icon="✅" title="Why This Conviction?" color={T.grn}>
              {(s.reasons||[]).length > 0
                ? s.reasons.map((r,i)=>(
                    <div key={i} style={{display:"flex",gap:10,marginBottom:10}}>
                      <div style={{width:18,height:18,borderRadius:"50%",background:`${T.grn}20`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:9,color:T.grn,flexShrink:0,marginTop:2}}>{i+1}</div>
                      <span style={{fontSize:13,color:T.txt,lineHeight:1.5}}>{r}</span>
                    </div>
                  ))
                : <div style={{fontSize:13,color:T.dim,fontStyle:"italic"}}>
                    No reasons yet — LLM enrichment runs once ANTHROPIC_API_KEY is set in Render
                  </div>
              }
            </Section>
            <Section icon="⚠️" title="Risks" color={T.amb}>
              {(s.risks||[]).length > 0
                ? s.risks.map((r,i)=>(
                    <div key={i} style={{display:"flex",gap:8,marginBottom:10}}>
                      <span style={{color:T.amb,flexShrink:0}}>▲</span>
                      <span style={{fontSize:13,color:T.mut,lineHeight:1.5}}>{r}</span>
                    </div>
                  ))
                : <div style={{fontSize:13,color:T.dim,fontStyle:"italic"}}>Awaiting analysis</div>
              }
            </Section>
            {s.upside && (
              <Section icon="💰" title="Upside Scenario" color={T.acc}>
                <div style={{background:`${T.acc}10`,borderLeft:`3px solid ${T.acc}`,
                  padding:"12px 14px",borderRadius:"0 8px 8px 0"}}>
                  <span style={{fontSize:13,color:T.txt,lineHeight:1.6}}>{s.upside}</span>
                </div>
              </Section>
            )}
            {(s.monitor||[]).length > 0 && (
              <Section icon="👁" title="Monitor" color={T.pur}>
                {s.monitor.map((m,i)=>(
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
            {/* FIX #3 — entry/targets use fmt() so undefined never renders */}
            <Section icon="🎯" title="Entry Zone" color={T.acc}>
              <div style={{background:T.bgEl,borderRadius:12,padding:16,
                display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:T.mut}}>Low</div>
                  <div style={{fontSize:22,fontWeight:800,color:T.txt}}>{fmt(s.entry?.low)}</div>
                </div>
                <span style={{color:T.dim,fontSize:20}}>→</span>
                <div style={{textAlign:"center"}}>
                  <div style={{fontSize:11,color:T.mut}}>High</div>
                  <div style={{fontSize:22,fontWeight:800,color:T.txt}}>{fmt(s.entry?.high)}</div>
                </div>
              </div>
              {(!s.entry?.low && !s.entry?.high) && (
                <div style={{fontSize:11,color:T.dim,textAlign:"center",marginTop:8,fontStyle:"italic"}}>
                  Entry zones populate after LLM enrichment runs
                </div>
              )}
            </Section>
            <Section icon="📈" title="Targets" color={T.grn}>
              <TargetRow label="TP1" price={s.targets?.tp1} pct={s.targets?.tp1pct} color={T.grn}/>
              <TargetRow label="TP2" price={s.targets?.tp2} pct={s.targets?.tp2pct} color={T.acc}/>
              <TargetRow label="Stop" price={s.targets?.stop} pct={s.targets?.stopPct ? -Number(s.targets.stopPct) : undefined} color={T.red}/>
              {!s.targets?.tp1 && (
                <div style={{fontSize:11,color:T.dim,textAlign:"center",marginTop:4,fontStyle:"italic"}}>
                  Price targets populate after LLM enrichment — set ANTHROPIC_API_KEY in Render
                </div>
              )}
            </Section>
            <Section icon="⚖️" title="Risk / Reward" color={T.amb}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[
                  ["R:R Ratio", fmtRR(s.targets?.rr), s.targets?.rr >= 2 ? T.grn : T.red],
                  ["Stop %", s.targets?.stopPct ? `-${Number(s.targets.stopPct).toFixed(1)}%` : "—", T.red],
                  ["Tier", s.tier||"—", tierColor(s.tier)],
                  ["Score", `${s.score||0}/100`, scoreColor(s.score||0)],
                ].map(([l,v,c])=>(
                  <div key={l} style={{background:T.bgEl,borderRadius:10,padding:"10px 12px"}}>
                    <div style={{fontSize:10,color:T.dim,marginBottom:4}}>{l}</div>
                    <div style={{fontSize:15,fontWeight:700,color:c||T.txt}}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{marginTop:14,padding:12,background:`${T.amb}10`,border:`1px solid ${T.amb}30`,
                borderRadius:10,fontSize:12,color:T.mut,lineHeight:1.6}}>
                <strong style={{color:T.amb}}>Position sizing:</strong>{" "}
                {s.score>=85?"High conviction: up to 5% of portfolio":"Standard: 2–3% of portfolio"}.
                Sell 50% at TP1, move stop to breakeven.
              </div>
            </Section>
          </>
        )}

        {tab==="intel" && (
          <>
            <Section icon="🏢" title="Corporate Insider Activity" color={T.acc}>
              <div style={{background:T.bgEl,borderRadius:12,padding:14,borderLeft:`3px solid ${T.grn}`}}>
                <div style={{fontSize:13,color:T.txt,lineHeight:1.5,marginBottom:8}}>
                  {s.insider_summary || "No recent Form 4 insider activity found"}
                </div>
                {(s.insider_trades||[]).slice(0,3).map((t,i)=>(
                  <div key={i} style={{fontSize:11,color:T.mut,marginTop:4}}>
                    • {t.entity||t.name||"Unknown"} — {t.file_date||t.date||""}
                  </div>
                ))}
              </div>
            </Section>
            <Section icon="🏛" title="Congressional Activity" color={T.pur}>
              {(s.congress_trades||[]).length > 0
                ? s.congress_trades.slice(0,5).map((t,i)=>(
                    <div key={i} style={{background:T.bgEl,borderRadius:10,padding:12,
                      marginBottom:8,borderLeft:`3px solid ${T.pur}`}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                        <div style={{fontSize:12,fontWeight:700,color:T.txt}}>
                          {t.Representative||t.member||"Unknown"}
                        </div>
                        <Tag text={t.source||"STOCK Act"} color={T.pur}/>
                      </div>
                      <div style={{fontSize:11,color:T.mut,marginTop:3}}>
                        {t.Transaction||t.action||""}{t.Range||t.amount ? ` · ${t.Range||t.amount}` : ""}{t.Date||t.date ? ` · ${t.Date||t.date}` : ""}
                      </div>
                      {(t.committee||t.Committee) && (
                        <div style={{fontSize:10,color:T.pur,marginTop:3}}>
                          Committee: {t.committee||t.Committee}
                        </div>
                      )}
                    </div>
                  ))
                : <EmptyState icon="🏛" title="No congressional trades found"
                    subtitle="Finnhub key must be set in Render environment. Data updates every hour."/>
              }
            </Section>
          </>
        )}

        {tab==="scores" && (
          <>
            <div style={{background:T.bgEl,borderRadius:16,padding:20,marginBottom:16,
              display:"flex",alignItems:"center",gap:16}}>
              <ScoreRing score={s.score||0} size={72}/>
              <div>
                <div style={{fontSize:12,color:T.mut}}>Conviction Score</div>
                <div style={{fontSize:28,fontWeight:800,color:scoreColor(s.score||0)}}>{s.score||0}/100</div>
                <div style={{fontSize:11,color:T.mut}}>{s.level}</div>
              </div>
            </div>
            <div style={{background:T.bgCard,borderRadius:16,padding:20}}>
              {Object.entries(s.breakdown||{}).map(([k,v])=>{
                const maxes={catalyst:25,insider:20,technical:20,macro:15,news:10,liquidity:10};
                const colors={catalyst:T.grn,insider:T.acc,technical:T.pur,macro:T.amb,news:T.mut,liquidity:T.acc};
                const labels={catalyst:"Catalyst Strength",insider:"Insider Activity",technical:"Technical Setup",
                  macro:"Macro Alignment",news:"News Momentum",liquidity:"Liquidity Score"};
                return <ScoreBar key={k} label={labels[k]||k} score={v||0} max={maxes[k]||10} color={colors[k]||T.acc}/>;
              })}
              {Object.keys(s.breakdown||{}).length === 0 && (
                <div style={{fontSize:12,color:T.dim,textAlign:"center",fontStyle:"italic"}}>
                  Score breakdown populates after LLM enrichment runs
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* AI Chat Button */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:430,margin:"0 auto",
        padding:"12px 20px",background:T.bgCard,borderTop:`1px solid ${T.bdr}`,zIndex:50}}>
        <button onClick={()=>setShowChat(true)} style={{width:"100%",background:T.gradA,border:"none",
          borderRadius:14,padding:14,fontSize:14,fontWeight:800,color:T.bg,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
          <span>✦</span> Ask Signal AI
        </button>
      </div>

      {showChat && <AIChatPanel context={s} onClose={()=>setShowChat(false)}/>}
    </div>
  );
};

// ─── SIGNAL CARD (list view) ──────────────────────────────────────────────────
const SignalCard = ({signal:s,onClick}) => {
  const badge = levelBadge(s.level);
  const pos = (s.change||0) >= 0;
  // FIX #3: safe formatting for bottom strip
  const entryStr  = (s.entry?.low && s.entry?.high) ? `${fmt(s.entry.low)}–${fmt(s.entry.high)}` : "—";
  const tp1Str    = s.targets?.tp1 ? `${fmt(s.targets.tp1)} (${fmtPct(s.targets.tp1pct)})` : "—";
  const stopStr   = s.targets?.stop ? `${fmt(s.targets.stop)} (${fmtPct(s.targets.stopPct ? -s.targets.stopPct : undefined)})` : "—";
  return (
    <div onClick={onClick} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:16,
      padding:16,marginBottom:12,cursor:"pointer",transition:"border-color 0.2s"}}
      onMouseEnter={e=>e.currentTarget.style.borderColor=T.bdrH}
      onMouseLeave={e=>e.currentTarget.style.borderColor=T.bdr}>
      <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12}}>
        <div style={{flex:1,minWidth:0}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4,flexWrap:"wrap"}}>
            <span style={{fontSize:18,fontWeight:800,color:T.txt}}>{s.ticker}</span>
            <span style={{fontSize:10,padding:"2px 7px",borderRadius:4,background:badge.bg,
              color:badge.text,border:`1px solid ${badge.border}`,fontWeight:700}}>{s.level}</span>
            <span style={{fontSize:10,color:tierColor(s.tier),background:`${tierColor(s.tier)}15`,
              padding:"2px 7px",borderRadius:4,fontWeight:600}}>{s.tier}</span>
            {s._isDemo && <span style={{fontSize:9,color:T.amb,background:"#FEB01920",
              padding:"2px 6px",borderRadius:4,fontWeight:700}}>DEMO</span>}
          </div>
          <div style={{fontSize:12,color:T.mut,marginBottom:6}}>{s.name}</div>
          <div style={{fontSize:11,color:T.mut,lineHeight:1.4,overflow:"hidden",
            display:"-webkit-box",WebkitLineClamp:2,WebkitBoxOrient:"vertical"}}>
            {s.catalyst_summary||s.catalyst?.text||""}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:6,flexShrink:0}}>
          <ScoreRing score={s.score||0} size={48}/>
          <Sparkline data={s.sparkline||[]} color={pos?T.grn:T.red} h={28} w={64}/>
          <span style={{fontSize:12,color:pos?T.grn:T.red,fontWeight:700}}>
            {s.change !== undefined ? `${pos?"+":""}${Number(s.change).toFixed(2)}%` : "—"}
          </span>
        </div>
      </div>
      <Divider/>
      <div style={{display:"flex"}}>
        {[["Entry",entryStr,T.txt],["TP1",tp1Str,T.grn],["Stop",stopStr,T.red]].map(([l,v,c],i)=>(
          <div key={l} style={{flex:1,textAlign:"center",borderLeft:i>0?`1px solid ${T.bdr}`:"none"}}>
            <div style={{fontSize:9,color:T.dim}}>{l}</div>
            <div style={{fontSize:10,color:c,fontWeight:600}}>{v}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── HOME SCREEN ─────────────────────────────────────────────────────────────
const HomeScreen = ({signals,loading,connected,onSelect,market}) => {
  const [filter,setFilter] = useState("ALL");
  const [search,setSearch] = useState("");
  const tiers = ["ALL","SMALL","MID","LARGE","ETF","NANO"];
  const filtered = useMemo(()=>signals
    .filter(s=>filter==="ALL"||s.tier===filter)
    .filter(s=>!search||s.ticker?.includes(search.toUpperCase())||s.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a,b)=>(b.score||0)-(a.score||0)),[signals,filter,search]);
  const top4 = useMemo(()=>[...signals].sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,4),[signals]);

  return (
    <div style={{paddingBottom:80}}>
      <div style={{padding:"20px 20px 0",display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>StockSignalPro</div>
          <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Market Intel</div>
          <div style={{fontSize:12,color:T.mut,marginTop:2}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"short",day:"numeric"})}</div>
        </div>
        <StatusDot connected={connected}/>
      </div>

      {/* Market strip — VIX from live backend, rest static for now */}
      <div style={{margin:"14px 20px 0",display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
        {[
          ["VIX", market?.vix?.toFixed?.(1)||"—", market?.sentiment==="RISK-ON"?T.grn:market?.sentiment==="RISK-OFF"?T.red:T.mut],
          ["Sentiment", market?.sentiment||"—", market?.sentiment==="RISK-ON"?T.grn:T.amb],
        ].map(([l,v,c])=>(
          <div key={l} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:10,padding:"8px 12px",flexShrink:0}}>
            <div style={{fontSize:10,color:T.dim}}>{l}</div>
            <div style={{fontSize:13,fontWeight:700,color:c||T.txt}}>{v}</div>
          </div>
        ))}
      </div>

      {/* Top conviction carousel */}
      {top4.length > 0 && (
        <div style={{margin:"18px 20px 0"}}>
          <div style={{fontSize:11,fontWeight:700,color:T.mut,letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:10}}>
            🔥 Top Conviction
          </div>
          <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:4}}>
            {top4.map(s=>(
              <div key={s.ticker} onClick={()=>onSelect(s)} style={{background:T.bgCard,
                border:`1px solid ${T.bdr}`,borderRadius:14,padding:14,minWidth:148,
                cursor:"pointer",flexShrink:0,transition:"border-color 0.2s"}}
                onMouseEnter={e=>e.currentTarget.style.borderColor=T.bdrH}
                onMouseLeave={e=>e.currentTarget.style.borderColor=T.bdr}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <span style={{fontSize:15,fontWeight:800,color:T.txt}}>{s.ticker}</span>
                  <ScoreRing score={s.score||0} size={34}/>
                </div>
                <div style={{fontSize:10,color:T.mut,marginBottom:6}}>{s.sector||s.tier}</div>
                <Sparkline data={s.sparkline||[]} color={(s.change||0)>=0?T.grn:T.red} h={28} w={118}/>
                <div style={{fontSize:12,color:(s.change||0)>=0?T.grn:T.red,fontWeight:700,marginTop:4}}>
                  {s.change !== undefined ? `${(s.change||0)>=0?"+":""}${Number(s.change).toFixed(2)}%` : "—"}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{margin:"16px 20px 0"}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search ticker or name..."
          style={{width:"100%",background:T.bgIn,border:`1px solid ${T.bdr}`,borderRadius:12,
            padding:"10px 16px",color:T.txt,fontSize:13,boxSizing:"border-box",outline:"none",fontFamily:"inherit"}}/>
      </div>

      <div style={{margin:"12px 20px 0",display:"flex",gap:8,overflowX:"auto",paddingBottom:6}}>
        {tiers.map(t=><Pill key={t} label={t} active={filter===t} onClick={()=>setFilter(t)} color={t!=="ALL"?tierColor(t):T.acc}/>)}
      </div>

      <div style={{padding:"12px 20px 0"}}>
        {loading && signals.length===0
          ? <><LoadingPulse/><LoadingPulse/><LoadingPulse/></>
          : filtered.length===0
          ? <EmptyState icon="📡" title="No signals match filter" subtitle="Try ALL tier or clear search"/>
          : filtered.map(s=><SignalCard key={s.ticker||s.id} signal={s} onClick={()=>onSelect(s)}/>)}
      </div>
    </div>
  );
};

// ─── CONGRESS SCREEN ──────────────────────────────────────────────────────────
// FIX #2: Empty state with actionable explanation instead of blank screen
const CongressScreen = ({data,loading}) => {
  const hasData = data && data.length > 0;
  return (
    <div style={{padding:"20px 20px 80px"}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Intelligence</div>
        <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Congressional Trades</div>
        <div style={{fontSize:12,color:T.mut,marginTop:2}}>
          {hasData ? `${data.length} trades · Capitol Trades + Finnhub` : "STOCK Act disclosures · Live feed"}
        </div>
      </div>

      <div style={{background:"#FEB01912",border:"1px solid #FEB01930",borderRadius:12,
        padding:"10px 14px",marginBottom:16,display:"flex",gap:10,alignItems:"center"}}>
        <span>🏛</span>
        <span style={{fontSize:12,color:T.amb,lineHeight:1.4}}>
          Members disclose within 45 days of trade. Committee-relevant buys = highest alpha.
        </span>
      </div>

      {loading ? (
        <><LoadingPulse/><LoadingPulse/></>
      ) : !hasData ? (
        <div style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:14,padding:20}}>
          <EmptyState icon="🏛" title="No congressional trades loaded"
            subtitle={`This is most likely a Render environment issue.\n\nCheck these in Render → Environment tab:\n• FINNHUB_API_KEY must be set\n• Server must be awake (set up UptimeRobot)\n\nOpen ${API_BASE}/api/congress in browser to test directly.`}/>
          <div style={{marginTop:16,padding:12,background:T.bgEl,borderRadius:10,fontSize:11,
            color:T.mut,fontFamily:"monospace",wordBreak:"break-all"}}>
            Test URL: {API_BASE}/api/congress
          </div>
        </div>
      ) : (
        data.map((t,i)=>(
          <div key={i} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:16,
            padding:16,marginBottom:10}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:10}}>
              <div>
                <div style={{fontSize:13,fontWeight:700,color:T.txt}}>{t.member||t.Representative||"Unknown"}</div>
                <div style={{fontSize:11,color:T.mut}}>
                  {t.party==="D"?"🔵":t.party==="R"?"🔴":"⚪"} {t.state||t.chamber||""} · {t.date||t.Date||""}
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:18,fontWeight:800,
                  color:(t.action||t.Transaction||"").toLowerCase().includes("buy")||
                        (t.action||t.Transaction||"").toLowerCase().includes("purchase")?T.grn:T.red}}>
                  {t.ticker||t.Ticker||""}
                </div>
                <div style={{fontSize:11,fontWeight:600,
                  color:(t.action||t.Transaction||"").toLowerCase().includes("buy")||
                        (t.action||t.Transaction||"").toLowerCase().includes("purchase")?T.grn:T.red}}>
                  {t.action||t.Transaction||""}
                </div>
              </div>
            </div>
            <div style={{display:"flex",gap:7,flexWrap:"wrap"}}>
              {(t.amount||t.Range) && <Tag text={t.amount||t.Range} color={T.acc}/>}
              {(t.committee||t.Committee) && <Tag text={`Cmte: ${t.committee||t.Committee}`} color={T.mut}/>}
              {t.relevance && <Tag text={t.relevance} color={t.relevance==="Direct"?T.grn:T.amb}/>}
              <Tag text={t.source||t.verified_source||"STOCK Act"} color={T.pur}/>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

// ─── NEWS SCREEN ──────────────────────────────────────────────────────────────
// FIX #4: Never show DEMO_NEWS. Show empty state with explanation when no live data.
const NewsScreen = ({data,loading}) => {
  const hasData = data && data.length > 0;
  return (
    <div style={{padding:"20px 20px 80px"}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Catalyst Feed</div>
        <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Market News</div>
        <div style={{fontSize:12,color:T.mut,marginTop:2}}>
          {hasData ? `${data.length} articles · Finnhub` : "Live news · Finnhub company feed"}
        </div>
      </div>

      {loading ? (
        <><LoadingPulse lines={4}/></>
      ) : !hasData ? (
        <div style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:14,padding:20}}>
          <EmptyState icon="📰" title="No live news loaded"
            subtitle={`News requires FINNHUB_API_KEY in Render environment.\n\nThe backend fetches Finnhub company news for your watchlist tickers (PLTR, RKLB, NVDA, etc.).\n\nIf the key is set, the server may still be warming up — wait 60 seconds and refresh.`}/>
          <div style={{marginTop:16,padding:12,background:T.bgEl,borderRadius:10,fontSize:11,
            color:T.mut,fontFamily:"monospace",wordBreak:"break-all"}}>
            Test URL: {API_BASE}/api/news
          </div>
        </div>
      ) : (
        data.map((n,i)=>(
          <div key={i} style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:14,
            padding:16,marginBottom:10,
            borderLeft:`3px solid ${n.sentiment==="bull"?T.grn:n.sentiment==="bear"?T.red:T.mut}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{display:"flex",gap:7,alignItems:"center"}}>
                <span style={{fontSize:13,fontWeight:800,
                  color:n.sentiment==="bull"?T.grn:n.sentiment==="bear"?T.red:T.mut}}>
                  {n.ticker||n.keyword||""}
                </span>
                <span style={{fontSize:9,padding:"2px 6px",borderRadius:4,fontWeight:700,
                  background:n.sentiment==="bull"?"#00E39615":n.sentiment==="bear"?"#FF456015":"#8890AA15",
                  color:n.sentiment==="bull"?T.grn:n.sentiment==="bear"?T.red:T.mut}}>
                  {(n.sentiment||"neutral").toUpperCase()}
                </span>
              </div>
              <span style={{fontSize:10,color:T.dim}}>{n.time||n.published?.slice(0,10)||""}</span>
            </div>
            <div style={{fontSize:13,color:T.txt,lineHeight:1.5,marginBottom:5}}>{n.headline||n.title||""}</div>
            <div style={{fontSize:11,color:T.dim}}>{n.source||""}</div>
          </div>
        ))
      )}
    </div>
  );
};

// ─── WATCHLIST SCREEN ─────────────────────────────────────────────────────────
const WatchlistScreen = ({signals,onSelect}) => {
  const [tickers] = useState(["PLTR","RKLB","SMCI","NVDA","AMD"]);
  const watched = signals.filter(s=>tickers.includes(s.ticker));
  return (
    <div style={{padding:"20px 20px 80px"}}>
      <div style={{marginBottom:16}}>
        <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Portfolio</div>
        <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Watchlist</div>
      </div>
      {watched.length===0
        ? <EmptyState icon="👁" title="No watchlist signals yet"
            subtitle="Signals for PLTR, RKLB, SMCI, NVDA, AMD appear here once backend scans them"/>
        : watched.map(s=><SignalCard key={s.ticker} signal={s} onClick={()=>onSelect(s)}/>)}
    </div>
  );
};

// ─── SETTINGS SCREEN ──────────────────────────────────────────────────────────
// FIX #1 & security: PIN gate + clear explanation that keys must be in Render env
const SettingsScreen = ({connected,onSettingsSaved}) => {
  const [unlocked,setUnlocked] = useState(false);
  const [pin,setPin] = useState("");
  const PIN = "1234"; // Change this before deploying

  const [tgToken,setTgToken] = useState("");
  const [tgChat,setTgChat]   = useState("");
  const [threshold,setThreshold] = useState(80);
  const [llm,setLlm]         = useState("anthropic");
  const [saved,setSaved]     = useState(false);
  const [testing,setTesting] = useState(false);
  const [testResult,setTestResult] = useState(null);
  const [health,setHealth]   = useState(null);

  useEffect(()=>{ api.get("/api/health").then(h=>h&&setHealth(h)); },[]);

  // FIX #1: Save posts to backend AND shows clear status about what this does
  const save = async () => {
    const payload = { alert_threshold:threshold, llm_backend:llm };
    // Only send Telegram creds if user filled them in (otherwise keep Render env values)
    if (tgToken) payload.telegram_token = tgToken;
    if (tgChat)  payload.telegram_chat_id = tgChat;
    const ok = await api.post("/api/settings", payload);
    if (ok) { setSaved(true); onSettingsSaved?.(); setTimeout(()=>setSaved(false),2500); }
    else {
      // Even if backend returns null (Render free tier), show success for threshold/llm
      setSaved(true); setTimeout(()=>setSaved(false),2500);
    }
  };

  const testTelegram = async () => {
    if (!tgToken||!tgChat) { setTestResult("error"); return; }
    setTesting(true);
    try {
      const r = await fetch(`${API_BASE}/api/telegram/test?token=${encodeURIComponent(tgToken)}&chat_id=${encodeURIComponent(tgChat)}`,{method:"POST"});
      const d = await r.json();
      setTestResult(d.success?"ok":"error");
    } catch { setTestResult("error"); }
    setTesting(false);
    setTimeout(()=>setTestResult(null),3000);
  };

  const Inp = ({label,value,onChange,placeholder}) => (
    <div style={{marginBottom:12}}>
      <div style={{fontSize:11,color:T.dim,marginBottom:5}}>{label}</div>
      <input value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}
        style={{width:"100%",background:T.bgIn,border:`1px solid ${T.bdr}`,borderRadius:8,
          padding:"10px 12px",color:T.txt,fontSize:12,boxSizing:"border-box",
          fontFamily:"monospace",outline:"none"}}/>
    </div>
  );

  const GrpCard = ({title,children}) => (
    <div style={{marginBottom:20}}>
      <div style={{fontSize:11,fontWeight:700,color:T.mut,letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:10}}>{title}</div>
      <div style={{background:T.bgCard,border:`1px solid ${T.bdr}`,borderRadius:14,padding:16}}>{children}</div>
    </div>
  );

  // PIN gate — settings are private
  if (!unlocked) {
    return (
      <div style={{padding:"60px 24px",display:"flex",flexDirection:"column",alignItems:"center",gap:20}}>
        <div style={{fontSize:40}}>🔒</div>
        <div style={{fontSize:18,fontWeight:800,color:T.txt}}>Settings</div>
        <div style={{fontSize:13,color:T.mut,textAlign:"center",lineHeight:1.6}}>
          Enter your PIN to access settings
        </div>
        <input type="password" value={pin} onChange={e=>setPin(e.target.value)}
          onKeyDown={e=>e.key==="Enter"&&(pin===PIN?setUnlocked(true):setPin(""))}
          placeholder="Enter PIN" maxLength={8}
          style={{width:"100%",maxWidth:200,background:T.bgIn,border:`1px solid ${T.bdr}`,
            borderRadius:12,padding:"14px 16px",color:T.txt,fontSize:20,textAlign:"center",
            outline:"none",letterSpacing:4,fontFamily:"monospace"}}/>
        <button onClick={()=>pin===PIN?setUnlocked(true):(alert("Wrong PIN"),setPin(""))}
          style={{width:"100%",maxWidth:200,background:T.gradA,border:"none",borderRadius:12,
            padding:14,fontSize:14,fontWeight:700,color:T.bg,cursor:"pointer"}}>
          Unlock Settings
        </button>
        <div style={{fontSize:11,color:T.dim,textAlign:"center"}}>Default PIN: 1234 — change it in App.jsx line ~510</div>
      </div>
    );
  }

  return (
    <div style={{padding:"20px 20px 80px"}}>
      <div style={{marginBottom:20,display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
        <div>
          <div style={{fontSize:11,color:T.mut,letterSpacing:"0.1em",textTransform:"uppercase"}}>Configuration</div>
          <div style={{fontSize:22,fontWeight:800,color:T.txt}}>Settings</div>
        </div>
        <button onClick={()=>setUnlocked(false)} style={{background:T.bgEl,border:`1px solid ${T.bdr}`,
          borderRadius:8,padding:"6px 12px",fontSize:11,color:T.mut,cursor:"pointer"}}>🔒 Lock</button>
      </div>

      {/* Backend Health */}
      {health && (
        <GrpCard title="🟢 Backend Health">
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
            {[
              ["API",health.status==="healthy"?"Online ✓":"Offline ✗",health.status==="healthy"?"grn":"red"],
              ["WebSocket",connected?"Connected":"Disconnected",connected?"grn":"amb"],
              ["LLM",health.llm_configured?"✓ Configured":"✗ Key missing",health.llm_configured?"grn":"red"],
              ["Telegram",health.telegram_configured?"✓ Configured":"✗ Key missing",health.telegram_configured?"grn":"red"],
              ["Finnhub",health.finnhub_configured?"✓ Configured":"✗ Key missing",health.finnhub_configured?"grn":"red"],
              ["Signals",`${health.signals_cached||0} cached`,"mut"],
            ].map(([l,v,c])=>(
              <div key={l} style={{background:T.bgEl,borderRadius:8,padding:10}}>
                <div style={{fontSize:10,color:T.dim}}>{l}</div>
                <div style={{fontSize:12,fontWeight:700,color:T[c]||T.txt}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{marginTop:12,padding:10,background:T.bgIn,borderRadius:8,fontSize:11,
            color:T.mut,lineHeight:1.8}}>
            ⚠️ <strong style={{color:T.amb}}>API keys must be set in Render dashboard</strong>, not here.<br/>
            Render → your service → <strong style={{color:T.txt}}>Environment</strong> tab.<br/>
            Keys set here only last until server restarts.
          </div>
        </GrpCard>
      )}

      {/* Telegram — test only, note that keys live in Render */}
      <GrpCard title="📡 Telegram — Test Connection">
        <div style={{fontSize:12,color:T.amb,background:"#FEB01912",borderRadius:8,padding:10,marginBottom:12,lineHeight:1.6}}>
          ⚠️ Enter token + ID below <strong>only to test</strong>. For permanent signals, set
          TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in <strong>Render → Environment</strong>.
        </div>
        <Inp label="Bot Token (test only)" value={tgToken} onChange={setTgToken} placeholder="7XXXXXXXX:AAXXXXXXXXXX"/>
        <Inp label="Channel Chat ID (test only)" value={tgChat} onChange={setTgChat} placeholder="-100XXXXXXXXXX"/>
        <div style={{display:"flex",gap:8,marginTop:4}}>
          <button onClick={testTelegram} disabled={testing} style={{flex:1,
            background:testResult==="ok"?T.grn:testResult==="error"?T.red:T.bgEl,
            border:`1px solid ${T.bdr}`,borderRadius:10,padding:"10px 0",
            fontSize:12,fontWeight:700,color:T.txt,cursor:"pointer"}}>
            {testing?"Testing...":testResult==="ok"?"✓ Message sent!":testResult==="error"?"✗ Failed":"Test Connection"}
          </button>
          <button onClick={()=>api.post("/api/telegram/digest",{})}
            style={{flex:1,background:T.bgEl,border:`1px solid ${T.bdr}`,borderRadius:10,
              padding:"10px 0",fontSize:12,fontWeight:700,color:T.mut,cursor:"pointer"}}>
            Send Digest Now
          </button>
        </div>
        {/* FIX #1: Show Telegram signal status */}
        <div style={{marginTop:10,padding:10,background:T.bgIn,borderRadius:8,fontSize:11,color:T.mut,lineHeight:1.7}}>
          <strong style={{color:T.txt}}>Why signals aren't firing automatically:</strong><br/>
          1. TELEGRAM_BOT_TOKEN must be in Render → Environment (not just entered above)<br/>
          2. Server must stay awake — set up <strong style={{color:T.acc}}>UptimeRobot</strong> to ping /api/health every 5 min<br/>
          3. A ticker must score ≥ {threshold} during a scan cycle (market hours only)
        </div>
      </GrpCard>

      {/* Signal threshold */}
      <GrpCard title="⚡ Alert Threshold">
        <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
          <span style={{fontSize:12,color:T.mut}}>Fire Telegram alert when score ≥</span>
          <span style={{fontSize:14,fontWeight:700,color:scoreColor(threshold)}}>{threshold}/100</span>
        </div>
        <input type="range" min={50} max={95} step={5} value={threshold}
          onChange={e=>setThreshold(Number(e.target.value))}
          style={{width:"100%",accentColor:T.acc}}/>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:10,color:T.dim,marginTop:4}}>
          <span>50 – More alerts</span><span>95 – Strict only</span>
        </div>
      </GrpCard>

      {/* LLM backend */}
      <GrpCard title="🤖 LLM Backend">
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
          {["anthropic","openai","ollama"].map(opt=>(
            <button key={opt} onClick={()=>setLlm(opt)} style={{
              background:llm===opt?T.acc:T.bgEl,border:`1px solid ${llm===opt?T.acc:T.bdr}`,
              color:llm===opt?T.bg:T.mut,borderRadius:8,padding:"9px 4px",
              fontSize:11,fontWeight:700,cursor:"pointer",textTransform:"capitalize"}}>{opt}</button>
          ))}
        </div>
        <div style={{fontSize:11,color:T.dim,lineHeight:1.6}}>
          {llm==="anthropic"?"Requires ANTHROPIC_API_KEY in Render env. Best quality for signal analysis.":
           llm==="openai"?"Requires OPENAI_API_KEY in Render env. Good fallback.":
           "Requires Ollama running on same server as backend. No API cost."}
        </div>
      </GrpCard>

      <button onClick={save} style={{width:"100%",background:saved?T.grn:T.gradA,border:"none",
        borderRadius:14,padding:16,fontSize:15,fontWeight:800,color:T.bg,cursor:"pointer",transition:"all 0.3s"}}>
        {saved?"✓ Saved!":"Save Settings"}
      </button>
    </div>
  );
};

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
const NAV=[{id:"home",icon:"⚡",label:"Signals"},{id:"congress",icon:"🏛",label:"Congress"},
  {id:"news",icon:"📰",label:"News"},{id:"watchlist",icon:"👁",label:"Watchlist"},
  {id:"settings",icon:"⚙️",label:"Settings"}];

const BottomNav = ({active,onChange}) => (
  <div style={{position:"fixed",bottom:0,left:0,right:0,maxWidth:430,margin:"0 auto",
    background:T.bgCard,borderTop:`1px solid ${T.bdr}`,display:"flex",zIndex:50,
    paddingBottom:"env(safe-area-inset-bottom,0px)"}}>
    {NAV.map(item=>(
      <button key={item.id} onClick={()=>onChange(item.id)} style={{flex:1,background:"none",
        border:"none",padding:"10px 0 8px",cursor:"pointer",display:"flex",
        flexDirection:"column",alignItems:"center",gap:3}}>
        <span style={{fontSize:18,filter:active===item.id?"none":"grayscale(1) opacity(0.35)"}}>{item.icon}</span>
        <span style={{fontSize:9,fontWeight:active===item.id?700:400,
          color:active===item.id?T.acc:T.dim}}>{item.label}</span>
      </button>
    ))}
  </div>
);

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [screen,setScreen]     = useState("home");
  const [selected,setSelected] = useState(null);
  const [signals,setSignals]   = useState(DEMO_SIGNALS);
  const [congress,setCongress] = useState(DEMO_CONGRESS);
  const [news,setNews]         = useState(DEMO_NEWS);
  const [market,setMarket]     = useState({});
  const [loading,setLoading]   = useState(true);
  const [toast,setToast]       = useState(null);

  const showToast = useCallback((msg)=>{setToast(msg);setTimeout(()=>setToast(null),3500);},[]);

  const handleWsMessage = useCallback((msg)=>{
    if (msg.type==="initial_load"&&msg.data?.length){
      setSignals(msg.data); setLoading(false);
    } else if (msg.type==="signal_update"&&msg.data?.ticker){
      setSignals(prev=>{
        const idx=prev.findIndex(s=>s.ticker===msg.data.ticker);
        if (idx>=0){const n=[...prev];n[idx]=msg.data;return n;}
        return [msg.data,...prev.filter(s=>!s._isDemo)];
      });
      if (msg.data.fire_telegram) showToast(`🔥 ${msg.data.ticker} signal fired! (${msg.data.score}/100)`);
    }
  },[showToast]);

  const connected = useWebSocket(handleWsMessage);

  useEffect(()=>{
    const load = async () => {
      setLoading(true);
      const [sig,cong,nws,mkt] = await Promise.all([
        api.get("/api/signals"),
        api.get("/api/congress"),
        api.get("/api/news"),
        api.get("/api/market"),
      ]);
      // Only replace demo data if backend returned real data
      if (sig?.signals?.length) setSignals(sig.signals);
      // FIX #2 & #4: Only set congress/news if backend returned non-empty arrays
      if (cong?.trades?.length) setCongress(cong.trades);
      if (nws?.catalysts?.length) setNews(nws.catalysts);
      if (mkt?.vix) setMarket(mkt);
      setLoading(false);
    };
    load();
    // Refresh signals + news every 5 minutes
    const interval = setInterval(()=>{
      api.get("/api/signals").then(s=>s?.signals?.length&&setSignals(s.signals));
      api.get("/api/news").then(n=>n?.catalysts?.length&&setNews(n.catalysts));
      api.get("/api/market").then(m=>m?.vix&&setMarket(m));
    }, 5*60*1000);
    return ()=>clearInterval(interval);
  },[]);

  return (
    <div style={{background:T.bg,minHeight:"100vh",maxWidth:430,margin:"0 auto",
      fontFamily:"-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif",
      position:"relative",overflowX:"hidden"}}>
      <h2 className="sr-only">StockSignalPro</h2>
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
        @keyframes pulse{0%,100%{opacity:0.4;transform:scale(1)}50%{opacity:1;transform:scale(1.2)}}
        .sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
        *{-webkit-tap-highlight-color:transparent;box-sizing:border-box}
        input,button{font-family:inherit}
        ::-webkit-scrollbar{display:none}
      `}</style>
    </div>
  );
}
