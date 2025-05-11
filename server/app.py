import os
import yt_dlp
import whisper
import requests
import warnings
import json
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment 
load_dotenv()

# Initialize flask 
app = Flask(__name__)
CORS(app)  # Enable CROS

# Initialize zero-shot classifier 
classifier = None
try:
    # Use a simplified approach
    print("Initializing custom classifier...")
    
    # Use a direct Gemini classifier instead of transformers
    def simple_classifier(text, candidate_labels):
        # Create a simple zero-shot classification using Gemini
        prompt = f"""
        Classify the following text into exactly one of these categories: {', '.join(candidate_labels)}
        Return ONLY the category name, no additional text or explanation.
        
        Text to classify:
        {text[:2000]}  # Using first 2000 chars for brevity
        """
        result = query_gemini(prompt).strip()
        
        # If result is not in candidate_labels, use the most similar one
        if result not in candidate_labels:
            # Find closest match
            result = difflib.get_close_matches(result, candidate_labels, n=1, cutoff=0.6)
            result = result[0] if result else candidate_labels[0]
            
        # Format response like transformers pipeline
        scores = [0.1] * len(candidate_labels)
        result_index = candidate_labels.index(result)
        scores[result_index] = 0.9
        
        return {
            'labels': candidate_labels,
            'scores': scores,
            'sequence': text[:100] + '...'  # Abbreviated for log clarity
        }
    
    # Use our custom classifier
    classifier = simple_classifier
    print("Successfully initialized custom classifier")
    
except Exception as e:
    print(f"Error initializing classifier: {e}")
    print("Falling back to Gemini for classification")

# Load Gemini API Key from environment variable
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GEMINI_API_URL = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={GEMINI_API_KEY}"

# Add a global dictionary to store transcripts and summaries by session
video_sessions = {}

# Download audio from YouTube
def download_audio(youtube_url):
    # Ensure downloads directory exists
    os.makedirs('downloads', exist_ok=True)
    
    options = {
        'format': 'bestaudio/best',
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '192',
        }],
        'outtmpl': 'downloads/%(title)s.%(ext)s',
        'no_continue': True,  # Prevent resuming partial downloads
        'ignoreerrors': True  # Continue even if there are non-fatal errors
    }
    with yt_dlp.YoutubeDL(options) as ydl:
        info = ydl.extract_info(youtube_url, download=True)
        audio_file = ydl.prepare_filename(info).replace(".webm", ".mp3").replace(".m4a", ".mp3")
        return audio_file

# Transcribe audio using Whisper
# Configure warnings to suppress FP16 warning
warnings.filterwarnings("ignore", message="FP16 is not supported on CPU; using FP32 instead")

# Load the model normally without fp16 parameter
transcriber = whisper.load_model("base")
def transcribe_audio(audio_file):
    try:
        result = transcriber.transcribe(audio_file)
        return result["text"]
    except Exception as e:
        print(f"Error transcribing audio: {e}")
        return "Error in transcription. Please try again with a different video."

# Send prompt to Gemini API
def query_gemini(prompt):
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {'Content-Type': 'application/json'}
    response = requests.post(GEMINI_API_URL, headers=headers, json=payload)
    if response.status_code == 200:
        return response.json()['candidates'][0]['content']['parts'][0]['text']
    else:
        return f"Error: {response.text}"

# Detect category with language support
def detect_category(text):
    candidate_labels = [
        'Technology', 'Education', 'Health', 'Finance', 'Entertainment',
        'Science', 'Business', 'Politics', 'Sports', 'Lifestyle',
        'News', 'Gaming', 'Music', 'Art', 'Travel',
        'Food', 'Fashion', 'Automotive', 'Environment', 'History'
    ]
    
    # Try using transformers pipeline if available
    if classifier:
        try:
            result = classifier(text, candidate_labels)
            max_label = max(zip(result['labels'], result['scores']), key=lambda x: x[1])[0]
            return max_label
        except Exception as e:
            print(f"Error using classifier: {e}")
            # Fall back to Gemini API
    
    # Fall back to Gemini API if transformers fails
    prompt = f"""
    Categorize the following video transcript into one of these topics: 
    {', '.join(candidate_labels)}
    
    Return ONLY the category name in English, with no additional text.
    
    Transcript:
    {text}
    """
    return query_gemini(prompt)

