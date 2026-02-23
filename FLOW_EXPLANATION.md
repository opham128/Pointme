# Complete Flow Explanation: Category Button Press → Place Found

## Overview
This document explains the entire flow from when you press a category button to when a place is found, including potential issues with duplicate calls and getting stuck.

---

## File-by-File Flow

### 1. **HomeScreen.tsx** - The Starting Point

**Location**: `screens/HomeScreen.tsx`

**What happens when you press a category button:**

1. **Button Press** (line 276):
   ```typescript
   <CategoryButton
     category={category}
     onPress={hasPurchased ? () => handleCategoryPress(category) : handleCategorySelect}
   />
   ```

2. **handleCategoryPress** (lines 106-128):
   - For non-paid users: directly calls `handleCategorySelect(category)`
   - For paid users with restaurants: toggles filter expansion
   - For other categories: directly calls `handleCategorySelect(category)`

3. **handleCategorySelect** (lines 77-104):
   - Checks location permission
   - Checks if purchase is needed (free limit reached)
   - **Sets category preferences** (lines 91-99):
     ```typescript
     if (hasPurchased) {
       const prefs: { restaurantCuisine?: string } = {};
       if (category === 'restaurants' && restaurantCuisine !== null) {
         prefs.restaurantCuisine = restaurantCuisine;
       }
       setCategoryPreferences(Object.keys(prefs).length > 0 ? prefs : null);
     } else {
       setCategoryPreferences(null);
     }
     ```
   - **Sets selected category** (line 102):
     ```typescript
     setSelectedCategory(category);
     ```
   - **Navigates to compass screen** (line 103):
     ```typescript
     router.push('/compass');
     ```

**Key Points:**
- `setCategoryPreferences` is called BEFORE `setSelectedCategory`
- Both state updates happen synchronously
- Navigation happens immediately after state updates

**Potential Issues:**
- If `categoryPreferences` changes after `selectedCategory`, it could trigger a re-fetch
- Multiple rapid button presses could cause multiple state updates

---

### 2. **AppContext.tsx** - State Management

**Location**: `context/AppContext.tsx`

**What happens when state is updated:**

1. **State Updates** (lines 25, 31):
   ```typescript
   const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
   const [categoryPreferences, setCategoryPreferences] = useState<{ restaurantCuisine?: string; barPriceLevel?: number } | null>(null);
   ```

2. **Context Provider** (lines 52-72):
   - All components using `useAppContext()` will re-render when these values change
   - `CompassScreen` subscribes to both `selectedCategory` and `categoryPreferences`

**Key Points:**
- State updates are synchronous but React batches them
- Multiple components can subscribe to the same context values
- Each state update triggers a re-render of all consuming components

**Potential Issues:**
- If `categoryPreferences` is set to `null` then to a value, it triggers two re-renders
- If `selectedCategory` changes, `CompassScreen` unmounts/remounts or re-renders

---

### 3. **CompassScreen.tsx** - The Consumer

**Location**: `screens/CompassScreen.tsx`

**What happens when CompassScreen renders:**

1. **Component Mounts** (line 30):
   - Gets `selectedCategory` and `userLocation` from context (line 33)
   - Calls `useNearestPlace` hook (line 35):
     ```typescript
     const { place, loading, error, refetch } = useNearestPlace(userLocation, selectedCategory, !!userLocation);
     ```

2. **Loading Screen Check** (lines 236-246):
   ```typescript
   if (loading && !place) {
     return (
       <View>
         <ActivityIndicator />
         <Text>Finding nearest...</Text>
       </View>
     );
   }
   ```

3. **Error/No Place Check** (lines 248-295):
   - Shows error screen if `error` exists or `place` is null
   - But checks `loading` first to avoid showing error during fetch

**Key Points:**
- `useNearestPlace` is called with `selectedCategory` and `userLocation`
- If either changes, the hook re-runs
- The loading screen shows when `loading && !place`

**Potential Issues:**
- If `loading` stays `true` but `place` is set, the loading screen won't show (good)
- If `loading` is `true` and `place` is `null`, loading screen shows (expected)
- If `loading` is `false` but `place` is still `null`, error screen shows

---

### 4. **useNearestPlace.ts** - The Core Logic

**Location**: `hooks/useNearestPlace.ts`

**This is where most issues occur. Let's break it down:**

