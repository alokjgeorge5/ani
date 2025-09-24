const ANILIST_GRAPHQL_ENDPOINT = 'https://graphql.anilist.co';

type AniListMedia = {
	id: number;
	title: { romaji?: string; english?: string; native?: string };
	description?: string | null;
	genres?: string[] | null;
	seasonYear?: number | null;
	coverImage?: { large?: string | null } | null;
};

export type AnimeSummary = {
	id: number;
	title: string;
	description?: string;
	genres: string[];
	year?: number;
	coverImage?: string;
};

async function anilistFetch<T>(query: string, variables: Record<string, any>): Promise<T> {
	const res = await fetch(ANILIST_GRAPHQL_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
		body: JSON.stringify({ query, variables }),
		next: { revalidate: 0 },
	});
	const json = await res.json();
	if (!res.ok) throw new Error(`AniList HTTP ${res.status}`);
	if ((json as any)?.errors?.length) {
		const first = (json as any).errors[0];
		throw new Error(`AniList error: ${first?.message || 'Unknown GraphQL error'}`);
	}
	return json as T;
}

export async function fetchAnimeByTitle(titleInput: string): Promise<AnimeSummary | null> {
	const query = `
		query ($search: String) {
			Media(search: $search, type: ANIME) {
				id
				title { romaji english native }
				description(asHtml: false)
				genres
				seasonYear
				coverImage { large }
			}
		}
	`;
	const data = await anilistFetch<{ data: { Media: AniListMedia | null } }>(query, { search: titleInput ?? '' });
	const media = data.data.Media;
	if (!media) return null;
	return mapMedia(media);
}

export async function fetchSimilarAnime(favorite: AnimeSummary): Promise<AnimeSummary[]> {
	const query = `
		query ($genres: [String], $lower: Int, $upper: Int) {
			Page(perPage: 50) {
				media(
					type: ANIME,
					genre_in: $genres,
					seasonYear_greater: $lower,
					seasonYear_lesser: $upper,
					sort: POPULARITY_DESC
				) {
					id
					title { romaji english native }
					description(asHtml: false)
					genres
					seasonYear
					coverImage { large }
				}
			}
		}
	`;
	const pickedGenres = (favorite.genres || []).slice(0, 3);
	const lower = typeof favorite.year === 'number' ? favorite.year - 7 : null;
	const upper = typeof favorite.year === 'number' ? favorite.year + 7 : null;

	let candidates: AniListMedia[] = [];
	try {
		const data = await anilistFetch<{ data: { Page: { media: AniListMedia[] } } }>(query, {
			genres: pickedGenres.length ? pickedGenres : null,
			lower,
			upper,
		});
		candidates = data.data.Page.media || [];
	} catch (err) {
		// Fall back to general popular list if filtered query fails
		const fallbackQuery = `
			query {
				Page(perPage: 50) {
					media(type: ANIME, sort: POPULARITY_DESC) {
						id
						title { romaji english native }
						description(asHtml: false)
						genres
						seasonYear
						coverImage { large }
					}
				}
			}
		`;
		try {
			const data = await anilistFetch<{ data: { Page: { media: AniListMedia[] } } }>(fallbackQuery, {});
			candidates = data.data.Page.media || [];
		} catch {
			candidates = [];
		}
	}

	// Rank candidates: genre Jaccard + year proximity; exclude the favorite itself
	const favoriteGenres = new Set((favorite.genres || []).map((g) => g.toLowerCase()));
	function jaccard(a: Set<string>, b: Set<string>): number {
		const inter = new Set([...a].filter((x) => b.has(x)));
		const union = new Set([...a, ...b]);
		return union.size === 0 ? 0 : inter.size / union.size;
	}

	const scored = candidates
		.filter((m) => m.id !== favorite.id)
		.map((m) => {
			const genres = new Set((m.genres || []).map((g) => g.toLowerCase()));
			const genreScore = jaccard(favoriteGenres, genres); // 0..1
			const year = m.seasonYear ?? 0;
			const favYear = favorite.year ?? 0;
			const yearDelta = favYear && year ? Math.abs(favYear - year) : 10;
			const yearScore = 1 / (1 + yearDelta / 3); // closer years -> higher
			const score = genreScore * 0.75 + yearScore * 0.25;
			return { media: m, score };
		})
		.sort((a, b) => b.score - a.score)
		.slice(0, 8)
		.map((s) => mapMedia(s.media));

	return scored;
}

function mapMedia(media: AniListMedia): AnimeSummary {
	return {
		id: media.id,
		title: media.title.english || media.title.romaji || media.title.native || 'Unknown',
		description: media.description || undefined,
		genres: media.genres || [],
		year: media.seasonYear || undefined,
		coverImage: media.coverImage?.large || undefined,
	};
}
