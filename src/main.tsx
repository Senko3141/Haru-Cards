import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { createEmptyCard, type Grade } from "ts-fsrs";
import { useRegisterSW } from "virtual:pwa-register/react";
import {
  readData,
  saveData,
  parseBackup,
  mergeStarterContent,
  queue,
  review,
  localDay,
  newToday,
  scheduler,
  type AppData,
  type StudyCard,
} from "./store";
import "./style.css";
function App() {
  const [activeId, setActiveId] = useState<string>();
  const [data, setData] = useState<AppData>();
  const [fatal, setFatal] = useState("");
  const [screen, setScreen] = useState("Learn");
  const [lessonId, setLessonId] = useState<string>();
  const [step, setStep] = useState(0);
  const [feedback, setFeedback] = useState("");
  const [passed, setPassed] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState<AppData>();
  const [editor, setEditor] = useState<Partial<StudyCard>>();
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const {
    offlineReady: [offlineReady],
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError() {
      setNotice("Offline setup failed. Reconnect and reload to try again.");
    },
  });
  useEffect(() => {
    readData()
      .then(setData)
      .catch(() =>
        setFatal(
          "Your saved data could not be opened. Storage may be unavailable or the saved format may be damaged. Nothing has been overwritten. Try reopening outside private browsing.",
        ),
      );
    const tick = setInterval(() => setNow(new Date()), 1000);
    const connectivity = () => setOnline(navigator.onLine);
    window.addEventListener("online", connectivity);
    window.addEventListener("offline", connectivity);
    const refresh = () =>
      setVoices(
        window.speechSynthesis
          ?.getVoices()
          .filter((v) => /^ko(?:-|_)/i.test(v.lang)) ?? [],
      );
    refresh();
    window.speechSynthesis?.addEventListener("voiceschanged", refresh);
    return () => {
      clearInterval(tick);
      window.removeEventListener("online", connectivity);
      window.removeEventListener("offline", connectivity);
      window.speechSynthesis?.removeEventListener("voiceschanged", refresh);
    };
  }, []);
  // iOS may resume an installed app instead of navigating it again.
  // Check on return, reconnect, and periodically; activation still needs a tap.
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let checking = false;
    const checkForUpdate = async () => {
      if (
        checking ||
        !navigator.onLine ||
        document.visibilityState !== "visible"
      )
        return;
      checking = true;
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        await registration?.update();
      } catch {
        // A failed background check should never interrupt offline study.
      } finally {
        checking = false;
      }
    };
    void checkForUpdate();
    window.addEventListener("online", checkForUpdate);
    document.addEventListener("visibilitychange", checkForUpdate);
    const timer = window.setInterval(checkForUpdate, 60_000);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", checkForUpdate);
      document.removeEventListener("visibilitychange", checkForUpdate);
    };
  }, []);
  useEffect(() => {
    if (data && screen === "Review" && !activeId) {
      const first = queue(data, now)[0];
      if (first) setActiveId(first.id);
    }
  }, [data, screen, activeId, now]);
  async function commit(next: AppData) {
    if (saving.current) return false;
    saving.current = true;
    setBusy(true);
    try {
      await saveData(next, data);
      setData(next);
      return true;
    } catch {
      setNotice(
        "Could not save. Your last saved progress is unchanged. Check available storage. If another tab changed your data, reload this tab before continuing.",
      );
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  function speak(text: string) {
    const voice = voices.find((v) => v.localService) ?? voices[0];
    if (!voice) {
      setNotice(
        "No Korean voice is available on this device. Try enabling a Korean voice in iPhone accessibility speech settings, then reopen the app. Text practice still works.",
      );
      return;
    }
    if (!online && !voice.localService) {
      setNotice(
        "This Korean voice requires a connection. Text practice is available offline.",
      );
      return;
    }
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "ko-KR";
    utterance.voice = voice;
    utterance.rate = 0.8;
    utterance.onerror = () =>
      setNotice(
        "Audio could not play. Device voices may need an internet connection or a downloaded Korean voice.",
      );
    speechSynthesis.speak(utterance);
  }
  function exportBackup() {
    if (!data) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `haru-cards-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  async function importBackup(file?: File) {
    if (!file) return;
    try {
      if (file.size > 25 * 1024 * 1024) throw Error();
      setPending(
        mergeStarterContent(parseBackup(JSON.parse(await file.text()))),
      );
    } catch {
      setNotice(
        "This is not a valid Haru Cards v1 backup (maximum 25 MB). Your data has not changed.",
      );
    }
  }
  if (!data)
    return (
      <main className="loading">
        <div className="brandmark">하</div>
        <h1>Haru Cards</h1>
        <p role="status">{fatal || "Opening your learning space…"}</p>
      </main>
    );
  const available = queue(data, now);
  const current = data.cards.find((c) => c.id === activeId) ?? available[0];
  const lesson = data.lessons.find((l) => l.id === lessonId);
  const lessonCards = lesson
    ? data.cards.filter((c) => c.lessonId === lesson.id)
    : [];
  const sample = lessonCards[step];
  const todayReviews = data.history.filter(
    (h) => localDay(new Date(h.at)) === localDay(now),
  ).length;
  const nextLesson = data.lessons.find((l) => !data.completed.includes(l.id));
  const future = data.cards
    .filter((c) => c.schedule.reps > 0 && c.schedule.due > now)
    .sort((a, b) => +a.schedule.due - +b.schedule.due)[0];
  function changeScreen(s: string) {
    setActiveId(undefined);
    setScreen(s);
    setLessonId(undefined);
    setRevealed(false);
    setHint(false);
    setEditor(undefined);
  }
  function openLesson(id: string) {
    setLessonId(id);
    setStep(0);
    setPassed(false);
    setFeedback("");
  }
  async function rate(grade: Grade) {
    if (!current || !revealed) return;
    if (await commit(review(data!, current.id, grade, new Date()))) {
      setActiveId(undefined);
      setRevealed(false);
      setHint(false);
    }
  }
  const interval = (date: Date) => {
    const minutes = Math.max(1, Math.round((+date - +now) / 60000));
    return minutes < 60
      ? `${minutes} min`
      : minutes < 1440
        ? `${Math.round(minutes / 60)} hr`
        : `${Math.round(minutes / 1440)} d`;
  };
  return (
    <>
      <header>
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            changeScreen("Learn");
          }}
        >
          <span className="brandmark">하</span>
          <span>
            haru <b>cards</b>
          </span>
        </a>
        <span className="status">
          <i />
          {!online
            ? "Offline"
            : offlineReady
              ? "Saved for offline"
              : "Your daily Korean"}
        </span>
      </header>
      <main>
        {notice && (
          <div className="notice" role="status">
            {notice}
            <button aria-label="Dismiss message" onClick={() => setNotice("")}>
              ×
            </button>
          </div>
        )}
        {needRefresh && (
          <div className="notice">
            An app update is ready.
            <button disabled={busy} onClick={() => updateServiceWorker(true)}>
              Update & reload
            </button>
          </div>
        )}
        {screen === "Learn" && !lesson && (
          <>
            <div className="eyebrow">작은 시작 · A SMALL BEGINNING</div>
            <h1>
              A little Korean.
              <br />
              <em>Every day.</em>
            </h1>
            <p className="intro">
              From your first letter to your first words.
              <br />
              One small step is enough for today.
            </p>
            <section className="hero">
              <div>
                <span className="eyebrow">YOUR NEXT STEP</span>
                <h2>{nextLesson?.title ?? "Keep your Korean growing"}</h2>
                <p>
                  {nextLesson?.subtitle ??
                    "Revisit a lesson or practice what you know."}
                </p>
                <button
                  className="primary"
                  onClick={() =>
                    nextLesson
                      ? openLesson(nextLesson.id)
                      : changeScreen("Review")
                  }
                >
                  {data.completed.length
                    ? "Continue learning"
                    : "Start with Hangul"}{" "}
                  <span>↗</span>
                </button>
              </div>
              <div className="tile-art" aria-hidden="true">
                <span>한</span>
                <span>글</span>
                <small>HANGUL</small>
              </div>
            </section>
            <div className="section-head">
              <h2>Your learning path</h2>
              <span>
                {data.completed.length} / {data.lessons.length} complete
              </span>
            </div>
            <div className="path">
              {data.lessons.map((l, i) => {
                const complete = data.completed.includes(l.id);
                const unlocked =
                  i === 0 || data.completed.includes(data.lessons[i - 1].id);
                return (
                  <button
                    className="lesson-row"
                    key={l.id}
                    disabled={!unlocked}
                    onClick={() => openLesson(l.id)}
                  >
                    <span className={`number ${complete ? "done" : ""}`}>
                      {complete ? "✓" : String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <strong>{l.title}</strong>
                      <small>{l.subtitle}</small>
                    </span>
                    <span className="arrow">{unlocked ? "↗" : "Later"}</span>
                  </button>
                );
              })}
            </div>
            <div className="tip">
              <span>✦</span>
              <p>
                <b>Small sessions, lasting memories.</b>
                <br />
                Try five new cards a day. Your reviews will return when it’s
                time.
              </p>
            </div>
          </>
        )}
        {screen === "Learn" && lesson && (
          <>
            <button
              className="text-button"
              onClick={() => setLessonId(undefined)}
            >
              ← Learning path
            </button>
            <div className="eyebrow">
              GUIDED LESSON · {Math.min(step + 1, lessonCards.length + 1)} /{" "}
              {lessonCards.length + 1}
            </div>
            <h1 className="small-title">{lesson.title}</h1>
            <p className="lesson-copy">{lesson.text}</p>
            {sample ? (
              <section className="flashcard">
                <span className="eyebrow">
                  {step + 1} OF {lessonCards.length} · SAY IT OUT LOUD
                </span>
                <div className="hangul" lang="ko">
                  {sample.front}
                </div>
                <h2>{sample.back}</h2>
                <p>{sample.note}</p>
                <button
                  className="secondary"
                  onClick={() => speak(sample.speak)}
                >
                  ♪ Listen to <span lang="ko">{sample.speak}</span>
                </button>
              </section>
            ) : (
              <section className="panel">
                <span className="eyebrow">QUICK CHECK</span>
                <h2>{lesson.check.question}</h2>
                <div className="choices">
                  {lesson.check.options.map((opt, i) => (
                    <button
                      className="secondary"
                      key={i}
                      onClick={() => {
                        setPassed(i === lesson.check.answer);
                        setFeedback(
                          i === lesson.check.answer
                            ? lesson.check.explanation
                            : "Not quite. Revisit the examples, then try again.",
                        );
                      }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
                <p role="status">{feedback}</p>
              </section>
            )}
            <div className="lesson-controls">
              <button
                className="secondary"
                disabled={step === 0}
                onClick={() => {
                  setStep(step - 1);
                  setPassed(false);
                  setFeedback("");
                }}
              >
                Back
              </button>
              {sample ? (
                <button className="primary" onClick={() => setStep(step + 1)}>
                  Next →
                </button>
              ) : (
                <button
                  className="primary"
                  disabled={!passed || busy}
                  onClick={async () => {
                    if (
                      await commit({
                        ...data,
                        completed: [...new Set([...data.completed, lesson.id])],
                      })
                    ) {
                      setLessonId(undefined);
                      changeScreen("Review");
                    }
                  }}
                >
                  Finish & practice
                </button>
              )}
            </div>
          </>
        )}
        {screen === "Review" && (
          <>
            <div className="eyebrow">MAKE IT STICK</div>
            <h1>Your daily practice.</h1>
            <p className="intro">Recall first. Reveal when you’re ready.</p>
            <div className="review-meta">
              <span>{available.length} ready now</span>
              <span>
                {newToday(data, now)} / {data.settings.newLimit} new today
              </span>
            </div>
            {current ? (
              <section className="flashcard" key={current.id}>
                <span className="eyebrow">
                  {current.lessonId === "words" || current.lessonId === "custom"
                    ? "WHAT DOES THIS MEAN?"
                    : "HOW DO YOU READ THIS?"}
                </span>
                <div className="hangul" lang="ko">
                  {current.front}
                </div>
                {!revealed && (
                  <>
                    <button
                      className="text-button"
                      onClick={() => setHint(!hint)}
                    >
                      {hint ? "Hide" : "Show"} romanization hint
                    </button>
                    {hint && <p>{current.roman || "No hint added."}</p>}
                  </>
                )}
                {revealed ? (
                  <>
                    <h2>{current.back}</h2>
                    <p>{current.note}</p>
                    <button
                      className="secondary"
                      onClick={() => speak(current.speak || current.front)}
                    >
                      ♪ Listen
                    </button>
                    <p className="muted">How well did you remember?</p>
                    <div className="ratings">
                      {(["Again", "Hard", "Good", "Easy"] as const).map(
                        (label, i) => (
                          <button
                            disabled={busy}
                            className={`rating rating-${i}`}
                            key={label}
                            onClick={() => rate((i + 1) as Grade)}
                          >
                            {label}
                            <small>
                              {interval(
                                scheduler.next(
                                  current.schedule,
                                  now,
                                  (i + 1) as Grade,
                                ).card.due,
                              )}
                            </small>
                          </button>
                        ),
                      )}
                    </div>
                  </>
                ) : (
                  <button
                    className="primary reveal"
                    onClick={() => setRevealed(true)}
                  >
                    Reveal answer
                  </button>
                )}
              </section>
            ) : (
              <section className="panel empty">
                <div className="empty-symbol">✦</div>
                <h2>
                  {data.completed.length ||
                  data.cards.some((c) => c.lessonId === "custom")
                    ? "You’re caught up for now."
                    : "Your first step starts in Learn."}
                </h2>
                <p>
                  {future
                    ? `Next scheduled review: ${future.schedule.due.toLocaleString()}.`
                    : nextLesson
                      ? "Complete a lesson to unlock its cards."
                      : "Come back tomorrow for more new cards."}
                </p>
                {newToday(data, now) >= data.settings.newLimit && (
                  <p>Your daily new-card limit has been reached.</p>
                )}
                <button
                  className="primary"
                  onClick={() => changeScreen("Learn")}
                >
                  Explore lessons →
                </button>
              </section>
            )}
            <p className="footnote">
              Again = forgot · Hard = recalled with effort
              <br />
              Good = recalled · Easy = effortless
            </p>
          </>
        )}
        {screen === "Progress" && (
          <>
            <div className="eyebrow">YOUR SMALL STEPS ADD UP</div>
            <h1>
              Look how far
              <br />
              <em>you’ve come.</em>
            </h1>
            <div className="stats">
              <div>
                <b>{todayReviews}</b>
                <span>Reviews today</span>
              </div>
              <div>
                <b>{data.cards.filter((c) => c.schedule.reps > 0).length}</b>
                <span>Cards started</span>
              </div>
              <div>
                <b>{data.completed.length}</b>
                <span>Lessons complete</span>
              </div>
            </div>
            <section className="panel">
              <h2>Make it your routine</h2>
              <label className="setting">
                New cards per day
                <select
                  aria-label="New cards per day"
                  value={data.settings.newLimit}
                  disabled={busy}
                  onChange={(e) =>
                    commit({
                      ...data,
                      settings: { newLimit: Number(e.target.value) },
                    })
                  }
                >
                  {[
                    ...new Set([
                      0,
                      3,
                      5,
                      10,
                      15,
                      20,
                      50,
                      100,
                      data.settings.newLimit,
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                </select>
              </label>
              <p className="muted">
                Due reviews are always available, even when you pause new cards.
              </p>
            </section>
            <section className="panel">
              <div className="section-head">
                <h2>Your vocabulary</h2>
                <button
                  className="secondary"
                  onClick={() =>
                    setEditor({ front: "", back: "", roman: "", note: "" })
                  }
                >
                  + Add
                </button>
              </div>
              <p className="muted">
                New words enter your daily queue. Editing keeps their review
                history.
              </p>
              {data.cards
                .filter(
                  (c) => c.lessonId === "words" || c.lessonId === "custom",
                )
                .map((c) => (
                  <div className="word-row" key={c.id}>
                    <span>
                      <b lang="ko">{c.front}</b>
                      <small>{c.back}</small>
                    </span>
                    <button
                      aria-label={`Edit ${c.front}`}
                      className="text-button"
                      onClick={() => setEditor(c)}
                    >
                      Edit
                    </button>
                  </div>
                ))}
            </section>
            <section className="panel">
              <h2>Keep a copy</h2>
              <p>
                Your learning stays on this device. Export regularly: clearing
                website data or changing the app’s web address can separate you
                from this progress.
              </p>
              <div className="button-row">
                <button className="secondary" onClick={exportBackup}>
                  Export backup
                </button>
                <label className="secondary file-label">
                  Import backup
                  <input
                    type="file"
                    accept=".json,application/json"
                    disabled={busy}
                    onChange={(e) => {
                      importBackup(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
            </section>
            <section className="panel">
              <h2>On your iPhone</h2>
              <p>
                In Safari, tap Share → Add to Home Screen. Open the installed
                app while online once, then test it in Airplane Mode.
              </p>
              <p>
                <b>
                  {offlineReady
                    ? "The app is ready for offline text study."
                    : "Offline setup completes on the production build over HTTPS (or localhost). "}
                </b>
              </p>
              <p className="muted">
                Pronunciation uses your device’s Korean voice.{" "}
                {voices.length
                  ? voices.some((v) => v.localService)
                    ? "A local Korean voice is available; test playback offline on your device."
                    : "The available voice uses an online service."
                  : "No Korean voice is currently available."}{" "}
                Audio is optional and is not bundled with this app.
              </p>
            </section>
          </>
        )}
      </main>
      <nav aria-label="Main navigation">
        {[
          ["Learn", "◫"],
          ["Review", "▱"],
          ["Progress", "◴"],
        ].map(([label, icon]) => (
          <button
            key={label}
            aria-current={screen === label ? "page" : undefined}
            onClick={() => changeScreen(label)}
          >
            <span aria-hidden="true">{icon}</span>
            {label}
            {label === "Review" && available.length > 0 && (
              <i>{available.length}</i>
            )}
          </button>
        ))}
      </nav>
      {pending && (
        <div className="overlay">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="restore-title"
          >
            <h2 id="restore-title">Replace current progress?</h2>
            <p>
              This backup contains {pending.cards.length} cards and{" "}
              {pending.history.length} reviews. Restoring replaces all current
              lessons, cards, settings, and history.
            </p>
            <button className="secondary" onClick={exportBackup}>
              Export current data first
            </button>
            <div className="button-row">
              <button
                className="secondary"
                disabled={busy}
                onClick={() => setPending(undefined)}
              >
                Cancel
              </button>
              <button
                className="primary"
                disabled={busy}
                onClick={async () => {
                  if (await commit(pending)) {
                    setPending(undefined);
                    changeScreen("Progress");
                    setNotice("Backup restored.");
                  }
                }}
              >
                Replace & restore
              </button>
            </div>
          </section>
        </div>
      )}
      {editor && (
        <div className="overlay">
          <form
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editor-title"
            onSubmit={async (e) => {
              e.preventDefault();
              const front = editor.front?.trim();
              const back = editor.back?.trim();
              if (!front || !back) return;
              const card: StudyCard = {
                id:
                  editor.id ??
                  crypto.randomUUID?.() ??
                  `custom-${Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => n.toString(16)).join("-")}`,
                lessonId: editor.lessonId ?? "custom",
                schedule: editor.schedule ?? createEmptyCard(),
                front,
                back,
                roman: editor.roman?.trim() ?? "",
                note: editor.note?.trim() ?? "",
                speak: front,
              };
              if (
                await commit({
                  ...data,
                  cards: editor.id
                    ? data.cards.map((c) => (c.id === editor.id ? card : c))
                    : [...data.cards, card],
                })
              )
                setEditor(undefined);
            }}
          >
            <h2 id="editor-title">{editor.id ? "Edit word" : "A new word"}</h2>
            {(
              [
                ["front", "Korean"],
                ["back", "Meaning"],
                ["roman", "Romanization (optional)"],
                ["note", "Example or note (optional)"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  autoFocus={key === "front"}
                  required={key === "front" || key === "back"}
                  maxLength={2000}
                  value={editor[key] ?? ""}
                  onChange={(e) =>
                    setEditor({ ...editor, [key]: e.target.value })
                  }
                />
              </label>
            ))}
            <div className="button-row">
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => setEditor(undefined)}
              >
                Cancel
              </button>
              <button className="primary" disabled={busy}>
                Save word
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
