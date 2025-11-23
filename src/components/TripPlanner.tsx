import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Clock, Star, Navigation, Sparkles, Home } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Map, Marker, Source, Layer } from 'react-map-gl';
import { formatMinutesToHoursAndMinutes } from "@/lib/timeUtils";
import { Checkbox } from "@/components/ui/checkbox";

interface Destination {
  name: string;
  description: string;
  visitTime: number;
  rating: number;
  travelTime: number;
  distance: number;
  distanceToHome: number;
  coordinates: { lat: number; lng: number };
}


const TripPlanner = () => {
  const [availableTime, setAvailableTime] = useState("3"); // Default to 3 hours
  const [homeAddress, setHomeAddress] = useState("");
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [interests, setInterests] = useState<string[]>([]);
  const [result, setResult] = useState<{ route: any[]; polyline: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [viewState, setViewState] = useState({
    longitude: -74.0060,
    latitude: 40.7128,
    zoom: 12
  });
  const { toast } = useToast();

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setCurrentLocation({ lat: latitude, lng: longitude });
          setViewState(prev => ({ ...prev, latitude, longitude, zoom: 14 }));
          toast({ title: "Location updated!" });
        },
        (error) => {
          console.error("Geolocation error:", error);
          toast({
            title: "Location Error",
            description: "Could not retrieve your location. Please enter it manually.",
            variant: "destructive",
          });
        }
      );
    } else {
      toast({
        title: "Geolocation Not Supported",
        description: "Your browser does not support geolocation.",
        variant: "destructive",
      });
    }
  };



  const generateItinerary = async () => {
    if (!currentLocation) {
      toast({
        title: "Location Needed",
        description: "Please set your current location first.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke('optimize-trip', {
        body: {
          availableTime: parseFloat(availableTime) * 60, // Convert hours to minutes
          homeLocation: homeAddress,
          currentLocation,
          preferences: interests,
        },
      });

      if (error) throw error;

      setResult(data);

      if (data.route && data.route.length > 0) {
        // Center map on the first destination
        setViewState(prev => ({
          ...prev,
          latitude: data.route[0].coordinates.lat,
          longitude: data.route[0].coordinates.lng,
          zoom: 13,
        }));
      }

      toast({
        title: "Itinerary Generated!",
        description: `Your optimized trip with ${data.route.length} stops is ready.`,
      });
    } catch (error) {
      console.error('Error generating itinerary:', error);
      toast({
        title: "Error",
        description: "Failed to generate itinerary. Please try again later.",
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
      entertainment: "bg-blue-500/10 text-blue-600 border-blue-500/20",
      historical: "bg-amber-500/10 text-amber-600 border-amber-500/20",
    };
    return colors[category.toLowerCase()] || "bg-accent/10 text-accent border-accent/20";
  };

const INTEREST_OPTIONS = ["Museums", "Restaurants", "Parks", "Shopping", "Historical"];

  const handleInterestChange = (interest: string) => {
    setInterests(prev =>
      prev.includes(interest)
        ? prev.filter(i => i !== interest)
        : [...prev, interest]
    );
  };

  return (
    <div className="flex h-screen bg-background">
      {/* Left Panel: Controls & Itinerary */}
      <div className="w-1/3 h-screen overflow-y-auto p-4 border-r border-border">
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-bold">Dynamic Trip Planner</h2>
            <p className="text-sm text-muted-foreground">Your AI-powered travel assistant</p>
          </div>

          {/* Input Form */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="time">Available Time (hours)</Label>
              <Input id="time" type="number" step="0.5" min="0.5" value={availableTime} onChange={(e) => setAvailableTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="home">Home/Hotel Address</Label>
              <Input id="home" placeholder="e.g., 123 Main St, New York, NY" value={homeAddress} onChange={(e) => setHomeAddress(e.target.value)} />
            </div>
            <Button onClick={getCurrentLocation} variant="outline" className="w-full"> <MapPin className="w-4 h-4 mr-2" /> Get Current Location</Button>

            <div className="space-y-2">
              <Label>Interests</Label>
              <div className="grid grid-cols-2 gap-2">
                {INTEREST_OPTIONS.map(interest => (
                  <div key={interest} className="flex items-center space-x-2">
                    <Checkbox id={interest} checked={interests.includes(interest)} onCheckedChange={() => handleInterestChange(interest)} />
                    <label htmlFor={interest} className="text-sm font-medium leading-none">{interest}</label>
                  </div>
                ))}
              </div>
            </div>

            <Button onClick={generateItinerary} disabled={isLoading} className="w-full text-base font-medium" size="lg">
              {isLoading ? "Generating..." : "Plan My Trip"}
            </Button>
          </div>

          {/* Results */}
          {result && (
            <div className="space-y-4 pt-4 border-t border-border">
              <h3 className="font-bold text-lg">Your Optimized Itinerary</h3>
              {result.route.map((place, index) => (
                <Card key={index} className="p-3">
                  <p className="font-semibold">{index + 1}. {place.name}</p>
                  <p className="text-sm text-muted-foreground">Rating: {place.rating} / 5</p>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel: Map */}
      <div className="w-2/3 h-screen">
        <Map
          {...viewState}
          onMove={evt => setViewState(evt.viewState)}
          style={{ width: '100%', height: '100%' }}
          mapStyle="mapbox://styles/mapbox/streets-v11"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        >
          {currentLocation && (
            <Marker longitude={currentLocation.lng} latitude={currentLocation.lat} color="blue" />
          )}
          {result?.route.map((place, index) => (
            <Marker key={index} longitude={place.coordinates.lng} latitude={place.coordinates.lat} color="red">
              <div className="bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold">{index + 1}</div>
            </Marker>
          ))}
          {result?.polyline && (
            <Source id="route" type="geojson" data={{ type: 'Feature', geometry: { type: 'LineString', coordinates: result.polyline } }}>
              <Layer type="line" layout={{ 'line-join': 'round', 'line-cap': 'round' }} paint={{ 'line-color': '#888', 'line-width': 4 }} />
            </Source>
          )}
        </Map>
      </div>
    </div>
  );
};

export default TripPlanner;