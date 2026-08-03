import { useState, useEffect } from 'react'
import { MotionPage } from '@/components/motion-page'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { 
  Briefcase, 
  MapPin, 
  DollarSign, 
  Clock,
  Search,
  Users,
  TrendingUp,
  Heart,
  Zap,
  Globe,
  Award,
  ArrowRight,
  Upload,
  CheckCircle2,
  Loader2
} from "lucide-react"
import {
  getAllJobs,
  submitJobApplication,
  uploadApplicationResume,
  type Job,
} from "@/lib/recruitment-db"
import { parseResumeFile } from "@/lib/resume-parser"
import { enrichAnonymousProfileFromParsed } from "@/lib/anonymized-resume-pdf"

export default function CareersPage() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [locationFilter, setLocationFilter] = useState("all")
  const [departmentFilter, setDepartmentFilter] = useState("all")
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const [isApplicationOpen, setIsApplicationOpen] = useState(false)
  const [applicationSubmitted, setApplicationSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Application form state
  const [application, setApplication] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    location: "",
    resume: null as File | null,
    coverLetter: "",
    linkedin: "",
    portfolio: "",
  })

  // Fallback mock data if database is empty
  const mockJobs: Job[] = [
    {
      id: "1",
      title: "Senior Frontend Engineer",
      department: "Engineering",
      location: "San Francisco, CA",
      type: "full-time",
      level: "senior",
      salary: "$140,000 - $180,000",
      postedDate: "2025-01-10",
      description: "We're looking for a talented Senior Frontend Engineer to join our growing team and help build the next generation of our platform.",
      responsibilities: [
        "Design and implement user-facing features using React and TypeScript",
        "Collaborate with designers and backend engineers to create seamless experiences",
        "Mentor junior developers and contribute to technical decisions",
        "Optimize application performance and ensure accessibility standards",
        "Participate in code reviews and maintain high code quality"
      ],
      qualifications: [
        "5+ years of professional frontend development experience",
        "Expert knowledge of React, TypeScript, and modern web technologies",
        "Strong understanding of web performance optimization",
        "Experience with design systems and component libraries",
        "Excellent communication and collaboration skills"
      ],
      benefits: [
        "Competitive salary and equity package",
        "Health, dental, and vision insurance",
        "Flexible work arrangements and remote options",
        "Professional development budget",
        "Unlimited PTO"
      ]
    },
    {
      id: "2",
      title: "Product Designer",
      department: "Design",
      location: "New York, NY",
      type: "full-time",
      level: "mid",
      salary: "$110,000 - $140,000",
      postedDate: "2025-01-08",
      description: "Join our design team to create beautiful, intuitive user experiences that delight our customers.",
      responsibilities: [
        "Design end-to-end product experiences from concept to launch",
        "Create wireframes, prototypes, and high-fidelity designs",
        "Collaborate with product managers and engineers",
        "Conduct user research and usability testing",
        "Contribute to our design system"
      ],
      qualifications: [
        "3+ years of product design experience",
        "Strong portfolio demonstrating UX/UI skills",
        "Proficiency in Figma and design tools",
        "Understanding of user-centered design principles",
        "Excellent visual design skills"
      ],
      benefits: [
        "Competitive salary and benefits",
        "Latest design tools and equipment",
        "Conference and learning budget",
        "Collaborative and creative work environment",
        "Flexible hours"
      ]
    },
    {
      id: "3",
      title: "Data Scientist",
      department: "Data",
      location: "Remote",
      type: "full-time",
      level: "senior",
      salary: "$130,000 - $170,000",
      postedDate: "2025-01-05",
      description: "Help us unlock insights from data to drive product decisions and business growth.",
      responsibilities: [
        "Develop machine learning models and algorithms",
        "Analyze complex datasets to extract actionable insights",
        "Collaborate with product and engineering teams",
        "Build data pipelines and infrastructure",
        "Present findings to stakeholders"
      ],
      qualifications: [
        "PhD or Master's in Computer Science, Statistics, or related field",
        "5+ years of experience in data science or ML",
        "Strong programming skills in Python and SQL",
        "Experience with ML frameworks (TensorFlow, PyTorch)",
        "Excellent analytical and problem-solving skills"
      ],
      benefits: [
        "Remote-first culture",
        "Top-tier compensation package",
        "Latest technology and tools",
        "Learning and development opportunities",
        "Flexible schedule"
      ]
    },
    {
      id: "4",
      title: "Marketing Manager",
      department: "Marketing",
      location: "Austin, TX",
      type: "full-time",
      level: "mid",
      salary: "$90,000 - $120,000",
      postedDate: "2025-01-03",
      description: "Lead marketing initiatives to grow our brand and customer base.",
      responsibilities: [
        "Develop and execute marketing campaigns",
        "Manage social media and content strategy",
        "Analyze campaign performance and ROI",
        "Collaborate with sales and product teams",
        "Build and manage marketing team"
      ],
      qualifications: [
        "4+ years of marketing experience",
        "Proven track record of successful campaigns",
        "Strong analytical and creative skills",
        "Experience with marketing automation tools",
        "Excellent communication skills"
      ],
      benefits: [
        "Competitive compensation",
        "Creative freedom and ownership",
        "Marketing budget and tools",
        "Career growth opportunities",
        "Great team culture"
      ]
    },
    {
      id: "5",
      title: "Software Engineering Intern",
      department: "Engineering",
      location: "San Francisco, CA",
      type: "internship",
      level: "entry",
      salary: "$30/hour",
      postedDate: "2025-01-01",
      description: "Join our team for a summer internship and work on real projects that impact millions of users.",
      responsibilities: [
        "Work on full-stack development projects",
        "Collaborate with senior engineers",
        "Participate in code reviews and team meetings",
        "Learn industry best practices",
        "Contribute to product features"
      ],
      qualifications: [
        "Currently pursuing degree in Computer Science or related field",
        "Strong programming fundamentals",
        "Knowledge of web technologies (HTML, CSS, JavaScript)",
        "Passion for learning and problem-solving",
        "Good communication skills"
      ],
      benefits: [
        "Competitive hourly rate",
        "Mentorship from experienced engineers",
        "Real-world project experience",
        "Networking opportunities",
        "Potential for full-time offer"
      ]
    },
    {
      id: "6",
      title: "Master Auto Detailer",
      department: "Detailing",
      location: "Los Angeles, CA",
      type: "full-time",
      level: "senior",
      salary: "$55,000 - $75,000",
      postedDate: "2025-01-12",
      description: "Lead our premium auto detailing services with expertise in paint correction, ceramic coatings, and luxury vehicle care.",
      responsibilities: [
        "Perform high-end paint correction and ceramic coating applications",
        "Train and mentor junior detailing staff",
        "Inspect and quality control all detailing work",
        "Manage detailing bay operations and workflow",
        "Consult with customers on premium detailing packages"
      ],
      qualifications: [
        "5+ years of professional auto detailing experience",
        "Expert knowledge of paint correction techniques and tools",
        "Experience with ceramic coatings, PPF, and premium products",
        "Strong attention to detail and quality standards",
        "Excellent customer service and communication skills"
      ],
      benefits: [
        "Competitive salary with performance bonuses",
        "Health and dental insurance",
        "Tool allowance and equipment provided",
        "Continuing education and certification support",
        "Employee vehicle detailing discounts"
      ]
    },
    {
      id: "7",
      title: "Automotive Technician",
      department: "Performance",
      location: "Los Angeles, CA",
      type: "full-time",
      level: "mid",
      salary: "$45,000 - $65,000",
      postedDate: "2025-01-11",
      description: "Join our performance shop team to work on high-performance vehicle modifications, tuning, and maintenance.",
      responsibilities: [
        "Perform engine tuning and ECU modifications",
        "Install performance parts including turbos, exhausts, and suspension",
        "Conduct diagnostic testing and troubleshooting",
        "Maintain detailed service records and documentation",
        "Collaborate with customers on performance build projects"
      ],
      qualifications: [
        "3+ years of automotive technician experience",
        "ASE certification preferred",
        "Experience with performance modifications and tuning",
        "Knowledge of diagnostic tools and equipment",
        "Strong mechanical aptitude and problem-solving skills"
      ],
      benefits: [
        "Competitive hourly wage with overtime opportunities",
        "Health insurance and retirement plan",
        "Tool purchase program and equipment training",
        "Performance bonus based on shop productivity",
        "Discounts on parts and services"
      ]
    },
    {
      id: "8",
      title: "Paint Protection Film Installer",
      department: "Detailing",
      location: "Los Angeles, CA",
      type: "full-time",
      level: "mid",
      salary: "$40,000 - $60,000",
      postedDate: "2025-01-10",
      description: "Specialize in precision paint protection film installation for luxury and exotic vehicles.",
      responsibilities: [
        "Install paint protection film with precision and quality",
        "Prepare vehicle surfaces for film application",
        "Use cutting software and plotting systems",
        "Maintain clean and organized work environment",
        "Quality control and final inspection of installations"
      ],
      qualifications: [
        "2+ years of PPF installation experience",
        "Proficiency with cutting software (DAP, etc.)",
        "Knowledge of various PPF brands and products",
        "Steady hands and excellent attention to detail",
        "Ability to work with luxury and exotic vehicles"
      ],
      benefits: [
        "Competitive salary with skill-based increases",
        "Health and dental coverage",
        "Training on latest PPF technologies",
        "Clean, climate-controlled work environment",
        "Employee discounts on services"
      ]
    },
    {
      id: "9",
      title: "Service Advisor",
      department: "Customer Service",
      location: "Los Angeles, CA",
      type: "full-time",
      level: "mid",
      salary: "$45,000 - $55,000 + Commission",
      postedDate: "2025-01-09",
      description: "Be the face of our shop, consulting with customers on detailing and performance services while managing service schedules.",
      responsibilities: [
        "Consult with customers on detailing and performance services",
        "Prepare detailed estimates and service recommendations",
        "Schedule appointments and manage service bay workflow",
        "Follow up with customers on service completion",
        "Maintain customer relationships and encourage repeat business"
      ],
      qualifications: [
        "2+ years of automotive service advisor experience",
        "Strong knowledge of detailing and performance services",
        "Excellent communication and sales skills",
        "Proficiency with shop management software",
        "Customer service oriented with professional demeanor"
      ],
      benefits: [
        "Base salary plus commission structure",
        "Health insurance and paid time off",
        "Sales training and development programs",
        "Employee discounts on all services",
        "Opportunity for advancement to management"
      ]
    },
    {
      id: "10",
      title: "Ceramic Coating Specialist",
      department: "Detailing",
      location: "Los Angeles, CA",
      type: "full-time",
      level: "senior",
      salary: "$50,000 - $70,000",
      postedDate: "2025-01-08",
      description: "Expert-level ceramic coating application for premium vehicle protection with focus on luxury and exotic cars.",
      responsibilities: [
        "Apply professional-grade ceramic coatings with precision",
        "Perform paint preparation and correction as needed",
        "Educate customers on coating maintenance and care",
        "Maintain coating application standards and quality",
        "Stay current with new coating technologies and techniques"
      ],
      qualifications: [
        "3+ years of ceramic coating application experience",
        "Certification from major coating manufacturers (Gtechniq, Modesta, etc.)",
        "Expert paint correction and preparation skills",
        "Knowledge of coating chemistry and application science",
        "Meticulous attention to detail and quality standards"
      ],
      benefits: [
        "Premium pay for specialized skills",
        "Health, dental, and vision insurance",
        "Continuing education and certification support",
        "State-of-the-art facility and equipment",
        "Employee vehicle coating services"
      ]
    },
    {
      id: "11",
      title: "Performance Tuner",
      department: "Performance",
      location: "Los Angeles, CA",
      type: "full-time",
      level: "senior",
      salary: "$60,000 - $85,000",
      postedDate: "2025-01-07",
      description: "Lead ECU tuning and engine calibration for high-performance vehicles, working with the latest tuning software and equipment.",
      responsibilities: [
        "Perform ECU tuning and engine calibration",
        "Develop custom tune files for various platforms",
        "Conduct dyno testing and performance validation",
        "Troubleshoot drivability and performance issues",
        "Research and implement new tuning strategies"
      ],
      qualifications: [
        "5+ years of professional tuning experience",
        "Proficiency with tuning software (HP Tuners, EFI Live, etc.)",
        "Strong understanding of engine management systems",
        "Experience with dyno operation and data analysis",
        "Knowledge of emissions regulations and compliance"
      ],
      benefits: [
        "Top-tier compensation for specialized expertise",
        "Comprehensive health and retirement benefits",
        "Access to latest tuning equipment and software",
        "Continuing education and certification opportunities",
        "Work with high-end performance vehicles"
      ]
    },
    {
      id: "12",
      title: "Shop Assistant",
      department: "Operations",
      location: "Los Angeles, CA",
      type: "part-time",
      level: "entry",
      salary: "$18 - $22/hour",
      postedDate: "2025-01-06",
      description: "Support our detailing and performance teams with vehicle prep, cleanup, and general shop operations.",
      responsibilities: [
        "Assist with vehicle washing and basic prep work",
        "Maintain clean and organized shop environment",
        "Move vehicles and manage shop logistics",
        "Support technicians with tools and supplies",
        "Learn detailing and performance basics through hands-on training"
      ],
      qualifications: [
        "High school diploma or equivalent",
        "Valid driver's license with clean driving record",
        "Physical ability to lift 50+ lbs and stand for extended periods",
        "Strong work ethic and willingness to learn",
        "Interest in automotive industry and vehicle care"
      ],
      benefits: [
        "Competitive hourly wage with growth potential",
        "Flexible scheduling for students",
        "On-the-job training and skill development",
        "Employee discounts on services",
        "Opportunity to advance to technician roles"
      ]
    },
    {
      id: "13",
      title: "Window Tinting Specialist",
      department: "Detailing",
      location: "Los Angeles, CA",
      type: "full-time",
      level: "mid",
      salary: "$38,000 - $55,000",
      postedDate: "2025-01-05",
      description: "Provide expert window tinting services using premium films for automotive, residential, and commercial applications.",
      responsibilities: [
        "Install automotive window tint with precision and quality",
        "Cut and shape tint film using templates and patterns",
        "Maintain tinting tools and equipment",
        "Ensure compliance with local tinting regulations",
        "Provide excellent customer service and education"
      ],
      qualifications: [
        "2+ years of professional window tinting experience",
        "Knowledge of various tint films and their properties",
        "Steady hands and excellent attention to detail",
        "Understanding of state and local tinting laws",
        "Professional appearance and customer service skills"
      ],
      benefits: [
        "Competitive salary with performance incentives",
        "Health insurance and paid vacation",
        "Training on latest tinting technologies",
        "Clean, professional work environment",
        "Employee tinting services at cost"
      ]
    }
  ]

  // Fetch jobs from database
  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    setLoading(true)
    try {
      const fetchedJobs = await getAllJobs()
      // Use fetched jobs if available, otherwise fall back to mock data
      if (fetchedJobs && fetchedJobs.length > 0) {
        setJobs(fetchedJobs)
      } else {
        console.log('No jobs in database, using mock data')
        setJobs(mockJobs)
      }
    } catch (error) {
      console.error('Error loading jobs, using mock data:', error)
      setJobs(mockJobs)
    } finally {
      setLoading(false)
    }
  }

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.department.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         job.description.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLocation = locationFilter === "all" || job.location.includes(locationFilter)
    const matchesDepartment = departmentFilter === "all" || job.department === departmentFilter
    return matchesSearch && matchesLocation && matchesDepartment
  })

  const handleApply = (job: Job) => {
    setSelectedJob(job)
    setIsApplicationOpen(true)
  }

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedJob) return
    
    setSubmitting(true)
    
    try {
      let resumeProfile = undefined
      if (application.resume) {
        const parsed = await parseResumeFile(application.resume)
        if (!parsed.unsupported && parsed.rawText) {
          resumeProfile = enrichAnonymousProfileFromParsed(parsed)
        }
      }

      // submitJobApplication seals identity, redacts cover letter, and stores blind placeholders.
      const result = await submitJobApplication({
        jobId: selectedJob.id,
        firstName: application.firstName,
        lastName: application.lastName,
        email: application.email,
        phone: application.phone,
        location: application.location,
        resumeFileName: application.resume?.name,
        coverLetter: application.coverLetter,
        linkedin: application.linkedin,
        portfolio: application.portfolio,
        resumeProfile,
      })
      
      if (result.ok) {
        if (application.resume) {
          await uploadApplicationResume(result.applicationId, application.resume)
        }

        console.log("Application submitted successfully")
        setApplicationSubmitted(true)
        
        setTimeout(() => {
          setIsApplicationOpen(false)
          setApplicationSubmitted(false)
          setApplication({
            firstName: "",
            lastName: "",
            email: "",
            phone: "",
            location: "",
            resume: null,
            coverLetter: "",
            linkedin: "",
            portfolio: "",
          })
          setSelectedJob(null)
        }, 2500)
      } else {
        alert('Failed to submit application. Please try again.')
      }
    } catch (error) {
      console.error('Error submitting application:', error)
      alert('Failed to submit application. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const companyValues = [
    { icon: Users, title: "Collaborative", description: "We work together to achieve great things" },
    { icon: TrendingUp, title: "Growth-Oriented", description: "Continuous learning and development" },
    { icon: Heart, title: "People-First", description: "Your wellbeing is our priority" },
    { icon: Zap, title: "Innovative", description: "Pushing boundaries and embracing change" },
  ]

  return (
    <MotionPage subtle className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary/10 via-background to-background border-b">
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="text-center max-w-3xl mx-auto">
            <Badge className="mb-4" variant="outline">
              <Briefcase className="w-3 h-3 mr-1" />
              We're Hiring!
            </Badge>
            <h1 className="text-5xl font-bold mb-6 text-foreground">
              Build the Future With Us
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              Join our team of talented individuals working on cutting-edge technology. 
              We're looking for passionate people who want to make an impact.
            </p>
            <div className="flex items-center justify-center gap-4 text-muted-foreground">
              <span className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                Remote-Friendly
              </span>
              <span>•</span>
              <span className="flex items-center gap-2">
                <Award className="w-5 h-5" />
                Great Benefits
              </span>
              <span>•</span>
              <span className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Career Growth
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Company Values */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-center mb-12">Why Join Us?</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {companyValues.map((value) => (
              <Card key={value.title} className="text-center hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{value.title}</CardTitle>
                  <CardDescription>{value.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>

        {/* Job Listings Section */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-2">Open Positions</h2>
          <p className="text-muted-foreground mb-8">
            Explore opportunities across our teams. Found the right fit? Apply now!
          </p>

          {/* Search and Filters */}
          <Card className="mb-8">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search jobs by title, keyword..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Locations" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    <SelectItem value="San Francisco">San Francisco, CA</SelectItem>
                    <SelectItem value="New York">New York, NY</SelectItem>
                    <SelectItem value="Austin">Austin, TX</SelectItem>
                    <SelectItem value="Remote">Remote</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Departments" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    <SelectItem value="Engineering">Engineering</SelectItem>
                    <SelectItem value="Design">Design</SelectItem>
                    <SelectItem value="Data">Data</SelectItem>
                    <SelectItem value="Marketing">Marketing</SelectItem>
                    <SelectItem value="Detailing">Detailing</SelectItem>
                    <SelectItem value="Performance">Performance</SelectItem>
                    <SelectItem value="Customer Service">Customer Service</SelectItem>
                    <SelectItem value="Operations">Operations</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Results Count */}
          <div className="mb-4 text-muted-foreground">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading positions...
              </div>
            ) : (
              `Showing ${filteredJobs.length} ${filteredJobs.length === 1 ? 'position' : 'positions'}`
            )}
          </div>

          {/* Job Cards */}
          <div className="space-y-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : filteredJobs.length === 0 ? (
              <Card className="p-12 text-center">
                <Briefcase className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-xl font-semibold mb-2">No positions found</h3>
                <p className="text-muted-foreground">
                  Try adjusting your search filters to find more opportunities.
                </p>
              </Card>
            ) : (
              filteredJobs.map((job) => (
              <Card key={job.id} className="hover:shadow-lg transition-all">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CardTitle className="text-2xl">{job.title}</CardTitle>
                        <Badge variant="outline" className={
                          job.level === "entry" ? "border-green-500 text-green-600 bg-green-500/10" :
                          job.level === "mid" ? "border-blue-500 text-blue-600 bg-blue-500/10" :
                          job.level === "senior" ? "border-purple-500 text-purple-600 bg-purple-500/10" :
                          "border-orange-500 text-orange-600 bg-orange-500/10"
                        }>
                          {job.level}
                        </Badge>
                        <Badge variant="outline">{job.type}</Badge>
                      </div>
                      <CardDescription className="text-base">{job.department}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  <p className="text-muted-foreground">{job.description}</p>

                  <div className="flex flex-wrap gap-6 text-sm text-muted-foreground">
                    <span className="flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      {job.location}
                    </span>
                    <span className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4" />
                      {job.salary}
                    </span>
                    <span className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Posted {job.postedDate}
                    </span>
                  </div>

                  <div className="grid md:grid-cols-3 gap-4">
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Key Responsibilities</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {job.responsibilities.slice(0, 3).map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Qualifications</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {job.qualifications.slice(0, 3).map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm mb-2">Benefits</h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {job.benefits.slice(0, 3).map((item, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-primary mt-1">•</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4 border-t">
                    <Button className="flex-1" onClick={() => handleApply(job)}>
                      Apply Now
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline">View Full Details</Button>
                      </DialogTrigger>
                      <DialogContent size="md">
                        <DialogHeader>
                          <DialogTitle className="text-2xl">{job.title}</DialogTitle>
                          <DialogDescription>
                            {job.department} • {job.location} • {job.type}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-6">
                          <div>
                            <h4 className="font-semibold mb-2">About the Role</h4>
                            <p className="text-muted-foreground">{job.description}</p>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Responsibilities</h4>
                            <ul className="space-y-2 text-muted-foreground">
                              {job.responsibilities.map((item, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Qualifications</h4>
                            <ul className="space-y-2 text-muted-foreground">
                              {job.qualifications.map((item, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <div>
                            <h4 className="font-semibold mb-2">Benefits & Perks</h4>
                            <ul className="space-y-2 text-muted-foreground">
                              {job.benefits.map((item, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <CheckCircle2 className="w-4 h-4 text-purple-500 mt-0.5 flex-shrink-0" />
                                  <span>{item}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          <Button className="w-full" onClick={() => {
                            handleApply(job)
                          }}>
                            Apply for this Position
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Application Dialog */}
      <Dialog open={isApplicationOpen} onOpenChange={setIsApplicationOpen}>
        <DialogContent size="md">
          {!applicationSubmitted ? (
            <>
              <DialogHeader>
                <DialogTitle>Apply for {selectedJob?.title}</DialogTitle>
                <DialogDescription>
                  Fill out the form below to submit your application. We'll review it and get back to you soon!
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitApplication} className="space-y-6">
                {/* Personal Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Personal Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        required
                        value={application.firstName}
                        onChange={(e) => setApplication({...application, firstName: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        required
                        value={application.lastName}
                        onChange={(e) => setApplication({...application, lastName: e.target.value})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address *</Label>
                    <Input
                      id="email"
                      type="email"
                      required
                      value={application.email}
                      onChange={(e) => setApplication({...application, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">Phone Number *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      required
                      value={application.phone}
                      onChange={(e) => setApplication({...application, phone: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Current Location *</Label>
                    <Input
                      id="location"
                      required
                      placeholder="City, State/Country"
                      value={application.location}
                      onChange={(e) => setApplication({...application, location: e.target.value})}
                    />
                  </div>
                </div>

                {/* Professional Information */}
                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold text-sm">Professional Information</h3>
                  <div className="space-y-2">
                    <Label htmlFor="resume">Resume/CV *</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id="resume"
                        type="file"
                        accept=".pdf,.doc,.docx"
                        required
                        onChange={(e) => setApplication({...application, resume: e.target.files?.[0] || null})}
                      />
                      <Upload className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <p className="text-xs text-muted-foreground">PDF, DOC, or DOCX (max 5MB)</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="coverLetter">Cover Letter *</Label>
                    <Textarea
                      id="coverLetter"
                      required
                      rows={6}
                      placeholder="Tell us why you're a great fit for this role..."
                      value={application.coverLetter}
                      onChange={(e) => setApplication({...application, coverLetter: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="linkedin">LinkedIn Profile</Label>
                    <Input
                      id="linkedin"
                      type="url"
                      placeholder="https://linkedin.com/in/yourprofile"
                      value={application.linkedin}
                      onChange={(e) => setApplication({...application, linkedin: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="portfolio">Portfolio/Website</Label>
                    <Input
                      id="portfolio"
                      type="url"
                      placeholder="https://yourportfolio.com"
                      value={application.portfolio}
                      onChange={(e) => setApplication({...application, portfolio: e.target.value})}
                    />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsApplicationOpen(false)} 
                    className="flex-1"
                    disabled={submitting}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" className="flex-1" disabled={submitting}>
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      'Submit Application'
                    )}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="py-8 text-center">
              <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-2xl font-bold mb-2">Application Submitted!</h3>
              <p className="text-muted-foreground mb-4">
                Thank you for applying. We've received your application and will review it shortly.
              </p>
              <p className="text-sm text-muted-foreground">
                You'll hear from us within 1-2 weeks if your profile matches our requirements.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MotionPage>
  )
}

