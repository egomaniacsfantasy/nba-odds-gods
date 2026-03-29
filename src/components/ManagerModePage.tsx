import { useState, useEffect, useRef, useCallback } from "react";

const BUCKETS = ["G","W","B"] as const;
type Bkt = typeof BUCKETS[number];
interface DraftConfig { nTeams:number; rosterSize:number; nRounds:number; reqGuards:number; reqWings:number; reqBigs:number; sigmaNoise:number; }
interface Player { playerIdx:number; playerId:number; playerName:string; teamAbbr:string; bucket:string; }
interface DraftPack { season:string; config:DraftConfig; players:Player[]; teams:string[]; aiValuations:Record<string,number[]>; }
interface DraftSlot { round:number; pickInRound:number; overallPick:number; team:string; }
interface Req { G:number; W:number; B:number; }
interface PickRecord { overallPick:number; round:number; team:string; playerIdx:number; playerName:string; teamAbbr:string; bucket:string; isUser:boolean; }
type Phase = "loading"|"select"|"draft"|"complete";

function shuffle<T>(arr: T[]): T[] {
  const a=[...arr];
  for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}
  return a;
}
function buildSlots(teams:string[],nRounds:number):DraftSlot[] {
  const slots:DraftSlot[]=[];
  for(let r=1;r<=nRounds;r++){
    const order=r%2===1?teams:[...teams].reverse();
    order.forEach((team,i)=>slots.push({round:r,pickInRound:i+1,overallPick:(r-1)*teams.length+i+1,team}));
  }
  return slots;
}
function getReq(c:DraftConfig):Req { return {G:c.reqGuards,W:c.reqWings,B:c.reqBigs}; }
function neededBuckets(filled:Req,req:Req):Bkt[] { return BUCKETS.filter(b=>filled[b]<req[b]); }
function unfilledCount(filled:Req,req:Req):number { return BUCKETS.reduce((s,b)=>s+Math.max(0,req[b]-filled[b]),0); }
function scarcityPrem(bkt:Bkt,avail:Set<number>,players:Player[],reqs:Record<string,Req>,teams:string[],req:Req,sigma:number):number {
  const nA=[...avail].filter(i=>players[i]?.bucket===bkt).length;
  const nN=teams.filter(t=>(reqs[t]?.[bkt]??0)<req[bkt]).length;
  if(!nN) return 0;
  return Math.max(0,1-nA/nN/2)*sigma*0.5;
}
function aiPickPlayer(team:string,slot:DraftSlot,pack:DraftPack,slots:DraftSlot[],avail:Set<number>,reqs:Record<string,Req>):number {
  const req=getReq(pack.config);
  const filled=reqs[team]??{G:0,W:0,B:0};
  const needed=neededBuckets(filled,req);
  const pLeft=slots.filter(s=>s.team===team&&s.overallPick>=slot.overallPick).length;
  let eligible=[...avail];
  if(pLeft<=unfilledCount(filled,req)&&needed.length>0){
    const r=eligible.filter(i=>needed.includes(pack.players[i]?.bucket as Bkt));
    if(r.length>0) eligible=r;
  }
  const vals=pack.aiValuations[team]??[];
  let best=eligible[0]??0,bestV=-Infinity;
  for(const i of eligible){
    let v=vals[i]??0;
    const b=pack.players[i]?.bucket as Bkt;
    if(b&&needed.includes(b)) v+=scarcityPrem(b,avail,pack.players,reqs,pack.teams,req,pack.config.sigmaNoise);
    if(v>bestV){bestV=v;best=i;}
  }
  return best;
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

  if(phase==="loading") return(
    <div className="mgr-page">
      <div className="mgr-loading">
        {fetchErr
          ?<><p className="mgr-error">{fetchErr}</p><p className="mgr-hint">Run manager_mode.py CELL 2 to generate the draft pack.</p></>
          :<p className="mgr-hint">Loading draft pack...</p>}
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
    const recent=[...log].reverse().slice(0,20);
    const total=p.config.nTeams*p.config.nRounds;
    return(
      <div className="mgr-page mgr-page--draft">
      <div className="mgr-draft">
        <div className="mgr-draft-hdr">
          <span className="mgr-rnd-badge">Round {slot.round}</span>
          <span className="mgr-pick-info">Pick #{slot.overallPick} / {total}</span>
          {isUser?<span className="mgr-user-turn">YOUR PICK - {userTeam}</span>:<span className="mgr-ai-turn">{slot.team} picking...</span>}
        </div>
        <div className="mgr-draft-body">
          <div className="mgr-draft-main">
            {isUser?(
              <>
                <div className="mgr-cur-roster">
                  <span className="mgr-lbl">Your roster ({rosters[userTeam]?.length??0} / {p.config.rosterSize})</span>
                  <div className="mgr-chips">
                    {(rosters[userTeam]??[]).map(i=>{const pl=p.players[i];return <span key={i} className={`mgr-chip mgr-chip-${pl.bucket}`}>{pl.playerName} ({pl.bucket})</span>;})}
                    {(rosters[userTeam]??[]).length===0&&<span className="mgr-dim">none yet</span>}
                  </div>
                  {mustPick&&<div className="mgr-must-pick">Must pick: {needed.join(" or ")}</div>}
                </div>
                <div className="mgr-filter-row">
                  {["all","G","W","B"].map(b=>(
                    <button key={b} className={`mgr-fbtn${filter===b?" mgr-fbtn-on":""}${mustPick&&b!=="all"&&!needed.includes(b as Bkt)?" mgr-fbtn-dis":""}`} onClick={()=>setFilter(b)}>
                      {b==="all"?"All":b}
                    </button>
                  ))}
                  <span className="mgr-dim">{eligible.length} available</span>
                </div>
                <div className="mgr-player-list">
                  <div className="mgr-pl-hdr"><span>Player</span><span>NBA Team</span><span>Pos</span></div>
                  {eligible.map(pl=>(
                    <button key={pl.playerIdx} className={`mgr-pl-row mgr-pl-${pl.bucket}`} onClick={()=>recordPick(pickIdx,pl.playerIdx,draftSlots)}>
                      <span>{pl.playerName}</span>
                      <span className="mgr-dim">{pl.teamAbbr}</span>
                      <span className={`mgr-bkt mgr-bkt-${pl.bucket}`}>{pl.bucket}</span>
                    </button>
                  ))}

                </div>
              </>
            ):(
              <div className="mgr-ai-wait">
                <div className="mgr-dots"><span/><span/><span/></div>
                <p>{slot.team} is evaluating the board...</p>
              </div>
            )}
          </div>
          <div className="mgr-log">
            <p className="mgr-lbl" style={{marginBottom:"0.5rem"}}>Recent picks</p>
            {recent.map(pk=>(
              <div key={pk.overallPick} className={`mgr-log-row${pk.isUser?" mgr-log-u":""}`}>
                <span className="mgr-dim">#{pk.overallPick}</span>
                <span className="mgr-log-tm">{pk.team}</span>
                <span className="mgr-log-pl">{pk.playerName}</span>
                <span className={`mgr-bkt mgr-bkt-${pk.bucket}`}>{pk.bucket}</span>
              </div>
            ))}
            {log.length===0&&<p className="mgr-dim">Draft starting...</p>}
          </div>
        </div>
      </div>
      </div>
    );
  }
  return <div className="mgr-page"><CompleteView pack={pack!} userTeam={userTeam} rosters={rosters} log={log}/></div>;
}

