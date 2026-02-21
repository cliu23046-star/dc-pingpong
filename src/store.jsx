import { createContext, useContext, useState, useCallback, useEffect, useMemo } from "react";
import { supabase } from "./supabaseClient.js";

const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const DAY_MAP = { 0: "周日", 1: "周一", 2: "周二", 3: "周三", 4: "周四", 5: "周五", 6: "周六" };
const HOURS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
];
const DEFAULT_COACH_HOURS = [
  "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
];

function getNext7Days() {
  const result = [];
  const now = chinaDate();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i + 1);
    const dow = d.getDay();
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    result.push({ date: d, label: formatDateLabel(d), dateKey: dateStr, weekday: DAY_MAP[dow], isWeekend: dow === 0 || dow === 6 });
  }
  return result;
}

const slotEnd = (s) => { const i = HOURS.indexOf(s); return i >= 0 && i < HOURS.length - 1 ? HOURS[i + 1] : "21:00"; };
const slotsRange = (slots) => { if (!slots || slots.length === 0) return ""; const sorted = [...slots].sort((a, b) => HOURS.indexOf(a) - HOURS.indexOf(b)); return `${sorted[0]}-${slotEnd(sorted[sorted.length - 1])}`; };
const slotsDuration = (slots) => (slots?.length || 0) * 0.5;

// ---- China timezone date helpers ----
function chinaDate(d) {
  // Returns a Date object adjusted to China timezone for display
  const opt = { timeZone: "Asia/Shanghai" };
  const str = (d || new Date()).toLocaleString("en-US", opt);
  return new Date(str);
}

function formatDateLabel(d) {
  // Returns "M/D 周X" format
  const cd = typeof d === "string" ? new Date(d) : d;
  const cn = chinaDate(cd);
  const m = cn.getMonth() + 1;
  const day = cn.getDate();
  const weekday = DAY_MAP[cn.getDay()];
  return `${m}/${day} ${weekday}`;
}

function getWorkdays(count, openWeekendDates = []) {
  // Returns next `count` workdays (skip weekends unless in openWeekendDates)
  const result = [];
  const now = chinaDate();
  let offset = 1;
  while (result.length < count) {
    const d = new Date(now);
    d.setDate(d.getDate() + offset);
    const dow = d.getDay();
    const dateStr = `${d.getMonth() + 1}/${d.getDate()}`;
    const isWeekend = dow === 0 || dow === 6;
    if (!isWeekend || openWeekendDates.includes(dateStr)) {
      result.push({ date: d, label: formatDateLabel(d), dateKey: dateStr, weekday: DAY_MAP[dow], isWeekend });
    }
    offset++;
    if (offset > 30) break; // safety
  }
  return result;
}

const AVATAR_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF8C00", "#6C5CE7", "#A29BFE", "#FD79A8"];
const randomAvatarColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

const StoreContext = createContext(null);

// Map DB row → app shape
const mapCoach = (r) => ({ id: r.id, name: r.name, level: r.level, specialties: r.specialties || [], price: r.price_per_hour, avatar: r.avatar_url, availableSlots: r.available_slots || [], status: r.status, closedDates: r.closed_dates || [], closedSlots: r.closed_slots || [] });
const mapCourse = (r) => ({ id: r.id, title: r.title, desc: r.description, emoji: r.emoji, lessons: r.lessons, price: r.price, coverImage: r.cover_url, outline: r.outline || [], enrolled: r.enrolled, status: r.status });
const mapActivity = (r) => ({ id: r.id, title: r.title, type: r.type, emoji: r.emoji, date: r.date, time: r.time, location: r.location, spots: r.spots, cost: r.cost, rewards: r.rewards || [], enrolledUsers: r.enrolled_users || [], rewardDistributed: r.reward_distributed, tableId: r.table_id, tableSlot: r.table_slot, status: r.status, occupiedTableCount: r.occupied_table_count || 0, occupiedTimeSlots: r.occupied_time_slots || [], minParticipants: r.min_participants || 0 });
const mapTable = (r) => ({ id: r.id, name: r.name, pricePerHour: r.price_per_hour, status: r.status, closedDates: r.closed_dates || [], unavailableSlots: r.unavailable_slots || [], openWeekendDates: r.open_weekend_dates || [] });
const mapBooking = (r) => ({ id: r.id, userId: r.user_id, user: r.user_name, type: r.type, targetId: r.target_id, targetName: r.target_name, detail: r.detail, date: r.date, slots: r.time_slots || [], duration: Number(r.duration), payMethod: r.payment_method === "coin" ? "Coin" : "课程卡", cost: Number(r.amount), cardId: r.card_id, cardDeduct: Number(r.card_deduct || 0), status: r.status, refunded: r.refunded, refundAmount: Number(r.refund_amount || 0), cancelledAt: r.cancelled_at, createdAt: r.created_at });
const mapPost = (r) => ({ id: r.id, user: r.user_name, avatar: r.user_avatar, time: timeSince(r.created_at), content: r.content, type: r.type, voteYes: r.vote_yes, voteNo: r.vote_no, likes: r.likes, comments: r.comments, pinned: r.is_pinned, voted: false });
const mapCard = (r) => ({ id: r.id, userId: r.user_id, courseId: r.course_id, name: r.course_name, total: Number(r.total_lessons), remaining: Number(r.remaining_lessons), date: r.purchase_date });
const mapTx = (r) => ({ id: r.id, userId: r.user_id, desc: r.description, amount: Number(r.amount), time: timeSince(r.created_at), payType: r.type, createdAt: r.created_at });
const mapUser = (r) => ({ id: r.id, nickname: r.nickname, avatarUrl: r.avatar_url, avatarColor: r.avatar_color || "#6C5CE7", coins: r.coins, createdAt: r.created_at });

