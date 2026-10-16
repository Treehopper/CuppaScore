# ☕ CupLog — Personal Coffee Rating PWA (Munich edition)

CupLog is an offline-first Progressive Web App for logging and rating every cup of coffee you drink. You rate cups against the **exact product and the individual bag** they came from, including how they were brewed, when, and what you ate with them. Over time the app builds a robust taste profile that is resistant to outliers and taste drift. A **pre-computed JSON catalog of coffees available in Munich** lets it recommend beans similar to the ones you liked.

---

## 1. Goals & non-goals

**Goals**
- Log a cup in **under 15 seconds** via one-tap presets built from your previous bag + brew-method choices.
- Cover both **home brewing** (incl. AeroPress and Flair NEO) and **café/restaurant coffee** with a reduced form.
- Be fun and readable: **4 colour themes** (Solarized light/dark, Crema, Espresso) and **4 languages** (de, en, it, es).
- Support **many ratings per day**, per bag, per product, at **three rating levels** (swipe, stars, advanced) that can be freely mixed and still add up to one "more of this / less of this" preference.
- Produce **robust scores**: averages, trimmed means, outlier exclusion, time-weighted scores that follow your changing taste.
- Separate **bean quality** from **context effects** (brew method, freshness, time of day, meal).
- Recommend **purchasable coffees in Munich** (shops and online orders from Munich roasters) that match your preferences.
- Work fully **offline**. Your data stays on the device, with export/import.
- Run on **Android and iOS as a home-screen app** (installed PWA, standalone, no app store).
- Offer **routine-aware reminders**, e.g. "remind me at 10:00 if I haven't logged anything". They are opt-in on the welcome screen and shown **inside the app when you open it**. There is no server and no push.
- Keep **storage and evaluation logic free of UI dependencies**, so a backend can later be split off and run on a server for a community app (section 8).

**Non-goals (v1)**
- No server of any kind, no social features, accounts or cloud sync. v1 is **single-user and fully on-device**, but the architecture keeps a later backend possible (section 8).
- No push or system notifications while the app is closed (section 12.1).
- No live scraping from the app itself. The catalog is built offline and shipped as static JSON.

---

## 2. Core concepts

| Concept | Meaning | Example |
|---|---|---|
| **Product** | A specific coffee as sold by a roaster | "Vits – Ethiopia Guji Natural, 250 g" |
| **Bag** | One physical bag of a product you bought | Bag #3 of that product, roasted 2026-10-02 |
| **Brew** | One preparation of coffee from a bag | V60, 15 g / 250 g, 93 °C |
| **Rating** | Your evaluation of one cup from one brew | 4.0 ★, fruity, with a croissant, 08:10 |
| **Catalog coffee** | A product in the pre-computed Munich database | Not yet bought, candidate for recommendation |

Products, bags and brews are separate entities on purpose. The same product can taste different from bag to bag (roast batch, age), and the same bag can taste different by brew method.

---

## 3. User stories

### Epic A — Products & bags
- **A1** As a user, I want to add a product (roaster, name, origin, process, varietal, roast level, tasting notes from the label) so I can track it across purchases.
- **A2** As a user, I want to **scan the bag's barcode or photograph the label** so I don't have to type product details. *(Barcode → catalog lookup; label photo stored as an image.)*
- **A3** As a user, I want to pick a product from the **Munich catalog** when adding a bag, so the details are prefilled.
- **A4** As a user, I want to register an **individual bag** with roast date, best-before/expiry date, purchase date, price, weight, shop and an optional bag label ("Bag #3").
- **A5** As a user, I want to mark the **opening date** of a bag so the app can track freshness after opening.
- **A6** As a user, I want to see **bag status** (unopened / open / finished) and the estimated cups left.
- **A7** As a user, I want a warning when a bag is **past expiry** or more than *N* days past roast, so I know why a cup might taste flat.

### Epic B — Logging a cup
- **B1** As a user, I want a **quick-log** that offers my **recent bag + brew-method combinations as one-tap presets** (most likely first), so logging takes one or two taps. *(See 4.5 Presets and 9.2 Quick Log.)*
- **B1a** As a user, I want the preset to fill in **my last parameters** for that bag + method (dose, grind, time …) so I only touch the rating.
- **B1b** As a user, I want to change bag or method from a **short dropdown of my previous choices** (open bags first, then recently used methods) instead of browsing everything.
- **B2** As a user, I want to choose whether the cup was **made by me (home)** or **made professionally (café/restaurant)**, because what I can record differs a lot.
- **B2a — Home brewing.** As a user, I want to pick from my own equipment: **AeroPress**, **Flair NEO** (manual lever espresso), espresso machine, V60, Chemex, Kalita, French press, moka pot, filter machine, cold brew, bean-to-cup machine. I also want optional method-specific parameters:
  - common: dose, water/yield, grind setting, water temperature, brew time, milk (none/dairy/oat/…)
  - **AeroPress:** standard / inverted, steep time, paper / metal filter, bypass water
  - **Flair NEO:** basket (flow-control / standard), preheat yes/no, preinfusion time, perceived pressure (low / medium / high), yield, shot time
  - I can hide methods I don't own in Settings.
