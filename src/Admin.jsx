import { useState } from "react";
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

const NAV = [
    { id: "coach", icon: "🏓", label: "教练管理" }, { id: "course", icon: "📚", label: "课程管理" },
    { id: "activity", icon: "🎯", label: "活动管理" }, { id: "table", icon: "🏟️", label: "球台管理" },
    { id: "booking", icon: "📋", label: "预约审核" }, { id: "community", icon: "💬", label: "社区管理" },
];

// ======= COACH MANAGEMENT =======
const CoachMgmt = () => {
    const { coaches, setCoaches, DAYS, HOURS, slotsRange } = useStore();
    const [modal, setModal] = useState(null);
    const empty = { name: "", level: "", specialties: "", price: 80, status: "在职", avatar: null, availableSlots: [] };
    const openEdit = (c) => setModal({ ...c, specialties: c.specialties.join(","), _slots: JSON.parse(JSON.stringify(c.availableSlots)) });
    const openNew = () => setModal({ ...empty, _slots: [] });

    const toggleSlot = (day, hour) => {
        setModal(m => {
            const slots = [...m._slots];
            const di = slots.findIndex(s => s.day === day);
            if (di === -1) { slots.push({ day, hours: [hour] }); }
            else { const h = [...slots[di].hours]; const hi = h.indexOf(hour); if (hi === -1) h.push(hour); else h.splice(hi, 1); if (h.length === 0) slots.splice(di, 1); else slots[di] = { ...slots[di], hours: h }; }
            return { ...m, _slots: slots };
        });
    };
    const hasSlot = (day, hour) => modal?._slots.some(s => s.day === day && s.hours.includes(hour));

    const save = () => {
        const item = { ...modal, specialties: modal.specialties.split(",").map(x => x.trim()).filter(Boolean), availableSlots: modal._slots };
        delete item._slots;
        if (item.id) { setCoaches(d => d.map(x => x.id === item.id ? item : x)); } else { setCoaches(d => [...d, { ...item, id: Date.now() }]); }
        setModal(null);
    };
    const del = (id) => setCoaches(d => d.filter(x => x.id !== id));

    // Summarize slots for table display
    const summarizeSlots = (slots) => slots.map(s => {
        const sorted = [...s.hours].sort((a, b) => HOURS.indexOf(a) - HOURS.indexOf(b));
        // Group consecutive into ranges
        const ranges = []; let start = sorted[0], prev = sorted[0];
        for (let i = 1; i <= sorted.length; i++) {
            const cur = sorted[i];
            if (cur && HOURS.indexOf(cur) === HOURS.indexOf(prev) + 1) { prev = cur; }
            else { ranges.push(`${start}-${HOURS[HOURS.indexOf(prev) + 1] || "21:00"}`); if (cur) { start = cur; prev = cur; } }
        }
        return `${s.day}: ${ranges.join(", ")}`;
    }).join(" | ");

    return <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h2 style={{ margin: 0, color: C.text }}>🏓 教练管理</h2><PBtn onClick={openNew}>+ 添加教练</PBtn>
        </div>
        <div style={{ background: C.card, borderRadius: 12, overflow: "auto", boxShadow: "0 2px 12px rgba(59,45,139,0.06)" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 700 }}>
                <thead><tr><th style={st.th}>教练</th><th style={st.th}>等级</th><th style={st.th}>擅长</th><th style={st.th}>价格/时</th><th style={st.th}>可用时段</th><th style={st.th}>状态</th><th style={st.th}>操作</th></tr></thead>
                <tbody>{coaches.map(c => <tr key={c.id}>
                    <td style={st.td}><div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: c.avatar ? `url(${c.avatar}) center/cover` : "#D1D5DB", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, overflow: "hidden" }}>{!c.avatar && "📷"}</div>
                        <span style={{ fontWeight: 600 }}>{c.name}</span></div></td>
                    <td style={st.td}><span style={st.badge(C.primary)}>{c.level}</span></td>
                    <td style={st.td}>{c.specialties.join(", ")}</td>
                    <td style={st.td}><span style={{ color: C.secondary, fontWeight: 700 }}>{c.price} 🪙</span></td>
                    <td style={st.td}><div style={{ fontSize: 11, maxWidth: 200 }}>{summarizeSlots(c.availableSlots)}</div></td>
                    <td style={st.td}><span style={st.badge(c.status === "在职" ? C.success : C.warning)}>{c.status}</span></td>
                    <td style={st.td}><div style={{ display: "flex", gap: 6 }}><PBtn small secondary onClick={() => openEdit(c)}>编辑</PBtn><PBtn small danger onClick={() => del(c.id)}>删除</PBtn></div></td>
                </tr>)}</tbody>
            </table>
        </div>
        <Modal show={!!modal} onClose={() => setModal(null)} title={modal?.id ? "编辑教练" : "添加教练"} wide>
            <div style={{ display: "flex", gap: 20 }}>
                <div style={{ flex: 1 }}>
                    <Field label="头像"><ImageUpload value={modal?.avatar} onChange={v => setModal(m => ({ ...m, avatar: v }))} round /></Field>
                    <Field label="姓名"><input style={st.input} value={modal?.name || ""} onChange={e => setModal(m => ({ ...m, name: e.target.value }))} /></Field>
                    <Field label="等级"><input style={st.input} value={modal?.level || ""} onChange={e => setModal(m => ({ ...m, level: e.target.value }))} /></Field>
                    <Field label="擅长方向（逗号分隔）"><input style={st.input} value={modal?.specialties || ""} onChange={e => setModal(m => ({ ...m, specialties: e.target.value }))} /></Field>
                    <Field label="课时价格（每小时）"><input type="number" style={st.input} value={modal?.price || ""} onChange={e => setModal(m => ({ ...m, price: Number(e.target.value) }))} /></Field>
                    <Field label="状态"><select style={st.input} value={modal?.status || "在职"} onChange={e => setModal(m => ({ ...m, status: e.target.value }))}><option value="在职">在职</option><option value="休假">休假</option><option value="离职">离职</option></select></Field>
                </div>
                <div style={{ flex: 1 }}>
                    <Field label="可用时间设置（0.5小时/格）">
                        <div style={{ maxHeight: 320, overflow: "auto", border: `1px solid ${C.primary}15`, borderRadius: 8, padding: 8 }}>
                            {DAYS.map(day => <div key={day} style={{ marginBottom: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 600, color: C.text, marginBottom: 3 }}>{day}</div>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                                    {HOURS.map(h => <button key={h} onClick={() => toggleSlot(day, h)} style={{ padding: "2px 6px", borderRadius: 4, fontSize: 10, border: "none", cursor: "pointer", fontWeight: 600, background: hasSlot(day, h) ? C.primary + "20" : "#f0f0f0", color: hasSlot(day, h) ? C.primary : C.textLight, minWidth: 38 }}>{h}</button>)}
                                </div>
                            </div>)}
                        </div>
                    </Field>
                </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}><PBtn secondary onClick={() => setModal(null)}>取消</PBtn><PBtn onClick={save}>保存</PBtn></div>
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

