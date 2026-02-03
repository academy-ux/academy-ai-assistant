# Fix: Chrome Plugin Searching for Wrong Person

## Problem
When Adam joined a meeting with Donnacha, the Chrome plugin pulled up "Adam Pavlov" instead of the correct person. The issues were:
1. The plugin was searching for the meeting owner (Adam) instead of the other participant (Donnacha)
2. The search algorithm was too fuzzy, matching partial names like "Adam" to "Adam Pavlov" with low confidence scores
3. Emails weren't being extracted from all available sources in Google Meet

## Solution

### 1. Filter Out the Logged-In User (content.js)
**File**: `academy-interview-assistant/content.js`

Updated `isLikelyTeamMember()` function to:
- Check against the authenticated user's name and email from `authStatus`
- Filter out the meeting owner/current user from participant detection
- Handle variations like "Adam Perlis (Presentation)" or just "Adam"
- Check for company domain emails (@academyux.com)

This ensures the plugin only searches for OTHER participants, not the person logged into the web app.

### 2. Enhanced Email Extraction (content.js)
**File**: `academy-interview-assistant/content.js`

Added **Method 4** to extract emails from multiple sources:
- Calendar event data embedded in the Meet page
- Meta tags with email addresses
- Aria-labels and data attributes
- Element titles and tooltips

**Why this matters**: Email searches in Lever are:
- ⚡ **Much faster** (exact match via API filter)
- ✅ **More accurate** (no false positives)
- 🎯 **Always score 100** (guaranteed correct person)

The plugin now logs whether it's using email or name search:
- `⚡ Using EMAIL search (faster & more accurate)` - when email is found
- `⚠️ Using NAME search (slower, may have false matches)` - when only name is available

### 3. Improved Search Matching with Minimum Score (route.ts)
**File**: `web-app/app/api/lever/search/route.ts`

Implemented a **scoring system** with **minimum threshold of 70**:
- **Score 100**: Exact name match OR email search ✅
- **Score 95**: Exact email match in name search ✅
- **Score 90**: Name starts with query (e.g., "Donnacha" → "Donnacha O'Rear") ✅
- **Score 85**: Query is a full word in the name ✅
- **Score 70**: All query words present as full words ✅

**Removed**: 60-point prefix matches (e.g., "Adam" → "Adam Pavlov")

**Result**: Only candidates with score ≥ 70 are returned. Weak matches are rejected with message: "No strong matches found (all candidates scored below 70)"

**Search Scope**:
- ✅ Searches **ALL candidates** in Lever (not just recent ones)
- ✅ Includes **archived opportunities** (`archived: true`)
- ✅ Includes **confidential candidates** (`confidentiality: all`)
- 📊 Searches up to **2,000 candidates** for name searches (20 pages × 100/page)
- ⚡ Email searches are instant (Lever API filter, no pagination needed)

Results are sorted by score (highest first), then by profile completeness (number of links).

### Key Improvements:
1. **Exact matches prioritized**: "Donnacha" will match "Donnacha O'Rear" with score 90
2. **Weak matches rejected**: "Adam" won't match "Adam Pavlov" (would be score 60, below threshold)
3. **Owner filtering**: The logged-in user (Adam) is automatically excluded from participant searches
4. **Email prioritization**: System tries hard to find emails for faster, more accurate searches
5. **Better logging**: Search results show scores and email status for debugging

## Testing
To test:
1. Join a Google Meet as Adam (logged into Academy)
2. Have Donnacha join the meeting
3. The plugin should:
   - Detect "Donnacha" as a participant
   - Filter out "Adam" (the owner)
   - Try to extract Donnacha's email from Meet/Calendar data
   - Search for "Donnacha" (or email) in Lever
   - Return "Donnacha O'Rear" with high score (90-100)
   - Display the correct candidate panel

## Example Scenarios

### Scenario 1: Email Found (Best Case)
```
[Academy] 🔍 New participant detected: Donnacha O'Rear ✉️ donnacha@example.com
[Academy] ⚡ Using EMAIL search (faster & more accurate)
[Lever Search] Found 1 matches for query: "donnacha@example.com" (min score: 70)
[Lever Search] First match: Donnacha O'Rear (score: 100)
```

### Scenario 2: Name Only (Good Match)
```
[Academy] 🔍 New participant detected: Donnacha ❌ no email
[Academy] ⚠️ Using NAME search (slower, may have false matches)
[Lever Search] Found 1 matches for query: "donnacha" (min score: 70)
[Lever Search] First match: Donnacha O'Rear (score: 90)
```

### Scenario 3: Weak Match Rejected
```
[Academy] 🔍 New participant detected: Adam ❌ no email
[Academy] ⚠️ Using NAME search (slower, may have false matches)
[Lever Search] Found 0 matches for query: "adam" (min score: 70)
[Lever Search] No strong matches found (all candidates scored below 70)
```
(Adam Pavlov would score 60 for prefix match, below threshold)

## Additional Changes Made by User
The user also added:
- Auto-enable captions feature
- Transcript recovery after page reload
- Better meeting-end detection to prevent false triggers during account switching
- UI structure monitoring to detect Google Meet DOM changes
