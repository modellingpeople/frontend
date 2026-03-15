import html2canvas from 'html2canvas';

/**
 * Captures a specific DOM element and returns a Base64 Data URL.
 * Optimized for Three.js/WebGL canvases.
 */
export const captureElement = async (element) => {
  if (!element) {
    console.error("Capture failed: No element provided.");
    return null;
  }

  try {
    const canvas = await html2canvas(element, {
      backgroundColor: '#12151e',
      logging: false,
      useCORS: true,
      scale: 1, 
    });
    
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.error("html2canvas Capture Error:", err);
    return null;
  }
};

/**
 * Sends a base64 image to Gemini 3 Flash via Google AI Studio.
 * Includes detailed error diagnosis and full response logging.
 */
export const analyzeWithGemini = async (
  base64Image) => 
    {
  const base64Data = base64Image.split(',')[1];
  
  // API Configuration
  const API_KEY = process.env.REACT_APP_GEMINI_API_KEY;
  const MODEL_NAME = "gemini-2.5-flash"; 
  const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;

  console.log("My API Key is:", API_KEY);

  const payload = {
    contents: [{
      parts: [
        { inline_data: { mime_type: "image/png", data: base64Data } },
        { text: "Analyze this 3D pose and environment.  You must limit your answer to 40 words. Do not describe the point cloud environment. Follow these tasks: 1. Focus on the person figure and classify their pose. Are they sat down, standing, off balance, straining their back? 2. Based on that identify any safety risks related to their pose and surroundings." }
      ]
    }],

  // generationConfig: {
  //   maxOutputTokens: 5, // This physically prevents a long response
  //   temperature: 0.1    // Low temperature makes it more likely to follow instructions
  // }
};

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    // 1. Check for HTTP Errors
    if (!response.ok) {
      const errorJson = await response.json().catch(() => ({}));
      console.group("❌ Gemini API Error Diagnosis");
      console.error("HTTP Status:", response.status);
      console.error("Message:", errorJson.error?.message || "Unknown error");
      console.groupEnd();
      return `AI Error: ${errorJson.error?.message || "Request failed"}`;
    }

    const data = await response.json();

    // --- 2. LOG THE RAW RESPONSE TO CONSOLE ---
    console.group("🤖 Gemini 3 Flash Full Response");
    console.log("Raw JSON:", data);
    console.log("Candidates:", data.candidates);
    console.log("Usage Metadata:", data.usageMetadata);
    console.groupEnd();

    // 3. Extract the text
    const candidate = data.candidates?.[0];
    
    if (candidate?.finishReason === "SAFETY") {
      console.warn("⚠️ AI Response blocked by Safety Filters.");
      return "The AI declined to analyze this image due to safety filters.";
    }

    if (!candidate || !candidate.content || !candidate.content.parts) {
      return "Error: Received an empty response from the AI.";
    }

    return candidate.content.parts[0].text;

  } catch (err) {
    console.group("🌐 Network Diagnosis");
    console.error("Connection Error:", err.message);
    console.groupEnd();
    return "Network error: Check your connection.";
  }
};