// ======= BOOKING REVIEW =======
const BookingMgmt = () => {
    const { bookings, approveBooking, rejectBooking, slotsRange } = useStore();
    const pending = bookings.filter(b => b.status === "待确认");
    const processed = bookings.filter(b => b.status !== "待确认");
    return <div>
        <h2 style={{ margin: "0 0 20px", color: C.text }}>📋 预约审核</h2>
        {pending.length === 0 ? <div style={{ background: C.card, borderRadius: 12, padding: 40, textAlign: "center", color: C.textLight }}>🎉 暂无待审核</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>{pending.map(b => <div key={b.id} style={{ background: C.card, borderRadius: 12, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}><span style={st.badge(C.orange)}>待确认</span><span style={st.badge(b.type === "教练预约" ? C.primary : C.primaryLight)}>{b.type}</span></div>
                    <div style={{ fontWeight: 600, color: C.text, marginBottom: 2 }}>{b.detail}</div>
                    <div style={{ fontSize: 12, color: C.textLight }}>用户：{b.user} · 支付：{b.payMethod} · 时长：{b.duration}h · {b.payMethod === "Coin" ? `费用：${b.cost} Coin` : `课程卡扣 ${b.cardDeduct || b.duration} 次`}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}><PBtn small onClick={() => approveBooking(b.id)}>✓ 确认</PBtn><PBtn small danger onClick={() => rejectBooking(b.id)}>✗ 拒绝</PBtn></div>
            </div>)}</div>}
        {processed.length > 0 && <><h3 style={{ color: C.text, margin: "0 0 12px" }}>已处理</h3>
            <div style={{ background: C.card, borderRadius: 12, overflow: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th style={st.th}>类型</th><th style={st.th}>详情</th><th style={st.th}>用户</th><th style={st.th}>时长</th><th style={st.th}>支付</th><th style={st.th}>状态</th></tr></thead>
                <tbody>{processed.map(b => <tr key={b.id}><td style={st.td}>{b.type}</td><td style={st.td}>{b.detail}</td><td style={st.td}>{b.user}</td><td style={st.td}>{b.duration}h</td><td style={st.td}>{b.payMethod}</td><td style={st.td}><span style={st.badge(b.status === "已确认" ? C.success : b.status === "已取消" ? "#999" : C.danger)}>{b.status}{b.refunded ? " (已退)" : ""}</span></td></tr>)}</tbody></table></div></>}
    </div>;
};

// ======= COMMUNITY =======
const CommunityMgmt = () => {
    const { posts, setPosts } = useStore();
    const del = (id) => setPosts(d => d.filter(x => x.id !== id));
    const pin = (id) => setPosts(d => d.map(x => x.id === id ? { ...x, pinned: !x.pinned } : x));
    const sorted = [...posts].sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));
    return <div><h2 style={{ margin: "0 0 20px", color: C.text }}>💬 社区管理</h2>
        {sorted.length === 0 ? <div style={{ background: C.card, borderRadius: 12, padding: 40, textAlign: "center", color: C.textLight }}>暂无帖子</div> :
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>{sorted.map(p => <div key={p.id} style={{ background: C.card, borderRadius: 12, padding: 16, border: p.pinned ? `2px solid ${C.secondary}` : "2px solid transparent" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}><div style={{ flex: 1 }}><div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontWeight: 700, color: C.text }}>{p.user}</span><span style={{ fontSize: 12, color: C.textLight }}>{p.time}</span>{p.pinned && <span style={st.badge(C.secondary)}>📌 置顶</span>}</div><p style={{ margin: 0, fontSize: 14, color: C.text }}>{p.content}</p></div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0, marginLeft: 12 }}><PBtn small secondary onClick={() => pin(p.id)}>{p.pinned ? "取消置顶" : "📌 置顶"}</PBtn><PBtn small danger onClick={() => del(p.id)}>删除</PBtn></div></div>
            </div>)}</div>}
    </div>;
};

