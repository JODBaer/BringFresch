import json

with open("data/swiss_seasonal.json", encoding="utf-8") as f:
    data = json.load(f)

print(f"Total Swiss seasonal items: {len(data['items'])}")
for m in range(1, 13):
    items_in_m = [it["name"] for it in data["items"] if m in it.get("field_months", []) or m in it.get("storage_months", [])]
    news = data["monthly_news"].get(str(m), {})
    month_name = data["months"][m - 1]
    assert len(items_in_m) > 0, f"Month {m} has no items"
    assert "headline" in news, f"Month {m} has no news"
    print(f"Monat {m:02d} ({month_name:<9}): {len(items_in_m):2d} Gemuese | News: {news['headline']}")

print("SUCCESS: ALL 12 MONTHS VERIFIED!")
