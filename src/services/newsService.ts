import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export interface NewsItem {
  title: string;
  url: string;
  source: string;
  date: string;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
}

export interface AssetSentiment {
  assetName: string;
  overallSentiment: 'Positive' | 'Neutral' | 'Negative';
  score: number; // -1 to 1
  news: NewsItem[];
  lastUpdated: string;
}

export const newsService = {
  /**
   * Fetches news and analyzes sentiment for a specific asset using Gemini.
   */
  getSentiment: async (assetName: string): Promise<AssetSentiment> => {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the current market sentiment and provide recent news for the asset: ${assetName}. 
        Return the data in a structured JSON format including:
        - overallSentiment: "Positive", "Neutral", or "Negative"
        - score: a number between -1 (very negative) and 1 (very positive)
        - news: an array of objects with title, url (if available, otherwise empty string), source, date, and sentiment for that specific news item.
        Limit to the 3 most relevant recent news items.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json",
        },
      });

      const data = JSON.parse(response.text || '{}');
      
      return {
        assetName,
        overallSentiment: data.overallSentiment || 'Neutral',
        score: data.score || 0,
        news: data.news || [],
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`Error fetching sentiment for ${assetName}:`, error);
      return {
        assetName,
        overallSentiment: 'Neutral',
        score: 0,
        news: [],
        lastUpdated: new Date().toISOString(),
      };
    }
  }
};
