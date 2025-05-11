import React, { useState, useRef, useEffect } from "react";
// import CustomAlert from "./components/CustomAlert";

const App = () => {
    const [expandedSections, setExpandedSections] = useState({
        keyTopics: false,
        keyQuotes: false,
        keyInsights: false,
    });

    const [videoUrl, setVideoUrl] = useState("");
    const [videoData, setVideoData] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [summary, setSummary] = useState(null);
    const [alert, setAlert] = useState(null);
    const [selectedLanguage, setSelectedLanguage] = useState("en");
    const [previousLanguage, setPreviousLanguage] = useState("en");
    const [translationError, setTranslationError] = useState(null);
    const [showChatbot, setShowChatbot] = useState(false);
    const [chatMessages, setChatMessages] = useState([
        { role: 'bot', content: 'Hello! I can answer questions about this video. What would you like to know?' }
    ]);
    const [messageInput, setMessageInput] = useState("");
    const [isChatLoading, setIsChatLoading] = useState(false);
    const chatEndRef = useRef(null);
    const cardRef = useRef(null);
    
    // Sample suggested questions
    const allSuggestedQuestions = [
        "What are the main points?",
        "Can you summarize the key insights?",
        "What is the most important takeaway?",
        "Who is the target audience?",
        "What evidence supports the claims?",
        "How does this relate to current trends?",
        "What challenges were mentioned?",
        "What solutions were proposed?",
        "Are there any controversies discussed?",
        "What are the practical applications?",
        "How reliable is the information presented?",
        "What's the speaker's background?",
        "Were any statistics or data mentioned?",
        "What's the historical context?",
        "How might this impact the future?",
        "What are the limitations of the approach?",
        "What alternatives were discussed?",
        "How does this compare to other methods?",
        "What assumptions were made?",
        "What parts were most surprising?",
        "Can you explain the technical aspects?",
        "What terminology should I understand?",
        "What resources were recommended?",
        "How can I learn more about this topic?",
        "What's the most critical criticism mentioned?"
    ];
    
    // State for current suggested questions (5 random ones)
    const [suggestedQuestions, setSuggestedQuestions] = useState([]);
    
    // Function to get 5 random questions
    const getRandomQuestions = () => {
        const shuffled = [...allSuggestedQuestions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, 5);
    };
    
    // Set initial suggested questions
    useEffect(() => {
        setSuggestedQuestions(getRandomQuestions());
    }, []);
    
    const API_KEY = "AIzaSyB6Ea0jr6J1arlTM4WWrqfG_FJL_Jtilw4"; 

    const formatDuration = (duration) => {
        const match = duration.match(/PT(\d+H)?(\d+M)?(\d+S)?/);
        if (!match) return duration;

        const hours = (match[1] || '').replace('H', '');
        const minutes = (match[2] || '').replace('M', '');
        const seconds = (match[3] || '').replace('S', '');

        let formattedDuration = '';
        if (hours) formattedDuration += `${hours}:`;
        formattedDuration += `${minutes.padStart(2, '0')}:`;
        formattedDuration += seconds.padStart(2, '0');

        return formattedDuration;
    };

    const stripMarkdown = (text) => {
        if (!text) return '';
        return text
            .replace(/\*\*(.*?)\*\*/g, '$1') 
            .replace(/\*(.*?)\*/g, '$1') 
            .replace(/\[(.*?)\]\((.*?)\)/g, '$1') 
            .replace(/`(.*?)`/g, '$1') 
            .replace(/#{1,6}\s/g, '') 
            .replace(/>\s(.*)/g, '$1') 
            .replace(/\n\s*[-*+]\s/g, '\n') 
            .replace(/\n\s*\d+\.\s/g, '\n') 
            .replace(/\n{3,}/g, '\n\n') 
            .trim();
    };

    // extracting Video ID from YouTube URL
    const extractVideoId = (url) => {
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|live\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;

        const match = url.match(regex);
        return match ? match[1] : null;
    };

    // Function to fetch YouTube video metadata
    const fetchVideoData = async () => {
        const videoId = extractVideoId(videoUrl);
        if (!videoId) {
            alert("Invalid YouTube URL");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(
                `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=${videoId}&key=${API_KEY}`
            );
            const data = await response.json();

            if (data.items.length > 0) {
                const video = data.items[0];
                setVideoData({
                    title: video.snippet.title,
                    channel: video.snippet.channelTitle,
                    duration: formatDuration(video.contentDetails.duration),
                    publishedAt: new Date(video.snippet.publishedAt).toDateString(),
                    thumbnail: video.snippet.thumbnails.high.url,
                });
                
                // After fetching video data, send URL to backend for summarization
                fetchSummary(videoUrl);
            } else {
                alert("No video found!");
                setIsLoading(false);
            }
        } catch (error) {
            console.error("Error fetching video data:", error);
            setIsLoading(false);
        }
    };

    // Function to fetch summary from backend
    const fetchSummary = async (url, isLanguageChange = false) => {
        try {
            // If this is a language change request, set translating state
            if (isLanguageChange && summary) {
                setIsTranslating(true);
                setPreviousLanguage(previousLanguage);
            } else {
                setIsLoading(true);
            }

            const formData = new FormData();
            formData.append('url', url);
            formData.append('language', selectedLanguage);
            formData.append('isLanguageChange', isLanguageChange);
            
            if (isLanguageChange) {
                formData.append('previousLanguage', previousLanguage);
                // Send the current summary and transcript to avoid reprocessing the video
                formData.append('currentContent', JSON.stringify({
                    mainSummary: summary.mainSummary,
                    category: summary.category,
                    keyTopics: summary.keyTopics,
                    keyQuotes: summary.keyQuotes,
                    keyInsights: summary.keyInsights,
                    transcript: summary.transcript
                }));
            }

            const response = await fetch('http://localhost:5000/summarize', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Failed to get summary');
            }

            const data = await response.json();
            
            // Validate the response data
            if (!data || !data.summary) {
                throw new Error('Invalid response data');
            }
            
            // Update the summary with translated content
            setSummary({
                mainSummary: data.summary,
                category: data.category || summary?.category || '',
                keyTopics: data.key_topics || [],
                keyQuotes: data.key_notes || [],
                keyInsights: data.key_insights || [],
                transcript: data.transcript || "",
            });
            
            // Clear any previous translation errors
            setTranslationError(null);
            
            // Open the first section by default
            setExpandedSections(prev => ({
                ...prev,
                keyTopics: true
            }));
            
        } catch (error) {
            console.error('Error fetching summary:', error);
            setTranslationError(error.message);
            setAlert({
                message: `Translation error: ${error.message}`,
                type: 'error'
            });
        } finally {
            setIsLoading(false);
            setIsTranslating(false);
        }
    };

    // Add a useEffect to handle language changes
    useEffect(() => {
        if (videoUrl && summary && selectedLanguage !== previousLanguage) {
            fetchSummary(videoUrl, true);
        }
    }, [selectedLanguage]);

    const toggleSection = (section) => {
        setExpandedSections(prev => ({
            ...prev,
            [section]: !prev[section]
        }));
    };

    const scrollToSection = (sectionId) => {
        const element = document.getElementById(sectionId);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const getLanguageName = (code) => {
        const languages = {
            "en": "English",
            "es": "Spanish",
            "fr": "French",
            "de": "German",
            "zh": "Chinese",
            "hi": "Hindi",
            "mr": "Marathi",
            "ja": "Japanese"
        };
        return languages[code] || code;
    };

    // Toggle chatbot visibility
    const toggleChatbot = () => {
        setShowChatbot(prev => {
            // If we're opening the chatbot, reset messages and suggested questions
            if (!prev) {
                setChatMessages([
                    { role: 'bot', content: `Hello! I can answer questions about ${videoData?.title || "this video"}. What would you like to know?` }
                ]);
                // Set fresh random questions when opening chatbot
                setSuggestedQuestions(getRandomQuestions());
            }
            return !prev;
        });
    };

    // Handle selecting a suggested question
    const handleSuggestedQuestion = (question) => {
        // Process the suggested question just like a manually typed one
        setMessageInput(question);
        
        // Small delay to show the question in the input field before sending
        setTimeout(() => {
            handleSendMessage(question);
        }, 100);
    };

    // Function to handle sending a message to the chatbot
    const handleSendMessage = async (questionOverride = null) => {
        const question = questionOverride || messageInput;
        if (!question.trim()) return;
        
        // Prevent page jumping
        if (chatEndRef.current) {
            // Store current scroll position
            const currentScrollY = window.scrollY;
            
            // Add user message to chat
            const newMessage = { role: 'user', content: question };
            setChatMessages(prevMessages => [...prevMessages, newMessage]);
            setMessageInput('');
            setIsChatLoading(true);
            
            // Restore scroll position
            window.scrollTo(0, currentScrollY);
        }
        
        try {
            // Prepare context from summary and transcript
            const context = {
                summary: summary.mainSummary,
                category: summary.category,
                keyTopics: summary.keyTopics,
                keyNotes: summary.keyQuotes,
                keyInsights: summary.keyInsights,
                transcript: summary.transcript || "",
                videoTitle: videoData?.title || "the video",
            };
            
            // Send request to backend
            const response = await fetch('http://localhost:5000/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: question,
                    context: context,
                    language: selectedLanguage,
                }),
            });
            
            if (!response.ok) {
                throw new Error('Failed to get chatbot response');
            }
            
            const data = await response.json();
            
            // Add bot response to chat
            setChatMessages(prevMessages => [...prevMessages, { 
                role: 'bot', 
                content: data.response 
            }]);
            
            // Randomize suggested questions after each interaction
            setSuggestedQuestions(getRandomQuestions());
        } catch (error) {
            console.error('Error getting chatbot response:', error);
            setChatMessages(prevMessages => [...prevMessages, { 
                role: 'bot', 
                content: "I'm sorry, I'm having trouble answering that question right now. Please try again." 
            }]);
            
            // Still randomize questions even if there was an error
            setSuggestedQuestions(getRandomQuestions());
        } finally {
            setIsChatLoading(false);
        }
    };
    
    // Scroll to bottom of chat whenever messages change, but avoid page jumping
    useEffect(() => {
        if (chatEndRef.current) {
            const chatContainer = chatEndRef.current.parentElement;
            if (chatContainer) {
                chatContainer.scrollTop = chatContainer.scrollHeight;
            }
        }
    }, [chatMessages]);

    // Update the language selection handler
    const handleLanguageChange = (e) => {
        const newLanguage = e.target.value;
        setPreviousLanguage(selectedLanguage);
        setSelectedLanguage(newLanguage);
    };

    return (
        <div id="webcrumbs" className="min-h-screen bg-gradient-to-b from-primary-50 to-white">
            <div className="w-full mx-auto font-sans">
                {/* Hero Section */}
                <header className="py-6 px-4 sm:px-6 lg:px-8">
                    <nav className="flex flex-col sm:flex-row justify-between items-center gap-4 max-w-7xl mx-auto">
                        <div className="flex items-center gap-2">
                            <svg className="w-8 h-8 text-primary-600" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M21.582 7.643a2.506 2.506 0 0 0-1.768-1.768C18.254 5.5 12 5.5 12 5.5s-6.254 0-7.814.375a2.505 2.505 0 0 0-1.768 1.768C2.043 9.203 2.043 12 2.043 12s0 2.797.375 4.357a2.505 2.505 0 0 0 1.768 1.768c1.56.375 7.814.375 7.814.375s6.254 0 7.814-.375a2.505 2.505 0 0 0 1.768-1.768C22 14.797 22 12 22 12s0-2.797-.418-4.357z" />
                                <path d="M9.5 15.5v-7l6 3.5-6 3.5z" fill="white" />
                            </svg>
                            <h1 className="text-xl font-bold text-primary-700">VidSummarize</h1>
                        </div>
                        <div className="flex flex-wrap justify-center gap-4 sm:gap-6">
                            <button
                                onClick={() => scrollToSection('hero')}
                                className="font-medium hover:text-primary-600 transition-colors cursor-pointer"
                            >
                                Home
                            </button>
                            <button
                                onClick={() => scrollToSection('how-to-use')}
                                className="font-medium hover:text-primary-600 transition-colors cursor-pointer"
                            >
                                How to Use
                            </button>
                            <button
                                onClick={() => scrollToSection('about')}
                                className="font-medium hover:text-primary-600 transition-colors cursor-pointer"
                            >
                                About 
                            </button>
                            <button
                                onClick={() => scrollToSection('contact')}
                                className="font-medium hover:text-primary-600 transition-colors cursor-pointer"
                            >
                                Contact
                            </button>
                        </div>
                    </nav>

                    <div id="hero" className="mt-16 text-center max-w-7xl mx-auto">
                        <div className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4">
                            Summarize Any YouTube Video <span className="text-primary-600">in Seconds</span>
                        </div>

                        <div className="text-base sm:text-lg text-gray-600 max-w-3xl mx-auto mb-8 px-4">
                            Get concise, accurate summaries of YouTube videos in your preferred language. Save time and
                            extract key insights without watching the entire video.
                        </div>

                        <div className="bg-white p-4 sm:p-8 rounded-xl shadow-lg mx-4 sm:mx-auto max-w-4xl transform hover:shadow-xl transition-all duration-300">
                            <div className="flex flex-col sm:flex-row items-center gap-2 mb-6 bg-gray-100 p-3 rounded-lg">
                                <span className="material-symbols-outlined text-gray-500">link</span>
                                <input
                                    type="text"
                                    placeholder="Paste YouTube video URL here..."
                                    value={videoUrl}
                                    onChange={(e) => setVideoUrl(e.target.value)}
                                    className="w-full bg-transparent outline-none text-gray-800 placeholder-gray-400"
                                />
                                <button 
                                    onClick={fetchVideoData}
                                    disabled={isLoading}
                                    className={`w-full sm:w-auto ${isLoading ? 'bg-gray-400' : 'bg-primary-600 hover:bg-primary-700'} text-white px-4 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 mt-2 sm:mt-0 flex items-center justify-center`}
                                >
                                    {isLoading ? (
                                        <span className="flex items-center">
                                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                            Processing...
                                        </span>
                                    ) : "Summarize"}
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-3 justify-center mb-4">
                                <span className="text-sm text-gray-500">Language:</span>
                                <select
                                    className="bg-gray-100 rounded-md px-3 py-1 text-sm outline-none hover:bg-gray-200 transition-colors"
                                    value={selectedLanguage}
                                    onChange={handleLanguageChange}
                                    disabled={isTranslating || !summary}
                                >
                                    <option value="en">English</option>
                                    <option value="es">Spanish</option>
                                    <option value="fr">French</option>
                                    <option value="de">German</option>
                                    <option value="zh">Chinese</option>
                                    <option value="hi">Hindi</option>
                                    <option value="mr">Marathi</option>
                                    <option value="ja">Japanese</option>
                                </select>
                                {isTranslating && (
                                    <div className="flex items-center text-primary-600">
                                        <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        <span className="text-xs">Translating to {getLanguageName(selectedLanguage)}...</span>
                                    </div>
                                )}
                                {translationError && (
                                    <div className="text-red-500 text-xs mt-1">
                                        Translation failed: {translationError}
                                    </div>
                                )}
                            </div>   
                        </div>
                    </div>
                </header>

                {/* Video Summary Section */}
                {(videoData && summary) && (
                    <section className="py-16 px-4 sm:px-6 lg:px-8">
                        <div className="flex flex-col md:flex-row gap-6 max-w-7xl mx-auto">
                            {/* Video Preview Card */}
                            <div className="w-full md:w-80 shrink-0 bg-white rounded-xl shadow-lg hover:shadow-xl transition-shadow duration-300">
                                <div className="p-4">
                                    <div className="space-y-4">
                                        <div className="relative bg-gray-200 rounded-md aspect-video flex items-center justify-center overflow-hidden shadow-inner group cursor-pointer">
                                            <img
                                                src={videoData.thumbnail}
                                                alt="Video Thumbnail"
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-black/5 group-hover:bg-black/0 transition-colors duration-300"></div>
                                        </div>

                                        <h2 className="text-lg font-medium">
                                            {videoData.title}
                                        </h2>

                                        <div className="space-y-2 text-sm text-gray-500">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">person</span>
                                                <span>{videoData.channel}</span>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined text-sm">category</span>
                                                <span className="text-primary-600 font-medium">{summary.category.replace(/[*_~`]/g, '')}</span>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-sm">schedule</span>
                                                    <span>{videoData.duration}</span>
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <span className="material-symbols-outlined text-sm">calendar_today</span>
                                                    <span>{videoData.publishedAt}</span>
                                                </div>
                                            </div>
                                            
                                            {/* <div className="flex items-center gap-2 mt-4 text-primary-600">
                                                <span className="material-symbols-outlined text-sm">category</span>
                                                <span>{summary.category}</span>
                                            </div> */}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Summary/Chatbot Card */}
                            <div 
                                ref={cardRef}
                                className="w-full flex-1 relative"
                            >
                                {/* Summary View */}
                                <div className={`w-full h-full bg-white rounded-xl shadow-lg transition-all duration-300 ${showChatbot ? 'hidden' : 'block'}`}>
                                    <div className="flex flex-row items-center p-4 pb-0">
                                        <h3 className="text-xl font-semibold text-primary-600 flex items-center gap-2">
                                            <span className="material-symbols-outlined text-primary-600">description</span>
                                            Summary
                                        </h3>
                                        <div className="ml-auto flex gap-1">
                                            <button 
                                                className="p-2 rounded-full hover:bg-primary-50 transition-colors duration-200"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(stripMarkdown(summary.mainSummary));
                                                }}
                                            >
                                                <span className="material-symbols-outlined text-gray-400">content_copy</span>
                                            </button>
                                            <button 
                                                className="p-2 rounded-full hover:bg-primary-50 transition-all duration-300 text-primary-600 relative overflow-hidden group"
                                                onClick={toggleChatbot}
                                                title="Ask about this video"
                                            >
                                                <span className="relative z-10 material-symbols-outlined animate-pulse">chat</span>
                                                <span className="absolute inset-0 bg-primary-100 rounded-full scale-0 group-hover:scale-100 transition-transform duration-300 origin-center"></span>
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 h-[500px] overflow-hidden flex flex-col">
                                        <div className="bg-gray-50 p-4 rounded-lg text-gray-700 mb-6 overflow-y-auto max-h-[200px] relative">
                                            {isTranslating ? (
                                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/80 z-10">
                                                    <div className="flex flex-col items-center">
                                                        <svg className="animate-spin h-8 w-8 text-primary-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                        </svg>
                                                        <span className="text-primary-600 font-medium">Translating to {getLanguageName(selectedLanguage)}...</span>
                                                        <span className="text-xs text-gray-500">From {getLanguageName(previousLanguage)}</span>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div key={selectedLanguage + "-summary"}>
                                                    {stripMarkdown(summary.mainSummary)}
                                                </div>
                                            )}
                                        </div>

                                        <div className="space-y-4 overflow-y-auto flex-1">
                                            {/* Key Topics */}
                                            <div className="mb-4">
                                                <button
                                                    className="w-full flex justify-between items-center bg-primary-100 px-4 py-3 rounded-t-md text-left sticky top-0 z-10 hover:bg-primary-200 transition-colors"
                                                    onClick={() => toggleSection('keyTopics')}
                                                >
                                                    <span className="font-medium flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-primary-600">topic</span>
                                                        Key Topics
                                                    </span>
                                                    <span className={`material-symbols-outlined transition-transform duration-300 ${expandedSections.keyTopics ? 'rotate-180' : ''}`}>
                                                        expand_more
                                                    </span>
                                                </button>
                                                {expandedSections.keyTopics && (
                                                    <div className="bg-white border border-t-0 border-gray-200 rounded-b-md p-3">
                                                        <ul className="list-disc list-outside pl-6 text-gray-700 max-h-[250px] overflow-y-auto pr-4 py-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 scrollbar-thumb-rounded-full space-y-3">
                                                            {summary.keyTopics.map((topic, index) => (
                                                                <li key={`${selectedLanguage}-topic-${index}`} className="pl-2">{stripMarkdown(topic)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Key Quotes */}
                                            <div className="mb-4">
                                                <button
                                                    className="w-full flex justify-between items-center bg-primary-100 px-4 py-3 rounded-t-md text-left sticky top-0 z-10 hover:bg-primary-200 transition-colors"
                                                    onClick={() => toggleSection('keyQuotes')}
                                                >
                                                    <span className="font-medium flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-primary-600">format_quote</span>
                                                        Key Notes/Quotes
                                                    </span>
                                                    <span className={`material-symbols-outlined transition-transform duration-300 ${expandedSections.keyQuotes ? 'rotate-180' : ''}`}>
                                                        expand_more
                                                    </span>
                                                </button>
                                                {expandedSections.keyQuotes && (
                                                    <div className="bg-white border border-t-0 border-gray-200 rounded-b-md p-3">
                                                        <ul className="list-disc list-outside pl-6 text-gray-700 max-h-[250px] overflow-y-auto pr-4 py-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 scrollbar-thumb-rounded-full space-y-3">
                                                            {summary.keyQuotes.map((quote, index) => (
                                                                <li key={`${selectedLanguage}-quote-${index}`} className="pl-2">{stripMarkdown(quote)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Key Insights */}
                                            <div className="mb-4">
                                                <button
                                                    className="w-full flex justify-between items-center bg-primary-100 px-4 py-3 rounded-t-md text-left sticky top-0 z-10 hover:bg-primary-200 transition-colors"
                                                    onClick={() => toggleSection('keyInsights')}
                                                >
                                                    <span className="font-medium flex items-center gap-2">
                                                        <span className="material-symbols-outlined text-primary-600">lightbulb</span>
                                                        Key Insights
                                                    </span>
                                                    <span className={`material-symbols-outlined transition-transform duration-300 ${expandedSections.keyInsights ? 'rotate-180' : ''}`}>
                                                        expand_more
                                                    </span>
                                                </button>
                                                {expandedSections.keyInsights && (
                                                    <div className="bg-white border border-t-0 border-gray-200 rounded-b-md p-3">
                                                        <ul className="list-disc list-outside pl-6 text-gray-700 max-h-[250px] overflow-y-auto pr-4 py-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 scrollbar-thumb-rounded-full space-y-3">
                                                            {summary.keyInsights.map((insight, index) => (
                                                                <li key={`${selectedLanguage}-insight-${index}`} className="pl-2">{stripMarkdown(insight)}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Chatbot View */}
                                <div 
                                    className={`w-full h-[600px] bg-gradient-to-br from-primary-50 to-white rounded-xl shadow-lg overflow-hidden transition-all duration-500 ease-in-out ${showChatbot ? 'opacity-100 transform scale-100' : 'opacity-0 transform scale-95 hidden'}`}
                                    style={{
                                        boxShadow: showChatbot ? '0 10px 25px -5px rgba(59, 130, 246, 0.1), 0 8px 10px -6px rgba(59, 130, 246, 0.1)' : 'none'
                                    }}
                                >
                                    <div className="flex flex-col h-full">
                                        {/* Chatbot Header */}
                                        <div className="bg-primary-600 text-white px-4 py-3 flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="material-symbols-outlined animate-pulse">smart_toy</span>
                                                <h3 className="font-medium">Video Assistant</h3>
                                            </div>
                                            <button 
                                                onClick={toggleChatbot}
                                                className="text-white hover:bg-primary-700 rounded-full p-1 transition-all duration-300 hover:rotate-90"
                                            >
                                                <span className="material-symbols-outlined">close</span>
                                            </button>
                                        </div>
                                        
                                        {/* Chatbot Messages */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-white to-primary-50/30">
                                            {chatMessages.map((message, index) => (
                                                <div 
                                                    key={index} 
                                                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-fadeInUp`}
                                                    style={{ 
                                                        animationDelay: `${index * 0.1}s`,
                                                        transform: message.role === 'user' ? 'perspective(1000px) translateZ(0)' : 'perspective(1000px) translateZ(0)',
                                                        transition: 'all 0.3s ease-out'
                                                    }}
                                                >
                                                    <div 
                                                        className={`max-w-[80%] rounded-lg px-4 py-2 ${
                                                            message.role === 'user' 
                                                                ? 'bg-primary-600 text-white rounded-tr-none shadow-md hover:shadow-lg'
                                                                : 'bg-white text-gray-700 shadow-sm hover:shadow-md rounded-tl-none border-l-4 border-primary-200'
                                                        } transition-all duration-300 transform hover:translate-y-[-2px]`}
                                                    >
                                                        {message.content}
                                                    </div>
                                                </div>
                                            ))}
                                            {isChatLoading && (
                                                <div className="flex justify-start animate-fadeIn">
                                                    <div className="bg-white text-gray-700 shadow-sm rounded-lg rounded-tl-none px-4 py-3 max-w-[80%] border-l-4 border-primary-200">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                                            <div className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                                            <div className="w-2 h-2 bg-primary-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={chatEndRef} />
                                        </div>
                                        
                                        {/* Suggested Questions */}
                                        <div className="px-4 py-3 bg-white/50 border-t border-gray-100 backdrop-blur-sm">
                                            <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">psychology</span>
                                                Suggested Questions:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {suggestedQuestions.map((question, index) => (
                                                    <button
                                                        key={`suggested-${index}-${question.slice(0, 10)}`}
                                                        onClick={() => handleSuggestedQuestion(question)}
                                                        className="bg-white text-primary-600 text-sm px-3 py-1 rounded-full border border-primary-200 hover:bg-primary-50 transition-all duration-300 shadow-sm hover:shadow transform hover:scale-105 animate-fadeIn"
                                                        style={{ animationDelay: `${index * 0.1}s` }}
                                                        disabled={isChatLoading}
                                                    >
                                                        {question}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        
                                        {/* Chatbot Input */}
                                        <div className="p-3 border-t border-gray-200 bg-white/80 backdrop-blur-sm">
                                            <form 
                                                onSubmit={(e) => {
                                                    e.preventDefault();
                                                    handleSendMessage();
                                                }}
                                                className="flex items-center gap-2"
                                            >
                                                <input
                                                    type="text"
                                                    className="flex-1 border border-gray-300 rounded-full px-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 shadow-sm transition-all duration-300 focus:shadow-md"
                                                    placeholder="Ask me anything about the video..."
                                                    value={messageInput}
                                                    onChange={(e) => setMessageInput(e.target.value)}
                                                    disabled={isChatLoading}
                                                />
                                                <button
                                                    type="submit"
                                                    className={`p-2 rounded-full ${isChatLoading ? 'bg-gray-300 text-gray-500' : 'bg-primary-600 text-white hover:bg-primary-700'} shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 ${messageInput.trim() ? 'animate-pulse' : ''}`}
                                                    disabled={isChatLoading}
                                                >
                                                    <span className="material-symbols-outlined">send</span>
                                                </button>
                                            </form>
                                            <div className="text-xs text-gray-500 text-center mt-2 flex items-center justify-center gap-1">
                                                <span className="material-symbols-outlined text-xs">info</span>
                                                Ask me specific questions about {videoData?.title || "this video"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>
                )}

                {/* Summary Process Section */}
                <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white">
                    <div className="max-w-7xl mx-auto">
                        <h3 className="text-xl sm:text-2xl font-bold text-center mb-12">Our 3-Stage Summarization Process</h3>

                        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                            <div className="bg-primary-50 rounded-xl p-6 flex-1 transform hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg w-full md:w-auto">
                                <div className="bg-primary-600 text-white w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto">
                                    <span className="material-symbols-outlined">analytics</span>
                                </div>
                                <h4 className="text-lg sm:text-xl font-semibold mb-3 text-center">Stage 1: Analysis</h4>

                                <p className="text-gray-600 text-center text-sm sm:text-base">
                                    Our AI processes the video content, analyzes the audio, and extracts key information
                                    using advanced NLP.
                                </p>
                            </div>

                            <div className="relative mx-3 w-full md:w-auto">
                                <div className="hidden md:block h-0.5 w-16 bg-primary-300 absolute top-12 -left-16"></div>
                                <div className="bg-primary-100 rounded-xl p-6 flex-1 transform hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg md:translate-y-6">
                                    <div className="bg-primary-600 text-white w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto">
                                        <span className="material-symbols-outlined">psychology</span>
                                    </div>
                                    <h4 className="text-lg sm:text-xl font-semibold mb-3 text-center">
                                        Stage 2: Contextual Understanding
                                    </h4>

                                    <p className="text-gray-600 text-center text-sm sm:text-base">
                                        Our model understands the context, identifies main topics, and recognizes important
                                        relationships between ideas.
                                    </p>
                                </div>
                                <div className="hidden md:block h-0.5 w-16 bg-primary-300 absolute top-12 -right-16"></div>
                            </div>

                            <div className="bg-primary-50 rounded-xl p-6 flex-1 transform hover:scale-105 transition-all duration-300 shadow-md hover:shadow-lg w-full md:w-auto">
                                <div className="bg-primary-600 text-white w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto">
                                    <span className="material-symbols-outlined">summarize</span>
                                </div>
                                <h4 className="text-lg sm:text-xl font-semibold mb-3 text-center">Stage 3: Summarization</h4>

                                <p className="text-gray-600 text-center text-sm sm:text-base">
                                    The AI generates a concise, accurate summary in your chosen language, highlighting the
                                    most valuable insights.
                                </p>
                            </div>
                        </div>
                        {/* example */}
                        <div className="mt-16 bg-gray-50 p-4 sm:p-8 rounded-xl shadow-sm mx-4 sm:mx-auto max-w-4xl">
                            <h4 className="text-lg sm:text-xl font-semibold mb-4">Example Summary</h4>
                            <div className="flex flex-col sm:flex-row gap-4 items-start">
                                <div className="bg-gray-200 rounded-lg w-full sm:w-36 h-48 sm:h-24 min-w-[144px] overflow-hidden">
                                    <img
                                        src="https://blog.labtag.com/wp-content/uploads/2021/10/0139-Diagnostic-AI-700x290px.jpg"
                                        alt="Video thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div className="flex-1">
                                    <h5 className="font-medium text-lg mb-1">How AI is Transforming Healthcare</h5>
                                    <p className="text-sm text-gray-500 mb-3">10:45 • 1.2M views • Healthcare</p>

                                    <div className="mb-3">
                                        <div className="mb-2">
                                            <h6 className="font-medium text-primary-600">Key Topics:</h6>
                                            <ul className="text-gray-700 text-sm list-disc pl-5">
                                                <li>AI in medical diagnostics</li>
                                                <li>Personalized treatment optimization</li>
                                                <li>Healthcare accessibility improvements</li>
                                            </ul>
                                        </div>

                                        <div className="mb-2">
                                            <h6 className="font-medium text-primary-600">Key Notes:</h6>
                                            <ul className="text-gray-700 text-sm list-disc pl-5">
                                                <li>AI reduces diagnostic errors by up to 85%</li>
                                                <li>Machine learning algorithms predict patient outcomes</li>
                                                <li>Remote monitoring systems improve patient care</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <h6 className="font-medium text-primary-600">Key Highlights:</h6>
                                            <p className="text-gray-700 text-sm">
                                                This video explores how artificial intelligence is revolutionizing
                                                healthcare through improved diagnostics, personalized treatment plans, and
                                                operational efficiencies. Key points include AI's role in early disease
                                                detection, reducing medical errors, and making healthcare more accessible
                                                globally.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How to Use Section */}
                <section id="how-to-use" className="py-16 px-4 sm:px-6 lg:px-8 bg-primary-50">
                    <div className="max-w-7xl mx-auto">
                        <h3 className="text-xl sm:text-2xl font-bold text-center mb-12">How to Use VidSummarize</h3>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
                            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:bg-gray-50 cursor-pointer">
                                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4 mx-auto">
                                    <span className="material-symbols-outlined text-primary-600">content_paste</span>
                                </div>
                                <h4 className="text-lg font-semibold mb-2 text-center">1. Copy URL</h4>

                                <p className="text-gray-600 text-sm text-center">
                                    Copy the YouTube video URL you want to summarize
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:bg-gray-50 cursor-pointer">
                                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4 mx-auto">
                                    <span className="material-symbols-outlined text-primary-600">paste</span>
                                </div>
                                <h4 className="text-lg font-semibold mb-2 text-center">2. Paste URL</h4>

                                <p className="text-gray-600 text-sm text-center">
                                    Paste the URL in the input field on our website
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:bg-gray-50 cursor-pointer">
                                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4 mx-auto">
                                    <span className="material-symbols-outlined text-primary-600">translate</span>
                                </div>
                                <h4 className="text-lg font-semibold mb-2 text-center">3. Select Language</h4>

                                <p className="text-gray-600 text-sm text-center">
                                    Choose your preferred language for the summary
                                </p>
                            </div>

                            <div className="bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1 hover:bg-gray-50 cursor-pointer">
                                <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mb-4 mx-auto">
                                    <span className="material-symbols-outlined text-primary-600">auto_awesome</span>
                                </div>
                                <h4 className="text-lg font-semibold mb-2 text-center">4. Get Summary</h4>

                                <p className="text-gray-600 text-sm text-center">
                                    Receive your concise video summary in seconds
                                </p>
                            </div>
                        </div>

                        <div className="mt-12 text-center">
                            <button 
                                onClick={() => scrollToSection('hero')}
                                className="bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors transform hover:scale-105 duration-300 shadow-md"
                            >
                                Try It Now
                            </button>
                        </div>
                    </div>
                </section>

                {/* About Us Section */}
                <section id="about" className="py-16 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        <h3 className="text-xl sm:text-2xl font-bold text-center mb-12">About VidSummarize</h3>

                        <div className="flex flex-col md:flex-row gap-12 max-w-5xl mx-auto">
                            <div className="flex-1">
                                <h4 className="text-lg sm:text-xl font-semibold mb-4">Our Mission</h4>

                                <p className="text-gray-600 mb-6">
                                    At VidSummarize, we are dedicated to making knowledge more accessible. Our mission is to
                                    assist individuals in conserving time and extracting valuable insights from video
                                    content through AI technology.
                                </p>

                                <p className="text-gray-600">
                                    We believe that everyone should have access to information in a format and language that
                                    works for them, eliminating barriers to learning and comprehension.
                                </p>
                            </div>

                            <div className="flex-1">
                                <h4 className="text-lg sm:text-xl font-semibold mb-4">Our Technology</h4>

                                <p className="text-gray-600 mb-6">
                                    {/* Our platform utilizes cutting-edge natural language processing and machine learning
                                    technologies to analyze video content and generate accurate, contextually relevant
                                    summaries. */}
                                    Our platform leverages state-of-the-art natural language processing (NLP) and machine learning to deliver high-quality, context-aware video summaries. By combining extractive and abstractive summarization techniques, our system intelligently selects key insights and rephrases them into human-like, easy-to-understand summaries.
                                </p>

                                <p className="text-gray-600">
                                    With support for multiple languages and continuous improvement of our algorithms, we're
                                    committed to providing the most accurate and useful video summaries available.
                                </p>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-lg sm:text-xl font-semibold mb-4">How VidSummarize Works</h4>

                                <p className="text-gray-600 mb-6">
                                VidSummarize offers a 3-stage summarization process for video content. The first stage involves analyzing audio and extracting key information using advanced natural language processing (NLP). The second stage focuses on contextual understanding, where the model identifies main topics and important relationships between ideas. Users can share, download, and explore key insights from the video, enhancing their understanding and engagement.
                                </p>

                                
                            </div>
                        </div>
                    </div>
                </section>

                {/* Contact Section */}
                <section id="contact" className="py-16 px-4 sm:px-6 lg:px-8 bg-primary-50">
                    <div className="max-w-7xl mx-auto">
                        <h3 className="text-xl sm:text-2xl font-bold text-center mb-12">Contact Us</h3>
                        <div className="max-w-3xl mx-auto">
                            <div className="bg-white rounded-xl p-8 shadow-lg">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <div>
                                        <h4 className="text-lg font-semibold mb-4">Get in Touch</h4>
                                        
                                        <p className="text-gray-600 mb-6">
                                            Have questions or feedback? We'd love to hear from you. Don't hesitate to share your thoughts.
                                        </p>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-primary-600">email</span>
                                                <p className="text-gray-600">Vidsummarize@gmail.com</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-primary-600">phone</span>
                                                <p className="text-gray-600">+91 7219395345</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-primary-600">location_on</span>
                                                <p className="text-gray-600">Pune, Maharashtra, India</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <form action="https://formsubmit.co/harshkotkar005@gmail.com" method="POST" className="space-y-4 " >
                                            <div>
                                                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                                                <input
                                                    type="text"
                                                    id="name"
                                                    name="name"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                    placeholder="Your name"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                                                <input
                                                    type="email"
                                                    id="email"
                                                    name="email"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                    placeholder="your@email.com"
                                                />
                                            </div>
                                            <div>
                                                <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                                                <textarea
                                                    id="message"
                                                    name="message"
                                                    rows="4"
                                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                                    placeholder="Your message"
                                                ></textarea>
                                            </div>
                                            <input type="hidden" name="_captcha" value="false"></input>
                                            
                                            <button
                                                type="submit"
                                                className="w-full bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 transition-colors transform hover:scale-105 duration-300"
                                            >
                                                Send Message
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Footer */}
                <footer className="bg-gray-900 text-white py-12 px-4 sm:px-6 lg:px-8">
                    <div className="max-w-7xl mx-auto">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
                            <div>
                                <div className="flex items-center gap-2 mb-4">
                                    <svg className="w-6 h-6 text-primary-400" viewBox="0 0 24 24" fill="currentColor">
                                        <path d="M21.582 7.643a2.506 2.506 0 0 0-1.768-1.768C18.254 5.5 12 5.5 12 5.5s-6.254 0-7.814.375a2.505 2.505 0 0 0-1.768 1.768C2.043 9.203 2.043 12 2.043 12s0 2.797.375 4.357a2.505 2.505 0 0 0 1.768 1.768c1.56.375 7.814.375 7.814.375s6.254 0 7.814-.375a2.505 2.505 0 0 0 1.768-1.768C22 14.797 22 12 22 12s0-2.797-.418-4.357z" />
                                        <path d="M9.5 15.5v-7l6 3.5-6 3.5z" fill="white" />
                                    </svg>
                                    <h3 className="text-lg font-bold text-primary-400">VidSummarize</h3>
                                </div>

                                <p className="text-gray-400 text-sm">
                                    Making video content accessible through AI-powered summaries.
                                </p>
                            </div>

                            <div>
                                <h4 className="font-medium mb-3">Quick Links</h4>
                                <ul className="space-y-2 text-gray-400">
                                    <li>
                                        <button
                                            onClick={() => scrollToSection('hero')}
                                            className="hover:text-primary-400 transition-colors cursor-pointer"
                                        >
                                            Home
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => scrollToSection('how-to-use')}
                                            className="hover:text-primary-400 transition-colors cursor-pointer"
                                        >
                                            How to Use
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => scrollToSection('about')}
                                            className="hover:text-primary-400 transition-colors cursor-pointer"
                                        >
                                            About
                                        </button>
                                    </li>
                                    <li>
                                        <button
                                            onClick={() => scrollToSection('contact')}
                                            className="hover:text-primary-400 transition-colors cursor-pointer"
                                        >
                                            Contact
                                        </button>
                                    </li>
                                </ul>
                            </div>

                            <div>
                                <h4 className="font-medium mb-3">Connect With Us</h4>
                                <p className="text-gray-400 text-sm">Email: Vidsummarize@gmail.com</p>
                            </div>
                        </div>

                        <div className="border-t border-gray-700 pt-6 text-center text-gray-500 text-sm">
                            
                            <p>© VidSummarize. All rights reserved.</p>

                        </div>
                    </div>
                </footer>
                
                {/* Custom Alert
                {alert && (
                    <CustomAlert
                        message={alert.message}
                        type={alert.type}
                        onClose={() => setAlert(null)}
                    />
                )} */}
            </div>
        </div>
    );
};

// Add these animations to the global stylesheet or inline here
const animationStyles = `
@keyframes fadeInUp {
    from {
        opacity: 0;
        transform: translateY(10px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}

@keyframes slideIn {
    from { 
        opacity: 0;
        transform: translateX(-10px);
    }
    to { 
        opacity: 1;
        transform: translateX(0);
    }
}

@keyframes pulse {
    0% { transform: scale(1); }
    50% { transform: scale(1.05); }
    100% { transform: scale(1); }
}

@keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
}

.animate-fadeInUp {
    animation: fadeInUp 0.3s ease-out forwards;
}

.animate-fadeIn {
    animation: fadeIn 0.3s ease-out forwards;
}

.animate-slideIn {
    animation: slideIn 0.3s ease-out forwards;
}

.animate-pulse {
    animation: pulse 2s infinite;
}

.animate-bounce {
    animation: bounce 1s infinite;
}
`;

export default App; 