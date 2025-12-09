"use client";

import React, { useState, useEffect } from "react";
import { useAppSelector } from "../lib/hooks";
import { profile, loggedIn } from "../lib/slices/authSlice";
import { useRouter } from "next/navigation";

export default function ImageToAnimal() {
    const [filePreview, setFilePreview] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);
    const user = useAppSelector(profile);
    const isLoggedIn = useAppSelector(loggedIn);
    const router = useRouter();

    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        if (!isLoggedIn) {
            router.push("/login");
        }
    }, [isLoggedIn, router]);

    if (!mounted) return null;

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFile(selectedFile);
            setFilePreview(URL.createObjectURL(selectedFile));
        }
    }

    function identifyAnimal() {
        if (!file || !user.id) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("userId", user.id);

        fetch(`${process.env.NEXT_PUBLIC_API_URL}/identify-animal`, {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => console.log(data))
            .catch((error) => console.error(error));
    }

    if (!isLoggedIn) {
        return null;
    }

    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl lg:mx-0">
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
                                    className="mt-4 inline-flex items-center rounded-md bg-rose-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-rose-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                                >
                                    Identify Animal
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}