"""Shared matplotlib style for every figure in the BCRA paper.

One place for the palette, fonts, borders, and grid so all data figures read as
one system. The categorical palette is muted (no bright hues) and was validated
computationally for color-vision-deficiency separation on a white surface
(worst adjacent pair CVD dE 6.1, legal with the secondary encodings every
figure here uses: direct labels, bar gaps, distinct markers). Assign hues in
the fixed order below; never cycle or skip.

Usage:
    import pangostyle as ps
    ps.apply()
    fig, ax = ps.figure()            # bordered axes, light y-grid
    ax.bar(..., color=ps.C[0], edgecolor=ps.EDGE, linewidth=0.8)
    ps.save(fig, "fig_name")         # writes fig_name.pdf next to the script
"""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from pathlib import Path

# Fixed categorical order: blue, burnt orange, green, gold, plum, then grey for
# reference/neutral series only (never for a data series among the first five).
C = ["#2c5f9e", "#b8541f", "#128455", "#a07400", "#a05577"]
GREY = "#5a5a5a"
EDGE = "#1a1a1a"          # mark borders
GRID = "#c9c9c9"
BAND = "#e8e2d4"          # muted background band for outage/highlight windows

FONT_SIZE = 9.0


def apply():
    plt.rcParams.update({
        "font.family": "sans-serif",
        "font.sans-serif": ["DejaVu Sans", "Helvetica", "Arial"],
        "font.size": FONT_SIZE,
        "axes.titlesize": FONT_SIZE + 0.5,
        "axes.labelsize": FONT_SIZE,
        "xtick.labelsize": FONT_SIZE - 0.5,
        "ytick.labelsize": FONT_SIZE - 0.5,
        "legend.fontsize": FONT_SIZE - 0.5,
        # Full border on every axes (user requirement), recessive ticks.
        "axes.edgecolor": EDGE,
        "axes.linewidth": 0.9,
        "axes.spines.top": True,
        "axes.spines.right": True,
        "xtick.direction": "out",
        "ytick.direction": "out",
        "xtick.major.size": 3.0,
        "ytick.major.size": 3.0,
        # Light dashed grid behind the data, y only by default.
        "axes.grid": True,
        "axes.grid.axis": "y",
        "grid.color": GRID,
        "grid.linestyle": (0, (2, 3)),
        "grid.linewidth": 0.6,
        "axes.axisbelow": True,
        # Legend: bordered box, matching the figure frame.
        "legend.frameon": True,
        "legend.edgecolor": EDGE,
        "legend.framealpha": 1.0,
        "legend.fancybox": False,
        "lines.linewidth": 1.6,
        "lines.markersize": 5.0,
        "figure.dpi": 150,
        "savefig.bbox": "tight",
        "savefig.pad_inches": 0.02,
        "pdf.fonttype": 42,          # embed TrueType, editable text in the PDF
    })


def figure(width=5.6, height=3.2, **kw):
    """Single-axes bordered figure sized for the single-column BCRA layout."""
    fig, ax = plt.subplots(figsize=(width, height), **kw)
    fig.subplots_adjust(left=0.14, right=0.97, top=0.9, bottom=0.16)
    return fig, ax


def panels(n, width=6.4, height=2.9, **kw):
    """1xN panel figure, shared style."""
    fig, axes = plt.subplots(1, n, figsize=(width, height), **kw)
    return fig, axes


def label_bars(ax, bars, fmt="{:.0f}", dy=2.5, size=None):
    """Direct value labels above each bar (secondary encoding for the palette)."""
    for b in bars:
        ax.annotate(fmt.format(b.get_height()),
                    (b.get_x() + b.get_width() / 2, b.get_height()),
                    xytext=(0, dy), textcoords="offset points", ha="center",
                    fontsize=size or (FONT_SIZE - 1.5))


def bar_kw(i):
    """Standard bar styling for series i: palette fill, dark border."""
    return dict(color=C[i], edgecolor=EDGE, linewidth=0.8)


def save(fig, name, outdir=None):
    out = Path(outdir) if outdir else Path(__file__).parent / "out"
    out.mkdir(parents=True, exist_ok=True)
    p = out / f"{name}.pdf"
    fig.savefig(p)
    fig.savefig(out / f"{name}.png", dpi=200)
    plt.close(fig)
    print(f"wrote {p}")
    return p
