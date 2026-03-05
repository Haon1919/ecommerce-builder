'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function StoreIndex() {
    const router = useRouter();
    useEffect(() => {
        router.replace('/demo');
    }, [router]);
    return null;
}
