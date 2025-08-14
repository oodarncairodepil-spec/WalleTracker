# WalleTracker 💰

A modern, full-stack expense tracker built with Next.js, TypeScript, Supabase, and Shadcn UI. Track your income and expenses with a beautiful, responsive interface and secure cloud synchronization.

## ✨ Features

- **🔐 Authentication**: Secure user authentication with Supabase
- **💾 Cloud Sync**: Real-time data synchronization across devices
- **📱 Responsive Design**: Beautiful UI that works on desktop and mobile
- **🎨 Modern UI**: Built with Shadcn UI components and Tailwind CSS
- **📊 Transaction Management**: Add, edit, delete, and categorize transactions
- **🔍 Filtering**: Filter transactions by category, type, and date
- **💰 Balance Tracking**: Real-time balance calculation
- **🔄 Data Migration**: Seamless migration from local storage to cloud
- **⚡ Fast Performance**: Built with Next.js 15 and TypeScript

## 🚀 Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **UI Components**: Shadcn UI
- **Backend**: Supabase (PostgreSQL, Authentication, Real-time)
- **Deployment**: Vercel (recommended)

## 🛠️ Setup Instructions

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier available)

### 1. Clone the Repository

```bash
git clone https://github.com/oodarncairodepil-spec/WalleTracker.git
cd WalleTracker
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to Settings > API to get your project URL and anon key
3. Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

4. Update `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Set Up Database Schema

1. In your Supabase dashboard, go to the SQL Editor
2. Copy and paste the contents of `supabase-schema.sql`
3. Run the SQL to create the necessary tables and policies

### 5. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## 📁 Project Structure

```
src/
├── app/                    # Next.js app directory
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout with providers
│   └── page.tsx           # Main page component
├── components/            # React components
│   ├── ui/               # Shadcn UI components
│   ├── auth-form.tsx     # Authentication form
│   ├── expense-tracker.tsx # Main expense tracker
│   └── migration-dialog.tsx # Data migration dialog
├── contexts/             # React contexts
│   └── auth-context.tsx  # Authentication context
└── lib/                  # Utility libraries
    ├── supabase.ts       # Supabase client configuration
    ├── supabase-service.ts # Database service functions
    ├── data-migration.ts # Local storage migration
    └── utils.ts          # Utility functions
```

## 🔧 Configuration Files

- `supabase-schema.sql` - Database schema for Supabase
- `components.json` - Shadcn UI configuration
- `tailwind.config.js` - Tailwind CSS configuration
- `.env.local.example` - Environment variables template

## 🚀 Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to [Vercel](https://vercel.com)
3. Add your environment variables in the Vercel dashboard
4. Deploy!

### Environment Variables for Production

Make sure to set these in your deployment platform:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## 📱 Usage

1. **Sign Up/Sign In**: Create an account or sign in with existing credentials
2. **Add Transactions**: Click the "+" button to add income or expenses
3. **Categorize**: Choose from predefined categories or add custom ones
4. **Filter & Search**: Use filters to find specific transactions
5. **Data Migration**: If you have local data, the app will offer to migrate it to your account

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Next.js](https://nextjs.org) for the amazing React framework
- [Supabase](https://supabase.com) for the backend infrastructure
- [Shadcn UI](https://ui.shadcn.com) for the beautiful UI components
- [Tailwind CSS](https://tailwindcss.com) for the utility-first CSS framework

---

**Happy expense tracking! 💰✨**
