"""Turn raw Shopify / WooCommerce product feeds into CupLog catalog CSV rows.

Runs on the host after fetch.py.
Usage: python3 -I tools/catalog-csv/extract.py RAW_DIR apps/pwa/public/catalog/munich.csv REPORT_TXT
"""
import csv, html, json, os, re, sys, unicodedata
from datetime import date

RAW, OUT, REPORT = sys.argv[1:4]
TODAY = date.today().isoformat()

SHOPS = {
    # host: (roaster, city, platform)
    "mvsm.coffee": ("Man versus Machine", "München", "shopify"),
    "ninefine.de": ("Nine Fine Roastery", "München", "shopify"),
    "alrighty.coffee": ("ALRIGHTY Caretrade Coffee", "München", "shopify"),
    "delmocca.de": ("delmocca", "München", "shopify"),
    "stray.coffee": ("stray coffee roasters", "München", "shopify"),
    "vitsderkaffee.de": ("Vits der Kaffee", "München", "woo"),
    "kaffeeroesterei-viktualienmarkt.de": ("Kaffeerösterei Viktualienmarkt", "München", "woo"),
    "district-five.de": ("District Five", "Ingolstadt", "shopify"),
    "wild-kaffee.com": ("Wildkaffee", "Farchant (Garmisch-Partenkirchen)", "shopify"),
    "martermuehle.de": ("Kaffeerösterei Martermühle", "Aßling", "shopify"),
    "murnauer-kaffeeroesterei.de": ("Murnauer Kaffeerösterei", "Obersöchering (Murnau)", "shopify"),
    "fausto": ("FAUSTO Kaffeerösterei", "München", "html"),
    "gangundgaebe": ("gangundgäbe", "München", "html"),
    "dallmayrline": ("Dallmayr", "München", "dallmayr"),
    "dinzler": ("DINZLER Kaffeerösterei", "Irschenberg", "dinzler"),
    "pacande": ("Pacandé", "München", "pacande"),
}

EXCLUDE = re.compile(
    r"gutschein|gift|voucher|set\b|test roast|drip coffee bag|probier|starterset|bestseller|box\b|abo\b|subscription|"
    r"tasse|mug|(?<!best )cup\b|becher|t-shirt|shopper|canister|kaffeedose|dose\b|french press|filter papier|"
    r"\bfilters?\b.*\(|papier|matcha|hojicha|\btee\b|\btea\b|wein|bier|kurs|class\b|masterclass|workshop|"
    r"führung|kapsel|capsule|ese\b|pads?\b|drip ?bag|dripbag|cold brew|nitro|creme\b|kaffeecreme|"
    r"florentiner|spende|wholesale|grosshandel|roaster.s choice|aeropress|hario|kalita|chemex|"
    r"comandante|timemore|cafflano|third wave water|espazzola|pitcher|scale|waage|mühle|grinder|"
    r"moccamaster|brewer|dripper|tablett|key tag|pinsel|swiss card|tds meter|apax|sibarist",
    re.I,
)

COUNTRIES = {
    "ET": ["äthiopien", "ethiopia", "etiopia", "ethiopian", "äthiopisch"],
    "KE": ["kenia", "kenya", "kenyan"],
    "CO": ["kolumbien", "colombia", "colombian", "kolumbianisch", "huila", "antioquia", "tolima", "nariño", "narino", "valle del cauca", "quindío", "quindio"],
    "BR": ["brasilien", "brazil", "brasil", "brasilianisch", "brazilian"],
    "GT": ["guatemala"],
    "SV": ["el salvador"],
    "HN": ["honduras"],
    "NI": ["nicaragua"],
    "CR": ["costa rica"],
    "PA": ["panama"],
    "MX": ["mexico", "mexiko"],
    "PE": ["peru"],
    "BO": ["bolivien", "bolivia"],
    "EC": ["ecuador", "galapagos"],
    "RW": ["ruanda", "rwanda"],
    "BI": ["burundi"],
    "ZM": ["sambia", "zambia"],
    "UG": ["uganda"],
    "TZ": ["tansania", "tanzania"],
    "CD": ["kongo", "congo", "drc"],
    "IN": ["indien", "india", "indisch", "malabar"],
    "ID": ["indonesien", "indonesia", "sumatra", "java", "sulawesi", "indonesisch"],
    "TL": ["timor-leste", "timor"],
    "PG": ["papua"],
    "YE": ["jemen", "yemen"],
    "CN": ["china", "yunnan"],
    "VN": ["vietnam"],
    "US": ["hawaii", "kona"],
    "JM": ["jamaica", "jamaika", "blue mountain"],
}
COUNTRY_RE = [(iso, re.compile(r"(?<![\w-])(" + "|".join(map(re.escape, names)) + r")(?![\w])", re.I))
              for iso, names in COUNTRIES.items()]

