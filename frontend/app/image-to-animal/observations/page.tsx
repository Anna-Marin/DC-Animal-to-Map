"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useAppSelector } from "../../lib/hooks";
import { token } from "../../lib/slices/tokensSlice";
import { useSearchParams } from "next/navigation";

function EBirdObservationsContent() {
    const accessToken = useAppSelector(token);
    const [observations, setObservations] = useState<any[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const searchParams = useSearchParams();
    const speciesName = searchParams.get("species") || "";

    useEffect(() => {
        if (!speciesName) return;
        
        setLoading(true);
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/maps/ebird-observations-map?species=${encodeURIComponent(speciesName)}`, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setError(data.error);
                } else if (data.observations) {
                    setObservations(data.observations);
                } else {
                    setError("No observations found.");
                }
            })
            .catch(err => setError(err.message || "Unknown error"))
            .finally(() => setLoading(false));
    }, [accessToken, speciesName]);

    // Calculate color based on how recent the observation is
    function getMarkerColor(dateStr: string): string {
        const obsDate = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) return "#00ff00"; // Green - today/yesterday
        if (diffDays <= 7) return "#7fff00"; // Light green - this week
        if (diffDays <= 30) return "#ffff00"; // Yellow - this month
        if (diffDays <= 90) return "#ff8c00"; // Orange - last 3 months
        return "#ff0000"; // Red - older
    }

    function getColorLabel(dateStr: string): string {
        const obsDate = new Date(dateStr);
        const now = new Date();
        const diffDays = Math.floor((now.getTime() - obsDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 1) return "Today/Yesterday";
        if (diffDays <= 7) return "This week";
        if (diffDays <= 30) return "This month";
        if (diffDays <= 90) return "Last 3 months";
        return "Older";
    }

    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
                    eBird Observations: {speciesName}
                </h2>
                
                {loading && <div>Loading observations...</div>}
                {error && <div className="text-red-600 font-semibold">{error}</div>}
                
                {!loading && !error && observations.length > 0 && (
                    <>
                        <div className="mb-4 text-gray-700">
                            Found <b>{observations.length}</b> recent observations
                        </div>
                        
                        {/* Legend */}
                        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                            <h3 className="font-semibold mb-2">Color Legend (by recency):</h3>
                            <div className="flex flex-wrap gap-4">
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#00ff00"}}></div>
                                    <span>Today/Yesterday</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#7fff00"}}></div>
                                    <span>This week</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#ffff00"}}></div>
                                    <span>This month</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#ff8c00"}}></div>
                                    <span>Last 3 months</span>
                                </div>
                                <div className="flex items-center">
                                    <div className="w-4 h-4 rounded-full mr-2" style={{backgroundColor: "#ff0000"}}></div>
                                    <span>Older</span>
                                </div>
                            </div>
                        </div>

                        {/* Map - Using Leaflet for interactive markers */}
                        <div className="mb-8">
                            <div id="map" className="w-full h-96 rounded-lg border border-gray-300">
                                {/* Simple static map with markers - you can enhance with Leaflet */}
                                <div className="relative w-full h-full bg-gray-100 rounded-lg overflow-hidden">
                                    <iframe
                                        width="100%"
                                        height="100%"
                                        style={{border: 0}}
                                        loading="lazy"
                                        src={`https://www.openstreetmap.org/export/embed.html?bbox=${getLonExtent()}&layer=mapnik&marker=${getCenterCoords()}`}
                                    ></iframe>
                                </div>
                            </div>
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

    function getCenterCoords(): string {
        if (observations.length === 0) return "0,0";
        const avgLat = observations.reduce((sum, o) => sum + (o.lat || 0), 0) / observations.length;
        const avgLon = observations.reduce((sum, o) => sum + (o.lon || 0), 0) / observations.length;
        return `${avgLat},${avgLon}`;
    }

    function getLonExtent(): string {
        if (observations.length === 0) return "-180,-90,180,90";
        const lats = observations.map(o => o.lat || 0);
        const lons = observations.map(o => o.lon || 0);
        const minLon = Math.min(...lons) - 1;
        const minLat = Math.min(...lats) - 1;
        const maxLon = Math.max(...lons) + 1;
        const maxLat = Math.max(...lats) + 1;
        return `${minLon},${minLat},${maxLon},${maxLat}`;
    }
}

export default function EBirdObservations() {
    return (
        <Suspense fallback={<div>Loading...</div>}>
            <EBirdObservationsContent />
        </Suspense>
    );
}
