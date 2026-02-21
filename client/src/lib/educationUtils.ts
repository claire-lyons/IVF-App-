// Educational article type (matches database schema)
export interface EducationArticleData {
  id: string;
  slug: string;
  title: string;
  summary: string;
  category: string;
  tags?: string[] | null;
  phases?: string[] | null;
  cycleTypes?: string[] | null;
  readingTime?: number | null;
  featured?: boolean | null;
  content: string;
  createdAt?: string;
  updatedAt?: string;
}

// API helper function
async function apiRequest<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
  const url = new URL(endpoint, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
  }
    });
  }
  
  const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  return response.json();
}

// Get all educational articles
export async function getAllArticles(): Promise<EducationArticleData[]> {
  try {
    return await apiRequest<EducationArticleData[]>('/api/educational-articles');
  } catch (error) {
    console.error('Failed to load educational articles:', error);
    return [];
  }
}

// Get a specific article by slug
export async function getArticleBySlug(slug: string): Promise<EducationArticleData | undefined> {
  try {
    return await apiRequest<EducationArticleData>(`/api/educational-articles/${slug}`);
  } catch (error) {
    console.error('Failed to load educational article:', error);
    return undefined;
  }
}

// Get featured articles (for home page)
export async function getFeaturedArticles(limit?: number): Promise<EducationArticleData[]> {
  try {
    return await apiRequest<EducationArticleData[]>('/api/educational-articles', {
      featured: true,
      limit,
    });
  } catch (error) {
    console.error('Failed to load featured articles:', error);
    return [];
  }
}

// Get articles by category
export async function getArticlesByCategory(category: string): Promise<EducationArticleData[]> {
  try {
    const articles = await getAllArticles();
  return articles.filter(article => article.category === category);
  } catch (error) {
    console.error('Failed to load articles by category:', error);
    return [];
  }
}

// Get relevant articles based on current phase and cycle type
export async function getRelevantArticles(
  phase?: string,
  cycleType?: string,
  limit?: number
): Promise<EducationArticleData[]> {
  try {
    const params: Record<string, any> = {};
    if (phase) params.phase = phase;
    if (cycleType) params.cycleType = cycleType;
    if (limit) params.limit = limit;
    
    return await apiRequest<EducationArticleData[]>('/api/educational-articles', params);
  } catch (error) {
    console.error('Failed to load relevant articles:', error);
    return [];
  }
}

// Search articles by title, summary, or content
export async function searchArticles(query: string): Promise<EducationArticleData[]> {
  if (!query.trim()) {
    return getAllArticles();
  }

  try {
    const articles = await getAllArticles();
  const searchTerm = query.toLowerCase();

  return articles.filter(article => {
    const titleMatch = article.title.toLowerCase().includes(searchTerm);
    const summaryMatch = article.summary.toLowerCase().includes(searchTerm);
    const contentMatch = article.content.toLowerCase().includes(searchTerm);
    const tagMatch = article.tags?.some(tag => tag.toLowerCase().includes(searchTerm));
    const categoryMatch = article.category.toLowerCase().includes(searchTerm);

    return titleMatch || summaryMatch || contentMatch || tagMatch || categoryMatch;
  });
  } catch (error) {
    console.error('Failed to search articles:', error);
    return [];
  }
}

// Get articles by multiple tags
export async function getArticlesByTags(tags: string[]): Promise<EducationArticleData[]> {
  if (tags.length === 0) {
    return getAllArticles();
  }

  try {
    const articles = await getAllArticles();
  const lowerTags = tags.map(tag => tag.toLowerCase());

  return articles.filter(article => {
    if (!article.tags || article.tags.length === 0) {
      return false;
    }
    return article.tags.some(tag => 
      lowerTags.includes(tag.toLowerCase())
    );
  });
  } catch (error) {
    console.error('Failed to load articles by tags:', error);
    return [];
  }
}

// Get unique categories
export async function getCategories(): Promise<string[]> {
  try {
    const articles = await getAllArticles();
  const categories = new Set(articles.map(article => article.category));
  return Array.from(categories);
  } catch (error) {
    console.error('Failed to load categories:', error);
    return [];
  }
}

// Get unique tags
export async function getAllTags(): Promise<string[]> {
  try {
    const articles = await getAllArticles();
  const tags = new Set<string>();
  articles.forEach(article => {
    article.tags?.forEach(tag => tags.add(tag));
  });
  return Array.from(tags);
  } catch (error) {
    console.error('Failed to load tags:', error);
    return [];
  }
}

// Format category for display
export function formatCategory(category: string): string {
  return category
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Get reading time estimate in human-readable format
export function formatReadingTime(minutes: number | null | undefined): string {
  if (!minutes) return 'Quick read';
  if (minutes < 5) return `${minutes} min read`;
  return `${minutes} min read`;
}

// Get category icon
export function getCategoryIcon(category: string): string {
  const icons: Record<string, string> = {
    'medications': '💊',
    'procedures': '🏥',
    'emotional-support': '💜',
    'nutrition': '🥗',
    'side-effects': '⚠️',
  };
  return icons[category] || '📖';
}
