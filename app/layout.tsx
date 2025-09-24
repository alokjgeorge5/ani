import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Anime Curator',
	description: 'Personalized anime recommendations powered by AniList and OpenAI',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="h-full">
			<body className="h-full bg-gray-50 text-gray-900">
				{children}
			</body>
		</html>
	);
}
