import { toDateKey } from '@/lib/due-date-utils'
import { Link, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import emailjs from '@emailjs/browser'
import { toast } from 'sonner'
import { 
  ArrowRight, 
  CheckCircle2, 
  LayoutGrid, 
  Users, 
  Package, 
  Calendar, 
  BarChart3, 
  Shield,
  Zap,
  Globe,
  ChevronDown,
  Star,
  DollarSign,
  Building2,
  ShoppingCart,
  Factory,
  Briefcase,
  Laptop,
  Heart,
  LogOut,
  Clock,
  FileText,
  Target,
  TrendingUp,
  CheckCircle,
  XCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { MotionPage } from '@/components/motion-page'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SimpleThemeToggle } from '@/components/SimpleThemeToggle'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/contexts/AuthContext'
import { completeInviteSignup } from '@/lib/tenant-context'
import { clearOrgCache, DEFAULT_POST_LOGIN_PATH } from '@/lib/auth-helpers'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type UseCaseType = 'agencies' | 'retail' | 'manufacturing' | 'professional-services' | 'saas' | 'nonprofit' | null

export default function HomePage() {
  const { user, profile, organization, signInWithMicrosoft, signInWithEmail, signOut, loading } = useAuth()
  const navigate = useNavigate()
  const [selectedUseCase, setSelectedUseCase] = useState<UseCaseType>(null)
  const [isDemoDialogOpen, setIsDemoDialogOpen] = useState(false)
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [demoFormData, setDemoFormData] = useState({
    name: '',
    email: '',
    company: '',
    phone: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set())
  const [showEmailSignIn, setShowEmailSignIn] = useState(false)
  const [emailSignInEmail, setEmailSignInEmail] = useState('')
  const [emailSignInPassword, setEmailSignInPassword] = useState('')
  const [emailSignInError, setEmailSignInError] = useState<string | null>(null)

  // Signed-in users land on the employee portal, not the marketing page
  useEffect(() => {
    if (!loading && user) {
      navigate(DEFAULT_POST_LOGIN_PATH, { replace: true })
    }
  }, [loading, user, navigate])

  // Load booked appointments from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('katana_demo_bookings')
    if (stored) {
      try {
        const bookings = JSON.parse(stored) as string[]
        setBookedSlots(new Set(bookings))
      } catch (error) {
        console.error('Error loading booked slots:', error)
      }
    }
  }, [])

  // Helper function to create a unique key for a date+time slot
  const getSlotKey = (date: Date, time: string): string => {
    const dateStr = toDateKey(date) // YYYY-MM-DD
    return `${dateStr}_${time}`
  }

  // Check if a specific date+time slot is booked
  const isSlotBooked = (date: Date | undefined, time: string): boolean => {
    if (!date) return false
    const slotKey = getSlotKey(date, time)
    return bookedSlots.has(slotKey)
  }

  // Save a booking to localStorage
  const saveBooking = (date: Date, time: string) => {
    const slotKey = getSlotKey(date, time)
    const updated = new Set(bookedSlots)
    updated.add(slotKey)
    setBookedSlots(updated)
    localStorage.setItem('katana_demo_bookings', JSON.stringify(Array.from(updated)))
  }

  const handleSignIn = async () => {
    try {
      await signInWithMicrosoft()
    } catch (error) {
      console.error('Sign in error:', error)
      const message = error instanceof Error ? error.message : 'Something went wrong. Please try again.'
      toast.error('Sign-in failed', { description: message })
    }
  }

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setEmailSignInError(null)
    try {
      await signInWithEmail(emailSignInEmail.trim(), emailSignInPassword)
      const pendingInviteId = sessionStorage.getItem('katana_pending_invite_id')
      if (pendingInviteId) {
        try {
          clearOrgCache()
          await completeInviteSignup(pendingInviteId)
          sessionStorage.removeItem('katana_pending_invite_id')
        } catch {
          // Invite may already be completed; continue to employee portal
        }
      }
      setShowEmailSignIn(false)
      setEmailSignInEmail('')
      setEmailSignInPassword('')
      navigate(DEFAULT_POST_LOGIN_PATH)
    } catch (err: any) {
      setEmailSignInError(err?.message ?? 'Sign in failed. Check email and password.')
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      window.location.href = '/'
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const getUserInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map(n => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    }
    return user?.email?.slice(0, 2).toUpperCase() || 'U'
  }

  // Generate time slots: 9:00 AM, 10:30 AM, 12:00 PM, 1:30 PM (1.5 hour increments)
  const timeSlots = [
    { value: '09:00', label: '9:00 AM' },
    { value: '10:30', label: '10:30 AM' },
    { value: '12:00', label: '12:00 PM' },
    { value: '13:30', label: '1:30 PM' },
  ]

  // Disable past dates and weekends
  const isDateDisabled = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    // Disable past dates
    if (date < today) {
      return true
    }
    
    // Disable weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = date.getDay()
    return dayOfWeek === 0 || dayOfWeek === 6
  }

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDate || !selectedTime) {
      alert('Please select both a date and time for your demo.')
      return
    }

    if (!demoFormData.name || !demoFormData.email) {
      alert('Please fill in your name and email.')
      return
    }

    setIsSubmitting(true)

    try {
      // Format the date and time
      const dateStr = selectedDate.toLocaleDateString('en-US', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
      const timeSlot = timeSlots.find(slot => slot.value === selectedTime)
      const timeStr = timeSlot?.label || selectedTime

      // EmailJS configuration
      const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID
      const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID
      const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY

      if (!EMAILJS_SERVICE_ID || !EMAILJS_TEMPLATE_ID || !EMAILJS_PUBLIC_KEY) {
        throw new Error('EmailJS is not configured. Please set up environment variables.')
      }

      // Prepare email template parameters
      const templateParams = {
        to_email: 'dwgrowthequity@gmail.com',
        from_name: demoFormData.name,
        from_email: demoFormData.email,
        company: demoFormData.company || 'Not provided',
        phone: demoFormData.phone || 'Not provided',
        demo_date: dateStr,
        demo_time: timeStr,
        subject: 'New Demo Request - Katana',
        message: `New Demo Request Received

Name: ${demoFormData.name}
Email: ${demoFormData.email}
Company: ${demoFormData.company || 'Not provided'}
Phone: ${demoFormData.phone || 'Not provided'}

Requested Demo Time:
Date: ${dateStr}
Time: ${timeStr}

Please confirm this appointment with the customer.`,
      }

      // Check if slot is already booked (double-check before sending)
      const slotKey = getSlotKey(selectedDate, selectedTime)
      if (bookedSlots.has(slotKey)) {
        alert('This time slot has already been booked. Please select another time.')
        setIsSubmitting(false)
        return
      }

      // Send email via EmailJS
      await emailjs.send(
        EMAILJS_SERVICE_ID,
        EMAILJS_TEMPLATE_ID,
        templateParams,
        EMAILJS_PUBLIC_KEY
      )

      // Save booking to prevent double-booking
      saveBooking(selectedDate, selectedTime)

      // Show success message
      alert(`Thank you! Your demo request for ${dateStr} at ${timeStr} has been submitted. We'll send you a confirmation email shortly.`)
      
      // Reset form
      setIsDemoDialogOpen(false)
      setSelectedDate(undefined)
      setSelectedTime(null)
      setDemoFormData({ name: '', email: '', company: '', phone: '' })
    } catch (error: any) {
      console.error('Error submitting demo request:', error)
      
      // Check if it's a configuration error
      if (error?.message?.includes('EmailJS is not configured')) {
        alert('Email service is not configured. Please contact support or try again later.')
      } else {
        alert('There was an error submitting your request. Please try again or contact us directly at dwgrowthequity@gmail.com')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const examples = {
      agencies: {
        title: "For Agencies",
        description: "Keep all your client work in one place. See what needs to be done, track time spent on each project, and get client approvals faster.",
        whatItDoes: "Katana helps agencies organize client projects, see deadlines at a glance, track how much time is spent on each task, and get clients to approve work before it goes live.",
        features: [
          { icon: FileText, text: "See all your client projects in one dashboard", color: "text-primary" },
          { icon: Clock, text: "Track time spent on each project automatically", color: "text-blue-500" },
          { icon: CheckCircle, text: "Get clients to approve designs and content", color: "text-green-500" },
          { icon: Target, text: "Never miss a deadline with clear due dates", color: "text-purple-500" },
        ],
        metrics: [
          { label: "Client Projects", value: "24", description: "projects you're working on" },
          { label: "Happy Clients", value: "4.8/5", description: "average client rating" },
          { label: "On Time", value: "94%", description: "of projects delivered on schedule" },
        ],
        sampleData: [
          { project: "Website Redesign for Acme Corp", status: "Waiting for client approval", deadline: "Jan 28", progress: 85 },
          { project: "Marketing Campaign for TechStart", status: "In progress", deadline: "Feb 5", progress: 60 },
          { project: "Brand Strategy for RetailPlus", status: "Just started", deadline: "Feb 12", progress: 30 },
        ]
      },
      retail: {
        title: "For Retail & E-commerce",
        description: "Launch new products smoothly. Keep track of what you're ordering from suppliers and make sure everything arrives on time.",
        whatItDoes: "Katana helps retail businesses plan product launches, track orders from suppliers, see what's in stock, and know when new products will be ready to sell.",
        features: [
          { icon: Package, text: "Plan when new products will launch", color: "text-blue-500" },
          { icon: ShoppingCart, text: "Track orders you place with suppliers", color: "text-orange-500" },
          { icon: TrendingUp, text: "See what's selling and what's not", color: "text-green-500" },
          { icon: BarChart3, text: "Know how much inventory you have", color: "text-purple-500" },
        ],
        metrics: [
          { label: "New Products", value: "8", description: "launching this month" },
          { label: "Supplier Orders", value: "156", description: "orders placed this quarter" },
          { label: "In Stock", value: "92%", description: "of products available now" },
        ],
        sampleData: [
          { project: "Spring Collection Launch", status: "Almost ready", deadline: "Feb 1", progress: 95 },
          { project: "Order from Textiles Inc", status: "On the way", deadline: "Jan 30", progress: 70 },
          { project: "Holiday Campaign Planning", status: "Just started", deadline: "Mar 15", progress: 25 },
        ]
      },
      manufacturing: {
        title: "For Manufacturing",
        description: "Know what you're making, when it's due, and if you have enough materials. Keep production running smoothly.",
        whatItDoes: "Katana helps manufacturers see what needs to be built, track materials and supplies, know if machines are running properly, and make sure orders ship on time.",
        features: [
          { icon: Factory, text: "See what you need to make and when", color: "text-orange-500" },
          { icon: Package, text: "Track materials and supplies in real-time", color: "text-blue-500" },
          { icon: BarChart3, text: "Know if your machines are working well", color: "text-green-500" },
          { icon: Target, text: "Make sure everything meets quality standards", color: "text-purple-500" },
        ],
        metrics: [
          { label: "Orders to Build", value: "42", description: "work orders in progress" },
          { label: "Efficiency", value: "87%", description: "how well machines are running" },
          { label: "On Time", value: "96%", description: "of orders shipped when promised" },
        ],
        sampleData: [
          { project: "Building 500 Parts - Order #1234", status: "Making it now", deadline: "Jan 27", progress: 75 },
          { project: "Quality Check - Order #1235", status: "In progress", deadline: "Jan 29", progress: 50 },
          { project: "Ordering Materials - Order #1236", status: "Waiting to start", deadline: "Feb 2", progress: 20 },
        ]
      },
      'professional-services': {
        title: "For Professional Services",
        description: "Manage client work, track billable hours, and keep clients updated. Everything you need to run a consulting or service business.",
        whatItDoes: "Katana helps service businesses organize client projects, track time spent so you can bill accurately, assign work to your team, and share documents with clients securely.",
        features: [
          { icon: Briefcase, text: "Organize all your client work in one place", color: "text-purple-500" },
          { icon: Clock, text: "Track time so billing is accurate", color: "text-blue-500" },
          { icon: Users, text: "Assign work to the right team members", color: "text-green-500" },
          { icon: FileText, text: "Share documents with clients safely", color: "text-orange-500" },
        ],
        metrics: [
          { label: "Active Clients", value: "18", description: "clients you're working with" },
          { label: "Billable Time", value: "82%", description: "of time spent on client work" },
          { label: "Happy Clients", value: "94%", description: "clients who stay with you" },
        ],
        sampleData: [
          { project: "Consulting Project - GlobalCorp", status: "Active", deadline: "Mar 1", progress: 65 },
          { project: "IT Review - FinanceHub", status: "In progress", deadline: "Feb 15", progress: 45 },
          { project: "Compliance Check - HealthPlus", status: "Just started", deadline: "Feb 28", progress: 15 },
        ]
      },
      saas: {
        title: "For SaaS Companies",
        description: "Plan new features, help customers when they need support, and make sure they renew. Keep your software business growing.",
        whatItDoes: "Katana helps software companies plan what features to build next, manage customer support requests, track which customers might leave, and make sure renewals happen on time.",
        features: [
          { icon: Target, text: "Plan what features to build and when", color: "text-green-500" },
          { icon: Users, text: "Help customers quickly when they ask", color: "text-blue-500" },
          { icon: TrendingUp, text: "Know which customers might cancel", color: "text-purple-500" },
          { icon: BarChart3, text: "See how customers are using your product", color: "text-orange-500" },
        ],
        metrics: [
          { label: "New Features", value: "34", description: "being built right now" },
          { label: "Support Requests", value: "128", description: "customers needing help" },
          { label: "Renewals", value: "92%", description: "customers who stay with you" },
        ],
        sampleData: [
          { project: "New Analytics Feature", status: "Being built", deadline: "Feb 10", progress: 70 },
          { project: "Onboarding New Big Client", status: "In progress", deadline: "Jan 31", progress: 55 },
          { project: "Renewal Campaign for Q2", status: "Just started", deadline: "Mar 20", progress: 20 },
        ]
      },
      nonprofit: {
        title: "For Nonprofits",
        description: "Organize programs, schedule volunteers, and show donors the impact you're making. Run your nonprofit more effectively.",
        whatItDoes: "Katana helps nonprofits plan events and programs, schedule volunteers, track grant money and donations, and show the results of your work to supporters.",
        features: [
          { icon: Heart, text: "Plan programs and events", color: "text-pink-500" },
          { icon: Users, text: "Schedule volunteers and see who's helping", color: "text-blue-500" },
          { icon: FileText, text: "Track grants and donations", color: "text-green-500" },
          { icon: BarChart3, text: "Show the impact you're making", color: "text-purple-500" },
        ],
        metrics: [
          { label: "Active Programs", value: "12", description: "programs running now" },
          { label: "Volunteer Hours", value: "2,450", description: "hours donated this month" },
          { label: "Funding", value: "$1.2M", description: "grants and donations received" },
        ],
        sampleData: [
          { project: "Community Outreach Program", status: "Running now", deadline: "Ongoing", progress: 80 },
          { project: "Volunteer Training Session", status: "Scheduled", deadline: "Feb 5", progress: 60 },
          { project: "Annual Fundraising Campaign", status: "Just started", deadline: "Apr 1", progress: 30 },
        ]
      },
    }

  const renderExampleContent = () => {
    if (!selectedUseCase) return null

    const example = examples[selectedUseCase]
    if (!example) return null

    return (
      <div className="space-y-6">
        <div>
          <p className="text-base text-foreground mb-4 leading-relaxed">{example.description}</p>
          
          <div className="bg-muted/50 p-4 rounded-lg mb-6">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong className="text-foreground">What it does:</strong> {example.whatItDoes}
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {example.metrics.map((metric, idx) => (
              <div key={idx} className="p-4 border rounded-lg bg-card">
                <div className="text-sm text-muted-foreground mb-1">{metric.label}</div>
                <div className="text-2xl font-bold mb-1">{metric.value}</div>
                <div className="text-xs text-muted-foreground">{metric.description}</div>
              </div>
            ))}
          </div>

          <div className="mb-6">
            <h4 className="font-semibold mb-3 text-base">What you can do:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {example.features.map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <div key={idx} className="flex items-start gap-3 p-3 border rounded-lg bg-card">
                    <Icon className={`h-5 w-5 mt-0.5 flex-shrink-0 ${feature.color}`} />
                    <span className="text-sm leading-relaxed">{feature.text}</span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold mb-3 text-base">Example projects:</h4>
            {example.sampleData.map((item, idx) => (
              <div key={idx} className="p-3 border rounded-lg bg-card">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{item.project}</span>
                  <Badge variant={item.status.includes("progress") || item.status.includes("Active") || item.status.includes("Running") || item.status.includes("ready") ? "default" : "secondary"}>
                    {item.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
                  <span>Due: {item.deadline}</span>
                  <span>{item.progress}% complete</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${item.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // Company logos for social proof
  const companies = [
    { name: "TechCorp", icon: Laptop },
    { name: "BuildRight", icon: Factory },
    { name: "RetailPro", icon: ShoppingCart },
    { name: "HealthCare+", icon: Heart },
    { name: "FinanceHub", icon: DollarSign },
    { name: "LogisTech", icon: Package },
    { name: "ConsultPro", icon: Briefcase },
    { name: "DataStream", icon: BarChart3 },
    { name: "CloudBase", icon: Globe },
    { name: "TeamSync", icon: Users },
    { name: "ProjectFlow", icon: LayoutGrid },
    { name: "TimeTrack", icon: Calendar },
  ]

  // Double the array for seamless infinite scroll
  const allCompanies = [...companies, ...companies]

  return (
    <MotionPage subtle className="min-h-screen bg-background">
      {/* Top Navigation Strip */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background backdrop-blur supports-[backdrop-filter]:bg-background/95 isolate">
        <motion.div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex min-h-14 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2">
            <div className="flex min-w-0 shrink-0 items-center gap-2">
              <motion.div className="font-bold text-xl">Katana Technologies</motion.div>
              <span className="text-sm text-muted-foreground hidden lg:inline whitespace-nowrap">
                — Unified BusinessOps Platform
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 sm:gap-x-4 lg:gap-6 ml-auto">
              <motion.div className="hidden md:flex items-center gap-4 lg:gap-6">
                <a href="#features" className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap">Features</a>
                <a href="#usecases" className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap">Use Cases</a>
                <a href="#integrations" className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap hidden lg:inline">Integrations</a>
                <a href="#pricing" className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap">Pricing</a>
                <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors whitespace-nowrap">FAQ</a>
              </motion.div>
              <Button
                size="sm"
                className="shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                onClick={() => setIsDemoDialogOpen(true)}
              >
                Request a Demo
              </Button>
            <SimpleThemeToggle />
            
            {/* Auth Section */}
            {loading ? (
              <div className="h-9 w-9 shrink-0 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            ) : user && profile ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-9 w-9 shrink-0 rounded-full">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={profile.avatar_url || undefined} alt={profile.full_name || ''} />
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-64 bg-background/95 backdrop-blur-md border-border" align="end" forceMount>
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                      <p className="text-sm font-medium leading-none">{profile.full_name || 'User'}</p>
                      <p className="text-xs leading-none text-muted-foreground break-all">{profile.email}</p>
                      {organization && (
                        <p className="text-xs leading-none text-muted-foreground mt-1 break-all">
                          {organization.name}
                        </p>
                      )}
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to={DEFAULT_POST_LOGIN_PATH} className="cursor-pointer w-full">
                      <LayoutGrid className="mr-2 h-4 w-4" />
                      <span>Go to Employee Portal</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Sign out</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <motion.div
                className="flex shrink-0 flex-wrap items-center justify-end gap-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
              >
                <Button
                  size="sm"
                  onClick={handleSignIn}
                  className="flex shrink-0 items-center gap-2"
                >
                  <svg className="h-4 w-4 shrink-0" viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                    <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                    <rect x="11" y="1" width="9" height="9" fill="#00a4ef"/>
                    <rect x="1" y="11" width="9" height="9" fill="#ffb900"/>
                    <rect x="11" y="11" width="9" height="9" fill="#7fba00"/>
                  </svg>
                  <span className="whitespace-nowrap">Sign in with Microsoft</span>
                </Button>
              </motion.div>
            )}
            </div>
          </div>

          {!loading && !user && (
            <div className="flex flex-wrap items-center justify-end gap-3 border-t border-border/50 py-2">
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowEmailSignIn(true)}>
                Sign in with email
              </Button>
              <Link to="/accept-invite" className="inline-flex">
                <Button size="sm" variant="link" className="h-8 px-2 text-muted-foreground">
                  Have an invite?
                </Button>
              </Link>
            </div>
          )}
        </motion.div>
      </nav>

      {/* Hero Section */}
      <section className="pt-20 pb-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Left side - Hero content */}
            <div>
              <h1 className="text-5xl md:text-6xl font-bold text-foreground mb-6 leading-tight">
                One intelligent hub for your whole business
              </h1>
              <p className="text-xl text-muted-foreground mb-8 leading-relaxed">
                Projects, tasks, customers, inventory, HR, and analytics—finally connected. 
                Automate handoffs and remove busywork so teams stay focused.
              </p>
              
              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-4 mb-8">
                <Button 
                  size="lg" 
                  className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                  onClick={() => setIsDemoDialogOpen(true)}
                >
                  Request a Demo <ArrowRight className="h-4 w-4" />
                </Button>
                <Link to="/hub">
                  <Button size="lg" variant="outline" className="gap-2">
                    Launch the Hub <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <a href="#features">
                  <Button size="lg" variant="ghost" className="gap-2">
                    Explore Features <ChevronDown className="h-4 w-4" />
                  </Button>
                </a>
              </div>

              {/* Feature Highlights */}
              <div className="flex flex-wrap gap-4">
                <Badge variant="secondary" className="gap-2 py-2 px-4">
                  <Shield className="h-4 w-4" /> SOC2-ready
                </Badge>
                <Badge variant="secondary" className="gap-2 py-2 px-4">
                  <Zap className="h-4 w-4" /> 99.9% uptime
                </Badge>
                <Badge variant="secondary" className="gap-2 py-2 px-4">
                  <Globe className="h-4 w-4" /> Integrations
                </Badge>
              </div>
            </div>

            {/* Right side - Product preview */}
            <div className="relative">
              <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-2">
                <CardContent className="p-8">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-background p-4 rounded-lg border flex items-center gap-3">
                      <LayoutGrid className="h-8 w-8 text-primary" />
                      <div>
                        <div className="font-semibold">Projects</div>
                        <div className="text-xs text-muted-foreground">24 active</div>
                      </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border flex items-center gap-3">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                      <div>
                        <div className="font-semibold">Tasks</div>
                        <div className="text-xs text-muted-foreground">156 tracked</div>
                      </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border flex items-center gap-3">
                      <Users className="h-8 w-8 text-blue-500" />
                      <div>
                        <div className="font-semibold">Customers</div>
                        <div className="text-xs text-muted-foreground">89 clients</div>
                      </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border flex items-center gap-3">
                      <Package className="h-8 w-8 text-orange-500" />
                      <div>
                        <div className="font-semibold">Inventory</div>
                        <div className="text-xs text-muted-foreground">2.4K items</div>
                      </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border flex items-center gap-3">
                      <Calendar className="h-8 w-8 text-purple-500" />
                      <div>
                        <div className="font-semibold">HR</div>
                        <div className="text-xs text-muted-foreground">45 employees</div>
                      </div>
                    </div>
                    <div className="bg-background p-4 rounded-lg border flex items-center gap-3">
                      <BarChart3 className="h-8 w-8 text-pink-500" />
                      <div>
                        <div className="font-semibold">Analytics</div>
                        <div className="text-xs text-muted-foreground">Real-time</div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof Section */}
      <section className="py-16 px-6 bg-muted/30 overflow-hidden">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm font-medium text-muted-foreground mb-8">Trusted by teams across industries</p>
          
          {/* Infinite Scrolling Logos */}
          <div className="relative">
            <div className="flex gap-8 animate-scroll">
              {allCompanies.map((company, i) => {
                const Icon = company.icon
                return (
                  <motion.div
                    key={i}
                    className="h-20 min-w-[180px] bg-background border rounded-lg flex items-center justify-center gap-3 px-6 opacity-70 transition-all cursor-pointer shadow-sm"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 0.7, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    whileHover={{ 
                      scale: 1.1, 
                      opacity: 1,
                      rotate: [0, -5, 5, 0],
                      transition: { duration: 0.3 }
                    }}
                  >
                    <Icon className="h-6 w-6 text-primary" />
                    <span className="font-semibold text-foreground">{company.name}</span>
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
        
        <style>{`
          @keyframes scroll {
            0% {
              transform: translateX(0);
            }
            100% {
              transform: translateX(calc(-180px * 12 - 32px * 12));
            }
          }
          
          .animate-scroll {
            animation: scroll 40s linear infinite;
            width: fit-content;
          }
        `}</style>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Everything you need, designed to work together</h2>
            <p className="text-xl text-muted-foreground mb-6">
              Pick modules you need today. Add more anytime—no migrations, no new logins.
            </p>
            <Link to="/hub">
              <Button size="lg">Open the Hub</Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-12">
            <Card>
              <CardHeader>
                <LayoutGrid className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Projects & Tasks</CardTitle>
                <CardDescription>Plan, track, and deliver</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Kanban boards
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Gantt charts
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Analytics & reporting
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-blue-500 mb-2" />
                <CardTitle>Katana Customers</CardTitle>
                <CardDescription>Milestones, files, renewals in a portal</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Client portals
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Milestone tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Renewal management
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Package className="h-10 w-10 text-orange-500 mb-2" />
                <CardTitle>Inventory & Assets</CardTitle>
                <CardDescription>Track items, suppliers, POs</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Real-time tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Purchase orders
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Supplier management
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Calendar className="h-10 w-10 text-purple-500 mb-2" />
                <CardTitle>Workforce & Scheduling</CardTitle>
                <CardDescription>Plan schedules, capture time, routes</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Shift planning
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Time tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Route optimization
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Users className="h-10 w-10 text-green-500 mb-2" />
                <CardTitle>People & HR</CardTitle>
                <CardDescription>Recruit, review, SMART goals, anonymous hiring</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Performance reviews
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Goal tracking
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Anonymous recruitment
                  </li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <BarChart3 className="h-10 w-10 text-pink-500 mb-2" />
                <CardTitle>Dashboards & Analytics</CardTitle>
                <CardDescription>KPIs across work, customers, and inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Real-time dashboards
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> Custom reports
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" /> KPI tracking
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Use Cases Section */}
      <section id="usecases" className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Built to fit the way you work</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <Briefcase className="h-10 w-10 text-primary mb-2" />
                <CardTitle>Agencies</CardTitle>
                <CardDescription>Plan deliverables, share proofs, track time</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedUseCase('agencies')}
                >
                  See example
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <ShoppingCart className="h-10 w-10 text-blue-500 mb-2" />
                <CardTitle>Retail & eCom</CardTitle>
                <CardDescription>Coordinate launches, manage supplier POs</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedUseCase('retail')}
                >
                  See example
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Factory className="h-10 w-10 text-orange-500 mb-2" />
                <CardTitle>Manufacturing</CardTitle>
                <CardDescription>Plan production, control inventory</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedUseCase('manufacturing')}
                >
                  See example
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Briefcase className="h-10 w-10 text-purple-500 mb-2" />
                <CardTitle>Professional Services</CardTitle>
                <CardDescription>Manage engagements and client access</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedUseCase('professional-services')}
                >
                  See example
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Laptop className="h-10 w-10 text-green-500 mb-2" />
                <CardTitle>SaaS</CardTitle>
                <CardDescription>Run roadmaps, support queues, renewals</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedUseCase('saas')}
                >
                  See example
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Heart className="h-10 w-10 text-pink-500 mb-2" />
                <CardTitle>Nonprofit</CardTitle>
                <CardDescription>Coordinate programs, volunteers, reporting</CardDescription>
              </CardHeader>
              <CardContent>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setSelectedUseCase('nonprofit')}
                >
                  See example
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>

        <Dialog open={selectedUseCase !== null} onOpenChange={(open) => !open && setSelectedUseCase(null)}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>
                {selectedUseCase && examples[selectedUseCase] ? examples[selectedUseCase].title : 'Example'}
              </DialogTitle>
              <DialogDescription>
                {selectedUseCase && examples[selectedUseCase] ? examples[selectedUseCase].description : ''}
              </DialogDescription>
            </DialogHeader>
            {renderExampleContent()}
          </DialogContent>
        </Dialog>

        {/* Demo Booking Dialog */}
        <Dialog open={isDemoDialogOpen} onOpenChange={setIsDemoDialogOpen}>
          <DialogContent size="xl">
            <DialogHeader>
              <DialogTitle>Schedule Your Demo</DialogTitle>
              <DialogDescription>
                Choose a date and time that works for you. We'll send you a confirmation email.
              </DialogDescription>
            </DialogHeader>
            
            <form onSubmit={handleDemoSubmit} className="space-y-6">
              {/* Calendar Section */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">Select a Date</Label>
                <div className="flex justify-center p-6 bg-muted/30 rounded-lg border">
                  <style>{`
                    .demo-calendar-wrapper .rdp {
                      --rdp-cell-size: 48px;
                      --rdp-accent-color: hsl(var(--primary));
                      --rdp-background-color: hsl(var(--accent));
                      font-size: 16px;
                    }
                    .demo-calendar-wrapper .rdp-day {
                      height: 48px;
                      width: 48px;
                      margin: 2px;
                    }
                    .demo-calendar-wrapper .rdp-button {
                      height: 48px;
                      width: 48px;
                      font-size: 16px;
                    }
                    .demo-calendar-wrapper .rdp-weekday {
                      height: 40px;
                      width: 48px;
                      font-size: 14px;
                      font-weight: 500;
                      margin: 2px;
                    }
                    .demo-calendar-wrapper .rdp-week {
                      margin: 4px 0;
                    }
                    .demo-calendar-wrapper .rdp-month {
                      padding: 12px;
                    }
                    .demo-calendar-wrapper .rdp-caption {
                      margin-bottom: 16px;
                      font-size: 18px;
                      font-weight: 600;
                    }
                    .demo-calendar-wrapper .rdp-nav {
                      gap: 8px;
                    }
                    .demo-calendar-wrapper .rdp-button_previous,
                    .demo-calendar-wrapper .rdp-button_next {
                      height: 36px;
                      width: 36px;
                    }
                  `}</style>
                  <div className="demo-calendar-wrapper">
                    <CalendarComponent
                      mode="single"
                      selected={selectedDate}
                      onSelect={(date) => {
                        setSelectedDate(date)
                        // Clear selected time if it's booked for the new date
                        if (date && selectedTime && isSlotBooked(date, selectedTime)) {
                          setSelectedTime(null)
                        }
                      }}
                      disabled={isDateDisabled}
                      className="rounded-md border-0 bg-transparent"
                    />
                  </div>
                </div>
              </div>

              {/* Time Slots Section */}
              {selectedDate && (
                <div className="space-y-4">
                  <Label className="text-base font-semibold">Select a Time</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {timeSlots.map((slot) => {
                      const isBooked = isSlotBooked(selectedDate, slot.value)
                      return (
                        <Button
                          key={slot.value}
                          type="button"
                          variant={selectedTime === slot.value ? "default" : "outline"}
                          className={
                            selectedTime === slot.value 
                              ? "bg-primary text-primary-foreground" 
                              : isBooked 
                                ? "opacity-50 cursor-not-allowed" 
                                : ""
                          }
                          disabled={isBooked}
                          onClick={() => !isBooked && setSelectedTime(slot.value)}
                          title={isBooked ? "This time slot is already booked" : ""}
                        >
                          {slot.label}
                          {isBooked && <span className="ml-2 text-xs">(Booked)</span>}
                        </Button>
                      )
                    })}
                  </div>
                  {selectedDate && timeSlots.every(slot => isSlotBooked(selectedDate, slot.value)) && (
                    <p className="text-sm text-muted-foreground text-center">
                      All time slots for this date are booked. Please select another date.
                    </p>
                  )}
                </div>
              )}

              {/* Contact Information */}
              <div className="space-y-4 border-t pt-6">
                <Label className="text-base font-semibold">Your Information</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="demo-name">Name *</Label>
                    <Input
                      id="demo-name"
                      type="text"
                      placeholder="John Doe"
                      value={demoFormData.name}
                      onChange={(e) => setDemoFormData({ ...demoFormData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-email">Email *</Label>
                    <Input
                      id="demo-email"
                      type="email"
                      placeholder="john@company.com"
                      value={demoFormData.email}
                      onChange={(e) => setDemoFormData({ ...demoFormData, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-company">Company</Label>
                    <Input
                      id="demo-company"
                      type="text"
                      placeholder="Acme Corp"
                      value={demoFormData.company}
                      onChange={(e) => setDemoFormData({ ...demoFormData, company: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="demo-phone">Phone</Label>
                    <Input
                      id="demo-phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={demoFormData.phone}
                      onChange={(e) => setDemoFormData({ ...demoFormData, phone: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsDemoDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={!selectedDate || !selectedTime || !demoFormData.name || !demoFormData.email || isSubmitting}
                  className="bg-primary hover:bg-primary/90"
                >
                  {isSubmitting ? 'Submitting...' : 'Schedule Demo'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Sign in with email (Katana account, no Microsoft) */}
        <Dialog open={showEmailSignIn} onOpenChange={setShowEmailSignIn}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Sign in with email</DialogTitle>
              <DialogDescription>Use the email and password for your Katana account.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleEmailSignIn} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="email-signin-email">Email</Label>
                <Input
                  id="email-signin-email"
                  type="email"
                  placeholder="you@company.com"
                  value={emailSignInEmail}
                  onChange={(e) => setEmailSignInEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email-signin-password">Password</Label>
                <Input
                  id="email-signin-password"
                  type="password"
                  value={emailSignInPassword}
                  onChange={(e) => setEmailSignInPassword(e.target.value)}
                  required
                />
              </div>
              {emailSignInError && (
                <p className="text-sm text-destructive">{emailSignInError}</p>
              )}
              <Button type="submit" className="w-full">Sign in</Button>
            </form>
            <p className="text-xs text-muted-foreground pt-2">
              No account yet? Ask your admin for an invite link to create one.
            </p>
          </DialogContent>
        </Dialog>
      </section>

      {/* Integrations Section */}
      <section id="integrations" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Built to fit how you work</h2>
            <p className="text-xl text-muted-foreground">
              Sign in with Microsoft, support your team over email, and expand with banking and calendar
              connections when you enable those modules
            </p>
          </div>

          <Card className="max-w-3xl mx-auto">
            <CardContent className="p-8">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                <div className="text-center">
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Globe className="h-8 w-8" />
                  </div>
                  <div className="text-sm font-medium">Microsoft sign-in</div>
                </div>
                <div className="text-center">
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Zap className="h-8 w-8" />
                  </div>
                  <div className="text-sm font-medium">Email support</div>
                </div>
                <div className="text-center">
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                    <DollarSign className="h-8 w-8" />
                  </div>
                  <div className="text-sm font-medium">Bank linking (Plaid)</div>
                </div>
                <div className="text-center">
                  <div className="h-16 w-16 bg-muted rounded-lg flex items-center justify-center mx-auto mb-2">
                    <Globe className="h-8 w-8" />
                  </div>
                  <div className="text-sm font-medium">CRM calendar sync</div>
                </div>
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                QuickBooks, Xero, Slack, and Teams connectors are on the roadmap — not required for pilots.
              </p>

              <div className="flex gap-4 justify-center mt-8">
                <Link to="/hub">
                  <Button>Open Hub</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Teams get more done with Katana</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg font-semibold mb-2">"We replaced four tools."</p>
                <p className="text-muted-foreground text-sm">
                  Katana consolidated our project management, inventory, and HR systems into one platform. 
                  Setup was smooth and our team adapted quickly.
                </p>
                <div className="mt-4 text-sm text-muted-foreground">— Sarah M., Operations Director</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg font-semibold mb-2">"Setup was quick."</p>
                <p className="text-muted-foreground text-sm">
                  We were up and running in less than a day. The interface is intuitive and 
                  our team didn't need extensive training.
                </p>
                <div className="mt-4 text-sm text-muted-foreground">— James L., IT Manager</div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-lg font-semibold mb-2">"Reporting is instant."</p>
                <p className="text-muted-foreground text-sm">
                  Real-time dashboards give us visibility across all departments. 
                  No more waiting for weekly reports or manual data compilation.
                </p>
                <div className="mt-4 text-sm text-muted-foreground">— Maria G., CEO</div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Simple, modular pricing</h2>
            <p className="text-xl text-muted-foreground">Choose the modules you need. Scale as you grow.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-6 w-6 text-primary" />
                  <CardTitle>Starter</CardTitle>
                </div>
                <CardDescription>Perfect for small teams</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$29</span>
                  <span className="text-muted-foreground">/user/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Up to 10 users</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">2 modules included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Email support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Basic integrations</span>
                  </li>
                </ul>
                <Button className="w-full">Start Free Trial</Button>
              </CardContent>
            </Card>

            <Card className="border-primary border-2 relative">
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">Most Popular</Badge>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <LayoutGrid className="h-6 w-6 text-primary" />
                  <CardTitle>Growth</CardTitle>
                </div>
                <CardDescription>For growing businesses</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">$49</span>
                  <span className="text-muted-foreground">/user/month</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Up to 50 users</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">All modules included</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Priority support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Advanced integrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Custom dashboards</span>
                  </li>
                </ul>
                <Button className="w-full">Start Free Trial</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Building2 className="h-6 w-6 text-primary" />
                  <CardTitle>Enterprise</CardTitle>
                </div>
                <CardDescription>For large organizations</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold">Custom</span>
                </div>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 mb-6">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Unlimited users</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">All modules + custom</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">Dedicated support</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">SSO & advanced security</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                    <span className="text-sm">On-premise option</span>
                  </li>
                </ul>
                <Button className="w-full" variant="outline">Contact Sales</Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 px-6 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>

          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger>How long does setup take?</AccordionTrigger>
              <AccordionContent>
                Most teams are up and running within 24 hours. Our guided onboarding process walks you 
                through configuring your modules, importing data, and inviting team members. For enterprise 
                deployments, our customer success team provides hands-on support.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-2">
              <AccordionTrigger>Can I integrate with existing tools?</AccordionTrigger>
              <AccordionContent>
                Katana supports Microsoft sign-in out of the box, email-based support replies for your
                pilot team, optional bank linking via Plaid when Finance is enabled, and CRM calendar
                sync when configured. Additional connectors (including QuickBooks, Xero, Slack, and Teams)
                are on the roadmap — during a pilot we focus on the modules you enable.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-3">
              <AccordionTrigger>What's your pricing model?</AccordionTrigger>
              <AccordionContent>
                We charge per user per month. You only pay for the modules you use. Start with what you 
                need today and add more modules as you grow—no migrations required. All plans include 
                a 14-day free trial with no credit card required.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-4">
              <AccordionTrigger>Is my data secure?</AccordionTrigger>
              <AccordionContent>
                Absolutely. We're SOC2 compliant and use bank-level encryption for data in transit and 
                at rest. Our infrastructure is hosted on AWS with 99.9% uptime SLA. Enterprise plans 
                include SSO, advanced access controls, and optional on-premise deployment.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-5">
              <AccordionTrigger>Can I try before I buy?</AccordionTrigger>
              <AccordionContent>
                Yes! All plans come with a 14-day free trial. No credit card required. You'll have full 
                access to all features during the trial period. Our team is available to help you get 
                the most out of your trial.
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="item-6">
              <AccordionTrigger>What kind of support do you offer?</AccordionTrigger>
              <AccordionContent>
                Starter plans include email support with 24-hour response time. Growth plans get priority 
                support with 4-hour response time. Enterprise customers get a dedicated account manager 
                and phone support. All plans include access to our comprehensive documentation and video 
                tutorials.
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </section>

      {/* Request Demo Section */}
      <section id="request-demo" className="py-20 px-6 bg-primary/5">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl font-bold mb-4">See Katana in action</h2>
          <p className="text-xl text-muted-foreground mb-8">
            Get a personalized demo and see how Katana can transform your business operations. 
            Our team will show you exactly how it works for your industry.
          </p>
          <div className="flex flex-wrap gap-4 justify-center mb-6">
            <Button 
              size="lg" 
              className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => setIsDemoDialogOpen(true)}
            >
              Request a Demo <ArrowRight className="h-4 w-4" />
            </Button>
            <Link to="/hub">
              <Button size="lg" variant="outline" className="gap-2">
                Launch the Hub <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          <p className="text-sm text-muted-foreground">
            Or start a free 14-day trial — no credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 px-6 bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="font-bold text-lg mb-4">Katana Technologies</div>
              <p className="text-sm text-muted-foreground">
                Unified BusinessOps Platform for modern teams
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground">Pricing</a></li>
                <li><a href="#integrations" className="hover:text-foreground">Integrations</a></li>
                <li><Link to="/hub" className="hover:text-foreground">Launch Hub</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Resources</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">Documentation</a></li>
                <li><a href="#" className="hover:text-foreground">API Reference</a></li>
                <li><a href="#" className="hover:text-foreground">Tutorials</a></li>
                <li><a href="#faq" className="hover:text-foreground">FAQ</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-foreground">About</a></li>
                <li><a href="#" className="hover:text-foreground">Blog</a></li>
                <li><a href="#" className="hover:text-foreground">Careers</a></li>
                <li><a href="#" className="hover:text-foreground">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t text-center text-sm text-muted-foreground">
            © 2025 Katana Technologies. All rights reserved.
          </div>
        </div>
      </footer>
    </MotionPage>
  )
}
