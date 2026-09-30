"""Profile the Titanic dataset with stdlib-only Python (no pandas/numpy needed)."""
import csv
import statistics as st
from collections import Counter

PATH = r"C:\Users\System3\Downloads\Titanic-Dataset.csv\Titanic-Dataset.csv"

with open(PATH, newline="", encoding="utf-8") as f:
    rows = list(csv.DictReader(f))

cols = list(rows[0].keys())
n = len(rows)
print(f"SHAPE: {n} rows x {len(cols)} cols")
print(f"COLUMNS: {', '.join(cols)}\n")

def val(r, c):
    v = (r.get(c) or "").strip()
    return v if v else None

# Missing values per column
print("MISSING VALUES:")
for c in cols:
    miss = sum(1 for r in rows if val(r, c) is None)
    if miss:
        print(f"  {c:<12} {miss:>4}  ({miss / n:.1%})")
    else:
        print(f"  {c:<12}   0  (complete)")

# Numeric summaries
print("\nNUMERIC SUMMARY:")
for c in ("Age", "Fare", "SibSp", "Parch"):
    xs = [float(val(r, c)) for r in rows if val(r, c)]
    print(f"  {c:<6} n={len(xs):>3}  mean={st.mean(xs):7.2f}  median={st.median(xs):7.2f}"
          f"  min={min(xs):8.2f}  max={max(xs):8.2f}")

surv = lambda r: r["Survived"] == "1"
rate = "  survival={:.1%}"

# Categorical breakdowns
print("\nCATEGORICAL:")
for c in ("Sex", "Pclass", "Embarked"):
    cnt = Counter(val(r, c) for r in rows)
    print(f"  {c}: " + ", ".join(f"{k}={v}" for k, v in cnt.most_common()))

def group_rate(keyfn, label):
    groups = {}
    for r in rows:
        groups.setdefault(keyfn(r), []).append(r)
    print(f"\nSURVIVAL BY {label}:")
    for k in sorted(groups, key=str):
        g = groups[k]
        print(f"  {str(k):<18} n={len(g):>3} " + rate.format(sum(map(surv, g)) / len(g)))

group_rate(lambda r: val(r, "Sex"), "SEX")
group_rate(lambda r: f"Class {val(r, 'Pclass')}", "PASSENGER CLASS")
group_rate(lambda r: f"{val(r, 'Sex')}, class {val(r, 'Pclass')}", "SEX x CLASS")

def age_band(r):
    a = val(r, "Age")
    if a is None: return "unknown"
    a = float(a)
    if a < 13: return "child (<13)"
    if a < 20: return "teen (13-19)"
    if a < 40: return "adult (20-39)"
    if a < 60: return "middle (40-59)"
    return "senior (60+)"
group_rate(age_band, "AGE BAND")

# Fare extremes and family size
fares = sorted((float(val(r, "Fare")), r["Name"]) for r in rows)
print(f"\nFARE EXTREMES:")
print(f"  cheapest: GBP {fares[0][0]:.2f}  - {fares[0][1]}")
print(f"  priciest: GBP {fares[-1][0]:.2f}  - {fares[-1][1]}")

print("\nOVERALL SURVIVAL: " + rate.format(sum(map(surv, rows)) / n))
