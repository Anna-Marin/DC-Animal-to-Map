"use client";

import React, { useEffect, useState, useRef } from "react";
import "leaflet/dist/leaflet.css";
import { useRouter } from "next/navigation";
import { useAuthFetch } from "../lib/hooks/useAuthFetch";
import { useProtectedRoute } from "../lib/hooks/useProtectedRoute";

const fixLeafletIcons = async () => {
    const L = (await import("leaflet")).default;
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
};

export default function MapSearch() {
    const isLoggedIn = useProtectedRoute("/map-search");
    const authFetch = useAuthFetch();
    const router = useRouter();

    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [observations, setObservations] = useState<{ ebird: any[], local: any[] }>({ ebird: [], local: [] });

    const mapRef = useRef<any>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const markersRef = useRef<any[]>([]);

    useEffect(() => {
        fixLeafletIcons();
    }, []);

    const handleSearch = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!search) return;

        setLoading(true);
        setError(null);

        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/observations/search?country=${encodeURIComponent(search)}&max_results=100`;
            const data = await authFetch(url);
            setObservations(data);
            renderMap(data);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Extract map rendering to reusable function
    const renderMap = async (data: any) => {
        if (mapContainerRef.current) {
            const L = (await import("leaflet")).default;

            if (!mapRef.current) {
                mapRef.current = L.map(mapContainerRef.current).setView([20, 0], 2);
                L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                    maxZoom: 19,
                }).addTo(mapRef.current);
            }

            // Clear existing markers
            markersRef.current.forEach(marker => marker.remove());
            markersRef.current = [];

            const bounds = L.latLngBounds([]);

            // Add eBird markers (Blue default)
            if (data.ebird) {
                data.ebird.forEach((obs: any) => {
                    if (obs.lat && obs.lon) {
                        const marker = L.marker([obs.lat, obs.lon])
                            .bindPopup(`
                                    <b>${obs.species}</b><br/>
                                    Source: eBird<br/>
                                    Location: ${obs.location}<br/>
                                    Date: ${obs.date}
                                `)
                            .addTo(mapRef.current);
                        markersRef.current.push(marker);
                        bounds.extend([obs.lat, obs.lon]);
                    }
                });
            }

            // Add Local markers (Red or with Image)
            if (data.local) {
                const localIcon = L.icon({
                    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
                    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });

                data.local.forEach((obs: any) => {
                    if (obs.lat && obs.lon) {
                        const marker = L.marker([obs.lat, obs.lon], { icon: localIcon })
                            .bindPopup(`
                                    <b>${obs.species}</b><br/>
                                    Source: App User (${obs.user_name})<br/>
                                    Confidence: ${(obs.confidence * 100).toFixed(1)}%<br/>
                                    <div class="mt-2">
                                        <img src="${obs.image}" alt="${obs.species}" style="width: 100px; height: auto; border-radius: 4px;" />
                                    </div>
                                `)
                            .addTo(mapRef.current);
                        markersRef.current.push(marker);
                        bounds.extend([obs.lat, obs.lon]);
                    }
                });
            }

            if (markersRef.current.length > 0) {
                mapRef.current.fitBounds(bounds, { padding: [50, 50] });
            }
        }
    }

    if (!isLoggedIn) return null;

    return (
        <div className="bg-white py-24 sm:py-32 min-h-screen">
            <div className="mx-auto max-w-4xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl lg:mx-0 mb-8">
                    <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Observation Map</h2>
                    <p className="mt-2 text-lg leading-8 text-gray-600">
                        Search for a country to see animal observations from eBird and our community.
                    </p>
                </div>

                <form onSubmit={handleSearch} className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Enter country (e.g. Spain, USA)..."
                        className="flex-1 border border-gray-300 rounded-md px-3 py-2 text-lg"
                    />
                    <button
                        type="submit"
                        disabled={loading}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md font-semibold hover:bg-blue-500 disabled:opacity-50"
                    >
                        {loading ? "Searching..." : "Search"}
                    </button>
                </form>

                {error && (
                    <div className="rounded-md bg-red-50 p-4 mb-8">
                        <div className="flex">
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Error</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div
                    ref={mapContainerRef}
                    className="w-full h-[600px] rounded-lg shadow-lg border border-gray-200 z-0 relative"
                />
            </div>
        </div>
    );
}
