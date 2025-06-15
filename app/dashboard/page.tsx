"use client";
import { useSession } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { Visualizer } from "../../components/Visualizer";

interface Track {
  id: string;
  name: string;
  artists: { name: string; id: string }[];
  album: { 
    name: string; 
    images?: { url: string; height?: number; width?: number }[];
    id: string;
  };
  preview_url: string | null;
  external_urls: { spotify: string };
  duration_ms?: number;
  popularity?: number;
  explicit?: boolean;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  images?: { url: string; height?: number; width?: number }[];
  tracks: { total: number };
  external_urls: { spotify: string };
  owner?: {
    display_name: string;
    id: string;
  };
  public?: boolean;
  collaborative?: boolean;
}

export default function Dashboard() {
  const { data: session } = useSession();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{
    tracks: Track[];
    playlists: Playlist[];
  }>({ tracks: [], playlists: [] });
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [playlistTracks, setPlaylistTracks] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingPlaylist, setLoadingPlaylist] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const audioRef = useRef<HTMLAudioElement>(null);

  const searchSpotify = async (query: string) => {
    if (!query.trim() || !session?.accessToken) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track,playlist&limit=20`,
        {
          headers: {
            Authorization: `Bearer ${session.accessToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // Filter and sort tracks, handling null entries and missing data
        const tracks = (data.tracks?.items || [])
          .filter((track: any) => track && track.id && track.name) // Filter out null/invalid entries
          .sort((a: Track, b: Track) => {
            if (a.preview_url && !b.preview_url) return -1;
            if (!a.preview_url && b.preview_url) return 1;
            return 0;
          });
        
        // Filter playlists, handling null entries and missing data
        const playlists = (data.playlists?.items || [])
          .filter((playlist: any) => playlist && playlist.id && playlist.name); // Filter out null/invalid entries
        
        console.log(`Found ${tracks.length} tracks, ${tracks.filter((t: Track) => t.preview_url).length} with previews`);
        console.log(`Found ${playlists.length} playlists`);
        
        setSearchResults({
          tracks,
          playlists,
        });
      } else if (response.status === 401) {
        // Token expired, user needs to sign in again
        alert("Your session has expired. Please sign in again.");
        window.location.href = "/";
      }
    } catch (error) {
      console.error("Search error:", error);
    } finally {
      setLoading(false);
    }
  };

  const playTrack = (track: Track) => {
    console.log("Selecting track:", track.name, "Preview URL:", track.preview_url);
    
    // Always set the current track, regardless of preview availability
    setCurrentTrack(track);
    
    if (track.preview_url && audioRef.current) {
      // If preview is available, play it
      audioRef.current.src = track.preview_url;
      audioRef.current.play().catch(error => {
        console.error("Error playing audio:", error);
        setIsPlaying(false);
      });
      setIsPlaying(true);
    } else {
      // If no preview, just select the track but don't play audio
      setIsPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      
      if (!track.preview_url) {
        console.log(`No preview available for "${track.name}", but track selected for visualization`);
      }
    }
  };

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const selectPlaylist = async (playlist: Playlist) => {
    setSelectedPlaylist(playlist);
    setLoadingPlaylist(true);
    
    try {
      const response = await fetch(`/api/spotify/playlist/${playlist.id}`);
      if (response.ok) {
        const data = await response.json();
        const tracks = data.items
          .filter((item: any) => item.track && item.track.preview_url)
          .map((item: any) => item.track);
        setPlaylistTracks(tracks);
      }
    } catch (error) {
      console.error("Error fetching playlist tracks:", error);
    } finally {
      setLoadingPlaylist(false);
    }
  };

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) {
      const handleEnded = () => setIsPlaying(false);
      const handlePause = () => setIsPlaying(false);
      const handlePlay = () => setIsPlaying(true);

      audio.addEventListener("ended", handleEnded);
      audio.addEventListener("pause", handlePause);
      audio.addEventListener("play", handlePlay);

      return () => {
        audio.removeEventListener("ended", handleEnded);
        audio.removeEventListener("pause", handlePause);
        audio.removeEventListener("play", handlePlay);
      };
    }
  }, []);

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-xl text-white">Please sign in to access the dashboard</div>
      </div>
    );
  }

  // Handle token refresh errors
  if (session.error === "RefreshAccessTokenError") {
    console.log("Session has refresh error:", session.error);
    return (
      <div className="min-h-screen flex items-center justify-center bg-black">
        <div className="text-center space-y-4">
          <div className="text-xl text-red-400">Session expired</div>
          <p className="text-gray-400">Please sign in again to continue</p>
          <button
            onClick={() => window.location.href = "/"}
            className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-full font-medium transition-colors"
          >
            Sign In Again
          </button>
        </div>
      </div>
    );
  }

  const tabs = ["All", "Playlists", "Albums", "Artists", "Songs", "Podcasts & Shows", "Profiles", "Audiobooks"];

  return (
    <div className="h-screen bg-black text-white flex flex-col">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between p-4 bg-black">
        <div className="flex items-center space-x-4">
          <button className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </button>
          <button className="w-8 h-8 bg-black rounded-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        
        <div className="flex items-center space-x-4">
          {session.user?.image && (
            <img
              src={session.user.image}
              alt={session.user.name || "User"}
              className="w-8 h-8 rounded-full"
            />
          )}
          <span className="text-white font-medium text-sm">
            {session.user?.name}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Sidebar */}
        <div className="w-80 bg-gray-950 p-6 overflow-y-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white mb-2">Vizify</h1>
            <p className="text-gray-400 text-sm">Search and visualize your music</p>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && searchSpotify(searchQuery)}
                placeholder="Search for music..."
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-full focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent placeholder-gray-400 text-white text-sm"
              />
              <button
                onClick={() => searchSpotify(searchQuery)}
                disabled={loading}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>

          {/* Quick Suggestions */}
          <div className="mb-6">
            <p className="text-xs text-gray-500 mb-2">Popular searches:</p>
            <div className="flex flex-wrap gap-1">
              {["Blinding Lights", "Shape of You", "Bad Habits", "As It Was"].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setSearchQuery(suggestion);
                    searchSpotify(suggestion);
                  }}
                  className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded-full transition-colors text-gray-300"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Navigation Menu */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-gray-400 mb-3">Library</h3>
            <button className="flex items-center space-x-3 w-full text-left py-2 px-3 rounded hover:bg-gray-800 transition-colors">
              <div className="w-6 h-6 bg-gradient-to-br from-purple-600 to-blue-600 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-gray-300">Recently Played</span>
            </button>
            
            <button className="flex items-center space-x-3 w-full text-left py-2 px-3 rounded hover:bg-gray-800 transition-colors">
              <div className="w-6 h-6 bg-gradient-to-br from-green-600 to-green-400 rounded flex items-center justify-center">
                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              </div>
              <span className="text-gray-300">Liked Songs</span>
            </button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 bg-gradient-to-b from-gray-900 to-black overflow-y-auto">
          {/* Tab Navigation */}
          <div className="sticky top-0 bg-gradient-to-b from-gray-900 to-transparent p-6 pb-4">
            <div className="flex space-x-4 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                    activeTab === tab
                      ? "bg-white text-black"
                      : "bg-gray-800 text-gray-300 hover:bg-gray-700"
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            {loading && (
              <div className="text-center py-8">
                <div className="text-lg text-gray-400">Searching...</div>
              </div>
            )}

            {/* Top Result */}
            {searchResults.tracks.length > 0 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Top result</h2>
                <div className="bg-gray-800 rounded-lg p-6 hover:bg-gray-700 transition-colors cursor-pointer max-w-sm"
                     onClick={() => playTrack(searchResults.tracks[0])}>
                  <div className="w-20 h-20 bg-gray-700 rounded mb-4 flex items-center justify-center">
                    {searchResults.tracks[0]?.album?.images?.[0]?.url ? (
                      <img
                        src={searchResults.tracks[0].album.images[0].url}
                        alt={searchResults.tracks[0].album.name || "Album cover"}
                        className="w-20 h-20 rounded object-cover"
                      />
                    ) : (
                      <svg className="w-10 h-10 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <h3 className="text-white font-bold text-xl mb-2">{searchResults.tracks[0].name}</h3>
                  <p className="text-gray-400 text-sm">
                    {searchResults.tracks[0].artists?.map((artist) => artist.name).join(", ") || "Unknown Artist"}
                  </p>
                                     <div className="flex items-center mt-4">
                     {searchResults.tracks[0].preview_url ? (
                       <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2" title="Has audio preview"></div>
                     ) : (
                       <div className="w-2 h-2 bg-blue-500 rounded-full mr-2" title="Demo visualization"></div>
                     )}
                     <span className="text-xs text-gray-400">
                       {searchResults.tracks[0].preview_url ? "SONG • Audio" : "SONG • Demo"}
                     </span>
                   </div>
                </div>
              </div>
            )}

            {/* Songs */}
            {searchResults.tracks.length > 1 && (
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-white mb-6">Songs</h2>
                <div className="space-y-2">
                  {searchResults.tracks.slice(1, 5).map((track, index) => (
                    <div
                      key={track.id}
                      className="flex items-center space-x-4 p-2 rounded hover:bg-gray-800 transition-colors cursor-pointer"
                      onClick={() => playTrack(track)}
                    >
                      <div className="w-12 h-12 bg-gray-700 rounded flex items-center justify-center">
                        {track?.album?.images?.[0]?.url ? (
                          <img
                            src={track.album.images[0].url}
                            alt={track.album.name || "Album cover"}
                            className="w-12 h-12 rounded object-cover"
                          />
                        ) : (
                          <svg className="w-6 h-6 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate text-white">{track.name}</p>
                        <p className="text-sm text-gray-400 truncate">
                          {track.artists?.map((artist) => artist.name).join(", ") || "Unknown Artist"}
                        </p>
                      </div>
                                             <div className="flex items-center space-x-2">
                         {track.preview_url ? (
                           <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Has audio preview"></div>
                         ) : (
                           <div className="w-2 h-2 bg-blue-500 rounded-full" title="Demo visualization"></div>
                         )}
                       </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar - Visualizer */}
        <div className="w-80 bg-gray-950 p-6 flex flex-col">
          <h2 className="text-xl font-bold text-white mb-4">Visualizer</h2>
          
          {/* Current Track Info */}
          {currentTrack && (
            <div className="mb-4">
              <div className="flex items-center space-x-3 mb-3">
                {currentTrack.album?.images?.[0] && (
                  <img
                    src={currentTrack.album.images[0].url}
                    alt={currentTrack.album.name}
                    className="w-12 h-12 rounded"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-white text-sm truncate">{currentTrack.name}</p>
                  <p className="text-gray-400 text-xs truncate">
                    {currentTrack.artists.map((artist) => artist.name).join(", ")}
                  </p>
                </div>
              </div>
              
                             <div className="flex items-center justify-center space-x-3">
                 {currentTrack.preview_url ? (
                   <button
                     onClick={togglePlayPause}
                     className="w-8 h-8 bg-green-500 hover:bg-green-600 rounded-full flex items-center justify-center transition-colors"
                   >
                     {isPlaying ? (
                       <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                       </svg>
                     ) : (
                       <svg className="w-3 h-3 text-black ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                       </svg>
                     )}
                   </button>
                 ) : (
                   <div className="text-xs text-gray-400 text-center">
                     <div className="w-8 h-8 bg-gray-600 rounded-full flex items-center justify-center mb-1">
                       <svg className="w-3 h-3 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                         <path fillRule="evenodd" d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.707.707L4.586 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.586l3.707-3.707a1 1 0 011.09-.217z" clipRule="evenodd" />
                       </svg>
                     </div>
                     <span>Demo Mode</span>
                   </div>
                 )}
               </div>
            </div>
          )}

                     {/* 3D Visualizer */}
           <div className="flex-1 bg-black rounded-lg overflow-hidden">
             {currentTrack ? (
               <Canvas camera={{ position: [0, 0, 5] }}>
                 <ambientLight intensity={0.5} />
                 <pointLight position={[10, 10, 10]} />
                 <Visualizer 
                   audioElement={audioRef.current} 
                   demoMode={!currentTrack.preview_url || !isPlaying}
                 />
               </Canvas>
             ) : (
               <div className="h-full flex items-center justify-center text-gray-400">
                 <div className="text-center">
                   <div className="text-4xl mb-4">🎵</div>
                   <p className="text-sm">Select a track to visualize</p>
                 </div>
               </div>
             )}
           </div>
        </div>
      </div>

      {/* Bottom Player Bar */}
      {currentTrack && (
        <div className="bg-gray-900 border-t border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 flex-1">
              {currentTrack.album?.images?.[0] && (
                <img
                  src={currentTrack.album.images[0].url}
                  alt={currentTrack.album.name}
                  className="w-14 h-14 rounded"
                />
              )}
              <div className="min-w-0">
                <p className="font-medium text-white text-sm truncate">{currentTrack.name}</p>
                <p className="text-gray-400 text-xs truncate">
                  {currentTrack.artists.map((artist) => artist.name).join(", ")}
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4 flex-1 justify-center">
              <button
                onClick={togglePlayPause}
                className="w-8 h-8 bg-white hover:scale-105 rounded-full flex items-center justify-center transition-transform"
              >
                {isPlaying ? (
                  <svg className="w-4 h-4 text-black" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4 text-black ml-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            </div>
            
            <div className="flex items-center space-x-3 flex-1 justify-end">
              <a
                href={currentTrack.external_urls.spotify}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                </svg>
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Hidden Audio Element */}
      <audio ref={audioRef} crossOrigin="anonymous" />
    </div>
  );
} 