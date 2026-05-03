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

function getNext30Days() {
  const result = [];
  const now = chinaDate();
  for (let i = 0; i < 30; i++) {
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
const mapCourse = (r) => ({ id: r.id, title: r.title, desc: r.description, emoji: r.emoji, lessons: r.lessons, price: r.price, coverImage: r.cover_url, outline: r.outline || [], enrolled: r.enrolled, status: r.status, descriptionDetail: r.description_detail || '', highlights: r.highlights || [], rules: r.rules || '', coverDetailUrl: r.cover_detail_url || null });
const mapActivity = (r) => ({ id: r.id, title: r.title, type: r.type, emoji: r.emoji, date: r.date, time: r.time, location: r.location, spots: r.spots, cost: r.cost, rewards: r.rewards || [], enrolledUsers: r.enrolled_users || [], rewardDistributed: r.reward_distributed, tableId: r.table_id, tableSlot: r.table_slot, status: r.status, occupiedTableCount: r.occupied_table_count || 0, occupiedTimeSlots: r.occupied_time_slots || [], minParticipants: r.min_participants || 0 });
const mapTable = (r) => ({ id: r.id, name: r.name, pricePerHour: r.price_per_hour, status: r.status, closedDates: r.closed_dates || [], unavailableSlots: r.unavailable_slots || [], openWeekendDates: r.open_weekend_dates || [] });
const mapBooking = (r) => ({ id: r.id, userId: r.user_id, user: r.user_name, type: r.type, targetId: r.target_id, targetName: r.target_name, detail: r.detail, date: r.date, slots: r.time_slots || [], duration: Number(r.duration), payMethod: r.payment_method === "course_card" ? "课程卡" : "微信支付", cost: Number(r.amount), cardId: r.card_id, cardDeduct: Number(r.card_deduct || 0), status: r.status, refunded: r.refunded, refundAmount: Number(r.refund_amount || 0), cancelledAt: r.cancelled_at, createdAt: r.created_at });
const mapPost = (r) => ({ id: r.id, userId: r.user_id, user: r.user_name, avatar: r.user_avatar, time: timeSince(r.created_at), content: r.content, type: r.type, voteYes: r.vote_yes, voteNo: r.vote_no, likes: r.likes, comments: r.comments, pinned: r.is_pinned, voted: false, liked: false });
const mapCard = (r) => ({ id: r.id, userId: r.user_id, courseId: r.course_id, name: r.course_name, total: Number(r.total_lessons), remaining: Number(r.remaining_lessons), date: r.purchase_date });
const mapTx = (r) => ({ id: r.id, userId: r.user_id, desc: r.description, amount: Number(r.amount), time: timeSince(r.created_at), payType: r.type, createdAt: r.created_at });
const mapUser = (r) => ({ id: r.id, nickname: r.nickname, avatarUrl: r.avatar_url, avatarColor: r.avatar_color || "#6C5CE7", coins: r.coins, phone: r.phone || null, createdAt: r.created_at });

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

  // Current user
  const [userId, setUserId] = useState(null);
  const [userName, setUserNameState] = useState("球友");
  const [userAvatar, setUserAvatarState] = useState(null);
  const [userAvatarColor, setUserAvatarColor] = useState("#6C5CE7");
  const [userPhone, setUserPhone] = useState(null);
  const [coins, setCoinsState] = useState(0);
  const [courseCards, setCourseCards] = useState([]);
  const [history, setHistory] = useState([]);
  const [joinedIds, setJoinedIds] = useState([]);
  const [resultModal, setResultModal] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

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
    // Admin-closed tables
    let adminClosed = 0;
    const slot = `${hour}-${slotEnd(hour)}`;
    tables.forEach(t => {
      if (t.status !== '正常') return;
      if ((t.unavailableSlots || []).some(s => s.dateKey === dateKey && s.hour === slot)) adminClosed++;
    });
    // Activity occupation (absorbs admin-closed: admin may close tables FOR the activity)
    let activityOccupied = 0;
    activities.forEach(a => {
      if ((a.occupiedTimeSlots || []).includes(hour) && a.date === dateKey && a.occupiedTableCount > 0 && a.status !== "已取消") activityOccupied += a.occupiedTableCount;
    });
    // Use max to avoid double-counting admin-closed + activity overlap
    let occupied = Math.max(adminClosed, activityOccupied);
    // Coach bookings (always additive — coach uses a separate table)
    bookings.forEach(b => {
      if (b.type === "教练预约" && b.date === dateKey && b.slots?.includes(hour) && b.status !== "已取消" && b.status !== "已拒绝") occupied += 1;
    });
    // Table bookings
    bookings.forEach(b => {
      if (b.type === "球台预约" && b.date === dateKey && b.slots?.includes(hour) && b.status !== "已取消" && b.status !== "已拒绝") occupied += 1;
    });
    return { occupied, available: Math.max(0, totalTables - occupied), full: occupied >= totalTables };
  }, [bookings, activities, totalTables, tables]);

  // ---- Detailed slot status for user-side display ----
  const getSlotStatus = useCallback((dateKey, hour) => {
    // Check how many tables are admin-closed for this slot
    let adminClosed = 0;
    const slot = `${hour}-${slotEnd(hour)}`;
    tables.forEach(t => {
      if (t.status !== '正常') return;
      if ((t.unavailableSlots || []).some(s => s.dateKey === dateKey && s.hour === slot)) adminClosed++;
    });

    // Check activity occupation
    let activityOccupied = 0;
    activities.forEach(a => {
      if ((a.occupiedTimeSlots || []).includes(hour) && a.date === dateKey && a.occupiedTableCount > 0 && a.status !== '已取消') {
        activityOccupied += a.occupiedTableCount;
      }
    });

    // Check bookings
    let coachBooked = 0;
    let tableBooked = 0;
    bookings.forEach(b => {
      if (b.date !== dateKey || !b.slots?.includes(hour)) return;
      if (b.status === '已取消' || b.status === '已拒绝') return;
      if (b.type === '教练预约') coachBooked++;
      if (b.type === '球台预约') tableBooked++;
    });

    // Use max for admin-closed vs activity to avoid double-counting overlap
    const occupied = Math.max(adminClosed, activityOccupied) + coachBooked + tableBooked;
    const available = Math.max(0, totalTables - occupied);
    return { occupied, available, full: occupied >= totalTables, adminClosed, activityOccupied, coachBooked, tableBooked };
  }, [tables, bookings, activities, totalTables]);

  // ---- Coach slot occupancy: check if a coach+date+hour is already booked ----
  const isCoachSlotBooked = useCallback((coachId, dateKey, hour) => {
    return bookings.some(b => b.type === "教练预约" && b.targetId === coachId && b.date === dateKey && b.slots?.includes(hour) && b.status !== "已取消" && b.status !== "已拒绝");
  }, [bookings]);

  // ---- LOAD ALL DATA (non-user) ----
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [cRes, crRes, aRes, tRes, bRes, pRes, auRes] = await Promise.all([
      supabase.from("coaches").select("*").order("id"),
      supabase.from("courses").select("*").order("id"),
      supabase.from("activities").select("*").order("id"),
      supabase.from("tables").select("*").order("id"),
      supabase.from("bookings").select("*").order("created_at", { ascending: false }),
      supabase.from("posts").select("*").order("created_at", { ascending: false }),
      supabase.from("users").select("*").order("id"),
    ]);
    if (cRes.data) setCoaches(cRes.data.map(mapCoach));
    if (crRes.data) setCourses(crRes.data.map(mapCourse));
    if (aRes.data) setActivities(aRes.data.map(mapActivity));
    if (tRes.data) setTables(tRes.data.map(mapTable));
    if (bRes.data) setBookings(bRes.data.map(mapBooking));
    // 登录用户：加载他的点赞记录，标记 liked
    let likedIdsInit = new Set();
    if (userId) {
      const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
      if (likes) likedIdsInit = new Set(likes.map(l => l.post_id));
    }
    if (pRes.data) setPosts(pRes.data.map(r => ({ ...mapPost(r), liked: likedIdsInit.has(r.id) })));
    if (auRes.data) setAllUsers(auRes.data.map(mapUser));
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // 登录/登出时刷新点赞状态（不需要重拉所有帖子）
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!userId) {
        setPosts(ps => ps.map(p => ({ ...p, liked: false })));
        return;
      }
      const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
      if (cancelled) return;
      const likedIds = new Set((likes || []).map(l => l.post_id));
      setPosts(ps => ps.map(p => ({ ...p, liked: likedIds.has(p.id) })));
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // ---- PHONE LOGIN ----
  const loginWithPhone = useCallback(async (phone) => {
    const { data: existing } = await supabase.from("users").select("*").eq("phone", phone).single();
    let userData = existing;
    let isNewUser = false;
    if (!userData) {
      const { data: created, error } = await supabase.from("users").insert({ phone, nickname: "球友", avatar_color: randomAvatarColor(), coins: 0 }).select().single();
      if (error) return { success: false, msg: "注册失败: " + (error.message || "") };
      userData = created;
      isNewUser = true;
    }
    setUserId(userData.id);
    setUserNameState(userData.nickname || "球友");
    setUserAvatarState(userData.avatar_url || null);
    setUserAvatarColor(userData.avatar_color || "#6C5CE7");
    setUserPhone(userData.phone);
    setCoinsState(userData.coins || 0);
    setIsLoggedIn(true);
    const [cardRes, txRes] = await Promise.all([
      supabase.from("course_cards").select("*").eq("user_id", userData.id).order("id"),
      supabase.from("transactions").select("*").eq("user_id", userData.id).order("created_at", { ascending: false }),
    ]);
    if (cardRes.data) setCourseCards(cardRes.data.map(mapCard));
    if (txRes.data) setHistory(txRes.data.map(mapTx));
    return { success: true, isNewUser };
  }, []);

  const logout = useCallback(() => {
    setUserId(null); setUserNameState("球友"); setUserAvatarState(null);
    setUserAvatarColor("#6C5CE7"); setUserPhone(null); setCoinsState(0);
    setCourseCards([]); setHistory([]); setJoinedIds([]); setIsLoggedIn(false);
  }, []);

  // Login overlay: any protected action calls requireLogin(actionLabel).
  // If not logged in, shows confirm prompt and opens the LoginPage overlay.
  const [showLogin, setShowLogin] = useState(false);
  const requireLogin = useCallback((actionLabel = "使用此功能") => {
    if (userId) return true;
    const ok = window.confirm(`请先登录后再操作\n\n${actionLabel}需要登录会员账号。\n\n点击"确定"前往登录。`);
    if (ok) setShowLogin(true);
    return false;
  }, [userId]);

  // Refresh helpers
  const refetchCoaches = async () => { const { data } = await supabase.from("coaches").select("*").order("id"); if (data) setCoaches(data.map(mapCoach)); };
  const refetchCourses = async () => { const { data } = await supabase.from("courses").select("*").order("id"); if (data) setCourses(data.map(mapCourse)); };
  const refetchActivities = async () => { const { data } = await supabase.from("activities").select("*").order("id"); if (data) setActivities(data.map(mapActivity)); };
  const refetchTables = async () => { const { data } = await supabase.from("tables").select("*").order("id"); if (data) setTables(data.map(mapTable)); };
  const refetchBookings = async () => { const { data } = await supabase.from("bookings").select("*").order("created_at", { ascending: false }); if (data) setBookings(data.map(mapBooking)); };
  const refetchPosts = async () => {
    const { data } = await supabase.from("posts").select("*").order("created_at", { ascending: false });
    if (!data) return;
    let likedIds = new Set();
    if (userId) {
      const { data: likes } = await supabase.from("post_likes").select("post_id").eq("user_id", userId);
      if (likes) likedIds = new Set(likes.map(l => l.post_id));
    }
    setPosts(data.map(r => ({ ...mapPost(r), liked: likedIds.has(r.id) })));
  };
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
  const addTx = async (desc, amount, type = "wechat", uid = null) => {
    await supabase.from("transactions").insert({ user_id: uid || userId, description: desc, amount, type });
  };

  // Web version does not support real WeChat Pay (JSAPI requires mini program context).
  // Users must complete payment via the WeChat mini program.
  const simulateWechatPay = (amount, desc) => {
    return new Promise((resolve) => {
      window.alert(`网页版暂不支持在线支付\n\n请使用"DC乒乓"微信小程序完成支付\n\n${desc}\n金额：¥${amount}`);
      resolve(false);
    });
  };

  // 内容安全检测 — 调用 Supabase Edge Function (content-check)，走微信官方 msg_sec_check
  // 网页版没有 openid，Edge Function 会自动降级为 version=1 旧版文本检测
  // scene: 1=资料 2=评论 3=论坛 4=社交日志
  const checkContent = async (text, scene = 2) => {
    const content = (text || "").trim();
    if (!content) return { ok: false, msg: "内容不能为空" };
    try {
      // 10s 超时——避免审核服务慢/挂时卡死 UI
      const invoke = supabase.functions.invoke("content-check", { body: { content, scene } });
      const timeout = new Promise((_, rej) => setTimeout(() => {
        const err = new Error("checkContent timeout"); err.isTimeout = true; rej(err);
      }, 10000));
      const { data, error } = await Promise.race([invoke, timeout]);
      if (error) {
        // Edge Function 出错时 fail-open 放行（用户体验优先），日志留痕
        console.error("[checkContent] Edge Function error（fail-open 放行）:", error);
        return { ok: true, _failOpen: true };
      }
      if (data?.ok) return { ok: true };
      return { ok: false, msg: data?.msg || "内容包含违规信息，请修改后重试" };
    } catch (e) {
      // 超时/网络异常一律 fail-open 放行
      console.error("[checkContent] 请求异常（fail-open 放行）:", e);
      return { ok: true, _failOpen: true };
    }
  };

  // ---- USER ACTIONS ----
  const bookCoachWechat = useCallback(async (coach, selectedSlots, dateLabel) => {
    if (!requireLogin("预约教练")) return;
    const dur = slotsDuration(selectedSlots);
    const cost = Math.round(coach.price * dur);
    const range = slotsRange(selectedSlots);
    const desc = `预约 ${coach.name} ${dateLabel} ${range} (${dur}h)`;
    // TODO: Replace simulateWechatPay with real WeChat Pay API
    const ok = await simulateWechatPay(cost, desc);
    if (ok) {
      await supabase.from("bookings").insert({ user_id: userId, user_name: userName, type: "教练预约", target_id: coach.id, target_name: coach.name, detail: `${coach.name} ${dateLabel} ${range}`, date: dateLabel, time_slots: selectedSlots, duration: dur, payment_method: "wechat", amount: cost, status: "待确认" });
      await addTx(desc, -cost, "wechat");
      setResultModal({ type: "success", title: "支付成功", msg: `${desc}，支付 ¥${cost}` });
      await refetchBookings();
      await refetchUser();
    }
  }, [userId, userName]);

  const bookCoachCard = useCallback(async (coach, selectedSlots, dateLabel, cardId) => {
    if (!requireLogin("使用课程卡预约")) return;
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
    if (!requireLogin("购买课程")) return;
    // TODO: Replace simulateWechatPay with real WeChat Pay API
    const ok = await simulateWechatPay(course.price, `购买课程: ${course.title}`);
    if (ok) {
      await supabase.from("courses").update({ enrolled: course.enrolled + 1 }).eq("id", course.id);
      const cn = chinaDate();
      await supabase.from("course_cards").insert({ user_id: userId, course_id: course.id, course_name: course.title, total_lessons: course.lessons, remaining_lessons: course.lessons, purchase_date: `${cn.getMonth() + 1}/${cn.getDate()}` });
      await addTx(`购买课程: ${course.title}`, -course.price, "wechat");
      setResultModal({ type: "success", title: "购买成功", msg: `已购买 ${course.title}，获得 ${course.lessons} 课时（课程卡支持退款，已消耗课时按单节课价格结算）` });
      await refetchCourses();
      await refetchUser();
    }
  }, [userId]);

  const joinActivity = useCallback(async (activity) => {
    if (!requireLogin("报名活动")) return;
    // TODO: Replace simulateWechatPay with real WeChat Pay API
    const ok = activity.cost > 0 ? await simulateWechatPay(activity.cost, `报名: ${activity.title}`) : true;
    if (ok) {
      if (activity.cost > 0) await addTx(`报名: ${activity.title}`, -activity.cost, "wechat");
      const newEnrolled = [...activity.enrolledUsers, { user_id: userId, name: userName, enrolled_at: new Date().toISOString(), cost: activity.cost }];
      await supabase.from("activities").update({ enrolled_users: newEnrolled }).eq("id", activity.id);
      setJoinedIds(p => [...p, activity.id]);
      setResultModal({ type: "success", title: "报名成功", msg: `已报名 ${activity.title}` });
      await refetchActivities();
      await refetchUser();
    }
  }, [userId, userName]);

  const cancelActivityEnrollment = useCallback(async (activity) => {
    const entry = activity.enrolledUsers.find(e => e.user_id === userId || e.name === userName);
    if (!entry) return;
    const entryCost = entry.cost != null ? entry.cost : activity.cost;
    let refundRate = 1.0;
    if (activity.date) {
      const now = new Date();
      const [datePart] = activity.date.split(' ');
      const [mon, day] = datePart.split('/').map(Number);
      const timeParts = (activity.time || '09:00').split(':').map(Number);
      const actDate = new Date(now.getFullYear(), mon - 1, day, timeParts[0] || 9, timeParts[1] || 0);
      const hoursUntil = (actDate - now) / (1000 * 60 * 60);
      if (hoursUntil <= 24) refundRate = 0.5;
    }
    const refundAmt = Math.round(entryCost * refundRate);
    // TODO: Replace with real WeChat refund API
    if (refundAmt > 0) {
      await addTx(`取消活动报名退款: ${activity.title}${refundRate < 1 ? ' (50%)' : ' (全额)'}`, refundAmt, "wechat_refund");
    }
    const newEnrolled = activity.enrolledUsers.filter(e => !(e.user_id === userId || e.name === userName));
    await supabase.from("activities").update({ enrolled_users: newEnrolled }).eq("id", activity.id);
    setJoinedIds(p => p.filter(id => id !== activity.id));
    setResultModal({ type: "success", title: "已取消报名", msg: `退款 ¥${refundAmt} 将原路退回${refundRate < 1 ? '（24小时内取消扣50%）' : '（全额退款）'}` });
    await refetchActivities();
    await refetchUser();
  }, [userId, userName]);

  const bookTable = useCallback(async (selectedSlots, dateKey) => {
    if (!requireLogin("预约球台")) return;
    const dur = slotsDuration(selectedSlots);
    const avgPrice = tables.length > 0 ? Math.round(tables.reduce((s, t) => s + t.pricePerHour, 0) / tables.length) : 15;
    const cost = Math.round(avgPrice * dur);
    const range = slotsRange(selectedSlots);
    const desc = `租球台 ${dateKey} ${range} (${dur}h)`;
    // TODO: Replace simulateWechatPay with real WeChat Pay API
    const ok = await simulateWechatPay(cost, desc);
    if (ok) {
      await supabase.from("bookings").insert({ user_id: userId, user_name: userName, type: "球台预约", target_id: null, target_name: "球台", detail: `球台 ${dateKey} ${range}`, date: dateKey, time_slots: selectedSlots, duration: dur, payment_method: "wechat", amount: cost, status: "待确认" });
      await addTx(desc, -cost, "wechat");
      setResultModal({ type: "success", title: "支付成功", msg: `${desc}，支付 ¥${cost}` });
      await refetchBookings();
      await refetchUser();
    }
  }, [userId, userName, tables]);

  const cancelBooking = useCallback(async (bookingId) => {
    const b = bookings.find(x => x.id === bookingId);
    if (!b || b.status === "已取消") return;
    // Determine refund rate based on 24h rule
    let rate = 1.0;
    if (b.date) {
      const now = new Date();
      const [mon, day] = b.date.split('/').map(Number);
      const firstSlot = b.slots?.[0] || '09:00';
      const [hh, mm] = firstSlot.split(':').map(Number);
      const bookDate = new Date(now.getFullYear(), mon - 1, day, hh, mm);
      if ((bookDate - now) / (1000 * 60 * 60) <= 24) rate = 0.5;
    }
    if (b.payMethod === "微信支付" && b.cost > 0) {
      const refund = Math.round(b.cost * rate);
      // TODO: Replace with real WeChat refund API
      await addTx(`取消退款(原路退回): ${b.detail}${rate < 1 ? ' (50%)' : ' (全额)'}`, refund, "wechat_refund");
    } else if (b.payMethod === "课程卡" && b.cardId && b.cardDeduct) {
      const refund = Math.round(b.cardDeduct * rate);
      const card = courseCards.find(c => c.id === b.cardId);
      if (card) await supabase.from("course_cards").update({ remaining_lessons: card.remaining + refund }).eq("id", b.cardId);
      await addTx(`取消退还课程卡: ${b.detail}`, refund, "course_card");
    }
    const refundAmt = b.payMethod === "微信支付" ? Math.round(b.cost * rate) : Math.round(b.cardDeduct * rate);
    await supabase.from("bookings").update({ status: "已取消", refunded: true, refund_amount: refundAmt, cancelled_at: new Date().toISOString() }).eq("id", bookingId);
    setResultModal({ type: "success", title: "已取消", msg: rate < 1 ? `24小时内取消，退款 ¥${refundAmt}（扣50%），原路退回` : `全额退款 ¥${refundAmt}，原路退回` });
    await refetchBookings();
    await refetchUser();
  }, [bookings, courseCards, userId]);

  // recharge and transfer removed — no longer using Coin system

  // ---- ADMIN ACTIONS ----
  const approveBooking = useCallback(async (id) => {
    await supabase.from("bookings").update({ status: "已确认" }).eq("id", id);
    await refetchBookings();
  }, []);

  // mode: 'full' (全额退款) | 'rule' (按 24h 规则) | 'none' (不退款)
  // reason: 管理员填写的原因（可空），写入 transaction 备注
  const rejectBooking = useCallback(async (id, mode = 'full', reason = '') => {
    const b = bookings.find(x => x.id === id);
    if (!b) return { ok: false, msg: "预约不存在" };
    const targetUserId = b.userId || userId;
    const reasonSuffix = reason ? `（原因：${reason}）` : '';

    // 按规则退款：24h 内取消扣 50%，否则全额
    let rate = 1.0;
    if (mode === 'rule' && b.date) {
      const now = new Date();
      const [mon, day] = b.date.split('/').map(Number);
      const firstSlot = b.slots?.[0] || '09:00';
      const [hh, mm] = firstSlot.split(':').map(Number);
      const bookDate = new Date(now.getFullYear(), mon - 1, day, hh, mm);
      if ((bookDate - now) / (1000 * 60 * 60) <= 24) rate = 0.5;
    }
    const factor = mode === 'none' ? 0 : (mode === 'rule' ? rate : 1);

    let refundAmt = 0;
    if (b.payMethod === "微信支付" && b.cost > 0) {
      refundAmt = Math.round(b.cost * factor);
      if (refundAmt > 0) {
        // TODO: Replace with real WeChat refund API
        const modeLabel = mode === 'full' ? '全额' : (mode === 'rule' && rate < 1 ? '50%（按规则）' : '全额（按规则）');
        await addTx(`管理员拒绝预约-${modeLabel}退款(原路退回): ${b.detail}${reasonSuffix}`, refundAmt, "wechat_refund", targetUserId);
      } else {
        await addTx(`管理员拒绝预约-不退款: ${b.detail}${reasonSuffix}`, 0, "wechat_refund", targetUserId);
      }
    } else if (b.payMethod === "课程卡" && b.cardId && b.cardDeduct) {
      refundAmt = Math.round(b.cardDeduct * factor);
      if (refundAmt > 0) {
        const { data: c } = await supabase.from("course_cards").select("remaining_lessons").eq("id", b.cardId).single();
        if (c) await supabase.from("course_cards").update({ remaining_lessons: Number(c.remaining_lessons) + refundAmt }).eq("id", b.cardId);
        const modeLabel = mode === 'full' ? '全额' : (mode === 'rule' && rate < 1 ? '50%（按规则）' : '全额（按规则）');
        await addTx(`管理员拒绝预约-${modeLabel}退还课程卡(${refundAmt}次): ${b.detail}${reasonSuffix}`, refundAmt, "course_card", targetUserId);
      } else {
        await addTx(`管理员拒绝预约-不退课程卡: ${b.detail}${reasonSuffix}`, 0, "course_card", targetUserId);
      }
    }

    await supabase.from("bookings").update({
      status: "已拒绝",
      refunded: refundAmt > 0,
      refund_amount: refundAmt,
      cancelled_at: new Date().toISOString(),
    }).eq("id", id);
    await refetchBookings();
    await refetchUser();
    await refetchUsers();
    return { ok: true, refundAmt, mode };
  }, [bookings, userId]);

  const distributeReward = useCallback(async (activityId, rankAssignments) => {
    await supabase.from("activities").update({ reward_distributed: true }).eq("id", activityId);
    // Rewards are now recorded as transactions only (no Coin balance changes)
    for (const r of rankAssignments) {
      if (r.userName) {
        await addTx(`比赛奖励: 第${r.rank}名 ¥${r.amount}`, r.amount, "reward");
      }
    }
    await refetchActivities();
    await refetchUser();
  }, [userId, userName]);

  // Community
  // 社区动作：返回 { ok, msg } 由调用方（社区页）自己弹窗，提示不跨页
  const addPost = useCallback(async (content) => {
    if (!requireLogin("发布动态")) return { ok: false, msg: "请先登录" };
    const check = await checkContent(content, 3); // 3=论坛
    if (!check.ok) return { ok: false, msg: check.msg };
    await supabase.from("posts").insert({ user_id: userId, user_name: userName, user_avatar: "🙋", content, type: "动态" });
    await refetchPosts();
    return { ok: true };
  }, [userId, userName, requireLogin]);

  const likePost = useCallback(async (id) => {
    if (!requireLogin("点赞")) return;
    const p = posts.find(x => x.id === id);
    if (!p) return;
    // 乐观更新：立即翻转 liked + 调整 likes 计数
    const wasLiked = !!p.liked;
    const nextLiked = !wasLiked;
    const delta = nextLiked ? 1 : -1;
    setPosts(ps => ps.map(x => x.id === id ? { ...x, liked: nextLiked, likes: Math.max(0, (x.likes || 0) + delta) } : x));
    try {
      if (wasLiked) {
        await supabase.from("post_likes").delete().eq("post_id", id).eq("user_id", userId);
        await supabase.from("posts").update({ likes: Math.max(0, (p.likes || 0) - 1) }).eq("id", id);
      } else {
        await supabase.from("post_likes").insert({ post_id: id, user_id: userId });
        await supabase.from("posts").update({ likes: (p.likes || 0) + 1 }).eq("id", id);
      }
    } catch (err) {
      console.error("[Store] likePost failed, rolling back:", err);
      setPosts(ps => ps.map(x => x.id === id ? { ...x, liked: wasLiked, likes: p.likes || 0 } : x));
      await refetchPosts();
    }
  }, [posts, userId, requireLogin]);

  const votePost = useCallback(async (id, vote) => {
    if (!requireLogin("投票")) return;
    const p = posts.find(x => x.id === id);
    if (!p) return;
    const upd = vote === "yes" ? { vote_yes: p.voteYes + 1 } : { vote_no: p.voteNo + 1 };
    await supabase.from("posts").update(upd).eq("id", id);
    setPosts(ps => ps.map(x => x.id === id ? { ...x, voted: vote, voteYes: x.voteYes + (vote === "yes" ? 1 : 0), voteNo: x.voteNo + (vote === "no" ? 1 : 0) } : x));
  }, [posts, requireLogin]);

  const editPost = useCallback(async (id, newContent) => {
    if (!requireLogin("编辑动态")) return { ok: false, msg: "请先登录" };
    const p = posts.find(x => x.id === id);
    if (!p) return { ok: false, msg: "帖子不存在" };
    if (!userId || p.userId !== userId) return { ok: false, msg: "只能编辑自己的帖子" };
    const check = await checkContent(newContent, 3);
    if (!check.ok) return { ok: false, msg: check.msg };
    await supabase.from("posts").update({ content: newContent }).eq("id", id);
    await refetchPosts();
    return { ok: true };
  }, [posts, userId, requireLogin]);

  const deletePost = useCallback(async (id) => {
    if (!requireLogin("删除动态")) return { ok: false, msg: "请先登录" };
    const p = posts.find(x => x.id === id);
    if (!p) return { ok: false, msg: "帖子不存在" };
    if (!userId || p.userId !== userId) return { ok: false, msg: "只能删除自己的帖子" };
    await supabase.from("posts").delete().eq("id", id);
    await refetchPosts();
    return { ok: true };
  }, [posts, userId, requireLogin]);

  const fetchComments = useCallback(async (postId) => {
    const { data } = await supabase.from("comments").select("*").eq("post_id", postId).order("created_at", { ascending: true });
    return data || [];
  }, []);

  const addComment = useCallback(async (postId, content) => {
    if (!requireLogin("评论")) return { ok: false, msg: "请先登录" };
    const check = await checkContent(content, 2);
    if (!check.ok) return { ok: false, msg: check.msg };
    // 乐观更新：本地 posts.comments 计数立即 +1（评论列表由调用方处理）
    setPosts(ps => ps.map(x => x.id === postId ? { ...x, comments: (x.comments || 0) + 1 } : x));
    const p = posts.find(x => x.id === postId);
    try {
      const { data: inserted } = await supabase.from("comments").insert({ post_id: postId, user_id: userId, user_name: userName, user_avatar: "🙋", content }).select().single();
      if (p) await supabase.from("posts").update({ comments: (p.comments || 0) + 1 }).eq("id", postId);
      await refetchPosts();
      return { ok: true, comment: inserted };
    } catch (err) {
      setPosts(ps => ps.map(x => x.id === postId ? { ...x, comments: Math.max(0, (x.comments || 0) - 1) } : x));
      console.error("[Store] addComment failed:", err);
      return { ok: false, msg: "评论失败，请稍后重试" };
    }
  }, [userId, userName, posts]);

  // 编辑评论：仅作者；过内容检测
  const editComment = useCallback(async (commentId, newContent) => {
    if (!requireLogin("编辑评论")) return { ok: false, msg: "请先登录" };
    const { data: c } = await supabase.from("comments").select("user_id").eq("id", commentId).single();
    if (!c) return { ok: false, msg: "评论不存在" };
    if (!userId || c.user_id !== userId) return { ok: false, msg: "只能编辑自己的评论" };
    const check = await checkContent(newContent, 2);
    if (!check.ok) return { ok: false, msg: check.msg };
    await supabase.from("comments").update({ content: newContent }).eq("id", commentId);
    return { ok: true };
  }, [userId, requireLogin]);

  // 删除评论：仅作者；帖子的 comments 计数减 1
  const deleteComment = useCallback(async (commentId, postId) => {
    if (!requireLogin("删除评论")) return { ok: false, msg: "请先登录" };
    const { data: c } = await supabase.from("comments").select("user_id").eq("id", commentId).single();
    if (!c) return { ok: false, msg: "评论不存在" };
    if (!userId || c.user_id !== userId) return { ok: false, msg: "只能删除自己的评论" };
    await supabase.from("comments").delete().eq("id", commentId);
    const p = posts.find(x => x.id === postId);
    if (p) await supabase.from("posts").update({ comments: Math.max(0, (p.comments || 0) - 1) }).eq("id", postId);
    await refetchPosts();
    return { ok: true };
  }, [userId, posts, requireLogin]);

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
    const row = {
      title: item.title, description: item.desc, emoji: item.emoji, lessons: item.lessons, price: item.price,
      cover_url: item.coverImage, outline: item.outline || [], enrolled: item.enrolled || 0, status: item.status,
      description_detail: item.descriptionDetail || '',
      highlights: item.highlights || [],
      rules: item.rules || '',
      cover_detail_url: item.coverDetailUrl || null,
    };
    if (item.id) await supabase.from("courses").update(row).eq("id", item.id);
    else await supabase.from("courses").insert(row);
    await refetchCourses();
  }, []);
  // 删除课程：先尝试硬删除；若被外键约束阻止（已有用户的课程卡引用 course_id），自动改为软删除（status='archived'）
  const adminDeleteCourse = useCallback(async (id) => {
    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) {
      // PG 外键 violation: code '23503'。其他错误也走软删除兜底，避免静默失败。
      const isFK = error.code === '23503' || /foreign key|violates|references/i.test(error.message || '');
      const { error: softErr } = await supabase.from("courses").update({ status: 'archived' }).eq("id", id);
      await refetchCourses();
      if (softErr) return { ok: false, msg: softErr.message };
      return { ok: true, soft: true, msg: isFK ? '该课程已有用户购买课程卡，无法直接删除，已改为下架（archived）' : '已改为下架（archived）' };
    }
    await refetchCourses();
    return { ok: true, soft: false };
  }, []);

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
    // Record refund transactions for each enrolled user (actual refund via WeChat Pay API)
    for (const eu of a.enrolledUsers) {
      const euCost = eu.cost != null ? eu.cost : a.cost;
      const uid = eu.user_id;
      if (uid && euCost > 0) {
        // TODO: Replace with real WeChat refund API
        await addTx(`活动取消全额退款(原路退回): ${a.title} ¥${euCost}`, euCost, "wechat_refund", uid);
      }
    }
    await supabase.from("activities").update({ status: "已取消", enrolled_users: [] }).eq("id", activityId);
    await refetchActivities();
    await refetchUsers();
    await refetchUser();
  }, [activities, userId]);

  // Admin: cancel specific user's enrollment with full refund
  const adminCancelUserEnrollment = useCallback(async (activity, targetUserId) => {
    const entry = activity.enrolledUsers.find(e => e.user_id === targetUserId);
    if (!entry) return { ok: false, msg: '该用户未报名' };
    const euCost = entry.cost != null ? entry.cost : activity.cost;
    if (euCost > 0) {
      // TODO: Replace with real WeChat refund API
      await addTx(`管理员取消报名退款(原路退回): ${activity.title}`, euCost, "wechat_refund", targetUserId);
    }
    const newEnrolled = activity.enrolledUsers.filter(e => e.user_id !== targetUserId);
    await supabase.from("activities").update({ enrolled_users: newEnrolled }).eq("id", activity.id);
    await refetchActivities();
    await refetchUsers();
    return { ok: true, msg: `已取消 ${entry.name} 的报名，退款 ¥${euCost} 原路退回` };
  }, []);

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

  // adminAdjustCoins removed — no longer using Coin system

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
  const adminCreateUser = useCallback(async (phone, nickname) => {
    if (!phone || !/^1\d{10}$/.test(phone)) return { ok: false, msg: "请输入正确的11位手机号" };
    const { data: existing } = await supabase.from("users").select("id").eq("phone", phone).single();
    if (existing) return { ok: false, msg: "该手机号已存在" };
    const color = randomAvatarColor();
    const user = { phone, nickname: nickname || "球友", avatar_color: color, coins: 0 };
    await supabase.from("users").insert(user);
    await refetchUsers();
    return { ok: true };
  }, []);

  // ---- ADMIN: Bulk create users from CSV/Excel/textarea ----
  // rows: [{ phone, nickname }] — caller is responsible for parsing the input
  // Behavior: skips rows whose phone already exists (no overwrite), skips invalid rows,
  // returns { added, skipped, failed, details: [{phone, nickname, status, msg}] }.
  const adminBulkCreateUsers = useCallback(async (rows) => {
    const result = { added: 0, skipped: 0, failed: 0, details: [] };
    if (!Array.isArray(rows) || rows.length === 0) return result;

    // 1) snapshot of existing phones (one round-trip)
    const { data: existingRows } = await supabase.from("users").select("phone");
    const existingPhones = new Set((existingRows || []).map(r => r.phone).filter(Boolean));

    // 2) within-batch dedupe (only first occurrence of a phone is processed)
    const seen = new Set();
    const toInsert = [];
    for (const raw of rows) {
      const phone = String(raw.phone || "").replace(/\D/g, "");
      const nickname = (raw.nickname || "").toString().trim() || "球友";
      if (!/^1\d{10}$/.test(phone)) {
        result.failed++;
        result.details.push({ phone: raw.phone || "", nickname, status: "failed", msg: "手机号格式错误" });
        continue;
      }
      if (existingPhones.has(phone) || seen.has(phone)) {
        result.skipped++;
        result.details.push({ phone, nickname, status: "skipped", msg: "已存在" });
        continue;
      }
      seen.add(phone);
      toInsert.push({ phone, nickname, avatar_color: randomAvatarColor(), coins: 0 });
    }

    // 3) batch insert (Supabase supports array insert)
    if (toInsert.length > 0) {
      const { error } = await supabase.from("users").insert(toInsert);
      if (error) {
        // Insert failed wholesale → report all as failed; caller decides what to do.
        result.failed += toInsert.length;
        toInsert.forEach(u => result.details.push({ phone: u.phone, nickname: u.nickname, status: "failed", msg: error.message || "数据库写入失败" }));
      } else {
        result.added += toInsert.length;
        toInsert.forEach(u => result.details.push({ phone: u.phone, nickname: u.nickname, status: "added" }));
      }
    }

    await refetchUsers();
    return result;
  }, []);

  // ---- ADMIN: Delete user and all related data ----
  const adminDeleteUser = useCallback(async (uid) => {
    await supabase.from("comments").delete().eq("user_id", uid);
    await supabase.from("posts").delete().eq("user_id", uid);
    await supabase.from("transactions").delete().eq("user_id", uid);
    await supabase.from("course_cards").delete().eq("user_id", uid);
    await supabase.from("bookings").delete().eq("user_id", uid);
    await supabase.from("users").delete().eq("id", uid);
    await refetchUsers();
    await refetchBookings();
    await refetchPosts();
  }, []);

  // ---- ADMIN: Update user phone (with uniqueness check) ----
  const adminUpdateUserPhone = useCallback(async (uid, newPhone) => {
    if (!newPhone || !/^1\d{10}$/.test(newPhone)) return { ok: false, msg: "请输入正确的11位手机号" };
    const { data: existing } = await supabase.from("users").select("id").eq("phone", newPhone).single();
    if (existing && existing.id !== uid) return { ok: false, msg: "该手机号已被其他用户占用" };
    await supabase.from("users").update({ phone: newPhone }).eq("id", uid);
    await refetchUsers();
    return { ok: true };
  }, []);

  // ---- ADMIN: Proxy book coach for user ----
  const adminBookForUser = useCallback(async (targetUserId, targetUserName, coach, selectedSlots, dateLabel, payMethod, cardId) => {
    const dur = slotsDuration(selectedSlots);
    const cost = Math.round(coach.price * dur);
    const range = slotsRange(selectedSlots);
    const detail = `${coach.name} ${dateLabel} ${range}`;
    if (payMethod === "wechat") {
      // Admin proxy: record as wechat payment (no actual charge in test phase)
      await addTx(`管理员代约: ${detail} ¥${cost}`, -cost, "wechat", targetUserId);
    } else {
      const { data: cards } = await supabase.from("course_cards").select("*").eq("id", cardId).single();
      if (!cards || cards.remaining_lessons < dur) return { ok: false, msg: `课程卡不足，需${dur}次，剩余${cards?.remaining_lessons || 0}次` };
      await supabase.from("course_cards").update({ remaining_lessons: cards.remaining_lessons - dur }).eq("id", cardId);
      await addTx(`管理员代约(课程卡): ${detail}`, -dur, "course_card", targetUserId);
    }
    await supabase.from("bookings").insert({ user_id: targetUserId, user_name: targetUserName, type: "教练预约", target_id: coach.id, target_name: coach.name, detail, date: dateLabel, time_slots: selectedSlots, duration: dur, payment_method: payMethod === "wechat" ? "wechat" : "course_card", amount: payMethod === "wechat" ? cost : 0, card_id: cardId || null, card_deduct: payMethod === "wechat" ? 0 : dur, status: "已确认" });
    await refetchBookings();
    await refetchUsers();
    return { ok: true, msg: `已为${targetUserName}预约${detail}` };
  }, []);

  // ---- ADMIN: Proxy enroll user in activity ----
  const adminEnrollForUser = useCallback(async (targetUserId, targetUserName, activity) => {
    if (activity.enrolledUsers.some(e => e.user_id === targetUserId)) return { ok: false, msg: `${targetUserName}已报名该活动` };
    if (activity.enrolledUsers.length >= activity.spots) return { ok: false, msg: "名额已满" };
    if (activity.cost > 0) {
      // Admin proxy: record as wechat payment (no actual charge in test phase)
      await addTx(`管理员代报名: ${activity.title} ¥${activity.cost}`, -activity.cost, "wechat", targetUserId);
    }
    const newEnrolled = [...activity.enrolledUsers, { user_id: targetUserId, name: targetUserName, enrolled_at: new Date().toISOString(), cost: activity.cost }];
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

  // ============================================================
  // 社区未读消息（与小程序端逻辑一致）
  // ============================================================
  const [unreadCommunity, setUnreadCommunity] = useState(0);

  const getCommunityUnreadCount = useCallback(async () => {
    if (!userId) return 0;
    try {
      const { data: u } = await supabase.from("users").select("last_community_visit").eq("id", userId).single();
      const since = (u && u.last_community_visit) || "1970-01-01T00:00:00Z";

      const [myPostsRes, myLikesRes, myCommentsRes] = await Promise.all([
        supabase.from("posts").select("id").eq("user_id", userId),
        supabase.from("post_likes").select("post_id").eq("user_id", userId),
        supabase.from("comments").select("post_id").eq("user_id", userId),
      ]);
      const myPostIds = (myPostsRes.data || []).map(r => r.id);
      const relevantPostIds = new Set([
        ...myPostIds,
        ...((myLikesRes.data || []).map(r => r.post_id)),
        ...((myCommentsRes.data || []).map(r => r.post_id)),
      ]);
      if (relevantPostIds.size === 0 && myPostIds.length === 0) return 0;

      let commentCount = 0;
      if (relevantPostIds.size > 0) {
        const { data: cmts } = await supabase
          .from("comments").select("id")
          .in("post_id", [...relevantPostIds])
          .neq("user_id", userId)
          .gt("created_at", since);
        commentCount = (cmts || []).length;
      }
      let likeCount = 0;
      if (myPostIds.length > 0) {
        const { data: lks } = await supabase
          .from("post_likes").select("id")
          .in("post_id", myPostIds)
          .neq("user_id", userId)
          .gt("created_at", since);
        likeCount = (lks || []).length;
      }
      return commentCount + likeCount;
    } catch (err) {
      console.error("[Store] getCommunityUnreadCount failed:", err);
      return 0;
    }
  }, [userId]);

  const refreshCommunityUnread = useCallback(async () => {
    if (!userId) { setUnreadCommunity(0); return 0; }
    const n = await getCommunityUnreadCount();
    setUnreadCommunity(n);
    return n;
  }, [userId, getCommunityUnreadCount]);

  const markCommunityVisited = useCallback(async () => {
    if (!userId) return;
    const now = new Date().toISOString();
    try { await supabase.from("users").update({ last_community_visit: now }).eq("id", userId); } catch (e) { /* ignore */ }
    setUnreadCommunity(0);
  }, [userId]);

  // 登录后初次拉取 + 60s 轮询 + 浏览器从后台切回前台时刷新
  useEffect(() => {
    if (!userId) { setUnreadCommunity(0); return; }
    refreshCommunityUnread();
    const timer = setInterval(() => { refreshCommunityUnread(); }, 60 * 1000);
    const onVis = () => { if (document.visibilityState === "visible") refreshCommunityUnread(); };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [userId, refreshCommunityUnread]);

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
    courseCards, history, joinedIds, resultModal, isLoggedIn, userPhone,
    userName, userAvatar, userAvatarColor, userId,
    showLogin, setShowLogin, requireLogin,
    openWeekendDates, getSlotOccupancy, getSlotStatus, totalTables, isCoachSlotBooked, setTables,
    setResultModal, setUserName, setUserAvatar, randomizeAvatar,
    loginWithPhone, logout,
    bookCoachWechat, bookCoachCard, buyCourse, joinActivity, cancelActivityEnrollment, bookTable, cancelBooking,
    addPost, editPost, deletePost, likePost, votePost, fetchComments, addComment, editComment, deleteComment,
    unreadCommunity, refreshCommunityUnread, markCommunityVisited,
    approveBooking, rejectBooking, distributeReward,
    adminSaveCoach, adminDeleteCoach, adminSaveCourse, adminDeleteCourse,
    adminSaveActivity, adminDeleteActivity, adminCancelActivity, adminCancelUserEnrollment, adminSaveTable, adminDeleteTable,
    adminToggleTableSlot, adminToggleWeekendDate, adminDeletePost, adminPinPost,
    adminUpdateUser, adminCreateCard, adminUpdateCardRemaining, adminGetUserCards,
    adminGetUserTransactions, adminCreateUser, adminBulkCreateUsers, adminDeleteUser, adminUpdateUserPhone,
    adminBookForUser, adminEnrollForUser,
    adminUpdateCoachClosedDates, adminUpdateCoachClosedSlots, isSlotPastCutoff,
    refetchAll: fetchAll, refetchUsers, refetchBookings,
    DAYS, HOURS, DEFAULT_COACH_HOURS, slotEnd, slotsRange, slotsDuration,
    formatDateLabel, getWorkdays, getNext7Days, getNext30Days, chinaDate, COACH_PRICE: 80,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { DAYS, HOURS, DEFAULT_COACH_HOURS, slotEnd, slotsRange, slotsDuration, formatDateLabel, getWorkdays, getNext7Days, getNext30Days, chinaDate };
