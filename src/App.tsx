import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  ArrowUpFromLine,
  BookOpen,
  Check,
  ChevronRight,
  CircleCheck,
  CloudOff,
  Download,
  Heart,
  Info,
  LoaderCircle,
  Pencil,
  Plus,
  Search,
  Settings2,
  Shuffle,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import {
  addCategory,
  createBackup,
  markBackup,
  readAll,
  recordReview,
  removeWord,
  restoreBackup,
  saveWord,
} from "./db";
import { download, parseBackup, toCSV } from "./backup";
import { lookupWord } from "./dictionary";
import { lookupLocalWord } from "./local-dictionary";
import {
  emptyDictionary,
  makeWord,
  normalizeWord,
  validWord,
  type DictionaryData,
  type Word,
} from "./model";

const message = (error: unknown) =>
  error instanceof Error ? error.message : "操作未完成，请重试。";
const dateLabel = (date: string) =>
  new Date(date).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
const partNames: Record<string, string> = {
  noun: "名词",
  verb: "动词",
  adjective: "形容词",
  adverb: "副词",
  pronoun: "代词",
  preposition: "介词",
  conjunction: "连词",
  interjection: "感叹词",
};

function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    const before = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current!;
    node.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
      if (event.key === "Tab") {
        const nodes = [
          ...node.querySelectorAll<HTMLElement>(
            "button:not(:disabled), input:not(:disabled), textarea, select, a[href]",
          ),
        ].filter((el) => el.offsetParent !== null);
        const first = nodes[0],
          last = nodes.at(-1);
        if (!first) {
          event.preventDefault();
          return;
        }
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          event.preventDefault();
          last?.focus();
        } else if (
          !event.shiftKey &&
          (document.activeElement === last || document.activeElement === node)
        ) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    node.addEventListener("keydown", key);
    return () => {
      node.removeEventListener("keydown", key);
      document.body.style.overflow = before;
      previous?.focus();
    };
  }, []);
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="sheet"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div className="sheet-heading">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="关闭" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AudioButtons({ data, word }: { data: DictionaryData; word: string }) {
  const [error, setError] = useState("");
  const current = useRef<HTMLAudioElement | null>(null);
  const speaking = useRef<SpeechSynthesisUtterance | null>(null);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update();
    window.speechSynthesis.addEventListener("voiceschanged", update);
    return () =>
      window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  useEffect(
    () => () => {
      current.current?.pause();
      if (speaking.current) window.speechSynthesis?.cancel();
    },
    [],
  );
  async function play(audioUrl: string) {
    setError("");
    current.current?.pause();
    if (speaking.current) window.speechSynthesis?.cancel();
    const audio = new Audio(audioUrl);
    current.current = audio;
    audio.onerror = () =>
      setError("词典音频暂时无法播放，请检查网络，或使用设备朗读。");
    try {
      await audio.play();
    } catch {
      setError("词典音频暂时无法播放，请检查网络，或使用设备朗读。");
    }
  }
  function speak(voice: SpeechSynthesisVoice) {
    setError("");
    current.current?.pause();
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    speaking.current = utterance;
    utterance.onerror = (event) => {
      if (!["canceled", "interrupted"].includes(event.error))
        setError("设备朗读失败，请检查系统语音设置。");
    };
    utterance.onend = () => {
      speaking.current = null;
    };
    window.speechSynthesis.speak(utterance);
  }
  const generic = data.pronunciations.filter(
    (p) => p.accent === "其他" && p.audio,
  );
  return (
    <div className="pronunciations" aria-label="英美音标与发音">
      {(["US", "UK"] as const).map((accent) => {
        const label = accent === "US" ? "美式" : "英式";
        const entries = data.pronunciations.filter((p) => p.accent === accent);
        const text = [
          ...new Set(entries.map((p) => p.text).filter(Boolean)),
        ].join(" · ");
        const audio = entries.find((p) => p.audio)?.audio;
        const voice = voices.find(
          (v) =>
            v.lang.toLowerCase().replace("_", "-") ===
            (accent === "US" ? "en-us" : "en-gb"),
        );
        return (
          <div className="pronunciation-row" key={accent}>
            <div>
              <span className="small">{label}音标</span>
              <p className="phonetic">{text || "词典未提供"}</p>
            </div>
            <div className="audio-row">
              {audio && (
                <button
                  type="button"
                  className="audio-button"
                  aria-label={`${label}词典发音`}
                  onClick={() => void play(audio)}
                >
                  <Volume2 size={16} />
                  {label}发音
                </button>
              )}
              {voice && (
                <button
                  type="button"
                  className="audio-button"
                  onClick={() => speak(voice)}
                >
                  <Volume2 size={16} />
                  {label}设备朗读
                </button>
              )}
              {!audio && !voice && (
                <span className="muted small">暂无可用发音</span>
              )}
            </div>
          </div>
        );
      })}
      {!data.pronunciations.some((p) => p.accent !== "其他" && p.text) &&
        data.phonetic && (
          <p className="small muted">
            通用音标（词典未区分英美）：
            <span className="phonetic">{data.phonetic}</span>
          </p>
        )}
      {generic.length > 0 && (
        <div className="audio-row">
          {generic.map((p, i) => (
            <button
              type="button"
              className="audio-button"
              key={p.audio}
              onClick={() => void play(p.audio)}
            >
              <Volume2 size={16} />
              词典发音（未标注口音）{generic.length > 1 ? ` ${i + 1}` : ""}
            </button>
          ))}
        </div>
      )}
      {error && (
        <p role="status" className="error-text">
          {error}
        </p>
      )}
    </div>
  );
}

