import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Menu, X, Home, Award, Calendar, CreditCard, LogOut, Gift } from 'lucide-react';
import { loadDB, saveDB, studentLogin, serverLogin, setAuthToken } from './supabaseClient';

// ═══════════════════════════════════════════════════════════
// SESSION — keeps the student logged in across page refreshes,
// but auto-logs-out after 5 minutes of inactivity.
// ═══════════════════════════════════════════════════════════
const SESSION_KEY = 'bdance_session';
const IDLE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

function saveSession(username) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ username, lastActive: Date.now() }));
}
function touchSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return;
  try {
    const s = JSON.parse(raw);
    s.lastActive = Date.now();
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  } catch (e) { /* ignore corrupt session */ }
}
function readSession() {
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (e) { return null; }
}
function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
// true if the stored session is still within the idle window
function isSessionValid(session) {
  return !!session && (Date.now() - session.lastActive) < IDLE_LIMIT_MS;
}

// ═══════════════════════════════════════════════════════════
// CONSTANTS — copied 1:1 from the original app's logic
// ═══════════════════════════════════════════════════════════

// Default/seed reward catalog — matches the admin app's built-in REWARDS list,
// used only as a fallback until the admin has saved custom rewards to Supabase
// (mirrors the admin app's own ensureRewards() seeding behavior).
const DEFAULT_REWARDS = [
  { id: 'water', icon: '💧', cost: 30, name: 'Bottled Water' },
  { id: 'drink', icon: '🥤', cost: 60, name: 'Drink Voucher' },
  { id: 'sticker', icon: '✨', cost: 100, name: 'Sticker Pack' },
  { id: 'wristband', icon: '🎗️', cost: 180, name: 'Studio Wristband' },
  { id: 'tote', icon: '👜', cost: 250, name: 'Canvas Tote Bag' },
  { id: 'freeclass', icon: '🎟️', cost: 400, name: 'Free Single Class' },
  { id: 'tshirt', icon: '👕', cost: 650, name: 'Studio T-Shirt' },
  { id: 'monthfree', icon: '🏆', cost: 1500, name: '1 Month Free (1 class)' },
];

// points earned per class attended, by grade — matches desktop's gradePoints() exactly:
// no grade/G0 = 1, G1 = 2, G2 = 5, G3 = 10, G4 = 10, G5 = 10 (G4/G5 match G3 on desktop)
const gradePoints = (g) => ({ 0: 1, 1: 2, 2: 5, 3: 10, 4: 10, 5: 10 }[g] || 1);

const GRADE_META = {
  1: { tier: 'Bronze', c1: '#e39b5a', c2: '#a45a24', badge: '🥉' },
  2: { tier: 'Silver', c1: '#eef1f4', c2: '#98a0a9', badge: '🥈' },
  3: { tier: 'Gold', c1: '#ffdf6e', c2: '#e0a007', badge: '🥇' },
  4: { tier: 'Diamond', c1: '#8fe9ff', c2: '#37a6d8', badge: '💎' },
  5: { tier: 'Crown', c1: '#ffd75e', c2: '#ff8a2e', badge: '👑' },
};
const gradeMeta = (g) => GRADE_META[g] || GRADE_META[1];

// ═══════════════════════════════════════════════════════════
// LANGUAGE — English / Chinese toggle for the public intro page,
// copy taken directly from the original app's site.* translation keys.
// ═══════════════════════════════════════════════════════════
const TR = {
  en: {
    heroEyebrow: 'Hip-hop · K-pop · Street Jazz · Popping',
    heroLine1: 'Move Like', heroLine2: 'You Mean It',
    heroLead: "B Dance Studio trains beginners through competition crews across 8 street styles — from your first count of 8 to your first time on stage. Four branches across Malaysia, one standard of teaching.",
    findBtn: 'Find a Studio Near You', meetBtn: 'Meet the Instructors',
    statFranchises: 'Branches', statStyles: 'Dance Styles', statInstructors: 'Instructors', statFounded: 'Founded',
    signIn: 'Staff & Student Sign In →',
    eventEyebrow: 'Upcoming Event',
    eventLead: "Our biggest K-pop dance showcase yet — solo, battle, group cover and random play dance. Come compete, or come cheer your crew on.",
    eventBtn: 'Sign In To Register →',
    eventBtnLink: 'Register Now →',
    eventsTitle: 'Upcoming Events',
    shopsEyebrow: 'Collaborated Shops',
    shopsTitle: 'Perks For Our Students',
    shopsLead: 'Show your student ID at any of these partner shops to enjoy a 10% discount. Tap a shop to see what they offer.',
    shopDiscount: '10% student discount', shopDiscountShort: '10% OFF',
    shopOffers: 'What they offer', shopNoItems: 'Ask in store for details.', shopVisit: 'Visit shop →',
    showAllTeachers: 'Show all {n} instructors', showLessTeachers: 'Show fewer instructors',
    aboutEyebrow: 'About Us', aboutTitle1: 'Built By Dancers,', aboutTitle2: 'Not A Branch Playbook',
    aboutLead: "B Dance Studio started as a single Adda Height studio teaching hip-hop fundamentals to kids who'd only ever seen the moves online. Today we run four branches across Malaysia — teaching everything from beginner hip-hop to competition-level choreography, K-pop cover dance, popping, waacking, and dancehall — taught by instructors who still perform. Every class runs on the same standard no matter which branch you walk into.",
    instructorsEyebrow: 'Our Instructors', instrTitle1: 'Learn From People', instrTitle2: 'Who Still Train',
    instrLead: 'Ten resident instructors across our four branches, each bringing real specialities rather than a little of everything.',
    tapToConnect: 'Tap to view',
    locationsEyebrow: 'Locations', locTitle1: 'Four Branches,', locTitle2: 'One Studio',
    locLead: "Same styles, same teaching standard, different neighborhoods. Pick whichever's closest.",
    ctaTitle: 'Ready To Start?', ctaLead: 'Staff, teachers, and enrolled students sign in below.', ctaBtn: 'Staff & Student Sign In →',
    contactBtn: 'Contact Us →', contactTitle: 'Contact Us', findStudio: 'Find a Studio Near You',
    watch: 'Watch', seeUsMove: 'See Us Move', studioReel: 'Studio Reel',
    openInstagram: 'Open Instagram', openXiaohongshu: 'Open Xiaohongshu', socialNone: 'No social links added yet.', close: 'Close',
    back: 'Back', login: 'Login', username: 'Username', password: 'Password', loggingIn: 'Logging in…',
    getDirections: 'Get Directions →', chooseNavApp: 'Open with', openWaze: 'Open in Waze', openGoogleMaps: 'Open in Google Maps',
  },
  zh: {
    heroEyebrow: 'Hip-hop · K-pop · Street Jazz · Popping',
    heroLine1: '舞出', heroLine2: '真心态度',
    heroLead: 'B Dance Studio 培训从初学者到竞技团队，涵盖8种街舞风格——从第一个八拍到第一次登台。马来西亚四家分店，同一套教学标准。',
    findBtn: '寻找附近的分店', meetBtn: '认识我们的导师',
    statFranchises: '分店', statStyles: '舞蹈风格', statInstructors: '导师', statFounded: '成立于',
    signIn: '员工与学生登录 →',
    eventEyebrow: '近期活动',
    eventLead: '我们规模最大的 K-pop 舞蹈盛会 —— 个人赛、对战、团体翻跳与随机舞。来参赛，或来为你的队伍加油！',
    eventBtn: '登录报名 →',
    eventBtnLink: '立即报名 →',
    eventsTitle: '近期活动',
    shopsEyebrow: '合作商店',
    shopsTitle: '学员专属优惠',
    shopsLead: '在以下任一合作商店出示学员证，即可享 9 折优惠。点击商店查看其优惠。',
    shopDiscount: '学员 9 折优惠', shopDiscountShort: '9 折',
    shopOffers: '优惠内容', shopNoItems: '详情请到店咨询。', shopVisit: '前往商店 →',
    showAllTeachers: '查看全部 {n} 位导师', showLessTeachers: '收起导师列表',
    aboutEyebrow: '关于我们', aboutTitle1: '由舞者创立，', aboutTitle2: '而非连锁模板',
    aboutLead: 'B Dance Studio 最初只是Adda Height的一家小工作室，教孩子们从网络上看到的hip-hop基本功。如今我们在马来西亚经营四家分店——教授从初学hip-hop到竞技级编舞、K-pop翻跳、popping、waacking和dancehall的一切课程——导师们至今仍在表演。无论走进哪一家分店，教学标准始终如一。',
    instructorsEyebrow: '我们的导师', instrTitle1: '向真正在教学的人', instrTitle2: '学习舞蹈',
    instrLead: '十位驻店导师分布在我们的四家分店，各自拥有真正的专长，而非样样略懂。',
    tapToConnect: '点击查看',
    locationsEyebrow: '分店地点', locTitle1: '四家分店，', locTitle2: '同一间舞室',
    locLead: '相同的风格，相同的教学标准，不同的社区。选择离你最近的一家。',
    ctaTitle: '准备好开始了吗？', ctaLead: '员工、导师与在籍学生请在下方登录。', ctaBtn: '员工与学生登录 →',
    contactBtn: '联系我们 →', contactTitle: '联系我们', findStudio: '寻找附近的分店',
    watch: '观看', seeUsMove: '精彩视频', studioReel: '工作室短片',
    openInstagram: '打开 Instagram', openXiaohongshu: '打开小红书', socialNone: '尚未添加社交链接。', close: '关闭',
    back: '返回', login: '登录', username: '用户名', password: '密码', loggingIn: '登录中…',
    getDirections: '获取路线 →', chooseNavApp: '选择打开方式', openWaze: '用 Waze 打开', openGoogleMaps: '用谷歌地图打开',
  },
};

// Builds Waze + Google Maps links for a text address/query — same address
// source as the original site's mapQuery (place name / neighborhood text,
// since the studio database only stores names, not coordinates).
function getDirectionLinks(query) {
  const q = encodeURIComponent(query);
  return {
    waze: `https://waze.com/ul?q=${q}&navigate=yes`,
    google: `https://www.google.com/maps/search/?api=1&query=${q}`,
  };
}

// ═══════════════════════════════════════════════════════════
// FOOTER — ported from the original app's footerDefaults()/FV()/waLink()/
// footerSocialHTML(). Reads db.intro.footer, same field names, same link
// formats (tel:, wa.me digits-only, mailto:, prefixed social handles).
// ═══════════════════════════════════════════════════════════
function footerDigitsOnly(v) {
  return String(v || '').replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
}
function footerWaLink(v) {
  const d = footerDigitsOnly(v).replace(/^\+/, '');
  return d ? `https://wa.me/${d}` : '';
}
const FOOTER_SOCIAL_NETS = [
  { k: 'instagram', icon: '📸', label: 'Instagram', pre: 'https://www.instagram.com/' },
  { k: 'facebook', icon: '👍', label: 'Facebook', pre: 'https://www.facebook.com/' },
  { k: 'tiktok', icon: '🎵', label: 'TikTok', pre: 'https://www.tiktok.com/@' },
  { k: 'youtube', icon: '▶️', label: 'YouTube', pre: 'https://www.youtube.com/@' },
  { k: 'xiaohongshu', icon: '📕', label: 'Xiaohongshu', pre: 'https://www.xiaohongshu.com/user/profile/' },
];
// Same normalization as the desktop app's normalizeSocialLink(): a full URL passes
// through untouched; Instagram gets prefixed with instagram.com/; anything else
// (including Xiaohongshu) just gets a bare https:// prefix, not a fixed domain.
function normalizeSocialLink(v, type) {
  v = (v || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (type === 'instagram') return 'https://www.instagram.com/' + v.replace(/^@+/, '');
  return 'https://' + v.replace(/^\/+/, '');
}

// ── Collaborated shops ──────────────────────────────────────────────
// Mirrors the desktop app's getIntroShops(): db.intro.shops is an array of
// { name, photo (500x500 data URL), items (newline-separated), url }. Only shops
// with at least a name or a photo are shown.
function blankShop() { return { name: '', photo: '', items: '', url: '' }; }
function getIntroShops(intro) {
  const list = intro?.shops;
  if (!Array.isArray(list)) return [];
  return list.map(s => ({ ...blankShop(), ...s })).filter(s => (s.name && s.name.trim()) || s.photo);
}

// ── Events ──────────────────────────────────────────────────────────
// Mirrors the desktop app's getIntroEvents(): db.intro.events is an array of
// { badge, title, lead, date, time, venue, cats, regUrl, poster }. Older data
// stored a single event as flat eventBadge/eventTitle/… keys — fold that into a
// one-item array so nothing is lost.
// ── Blank/derived event shape ───────────────────────────────────────
function blankEvent() { return { badge: '', title: '', lead: '', date: '', time: '', venue: '', cats: '', regUrl: '', poster: '' }; }
function getIntroEvents(intro) {
  const I = intro || {};
  if (Array.isArray(I.events) && I.events.length) return I.events.map(e => ({ ...blankEvent(), ...e }));
  const legacy = {
    badge: I.eventBadge || '', title: I.eventTitle || '', lead: I.eventLead || '', date: I.eventDate || '',
    time: I.eventTime || '', venue: I.eventVenue || '', cats: I.eventCats || '', regUrl: I.eventRegUrl || '', poster: I.eventPoster || '',
  };
  const touched = Object.values(legacy).some(x => x != null && String(x).trim() !== '');
  return touched ? [legacy] : [blankEvent()];
}

// ── Shop loop line ──────────────────────────────────────────────────
// Used instead of the wrapping grid once there are lots of shops, which would otherwise stack into
// several tall rows. It's a real scroll strip nudged along by JS rather than a CSS animation, so a
// swipe gets the browser's own momentum and a mouse can drag it. Three copies of the list are laid
// end to end and the scroll is parked in the middle one, so it can run off either end and still
// have list to show; jumping back by exactly one copy is invisible because the pixels are identical.
// Pull-to-refresh indicator: slides down from under the top edge as the page is dragged, fills in
// as it nears the trigger point, then spins while the refresh runs.
function PullIndicator({ dist, refreshing, trigger }) {
  // Only show once the pull is deliberate. iOS can report a scroll position of 0 (or briefly
  // negative) during an ordinary flick, which used to surface the indicator for a moment during
  // normal scrolling — it looked like a stuck icon rather than a gesture.
  if (dist < 12 && !refreshing) return null;
  const ready = dist >= trigger;
  const progress = Math.min(dist / trigger, 1);
  return (
    <div
      className="fixed left-0 right-0 flex justify-center pointer-events-none"
      style={{ top: 0, transform: `translateY(${Math.max(dist - 34, 0)}px)`, zIndex: 300,
               transition: refreshing ? 'transform .2s ease-out' : 'none' }}
    >
      <div
        className="bg-zinc-900 border border-amber-700 rounded-full w-9 h-9 flex items-center justify-center shadow-lg"
        style={{ opacity: refreshing ? 1 : 0.4 + progress * 0.6 }}
      >
        <span
          className="text-amber-400 text-base leading-none"
          style={{
            display: 'inline-block',
            animation: refreshing ? 'pullSpin .8s linear infinite' : 'none',
            transform: refreshing ? 'none' : `rotate(${ready ? 180 : progress * 180}deg)`,
            transition: refreshing ? 'none' : 'transform .15s linear',
          }}
        >
          {refreshing ? '⟳' : '↓'}
        </span>
      </div>
    </div>
  );
}

function BackToTop() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 480);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      aria-label="Back to top"
      className={`fixed bottom-24 right-4 z-40 w-11 h-11 rounded-full bg-amber-600 text-ink text-lg shadow-lg flex items-center justify-center transition-opacity ${show ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
    >
      ↑
    </button>
  );
}

const SHOP_MARQUEE_MIN = 11; // more shops than this many → scroll them instead of wrapping
const TEACHER_PREVIEW = 6;   // instructors shown before the "Show all" button is needed
const LIST_PREVIEW = 5;      // rows shown in an unfiltered history list
const CLASS_PREVIEW = 10;    // classes shown in the unfiltered All Classes list
const DAY_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// Toggle under a capped list. `total` is the full count so the label can say what's hidden.
function ShowMoreButton({ expanded, total, onToggle, moreLabel, lessLabel = 'Show less' }) {
  return (
    <button
      onClick={onToggle}
      className="w-full mt-3 border border-amber-700 text-amber-400 font-semibold py-2.5 rounded text-sm active:bg-zinc-800 transition"
    >
      {expanded ? lessLabel : (moreLabel || `Show all ${total}`)}
    </button>
  );
}
const SHOP_DRIFT_PX = 0.4;   // per frame ≈ 24px/s
const SHOP_DRAG_SLOP = 6;    // px of travel before a press counts as a drag rather than a tap
function ShopMarquee({ shops, discountLabel, onOpen }) {
  const boxRef = useRef(null);
  // Set while the pointer is being dragged, so the tap handler below knows to ignore the click that
  // the browser fires at the end of a drag — otherwise pulling the line along opens a random shop.
  const draggedRef = useRef(false);

  useEffect(() => {
    const el = boxRef.current;
    const track = el && el.querySelector('[data-shop-track]');
    if (!el || !track) return;
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let raf = null, dragging = false, moved = false, startX = 0, startScroll = 0, holdUntil = 0;
    const copyW = () => track.scrollWidth / 3;
    const hold = ms => { holdUntil = Date.now() + ms; };

    const park = () => { const w = copyW(); if (w > 0) el.scrollLeft = w; };
    // wait for layout (images/fonts) or scrollWidth is still 0
    const parkRaf = requestAnimationFrame(() => requestAnimationFrame(park));

    const wrap = () => {
      const w = copyW(); if (w <= 0) return;
      let x = el.scrollLeft, guard = 0;
      while (x >= w * 2 && guard++ < 8) x -= w;
      while (x <= 0 && guard++ < 8) x += w;
      if (x !== el.scrollLeft) el.scrollLeft = x;
    };
    const step = () => {
      if (!dragging && Date.now() > holdUntil && !reduced) el.scrollLeft += SHOP_DRIFT_PX;
      wrap();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onEnter = () => hold(1e9);              // hovering: hold still so a shop can be read
    const onLeave = () => { if (!dragging) hold(0); };
    // Touch is left to the browser: it pans natively with real momentum, and a scroll gesture never
    // turns into a click, so only the mouse needs the manual drag below.
    const onDown = e => {
      if (e.pointerType === 'touch') { hold(1e9); draggedRef.current = false; return; }
      dragging = true; moved = false;
      startX = e.clientX; startScroll = el.scrollLeft;
      draggedRef.current = false;
      el.style.cursor = 'grabbing';
      if (el.setPointerCapture) { try { el.setPointerCapture(e.pointerId); } catch (_) {} }
    };
    const onMove = e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      if (!moved && Math.abs(dx) > SHOP_DRAG_SLOP) { moved = true; draggedRef.current = true; }
      if (moved) {
        // Fold the target back into the middle copy BEFORE writing it — assigning a negative
        // scrollLeft is just clamped to 0 by the browser and the line would stick at the edge.
        // startScroll shifts by the same amount so the line keeps tracking the cursor.
        let target = startScroll - dx, w = copyW(), guard = 0;
        if (w > 0) {
          while (target >= w * 2 && guard++ < 8) { target -= w; startScroll -= w; }
          while (target <= 0 && guard++ < 8) { target += w; startScroll += w; }
        }
        el.scrollLeft = target;
        e.preventDefault();
      }
    };
    const onUp = e => {
      if (e.pointerType === 'touch') { hold(900); return; } // let native momentum finish, then drift
      if (!dragging) return;
      dragging = false;
      el.style.cursor = 'grab';
      hold(moved ? 1200 : 0);
      // clear a beat later so the click fired at the end of this drag still sees it
      if (moved) setTimeout(() => { draggedRef.current = false; }, 0);
      moved = false;
    };
    const onDragStart = e => e.preventDefault(); // stop the browser's own image dragging

    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('dragstart', onDragStart);
    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(parkRaf);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      el.removeEventListener('dragstart', onDragStart);
    };
  }, [shops.length]);
  // Keyed on the count, not the array: `shops` is rebuilt on every render, so depending on it would
  // tear this down and re-park the scroll each time the event slider ticks — the line would visibly
  // jump back every few seconds. Only a change in how many shops there are alters the track width.

  const chip = (sh, i, dup) => (
    <button
      key={(dup || 'a') + '-' + i}
      onClick={() => { if (draggedRef.current) return; onOpen(sh); }}
      aria-hidden={dup ? 'true' : undefined}
      tabIndex={dup ? -1 : undefined}
      className="flex flex-col items-center gap-2 w-24 flex-none active:scale-95 transition"
      style={{ marginRight: 16 }}
    >
      {sh.photo
        ? <div className="w-20 h-20 rounded-2xl bg-cover bg-center border border-amber-900/50 shadow-lg" style={{ backgroundImage: `url('${String(sh.photo).replace(/'/g, '%27')}')` }} />
        : <div className="w-20 h-20 rounded-2xl bg-amber-900 flex items-center justify-center font-bold text-white text-xl shadow-lg">{(sh.name || '?').slice(0, 1)}</div>}
      <span className="text-white text-xs font-semibold text-center leading-tight">{sh.name}</span>
      <span className="text-amber-500 text-[9px] font-bold uppercase tracking-wide">{discountLabel}</span>
    </button>
  );

  return (
    <div
      ref={boxRef}
      className="overflow-x-auto overflow-y-hidden select-none shop-marquee-box"
      style={{ cursor: 'grab', touchAction: 'pan-x', overscrollBehaviorX: 'contain',
               scrollbarWidth: 'none', msOverflowStyle: 'none',
               WebkitMaskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)',
               maskImage: 'linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent)' }}
    >
      <div data-shop-track className="flex" style={{ width: 'max-content' }}>
        {shops.map((sh, i) => chip(sh, i, 'p'))}
        {shops.map((sh, i) => chip(sh, i, null))}
        {shops.map((sh, i) => chip(sh, i, 'n'))}
      </div>
    </div>
  );
}

