'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Lock, User, Loader2, ArrowRight, Eye, EyeOff, Scale } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://34.225.151.29';

export default function AuthPage() {
    const router = useRouter();

    const [mode, setMode] = useState<'signin' | 'signup'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [gender, setGender] = useState<string>('');
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [remember, setRemember] = useState(false);

    // If already logged in, redirect to chat
    useEffect(() => {
        const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
        const userStr = localStorage.getItem('auth_user') || sessionStorage.getItem('auth_user');
        if (token && userStr) {
            router.push('/chat');
        }
    }, [router]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (mode === 'signup' && password !== confirmPassword) {
            setError("Passwords do not match");
            return;
        }

        setLoading(true);

        try {
            const endpoint = mode === 'signup' ? '/auth/signup' : '/auth/signin';

            const body: Record<string, string> = { email, password };
            if (mode === 'signup') {
                body.full_name = fullName;
                if (gender) body.gender = gender;
            }

            const res = await fetch(`${API_BASE}${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            const data = await res.json();

            if (!res.ok) {
                setError(data.detail || 'Something went wrong');
                return;
            }

            // Backend returns: { access_token, token_type, user: { id, email, full_name, gender } }
            const storage = remember ? localStorage : sessionStorage;
            storage.setItem('auth_token', data.access_token);
            storage.setItem('auth_user', JSON.stringify(data.user));

            // Also set in localStorage so chat page can find it
            // (chat page checks localStorage first, then sessionStorage)
            if (!remember) {
                // For session-only, still put in sessionStorage — chat page will check both
            }

            router.push('/chat');
        } catch {
            setError('Server error. Is the backend running?');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#efd19cde] px-4">

            {/* BIG CARD */}
           <div className="w-full h-[640px] max-w-6xl bg-white/80 backdrop-blur-3xl rounded-3xl 
shadow-[0_20px_60px_rgba(0,0,0,0.15),0_0_25px_rgba(158,132,83,0.4)] 
border border-[#9e8453] overflow-hidden grid md:grid-cols-2">

                {/* LEFT SIDE (CONTENT) */}
                <div className="hidden md:flex flex-col justify-center px-20 bg-[#f7f3ec]">

                    <div className="max-w-lg">
                        <div className="inline-flex p-4 bg-[#74603e]/10 rounded-2xl border border-[#c8b89a] mb-6">
                            <Scale className="w-20 h-20 text-[#74603e]" />
                        </div>

                        <h1 className="text-3xl font-bold text-[#2d1f0e] mb-3">
                            Family Law Assistant
                        </h1>

                        <p className="text-[#95775e] text-sm mb-6 leading-relaxed">
                            Get reliable, AI-powered legal guidance for family matters.
                            Fast, secure, and designed to support you at every step.
                        </p>

                        <ul className="space-y-3 text-sm text-[#4a3728]">
                            <li>✔ Private & secure consultations</li>
                            <li>✔ Instant AI legal insights</li>
                            <li>✔ Trusted by growing users</li>
                        </ul>
                    </div>
                </div>

                {/* RIGHT SIDE (FORM) */}
                <div className="p-6 sm:p-8  sm:px-16 sm:py-10">

                    {/* Tabs */}
                    <div className="flex mb-6 border-b border-[#c8b89a]">
                        <button
                            onClick={() => setMode('signin')}
                            className={`flex-1 py-2 text-sm font-semibold ${
                                mode === 'signin'
                                    ? 'text-[#74603e] border-b-2 border-[#74603e]'
                                    : 'text-[#8a7462]'
                            }`}
                        >
                            Sign In
                        </button>
                        <button
                            onClick={() => setMode('signup')}
                            className={`flex-1 py-2 text-sm font-semibold ${
                                mode === 'signup'
                                    ? 'text-[#74603e] border-b-2 border-[#74603e]'
                                    : 'text-[#8a7462]'
                            }`}
                        >
                            Sign Up
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-4">

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
                                {error}
                            </div>
                        )}

                        {mode === 'signup' && (
                            <div>
                                <label className="text-sm text-[#4a3728]">Full Name</label>
                                <div className="relative mt-1">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7462]" />
                                    <input
                                        type="text"
                                        value={fullName}
                                        onChange={e => setFullName(e.target.value)}
                                        required
                                        placeholder="Enter your full name"
                                        className="w-full pl-10 pr-4 py-2.5 bg-[#f7f3ec] border border-[#c8b89a] rounded-xl text-sm"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Email */}
                        <div>
                            <label className="text-sm text-[#4a3728]">Email</label>
                            <div className="relative mt-1">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7462]" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    required
                                    placeholder="you@example.com"
                                    className="w-full pl-10 pr-4 py-2.5 bg-[#f7f3ec] border border-[#c8b89a] rounded-xl text-sm"
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label className="text-sm text-[#4a3728]">Password</label>
                            <div className="relative mt-1">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7462]" />
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={e => setPassword(e.target.value)}
                                    required
                                    placeholder="••••••••"
                                    className="w-full pl-10 pr-10 py-2.5 bg-[#f7f3ec] border border-[#c8b89a] rounded-xl text-sm"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {mode === 'signup' && (
                            <>
                                <div>
                                    <label className="text-sm text-[#4a3728]">Confirm Password</label>
                                    <div className="relative mt-1">
                                        <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8a7462]" />
                                        <input
                                            type="password"
                                            placeholder="Re-enter password"
                                            value={confirmPassword}
                                            onChange={e => setConfirmPassword(e.target.value)}
                                            required
                                            className="w-full pl-10 pr-4 py-2.5 bg-[#f7f3ec] border border-[#c8b89a] rounded-xl text-sm"
                                        />
                                    </div>
                                </div>

                                {/* Gender (optional, sent to backend for personalized responses) */}
                                <div>
                                    <label className="text-sm text-[#4a3728]">Gender <span className="text-[#8a7462]">(optional)</span></label>
                                    <select
                                        value={gender}
                                        onChange={e => setGender(e.target.value)}
                                        className="w-full mt-1 px-4 py-2.5 bg-[#f7f3ec] border border-[#c8b89a] rounded-xl text-sm text-[#4a3728]"
                                    >
                                        <option value="">Prefer not to say</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                            </>
                        )}

                        {/* Remember + Forgot */}
                        <div className="flex items-center justify-between text-sm">
                        

                            {mode === 'signin' && (
                                    <label className="flex items-center gap-2 text-[#8a7462] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={remember}
                                    onChange={() => setRemember(!remember)}
                                    className="accent-[#74603e]"
                                />
                                Remember me
                            </label>
                            )}

                            

                            {mode === 'signin' && (
                                <button
                                    type="button"
                                    className="text-[#74603e] font-medium hover:text-[#5c4b2f]"
                                >
                                    Forgot password?
                                </button>
                            )}
                        </div>

                        {/* Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full py-3 bg-amber-900 hover:bg-amber-800 text-white rounded-xl flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : (
                                <>
                                    {mode === 'signin' ? 'Sign In' : 'Create Account'}
                                    <ArrowRight size={16} />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}