const tripDates = [
  ["02/05", "五", "維也納"], ["02/06", "六", "維也納"], ["02/07", "日", "維也納"],
  ["02/08", "一", "哈修塔特"], ["02/09", "二", "哈修塔特"], ["02/10", "三", "布達佩斯"],
  ["02/11", "四", "布達佩斯"], ["02/12", "五", "布達佩斯"], ["02/13", "六", "布達佩斯"],
  ["02/14", "日", "維也納"], ["02/15", "一", "返程"],
];

const state = {
  view: getInitialView(),
  selectedDate: "02/06",
  dateWindow: 0,
  factEditing: false,
  facts: [
    { id: 1, icon: "globe", title: "和台灣的時差", text: "冬季慢 7 小時" },
    { id: 2, icon: "exchange", title: "參考匯率", text: "EUR 1 ≈ TWD 35.2" },
    { id: 3, icon: "plug", title: "插座形狀", text: "Type C／F，電壓 230V" },
    { id: 4, icon: "water", title: "自來水", text: "奧地利可直接生飲" },
  ],
  itineraryItems: [
    { id: 1, icon: "train", title: "搭地鐵前往美泉宮", note: "從住宿地點出發，約 25 分鐘" },
    { id: 2, icon: "sight", title: "美泉宮與花園", note: "預留 2.5 小時，戶外注意保暖" },
    { id: 3, icon: "food", title: "中央咖啡館午餐", note: "尖峰可能候位，備案在地圖收藏" },
    { id: 4, icon: "shop", title: "維也納舊城散步", note: "依體力彈性調整" },
  ],
  itineraryEditing: false,
  stays: [
    { id: 1, startDate: "2027-02-05", endDate: "2027-02-08", city: "維也納", title: "維也納住宿（示意）", address: "Mariahilfer Straße 00, 1070 Wien", checkin: "15:00", checkout: "11:00", tone: "sky", photoMode: "" },
    { id: 2, startDate: "2027-02-08", endDate: "2027-02-10", city: "哈修塔特", title: "湖畔住宿（示意）", address: "Seestraße 00, 4830 Hallstatt", checkin: "14:00", checkout: "10:00", tone: "mint" },
    { id: 3, startDate: "2027-02-10", endDate: "2027-02-14", city: "布達佩斯", title: "多瑙河畔公寓（示意）", address: "Belgrád rkp. 00, Budapest", checkin: "15:00", checkout: "11:00", tone: "coral" },
  ],
  activeList: "essentials",
  collapsedExpenseDates: new Set(),
  locationStatus: "定位尚未取得，天氣為設計示意",
  countdownVisible: true,
  expenses: [
    { id: 1, date: "2027-02-06", title: "中央咖啡館早餐", category: "食物", currency: "EUR", amount: 24.5, twd: 862 },
    { id: 2, date: "2027-02-06", title: "地鐵 24 小時票", category: "交通", currency: "EUR", amount: 8.0, twd: 282 },
    { id: 3, date: "2027-02-07", title: "中央市場晚餐", category: "食物", currency: "HUF", amount: 8600, twd: 778 },
  ],
  lists: {
    essentials: [
      { id: 1, title: "護照與護照影本", done: true },
      { id: 2, title: "旅平險保單", done: true },
      { id: 3, title: "歐規轉接頭", done: false },
      { id: 4, title: "機場接送確認", done: false },
    ],
    luggage: [
      { id: 5, title: "發熱衣 × 3", done: true },
      { id: 6, title: "防水雪靴", done: false },
      { id: 7, title: "常備藥與保溫瓶", done: false },
    ],
    todos: [
      { id: 8, title: "下載離線地圖", done: false },
      { id: 9, title: "確認電信漫遊方案", done: false },
    ],
  },
};

const icons = {
  home: '<path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  bed: '<path d="M3 20v-9h18v9M3 16h18M6 11V7h5a3 3 0 0 1 3 3v1"/>',
  wallet: '<path d="M4 6h15a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h13"/><path d="M16 12h5v4h-5a2 2 0 0 1 0-4z"/>',
  checkList: '<path d="m3 6 2 2 4-4M3 13l2 2 4-4M3 20l2 2 4-4M12 6h9M12 13h9M12 20h9"/>',
  edit: '<path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10z"/><path d="m14.5 7.5 3 3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  plane: '<path fill="currentColor" stroke="none" d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  cloud: '<path d="M6 18a4 4 0 0 1-.7-7.9A6 6 0 0 1 17 9h1a4 4 0 0 1 0 8H6z"/>',
  location: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0z"/><circle cx="12" cy="10" r="2"/>',
  plug: '<path d="M8 3v6M16 3v6M6 9h12v2a6 6 0 0 1-12 0zM12 17v4"/>',
  water: '<path d="M12 3s6 7 6 12a6 6 0 0 1-12 0c0-5 6-12 6-12z"/>',
  exchange: '<path d="M7 7h11l-3-3M17 17H6l3 3"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/>',
  food: '<path d="M7 3v8M4 3v5a3 3 0 0 0 6 0V3M7 11v10M16 3v18M16 3c3 2 4 5 4 8h-4"/>',
  train: '<rect x="5" y="3" width="14" height="15" rx="4"/><path d="M8 21l2-3M16 18l2 3M8 8h8M8 13h.01M16 13h.01"/>',
  sight: '<path d="M4 21h16M6 21V10h12v11M8 10V6h8v4M10 6V3h4v3M10 14h4M10 18h4"/>',
  shop: '<path d="M4 9h16l-1 12H5zM8 9a4 4 0 0 1 8 0"/>',
  market: '<path d="M4 10h16l-2 10H6zM8 10l4-6 4 6M8 14v2M12 14v2M16 14v2"/>',
  map: '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/>',
  chevron: '<path d="m9 18 6-6-6-6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6"/>',
  grip: '<path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
  suitcase: '<rect x="4" y="7" width="16" height="13" rx="2"/><path d="M9 7V4h6v3M8 12v3M16 12v3"/>',
  arrowLeft: '<path d="m15 18-6-6 6-6"/>',
  arrowRight: '<path d="m9 18 6-6-6-6"/>',
  image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 17 5-5 4 4 2-2 5 4"/>',
};

