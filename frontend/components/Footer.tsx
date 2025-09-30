'use client';

import { ExternalLink } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-gray-100 border-t mt-12">
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-3 gap-8">
          {/* About Section */}
          <div>
            <h3 className="font-semibold mb-3">About Chess Stats</h3>
            <p className="text-sm text-gray-600">
              The ultimate destination for comprehensive chess statistics, player analysis, and game insights.
              Built for educational purposes.
            </p>
          </div>

          {/* Data Sources */}
          <div>
            <h3 className="font-semibold mb-3">Data Sources</h3>
            <div className="space-y-2">
              <a 
                href="https://www.chess.com/news/view/published-data-api" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Chess.com Published Data API
              </a>
              <a 
                href="https://lichess.org/api" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-gray-600 hover:text-blue-600 flex items-center gap-1"
              >
                <ExternalLink className="w-3 h-3" />
                Lichess API
              </a>
            </div>
          </div>

          {/* Legal & Attribution */}
          <div>
            <h3 className="font-semibold mb-3">Attribution</h3>
            <p className="text-sm text-gray-600 mb-2">
              Player data and statistics provided by:
            </p>
            <div className="flex gap-4">
              <a 
                href="https://www.chess.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-green-600 font-semibold hover:text-green-700"
              >
                Chess.com
              </a>
              <a 
                href="https://lichess.org" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 font-semibold hover:text-blue-700"
              >
                Lichess.org
              </a>
            </div>
          </div>
        </div>

        <div className="border-t mt-8 pt-6 text-center text-sm text-gray-500">
          <p>© 2025 Chess Stats. Educational project using public chess data.</p>
          <p className="mt-2">
            This website is not affiliated with Chess.com or Lichess. 
            All data is retrieved from public APIs in compliance with their terms of service.
          </p>
        </div>
      </div>
    </footer>
  );
}