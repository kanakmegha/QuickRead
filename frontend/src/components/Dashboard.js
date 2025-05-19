import { useState, useEffect } from "react";
import './Dashboard.css';

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
      const response = await fetch('http://localhost:5001/upload', {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        throw new Error('Failed to process PDF');
      }

      const data = await response.json();
      setText(data.text);
      setWords(data.text.split(/\s+/));
      setCurrentWordIndex(0);
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
        </div>
      </div>

      <div className="word-display">
        {words.length > 0 && (
          <div className="word-container">
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
        </div>
        )}
      </div>
    </div>
  );
}