function icon(name, size = 20) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name]}</svg>`;
}

function getInitialView() {
  const view = window.location.hash.replace("#", "");
  return ["home", "itinerary", "stays", "expenses", "lists"].includes(view) ? view : "itinerary";
}

function topbar() {
  return `<header class="topbar">
    <a class="brand" href="#itinerary" data-view-link="itinerary"><span class="brand-mark">旅</span><span>Travel Book</span></a>
    <div class="topbar-side"><span class="sync-label">原型資料・未連線</span><span class="avatar" aria-label="家庭旅行">4 人</span></div>
  </header>`;
}

function pageHeading(eyebrow, title, action = "") {
  return `<header class="page-heading"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1></div>${action}</header>`;
}

function heroIllustration() {
  return `<svg class="hero-illustration" viewBox="0 0 900 560" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="winter-sky" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#7ea5b5"/><stop offset="1" stop-color="#315f66"/></linearGradient>
      <linearGradient id="winter-ground" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#f5fafc"/><stop offset="1" stop-color="#b9d2dc"/></linearGradient>
    </defs>
    <rect width="900" height="560" fill="url(#winter-sky)"/>
    <circle cx="790" cy="72" r="38" fill="#f6e4af" opacity=".92"/>
    <g fill="#fff" opacity=".86">${[[52,56,5],[126,112,3],[210,48,4],[292,96,3],[382,43,5],[470,118,4],[548,62,3],[648,104,5],[726,34,3],[836,128,4],[88,202,4],[254,176,3],[612,190,4],[858,212,3]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join("")}</g>
    <path d="M-40 340 150 142l103 101L397 66l126 151 107-105 310 228v220H-40z" fill="#557b86"/>
    <path d="m150 142-39 42 39-8 40 8z" fill="#edf5f7" opacity=".94"/>
    <path d="m397 66-47 59 47-12 46 12z" fill="#edf5f7" opacity=".94"/>
    <path d="m630 112-43 48 43-10 44 10z" fill="#edf5f7" opacity=".94"/>
    <path d="M0 330c118-43 229-25 329 12 132 49 283 35 571-38v256H0z" fill="url(#winter-ground)"/>
    <path d="M0 390c148-61 267-30 380 1 147 40 305 9 520-47v216H0z" fill="#9ebfcb" opacity=".78"/>
    <g transform="translate(310 98)">
      <g transform="translate(0 72)"><rect width="90" height="72" y="30" rx="5" fill="#f4dfd2"/><path d="m-9 34 54-42 55 42z" fill="#9e4f47"/><path d="m-1 29 46-37 17 13-31 27z" fill="#fff"/><rect x="16" y="56" width="18" height="23" rx="3" fill="#6c8992"/><rect x="58" y="56" width="17" height="17" rx="3" fill="#f4d889"/></g>
      <g transform="translate(106 46)"><rect width="104" height="96" y="36" rx="5" fill="#e4c4a6"/><path d="m-10 40 61-48 64 48z" fill="#7f4a42"/><path d="m1 34 50-42 19 14-36 32z" fill="#fff"/><rect x="42" y="74" width="22" height="58" rx="3" fill="#6a858c"/><rect x="15" y="63" width="17" height="18" rx="3" fill="#f4d889"/><rect x="74" y="63" width="17" height="18" rx="3" fill="#f4d889"/></g>
      <g transform="translate(226 76)"><rect width="86" height="66" y="30" rx="5" fill="#d5ddd6"/><path d="m-8 34 50-39 52 39z" fill="#884941"/><path d="m0 29 42-34 15 12-30 25z" fill="#fff"/><rect x="34" y="58" width="20" height="38" rx="3" fill="#6c8992"/></g>
      <g transform="translate(326 0)"><rect x="18" y="63" width="74" height="119" rx="5" fill="#f1ead8"/><path d="m10 67 45-66 46 66z" fill="#855047"/><path d="m18 59 37-58 17 24-27 37z" fill="#fff"/><rect x="45" y="96" width="21" height="86" rx="10" fill="#718991"/></g>
    </g>
    <path d="M0 455c155-47 284-39 418 4 151 49 302 36 482-17v118H0z" fill="#315f66" opacity=".68"/>
  </svg>`;
}

function homeScreen() {
  return `<main id="main" class="screen">
    ${pageHeading("Trip overview", "旅程首頁")}
    <section class="home-grid">
      <article class="card hero-card">
        ${heroIllustration()}<div class="hero-veil"></div>
        <div class="hero-copy">
          <div class="hero-heading"><span class="trip-range">2027／02／05（五）－02／15（一）・11 天 10 夜</span><h2 class="hero-title">2027 過年東歐遊<small>維也納 · 哈修塔特 · 布達佩斯</small></h2></div>
          <div class="hero-details"><div class="hero-meta"><div class="hero-metric"><span>距離起飛</span><strong id="countdown-value">計算中</strong></div><div class="hero-metric"><span>目前天氣</span><strong>臺北 24°C ☁</strong></div></div><p class="location-status">${icon("location", 15)}${state.locationStatus}</p></div>
        </div>
      </article>
      <div class="home-side">
        <section class="card section-card" aria-labelledby="flights-title">
          <div class="section-head"><div><h2 id="flights-title">航班資訊</h2><p>各段時間依當地時區顯示</p></div>${icon("plane", 23)}</div>
          <div class="flight-list">
            ${flightRow("去程", "TPE", "00:20", "DXB", "06:15－08:55", "VIE", "12:25", "16 小時 05 分")}
            ${flightRow("回程", "VIE", "21:45", "DXB", "06:25－08:45", "TPE", "20:40", "16 小時 55 分")}
          </div>
        </section>
      </div>
    </section>
    <section class="card section-card" aria-labelledby="facts-title">
      <div class="section-head"><div><h2 id="facts-title">旅途小知識</h2>${state.factEditing ? "<p>編輯模式：可修改或移除小卡片</p>" : ""}</div><button class="text-button" type="button" data-action="toggle-facts" aria-pressed="${state.factEditing}">${icon(state.factEditing ? "check" : "edit", 17)}${state.factEditing ? "完成" : "編輯"}</button></div>
      <div class="fact-grid">${state.facts.map((fact) => `<article class="fact-card"><span class="fact-icon">${icon(fact.icon, 22)}</span><h3>${fact.title}</h3><p>${fact.text}</p>${state.factEditing ? `<div class="fact-actions"><button class="icon-button" type="button" data-action="edit-fact" aria-label="編輯${fact.title}">${icon("edit", 16)}</button><button class="icon-button fact-delete" type="button" data-delete-fact="${fact.id}" aria-label="移除${fact.title}">${icon("trash", 16)}</button></div>` : ""}</article>`).join("")}</div>
      ${state.factEditing ? `<button class="secondary-button" type="button" data-action="add-fact" style="margin-top:1rem">${icon("plus", 17)}新增小知識</button>` : ""}
    </section>
  </main>`;
}

function flightRow(label, from, fromTime, stop, stopTime, to, toTime, duration) {
  return `<article class="flight-row"><span class="flight-direction">${icon("plane", 20)}</span><div><div class="flight-title"><strong>${label}</strong><span>${duration}</span></div><div class="flight-route"><div class="flight-airport"><strong>${from}</strong><span>${fromTime}</span></div><span class="flight-line"></span><div class="flight-airport flight-stop"><strong>${stop}</strong><span>杜拜轉機<br>${stopTime}</span></div><span class="flight-line"></span><div class="flight-airport"><strong>${to}</strong><span>${toTime}</span></div></div></div></article>`;
}

function itineraryScreen() {
  const selected = tripDates.find(([date]) => date === state.selectedDate) || tripDates[1];
  const visibleDates = tripDates.slice(state.dateWindow, state.dateWindow + 5);
  return `<main id="main" class="screen">
    ${pageHeading("Daily plan", "每日行程")}
    <section class="date-strip" aria-label="選擇日期">${visibleDates.map(([date, weekday]) => `<button class="date-button" type="button" data-date="${date}" aria-pressed="${date === state.selectedDate}"><span>週${weekday}</span><strong>${date.slice(3)}</strong></button>`).join("")}</section>
    <div class="itinerary-grid">
      <section class="card map-card" data-map-provider="openstreetmap" data-map-points="住宿地點|美泉宮|中央咖啡館|維也納舊城" aria-label="OpenStreetMap 每日實際地點地圖預留區，目前為原型示意">
        ${mapIllustration()}<span class="map-label">${selected[2]}・4 個地點</span><button class="primary-button map-action" type="button" data-action="open-map">${icon("map", 18)}開啟 Google Maps</button>
      </section>
      <section class="card section-card" aria-labelledby="city-title">
        <div class="city-head"><div><p class="eyebrow">${selected[0]}・週${selected[1]}</p><h2 id="city-title">${selected[2]}</h2><p>${state.itineraryEditing ? "編輯模式：可新增、修改、刪除或拖曳排序。" : "今天步調舒緩，景點集中在市中心。"}</p></div><button class="icon-button" type="button" data-action="toggle-itinerary-edit" aria-label="${state.itineraryEditing ? "完成行程編輯" : "編輯城市與行程"}" aria-pressed="${state.itineraryEditing}">${icon(state.itineraryEditing ? "check" : "edit", 19)}</button></div>
        <div class="schedule-list" style="margin-top:1.25rem">${state.itineraryItems.map(scheduleItem).join("")}</div>
        ${state.itineraryEditing ? `<button class="secondary-button add-itinerary-button" type="button" data-action="add-itinerary">${icon("plus", 17)}新增行程</button>` : ""}
      </section>
    </div>
  </main>`;
}

function mapIllustration() {
  return `<svg viewBox="0 0 600 520" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="600" height="520" fill="#dce7dc"/><g fill="none" stroke="#fffdf8" stroke-width="18"><path d="M-40 108c120 40 178-48 287-17s182 18 383-49"/><path d="M40 502c48-124 110-158 209-196s170-97 202-330"/><path d="M-30 355c105-45 197-36 281 13s176 54 390 13"/></g><g fill="none" stroke="#c5d5c6" stroke-width="5"><path d="M20 228c164 26 238-42 348-35s160 41 254 8"/><path d="M128-20c19 120 90 188 78 291s-5 159 35 269"/></g><path d="M102 424c34-93 137-59 166-162s92-128 207-115" fill="none" stroke="#e9785d" stroke-width="7" stroke-linecap="round" stroke-dasharray="10 13"/>${[[102,424,1],[268,262,2],[475,147,3]].map(([x,y,n]) => `<g transform="translate(${x} ${y})"><circle r="19" fill="#274e43"/><text text-anchor="middle" y="6" fill="white" font-family="sans-serif" font-size="16" font-weight="700">${n}</text></g>`).join("")}</svg>`;
}

function scheduleItem({ id, icon: iconName, title, note }) {
  const categoryClass = { train: "transit", sight: "sight", food: "food", shop: "shopping" }[iconName] || "other";
  const mapUrl = googleMapsSearchUrl(title);
  const controls = state.itineraryEditing
    ? `<div class="schedule-controls"><span class="drag-handle" aria-hidden="true">${icon("grip", 20)}</span><button class="icon-button" type="button" data-edit-itinerary="${id}" aria-label="修改${title}">${icon("edit", 17)}</button><button class="icon-button danger-icon" type="button" data-delete-itinerary="${id}" aria-label="刪除${title}">${icon("trash", 17)}</button></div>`
    : `<button class="icon-button" type="button" data-view-itinerary="${id}" aria-label="檢視${title}">${icon("chevron", 18)}</button>`;
  return `<article class="schedule-card ${state.itineraryEditing ? "is-editing" : ""}" data-itinerary-card="${id}" draggable="${state.itineraryEditing}"><span class="timeline-icon category-${categoryClass}">${icon(iconName, 21)}</span><div class="timeline-copy"><strong>${title}</strong><p>${note}</p><a class="navigate-link" href="${mapUrl}" target="_blank" rel="noreferrer">${icon("location", 14)}導航</a></div>${controls}</article>`;
}

function googleMapsSearchUrl(placeName) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(placeName)}`;
}