#### State Management (lines 40-43):
```typescript
const [place, setPlace] = useState<Place | null>(null);
const [loading, setLoading] = useState<boolean>(false);
const [error, setError] = useState<Error | null>(null);
const [fetchedCategory, setFetchedCategory] = useState<Category | null>(null);
```

#### Refs for Preventing Duplicates (lines 49-51):
```typescript
const isFetchingRef = useRef<boolean>(false);
const lastLocationRef = useRef<Location | null>(null);
const lastCategoryPrefsRef = useRef<string>('');
```

#### Main useEffect (lines 153-184):

**Trigger Conditions:**
- Runs when `category`, `enabled`, `categoryPreferences`, `userLocation?.latitude`, or `userLocation?.longitude` changes

**Early Returns:**
1. If no `userLocation`, `category`, or `enabled` → return (line 154-156)
2. If we already have a place for this category → return early (lines 159-164)
3. If category changed → clear place and fetchedCategory (lines 167-170)

**Fetch Decision Logic** (lines 173-179):
```typescript
const categoryPrefsStr = JSON.stringify(categoryPreferences || null);
const needsFetch = 
  !fetchedCategory || 
  fetchedCategory !== category ||
  categoryPrefsStr !== lastCategoryPrefsRef.current ||
  !lastLocationRef.current ||
  (lastLocationRef.current && calculateDistance(userLocation, lastLocationRef.current) > 50);
```

**Potential Issues Here:**
1. **Multiple Triggers**: If `categoryPreferences` changes AFTER `category` is set, this effect runs again
2. **Location Changes**: If `userLocation?.latitude` or `userLocation?.longitude` changes slightly, it triggers
3. **Race Condition**: If `categoryPreferences` is set to `null` then to a value, two fetches could be triggered

#### fetchNearestPlace Function (lines 53-150):

**Guard Check** (line 54):
```typescript
if (!userLocation || !category || !enabled || isFetchingRef.current) {
  return;
}
```

**Setting Loading** (lines 58-60):
```typescript
isFetchingRef.current = true;
setLoading(true);
setError(null);
```

**Cache Check** (lines 72-121):
- Checks cache first
- If cache hit and valid → sets place, loading=false, returns early
- If cache miss or invalid → continues to API call

**API Call** (line 123):
```typescript
const nearestPlace = await findNearestPlace(userLocation, category, currentCategoryPreferences);
```

**Setting Results** (lines 125-128):
```typescript
setPlace(nearestPlace);
setFetchedCategory(category);
setError(null);
setLoading(false);
```

**Potential Issues:**
1. **Stale Closure**: If `category` changes during the async call, we might set place for wrong category
2. **Race Condition**: If `fetchNearestPlace` is called twice, `isFetchingRef.current` might not prevent both
3. **State Update Order**: `setPlace` and `setLoading(false)` might not happen atomically

#### Return Logic (lines 205-213):
```typescript
const effectivePlace = (place && fetchedCategory === category) ? place : null;
const effectiveLoading = effectivePlace ? false : loading;

return {
  place: effectivePlace,
  loading: effectiveLoading,
  error,
  refetch: () => fetchNearestPlace(true),
};
```

**Potential Issues:**
- If `fetchedCategory !== category`, `effectivePlace` is `null` even if `place` exists
- This could cause loading screen to show even when a place was found

---

### 5. **mapboxPlaces.ts** - The API Call

**Location**: `services/mapboxPlaces.ts`

**findNearestPlace Function** (lines 245-515):

**Duplicate Call Prevention** (lines 234-275):
```typescript
let isSearching = false;
let currentSearchKey: string | null = null;

// Create search key
const searchKey = `${category}-${userLocation.latitude.toFixed(6)}-${userLocation.longitude.toFixed(6)}-${JSON.stringify(categoryPreferences)}`;

// Check if already searching
if (isSearching) {
  if (currentSearchKey === searchKey) {
    throw new Error('DUPLICATE_CALL_BLOCKED');
  }
}

isSearching = true;
currentSearchKey = searchKey;
```

**Potential Issues:**
- If two calls happen with slightly different `categoryPreferences` (e.g., `null` vs `{}`), they're treated as different
- The guard is module-level, so it works across all hook instances
- If an error occurs, the guard might not be cleared properly

**API Call** (line 293):
```typescript
const results = await searchWithRadius(userLocation, searchRadius, category, categoryInfo, categoryPreferences);
```

**Return** (line 479):
```typescript
return nearestPlaceResult;
```

---

