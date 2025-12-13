"use client";

import React, { useEffect, useState } from "react";
import { useAppSelector } from "../../lib/hooks";
import { token } from "../../lib/slices/tokensSlice";
import { useSearchParams, useRouter } from "next/navigation";

export default function LocateToMap() {
    const accessToken = useAppSelector(token);
    const [mapUrl, setMapUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [ebirdResults, setEbirdResults] = useState<any>(null);
    const [checkingEbird, setCheckingEbird] = useState(false);
    const searchParams = useSearchParams();
    const animalName = searchParams.get("name") || "";
    const router = useRouter();

    useEffect(() => {
        console.log("[DEBUG] useEffect triggered, animalName:", animalName);
        setLoading(true);
        // Pass animal name to backend if available
        const url = animalName
            ? `${process.env.NEXT_PUBLIC_API_URL}/maps/animal-to-map?name=${encodeURIComponent(animalName)}`
            : `${process.env.NEXT_PUBLIC_API_URL}/maps/animal-to-map`;
        fetch(url, {
            method: "GET",
            headers: {
                Authorization: `Bearer ${accessToken}`,
            },
        })
            .then(res => res.json())
            .then(data => {
                if (data.error) {
                    setError(data.error);
                } else if (data.map_url) {
                    setMapUrl(data.map_url);
                } else {
                    setError("No map found for this animal.");
                }
            })
            .catch(err => setError(err.message || "Unknown error"))
            .finally(() => setLoading(false));
        
        // Check for eBird observations if animal name is provided
        if (animalName) {
            console.log("[DEBUG] Calling checkEBirdObservations with:", animalName);
            checkEBirdObservations(animalName);
        } else {
            console.log("[DEBUG] No animalName, skipping eBird check");
        }
    }, [accessToken, animalName]);

    async function checkEBirdObservations(speciesName: string) {
        setCheckingEbird(true);
        const url = `${process.env.NEXT_PUBLIC_API_URL}/maps/ebird-observations-map?species=${encodeURIComponent(speciesName)}`;
        console.log("[DEBUG] Fetching eBird observations from:", url);
        console.log("[DEBUG] Access token available:", !!accessToken);
        try {
            const res = await fetch(url, {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });
            console.log("[DEBUG] Response status:", res.status, res.statusText);
            let data = null;
            if (res.ok) {
                data = await res.json();
            } else {
                const errorText = await res.text();
                console.log("[DEBUG] Error response:", errorText);
                data = { error: `HTTP ${res.status}: ${errorText}` };
            }
            console.log("[DEBUG] eBird API response:", data);
            if (data && data.observations && data.observations.length > 0) {
                console.log("[DEBUG] Setting eBird results with count:", data.count);
                setEbirdResults(data);
            } else {
                console.log("[DEBUG] No observations found or empty response");
            }
        } catch (err) {
            console.error("[DEBUG] Error checking eBird observations:", err);
        } finally {
            console.log("[DEBUG] Finished checking eBird observations");
            setCheckingEbird(false);
        }
    }

    // The animal name is now stored in the variable 'animalName'

    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-2xl px-6 lg:px-8">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-6">
                    Locate Animal on Map
                </h2>
                {animalName && (
                    <div className="mb-4 text-lg text-gray-700">Animal: <b>{animalName}</b></div>
                )}
                {loading && <div>Loading map...</div>}
                {error && <div className="text-red-600 font-semibold">{error}</div>}
                {mapUrl && (
                    <div className="mt-8">
                        <img src={mapUrl} alt="Animal location map" className="max-w-full h-auto rounded-lg shadow-md" />
                    </div>
                )}
                {checkingEbird && (
                    <div className="mt-6 text-gray-500">Checking for eBird observations...</div>
                )}
                {ebirdResults && ebirdResults.count > 0 && !checkingEbird && (
                    <div className="mt-6">
                        <button
                            onClick={() => {
                                router.push(`/image-to-animal/observations?species=${encodeURIComponent(animalName)}`);
                            }}
                            className="inline-flex items-center rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600"
                        >
                            View eBird Observations ({ebirdResults.count})
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
