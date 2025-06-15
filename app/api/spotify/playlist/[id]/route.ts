import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession();
  
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const response = await fetch(
      `https://api.spotify.com/v1/playlists/${params.id}/tracks?limit=50`,
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error("Failed to fetch playlist tracks");
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Playlist tracks fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch playlist tracks" },
      { status: 500 }
    );
  }
} 