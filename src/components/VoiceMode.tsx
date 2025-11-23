import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Volume2, Loader2, MicOff, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserLanguage } from "@/hooks/useUserLanguage";
import { saveSpeechState, loadSpeechState, clearSpeechState, updatePauseState } from "@/lib/speechPersistence";

const VoiceMode = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const [canResume, setCanResume] = useState(false);
  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentTextRef = useRef<string>("");
  const { toast } = useToast();
  const { language, isLoading: isLanguageLoading } = useUserLanguage();

  // Check for saved speech state on mount
  useEffect(() => {
    const savedState = loadSpeechState();
    if (savedState && savedState.isPaused) {
      setResponse(savedState.text);
      currentTextRef.current = savedState.text;
      setCanResume(true);
      setIsPaused(true);
      
      toast({
        title: "Previous narration available",
        description: "You can resume your previous narration",
      });
    }
  }, []);

  // Initialize speech recognition with language support
  useEffect(() => {
    if (isLanguageLoading) return;

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    // Check microphone permission
    if (navigator.permissions) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setMicPermission(result.state as any);
        result.onchange = () => {
          setMicPermission(result.state as any);
        };
      }).catch(() => {
        setMicPermission('prompt');
      });
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = language;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      const confidence = event.results[0][0].confidence;
      
      console.log('Voice recognition result:', transcript, 'Confidence:', confidence, 'Language:', language);
      
      setQuery(transcript);
      handleQuery(transcript);
      setIsListening(false);
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      
      if (event.error === 'not-allowed') {
        setMicPermission('denied');
        toast({
          title: "Microphone access denied",
          description: "Please enable microphone access or use text search.",
          variant: "destructive",
        });
      } else if (event.error === 'no-speech') {
        return;
      } else if (event.error === 'network') {
        toast({
          title: "Voice input unavailable",
          description: "Browser can't connect to speech service. Please use text search instead.",
          variant: "destructive",
        });
      } else if (event.error === 'aborted') {
        return;
      } else {
        toast({
          title: "Voice recognition error",
          description: "Please use the text search mode instead.",
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      // Pause speech instead of canceling on unmount
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        if (currentTextRef.current) {
          saveSpeechState(currentTextRef.current, language, true);
        }
      }
    };
  }, [language, isLanguageLoading]);

  // Handle page unload - save state instead of canceling
  useEffect(() => {
    const handleBeforeUnload = () => {
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        if (currentTextRef.current) {
          saveSpeechState(currentTextRef.current, language, true);
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        setIsPaused(true);
        setCanResume(true);
        if (currentTextRef.current) {
          saveSpeechState(currentTextRef.current, language, true);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [language]);

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setIsLoading(true);
    setResponse("");

    try {
      const { data, error } = await supabase.functions.invoke('handle-text-query', {
        body: { query: queryText },
      });

      if (error) throw error;

      const textResponse = data.response;
      setResponse(textResponse);
      speakResponse(textResponse);
    } catch (error) {
      console.error('Error analyzing landmark:', error);
      toast({
        title: "Error",
        description: "Failed to analyze. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startListening = () => {
    if (!isSupported) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Please use the Search tab.",
        variant: "destructive",
      });
      return;
    }

    if (micPermission === 'denied') {
      toast({
        title: "Microphone access required",
        description: "Please enable microphone access or use the Search tab.",
        variant: "destructive",
      });
      return;
    }

    if (recognitionRef.current && !isListening) {
      setQuery("");
      setResponse("");
      setIsListening(true);
      
      try {
        recognitionRef.current.start();
      } catch (error) {
        console.error('Failed to start recognition:', error);
        setIsListening(false);
        toast({
          title: "Voice recognition busy",
          description: "Please try again or use the Search tab.",
        });
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakResponse = (text: string, isResume: boolean = false) => {
    if ('speechSynthesis' in window) {
      currentTextRef.current = text;
      setIsSpeaking(true);
      setIsPaused(false);
      setCanResume(false);
      
      // Clear saved state when starting new speech
      if (!isResume) {
        clearSpeechState();
      }
      
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        utterance.lang = language;
        
        // Select best voice for language with quality prioritization
        const voices = window.speechSynthesis.getVoices();
        const langCode = language.split('-')[0];
        const fullLang = language;
        
        // Find best matching voice with quality prioritization
        const perfectMatch = voices.find(v => v.lang === fullLang && v.localService);
        const perfectMatchRemote = voices.find(v => v.lang === fullLang);
        const langMatch = voices.find(v => v.lang.startsWith(langCode) && v.localService);
        const langMatchRemote = voices.find(v => v.lang.startsWith(langCode));
        const defaultVoice = voices.find(v => v.default);
        
        // Prefer local, high-quality voices
        utterance.voice = perfectMatch || perfectMatchRemote || langMatch || langMatchRemote || defaultVoice || voices[0];
        
        console.log('Selected voice:', utterance.voice?.name, 'Lang:', utterance.voice?.lang, 'Language setting:', language);
        
        utterance.onend = () => {
          setIsSpeaking(false);
          setIsPaused(false);
          setCanResume(false);
          clearSpeechState();
        };
        
        utterance.onerror = (e) => {
          console.error('Speech synthesis error:', e);
          setIsSpeaking(false);
          setIsPaused(false);
          if (e.error !== 'interrupted') {
            toast({
              title: "Speech Error",
              description: "Failed to play narration. Please try again.",
              variant: "destructive",
            });
          }
        };
        
        utteranceRef.current = utterance;
        
        if (isResume) {
          window.speechSynthesis.resume();
        } else {
          window.speechSynthesis.cancel();
          window.speechSynthesis.speak(utterance);
        }
      };
      
      const voicesList = window.speechSynthesis.getVoices();
      if (voicesList.length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = () => {
          speak();
          window.speechSynthesis.onvoiceschanged = null;
        };
      }
    }
  };

  const pauseSpeaking = () => {
    if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsSpeaking(false);
      setIsPaused(true);
      setCanResume(true);
      if (currentTextRef.current) {
        saveSpeechState(currentTextRef.current, language, true);
      }
    }
  };

  const resumeSpeaking = () => {
    if ('speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsSpeaking(true);
      setIsPaused(false);
      setCanResume(false);
      updatePauseState(false);
    } else if (currentTextRef.current) {
      // If synthesis was canceled, restart from beginning
      speakResponse(currentTextRef.current, false);
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setIsPaused(false);
      setCanResume(false);
      clearSpeechState();
      currentTextRef.current = "";
    }
  };

  return (
    <div className="relative flex flex-col h-full w-full items-center justify-center bg-background p-4 md:p-6">
      <div className="space-y-6">

        <div className="flex flex-col items-center gap-6">
          {!isSupported && (
            <div className="p-4 bg-destructive/10 text-destructive rounded-lg text-sm text-center">
              <MicOff className="w-5 h-5 mx-auto mb-2" />
              Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.
            </div>
          )}
          
          <Button
            size="lg"
            onClick={isListening ? stopListening : startListening}
            disabled={!isSupported || isLoading}
            className="h-24 w-24 md:h-32 md:w-32 rounded-full shadow-elegant hover:shadow-glow transition-all"
          >
            {isListening ? (
              <Mic className="w-10 h-10 md:w-12 md:h-12 animate-pulse text-red-500" />
            ) : isLoading ? (
              <Loader2 className="w-10 h-10 md:w-12 md:h-12 animate-spin" />
            ) : (
              <Mic className="w-10 h-10 md:w-12 md:h-12" />
            )}
          </Button>

          <p className="text-sm text-muted-foreground text-center">
            {isListening ? "Listening..." : isLoading ? "Analyzing..." : "Tap to speak"}
          </p>
        </div>

        {query && (
          <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 animate-fade-in">
            <div className="flex items-center gap-2 mb-2">
              <Mic className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">You asked:</h3>
            </div>
            <p className="text-sm">{query}</p>
          </div>
        )}

        {response && (
          <div className="p-4 bg-accent/5 rounded-lg border border-accent/20 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-sm">Response:</h3>
              </div>
              <div className="flex gap-2">
                {isSpeaking && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={pauseSpeaking}
                    className="gap-1"
                  >
                    <Pause className="w-3 h-3" />
                    Pause
                  </Button>
                )}
                {(isPaused || canResume) && (
                  <Button
                    size="sm"
                    variant="default"
                    onClick={resumeSpeaking}
                    className="gap-1"
                  >
                    <Play className="w-3 h-3" />
                    Resume Narration
                  </Button>
                )}
                {(isSpeaking || isPaused || canResume) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={stopSpeaking}
                    className="gap-1"
                  >
                    <Volume2 className="w-3 h-3" />
                    Stop
                  </Button>
                )}
              </div>
            </div>
            <p className="text-sm leading-relaxed">{response}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default VoiceMode;
