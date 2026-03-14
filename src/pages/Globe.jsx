import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Search, Loader2, MapPin, Globe, ArrowLeft } from 'lucide-react';
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

export default function Globe() {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

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

  const filteredCities = cities;

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
                  <Globe className="w-5 h-5 text-white" />
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
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {filteredCities.map(city => (
            <Marker
              key={city.id}
              position={[city.latitude, city.longitude]}
            >
              <Popup>
                <div className="text-center p-3">
                  <h3 className="font-bold text-lg mb-1">{city.name}</h3>
                  <p className="text-sm text-slate-600 mb-2">{city.country}</p>
                  <p className="text-xs text-slate-500 mb-3">
                    Pop: {(city.population / 1000000).toFixed(1)}M • {city.climate_zone}
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