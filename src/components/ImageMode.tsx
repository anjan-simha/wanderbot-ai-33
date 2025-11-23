import { useState, ChangeEvent, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, Image as ImageIcon, Camera, TrendingUp, Volume2, Play, Pause } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserLanguage } from "@/hooks/useUserLanguage";
import { saveSpeechState, loadSpeechState, clearSpeechState, updatePauseState } from "@/lib/speechPersistence";

const ImageMode = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [result, setResult] = useState<{
    name: string;
    summary: string;
    coordinates: { lat: number; lng: number };
    fun_facts: string[];
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [canResume, setCanResume] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const currentTextRef = useRef<string>("");
  const { toast } = useToast();
  const { language, isLoading: isLanguageLoading } = useUserLanguage();

  // Check for saved speech state on mount
  useEffect(() => {
    const savedState = loadSpeechState();
    if (savedState && savedState.isPaused) {
      setResult(savedState.text);
      currentTextRef.current = savedState.text;
      setCanResume(true);
      setIsPaused(true);
    }
  }, []);

  // Handle page unload and visibility changes - save state
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
      if ('speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.pause();
        if (currentTextRef.current) {
          saveSpeechState(currentTextRef.current, language, true);
        }
      }
    };
  }, [language]);

  const speakResponse = (text: string, isResume: boolean = false) => {
    if ('speechSynthesis' in window) {
      currentTextRef.current = text;
      setIsSpeaking(true);
      setIsPaused(false);
      setCanResume(false);
      
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
      
      if (window.speechSynthesis.getVoices().length > 0) {
        speak();
      } else {
        window.speechSynthesis.onvoiceschanged = speak;
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

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 20 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Please select an image smaller than 20MB.",
          variant: "destructive",
        });
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImage(base64String);
        analyzeImage(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCameraCapture = () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: "Camera not available",
        description: "Your device doesn't support camera capture. Please upload an image instead.",
        variant: "destructive",
      });
      return;
    }
    cameraInputRef.current?.click();
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const analyzeImage = async (imageData: string) => {
    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('analyze-landmark', {
        body: { image: imageData },
      });

      if (error) throw error;

      setResult(data);

      // Speak the summary
      if (data.summary) {
        speakResponse(data.summary);
      }

      toast({
        title: "Analysis complete",
        description: data.name || "Landmark identified",
      });

    } catch (error) {
      console.error('Error analyzing image:', error);
      toast({
        title: "Error",
        description: "Failed to analyze image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="p-6 md:p-8">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-2xl md:text-3xl font-bold">Landmark Recognition</h2>
          <p className="text-sm md:text-base text-muted-foreground">
            <strong>Capture:</strong> Use camera with GPS verification • <strong>Upload:</strong> Select from gallery
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex flex-col items-center gap-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isLoading}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageUpload}
              className="hidden"
              disabled={isLoading}
            />
            
            <div className="flex gap-3 w-full md:w-auto">
              <Button
                size="lg"
                className="h-16 flex-1 md:flex-none md:px-8"
                disabled={isLoading}
                onClick={handleCameraCapture}
              >
                <Camera className="w-5 h-5 mr-2" />
                Capture
              </Button>
              
              <Button
                size="lg"
                variant="outline"
                className="h-16 flex-1 md:flex-none md:px-8"
                disabled={isLoading}
                onClick={handleUploadClick}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </div>

            {selectedImage && (
              <div className="relative w-full max-w-md">
                <img
                  src={selectedImage}
                  alt="Selected landmark"
                  className="w-full rounded-lg border-2 border-border"
                />
                <Button
                  size="sm"
                  variant="secondary"
                  className="absolute top-2 right-2"
                  onClick={() => {
                    setSelectedImage(null);
                    setResult("");
                  }}
                >
                  Clear
                </Button>
              </div>
            )}
          </div>
        </div>

        {result && (
          <Card className="p-4 w-full animate-fade-in space-y-4 shadow-lg">
            <div>
              <h3 className="font-bold text-xl mb-2">{result.name}</h3>
              <p className="text-base leading-relaxed">{result.summary}</p>
            </div>

            <div>
              <h4 className="font-semibold text-lg mb-2">Fun Facts</h4>
              <ul className="list-disc list-inside space-y-1 text-base">
                {result.fun_facts.map((fact, index) => (
                  <li key={index}>{fact}</li>
                ))}
              </ul>
            </div>

            <Button
              onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${result.coordinates.lat},${result.coordinates.lng}`, '_blank')}
              className="w-full"
            >
              View on Map
            </Button>
          </Card>
        )}
      </div>
    </Card>
  );
};

export default ImageMode;
