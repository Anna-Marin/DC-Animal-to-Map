import React from "react";

interface ChartProps {
    title: string;
    data: Record<string, number>;
    color: string;
    height?: string;
    unit?: string;
}

export function BarChart({ title, data, color, height = "h-40", unit = "%" }: ChartProps) {
    if (!data || Object.keys(data).length === 0) return null;

    const entries = Object.entries(data);
    const maxValue = Math.max(...Object.values(data)) || 1;

    return (
        <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
            <div className={`flex items-end gap-1 ${height}`}>
                {entries.map(([label, value]) => (
                    <div key={label} className="flex-1 flex flex-col items-center justify-end group relative h-full">
                        {/* Tooltip */}
                        <div className="absolute bottom-full mb-2 hidden group-hover:block z-10 w-auto p-2 bg-gray-800 text-white text-xs rounded shadow-lg">
                            {label}: {value}{unit}
                        </div>

                        <div
                            className={`w-full rounded-t transition-all duration-500 ease-out`}
                            style={{
                                height: `${(value / maxValue) * 100}%`,
                                backgroundColor: color
                            }}
                        ></div>
                        <div className="mt-2 text-[10px] text-gray-500 truncate w-full text-center">
                            {label.includes(":") ? label.split(":")[0] : label.substring(0, 3)}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

interface RecommendationProps {
    data: {
        optimal_time?: string;
        activity_level?: string;
        confidence?: string;
        tip?: string;
    };
}

export function RecommendationsCard({ data }: RecommendationProps) {
    if (!data) return null;

    return (
        <div className="bg-gradient-to-br from-indigo-50 to-blue-50 p-6 rounded-lg border border-blue-100 shadow-sm">
            <h3 className="text-lg font-bold text-blue-900 mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                AI Insights
            </h3>
            <div className="space-y-4">
                {data.optimal_time && (
                    <div>
                        <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Best Time to Observe</p>
                        <p className="text-lg font-semibold text-gray-800">{data.optimal_time}</p>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                    {data.activity_level && (
                        <div>
                            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Activity Level</p>
                            <p className="text-base font-semibold text-gray-800">{data.activity_level}</p>
                        </div>
                    )}
                    {data.confidence && (
                        <div>
                            <p className="text-sm font-medium text-blue-600 uppercase tracking-wide">Confidence</p>
                            <p className="text-base font-semibold text-gray-800">{data.confidence}</p>
                        </div>
                    )}
                </div>

                {data.tip && (
                    <div className="bg-white/60 p-3 rounded border border-blue-100 mt-2">
                        <p className="text-sm text-blue-800 italic">"{data.tip}"</p>
                    </div>
                )}
            </div>
        </div>
    );
}
