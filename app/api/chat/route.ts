import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fetchAnimeByTitle, fetchSimilarAnime } from '@/lib/anilist';
import { getOpenAIClient, buildRecommendationPrompt } from '@/lib/openai';
import { getGemini, generateWithGemini } from '@/lib/gemini';

const MessageSchema = z.object({
	role: z.enum(['user', 'assistant', 'system']),
	content: z.string(),
});

const RequestSchema = z.object({
	messages: z.array(MessageSchema).min(1),
});

type ApiError = { source: 'validation' | 'anilist' | 'openai' | 'gemini' | 'unknown'; message: string; status?: number };

type Timings = {
	anilistFavoriteMs?: number;
	anilistSimilarMs?: number;
	aiProvider?: 'gemini' | 'openai' | 'none';
};

export async function POST(req: NextRequest) {
	const errors: ApiError[] = [];
	const timings: Timings = {};
	try {
		const json = await req.json();
		const { messages } = RequestSchema.parse(json);

		const latestUser = [...messages].reverse().find((m) => m.role === 'user');
		if (!latestUser) {
			return Response.json({ error: { source: 'validation', message: 'No user message found' } }, { status: 400 });
		}

		const gemini = getGemini();
		const openai = getOpenAIClient();

		// Step 1: Title extraction (simplified)
		const extractedTitle = latestUser.content.trim();

		// Step 2: AniList queries with timings + server logs
		let favorite = null as Awaited<ReturnType<typeof fetchAnimeByTitle>>;
		let similar: Awaited<ReturnType<typeof fetchSimilarAnime>> = [];
		try {
			const t0 = Date.now();
			console.log('[AniList] fetchAnimeByTitle search=', extractedTitle);
			favorite = await fetchAnimeByTitle(extractedTitle);
			timings.anilistFavoriteMs = Date.now() - t0;
			console.log('[AniList] favorite result=', favorite?.title, 'timeMs=', timings.anilistFavoriteMs);
		} catch (e: any) {
			errors.push({ source: 'anilist', message: e?.message || 'AniList favorite lookup failed' });
		}
		try {
			const t0 = Date.now();
			if (favorite) {
				console.log('[AniList] fetchSimilarAnime id=', favorite.id, 'title=', favorite.title, 'genres=', favorite.genres, 'year=', favorite.year);
				similar = await fetchSimilarAnime(favorite);
			}
			timings.anilistSimilarMs = Date.now() - t0;
			console.log('[AniList] similar count=', similar.length, 'timeMs=', timings.anilistSimilarMs);
		} catch (e: any) {
			errors.push({ source: 'anilist', message: e?.message || 'AniList similar lookup failed' });
		}

		// Step 3: Curate
		const system = 'You are an expert anime curator. Be concise and friendly. Use short paragraphs and bullet points.';
		const userPrompt = buildRecommendationPrompt(latestUser.content, favorite, similar);

		if (gemini) {
			try {
				timings.aiProvider = 'gemini';
				const text = await generateWithGemini(gemini, system, userPrompt);
				return Response.json({ assistantMessage: { role: 'assistant', content: text }, favorite, similar, errors, timings });
			} catch (e: any) {
				errors.push({ source: 'gemini', message: e?.message || 'Gemini generation failed' });
			}
		}

		if (openai) {
			try {
				timings.aiProvider = 'openai';
				const completion = await openai.chat.completions.create({
					model: 'gpt-4o-mini',
					messages: [
						{ role: 'system', content: system },
						{ role: 'user', content: userPrompt },
					],
					temperature: 0.7,
				});
				const assistantMessage = {
					role: 'assistant' as const,
					content: completion.choices?.[0]?.message?.content ?? buildFallbackMessage(favorite, similar),
				};
				return Response.json({ assistantMessage, favorite, similar, errors, timings });
			} catch (e: any) {
				const status = e?.status;
				const code = e?.code;
				const hint = status === 429 || code === 'insufficient_quota' ? 'OpenAI quota exceeded. Showing basic recommendations.' : 'OpenAI unavailable. Showing basic recommendations.';
				errors.push({ source: 'openai', message: e?.message || hint, status });
				timings.aiProvider = 'openai';
				return Response.json({ assistantMessage: { role: 'assistant', content: buildFallbackMessage(favorite, similar, hint) }, favorite, similar, errors, timings });
			}
		}

		// No AI providers
		timings.aiProvider = 'none';
		errors.push({ source: 'unknown', message: 'No AI provider configured' });
		return Response.json({ assistantMessage: { role: 'assistant', content: buildFallbackMessage(favorite, similar, 'No AI provider configured. Showing basic recommendations.') }, favorite, similar, errors, timings });
	} catch (err: any) {
		console.error(err);
		return Response.json({ error: { source: 'unknown', message: 'Unexpected error' } }, { status: 500 });
	}
}

function buildFallbackMessage(
	favorite: { title?: string | undefined } | null,
	similar: Array<{ title?: string; year?: number; genres?: string[] }> = [],
	hint?: string,
) {
	const header = hint ? `${hint}\n\n` : '';
	const fav = favorite?.title ? `Based on your favorite: ${favorite.title}\n\n` : '';
	if (!similar || similar.length === 0) {
		return header + fav + 'I could not fetch similar titles right now. Try another title or retry in a moment.';
	}
	const bullets = similar.slice(0, 3).map((s) => {
		const parts = [s.title || 'Unknown'];
		if (s.year) parts.push(`(${s.year})`);
		const line1 = `- ${parts.join(' ')}`;
		const reason = s.genres && s.genres.length ? `  • Shares genres: ${s.genres.slice(0, 3).join(', ')}` : '';
		return [line1, reason].filter(Boolean).join('\n');
	}).join('\n');
	return header + fav + `Here are a few recommendations you might like:\n\n${bullets}`;
}
