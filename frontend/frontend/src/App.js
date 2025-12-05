/* import logo from './logo.svg';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.js</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
 */
import { useState } from "react";
import "./App.css";

function App() {
  const [sentences, setSentences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const uploadPDF = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setLoading(true);
    setError("");
    setSentences([]);



    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("https://quickread-bggq.onrender.com/upload", {
      method: "POST",
      body: formData
    });

    if (!response.ok) throw new Error("Failed to process PDF");

    const data = await response.json();
    console.log(data.text);


      

      if (!data.sentences || !Array.isArray(data.sentences)) {
        throw new Error("Invalid response format");
      }

      setSentences(data.sentences.map(item => item.sentence));
    
    
  };

  return (
    <div className="App">
      <h2>QuickRead 📄 → ✨</h2>
      <input type="file" accept="application/pdf" onChange={uploadPDF} />

      {loading && <p>Processing PDF... ⏳</p>}
      {error && <p style={{ color: "red" }}>{error}</p>}

      <div style={{ marginTop: 20 }}>
        {sentences.map((sentence, index) => (
          <p key={index}>• {sentence}</p>
        ))}
      </div>
    </div>
  );
}

export default App;
