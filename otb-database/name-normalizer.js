/**
 * Name Normalizer for Chess Player Names
 * Handles various name formats and creates consistent player identities
 */

class NameNormalizer {
  constructor() {
    // Known player aliases and variations
    this.knownAliases = {
      'Fischer, Robert James': [
        'Fischer, Robert J',
        'Fischer, Robert J.',
        'Fischer, R.',
        'Fischer, R',
        'Fischer, Bobby',
        'Bobby Fischer',
        'Robert Fischer',
        'Fischer',
        'R Fischer',
        'R. Fischer',
        'Robert J. Fischer',
        'Fischer,Robert J',
        'Fischer,R'
      ],
      'Kasparov, Garry': [
        'Kasparov, Gary',
        'Kasparov, G.',
        'Kasparov, G',
        'Kasparov',
        'G. Kasparov',
        'Gary Kasparov',
        'Garry Kasparov',
        'Kasparov,G',
        'Kasparov,Garry',
        'Kasparov Garry'
      ],
      'Carlsen, Magnus': [
        'Carlsen, M.',
        'Carlsen, M',
        'Carlsen',
        'Magnus Carlsen',
        'M. Carlsen',
        'Carlsen,Magnus',
        'Carlsen,M'
      ],
      'Karpov, Anatoly': [
        'Karpov, A.',
        'Karpov, A',
        'Karpov',
        'Anatoly Karpov',
        'A. Karpov',
        'Karpov,Anatoly',
        'Karpov,A',
        'Karpov Anatoly'
      ],
      'Kramnik, Vladimir': [
        'Kramnik, V.',
        'Kramnik, V',
        'Kramnik',
        'Vladimir Kramnik',
        'V. Kramnik',
        'Kramnik,Vladimir',
        'Kramnik,V'
      ],
      'Anand, Viswanathan': [
        'Anand, V.',
        'Anand, V',
        'Anand',
        'Viswanathan Anand',
        'V. Anand',
        'Anand,Viswanathan',
        'Anand,V',
        'Vishy Anand'
      ],
      'Tal, Mikhail': [
        'Tal, M.',
        'Tal, M',
        'Tal',
        'Mikhail Tal',
        'M. Tal',
        'Tal,Mikhail',
        'Tal,M',
        'Misha Tal'
      ],
      'Petrosian, Tigran': [
        'Petrosian, T.',
        'Petrosian, T',
        'Petrosian',
        'Tigran Petrosian',
        'T. Petrosian',
        'Petrosian,Tigran',
        'Petrosian,T'
      ],
      'Spassky, Boris': [
        'Spassky, B.',
        'Spassky, B',
        'Spassky',
        'Boris Spassky',
        'B. Spassky',
        'Spassky,Boris',
        'Spassky,B'
      ],
      'Botvinnik, Mikhail': [
        'Botvinnik, M.',
        'Botvinnik, M',
        'Botvinnik',
        'Mikhail Botvinnik',
        'M. Botvinnik',
        'Botvinnik,Mikhail',
        'Botvinnik,M'
      ]
    };

    // Create reverse lookup map
    this.aliasToCanonical = {};
    for (const [canonical, aliases] of Object.entries(this.knownAliases)) {
      // Add the canonical name itself
      this.aliasToCanonical[this.normalizeForLookup(canonical)] = canonical;
      
      // Add all aliases
      for (const alias of aliases) {
        this.aliasToCanonical[this.normalizeForLookup(alias)] = canonical;
      }
    }

    // Common name patterns for general normalization
    this.commonPatterns = {
      // Title patterns to remove
      titles: /^(GM|IM|FM|WGM|WIM|WFM|CM|NM)\s+/i,
      // Country codes in brackets
      countryCodes: /\s*\[[A-Z]{3}\]\s*$/,
      // Rating in parentheses
      ratings: /\s*\(\d{3,4}\)\s*$/,
      // Extra whitespace
      extraSpaces: /\s+/g,
      // Multiple commas
      multipleCommas: /,+/g
    };
  }

