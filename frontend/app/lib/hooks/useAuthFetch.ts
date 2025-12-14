import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector, useAppDispatch } from '../hooks';
import { token } from '../slices/tokensSlice';
import { logout } from '../slices/authSlice';

export function useAuthFetch() {
    const accessToken = useAppSelector(token);
    const dispatch = useAppDispatch();
    const router = useRouter();

    return useCallback(async (url: string, options?: RequestInit) => {
        const res = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
                ...options?.headers,
            },
        });

        if (res.status === 401 || res.status === 403) {
            dispatch(logout());
            router.push('/login');
            throw new Error('Unauthorized');
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.detail || errorData.error || `HTTP ${res.status}`);
        }

        return res.json();
    }, [accessToken, dispatch, router]);
}
