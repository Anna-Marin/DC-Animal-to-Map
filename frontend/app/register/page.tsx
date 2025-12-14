"use client"

import { useAppDispatch, useAppSelector } from "../lib/hooks"
import { register, loggedIn } from "../lib/slices/authSlice"
import { addNotice } from "../lib/slices/toastsSlice"
import { useRouter } from "next/navigation"
import { Suspense, useEffect, useState } from "react"
import {
    FieldValues,
    useForm,
} from "react-hook-form";
import Link from "next/link";

const schema = {
    email: { required: true },
    fullName: { required: false },
    password: { required: true, minLength: 8, maxLength: 64 },
    confirmPassword: { required: true, minLength: 8, maxLength: 64 },
    shareLocation: { required: false },
};

const renderError = (type: string) => {
    const style =
        "absolute left-5 top-0 translate-y-full w-48 px-2 py-1 bg-gray-700 rounded-lg text-center text-white text-sm after:content-[''] after:absolute after:left-1/2 after:bottom-[100%] after:-translate-x-1/2 after:border-8 after:border-x-transparent after:border-t-transparent after:border-b-gray-700";
    switch (type) {
        case "required":
            return <div className={style}>This field is required.</div>;
        case "minLength":
        case "maxLength":
            return (
                <div className={style}>
                    Your password must be between 8 and 64 characters long.
                </div>
            );
        case "validate":
            return <div className={style}>Passwords do not match.</div>;
        default:
            return <></>;
    }
};

const redirectAfterLogin = "/";

function UnsuspendedPage() {
    const dispatch = useAppDispatch()
    const isLoggedIn = useAppSelector((state) => loggedIn(state))
    const router = useRouter();

    const [location, setLocation] = useState<string>("");
    const [latitude, setLatitude] = useState<number | null | undefined>(null);
    const [longitude, setLongitude] = useState<number | null | undefined>(null);

    const geocodeLocation = async (address: string) => {
        if (!address.trim()) {
            setLatitude(null);
            setLongitude(null);
            return;
        }
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/maps/geocode?address=${encodeURIComponent(address)}`
            );
            const data = await response.json();

            if (data.latitude && data.longitude) {
                setLatitude(data.latitude);
                setLongitude(data.longitude);
            } else {
                dispatch(
                    addNotice({
                        title: "Location Not Found",
                        content: data.error || "Could not find coordinates for the entered location.",
                        icon: "error",
                    }),
                );
                setLatitude(null);
                setLongitude(null);
            }
        } catch (error) {
            console.error("Geocoding error:", error);
            dispatch(
                addNotice({
                    title: "Geocoding Error",
                    content: "Error fetching location coordinates.",
                    icon: "error",
                }),
            );
            setLatitude(null);
            setLongitude(null);
        }
    };

    const handleLocationChange = (value: string) => {
        setLocation(value);
    };

    const handleLocationBlur = () => {
        geocodeLocation(location);
    };

    const redirectTo = (route: string) => {
        router.push(route);
    };

    const {
        register: formRegister,
        handleSubmit,
        watch,
        formState: { errors },
    } = useForm();

    const password = watch("password");

    async function submit(data: FieldValues) {
        console.log("[REGISTER PAGE] Form submitted with data:", data);
        console.log("[REGISTER PAGE] Coordinates:", { latitude, longitude });

        try {
            await dispatch(
                register({
                    email: data["email"],
                    password: data["password"],
                    fullName: data["fullName"],
                    latitude: latitude,
                    longitude: longitude,
                }),
            );
            console.log("[REGISTER PAGE] Register action dispatched");
        } catch (error) {
            console.error("[REGISTER PAGE] Submit error:", error);
        }
    }

    useEffect(() => {
        if (isLoggedIn) return redirectTo(redirectAfterLogin);
    }, [isLoggedIn]); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <main className="flex min-h-full">
            <div className="flex flex-1 flex-col justify-center py-12 px-4 sm:px-6 lg:flex-none lg:px-20 xl:px-24">
                <div className="mx-auto w-full max-w-sm lg:w-96">
                    <div>
                        <img
                            className="h-12 w-auto"
                            src="https://tailwindui.com/img/logos/mark.svg?color=rose&shade=500"
                            alt="Your Company"
                        />
                        <h2 className="mt-6 text-3xl font-bold tracking-tight text-gray-900">
                            Create an account
                        </h2>
                        <p className="mt-2 text-sm text-gray-600">
                            Or{" "}
                            <Link
                                href="/login"
                                className="font-medium text-rose-600 hover:text-rose-500"
                            >
                                sign in to your existing account
                            </Link>
                        </p>
                    </div>

                    <div className="mt-6">
                        <form
                            onSubmit={handleSubmit(submit)}
                            className="space-y-6"
                        >
                            <div>
                                <label
                                    htmlFor="email"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Email address
                                </label>
                                <div className="mt-1 group relative inline-block w-full">
                                    <input
                                        {...formRegister("email", schema.email)}
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
                                    />
                                    {errors.email && renderError(errors.email.type as string)}
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="fullName"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Full Name
                                </label>
                                <div className="mt-1 group relative inline-block w-full">
                                    <input
                                        {...formRegister("fullName", schema.fullName)}
                                        id="fullName"
                                        name="fullName"
                                        type="text"
                                        autoComplete="name"
                                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="password"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Password
                                </label>
                                <div className="mt-1 group relative inline-block w-full">
                                    <input
                                        {...formRegister("password", schema.password)}
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="new-password"
                                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
                                    />
                                    {errors.password && renderError(errors.password.type as string)}
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="confirmPassword"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Confirm Password
                                </label>
                                <div className="mt-1 group relative inline-block w-full">
                                    <input
                                        {...formRegister("confirmPassword", {
                                            ...schema.confirmPassword,
                                            validate: (value) =>
                                                value === password || "The passwords do not match",
                                        })}
                                        id="confirmPassword"
                                        name="confirmPassword"
                                        type="password"
                                        autoComplete="new-password"
                                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
                                    />
                                    {errors.confirmPassword && renderError(errors.confirmPassword.type as string)}
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="location"
                                    className="block text-sm font-medium text-gray-700"
                                >
                                    Location (optional)
                                </label>
                                <div className="mt-1 group relative inline-block w-full">
                                    <input
                                        value={location}
                                        onChange={(e) => handleLocationChange(e.target.value)}
                                        onBlur={handleLocationBlur}
                                        id="location"
                                        name="location"
                                        type="text"
                                        placeholder="Enter city or address"
                                        className="block w-full appearance-none rounded-md border border-gray-300 px-3 py-2 placeholder-gray-400 shadow-sm focus:border-rose-600 focus:outline-none focus:ring-rose-600 sm:text-sm"
                                    />
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="flex w-full justify-center rounded-md border border-transparent bg-rose-500 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
                            >
                                Register
                            </button>
                        </form>
                    </div>
                </div>
            </div>
            <div className="relative hidden w-0 flex-1 lg:block">
                <img
                    className="absolute inset-0 h-full w-full object-cover"
                    src="https://images.unsplash.com/photo-1561487138-99ccf59b135c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=764&q=80"
                    alt=""
                />
            </div>
        </main>
    );
}

export default function Page() {
    return <Suspense><UnsuspendedPage /></Suspense>
}