function Definitions({ data }: { data: DictionaryData }) {
  return (
    <div className="definitions">
      {data.meanings.length ? (
        data.meanings.map((m, i) => (
          <div className="definition" key={i}>
            {m.partOfSpeech && (
              <span className="part">
                {partNames[m.partOfSpeech] || m.partOfSpeech} · {m.partOfSpeech}
              </span>
            )}
            <p lang="en">{m.definition}</p>
            {m.example && <blockquote lang="en">{m.example}</blockquote>}
          </div>
        ))
      ) : (
        <p className="muted">暂无词典释义，可以填写自己的中文解释和备注。</p>
      )}
      {data.meanings.length > 0 && !data.meanings.some((m) => m.example) && (
        <p className="small muted">词典暂未提供例句。</p>
      )}
      {(data.sourceUrl || data.license) && (
        <p className="source">
          词典：
          {data.dictionarySource === "ecdict"
            ? "ECDICT 本地词典"
            : "Free Dictionary API"}
          {data.sourceUrl && (
            <>
              {" "}
              ·{" "}
              <a href={data.sourceUrl} target="_blank" rel="noreferrer">
                来源
              </a>
            </>
          )}
          {data.license && (
            <>
              {" "}
              ·{" "}
              {data.licenseUrl ? (
                <a href={data.licenseUrl} target="_blank" rel="noreferrer">
                  {data.license}
                </a>
              ) : (
                data.license
              )}
            </>
          )}
        </p>
      )}
    </div>
  );
}

