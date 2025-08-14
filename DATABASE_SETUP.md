# CipherBoxX Database Setup Guide

## Current Setup
CipherBoxX is currently using **in-memory storage** for development. This means:
- ✅ All features work immediately without database setup
- ✅ Sample data loads automatically
- ⚠️ Data is lost when the server restarts
- ⚠️ Not suitable for production use

## Database Files Provided
You have provided these database-related files:
- `attached_assets/cipherbox_1755142212078.db` - SQLite database file
- `attached_assets/init_db_1755142212079.js` - Database initialization script
- `attached_assets/multiScraper_1755142212079.js` - MultiScraper integration code

## Moving to PostgreSQL Database
To use a persistent PostgreSQL database:

### 1. Create Database
```bash
# The following environment variables will be available after database creation:
# DATABASE_URL, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGHOST
```

### 2. Update Storage Configuration
Replace the `MemStorage` class in `server/storage.ts` with a proper PostgreSQL implementation using Drizzle ORM.

### 3. Database Schema
The application needs these tables:
- `media_items` - Store video/folder metadata
- `tags` - Tag definitions with colors
- `media_item_tags` - Many-to-many relationship
- `api_options` - API endpoint configurations

### 4. Migration Process
1. Run database migrations using Drizzle Kit
2. Import existing data from your SQLite file
3. Configure multiScraper integration

## API Configuration
Currently, all API endpoints are set to placeholder URLs. To enable viewing and downloading:

### Required API Endpoints
1. **Iteraplay Proxy** - Your actual proxy URL
2. **Raspywave Proxy** - Your actual proxy URL  
3. **RapidAPI** - Your actual proxy URL
4. **Tera-CC** - Your actual proxy URL
5. **Ronnie Client** - Your actual proxy URL
6. **API Options 6-8** - Additional API endpoints

### Configuration Steps
1. Click the Settings (⚙️) button in the header
2. Update each API with your actual URLs
3. Test the APIs to ensure they're working
4. Enable/disable APIs based on availability

## MultiScraper Integration
The refresh button currently calls the multiScraper system to update metadata. Your provided multiScraper code needs integration for:
- Fresh metadata extraction
- Thumbnail updates
- File size detection
- Duration parsing

## Next Steps
1. **Immediate**: Configure your actual API URLs in the settings
2. **Short-term**: Set up PostgreSQL database for persistence
3. **Integration**: Implement your multiScraper code for metadata refresh
4. **Production**: Deploy with proper database and API configurations

Would you like me to help with any of these steps?