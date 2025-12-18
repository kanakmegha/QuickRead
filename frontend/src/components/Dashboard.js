import React, { useState, useEffect, useRef, useMemo } from "react";
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

  // --- MEMORY OPTIMIZED DATA CALCULATION ---
  const { allWords, pages } = useMemo(() => {
    if (rawSentences.length === 0) return { allWords: [], pages: [] };

    const fullText = rawSentences.join(" ");
    const lower = fullText.toLowerCase();
    const prefaceMatch = lower.match(/preface|introduction/);
    const startFrom = prefaceMatch ? lower.indexOf(prefaceMatch[0]) : 0;

    const cleaned = fullText.slice(startFrom).replace(/[^\w\s’'`-]/g, " ");
    const words = cleaned.split(/\s+/).filter(Boolean);

    const p = [];
    for (let i = 0; i < words.length; i += PAGE_WORD_COUNT) {
      p.push(words.slice(i, i + PAGE_WORD_COUNT));
    }
    return { allWords: words, pages: p };
  }, [rawSentences]);

  // --- STREAMING UPLOAD HANDLER ---
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setRawSentences([]); 
    setCurrentPage(0);
    setCurrentWordIndex(0);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch(`${backendUrl}/upload`, {
          method: "POST",
          body: formData,
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let partialChunk = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = (partialChunk + chunk).split("\n");
        partialChunk = lines.pop(); 

        const extractedTexts = lines
          .filter(l => l.trim())
          .map(l => {
            try { return JSON.parse(l).text; } 
            catch(e) { return ""; }
          });

        if (extractedTexts.length > 0) {
          setRawSentences(prev => [...prev, ...extractedTexts]);
        }
      }
    } catch (err) {
      console.error("Stream failed", err);
    } finally {
      setLoading(false);
    }
  };

  // --- SPEED READER ENGINE ---
  useEffect(() => {
    if (mode === "speed" && reading && allWords.length > 0) {
      const ms = Math.max(10, Math.round(60000 / wpm));
      intervalRef.current = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= allWords.length - 1) {
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
      if (intervalRef.current) clearInterval(intervalRef.current);
    }

    // FIXED CLEANUP SYNTAX
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [reading, wpm, mode, allWords.length, currentPage]);

  const renderPage = (pageWords = []) => {
    return pageWords.map((w, i) => (
      <span key={i} style={{ marginRight: 6 }}>
        <strong>{w.charAt(0)}</strong>{w.slice(1)} 
      </span>
    ));
  };

  return (
    <div className="dashboard-root">
      <h1>📚 QuickRead</h1>
      <div className="upload-row">
        <input type="file" accept="application/pdf" onChange={handleFileUpload} />
        {loading && <span> 🔄 Loading: {rawSentences.length} pages processed...</span>}
      </div>

      {pages.length > 0 && (
        <div className="content-area">
          <div className="mode-tabs">
            <button onClick={() => setMode("book")} className={mode === "book" ? "active" : ""}>Book View</button>
            <button onClick={() => setMode("speed")} className={mode === "speed" ? "active" : ""}>Speed Reader</button>
          </div>

          {mode === "book" ? (
            <div className="book-view">
              <div className="controls">
                <button onClick={() => setCurrentPage(p => Math.max(0, p-1))}>Prev</button>
                <span>Page {currentPage + 1} of {pages.length}</span>
                <button onClick={() => setCurrentPage(p => Math.min(pages.length-1, p+1))}>Next</button>
              </div>
              <div className="text-display">{renderPage(pages[currentPage])}</div>
            </div>
          ) : (
            <div className="speed-view">
              <div className="word-display" style={{fontSize: '3rem', textAlign: 'center', margin: '40px 0'}}>
                {allWords[currentWordIndex]}
              </div>
              <div className="speed-controls" style={{textAlign: 'center'}}>
                <button onClick={() => setReading(!reading)}>{reading ? "Pause" : "Start"}</button>
                <input type="number" value={wpm} onChange={(e) => setWpm(e.target.value)} style={{width: '80px', marginLeft: '10px'}} />
                <span> WPM</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}