import { createContext, useContext, useState, useCallback } from "react";

const COACH_PRICE = 80; // per hour
const DAYS = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
// 0.5h slots: each entry is the START of a 30-min block
const HOURS = [
  "09:00", "09:30", "10:00", "10:30", "11:00", "11:30",
  "12:00", "12:30", "13:00", "13:30", "14:00", "14:30",
  "15:00", "15:30", "16:00", "16:30", "17:00", "17:30",
  "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
];
// Helper: get end time for a slot start
const slotEnd = (s) => {
  const i = HOURS.indexOf(s);
  return i >= 0 && i < HOURS.length - 1 ? HOURS[i + 1] : "21:00";
};
// Helper: format multi-slot range
const slotsRange = (slots) => {
  if (!slots || slots.length === 0) return "";
  const sorted = [...slots].sort((a, b) => HOURS.indexOf(a) - HOURS.indexOf(b));
  return `${sorted[0]}-${slotEnd(sorted[sorted.length - 1])}`;
};
const slotsDuration = (slots) => slots.length * 0.5; // hours

// Avatar colors
const AVATAR_COLORS = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7", "#DDA0DD", "#FF8C00", "#6C5CE7", "#A29BFE", "#FD79A8"];
const randomAvatarColor = () => AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

// --- Initial Data ---
const initCoaches = [
  {
    id: 1, name: "王教练", level: "国家一级", specialties: ["正手攻球", "发球技术"], price: COACH_PRICE, status: "在职", avatar: null,
    availableSlots: [{ day: "周一", hours: ["10:00", "10:30", "14:00", "14:30"] }, { day: "周三", hours: ["14:00", "14:30", "19:00", "19:30"] }, { day: "周五", hours: ["19:00", "19:30", "20:00", "20:30"] }]
  },
  {
    id: 2, name: "李教练", level: "省级专业", specialties: ["反手拧拉", "步伐训练"], price: COACH_PRICE, status: "在职", avatar: null,
    availableSlots: [{ day: "周二", hours: ["10:00", "10:30", "16:00", "16:30"] }, { day: "周四", hours: ["16:00", "16:30", "17:00", "17:30"] }, { day: "周六", hours: ["09:00", "09:30", "10:00", "10:30"] }]
  },
  {
    id: 3, name: "张教练", level: "国家二级", specialties: ["削球打法", "比赛策略"], price: COACH_PRICE, status: "在职", avatar: null,
    availableSlots: [{ day: "周一", hours: ["14:00", "14:30", "15:00", "15:30"] }, { day: "周三", hours: ["19:00", "19:30"] }, { day: "周日", hours: ["10:00", "10:30", "11:00", "11:30"] }]
  },
];

const initCourses = [
  { id: 1, title: "零基础入门课", emoji: "🌱", lessons: 8, price: 200, enrolled: 45, status: "上架", desc: "从握拍到基本功", coverImage: null, outline: ["握拍姿势与站位", "正手攻球入门", "反手推挡基础", "简单发球技术", "基本步伐移动", "正反手切换", "简单对练", "综合考核"] },
  { id: 2, title: "进阶技战术", emoji: "🔥", lessons: 12, price: 350, enrolled: 32, status: "上架", desc: "提升实战能力", coverImage: null, outline: ["正手拉弧圈球", "反手拧拉", "发球抢攻", "接发球处理", "步伐强化", "前三板战术", "相持球处理", "反手侧拧", "正手连续拉", "削球防守", "比赛心理", "实战模拟"] },
  { id: 3, title: "发球专项训练", emoji: "🎯", lessons: 6, price: 180, enrolled: 28, status: "上架", desc: "掌握8种发球变化", coverImage: null, outline: ["下旋发球", "侧旋发球", "逆旋转发球", "急长球", "短球控制", "组合变化"] },
  { id: 4, title: "高级对抗训练", emoji: "⚡", lessons: 10, price: 400, enrolled: 18, status: "上架", desc: "模拟实战对抗", coverImage: null, outline: ["弧圈对拉", "反拉反冲", "台内挑打", "中远台相持", "多球强化", "体能专项", "战术分析", "视频复盘", "模拟比赛", "赛前调整"] },
];

