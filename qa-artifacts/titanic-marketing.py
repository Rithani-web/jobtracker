"""Supplemental cuts for the CMO-brief framing (channel mix, pricing, groups)."""
import csv
import statistics as st
from collections import defaultdict

PATH = r"C:\Users\System3\Downloads\Titanic-Dataset.csv\Titanic-Dataset.csv"
with open(PATH, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

def val(r, c):
    v = (r.get(c) or "").strip()
    return v if v else None

# 1) Channel (Embarked) mix and quality
by_port = defaultdict(list)
for r in rows:
    by_port[val(r, "Embarked") or "unknown"].append(r)
print("CHANNEL (EMBARKED) MIX & QUALITY:")
for p, g in sorted(by_port.items()):
    s = sum(r["Survived"] == "1" for r in g) / len(g)
    t1 = sum(val(r, "Pclass") == "1" for r in g) / len(g)
    med = st.median(float(val(r, "Fare")) for r in g)
    print(f"  {p}: share={len(g)/len(rows):>5.1%}  tier1-share={t1:>5.1%}  median-fare=GBP {med:>6.2f}  outcome={s:.1%}")

# 2) Fare spread within each class (pricing consistency)
print("\nFARE BY CLASS (pricing consistency):")
for c in ("1", "2", "3"):
    fs = [float(val(r, "Fare")) for r in rows if val(r, "Pclass") == c]
    print(f"  Class {c}: median=GBP {st.median(fs):>6.2f}  p90=GBP {sorted(fs)[int(len(fs)*0.9)]:>7.2f}  max=GBP {max(fs):>7.2f}  zeros={sum(f==0 for f in fs)}")

# 3) Solo vs family groups
def party(r):
    fam = int(val(r, "SibSp") or 0) + int(val(r, "Parch") or 0)
    return "solo" if fam == 0 else f"family ({fam} relatives)"
groups = defaultdict(list)
for r in rows:
    groups[party(r)].append(r)
print("\nOUTCOME BY PARTY SIZE:")
solo = groups.pop("solo")
print(f"  solo            n={len(solo):>3}  outcome={sum(r['Survived']=='1' for r in solo)/len(solo):.1%}")
fam = [r for g in groups.values() for r in g]
print(f"  with family     n={len(fam):>3}  outcome={sum(r['Survived']=='1' for r in fam)/len(fam):.1%}")
big = [r for g in groups.values() for r in g if len(g) >= 5]
print(f"  big families 5+ n={len(big):>3}  outcome={sum(r['Survived']=='1' for r in big)/len(big):.1%}" if big else "")

# 4) Children with family vs solo (edges)
kids = [r for r in rows if val(r, "Age") and float(val(r, "Age")) < 13]
kd = defaultdict(list)
for r in kids:
    kd["solo" if int(val(r, "SibSp") or 0) + int(val(r, "Parch") or 0) == 0 else "family"].append(r)
print("\nCHILD (<13) OUTCOME BY PARTY:")
for k, g in kd.items():
    print(f"  {k:<8} n={len(g):>3}  outcome={sum(r['Survived']=='1' for r in g)/len(g):.1%}")

# 5) Tier-3 women vs tier-1 men headroom (already known) + top-decile fare outcomes
fs = sorted(rows, key=lambda r: float(val(r, "Fare")), reverse=True)
top = fs[:89]
print(f"\nTOP-DECILE FARE PAYERS: n=89, outcome={sum(r['Survived']=='1' for r in top)/89:.1%}, tier1-share={sum(val(r,'Pclass')=='1' for r in top)/89:.1%}")
