// Script to seed automotive jobs into Supabase
// Run this with: npx tsx src/scripts/seed-automotive-jobs.ts

import { createJob } from '../lib/recruitment-db'

// Declare process for Node.js environment
declare const process: { exit: (code: number) => never }

const automotiveJobs = [
  {
    title: "Master Auto Detailer",
    department: "Detailing",
    location: "Los Angeles, CA",
    type: "full-time" as const,
    level: "senior" as const,
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
    title: "Automotive Technician",
    department: "Performance",
    location: "Los Angeles, CA",
    type: "full-time" as const,
    level: "mid" as const,
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
    title: "Paint Protection Film Installer",
    department: "Detailing",
    location: "Los Angeles, CA",
    type: "full-time" as const,
    level: "mid" as const,
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
    title: "Service Advisor",
    department: "Customer Service",
    location: "Los Angeles, CA",
    type: "full-time" as const,
    level: "mid" as const,
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
    title: "Ceramic Coating Specialist",
    department: "Detailing",
    location: "Los Angeles, CA",
    type: "full-time" as const,
    level: "senior" as const,
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
    title: "Performance Tuner",
    department: "Performance",
    location: "Los Angeles, CA",
    type: "full-time" as const,
    level: "senior" as const,
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
    title: "Shop Assistant",
    department: "Operations",
    location: "Los Angeles, CA",
    type: "part-time" as const,
    level: "entry" as const,
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
    title: "Window Tinting Specialist",
    department: "Detailing",
    location: "Los Angeles, CA",
    type: "full-time" as const,
    level: "mid" as const,
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

async function seedJobs() {
  console.log('Starting automotive jobs migration...')
  
  for (const job of automotiveJobs) {
    console.log(`Creating job: ${job.title}`)
    const result = await createJob(job)

    if ("id" in result) {
      console.log(`✓ Created: ${job.title} (ID: ${result.id})`)
    } else {
      console.error(`✗ Failed to create: ${job.title} — ${result.error}`)
    }
  }
  
  console.log('\nMigration complete!')
  console.log(`Added ${automotiveJobs.length} automotive jobs to the database`)
}

// Run the seed function
seedJobs()
  .then(() => {
    console.log('\n✓ All jobs seeded successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n✗ Error seeding jobs:', error)
    process.exit(1)
  })


