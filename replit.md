# Overview

This is a full-stack media management application built with React and Express.js. The app allows users to scrape, store, and manage video content from various sources using multiple API proxies. It features a modern dark-themed UI with search, filtering, and tagging capabilities for organizing media items.

The application integrates with external video scraping services to fetch metadata, thumbnails, and download links for videos and folders. Users can browse their media collection through both grid and list views, with comprehensive filtering options including tags, media type, and size ranges.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript, built using Vite for fast development and optimized builds
- **UI Library**: Radix UI components with Tailwind CSS for styling, following the shadcn/ui design system
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Styling**: Tailwind CSS with CSS variables for theming, dark mode support via next-themes

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **Database**: PostgreSQL with Drizzle ORM for type-safe database operations
- **API Design**: RESTful API with structured error handling and request logging middleware
- **Development**: Hot module replacement in development, ESBuild for production bundling

## Data Storage Solutions
- **Primary Database**: PostgreSQL hosted on Neon, configured via environment variables
- **ORM**: Drizzle ORM with Zod validation for schema definitions and type safety
- **Schema**: Normalized database design with separate tables for users, media items, tags, and relationships
- **Migrations**: Drizzle Kit for database schema migrations and management

## Authentication and Authorization
- **Session Management**: Express sessions with PostgreSQL session store (connect-pg-simple)
- **User Management**: Basic user authentication with hashed passwords
- **Security**: CORS configuration and secure session handling

## External Service Integrations
- **Multi-Scraper System**: Integration with multiple video scraping APIs as fallback services
- **API Proxies**: Configurable proxy services for different video platforms (iteraplay, raspywave, rapidapi, etc.)
- **Media Processing**: Automatic metadata extraction including titles, descriptions, thumbnails, duration, and file sizes
- **Download Management**: Tracking of download URLs with expiration timestamps

The application follows a modern full-stack architecture with clear separation of concerns, type safety throughout the stack, and scalable patterns for handling media content from multiple sources.