# Understand Context
def understand_context(text, language="en"):
    language_names = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "zh": "Chinese",
        "hi": "Hindi",
        "mr": "Marathi",
        "ja": "Japanese"
    }
    
    lang_name = language_names.get(language, "English")
    translate_instruction = "" if language == "en" else f"Translate all output to {lang_name}."
    
    prompt = f"""
    Analyze the transcript and extract:
    - Key Topics
    - Key Notes or Facts
    - Any highlights or insights
    
    {translate_instruction}

    Transcript:
    {text}
    """
    return query_gemini(prompt)

# Summarize
def summarize_transcript(text, language="en"):
    base_prompt = f"""
    Summarize this transcript in clear and simple language, maintaining the core boundaries of the original content:

    Transcript:
    {text}
    """
    
    if language == "en":
        prompt = base_prompt
    else:
        # Add translation instruction based on language
        language_names = {
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "zh": "Chinese",
            "hi": "Hindi",
            "mr": "Marathi",
            "ja": "Japanese"
        }
        
        lang_name = language_names.get(language, "English")
        prompt = f"""
        Summarize this transcript in clear and simple language, maintaining the core boundaries of the original content.
        Translate the summary to {lang_name}.

        Transcript:
        {text}
        """
    
    return query_gemini(prompt)

# Extract structured information from summary
def extract_structured_info(summary, language="en"):
    language_names = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "zh": "Chinese",
        "hi": "Hindi",
        "mr": "Marathi",
        "ja": "Japanese"
    }
    
    lang_name = language_names.get(language, "English")
    translate_instruction = "" if language == "en" else f"Translate all output to {lang_name}."
    
    prompt = f"""
    Analyze this video summary and extract exactly the following information:
    
    1. Key Topics (2-5 bullet points)
    2. Key Notes or Facts (2-5 bullet points)
    3. Key Insights or Highlights  a in detail and easy to understand (2-5 bullet points)
    
    {translate_instruction}
    
    Format your response STRICTLY as valid JSON like this:
    {{
      "key_topics": ["topic1", "topic2", "topic3"],
      "key_notes": ["note1", "note2", "note3"],
      "key_insights": ["insight1", "insight2", "insight3"]
    }}
    
    DO NOT include any explanations, markdown formatting, or text outside the JSON structure.
    ONLY return the JSON object.
    
    Summary:
    {summary}
    """
    response = query_gemini(prompt)
    print(f"Raw Gemini response: {response}")
    
    try:
        # Try to fix common JSON formatting issues
        cleaned_response = response.strip()
        # If response starts with ``` or ends with ```, remove it (markdown code block)
        if cleaned_response.startswith('```json'):
            cleaned_response = cleaned_response[7:]
        if cleaned_response.startswith('```'):
            cleaned_response = cleaned_response[3:]
        if cleaned_response.endswith('```'):
            cleaned_response = cleaned_response[:-3]
        
        cleaned_response = cleaned_response.strip()
        
        # Try to parse JSON response
        structured_data = json.loads(cleaned_response)
        
        # Validate the structure
        if not all(k in structured_data for k in ['key_topics', 'key_notes', 'key_insights']):
            raise ValueError("Missing required keys in the response")
            
        # Ensure we have at least some content
        if not structured_data['key_topics'] or len(structured_data['key_topics']) == 0:
            structured_data['key_topics'] = ["AI-generated main topic from the video"]
            
        if not structured_data['key_notes'] or len(structured_data['key_notes']) == 0:
            structured_data['key_notes'] = ["Important fact from the video content"]
            
        if not structured_data['key_insights'] or len(structured_data['key_insights']) == 0:
            structured_data['key_insights'] = ["Key takeaway from the content", "Significant conclusion"]
        
        return structured_data
    except Exception as e:
        print(f"Error parsing structured data: {e}")
        print(f"Response that failed parsing: {response}")
        
        # Fallback with minimal structured data
        return {
            "key_topics": ["Video main topic", "Secondary topic"],
            "key_notes": ["Important fact from the video", "Notable information mentioned"],
            "key_insights": ["Key takeaway from the content", "Significant conclusion"]
        }

