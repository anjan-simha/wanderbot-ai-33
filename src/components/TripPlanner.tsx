import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, Star, Navigation, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

interface Destination {
  name: string;
  description: string;
  visitTime: number;
  rating: number;
  distanceFromSource: number;
  travelTimeFromSource: number;
  distanceToSource: number;
  category: string;
}

const TripPlanner = () => {
  const [startLocation, setStartLocation] = useState("");
  const [availableTime, setAvailableTime] = useState("");
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const generateItinerary = async () => {
    if (!startLocation || !availableTime) {
      toast({
        title: "Missing Information",
        description: "Please enter your location and available time.",
        variant: "destructive",
      });
      return;
    }

    const timeValue = parseFloat(availableTime);
    if (timeValue <= 0) {
      toast({
        title: "Invalid Time",
        description: "Please enter a valid time greater than 0.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('optimize-trip', {
        body: {
          startLocation,
          availableTime: timeValue,
        },
      });

      if (error) throw error;

      setResult(data);
      toast({
        title: "Itinerary Generated!",
        description: `Found ${data.optimizedRoute.length} perfect destinations for you`,
      });
    } catch (error) {
      console.error('Error generating itinerary:', error);
      toast({
        title: "Error",
        description: "Failed to generate itinerary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      cultural: "bg-primary/10 text-primary border-primary/20",
      nature: "bg-green-500/10 text-green-600 border-green-500/20",
      adventure: "bg-orange-500/10 text-orange-600 border-orange-500/20",
      food: "bg-red-500/10 text-red-600 border-red-500/20",
      shopping: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    };
    return colors[category] || "bg-accent/10 text-accent border-accent/20";
  };

  return (
    <div className="min-h-screen pb-6">
      <Card className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Sparkles className="w-6 h-6 text-primary" />
              <h2 className="text-2xl md:text-3xl font-bold">AI Trip Planner</h2>
            </div>
            <p className="text-sm md:text-base text-muted-foreground">
              Get personalized destination recommendations based on ratings, distance, and your available time
            </p>
          </div>

          {/* Input Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="start" className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Your Location
              </Label>
              <Input
                id="start"
                placeholder="e.g., Paris, France"
                value={startLocation}
                onChange={(e) => setStartLocation(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time" className="flex items-center gap-2">
                <Clock className="w-4 h-4" />
                Available Time (hours)
              </Label>
              <Input
                id="time"
                type="number"
                step="0.5"
                min="0.5"
                placeholder="e.g., 4"
                value={availableTime}
                onChange={(e) => setAvailableTime(e.target.value)}
                className="h-12 text-base"
              />
            </div>

            <Button
              onClick={generateItinerary}
              disabled={isLoading}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-background border-t-transparent mr-2" />
                  Generating Your Perfect Trip...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Itinerary
                </>
              )}
            </Button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4 animate-fade-in">
              {/* Summary Card */}
              <div className="p-4 bg-gradient-to-br from-primary/10 to-secondary/10 rounded-lg border border-primary/20">
                <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-primary" />
                  Trip Overview
                </h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Starting Point</p>
                    <p className="font-medium">{result.startLocation}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Destinations</p>
                    <p className="font-medium">{result.summary.totalLocations} places</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Average Rating</p>
                    <p className="font-medium flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      {result.summary.averageRating.toFixed(1)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-muted-foreground">Free Time Left</p>
                    <p className="font-medium">{Math.round(result.remainingTime)} min</p>
                  </div>
                </div>
              </div>

              {/* Optimized Route */}
              <div className="space-y-3">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  Your Optimized Itinerary
                </h3>
                
                {result.optimizedRoute.map((destination: Destination, index: number) => (
                  <Card key={index} className="p-4 hover:shadow-md transition-shadow">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                              {index + 1}
                            </span>
                            <h4 className="font-semibold text-base">{destination.name}</h4>
                          </div>
                          <p className="text-sm text-muted-foreground ml-8">
                            {destination.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-sm">{destination.rating}</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-wrap gap-2 ml-8">
                        <Badge variant="outline" className={getCategoryColor(destination.category)}>
                          {destination.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Clock className="w-3 h-3 mr-1" />
                          {destination.visitTime} min visit
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          <Navigation className="w-3 h-3 mr-1" />
                          {destination.distanceFromSource.toFixed(1)} km away
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {destination.travelTimeFromSource} min travel
                        </Badge>
                      </div>
                    </div>
                  </Card>
                ))}

                {/* Return Info */}
                {result.estimatedReturnTime > 0 && (
                  <div className="p-3 bg-accent/5 rounded-lg border border-accent/20">
                    <p className="text-sm">
                      <span className="font-medium">Return journey:</span> ~{Math.round(result.estimatedReturnTime)} minutes back to {result.startLocation}
                    </p>
                  </div>
                )}
              </div>

              {/* Alternative Destinations */}
              {result.skippedDestinations && result.skippedDestinations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="font-semibold text-sm text-muted-foreground">
                    Other Options (Not enough time)
                  </h3>
                  <div className="space-y-2">
                    {result.skippedDestinations.slice(0, 3).map((destination: Destination, index: number) => (
                      <div key={index} className="p-3 bg-muted/50 rounded-lg text-sm">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{destination.name}</span>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span className="text-xs">{destination.rating}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TripPlanner;