  /**
   * Normalize a name for lookup (lowercase, remove spaces/punctuation)
   */
  normalizeForLookup(name) {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/[,.\s-]+/g, '')
      .trim();
  }

  /**
   * Clean a name by removing titles, ratings, etc.
   */
  cleanName(name) {
    if (!name) return '';
    
    let cleaned = name
      .replace(this.commonPatterns.titles, '')
      .replace(this.commonPatterns.countryCodes, '')
      .replace(this.commonPatterns.ratings, '')
      .replace(this.commonPatterns.extraSpaces, ' ')
      .replace(this.commonPatterns.multipleCommas, ',')
      .trim();
    
    return cleaned;
  }

  /**
   * Try to normalize a name to canonical form
   */
  normalize(name) {
    if (!name) return '';
    
    // Clean the name first
    const cleaned = this.cleanName(name);
    
    // Check if this is a known alias
    const lookupKey = this.normalizeForLookup(cleaned);
    if (this.aliasToCanonical[lookupKey]) {
      return this.aliasToCanonical[lookupKey];
    }
    
    // Try to match partial names (last name only)
    const parts = cleaned.split(/[,\s]+/);
    if (parts.length === 1) {
      // Single name, might be just last name
      for (const [canonical, aliases] of Object.entries(this.knownAliases)) {
        const canonicalLast = canonical.split(',')[0].trim();
        if (canonicalLast.toLowerCase() === parts[0].toLowerCase()) {
          return canonical;
        }
      }
    }
    
    // Try to format as "Last, First" if not already
    if (!cleaned.includes(',') && parts.length >= 2) {
      // Assume format is "First Last" and convert to "Last, First"
      const lastName = parts[parts.length - 1];
      const firstName = parts.slice(0, -1).join(' ');
      const reformatted = `${lastName}, ${firstName}`;
      
      // Check if this reformatted version is known
      const reformattedKey = this.normalizeForLookup(reformatted);
      if (this.aliasToCanonical[reformattedKey]) {
        return this.aliasToCanonical[reformattedKey];
      }
      
      return reformatted;
    }
    
    // Return cleaned name if no match found
    return cleaned;
  }

  /**
   * Check if two names refer to the same player
   */
  isSamePlayer(name1, name2) {
    const normalized1 = this.normalize(name1);
    const normalized2 = this.normalize(name2);
    return normalized1 === normalized2;
  }

  /**
   * Add a new alias for a player
   */
  addAlias(canonical, alias) {
    if (!this.knownAliases[canonical]) {
      this.knownAliases[canonical] = [];
    }
    
    if (!this.knownAliases[canonical].includes(alias)) {
      this.knownAliases[canonical].push(alias);
      this.aliasToCanonical[this.normalizeForLookup(alias)] = canonical;
    }
  }

  /**
   * Get all known variations of a player's name
   */
  getAllVariations(name) {
    const canonical = this.normalize(name);
    return [canonical, ...(this.knownAliases[canonical] || [])];
  }

  /**
   * Export aliases for database storage
   */
  exportAliases() {
    return this.knownAliases;
  }

  /**
   * Import aliases from database
   */
  importAliases(aliases) {
    this.knownAliases = { ...this.knownAliases, ...aliases };
    
    // Rebuild reverse lookup
    this.aliasToCanonical = {};
    for (const [canonical, aliasList] of Object.entries(this.knownAliases)) {
      this.aliasToCanonical[this.normalizeForLookup(canonical)] = canonical;
      for (const alias of aliasList) {
        this.aliasToCanonical[this.normalizeForLookup(alias)] = canonical;
      }
    }
  }
}

// Test the normalizer
function testNormalizer() {
  const normalizer = new NameNormalizer();
  
  const testCases = [
    'Fischer, Robert J',
    'Fischer, R.',
    'Bobby Fischer',
    'Fischer',
    'GM Fischer, Robert J.',
    'Fischer, Robert James [USA]',
    'Fischer, R. (2785)',
    'Kasparov',
    'Kasparov, Gary',
    'GM Kasparov, G.',
    'Magnus Carlsen',
    'Carlsen, M'
  ];
  
  console.log('Name Normalization Tests:');
  console.log('=' . repeat(50));
  
  for (const test of testCases) {
    const normalized = normalizer.normalize(test);
    console.log(`"${test}" => "${normalized}"`);
  }
  
  console.log('\n' + '=' . repeat(50));
  console.log('Same Player Tests:');
  console.log(`"Fischer, R." vs "Bobby Fischer": ${normalizer.isSamePlayer('Fischer, R.', 'Bobby Fischer')}`);
  console.log(`"Kasparov, G." vs "Carlsen, M.": ${normalizer.isSamePlayer('Kasparov, G.', 'Carlsen, M.')}`);
}

module.exports = NameNormalizer;

// Run tests if executed directly
if (require.main === module) {
  testNormalizer();
}