'use client';

import Link from 'next/link';
import { Trophy, Crown, Globe, Star, Award, Target, Users, Calendar } from 'lucide-react';

interface TournamentCategory {
  title: string;
  icon: React.ReactNode;
  description: string;
  tournaments: {
    name: string;
    description: string;
    slug: string;
  }[];
}

export default function NotableTournamentsPage() {
  const categories: TournamentCategory[] = [
    {
      title: "World Championships",
      icon: <Crown className="w-6 h-6 text-yellow-400" />,
      description: "The most prestigious chess competitions",
      tournaments: [
        { 
          name: "World Championship Match", 
          description: "The ultimate chess title match",
          slug: "world-championship-match"
        },
        { 
          name: "World Chess Championship", 
          description: "Official FIDE World Championship",
          slug: "world-chess-championship"
        },
        { 
          name: "Candidates Tournament", 
          description: "Qualifier for the World Championship",
          slug: "candidates-tournament"
        },
        { 
          name: "World Cup", 
          description: "Knockout tournament with 128+ players",
          slug: "world-cup"
        },
        { 
          name: "World Rapid Championship", 
          description: "Official rapid chess world championship",
          slug: "world-rapid-championship"
        },
        { 
          name: "World Blitz Championship", 
          description: "Official blitz chess world championship",
          slug: "world-blitz-championship"
        }
      ]
    },
    {
      title: "Team Championships",
      icon: <Globe className="w-6 h-6 text-blue-400" />,
      description: "International team competitions",
      tournaments: [
        { 
          name: "Chess Olympiad", 
          description: "The world team championship",
          slug: "chess-olympiad"
        },
        { 
          name: "European Team Championship", 
          description: "Continental team championship",
          slug: "european-team-championship"
        },
        { 
          name: "World Team Championship", 
          description: "Elite team competition",
          slug: "world-team-championship"
        },
        { 
          name: "Asian Games Chess", 
          description: "Continental multi-sport event",
          slug: "asian-games"
        }
      ]
    },
    {
      title: "Elite Tournaments",
      icon: <Star className="w-6 h-6 text-purple-400" />,
      description: "Top-tier invitation tournaments",
      tournaments: [
        { 
          name: "Tata Steel Chess", 
          description: "Premier tournament in Wijk aan Zee",
          slug: "tata-steel"
        },
        { 
          name: "Norway Chess", 
          description: "Elite super-tournament in Stavanger",
          slug: "norway-chess"
        },
        { 
          name: "Sinquefield Cup", 
          description: "Top US tournament in St. Louis",
          slug: "sinquefield-cup"
        },
        { 
          name: "London Chess Classic", 
          description: "Premier UK tournament",
          slug: "london-chess-classic"
        },
        { 
          name: "Linares", 
          description: "Historic Spanish super-tournament",
          slug: "linares"
        },
        { 
          name: "Dortmund Sparkassen", 
          description: "German elite tournament",
          slug: "dortmund"
        }
      ]
    },
    {
      title: "Major Opens",
      icon: <Users className="w-6 h-6 text-green-400" />,
      description: "Large open tournaments",
      tournaments: [
        { 
          name: "Gibraltar Masters", 
          description: "Strong open tournament",
          slug: "gibraltar"
        },
        { 
          name: "Isle of Man International", 
          description: "Premier British open",
          slug: "isle-of-man"
        },
        { 
          name: "Reykjavik Open", 
          description: "Iceland\'s premier tournament",
          slug: "reykjavik-open"
        },
        { 
          name: "Dubai Open", 
          description: "Strong Middle Eastern open",
          slug: "dubai-open"
        },
        { 
          name: "Aeroflot Open", 
          description: "Moscow super-open",
          slug: "aeroflot-open"
        },
        { 
          name: "US Open", 
          description: "America\'s largest open",
          slug: "us-open"
        }
      ]
    },
    {
      title: "Historic Tournaments",
      icon: <Award className="w-6 h-6 text-orange-400" />,
      description: "Legendary competitions from chess history",
      tournaments: [
        { 
          name: "USSR Championship", 
          description: "Historic Soviet championship",
          slug: "ussr-championship"
        },
        { 
          name: "Hastings", 
          description: "Historic British tournament since 1895",
          slug: "hastings"
        },
        { 
          name: "Zurich 1953", 
          description: "Legendary candidates tournament",
          slug: "zurich-1953"
        },
        { 
          name: "Montreal 1979", 
          description: "Tournament of Stars",
          slug: "montreal-1979"
        },
        { 
          name: "AVRO 1938", 
          description: "Historic super-tournament",
          slug: "avro-1938"
        }
      ]
    },
    {
      title: "National Championships",
      icon: <Target className="w-6 h-6 text-red-400" />,
      description: "Top national competitions",
      tournaments: [
        { 
          name: "US Championship", 
          description: "United States national championship",
          slug: "usa-ch"
        },
        { 
          name: "Russian Championship", 
          description: "Russian national championship",
          slug: "rus-ch"
        },
        { 
          name: "British Championship", 
          description: "UK national championship",
          slug: "gbr-ch"
        },
        { 
          name: "German Championship", 
          description: "German national championship",
          slug: "ger-ch"
        },
        { 
          name: "French Championship", 
          description: "French national championship",
          slug: "fra-ch"
        },
        { 
          name: "Indian Championship", 
          description: "Indian national championship",
          slug: "ind-ch"
        }
      ]
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <Trophy className="w-16 h-16 mx-auto mb-4 text-yellow-400" />
          <h1 className="text-5xl font-bold mb-4">Notable Chess Tournaments</h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Explore the most prestigious and historic chess tournaments from our database of 397,000+ events
          </p>
        </div>

        {/* Navigation */}
        <div className="flex justify-center gap-4 mb-8">
          <Link 
            href="/tournaments"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Browse All Tournaments
          </Link>
          <Link 
            href="/"
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Back to Home
          </Link>
        </div>

        {/* Tournament Categories */}
        <div className="space-y-12">
          {categories.map((category) => (
            <div key={category.title} className="bg-gray-800/50 backdrop-blur rounded-lg p-8">
              <div className="flex items-center gap-3 mb-3">
                {category.icon}
                <h2 className="text-2xl font-bold">{category.title}</h2>
              </div>
              <p className="text-gray-400 mb-6">{category.description}</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {category.tournaments.map((tournament) => (
                  <Link
                    key={tournament.slug}
                    href={`/tournaments/${tournament.slug}`}
                    className="bg-gray-700/50 rounded-lg p-4 hover:bg-gray-600/50 transition-all hover:scale-105 group"
                  >
                    <h3 className="font-semibold text-blue-400 group-hover:text-blue-300 mb-2">
                      {tournament.name}
                    </h3>
                    <p className="text-sm text-gray-400">
                      {tournament.description}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Note */}
        <div className="mt-12 p-6 bg-gray-800/30 rounded-lg text-center">
          <p className="text-gray-400 mb-4">
            Can\'t find a specific tournament?
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/tournaments"
              className="text-blue-400 hover:text-blue-300"
            >
              Search all 397,000+ tournaments →
            </Link>
          </div>
          <p className="text-sm text-gray-500 mt-4">
            Note: Tournament pages are generated dynamically. If a tournament doesn\'t exist in our database, 
            you\'ll see sample data instead.
          </p>
        </div>
      </div>
    </div>
  );
}