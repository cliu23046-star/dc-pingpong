import { useState, useMemo } from "react";
import { useStore } from "./store.jsx";

const C = {
    primary: "#3B2D8B", primaryLight: "#5A4BAF", secondary: "#FF4081", accent: "#FF80AB",
    bg: "#F0EDF6", sidebar: "#1A1035", card: "#FFFFFF", text: "#1A1035", textLight: "#7B7394",
    success: "#10B981", warning: "#F59E0B", danger: "#EF4444", orange: "#F97316",
    gradient: "linear-gradient(135deg,#3B2D8B 0%,#5A4BAF 50%,#7C6DD8 100%)",
};

const st = {
    btn: { border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 600, fontSize: 13, cursor: "pointer", transition: "all .2s" },
    input: { border: `1px solid ${C.primary}25`, borderRadius: 8, padding: "8px 12px", fontSize: 14, outline: "none", width: "100%", fontFamily: "inherit", boxSizing: "border-box" },
    th: { padding: "10px 12px", textAlign: "left", fontSize: 13, fontWeight: 600, color: C.textLight, borderBottom: `2px solid ${C.primary}15`, whiteSpace: "nowrap" },
    td: { padding: "10px 12px", fontSize: 13, color: C.text, borderBottom: `1px solid ${C.primary}08` },
    badge: (color) => ({ display: "inline-block", background: color + "18", color, padding: "3px 10px", borderRadius: 12, fontSize: 12, fontWeight: 600 }),
};

const PBtn = ({ children, onClick, danger, secondary, small, disabled }) => <button disabled={disabled} onClick={onClick} style={{ ...st.btn, background: disabled ? "#ccc" : danger ? C.danger : secondary ? "transparent" : C.gradient, color: secondary ? C.primary : "#fff", border: secondary ? `1.5px solid ${C.primary}` : "none", padding: small ? "5px 12px" : "8px 18px", fontSize: small ? 12 : 13, opacity: disabled ? 0.6 : 1 }}>{children}</button>;

const Modal = ({ show, onClose, title, children, wide }) => { if (!show) return null; return <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 999, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={onClose}><div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, padding: 24, width: wide ? 680 : 440, maxHeight: "85vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h3 style={{ margin: 0, color: C.text, fontSize: 18 }}>{title}</h3><span onClick={onClose} style={{ fontSize: 22, cursor: "pointer", color: C.textLight }}>✕</span></div>{children}</div></div>; };

const Field = ({ label, children }) => <div style={{ marginBottom: 14 }}><label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.text, marginBottom: 4 }}>{label}</label>{children}</div>;

const ImageUpload = ({ value, onChange, round }) => {
    const hf = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => onChange(r.result); r.readAsDataURL(f); };
    const uid = "img-up-" + (round ? "r" : "c");
    return <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ width: round ? 64 : 120, height: round ? 64 : 80, borderRadius: round ? "50%" : 8, background: value ? `url(${value}) center/cover` : "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, cursor: "pointer", border: "2px dashed #aaa", overflow: "hidden", flexShrink: 0 }} onClick={() => document.getElementById(uid)?.click()}>{!value && (round ? "📷" : "🖼️")}</div>
        <div><input id={uid} type="file" accept="image/*" style={{ display: "none" }} onChange={hf} /><div style={{ fontSize: 12, color: C.textLight }}>点击上传图片</div></div>
    </div>;
};

const Spinner = () => <div style={{ textAlign: "center", padding: 60, color: C.textLight, fontSize: 16 }}>⏳ 数据加载中...</div>;

