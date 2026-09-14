# 0. ROOT CAUSE -- PAGE SCROLL NAHI HOTA (sabse pehle ye fix karo)

Ye is poori file ke bahut saare symptoms (item 4, 6, 8, 14, 20d --
khali jagah, panel overlap, andar-hi-andar chhota scroll) ki asli
jad hai. Isse pehle theek karo, phir baaki chhote items apne aap
kam ho sakte hain.

**Masla:** Main dashboard/map panel fixed/stuck hai, poora page
mouse-wheel/trackpad se **vertically scroll nahi hota**.

**Karo:**
1. Main dashboard/map container par jahan bhi `position: fixed` ya
   `position: sticky` laga hai, hatao.
2. `height: 100vh` / `max-height` jo bhi page-scroll rok rahi hai,
   hatao.
3. `html`, `body`, `#root`, dashboard-wrapper, ya main-content par
   `overflow: hidden` **mat lagao** jab tak bilkul zaroori na ho.
4. Main page par ye set karo:
   ```
   min-height: 100vh;
   height: auto;
   overflow-y: auto;
   ```
5. Poora dashboard content -- naksha, climate metrics, charts,
   tables, neeche ke panels -- sab **vertically scroll** ho sakein.
6. Left sidebar zaroorat ho to fixed rakho, lekin **beech ka
   dashboard content apne aap, alag se scroll ho**.
7. Naksha khud responsive rahe, poore page ko lock na kare.
8. Maujooda design, layout, rang, naksha, chart, functionality
   **bilkul waisi hi rakho** -- sirf scroll theek karo.
9. Parent containers me `overflow: hidden` aur fixed heights dhoondo
   -- yahi is masle ki asli wajah ho sakti hai.
10. Desktop, laptop, aur mobile teeno par responsive rahe.

**Sabse zaroori:** poora dashboard upar se neeche mouse-wheel/
trackpad se scroll ho sake, aur naksha apne hi section ke andar rahe,
poore page ko freeze na kare.

---

# 0B. PANCH TAB BILKUL KHALI HAIN -- kuch bhi nahi dikhta (bug, styling nahi)

Naksha ke neeche in paanch tabs par click karne par **kuch bhi nahi
dikhta** -- na chart, na text, na error, bilkul khali:
- Rainfall
- Temperature
- Drought Probability
- Trends
- NDVI Trend

Ye sirf design/empty-state ka masla nahi hai (jaisa item 9/14 me
likha), ye ek **functional bug** hai -- data fetch hi nahi ho raha
ya render hi nahi ho raha. Pehle browser console kholkar dekho
(F12 -> Console) ki koi JS error aa raha hai kya (404 on a data
file? undefined variable? failed fetch?) -- root cause dhoondo,
sirf UI mat badlo.

**Theek karo:**
- In paanchon tab ka data **district, block, aur village teeno
  star par** fetch aur dikhao (jahan jo star ka data maujood ho --
  village na ho to block, block na ho to district, saaf label ke
  saath ki kis star ka hai)
- Har tab ek asli chart/graph dikhaye (line/bar, jaisa item 7b me
  likha hai), khali na rahe
- Agar kisi jagah ke liye sach me data nahi hai (jaise IMD sirf 5
  zilon me), to saaf "अभी उपलब्ध नहीं" likho -- bilkul khali screen
  kabhi nahi

**Test:** Jabalpur (ya kisi IMD-wale zile) chunkar paanchon tab
click karo, screenshot do -- har ek me kuch na kuch (chart ya saaf
"not available" message) dikhna chahiye.

---

# 0C. NAKSHA KE NEECHE KHALI JAGAH -- Climate panel wahan shift karo
# + Climate Risk Atlas/NDVI/Rainfall Monitor ka data star-wise banao

### Khali jagah -- CORRECTION (Climate Metrics nahi, bottom tab-panel)
Pehle likha tha Climate Metrics panel shift karo -- **galat, ye
correction hai**: Naksha ke neeche jo khali jagah bach rahi hai,
usme in 17 tabs wala **poora neeche ka panel upar la kar, usi khali
jagah me theek se fit karo** (Climate Metrics side-panel jahan hai
wahi rahe, use mat hilao):
Rainfall, Temperature, Drought Probability, Trends, NDVI Trend,
7-Day Forecast, GEE Workflow, Projection Method, API Hub,
Agriculture, Village Intelligence, Validation, Mandi Prices,
Crop Statistics, Live Weather, Horticulture, AOI Polygon.

Yaani: naksha ke neeche ka gap khatam ho, aur ye poora tab-panel
(tab-grid + neeche uska content, jo item 0/0B me pehle se maanga
gaya hai) seedhe naksha ke neeche, khali jagah bhar kar, poori
chaudai me properly fit ho -- na upar khali jagah bache, na panel
kisi aur cheez se overlap kare (item 6 ka niyam).

### Data teeno star par banao
In teeno feature ka data **State -> District -> Block -> Village**
chaaron star par nikalo/banao (jahan jis star tak asli source ho
wahan tak):
- **Climate Risk Atlas**
- **NDVI Analytics**
- **Rainfall Monitor** (aur usi ke saath Temperature, Trends)

Har star par: jo data waqai maujood hai wahi dikhao, saaf label
ke saath ki kis star ka hai (jaise "zila-star ka anumaan" ya
"gaon-star ka asli maap"). Jahan kisi star ka data nahi hai
(jaise village-level NDVI sab jagah nahi), wahan "abhi uplabdh
nahi -- [karan]" likho, kabhi khali ya bana hua number mat dikhao.

