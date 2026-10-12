import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Home,
  CalendarDays,
  BookOpen,
  AlertCircle,
  PlaySquare,
  BarChart3,
  Settings,
  Check,
  Play,
  Pause,
  Square,
  Clock3,
  PenLine,
  Sparkles,
  Send,
  ChevronRight,
  Menu,
  X,
  Search,
  Upload,
  Shuffle,
  RotateCcw,
  MoreHorizontal,
  GripVertical,
  Folder,
  Trash2,
  Bot,
  Video,
  TrendingUp,
  Database,
  Download,
  Save,
  ShieldCheck,
  ExternalLink,
  Plus,
} from "lucide-react";
import "./style.css";
import importedQuizQuestions from "./gptQuestionData.json";
import defaultCourses from "./defaultCourses.json";
const nav = [
  [Home, "首页"],
  [CalendarDays, "学习计划"],
  [PlaySquare, "课程进度"],
  [BookOpen, "题库练习"],
  [Bot, "GPT 专题真题"],
  [AlertCircle, "错题复习"],
  [BarChart3, "学习统计"],
  [Settings, "设置"],
];
const topics = [];
const seed = [];
const PLAN_KEY = "study-desk-plan-v1",
  TIMER_KEY = "study-desk-study-timer-v1",
  WRONG_KEY = "study-desk-wrong-v1",
  ANSWER_KEY = "study-desk-answer-stats-v1",
  DRAFT_KEY = "study-desk-question-drafts-v1",
  SETTINGS_KEY = "study-desk-settings-v1";
const SCHEDULED_PLAN_KEY = "study-desk-scheduled-plans-v1";
const PLAN_UPDATED_EVENT = "study-desk-plan-updated";
const SETTINGS_UPDATED_EVENT = "study-desk-settings-updated";
const SYNC_QUEUE_KEY = "study-desk-sync-queue-v1";
const syncLabels = {
  plans: "今日计划", "scheduled-plans": "日期预设计划", timer: "计时器", wrong: "错题记录", settings: "设置", answers: "答题统计",
  history: "学习历史", courses: "课程数据", progress: "课程进度", drafts: "草稿记录",
  "focus-records": "专注记录", "focus-module": "当前学习模块", "study-days": "学习日期",
  "week-plan": "本周计划", "plan-date": "计划日期", "week-key": "周计划日期",
  "plan-history": "计划历史", "week-history": "周计划历史", "study-stage": "备考阶段",
  "gpt-sets": "GPT 专题", "course-modules": "课程模块", "material-folders": "资料文件夹",
  "added-materials": "新增资料", "hidden-materials": "隐藏资料", "removed-material-folders": "移除的资料文件夹",
  "ai-draft": "AI 草稿",
};
const defaultSettings = {
  subject: "软件设计师（中级）",
  examDate: "",
  dailyMinutes: 120,
  dailyQuestions: 20,
  apiUrl: "https://api.openai.com/v1",
  model: "gpt-5-mini",
};
const normalizeDailyMinutes = (value) => Math.min(1440, Math.max(1, Math.round(Number(value) || 1)));
const openVideoUrl = (value) => {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('invalid protocol');
    window.open(url.href, '_blank', 'noopener,noreferrer');
    return true;
  } catch {
    window.alert('请输入有效的 http:// 或 https:// 视频链接。');
    return false;
  }
};
const openExternalChatGPT = (prompt) => {
  const text = String(prompt || "").trim() || "请帮我复习软件设计师中级考试的重点。";
  // 优先尝试 Windows 桌面版；协议失败时不强制跳转，保留可见的网页版按钮。
  const chatWindow = window.open("chatgpt://", "_blank", "noopener,noreferrer");
  const copyFallback = () => {
    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    let copied = false;
    try { copied = document.execCommand("copy"); } catch {}
    area.remove();
    return copied;
  };
  const copied = navigator.clipboard?.writeText
    ? navigator.clipboard.writeText(text).then(() => true).catch(copyFallback)
    : Promise.resolve(copyFallback());
  copied.then((ok) => window.dispatchEvent(new CustomEvent("chatgpt-status", { detail: {
    copied: Boolean(ok), desktopOpened: Boolean(chatWindow),
  } })));
};
const readLocal = (key, fallback) => {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
};
const readLocalString = (key, fallback = "") => {
  const value = localStorage.getItem(key);
  if (value === null) return fallback;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "string" ? parsed : String(parsed ?? fallback);
  } catch {
    return value;
  }
};
const stateKeyMap = {
  [PLAN_KEY]: "plans",
  [SCHEDULED_PLAN_KEY]: "scheduled-plans",
  [TIMER_KEY]: "timer",
  [WRONG_KEY]: "wrong",
  [ANSWER_KEY]: "answers",
  [DRAFT_KEY]: "drafts",
  [SETTINGS_KEY]: "settings",
  "study-desk-focus-records-v1": "focus-records",
  "study-desk-focus-module-v1": "focus-module",
  "study-desk-study-days-v1": "study-days",
  "study-desk-week-plan-v1": "week-plan",
  "study-desk-plan-date-v1": "plan-date",
  "study-desk-week-key-v1": "week-key",
  "study-desk-plan-history-v1": "plan-history",
  "study-desk-week-history-v1": "week-history",
  "study-desk-stage-v1": "study-stage",
  "study-desk-gpt-sets-v1": "gpt-sets",
  "study-desk-course-modules-v2": "course-modules",
  "study-desk-material-folders-v1": "material-folders",
  "study-desk-added-materials-v1": "added-materials",
  "study-desk-hidden-materials-v1": "hidden-materials",
  "study-desk-removed-folders-v1": "removed-material-folders",
  "study-desk-ai-draft": "ai-draft",
};
const decodeStoredValue = (value) => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};
const encodeStoredValue = (value) =>
  typeof value === "string" ? value : JSON.stringify(value);
