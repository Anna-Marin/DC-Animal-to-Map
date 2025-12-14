"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { BarChart, RecommendationsCard } from "../components/AnalyticsCharts";
import { useAuthFetch } from "../lib/hooks/useAuthFetch";
import { useProtectedRoute } from "../lib/hooks/useProtectedRoute";

export default function AnalyticsPage() {
    const router = useRouter();
    const isLoggedIn = useProtectedRoute("/analytics");
    const authFetch = useAuthFetch();

    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    // Form states
    const [species, setSpecies] = useState("");
    const [days, setDays] = useState(60);
    const [includeHabitat, setIncludeHabitat] = useState(true);

    if (!isLoggedIn) {
        return null;
    }

    async function fetchAnalytics() {
        setLoading(true);
        setError(null);
        setData(null);

        const queryParams = new URLSearchParams();
        if (species) queryParams.append("species", species);
        queryParams.append("days", String(days));
        queryParams.append("include_habitat", String(includeHabitat));

        try {
            const url = `${process.env.NEXT_PUBLIC_API_URL}/analytics/temporal-patterns?${queryParams.toString()}`;
            const result = await authFetch(url);
            setData(result);
        } catch (err: any) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    }

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        fetchAnalytics();
    }

    return (
        <div className="bg-white py-24 sm:py-32 min-h-screen">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl mb-2">
                    Temporal Activity Patterns
                </h2>
                <p className="text-lg text-gray-600 mb-8">
                    Multi-source analysis combining eBird observations, Wildlife API, Ninjas API, and local database
                </p>

                <div className="bg-gray-50 p-6 rounded-lg mb-8">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <h3 className="text-xl font-semibold mb-2">Analysis Parameters</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium mb-1">Species (optional)</label>
                                <input
                                    type="text"
                                    value={species}
                                    onChange={(e) => setSpecies(e.target.value)}
                                    placeholder="Leave empty for all species"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">e.g., Blue Jay, eagle, sparrow</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Days to analyze</label>
                                <input
                                    type="number"
                                    value={days}
                                    onChange={(e) => setDays(parseInt(e.target.value))}
                                    min="7"
                                    max="365"
                                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                                />
                                <p className="text-xs text-gray-500 mt-1">Range: 7-365 days</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium mb-1">Include habitat analysis</label>
                                <div className="flex items-center h-[42px]">
                                    <input
                                        type="checkbox"
                                        checked={includeHabitat}
                                        onChange={(e) => setIncludeHabitat(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded mr-2"
                                    />
                                    <span className="text-sm text-gray-700">Fetch from Wildlife/Ninjas APIs</span>
                                </div>
                            </div>
                        </div>
                        <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md font-semibold hover:bg-blue-500">
                            Analyze Temporal Patterns
                        </button>
                    </form>
                </div>

                {loading && (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Analyzing data...</p>
                    </div>
                )}

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-8">
                        <p className="text-red-800 font-semibold">Error: {error}</p>
                    </div>
                )}

                {data && !loading && (
                    <div className="space-y-8 animate-fade-in-up">
                        {data.total_observations === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                                <h3 className="text-lg font-medium text-yellow-800 mb-2">No Data Found</h3>
                                <p className="text-yellow-700">
                                    {data.message || "No observations found for these parameters."}
                                </p>
                                <p className="text-sm text-yellow-600 mt-2">
                                    Try expanding the date range or searching for a common species (e.g., "sparrow", "duck").
                                </p>
                            </div>
                        ) : (
                            <>
                                {/* Recommendations & Insights */}
                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-1">
                                        <RecommendationsCard data={data.recommendations} />
                                    </div>
                                    <div className="lg:col-span-2 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
                                        <h3 className="text-lg font-bold text-gray-800 mb-4">Habitat Analysis</h3>
                                        {data.habitat_correlation ? (
                                            <div className="space-y-4">
                                                <div className="flex items-center">
                                                    <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full uppercase font-bold mr-3">
                                                        {data.habitat_correlation.primary_habitat}
                                                    </span>
                                                    <span className="text-gray-600 text-sm">Primary Habitat</span>
                                                </div>
                                                <p className="text-gray-800 font-medium">
                                                    {data.habitat_correlation.analysis}
                                                </p>
                                            </div>
                                        ) : (
                                            <p className="text-gray-500 italic">No habitat data available for correlation.</p>
                                        )}

                                        {data.species_behavior && (
                                            <div className="mt-6 border-t pt-4">
                                                <h4 className="text-sm font-semibold text-gray-700 mb-2">Species Behavior Profile</h4>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase">Diet</p>
                                                        <p className="text-sm font-medium">{data.species_behavior.diet || "Unknown"}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-gray-500 uppercase">Habitat</p>
                                                        <p className="text-sm font-medium">{data.species_behavior.habitat || "Unknown"}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Charts Grid */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                    <BarChart
                                        title="Hourly Activity (24h)"
                                        data={data.hourly_distribution}
                                        color="#3b82f6"
                                    />
                                    <BarChart
                                        title="Seasonal Activity (Months)"
                                        data={data.seasonal_distribution}
                                        color="#f97316"
                                    />
                                </div>

                                {/* Data Quality Footer */}
                                <div className="mt-8 pt-6 border-t border-gray-200">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Data Quality & Sources</h4>
                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-600">
                                        <div>
                                            <span className="block font-bold text-gray-900">{data.data_quality.observation_count}</span>
                                            Total Observations
                                        </div>
                                        <div>
                                            <span className="block font-bold text-gray-900">{data.data_quality.unique_locations}</span>
                                            Unique Locations
                                        </div>
                                        <div>
                                            <span className="block font-bold text-gray-900">{data.data_sources_used.join(", ")}</span>
                                            Data Sources
                                        </div>
                                        <div>
                                            <span className="block font-bold text-gray-900">{data.period}</span>
                                            Analysis Period
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
