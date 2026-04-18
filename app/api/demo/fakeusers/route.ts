import { readdir } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

const SUPPORTED_VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]);

export async function GET() {
  const demoDir = path.join(process.cwd(), "public", "demo", "fakeusers");

  try {
    const entries = await readdir(demoDir, { withFileTypes: true });
    const videos = entries
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .filter((name) => SUPPORTED_VIDEO_EXTENSIONS.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map((name) => `/demo/fakeusers/${encodeURIComponent(name)}`);

    return NextResponse.json({ videos });
  } catch {
    return NextResponse.json({ videos: [] });
  }
}
