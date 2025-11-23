import React, { useState, useEffect } from 'react';
import { MultimodalController } from './MultimodalController'; // From Step 2
import { optimizeTrip } from './utils/tripOptimizer'; // From Step 1
import { identifyLandmarkFromImage, getAllPlaces } from './services/PlaceService';
import { Clock, MapPin, Navigation } from 'lucide-react';

export const TripCoordinator = () => {
  // State Management
  const [userLocation, setUserLocation] = useState({ lat: 12.9716, lng: 77.5946 }); // Default: Central Bangalore
  const [availableTime, setAvailableTime] = useState(180); // Default: 3 hours (in minutes)
  const [currentItinerary, setCurrentItinerary] = useState([]);
  const [aiResponse, setAiResponse] = useState("Ready to guide you. Take a photo or ask a question.");
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. Handle GPS Data Acquisition [cite: 16]
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => console.log("GPS Error: Using default location")
      );
    }
  }, []);

  // 2. The Core "Dynamic Optimization" Trigger [cite: 22, 27]
  const handleTripOptimization = () => {
    setIsProcessing(true);
    const allPlaces = getAllPlaces();
    
    // Run the algorithm from Step 1
    const result = optimizeTrip(userLocation, allPlaces, availableTime);
    
    setCurrentItinerary(result.itinerary);
    
    const summaryText = `I have optimized your trip. Based on your ${availableTime} minutes, I suggest ${result.itinerary.length} stops including ${result.itinerary[0]?.name}. I eliminated ${result.placesEliminatedCount} places due to time constraints.`;
    
    setAiResponse(summaryText);
    setIsProcessing(false);
    
    // Trigger Voice Output [cite: 24]
    speak(summaryText);
  };

  // 3. Handle Image Input (Landmark Recognition) [cite: 18, 19]
  const handleImageInput = async (imageUrl, file) => {
    setIsProcessing(true);
    setAiResponse("Analyzing image for landmarks...");
    
    // Simulate AI Processing
    const detection = await identifyLandmarkFromImage(file);
    
    const responseText = `That looks like ${detection.name}. ${detection.description}`;
    setAiResponse(responseText);
    setIsProcessing(false);
    speak(responseText);
  };

  // 4. Handle Voice Query [cite: 17]
  const handleVoiceQuery = (text) => {
    // Simple keyword matching for prototype
    if (text.toLowerCase().includes("optimize") || text.toLowerCase().includes("plan")) {
      handleTripOptimization();
    } else {
      const response = `I heard: "${text}". I am searching for relevant tourist info...`;
      setAiResponse(response);
      speak(response);
    }
  };

  // Helper: Text to Speech [cite: 24]
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32"> {/* Padding for fixed controller */}
      
      {/* Header */}
      <div className="bg-white p-4 shadow-sm sticky top-0 z-10">
        <h1 className="text-xl font-bold text-primary">WanderBot AI</h1>
        <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
          <MapPin size={14} />
          <span>Lat: {userLocation.lat.toFixed(4)}, Lng: {userLocation.lng.toFixed(4)}</span>
        </div>
      </div>

      {/* Dashboard: Time Input & Results */}
      <div className="p-4 max-w-md mx-auto space-y-6">
        
        {/* AI Response Card */}
        <div className="bg-white p-4 rounded-xl shadow-md border-l-4 border-blue-500">
          <h3 className="font-semibold text-gray-800 mb-2">AI Guide Says:</h3>
          <p className="text-gray-600 italic">{isProcessing ? "Processing..." : aiResponse}</p>
        </div>

        {/* Trip Optimizer Controls */}
        <div className="bg-white p-4 rounded-xl shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-lg">Trip Optimizer</h2>
            <div className="flex items-center gap-2 bg-blue-50 px-3 py-1 rounded-full text-blue-700">
              <Clock size={16} />
              <input 
                type="number" 
                value={availableTime}
                onChange={(e) => setAvailableTime(Number(e.target.value))}
                className="w-12 bg-transparent font-bold outline-none text-center"
              />
              <span className="text-xs">mins</span>
            </div>
          </div>
          
          <button 
            onClick={handleTripOptimization}
            className="w-full py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            Optimize My Route
          </button>
        </div>

        {/* Itinerary List [cite: 22] */}
        {currentItinerary.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-gray-700">Suggested Route:</h3>
            {currentItinerary.map((place, index) => (
              <div key={place.id} className="flex items-start gap-3 bg-white p-3 rounded-lg border border-gray-100 shadow-sm">
                <div className="bg-gray-100 w-8 h-8 rounded-full flex items-center justify-center font-bold text-gray-600 shrink-0">
                  {index + 1}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{place.name}</h4>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
                    <span className="flex items-center gap-1"><span className="text-yellow-500">★</span> {place.rating}</span>
                    <span>•</span>
                    <span>{Math.round(place.distance)} km away</span>
                    <span>•</span>
                    <span>{place.visitDuration} min visit</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Multimodal Input Interface (Fixed at bottom) [cite: 4, 25] */}
      <MultimodalController 
        onQueryDetected={handleVoiceQuery}
        onImageCaptured={handleImageInput}
      />
    </div>
  );
};