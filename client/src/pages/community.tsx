import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Plus, Heart, MessageCircle, Star, Smile, Trash2, MoreVertical, ExternalLink, AlertCircle, Send, Search, BookOpen, Clock, ArrowRight } from "lucide-react";
import HamburgerMenu from "@/components/hamburger-menu";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { useAuth } from "@/hooks/useAuth";
import { useLocation, Link } from "wouter";
import React from "react";
import type { ForumPost, ForumComment, User, Cycle } from "@shared/schema";
import { getStageInfoWithJsonFallback, type StageDetectionResult, type StageReferenceData, calculateCycleDay } from "@/lib/cycleUtils";
import { getRelevantArticles, formatReadingTime, getCategoryIcon, formatCategory, type EducationArticleData } from "@/lib/educationUtils";
import { Badge } from "@/components/ui/badge";

interface ForumPostWithUser extends ForumPost {
  user: User;
  commentCount: number;
}

interface ForumCommentWithUser extends ForumComment {
  user: User;
}

interface CommunityArticle {
  id: string;
  title: string;
  summary: string;
  url: string;
  category: string;
}

const reactions = [
  { emoji: "👍", name: "like" },
  { emoji: "❤️", name: "love" },
  { emoji: "😊", name: "happy" },
  { emoji: "🎉", name: "celebrate" },
  { emoji: "😮", name: "wow" },
  { emoji: "😢", name: "sad" }
];