function staysScreen() {
  return `<main id="main" class="screen">
    ${pageHeading("Stays", "住宿", `<button class="primary-button" type="button" data-action="add-stay" aria-label="新增住宿">${icon("plus", 18)}<span>新增住宿</span></button>`)}
    <section class="stay-list">${state.stays.length ? state.stays.map(stayCard).join("") : `<p class="empty-state">尚未新增住宿。</p>`}</section>
  </main>`;
}

function stayCard(stay, index) {
  const { id, startDate, endDate, city, title, address, checkin, checkout, tone, photoUrl, photoAttribution } = stay;
  const colors = tone === "sky" ? ["#e3f0f4", "#77a9bd"] : tone === "mint" ? ["#dce9e0", "#6f9d82"] : ["#f9ddd4", "#d36b54"];
  const nights = Math.max(1, Math.round((new Date(`${endDate}T12:00:00+08:00`) - new Date(`${startDate}T12:00:00+08:00`)) / 86400000));
  const date = `${startDate.slice(5).replace("-", "／")}－${endDate.slice(5).replace("-", "／")}`;
  const visual = photoUrl ? `<img src="${photoUrl}" alt="${title}住宿照片"><span class="stay-photo-credit">${photoAttribution || "Google Maps"}</span>` : stayIllustration(colors, index);
  return `<article class="card stay-card"><div class="stay-visual">${visual}</div><div><span class="stay-date">${date}・${city}・${nights} 晚</span><h2>${title}</h2><p class="stay-address">${icon("location", 17)}${address}</p><div class="stay-times"><div class="stay-time"><span>CHECK-IN</span><strong>${checkin} 後</strong></div><div class="stay-time"><span>CHECK-OUT</span><strong>${checkout} 前</strong></div></div><div class="stay-actions" style="margin-top:1rem"><a class="primary-button" href="${googleMapsSearchUrl(address)}" target="_blank" rel="noreferrer" style="text-decoration:none">${icon("location", 17)}導航</a><button class="secondary-button" type="button" data-edit-stay="${id}">${icon("edit", 17)}編輯</button></div></div></article>`;
}