PROCESS = [
    ("anaerobic", r"anaerob|anaerobic|carbonic|co-?ferment|infused|thermal shock"),
    ("honey", r"\bhoney\b|pulped natural|\bpn\b"),
    ("natural", r"\bnatural\b|naturbelassen|ungewaschen|trocken aufbereitet|sonnengetrocknet|\bdry process"),
    ("washed", r"\bwashed\b|gewaschen|lavado|nass aufbereitet|fully washed"),
]

NOTE_LABELS = r"(?:tasting notes?|notes?|geschmack(?:sprofil|snoten)?|aromen|aroma|in der tasse|cup profile|flavou?r(?: notes)?|noten)"
VARIETY_LABELS = r"(?:varietät(?:en)?|variet(?:y|ies|al)|sorte(?:n)?)"
REGION_LABELS = r"(?:region|anbaugebiet|herkunftsregion|plantage|farm)"
PROC_LABELS = r"(?:aufbereitung|process(?:ing)?|verarbeitung)"
ROAST_LABELS = r"(?:röstung|roast(?: level)?|röstgrad)"
ORIGIN_LABELS = r"(?:ursprungsland|herkunft(?:sland)?|land|länder|origin|country)"
STOP_LABEL = r"(?:" + "|".join([NOTE_LABELS, VARIETY_LABELS, REGION_LABELS, PROC_LABELS, ROAST_LABELS, ORIGIN_LABELS,
                                r"anbauhöhe|höhe|altitude|produzent(?:/innen)?|producer|erntezeit|harvest|ideal für|mischung|"
                                r"empfohlen|zubereitung|brew|ökokontrollstelle|preise|röstdatum|inhalt"]) + r")\s*:"


def clean(s):
    s = html.unescape(re.sub(r"<(br|/p|/li|/h\d|/div)[^>]*>", "\n", s or "", flags=re.I))
    s = re.sub(r"<[^>]+>", " ", s)
    s = s.replace("­", "")
    s = re.sub(r"[ \t ]+", " ", s)
    return re.sub(r"\n\s*", "\n", s).strip()


def labelled(text, labels):
    m = re.search(r"(?:^|\n)" + labels + r"\s*\n([^\n]{1,80})(?=\n)", text, re.I)
    if m:
        return m.group(1).strip(" .;,-–")
    m = re.search(r"(?:^|\n|\.\s|\s)" + labels + r"\s*:\s*(.+?)(?=\n|" + STOP_LABEL + r"|$)", text, re.I)
    return m.group(1).strip(" .;,-–") if m else ""


def slug(s):
    s = unicodedata.normalize("NFKD", s.replace("ß", "ss")).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def countries(*texts):
    found = []
    for t in texts:
        for iso, rx in COUNTRY_RE:
            if rx.search(t or "") and iso not in found:
                found.append(iso)
        if found:
            return found  # first text with any match wins (title > labelled > body)
    return found


def process_of(*texts):
    for t in texts:
        if not t:
            continue
        hits = [name for name, rx in PROCESS if re.search(rx, t, re.I)]
        if len(hits) == 1:
            return hits[0]
        if hits:
            return "other" if len(hits) > 2 else hits[0] if hits[0] == "anaerobic" else "other"
    return ""


