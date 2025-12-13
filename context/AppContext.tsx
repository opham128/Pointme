import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Category, Place, Location } from '../types';
import { getArrivalHistory, getArrivalCount, ArrivalHistoryItem } from '../services/storage';

interface AppContextType {
  selectedCategory: Category | null;
  setSelectedCategory: (category: Category | null) => void;
  targetPlace: Place | null;
  setTargetPlace: (place: Place | null) => void;
  userLocation: Location | null;
  setUserLocation: (location: Location | null) => void;
  arrivalHistory: ArrivalHistoryItem[];
  arrivalCount: number;
  refreshHistory: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [targetPlace, setTargetPlace] = useState<Place | null>(null);
  const [userLocation, setUserLocation] = useState<Location | null>(null);
  const [arrivalHistory, setArrivalHistory] = useState<ArrivalHistoryItem[]>([]);
  const [arrivalCount, setArrivalCount] = useState<number>(0);

  const refreshHistory = async () => {
    const history = await getArrivalHistory();
    const count = await getArrivalCount();
    setArrivalHistory(history);
    setArrivalCount(count);
  };

  useEffect(() => {
    refreshHistory();
  }, []);

  return (
    <AppContext.Provider
      value={{
        selectedCategory,
        setSelectedCategory,
        targetPlace,
        setTargetPlace,
        userLocation,
        setUserLocation,
        arrivalHistory,
        arrivalCount,
        refreshHistory,
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

