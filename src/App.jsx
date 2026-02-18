import { useState, useMemo } from "react";
import { useStore } from "./store.jsx";

const COLORS = {
  primary: "#3B2D8B", primaryLight: "#5A4BAF", secondary: "#FF4081", accent: "#FF80AB",
  bg: "#F5F3FA", card: "#FFFFFF", text: "#1A1035", textLight: "#7B7394", success: "#10B981", warning: "#F59E0B", danger: "#EF4444",
  gradient: "linear-gradient(135deg,#3B2D8B 0%,#5A4BAF 50%,#7C6DD8 100%)",
  gradientPink: "linear-gradient(135deg,#FF4081 0%,#FF80AB 100%)",
};

const Pill = ({ children, color }) => <span style={{ background: color + "18", color, padding: "4px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600, display: "inline-block" }}>{children}</span>;

const ResultModal = ({ modal, onClose }) => {
  if (!modal) return null;
  return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}>
    <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 28, width: 320, textAlign: "center" }}><div style={{ fontSize: 40, marginBottom: 8 }}>{modal.type === "success" ? "🎉" : "😅"}</div><h3 style={{ margin: "0 0 8px", color: COLORS.text }}>{modal.title}</h3><p style={{ color: COLORS.textLight, fontSize: 14, margin: "0 0 16px" }}>{modal.msg}</p><button onClick={onClose} style={{ background: COLORS.gradient, color: "#fff", border: "none", borderRadius: 8, padding: "10px 32px", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>好的</button></div>
  </div>;
};

// ======= COACH PAGE (multi-select 0.5h) =======
const CoachPage = () => {
  const { coaches, courseCards, bookCoachCoin, bookCoachCard, DAYS, HOURS, slotEnd, slotsRange, slotsDuration } = useStore();
  const [selectedCoach, setSelectedCoach] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);
  const [selectedSlots, setSelectedSlots] = useState([]);
  const [payMethod, setPayMethod] = useState("coin");
  const [payCardId, setPayCardId] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);
  const activeCoaches = coaches.filter(c => c.status === "在职");
  const usableCards = courseCards.filter(c => c.remaining > 0);
  const coachSlots = useMemo(() => selectedCoach?.availableSlots || [], [selectedCoach]);
  const daySlots = useMemo(() => { const ds = coachSlots.find(s => s.day === selectedDay); return ds ? [...ds.hours].sort((a, b) => HOURS.indexOf(a) - HOURS.indexOf(b)) : []; }, [coachSlots, selectedDay, HOURS]);

  const toggleSlot = (h) => {
    setError(null);
    setSelectedSlots(prev => {
      if (prev.includes(h)) { return prev.filter(x => x !== h); }
      const next = [...prev, h].sort((a, b) => HOURS.indexOf(a) - HOURS.indexOf(b));
      // Check contiguous
      for (let i = 1; i < next.length; i++) { if (HOURS.indexOf(next[i]) !== HOURS.indexOf(next[i - 1]) + 1) { setError("请选择连续的时段"); return prev; } }
      return next;
    });
  };

  const duration = slotsDuration(selectedSlots);
  const cost = Math.round((selectedCoach?.price || 80) * duration);
  const cardDeduct = duration;
  const range = slotsRange(selectedSlots);

  const doBook = () => {
    if (duration < 1) { setError("最低预约1小时（请至少选2个连续时段）"); return; }
    if (payMethod === "coin") bookCoachCoin(selectedCoach, selectedSlots, selectedDay);
    else bookCoachCard(selectedCoach, selectedSlots, selectedDay, payCardId);
    setShowConfirm(false); setSelectedSlots([]);
  };

  const tryConfirm = () => {
    if (duration < 1) { setError("最低预约1小时（请至少选2个连续时段）"); return; }
    setShowConfirm(true);
  };

  if (selectedCoach) return <div style={{ padding: "16px 0" }}>
    <button onClick={() => { setSelectedCoach(null); setSelectedDay(null); setSelectedSlots([]); setError(null); }} style={{ background: "none", border: "none", color: COLORS.primary, fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 12 }}>← 返回教练列表</button>
    <div style={{ background: COLORS.card, borderRadius: 16, padding: 20, boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
      <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
        <div style={{ width: 64, height: 64, borderRadius: "50%", background: selectedCoach.avatar ? `url(${selectedCoach.avatar}) center/cover` : "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, flexShrink: 0, overflow: "hidden" }}>{!selectedCoach.avatar && "🏓"}</div>
        <div><h3 style={{ margin: 0, color: COLORS.text }}>{selectedCoach.name}</h3><Pill color={COLORS.primary}>{selectedCoach.level}</Pill><div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 4 }}>擅长：{selectedCoach.specialties.join(", ")}</div><div style={{ fontSize: 13, color: COLORS.secondary, fontWeight: 600, marginTop: 2 }}>{selectedCoach.price} 🪙/小时</div></div>
      </div>
      <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 8 }}>📅 选择日期</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        {DAYS.map(d => { const has = coachSlots.some(s => s.day === d); return <button key={d} disabled={!has} onClick={() => { setSelectedDay(d); setSelectedSlots([]); setError(null); }} style={{ padding: "8px 16px", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 13, cursor: has ? "pointer" : "not-allowed", background: selectedDay === d ? COLORS.gradient : has ? "#E8E5F0" : "#f0f0f0", color: selectedDay === d ? "#fff" : has ? COLORS.text : "#ccc" }}>{d}</button>; })}
      </div>
      {selectedDay && <>
        <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 4 }}>⏰ 选择时段 <span style={{ fontSize: 12, fontWeight: 400, color: COLORS.textLight }}>（0.5h/格，可多选连续时段，最低1小时）</span></div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {daySlots.map(h => { const sel = selectedSlots.includes(h); return <button key={h} onClick={() => toggleSlot(h)} style={{ padding: "8px 14px", borderRadius: 10, border: sel ? `2px solid ${COLORS.secondary}` : "2px solid transparent", fontWeight: 600, fontSize: 13, cursor: "pointer", background: sel ? COLORS.gradientPink : "#FCE4EC", color: sel ? "#fff" : COLORS.secondary, transition: "all .15s" }}>{h}-{slotEnd(h)}</button>; })}
        </div>
        {error && <div style={{ color: COLORS.danger, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>⚠️ {error}</div>}
        {selectedSlots.length > 0 && <div style={{ background: COLORS.primary + "08", borderRadius: 10, padding: "10px 14px", marginBottom: 12, fontSize: 13 }}>
          <span style={{ fontWeight: 700, color: COLORS.text }}>已选：</span>
          <span style={{ color: COLORS.secondary, fontWeight: 600 }}>{range}</span>
          <span style={{ color: COLORS.textLight, marginLeft: 8 }}>共 {duration} 小时</span>
          <span style={{ color: COLORS.secondary, fontWeight: 700, marginLeft: 8 }}>{cost} 🪙</span>
        </div>}
      </>}
      {selectedSlots.length > 0 && <>
        <div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 8 }}>💰 支付方式</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button onClick={() => setPayMethod("coin")} style={{ flex: 1, padding: "12px", borderRadius: 10, border: payMethod === "coin" ? `2px solid ${COLORS.secondary}` : "2px solid #eee", background: payMethod === "coin" ? COLORS.secondary + "10" : "#fff", cursor: "pointer", textAlign: "center" }}><div style={{ fontWeight: 700, color: COLORS.text }}>🪙 Coin 支付</div><div style={{ fontSize: 13, color: COLORS.textLight }}>{cost} Coin</div></button>
          <button onClick={() => { setPayMethod("card"); if (usableCards.length > 0) setPayCardId(usableCards[0].id); }} style={{ flex: 1, padding: "12px", borderRadius: 10, border: payMethod === "card" ? `2px solid ${COLORS.secondary}` : "2px solid #eee", background: payMethod === "card" ? COLORS.secondary + "10" : "#fff", cursor: "pointer", textAlign: "center", opacity: usableCards.length === 0 ? 0.4 : 1 }} disabled={usableCards.length === 0}><div style={{ fontWeight: 700, color: COLORS.text }}>🎫 课程卡</div><div style={{ fontSize: 13, color: COLORS.textLight }}>{usableCards.length > 0 ? `扣 ${cardDeduct} 次` : "无可用"}</div></button>
        </div>
        {payMethod === "card" && usableCards.length > 0 && <div style={{ marginBottom: 16 }}>{usableCards.map(c => <button key={c.id} onClick={() => setPayCardId(c.id)} style={{ display: "block", width: "100%", padding: "10px", borderRadius: 8, border: payCardId === c.id ? `2px solid ${COLORS.secondary}` : "1px solid #eee", background: payCardId === c.id ? "#FFF0F5" : "#fff", cursor: "pointer", marginBottom: 6, textAlign: "left" }}><span style={{ fontWeight: 600 }}>{c.name}</span><span style={{ float: "right", color: COLORS.textLight }}>剩余 {c.remaining}/{c.total} 次</span></button>)}</div>}
        <button onClick={tryConfirm} style={{ width: "100%", padding: "14px", background: COLORS.gradient, color: "#fff", border: "none", borderRadius: 12, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>确认预约</button>
      </>}
    </div>
    {showConfirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowConfirm(false)}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 340 }}>
        <h3 style={{ margin: "0 0 16px", color: COLORS.text }}>确认预约</h3>
        <div style={{ lineHeight: 2, fontSize: 14, color: COLORS.text }}>教练：<b>{selectedCoach.name}</b><br />日期：<b>{selectedDay}</b><br />时段：<b>{range}</b><br />时长：<b>{duration} 小时</b><br />支付：<b>{payMethod === "coin" ? `${cost} Coin` : `课程卡 ${usableCards.find(c => c.id === payCardId)?.name}，扣 ${cardDeduct} 次`}</b></div>
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}><button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.primary}`, background: "#fff", color: COLORS.primary, fontWeight: 600, cursor: "pointer" }}>取消</button><button onClick={doBook} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: COLORS.gradient, color: "#fff", fontWeight: 600, cursor: "pointer" }}>确认</button></div>
      </div>
    </div>}
  </div>;

  return <div style={{ padding: "16px 0" }}><h2 style={{ margin: "0 0 16px", color: COLORS.text, fontSize: 18 }}>🏓 约教练</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {activeCoaches.map(c => <div key={c.id} onClick={() => setSelectedCoach(c)} style={{ background: COLORS.card, borderRadius: 14, padding: 16, display: "flex", gap: 14, alignItems: "center", cursor: "pointer", boxShadow: "0 2px 10px rgba(59,45,139,0.06)" }}>
        <div style={{ width: 52, height: 52, borderRadius: "50%", background: c.avatar ? `url(${c.avatar}) center/cover` : "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0, overflow: "hidden" }}>{!c.avatar && "🏓"}</div>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 700, color: COLORS.text, marginBottom: 4 }}>{c.name}</div><Pill color={COLORS.primary}>{c.level}</Pill><div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>{c.specialties.join(" · ")}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ color: COLORS.secondary, fontWeight: 700, fontSize: 16 }}>{c.price} 🪙/h</div><div style={{ fontSize: 11, color: COLORS.textLight }}>{c.availableSlots.length}天可约</div></div>
      </div>)}
    </div>
  </div>;
};

// ======= COURSE PAGE =======
const CoursePage = () => {
  const { courses, buyCourse } = useStore();
  const [expanded, setExpanded] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const activeCourses = courses.filter(c => c.status === "上架");

  return <div style={{ padding: "16px 0" }}><h2 style={{ margin: "0 0 16px", color: COLORS.text, fontSize: 18 }}>📚 课程商城</h2>
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {activeCourses.map(c => <div key={c.id} style={{ background: COLORS.card, borderRadius: 14, overflow: "hidden", boxShadow: "0 2px 10px rgba(59,45,139,0.06)" }}>
        {c.coverImage && <img src={c.coverImage} style={{ width: "100%", height: 120, objectFit: "cover" }} />}
        <div style={{ padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div><div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>{c.emoji} {c.title}</div><div style={{ fontSize: 13, color: COLORS.textLight, margin: "4px 0" }}>{c.desc}</div>
              <div style={{ display: "flex", gap: 6 }}><Pill color={COLORS.primary}>{c.lessons}课时</Pill><Pill color={COLORS.textLight}>{c.enrolled}人已购</Pill></div></div>
            <div style={{ textAlign: "right" }}><div style={{ color: COLORS.secondary, fontWeight: 800, fontSize: 18 }}>{c.price} 🪙</div><button onClick={() => setConfirm(c)} style={{ marginTop: 6, padding: "6px 18px", background: COLORS.gradient, color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>购买</button></div>
          </div>
          {c.outline && c.outline.length > 0 && <div style={{ marginTop: 10 }}>
            <div onClick={() => setExpanded(expanded === c.id ? null : c.id)} style={{ cursor: "pointer", fontSize: 13, fontWeight: 600, color: COLORS.primary }}>
              {expanded === c.id ? "▼" : "▶"} 课程大纲
            </div>
            {expanded === c.id && <div style={{ marginTop: 6, paddingLeft: 8 }}>{c.outline.map((o, i) => <div key={i} style={{ fontSize: 13, color: COLORS.textLight, padding: "3px 0", borderBottom: "1px solid #f0f0f0" }}>{i + 1}. {o}</div>)}</div>}
          </div>}
        </div>
      </div>)}
    </div>
    {confirm && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setConfirm(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320 }}>
        <h3 style={{ margin: "0 0 12px", color: COLORS.text }}>确认购买</h3>
        <p style={{ fontSize: 14, color: COLORS.text, margin: "0 0 8px" }}><b>{confirm.title}</b></p><p style={{ fontSize: 14, color: COLORS.textLight, margin: "0 0 12px" }}>价格：{confirm.price} Coin · {confirm.lessons}课时<br />购买后将生成课程卡</p>
        <div style={{ display: "flex", gap: 10 }}><button onClick={() => setConfirm(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.primary}`, background: "#fff", color: COLORS.primary, fontWeight: 600, cursor: "pointer" }}>取消</button><button onClick={() => { buyCourse(confirm); setConfirm(null); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: COLORS.gradient, color: "#fff", fontWeight: 600, cursor: "pointer" }}>确认</button></div>
      </div>
    </div>}
  </div>;
};