function stayIllustration([bg, accent], index) {
  return `<svg viewBox="0 0 500 300" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="500" height="300" fill="${bg}"/><circle cx="405" cy="62" r="35" fill="#f4d889"/><path d="M0 245 118 116l92 99 82-124 101 128 107-95v176H0z" fill="${accent}" opacity=".62"/><path d="M0 263c126-44 217 5 315-19 82-20 132-4 185 15v41H0z" fill="#274e43" opacity=".68"/><g transform="translate(${80 + index * 28} 152)"><rect x="0" y="32" width="126" height="86" rx="8" fill="#fffdf8"/><path d="m-14 36 77-53 78 53z" fill="#a94135"/><path d="M25 60h76M63 32v86" fill="none" stroke="#274e43" stroke-width="5"/></g></svg>`;
}

function expensesScreen() {
  const totals = state.expenses.reduce((acc, item) => { acc[item.currency] = (acc[item.currency] || 0) + item.amount; return acc; }, {});
  const groups = groupExpensesByDate();
  return `<main id="main" class="screen">
    ${pageHeading("Expenses", "記帳", `<button class="primary-button" type="button" data-action="add-expense" aria-label="新增支出">${icon("plus", 18)}<span>新增支出</span></button>`)}
    <section class="card section-card" aria-labelledby="currency-title"><div class="section-head"><div><h2 id="currency-title">各幣別總覽</h2><p>今日匯率快取於 09:00 更新</p></div>${icon("exchange", 22)}</div><div class="currency-grid"><article class="currency-card active"><span class="currency-code">TWD<span>台幣</span></span><strong>${formatMoney("TWD", totals.TWD || 0)}</strong><small>基準幣別</small></article><article class="currency-card"><span class="currency-code">EUR<span>歐元</span></span><strong>${formatMoney("EUR", totals.EUR || 0)}</strong><small>1 EUR ≈ 35.2 TWD</small></article><article class="currency-card"><span class="currency-code">HUF<span>匈牙利幣</span></span><strong>${formatMoney("HUF", totals.HUF || 0)}</strong><small>1 HUF ≈ 0.0905 TWD</small></article></div><p class="rate-note">${icon("info", 15)}匯率與台幣金額皆為原型示意；抓取失敗時顯示「－」。</p></section>
    <section class="card section-card" aria-labelledby="expense-title"><div class="section-head"><div><h2 id="expense-title">支出明細</h2><p>${state.expenses.length} 筆紀錄・依日期整理</p></div></div><div class="expense-list">${groups.length ? groups.map(expenseGroup).join("") : `<p class="empty-state">還沒有支出，先新增第一筆吧。</p>`}</div></section>
  </main>`;
}

function groupExpensesByDate() {
  const groups = new Map();
  state.expenses.forEach((item) => {
    const date = item.date || "2027-02-06";
    if (!groups.has(date)) groups.set(date, []);
    groups.get(date).push(item);
  });
  return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
}

function expenseGroup([date, items]) {
  const collapsed = state.collapsedExpenseDates.has(date);
  const totalTwd = items.reduce((sum, item) => sum + (item.twd || 0), 0);
  return `<section class="expense-group"><button class="expense-group-head" type="button" data-expense-date="${date}" aria-expanded="${!collapsed}"><span><strong>${formatExpenseDate(date)}</strong><small>${items.length} 筆・約 TWD ${new Intl.NumberFormat("zh-TW").format(totalTwd)}</small></span><span class="group-chevron ${collapsed ? "is-collapsed" : ""}">${icon("chevron", 18)}</span></button>${collapsed ? "" : `<div class="expense-group-items">${items.map(expenseRow).join("")}</div>`}</section>`;
}

function formatExpenseDate(date) {
  const parsed = new Date(`${date}T12:00:00+08:00`);
  return new Intl.DateTimeFormat("zh-TW", { month: "long", day: "numeric", weekday: "short", timeZone: "Asia/Taipei" }).format(parsed);
}

function expenseRow(item) {
  const iconName = { "食物": "food", "交通": "train", "景點": "sight", "逛街": "shop", "超市": "market", "機票": "plane" }[item.category] || "wallet";
  const categoryClass = { "食物": "food", "交通": "transit", "景點": "sight", "逛街": "shopping", "超市": "market", "機票": "flight" }[item.category] || "other";
  return `<article class="expense-row"><span class="expense-icon category-${categoryClass}">${icon(iconName, 18)}</span><div class="expense-copy"><span>${item.category}</span><strong>${item.title}</strong></div><div class="expense-amount"><strong>${formatMoney(item.currency, item.amount)}</strong><span>約 TWD ${new Intl.NumberFormat("zh-TW").format(item.twd || 0)}</span></div><div class="expense-actions"><button class="icon-button" type="button" data-edit-expense="${item.id}" aria-label="修改${item.title}">${icon("edit", 17)}</button><button class="icon-button" type="button" data-delete-expense="${item.id}" aria-label="刪除${item.title}">${icon("trash", 17)}</button></div></article>`;
}

