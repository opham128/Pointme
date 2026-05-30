import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Category, Place, Location } from '../types';
import { getArrivalHistory, getArrivalCount, ArrivalHistoryItem } from '../services/storage';
import { hasPurchasedFullApp, initializePurchases } from '../services/purchases';

interface AppContextType {
  selectedCategory: Category | null;
  setSelectedCategory: (category: Category | null) => void;
  /** Incremented each time user taps a category or Search on HomeScreen; used so we only run place search when they explicitly request it. */
  searchTrigger: number;
  requestSearch: () => void;
  targetPlace: Place | null;
  setTargetPlace: (place: Place | null) => void;
  userLocation: Location | null;
  setUserLocation: (location: Location | null) => void;
  /** Manual location set by user via search bar (when GPS is denied) */
  manualLocation: Location | null;
  setManualLocation: (location: Location | null) => void;
  arrivalHistory: ArrivalHistoryItem[];
  arrivalCount: number;
  refreshHistory: () => Promise<void>;
  hasPurchased: boolean;
  refreshPurchaseStatus: () => Promise<void>;
  categoryPreferences: { restaurantCuisine?: string; barPriceLevel?: number } | null;
  setCategoryPreferences: (prefs: { restaurantCuisine?: string; barPriceLevel?: number } | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [targetPlace, setTargetPlace] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [manualLocation, setManualLocation] = useState<Location | null>(null);
  const [arrivalHistory, setArrivalHistory] = useState<ArrivalHistoryItem[]>([]);
  const [arrivalCount, setArrivalCount] = useState<number>(0);
  const [hasPurchased, setHasPurchased] = useState<boolean>(false);
  const [categoryPreferences, setCategoryPreferences] = useState<{ restaurantCuisine?: string; barPriceLevel?: number } | null>(null);
  const [searchTrigger, setSearchTrigger] = useState(0);

  const requestSearch = () => setSearchTrigger((t) => t + 1);

  const refreshHistory = async () => {
    const history = await getArrivalHistory();
    const count = await getArrivalCount();
    setArrivalHistory(history);
    setArrivalCount(count);
  };

  const refreshPurchaseStatus = async () => {
    const purchased = await hasPurchasedFullApp();
    setHasPurchased(purchased);
  };

  useEffect(() => {
    refreshHistory();
    refreshPurchaseStatus();
    // Initialize purchases on app startup
    initializePurchases();
  }, []);

  return (
    <AppContext.Provider
      value={{
        selectedCategory,
        setSelectedCategory,
        searchTrigger,
        requestSearch,
        targetPlace,
        setTargetPlace,
        userLocation,
        setUserLocation,
        manualLocation,
        setManualLocation,
        arrivalHistory,
        arrivalCount,
        refreshHistory,
        hasPurchased,
        refreshPurchaseStatus,
        categoryPreferences,
        setCategoryPreferences,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

