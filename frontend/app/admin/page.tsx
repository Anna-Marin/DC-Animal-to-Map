"use client"

import { isAdmin } from "../lib/slices/authSlice"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { addNotice } from "../lib/slices/toastsSlice"
import { useAppDispatch, useAppSelector } from "../lib/hooks"
import { useAuthFetch } from "../lib/hooks/useAuthFetch"
import { useProtectedRoute } from "../lib/hooks/useProtectedRoute"
interface ETLProvider {
    id: string;
    name: string;
    description: string;
}

interface user{
    name:string;
    email: string;
    id:string;
}
let userList: user[] =[]
const userQuery =`
        {
            name
            email
            id
        }
    `

const etlProviders: ETLProvider[] = [
    { id: "wildlife", name: "Wildlife API", description: "Fetch wildlife data from Wildlife API" },
    { id: "ninjas", name: "API Ninjas", description: "Fetch animal data from API Ninjas" },
    { id: "maps", name: "Maps Data", description: "Fetch geographic map data" },
    { id: "ebird", name: "eBird", description: "Fetch bird observation data from eBird" },
];


export default function AdminPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const isLoggedIn = useProtectedRoute("/admin");
    const isUserAdmin = useAppSelector((state) => isAdmin(state));
    const authFetch = useAuthFetch();

    const [loading, setLoading] = useState<string | null>(null);
    const [ebirdParams, setEbirdParams] = useState({
        region_code: "ES",
        species: "",
        max_results: 100,
    });
    
  

    useEffect(() => {
        if (isLoggedIn && !isUserAdmin) {
            dispatch(
                addNotice({
                    title: "Access Denied",
                    content: "You don't have permission to access this page.",
                    icon: "error",
                })
            );
            router.push("/");
        }
    }, [isLoggedIn, isUserAdmin, router, dispatch]);

    if (!isLoggedIn || !isUserAdmin) {
        return null;
    }

    const handleRunETL = async (provider: string) => {
        setLoading(provider);
        try {
            let body: any = {};

            if (provider === "ebird") {
                body = ebirdParams;
            }

            const data = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/etl/${provider}/run`,
                {
                    method: "POST",
                    body: JSON.stringify(body),
                }
            );

            dispatch(
                addNotice({
                    title: "ETL Started",
                    content: data.message || `ETL for ${provider} started successfully`,
                    icon: "success",
                })
            );
        } catch (error: any) {
            dispatch(
                addNotice({
                    title: "ETL Error",
                    content: error.message || "Failed to start ETL process",
                    icon: "error",
                })
            );
        } finally {
            setLoading(null);
        }
    };
 async function UserList() {
    let tempList:user[]=[]
     fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/all`,
        {
            method: "GET",
            
        }
    ).then(response => response.json())
    .then(data=>tempList=data)
    userList = tempList;
     return (
    <div>
      <ul>
        {
          userList.map(user=>
            <>
            <li>{user.name}</li>
            <li>{user.id}</li>
            <li>{user.email}</li>
            </>
          )
        }
      </ul>
    </div>
     )
 }

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
                        <p className="text-sm text-gray-600 mb-8">
                            Manage and trigger ETL processes for all data providers
                        </p>
                        <div className="space-y-6">
                            {etlProviders.map((provider) => (
                                <div
                                    key={provider.id}
                                    className="border border-gray-200 rounded-lg p-6 hover:border-rose-500 transition-colors"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <h3 className="text-lg font-medium text-gray-900">
                                                {provider.name}
                                            </h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                {provider.description}
                                            </p>

                                            {provider.id === "ebird" && (
                                                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
                                                    <div>
                                                        <label htmlFor="region_code" className="block text-sm font-medium text-gray-700">
                                                            Region Code
                                                        </label>
                                                        <input
                                                            type="text"
                                                            id="region_code"
                                                            value={ebirdParams.region_code}
                                                            onChange={(e) => setEbirdParams({ ...ebirdParams, region_code: e.target.value })}
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm px-3 py-2 border"
                                                            placeholder="ES"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor="species" className="block text-sm font-medium text-gray-700">
                                                            Species (optional)
                                                        </label>
                                                        <input
                                                            type="text"
                                                            id="species"
                                                            value={ebirdParams.species}
                                                            onChange={(e) => setEbirdParams({ ...ebirdParams, species: e.target.value })}
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm px-3 py-2 border"
                                                            placeholder="Leave empty for all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label htmlFor="max_results" className="block text-sm font-medium text-gray-700">
                                                            Max Results
                                                        </label>
                                                        <input
                                                            type="number"
                                                            id="max_results"
                                                            value={ebirdParams.max_results}
                                                            onChange={(e) => setEbirdParams({ ...ebirdParams, max_results: parseInt(e.target.value) || 100 })}
                                                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm px-3 py-2 border"
                                                            placeholder="100"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-6">
                                            <button
                                                onClick={() => handleRunETL(provider.id)}
                                                disabled={loading === provider.id}
                                                className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white ${loading === provider.id
                                                        ? "bg-gray-400 cursor-not-allowed"
                                                        : "bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                                                    }`}
                                            >
                                                {loading === provider.id ? (
                                                    <>
                                                        <svg
                                                            className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                                                            xmlns="http://www.w3.org/2000/svg"
                                                            fill="none"
                                                            viewBox="0 0 24 24"
                                                        >
                                                            <circle
                                                                className="opacity-25"
                                                                cx="12"
                                                                cy="12"
                                                                r="10"
                                                                stroke="currentColor"
                                                                strokeWidth="4"
                                                            ></circle>
                                                            <path
                                                                className="opacity-75"
                                                                fill="currentColor"
                                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                                            ></path>
                                                        </svg>
                                                        Running...
                                                    </>
                                                ) : (
                                                    "Run ETL"
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                            <div className="space-y-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-lg font-medium text-gray-900">
                                            User List:
                                        </h3>
                                            {UserList()}
                                    </div>
                                </div>
                            </div>
                    </div>
                </div>
            </div>
        </main>
    );
}