// ======= COMMUNITY PAGE =======
const CommunityPage = () => {
  const { posts, addPost, likePost, votePost } = useStore();
  const [newPost, setNewPost] = useState("");
  const sorted = [...posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  return <div style={{ padding: "16px 0" }}><h2 style={{ margin: "0 0 12px", color: COLORS.text, fontSize: 18 }}>💬 社区</h2>
    <div style={{ background: COLORS.card, borderRadius: 12, padding: 12, marginBottom: 14, display: "flex", gap: 8 }}>
      <input value={newPost} onChange={e => setNewPost(e.target.value)} placeholder="分享你的想法..." style={{ flex: 1, border: "none", outline: "none", fontSize: 14, fontFamily: "inherit" }} />
      <button onClick={() => { if (newPost.trim()) { addPost(newPost.trim()); setNewPost(""); } }} style={{ background: COLORS.gradient, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>发布</button>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {sorted.map(p => <div key={p.id} style={{ background: COLORS.card, borderRadius: 12, padding: 14, border: p.pinned ? `2px solid ${COLORS.secondary}` : "none" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <div style={{ width: 36, height: 36, borderRadius: "50%", background: COLORS.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, color: "#fff" }}>{p.avatar || "🙋"}</div>
          <div><div style={{ fontWeight: 700, fontSize: 14, color: COLORS.text }}>{p.user}</div><div style={{ fontSize: 12, color: COLORS.textLight }}>{p.time}</div></div>
          {p.pinned && <Pill color={COLORS.secondary}>📌 置顶</Pill>}
        </div>
        <p style={{ margin: "0 0 8px", fontSize: 14, color: COLORS.text, lineHeight: 1.5 }}>{p.content}</p>
        {p.type === "投票" && <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
          <button disabled={p.voted} onClick={() => votePost(p.id, "yes")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid " + COLORS.success, background: p.voted === "yes" ? COLORS.success + "20" : "#fff", color: COLORS.success, fontWeight: 600, cursor: p.voted ? "default" : "pointer" }}>👍 {p.voteYes}</button>
          <button disabled={p.voted} onClick={() => votePost(p.id, "no")} style={{ flex: 1, padding: "8px", borderRadius: 8, border: "1px solid " + COLORS.secondary, background: p.voted === "no" ? COLORS.secondary + "20" : "#fff", color: COLORS.secondary, fontWeight: 600, cursor: p.voted ? "default" : "pointer" }}>👎 {p.voteNo}</button>
        </div>}
        <div style={{ display: "flex", gap: 16, fontSize: 13, color: COLORS.textLight }}>
          <span onClick={() => likePost(p.id)} style={{ cursor: "pointer" }}>❤️ {p.likes}</span><span>💬 {p.comments}</span>
        </div>
      </div>)}
    </div>
  </div>;
};

// ======= ACTIVITY PAGE =======
const ActivityPage = () => {
  const { activities, joinActivity, joinedIds } = useStore();
  const [filter, setFilter] = useState("all");
  const filtered = activities.filter(a => filter === "all" || (filter === "group" ? a.type === "group" : a.type === "match"));
  const tabs = [{ id: "all", label: "全部" }, { id: "group", label: "团课" }, { id: "match", label: "比赛" }];

  return <div style={{ padding: "16px 0" }}><h2 style={{ margin: "0 0 12px", color: COLORS.text, fontSize: 18 }}>🎯 活动</h2>
    <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>{tabs.map(t => <button key={t.id} onClick={() => setFilter(t.id)} style={{ padding: "6px 16px", borderRadius: 20, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: filter === t.id ? COLORS.gradient : "#E8E5F0", color: filter === t.id ? "#fff" : COLORS.text }}>{t.label}</button>)}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {filtered.map(a => {
        const joined = joinedIds.includes(a.id); const full = a.enrolledUsers.length >= a.spots; return <div key={a.id} style={{ background: COLORS.card, borderRadius: 14, padding: 14, boxShadow: "0 2px 10px rgba(59,45,139,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
            <div><div style={{ fontWeight: 700, fontSize: 15, color: COLORS.text, marginBottom: 4 }}>{a.emoji} {a.title}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                <Pill color={a.type === "match" ? COLORS.warning : COLORS.success}>{a.type === "match" ? "比赛" : "团课"}</Pill>
                <Pill color={COLORS.textLight}>📅 {a.date} {a.time}</Pill>
                <Pill color={COLORS.textLight}>📍 {a.location}</Pill>
              </div>
              <div style={{ fontSize: 13, color: COLORS.textLight }}>{a.enrolledUsers.length}/{a.spots} 已报名 · {a.cost} Coin</div>
            </div>
            <button disabled={joined || full} onClick={() => joinActivity(a)} style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: joined ? "#ccc" : full ? "#eee" : COLORS.gradient, color: joined || full ? "#999" : "#fff", fontWeight: 600, fontSize: 13, cursor: joined || full ? "default" : "pointer" }}>{joined ? "已报名" : full ? "已满" : "报名"}</button>
          </div>
          {a.type === "match" && a.rewards.length > 0 && <div style={{ marginTop: 8, padding: "8px 12px", background: COLORS.warning + "10", borderRadius: 8 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: COLORS.warning, marginBottom: 4 }}>🏆 奖励</div>
            <div style={{ display: "flex", gap: 12 }}>{a.rewards.map(r => <span key={r.rank} style={{ fontSize: 12, color: COLORS.text }}>第{r.rank}名: <b>{r.amount} Coin</b></span>)}</div>
            {a.rewardDistributed && <div style={{ fontSize: 12, color: COLORS.success, marginTop: 4 }}>✅ 奖励已发放</div>}
          </div>}
        </div>;
      })}
    </div>
  </div>;
};

// ======= TABLE PAGE (multi-select 0.5h) =======
const TablePage = () => {
  const { tables, activities, bookings, bookTable, HOURS, slotEnd, slotsRange, slotsDuration } = useStore();
  const [selDate, setSelDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getMonth() + 1}/${d.getDate()}`; });
  const [selTable, setSelTable] = useState(null);
  const [selSlots, setSelSlots] = useState([]);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState(null);

  const dates = useMemo(() => { const ds = []; const now = new Date(); for (let i = 1; i <= 7; i++) { const d = new Date(now); d.setDate(d.getDate() + i); ds.push(`${d.getMonth() + 1}/${d.getDate()}`); } return ds; }, []);

  const isOccupied = (tableId, hour) => {
    const slot = `${hour}-${slotEnd(hour)}`;
    const t = tables.find(x => x.id === tableId);
    if (t?.unavailableSlots?.some(s => s.dateKey === selDate && s.hour === slot)) return true;
    if (activities.some(a => a.tableId === tableId && a.tableSlot && a.tableSlot.includes(hour))) return true;
    if (bookings.some(b => b.type === "球台预约" && b.detail.includes(t?.name) && b.date === selDate && b.slots?.includes(hour) && b.status !== "已拒绝" && b.status !== "已取消")) return true;
    return false;
  };

  const toggleSlot = (tableId, h) => {
    setError(null);
    if (selTable !== null && selTable !== tableId) { setSelTable(tableId); setSelSlots([h]); return; }
    setSelTable(tableId);
    setSelSlots(prev => {
      if (prev.includes(h)) { return prev.filter(x => x !== h); }
      const next = [...prev, h].sort((a, b) => HOURS.indexOf(a) - HOURS.indexOf(b));
      for (let i = 1; i < next.length; i++) { if (HOURS.indexOf(next[i]) !== HOURS.indexOf(next[i - 1]) + 1) { setError("请选择连续的时段"); return prev; } }
      return next;
    });
  };

  const duration = slotsDuration(selSlots);
  const table = tables.find(t => t.id === selTable);
  const cost = Math.round((table?.pricePerHour || 15) * duration);
  const range = slotsRange(selSlots);

  const doBook = () => {
    if (duration < 1) { setError("最低预约1小时（请至少选2个连续时段）"); return; }
    bookTable(table, selSlots, selDate);
    setShowConfirm(false); setSelSlots([]);
  };

  const tryConfirm = () => {
    if (duration < 1) { setError("最低预约1小时（请至少选2个连续时段）"); return; }
    setShowConfirm(true);
  };

  return <div style={{ padding: "16px 0" }}><h2 style={{ margin: "0 0 12px", color: COLORS.text, fontSize: 18 }}>🏟️ 租球台</h2>
    <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14, paddingBottom: 4 }}>
      {dates.map(d => <button key={d} onClick={() => { setSelDate(d); setSelSlots([]); setError(null); }} style={{ padding: "6px 14px", borderRadius: 10, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: selDate === d ? COLORS.gradient : "#E8E5F0", color: selDate === d ? "#fff" : COLORS.text, whiteSpace: "nowrap" }}>{d}</button>)}
    </div>
    <div style={{ fontSize: 12, color: COLORS.textLight, marginBottom: 8 }}>点击可用时段多选连续格子，最低预约1小时（2格）</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {tables.filter(t => t.status === "正常").map(t => <div key={t.id} style={{ background: COLORS.card, borderRadius: 12, padding: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <div><span style={{ fontWeight: 700, color: COLORS.text }}>{t.name}</span><span style={{ color: COLORS.secondary, fontWeight: 600, marginLeft: 8 }}>{t.pricePerHour} 🪙/时</span></div>
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {HOURS.map(h => { const occ = isOccupied(t.id, h); const sel = selTable === t.id && selSlots.includes(h); return <button key={h} disabled={occ} onClick={() => toggleSlot(t.id, h)} style={{ padding: "4px 8px", borderRadius: 6, border: sel ? `2px solid ${COLORS.secondary}` : "2px solid transparent", fontSize: 11, fontWeight: 600, cursor: occ ? "not-allowed" : "pointer", background: occ ? "#eee" : sel ? COLORS.gradientPink : "#E8E5F0", color: occ ? "#ccc" : sel ? "#fff" : COLORS.text, transition: "all .15s" }}>{h}</button>; })}
        </div>
        {selTable === t.id && selSlots.length > 0 && <div style={{ marginTop: 8, background: COLORS.primary + "08", borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
          <span style={{ fontWeight: 700 }}>已选：</span><span style={{ color: COLORS.secondary, fontWeight: 600 }}>{range}</span>
          <span style={{ color: COLORS.textLight, marginLeft: 8 }}>{duration}h</span>
          <span style={{ color: COLORS.secondary, fontWeight: 700, marginLeft: 8 }}>{cost} 🪙</span>
          <button onClick={tryConfirm} style={{ float: "right", padding: "4px 16px", background: COLORS.gradient, color: "#fff", border: "none", borderRadius: 6, fontWeight: 600, fontSize: 12, cursor: "pointer" }}>预约</button>
        </div>}
      </div>)}
    </div>
    {error && <div style={{ position: "fixed", bottom: 80, left: "50%", transform: "translateX(-50%)", background: COLORS.danger, color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 13, zIndex: 100 }}>⚠️ {error}</div>}
    {showConfirm && selTable && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowConfirm(false)}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320 }}>
        <h3 style={{ margin: "0 0 12px", color: COLORS.text }}>确认预约</h3>
        <p style={{ fontSize: 14, color: COLORS.text }}>球台：<b>{table?.name}</b><br />日期：<b>{selDate}</b><br />时段：<b>{range}</b><br />时长：<b>{duration} 小时</b><br />费用：<b>{cost} Coin</b></p>
        <div style={{ display: "flex", gap: 10 }}><button onClick={() => setShowConfirm(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.primary}`, background: "#fff", color: COLORS.primary, fontWeight: 600, cursor: "pointer" }}>取消</button><button onClick={doBook} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: COLORS.gradient, color: "#fff", fontWeight: 600, cursor: "pointer" }}>确认</button></div>
      </div>
    </div>}
  </div>;
};

// ======= PROFILE PAGE =======
const ProfilePage = () => {
  const { coins, courseCards, history, bookings, cancelBooking, recharge, transfer, userName, setUserName, userAvatar, setUserAvatar, userAvatarColor, randomizeAvatar } = useStore();
  const [showTransfer, setShowTransfer] = useState(false);
  const [tUser, setTUser] = useState("");
  const [tAmt, setTAmt] = useState("");
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(userName);
  const [cancelModal, setCancelModal] = useState(null);
  const [showAvatarMenu, setShowAvatarMenu] = useState(false);

  const myBookings = bookings.filter(b => b.user === userName);

  const handleAvatarUpload = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader(); r.onload = () => { setUserAvatar(r.result); setShowAvatarMenu(false); }; r.readAsDataURL(f);
  };

  const doCancelBooking = () => {
    if (cancelModal) { cancelBooking(cancelModal.id); setCancelModal(null); }
  };

  return <div style={{ padding: "16px 0" }}>
    {/* Avatar area */}
    <div style={{ background: COLORS.gradient, borderRadius: 16, padding: 20, color: "#fff", marginBottom: 16, textAlign: "center", position: "relative" }}>
      <div style={{ position: "relative", display: "inline-block" }}>
        <div onClick={() => setShowAvatarMenu(!showAvatarMenu)} style={{ width: 64, height: 64, borderRadius: "50%", background: userAvatar ? `url(${userAvatar}) center/cover` : userAvatarColor, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 26, margin: "0 auto 8px", cursor: "pointer", border: "3px solid rgba(255,255,255,0.3)", overflow: "hidden", fontWeight: 700, color: "#fff" }}>{!userAvatar && userName.charAt(0)}</div>
        {showAvatarMenu && <div style={{ position: "absolute", top: 72, left: "50%", transform: "translateX(-50%)", background: "#fff", borderRadius: 12, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 10, overflow: "hidden", width: 160 }}>
          <label style={{ display: "block", padding: "12px 16px", fontSize: 13, color: COLORS.text, cursor: "pointer", borderBottom: "1px solid #f0f0f0", fontWeight: 600 }}>📷 上传图片<input type="file" accept="image/*" style={{ display: "none" }} onChange={handleAvatarUpload} /></label>
          <div onClick={() => { randomizeAvatar(); setShowAvatarMenu(false); }} style={{ padding: "12px 16px", fontSize: 13, color: COLORS.text, cursor: "pointer", fontWeight: 600 }}>🎲 随机头像</div>
        </div>}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
        {editingName ? <div style={{ display: "flex", gap: 6, alignItems: "center" }}><input value={tempName} onChange={e => setTempName(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { setUserName(tempName); setEditingName(false); } }} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: 6, padding: "4px 10px", color: "#fff", fontSize: 16, fontWeight: 700, outline: "none", width: 100, textAlign: "center" }} autoFocus /><span onClick={() => { setUserName(tempName); setEditingName(false); }} style={{ cursor: "pointer", fontSize: 14 }}>✓</span></div>
          : <><span style={{ fontWeight: 700, fontSize: 18 }}>{userName}</span><span onClick={() => { setTempName(userName); setEditingName(true); }} style={{ cursor: "pointer", fontSize: 14, opacity: 0.8 }}>✏️</span></>}
      </div>
    </div>

    {/* My bookings */}
    <h3 style={{ margin: "0 0 10px", color: COLORS.text, fontSize: 15 }}>📋 我的预约</h3>
    {myBookings.length === 0 ? <div style={{ background: COLORS.card, borderRadius: 12, padding: 20, textAlign: "center", color: COLORS.textLight, marginBottom: 16 }}>暂无预约记录</div> :
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {myBookings.map(b => <div key={b.id} style={{ background: COLORS.card, borderRadius: 12, padding: 14, opacity: b.status === "已取消" ? 0.5 : 1 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}><Pill color={b.type === "教练预约" ? COLORS.primary : COLORS.primaryLight}>{b.type === "教练预约" ? "🏓 私教" : "🏟️ 球台"}</Pill><Pill color={b.status === "已确认" ? COLORS.success : b.status === "已取消" ? "#999" : COLORS.warning}>{b.status}</Pill></div>
            {b.status !== "已取消" && b.status !== "已拒绝" && <button onClick={() => setCancelModal(b)} style={{ padding: "4px 12px", background: "none", border: `1px solid ${COLORS.danger}`, color: COLORS.danger, borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>取消预约</button>}
          </div>
          <div style={{ fontWeight: 600, fontSize: 14, color: COLORS.text, marginBottom: 2 }}>{b.detail}</div>
          <div style={{ fontSize: 12, color: COLORS.textLight }}>{b.payMethod} · {b.duration}h{b.status === "已取消" && b.refundAmount ? ` · 退款: ${b.refundAmount}${b.payMethod === "Coin" ? " 🪙" : " 次"}` : ""}</div>
        </div>)}
      </div>}

    {/* Course cards */}
    <h3 style={{ margin: "0 0 10px", color: COLORS.text, fontSize: 15 }}>🎫 我的课程卡</h3>
    {courseCards.length === 0 ? <div style={{ background: COLORS.card, borderRadius: 12, padding: 20, textAlign: "center", color: COLORS.textLight, marginBottom: 16 }}>暂无课程卡</div> :
      <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
        {courseCards.map(c => <div key={c.id} style={{ background: COLORS.card, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}><span style={{ fontWeight: 700, color: COLORS.text }}>{c.name}</span><span style={{ fontSize: 13, color: c.remaining > 0 ? COLORS.success : "#ccc", fontWeight: 600 }}>{c.remaining > 0 ? `${c.remaining}/${c.total} 次` : "已用完"}</span></div>
          <div style={{ height: 6, background: "#eee", borderRadius: 3, overflow: "hidden" }}><div style={{ height: "100%", width: `${(c.remaining / c.total) * 100}%`, background: c.remaining > 0 ? COLORS.gradient : "#ccc", borderRadius: 3 }} /></div>
        </div>)}
      </div>}

    {/* Wallet */}
    <h3 style={{ margin: "0 0 10px", color: COLORS.text, fontSize: 15 }}>💰 Coin 钱包</h3>
    <div style={{ background: COLORS.card, borderRadius: 12, padding: 16, marginBottom: 12 }}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: COLORS.primary }}>{coins} <span style={{ fontSize: 16 }}>🪙</span></div>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={recharge} style={{ flex: 1, padding: "10px", borderRadius: 8, background: COLORS.gradient, color: "#fff", border: "none", fontWeight: 600, cursor: "pointer" }}>充值 +100</button>
        <button onClick={() => setShowTransfer(true)} style={{ flex: 1, padding: "10px", borderRadius: 8, background: "#fff", color: COLORS.primary, border: `1.5px solid ${COLORS.primary}`, fontWeight: 600, cursor: "pointer" }}>转让</button>
      </div>
    </div>

    {/* History */}
    <h3 style={{ margin: "0 0 10px", color: COLORS.text, fontSize: 15 }}>📜 交易记录</h3>
    <div style={{ background: COLORS.card, borderRadius: 12, overflow: "hidden" }}>
      {history.map((h, i) => <div key={i} style={{ padding: "10px 14px", borderBottom: "1px solid #f5f5f5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div><div style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{h.desc}</div><div style={{ fontSize: 11, color: COLORS.textLight }}>{h.time}{h.payType === "card" ? " · 🎫 课程卡" : ""}</div></div>
        <span style={{ fontWeight: 700, color: h.amount > 0 ? COLORS.success : COLORS.secondary, fontSize: 14 }}>{h.amount > 0 ? "+" : ""}{h.amount}{h.payType === "card" ? " 次" : " 🪙"}</span>
      </div>)}
    </div>

    {/* Cancel booking modal */}
    {cancelModal && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setCancelModal(null)}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 340 }}>
        <h3 style={{ margin: "0 0 12px", color: COLORS.text }}>取消预约</h3>
        <div style={{ fontSize: 14, color: COLORS.text, marginBottom: 12 }}><b>{cancelModal.detail}</b></div>
        <div style={{ background: COLORS.warning + "15", borderRadius: 10, padding: 12, marginBottom: 16, fontSize: 13, lineHeight: 1.8 }}>
          <div style={{ fontWeight: 700, color: COLORS.warning, marginBottom: 4 }}>📋 退款规则</div>
          <div>• 距预约时间 <b>超过24小时</b>：<span style={{ color: COLORS.success, fontWeight: 600 }}>全额退款</span></div>
          <div>• 距预约时间 <b>24小时内</b>：<span style={{ color: COLORS.danger, fontWeight: 600 }}>扣50%费用</span>，退还50%</div>
          <div style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}>当前预估退款：<b>{cancelModal.payMethod === "Coin" ? `${cancelModal.cost} Coin` : `${cancelModal.cardDeduct || cancelModal.duration} 次`}</b>（全额）</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}><button onClick={() => setCancelModal(null)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.primary}`, background: "#fff", color: COLORS.primary, fontWeight: 600, cursor: "pointer" }}>返回</button><button onClick={doCancelBooking} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: COLORS.danger, color: "#fff", fontWeight: 600, cursor: "pointer" }}>确认取消</button></div>
      </div>
    </div>}

    {/* Transfer modal */}
    {showTransfer && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowTransfer(false)}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: 320 }}>
        <h3 style={{ margin: "0 0 16px", color: COLORS.text }}>转让 Coin</h3>
        <div style={{ marginBottom: 12 }}><label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>转给</label><input value={tUser} onChange={e => setTUser(e.target.value)} placeholder="对方昵称" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.primary}25`, outline: "none", fontSize: 14, boxSizing: "border-box" }} /></div>
        <div style={{ marginBottom: 12 }}><label style={{ fontSize: 13, fontWeight: 600, display: "block", marginBottom: 4 }}>金额</label><input type="number" value={tAmt} onChange={e => setTAmt(e.target.value)} placeholder="输入数量" style={{ width: "100%", padding: "8px 12px", borderRadius: 8, border: `1px solid ${COLORS.primary}25`, outline: "none", fontSize: 14, boxSizing: "border-box" }} /></div>
        <div style={{ display: "flex", gap: 10 }}><button onClick={() => setShowTransfer(false)} style={{ flex: 1, padding: "10px", borderRadius: 8, border: `1.5px solid ${COLORS.primary}`, background: "#fff", color: COLORS.primary, fontWeight: 600, cursor: "pointer" }}>取消</button><button onClick={() => { transfer(tUser, Number(tAmt)); setShowTransfer(false); setTUser(""); setTAmt(""); }} style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", background: COLORS.gradient, color: "#fff", fontWeight: 600, cursor: "pointer" }}>确认</button></div>
      </div>
    </div>}
  </div>;
};