def roast_level(*texts):
    t = " ".join(x for x in texts if x).lower()
    if re.search(r"\b(dunkel|dark|dunkle röstung|out of the dark|kräftig geröstet)", t) and not re.search(r"dunkle[nr]? (schokolade|beere|kirsche|frucht)|dark (chocolate|fruit|cherr)", t):
        return "3"
    if re.search(r"\b(mittel|medium|mittlere röstung)", t):
        return "2"
    if re.search(r"\b(hell|light|helle röstung|nordic)", t):
        return "1"
    return ""


def roast_for(*texts):
    t = " ".join(x for x in texts if x).lower()
    if re.search(r"\bomni\b", t):
        return "omni"
    e = bool(re.search(r"espresso|siebträger|crema\b|vollautomat|bialetti|espressokocher", t))
    f = bool(re.search(r"filter|pour.?over|handfilter|v60|chemex|french press|aeropress|brühkaffee|^kaffee ", t))
    return "omni" if e and f else "espresso" if e else "filter" if f else ""


FLAVOURS = """
Schokolade|Zartbitterschokolade|Milchschokolade|dunkle Schokolade|Kakao|Kakaonibs|Kakao Nibs|chocolate|dark chocolate|milk chocolate|cocoa|cacao nibs|
Karamell|Karamel|Toffee|Nougat|Praline|Marzipan|Honig|brauner Zucker|Rohrzucker|Panela|Melasse|Ahornsirup|Vanille|caramel|honey|brown sugar|molasses|maple|vanilla|
Haselnuss|Mandel|Walnuss|Pekannuss|Nuss|nussig|Erdnuss|hazelnut|almond|walnut|pecan|nutty|peanut|
Kirsche|Sauerkirsche|Erdbeere|Himbeere|Brombeere|Blaubeere|Heidelbeere|Johannisbeere|Cassis|Preiselbeere|rote Beeren|Beeren|Waldbeeren|
cherry|strawberry|raspberry|blackberry|blueberry|blackcurrant|redcurrant|cranberry|red berries|berries|
Pfirsich|Aprikose|Nektarine|Pflaume|Zwetschge|Rosine|Dattel|Feige|getrocknete Früchte|Trockenfrüchte|peach|apricot|nectarine|plum|raisin|date|fig|dried fruit|
Zitrone|Limette|Orange|Blutorange|Mandarine|Grapefruit|Bergamotte|Zitrus|Zitrusfrucht|lemon|lime|blood orange|mandarin|tangerine|grapefruit|bergamot|citrus|
Apfel|grüner Apfel|Birne|Traube|Weintraube|Melone|Wassermelone|apple|green apple|pear|grape|melon|watermelon|
Mango|Ananas|Maracuja|Passionsfrucht|Papaya|Guave|Litschi|Kokos|Banane|tropische Früchte|mango|pineapple|passion fruit|papaya|guava|lychee|coconut|banana|tropical fruit|
Jasmin|Rose|Holunderblüte|Holunder|Lavendel|Hibiskus|Orangenblüte|Kamille|floral|blumig|jasmine|rose|elderflower|lavender|hibiscus|orange blossom|chamomile|
schwarzer Tee|Earl Grey|Grüntee|black tea|green tea|
Zimt|Nelke|Kardamom|Muskat|Pfeffer|würzig|Lakritz|Süßholz|cinnamon|clove|cardamom|nutmeg|pepper|spicy|liquorice|licorice|
Rum|Wein|Rotwein|Whisky|winey|wine|rum|
Tabak|Holz|Zeder|erdig|Malz|malzig|Brot|Cookies|Keks|Brownie|Popcorn|tobacco|cedar|earthy|malt|biscuit|cookie
"""
FLAVOUR_RE = re.compile(r"(?<![\w-])(" + "|".join(sorted({f.strip() for f in FLAVOURS.replace("\n", "").split("|") if f.strip()}, key=len, reverse=True)) + r")(?:n|e|en|s)?(?![\w])", re.I)
GENERIC = {"beeren", "berries", "nuss", "date", "rose", "orange", "pepper", "wine", "wein", "malt", "holz"}


