# Munich catalog CSV

Builds `apps/pwa/public/catalog/munich.csv`, the coffee catalog the app imports on first
start (region "Munich") or via Settings → Import catalog CSV.

**Run on the host, not in the devcontainer**: the container firewall doesn't allowlist shop
domains. Requires Python 3.9+, no dependencies.

```sh
python3 -I tools/catalog-csv/fetch.py ~/tmp/cuplog-raw          # ~5 min, throttled, cached per page
python3 -I tools/catalog-csv/extract.py ~/tmp/cuplog-raw apps/pwa/public/catalog/munich.csv ~/tmp/cuplog-skipped.txt
```

Use a fresh raw directory for an updated catalog (product pages are cached by URL). The
skipped list shows everything filtered out (sets, vouchers, equipment, capsules, wholesale
duplicates, private-label blends without a public page).

## Sources (checked against robots.txt)

| Roaster | City | Source |
|---|---|---|
| Man versus Machine, Nine Fine Roastery, ALRIGHTY, delmocca, stray coffee roasters | München | Shopify `/products.json` |
| District Five | Ingolstadt | Shopify `/products.json` |
| Wildkaffee | Farchant | Shopify `/products.json` |
| Kaffeerösterei Martermühle | Aßling | Shopify `/products.json` (coffee/espresso product types only) |
| Murnauer Kaffeerösterei | Obersöchering (Murnau) | Shopify `/products.json` (single coffees; sets, boxes and monthly coffee skipped) |
| Vits der Kaffee, Kaffeerösterei Viktualienmarkt | München | WooCommerce Store API (+ Vits product pages) |
| FAUSTO, gangundgäbe | München | product pages from the shop sitemap |
| Dallmayr | München | product-line pages on dallmayr.com (no prices; the shop domain disallows crawlers) |
| DINZLER (incl. Crazy Sheep) | Irschenberg | product pages linked from the `/shop` coffee categories (strength beans → `roast_level`, brew icons → `roast_for`) |
| Pacandé | München | prerendered product pages from the sitemap (9-dot roast scale → `roast_level`; `/api/` is disallowed) |

Not included yet: Vogelmaier (robots.txt disallows all), Supremo (no public feed or sitemap),
JB Kaffee, Mahlefitz, Coffeemamas (no sitemap or feed found), Schneid (mostly
flavoured coffees). Add them by hand as CSV rows or with a new adapter in
`extract.py`.

## Columns

`id,roaster,roaster_city,name,origin_countries,region,process,varieties,roast_level,roast_for,tasting_notes,weight_g,price_eur,url,available,updated_at`

- `roast_level` 1–3 (light / medium / dark), only when the roaster states it
- `process` washed | natural | honey | anaerobic | other (blends with several processes)
- `roast_for` espresso | filter | omni
- `origin_countries`, `varieties`, `tasting_notes`: `;`-separated lists; notes keep the roaster's wording
- `weight_g` / `price_eur`: smallest whole-bean bag; `available`: in stock when fetched

Fields are extracted heuristically (labels, a de/en flavour lexicon, and keywords), so empty
cells are common and a few values will be wrong. Fix individual rows in the CSV directly if needed.
