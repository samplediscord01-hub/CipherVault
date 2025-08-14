import { type User, type InsertUser, type MediaItem, type InsertMediaItem, type MediaItemWithTags, type Tag, type InsertTag, type MediaItemTag, type InsertMediaItemTag, type ApiOption, type InsertApiOption, type MediaSearchParams } from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Media Items
  getMediaItems(params: MediaSearchParams): Promise<{ items: MediaItemWithTags[], total: number }>;
  getMediaItem(id: string): Promise<MediaItemWithTags | undefined>;
  getMediaItemByUrl(url: string): Promise<MediaItem | undefined>;
  createMediaItem(item: InsertMediaItem): Promise<MediaItem>;
  updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem | undefined>;
  deleteMediaItem(id: string): Promise<boolean>;

  // Tags
  getTags(): Promise<Tag[]>;
  getTag(id: string): Promise<Tag | undefined>;
  getTagByName(name: string): Promise<Tag | undefined>;
  createTag(tag: InsertTag): Promise<Tag>;
  updateTag(id: string, updates: Partial<Tag>): Promise<Tag | undefined>;
  deleteTag(id: string): Promise<boolean>;

  // Media Item Tags
  addTagToMediaItem(mediaItemId: string, tagId: string): Promise<MediaItemTag>;
  removeTagFromMediaItem(mediaItemId: string, tagId: string): Promise<boolean>;
  getTagsForMediaItem(mediaItemId: string): Promise<Tag[]>;

  // API Options
  getApiOptions(): Promise<ApiOption[]>;
  getApiOption(id: string): Promise<ApiOption | undefined>;
  createApiOption(option: InsertApiOption): Promise<ApiOption>;
  updateApiOption(id: string, updates: Partial<ApiOption>): Promise<ApiOption | undefined>;
  deleteApiOption(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private mediaItems: Map<string, MediaItem>;
  private tags: Map<string, Tag>;
  private mediaItemTags: Map<string, MediaItemTag>;
  private apiOptions: Map<string, ApiOption>;

  constructor() {
    this.users = new Map();
    this.mediaItems = new Map();
    this.tags = new Map();
    this.mediaItemTags = new Map();
    this.apiOptions = new Map();

    // Initialize with default API options based on multiScraper
    this.initializeDefaultApiOptions();
    this.initializeDefaultTags();
    this.initializeSampleData();
  }

  private initializeDefaultApiOptions() {
    const defaultApis = [
      { name: "Iteraplay", url: "http://localhost:3000/iteraplay-proxy", method: "POST" as const, type: "json" as const, field: "link", status: "available" as const, isActive: true },
      { name: "Raspywave", url: "http://localhost:3000/raspywave-proxy", method: "POST" as const, type: "json" as const, field: "link", status: "available" as const, isActive: true },
      { name: "RapidAPI", url: "http://localhost:3000/rapidapi", method: "POST" as const, type: "json" as const, field: "link", status: "available" as const, isActive: true },
      { name: "Tera-CC", url: "http://localhost:3000/tera-downloader-cc", method: "POST" as const, type: "json" as const, field: "url", status: "limited" as const, isActive: true },
      { name: "Ronnie Client", url: "http://localhost:3000/ronnieverse-client", method: "GET" as const, type: "query" as const, field: "url", status: "available" as const, isActive: true },
      { name: "API Option 6", url: "http://localhost:3000/api-6", method: "POST" as const, type: "json" as const, field: "url", status: "offline" as const, isActive: false },
      { name: "API Option 7", url: "http://localhost:3000/api-7", method: "POST" as const, type: "json" as const, field: "url", status: "available" as const, isActive: true },
      { name: "API Option 8", url: "http://localhost:3000/api-8", method: "POST" as const, type: "json" as const, field: "url", status: "available" as const, isActive: true },
    ];

    defaultApis.forEach(api => {
      const id = randomUUID();
      this.apiOptions.set(id, { ...api, id });
    });
  }

  private initializeDefaultTags() {
    const defaultTags = [
      { name: "Movies", color: "primary" as const },
      { name: "TV Shows", color: "secondary" as const },
      { name: "Animation", color: "emerald" as const },
      { name: "Documentary", color: "rose" as const },
      { name: "Comedy", color: "orange" as const },
      { name: "Action", color: "red" as const },
      { name: "Thriller", color: "purple" as const },
      { name: "Drama", color: "blue" as const },
      { name: "Sci-Fi", color: "cyan" as const },
      { name: "Horror", color: "gray" as const },
    ];

    defaultTags.forEach(tag => {
      const id = randomUUID();
      this.tags.set(id, { ...tag, id, createdAt: new Date() });
    });
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Media Items
  async getMediaItems(params: MediaSearchParams): Promise<{ items: MediaItemWithTags[], total: number }> {
    const { search, tags: tagFilter, type, sizeRange, page = 1, limit = 20 } = params;
    
    let filteredItems = Array.from(this.mediaItems.values());

    // Apply filters
    if (search) {
      const searchLower = search.toLowerCase();
      filteredItems = filteredItems.filter(item => 
        item.title.toLowerCase().includes(searchLower) ||
        item.description?.toLowerCase().includes(searchLower)
      );
    }

    if (type) {
      filteredItems = filteredItems.filter(item => item.type === type);
    }

    if (sizeRange && filteredItems.length > 0) {
      filteredItems = filteredItems.filter(item => {
        if (!item.size) return true;
        const sizeGB = item.size / (1024 * 1024 * 1024);
        switch (sizeRange) {
          case "small": return sizeGB < 0.1;
          case "medium": return sizeGB >= 0.1 && sizeGB <= 1;
          case "large": return sizeGB > 1;
          default: return true;
        }
      });
    }

    // Add tags to items
    const itemsWithTags = await Promise.all(
      filteredItems.map(async (item) => ({
        ...item,
        tags: await this.getTagsForMediaItem(item.id),
      }))
    );

    // Filter by tags if specified
    let finalItems = itemsWithTags;
    if (tagFilter && tagFilter.length > 0) {
      finalItems = itemsWithTags.filter(item =>
        tagFilter.some(tagName => 
          item.tags.some(tag => tag.name.toLowerCase() === tagName.toLowerCase())
        )
      );
    }

    // Sort by creation date (newest first)
    finalItems.sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

    const total = finalItems.length;
    const startIndex = (page - 1) * limit;
    const paginatedItems = finalItems.slice(startIndex, startIndex + limit);

    return { items: paginatedItems, total };
  }

  async getMediaItem(id: string): Promise<MediaItemWithTags | undefined> {
    const item = this.mediaItems.get(id);
    if (!item) return undefined;

    const tags = await this.getTagsForMediaItem(id);
    return { ...item, tags };
  }

  async getMediaItemByUrl(url: string): Promise<MediaItem | undefined> {
    return Array.from(this.mediaItems.values()).find(item => item.url === url);
  }

  async createMediaItem(insertItem: InsertMediaItem): Promise<MediaItem> {
    const id = randomUUID();
    const item: MediaItem = { 
      ...insertItem,
      type: insertItem.type || "video",
      error: insertItem.error || null,
      description: insertItem.description || null,
      thumbnail: insertItem.thumbnail || null,
      duration: insertItem.duration || null,
      size: insertItem.size || null,
      downloadUrl: insertItem.downloadUrl || null,
      downloadExpiresAt: insertItem.downloadExpiresAt || null,
      downloadFetchedAt: insertItem.downloadFetchedAt || null,
      folderVideoCount: insertItem.folderVideoCount || 0,
      folderImageCount: insertItem.folderImageCount || 0,
      id, 
      createdAt: new Date(),
      scrapedAt: new Date()
    };
    this.mediaItems.set(id, item);
    return item;
  }

  async updateMediaItem(id: string, updates: Partial<MediaItem>): Promise<MediaItem | undefined> {
    const item = this.mediaItems.get(id);
    if (!item) return undefined;

    const updatedItem = { ...item, ...updates };
    this.mediaItems.set(id, updatedItem);
    return updatedItem;
  }

  async deleteMediaItem(id: string): Promise<boolean> {
    // Remove associated tags
    const tagAssociations = Array.from(this.mediaItemTags.values())
      .filter(mt => mt.mediaItemId === id);
    
    tagAssociations.forEach(mt => {
      this.mediaItemTags.delete(mt.id);
    });

    return this.mediaItems.delete(id);
  }

  // Tags
  async getTags(): Promise<Tag[]> {
    return Array.from(this.tags.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getTag(id: string): Promise<Tag | undefined> {
    return this.tags.get(id);
  }

  async getTagByName(name: string): Promise<Tag | undefined> {
    return Array.from(this.tags.values()).find(tag => tag.name.toLowerCase() === name.toLowerCase());
  }

  async createTag(insertTag: InsertTag): Promise<Tag> {
    const id = randomUUID();
    const tag: Tag = { 
      ...insertTag, 
      color: insertTag.color || "primary",
      id, 
      createdAt: new Date() 
    };
    this.tags.set(id, tag);
    return tag;
  }

  async updateTag(id: string, updates: Partial<Tag>): Promise<Tag | undefined> {
    const tag = this.tags.get(id);
    if (!tag) return undefined;

    const updatedTag = { ...tag, ...updates };
    this.tags.set(id, updatedTag);
    return updatedTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    // Remove associations
    const associations = Array.from(this.mediaItemTags.values())
      .filter(mt => mt.tagId === id);
    
    associations.forEach(mt => {
      this.mediaItemTags.delete(mt.id);
    });

    return this.tags.delete(id);
  }

  // Media Item Tags
  async addTagToMediaItem(mediaItemId: string, tagId: string): Promise<MediaItemTag> {
    const id = randomUUID();
    const mediaItemTag: MediaItemTag = { id, mediaItemId, tagId };
    this.mediaItemTags.set(id, mediaItemTag);
    return mediaItemTag;
  }

  async removeTagFromMediaItem(mediaItemId: string, tagId: string): Promise<boolean> {
    const association = Array.from(this.mediaItemTags.values())
      .find(mt => mt.mediaItemId === mediaItemId && mt.tagId === tagId);
    
    if (association) {
      return this.mediaItemTags.delete(association.id);
    }
    return false;
  }

  async getTagsForMediaItem(mediaItemId: string): Promise<Tag[]> {
    const associations = Array.from(this.mediaItemTags.values())
      .filter(mt => mt.mediaItemId === mediaItemId);
    
    const tags: Tag[] = [];
    for (const association of associations) {
      const tag = this.tags.get(association.tagId);
      if (tag) {
        tags.push(tag);
      }
    }
    
    return tags.sort((a, b) => a.name.localeCompare(b.name));
  }

  private async initializeSampleData() {
    // Create sample media items with realistic data
    const sampleItems = [
      {
        url: "https://terabox.com/s/1abcd",
        title: "The Matrix (1999) - 4K HDR",
        description: "A computer programmer is led to fight an underground war against powerful computers who have constructed his entire reality with a system called the Matrix.",
        thumbnail: "https://image.tmdb.org/t/p/w500/f89U3ADr1oiB1s9GkdPOEpXUk5H.jpg",
        type: "video" as const,
        duration: 8280, // 2h 18m
        size: 4500000000, // 4.5GB
        folderVideoCount: 0,
        folderImageCount: 0
      },
      {
        url: "https://terabox.com/s/2efgh",
        title: "Breaking Bad Complete Series",
        description: "Complete collection of Breaking Bad TV series with all seasons and bonus content.",
        thumbnail: "https://image.tmdb.org/t/p/w500/ggFHVNu6YYI5L9pCfOacjizRGt.jpg",
        type: "folder" as const,
        duration: null,
        size: 85000000000, // 85GB
        folderVideoCount: 62,
        folderImageCount: 15
      },
      {
        url: "https://terabox.com/s/3ijkl",
        title: "Inception (2010) - IMAX Edition",
        description: "A thief who steals corporate secrets through dream-sharing technology.",
        thumbnail: "https://image.tmdb.org/t/p/w500/9gk7adHYeDvHkCSEqAvQNLV5Uge.jpg",
        type: "video" as const,
        duration: 8880, // 2h 28m
        size: 6200000000, // 6.2GB
        folderVideoCount: 0,
        folderImageCount: 0
      },
      {
        url: "https://terabox.com/s/4mnop",
        title: "Marvel Cinematic Universe Phase 1-4",
        description: "Complete MCU collection from Iron Man to Endgame including all movies and bonus features.",
        thumbnail: "https://image.tmdb.org/t/p/w500/7WsyChQLEftFiDOVTGkv3hFpyyt.jpg",
        type: "folder" as const,
        duration: null,
        size: 250000000000, // 250GB
        folderVideoCount: 28,
        folderImageCount: 45
      },
      {
        url: "https://terabox.com/s/5qrst",
        title: "Interstellar (2014) - Director's Cut",
        description: "A team of explorers travel through a wormhole in space in an attempt to ensure humanity's survival.",
        thumbnail: "https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg",
        type: "video" as const,
        duration: 10020, // 2h 47m
        size: 5800000000, // 5.8GB
        folderVideoCount: 0,
        folderImageCount: 0
      }
    ];

    // Create media items and assign tags
    for (let i = 0; i < sampleItems.length; i++) {
      const item = await this.createMediaItem(sampleItems[i]);
      
      // Assign relevant tags
      const allTags = Array.from(this.tags.values());
      let tagsToAssign: string[] = [];
      
      if (item.title.includes("Matrix")) {
        tagsToAssign = ["Sci-Fi", "Action"];
      } else if (item.title.includes("Breaking Bad")) {
        tagsToAssign = ["TV Shows", "Drama"];
      } else if (item.title.includes("Inception")) {
        tagsToAssign = ["Sci-Fi", "Thriller"];
      } else if (item.title.includes("Marvel")) {
        tagsToAssign = ["Action", "Movies"];
      } else if (item.title.includes("Interstellar")) {
        tagsToAssign = ["Sci-Fi", "Drama"];
      }
      
      for (const tagName of tagsToAssign) {
        const tag = allTags.find(t => t.name === tagName);
        if (tag) {
          await this.addTagToMediaItem(item.id, tag.id);
        }
      }
    }
  }

  // API Options
  async getApiOptions(): Promise<ApiOption[]> {
    return Array.from(this.apiOptions.values()).sort((a, b) => a.name.localeCompare(b.name));
  }

  async getApiOption(id: string): Promise<ApiOption | undefined> {
    return this.apiOptions.get(id);
  }

  async createApiOption(insertOption: InsertApiOption): Promise<ApiOption> {
    const id = randomUUID();
    const option: ApiOption = { 
      ...insertOption, 
      type: insertOption.type || "json",
      method: insertOption.method || "POST",
      status: insertOption.status || "available",
      isActive: insertOption.isActive !== undefined ? insertOption.isActive : true,
      id 
    };
    this.apiOptions.set(id, option);
    return option;
  }

  async updateApiOption(id: string, updates: Partial<ApiOption>): Promise<ApiOption | undefined> {
    const option = this.apiOptions.get(id);
    if (!option) return undefined;

    const updatedOption = { ...option, ...updates };
    this.apiOptions.set(id, updatedOption);
    return updatedOption;
  }

  async deleteApiOption(id: string): Promise<boolean> {
    return this.apiOptions.delete(id);
  }
}

export const storage = new MemStorage();
