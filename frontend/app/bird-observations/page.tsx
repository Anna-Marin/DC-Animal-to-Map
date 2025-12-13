"use client";

import React, { useEffect, useState, useRef } from "react";
import { useAppSelector } from "../lib/hooks";
import { token } from "../lib/slices/tokensSlice";
import { loggedIn } from "../lib/slices/authSlice";
import { useSearchParams, useRouter } from "next/navigation";
import "leaflet/dist/leaflet.css";

export default function BirdObservations() {
    const accessToken = useAppSelector(token);
    const isLoggedIn = useAppSelector(loggedIn);
    const [observations, setObservations] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [mounted, setMounted] = useState(false);
    const searchParams = useSearchParams();
    const speciesName = searchParams.get("species") || "";
    const [searchInput, setSearchInput] = useState<string>(speciesName);
    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const router = useRouter();

    // Mount and check authentication (only once)
    useEffect(() => {
        setMounted(true);
        if (!isLoggedIn) {
            const next = speciesName ? `/bird-observations?species=${encodeURIComponent(speciesName)}` : "/bird-observations";
            router.push(`/login?next=${encodeURIComponent(next)}`);
        }
    }, [isLoggedIn, router]); // Remove speciesName from dependencies

    // Handler per la cerca
    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (searchInput.trim()) {
            window.location.search = `?species=${encodeURIComponent(searchInput.trim())}`;
        }
    }

    // Fetch observations only if logged in and mounted
    useEffect(() => {
        if (!mounted || !isLoggedIn || !speciesName || !accessToken) return;
        
        setLoading(true);
        setError(null);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/maps/ebird-observations-map?species=${encodeURIComponent(speciesName)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
            .then(res => res.json())
            .then(data => {
                console.log("[BirdObservations] API response:", data);
                if (data.detail === 'Could not validate credentials') {
                    // Token expired, redirect to login
                    const next = `/bird-observations?species=${encodeURIComponent(speciesName)}`;
                    router.push(`/login?next=${encodeURIComponent(next)}`);
                } else if (data.error) {
                    setError(data.error);
                } else if (data.observations) {
                    setObservations(data.observations);
                } else {
                    setError("No observations found.");
                }
            })
            .catch(err => setError(err.message || "Unknown error"))
            .finally(() => setLoading(false));
    }, [mounted, accessToken, speciesName]); // Remove isLoggedIn and router from dependencies

    // Initialize map with colored markers when observations change
    useEffect(() => {
        if (observations.length > 0 && mapContainerRef.current && typeof window !== "undefined") {
            import("leaflet").then((L) => {
                // Remove existing map if any
                if (mapRef.current) {
                    mapRef.current.remove();
                }

                // Calculate center
                const avgLat = observations.reduce((sum, o) => sum + (o.lat || 0), 0) / observations.length;
                const avgLon = observations.reduce((sum, o) => sum + (o.lon || 0), 0) / observations.length;

                // Create new map
                const map = L.map(mapContainerRef.current).setView([avgLat, avgLon], 4);

                // Add OpenStreetMap tiles
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19,
                }).addTo(map);

                // Add colored markers for each observation
                observations.forEach((obs) => {
                    const color = getMarkerColor(obs.date);
                    const colorLabel = getColorLabel(obs.date);
                    
                    // Create a colored circle marker
                    L.circleMarker([obs.lat, obs.lon], {
                        radius: 8,
                        fillColor: color,
                        color: "#000",
                        weight: 1,
                        opacity: 1,
                        fillOpacity: 0.8
                    })
                    .bindPopup(`
                        <div style="font-size: 12px;">
                            <b>${obs.species}</b><br/>
                            <i>${obs.sci_name || ''}</i><br/>
                            <b>Location:</b> ${obs.location || 'Unknown'}<br/>
                            <b>Date:</b> ${obs.date}<br/>
                            <b>Recency:</b> ${colorLabel}<br/>
                            ${obs.how_many ? `<b>Count:</b> ${obs.how_many}<br/>` : ''}
                        </div>
                    `)
                    .addTo(map);
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
    }, [observations]);

    function getMarkerColor(dateStr: string): string {
        const obsDate = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) return "#008000";
        if (diffDays <= 3) return "#7fff00";
        if (diffDays <= 7) return "#ffff00";
        if (diffDays <= 14) return "#ffae42";
        if (diffDays <= 30) return "#ff0000";
        return "#cccccc";
    }

    function getColorLabel(dateStr: string): string {
        const obsDate = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays <= 1) return "0-1 days";
        if (diffDays <= 3) return "2-3 days";
        if (diffDays <= 7) return "4-7 days";
        if (diffDays <= 14) return "8-14 days";
        if (diffDays <= 30) return "15-30 days";
        return ">30 days";
    }

    // Don't render if not mounted or not logged in
    if (!mounted || !isLoggedIn) {
        return null;
    }

    return (
        <div className="bg-white py-24 sm:py-32 min-h-screen">
            <div className="mx-auto max-w-4xl px-6 lg:px-8">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
                    Bird Observations
                </h2>
                {}
                <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={searchInput}
                        onChange={e => setSearchInput(e.target.value)}
                        placeholder="Enter bird species (common or scientific name)"
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-lg"
                    />
                    <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-500">
                        Search
                    </button>
                </form>
                {loading && <div>Loading observations...</div>}
                {error && <div className="text-red-600 font-semibold">{error}</div>}
                {!loading && !error && observations.length > 0 && (
                    <>
                        <div className="mb-4 text-gray-700">
                            Found <b>{observations.length}</b> recent observations
                        </div>
                        {/* New legend in English */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-semibold mb-2">Color legend (recency within last month):</h3>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#008000"}}></div>
                                    <span>0-1 days</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#7fff00"}}></div>
                                    <span>2-3 days</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#ffff00"}}></div>
                                    <span>4-7 days</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#ffae42"}}></div>
                                    <span>8-14 days</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#ff0000"}}></div>
                                    <span>15-30 days</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#cccccc"}}></div>
                                    <span>&gt;30 days</span>
                                </div>
                            </div>
                        </div>
                        {/* Map with colored markers */}
                        <div className="mb-8">
                            <div 
                                ref={mapContainerRef} 
                                className="w-full h-[600px] rounded-lg border border-gray-300"
                                style={{ minHeight: 500, height: "70vh", zIndex: 0 }}
                            />
                        </div>

                        {/* Observations list */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {observations.map((obs, idx) => (
                                <div key={idx} className="p-4 border rounded-lg bg-gray-50 hover:shadow-md transition-shadow">
                                    <div className="flex items-start mb-2">
                                        <div 
                                            className="w-6 h-6 rounded-full mr-3 flex-shrink-0 mt-1"
                                            style={{backgroundColor: getMarkerColor(obs.date)}}
                                        ></div>
                                        <div className="flex-1">
                                            <h4 className="font-semibold">{obs.species}</h4>
                                            {obs.sci_name && <p className="text-sm italic text-gray-600">{obs.sci_name}</p>}
                                        </div>
                                    </div>
                                    <div className="text-sm text-gray-700 space-y-1">
                                        <p><b>Location:</b> {obs.location || "Unknown"}</p>
                                        <p><b>Coordinates:</b> {obs.lat?.toFixed(4)}, {obs.lon?.toFixed(4)}</p>
                                        <p><b>Date:</b> {obs.date} <span className="text-xs text-gray-500">({getColorLabel(obs.date)})</span></p>
                                        {obs.how_many && <p><b>Count:</b> {obs.how_many}</p>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