const readSyncQueue = () => readLocal(SYNC_QUEUE_KEY, []);
const writeSyncQueue = (queue) => {
  try { originalSetItem.call(localStorage, SYNC_QUEUE_KEY, JSON.stringify(queue)); } catch {}
};
let syncSnapshot = {
  online: typeof navigator === "undefined" ? true : navigator.onLine,
  backend: "checking",
  backendError: "",
  backendCheckedAt: null,
  syncing: false,
  queue: readSyncQueue(),
  lastSuccessAt: null,
  lastFailureAt: null,
};
const syncListeners = new Set();
const subscribeSync = (listener) => { syncListeners.add(listener); return () => syncListeners.delete(listener); };
const updateSync = (patch) => {
  syncSnapshot = { ...syncSnapshot, ...patch };
  syncListeners.forEach((listener) => listener(syncSnapshot));
};
const syncRequest = async (item) => {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetch(`/api/state/${item.remoteKey}`, {
      method: "PUT", headers: { "content-type": "application/json" },
      body: JSON.stringify({ value: item.value }), signal: controller.signal,
    });
    if (!response.ok) throw new Error(`服务器返回 ${response.status}`);
  } finally { window.clearTimeout(timeout); }
};
let syncPromise = null;
let syncReady = false;
const runSync = () => {
  if (!syncReady) return Promise.resolve();
  if (syncPromise || !navigator.onLine) return syncPromise;
  const queue = readSyncQueue();
  if (!queue.length) { updateSync({ queue: [], online: true }); return Promise.resolve(); }
  syncPromise = (async () => {
    updateSync({ syncing: true, online: true, queue });
    const settled = await Promise.all(queue.map(async (item) => {
      try { await syncRequest(item); return { ok: true, remoteKey: item.remoteKey }; }
      catch (error) {
        return { ok: false, item: { ...item, attempts: (item.attempts || 0) + 1, lastAttemptAt: new Date().toISOString(), lastError: error?.name === "AbortError" ? "请求超时" : String(error?.message || "网络连接失败") } };
      }
    }));
    const failed = settled.filter((result) => !result.ok).map((result) => result.item);
    const succeeded = settled.filter((result) => result.ok);
    const succeededKeys = new Set(succeeded.map((result) => result.remoteKey));
    // A completed request must not discard a newer edit queued for the same key.
    const currentQueue = readSyncQueue().filter((item) => {
      const sent = queue.find((entry) => entry.remoteKey === item.remoteKey);
      return !sent || JSON.stringify(sent) !== JSON.stringify(item);
    });
    const mergedQueue = [...currentQueue, ...failed.filter((item) => !currentQueue.some((newer) => newer.remoteKey === item.remoteKey))];
    writeSyncQueue(mergedQueue);
    updateSync({ syncing: false, queue: mergedQueue,
      lastSuccessAt: succeeded.length ? new Date().toISOString() : syncSnapshot.lastSuccessAt,
      lastFailureAt: failed.length ? new Date().toISOString() : syncSnapshot.lastFailureAt });
  })().finally(() => {
    syncPromise = null;
    const pending = readSyncQueue();
    if (pending.some((item) => !queue.some((sent) => sent.remoteKey === item.remoteKey && JSON.stringify(sent.value) === JSON.stringify(item.value)))) runSync();
  });
  return syncPromise;
};
const enqueueSync = (localKey, remoteKey, value) => {
  const queue = readSyncQueue();
  const old = queue.find((item) => item.remoteKey === remoteKey);
  const next = [...queue.filter((item) => item.remoteKey !== remoteKey), {
    localKey, remoteKey, value, attempts: old?.attempts || 0,
    queuedAt: old?.queuedAt || new Date().toISOString(), lastError: old?.lastError || "",
  }];
  writeSyncQueue(next);
  updateSync({ queue: next, online: navigator.onLine });
  runSync();
};
const checkBackend = async () => {
  if (!navigator.onLine) { updateSync({ backend: "offline", backendError: "当前网络不可用" }); return false; }
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch("/api/health", { signal: controller.signal, cache: "no-store" });
    if (!response.ok) throw new Error(`服务返回 ${response.status}`);
    const result = await response.json();
    if (!result.ok || result.database !== "sqlite") throw new Error("SQLite 服务未就绪");
    updateSync({ backend: "online", backendError: "", backendCheckedAt: new Date().toISOString() });
    runSync();
    return true;
  } catch (error) {
    updateSync({ backend: "offline", backendError: error?.name === "AbortError" ? "健康检查超时" : String(error?.message || "无法连接本地服务"), backendCheckedAt: new Date().toISOString() });
    return false;
  } finally { window.clearTimeout(timeout); }
};
const originalSetItem = Storage.prototype.setItem;
Storage.prototype.setItem = function (key, value) {
  originalSetItem.call(this, key, value);
  const remoteKey = this === localStorage ? stateKeyMap[key] : null;
  if (remoteKey) enqueueSync(key, remoteKey, decodeStoredValue(value));
  if (this === localStorage && key === SETTINGS_KEY) window.dispatchEvent(new Event(SETTINGS_UPDATED_EVENT));
};
async function hydrateState() {
  const pending = new Map(readSyncQueue().map((item) => [item.remoteKey, item]));
  await Promise.all(
    Object.entries(stateKeyMap).map(async ([localKey, remoteKey]) => {
      const queued = pending.get(remoteKey);
      if (queued) {
        originalSetItem.call(localStorage, localKey, encodeStoredValue(queued.value));
        return;
      }
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(`/api/state/${remoteKey}`, { signal: controller.signal });
        if (!response.ok) return;
        const remote = (await response.json()).value;
        const local = localStorage.getItem(localKey);
        if (remote !== null)
          originalSetItem.call(localStorage, localKey, encodeStoredValue(remote));
        else if (local) enqueueSync(localKey, remoteKey, decodeStoredValue(local));
      } catch (error) {
        // Only queued edits are dirty. Do not upload an unchanged stale cache
        // when the server read fails (another device may have newer data).
      } finally { window.clearTimeout(timeout); }
    }),
  );
}
window.addEventListener("online", () => { updateSync({ online: true }); runSync(); });
window.addEventListener("offline", () => updateSync({ online: false }));
window.setInterval(runSync, 30000);
window.setInterval(checkBackend, 15000);
checkBackend();
const seedQuizQuestions = {};
const quizQuestions = { ...seedQuizQuestions, ...importedQuizQuestions };
function Ring({ value = 58, small = false }) {
  return (
    <div className={"ring " + (small ? "small" : "")} style={{ "--p": value }}>
      <b>{value}%</b>
    </div>
  );
}
const todayKey = () => new Date().toLocaleDateString("sv-SE");
const FOCUS_RECORDS_KEY = "study-desk-focus-records-v1";
const FOCUS_MODULES = ["上午题—计算机系统（5~6分）", "上午题—程序设计语言（固定6分）", "下午题—试题一（15分）", "上午题—知识产权（2~3分）", "上午题—数据库（固定6分）", "下午题—试题二（15分）", "上午题—面向对象（3~4分）", "上午题—UML（3~4分）", "下午题—试题三（15分）", "上午题—设计模式（固定4分）", "下午题—试题六（15分）", "上午题—操作系统（固定6分）", "上午题—结构化开发（3~4分）", "上午题—软件工程（上）", "上午题—软件工程（下）", "上午题—信息安全（5分左右）", "上午题—计算机网络（固定5分）", "上午题—数据结构（上）", "上午题—数据结构（下）", "上午题—算法（4~5分）", "下午题—试题四（15分）", "错题复习", "历年真题", "自定义学习"];
const emptyTimer = (totalAllTime) => ({
  date: todayKey(),
  status: "idle",
  elapsed: 0,
  start: 0,
  last: 0,
  totalToday: 0,
  totalAllTime: totalAllTime || 0,
});
const readTimer = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(TIMER_KEY));
    if (!saved) return emptyTimer();
    const totalAllTime = saved.totalAllTime ?? saved.totalToday ?? 0;
    if (saved.date !== todayKey()) return emptyTimer(totalAllTime);
    return { ...emptyTimer(totalAllTime), ...saved, totalAllTime };
  } catch {
    return emptyTimer();
  }
};
const formatTime = (value) => {
  const h = Math.floor(value / 3600),
    m = Math.floor((value % 3600) / 60),
    s = value % 60;
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
};
function StudyTimer() {
  const [timer, setTimer] = useState(readTimer);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    localStorage.setItem(TIMER_KEY, JSON.stringify(timer));
  }, [timer]);
  useEffect(() => {
    if (timer.status !== "running") return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timer.status]);
  const sessionTime =
    timer.elapsed +
    (timer.status === "running" ? Math.floor((now - timer.start) / 1000) : 0);
  const start = () => {
    const startedAt = Date.now();
    setNow(startedAt);
    setTimer((v) => ({ ...v, status: "running", start: startedAt }));
  };
  const pause = () =>
    setTimer((v) => ({
      ...v,
      status: "paused",
      elapsed: v.elapsed + Math.floor((Date.now() - v.start) / 1000),
      start: 0,
    }));
  const end = () => {
    const duration = timer.elapsed + (timer.status === "running" ? Math.floor((Date.now() - timer.start) / 1000) : 0);
    if (duration > 0) {
      const records = readLocal(FOCUS_RECORDS_KEY, []);
      localStorage.setItem(FOCUS_RECORDS_KEY, JSON.stringify([...records, { id: Date.now(), date: todayKey(), module: "学习计时", duration }]));
      window.dispatchEvent(new Event("focus-record-updated"));
    }
    setTimer((v) => ({ ...emptyTimer(v.totalAllTime + duration), last: duration, totalToday: v.totalToday + duration }));
  };
  return (
    <section className={"studyTimer " + timer.status}>
      <div className="timerIdentity">
        <i>
          <Clock3 />
        </i>
        <div>
          <small>
            {timer.status === "idle"
              ? "本次学习"
              : timer.status === "paused"
                ? "本次学习 · 已暂停"
                : "本次学习 · 计时中"}
          </small>
          <strong>{formatTime(sessionTime)}</strong>
        </div>
      </div>
      <div className="timerHint">
        {timer.last ? <small>上次 {formatTime(timer.last)}</small> : null}
      </div>
      <div className="timerActions">
        {timer.status === "running" ? (
          <button onClick={pause}>
            <Pause />
            暂停
          </button>
        ) : (
          <button className="primary" onClick={start}>
            <Play />
            {timer.status === "paused" ? "继续" : "开始计时"}
          </button>
        )}
        {timer.status !== "idle" ? (
          <button className="stop" onClick={end}>
            <Square />
            结束
          </button>
        ) : null}
      </div>
    </section>
  );
}
function FocusSummary() {
  const [records, setRecords] = useState(() => readLocal(FOCUS_RECORDS_KEY, []));
  const [dailyTarget, setDailyTarget] = useState(() => Number(readLocal(SETTINGS_KEY, defaultSettings).dailyMinutes) || 120);
  useEffect(() => {
    const refreshRecords = () => setRecords(readLocal(FOCUS_RECORDS_KEY, []));
    const refreshTarget = () => setDailyTarget(Number(readLocal(SETTINGS_KEY, defaultSettings).dailyMinutes) || 120);
    const refreshStorage = () => { refreshRecords(); refreshTarget(); };
    window.addEventListener("focus-record-updated", refreshRecords);
    window.addEventListener(SETTINGS_UPDATED_EVENT, refreshTarget);
    window.addEventListener("storage", refreshStorage);
    return () => {
      window.removeEventListener("focus-record-updated", refreshRecords);
      window.removeEventListener(SETTINGS_UPDATED_EVENT, refreshTarget);
      window.removeEventListener("storage", refreshStorage);
    };
  }, []);
  const today = records.filter((r) => r.date === todayKey());
  const todaySeconds = today.reduce((sum, record) => sum + record.duration, 0);
  const targetSeconds = dailyTarget * 60;
  const remainingMinutes = Math.ceil(Math.max(0, targetSeconds - todaySeconds) / 60);
  const progress = Math.min(100, Math.round(todaySeconds / targetSeconds * 100));
  const groups = today.reduce((a, r) => { a[r.module] = (a[r.module] || 0) + r.duration; return a; }, {});
  return <section className="panel focusSummary"><div className="panelTitle"><h2>今日专注</h2><span>结束计时后自动保存学习时长</span></div><div className="focusStats"><div><b>{today.length}</b><small>今日次数</small></div><div><b>{formatTime(todaySeconds)}</b><small>今日时长</small></div><div><b>{formatTime(records.reduce((s, r) => s + r.duration, 0))}</b><small>累计时长</small></div></div><div className="focusGoal"><div><span>今日目标 {dailyTarget} 分钟</span><span>{remainingMinutes ? `还差 ${remainingMinutes} 分钟` : "今日目标已完成"}</span></div><div className="focusGoalTrack" role="progressbar" aria-label="今日学习目标进度" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div></div>{Object.keys(groups).length ? <div className="focusRows">{Object.entries(groups).sort((a,b) => b[1]-a[1]).slice(0,4).map(([m,d]) => <div key={m}><span>{m}</span><b>{formatTime(d)}</b></div>)}</div> : <p className="focusEmpty">开始一次学习计时，结束后会在这里保存本次时长。</p>}</section>;
}
function QuestionBank({ onPractice }) {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("全部年份");
  const [showAdd, setShowAdd] = useState(false);
  const [managing, setManaging] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [form, setForm] = useState({
    year: 2009, season: "上半年", paper_type: "上午题", question_no: 1,
    topic: "自定义题目", stem: "", options: ["", "", "", ""], answer: 0,
  });
  const loadQuestions = () =>
    fetch("/api/questions")
      .then((r) => {
        if (!r.ok) throw new Error("题库加载失败");
        return r.json();
      })
      .then(setQuestions);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/questions", { signal: controller.signal })
      .then((r) => {
        if (!r.ok) throw new Error("题库加载失败");
        return r.json();
      })
      .then(setQuestions)
      .catch((e) => { if (e.name !== "AbortError") { setQuestions([]); setLoadError(e.message); } })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, []);
  const addQuestion = async (event) => {
    event.preventDefault();
    setFormError("");
    if (!form.stem.trim() || form.options.some((option) => !option.trim())) {
      setFormError("请填写题干和四个选项。");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          year: Number(form.year),
          question_no: Number(form.question_no),
          options: form.options.map((option) => option.trim()),
          stem: form.stem.trim(),
          topic: form.topic.trim() || "自定义题目",
          explanation: "",
          source: "用户手动添加",
          verified: true,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "新增失败");
      await loadQuestions();
      setShowAdd(false);
      setForm((current) => ({ ...current, question_no: Number(current.question_no) + 1, stem: "", options: ["", "", "", ""] }));
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  };
  const deleteQuestion = async (question) => {
    if (!window.confirm(`确定删除第 ${question.question_no || "?"} 题吗？\n${question.stem}`)) return;
    try {
      const response = await fetch(`/api/questions/${question.id}`, { method: "DELETE" });
      const result = await response.json();
      if (!response.ok) {
        window.alert(result.error || "删除失败");
        return;
      }
      setQuestions((current) => current.filter((item) => item.id !== question.id));
    } catch { window.alert("删除失败，请检查后端连接后重试。"); }
  };
  const real = useMemo(
    () => questions.filter((q) => q.verified),
    [questions],
  );
  const years = useMemo(
    () =>
      [...new Set(real.map((q) => q.year).filter(Boolean))].sort(
        (a, b) => b - a,
      ),
    [real],
  );
  const yearCounts = useMemo(() => {
    const counts = new Map();
    real.forEach((q) => {
      if (!q.year) return;
      const key = String(q.year);
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [real]);
  const filtered = useMemo(
    () =>
      real.filter(
        (q) =>
          (year === "全部年份" || String(q.year) === year) &&
          `${q.stem} ${q.topic} ${q.year} ${q.season} ${q.paper_type}`.includes(query.trim()),
      ),
    [real, year, query],
  );
  const paperGroups = useMemo(() => {
    const groups = new Map();
    filtered.forEach((q) => {
      const key = `${q.year || "未知年份"}-${q.season || "未知批次"}-${q.paper_type || "专项题"}`;
      if (!groups.has(key)) groups.set(key, { key, year: q.year, season: q.season, type: q.paper_type || "专项题", questions: [] });
      groups.get(key).questions.push(q);
    });
    return [...groups.values()].map((p) => {
      const expected = p.type.includes("上午") ? 75 : p.type.includes("下午") ? 5 : 0;
      const numbers = new Set(p.questions.map((q) => q.question_no));
      return { ...p, expected, complete: expected > 0 && Array.from({ length: expected }, (_, i) => i + 1).every((n) => numbers.has(n)) };
    }).sort((a, b) => (b.year || 0) - (a.year || 0));
  }, [filtered]);
  const start = (list, title) =>
    list.length && onPractice({ title, questions: list });
  return (
    <div className="bankPage">
      <div className="pageHead">
        <div>
          <h1>题库练习</h1>
          <p>自行录入单选题，支持即时判分和错题收集。</p>
        </div>
        <div className="pageHeadActions">
          <button className="addQuestionButton" onClick={() => setShowAdd(true)}><Plus />新增题目</button>
          <button className="importBtn" onClick={() => start(filtered, "随机专项练习")}><Shuffle />随机练习</button>
        </div>
      </div>
      <div className="notice bankNotice">
        <Database />
        <div>
          <b>
            {loading
              ? "正在读取 SQLite 题库…"
              : loadError ? `题库加载失败：${loadError}` : `已载入 ${real.length} 道本地题目`}
          </b>
          <span>
            首次启动题库为空，请自行录入有权使用的题目，并核对答案与来源。
          </span>
        </div>
      </div>
      <div className="bankFilters">
        <label>
          <Search />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索题库、试卷或知识点"
          />
        </label>
        <select value={year} onChange={(e) => setYear(e.target.value)}>
          <option>全部年份</option>
          {years.map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
      </div>
      <div className="bankLayout">
        <aside className="subjectRail">
          {[["全部年份", real.length], ...years.map((x) => [String(x), yearCounts.get(String(x)) || 0])].map((x) => (
            <button
              className={year === x[0] ? "active" : ""}
              onClick={() => setYear(x[0])}
              key={x[0]}
            >
              <span>{x[0] !== "全部年份" ? `${x[0]} 年` : x[0]}</span>
              <small>{x[1]}</small>
            </button>
          ))}
        </aside>
        <section className="paperPanel">
          <div className="paperHeader paperSetHeader"><span>试卷</span><span>类型</span><span>题数</span><span>状态</span><span>操作</span></div>
          {paperGroups.map((p) => (
            <React.Fragment key={p.key}>
              <div className="paperRow paperSetRow">
                <b>{p.year} 年{p.season} 软件设计师 {p.type}</b><span>{p.type}</span><span>{p.questions.length}/{p.expected || "?"} 题</span><span>{p.complete ? "完整" : "待补全"}</span>
                <div className="paperActions">
                  <button onClick={() => setManaging((current) => current === p.key ? "" : p.key)}>{managing === p.key ? "收起管理" : "管理题目"}</button>
                  <button onClick={() => start(p.questions, `${p.year} 年${p.season} 软件设计师 ${p.type}`)}>{p.complete ? "整套练习" : `练习现有 ${p.questions.length} 题`}</button>
                </div>
              </div>
              {managing === p.key ? (
                <div className="questionManager">
                  {[...p.questions].sort((a, b) => (a.question_no || 0) - (b.question_no || 0)).map((question) => (
                    <div key={question.id} className="questionManageRow">
                      <b>第 {question.question_no || "?"} 题</b>
                      <span>{question.stem}</span>
                      <button onClick={() => deleteQuestion(question)} title="删除这道题"><Trash2 />删除</button>
                    </div>
                  ))}
                </div>
              ) : null}
            </React.Fragment>
          ))}
          {!loading && !paperGroups.length ? <div className="bankEmpty">{loadError ? '请确认后端服务运行后重新打开题库。' : '没有符合条件的题目'}</div> : null}
        </section>
        <div className="bankSide">
          <section className="panel practiceSummary">
            <h2>练习概览</h2>
            <div>
              <p>
                <small>累计已做</small>
                <b>
                  {readLocal(ANSWER_KEY, { total: 0 }).total || 0}
                  <em>题</em>
                </b>
              </p>
              <p>
                <small>正确率</small>
                <b>
                  {(() => {
                    const a = readLocal(ANSWER_KEY, { total: 0, correct: 0 });
                    return a.total
                      ? Math.round((a.correct / a.total) * 100)
                      : 0;
                  })()}
                  <em>%</em>
                </b>
              </p>
              <p>
                <small>待复习错题</small>
                <b>
                  {readLocal(WRONG_KEY, []).filter((item) => !item.mastered).length}
                  <em>题</em>
                </b>
              </p>
            </div>
            <p>完成练习后，这里会显示累计答题统计。</p>
          </section>
          <section className="panel quickPractice">
            <h2>快速练习</h2>
            <button
              onClick={() =>
                start(
                  [...real].sort(() => Math.random() - 0.5).slice(0, 20),
                  "随机 20 题",
                )
              }
            >
              <i>
                <RotateCcw />
              </i>
              <span>
                <b>随机 20 题</b>
                <small>从真实专项题中抽取</small>
              </span>
              <ChevronRight />
            </button>
            <button
              onClick={() =>
                start(
                  real.filter((q) => q.explanation),
                  "带解析题目练习",
                )
              }
            >
              <i>
                <Shuffle />
              </i>
              <span>
                <b>带解析练习</b>
                <small>完成后立即查看原文解析</small>
              </span>
              <ChevronRight />
            </button>
          </section>
        </div>
      </div>
      {showAdd ? (
        <div className="quizOverlay questionEditorOverlay">
          <form className="questionEditor" onSubmit={addQuestion}>
            <header><div><small>写入本地 SQLite</small><h2>新增题目</h2></div><button type="button" onClick={() => setShowAdd(false)}><X /></button></header>
            <div className="questionMetaFields">
              <label>年份<input type="number" min="2000" max="2100" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} /></label>
              <label>批次<select value={form.season} onChange={(e) => setForm({ ...form, season: e.target.value })}><option>上半年</option><option>下半年</option></select></label>
              <label>试卷类型<select value={form.paper_type} onChange={(e) => setForm({ ...form, paper_type: e.target.value })}><option>上午题</option><option>下午题</option><option>专项练习</option></select></label>
              <label>题号<input type="number" min="1" value={form.question_no} onChange={(e) => setForm({ ...form, question_no: e.target.value })} /></label>
            </div>
            <label>知识点<input value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} /></label>
            <label>题干<textarea rows="4" value={form.stem} onChange={(e) => setForm({ ...form, stem: e.target.value })} placeholder="输入题干" /></label>
            <div className="questionOptionFields">
              {form.options.map((option, index) => (
                <label key={index}><span>{String.fromCharCode(65 + index)}</span><input value={option} onChange={(e) => setForm({ ...form, options: form.options.map((item, itemIndex) => itemIndex === index ? e.target.value : item) })} placeholder={`选项 ${String.fromCharCode(65 + index)}`} /></label>
              ))}
            </div>
            <label>正确答案<select value={form.answer} onChange={(e) => setForm({ ...form, answer: Number(e.target.value) })}>{[0, 1, 2, 3].map((value) => <option key={value} value={value}>{String.fromCharCode(65 + value)}</option>)}</select></label>
            {formError ? <p className="questionFormError">{formError}</p> : null}
            <footer><button type="button" onClick={() => setShowAdd(false)}>取消</button><button className="primary" disabled={saving}>{saving ? "保存中…" : "保存题目"}</button></footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
const PageTitle = ({ title, desc, action }) => (
  <div className="pageHead">
    <div>
      <h1>{title}</h1>
      <p>{desc}</p>
    </div>
    {action}
  </div>
);
const localDateKey = (date = new Date()) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const getWeekStartKey = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  return localDateKey(start);
};
const formatWeekRange = (weekStartKey) => {
  const [year, month, day] = weekStartKey.split("-").map(Number);
  const start = new Date(year, month - 1, day);
  const end = new Date(year, month - 1, day + 6);
  const startLabel = `${start.getMonth() + 1}月${start.getDate()}日`;
  const endLabel = `${end.getMonth() + 1}月${end.getDate()}日`;
  return start.getFullYear() === end.getFullYear()
    ? `${startLabel}—${endLabel}`
    : `${start.getFullYear()}年${startLabel}—${end.getFullYear()}年${endLabel}`;
};
const rolloverPlanPeriods = (now = new Date()) => {
  const today = localDateKey(now);
  const currentWeek = getWeekStartKey(now);
  const storedPlanDate = readLocalString("study-desk-plan-date-v1", "");
  const storedWeekKey = readLocalString("study-desk-week-key-v1", "");
  let dailyChanged = false;
  let weeklyChanged = false;

  const scheduledPlans = readLocal(SCHEDULED_PLAN_KEY, {});
  const overdueDates = Object.keys(scheduledPlans).filter((date) => date < today && Array.isArray(scheduledPlans[date]) && scheduledPlans[date].length);
  if (overdueDates.length) {
    const historyByDate = new Map(readLocal("study-desk-plan-history-v1", []).map((record) => [record.date, record]));
    overdueDates.forEach((date) => {
      const existingItems = historyByDate.get(date)?.items || [];
      const existingTitles = new Set(existingItems.map((item) => item[0]));
      const missingItems = scheduledPlans[date].filter((item) => !existingTitles.has(item[0]));
      historyByDate.set(date, { date, items: [...existingItems, ...missingItems] });
    });
    const nextHistory = [...historyByDate.values()].sort((a, b) => b.date.localeCompare(a.date));
    const remainingPlans = { ...scheduledPlans };
    overdueDates.forEach((date) => delete remainingPlans[date]);
    localStorage.setItem("study-desk-plan-history-v1", JSON.stringify(nextHistory));
    localStorage.setItem(SCHEDULED_PLAN_KEY, JSON.stringify(remainingPlans));
    dailyChanged = true;
  }

  if (storedPlanDate !== today) {
    const savedItems = readLocal(PLAN_KEY, []);
    if (savedItems.length) {
      const archiveDate = storedPlanDate || localDateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1));
      const history = readLocal("study-desk-plan-history-v1", []);
      const nextHistory = [
        { date: archiveDate, items: savedItems },
        ...history.filter((record) => record.date !== archiveDate),
      ];
      localStorage.setItem("study-desk-plan-history-v1", JSON.stringify(nextHistory));
    }
    const currentScheduledPlans = readLocal(SCHEDULED_PLAN_KEY, {});
    const todayItems = Array.isArray(currentScheduledPlans[today]) ? currentScheduledPlans[today] : [];
    if (Object.prototype.hasOwnProperty.call(currentScheduledPlans, today)) {
      const remainingPlans = { ...currentScheduledPlans };
      delete remainingPlans[today];
      localStorage.setItem(SCHEDULED_PLAN_KEY, JSON.stringify(remainingPlans));
    }
    localStorage.setItem(PLAN_KEY, JSON.stringify(todayItems));
    localStorage.setItem("study-desk-plan-date-v1", JSON.stringify(today));
    dailyChanged = true;
  }

  if (!storedWeekKey) {
    localStorage.setItem("study-desk-week-key-v1", JSON.stringify(currentWeek));
  } else if (storedWeekKey !== currentWeek) {
    const savedWeekItems = readLocal("study-desk-week-plan-v1", []);
    if (savedWeekItems.length) {
      const history = readLocal("study-desk-week-history-v1", []);
      const nextHistory = [
        { week: storedWeekKey, items: savedWeekItems },
        ...history.filter((record) => record.week !== storedWeekKey),
      ];
      localStorage.setItem("study-desk-week-history-v1", JSON.stringify(nextHistory));
    }
    localStorage.setItem("study-desk-week-plan-v1", JSON.stringify([]));
    localStorage.setItem("study-desk-week-key-v1", JSON.stringify(currentWeek));
    weeklyChanged = true;
  }
  return { dailyChanged, weeklyChanged };
};
function PlanHistory({ dailyRecords, weeklyRecords, onToggleDaily, onToggleWeekly }) {
  const [historyType, setHistoryType] = useState('daily');
  const [historyOpen, setHistoryOpen] = useState(false);
  const records = historyType === 'daily' ? dailyRecords : weeklyRecords;
  return (
    <section className="panel planHistoryPanel">
      <div className="sectionHead"><div><h2>历史计划记录</h2><span>每日 {dailyRecords.length} 组 · 每周 {weeklyRecords.length} 组</span></div><button className={historyOpen ? 'historyPanelToggle open' : 'historyPanelToggle'} onClick={() => setHistoryOpen((value) => !value)}><ChevronRight />{historyOpen ? '收起记录' : '展开记录'}</button></div>
      {historyOpen ? <><div className="historyTypeTabs" role="tablist" aria-label="历史计划类型">
        <button className={historyType === 'daily' ? 'active' : ''} onClick={() => setHistoryType('daily')} role="tab" aria-selected={historyType === 'daily'}>每日计划 <b>{dailyRecords.length}</b></button>
        <button className={historyType === 'weekly' ? 'active' : ''} onClick={() => setHistoryType('weekly')} role="tab" aria-selected={historyType === 'weekly'}>每周安排 <b>{weeklyRecords.length}</b></button>
      </div>
      {records.length ? <div className="historyList">
        {historyType === 'daily' ? dailyRecords.map((record) => {
          const completed = record.items.filter((item) => item[2]).length;
          return <details key={`day-${record.date}`}><summary><span>{record.date} · 今日计划</span><b>{completed}/{record.items.length} 完成</b></summary><div className="historyTasks">{record.items.map((item, index) => <button type="button" className={item[2] ? 'historyTask done' : 'historyTask'} key={`${record.date}-${index}`} onClick={() => onToggleDaily(record.date, index)}><i>{item[2] ? <Check /> : null}</i><span>{item[0]}</span><small>{item[2] ? '已完成' : '补记完成'}</small></button>)}</div></details>;
        }) : weeklyRecords.map((record) => {
          const completed = record.items.filter((item) => item.done).length;
          return <details key={`week-${record.week}`}><summary><span>{formatWeekRange(record.week)} · 本周安排</span><b>{completed}/{record.items.length} 完成</b></summary><div className="historyTasks">{record.items.map((item, index) => <button type="button" className={item.done ? 'historyTask done' : 'historyTask'} key={`${record.week}-${index}`} onClick={() => onToggleWeekly(record.week, index)}><i>{item.done ? <Check /> : null}</i><span>{item.title}</span><small>{item.done ? '已完成' : '补记完成'}</small></button>)}</div></details>;
        })}
      </div> : <p className="historyEmpty">暂无{historyType === 'daily' ? '每日计划' : '每周安排'}历史记录。</p>}</> : <p className="historyCollapsedHint">记录已收起，需要补记完成状态时再展开。</p>}
    </section>
  );
}
function LearningPlan({ items, setItems, planClock }) {
  const [scheduledPlans, setScheduledPlans] = useState(() => readLocal(SCHEDULED_PLAN_KEY, {}));
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState("");
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [itemEditDraft, setItemEditDraft] = useState('');
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [calendarDate, setCalendarDate] = useState(() => new Date());
  const [studyDays, setStudyDays] = useState(() => readLocal('study-desk-study-days-v1', []));
  const [weekItems, setWeekItems] = useState(() => readLocal('study-desk-week-plan-v1', []));
  const [weekDraft, setWeekDraft] = useState('');
  const [weekEditing, setWeekEditing] = useState(false);
  const [editingWeekIndex, setEditingWeekIndex] = useState(null);
  const [weekEditDraft, setWeekEditDraft] = useState('');
  const todayKey = localDateKey(currentDate);
  const [selectedPlanDate, setSelectedPlanDate] = useState(() => localDateKey());
  const weekStart = getWeekStartKey(currentDate);
  const weekRange = formatWeekRange(weekStart);
  const [planDate, setPlanDate] = useState(() => readLocalString('study-desk-plan-date-v1', todayKey));
  const [weekKey, setWeekKey] = useState(() => readLocalString('study-desk-week-key-v1', weekStart));
  const [planHistory, setPlanHistory] = useState(() => readLocal('study-desk-plan-history-v1', []));
  const [weekHistory, setWeekHistory] = useState(() => readLocal('study-desk-week-history-v1', []));
  const [stage, setStage] = useState(() => readLocal('study-desk-stage-v1', '基础学习'));
  const [dailyTarget, setDailyTarget] = useState(() => Number(readLocal(SETTINGS_KEY, defaultSettings).dailyMinutes) || 120);
  useEffect(() => {
    const timer = window.setInterval(() => setCurrentDate(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => localStorage.setItem('study-desk-week-plan-v1', JSON.stringify(weekItems)), [weekItems]);
  useEffect(() => localStorage.setItem(SCHEDULED_PLAN_KEY, JSON.stringify(scheduledPlans)), [scheduledPlans]);
  useEffect(() => {
    const { dailyChanged, weeklyChanged } = rolloverPlanPeriods(currentDate);
    if (dailyChanged) {
      setItems(readLocal(PLAN_KEY, []));
      setScheduledPlans(readLocal(SCHEDULED_PLAN_KEY, {}));
      setSelectedPlanDate(todayKey);
      setPlanDate(readLocalString('study-desk-plan-date-v1', todayKey));
      setPlanHistory(readLocal('study-desk-plan-history-v1', []));
    }
    if (weeklyChanged) {
      setWeekItems(readLocal('study-desk-week-plan-v1', []));
      setWeekKey(readLocalString('study-desk-week-key-v1', weekStart));
      setWeekHistory(readLocal('study-desk-week-history-v1', []));
    }
  }, [currentDate, todayKey, weekStart]);
  useEffect(() => {
    setCurrentDate(planClock);
    setPlanHistory(readLocal('study-desk-plan-history-v1', []));
    setScheduledPlans(readLocal(SCHEDULED_PLAN_KEY, {}));
  }, [planClock]);
  const taskIdentity = (item) => item[0].trim().replace(/^\d+\s*[、.．)）]\s*/, '').trim();
  const latestTasks = new Map();
  [...planHistory].filter((record) => record.date < todayKey).sort((a, b) => a.date.localeCompare(b.date)).forEach((record) => {
    record.items.forEach((item) => latestTasks.set(taskIdentity(item), item));
  });
  const historicalPending = [...latestTasks.values()].filter((item) => !item[2]);
  const carryCandidates = historicalPending.filter((item) => !items.some((todayItem) => taskIdentity(todayItem) === taskIdentity(item)));
  const carryHistory = () => setItems((current) => {
    const titles = new Set(current.map(taskIdentity));
    const additions = historicalPending.filter((item) => {
      if (titles.has(taskIdentity(item))) return false;
      titles.add(taskIdentity(item));
      return true;
    }).map((item) => [item[0], item[1], false]);
    return additions.length ? [...current, ...additions] : current;
  });
  const add = () => {
    if (!title.trim()) return;
    updateSelectedItems((current) => [...current, [title.trim(), "待安排", false]]);
    setTitle("");
    setEditing(false);
  };
  const addWeekItem = (event) => { event.preventDefault(); if (!weekDraft.trim()) return; setWeekItems((v) => [...v, { title: weekDraft.trim(), done: false }]); setWeekDraft(''); setWeekEditing(false); };
  const selectedIsPast = selectedPlanDate < todayKey;
  const selectedHistoryRecord = selectedIsPast ? planHistory.find((record) => record.date === selectedPlanDate) : null;
  const selectedItems = selectedPlanDate === todayKey ? items : selectedIsPast ? (selectedHistoryRecord?.items || []) : (scheduledPlans[selectedPlanDate] || []);
  function updateSelectedItems(updater) {
    if (selectedIsPast) {
      setPlanHistory((current) => {
        const existing = current.find((record) => record.date === selectedPlanDate)?.items || [];
        const nextItems = typeof updater === 'function' ? updater(existing) : updater;
        const next = [{ date: selectedPlanDate, items: nextItems }, ...current.filter((record) => record.date !== selectedPlanDate)]
          .sort((a, b) => b.date.localeCompare(a.date));
        localStorage.setItem('study-desk-plan-history-v1', JSON.stringify(next));
        return next;
      });
      return;
    }
    if (selectedPlanDate === todayKey) {
      setItems((current) => typeof updater === 'function' ? updater(current) : updater);
      return;
    }
    setScheduledPlans((current) => {
      const existing = Array.isArray(current[selectedPlanDate]) ? current[selectedPlanDate] : [];
      const nextItems = typeof updater === 'function' ? updater(existing) : updater;
      const next = { ...current };
      if (nextItems.length) next[selectedPlanDate] = nextItems;
      else delete next[selectedPlanDate];
      return next;
    });
  }
  const saveItemEdit = (event) => {
    event.preventDefault();
    const value = itemEditDraft.trim();
    if (!value || editingItemIndex === null) return;
    updateSelectedItems((current) => current.map((item, index) => index === editingItemIndex ? [value, item[1], item[2]] : item));
    setEditingItemIndex(null);
    setItemEditDraft('');
  };
  const saveWeekEdit = (event) => {
    event.preventDefault();
    const value = weekEditDraft.trim();
    if (!value || editingWeekIndex === null) return;
    setWeekItems((current) => current.map((item, index) => index === editingWeekIndex ? { ...item, title: value } : item));
    setEditingWeekIndex(null);
    setWeekEditDraft('');
  };
  const toggleDailyHistory = (date, itemIndex) => {
    const next = planHistory.map((record) => record.date === date ? { ...record, items: record.items.map((item, index) => index === itemIndex ? [item[0], item[1], !item[2]] : item) } : record);
    setPlanHistory(next);
    localStorage.setItem('study-desk-plan-history-v1', JSON.stringify(next));
  };
  const toggleWeeklyHistory = (week, itemIndex) => {
    const next = weekHistory.map((record) => record.week === week ? { ...record, items: record.items.map((item, index) => index === itemIndex ? { ...item, done: !item.done } : item) } : record);
    setWeekHistory(next);
    localStorage.setItem('study-desk-week-history-v1', JSON.stringify(next));
  };
  const toggleStudyDay = (date) => {
    setStudyDays((days) => {
      const next = days.includes(date) ? days.filter((item) => item !== date) : [...days, date];
      localStorage.setItem('study-desk-study-days-v1', JSON.stringify(next));
      return next;
    });
  };
  return (
    <div className="featurePage">
      <PageTitle title="学习计划" desc="根据考试日期灵活安排每天的学习、刷题与复习任务。" />
      <div className="featureStats">
        <article>
          <small>今日完成</small>
          <b>
            {items.filter((x) => x[2]).length} / {items.length}
          </b>
          <span>完成后自动保存</span>
        </article>
        <article>
          <small>今日预计</small>
            <b className="dailyTargetEditor"><input type="number" min="1" max="1440" value={dailyTarget} onChange={(event) => { const value = normalizeDailyMinutes(event.target.value); setDailyTarget(value); const settings = readLocal(SETTINGS_KEY, defaultSettings); localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...settings, dailyMinutes: value })); }} /> 分钟</b>
            <span>每日学习目标（可直接修改）</span>
        </article>
        <article>
          <small>当前阶段</small>
            <b><select className="stageSelect" value={stage} onChange={(event) => { setStage(event.target.value); localStorage.setItem('study-desk-stage-v1', event.target.value); }}><option>基础学习</option><option>专项练习</option><option>历年真题</option><option>错题复习</option><option>考前冲刺</option></select></b>
            <span>当前备考阶段</span>
        </article>
      </div>
      <section className="panel planCalendar">
        <div className="calendarMonthHead"><button onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>‹</button><h2>{calendarDate.getFullYear()}年{calendarDate.getMonth() + 1}月</h2><button onClick={() => setCalendarDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>›</button></div>
        <div className="calendarWeekLabels">{['日','一','二','三','四','五','六'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="planCalendarGrid month">{Array.from({ length: new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1).getDay() }, (_, i) => <i key={`empty-${i}`} />)}{Array.from({ length: new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0).getDate() }, (_, i) => { const day = i + 1; const key = `${calendarDate.getFullYear()}-${String(calendarDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; const completed = studyDays.includes(key); return <button key={key} className={`${completed ? 'completed' : ''} ${key === todayKey ? 'selected' : ''} ${key === selectedPlanDate ? 'planning' : ''}`} onClick={() => { setSelectedPlanDate(key); setEditingItemIndex(null); setItemEditDraft(''); setEditing(false); }} onDoubleClick={() => toggleStudyDay(key)}><b>{day}</b>{completed && <Check />}</button>; })}</div>
        <p className="calendarHint">单击日期安排当天计划 · 双击日期打勾或取消 · 累计完成学习 {studyDays.length} 天</p>
      </section>
      <div className="twoColumns">
        <section className="panel">
          <div className="sectionHead">
            <h2>{selectedPlanDate === todayKey ? '今日计划' : selectedIsPast ? '当日学习记录' : '日期计划'} <button className="inlineAdd" onClick={() => setEditing((v) => !v)}>＋</button></h2>
            <div className="selectedPlanDate"><span>{selectedPlanDate.replaceAll('-', '/')}</span>{selectedPlanDate !== todayKey ? <button onClick={() => setSelectedPlanDate(todayKey)}>返回今天</button> : null}</div>
          </div>
          {selectedPlanDate === todayKey && carryCandidates.length > 0 ? <button className="importBtn" onClick={carryHistory}>{`将历史未完成项加入今天（${carryCandidates.length} 项）`}</button> : null}
          {selectedItems.map((x, i) => (
            <div className="editableTask" key={x[0] + i}>
              {editingItemIndex === i ? <form className="inlineTaskRename" onSubmit={saveItemEdit}><input autoFocus value={itemEditDraft} onChange={(event) => setItemEditDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setEditingItemIndex(null); setItemEditDraft(''); } }} /><button className="primary" type="submit">保存</button><button type="button" onClick={() => { setEditingItemIndex(null); setItemEditDraft(''); }}>取消</button></form> : <>
              <button
                className="task large"
                onClick={() => selectedIsPast
                  ? toggleDailyHistory(selectedPlanDate, i)
                  : updateSelectedItems((v) => v.map((a, j) => (j === i ? [a[0], a[1], !a[2]] : a)))}
              >
                <i className={x[2] ? "checked" : ""}>
                  {x[2] ? <Check /> : null}
                </i>
                <div onClick={(event) => event.stopPropagation()} onDoubleClick={() => { if (!selectedIsPast) { setEditingItemIndex(i); setItemEditDraft(x[0]); } }} title={selectedIsPast ? '历史学习记录' : '双击修改计划内容'}>
                  <b>{x[0]}</b>
                  <span>{x[1]}</span>
                </div>
                <small>{x[2] ? "已完成" : "待完成"}</small>
              </button>
              {!selectedIsPast ? <button
                className="deleteTask"
                title="删除"
                onClick={() => updateSelectedItems((v) => v.filter((_, j) => j !== i))}
              >
                <X />
              </button> : null}
              </>}
            </div>
          ))}
          {selectedIsPast && !selectedItems.length ? <p className="historyEmpty">当天暂无归档学习记录。</p> : null}
          {editing ? <form className="inlinePlanEditor" onSubmit={(event) => { event.preventDefault(); add(); }}><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例如：复习操作系统进程调度" /><button className="primary" type="submit">保存</button><button type="button" onClick={() => { setEditing(false); setTitle(''); }}>取消</button></form> : null}
        </section>
        <section className="panel weekPlan">
          <div className="sectionHead">
            <h2>本周安排 <span className="weekRange">{weekRange}</span></h2>
            <button className="inlineAdd" onClick={() => setWeekEditing((v) => !v)}>添加安排</button>
          </div>
          {weekItems.map((item, i) => <div className="weekPlanRow" key={`${item.title}-${i}`}>{editingWeekIndex === i ? <form className="inlineTaskRename weekTaskRename" onSubmit={saveWeekEdit}><input autoFocus value={weekEditDraft} onChange={(event) => setWeekEditDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') { setEditingWeekIndex(null); setWeekEditDraft(''); } }} /><button className="primary" type="submit">保存</button><button type="button" onClick={() => { setEditingWeekIndex(null); setWeekEditDraft(''); }}>取消</button></form> : <><button className={`weekCheck ${item.done ? 'done' : ''}`} onClick={() => setWeekItems((v) => v.map((x, j) => j === i ? { ...x, done: !x.done } : x))}>{item.done ? <Check /> : i + 1}</button><span onDoubleClick={() => { setEditingWeekIndex(i); setWeekEditDraft(item.title); }} title="双击修改安排内容">{item.title}</span><small>{item.done ? '已完成' : '待学习'}</small><button className="deleteTask" title="删除" onClick={() => setWeekItems((v) => v.filter((_, j) => j !== i))}><X /></button></>}</div>)}
          {weekEditing && <form className="inlinePlanEditor" onSubmit={addWeekItem}><input autoFocus value={weekDraft} onChange={(event) => setWeekDraft(event.target.value)} placeholder="例如：周六 · 完成一套真题" /><button className="primary" type="submit">保存</button><button type="button" onClick={() => { setWeekEditing(false); setWeekDraft(''); }}>取消</button></form>}
        </section>
      </div>
      <PlanHistory dailyRecords={planHistory} weeklyRecords={weekHistory} onToggleDaily={toggleDailyHistory} onToggleWeekly={toggleWeeklyHistory} />
    </div>
  );
}
const gptSets = [];
const GPT_PAPER_MODULES = FOCUS_MODULES.filter((name) =>
  name.startsWith("上午题") || name.startsWith("下午题"),
);
function GptPapers({ onPractice }) {
  const [preview, setPreview] = useState("");
  const [paperFilter, setPaperFilter] = useState("全部");
  const [selectedModule, setSelectedModule] = useState("");
  const [customSets, setCustomSets] = useState(() => readLocal("study-desk-gpt-sets-v1", []));
  const [showAdd, setShowAdd] = useState(false);
  const [draft, setDraft] = useState({ module: GPT_PAPER_MODULES[0], title: "", count: "", source: "" });
  const visibleModules = useMemo(
    () => GPT_PAPER_MODULES.filter((name) => paperFilter === "全部" || name.startsWith(paperFilter)),
    [paperFilter],
  );
  const allSets = [...gptSets, ...customSets];
  const activeSets = selectedModule ? allSets.filter((item) => item[4] === selectedModule || (!item[4] && selectedModule === GPT_PAPER_MODULES[0])) : [];
  const activeQuestionCount = activeSets.reduce((total, item) => total + item[1], 0);
  return (
    <div className="featurePage">
      <PageTitle
        title="GPT 专题真题"
        desc="集中管理学习过程中由 GPT 查找、整理并配套讲解的专题真题。"
        action={
          <button className="primary pageAction" onClick={() => setShowAdd(true)}>
            <Sparkles />
            新增
          </button>
        }
      />
      <div className="notice">
        <ShieldCheck />
        <div>
          <b>题目来源需要核对</b>
          <span>
            “已核对”表示已与本地历年真题或答案资料比对；待核对题目不会混入正式模拟考试。
          </span>
        </div>
      </div>
      <div className="gptModuleToolbar">
        <div>
          {[
            ["全部", "全部模块"],
            ["上午题", "上午题"],
            ["下午题", "下午题"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={paperFilter === key ? "active" : ""}
              onClick={() => {
                setPaperFilter(key);
                setSelectedModule("");
                setPreview("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <span>共 {visibleModules.length} 个考试模块</span>
      </div>
      {showAdd ? (
        <form className="gptAddForm" onSubmit={(event) => {
          event.preventDefault();
          if (!draft.title.trim() || !draft.count) return;
          const item = [draft.title.trim(), Number(draft.count), "待核对", draft.source.trim() || "GPT 新增专题", draft.module];
          setCustomSets((items) => {
            const next = [...items, item];
            localStorage.setItem("study-desk-gpt-sets-v1", JSON.stringify(next));
            return next;
          });
          setSelectedModule(draft.module);
          setShowAdd(false);
          setDraft({ module: draft.module, title: "", count: "", source: "" });
        }}>
          <strong>新增 GPT 专题</strong>
          <select value={draft.module} onChange={(event) => setDraft((v) => ({ ...v, module: event.target.value }))}>
            {GPT_PAPER_MODULES.map((name) => <option key={name}>{name}</option>)}
          </select>
          <input required value={draft.title} onChange={(event) => setDraft((v) => ({ ...v, title: event.target.value }))} placeholder="专题名称" />
          <input required type="number" min="1" value={draft.count} onChange={(event) => setDraft((v) => ({ ...v, count: event.target.value }))} placeholder="题量" />
          <input value={draft.source} onChange={(event) => setDraft((v) => ({ ...v, source: event.target.value }))} placeholder="来源文件（可选）" />
          <button className="primary" type="submit">保存</button>
          <button type="button" onClick={() => setShowAdd(false)}>取消</button>
        </form>
      ) : null}
      {selectedModule ? (
        <div className="gptModuleHead">
          <button onClick={() => { setSelectedModule(""); setPreview(""); }}>
            <ChevronRight />
            返回模块
          </button>
          <div>
            <h2>{selectedModule}</h2>
            <p>{activeSets.length} 个专题 · {activeQuestionCount} 道真题</p>
          </div>
        </div>
      ) : null}
      {preview ? (
        <section className="panel setPreview">
          <div>
            <h2>{preview}</h2>
            <p>
              当前演示题已录入 {quizQuestions[preview]?.length || 0}{" "}
              道，正式导入资料后会显示完整题量。
            </p>
          </div>
          <button onClick={() => setPreview("")}>
            <X />
          </button>
        </section>
      ) : null}
      {selectedModule ? (
        activeSets.length ? <div className="gptSetGrid">
        {activeSets.map((x) => (
          <article className="panel" key={x[0]}>
            <div className="setIcon">
              <Bot />
            </div>
            <div>
              <h2>{x[0]}</h2>
              <p>{x[3]}</p>
            </div>
            <div className="setMeta">
              <span>{x[1]} 道真题</span>
              <i className={x[2] === "已核对" ? "verified" : "pending"}>
                {x[2]}
              </i>
            </div>
            <div className="setActions">
              <button onClick={() => setPreview(x[0])}>查看题目</button>
              <button
                className="primary"
                disabled={!quizQuestions[x[0]]}
                onClick={() => onPractice(x[0])}
              >
                {quizQuestions[x[0]] ? "开始练习" : "待导入"}
              </button>
            </div>
          </article>
        ))}
        </div> : <div className="gptModuleEmpty">该模块暂时没有 GPT 专题真题，后续可通过“新增专题”加入。</div>
      ) : (
        <div className="gptModuleList">
          {visibleModules.map((name) => {
            const moduleSets = allSets.filter((item) => item[4] === name || (!item[4] && name === GPT_PAPER_MODULES[0]));
            const hasSets = moduleSets.length > 0;
            const questionCount = moduleSets.reduce((total, item) => total + item[1], 0);
            return (
              <button key={name} onClick={() => setSelectedModule(name)}>
                <Folder />
                <b>{name}</b>
                <span>{hasSets ? `${moduleSets.length} 个专题 · ${questionCount} 道题` : "0 个专题"}</span>
                <ChevronRight />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
function Quiz({ title, onClose, onWrong }) {
  const questions = quizQuestions[title] || [];
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = questions[index];
  const answer = (i) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === q.answer) setScore((v) => v + 1);
    else
      onWrong({
        title: q.q,
        topic: title,
        cause: "本次答错",
        review: "今天",
        answer: q.options[q.answer],
        explain: q.explain,
      });
  };
  const next = () => {
    if (index === questions.length - 1) setFinished(true);
    else {
      setIndex((v) => v + 1);
      setSelected(null);
    }
  };
  return (
    <div className="quizOverlay">
      <section className="quizDialog">
        <header>
          <div>
            <small>专题练习</small>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        {finished ? (
          <div className="quizResult">
            <Check />
            <h2>本组练习完成</h2>
            <strong>
              {score} / {questions.length}
            </strong>
            <p>答错题目已自动加入“错题复习”。</p>
            <button className="primary" onClick={onClose}>
              返回专题
            </button>
          </div>
        ) : (
          <>
            <div className="quizProgress">
              <i
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </div>
            <p className="questionNo">
              第 {index + 1} / {questions.length} 题
            </p>
            <h3>{q.q}</h3>
            <div className="optionList">
              {q.options.map((x, i) => (
                <button
                  key={x}
                  onClick={() => answer(i)}
                  className={
                    selected === null
                      ? ""
                      : i === q.answer
                        ? "correct"
                        : i === selected
                          ? "wrong"
                          : ""
                  }
                >
                  <i>{String.fromCharCode(65 + i)}</i>
                  {x}
                </button>
              ))}
            </div>
            <ScratchPad key={q.q} question={{ ...q, id: `${title}-${index}` }} />
            {selected !== null ? (
              <div className="explanation">
                <b>
                  {selected === q.answer
                    ? "回答正确"
                    : "回答错误，已加入错题本"}
                </b>
                <span>{q.explain}</span>
              </div>
            ) : null}
            <footer>
              <span>即时判分模式</span>
              <button
                className="primary"
                disabled={selected === null}
                onClick={next}
              >
                {index === questions.length - 1 ? "查看结果" : "下一题"}
                <ChevronRight />
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
function ScratchPad({ question }) {
  const draftKey = `question-${question.id}`;
  const [mode, setMode] = useState("text");
  const [text, setText] = useState("");
  const [strokes, setStrokes] = useState([]);
  const [tool, setTool] = useState("pen");
  const [aiText, setAiText] = useState("");
  const [asking, setAsking] = useState(false);
  const canvasRef = useRef(null);
  const activeStroke = useRef(null);

  useEffect(() => {
    const drafts = readLocal(DRAFT_KEY, {});
    if (drafts[draftKey]) {
      const savedDraft = drafts[draftKey];
      setMode(savedDraft.mode || 'text');
      setText(savedDraft.text || '');
      setStrokes(savedDraft.strokes || []);
    }
  }, [draftKey]);

  const persist = (patch) => {
    const drafts = readLocal(DRAFT_KEY, {});
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({
        ...drafts,
        [draftKey]: {
          ...drafts[draftKey],
          mode,
          text,
          strokes,
          updatedAt: new Date().toISOString(),
          ...patch,
        },
      }),
    );
  };

  useEffect(() => {
    const timer = setTimeout(() => persist({ text }), 500);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = "round";
    context.lineJoin = "round";
    strokes.forEach((stroke) => {
      if (stroke.points.length < 2) return;
      context.globalCompositeOperation = stroke.tool === "eraser" ? "destination-out" : "source-over";
      context.strokeStyle = "#355f49";
      context.lineWidth = stroke.tool === "eraser" ? 18 : 3;
      context.beginPath();
      context.moveTo(stroke.points[0].x, stroke.points[0].y);
      stroke.points.slice(1).forEach((point) => context.lineTo(point.x, point.y));
      context.stroke();
    });
    context.globalCompositeOperation = "source-over";
  }, [strokes, mode]);

  const pointFromEvent = (event) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return {
      x: Math.round(((event.clientX - rect.left) / rect.width) * canvas.width),
      y: Math.round(((event.clientY - rect.top) / rect.height) * canvas.height),
    };
  };
  const startDrawing = (event) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    activeStroke.current = { tool, points: [pointFromEvent(event)] };
  };
  const draw = (event) => {
    if (!activeStroke.current) return;
    event.preventDefault();
    const point = pointFromEvent(event);
    const previous = activeStroke.current.points.at(-1);
    activeStroke.current.points.push(point);
    const context = canvasRef.current.getContext("2d");
    context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "#355f49";
    context.lineWidth = tool === "eraser" ? 18 : 3;
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(previous.x, previous.y);
    context.lineTo(point.x, point.y);
    context.stroke();
  };
  const finishDrawing = () => {
    const stroke = activeStroke.current;
    if (!stroke) return;
    activeStroke.current = null;
    if (stroke.points.length < 2) return;
    const next = [...strokes, stroke];
    setStrokes(next);
    persist({ strokes: next });
  };
  const undo = () => {
    const next = strokes.slice(0, -1);
    setStrokes(next);
    persist({ strokes: next });
  };
  const clear = () => {
    if (!text && !strokes.length) return;
    if (!window.confirm("确定清空这道题的草稿吗？")) return;
    setText("");
    setStrokes([]);
    setAiText("");
    persist({ text: "", strokes: [] });
  };
  const changeMode = (nextMode) => {
    setMode(nextMode);
    persist({ mode: nextMode });
  };
  const askAI = () => {
    const prompt = `请讲解这道软件设计师考试题，先给解题思路，再说明正确答案依据和易错点。\n题目：${question.stem || question.title || ''}\n${(question.options || []).map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n")}\n我的答案：${text || "尚未作答"}`;
    openExternalChatGPT(prompt);
    setAiText("题目已复制，正在打开 ChatGPT；请在 ChatGPT 中粘贴发送。");
  };

  return (
    <section className="scratchPad">
      <div className="scratchHeader">
        <div><b>草稿区</b><small>按题自动保存</small></div>
        <div className="scratchModes">
          <button className={mode === "text" ? "active" : ""} onClick={() => changeMode("text")}><PenLine />文字</button>
          <button className={mode === "draw" ? "active" : ""} onClick={() => changeMode("draw")}><Sparkles />手写</button>
        </div>
      </div>
      {mode === "text" ? (
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="记录计算过程、排除思路或易错点……" />
      ) : (
        <>
          <div className="drawTools">
            <button className={tool === "pen" ? "active" : ""} onClick={() => setTool("pen")}>画笔</button>
            <button className={tool === "eraser" ? "active" : ""} onClick={() => setTool("eraser")}>橡皮</button>
            <button disabled={!strokes.length} onClick={undo}><RotateCcw />撤销</button>
            <span>长画布，可上下滚动</span>
          </div>
          <div className="scratchCanvasScroller">
            <canvas ref={canvasRef} width="720" height="640" onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={finishDrawing} onPointerCancel={finishDrawing} />
          </div>
        </>
      )}
      <div className="scratchActions">
        <span><Save />草稿已自动保存</span>
        <button className="clearDraft" onClick={clear}>一键清空</button>
        <button className="askAi" disabled={asking} onClick={askAI}><Bot />{asking ? "正在思考…" : "AI 提示"}</button>
      </div>
      {aiText ? <div className="aiHint"><b>AI 学习提示</b><p>{aiText}</p></div> : null}
    </section>
  );
}
function DatabaseQuiz({ session, onClose, onWrong }) {
  const questions = session.questions;
  const [index, setIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const q = questions[index];
  const answer = (choice) => {
    if (selected !== null) return;
    setSelected(choice);
    const correct = choice === q.answer;
    if (correct) setScore((v) => v + 1);
    const stats = readLocal(ANSWER_KEY, { total: 0, correct: 0 });
    localStorage.setItem(
      ANSWER_KEY,
      JSON.stringify({
        total: stats.total + 1,
        correct: stats.correct + (correct ? 1 : 0),
      }),
    );
    if (!correct)
      onWrong({
        title: q.stem,
        topic: q.topic,
        cause: `${q.year} ${q.season}第 ${q.question_no} 题`,
        review: "今天",
        answer: q.options[q.answer],
        explain: q.explanation,
      });
  };
  const next = () => {
    if (index === questions.length - 1) setFinished(true);
    else {
      setIndex((v) => v + 1);
      setSelected(null);
    }
  };
  return (
    <div className="quizOverlay">
      <section className="quizDialog databaseQuiz">
        <header>
          <div>
            <small>SQLite 真实题库</small>
            <h2>{session.title}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </header>
        {finished ? (
          <div className="quizResult">
            <Check />
            <h2>练习完成</h2>
            <strong>
              {score} / {questions.length}
            </strong>
            <p>
              正确率 {Math.round((score / questions.length) * 100)}
              %，错题已自动保存。
            </p>
            <button className="primary" onClick={onClose}>
              返回题库
            </button>
          </div>
        ) : (
          <>
            <div className="quizProgress">
              <i
                style={{ width: `${((index + 1) / questions.length) * 100}%` }}
              />
            </div>
            <p className="questionNo">
              第 {index + 1} / {questions.length} 题　·　{q.year} 年{q.season}
              原第 {q.question_no} 题
            </p>
            <h3>{q.stem}</h3>
            <div className="optionList">
              {q.options.map((x, i) => (
                <button
                  key={`${i}-${x}`}
                  onClick={() => answer(i)}
                  className={
                    selected === null
                      ? ""
                      : i === q.answer
                        ? "correct"
                        : i === selected
                          ? "wrong"
                          : ""
                  }
                >
                  <i>{String.fromCharCode(65 + i)}</i>
                  {x}
                </button>
              ))}
            </div>
            <ScratchPad key={q.id} question={q} />
            {selected !== null ? (
              <div className="explanation">
                <b>
                  {selected === q.answer
                    ? "回答正确"
                    : `回答错误，正确答案是 ${String.fromCharCode(65 + q.answer)}`}
                </b>
                <span>
                  {q.explanation || "该题暂未提取到解析，答案已按原文导入。"}
                </span>
                <small>来源：{q.source}</small>
              </div>
            ) : null}
            <footer>
              <span>每题立即判分</span>
              <button
                className="primary"
                disabled={selected === null}
                onClick={next}
              >
                {index === questions.length - 1 ? "查看结果" : "下一题"}
                <ChevronRight />
              </button>
            </footer>
          </>
        )}
      </section>
    </div>
  );
}
function WrongQuestionModal({ item, onClose, onToggleMastery }) {
  const [revealed, setRevealed] = useState(false);
  return (
    <div className="quizOverlay wrongQuestionOverlay">
      <section className="quizDialog wrongQuestionDialog">
        <header><div><small>错题复习 · 大字模式</small><h2>{item.topic || "错题"}</h2></div><button onClick={onClose}><X /></button></header>
        <div className="quizProgress"><i style={{ width: "100%" }} /></div>
        <p className="questionNo">累计答错 {item.attempts || 1} 次 · {item.cause || "本次答错"}</p>
        <h3>{item.title}</h3>
        {revealed ? <div className="wrongAnswerBox"><b>正确答案</b><span>{item.answer || "请查看解析"}</span>{item.explain ? <p>{item.explain}</p> : null}</div> : <div className="answerHidden">先独立回忆并完成草稿，完成后再查看答案。</div>}
        <ScratchPad key={item.title} question={{ ...item, id: `wrong-${item.title}` }} />
        <footer><span>{revealed ? "答案已显示，可整理错因" : "完成作答后查看答案"}</span>{revealed ? <button className="primary" onClick={() => { onToggleMastery(item.title); onClose(); }}>{item.mastered ? "重新复习" : "标记已掌握"}</button> : <button className="primary" onClick={() => setRevealed(true)}>完成作答，查看答案</button>}</footer>
      </section>
    </div>
  );
}
function WrongReview({ wrong, onRemove, onReview }) {
  const pending = wrong.filter((item) => !item.mastered);
  const mastered = wrong.filter((item) => item.mastered);
  const [view, setView] = useState("pending");
  return (
    <div className="featurePage">
      <PageTitle
        title="错题复习"
        desc="答错的题会自动进入这里，掌握后会保存在“已掌握”区域。"
        action={
          <button className="primary pageAction" onClick={() => { setView("pending"); if (pending[0]) onReview(pending[0]); }}>
            <RotateCcw />
            开始今日复习
          </button>
        }
      />
      <div className="featureStats">
        <article>
          <small>全部错题</small>
          <b>{pending.length}</b>
          <span>本机实时保存</span>
        </article>
        <article>
          <small>今日待复习</small>
          <b>{pending.filter((x) => x.review === "今天").length}</b>
          <span>建议优先完成</span>
        </article>
        <article>
          <small>复习规则</small>
          <b>即时反馈</b>
          <span>掌握后手动移出</span>
        </article>
      </div>
      <div className="wrongMiniModules">
        <button className={view === "pending" ? "active" : ""} onClick={() => setView("pending")}><span>待复习错题</span><b>{pending.length}</b><small>答错后自动进入</small></button>
        <button className={view === "mastered" ? "active mastered" : "mastered"} onClick={() => setView("mastered")}><span>已掌握</span><b>{mastered.length}</b><small>掌握后保留记录</small></button>
      </div>
      {view === "pending" ? <section className="panel dataList" id="pendingWrong">
        <div className="listTools">
          <h2>待复习错题</h2>
          <span>{pending.length ? "按最近答错排序" : "暂时没有待复习错题"}</span>
        </div>
        {pending.map((x, i) => (
            <div className="wrongRow" key={x.title + i} onClick={() => onReview(x)}>
            <i>{i + 1}</i>
            <div>
              <b>{x.title}</b>
              <span>
                {x.topic} · {x.cause}
                {` · 已错 ${x.attempts || 1} 次`}
                {x.explain ? ` · ${x.explain}` : ""}
              </span>
            </div>
            <small>正确答案：{x.answer || "查看解析"}</small>
            <button onClick={(event) => { event.stopPropagation(); onRemove(x.title); }}>已掌握</button>
          </div>
        ))}
      </section> : <section className="panel dataList masteredList">
        <div className="listTools">
          <h2>已掌握</h2>
          <span>{mastered.length ? `${mastered.length} 道题已掌握` : "掌握后的题目会显示在这里"}</span>
        </div>
        {mastered.map((x, i) => (
          <div className="wrongRow masteredRow" key={`mastered-${x.title}-${i}`} onClick={() => onReview(x)}>
            <i>✓</i>
            <div><b>{x.title}</b><span>{x.topic} · 累计答错 {x.attempts || 1} 次</span></div>
            <button onClick={(event) => { event.stopPropagation(); onRemove(x.title); }}>重新复习</button>
          </div>
        ))}
      </section>}
    </div>
  );
}
function QuestionHub({ tab, onTabChange, onPractice, onGptPractice, wrong, onRemoveWrong, onReview }) {
  const sections = [
    ["bank", BookOpen, "题库练习"],
    ["gpt", Bot, "GPT 专题真题"],
    ["wrong", AlertCircle, "错题复习", wrong.filter((item) => !item.mastered).length],
    ["drafts", PenLine, "草稿记录"],
  ];
  return (
    <div className="questionHub">
      <nav className="questionHubTabs" aria-label="题库板块">
        {sections.map(([key, Icon, label, count]) => (
          <button
            key={key}
            className={tab === key ? "active" : ""}
            onClick={() => onTabChange(key)}
            aria-current={tab === key ? "page" : undefined}
          >
            <Icon />
            <span>{label}</span>
            {typeof count === "number" && count > 0 ? <small>{count}</small> : null}
          </button>
        ))}
      </nav>
      {tab === "gpt" ? (
        <GptPapers onPractice={onGptPractice} />
      ) : tab === "wrong" ? (
        <WrongReview wrong={wrong} onRemove={onRemoveWrong} onReview={onReview} />
      ) : tab === "drafts" ? (
        <DraftRecords />
      ) : (
        <QuestionBank onPractice={onPractice} />
      )}
    </div>
  );
}
function DraftRecords() {
  const [drafts, setDrafts] = useState(() => readLocal(DRAFT_KEY, {}));
  const entries = Object.entries(drafts).sort(([, a], [, b]) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  const remove = (key) => {
    const next = { ...drafts };
    delete next[key];
    setDrafts(next);
    localStorage.setItem(DRAFT_KEY, JSON.stringify(next));
  };
  return (
    <div className="featurePage draftRecordsPage">
      <PageTitle title="草稿记录" desc="查看做题过程中保存的文字和手写草稿。" />
      <section className="panel dataList">
        <div className="listTools"><h2>已保存草稿</h2><span>{entries.length ? `${entries.length} 道题` : "暂无草稿"}</span></div>
        {entries.length ? entries.map(([key, draft]) => (
          <div className="draftRecordRow" key={key}>
            <div><b>{key.replace(/^question-/, "")}</b><span>{draft.text ? draft.text.slice(0, 100) : "手写草稿"}</span><small>{draft.strokes?.length || 0} 条笔迹 · {draft.updatedAt ? new Date(draft.updatedAt).toLocaleString() : "刚刚"}</small></div>
            <button onClick={() => remove(key)}>删除</button>
          </div>
        )) : <div className="draftEmpty">完成题目过程中输入文字或手写内容后，会自动出现在这里。</div>}
      </section>
    </div>
  );
}
function CourseProgress() {
  const defaultModules = ['上午题—计算机系统（5~6分）','上午题—程序设计语言（固定6分）','下午题—试题一（15分）','上午题—知识产权（2~3分）','上午题—数据库（固定6分）','下午题—试题二（15分）','上午题—面向对象（3~4分）','上午题—UML（3~4分）','下午题—试题三（15分）','上午题—设计模式（固定4分）','下午题—试题六（15分）','上午题—操作系统（固定6分）','上午题—结构化开发（3~4分）','上午题—软件工程（上）','上午题—软件工程（下）','上午题—信息安全（5分左右）','上午题—计算机网络（固定5分）','上午题—数据结构（上）','上午题—数据结构（下）','上午题—算法（4~5分）','下午题—试题四（15分）'];
  const seedModules = () => defaultModules.map((name, index) => ({
    id: `course-${index + 1}`,
    name,
    videos: [{ id: `video-${index + 1}-1`, title: `${name.replace(/（.*?）/g, '')} · 核心知识精讲`, url: '', status: index === 0 ? 'studying' : 'idle' }],
  }));
  const [tab, setTab] = useState(() => location.hash === '#course-materials' ? 'materials' : 'courses');
  useEffect(() => {
    const refreshTab = () => setTab(location.hash === '#course-materials' ? 'materials' : 'courses');
    window.addEventListener('hashchange', refreshTab);
    return () => window.removeEventListener('hashchange', refreshTab);
  }, []);
  const [modules, setModules] = useState(() => readLocal('study-desk-course-modules-v2', []));
  const [expanded, setExpanded] = useState(() => new Set());
  const [openModuleMenu, setOpenModuleMenu] = useState(null);
  const [openVideoMenu, setOpenVideoMenu] = useState(null);
  const [draggedVideo, setDraggedVideo] = useState(null);
  const [materials, setMaterials] = useState([]);
  const [materialStats, setMaterialStats] = useState({ total: 0, bytes: 0, categories: [] });
  const [materialFilter, setMaterialFilter] = useState('all');
  const [materialFolder, setMaterialFolder] = useState(null);
  const [materialLoading, setMaterialLoading] = useState(false);
  const [customFolders, setCustomFolders] = useState(() => readLocal('study-desk-material-folders-v1', []));
  const [addedMaterials, setAddedMaterials] = useState(() => readLocal('study-desk-added-materials-v1', []));
  const [hiddenMaterialPaths, setHiddenMaterialPaths] = useState(() => readLocal('study-desk-hidden-materials-v1', []));
  const [removedMaterialFolders, setRemovedMaterialFolders] = useState(() => readLocal('study-desk-removed-folders-v1', []));
  const [folderFormOpen, setFolderFormOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [materialFormOpen, setMaterialFormOpen] = useState(false);
  const [materialPath, setMaterialPath] = useState('');
  const saveModules = (next) => { setModules(next); localStorage.setItem('study-desk-course-modules-v2', JSON.stringify(next)); };
  const updateVideo = (moduleId, videoId, patch) => saveModules(modules.map((m) => m.id === moduleId ? { ...m, videos: m.videos.map((v) => v.id === videoId ? { ...v, ...patch } : v) } : m));
  const totals = modules.reduce((acc, m) => {
    m.videos.forEach((video) => {
      const duration = Number(video.duration) || 0;
      acc.all += 1;
      acc.totalSeconds += duration;
      if (video.status === 'completed') {
        acc.done += 1;
        acc.doneSeconds += duration;
      }
    });
    return acc;
  }, { all: 0, done: 0, totalSeconds: 0, doneSeconds: 0 });
  const overall = totals.all ? Math.round(totals.done / totals.all * 100) : 0;
  const courseVideos = modules.flatMap((m) => m.videos.map((v) => ({ ...v, moduleId: m.id, moduleName: m.name })));
  const lastVideo = courseVideos.find((v) => v.status === 'studying')
    || courseVideos.find((v) => v.status === 'idle')
    || courseVideos.at(-1);
  const toggle = (id) => setExpanded((value) => { const next = new Set(value); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const addModule = () => { const name = window.prompt('请输入新版块名称'); if (!name?.trim()) return; saveModules([...modules, { id: `course-${Date.now()}`, name: name.trim(), videos: [] }]); };
  const deleteModule = (id) => { if (!window.confirm('从课程进度中删除这个版块？不会删除原始资料文件。')) return; saveModules(modules.filter((m) => m.id !== id)); setOpenModuleMenu(null); };
  const parseDuration = (value) => { const parts = String(value || '').trim().split(':').map(Number); if (parts.some(Number.isNaN)) return 0; if (parts.length === 2) return parts[0] * 60 + parts[1]; if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]; return 0; };
  const formatDuration = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const formatDurationSummary = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(seconds / 3600);
    const remainingMinutes = Math.floor((seconds % 3600) / 60);
    return `${minutes} 分钟（${hours} 小时 ${remainingMinutes} 分）`;
  };
  const cleanVideoTitle = (value) => String(value || '').replace(/^\s*\d+[.)、．]\s*/, '').trim();
  const addVideo = (moduleId) => { const title = window.prompt('请输入视频标题'); if (!title?.trim()) return; const url = window.prompt('请输入 B 站视频链接（可以暂时留空）') || ''; const duration = window.prompt('请输入视频时长，例如 04:11（可留空）') || ''; saveModules(modules.map((m) => m.id === moduleId ? { ...m, videos: [...m.videos, { id: `video-${Date.now()}`, title: title.trim(), url: url.trim(), duration: parseDuration(duration), status: 'idle' }] } : m)); };
  const batchAdd = (moduleId) => { const content = window.prompt('每行一个视频，格式：标题 | 时长 | 链接（标题前不要写序号）'); if (!content?.trim()) return; const additions = content.split(/\r?\n/).map((line, index) => { const [title, duration = '', url = ''] = line.split('|'); return title?.trim() ? { id: `video-${Date.now()}-${index}`, title: cleanVideoTitle(title), duration: parseDuration(duration), url: url.trim(), status: 'idle' } : null; }).filter(Boolean); if (additions.length) saveModules(modules.map((m) => m.id === moduleId ? { ...m, videos: [...m.videos, ...additions] } : m)); };
  const editVideo = (moduleId, video) => { const title = window.prompt('编辑视频标题', video.title); if (!title?.trim()) return; const url = window.prompt('编辑视频链接', video.url || '') ?? video.url; updateVideo(moduleId, video.id, { title: title.trim(), url: url.trim() }); setOpenVideoMenu(null); };
  const deleteVideo = (moduleId, videoId) => { if (!window.confirm('删除这条视频记录？')) return; saveModules(modules.map((m) => m.id === moduleId ? { ...m, videos: m.videos.filter((v) => v.id !== videoId) } : m)); setOpenVideoMenu(null); };
  const dropVideo = (moduleId, targetVideoId) => {
    if (!draggedVideo || draggedVideo.moduleId !== moduleId || draggedVideo.videoId === targetVideoId) { setDraggedVideo(null); return; }
    saveModules(modules.map((m) => {
      if (m.id !== moduleId) return m;
      const videos = [...m.videos];
      const from = videos.findIndex((v) => v.id === draggedVideo.videoId);
      const to = videos.findIndex((v) => v.id === targetVideoId);
      if (from < 0 || to < 0) return m;
      const [moved] = videos.splice(from, 1);
      videos.splice(to, 0, moved);
      return { ...m, videos };
    }));
    setDraggedVideo(null);
  };
  const setVideoStatus = (moduleId, video, nextStatus) => saveModules(modules.map((module) => ({
    ...module,
    videos: module.videos.map((item) => {
      if (module.id === moduleId && item.id === video.id) return { ...item, status: nextStatus };
      if (nextStatus === 'studying' && item.status === 'studying') return { ...item, status: 'idle' };
      return item;
    }),
  })));
  const openVideo = (moduleId, video) => {
    if (video.url && !openVideoUrl(video.url)) return;
    if (video.status !== 'completed') setVideoStatus(moduleId, video, 'studying');
  };
  const loadMaterials = async (scan = false) => {
    setMaterialLoading(true);
    try {
      if (scan) { const response = await fetch('/api/materials/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); if (!response.ok) throw new Error('资料扫描失败'); }
      const [listResponse, statsResponse] = await Promise.all([fetch('/api/materials?limit=500'), fetch('/api/materials/stats')]);
      if (!listResponse.ok || !statsResponse.ok) throw new Error('资料接口不可用');
      setMaterials(await listResponse.json());
      setMaterialStats(await statsResponse.json());
    } catch (error) { window.alert(`读取学习资料失败：${error.message}`); }
    finally { setMaterialLoading(false); }
  };
  useEffect(() => { if (tab === 'materials' && !materials.length) loadMaterials(); }, [tab]);
  const saveCustomFolders = (next) => { setCustomFolders(next); localStorage.setItem('study-desk-material-folders-v1', JSON.stringify(next)); };
  const saveAddedMaterials = (next) => { setAddedMaterials(next); localStorage.setItem('study-desk-added-materials-v1', JSON.stringify(next)); };
  const removeMaterial = (item) => { if (!window.confirm('从平台资料列表移除？不会删除原始资料文件。')) return; if (addedMaterials.some((added) => added.path === item.path)) saveAddedMaterials(addedMaterials.filter((added) => added.path !== item.path)); else { const next = [...new Set([...hiddenMaterialPaths, item.path])]; setHiddenMaterialPaths(next); localStorage.setItem('study-desk-hidden-materials-v1', JSON.stringify(next)); } setMaterialFolder(null); };
  const removeMaterialFolder = (folder) => { if (!window.confirm(`从平台中移除“${folder.name}”文件夹？其中的原文件不会被删除，仍可在“全部”中查看。`)) return; const next = [...new Set([...removedMaterialFolders, folder.id])]; setRemovedMaterialFolders(next); localStorage.setItem('study-desk-removed-folders-v1', JSON.stringify(next)); if (folder.id.startsWith('folder-')) saveCustomFolders(customFolders.filter((item) => item.id !== folder.id)); setMaterialFolder(null); };
  const addMaterialFolder = () => { setFolderFormOpen(true); setMaterialFormOpen(false); };
  const submitMaterialFolder = (event) => { event.preventDefault(); const name = newFolderName.trim(); if (!name) return; saveCustomFolders([...customFolders, { id: `folder-${Date.now()}`, name, scope: materialFilter }]); setNewFolderName(''); setFolderFormOpen(false); };
  const addMaterial = () => { setMaterialFormOpen(true); setFolderFormOpen(false); };
  const submitMaterial = (event) => { event.preventDefault(); const path = materialPath.trim(); if (!path) return; const name = path.split(/[\\/]/).pop(); saveAddedMaterials([...addedMaterials, { id: `added-${Date.now()}`, path, name, extension: name.includes('.') ? `.${name.split('.').pop().toLowerCase()}` : '', size: 0, category: materialFolder?.name || (materialFilter === 'special' ? '专项练习' : materialFilter === 'history' ? '历年真题' : '学习资料') }]); setMaterialPath(''); setMaterialFormOpen(false); };
  const openMaterial = async (item) => { const response = await fetch('/api/materials/open', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: item.path }) }); if (!response.ok) { const result = await response.json().catch(() => ({})); window.alert(result.error || '文件打开失败'); } };
  const allMaterials = [...materials.filter((item) => !hiddenMaterialPaths.includes(item.path)), ...addedMaterials.filter((added) => !hiddenMaterialPaths.includes(added.path) && !materials.some((item) => item.path === added.path))];
  const isSpecial = (item) => /专项练习|专项题|知识点/.test(`${item.category} ${item.path}`);
  const isHistoric = (item) => !isSpecial(item);
  const historicCount = allMaterials.filter(isHistoric).length;
  const specialCount = allMaterials.filter(isSpecial).length;
  const formatMaterialSize = (bytes) => bytes ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : '0 MB';
  const materialYear = (item) => item.name.match(/(19|20)\d{2}/)?.[0] || item.path.split(/[\\/]/).map((part) => part.match(/^(19|20)\d{2}年?$/)?.[0]?.slice(0, 4)).find(Boolean) || null;
  const datedYears = [...new Set(allMaterials.filter(isHistoric).map(materialYear).filter(Boolean))].sort((a, b) => Number(b) - Number(a));
  const undatedHistoric = allMaterials.filter((item) => isHistoric(item) && !materialYear(item));
  const yearFolders = [...(undatedHistoric.length ? [{ id: 'year-other', name: '其他年份', items: undatedHistoric }] : []), ...datedYears.map((year) => ({ id: `year-${year}`, name: `${year}年`, items: allMaterials.filter((item) => isHistoric(item) && materialYear(item) === year) }))];
  const systemMaterialPattern = /CPU|控制器|计算机基本单位|进制|原码|反码|补码|移码|浮点数|寻址方式|校验码|CRC/i;
  const topicFolders = defaultModules.map((name) => {
    const keyword = name.replace(/^上午题—|^下午题—|（.*?）/g, '').replace(/试题[一二三四六]/, '试题');
    const items = allMaterials.filter((item) => {
      if (!isSpecial(item)) return false;
      const materialText = `${item.name} ${item.path}`;
      return name.includes('计算机系统') ? systemMaterialPattern.test(materialText) : materialText.includes(keyword);
    });
    return { id: `topic-${name}`, name, items };
  });
  const customFolderRows = customFolders.map((folder) => ({ ...folder, items: addedMaterials.filter((item) => item.category === folder.name) }));
  const scopedCustomFolders = customFolderRows.filter((folder) => !folder.scope || folder.scope === materialFilter);
  const materialFolders = (materialFilter === 'history' ? [...yearFolders, ...scopedCustomFolders] : materialFilter === 'special' ? [...topicFolders, ...scopedCustomFolders] : scopedCustomFolders).filter((folder) => !removedMaterialFolders.includes(folder.id));
  const visibleMaterials = materialFolder ? materialFolder.items : materialFilter === 'history' ? allMaterials.filter(isHistoric) : materialFilter === 'special' ? allMaterials.filter(isSpecial) : allMaterials;
  return (
    <div className="featurePage courseProgressPage">
      <PageTitle title="课程进度" desc="按学习版块整理 B 站知识点视频和完成进度。" />
      <div className="courseTabs">
        <button className={tab === 'courses' ? 'active' : ''} onClick={() => setTab('courses')}><Video />B站网课</button>
        <button className={tab === 'materials' ? 'active' : ''} onClick={() => setTab('materials')}><BookOpen />学习资料</button>
        {tab === 'courses' && <button className="courseAddModule" onClick={addModule}>＋ 添加版块</button>}
      </div>
      {tab === 'courses' ? <>
        <section className="courseTeacher panel">
          <div><small>个人课程管理</small><h2>我的学习课程</h2><p>添加课程版块和视频链接，记录自己的学习进度。</p></div>
          <div><button onClick={() => document.querySelector('.courseCatalog')?.scrollIntoView({ behavior: 'smooth' })}>课程列表 <ChevronRight /></button></div>
        </section>
        <section className="courseOverview panel"><div><small>总体课程进度</small><h2>{overall}%</h2></div><div className="courseOverviewBody"><div className="courseOverviewBar"><i style={{ width: `${overall}%` }} /></div><p><b>{totals.done}</b> 个已完成　<b>{Math.max(totals.all - totals.done, 0)}</b> 个待学习　共 {totals.all} 个视频　·　已学 {formatDurationSummary(totals.doneSeconds)} / 总时长 {formatDurationSummary(totals.totalSeconds)}</p></div></section>
        {lastVideo && <section className="courseContinue panel"><div className="courseContinueIcon"><Play /></div><div><small>{lastVideo.status === 'studying' ? '继续上次学习' : lastVideo.status === 'idle' ? '接下来学习' : '课程已全部完成'}</small><h2>{cleanVideoTitle(lastVideo.title)}</h2><p>{lastVideo.moduleName}</p></div><button className="primary" onClick={() => openVideo(lastVideo.moduleId, lastVideo)}><Play />继续学习</button></section>}
        <div className="courseCatalog">
          {modules.map((module, moduleIndex) => { const open = expanded.has(module.id), done = module.videos.filter((v) => v.status === 'completed').length, totalSeconds = module.videos.reduce((sum, v) => sum + (Number(v.duration) || 0), 0), doneSeconds = module.videos.filter((v) => v.status === 'completed').reduce((sum, v) => sum + (Number(v.duration) || 0), 0), percent = module.videos.length ? Math.round(done / module.videos.length * 100) : 0; return (
            <article className="courseModuleCard panel" key={module.id}>
              <div className="courseModuleHead">
                <button className="coursePlayTile" onClick={() => toggle(module.id)} aria-label={open ? '收起视频' : '展开视频'}><Play /></button>
                <div className="courseModuleTitle"><small>{module.name.startsWith('下午') ? '下午题' : '上午题'} · 第 {String(moduleIndex + 1).padStart(2, '0')} 版块</small><h2>{module.name}</h2><p>共 {module.videos.length} 个视频，已完成 {done} 个 · 时长 {formatDuration(doneSeconds)} / {formatDuration(totalSeconds)}</p><button className="courseExpand" onClick={() => toggle(module.id)}>{open ? '收起视频' : '展开视频'} <ChevronRight /></button></div>
                <div className="courseModuleProgress"><strong>{percent}%</strong><span>{done}/{module.videos.length}</span></div>
                <div className="courseModuleManage"><button className="courseMore" onClick={() => setOpenModuleMenu(openModuleMenu === module.id ? null : module.id)} aria-label="版块菜单"><MoreHorizontal /></button>{openModuleMenu === module.id && <div className="coursePopup"><button onClick={() => deleteModule(module.id)}>删除版块</button></div>}</div>
              </div>
              {open && <div className="courseVideoPanel">
                {module.videos.length ? module.videos.map((video, videoIndex) => <div className={`courseVideoRow ${draggedVideo?.videoId === video.id ? 'dragging' : ''}`} key={video.id} draggable onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; setDraggedVideo({ moduleId: module.id, videoId: video.id }); }} onDragOver={(event) => { if (draggedVideo?.moduleId === module.id) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }} onDrop={(event) => { event.preventDefault(); dropVideo(module.id, video.id); }} onDragEnd={() => setDraggedVideo(null)}>
                  <div className="courseVideoIdentity"><span><GripVertical className="courseDragHandle" /> <Play />{videoIndex + 1}. {cleanVideoTitle(video.title)}</span></div>
                  {video.duration ? <span className="courseVideoDuration" style={{ color: '#6f8b7b', fontSize: 12, whiteSpace: 'nowrap', textAlign: 'right' }}>{formatDuration(video.duration)}</span> : <span />}
                  <button className={`courseStatus ${video.status}`} onClick={() => setVideoStatus(module.id, video, video.status === 'idle' ? 'studying' : video.status === 'studying' ? 'completed' : 'idle')}>{video.status === 'completed' ? '已完成' : video.status === 'studying' ? '学习中' : '未学习'}</button>
                  <button className="courseOpenVideo" onClick={() => openVideo(module.id, video)}>继续学习 <ExternalLink /></button>
                  <div className="courseVideoManage"><button className="courseMore" onClick={() => setOpenVideoMenu(openVideoMenu === video.id ? null : video.id)} aria-label="视频菜单"><MoreHorizontal /></button>{openVideoMenu === video.id && <div className="coursePopup video">{video.url && <button onClick={() => openVideoUrl(video.url)}>打开视频链接</button>}<button onClick={() => editVideo(module.id, video)}>编辑视频</button><button className="danger" onClick={() => deleteVideo(module.id, video.id)}>删除视频</button></div>}</div>
                </div>) : <div className="courseEmpty">这个版块还没有视频，可以单个添加或批量导入。</div>}
                <div className="courseVideoActions"><button onClick={() => addVideo(module.id)}>＋ 单个添加视频</button><button onClick={() => batchAdd(module.id)}>＋ 批量导入视频</button></div>
              </div>}
            </article>
          ); })}
        </div>
      </> : <section className="panel materialsPanel courseMaterials">
        <div className="materialHeader"><div><h2>学习资料目录</h2></div><button className="primary" onClick={() => loadMaterials(true)} disabled={materialLoading}>{materialLoading ? '扫描中…' : '扫描学习资料'} <RotateCcw /></button></div>
        <div className="materialStats"><div><b>{allMaterials.length || materialStats.total}</b><span>资料文件</span></div><div><b>{formatMaterialSize(materialStats.bytes)}</b><span>占用空间</span></div><div><b>{materialStats.categories?.length || 2}</b><span>资料分类</span></div></div>
        <div className="materialFilters"><button className={materialFilter === 'all' ? 'active' : ''} onClick={() => { setMaterialFilter('all'); setMaterialFolder(null); }}>全部 <b>{allMaterials.length}</b></button><button className={materialFilter === 'history' ? 'active' : ''} onClick={() => { setMaterialFilter('history'); setMaterialFolder(null); }}>历年真题 <b>{historicCount}</b></button><button className={materialFilter === 'special' ? 'active' : ''} onClick={() => { setMaterialFilter('special'); setMaterialFolder(null); }}>专项练习 <b>{specialCount}</b></button></div>
        <div className="materialActions"><button className="primary" onClick={addMaterialFolder}>＋ 新建{materialFilter === 'history' ? '年份' : materialFilter === 'special' ? '专项' : ''}文件夹</button><button className="primary" onClick={addMaterial}>＋ 加入资料</button>{materialFolder && <button className="materialBack" onClick={() => setMaterialFolder(null)}>返回文件夹</button>}</div>
        {folderFormOpen && <form className="materialInlineForm" onSubmit={submitMaterialFolder}><input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="输入文件夹名称" /><button className="primary" type="submit">确定</button><button type="button" onClick={() => { setFolderFormOpen(false); setNewFolderName(''); }}>取消</button></form>}
        {materialFormOpen && <form className="materialInlineForm" onSubmit={submitMaterial}><input autoFocus value={materialPath} onChange={(event) => setMaterialPath(event.target.value)} placeholder="输入已配置资料目录内的文件完整路径" /><button className="primary" type="submit">加入</button><button type="button" onClick={() => { setMaterialFormOpen(false); setMaterialPath(''); }}>取消</button></form>}
        {!materialFolder && materialFilter !== 'all' && <div className="materialFolderList">{materialFolders.map((folder) => <div className="materialFolderRow" key={folder.id}><button className="materialFolderButton" onClick={() => setMaterialFolder(folder)}><Folder /><strong>{folder.name}</strong><span>{folder.items.length} 份{materialFilter === 'special' ? '题目' : '真题'}</span></button><button className="materialTrash" aria-label="删除文件夹" title="从平台移除文件夹（不删除原文件）" onClick={() => removeMaterialFolder(folder)}><Trash2 /></button></div>)}</div>}
        {(materialFolder || materialFilter === 'all') && <div className="materialFileList">{visibleMaterials.length ? visibleMaterials.map((item) => <div className="materialFileRow" key={item.path}><span className="materialExt">{item.extension || '.file'}</span><div><strong>{item.name}</strong><small>{item.category} · {item.path}</small></div><button onClick={() => openMaterial(item)}>打开</button><button className="materialFileTrash" aria-label="从平台移除" title="从平台移除（不删除原文件）" onClick={() => removeMaterial(item)}><Trash2 /></button></div>) : <div className="materialEmpty">当前分类还没有资料。可以扫描资料目录，或点击“加入资料”。</div>}</div>}
      </section>}
    </div>
  );
}
function StudyStats() {
  const timer = readTimer(),
    plans = readLocal(PLAN_KEY, seed),
    wrong = readLocal(WRONG_KEY, []),
    answers = readLocal(ANSWER_KEY, { total: 0, correct: 0 });
  const seconds = timer.totalAllTime;
  const hours = (seconds / 3600).toFixed(1),
    done = plans.filter((x) => x[2]).length,
    accuracy = answers.total
      ? Math.round((answers.correct / answers.total) * 100)
      : 0;
  return (
    <div className="featurePage">
      <PageTitle
        title="学习统计"
        desc="这里的数据来自你的本机计时、计划、答题和错题记录。"
      />
      <div className="realDataNotice">
        <Database />
        <span>本机实时数据</span>
        <small>刷新后仍会保留</small>
      </div>
      <div className="featureStats four">
        <article>
          <small>总学习时长</small>
          <b>{hours} 小时</b>
          <span>今日 {formatTime(timer.totalToday)}</span>
        </article>
        <article>
          <small>今日计划</small>
          <b>
            {done} / {plans.length}
          </b>
          <span>已完成任务</span>
        </article>
        <article>
          <small>专题正确率</small>
          <b>{answers.total ? accuracy + "%" : "暂无"}</b>
          <span>累计作答 {answers.total} 题</span>
        </article>
        <article>
          <small>待复习错题</small>
          <b>{wrong.length} 题</b>
          <span>答错后自动加入</span>
        </article>
      </div>
      <div className="twoColumns statsPanels">
        <section className="panel">
          <div className="sectionHead">
            <h2>学习记录概览</h2>
            <span>本机累计</span>
          </div>
          <div className="statSummary">
            <p>
              <span>已计时学习</span>
              <b>{formatTime(seconds)}</b>
            </p>
            <p>
              <span>上次学习</span>
              <b>{formatTime(timer.last || 0)}</b>
            </p>
            <p>
              <span>计划完成率</span>
              <b>
                {plans.length ? Math.round((done / plans.length) * 100) : 0}%
              </b>
            </p>
          </div>
        </section>

      </div>
    </div>
  );
}
function AppSettings() {
  const storageStatus = useSyncStatus();
  const [settings, setSettings] = useState(() =>
    readLocal(SETTINGS_KEY, defaultSettings),
  );
  const [saved, setSaved] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [gptState, setGptState] = useState({ loading: true, configured: false, message: "正在读取配置…", tone: "" });
  useEffect(() => {
    let active = true;
    fetch("/api/gpt/config")
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "读取 GPT 配置失败");
        if (!active) return;
        setSettings((current) => ({ ...current, apiUrl: result.apiUrl || current.apiUrl, model: result.model || current.model }));
        setGptState({ loading: false, configured: Boolean(result.configured), message: result.configured ? "后端已保存密钥" : "尚未配置密钥", tone: result.configured ? "success" : "warning" });
      })
      .catch((error) => active && setGptState({ loading: false, configured: false, message: error.message, tone: "error" }));
    return () => { active = false; };
  }, []);
  const update = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const save = () => {
    const normalized = { ...settings, dailyMinutes: normalizeDailyMinutes(settings.dailyMinutes), dailyQuestions: Math.max(1, Math.round(Number(settings.dailyQuestions) || 1)) };
    setSettings(normalized);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalized));
    setSaved("设置已保存在本机");
    setTimeout(() => setSaved(""), 2200);
  };
  const saveGpt = async () => {
    setGptState((current) => ({ ...current, loading: true, message: "正在保存…", tone: "" }));
    try {
      const response = await fetch("/api/gpt/config", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ apiUrl: settings.apiUrl, model: settings.model, apiKey }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "GPT 配置保存失败");
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      setApiKey("");
      setGptState({ loading: false, configured: true, message: "配置已保存到本地后端", tone: "success" });
    } catch (error) {
      setGptState((current) => ({ ...current, loading: false, message: error.message, tone: "error" }));
    }
  };
  const testGpt = async () => {
    setGptState((current) => ({ ...current, loading: true, message: "正在测试连接…", tone: "" }));
    try {
      const response = await fetch("/api/gpt/test", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "连接测试失败");
      setGptState({ loading: false, configured: true, message: `连接成功 · ${result.model || settings.model}`, tone: "success" });
    } catch (error) {
      setGptState((current) => ({ ...current, loading: false, message: error.message, tone: "error" }));
    }
  };
  const backup = async () => {
    try {
      await runSync();
      if (readSyncQueue().length) throw new Error("还有数据未同步，请恢复连接并同步后再导出备份。");
      const response = await fetch('/api/backup');
      if (!response.ok) throw new Error("备份导出失败，请检查后端连接。");
      const data = await response.json();
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = `软考学习台备份-${todayKey()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setSaved("完整数据备份已导出");
    } catch (error) { setSaved(error.message || "备份导出失败"); }
  };
  return (
    <div className="featurePage">
      <PageTitle title="设置" desc="配置考试目标、GPT 接口和本地数据备份。" />
      {saved ? (
        <div className="saveToast">
          <Check />
          {saved}
        </div>
      ) : null}
      <div className="settingsGrid">
        <section className="panel settingSection">
          <h2>考试与计划</h2>
          <label>
            报考科目
            <input
              value={settings.subject}
              onChange={(e) => update("subject", e.target.value)}
            />
          </label>
          <label>
            考试日期
            <input
              type="date"
              value={settings.examDate}
              onChange={(e) => update("examDate", e.target.value)}
            />
          </label>
          <div className="goalInputs">
            <label>
              每日学习分钟
              <input
                type="number"
                min="1"
                max="1440"
                value={settings.dailyMinutes}
                onChange={(e) => update("dailyMinutes", Number(e.target.value))}
              />
            </label>
            <label>
              每日练习题数
              <input
                type="number"
                min="1"
                value={settings.dailyQuestions}
                onChange={(e) =>
                  update("dailyQuestions", Number(e.target.value))
                }
              />
            </label>
          </div>
          <button className="primary" onClick={save}>
            <Save />
            保存设置
          </button>
        </section>
        <section className="panel settingSection">
          <h2>AI 学习助手</h2>
          <div className="securityTip externalChatTip">
            <ExternalLink />
            <span>
              <b>使用外部 ChatGPT</b>
              <small>不需要配置 API，也不会产生 API 费用。点击后会复制问题并打开 ChatGPT。</small>
            </span>
          </div>
          <button className="primary externalChatButton" onClick={() => openExternalChatGPT("请帮我制定软件设计师中级考试复习计划。")}>
            <ExternalLink />打开 ChatGPT
          </button>
        </section>
        <section className="panel settingSection dataSetting">
          <h2>本地数据</h2>
          <button onClick={backup}>
            <Download />
            <span>
              <b>导出完整备份</b>
              <small>包括课程、题库、历史计划、专注记录、错题和已保存设置</small>
            </span>
            <ChevronRight />
          </button>
          <button>
            <Database />
            <span>
              <b>当前存储方式</b>
              <small>SQLite 为主存储；浏览器仅保留本机缓存</small>
            </span>
            <span className="storageState">{storageStatus.backend !== 'online' ? '未连接' : storageStatus.queue.length ? '待同步' : '正常'}</span>
          </button>
        </section>
      </div>
    </div>
  );
}
function useSyncStatus() {
  const [status, setStatus] = useState(syncSnapshot);
  useEffect(() => subscribeSync(setStatus), []);
  return status;
}
function ExternalChatToast() {
  const [message, setMessage] = useState(null);
  useEffect(() => {
    const onStatus = (event) => {
      const { copied, desktopOpened } = event.detail || {};
      setMessage({ copied, desktopOpened });
      window.setTimeout(() => setMessage(null), 9000);
    };
    window.addEventListener("chatgpt-status", onStatus);
    return () => window.removeEventListener("chatgpt-status", onStatus);
  }, []);
  if (!message) return null;
  return <div className="chatToast" role="status">
    <b>{message.copied ? "问题已复制到剪贴板" : "复制失败，请手动复制问题"}</b>
    <span>{message.desktopOpened ? "已尝试打开桌面版 ChatGPT。" : "桌面版未响应。"}</span>
    <button onClick={() => window.open("https://chatgpt.com/", "_blank", "noopener,noreferrer")}>打开网页版 ChatGPT</button>
  </div>;
}
function SyncStatus() {
  const status = useSyncStatus();
  const failed = status.queue.filter((item) => item.lastError);
  const pending = status.queue.length - failed.length;
  const label = !status.online ? "离线，等待联网" : status.backend === "offline" ? "SQLite 服务未连接" : status.backend === "checking" ? "正在检查服务" : status.syncing ? "正在同步" : failed.length ? `${failed.length} 项同步失败` : pending ? `${pending} 项待同步` : "已同步";
  const retry = () => runSync();
  return <div className={`syncStatus ${!status.online || status.backend === "offline" ? "offline" : failed.length ? "syncFailed" : status.syncing || status.backend === "checking" ? "syncing" : "synced"}`}>
    <details>
      <summary><span className="syncDot" />{label}</summary>
      <div className="syncDetails">
        <p>{!status.online ? "当前没有网络连接，数据已保存在本机缓存" : status.backend === "offline" ? `SQLite 后端未连接：${status.backendError || "数据暂存在本机缓存"}` : status.backend === "checking" ? "正在检查 SQLite 后端服务…" : "SQLite 后端服务正常，数据会自动同步"}</p>
        {status.queue.length ? <div className="syncQueue">{status.queue.map((item) => <div className="syncQueueItem" key={item.remoteKey}>
          <b>{syncLabels[item.remoteKey] || item.remoteKey}</b>
          <span>{item.lastError ? `${item.lastError} · 已重试 ${item.attempts || 0} 次` : "等待同步"}</span>
          {item.lastAttemptAt ? <small>最近尝试：{new Date(item.lastAttemptAt).toLocaleString()}</small> : null}
        </div>)}</div> : <p className="syncEmpty">所有数据都已同步到 SQLite。</p>}
        {status.queue.length ? <button className="syncRetry" onClick={() => { checkBackend(); retry(); }} disabled={status.syncing}>{status.syncing ? "同步中…" : "立即重试"}</button> : null}
        {status.backendCheckedAt ? <small className="syncCheckedAt">最近检查：{new Date(status.backendCheckedAt).toLocaleString()}</small> : null}
      </div>
    </details>
  </div>;
}
const summarizeCourseModules = (modules) => {
  const entries = (Array.isArray(modules) ? modules : []).flatMap((module, moduleIndex) =>
    (Array.isArray(module.videos) ? module.videos : []).map((video, videoIndex) => ({
      module,
      moduleIndex,
      video,
      videoIndex,
    })),
  );
  const current = entries.find((entry) => entry.video.status === "studying")
    || entries.find((entry) => entry.video.status === "idle")
    || entries.at(-1)
    || null;
  const completed = entries.filter((entry) => entry.video.status === "completed").length;
  const total = entries.length;
  if (!current) return { current: null, completed, total, remaining: total, overall: 0 };
  const moduleVideos = current.module.videos || [];
  const moduleCompleted = moduleVideos.filter((video) => video.status === "completed").length;
  return {
    current,
    completed,
    total,
    remaining: Math.max(total - completed, 0),
    overall: total ? Math.round(completed / total * 100) : 0,
    moduleCompleted,
    moduleTotal: moduleVideos.length,
    modulePercent: moduleVideos.length ? Math.round(moduleCompleted / moduleVideos.length * 100) : 0,
    videoTitle: String(current.video.title || "未命名课程").replace(/^\s*\d+[.)、．]\s*/, "").trim(),
  };
};
function App() {
  const [tasks, setTasks] = useState(() => readLocal(PLAN_KEY, seed));
  const [planClock, setPlanClock] = useState(() => new Date());
  const [aiQuickPrompt, setAiQuickPrompt] = useState("");
  const [wrong, setWrong] = useState(() => readLocal(WRONG_KEY, []));
  const [quiz, setQuiz] = useState("");
  const [databaseQuiz, setDatabaseQuiz] = useState(null);
  const [wrongQuiz, setWrongQuiz] = useState(null);
  const [menu, setMenu] = useState(false);
  const [questionTab, setQuestionTab] = useState("bank");
  const [active, setActive] = useState(() => location.hash === '#plan' ? 1 : ["#course-progress", "#course-materials"].includes(location.hash) ? 2 : 0);
  useEffect(() => {
    const followHash = () => setActive(location.hash === '#plan' ? 1 : ['#course-progress', '#course-materials'].includes(location.hash) ? 2 : 0);
    window.addEventListener('hashchange', followHash);
    return () => window.removeEventListener('hashchange', followHash);
  }, []);
  useEffect(
    () => localStorage.setItem(PLAN_KEY, JSON.stringify(tasks)),
    [tasks],
  );
  useEffect(() => {
    const syncPlanItems = (event) => {
      const next = event instanceof CustomEvent ? event.detail : readLocal(PLAN_KEY, []);
      if (Array.isArray(next)) setTasks(next);
    };
    const syncPlanStorage = (event) => {
      if (event.key === PLAN_KEY) syncPlanItems(event);
    };
    window.addEventListener(PLAN_UPDATED_EVENT, syncPlanItems);
    window.addEventListener("storage", syncPlanStorage);
    return () => {
      window.removeEventListener(PLAN_UPDATED_EVENT, syncPlanItems);
      window.removeEventListener("storage", syncPlanStorage);
    };
  }, []);
  useEffect(() => {
    const tick = () => setPlanClock(new Date());
    const timer = window.setInterval(tick, 60_000);
    window.addEventListener('focus', tick);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', tick);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  useEffect(() => {
    const { dailyChanged } = rolloverPlanPeriods(planClock);
    if (dailyChanged) setTasks(readLocal(PLAN_KEY, []));
  }, [planClock]);
  useEffect(
    () => localStorage.setItem(WRONG_KEY, JSON.stringify(wrong)),
    [wrong],
  );
  const addWrong = (item) =>
    setWrong((v) => {
      const existing = v.find((x) => x.title === item.title);
      if (!existing) return [{ ...item, attempts: 1, mastered: false }, ...v];
      return v.map((x) => x.title === item.title ? { ...x, ...item, attempts: (x.attempts || 1) + 1, mastered: false } : x);
    });
  const done = tasks.filter((x) => x[2]).length;
  const homeCourse = summarizeCourseModules(readLocal('study-desk-course-modules-v2', []));
  const homeSettings = readLocal(SETTINGS_KEY, defaultSettings);
  const examDate = homeSettings.examDate || defaultSettings.examDate;
  const examDateValue = new Date(`${examDate}T00:00:00`);
  const daysLeft = Number.isNaN(examDateValue.getTime()) ? 0 : Math.max(0, Math.ceil((examDateValue.getTime() - Date.now()) / 86400000));
  const [examYear, examMonth, examDay] = examDate.split('-');
  const examDateText = examDate ? `${examYear} 年 ${Number(examMonth)} 月 ${Number(examDay)} 日` : '请在设置中填写';
  return (
    <div className="app">
      <SyncStatus />
      <ExternalChatToast />
      <aside className={menu ? "open" : ""}>
        <div className="brand">
          <b>软考学习台</b>
          <span>中级软件设计师</span>
        </div>
        <nav>
          {nav.map(([I, n], i) => (
            ["GPT 专题真题", "错题复习", "学习统计"].includes(n) ? null : <button
              onClick={() => {
                setActive(i);
                if (n === "题库练习") setQuestionTab("bank");
                setMenu(false);
              }}
              className={i === active ? "active" : ""}
              key={n}
            >
              <I />
              {n}
            </button>
          ))}
        </nav>
      </aside>
      <button className="mobileMenu" aria-label={menu ? '关闭导航' : '打开导航'} aria-expanded={menu} onClick={() => setMenu(!menu)}>
        {menu ? <X /> : <Menu />}
      </button>
      <main>
        {active === 1 ? (
          <LearningPlan items={tasks} setItems={setTasks} planClock={planClock} />
        ) : active === 3 ? (
          <QuestionHub
            tab={questionTab}
            onTabChange={setQuestionTab}
            onPractice={setDatabaseQuiz}
            onGptPractice={setQuiz}
            wrong={wrong}
            onReview={setWrongQuiz}
            onRemoveWrong={(title) => setWrong((v) => v.map((item) => item.title === title ? { ...item, mastered: !item.mastered } : item))}
          />
        ) : active === 2 ? (
          <CourseProgress />
        ) : active === 6 ? (
          <StudyStats />
        ) : active === 7 ? (
          <AppSettings />
        ) : (
          <>
            <header>
              <div>
                <h1>晚上好，今天继续稳稳向前。</h1>
                <p>按自己的节奏，记录每天的学习。</p>
              </div>
              <div className="count">
                <div>
                  <small>考试倒计时</small>
                  <strong>
                     {daysLeft}<em>天</em>
                  </strong>
                </div>
                <div>
                  <small>考试日期</small>
                   <b>{examDateText}</b>
                  <span>软件设计师中级考试</span>
                </div>
                <div>
                  <small>当前状态</small>
                  <b className="green">按计划进行中</b>
                </div>
              </div>
            </header>
            <section className="homeTimerFocus"><StudyTimer /><FocusSummary /></section>
            <section className="homeMainGrid">
              <section className="panel homeToday"><div className="panelTitle"><h2>今日计划</h2><button onClick={() => setActive(1)}>调整计划 <PenLine /></button></div>{tasks.map((t, i) => <button className="task" key={`simple-${t[0]}-${i}`} onClick={() => setTasks((x) => x.map((v, j) => j === i ? [v[0], v[1], !v[2]] : v))}><i className={t[2] ? "checked" : ""}>{t[2] ? <Check /> : null}</i><div><b>{t[0]}</b><span>{t[1]}</span></div><small>{t[2] ? "已完成" : "待完成"}</small></button>)}</section>
              <div className="homeRightStack"><section className="panel homeCurrent"><div className="panelTitle"><h2>当前学习状态</h2><button onClick={() => setActive(2)}>查看课程 <ChevronRight /></button></div>{homeCourse.current ? <div className="homeCurrentBody"><div className="softIcon"><BookOpen /></div><div><small>{homeCourse.current.video.status === 'studying' ? '正在学习' : '接下来学习'}</small><h3>{homeCourse.videoTitle}</h3><p>{homeCourse.current.module.name} · 第 {homeCourse.current.videoIndex + 1}/{homeCourse.moduleTotal} 节 · {homeCourse.modulePercent}%</p></div></div> : <div className="homeCurrentBody"><div className="softIcon"><BookOpen /></div><div><small>尚未安排</small><h3>还没有课程记录</h3><p>请先在课程进度中加入视频</p></div></div>}<button className="primary" onClick={() => setActive(2)}><Play />{homeCourse.current ? '继续学习' : '查看课程'}</button></section>
<section className="homeAiCard"><div className="homeAiCardHead"><span className="homeAiIcon"><Sparkles /></span><span><b>AI 学习助手</b><small>复制问题并打开 ChatGPT 获取讲解与复习建议</small></span></div><div className="homeAiInput"><input value={aiQuickPrompt} onChange={(e) => setAiQuickPrompt(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") openExternalChatGPT(aiQuickPrompt); }} placeholder="例如：解释一下 Cache 的作用" /><button onClick={() => openExternalChatGPT(aiQuickPrompt)}>打开 ChatGPT</button></div></section></div>
            </section>
          </>
        )}
      </main>
      {quiz ? (
        <Quiz title={quiz} onClose={() => setQuiz("")} onWrong={addWrong} />
      ) : null}
      {databaseQuiz ? (
        <DatabaseQuiz
          session={databaseQuiz}
          onClose={() => setDatabaseQuiz(null)}
          onWrong={addWrong}
        />
      ) : null}
      {wrongQuiz ? (
        <WrongQuestionModal item={wrongQuiz} onClose={() => setWrongQuiz(null)} onToggleMastery={(title) => setWrong((v) => v.map((item) => item.title === title ? { ...item, mastered: !item.mastered } : item))} />
      ) : null}
    </div>
  );
}
await hydrateState();
if (localStorage.getItem('study-desk-courses-seeded-v1') !== 'true') {
  if (localStorage.getItem('study-desk-course-modules-v2') === null) localStorage.setItem('study-desk-course-modules-v2', JSON.stringify(defaultCourses));
  localStorage.setItem('study-desk-courses-seeded-v1', 'true');
}
rolloverPlanPeriods(new Date());
syncReady = true;
runSync();
createRoot(document.getElementById("root")).render(<App />);
