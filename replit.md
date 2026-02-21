# Overview

Foli is a mobile-first web application designed to support women going through IVF and fertility treatments in Australia. The app provides comprehensive tracking of treatment cycles, medications, symptoms, and appointments, alongside community features and an AI-powered assistant for emotional support and guidance.

The application serves as a supportive companion throughout the fertility journey, offering features for cycle monitoring, doctor reviews, community forums, and personalized insights powered by OpenAI's GPT-5 model.

# User Preferences

Preferred communication style: Simple, everyday language.

# Testing Credentials

For testing and e2e verification, always use these credentials:
- Email: dpundir72@gmail.com
- Password: Password@1234

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **Routing**: Wouter for lightweight client-side routing
- **UI Components**: shadcn/ui component library built on Radix UI primitives
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **State Management**: TanStack Query (React Query) for server state management
- **Mobile-First Design**: Responsive layout optimized for mobile devices with bottom navigation

## Backend Architecture
- **Runtime**: Node.js with Express.js server framework
- **Language**: TypeScript with ES modules
- **API Structure**: RESTful API endpoints organized by feature domains
- **Database ORM**: Drizzle ORM for type-safe database operations
- **CORS Configuration**: Configured to allow all origins with credentials support (methods: GET, POST, PUT, PATCH, DELETE, OPTIONS)
- **Development Server**: Vite middleware integration for hot module replacement

## Authentication System
- **Provider**: Supabase Authentication with JWT tokens
- **Token Management**: JWT access tokens passed in Authorization header (Bearer token)
- **User Management**: Comprehensive user profiles with onboarding flow
- **Authorization**: Route-level authentication middleware using `isAuthenticated` guard
- **Note**: Supabase projects on free tier may pause when inactive and require restoration via Supabase dashboard

## Data Storage Solutions
- **Primary Database**: PostgreSQL with Neon serverless driver
- **Schema Management**: Drizzle Kit for migrations and schema definition
- **Data Models**: Comprehensive fertility tracking schema including cycles, medications, symptoms, appointments, doctors, forum posts, and chat messages
- **Relationships**: Well-defined foreign key relationships between entities

## AI Integration
- **Model**: OpenAI GPT-5 for conversational AI features
- **Use Cases**: Chat assistant for fertility support, cycle insights generation
- **Context Management**: Conversation history tracking with Australian fertility context
- **Safety**: Medical disclaimer reminders and healthcare provider consultation encouragement

# External Dependencies

## Core Infrastructure
- **Database**: Neon PostgreSQL serverless database
- **Authentication**: Supabase Authentication service
- **AI Services**: OpenAI API for GPT-5 model access

## UI and Styling
- **Component Library**: Radix UI primitives for accessible components
- **Icons**: Lucide React icon library
- **Fonts**: Google Fonts (Inter, DM Sans, Architects Daughter, Fira Code, Geist Mono)
- **Styling**: Tailwind CSS with PostCSS processing

## Development Tools
- **Build Tool**: Vite with React plugin and runtime error overlay
- **Development Environment**: Replit-specific plugins for cartographer and error handling
- **Type Checking**: TypeScript compiler with strict mode enabled
- **Package Management**: npm with package-lock.json for dependency locking

## Third-Party Libraries
- **Form Handling**: React Hook Form with Hookform Resolvers
- **Validation**: Zod schema validation with Drizzle-Zod integration
- **Utilities**: clsx and class-variance-authority for conditional styling
- **Date Handling**: date-fns for date manipulation and formatting
- **Command Interface**: cmdk for command palette functionality
- **Markdown Rendering**: react-markdown for educational content display

# Features Implemented

## Feature #3: Smart Educational Content (Completed)

The Smart Educational Content feature provides contextual, phase-aware educational resources to support users throughout their fertility journey.

### Implementation Details

**Data Structure**
- Educational articles stored in JSON format at `client/public/data/educational-content.json`
- Database schema includes `educationalArticles` and `articleBookmarks` tables for future persistence
- Articles tagged with phases, cycle types, categories, and metadata (reading time, featured status)

**Content Categories**
- Medications: Detailed guides on fertility medications (Gonal-F, Ovidrel, etc.)
- Procedures: Complete guides for egg collection, embryo transfer, IUI
- Emotional Support: Coping strategies, mindfulness techniques, mental health resources
- Nutrition: Diet recommendations, supplement guidance, meal planning

**Smart Filtering**
- Phase-based recommendations: Articles surface based on user's current cycle phase
- Cycle type matching: Content filtered by treatment type (IVF fresh, frozen, IUI, etc.)
- Featured content fallback: When no active cycle, displays curated featured articles
- Search functionality: Full-text search across titles, summaries, content, and tags
- Category filtering: Browse articles by topic category

**User Interface**
- Education Hub (`/education`): Central library with search and category filters
- Article Viewer (`/education/:slug`): Full article display with markdown rendering
- Home Page Integration: Phase-relevant articles displayed on dashboard
- Mobile-optimized: Responsive design for 390px viewport and larger
- Bookmark functionality: UI ready for user favorites (persistence pending)

