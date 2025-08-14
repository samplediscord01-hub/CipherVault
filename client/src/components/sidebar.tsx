import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Plus, Video, Folder, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Tag } from "@shared/schema";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  selectedTags: string[];
  onTagToggle: (tagName: string) => void;
  selectedType?: "video" | "folder";
  onTypeChange: (type: "video" | "folder" | undefined) => void;
  selectedSizeRange?: "small" | "medium" | "large";
  onSizeRangeChange: (range: "small" | "medium" | "large" | undefined) => void;
}

const getTagColor = (color: string | null) => {
  const colors = {
    primary: "bg-primary/20 text-primary border-primary/30",
    secondary: "bg-secondary/20 text-secondary border-secondary/30",
    emerald: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
    rose: "bg-rose-500/20 text-rose-500 border-rose-500/30",
    orange: "bg-orange-500/20 text-orange-500 border-orange-500/30",
    red: "bg-red-500/20 text-red-500 border-red-500/30",
    purple: "bg-purple-500/20 text-purple-500 border-purple-500/30",
    blue: "bg-blue-500/20 text-blue-500 border-blue-500/30",
    cyan: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
    gray: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  };
  return colors[color as keyof typeof colors] || colors.primary;
};

export function Sidebar({
  isOpen,
  onClose,
  selectedTags,
  onTagToggle,
  selectedType,
  onTypeChange,
  selectedSizeRange,
  onSizeRangeChange,
}: SidebarProps) {
  const [newTagName, setNewTagName] = useState("");
  const [isAddingTag, setIsAddingTag] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tags = [] } = useQuery<Tag[]>({
    queryKey: ["/api/tags"],
  });

  const createTagMutation = useMutation({
    mutationFn: async (tagData: { name: string; color: string }) => {
      const response = await apiRequest("POST", "/api/tags", tagData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      setNewTagName("");
      setIsAddingTag(false);
      toast({
        title: "Tag Created",
        description: "Successfully created new tag.",
      });
    },
    onError: (error) => {
      toast({
        title: "Create Failed",
        description: error instanceof Error ? error.message : "Failed to create tag",
        variant: "destructive",
      });
    },
  });

  const deleteTagMutation = useMutation({
    mutationFn: async (tagId: string) => {
      await apiRequest("DELETE", `/api/tags/${tagId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
      toast({
        title: "Tag Deleted",
        description: "Successfully deleted tag.",
      });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete tag",
        variant: "destructive",
      });
    },
  });

  const handleCreateTag = () => {
    if (newTagName.trim()) {
      createTagMutation.mutate({
        name: newTagName.trim(),
        color: "primary",
      });
    }
  };

  const handleDeleteTag = (tagId: string, tagName: string) => {
    if (confirm(`Are you sure you want to delete the tag "${tagName}"?`)) {
      deleteTagMutation.mutate(tagId);
    }
  };

  const handleTypeChange = (value: string) => {
    if (value === "all") {
      onTypeChange(undefined);
    } else {
      onTypeChange(value as "video" | "folder");
    }
  };

  const handleSizeChange = (value: string) => {
    if (value === "any") {
      onSizeRangeChange(undefined);
    } else {
      onSizeRangeChange(value as "small" | "medium" | "large");
    }
  };

  return (
    <>
      <aside
        className={`fixed left-0 top-16 h-full w-80 bg-surface border-r border-slate-700 z-30 transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Filters & Tags</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Categories Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300">Categories</h3>
            </div>
            <RadioGroup
              value={selectedType || "all"}
              onValueChange={handleTypeChange}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3 hover:bg-slate-700 rounded-lg p-2 transition-colors">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="flex items-center space-x-2 cursor-pointer">
                  <span className="text-sm">All Items</span>
                  <span className="text-xs text-slate-400">(All)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 hover:bg-slate-700 rounded-lg p-2 transition-colors">
                <RadioGroupItem value="video" id="video" />
                <Label htmlFor="video" className="flex items-center space-x-2 cursor-pointer">
                  <Video className="text-primary w-4 h-4" />
                  <span className="text-sm">Videos</span>
                  <span className="text-xs text-slate-400">(Videos)</span>
                </Label>
              </div>
              <div className="flex items-center space-x-3 hover:bg-slate-700 rounded-lg p-2 transition-colors">
                <RadioGroupItem value="folder" id="folder" />
                <Label htmlFor="folder" className="flex items-center space-x-2 cursor-pointer">
                  <Folder className="text-amber-500 w-4 h-4" />
                  <span className="text-sm">Folders</span>
                  <span className="text-xs text-slate-400">(Folders)</span>
                </Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Tags Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-slate-300">Tags</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddingTag(!isAddingTag)}
                className="text-xs text-primary hover:text-primary/80"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add
              </Button>
            </div>
            
            {/* Add new tag */}
            {isAddingTag && (
              <div className="mb-3 space-y-2">
                <Input
                  type="text"
                  placeholder="Tag name..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  className="bg-slate-800 border-slate-600"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreateTag();
                    if (e.key === "Escape") setIsAddingTag(false);
                  }}
                />
                <div className="flex space-x-2">
                  <Button
                    size="sm"
                    onClick={handleCreateTag}
                    disabled={!newTagName.trim() || createTagMutation.isPending}
                  >
                    Add
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsAddingTag(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
            
            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map((tag) => (
                <div key={tag.id} className="group relative">
                  <Badge
                    variant="outline"
                    className={`cursor-pointer transition-all ${getTagColor(tag.color)} ${
                      selectedTags.includes(tag.name)
                        ? "ring-2 ring-primary/50 scale-105"
                        : "hover:scale-105"
                    }`}
                    onClick={() => onTagToggle(tag.name)}
                  >
                    {tag.name}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteTag(tag.id, tag.name);
                    }}
                    className="absolute -top-1 -right-1 w-4 h-4 p-0 opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 hover:bg-red-700 rounded-full"
                  >
                    <X className="h-2 w-2" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
          
          {/* File Size Filter */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-slate-300 mb-3">File Size</h3>
            <RadioGroup
              value={selectedSizeRange || "any"}
              onValueChange={handleSizeChange}
              className="space-y-2"
            >
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="any" id="any-size" />
                <Label htmlFor="any-size" className="text-sm cursor-pointer">Any Size</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="small" id="small" />
                <Label htmlFor="small" className="text-sm cursor-pointer">{"< 100MB"}</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="medium" id="medium" />
                <Label htmlFor="medium" className="text-sm cursor-pointer">100MB - 1GB</Label>
              </div>
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="large" id="large" />
                <Label htmlFor="large" className="text-sm cursor-pointer">{"> 1GB"}</Label>
              </div>
            </RadioGroup>
          </div>
        </div>
      </aside>
    </>
  );
}