function Editor({
  word,
  initialText,
  categories,
  onClose,
  onSaved,
}: {
  word?: Word;
  initialText: string;
  categories: string[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [text, setText] = useState(word?.text || initialText);
  const [chinese, setChinese] = useState(word?.chinese || "");
  const [chineseSource, setChineseSource] = useState<Word["chineseSource"]>(
    word?.chineseSource || (word?.chinese ? "manual" : undefined),
  );
  const chineseInput = useRef({
    value: word?.chinese || "",
    protected: !!word?.chinese,
  });
  const [candidateChinese, setCandidateChinese] = useState("");
  const [chineseNote, setChineseNote] = useState(
    word?.chinese
      ? "已保存的中文释义会保留，不会被查词覆盖。"
      : "自动查询本地英汉词典，结果可手动修改。",
  );
  const [notes, setNotes] = useState(word?.notes || "");
  const [category, setCategory] = useState(word?.category || categories[0]);
  const [newCategory, setNewCategory] = useState("");
  const [extraCategories, setExtraCategories] = useState<string[]>([]);
  const [addingCategory, setAddingCategory] = useState(false);
  const [data, setData] = useState<DictionaryData>(word || emptyDictionary());
  const [looking, setLooking] = useState(false);
  const [queryNote, setQueryNote] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const lastQuery = useRef(word?.chinese ? word.normalized : "");
  const controller = useRef<AbortController | null>(null);
  const query = useCallback(async (value: string) => {
    controller.current?.abort();
    const normalized = normalizeWord(value);
    if (!validWord(value)) {
      setQueryNote("请输入英文单词或短语（可包含空格、连字符和撇号）。");
      return;
    }
    lastQuery.current = normalized;
    const abort = new AbortController();
    controller.current = abort;
    setLooking(true);
    setQueryNote("");
    const timeout = setTimeout(() => abort.abort("timeout"), 8000);
    let englishSucceeded = false;
    let localAvailable = false;
    const local = lookupLocalWord(normalized, abort.signal)
      .then((entry) => {
        if (abort.signal.aborted || controller.current !== abort) return;
        if (!entry) {
          setChineseNote("本地词典暂未收录，中文释义可手动填写。");
          return;
        }
        localAvailable = true;
        setCandidateChinese(entry.chinese);
        if (!chineseInput.current.protected) {
          chineseInput.current.value = entry.chinese;
          setChinese(entry.chinese);
          setChineseSource("ecdict");
          setChineseNote("已自动填入中文释义（ECDICT），可以自由修改。");
        } else
          setChineseNote(
            "已查到词典中文，保留你已有的解释；需要时可主动替换。",
          );
        if (!englishSucceeded) setData(entry.dictionary);
      })
      .catch((error) => {
        if (!abort.signal.aborted && controller.current === abort)
          setChineseNote(
            error instanceof TypeError
              ? "中文词典尚未下载完成，可以先手动填写。"
              : message(error),
          );
      });
    const english = navigator.onLine
      ? lookupWord(normalized, abort.signal).then((result) => {
          if (!abort.signal.aborted && controller.current === abort) {
            englishSucceeded = true;
            setData(result);
          }
        })
      : Promise.resolve();
    try {
      const [, englishResult] = await Promise.allSettled([local, english]);
      if (controller.current !== abort) return;
      if (abort.signal.aborted) {
        if (abort.signal.reason === "timeout")
          setQueryNote("在线词典查询超时，已查到的本地内容仍可保存。");
      } else if (englishSucceeded) setQueryNote("英文词典查询完成。");
      else if (localAvailable)
        setQueryNote(
          navigator.onLine
            ? "在线词典暂不可用，已显示 ECDICT 本地内容；可稍后重新查词补充音频和例句。"
            : "离线查询完成；联网后可补充英美发音和例句。",
        );
      else if (englishResult.status === "rejected")
        setQueryNote(
          englishResult.reason instanceof TypeError
            ? "网络不可用，可以手动填写并保存。"
            : message(englishResult.reason),
        );
      else setQueryNote("当前离线，可以手动填写并保存，联网后再查询词典。");
    } finally {
      clearTimeout(timeout);
      if (controller.current === abort) setLooking(false);
    }
  }, []);
  useEffect(() => {
    const normalized = normalizeWord(text);
    if (!validWord(text) || normalized === lastQuery.current) return;
    const timeout = setTimeout(() => {
      void query(text);
    }, 700);
    return () => clearTimeout(timeout);
  }, [text, query]);
  useEffect(
    () => () => {
      controller.current?.abort();
    },
    [],
  );
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!validWord(text)) {
      setError("请输入有效英文单词或短语，最多 100 个字符。");
      return;
    }
    setSaving(true);
    try {
      const value = word
        ? {
            ...word,
            ...data,
            text,
            chinese,
            chineseSource,
            notes,
            category,
            updatedAt: new Date().toISOString(),
          }
        : makeWord(text, { ...data, chinese, chineseSource, notes, category });
      await saveWord(value);
      await onSaved();
      onClose();
    } catch (e) {
      setError(message(e));
    } finally {
      setSaving(false);
    }
  }
  return (
    <Sheet
      title={word ? "编辑单词" : "收下一个新单词"}
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <form onSubmit={submit} className="editor">
        <label htmlFor="word-text">
          英文单词 <span className="required">*</span>
        </label>
        <div className="input-action">
          <input
            id="word-text"
            lang="en"
            value={text}
            placeholder="例如 serendipity"
            maxLength={100}
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            required
            onChange={(e) => {
              controller.current?.abort();
              setLooking(false);
              setText(e.target.value);
              setData(emptyDictionary());
              setCandidateChinese("");
              if (!chineseInput.current.protected) {
                chineseInput.current.value = "";
                setChinese("");
                setChineseSource(undefined);
              }
              setChineseNote("自动查询本地英汉词典，手动解释不会被覆盖。");
              setQueryNote("");
              lastQuery.current = "";
            }}
          />
          <button
            className="secondary"
            type="button"
            disabled={looking || !validWord(text)}
            onClick={() => void query(text)}
          >
            {looking ? (
              <LoaderCircle className="spin" size={18} />
            ) : (
              <Search size={18} />
            )}
            查词
          </button>
        </div>
        <div className="query-status" aria-live="polite">
          {looking ? (
            <>
              <span>正在查询英文词典和中文释义…</span>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  controller.current?.abort();
                  setLooking(false);
                  setQueryNote("已跳过查询，可以手动填写并保存。");
                }}
              >
                跳过查询
              </button>
            </>
          ) : (
            queryNote || "自动查询音标、中文释义、英文解释和发音。"
          )}
        </div>
        {(data.phonetic ||
          data.meanings.length > 0 ||
          data.pronunciations.length > 0) && (
          <section className="dictionary-preview" aria-label="英文词典查询结果">
            <h3>音标、英文释义与例句</h3>
            <AudioButtons data={data} word={text} />
            <Definitions data={data} />
          </section>
        )}
        <label htmlFor="word-chinese">
          中文释义 <span className="muted">自动查询 · 可修改</span>
        </label>
        <textarea
          id="word-chinese"
          rows={3}
          placeholder="自动填入词典中文，也可以用自己的话修改"
          maxLength={10000}
          value={chinese}
          onChange={(e) => {
            chineseInput.current = { value: e.target.value, protected: true };
            setChinese(e.target.value);
            setChineseSource("manual");
            setChineseNote("已手动修改；查词不会覆盖你的解释。");
          }}
        />
        <p className="small muted" role="status">
          {chineseNote}
        </p>
        {candidateChinese && candidateChinese !== chinese && (
          <button
            type="button"
            className="text-button chinese-replace"
            onClick={() => {
              chineseInput.current = {
                value: candidateChinese,
                protected: false,
              };
              setChinese(candidateChinese);
              setChineseSource("ecdict");
              setChineseNote("已使用 ECDICT 词典中文，可继续手动修改。");
            }}
          >
            用词典中文替换当前解释
          </button>
        )}
        <label htmlFor="word-category">单词分类</label>
        <div className="input-action">
          <select
            id="word-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            {[...new Set([...categories, ...extraCategories])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <button
            type="button"
            className="secondary"
            onClick={() => setAddingCategory((v) => !v)}
          >
            <Plus size={18} />
            新分类
          </button>
        </div>
        {addingCategory && (
          <div className="new-category">
            <input
              aria-label="新分类名称"
              maxLength={40}
              placeholder="输入分类名称"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <button
              className="secondary"
              type="button"
              disabled={!newCategory.trim()}
              onClick={async () => {
                try {
                  const name = newCategory.trim();
                  await addCategory(name);
                  setExtraCategories((v) => [...v, name]);
                  setCategory(name);
                  setAddingCategory(false);
                  setNewCategory("");
                } catch {
                  setError("分类保存失败，请检查浏览器存储空间。");
                }
              }}
            >
              创建
            </button>
          </div>
        )}
        <label htmlFor="word-notes">
          我的中文备注 <span className="muted">选填</span>
        </label>
        <textarea
          id="word-notes"
          rows={3}
          placeholder="在哪里遇见它？写下你的联想或使用场景…"
          maxLength={10000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <button
          className="primary full"
          disabled={
            saving ||
            looking ||
            (navigator.onLine &&
              validWord(text) &&
              normalizeWord(text) !== lastQuery.current)
          }
          type="submit"
        >
          {saving ? (
            <LoaderCircle className="spin" size={19} />
          ) : (
            <Check size={19} />
          )}
          {saving ? "正在保存…" : "保存单词"}
        </button>
        <p className="small muted center">仅保存在你的设备上 · 随时可以编辑</p>
      </form>
    </Sheet>
  );
}