const initActivities = [
  { id: 1, title: "周末友谊赛", emoji: "🏆", type: "match", date: "2/22", time: "14:00", location: "A馆", spots: 16, cost: 20, rewards: [{ rank: 1, amount: 100 }, { rank: 2, amount: 50 }, { rank: 3, amount: 30 }], enrolledUsers: [{ name: "小明" }, { name: "阿飞" }, { name: "球姐" }], rewardDistributed: false, tableId: null, tableSlot: null, status: "进行中" },
  { id: 2, title: "团体训练营", emoji: "🤝", type: "group", date: "2/23", time: "10:00", location: "B馆", spots: 8, cost: 10, rewards: [], enrolledUsers: [{ name: "小明" }, { name: "阿飞" }], rewardDistributed: false, tableId: 1, tableSlot: "10:00-11:00", status: "进行中" },
  { id: 3, title: "积分挑战赛", emoji: "⚔️", type: "match", date: "3/1", time: "15:00", location: "A馆", spots: 32, cost: 30, rewards: [{ rank: 1, amount: 200 }, { rank: 2, amount: 100 }, { rank: 3, amount: 50 }], enrolledUsers: [], rewardDistributed: false, tableId: null, tableSlot: null, status: "未开始" },
  { id: 4, title: "新手交流局", emoji: "🏓", type: "group", date: "3/2", time: "09:00", location: "C馆", spots: 12, cost: 15, rewards: [], enrolledUsers: [], rewardDistributed: false, tableId: 3, tableSlot: "09:00-10:00", status: "未开始" },
];

const initTables = [
  { id: 1, name: "1号台", pricePerHour: 15, status: "正常", closedDates: [], unavailableSlots: [] },
  { id: 2, name: "2号台", pricePerHour: 15, status: "正常", closedDates: [], unavailableSlots: [] },
  { id: 3, name: "3号台", pricePerHour: 20, status: "正常", closedDates: [], unavailableSlots: [] },
  { id: 4, name: "4号台 (VIP)", pricePerHour: 30, status: "正常", closedDates: [], unavailableSlots: [] },
  { id: 5, name: "5号台", pricePerHour: 15, status: "正常", closedDates: [], unavailableSlots: [] },
];

const initBookings = [
  { id: 1, user: "小明", type: "教练预约", detail: "王教练 2/18 10:00-11:00", payMethod: "Coin", status: "待确认", date: "2/18", slots: ["10:00", "10:30"], duration: 1, cost: 80, refunded: false, cancelledAt: null },
  { id: 2, user: "阿飞", type: "球台预约", detail: "3号台 2/19 14:00-15:00", payMethod: "课程卡", status: "待确认", date: "2/19", slots: ["14:00", "14:30"], duration: 1, cost: 0, cardId: null, refunded: false, cancelledAt: null },
  { id: 3, user: "球姐", type: "教练预约", detail: "李教练 2/20 16:00-17:30", payMethod: "Coin", status: "待确认", date: "2/20", slots: ["16:00", "16:30", "17:00"], duration: 1.5, cost: 120, refunded: false, cancelledAt: null },
];

