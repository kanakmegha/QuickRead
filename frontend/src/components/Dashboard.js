import React, { useState, useEffect, useRef, useMemo } from "react";
import { supabase_admin } from "../database"; 
import "../App.css";

const PAGE_WORD_COUNT = 200;

export default function Dashboard() {
  const [rawSentences, setRawSentences] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [mode, setMode] = useState("book");
  const [reading, setReading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [wpm, setWpm] = useState(300);
  const intervalRef = useRef(null);

  const backendUrl = "https://quickread-bggq.onrender.com";

  const clearReaderInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Restored Visual Logic: Processes text for the Reader and Book View
  const { allWords, pages } = useMemo(() => {
    if (rawSentences.length === 0) return { allWords: [], pages: [] };

    const fullText = rawSentences.join(" ");
    const lower = fullText.toLowerCase();
    const prefaceMatch = lower.match(/preface|introduction/);
    const startFrom = prefaceMatch ? lower.indexOf(prefaceMatch[0]) : 0;

    const cleaned = fullText.slice(startFrom).replace(/[^\w\s’'`-]/g, " ");
    const words = cleaned.split(/\s+/).filter(Boolean);

    const newPages = [];
    for (let i = 0; i < words.length; i += PAGE_WORD_COUNT) {
      newPages.push(words.slice(i, i + PAGE_WORD_COUNT));
    }

    return { allWords: words, pages: newPages };
  }, [rawSentences]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setRawSentences([]);
    setCurrentPage(0);
    setCurrentWordIndex(0);
    setReading(false);
    clearReaderInterval();

    try {
      // 1. Direct Upload to Supabase (Workday Method)
      const filePath = `uploads/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase_admin
        .storage
        .from("Books")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // 2. Get the Public URL
      const { data: { publicUrl } } = supabase_admin
        .storage
        .from("Books")
        .getPublicUrl(filePath);

      // 3. Send URL to Render Backend
      const response = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          file_url: publicUrl,
          file_name: file.name
        }),
      });

      if (!response.ok) throw new Error("Server error");

      // 4. Streaming Text Extraction (Visual Update as it loads)
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialChunk = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialChunk + chunk).split("\n");
        partialChunk = lines.pop();

        const pageTexts = lines
          .filter(l => l.trim())
          .map(l => {
            try { return JSON.parse(l).text; } 
            catch(e) { return null; }
          })
          .filter(t => t !== null);

        if (pageTexts.length > 0) {
          setRawSentences(prev => [...prev, ...pageTexts]);
        }
      }
    } catch (err) {
      console.error("Upload error:", err);
      alert("Extraction failed. Check connection or Supabase settings.");
    } finally {
      setLoading(false);
    }
  };

  // Speed Reader Movement Logic
  useEffect(() => {
    if (mode === "speed" && reading && allWords.length > 0) {
      clearReaderInterval();
      const ms = Math.max(10, Math.round(60000 / Math.max(1, wpm)));
      intervalRef.current = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= allWords.length - 1) {
            clearReaderInterval();
            setReading(false);
            return prev;
          }
          const next = prev + 1;
          const nextPage = Math.floor(next / PAGE_WORD_COUNT);
          if (nextPage !== currentPage) setCurrentPage(nextPage);
          return next;
        });
      }, ms);
    } else {
      clearReaderInterval();
    }
    return () => clearReaderInterval();
  }, [reading, wpm, mode, allWords.length, currentPage]);

  // Visual: Bold First Letter logic for Book View
  const renderBoldFirstLetter = (pageWords = []) => {
    return pageWords.map((w, i) => (
      <span key={i} style={{ marginRight: 6 }}>
        <strong>{w.charAt(0)}</strong>{w.slice(1)}{" "}
      </span>
    ));
  };

  return (
    <div className="dashboard-root">
      <h1>📚 QuickRead — Book View | Speed Reader</h1>
      
      <div className="upload-row">
        <input type="file" accept="application/pdf" onChange={handleFileUpload} />
        {loading && <span className="loading-text"> Extracting PDF ({rawSentences.length} pages)... ⏳</span>}
      </div>

      {pages.length > 0 ? (
        <div className="modes-wrapper">
          <div className="mode-tabs">
            <button className={mode === "book" ? "tab active" : "tab"} onClick={() => setMode("book")}>📘 Book View</button>
            <button className={mode === "speed" ? "tab active" : "tab"} onClick={() => setMode("speed")}>⚡ Speed Reader</button>
          </div>

          <div className="content-area">
            {mode === "book" ? (
              <>
                <div className="book-header">
                  <div>Page {currentPage + 1} / {pages.length}</div>
                  <div className="book-controls">
                    <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage <= 0}>⬅ Prev</button>
                    <button onClick={() => setMode("speed")}>Speed Mode</button>
                    <button onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage >= pages.length - 1}>Next ➡</button>
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
                    <input type="number" value={wpm} onChange={(e) => setWpm(Math.max(1, Number(e.target.value)))} style={{ width: 80 }} />
                  </div>
                </div>
                <div className="speed-reader-area">
                  <div className="big-word">{allWords[currentWordIndex] || ""}</div>
                </div>
                <div className="speed-buttons">
                  <button onClick={() => setMode("book")}>Back to Book</button>
                  <button onClick={() => setCurrentWordIndex(i => Math.max(0, i - 1))}>⬅ Prev</button>
                  <button onClick={() => setReading(!reading)}>{reading ? "Pause ⏸" : "Start ▶️"}</button>
                  <button onClick={() => setCurrentWordIndex(i => Math.min(allWords.length - 1, i + 1))}>Next ➡</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="placeholder">
          <p>Upload a PDF to begin. {PAGE_WORD_COUNT} words per page.</p>
        </div>
      )}
    </div>
  );
}