const TabBar = ({ tabs, value, onChange }) => <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>{tabs.map(t => <button key={t.id} onClick={() => onChange(t.id)} style={{ padding: "6px 16px", borderRadius: 20, border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer", background: value === t.id ? C.gradient : "#E8E5F0", color: value === t.id ? "#fff" : C.text }}>{t.label}{t.count != null && t.count > 0 ? <span style={{ background: C.secondary, color: "#fff", fontSize: 10, borderRadius: 8, padding: "1px 6px", marginLeft: 5 }}>{t.count}</span> : null}</button>)}</div>;
const NAV = [
    { id: "coach", icon: "🏓", label: "教练管理" }, { id: "course", icon: "📚", label: "课程管理" },
    { id: "activity", icon: "🎯", label: "活动管理" }, { id: "table", icon: "🏟️", label: "球台管理" },
    { id: "booking", icon: "📋", label: "预约审核" }, { id: "member", icon: "👥", label: "会员管理" },
    { id: "community", icon: "💬", label: "社区管理" },
];

// ======= COACH MANAGEMENT =======
const CoachMgmt = () => {
    const { coaches, adminSaveCoach, adminDeleteCoach, adminUpdateCoachClosedSlots, bookings, DAYS, HOURS, DEFAULT_COACH_HOURS, getNext7Days, isCoachSlotBooked, slotsRange, slotsDuration } = useStore();
    const [modal, setModal] = useState(null);
    const [saving, setSaving] = useState(false);
    const [historyCoach, setHistoryCoach] = useState(null);
    const [historyFrom, setHistoryFrom] = useState("");
    const [historyTo, setHistoryTo] = useState("");
    const [slotsCoach, setSlotsCoach] = useState(null);
    const empty = { name: "", level: "", specialties: [], price: 80, status: "在职", avatar: null, availableSlots: [], closedSlots: [] };
    const openEdit = (c) => setModal({ ...c, _specialties: c.specialties.join(",") });
    const openNew = () => setModal({ ...empty, _specialties: "" });

    const save = async () => {
        setSaving(true);
        const item = { ...modal, specialties: modal._specialties.split(",").map(x => x.trim()).filter(Boolean) };
        delete item._specialties;
        await adminSaveCoach(item);
        setSaving(false); setModal(null);
    };

    const calDays = useMemo(() => getNext7Days(), []);

    // Lesson history
    const coachLessons = useMemo(() => {
        if (!historyCoach) return [];
        return bookings.filter(b => b.type === "教练预约" && b.targetId === historyCoach.id && (b.status === "已确认" || b.status === "待确认")).filter(b => {
            if (historyFrom && b.date < historyFrom) return false;
            if (historyTo && b.date > historyTo) return false;
            return true;
        }).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    }, [historyCoach, bookings, historyFrom, historyTo]);

    const toggleClosedSlot = async (coach, dateKey, hour) => {
        const cs = [...(coach.closedSlots || [])];
        const i = cs.findIndex(s => s.dateKey === dateKey && s.hour === hour);
        if (i === -1) cs.push({ dateKey, hour }); else cs.splice(i, 1);
        await adminUpdateCoachClosedSlots(coach.id, cs);
        setSlotsCoach(c => ({ ...c, closedSlots: cs }));
    };

    const isSlotClosed = (coach, dateKey, hour) => (coach?.closedSlots || []).some(s => s.dateKey === dateKey && s.hour === hour);

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: C.text }}>🏓 教练管理</h2><PBtn onClick={openNew}>+ 添加教练</PBtn>
        </div>
        <div style={{ background: C.card, borderRadius: 12, overflow: "auto", boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead><tr><th style={st.th}>教练</th><th style={st.th}>等级</th><th style={st.th}>擅长</th><th style={st.th}>价格/时</th><th style={st.th}>状态</th><th style={st.th}>操作</th></tr></thead>
                <tbody>{coaches.map(c => <tr key={c.id}>
                    <td style={st.td}><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.avatar ? `url(${c.avatar}) center/cover` : "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, overflow: "hidden" }}>{!c.avatar && "📷"}</div>
                        <span style={{ fontWeight: 600 }}>{c.name}</span></div></td>
                    <td style={st.td}><span style={st.badge(C.primary)}>{c.level}</span></td>
                    <td style={st.td}>{c.specialties.join(", ")}</td>
                    <td style={st.td}><span style={{ color: C.secondary, fontWeight: 700 }}>{c.price} 🪙</span></td>
                    <td style={st.td}><span style={st.badge(c.status === "在职" ? C.success : C.warning)}>{c.status}</span></td>
                    <td style={st.td}><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                        <PBtn small secondary onClick={() => openEdit(c)}>编辑</PBtn>
                        <PBtn small onClick={() => setSlotsCoach(c)}>时段管理</PBtn>
                        <PBtn small onClick={() => { setHistoryCoach(c); setHistoryFrom(""); setHistoryTo(""); }}>代课记录</PBtn>
                        <PBtn small danger onClick={() => adminDeleteCoach(c.id)}>删除</PBtn>
                    </div></td>
                </tr>)}</tbody>
            </table>
        </div>

        {/* Edit coach modal */}
        <Modal show={!!modal} onClose={() => setModal(null)} title={modal?.id ? "编辑教练" : "添加教练"}>
            <Field label="头像"><ImageUpload value={modal?.avatar} onChange={v => setModal(m => ({ ...m, avatar: v }))} round /></Field>
            <Field label="姓名"><input style={st.input} value={modal?.name || ""} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} /></Field>
            <Field label="等级"><input style={st.input} value={modal?.level || ""} onChange={e => setModal(m => ({ ...m, level: e.target.value }))} /></Field>
            <Field label="擅长方向（逗号分隔）"><input style={st.input} value={modal?._specialties || ""} onChange={e => setModal(m => ({ ...m, _specialties: e.target.value }))} /></Field>
            <Field label="课时价格（每小时）"><input type="number" style={st.input} value={modal?.price || ""} onChange={e => setModal(m => ({ ...m, price: Number(e.target.value) }))} /></Field>
            <Field label="状态"><select style={st.input} value={modal?.status || "在职"} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}><option value="在职">在职</option><option value="休假">休假</option><option value="离职">离职</option></select></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}><PBtn secondary onClick={() => setModal(null)}>取消</PBtn><PBtn onClick={save} disabled={saving}>{saving ? "保存中..." : "保存"}</PBtn></div>
        </Modal>

        {/* Close-slot calendar grid modal */}
        <Modal show={!!slotsCoach} onClose={() => setSlotsCoach(null)} title={`📅 ${slotsCoach?.name || ""} — 时段管理`} wide>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: C.success + "30" }}></span>可约</span>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: C.danger + "30" }}></span>已关闭</span>
                <span style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}><span style={{ display: "inline-block", width: 14, height: 14, borderRadius: 3, background: C.primary + "30" }}></span>已被预约</span>
            </div>
            <p style={{ fontSize: 12, color: C.textLight, margin: "0 0 12px" }}>默认全时段可约（10:00-21:00），点击切换关闭/开放。已被预约的时段不可关闭。</p>
            <div style={{ overflow: "auto" }}>
                <table style={{ borderCollapse: "collapse", fontSize: 11 }}>
                    <thead><tr><th style={{ padding: "6px 8px", background: "#f8f7fc", position: "sticky", left: 0, zIndex: 1 }}>时段</th>
                        {calDays.map(d => <th key={d.dateKey} style={{ padding: "6px 10px", background: "#f8f7fc", whiteSpace: "nowrap", fontWeight: 600, fontSize: 12 }}>{d.dateKey}<br /><span style={{ fontWeight: 400, color: C.textLight }}>{d.weekday}</span></th>)}
                    </tr></thead>
                    <tbody>{DEFAULT_COACH_HOURS.map(h => <tr key={h}>
                        <td style={{ padding: "4px 8px", fontWeight: 600, background: "#fafafa", position: "sticky", left: 0, whiteSpace: "nowrap" }}>{h}</td>
                        {calDays.map(d => {
                            const booked = isCoachSlotBooked(slotsCoach?.id, d.dateKey, h);
                            const closed = isSlotClosed(slotsCoach, d.dateKey, h);
                            const bg = booked ? C.primary + "25" : closed ? C.danger + "20" : C.success + "18";
                            const color = booked ? C.primary : closed ? C.danger : C.success;
                            return <td key={d.dateKey} onClick={() => !booked && toggleClosedSlot(slotsCoach, d.dateKey, h)} style={{ padding: "4px 10px", cursor: booked ? "default" : "pointer", background: bg, border: "1px solid #f0f0f0", textAlign: "center", fontWeight: 600, color, transition: "all .15s", minWidth: 50 }}>
                                {booked ? "已约" : closed ? "关" : "开"}
                            </td>;
                        })}
                    </tr>)}</tbody>
                </table>
            </div>
        </Modal>

        {/* Lesson history modal */}
        <Modal show={!!historyCoach} onClose={() => setHistoryCoach(null)} title={`📝 ${historyCoach?.name || ""} 代课记录`} wide>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 16, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.textLight }}>日期范围:</span>
                <input style={{ ...st.input, width: 100 }} placeholder="开始 M/D" value={historyFrom} onChange={e => setHistoryFrom(e.target.value)} />
                <span style={{ color: C.textLight }}>—</span>
                <input style={{ ...st.input, width: 100 }} placeholder="结束 M/D" value={historyTo} onChange={e => setHistoryTo(e.target.value)} />
            </div>
            {coachLessons.length === 0 ? <div style={{ color: C.textLight, textAlign: "center", padding: 24 }}>暂无代课记录</div> :
                <div style={{ maxHeight: 320, overflow: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><th style={st.th}>日期</th><th style={st.th}>时段</th><th style={st.th}>学员</th><th style={st.th}>时长</th><th style={st.th}>支付方式</th></tr></thead>
                        <tbody>{coachLessons.map(b => <tr key={b.id}>
                            <td style={st.td}>{b.date}</td><td style={st.td}>{slotsRange(b.slots)}</td>
                            <td style={st.td}><span style={{ fontWeight: 600 }}>{b.user}</span></td>
                            <td style={st.td}>{b.duration}h</td><td style={st.td}>{b.payMethod}</td>
                        </tr>)}</tbody>
                    </table>
                </div>}
            <div style={{ display: "flex", gap: 16, marginTop: 16, padding: "12px 16px", background: C.primary + "08", borderRadius: 10 }}>
                <div><span style={{ fontSize: 13, color: C.textLight }}>总课程数:</span> <b style={{ color: C.primary }}>{coachLessons.length}</b></div>
                <div><span style={{ fontSize: 13, color: C.textLight }}>总课时:</span> <b style={{ color: C.primary }}>{coachLessons.reduce((s, b) => s + b.duration, 0)}h</b></div>
            </div>
        </Modal>
    </div>;
};

// ======= COURSE MANAGEMENT =======
const CourseMgmt = () => {
    const { courses, setCourses } = useStore();
    const [modal, setModal] = useState(null);
    const empty = { title: "", desc: "", lessons: 0, price: 0, enrolled: 0, status: "上架", coverImage: null, emoji: "📖", outline: [] };
    const save = () => { if (modal.id) { setCourses(d => d.map(x => x.id === modal.id ? modal : x)); } else { setCourses(d => [...d, { ...modal, id: Date.now() }]); } setModal(null); };
    const del = (id) => setCourses(d => d.filter(x => x.id !== id));

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: C.text }}>📚 课程管理</h2><PBtn onClick={() => setModal({ ...empty })}>+ 添加课程</PBtn>
        </div>
        <div style={{ background: C.card, borderRadius: 12, overflow: "auto", boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={st.th}>课程</th><th style={st.th}>课时</th><th style={st.th}>价格</th><th style={st.th}>已购</th><th style={st.th}>状态</th><th style={st.th}>操作</th></tr></thead>
                <tbody>{courses.map(c => <tr key={c.id}>
                    <td style={st.td}><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        {c.coverImage ? <img src={c.coverImage} style={{ width: 48, height: 36, borderRadius: 6, objectFit: "cover" }} /> : <span style={{ fontSize: 24 }}>{c.emoji}</span>}
                        <div><span style={{ fontWeight: 600 }}>{c.title}</span><div style={{ fontSize: 12, color: C.textLight }}>{c.desc}</div></div></div></td>
                    <td style={st.td}>{c.lessons}</td>
                    <td style={st.td}><span style={{ color: C.secondary, fontWeight: 700 }}>{c.price} 🪙</span></td>
                    <td style={st.td}>{c.enrolled}人</td>
                    <td style={st.td}><span style={st.badge(c.status === "上架" ? C.success : C.warning)}>{c.status}</span></td>
                    <td style={st.td}><div style={{ display: "flex", gap: 6 }}><PBtn small secondary onClick={() => setModal({ ...c })}>编辑</PBtn><PBtn small danger onClick={() => del(c.id)}>删除</PBtn></div></td>
                </tr>)}</tbody>
            </table>
        </div>
        <Modal show={!!modal} onClose={() => setModal(null)} title={modal?.id ? "编辑课程" : "添加课程"}>
            <Field label="封面图"><ImageUpload value={modal?.coverImage} onChange={v => setModal(m => ({ ...m, coverImage: v }))} /></Field>
            <Field label="课程名"><input style={st.input} value={modal?.title || ""} onChange={e => setModal(m => ({ ...m, title: e.target.value }))} /></Field>
            <Field label="描述"><input style={st.input} value={modal?.desc || ""} onChange={e => setModal(m => ({ ...m, desc: e.target.value }))} /></Field>
            <div style={{ display: "flex", gap: 12 }}><div style={{ flex: 1 }}><Field label="课时数"><input type="number" style={st.input} value={modal?.lessons || ""} onChange={e => setModal(m => ({ ...m, lessons: Number(e.target.value) }))} /></Field></div>
                <div style={{ flex: 1 }}><Field label="价格"><input type="number" style={st.input} value={modal?.price || ""} onChange={e => setModal(m => ({ ...m, price: Number(e.target.value) }))} /></Field></div></div>
            <Field label="状态"><select style={st.input} value={modal?.status || "上架"} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}><option value="上架">上架</option><option value="下架">下架</option></select></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}><PBtn secondary onClick={() => setModal(null)}>取消</PBtn><PBtn onClick={save}>保存</PBtn></div>
        </Modal>
    </div>;
};

