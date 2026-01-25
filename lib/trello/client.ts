// Trello API client for browser-based authorization

export interface TrelloBoard {
  id: string;
  name: string;
  desc: string;
  url: string;
}

export interface TrelloList {
  id: string;
  name: string;
  pos: number;
  idBoard: string;
}

export interface TrelloCard {
  id: string;
  name: string;
  desc: string;
  pos: number;
  idShort: number;
  idList: string;
  idBoard: string;
}

// Trello API key - this is public and safe to include in client code
// Users authorize with their own accounts
const TRELLO_API_KEY = "your_api_key_here"; // TODO: move to env

const TRELLO_API_BASE = "https://api.trello.com/1";

/**
 * Get stored Trello token from localStorage
 */
export function getTrelloToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("trello_token");
}

/**
 * Save Trello token to localStorage
 */
export function saveTrelloToken(token: string): void {
  localStorage.setItem("trello_token", token);
}

/**
 * Clear Trello token
 */
export function clearTrelloToken(): void {
  localStorage.removeItem("trello_token");
}

/**
 * Get Trello API key from env or localStorage
 */
export function getTrelloApiKey(): string {
  // First check env (for development)
  if (process.env.NEXT_PUBLIC_TRELLO_API_KEY) {
    return process.env.NEXT_PUBLIC_TRELLO_API_KEY;
  }
  // Then check localStorage (user can set their own)
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("trello_api_key");
    if (stored) return stored;
  }
  return TRELLO_API_KEY;
}

/**
 * Save custom API key
 */
export function saveTrelloApiKey(apiKey: string): void {
  localStorage.setItem("trello_api_key", apiKey);
}

/**
 * Generate Trello authorization URL
 * Opens in a new window, user approves, then redirected back with token
 */
export function getTrelloAuthUrl(returnUrl?: string): string {
  const apiKey = getTrelloApiKey();
  const callback = returnUrl || `${window.location.origin}/trello/callback`;

  const params = new URLSearchParams({
    key: apiKey,
    name: "CHGK-Web",
    scope: "read",
    response_type: "token",
    expiration: "never",
    return_url: callback,
  });

  return `https://trello.com/1/authorize?${params.toString()}`;
}

/**
 * Open Trello auth in popup window
 */
export function openTrelloAuth(): Promise<string> {
  return new Promise((resolve, reject) => {
    const authUrl = getTrelloAuthUrl();
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      "trello_auth",
      `width=${width},height=${height},left=${left},top=${top}`,
    );

    if (!popup) {
      reject(new Error("Popup blocked"));
      return;
    }

    // Listen for message from callback page
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "trello_token") {
        window.removeEventListener("message", handleMessage);
        popup.close();

        if (event.data.token) {
          saveTrelloToken(event.data.token);
          resolve(event.data.token);
        } else {
          reject(new Error("Authorization cancelled"));
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // Check if popup was closed without auth
    const checkClosed = setInterval(() => {
      if (popup.closed) {
        clearInterval(checkClosed);
        window.removeEventListener("message", handleMessage);
        // Give a small delay for the message to arrive
        setTimeout(() => {
          if (!getTrelloToken()) {
            reject(new Error("Authorization cancelled"));
          }
        }, 500);
      }
    }, 500);
  });
}

/**
 * Make authenticated request to Trello API
 */
async function trelloFetch<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const token = getTrelloToken();
  const apiKey = getTrelloApiKey();

  if (!token) {
    throw new Error("Not authorized with Trello");
  }

  const searchParams = new URLSearchParams({
    key: apiKey,
    token,
    ...params,
  });

  const response = await fetch(`${TRELLO_API_BASE}${endpoint}?${searchParams}`);

  if (!response.ok) {
    if (response.status === 401) {
      clearTrelloToken();
      throw new Error("Trello authorization expired");
    }
    throw new Error(`Trello API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Test Trello connection and get user info
 */
export async function testTrelloConnection(): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const member = await trelloFetch<{ username: string }>("/members/me", {
      fields: "username",
    });
    return { ok: true, username: member.username };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Connection failed",
    };
  }
}

/**
 * Fetch user's boards
 */
export async function fetchBoards(): Promise<TrelloBoard[]> {
  return trelloFetch<TrelloBoard[]>("/members/me/boards", {
    fields: "id,name,desc,url",
    filter: "open",
  });
}

/**
 * Fetch lists from a board
 */
export async function fetchLists(boardId: string): Promise<TrelloList[]> {
  return trelloFetch<TrelloList[]>(`/boards/${boardId}/lists`, {
    fields: "id,name,pos,idBoard",
    filter: "open",
  });
}

/**
 * Fetch cards from a list
 */
export async function fetchCards(listId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(`/lists/${listId}/cards`, {
    fields: "id,name,desc,pos,idShort,idList,idBoard",
  });
}

/**
 * Fetch all cards from a board
 */
export async function fetchBoardCards(boardId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(`/boards/${boardId}/cards`, {
    fields: "id,name,desc,pos,idShort,idList,idBoard",
  });
}
