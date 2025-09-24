import OpenAI from 'openai';
import type { AnimeSummary } from './anilist';

export function getOpenAIClient(): OpenAI | null {
	const apiKey = process.env.OPENAI_API_KEY;
	if (!apiKey) return null;
	return new OpenAI({ apiKey });
}

export function buildRecommendationPrompt(userMessage: string, favorite: AnimeSummary | null, candidates: AnimeSummary[]) {
	const favText = favorite
		? `Favorite anime (from AniList):\n- Title: ${favorite.title}\n- Year: ${favorite.year ?? 'Unknown'}\n- Genres: ${favorite.genres.join(', ') || 'N/A'}\n- Summary: ${truncate(favorite.description ?? '', 500)}`
		: 'Favorite anime: Could not find exact match.';
	const candText = candidates.slice(0, 6).map((c, i) => `#${i + 1} ${c.title} (${c.year ?? 'Unknown'})\nGenres: ${c.genres.join(', ') || 'N/A'}\nSummary: ${truncate(c.description ?? '', 400)}`).join('\n\n');

	return `User message: ${userMessage}\n\n${favText}\n\nCandidates from AniList (potentially similar):\n${candText}\n\nTask: Choose 2-3 titles that best match the user's tastes inferred from the favorite and message. For each, provide:\n- Title\n- 1-2 sentence reason of similarity\n- Optionally mention genre/year hooks.\nKeep it concise.`;
}

function truncate(text: string, max: number) {
	if (text.length <= max) return text;
	return text.slice(0, max - 1) + '…';
}