// ======= ACTIVITY MANAGEMENT =======
const ActivityMgmt = () => {
    const { activities, setActivities, tables, distributeReward } = useStore();
    const [modal, setModal] = useState(null);
    const [rewardModal, setRewardModal] = useState(null);
    const [assignments, setAssignments] = useState({});
    const empty = { title: "", emoji: "🎯", type: "group", date: "", time: "", location: "", spots: 0, cost: 0, rewards: [], enrolledUsers: [], rewardDistributed: false, tableId: null, tableSlot: null, status: "未开始" };
    const save = () => { const item = { ...modal, rewards: modal._rewards || modal.rewards }; delete item._rewards; if (item.id) { setActivities(d => d.map(x => x.id === item.id ? item : x)); } else { setActivities(d => [...d, { ...item, id: Date.now() }]); } setModal(null); };
    const del = (id) => setActivities(d => d.filter(x => x.id !== id));
    const openReward = (a) => { setRewardModal(a); setAssignments({}); };
    const doDistribute = () => { const ra = rewardModal.rewards.map(r => ({ rank: r.rank, amount: r.amount, userName: assignments[r.rank] || "" })).filter(r => r.userName); distributeReward(rewardModal.id, ra); setRewardModal(null); };

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h2 style={{ margin: 0, color: C.text }}>🎯 活动管理</h2><PBtn onClick={() => setModal({ ...empty, _rewards: [] })}>+ 添加活动</PBtn></div>
        <div style={{ background: C.card, borderRadius: 12, overflow: "auto", boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                <thead><tr><th style={st.th}>活动</th><th style={st.th}>类型</th><th style={st.th}>日期</th><th style={st.th}>地点</th><th style={st.th}>名额</th><th style={st.th}>报名</th><th style={st.th}>球台</th><th style={st.th}>奖励</th><th style={st.th}>操作</th></tr></thead>
                <tbody>{activities.map(a => <tr key={a.id}>
                    <td style={st.td}><span style={{ fontWeight: 600 }}>{a.emoji} {a.title}</span></td>
                    <td style={st.td}><span style={st.badge(a.type === "match" ? C.warning : C.success)}>{a.type === "match" ? "比赛" : "团课"}</span></td>
                    <td style={st.td}>{a.date} {a.time}</td><td style={st.td}>{a.location}</td><td style={st.td}>{a.spots}</td><td style={st.td}>{a.enrolledUsers.length}人</td>
                    <td style={st.td}>{a.tableId ? tables.find(t => t.id === a.tableId)?.name || "-" : "-"}</td>
                    <td style={st.td}>{a.type === "match" && a.rewards.length > 0 ? <span style={{ color: C.warning, fontWeight: 600 }}>🏆 {a.rewards.length}档</span> : "-"}</td>
                    <td style={st.td}><div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}><PBtn small secondary onClick={() => setModal({ ...a, _rewards: [...a.rewards] })}>编辑</PBtn>{a.type === "match" && a.rewards.length > 0 && !a.rewardDistributed && <PBtn small onClick={() => openReward(a)}>发奖</PBtn>}{a.rewardDistributed && <span style={st.badge(C.success)}>已发奖</span>}<PBtn small danger onClick={() => del(a.id)}>删除</PBtn></div></td>
                </tr>)}</tbody>
            </table>
        </div>
        <Modal show={!!modal} onClose={() => setModal(null)} title={modal?.id ? "编辑活动" : "添加活动"} wide>
            <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                    <Field label="活动名"><input style={st.input} value={modal?.title || ""} onChange={e => setModal(m => ({ ...m, title: e.target.value }))} /></Field>
                    <div style={{ display: "flex", gap: 12 }}><div style={{ flex: 1 }}><Field label="类型"><select style={st.input} value={modal?.type || "group"} onChange={e => setModal(m => ({ ...m, type: e.target.value }))}><option value="group">团课</option><option value="match">比赛</option></select></Field></div><div style={{ flex: 1 }}><Field label="日期"><input style={st.input} value={modal?.date || ""} onChange={e => setModal(m => ({ ...m, date: e.target.value }))} /></Field></div></div>
                    <div style={{ display: "flex", gap: 12 }}><div style={{ flex: 1 }}><Field label="时间"><input style={st.input} value={modal?.time || ""} onChange={e => setModal(m => ({ ...m, time: e.target.value }))} /></Field></div><div style={{ flex: 1 }}><Field label="地点"><input style={st.input} value={modal?.location || ""} onChange={e => setModal(m => ({ ...m, location: e.target.value }))} /></Field></div></div>
                    <div style={{ display: "flex", gap: 12 }}><div style={{ flex: 1 }}><Field label="名额"><input type="number" style={st.input} value={modal?.spots || ""} onChange={e => setModal(m => ({ ...m, spots: Number(e.target.value) }))} /></Field></div><div style={{ flex: 1 }}><Field label="费用"><input type="number" style={st.input} value={modal?.cost || ""} onChange={e => setModal(m => ({ ...m, cost: Number(e.target.value) }))} /></Field></div></div>
                    <Field label="占用球台"><select style={st.input} value={modal?.tableId || ""} onChange={e => setModal(m => ({ ...m, tableId: Number(e.target.value) || null }))}><option value="">无</option>{tables.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>
                    {modal?.tableId && <Field label="占用时段"><input style={st.input} value={modal?.tableSlot || ""} onChange={e => setModal(m => ({ ...m, tableSlot: e.target.value }))} /></Field>}
                </div>
                {modal?.type === "match" && <div style={{ flex: 1 }}>
                    <Field label="🏆 奖励设置">{(modal?._rewards || []).map((r, i) => <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}><span style={{ fontSize: 13, fontWeight: 600, width: 40 }}>第{r.rank}名</span><input type="number" style={{ ...st.input, width: 100 }} value={r.amount} onChange={e => { const rw = [...(modal._rewards || [])]; rw[i] = { ...rw[i], amount: Number(e.target.value) }; setModal(m => ({ ...m, _rewards: rw })); }} /><span style={{ fontSize: 12, color: C.textLight }}>Coin</span><PBtn small danger onClick={() => { const rw = [...(modal._rewards || [])]; rw.splice(i, 1); setModal(m => ({ ...m, _rewards: rw })); }}>✕</PBtn></div>)}<PBtn small secondary onClick={() => { const rw = [...(modal?._rewards || [])]; rw.push({ rank: rw.length + 1, amount: 50 }); setModal(m => ({ ...m, _rewards: rw })); }}>+ 添加名次</PBtn></Field>
                    <Field label="已报名用户">{modal?.enrolledUsers?.length > 0 ? <div style={{ fontSize: 13 }}>{modal.enrolledUsers.map(u => u.name).join(", ")}</div> : <div style={{ fontSize: 13, color: C.textLight }}>暂无</div>}</Field>
                </div>}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}><PBtn secondary onClick={() => setModal(null)}>取消</PBtn><PBtn onClick={save}>保存</PBtn></div>
        </Modal>
        <Modal show={!!rewardModal} onClose={() => setRewardModal(null)} title="🏆 发放奖励">
            <p style={{ fontSize: 14, color: C.text, marginBottom: 16 }}>{rewardModal?.title}</p>
            {rewardModal?.rewards.map(r => <div key={r.rank} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}><span style={{ fontWeight: 700, width: 60 }}>第{r.rank}名</span><select style={{ ...st.input, width: 140 }} value={assignments[r.rank] || ""} onChange={e => setAssignments(a => ({ ...a, [r.rank]: e.target.value }))}><option value="">选择</option>{rewardModal.enrolledUsers.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}</select><span style={{ color: C.warning, fontWeight: 600 }}>{r.amount} 🪙</span></div>)}
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}><PBtn secondary onClick={() => setRewardModal(null)}>取消</PBtn><PBtn onClick={doDistribute}>确认发放</PBtn></div>
        </Modal>
    </div>;
};

