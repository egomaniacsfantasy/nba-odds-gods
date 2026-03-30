import { useState, useEffect, useRef, useCallback } from "react";

const BUCKETS = ["G","W","B"] as const;
type Bkt = typeof BUCKETS[number];
interface DraftConfig { nTeams:number; rosterSize:number; nRounds:number; reqGuards:number; reqWings:number; reqBigs:number; sigmaNoise:number; }
interface Player { playerIdx:number; playerId:number; playerName:string; teamAbbr:string; bucket:string; bpmC:number; }
interface DraftPack { season:string; config:DraftConfig; players:Player[]; teams:string[]; aiValuations:Record<string,number[]>; }
interface DraftSlot { round:number; pickInRound:number; overallPick:number; team:string; }
interface Req { G:number; W:number; B:number; }
interface PickRecord { overallPick:number; round:number; team:string; playerIdx:number; playerName:string; teamAbbr:string; bucket:string; isUser:boolean; }
interface SeasonGame { gid:number; date:string; dn:number; t1:string; t2:string; loc:number; done:boolean; t1w:number|null; wp:number[]; }
interface PoState { ssd:number; wp:number[]; }
interface PoGame { gnum:number; dn:number; loc:number; states:PoState[]; }
type PoData = Record<string,PoGame[]>;
interface PlayInGame { dn:number; loc:number; wp:number[]; }
interface SeasonData { season:string; bpm_grid:number[]; regular_season:SeasonGame[]; play_in:Record<string,PlayInGame>; playoffs:PoData; }
interface TeamStat { w:number; l:number; projW:number; poPct:number; r1Pct:number; r2Pct:number; cfPct:number; finPct:number; champPct:number; }
type Phase = "loading"|"select"|"draft"|"complete"|"season_load"|"season";

const EAST=new Set(["ATL","BOS","BKN","CHA","CHI","CLE","DET","IND","MIA","MIL","NYK","ORL","PHI","TOR","WAS"]);
const WEST=new Set(["DAL","DEN","GSW","HOU","LAC","LAL","MEM","MIN","NOP","OKC","PHX","POR","SAC","SAS","UTA"]);

