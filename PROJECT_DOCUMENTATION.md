# Somali Lecture Platform - Application Documentation

This document gives you a complete overview of the application, how its parts fit together, and a step-by-step guide on how to interact with the platform.

## 1. High-Level Architecture
This application is designed to take video lectures (either YouTube links or direct uploads) and generate Somali notes. It's built with two main components:
- **Frontend**: A modern user interface built using Next.js (React). It runs by default on `http://localhost:3000`.
- **Backend**: An API built with FastAPI (Python) that handles the logic, interacts with a SQLite database, and hands off long-running tasks like audio transcription and note generation to a background worker (Celery). It runs on `http://localhost:8000`.

## 2. Where Everything Is (Folder Structure)

### Frontend (`frontend/src/app`)
The frontend uses the Next.js App Router framework. The UI routes are organized into matching URL structures.
- **`/(public)`**: Contains the landing page (`page.tsx`) and public-facing styling (e.g. `landing.css`, `public.css`). Users see this when they are not logged in.
- **`/(user)/dashboard`**: The core application UI once a user is inside the app.
  - **`/my-lectures`**: The dashboard view that displays a list of all processed or processing lectures.
  - **`/new-lecture`**: The form page where a user can enter a video title and either paste a YouTube link or upload a video file.
  - **`/lecture`**: The detailed view for a single lecture where notes and video playback are shown.
- **`/(admin)`**: Reserved for administrative interfaces (e.g., managing users or system settings).

### Backend (`backend/app`)
The backend is neatly structured around domain-driven design principles.
- **`/api/routers`**: Contains `auth.py` (handles user login/signup) and `lectures.py` (receives requests to add or view lectures).
- **`/models`**: Defines the database schemas (e.g., `lecture.py`, `transcript.py`, `note.py`). This dictates how data is stored in the `sql_app.db` SQLite database.
- **`/schemas`**: Pydantic models (`token.py`, etc.) used to validate the data going in and out of the API.
- **`/services`**: The business logic of the app. This is where the heavy lifting occurs:
  - `youtube_service.py`: Downloads audio/video from YouTube links.
  - `media_service.py`: Processes and compresses uploaded local video files.
  - `transcription_service.py`: Converts the audio files into text transcripts.
  - `note_generation_service.py`: Converts the written text transcript into summarized Somali notes.
- **`/jobs`**: The background task pipeline logic (`celery_app.py`, `worker.py`, `pipeline.py`). Instead of making the user wait hours staring at a loading spinner on the webpage, long tasks are sent here so the user can see a "Processing" status and check back later.

## 3. How to Use the App (Step-by-Step User Guide)

Here is a typical workflow on how a user interacts with the application, one page at a time:

### Step 1: Navigating to the App & Logging In
1. Start both servers (`npm run dev` in the frontend and your python server runner in the backend).
2. Open `http://localhost:3000` in your browser.
3. You will land on the public landing page (`/(public)/page.tsx`) showcasing the app features.
4. Proceed to log in or sign up to gain access to the secure dashboard.

### Step 2: The Dashboard (`/dashboard/my-lectures`)
1. Upon logging in, you will be directed to your dashboard view.
2. Here, you will see a list of all your previously submitted lectures, their titles, and their current processing status (e.g., "Processing", "Completed", "Failed").

### Step 3: Submitting a New Lecture (`/dashboard/new-lecture`)
1. Click the "Add New Lecture" button which will navigate you to the `new-lecture` page.
2. **Lecture Title**: Enter a descriptive and recognizable title for the lecture (e.g., "Introduction to Physics").
3. **Source Type**: 
   - **YouTube Link**: Select this if you have a video from YouTube. Provide the full YouTube URL.
   - **Video Upload**: Select this if you have the video file on your computer. Use the file input button to select your video file.
4. **Submit**: Click the "Submit Lecture for Processing" button.
5. The frontend sends this file or link to the FastAPI server (`http://localhost:8000/api/v1/lectures/`). The server saves the lecture in the database, returns a "Success" message to the frontend, and immediately delegates the heavy media processing to the Celery background worker pipelines (`youtube_service` -> `transcription_service` -> `note_generation_service`).

### Step 4: Monitoring Progress & Viewing Notes (`/dashboard/lecture`)
1. After successfully submitting a lecture, you will automatically be redirected back to the `/dashboard/my-lectures` overview suite.
2. Your newly added lecture will appear at the top of your list with a status indicating it is being processed.
3. Once the background jobs finish transcribing the speech and translating/summarizing it into Somali notes, the status will update to Complete.
4. Click on the completed lecture card to enter the `dashboard/lecture` details page.
5. In this detailed view, you can read the formatted Somali notes, view the raw generated transcript, and possibly reference the original video material alongside the notes.

## 4. Understanding Background Tasks (Celery & Redis vs SQLite)

When you submit a video, the server needs to extract audio, run AI transcription, and translate it to Somali notes. If the webpage waited for all this to finish, your browser would "time out" and freeze.

To solve this, we use a tool called **Celery** as a background worker. 
* **The Message Broker (The Middleman)**: Celery doesn't talk directly to FastAPI. It uses a "middleman" to pass messages like "Hey, a new video is ready to be transcribed!" 
* **Redis (Production-Standard)**: Most production servers use an in-memory database called Redis as the middleman because it's insanely fast. On Windows, Redis must be installed using **Docker Desktop** (a container engine) or WSL (Windows Subsystem for Linux).
* **SQLite (Local Development)**: To make it easy to run the app on your local Windows machine without Docker, we swapped the middleman from Redis to **SQLite**. SQLite uses simple local `.sqlite` files, which means Celery can run immediately without needing to install anything extra on your computer.

## 5. Where Is the Database Data?

This application now uses **SQLite** for everything (both the main app data and the background task queues). Because SQLite is file-based, your data isn't hidden inside a background service; it physically sits as files in the `backend` folder.

Here is the data breakdown:
1. **`backend/sql_app.db`**: This is the main application database. It stores the Users, the Lectures (titles, paths), the actual Transcripts, and the final Somali generated Notes.
2. **`backend/celery_broker.sqlite`**: This is where FastAPI writes simple "todo" messages for Celery to pick up.
3. **`backend/celery_backend.sqlite`**: This is where Celery writes the temporary status results ("Pending", "Running", "Failed") so FastAPI can check if a task is done.

### How to Interactive With Your Databases
To view or manually edit the data inside these databases, you don't need a complex server. 
**Option 1 (Using VS Code)**:
   - Go to VS Code Extensions and install **"SQLite Viewer"**.
   - Simply click on `sql_app.db` in your file explorer, and it will open like an Excel sheet right in VS Code!

**Option 2 (Standalone App)**:
   - Download and install **[DB Browser for SQLite](https://sqlitebrowser.org/)**.
   - Open the app, click "Open Database", navigate to your project's `backend` folder, and select `sql_app.db`. From there, you can easily view tables, execute SQL, and modify records.
