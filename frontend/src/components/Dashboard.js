import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import "../App.css";

const PAGE_WORD_COUNT = 200;

export default function Dashboard() {
  // Only store the RAW data in state to save memory
  const [rawSentences, setRawSentences] = useState([]); 
  const [currentPage, setCurrentPage] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [mode, setMode] = useState("book");
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wpm, setWpm] = useState(300);
  const intervalRef = useRef(null);

  const backendUrl = "https://quickread-bggq.onrender.com";

  const clearReaderInterval = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  // --- OPTIMIZED DATA PROCESSING (useMemo) ---
  // This calculates words/pages ONLY when rawSentences changes.
  // It prevents the browser from re-calculating on every UI toggle.
  const { allWords, pages } = useMemo(() => {
    if (!rawSentences || rawSentences.length === 0) return { allWords: [], pages: [] };

    // 1. Normalize
    const sentenceTexts = rawSentences.map(s => {
      if (typeof s === "string") return s;
      if (typeof s === "object") return s.sentence || Object.values(s).find(v => typeof v === "string") || "";
      return String(s);
    });

    const fullText = sentenceTexts.join(" ");

    // 2. Preface Detection
    const lower = fullText.toLowerCase();
    const prefaceMatch = lower.match(/preface|introduction/);
    const startFrom = prefaceMatch ? lower.indexOf(prefaceMatch[0]) : 0;

    // 3. Clean & Tokenize (Memory Efficient)
    const cleaned = fullText.slice(startFrom).replace(/[^\w\s’'`-]/g, " ");
    const words = cleaned.split(/\s+/).filter(Boolean);

    // 4. Paginate
    const p = [];
    for (let i = 0; i < words.length; i += PAGE_WORD_COUNT) {
      p.push(words.slice(i, i + PAGE_WORD_COUNT));
    }

    return { allWords: words, pages: p };
  }, [rawSentences]);

  // --- FILE UPLOAD (Crash-Proofed) ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // PREVENT CRASH: Clear old data immediately to free RAM
    setLoading(true);
    setReading(false);
    clearReaderInterval();
    setRawSentences([]); // Triggers cleanup of allWords/pages
    setCurrentPage(0);
    setCurrentWordIndex(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Upload failed: ${res.status}`);

      const data = await res.json();
      
      // Support various backend formats
      if (Array.isArray(data.pages)) {
        setRawSentences(data.pages);
      } else if (Array.isArray(data.sentences)) {
        setRawSentences(data.sentences);
      } else if (data.text) {
        setRawSentences([data.text]);
      }
    } catch (err) {
      console.error("❌ Error:", err);
      alert("Extraction failed. The file may be too large for the current server limits.");
    } finally {
      setLoading(false);
    }
  };

  // --- SPEED READER ENGINE ---
  useEffect(() => {
    if (mode === "speed" && reading && allWords.length > 0) {
      const ms = Math.max(15, Math.round(60000 / wpm));
      intervalRef.current = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= allWords.length - 1) {
            setReading(false);
            return prev;
          }
          const next = prev + 1;
          // Sync page index with word index
          const nextPage = Math.floor(next / PAGE_WORD_COUNT);
          if (nextPage !== currentPage) setCurrentPage(nextPage);
          return next;
        });
      }, ms);
    } else {
      clearReaderInterval();
    }
    return () => clearReaderInterval();
  }, [reading, wpm, mode, allWords.length, currentPage, clearReaderInterval]);

  // --- HELPERS ---
  const renderPage = useCallback((pageWords = []) => {
    return pageWords.map((w, i) => (
      <span key={i} style={{ marginRight: 6 }}>
        <strong>{w.charAt(0)}</strong>{w.slice(1)}{" "}
      </span>
    ));
  }, []);

  return (
    <div className="dashboard-root">
      <h1>📚 QuickRead</h1>

      <div className="upload-row">
        <input type="file" accept="application/pdf" onChange={handleFileUpload} />
        {loading && <span className="loading-text"> Processing Large Document... ⏳</span>}
      </div>

      {pages.length > 0 && (
        <div className="modes-wrapper">
          <div className="mode-tabs">
            <button className={mode === "book" ? "active" : ""} onClick={() => setMode("book")}>📘 Book View</button>
            <button className={mode === "speed" ? "active" : ""} onClick={() => setMode("speed")}>⚡ Speed Reader</button>
          </div>

          <div className="content-area">
            {mode === "book" ? (
              <div className="book-container">
                <div className="book-header">
                  <span>Page {currentPage + 1} of {pages.length}</span>
                  <div className="btn-group">
                    <button disabled={currentPage === 0} onClick={() => {
                        const newPage = currentPage - 1;
                        setCurrentPage(newPage);
                        setCurrentWordIndex(newPage * PAGE_WORD_COUNT);
                    }}>Prev</button>
                    <button disabled={currentPage >= pages.length - 1} onClick={() => {
                        const newPage = currentPage + 1;
                        setCurrentPage(newPage);
                        setCurrentWordIndex(newPage * PAGE_WORD_COUNT);
                    }}>Next</button>
                  </div>
                </div>
                <div className="book-view-area">{renderPage(pages[currentPage])}</div>
              </div>
            ) : (
              <div className="speed-container">
                <div className="big-word-display">
                  <div className="focus-word">{allWords[currentWordIndex]}</div>
                </div>
                <div className="speed-controls">
                    <input type="number" value={wpm} onChange={(e) => setWpm(e.target.value)} />
                    <button onClick={() => setReading(!reading)}>{reading ? "Pause" : "Start"}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}