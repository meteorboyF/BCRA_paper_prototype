#!/usr/bin/env python3
"""V2 / Exp2 — function-level latency, sequential single client (concurrency=1).
High-resolution timer (perf_counter). For each operation does 120 sequential timed
calls; reports cold-JIT P50 (samples 1..100, no warm-up discarded) AND warmed P50
(samples 21..120, first 20 discarded) separately, plus mean/min/max/stdev.

Operations:
  checkaccess   GET  /api/documents/{DOC}/wrapped-key   (read; Fabric CheckAccess when enabled)
  registerdoc   POST /api/documents/upload (1KB ciphertext) (write; Fabric RegisterDocument)

Appends raw per-sample rows to results/exp2_latency.csv:
  experiment,operation,mode,method,sample_idx,latency_ms,http,platform

Env: JWT, CASE_ID, DOC_ID, MODE (fabric|db_only), METHOD (gateway|db_only),
     N_WARM (20), N_MEAS (100), WRITE_REPS (override write count, default 120)
"""
import os, sys, time, json, http.client, statistics, csv

JWT=os.environ.get("JWT",""); CASE=os.environ.get("CASE_ID",""); DOC=os.environ.get("DOC_ID","")
MODE=os.environ.get("MODE","fabric"); METHOD=os.environ.get("METHOD","gateway")
N_WARM=int(os.environ.get("N_WARM","20")); N_MEAS=int(os.environ.get("N_MEAS","100"))
REPO="/home/angkon/Pangochain_AOOP"; CSV=f"{REPO}/results/exp2_latency.csv"
if not (JWT and CASE and DOC):
    print("ERROR: set JWT, CASE_ID, DOC_ID", file=sys.stderr); sys.exit(1)

N_TOTAL = N_WARM + N_MEAS  # 120: enough for both cold(1..100) and warmed(21..120)
HDRS={"Authorization":f"Bearer {JWT}","Content-Type":"application/json"}
WRITE_BODY=json.dumps({"caseId":CASE,"fileName":"v2-bench.bin","ivBase64":"A"*16,
    "ciphertextBase64":"A"*1024,"documentHashSha256":"0"*64,"wrappedKeyTokenForOwner":"A"*125}).encode()

def call(op):
    conn=http.client.HTTPConnection("localhost",8080,timeout=60)
    t0=time.perf_counter()
    if op=="checkaccess":
        conn.request("GET",f"/api/documents/{DOC}/wrapped-key",headers={"Authorization":f"Bearer {JWT}"})
    else:
        conn.request("POST","/api/documents/upload",body=WRITE_BODY,
                     headers={**HDRS,"Content-Length":str(len(WRITE_BODY))})
    r=conn.getresponse(); r.read(); ms=(time.perf_counter()-t0)*1000.0; st=r.status; conn.close()
    return ms, st

def stats(v):
    return dict(n=len(v),mean=round(statistics.mean(v),3),p50=round(statistics.median(v),3),
                min=round(min(v),3),max=round(max(v),3),
                stdev=round(statistics.stdev(v),3) if len(v)>1 else 0.0)

new = not os.path.exists(CSV)
cf=open(CSV,"a",newline=""); w=csv.writer(cf)
if new: w.writerow(["experiment","operation","mode","method","sample_idx","latency_ms","http","platform"])

ops = os.environ.get("OPS","checkaccess,registerdoc").split(",")
print(f"=== V2 latency  mode={MODE} method={METHOD}  N_total={N_TOTAL} ===")
summary={}
for op in ops:
    reps = N_TOTAL
    print(f"--- {op} ({reps} sequential samples) ---")
    samples=[]; bad=0
    for i in range(1,reps+1):
        ms,st=call(op)
        ok = st in (200,201)
        if ok: samples.append(ms)
        else: bad+=1
        w.writerow(["exp2",op,MODE,METHOD,i,round(ms,3),st,"linux_x86_64"])
        if i%20==0 or not ok: print(f"  [{i}/{reps}] {ms:.2f}ms http={st}{' BAD' if not ok else ''}")
    cf.flush()
    if len(samples)>=N_MEAS+0:
        cold=samples[:N_MEAS]                 # 1..100, includes cold JIT
        warmed=samples[N_WARM:N_WARM+N_MEAS]  # 21..120, first 20 discarded
        summary[op]={"cold":stats(cold),"warmed":stats(warmed),"bad":bad}
        print(f"  {op}: COLD p50={summary[op]['cold']['p50']}ms  WARMED p50={summary[op]['warmed']['p50']}ms  bad={bad}")
    else:
        summary[op]={"error":f"only {len(samples)} good samples","bad":bad}
        print(f"  {op}: INSUFFICIENT samples ({len(samples)})")
cf.close()
# merge into summary json (keyed by mode)
SJ=f"{REPO}/results/exp2_latency.summary.json"
alls={}
if os.path.exists(SJ):
    try: alls=json.load(open(SJ))
    except: alls={}
alls[MODE]=summary
json.dump(alls,open(SJ,"w"),indent=2)
print(f"wrote {SJ} [{MODE}]")