def lexicon_notes(text):
    found = []
    for m in FLAVOUR_RE.finditer(text):
        w = m.group(1)
        key = w.lower()
        if any(key == f.lower() or key in f.lower().split() for f in found):
            continue
        # ambiguous words only count in an obvious tasting context
        if key in GENERIC and not re.search(r"(note|noten|aroma|geschmack|tasse|cup|taste|nuance|hint|hauch)", text[max(0, m.start()-60):m.end()+30], re.I):
            continue
        found.append(w[0].upper() + w[1:] if w[0].islower() and not w.isupper() else w)
        if len(found) >= 6:
            break
    return ";".join(found)


def split_notes(s):
    s = re.sub(r"\s+(und|and|&|sowie)\s+", ",", s, flags=re.I)
    parts = [p.strip(" .;:-–()") for p in re.split(r"[,/;|•·]", s)]
    parts = [p for p in parts if 1 < len(p) <= 40 and not re.search(r"\d{3,}|http", p)]
    return ";".join(dict.fromkeys(parts))[:240]


def weight_g(label):
    m = re.search(r"(\d+(?:[.,]\d+)?)\s*(kg|g|gramm)\b", label or "", re.I)
    if not m:
        return None
    v = float(m.group(1).replace(",", "."))
    return int(round(v * 1000)) if m.group(2).lower() == "kg" else int(round(v))


rows, report = [], []
SYN = {"honey": "honig", "caramel": "karamell", "karamel": "karamell", "chocolate": "schokolade", "dark chocolate": "dunkle schokolade",
       "milk chocolate": "milchschokolade", "cocoa": "kakao", "hazelnut": "haselnuss", "almond": "mandel", "walnut": "walnuss",
       "cherry": "kirsche", "strawberry": "erdbeere", "raspberry": "himbeere", "blackberry": "brombeere", "blueberry": "blaubeere",
       "peach": "pfirsich", "apricot": "aprikose", "plum": "pflaume", "lemon": "zitrone", "citrus": "zitrus", "bergamot": "bergamotte",
       "pineapple": "ananas", "guava": "guave", "banana": "banane", "jasmine": "jasmin", "vanilla": "vanille", "cinnamon": "zimt", "floral": "blumig", "nutty": "nussig"}


def dedupe_notes(notes, proc, name):
    out, keys = [], set()
    for n in [x for x in notes.split(";") if x]:
        k = SYN.get(n.lower(), n.lower())
        if k in keys or (k == "honig" and n.lower() == "honey" and (proc == "honey" or "honey" in name.lower())):
            continue
        keys.add(k)
        out.append(n)
    return ";".join(out)


def add(host, name, url, text, tags_text, extra_for, variants, available=True):
    roaster, city, _ = SHOPS[host]
    name = re.sub(r"\s+", " ", html.unescape(name)).strip()
    if EXCLUDE.search(name):
        report.append(f"skip {host}: {name}")
        return
    origin_label = labelled(text, ORIGIN_LABELS)
    title_c = countries(name)
    origin = title_c or countries(origin_label, tags_text) or countries(text)
    blendish = re.search(r"blend|mischung|espresso no|crema|haus|house|signature|nr\.\s*\d", name, re.I)
    if not title_c and blendish:
        origin = countries(origin_label + " " + tags_text + " " + text) or origin
    notes = labelled(text, NOTE_LABELS)
    notes = notes if FLAVOUR_RE.search(notes or "") else ""
    notes_out = split_notes(notes) if notes else lexicon_notes(text[:1500])
    proc = process_of(name, labelled(text, PROC_LABELS), tags_text, text)
    # choose the smallest whole-bean variant >= 150 g
    best = None
    for label, price in variants:
        g = weight_g(label)
        if g and g >= 150 and price and (best is None or g < best[0]):
            best = (g, price)
    rows.append({
        "id": f"{slug(roaster)}-{slug(name)}",
        "roaster": roaster,
        "roaster_city": city,
        "name": name,
        "origin_countries": ";".join(origin),
        "region": labelled(text, REGION_LABELS)[:80],
        "process": proc,
        "varieties": ";".join(v for v in split_notes(labelled(text, r"(?:varietät(?:en)?|variet(?:y|ies|al))") or labelled(text, VARIETY_LABELS)).split(";")
                              if v and not re.fullmatch(r"(100 ?% ?)?arabica|robusta|arabica (&|und) robusta", v, re.I))[:120],
        "roast_level": roast_level(name, labelled(text, ROAST_LABELS), tags_text,
                                   " ".join(re.findall(r"[^.\n]{0,25}(?:geröstet|röstung|roast(?:ed)?)[^.\n]{0,15}", text, re.I))),
        "roast_for": roast_for(name, tags_text, labelled(text, r"(?:ideal für|empfohlen für|zubereitung|perfect for|best for|brew)"),
                               " ".join(re.findall(r"[^.\n]*(?:geeignet|ideal|perfekt für|empfehlen|works perfectly|perfect for|suited)[^.\n]*", text[:2500], re.I))),
        "tasting_notes": dedupe_notes(";".join(n.capitalize() if n.isupper() else n for n in notes_out.split(";")), proc, name) if notes_out else "",
        "weight_g": best[0] if best else "",
        "price_eur": f"{best[1]:.2f}" if best else "",
        "url": url,
        "available": "true" if available else "false",
        "updated_at": TODAY,
    })