# Flask route
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def summarize_video():
    if 'url' in request.form:
        video_url = request.form['url']
        language = request.form.get('language', 'en')  # Default to English if not specified
        is_language_change = request.form.get('isLanguageChange') == 'true'
        
        # If this is a language change request, we can skip the download and transcription
        if is_language_change and 'currentContent' in request.form:
            try:
                # Get the current content from the frontend
                current_content = json.loads(request.form.get('currentContent', '{}'))
                
                # Check if we have the transcript already
                if 'transcript' in current_content:
                    transcription = current_content['transcript']
                    print(f"Using existing transcript for language change to {language}")
                    
                    # Generate new summary in the requested language
                    summary = summarize_transcript(transcription, language)
                    print(f"Generated new summary in {language}")
                    
                    # Extract structured information based on the new summary
                    structured_info = extract_structured_info(summary, language)
                    
                    # Get category (category is always in English)
                    category = current_content.get('category', '')
                    
                    # Generate context in the new language
                    context = understand_context(transcription, language)
                    
                    return jsonify({
                        'category': category.strip(),
                        'context': context.strip(),
                        'summary': summary.strip(),  # The new translated summary
                        'key_topics': structured_info['key_topics'],
                        'key_notes': structured_info['key_notes'],
                        'key_insights': structured_info['key_insights'],
                        'transcript': transcription.strip(),
                    })
            except Exception as e:
                print(f"Error handling language change: {e}")
                import traceback
                traceback.print_exc()
                # Fall back to normal processing if something goes wrong
        
        # Normal processing for new videos or if language change handling failed
        audio_file = download_audio(video_url)
        transcription = transcribe_audio(audio_file)

        category = detect_category(transcription)  # Always get category in English
        context = understand_context(transcription, language)
        summary = summarize_transcript(transcription, language)
        
        # Extract structured information from summary
        structured_info = extract_structured_info(summary, language)
        
        return jsonify({
            'category': category.strip(),
            'context': context.strip(),
            'summary': summary.strip(),
            'key_topics': structured_info['key_topics'],
            'key_notes': structured_info['key_notes'],
            'key_insights': structured_info['key_insights'],
            'transcript': transcription.strip(),
        })
    return jsonify({'error': 'No URL provided'})

@app.route('/chat', methods=['POST'])
def handle_chat():
    data = request.json
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    user_message = data.get('message', '')
    context = data.get('context', {})
    language = data.get('language', 'en')
    
    # Extract relevant information from context
    summary = context.get('summary', '')
    category = context.get('category', '')
    key_topics = context.get('keyTopics', [])
    key_notes = context.get('keyNotes', [])
    key_insights = context.get('keyInsights', [])
    transcript = context.get('transcript', '')
    video_title = context.get('videoTitle', 'the video')
    
    # Prepare a prompt for Gemini to answer the question
    prompt = f"""
    You are a helpful assistant that answers questions about a specific video.
    
    Here's the information about the video "{video_title}":
    
    CATEGORY: {category}
    
    SUMMARY: 
    {summary}
    
    KEY TOPICS:
    {', '.join(key_topics)}
    
    KEY NOTES:
    {', '.join(key_notes)}
    
    KEY INSIGHTS:
    {', '.join(key_insights)}
    
    PARTIAL TRANSCRIPT:
    {transcript[:2000]}...
    
    The user is asking about this video content. Their question is:
    "{user_message}"
    
    Guidelines:
    1. ONLY answer based on the information provided above. 
    2. If you don't find the answer in the provided information, politely say you don't have that specific information.
    3. Keep answers concise but informative.
    4. Be conversational and friendly.
    5. Don't mention that you're using "the provided information" - just answer naturally.
    6. Never make up facts if they're not in the video information provided.
    
    IMPORTANT: Respond in {language_names.get(language, 'English')} language.
    """
    
    try:
        # Get response from Gemini
        response = query_gemini(prompt)
        return jsonify({'response': response})
    except Exception as e:
        print(f"Error in chat response: {e}")
        return jsonify({'response': "I'm sorry, I couldn't process your question. Please try again."})

# Add a dictionary for language names
language_names = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "zh": "Chinese",
    "hi": "Hindi",
    "mr": "Marathi",
    "ja": "Japanese"
}

if __name__ == '__main__':
    app.run(debug=True)
