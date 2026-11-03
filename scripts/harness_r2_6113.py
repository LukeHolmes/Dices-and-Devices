import json,random,sys,time,re,os,traceback
from playwright.sync_api import sync_playwright
OUT='/workspace/gb-playtest500/r2'
VPS={'phone_portrait':(390,844),'phone_small':(360,640),'phone_landscape':(844,390),'tablet_portrait':(768,1024),'tablet_landscape':(1024,768),'laptop':(1366,768),'desktop':(1280,800),'desktop_fhd':(1920,1080)}
SCAN=r"""()=>{
 document.querySelectorAll('[data-pt]').forEach(e=>e.removeAttribute('data-pt'));
 const W=innerWidth,H=innerHeight;const out=[];let i=0;const clipped=[];
 for(const b of document.querySelectorAll('button,[role=button]')){
  if(b.disabled||!b.getClientRects().length)continue;const cs=getComputedStyle(b);if(cs.visibility=='hidden'||cs.pointerEvents=='none'||+cs.opacity==0)continue;
  const r=b.getBoundingClientRect();if(r.width<2||r.height<2)continue;
  const t=(b.innerText||b.getAttribute('aria-label')||'').trim().replace(/\s+/g,' ').slice(0,80);
  const cx=r.x+r.width/2,cy=r.y+r.height/2;
  const off=(r.left< -1||r.top< -1||r.right>W+1||r.bottom>H+1);
  if(off) clipped.push({t,r:[r.x|0,r.y|0,r.width|0,r.height|0]});
  if(cx<0||cy<0||cx>W||cy>H)continue;
  const e=document.elementFromPoint(cx,cy);if(!(e&&(b===e||b.contains(e))))continue;
  b.setAttribute('data-pt',i);out.push({i,t,x:cx,y:cy,lk:b.getAttribute('data-layout-key')||''});i++;}

 const tiny=[];for(const o of out){const b=document.querySelector('[data-pt="'+o.i+'"]');const r=b.getBoundingClientRect();if(r.width<32||r.height<32)tiny.push({t:o.t.slice(0,30),w:r.width|0,h:r.height|0});}
 const small=[];let minfs=99;const tw=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let n,c=0;
 while((n=tw.nextNode())&&c<3000){c++;const tx=n.textContent.trim();if(tx.length<2)continue;const p=n.parentElement;if(!p||!p.getClientRects().length)continue;const r=p.getBoundingClientRect();if(r.bottom<0||r.top>H||r.right<0||r.left>W||r.width<1)continue;const cs=getComputedStyle(p);if(cs.visibility=='hidden'||+cs.opacity==0)continue;
   const sc=p.offsetWidth?r.width/p.offsetWidth:1;const fs=parseFloat(cs.fontSize)*sc;if(fs<minfs)minfs=fs;if(fs<11&&small.length<4)small.push({t:tx.slice(0,25),fs:+fs.toFixed(1)});}
 let scl=null;const sh=document.querySelector('[data-layout-key*="shop"]');if(sh&&sh.offsetWidth){scl=+(sh.getBoundingClientRect().width/sh.offsetWidth).toFixed(2);}
 const de=document.documentElement;
 const lk=[];for(const e of document.querySelectorAll('[data-layout-key]')){if(!e.getClientRects().length)continue;const r=e.getBoundingClientRect();if(r.width<2)continue;
   if(r.bottom>H+2||r.right>W+2||r.top< -2||r.left< -2) lk.push({k:e.getAttribute('data-layout-key'),r:[r.x|0,r.y|0,r.width|0,r.height|0]});
   if(e.scrollHeight>e.clientHeight+4 && ['auto','scroll'].includes(getComputedStyle(e).overflowY)) lk.push({k:e.getAttribute('data-layout-key'),inner_scroll:[e.scrollHeight,e.clientHeight]});}
 const txt=(document.body.innerText||'');
 const bad=(txt.match(/(NaN|undefined|Infinity|\[object Object\])/g)||[]).slice(0,5);
 const neg=(txt.match(/-\$\d+|\$-\d+/g)||[]).slice(0,3);
 return {tiny,small,minfs,scl,btn:out,clipped,lk,docScroll:[de.scrollHeight,H,de.scrollWidth,W,document.body.scrollHeight,scrollY],bad,neg,st:window.__GB_E2E__?window.__GB_E2E__.getState():null,txt:txt.slice(0,300)};}"""