for host, (roaster, city, platform) in SHOPS.items():
    if platform == "dallmayr":  # product-line pages: one block per "Dallmayr …" heading
        import glob
        for f in sorted(glob.glob(os.path.join(RAW, "pages", host + "_*.html"))):
            h = open(f, encoding="utf-8", errors="ignore").read()
            url = re.match(r"<!-- (\S+) -->", h).group(1)
            body = clean(re.sub(r"(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", h))
            lines = [l.strip() for l in body.split("\n") if l.strip()]
            blocks, cur = {}, None
            for l in lines:
                if re.fullmatch(r"Dallmayr (?!Röstkunst$)[\w'’ .&-]{3,60}", l) and "|" not in l:
                    cur = l
                    blocks.setdefault(cur, [])
                elif cur:
                    blocks[cur].append(l)
            for name, bl in blocks.items():
                text = "\n".join(bl[:25])
                beans = [int(g.replace(".", "")) for g in re.findall(r"([\d.]+) g Ganze Bohne", text)]
                if not beans:
                    continue
                n = name.removeprefix("Dallmayr ").strip()
                for_ = "omni" if re.search(r"omni", n + text, re.I) else "espresso" if re.search(r"espresso|crema|barista", n, re.I) else "filter"
                add(host, n, url, text, for_, "", [(f"{min(beans)} g", 0.0)])
                rows[-1]["roast_for"] = for_
                rows[-1]["price_eur"] = ""
                rows[-1]["weight_g"] = min(beans)
        continue
    if platform == "dinzler":  # Shopware product pages: bean icons, brew-method icons, "Aroma" and "Herkunft" blocks
        import glob
        ICON_FOR = {"siebtraeger": "espresso", "bialetti": "espresso", "filter-coffee": "filter", "frenchpress": "filter"}
        for f in sorted(glob.glob(os.path.join(RAW, "pages", host + "_*.html"))):
            h = open(f, encoding="utf-8", errors="ignore").read()
            url = re.match(r"<!-- (\S+) -->", h).group(1)
            h1 = re.search(r"<h1[^>]*>(.*?)</h1>", h, re.S)
            if not h1:
                report.append(f"skip {host}: {url} (no product title)")
                continue
            name = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", h1.group(1)))).strip()
            name = re.sub(r"^(?:DINZLER (?!x )|Espresso DINZLER (?=\w))", lambda m: "Espresso " if m.group(0).startswith("Espresso") else "", name)
            name = name.replace("CRAZY SHEEP", "Crazy Sheep")
            i, j, k = h.find("<h5>Stärke</h5>"), h.find("<h5>Empfohlene Zubereitung</h5>"), h.find("<h5>Aroma</h5>")
            beans = h[i:j].count("icon-bean-active") if 0 < i < j else 0
            methods = {ICON_FOR[c] for c in re.findall(r'class="icon icon-([\w-]+) is-din"', h[j:k]) if c in ICON_FOR} if 0 < j < k else set()
            body = clean(re.sub(r"(?is)<(script|style|svg|nav|header|footer)[^>]*>.*?</\1>", " ", h))
            aroma = re.search(r"\nAroma\n([^\n]+)", body)
            start = body.find("\n", aroma.end()) if aroma else 0
            desc = body[start:body.find("klimaneutral geröstet", start)] if "klimaneutral geröstet" in body[start:] else body[start:start + 2500]
            origins = " ".join(re.findall(r"\nHerkunft\n([^\n]{1,40})\n", body))
            price = re.search(r'property="product:price"\s+content="([\d.,]+)', h)
            unit = re.search(r"\n([\d.,]+) €/kg", body)
            variants = []
            if price and unit:
                eur, per_kg = (float(x.group(1).replace(".", "").replace(",", ".")) for x in (price, unit))
                variants = [(f"{round(eur / per_kg * 1000)} g", eur)]
            notes = ";".join(dict.fromkeys(x for x in split_notes(aroma.group(1)).split(";") + lexicon_notes(desc).split(";") if x)) if aroma else ""
            add(host, name, url, f"Herkunft: {origins}\n{desc}", origins, "", variants, "Sofort verfügbar" in body)
            if rows and rows[-1]["url"] == url:
                rows[-1]["roast_level"] = str(beans) if beans in (1, 2, 3) else ""
                rows[-1]["roast_for"] = "omni" if len(methods) == 2 else methods.pop() if methods else rows[-1]["roast_for"]
                rows[-1]["tasting_notes"] = ";".join([n for n in notes.split(";") if n.lower() != "säurearm"][:8])
                # blends: one "Herkunft" block per page, the other origins are named in the opening lines
                bean_lines = [x for x in re.split(r"(?<=[.!?])\s+", desc[:600])
                              if re.search(r"bohnen|rohkaffee|herkunft|stamm|mischung|plantage", x, re.I) and not re.search(r"ursprung in|legende", x, re.I)]
                rows[-1]["origin_countries"] = ";".join(dict.fromkeys(c for t in (name, origins, *bean_lines) for c in countries(t)))
        continue
    if platform == "pacande":  # prerendered Nuxt pages: 9-dot roast scale, size <select>, price range, "Beschreibung"
        import glob
        VARIETIES = r"pink bourbon|bourbon|caturra(?: chiroso)?|castillo|typica|geisha|gesha|tabi|sidra|wush wush|java"
        for f in sorted(glob.glob(os.path.join(RAW, "pages", host + "_*.html"))):
            h = open(f, encoding="utf-8", errors="ignore").read()
            url = re.match(r"<!-- (\S+) -->", h).group(1)
            i = h.find('class="roast-level')
            if i < 0:
                report.append(f"skip {host}: {url} (no roast scale, not a coffee)")
                continue
            name = html.unescape(re.search(r'property="og:title" content="([^"|]+)', h).group(1)).strip()
            dots = h[i:i + 3000].count("rounded-full bg-white")
            sizes = [weight_g(x.replace("gr", "g")) for x in re.findall(r'<option value="\d+">(\d+ ?gr?)</option>', h)]
            prices = [float(x) for x in re.findall(r"<span>([\d.]+)€(?: – [\d.]+€)? </span>", h)[:1]]
            body = clean(re.sub(r"(?is)<(script|style|svg|nav|header|footer)[^>]*>.*?</\1>", " ", h))
            a = body.find("\nBeschreibung\n")
            desc = body[a + 14:body.find("\nÜber uns\n", a)] if a > 0 else ""
            sizes = [g for g in sizes if g]
            variants = [(f"{min(sizes)} g", prices[0])] if sizes and prices else []
            add(host, name, url, desc, "", "", variants, "InStock" in h)
            if rows and rows[-1]["url"] == url:
                rows[-1]["roast_level"] = str((dots + 2) // 3) if 1 <= dots <= 9 else ""
                rows[-1]["varieties"] = ";".join(dict.fromkeys(v.title() for v in re.findall(VARIETIES, desc, re.I)))
                tip = " ".join(re.findall(r"[^.\n]*(?:tip|omniroast|als espresso|im filter|für espresso|für filter|siebträger|handfilter)[^.\n]*", desc, re.I))
                rows[-1]["roast_for"] = roast_for(name, tip) or rows[-1]["roast_for"]
        continue
    if platform == "html":
        import glob
        for f in sorted(glob.glob(os.path.join(RAW, "pages", host + "_*.html"))):
            h = open(f, encoding="utf-8", errors="ignore").read()
            url = re.match(r"<!-- (\S+) -->", h).group(1)
            og = re.search(r'<meta[^>]+property="og:title"[^>]+content="([^"]+)"', h)
            name = html.unescape(og.group(1) if og else re.search(r"<title>([^<]+)", h).group(1))
            name = re.split(r"\s+[—|-]\s+(?:gangundgäbe|FAUSTO)|\s+\|\s+", name)[0].strip()
            body = clean(re.sub(r"(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", h))
            if host == "fausto":
                i = body.find("Produktinformationen"); j = body.find("Kostenloser Versand", i)
                text = body[i:j] if i > 0 else body
                head = body[:i] if i > 0 else body
            else:
                i = body.find(name.split()[0]); j = body.find("Facebook", i)
                text = body[i:j] if i >= 0 else body
                head = text
            price = re.search(r"(\d+,\d{2})\s*€", head)
            kg = re.search(r"Inhalt:\s*([\d.,]+)\s*Kilogramm", head)
            label = f"{float(kg.group(1).replace(',', '.')) * 1000:.0f} g" if kg else (re.search(r"\d+\s*(?:g|Gramm)\b", head) or [""])[0]
            variants = [(label, float(price.group(1).replace(",", ".")))] if price else []
            add(host, name.title() if name.isupper() else name, url, text, "", "", variants, "ausverkauft" not in head.lower())
        continue
    if not os.path.exists(os.path.join(RAW, host + ".json")):
        report.append(f"missing {host}.json")
        continue
    data = json.load(open(os.path.join(RAW, host + ".json")))
    for p in data:
        if platform == "shopify":
            ptype = p.get("product_type") or ""
            if re.search(r"equipment|zubeh|gift|geschenk|tea|tee|wein|bier|merch|essentials|workshop|^mvsm$|cold brew|süss|sussig", ptype, re.I):
                continue
            if host == "martermuehle.de" and (not re.search(r"kaffee|espresso", ptype, re.I) or re.search(r"paket|pads|sack", ptype, re.I)):
                continue  # merch, sugar, tours, bundles
            if host == "murnauer-kaffeeroesterei.de" and (ptype != "Kaffee" or "set" in [t.lower() for t in p.get("tags") or []]
                                                           or re.search(r"aromareise|adventskalender|des monats|probiert|genuss-box|cup of excellence", p["title"], re.I)):
                continue  # sets, monthly/waitlist pages, everything that isn't a single coffee
            tags = p.get("tags") or []
            tag_text = " ".join(t.split("_", 1)[-1] for t in tags)
            if host == "ninefine.de":  # structured tags
                fl = [t.split("_", 1)[1] for t in tags if t.startswith("flavor_")]
                text = clean(p.get("body_html")) + ("\nNotes: " + ", ".join(fl) if fl else "")
                text += "\nRöstung: " + " ".join(t.split("_", 1)[1] for t in tags if t.startswith("roast_"))
            elif host == "murnauer-kaffeeroesterei.de":  # "COUNTRY | REGION" / NAME / notes
                text = clean(p.get("body_html"))
                lines = text.split("\n")
                i = next((i for i, l in enumerate(lines) if "|" in l and countries(l)), None)
                if i is not None:
                    notes = next((l for l in lines[i + 2:i + 4] if FLAVOUR_RE.search(l)), "")  # may follow a subtitle
                    text = f"Herkunft: {lines[i]}\nNotes: {notes.replace('|', ',')}\n" + text
                if "kaffeeempfehlungen" in [t.lower() for t in tags]:
                    tag_text += " filter"  # the shop's filter recommendations (vs. espressoempfehlungen)
            else:
                text = clean(p.get("body_html"))
            opts = " ".join(" ".join(o.get("values", [])) for o in p.get("options", []))
            variants = []
            for v in p.get("variants", []):
                if re.search(r"gemahlen|ground|siebträger \(|herdkanne|french|filter \(", v.get("title", ""), re.I) and not re.search(r"ganze bohne|whole", v.get("title", ""), re.I):
                    continue
                variants.append((v.get("title", "") + " " + (v.get("option1") or ""), float(v.get("price") or 0)))
            if not any(weight_g(l) for l, _ in variants):  # e.g. "Default Title"; size only in the text
                variants = [(labelled(text, r"inhalt"), pr) for _, pr in variants]
            add(host, p["title"], f"https://{host}/products/{p['handle']}", text, tag_text + " " + ptype, opts, variants,
                any(v.get("available") for v in p.get("variants", [])))
        else:  # WooCommerce Store API
            cats = [html.unescape(c["name"]) for c in p.get("categories", [])]
            catstr = " ".join(cats)
            if not re.search(r"kaffee|coffee|blends|entkoffeiniert|specialties|single origins|lazard|muffat|ribollita|tuchmacher|gloria|bayerischer hof", catstr, re.I) and cats:
                continue
            if re.search(r"zubeh|kapseln|ese pads|tassen", catstr, re.I):
                continue
            if host == "vitsderkaffee.de" and any(c.startswith("COFFEE") for c in cats) and not any(c.startswith("KAFFEE") for c in cats):
                continue  # English duplicate of a German listing
            text = clean((p.get("short_description") or "") + "\n" + (p.get("description") or ""))
            if host == "vitsderkaffee.de":
                page = os.path.join(RAW, "vits_pages", f"{p['id']}.html")
                if not os.path.exists(page):
                    report.append(f"skip {host}: {p['name']} (no public product page)")
                    continue
                pt = clean(re.sub(r"(?is)<(script|style|nav|header|footer)[^>]*>.*?</\1>", " ", open(page, encoding="utf-8", errors="ignore").read()))
                start = pt.find(html.unescape(p["name"]).split(",")[0][:20])
                end = min([i for i in (pt.find("Ähnliche Produkte"), pt.find("Zusätzliche Informationen"), pt.find("Bewertungen (")) if i > 0] or [len(pt)])
                text = pt[max(start, 0):end] + "\n" + text
            roast_attr = " ".join(t["name"] for a in p.get("attributes", []) for t in a.get("terms", []) if re.search(r"röstung", a["name"], re.I))
            if roast_attr and len(roast_attr.split("/")) == 1 and roast_attr.count("Röstung") <= 1:
                text = "Röstung: " + roast_attr + "\n" + text
            minor = int(p["prices"].get("currency_minor_unit", 2))
            price = int(p["prices"]["price"]) / 10 ** minor
            sizes = [t["name"] for a in p.get("attributes", []) for t in a.get("terms", []) if re.search(r"gewicht|inhalt|größe|menge", a["name"], re.I)]
            # Store API price is the cheapest variation; pair it with the smallest size
            gs = sorted(g for g in (weight_g(s) for s in sizes) if g)
            m = re.search(r"(\d+)\s*(g|gramm|kg)\b", text, re.I)
            label = f"{gs[0]} g" if gs else (m.group(0) if m else "")
            add(host, p["name"], p["permalink"], text, catstr, catstr + " " + text[:400], [(label, price)], bool(p.get("is_in_stock", True)))

# Dedupe by id (e.g. language duplicates)
seen, out = set(), []
for r in rows:
    if r["id"] in seen:
        continue
    seen.add(r["id"])
    out.append(r)

FIELDS = ["id", "roaster", "roaster_city", "name", "origin_countries", "region", "process", "varieties",
          "roast_level", "roast_for", "tasting_notes", "weight_g", "price_eur", "url", "available", "updated_at"]
with open(OUT, "w", newline="", encoding="utf-8") as f:
    w = csv.DictWriter(f, fieldnames=FIELDS, quoting=csv.QUOTE_MINIMAL)
    w.writeheader()
    w.writerows(out)
open(REPORT, "w").write("\n".join(report))
from collections import Counter
print(len(out), "rows;", dict(Counter(r["roaster"] for r in out)))
for k in ["origin_countries", "process", "roast_level", "roast_for", "tasting_notes", "weight_g", "varieties"]:
    print(f"  {k}: {sum(1 for r in out if r[k])}/{len(out)} filled")