const initPosts = [
  { id: 1, user: "小明", avatar: "😎", time: "2小时前", content: "今天和王教练练了2小时正手，进步很大！", likes: 24, comments: 8, type: "动态", pinned: false },
  { id: 2, user: "阿飞", avatar: "🤠", time: "5小时前", content: "建议俱乐部周末增加一个初学者专场", likes: 45, comments: 15, type: "投票", voteYes: 38, voteNo: 7, voted: false, pinned: false },
  { id: 3, user: "球姐", avatar: "💪", time: "1天前", content: "分享一个反手拧拉的技巧：手腕要放松", likes: 67, comments: 22, type: "动态", pinned: false },
];

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [coaches, setCoaches] = useState(initCoaches);
  const [courses, setCourses] = useState(initCourses);
  const [activities, setActivities] = useState(initActivities);
  const [tables, setTables] = useState(initTables);
  const [bookings, setBookings] = useState(initBookings);
  const [posts, setPosts] = useState(initPosts);

  // User profile
  const [userName, setUserName] = useState("球友");
  const [userAvatar, setUserAvatar] = useState(null); // null = use generated
  const [userAvatarColor, setUserAvatarColor] = useState(() => randomAvatarColor());

  // User wallet
  const [coins, setCoins] = useState(500);
  const [courseCards, setCourseCards] = useState([]);
  const [history, setHistory] = useState([{ desc: "初始充值", amount: 500, time: "2/15 10:00", payType: "coin" }]);
  const [joinedIds, setJoinedIds] = useState([]);
  const [resultModal, setResultModal] = useState(null);

  const addHistory = useCallback((desc, amt, payType = "coin") => {
    setHistory(p => [{ desc, amount: amt, time: "刚刚", payType }, ...p]);
  }, []);

  // --- User actions ---
  const spend = useCallback((amt, desc, cb) => {
    if (coins >= amt) {
      setCoins(c => c - amt); addHistory(desc, -amt, "coin"); cb?.();
      setResultModal({ type: "success", title: "操作成功", msg: `${desc}，花费 ${amt} Coin` });
      return true;
    }
    setResultModal({ type: "fail", title: "余额不足", msg: `需要 ${amt} Coin，当前余额 ${coins} Coin。请先充值！` });
    return false;
  }, [coins, addHistory]);

  // Book coach with Coin (multi-slot)
  const bookCoachCoin = useCallback((coach, selectedSlots, dateLabel) => {
    const dur = slotsDuration(selectedSlots);
    const cost = Math.round(coach.price * dur);
    const range = slotsRange(selectedSlots);
    const ok = spend(cost, `预约 ${coach.name} ${dateLabel} ${range} (${dur}h)`);
    if (ok) {
      setBookings(b => [...b, { id: Date.now(), user: userName, type: "教练预约", detail: `${coach.name} ${dateLabel} ${range}`, payMethod: "Coin", status: "待确认", date: dateLabel, slots: [...selectedSlots], duration: dur, cost, refunded: false, cancelledAt: null }]);
    }
  }, [spend, userName]);

  // Book coach with course card (multi-slot)
  const bookCoachCard = useCallback((coach, selectedSlots, dateLabel, cardId) => {
    const dur = slotsDuration(selectedSlots);
    const deduct = dur; // 1h=1次, 1.5h=1.5次
    const range = slotsRange(selectedSlots);
    const card = courseCards.find(c => c.id === cardId);
    if (!card || card.remaining < deduct) {
      setResultModal({ type: "fail", title: "课程卡不足", msg: `需要 ${deduct} 次，当前剩余 ${card?.remaining || 0} 次` });
      return;
    }
    setCourseCards(cs => cs.map(c => c.id === cardId ? { ...c, remaining: c.remaining - deduct } : c));
    addHistory(`预约 ${coach.name}（课程卡: ${card.name}，${deduct}次）`, -deduct, "card");
    setBookings(b => [...b, { id: Date.now(), user: userName, type: "教练预约", detail: `${coach.name} ${dateLabel} ${range}`, payMethod: "课程卡", status: "待确认", date: dateLabel, slots: [...selectedSlots], duration: dur, cost: 0, cardId, cardDeduct: deduct, refunded: false, cancelledAt: null }]);
    setResultModal({ type: "success", title: "操作成功", msg: `已用课程卡预约 ${coach.name} ${dateLabel} ${range} (${dur}h)` });
  }, [courseCards, addHistory, userName]);

  const buyCourse = useCallback((course) => {
    spend(course.price, `购买课程: ${course.title}`, () => {
      setCourseCards(p => [...p, { id: Date.now(), name: course.title, total: course.lessons, remaining: course.lessons, date: `${new Date().getMonth() + 1}/${new Date().getDate()}` }]);
      setCourses(cs => cs.map(c => c.id === course.id ? { ...c, enrolled: c.enrolled + 1 } : c));
    });
  }, [spend]);

  const joinActivity = useCallback((activity) => {
    spend(activity.cost, `报名: ${activity.title}`, () => {
      setJoinedIds(p => [...p, activity.id]);
      setActivities(as => as.map(a => a.id === activity.id ? { ...a, enrolledUsers: [...a.enrolledUsers, { name: userName }] } : a));
    });
  }, [spend, userName]);

  // Book table with Coin (multi-slot)
  const bookTable = useCallback((table, selectedSlots, dateKey) => {
    const dur = slotsDuration(selectedSlots);
    const cost = Math.round(table.pricePerHour * dur);
    const range = slotsRange(selectedSlots);
    const ok = spend(cost, `租球台: ${table.name} ${dateKey} ${range} (${dur}h)`);
    if (ok) {
      setBookings(b => [...b, { id: Date.now(), user: userName, type: "球台预约", detail: `${table.name} ${dateKey} ${range}`, payMethod: "Coin", status: "待确认", date: dateKey, slots: [...selectedSlots], duration: dur, cost, refunded: false, cancelledAt: null }]);
    }
  }, [spend, userName]);

  // Cancel booking with refund rules
  const cancelBooking = useCallback((bookingId) => {
    setBookings(bs => bs.map(b => {
      if (b.id !== bookingId || b.status === "已取消") return b;
      // Simplified: assume >24h for demo → full refund. Could check real dates.
      const fullRefund = true; // placeholder — in real app compare dates
      const refundRate = fullRefund ? 1.0 : 0.5;
      if (b.payMethod === "Coin" && b.cost > 0) {
        const refund = Math.round(b.cost * refundRate);
        setCoins(c => c + refund);
        addHistory(`取消退款: ${b.detail}${fullRefund ? " (全额)" : " (50%)"}`, refund, "coin");
      } else if (b.payMethod === "课程卡" && b.cardId && b.cardDeduct) {
        const refund = b.cardDeduct * refundRate;
        setCourseCards(cs => cs.map(c => c.id === b.cardId ? { ...c, remaining: c.remaining + refund } : c));
        addHistory(`取消退还课程卡: ${b.detail}`, refund, "card");
      }
      return { ...b, status: "已取消", refunded: true, refundAmount: b.payMethod === "Coin" ? Math.round(b.cost * refundRate) : b.cardDeduct * refundRate, cancelledAt: "刚刚" };
    }));
  }, [addHistory]);

  const recharge = useCallback(() => {
    setCoins(c => c + 100); addHistory("充值", 100, "coin");
    setResultModal({ type: "success", title: "充值成功", msg: "已充值 100 Coin" });
  }, [addHistory]);

  const transfer = useCallback((toUser, amount) => {
    if (coins >= amount) {
      setCoins(c => c - amount); addHistory(`转让给 ${toUser}`, -amount, "coin");
      setResultModal({ type: "success", title: "转让成功", msg: `已向 ${toUser} 转让 ${amount} Coin` });
    } else {
      setResultModal({ type: "fail", title: "余额不足", msg: `需要 ${amount} Coin` });
    }
  }, [coins, addHistory]);

  // --- Admin actions ---
  const approveBooking = useCallback((id) => {
    setBookings(bs => bs.map(b => b.id === id ? { ...b, status: "已确认" } : b));
  }, []);

  const rejectBooking = useCallback((id) => {
    setBookings(bs => bs.map(b => {
      if (b.id !== id) return b;
      if (b.payMethod === "Coin" && b.cost > 0) {
        setCoins(c => c + b.cost); addHistory(`退款: ${b.detail}`, b.cost, "coin");
      } else if (b.payMethod === "课程卡" && b.cardId && b.cardDeduct) {
        setCourseCards(cs => cs.map(c => c.id === b.cardId ? { ...c, remaining: c.remaining + b.cardDeduct } : c));
        addHistory(`退还课程卡: ${b.detail}`, b.cardDeduct, "card");
      }
      return { ...b, status: "已拒绝", refunded: true };
    }));
  }, [addHistory]);

  const distributeReward = useCallback((activityId, rankAssignments) => {
    setActivities(as => as.map(a => a.id === activityId ? { ...a, rewardDistributed: true } : a));
    rankAssignments.forEach(r => {
      if (r.userName === userName) {
        setCoins(c => c + r.amount);
        addHistory(`比赛奖励: 第${r.rank}名`, r.amount, "coin");
      }
    });
  }, [addHistory, userName]);

  // Community
  const addPost = useCallback((content) => {
    setPosts(p => [{ id: Date.now(), user: userName, avatar: "🙋", time: "刚刚", content, likes: 0, comments: 0, type: "动态", pinned: false }, ...p]);
  }, [userName]);
  const likePost = useCallback((id) => {
    setPosts(ps => ps.map(p => p.id === id ? { ...p, likes: p.likes + 1 } : p));
  }, []);
  const votePost = useCallback((id, vote) => {
    setPosts(ps => ps.map(p => {
      if (p.id !== id || p.voted) return p;
      return { ...p, voted: vote, voteYes: p.voteYes + (vote === "yes" ? 1 : 0), voteNo: p.voteNo + (vote === "no" ? 1 : 0) };
    }));
  }, []);

  // Profile
  const randomizeAvatar = useCallback(() => {
    setUserAvatar(null);
    setUserAvatarColor(randomAvatarColor());
  }, []);

  const value = {
    coaches, courses, activities, tables, bookings, posts,
    coins, courseCards, history, joinedIds, resultModal,
    userName, userAvatar, userAvatarColor,
    setCoaches, setCourses, setActivities, setTables, setBookings, setPosts,
    setResultModal, setUserName, setUserAvatar, randomizeAvatar,
    bookCoachCoin, bookCoachCard, buyCourse, joinActivity, bookTable, cancelBooking,
    recharge, transfer, addPost, likePost, votePost,
    approveBooking, rejectBooking, distributeReward,
    COACH_PRICE, DAYS, HOURS, slotEnd, slotsRange, slotsDuration,
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export { COACH_PRICE, DAYS, HOURS, slotEnd, slotsRange, slotsDuration };