export default function Community() {
  const [activeTab, setActiveTab] = useState("forum");
  const [newPostTitle, setNewPostTitle] = useState("");
  const [newPostContent, setNewPostContent] = useState("");
  const [newPostCategory, setNewPostCategory] = useState("question");
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [showReactions, setShowReactions] = useState<string | null>(null);
  const [replyingToPostId, setReplyingToPostId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const [, setLocation] = useLocation();
  const commentsContainerRef = React.useRef<HTMLDivElement | null>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();

  // Load community articles from API
  const { data: articles = [], isLoading: articlesLoading, error: articlesError } = useQuery<CommunityArticle[]>({
    queryKey: ["/api/community/articles"],
    enabled: activeTab === "articles",
  });

  const { data: forumPosts = [], isLoading } = useQuery<ForumPostWithUser[]>({
    queryKey: ["/api/forum/posts"],
  });

  // Show newest discussions first
  const sortedPosts = React.useMemo(
    () =>
      [...forumPosts].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    [forumPosts],
  );

  // Get active cycle and milestones for helpful resources
  const { data: activeCycle } = useQuery<Cycle>({
    queryKey: ["/api/cycles/active"],
  });

  const { data: rawMilestones = [] } = useQuery<any[]>({
    queryKey: activeCycle ? ["/api/cycles", activeCycle.id, "/milestones"] : [],
    enabled: !!activeCycle,
  });
  const milestones = rawMilestones ?? [];

  const [currentPhase, setCurrentPhase] = useState<StageDetectionResult | null>(null);
  const [relevantArticles, setRelevantArticles] = useState<EducationArticleData[]>([]);

  const cycleDay = activeCycle ? calculateCycleDay(activeCycle.startDate) : 0;

  // Detect current phase
  useEffect(() => {
    if (!activeCycle) {
      setCurrentPhase(null);
      return;
    }
    
    const loadCurrentPhase = async () => {
      try {
        // Load stage reference data (empty array as fallback since we're using JSON data)
        const stageReferenceData: StageReferenceData[] = [];
        
        const stageResult = await getStageInfoWithJsonFallback(
          stageReferenceData,
          activeCycle,
          milestones,
          Math.max(cycleDay, 1)
        );
        setCurrentPhase(stageResult);
      } catch (error) {
        console.error('Error detecting current phase:', error);
      }
    };
    
    loadCurrentPhase();
  }, [activeCycle?.id, activeCycle?.type, cycleDay, milestones.length]);

  // Load relevant educational articles based on phase and cycle type
  useEffect(() => {
    const loadEducationalContent = async () => {
      try {
        if (activeCycle && currentPhase) {
          // Convert phase name to slug format (e.g., "Egg Collection" -> "egg-collection")
          const phaseSlug = currentPhase.stage.name.toLowerCase().replace(/\s+/g, '-');
          const articles = await getRelevantArticles(phaseSlug, activeCycle.type, 3);
          setRelevantArticles(articles);
        } else {
          setRelevantArticles([]);
        }
      } catch (error) {
        console.error('Error loading educational content:', error);
      }
    };

    loadEducationalContent();
  }, [activeCycle?.id, currentPhase?.stage.name]);

  const createPostMutation = useMutation({
    mutationFn: async (data: any) => {
      await apiRequest("POST", "/api/forum/posts", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      setIsCreatePostOpen(false);
      setNewPostTitle("");
      setNewPostContent("");
      setNewPostCategory("question");
      toast({
        title: "Post created",
        description: "Your post has been shared with the community.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to create post. Please try again.",
        variant: "destructive",
      });
    },
  });

  const reactToPostMutation = useMutation({
    mutationFn: async ({ postId, reaction }: { postId: string; reaction: string }) => {
      await apiRequest("POST", `/api/forum/posts/${postId}/react`, { reaction });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      setShowReactions(null);
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
    },
  });

  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      await apiRequest("DELETE", `/api/forum/posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      toast({
        title: "Post deleted",
        description: "Your post has been successfully deleted.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to delete post. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Fetch comments for the post being replied to
  const { data: comments = [], isLoading: commentsLoading } = useQuery<ForumCommentWithUser[]>({
    queryKey: replyingToPostId ? [`/api/forum/posts/${replyingToPostId}/comments`] : [],
    enabled: !!replyingToPostId,
    staleTime: 0,
  });

  // Sort comments newest first for the open thread
  const sortedComments = React.useMemo(
    () =>
      [...comments].sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      ),
    [comments],
  );

  // Always keep newest (top) visible after load/post
  React.useEffect(() => {
    if (commentsContainerRef.current) {
      commentsContainerRef.current.scrollTop = 0;
    }
  }, [sortedComments.length, replyingToPostId]);

  // Create comment mutation
  const createCommentMutation = useMutation({
    mutationFn: async ({ postId, content }: { postId: string; content: string }) => {
      await apiRequest("POST", `/api/forum/posts/${postId}/comments`, { content });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/posts"] });
      if (replyingToPostId) {
        queryClient.invalidateQueries({ queryKey: [`/api/forum/posts/${replyingToPostId}/comments`] });
      }
      setReplyText("");
      toast({
        title: "Reply posted",
        description: "Your reply has been added to the discussion.",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = "/api/login";
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to post reply. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleReply = (postId: string) => {
    if (replyingToPostId === postId) {
      setReplyingToPostId(null);
      setReplyText("");
    } else {
      setReplyingToPostId(postId);
      setReplyText("");
    }
  };

  const handleSubmitReply = (postId: string) => {
    if (!replyText.trim()) {
      toast({
        title: "Missing content",
        description: "Please enter a reply.",
        variant: "destructive",
      });
      return;
    }
    createCommentMutation.mutate({ postId, content: replyText.trim() });
  };

  const handleCreatePost = () => {
    if (!newPostTitle.trim() || !newPostContent.trim()) {
      toast({
        title: "Missing information",
        description: "Please fill in both title and content.",
        variant: "destructive",
      });
      return;
    }

    createPostMutation.mutate({
      title: newPostTitle,
      content: newPostContent,
      category: newPostCategory,
      anonymous: false,
    });
  };

  const formatTimeAgo = (date: string | Date) => {
    const now = new Date();
    const postDate = new Date(date);
    const diffInHours = Math.floor((now.getTime() - postDate.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays}d ago`;
    return postDate.toLocaleDateString('en-AU', { month: 'short', day: 'numeric' });
  };

  const getUserInitials = (user: User) => {
    if (user.firstName && user.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    if (user.firstName) {
      return user.firstName.slice(0, 2);
    }
    return user.email ? user.email.slice(0, 2).toUpperCase() : "U";
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <div className="px-6 pt-8 pb-6">
        <Card className="rounded-2xl p-5 shadow-sm relative" style={{ backgroundColor: 'hsl(74, 17%, 78%)' }}>
          <HamburgerMenu className="absolute top-5 right-3 text-white hover:bg-white/10" />
          <div className="text-center">
            <h1 className="text-xl font-bold text-white mb-1" data-testid="title-community">
              Community & Support
            </h1>
            <p className="text-sm text-white/80" data-testid="subtitle-community">
              Connect with your community, stay informed with articles and FAQs
            </p>
          </div>
        </Card>
      </div>

      {/* Create Post Dialog */}
      <Dialog open={isCreatePostOpen} onOpenChange={setIsCreatePostOpen}>
        <DialogContent className="w-full max-w-md mx-4">
          <DialogHeader>
            <DialogTitle data-testid="title-create-post">Start New Discussion</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category" data-testid="label-category">Category</Label>
              <select
                id="category"
                value={newPostCategory}
                onChange={(e) => setNewPostCategory(e.target.value)}
                className="w-full mt-1 p-2 border border-border rounded-lg bg-background"
                data-testid="select-category"
              >
                <option value="question">Question</option>
                <option value="experience">Experience</option>
                <option value="support">Support</option>
              </select>
            </div>
            <div>
              <Label htmlFor="title" data-testid="label-title">Title</Label>
              <Input
                id="title"
                value={newPostTitle}
                onChange={(e) => setNewPostTitle(e.target.value)}
                placeholder="What's your question or topic?"
                className="mt-1"
                data-testid="input-title"
              />
            </div>
            <div>
              <Label htmlFor="content" data-testid="label-content">Content</Label>
              <Textarea
                id="content"
                value={newPostContent}
                onChange={(e) => setNewPostContent(e.target.value)}
                placeholder="Share your thoughts, experience, or question..."
                rows={4}
                className="mt-1"
                data-testid="textarea-content"
              />
            </div>
            <div className="flex space-x-2">
              <Button
                onClick={() => setIsCreatePostOpen(false)}
                variant="outline"
                className="flex-1"
                data-testid="button-cancel-post"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreatePost}
                disabled={createPostMutation.isPending}
                className="flex-1"
                data-testid="button-submit-post"
              >
                {createPostMutation.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Tabs */}
      <div className="px-6 mb-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex space-x-1 bg-card rounded-2xl p-1 w-full h-auto">
            <TabsTrigger 
              value="forum"
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-forum"
            >
              Forum
            </TabsTrigger>
            <TabsTrigger 
              value="articles"
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-articles"
            >
              Articles
            </TabsTrigger>
            <TabsTrigger 
              value="faqs"
              className="flex-1 py-3 px-4 rounded-xl text-sm font-medium data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              data-testid="tab-faqs"
            >
              FAQs
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="forum" className="mt-6">
            {/* Start Discussion Button */}
            <div className="mb-4">
              <Button 
                onClick={() => setIsCreatePostOpen(true)}
                className="w-full bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
                data-testid="button-start-discussion"
              >
                <Plus size={18} className="mr-2" />
                Start Discussion
              </Button>
            </div>
            
            {/* Forum Posts */}
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground" data-testid="recent-discussions-title">Recent Discussions</h3>
              
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : sortedPosts.length === 0 ? (
                <Card className="rounded-2xl p-6 shadow-sm text-center">
                  <p className="text-muted-foreground" data-testid="no-posts-message">
                    No posts yet. Be the first to start a discussion!
                  </p>
                </Card>
              ) : (
                sortedPosts.map((post) => (
                  <Card key={post.id} className="rounded-2xl p-6 shadow-sm" data-testid={`post-${post.id}`}>
                    <div className="flex items-start space-x-3 mb-3">
                      <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xs text-primary-foreground font-semibold" data-testid={`user-initials-${post.id}`}>
                          {getUserInitials(post.user)}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-medium text-card-foreground text-sm" data-testid={`username-${post.id}`}>
                              {post.user.firstName || "Anonymous"}
                            </span>
                            <span className="text-xs text-muted-foreground" data-testid={`timestamp-${post.id}`}>
                              {formatTimeAgo(post.createdAt || new Date())}
                            </span>
                            {/* Message button commented out temporarily */}
                            {/* {currentUser && post.userId !== (currentUser as any).id ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setLocation(`/messages?userId=${post.userId}`);
                                }}
                                data-testid={`send-message-${post.id}`}
                              >
                                <Send size={12} className="mr-1" />
                                Message
                              </Button>
                            ) : null} */}
                          </div>
                          {currentUser && post.userId === (currentUser as any).id ? (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  data-testid={`post-menu-${post.id}`}
                                >
                                  <MoreVertical size={16} className="text-muted-foreground" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onClick={() => deletePostMutation.mutate(post.id)}
                                  className="text-destructive focus:text-destructive"
                                  data-testid={`delete-post-${post.id}`}
                                >
                                  <Trash2 size={14} className="mr-2" />
                                  Delete Post
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null}
                        </div>
                        <h4 className="font-medium text-card-foreground mb-2" data-testid={`post-title-${post.id}`}>
                          {post.title}
                        </h4>
                        <p className="text-sm text-muted-foreground mb-3" data-testid={`post-content-${post.id}`}>
                          {post.content.substring(0, 150)}
                          {post.content.length > 150 && "..."}
                        </p>
                        <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                          <div className="flex items-center space-x-2">
                            <Popover 
                              open={showReactions === post.id} 
                              onOpenChange={(open) => setShowReactions(open ? post.id : null)}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="flex items-center space-x-1 hover:text-primary p-0 h-auto"
                                  data-testid={`button-reactions-${post.id}`}
                                >
                                  {/* Show user's reaction emoji if they have one, otherwise show Smile icon */}
                                  {(() => {
                                    const userReaction = (post as any).userReaction;
                                    if (userReaction) {
                                      const reaction = reactions.find(r => r.name === userReaction);
                                      if (reaction) {
                                        return <span className="text-base">{reaction.emoji}</span>;
                                      }
                                    }
                                    return <Smile size={14} />;
                                  })()}
                                  <span data-testid={`reactions-count-${post.id}`}>
                                    {(post as any).reactions ? Object.values((post as any).reactions).reduce((sum: number, count: any) => sum + count, 0) : post.likes || 0}
                                  </span>
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-2" side="top">
                                <div className="grid grid-cols-3 gap-1">
                                  {reactions.map((reaction) => {
                                    const isUserReaction = (post as any).userReaction === reaction.name;
                                    return (
                                      <Button
                                        key={reaction.name}
                                        variant={isUserReaction ? "default" : "ghost"}
                                        size="sm"
                                        className={`h-auto p-2 flex flex-col items-center space-y-1 hover:bg-muted ${isUserReaction ? "bg-primary text-primary-foreground" : ""}`}
                                        onClick={() => reactToPostMutation.mutate({ postId: post.id, reaction: reaction.name })}
                                        data-testid={`reaction-${reaction.name}-${post.id}`}
                                      >
                                        <span className="text-lg">{reaction.emoji}</span>
                                        <span className="text-xs">
                                          {(post as any).reactions?.[reaction.name] || 0}
                                        </span>
                                      </Button>
                                    );
                                  })}
                                </div>
                              </PopoverContent>
                            </Popover>
                            
                            {/* Display top reactions (excluding user's own reaction) */}
                            <div className="flex items-center space-x-1">
                              {(post as any).reactions && Object.entries((post as any).reactions)
                                .filter(([reactionName, count]) => {
                                  // Don't show user's own reaction in the list (it's already shown in the button)
                                  const isUserReaction = (post as any).userReaction === reactionName;
                                  return (count as number) > 0 && !isUserReaction;
                                })
                                .sort(([_, a], [__, b]) => (b as number) - (a as number))
                                .slice(0, 3)
                                .map(([reactionName, count]) => {
                                  const reaction = reactions.find(r => r.name === reactionName);
                                  return reaction ? (
                                    <div 
                                      key={reactionName} 
                                      className="flex items-center space-x-1 text-xs bg-muted px-2 py-1 rounded-full"
                                      data-testid={`reaction-display-${reactionName}-${post.id}`}
                                    >
                                      <span>{reaction.emoji}</span>
                                      <span>{count as number}</span>
                                    </div>
                                  ) : null;
                                })
                              }
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="flex items-center space-x-1 hover:text-primary p-0 h-auto"
                            data-testid={`button-comment-${post.id}`}
                            onClick={() => handleReply(post.id)}
                          >
                            <MessageCircle size={14} />
                            <span data-testid={`comments-count-${post.id}`}>{post.commentCount}</span>
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-primary p-0 h-auto"
                            data-testid={`button-reply-${post.id}`}
                            onClick={() => handleReply(post.id)}
                          >
                            {replyingToPostId === post.id ? "Cancel" : "Reply"}
                          </Button>
                          {/* Chat button commented out temporarily */}
                          {/* {currentUser && post.userId !== (currentUser as any).id && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-primary p-0 h-auto"
                              onClick={(e) => {
                                e.preventDefault();
                                setLocation(`/messages?userId=${post.userId}&postId=${post.id}`);
                              }}
                              data-testid={`button-chat-${post.id}`}
                            >
                              <Send size={14} className="mr-1" />
                              Chat
                            </Button>
                          )} */}
                        </div>
                      </div>
                    </div>
                    
                    {/* Comments and Reply Section */}
                    {replyingToPostId === post.id && (
                      <div className="mt-4 pt-4 border-t border-border">
                        {/* Display existing comments */}
                        {commentsLoading && (
                          <div className="text-sm text-muted-foreground">Loading comments...</div>
                        )}
                        {!commentsLoading && sortedComments.length > 0 && (
                          <div
                            ref={commentsContainerRef}
                            className={`space-y-3 mb-4 ${
                              sortedComments.length > 5 ? "max-h-80 overflow-y-auto pr-1" : ""
                            }`}
                          >
                            {sortedComments.map((comment) => (
                              <div key={comment.id} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg">
                                <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                                  <span className="text-xs text-primary font-semibold">
                                    {getUserInitials(comment.user)}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className="text-sm font-medium text-foreground">
                                      {comment.user.firstName || "Anonymous"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {formatTimeAgo(comment.createdAt || new Date())}
                                    </span>
                                  </div>
                                  <p className="text-sm text-muted-foreground">{comment.content}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {!commentsLoading && comments.length === 0 && (
                          <div className="text-sm text-muted-foreground mb-3">
                            No comments yet. Start the conversation below.
                          </div>
                        )}
                        
                        {/* Reply input */}
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Write a reply..."
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            className="min-h-[80px] resize-none"
                            data-testid={`textarea-reply-${post.id}`}
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleSubmitReply(post.id)}
                              disabled={createCommentMutation.isPending || !replyText.trim()}
                              data-testid={`button-submit-reply-${post.id}`}
                            >
                              {createCommentMutation.isPending ? "Posting..." : "Post Reply"}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setReplyingToPostId(null);
                                setReplyText("");
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
          
          <TabsContent value="articles" className="mt-6">
            {/* Search Articles */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search articles by title, category, or keyword..."
                  value={articleSearchQuery}
                  onChange={(e) => setArticleSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2.5 w-full rounded-xl border-2 focus:border-primary"
                  data-testid="input-search-articles"
                />
              </div>
            </div>

            {/* Disclaimer */}
            <Card className="rounded-xl p-4 mb-6 bg-amber-50/50 border border-amber-200/50">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 mb-1.5">External Links Disclaimer</p>
                  <p className="text-xs text-amber-800 leading-relaxed">
                    The articles below link to external websites. Foli is not responsible for the content, accuracy, or availability of these external sites. Always consult with your healthcare provider for medical advice.
              </p>
                </div>
              </div>
            </Card>

            {/* Articles Grid */}
            {articlesLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {[...Array(16)].map((_, i) => (
                  <Card key={i} className="rounded-2xl p-6 shadow-sm animate-pulse">
                    <div className="h-4 bg-gray-200 rounded w-3/4 mb-3"></div>
                    <div className="h-3 bg-gray-200 rounded w-full mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-5/6"></div>
                  </Card>
                ))}
              </div>
            ) : articlesError ? (
              <Card className="rounded-xl p-6 shadow-sm text-center">
                <p className="text-destructive" data-testid="articles-error">
                  Failed to load articles. Please try refreshing the page.
                </p>
              </Card>
            ) : articles.length === 0 ? (
              <Card className="rounded-xl p-6 shadow-sm text-center">
                <p className="text-muted-foreground" data-testid="articles-placeholder">
                  No articles available at this time. Please check back later.
                </p>
              </Card>
            ) : (() => {
              // Filter articles based on search query
              const filteredArticles = articles.filter((article) => {
                if (!articleSearchQuery.trim()) return true;
                const query = articleSearchQuery.toLowerCase();
                return (
                  article.title.toLowerCase().includes(query) ||
                  article.summary.toLowerCase().includes(query) ||
                  article.category.toLowerCase().includes(query)
                );
              });

              return filteredArticles.length === 0 ? (
                <Card className="rounded-xl p-6 shadow-sm text-center">
                  <p className="text-muted-foreground" data-testid="no-search-results">
                    No articles found matching "{articleSearchQuery}". Try a different search term.
                  </p>
                </Card>
              ) : (
                <div className="space-y-4">
                  {filteredArticles.map((article) => (
                  <Card
                    key={article.id}
                    className="rounded-xl p-6 shadow-sm hover:shadow-lg transition-all duration-200 cursor-pointer group border-2 hover:border-primary/40 bg-white"
                    onClick={() => {
                      window.open(article.url, '_blank', 'noopener,noreferrer');
                    }}
                    data-testid={`article-card-${article.id}`}
                  >
                    <div className="flex items-start justify-between mb-3 gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-3 py-1.5 rounded-md">
                            {article.category}
                          </span>
                          <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                        </div>
                        <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors">
                          {article.title}
                        </h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {article.summary}
                        </p>
                      </div>
                    </div>
                    <div className="pt-3 border-t border-gray-100 mt-3">
                      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <ExternalLink className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="font-medium">Opens in new window</span>
                      </p>
                    </div>
                  </Card>
                  ))}
                </div>
              );
            })()}
          </TabsContent>
          
          <TabsContent value="faqs" className="mt-6">
            {relevantArticles.length > 0 && activeCycle && currentPhase ? (
              <Card className="rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <BookOpen className="text-muted-foreground" size={22} />
                    <h3 className="font-semibold text-card-foreground leading-tight" data-testid="helpful-resources-title">
                      Helpful Resources for Your Phase
                    </h3>
                  </div>
                  <Link href="/education">
                    <Button variant="ghost" size="sm" data-testid="button-view-all-articles">
                      <span className="text-xs">View All</span>
                      <ArrowRight size={14} className="ml-1" />
                    </Button>
                  </Link>
                </div>

                <div className="space-y-3">
                  {relevantArticles.map((article: EducationArticleData, index: number) => {
                    // Ensure slug exists and is valid
                    if (!article.slug || typeof article.slug !== 'string') {
                      console.warn('Article missing valid slug:', article);
                      return null;
                    }
                    
                    const articlePath = `/education/${article.slug}`;
                    
                    return (
                      <Link 
                        key={article.id} 
                        href={articlePath}
                      >
                        <div 
                          className="flex items-start space-x-3 p-3 rounded-lg hover:bg-accent transition-colors cursor-pointer"
                          data-testid={`article-card-${index}`}
                        >
                          <div className="text-2xl flex-shrink-0">
                            {getCategoryIcon(article.category)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <Badge variant="secondary" className="text-xs">
                                {formatCategory(article.category)}
                              </Badge>
                              {article.featured && (
                                <Badge className="bg-pink-500 text-white text-xs">
                                  Featured
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm text-card-foreground line-clamp-1 mb-1" data-testid={`article-title-${index}`}>
                              {article.title}
                            </p>
                            <p className="text-xs text-muted-foreground line-clamp-2 mb-2" data-testid={`article-summary-${index}`}>
                              {article.summary}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                <span>{formatReadingTime(article.readingTime)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <Card className="rounded-2xl p-6 shadow-sm text-center">
                <p className="text-muted-foreground" data-testid="faqs-placeholder">
                  {activeCycle && !currentPhase 
                    ? "Helpful resources will appear here once your cycle phase is detected. Visit the forum to ask your questions!"
                    : "Frequently asked questions will be available here. Visit the forum to ask your questions!"}
                </p>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
