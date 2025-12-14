import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '../hooks';
import { loggedIn } from '../slices/authSlice';

export function useProtectedRoute(redirectPath?: string) {
    const isLoggedIn = useAppSelector(loggedIn);
    const router = useRouter();

    useEffect(() => {
        if (!isLoggedIn) {
            const next = redirectPath || window.location.pathname;
            router.push(`/login?next=${encodeURIComponent(next)}`);
        }
    }, [isLoggedIn, router, redirectPath]);

    return isLoggedIn;
}
