"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector, useAppDispatch } from "../lib/hooks";
import { profile, loggedIn, logout } from "../lib/slices/authSlice";
import { token } from "../lib/slices/tokensSlice";
import { useRouter } from "next/navigation";

export default function ImageToAnimal() {
    const accessToken = useAppSelector(token);
    const dispatch = useAppDispatch();
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const user = useAppSelector(profile);
    const isLoggedIn = useAppSelector(loggedIn);
    const router = useRouter();


    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!isLoggedIn) {
            router.push("/login?next=" + encodeURIComponent("/image-to-animal"));
        }
    }, [isLoggedIn, router]);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setFilePreview(URL.createObjectURL(selectedFile));
        }
    }


    // State for animal info and errors
    const [animalInfo, setAnimalInfo] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);
    const [isIdentifying, setIsIdentifying] = useState(false);

    async function identifyAnimal() {
        // Prevent multiple simultaneous requests
        if (isIdentifying) return;
        
        setIsIdentifying(true);
        setAnimalInfo(null);
        setError(null);
        if (!file) {
            setIsIdentifying(false);
            return;
        }

        const formData = new FormData();
        formData.append("file", file);

        const makeRequest = (tokenToUse: string) =>
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/image-to-animal-info`, {
                method: "POST",
                body: formData,
                headers: {
                    Authorization: `Bearer ${tokenToUse}`,
                },
            });

        try {
            const response = await makeRequest(accessToken);
            
            if (response.status === 401 || response.status === 403) {
                // Token expired - refresh and retry once
                await dispatch(require("../lib/slices/tokensSlice").refreshTokens());
                
                // Wait a bit for Redux state to update
                await new Promise(resolve => setTimeout(resolve, 100));
                
                // Get the fresh token from the store
                const state = require("../lib/store").store.getState();
                const newToken = state.tokens.access_token;
                
                // If no valid token after refresh, redirect to login
                if (!newToken) {
                    dispatch(logout());
                    router.push("/login");
                    setIsIdentifying(false);
                    return;
                }
                
                // Retry with new token
                const retryResponse = await makeRequest(newToken);
                
                if (!retryResponse.ok) {
                    dispatch(logout());
                    router.push("/login");
                    setIsIdentifying(false);
                    return;
                }
                
                const retryData = await retryResponse.json();
                if (retryData.error) {
                    setError(retryData.error);
                } else {
                    setAnimalInfo(retryData);
                }
                setIsIdentifying(false);
                return;
            }
            
            const data = await response.json();
            if (data.error) {
                setError(data.error);
            } else {
                setAnimalInfo(data);
            }
        } catch (err: any) {
            setError(err?.message || "Unknown error");
        } finally {
            setIsIdentifying(false);
        }
    }

    if (!mounted || !isLoggedIn) {
        return null;
    }

    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="flex flex-col lg:flex-row gap-12 mx-auto max-w-5xl">
                    {/* Left: Upload and preview */}
                    <div className="flex-1 max-w-md">
                        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">
                            Image to Animal
                        </h2>
                        <p className="mt-2 text-lg leading-8 text-gray-600">
                            Upload an image to identify the animal.
                        </p>
                        <div className="mt-8">
                            <label className="block text-sm font-medium leading-6 text-gray-900">
                                Add Image:
                            </label>
                            <div className="mt-2">
                                <input
                                    type="file"
                                    onChange={handleChange}
                                    className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none"
                                />
                            </div>
                            {filePreview && (
                                <>
                                    <div className="mt-6">
                                        <img src={filePreview} alt="Uploaded preview" className="max-w-full h-auto rounded-lg shadow-md" />
                                    </div>
                                    <button
                                        onClick={identifyAnimal}
                                        disabled={isIdentifying}
                                        className="mt-4 inline-flex items-center rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isIdentifying ? "Identifying..." : "Identify Animal"}
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (animalInfo && animalInfo.wildlife && animalInfo.wildlife.name) {
                                                router.push(`/image-to-animal/map?name=${encodeURIComponent(animalInfo.wildlife.name)}`);
                                            } else {
                                                router.push('/image-to-animal/map');
                                            }
                                        }}
                                        className="mt-2 ml-2 inline-flex items-center rounded-md bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                                    >
                                        Locate to Map
                                    </button>
                                </>
                            )}
                        </div>
                        {/* Show error if any */}
                        {error && (
                            <div className="mt-6 text-red-600 font-semibold">{error}</div>
                        )}
                    </div>
                    {/* Right: Results */}
                    <div className="flex-1">
                        {animalInfo && (
                            <div className="mt-0 lg:mt-10">
                                <h3 className="text-xl font-bold mb-2">Results</h3>
                                {animalInfo.wildlife && (
                                    <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                                        <h4 className="font-semibold text-lg mb-1">Wildlife API</h4>
                                        <ul className="text-gray-800">
                                            <li><b>Name:</b> {animalInfo.wildlife.name || "-"}</li>
                                            <li><b>Score:</b> {animalInfo.wildlife.score != null ? animalInfo.wildlife.score.toFixed(3) : "-"}</li>
                                            <li><b>Class:</b> {animalInfo.wildlife.class || "-"}</li>
                                            <li><b>Order:</b> {animalInfo.wildlife.order || "-"}</li>
                                            <li><b>Family:</b> {animalInfo.wildlife.family || "-"}</li>
                                            <li><b>Genus:</b> {animalInfo.wildlife.genus || "-"}</li>
                                            <li><b>Species:</b> {animalInfo.wildlife.species || "-"}</li>
                                        </ul>
                                    </div>
                                )}
                                {animalInfo.ninjas && (
                                    <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                                        <h4 className="font-semibold text-lg mb-1">Ninjas API</h4>
                                        {animalInfo.ninjas.error ? (
                                            <div className="text-red-600">{animalInfo.ninjas.error}</div>
                                        ) : (
                                            <ul className="text-gray-800">
                                                <li><b>Name:</b> {animalInfo.ninjas.name || "-"}</li>
                                                {animalInfo.ninjas.taxonomy && (
                                                    <li><b>Taxonomy:</b> {Object.entries(animalInfo.ninjas.taxonomy).map(([k, v]) => `${k}: ${v}`).join(", ")}</li>
                                                )}
                                                {animalInfo.ninjas.locations && (
                                                    <li><b>Locations:</b> {Array.isArray(animalInfo.ninjas.locations) ? animalInfo.ninjas.locations.join(", ") : animalInfo.ninjas.locations}</li>
                                                )}
                                                {animalInfo.ninjas.characteristics && (
                                                    <li><b>Characteristics:</b> {Object.entries(animalInfo.ninjas.characteristics).map(([k, v]) => `${k}: ${v}`).join(", ")}</li>
                                                )}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}