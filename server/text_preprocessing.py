import re
import string
import nltk
from nltk.tokenize import word_tokenize, sent_tokenize
from nltk.corpus import stopwords
from nltk.stem import PorterStemmer, WordNetLemmatizer
from collections import Counter
import numpy as np

# Download necessary NLTK resources
try:
    nltk.data.find('tokenizers/punkt')
    nltk.data.find('corpora/stopwords')
    nltk.data.find('corpora/wordnet')
except LookupError:
    nltk.download('punkt')
    nltk.download('stopwords')
    nltk.download('wordnet')

class TextPreprocessor:
    """
    A comprehensive text preprocessing pipeline for NLP tasks.
    This can be used to clean and prepare text data before feeding it to ML models.
    """
    def __init__(self, language='english'):
        """
        Initialize the text preprocessor with specified language.
        
        Args:
            language (str): Language for stopwords. Default is 'english'.
        """
        self.language = language
        self.stemmer = PorterStemmer()
        self.lemmatizer = WordNetLemmatizer()
        try:
            self.stop_words = set(stopwords.words(language))
        except:
            print(f"Stopwords not available for language '{language}'. Using English.")
            self.stop_words = set(stopwords.words('english'))
    
    def normalize_case(self, text):
        """Convert text to lowercase."""
        return text.lower()
    
    def remove_html_tags(self, text):
        """Remove HTML tags from text."""
        clean = re.compile('<.*?>')
        return re.sub(clean, '', text)
    
    def remove_urls(self, text):
        """Remove URLs from text."""
        url_pattern = re.compile(r'https?://\S+|www\.\S+')
        return url_pattern.sub(r'', text)
    
    def remove_punctuation(self, text):
        """Remove punctuation from text."""
        translator = str.maketrans('', '', string.punctuation)
        return text.translate(translator)
    
    def remove_numbers(self, text):
        """Remove numbers from text."""
        return re.sub(r'\d+', '', text)
    
    def remove_whitespace(self, text):
        """Remove extra whitespace from text."""
        return re.sub(r'\s+', ' ', text).strip()
    
    def remove_stopwords(self, text):
        """Remove stopwords from text."""
        words = word_tokenize(text)
        filtered_words = [word for word in words if word.lower() not in self.stop_words]
        return ' '.join(filtered_words)
    
    def stem_text(self, text):
        """Apply stemming to text."""
        words = word_tokenize(text)
        stemmed_words = [self.stemmer.stem(word) for word in words]
        return ' '.join(stemmed_words)
    
    def lemmatize_text(self, text):
        """Apply lemmatization to text."""
        words = word_tokenize(text)
        lemmatized_words = [self.lemmatizer.lemmatize(word) for word in words]
        return ' '.join(lemmatized_words)
    
    def tokenize_sentences(self, text):
        """Split text into sentences."""
        return sent_tokenize(text)
    
    def tokenize_words(self, text):
        """Split text into words."""
        return word_tokenize(text)
    
    def extract_keywords(self, text, top_n=10):
        """
        Extract keywords based on frequency.
        
        Args:
            text (str): Input text
            top_n (int): Number of top keywords to return
            
        Returns:
            list: Top keywords
        """
        # Remove stopwords
        words = word_tokenize(self.remove_stopwords(text.lower()))
        # Filter out punctuation and single-character words
        words = [word for word in words if word not in string.punctuation and len(word) > 1]
        # Count frequencies
        word_freq = Counter(words)
        # Return top N keywords
        return [word for word, freq in word_freq.most_common(top_n)]
    
    def clean_text(self, text, 
                   case=True, 
                   html=True, 
                   urls=True, 
                   punctuation=True, 
                   numbers=True, 
                   stopwords=True, 
                   lemmatize=False, 
                   stem=False):
        """
        Apply a series of text cleaning operations.
        
        Args:
            text (str): Input text
            case (bool): Normalize case
            html (bool): Remove HTML tags
            urls (bool): Remove URLs
            punctuation (bool): Remove punctuation
            numbers (bool): Remove numbers
            stopwords (bool): Remove stopwords
            lemmatize (bool): Apply lemmatization
            stem (bool): Apply stemming (not recommended with lemmatization)
            
        Returns:
            str: Cleaned text
        """
        if case:
            text = self.normalize_case(text)
        if html:
            text = self.remove_html_tags(text)
        if urls:
            text = self.remove_urls(text)
        if punctuation:
            text = self.remove_punctuation(text)
        if numbers:
            text = self.remove_numbers(text)
        if stopwords:
            text = self.remove_stopwords(text)
        if lemmatize:
            text = self.lemmatize_text(text)
        elif stem:
            text = self.stem_text(text)
        
        # Finally, remove any extra whitespace created during preprocessing
        return self.remove_whitespace(text)
    
    def text_to_sentences(self, text, clean=True):
        """
        Split text into cleaned sentences.
        
        Args:
            text (str): Input text
            clean (bool): Apply basic cleaning to each sentence
            
        Returns:
            list: List of sentences
        """
        sentences = self.tokenize_sentences(text)
        if clean:
            sentences = [self.clean_text(sentence, stem=False, lemmatize=False) for sentence in sentences]
        return sentences
    
    def calculate_keyword_density(self, text, keywords=None, top_n=10):
        """
        Calculate keyword density in the text.
        
        Args:
            text (str): Input text
            keywords (list): Optional list of keywords to check
            top_n (int): Number of top keywords if keywords not provided
            
        Returns:
            dict: Keyword densities (percentage of text)
        """
        processed_text = self.remove_stopwords(self.normalize_case(text))
        words = self.tokenize_words(processed_text)
        total_words = len(words)
        
        if not keywords:
            keywords = self.extract_keywords(text, top_n)
        
        densities = {}
        for keyword in keywords:
            keyword_count = words.count(keyword.lower())
            densities[keyword] = (keyword_count / total_words) * 100 if total_words > 0 else 0
            
        return densities

    def get_text_statistics(self, text):
        """
        Get various statistics about the text.
        
        Args:
            text (str): Input text
            
        Returns:
            dict: Text statistics
        """
        sentences = self.tokenize_sentences(text)
        words = self.tokenize_words(text)
        
        # Remove stopwords for meaningful words calculation
        meaningful_words = [word for word in words if word.lower() not in self.stop_words 
                           and word not in string.punctuation]
        
        # Calculate sentence length statistics
        sentence_lengths = [len(self.tokenize_words(sentence)) for sentence in sentences]
        
        return {
            'num_sentences': len(sentences),
            'num_words': len(words),
            'num_meaningful_words': len(meaningful_words),
            'avg_sentence_length': np.mean(sentence_lengths) if sentence_lengths else 0,
            'max_sentence_length': max(sentence_lengths) if sentence_lengths else 0,
            'min_sentence_length': min(sentence_lengths) if sentence_lengths else 0,
            'std_sentence_length': np.std(sentence_lengths) if sentence_lengths else 0,
        }

# Example usage
if __name__ == "__main__":
    # Sample text
    sample_text = """
    Natural Language Processing (NLP) is a field of artificial intelligence that focuses on the interaction
    between computers and humans through natural language. The ultimate objective of NLP is to read,
    decipher, understand, and make sense of human language in a valuable way.
    """
    
    # Initialize preprocessor
    preprocessor = TextPreprocessor()
    
    # Clean text
    cleaned_text = preprocessor.clean_text(sample_text)
    print("Cleaned text:", cleaned_text)
    
    # Extract keywords
    keywords = preprocessor.extract_keywords(sample_text)
    print("Keywords:", keywords)
    
    # Text statistics
    stats = preprocessor.get_text_statistics(sample_text)
    print("Text statistics:", stats) 