function WordDetail({
  word,
  onClose,
  onEdit,
  onChange,
  onDelete,
}: {
  word: Word;
  onClose: () => void;
  onEdit: () => void;
  onChange: (word: Word) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function act(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="单词详情" onClose={onClose}>
      <div className="detail-top">
        <span className="eyebrow">{word.category}</span>
        <h2 lang="en">{word.text}</h2>
        <AudioButtons data={word} word={word.text} />
      </div>
      <div className="detail-actions">
        <button
          className={word.favorite ? "chip active" : "chip"}
          disabled={busy}
          onClick={() =>
            void act(() => onChange({ ...word, favorite: !word.favorite }))
          }
        >
          <Heart size={16} fill={word.favorite ? "currentColor" : "none"} />
          {word.favorite ? "已收藏" : "收藏"}
        </button>
        <button
          className={word.mastered ? "chip active" : "chip"}
          disabled={busy}
          onClick={() =>
            void act(() => onChange({ ...word, mastered: !word.mastered }))
          }
        >
          <CircleCheck size={16} />
          {word.mastered ? "已掌握" : "未掌握"}
        </button>
      </div>
      <section className="detail-section">
        <h3>中文释义</h3>
        <p className="chinese">
          {word.chinese || "尚未填写，点击编辑添加中文释义。"}
        </p>
        {word.chinese && (
          <p className="small muted">
            {word.chineseSource === "ecdict"
              ? "中文来源：ECDICT 本地词典（可编辑）"
              : "中文解释：个人手动填写或修改"}
          </p>
        )}
      </section>
      {word.notes && (
        <section className="note-block">
          <span className="eyebrow">我的备注</span>
          <p>{word.notes}</p>
        </section>
      )}
      <section className="detail-section">
        <h3>英文释义与例句</h3>
        <Definitions data={word} />
      </section>
      <p className="small muted">
        添加于 {dateLabel(word.createdAt)} · 更新于 {dateLabel(word.updatedAt)}
      </p>
      <div className="detail-footer">
        <button className="secondary" onClick={onEdit} disabled={busy}>
          <Pencil size={17} />
          编辑单词
        </button>
        <button
          className="danger-button"
          disabled={busy}
          onClick={() => setConfirmDelete((v) => !v)}
        >
          <Trash2 size={17} />
          删除
        </button>
      </div>
      {confirmDelete && (
        <div className="delete-confirm" role="alert">
          <p>确定删除“{word.text}”及它的复习记录？此操作无法撤销。</p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setConfirmDelete(false)}
            >
              取消
            </button>
            <button
              className="danger-button"
              disabled={busy}
              onClick={() => void act(onDelete)}
            >
              确认删除
            </button>
          </div>
        </div>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
    </Sheet>
  );
}

function BackupPanel({
  lastBackup,
  onClose,
  onRefresh,
}: {
  lastBackup?: string;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState<ReturnType<typeof parseBackup> | null>(
    null,
  );
  const input = useRef<HTMLInputElement>(null);
  const stamp = new Date().toISOString().slice(0, 10);
  async function action(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Sheet title="备份与使用指南" onClose={onClose}>
      <div className="notice">
        <Info size={20} />
        <div>
          <strong>你的单词，只属于你</strong>
          <p>
            数据保存在当前浏览器。清除网站数据、更换设备或浏览器可能造成丢失，请定期导出
            JSON 备份。不同网址的数据互不共享。
          </p>
        </div>
      </div>
      <h3>数据备份</h3>
      <p className="small muted">
        {lastBackup
          ? `上次发起 JSON 导出：${dateLabel(lastBackup)}`
          : "还没有导出过 JSON 备份。"}{" "}
        请确认文件已保存到“文件”App。
      </p>
      <div className="backup-options">
        <button
          className="backup-option"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const backup = await createBackup();
              download(
                JSON.stringify(backup, null, 2),
                `my-words-${stamp}.json`,
                "application/json;charset=utf-8",
              );
              await markBackup();
              await onRefresh();
              setStatus(
                "已发起 JSON 下载，请确认文件已保存。包含全部单词、分类和复习记录。",
              );
            })
          }
        >
          <span className="option-icon">
            <ArrowDownToLine />
          </span>
          <span>
            <strong>导出 JSON 备份</strong>
            <small>完整数据，可用于恢复</small>
          </span>
          <ChevronRight size={18} />
        </button>
        <button
          className="backup-option"
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <span className="option-icon">
            <ArrowUpFromLine />
          </span>
          <span>
            <strong>导入 JSON 恢复</strong>
            <small>合并数据，保留本机重复单词</small>
          </span>
          <ChevronRight size={18} />
        </button>
        <button
          className="backup-option"
          disabled={busy}
          onClick={() =>
            void action(async () => {
              const { words } = await createBackup();
              download(
                toCSV(words),
                `my-words-${stamp}.csv`,
                "text/csv;charset=utf-8",
              );
              setStatus(
                "已发起 CSV 下载，文件使用 UTF-8 BOM，可在表格软件中查看中文。CSV 不用于恢复。",
              );
            })
          }
        >
          <span className="option-icon">
            <Download />
          </span>
          <span>
            <strong>导出 CSV 表格</strong>
            <small>适合用 Excel 查看和打印</small>
          </span>
          <ChevronRight size={18} />
        </button>
      </div>
      <input
        ref={input}
        className="visually-hidden"
        type="file"
        accept=".json,application/json"
        aria-label="选择 JSON 备份文件"
        disabled={busy}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPending(null);
          void action(async () => {
            if (file.size > 10 * 1024 * 1024)
              throw new Error("备份文件不能超过 10 MB。");
            setPending(parseBackup(await file.text()));
          });
        }}
      />
      {pending && (
        <div className="import-confirm">
          <h3>确认导入</h3>
          <p>
            已校验 {pending.words.length} 个单词、{pending.reviews.length}{" "}
            条复习记录。将与现有数据合并；同名单词保留本机内容。
          </p>
          <div className="button-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              取消导入
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() =>
                void action(async () => {
                  const result = await restoreBackup(pending);
                  setPending(null);
                  await onRefresh();
                  setStatus(
                    `导入完成：新增 ${result.added} 个单词，跳过 ${result.skipped} 个重复单词。`,
                  );
                })
              }
            >
              确认导入
            </button>
          </div>
        </div>
      )}
      {busy && (
        <p className="muted" role="status">
          正在处理数据…
        </p>
      )}
      {status && (
        <p className="success-text" role="status">
          {status}
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      <section className="guide">
        <h3>添加到 iPhone 主屏幕</h3>
        <ol>
          <li>使用 Safari 打开正式部署的 HTTPS 网址。</li>
          <li>点击分享按钮，选择“添加到主屏幕”。</li>
          <li>首次联网打开，看到“离线已就绪”后即可离线使用。</li>
        </ol>
        <p>
          离线可查看、添加、编辑和复习单词。缓存完成后，本地词典可自动提供收录词的中文释义，支持手动修改。在线词典查询和音频通常需要网络；缺少的音标、例句不会虚构。
        </p>
        <p>
          更新 App 不会主动清除 IndexedDB；但 iOS
          可能回收网站存储。导出文件才是可靠备份。
        </p>
      </section>
    </Sheet>
  );
}