// ======= MAIN LAYOUT =======
export default function Admin() {
    const [page, setPage] = useState("coach");
    const { bookings } = useStore();
    const pc = bookings.filter(b => b.status === "待确认").length;
    return <div style={{ display: "flex", minHeight: "100vh", fontFamily: "-apple-system,'Segoe UI',sans-serif" }}>
        <div style={{ width: 220, background: C.sidebar, color: "#fff", display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "24px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}><div style={{ fontSize: 18, fontWeight: 800, letterSpacing: 1 }}>DC Pingpong</div><div style={{ fontSize: 12, opacity: 0.5, marginTop: 2 }}>管理后台</div></div>
            <div style={{ flex: 1, padding: "12px 0" }}>{NAV.map(n => <div key={n.id} onClick={() => setPage(n.id)} style={{ padding: "12px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, background: page === n.id ? "rgba(255,255,255,0.1)" : "transparent", borderLeft: page === n.id ? `3px solid ${C.secondary}` : "3px solid transparent", transition: "all .15s", fontSize: 14, fontWeight: page === n.id ? 600 : 400 }}><span>{n.icon}</span><span>{n.label}</span>{n.id === "booking" && pc > 0 && <span style={{ background: C.secondary, color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: 10, padding: "1px 7px", marginLeft: "auto" }}>{pc}</span>}</div>)}</div>
            <div style={{ padding: "16px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", fontSize: 12, opacity: 0.4 }}>v1.0 · DC Pingpong</div>
        </div>
        <div style={{ flex: 1, background: C.bg, overflow: "auto" }}><div style={{ padding: "24px 32px", maxWidth: 1100 }}>
            {page === "coach" && <CoachMgmt />}{page === "course" && <CourseMgmt />}{page === "activity" && <ActivityMgmt />}{page === "table" && <TableMgmt />}{page === "booking" && <BookingMgmt />}{page === "community" && <CommunityMgmt />}
        </div></div>
    </div>;
}