function SelectView({pack,userTeam,setUserTeam,onStart}:{pack:DraftPack;userTeam:string;setUserTeam:(t:string)=>void;onStart:()=>void}) {
  const sorted=[...pack.teams].sort();
  return(
    <div className="mgr-select">
      <h2 className="mgr-page-title">Manager Mode - {pack.season}</h2>
      <p className="mgr-page-sub">Snake draft - {pack.config.nTeams} teams - {pack.config.rosterSize} rounds - Starting 5 must include {pack.config.reqGuards}G + {pack.config.reqWings}W + {pack.config.reqBigs}B</p>
      <p className="mgr-lbl" style={{marginBottom:"0.75rem"}}>Choose your franchise:</p>
      <div className="mgr-team-grid">
        {sorted.map(t=>(
          <button key={t} className={`mgr-team-btn${userTeam===t?" mgr-team-sel":""}`} onClick={()=>setUserTeam(t)}>{t}</button>
        ))}
      </div>
      {userTeam&&(
        <div className="mgr-start-row">
          <span>Managing: <strong>{userTeam}</strong></span>
          <button className="mgr-start-btn" onClick={onStart}>Start Draft</button>
        </div>
      )}
    </div>
  );
}

function CompleteView({pack,userTeam,rosters:_r,log}:{pack:DraftPack;userTeam:string;rosters:Record<string,number[]>;log:PickRecord[]}) {
  const [showAll,setShowAll]=useState(false);
  const req=getReq(pack.config);
  const userPicks=log.filter(p=>p.team===userTeam).sort((a,b)=>a.overallPick-b.overallPick);
  return(
    <div className="mgr-complete">
      <h2 className="mgr-page-title">Draft Complete - {pack.season}</h2>
      <div className="mgr-final-roster">
        <h3 className="mgr-section-ttl">Your Roster - {userTeam}</h3>
        <table className="data-table">
          <thead><tr><th>Rd</th><th>Pick</th><th className="left">Player</th><th>NBA Team</th><th>Pos</th><th>Slot</th></tr></thead>
          <tbody>{(()=>{
            const c:Req={G:0,W:0,B:0};
            return userPicks.map(pk=>{
              const b=pk.bucket as Bkt;
              const isStart=c[b]<req[b]; c[b]++;
              return(
                <tr key={pk.overallPick} className={isStart?"mgr-tr-start":""}>
                  <td>{pk.round}</td><td>#{pk.overallPick}</td>
                  <td className="left">{pk.playerName}</td>
                  <td>{pk.teamAbbr}</td>
                  <td><span className={`mgr-bkt mgr-bkt-${pk.bucket}`}>{pk.bucket}</span></td>
                  <td className={isStart?"mgr-start-slot":"mgr-bench-slot"}>{isStart?"Start":"Bench"}</td>
                </tr>
              );
            });
          })()}</tbody>
        </table>
      </div>
      <button className="mgr-toggle-btn" onClick={()=>setShowAll(!showAll)}>{showAll?"Hide":"Show"} all 30 rosters</button>
      {showAll&&(
        <div className="mgr-all-rosters">
          {[...pack.teams].sort().map(team=>{
            const tPicks=log.filter(p=>p.team===team).sort((a,b)=>a.overallPick-b.overallPick);
            return(
              <div key={team} className={`mgr-team-card${team===userTeam?" mgr-team-card-u":""}`}>
                <h4 className="mgr-team-card-hdr">{team}{team===userTeam?" (You)":""}</h4>
                <div className="mgr-chips">
                  {tPicks.map(pk=><span key={pk.overallPick} className={`mgr-chip mgr-chip-${pk.bucket}`}>{pk.playerName}</span>)}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
