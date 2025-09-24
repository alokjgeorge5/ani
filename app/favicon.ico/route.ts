import { NextRequest } from 'next/server';

export async function GET(_req: NextRequest) {
	return Response.redirect(new URL('/icon.svg', _req.url), 308);
}
