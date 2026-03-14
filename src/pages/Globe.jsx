import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MapPin, Globe as GlobeIcon, ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/components/landing/ThemeToggle';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function DarkModeHandler() {
  const map = useMap();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  return null;
}

const northAmericanCapitals = [
  { name: 'Washington D.C.', country: 'United States', latitude: 38.9072, longitude: -77.0369, population: 700000 },
  { name: 'Ottawa', country: 'Canada', latitude: 45.4215, longitude: -75.6972, population: 1000000 },
  { name: 'Mexico City', country: 'Mexico', latitude: 19.4326, longitude: -99.1332, population: 9200000 },
  { name: 'Guatemala City', country: 'Guatemala', latitude: 14.6349, longitude: -90.5069, population: 3000000 },
  { name: 'Belmopan', country: 'Belize', latitude: 17.2510, longitude: -88.7590, population: 20000 },
  { name: 'San Salvador', country: 'El Salvador', latitude: 13.6929, longitude: -89.2182, population: 570000 },
  { name: 'Tegucigalpa', country: 'Honduras', latitude: 14.0723, longitude: -87.1921, population: 1400000 },
  { name: 'Managua', country: 'Nicaragua', latitude: 12.1364, longitude: -86.2514, population: 1050000 },
  { name: 'San José', country: 'Costa Rica', latitude: 9.9281, longitude: -84.0907, population: 340000 },
  { name: 'Panama City', country: 'Panama', latitude: 8.9824, longitude: -79.5199, population: 880000 },
  { name: 'Havana', country: 'Cuba', latitude: 23.1136, longitude: -82.3666, population: 2100000 },
  { name: 'Kingston', country: 'Jamaica', latitude: 17.9714, longitude: -76.7929, population: 670000 },
  { name: 'Port-au-Prince', country: 'Haiti', latitude: 18.5944, longitude: -72.3074, population: 987000 },
  { name: 'Santo Domingo', country: 'Dominican Republic', latitude: 18.4861, longitude: -69.9312, population: 965000 },
  { name: 'Nassau', country: 'Bahamas', latitude: 25.0443, longitude: -77.3504, population: 275000 },
];

export default function Globe() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const checkDarkMode = () => {
      setIsDark(document.documentElement.classList.contains('dark'));
    };
    
    checkDarkMode();
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    
    return () => observer.disconnect();
  }, []);

  const { data: cities = [], isLoading } = useQuery({
    queryKey: ['cities'],
    queryFn: () => base44.entities.City.list(),
  });

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const response = await base44.functions.invoke('searchCities', { query: searchQuery });
        setSearchResults(response.data.results || []);
        setShowResults(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
      setIsSearching(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleCitySelect = async (cityResult) => {
    setShowResults(false);
    setSearchQuery('');
    
    // Create or find city in database
    const existingCity = cities.find(c => 
      c.name === cityResult.name && c.country === cityResult.country
    );
    
    if (existingCity) {
      navigate(`/City/${encodeURIComponent(existingCity.name)}`);
    } else {
      // Create new city entry
      const newCity = await base44.entities.City.create({
        name: cityResult.name,
        country: cityResult.country,
        latitude: cityResult.latitude,
        longitude: cityResult.longitude,
        population: 0,
        climate_zone: 'temperate'
      });
      navigate(`/City/${encodeURIComponent(newCity.name)}`);
    }
  };

  const handleCityClick = (city) => {
    navigate(`/City/${encodeURIComponent(city.name)}`);
  };

  const allCities = [...cities, ...northAmericanCapitals.filter(capital => 
    !cities.some(city => city.name === capital.name && city.country === capital.country)
  )];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen bg-white dark:bg-slate-950 flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-[1000] bg-white/95 dark:bg-slate-950/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-[1760px] mx-auto px-6 lg:px-10 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/Landing')}
                className="rounded-full"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-fuchsia-600 rounded-lg flex items-center justify-center shadow-lg shadow-purple-500/30">
                  <GlobeIcon className="w-5 h-5 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-purple-600 to-fuchsia-600 bg-clip-text text-transparent">
                  planetary
                </span>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* Search Section */}
      <div className="relative z-[999] bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 py-6">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white dark:bg-slate-900 rounded-full shadow-xl shadow-purple-500/10 border border-slate-200 dark:border-slate-800 p-2">
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => searchResults.length > 0 && setShowResults(true)}
                  placeholder="Search cities worldwide..."
                  className="w-full pl-14 pr-6 py-4 bg-transparent text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none text-sm font-medium"
                />
                {isSearching && (
                  <Loader2 className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-purple-600 animate-spin" />
                )}
              </div>
              <button className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white p-4 rounded-full shadow-lg shadow-purple-500/30 transition-all hover:scale-105">
                <Search className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Search Results Dropdown */}
          {showResults && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 max-w-4xl mx-auto px-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl shadow-purple-500/10 max-h-96 overflow-y-auto">
                {searchResults.map((result, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCitySelect(result)}
                    className="w-full px-6 py-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-b-0 flex items-start gap-4 first:rounded-t-3xl last:rounded-b-3xl"
                  >
                    <div className="mt-1 p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <MapPin className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <div className="text-slate-900 dark:text-white font-semibold">{result.display}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                        {result.latitude.toFixed(4)}, {result.longitude.toFixed(4)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {showResults && searchResults.length === 0 && !isSearching && searchQuery.length >= 2 && (
            <div className="absolute top-full left-0 right-0 mt-2 max-w-4xl mx-auto px-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl shadow-purple-500/10 p-6 text-slate-500 dark:text-slate-400 text-sm">
                No cities found for "{searchQuery}"
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 relative">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: '100%', width: '100%' }}
          className="z-0"
        >
          {isDark ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          )}
          <DarkModeHandler />
          {allCities.map((city, idx) => (
            <Marker
              key={city.id || `capital-${idx}`}
              position={[city.latitude, city.longitude]}
            >
              <Popup>
                <div className="text-center p-3">
                  <h3 className="font-bold text-lg mb-1">{city.name}</h3>
                  <p className="text-sm text-slate-600 mb-2">{city.country}</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Pop: {(city.population / 1000000).toFixed(1)}M {city.climate_zone && `• ${city.climate_zone}`}
                  </p>
                  <button
                    onClick={() => handleCityClick(city)}
                    className="bg-gradient-to-r from-purple-600 to-fuchsia-600 hover:from-purple-700 hover:to-fuchsia-700 text-white px-5 py-2 rounded-full text-sm font-semibold shadow-lg shadow-purple-500/30 transition-all hover:scale-105"
                  >
                    Analyze Risks
                  </button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>
      </div>
    </div>
  );
}