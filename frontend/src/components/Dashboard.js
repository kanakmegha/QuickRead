import React, { useState, useEffect, useRef } from "react";
import "../App.css";

/**
 * Dashboard: Book View + Speed Reader
 * - Pages: 200 words per page (user requested)
 * - Both modes start from Preface/Introduction if present
 * - Book View: shows pages, first letter of each word bolded
 * - Speed Reader: word-by-word reading with WPM control, Prev/Next word, Pause/Resume
 */

const PAGE_WORD_COUNT = 200; // words per page

export default function Dashboard() {
  const [rawSentences, setRawSentences] = useState([]); // backend sentences (objects or strings)
  const [allWords, setAllWords] = useState([]); // flattened words (starting from preface)
  const [pages, setPages] = useState([]); // array of pages (each page = array of words)
  const [currentPage, setCurrentPage] = useState(0);

  const [currentWordIndex, setCurrentWordIndex] = useState(0); // index relative to allWords
  const [mode, setMode] = useState("book"); // "book" or "speed" — default Book View
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);

  const [wpm, setWpm] = useState(300); // words per minute for speed reader
  const intervalRef = useRef(null);

  const backendUrl = "https://quickread-bggq.onrender.com"; // change if needed

  // Utility: clear interval safely
  const clearReaderInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Convert backend sentences to array of strings (handles object or string)
  const normalizeSentences = (sentences) => {
    if (!Array.isArray(sentences)) return [];
    if (sentences.length === 0) return [];
    const first = sentences[0];
    if (typeof first === "string") {
      return sentences;
    }
    if (typeof first === "object") {
      // find probable key containing text
      if ("sentence" in first) {
        return sentences.map((s) => (s && s.sentence) || "");
      }
      // fallback: take first string-like property
      return sentences.map((s) => {
        const keys = Object.keys(s);
        for (const k of keys) {
          if (typeof s[k] === "string") return s[k];
        }
        return "";
      });
    }
    return sentences.map(String);
  };

  // After rawSentences changes: build words (starting at preface) and paginate
  useEffect(() => {
    if (!rawSentences || rawSentences.length === 0) {
      setAllWords([]);
      setPages([]);
      setCurrentPage(0);
      setCurrentWordIndex(0);
      return;
    }

    console.log("📌 Normalizing sentences from backend...");
    const sentenceTexts = normalizeSentences(rawSentences);

    // Make a big string of full book text
    const fullText = sentenceTexts.join(" ");

    // Find preface/introduction start
    const lower = fullText.toLowerCase();
    let prefacePos = -1;
    const prefaceMatch = lower.match(/preface|introduction/);
    if (prefaceMatch) {
      prefacePos = lower.indexOf(prefaceMatch[0]);
    }
    const startFrom = prefacePos >= 0 ? prefacePos : 0;
    console.log("🔍 Preface position in full text:", prefacePos);

    // Extract substring from preface start
    const textFromPreface = fullText.slice(startFrom);

    // Clean text: keep word characters and common punctuation only replaced with spaces for splitting
    // but keep apostrophes so contractions remain intact.
    const cleaned = textFromPreface.replace(/[^\w\s’'`-]/g, " "); // remove odd punctuation but keep apostrophes/hyphens
    // split into words
    const words = cleaned.split(/\s+/).filter(Boolean);

    console.log("🔡 Total words from (preface..end):", words.length);
    // paginate into pages of PAGE_WORD_COUNT words
    const newPages = [];
    for (let i = 0; i < words.length; i += PAGE_WORD_COUNT) {
      newPages.push(words.slice(i, i + PAGE_WORD_COUNT));
    }

    setAllWords(words);
    setPages(newPages);
    setCurrentPage(0);
    setCurrentWordIndex(0);
    setReading(false);
    clearReaderInterval();
  }, [rawSentences]);

  // When WPM or reading changes, restart interval appropriately for speed mode
  useEffect(() => {
    if (mode !== "speed") {
      // ensure no interval running in book mode
      clearReaderInterval();
      return;
    }

    // If reading set true, start interval
    if (reading) {
      clearReaderInterval();
      const ms = Math.max(10, Math.round(60000 / Math.max(1, wpm))); // ms per word
      intervalRef.current = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= allWords.length - 1) {
            clearReaderInterval();
            setReading(false);
            return prev;
          }
          // update page if needed
          const next = prev + 1;
          const nextPage = Math.floor(next / PAGE_WORD_COUNT);
          if (nextPage !== currentPage) {
            setCurrentPage(nextPage);
          }
          return next;
        });
      }, ms);
    } else {
      clearReaderInterval();
    }

    // cleanup on unmount or changes
    return () => clearReaderInterval();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reading, wpm, mode, allWords.length]); // watch mode so intervals are toggled correctly

  // Debug helper: logs
  useEffect(() => {
    console.log("📚 Pages count:", pages.length);
  }, [pages]);

  // Upload handler
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    console.log("📄 Selected file:", file.name);
    setLoading(true);
    setRawSentences([]);
    setPages([]);
    setAllWords([]);
    setCurrentPage(0);
    setCurrentWordIndex(0);
    setReading(false);
    clearReaderInterval();

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`Upload failed: ${res.status} ${txt}`);
      }

      const data = await res.json();
      console.log("📩 Backend response keys:", Object.keys(data));
      
      // Backend may return data.sentences as array of objects OR data.pages — handle both:
      if (Array.isArray(data.pages) && data.pages.length > 0) {
        // If backend gave pages already, convert pages -> sentences array without page markers:
        // We'll convert pages array into sentences-like array of strings joined by space.
        // But per user's request we will paginate ourselves using PAGE_WORD_COUNT; still use preface detection on joined pages.
        // Convert pages (strings) into sentence-like array for normalization
        const sentencesFromPages = data.pages.map((p) => (typeof p === "string" ? p : String(p)));
        setRawSentences(sentencesFromPages);
      } else if (Array.isArray(data.sentences) && data.sentences.length > 0) {
        setRawSentences(data.sentences);
      } else {
        // If backend returns a long string in data.text
        if (typeof data.text === "string" && data.text.length > 0) {
          setRawSentences([data.text]);
        } else {
          console.warn("⚠️ Backend returned unexpected response format:", data);
          setRawSentences([]);
        }
      }
    } catch (err) {
      console.error("❌ Upload error:", err);
      alert("Upload failed: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  // Controls for speed reader:
  const toggleReading = () => {
    if (!allWords.length) return;
    setReading((r) => !r);
  };

  const jumpPrevWord = () => {
    setReading(false);
    clearReaderInterval();
    setCurrentWordIndex((i) => Math.max(0, i - 1));
    setCurrentPage(Math.floor(Math.max(0, currentWordIndex - 1) / PAGE_WORD_COUNT));
  };
  const jumpNextWord = () => {
    setReading(false);
    clearReaderInterval();
    setCurrentWordIndex((i) => Math.min(allWords.length - 1, i + 1));
    setCurrentPage(Math.floor(Math.min(allWords.length - 1, currentWordIndex + 1) / PAGE_WORD_COUNT));
  };

  // Book view page navigation
  const goToPrevPage = () => {
    setReading(false);
    clearReaderInterval();
    setCurrentPage((p) => Math.max(0, p - 1));
    // update currentWordIndex to first word of page
    setCurrentWordIndex((_) => Math.max(0, (Math.max(0, currentPage - 1)) * PAGE_WORD_COUNT));
  };

  const goToNextPage = () => {
    setReading(false);
    clearReaderInterval();
    setCurrentPage((p) => Math.min(pages.length - 1, p + 1));
    setCurrentWordIndex((_) => Math.min(allWords.length - 1, Math.min(pages.length - 1, currentPage + 1) * PAGE_WORD_COUNT));
  };

  // Render page text with first letter bolded per word
  const renderBoldFirstLetter = (pageWords = []) => {
    return pageWords.map((w, i) => {
      const first = w.charAt(0);
      const rest = w.slice(1);
      return (
        <span key={i} style={{ marginRight: 6 }}>
          <strong>{first}</strong>{rest}
          {" "}
        </span>
      );
    });
  };

  // When mode changes, ensure reading state/interval adjusted
  useEffect(() => {
    setReading(false);
    clearReaderInterval();
  }, [mode]);

  // When currentPage changes, set currentWordIndex to page start (book view expectation)
  useEffect(() => {
    if (mode === "book" && pages.length > 0) {
      const idx = Math.min(pages.length - 1, Math.max(0, currentPage));
      setCurrentWordIndex(idx * PAGE_WORD_COUNT);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, mode]);

  return (
    <div className="dashboard-root">
      <h1>📚 QuickRead — Book View | Speed Reader</h1>

      <div className="upload-row">
        <input type="file" accept="application/pdf" onChange={handleFileUpload} />
        {loading && <span className="loading-text"> Extracting PDF... ⏳</span>}
      </div>

      {!!pages.length ? (
        <div className="modes-wrapper">
          {/* Mode tabs */}
          <div className="mode-tabs">
            <button className={mode === "book" ? "tab active" : "tab"} onClick={() => setMode("book")}>
              📘 Book View
            </button>
            <button className={mode === "speed" ? "tab active" : "tab"} onClick={() => setMode("speed")}>
              ⚡ Speed Reader
            </button>
          </div>

          {/* Content area */}
          <div className="content-area">
            {mode === "book" ? (
              <>
                <div className="book-header">
                  <div>Page {currentPage + 1} / {pages.length}</div>
                  <div className="book-controls">
                    <button onClick={goToPrevPage} disabled={currentPage <= 0}>⬅ Prev Page</button>
                    <button onClick={() => { setMode("speed"); /* go to corresponding speed reader word */ setCurrentWordIndex(currentPage * PAGE_WORD_COUNT); }}>Switch to Speed Reader</button>
                    <button onClick={goToNextPage} disabled={currentPage >= pages.length - 1}>Next Page ➡</button>
                  </div>
                </div>

                <div className="book-view-area">
                  {renderBoldFirstLetter(pages[currentPage])}
                </div>
              </>
            ) : (
              <>
                <div className="speed-header">
                  <div>Word {currentWordIndex + 1} / {allWords.length}</div>
                  <div className="speed-controls">
                    <label>WPM: </label>
                    <input
                      type="number"
                      min={50}
                      max={2000}
                      value={wpm}
                      onChange={(e) => setWpm(Math.max(1, Number(e.target.value) || 300))}
                      style={{ width: 90 }}
                    />
                  </div>
                </div>

                <div className="speed-reader-area">
                  <div className="big-word">
                    {allWords[currentWordIndex] || ""}
                  </div>
                </div>

                <div className="speed-buttons">
                  <button onClick={() => { setMode("book"); }}>Back to Book View</button>

                  <button onClick={jumpPrevWord} disabled={currentWordIndex <= 0}>⬅ Prev Word</button>

                  <button onClick={toggleReading} disabled={!allWords.length}>
                    {reading ? "Pause ⏸" : "Start ▶️"}
                  </button>

                  <button onClick={jumpNextWord} disabled={currentWordIndex >= allWords.length - 1}>Next ➡</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="placeholder">
          <p>Upload a PDF to begin. Pages will be split at {PAGE_WORD_COUNT} words per page and reading will start from Preface / Introduction if present.</p>
        </div>
      )}
    </div>
  );
}
