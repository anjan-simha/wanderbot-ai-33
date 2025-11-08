import { useState, ChangeEvent, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, Loader2, Image as ImageIcon, Camera, TrendingUp, Volume2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useUserLanguage } from "@/hooks/useUserLanguage";

const ImageMode = () => {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [confidence, setConfidence] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const { language } = useUserLanguage();

  const speakResponse = (text: string) => {
    if ('speechSynthesis' in window) {
      setIsSpeaking(true);
      
      const speak = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.85;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        const voices = window.speechSynthesis.getVoices();
        const langCode = language.split('-')[0];
        
        const perfectMatch = voices.find(v => v.lang === language);
        const langMatch = voices.find(v => v.lang.startsWith(langCode));
        const defaultVoice = voices.find(v => v.default);
        
        utterance.voice = perfectMatch || langMatch || defaultVoice || voices[0];
        
        utterance.onend = () => setIsSpeaking(false);
        utterance.onerror = () => setIsSpeaking(false);
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      };
      
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

  const handleImageUpload = (e: ChangeEvent<HTMLInputElement>, fromCamera: boolean = false) => {
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
        // Use location verification for camera captures
        analyzeImage(base64String, fromCamera);
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

  const analyzeImage = async (imageData: string, useLocation: boolean = false) => {
    setIsLoading(true);
    setResult("");

    try {
      let location = null;
      
      // Get GPS location if requested (from Capture)
      if (useLocation && 'geolocation' in navigator) {
        try {
          const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true,
              timeout: 5000,
            });
          });
          
          location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          };
          
          toast({
            title: "Location obtained",
            description: "Using your location to verify landmark",
          });
        } catch (geoError) {
          console.log('Location not available:', geoError);
          // Continue without location
        }
      }

      const { data, error } = await supabase.functions.invoke('analyze-landmark', {
        body: { 
          imageData,
          location,
          includeWikipedia: true,
        },
      });

      if (error) throw error;

      const landmarkInfo = data.analysis;
      setResult(landmarkInfo);
      
      // Extract confidence if present in response
      if (data.confidence) {
        setConfidence(data.confidence);
      }
      
      // Speak the result
      speakResponse(landmarkInfo);
      
      toast({
        title: "Analysis complete",
        description: "Landmark identified successfully",
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
              onChange={(e) => handleImageUpload(e, false)}
              className="hidden"
              disabled={isLoading}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => handleImageUpload(e, true)}
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
          <div className="p-4 bg-accent/5 rounded-lg border border-accent/20 animate-fade-in space-y-2">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-accent" />
                <h3 className="font-semibold text-sm">Landmark Information:</h3>
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
            <p className="text-sm leading-relaxed">{result}</p>
            {confidence && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t border-accent/20">
                <TrendingUp className="w-4 h-4" />
                <span>Confidence: {(confidence * 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
};

export default ImageMode;
