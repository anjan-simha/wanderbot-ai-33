import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { startLocation, availableTime } = await req.json();

    if (!startLocation || !availableTime) {
      throw new Error("Missing required parameters: startLocation and availableTime");
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    console.log(`Generating trip plan for ${startLocation} with ${availableTime} hours`);

    // Use AI to suggest destinations with ratings, distances, and travel times
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a travel planning expert. Suggest tourist destinations based on the user's location and available time. 
Consider: distance from source, travel time, ratings (1-5 stars), visit duration, and return proximity.
Return ONLY valid JSON with this exact structure:
{
  "destinations": [
    {
      "name": "destination name",
      "description": "brief description",
      "visitTime": number (minutes),
      "rating": number (1-5),
      "distanceFromSource": number (km),
      "travelTimeFromSource": number (minutes),
      "distanceToSource": number (km for return trip),
      "category": "cultural|nature|adventure|food|shopping"
    }
  ]
}`
          },
          {
            role: "user",
            content: `Suggest 8-12 top-rated tourist destinations near ${startLocation}. I have ${availableTime} hours available. Include popular landmarks, attractions, and hidden gems. Consider travel logistics and return journey.`
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again later." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No response from AI");
    }

    // Parse AI response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("Invalid AI response format");
    }
    
    const parsedData = JSON.parse(jsonMatch[0]);
    const allDestinations: Destination[] = parsedData.destinations;

    console.log(`AI suggested ${allDestinations.length} destinations`);

    // Optimize route based on available time
    const availableMinutes = availableTime * 60;
    
    // Sort by a score: (rating * 100) - (travelTimeFromSource + visitTime)
    // This prioritizes high-rated places that are closer and take less time
    const scoredDestinations = allDestinations.map(dest => ({
      ...dest,
      score: (dest.rating * 100) - (dest.travelTimeFromSource + dest.visitTime + dest.distanceToSource * 0.5)
    })).sort((a, b) => b.score - a.score);

    const optimizedRoute: Destination[] = [];
    let timeUsed = 0;

    // Greedy selection with return time consideration
    for (const destination of scoredDestinations) {
      const timeNeeded = destination.travelTimeFromSource + destination.visitTime;
      const returnTime = destination.distanceToSource * 0.8; // Estimate return time
      
      if (timeUsed + timeNeeded + returnTime <= availableMinutes) {
        optimizedRoute.push(destination);
        timeUsed += timeNeeded;
      }
    }

    const totalVisitTime = optimizedRoute.reduce((sum, loc) => sum + loc.visitTime, 0);
    const totalTravelTime = optimizedRoute.reduce((sum, loc) => sum + loc.travelTimeFromSource, 0);
    const estimatedReturnTime = optimizedRoute.length > 0 
      ? optimizedRoute[optimizedRoute.length - 1].distanceToSource * 0.8 
      : 0;

    return new Response(
      JSON.stringify({
        startLocation,
        optimizedRoute,
        skippedDestinations: scoredDestinations.filter(d => !optimizedRoute.includes(d)),
        totalTime: timeUsed,
        estimatedReturnTime,
        remainingTime: Math.max(0, availableMinutes - timeUsed - estimatedReturnTime),
        summary: {
          totalLocations: optimizedRoute.length,
          totalVisitTime,
          totalTravelTime,
          averageRating: optimizedRoute.reduce((sum, loc) => sum + loc.rating, 0) / optimizedRoute.length || 0,
        }
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in optimize-trip:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});