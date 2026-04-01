import { NextRequest, NextResponse } from "next/server";

const VAPI_BASE = "https://api.vapi.ai";

export const dynamic = "force-dynamic";

async function proxy(req: NextRequest, segments: string[]) {
  const path = segments.join("/");
  const search = req.nextUrl.search ?? "";
  const url = `${VAPI_BASE}/${path}${search}`;

  const headers = new Headers();
  headers.set("Authorization", `Bearer ${process.env.VAPI_PRIVATE_API_KEY ?? ""}`);
  const ct = req.headers.get("content-type");
  if (ct) headers.set("content-type", ct);

  const body = req.method !== "GET" && req.method !== "HEAD"
    ? await req.arrayBuffer()
    : undefined;

  const res = await fetch(url, {
    method: req.method,
    headers,
    body: body ? Buffer.from(body) : undefined,
  });

  const resBody = await res.arrayBuffer();
  const resHeaders = new Headers();
  const ct2 = res.headers.get("content-type");
  if (ct2) resHeaders.set("content-type", ct2);

  return new NextResponse(resBody, { status: res.status, headers: resHeaders });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path } = await params;
  return proxy(req, path);
}
