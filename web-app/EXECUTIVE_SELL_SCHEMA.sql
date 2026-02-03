-- Migration to support Executive Sell features

-- Table for candidate-specific portfolio passwords
CREATE TABLE IF NOT EXISTS public.candidate_passwords (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Table for candidate-specific profile metadata (The Pitch, Exp, Salary)
CREATE TABLE IF NOT EXISTS public.candidate_profiles (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    candidate_email TEXT UNIQUE NOT NULL,
    pitch TEXT,
    years_of_experience TEXT,
    salary_expectations TEXT,
    selected_meeting_id TEXT, -- Added to allow manual assignment of pitch source
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.candidate_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidate_profiles ENABLE ROW LEVEL SECURITY;

-- Allow all operations for simplicity in this app
CREATE POLICY "Allow all candidate_passwords" ON public.candidate_passwords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all candidate_profiles" ON public.candidate_profiles FOR ALL USING (true) WITH CHECK (true);