// ======= TABLE MANAGEMENT (0.5h slots) =======
const TableMgmt = () => {
    const { tables, setTables, activities, bookings, HOURS: H, slotEnd: se } = useStore();
    const [modal, setModal] = useState(null);
    const [calDate, setCalDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() + 1); return `${d.getMonth() + 1}/${d.getDate()}`; });
    const empty = { name: "", pricePerHour: 15, status: "正常", closedDates: "", unavailableSlots: [] };
    const openEdit = (t) => setModal({ ...t, closedDates: Array.isArray(t.closedDates) ? t.closedDates.join(",") : t.closedDates || "" });
    const save = () => { const item = { ...modal, closedDates: modal.closedDates ? modal.closedDates.split(",").map(x => x.trim()).filter(Boolean) : [] }; if (item.id) { setTables(d => d.map(x => x.id === item.id ? item : x)); } else { setTables(d => [...d, { ...item, id: Date.now(), unavailableSlots: [] }]); } setModal(null); };
    const del = (id) => setTables(d => d.filter(x => x.id !== id));

    const SC = { free: C.success, private: C.primary, group: C.orange, pending: C.warning, confirmed: C.danger, unavailable: "#999", cancelled: "#ccc" };
    const SL = { free: "空闲", private: "私教", group: "团课", pending: "待确", confirmed: "已确", unavailable: "不可", cancelled: "已取消" };

    const getStatus = (tid, h) => {
        const slot = `${h}-${se(h)}`;
        const t = tables.find(x => x.id === tid);
        if (t?.unavailableSlots?.some(s => s.dateKey === calDate && s.hour === slot)) return "unavailable";
        if (activities.some(a => a.tableId === tid && a.tableSlot && a.tableSlot.includes(h))) return activities.find(a => a.tableId === tid)?.type === "group" ? "group" : "private";
        const bk = bookings.find(b => b.type === "球台预约" && b.detail.includes(t?.name) && b.date === calDate && b.slots?.includes(h) && b.status !== "已取消" && b.status !== "已拒绝");
        if (bk) return bk.status === "已确认" ? "confirmed" : "pending";
        return "free";
    };
    const toggleUn = (tid, h) => {
        const slot = `${h}-${se(h)}`;
        setTables(ts => ts.map(t => { if (t.id !== tid) return t; const ua = [...(t.unavailableSlots || [])]; const i = ua.findIndex(s => s.dateKey === calDate && s.hour === slot); if (i === -1) ua.push({ dateKey: calDate, hour: slot }); else ua.splice(i, 1); return { ...t, unavailableSlots: ua }; }));
    };

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}><h2 style={{ margin: 0, color: C.text }}>🏟️ 球台管理</h2><PBtn onClick={() => setModal({ ...empty })}>+ 添加球台</PBtn></div>
        <div style={{ background: C.card, borderRadius: 12, overflow: "auto", boxShadow: "0 2px 12px rgba(59,45,139,0.06)", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={st.th}>球台</th><th style={st.th}>价格/时</th><th style={st.th}>状态</th><th style={st.th}>操作</th></tr></thead>
                <tbody>{tables.map(t => <tr key={t.id}><td style={st.td}><span style={{ fontWeight: 600 }}>{t.name}</span></td><td style={st.td}><span style={{ color: C.secondary, fontWeight: 700 }}>{t.pricePerHour} 🪙</span></td><td style={st.td}><span style={st.badge(t.status === "正常" ? C.success : C.danger)}>{t.status}</span></td><td style={st.td}><div style={{ display: "flex", gap: 6 }}><PBtn small secondary onClick={() => openEdit(t)}>编辑</PBtn><PBtn small danger onClick={() => del(t.id)}>删除</PBtn></div></td></tr>)}</tbody>
            </table>
        </div>
        <h3 style={{ color: C.text, margin: "0 0 12px" }}>📅 日历 — {calDate} (0.5h/格)</h3>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, alignItems: "center", flexWrap: "wrap" }}>
            <input style={{ ...st.input, width: 100 }} value={calDate} onChange={e => setCalDate(e.target.value)} />
            {Object.entries(SC).filter(([k]) => k !== "cancelled").map(([k, c]) => <span key={k} style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11 }}><span style={{ width: 10, height: 10, borderRadius: 3, background: c }} />{SL[k]}</span>)}
        </div>
        <div style={{ background: C.card, borderRadius: 12, padding: 12, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr><th style={{ ...st.th, width: 70 }}>球台</th>{H.map(h => <th key={h} style={{ ...st.th, textAlign: "center", fontSize: 9, padding: 4 }}>{h}</th>)}</tr></thead>
                <tbody>{tables.map(t => <tr key={t.id}><td style={{ ...st.td, fontWeight: 600, fontSize: 11 }}>{t.name}</td>
                    {H.map(h => {
                        const s = getStatus(t.id, h); return <td key={h} style={{ ...st.td, padding: 2, textAlign: "center" }}>
                            <div onClick={() => s === "free" || s === "unavailable" ? toggleUn(t.id, h) : null} style={{ width: 36, height: 22, borderRadius: 4, background: SC[s] + "25", border: `1.5px solid ${SC[s]}`, cursor: s === "free" || s === "unavailable" ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, fontWeight: 700, color: SC[s], margin: "0 auto" }}>{SL[s]?.slice(0, 2)}</div>
                        </td>;
                    })}</tr>)}</tbody>
            </table>
        </div>
        <Modal show={!!modal} onClose={() => setModal(null)} title={modal?.id ? "编辑球台" : "添加球台"}>
            <Field label="名称"><input style={st.input} value={modal?.name || ""} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} /></Field>
            <Field label="每小时价格"><input type="number" style={st.input} value={modal?.pricePerHour || ""} onChange={e => setModal(m => ({ ...m, pricePerHour: Number(e.target.value) }))} /></Field>
            <Field label="状态"><select style={st.input} value={modal?.status || "正常"} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}><option value="正常">正常</option><option value="维修中">维修中</option><option value="关闭">关闭</option></select></Field>
            <Field label="关闭日期（逗号分隔）"><input style={st.input} value={modal?.closedDates || ""} onChange={e => setModal(m => ({ ...m, closedDates: e.target.value }))} /></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}><PBtn secondary onClick={() => setModal(null)}>取消</PBtn><PBtn onClick={save}>保存</PBtn></div>
        </Modal>
    </div>;
};

