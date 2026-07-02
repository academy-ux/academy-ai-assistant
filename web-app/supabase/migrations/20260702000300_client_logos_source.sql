-- Preferred logo source per client: 'upload' | 'logodev' | 'favicon' | NULL (auto)
ALTER TABLE client_logos ADD COLUMN IF NOT EXISTS source TEXT;
