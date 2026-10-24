"""Download raw product data for the Munich catalog CSV.

Runs on the host (the devcontainer firewall blocks shop domains).
Usage: python3 -I tools/catalog-csv/fetch.py RAW_DIR

Only public product data is fetched: Shopify /products.json, the WooCommerce Store API,
and individual product pages listed in the shops' sitemaps. robots.txt was checked for
every shop (README §6.3); shops that disallow crawling (e.g. Vogelmaier, dallmayr-versand.de)
are not fetched. Requests are throttled.
"""
import gzip, hashlib, json, os, re, sys, time, urllib.error, urllib.request

RAW = sys.argv[1]
os.makedirs(os.path.join(RAW, "pages"), exist_ok=True)
UA = {"User-Agent": "CupLog-catalog/0.1 (personal, non-commercial; +https://www.hohenegger.eu/CuppaScore/)"}
DELAY = 1.5

SHOPIFY = ["mvsm.coffee", "ninefine.de", "alrighty.coffee", "delmocca.de", "district-five.de", "stray.coffee", "wild-kaffee.com", "martermuehle.de", "murnauer-kaffeeroesterei.de"]
WOO = ["kaffeeroesterei-viktualienmarkt.de", "vitsderkaffee.de"]
DALLMAYR_LINES = ["prodomo", "ethiopia", "homebarista", "roestkunst", "doro"]


def get(url, tries=4):
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r:
                b = r.read()
            break
        except urllib.error.HTTPError as e:
            if e.code < 500 or i == tries - 1:
                raise
        except (TimeoutError, OSError):
            if i == tries - 1:
                raise
        time.sleep(DELAY * 4 * (i + 1))  # back off on timeouts / 5xx
    time.sleep(DELAY)
    return gzip.decompress(b) if b[:2] == b"\x1f\x8b" else b


def save_page(prefix, url):
    out = os.path.join(RAW, "pages", prefix + "_" + hashlib.md5(url.encode()).hexdigest()[:10] + ".html")
    if os.path.exists(out):
        return
    try:
        body = get(url).decode("utf-8", "ignore")  # download first: a 404 must not leave an empty file
    except Exception as e:
        print("  ERR", url, e)
        return
    open(out, "w", encoding="utf-8").write(f"<!-- {url} -->\n" + body)


def sitemap(url, depth=0):
    x = get(url).decode("utf-8", "ignore")
    locs = [l.replace("&amp;", "&") for l in re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", x)]
    if "<sitemapindex" in x and depth < 2:
        return [u for l in locs for u in sitemap(l, depth + 1)]
    return locs


for h in SHOPIFY:
    items, page = [], 1
    while True:
        d = json.loads(get(f"https://{h}/products.json?limit=250&page={page}"))["products"]
        items += d
        if len(d) < 250:
            break
        page += 1
    json.dump(items, open(os.path.join(RAW, h + ".json"), "w"))
    print(h, "shopify", len(items))

for h in WOO:
    items, page = [], 1
    while True:
        d = json.loads(get(f"https://{h}/wp-json/wc/store/v1/products?per_page=100&page={page}"))
        items += d
        if len(d) < 100:
            break
        page += 1
    json.dump(items, open(os.path.join(RAW, h + ".json"), "w"))
    print(h, "woo", len(items))

# Vits keeps variety / process / taste on the product page only
os.makedirs(os.path.join(RAW, "vits_pages"), exist_ok=True)
for p in json.load(open(os.path.join(RAW, "vitsderkaffee.de.json"))):
    cats = " ".join(c["name"] for c in p.get("categories", []))
    if re.search(r"ZUBEH|Kapseln|ESE|Tassen", cats) or not re.search(r"KAFFEE|COFFEE|BLENDS", cats):
        continue
    out = os.path.join(RAW, "vits_pages", f"{p['id']}.html")
    if not os.path.exists(out):
        try:
            body = get(p["permalink"])
        except Exception as e:  # 404 = wholesale / private-label blend, skipped by extract.py
            print("  skip", p["name"], e)
            continue
        open(out, "wb").write(body)
print("vits pages", len(os.listdir(os.path.join(RAW, "vits_pages"))))

# FAUSTO (Shopware): one page per product code, prefer whole bean 350 g
best = {}
for u in sitemap("https://www.fausto-kaffee.de/sitemap.xml"):
    m = re.match(r"https://(?:www\.)?fausto-kaffee\.de/([^/]+)/([A-Z0-9]+)\.(\d+)\.(\w+)$", u)
    if not m or not re.match(r"(Espresso|Caffe|Kaffee|Filterkaffee|Bruehkaffee)", m.group(1), re.I):
        continue
    score = (m.group(4) == "gB", m.group(3) == "350")
    if m.group(2) not in best or score > best[m.group(2)][0]:
        best[m.group(2)] = (score, u)
for _, u in best.values():
    save_page("fausto", u)
print("fausto pages", len(best))

# gangundgäbe (Squarespace)
gg = [u for u in sitemap("https://www.gangundgaebe.de/sitemap.xml") if re.search(r"/roestkaffee/.+", u)]
for u in gg:
    save_page("gangundgaebe", u)
print("gangundgaebe pages", len(gg))

# Dallmayr: product-line pages on dallmayr.com (the shop domain disallows crawlers)
for line in DALLMAYR_LINES:
    url = f"https://www.dallmayr.com/de/kaffee/{line}/"
    out = os.path.join(RAW, "pages", f"dallmayrline_{line}.html")
    if not os.path.exists(out):
        body = get(url).decode("utf-8", "ignore")
        open(out, "w", encoding="utf-8").write(f"<!-- {url} -->\n" + body)
print("dallmayr lines", len(DALLMAYR_LINES))
