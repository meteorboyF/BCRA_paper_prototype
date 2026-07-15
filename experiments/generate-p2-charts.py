#!/usr/bin/env python3
"""
Standalone chart generator for P2-A and P2-B results.
Reads from results/ directory and writes PDFs there.
Usage: python3 experiments/generate-p2-charts.py [results_dir]
"""
import csv, sys, os, statistics, math

RESULTS_DIR = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(__file__), '..', 'results')
RESULTS_DIR = os.path.abspath(RESULTS_DIR)

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

def read_csv(path):
    if not os.path.exists(path):
        print(f"MISSING: {path}")
        return []
    return list(csv.DictReader(open(path)))

def group(rows, keys, val_col, positive_only=True):
    g = {}
    for r in rows:
        try: v = float(r[val_col])
        except: continue
        if positive_only and v <= 0: continue
        k = tuple(r[k] for k in keys)
        g.setdefault(k, []).append(v)
    return g

# ─── P2-A Chart ───────────────────────────────────────────────────────────────
p2a_path = os.path.join(RESULTS_DIR, "p2a_batchtimeout_tps.csv")
p2a_rows = read_csv(p2a_path)

if p2a_rows:
    groups = group(p2a_rows, ['batch_timeout_ms', 'concurrency'], 'tps_committed')

    fig, ax = plt.subplots(figsize=(8, 5))
    colors  = {'500': '#1f77b4', '250': '#d62728'}
    markers = {'500': 'o', '250': 's'}

    for bt_ms in sorted({k[0] for k in groups}, key=int):
        concs  = sorted({int(k[1]) for k in groups if k[0] == bt_ms})
        means  = []
        stds   = []
        for c in concs:
            vals = groups.get((bt_ms, str(c)), [])
            means.append(statistics.mean(vals) if vals else 0)
            stds.append(statistics.stdev(vals) if len(vals) > 1 else 0)
        ax.errorbar(concs, means, yerr=stds,
                    label=f'BatchTimeout={bt_ms}ms',
                    color=colors.get(bt_ms, '#2ca02c'),
                    marker=markers.get(bt_ms, '^'),
                    linewidth=2, capsize=4)

    ax.axhline(16.7, linestyle='--', color='grey', linewidth=1.2,
               label='1,000-lawyer demand (16.7 TPS)')
    ax.axhline(26.7, linestyle='--', color='black', linewidth=1.2,
               label='Baseline peak (2s batch)')

    ax.set_xlabel('Concurrent Clients')
    ax.set_ylabel('Committed TPS')
    ax.set_title('TPS vs Concurrency at Reduced BatchTimeout (Linux x86_64)')
    ax.legend(loc='upper right', fontsize=9)
    ax.grid(True, alpha=0.3)
    ax.set_xticks([50, 100, 200])
    plt.tight_layout()
    out = os.path.join(RESULTS_DIR, "p2a_tps_chart.pdf")
    plt.savefig(out)
    print(f"P2-A chart saved: {out}")
    plt.close()
else:
    print("P2-A: no data, skipping chart")

# ─── P2-B Chart ───────────────────────────────────────────────────────────────
tps_path = os.path.join(RESULTS_DIR, "p2b_wan_tps_raw.csv")
lat_path = os.path.join(RESULTS_DIR, "p2b_wan_latency_raw.csv")
tps_rows = read_csv(tps_path)
lat_rows = read_csv(lat_path)

if tps_rows or lat_rows:
    tps_g = group(tps_rows, ['rtt_ms','method'], 'tps_committed')
    lat_g = group(lat_rows, ['rtt_ms','method'], 'latency_ms')

    rtts    = [0, 50, 100, 150]
    xlabels = ["0\n(local)", "50\n(regional)", "100\n(national)", "150\n(internat'l)"]
    styles  = {
        'veth_corrected':  {'color': '#1f77b4', 'marker': 'o', 'ls': '-'},
        'bridge_original': {'color': '#d62728', 'marker': 's', 'ls': '--'},
    }
    labels = {
        'veth_corrected':  'Corrected (per-container veth)',
        'bridge_original': 'Original (bridge only)',
    }

    fig, (ax1, ax2) = plt.subplots(1, 2, figsize=(12, 5))

    for method in ['veth_corrected', 'bridge_original']:
        tps_means, lat_p50s = [], []
        for rtt in rtts:
            key = (str(rtt), method)
            tps_vals = tps_g.get(key, [])
            lat_vals = sorted(lat_g.get(key, []))
            tps_means.append(statistics.mean(tps_vals) if tps_vals else float('nan'))
            n = len(lat_vals)
            lat_p50s.append(lat_vals[n//2] if n > 0 else float('nan'))
        s = styles[method]
        ax1.plot(rtts, tps_means, color=s['color'], marker=s['marker'],
                 linestyle=s['ls'], linewidth=2, label=labels[method])
        ax2.plot(rtts, lat_p50s, color=s['color'], marker=s['marker'],
                 linestyle=s['ls'], linewidth=2, label=labels[method])

    ax1.axhline(16.7, linestyle=':', color='grey', linewidth=1.2,
                label='1,000-lawyer demand')
    ax1.set_xlabel('RTT (ms)')
    ax1.set_ylabel('Committed TPS')
    ax1.set_title('TPS vs RTT')
    ax1.set_xticks(rtts)
    ax1.set_xticklabels(xlabels)
    ax1.legend(fontsize=8)
    ax1.grid(True, alpha=0.3)

    ax2.axhline(5000, linestyle=':', color='grey', linewidth=1.2, label='5 s threshold')
    ax2.set_xlabel('RTT (ms)')
    ax2.set_ylabel('RegisterDocument P50 Latency (ms)')
    ax2.set_title('RegisterDocument P50 Latency vs RTT')
    ax2.set_xticks(rtts)
    ax2.set_xticklabels(xlabels)
    ax2.legend(fontsize=8)
    ax2.grid(True, alpha=0.3)

    fig.suptitle('WAN Resilience: Corrected Per-Container vs Original Bridge-Only',
                 fontsize=12, fontweight='bold')
    plt.tight_layout()
    out = os.path.join(RESULTS_DIR, "p2b_wan_chart.pdf")
    plt.savefig(out)
    print(f"P2-B chart saved: {out}")
    plt.close()
else:
    print("P2-B: no data, skipping chart")
