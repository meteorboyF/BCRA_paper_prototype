#!/usr/bin/env node
/**
 * S2 fail-open load generator. Steady CONCURRENCY workers hitting
 * GET /api/documents/{DOC}/ciphertext (the path that runs Fabric CheckAccess and,
 * on FabricException, falls back to the DB ACL + emits ACL_FABRIC_FALLBACK).
 * Prints one JSON line per second: {t, ok, http5xx, http403, err, inflight} so the
 * driver can correlate request outcomes with peer stop/start events.
 * Env: PANGOCHAIN_JWT_TOKEN, PANGOCHAIN_TEST_DOC_ID, PANGOCHAIN_CONCURRENCY(50),
 *      PANGOCHAIN_DURATION_SEC(120)
 */
'use strict';
const http = require('http');
const JWT = process.env.PANGOCHAIN_JWT_TOKEN || '';
const DOC = process.env.PANGOCHAIN_TEST_DOC_ID || '';
const C   = parseInt(process.env.PANGOCHAIN_CONCURRENCY || '50', 10);
const DUR = parseInt(process.env.PANGOCHAIN_DURATION_SEC || '120', 10) * 1000;
if (!JWT || !DOC) { console.error('need JWT + DOC'); process.exit(1); }
const agent = new http.Agent({ keepAlive: true, maxSockets: C + 20 });
let inflight = 0;
const win = { ok: 0, h5: 0, h403: 0, err: 0 };
function req() {
  return new Promise((res) => {
    const r = http.request({ hostname:'localhost', port:8080, path:`/api/documents/${DOC}/ciphertext`,
      method:'GET', agent, headers:{ Authorization:`Bearer ${JWT}` }, timeout:15000 }, (resp) => {
      resp.on('data',()=>{}); resp.on('end',()=>{
        if (resp.statusCode>=200&&resp.statusCode<300) win.ok++;
        else if (resp.statusCode===403) win.h403++;
        else if (resp.statusCode>=500) win.h5++;
        else win.err++;
        res();
      });
    });
    r.on('error',()=>{ win.err++; res(); });
    r.on('timeout',()=>{ r.destroy(); win.err++; res(); });
    r.end();
  });
}
const start = Date.now(), deadline = start + DUR;
function pump(){ while (inflight < C && Date.now() < deadline){ inflight++; req().then(()=>{ inflight--; if(Date.now()<deadline) pump(); }); } }
pump();
const ticker = setInterval(()=>{
  const t = Math.round((Date.now()-start)/1000);
  console.log(JSON.stringify({ t, ...win, inflight }));
  win.ok=win.h5=win.h403=win.err=0;
  if (Date.now()>=deadline){ clearInterval(ticker); setTimeout(()=>process.exit(0), 500); }
}, 1000);
