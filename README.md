# QuickRead
A modern speed reading application that helps users improve their reading speed and comprehension. The application displays text content word by word at adjustable speeds, allowing users to practice and enhance their reading capabilities.

## Features

- Upload and process text files for speed reading
- Adjustable reading speed control
- Progress tracking
- Modern, dark-themed UI with smooth animations
- Pause/Resume functionality

## Tech Stack

- Frontend: React.js
- Backend: FastAPI (Python)
- Styling: CSS with modern features

## Prerequisites

Before running the application, make sure you have:
- Docker installed on your machine
- Docker Compose installed
- Git installed

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



