'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Search, User, Trophy, Clock, TrendingUp, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import axios from 'axios';

interface SearchResult {
  type: 'player' | 'tournament' | 'opening';
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  icon?: React.ReactNode;
}

interface SearchAutocompleteProps {
  placeholder?: string;
  className?: string;
  onSelect?: (result: SearchResult) => void;
  searchTypes?: ('player' | 'tournament' | 'opening')[];
}

export default function SearchAutocomplete({
  placeholder = 'Search players, tournaments, openings...',
  className = '',
  onSelect,
  searchTypes = ['player', 'tournament', 'opening']
}: SearchAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [isMounted, setIsMounted] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimer = useRef<NodeJS.Timeout>();
  const router = useRouter();

  // Prevent hydration issues by only rendering after mount
  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Popular/default suggestions - memoized to prevent infinite loops
  const defaultSuggestions = useMemo((): SearchResult[] => {
    const suggestions: SearchResult[] = [];
    
    if (searchTypes.includes('player')) {
      suggestions.push(
        {
          type: 'player',
          id: 'magnuscarlsen',
          title: 'Magnus Carlsen',
          subtitle: 'World Champion',
          meta: '2830',
          icon: <User className="w-4 h-4" />
        },
        {
          type: 'player',
          id: 'hikaru',
          title: 'Hikaru Nakamura',
          subtitle: 'GM',
          meta: '2780',
          icon: <User className="w-4 h-4" />
        }
      );
    }
    
    if (searchTypes.includes('tournament')) {
      suggestions.push({
        type: 'tournament',
        id: 'world-championship-2024',
        title: 'World Championship 2024',
        subtitle: 'FIDE',
        icon: <Trophy className="w-4 h-4" />
      });
    }
    
    if (searchTypes.includes('opening')) {
      suggestions.push(
        {
          type: 'opening',
          id: 'sicilian-defense',
          title: 'Sicilian Defense',
          subtitle: 'B20-B99',
          meta: '1.e4 c5',
          icon: <TrendingUp className="w-4 h-4" />
        },
        {
          type: 'opening',
          id: 'queens-gambit',
          title: "Queen's Gambit",
          subtitle: 'D06-D69',
          meta: '1.d4 d5 2.c4',
          icon: <TrendingUp className="w-4 h-4" />
        }
      );
    }
    
    return suggestions;
  }, [searchTypes]);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults(defaultSuggestions);
      return;
    }

    setIsLoading(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search players
      if (searchTypes.includes('player')) {
        try {
          // For now, we'll use Chess.com search (could be enhanced with our database)
          const response = await axios.get(`http://localhost:3007/api/players/${searchQuery}`);
          if (response.data) {
            searchResults.push({
              type: 'player',
              id: response.data.username,
              title: response.data.username,
              subtitle: response.data.title || 'Player',
              meta: response.data.country,
              icon: <User className="w-4 h-4" />
            });
          }
        } catch (err) {
          // Player not found, that's ok
        }
      }

      // Search tournaments (from our database)
      if (searchTypes.includes('tournament')) {
        try {
          const response = await axios.get(`http://localhost:3007/api/otb/database/tournaments`);
          const tournaments = response.data || [];
          const filtered = tournaments
            .filter((t: any) => 
              t.name?.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .slice(0, 3)
            .map((t: any) => ({
              type: 'tournament' as const,
              id: t.id || t.name,
              title: t.name,
              subtitle: t.location || t.site,
              meta: t.date,
              icon: <Trophy className="w-4 h-4" />
            }));
          searchResults.push(...filtered);
        } catch (err) {
          console.error('Tournament search error:', err);
        }
      }

      // Search openings (static for now, could be enhanced)
      if (searchTypes.includes('opening')) {
        const openings = [
          { id: 'sicilian-defense', name: 'Sicilian Defense', eco: 'B20-B99', moves: '1.e4 c5' },
          { id: 'french-defense', name: 'French Defense', eco: 'C00-C19', moves: '1.e4 e6' },
          { id: 'caro-kann', name: 'Caro-Kann Defense', eco: 'B10-B19', moves: '1.e4 c6' },
          { id: 'queens-gambit', name: "Queen's Gambit", eco: 'D06-D69', moves: '1.d4 d5 2.c4' },
          { id: 'kings-indian', name: "King's Indian Defense", eco: 'E60-E99', moves: '1.d4 Nf6 2.c4 g6' },
          { id: 'nimzo-indian', name: 'Nimzo-Indian Defense', eco: 'E20-E59', moves: '1.d4 Nf6 2.c4 e6 3.Nc3 Bb4' },
          { id: 'italian-game', name: 'Italian Game', eco: 'C50-C59', moves: '1.e4 e5 2.Nf3 Nc6 3.Bc4' },
          { id: 'ruy-lopez', name: 'Ruy Lopez', eco: 'C60-C99', moves: '1.e4 e5 2.Nf3 Nc6 3.Bb5' },
        ];
        
        const filtered = openings
          .filter(o => o.name.toLowerCase().includes(searchQuery.toLowerCase()))
          .slice(0, 3)
          .map(o => ({
            type: 'opening' as const,
            id: o.id,
            title: o.name,
            subtitle: o.eco,
            meta: o.moves,
            icon: <TrendingUp className="w-4 h-4" />
          }));
        searchResults.push(...filtered);
      }

      setResults(searchResults.length > 0 ? searchResults : []);
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, [searchTypes]); // Remove defaultSuggestions from deps

  // Debounced search
  useEffect(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(() => {
      performSearch(query);
    }, 300);

    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, [query, performSearch]);

  // Handle clicks outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev < results.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => 
          prev > 0 ? prev - 1 : results.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        } else if (query) {
          // Perform general search
          router.push(`/search?q=${encodeURIComponent(query)}`);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Handle result selection
  const handleSelect = (result: SearchResult) => {
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);

    if (onSelect) {
      onSelect(result);
    } else {
      // Default navigation
      switch (result.type) {
        case 'player':
          router.push(`/players/${result.id}`);
          break;
        case 'tournament':
          router.push(`/tournaments/${result.id}`);
          break;
        case 'opening':
          router.push(`/openings?eco=${result.id}`);
          break;
      }
    }
  };

  // Prevent hydration mismatch - render minimal version during SSR
  if (!isMounted) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <div className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg bg-white text-gray-500">
            {placeholder}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults(defaultSuggestions);
              inputRef.current?.focus();
            }}
            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-gray-500">
              <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900"></div>
            </div>
          ) : results.length > 0 ? (
            <div className="py-2">
              {!query && (
                <div className="px-3 py-2 text-xs text-gray-500 uppercase tracking-wider">
                  Suggestions
                </div>
              )}
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelect(result)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`w-full px-3 py-2 flex items-center gap-3 hover:bg-gray-50 transition-colors ${
                    selectedIndex === index ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="text-gray-400">
                    {result.icon}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-medium text-gray-900">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-gray-500">{result.subtitle}</div>
                    )}
                  </div>
                  {result.meta && (
                    <div className="text-sm text-gray-400">{result.meta}</div>
                  )}
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-4 text-center text-gray-500">
              No results found for "{query}"
            </div>
          ) : null}
          
          {query && (
            <div className="border-t border-gray-200 p-2">
              <button
                onClick={() => router.push(`/search?q=${encodeURIComponent(query)}`)}
                className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                Search for "{query}" →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}