## Why Duplicate Calls Happen

### Scenario 1: Category Preferences Change
1. User presses "Restaurants" button
2. `setCategoryPreferences(null)` is called
3. `setSelectedCategory('restaurants')` is called
4. `useNearestPlace` effect runs → fetches with `categoryPreferences: null`
5. **If categoryPreferences changes again** (e.g., from context update), effect runs again → second fetch

### Scenario 2: Location Updates
1. User presses button → fetch starts
2. GPS updates location slightly (even 1 meter)
3. `userLocation?.latitude` or `userLocation?.longitude` changes
4. `useNearestPlace` effect runs again → second fetch

### Scenario 3: Multiple Rapid Presses
1. User presses button quickly multiple times
2. Each press calls `setSelectedCategory` and `setCategoryPreferences`
3. Each state update triggers the effect
4. Multiple fetches start before `isFetchingRef.current` is set

### Scenario 4: Category Change During Fetch
1. User presses "Bars" → fetch starts
2. User quickly presses "Restaurants" → category changes
3. First fetch completes → sets place for "bars"
4. But `fetchedCategory` might not match current `category` → `effectivePlace` is null

---

## Why It Gets Stuck

### Issue 1: Loading Never Set to False
**Cause**: If an error occurs in `fetchNearestPlace` but `setLoading(false)` is not called, `loading` stays `true`.

**Where it happens**: 
- If `isFetchingRef.current` is `true` and function returns early (line 54)
- If error occurs but error handler doesn't set `loading = false`

**Current Fix**: Error handler sets `loading = false` (line 147), but early returns might not.

### Issue 2: FetchedCategory Mismatch
**Cause**: If `fetchedCategory` doesn't match `category`, `effectivePlace` is `null` even if `place` exists.

**Where it happens**:
- Category changes during fetch
- State updates are out of order
- `fetchedCategory` is cleared but `place` is not

**Current Fix**: Lines 167-170 clear both when category changes, but timing issues can occur.

### Issue 3: Race Condition in State Updates
**Cause**: `setPlace` and `setFetchedCategory` are separate state updates, so they might not happen together.

**Example**:
1. Fetch completes → `setPlace(nearestPlace)` called
2. Before `setFetchedCategory(category)` runs, component re-renders
3. `effectivePlace` is `null` because `fetchedCategory !== category`
4. Loading screen shows

**Current Fix**: Both are set in the same function, but React batches updates, so timing can still be off.

### Issue 4: Cache Logic Issues
**Cause**: Cache check might return early with `loading = false`, but if cache is invalid, it continues to API call. If API call fails or is slow, `loading` might be in wrong state.

**Where it happens**:
- Lines 97-105: Cache hit → sets `loading = false` and returns
- But if cache is invalid (line 115), continues to API call
- If API call is slow, `loading` might be `false` during the call

**Current Fix**: `setLoading(true)` is called at start (line 59), but cache early return sets it to `false` (line 101).

### Issue 5: Multiple useEffect Instances
**Cause**: If the effect runs multiple times before the first fetch completes, multiple fetches might start.

**Where it happens**:
- Effect depends on `categoryPreferences` (line 184)
- If `categoryPreferences` changes multiple times, effect runs multiple times
- Each run might call `fetchNearestPlace` if conditions are met

**Current Fix**: `isFetchingRef.current` check (line 54), but if check happens before it's set, both can proceed.

---

## The Most Likely Culprit

Based on the code, the most likely issue is:

**Category Preferences Changing After Category is Set**

1. User presses button
2. `setCategoryPreferences(null)` → triggers effect
3. `setSelectedCategory('restaurants')` → triggers effect again
4. First effect run: fetches with `categoryPreferences: null`
5. Second effect run: fetches with `categoryPreferences: null` (same, but duplicate)
6. If `categoryPreferences` changes again (e.g., from context), third fetch

**Solution**: The effect should debounce or check if a fetch is already in progress for the same parameters.

---

## Recommendations

1. **Debounce the effect**: Use a debounce or check if parameters actually changed
2. **Combine state updates**: Use a single state update for `category` and `categoryPreferences` together
3. **Better duplicate prevention**: Check not just `isFetchingRef.current`, but also if the same request is in progress
4. **Atomic state updates**: Use a reducer or single state object for `place`, `fetchedCategory`, and `loading`
5. **Clearer loading logic**: Set `loading = true` at the very start, and only set `false` when definitely done