function footerSocialLinks(footer) {
  return FOOTER_SOCIAL_NETS.map(nt => {
    const raw = (footer?.[nt.k] || '').trim();
    if (!raw) return null;
    const url = /^https?:\/\//i.test(raw) ? raw : nt.pre + raw.replace(/^@+/, '');
    return { ...nt, url };
  }).filter(Boolean);
}

// Same link/embed detection as the original desktop app's videoEmbedHTML(): supports
// YouTube, Vimeo, Instagram Reels/posts, direct video file links, and data: video URIs.
function getVideoEmbed(url) {
  const u = (url || '').trim();
  if (!u) return null;
  let m;
  if (/^data:video\//i.test(u)) {
    return { type: 'video', src: u, portrait: false };
  }
  if ((m = u.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{6,})/))) {
    return { type: 'iframe', src: `https://www.youtube.com/embed/${m[1]}`, portrait: false };
  }
  if ((m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/))) {
    return { type: 'iframe', src: `https://player.vimeo.com/video/${m[1]}`, portrait: false };
  }
  if ((m = u.match(/instagram\.com\/(reels?|p|tv)\/([A-Za-z0-9_-]+)/i))) {
    let type = m[1].toLowerCase(); if (type === 'reels') type = 'reel';
    return { type: 'iframe', src: `https://www.instagram.com/${type}/${m[2]}/embed`, portrait: true };
  }
  // Matches desktop's videoEmbedHTML(), which also accepts .mov and .m4v — the format an
  // iPhone records in by default, so an admin's phone-uploaded clip still plays here.
  if (/\.(mp4|webm|ogg|mov|m4v)(\?.*)?$/i.test(u)) {
    return { type: 'video', src: u, portrait: false };
  }
  return { type: 'iframe', src: u, portrait: false };
}

// Same deterministic "QR-style" pattern as the desktop site's qrSvg(): a seeded
// pseudo-random 25x25 grid with finder squares in the three corners, styled to
// look like a scannable code next to the eWallet details. Same seed (tngNumber +
// accountName) as desktop, so both platforms render an identical-looking pattern.
function paymentQrCells(seed) {
  const N = 25, q = 2, cell = 8;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 16777619); }
  let st = h >>> 0;
  const rnd = () => { st ^= st << 13; st ^= st >>> 17; st ^= st << 5; st >>>= 0; return st / 4294967296; };
  const g = Array.from({ length: N }, () => Array(N).fill(0));
  const finderZone = (r, c) => (r < 8 && c < 8) || (r < 8 && c >= N - 8) || (r >= N - 8 && c < 8);
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (!finderZone(r, c)) g[r][c] = rnd() < 0.47 ? 1 : 0; }
  const finder = (R, C) => {
    for (let r = 0; r < 7; r++) for (let c = 0; c < 7; c++) {
      const edge = (r === 0 || r === 6 || c === 0 || c === 6), inner = (r >= 2 && r <= 4 && c >= 2 && c <= 4);
      g[R + r][C + c] = (edge || inner) ? 1 : 0;
    }
  };
  finder(0, 0); finder(0, N - 7); finder(N - 7, 0);
  const rects = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) { if (g[r][c]) rects.push([(c + q) * cell, (r + q) * cell]); }
  return { rects, sz: (N + q * 2) * cell, cell };
}

const PaymentQr = ({ seed }) => {
  const { rects, sz, cell } = paymentQrCells(seed || '');
  return (
    <svg viewBox={`0 0 ${sz} ${sz}`} width="146" height="146" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Payment QR">
      <rect width={sz} height={sz} fill="#fff" />
      <g fill="#0a0a0a">
        {rects.map(([x, y], i) => <rect key={i} x={x} y={y} width={cell} height={cell} />)}
      </g>
    </svg>
  );
};

