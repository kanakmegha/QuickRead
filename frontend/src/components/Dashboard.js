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

  const clearReaderInterval = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // Logic: Efficient Word/Page calculation remains same
  const { allWords, pages } = useMemo(() => {
    if (rawSentences.length === 0) return { allWords: [], pages: [] };
    const words = rawSentences.join(" ").split(/\s+/).filter(Boolean);
    const newPages = [];
    for (let i = 0; i < words.length; i += PAGE_WORD_COUNT) {
      newPages.push(words.slice(i, i + PAGE_WORD_COUNT));
    }
    return { allWords: words, pages: newPages };
  }, [rawSentences]);

  // NEW MOBILE-FRIENDLY LOGIC: Recursive Batch Fetching
  const fetchBatch = async (path, startPage) => {
    try {
      const response = await fetch(`${backendUrl}/extract_batch?path=${path}&start_page=${startPage}`);
      const data = await response.json();
      
      setRawSentences(prev => [...prev, ...data.pages]);

      if (data.next_start !== null) {
        // Fetch next 5 pages
        fetchBatch(path, data.next_start);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      alert("Mobile connection blipped. Some pages might be missing.");
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setRawSentences([]);
    
    const formData = new FormData();
    formData.append("file", file);

    try {
      // 1. Quick Upload
      const res = await fetch(`${backendUrl}/upload_to_storage`, { method: "POST", body: formData });
      const { storage_path } = await res.json();
      
      // 2. Start Batch Extraction
      fetchBatch(storage_path, 0);
    } catch (err) {
      setLoading(false);
      alert("Upload failed. Check your internet.");
    }
  };

  // ... (Keep your existing useEffect for interval and renderBoldFirstLetter) ...
  useEffect(() => {
    if (mode === "speed" && reading && allWords.length > 0) {
      clearReaderInterval();
      const ms = Math.max(10, Math.round(60000 / Math.max(1, wpm)));
      intervalRef.current = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= allWords.length - 1) { clearReaderInterval(); setReading(false); return prev; }
          const next = prev + 1;
          const nextPage = Math.floor(next / PAGE_WORD_COUNT);
          if (nextPage !== currentPage) setCurrentPage(nextPage);
          return next;
        });
      }, ms);
    } else { clearReaderInterval(); }
    return () => clearReaderInterval();
  }, [reading, wpm, mode, allWords.length, currentPage]);

  const renderBoldFirstLetter = (pageWords = []) => {
    return pageWords.map((w, i) => (
      <span key={i} style={{ marginRight: 6 }}>
        <strong>{w.charAt(0)}</strong>{w.slice(1)}{" "}
      </span>
    ));
  };

  return (
    <div className="dashboard-root">
      <h1>📚 QuickRead</h1>
      <div className="upload-row">
        <input type="file" accept="application/pdf" onChange={handleFileUpload} />
        {loading && <span className="loading-text"> Loading ({rawSentences.length} pages loaded)...</span>}
      </div>

      {!!pages.length ? (
        <div className="modes-wrapper">
          <div className="mode-tabs">
            <button className={mode === "book" ? "tab active" : "tab"} onClick={() => setMode("book")}>📘 Book</button>
            <button className={mode === "speed" ? "tab active" : "tab"} onClick={() => setMode("speed")}>⚡ Speed</button>
          </div>
          <div className="content-area">
            {mode === "book" ? (
              <div className="book-view-area">
                 <div className="book-header">Page {currentPage + 1} / {pages.length}</div>
                 {renderBoldFirstLetter(pages[currentPage])}
                 <div className="book-controls">
                    <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))}>Prev</button>
                    <button onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))}>Next</button>
                 </div>
              </div>
            ) : (
              <div className="speed-reader-area">
                <div className="big-word">{allWords[currentWordIndex] || ""}</div>
                <button onClick={() => setReading(!reading)}>{reading ? "Pause" : "Start"}</button>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}