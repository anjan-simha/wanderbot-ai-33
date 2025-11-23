const API_URL = "http://localhost:5000";

export const identifyLandmarkFromImage = async (imageFile) => {
  const formData = new FormData();
  formData.append('file', imageFile);

  try {
    const response = await fetch(`${API_URL}/identify_landmark`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) throw new Error("Server Error");
    
    const data = await response.json();
    
    return {
      name: data.landmark,
      confidence: data.confidence,
      description: data.summary // Returns the T5 summarized text
    };
  } catch (error) {
    console.error("AI Service Error:", error);
    // Fallback to mock if server is down
    return { name: "Unknown Location", description: "Could not connect to AI server." };
  }
};
