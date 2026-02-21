import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Bot, User } from "lucide-react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import type { ChatMessage } from "@shared/schema";

interface ChatResponse {
  message: ChatMessage;
  suggestions?: string[];
}

export default function Chat() {
  const [newMessage, setNewMessage] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages"],
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      const response = await apiRequest("POST", "/api/chat/messages", { content });
      return response.json() as Promise<ChatResponse>;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages"] });
      setSuggestions(data.suggestions || []);
      setNewMessage("");
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
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleSendMessage = (content: string = newMessage) => {
    if (!content.trim()) return;
    
    // Feature is coming soon - show message instead of sending
    toast({
      title: "Coming Soon",
      description: "The AI chat feature is currently under development. Please check back soon!",
      variant: "default",
    });
    return;
    
    // Disabled for now
    // sendMessageMutation.mutate(content);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const formatTime = (date: string | Date) => {
    return new Date(date).toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const defaultSuggestions = [
    "What should I expect at my next appointment?",
    "How can I manage side effects?",
    "What foods help during stimulation?",
    "When should I call my clinic?"
  ];

  const currentSuggestions = suggestions.length > 0 ? suggestions : defaultSuggestions;

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <div className="flex items-center justify-between p-6 pt-6 bg-card border-b border-border">
        <div className="flex items-center space-x-3">
          <Link href="/">
            <Button 
              variant="ghost" 
              size="icon"
              className="w-10 h-10 rounded-full bg-background shadow-sm"
              data-testid="button-back"
            >
              <ArrowLeft className="text-foreground" size={20} />
            </Button>
          </Link>
          <div>
            <h1 className="font-semibold" data-testid="title-assistant">Foli Assistant</h1>
            <p className="text-xs text-muted-foreground" data-testid="subtitle-assistant">AI-powered support</p>
          </div>
        </div>
        <div className="w-2 h-2 bg-muted-foreground rounded-full" data-testid="status-online"></div>
      </div>
      
      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6 pb-32">
        {/* Coming Soon Message - Centered */}
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="max-w-sm w-full">
            <div className="flex justify-center mb-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <Bot className="text-primary" size={32} />
              </div>
            </div>
            <Card className="rounded-2xl p-6 shadow-sm bg-muted/50 border-2 border-dashed border-muted-foreground/30">
              <div className="text-center">
                <p className="text-xl font-semibold text-foreground mb-3" data-testid="coming-soon-title">
                  Coming Soon
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed" data-testid="coming-soon-message">
                  The AI chat feature is currently under development. We're working hard to bring you an intelligent assistant to support your IVF journey. Check back soon!
                </p>
              </div>
            </Card>
          </div>
        </div>
        
        <div ref={messagesEndRef} />
      </div>
      
      {/* Quick Suggestions - Disabled for Coming Soon */}
      {false && !sendMessageMutation.isPending && (
        <div className="px-6 mb-6">
          <p className="text-sm font-medium text-foreground mb-3" data-testid="suggestions-title">Quick questions:</p>
          <div className="space-y-2">
            {currentSuggestions.slice(0, 3).map((suggestion, index) => (
              <Button
                key={index}
                variant="outline"
                onClick={() => handleSendMessage(suggestion)}
                className="w-full bg-card border border-border rounded-xl p-3 text-left text-sm text-card-foreground h-auto justify-start"
                data-testid={`suggestion-${index}`}
              >
                {suggestion}
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {/* Message Input */}
      <div className="fixed bottom-20 left-0 right-0 max-w-sm mx-auto p-6 bg-background border-t border-border">
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Coming Soon - AI chat feature"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={true}
              className="w-full bg-muted/50 border border-border rounded-2xl pl-4 pr-12 py-4 text-muted-foreground text-sm cursor-not-allowed"
              data-testid="input-message"
            />
            <Button
              onClick={() => handleSendMessage()}
              disabled={true}
              size="icon"
              className="absolute right-3 top-1/2 transform -translate-y-1/2 w-8 h-8 bg-muted rounded-full cursor-not-allowed"
              data-testid="button-send"
            >
              <Send className="text-muted-foreground" size={16} />
            </Button>
          </div>
        </div>
      </div>

      {/* Non-dismissible Disclaimer */}
      <div className="fixed bottom-0 left-0 right-0 max-w-sm mx-auto bg-amber-50 border-t-2 border-amber-400 px-4 py-3 z-50">
        <p className="text-xs text-amber-900 text-center font-medium" data-testid="chat-disclaimer">
          ⚠️ This is not medical advice. Always consult your doctor.
        </p>
      </div>
    </div>
  );
}