**Test:** ek state, ek district, ek block, aur ek village chunkar
in teeno feature ka data alag-alag screenshot me dikhao ki har
star par sahi cheez aa rahi hai.

---

# LIVE AUDIT -- 4 kaam (2026-08-14)

Maine khud live portal khol kar jaancha (Claude Code ke self-report par
bharosa nahi kiya). Char dikkatein mili. Kram se karo. Har item ke
saamne: **HUA / NAHI KIYA / kyun nahi**

---

# 1. DOHRAV -- sidebar aur neeche ki patti me EK HI cheez das jagah

Sidebar me 19 item, neeche ki patti me 27. Ye das naam **dono jagah**
hain:

| Neeche ki patti | Sidebar |
|---|---|
| Rainfall | Rainfall Monitor |
| Drought | Drought |
| Forest | Forest Monitor |
| PMFBY | PMFBY Insurance |
| Cadastral | Cadastral Map |
| Live Weather | Live Weather |
| Compare | Compare |
| Soil Moisture | Soil Moisture |
| Advisory | Farmer Advisory |
| Mera Khet | Mera Khet |

**Pehle jaancho:** in das jodiyon me se har ek me neeche ki patti wala
tab aur sidebar wala item **sach me alag content dikhate hain ya wahi
cheez dobara khulti hai** -- click karke dono khol kar compare karo,
list banao.

**Faisla (niyam tay karo, dono taraf mat rakho):**
- SIDEBAR = navigation -- kaunsa vishay dekhna hai
- NEECHE KI PATTI = us vishay ke andar alag-alag view/chart
- Ek hi naam **kabhi dono jagah nahi**. Jo sach me duplicate content
  hai use neeche ki patti se hatao, sirf sidebar rehne do.
- Agar kisi jodi me sach me alag content hai, to naam badlo taaki
  confusion na ho (jaise "Drought" aur "Drought" -- naam hi ek jaisa
  hai, ye sabse zyada confusing hai)

---

# 2. "Max zoom 218" -- naksha ke kone me galat likha hai

218 koi zoom star nahi hota (Leaflet me adhiktam 22 hota hai). Kahin
calculation ya string concatenation ki galti hai (`maxNativeZoom` +
kuch aur jud gaya lagta hai). Dhoondo aur theek karo.

---

# 3. GRID LINES -- Bharat ke naksha par safed rekhaayein

Upgrah chitra (satellite) par safed khadi-padi rekhaayein dikh rahi
hain jo nahi honi chahiye. Ye kya hai jaanch karo:
- Kisi CSS grid/border ki galti hai basemap tile container par, YA
- Koi graticule/lat-lon layer galti se ON hai

Jo bhi ho, hatao. Screenshot se confirm karo ki upgrah chitra saaf hai.

---

# 4. KHALI JAGAH -- naksha ke neeche bayen taraf

Bada safed/khali hissa dikh raha hai, kuch load nahi ho raha ya layout
me gap hai. Jaancho kya wahan kuch dikhna chahiye tha (panel load
nahi hua?) ya layout hi galat hai -- dono surat me theek karo.

---

# 5. CLIMATE PANEL SELECT KARNE PAR -- SIDE PANEL saaf aur professional

Sidebar me "Climate" click karne par jo side panel khulta hai wo abhi
professional nahi lag raha. Theek karo:
- Panel khulte hi **saaf structure** ho -- upar heading, phir metric
  card grid (2-3 column), neeche source/resolution/saal line
- Koi overlapping text/card nahi, koi cut-off content nahi
- Card design UI_FIX_PROMPT.md item 6 wale niyam se (radius 8px,
  border 1px, shadow nahi, spacing 4px grid) -- **isi niyam ko har
  panel me consistently lagao**, sirf climate me nahi
- District/village select karne par panel turant naye data se bhare,
  purana data screen par na reh jaye (STANDING ORDERS item 2 -- stale
  data kabhi na dikhe)

**Test:** Jabalpur chuno, screenshot do. Rewa chuno, screenshot do.
Dono me data sahi badla, layout ek jaisa saaf hona chahiye.

---

# 6. NEECHE KA PANEL LAYOUT -- overlapping band karo

Neeche ki patti (bottom panel) me jab bhi koi tab click ho ya data
maanga jaye:
- Chart/table apni jagah me poora fit ho, kisi aur element ke upar
  na chadhe (overlap)
- Loading state ho jab data aa raha ho (khali/tuta hua na dikhe)
- Data na ho to STANDING ORDERS item 6/7 ke mutabik saaf "abhi
  uplabdh nahi" likho -- kabhi khali ya toota hua panel na chhodo
- Chart resize ho window/mobile ke hisaab se, content bahar na nikle

**Ek-ek bottom tab kholkar screenshot do** ki overlap kahin nahi hai.

---

# 7. NEECHE KI TAB-LIST -- scroll wali patli list, bagal khali

Screenshot me dikha: neeche ki tab-list (Rainfall, Temperature,
Drought, Trends, NDVI Trend, 7-Day Forecast, GEE Workflow...) ek
patli column me hai jisme **scroll karna padta hai**, aur uske
**bagal me poori jagah khali (safed) padi hai**. Ye amateur lagta hai.

**Theek karo -- do hisson me:**

### 7a. List ka layout
- Patli scroll-wali column mat rakho. Ya to:
  - Grid/tabular form me saari tab ek saath dikhao (2-3 column ki
    tile grid, icon + naam), taaki scroll na karna pade, YA
  - List column ko chhota rakhna hai to bagal ki khali jagah me
    **default selected tab ka content turant dikhao** (jaise page
    khulte hi "Rainfall" pehle se select ho aur uska chart bagal me
    dikhe) -- kabhi khali safed jagah na chhode