function timeSince(dateStr) {
  if (!dateStr) return "刚刚";
  const d = new Date(dateStr);
  const now = new Date();
  const s = Math.floor((now - d) / 1000);
  if (s < 60) return "刚刚";
  if (s < 3600) return `${Math.floor(s / 60)}分钟前`;
  if (s < 86400) return `${Math.floor(s / 3600)}小时前`;
  return `${Math.floor(s / 86400)}天前`;
}

export function StoreProvider({ children }) {
  const [loading, setLoading] = useState(true);
  const [coaches, setCoaches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [activities, setActivities] = useState([]);
  const [tables, setTables] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [posts, setPosts] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Current user (first user in DB)
  const [userId, setUserId] = useState(null);
  const [userName, setUserNameState] = useState("球友");
  const [userAvatar, setUserAvatarState] = useState(null);
  const [userAvatarColor, setUserAvatarColor] = useState("#6C5CE7");
  const [coins, setCoinsState] = useState(500);
  const [courseCards, setCourseCards] = useState([]);
  const [history, setHistory] = useState([]);
  const [joinedIds, setJoinedIds] = useState([]);
  const [resultModal, setResultModal] = useState(null);

  // ---- Aggregate open weekend dates across all tables ----
  const openWeekendDates = useMemo(() => {
    const all = new Set();
    tables.forEach(t => (t.openWeekendDates || []).forEach(d => all.add(d)));
    return [...all];
  }, [tables]);

  // ---- Dynamic total table count (from active tables in DB) ----
  const totalTables = useMemo(() => tables.filter(t => t.status === "正常").length, [tables]);

  // ---- Table occupancy calculator ----
  const getSlotOccupancy = useCallback((dateKey, hour) => {
    let occupied = 0;
    bookings.forEach(b => {
      if (b.type === "教练预约" && b.date === dateKey && b.slots?.includes(hour) && b.status !== "已取消" && b.status !== "已拒绝") {
        occupied += 1;
      }
    });
    activities.forEach(a => {
      if ((a.occupiedTimeSlots || []).includes(hour) && a.date === dateKey && a.occupiedTableCount > 0 && a.status !== "已取消") {
        occupied += a.occupiedTableCount;
      }
    });
    bookings.forEach(b => {
      if (b.type === "球台预约" && b.date === dateKey && b.slots?.includes(hour) && b.status !== "已取消" && b.status !== "已拒绝") {
        occupied += 1;
      }
    });
    return { occupied, available: Math.max(0, totalTables - occupied), full: occupied >= totalTables };
  }, [bookings, activities, totalTables]);

  // ---- Coach slot occupancy: check if a coach+date+hour is already booked ----
  const isCoachSlotBooked = useCallback((coachId, dateKey, hour) => {
    return bookings.some(b => b.type === "教练预约" && b.targetId === coachId && b.date === dateKey && b.slots?.includes(hour) && b.status !== "已取消" && b.status !== "已拒绝");
  }, [bookings]);

  // ---- LOAD ALL DATA ----
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, crRes, aRes, tRes, bRes, pRes, uRes, auRes] = await Promise.all([
      supabase.from("coaches").select("*").order("id"),
      supabase.from("courses").select("*").order("id"),
      supabase.from("activities").select("*").order("id"),
      supabase.from("tables").select("*").order("id"),
      supabase.from("bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
      supabase.from("users").select("*").limit(1).single(),
      supabase.from("users").select("*").order("id"),
    ]);
    if (cRes.data) setCoaches(cRes.data.map(mapCoach));
    if (crRes.data) setCourses(crRes.data.map(mapCourse));
    if (aRes.data) setActivities(aRes.data.map(mapActivity));
    if (tRes.data) setTables(tRes.data.map(mapTable));
    if (bRes.data) setBookings(bRes.data.map(mapBooking));
    if (pRes.data) setPosts(pRes.data.map(mapPost));
    if (auRes.data) setAllUsers(auRes.data.map(mapUser));
    if (uRes.data) {
      setUserId(uRes.data.id);
      setUserNameState(uRes.data.nickname);
      setUserAvatarState(uRes.data.avatar_url);
      setUserAvatarColor(uRes.data.avatar_color || "#6C5CE7");
      setCoinsState(uRes.data.coins);
    }
    if (uRes.data) {
      const [cardRes, txRes] = await Promise.all([
        supabase.from("course_cards").select("*").eq("user_id", uRes.data.id).order("id"),
        supabase.from("transactions").select("*").eq("user_id", uRes.data.id).order("created_at", { ascending: false }),
      ]);
      if (cardRes.data) setCourseCards(cardRes.data.map(mapCard));
      if (txRes.data) setHistory(txRes.data.map(mapTx));
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Refresh helpers
  const refetchCoaches = async () => { const { data } = await supabase.from("coaches").select("*").order("id"); if (data) setCoaches(data.map(mapCoach)); };
  const refetchCourses = async () => { const { data } = await supabase.from("courses").select("*").order("id"); if (data) setCourses(data.map(mapCourse)); };
  const refetchActivities = async () => { const { data } = await supabase.from("activities").select("*").order("id"); if (data) setActivities(data.map(mapActivity)); };
  const refetchTables = async () => { const { data } = await supabase.from("tables").select("*").order("id"); if (data) setTables(data.map(mapTable)); };
  const refetchBookings = async () => { const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }); if (data) setBookings(data.map(mapBooking)); };
  const refetchPosts = async () => { const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false }); if (data) setPosts(data.map(mapPost)); };
  const refetchUsers = async () => { const { data } = await supabase.from("users").select("*").order("id"); if (data) setAllUsers(data.map(mapUser)); };
  const refetchUser = async () => {
    if (!userId) return;
    const { data } = await supabase.from("users").select("*").eq("id", userId).single();
    if (data) { setCoinsState(data.coins); setUserNameState(data.nickname); setUserAvatarState(data.avatar_url); setUserAvatarColor(data.avatar_color || "#6C5CE7"); }
    const { data: cards } = await supabase.from("course_cards").select("*").eq("user_id", userId).order("id");
    if (cards) setCourseCards(cards.map(mapCard));
    const { data: txs } = await supabase.from("transactions").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (txs) setHistory(txs.map(mapTx));
  };

  // ---- HELPERS ----
  const addTx = async (desc, amount, type = "coin", uid = null) => {
    await supabase.from("transactions").insert({ user_id: uid || userId, description: desc, amount, type });
  };

  const spendCoins = async (amt, desc) => {
    if (coins < amt) {
      setResultModal({ type: "fail", title: "余额不足", msg: `需要 ${amt} Coin，当前余额 ${coins} Coin` });
      return false;
    }
    await supabase.from("users").update({ coins: coins - amt }).eq("id", userId);
    await addTx(desc, -amt, "coin");
    setCoinsState(c => c - amt);
    return true;
  };

  // ---- USER ACTIONS ----
  const bookCoachCoin = useCallback(async (coach, selectedSlots, dateLabel) => {
    const dur = slotsDuration(selectedSlots);
    const cost = Math.round(coach.price * dur);
    const range = slotsRange(selectedSlots);
    const desc = `预约 ${coach.name} ${dateLabel} ${range} (${dur}h)`;
    const ok = await spendCoins(cost, desc);
    if (ok) {
      await supabase.from("bookings").insert({ user_id: userId, user_name: userName, type: "教练预约", target_id: coach.id, target_name: coach.name, detail: `${coach.name} ${dateLabel} ${range}`, date: dateLabel, time_slots: selectedSlots, duration: dur, payment_method: "coin", amount: cost, status: "待确认" });
      setResultModal({ type: "success", title: "操作成功", msg: `${desc}，花费 ${cost} Coin` });
      await refetchBookings();
      await refetchUser();
    }
  }, [userId, userName, coins]);

  const bookCoachCard = useCallback(async (coach, selectedSlots, dateLabel, cardId) => {
    const dur = slotsDuration(selectedSlots);
    const deduct = dur;
    const range = slotsRange(selectedSlots);
    const card = courseCards.find(c => c.id === cardId);
    if (!card || card.remaining < deduct) {
      setResultModal({ type: "fail", title: "课程卡不足", msg: `需要 ${deduct} 次，当前剩余 ${card?.remaining || 0} 次` });
      return;
    }
    await supabase.from("course_cards").update({ remaining_lessons: card.remaining - deduct }).eq("id", cardId);
    await addTx(`预约 ${coach.name}（课程卡: ${card.name}，${deduct}次）`, -deduct, "course_card");
    await supabase.from("bookings").insert({ user_id: userId, user_name: userName, type: "教练预约", target_id: coach.id, target_name: coach.name, detail: `${coach.name} ${dateLabel} ${range}`, date: dateLabel, time_slots: selectedSlots, duration: dur, payment_method: "course_card", amount: 0, card_id: cardId, card_deduct: deduct, status: "待确认" });
    setResultModal({ type: "success", title: "操作成功", msg: `已用课程卡预约 ${coach.name} ${dateLabel} ${range} (${dur}h)` });
    await refetchBookings();
    await refetchUser();
  }, [userId, userName, courseCards]);

  const buyCourse = useCallback(async (course) => {
    const ok = await spendCoins(course.price, `购买课程: ${course.title}`);
    if (ok) {
      await supabase.from("courses").update({ enrolled: course.enrolled + 1 }).eq("id", course.id);
      const cn = chinaDate();
      await supabase.from("course_cards").insert({ user_id: userId, course_id: course.id, course_name: course.title, total_lessons: course.lessons, remaining_lessons: course.lessons, purchase_date: `${cn.getMonth() + 1}/${cn.getDate()}` });
      setResultModal({ type: "success", title: "购买成功", msg: `已购买 ${course.title}，获得 ${course.lessons} 课时` });
      await refetchCourses();
      await refetchUser();
    }
  }, [userId, coins]);

  const joinActivity = useCallback(async (activity) => {
    const ok = await spendCoins(activity.cost, `报名: ${activity.title}`);
    if (ok) {
      const newEnrolled = [...activity.enrolledUsers, { name: userName }];
      await supabase.from("activities").update({ enrolled_users: newEnrolled }).eq("id", activity.id);
      setJoinedIds(p => [...p, activity.id]);
      setResultModal({ type: "success", title: "报名成功", msg: `已报名 ${activity.title}` });
      await refetchActivities();
      await refetchUser();
    }
  }, [userId, userName, coins]);

  const bookTable = useCallback(async (selectedSlots, dateKey) => {
    // No longer tied to a specific table — just reserves a generic slot
    const dur = slotsDuration(selectedSlots);
    const avgPrice = tables.length > 0 ? Math.round(tables.reduce((s, t) => s + t.pricePerHour, 0) / tables.length) : 15;
    const cost = Math.round(avgPrice * dur);
    const range = slotsRange(selectedSlots);
    const desc = `租球台 ${dateKey} ${range} (${dur}h)`;
    const ok = await spendCoins(cost, desc);
    if (ok) {
      await supabase.from("bookings").insert({ user_id: userId, user_name: userName, type: "球台预约", target_id: null, target_name: "球台", detail: `球台 ${dateKey} ${range}`, date: dateKey, time_slots: selectedSlots, duration: dur, payment_method: "coin", amount: cost, status: "待确认" });
      setResultModal({ type: "success", title: "操作成功", msg: `${desc}，花费 ${cost} Coin` });
      await refetchBookings();
      await refetchUser();
    }
  }, [userId, userName, coins, tables]);

  const cancelBooking = useCallback(async (bookingId) => {
    const b = bookings.find(x => x.id === bookingId);
    if (!b || b.status === "已取消") return;
    const fullRefund = true;
    const rate = fullRefund ? 1.0 : 0.5;
    if (b.payMethod === "Coin" && b.cost > 0) {
      const refund = Math.round(b.cost * rate);
      await supabase.from("users").update({ coins: coins + refund }).eq("id", userId);
      await addTx(`取消退款: ${b.detail}${fullRefund ? " (全额)" : " (50%)"}`, refund, "coin");
    } else if (b.payMethod === "课程卡" && b.cardId && b.cardDeduct) {
      const refund = b.cardDeduct * rate;
      const card = courseCards.find(c => c.id === b.cardId);
      if (card) await supabase.from("course_cards").update({ remaining_lessons: card.remaining + refund }).eq("id", b.cardId);
      await addTx(`取消退还课程卡: ${b.detail}`, refund, "course_card");
    }
    const refundAmt = b.payMethod === "Coin" ? Math.round(b.cost * rate) : b.cardDeduct * rate;
    await supabase.from("bookings").update({ status: "已取消", refunded: true, refund_amount: refundAmt, cancelled_at: new Date().toISOString() }).eq("id", bookingId);
    await refetchBookings();
    await refetchUser();
  }, [bookings, coins, courseCards, userId]);

  const recharge = useCallback(async () => {
    await supabase.from("users").update({ coins: coins + 100 }).eq("id", userId);
    await addTx("充值", 100, "coin");
    setCoinsState(c => c + 100);
    setResultModal({ type: "success", title: "充值成功", msg: "已充值 100 Coin" });
    await refetchUser();
  }, [userId, coins]);

  const transfer = useCallback(async (toUser, amount) => {
    if (coins < amount) { setResultModal({ type: "fail", title: "余额不足", msg: `需要 ${amount} Coin` }); return; }
    await supabase.from("users").update({ coins: coins - amount }).eq("id", userId);
    await addTx(`转让给 ${toUser}`, -amount, "coin");
    setCoinsState(c => c - amount);
    setResultModal({ type: "success", title: "转让成功", msg: `已向 ${toUser} 转让 ${amount} Coin` });
    await refetchUser();
  }, [userId, coins]);

  // ---- ADMIN ACTIONS ----
  const approveBooking = useCallback(async (id) => {
    await supabase.from("bookings").update({ status: "已确认" }).eq("id", id);
    await refetchBookings();
  }, []);

  const rejectBooking = useCallback(async (id) => {
    const b = bookings.find(x => x.id === id);
    if (!b) return;
    const targetUserId = b.userId || userId;
    if (b.payMethod === "Coin" && b.cost > 0) {
      const { data: u } = await supabase.from("users").select("coins").eq("id", targetUserId).single();
      if (u) await supabase.from("users").update({ coins: u.coins + b.cost }).eq("id", targetUserId);
      await addTx(`退款: ${b.detail}`, b.cost, "coin", targetUserId);
    } else if (b.payMethod === "课程卡" && b.cardId && b.cardDeduct) {
      const { data: c } = await supabase.from("course_cards").select("remaining_lessons").eq("id", b.cardId).single();
      if (c) await supabase.from("course_cards").update({ remaining_lessons: Number(c.remaining_lessons) + b.cardDeduct }).eq("id", b.cardId);
      await addTx(`退还课程卡: ${b.detail}`, b.cardDeduct, "course_card", targetUserId);
    }
    await supabase.from("bookings").update({ status: "已拒绝", refunded: true }).eq("id", id);
    await refetchBookings();
    await refetchUser();
    await refetchUsers();
  }, [bookings, userId]);

  const distributeReward = useCallback(async (activityId, rankAssignments) => {
    await supabase.from("activities").update({ reward_distributed: true }).eq("id", activityId);
    for (const r of rankAssignments) {
      if (r.userName === userName) {
        await supabase.from("users").update({ coins: coins + r.amount }).eq("id", userId);
        await addTx(`比赛奖励: 第${r.rank}名`, r.amount, "coin");
      }
    }
    await refetchActivities();
    await refetchUser();
  }, [userId, userName, coins]);

  // Community
  const addPost = useCallback(async (content) => {
    await supabase.from("posts").insert({ user_id: userId, user_name: userName, user_avatar: "🙋", content, type: "动态" });
    await refetchPosts();
  }, [userId, userName]);

  const likePost = useCallback(async (id) => {
    const p = posts.find(x => x.id === id);
    if (p) await supabase.from("posts").update({ likes: p.likes + 1 }).eq("id", id);
    await refetchPosts();
  }, [posts]);

  const votePost = useCallback(async (id, vote) => {
    const p = posts.find(x => x.id === id);
    if (!p) return;
    const upd = vote === "yes" ? { vote_yes: p.voteYes + 1 } : { vote_no: p.voteNo + 1 };
    await supabase.from("posts").update(upd).eq("id", id);
    setPosts(ps => ps.map(x => x.id === id ? { ...x, voted: vote, voteYes: x.voteYes + (vote === "yes" ? 1 : 0), voteNo: x.voteNo + (vote === "no" ? 1 : 0) } : x));
  }, [posts]);

  // Profile
  const setUserName = useCallback(async (name) => {
    setUserNameState(name);
    if (userId) await supabase.from("users").update({ nickname: name }).eq("id", userId);
  }, [userId]);

  const setUserAvatar = useCallback(async (url) => {
    setUserAvatarState(url);
    if (userId) await supabase.from("users").update({ avatar_url: url }).eq("id", userId);
  }, [userId]);

  const randomizeAvatar = useCallback(async () => {
    const c = randomAvatarColor();
    setUserAvatarState(null);
    setUserAvatarColor(c);
    if (userId) await supabase.from("users").update({ avatar_url: null, avatar_color: c }).eq("id", userId);
  }, [userId]);

  // ---- ADMIN CRUD (Coaches) ----
  const adminSaveCoach = useCallback(async (item) => {
    const row = { name: item.name, level: item.level, specialties: item.specialties, price_per_hour: item.price, avatar_url: item.avatar, available_slots: item.availableSlots, status: item.status, closed_slots: item.closedSlots || [] };
    if (item.id) await supabase.from("coaches").update(row).eq("id", item.id);
    else await supabase.from("coaches").insert(row);
    await refetchCoaches();
  }, []);
  const adminDeleteCoach = useCallback(async (id) => { await supabase.from("coaches").delete().eq("id", id); await refetchCoaches(); }, []);

  // ---- ADMIN CRUD (Courses) ----
  const adminSaveCourse = useCallback(async (item) => {
    const row = { title: item.title, description: item.desc, emoji: item.emoji, lessons: item.lessons, price: item.price, cover_url: item.coverImage, outline: item.outline || [], enrolled: item.enrolled || 0, status: item.status };
    if (item.id) await supabase.from("courses").update(row).eq("id", item.id);
    else await supabase.from("courses").insert(row);
    await refetchCourses();
  }, []);
  const adminDeleteCourse = useCallback(async (id) => { await supabase.from("courses").delete().eq("id", id); await refetchCourses(); }, []);

  // ---- ADMIN CRUD (Activities) ----
  const adminSaveActivity = useCallback(async (item) => {
    const row = { title: item.title, type: item.type, emoji: item.emoji, date: item.date, time: item.time, location: item.location, spots: item.spots, cost: item.cost, rewards: item.rewards, enrolled_users: item.enrolledUsers, reward_distributed: item.rewardDistributed, table_id: item.tableId, table_slot: item.tableSlot, status: item.status, occupied_table_count: item.occupiedTableCount || 0, occupied_time_slots: item.occupiedTimeSlots || [], min_participants: item.minParticipants || 0 };
    if (item.id) await supabase.from("activities").update(row).eq("id", item.id);
    else await supabase.from("activities").insert(row);
    await refetchActivities();
  }, []);
  const adminDeleteActivity = useCallback(async (id) => { await supabase.from("activities").delete().eq("id", id); await refetchActivities(); }, []);

  // Cancel activity & refund all enrolled users
  const adminCancelActivity = useCallback(async (activityId) => {
    const a = activities.find(x => x.id === activityId);
    if (!a) return;
    // Refund each enrolled user
    for (const eu of a.enrolledUsers) {
      const { data: u } = await supabase.from("users").select("*").eq("nickname", eu.name).single();
      if (u && a.cost > 0) {
        await supabase.from("users").update({ coins: u.coins + a.cost }).eq("id", u.id);
        await addTx(`活动取消退款: ${a.title}`, a.cost, "coin", u.id);
      }
    }
    await supabase.from("activities").update({ status: "已取消" }).eq("id", activityId);
    await refetchActivities();
    await refetchUsers();
    await refetchUser();
  }, [activities, userId]);

  // ---- ADMIN CRUD (Tables) ----
  const adminSaveTable = useCallback(async (item) => {
    const row = { name: item.name, price_per_hour: item.pricePerHour, status: item.status, closed_dates: item.closedDates || [], unavailable_slots: item.unavailableSlots || [], open_weekend_dates: item.openWeekendDates || [] };
    if (item.id) await supabase.from("tables").update(row).eq("id", item.id);
    else await supabase.from("tables").insert(row);
    await refetchTables();
  }, []);
  const adminDeleteTable = useCallback(async (id) => { await supabase.from("tables").delete().eq("id", id); await refetchTables(); }, []);
  const adminToggleTableSlot = useCallback(async (tableId, dateKey, hour) => {
    const t = tables.find(x => x.id === tableId);
    if (!t) return;
    const slot = `${hour}-${slotEnd(hour)}`;
    const ua = [...(t.unavailableSlots || [])];
    const i = ua.findIndex(s => s.dateKey === dateKey && s.hour === slot);
    if (i === -1) ua.push({ dateKey, hour: slot }); else ua.splice(i, 1);
    await supabase.from("tables").update({ unavailable_slots: ua }).eq("id", tableId);
    await refetchTables();
  }, [tables]);

  // ---- ADMIN: Open Weekend Dates (applied to all tables) ----
  const adminToggleWeekendDate = useCallback(async (dateStr) => {
    // Toggle for ALL tables
    for (const t of tables) {
      const owds = [...(t.openWeekendDates || [])];
      const i = owds.indexOf(dateStr);
      if (i === -1) owds.push(dateStr); else owds.splice(i, 1);
      await supabase.from("tables").update({ open_weekend_dates: owds }).eq("id", t.id);
    }
    await refetchTables();
  }, [tables]);

  // ---- ADMIN Posts ----
  const adminDeletePost = useCallback(async (id) => { await supabase.from("posts").delete().eq("id", id); await refetchPosts(); }, []);
  const adminPinPost = useCallback(async (id) => {
    const p = posts.find(x => x.id === id);
    if (p) await supabase.from("posts").update({ is_pinned: !p.pinned }).eq("id", id);
    await refetchPosts();
  }, [posts]);

  // ---- ADMIN: Member Management ----
  const adminUpdateUser = useCallback(async (uid, updates) => {
    await supabase.from("users").update(updates).eq("id", uid);
    await refetchUsers();
    if (uid === userId) await refetchUser();
  }, [userId]);

  const adminAdjustCoins = useCallback(async (uid, amount, reason) => {
    const u = allUsers.find(x => x.id === uid);
    if (!u) return;
    await supabase.from("users").update({ coins: u.coins + amount }).eq("id", uid);
    await addTx(`管理员调整: ${reason}`, amount, "coin", uid);
    await refetchUsers();
    if (uid === userId) await refetchUser();
  }, [allUsers, userId]);

  const adminCreateCard = useCallback(async (uid, courseId, courseName, lessons) => {
    const cn = chinaDate();
    await supabase.from("course_cards").insert({ user_id: uid, course_id: courseId, course_name: courseName, total_lessons: lessons, remaining_lessons: lessons, purchase_date: `${cn.getMonth() + 1}/${cn.getDate()}` });
    await addTx(`管理员开卡: ${courseName} ${lessons}次`, 0, "course_card", uid);
    await refetchUsers();
    if (uid === userId) await refetchUser();
  }, [userId]);

  const adminUpdateCardRemaining = useCallback(async (cardId, newRemaining) => {
    await supabase.from("course_cards").update({ remaining_lessons: newRemaining }).eq("id", cardId);
    await refetchUser();
  }, []);

  const adminGetUserCards = useCallback(async (uid) => {
    const { data } = await supabase.from("course_cards").select("*").eq("user_id", uid).order("id");
    return data ? data.map(mapCard) : [];
  }, []);

  // ---- ADMIN: Get user transactions ----
  const adminGetUserTransactions = useCallback(async (uid) => {
    const { data } = await supabase.from("transactions").select("*").eq("user_id", uid).order("created_at", { ascending: false });
    return data ? data.map(mapTx) : [];
  }, []);

  // ---- ADMIN: Create user ----
  const adminCreateUser = useCallback(async (nickname, initialCoins = 500) => {
    const color = randomAvatarColor();
    await supabase.from("users").insert({ nickname, coins: initialCoins, avatar_color: color });
    await refetchUsers();
  }, []);

  // ---- ADMIN: Proxy book coach for user ----
  const adminBookForUser = useCallback(async (targetUserId, targetUserName, coach, selectedSlots, dateLabel, payMethod, cardId) => {
    const dur = slotsDuration(selectedSlots);
    const cost = Math.round(coach.price * dur);
    const range = slotsRange(selectedSlots);
    const detail = `${coach.name} ${dateLabel} ${range}`;
    if (payMethod === "coin") {
      const { data: u } = await supabase.from("users").select("coins").eq("id", targetUserId).single();
      if (!u || u.coins < cost) return { ok: false, msg: `用户Coin不足，需${cost}，当前${u?.coins || 0}` };
      await supabase.from("users").update({ coins: u.coins - cost }).eq("id", targetUserId);
      await addTx(`管理员代约: ${detail}`, -cost, "coin", targetUserId);
    } else {
      const { data: cards } = await supabase.from("course_cards").select("*").eq("id", cardId).single();
      if (!cards || cards.remaining_lessons < dur) return { ok: false, msg: `课程卡不足，需${dur}次，剩余${cards?.remaining_lessons || 0}次` };
      await supabase.from("course_cards").update({ remaining_lessons: cards.remaining_lessons - dur }).eq("id", cardId);
      await addTx(`管理员代约(课程卡): ${detail}`, -dur, "course_card", targetUserId);
    }
    await supabase.from("bookings").insert({ user_id: targetUserId, user_name: targetUserName, type: "教练预约", target_id: coach.id, target_name: coach.name, detail, date: dateLabel, time_slots: selectedSlots, duration: dur, payment_method: payMethod === "coin" ? "coin" : "course_card", amount: payMethod === "coin" ? cost : 0, card_id: cardId || null, card_deduct: payMethod === "coin" ? 0 : dur, status: "已确认" });
    await refetchBookings();
    await refetchUsers();
    return { ok: true, msg: `已为${targetUserName}预约${detail}` };
  }, []);

  // ---- ADMIN: Proxy enroll user in activity ----
  const adminEnrollForUser = useCallback(async (targetUserId, targetUserName, activity) => {
    if (activity.enrolledUsers.some(e => e.name === targetUserName)) return { ok: false, msg: `${targetUserName}已报名该活动` };
    if (activity.enrolledUsers.length >= activity.spots) return { ok: false, msg: "名额已满" };
    if (activity.cost > 0) {
      const { data: u } = await supabase.from("users").select("coins").eq("id", targetUserId).single();
      if (!u || u.coins < activity.cost) return { ok: false, msg: `用户Coin不足，需${activity.cost}，当前${u?.coins || 0}` };
      await supabase.from("users").update({ coins: u.coins - activity.cost }).eq("id", targetUserId);
      await addTx(`管理员代报名: ${activity.title}`, -activity.cost, "coin", targetUserId);
    }
    const newEnrolled = [...activity.enrolledUsers, { name: targetUserName }];
    await supabase.from("activities").update({ enrolled_users: newEnrolled }).eq("id", activity.id);
    await refetchActivities();
    await refetchUsers();
    return { ok: true, msg: `已为${targetUserName}报名${activity.title}` };
  }, []);

  // ---- ADMIN: Update coach closed dates ----
  const adminUpdateCoachClosedDates = useCallback(async (coachId, closedDates) => {
    await supabase.from("coaches").update({ closed_dates: closedDates }).eq("id", coachId);
    await refetchCoaches();
  }, []);

  // ---- ADMIN: Update coach closed slots (per date+hour) ----
  const adminUpdateCoachClosedSlots = useCallback(async (coachId, closedSlots) => {
    await supabase.from("coaches").update({ closed_slots: closedSlots }).eq("id", coachId);
    await refetchCoaches();
  }, []);

  // ---- 16-hour cutoff: slot is not bookable if within 16h of now (China time) ----
  const isSlotPastCutoff = useCallback((dateKey, hour) => {
    const now = chinaDate();
    const [mon, day] = dateKey.split("/").map(Number);
    const [hh, mm] = hour.split(":").map(Number);
    const slotTime = new Date(now.getFullYear(), mon - 1, day, hh, mm, 0);
    const cutoff = new Date(now.getTime() + 16 * 60 * 60 * 1000);
    return slotTime <= cutoff;
  }, []);

  const value = {
    loading, coaches, courses, activities, tables, bookings, posts, allUsers,
    coins, courseCards, history, joinedIds, resultModal,
    userName, userAvatar, userAvatarColor, userId,
    openWeekendDates, getSlotOccupancy, totalTables, isCoachSlotBooked,
    setResultModal, setUserName, setUserAvatar, randomizeAvatar,
    bookCoachCoin, bookCoachCard, buyCourse, joinActivity, bookTable, cancelBooking,
    recharge, transfer, addPost, likePost, votePost,
    approveBooking, rejectBooking, distributeReward,
    adminSaveCoach, adminDeleteCoach, adminSaveCourse, adminDeleteCourse,
    adminSaveActivity, adminDeleteActivity, adminCancelActivity, adminSaveTable, adminDeleteTable,
    adminToggleTableSlot, adminToggleWeekendDate, adminDeletePost, adminPinPost,
    adminUpdateUser, adminAdjustCoins, adminCreateCard, adminUpdateCardRemaining, adminGetUserCards,
    adminGetUserTransactions, adminCreateUser, adminBookForUser, adminEnrollForUser,
    adminUpdateCoachClosedDates, adminUpdateCoachClosedSlots, isSlotPastCutoff,
    refetchAll: fetchAll, refetchUsers, refetchBookings,
    DAYS, HOURS, DEFAULT_COACH_HOURS, slotEnd, slotsRange, slotsDuration,
    formatDateLabel, getWorkdays, getNext7Days, chinaDate, COACH_PRICE: 80,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { DAYS, HOURS, DEFAULT_COACH_HOURS, slotEnd, slotsRange, slotsDuration, formatDateLabel, getWorkdays, getNext7Days, chinaDate };
