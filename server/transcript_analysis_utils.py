"""
Transcript Analysis Utilities

This module demonstrates how the TextPreprocessor could be used 
for transcript analysis in a video summarization application.
"""

import numpy as np
from text_preprocessing import TextPreprocessor

class TranscriptAnalyzer:
    """
    Utility class for analyzing video transcripts.
    Uses TextPreprocessor for text preprocessing.
    """
    
    def __init__(self, language='english'):
        """
        Initialize the transcript analyzer.
        
        Args:
            language (str): Language of the transcript
        """
        self.preprocessor = TextPreprocessor(language=language)
    
    def extract_key_sentences(self, transcript, num_sentences=5):
        """
        Extract key sentences from transcript based on keyword density.
        
        Args:
            transcript (str): Video transcript text
            num_sentences (int): Number of key sentences to extract
            
        Returns:
            list: Extracted key sentences
        """
        # Clean the transcript while preserving sentence structure
        sentences = self.preprocessor.tokenize_sentences(transcript)
        cleaned_sentences = [self.preprocessor.clean_text(
            sent, 
            punctuation=False, 
            stopwords=False, 
            lemmatize=False
        ) for sent in sentences]
        
        # Extract keywords from the entire transcript
        keywords = self.preprocessor.extract_keywords(transcript, top_n=20)
        
        # Score sentences based on keyword presence
        sentence_scores = []
        for i, sentence in enumerate(cleaned_sentences):
            if len(sentence.split()) < 3:  # Skip very short sentences
                sentence_scores.append(0)
                continue
                
            score = 0
            for keyword in keywords:
                if keyword.lower() in sentence.lower():
                    score += 1
            
            # Normalize by sentence length to avoid bias towards longer sentences
            score = score / len(sentence.split()) if len(sentence.split()) > 0 else 0
            sentence_scores.append(score)
        
        # Get top N sentences (with original formatting)
        top_indices = np.argsort(sentence_scores)[-num_sentences:]
        top_indices = sorted(top_indices)  # Sort by position in text, not by score
        
        return [sentences[i] for i in top_indices]
    
    def identify_topic_segments(self, transcript, max_segments=5):
        """
        Identify topic segments in the transcript.
        
        Args:
            transcript (str): Video transcript text
            max_segments (int): Maximum number of segments to identify
            
        Returns:
            list: List of segment dictionaries with start, end, and keywords
        """
        # Clean and split into sentences
        sentences = self.preprocessor.tokenize_sentences(transcript)
        
        # Simple approach: split into roughly equal segments
        segment_size = max(1, len(sentences) // max_segments)
        segments = []
        
        for i in range(0, len(sentences), segment_size):
            segment_text = ' '.join(sentences[i:i+segment_size])
            
            # Get keywords for this segment
            segment_keywords = self.preprocessor.extract_keywords(segment_text, top_n=5)
            
            segments.append({
                'start_idx': i,
                'end_idx': min(i+segment_size-1, len(sentences)-1),
                'start': sentences[i],
                'end': sentences[min(i+segment_size-1, len(sentences)-1)],
                'keywords': segment_keywords
            })
            
            if len(segments) >= max_segments:
                break
                
        return segments
    
    def analyze_sentiment_keywords(self, transcript):
        """
        Analyze sentiment-related keywords in the transcript.
        This is a simplified demonstration - a real implementation would use proper sentiment analysis.
        
        Args:
            transcript (str): Video transcript text
            
        Returns:
            dict: Sentiment-related keyword counts
        """
        # Very simplified approach - just counting positive and negative terms
        # In a real implementation, use a proper sentiment analysis library
        
        positive_terms = ['good', 'great', 'excellent', 'beneficial', 'positive', 
                         'advantage', 'helpful', 'improve', 'better', 'best', 
                         'success', 'successful', 'effective', 'efficient', 'recommended']
        
        negative_terms = ['bad', 'poor', 'terrible', 'negative', 'disadvantage', 
                         'harmful', 'worse', 'worst', 'fail', 'failure', 
                         'ineffective', 'inefficient', 'problem', 'difficult', 'challenging']
        
        # Clean and tokenize
        cleaned_text = self.preprocessor.clean_text(
            transcript, 
            punctuation=True,
            stopwords=False,
            lemmatize=True
        )
        words = self.preprocessor.tokenize_words(cleaned_text.lower())
        
        # Count occurrences
        positive_count = sum(1 for word in words if word in positive_terms)
        negative_count = sum(1 for word in words if word in negative_terms)
        
        return {
            'positive_keywords': positive_count,
            'negative_keywords': negative_count,
            'sentiment_ratio': positive_count / max(1, negative_count),
            'total_analyzed_keywords': positive_count + negative_count
        }
    
    def generate_tag_cloud_data(self, transcript, max_tags=30):
        """
        Generate data for a tag/word cloud visualization.
        
        Args:
            transcript (str): Video transcript text
            max_tags (int): Maximum number of tags to include
            
        Returns:
            list: List of {word, weight} dictionaries for visualization
        """
        # Clean text
        cleaned_text = self.preprocessor.clean_text(
            transcript, 
            punctuation=True,
            stopwords=True
        )
        
        # Count word frequencies
        words = self.preprocessor.tokenize_words(cleaned_text.lower())
        word_counts = {}
        
        for word in words:
            if len(word) > 1:  # Skip single-character words
                word_counts[word] = word_counts.get(word, 0) + 1
        
        # Sort by frequency
        sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)
        
        # Get top N words
        top_words = sorted_words[:max_tags]
        
        # Normalize weights to 1-10 range for visualization
        max_count = top_words[0][1] if top_words else 1
        min_count = top_words[-1][1] if top_words else 1
        
        tag_cloud_data = []
        for word, count in top_words:
            # Normalize to 1-10 scale if there's a range, otherwise set to 5
            if max_count > min_count:
                weight = 1 + 9 * (count - min_count) / (max_count - min_count)
            else:
                weight = 5
                
            tag_cloud_data.append({
                'text': word,
                'weight': weight
            })
            
        return tag_cloud_data
    
    def extract_structured_insights(self, transcript):
        """
        Extract structured insights from the transcript.
        
        Args:
            transcript (str): Video transcript text
            
        Returns:
            dict: Extracted structured information
        """
        # Get text statistics
        stats = self.preprocessor.get_text_statistics(transcript)
        
        # Extract key sentences
        key_sentences = self.extract_key_sentences(transcript, num_sentences=5)
        
        # Get keywords
        keywords = self.preprocessor.extract_keywords(transcript, top_n=10)
        
        # Get topic segments
        segments = self.identify_topic_segments(transcript, max_segments=3)
        
        # Sentiment analysis
        sentiment = self.analyze_sentiment_keywords(transcript)
        
        # Tag cloud data
        tag_cloud = self.generate_tag_cloud_data(transcript, max_tags=20)
        
        return {
            'statistics': stats,
            'key_sentences': key_sentences,
            'keywords': keywords,
            'topic_segments': segments,
            'sentiment': sentiment,
            'tag_cloud': tag_cloud[:10]  # Return just 10 for brevity
        }