function formatMoney(currency, amount) {
  return `${currency} ${new Intl.NumberFormat("zh-TW", { minimumFractionDigits: currency === "EUR" ? 2 : 0, maximumFractionDigits: 2 }).format(amount)}`;
}

function listsScreen() {
  const tabNames = { essentials: ["必備清單", true], luggage: ["行李清單", false], todos: ["待辦清單", false] };
  const current = state.lists[state.activeList];
  const completed = current.filter((item) => item.done).length;
  const percent = current.length ? Math.round((completed / current.length) * 100) : 0;
  return `<main id="main" class="screen">
    ${pageHeading("Checklists", "清單", `<button class="primary-button" type="button" data-action="add-list-item" aria-label="新增項目">${icon("plus", 18)}<span>新增項目</span></button>`)}
    <nav class="list-tabs" aria-label="清單類型">${Object.entries(tabNames).map(([key, [label]]) => `<button class="chip-button" type="button" data-list="${key}" aria-pressed="${state.activeList === key}">${icon(key === "essentials" ? "checkList" : key === "luggage" ? "suitcase" : "calendar", 17)}${label}</button>`).join("")}</nav>
    <section class="card section-card" aria-labelledby="list-title"><div class="section-head"><div><h2 id="list-title">${tabNames[state.activeList][0]}</h2><p>${tabNames[state.activeList][1] ? "修改後會同步給全家" : "你的個人清單，不與其他成員同步"}</p></div><span class="sync-chip">${tabNames[state.activeList][1] ? "全家同步" : "僅此裝置"}</span></div><div class="progress-wrap"><div class="progress-track"><div class="progress-bar" style="width:${percent}%"></div></div><span class="progress-label">${completed}／${current.length}</span></div><div class="check-list" style="margin-top:1rem">${current.length ? current.map((item) => checkRow(item, tabNames[state.activeList][1])).join("") : `<p class="empty-state">清單目前是空的。</p>`}</div></section>
  </main>`;
}

function checkRow(item, synced) {
  return `<article class="check-row ${item.done ? "is-done" : ""}"><button class="check-button ${item.done ? "is-done" : ""}" type="button" data-toggle-list="${item.id}" aria-label="${item.done ? "標示為未完成" : "標示為完成"}">${item.done ? icon("check", 17) : ""}</button><div class="check-copy"><strong>${item.title}</strong></div><button class="icon-button" type="button" data-delete-list="${item.id}" aria-label="刪除${item.title}">${icon("trash", 17)}</button></article>`;
}

function bottomNav() {
  const items = [["home", "home", "首頁"], ["itinerary", "calendar", "行程"], ["stays", "bed", "住宿"], ["expenses", "wallet", "記帳"], ["lists", "checkList", "清單"]];
  return `<nav class="bottom-nav" aria-label="主要導覽">${items.map(([view, iconName, label]) => `<button class="nav-button" type="button" data-view="${view}" ${state.view === view ? 'aria-current="page"' : ""}>${icon(iconName, 20)}<span>${label}</span></button>`).join("")}</nav>`;
}

function dialogs() {
  return `<dialog class="dialog" id="expense-dialog"><form class="dialog-form" data-form="expense"><input type="hidden" name="id"><header class="dialog-head"><h2 id="expense-dialog-title">新增支出</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="關閉">${icon("close", 20)}</button></header><div class="field-group"><label for="expense-date">日期</label><input class="field" id="expense-date" name="date" type="date" min="2027-02-05" max="2027-02-15" value="2027-02-06" required></div><div class="field-group"><label for="expense-name">名稱</label><input class="field" id="expense-name" name="title" placeholder="例如：午餐" required maxlength="50"></div><div class="field-group"><label for="expense-category">類別</label><select class="field" id="expense-category" name="category"><option>食物</option><option>交通</option><option>景點</option><option>逛街</option><option>超市</option><option>機票</option></select></div><div class="field-group"><label for="expense-currency">幣別</label><select class="field" id="expense-currency" name="currency"><option value="TWD">台幣 TWD</option><option value="EUR">歐元 EUR</option><option value="HUF">匈牙利幣 HUF</option></select></div><div class="field-group"><label for="expense-amount">金額</label><input class="field" id="expense-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required></div><div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">取消</button><button class="primary-button" type="submit" id="expense-submit">新增</button></div></form></dialog>
  <dialog class="dialog" id="list-dialog"><form class="dialog-form" data-form="list"><header class="dialog-head"><h2>新增清單項目</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="關閉">${icon("close", 20)}</button></header><div class="field-group"><label for="list-name">項目名稱</label><input class="field" id="list-name" name="title" placeholder="例如：暖暖包" required maxlength="50"></div><div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">取消</button><button class="primary-button" type="submit">新增</button></div></form></dialog>
  <dialog class="dialog" id="itinerary-dialog"><div class="dialog-form"><header class="dialog-head"><h2 id="itinerary-dialog-title"></h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="關閉">${icon("close", 20)}</button></header><section class="itinerary-detail"><p id="itinerary-detail-note"></p><div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">關閉</button><a class="primary-button" id="itinerary-detail-map" target="_blank" rel="noreferrer" style="text-decoration:none">${icon("location", 17)}導航</a></div></section></div></dialog>
  <dialog class="dialog" id="itinerary-edit-dialog"><form class="dialog-form" data-form="itinerary"><input type="hidden" name="id"><header class="dialog-head"><h2 id="itinerary-edit-title">修改行程</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="關閉">${icon("close", 20)}</button></header><div class="field-group"><label for="itinerary-title">行程名稱</label><input class="field" id="itinerary-title" name="title" required maxlength="80"></div><div class="field-group"><label for="itinerary-note">內容</label><textarea class="field" id="itinerary-note" name="note" required maxlength="300"></textarea></div><div class="field-group"><label for="itinerary-category">類別</label><select class="field" id="itinerary-category" name="icon"><option value="train">交通</option><option value="sight">景點</option><option value="food">食物</option><option value="shop">逛街</option></select></div><div class="dialog-actions"><button class="secondary-button" type="button" data-action="close-dialog">取消</button><button class="primary-button" type="submit">儲存</button></div></form></dialog>
  <dialog class="dialog" id="stay-dialog"><form class="dialog-form" data-form="stay"><input type="hidden" name="id"><input type="hidden" name="photoMode"><header class="dialog-head"><h2 id="stay-dialog-title">新增住宿</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="關閉">${icon("close", 20)}</button></header><div class="field-group"><label for="stay-name">住宿名稱</label><input class="field" id="stay-name" name="title" placeholder="貼上 Google Maps 上的住宿名稱" required maxlength="80"><small class="field-hint">輸入或貼上後會自動尋找住宿照片。</small></div><section class="stay-photo-finder" data-photo-state="idle" aria-live="polite"><div class="stay-photo-thumb">${icon("image", 24)}</div><div><strong>住宿照片</strong><p id="stay-photo-status">等待輸入住宿名稱</p><small id="stay-photo-attribution">正式版將顯示 Google Maps 與照片作者標示。</small></div></section><div class="field-group"><label for="stay-city">城市</label><input class="field" id="stay-city" name="city" placeholder="例如：維也納" required maxlength="40"></div><div class="date-field-row"><div class="field-group"><label for="stay-start-date">入住日期</label><input class="field" id="stay-start-date" name="startDate" type="date" min="2027-02-05" max="2027-02-15" required></div><div class="field-group"><label for="stay-end-date">退房日期</label><input class="field" id="stay-end-date" name="endDate" type="date" min="2027-02-05" max="2027-02-15" required></div></div><div class="field-group"><label for="stay-address">地址</label><input class="field" id="stay-address" name="address" placeholder="輸入完整住宿地址" required maxlength="160"></div><div class="date-field-row"><div class="field-group"><label for="stay-checkin">Check-in</label><input class="field" id="stay-checkin" name="checkin" type="time" required></div><div class="field-group"><label for="stay-checkout">Check-out</label><input class="field" id="stay-checkout" name="checkout" type="time" required></div></div><div class="dialog-actions"><button class="danger-button delete-stay-button" type="button" data-action="delete-stay" hidden>${icon("trash", 17)}刪除住宿</button><button class="secondary-button" type="button" data-action="close-dialog">取消</button><button class="primary-button" type="submit">儲存</button></div></form></dialog>
  <dialog class="dialog" id="edit-dialog"><form class="dialog-form" method="dialog"><header class="dialog-head"><h2>原型互動示意</h2><button class="icon-button" type="button" data-action="close-dialog" aria-label="關閉">${icon("close", 20)}</button></header><p>這個項目在正式版本會開啟對應的編輯表單；目前原型先展示入口與資訊層級。</p><div class="dialog-actions"><button class="primary-button" type="submit">知道了</button></div></form></dialog>`;
}

