"use client";

import { useEffect, useRef, useState } from 'react';

type ChatMessage = {
	role: 'user' | 'assistant' | 'system';
	content: string;
};

export default function HomePage() {
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ role: 'assistant', content: 'Hi! Tell me a favorite anime and I\'ll curate similar picks.' },
	]);
	const [input, setInput] = useState('');
	const [loading, setLoading] = useState(false);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
	}, [messages.length]);

	async function handleSend(e: React.FormEvent) {
		e.preventDefault();
		if (!input.trim() || loading) return;
		const newMessages = [...messages, { role: 'user', content: input.trim() } as ChatMessage];
		setMessages(newMessages);
		setInput('');
		setLoading(true);
		try {
			const res = await fetch('/api/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: newMessages }),
			});
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			const data = await res.json();
			if (data?.assistantMessage) {
				setMessages((prev) => [...prev, data.assistantMessage]);
			}
		} catch (err: any) {
			setMessages((prev) => [
				...prev,
				{ role: 'assistant', content: 'Sorry, something went wrong. Please try again.' },
			]);
		} finally {
			setLoading(false);
		}
	}

	return (
		<main className="flex min-h-screen flex-col items-center p-4">
			<div className="w-full max-w-2xl">
				<header className="py-6 text-center">
					<h1 className="text-2xl font-bold">Anime Curator</h1>
					<p className="text-sm text-gray-600">Personalized anime recommendations</p>
				</header>

				<div ref={listRef} className="h-[60vh] overflow-y-auto rounded-md border bg-white p-4 shadow-sm">
					{messages.map((m, idx) => (
						<div key={idx} className={m.role === 'user' ? 'text-right' : 'text-left'}>
							<div className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-lg px-3 py-2 text-sm leading-relaxed ${m.role === 'user' ? 'bg-brand text-white' : 'bg-gray-100 text-gray-900'}`}>
								{m.content}
							</div>
						</div>
					))}
				</div>

				<form onSubmit={handleSend} className="mt-4 flex gap-2">
					<input
						type="text"
						value={input}
						onChange={(e) => setInput(e.target.value)}
						placeholder="Type your message..."
						className="flex-1 rounded-md border bg-white px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
					/>
					<button
						type="submit"
						disabled={loading}
						className="rounded-md bg-brand px-4 py-2 text-sm font-medium text-white shadow-sm disabled:opacity-60"
					>
						{loading ? 'Thinking…' : 'Send'}
					</button>
				</form>
			</div>
		</main>
	);
}
