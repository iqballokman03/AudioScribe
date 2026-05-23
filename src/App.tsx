import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { Mic, Square, Upload, FileText, Download, FileJson, File, FileType2, Loader2, Sparkles, Wand2, CheckCircle2, AlertCircle, Copy, X, RotateCcw, User, Clock, Globe, Smile, Languages, ChevronDown, ChevronUp, Play, Pause, Volume2, VolumeX, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { transcribeAudio, summarizeText } from './services/geminiService';
import { exportToTXT, exportToJSON, exportToPDF, exportToWord } from './utils/exportUtils';

export default function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [transcriptionData, setTranscriptionData] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const [fileName, setFileName] = useState<string>('');
  const [audioType, setAudioType] = useState<string>('meeting');
  const [model, setModel] = useState<string>('gemini-3.1-pro-preview');
  const [summaryLanguage, setSummaryLanguage] = useState<string>('English');
  const [estimatedTimeLeft, setEstimatedTimeLeft] = useState<number | null>(null);
  const [estimatedSummaryTimeLeft, setEstimatedSummaryTimeLeft] = useState<number | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [showTooltips, setShowTooltips] = useState(false);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [volume, setVolume] = useState(1);

  useEffect(() => {
    const hasVisited = localStorage.getItem('hasVisited');
    if (!hasVisited) {
      setShowOnboard(true);
      setShowTooltips(true);
    }
  }, []);

  const closeOnboard = () => {
    localStorage.setItem('hasVisited', 'true');
    setShowOnboard(false);
  };
  
  const dismissTooltips = () => {
    localStorage.setItem('hasSeenTooltips', 'true');
    setShowTooltips(false);
  };

  useEffect(() => {
    let interval: number;
    if (isTranscribing || isSummarizing) {
      setProgress(0);
      interval = window.setInterval(() => {
        setProgress(p => {
          if (p >= 95) return 95;
          return p + Math.random() * 10;
        });
      }, 500);
    } else {
      setProgress(100);
    }
    return () => clearInterval(interval);
  }, [isTranscribing, isSummarizing]);

  useEffect(() => {
    let timeInterval: number;
    if (isTranscribing) {
      setEstimatedTimeLeft(15); // Start with 15 seconds estimate
      timeInterval = window.setInterval(() => {
        setEstimatedTimeLeft(prev => {
          if (prev === null || prev <= 1) return 1;
          return prev - 1;
        });
      }, 1000);
    } else {
      setEstimatedTimeLeft(null);
    }
    return () => clearInterval(timeInterval);
  }, [isTranscribing]);

  useEffect(() => {
    let timeInterval: number;
    if (isSummarizing) {
      setEstimatedSummaryTimeLeft(10); // Start with 10 seconds estimate
      timeInterval = window.setInterval(() => {
        setEstimatedSummaryTimeLeft(prev => {
          if (prev === null || prev <= 1) return 1;
          return prev - 1;
        });
      }, 1000);
    } else {
      setEstimatedSummaryTimeLeft(null);
    }
    return () => clearInterval(timeInterval);
  }, [isSummarizing]);

  useEffect(() => {
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      setAudioUrl(url);
      setCurrentTime(0);
      setIsPlaying(false);
      return () => URL.revokeObjectURL(url);
    } else {
      setAudioUrl(null);
    }
  }, [audioFile]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);

  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent keyboard shortcuts if typing in input
      const activeTag = (document.activeElement as HTMLElement)?.tagName;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(activeTag)) return;
      
      if (!audioRef.current || !audioUrl) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (audioRef.current.paused) audioRef.current.play();
        else audioRef.current.pause();
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        audioRef.current.currentTime = Math.min(audioRef.current.currentTime + 10, audioRef.current.duration);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        audioRef.current.currentTime = Math.max(audioRef.current.currentTime - 10, 0);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) audioRef.current.pause();
    else audioRef.current.play();
  };

  const handleSeek = (timestamp: string) => {
    if (!audioRef.current) return;
    
    const startTimeStr = timestamp.split('-')[0].trim();
    const seconds = timeToSeconds(startTimeStr);
    
    if (!isNaN(seconds)) {
      audioRef.current.currentTime = seconds;
      audioRef.current.play().catch(e => console.error("Error playing audio after seek:", e));
    }
  };

  const timeToSeconds = (timeStr: string) => {
    const parts = timeStr.split(':');
    let seconds = 0;
    if (parts.length === 2) {
      seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
    } else if (parts.length === 3) {
      seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
    }
    return seconds;
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setAudioFile(acceptedFiles[0]);
      setError('');
      setTranscription('');
      setTranscriptionData(null);
      setSummary('');
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'audio/*': ['.mp3', '.wav', '.m4a', '.ogg', '.webm']
    },
    maxFiles: 1,
  });

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new window.File([audioBlob], 'recording.webm', { type: 'audio/webm' });
        setAudioFile(file);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = window.setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      
      setError('');
      setTranscription('');
      setSummary('');
    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Could not access microphone. Please ensure permissions are granted.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const validSeconds = isNaN(seconds) ? 0 : Math.floor(seconds);
    const mins = Math.floor(validSeconds / 60);
    const secs = validSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getFormattedDate = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const strHours = String(hours).padStart(2, '0');
    return `${year}${month}${day}-${strHours}${minutes}${ampm}`;
  };

  const getExportFileName = (type: 'transcript' | 'summary') => {
    const baseName = fileName || 'transcript';
    const dateStr = getFormattedDate();
    return `${dateStr}-${baseName}${type === 'summary' ? '-summary' : ''}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // Could add a toast notification here if desired
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  const handleTranscribe = async () => {
    if (!audioFile) return;

    setIsTranscribing(true);
    setError('');
    
    try {
      if (!navigator.onLine) {
        throw new Error('Network error: Please check your internet connection.');
      }
      
      const validTypes = ['audio/mp3', 'audio/wav', 'audio/m4a', 'audio/ogg', 'audio/webm', 'audio/mpeg', 'audio/x-m4a'];
      if (audioFile.type && !validTypes.includes(audioFile.type)) {
         throw new Error(`Invalid audio format: ${audioFile.type}. Please upload MP3, WAV, M4A, OGG, or WEBM.`);
      }

      const result = await transcribeAudio(audioFile, audioType, model);
      setTranscription(result.markdown);
      setTranscriptionData(result.data);
    } catch (err: any) {
      console.error('Transcription error:', err);
      if (err.message?.toLowerCase().includes('max tokens limit') || err.message?.toLowerCase().includes('token limit')) {
        setError('The audio file is too long to process in one go. Please try a shorter recording.');
      } else {
        setError(err.message || 'An error occurred during transcription. Please try again.');
      }
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSummarize = async () => {
    if (!transcription) return;

    setIsSummarizing(true);
    setError('');

    try {
      if (!navigator.onLine) {
        throw new Error('Network error: Please check your internet connection.');
      }
      const result = await summarizeText(transcription, summaryLanguage, model);
      setSummary(result);
    } catch (err: any) {
      console.error('Summarization error:', err);
      if (err.message?.toLowerCase().includes('max tokens limit') || err.message?.toLowerCase().includes('token limit')) {
        setError('The transcription is too long to summarize in one go. Please try a shorter text.');
      } else {
        setError(err.message || 'An error occurred during summarization. Please try again.');
      }
    } finally {
      setIsSummarizing(false);
    }
  };

  const resetApp = () => {
    setAudioFile(null);
    setTranscription('');
    setTranscriptionData(null);
    setSummary('');
    setError('');
  };

  const parseMarkdownToSegments = (markdown: string) => {
    if (!markdown) return [];
    
    // Split by speaker headers like **[00:00 - 00:15] Speaker 1**
    const blockRegex = /\*\*\[(.*?)\] (.*?)\*\*(.*?)\n([\s\S]*?)(?=\*\*\[|$)/g;
    const segments = [];
    let match;
    
    while ((match = blockRegex.exec(markdown)) !== null) {
      const timestamp = match[1].trim();
      const speaker = match[2].trim();
      const meta = match[3].trim();
      let contentAndTranslation = match[4].trim();
      
      let emotion = '';
      let language = '';
      
      const emotionMatch = meta.match(/\*\(Emotion:\s*(.*?)\)\*/i);
      if (emotionMatch) emotion = emotionMatch[1];
      
      const langMatch = meta.match(/\*\[Language:\s*(.*?)\]\*/i);
      if (langMatch) language = langMatch[1];
      
      let content = contentAndTranslation;
      let translation = '';
      
      const transSplit = contentAndTranslation.split(/> \*\*Translation:\*\*/i);
      if (transSplit.length > 1) {
        content = transSplit[0].trim();
        translation = transSplit[1].trim();
      } else {
        // Attempt another common pattern just in case
        const transSplit2 = contentAndTranslation.split(/\nTranslation:\s*/i);
        if (transSplit2.length > 1) {
          content = transSplit2[0].trim();
          translation = transSplit2[1].trim();
        }
      }
      
      segments.push({ speaker, timestamp, content, language, emotion, translation });
    }
    
    return segments;
  };

  const currentSegments = (transcriptionData && transcriptionData.segments) 
    ? transcriptionData.segments 
    : parseMarkdownToSegments(transcription);

  return (
    <div className="h-[100dvh] overflow-hidden bg-[#FAFAFA] text-zinc-900 font-sans selection:bg-zinc-200 flex flex-col">
      <main className="flex-1 min-h-0 w-full max-w-5xl mx-auto px-4 py-4 md:py-6 flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center mb-4 md:mb-6 space-y-2 max-w-2xl shrink-0">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-100 border border-zinc-200 text-xs font-medium text-zinc-600 mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Powered by Gemini 3.1 Pro</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
            Turn audio into text with incredible accuracy
          </h1>
          <p className="text-sm sm:text-base text-zinc-500 leading-relaxed hidden sm:block">
            Whether it's a podcast, a meeting or an interview, our advanced speech-to-text model transcribes your audio with incredible accuracy in seconds.
          </p>
        </div>

        {/* Main Interaction Area */}
        <div className="flex-1 min-h-0 w-full bg-white rounded-[2rem] shadow-sm border border-zinc-200 overflow-hidden flex flex-col">
          
          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-red-50 border-b border-red-100 p-4 flex items-start gap-3 text-red-800"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}
          </AnimatePresence>

          {!transcription && !isTranscribing ? (
            <div className="flex-1 min-h-0 p-4 sm:p-6 md:p-8 flex flex-col items-center justify-center overflow-y-auto">
              
              {!audioFile && !isRecording ? (
                <div className="w-full max-w-4xl flex flex-col h-full">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-12 items-center flex-1">
                    {/* Left Column: Inputs */}
                    <div className="space-y-4 sm:space-y-6 order-2 md:order-1">
                      <div className="space-y-1 sm:space-y-2">
                        <h3 className="text-base sm:text-lg font-medium text-zinc-900">Audio Details</h3>
                        <p className="text-xs sm:text-sm text-zinc-500">Provide context to improve transcription accuracy.</p>
                      </div>
                      <div className="space-y-4 sm:space-y-5">
                        <div className="space-y-1.5 sm:space-y-2">
                          <label htmlFor="fileName" className="block text-xs sm:text-sm font-medium text-zinc-700">Audio Name (Optional)</label>
                          <input
                            id="fileName"
                            type="text"
                            value={fileName}
                            onChange={(e) => setFileName(e.target.value)}
                            placeholder="e.g., Q3 Earnings Call"
                            className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow"
                          />
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <label htmlFor="audioType" className="block text-xs sm:text-sm font-medium text-zinc-700">Audio Type</label>
                          <select
                            id="audioType"
                            value={audioType}
                            onChange={(e) => setAudioType(e.target.value)}
                            className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow bg-white"
                          >
                            <option value="meeting">Meeting</option>
                            <option value="podcast">Podcast</option>
                            <option value="interview">Interview</option>
                            <option value="song">Song</option>
                            <option value="custom">Custom</option>
                          </select>
                        </div>
                        <div className="space-y-1.5 sm:space-y-2">
                          <label htmlFor="model" className="block text-xs sm:text-sm font-medium text-zinc-700">AI Model</label>
                          <select
                            id="model"
                            value={model}
                            onChange={(e) => setModel(e.target.value)}
                            className="w-full px-3 py-2.5 sm:px-4 sm:py-3 text-sm sm:text-base border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition-shadow bg-white"
                          >
                            <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Most Accurate, Lower Limits)</option>
                            <option value="gemini-3-flash-preview">Gemini 3.0 Flash (Fastest)</option>
                            <option value="gemini-2.5-pro">Gemini 2.5 Pro</option>
                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                            <option value="gemini-2.0-flash-lite-preview-02-05">Gemini 2.0 Flash Lite</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: Upload/Record */}
                    <div className="space-y-4 sm:space-y-6 order-1 md:order-2 bg-zinc-50/50 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-zinc-100">
                      {/* Dropzone */}
                      <div 
                        {...getRootProps()} 
                        className={`border-2 border-dashed rounded-xl sm:rounded-2xl p-6 sm:p-8 text-center cursor-pointer transition-colors ${
                          isDragActive ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-200 hover:border-zinc-300 hover:bg-white bg-white'
                        }`}
                      >
                        <input {...getInputProps()} />
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-zinc-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                          <Upload className="w-5 h-5 sm:w-6 sm:h-6 text-zinc-600" />
                        </div>
                        <p className="text-sm font-medium text-zinc-900 mb-1">
                          Choose a file or drag & drop it here
                        </p>
                        <p className="text-xs text-zinc-500">
                          MP3, WAV, M4A, OGG up to 50MB
                        </p>
                      </div>

                      <div className="relative flex items-center py-1 sm:py-2">
                        <div className="flex-grow border-t border-zinc-200"></div>
                        <span className="flex-shrink-0 mx-4 text-[10px] sm:text-xs font-medium text-zinc-400 uppercase tracking-wider">Or</span>
                        <div className="flex-grow border-t border-zinc-200"></div>
                      </div>

                      {/* Record Button */}
                      <button 
                        onClick={startRecording}
                        className="w-full flex items-center justify-center gap-2 py-3 sm:py-4 rounded-xl sm:rounded-2xl border border-zinc-200 bg-white hover:bg-zinc-50 transition-colors text-sm sm:text-base font-medium text-zinc-700 shadow-sm"
                      >
                        <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                        Record Audio
                      </button>
                    </div>
                  </div>
                  
                  {/* Disclaimer */}
                  <div className="mt-6 sm:mt-8 text-center px-4">
                    <p className="text-[10px] sm:text-xs text-zinc-400 max-w-2xl mx-auto leading-relaxed">
                      <span className="font-medium text-zinc-500">Privacy Notice:</span> Your uploaded files are not saved permanently. We temporarily process them to provide the transcription and summary, and may use anonymized data to improve our services.
                    </p>
                  </div>
                </div>
              ) : isRecording ? (
                <div className="flex flex-col items-center justify-center space-y-8">
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-20"></div>
                    <div className="w-24 h-24 bg-red-50 rounded-full flex items-center justify-center border-4 border-red-100 relative z-10">
                      <Mic className="w-8 h-8 text-red-500" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-sm font-medium text-zinc-500 uppercase tracking-widest">Recording</p>
                    <p className="text-4xl font-mono font-light tracking-tight">{formatTime(recordingTime)}</p>
                  </div>
                  <button 
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-full font-medium hover:bg-zinc-800 transition-colors"
                  >
                    <Square className="w-4 h-4 fill-current" />
                    Stop Recording
                  </button>
                </div>
              ) : (
                <div className="w-full max-w-md flex flex-col items-center text-center space-y-6">
                  <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center text-green-600 mb-2">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-zinc-900 mb-1">Audio Ready</h3>
                    <p className="text-sm text-zinc-500">{audioFile?.name} ({(audioFile!.size / 1024 / 1024).toFixed(2)} MB)</p>
                  </div>
                  <div className="flex gap-3 w-full">
                    <button 
                      onClick={resetApp}
                      className="flex-1 py-3 rounded-xl border border-zinc-200 font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleTranscribe}
                      className="flex-1 py-3 rounded-xl bg-zinc-900 text-white font-medium hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2"
                    >
                      Transcribe <Sparkles className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : isTranscribing ? (
            <div className="flex-1 min-h-0 p-8 flex flex-col items-center justify-center space-y-6 w-full bg-white rounded-3xl">
              <Loader2 className="w-10 h-10 text-zinc-900 animate-spin" />
              <div className="text-center space-y-2 w-full max-w-xs">
                <h3 className="text-lg font-medium text-zinc-900">Transcribing your audio...</h3>
                <p className="text-sm text-zinc-500 mb-4">
                  {estimatedTimeLeft !== null ? `Estimated time left: ~${estimatedTimeLeft}s` : 'This usually takes a few seconds.'}
                </p>
                <div className="w-full bg-zinc-100 rounded-full h-2 overflow-hidden">
                  <motion.div 
                    className="bg-zinc-900 h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ ease: "linear", duration: 0.5 }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-zinc-200">
              {/* Transcription Result */}
              <div className="flex-1 min-h-0 p-4 md:p-6 flex flex-col">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <FileText className="w-5 h-5 text-zinc-400" />
                    Transcription
                  </h3>
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => copyToClipboard(transcription)}
                      className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 shadow-sm bg-white"
                      title="Copy to clipboard"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Copy</span>
                    </button>
                    <button 
                      onClick={resetApp}
                      className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 shadow-sm bg-white"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Start Over
                    </button>
                  </div>
                </div>

                {audioUrl && (
                  <div className="mb-4 shrink-0 flex flex-col gap-2">
                    {/* Hidden Audio Element */}
                    <audio 
                      ref={audioRef} 
                      src={audioUrl} 
                      className="hidden" 
                      onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                      onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
                      onPlay={() => setIsPlaying(true)}
                      onPause={() => setIsPlaying(false)}
                      onEnded={() => setIsPlaying(false)}
                    />
                    
                    {/* Custom Audio Player */}
                    <div className="flex flex-wrap items-center gap-3 bg-zinc-50 p-2.5 sm:p-3 rounded-xl border border-zinc-200">
                      <button 
                        onClick={togglePlay} 
                        className="w-10 h-10 flex shrink-0 items-center justify-center bg-zinc-900 text-white rounded-full hover:bg-zinc-800 transition-colors shadow-sm"
                        title="Play/Pause (Space)"
                      >
                        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
                      </button>
                      
                      <div className="flex-1 min-w-[120px] flex items-center gap-2">
                        <span className="text-xs font-medium font-mono text-zinc-500 w-10 text-right shrink-0">{formatTime(currentTime)}</span>
                        <input 
                          type="range" 
                          min="0" max={duration || 100} 
                          value={currentTime} 
                          onChange={(e) => {
                            const newTime = Number(e.target.value);
                            setCurrentTime(newTime);
                            if (audioRef.current) audioRef.current.currentTime = newTime;
                          }}
                          className="flex-1 accent-zinc-900 cursor-pointer h-1.5 bg-zinc-200 rounded-full appearance-none min-w-0" 
                        />
                        <span className="text-xs font-medium font-mono text-zinc-500 w-10 shrink-0">{formatTime(duration)}</span>
                      </div>

                      <div className="flex items-center gap-3 w-full sm:w-auto mt-2 sm:mt-0 justify-between sm:justify-end border-t sm:border-t-0 sm:border-l border-zinc-200 pt-2 sm:pt-0 sm:pl-3">
                        {/* Speed Dropdown */}
                        <select 
                          value={playbackRate} 
                          onChange={e => {
                            const rate = Number(e.target.value);
                            setPlaybackRate(rate);
                            if (audioRef.current) audioRef.current.playbackRate = rate;
                          }}
                          className="text-xs font-medium border border-zinc-200 rounded-md py-1.5 pl-2 pr-6 bg-white focus:outline-none focus:ring-1 focus:ring-zinc-900 appearance-none bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%2371717a%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpolyline%20points%3D%226%209%2012%2015%2018%209%22%3E%3C%2Fpolyline%3E%3C%2Fsvg%3E')] bg-no-repeat bg-[right_4px_center]"
                          title="Playback Speed"
                        >
                          <option value="0.5">0.5x</option>
                          <option value="1">1.0x</option>
                          <option value="1.5">1.5x</option>
                          <option value="2">2.0x</option>
                        </select>

                        {/* Volume Slider */}
                        <div className="flex items-center gap-1.5 w-24">
                           {volume === 0 ? <VolumeX className="w-4 h-4 text-zinc-400 shrink-0" /> : <Volume2 className="w-4 h-4 text-zinc-400 shrink-0" />}
                           <input 
                             type="range" min="0" max="1" step="0.05" value={volume} 
                             onChange={(e) => {
                               const v = Number(e.target.value);
                               setVolume(v);
                               if (audioRef.current) audioRef.current.volume = v;
                             }}
                             className="w-full accent-zinc-900 cursor-pointer h-1.5 bg-zinc-200 rounded-full appearance-none"
                             title="Volume"
                           />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {showTooltips && currentSegments?.length > 0 && (
                  <AnimatePresence>
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}
                      className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-3 mb-4 flex items-start gap-3 relative shadow-sm shrink-0"
                    >
                      <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold mb-1">Navigation Tips</p>
                        <ul className="list-disc list-inside space-y-0.5 text-blue-700/80">
                          <li>Click on any timestamp to jump right to that part of the audio.</li>
                          <li>Press <kbd className="bg-white border text-blue-900 border-blue-200 px-1 py-0.5 rounded text-xs">Spacebar</kbd> to play/pause.</li>
                          <li>Use <kbd className="bg-white border text-blue-900 border-blue-200 px-1 py-0.5 rounded text-xs">&larr;</kbd> and <kbd className="bg-white border text-blue-900 border-blue-200 px-1 py-0.5 rounded text-xs">&rarr;</kbd> arrows to seek 10s.</li>
                        </ul>
                      </div>
                      <button onClick={dismissTooltips} className="absolute top-3 right-3 text-blue-400 hover:text-blue-700">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  </AnimatePresence>
                )}

                <div className="flex-1 min-h-0 mb-4 overflow-y-auto pr-2">
                  {currentSegments && currentSegments.length > 0 ? (
                    <div className="space-y-4">
                      {currentSegments.map((segment: any, idx: number) => (
                        <TranscriptionSegmentCard key={idx} segment={segment} onSeek={handleSeek} currentTime={currentTime} />
                      ))}
                    </div>
                  ) : (
                    <div className="prose prose-zinc max-w-none prose-p:leading-relaxed prose-p:text-zinc-800 prose-strong:text-zinc-900 prose-strong:font-semibold">
                      <Markdown>{transcription}</Markdown>
                    </div>
                  )}
                </div>

                <div className="space-y-3 shrink-0">
                  <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Export As</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <button onClick={() => exportToTXT(transcription, `${getExportFileName('transcript')}.txt`)} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 transition-colors group">
                      <FileText className="w-6 h-6 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                      <span className="text-xs font-medium text-zinc-600 group-hover:text-zinc-900">TXT</span>
                    </button>
                    <button onClick={() => exportToWord(transcription, `${getExportFileName('transcript')}.docx`)} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-blue-600 hover:bg-blue-50 transition-colors group">
                      <FileType2 className="w-6 h-6 text-zinc-400 group-hover:text-blue-600 transition-colors" />
                      <span className="text-xs font-medium text-zinc-600 group-hover:text-blue-600">DOCX</span>
                    </button>
                    <button onClick={() => exportToPDF(transcription, `${getExportFileName('transcript')}.pdf`)} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-red-600 hover:bg-red-50 transition-colors group">
                      <File className="w-6 h-6 text-zinc-400 group-hover:text-red-600 transition-colors" />
                      <span className="text-xs font-medium text-zinc-600 group-hover:text-red-600">PDF</span>
                    </button>
                    <button onClick={() => exportToJSON(transcription, `${getExportFileName('transcript')}.json`)} className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-zinc-200 hover:border-yellow-600 hover:bg-yellow-50 transition-colors group">
                      <FileJson className="w-6 h-6 text-zinc-400 group-hover:text-yellow-600 transition-colors" />
                      <span className="text-xs font-medium text-zinc-600 group-hover:text-yellow-600">JSON</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Summary Section */}
              <div className="w-full md:w-80 lg:w-96 p-4 md:p-6 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-zinc-400" />
                    AI Summary
                  </h3>
                  <div className="flex items-center gap-3">
                    {summary && !isSummarizing && (
                      <button 
                        onClick={() => copyToClipboard(summary)}
                        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 transition-colors flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 shadow-sm bg-white"
                        title="Copy to clipboard"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Copy</span>
                      </button>
                    )}
                    <select
                      value={summaryLanguage}
                      onChange={(e) => setSummaryLanguage(e.target.value)}
                      className="text-sm border border-zinc-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-zinc-900 text-zinc-700 font-medium cursor-pointer"
                      disabled={isSummarizing}
                    >
                      <option value="English">English</option>
                      <option value="Malay">Malay</option>
                    </select>
                  </div>
                </div>

                {!summary && !isSummarizing ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4 py-12">
                    <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm">
                      <Wand2 className="w-6 h-6 text-zinc-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-zinc-900 mb-1">Too long to read?</p>
                      <p className="text-xs text-zinc-500 max-w-[200px] mx-auto">Generate a concise summary of your transcription instantly.</p>
                    </div>
                    <button 
                      onClick={handleSummarize}
                      className="px-5 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-full hover:bg-zinc-800 transition-colors flex items-center gap-2"
                    >
                      Generate Summary
                    </button>
                  </div>
                ) : isSummarizing ? (
                  <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12 w-full">
                    <Loader2 className="w-8 h-8 text-zinc-900 animate-spin" />
                    <div className="text-center space-y-2 w-full max-w-[200px]">
                      <p className="text-sm font-medium text-zinc-600 mb-2">
                        {estimatedSummaryTimeLeft !== null ? `Analyzing... ~${estimatedSummaryTimeLeft}s` : 'Analyzing content...'}
                      </p>
                      <div className="w-full bg-zinc-200 rounded-full h-1.5 overflow-hidden">
                        <motion.div 
                          className="bg-zinc-900 h-full rounded-full"
                          initial={{ width: 0 }}
                          animate={{ width: `${progress}%` }}
                          transition={{ ease: "linear", duration: 0.5 }}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 min-h-0 bg-zinc-50 rounded-xl p-4 md:p-6 border border-zinc-100 mb-4 overflow-y-auto">
                      <div className="prose prose-sm prose-zinc max-w-none prose-p:leading-relaxed prose-p:text-zinc-800 prose-strong:text-zinc-900 prose-strong:font-semibold">
                        <Markdown>{summary}</Markdown>
                      </div>
                    </div>
                    
                    <button 
                      onClick={handleSummarize}
                      className="w-full py-2.5 mb-3 rounded-xl bg-zinc-900 text-white font-medium text-sm hover:bg-zinc-800 transition-colors flex items-center justify-center gap-2 shrink-0"
                    >
                      <Sparkles className="w-4 h-4" />
                      Regenerate Summary
                    </button>

                    <div className="space-y-2 shrink-0">
                      <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Export Summary As</p>
                      <div className="grid grid-cols-4 gap-2">
                        <button onClick={() => exportToTXT(summary, `${getExportFileName('summary')}.txt`)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-zinc-200 hover:border-zinc-900 hover:bg-zinc-50 transition-colors group">
                          <FileText className="w-4 h-4 text-zinc-400 group-hover:text-zinc-900 transition-colors" />
                          <span className="text-[10px] font-medium text-zinc-600 group-hover:text-zinc-900">TXT</span>
                        </button>
                        <button onClick={() => exportToWord(summary, `${getExportFileName('summary')}.docx`)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-zinc-200 hover:border-blue-600 hover:bg-blue-50 transition-colors group">
                          <FileType2 className="w-4 h-4 text-zinc-400 group-hover:text-blue-600 transition-colors" />
                          <span className="text-[10px] font-medium text-zinc-600 group-hover:text-blue-600">DOCX</span>
                        </button>
                        <button onClick={() => exportToPDF(summary, `${getExportFileName('summary')}.pdf`)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-zinc-200 hover:border-red-600 hover:bg-red-50 transition-colors group">
                          <File className="w-4 h-4 text-zinc-400 group-hover:text-red-600 transition-colors" />
                          <span className="text-[10px] font-medium text-zinc-600 group-hover:text-red-600">PDF</span>
                        </button>
                        <button onClick={() => exportToJSON(summary, `${getExportFileName('summary')}.json`)} className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg border border-zinc-200 hover:border-yellow-600 hover:bg-yellow-50 transition-colors group">
                          <FileJson className="w-4 h-4 text-zinc-400 group-hover:text-yellow-600 transition-colors" />
                          <span className="text-[10px] font-medium text-zinc-600 group-hover:text-yellow-600">JSON</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Onboard Modal */}
      <AnimatePresence>
        {showOnboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-8 relative overflow-hidden"
            >
              <button
                onClick={closeOnboard}
                className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-900 transition-colors rounded-full hover:bg-zinc-100"
              >
                <X className="w-5 h-5" />
              </button>
              
              <div className="w-12 h-12 bg-zinc-100 rounded-2xl flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-zinc-900" />
              </div>
              
              <h2 className="text-2xl font-semibold text-zinc-900 mb-2">Welcome to AudioScribe</h2>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                Transform your audio into accurate text in seconds. Perfect for meetings, podcasts, interviews, and more.
              </p>
              
              <div className="space-y-6 mb-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Upload className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 mb-1">Upload or Record</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">Drop an audio file or record directly in your browser.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center shrink-0 mt-0.5">
                    <FileText className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 mb-1">Smart Transcription</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">Automatically formats speakers for meetings and podcasts.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center shrink-0 mt-0.5">
                    <Wand2 className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-zinc-900 mb-1">AI Summaries</h4>
                    <p className="text-sm text-zinc-500 leading-relaxed">Get instant summaries of your transcripts in multiple languages.</p>
                  </div>
                </div>
              </div>
              
              <button
                onClick={closeOnboard}
                className="w-full py-3.5 bg-zinc-900 text-white rounded-xl font-medium hover:bg-zinc-800 transition-colors shadow-sm"
              >
                Get Started
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const SPEAKER_COLORS = [
  'bg-blue-100 text-blue-700 border border-blue-200',
  'bg-emerald-100 text-emerald-700 border border-emerald-200',
  'bg-purple-100 text-purple-700 border border-purple-200',
  'bg-amber-100 text-amber-700 border border-amber-200',
  'bg-rose-100 text-rose-700 border border-rose-200',
  'bg-cyan-100 text-cyan-700 border border-cyan-200',
  'bg-indigo-100 text-indigo-700 border border-indigo-200',
  'bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200',
];

const getSpeakerColorClass = (speaker: string) => {
  let hash = 0;
  for (let i = 0; i < speaker.length; i++) {
    hash = speaker.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % SPEAKER_COLORS.length;
  return SPEAKER_COLORS[index];
};

const timeToSeconds = (timeStr: string) => {
  const parts = timeStr.trim().split(':');
  let seconds = 0;
  if (parts.length === 2) {
    seconds = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  } else if (parts.length === 3) {
    seconds = parseInt(parts[0], 10) * 3600 + parseInt(parts[1], 10) * 60 + parseInt(parts[2], 10);
  }
  return isNaN(seconds) ? 0 : seconds;
};

const TranscriptionSegmentCard = ({ segment, onSeek, currentTime }: { segment: any, onSeek: (time: string) => void, currentTime: number }) => {
  const [showTranslation, setShowTranslation] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const wasActive = useRef(false);
  
  // Calculate if active
  const startTimeStr = segment.timestamp ? segment.timestamp.split('-')[0].trim() : '';
  const endTimeStr = segment.timestamp && segment.timestamp.includes('-') ? segment.timestamp.split('-')[1].trim() : null;
  
  const startSecs = timeToSeconds(startTimeStr);
  const endSecs = endTimeStr ? timeToSeconds(endTimeStr) : (startSecs + 15);
  
  // Define active state logic: if the current playback time is within this segment's window
  const isActive = currentTime >= startSecs && currentTime < endSecs;

  useEffect(() => {
    if (isActive && !wasActive.current) {
      // Small timeout to let any layout shifts settle
      setTimeout(() => {
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
    }
    wasActive.current = isActive;
  }, [isActive]);

  return (
    <div ref={cardRef} className={`bg-white rounded-xl border transition-all duration-300 overflow-hidden shadow-sm ${isActive ? 'ring-2 ring-zinc-900 border-zinc-900' : 'border-zinc-200'}`}>
      <div className={`p-4 sm:p-5 transition-colors duration-300 ${isActive ? 'bg-zinc-50' : ''}`}>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-4">
          {segment.speaker && (
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${getSpeakerColorClass(segment.speaker)}`}>
              <User className="w-3.5 h-3.5" />
              {segment.speaker}
            </div>
          )}
          {segment.timestamp && (
            <button 
              onClick={() => onSeek(segment.timestamp)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-colors text-xs font-medium cursor-pointer ${isActive ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 hover:text-zinc-900'}`}
              title="Click to play from this timestamp"
            >
              <Clock className="w-3.5 h-3.5" />
              {segment.timestamp}
            </button>
          )}
          {segment.language && segment.language.toLowerCase() !== 'english' && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium">
              <Globe className="w-3.5 h-3.5" />
              {segment.language}
            </div>
          )}
          {segment.emotion && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-medium">
              <Smile className="w-3.5 h-3.5" />
              {segment.emotion}
            </div>
          )}
        </div>
        <p className="text-zinc-800 leading-relaxed text-sm sm:text-base">
          {segment.content}
        </p>
      </div>
      
      {segment.translation && (
        <div className="border-t border-zinc-100">
          <button 
            onClick={() => setShowTranslation(!showTranslation)}
            className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-zinc-600 hover:bg-zinc-50 transition-colors uppercase tracking-wider"
          >
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4" />
              English Translation
            </div>
            {showTranslation ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          
          <AnimatePresence>
            {showTranslation && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 pt-1">
                  <p className="text-zinc-600 italic text-sm sm:text-base leading-relaxed">
                    {segment.translation}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
