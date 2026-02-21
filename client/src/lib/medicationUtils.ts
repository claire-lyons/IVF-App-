// Utility functions for medication data

export interface MedicationInfo {
  id: string;
  name: string;
  generic: string;
  class: string;
  purpose: string;
  route: string;
  timing: string;
  commonSideEffects: string[];
  seriousSideEffects: string[];
  monitoringNotes: string | null;
  patientNotes: string | null;
  reference: string | null;
  videoLink?: string | null; // Optional video instruction link
}

// Don't cache - let React Query handle caching
let medicationData: MedicationInfo[] | null = null;

// Function to clear cache (useful for forcing refresh)
export function clearMedicationCache() {
  medicationData = null;
}

// Load medication data from API (database)
export async function loadMedicationData(forceRefresh = false): Promise<MedicationInfo[]> {
  // Clear cache if force refresh is requested
  if (forceRefresh) {
    medicationData = null;
  }
  
  try {
    console.log('[MedicationUtils] Fetching medication data from API...');
    const response = await fetch('/api/medications/info', {
      cache: forceRefresh ? 'no-cache' : 'default',
    });
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[MedicationUtils] API error:', response.status, errorText);
      throw new Error(`Failed to fetch medication data: ${response.status} ${errorText}`);
    }
    const data = await response.json();
    console.log('[MedicationUtils] Received medications:', Array.isArray(data) ? data.length : 'not an array');
    if (Array.isArray(data) && data.length > 0) {
      console.log('[MedicationUtils] Sample medication:', data[0]?.name);
    }
    
    // Only cache if we got valid data
    if (Array.isArray(data)) {
      medicationData = data;
      return medicationData;
    } else {
      console.error('[MedicationUtils] Invalid data format:', data);
      return [];
    }
  } catch (error) {
    console.error('[MedicationUtils] Error loading medication data:', error);
    // Don't cache errors - return empty array but allow retry
    medicationData = null;
    throw error; // Re-throw so React Query can handle it
  }
}

// Get medication information by ID
export async function getMedicationInfoById(id: string): Promise<MedicationInfo | null> {
  try {
    const response = await fetch(`/api/medications/info/${encodeURIComponent(id)}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
    return null;
  } catch (error) {
    console.error('Error fetching medication info:', error);
    return null;
  }
}

// Get medication information by name (for backward compatibility)
export async function getMedicationInfo(name: string): Promise<MedicationInfo | null> {
  const medications = await loadMedicationData();
  return medications.find(med => med.name.toLowerCase() === name.toLowerCase()) || null;
}

// Create new medication info
export async function createMedicationInfo(info: Omit<MedicationInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<MedicationInfo | null> {
  try {
    const response = await fetch('/api/medications/info', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(info),
    });
    if (response.ok) {
      const data = await response.json();
      // Clear cache so it reloads
      medicationData = null;
      return data;
    }
    const error = await response.json();
    throw new Error(error.message || 'Failed to create medication');
  } catch (error) {
    console.error('Error creating medication info:', error);
    throw error;
  }
}

// Get all medications
export async function getAllMedications(): Promise<MedicationInfo[]> {
  return await loadMedicationData();
}

