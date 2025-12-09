// Ghost Cookie - Cookie Classifier
// Smart rules for cookie classification (no AI required)

// Cookie classification patterns
const COOKIE_PATTERNS = {
  essential: [
    "session",
    "sess",
    "csrf",
    "xsrf",
    "auth",
    "login",
    "token",
    "security",
    "consent",
    "cookie-consent",
    "gdpr",
  ],
  functional: [
    "lang",
    "language",
    "locale",
    "timezone",
    "currency",
    "theme",
    "preferences",
    "settings",
    "user-pref",
  ],
  tracking: [
    "_ga",
    "_gid",
    "_gat",
    "analytics",
    "tracking",
    "visitor",
    "_fbp",
    "_fbc",
    "pixel",
    "utm_",
    "campaign",
  ],
  advertising: [
    "ad",
    "ads",
    "doubleclick",
    "adsense",
    "adroll",
    "criteo",
    "taboola",
    "outbrain",
    "pubmatic",
    "amazon-ad",
  ],
};

// Cookie explanations database
const COOKIE_EXPLANATIONS = {
  // Google
  _ga: {
    name: "Google Analytics",
    purpose: "Rastrea visitantes únicos",
    category: "tracking",
  },
  _gid: {
    name: "Google Analytics",
    purpose: "Identifica sesiones de usuario",
    category: "tracking",
  },
  _gat: {
    name: "Google Analytics",
    purpose: "Limita la tasa de solicitudes",
    category: "tracking",
  },

  // Facebook
  _fbp: {
    name: "Facebook Pixel",
    purpose: "Rastrea conversiones publicitarias",
    category: "advertising",
  },
  _fbc: {
    name: "Facebook Click",
    purpose: "Almacena el ID del clic en anuncios",
    category: "advertising",
  },

  // Common
  PHPSESSID: {
    name: "Sesión PHP",
    purpose: "Mantiene la sesión del usuario",
    category: "essential",
  },
  JSESSIONID: {
    name: "Sesión Java",
    purpose: "Identifica la sesión del servidor",
    category: "essential",
  },

  // WordPress
  wordpress_logged_in: {
    name: "WordPress Login",
    purpose: "Mantiene el inicio de sesión",
    category: "essential",
  },
  "wp-settings": {
    name: "WordPress Settings",
    purpose: "Preferencias del usuario",
    category: "functional",
  },

  // Others
  lang: {
    name: "Idioma",
    purpose: "Almacena el idioma preferido",
    category: "functional",
  },
  theme: {
    name: "Tema",
    purpose: "Guarda el tema visual preferido",
    category: "functional",
  },
};

/**
 * Classify a cookie based on its name
 * @param {string} cookieName - Name of the cookie
 * @returns {string} - Category: 'essential', 'functional', 'tracking', 'advertising', or 'unknown'
 */
export function classifyCookie(cookieName) {
  const nameLower = cookieName.toLowerCase();

  // Check exact matches first
  if (COOKIE_EXPLANATIONS[cookieName]) {
    return COOKIE_EXPLANATIONS[cookieName].category;
  }

  // Check patterns
  for (const [category, patterns] of Object.entries(COOKIE_PATTERNS)) {
    for (const pattern of patterns) {
      if (nameLower.includes(pattern)) {
        return category;
      }
    }
  }

  return "unknown";
}

/**
 * Get explanation for a cookie
 * @param {string} cookieName - Name of the cookie
 * @returns {object|null} - Cookie explanation or null
 */
export function getCookieExplanation(cookieName) {
  return COOKIE_EXPLANATIONS[cookieName] || null;
}

/**
 * Get category display info
 * @param {string} category - Cookie category
 * @returns {object} - Display info with icon and color
 */
export function getCategoryInfo(category) {
  const categoryInfo = {
    essential: { icon: "🔒", label: "Esencial", color: "#22c55e" },
    functional: { icon: "⚙️", label: "Funcional", color: "#3b82f6" },
    tracking: { icon: "📊", label: "Tracking", color: "#f59e0b" },
    advertising: { icon: "📢", label: "Publicidad", color: "#ef4444" },
    unknown: { icon: "❓", label: "Desconocida", color: "#6b7280" },
  };

  return categoryInfo[category] || categoryInfo.unknown;
}

/**
 * Calculate privacy score for a domain
 * @param {number} trackerCount - Number of trackers detected
 * @param {number} cookieCount - Number of cookies
 * @param {object} cookieCategories - Count of cookies by category
 * @returns {object} - Score (0-100) and rating
 */
export function calculatePrivacyScore(
  trackerCount,
  cookieCount,
  cookieCategories = {}
) {
  let score = 100;

  // Deduct points for trackers (more impact)
  score -= Math.min(trackerCount * 5, 40);

  // Deduct points for tracking cookies
  score -= Math.min((cookieCategories.tracking || 0) * 3, 20);

  // Deduct points for advertising cookies
  score -= Math.min((cookieCategories.advertising || 0) * 3, 20);

  // Deduct points for total cookies
  score -= Math.min(cookieCount * 1, 20);

  score = Math.max(0, score);

  let rating, color, emoji;
  if (score >= 80) {
    rating = "Excelente";
    color = "#22c55e";
    emoji = "🛡️";
  } else if (score >= 60) {
    rating = "Bueno";
    color = "#3b82f6";
    emoji = "✅";
  } else if (score >= 40) {
    rating = "Moderado";
    color = "#f59e0b";
    emoji = "⚠️";
  } else {
    rating = "Bajo";
    color = "#ef4444";
    emoji = "🚨";
  }

  return { score, rating, color, emoji };
}
