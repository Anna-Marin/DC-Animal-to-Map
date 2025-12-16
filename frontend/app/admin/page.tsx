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
    full_name: string;
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

interface UserFormData {
    email: string;
    full_name: string;
    password?: string;
    is_active: boolean;
    is_superuser: boolean;
}

const initialUserFormData: UserFormData = {
    email: "",
    full_name: "",
    password: "",
    is_active: true,
    is_superuser: false,
};

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

    // User Modal State
    const [isUserModalOpen, setIsUserModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<"create" | "edit">("create");
    const [userFormData, setUserFormData] = useState<UserFormData>(initialUserFormData);

    const [ebirdParams, setEbirdParams] = useState({
        region_code: "ES",
        species: "",
        max_results: 100,
    });

    const [wildlifeParams, setWildlifeParams] = useState({
        image_url: "",
    });

    const [ninjasParams, setNinjasParams] = useState({
        animal_name: "",
    });

    const [mapsParams, setMapsParams] = useState({
        location: "",
    });

    interface ETLHistoryItem {
        fetched_at: string;
        status: string;
        error_message: string | null;
        data_count: number;
    }

    // ... existing interfaces ...

    // Data Viewer Modal State
    const [isDataModalOpen, setIsDataModalOpen] = useState(false);
    const [dataViewMode, setDataViewMode] = useState<"latest" | "history">("latest");
    const [currentData, setCurrentData] = useState<string>("");
    const [historyData, setHistoryData] = useState<ETLHistoryItem[]>([]);

    const handleViewData = async (provider: string) => {
        try {
            const data = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/etl/${provider}/results?limit=1`
            );
            if (data && data.length > 0) {
                setCurrentData(JSON.stringify(data[0], null, 2));
            } else {
                setCurrentData("No data found for this provider.");
            }
            setDataViewMode("latest");
            setIsDataModalOpen(true);
        } catch (error: any) {
            dispatch(
                addNotice({
                    title: "Fetch Error",
                    content: error.message || "Failed to fetch data",
                    icon: "error",
                })
            );
        }
    };

    const handleViewHistory = async (provider: string) => {
        try {
            const data = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/etl/${provider}/history?limit=20`
            );
            setHistoryData(data);
            setDataViewMode("history");
            setIsDataModalOpen(true);
        } catch (error: any) {
            dispatch(
                addNotice({
                    title: "Fetch Error",
                    content: error.message || "Failed to fetch history",
                    icon: "error",
                })
            );
        }
    }

    const handleCloseDataModal = () => {
        setIsDataModalOpen(false);
        setCurrentData("");
        setHistoryData([]);
    };

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
            let body: any = {
                region_code: "",
                species: "",
                max_results: 100,
                image_url: "",
                animal_name: "",
                location: ""
            };

            if (provider === "ebird") {
                body.region_code = ebirdParams.region_code;
                body.species = ebirdParams.species;
                body.max_results = ebirdParams.max_results;
            } else if (provider === "wildlife") {
                body.image_url = wildlifeParams.image_url;
            } else if (provider === "ninjas") {
                body.animal_name = ninjasParams.animal_name;
            } else if (provider === "maps") {
                body.location = mapsParams.location;
            }

            const data = await authFetch(
                `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/etl/${provider}/run`,
                {
                    method: "POST",
                    body: JSON.stringify(body),
                }
            );

            // Show the raw JSON result
            setCurrentData(JSON.stringify(data, null, 2));
            setDataViewMode("latest");
            setIsDataModalOpen(true);
        } catch (error: any) {
            dispatch(
                addNotice({
                    title: "Query Error",
                    content: error.message || "Failed to execute query",
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

    const handleOpenCreateModal = () => {
        setModalMode("create");
        setUserFormData(initialUserFormData);
        setIsUserModalOpen(true);
    };

    const handleOpenEditModal = (user: User) => {
        setModalMode("edit");
        if (user) {
            setEditingUser(user);
            setUserFormData({
                email: user.email,
                full_name: user.full_name || "",
                password: "", // Don't pre-fill password
                is_active: user.is_active,
                is_superuser: user.is_superuser,
            });
        }
        setIsUserModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsUserModalOpen(false);
        setEditingUser(null);
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading("saving_user");

        try {
            if (modalMode === "create") {
                await authFetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/create`,
                    {
                        method: "POST",
                        body: JSON.stringify(userFormData),
                    }
                );
                dispatch(addNotice({ title: "User Created", content: "User created successfully", icon: "success" }));
            } else {
                if (!editingUser) return;
                // Only send password if it's not empty, cleanup body
                const body: any = { ...userFormData };
                if (!body.password) delete body.password;

                await authFetch(
                    `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/${editingUser.id}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(body),
                    }
                );
                dispatch(addNotice({ title: "User Updated", content: "User updated successfully", icon: "success" }));
            }

            handleCloseModal();
            // Refresh list
            const data = await authFetch(`${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8888/api/v1"}/users/all`);
            setUserList(data);
        } catch (error: any) {
            dispatch(addNotice({ title: "Error", content: error.message || "Failed to save user", icon: "error" }));
        } finally {
            setLoading(null);
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

                                                {provider.id === "wildlife" && (
                                                    <div className="mt-4">
                                                        <div>
                                                            <label htmlFor="image_url" className="block text-sm font-medium text-gray-700">
                                                                Image URL
                                                            </label>
                                                            <input
                                                                type="text"
                                                                id="image_url"
                                                                value={wildlifeParams.image_url}
                                                                onChange={(e) => setWildlifeParams({ ...wildlifeParams, image_url: e.target.value })}
                                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm px-3 py-2 border"
                                                                placeholder="https://example.com/image.jpg"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {provider.id === "ninjas" && (
                                                    <div className="mt-4">
                                                        <div>
                                                            <label htmlFor="animal_name" className="block text-sm font-medium text-gray-700">
                                                                Animal Name
                                                            </label>
                                                            <input
                                                                type="text"
                                                                id="animal_name"
                                                                value={ninjasParams.animal_name}
                                                                onChange={(e) => setNinjasParams({ ...ninjasParams, animal_name: e.target.value })}
                                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm px-3 py-2 border"
                                                                placeholder="lion"
                                                            />
                                                        </div>
                                                    </div>
                                                )}

                                                {provider.id === "maps" && (
                                                    <div className="mt-4">
                                                        <div>
                                                            <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                                                                Location
                                                            </label>
                                                            <input
                                                                type="text"
                                                                id="location"
                                                                value={mapsParams.location}
                                                                onChange={(e) => setMapsParams({ ...mapsParams, location: e.target.value })}
                                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-rose-500 focus:ring-rose-500 sm:text-sm px-3 py-2 border"
                                                                placeholder="Barcelona"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="ml-6 flex space-x-3">
                                                <button
                                                    onClick={() => handleViewData(provider.id)}
                                                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                                                >
                                                    View Latest Result
                                                </button>
                                                <button
                                                    onClick={() => handleViewHistory(provider.id)}
                                                    className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                                                >
                                                    View History
                                                </button>
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
                                <div className="sm:flex sm:items-center">
                                    <div className="sm:flex-auto">
                                        <h2 className="text-xl font-bold text-gray-900">User Management</h2>
                                    </div>
                                    <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
                                        <button
                                            type="button"
                                            onClick={handleOpenCreateModal}
                                            className="block rounded-md bg-rose-600 px-3 py-2 text-center text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                                        >
                                            Add User
                                        </button>
                                    </div>
                                </div>
                                <div className="mt-4 overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
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
                                                            {user.full_name || "N/A"}
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
                                                                    onClick={() => handleOpenEditModal(user)}
                                                                    className="text-blue-600 hover:text-blue-900"
                                                                    title="Edit User"
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
                                                            <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${log.success ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
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
                {/* User Modal */}
                {isUserModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        {/* Overlay */}
                        <div
                            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                            aria-hidden="true"
                            onClick={handleCloseModal}
                        ></div>

                        {/* Modal Content */}
                        <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-lg sm:w-full sm:p-6 z-50">
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        {modalMode === "create" ? "Create New User" : "Edit User"}
                                    </h3>
                                    <div className="mt-4">
                                        <form onSubmit={handleSaveUser}>
                                            <div className="space-y-4">
                                                <div>
                                                    <label htmlFor="full_name" className="block text-sm font-medium text-gray-700">
                                                        Full Name
                                                    </label>
                                                    <input
                                                        type="text"
                                                        name="full_name"
                                                        id="full_name"
                                                        value={userFormData.full_name}
                                                        onChange={(e) => setUserFormData({ ...userFormData, full_name: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                                                        placeholder="John Doe"
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                                                        Email
                                                    </label>
                                                    <input
                                                        type="email"
                                                        name="email"
                                                        id="email"
                                                        required
                                                        value={userFormData.email}
                                                        onChange={(e) => setUserFormData({ ...userFormData, email: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                                                        placeholder="you@example.com"
                                                    />
                                                </div>
                                                <div>
                                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                                                        Password {modalMode === "edit" && "(Leave blank to keep current)"}
                                                    </label>
                                                    <input
                                                        type="password"
                                                        name="password"
                                                        id="password"
                                                        value={userFormData.password}
                                                        onChange={(e) => setUserFormData({ ...userFormData, password: e.target.value })}
                                                        className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-rose-500 focus:border-rose-500 sm:text-sm"
                                                    />
                                                </div>
                                                <div className="flex items-center space-x-4">
                                                    <div className="flex items-center">
                                                        <input
                                                            id="is_superuser"
                                                            name="is_superuser"
                                                            type="checkbox"
                                                            checked={userFormData.is_superuser}
                                                            onChange={(e) => setUserFormData({ ...userFormData, is_superuser: e.target.checked })}
                                                            className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
                                                        />
                                                        <label htmlFor="is_superuser" className="ml-2 block text-sm text-gray-900">
                                                            Admin User
                                                        </label>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <input
                                                            id="is_active"
                                                            name="is_active"
                                                            type="checkbox"
                                                            checked={userFormData.is_active}
                                                            onChange={(e) => setUserFormData({ ...userFormData, is_active: e.target.checked })}
                                                            className="h-4 w-4 text-rose-600 focus:ring-rose-500 border-gray-300 rounded"
                                                        />
                                                        <label htmlFor="is_active" className="ml-2 block text-sm text-gray-900">
                                                            Active
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                                <button
                                                    type="submit"
                                                    disabled={loading === "saving_user"}
                                                    className={`w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 text-base font-medium text-white sm:ml-3 sm:w-auto sm:text-sm ${loading === "saving_user" ? "bg-gray-400 cursor-not-allowed" : "bg-rose-600 hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"}`}
                                                >
                                                    {loading === "saving_user" ? "Saving..." : "Save"}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleCloseModal}
                                                    className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 sm:mt-0 sm:w-auto sm:text-sm"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Data Viewer Modal */}
                {isDataModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                        <div
                            className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
                            aria-hidden="true"
                            onClick={handleCloseDataModal}
                        ></div>

                        <div className="relative bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-4xl sm:w-full sm:p-6 z-50">
                            <div className="absolute top-0 right-0 pt-4 pr-4">
                                <button
                                    type="button"
                                    className="bg-white rounded-md text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500"
                                    onClick={handleCloseDataModal}
                                >
                                    <span className="sr-only">Close</span>
                                    <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <div className="sm:flex sm:items-start">
                                <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left w-full">
                                    <h3 className="text-lg leading-6 font-medium text-gray-900" id="modal-title">
                                        {dataViewMode === "latest" ? "Latest ETL Result" : "ETL History"}
                                    </h3>
                                    <div className="mt-4 bg-gray-50 rounded-md p-4 overflow-auto max-h-[60vh]">
                                        {dataViewMode === "latest" ? (
                                            <pre className="text-xs text-left whitespace-pre-wrap font-mono text-gray-800">
                                                {currentData}
                                            </pre>
                                        ) : (
                                            historyData.length === 0 ? (
                                                <p className="text-sm text-gray-500">No history found</p>
                                            ) : (
                                                <div className="space-y-4">
                                                    {historyData.map((item, index) => (
                                                        <div key={index} className="border-b border-gray-200 pb-4">
                                                            <div className="grid grid-cols-2 gap-2 text-sm">
                                                                <div><strong>Date:</strong> {new Date(item.fetched_at).toLocaleString()}</div>
                                                                <div><strong>Status:</strong> <span className={`px-2 py-1 rounded ${item.status === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{item.status}</span></div>
                                                                <div><strong>Data Count:</strong> {item.data_count}</div>
                                                                {item.error_message && <div className="col-span-2"><strong>Error:</strong> {item.error_message}</div>}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
                                <button
                                    type="button"
                                    onClick={handleCloseDataModal}
                                    className="w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-rose-500 sm:mt-0 sm:w-auto sm:text-sm"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main >
    );
}
