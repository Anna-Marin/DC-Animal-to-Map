"use client";

import React, { useEffect, useState, useRef } from "react";
import { fetchEBirdObservations } from "../lib/api/ebird";
import "leaflet/dist/leaflet.css";
import { markerIcon2x, markerIcon, markerShadow } from "./leaflet-icons";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuthFetch } from "../lib/hooks/useAuthFetch";
import { useProtectedRoute } from "../lib/hooks/useProtectedRoute";

export default function LocateToMap() {
    const isLoggedIn = useProtectedRoute("/locate-to-map");
    const authFetch = useAuthFetch();
    const searchParams = useSearchParams();
    const router = useRouter();

    const [locationResults, setLocationResults] = useState<any>(null);
    const [search, setSearch] = useState("");
    const [mapData, setMapData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [autoSearched, setAutoSearched] = useState(false);
    const shouldAutoSearch = useRef(false);
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    // eBird state
    const [ebirdData, setEBirdData] = useState<any>(null);
    const [showEBird, setShowEBird] = useState(false);
    const [ebirdLoading, setEBirdLoading] = useState(false);

    // Pre-fill and auto-search if coming from button
    useEffect(() => {
        if (!isLoggedIn) return;
        const animalName = searchParams.get("name") || "";
        if (animalName && !autoSearched) {
            setSearch(animalName);
            shouldAutoSearch.current = true;
            setAutoSearched(true);
        }
    }, [isLoggedIn, searchParams, autoSearched]);

    // Initialize map when mapData changes
    useEffect(() => {
        if (mapData && mapContainerRef.current && typeof window !== "undefined") {
            import("leaflet").then((L) => {
                // Fix marker icons (use .src for imported images)
                if (L && L.Icon && L.Icon.Default) {
                    L.Icon.Default.mergeOptions({
                        iconRetinaUrl: markerIcon2x.src ?? markerIcon2x,
                        iconUrl: markerIcon.src ?? markerIcon,
                        shadowUrl: markerShadow.src ?? markerShadow,
                    });
                }
                // Remove existing map if any
                if (mapRef.current) {
                    mapRef.current.remove();
                }
                // Create new map
                if (!mapContainerRef.current) return;
                const map = L.map(mapContainerRef.current).setView(
                    [mapData.center.lat, mapData.center.lon],
                    2
                );
                // Add OpenStreetMap tiles
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19,
                }).addTo(map);
                // Add markers for each coordinate
                mapData.coordinates.forEach((coord: { lat: number; lon: number }) => {
                    L.marker([coord.lat, coord.lon]).addTo(map);
                });
                mapRef.current = map;
            });
        }

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [mapData]);

    const handleSearch = async (animal?: string) => {
        const searchTerm = animal || search;
        if (!searchTerm) return;
        setLoading(true);
        setError(null);
        setMapData(null);
        setEBirdData(null);
        setShowEBird(false);

        try {
            const data = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL}/maps/animal-to-map?name=${encodeURIComponent(searchTerm)}`
            );

            if (data.error) {
                setError(data.error);
            } else if (data.map_data) {
                setMapData(data.map_data);
                setLocationResults(data.map_data.location_results || null);

                // Prefetch eBird
                setEBirdLoading(true);
                try {
                    const ebirdData = await authFetch(
                        `${process.env.NEXT_PUBLIC_API_URL}/maps/ebird-observations-map?species=${encodeURIComponent(searchTerm)}`
                    );
                    if (ebirdData?.observations?.length > 0) {
                        setEBirdData(ebirdData);
                    }
                } catch (err) {
                    console.error("Error fetching eBird:", err);
                } finally {
                    setEBirdLoading(false);
                }
            }
        } catch (err: any) {
            setError(err.message || "An error occurred");
        } finally {
            setLoading(false);
        }
    };
    // Don't render if not logged in (protected route handles redirect)
    if (!isLoggedIn) {
        return null;
    }

    // Auto-search after render if needed
    if (shouldAutoSearch.current && search && !loading) {
        shouldAutoSearch.current = false;
        setTimeout(() => handleSearch(search), 0);
    }

    return (
        <div className="bg-white py-24 sm:py-32 min-h-screen">
            <div className="mx-auto max-w-4xl px-6 lg:px-8">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
                    Locate Animal on Map
                </h2>
                <form
                    onSubmit={e => {
                        e.preventDefault();
                        handleSearch();
                    }}
                    className="flex gap-2 mb-6"
                >
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Enter animal name..."
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-lg"
                    />
                    <button
                        type="submit"
                        className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-500"
                    >
                        Search
                    </button>
                </form>
                {loading && <div>Loading map...</div>}
                {error && <div className="text-red-600 font-semibold">{error}</div>}
                {mapData && (
                    <div className="mt-8">
                        <div
                            ref={mapContainerRef}
                            className="w-full h-[600px] rounded-lg shadow-md border border-gray-300"
                            style={{ minHeight: 500, height: "60vh", zIndex: 0 }}
                        />
                        {locationResults && (
                            <div className="mt-4">
                                <h3 className="font-semibold mb-2">Location results:</h3>
                                <ul className="text-sm">
                                    {Object.entries(locationResults).map(([loc, coords]: [string, any]) => (
                                        <li key={loc}>
                                            <span className="font-mono">{loc}</span>: {coords.length > 0 ? `✔️ (${coords.length} found)` : <span className="text-red-600">❌ No matching coordinates found</span>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {ebirdLoading && <div className="mt-4 text-blue-600">Checking eBird for recent observations...</div>}
                        {ebirdData && ebirdData.observations && ebirdData.observations.length > 0 && (
                            <button
                                className="mt-4 bg-green-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-green-500"
                                onClick={() => router.push(`/bird-observations?species=${encodeURIComponent(search)}`)}
                            >
                                View Bird Observations ({ebirdData.count})
                            </button>
                        )}
                        {showEBird && ebirdData && ebirdData.observations && (
                            <div className="mt-6">
                                <h3 className="font-semibold mb-2">Recent eBird Observations</h3>
                                <ul className="text-sm max-h-64 overflow-y-auto border rounded p-2 bg-gray-50">
                                    {ebirdData.observations.map((obs: any, idx: number) => (
                                        <li key={obs.obs_id || idx} className="mb-2">
                                            <span className="font-mono font-bold">{obs.species}</span> at <span className="font-mono">{obs.location}</span> on <span className="font-mono">{obs.date}</span>
                                            {obs.how_many && <> — <span className="text-gray-600">{obs.how_many} seen</span></>}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
