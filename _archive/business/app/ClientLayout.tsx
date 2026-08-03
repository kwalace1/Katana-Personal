import type React from "react"
import { Suspense } from "react"
import { useLocation } from "react-router-dom"
import Header from "@/components/header"
import Sidebar from "@/components/sidebar"
import { SidebarProvider, useSidebar } from "@/components/sidebar-context"

function ClientLayoutContent({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const location = useLocation()
  const pathname = location.pathname
  const { isCollapsed } = useSidebar()

  const isModulePage =
    pathname.startsWith("/hub") ||
    pathname.startsWith("/projects") ||
    pathname.startsWith("/inventory") ||
    pathname.startsWith("/customer-success") ||
    pathname.startsWith("/workforce") ||
    pathname.startsWith("/hr") ||
    pathname.startsWith("/manufacturing") ||
    pathname.startsWith("/automation")

  const isHomePage = pathname === "/"

  return (
    <div className="min-h-screen bg-background text-foreground">
      {isHomePage && <Header />}
      {isModulePage && <Sidebar />}

      <div className={isModulePage ? `min-w-0 max-w-full overflow-x-hidden transition-all duration-300 ${isCollapsed ? "lg:pl-16" : "lg:pl-72"}` : ""}>
        {children}
      </div>
    </div>
  )
}

export default function ClientLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background text-foreground flex items-center justify-center">Loading...</div>}>
      <SidebarProvider>
        <ClientLayoutContent>{children}</ClientLayoutContent>
      </SidebarProvider>
    </Suspense>
  )
}
