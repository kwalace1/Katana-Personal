import { FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Camera, Loader2, Newspaper, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { TogetherSetup } from '@/components/TogetherSetup'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { useCloudAuth } from '@/contexts/CloudAuthContext'
import { pageEnterSubtle, staggerContainer } from '@/lib/motion-ui'
import {
  listPostsByAuthor,
  resolveAuthorNames,
  resolveAuthorPhotos,
  type RankedPost,
} from '@/lib/social/feed'
import {
  loadEngagementForPosts,
  type PostEngagement,
} from '@/lib/social/feed-engagement'
import {
  getCloudProfile,
  resolveProfilePhotoUrl,
  updateCloudProfile,
  uploadProfilePhoto,
} from '@/lib/social/friends'
import { FeedPostCard } from '@/modules/social/components/FeedPostCard'
import { FeedAvatar } from '@/modules/social/components/feed-ui'

const BIO_MAX = 160

export default function FeedProfilePage() {
  const { uid: rawUid } = useParams()
  const uid = rawUid ? decodeURIComponent(rawUid) : ''
  const { cloudEnabled, cloudUser, cloudProfile, refreshCloudProfile } = useCloudAuth()

  const [posts, setPosts] = useState<RankedPost[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<Record<string, string | null>>({})
  const [engagement, setEngagement] = useState<Record<string, PostEngagement>>({})
  const [displayName, setDisplayName] = useState('Friend')
  const [friendCode, setFriendCode] = useState<string | null>(null)
  const [bio, setBio] = useState('')
  const [photoURL, setPhotoURL] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [bioDraft, setBioDraft] = useState('')
  const [saving, setSaving] = useState(false)
  const photoInputRef = useRef<HTMLInputElement>(null)

  const isSelf = Boolean(cloudUser && uid === cloudUser.uid)
  const selfName = cloudProfile?.displayName || 'You'

  useEffect(() => {
    if (!cloudUser || !uid) {
      setLoading(false)
      setPosts([])
      return
    }
    let cancelled = false
    setLoading(true)
    void (async () => {
      try {
        if (isSelf) {
          setDisplayName(selfName)
          setFriendCode(cloudProfile?.friendCode || null)
          setBio(cloudProfile?.bio || '')
          const url = await resolveProfilePhotoUrl(cloudProfile?.photoURL)
          if (!cancelled) setPhotoURL(url)
        } else {
          const profile = await getCloudProfile(uid)
          if (!cancelled) {
            setDisplayName(profile?.displayName || 'Friend')
            setFriendCode(profile?.friendCode || null)
            setBio(profile?.bio || '')
            setPhotoURL(await resolveProfilePhotoUrl(profile?.photoURL))
          }
        }
        const list = await listPostsByAuthor(cloudUser.uid, uid)
        if (cancelled) return
        setPosts(list)
        const authorIds = list.flatMap((p) => [
          p.authorId,
          ...(p.repost ? [p.repost.authorId] : []),
        ])
        const [nameMap, photoMap, eng] = await Promise.all([
          resolveAuthorNames(authorIds),
          resolveAuthorPhotos(authorIds),
          loadEngagementForPosts(
            list.map((p) => p.id),
            cloudUser.uid,
          ),
        ])
        if (cancelled) return
        setNames(nameMap)
        setPhotos(photoMap)
        setEngagement(eng)
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : 'Couldn’t load profile')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    cloudUser,
    uid,
    isSelf,
    selfName,
    cloudProfile?.friendCode,
    cloudProfile?.bio,
    cloudProfile?.photoURL,
  ])

  const subtitle = useMemo(() => {
    if (isSelf) return 'Your posts'
    return 'Posts you can both see'
  }, [isSelf])

  async function saveBio(e: FormEvent) {
    e.preventDefault()
    if (!cloudUser) return
    setSaving(true)
    try {
      const next = bioDraft.trim().slice(0, BIO_MAX)
      await updateCloudProfile(cloudUser.uid, { bio: next || null })
      await refreshCloudProfile()
      setBio(next)
      setEditOpen(false)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t save bio')
    } finally {
      setSaving(false)
    }
  }

  async function onPhotoPicked(file: File | null) {
    if (!file || !cloudUser) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image')
      return
    }
    setSaving(true)
    try {
      const path = await uploadProfilePhoto(cloudUser.uid, file)
      await refreshCloudProfile()
      setPhotoURL(await resolveProfilePhotoUrl(path))
      toast.success('Photo updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Couldn’t upload photo')
    } finally {
      setSaving(false)
    }
  }

  if (!cloudEnabled) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-4 sm:px-6">
        <TogetherSetup />
      </motion.div>
    )
  }

  if (!cloudUser) {
    return (
      <motion.div {...pageEnterSubtle} className="kp-page mx-auto max-w-xl px-4 sm:px-6">
        <EmptyState
          title="Connect to view profiles"
          description="Profiles live on Together cloud."
          action={
            <Button asChild>
              <Link to="/settings#cloud">Connect</Link>
            </Button>
          }
        />
      </motion.div>
    )
  }

  return (
    <motion.div {...pageEnterSubtle} className="mx-auto w-full max-w-xl pb-24">
      <header className="sticky top-0 z-20 border-b border-border/50 bg-background/90 px-4 py-3 backdrop-blur-md sm:px-5">
        <div className="flex items-center gap-3">
          <Button asChild type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Back to Social">
            <Link to="/social">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl tracking-tight">{displayName}</h1>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
        </div>
      </header>

      <div className="border-b border-border/50 px-4 py-5 sm:px-5">
        <div className="flex items-end gap-4">
          <div className="relative">
            <FeedAvatar name={displayName} photoURL={photoURL} size="lg" className="h-16 w-16 text-base" />
            {isSelf ? (
              <>
                <button
                  type="button"
                  disabled={saving}
                  aria-label="Change photo"
                  onClick={() => photoInputRef.current?.click()}
                  className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border border-border/60 bg-card text-foreground shadow-sm transition hover:bg-secondary"
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null
                    e.target.value = ''
                    void onPhotoPicked(f)
                  }}
                />
              </>
            ) : null}
          </div>
          <div className="min-w-0 flex-1 pb-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold tracking-tight">{displayName}</p>
                {friendCode ? (
                  <p className="font-mono text-xs text-muted-foreground">@{friendCode}</p>
                ) : null}
              </div>
              {isSelf ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => {
                    setBioDraft(bio)
                    setEditOpen(true)
                  }}
                >
                  <Pencil className="mr-1.5 h-3.5 w-3.5" />
                  Edit
                </Button>
              ) : null}
            </div>
            {bio ? (
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{bio}</p>
            ) : isSelf ? (
              <p className="mt-2 text-sm text-muted-foreground">Add a short bio so friends know what you’re working on.</p>
            ) : null}
            <p className="mt-2 text-sm text-muted-foreground">
              {posts.length} post{posts.length === 1 ? '' : 's'}
            </p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : posts.length === 0 ? (
        <div className="px-4 py-10 sm:px-5">
          <EmptyState
            icon={Newspaper}
            title={isSelf ? 'No posts yet' : 'Nothing to show'}
            description={
              isSelf
                ? 'Wins you share from Today, habits, health, and day close show up here.'
                : 'You only see posts shared with you.'
            }
            action={
              isSelf ? (
                <Button asChild>
                  <Link to="/social">Go to Social</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
          {posts.map((post) => (
            <FeedPostCard
              key={post.id}
              post={post}
              authorName={
                post.authorId === cloudUser.uid
                  ? selfName
                  : post.authorId === uid
                    ? displayName
                    : names[post.authorId] || 'Friend'
              }
              authorPhotoURL={
                post.authorId === uid
                  ? photoURL
                  : post.authorId === cloudUser.uid
                    ? photos[cloudUser.uid]
                    : photos[post.authorId]
              }
              selfUid={cloudUser.uid}
              selfName={selfName}
              engagement={
                engagement[post.id] || {
                  likeCount: 0,
                  commentCount: 0,
                  likedByMe: false,
                  repostedByMe: false,
                }
              }
              onEngagementChange={(next) =>
                setEngagement((e) => ({ ...e, [post.id]: next }))
              }
              onDeleted={() => setPosts((p) => p.filter((x) => x.id !== post.id))}
              names={names}
              photos={photos}
              onNames={(extra) => setNames((n) => ({ ...n, ...extra }))}
            />
          ))}
        </motion.div>
      )}

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="bottom" className="mx-auto max-h-[85vh] max-w-xl rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Edit profile</SheetTitle>
            <SheetDescription>A short bio helps friends support what you’re building.</SheetDescription>
          </SheetHeader>
          <form onSubmit={(e) => void saveBio(e)} className="space-y-4 px-1 pb-6 pt-2">
            <div>
              <label htmlFor="bio" className="text-sm font-medium">
                Bio
              </label>
              <Textarea
                id="bio"
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value.slice(0, BIO_MAX))}
                maxLength={BIO_MAX}
                rows={4}
                placeholder="What are you working on?"
                className="mt-1.5"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {bioDraft.length}/{BIO_MAX}
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </form>
        </SheetContent>
      </Sheet>
    </motion.div>
  )
}