// ======= BOOKING MANAGEMENT (with filtering + proxy booking) =======
const BookingMgmt = () => {
    const { bookings, activities, coaches, allUsers, approveBooking, rejectBooking, adminBookForUser, adminEnrollForUser, adminGetUserCards, DEFAULT_COACH_HOURS, HOURS, getNext7Days, isCoachSlotBooked, slotsRange, slotsDuration } = useStore();
    const [typeTab, setTypeTab] = useState("all");
    const [statusTab, setStatusTab] = useState("all");
    const [dateFilter, setDateFilter] = useState("");
    const [proxyBook, setProxyBook] = useState(null);
    const [proxyEnroll, setProxyEnroll] = useState(null);
    const [proxyCards, setProxyCards] = useState([]);
    const [proxyMsg, setProxyMsg] = useState(null);
    const [proxySaving, setProxySaving] = useState(false);

    const typeTabs = [
        { id: "all", label: "全部", count: bookings.length },
        { id: "教练预约", label: "私教预约", count: bookings.filter(b => b.type === "教练预约").length },
        { id: "球台预约", label: "球台预约", count: bookings.filter(b => b.type === "球台预约").length },
    ];
    const statusTabs = [
        { id: "all", label: "全部" }, { id: "待确认", label: "待确认", count: bookings.filter(b => b.status === "待确认").length },
        { id: "已确认", label: "已确认" }, { id: "已取消", label: "已取消" }, { id: "已拒绝", label: "已拒绝" },
    ];

    const filtered = bookings.filter(b => {
        if (typeTab !== "all" && b.type !== typeTab) return false;
        if (statusTab !== "all" && b.status !== statusTab) return false;
        if (dateFilter && b.date !== dateFilter) return false;
        return true;
    });

    const SC = { 待确认: C.orange, 已确认: C.success, 已取消: "#999", 已拒绝: C.danger };

    const proxyDates = useMemo(() => getNext7Days(), []);

    const startProxyBook = () => setProxyBook({ step: 1, userId: null, userName: "", coach: null, date: "", slots: [], payMethod: "coin", cardId: null });
    const startProxyEnroll = () => setProxyEnroll({ step: 1, userId: null, userName: "", activity: null });

    const selectProxyUser = async (uid, forBook) => {
        const u = allUsers.find(x => x.id === Number(uid));
        if (!u) return;
        if (forBook) {
            const cards = await adminGetUserCards(u.id);
            setProxyCards(cards);
            setProxyBook(p => ({ ...p, userId: u.id, userName: u.nickname, step: 2 }));
        } else {
            setProxyEnroll(p => ({ ...p, userId: u.id, userName: u.nickname, step: 2 }));
        }
    };

    const toggleProxySlot = (h) => {
        setProxyBook(p => {
            const slots = [...p.slots];
            const i = slots.indexOf(h);
            if (i === -1) slots.push(h); else slots.splice(i, 1);
            return { ...p, slots };
        });
    };

    const doProxyBook = async () => {
        if (!proxyBook || proxyBook.slots.length === 0) return;
        setProxySaving(true);
        const result = await adminBookForUser(proxyBook.userId, proxyBook.userName, proxyBook.coach, proxyBook.slots, proxyBook.date, proxyBook.payMethod, proxyBook.cardId);
        setProxySaving(false);
        setProxyMsg(result);
        if (result.ok) setProxyBook(null);
    };

    const doProxyEnroll = async () => {
        if (!proxyEnroll?.activity) return;
        setProxySaving(true);
        const result = await adminEnrollForUser(proxyEnroll.userId, proxyEnroll.userName, proxyEnroll.activity);
        setProxySaving(false);
        setProxyMsg(result);
        if (result.ok) setProxyEnroll(null);
    };

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, color: C.text }}>📋 预约管理</h2>
            <div style={{ display: "flex", gap: 8 }}><PBtn onClick={startProxyBook}>👤 帮用户约课</PBtn><PBtn secondary onClick={startProxyEnroll}>👤 帮用户报名活动</PBtn></div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
            <div><span style={{ fontSize: 13, fontWeight: 600, color: C.textLight, marginRight: 6 }}>日期:</span><input style={{ ...st.input, width: 100 }} value={dateFilter} onChange={e => setDateFilter(e.target.value)} placeholder="如 2/22" />{dateFilter && <span onClick={() => setDateFilter("")} style={{ cursor: "pointer", marginLeft: 4, color: C.danger, fontSize: 14 }}>✕</span>}</div>
        </div>
        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: C.textLight }}>按类型筛选</div>
        <TabBar tabs={typeTabs} value={typeTab} onChange={setTypeTab} />
        <div style={{ marginBottom: 8, fontSize: 13, fontWeight: 600, color: C.textLight }}>按状态筛选</div>
        <TabBar tabs={statusTabs} value={statusTab} onChange={setStatusTab} />

        {filtered.length === 0 ? <div style={{ background: C.card, borderRadius: 12, padding: 40, textAlign: "center", color: C.textLight }}>暂无记录</div> :
            <div style={{ background: C.card, borderRadius: 12, overflow: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 800 }}>
                    <thead><tr><th style={st.th}>状态</th><th style={st.th}>类型</th><th style={st.th}>会员</th><th style={st.th}>目标</th><th style={st.th}>日期时段</th><th style={st.th}>时长</th><th style={st.th}>支付</th><th style={st.th}>金额</th><th style={st.th}>操作</th></tr></thead>
                    <tbody>{filtered.map(b => <tr key={b.id}>
                        <td style={st.td}><span style={st.badge(SC[b.status] || C.textLight)}>{b.status}{b.refunded ? " (已退)" : ""}</span></td>
                        <td style={st.td}><span style={st.badge(b.type === "教练预约" ? C.primary : C.primaryLight)}>{b.type}</span></td>
                        <td style={st.td}><span style={{ fontWeight: 600 }}>{b.user}</span></td>
                        <td style={st.td}>{b.targetName || "-"}</td>
                        <td style={st.td}><div style={{ fontSize: 12 }}>{b.detail}</div></td>
                        <td style={st.td}>{b.duration}h</td>
                        <td style={st.td}>{b.payMethod}</td>
                        <td style={st.td}><span style={{ color: C.secondary, fontWeight: 600 }}>{b.payMethod === "Coin" ? `${b.cost} 🪙` : `${b.cardDeduct} 次`}</span></td>
                        <td style={st.td}>{b.status === "待确认" ? <div style={{ display: "flex", gap: 4 }}><PBtn small onClick={() => approveBooking(b.id)}>✓</PBtn><PBtn small danger onClick={() => rejectBooking(b.id)}>✗</PBtn></div> : "-"}</td>
                    </tr>)}</tbody>
                </table>
            </div>}

        {/* Proxy book coach modal */}
        <Modal show={!!proxyBook} onClose={() => setProxyBook(null)} title="👤 帮用户约课" wide>
            {proxyBook?.step === 1 && <div>
                <Field label="选择会员"><select style={st.input} value="" onChange={e => selectProxyUser(e.target.value, true)}><option value="">请选择会员</option>{allUsers.map(u => <option key={u.id} value={u.id}>{u.nickname} ({u.coins}🪙)</option>)}</select></Field>
            </div>}
            {proxyBook?.step === 2 && <div>
                <div style={{ marginBottom: 12, fontSize: 13 }}>会员: <b>{proxyBook.userName}</b></div>
                <Field label="选择教练"><select style={st.input} value={proxyBook.coach?.id || ""} onChange={e => { const c = coaches.find(x => x.id === Number(e.target.value)); setProxyBook(p => ({ ...p, coach: c, step: c ? 3 : 2 })); }}><option value="">请选择</option>{coaches.filter(c => c.status === "在职").map(c => <option key={c.id} value={c.id}>{c.name} ({c.price}🪙/h)</option>)}</select></Field>
            </div>}
            {proxyBook?.step >= 3 && <div>
                <div style={{ marginBottom: 8, fontSize: 13 }}>会员: <b>{proxyBook.userName}</b> · 教练: <b>{proxyBook.coach?.name}</b></div>
                <Field label="选择日期">
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{proxyDates.map(d => {
                        const closed = (proxyBook.coach?.closedDates || []).includes(d.dateKey);
                        return <button key={d.dateKey} disabled={closed} onClick={() => setProxyBook(p => ({ ...p, date: d.label, slots: [] }))} style={{ padding: "6px 12px", borderRadius: 8, border: "none", cursor: closed ? "not-allowed" : "pointer", fontWeight: 600, fontSize: 12, background: proxyBook.date === d.label ? C.primary : closed ? "#eee" : "#f0f0f0", color: proxyBook.date === d.label ? "#fff" : closed ? "#ccc" : C.text, opacity: closed ? 0.5 : 1 }}>{d.label}{closed ? " 🚫" : ""}</button>;
                    })}</div>
                </Field>
                {proxyBook.date && <Field label={`选择时段 (点击多选${proxyBook.slots.length > 0 ? ` · 已选${proxyBook.slots.length}格 = ${slotsDuration(proxyBook.slots)}h` : ""})`}>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>{DEFAULT_COACH_HOURS.map(h => {
                        const booked = isCoachSlotBooked(proxyBook.coach?.id, proxyBook.date, h);
                        const selected = proxyBook.slots.includes(h);
                        return <button key={h} disabled={booked} onClick={() => toggleProxySlot(h)} style={{ padding: "4px 8px", borderRadius: 4, fontSize: 11, border: "none", cursor: booked ? "not-allowed" : "pointer", fontWeight: 600, minWidth: 44, background: selected ? C.primary + "25" : booked ? C.danger + "15" : "#f0f0f0", color: selected ? C.primary : booked ? C.danger : C.textLight }}>{h}{booked ? "✕" : ""}</button>;
                    })}</div>
                </Field>}
                <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                    <Field label="支付方式"><select style={st.input} value={proxyBook.payMethod} onChange={e => setProxyBook(p => ({ ...p, payMethod: e.target.value }))}><option value="coin">Coin</option><option value="card">课程卡</option></select></Field>
                    {proxyBook.payMethod === "card" && <Field label="选择课程卡"><select style={st.input} value={proxyBook.cardId || ""} onChange={e => setProxyBook(p => ({ ...p, cardId: Number(e.target.value) }))}><option value="">请选择</option>{proxyCards.filter(c => c.remaining > 0).map(c => <option key={c.id} value={c.id}>{c.name} (剩{c.remaining}次)</option>)}</select></Field>}
                </div>
                {proxyBook.slots.length > 0 && <div style={{ marginTop: 12, padding: "10px 14px", background: C.primary + "08", borderRadius: 10, fontSize: 13 }}>
                    确认: 为 <b>{proxyBook.userName}</b> 预约 <b>{proxyBook.coach?.name}</b> {proxyBook.date} {slotsRange(proxyBook.slots)} ({slotsDuration(proxyBook.slots)}h) · {proxyBook.payMethod === "coin" ? `${Math.round(proxyBook.coach?.price * slotsDuration(proxyBook.slots))} 🪙` : "课程卡扣次"}
                </div>}
            </div>}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <PBtn secondary onClick={() => setProxyBook(null)}>取消</PBtn>
                {proxyBook?.step >= 3 && proxyBook.slots.length > 0 && <PBtn onClick={doProxyBook} disabled={proxySaving}>{proxySaving ? "创建中..." : "确认创建预约"}</PBtn>}
            </div>
        </Modal>

        {/* Proxy enroll activity modal */}
        <Modal show={!!proxyEnroll} onClose={() => setProxyEnroll(null)} title="👤 帮用户报名活动">
            {proxyEnroll?.step === 1 && <Field label="选择会员"><select style={st.input} value="" onChange={e => selectProxyUser(e.target.value, false)}><option value="">请选择会员</option>{allUsers.map(u => <option key={u.id} value={u.id}>{u.nickname} ({u.coins}🪙)</option>)}</select></Field>}
            {proxyEnroll?.step === 2 && <div>
                <div style={{ marginBottom: 12, fontSize: 13 }}>会员: <b>{proxyEnroll.userName}</b></div>
                <Field label="选择活动">
                    {activities.filter(a => a.status !== "已取消" && a.enrolledUsers.length < a.spots).map(a => <div key={a.id} onClick={() => setProxyEnroll(p => ({ ...p, activity: a }))} style={{ padding: "10px 14px", marginBottom: 6, borderRadius: 10, cursor: "pointer", border: proxyEnroll.activity?.id === a.id ? `2px solid ${C.primary}` : "2px solid #f0f0f0", background: proxyEnroll.activity?.id === a.id ? C.primary + "08" : "#fff" }}>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{a.emoji} {a.title}</div>
                        <div style={{ fontSize: 12, color: C.textLight }}>{a.date} {a.time} · {a.enrolledUsers.length}/{a.spots}人 · {a.cost}🪙</div>
                    </div>)}
                </Field>
            </div>}
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
                <PBtn secondary onClick={() => setProxyEnroll(null)}>取消</PBtn>
                {proxyEnroll?.activity && <PBtn onClick={doProxyEnroll} disabled={proxySaving}>{proxySaving ? "报名中..." : `确认报名 (${proxyEnroll.activity.cost}🪙)`}</PBtn>}
            </div>
        </Modal>

        {/* Result message */}
        <Modal show={!!proxyMsg} onClose={() => setProxyMsg(null)} title={proxyMsg?.ok ? "✅ 成功" : "❌ 失败"}>
            <p style={{ fontSize: 14, color: proxyMsg?.ok ? C.success : C.danger }}>{proxyMsg?.msg}</p>
            <PBtn onClick={() => setProxyMsg(null)}>确定</PBtn>
        </Modal>
    </div>;
};