- Har row me icon + naam ke sath ek chhota preview (mini-sparkline
  ya current value) bhi ho sake to aur professional lagega

### 7b. Click/select karne par -- GRAPHICAL, sirf text nahi
Abhi jo dikh raha hai wo simple/samjhaa hua text-jaisa lagta hai. Har
tab select karne par bagal ke panel me **advanced graphical view**
chahiye, jaise:
- Line/area chart -- trend over time (Chart.js already portal me hai,
  isi ko poori tarah istemal karo)
- Bar chart -- saal-dar-saal ya mahine-dar-mahine tulna
- Forecast wali tabs (7-Day Forecast, Trends) me: line chart with
  confidence band ya kam se kam clear upar-neeche trend arrow
- NDVI Trend: time-series chart + chhota naksha (spatial), sirf
  number ki list nahi
- Har chart ke sath: axis label, legend, hover-par-tooltip (exact
  value + tareekh), aur neeche `source · resolution · saal` line
- Chart ke upar ek-line headline insight (jaise "पिछले 10 साल में
  15% ज़्यादा" ) -- lekin ye bhi label-style, lamba paragraph nahi
  (UI_FIX_PROMPT.md item 2 ka niyam yahan bhi lagu hai)

**Maqsad:** kisi bhi tab par click karte hi ek sarkari/professional
analytics-dashboard jaisa graphical panel khule -- chart/graph/trend
pehle, text sabse kam.

**Test:** har tab ek-ek karke click karo, screenshot do -- graph/chart
dikhna chahiye, khali safed jagah kahin nahi honi chahiye.

---

# 8. ZILA CHUNE BINA -- poora page khali, naksha bhi chhota

Screenshot me dikha: "Mandi Prices" tab click kiya, upar tab-grid
theek dikh rahi hai, par neeche sirf ek line "Select a district"
likha hai aur **poora bacha hua page khali safed** hai. Isi tarah
naksha bhi pehle se **chhota** ho gaya hai.

**Theek karo:**
- Zila na chune hone par bhi panel **khali na lage** -- ya to:
  - Poore desh/rajya ka **default/aggregate view** dikhao (jaise
    "rajya-star ka auusat" ya "sabse zyada/kam wale 5 zile" ki chhoti
    tabel/chart), YA
  - Ek **compact, centered** prompt dikhao ("ऊपर से या नक़्शे पर
    ज़िला चुनें") -- chhota card, poora safed page nahi
- **Zila chunne ka shortcut isi panel me ho** -- upar ke Location
  Selector tak wapas jaane ki zaroorat na pade, panel ke andar hi
  ek dropdown/search se zila chun sake
- Naksha ka size **fix rakho** -- tab badalne se ya panel content
  ke hisaab se naksha chhota-bada NA ho. Naksha aur bottom-panel
  dono ka apna fix height/area tay karo (CSS grid/flex se), jisse
  koi bhi tab khulne par doosre hisson ka size na hile

**Test:** bina zila chune "Mandi Prices" khol kar screenshot do (fix
se pehle/baad), phir zila chunkar bhi -- dono me naksha ka size same
rehna chahiye.

---

# 9. TAB-GRID (16 tab, 2 row) -- click par NEECHE PANEL AUTO-BHARE

Bottom tab-grid ab list se grid me badal chuka hai (Rainfall se
Crop Statistics tak, 2 row me 16 tab) -- ye layout theek hai, ise
mat badlo. Lekin **niyam saaf karo:**

- Kisi bhi tab par click karte hi, uske **theek neeche wali poori
  chaudai** turant ek bhara hua panel dikhana chahiye -- chart/graph/
  table jo bhi us tab ke liye sahi ho (item 7b ke graphical niyam
  ke mutabik)
- Ye **automatic** ho -- panel khud expand ho, kisi doosre click ki
  zaroorat na pade
- Zila chuna ho ya na chuna ho, dono surat me neeche khali safed
  jagah **kabhi na bache** -- zila na chune par item 8 wala
  default/compact-prompt state dikhe, khali panel nahi
- Ye niyam **saaron 16 tabs par ek jaisa** lagu ho (Rainfall,
  Temperature, Drought, Trends, NDVI Trend, 7-Day Forecast, GEE
  Workflow, Projection Method, API Hub, Agriculture, Village
  Intelligence, Validation, AOI Polygon, Live Weather, Mandi Prices,
  Crop Statistics) -- kisi ek me bhi khali na chhode

**Test:** in solaah tabs me se har ek par click karke screenshot do --
har baar neeche turant data-bhara panel dikhna chahiye.

---

# 10. FARMER ADVISORY PANEL -- climate metric + Mera Khet fertilizer jodo

Abhi Farmer Advisory side panel me ye dikh raha hai:
- "Climate indices -- Dibang Valley" card (thik hai)
- "Village Cadastral Summary" -- khali: *"Select a village to view
  cadastral aggregates."*
- "Fertilizer & Crop Recommendation" -- khali: *"Select a village to
  view fertilizer demand and recommended crops."*

**Theek karo:**

### 10a. Climate metrics is panel me pehle se dikhein
Jo zila/gaon Location Selector ya Mera Khet se pehle se chuna ja
chuka hai, uska climate summary (rainfall, temperature, drought risk
-- jo climate panel me hai wahi) is Farmer Advisory panel me bhi
turant dikhe, dobara select karne ki zaroorat na pade. Ek panel se
doosre panel me jaate hi selection yaad rahe (STANDING ORDERS item 2
ke mutabik -- ek selection sab jagah update kare).

### 10b. Fertilizer & Crop Recommendation -- Mera Khet se jodo
> **STATUS 2026-09-02: HUA, LIVE VERIFIED.** `dashboard/fertilizer_loader.js`
> + `dashboard/data/fertilizer_doses.json` (12 fasal, 22 dose row, har ek par
> asli printed page citation) + `scripts/build_fertilizer_doses.py`. Teeno
> mausam alag, Mera Khet ke naape area se scaled, har dose ke neeche
> "स्रोत · साल" line, aur jis fasal ka cited dose nahi mila uske liye
> imaandaar "Dose not available for: ..." -- doosri fasal se udhaar nahi.
> Panel ab Agriculture tab ke FARMER ADVISORY section me hai (sidebar wala
> block 2026-08-14 ko wahin consolidate ho gaya tha). Poora detail
> PENDING.md item 16 me.
Ye khali card ab **Mera Khet ke polygon data se bharo**:
- Kisan ne apna khet naapa ho (Mera Khet se) to uska **kshetrafal
  (area)** yahan istemal ho fertilizer ki matra nikalne ke liye
- Fertilizer recommendation **mausam ke hisaab se alag-alag** ho:
  - **Kharif** fasal ke liye
  - **Rabi** fasal ke liye
  - **Zayad/Summer** fasal ke liye
  Teeno alag-alag section me, kisan jo fasal/mausam chune usi ke
  hisaab se sahi doze (N-P-K, kitna kg/ha ya kitna kg uske poore
  khet ke liye) dikhe
- Ye **automatic** ho -- khet naapte hi ya zila/gaon chunte hi ye
  card apne aap bhar jaye, khali message na dikhe (jab tak sach me
  koi data na ho)
- Source ICAR-recommended doze se ho, KISAN_DASHBOARD_PROMPT.md
  section 7 (keet-rog) ke saath isi corpus ko fertilizer-dose ke
  liye bhi istemal karo
- Har recommendation ke neeche: `स्रोत · saal` line

**Test:** Mera Khet se ek khet naapo, Farmer Advisory panel khol kar
dikhao ki climate metric aur fertilizer dono apne aap bhar gaye,
teeno mausam (kharif/rabi/zayad) alag dikh rahe hain.

---

# 11. OVERLAP -- disclaimer box zoom control ke upar chadh raha hai

Screenshot me dikha: "Indicative, not for legal/cadastral use...
Boundaries: Survey of India" wala disclaimer box seedhe **zoom
control (+/-) aur "Max zoom z18" label ke upar chadh gaya hai** --
dono ek doosre ko dhak rahe hain.

**Theek karo:** disclaimer box ki jagah badlo (jaise bottom-left ya
ek chhoti permanent strip me) taaki wo kabhi bhi zoom control,
scale bar, ya kisi aur naksha-control ke upar na aaye, kisi bhi
zoom/pan par.

---

# 12. FARMER ADVISORY -- idle-state text POORA HATAO

Panel khulte hi jo dikhta hai -- "Select a state", "WhatsApp SMS
हिंदी" button, "Boundaries + profiles · all states · IMD indices ·
5 MP districts only" line, "Select a village to view cadastral
aggregates.", "Select a village to view fertilizer demand and
recommended crops." -- **ye poora block hatao.**

Iski jagah item 10 wala niyam lagu karo: jo state/village pehle se
Location Selector ya Mera Khet se chuna ja chuka hai, uska climate
metric aur fertilizer/crop recommendation **seedhe apne aap** dikhe.
Koi khaali prompt text na dikhe -- na "select a state", na "select a
village". Agar sach me kuch selected hi nahi hai, to ek chhota
compact card ("ऊपर से क्षेत्र चुनें") kaafi hai, itna lamba text
block nahi.

`WhatsApp SMS हिंदी` jaisa alag button bhi is jagah se hatao -- agar
ye asli notification/alert feature hai to use apni jagah (jaise
Advisory ke andar ek "अलर्ट पाएं" section) me le jao, yahan idle-state
me nahi.

---

# 13. RISK LEGEND PANEL -- POORA HATAO

"Extreme Risk / High Risk / Moderate Risk / Low Risk" wala legend
panel naksha se **poora hatao** -- disclaimer/zoom-control ke saath
overlap ho raha hai aur alag se panel jagah ghair raha hai.

**Zaroori:** risk-color ka matlab (kaunsa rang kis risk star ko
dikhata hai) kahin **kho na jaye** -- Climate Metrics side panel
(jahan Drought Risk/Heatwave Severity card hain) me hi ek chhoti
`legend-strip` (jaise 4 rang ke chhote dot + naam, ek line me) jod
do, taaki jaankari bani rahe bina naksha par alag floating panel ke.

---

# 14. NAKSHA AUR NEECHE KA PANEL -- SPACING + ATTRACTIVE DESIGN

Ye phir se dikha (Rainfall tab): "RAINFALL FORECAST -- CENTRAL INDIA
(2024-25)" heading, neeche "Select a district..." ek line, baaki
poora page khali -- item 6/7/8/9 me pehle se likha hai ye khali-jagah
wala masla, **fix karte waqt ye do cheezein bhi saath me karo:**

### 14a. Naksha aur panel ke beech spacing
Abhi neeche wala panel seedhe naksha se **chipka hua** hai, koi
gap/margin nahi. Beech me kam se kam **16-24px ka gap** rakho
(item 6 ke 4px-grid niyam se), taaki dono alag-alag saaf sections
lagen, ek doosre se chipke hue na lagen.

### 14b. Panel "attractive" -- sirf empty-state nahi, poore design ka
Har tab-panel (khali ho ya bhara) professional dikhna chahiye:
- Heading ke saath ek chhota icon + rang-patti (jaise Rainfall =
  neela accent bar upar)
- Khali-state bhi plain text-line jaisa na ho -- ek halka card
  (background `#F7F9FB`, rounded corner, icon beech me, text neeche)
  jisme "Select a district" jaisa sandesh center me dikhe, saath me
  agar mumkin ho to ek **"District chunein"** button/dropdown seedhe
  usi card ke andar (Location Selector tak wapas jaane ki zaroorat
  na pade)
- Bhara-state (data aane ke baad) me chart card ka wahi design-system
  istemal ho jo item 6 me likha hai (radius 8px, border 1px, shadow
  nahi, spacing 4px grid)
- Panel ki height content ke hisaab se ho (item 8 me likha content-fit
  niyam), khali safed jagah kahin na bache

**Ye niyam saaron 16 tabs (item 9 ki list) par ek jaisa lagu ho.**

### 14c. Panel jagah tabhi bane jab click ho -- pehle se khali jagah reserve na karo
Panel **naksha ke neeche hi rahe** (jagah wahi), lekin chart/graph
wala area **sirf tab par click karne ke BAAD hi bane/dikhe** -- click
se pehle wahan koi khali reserved space na ho (poora page compact
rahe, naksha ke neeche sirf tab-grid dikhe, uske aage kuch nahi).
Click karte hi neeche ka panel **turant expand ho** aur usi waqt
chart/data se bhar jaye -- khali box pehle se render ho kar baad me
bharna nahi, balki click hote hi jagah + data dono ek saath aayen.

---

# 15. NAYA LIVE AUDIT (2026-08-15) -- panch naye masle mile

Maine khud Jabalpur chunkar, har sidebar item click karke jaancha
(browser se, sirf screenshot nahi). Ye naye masle mile, item 1-14
se alag:

### 15a. Farmer Advisory ke card viewport se kate hue
"GOOD SOWING WINDOW" jaisa doosra/teesra alert-card screen ke
daayen kinare par **aadha kata hua** dikhta hai -- na wrap hota hai
agli line me, na horizontal scroll milta hai. Cards ko **stack
(ek ke neeche ek)** karo ya poori chaudai ke hisaab se **wrap** karo,
kabhi kisi card ka aadha hissa viewport se bahar na kate.

### 15b. Chatbot ka floating button content ke upar chadhta hai
Neeche-daayen kona wala chat-bubble button "Live Weather" panel ke
"WIND" value card ko **dhak deta hai**. Chat-button ke liye niche-
daayen ek chhota fixed margin/safe-zone rakho, taaki wo kabhi kisi
data-card ke upar na aaye -- data-card ki padding badhao ya button
ki z-index/position adjust karo.

### 15c. Sidebar click karne se URL nahi badalta -- link share/back
button kaam nahi karta
Koi bhi sidebar item click karo (Live Weather, PMFBY, Cadastral,
...) -- **browser ka URL hash badalta hi nahi** (hamesha jo pehle
se khula tha wahi rehta hai). Iska matlab: kisi panel ka link kisi
aur ko bhej nahi sakte, aur browser ka **Back button kaam nahi
karega**. Har sidebar/tab click par URL hash (jaise `#liveweather`,
`#pmfby`) turant update hona chahiye, aur seedhe us URL par jaane
par bhi wahi panel khulna chahiye (deep-link).

### 15d. HISTORICAL INDICES panel -- bahut zyada data, bahut chhoti
jagah me
Ye panel (map ke neeche) me bahut saara data hai --Heatwave Days/yr,
Severe HW Days, Mean/Max Summer Tmax, Drought, SPI-12, Annual, aur
aage bhi -- lekin panel ki lambaai sirf ~100-150px hai, isliye sirf
1.5 row card dikhte hain, baaki dekhne ke liye andar hi scroll karna
padta hai jo bahar se dikhta bhi nahi (koi scroll-indicator nahi).
**Theek karo:** panel ko zyada height do (item 14 ke spacing niyam
ke saath), ya card-grid ko zyada column me phailao, aur agar andar
scroll rakhna hi hai to ek saaf "neeche aur data hai, scroll karein"
hint dikhao.

### 15e. Drought Risk card -- "Select a district" ka bacha hua text
Jabalpur chunne ke baad bhi Drought Risk card ke neeche **"↑ Select
a district"** likha reh jaata hai, jabki value (16.2%) sahi aa chuki
hai. Ye stale/purana placeholder text hai -- district select hote
hi ye line **trend-info se badalni chahiye** (jaise "पिछले साल से
+2%" ya kuch bhi asli), "select a district" kabhi bhi data aane ke
baad na dikhe.

**Acchi baat jo mili (badlo mat):** PMFBY aur Forest Monitor pages
honestly **"Not available yet"** dikhate hain (bina jhoothe number
ke) -- CLAUDE.md ke "no fabrication" niyam ke mutabik sahi hai.
Cadastral Map par bhi ek saaf **"DEMONSTRATION"** disclaimer hai jo
Mera Khet ki taraf point karta hai -- ye pattern acchha hai, isi
tarah har jagah honest-empty-state rakho.

---

# 20. RE-CHECK (2026-08-16) -- kya theek hua, kya nahi

Maine live site dobara khol kar jaancha. **Ye theek ho chuke hain,
confirm:**
- Item 2 (Max zoom 218) -- **THEEK**, ab "Max zoom z18" sahi likha hai
- Item 11 (disclaimer/zoom overlap) -- **THEEK**, ab dono alag jagah hain
- Item 13 (Risk Legend) -- **THEEK**, ab Climate Metrics panel ke
  andar hi upar ek chhoti legend-strip hai (Extreme/High/Moderate/Low)
- Naya professional **"Welcome" onboarding page** bhi mila (naam,
  organization, "Administration/Farmer/Corporate" chunne ka option) --
  **ye bahut acchha bana hai**, aisa hi design-level poore portal me
  chahiye

**Ye ABHI BHI theek nahi hua:**
- Item 3 (Grid lines) -- **NAHI HUA**, naksha par safed grid lines
  ab bhi dikh rahi hain
- Item 1 (dohrav) -- **AADHA HUA**. Kuch naam alag kar diye (Rainfall
  Monitor vs Rainfall, NDVI Analytics vs NDVI Trend -- accha), lekin
  **"Drought" aur "Live Weather" abhi bhi sidebar aur neeche dono me
  hoobahoo ek jaisa naam hai** -- inhe bhi alag karo ya ek jagah se
  hatao

**Naya masla mila:** "Data sources" wala floating button neeche ke
tab-bar ke "Projection Method" aur "AOI Polygon" tabs ke **upar chadh
jaata hai**, unka text dhak deta hai (jaisa item 15b me chatbot-button
ka masla tha, wahi is button ke saath bhi hai). Isko bhi ek fix
safe-zone do taaki kisi tab-label ke upar kabhi na aaye.

---

# ACCHA JO MILA -- aise hi rakho

Har climate card ke neeche `Source · resolution · 2000-2024` style
label -- ye sahi hai, isi tarah har jagah rakhna hai (UI_FIX_PROMPT.md
item 5 ke mutabik).

---

# DIKHAO -- kaam ke baad ye screenshot do

1. Sidebar aur neeche-patti ki jo das jodiyan upar likhi hain, unme se
   jinko dobara-content nikla, unka **pehle** (dono khule, duplicate
   dikhte hue) aur **baad** (fix ke baad) ka screenshot
2. Naksha ka kona jahan "Max zoom" likha hai -- fix se pehle aur baad
3. Poora India-view naksha -- grid lines fix se pehle aur baad
4. Naksha ke neeche wali khali jagah -- fix se pehle aur baad
5. Climate panel khula hua -- ek zila chunkar, saaf side panel
6. Neeche ke 3-4 alag tab click karke -- kahin overlap nahi, ye dikhao
7. Tab-list ka naya grid/tabular layout -- khali jagah bhari hui
8. Kam se kam 4 alag tab (Rainfall, Temperature, NDVI Trend, 7-Day
   Forecast) click karke unka graphical chart/graph panel
9. "Mandi Prices" (ya koi bhi tab) bina zila chune -- khali jagah
   fix hone ke baad, aur naksha ka size zila chunne se pehle/baad
   same rehte hue
10. Solaah tabs me se har ek click karke, neeche turant bhara hua
    panel -- ek collage/grid me sab 16 screenshot
11. Farmer Advisory panel -- Mera Khet se naape khet ke saath climate
    metric aur teeno mausam (kharif/rabi/zayad) ka fertilizer card
    bhara hua, idle-state text kahin nahi
12. Disclaimer box zoom control se overlap na kare -- naye jagah ka
    screenshot
13. Risk Legend panel hata hua, uski jagah Climate Metrics panel me
    chhoti legend-strip
14. Naksha aur panel ke beech gap, aur ek khali-state card ka naya
    "attractive" design (Rainfall tab se)
15. Farmer Advisory ke saare card poori tarah dikhte hue (kata hua
    nahi), chat-button kisi card ko dhak nahi raha
16. URL hash sidebar click par badal raha hai -- ek panel khol kar
    URL ka screenshot, phir seedhe us URL ko paste karke wahi panel
    khulte hue
17. Historical Indices panel bada hoke sab metric card ek saath ya
    saaf scroll-hint ke saath
18. Drought Risk card district chunne ke baad, "select a district"
    text ke bina
19. Ek list: das jodiyon me se kaunsi sach me duplicate thi, kaunsi
    alag content thi (naam ke bawajood)

Har item ke saamne HUA / NAHI KIYA / kyun nahi likhna, screenshot ke
bina "ho gaya" mat likhna.

---

# 0D. TEEN-ROLE LAYERED VIEW (spec + status, 2026-09-14)

> **Note on where this spec came from (imaandaari):** is file me "0D"
> naam ka koi section pehle se **nahi tha** -- poora repo `0D` /
> `TEEN-ROLE` / `भूमिका` ke liye grep kiya, kahin nahi mila. Ye spec
> owner ke 2026-09-14 ke task brief se jaisa ka taisa yahan likha gaya
> hai, taaki aage se file aur code dono ek hi baat kahein.

**Spec:** login ke baad `vindhya_visitor.role` padho aur default view
badlo:
- **Administration** -> aaj wala poora Dashboard, koi badlav nahi
- **Farmer** -> ek combined panel: Farmer Advisory -> Agriculture
  (auto-bhara climate summary + Mera Khet ka area-scaled fertilizer
  card) -> Village Reports -> PMFBY Insurance; default bhasha Hindi,
  bada font, aur "technical" tabs (GEE Workflow, Validation, API Hub)
  ek saaf **"Advanced view दिखाएं"** toggle ke peeche
- **Corporate** -> Mandi Prices -> Crop Statistics (business view)
- Naksha, Location Selector, aur language toggle **teeno role me bilkul
  ek jaise**
- Header me hamesha **"भूमिका बदलें / Switch role"**, bina naam/
  organization dobara maange
- Kahin bhi "access denied" jaisa shabd nahi -- ye sirf UI
  personalisation hai, permission system nahi; har panel har role se
  khulta hai
- Role localStorage me yaad rahe; wapas aane par role dobara na poochha
  jaye

### STATUS: **HUA -- LIVE VERIFIED (2026-09-14)**

`dashboard/role_view.js` (naya) + `index.html` ka CSS/topbar/launchApp
wiring + `app.py` ke `_JS_FILES` me entry. Live site par teeno role
khud chala kar jaancha:

| Role | Live natija |
|---|---|
| Farmer | `role-view-farmer lang-hi role-stack`, hash `#farmer`, 4 pane sahi kram me (advisory:1, agriculture:2, village:3, pmfby:4), GEE Workflow/API Hub/Validation `display:none`, "Advanced view दिखाएं" toggle maujood, font `--fs-3` 15px->17px, role button "किसान" |
| Corporate | `role-view-corporate role-stack`, hash `#corporate`, Mandi Prices(1) -> Crop Statistics(2), technical tabs wapas visible, font wapas 15px, button "कॉर्पोरेट" |
| Administration | koi stack nahi, bottom panel collapsed, hash `#dashboard`, button "प्रशासन" -- yaani aaj wala default jyon ka tyon |

- **Switch role** topbar me hamesha dikhta hai; modal Hindi/English
  dono me, upar saaf likha "सिर्फ़ यह बदलता है कि पहले कौन-सा पैनल
  खुले। हर पैनल हर भूमिका में उपलब्ध रहता है।" -- koi access-denied
  shabd kahin nahi.
- **Naksha teeno role me same size** -- live measure: `map-panel`
  height = 568px, teeno me.
- **Wapas aane par**: hero par ab "जारी रखें / Continue as
  &lt;Role&gt;" button aata hai aur stored role ka card pehle se selected --
  role dobara nahi poochha jaata, naam dobara nahi maanga jaata.
- `#farmer` / `#corporate` / `#admin` shareable deep-link hain (doosre
  ka bheja link aapka apna saved role overwrite nahi karta).
- Koi naya data nahi banaya gaya -- sirf routing/layout.

**Is kaam ke dauraan do asli bug mile aur theek kiye:**
1. **Load-order race** -- `index.html` apna router
   `setTimeout(initRouting,0)` se chalata hai, jo `role_view.js` ke
   `<script src>` (~2000 line neeche) se **pehle** chal sakta hai;
   tab `launchApp()` ko `window.VindhyaRole` undefined milta tha aur
   poora role view chupchaap skip ho jaata tha. Uncached load par
   reproduce hua. Idempotent self-boot fallback lagaya.
2. **`.climate-metrics-table .metric-card` ka grid** -- `1fr` ka matlab
   `minmax(auto,1fr)` hota hai, isliye label column apne 140px
   min-content se chhota hone se mana kar deta tha: label 140 + value
   71 = 211px, jabki card sirf 195px ka hai -- value 16px bahar nikal
   kar `#right-panel` ke 84px chat-FAB gutter me ghus jaati thi.
   `minmax(0,1fr)` se har role aur har font-size par theek.

---

# 21. RE-AUDIT (2026-09-14) -- poori file, item-dar-item, LIVE

Live site khud khol kar, browser se, har item jaancha (sirf code padh
kar nahi). Jahan "measured" likha hai wahan asli DOM/computed-style
number hai.

| Item | Verdict | Sabooot / kyun |
|---|---|---|
| **0** page scroll | **HUA** | `docH 1021 > winH 835`, `html{overflow-y:auto}`, `html/body/#app/#main/#content` me kahin `position:fixed` ya `overflow:hidden` nahi |
| **0B** 5 khali tab | **HUA** | Rainfall, Temperature, Drought Probability, Trends, NDVI Trend -- paanchon me asli Chart.js canvas render hota hai (>30x30px), koi khali nahi |
| **0C** panel naksha ke neeche | **HUA** | bottom panel poori chaudai (966px) me, naksha se 20px neeche |
| **0C** star-wise data | **AADHA** | Country->State->District->Block->Village hierarchy chalu hai (MP -> 53 zile -> 8 block); district-star par sab kuch update hota hai. Block/village star par NDVI/Rainfall ka poora cross-check **nahi** kiya -- imaandaari se adhoora likh raha hoon |
| **1** dohrav | **HUA (ab poora)** | Sidebar 21 item, bottom strip me 17 **visible**. Jo 9 asli duplicate the -- Forest, PMFBY, Cadastral, Live Weather, Compare, Soil Moisture, Groundwater, Mera Khet -- sab `display:none`. "Drought" ab bottom me **"Drought Probability"**. Yaani 2026-08-16 wali "aadha hua" shikayat ab **poori tarah** theek hai |
| **2** Max zoom 218 | **HUA** | naksha ke kone me "Max zoom z18" |
| **3** grid lines | **HUA (regress nahi hui)** | satellite tiles saaf; tile size 256.5px (seam-overlap fix). Jo ek dashed cyan line dikhti hai wo app ki apni 5-point polyline hai, graticule nahi |
| **4** khali jagah | **HUA (ab)** | Pehle: map-column 696px vs right-panel 1053px -> **357px** mara hua safed hissa. Ab right-panel sticky + ek viewport tak capped -> **gap 357px -> 83px**, page height 1155 -> 882. Farmer/Corporate view me gap **0** |
| **5** climate side panel | **HUA** | Jabalpur chunne par saaf structure: heading, legend-strip, metric card, har card ke neeche `Source · resolution · saal` |
| **6** overlap | **HUA** | saaron 17 tab kholkar measure kiya -- **kisi bhi pane me `clippedRight = 0`**, `scrollWidth == clientWidth` |
| **7a** tab-list layout | **HUA** | patli scroll-column nahi; `flex-wrap` tile grid, 17 tab 3 row me, bagal khali nahi |
| **7b** graphical | **AADHA** | 17 me se 8 tab me asli chart (Rainfall, Temperature, Drought Probability, Trends, NDVI Trend, 7-Day Forecast, Validation x2, Crop Statistics). GEE Workflow / Projection Method / API Hub / AOI Polygon / Farmer Advisory apne swabhav se text/tool panel hain. **Mandi Prices, Horticulture, Village Intelligence, Agriculture abhi bhi table/text-first hain -- ye baaki hai** |
| **8** zila chune bina | **HUA** | khali safed page nahi; har tab me ek saaf card -- icon + sandesh + **usi card ke andar "ज़िला चुनें" button**. Naksha ka size tab badalne se nahi hilta (568px, teeno role me) |
| **9** 16 tab auto-bhare | **HUA** | 17/17 tab par click karte hi active pane bharta hai (textLen 17-6246), koi khali nahi |
| **10a** advisory me climate | **HUA** | Jabalpur chunte hi advisory pane 1826 char se bhar jaata hai |
| **10b** fertilizer card | **HUA** | `#fert-rec-panel` 4676 char. **Chaaron mausam alag**: खरीफ (धान, 50:25:25 N:P2O5:K2O/ha, citation ke saath), रबी (गेहूँ), **ज़ायद/ग्रीष्म -- imaandaari se "is mausam me is zile ki kisi fasal ke liye uplabdh nahi"**, aur पूरे वर्ष (गन्ना). Area DES record se, Mera Khet se naapne par khet-wise |
| **11** disclaimer/zoom overlap | **HUA** | disclaimer bottom-left, zoom control bottom-right -- alag |
| **12** idle-state text | **HUA** | "Select a state" / "Select a village to view..." live regex se dhoondha -- **kahin nahi mila** |
| **13** risk legend | **HUA** | naksha par floating panel nahi; Climate Metrics panel ke andar upar Extreme/High/Moderate/Low strip |
| **14a** spacing | **HUA** | measured **20px** (spec: 16-24px) |
| **14b** attractive empty-state | **HUA** | halka card, beech me icon, neeche sandesh, aur card ke andar hi "ज़िला चुनें" button |
| **14c** click ke baad hi jagah | **HUA** | click se pehle `.btm-content{display:none}`, tab-strip ke neeche sirf **1px** |
| **15a** advisory card kate hue | **HUA** | `scrollWidth == clientWidth == 880`, 0 clipped node (1470px width par jaancha) |
| **15b** chat-FAB overlap | **HUA -- par pehle galat samjha tha** | Pehle mujhe laga ye regress ho gaya; **theek se jaancha to nahi tha** -- har scroll position par 16 metric node scan kiye, kahin overlap nahi. Lekin ek **asli latent bug** mila: `.metric-card` ka `1fr auto` grid apne card se 16px bahar nikal raha tha (value x=1433 vs gutter 1382) -- bade font par ye pakka overlap karta. `minmax(0,1fr)` se root cause theek |
| **15c** URL hash | **HUA** | har tab/sidebar click par hash badalta hai; stacked role-view ke liye ek hi saaf hash (`#farmer`/`#corporate`) |
| **15d** Historical Indices | **HUA** | `#historical-indices-panel` ab **316px** (shikayat ~100-150px ki thi), `overflow:visible`, koi chhupa hua inner scroll nahi |
| **15e** Drought Risk stale text | **HUA** | Jabalpur chunne ke baad "Jabalpur · 2000-2024 mean / 16.2%" -- "Select a district" nahi |
| **20** "Data sources" button overlap | **HUA** | ab koi floating button hai hi nahi (DOM me `data sources` sirf ek CSS comment me mila); site footer ke bottom-right me hai, "Projection Method"/"AOI Polygon" se door |

### Item 1 ka maanga hua list -- kaunsi jodi asli duplicate thi

| Bottom strip | Sidebar | Faisla |
|---|---|---|
| Rainfall | Rainfall Monitor | alag naam, ek hi pane -- rehne diya (owner ne khud "accha" kaha tha) |
| Drought Probability | Drought | **pehle dono "Drought" the -> ab naam alag**, theek |
| Forest | Forest Monitor | asli duplicate -> bottom se hataya |
| PMFBY | PMFBY Insurance | asli duplicate -> bottom se hataya |
| Cadastral | Cadastral Map | asli duplicate -> bottom se hataya |
| Live Weather | Live Weather | asli duplicate -> bottom se hataya |
| Compare | Compare | asli duplicate -> bottom se hataya |
| Soil Moisture | Soil Moisture | asli duplicate -> bottom se hataya |
| Farmer Advisory | (sidebar se hata diya gaya tha) | ab sirf ek jagah |
| Mera Khet | मेरा खेत / Mera Khet | asli duplicate -> bottom se hataya |

### Abhi bhi khula (imaandaari se)

1. **Item 7b** -- Mandi Prices, Horticulture, Village Intelligence,
   Agriculture abhi bhi table/text-first hain, chart-first nahi.
2. **Item 0C (star-wise)** -- block aur village star par NDVI/Rainfall
   ka poora cross-check baaki hai.
3. **Chhota latent bug** -- `live_weather_loader.js` **do** "Live
   Weather" tab node banata hai (dono hidden hain, isliye user ko
   dikhta nahi, par saaf karna chahiye).
