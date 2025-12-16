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

interface User {
    id: string;
    email: string;
    fullName: string;
    is_active: boolean;
    is_superuser: boolean;
}

const etlProviders: ETLProvider[] = [
    { id: "wildlife", name: "Wildlife API", description: "Fetch wildlife data from Wildlife API" },
    { id: "ninjas", name: "API Ninjas", description: "Fetch animal data from API Ninjas" },
    { id: "maps", name: "Maps Data", description: "Fetch geographic map data" },
    { id: "ebird", name: "eBird", description: "Fetch bird observation data from eBird" },
];


interface LoginLog {
    id: string;
    email: string;
    timestamp: string;
    success: boolean;
}

export default function AdminPage() {
    const dispatch = useAppDispatch();
    const router = useRouter();
    const isLoggedIn = useProtectedRoute("/admin");
    const isUserAdmin = useAppSelector((state) => isAdmin(state));
    const authFetch = useAuthFetch();

    const [loading, setLoading] = useState<string | null>(null);
    const [userList, setUserList] = useState<User[]>([]);
    const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
    const [activeTab, setActiveTab] = useState<"etl" | "users" | "logs">("etl");
    const [isMounted, setIsMounted] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [ebirdParams, setEbirdParams] = useState({
        region_code: "ES",
        species: "",
        max_results: 100,
    });

    useEffect(() => {
        setIsMounted(true);
    }, []);

    useEffect(() => {
        if (isMounted && isLoggedIn && !isUserAdmin) {
            dispatch(
                addNotice({
                    title: "Access Denied",
                    content: "You don't have permission to access this page.",
                    icon: "error",
                })
            );
            router.push("/");
        }
    }, [isMounted, isLoggedIn, isUserAdmin, router, dispatch]);

    useEffect(() => {
        if (isMounted && isLoggedIn && isUserAdmin) {
            const fetchUsers = async () => {
                try {
                    const data = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/all`);
                    setUserList(data);
                } catch (error) {
                    console.error("Failed to fetch users", error);
                }
            };
            const fetchLogs = async () => {
                try {
                    const data = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/logs/`);
                    setLoginLogs(data);
                } catch (error) {
                    console.error("Failed to fetch login logs", error);
                }
            };

            fetchUsers();
            fetchLogs();
        }
    }, [isMounted, isLoggedIn, isUserAdmin, authFetch]);

    if (!isMounted || !isLoggedIn || !isUserAdmin) {
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

    const handleDeleteUser = async (userId: string) => {
        if (!confirm("Are you sure you want to delete this user?")) return;

        try {
            await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/${userId}`,
                { method: "DELETE" }
            );
            dispatch(
                addNotice({
                    title: "User Deleted",
                    content: "User has been successfully deleted",
                    icon: "success",
                })
            );
            // Refresh user list
            const data = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/all`);
            setUserList(data);
        } catch (error: any) {
            dispatch(
                addNotice({
                    title: "Delete Error",
                    content: error.message || "Failed to delete user",
                    icon: "error",
                })
            );
        }
    };

    const handleToggleRole = async (userId: string, currentRole: boolean) => {
        const newRole = currentRole ? "user" : "admin";

        try {
            await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/${userId}/role?role=${newRole}`,
                { method: "PUT" }
            );
            dispatch(
                addNotice({
                    title: "Role Updated",
                    content: `User role changed to ${newRole}`,
                    icon: "success",
                })
            );
            // Refresh user list
            const data = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/all`);
            setUserList(data);
        } catch (error: any) {
            dispatch(
                addNotice({
                    title: "Update Error",
                    content: error.message || "Failed to update user role",
                    icon: "error",
                })
            );
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-white shadow sm:rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
                        <p className="text-sm text-gray-600 mb-8">
                            Manage application settings, users, and logs
                        </p>

                        {/* Tabs */}
                        <div className="border-b border-gray-200 mb-6">
                            <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                                <button
                                    onClick={() => setActiveTab('etl')}
                                    className={`${activeTab === 'etl'
                                            ? 'border-rose-500 text-rose-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    ETL Processes
                                </button>
                                <button
                                    onClick={() => setActiveTab('users')}
                                    className={`${activeTab === 'users'
                                            ? 'border-rose-500 text-rose-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    User Management
                                </button>
                                <button
                                    onClick={() => setActiveTab('logs')}
                                    className={`${activeTab === 'logs'
                                            ? 'border-rose-500 text-rose-600'
                                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                        } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                                >
                                    Login Logs
                                </button>
                            </nav>
                        </div>

                        {activeTab === 'etl' && (
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
                        )}

                        {/* User Management Section */}
                        {activeTab === 'users' && (
                            <div className="mt-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">User Management</h2>
                                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                                    Name
                                                </th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Email
                                                </th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Role
                                                </th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Status
                                                </th>
                                                <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                                    <span className="sr-only">Actions</span>
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {userList.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="px-3 py-4 text-sm text-gray-500 text-center">
                                                        No users found
                                                    </td>
                                                </tr>
                                            ) : (
                                                userList.map((user) => (
                                                    <tr key={user.id}>
                                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                            {user.fullName || "N/A"}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            {user.email}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${user.is_superuser ? "bg-purple-100 text-purple-800" : "bg-green-100 text-green-800"
                                                                }`}>
                                                                {user.is_superuser ? "Admin" : "User"}
                                                            </span>
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${user.is_active ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                                }`}>
                                                                {user.is_active ? "Active" : "Inactive"}
                                                            </span>
                                                        </td>
                                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => handleToggleRole(user.id, user.is_superuser)}
                                                                    className="text-indigo-600 hover:text-indigo-900"
                                                                    title={user.is_superuser ? "Demote to User" : "Promote to Admin"}
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => handleDeleteUser(user.id)}
                                                                    className="text-red-600 hover:text-red-900"
                                                                    title="Delete User"
                                                                >
                                                                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* Login Logs Section */}
                        {activeTab === 'logs' && (
                            <div className="mt-6">
                                <h2 className="text-xl font-bold text-gray-900 mb-6">Login History</h2>
                                <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
                                    <table className="min-w-full divide-y divide-gray-300">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                                    Email
                                                </th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Date & Time
                                                </th>
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Status
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200 bg-white">
                                            {loginLogs.length === 0 ? (
                                                <tr>
                                                    <td colSpan={3} className="px-3 py-4 text-sm text-gray-500 text-center">
                                                        No login logs found
                                                    </td>
                                                </tr>
                                            ) : (
                                                loginLogs.map((log) => (
                                                    <tr key={log.id}>
                                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                            {log.email}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            {new Date(log.timestamp).toLocaleString()}
                                                        </td>
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                                                                log.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                                            }`}>
                                                                {log.success ? "Success" : "Failed"}
                                                            </span>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}

