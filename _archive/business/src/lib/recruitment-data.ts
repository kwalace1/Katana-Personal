import { getTodayDateKey } from '@/lib/due-date-utils'
// Recruitment Data Management System
// Handles anonymous application storage and recruiter access

export interface Application {
  id: string // Anonymous ID (e.g., "APL-2025-0001")
  anonymousId: string // Display ID for recruiters
  jobId: string
  jobTitle: string
  department: string
  status: "new" | "reviewing" | "interview-scheduled" | "interviewed" | "offer" | "rejected" | "withdrawn"
  appliedDate: string
  
  // Personal Information (hidden until revealed)
  personalInfo: {
    firstName: string
    lastName: string
    email: string
    phone: string
    location: string
  }
  
  // Professional Information (visible to recruiters)
  professionalInfo: {
    resumeUrl?: string
    coverLetter: string
    linkedin?: string
    portfolio?: string
    resumeFileName?: string
  }
  
  // Metadata
  isRevealed: boolean // Whether personal info has been revealed
  revealedAt?: string
  revealedBy?: string // Recruiter who revealed the info
  
  // Recruiter notes
  notes?: string
  rating?: number // 1-5 stars
  interviewDate?: string
}

// Mock applications storage - starts empty, will be populated by real applications
let mockApplications: Application[] = []

// Generate unique anonymous ID
export function generateApplicationId(): string {
  const year = new Date().getFullYear()
  const existingIds = mockApplications
    .filter(app => app.id.includes(year.toString()))
    .map(app => parseInt(app.id.split('-')[2]))
  
  const nextNumber = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1
  return `APL-${year}-${String(nextNumber).padStart(4, '0')}`
}

// Create new application (called from careers page)
export function submitApplication(applicationData: {
  jobId: string
  jobTitle: string
  department: string
  firstName: string
  lastName: string
  email: string
  phone: string
  location: string
  resume: File | null
  coverLetter: string
  linkedin?: string
  portfolio?: string
}): Application {
  const newApplication: Application = {
    id: generateApplicationId(),
    anonymousId: generateApplicationId(),
    jobId: applicationData.jobId,
    jobTitle: applicationData.jobTitle,
    department: applicationData.department,
    status: "new",
    appliedDate: getTodayDateKey(),
    personalInfo: {
      firstName: applicationData.firstName,
      lastName: applicationData.lastName,
      email: applicationData.email,
      phone: applicationData.phone,
      location: applicationData.location
    },
    professionalInfo: {
      resumeFileName: applicationData.resume?.name,
      coverLetter: applicationData.coverLetter,
      linkedin: applicationData.linkedin,
      portfolio: applicationData.portfolio
    },
    isRevealed: false
  }
  
  mockApplications.push(newApplication)
  
  // Dispatch custom event to notify other components
  window.dispatchEvent(new CustomEvent('applicationSubmitted', { 
    detail: newApplication 
  }))
  
  console.log('New application submitted:', newApplication)
  return newApplication
}

// Get all applications (for recruiter dashboard)
export function getAllApplications(): Application[] {
  return [...mockApplications]
}

// Get applications by status
export function getApplicationsByStatus(status: Application['status']): Application[] {
  return mockApplications.filter(app => app.status === status)
}

// Get applications by job
export function getApplicationsByJob(jobId: string): Application[] {
  return mockApplications.filter(app => app.jobId === jobId)
}

// Get single application
export function getApplicationById(id: string): Application | undefined {
  return mockApplications.find(app => app.id === id)
}

// Update application status
export function updateApplicationStatus(
  applicationId: string, 
  status: Application['status']
): Application | null {
  const application = mockApplications.find(app => app.id === applicationId)
  if (application) {
    const previousStatus = application.status
    application.status = status
    
    // If status is changed to a non-revealing status, automatically hide identity again
    const revealAllowedStatuses: Application['status'][] = ['interviewed', 'offer']
    if (!revealAllowedStatuses.includes(status) && application.isRevealed) {
      application.isRevealed = false
      application.revealedAt = undefined
      application.revealedBy = undefined
      console.log(`Identity automatically hidden for ${applicationId} due to status change from ${previousStatus} to ${status}`)
    }
    
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
    return application
  }
  return null
}

// Reveal personal information (only allowed at interviewed status or later)
export function revealApplicantInfo(
  applicationId: string,
  recruiterName: string
): Application | null {
  const application = mockApplications.find(app => app.id === applicationId)
  if (application) {
    // Only allow reveal if status is interviewed or later
    const allowedStatuses: Application['status'][] = ['interviewed', 'offer']
    if (!allowedStatuses.includes(application.status)) {
      console.warn(`Cannot reveal identity. Candidate must be in "interviewed" status or later. Current status: ${application.status}`)
      return null
    }
    
    application.isRevealed = true
    application.revealedAt = new Date().toISOString()
    application.revealedBy = recruiterName
    
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
    console.log(`Personal info revealed for ${applicationId} by ${recruiterName}`)
    return application
  }
  return null
}

// Add notes to application
export function addApplicationNotes(
  applicationId: string,
  notes: string
): Application | null {
  const application = mockApplications.find(app => app.id === applicationId)
  if (application) {
    application.notes = notes
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
    return application
  }
  return null
}

// Rate application
export function rateApplication(
  applicationId: string,
  rating: number
): Application | null {
  const application = mockApplications.find(app => app.id === applicationId)
  if (application) {
    application.rating = rating
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
    return application
  }
  return null
}

// Schedule interview
export function scheduleInterview(
  applicationId: string,
  interviewDate: string
): Application | null {
  const application = mockApplications.find(app => app.id === applicationId)
  if (application) {
    application.interviewDate = interviewDate
    application.status = "interview-scheduled"
    window.dispatchEvent(new CustomEvent('applicationUpdated'))
    return application
  }
  return null
}

// Get statistics
export function getApplicationStats() {
  return {
    total: mockApplications.length,
    new: mockApplications.filter(app => app.status === 'new').length,
    reviewing: mockApplications.filter(app => app.status === 'reviewing').length,
    interviewScheduled: mockApplications.filter(app => app.status === 'interview-scheduled').length,
    interviewed: mockApplications.filter(app => app.status === 'interviewed').length,
    offers: mockApplications.filter(app => app.status === 'offer').length,
  }
}