function ReviewPage({
  words,
  categories,
  reviewsToday,
  onRate,
}: {
  words: Word[];
  categories: string[];
  reviewsToday: number;
  onRate: (word: Word, mastered: boolean) => Promise<void>;
}) {
  const [filter, setFilter] = useState("learning");
  const [category, setCategory] = useState("all");
  const [queue, setQueue] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pool = words.filter(
    (w) =>
      (filter === "all" ||
        (filter === "learning" ? !w.mastered : w.favorite)) &&
      (category === "all" || w.category === category),
  );
  const current = words.find((w) => w.id === queue[index]);
  function start() {
    const ids = pool.map((w) => w.id);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    setQueue(ids);
    setIndex(0);
    setRevealed(false);
    setActive(true);
    setError("");
  }
  async function rate(mastered: boolean) {
    if (!current) return;
    setBusy(true);
    setError("");
    try {
      await onRate(current, mastered);
      setIndex((i) => i + 1);
      setRevealed(false);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="review-page">
      <div className="section-intro">
        <span className="eyebrow">A LITTLE EVERY DAY</span>
        <h1>让记忆，再深一点</h1>
        <p>不必一次记住所有，今天多认识一个就好。</p>
      </div>
      {!active ? (
        <>
          <div className="review-summary">
            <span className="review-illustration">
              <BookOpen size={46} strokeWidth={1.2} />
              <Sparkles size={22} />
            </span>
            <strong>
              今日已复习 <b>{reviewsToday}</b> 次
            </strong>
            <p>翻开卡片，看看你还记得多少。</p>
          </div>
          <div className="review-controls">
            <label htmlFor="review-scope">复习范围</label>
            <select
              id="review-scope"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="learning">未掌握的单词</option>
              <option value="all">全部单词</option>
              <option value="favorites">收藏单词</option>
            </select>
            <label htmlFor="review-category">选择分类</label>
            <select
              id="review-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">全部分类</option>
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
            <button
              className="primary full"
              disabled={!pool.length}
              onClick={start}
            >
              <Shuffle size={19} />
              随机开始复习 · {pool.length} 词
            </button>
            {!pool.length && (
              <p className="small muted center">
                这个范围还没有单词，试试其他范围或先添加单词。
              </p>
            )}
          </div>
        </>
      ) : !current ? (
        <div className="review-complete">
          <CircleCheck size={50} strokeWidth={1.3} />
          <h2>这一轮，完成了！</h2>
          <p>复习了 {index} 个单词，学习记录已保存。</p>
          <button className="primary" onClick={() => setActive(false)}>
            返回复习首页
          </button>
        </div>
      ) : (
        <>
          <div className="review-progress">
            <button
              className="text-button"
              disabled={busy}
              onClick={() => setActive(false)}
            >
              <ArrowLeft size={16} />
              结束本轮
            </button>
            <span>
              {index + 1} / {queue.length}
            </span>
          </div>
          <div className="progress-track">
            <div style={{ width: `${(index / queue.length) * 100}%` }} />
          </div>
          <article className="review-card" key={current.id}>
            <span className="eyebrow">{current.category}</span>
            <h2 lang="en">{current.text}</h2>
            <AudioButtons data={current} word={current.text} />
            {!revealed ? (
              <button
                className="reveal-button"
                onClick={() => setRevealed(true)}
              >
                想一想，再查看释义
                <ArrowRight size={17} />
              </button>
            ) : (
              <div className="review-answer">
                <p className="chinese">
                  {current.chinese || "尚未填写中文释义"}
                </p>
                {current.notes && (
                  <p className="muted prewrap">{current.notes}</p>
                )}
                <Definitions data={current} />
              </div>
            )}
          </article>
          {revealed && (
            <div className="rating-actions">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => void rate(false)}
              >
                还需复习
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={() => void rate(true)}
              >
                <Check size={18} />
                已掌握
              </button>
            </div>
          )}
          <p className="center small muted">根据真实记忆选择，慢慢来就好。</p>
        </>
      )}
      {error && (
        <p role="alert" className="error-text">
          {error}
        </p>
      )}
    </section>
  );
}

