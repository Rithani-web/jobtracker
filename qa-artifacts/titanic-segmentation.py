"""Segmentation & concentration analysis (stdlib-only).
Segments = Sex x Pclass; concentration = revenue shares, Pareto, Gini, HHI.
"""
import csv
import statistics as st
from collections import defaultdict

PATH = r"C:\Users\System3\Downloads\Titanic-Dataset.csv\Titanic-Dataset.csv"
with open(PATH, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

def val(r, c):
    v = (r.get(c) or "").strip()
    return v if v else None

def fare(r): return float(val(r, "Fare"))
def seg(r): return f"{'Female' if val(r,'Sex')=='female' else 'Male'} / T{val(r, 'Pclass')}"
def survived(r): return r["Survived"] == "1"

total_n = len(rows)
total_rev = sum(map(fare, rows))

# ---- 1) Segment table ----
by_seg = defaultdict(list)
for r in rows:
    by_seg[seg(r)].append(r)

order = ["Female / T1", "Female / T2", "Female / T3", "Male / T1", "Male / T2", "Male / T3"]
print(f"{'SEGMENT':<14}{'n':>5}{'share':>8}{'med fare':>10}{'rev':>9}{'rev sh':>8}{'outcome':>9}{'rev/out idx':>12}")
for s in order:
    g = by_seg[s]
    rev = sum(map(fare, g))
    out = sum(map(survived, g)) / len(g)
    rev_share = rev / total_rev
    idx = rev_share / (len(g) / total_n)
    print(f"{s:<14}{len(g):>5}{len(g)/total_n:>8.1%}{st.median(map(fare,g)):>10.2f}"
          f"{rev:>9.0f}{rev_share:>8.1%}{out:>9.1%}{idx:>11.2f}x")

# ---- 2) Revenue concentration ----
print("\nREVENUE CONCENTRATION:")
fs = sorted(map(fare, rows), reverse=True)
cum = 0
for k in (10, 20, 30, 50):
    share = sum(fs[: int(total_n * k / 100)]) / total_rev
    print(f"  Top {k:>2}% of customers -> {share:>5.1%} of revenue")

# Gini coefficient of fares
xs = sorted(fare(r) for r in rows)
n = len(xs)
gini = (2 * sum((i + 1) * x for i, x in enumerate(xs))) / (n * sum(xs)) - (n + 1) / n
print(f"  Gini coefficient of fares: {gini:.3f}  (0=perfect equality, 1=max concentration)")

# ---- 3) Customer-share vs revenue-share by tier ----
print("\nTIER MIX: customers vs revenue:")
for t in ("1", "2", "3"):
    g = [r for r in rows if val(r, "Pclass") == t]
    print(f"  Tier {t}: {len(g)/total_n:>5.1%} of customers -> {sum(map(fare,g))/total_rev:>5.1%} of revenue")

# ---- 4) HHI on segments and channels ----
def hhi(shares):
    return sum(s * s for s in shares) * 10000

seg_shares = [len(g) / total_n for g in by_seg.values()]
ports = defaultdict(int)
for r in rows:
    ports[val(r, "Embarked") or "S"] += 1
port_shares = [c / total_n for c in ports.values()]
print(f"\nHHI segments (Sex x Tier): {hhi(seg_shares):.0f} / 10000   (>2500 = highly concentrated)")
print(f"HHI channels (Embarked):   {hhi(port_shares):.0f} / 10000")

# ---- 5) Children overlay per segment (only where cell >= 20) ----
print("\nAGE OVERLAY (child <13 share and outcome, cells >= 20):")
for s in order:
    g = by_seg[s]
    kids = [r for r in g if val(r, "Age") and float(val(r, "Age")) < 13]
    if len(kids) >= 20:
        print(f"  {s:<14} children n={len(kids):>2} ({len(kids)/len(g):.0%} of segment), outcome={sum(map(survived,kids))/len(kids):.1%} vs segment {sum(map(survived,g))/len(g):.1%}")