def num(t):
  m=re.findall(r'(\d+)\s*$',t); return int(m[0]) if m else None
def run_one(br,rid,strategy,vpname,seed,shots_budget):
  rng=random.Random(seed);W,H=VPS[vpname]
  mobile=W<700 or H<500
  ctx=br.new_context(viewport={'width':W,'height':H},has_touch=mobile,is_mobile=mobile)
  pg=ctx.new_page();log={'rid':rid,'strategy':strategy,'viewport':vpname,'seed':seed,'errors':[],'console':[],'issues':[],'phases':{},'steps':0,'clicks':0,'maxRound':1,'gold_series':[],'cats':{},'buys':0,'routes':[]}
  pg.on('pageerror',lambda e: log['errors'].append(str(e)[:300]))
  pg.on('console',lambda m: m.type=='error' and log['console'].append(m.text[:300]))
  t0=time.time();cur={}
  def issue(kind,detail,shot=True):
    key=kind+'|'+re.sub(r'\d+','#',str(detail))[:90]
    for x in log['issues']:
      if x['key']==key: x['n']=x.get('n',1)+1;return
    d={'key':key,'kind':kind,'detail':detail,'step':log['steps'],'phase':cur.get('phase'),'round':cur.get('round')}
    if shot and shots_budget[0]>0:
      fn=f"shots/r{rid:03d}_{kind}_{log['steps']}.png"
      try: pg.screenshot(path=f"{OUT}/{fn}");d['shot']=fn;shots_budget[0]-=1
      except: pass
    log['issues'].append(d)
  try:
    pg.goto('http://localhost:8763/index.html?e2e=1',wait_until='domcontentloaded');pg.wait_for_function("window.__GB_E2E__&&document.querySelectorAll('button').length>2",timeout=45000)
    log['load_s']=round(time.time()-t0,1)
    stuck=0;lastsig=None;started=False;ended=None;nobtn=0;endseen=0;lastph=None
    for step in range(1200):
      log['steps']=step
      if time.time()-t0>270: issue('timeout_run','run exceeded 5.5 min (harness cap)',False);break
      s=pg.evaluate(SCAN);st=s['st'] or {};cur=st;ph=st.get('phase','?')
      log['phases'][ph]=log['phases'].get(ph,0)+1
      if ph!=lastph: log.setdefault('phase_seq',[]).append(f"{ph}@r{st.get('round')}");lastph=ph
      ds=s['docScroll']
      if ds[0]>ds[1]+1 or ds[2]>ds[3]+1 or ds[5]>0: issue('page_scroll',f"{ph} doc scrollH={ds[0]} vh={ds[1]} scrollW={ds[2]} vw={ds[3]} scrollY={ds[5]}")
      for c in s['clipped'][:3]: issue('clipped_button',f"{ph}: '{c['t'][:40]}' rect {c['r']} vp {W}x{H}")
      for c in s['lk'][:4]: issue('layout_out_of_bounds',f"{ph}: {c} vp {W}x{H}")
      for x in s['bad']: issue('impossible_text',f"{ph}: '{x}' in UI text")
      for c in s.get('tiny',[])[:2]: issue('small_tap_target',f"{ph}: '{c['t']}' {c['w']}x{c['h']} vp {W}x{H}")
      for c in s.get('small',[])[:2]: issue('small_text',f"{ph}: '{c['t']}' {c['fs']}px vp {W}x{H}")
      if s.get('scl') and s['scl']<0.6: issue('shop_scale_low',f"{ph}: scale {s['scl']} vp {W}x{H}")
      for x in s['neg']: issue('negative_money',f"{ph}: {x}")
      if st:
        for k in ('score','gold','hands','target','round'):
          v=st.get(k)
          if v is None or (isinstance(v,(int,float)) and (v!=v or v<0)): issue('impossible_state',f"{k}={v} in {ph}")
        if started and step%3==0: log['gold_series'].append([st.get('round'),st.get('gold'),st.get('score'),st.get('target')])
        if st.get('round',1)>log['maxRound']: log['maxRound']=st['round']
      if ph=='PLAY': started=True
      if started and step%5==0:
        try:
          sv=pg.evaluate("localStorage.getItem('gutterbones1977:run:v1')")
          if sv:
            log['_last_save']=sv
            if ph=='SHOP':
              j=json.loads(sv);k2=(j.get('round'),tuple(x.get('id') for x in (j.get('shopItems') or [])))
              if k2 not in [tuple(x) for x in log.setdefault('shop_offers',[])]: log['shop_offers'].append([k2[0],list(k2[1])])
        except: pass
      sc=st.get('score');
      if isinstance(sc,(int,float)):
        d=sc-log.get('_lastscore',0)
        if d>log.get('maxHand',0): log['maxHand']=d; log['maxHand_round']=st.get('round')
        log['_lastscore']=sc
      if started and ph in('VICTORY','RAP_SHEET'):
        ended=ph;endseen+=1
        if endseen>8: break
      btn=s['btn'];names=[b['t'] for b in btn]
      sig=(ph,st.get('score'),st.get('gold'),st.get('hands'),st.get('round'),st.get('selectedShopPathId'),st.get('roundClearVisible'),tuple(names))
      stuck=stuck+1 if sig==lastsig else 0;lastsig=sig
      nobtn=nobtn+1 if not btn else 0
      if nobtn==15:
        hid=pg.evaluate("[...document.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length).map(b=>{const r=b.getBoundingClientRect();const e=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return [b.innerText.trim().slice(0,30),r.x|0,r.y|0,r.width|0,r.height|0,e?(e.className||e.tagName).toString().slice(0,80):null]}).filter(x=>/CLOSE|BACK|CONTINUE|DONE/i.test(x[0]))")
        if hid: issue('occluded_control',f"{ph}: visible control(s) blocked by another element at their centre: {hid[:3]}")
        pg.keyboard.press('Escape')
        for h in hid[:1]:
          try: pg.mouse.click(h[1]+h[3]-6,h[2]+6)
          except: pass
      if nobtn>=40: issue('softlock_no_buttons',f"{ph}: no clickable control for ~{nobtn} polls; text='{s['txt'][:150]}'");break
      pr=(ph,st.get('round'));
      if pr==log.get('_pr'): log['_dw']=log.get('_dw',0)+1
      else: log['_pr']=pr;log['_dw']=0
      if log['_dw'] in(80,110,140) and ph in('SHOP','CARVING','GAMBLE'):
        fb=pg.evaluate("(()=>{const e=window.__GB_E2E__;const s=e.getState();if(s.phase==='GAMBLE'){e.takeSafeCut();return 'takeSafeCut'}e.hitStreets();return 'hitStreets'})()")
        issue('api_fallback_needed',f"{ph}: bot spent {log['_dw']} actions in {ph} without leaving via UI; used __GB_E2E__.{fb}(). Last buttons={names[:8]}")
        log['fallbacks']=log.get('fallbacks',0)+1
      if log['_dw']>200: issue('softlock_no_progress',f"{ph}: >200 actions in phase");break
      if stuck in(12,20,28) or nobtn in(20,30):
        lvl=log.setdefault('_rec',0);log['_rec']=lvl+1
        pg.keyboard.press('Escape')
        hk=[b for b in btn if b['t'].upper() in('HIDE','CLOSE','RESUME HUSTLE','COPY THAT','GOT IT')]
        if hk: pg.mouse.click(hk[0]['x'],hk[0]['y'])
        if stuck>=20 or nobtn>=30:
          fb=pg.evaluate("(()=>{const e=window.__GB_E2E__;const s=e.getState();if(s.phase==='SHOP'){if(!s.selectedShopPathId)e.selectRoute&&0;e.hitStreets();return 'hitStreets'}if(s.roundClearVisible){e.finishRoundClear();return 'finishRoundClear'}e.dismissOverlays();return 'dismissOverlays'})()")
          issue('api_fallback_needed',f"{ph}: bot could not progress via UI after {stuck} identical actions; used __GB_E2E__.{fb}(). Last buttons={names[:8]}")
          log['fallbacks']=log.get('fallbacks',0)+1
          if log['fallbacks']>6: issue('softlock_no_progress',f"{ph}: >6 fallbacks needed");break
      if stuck>=40: issue('softlock_no_progress',f"{ph}: same state for 40 actions; buttons={names[:12]}");break
      pick=choose(btn,ph,strategy,rng,st,log)
      if pick is None: pg.wait_for_timeout(300);continue
      b=btn[pick]
      if ph=='PLAY' and ' LV' in b['t']:
        c=b['t'].split(' LV')[0];log['cats'][c]=log['cats'].get(c,0)+1
      if ph=='SHOP' and '$' in b['t']: log['buys']+=1
      try:
        if mobile: pg.touchscreen.tap(b['x'],b['y'])
        else: pg.mouse.click(b['x'],b['y'])
        log['clicks']+=1
        if strategy=='rapid':
          for _ in range(rng.randint(1,4)):
            if mobile: pg.touchscreen.tap(b['x'],b['y'])
            else: pg.mouse.click(b['x'],b['y'])
      except Exception as e: issue('click_fail',str(e)[:100],False)
      pg.wait_for_timeout({'rapid':40,'random':200,'greedy':280,'edge':120}[strategy])
    st=pg.evaluate("window.__GB_E2E__?window.__GB_E2E__.getState():null") or {}
    log['final']=st
    log['outcome']=('WIN' if st.get('phase')=='VICTORY' else 'BUST' if st.get('phase')=='RAP_SHEET' else 'INCOMPLETE:'+str(st.get('phase')))
    if log['outcome'].startswith('INCOMPLETE') and not any(i['kind'].startswith('softlock') or i['kind']=='timeout_run' for i in log['issues']): issue('incomplete',str(st))
    try:
      log['end_text']=pg.evaluate("document.body.innerText.slice(0,1200)")
      if ended and shots_budget[0]>-50 and rid%40==0: pg.screenshot(path=f"{OUT}/shots/r{rid:03d}_end_{ended}.png")
    except: pass
  except Exception as e:
    log['harness_error']=traceback.format_exc()[-600:];log['outcome']='HARNESS_ERROR'
  log['dur_s']=round(time.time()-t0,1)
  for k in ('_shopclicks','_paytab','_lastscore','_rec','_pr','_dw'): log.pop(k,None)
  sv=log.pop('_last_save',None)
  if sv:
    try:
      j=json.loads(sv);log['loadout']={k:j.get(k) for k in ('inventory','handLevels','consumables','blueprints','routeModifiers','personaId','flowStreak','gold','debt','round','synergyState','runStats','runModifierIds') if k in j}
      log['loadout']['inventory']=[x.get('id') for x in (j.get('inventory') or [])]
      log['loadout']['faces']=[f.get('id') for d in (j.get('dice') or []) for f in (d.get('faces') or []) if f.get('id')!='standard']
      log['loadout']['history_len']=len(j.get('history') or [])
      log['history']=(j.get('history') or [])[-40:]
      log['save_keys']=list(j.keys())
    except Exception as e: log['loadout_err']=str(e)
  ctx.close();return log

