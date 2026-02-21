import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from "@react-google-maps/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Search, Filter, Star, MapPin, Phone, Mail, ChevronDown, User, ArrowUpDown, Plus, Stethoscope, Navigation, List, Map as MapIcon, AlertCircle } from "lucide-react";
import HamburgerMenu from "@/components/hamburger-menu";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import type { Doctor } from "@shared/schema";
import { calculateDistance, formatDistance, getDirectionsUrl, getCurrentLocation, calculateCenter, geocodeAddress, type Coordinates } from "@/lib/mapsUtils";

const containerStyle = {
  width: '100%',
  height: '250px'
};

const center = {
  lat: -33.8688,
  lng: 151.2093
};

export default function Doctors() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");
  const [locationSearch, setLocationSearch] = useState("");
  const [debouncedLocationSearch, setDebouncedLocationSearch] = useState("");
  const [selectedFilter, setSelectedFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState<"rating" | "name" | "reviews" | "distance">("rating");
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [mapCenter, setMapCenter] = useState<Coordinates>(center);
  const [mapZoom, setMapZoom] = useState(12);
  const [mapLoadTimeout, setMapLoadTimeout] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    bulkBilling: false,
    telehealth: false,
    weekendHours: false,
    experience: "all",
    distance: "all"
  });


  // Debounce search query to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Debounce location search to avoid too many API calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLocationSearch(locationSearch);
    }, 300);
    return () => clearTimeout(timer);
  }, [locationSearch]);

  // Debug: Log when sortBy changes and ensure query refetches
  useEffect(() => {
    console.log(`[Doctors Page] sortBy state changed to: "${sortBy}"`);
    // Force query to refetch when sortBy changes
    // React Query should do this automatically via queryKey, but this ensures it happens
    const currentQueryKey = [
      "/api/doctors", 
      debouncedSearchQuery,
      debouncedLocationSearch,
      selectedFilter, 
      activeFilters.bulkBilling, 
      activeFilters.telehealth,
      activeFilters.weekendHours,
      activeFilters.experience,
      activeFilters.distance,
      sortBy
    ];
    console.log(`[Doctors Page] Invalidating query with key:`, currentQueryKey);
    queryClient.invalidateQueries({ 
      queryKey: currentQueryKey,
      exact: false // Use false to match any query starting with this key
    });
    }, [sortBy, queryClient, debouncedSearchQuery, debouncedLocationSearch, selectedFilter, activeFilters.bulkBilling, activeFilters.telehealth, activeFilters.weekendHours, activeFilters.experience, activeFilters.distance]);



  const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: googleMapsApiKey,
    libraries: ['maps', 'places'], // Include both maps and places libraries
  });

  // Set timeout for map loading (10 seconds)
  useEffect(() => {
    if (googleMapsApiKey && viewMode === "map" && !isLoaded && !loadError) {
      const timer = setTimeout(() => {
        setMapLoadTimeout(true);
      }, 10000);
      return () => clearTimeout(timer);
    } else {
      setMapLoadTimeout(false);
    }
  }, [googleMapsApiKey, viewMode, isLoaded, loadError]);

  const onLoad = useCallback(function callback(map: google.maps.Map) {
    // Optional: Store map reference if needed
  }, []);

  const onUnmount = useCallback(function callback(map: google.maps.Map) {
    // Optional: Cleanup
  }, []);

  // Build query parameters URL
  const doctorsQueryUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (searchQuery) params.append("query", searchQuery);
    if (selectedFilter !== "all") params.append("specialty", selectedFilter);
    if (activeFilters.bulkBilling) params.append("bulkBilling", "true");
    if (sortBy) params.append("sortBy", sortBy);
    // Note: telehealth, weekendHours, experience, distance filters are not yet supported by backend
    const queryString = params.toString();
    return `/api/doctors${queryString ? `?${queryString}` : ""}`;
  }, [searchQuery, selectedFilter, activeFilters.bulkBilling, sortBy]);

  const { data: doctors = [], isLoading } = useQuery<Doctor[]>({
      queryKey: [
      "/api/doctors", 
      debouncedSearchQuery,
      debouncedLocationSearch,
      selectedFilter, 
      activeFilters.bulkBilling, 
      activeFilters.telehealth,
      activeFilters.weekendHours,
      activeFilters.experience,
      activeFilters.distance,
      sortBy
    ],
    queryFn: async () => {
      // Build URL with current state values
      const params = new URLSearchParams();
      if (debouncedSearchQuery && debouncedSearchQuery.trim()) {
        params.append("query", debouncedSearchQuery.trim());
      }
      if (debouncedLocationSearch && debouncedLocationSearch.trim()) {
        params.append("location", debouncedLocationSearch.trim());
      }
      if (selectedFilter && selectedFilter !== "all") {
        params.append("specialty", selectedFilter);
      }
      if (activeFilters.bulkBilling) {
        params.append("bulkBilling", "true");
      }
      if (activeFilters.telehealth) {
        params.append("telehealth", "true");
      }
      if (activeFilters.weekendHours) {
        params.append("weekendHours", "true");
      }
      if (activeFilters.experience && activeFilters.experience !== "all") {
        params.append("experience", activeFilters.experience);
      }
      if (activeFilters.distance && activeFilters.distance !== "all") {
        params.append("distance", activeFilters.distance);
      }
      // Always send sortBy parameter - ensure it's a valid value
      const validSortBy = sortBy || "rating";
      params.append("sortBy", validSortBy);
      console.log(`[Doctors Page] Sending sortBy parameter: "${validSortBy}"`);
      
      const queryString = params.toString();
      const url = `/api/doctors${queryString ? `?${queryString}` : ""}`;
      
      const authHeaders: Record<string, string> = {};
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        authHeaders['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      console.log(`[Doctors Page] Fetching: ${url}`);
      console.log(`[Doctors Page] State - query: "${debouncedSearchQuery}", location: "${debouncedLocationSearch}", specialty: "${selectedFilter}", bulkBilling: ${activeFilters.bulkBilling}, telehealth: ${activeFilters.telehealth}, weekendHours: ${activeFilters.weekendHours}, experience: "${activeFilters.experience}", distance: "${activeFilters.distance}", sortBy: "${sortBy}"`);
      
      const res = await fetch(url, {
        headers: authHeaders,
        credentials: "include",
      });
      
      if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
      }
      
      const data = await res.json();
      console.log(`[Doctors Page] Received ${data.length} doctors`);
      console.log(`[Doctors Page] First 3 doctors:`, data.slice(0, 3).map((d: Doctor) => ({ 
        name: d.name, 
        rating: d.rating ? Number(d.rating).toFixed(1) : "N/A", 
        reviewCount: d.reviewCount || 0 
      })));
      return data;
    },
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });

  const specialtyFilters = [
    { value: "all", label: "All Specialists" },
    { value: "Reproductive Endocrinologist", label: "IVF Clinics" },
    { value: "Fertility Specialist", label: "Fertility Specialists" },
    { value: "Gynaecologist", label: "Gynaecologist" },
    { value: "Obstetrician", label: "Obstetrician" },
  ];

  // Helper function to get default coordinates for a location
  const getDefaultCoordinates = (location: string): Coordinates => {
    const coordinates: Record<string, Coordinates> = {
      "Sydney CBD": { lat: -33.8688, lng: 151.2093 },
      "Bondi Junction": { lat: -33.8916, lng: 151.2473 },
      "Parramatta": { lat: -33.8175, lng: 151.0021 },
      "North Sydney": { lat: -33.8403, lng: 151.2065 },
    };
    return coordinates[location] || center;
  };

  // Get user's current location
  useEffect(() => {
    if (sortBy === "distance" || activeFilters.distance !== "all") {
      getCurrentLocation()
        .then((location) => {
          setUserLocation(location);
        })
        .catch((error) => {
          console.log("Could not get user location:", error);
        });
    }
  }, [sortBy, activeFilters.distance]);

  // Calculate distances and filter doctors
  const doctorsWithDistance = useMemo(() => {
    if (!doctors.length) return [];

    let processed = doctors.map((doctor) => {
      let distance: number | null = null;
      let coordinates: Coordinates | null = null;

      // Get coordinates from database or fallback to geocoding
      if (doctor.latitude && doctor.longitude) {
        coordinates = {
          lat: Number(doctor.latitude),
          lng: Number(doctor.longitude),
        };
      } else {
        // Fallback to default coordinates based on location name
        coordinates = getDefaultCoordinates(doctor.location);
      }

      // Calculate distance if user location is available
      if (userLocation && coordinates) {
        distance = calculateDistance(userLocation, coordinates);
      }

      return {
        ...doctor,
        distance,
        coordinates,
      };
    });

    // Filter by radius if distance filter is set
    if (activeFilters.distance !== "all" && userLocation) {
      const radiusKm = parseInt(activeFilters.distance.replace("km", "")) || 25;
      processed = processed.filter((d) => d.distance !== null && d.distance <= radiusKm);
    }

    // Sort by distance if requested
    if (sortBy === "distance" && userLocation) {
      processed.sort((a, b) => {
        if (a.distance === null && b.distance === null) return 0;
        if (a.distance === null) return 1;
        if (b.distance === null) return -1;
        return a.distance - b.distance;
      });
    }

    return processed;
  }, [doctors, userLocation, activeFilters.distance, sortBy]);

  // Update map center when doctors change
  useEffect(() => {
    if (viewMode === "map") {
      const coords = doctorsWithDistance
        .map((d) => d.coordinates)
        .filter((c): c is Coordinates => c !== null);
      if (coords.length > 0) {
        const newCenter = calculateCenter(coords);
        setMapCenter(newCenter);
        // Adjust zoom based on number of markers and their spread
        if (coords.length === 1) {
          setMapZoom(14);
        } else if (coords.length <= 5) {
          setMapZoom(12);
        } else {
          setMapZoom(11);
        }
      } else if (doctorsWithDistance.length === 0) {
        // Reset to default center when no doctors
        setMapCenter(center);
        setMapZoom(12);
      }
    }
  }, [doctorsWithDistance, viewMode]);

  const getDoctorCoordinates = (doctor: Doctor & { coordinates?: Coordinates | null }): Coordinates => {
    if (doctor.coordinates) {
      return doctor.coordinates;
    }
    if (doctor.latitude && doctor.longitude) {
      return {
        lat: Number(doctor.latitude),
        lng: Number(doctor.longitude),
      };
    }
    return getDefaultCoordinates(doctor.location);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      {/* Header */}
      <div className="px-6 pt-6 pb-4">
        <Card className="rounded-2xl p-5 shadow-sm relative" style={{ backgroundColor: 'hsl(74, 17%, 78%)' }}>
          <HamburgerMenu className="absolute top-5 right-3 text-white hover:bg-white/10" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-1" data-testid="title-doctors">
              Dr & Clinic Search
            </h1>
            <p className="text-sm text-white/80" data-testid="subtitle-doctors">
              Find and review your doctors and clinics
            </p>
          </div>
        </Card>
      </div>
      
      {/* Search Bar */}
      <div className="px-6 mb-4 space-y-3">
        <div className="relative">
          <Input
            type="text"
            placeholder="Search by name, specialty, or location..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl pl-11 pr-4 py-3 text-black focus:bg-white focus:border-black"
            data-testid="input-search"
          />
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
        </div>
        {/* Location search bar - commented out
        {googleMapsApiKey && (
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by location..."
              value={locationSearch}
              onChange={(e) => setLocationSearch(e.target.value)}
              className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl pl-11 pr-20 py-3 text-black focus:bg-white focus:border-black"
              data-testid="input-location-search"
            />
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" size={20} />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    const location = await getCurrentLocation();
                    setUserLocation(location);
                    setMapCenter(location);
                    setMapZoom(12);
                    setLocationSearch("");
                  } catch (error) {
                    console.error("Error getting current location:", error);
                  }
                }}
                className="h-7 px-2 text-xs"
                title="Use current location"
              >
                <Navigation size={14} />
              </Button>
              {locationSearch && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    const coords = await geocodeAddress(locationSearch, googleMapsApiKey);
                    if (coords) {
                      setUserLocation(coords);
                      setMapCenter(coords);
                      setMapZoom(12);
                    }
                  }}
                  className="h-7 px-2 text-xs"
                >
                  Search
                </Button>
              )}
            </div>
          </div>
        )}
        */}
      </div>
      
      {/* Quick Filters */}
      <div className="mb-4">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide px-6">
          {specialtyFilters.map((filter) => (
            <Button
              key={filter.value}
              variant={selectedFilter === filter.value ? "default" : "outline"}
              onClick={() => setSelectedFilter(filter.value)}
              className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium ${
                selectedFilter === filter.value
                  ? 'bg-black text-white border-black'
                  : 'bg-white border-2 border-gray-300 text-black hover:bg-gray-50'
              }`}
              data-testid={`search-filter-${filter.value}`}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
      
      {/* Filter and Sort Bar */}
      <div className="mb-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-2 px-6">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className="bg-white border-2 border-gray-300 text-black hover:bg-gray-50 px-3 py-2 rounded-lg text-sm flex-shrink-0"
            data-testid="button-filter"
          >
            <Filter size={16} className="sm:mr-1.5" />
            <span className="hidden sm:inline">Filter</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (!googleMapsApiKey && viewMode === "list") {
                toast({
                  title: "Google Maps API Key Required",
                  description: "Please configure VITE_GOOGLE_MAPS_API_KEY in your environment variables to use map view.",
                  variant: "destructive",
                });
                return;
              }
              setViewMode(viewMode === "list" ? "map" : "list");
            }}
            className="bg-white border-2 border-gray-300 text-black hover:bg-gray-50 px-3 py-2 rounded-lg text-sm flex-shrink-0"
            data-testid="button-view-toggle"
          >
            {viewMode === "list" ? (
              <>
                <MapIcon size={16} className="sm:mr-1.5" />
                <span className="hidden sm:inline">Map View</span>
              </>
            ) : (
              <>
                <List size={16} className="sm:mr-1.5" />
                <span className="hidden sm:inline">List View</span>
              </>
            )}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="bg-white border-2 border-gray-300 text-black hover:bg-gray-50 px-3 py-2 rounded-lg text-sm flex-shrink-0"
                data-testid="button-sort"
              >
                <ArrowUpDown size={16} className="sm:mr-1.5" />
                <span className="hidden sm:inline">Sort</span>
                {sortBy !== "rating" && (
                  <span className="ml-1 text-xs hidden sm:inline">({sortBy === "name" ? "A-Z" : sortBy === "reviews" ? "Reviews" : "Distance"})</span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="bg-white border-2 border-gray-300 min-w-[200px]">
              <DropdownMenuItem 
                onClick={() => {
                  console.log(`[Doctors Page] Sort changed to "rating"`);
                  setSortBy("rating");
                }}
                className={sortBy === "rating" ? "bg-gray-100" : ""}
                data-testid="sort-option-rating"
              >
                Highest Rating
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  console.log(`[Doctors Page] Sort changed to "name"`);
                  setSortBy("name");
                }}
                className={sortBy === "name" ? "bg-gray-100" : ""}
                data-testid="sort-option-name"
              >
                Name (A-Z)
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  console.log(`[Doctors Page] Sort changed to "reviews"`);
                  setSortBy("reviews");
                }}
                className={sortBy === "reviews" ? "bg-gray-100" : ""}
                data-testid="sort-option-reviews"
              >
                Most Reviews
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={() => {
                  console.log(`[Doctors Page] Sort changed to "distance"`);
                  setSortBy("distance");
                }}
                className={sortBy === "distance" ? "bg-gray-100" : ""}
                data-testid="sort-option-distance"
              >
                Distance
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <span className="text-sm text-gray-600 font-medium whitespace-nowrap flex-shrink-0 ml-auto">{doctorsWithDistance.length} results</span>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="px-6 mb-4">
          <Card className="p-4 bg-gray-50 border-2 border-gray-200 rounded-xl">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-black">Filters</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                  className="text-gray-500 hover:text-black"
                >
                  <ChevronDown size={16} />
                </Button>
              </div>
              
              {/* Quick Filters */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-black">Services</h4>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="bulk-billing"
                      checked={activeFilters.bulkBilling}
                      onCheckedChange={(checked) => 
                        setActiveFilters(prev => ({ ...prev, bulkBilling: checked as boolean }))
                      }
                      className="border-2 border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                      data-testid="filter-bulk-billing"
                    />
                    <label htmlFor="bulk-billing" className="text-sm text-black">Bulk Billing Available</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="telehealth"
                      checked={activeFilters.telehealth}
                      onCheckedChange={(checked) => 
                        setActiveFilters(prev => ({ ...prev, telehealth: checked as boolean }))
                      }
                      className="border-2 border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                      data-testid="filter-telehealth"
                    />
                    <label htmlFor="telehealth" className="text-sm text-black">Telehealth Consultations</label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="weekend"
                      checked={activeFilters.weekendHours}
                      onCheckedChange={(checked) => 
                        setActiveFilters(prev => ({ ...prev, weekendHours: checked as boolean }))
                      }
                      className="border-2 border-gray-300 data-[state=checked]:bg-black data-[state=checked]:border-black"
                      data-testid="filter-weekend"
                    />
                    <label htmlFor="weekend" className="text-sm text-black">Weekend Hours</label>
                  </div>
                </div>
              </div>

              {/* Experience Level */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-black">Experience</h4>
                <Select 
                  value={activeFilters.experience} 
                  onValueChange={(value) => setActiveFilters(prev => ({ ...prev, experience: value }))}
                >
                  <SelectTrigger className="bg-white border-2 border-gray-300 text-black" data-testid="select-experience">
                    <SelectValue placeholder="Any experience level" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="all">Any experience level</SelectItem>
                    <SelectItem value="5+">5+ years experience</SelectItem>
                    <SelectItem value="10+">10+ years experience</SelectItem>
                    <SelectItem value="15+">15+ years experience</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Distance */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium text-black">Distance</h4>
                <Select 
                  value={activeFilters.distance} 
                  onValueChange={(value) => setActiveFilters(prev => ({ ...prev, distance: value }))}
                  disabled={!googleMapsApiKey}
                >
                  <SelectTrigger className="bg-white border-2 border-gray-300 text-black disabled:opacity-50" data-testid="select-distance">
                    <SelectValue placeholder={googleMapsApiKey ? "Any distance" : "API key required"} />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-gray-200">
                    <SelectItem value="all">Any distance</SelectItem>
                    <SelectItem value="5km">Within 5km</SelectItem>
                    <SelectItem value="10km">Within 10km</SelectItem>
                    <SelectItem value="25km">Within 25km</SelectItem>
                  </SelectContent>
                </Select>
                {!googleMapsApiKey && (
                  <p className="text-xs text-gray-500">Google Maps API key required for distance filtering</p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Add Doctor/Clinic Section */}
      <div className="px-6 mb-4">
        <Card className="bg-gray-50 border-2 border-gray-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-800">Can't find your doctor or clinic?</p>
              <p className="text-xs text-gray-600 mt-0.5">Add them to help other patients</p>
            </div>
            <Button
              onClick={() => navigate('/add-doctor')}
              variant="outline"
              size="sm"
              className="bg-white border-2 border-gray-300 text-gray-800 hover:bg-gray-100 px-4 py-2 rounded-lg text-sm font-medium"
              data-testid="button-add-doctor"
            >
              <Plus size={16} className="mr-1.5" />
              Add
            </Button>
          </div>
        </Card>
      </div>

      {/* Map view using per-doctor iframes (no API key needed) */}
      {viewMode === "map" && (
        <div className="px-6 mb-4 space-y-3">
          {doctorsWithDistance.length === 0 ? (
            <Card className="rounded-xl overflow-hidden border-2 border-gray-200">
              <div className="h-[260px] bg-gray-100 flex flex-col items-center justify-center p-6">
                <MapPin className="text-gray-400 mb-3" size={40} />
                <p className="text-sm font-medium text-gray-700 mb-2">No doctors to display</p>
                <p className="text-xs text-gray-500 text-center max-w-md">
                  Try adjusting your search or filters to see doctors on the map.
                </p>
              </div>
            </Card>
          ) : (
            doctorsWithDistance.map((doctor) => {
              const addr = doctor.address || doctor.location || "";
              const query = addr ? encodeURIComponent(addr) : "-33.8688,151.2093";
              const mapUrl = `https://maps.google.com/maps?q=${query}&z=13&output=embed`;
              const searchUrl = addr
                ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`
                : `https://www.google.com/maps`;

              return (
                <Card
                  key={doctor.id}
                  className="rounded-xl overflow-hidden border-2 border-gray-200 shadow-sm"
                >
                  <div className="flex flex-col">
                    {/* Header: name & location */}
                    <div className="p-4 pb-3 space-y-1">
                      <h3 className="text-base font-semibold text-foreground">{doctor.name}</h3>
                      {doctor.specialty && (
                        <p className="text-sm text-muted-foreground">{doctor.specialty}</p>
                      )}
                      {addr && (
                        <p className="text-sm text-gray-700 flex items-start gap-2">
                          <MapPin className="w-4 h-4 mt-[2px] text-gray-500" />
                          <span className="break-words">{addr}</span>
                        </p>
                      )}
                    </div>

                    {/* Map */}
                    <div className="relative h-[230px] min-h-[230px] bg-gray-50">
                      <iframe
                        src={mapUrl}
                        className="absolute inset-0 w-full h-full"
                        style={{ border: 0 }}
                        allowFullScreen
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        title={`Map showing location of ${doctor.name}`}
                      />
                    </div>

                    {/* Actions */}
                    <div className="p-4 pt-3 flex flex-col sm:flex-row gap-2 border-t border-gray-100">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => navigate(`/doctors/${doctor.id}`)}
                      >
                        View Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.open(searchUrl, "_blank", "noopener,noreferrer")}
                      >
                        Directions
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      )}
      
      {/* Doctor List */}
      {viewMode === "list" && (
        <div className="px-6 space-y-3">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
            </div>
          ) : doctorsWithDistance.length === 0 ? (
            <Card className="rounded-xl p-8 bg-white border-2 border-gray-200 text-center">
              <Stethoscope className="text-gray-400 mx-auto mb-3" size={40} />
              <p className="text-gray-600 font-medium mb-1" data-testid="no-doctors-message">
                No doctors found
              </p>
              <p className="text-sm text-gray-500">
                Try adjusting your search or filters
              </p>
            </Card>
          ) : (
            doctorsWithDistance.map((doctor) => (
            <Card key={doctor.id} className="rounded-xl p-5 bg-white border-2 border-gray-200 hover:border-gray-300 transition-colors" data-testid={`doctor-card-${doctor.id}`}>
              <div className="space-y-4">
                {/* Doctor Header */}
                <div className="flex items-start space-x-3">
                  <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0">
                    <Stethoscope className="text-gray-400" size={22} />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-black text-base mb-0.5 break-words" data-testid={`doctor-name-${doctor.id}`}>
                          {doctor.name}
                        </h3>
                        <p className="text-gray-600 text-sm break-words" data-testid={`doctor-specialty-${doctor.id}`}>
                          {doctor.specialty}
                        </p>
                        {doctor.clinic && (
                          <p className="text-gray-500 text-xs mt-0.5 break-words" data-testid={`doctor-clinic-${doctor.id}`}>
                            {doctor.clinic}
                          </p>
                        )}
                      </div>
                      {doctor.rating && (
                        <div className="flex flex-col items-end ml-2 flex-shrink-0">
                          <div className="flex items-center space-x-1">
                            <Star className="text-yellow-400 fill-current" size={14} />
                            <span className="text-sm font-semibold text-black" data-testid={`doctor-rating-${doctor.id}`}>
                              {Number(doctor.rating).toFixed(1)}
                            </span>
                          </div>
                          {doctor.reviewCount && (
                            <p className="text-xs text-gray-500" data-testid={`doctor-reviews-${doctor.id}`}>
                              {doctor.reviewCount} {doctor.reviewCount === 1 ? 'review' : 'reviews'}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Location */}
                {doctor.location && (
                  <div className="flex items-center space-x-2 text-gray-600">
                    <MapPin size={14} className="flex-shrink-0" />
                    <span className="text-sm break-words" data-testid={`doctor-location-${doctor.id}`}>
                      {doctor.location}
                    </span>
                    {doctor.distance !== null && doctor.distance !== undefined && (
                      <>
                        <span className="text-gray-400">•</span>
                        <span className="text-xs text-gray-500 font-medium" data-testid={`doctor-distance-${doctor.id}`}>
                          {formatDistance(doctor.distance)}
                        </span>
                      </>
                    )}
                  </div>
                )}

                {/* Contact Info - Compact */}
                {(doctor.phone || doctor.email) && (
                  <div className="flex items-center gap-4 text-xs text-gray-600 flex-wrap">
                    {doctor.phone && (
                      <div className="flex items-center space-x-1">
                        <Phone size={12} />
                        <span className="break-all" data-testid={`doctor-phone-${doctor.id}`}>
                          {doctor.phone}
                        </span>
                      </div>
                    )}
                    {doctor.email && (
                      <div className="flex items-center space-x-1">
                        <Mail size={12} />
                        <span className="break-all" data-testid={`doctor-email-${doctor.id}`}>
                          {doctor.email}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  {doctor.bulkBilling && (
                    <Badge className="bg-green-100 text-green-800 border border-green-300 text-xs" data-testid={`doctor-bulk-billing-${doctor.id}`}>
                      Bulk Billing
                    </Badge>
                  )}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button 
                    variant="outline"
                    className="flex-1 bg-white border-2 border-gray-300 text-black hover:bg-gray-50 py-2.5 rounded-lg font-medium text-sm min-w-0"
                    data-testid={`button-profile-${doctor.id}`}
                    onClick={() => navigate(`/doctors/${doctor.id}`)}
                  >
                    View Profile
                  </Button>
                  {doctor.phone && (
                    <Button 
                      variant="outline"
                      size="icon"
                      className="bg-white border-2 border-gray-300 text-black hover:bg-gray-50 rounded-lg flex-shrink-0 w-11 h-10"
                      data-testid={`button-call-${doctor.id}`}
                      onClick={() => window.location.href = `tel:${doctor.phone}`}
                      title="Call"
                    >
                      <Phone size={16} />
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    size="icon"
                    className="bg-white border-2 border-gray-300 text-black hover:bg-gray-50 rounded-lg flex-shrink-0 w-11 h-10"
                    data-testid={`button-directions-${doctor.id}`}
                    onClick={() => {
                      const url = getDirectionsUrl(getDoctorCoordinates(doctor), userLocation || undefined);
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    title="Get Directions"
                  >
                    <Navigation size={16} />
                  </Button>
                </div>
              </div>
            </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
