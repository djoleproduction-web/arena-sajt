"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Platform } from "@/lib/utils";

/* ---------------- types (serialized) ---------------- */

export interface Artist {
  id: number;
  name: string;
  createdAt: string;
}

export interface Connection {
  id: number;
  artistId: number;
  platform: string;
  accountHandle: string;
  status: string;
  createdAt: string;
}

export interface Post {
  id: number;
  artistId: number;
  title: string;
  caption: string;
  hashtags: string;
  platforms: string[];
  status: string;
  executionType: string;
  scheduledTime: string | null;
  videoUrl: string | null;
  createdAt: string;
}

export interface PostInput {
  title: string;
  caption: string;
  hashtags: string;
  platforms: string[];
  status: string;
  executionType: string;
  scheduledTime: string | null;
  videoUrl: string | null;
}

interface Toast {
  id: number;
  message: string;
  tone: "ok" | "err";
}

export interface SchedulerState {
  open: boolean;
  editing?: Post | null;
  presetDate?: Date | null;
}

interface AppState {
  ready: boolean;
  artists: Artist[];
  connections: Connection[];
  posts: Post[];
  activeArtistId: number | null;
  activeArtist: Artist | null;
  setActiveArtist: (id: number) => void;
  refresh: () => Promise<void>;
  connectionsFor: (artistId: number | null) => Connection[];
  connectionFor: (artistId: number | null, platform: Platform) => Connection | undefined;
  postsFor: (artistId: number | null) => Post[];
  /* mutations */
  addArtist: (name: string) => Promise<boolean>;
  removeArtist: (id: number) => Promise<void>;
  connect: (artistId: number, platform: Platform) => Promise<void>;
  disconnect: (artistId: number, platform: Platform) => Promise<void>;
  addPost: (post: PostInput) => Promise<Post | null>;
  updatePost: (id: number, patch: Partial<PostInput>) => Promise<void>;
  removePost: (id: number) => Promise<void>;
  /* ui */
  toast: (message: string, tone?: "ok" | "err") => void;
  toasts: Toast[];
  scheduler: SchedulerState;
  openScheduler: (opts?: { editing?: Post; presetDate?: Date }) => void;
  closeScheduler: () => void;
}

const Ctx = createContext<AppState | null>(null);

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [artists, setArtists] = useState<Artist[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [activeArtistId, setActiveArtistId] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [scheduler, setScheduler] = useState<SchedulerState>({ open: false });
  const toastId = useRef(0);

  const refresh = useCallback(async () => {
    const [a, c, p] = await Promise.all([
      fetchJSON<{ artists: Artist[] }>("/api/artists"),
      fetchJSON<{ connections: Connection[] }>("/api/connections"),
      fetchJSON<{ posts: Post[] }>("/api/posts"),
    ]);
    setArtists(a.artists);
    setConnections(c.connections);
    setPosts(p.posts);
    return a.artists;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await refresh();
        if (cancelled) return;
        const saved = Number(localStorage.getItem("activeArtistId"));
        const valid = list.find((a) => a.id === saved);
        setActiveArtistId(valid ? valid.id : (list[0]?.id ?? null));
        setReady(true);
      } catch {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const toast = useCallback((message: string, tone: "ok" | "err" = "ok") => {
    const id = ++toastId.current;
    setToasts((t) => [...t, { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const setActiveArtist = useCallback((id: number) => {
    setActiveArtistId(id);
    localStorage.setItem("activeArtistId", String(id));
  }, []);

  const activeArtist = useMemo(
    () => artists.find((a) => a.id === activeArtistId) ?? null,
    [artists, activeArtistId]
  );

  const connectionsFor = useCallback(
    (artistId: number | null) => connections.filter((c) => c.artistId === artistId),
    [connections]
  );

  const connectionFor = useCallback(
    (artistId: number | null, platform: Platform) =>
      connections.find((c) => c.artistId === artistId && c.platform === platform),
    [connections]
  );

  const postsFor = useCallback(
    (artistId: number | null) => posts.filter((p) => p.artistId === artistId),
    [posts]
  );

  /* ---------------- mutations ---------------- */

  const addArtist = useCallback(
    async (name: string) => {
      try {
        const { artist } = await fetchJSON<{ artist: Artist }>("/api/artists", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        });
        await refresh();
        setActiveArtist(artist.id);
        toast(`${artist.name} added to the roster`);
        return true;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to add artist", "err");
        return false;
      }
    },
    [refresh, toast, setActiveArtist]
  );

  const removeArtist = useCallback(
    async (id: number) => {
      await fetchJSON(`/api/artists/${id}`, { method: "DELETE" });
      const list = await refresh();
      setActiveArtistId((prev) => {
        if (prev !== id) return prev;
        const next = list.filter((a) => a.id !== id)[0]?.id ?? null;
        if (next) localStorage.setItem("activeArtistId", String(next));
        else localStorage.removeItem("activeArtistId");
        return next;
      });
      toast("Artist removed (posts & connections deleted)");
    },
    [refresh, toast]
  );

  const connect = useCallback(
    async (artistId: number, platform: Platform) => {
      await fetchJSON("/api/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artistId, platform, status: "connected" }),
      });
      await refresh();
    },
    [refresh]
  );

  const disconnect = useCallback(
    async (artistId: number, platform: Platform) => {
      const conn = connections.find(
        (c) => c.artistId === artistId && c.platform === platform
      );
      if (!conn) return;
      await fetchJSON(`/api/connections/${conn.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "disconnected" }),
      });
      await refresh();
      toast(`${platform} disconnected`);
    },
    [connections, refresh, toast]
  );

  const addPost = useCallback(
    async (post: PostInput) => {
      try {
        if (!activeArtistId) throw new Error("No active artist selected");
        const { post: created } = await fetchJSON<{ post: Post }>("/api/posts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...post, artistId: activeArtistId }),
        });
        await refresh();
        return created;
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to save post", "err");
        return null;
      }
    },
    [activeArtistId, refresh, toast]
  );

  const updatePost = useCallback(
    async (id: number, patch: Partial<PostInput>) => {
      try {
        await fetchJSON(`/api/posts/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        await refresh();
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to update post", "err");
      }
    },
    [refresh, toast]
  );

  const removePost = useCallback(
    async (id: number) => {
      try {
        await fetchJSON(`/api/posts/${id}`, { method: "DELETE" });
        await refresh();
        toast("Post deleted");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to delete post", "err");
      }
    },
    [refresh, toast]
  );

  const openScheduler = useCallback((opts?: { editing?: Post; presetDate?: Date }) => {
    setScheduler({ open: true, editing: opts?.editing ?? null, presetDate: opts?.presetDate ?? null });
  }, []);

  const closeScheduler = useCallback(() => {
    setScheduler({ open: false, editing: null, presetDate: null });
  }, []);

  const value: AppState = {
    ready,
    artists,
    connections,
    posts,
    activeArtistId,
    activeArtist,
    setActiveArtist,
    refresh: async () => {
      await refresh();
    },
    connectionsFor,
    connectionFor,
    postsFor,
    addArtist,
    removeArtist,
    connect,
    disconnect,
    addPost,
    updatePost,
    removePost,
    toast,
    toasts,
    scheduler,
    openScheduler,
    closeScheduler,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
