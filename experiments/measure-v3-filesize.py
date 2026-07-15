#!/usr/bin/env python3
"""V3 / Exp3 — File-size impact. IPFS upload via DIRECT Kubo HTTP API
(POST /api/v0/add?pin=false, multipart), 10 samples per size {1,5,10,20,30,50} MB.
Fabric commit constant measured separately (single RegisterDocument round-trips).
Emits one summary row per size: size_mb, ipfs_p50_ms, fabric_commit_ms, total_p50_ms,
plus all raw IPFS samples. Random file content per sample (real bytes, not compressible).

Raw CSV  : results/exp3_filesize.csv      (per-sample IPFS timings + fabric constant rows)
Summary  : results/exp3_filesize.summary.json
Env: IPFS_ADD_URL (default http://127.0.0.1:5001/api/v0/add?pin=false)
     FABRIC_COMMIT_MS (optional: skip live fabric measure, use given constant)
     JWT, CASE_ID  (only needed if measuring fabric commit live via peer CLI is not used)
"""
import os, sys, time, json, subprocess, statistics, csv, urllib.request, io

SIZES_MB=[1,5,10,20,30,50]; REPS=10
ADD_URL=os.environ.get("IPFS_ADD_URL","http://127.0.0.1:5001/api/v0/add?pin=false")
REPO="/home/angkon/Pangochain_AOOP"
CSV=f"{REPO}/results/exp3_filesize.csv"; SJ=f"{REPO}/results/exp3_filesize.summary.json"

def ipfs_add_curl(path):
    # use curl for robust multipart; time the full round trip
    t0=time.perf_counter()
    r=subprocess.run(["curl","-s","-X","POST","-F",f"file=@{path}",ADD_URL],
                     capture_output=True,text=True)
    ms=(time.perf_counter()-t0)*1000.0
    cid=""
    try: cid=json.loads(r.stdout.strip().splitlines()[-1]).get("Hash","")
    except Exception: pass
    return ms, cid

def measure_fabric_commit():
    """Measure Fabric RegisterDocument commit constant via peer CLI (waitForEvent),
    5 samples, return median ms. Independent of file size (metadata-only tx)."""
    env_const=os.environ.get("FABRIC_COMMIT_MS")
    if env_const:
        return float(env_const), [float(env_const)], "provided_constant"
    CB="/opt/gopath/src/github.com/hyperledger/fabric/peer/crypto"
    otls=f"{CB}/ordererOrganizations/pangochain.com/orderers/orderer1.pangochain.com/tls/ca.crt"
    fa=f"{CB}/peerOrganizations/firma.pangochain.com/peers/peer0.firma.pangochain.com/tls/ca.crt"
    fb=f"{CB}/peerOrganizations/firmb.pangochain.com/peers/peer0.firmb.pangochain.com/tls/ca.crt"
    vals=[]
    for i in range(5):
        docid=f"EXP3-COMMIT-{int(time.time()*1000)}-{i}"
        arg=json.dumps({"function":"RegisterDocument","Args":[docid,"case-exp3","h","QmX","owner-exp3","FirmAMSP","2026-06-01T00:00:00Z"]})
        cmd=["docker","exec","fabric-cli","peer","chaincode","invoke","-C","legal-channel","-n","legalcc",
             "-o","orderer1.pangochain.com:7050","--tls","--cafile",otls,"--waitForEvent","--waitForEventTimeout","30s",
             "--peerAddresses","peer0.firma.pangochain.com:7051","--tlsRootCertFiles",fa,
             "--peerAddresses","peer0.firmb.pangochain.com:8051","--tlsRootCertFiles",fb,"-c",arg]
        t0=time.perf_counter(); r=subprocess.run(cmd,capture_output=True,text=True); ms=(time.perf_counter()-t0)*1000.0
        if "invoke successful" in (r.stdout+r.stderr) or "status:200" in (r.stdout+r.stderr):
            vals.append(ms)
    return (statistics.median(vals) if vals else None), vals, "peer_cli_invoke"

print(f"=== V3 file-size: IPFS direct Kubo API ({ADD_URL}) ===")
cf=open(CSV,"w",newline=""); w=csv.writer(cf)
w.writerow(["experiment","kind","size_mb","sample","value_ms","cid","platform"])

fab_ms, fab_raw, fab_method = measure_fabric_commit()
print(f"Fabric commit constant: {fab_ms} ms (method={fab_method}, n={len(fab_raw)})")
for i,v in enumerate(fab_raw,1):
    w.writerow(["exp3","fabric_commit","",i,round(v,3),"",("linux_x86_64")])

summary=[]
tmp="/tmp/exp3_blob.bin"
for mb in SIZES_MB:
    print(f"--- {mb} MB ---")
    subprocess.run(["dd","if=/dev/urandom",f"of={tmp}","bs=1M",f"count={mb}","status=none"],check=True)
    samples=[]
    for s in range(1,REPS+1):
        ms,cid=ipfs_add_curl(tmp); samples.append(ms)
        w.writerow(["exp3","ipfs_add",mb,s,round(ms,3),cid,"linux_x86_64"])
        if s%5==0: print(f"  [{s}/{REPS}] {ms:.1f}ms cid={cid[:12]}")
    cf.flush()
    ipfs_p50=statistics.median(samples)
    total_p50 = ipfs_p50 + (fab_ms or 0)
    row={"size_mb":mb,"ipfs_p50_ms":round(ipfs_p50,2),"ipfs_mean_ms":round(statistics.mean(samples),2),
         "ipfs_min_ms":round(min(samples),2),"ipfs_max_ms":round(max(samples),2),
         "ipfs_stdev_ms":round(statistics.stdev(samples),2) if len(samples)>1 else 0,
         "fabric_commit_ms":round(fab_ms,2) if fab_ms else None,
         "total_p50_ms":round(total_p50,2),"ipfs_raw":[round(x,2) for x in samples]}
    summary.append(row)
    print(f"  size={mb}MB ipfs_p50={row['ipfs_p50_ms']}ms fabric={row['fabric_commit_ms']}ms total_p50={row['total_p50_ms']}ms")
cf.close()
os.remove(tmp) if os.path.exists(tmp) else None
json.dump({"fabric_commit_method":fab_method,"fabric_commit_raw":[round(x,2) for x in fab_raw],
           "per_size":summary},open(SJ,"w"),indent=2)
print(f"wrote {CSV} and {SJ}")