function render() {
  const screens = { home: homeScreen, itinerary: itineraryScreen, stays: staysScreen, expenses: expensesScreen, lists: listsScreen };
  document.querySelector("#app").innerHTML = `<div class="app-shell">${topbar()}${screens[state.view]()}${bottomNav()}${dialogs()}</div>`;
  bindEvents();
  if (state.view === "home") updateCountdown();
}

function bindEvents() {
  document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));
  document.querySelectorAll("[data-view-link]").forEach((link) => link.addEventListener("click", (event) => { event.preventDefault(); setView(link.dataset.viewLink); }));
  document.querySelectorAll("[data-date]").forEach((button) => button.addEventListener("click", () => selectDate(button.dataset.date)));
  document.querySelectorAll("[data-list]").forEach((button) => button.addEventListener("click", () => { state.activeList = button.dataset.list; render(); }));
  document.querySelectorAll("[data-toggle-list]").forEach((button) => button.addEventListener("click", () => toggleList(Number(button.dataset.toggleList))));
  document.querySelectorAll("[data-delete-list]").forEach((button) => button.addEventListener("click", () => deleteList(Number(button.dataset.deleteList))));
  document.querySelectorAll("[data-delete-expense]").forEach((button) => button.addEventListener("click", () => deleteExpense(Number(button.dataset.deleteExpense))));
  document.querySelectorAll("[data-delete-fact]").forEach((button) => button.addEventListener("click", () => deleteFact(Number(button.dataset.deleteFact))));
  document.querySelectorAll("[data-edit-expense]").forEach((button) => button.addEventListener("click", () => openExpenseDialog(Number(button.dataset.editExpense))));
  document.querySelectorAll("[data-expense-date]").forEach((button) => button.addEventListener("click", () => toggleExpenseDate(button.dataset.expenseDate)));
  document.querySelectorAll("[data-view-itinerary]").forEach((button) => button.addEventListener("click", () => openItineraryDialog(Number(button.dataset.viewItinerary))));
  document.querySelectorAll("[data-edit-itinerary]").forEach((button) => button.addEventListener("click", () => openItineraryEditDialog(Number(button.dataset.editItinerary))));
  document.querySelectorAll("[data-delete-itinerary]").forEach((button) => button.addEventListener("click", () => deleteItineraryItem(Number(button.dataset.deleteItinerary))));
  document.querySelectorAll("[data-edit-stay]").forEach((button) => button.addEventListener("click", () => openStayDialog(Number(button.dataset.editStay))));
  bindItineraryDragAndDrop();

  document.querySelector('[data-action="toggle-facts"]')?.addEventListener("click", () => { state.factEditing = !state.factEditing; render(); });
  document.querySelector('[data-action="toggle-itinerary-edit"]')?.addEventListener("click", () => { state.itineraryEditing = !state.itineraryEditing; render(); });
  document.querySelector('[data-action="add-itinerary"]')?.addEventListener("click", () => openItineraryEditDialog());
  document.querySelector('[data-action="add-stay"]')?.addEventListener("click", () => openStayDialog());
  document.querySelector('[data-action="delete-stay"]')?.addEventListener("click", deleteStayFromDialog);
  document.querySelector('[data-action="add-expense"]')?.addEventListener("click", () => openExpenseDialog());
  document.querySelector('[data-action="add-list-item"]')?.addEventListener("click", () => document.querySelector("#list-dialog")?.showModal());
  document.querySelectorAll('[data-action="close-dialog"]').forEach((button) => button.addEventListener("click", () => button.closest("dialog")?.close()));
  document.querySelectorAll("dialog").forEach((dialog) => dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); }));
  document.querySelector('[data-form="expense"]')?.addEventListener("submit", addExpense);
  document.querySelector('[data-form="list"]')?.addEventListener("submit", addListItem);
  document.querySelector('[data-form="itinerary"]')?.addEventListener("submit", saveItineraryItem);
  document.querySelector('[data-form="stay"]')?.addEventListener("submit", saveStay);
  bindStayPhotoLookup();

  const demoActions = ["edit-fact", "add-fact"];
  demoActions.forEach((action) => document.querySelectorAll(`[data-action="${action}"]`).forEach((button) => button.addEventListener("click", () => document.querySelector("#edit-dialog")?.showModal())));
  document.querySelector('[data-action="open-map"]')?.addEventListener("click", () => window.open("https://maps.google.com/", "_blank", "noopener,noreferrer"));
}

