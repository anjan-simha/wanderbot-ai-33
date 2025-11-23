import math

class TripOptimizer:
    def __init__(self, current_location, total_available_minutes):
        # current_location format: {'lat': float, 'lng': float}
        self.current_location = current_location
        self.available_time = total_available_minutes
        self.itinerary = []

    def calculate_distance(self, loc1, loc2):
        # Haversine formula to calculate distance between two points on Earth
        R = 6371  # Earth radius in km
        dlat = math.radians(loc2['lat'] - loc1['lat'])
        dlon = math.radians(loc2['lng'] - loc1['lng'])
        a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
             math.cos(math.radians(loc1['lat'])) * math.cos(math.radians(loc2['lat'])) *
             math.sin(dlon / 2) * math.sin(dlon / 2))
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        distance = R * c
        return distance

    def estimate_travel_time(self, distance_km):
        # Assuming average city travel speed of 30 km/h
        speed_kmh = 30 
        return (distance_km / speed_kmh) * 60  # returns minutes

    def score_place(self, place, distance):
        # Synopsis Objective 2: Consider ratings and shortest distance [cite: 13]
        # Heuristic: High rating increases score, high distance decreases score.
        # Weights can be adjusted based on preference.
        RATING_WEIGHT = 10
        DISTANCE_WEIGHT = 2
        
        # Normalize rating (0-5) and distance
        score = (place['rating'] * RATING_WEIGHT) - (distance * DISTANCE_WEIGHT)
        return score

    def generate_itinerary(self, potential_places):
        """
        potential_places: List of dicts containing 
        {'id', 'name', 'lat', 'lng', 'rating', 'visit_duration_minutes'}
        """
        
        scored_places = []

        # 1. Calculate metrics for all places
        for place in potential_places:
            dist = self.calculate_distance(self.current_location, place)
            travel_time = self.estimate_travel_time(dist)
            score = self.score_place(place, dist)
            
            scored_places.append({
                **place,
                'distance_from_user': dist,
                'travel_time_from_user': travel_time,
                'score': score
            })

        # 2. Sort by Score (Higher is better)
        # This prioritizes higher-rated and closer options 
        scored_places.sort(key=lambda x: x['score'], reverse=True)

        # 3. Elimination Logic (Knapsack-style greedy approach)
        current_time_used = 0
        final_trip = []

        for place in scored_places:
            total_cost = place['travel_time_from_user'] + place['visit_duration_minutes']
            
            # Check if this fits in the remaining time
            if current_time_used + total_cost <= self.available_time:
                final_trip.append(place)
                current_time_used += total_cost
            else:
                # Synopsis: Eliminate places if time is insufficient 
                continue 

        return final_trip

# --- Usage Example ---
# user_loc = {'lat': 12.9716, 'lng': 77.5946} # Bangalore
# optimizer = TripOptimizer(user_loc, total_available_minutes=120)
# optimized_trip = optimizer.generate_itinerary(list_of_places)
