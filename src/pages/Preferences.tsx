import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Loader2, Home, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { z } from "zod";

const preferencesSchema = z.object({
  homeAddress: z.string().trim().min(1, "Home address is required").max(500),
});

const TRAVEL_INTERESTS = [
  { id: "cultural", label: "Cultural Sites", icon: "🏛️" },
  { id: "nature", label: "Nature & Parks", icon: "🌲" },
  { id: "adventure", label: "Adventure Sports", icon: "🏔️" },
  { id: "food", label: "Food & Dining", icon: "🍽️" },
  { id: "shopping", label: "Shopping", icon: "🛍️" },
  { id: "nightlife", label: "Nightlife", icon: "🌃" },
  { id: "beach", label: "Beaches", icon: "🏖️" },
  { id: "history", label: "Historical", icon: "📜" },
];

const LANGUAGES = [
  { code: "en-US", name: "English (US)", flag: "🇺🇸" },
  { code: "en-GB", name: "English (UK)", flag: "🇬🇧" },
  { code: "es-ES", name: "Spanish", flag: "🇪🇸" },
  { code: "fr-FR", name: "French", flag: "🇫🇷" },
  { code: "de-DE", name: "German", flag: "🇩🇪" },
  { code: "it-IT", name: "Italian", flag: "🇮🇹" },
  { code: "pt-BR", name: "Portuguese", flag: "🇧🇷" },
  { code: "ja-JP", name: "Japanese", flag: "🇯🇵" },
  { code: "zh-CN", name: "Chinese", flag: "🇨🇳" },
  { code: "ko-KR", name: "Korean", flag: "🇰🇷" },
  { code: "ar-SA", name: "Arabic", flag: "🇸🇦" },
  { code: "hi-IN", name: "Hindi", flag: "🇮🇳" },
];

const Preferences = () => {
  const [homeAddress, setHomeAddress] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [preferredLanguage, setPreferredLanguage] = useState("en-US");
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('home_address, travel_preferences, preferred_language')
        .eq('user_id', session.user.id)
        .single();

      if (profile) {
        if (profile.home_address) setHomeAddress(profile.home_address);
        if (profile.preferred_language) setPreferredLanguage(profile.preferred_language);
        if (profile.travel_preferences && typeof profile.travel_preferences === 'object') {
          const prefs = profile.travel_preferences as { interests?: string[] };
          if (prefs.interests) {
            setSelectedInterests(prefs.interests);
          }
        }
      }
      setIsLoadingProfile(false);
    };

    loadProfile();
  }, [navigate]);

  const toggleInterest = (interestId: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((id) => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      preferencesSchema.parse({ homeAddress });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: "Validation Error",
          description: error.errors[0].message,
          variant: "destructive",
        });
        return;
      }
    }

    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate('/auth');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          home_address: homeAddress.trim(),
          preferred_language: preferredLanguage,
          travel_preferences: {
            interests: selectedInterests,
          },
        })
        .eq('user_id', session.user.id);

      if (error) throw error;

      toast({
        title: "Preferences Saved!",
        description: "Your travel preferences have been updated.",
      });

      navigate('/');
    } catch (error: any) {
      console.error('Error saving preferences:', error);
      toast({
        title: "Error",
        description: "Failed to save preferences. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoadingProfile) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gradient-to-br from-background via-primary/5 to-secondary/10">
      <div className="max-w-2xl mx-auto py-8">
        <Card className="p-6 md:p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Home className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold">Set Your Preferences</h1>
            <p className="text-muted-foreground">
              Help us personalize your travel experience
            </p>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="homeAddress" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Home Address
              </Label>
              <Input
                id="homeAddress"
                placeholder="e.g., New York, USA"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                required
                disabled={isLoading}
                className="h-12"
              />
              <p className="text-xs text-muted-foreground">
                Your home address will be used to calculate return journeys
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="language">Preferred Language</Label>
              <select
                id="language"
                value={preferredLanguage}
                onChange={(e) => setPreferredLanguage(e.target.value)}
                disabled={isLoading}
                className="w-full h-12 px-3 rounded-md border border-input bg-background text-foreground"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Used for voice input/output and text display
              </p>
            </div>

            <div className="space-y-3">
              <Label>Travel Interests (Optional)</Label>
              <p className="text-sm text-muted-foreground">
                Select what you enjoy to get better recommendations
              </p>
              <div className="grid grid-cols-2 gap-2">
                {TRAVEL_INTERESTS.map((interest) => (
                  <button
                    key={interest.id}
                    type="button"
                    onClick={() => toggleInterest(interest.id)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      selectedInterests.includes(interest.id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50"
                    }`}
                    disabled={isLoading}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{interest.icon}</span>
                      <span className="text-sm font-medium flex-1 text-left">
                        {interest.label}
                      </span>
                      {selectedInterests.includes(interest.id) && (
                        <CheckCircle className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save Preferences</>
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};

export default Preferences;