# Example usage
if __name__ == "__main__":
    # Sample transcript
    sample_transcript = """
    In this video, we'll explore how artificial intelligence is transforming healthcare. 
    AI technologies are revolutionizing medical diagnostics by analyzing medical images with remarkable accuracy.
    Studies have shown that AI can reduce diagnostic errors by up to 85%, which is truly impressive.
    Machine learning algorithms are now able to predict patient outcomes and personalize treatment plans.
    Remote monitoring systems powered by AI are improving patient care, especially in rural areas.
    However, there are challenges including data privacy concerns and the need for regulatory frameworks.
    Despite these challenges, the future of AI in healthcare looks promising with potential to
    make healthcare more accessible, accurate, and efficient for everyone.
    """
    
    # Initialize analyzer
    analyzer = TranscriptAnalyzer()
    
    # Get insights
    insights = analyzer.extract_structured_insights(sample_transcript)
    
    # Print results
    print("=== Transcript Analysis Results ===")
    print(f"\nKeywords: {', '.join(insights['keywords'])}")
    
    print("\nKey Sentences:")
    for i, sentence in enumerate(insights['key_sentences'], 1):
        print(f"{i}. {sentence}")
    
    print("\nTopic Segments:")
    for i, segment in enumerate(insights['topic_segments'], 1):
        print(f"Segment {i}: {', '.join(segment['keywords'])}")
        
    print(f"\nSentiment Analysis: {'Positive' if insights['sentiment']['sentiment_ratio'] > 1 else 'Negative'}")
    print(f"Positive/Negative Ratio: {insights['sentiment']['sentiment_ratio']:.2f}")
    
    print("\nText Statistics:")
    print(f"- Sentences: {insights['statistics']['num_sentences']}")
    print(f"- Words: {insights['statistics']['num_words']}")
    print(f"- Meaningful Words: {insights['statistics']['num_meaningful_words']}")
    print(f"- Average Sentence Length: {insights['statistics']['avg_sentence_length']:.1f} words")
    
    print("\nTag Cloud Data (Top 10):")
    for tag in insights['tag_cloud']:
        print(f"- {tag['text']} (weight: {tag['weight']:.1f})") 