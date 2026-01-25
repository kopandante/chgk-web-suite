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

const TRELLO_API_BASE = "https://api.trello.com/1";

/**
 * Get Trello API key from env
 */
export function getTrelloApiKey(): string {
  return process.env.NEXT_PUBLIC_TRELLO_API_KEY || "";
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
    name: "CHGK Web Suite",
    scope: "read",
    response_type: "token",
    expiration: "never",
    return_url: callback,
  });

  return `https://trello.com/1/authorize?${params.toString()}`;
}

/**
 * Open Trello auth in popup window
 * Returns the token (does not save it)
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

    let resolved = false;

    // Listen for message from callback page
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === "trello_token") {
        window.removeEventListener("message", handleMessage);
        popup.close();

        if (event.data.token) {
          resolved = true;
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
          if (!resolved) {
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
async function trelloFetch<T>(
  token: string,
  endpoint: string,
  params: Record<string, string> = {},
): Promise<T> {
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
      throw new Error("Trello authorization expired");
    }
    throw new Error(`Trello API error: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Test Trello connection and get user info
 */
export async function testTrelloConnection(token: string): Promise<{
  ok: boolean;
  username?: string;
  error?: string;
}> {
  try {
    const member = await trelloFetch<{ username: string }>(token, "/members/me", {
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
export async function fetchBoards(token: string): Promise<TrelloBoard[]> {
  return trelloFetch<TrelloBoard[]>(token, "/members/me/boards", {
    fields: "id,name,desc,url",
    filter: "open",
  });
}

/**
 * Fetch lists from a board
 */
export async function fetchLists(token: string, boardId: string): Promise<TrelloList[]> {
  return trelloFetch<TrelloList[]>(token, `/boards/${boardId}/lists`, {
    fields: "id,name,pos,idBoard",
    filter: "open",
  });
}

/**
 * Fetch cards from a list
 */
export async function fetchCards(token: string, listId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(token, `/lists/${listId}/cards`, {
    fields: "id,name,desc,pos,idShort,idList,idBoard",
  });
}

/**
 * Fetch all cards from a board
 */
export async function fetchBoardCards(token: string, boardId: string): Promise<TrelloCard[]> {
  return trelloFetch<TrelloCard[]>(token, `/boards/${boardId}/cards`, {
    fields: "id,name,desc,pos,idShort,idList,idBoard",
  });
}