- **B2b — Café / restaurant.** As a user, I want a **reduced form** for coffee made by someone else, because I don't know most of the details:
  - **venue** (picked from places I've rated before, or new)
  - **drink type**: espresso, doppio, ristretto, americano, cappuccino, flat white, latte, cortado, macchiato, filter / batch brew, pour-over, cold brew, other
  - milk (none / dairy / plant / unknown), size (small / regular / large)
  - **bean, only if known** ("house blend", or a roaster/product from the catalog if the menu or barista says so)
  - price (optional)
  - no dose, grind, temperature or bag. Rating, strength, profile, meal and time of day work the same as at home.
- **B2c** As a user, I want **"Same as last time here"** when I'm back at a café, so a repeat visit is one tap.
- **B3** As a user, I want to choose a **rating level** for each cup, depending on how much time and attention I have:
  - **Very simple – Swipe:** swipe **right = "more of this"**, **left = "less of this"**. One gesture, done.
  - **Simple – Stars:** 0.5–5 stars (half steps).
  - **Advanced – Detail:** stars plus **strength/intensity** (1–5), **flavour profile** sliders (acidity, sweetness, bitterness, body, aftertaste), flavour tags (chocolate, nutty, berry, citrus, floral, caramel, earthy, …) and optionally, per attribute, **"wish: more / just right / less"** (e.g. "sweetness 2, I'd like more").
- **B3a** As a user, I want to **mix levels freely**: the same bag and brew method can get a swipe on Monday, stars on Tuesday and a detailed rating on Saturday. All of them count.
- **B3b** As a user, I want a **default level** (set on the welcome screen and in Settings) and a one-tap switch on the log screen. The app remembers the last level used per preset, so my quick weekday AeroPress stays a swipe and my weekend Flair shot opens in Detail.
- **B3c** As a user, I want swipes to have **button alternatives** (👎 / 👍) for accessibility and one-handed use, and an **Undo** after every swipe.
- **B4** As a user, I want each product and bag to show **one combined "more of this" score**, no matter which levels I used, plus the star average and flavour profile where I gave that much detail.
- **B5** As a user, I want **time of day** recorded automatically (with manual override) so I can see if I prefer different coffees in the morning vs afternoon.
- **B6** As a user, I want to tag the **accompanying meal**: none / sweet / savory / mixed, with an optional free-text note ("Brezn", "Croissant").
- **B7** As a user, I want to optionally mark **"would buy again"** (yes/no) at the Stars and Detail levels.
- **B8** As a user, I want to log **multiple cups per day**, even from the same bag, without the app merging them.
- **B9** As a user, I want to flag a cup as **"not representative"** (machine problem, I was ill, rushed brew) so it is excluded from stats but still kept.
- **B10** As a user, I want to edit or delete a rating afterwards.

### Epic C — Statistics & insights
- **C1** As a user, I want to see each product's and each bag's **mean, median, trimmed mean, count and spread**.
- **C2** As a user, I want **outliers excluded automatically** (with a toggle to include them and a list of what was excluded).
- **C3** As a user, I want a **recency-weighted score** that reflects my *current* taste, because my preferences change.
- **C4** As a user, I want to see a **trend chart** of my ratings for a bag over its lifetime, to spot when it goes stale.
- **C5** As a user, I want to compare a product **by brew method** ("this one is great as espresso, mediocre as V60").
- **C6** As a user, I want to see how **meal type** and **time of day** affect my ratings ("I rate acidic coffees higher with sweet food").
- **C7** As a user, I want a **taste profile summary** ("You favour medium roasts, natural process, chocolate/berry notes, medium body").
- **C8** As a user, I want **cost per cup** and cost-vs-rating per product.
- **C9** As a user, I want to see a **venue ranking** (best café for a cappuccino, best espresso in town) based on my café ratings.
- **C10** As a user, I want café and home ratings **kept apart in product scores**. A café cup only counts towards a product when the bean is known, and it is flagged as "café-made".

### Epic D — Recommendations
- **D1** As a user, I want a **"You might like"** list from the Munich catalog, ranked by similarity to coffees I rated highly.
- **D2** As a user, I want each recommendation to **explain why** ("similar to Bag #3 of X: washed Ethiopian, floral/citrus, light roast").
- **D3** As a user, I want to filter recommendations by **brew method** ("good for espresso"), price, roaster, shop location or "order online".
- **D4** As a user, I want recommendations **by context** ("for mornings with something sweet").
- **D5** As a user, I want to **dismiss** a recommendation or save it to a **wishlist**.
- **D6** As a user, I want to see **where to buy** each recommended coffee in Munich (shop address, roaster webshop link).
- **D7** As a user, I want an **exploration slot** ("something different you might enjoy") so I don't get stuck in a bubble.

### Epic E — Data & app
- **E1** As a user, I want the app to **work offline** and be installable on my phone's home screen.
- **E2** As a user, I want to **export/import** all my data as JSON (and ratings as CSV) for backup.
- **E3** As a user, I want the catalog to **update** when a new version is published, without losing my data.
- **E4** Reminders: see Epic F.
- **E5** As a user, I want to choose a **colour theme**: Solarized Light, Solarized Dark, Crema (brown light), Espresso (brown dark), or "follow system", which pairs one light with one dark theme. *(See section 10.)*
- **E6** As a user, I want the app in **German, English, Italian or Spanish**, auto-detected from my device and switchable in Settings, including dates, numbers and decimal separators in my locale.
- **E7** As a user, I want flavour tags, brew methods and drink types **translated**. Catalog tasting notes keep the roaster's original wording, while the mapped tags are shown in my language.

### Epic F — Reminders
- **F1** As a user, I want to be asked on the **welcome screen** whether I want reminders, with a sensible suggestion I can accept in one tap.
- **F1a** As a user, I accept that reminders appear **when I open the app** (or switch back to it), not as notifications while it is closed.
- **F2** As a user, I want **conditional reminders** such as "remind me at **10:00 if I didn't record anything** today". If I open the app at 10:40 without having logged, I see the reminder; if I already logged, I see nothing.
- **F3** As a user, I want **several reminder rules** that fit my routine, for example:
  - 10:00 on weekdays if nothing is logged yet
  - 15:30 if I've logged fewer than 2 cups today
  - 2 hours after my last log, between 08:00 and 18:00 ("rate the cup you just had?")
  - a fixed daily time, unconditional
  - 2 days before an open bag expires
- **F4** As a user, I want rules per **weekday set** (e.g. different times on weekends) and global **quiet hours**.
- **F5** As a user, I want the reminder banner to offer **"Log now"** (quick log with my most likely preset selected), **"Later"** (show again in 30 min if the app is still open, or on next open after that) and **"Not today"**.
- **F5a** As a user, if several reminders are due when I open the app, I want to see **one combined banner**, not a stack of messages.
- **F5b** As a user, if the app is already open when a reminder time passes, I want the banner to appear right then.
- **F6** As a user, I want to **pause** all reminders (e.g. on holiday until a date) and see **when the next reminder is due**.
- **F8** As a user, I optionally want to **add a fixed-time rule to my phone's calendar** (`.ics` export), so the OS reminds me even when CupLog is closed. This is unconditional, because the calendar can't know whether I logged.
- **F7** As a user, I want reminders to respect **my time zone** and adjust when I travel.

### Epic G — Platforms (Android & iOS, pinned to the home screen)
- **G1** As an Android user, I want to **install the app** from Chrome (or Samsung Internet / Edge) via an install button, so it opens full-screen from my home screen.
- **G2** As an iPhone user, I want **clear instructions** for *Share → Add to Home Screen* in Safari, because iOS has no install prompt.
- **G3** As a user, I want the installed app to feel native: no browser bars, correct status-bar colours per theme, safe-area handling for notches and gesture bars, a splash screen and a proper icon.
- **G4** As a user, I want the app to work **offline after install**, including the camera for barcode scanning.
- **G5** As a user, I want my data to **survive** OS storage clean-ups, and to be reminded to **export** occasionally as a backup.

---

## 4. Data model

In v1, all user data is stored in **IndexedDB** (via Dexie.js), but only behind repository interfaces (section 8). IDs are client-generated UUIDv7. Timestamps are ISO-8601 with offset (Europe/Berlin). Every record also carries the server-ready fields `ownerId`, `createdAt`, `updatedAt`, `deletedAt` and `rev` (section 8.3). They are omitted from the examples below for brevity.

### 4.1 Product
```json
{
  "id": "prod_7f3c…",
  "catalogId": "vits-ethiopia-guji-natural",
  "roaster": "Vits der Kaffee",
  "name": "Ethiopia Guji Natural",
  "origin": { "country": "Ethiopia", "region": "Guji", "farm": null, "altitudeM": 2100 },
  "process": "natural",
  "varietals": ["Heirloom"],
  "roastLevel": 2,
  "roastFor": ["filter"],
  "isBlend": false,
  "labelNotes": ["blueberry", "dark chocolate", "jasmine"],
  "decaf": false,
  "barcode": "4260…",
  "photo": "blob-ref",
  "createdAt": "2026-10-15T08:00:00+02:00"
}
```
`roastLevel`: 1 = very light … 5 = dark. `roastFor`: filter / espresso / omni.

### 4.2 Bag
```json
{
  "id": "bag_91a2…",
  "productId": "prod_7f3c…",
  "label": "Bag #3",
  "weightG": 250,
  "priceEur": 16.9,
  "shop": "Vits, Rumfordstraße",
  "purchasedAt": "2026-10-05",
  "roastDate": "2026-10-02",
  "expiryDate": "2027-04-02",
  "openedAt": "2026-10-06",
  "finishedAt": null,
  "form": "beans",
  "storage": "airtight canister",
  "notes": ""
}
```
`form`: beans / ground / capsules / pods.

### 4.3 Rating (one cup)
Every rating has a `level`: `"swipe"`, `"stars"` or `"advanced"`. Only the fields of that level are stored; the rest are absent (not zero). The combined preference score is **derived at query time**, never stored (section 5.1).

Swipe (very simple):
```json
{
  "id": "rat_a11f…",
  "level": "swipe",
  "source": "home",
  "bagId": "bag_91a2…",
  "productId": "prod_7f3c…",
  "presetId": "pre_aeropress_bag3",
  "ratedAt": "2026-10-16T07:45:00+02:00",
  "timeOfDay": "early",
  "brew": { "...": "copied from preset" },
  "swipe": "more",
  "meal": { "type": "unspecified" },
  "excluded": false
}
```
`swipe`: `"more"` (right) / `"less"` (left). `meal.type` may be `"unspecified"` at the swipe level, because swipes don't require any extra tap.

Advanced (home-made cup):
```json
{
  "id": "rat_c4d0…",
  "level": "advanced",
  "source": "home",
  "bagId": "bag_91a2…",
  "productId": "prod_7f3c…",
  "presetId": "pre_aeropress_bag3",
  "ratedAt": "2026-10-15T08:10:00+02:00",
  "timeOfDay": "morning",
  "brew": {
    "method": "aeropress",
    "doseG": 15, "waterG": 230, "yieldG": null,
    "grind": "Comandante 18 clicks",
    "tempC": 90, "timeS": 120,
    "milk": "none",
    "methodParams": { "orientation": "inverted", "filter": "paper", "bypassG": 0 }
  },
  "overall": 4.0,
  "strength": 3,
  "profile": { "acidity": 4, "sweetness": 3, "bitterness": 1, "body": 2, "aftertaste": 4 },
  "flavourTags": ["berry", "floral"],
  "wish": { "sweetness": "more", "acidity": "justRight", "bitterness": "justRight" },
  "meal": { "type": "sweet", "note": "Croissant" },
  "wouldBuyAgain": true,
  "excluded": false,
  "excludeReason": null,
  "derived": { "daysSinceRoast": 13, "daysSinceOpen": 9, "pastExpiry": false },
  "note": ""
}
```
`methodParams` for a Flair NEO shot, for example:
```json
{ "basket": "flow-control", "preheat": true, "preinfusionS": 8, "pressure": "medium" }
```
(with `doseG: 16, yieldG: 36, timeS: 40` in `brew`).

Café-made cup, rated at the stars level here (bag, dose, grind etc. are absent):
```json
{
  "id": "rat_e81b…",
  "level": "stars",
  "source": "cafe",
  "venueId": "ven_vits_rumford",
  "bagId": null,
  "productId": null,
  "beanKnown": "house",
  "ratedAt": "2026-10-15T14:20:00+02:00",
  "timeOfDay": "afternoon",
  "cafe": { "drink": "cappuccino", "milk": "dairy", "size": "regular", "priceEur": 3.9 },
  "overall": 4.5,
  "meal": { "type": "sweet", "note": "Zwetschgendatschi" },
  "excluded": false
}
```
`beanKnown`: `"unknown"` / `"house"` / a `productId` or `catalogId` when the café names the bean.

- `timeOfDay` buckets: early (<07:00), morning (07–11), midday (11–14), afternoon (14–18), evening (>18).
- `meal.type`: none / sweet / savory / mixed / unspecified.
- Fields per level: **swipe** → `swipe`; **stars** → `overall`, optional `wouldBuyAgain`; **advanced** → `overall`, `strength`, `profile`, `flavourTags`, optional `wish`, `wouldBuyAgain`. Brew/café context, meal and time of day can be recorded at every level.
- `strength` is *perceived* intensity. The brew ratio (`waterG/doseG`) is stored separately and allows "perceived vs actual" analysis.
- `derived` is computed on save, so stats queries stay simple.

### 4.4 Venue (café / restaurant)
```json
{ "id": "ven_vits_rumford", "name": "Vits", "address": "Rumfordstraße …", "lat": 48.13, "lng": 11.58, "catalogSellerId": "vits", "lastDrink": "cappuccino" }
```

### 4.5 Presets (powering the quick log)
Presets are **derived automatically** from your history; you never have to create them. A preset is a combination you've used before:
- home: `bagId + method + last methodParams/dose/grind`
- café: `venueId + drink + milk + size`

```json
{ "id": "pre_aeropress_bag3", "source": "home", "bagId": "bag_91a2…", "method": "aeropress",
  "lastBrew": { "...": "copied from the latest rating" }, "uses": 14, "lastUsedAt": "2026-10-15T08:10:00+02:00", "pinned": false }
```

**Ranking** on the quick-log screen: `score = 0.5·recency + 0.3·frequency + 0.2·timeOfDayMatch`. Recency decays over days. Frequency counts uses in the last 30 days. `timeOfDayMatch` means "you usually make the Flair shot in the morning and the AeroPress in the afternoon". Presets whose bag is finished or past expiry are hidden. Pinned presets always come first. The top 3–4 are shown as big chips.

### 4.6 Settings & recommendation state
- **Domain settings** (stored via the API, would move to the server): decay half-life, outlier method, owned brew methods, **reminder rules** (4.7), time zone, `wishlist[]`, `dismissed[]`, `onboardingCompletedAt`.
- **UI preferences** (stored locally by the UI only, never in the domain): theme, language, last mode (Home/Café), collapsed panels.
- **Device state:** `catalogVersion`, cache metadata, install state, reminder bookkeeping (`lastCheckedAt`, per-rule `shownOn` / `snoozedUntil` / `dismissedOn`).

### 4.7 Reminder rules
```json
{
  "reminders": {
    "enabled": true,
    "timeZone": "Europe/Berlin",
    "quietHours": { "from": "21:30", "to": "07:00" },
    "pausedUntil": null,
    "rules": [
      { "id": "rem_1", "kind": "nothingLoggedBy", "time": "10:00", "days": ["MO","TU","WE","TH","FR"], "enabled": true },
      { "id": "rem_2", "kind": "nothingLoggedBy", "time": "11:30", "days": ["SA","SU"], "enabled": true },
      { "id": "rem_3", "kind": "fewerThanBy", "count": 2, "time": "15:30", "days": "all", "enabled": false },
      { "id": "rem_4", "kind": "afterLastLog", "hours": 2, "window": { "from": "08:00", "to": "18:00" }, "enabled": false },
      { "id": "rem_5", "kind": "fixedDaily", "time": "20:00", "days": "all", "enabled": false },
      { "id": "rem_6", "kind": "bagExpiring", "daysBefore": 2, "time": "09:00", "enabled": true }
    ]
  }
}
```
Rule kinds are an enum, so new kinds can be added without UI text in the core. Evaluation is pure `core` logic and runs on the device whenever the app is opened (section 12).

---

## 5. Rating aggregation

Raw averages lie when you rate often and your taste moves. CupLog computes several scores and shows the **robust score** by default.

### 5.1 Rating levels → one preference score
Each rating, whatever its level, is mapped at query time to a **preference value `p` ∈ [−1, +1]** ("less of this" … "more of this") with a **confidence `c`**. All downstream logic (outliers, drift, context model, recommendations) works on `(p, c)`, so levels can be mixed freely.

| Level | Raw input | `p` | `c` (default) |
|---|---|---|---|
| Swipe | right / left | `+p⁺` / `−p⁻` (calibrated, see below; default ±0.5) | 0.5 |
| Stars | 0.5–5 ★ | personal z-score of the stars, clipped to ±2 and divided by 2 | 1.0 |
| Advanced | stars + details | same as Stars (the overall stars carry the preference) | 1.2 |

- **Personal centring:** stars are converted relative to *your own* recency-weighted star mean and spread, so a habitual 4-star rater and a strict 3-star rater both end up with "above my usual" = positive `p`. With fewer than 10 star ratings, a fixed mapping is used (3 ★ → 0, 5 ★ → +1, 1 ★ → −1).
- **Swipe calibration:** once there are ≥ 10 star/advanced ratings, `p⁺` is set to the median `p` of your positive star-rated cups and `p⁻` to the median magnitude of your negative ones. A right swipe then "means" what a typical good cup means for you.
- **Confidence** reflects how deliberate the input was. Five swipes don't outweigh two careful detailed ratings, but they still move the score. The weights can be changed in Settings → Advanced.
- **Attribute signals (advanced only):** `profile` values update the product's *perceived* sensory vector (7.1), and `wish` values ("sweetness: more") nudge your **target profile** directly (7.2). Swipes and stars don't touch attributes.
- `wouldBuyAgain` adds a small bonus or penalty (±0.1) to `p`, clipped to [−1, +1].

The **combined score** of a bag, product or context is the weighted mean `P = Σ cᵢ·wᵢ·pᵢ / Σ cᵢ·wᵢ` over non-excluded ratings, where `wᵢ` is the recency weight (5.3).

### 5.2 Outlier exclusion
Runs on `p`, so it works across levels. Per bag (fallback: per product when a bag has < 5 ratings):
1. Drop ratings marked `excluded: true` (manual, B9).
2. Compute the median *m* and the **median absolute deviation** MAD.
3. Robust z-score: `z = 0.6745 · (x − m) / MAD`. Exclude if `|z| > 3.5` (Iglewicz–Hoaglin).
4. If MAD = 0 or n < 5: skip automatic exclusion (too little data) and show the **trimmed mean** (drop top and bottom 10 %) instead.

Excluded cups are listed in the UI with the reason ("auto: robust z = 4.1").

### 5.3 Taste drift — time-weighted score
Each rating gets weight `w = 0.5 ^ (ageDays / halfLife)`, default `halfLife = 60` days (configurable). The **current score** is the weighted mean of non-outlier `p` values (with confidence `c`, see 5.1). This is what drives recommendations, so a coffee you loved a year ago but now find too bitter fades out.

### 5.4 Context-adjusted score
To separate "this bean is good" from "I was having cake", fit a small additive model over all your ratings:

```
p ≈ μ + product_i + method_j + meal_k + timeOfDay_l + freshness(daysSinceRoast) + ε      (weighted by c·w)
```
`meal = unspecified` (typical for swipes) is its own level with a zero-centred prior, so swipes still inform product and method effects without distorting meal effects.

For café cups, `method_j` is replaced by `drink_j` and a `venue_v` term is added. The freshness term is dropped, and `product_i` is only included when the bean is known. This way café cups inform your meal and time-of-day preferences without distorting bean scores.

Fit with weighted ridge-regularised least squares (closed form, runs in a Web Worker in milliseconds for thousands of ratings). Report:
- **Bean score** = μ + product_i (context-neutral). Used for ranking your products.
- **Context effects**, e.g. "+0.4 with sweet food", "−0.3 for French press". Used for insights (C6) and context recommendations (D4).
- **Freshness curve**: a piecewise-linear term over days since roast (buckets 0–7, 8–21, 22–42, 43+). This shows your personal peak window.

Interaction terms (e.g. *acidity × sweet meal*) are added only once there are ≥ 50 ratings, to avoid overfitting.

### 5.5 Displayed per product / bag
- **"More of this" score** (from P, shown as −100 … +100 and a gauge from ☕− to ☕+), with `n` per level ("12 cups: 7 swipes · 4 stars · 1 detailed").
- **Star average**, median and trimmed mean, from stars + advanced ratings only (hidden if there are none).
- **Flavour profile** radar and "wish" summary ("you often want it sweeter"), from advanced ratings only.
- Bean score, spread, sparkline over time, best method, best meal pairing, excluded outliers.

---

## 6. Munich coffee catalog (pre-computed JSON)

### 6.1 Purpose
A static `catalog.json` shipped with the app (and refreshed via the service worker). It covers coffees you can **buy in a Munich shop or order from a Munich-area roaster**. The PWA never scrapes. A separate offline build script produces the file.

### 6.2 Catalog schema
```json
{
  "version": "2026.10.15",
  "generatedAt": "2026-10-15T06:00:00+02:00",
  "featureSchema": 1,
  "sellers": [
    {
      "id": "vits",
      "name": "Vits der Kaffee",
      "type": "roaster-cafe",
      "addresses": [{ "street": "…", "zip": "…", "lat": 48.13, "lng": 11.58 }],
      "webshop": "https://…",
      "shipsTo": ["DE"],
      "pickup": true
    }
  ],
  "coffees": [
    {
      "id": "vits-ethiopia-guji-natural",
      "sellerIds": ["vits"],
      "roaster": "Vits der Kaffee",
      "name": "Ethiopia Guji Natural",
      "origin": { "country": "Ethiopia", "region": "Guji" },
      "process": "natural",
      "varietals": ["Heirloom"],
      "roastLevel": 2,
      "roastFor": ["filter"],
      "isBlend": false,
      "decaf": false,
      "tastingNotes": ["blueberry", "dark chocolate", "jasmine"],
      "flavourVector": { "fruity": 0.9, "floral": 0.6, "chocolate": 0.4, "nutty": 0.0, "caramel": 0.2, "spice": 0.0, "earthy": 0.0, "citrus": 0.3 },
      "sensory": { "acidity": 0.7, "sweetness": 0.6, "body": 0.4, "bitterness": 0.2 },
      "priceEurPerKg": 67.6,
      "sizesG": [250, 1000],
      "url": "https://…",
      "barcode": null,
      "available": true,
      "lastSeen": "2026-10-14",
      "source": "roaster-webshop"
    }
  ]
}
```

### 6.3 Build pipeline (`/catalog-builder`, Node, run manually or weekly via `catalog.yml`, which opens a PR; see 14.1)
1. **Seed sellers** from `sellers.yml` (hand-curated list, see 6.4).
2. **Fetch** product pages from each seller's webshop. Prefer structured data: Shopify `/products.json`, WooCommerce Store API, schema.org `Product` JSON-LD. Fall back to HTML parsing with per-shop adapters. Respect robots.txt and terms of use. Throttle requests.
3. **Normalise** fields: process synonyms (*washed/gewaschen/lavado*), roast level from text ("hell", "Filterröstung", "Espresso dunkel" → 1–5), origin to ISO country codes, price to €/kg.
4. **Map tasting notes → flavour vector** using a lexicon based on the SCA flavour wheel (`flavour-lexicon.json`, German + English: *Beere/berry → fruity*, *Nuss/hazelnut → nutty* …). Notes the lexicon doesn't cover are optionally classified by an LLM step, cached by note string.
5. **Estimate sensory axes** from process, roast level, origin and notes (rule-based priors, e.g. light washed Kenyan → high acidity; dark Brazilian blend → high body/bitterness).
6. **Deduplicate** (same roaster + normalised name), mark items not seen for 30 days as `available: false`.
7. **Validate** against a JSON Schema, write `apps/pwa/public/catalog.json` (+ `catalog.min.json`, gzip ~50–200 kB expected), bump `version`, and print a diff summary (added / removed / price changes) for the PR body.

### 6.4 Seed sellers (to verify before first build)
Munich roasters and shops mentioned in current coverage of the city's coffee scene:
- **Roasters / roaster-cafés:** Man versus Machine, Vits der Kaffee, gangundgäbe, JB Kaffee (Johannes Bayer), Supremo, Mahlefitz, stray coffee roasters, Nine Fine Roastery, Vogelmaier Kaffeerösterei, Schneid-Kaffee Rösterei, ALRIGHTY Caretrade Coffee
- **Shops stocking other roasters:** Kaffeekontor (carries e.g. District Five, Wildkaffee, JB Kaffee, Public Coffee Roasters), Sweet Spot Coffee (rotating guest roasters)
- **Nearby regional roasters often sold in Munich:** Dinzler (Irschenberg), Wildkaffee (Garmisch-Partenkirchen), District Five (Ingolstadt)
- **Optional:** supermarket/drugstore brands (barcode lookup via Open Food Facts) so everyday coffees can be logged too.

Sources: [European Coffee Trip](https://europeancoffeetrip.com/munichs-specialty-coffee-shops-are-growing-in-numbers/), [The Barn blog](https://thebarn.de/blogs/the-barn-blog/specialty-coffee-in-munich), [Caffeatlas](https://caffeatlas.com/stray-coffee-roasters-munich), [about-drinks](https://www.about-drinks.com/tag/rosterei/).

---

## 7. Recommendation engine (in `@cuplog/core`, runs client-side in v1)

### 7.1 Feature vector
Every product (yours and catalog) is encoded as a fixed-length vector:

| Block | Encoding | Weight |
|---|---|---|
| Flavour (8 dims) | `flavourVector` (from label notes + your flavour tags) | 0.35 |
| Sensory (4 dims) | acidity, sweetness, body, bitterness (0–1) | 0.25 |
| Roast level | (level − 1) / 4 | 0.15 |
| Process | one-hot: washed / natural / honey / anaerobic / other | 0.10 |
| Origin region | one-hot: East Africa / Central Am. / South Am. / Asia-Pacific / blend | 0.10 |
| Roasted for | filter / espresso / omni | 0.05 |

For *your* products, the sensory block is overwritten by the average of your own profile sliders once there are ≥ 3 **advanced** ratings. Your perception beats the label. Products rated only by swipe or stars keep the label/catalog values.

### 7.2 Taste profile
```
userVector = normalise( Σ P_i · v_i  +  λ · wishShift )
```
`P_i` is the combined, centred preference of product *i* (5.1), already recency- and confidence-weighted, so swipe-only, star-only and detailed products all contribute. Positively scored products pull the profile towards themselves, negatively scored ones push it away. `wishShift` moves the sensory part of the target in the direction of your recent advanced "wish" inputs (e.g. +sweetness), with λ = 0.2. Separate profiles are kept **per context** (method × meal × time-of-day bucket) when there is enough data (≥ 10 ratings), falling back to the global profile.

### 7.3 Scoring catalog coffees
```
score = cos(userVector, v_c)
      + 0.15 · max_sim_to_any_top3_product        (anchor to concrete favourites)
      − 0.20 · max_sim_to_any_disliked_product
      + 0.05 · methodMatch(roastFor, preferredMethods)
      − penalty(price above your usual range)
```
Exclude products already owned (by `catalogId`), dismissed items and `available: false`.

### 7.4 Explanations & exploration
- **Why:** show the nearest owned product and the top-2 shared features ("Like *Bag #3 of Guji Natural*: natural process, berry notes").
- **Exploration (D7):** 1 in 5 slots is drawn from items with moderate similarity (0.4–0.6) in an under-explored region or process.
- **Works from swipes alone:** a user who only ever swipes still gets recommendations, because every swipe yields a `p`. Explanations then rely on catalog features rather than your own flavour profile.
- **Cold start:** with < 5 rated products, a short onboarding quiz ("chocolatey or fruity?", "espresso or filter?") builds the initial vector.

---

## 8. Architecture

### 8.1 Principle: a UI-free core behind one API
Dependencies point **inwards only**. The UI talks to exactly one thing, the `CupLogApi` interface. Everything behind it (domain logic, statistics, recommendations, storage) has no knowledge of the DOM, Svelte, themes or translations.

```
┌───────────────────────────┐
│ apps/pwa  (UI)            │  Svelte, themes, i18n, service worker
│  depends only on ▼        │
├───────────────────────────┤
│ @cuplog/api               │  CupLogApi interface + DTOs (JSON, zod-validated)
│  LocalApi (now)  ─────────┼──► Web Worker (Comlink) ─┐
│  HttpApi  (later) ────────┼──► server over HTTPS ────┤
├───────────────────────────┤                          ▼
│ @cuplog/services          │  use cases: logRating, addBag, getStats, getRecommendations …
│  depends on ports ▼       │  ctx = { ownerId, clock, ids, rng }
├───────────────────────────┤
│ @cuplog/core              │  pure TS: entities, schemas, outliers, decay, context model,
│                           │  presets ranking, feature vectors, recommender
├───────────────────────────┤
│ ports (interfaces)        │  RatingRepo, BagRepo, ProductRepo, VenueRepo, SettingsRepo,
│                           │  MediaStore, CatalogSource, Clock, IdGenerator, UnitOfWork
├───────────────────────────┤
│ adapters                  │  now: storage-dexie, catalog-static
│                           │  later: storage-postgres, catalog-http, media-s3
└───────────────────────────┘
```

**Rules (enforced in CI with `dependency-cruiser`)**
- `core` imports nothing outside itself except `zod`. It never touches `window`, `document`, IndexedDB, `fetch`, `Date.now()` or `Math.random()`. Time and randomness are injected (`Clock`, `rng`), so stats and the recommender's exploration slot are deterministic and testable. It runs unchanged in browser, Web Worker, Node, Bun or Deno.
- `services` depend on `core` and **port interfaces** only, never on Dexie or any concrete adapter.
- `apps/pwa` may import `@cuplog/api` types and the `LocalApi` factory, and nothing else from the backend side.
- **No human-readable text leaves the core.** Results carry enum keys and structured data. Examples: `{ kind: "similarTo", productId, shared: ["process.natural", "flavour.berry"] }` for recommendation explanations, or `{ code: "BAG_FINISHED" }` for errors. The UI translates and formats them, so i18n stays a pure UI concern and a server can serve all languages.
- Dates cross the boundary as ISO strings. Formatting is done in the UI.

### 8.2 API contract (sketch)
```ts
export interface CupLogApi {
  // commands
  logRating(cmd: LogRatingCmd): Promise<RatingDto>;          // home or café
  updateRating(id: string, patch: RatingPatch): Promise<RatingDto>;
  setRatingExcluded(id: string, excluded: boolean, reason?: string): Promise<void>;
  deleteRating(id: string): Promise<void>;
  addProduct(cmd: AddProductCmd): Promise<ProductDto>;
  addBag(cmd: AddBagCmd): Promise<BagDto>;
  updateBag(id: string, patch: BagPatch): Promise<BagDto>;
  addVenue(cmd: AddVenueCmd): Promise<VenueDto>;
  updateSettings(patch: DomainSettingsPatch): Promise<DomainSettingsDto>;
  setReminderRules(cfg: ReminderConfigDto): Promise<ReminderConfigDto>;
  getNextReminders(limit?: number): Promise<FireTimeDto[]>;
  checkReminders(at: string): Promise<DueReminderDto[]>;       // called on open / foreground
  ackReminder(ruleId: string, action: "logged" | "later" | "notToday"): Promise<void>;
  setWishlist(catalogId: string, on: boolean): Promise<void>;
  dismissRecommendation(catalogId: string): Promise<void>;

  // queries
  listPresets(q: { source: "home" | "cafe"; at: string }): Promise<PresetDto[]>;
  listBags(q?: BagQuery): Promise<BagDto[]>;
  listVenues(q?: VenueQuery): Promise<VenueDto[]>;
  getBagStats(bagId: string, opts?: StatsOptions): Promise<StatsDto>;
  getProductStats(productId: string, opts?: StatsOptions): Promise<StatsDto>;
  getInsights(q?: InsightQuery): Promise<InsightsDto>;
  getRecommendations(q: RecoQuery): Promise<RecommendationDto[]>;
  searchCatalog(q: CatalogQuery): Promise<CatalogCoffeeDto[]>;

  // data
  exportAll(): Promise<ExportBundle>;
  importAll(bundle: ExportBundle, mode: "merge" | "replace"): Promise<ImportReport>;
  subscribe(topic: "ratings" | "bags" | "settings", cb: () => void): Unsubscribe;
}
```
Every method is **async and DTO-only** (plain JSON, validated with shared zod schemas on both sides). The same call can therefore cross a worker boundary today and an HTTP boundary later without changes. Commands and queries are kept apart, so the read side can later be cached or precomputed on a server.

### 8.3 Server-ready data conventions
- **IDs:** UUIDv7, generated on the client. They are sortable and collision-free, so offline-created records can be uploaded later without remapping. No auto-increment keys.
- **Ownership:** every record has `ownerId`, which is `"local"` in v1. Services receive it via `ctx` and repositories filter by it.
- **Sync fields:** `createdAt`, `updatedAt`, `deletedAt` (soft delete), `rev` (incremented per write, used for optimistic concurrency and later `changesSince(rev)` sync).
- **No storage-specific types in the domain:** photos are referenced by `mediaId` and stored through the `MediaStore` port (IndexedDB Blob now, object storage later).
- **Derived data is never the source of truth.** Stats, presets and recommendations are always recomputed from ratings. Any caching (e.g. memoised model fits) is an adapter/service detail, so a server can recompute freely.
- **Versioned export:** `ExportBundle { schemaVersion, exportedAt, records… }`. It doubles as the migration path, since uploading one bundle creates a server account's initial data.
- **Catalog** is read through `CatalogSource`. It is a static `catalog.json` now and a server endpoint later. The catalog builder reuses `core` for normalisation and feature vectors, so the app and the builder share one definition of "similar".

### 8.4 Runtime today (single user, browser only)
```
┌────────────── Browser / installed PWA ──────────────┐
│ Main thread: apps/pwa (UI, themes, i18n)            │
│      │ CupLogApi via Comlink (postMessage)          │
│ Web Worker: LocalApi → services → core              │
│      └─► storage-dexie (IndexedDB), catalog-static  │
│ Service Worker: app shell + catalog.json caching    │
└─────────────────────────────────────────────────────┘
        ▲ GitHub Pages (static, HTTPS)
        │ deployed by deploy.yml on every push to develop (section 14)
```
Running the backend side in a worker already enforces the separation physically: the UI cannot reach into storage, and heavy computation (model fit, recommendations) never blocks scrolling.

- **Stack:** pnpm workspaces, TypeScript, Vite + Svelte, zod, Dexie.js, Comlink, Workbox / vite-plugin-pwa, uPlot or Chart.js, ZXing (barcode).
- **Manifest:** `display: standalone`, theme colour follows the active theme, icons 192/512, shortcut "Log a cup".
- **Storage:** request `navigator.storage.persist()` on first run. Photos are compressed to ≤ 200 kB.
- **Reminders:** evaluated on the device when the app opens or returns to the foreground, and shown as in-app banners (section 12). No push, no notification permission.
- **Privacy:** no server, no analytics, no network calls except loading the app and `catalog.json` from GitHub Pages. Export is the backup path.

### 8.5 Future: community server
1. `apps/server` (Node or Bun with Hono/Fastify) imports `core` + `services` + a new `storage-postgres` adapter and exposes `CupLogApi` over HTTPS. The OpenAPI spec is generated from the same zod schemas (or tRPC is used directly).
2. Authentication provides real `ownerId`s. Services are unchanged, because they already take `ctx.ownerId`.
3. The PWA swaps `LocalApi` for `HttpApi`, or for a `SyncingApi` that keeps Dexie as an offline cache and pushes changes via `rev`.
4. A server could also take over **push reminders**, using the same `dueReminders` logic from core (see 12.4).
5. Community features are **new services on top of the same core**: anonymised aggregate product scores, collaborative filtering ("people with your taste also liked …"), shared venue rankings, and a crowd-maintained catalog. The recommender gains an extra scoring term, and the UI only gains new screens.

### 8.6 Testing
- `core` and `services`: unit tests in Node with Vitest, no browser required. Property-based tests (fast-check) cover outlier detection, decay and preset ranking.
- **Repository contract tests** run against every adapter (Dexie via `fake-indexeddb` now, Postgres later).
- **API contract tests** run the same suite against `LocalApi` now and `HttpApi` later.
- UI tests use an in-memory `CupLogApi` mock and test nothing below the API.

---

## 9. Screens & UX

### 9.1 Welcome (first launch)
A short, skippable flow of 4–5 cards. Everything can be changed later in Settings.

1. **Hello:** language (pre-selected from the device) and theme (Crema / Espresso / Solarized, with live preview).
2. **Install:** shown only if the app isn't running standalone yet.
   - *Android:* "Install CupLog" button (uses the browser's `beforeinstallprompt`).
   - *iOS (Safari):* a 3-step illustration: Share ⎋ → *Add to Home Screen* → open from the icon.
   - "Not now" is allowed. The card notes that the installed app keeps data more reliably and opens in one tap, which makes logging (and seeing reminders) easier.
3. **Your gear & rating style:** tick the brew methods you own (AeroPress, Flair NEO, V60 …), which seed the Method dropdown. Pick a default rating level: **Swipe** (fastest), **Stars** or **Detail**. It can be switched for any single cup.
4. **Reminders?**
   > *Should CupLog nudge you to rate your coffee when you open the app?*
   > ☑ **From 10:00 on weekdays, if you haven't logged anything yet** (suggested)
   > ☐ From 11:30 on weekends, if nothing is logged
   > ☐ From 15:30, if you've logged fewer than 2 cups
   > ☐ When an open bag expires within 2 days
   > *Reminders appear inside CupLog when you open it. Your phone won't notify you while the app is closed.*
   > [ Enable reminders ]  [ Not now ]
   - Times are editable inline. No system permission is needed, so this works the same on Android and iOS, installed or not.
   - A small link, "Also add a daily reminder to my calendar", exports an `.ics` for one fixed time (F8). This is the only way to get a nudge while the app is closed.
5. **Taste quick-start (optional):** a 3-question cold-start quiz (7.4).

The flow is marked complete in `onboardingCompletedAt`. If the user chose "Not now" for reminders, one later prompt is shown after the first week of logging, never more.

### 9.2 Quick Log (home)
```
┌───────────────────────────────┐
│  [ 🏠 Home ]  [ ☕ Café ]      │  ← segmented toggle, remembers last
│                               │
│  ● AeroPress · Guji Bag #3    │  ← preset chips, best first
│  ○ Flair NEO · Supremo Bag #1 │
│  ○ Vits · Cappuccino          │  (café presets appear in Café mode)
│  Bag ▾   Method ▾             │  ← dropdowns of previous choices only
│                               │
│  Rate: [ Swipe | ★ Stars | Detail ]  ← level switch, remembered per preset
│                               │
│  Stars:   ★★★★☆               │
│  Meal: None · Sweet · Savory · Mixed
│  [ Save ]                     │
└───────────────────────────────┘
```
Swipe level replaces the rating area with a card:
```
┌───────────────────────────────┐
│ ◀ less of this   more of this ▶│
│   ┌───────────────────────┐   │
│   │ AeroPress · Guji #3   │   │  ← drag left/right; card tilts, edge glows
│   │ 07:45 · 14 d after roast │ │     red/green; release past 30 % = saved
│   └───────────────────────┘   │
│      [ 👎 ]        [ 👍 ]      │  ← button alternatives
│  Meal (optional): Sweet · Savory
└───────────────────────────────┘
```
Detail level expands below the stars: strength ①–⑤, profile sliders, each with a small ↑ / = / ↓ "wish" toggle, flavour tags and "would buy again".
- One tap on a preset + one swipe = a complete log (Swipe level). Stars level = preset + stars + Save. All parameters are copied from the preset.
- **Bag ▾** lists open bags first (by last use), then unopened ones. "Add bag…" is at the bottom.
- **Method ▾** lists only your owned methods, sorted by use. In café mode it becomes **Drink ▾**, and **Venue ▾** lists previous venues (nearest first if location is allowed).
- "Brew details ▾" expands method-specific parameters (AeroPress / Flair NEO fields) or, in café mode, milk/size/bean/price, at any rating level.
- Save → toast with "Undo". The preset's `uses` and `lastUsedAt` are updated.

### 9.3 Other screens
1. **Bags:** list grouped by status. Each card shows the robust score, n cups, freshness and expiry badge. Tap → bag detail with rating timeline, excluded outliers and per-method breakdown.
2. **Products:** all products ever bought, ranked by bean score, with bag-to-bag comparison.
3. **Stats / Insights:** taste-profile radar chart, context effects (meal, time of day, method), personal freshness curve, cost per cup, rating distribution.
4. **Discover:** recommendation cards (score, why-text, price/kg, where to buy, map link), filters, wishlist, "something different" slot.
5. **Add bag:** scan barcode → catalog match → confirm roast/expiry date → done. Manual entry fallback.
6. **Settings:** theme, language, owned brew methods, **default rating level**, rating-level weights (Advanced), **reminders** (list of rules with toggles, add rule, quiet hours, pause until …, "next reminder: tomorrow 10:00", test notification), half-life slider, outlier method (MAD / trimmed / off), reminders, export/import, catalog version + "check for update".
7. **Venues:** café list with venue ranking per drink type, visit count and "same as last time".

---

## 10. Themes

Themes are implemented as CSS custom properties on `:root[data-theme="…"]`. All components use only semantic tokens (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--accent-2`, `--border`, `--star`, `--good`, `--bad`). Adding a theme therefore means adding one block of variables. With the "System" option the app follows `prefers-color-scheme` and lets you choose which light and which dark theme to pair. The manifest `theme_color` is updated at runtime to match.

| Token | Solarized Light | Solarized Dark | ☕ Crema (light) | ☕ Espresso (dark) |
|---|---|---|---|---|
| `--bg` | `#fdf6e3` | `#002b36` | `#f7efe4` (milk foam) | `#1e1410` (roasted bean) |
| `--surface` | `#eee8d5` | `#073642` | `#efe1cc` (latte) | `#2b1d17` (espresso) |
| `--text` | `#586e75` | `#93a1a1` | `#3b2a20` (dark roast) | `#f1e4d3` (crema) |
| `--muted` | `#93a1a1` | `#586e75` | `#8a7262` | `#a68b75` |
| `--accent` | `#b58900` (yellow) | `#b58900` | `#a0522d` (sienna) | `#d4a373` (caramel) |
| `--accent-2` | `#268bd2` (blue) | `#2aa198` (cyan) | `#6b8f5e` (coffee leaf) | `#e9c46a` (honey) |
| `--border` | `#e4ddc8` | `#0d4a57` | `#dcc7ab` | `#3d2a20` |
| `--star` | `#cb4b16` | `#cb4b16` | `#c47a2c` | `#e0a24e` |
| `--good` / `--bad` | `#859900` / `#dc322f` | `#859900` / `#dc322f` | `#5f8b4c` / `#b23a2a` | `#8fb573` / `#e06c5a` |

Solarized values follow Ethan Schoonover's official palette. The two coffee themes add playful touches: a crema-coloured rating slider, bean-shaped star icons, a steam animation on Save (disabled under `prefers-reduced-motion`) and a coffee-ring empty state. All text/background pairs must pass **WCAG AA (4.5:1)**, which is checked in CI with a contrast test.

---

## 11. Localisation (de · en · it · es)

- **Library:** `svelte-i18n` (or `i18next` with React) with ICU message format for plurals ("1 Tasse / 3 Tassen").
- **Files:** `/src/i18n/{de,en,it,es}.json`, keyed by namespace (`log.*`, `stats.*`, `reco.*`, `brew.*`, `flavour.*`, `meal.*`). English is the source and fallback.
- **Detection:** `navigator.languages` → first supported match, else English. Can be overridden in Settings and is stored locally.
- **Formatting:** `Intl.DateTimeFormat`, `Intl.NumberFormat` and `Intl.RelativeTimeFormat` ("vor 3 Tagen", "hace 3 días"). Decimal comma in de/it/es. 24-h clock in all four.
- **Domain vocabulary** is translated through enums, never free text. Examples:

| key | en | de | it | es |
|---|---|---|---|---|
| `meal.sweet` | Sweet | Süß | Dolce | Dulce |
| `meal.savory` | Savory | Herzhaft | Salato | Salado |
| `brew.frenchPress` | French press | French Press | Caffettiera a stantuffo | Prensa francesa |
| `brew.moka` | Moka pot | Espressokocher | Moka | Cafetera italiana |
| `drink.batch` | Batch brew | Filterkaffee | Caffè filtro | Café de filtro |
| `flavour.nutty` | Nutty | Nussig | Nocciolato | A frutos secos |
| `source.cafe` | Café | Café | Bar | Cafetería |
| `swipe.more` | More of this | Mehr davon | Di più | Más de esto |
| `swipe.less` | Less of this | Weniger davon | Di meno | Menos de esto |

- Brand and product names (AeroPress, Flair NEO, V60, Chemex) are never translated.
- **Catalog:** tasting notes stay in the roaster's original language. The builder's flavour lexicon maps them to tag enums, which are shown translated. The lexicon is multilingual so that German and Italian label notes are recognised.
- **QA:** a CI script fails if any key is missing in a locale. A pseudo-locale (`en-XA`) is used to catch hard-coded strings and layout overflow (German strings are ~30 % longer).

---

## 12. Reminders (on-device, shown on open)

### 12.1 Constraint
There is **no server**. A home-screen PWA cannot schedule its own notifications while closed: scheduled local notifications never shipped, Periodic Background Sync is Android-only and unreliable in timing, and push needs a server. Reminders are therefore **evaluated and shown only while CupLog is open**:
- at **app start**,
- when the app **returns to the foreground** (`visibilitychange` → `visible`, `pageshow`),
- on a **timer while open** (set to the next due time, re-armed after each check).

For the typical routine, this works naturally: you open CupLog to log your first cup, or you open it later, and if 10:00 has passed with nothing logged, the reminder is waiting.

### 12.2 Logic lives in core
```ts
// @cuplog/core/reminders — pure, no I/O, no timers
dueReminders(cfg, activity, state, now): DueReminder[]   // what to show right now
nextDueAt(cfg, activity, state, now): string | null      // for arming the in-app timer and "next reminder" in Settings
applyAction(state, ruleId, action, now): ReminderState    // logged | later | notToday

type Activity      = { lastLoggedAt?: string; cupsToday: number; expiringBags: { bagId: string; expiryDate: string }[] }
type ReminderState = Record<ruleId, { shownOn?: string; snoozedUntil?: string; dismissedOn?: string }>
type DueReminder   = { ruleId: string; kind: RuleKind; since: string; payload: { presetHint?: string; bagId?: string } }
```
A rule is **due** when its time has passed today (in the configured time zone), its condition is still true *now*, it isn't snoozed or dismissed for today, quiet hours don't apply, and reminders aren't paused. Because the condition is checked at open time, logging a cup at 09:55 automatically silences the 10:00 rule.

### 12.3 Behaviour in the UI
- **Banner** at the top of Quick Log, in the active theme's accent colour, with no modal and no sound: *"No coffee logged yet today ☕ — your 10:00 reminder"* · **Log now** · **Later** · **Not today**.
- **Several due rules** are merged into one banner. The highest-priority rule wins (`nothingLoggedBy` > `fewerThanBy` > `afterLastLog` > `fixedDaily`); a bag-expiry rule is added as a second line ("Guji Bag #3 expires in 2 days").
- **Catch-up policy:** only reminders from **today** are shown. Opening the app the next morning never shows yesterday's missed nudges.
- **Later** = snooze 30 min. If the app stays open, the timer shows the banner again; otherwise it appears on the next open after that time.
- Saving a rating calls `applyAction(…, "logged")` for satisfied rules, and the banner disappears immediately.
- `afterLastLog` ("rate the cup you just had?") only makes sense while the app is open or reopened within its window. It is labelled accordingly in Settings.
- Optional **app badge** (`navigator.setAppBadge`, installed app only): when the app goes to the background, the badge is set to the number of rules that are *still pending for later today*, and cleared on open. It is static, so it can't change at 10:00 by itself, but it is a visible hint on the home-screen icon. Off by default.

### 12.4 If a backend arrives later
Because the rules, state and `dueReminders` live in `core`, a future server (section 8.5) could evaluate the same rules and deliver them as Web Push. On iOS that requires the home-screen app (16.4+) and a server-side decision before sending, since every push must show a notification. No reminder logic would need to change; only a new delivery adapter would be added.

### 12.5 Testing
Reminder logic is covered by table-driven tests with a fake `Clock`. Cases include: opened before/after the rule time, logged just before, multiple due rules, quiet hours, time-zone change (travel), DST switch, pause date and snooze expiry.

---

## 13. Platforms: Android & iOS home-screen app

| | Android (Chrome, Edge, Samsung Internet) | iOS / iPadOS (Safari) |
|---|---|---|
| Install | `beforeinstallprompt` → own **Install** button. Chrome creates a WebAPK (appears in the app drawer) | Manual: Share → *Add to Home Screen*. Detected via `navigator.standalone` / `display-mode: standalone` |
| Minimum | current Chrome / WebView | iOS 16.4+ (modern standalone PWA support). iOS 17+ recommended |
| Reminders | in-app banners on open (section 12), identical on both platforms. No push, no permission prompt | same |
| Badge (optional) | `navigator.setAppBadge()` | installed app only, and iOS requires notification permission for badges, so it is off by default |
| Camera (barcode) | yes | yes, in standalone mode |
| Storage | IndexedDB, `navigator.storage.persist()` | IndexedDB. Home-screen apps are not subject to Safari's 7-day script-storage cap, but data is lost if the icon is deleted, so there is a monthly **export reminder** |
| Haptics | `navigator.vibrate` on Save | none (visual feedback only) |

**Manifest & meta** (`apps/pwa`):
- `"display": "standalone"`, `"start_url": "/?source=homescreen"`, `"scope": "/"`, `"orientation": "portrait"`, `"id": "/"`.
- Icons: 192/512 PNG + **maskable** variants (Android adaptive icons), `apple-touch-icon` 180×180.
- iOS: `apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style: black-translucent`, generated **splash screens** for common device sizes (light and dark).
- `viewport-fit=cover` + CSS `env(safe-area-inset-*)` for notches, Dynamic Island and gesture bars.
- `theme-color` meta tags with `media="(prefers-color-scheme: …)"`, updated at runtime to match the selected theme.
- `shortcuts` (Android long-press on the icon): "Log a cup", "Log café coffee".

**Testing:** a physical device matrix (a recent iPhone on the current and previous iOS version, a Pixel and a Samsung device) is used for install, in-app reminders, update banner after a deploy, deep links, the camera and offline mode. Lighthouse PWA checks run in CI.

---

## 14. Build & deployment (GitHub Actions → GitHub Pages)

This is a single-user repo with **one long-lived branch, `develop`** (there is no `main`). **Every push to `develop` is deployed to GitHub Pages automatically.** `deploy.yml` runs the full checks first, so a push that fails them never goes live and whatever is live passed CI. Pull requests only come from bots (Dependabot, the catalog refresh) and are checked by `ci.yml` before merging.

```
push to develop ──► deploy.yml: check → test → build → e2e → upload-pages-artifact → deploy-pages
                                                                                   │
                                                          https://www.hohenegger.eu/CuppaScore/
bot PR to develop ──► ci.yml (lint · types · layer rules · i18n · contrast · tests · build · e2e · Lighthouse) ──► merge ──► deploy
catalog.yml (weekly cron) ──► rebuild catalog.json ──► PR "Weekly catalog refresh" ──► merge ──► deploy
```

### 14.1 Workflows (`.github/workflows/`)
| File | Trigger | Does |
|---|---|---|
| `ci.yml` | pull request to `develop`, manual | `pnpm run check`, tests, production build with the project-page base path, Lighthouse PWA/a11y audit |
| `deploy.yml` | push to `develop`, manual | same checks + build + e2e, then `actions/configure-pages@v5` → `actions/upload-pages-artifact@v5` → `actions/deploy-pages@v5`; `concurrency: pages` so deployments never overlap |
| `catalog.yml` | Mondays 04:17 UTC, manual | runs the catalog builder and opens a PR (`peter-evans/create-pull-request`). The catalog only goes live when you merge it |
| `dependabot.yml` | monthly / weekly | keeps action versions and npm dependencies current |

### 14.2 One-time repository setup
1. **Settings → Pages → Build and deployment → Source: GitHub Actions.** (done) The repo then publishes as a project page of the user site `treehopper.github.io`, whose custom domain is `www.hohenegger.eu`, so the app lives at **https://www.hohenegger.eu/CuppaScore/**. No CNAME is set on this repo.
2. **Settings → Branches → rule for `develop`:** block force pushes and deletion. No required PRs (single user; pushes go straight to `develop`).
3. **Settings → Environments → `github-pages`:** deployment branches limited to `develop` (the default branch).
4. **Settings → Actions → General:** allow GitHub Actions to create pull requests (for the catalog PR). PRs opened with the default token don't trigger `ci.yml`; either run CI on them manually or give the catalog workflow a fine-grained PAT.
5. **HTTPS:** service workers and installation require it. Enable *Enforce HTTPS* on the user site (`treehopper.github.io` → Settings → Pages) so `http://` requests are redirected.

### 14.3 What the PWA build must get right on Pages
- **Base path:** the project page lives under `/CuppaScore/` (the repo name, case-sensitive). `deploy.yml` passes `BASE_PATH` from `configure-pages`, and Vite's `base`, the manifest's `start_url`/`scope`/`id`, the service worker scope and `catalog.json` URLs all derive from it. Nothing is hard-coded to `/`.
- **Routing:** GitHub Pages has no server rewrites, so the app uses **hash routing** (`#/log`, `#/bags/…`). Deep links and reloads always work, with no `404.html` tricks.
- **HTTPS** is provided by Pages, which is required for service workers, the camera (barcode) and installation.
- **Updates of an installed app:** Workbox precaches hashed assets, and `index.html` and the service worker are revalidated on every open. A new deploy is detected on the next open; the user sees a small "New version — reload" banner (`registerType: "prompt"`), and the app never reloads mid-log.
- **User data is never touched by deploys.** IndexedDB lives on the device; a new version runs Dexie schema migrations in the worker on first start. Migrations are forward-only and tested against fixtures of every previous `schemaVersion`.
- **Version stamp:** `VITE_APP_VERSION` (commit SHA) and build time appear in Settings → About. This makes it obvious which deploy a phone is running.
- **Rollback:** revert the PR (which deploys automatically), or run `deploy.yml` manually on an older commit via *Run workflow*.

---

## 15. Repository layout (pnpm monorepo)

```
/packages
  /core             entities, zod schemas, stats (outliers, decay, context model),
                    presets ranking, feature vectors, recommender. Pure TS, no DOM.
  /services         use cases + port interfaces (repositories, MediaStore, CatalogSource,
                    Clock, IdGenerator, UnitOfWork)
  /api              CupLogApi interface, DTOs, LocalApi (worker host + Comlink client),
                    HttpApi (stub until the server exists)
  /storage-dexie    IndexedDB adapter, schema migrations, MediaStore (Blobs)
  /catalog-static   CatalogSource reading catalog.json
  /contract-tests   API and repository contract suites, shared by all implementations
/apps
  /pwa              Svelte UI, /themes, /i18n (de, en, it, es), service worker.
                    Depends only on @cuplog/api.
  /server           (future, optional) Hono/Fastify + storage-postgres
/catalog-builder    offline catalog pipeline (reuses @cuplog/core)
  sellers.yml
  adapters/         per-shop fetch/parse modules
  flavour-lexicon.json
  build.ts
/.dependency-cruiser.cjs   layer rules (core ↛ anything, pwa ↛ services/core/adapters)
/.github/workflows         ci.yml (PR checks), deploy.yml (develop → GitHub Pages), catalog.yml (weekly PR)
/.github/dependabot.yml
```

---

## 16. Roadmap

| Milestone | Scope |
|---|---|
| **M1 – MVP** | Layered monorepo (core / services / api / storage-dexie), CI + auto-deploy of `develop` to GitHub Pages, products, bags, home + café logging (incl. AeroPress & Flair NEO), presets quick log, mean/median/trimmed, outlier exclusion, 4 themes, de/en/it/es, export/import, installable offline |
| **M1b – Reminders & install** | Welcome flow, install guidance (Android/iOS), reminder rules + `dueReminders` in core, in-app banner with timer and foreground checks, `.ics` export |
| **M2 – Insights** | Time-weighted score, context model, freshness curve, charts, meal & time-of-day analysis |
| **M3 – Catalog** | Builder with 5–10 Munich sellers, barcode scanning, catalog-prefilled bags |
| **M4 – Recommendations** | Vectors, taste profile, ranked list with explanations, wishlist, exploration |
| **M5 – Polish** | Context-specific recommendations, reminders, onboarding quiz |
| **M6 – Server (optional, not planned)** | `apps/server` with Postgres adapter, auth, `HttpApi`/`SyncingApi`, push reminders, import of local export bundle |
| **M7 – Community** | Aggregate scores, collaborative filtering, shared venue rankings, crowd catalog |

---

## 17. Open questions
- Rating scale: 5 stars with halves, or 0–100 (closer to SCA cupping)?
- Should the swipe level also have **up = "fine, neutral"** (p = 0)? It adds a gesture but captures "okay" cups that otherwise go unrated.
- Default confidence weights (0.5 / 1.0 / 1.2): validate after a few weeks of real data.
- Should milk drinks get their own profile (milk changes perceived acidity and body strongly)?
- Catalog scope: specialty roasters only, or also supermarket brands via Open Food Facts?
- Do some sellers forbid automated fetching? If so, maintain those entries by hand in `sellers.yml`.
- Multiple people rating from one device (household mode)? The `ownerId` field already allows it.
- Is the optional home-screen badge worth asking for notification permission on iOS (which it needs there), or should it stay Android-only?
- Server API style: REST + OpenAPI (generated from zod) or tRPC? This only matters from M6 onward.
