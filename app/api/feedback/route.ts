import { defaultHandler } from '@/api/_lib/feedback-handler';
import { runVercelHandler } from '../_lib/vercel-compat';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  return runVercelHandler(defaultHandler(), request);
}

export async function POST(request: Request): Promise<Response> {
  return runVercelHandler(defaultHandler(), request);
}

export async function PUT(request: Request): Promise<Response> {
  return runVercelHandler(defaultHandler(), request);
}

export async function PATCH(request: Request): Promise<Response> {
  return runVercelHandler(defaultHandler(), request);
}

export async function DELETE(request: Request): Promise<Response> {
  return runVercelHandler(defaultHandler(), request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return runVercelHandler(defaultHandler(), request);
}
