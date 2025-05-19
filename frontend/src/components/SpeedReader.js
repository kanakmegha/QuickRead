import { useState, useEffect } from "react";

export default function SpeedReader({ text }) {
  const [wpm, setWpm] = useState(200);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [debug, setDebug] = useState(false);
  const words = text ? text.split(/\s+/) : [];

  useEffect(() => {
    let interval;
    if (isPlaying && words.length > 0) {
      interval = setInterval(() => {
        setCurrentIndex((prev) => {
          if (prev + 1 >= words.length) {
            setIsPlaying(false);
            return prev;
          }
          console.log(`[DEBUG] Word: ${words[prev + 1]}, Index: ${prev + 1}`);
          return prev + 1;
        });
      }, 60000 / wpm);
    }
    return () => clearInterval(interval);
  }, [isPlaying, wpm, words]);

  if (!text) return <p>No text available</p>;

  return (
    <div>
      <h2>{words[currentIndex] || "Start Reading"}</h2>
      <input
        type="range"
        min="100"
        max="600"
        value={wpm}
        onChange={(e) => setWpm(Number(e.target.value))}
      />
      <p>WPM: {wpm}</p>
      <button onClick={() => setIsPlaying(!isPlaying)}>
        {isPlaying ? "Pause" : "Play"}
      </button>
      <label>
        <input
          type="checkbox"
          checked={debug}
          onChange={() => setDebug(!debug)}
        />
        Debug Mode
      </label>
      {debug && (
        <div>
          <p>Current Index: {currentIndex}</p>
          <p>Next Word: {words[currentIndex + 1] || "N/A"}</p>
        </div>
      )}
    </div>
  );
}