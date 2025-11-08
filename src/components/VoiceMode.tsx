import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Mic, Volume2, Loader2, MicOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserLanguage } from "@/hooks/useUserLanguage";

const VoiceMode = () => {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [micPermission, setMicPermission] = useState<'granted' | 'denied' | 'prompt'>('prompt');
  const recognitionRef = useRef<any>(null);
  const { toast } = useToast();
  const { language } = useUserLanguage();

  useEffect(() => {
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
        // Permission API not supported, assume prompt
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
      
      console.log('Voice recognition result:', transcript, 'Confidence:', confidence);
      
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
        // User didn't speak - don't show error, just stop
        return;
      } else if (event.error === 'network') {
        // Network errors mean Google's servers are unreachable - don't retry
        toast({
          title: "Voice input unavailable",
          description: "Browser can't connect to speech service. Please use text search instead.",
          variant: "destructive",
        });
      } else if (event.error === 'aborted') {
        // User stopped listening, no error needed
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
    };
  }, []);

  const handleQuery = async (queryText: string) => {
    if (!queryText.trim()) return;

    setIsLoading(true);
    setResponse("");

    try {
      const { data, error } = await supabase.functions.invoke('analyze-landmark', {
        body: { query: queryText },
      });

      if (error) throw error;

      const landmarkInfo = data.analysis;
      setResponse(landmarkInfo);
      speakResponse(landmarkInfo);
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

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      
      // Wait for voices to load
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        // Select best voice for language
        const voices = window.speechSynthesis.getVoices();
        const langCode = language.split('-')[0];
        
        // Find best matching voice
        const perfectMatch = voices.find(v => v.lang === language);
        const langMatch = voices.find(v => v.lang.startsWith(langCode));
        const defaultVoice = voices.find(v => v.default);
        
        utterance.voice = perfectMatch || langMatch || defaultVoice || voices[0];
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.cancel(); // Clear queue
        window.speechSynthesis.speak(utterance);
      };
      
      // Ensure voices are loaded
      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = speak;
      }
    }
  };

  const stopSpeaking = () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  return (
    <Card className="p-6 md:p-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">Voice Query</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            Ask about any landmark or tourist attraction
          </p>
          {micPermission === 'denied' && (
            <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
              ⚠️ Microphone access denied. Please enable it in browser settings or use the Search tab.
            </div>
          )}
          {!isSupported && (
            <div className="p-3 bg-amber-500/10 text-amber-700 rounded-lg text-sm">
              💡 Voice input is not reliable in all browsers. We recommend using the Search tab for best results.
            </div>
          )}
        </div>

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
              {isSpeaking && (
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
            <p className="text-sm leading-relaxed">{response}</p>
          </div>
        )}
      </div>
    </Card>
  );
};

export default VoiceMode;