// ======= MAIN APP =======
const TABS = [
  { id: "coach", icon: "🏓", label: "约教练" }, { id: "course", icon: "📚", label: "课程" },
  { id: "community", icon: "💬", label: "社区" }, { id: "activity", icon: "🎯", label: "活动" },
  { id: "table", icon: "🏟️", label: "球台" }, { id: "profile", icon: "👤", label: "我的" },
];

export default function App() {
  const [tab, setTab] = useState("coach");
  const store = useStore();

  return <div style={{ maxWidth: 430, margin: "0 auto", minHeight: "100vh", background: COLORS.bg, fontFamily: "-apple-system,'Segoe UI',sans-serif", display: "flex", flexDirection: "column" }}>
    <div style={{ background: COLORS.gradient, padding: "14px 16px", textAlign: "center" }}>
      <h1 style={{ margin: 0, color: "#fff", fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>DC Pingpong 🏓</h1>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: "0 14px", paddingBottom: 70 }}>
      {tab === "coach" && <CoachPage />}
      {tab === "course" && <CoursePage />}
      {tab === "community" && <CommunityPage />}
      {tab === "activity" && <ActivityPage />}
      {tab === "table" && <TablePage />}
      {tab === "profile" && <ProfilePage />}
    </div>
    <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", display: "flex", borderTop: "1px solid #eee", boxShadow: "0 -2px 10px rgba(0,0,0,0.05)" }}>
      {TABS.map(t => <div key={t.id} onClick={() => setTab(t.id)} style={{ flex: 1, padding: "8px 0", textAlign: "center", cursor: "pointer", transition: "all .15s" }}>
        <div style={{ fontSize: 20 }}>{t.icon}</div>
        <div style={{ fontSize: 11, fontWeight: tab === t.id ? 700 : 400, color: tab === t.id ? COLORS.primary : COLORS.textLight }}>{t.label}</div>
        {tab === t.id && <div style={{ width: 20, height: 3, background: COLORS.secondary, borderRadius: 2, margin: "2px auto 0" }} />}
      </div>)}
    </div>
    <ResultModal modal={store.resultModal} onClose={() => store.setResultModal(null)} />
  </div>;
}
