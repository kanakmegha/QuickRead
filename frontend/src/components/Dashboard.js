import React, { useState, useEffect, useRef, useMemo } from "react";
import "../App.css";
import API_BASE_URL from "../utils/api";

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

  const backendUrl = API_BASE_URL;

  const clearReaderInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const { allWords, pages } = useMemo(() => {
    if (rawSentences.length === 0) return { allWords: [], pages: [] };
    console.log(`Recalculating words for ${rawSentences.length} pages...`);
    
    const fullText = rawSentences.join(" ");
    const lower = fullText.slice(0, 5000).toLowerCase(); 
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

    const formData = new FormData();
    formData.append("file", file);

    try {
      console.log('Sending upload request to:', `${backendUrl}/upload`);
      const uploadResponse = await fetch(`${backendUrl}/upload`, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed: ${uploadResponse.status}`);
      }

      const { filename } = await uploadResponse.json();
      console.log('Upload successful, starting polling for:', filename);

      // Polling logic
      let isReady = false;
      let attempts = 0;
      const MAX_ATTEMPTS = 60; // 60 seconds approximately

      while (!isReady && attempts < MAX_ATTEMPTS) {
        attempts++;
        const statusResponse = await fetch(`${backendUrl}/status/${filename}`);
        const { status } = await statusResponse.json();

        if (status === "ready") {
          isReady = true;
          break;
        } else if (status === "error") {
          throw new Error("Backend extraction failed.");
        }

        console.log(`Polling attempt ${attempts}: still processing...`);
        await new Promise(r => setTimeout(r, 2000)); // Poll every 2 seconds
      }

      if (!isReady) {
        throw new Error("Extraction timed out. It might be a very large file, check back later.");
      }

      // Fetch result
      console.log('Extraction ready, fetching result...');
      const resultResponse = await fetch(`${backendUrl}/result/${filename}`);
      const data = await resultResponse.json();

      if (data.pages && data.pages.length > 0) {
        setRawSentences(data.pages);
      } else {
        throw new Error("Extracted data is empty.");
      }

    } catch (err) {
      console.error("Critical failure:", err);
      alert(`Error: ${err.message}. Please check the console for details.`);
    } finally {
      setLoading(false);
    }
  };

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

      {!!pages.length ? (
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
                    <button onClick={() => setCurrentPage(p => Math.max(0, p - 1))} disabled={currentPage <= 0}>⬅ Prev Page</button>
                    <button onClick={() => setMode("speed")}>Switch to Speed Reader</button>
                    <button onClick={() => setCurrentPage(p => Math.min(pages.length - 1, p + 1))} disabled={currentPage >= pages.length - 1}>Next Page ➡</button>
                  </div>
                </div>
                <div className="book-view-area">{renderBoldFirstLetter(pages[currentPage])}</div>
              </>
            ) : (
              <>
                <div className="speed-header">
                  <div>Word {currentWordIndex + 1} / {allWords.length}</div>
                  <div className="speed-controls">
                    <label>WPM: </label>
                    <input type="number" value={wpm} onChange={(e) => setWpm(Math.max(1, Number(e.target.value)))} style={{ width: 90 }} />
                  </div>
                </div>
                <div className="speed-reader-area"><div className="big-word">{allWords[currentWordIndex] || ""}</div></div>
                <div className="speed-buttons">
                  <button onClick={() => setMode("book")}>Back to Book View</button>
                  <button onClick={() => setCurrentWordIndex(i => Math.max(0, i - 1))}>⬅ Prev Word</button>
                  <button onClick={() => setReading(!reading)}>{reading ? "Pause ⏸" : "Start ▶️"}</button>
                  <button onClick={() => setCurrentWordIndex(i => Math.min(allWords.length - 1, i + 1))}>Next ➡</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="placeholder"><p>Upload a PDF to begin. {PAGE_WORD_COUNT} words per page.</p></div>
      )}
    </div>
  );
}