function shuffle<T>(arr:T[]):T[]{const a=[...arr];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function buildSlots(teams:string[],nRounds:number):DraftSlot[]{const slots:DraftSlot[]=[];for(let r=1;r<=nRounds;r++){const order=r%2===1?teams:[...teams].reverse();order.forEach((team,i)=>slots.push({round:r,pickInRound:i+1,overallPick:(r-1)*teams.length+i+1,team}));}return slots;}
function getReq(c:DraftConfig):Req{return{G:c.reqGuards,W:c.reqWings,B:c.reqBigs};}
function neededBuckets(filled:Req,req:Req):Bkt[]{return BUCKETS.filter(b=>filled[b]<req[b]);}
function unfilledCount(filled:Req,req:Req):number{return BUCKETS.reduce((s,b)=>s+Math.max(0,req[b]-filled[b]),0);}
function scarcityPrem(bkt:Bkt,avail:Set<number>,players:Player[],reqs:Record<string,Req>,teams:string[],req:Req,sigma:number):number{const nA=[...avail].filter(i=>players[i]?.bucket===bkt).length;const nN=teams.filter(t=>(reqs[t]?.[bkt]??0)<req[bkt]).length;if(!nN)return 0;return Math.max(0,1-nA/nN/2)*sigma*0.5;}
function aiPickPlayer(team:string,slot:DraftSlot,pack:DraftPack,slots:DraftSlot[],avail:Set<number>,reqs:Record<string,Req>):number{const req=getReq(pack.config);const filled=reqs[team]??{G:0,W:0,B:0};const needed=neededBuckets(filled,req);const pLeft=slots.filter(s=>s.team===team&&s.overallPick>=slot.overallPick).length;let eligible=[...avail];if(pLeft<=unfilledCount(filled,req)&&needed.length>0){const r=eligible.filter(i=>needed.includes(pack.players[i]?.bucket as Bkt));if(r.length>0)eligible=r;}const vals=pack.aiValuations[team]??[];let best=eligible[0]??0,bestV=-Infinity;for(const i of eligible){let v=vals[i]??0;const b=pack.players[i]?.bucket as Bkt;if(b&&needed.includes(b))v+=scarcityPrem(b,avail,pack.players,reqs,pack.teams,req,pack.config.sigmaNoise);if(v>bestV){bestV=v;best=i;}}return best;}

function interpWP(wp:number[],diff:number):number{
  const idx=Math.max(0,Math.min(120,(diff+6)/0.1));
  const lo=Math.floor(idx),hi=Math.min(120,lo+1),t=idx-lo;
  return wp[lo]*(1-t)+wp[hi]*t;
}

function computeBpmZ(rosters:Record<string,number[]>,players:Player[]):Record<string,number>{
  const teams=Object.keys(rosters);
  const bpms=teams.map(t=>(rosters[t]??[]).reduce((s,i)=>s+(players[i]?.bpmC??0),0));
  const mean=bpms.reduce((a,b)=>a+b,0)/Math.max(1,bpms.length);
  const std=Math.sqrt(bpms.reduce((s,b)=>s+(b-mean)**2,0)/Math.max(1,bpms.length))||1;
  const r:Record<string,number>={};
  teams.forEach((t,i)=>r[t]=(bpms[i]-mean)/std);
  return r;
}

function runSeasonStats(games:SeasonGame[],bpmZ:Record<string,number>):Record<string,TeamStat>{
  const allTeams=[...new Set(games.flatMap(g=>[g.t1,g.t2]))];
  const result:Record<string,TeamStat>={};
  for(const t of allTeams)result[t]={w:0,l:0,projW:0,poPct:0,r1Pct:0,r2Pct:0,cfPct:0,finPct:0,champPct:0};
  return result;
}

export default function ManagerModePage() {
  const [pack,setPack]=useState<DraftPack|null>(null);
  const [phase,setPhase]=useState<Phase>("loading");
  const [fetchErr,setFetchErr]=useState<string|null>(null);
  const [userTeam,setUserTeam]=useState("");
  const [draftSlots,setDraftSlots]=useState<DraftSlot[]>([]);
  const [pickIdx,setPickIdx]=useState(0);
  const [avail,setAvail]=useState<Set<number>>(new Set());
  const [reqs,setReqs]=useState<Record<string,Req>>({});
  const [rosters,setRosters]=useState<Record<string,number[]>>({});
  const [log,setLog]=useState<PickRecord[]>([]);
  const [filter,setFilter]=useState("all");
  const [seasonData,setSeasonData]=useState<SeasonData|null>(null);
  const [seasonErr,setSeasonErr]=useState<string|null>(null);
  const [stats,setStats]=useState<Record<string,TeamStat>>({});
  const [bpmZ,setBpmZ]=useState<Record<string,number>>({});
  const [seasonTab,setSeasonTab]=useState<"standings"|"schedule">("schedule");
  const availRef=useRef<Set<number>>(new Set());
  const reqsRef=useRef<Record<string,Req>>({});
  availRef.current=avail; reqsRef.current=reqs;

  useEffect(()=>{
    fetch("/data/mgr_draft_pack.json")
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then((d:DraftPack)=>{setPack(d);setPhase("select");})
      .catch((e:unknown)=>setFetchErr(String(e)));
  },[]);

  const startDraft=useCallback(()=>{
    if(!pack) return;
    const order=shuffle(pack.teams);
    const slots=buildSlots(order,pack.config.nRounds);
    const ir:Record<string,Req>={},rr:Record<string,number[]>={};
    for(const t of pack.teams){ir[t]={G:0,W:0,B:0};rr[t]=[];}
    setDraftSlots(slots);setReqs(ir);setRosters(rr);
    setAvail(new Set(pack.players.map(p=>p.playerIdx)));
    setLog([]);setPickIdx(0);setPhase("draft");
  },[pack]);

  const recordPick=useCallback((sIdx:number,playerIdx:number,slots:DraftSlot[])=>{
    if(!pack) return;
    const slot=slots[sIdx];
    const player=pack.players[playerIdx];
    const req=getReq(pack.config);
    const b=player.bucket as Bkt;
    setAvail(prev=>{const n=new Set(prev);n.delete(playerIdx);return n;});
    setReqs(prev=>{const f=prev[slot.team]??{G:0,W:0,B:0};return f[b]<req[b]?{...prev,[slot.team]:{...f,[b]:f[b]+1}}:prev;});
    setRosters(prev=>({...prev,[slot.team]:[...(prev[slot.team]??[]),playerIdx]}));
    setLog(prev=>[...prev,{overallPick:slot.overallPick,round:slot.round,team:slot.team,playerIdx,playerName:player.playerName,teamAbbr:player.teamAbbr,bucket:player.bucket,isUser:slot.team===userTeam}]);
    const next=sIdx+1;
    setPickIdx(next);
    if(next>=slots.length) setPhase("complete");
  },[pack,userTeam]);

  useEffect(()=>{
    if(phase!=="draft"||!pack||draftSlots.length===0) return;
    if(pickIdx>=draftSlots.length) return;
    const slot=draftSlots[pickIdx];
    if(slot.team===userTeam) return;
    const t=setTimeout(()=>{
      const picked=aiPickPlayer(slot.team,slot,pack,draftSlots,availRef.current,reqsRef.current);
      recordPick(pickIdx,picked,draftSlots);
    },150);
    return ()=>clearTimeout(t);
  },[phase,pickIdx,pack,userTeam,draftSlots,recordPick]);

  const startSeason=useCallback(()=>{
    if(!pack) return;
    setPhase("season_load");
    setSeasonErr(null);
    fetch("/data/mgr_season_data.json")
      .then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.json();})
      .then((d:SeasonData)=>{
        const z=computeBpmZ(rosters,pack.players);
        const st=runSeasonStats(d.regular_season,z);
        setBpmZ(z);setSeasonData(d);setStats(st);setPhase("season");
      })
      .catch((e:unknown)=>{setSeasonErr(String(e));setPhase("complete");});
  },[pack,rosters]);

  if(phase==="loading") return(
    <div className="mgr-page">
      <div className="mgr-loading">
        {fetchErr
          ?<><p className="mgr-error">{fetchErr}</p><p className="mgr-hint">Run manager_mode.py CELL 2 to generate the draft pack.</p></>
          :<p className="mgr-hint">Loading draft pack...</p>}
      </div>
    </div>
  );
  if(phase==="season_load") return(
    <div className="mgr-page">
      <div className="mgr-loading">
        <p className="mgr-hint">Loading season data...</p>
        {seasonErr&&<p className="mgr-error">{seasonErr}</p>}
      </div>
    </div>
  );
  if(phase==="select") return <div className="mgr-page"><SelectView pack={pack!} userTeam={userTeam} setUserTeam={setUserTeam} onStart={startDraft}/></div>;
  if(phase==="draft"){
    const p=pack!;
    const slot=draftSlots[pickIdx];
    if(!slot) return null;
    const isUser=slot.team===userTeam;
    const req=getReq(p.config);
    const filled=reqs[userTeam]??{G:0,W:0,B:0};
    const needed=neededBuckets(filled,req);
    const pLeft=draftSlots.filter(s=>s.team===userTeam&&s.overallPick>=slot.overallPick).length;
    const mustPick=isUser&&pLeft<=unfilledCount(filled,req)&&needed.length>0;
    const eligible=p.players.filter(pl=>{
      if(!avail.has(pl.playerIdx)) return false;
      if(mustPick&&!needed.includes(pl.bucket as Bkt)) return false;
      if(filter!=="all"&&pl.bucket!==filter) return false;
      return true;
    }).sort((a,b)=>a.playerName.localeCompare(b.playerName));
    const recent=[...log].reverse().slice(0,30);
    const total=p.config.nTeams*p.config.nRounds;
    const userRoster=rosters[userTeam]??[];
    return(
      <div className="mgr-page mgr-page--draft">
        <div className="mgr-draft-bar">
          <div className="mgr-draft-bar-left">
            <span className="mgr-round-badge">Round {slot.round} of {p.config.nRounds}</span>
            <span className="mgr-pick-counter">Pick <strong>#{slot.overallPick}</strong> / {total}</span>
          </div>
          <div className="mgr-draft-bar-mid">
            {isUser
              ? <span className="mgr-turn-you">YOUR PICK &mdash; {userTeam}</span>
              : <span className="mgr-turn-ai"><span className="mgr-ai-dots"><span/><span/><span/></span>{slot.team} is on the clock</span>
            }
          </div>
          <div className="mgr-draft-bar-right">
            <span className="mgr-progress">{avail.size} players left</span>
          </div>
        </div>

        <div className="mgr-draft-layout">
          <div className="mgr-draft-main">
            {isUser ? (
              <>
                <div className="mgr-my-roster-strip">
                  <span className="mgr-strip-lbl">Your roster ({userRoster.length}/{p.config.rosterSize})</span>
                  <div className="mgr-chip-row">
                    {userRoster.map(i=>{const pl=p.players[i];return <span key={i} className={`mgr-chip mgr-chip-${pl.bucket}`}>{pl.playerName}<span className="mgr-chip-pos">{pl.bucket}</span></span>;})}
                    {userRoster.length===0&&<span className="mgr-empty">No picks yet</span>}
                  </div>
                  {mustPick&&<div className="mgr-must-alert">Must fill: <strong>{needed.join(" or ")}</strong></div>}
                </div>

                <div className="mgr-filter-bar">
                  <div className="mgr-filter-pills">
                    {["all","G","W","B"].map(b=>(
                      <button key={b}
                        className={`mgr-pill${filter===b?" mgr-pill--on":""}${mustPick&&b!=="all"&&!needed.includes(b as Bkt)?" mgr-pill--dim":""}`}
                        onClick={()=>setFilter(b)}
                      >
                        {b==="all"?"All Positions":b==="G"?"Guards":b==="W"?"Wings":"Bigs"}
                      </button>
                    ))}
                  </div>
                  <span className="mgr-avail-count">{eligible.length} available</span>
                </div>

                <div className="mgr-player-board">
                  <div className="mgr-board-header">
                    <span>Player</span>
                    <span>NBA Team</span>
                    <span>Pos</span>
                  </div>
                  {eligible.map(pl=>(
                    <button key={pl.playerIdx} className={`mgr-player-row mgr-player-row--${pl.bucket}`}
                      onClick={()=>recordPick(pickIdx,pl.playerIdx,draftSlots)}>
                      <span className="mgr-player-name">{pl.playerName}</span>
                      <span className="mgr-player-team">{pl.teamAbbr}</span>
                      <span className={`mgr-pos-badge mgr-pos-badge--${pl.bucket}`}>{pl.bucket}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="mgr-ai-card">
                <div className="mgr-ai-dots-lg"><span/><span/><span/></div>
                <p className="mgr-ai-label">{slot.team} is evaluating the board</p>
                <p className="mgr-ai-sub">AI picks in ~0.15s</p>
              </div>
            )}
          </div>

          <aside className="mgr-draft-side">
            <div className="mgr-log-header">Recent Picks</div>
            <div className="mgr-log-body">
              {recent.map(pk=>(
                <div key={pk.overallPick} className={`mgr-log-row${pk.isUser?" mgr-log-row--you":""}`}>
                  <span className="mgr-log-pick">#{pk.overallPick}</span>
                  <span className="mgr-log-team">{pk.team}</span>
                  <span className="mgr-log-name">{pk.playerName}</span>
                  <span className={`mgr-pos-badge mgr-pos-badge--${pk.bucket}`}>{pk.bucket}</span>
                </div>
              ))}
              {log.length===0&&<p className="mgr-empty">Draft starting...</p>}
            </div>
          </aside>
        </div>
      </div>
    );
  }
  if(phase==="season"&&seasonData){
    return(
      <div className="mgr-page">
        <SeasonView
          pack={pack!} userTeam={userTeam} rosters={rosters}
          seasonData={seasonData} stats={stats} bpmZ={bpmZ}
          activeTab={seasonTab} onTabChange={setSeasonTab}
        />
      </div>
    );
  }
  return(
    <div className="mgr-page">
      <CompleteView
        pack={pack!} userTeam={userTeam} rosters={rosters} log={log}
        onStartSeason={startSeason} seasonErr={seasonErr}
      />
    </div>
  );
}

function SelectView({pack,userTeam,setUserTeam,onStart}:{pack:DraftPack;userTeam:string;setUserTeam:(t:string)=>void;onStart:()=>void}) {
  const sorted=[...pack.teams].sort();
  return(
    <div className="mgr-select">
      <section className="mgr-select-hero">
        <p className="mgr-eyebrow">Odds Gods</p>
        <h1 className="mgr-title">Manager Mode</h1>
        <p className="mgr-subtitle">
          Snake draft &middot; {pack.config.nTeams} teams &middot; {pack.config.nRounds} rounds &middot; {pack.season}
        </p>
        <div className="mgr-rules-row">
          <span className="mgr-rule-badge">Start 5: {pack.config.reqGuards}G + {pack.config.reqWings}W + {pack.config.reqBigs}B</span>
          <span className="mgr-rule-badge">Bench 3: unrestricted</span>
        </div>
      </section>

      <section className="mgr-select-body">
        <p className="mgr-section-eyebrow">Choose your franchise</p>
        <div className="mgr-team-grid">
          {sorted.map(t=>(
            <button key={t}
              className={`mgr-team-tile${userTeam===t?" mgr-team-tile--selected":""}`}
              onClick={()=>setUserTeam(t)}
            >
              {t}
            </button>
          ))}
        </div>
        {userTeam&&(
          <div className="mgr-start-bar">
            <span className="mgr-managing-label">Managing: <strong>{userTeam}</strong></span>
            <button className="mgr-start-btn" onClick={onStart}>Start Draft &rarr;</button>
          </div>
        )}
      </section>
    </div>
  );
}

function CompleteView({pack,userTeam,rosters:_r,log,onStartSeason,seasonErr}:{pack:DraftPack;userTeam:string;rosters:Record<string,number[]>;log:PickRecord[];onStartSeason:()=>void;seasonErr:string|null}) {
  const [showAll,setShowAll]=useState(false);
  const req=getReq(pack.config);
  const userPicks=log.filter(p=>p.team===userTeam).sort((a,b)=>a.overallPick-b.overallPick);
  return(
    <div className="mgr-complete">
      <section className="mgr-select-hero">
        <p className="mgr-eyebrow">Draft Complete</p>
        <h1 className="mgr-title">{userTeam} &mdash; {pack.season}</h1>
        <p className="mgr-subtitle">Your {pack.config.rosterSize}-player roster is locked in.</p>
        {seasonErr&&<p className="mgr-error" style={{marginTop:"0.5rem"}}>{seasonErr}</p>}
        <button className="mgr-start-btn" onClick={onStartSeason} style={{marginTop:"1rem"}}>
          Simulate Season &rarr;
        </button>
      </section>

      <section className="mgr-complete-body">
        <h3 className="mgr-section-eyebrow">Your Roster</h3>
        <div className="mgr-roster-card">
          <table className="mgr-roster-table">
            <thead>
              <tr>
                <th>Rd</th><th>Pick</th><th className="mgr-th-left">Player</th>
                <th>NBA Team</th><th>Pos</th><th>Slot</th>
              </tr>
            </thead>
            <tbody>{(()=>{
              const c:Req={G:0,W:0,B:0};
              return userPicks.map(pk=>{
                const b=pk.bucket as Bkt;
                const isStart=c[b]<req[b]; c[b]++;
                return(
                  <tr key={pk.overallPick} className={isStart?"mgr-tr-start":""}>
                    <td className="mgr-td-dim">{pk.round}</td>
                    <td className="mgr-td-dim">#{pk.overallPick}</td>
                    <td className="mgr-th-left mgr-td-name">{pk.playerName}</td>
                    <td className="mgr-td-dim">{pk.teamAbbr}</td>
                    <td><span className={`mgr-pos-badge mgr-pos-badge--${pk.bucket}`}>{pk.bucket}</span></td>
                    <td className={isStart?"mgr-slot-start":"mgr-slot-bench"}>{isStart?"Start":"Bench"}</td>
                  </tr>
                );
              });
            })()}</tbody>
          </table>
        </div>

        <button className="mgr-toggle-btn" onClick={()=>setShowAll(!showAll)}>
          {showAll?"Hide all rosters":"Show all 30 rosters"}
        </button>
        {showAll&&(
          <div className="mgr-all-grid">
            {[...pack.teams].sort().map(team=>{
              const tPicks=log.filter(p=>p.team===team).sort((a,b)=>a.overallPick-b.overallPick);
              return(
                <div key={team} className={`mgr-team-card${team===userTeam?" mgr-team-card--you":""}`}>
                  <div className="mgr-team-card-hdr">{team}{team===userTeam?" (You)":""}</div>
                  <div className="mgr-chip-row">
                    {tPicks.map(pk=><span key={pk.overallPick} className={`mgr-chip mgr-chip-${pk.bucket}`}>{pk.playerName}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function SeasonView({pack:_pack,userTeam,rosters:_r,seasonData,stats,bpmZ,activeTab,onTabChange}:{
  pack:DraftPack;userTeam:string;rosters:Record<string,number[]>;
  seasonData:SeasonData;stats:Record<string,TeamStat>;bpmZ:Record<string,number>;
  activeTab:"standings"|"schedule";onTabChange:(t:"standings"|"schedule")=>void;
}) {
  const userStat=stats[userTeam];
  const myBpmZ=bpmZ[userTeam];
  return(
    <div className="mgr-season">
      <section className="mgr-season-hero">
        <p className="mgr-eyebrow">Manager Mode &mdash; Season Simulation</p>
        <h1 className="mgr-title">{userTeam}</h1>
        <div className="mgr-season-stats-row">
            <span className="mgr-stat-badge">Lineup BPM-Z: {myBpmZ!=null?(myBpmZ>=0?"+":"")+myBpmZ.toFixed(2):"—"}</span>
        </div>
      </section>

      <div className="mgr-season-tabs">
        <button className={`mgr-stab${activeTab==="standings"?" mgr-stab--on":""}`} onClick={()=>onTabChange("standings")}>Standings</button>
        <button className={`mgr-stab${activeTab==="schedule"?" mgr-stab--on":""}`} onClick={()=>onTabChange("schedule")}>Schedule</button>
      </div>

      {activeTab==="standings"&&<StandingsPanel seasonData={seasonData} stats={stats} userTeam={userTeam}/>}
      {activeTab==="schedule"&&<SchedulePanel seasonData={seasonData} userTeam={userTeam} bpmZ={bpmZ}/>}
    </div>
  );
}

function StandingsPanel({seasonData,stats:_s,userTeam}:{seasonData:SeasonData;stats:Record<string,TeamStat>;userTeam:string}){
  const allTeams=[...new Set(seasonData.regular_season.flatMap(g=>[g.t1,g.t2]))];
  function confTable(conf:Set<string>,label:string){
    const teams=allTeams.filter(t=>conf.has(t)).sort();
    if(!teams.length) return null;
    return(
      <div className="mgr-conf-block">
        <div className="mgr-conf-label">{label}</div>
        <table className="mgr-standings-table">
          <thead><tr>
            <th className="mgr-th-left">Team</th>
            <th>Proj W</th><th>PO%</th><th>Champ%</th>
          </tr></thead>
          <tbody>{teams.map(t=>{
            const isUser=t===userTeam;
            return(
              <tr key={t} className={isUser?"mgr-tr-you":""}>
                <td className="mgr-th-left mgr-td-name">{isUser?"▶ ":""}{t}</td>
                <td className="mgr-td-num mgr-po-lo">—</td>
                <td className="mgr-td-num mgr-po-lo">—</td>
                <td className="mgr-td-num mgr-po-lo">—</td>
              </tr>
            );
          })}</tbody>
        </table>
      </div>
    );
  }
  return(
    <div className="mgr-standings-wrap">
      {confTable(EAST,"Eastern Conference")}
      {confTable(WEST,"Western Conference")}
      <p className="mgr-standings-note">Season projections coming soon.</p>
    </div>
  );
}

function SchedulePanel({seasonData,userTeam,bpmZ}:{seasonData:SeasonData;userTeam:string;bpmZ:Record<string,number>}){
  const byDate:Record<string,SeasonGame[]>={};
  for(const g of seasonData.regular_season){
    if(!byDate[g.date])byDate[g.date]=[];
    byDate[g.date].push(g);
  }
  const dates=Object.keys(byDate).sort();
  if(!dates.length)return <div className="mgr-schedule-wrap"><p className="mgr-empty">No schedule data.</p></div>;
  return(
    <div className="mgr-schedule-wrap">
      {dates.map(d=>{
        const dayGames=byDate[d].slice().sort((a,b)=>a.gid-b.gid);
        const label=new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"});
        return(
          <div key={d} className="mgr-sched-day">
            <div className="mgr-sched-date">{label} <span className="mgr-sched-ngames">{dayGames.length}G</span></div>
            <div className="mgr-sched-grid">
              {dayGames.map(g=>{
                const bDiff=(bpmZ[g.t1]??0)-(bpmZ[g.t2]??0);
                const p1=interpWP(g.wp,bDiff);
                const p2=1-p1;
                const isUserGame=g.t1===userTeam||g.t2===userTeam;
                const userIsT1=g.t1===userTeam;
                return(
                  <div key={g.gid} className={`mgr-matchup${isUserGame?" mgr-matchup--you":""}`}>
                    <span className={`mgr-mu-team${userIsT1?" mgr-mu-team--you":""}`}>{g.t1}</span>
                    <span className="mgr-mu-prob">{(p1*100).toFixed(0)}%</span>
                    <span className="mgr-mu-vs">vs</span>
                    <span className="mgr-mu-prob">{(p2*100).toFixed(0)}%</span>
                    <span className={`mgr-mu-team${!userIsT1&&g.t2===userTeam?" mgr-mu-team--you":""}`}>{g.t2}{g.loc===1?<span className="mgr-mu-home"> H</span>:null}</span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