**Technical Components**
- `educationUtils.ts`: Utility functions for loading, filtering, and formatting articles
- `education.tsx`: Main education hub and article viewer components
- `home.tsx`: Integration showing contextual articles based on current phase
- JSON-based content: Easy to update and maintain educational material

**Content Quality**
- 5 comprehensive articles covering key fertility topics
- Markdown-formatted for rich text display
- Australian-specific context (Medicare, PBS, local resources)
- Evidence-based information with practical tips
- Reading time estimates for user planning

### Future Enhancements
- Persistent bookmark storage via API
- User-contributed articles and reviews
- Video and multimedia content support
- Personalized reading recommendations
- Article completion tracking

## Feature #4: Event Logging with Doctor Notes (Completed)

The Event Logging feature provides comprehensive tracking of appointments, observations, test results, and general notes throughout the fertility journey, with rich support for doctor visit documentation.

### Implementation Details

**Data Structure**
- Events table in PostgreSQL database with comprehensive metadata support
- Supports multiple event types: doctor visits, observations, test results, milestones, and general notes
- Rich metadata including doctor notes, outcomes, personal notes, tags, phase tracking, and importance flags
- Optional linking to cycles and milestones for contextual organization
- Full CRUD operations with user authentication and authorization

**Event Types**
- **Doctor Visits**: Track appointments with doctor names, notes, and outcomes
- **Observations**: Log personal observations and symptoms
- **Test Results**: Record test outcomes and measurements
- **Milestones**: Document key events in the fertility journey
- **General Notes**: Capture any other relevant information

**Data Captured**
- Event type, title, and date (required fields)
- Optional time and location information
- Doctor-specific fields: doctor name, doctor notes, and outcomes
- Personal notes for user observations
- Tags for flexible categorization and filtering
- Phase and cycle type for contextual tracking
- Important flag for highlighting critical events
- Automatic cycle and milestone associations

**Backend Implementation**
- RESTful API endpoints: GET /api/events, GET /api/events/:id, GET /api/cycles/:cycleId/events, POST /api/events, PATCH /api/events/:id, DELETE /api/events/:id
- All endpoints protected by authentication middleware
- Ownership verification ensures users can only access their own events
- Storage layer with CRUD operations: getUserEvents, getCycleEvents, getEventById, createEvent, updateEvent, deleteEvent

**User Interface**
- Events Page (`/events`): Dedicated page for comprehensive event logging
- Event Creation Dialog: Modal form with conditional fields based on event type
- Event View Dialog: Read-only dialog displaying complete event details with formatted fields
- Event Edit Dialog: Pre-populated form for updating existing events with full field support
- Delete Confirmation: AlertDialog requiring confirmation before removing events
- Timeline View: Chronological display of all events with rich metadata
- Action Buttons: Each event card has View (Eye icon), Edit (Edit icon), and Delete (Trash icon) buttons
- Visual Indicators: Important events highlighted with colored border
- Tag Display: Individual tag badges for easy categorization
- Mobile-Optimized: Responsive design for 390px viewport with touch-friendly controls

**Navigation Integration**
- Accessible via `/events` route
- Quick access through hamburger menu under "Tracking & Journal" section
- Available from all pages in the application

**Form Features**
- Event type selection with conditional field display
- Doctor visit fields (doctor name, doctor notes, outcomes) shown only for doctor visit events
- Test result fields (outcomes) shown for test results and doctor visits
- Cycle and phase association for contextual tracking
- Tags input with comma-separated values
- Important flag toggle for highlighting critical events
- Form validation using Zod schema
- Loading states during submission
- Success/error toast notifications

**Technical Components**
- `events.tsx`: Complete events page with form dialog and timeline view
- `events` table in database schema with comprehensive fields
- Storage interface methods for all CRUD operations
- API routes with authentication and authorization
- Integration with hamburger menu navigation

**Security & Authorization**
- All API endpoints require authentication via isAuthenticated middleware
- User-scoped queries ensure data isolation
- Ownership verification on read, update, and delete operations
- Cycle ownership verification when associating events with cycles

### UX Enhancements
- **View Event Details**: Added dedicated view dialog showing complete event information in read-only format
- **Edit Events**: Users can now modify existing events with pre-populated form
- **Delete Confirmation**: AlertDialog prevents accidental deletions by requiring confirmation
- **Action Buttons**: Replaced single delete button with View/Edit/Delete action buttons on each event card
- **Better User Feedback**: Toast notifications for all operations (create, update, delete, errors)
- **State Management**: Separate dialog states for create, edit, view, and delete operations

### Bug Fixes
- Fixed SelectItem empty string value issue to comply with Radix UI requirements
- Implemented "none" placeholder value with automatic null conversion in form submission
- Fixed delete mutation to parse JSON response properly, ensuring onSuccess callback executes

### Future Enhancements
- Pagination or infinite scroll for large event lists
- Advanced filtering by tags and importance flag
- Bulk event operations (multi-select and delete)
- Export events to PDF or CSV
- Event templates for common appointment types
- Reminder notifications for upcoming events
- Calendar view visualization
- Attachment support for lab results and documents