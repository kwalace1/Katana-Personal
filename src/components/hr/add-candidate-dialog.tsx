"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Upload, AlertCircle, Loader2, Sparkles } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  submitJobApplication,
  uploadApplicationResume,
  type JobApplication,
  getAllJobs,
  type Job,
} from "@/lib/recruitment-db"
import { toast } from "sonner"
import { parseResumeFile } from "@/lib/resume-parser"
import { collectPiiTokensFromParsed, redactPII, redactResumeForBlindReview } from "@/lib/anonymous-resume-profile"
import { enrichAnonymousProfileFromParsed } from "@/lib/anonymized-resume-pdf"
import { SwitchImportDivert } from "@/components/switch/switch-import-divert"

// Generate anonymous candidate ID
const generateCandidateId = () => {
  const prefix = "CAND"
  const timestamp = Date.now().toString(36).toUpperCase()
  const random = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${timestamp}-${random}`
}

export function AddCandidateDialog() {
  const [open, setOpen] = useState(false)
  const [jobs, setJobs] = useState<Job[]>([])
  const [jobsLoading, setJobsLoading] = useState(false)
  const [formData, setFormData] = useState({
    candidateId: "",
    jobId: "",
    position: "",
    assignedTo: "",
    skills: "",
    experience: "",
    education: "",
    certifications: "",
    notes: "",
    resumeFile: null as File | null,
    resumeText: "",
    // Sealed PII — stored on the row but hidden until the candidate reaches
    // "Interviewed" / "Offer" status and a recruiter clicks "Reveal Identity".
    realFirstName: "",
    realLastName: "",
    realEmail: "",
    realPhone: "",
    realLocation: "",
  })
  const [showRedactionWarning, setShowRedactionWarning] = useState(false)
  const [resumeParsing, setResumeParsing] = useState(false)
  const [resumeParseStatus, setResumeParseStatus] = useState<{
    type: 'success' | 'warning' | 'error'
    message: string
  } | null>(null)

  // Load available jobs when dialog opens
  useEffect(() => {
    if (open) {
      loadJobs()
    }
  }, [open])

  const loadJobs = async () => {
    setJobsLoading(true)
    try {
      const jobsData = await getAllJobs()
      setJobs(jobsData)
    } catch (error) {
      console.error('Error loading jobs:', error)
    } finally {
      setJobsLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFormData((prev) => ({ ...prev, resumeFile: file }))
    setShowRedactionWarning(true)
    setResumeParsing(true)
    setResumeParseStatus(null)

    try {
      const parsed = await parseResumeFile(file)

      if (parsed.unsupported) {
        setResumeParseStatus({
          type: 'warning',
          message: parsed.error ?? 'This file type cannot be parsed in the browser. Please type the contact fields manually.',
        })
        return
      }

      // Pre-fill the sealed (PII) fields and skills from the parser. The
      // PII fields are intentionally NOT shown back to the recruiter in this
      // dialog — they remain hidden until the candidate reaches Interviewed
      // or Offer status and a recruiter clicks "Reveal Identity".
      const parsedSkills = parsed.skills.join(', ')
      const piiTokens = collectPiiTokensFromParsed(parsed)
      setFormData((prev) => {
        const next = {
          ...prev,
          resumeText: redactResumeForBlindReview(parsed.rawText, { piiTokens }),
        }
        if (!prev.realFirstName && parsed.firstName) next.realFirstName = parsed.firstName
        if (!prev.realLastName && parsed.lastName) next.realLastName = parsed.lastName
        if (!prev.realEmail && parsed.email) next.realEmail = parsed.email
        if (!prev.realPhone && parsed.phone) next.realPhone = parsed.phone
        if (!prev.realLocation && parsed.location) next.realLocation = parsed.location
        if (!prev.skills && parsedSkills) next.skills = parsedSkills
        if (!prev.experience && parsed.experience) next.experience = parsed.experience
        if (!prev.education && parsed.education) next.education = parsed.education
        if (!prev.certifications && parsed.certifications) next.certifications = parsed.certifications
        return next
      })

      const capturedAnyPii = Boolean(
        parsed.firstName || parsed.lastName || parsed.email || parsed.phone || parsed.location
      )

      if (capturedAnyPii) {
        setResumeParseStatus({
          type: 'success',
          message:
            "Contact details captured from the resume. They stay sealed until the candidate reaches Interviewed/Offer and you click Reveal Identity.",
        })
      } else {
        setResumeParseStatus({
          type: 'warning',
          message:
            "Resume parsed, but no contact details were detected. The candidate will stay fully anonymous unless contact info is added later.",
        })
      }
    } catch (err) {
      console.error('Resume parsing failed:', err)
      setResumeParseStatus({
        type: 'error',
        message:
          err instanceof Error
            ? `Could not parse resume: ${err.message}`
            : 'Could not parse resume. Please enter the contact fields manually.',
      })
    } finally {
      setResumeParsing(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.jobId || !formData.assignedTo) {
      toast.error("Please fill in all required fields (Job Position and Assigned Recruiter)")
      return
    }
    
    try {
      // Generate anonymous ID if not exists
      const candidateId = formData.candidateId || generateCandidateId()
      
      // Redact any PII in notes field
      const redactedNotes = redactPII(formData.notes)
      
      // Real values get persisted so they can be unmasked after the candidate
      // reaches Interviewed / Offer status. Until then the dashboard shows the
      // anonymous ID and treats first/last name as redacted.
      const realFirst = formData.realFirstName.trim()
      const realLast = formData.realLastName.trim()
      const realEmail = formData.realEmail.trim()
      const realPhone = formData.realPhone.trim()
      const realLocation = formData.realLocation.trim()

      const resumeProfile = enrichAnonymousProfileFromParsed(
        {
          rawText: formData.resumeText,
          firstName: formData.realFirstName || null,
          lastName: formData.realLastName || null,
          email: formData.realEmail || null,
          phone: formData.realPhone || null,
          location: formData.realLocation || null,
          linkedin: null,
          skills: formData.skills.split(/[,;]/).map((s) => s.trim()).filter(Boolean),
          experience: formData.experience,
          education: formData.education,
          certifications: formData.certifications || undefined,
        },
        {
          skills: formData.skills,
          experience: formData.experience,
          education: formData.education,
          certifications: formData.certifications || undefined,
        },
      )

      const applicationData: JobApplication = {
        anonymousId: candidateId,
        jobId: formData.jobId,
        firstName: realFirst || "Anonymous",
        lastName: realLast || "Candidate",
        email: realEmail || "anonymous@redacted.com",
        phone: realPhone || "+1 (555) XXX-XXXX",
        location: realLocation || "Location Redacted",
        coverLetter: `Skills: ${formData.skills}\nExperience: ${formData.experience}\nEducation: ${formData.education}\nCertifications: ${formData.certifications}\nAssigned To: ${formData.assignedTo}\nNotes: ${redactedNotes}`,
        resumeFileName: formData.resumeFile?.name || null,
        linkedin: null,
        portfolio: null,
        resumeProfile,
      }
      
      const result = await submitJobApplication(applicationData)
      
      if (result.ok) {
        if (formData.resumeFile) {
          void uploadApplicationResume(result.applicationId, formData.resumeFile)
        }
        toast.success("Anonymous candidate added successfully")
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent("applicationSubmitted"))
        }

        setOpen(false)
        setFormData({
          candidateId: "",
          jobId: "",
          position: "",
          assignedTo: "",
          skills: "",
          experience: "",
          education: "",
          certifications: "",
          notes: "",
          resumeFile: null,
          resumeText: "",
          realFirstName: "",
          realLastName: "",
          realEmail: "",
          realPhone: "",
          realLocation: "",
        })
        setShowRedactionWarning(false)
        setResumeParseStatus(null)
      } else {
        throw new Error("Failed to save to database")
      }
    } catch (error) {
      console.error("Error adding candidate:", error)
      const details = error instanceof Error ? error.message : "Please try again."
      toast.error("Error adding candidate", { description: details })
    }
  }
  
  // Helper function to map position to department
  const getDepartmentFromPosition = (position: string): string => {
    const positionDepartmentMap: { [key: string]: string } = {
      "Senior Developer": "Engineering",
      "DevOps Engineer": "Engineering", 
      "Data Analyst": "Engineering",
      "Product Manager": "Product",
      "UX Designer": "Design",
      "Marketing Manager": "Marketing",
      "Sales Representative": "Sales"
    }
    return positionDepartmentMap[position] || "Other"
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Anonymous Candidate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Anonymous Candidate</DialogTitle>
            <DialogDescription>
              All candidate information is anonymized. No personal identifying information (PII) will be stored or displayed.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Anonymous ID Display */}
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Anonymous ID System:</strong> Each candidate will be assigned a unique identifier (e.g., CAND-XXXXX-XXXX). 
                No names, emails, phone numbers, or other PII will be collected or displayed.
              </AlertDescription>
            </Alert>

            <div className="grid gap-2">
              <Label htmlFor="candidateId">Candidate ID (Optional - Auto-generated)</Label>
              <Input
                id="candidateId"
                value={formData.candidateId}
                onChange={(e) => setFormData({ ...formData, candidateId: e.target.value })}
                placeholder="Leave blank for auto-generation"
              />
              <p className="text-xs text-muted-foreground">
                If left blank, a unique ID will be automatically generated (e.g., CAND-LXYZ1234-AB5C)
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="position">Job Position *</Label>
              <Select
                value={formData.jobId}
                onValueChange={(value) => {
                  const selectedJob = jobs.find(job => job.id === value)
                  setFormData({ 
                    ...formData, 
                    jobId: value,
                    position: selectedJob?.title || ""
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select job posting" />
                </SelectTrigger>
                <SelectContent>
                  {jobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.title} - {job.department}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {jobsLoading ? (
                <p className="text-xs text-muted-foreground">
                  Loading available positions...
                </p>
              ) : jobs.length === 0 ? (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  No active job postings yet. Open the <strong>Job Listings</strong> tab and click <strong>New Job Listing</strong> first, then return here.
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="resume">Resume Upload (Auto-Parsed)</Label>
              <Input
                id="resume"
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileUpload}
                className="cursor-pointer"
                disabled={resumeParsing}
              />
              <p className="text-xs text-muted-foreground">
                PDF and TXT resumes are parsed in your browser to pre-fill the sealed contact fields below.
                Word docs (.doc / .docx) aren&apos;t supported — save as PDF first.
              </p>
              <SwitchImportDivert
                module="careers"
                entityType="job_application"
                sourceLabel="katana.careers.resume_import"
                file={formData.resumeFile}
                context={{ job_posting_id: formData.jobId || null }}
                disabled={!formData.resumeFile}
              />
            </div>

            {resumeParsing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Parsing resume...
              </div>
            )}

            {!resumeParsing && resumeParseStatus && (
              <Alert
                className={
                  resumeParseStatus.type === 'success'
                    ? 'bg-green-50 dark:bg-green-950 border-green-200'
                    : resumeParseStatus.type === 'warning'
                      ? 'bg-amber-50 dark:bg-amber-950 border-amber-200'
                      : 'bg-red-50 dark:bg-red-950 border-red-200'
                }
              >
                {resumeParseStatus.type === 'success' ? (
                  <Sparkles className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle
                    className={`h-4 w-4 ${
                      resumeParseStatus.type === 'warning'
                        ? 'text-amber-600'
                        : 'text-red-600'
                    }`}
                  />
                )}
                <AlertDescription>{resumeParseStatus.message}</AlertDescription>
              </Alert>
            )}

            {showRedactionWarning && !resumeParsing && !resumeParseStatus && (
              <Alert className="bg-amber-50 dark:bg-amber-950 border-amber-200">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription>
                  <strong>Resume Uploaded:</strong> Stored on the application. Personal details remain hidden in the dashboard until the candidate reaches Interviewed/Offer.
                </AlertDescription>
              </Alert>
            )}

            <div className="grid gap-2">
              <Label htmlFor="skills">Skills & Technologies</Label>
              <Input
                id="skills"
                value={formData.skills}
                onChange={(e) => setFormData({ ...formData, skills: e.target.value })}
                placeholder="React, Node.js, Python, AWS..."
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="experience">Years of Experience</Label>
              <Select
                value={formData.experience}
                onValueChange={(value) => setFormData({ ...formData, experience: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select experience level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0-2">0-2 years</SelectItem>
                  <SelectItem value="2-5">2-5 years</SelectItem>
                  <SelectItem value="5-10">5-10 years</SelectItem>
                  <SelectItem value="10+">10+ years</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="education">Education Level</Label>
              <Select
                value={formData.education}
                onValueChange={(value) => setFormData({ ...formData, education: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select education level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="High School">High School</SelectItem>
                  <SelectItem value="Associate">Associate Degree</SelectItem>
                  <SelectItem value="Bachelor">Bachelor's Degree</SelectItem>
                  <SelectItem value="Master">Master's Degree</SelectItem>
                  <SelectItem value="PhD">PhD/Doctorate</SelectItem>
                  <SelectItem value="Bootcamp">Coding Bootcamp</SelectItem>
                  <SelectItem value="Self-Taught">Self-Taught</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="certifications">Certifications (Optional)</Label>
              <Input
                id="certifications"
                value={formData.certifications}
                onChange={(e) => setFormData({ ...formData, certifications: e.target.value })}
                placeholder="AWS Certified, PMP, Google Analytics..."
              />
              <p className="text-xs text-muted-foreground">
                Enter certifications separated by commas. This helps improve matching accuracy.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="assignedTo">Assigned Recruiter *</Label>
              <Select
                value={formData.assignedTo}
                onValueChange={(value) => setFormData({ ...formData, assignedTo: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select recruiter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="recruiter-1">Recruiter A</SelectItem>
                  <SelectItem value="recruiter-2">Recruiter B</SelectItem>
                  <SelectItem value="recruiter-3">Recruiter C</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Anonymous Notes (No PII)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Technical assessment results, interview observations (avoid any identifying information)..."
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Any PII accidentally entered here will be automatically redacted upon submission
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit">Add Anonymous Candidate</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