function setView(view) {
  state.view = view;
  history.replaceState({}, "", `#${view}`);
  render();
  window.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
}

function selectDate(date) {
  state.selectedDate = date;
  const index = tripDates.findIndex(([value]) => value === date);
  if (index < state.dateWindow) state.dateWindow = index;
  if (index > state.dateWindow + 4) state.dateWindow = Math.min(index - 4, tripDates.length - 5);
  render();
}

function toggleList(id) {
  const item = state.lists[state.activeList].find((entry) => entry.id === id);
  if (item) item.done = !item.done;
  render();
}

function deleteList(id) {
  state.lists[state.activeList] = state.lists[state.activeList].filter((item) => item.id !== id);
  toast("已從清單移除");
  render();
}

function deleteExpense(id) {
  state.expenses = state.expenses.filter((item) => item.id !== id);
  toast("已刪除支出");
  render();
}

function deleteFact(id) {
  state.facts = state.facts.filter((fact) => fact.id !== id);
  toast("已移除小知識");
  render();
}

function openItineraryDialog(id) {
  const item = state.itineraryItems.find((entry) => entry.id === id);
  const dialog = document.querySelector("#itinerary-dialog");
  if (!item || !dialog) return;
  dialog.querySelector("#itinerary-dialog-title").textContent = item.title;
  dialog.querySelector("#itinerary-detail-note").textContent = item.note;
  dialog.querySelector("#itinerary-detail-map").href = googleMapsSearchUrl(item.title);
  dialog.showModal();
}

function openItineraryEditDialog(id = null) {
  const dialog = document.querySelector("#itinerary-edit-dialog");
  const form = dialog?.querySelector("form");
  if (!dialog || !form) return;
  form.reset();
  form.elements.id.value = id ? String(id) : "";
  dialog.querySelector("#itinerary-edit-title").textContent = id ? "修改行程" : "新增行程";
  if (id) {
    const item = state.itineraryItems.find((entry) => entry.id === id);
    if (!item) return;
    form.elements.title.value = item.title;
    form.elements.note.value = item.note;
    form.elements.icon.value = item.icon;
  }
  dialog.showModal();
}

function saveItineraryItem(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const id = Number(data.get("id"));
  const nextItem = { id: id || Date.now(), icon: String(data.get("icon")), title: String(data.get("title")).trim(), note: String(data.get("note")).trim() };
  if (id) {
    const index = state.itineraryItems.findIndex((entry) => entry.id === id);
    if (index < 0) return;
    state.itineraryItems[index] = nextItem;
  } else {
    state.itineraryItems.push(nextItem);
  }
  event.currentTarget.closest("dialog")?.close();
  toast(id ? "行程內容已更新" : "行程已新增");
  render();
}

function deleteItineraryItem(id) {
  state.itineraryItems = state.itineraryItems.filter((item) => item.id !== id);
  toast("行程已刪除");
  render();
}

function openStayDialog(id = null) {
  const dialog = document.querySelector("#stay-dialog");
  const form = dialog?.querySelector("form");
  const deleteButton = dialog?.querySelector('[data-action="delete-stay"]');
  if (!dialog || !form || !deleteButton) return;
  form.reset();
  form.elements.id.value = id ? String(id) : "";
  form.elements.photoMode.value = "";
  dialog.querySelector("#stay-dialog-title").textContent = id ? "編輯住宿" : "新增住宿";
  deleteButton.hidden = !id;
  if (id) {
    const stay = state.stays.find((entry) => entry.id === id);
    if (!stay) return;
    form.elements.title.value = stay.title;
    form.elements.city.value = stay.city;
    form.elements.startDate.value = stay.startDate;
    form.elements.endDate.value = stay.endDate;
    form.elements.address.value = stay.address;
    form.elements.checkin.value = stay.checkin;
    form.elements.checkout.value = stay.checkout;
    form.elements.photoMode.value = stay.photoMode || "";
    updateStayPhotoPreview(stay.title, stay.photoMode === "places");
  } else {
    form.elements.startDate.value = "2027-02-05";
    form.elements.endDate.value = "2027-02-06";
    form.elements.checkin.value = "15:00";
    form.elements.checkout.value = "11:00";
    updateStayPhotoPreview("", false);
  }
  dialog.showModal();
}

function saveStay(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const id = Number(data.get("id"));
  const startDate = String(data.get("startDate"));
  const endDate = String(data.get("endDate"));
  if (endDate <= startDate) {
    toast("退房日期必須晚於入住日期");
    return;
  }
  const existing = state.stays.find((stay) => stay.id === id);
  const tones = ["sky", "mint", "coral"];
  const nextStay = { id: id || Date.now(), startDate, endDate, city: String(data.get("city")).trim(), title: String(data.get("title")).trim(), address: String(data.get("address")).trim(), checkin: String(data.get("checkin")), checkout: String(data.get("checkout")), tone: existing?.tone || tones[state.stays.length % tones.length], photoMode: String(data.get("photoMode")), photoUrl: existing?.photoUrl || "", photoAttribution: existing?.photoAttribution || "" };
  if (id) {
    const index = state.stays.findIndex((stay) => stay.id === id);
    if (index < 0) return;
    state.stays[index] = nextStay;
  } else {
    state.stays.push(nextStay);
  }
  state.stays.sort((a, b) => a.startDate.localeCompare(b.startDate));
  event.currentTarget.closest("dialog")?.close();
  toast(id ? "住宿已更新" : "住宿已新增");
  render();
}

