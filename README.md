# VidSummarize

VidSummarize is a web application that provides concise summaries of YouTube videos. It extracts key topics, quotes, and insights to help users quickly understand video content without watching the entire video.

## Features

- Extract YouTube video metadata (title, channel, duration, etc.)
- Generate video transcripts using Whisper
- Create AI-powered summaries using Google's Gemini API
- Extract key topics, quotes, and insights
- Clean, modern UI built with React and Tailwind CSS

## Project Structure

The project consists of two main parts:

1. **Frontend**: React application with Tailwind CSS
2. **Backend**: Flask API that handles YouTube video downloading, transcription, and summarization

## Prerequisites

- Node.js and npm
- Python 3.8 or higher
- FFmpeg (for audio extraction)
- YouTube API key (for video metadata)
- Google Gemini API key (for AI summarization)

## Setup Instructions

### Backend Setup

1. Navigate to the server directory:
   ```
   cd server
   ```

2. Create a virtual environment:
   ```
   python -m venv env
   ```

3. Activate the virtual environment:
   - Windows: `env\Scripts\activate`
   - macOS/Linux: `source env/bin/activate`

4. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

5. Create a `.env` file in the server directory and add your Gemini API key:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

6. Run the Flask backend:
   ```
   python app.py
   ```

### Frontend Setup

1. Navigate to the root directory (where package.json is located)

2. Install dependencies:
   ```
   npm install
   ```

3. Open `src/App.jsx` and replace the `API_KEY` variable with your YouTube API key

4. Start the development server:
   ```
   npm run dev
   ```

5. Open your browser and go to `http://localhost:5173`

## Usage

1. Paste a YouTube video URL in the input field
2. Click the "Summarize" button
3. Wait for the application to process the video (this may take a few minutes for longer videos)
4. View the generated summary along with key topics, quotes, and insights

## Technologies Used

- **Frontend**: React, Tailwind CSS, Vite
- **Backend**: Flask, Whisper (OpenAI), Gemini API
- **Tools**: yt-dlp (YouTube video downloader), FFmpeg

## License

MIT 