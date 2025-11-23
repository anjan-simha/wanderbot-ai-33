import React, { useState, useRef } from 'react';
import { Mic, Camera, StopCircle, Volume2 } from 'lucide-react';
import { AudioRecorder } from '../utils/audioRecorder'; // Import the utility
import { identifyLandmarkFromImage } from '../services/PlaceService'; // Mock/Real service

export const MultimodalController = ({ onQueryDetected, onImageCaptured }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const recorderRef = useRef<AudioRecorder | null>(null);

  // --- VOSK VOICE INPUT LOGIC ---
  const toggleListening = async () => {
    if (!isListening) {
      // Start Recording
      try {
        recorderRef.current = new AudioRecorder();
        await recorderRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Mic Error:", err);
        alert("Could not access microphone.");
      }
    } else {
      // Stop Recording & Send to Backend
      setIsListening(false);
      if (recorderRef.current) {
        const audioBlob = await recorderRef.current.stop();
        sendAudioToBackend(audioBlob);
      }
    }
  };

  const sendAudioToBackend = async (audioBlob: Blob) => {
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice_query.wav');

    try {
      setTranscript("Processing speech...");
      // Connect to your Python Backend (app.py)
      const response = await fetch('http://localhost:5000/process_speech', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) throw new Error("Speech Processing Failed");
      
      const data = await response.json();
      setTranscript(data.transcript); // Display text
      onQueryDetected(data.transcript); // Trigger main logic
    } catch (error) {
      console.error(error);
      setTranscript("Error processing speech.");
    }
  };

  // ... [Keep existing Image and TTS Logic unchanged] ...

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/90 backdrop-blur-md border-t border-gray-200 shadow-lg">
      {/* Status Display */}
      {transcript && (
        <div className="mb-4 p-3 bg-gray-100 rounded-lg text-sm text-gray-700 animate-fade-in">
           <strong>Input:</strong> "{transcript}"
        </div>
      )}

      <div className="flex justify-around items-center max-w-md mx-auto">
        {/* Camera Button (Same as before) */}
        <label className="flex flex-col items-center gap-1 cursor-pointer group">
          <div className="p-4 bg-blue-100 text-blue-600 rounded-full transition-all group-hover:bg-blue-200">
            <Camera size={24} />
          </div>
          <span className="text-xs font-medium text-gray-600">Identify</span>
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onImageCaptured(null, e.target.files[0])} />
        </label>

        {/* Voice Button (Updated for Vosk) */}
        <button 
          onClick={toggleListening}
          className={`flex flex-col items-center gap-1 transition-all ${isListening ? 'scale-110' : ''}`}
        >
          <div className={`p-5 rounded-full shadow-xl transition-colors ${isListening ? 'bg-red-500 text-white animate-pulse' : 'bg-primary text-white'}`}>
             {isListening ? <StopCircle size={28} /> : <Mic size={28} />}
          </div>
          <span className="text-xs font-medium text-gray-600">
            {isListening ? 'Stop' : 'Vosk Record'}
          </span>
        </button>

        {/* TTS Button (Same as before) */}
        <button onClick={() => {}} className="flex flex-col items-center gap-1 group">
          <div className="p-4 bg-gray-100 text-gray-600 rounded-full"><Volume2 size={24} /></div>
          <span className="text-xs font-medium text-gray-600">Listen</span>
        </button>
      </div>
    </div>
  );
};