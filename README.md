# 📖 QuickRead: AI-Powered Speed Reader

QuickRead is a high-performance web application designed to help you consume PDF content faster. It streams text from your documents page-by-page, allowing for near-instant reading without waiting for long processing times.

---

## 🚀 For Users
### What does this do?
If you have a long PDF (like a book or a report), QuickRead extracts the text and presents it in a clean, distraction-free interface optimized for speed reading.

### How to use:
1. **Visit the App:** [https://quick-read-five.vercel.app/](https://quick-read-five.vercel.app/)
2. **Sign Up:** Create a free account using your email.
3. **Upload:** Select your PDF file.
4. **Read:** Text appears page-by-page. Start reading page 1 while the rest loads!

---

## 🛠 For Developers
This is a Full-Stack application using a decoupled architecture to maximize performance on free-tier hosting.

### The Tech Stack
* **Frontend:** React.js (Vercel)
* **Backend:** FastAPI / Python (Render)
* **Auth & Database:** Supabase (PostgreSQL + GoTrue)
* **PDF Engine:** PyMuPDF (fitz)

### Architecture
The app uses **Server-Sent Events (SSE)** to stream PDF data. Instead of waiting for a 100-page PDF to process, the backend sends each page as a JSON chunk as soon as it is parsed.



### Installation & Local Development

#### 1. Backend Setup
```bash
# Navigate to backend folder
cd backend

# Install dependencies
pip install -r requirements.txt

# Run the server
uvicorn main:app --reload

## Running with Docker (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/yourusername/QuickRead.git
cd QuickRead
```


Create a .env file in the frontend directory:
cd frontend
cp .env.example .env


Build and start the Docker containers:
cd ..  # Return to root directory
docker-compose up --build


Access the application:

Frontend: Open your browser and visit http://localhost
Backend API: Available at http://localhost:8000 for local and deployed in  https://quickread-bggq.onrender.com


To stop the application:
docker-compose down



