import OpenAI from "openai";

// the newest OpenAI model is "gpt-5" which was released August 7, 2025. do not change this unless explicitly requested by the user
const openai = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY_ENV_VAR || "default_key"
});

export interface ChatResponse {
  message: string;
  suggestions?: string[];
}

export async function generateChatResponse(
  userMessage: string,
  conversationHistory: { role: string; content: string }[] = []
): Promise<ChatResponse> {
  try {
    const systemPrompt = `You are Foli Assistant, a supportive AI companion specifically designed to help women going through IVF and fertility treatments in Australia. 

Your role is to:
- Provide emotional support and encouragement
- Share general information about IVF processes, medications, and what to expect
- Offer practical tips for managing side effects and preparing for appointments
- Suggest questions to ask healthcare providers
- Provide context-appropriate resources and coping strategies

Important guidelines:
- Always remind users that you provide general information, not medical advice
- Encourage users to consult their healthcare provider for medical concerns
- Be empathetic, warm, and understanding of the emotional challenges
- Use Australian context and terminology where relevant
- Keep responses concise and actionable
- Suggest follow-up questions when appropriate

Current user message: "${userMessage}"

Respond with helpful, supportive information and include 2-3 relevant follow-up question suggestions.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.slice(-10), // Keep last 10 messages for context
      { role: "user", content: userMessage }
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: messages as any,
      max_tokens: 500,
      temperature: 0.7,
    });

    const aiMessage = response.choices[0].message.content || "I'm sorry, I couldn't generate a response right now. Please try again.";

    // Generate follow-up suggestions
    const suggestionsResponse = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content: "Generate 3 helpful follow-up questions related to the IVF/fertility topic discussed. Return as JSON array of strings."
        },
        {
          role: "user",
          content: `Based on this conversation about: "${userMessage}" and response: "${aiMessage}", suggest 3 relevant follow-up questions.`
        }
      ],
      response_format: { type: "json_object" },
      max_tokens: 200,
    });

    let suggestions: string[] = [];
    try {
      const suggestionsData = JSON.parse(suggestionsResponse.choices[0].message.content || "{}");
      suggestions = suggestionsData.questions || suggestionsData.suggestions || [];
    } catch (e) {
      // Fallback suggestions
      suggestions = [
        "What should I expect at my next appointment?",
        "How can I manage side effects?",
        "What questions should I ask my doctor?"
      ];
    }

    return {
      message: aiMessage,
      suggestions: suggestions.slice(0, 3)
    };

  } catch (error: any) {
    console.error("OpenAI API error:", error);
    throw new Error("Failed to generate AI response: " + error.message);
  }
}

export async function generateCycleInsight(
  cycleDay: number,
  treatmentType: string,
  recentSymptoms?: string[]
): Promise<string> {
  try {
    const prompt = `Generate a supportive, personalized daily insight for a woman on day ${cycleDay} of ${treatmentType} treatment. 
    ${recentSymptoms ? `Recent symptoms include: ${recentSymptoms.join(', ')}.` : ''}
    
    Provide encouragement and brief information about what might be happening biologically at this stage. 
    Keep it positive, informative, and under 100 words.`;

    const response = await openai.chat.completions.create({
      model: "gpt-5",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 150,
      temperature: 0.8,
    });

    return response.choices[0].message.content || "Stay positive - you're doing great on your fertility journey!";

  } catch (error: any) {
    console.error("Failed to generate cycle insight:", error);
    return "Stay positive - you're doing great on your fertility journey!";
  }
}
