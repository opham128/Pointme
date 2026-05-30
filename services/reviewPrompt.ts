import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { REVIEW_PROMPT_MIN_ARRIVALS } from '../constants';

const REVIEW_PROMPT_KEY = '@pointme:review_prompt';

type ReviewPromptState = 'dismissed' | 'completed';

export async function getReviewPromptState(): Promise<ReviewPromptState | null> {
  try {
    const value = await AsyncStorage.getItem(REVIEW_PROMPT_KEY);
    if (value === 'dismissed' || value === 'completed') {
      return value;
    }
    return null;
  } catch {
    return null;
  }
}

export async function shouldShowReviewPrompt(arrivalCount: number): Promise<boolean> {
  if (arrivalCount < REVIEW_PROMPT_MIN_ARRIVALS) {
    return false;
  }

  const state = await getReviewPromptState();
  if (state !== null) {
    return false;
  }

  try {
    return await StoreReview.isAvailableAsync();
  } catch {
    return false;
  }
}

export async function dismissReviewPrompt(): Promise<void> {
  try {
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, 'dismissed');
  } catch (error) {
    console.error('Error dismissing review prompt:', error);
  }
}

export async function requestAppReview(): Promise<void> {
  try {
    if (await StoreReview.isAvailableAsync()) {
      await StoreReview.requestReview();
    }
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, 'completed');
  } catch (error) {
    console.error('Error requesting app review:', error);
    await AsyncStorage.setItem(REVIEW_PROMPT_KEY, 'completed');
  }
}

export async function clearReviewPromptState(): Promise<void> {
  try {
    await AsyncStorage.removeItem(REVIEW_PROMPT_KEY);
  } catch (error) {
    console.error('Error clearing review prompt state:', error);
  }
}