def choose(btn,ph,strategy,rng,st,log):
  names=[b['t'] for b in btn];U=[n.upper() for n in names]
  def find(*prefs,contains=False):
    for p in prefs:
      for k,n in enumerate(U):
        if (p in n) if contains else n.startswith(p): return k
    return None
  if not btn: return None
  k=find('TAP TO CONTINUE','SKIP — STRAIGHT','CLEARED',contains=True)
  if k is not None: return k
  BAD=('FORFEIT','EXIT TO','ABANDON','TITLE','SYSTEM','QUIT','MAIN MENU','RESET','DELETE','WIPE')
  if not (strategy=='edge' and rng.random()<0.02):
    keep=[b for b in btn if not any(w in b['t'].upper() for w in BAD)]
    if keep and len(keep)<len(btn):
      idx=[btn.index(b) for b in keep];sub=choose_inner(keep,ph,strategy,rng,st,log)
      return None if sub is None else idx[sub]
  return choose_inner(btn,ph,strategy,rng,st,log)
def choose_inner(btn,ph,strategy,rng,st,log):
  names=[b['t'] for b in btn];U=[n.upper() for n in names]
  def find(*prefs,contains=False):
    for p in prefs:
      for k,n in enumerate(U):
        if (p in n) if contains else n.startswith(p): return k
    return None
  if ph=='TITLE': return find('PLAY')
  if ph=='LINEUP':
    if strategy=='edge' and rng.random()<0.25:
      c=[k for k,n in enumerate(U) if 'N.Y.P.D.' in n]
      if c: return rng.choice(c)
    return find('NEW RUN')
  if ph in('RAP_SHEET','VICTORY'): return None
  k=find('CONTINUE','NEXT','GOT IT','DISMISS')
  if k is not None and ph!='SHOP': return k
  if ph=='PLAY':
    cats=[k for k,b in enumerate(btn) if ' LV' in b['t']]
    roll=find("ROLL")
    dice=[k for k,n in enumerate(names) if n.startswith('Bone slot')]
    if cats:
      vals=[((num(btn[k]['t']) or 0) if 'BUST' not in U[k] else -1,k) for k in cats]
      best=max(vals)
      log['_paytab']=0
      if strategy=='random':
        r=rng.random()
        if r<0.25 and roll is not None: return roll
        if r<0.4 and dice: return rng.choice(dice)
        return rng.choice(cats)
      if strategy=='rapid': return rng.choice(cats+([roll] if roll is not None else []))
      if strategy=='edge':
        if dice and rng.random()<0.3: return rng.choice(dice)
        if rng.random()<0.25: return rng.choice(cats)
        if rng.random()<0.1: return rng.randrange(len(btn))
      need=max(0,(st.get('target',0)-st.get('score',0)))/max(1,st.get('hands',1))
      if best[0]>=need*0.8 or roll is None: return best[1]
      return roll
    if roll is not None: return roll
    t=log.get('_paytab',0);log['_paytab']=t+1
    k=find('ALLEY' if t%2 else 'PAYOUTS')
    if k is not None: return k
    if strategy!='greedy' and rng.random()<0.1: return rng.randrange(len(btn))
    return None
  if ph=='SHOP':
    buys=[k for k,n in enumerate(U) if '$' in n and 'HIT' not in n]
    hit=find('HIT THE STREETS',contains=True)
    routes=[k for k,n in enumerate(U) if 'NEXT QUOTA' in n]
    if routes and not st.get('selectedShopPathId') and log.get('_shopclicks',0)%8>=3: return rng.choice(routes) if strategy!='greedy' else routes[0]
    cnt=log.get('_shopclicks',0);log['_shopclicks']=cnt+1
    if strategy=='greedy' and buys and cnt%8<4: return rng.choice(buys)
    if strategy!='greedy' and rng.random()<0.45: return rng.randrange(len(btn))
    if hit is not None and cnt%8>=4: return hit
    if buys and rng.random()<0.4: return rng.choice(buys)
    return hit if hit is not None else rng.randrange(len(btn))
  if ph=='GAMBLE' and strategy=='greedy':
    k=find('TAKE','SAFE',contains=True)
    return k if k is not None else rng.randrange(len(btn))
  if strategy=='greedy':
    k=find('TAKE','CONFIRM','DONE','LEAVE','SKIP','BACK',contains=True)
    if k is not None and rng.random()<0.6: return k
  return rng.randrange(len(btn))

if __name__=='__main__':
  ids=[int(x) for x in sys.argv[1].split(',')]
  strat=['random','greedy','edge','rapid'];vps=list(VPS)
  p=sync_playwright().start();br=p.chromium.launch()
  shots=[6]
  for n,rid in enumerate(ids):
    s=strat[rid%4];v=vps[(rid//4)%len(vps)]
    if n and n%15==0: br.close();br=p.chromium.launch()
    L=run_one(br,rid,s,v,rid*7919,shots)
    with open(f'{OUT}/runs/run_{rid:03d}.json','w') as f: json.dump(L,f,default=str)
    print(rid,s,v,L.get('outcome'),'r',L.get('maxRound'),'steps',L['steps'],'dur',L['dur_s'],'iss',[i['kind'] for i in L['issues']],'err',len(L['errors']),L.get('harness_error','')[-200:],flush=True)
