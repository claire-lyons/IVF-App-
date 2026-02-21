import { useState, useEffect } from "react";
import { useRoute, Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, BookOpen, Clock, ArrowLeft, Bookmark, BookmarkCheck } from "lucide-react";
import { 
  getAllArticles, 
  searchArticles, 
  getArticlesByCategory, 
  getCategories,
  formatCategory,
  formatReadingTime,
  getCategoryIcon,
  type EducationArticleData
} from "@/lib/educationUtils";
import ReactMarkdown from 'react-markdown';

export default function EducationPage() {
  const [articles, setArticles] = useState<EducationArticleData[]>([]);
  const [filteredArticles, setFilteredArticles] = useState<EducationArticleData[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    filterArticles();
  }, [selectedCategory, searchQuery, articles]);

  async function loadContent() {
    try {
      setLoading(true);
      const [allArticles, allCategories] = await Promise.all([
        getAllArticles(),
        getCategories()
      ]);
      setArticles(allArticles);
      setCategories(allCategories);
      setFilteredArticles(allArticles);
    } catch (error) {
      console.error('Failed to load educational content:', error);
    } finally {
      setLoading(false);
    }
  }

  async function filterArticles() {
    let results = articles;

    // Apply category filter
    if (selectedCategory !== "all") {
      results = await getArticlesByCategory(selectedCategory);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      results = await searchArticles(searchQuery);
      if (selectedCategory !== "all") {
        results = results.filter(a => a.category === selectedCategory);
      }
    }

    setFilteredArticles(results);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3" />
            <div className="h-12 bg-gray-200 rounded" />
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-32 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-24">
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex items-center gap-3 mb-6">
          <BookOpen className="h-8 w-8 text-pink-500" />
          <h1 className="text-2xl font-bold text-gray-900" data-testid="text-page-title">
            Education Hub
          </h1>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            data-testid="input-search-articles"
            type="text"
            placeholder="Search articles..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Categories */}
        <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="mb-6 -mx-4">
          <div className="w-full overflow-x-auto overflow-y-hidden pb-3 px-4 scrollbar-hide">
            <TabsList className="flex w-max gap-1 whitespace-nowrap justify-start">
              <TabsTrigger value="all" data-testid="tab-category-all" className="flex-shrink-0">
                All
              </TabsTrigger>
              {categories.map((category) => (
                <TabsTrigger 
                  key={category} 
                  value={category}
                  data-testid={`tab-category-${category}`}
                  className="flex-shrink-0"
                >
                  <span className="mr-1">{getCategoryIcon(category)}</span>
                  {formatCategory(category)}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={selectedCategory} className="mt-6">
            {filteredArticles.length === 0 ? (
              <Card>
                <CardContent className="pt-6">
                  <p className="text-center text-gray-500">
                    No articles found. Try adjusting your search or category filter.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {filteredArticles.map((article) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function ArticleCard({ article }: { article: EducationArticleData }) {
  // Ensure slug exists and is valid
  if (!article.slug || typeof article.slug !== 'string') {
    console.warn('Article missing valid slug:', article);
    return null;
  }

  const articlePath = `/education/${article.slug}`;

  return (
    <Link href={articlePath} className="block">
      <Card 
        className="hover:shadow-md transition-shadow cursor-pointer"
        data-testid={`card-article-${article.slug}`}
      >
        <CardHeader className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">{getCategoryIcon(article.category)}</span>
                <Badge variant="secondary" className="text-xs">
                  {formatCategory(article.category)}
                </Badge>
                {article.featured && (
                  <Badge className="bg-pink-500 text-white text-xs">
                    Featured
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg mb-2" data-testid={`article-title-${article.slug}`}>{article.title}</CardTitle>
              <CardDescription className="line-clamp-2">
                {article.summary}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{formatReadingTime(article.readingTime)}</span>
            </div>
            {article.tags && article.tags.length > 0 && (
              <div className="flex gap-1 flex-wrap">
                {article.tags.slice(0, 3).map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

export function ArticleViewPage() {
  const [, params] = useRoute("/education/:slug");
  const [article, setArticle] = useState<EducationArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);

  useEffect(() => {
    if (params?.slug) {
      loadArticle(params.slug);
    }
  }, [params?.slug]);

  async function loadArticle(slug: string) {
    try {
      setLoading(true);
      const { getArticleBySlug } = await import("@/lib/educationUtils");
      const foundArticle = await getArticleBySlug(slug);
      setArticle(foundArticle || null);
    } catch (error) {
      console.error('Failed to load article:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white p-4">
        <div className="max-w-3xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-24" />
            <div className="h-10 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-full" />
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-4 bg-gray-200 rounded" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white p-4">
        <div className="max-w-3xl mx-auto">
          <Link href="/education">
            <Button variant="ghost" size="sm" className="mb-4" data-testid="button-back">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Articles
            </Button>
          </Link>
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-gray-500">Article not found</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-white pb-24">
      <div className="max-w-3xl mx-auto p-4">
        <Link href="/education">
          <Button 
            variant="ghost" 
            size="sm" 
            className="mb-4"
            data-testid="button-back-to-articles"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <Card>
          <CardHeader className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{getCategoryIcon(article.category)}</span>
              <Badge variant="secondary">
                {formatCategory(article.category)}
              </Badge>
              {article.featured && (
                <Badge className="bg-pink-500 text-white">
                  Featured
                </Badge>
              )}
            </div>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <CardTitle className="text-2xl mb-3" data-testid="text-article-title">
                  {article.title}
                </CardTitle>
                <CardDescription className="text-base mb-4">
                  {article.summary}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setBookmarked(!bookmarked)}
                className="shrink-0"
                data-testid="button-bookmark"
              >
                {bookmarked ? (
                  <BookmarkCheck className="h-5 w-5 text-pink-500" />
                ) : (
                  <Bookmark className="h-5 w-5" />
                )}
              </Button>
            </div>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                <span>{formatReadingTime(article.readingTime)}</span>
              </div>
              {article.tags && article.tags.length > 0 && (
                <div className="flex gap-1 flex-wrap">
                  {article.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-6 pt-0">
            <div 
              className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-strong:text-gray-900 prose-ul:text-gray-700 prose-ol:text-gray-700"
              data-testid="content-article-body"
            >
              <ReactMarkdown>{article.content}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