export default function App() {
  const [data, setData] = useState<Awaited<ReturnType<typeof readAll>>>({
    words: [],
    categories: ["日常英语", "商务英语", "陶瓷专业英语", "其他"],
    reviews: [],
    lastBackup: undefined,
  });
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [page, setPage] = useState<"words" | "review">("words");
  const [online, setOnline] = useState(navigator.onLine);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [filter, setFilter] = useState("all");
  const [quickText, setQuickText] = useState("");
  const [editor, setEditor] = useState<{ word?: Word; text: string } | null>(
    null,
  );
  const [detailId, setDetailId] = useState<string | null>(null);
  const [backup, setBackup] = useState(false);
  const [toast, setToast] = useState("");
  const [pwaError, setPwaError] = useState("");
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      setPwaError("离线缓存尚未就绪，请联网刷新后重试。");
    },
  });
  const refresh = useCallback(async () => {
    const result = await readAll();
    setData(result);
    setLoadError("");
    setLoaded(true);
  }, []);
  useEffect(() => {
    refresh().catch(() =>
      setLoadError(
        "无法打开本机数据库。请允许浏览器存储，并确认设备有可用空间后重试。",
      ),
    );
  }, [refresh]);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    const visible = () => {
      if (!document.hidden)
        refresh().catch(() => setLoadError("读取本机数据失败，请刷新重试。"));
    };
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    document.addEventListener("visibilitychange", visible);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [refresh]);
  useEffect(() => {
    if (toast) {
      const timeout = setTimeout(() => setToast(""), 3500);
      return () => clearTimeout(timeout);
    }
  }, [toast]);
  const detail = data.words.find((w) => w.id === detailId);
  const visibleWords = data.words.filter(
    (w) =>
      (!search.trim() ||
        `${w.text} ${w.chinese} ${w.notes}`
          .toLowerCase()
          .includes(search.trim().toLowerCase())) &&
      (category === "all" || w.category === category) &&
      (filter === "all" ||
        (filter === "favorites"
          ? w.favorite
          : filter === "mastered"
            ? w.mastered
            : !w.mastered)),
  );
  const today = new Date().toLocaleDateString();
  const reviewsToday = data.reviews.filter(
    (r) => new Date(r.createdAt).toLocaleDateString() === today,
  ).length;
  async function update(word: Word) {
    await saveWord({ ...word, updatedAt: new Date().toISOString() });
    await refresh();
  }
  return (
    <div className="app-shell">
      <div inert={!!editor || !!detail || backup}>
        <header className="app-header">
          <a
            className="brand"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setPage("words");
            }}
            aria-label="My Words 首页"
          >
            <span className="brand-icon">
              <BookOpen size={23} strokeWidth={1.7} />
            </span>
            <span>
              My Words<small>我的随身单词本</small>
            </span>
          </a>
          <div className="header-right">
            <span className={`connection ${!online ? "offline" : ""}`}>
              {!online ? (
                <>
                  <CloudOff size={13} />
                  离线模式
                </>
              ) : offlineReady ? (
                <>
                  <Check size={13} />
                  离线已就绪
                </>
              ) : (
                "本机保存"
              )}
            </span>
            <button
              className="icon-button"
              aria-label="备份与设置"
              onClick={() => setBackup(true)}
            >
              <Settings2 size={21} />
            </button>
          </div>
        </header>
        {loadError && (
          <div className="error-banner" role="alert">
            {loadError}
            <button
              className="text-button"
              onClick={() =>
                void refresh().catch(() =>
                  setLoadError(
                    "仍无法打开数据库，请检查浏览器存储权限和设备空间。",
                  ),
                )
              }
            >
              重试
            </button>
          </div>
        )}
        {pwaError && (
          <p role="status" className="error-banner">
            {pwaError}
          </p>
        )}
        {needRefresh && !editor && !backup && (
          <div className="update-banner" role="status">
            <span>新版本已就绪，更新会保留已有单词。</span>
            <button
              className="text-button"
              onClick={() =>
                void updateServiceWorker(true).catch(() =>
                  setPwaError("更新失败，请联网后重试。"),
                )
              }
            >
              立即更新
            </button>
          </div>
        )}
        <main>
          {page === "words" ? (
            <>
              <section className="hero">
                <div>
                  <span className="eyebrow">YOUR EVERYDAY WORD COMPANION</span>
                  <h1>
                    每个单词，
                    <br />
                    都值得被记住<span className="blue-dot">。</span>
                  </h1>
                  <p>收集生活里的新词，让英语慢慢成为你的日常。</p>
                  <form
                    className="quick-add"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (quickText.trim()) setEditor({ text: quickText });
                    }}
                  >
                    <Plus size={20} />
                    <input
                      aria-label="快速添加英文单词"
                      placeholder="遇见了哪个新单词？"
                      lang="en"
                      autoCapitalize="none"
                      autoComplete="off"
                      spellCheck={false}
                      maxLength={100}
                      value={quickText}
                      onChange={(e) => setQuickText(e.target.value)}
                    />
                    <button
                      aria-label="添加这个单词"
                      disabled={!loaded || !!loadError || !quickText.trim()}
                      type="submit"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </form>
                </div>
                <div className="hero-art" aria-hidden="true">
                  <span className="art-label">ONE WORD AT A TIME</span>
                  <div className="art-book">
                    <BookOpen size={78} strokeWidth={0.9} />
                    <span>
                      words
                      <br />
                      <i>to keep.</i>
                    </span>
                  </div>
                  <Sparkles className="art-spark" size={32} strokeWidth={1} />
                  <span className="art-caption">把遇见，变成积累。</span>
                </div>
              </section>
              <section className="stats" aria-label="学习统计">
                <div>
                  <span>单词总数</span>
                  <strong>
                    {data.words.length.toString().padStart(2, "0")}
                    <small>词</small>
                  </strong>
                </div>
                <div>
                  <span>已掌握</span>
                  <strong>
                    {data.words
                      .filter((w) => w.mastered)
                      .length.toString()
                      .padStart(2, "0")}
                    <small>词</small>
                  </strong>
                </div>
                <div>
                  <span>我的收藏</span>
                  <strong>
                    {data.words
                      .filter((w) => w.favorite)
                      .length.toString()
                      .padStart(2, "0")}
                    <small>词</small>
                  </strong>
                </div>
                <div>
                  <span>今日复习</span>
                  <strong>
                    {reviewsToday.toString().padStart(2, "0")}
                    <small>次</small>
                  </strong>
                </div>
              </section>
              <section className="notebook">
                <div className="section-title">
                  <h2>
                    我的单词本 <span>{data.words.length}</span>
                  </h2>
                  <button
                    className="text-button"
                    onClick={() => setBackup(true)}
                  >
                    <ArrowDownToLine size={15} />
                    数据备份
                  </button>
                </div>
                <div className="search-sort">
                  <div className="search-box">
                    <Search size={18} />
                    <input
                      aria-label="搜索单词"
                      value={search}
                      placeholder="搜索英文、中文释义或备注"
                      onChange={(e) => setSearch(e.target.value)}
                    />
                    {search && (
                      <button
                        className="icon-button"
                        aria-label="清空搜索"
                        onClick={() => setSearch("")}
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                  <select
                    aria-label="筛选掌握与收藏"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                  >
                    <option value="all">全部状态</option>
                    <option value="favorites">我的收藏</option>
                    <option value="learning">未掌握</option>
                    <option value="mastered">已掌握</option>
                  </select>
                </div>
                <div className="category-tabs" aria-label="分类筛选">
                  <button
                    className={
                      category === "all" ? "category active" : "category"
                    }
                    onClick={() => setCategory("all")}
                  >
                    全部单词
                  </button>
                  {data.categories.map((c) => (
                    <button
                      className={
                        category === c ? "category active" : "category"
                      }
                      key={c}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {!loaded && !loadError ? (
                  <div className="empty-state">
                    <LoaderCircle className="spin" />
                    正在打开你的单词本…
                  </div>
                ) : visibleWords.length ? (
                  <div className="word-grid">
                    {visibleWords.map((w) => (
                      <article className="word-item" key={w.id}>
                        <button
                          className="word-main"
                          aria-label={`查看 ${w.text}`}
                          onClick={() => setDetailId(w.id)}
                        >
                          <div className="word-heading">
                            <h3 lang="en">{w.text}</h3>
                            {w.mastered && (
                              <span className="mastered-label">
                                <Check size={12} />
                                已掌握
                              </span>
                            )}
                          </div>
                          <p className="phonetic">
                            {w.phonetic || "待补充音标"}
                          </p>
                          <p
                            className={`word-translation ${w.chinese ? "" : "muted"}`}
                          >
                            {w.chinese ||
                              w.meanings[0]?.definition ||
                              "点击填写中文释义"}
                          </p>
                          <div className="word-meta">
                            <span>{w.category}</span>
                            <span>{dateLabel(w.createdAt)}</span>
                          </div>
                        </button>
                        <button
                          className={`favorite-button ${w.favorite ? "is-favorite" : ""}`}
                          aria-label={`${w.favorite ? "取消收藏" : "收藏"} ${w.text}`}
                          aria-pressed={w.favorite}
                          onClick={() =>
                            void update({ ...w, favorite: !w.favorite }).catch(
                              (e) => setToast(message(e)),
                            )
                          }
                        >
                          <Heart
                            size={19}
                            fill={w.favorite ? "currentColor" : "none"}
                          />
                        </button>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <span className="empty-icon">
                      <BookOpen size={32} strokeWidth={1.3} />
                    </span>
                    <h3>
                      {data.words.length
                        ? "没有找到匹配的单词"
                        : "从第一个单词开始"}
                    </h3>
                    <p>
                      {data.words.length
                        ? "换个关键词或筛选条件试试。"
                        : "一个词，一点进步。把今天遇见的新词收进来。"}
                    </p>
                    <button
                      className="secondary"
                      disabled={!loaded || !!loadError}
                      onClick={() => {
                        if (data.words.length) {
                          setSearch("");
                          setCategory("all");
                          setFilter("all");
                        } else setEditor({ text: "" });
                      }}
                    >
                      {data.words.length ? "重置筛选" : "添加第一个单词"}
                      <Plus size={16} />
                    </button>
                  </div>
                )}
              </section>
              <button
                className="backup-reminder"
                onClick={() => setBackup(true)}
              >
                <Info size={17} />
                <span>单词保存在此设备，记得定期导出备份。</span>
                <ChevronRight size={16} />
              </button>
              <p className="page-footer">Little words. Lasting progress.</p>
            </>
          ) : (
            <ReviewPage
              words={data.words}
              categories={data.categories}
              reviewsToday={reviewsToday}
              onRate={async (w, mastered) => {
                await recordReview(w, mastered);
                await refresh();
              }}
            />
          )}
        </main>
        <nav className="bottom-nav" aria-label="主导航">
          <button
            className={page === "words" ? "nav-item selected" : "nav-item"}
            aria-current={page === "words" ? "page" : undefined}
            onClick={() => setPage("words")}
          >
            <BookOpen size={22} />
            <span>单词本</span>
          </button>
          <button
            className="nav-add"
            disabled={!loaded || !!loadError}
            onClick={() => setEditor({ text: "" })}
          >
            <span>
              <Plus size={24} />
            </span>
            添加单词
          </button>
          <button
            className={page === "review" ? "nav-item selected" : "nav-item"}
            aria-current={page === "review" ? "page" : undefined}
            onClick={() => setPage("review")}
          >
            <Shuffle size={22} />
            <span>复习</span>
          </button>
        </nav>
      </div>
      {detail && !editor && (
        <WordDetail
          word={detail}
          onClose={() => setDetailId(null)}
          onEdit={() => setEditor({ word: detail, text: "" })}
          onChange={update}
          onDelete={async () => {
            await removeWord(detail.id);
            await refresh();
            setDetailId(null);
            setToast("单词已删除");
          }}
        />
      )}
      {editor && (
        <Editor
          key={editor.word?.id || "new"}
          word={editor.word}
          initialText={editor.text}
          categories={data.categories}
          onClose={() => setEditor(null)}
          onSaved={async () => {
            await refresh();
            setQuickText("");
            setToast(editor.word ? "修改已保存" : "新单词已收好");
          }}
        />
      )}
      {backup && (
        <BackupPanel
          lastBackup={data.lastBackup}
          onClose={() => setBackup(false)}
          onRefresh={refresh}
        />
      )}
      {toast && (
        <div role="status" className="toast">
          {toast}
        </div>
      )}
    </div>
  );
}
