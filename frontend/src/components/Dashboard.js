import { useState, useEffect } from "react";
import './Dashboard.css';
import BookView from './BookView';
import ChapterSidebar from './ChapterSidebar';
import SummaryPanel from './SummaryPanel';
import VisualMindmap3D from './VisualMindmap3D';
import { parseChapters, summariseText, buildChapterGraph, tokenizeWords } from '../utils/parseText';
import { apiEndpoints } from '../utils/api';

export default function Dashboard() {
  const [text, setText] = useState("");
  const [words, setWords] = useState([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [wpm, setWpm] = useState(200);
  const [isReading, setIsReading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [processingTime, setProcessingTime] = useState(0);
  const [processingStartTime, setProcessingStartTime] = useState(null);
  const [estimatedTime, setEstimatedTime] = useState(30); // Default 30 seconds estimate
  const [remainingTime, setRemainingTime] = useState(30);
  const [viewMode, setViewMode] = useState('speed'); // 'speed' | 'book'

  // New state for chapters, summary, mindmap
  const [chapters, setChapters] = useState([]);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [summary, setSummary] = useState('');
  const [generatingSummary, setGeneratingSummary] = useState(false);
  const [graphData, setGraphData] = useState(null);
  const [bookScrollTarget, setBookScrollTarget] = useState(null);

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file');
      return;
    }

    setIsLoading(true);
    setRemainingTime(estimatedTime); // Reset countdown
    const formData = new FormData();
    formData.append('file', file);

    // Start the countdown timer
    const timer = setInterval(() => {
      setRemainingTime((prev) => {
        if (prev <= 0) return 0;
        return prev - 0.1;
      });
    }, 100);

    try {
      const response = await fetch(apiEndpoints.upload, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to process PDF');
      }

      const data = await response.json();
      setText(data.text);
      const split = data.text.split(/\s+/);
      setWords(split);
      setCurrentWordIndex(0);

      // Parse chapters
      const parsed = parseChapters(data.text);
      setChapters(parsed.chapters);
      setActiveChapterIdx(0);
      setSummary('');
    } catch (error) {
      console.error('Error processing PDF:', error);
      alert('Error processing PDF file');
    } finally {
      clearInterval(timer);
      setRemainingTime(estimatedTime);
      setIsLoading(false);
    }
  };

  const startReading = () => {
    if (words.length === 0) return;
    setIsReading(true);
    setIsPaused(false);
  };

  const pauseReading = () => {
    setIsPaused(!isPaused);
  };

  // Move through words when reading
  useEffect(() => {
    let interval;
    if (isReading && !isPaused && words.length > 0) {
      interval = setInterval(() => {
        setCurrentWordIndex((prev) => {
          if (prev >= words.length - 1) {
            clearInterval(interval);
            setIsReading(false);
            return prev;
          }
          return prev + 1;
        });
      }, (60 / wpm) * 1000);
    }
    return () => clearInterval(interval);
  }, [isReading, isPaused, words, wpm]);

  // Update active chapter based on current word index
  useEffect(() => {
    if (!chapters.length) return;
    let idx = 0;
    for (let i = 0; i < chapters.length; i++) {
      const start = chapters[i].startWordIndex;
      const nextStart = chapters[i + 1]?.startWordIndex ?? Number.MAX_SAFE_INTEGER;
      if (currentWordIndex >= start && currentWordIndex < nextStart) { idx = i; break; }
    }
    setActiveChapterIdx(idx);
  }, [currentWordIndex, chapters]);

  // Build graph for current chapter
  useEffect(() => {
    if (!text || !chapters.length) { setGraphData(null); return; }
    const start = chapters[activeChapterIdx]?.startWordIndex ?? 0;
    const end = chapters[activeChapterIdx + 1]?.startWordIndex ?? words.length;
    const slice = words.slice(start, end).join(' ');
    setGraphData(buildChapterGraph(slice, 0, null, 12));
  }, [text, words, chapters, activeChapterIdx]);

  const handleSelectChapter = (idx) => {
    if (!chapters[idx]) return;
    const start = chapters[idx].startWordIndex;
    setActiveChapterIdx(idx);
    setCurrentWordIndex(start);
    if (viewMode === 'book') {
      setBookScrollTarget(start);
    }
  };

  const handleGenerateSummary = () => {
    if (!text || !chapters.length) return;
    setGeneratingSummary(true);
    setTimeout(() => {
      try {
        const start = chapters[activeChapterIdx]?.startWordIndex ?? 0;
        const end = chapters[activeChapterIdx + 1]?.startWordIndex ?? words.length;
        const slice = words.slice(start, end).join(' ');
        const s = summariseText(slice, 8);
        setSummary(s);
      } finally {
        setGeneratingSummary(false);
      }
    }, 50);
  };

  return (
    <div className="container">
      <h1>Speed Reader</h1>

      <div className="controls">
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileUpload} 
          disabled={isLoading}
        />
        
        {isLoading && (
          <div className="processing-timer">
            Processing PDF... {Math.max(0, remainingTime).toFixed(1)}s remaining
          </div>
        )}
        
        <div className="speed-control">
          <label>Reading Speed (WPM): </label>
          <input 
            type="number" 
            value={wpm} 
            onChange={(e) => setWpm(Number(e.target.value))} 
            min="50" 
            max="1000" 
          />
        </div>
        
        <div className="button-group">
          <button 
            onClick={startReading} 
            disabled={words.length === 0 || (isReading && !isPaused) || isLoading}
          >
            {isLoading ? "Processing PDF..." : 
             isReading && !isPaused ? "Reading..." : 
             isPaused ? "Resume" : "Start Reading"}
          </button>
          
          {isReading && (
              <button 
                  onClick={pauseReading}
                  className="pause-button"
              >
                  {isPaused ? "Resume" : "Pause"}
              </button>
          )}

          <button
            onClick={() => setViewMode(viewMode === 'speed' ? 'book' : 'speed')}
          >
            {viewMode === 'speed' ? 'Switch to Book View' : 'Switch to Speed View'}
          </button>
        </div>
      </div>

      <div className="main-grid">
        <div className="left-panel">
          <ChapterSidebar
            chapters={chapters}
            activeIndex={activeChapterIdx}
            onSelect={handleSelectChapter}
            disabled={words.length === 0}
          />
        </div>

        <div className="center-panel">
          <div className="word-display">
            {words.length > 0 && (
              <div className="word-container">
                {viewMode === 'speed' ? (
                  <>
                    <h2>{words[currentWordIndex]}</h2>
                    <div className="progress-container">
                        <div className="progress-bar">
                            <div 
                                className="progress" 
                                style={{
                                    width: `${(currentWordIndex / (words.length - 1)) * 100}%`,
                                    transition: 'width 0.3s ease-in-out'
                                }}
                            />
                        </div>
                        <span className="progress-percentage">
                            {Math.min(100, Math.round((currentWordIndex / (words.length - 1)) * 100))}%
                        </span>
                    </div>
                  </>
                ) : (
                  <BookView text={text} scrollToWordIndex={bookScrollTarget} />
                )}
              </div>
            )}
          </div>
        </div>

        <div className="right-panel">
          <SummaryPanel summary={summary} onGenerate={handleGenerateSummary} generating={generatingSummary} />
          {graphData && <VisualMindmap3D graph={graphData} />}
        </div>
      </div>
    </div>
  );
}