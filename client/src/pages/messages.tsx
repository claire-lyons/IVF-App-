import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Send, MessageCircle, User, Users, Inbox, Info } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { DirectMessage, User as UserType } from "@shared/schema";
import { cn } from "@/lib/utils";

interface Conversation {
  otherUser: UserType;
  lastMessage: DirectMessage;
  unreadCount: number;
}

interface MessageWithUsers extends DirectMessage {
  sender: UserType;
  receiver: UserType;
}

function getUserInitials(user: UserType): string {
  const firstName = user.firstName || "";
  const lastName = user.lastName || "";
  if (firstName || lastName) {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || "U";
  }
  return "U";
}

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const diffInSeconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diffInSeconds < 60) return "Just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
  return then.toLocaleDateString();
}

function formatTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function Messages() {
  const [location, setLocation] = useLocation();
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [showStartConversationDialog, setShowStartConversationDialog] = useState(false);
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Get userId from URL query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const userId = params.get("userId");
    if (userId) {
      setSelectedUserId(userId);
    }
  }, [location]);

  // Fetch conversations
  const {
    data: conversations = [],
    refetch: refetchConversations,
    isLoading: isConversationsLoading,
  } = useQuery<Conversation[]>({
    queryKey: ["/api/messages/conversations"],
    enabled: !!currentUser,
  });

  // Fetch messages for selected conversation
  const { data: messages = [], refetch: refetchMessages } = useQuery<MessageWithUsers[]>({
    queryKey: ["/api/messages", selectedUserId],
    enabled: !!selectedUserId && !!currentUser,
    refetchInterval: 5000, // Poll every 5 seconds
  });

  // Fetch unread count
  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["/api/messages/unread-count"],
    enabled: !!currentUser,
    refetchInterval: 10000, // Poll every 10 seconds
  });

  // Mark messages as read when conversation is selected
  useEffect(() => {
    if (selectedUserId && currentUser) {
      apiRequest("POST", `/api/messages/${selectedUserId}/read`, {})
        .then(() => {
          refetchConversations();
          queryClient.invalidateQueries({ queryKey: ["/api/messages/unread-count"] });
        })
        .catch(console.error);
    }
  }, [selectedUserId, currentUser, refetchConversations, queryClient]);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!selectedUserId) throw new Error("No user selected");
      return apiRequest("POST", "/api/messages", {
        receiverId: selectedUserId,
        content,
      });
    },
    onSuccess: () => {
      setNewMessage("");
      refetchMessages();
      refetchConversations();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send message",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = () => {
    if (!newMessage.trim() || !selectedUserId) return;
    sendMessageMutation.mutate(newMessage.trim());
  };

  const selectedConversation = conversations.find((c) => c.otherUser.id === selectedUserId);
  const currentUserId = (currentUser as any)?.id;
  const filteredConversations = useMemo(() => {
    if (!searchTerm.trim()) return conversations;
    return conversations.filter((conv) => {
      const fullName = `${conv.otherUser.firstName || ""} ${conv.otherUser.lastName || ""}`.toLowerCase();
      return (
        fullName.includes(searchTerm.toLowerCase()) ||
        conv.lastMessage.content.toLowerCase().includes(searchTerm.toLowerCase())
      );
    });
  }, [conversations, searchTerm]);

  const handleOpenConversation = (userId: string) => {
    setSelectedUserId(userId);
    setLocation(`/messages?userId=${userId}`);
  };

  const handleBackToList = () => {
    setSelectedUserId(null);
    setLocation("/messages");
  };

  const isThreadActive = Boolean(selectedConversation);

  return (
    <div className="min-h-screen bg-muted/20 pb-24">
      <div className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <MessageCircle className="text-primary" size={20} />
          <div>
            <h1 className="text-lg font-semibold">Messages</h1>
            <p className="text-xs text-muted-foreground">
              Private chats with community members
            </p>
          </div>
          {unreadData && unreadData.count > 0 && (
            <Badge variant="secondary" className="ml-auto text-xs">
              {unreadData.count} unread
            </Badge>
          )}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="grid gap-4 md:grid-cols-[320px,1fr]">
          {/* Conversation list */}
          <Card
            className={cn(
              "h-[calc(100vh-190px)] rounded-2xl border shadow-sm flex flex-col",
              isThreadActive && "hidden md:flex"
            )}
          >
            <div className="p-4 border-b space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-semibold">Conversations</h2>
                  <p className="text-xs text-muted-foreground">
                    Start from the community forum
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs"
                  onClick={() => setLocation("/community")}
                >
                  <Users size={14} className="mr-1" />
                  Forum
                </Button>
              </div>
              <Dialog open={showStartConversationDialog} onOpenChange={setShowStartConversationDialog}>
                <DialogTrigger asChild>
                  <Button
                    size="sm"
                    className="w-full"
                    data-testid="button-start-new-conversation"
                  >
                    <MessageCircle size={14} className="mr-2" />
                    Start New Conversation
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>Start a New Conversation</DialogTitle>
                    <DialogDescription>
                      Here's how you can start chatting with community members
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                      <Info className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-medium mb-1">From the Forum</p>
                        <p className="text-xs text-muted-foreground mb-3">
                          Go to the Community Forum and click "Chat" or "Reply" on any post to start a conversation with the author.
                        </p>
                        <Button
                          size="sm"
                          className="w-full"
                          onClick={() => {
                            setShowStartConversationDialog(false);
                            setLocation("/community");
                          }}
                        >
                          Go to Forum
                        </Button>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground text-center">
                      💡 Tip: You can also reply to posts publicly, which will appear in the forum discussion.
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              {conversations.length > 0 && (
                <Input
                  placeholder="Search conversations"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-9 text-sm"
                />
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-3">
                {isConversationsLoading ? (
                  <div className="text-center text-sm text-muted-foreground py-12">
                    Loading conversations...
                  </div>
                ) : filteredConversations.length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-12 px-4 space-y-4">
                    <Inbox className="mx-auto mb-3 text-muted-foreground" size={40} />
                    <div>
                      <p className="font-medium mb-1">No conversations yet</p>
                      <p className="text-xs text-muted-foreground">
                        Start chatting from any community post or reply to a discussion.
                      </p>
                    </div>
                    <div className="flex flex-col gap-2">
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => setLocation("/community")}
                        data-testid="button-start-conversation"
                      >
                        <MessageCircle size={14} className="mr-2" />
                        Go to Forum
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Click "Chat" or "Reply" on any post to start a conversation
                      </p>
                    </div>
                  </div>
                ) : (
                  filteredConversations.map((conversation) => {
                    const isActive = selectedUserId === conversation.otherUser.id;
                    return (
                      <button
                        key={conversation.otherUser.id}
                        onClick={() => handleOpenConversation(conversation.otherUser.id)}
                        className={cn(
                          "w-full rounded-xl border p-3 text-left transition-all",
                          isActive
                            ? "border-primary bg-primary/5 shadow-sm"
                            : "border-border bg-card hover:border-primary/50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">
                            {getUserInitials(conversation.otherUser)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium text-sm truncate">
                                {conversation.otherUser.firstName || "Anonymous"}
                              </span>
                              <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                                {formatTimeAgo(conversation.lastMessage.createdAt || new Date())}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {conversation.lastMessage.content}
                            </p>
                          </div>
                          {conversation.unreadCount > 0 && (
                            <Badge variant="destructive" className="ml-2">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </ScrollArea>
          </Card>

          {/* Thread */}
          <Card
            className={cn(
              "h-[calc(100vh-190px)] rounded-2xl border shadow-sm flex flex-col",
              !isThreadActive && "hidden md:flex"
            )}
          >
            {!selectedConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
                <MessageCircle className="text-muted-foreground mb-3" size={48} />
                <p className="font-medium">Select a conversation</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Choose someone from the list or start a chat in the forum.
                </p>
              </div>
            ) : (
              <>
                <div className="p-4 border-b flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden"
                    onClick={handleBackToList}
                  >
                    <ArrowLeft size={16} />
                  </Button>
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-sm font-semibold text-primary">
                    {getUserInitials(selectedConversation.otherUser)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {selectedConversation.otherUser.firstName || "Anonymous"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Active {formatTimeAgo(selectedConversation.lastMessage.createdAt || new Date())}
                    </p>
                  </div>
                </div>

                <ScrollArea className="flex-1 px-4 py-4">
                  <div className="space-y-4">
                    {messages.length === 0 ? (
                      <div className="text-center text-muted-foreground py-8 text-sm">
                        No messages yet. Start the conversation!
                      </div>
                    ) : (
                      messages.map((message) => {
                        const isSent = message.senderId === currentUserId;
                        return (
                          <div
                            key={message.id}
                            className={cn("flex items-start gap-3", isSent && "flex-row-reverse")}
                          >
                            {!isSent && (
                              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-xs font-semibold text-primary">
                                {getUserInitials(message.sender)}
                              </div>
                            )}
                            <div className={cn("flex-1", isSent && "flex justify-end")}>
                              <div
                                className={cn(
                                  "inline-block rounded-2xl px-4 py-2 max-w-[80%] text-sm shadow-sm",
                                  isSent
                                    ? "bg-primary text-primary-foreground rounded-br-sm"
                                    : "bg-card rounded-bl-sm border"
                                )}
                              >
                                <p className="whitespace-pre-wrap break-words">{message.content}</p>
                              </div>
                              <p
                                className={cn(
                                  "text-[11px] text-muted-foreground mt-1",
                                  isSent && "text-right"
                                )}
                              >
                                {formatTime(message.createdAt || new Date())}
                              </p>
                            </div>
                            {isSent && (
                              <div className="w-8 h-8 bg-secondary rounded-full flex items-center justify-center flex-shrink-0">
                                <User size={14} className="text-secondary-foreground" />
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>

                <div className="border-t p-4">
                  <div className="flex gap-2">
                    <Textarea
                      placeholder="Type a message..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      className="min-h-[60px] resize-none text-sm"
                      rows={2}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || sendMessageMutation.isPending}
                      className="self-end"
                    >
                      <Send size={18} />
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