export default function BDanceStudentApp() {
  const [currentPage, setCurrentPage] = useState('fees'); // website's student nav order: My Fees, My Classes, All Classes, My Attendance, Rewards
  const [showMenu, setShowMenu] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false); // false = show the public intro page first
  const [lang, setLang] = useState('en'); // 'en' | 'zh' — intro page language toggle
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  // v5.0: field-level login validation — show a field's error only once the visitor has left it,
  // not while they're still typing, and keep the submit button disabled until both are clean.
  const [touched, setTouched] = useState({ username: false, password: false });
  const [validationErrors, setValidationErrors] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSuccess, setPwSuccess] = useState(false);
  const [birthdayInput, setBirthdayInput] = useState('');
  const [birthdaySaving, setBirthdaySaving] = useState(false);
  const [birthdayError, setBirthdayError] = useState('');
  const [birthdaySuccess, setBirthdaySuccess] = useState(false);
  const [payFrom, setPayFrom] = useState('');
  const [payTo, setPayTo] = useState('');
  const [attFrom, setAttFrom] = useState('');
  const [allClassPlaceFilter, setAllClassPlaceFilter] = useState('all');
  const [allClassTeacherFilter, setAllClassTeacherFilter] = useState('all');
  const [allClassStyleFilter, setAllClassStyleFilter] = useState('all');
  const [attTo, setAttTo] = useState('');
  const [rewardCodeModal, setRewardCodeModal] = useState(null);
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle' | 'saving' | 'done' | 'error' — drives the save overlay for any action that writes to Supabase
  const [attendanceModalClass, setAttendanceModalClass] = useState(null); // holds the class object when "View All" is tapped
  const [attendanceModalSearch, setAttendanceModalSearch] = useState(''); // search filter inside the attendance modal
  const [teacherModal, setTeacherModal] = useState(null); // holds the tapped teacher's id (not a snapshot), so the modal always re-reads current data from `teachers`
  const [teacherSlide, setTeacherSlide] = useState(0); // current slide in the teacher modal's photo/video/quote carousel
  const [directionsModal, setDirectionsModal] = useState(null); // holds { name, query } when a location card is tapped
  const [shopModal, setShopModal] = useState(null); // holds the shop object when a collaborated-shop icon is tapped
  const [eventSlide, setEventSlide] = useState(0); // current slide in the multi-event auto-slider on the intro page
  const [showAllTeachers, setShowAllTeachers] = useState(false); // intro page shows 6 instructors until asked for the rest
  // Signed proof from the server that this sign-in was genuine. Not enforced by the data endpoint
  // yet — issued and kept now so locking that endpoint down is a small follow-up change.
  const [sessionToken, setSessionToken] = useState('');
  // Long lists start capped so a page opens on something readable rather than hundreds of rows.
  // Applying a filter is itself a request to see everything that matches, so the cap lifts then.
  const [showAllClasses, setShowAllClasses] = useState(false);
  const [showAllPayments, setShowAllPayments] = useState(false);
  const [showAllRedemptions, setShowAllRedemptions] = useState(false);
  const [redeemFrom, setRedeemFrom] = useState(''); // redemption history date range
  const [redeemTo, setRedeemTo] = useState('');
  const [branchLinksModal, setBranchLinksModal] = useState(null); // holds a title string when the "Contact Us" picker is open

  // ═══════════════════════════════════════════════════════════
  // LIVE DATA — loaded from Supabase via /api/db on login.
  // `db` is the whole shared database (same shape as the original
  // app's `DB` object: students, payments, classes, attendance, accounts).
  // `student` is just the logged-in student's own record for convenience.
  // ═══════════════════════════════════════════════════════════
  const [db, setDb] = useState(null);
  const [student, setStudent] = useState(null);
  const [account, setAccount] = useState(null); // the logged-in accounts[] entry — needed for password changes
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(true); // true while checking for a saved session on first load
  const [showInstallPrompt, setShowInstallPrompt] = useState(false); // the "Add to Home Screen" modal shown once before the intro page
  const [deferredInstallEvent, setDeferredInstallEvent] = useState(null); // Android/Chrome's native beforeinstallprompt event, if fired
  const [isIOS, setIsIOS] = useState(false);

  const classes = useMemo(() => db?.classes || [], [db]);
  const attendance = useMemo(
    () => (db?.attendance || []).filter(a => a.studentId === student?.id),
    [db, student]
  );
  const payments = useMemo(
    () => (db?.payments || []).filter(p => p.studentId === student?.id),
    [db, student]
  );

  // Persist any change to the shared student record (redemptions, birthday
  // claims) back to Supabase — same "save whole DB" pattern as the original app.
  const persistStudent = async (updatedStudent, { silent = false } = {}) => {
    setStudent(updatedStudent);
    if (!db) return true;
    const newDb = {
      ...db,
      students: (db.students || []).map(s => s.id === updatedStudent.id ? updatedStudent : s),
    };
    setDb(newDb);
    if (!silent) setSaveStatus('saving');
    try {
      await saveDB(newDb);
      if (!silent) {
        setSaveStatus('done');
        setTimeout(() => setSaveStatus('idle'), 1200); // brief "Saved ✓" flash, then auto-dismiss
      }
      return true;
    } catch (e) {
      console.error('Save failed', e);
      if (!silent) {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 2000);
      }
      return false;
    }
  };

  // Saves a change to the logged-in account itself (currently: password only).
  // Separate from persistStudent because accounts and students are different
  // arrays in the shared DB — same "save whole DB" pattern either way.
  const persistAccount = async (updatedAccount) => {
    if (!db) return false;
    const newDb = {
      ...db,
      accounts: (db.accounts || []).map(a => (a.user === updatedAccount.user ? updatedAccount : a)),
    };
    setDb(newDb);
    setSaveStatus('saving');
    try {
      await saveDB(newDb);
      setSaveStatus('done');
      setTimeout(() => setSaveStatus('idle'), 1200);
      return true;
    } catch (e) {
      console.error('Save failed', e);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 2000);
      return false;
    }
  };

  // Password change — the only self-service edit students get, matching the
  // website's rule (msg.profileLocked: "Only your password can be changed here").
  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    setPwSuccess(false);
    if (!account) { setPwError('Could not find your account — please log in again.'); return; }
    if (currentPw !== account.pass) { setPwError('Current password is incorrect.'); return; }
    if (newPw.length < 4) { setPwError('New password must be at least 4 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('New password and confirmation do not match.'); return; }
    const updatedAccount = { ...account, pass: newPw };
    const ok = await persistAccount(updatedAccount);
    if (ok) {
      setAccount(updatedAccount);
      setCurrentPw(''); setNewPw(''); setConfirmPw('');
      setPwSuccess(true);
      setTimeout(() => setPwSuccess(false), 3000);
    } else {
      setPwError("Couldn't save — check your connection and try again.");
    }
  };

  // Birthday — the second self-service edit students get (alongside password).
  // Saves straight to the shared student record via persistStudent, so it
  // shows up immediately on the desktop site too (student edit form, and the
  // Rewards page's birthday countdown/claim logic on both platforms).
  const handleSaveBirthday = async (e) => {
    e.preventDefault();
    setBirthdayError('');
    setBirthdaySuccess(false);
    if (!student) { setBirthdayError('Could not find your profile — please log in again.'); return; }
    if (!birthdayInput) { setBirthdayError('Please choose a date.'); return; }
    const picked = new Date(birthdayInput + 'T00:00:00');
    if (Number.isNaN(picked.getTime()) || picked > new Date()) {
      setBirthdayError('Please choose a valid date in the past.');
      return;
    }
    setBirthdaySaving(true);
    const ok = await persistStudent({ ...student, birthday: birthdayInput });
    setBirthdaySaving(false);
    if (ok) {
      setBirthdaySuccess(true);
      setTimeout(() => setBirthdaySuccess(false), 3000);
    } else {
      setBirthdayError("Couldn't save — check your connection and try again.");
    }
  };

  // Mobile-only rule: a redeemed-but-uncollected reward code holds its points for 3 days.
  // If the counter hasn't verified it by then, the pending record is simply deleted — no points
  // were ever deducted for a pending code (see pointsBalance/spendablePoints above), so "returning"
  // the points just means removing the hold, which happens automatically once the record is gone.
  const EXPIRY_DAYS = 3;
  const expireStalePendingRewards = (studentRecord) => {
    if (!studentRecord?.redemptions?.length) return studentRecord;
    const cutoff = Date.now() - EXPIRY_DAYS * 24 * 60 * 60 * 1000;
    const kept = studentRecord.redemptions.filter(r => {
      if (r.collected) return true; // already claimed — never expires
      const redeemedAt = new Date(r.date + 'T00:00:00').getTime();
      return redeemedAt >= cutoff; // still within the 3-day hold window
    });
    if (kept.length === studentRecord.redemptions.length) return studentRecord; // nothing expired
    return { ...studentRecord, redemptions: kept };
  };

  // ═══════════════════════════════════════════════════════════
  // DERIVED LOGIC — ported from the original functions:
  // gradeOf / hasAnyGrade / studentEarnedPoints / pointsBalance /
  // presentCount / birthdayInfo
  // ═══════════════════════════════════════════════════════════

  const hasAnyGrade = Object.values(student?.styleGrades || {}).some(v => v > 0);
  const gradeOf = hasAnyGrade ? Math.max(...Object.values(student.styleGrades)) : 0;

  // Same rules as the original app's counted()/attWeight(): a cancelled class was
  // never attended; single-class drop-ins are billed separately; extras/replacements
  // DO count (half-hour = 0.5, one-hour = 1); a regular class paid from credits is
  // pre-paid and sits OUTSIDE the monthly cycle.
  const counted = (a) => {
    if (a.status === 'cancelled') return false;
    if (a.single) return false;
    if (a.extra) return true;
    if (a.paidByCredit) return false;
    return a.status === 'present';
  };
  const attWeight = (a) => (a.extra && a.dur === 'half') ? 0.5 : 1;

  // Points earned matches the desktop app's studentEarnedPoints() exactly: every attendance
  // record with status 'present' earns points at the student's grade rate — full 1x each,
  // regardless of extra/credit/single-class flags. (Those flags only affect the separate
  // 4-class billing-cycle count below, via counted()/attWeight() — not points.)
  const earnedPoints = attendance.filter(a => a.status === 'present').length * gradePoints(gradeOf);
  const bonusPoints = (student?.bdayClaims?.length || 0) * 100;
  // Matches the desktop app's committedPoints()/studentRedeemedPoints(): once a redemption is
  // collected, the authoritative spent total is student.spentPoints if the counter has set it;
  // otherwise it falls back to the sum of already-collected redemption costs.
  const redeemedPoints = (typeof student?.spentPoints === 'number')
    ? student.spentPoints
    : (student?.redemptions || []).filter(r => r.collected).reduce((n, r) => n + r.cost, 0);
  const pendingPoints = (student?.redemptions || []).filter(r => !r.collected).reduce((n, r) => n + r.cost, 0);
  const pointsBalance = earnedPoints + bonusPoints - redeemedPoints;
  // SPENDABLE = displayed balance minus points already on hold from pending codes, so a student can
  // never redeem more than they actually have, even before any code is claimed (matches desktop).
  const spendablePoints = pointsBalance - pendingPoints;

  // classes counted toward the monthly billing cycle
  const presentCount = attendance.filter(counted).reduce((n, a) => n + attWeight(a), 0);
  const cycleProgress = presentCount % 4 === 0 && presentCount > 0 ? 4 : presentCount % 4;

  const todayStr = new Date().toISOString().slice(0, 10);

  const birthdayInfo = useMemo(() => {
    if (!student?.birthday) return null;
    const today = new Date();
    const bd = new Date(student.birthday + 'T00:00:00');
    const isToday = today.getMonth() === bd.getMonth() && today.getDate() === bd.getDate();
    let next = new Date(today.getFullYear(), bd.getMonth(), bd.getDate());
    if (next < today) next = new Date(today.getFullYear() + 1, bd.getMonth(), bd.getDate());
    const days = Math.round((next - today) / 86400000);
    const claimedThisYear = (student.bdayClaims || []).includes(today.getFullYear());
    return { isToday, days, claimedThisYear };
  }, [student?.birthday, student?.bdayClaims]);

  // Live rewards catalog from Supabase (db.rewards, admin-editable) — falls
  // back to the built-in defaults only if the admin hasn't saved any yet.
  const rewards = (db?.rewards && db.rewards.length) ? db.rewards : DEFAULT_REWARDS;

  const nextReward = rewards.filter(r => r.cost > spendablePoints).sort((a, b) => a.cost - b.cost)[0];

  const myClasses = classes.filter(c => (student?.classIds || []).includes(c.id));
  const myPayments = payments;
  const pendingPayments = myPayments.filter(p => p.status !== 'Paid');

  // Classmates: other students sharing a class, same as the desktop app's
  // DB.students.filter(s => s.id!==sid && s.classIds.includes(myClass.id))
  const classmatesFor = (classId) => (db?.students || []).filter(s => s.id !== student?.id && (s.classIds || []).includes(classId));
  // Enrollment count for capacity display on All Classes ("Full" / "N open")
  const enrolledCountFor = (classId) => (db?.students || []).filter(s => (s.classIds || []).includes(classId)).length;

  // ═══════════════════════════════════════════════════════════
  // HANDLERS — ported from doLogin() / claimBirthday() / redeemReward(),
  // now backed by the shared Supabase database via /api/db.
  // ═══════════════════════════════════════════════════════════

  // v5.0: same validation rules as supabaseClient.js's validateUsername/validatePassword, mirrored
  // here so the form can show a field-level error the instant someone leaves the field — rather than
  // only finding out after submitting and getting a response back from the server.
  const validateUsernameField = (value) => {
    if (!value || !value.trim()) return 'Username is required';
    if (value.length > 100) return 'Username is too long';
    if (!/^[a-zA-Z0-9._@\-\s]+$/.test(value)) return 'Username contains invalid characters';
    return '';
  };
  const validatePasswordField = (value) => {
    if (!value) return 'Password is required';
    if (value.length > 255) return 'Password is too long';
    return '';
  };
  const handleUsernameChange = (e) => {
    const value = e.target.value;
    setUsername(value);
    if (touched.username) setValidationErrors(prev => ({ ...prev, username: validateUsernameField(value) }));
  };
  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);
    if (touched.password) setValidationErrors(prev => ({ ...prev, password: validatePasswordField(value) }));
  };
  const handleFieldBlur = (field) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    if (field === 'username') setValidationErrors(prev => ({ ...prev, username: validateUsernameField(username) }));
    else if (field === 'password') setValidationErrors(prev => ({ ...prev, password: validatePasswordField(password) }));
  };
  const handleFormSubmit = (e) => {
    e.preventDefault();
    setLoginError('');
    const usernameError = validateUsernameField(username);
    const passwordError = validatePasswordField(password);
    setTouched({ username: true, password: true });
    setValidationErrors({ username: usernameError, password: passwordError });
    if (usernameError || passwordError) return; // don't even hit the server with input that will just fail
    handleLogin(e);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);
    try {
      // This first fetch happens before sign-in, so the server only returns the public landing-page
      // content. It's kept for the fallback path below; the authenticated fetch happens after the
      // token arrives.
      let freshDb = await loadDB();
      const verified = await serverLogin(username.trim(), password);
      if (verified && !verified.ok) {
        setLoginError('Invalid username or password');
        setLoading(false);
        return;
      }
      let result;
      if (verified && verified.ok && verified.account) {
        setSessionToken(verified.token || '');
        setAuthToken(verified.token || ''); // so loadDB/saveDB are authenticated from here on
        // The fetch above happened before we had a token, so it only returned the public landing-page
        // content — no students, no accounts. Fetch again now that we're authenticated.
        const authedDb = await loadDB();
        const acc = (authedDb.accounts || []).find(a => a.user === verified.account.user && a.role === 'student') || verified.account;
        const rec = (authedDb.students || []).find(s => s.id === acc.ref);
        result = rec ? { account: acc, student: rec } : null;
        if (result) freshDb = authedDb; // everything downstream uses the authenticated copy
      } else {
        setSessionToken('');
        setAuthToken('');
        result = studentLogin(freshDb, username.trim(), password);
      }
      if (!result || !result.student) {
        setLoginError('Invalid username or password');
        setLoading(false);
        return;
      }
      setDb(freshDb);
      setAccount(result.account);
      const cleaned = expireStalePendingRewards(result.student);
      setStudent(cleaned);
      setIsLoggedIn(true);
      saveSession(username.trim()); // remember this login across refreshes, starts the 5-min idle clock
      if (cleaned !== result.student) persistStudent(cleaned, { silent: true }); // some pending reward(s) expired — save the cleanup
    } catch (err) {
      setLoginError(err?.message || 'Could not reach the server — check your connection and try again');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = useCallback(() => {
    setIsLoggedIn(false);
    setStudent(null);
    setAccount(null);
    setDb(null);
    setSessionToken(''); // the signed proof dies with the session
    setAuthToken('');
    setUsername('');
    setPassword('');
    setTouched({ username: false, password: false });
    setValidationErrors({ username: '', password: '' });
    setShowPassword(false);
    setShowMenu(false);
    setShowLoginForm(false);
    clearSession();
  }, []);

  // On first load, if there's a still-valid session (refresh within the last
  // 5 minutes of activity), silently re-fetch the student's data and log
  // them back in instead of showing the login screen again.
  useEffect(() => {
    const session = readSession();
    if (!isSessionValid(session)) {
      clearSession();
      setRestoring(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const freshDb = await loadDB();
        const acc = (freshDb.accounts || []).find(a => a.user === session.username && a.role === 'student');
        const studentRecord = acc ? (freshDb.students || []).find(s => s.id === acc.ref) : null;
        if (!cancelled && studentRecord) {
          setDb(freshDb);
          setAccount(acc);
          const cleaned = expireStalePendingRewards(studentRecord);
          setStudent(cleaned);
          setIsLoggedIn(true);
          touchSession(); // restoring counts as activity
          if (cleaned !== studentRecord) persistStudent(cleaned, { silent: true }); // some pending reward(s) expired — save the cleanup
        } else {
          clearSession();
        }
      } catch (err) {
        // couldn't reach the server on restore — just fall back to the login screen
        console.error('Session restoration failed:', err);
        clearSession();
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the birthday form's input in sync with whichever student is logged
  // in — fires on login, session restore, and after a successful save.
  useEffect(() => {
    setBirthdayInput(student?.birthday || '');
    setBirthdayError('');
    setBirthdaySuccess(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [student?.id, student?.birthday]);

  // ═══════════════════════════════════════════════════════════
  // ADD TO HOME SCREEN — shown once before the intro page, but only
  // if the app isn't already installed/running standalone.
  // ═══════════════════════════════════════════════════════════
  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches ||
      window.matchMedia('(display-mode: window-controls-overlay)').matches ||
      window.navigator.standalone === true; // iOS Safari's own flag
    const dismissed = localStorage.getItem('bdance_a2hs_dismissed') === '1';
    const ua = window.navigator.userAgent;
    const iOSDevice = /iphone|ipad|ipod/i.test(ua) && !window.MSStream;
    setIsIOS(iOSDevice);

    if (!isStandalone && !dismissed) {
      setShowInstallPrompt(true);
    }

    // Android/Chrome fires this when the browser is willing to install the PWA —
    // capture it so we can trigger the real install flow from our own button.
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredInstallEvent(e);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    // Fires once the PWA is actually installed (Android/Chrome) — stop asking for good.
    const onInstalled = () => {
      localStorage.setItem('bdance_a2hs_dismissed', '1');
      setShowInstallPrompt(false);
    };
    window.addEventListener('appinstalled', onInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismissInstallPrompt = () => {
    setShowInstallPrompt(false);
    localStorage.setItem('bdance_a2hs_dismissed', '1');
  };

  const triggerInstall = async () => {
    if (deferredInstallEvent) {
      deferredInstallEvent.prompt();
      await deferredInstallEvent.userChoice;
      setDeferredInstallEvent(null);
    }
    dismissInstallPrompt();
  };

  // Load public studio data (intro content, teachers, places) for the intro
  // page — this doesn't require login, same as the original app's public
  // landing page before the sign-in form.
  const [publicDb, setPublicDb] = useState(null);
  useEffect(() => {
    if (isLoggedIn || restoring) return; // once logged in we already have `db`; skip while session-restore is deciding
    let cancelled = false;
    (async () => {
      try {
        const freshDb = await loadDB();
        if (!cancelled) setPublicDb(freshDb);
      } catch (e) {
        // couldn't reach the server — fall back to defaults rather than
        // leaving the loading splash stuck forever
        if (!cancelled) setPublicDb({});
      }
    })();
    return () => { cancelled = true; };
  }, [isLoggedIn, restoring]);

  // Any tap/click/keypress/scroll while logged in resets the 5-minute idle clock.
  useEffect(() => {
    if (!isLoggedIn) return;
    const onActivity = () => touchSession();
    const events = ['click', 'keydown', 'touchstart', 'scroll'];
    events.forEach(evt => window.addEventListener(evt, onActivity, { passive: true }));
    return () => events.forEach(evt => window.removeEventListener(evt, onActivity));
  }, [isLoggedIn]);

  // ── Pull to refresh ────────────────────────────────────────────────
  // Dragging down from the very top re-fetches from the studio database, the way a native app does.
  // Refreshes whichever data this screen is showing: the signed-in student's record, or the public
  // intro content when signed out.
  const PULL_TRIGGER = 55;   // px of pull needed to fire the refresh (~78px of finger travel)
  const PULL_MAX = 110;      // px the indicator can travel, so a long drag doesn't stretch forever
  const [pullDist, setPullDist] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // Mirrors of the two values the gesture handler needs. They're refs, not state, so the listeners
  // below can be registered ONCE and never re-registered. Re-registering mid-gesture was a bug: it
  // rebuilt the handler with a fresh, empty closure while a finger was still down, orphaning the
  // code that clears the indicator and leaving the spinner stuck on screen.
  const refreshingRef = useRef(false);
  const refreshDataRef = useRef(null);

  const refreshData = useCallback(async () => {
    const freshDb = await loadDB();
    if (isLoggedIn && account) {
      setDb(freshDb);
      const rec = (freshDb.students || []).find(s => s.id === account.ref);
      if (rec) {
        const cleaned = expireStalePendingRewards(rec);
        setStudent(cleaned);
        if (cleaned !== rec) persistStudent(cleaned, { silent: true });
      }
      touchSession(); // a deliberate refresh counts as activity
    } else {
      setPublicDb(freshDb);
    }
  }, [isLoggedIn, account]);
  refreshDataRef.current = refreshData;

  useEffect(() => {
    let anchorY = null, lastY = null, dist = 0, active = false, shown = 0;
    const atTop = () => (window.scrollY || document.documentElement.scrollTop || 0) <= 0;
    const show = v => { if (v !== shown) { shown = v; setPullDist(v); } };

    // A pull can begin anywhere on the page. The swipe is tracked from wherever it starts, but the
    // pull itself only starts measuring once the page has actually reached the top and the finger
    // is still heading down — so one long drag from the middle scrolls up, then refreshes.
    const onStart = e => {
      active = !(e.touches.length !== 1 || refreshingRef.current);
      anchorY = null;
      lastY = active ? e.touches[0].clientY : null;
      dist = 0;
    };
    const onMove = e => {
      if (!active || lastY == null) return;
      const y = e.touches[0].clientY;
      const movingDown = y > lastY;
      lastY = y;
      // Not at the top yet, or the finger turned upward — ordinary scrolling. Reset, but keep
      // tracking so this same swipe can still become a pull when it does reach the top.
      if (!atTop() || !movingDown) {
        anchorY = null;
        if (dist) { dist = 0; show(0); }
        return;
      }
      if (anchorY == null) { anchorY = y; return; }   // first downward move at the top
      const dy = y - anchorY;
      if (dy <= 0) { dist = 0; show(0); return; }
      dist = Math.min(dy * 0.7, PULL_MAX);
      show(dist);
    };
    const onEnd = () => {
      if (!active) return;
      active = false; anchorY = null; lastY = null;
      const pulled = dist;
      dist = 0;
      if (pulled < PULL_TRIGGER || refreshingRef.current) { show(0); return; }

      refreshingRef.current = true;
      setRefreshing(true);
      show(PULL_TRIGGER); // hold the spinner in place while it loads
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        refreshingRef.current = false;
        setRefreshing(false);
        show(0);
      };
      // Whatever happens to the request — success, failure, or a promise that never settles because
      // the connection died mid-flight — the indicator comes back down. It can never stick.
      const guard = setTimeout(finish, 10000);
      Promise.resolve()
        .then(() => refreshDataRef.current && refreshDataRef.current())
        .catch(() => { /* offline — just drop back, no error wall */ })
        .then(() => { clearTimeout(guard); finish(); });
    };

    // All passive: the browser never has to wait on this handler before scrolling, which is what
    // made the whole app feel sluggish. The top bounce is suppressed by overscroll-behavior in CSS
    // instead of by blocking the event here.
    window.addEventListener('touchstart', onStart, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('touchend', onEnd);
    window.addEventListener('touchcancel', onEnd);
    return () => {
      window.removeEventListener('touchstart', onStart);
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onEnd);
      window.removeEventListener('touchcancel', onEnd);
    };
  }, []); // registered once — see refreshingRef / refreshDataRef above

  // Every 15s, check whether the idle window has been exceeded and log out if so.
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(() => {
      const session = readSession();
      if (!isSessionValid(session)) {
        handleLogout();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isLoggedIn, handleLogout]);

  const claimBirthday = async () => {
    if (!birthdayInfo || !birthdayInfo.isToday || !student) return;
    const y = new Date().getFullYear();
    if ((student.bdayClaims || []).includes(y)) return;
    await persistStudent({ ...student, bdayClaims: [...(student.bdayClaims || []), y] });
  };

  const genRewardCode = () => {
    const c = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 6; i++) s += c[Math.floor(Math.random() * c.length)];
    return s;
  };

  // Same fallback as the admin app's rewardName(): custom name first, then
  // the legacy translation key's English text, then the raw id as a last resort.
  const LEGACY_REWARD_NAMES = {
    'reward.water': 'Bottled Water', 'reward.drink': 'Drink Voucher', 'reward.sticker': 'Sticker Pack',
    'reward.wristband': 'Studio Wristband', 'reward.tote': 'Canvas Tote Bag', 'reward.freeclass': 'Free Single Class',
    'reward.tshirt': 'Studio T-Shirt', 'reward.monthfree': '1 Month Free (1 class)',
  };
  const rewardName = (r) => (r.name && String(r.name).trim()) ? r.name : (r.key ? (LEGACY_REWARD_NAMES[r.key] || r.key) : (r.id || ''));

  const redeemReward = async (reward) => {
    if (!student || spendablePoints < reward.cost) return;
    const code = genRewardCode();
    const updated = {
      ...student,
      redemptions: [
        { id: 'rd' + Date.now(), rewardId: reward.id, name: rewardName(reward), icon: reward.icon, cost: reward.cost, date: todayStr, code, collected: false },
        ...(student.redemptions || []),
      ],
    };
    const ok = await persistStudent(updated);
    if (ok) setRewardCodeModal({ reward, code }); // only reveal the code once it's actually saved
  };

  const inPayRange = (date) => !date ? true : (!payFrom || date >= payFrom) && (!payTo || date <= payTo);
  const filteredPayments = [...myPayments].filter(p => inPayRange(p.date)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const inAttRange = (date) => (!attFrom || date >= attFrom) && (!attTo || date <= attTo);

  // ═══════════════════════════════════════════════════════════
  // SESSION RESTORE SPLASH — shown briefly on first load while
  // checking for a still-valid saved session, so the login form
  // doesn't flash before an automatic re-login completes.
  // ═══════════════════════════════════════════════════════════
  if (restoring) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <img src="/logo.png" alt="B Dance Studio" className="w-16 h-16 object-contain animate-pulse" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // ADD TO HOME SCREEN MODAL — Android/Chrome gets a real native
  // install button (via the captured beforeinstallprompt event) plus
  // visual fallback steps; iOS Safari has no install API at all, so
  // it always gets the full illustrated share-sheet walkthrough.
  // ═══════════════════════════════════════════════════════════
  const InstallPromptModal = () => {
    const [platformTab, setPlatformTab] = useState(isIOS ? 'ios' : 'android');

    // Small inline icon mockups so the steps are recognizable without
    // needing real screenshots — same shapes/colors as each OS's UI chrome.
    const ShareIconIOS = () => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#0A84FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v13" /><path d="M8 6l4-4 4 4" /><path d="M5 10h-1a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1" />
      </svg>
    );
    const AddSquareIOS = () => (
      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="4" fill="#fff" stroke="#ccc" />
        <path d="M12 8v8M8 12h8" stroke="#111" />
      </svg>
    );
    const KebabAndroid = () => (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#3C4043">
        <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
      </svg>
    );

    const iosSteps = [
      { icon: <ShareIconIOS />, chrome: 'bg-[#F5F5F7]', title: 'Tap the Share button', desc: 'In Safari\'s bottom toolbar, tap the square-with-arrow Share icon.' },
      { icon: <span className="text-lg">📋</span>, chrome: 'bg-[#F5F5F7]', title: 'Scroll the share sheet', desc: 'Swipe down the list of options until you see "Add to Home Screen".' },
      { icon: <AddSquareIOS />, chrome: 'bg-[#F5F5F7]', title: '"Add to Home Screen"', desc: 'Tap it — B Dance Studio\'s icon and name are already filled in.' },
      { icon: <span className="text-lg">✅</span>, chrome: 'bg-[#F5F5F7]', title: 'Tap "Add"', desc: 'Confirm in the top-right corner — the icon now appears on your Home Screen.' },
    ];
    const androidSteps = [
      { icon: <KebabAndroid />, chrome: 'bg-[#F1F3F4]', title: 'Open the ⋮ menu', desc: 'In Chrome\'s top-right corner, tap the three-dot menu.' },
      { icon: <span className="text-lg">📲</span>, chrome: 'bg-[#F1F3F4]', title: '"Install app"', desc: 'Tap "Install app" (or "Add to Home screen" on some devices).' },
      { icon: <span className="text-lg">✅</span>, chrome: 'bg-[#F1F3F4]', title: 'Tap "Install"', desc: 'Confirm on the popup — B Dance Studio installs like a normal app.' },
    ];
    const steps = platformTab === 'ios' ? iosSteps : androidSteps;

    return (
      <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[200] p-4 overflow-y-auto">
        <div className="bg-zinc-900 border border-amber-700 rounded-lg p-5 max-w-sm w-full my-6">
          <div className="text-center mb-4">
            <img src="/logo.png" alt="B Dance Studio" className="w-12 h-12 mx-auto mb-2 object-contain" />
            <h3 className="text-white font-bold text-lg">Add to Home Screen</h3>
            <p className="text-gray-500 text-xs mt-1">Install B Dance Studio for quick, full-screen access — no app store needed.</p>
          </div>

          {/* Platform toggle */}
          <div className="bg-black border border-amber-900 rounded-full flex text-xs font-bold overflow-hidden mb-4">
            <button onClick={() => setPlatformTab('ios')} className={`flex-1 py-2 transition ${platformTab === 'ios' ? 'bg-amber-600 text-black' : 'text-gray-400'}`}>🍎 iPhone</button>
            <button onClick={() => setPlatformTab('android')} className={`flex-1 py-2 transition ${platformTab === 'android' ? 'bg-amber-600 text-black' : 'text-gray-400'}`}>🤖 Android</button>
          </div>

          {/* Real native install button, when the browser supports it */}
          {platformTab === 'android' && deferredInstallEvent && (
            <button onClick={triggerInstall} className="w-full bg-amber-600 text-black font-bold py-2.5 rounded text-sm mb-4">
              📲 Install Now (1-tap)
            </button>
          )}

          {/* Illustrated steps */}
          <div className="space-y-3 mb-5">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-3 bg-black border border-amber-900/40 rounded-lg p-3">
                <div className="w-8 h-8 rounded-full bg-amber-600 text-black font-bold text-sm flex items-center justify-center flex-shrink-0">{i + 1}</div>
                <div className={`w-11 h-11 rounded-lg ${s.chrome} flex items-center justify-center flex-shrink-0 border border-black/10`}>
                  {s.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-white font-semibold text-sm">{s.title}</p>
                  <p className="text-gray-500 text-[11px] leading-snug">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={dismissInstallPrompt} className="w-full border border-amber-700 text-amber-400 font-semibold py-2.5 rounded text-sm">
            Got it
          </button>
        </div>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // INTRO PAGE — the public landing page shown before sign-in,
  // mirrors the original app's site.* hero/about/event/instructors/
  // locations sections and DB.intro overrides, condensed for mobile.
  // ═══════════════════════════════════════════════════════════
  const INTRO_DEFAULTS = {
    eventBadge: 'Vol 6', eventTitle: 'K-Night Vol 6',
    eventLead: "Our biggest K-pop dance showcase yet — solo, battle, group cover and random play dance. Come compete, or come cheer your crew on.",
    eventDate: '📅 9 Aug 2026 · Sunday', eventTime: '🕛 12:00 PM – 8:00 PM', eventVenue: '📍 Sutera Mall · Level 4',
    eventCats: 'KPOP Solo, KPOP Battle, KPOP Group Cover, KPOP Randomz',
  };

  const IntroPage = () => {
    const t = TR[lang];
    const intro = { ...INTRO_DEFAULTS, ...(publicDb?.intro || {}) };
    const teachers = publicDb?.teachers || [];
    const places = publicDb?.places || [];
    const classes = publicDb?.classes || [];
    const styleCount = new Set(classes.map(c => c.style)).size;
    // Addresses come from the admin panel (Edit Intro Page → Locations). This list is only a
    // fallback for the original four branches if an address hasn't been filled in yet — a branch
    // added later has no entry here and correctly falls back to its own name.
    const neighborhoods = { 1: 'Adda Height, Kajang, Selangor', 2: 'Horizon Square, Johor Bahru, Johor', 3: 'Tasek, Ipoh, Perak', 4: 'Kulai, Johor' };
    const placeAddress = pl => (pl.address || '').trim() || neighborhoods[pl.id] || pl.name;
    const reel = getVideoEmbed(intro.reelUrl);
    const video = getVideoEmbed(intro.videoUrl);
    // Multi-event slider + collaborated shops — same data model as the desktop app.
    const events = getIntroEvents(intro);
    const shops = getIntroShops(intro);

    // Admin content overrides — same DB.intro flat keys (CONTENT_KEYS) the
    // desktop "Edit Intro Page" screen saves to. An admin edit shows up here
    // automatically; a blank field falls back to the built-in EN/中文 copy,
    // exactly like the desktop site's IV()/contentDefaults() behave.
    const CV = (key) => {
      const v = intro[key];
      return (v != null && String(v).trim() !== '') ? String(v).trim() : '';
    };
    const withFallback = (key, fallback) => CV(key) || fallback;
    // Two-line headings are stored as a single "line1\nline2" string, same as desktop.
    const splitTitle = (key, l1, l2) => {
      const v = CV(key);
      if (!v) return [l1, l2];
      const parts = v.split('\n');
      return [parts[0] || l1, parts[1] || ''];
    };

    const heroEyebrow = withFallback('heroEyebrow', t.heroEyebrow);
    const [heroLine1, heroLine2] = splitTitle('heroTitle', t.heroLine1, t.heroLine2);
    const heroLead = withFallback('heroLead', t.heroLead);
    const findBtn = withFallback('findBtn', t.findBtn);
    const meetBtn = withFallback('meetBtn', t.meetBtn);
    const aboutEyebrow = withFallback('aboutEyebrow', t.aboutEyebrow);
    const [aboutTitle1, aboutTitle2] = splitTitle('aboutTitle', t.aboutTitle1, t.aboutTitle2);
    const aboutLead = withFallback('aboutLead', t.aboutLead);
    const instrEyebrow = withFallback('instrEyebrow', t.instructorsEyebrow);
    const [instrTitle1, instrTitle2] = splitTitle('instrTitle', t.instrTitle1, t.instrTitle2);
    const instrLead = withFallback('instrLead', t.instrLead);
    const locEyebrow = withFallback('locEyebrow', t.locationsEyebrow);
    const [locTitle1, locTitle2] = splitTitle('locTitle', t.locTitle1, t.locTitle2);
    const locLead = withFallback('locLead', t.locLead);
    const ctaTitle = withFallback('ctaTitle', t.ctaTitle);
    const ctaLead = withFallback('ctaLead', t.ctaLead);

    // Google Translate — same setup as the desktop site: lazy-loaded only on the
    // intro page, only once per visit, and hidden entirely if it fails to load
    // (e.g. blocked in some regions) rather than showing a broken widget.
    useEffect(() => {
      if (window.__gtLoaded) return;
      window.__gtLoaded = true;
      window.googleTranslateElementInit = () => {
        try {
          // eslint-disable-next-line no-undef
          new window.google.translate.TranslateElement({
            pageLanguage: 'en',
            includedLanguages: 'en,zh-CN,zh-TW,ms,ta,id,th,vi,ja,ko,ar,hi,es,fr,de,pt,ru',
            layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
            autoDisplay: false,
          }, 'google_translate_element');
        } catch (e) {
          const w = document.getElementById('gt-wrap');
          if (w) w.style.display = 'none';
        }
      };
      const sc = document.createElement('script');
      sc.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
      sc.async = true;
      sc.onerror = () => {
        const w = document.getElementById('gt-wrap');
        if (w) w.style.display = 'none';
      };
      document.head.appendChild(sc);
    }, []);

    const VideoFrame = ({ embed }) => embed ? (
      <div className={`bg-black rounded-lg overflow-hidden mx-auto ${embed.portrait ? 'max-w-[280px]' : 'w-full'}`} style={{ aspectRatio: embed.portrait ? '9 / 16' : '16 / 9' }}>
        {embed.type === 'video'
          ? <video controls playsInline preload="metadata" src={embed.src} className="w-full h-full" />
          : <iframe src={embed.src} className="w-full h-full" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen title="video" />}
      </div>
    ) : null;

    // Auto-advance the event slider every 6s when there's more than one event. Any manual
    // move (swipe/dot/arrow) resets setEventSlide, and this restarts the 6s from there.
    useEffect(() => {
      if (events.length <= 1) return;
      const id = setInterval(() => setEventSlide(s => (s + 1) % events.length), 6000);
      return () => clearInterval(id);
    }, [events.length, eventSlide]);
    // Keep the index valid if the number of events changes (e.g. admin edits mid-view).
    useEffect(() => {
      if (eventSlide > events.length - 1) setEventSlide(0);
    }, [events.length]);
    const goEvent = (i) => { const n = events.length; if (n) setEventSlide(((i % n) + n) % n); };
    const touchStartX = useRef(null);
    const onEvTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
    const onEvTouchEnd = (e) => {
      if (touchStartX.current == null) return;
      const dx = e.changedTouches[0].clientX - touchStartX.current;
      touchStartX.current = null;
      if (Math.abs(dx) > 40) goEvent(eventSlide + (dx < 0 ? 1 : -1));
    };

    return (
      <div className="min-h-screen bg-black text-white w-full relative">
        <PullIndicator dist={pullDist} refreshing={refreshing} trigger={PULL_TRIGGER} />
        <BackToTop />
        {/* Top bar: language toggle + login button */}
        <div className="flex justify-between items-center px-5 pt-4 gap-2">
          <button onClick={() => setShowLoginForm(true)} className="bg-amber-600 text-black font-mono text-[11px] font-semibold uppercase tracking-[0.1em] px-4 py-2 rounded-lg">
            {t.login}
          </button>
          <div className="bg-zinc-900 border border-amber-900 rounded-lg flex text-xs font-bold overflow-hidden">
            <button onClick={() => setLang('en')} className={`px-3 py-1.5 transition ${lang === 'en' ? 'bg-amber-600 text-black' : 'text-gray-400'}`}>EN</button>
            <button onClick={() => setLang('zh')} className={`px-3 py-1.5 transition ${lang === 'zh' ? 'bg-amber-600 text-black' : 'text-gray-400'}`}>中文</button>
          </div>
        </div>

        {/* Hero */}
        <div className="relative overflow-hidden px-5 pt-6 pb-8">
          {/* Was a soft orange gradient bloom — the stock dark-app move, and the same one removed
              from the desktop hero. Replaced with a hard raked band: light across a floor. */}
          <div aria-hidden="true" className="pointer-events-none absolute -top-1/4 -right-16 h-[150%] w-2/3 -skew-x-12 bg-gradient-to-bl from-amber-500/[0.14] via-ember/[0.06] to-transparent" />
          <div className="relative">
            <img src="/logo.png" alt="B Dance Studio" className="w-12 h-12 mb-5 object-contain" />
            <p className="font-mono text-amber-500 text-[10.5px] font-semibold uppercase tracking-[0.2em] mb-3">{heroEyebrow}</p>
            <div aria-hidden="true" className="font-mono text-[11px] tracking-[0.28em] text-gray-600 mb-3.5 flex items-center gap-2.5">
              <b className="text-amber-500 font-semibold ct ct-1">5</b>
              <b className="text-amber-500 font-semibold ct ct-2">6</b>
              <b className="text-amber-500 font-semibold ct ct-3">7</b>
              <b className="text-amber-500 font-semibold ct ct-4">8</b>
              <i className="not-italic text-[9px] tracking-[0.16em] ct ct-5">FROM THE TOP</i>
            </div>
            <h1 className="font-display uppercase leading-[0.84] tracking-[-0.5px] mb-4 ct-land text-[clamp(38px,11.5vw,58px)]">{heroLine1}<br /><span className="text-amber-500">{heroLine2}</span></h1>
            <p className="text-gray-400 text-sm leading-relaxed mb-6 ct-land-2">{heroLead}</p>

          <div className="flex gap-2 mb-6">
            <button onClick={() => document.getElementById('intro-locations')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex-1 bg-amber-600 text-ink font-mono text-[11px] font-semibold uppercase tracking-[0.12em] py-3 rounded-lg active:translate-x-px active:translate-y-px transition-transform">
              {findBtn}
            </button>
            <button onClick={() => document.getElementById('intro-instructors')?.scrollIntoView({ behavior: 'smooth' })}
              className="flex-1 border border-amber-700 text-amber-400 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] py-3 rounded-lg active:translate-x-px active:translate-y-px transition-transform">
              {meetBtn}
            </button>
          </div>

          {/* Studio reel — shown near the top, same placement as the original site */}
          {reel && (
            <div className="mb-6">
              <VideoFrame embed={reel} />
            </div>
          )}

          {/* A run-sheet strip rather than four little cards: hairline dividers, display numerals,
              mono labels — the same device as the stat strip on the desktop site. */}
          <div className="grid grid-cols-4 border-y border-amber-900 mb-6">
            {[[places.length || 4, t.statFranchises], [styleCount || 8, t.statStyles], [teachers.length || 6, t.statInstructors], [2026, t.statFounded]].map(([val, label], i) => (
              <div key={i} className={`py-3 text-center ${i < 3 ? 'border-r border-amber-900' : ''}`}>
                <p className="font-display text-amber-500 text-3xl leading-none">{val}</p>
                <p className="font-mono text-gray-500 text-[8.5px] uppercase tracking-[0.1em] mt-1.5">{label}</p>
              </div>
            ))}
          </div>
          </div>
        </div>

        {/* Upcoming Events — auto-sliding when there's more than one, with swipe + dots */}
        <div className="px-5 py-8 border-t border-amber-900/30">
          <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-3">{events.length > 1 ? t.eventsTitle : t.eventEyebrow}</p>
          <div className="overflow-hidden rounded-lg" onTouchStart={onEvTouchStart} onTouchEnd={onEvTouchEnd}>
            <div className="flex transition-transform duration-500 ease-out" style={{ transform: `translateX(-${eventSlide * 100}%)` }}>
              {events.map((ev, idx) => {
                const evCats = (ev.cats || '').split(',').map(c => c.trim()).filter(Boolean);
                const regUrl = normalizeSocialLink(ev.regUrl || '', 'link');
                const evLead = (ev.lead && ev.lead.length) ? ev.lead : (events.length === 1 ? t.eventLead : '');
                return (
                  <div key={idx} className="flex-shrink-0 w-full" style={{ minWidth: '100%' }}>
                    <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mx-0.5">
                      <div className="relative mb-4 -mt-1">
                        <img src={ev.poster || '/default-event-poster.jpg'} alt={`${ev.title || 'Event'} — event poster`} className="w-full rounded-lg border border-amber-900/50 shadow-lg" />
                        {ev.badge && <span className="absolute top-2 left-2 bg-amber-600 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{ev.badge}</span>}
                      </div>
                      {ev.title && <h2 className="text-white font-bold text-lg mb-2">{ev.title}</h2>}
                      {evLead && <p className="text-gray-400 text-sm leading-relaxed mb-3">{evLead}</p>}
                      <div className="space-y-1 text-sm text-gray-300 mb-3">
                        {ev.date && <p>{ev.date}</p>}
                        {ev.time && <p>{ev.time}</p>}
                        {ev.venue && <p>{ev.venue}</p>}
                      </div>
                      {evCats.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-4">
                          {evCats.map((c, i) => (
                            <span key={i} className="bg-black border border-amber-900 text-amber-400 text-[10px] font-semibold px-2 py-1 rounded-full">{c}</span>
                          ))}
                        </div>
                      )}
                      {regUrl ? (
                        <a href={regUrl} target="_blank" rel="noopener noreferrer"
                          className="block w-full text-center bg-amber-600 text-black font-bold py-2.5 rounded transition text-sm">
                          {t.eventBtnLink}
                        </a>
                      ) : (
                        <button onClick={() => setShowLoginForm(true)} className="w-full bg-amber-600 text-black font-bold py-2.5 rounded transition text-sm">
                          {t.eventBtn}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          {events.length > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              {events.map((_, i) => (
                <button key={i} onClick={() => goEvent(i)} aria-label={`Event ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${i === eventSlide ? 'w-6 bg-amber-500' : 'w-2 bg-gray-600'}`} />
              ))}
            </div>
          )}
        </div>

        {/* Collaborated Shops — a line of 500x500 icons; tap one for the shop's details + 10% discount */}
        {shops.length > 0 && (
          <div className="px-5 py-8 border-t border-amber-900/30">
            <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-2">{t.shopsEyebrow}</p>
            <h2 className="text-xl font-bold mb-3">{t.shopsTitle}</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-5">{t.shopsLead}</p>
            {shops.length >= SHOP_MARQUEE_MIN ? (
              <ShopMarquee shops={shops} discountLabel={t.shopDiscountShort} onOpen={setShopModal} />
            ) : (
              <div className="flex flex-wrap gap-4 justify-center">
                {shops.map((sh, i) => (
                  <button key={i} onClick={() => setShopModal(sh)} className="flex flex-col items-center gap-2 w-24 active:scale-95 transition">
                    {sh.photo
                      ? <div className="w-20 h-20 rounded-2xl bg-cover bg-center border border-amber-900/50 shadow-lg" style={{ backgroundImage: `url('${String(sh.photo).replace(/'/g, "%27")}')` }} />
                      : <div className="w-20 h-20 rounded-2xl bg-amber-900 flex items-center justify-center font-bold text-white text-xl shadow-lg">{(sh.name || '?').slice(0, 1)}</div>}
                    <span className="text-white text-xs font-semibold text-center leading-tight">{sh.name}</span>
                    <span className="text-amber-500 text-[9px] font-bold uppercase tracking-wide">{t.shopDiscountShort}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* About */}
        <div className="px-5 py-8 border-t border-amber-900/30">
          <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-2">{aboutEyebrow}</p>
          <h2 className="text-xl font-bold mb-3">{aboutTitle1}<br />{aboutTitle2}</h2>
          <p className="text-gray-400 text-sm leading-relaxed">{aboutLead}</p>
        </div>

        {/* Instructors — tappable, opens a modal like the original site */}
        {teachers.length > 0 && (
          <div id="intro-instructors" className="px-5 py-8 border-t border-amber-900/30">
            <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-2">{instrEyebrow}</p>
            <h2 className="text-xl font-bold mb-3">{instrTitle1}<br />{instrTitle2}</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{instrLead}</p>
            <div className="space-y-3">
              {(showAllTeachers ? teachers : teachers.slice(0, TEACHER_PREVIEW)).map(tch => {
                const hasSocial = (tch.instagram && tch.instagram.trim()) || (tch.xiaohongshu && tch.xiaohongshu.trim());
                return (
                  <button key={tch.id} onClick={() => { setTeacherModal(tch.id); setTeacherSlide(0); }} className="w-full text-left bg-zinc-900 border border-amber-900 rounded-lg p-3 flex items-center gap-3 active:bg-zinc-800 transition">
                    {tch.photo
                      ? <div className="w-14 h-14 rounded-full bg-cover bg-center flex-shrink-0" style={{ backgroundImage: `url('${tch.photo}')` }} />
                      : <div className="w-14 h-14 rounded-full bg-amber-900 flex items-center justify-center font-bold text-white flex-shrink-0">{(tch.name || '?').slice(0, 1)}</div>}
                    <div className="flex-1">
                      <p className="text-white font-bold text-sm">{tch.name}</p>
                      <p className="text-gray-500 text-xs mt-0.5">{(tch.specs || []).join(', ')}</p>
                      {hasSocial && <p className="text-amber-500 text-[10px] mt-1">{(tch.instagram ? '📸' : '')}{(tch.xiaohongshu ? ' 📕' : '')} {t.tapToConnect}</p>}
                    </div>
                    <span className="text-amber-600">→</span>
                  </button>
                );
              })}
            </div>
            {teachers.length > TEACHER_PREVIEW && (
              <button
                onClick={() => {
                  const collapsing = showAllTeachers;
                  setShowAllTeachers(!showAllTeachers);
                  // folding back up: return to the top of the section so the page doesn't strand you
                  if (collapsing) {
                    const sec = document.getElementById('intro-instructors');
                    if (sec && sec.scrollIntoView) sec.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="w-full mt-4 border border-amber-700 text-amber-400 font-semibold py-2.5 rounded text-sm active:bg-zinc-800 transition"
              >
                {showAllTeachers ? t.showLessTeachers : t.showAllTeachers.replace('{n}', teachers.length)}
              </button>
            )}
          </div>
        )}

        {/* Locations — tap a card to get directions via Waze or Google Maps */}
        {places.length > 0 && (
          <div id="intro-locations" className="px-5 py-8 border-t border-amber-900/30">
            <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-2">{locEyebrow}</p>
            <h2 className="text-xl font-bold mb-3">{locTitle1}<br />{locTitle2}</h2>
            <p className="text-gray-400 text-sm leading-relaxed mb-4">{locLead}</p>
            <div className="space-y-3">
              {places.map(pl => {
                const address = placeAddress(pl);
                return (
                  <button key={pl.id} onClick={() => setDirectionsModal({ name: pl.name, query: address })}
                    className="w-full text-left bg-zinc-900 border border-amber-900 rounded-lg p-3 flex items-center gap-3 active:bg-zinc-800 transition">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-bold text-sm">🏢 {pl.name}</p>
                      <p className="text-gray-500 text-xs mt-1 break-words">{address}</p>
                      <p className="text-amber-500 text-[10px] mt-1">📍 {t.getDirections}</p>
                    </div>
                    <span className="text-amber-600 flex-shrink-0">→</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Highlight Video */}
        {video && (
          <div className="px-5 py-8 border-t border-amber-900/30">
            <p className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-1">{intro.videoEyebrow || t.watch}</p>
            <h2 className="text-white font-bold text-lg mb-3">{intro.videoTitle || t.seeUsMove}</h2>
            <VideoFrame embed={video} />
          </div>
        )}

        {/* Final CTA — matches desktop: this button opens a "Contact Us" branch picker,
            not the sign-in form. Staff/student sign-in lives in the hero button up top. */}
        <div className="px-5 py-10 border-t border-amber-900/30 text-center">
          <h2 className="text-xl font-bold mb-2">{ctaTitle}</h2>
          <p className="text-gray-400 text-sm mb-5">{ctaLead}</p>
          <button onClick={() => setBranchLinksModal(t.contactTitle)} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 text-black font-bold py-3 rounded-lg shadow-lg">
            {t.contactBtn}
          </button>
        </div>

        {/* Footer — admin-editable contact details from db.intro.footer (tagline,
            address, hours, phone, whatsapp, email, socials, copyright). Any field
            left blank in the admin app is simply omitted here, same as the original site. */}
        {(() => {
          const footer = publicDb?.intro?.footer || {};
          const tagline = (footer.tagline || '').trim();
          const address = (footer.address || '').trim();
          const hours = (footer.hours || '').trim();
          const phone = (footer.phone || '').trim();
          const whatsapp = (footer.whatsapp || '').trim();
          const email = (footer.email || '').trim();
          const copyright = (footer.copyright || '').trim() || '© 2026 B Dance Studio · Adda Height · Horizon Square · Tasek · Kulai';
          const social = footerSocialLinks(footer);
          const hasContact = phone || whatsapp || email;
          const hasVisit = address || hours;

          return (
            <div className="px-5 py-8 border-t border-amber-900/30 bg-zinc-950">
              <div className="space-y-6">
                <div>
                  <h5 className="text-white font-bold text-sm mb-2">B Dance Studio</h5>
                  {tagline && <p className="text-gray-500 text-xs leading-relaxed whitespace-pre-line">{tagline}</p>}
                  {social.length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3">
                      {social.map(s => (
                        <a key={s.k} href={s.url} target="_blank" rel="noopener noreferrer" className="text-amber-500 text-xs font-semibold">
                          {s.icon} {s.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {hasContact && (
                  <div>
                    <h5 className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-2">Contact</h5>
                    <div className="space-y-1.5 text-sm">
                      {phone && <a href={`tel:${footerDigitsOnly(phone)}`} className="flex items-center gap-2 text-gray-300">📞 {phone}</a>}
                      {whatsapp && <a href={footerWaLink(whatsapp)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-gray-300">💬 WhatsApp · {whatsapp}</a>}
                      {email && <a href={`mailto:${email}`} className="flex items-center gap-2 text-gray-300 break-all">✉️ {email}</a>}
                    </div>
                  </div>
                )}

                {hasVisit && (
                  <div>
                    <h5 className="text-amber-500 text-[11px] font-bold uppercase tracking-widest mb-2">Visit</h5>
                    <div className="space-y-1.5 text-sm">
                      {address && (
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer" className="flex items-start gap-2 text-gray-300">
                          <span>📍</span><span className="whitespace-pre-line">{address}</span>
                        </a>
                      )}
                      {hours && <p className="flex items-start gap-2 text-gray-300"><span>🕒</span><span className="whitespace-pre-line">{hours}</span></p>}
                    </div>
                  </div>
                )}
              </div>

              <p className="text-gray-600 text-[10px] text-center mt-8">{copyright}</p>
              {classes.length > 0 && (
                <p className="text-gray-700 text-[10px] text-center mt-2">
                  {[...new Set(classes.map(c => c.style))].join(' · ')}
                </p>
              )}
            </div>
          );
        })()}

        {/* Teacher modal — photo/video/quote carousel, matching the desktop site's slideshow */}
        {teacherModal != null && (() => {
          // Re-look-up the teacher from the live `teachers` array every render (by id) instead of
          // trusting a snapshot taken at tap-time — otherwise a refresh (pull-to-refresh, or new
          // data loading) while the modal is open wouldn't be reflected until it was closed/reopened.
          const teacherData = teachers.find(tc => tc.id === teacherModal);
          if (!teacherData) return null; // teacher was removed in a refresh while the modal was open

          const ig = normalizeSocialLink(teacherData.instagram, 'instagram');
          const xhs = normalizeSocialLink(teacherData.xiaohongshu, 'xiaohongshu');
          const teacherVideo = teacherData.video && teacherData.video.trim() ? getVideoEmbed(teacherData.video) : null;
          const hasQuote = teacherData.quote && teacherData.quote.trim();

          const slides = [{ type: 'photo' }];
          if (hasQuote) slides.push({ type: 'quote' });
          if (teacherVideo) slides.push({ type: 'video' });
          const idx = Math.min(teacherSlide, slides.length - 1);

          const goPrev = () => setTeacherSlide(i => (i - 1 + slides.length) % slides.length);
          const goNext = () => setTeacherSlide(i => (i + 1) % slides.length);

          return (
            <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6" onClick={() => { setTeacherModal(null); setTeacherSlide(0); }}>
              <div className="bg-zinc-900 border border-amber-700 rounded-lg p-6 max-w-xs w-full text-center" onClick={e => e.stopPropagation()}>

                {/* Carousel */}
                <div className="relative mb-3">
                  <div className="w-full aspect-square rounded-xl overflow-hidden bg-black flex items-center justify-center">
                    {slides[idx].type === 'photo' && (
                      teacherData.photo
                        ? <div className="w-full h-full bg-cover bg-center" style={{ backgroundImage: `url('${teacherData.photo}')` }} />
                        : <div className="w-full h-full flex items-center justify-center bg-amber-900 text-white font-bold text-4xl">{(teacherData.name || '?').slice(0, 1)}</div>
                    )}
                    {slides[idx].type === 'video' && teacherVideo && (
                      teacherVideo.type === 'video'
                        ? <video controls playsInline preload="metadata" src={teacherVideo.src} className="w-full h-full object-contain" />
                        : <iframe src={teacherVideo.src} className="w-full h-full" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowFullScreen title="teacher video" />
                    )}
                    {slides[idx].type === 'quote' && (
                      <div className="p-5 flex flex-col items-center justify-center h-full">
                        <div className="text-amber-500 text-4xl leading-none mb-2">"</div>
                        <p className="text-white text-sm italic leading-relaxed whitespace-pre-line">{teacherData.quote}</p>
                        <p className="text-amber-500 text-xs font-semibold mt-3">— {teacherData.name}</p>
                      </div>
                    )}
                  </div>

                  {slides.length > 1 && (
                    <>
                      <button onClick={goPrev} aria-label="Previous" className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg">‹</button>
                      <button onClick={goNext} aria-label="Next" className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white w-8 h-8 rounded-full flex items-center justify-center text-lg">›</button>
                      <div className="flex justify-center gap-1.5 mt-2">
                        {slides.map((s, i) => (
                          <button key={i} onClick={() => setTeacherSlide(i)} aria-label={s.type} className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-amber-500' : 'bg-gray-700'}`} />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                <h3 className="text-white font-bold text-lg mb-1">{teacherData.name}</h3>
                <p className="text-gray-500 text-xs mb-4">{(teacherData.specs || []).join(', ')}</p>
                {ig && (
                  <a href={ig} target="_blank" rel="noopener noreferrer" className="block bg-amber-600 text-black font-bold py-2.5 rounded mb-2 text-sm">📸 {t.openInstagram}</a>
                )}
                {xhs && (
                  <a href={xhs} target="_blank" rel="noopener noreferrer" className="block text-white font-bold py-2.5 rounded mb-2 text-sm" style={{ backgroundColor: '#ff2442' }}>📕 {t.openXiaohongshu}</a>
                )}
                {!ig && !xhs && (
                  <p className="text-gray-500 text-xs mb-4">{t.socialNone}</p>
                )}
                <button onClick={() => { setTeacherModal(null); setTeacherSlide(0); }} className="w-full border border-amber-700 text-amber-400 font-semibold py-2 rounded mt-2 text-sm">{t.close}</button>
              </div>
            </div>
          );
        })()}

        {/* Directions chooser modal — tapping a location opens this to pick Waze or Google Maps */}
        {directionsModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6" onClick={() => setDirectionsModal(null)}>
            <div className="bg-zinc-900 border border-amber-700 rounded-lg p-6 max-w-xs w-full text-center" onClick={e => e.stopPropagation()}>
              <div className="text-3xl mb-2">📍</div>
              <h3 className="text-white font-bold text-lg mb-1">{directionsModal.name}</h3>
              <p className="text-gray-500 text-xs mb-5">{t.chooseNavApp}</p>
              {(() => {
                const links = getDirectionLinks(directionsModal.query);
                return (
                  <>
                    <a href={links.waze} className="block bg-amber-600 text-black font-bold py-2.5 rounded mb-2 text-sm">🚗 {t.openWaze}</a>
                    <a href={links.google} target="_blank" rel="noopener noreferrer" className="block bg-white text-black font-bold py-2.5 rounded mb-2 text-sm">🗺️ {t.openGoogleMaps}</a>
                  </>
                );
              })()}
              <button onClick={() => setDirectionsModal(null)} className="w-full border border-amber-700 text-amber-400 font-semibold py-2 rounded mt-2 text-sm">{t.close}</button>
            </div>
          </div>
        )}

        {/* Collaborated shop details — opened by tapping a shop icon. Shows the shop's photo,
            name, the 10% student discount, its item list, and an optional "Visit shop" link. */}
        {shopModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6" onClick={() => setShopModal(null)}>
            <div className="bg-zinc-900 border border-amber-700 rounded-lg p-6 max-w-xs w-full text-center max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
              {shopModal.photo
                ? <div className="w-28 h-28 rounded-2xl bg-cover bg-center border border-amber-900/50 mx-auto mb-3" style={{ backgroundImage: `url('${String(shopModal.photo).replace(/'/g, "%27")}')` }} />
                : <div className="w-28 h-28 rounded-2xl bg-amber-900 flex items-center justify-center font-bold text-white text-3xl mx-auto mb-3">{(shopModal.name || '?').slice(0, 1)}</div>}
              <h3 className="text-white font-bold text-lg mb-1">{shopModal.name}</h3>
              <div className="inline-block bg-amber-600 text-black text-xs font-bold px-3 py-1 rounded-full mb-4">🎉 {t.shopDiscount}</div>
              {(() => {
                const items = String(shopModal.items || '').split('\n').map(x => x.trim()).filter(Boolean);
                return (
                  <div className="text-left mb-4">
                    <p className="text-amber-500 text-[11px] font-bold uppercase tracking-wide mb-2">{t.shopOffers}</p>
                    {items.length > 0 ? (
                      <ul className="space-y-2">
                        {items.map((it, i) => (
                          <li key={i} className="flex items-center gap-2 border border-amber-900/50 rounded-lg px-3 py-2 text-sm text-gray-200">🛍️ {it}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-gray-500 text-sm">{t.shopNoItems}</p>
                    )}
                  </div>
                );
              })()}
              {(() => {
                const url = normalizeSocialLink(shopModal.url || '', 'link');
                return url ? (
                  <a href={url} target="_blank" rel="noopener noreferrer" className="block w-full text-center bg-amber-600 text-black font-bold py-2.5 rounded mb-2 text-sm">{t.shopVisit}</a>
                ) : null;
              })()}
              <button onClick={() => setShopModal(null)} className="w-full border border-amber-700 text-amber-400 font-semibold py-2 rounded mt-1 text-sm">{t.close}</button>
            </div>
          </div>
        )}

        {/* Contact Us branch picker — opened by the closing CTA. Each branch opens its own
            link if the admin set one (e.g. WhatsApp, booking page); otherwise falls back to
            a Google Maps search of that branch's address. Matches desktop's openBranchLinksModal(). */}
        {branchLinksModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6" onClick={() => setBranchLinksModal(null)}>
            <div className="bg-zinc-900 border border-amber-700 rounded-lg p-6 max-w-xs w-full" onClick={e => e.stopPropagation()}>
              <h3 className="text-white font-bold text-lg mb-4 text-center">🏢 {branchLinksModal}</h3>
              <div className="space-y-2">
                {places.length === 0 && <p className="text-gray-500 text-sm text-center">—</p>}
                {places.map(pl => {
                  const address = placeAddress(pl);
                  const link = (pl.introLink && pl.introLink.trim())
                    ? pl.introLink.trim()
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
                  return (
                    <a key={pl.id} href={link} target="_blank" rel="noopener noreferrer" onClick={() => setBranchLinksModal(null)}
                      className="w-full flex items-center justify-between border border-amber-800 text-white rounded-lg px-3 py-2.5 text-sm active:bg-zinc-800 transition">
                      <span>🏢 {pl.name}</span>
                      <span className="text-amber-600">→</span>
                    </a>
                  );
                })}
              </div>
              <button onClick={() => setBranchLinksModal(null)} className="w-full border border-amber-700 text-amber-400 font-semibold py-2 rounded mt-4 text-sm">{t.close}</button>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // INTRO DATA LOADING SPLASH — shown briefly while the public studio data
  // (event, teachers, locations, intro content) is being fetched from the
  // shared database, so the intro page doesn't flash with empty/default
  // placeholders before the real content arrives.
  // ═══════════════════════════════════════════════════════════
  if (!isLoggedIn && !showLoginForm && !publicDb) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="B Dance Studio" className="w-16 h-16 object-contain animate-pulse" />
          <div className="w-6 h-6 border-2 border-amber-600/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // LOGIN SCREEN
  // ═══════════════════════════════════════════════════════════
  if (!isLoggedIn && !showLoginForm) {
    return (
      <>
        <IntroPage />
        {showInstallPrompt && <InstallPromptModal />}
      </>
    );
  }
  if (!isLoggedIn) {
    const t = TR[lang];
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-950/20 via-black to-black"></div>
        <div className="relative z-10 w-full max-w-sm">
          <button onClick={() => setShowLoginForm(false)} className="text-gray-500 text-xs mb-6 hover:text-amber-400 transition">← {t.back}</button>
          <div className="text-center mb-12">
            <img src="/logo.png" alt="B Dance Studio" className="w-24 h-24 mx-auto mb-4 object-contain" />
            <h1 className="text-3xl font-bold tracking-wider mb-2">B DANCE STUDIO</h1>
            <p className="text-gray-400 text-sm uppercase tracking-[2px]">Student Portal</p>
          </div>
          <form onSubmit={handleFormSubmit} className="bg-zinc-900 border border-amber-900 rounded-lg p-8 shadow-2xl">
            <h2 className="text-xl font-semibold mb-6">{t.login}</h2>
            {loginError && (
              <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs rounded p-3 mb-4" role="alert">{loginError}</div>
            )}
            <div className="mb-3">
              <input type="text" placeholder={t.username} value={username} onChange={handleUsernameChange} onBlur={() => handleFieldBlur('username')}
                disabled={loading} autoComplete="username"
                aria-invalid={touched.username && !!validationErrors.username}
                aria-describedby={touched.username && validationErrors.username ? 'username-error' : undefined}
                className={`w-full bg-black border rounded px-4 py-3 text-white text-sm outline-none transition disabled:opacity-50 ${
                  touched.username && validationErrors.username ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-amber-500'
                }`} />
              {touched.username && validationErrors.username && (
                <p id="username-error" className="text-red-400 text-xs mt-1">{validationErrors.username}</p>
              )}
            </div>
            <div className="mb-6">
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} placeholder={t.password} value={password} onChange={handlePasswordChange} onBlur={() => handleFieldBlur('password')}
                  disabled={loading} autoComplete="current-password"
                  aria-invalid={touched.password && !!validationErrors.password}
                  aria-describedby={touched.password && validationErrors.password ? 'password-error' : undefined}
                  className={`w-full bg-black border rounded px-4 py-3 pr-11 text-white text-sm outline-none transition disabled:opacity-50 ${
                    touched.password && validationErrors.password ? 'border-red-500 focus:border-red-500' : 'border-gray-700 focus:border-amber-500'
                  }`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-amber-400 text-sm transition">
                  {showPassword ? '🙈' : '👁️'}
                </button>
              </div>
              {touched.password && validationErrors.password && (
                <p id="password-error" className="text-red-400 text-xs mt-1">{validationErrors.password}</p>
              )}
            </div>
            <button type="submit" disabled={loading || !!validationErrors.username || !!validationErrors.password} className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-black font-bold py-3 rounded transition shadow-lg disabled:opacity-60">
              {loading ? t.loggingIn : 'LOGIN'}
            </button>
          </form>
        </div>
        {showInstallPrompt && <InstallPromptModal />}

        {/* Full-screen loading overlay while the login request is in flight */}
        {loading && (
          <div className="fixed inset-0 bg-black flex items-center justify-center z-[300]">
            <div className="text-center">
              <img src="/logo.png" alt="B Dance Studio" className="w-20 h-20 mx-auto mb-4 object-contain animate-pulse" />
              <div className="flex justify-center gap-1.5 mb-3">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
              <p className="text-gray-400 text-sm">{t.loggingIn}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════
  // DASHBOARD — mirrors renderStudentDashboard()
  // ═══════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════
  // MY CLASSES — mirrors renderStudentClasses(): own profile summary,
  // enrolled classes with full details, and a classmates roster per class.
  // ═══════════════════════════════════════════════════════════
  const MyClassesPage = () => (
    <div className="pb-24">
      <div className="bg-zinc-900 border-l-4 rounded-lg p-4 mb-4 flex items-center gap-3" style={{ borderLeftColor: hasAnyGrade ? gradeMeta(gradeOf).c1 : '#3f3f46' }}>
        <div className="text-3xl">🎓</div>
        <div className="flex-1">
          <p className="text-white font-bold text-sm">My Classes</p>
          <p className="text-gray-500 text-xs mt-0.5">Enrolled since {student.join || '—'} · {myClasses.length} {myClasses.length === 1 ? 'class' : 'classes'} this week</p>
        </div>
        <div className="text-2xl">{hasAnyGrade ? gradeMeta(gradeOf).badge : '👶'}</div>
      </div>

      {/* My Profile summary */}
      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4">
        <p className="text-white font-bold text-sm mb-3">My Profile</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p><span className="text-gray-500">Age:</span> <span className="text-gray-200">{student.age ?? '—'}</span></p>
          <p><span className="text-gray-500">Parent:</span> <span className="text-gray-200">{student.parent || '—'}</span></p>
          <p><span className="text-gray-500">Phone:</span> <span className="text-gray-200">{student.phone || '—'}</span></p>
          <p className="break-all"><span className="text-gray-500">Email:</span> <span className="text-gray-200">{student.email || '—'}</span></p>
        </div>
      </div>

      <p className="text-gray-500 text-[11px] mb-4">💡 To change your class enrollment, please speak to the studio admin or front desk.</p>

      {myClasses.length === 0 ? (
        <p className="text-gray-500 text-center py-8">Not enrolled in any class yet.</p>
      ) : (
        myClasses.map(cls => {
          const teacherName = (db.teachers || []).find(tc => tc.id === cls.teacherId)?.name || '—';
          const placeName = (db.places || []).find(pl => pl.id === cls.placeId)?.name || '';
          const mates = classmatesFor(cls.id);
          return (
            <div key={cls.id} className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-start gap-2 mb-1">
                <p className="text-amber-400 font-bold text-lg">{cls.name}</p>
                <span className="bg-black border border-amber-900 text-amber-400 text-[10px] font-semibold px-2 py-1 rounded-full whitespace-nowrap">{cls.style}</span>
              </div>
              <p className="text-gray-500 text-xs mb-1">📅 {cls.day} · {cls.start}–{cls.end}</p>
              <p className="text-gray-500 text-xs mb-1">📍 {cls.room}{placeName ? ` · 🏢 ${placeName}` : ''}</p>
              <p className="text-gray-500 text-xs mb-3">👩‍🏫 <span className="text-amber-400 font-semibold">{teacherName}</span></p>

              <p className="text-white font-semibold text-sm mb-2">Classmates ({mates.length})</p>
              {mates.length === 0 ? (
                <p className="text-gray-500 text-xs">No other students in this class yet.</p>
              ) : (
                <div className="space-y-1.5">
                  {mates.map(m => (
                    <div key={m.id} className="flex justify-between items-center text-xs py-1 border-t border-amber-900/30">
                      <span className="flex items-center gap-2 text-gray-300">
                        <span className="w-6 h-6 rounded-full bg-amber-900 flex items-center justify-center text-[10px] font-bold text-white">{(m.name || '?').slice(0, 1)}</span>
                        {m.name}
                      </span>
                      <span className="text-gray-500">Age {m.age ?? '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // ALL CLASSES — mirrors renderAllClasses(): browse every class studio-wide,
  // filterable by franchise/branch, teacher, and style, with live capacity.
  // ═══════════════════════════════════════════════════════════
  const AllClassesPage = () => {
    const styles = ['all', ...new Set(classes.map(c => c.style).filter(Boolean))];
    let list = classes;
    const filtered = allClassPlaceFilter !== 'all' || allClassTeacherFilter !== 'all' || allClassStyleFilter !== 'all';
    if (allClassPlaceFilter !== 'all') list = list.filter(c => String(c.placeId) === allClassPlaceFilter);
    if (allClassTeacherFilter !== 'all') list = list.filter(c => String(c.teacherId) === allClassTeacherFilter);
    if (allClassStyleFilter !== 'all') list = list.filter(c => c.style === allClassStyleFilter);
    // Run down the week — Monday first, each day in start-time order.
    list = [...list].sort((a, b) => {
      const d = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
      if (d !== 0) return d;
      return String(a.start || '').localeCompare(String(b.start || ''));
    });
    // A filter is itself a request to see all the matches, so the cap only applies unfiltered.
    const capped = !filtered && !showAllClasses && list.length > CLASS_PREVIEW;
    const shown = capped ? list.slice(0, CLASS_PREVIEW) : list;

    return (
      <div className="pb-24">
        <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4 flex items-center gap-3">
          <div className="text-3xl">🏫</div>
          <div>
            <p className="text-white font-bold text-sm">All Classes</p>
            <p className="text-gray-500 text-xs mt-0.5">Browse all classes · {classes.length} total</p>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">Branch</label>
            <select value={allClassPlaceFilter} onChange={e => setAllClassPlaceFilter(e.target.value)} className="w-full bg-zinc-900 border border-amber-900 rounded px-3 py-2 text-white text-xs">
              <option value="all">All Branches</option>
              {(db.places || []).map(pl => <option key={pl.id} value={String(pl.id)}>{pl.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">Teacher</label>
            <select value={allClassTeacherFilter} onChange={e => setAllClassTeacherFilter(e.target.value)} className="w-full bg-zinc-900 border border-amber-900 rounded px-3 py-2 text-white text-xs">
              <option value="all">All Teachers</option>
              {(db.teachers || []).map(tc => <option key={tc.id} value={String(tc.id)}>{tc.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">Style</label>
            <select value={allClassStyleFilter} onChange={e => setAllClassStyleFilter(e.target.value)} className="w-full bg-zinc-900 border border-amber-900 rounded px-3 py-2 text-white text-xs">
              {styles.map(s => <option key={s} value={s}>{s === 'all' ? 'All Styles' : s}</option>)}
            </select>
          </div>
        </div>

        {list.length === 0 ? (
          <p className="text-gray-500 text-center py-8 text-sm">No classes found</p>
        ) : (
          <>
          <div className="space-y-3">
            {shown.map(cls => {
              const teacherName = (db.teachers || []).find(tc => tc.id === cls.teacherId)?.name || '—';
              const placeName = (db.places || []).find(pl => pl.id === cls.placeId)?.name || '—';
              const enrolled = enrolledCountFor(cls.id);
              const full = cls.max != null && enrolled >= cls.max;
              return (
                <div key={cls.id} className="bg-zinc-900 border border-amber-900 rounded-lg p-4">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <div>
                      <p className="text-amber-400 font-bold">{cls.name}</p>
                      <span className="bg-black border border-amber-900 text-amber-400 text-[10px] font-semibold px-2 py-0.5 rounded-full mt-1 inline-block">{cls.style}</span>
                    </div>
                    {cls.max != null && (
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap ${full ? 'bg-red-900/40 text-red-400' : 'bg-emerald-900/40 text-emerald-400'}`}>
                        {full ? 'Full' : `${cls.max - enrolled} open`}
                      </span>
                    )}
                  </div>
                  <p className="text-gray-500 text-xs mt-2">🏢 {placeName}</p>
                  <p className="text-gray-500 text-xs mt-1">👩‍🏫 <span className="text-gray-300">{teacherName}</span></p>
                  <p className="text-gray-500 text-xs mt-1">📅 {cls.day} · {cls.start}–{cls.end}</p>
                  <p className="text-gray-500 text-xs mt-1">📍 {cls.room}</p>
                </div>
              );
            })}
          </div>
          {!filtered && list.length > CLASS_PREVIEW && (
            <ShowMoreButton
              expanded={showAllClasses}
              total={list.length}
              onToggle={() => setShowAllClasses(!showAllClasses)}
              moreLabel={`Show all ${list.length} classes`}
              lessLabel="Show fewer classes"
            />
          )}
          </>
        )}

        <p className="text-gray-500 text-[11px] mt-4">💡 Interested in joining a class? Speak to the studio admin to update your enrollment.</p>
      </div>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // MY ATTENDANCE — mirrors renderStudentAttendance()
  // ═══════════════════════════════════════════════════════════
  // Single attendance row — shared between the capped inline list and the "View All" modal.
  const AttendanceRecordRow = ({ r }) => {
    const statusLabel = r.status === 'present' ? 'Present' : r.status === 'cancelled' ? 'Class Cancelled' : 'Absent';
    const statusClass = r.status === 'present' ? 'bg-emerald-900/40 text-emerald-400'
      : r.status === 'cancelled' ? 'bg-amber-900/40 text-amber-400' : 'bg-red-900/40 text-red-400';
    return (
      <div className="py-1.5 border-t border-amber-900/30">
        <div className="flex justify-between items-center text-xs">
          <span className="text-gray-400 flex items-center gap-1.5">
            {new Date(r.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' })}
            {r.single && <span className="bg-zinc-800 text-gray-400 text-[9px] font-semibold px-1.5 py-0.5 rounded">Single Class</span>}
          </span>
          <span className={`font-bold px-2 py-0.5 rounded-full text-[10px] ${statusClass}`}>{statusLabel}</span>
        </div>
        {/* Front-desk remark left when marked absent — e.g. did a replacement elsewhere */}
        {r.status === 'absent' && r.remark && r.remark.trim() && (
          <p className="text-blue-400 text-[11px] mt-1 pl-0.5">📝 {r.remark}</p>
        )}
      </div>
    );
  };

  const AttendancePage = () => {
    return (
    <>
    <div className="pb-24">
      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4">
        <p className="text-white font-bold">My Attendance</p>
        <p className="text-gray-400 text-xs mt-1">View-only · {presentCount} classes attended this cycle</p>
      </div>
      <p className="text-gray-500 text-[11px] mb-4">💡 Attendance can only be marked or changed by your teacher, the front desk, or the studio admin.</p>

      <div className="flex gap-2 mb-6">
        <div className="flex-1 min-w-0">
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">From</label>
          <input type="date" value={attFrom} onChange={e => setAttFrom(e.target.value)} className="w-full max-w-full bg-zinc-900 border border-amber-900 rounded px-2 py-2 text-white text-xs box-border" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">To</label>
          <input type="date" value={attTo} onChange={e => setAttTo(e.target.value)} className="w-full max-w-full bg-zinc-900 border border-amber-900 rounded px-2 py-2 text-white text-xs box-border" />
        </div>
      </div>

      {myClasses.length === 0 && !attendance.some(a => a.paidByCredit) && <p className="text-gray-500 text-center py-8">Not enrolled in any class yet.</p>}

      {myClasses.map(cls => {
        // Credit-paid regular classes are pre-paid and sit OUTSIDE the monthly billing cycle
        // (matches the original app's counted(): paidByCredit records don't count here — they're
        // shown separately in the Credit Usage Record below).
        const records = attendance.filter(a => a.classId === cls.id && !a.paidByCredit && inAttRange(a.date)).sort((a, b) => b.date.localeCompare(a.date));
        const presentN = records.filter(r => r.status === 'present').length;
        const absentN = records.filter(r => r.status === 'absent').length;
        const cancelledN = records.filter(r => r.status === 'cancelled').length;
        return (
          <div key={cls.id} className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4">
            <div className="flex justify-between items-start mb-3">
              <div>
                <p className="text-amber-400 font-bold">{cls.name}</p>
                <p className="text-gray-500 text-xs">{cls.day} · {cls.start}–{cls.end} · 👩‍🏫 {(db.teachers || []).find(t => t.id === cls.teacherId)?.name || '—'}</p>
              </div>
              <div className="flex gap-1 flex-wrap justify-end">
                <span className="bg-emerald-900/40 text-emerald-400 text-[10px] font-bold px-2 py-1 rounded-full">{presentN} Present</span>
                {absentN > 0 && <span className="bg-red-900/40 text-red-400 text-[10px] font-bold px-2 py-1 rounded-full">{absentN} Absent</span>}
                {cancelledN > 0 && <span className="bg-amber-900/40 text-amber-400 text-[10px] font-bold px-2 py-1 rounded-full">{cancelledN} Cancelled</span>}
              </div>
            </div>
            <div className="mb-3">
              <div className="flex justify-between text-[11px] text-gray-500 mb-1">
                <span>Cycle progress (4 classes = 1 month)</span>
                <span>{cycleProgress}/4</span>
              </div>
              <div className="w-full bg-black rounded-full h-2 overflow-hidden">
                <div className="h-full bg-amber-600 rounded-full" style={{ width: `${cycleProgress / 4 * 100}%` }}></div>
              </div>
            </div>
            {records.length === 0 ? (
              <p className="text-gray-500 text-xs text-center py-3">No attendance yet</p>
            ) : (() => {
              // With a date range set the student has asked for that window, so show all of it;
              // otherwise keep each class card short and offer the full list.
              const attFiltered = !!(attFrom || attTo);
              const shown = attFiltered ? records : records.slice(0, LIST_PREVIEW);
              return (
              <>
                <div className="space-y-1">
                  {shown.map(r => (
                    <AttendanceRecordRow key={r.id} r={r} />
                  ))}
                </div>
                {!attFiltered && records.length > LIST_PREVIEW && (
                  <button
                    onClick={() => { setAttendanceModalClass(cls); setAttendanceModalSearch(''); }}
                    className="w-full text-amber-400 text-xs font-bold text-center mt-3 pt-2 border-t border-amber-900/30"
                  >
                    View All ({records.length}) →
                  </button>
                )}
              </>
              );
            })()}
          </div>
        );
      })}

      {/* Credit Usage Record — every class/session paid from the student's credit
          balance (student.credits), whether it's a regular class taken as a
          credit-only drop-in, or an extra/replacement half-hour or one-hour
          session. Matches the original app's paidByCredit attendance records —
          this is the actual source of truth for credit spending, not a separate log. */}
      {(() => {
        const creditRecords = attendance
          .filter(a => a.paidByCredit && inAttRange(a.date))
          .sort((a, b) => b.date.localeCompare(a.date));
        if (creditRecords.length === 0) return null;
        return (
          <div className="mt-2">
            <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">🎟️ Credit Usage Record</h3>
            <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4">
              <div className="space-y-2">
                {creditRecords.map(r => {
                  const cls = classes.find(c => c.id === r.classId);
                  const teacherName = cls ? (db.teachers || []).find(t => t.id === cls.teacherId)?.name : null;
                  const cost = r.extra ? (r.creditCost ?? (r.dur === 'half' ? 0.5 : 1)) : 1;
                  return (
                    <div key={r.id} className="flex justify-between items-center text-xs py-1.5 border-t border-amber-900/30 first:border-t-0 first:pt-0">
                      <div>
                        <p className="text-gray-300 font-semibold">{cls?.name || 'Class'}{r.extra ? ` · ${r.dur === 'half' ? 'Half-hour extra' : 'One-hour extra'}` : ''}</p>
                        <p className="text-gray-500 mt-0.5">{new Date(r.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric' })}{teacherName ? ` · 👩‍🏫 ${teacherName}` : ''}</p>
                      </div>
                      <span className="bg-amber-900/40 text-amber-400 font-bold px-2 py-0.5 rounded-full text-[10px] whitespace-nowrap">−{cost} 🎟️</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}
    </div>

    {/* "View All" modal — opened per class, shows the complete attendance history
        with a search filter (matches on date text or the front-desk remark). */}
    {attendanceModalClass && (() => {
      const modalRecords = attendance
        .filter(a => a.classId === attendanceModalClass.id && !a.paidByCredit && inAttRange(a.date))
        .sort((a, b) => b.date.localeCompare(a.date));
      const q = attendanceModalSearch.trim().toLowerCase();
      const filtered = q
        ? modalRecords.filter(r => {
            const dateText = new Date(r.date + 'T00:00:00').toLocaleDateString('en-MY', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }).toLowerCase();
            const statusText = (r.status === 'present' ? 'present' : r.status === 'cancelled' ? 'cancelled class cancelled' : 'absent').toLowerCase();
            const remarkText = (r.remark || '').toLowerCase();
            return dateText.includes(q) || statusText.includes(q) || remarkText.includes(q);
          })
        : modalRecords;

      return (
        <div className="fixed inset-0 bg-black/85 flex items-center justify-center z-[150] p-4" onClick={() => setAttendanceModalClass(null)}>
          <div className="bg-zinc-900 border border-amber-700 rounded-lg w-full max-w-sm max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-amber-900/40 flex-shrink-0">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <p className="text-white font-bold text-sm">{attendanceModalClass.name}</p>
                  <p className="text-gray-500 text-xs mt-0.5">{modalRecords.length} total records</p>
                </div>
                <button onClick={() => setAttendanceModalClass(null)} className="text-gray-500 text-xl leading-none">×</button>
              </div>
              <input
                type="text"
                value={attendanceModalSearch}
                onChange={e => setAttendanceModalSearch(e.target.value)}
                placeholder="Search by date, status, or remark…"
                className="w-full bg-black border border-amber-900 rounded px-3 py-2 text-white text-xs focus:border-amber-500 outline-none"
              />
            </div>
            <div className="overflow-y-auto p-4 flex-1">
              {filtered.length === 0 ? (
                <p className="text-gray-500 text-xs text-center py-6">No matching records</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map(r => <AttendanceRecordRow key={r.id} r={r} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
  };

  // ═══════════════════════════════════════════════════════════
  // MY FEES / MEMBERSHIP — mirrors renderStudentFees()
  // ═══════════════════════════════════════════════════════════
  const FeesPage = () => {
    const pi = db?.paymentInfo || {};
    return (
    <div className="pb-24">
      <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">💳 How to Pay</h3>
      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-6">
        <div className="flex flex-wrap gap-6">
          <div className="flex-1 min-w-[180px]">
            <p className="text-amber-400 text-[11px] font-bold uppercase tracking-wide mb-2">🏦 Bank Transfer</p>
            <div className="space-y-1.5 text-sm">
              <p><span className="text-gray-500">Bank:</span> <span className="text-white font-semibold">{pi.bankName || '—'}</span></p>
              <p><span className="text-gray-500">Account Name:</span> <span className="text-white font-semibold">{pi.accountName || '—'}</span></p>
              <p><span className="text-gray-500">Account No.:</span> <span className="text-amber-400 font-mono font-semibold tracking-wide">{pi.accountNumber || '—'}</span></p>
              <p><span className="text-gray-500">DuitNow:</span> <span className="text-white font-semibold">{pi.duitnow || '—'}</span></p>
            </div>
          </div>
          {(pi.tngName || pi.tngNumber) && (
            <div className="text-center">
              <p className="text-amber-400 text-[11px] font-bold uppercase tracking-wide mb-2">📱 Touch 'n Go eWallet</p>
              <div className="bg-white p-2.5 rounded-xl inline-block shadow-lg">
                <PaymentQr seed={(pi.tngNumber || '') + (pi.accountName || '')} />
              </div>
              <p className="text-white text-sm font-semibold mt-2">{pi.tngName || ''}</p>
              <p className="text-gray-500 text-xs font-mono">{pi.tngNumber || ''}</p>
              <p className="text-gray-500 text-[10px] mt-1.5">Scan to pay</p>
            </div>
          )}
        </div>
        <p className="text-gray-500 text-[11px] mt-4 pt-3 border-t border-amber-900/30">💡 After paying, please show or send your receipt to the front desk so your payment can be recorded.</p>
      </div>

      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4">
        <p className="text-white font-bold">{student.name}</p>
        <p className="text-gray-400 text-xs mt-1">Monthly Fee: RM{student.fee} · {myClasses.map(c => c.name).join(', ') || 'No classes'}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-zinc-900 border border-amber-900 rounded-lg p-3 text-center">
          <p className="text-gray-500 text-[10px] uppercase">Monthly Fee</p>
          <p className="text-white font-bold text-lg mt-1">RM{student.fee}</p>
        </div>
        <div className="bg-zinc-900 border border-amber-900 rounded-lg p-3 text-center">
          <p className="text-gray-500 text-[10px] uppercase">🎟️ Credits</p>
          <p className="text-emerald-400 font-bold text-lg mt-1">{student.credits || 0}</p>
        </div>
        <div className="bg-zinc-900 border border-amber-900 rounded-lg p-3 text-center">
          <p className="text-gray-500 text-[10px] uppercase">Unpaid</p>
          <p className="text-red-400 font-bold text-lg mt-1">{pendingPayments.length}</p>
        </div>
      </div>

      {pendingPayments.length > 0 && (
        <>
          <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">⚠️ Outstanding Payments</h3>
          {pendingPayments.map(p => {
            const cls = classes.find(c => c.id === p.classId);
            return (
              <div key={p.id} className="bg-zinc-900 border border-red-800 rounded-lg p-4 mb-3 flex justify-between items-center">
                <div>
                  <p className="text-white font-semibold text-sm">{p.month} 2026{cls ? ` · ${cls.name}` : ''}</p>
                  <span className="bg-red-900/40 text-red-400 text-[10px] font-bold px-2 py-0.5 rounded-full">Unpaid</span>
                </div>
                <p className="text-red-400 font-bold">RM{p.amount}</p>
              </div>
            );
          })}
        </>
      )}

      <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">Payment History</h3>
      <div className="flex gap-2 mb-4">
        <div className="flex-1 min-w-0">
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">From</label>
          <input type="date" value={payFrom} onChange={e => setPayFrom(e.target.value)} className="w-full max-w-full bg-zinc-900 border border-amber-900 rounded px-2 py-2 text-white text-xs box-border" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">To</label>
          <input type="date" value={payTo} onChange={e => setPayTo(e.target.value)} className="w-full max-w-full bg-zinc-900 border border-amber-900 rounded px-2 py-2 text-white text-xs box-border" />
        </div>
      </div>

      <div className="space-y-2">
        {filteredPayments.length === 0 && <p className="text-gray-500 text-center py-6 text-sm">No payment records</p>}
        {(() => {
          // A date range is a request to see everything in it, so the cap only applies unfiltered.
          const payFiltered = !!(payFrom || payTo);
          const shown = (!payFiltered && !showAllPayments) ? filteredPayments.slice(0, LIST_PREVIEW) : filteredPayments;
          return shown.map(p => {
          const cls = classes.find(c => c.id === p.classId);
          return (
            <div key={p.id} className="bg-zinc-900 border border-amber-900 rounded-lg p-4 flex justify-between items-center">
              <div>
                <p className="text-white font-semibold text-sm">{p.month} · <span className="text-amber-400">{cls?.name || '—'}</span></p>
                <p className="text-gray-500 text-xs mt-1">{p.date || '—'} {p.method ? `· ${p.method}` : ''}</p>
              </div>
              <div className="text-right">
                <p className="text-white font-bold text-sm">RM{p.amount}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${p.status === 'Paid' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-red-900/40 text-red-400'}`}>
                  {p.status === 'Paid' ? '✓ Paid' : 'Unpaid'}
                </span>
              </div>
            </div>
          );
        });
        })()}
      </div>
      {!(payFrom || payTo) && filteredPayments.length > LIST_PREVIEW && (
        <ShowMoreButton
          expanded={showAllPayments}
          total={filteredPayments.length}
          onToggle={() => setShowAllPayments(!showAllPayments)}
          moreLabel={`Show all ${filteredPayments.length} payments`}
          lessLabel="Show fewer payments"
        />
      )}
    </div>
  );
  };

  // ═══════════════════════════════════════════════════════════
  // REWARDS — mirrors renderRewards()
  // ═══════════════════════════════════════════════════════════
  const RewardsPage = () => (
    <div className="pb-24">
      <div className="bg-zinc-900 border-l-4 rounded-lg p-5 mb-4 flex items-center gap-4" style={{ borderLeftColor: hasAnyGrade ? gradeMeta(gradeOf).c1 : '#3f3f46' }}>
        <div className="text-4xl">{hasAnyGrade ? gradeMeta(gradeOf).badge : '👶'}</div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">{hasAnyGrade ? `Grade ${gradeOf} · ${gradeMeta(gradeOf).tier}` : 'No grades yet'}</p>
          <p className="text-gray-500 text-xs">Keep dancing to level up your grade!</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-2xl text-amber-400 leading-none">{pointsBalance}</p>
          <p className="text-gray-500 text-[10px] uppercase">Points</p>
          {pendingPoints > 0 && (
            <p className="text-amber-600 text-[10px] mt-1">🔒 {pendingPoints} on hold</p>
          )}
        </div>
      </div>
      <p className="text-gray-500 text-[11px] mb-5">💡 Earn {gradePoints(gradeOf)} points for every class you attend (your Grade rate), then redeem them for rewards below.</p>
      {pendingPoints > 0 && (
        <p className="text-gray-500 text-[11px] -mt-3 mb-5">🎁 You can redeem up to <span className="text-amber-400 font-semibold">{spendablePoints} pts</span> right now — the rest is held by a code waiting to be collected at the counter.</p>
      )}

      {/* New Student Free T-Shirt — set by the studio counter/admin via the
          "tshirtRedeemed" checkbox on the student's record (Edit Student modal).
          View-only here for students, matching the original app's disabled checkbox.
          Promo is only available until 31 Apr 2027. */}
      {(() => {
        const promoDeadline = new Date('2027-04-30T23:59:59'); // available through 31 Apr 2027
        const promoExpired = new Date() > promoDeadline;
        const deadlineLabel = '31 April 2027';
        return (
          <>
            <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">👕 New Student Free T-Shirt</h3>
            <div className={`bg-zinc-900 border-l-4 rounded-lg p-4 mb-2 flex items-center gap-3 ${promoExpired && !student?.tshirtRedeemed ? 'border-gray-700 opacity-70' : 'border-amber-600'}`}>
              <input type="checkbox" checked={!!student?.tshirtRedeemed} disabled readOnly
                className="w-[18px] h-[18px] accent-amber-600 cursor-not-allowed" />
              <div>
                <p className="text-white font-bold text-sm">Free T-shirt for New Student</p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {student?.tshirtRedeemed
                    ? 'Collected — enjoy your free new-student t-shirt! 🎉'
                    : promoExpired
                      ? 'This promotion has ended.'
                      : 'Not collected yet — visit the front desk to claim your free t-shirt.'}
                </p>
              </div>
            </div>
            <p className="text-gray-500 text-[11px] mb-6">
              {promoExpired
                ? `⏰ Offer was available until ${deadlineLabel}.`
                : `🗓️ Available until ${deadlineLabel}.`}
            </p>
          </>
        );
      })()}

      <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">🏅 Grades by Dance Style</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {Object.entries(student.styleGrades || {}).sort((a, b) => b[1] - a[1]).map(([style, g]) => (
          <div key={style} className="bg-zinc-900 border border-amber-900 rounded-lg p-3 text-center" style={g === gradeOf ? { borderColor: gradeMeta(g).c1 } : {}}>
            <div className="text-2xl">{gradeMeta(g).badge}</div>
            <p className="text-white font-semibold text-xs mt-1">{style}</p>
            <p className="text-gray-500 text-[11px]">Grade {g} · {gradeMeta(g).tier}</p>
            {g === gradeOf && <span className="bg-emerald-900/40 text-emerald-400 text-[9px] font-bold px-2 py-0.5 rounded-full mt-1 inline-block">★ Highest</span>}
          </div>
        ))}
      </div>

      <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">🎂 Birthday</h3>
      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-6 text-center">
        {!student.birthday ? (
          <p className="text-gray-500 text-xs">No birthday on file — ask the front desk to add it.</p>
        ) : birthdayInfo?.isToday ? (
          <>
            <div className="text-3xl mb-1">🎂</div>
            <p className="text-amber-400 font-bold text-sm">🎉 Happy Birthday!</p>
            <p className="text-gray-400 text-xs my-2">Claim your birthday gift — 100 bonus points!</p>
            <button onClick={claimBirthday} disabled={birthdayInfo.claimedThisYear || saveStatus === 'saving'}
              className={`px-4 py-2 rounded font-bold text-sm ${birthdayInfo.claimedThisYear ? 'bg-zinc-800 text-gray-500' : 'bg-amber-600 text-black disabled:opacity-60'}`}>
              {birthdayInfo.claimedThisYear ? '✓ Birthday Reward Claimed' : '🎁 Claim Birthday Reward'}
            </button>
          </>
        ) : (
          <p className="text-gray-300 text-sm">🎈 {birthdayInfo.days} days until your birthday</p>
        )}
      </div>

      <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">🎁 Redeem Rewards</h3>
      <div className="grid grid-cols-2 gap-3 mb-6">
        {rewards.map(r => {
          const can = spendablePoints >= r.cost;
          return (
            <div key={r.id} className="bg-zinc-900 border border-amber-900 rounded-lg p-3 text-center">
              <div className="text-2xl mb-1">{r.icon}</div>
              <p className="text-white text-xs font-semibold min-h-[2rem] flex items-center justify-center">{rewardName(r)}</p>
              <p className="text-amber-400 font-bold text-sm my-1">{r.cost} pts</p>
              <button
                onClick={() => redeemReward(r)}
                disabled={!can || saveStatus === 'saving'}
                className={`w-full py-1.5 rounded text-xs font-bold transition ${can ? 'bg-amber-600 hover:bg-amber-500 text-black disabled:opacity-60' : 'bg-zinc-800 text-gray-600'}`}
              >
                Redeem
              </button>
            </div>
          );
        })}
      </div>

      <h3 className="text-white font-bold text-sm mb-3 uppercase tracking-wider">🧾 Redemption History</h3>
      <div className="flex gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">From</label>
          <input type="date" value={redeemFrom} onChange={e => setRedeemFrom(e.target.value)} className="w-full max-w-full bg-zinc-900 border border-amber-900 rounded px-2 py-2 text-white text-xs box-border" />
        </div>
        <div className="flex-1 min-w-0">
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">To</label>
          <input type="date" value={redeemTo} onChange={e => setRedeemTo(e.target.value)} className="w-full max-w-full bg-zinc-900 border border-amber-900 rounded px-2 py-2 text-white text-xs box-border" />
        </div>
      </div>
      {(redeemFrom || redeemTo) && (
        <button onClick={() => { setRedeemFrom(''); setRedeemTo(''); }}
          className="text-amber-400 text-xs font-semibold mb-3">Clear filter</button>
      )}
      {(() => {
        const all = (student.redemptions || []);
        const inRange = d => (!redeemFrom || d >= redeemFrom) && (!redeemTo || d <= redeemTo);
        const filtered = all.filter(r => inRange(r.date || ''));
        const redeemFiltered = !!(redeemFrom || redeemTo);
        // Newest first, and the cap only applies when no range is set.
        const sorted = [...filtered].sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
        const shown = (!redeemFiltered && !showAllRedemptions) ? sorted.slice(0, LIST_PREVIEW) : sorted;
        if (all.length === 0) return <p className="text-gray-500 text-center py-4 text-sm">No rewards redeemed yet</p>;
        if (sorted.length === 0) return <p className="text-gray-500 text-center py-4 text-sm">No redemptions in that date range</p>;
        return (
        <>
        <div className="space-y-2">
          {shown.map(r => {
            const daysLeft = r.collected ? null : EXPIRY_DAYS - Math.floor((Date.now() - new Date(r.date + 'T00:00:00').getTime()) / 86400000);
            return (
              <div key={r.id} className="bg-zinc-900 border border-amber-900 rounded-lg p-3 flex justify-between items-center text-sm">
                <div>
                  <p className="text-white">{r.icon} {r.name}</p>
                  <p className="text-gray-500 text-[11px] mt-0.5">{r.date} · <span className="font-mono">{r.code}</span></p>
                  {!r.collected && daysLeft !== null && (
                    <p className="text-amber-500 text-[10px] mt-0.5">
                      {daysLeft > 0 ? `⏳ Collect within ${daysLeft} day${daysLeft === 1 ? '' : 's'} or points are released` : '⏳ Expiring soon'}
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-xs ${r.collected ? 'text-red-400' : 'text-amber-400'}`}>{r.collected ? `-${r.cost}` : `🔒 ${r.cost}`}</p>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${r.collected ? 'bg-emerald-900/40 text-emerald-400' : 'bg-amber-900/40 text-amber-400'}`}>
                    {r.collected ? '✓ Collected' : 'Show code to counter'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
        {!redeemFiltered && sorted.length > LIST_PREVIEW && (
          <ShowMoreButton
            expanded={showAllRedemptions}
            total={sorted.length}
            onToggle={() => setShowAllRedemptions(!showAllRedemptions)}
            moreLabel={`Show all ${sorted.length} redemptions`}
            lessLabel="Show fewer redemptions"
          />
        )}
        </>
        );
      })()}
    </div>
  );

  // ═══════════════════════════════════════════════════════════
  // MY PROFILE — read-only student details (locked, same as the website's
  // rule) plus the two things students CAN change themselves: their
  // birthday and their password. Birthday saves straight to the shared
  // student record, so it syncs immediately with the desktop site.
  // ═══════════════════════════════════════════════════════════
  const ProfilePage = () => (
    <div className="pb-24">
      <div className="bg-gradient-to-r from-amber-900 to-orange-900 rounded-lg p-6 mb-6 text-center shadow-lg">
        <div className="w-16 h-16 rounded-full bg-black/30 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-3">
          {(student.name || '?').slice(0, 1)}
        </div>
        <h2 className="text-white font-bold text-xl">{student.name}</h2>
        {hasAnyGrade && <p className="text-amber-200 text-xs mt-1 uppercase tracking-wider">{gradeMeta(gradeOf).badge} Grade {gradeOf} · {gradeMeta(gradeOf).tier}</p>}
      </div>

      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4">
        <p className="text-white font-bold text-sm mb-3">Profile Details</p>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <p><span className="text-gray-500">Age:</span> <span className="text-gray-200">{student.age ?? '—'}</span></p>
          <p><span className="text-gray-500">Parent:</span> <span className="text-gray-200">{student.parent || '—'}</span></p>
          <p><span className="text-gray-500">Phone:</span> <span className="text-gray-200">{student.phone || '—'}</span></p>
          <p className="break-all"><span className="text-gray-500">Email:</span> <span className="text-gray-200">{student.email || '—'}</span></p>
        </div>
        <p className="text-gray-500 text-[11px] mt-4 pt-3 border-t border-amber-900/30">
          🔒 These details can only be updated by the studio admin or front desk — please speak to them if anything needs correcting.
        </p>
      </div>

      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4 mb-4">
        <p className="text-white font-bold text-sm mb-3">🎂 Birthday</p>
        {birthdaySuccess && (
          <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-400 text-xs rounded p-3 mb-3">✓ Birthday saved.</div>
        )}
        {birthdayError && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs rounded p-3 mb-3">{birthdayError}</div>
        )}
        <form onSubmit={handleSaveBirthday}>
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">Date of Birth</label>
          <input type="date" value={birthdayInput} onChange={e => setBirthdayInput(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 mb-3 text-white text-sm focus:border-amber-500 outline-none" />
          <button type="submit" disabled={birthdaySaving} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-black font-bold py-2.5 rounded transition text-sm">
            {birthdaySaving ? 'Saving…' : 'Save Birthday'}
          </button>
        </form>
        <p className="text-gray-500 text-[11px] mt-3">
          Used for your birthday reward on the Rewards page — 🎁 100 bonus points on your birthday. Changing it also updates your record at the front desk.
        </p>
      </div>

      <div className="bg-zinc-900 border border-amber-900 rounded-lg p-4">
        <p className="text-white font-bold text-sm mb-3">Change Password</p>
        {pwSuccess && (
          <div className="bg-emerald-900/30 border border-emerald-700 text-emerald-400 text-xs rounded p-3 mb-3">✓ Password updated successfully.</div>
        )}
        {pwError && (
          <div className="bg-red-900/30 border border-red-700 text-red-400 text-xs rounded p-3 mb-3">{pwError}</div>
        )}
        <form onSubmit={handleChangePassword}>
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">Current Password</label>
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 mb-3 text-white text-sm focus:border-amber-500 outline-none" />
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">New Password</label>
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 mb-3 text-white text-sm focus:border-amber-500 outline-none" />
          <label className="text-gray-500 text-[10px] uppercase tracking-wide block mb-1">Confirm New Password</label>
          <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)}
            className="w-full bg-black border border-gray-700 rounded px-3 py-2 mb-4 text-white text-sm focus:border-amber-500 outline-none" />
          <button type="submit" disabled={saveStatus === 'saving'} className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-black font-bold py-2.5 rounded transition text-sm">
            Update Password
          </button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="bg-black text-white min-h-screen w-full relative">
      <PullIndicator dist={pullDist} refreshing={refreshing} trigger={PULL_TRIGGER} />
      <BackToTop />
      <header className="bg-black border-b-2 border-amber-600 sticky top-0 z-50 shadow-lg">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="B Dance Studio" className="w-8 h-8 object-contain" />
            <span className="font-bold text-base tracking-wider">B DANCE STUDIO</span>
          </div>
          <button onClick={() => setShowMenu(!showMenu)} className="text-amber-600 hover:text-amber-500 transition">
            {showMenu ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
        {showMenu && (
          <div className="bg-zinc-900 border-t border-amber-900 p-4 space-y-2">
            <button onClick={() => { setCurrentPage('fees'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-600/20 rounded transition">💳 My Fees</button>
            <button onClick={() => { setCurrentPage('classes'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-600/20 rounded transition">🎓 My Classes</button>
            <button onClick={() => { setCurrentPage('all-classes'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-600/20 rounded transition">🏫 All Classes</button>
            <button onClick={() => { setCurrentPage('attendance'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-600/20 rounded transition">✅ My Attendance</button>
            <button onClick={() => { setCurrentPage('rewards'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-600/20 rounded transition">🎁 Rewards</button>
            <button onClick={() => { setCurrentPage('profile'); setShowMenu(false); }} className="w-full text-left px-4 py-2 hover:bg-amber-600/20 rounded transition">👤 My Profile</button>
            <button onClick={handleLogout} className="w-full text-left px-4 py-2 hover:bg-red-600/20 rounded transition text-red-400">🚪 Logout</button>
          </div>
        )}
      </header>

      <main className="p-4">
        {currentPage === 'fees' && <FeesPage />}
        {currentPage === 'classes' && <MyClassesPage />}
        {currentPage === 'all-classes' && <AllClassesPage />}
        {currentPage === 'attendance' && <AttendancePage />}
        {currentPage === 'rewards' && <RewardsPage />}
        {currentPage === 'profile' && <ProfilePage />}

        {/* Compact contact footer — same db.intro.footer data as the intro page,
            shown on every signed-in page like the original app's app-foot-contact. */}
        {(() => {
          const footer = db?.intro?.footer || {};
          const phone = (footer.phone || '').trim();
          const whatsapp = (footer.whatsapp || '').trim();
          const email = (footer.email || '').trim();
          const address = (footer.address || '').trim();
          const hours = (footer.hours || '').trim();
          const copyright = (footer.copyright || '').trim() || '© 2026 B Dance Studio · Adda Height · Horizon Square · Tasek · Kulai';
          const social = footerSocialLinks(footer);
          const hasAny = phone || whatsapp || email || address || hours || social.length > 0;
          if (!hasAny) return null;
          return (
            <div className="mt-8 pt-6 border-t border-amber-900/30 text-center pb-6">
              <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-gray-400">
                {phone && <a href={`tel:${footerDigitsOnly(phone)}`}>📞 {phone}</a>}
                {whatsapp && <a href={footerWaLink(whatsapp)} target="_blank" rel="noopener noreferrer">💬 {whatsapp}</a>}
                {email && <a href={`mailto:${email}`} className="break-all">✉️ {email}</a>}
                {address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noopener noreferrer">📍 {address}</a>}
                {hours && <span>🕒 {hours}</span>}
              </div>
              {social.length > 0 && (
                <div className="flex flex-wrap justify-center gap-4 mt-3">
                  {social.map(s => (
                    <a key={s.k} href={s.url} target="_blank" rel="noopener noreferrer" className="text-amber-500 text-xs font-semibold">{s.icon}</a>
                  ))}
                </div>
              )}
              <p className="text-gray-600 text-[10px] mt-4">{copyright}</p>
            </div>
          );
        })()}
      </main>

      {rewardCodeModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] p-6" onClick={() => setRewardCodeModal(null)}>
          <div className="bg-zinc-900 border border-amber-600 rounded-lg p-6 text-center max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <p className="text-amber-400 font-bold mb-2">🎁 Your Redemption Code</p>
            <p className="text-white text-sm mb-3">{rewardCodeModal.reward.icon} {rewardCodeModal.reward.name}</p>
            <p className="text-3xl font-mono font-bold text-amber-400 tracking-widest mb-4">{rewardCodeModal.code}</p>
            <p className="text-gray-500 text-xs mb-4">Show this code to the counter to collect your reward.</p>
            <button onClick={() => setRewardCodeModal(null)} className="bg-amber-600 text-black font-bold px-6 py-2 rounded">Close</button>
          </div>
        </div>
      )}

      {/* Save-status overlay — shown for every action that writes to Supabase
          (claiming a birthday bonus, redeeming a reward). Full-screen block while
          saving so nothing else can be tapped mid-write, then a brief confirmation. */}
      {saveStatus === 'saving' && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[250]">
          <div className="text-center">
            <img src="/logo.png" alt="B Dance Studio" className="w-14 h-14 mx-auto mb-3 object-contain animate-pulse" />
            <div className="flex justify-center gap-1.5 mb-3">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-bounce" style={{ animationDelay: '300ms' }}></span>
            </div>
            <p className="text-gray-400 text-sm">Saving…</p>
          </div>
        </div>
      )}
      {saveStatus === 'done' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-emerald-900 border border-emerald-600 text-emerald-300 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg z-[250] flex items-center gap-2">
          ✓ Saved
        </div>
      )}
      {saveStatus === 'error' && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-red-900 border border-red-600 text-red-300 text-sm font-semibold px-4 py-2.5 rounded-full shadow-lg z-[250] flex items-center gap-2">
          ✕ Couldn't save — check your connection
        </div>
      )}


      <nav className="fixed bottom-0 left-0 right-0 bg-zinc-900 border-t-2 border-amber-600 flex justify-around">
        {[
          { page: 'fees', icon: CreditCard, label: 'Fees' },
          { page: 'classes', icon: Award, label: 'My Classes' },
          { page: 'all-classes', icon: Home, label: 'All Classes' },
          { page: 'attendance', icon: Calendar, label: 'Attendance' },
          { page: 'rewards', icon: Gift, label: 'Rewards' },
        ].map(({ page, icon: Icon, label }) => (
          <button key={page} onClick={() => { setCurrentPage(page); setShowMenu(false); }}
            className={`flex-1 py-3 flex flex-col items-center gap-1 text-[10px] font-semibold transition px-0.5 ${
              currentPage === page ? 'text-amber-400 border-t-2 border-amber-600' : 'text-gray-500 hover:text-white'
            }`}>
            <Icon size={18} />
            <span className="text-center leading-tight">{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
