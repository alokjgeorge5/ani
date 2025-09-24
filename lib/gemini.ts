import { GoogleGenerativeAI } from '@google/generative-ai';

export function getGemini() {
	const apiKey = process.env.GOOGLE_API_KEY;
	if (!apiKey) return null;
	return new GoogleGenerativeAI(apiKey);
}

export async function generateWithGemini(genAI: GoogleGenerativeAI, systemPrompt: string, userPrompt: string) {
	const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
	const content = [
		{ role: 'user', parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
	];
	const result = await model.generateContent({ contents: content as any });
	const text = result.response.text();
	return text || 'I could not generate recommendations right now.';
}