let stayPhotoLookupTimer;

function bindStayPhotoLookup() {
  const input = document.querySelector("#stay-name");
  if (!input) return;
  input.addEventListener("input", () => {
    window.clearTimeout(stayPhotoLookupTimer);
    const name = input.value.trim();
    if (!name) {
      updateStayPhotoPreview("", false);
      return;
    }
    updateStayPhotoPreview(name, false, true);
    stayPhotoLookupTimer = window.setTimeout(() => updateStayPhotoPreview(name, true), 650);
  });
}

function updateStayPhotoPreview(name, ready, loading = false) {
  const panel = document.querySelector(".stay-photo-finder");
  const status = document.querySelector("#stay-photo-status");
  const attribution = document.querySelector("#stay-photo-attribution");
  const field = document.querySelector('[data-form="stay"] [name="photoMode"]');
  if (!panel || !status || !attribution || !field) return;
  panel.dataset.photoState = ready ? "ready" : loading ? "loading" : "idle";
  status.textContent = ready ? `已找到「${name}」的照片預覽` : loading ? `正在搜尋「${name}」…` : "等待輸入住宿名稱";
  attribution.textContent = ready ? "原型示意；正式版會顯示實際照片與作者標示。" : "正式版將顯示 Google Maps 與照片作者標示。";
  field.value = ready ? "places" : "";
}

function deleteStayFromDialog() {
  const dialog = document.querySelector("#stay-dialog");
  const id = Number(dialog?.querySelector('[name="id"]')?.value);
  if (!id) return;
  state.stays = state.stays.filter((stay) => stay.id !== id);
  dialog.close();
  toast("住宿已刪除");
  render();
}

function reorderItineraryItems(sourceId, targetId) {
  if (sourceId === targetId) return;
  const sourceIndex = state.itineraryItems.findIndex((item) => item.id === sourceId);
  const targetIndex = state.itineraryItems.findIndex((item) => item.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [moved] = state.itineraryItems.splice(sourceIndex, 1);
  state.itineraryItems.splice(targetIndex, 0, moved);
  render();
}

function bindItineraryDragAndDrop() {
  document.querySelectorAll("[data-itinerary-card][draggable='true']").forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.dataset.itineraryCard);
      card.classList.add("is-dragging");
    });
    card.addEventListener("dragend", () => card.classList.remove("is-dragging"));
    card.addEventListener("dragover", (event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; });
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      reorderItineraryItems(Number(event.dataTransfer.getData("text/plain")), Number(card.dataset.itineraryCard));
    });

    const handle = card.querySelector(".drag-handle");
    if (!handle) return;
    let pointerTargetId = Number(card.dataset.itineraryCard);
    handle.addEventListener("pointerdown", (event) => {
      handle.setPointerCapture(event.pointerId);
      card.classList.add("is-dragging");
    });
    handle.addEventListener("pointermove", (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("[data-itinerary-card]");
      if (target) pointerTargetId = Number(target.dataset.itineraryCard);
    });
    handle.addEventListener("pointerup", (event) => {
      if (!handle.hasPointerCapture(event.pointerId)) return;
      handle.releasePointerCapture(event.pointerId);
      card.classList.remove("is-dragging");
      reorderItineraryItems(Number(card.dataset.itineraryCard), pointerTargetId);
    });
    handle.addEventListener("pointercancel", () => card.classList.remove("is-dragging"));
  });
}

function toggleExpenseDate(date) {
  if (state.collapsedExpenseDates.has(date)) state.collapsedExpenseDates.delete(date);
  else state.collapsedExpenseDates.add(date);
  render();
}

function openExpenseDialog(id = null) {
  const dialog = document.querySelector("#expense-dialog");
  const form = dialog?.querySelector("form");
  if (!dialog || !form) return;
  form.reset();
  form.elements.id.value = "";
  form.elements.date.value = state.selectedDate ? `2027-${state.selectedDate.replace("/", "-")}` : "2027-02-06";
  document.querySelector("#expense-dialog-title").textContent = id ? "修改支出" : "新增支出";
  document.querySelector("#expense-submit").textContent = id ? "儲存修改" : "新增";
  if (id) {
    const item = state.expenses.find((entry) => entry.id === id);
    if (!item) return;
    form.elements.id.value = String(item.id);
    form.elements.date.value = item.date;
    form.elements.title.value = item.title;
    form.elements.category.value = item.category;
    form.elements.currency.value = item.currency;
    form.elements.amount.value = String(item.amount);
  }
  dialog.showModal();
}

function addExpense(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const currency = String(data.get("currency"));
  const amount = Number(data.get("amount"));
  const rates = { TWD: 1, EUR: 35.2, HUF: 0.0905 };
  const id = Number(data.get("id"));
  const nextExpense = { id: id || Date.now(), date: String(data.get("date")), title: String(data.get("title")), category: String(data.get("category")), currency, amount, twd: Math.round(amount * rates[currency]) };
  if (id) {
    const index = state.expenses.findIndex((item) => item.id === id);
    if (index >= 0) state.expenses[index] = nextExpense;
  } else {
    state.expenses.unshift(nextExpense);
  }
  event.currentTarget.closest("dialog")?.close();
  toast(id ? "支出已更新" : "支出已加入原型");
  render();
}

function addListItem(event) {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  state.lists[state.activeList].push({ id: Date.now(), title: String(data.get("title")), done: false });
  event.currentTarget.closest("dialog")?.close();
  toast("清單項目已新增");
  render();
}

function updateCountdown() {
  const el = document.querySelector("#countdown-value");
  if (!el) return;
  const target = new Date("2027-02-05T00:20:00+08:00");
  const diff = target.getTime() - Date.now();
  if (diff <= 0) { el.textContent = "旅程已開始"; return; }
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  el.textContent = `${days} 天 ${hours} 小時`;
}

function toast(message) {
  requestAnimationFrame(() => {
    const region = document.querySelector("#toast-region");
    if (!region) return;
    region.innerHTML = `<div class="toast">${message}</div>`;
    window.setTimeout(() => { region.innerHTML = ""; }, 1800);
  });
}

window.addEventListener("hashchange", () => {
  const view = window.location.hash.replace("#", "");
  if (["home", "itinerary", "stays", "expenses", "lists"].includes(view)) { state.view = view; render(); }
});

render();