// ======= MEMBER MANAGEMENT (with add user + detail tabs) =======
const MemberMgmt = () => {
    const { allUsers, courses, adminUpdateUser, adminAdjustCoins, adminCreateCard, adminUpdateCardRemaining, adminGetUserCards, adminGetUserTransactions, adminCreateUser, refetchUsers } = useStore();
    const [addModal, setAddModal] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [detailTab, setDetailTab] = useState("basic");
    const [userTxs, setUserTxs] = useState([]);
    const [userCards, setUserCards] = useState([]);
    const [txLoading, setTxLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [coinAdjust, setCoinAdjust] = useState({ amount: 0, reason: "" });
    const [newCard, setNewCard] = useState(null);

    const fmtDate = (d) => { if (!d) return "-"; const dt = new Date(d); return `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2,"0")}`; };
    const fmtDateFull = (d) => { if (!d) return "-"; const dt = new Date(d); return `${dt.getFullYear()}/${dt.getMonth()+1}/${dt.getDate()}`; };

    const openUser = async (u) => {
        setSelectedUser(u);
        setDetailTab("basic");
        setCoinAdjust({ amount: 0, reason: "" });
        setNewCard(null);
        setTxLoading(true);
        const [cards, txs] = await Promise.all([adminGetUserCards(u.id), adminGetUserTransactions(u.id)]);
        setUserCards(cards);
        setUserTxs(txs);
        setTxLoading(false);
    };

    const doAdjustCoins = async () => {
        if (!coinAdjust.amount || !coinAdjust.reason) return;
        await adminAdjustCoins(selectedUser.id, coinAdjust.amount, coinAdjust.reason);
        setCoinAdjust({ amount: 0, reason: "" });
        const updated = allUsers.find(u => u.id === selectedUser.id);
        if (updated) setSelectedUser(updated);
        const txs = await adminGetUserTransactions(selectedUser.id);
        setUserTxs(txs);
    };

    const doCreateCard = async () => {
        if (!newCard?.courseId) return;
        const course = courses.find(c => c.id === newCard.courseId);
        if (!course) return;
        await adminCreateCard(selectedUser.id, course.id, course.title, course.lessons);
        setNewCard(null);
        const cards = await adminGetUserCards(selectedUser.id);
        setUserCards(cards);
    };

    const doUpdateCard = async (cardId, val) => {
        await adminUpdateCardRemaining(cardId, val);
        const cards = await adminGetUserCards(selectedUser.id);
        setUserCards(cards);
    };

    const doAddUser = async () => {
        if (!addModal?.nickname) return;
        await adminCreateUser(addModal.nickname, addModal.coins || 500);
        setAddModal(null);
    };

    const filteredUsers = useMemo(() => allUsers.filter(u => !search || u.nickname.toLowerCase().includes(search.toLowerCase())), [allUsers, search]);

    const rechargeTxs = useMemo(() => userTxs.filter(t => t.amount > 0), [userTxs]);
    const consumeTxs = useMemo(() => userTxs.filter(t => t.amount < 0), [userTxs]);

    const detailTabs = [
        { id: "basic", label: "基本信息" },
        { id: "recharge", label: `充值记录 (${rechargeTxs.length})` },
        { id: "consume", label: `消费记录 (${consumeTxs.length})` },
        { id: "cards", label: `课程卡 (${userCards.length})` },
    ];

    // Detail view
    if (selectedUser) return <div>
        <button onClick={() => setSelectedUser(null)} style={{ background: "none", border: "none", color: C.primary, fontWeight: 600, fontSize: 14, cursor: "pointer", marginBottom: 16 }}>← 返回会员列表</button>
        <div style={{ background: C.card, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(59,45,139,0.06)", marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 16, alignItems: "center", marginBottom: 16 }}>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: selectedUser.avatarUrl ? `url(${selectedUser.avatarUrl}) center/cover` : selectedUser.avatarColor || "#6C5CE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: "#fff", fontWeight: 700, flexShrink: 0 }}>{!selectedUser.avatarUrl && (selectedUser.nickname?.[0] || "?")}</div>
                <div>
                    <h3 style={{ margin: 0, color: C.text }}>{selectedUser.nickname}</h3>
                    <div style={{ fontSize: 13, color: C.textLight, marginTop: 2 }}>ID: {selectedUser.id}</div>
                    <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: C.secondary }}>🪙 {selectedUser.coins} Coin</span>
                        <span style={{ fontSize: 12, color: C.textLight }}>注册: {fmtDateFull(selectedUser.createdAt)}</span>
                    </div>
                </div>
            </div>
            <TabBar tabs={detailTabs} value={detailTab} onChange={setDetailTab} />
        </div>

        {txLoading ? <Spinner /> : <>
            {/* Basic Info Tab */}
            {detailTab === "basic" && <div style={{ background: C.card, borderRadius: 14, padding: 20, boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
                <h4 style={{ margin: "0 0 12px", color: C.text }}>💰 Coin 调整</h4>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <input type="number" style={{ ...st.input, width: 100 }} placeholder="数额" value={coinAdjust.amount || ""} onChange={e => setCoinAdjust(v => ({ ...v, amount: Number(e.target.value) }))} />
                    <input style={{ ...st.input, flex: 1, minWidth: 120 }} placeholder="原因" value={coinAdjust.reason} onChange={e => setCoinAdjust(v => ({ ...v, reason: e.target.value }))} />
                    <PBtn small onClick={doAdjustCoins}>执行调整</PBtn>
                </div>
                <p style={{ fontSize: 12, color: C.textLight, margin: "6px 0 0" }}>正数=充值，负数=扣除</p>
            </div>}

            {/* Recharge records tab */}
            {detailTab === "recharge" && <div style={{ background: C.card, borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
                {rechargeTxs.length === 0 ? <div style={{ color: C.textLight, textAlign: "center", padding: 24 }}>暂无充值记录</div> :
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={st.th}>描述</th><th style={st.th}>金额</th><th style={st.th}>类型</th><th style={st.th}>时间</th></tr></thead>
                    <tbody>{rechargeTxs.map(t => <tr key={t.id}>
                        <td style={st.td}>{t.desc}</td>
                        <td style={st.td}><span style={{ color: C.success, fontWeight: 700 }}>+{t.amount}</span></td>
                        <td style={st.td}><span style={st.badge(C.success)}>{t.payType}</span></td>
                        <td style={{ ...st.td, fontSize: 12, color: C.textLight }}>{t.time}</td>
                    </tr>)}</tbody>
                </table>}
            </div>}

            {/* Consumption records tab */}
            {detailTab === "consume" && <div style={{ background: C.card, borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
                {consumeTxs.length === 0 ? <div style={{ color: C.textLight, textAlign: "center", padding: 24 }}>暂无消费记录</div> :
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={st.th}>描述</th><th style={st.th}>金额</th><th style={st.th}>类型</th><th style={st.th}>时间</th></tr></thead>
                    <tbody>{consumeTxs.map(t => <tr key={t.id}>
                        <td style={st.td}>{t.desc}</td>
                        <td style={st.td}><span style={{ color: C.danger, fontWeight: 700 }}>{t.amount}</span></td>
                        <td style={st.td}><span style={st.badge(C.warning)}>{t.payType}</span></td>
                        <td style={{ ...st.td, fontSize: 12, color: C.textLight }}>{t.time}</td>
                    </tr>)}</tbody>
                </table>}
            </div>}

            {/* Course cards tab */}
            {detailTab === "cards" && <div style={{ background: C.card, borderRadius: 14, padding: 16, boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <h4 style={{ margin: 0, color: C.text }}>🎫 课程卡</h4>
                    <PBtn small onClick={() => setNewCard({ courseId: courses[0]?.id || null })}>+ 开新卡</PBtn>
                </div>
                {userCards.length === 0 ? <div style={{ color: C.textLight, textAlign: "center", padding: 16 }}>暂无课程卡</div> :
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead><tr><th style={st.th}>课程</th><th style={st.th}>总次数</th><th style={st.th}>剩余</th><th style={st.th}>购买日期</th><th style={st.th}>状态</th><th style={st.th}>操作</th></tr></thead>
                    <tbody>{userCards.map(c => <tr key={c.id}>
                        <td style={st.td}><span style={{ fontWeight: 600 }}>{c.name}</span></td>
                        <td style={st.td}>{c.total}</td>
                        <td style={st.td}><span style={{ color: c.remaining > 0 ? C.success : C.danger, fontWeight: 700 }}>{c.remaining}</span></td>
                        <td style={st.td}>{c.date}</td>
                        <td style={st.td}><span style={st.badge(c.remaining > 0 ? C.success : C.textLight)}>{c.remaining > 0 ? "有效" : "已用完"}</span></td>
                        <td style={st.td}><div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                            <input type="number" defaultValue={c.remaining} style={{ ...st.input, width: 50, padding: "4px 6px", fontSize: 12 }} id={`card-${c.id}`} />
                            <PBtn small onClick={() => doUpdateCard(c.id, Number(document.getElementById(`card-${c.id}`).value))}>修改</PBtn>
                        </div></td>
                    </tr>)}</tbody>
                </table>}
                {newCard && <div style={{ marginTop: 12, padding: 12, background: C.primary + "06", borderRadius: 10 }}>
                    <Field label="选择课程"><select style={st.input} value={newCard.courseId || ""} onChange={e => setNewCard(v => ({ ...v, courseId: Number(e.target.value) }))}>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title} ({c.lessons}课时)</option>)}
                    </select></Field>
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}><PBtn small secondary onClick={() => setNewCard(null)}>取消</PBtn><PBtn small onClick={doCreateCard}>确认开卡</PBtn></div>
                </div>}
            </div>}
        </>}
    </div>;

    // Member list view
    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h2 style={{ margin: 0, color: C.text }}>👥 会员管理</h2>
            <PBtn onClick={() => setAddModal({ nickname: "", coins: 500 })}>添加会员</PBtn>
        </div>
        <input style={{ ...st.input, marginBottom: 12, maxWidth: 300 }} placeholder="🔍 搜索昵称..." value={search} onChange={e => setSearch(e.target.value)} />
        <div style={{ background: C.card, borderRadius: 12, overflow: "auto", boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead><tr><th style={st.th}>头像</th><th style={st.th}>昵称</th><th style={st.th}>Coin余额</th><th style={st.th}>注册时间</th><th style={st.th}>操作</th></tr></thead>
                <tbody>{filteredUsers.map(u => <tr key={u.id} style={{ cursor: "pointer" }} onClick={() => openUser(u)}>
                    <td style={st.td}><div style={{ width: 32, height: 32, borderRadius: "50%", background: u.avatarUrl ? `url(${u.avatarUrl}) center/cover` : u.avatarColor || "#6C5CE7", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: "#fff", fontWeight: 700 }}>{!u.avatarUrl && (u.nickname?.[0] || "?")}</div></td>
                    <td style={st.td}><span style={{ fontWeight: 600 }}>{u.nickname}</span></td>
                    <td style={st.td}><span style={{ color: C.secondary, fontWeight: 700 }}>{u.coins} 🪙</span></td>
                    <td style={{ ...st.td, fontSize: 12, color: C.textLight }}>{fmtDateFull(u.createdAt)}</td>
                    <td style={st.td}><PBtn small secondary onClick={e => { e.stopPropagation(); openUser(u); }}>查看详情</PBtn></td>
                </tr>)}</tbody>
            </table>
        </div>
        <Modal show={!!addModal} onClose={() => setAddModal(null)} title="添加会员">
            <Field label="昵称"><input style={st.input} value={addModal?.nickname || ""} onChange={e => setAddModal(m => ({ ...m, nickname: e.target.value }))} /></Field>
            <Field label="初始Coin"><input type="number" style={st.input} value={addModal?.coins || ""} onChange={e => setAddModal(m => ({ ...m, coins: Number(e.target.value) }))} /></Field>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}><PBtn secondary onClick={() => setAddModal(null)}>取消</PBtn><PBtn onClick={doAddUser}>创建</PBtn></div>
        </Modal>
    </div>;
};

// ======= COMMUNITY =======
const CommunityMgmt = () => {
    const { posts, adminDeletePost, adminPinPost } = useStore();
    const sorted = [...posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return <div><h2 style={{ margin: "0 0 20px", color: C.text }}>💬 社区管理</h2>
        {sorted.length === 0 ? <div style={{ background: C.card, borderRadius: 12, padding: 40, textAlign: "center", color: C.textLight }}>暂无帖子</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{sorted.map(p => <div key={p.id} style={{ background: C.card, borderRadius: 12, padding: 16, border: p.pinned ? `2px solid ${C.secondary}` : "2px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontWeight: 700, color: C.text }}>{p.user}</span><span style={{ fontSize: 12, color: C.textLight }}>{p.time}</span>{p.pinned && <span style={st.badge(C.secondary)}>📌 置顶</span>}</div><p style={{ margin: 0, fontSize: 14, color: C.text }}>{p.content}</p></div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}><PBtn small secondary onClick={() => adminPinPost(p.id)}>{p.pinned ? "取消置顶" : "📌 置顶"}</PBtn><PBtn small danger onClick={() => adminDeletePost(p.id)}>删除</PBtn></div></div>
            </div>)}</div>}
    </div>;
};

// ======= MAIN LAYOUT =======
export default function Admin() {
    const [page, setPage] = useState("coach");
    const { bookings, loading, refetchAll } = useStore();
    const pc = bookings.filter(b => b.status === "待确认").length;
    if (loading) return <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: C.bg, fontFamily: "-apple-system,sans-serif" }}><Spinner /></div>;
    return <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system,'Segoe UI',sans-serif" }}>
        <div style={{ width: 220, background: C.sidebar, color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>DC Pingpong</div><div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>管理后台</div></div>
            <div style={{ flex: 1, padding: "12px 0" }}>{NAV.map(n => <div key={n.id} onClick={() => setPage(n.id)} style={{ padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: page === n.id ? "rgba(255,255,255,0.1)" : "transparent", borderLeft: page === n.id ? `3px solid ${C.secondary}` : "3px solid transparent", transition: "all .15s", fontSize: 14, fontWeight: page === n.id ? 600 : 400 }}><span>{n.icon}</span><span>{n.label}</span>{n.id === "booking" && pc > 0 && <span style={{ background: C.secondary, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 7px", marginLeft: "auto" }}>{pc}</span>}</div>)}</div>
            <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <button onClick={refetchAll} style={{ width: "100%", padding: "8px", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 6, color: "#fff", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>🔄 刷新数据</button>
            </div>
            <div style={{ padding: "8px 20px 16px", fontSize: 12, opacity: 0.4 }}>v3.0 · Supabase</div>
        </div>
        <div style={{ flex: 1, background: C.bg, overflow: "auto" }}><div style={{ padding: "24px 32px", maxWidth: 1100 }}>
            {page === "coach" && <CoachMgmt />}{page === "course" && <CourseMgmt />}{page === "activity" && <ActivityMgmt />}{page === "table" && <TableMgmt />}{page === "booking" && <BookingMgmt />}{page === "member" && <MemberMgmt />}{page === "community" && <CommunityMgmt />}
        </div></div>
    </div>;
}
